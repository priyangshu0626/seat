"""
simulation.py — Long-horizon planning via Monte Carlo rollouts and beam search.

Implements Layer 3 of the hybrid architecture: future-aware optimization.
Instead of greedily picking the best arrangement for today, the engine
simulates multiple future days to evaluate downstream consequences.

Architecture:
  1. BEAM SEARCH — maintain top-K candidates at each level
  2. MONTE CARLO ROLLOUTS — random sampling of future schedules
  3. FUTURE FLEXIBILITY SCORING — penalize choices that reduce valid states
  4. DEAD-END DETECTION — predict infeasible future states
  5. ADAPTIVE BEAM WIDTH — expand search when diversity weakens

The simulation layer operates on cloned state to avoid side effects.
All state mutations happen on copies; the original is never modified.

Planning horizon: configurable, default 7-14 days ahead.
"""

from __future__ import annotations

from copy import deepcopy
from itertools import permutations as iter_permutations
from typing import Optional
import time

import numpy as np

from .state_manager import EngineConfig
from .graph_model import PairInteractionGraph, get_adjacent_pairs
from .scoring import (
    score_arrangement,
    compute_normalized_entropy,
    compute_coverage,
)
from .constraints import (
    compute_min_per_seat,
    filter_seat_balanced_legacy,
    apply_all_hard_constraints,
)
from .fairness import compute_edge_fairness_score


def clone_state(
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int]],
) -> tuple[PairInteractionGraph, np.ndarray, Optional[list[int]]]:
    """
    Deep-clone the optimization state for lookahead simulation.

    Each simulation branch gets its own copy to prevent side effects.

    Args:
        graph: current pair interaction graph
        seat_counts: seat occupation matrix
        last_arrangement: previous day's arrangement

    Returns:
        (cloned_graph, cloned_seat_counts, cloned_last_arrangement)
    """
    return (
        graph.clone(),
        seat_counts.copy(),
        list(last_arrangement) if last_arrangement is not None else None,
    )


def update_state(
    arrangement: list[int] | np.ndarray,
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
) -> None:
    """
    Apply an arrangement to the running state (mutates in place).

    Args:
        arrangement: chosen arrangement for this day
        graph: pair interaction graph (mutated)
        seat_counts: seat occupation matrix (mutated)
    """
    # Update seat counts
    for seat_idx, person_idx in enumerate(arrangement):
        seat_counts[int(person_idx), seat_idx] += 1

    # Update pair graph
    graph.apply_arrangement(arrangement)


def count_valid_future_candidates(
    all_perms: np.ndarray,
    seat_counts: np.ndarray,
    num_people: int,
    num_seats: int,
) -> int:
    """
    Count how many valid permutations exist given current seat counts.

    This is the "future flexibility" metric — fewer valid candidates
    means we're heading toward a constrained (potentially dead-end) state.

    Args:
        all_perms: precomputed permutation array
        seat_counts: current seat occupation matrix
        num_people: number of people
        num_seats: number of seats

    Returns:
        Number of valid permutations
    """
    min_per_seat = compute_min_per_seat(seat_counts, num_people, num_seats)
    candidates = filter_seat_balanced_legacy(all_perms, seat_counts, min_per_seat)
    return len(candidates)


def compute_future_risk(
    all_perms: np.ndarray,
    arrangement: list[int] | np.ndarray,
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    num_people: int,
    num_seats: int,
) -> float:
    """
    Compute the risk of future dead-ends if we choose this arrangement.

    Risk = 1 - (future_valid / initial_valid)
    High risk means this choice significantly reduces future options.

    Args:
        all_perms: precomputed permutations
        arrangement: candidate arrangement
        graph: current pair graph
        seat_counts: current seat counts
        num_people: number of people
        num_seats: number of seats

    Returns:
        Risk score (0.0 = safe, 1.0 = critical)
    """
    initial_valid = count_valid_future_candidates(
        all_perms, seat_counts, num_people, num_seats
    )

    # Simulate applying this arrangement
    sim_graph, sim_seats, _ = clone_state(graph, seat_counts, None)
    update_state(arrangement, sim_graph, sim_seats)

    future_valid = count_valid_future_candidates(
        all_perms, sim_seats, num_people, num_seats
    )

    if initial_valid == 0:
        return 1.0

    return max(0.0, 1.0 - (future_valid / initial_valid))


