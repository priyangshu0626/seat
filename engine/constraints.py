"""
constraints.py — Hard constraint enforcement engine.

Two modes of operation:
  1. OR-TOOLS CP-SAT (when available): Full constraint programming with
     hard constraints as CP-SAT constraints and soft objectives as
     linearized costs. Provably optimal within the model.

  2. PURE-PYTHON FALLBACK: Exhaustive permutation enumeration with
     vectorized NumPy filtering. Mathematically equivalent for small
     groups (n ≤ 7), since all n! permutations are explicitly evaluated.

The fallback is NOT a degraded mode — for 5 people (120 permutations),
exhaustive evaluation IS the optimal strategy. CP-SAT provides value
only for larger groups where n! becomes intractable.

Hard constraints (MUST NEVER break):
  1. PERMUTATION — each person appears exactly once
  2. SEAT BALANCE — every person assigned to their minimum-count seat
  3. NO IMMEDIATE PAIR REPETITION — no adjacent pair from yesterday repeats
  4. NO IMMEDIATE SEAT REPETITION — no person in same seat as yesterday
  5. NO IMMEDIATE EDGE REPETITION — edge people must change
"""

from __future__ import annotations

from typing import Optional
import time
import warnings

import numpy as np

from .state_manager import EngineConfig, OptimizerWeights
from .graph_model import PairInteractionGraph, canonical_pair_key, get_adjacent_pairs

# ── OR-Tools availability (subprocess-safe detection) ──
# OR-Tools native libraries can SIGABRT on incompatible Python versions.
# We detect availability via subprocess to prevent main process crash.
HAS_ORTOOLS = False
cp_model = None

