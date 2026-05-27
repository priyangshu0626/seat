"""
optimizer.py — Core optimization engine with hybrid CP-SAT + beam search.

This is the main entry point for the optimization pipeline. It orchestrates
all three layers of the hybrid architecture:

  Layer 1: CP-SAT hard constraints (constraints.py)
  Layer 2: Multi-objective scoring (scoring.py)
  Layer 3: Long-horizon Monte Carlo planning (simulation.py)

The optimizer selects the strategy based on problem size:
  - n ≤ 7:  Exhaustive search with scoring + Monte Carlo rollouts
  - n > 7:  CP-SAT solver + beam search + rollouts
  - Fallback: Legacy greedy if CP-SAT is infeasible

Architecture:
  SeatOptimizer
    ├── optimize_single_day()     → single-day optimal arrangement
    ├── optimize_with_planning()  → lookahead-aware optimization
    ├── generate_schedule()       → multi-day schedule generation
    └── clear_cache()             → cache management

The optimizer maintains:
  - Precomputed permutations for small groups
  - Memoization cache for repeated states
  - CP-SAT model builder for hard constraints
  - Beam search with Monte Carlo rollouts for planning

Determinism guarantee:
  Given identical inputs, the optimizer ALWAYS produces the same output.
  This is enforced via fixed random seeds and deterministic solver config.
"""

from __future__ import annotations

import time
from itertools import permutations as iter_permutations
from typing import Optional

import numpy as np

from .state_manager import EngineConfig, TemporalOverrides
from .graph_model import PairInteractionGraph, get_adjacent_pairs
from .scoring import (
    score_arrangement,
    compute_normalized_entropy,
    compute_coverage,
    compute_diversity_score,
)
from .constraints import (
    build_cpsat_model,
    solve_cpsat_model,
    compute_min_per_seat,
    filter_seat_balanced_legacy,
    apply_all_hard_constraints,
    HAS_ORTOOLS,
)
from .simulation import (
    beam_search_with_rollouts,
    greedy_optimize,
    update_state,
    clone_state,
    compute_future_risk,
)
from .fairness import compute_edge_fairness_score
from .analytics import count_new_pairs
from .ai_assistant import explain_schedule, is_ai_available