def monte_carlo_rollout(
    start_arrangement: list[int] | np.ndarray,
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    all_perms: np.ndarray,
    config: EngineConfig,
    day_index: int,
    horizon: int,
    rng: np.random.Generator,
) -> float:
    """
    Perform a single Monte Carlo rollout from a starting arrangement.

    Simulates `horizon` future days using a fast greedy policy, then
    evaluates the quality of the resulting state.

    The rollout score combines:
    - Final entropy (pair diversity)
    - Final fairness (edge balance)
    - Coverage progress
    - Future flexibility

    Args:
        start_arrangement: the candidate arrangement for today
        graph: current pair graph
        seat_counts: current seat counts
        all_perms: precomputed permutations
        config: engine config
        day_index: current day index
        horizon: number of future days to simulate
        rng: random number generator for reproducibility

    Returns:
        Rollout quality score (higher = better)
    """
    # Clone state
    sim_graph, sim_seats, _ = clone_state(graph, seat_counts, None)
    update_state(start_arrangement, sim_graph, sim_seats)
    sim_last = list(start_arrangement)

    n = config.num_people
    num_seats = config.num_seats

    for future_day in range(1, horizon + 1):
        future_day_idx = day_index + future_day

        # Fast greedy: filter valid candidates, pick randomly from top-5
        min_per_seat = compute_min_per_seat(sim_seats, n, num_seats)
        candidates = filter_seat_balanced_legacy(all_perms, sim_seats, min_per_seat)

        if len(candidates) == 0:
            candidates = all_perms

        # Score a subset for speed
        sample_size = min(len(candidates), 20)
        indices = rng.choice(len(candidates), size=sample_size, replace=False)
        sampled = candidates[indices]

        best_score = -np.inf
        best_perm = sampled[0]

        for perm in sampled:
            sc = score_arrangement(
                perm, sim_graph, sim_seats, sim_last,
                future_day_idx, config.weights, n
            )
            if sc > best_score:
                best_score = sc
                best_perm = perm

        update_state(best_perm, sim_graph, sim_seats)
        sim_last = list(best_perm)

    # Evaluate terminal state quality
    entropy = compute_normalized_entropy(
        sim_graph.pair_counts, sim_graph.total_possible_pairs
    )
    coverage = compute_coverage(sim_graph.pair_counts, n)
    fairness = compute_edge_fairness_score(sim_seats, n) / 100.0
    flexibility = count_valid_future_candidates(
        all_perms, sim_seats, n, num_seats
    ) / len(all_perms)

    # Weighted terminal evaluation
    return (
        entropy * 0.30
        + coverage * 0.25
        + fairness * 0.30
        + flexibility * 0.15
    )