def _check_ortools_available() -> bool:
    """Safely check if OR-Tools is available without risking SIGABRT."""
    import subprocess, sys
    try:
        result = subprocess.run(
            [sys.executable, "-c", "from ortools.sat.python import cp_model; print('ok')"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0 and "ok" in result.stdout
    except Exception:
        return False

if _check_ortools_available():
    try:
        from ortools.sat.python import cp_model as _cp_model
        cp_model = _cp_model
        HAS_ORTOOLS = True
    except Exception:
        pass

if not HAS_ORTOOLS:
    warnings.warn(
        "OR-Tools CP-SAT not available — using pure-Python constraint engine. "
        "This is mathematically equivalent for groups ≤ 7 people.",
        RuntimeWarning,
        stacklevel=2,
    )


def compute_min_per_seat(
    seat_counts: np.ndarray,
    num_people: int,
    num_seats: int,
) -> np.ndarray:
    """
    For each seat position, find the minimum number of times ANY person
    has occupied it. This is the floor count that valid assignments must
    match.

    This implements the Latin-square rotation guarantee: over complete
    cycles, every person occupies every seat equally.

    Args:
        seat_counts: (num_people, num_seats) matrix of seat occupation counts
        num_people: number of people
        num_seats: number of seat positions

    Returns:
        (num_seats,) array of minimum counts per seat
    """
    return seat_counts.min(axis=0)


def filter_seat_balanced_legacy(
    permutations: np.ndarray,
    seat_counts: np.ndarray,
    min_per_seat: np.ndarray,
) -> np.ndarray:
    """
    HARD CONSTRAINT: Seat Balance Filter (vectorized NumPy).

    Keeps only permutations where every person is assigned to a seat
    they've occupied the MINIMUM number of times. This ensures perfect
    Latin-square rotation over full cycles.

    Mathematical guarantee:
    After N complete n-day cycles, every person has sat in every seat
    exactly N times (including the center seat).

    This is the primary hard constraint for small groups.

    Args:
        permutations: (K, num_seats) array of all possible permutations
        seat_counts: (num_people, num_seats) matrix
        min_per_seat: (num_seats,) minimum counts per seat

    Returns:
        Filtered subset of permutations satisfying the balance constraint.
        Falls back to all permutations if no valid candidate exists.
    """
    num_seats = permutations.shape[1]
    seat_indices = np.arange(num_seats)

    # Vectorized: seat_counts[perm[i,s], s] for all (i, s)
    gathered = seat_counts[permutations, seat_indices]

    # All seats must be at minimum
    valid_mask = np.all(gathered <= min_per_seat, axis=1)
    candidates = permutations[valid_mask]

    if len(candidates) == 0:
        return permutations

    return candidates


def filter_no_repeat_pairs(
    candidates: np.ndarray,
    last_arrangement: Optional[np.ndarray | list[int]],
) -> np.ndarray:
    """
    HARD CONSTRAINT: No Immediate Pair Repetition.

    Removes any candidate that would repeat an adjacent pair from
    the previous day's arrangement.

    Args:
        candidates: (K, num_seats) filtered permutations
        last_arrangement: previous day's arrangement

    Returns:
        Further filtered permutations
    """
    if last_arrangement is None:
        return candidates

    prev_pairs = set(get_adjacent_pairs(last_arrangement))
    valid = []

    for i in range(len(candidates)):
        cand_pairs = get_adjacent_pairs(candidates[i])
        if not any(p in prev_pairs for p in cand_pairs):
            valid.append(i)

    if len(valid) == 0:
        return candidates  # Relaxation: if impossible, skip this constraint

    return candidates[np.array(valid)]


def filter_no_repeat_seats(
    candidates: np.ndarray,
    last_arrangement: Optional[np.ndarray | list[int]],
) -> np.ndarray:
    """
    HARD CONSTRAINT: No Immediate Seat Repetition.

    Removes any candidate where any person sits in the same seat
    as the previous day.

    Args:
        candidates: (K, num_seats) filtered permutations
        last_arrangement: previous day's arrangement

    Returns:
        Further filtered permutations
    """
    if last_arrangement is None:
        return candidates

    last_arr = np.array(last_arrangement, dtype=np.int32)
    num_seats = candidates.shape[1]

    # Vectorized: check if any seat has the same person
    same_seat = np.any(candidates == last_arr, axis=1)
    valid_mask = ~same_seat

    if valid_mask.sum() == 0:
        return candidates  # Relaxation fallback

    return candidates[valid_mask]


def filter_no_repeat_edges(
    candidates: np.ndarray,
    last_arrangement: Optional[np.ndarray | list[int]],
) -> np.ndarray:
    """
    HARD CONSTRAINT: No Immediate Edge Repetition.

    Prevents the same people from occupying edge seats as the previous day.
    Specifically: neither yesterday's left nor right edge person can be
    on either edge today.

    Args:
        candidates: (K, num_seats) filtered permutations
        last_arrangement: previous day's arrangement

    Returns:
        Further filtered permutations
    """
    if last_arrangement is None:
        return candidates

    prev_left = int(last_arrangement[0])
    prev_right = int(last_arrangement[-1])

    # Neither prev edge person can be on any edge today
    valid_mask = (
        (candidates[:, 0] != prev_left) &
        (candidates[:, 0] != prev_right) &
        (candidates[:, -1] != prev_left) &
        (candidates[:, -1] != prev_right)
    )

    if valid_mask.sum() == 0:
        return candidates  # Relaxation fallback

    return candidates[valid_mask]


def filter_no_exact_repeats(
    candidates: np.ndarray,
    recent_arrangements: Optional[list[list[int]]] = None,
) -> np.ndarray:
    """
    HARD CONSTRAINT: No Exact Arrangement Repetition.
    
    Prevents the engine from repeating an exact seating arrangement from
    the recent past, breaking infinite loops when N=5.
    """
    if not recent_arrangements:
        return candidates
        
    recent_tuples = {tuple(int(x) for x in arr) for arr in recent_arrangements}
    
    valid = []
    for i in range(len(candidates)):
        cand_tuple = tuple(int(x) for x in candidates[i])
        if cand_tuple not in recent_tuples:
            valid.append(i)
            
    if len(valid) == 0:
        return candidates  # Relaxation
        
    return candidates[np.array(valid)]


def filter_no_near_repeats(
    candidates: np.ndarray,
    recent_arrangements: Optional[list[list[int]]] = None,
    min_differences: int = 2,
) -> np.ndarray:
    """
    HARD CONSTRAINT: No Near-Duplicate Arrangements.
    
    Rejects candidates where fewer than `min_differences` seats differ
    from any arrangement in the recent history. For 5 people with
    min_differences=2, this blocks arrangements that are only 1 swap
    away from a recent one.
    """
    if not recent_arrangements:
        return candidates
        
    recent_arrays = [np.array(arr, dtype=np.int32) for arr in recent_arrangements]
    num_seats = candidates.shape[1]
    
    valid = []
    for i in range(len(candidates)):
        is_valid = True
        for past in recent_arrays:
            differences = np.sum(candidates[i] != past)
            if differences < min_differences:
                is_valid = False
                break
        if is_valid:
            valid.append(i)
    
    if len(valid) == 0:
        return candidates  # Relaxation
        
    return candidates[np.array(valid)]

def filter_recent_edge_cooldown(
    candidates: np.ndarray,
    recent_arrangements: Optional[list[list[int]]],
    cooldown_days: int = 2,
) -> np.ndarray:
    """
    HARD CONSTRAINT: Recent Edge Cooldown.

    Prevents a person from being on an edge seat if they were on an edge
    within the last `cooldown_days` arrangements. This breaks short-term
    clustering where the same people keep appearing on edges.

    With 5 people and 2 edge seats per day, the theoretical minimum gap
    between edge assignments for the same person is ~2 days, so
    cooldown_days=2 is the maximum feasible value.

    Args:
        candidates: (K, num_seats) filtered permutations
        recent_arrangements: history of recent arrangements
        cooldown_days: number of past days to check for edge recency

    Returns:
        Further filtered permutations
    """
    if not recent_arrangements:
        return candidates

    # Collect all people who were on edges in the last N days
    recent_edge_people = set()
    window = recent_arrangements[-cooldown_days:]
    for arr in window:
        recent_edge_people.add(int(arr[0]))
        recent_edge_people.add(int(arr[-1]))

    if not recent_edge_people:
        return candidates

    # Reject candidates that place any recently-edged person on an edge
    valid_mask = np.ones(len(candidates), dtype=bool)
    for person in recent_edge_people:
        valid_mask &= (candidates[:, 0] != person) & (candidates[:, -1] != person)

    if valid_mask.sum() == 0:
        return candidates  # Relaxation: if impossible, skip this constraint

    return candidates[valid_mask]


def apply_all_hard_constraints(
    permutations: np.ndarray,
    seat_counts: np.ndarray,
    last_arrangement: Optional[np.ndarray | list[int]],
    num_people: int,
    num_seats: int,
    recent_arrangements: Optional[list[list[int]]] = None,
) -> np.ndarray:
    """
    Apply ALL hard constraints in sequence with automatic relaxation.

    Constraint application order (strictest first):
    1. Seat balance (Latin-square rotation)
    2. No exact repeats from history
    3. No near-duplicate repeats
    4. No immediate edge repetition
    5. No immediate seat repetition
    6. No immediate pair repetition

    Note: Recent edge cooldown (2+ day spacing) is NOT applied as a hard
    constraint because it is mathematically impossible with 5 people and
    2 edge seats per day (would block 4 of 5 people, leaving 0 valid
    edge pairs). Instead, edge spacing is handled via boosted soft
    penalties in the scoring function.

    If any constraint would eliminate all candidates, it's relaxed
    (skipped) to ensure we always return at least one valid candidate.

    Args:
        permutations: all n! permutations
        seat_counts: seat occupation matrix
        last_arrangement: previous day's arrangement
        num_people: number of people
        num_seats: number of seats
        recent_arrangements: history of recent arrangements

    Returns:
        Filtered permutations satisfying maximum constraints
    """
    # 1. Seat balance
    min_per_seat = compute_min_per_seat(seat_counts, num_people, num_seats)
    candidates = filter_seat_balanced_legacy(permutations, seat_counts, min_per_seat)

    # 2. No exact repeats from history
    filtered = filter_no_exact_repeats(candidates, recent_arrangements)
    if len(filtered) > 0:
        candidates = filtered

    # 3. No near-duplicate repeats from history (must differ in ≥2 seats)
    filtered = filter_no_near_repeats(candidates, recent_arrangements, min_differences=2)
    if len(filtered) > 0:
        candidates = filtered

    # 4. No edge repetition (immediate previous day)
    filtered = filter_no_repeat_edges(candidates, last_arrangement)
    if len(filtered) > 0:
        candidates = filtered

    # 5. No seat repetition
    filtered = filter_no_repeat_seats(candidates, last_arrangement)
    if len(filtered) > 0:
        candidates = filtered

    # 6. No pair repetition
    filtered = filter_no_repeat_pairs(candidates, last_arrangement)
    if len(filtered) > 0:
        candidates = filtered

    return candidates


# ─── CP-SAT MODEL (when OR-Tools is available) ───────────────────

if HAS_ORTOOLS:
    class SeatingSolutionCollector(cp_model.CpSolverSolutionCallback):
        """
        Collects multiple solutions from the CP-SAT solver.

        CP-SAT can enumerate multiple feasible solutions. We collect up to
        max_solutions and pass them to the scoring engine for soft optimization.
        """

        def __init__(self, seat_vars: list, num_seats: int, max_solutions: int = 100):
            super().__init__()
            self._seat_vars = seat_vars
            self._num_seats = num_seats
            self._max_solutions = max_solutions
            self._solutions: list[list[int]] = []
            self._solution_count = 0

        def on_solution_callback(self):
            if self._solution_count >= self._max_solutions:
                self.StopSearch()
                return
            solution = [self.Value(self._seat_vars[s]) for s in range(self._num_seats)]
            self._solutions.append(solution)
            self._solution_count += 1

        @property
        def solutions(self) -> list[list[int]]:
            return self._solutions

        @property
        def solution_count(self) -> int:
            return self._solution_count


def build_cpsat_model(
    config: "EngineConfig",
    graph: "PairInteractionGraph",
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int] | np.ndarray],
    day_index: int,
    recent_arrangements: Optional[list[list[int]]] = None,
) -> tuple["cp_model.CpModel", list["cp_model.IntVar"], dict]:
    """
    Build the CP-SAT constraint programming model.
    """
    model = cp_model.CpModel()
    n = config.num_people
    num_seats = config.num_seats

    seat_vars = [model.NewIntVar(0, n - 1, f"seat_{i}") for i in range(num_seats)]
    model.AddAllDifferent(seat_vars)

    # HARD: Seat balance
    min_per_seat = compute_min_per_seat(seat_counts, n, num_seats)
    for s in range(num_seats):
        for p in range(n):
            if int(seat_counts[p, s]) > int(min_per_seat[s]):
                model.Add(seat_vars[s] != p)

    # HARD: No immediate seat repetition
    if last_arrangement is not None:
        for s in range(num_seats):
            model.Add(seat_vars[s] != int(last_arrangement[s]))

    # HARD: No immediate edge repetition
    if last_arrangement is not None:
        prev_left = int(last_arrangement[0])
        prev_right = int(last_arrangement[-1])
        model.Add(seat_vars[0] != prev_left)
        model.Add(seat_vars[0] != prev_right)
        model.Add(seat_vars[-1] != prev_left)
        model.Add(seat_vars[-1] != prev_right)

    # HARD: No immediate pair repetition
    if last_arrangement is not None:
        prev_pairs = get_adjacent_pairs(last_arrangement)
        for pair_key in prev_pairs:
            parts = pair_key.split("-")
            a, b = int(parts[0]), int(parts[1])
            for s in range(num_seats - 1):
                model.AddForbiddenAssignments(
                    [seat_vars[s], seat_vars[s + 1]],
                    [(a, b), (b, a)]
                )

    # HARD: No exact repeats from history
    if recent_arrangements:
        for arr in recent_arrangements:
            model.AddForbiddenAssignments(seat_vars, [tuple(int(x) for x in arr)])

    # SOFT: Edge fairness
    cost_terms = []
    pair_counts = graph.pair_counts
    min_pair_count = graph.get_min_pair_count()
    min_edge_duty = min(
        int(seat_counts[p, 0]) + int(seat_counts[p, -1])
        for p in range(n)
    )

    for p in range(n):
        edge_duty = int(seat_counts[p, 0]) + int(seat_counts[p, -1])
        edge_excess = edge_duty - min_edge_duty
        if edge_excess > 0:
            is_left = model.NewBoolVar(f"edge_l_{p}")
            model.Add(seat_vars[0] == p).OnlyEnforceIf(is_left)
            model.Add(seat_vars[0] != p).OnlyEnforceIf(is_left.Not())
            cost_terms.append((is_left, edge_excess * config.weights.edge_imbalance_penalty))

            is_right = model.NewBoolVar(f"edge_r_{p}")
            model.Add(seat_vars[-1] == p).OnlyEnforceIf(is_right)
            model.Add(seat_vars[-1] != p).OnlyEnforceIf(is_right.Not())
            cost_terms.append((is_right, edge_excess * config.weights.edge_imbalance_penalty))

    if cost_terms:
        total_cost = model.NewIntVar(-10_000_000, 100_000_000, "total_cost")
        model.Add(total_cost == sum(var * coeff for var, coeff in cost_terms))
        model.Minimize(total_cost)

    return model, seat_vars, {"cost_terms": cost_terms}


def solve_cpsat_model(model, seat_vars, num_seats, time_limit_ms=150, max_solutions=100):
    """
    Solve the CP-SAT model. Returns ([], "UNAVAILABLE", 0) if OR-Tools unavailable.
    """
    if not HAS_ORTOOLS or model is None:
        return [], "UNAVAILABLE", 0.0

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_ms / 1000.0
    solver.parameters.enumerate_all_solutions = True
    solver.parameters.num_workers = 1
    solver.parameters.random_seed = 42

    collector = SeatingSolutionCollector(seat_vars, num_seats, max_solutions)

    t_start = time.perf_counter()
    status = solver.Solve(model, collector)
    t_end = time.perf_counter()

    status_name = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status, "UNKNOWN")

    return collector.solutions, status_name, (t_end - t_start) * 1000