class SeatOptimizer:
    """
    Industrial-grade seating optimization engine.

    Orchestrates CP-SAT constraint solving, multi-objective scoring,
    and Monte Carlo long-horizon planning into a unified pipeline.

    Architecture:
      1. Build CP-SAT model with hard constraints
      2. Enumerate feasible solutions (up to 100)
      3. Score solutions with multi-objective function
      4. Evaluate top candidates via Monte Carlo rollouts
      5. Select the arrangement with best combined score
      6. Optionally generate AI explanation

    For small groups (n ≤ 7), the permutation space is small enough
    for exhaustive evaluation, making CP-SAT overhead unnecessary.
    The optimizer automatically selects the optimal strategy.

    Attributes:
        config: engine configuration
        all_perms: precomputed (K, num_seats) permutation array
        _cache: memoization cache for (day_index, state_hash) → result
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()
        n = self.config.num_people

        # Precompute all n! permutations as a numpy array
        # For n=5: 120 permutations (~600 bytes)
        # For n=7: 5040 permutations (~35 KB)
        self.all_perms = np.array(
            list(iter_permutations(range(n))),
            dtype=np.int32,
        )

        # Memoization cache: maps state hash → result
        self._cache: dict[str, dict] = {}

    def _make_cache_key(
        self,
        day_index: int,
        pair_counts: dict[str, int],
        seat_counts: np.ndarray,
        last_arrangement: Optional[list[int]],
        recent_arrangements: Optional[list[list[int]]] = None,
        temporal_overrides: Optional[TemporalOverrides] = None,
    ) -> str:
        """
        Build a deterministic cache key from the optimizer state.

        Enables memoization: if we've already computed the best
        arrangement for this exact state, we skip recomputation.
        Includes recent_arrangements to prevent stale cache hits
        that would produce duplicate arrangements.
        """
        parts = [
            str(day_index),
            str(sorted(pair_counts.items())),
            seat_counts.tobytes().hex(),
            str(last_arrangement) if last_arrangement is not None else "None",
            str([tuple(a) for a in recent_arrangements]) if recent_arrangements else "[]",
            str(temporal_overrides.model_dump()) if temporal_overrides else "None",
        ]
        return "|".join(parts)

    def optimize_single_day(
        self,
        day_index: int,
        pair_counts: dict[str, int],
        seat_counts: np.ndarray,
        last_arrangement: Optional[list[int] | np.ndarray],
        use_planning: bool = True,
        generate_explanation: bool = False,
        recent_arrangements: Optional[list[list[int]]] = None,
        temporal_overrides: Optional[TemporalOverrides] = None,
    ) -> tuple[np.ndarray, float, dict]:
        """
        Find the optimal arrangement for a single day.

        Pipeline:
        1. Check memoization cache
        2. Build pair interaction graph
        3. Try CP-SAT solver for hard constraints
        4. If CP-SAT finds solutions, score them
        5. Optionally run Monte Carlo rollouts on top candidates
        6. Fall back to legacy greedy if needed
        7. Generate AI explanation if requested

        Args:
            day_index: 0-based class day index
            pair_counts: accumulated neighbor pair counts
            seat_counts: (num_people, num_seats) matrix
            last_arrangement: previous day's arrangement, or None
            use_planning: whether to use Monte Carlo lookahead
            generate_explanation: whether to generate AI explanation
            recent_arrangements: history of past arrangements

        Returns:
            (arrangement, score, profiling_dict)
        """
        t_start = time.perf_counter()

        # ── Check cache ──
        cache_key = self._make_cache_key(day_index, pair_counts, seat_counts, last_arrangement, recent_arrangements, temporal_overrides)
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            t_end = time.perf_counter()
            return (
                np.array(cached["arrangement"], dtype=np.int32),
                cached["score"],
                {**cached["profiling"], "computation_ms": (t_end - t_start) * 1000, "cache_hit": True},
            )

        # ── Build graph model ──
        graph = PairInteractionGraph(self.config, pair_counts)
        n = self.config.num_people

        # ── Strategy selection ──
        arrangement = None
        score = 0.0
        profiling: dict = {}

        # Try CP-SAT first
        cpsat_success = False
        try:
            t_cpsat = time.perf_counter()

            model, seat_vars, aux = build_cpsat_model(
                self.config, graph, seat_counts, last_arrangement, day_index,
                recent_arrangements=recent_arrangements,
                temporal_overrides=temporal_overrides,
            )

            solutions, status, solve_ms = solve_cpsat_model(
                model, seat_vars, self.config.num_seats,
                time_limit_ms=self.config.solver_time_limit_ms,
                max_solutions=100,
            )

            t_cpsat_end = time.perf_counter()

            if solutions and status in ("OPTIMAL", "FEASIBLE"):
                cpsat_success = True

                # Score all CP-SAT solutions
                scored = []
                for sol in solutions:
                    sol_arr = np.array(sol, dtype=np.int32)
                    sc = score_arrangement(
                        sol_arr, graph, seat_counts, last_arrangement,
                        day_index, self.config.weights, n,
                        recent_arrangements=recent_arrangements,
                        temporal_overrides=temporal_overrides,
                    )
                    scored.append((sol, sc))

                # Sort by score (descending)
                scored.sort(key=lambda x: x[1], reverse=True)

                if use_planning and len(scored) > 1:
                    # Monte Carlo rollouts on top candidates
                    beam_candidates = scored[:min(self.config.beam_width, len(scored))]

                    best_total = -np.inf
                    best_sol = scored[0][0]
                    best_score = scored[0][1]

                    for sol, sc in beam_candidates:
                        sol_arr = np.array(sol, dtype=np.int32)
                        # Quick rollout evaluation
                        from .simulation import monte_carlo_rollout
                        rng = np.random.default_rng(42 + day_index)

                        rollout_scores = []
                        for r in range(min(self.config.monte_carlo_samples, 5)):
                            rollout_rng = np.random.default_rng(42 + day_index * 1000 + r)
                            rs = monte_carlo_rollout(
                                sol_arr, graph, seat_counts, self.all_perms,
                                self.config, day_index,
                                min(self.config.lookahead_depth, 7),
                                rollout_rng
                            )
                            rollout_scores.append(rs)

                        avg_rollout = np.mean(rollout_scores)
                        total = sc * 0.6 + avg_rollout * 10000 * 0.4

                        if total > best_total:
                            best_total = total
                            best_sol = sol
                            best_score = sc

                    arrangement = np.array(best_sol, dtype=np.int32)
                    score = best_score
                else:
                    arrangement = np.array(scored[0][0], dtype=np.int32)
                    score = scored[0][1]

                profiling = {
                    "solver_status": status,
                    "cpsat_solutions": len(solutions),
                    "cpsat_ms": solve_ms,
                    "total_cpsat_ms": (t_cpsat_end - t_cpsat) * 1000,
                }

        except Exception as e:
            profiling["cpsat_error"] = str(e)

        # ── Fallback: legacy greedy with beam search ──
        if arrangement is None:
            if use_planning and n <= 7:
                arr_list, sc, prof = beam_search_with_rollouts(
                    graph, seat_counts, last_arrangement, self.all_perms,
                    self.config, day_index,
                    beam_width=self.config.beam_width,
                    lookahead_depth=min(self.config.lookahead_depth, 7),
                    num_rollouts=min(self.config.monte_carlo_samples, 10),
                    recent_arrangements=recent_arrangements,
                    temporal_overrides=temporal_overrides,
                )
                arrangement = np.array(arr_list, dtype=np.int32)
                score = sc
                profiling.update(prof)
            else:
                arr_list, sc, prof = greedy_optimize(
                    graph, seat_counts, last_arrangement, self.all_perms,
                    self.config, day_index,
                    recent_arrangements=recent_arrangements,
                    temporal_overrides=temporal_overrides,
                )
                arrangement = np.array(arr_list, dtype=np.int32)
                score = sc
                profiling.update(prof)

        # ── Compute future risk ──
        future_risk = compute_future_risk(
            self.all_perms, arrangement, graph, seat_counts, n, self.config.num_seats
        )
        profiling["future_risk"] = future_risk

        # ── Compute entropy ──
        # Hypothetical pair counts after this arrangement
        hyp_pairs = dict(pair_counts)
        for p in get_adjacent_pairs(arrangement):
            hyp_pairs[p] = hyp_pairs.get(p, 0) + 1
        entropy = compute_normalized_entropy(hyp_pairs, graph.total_possible_pairs)
        profiling["entropy_score"] = entropy

        # ── Generate AI explanation if requested ──
        explanation = ""
        if generate_explanation:
            people_names = [p.name for p in self.config.people]
            explanation = explain_schedule(
                arrangement.tolist(), people_names, pair_counts,
                seat_counts.tolist(),
                compute_edge_fairness_score(seat_counts, n),
                compute_diversity_score(pair_counts, n),
                entropy, day_index
            )
        profiling["explanation"] = explanation

        t_end = time.perf_counter()
        profiling["computation_ms"] = (t_end - t_start) * 1000
        profiling.setdefault("cache_hit", False)
        profiling.setdefault("solver_status", "GREEDY_OPTIMAL")

        # ── Cache result ──
        self._cache[cache_key] = {
            "arrangement": arrangement.tolist(),
            "score": score,
            "profiling": profiling,
        }

        return arrangement, score, profiling

    def generate_schedule(
        self,
        start_day: int,
        num_days: int,
        initial_pair_counts: Optional[dict[str, int]] = None,
        initial_seat_counts: Optional[np.ndarray] = None,
        initial_last_row: Optional[list[int]] = None,
        use_planning: bool = True,
        recent_arrangements: Optional[list[list[int]]] = None,
        temporal_overrides: Optional[TemporalOverrides] = None,
        per_day_overrides: Optional[list[Optional[TemporalOverrides]]] = None,
    ) -> list[tuple[np.ndarray, float, dict]]:
        """

        For the first few days of a bulk request, planning is reduced
        to maintain sub-200ms total latency for 5-person groups.

        Args:
            start_day: first day index
            num_days: number of days to generate
            initial_pair_counts: starting pair counts
            initial_seat_counts: starting seat counts
            initial_last_row: arrangement from the day before start_day
            use_planning: whether to use Monte Carlo lookahead
            per_day_overrides: per-day temporal overrides (takes precedence over temporal_overrides)

        Returns:
            List of (arrangement, score, profiling_dict) for each day
        """
        pair_counts = dict(initial_pair_counts) if initial_pair_counts else {}
        seat_counts = (
            initial_seat_counts.copy()
            if initial_seat_counts is not None
            else np.zeros((self.config.num_people, self.config.num_seats), dtype=np.int32)
        )
        last_row = list(initial_last_row) if initial_last_row is not None else None
        
        # Maintain a sliding window of recent history (e.g. last 14 days)
        history = list(recent_arrangements) if recent_arrangements else []

        results = []

        for day_offset in range(num_days):
            day_index = start_day + day_offset

            # Resolve per-day overrides: per_day_overrides[day_offset] takes precedence
            day_overrides = temporal_overrides
            if per_day_overrides is not None and day_offset < len(per_day_overrides):
                day_overrides = per_day_overrides[day_offset]

            # Enable planning on every day to maximize arrangement diversity
            day_planning = use_planning

            arrangement, score, profiling = self.optimize_single_day(
                day_index, pair_counts, seat_counts, last_row,
                use_planning=day_planning,
                recent_arrangements=history,
                temporal_overrides=day_overrides,
            )

            results.append((arrangement, score, profiling))

            # Advance state
            graph = PairInteractionGraph(self.config, pair_counts)
            update_state(arrangement, graph, seat_counts)
            pair_counts = graph.pair_counts
            last_row = arrangement.tolist()
            
            # Update history sliding window
            history.append(last_row)
            if len(history) > 14:
                history.pop(0)

        return results

    def clear_cache(self):
        """Clear the memoization cache."""
        self._cache.clear()