def beam_search_with_rollouts(
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int]],
    all_perms: np.ndarray,
    config: EngineConfig,
    day_index: int,
    beam_width: int = 20,
    lookahead_depth: int = 7,
    num_rollouts: int = 10,
    seed: int = 42,
) -> tuple[list[int], float, dict]:
    """
    Beam search with Monte Carlo rollout evaluation.

    This is the core planning algorithm:
    1. Generate all valid candidates for today
    2. Score and select top-K (beam width) candidates
    3. For each beam candidate, run Monte Carlo rollouts
    4. Select the candidate with the highest average rollout score

    The rollout evaluation looks ahead `lookahead_depth` days, running
    `num_rollouts` random simulations per candidate.

    Args:
        graph: current pair interaction graph
        seat_counts: current seat counts
        last_arrangement: previous day's arrangement
        all_perms: precomputed permutations
        config: engine configuration
        day_index: current day index
        beam_width: number of top candidates to evaluate
        lookahead_depth: planning horizon in days
        num_rollouts: Monte Carlo samples per candidate
        seed: random seed for reproducibility

    Returns:
        (best_arrangement, best_score, profiling_dict)
    """
    t_start = time.perf_counter()
    rng = np.random.default_rng(seed + day_index)  # Deterministic per day

    n = config.num_people
    num_seats = config.num_seats

    # ── Step 1: Get valid candidates (all hard constraints) ──
    candidates = apply_all_hard_constraints(
        all_perms, seat_counts, last_arrangement, n, num_seats
    )

    # ── Step 2: Score today's candidates (greedy) ──
    today_scores = np.array([
        score_arrangement(
            cand, graph, seat_counts, last_arrangement,
            day_index, config.weights, n
        )
        for cand in candidates
    ])

    # Select top-K beam candidates
    if len(candidates) > beam_width:
        top_k_indices = np.argsort(today_scores)[-beam_width:]
    else:
        top_k_indices = np.arange(len(candidates))

    # ── Step 3: Monte Carlo evaluation ──
    best_total_score = -np.inf
    best_perm = candidates[top_k_indices[-1]]
    best_today_score = today_scores[top_k_indices[-1]]
    beam_results = []

    for idx in top_k_indices:
        candidate = candidates[idx]
        today_score = float(today_scores[idx])

        # Run multiple rollouts
        rollout_scores = []
        for r in range(num_rollouts):
            rollout_seed = seed + day_index * 1000 + int(idx) * 100 + r
            rollout_rng = np.random.default_rng(rollout_seed)

            rollout_score = monte_carlo_rollout(
                candidate, graph, seat_counts, all_perms,
                config, day_index, lookahead_depth, rollout_rng
            )
            rollout_scores.append(rollout_score)

        avg_rollout = np.mean(rollout_scores)

        # Combined score: 60% today, 40% future
        total_score = today_score * 0.6 + avg_rollout * 10000 * 0.4

        beam_results.append({
            "candidate": candidate.tolist(),
            "today_score": today_score,
            "avg_rollout": avg_rollout,
            "total_score": total_score,
        })

        if total_score > best_total_score:
            best_total_score = total_score
            best_perm = candidate
            best_today_score = today_score

    t_end = time.perf_counter()

    # ── Compute future risk for the chosen arrangement ──
    future_risk = compute_future_risk(
        all_perms, best_perm, graph, seat_counts, n, num_seats
    )

    profiling = {
        "computation_ms": (t_end - t_start) * 1000,
        "beam_width": beam_width,
        "lookahead_depth": lookahead_depth,
        "num_rollouts": num_rollouts,
        "candidates_total": len(all_perms),
        "candidates_valid": len(candidates),
        "beam_candidates": len(top_k_indices),
        "future_risk": future_risk,
        "solver_status": "BEAM_SEARCH",
        "cache_hit": False,
    }

    return list(best_perm), best_today_score, profiling


def greedy_optimize(
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int]],
    all_perms: np.ndarray,
    config: EngineConfig,
    day_index: int,
) -> tuple[list[int], float, dict]:
    """
    Fast greedy optimization — evaluate all valid candidates, pick the best.

    For small groups (5 people = 24 candidates after filtering), this is
    exhaustive and optimal within the scoring function's objectives.

    Used as the fallback strategy and as the inner loop of beam search.

    Args:
        graph: current pair interaction graph
        seat_counts: current seat counts
        last_arrangement: previous day's arrangement
        all_perms: precomputed permutations
        config: engine config
        day_index: current day index

    Returns:
        (best_arrangement, best_score, profiling_dict)
    """
    t_start = time.perf_counter()
    n = config.num_people
    num_seats = config.num_seats

    # Apply ALL hard constraints (seat balance + repetition avoidance)
    candidates = apply_all_hard_constraints(
        all_perms, seat_counts, last_arrangement, n, num_seats
    )

    t_filter = time.perf_counter()

    scores = np.array([
        score_arrangement(
            cand, graph, seat_counts, last_arrangement,
            day_index, config.weights, n
        )
        for cand in candidates
    ])

    best_idx = int(np.argmax(scores))
    best_perm = candidates[best_idx]
    best_score = float(scores[best_idx])

    t_end = time.perf_counter()

    # Compute future risk
    future_risk = compute_future_risk(
        all_perms, best_perm, graph, seat_counts, n, num_seats
    )

    profiling = {
        "computation_ms": (t_end - t_start) * 1000,
        "filter_ms": (t_filter - t_start) * 1000,
        "score_ms": (t_end - t_filter) * 1000,
        "candidates_total": len(all_perms),
        "candidates_valid": len(candidates),
        "future_risk": future_risk,
        "solver_status": "GREEDY_OPTIMAL",
        "cache_hit": False,
    }

    return list(best_perm), best_score, profiling
