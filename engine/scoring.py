"""
scoring.py — Multi-objective scoring engine with entropy maximization.

Implements the mathematical scoring functions that evaluate arrangement
quality. These scores are used both by the CP-SAT solver (as objective
terms) and by the simulation layer (for rollout evaluation).

Key metrics:
  1. Pair diversity score — weighted by imbalance, novelty, min-count bonus
  2. Back-to-back avoidance — penalizes day-over-day repetition
  3. Edge fairness — equalizes edge-seat burden
  4. Shannon entropy — maximizes pair distribution randomness
  5. Future flexibility — penalizes states that reduce downstream options
  6. Deterministic tiebreaker — hash-based for reproducibility

All scoring is integer-compatible for CP-SAT integration.
Floating-point scores are used for reporting and Monte Carlo evaluation.
"""

from __future__ import annotations

from typing import Optional
import math
import numpy as np

from .state_manager import OptimizerWeights
from .graph_model import PairInteractionGraph, get_adjacent_pairs, canonical_pair_key


def compute_shannon_entropy(pair_counts: dict[str, int], total_possible_pairs: int) -> float:
    """
    Compute Shannon entropy of the pair frequency distribution.

    Higher entropy = more uniform/diverse pair distribution.
    Maximum entropy = log2(total_possible_pairs) when all pairs are equally frequent.

    Args:
        pair_counts: mapping of pair key → count
        total_possible_pairs: C(n, 2) total possible pairs

    Returns:
        Shannon entropy in bits. 0.0 if no pairs observed.
    """
    # Build frequency vector including zero counts for unseen pairs
    counts = []
    total = 0
    for i in range(total_possible_pairs):
        # We iterate over sorted possible pairs implicitly
        pass

    # Use actual values
    all_counts = list(pair_counts.values())
    # Add zeros for unseen pairs
    seen_count = len(all_counts)
    unseen_count = total_possible_pairs - seen_count
    all_counts.extend([0] * unseen_count)

    total = sum(all_counts)
    if total == 0:
        return 0.0

    entropy = 0.0
    for c in all_counts:
        if c > 0:
            p = c / total
            entropy -= p * math.log2(p)

    return entropy


def compute_max_entropy(total_possible_pairs: int) -> float:
    """
    Compute the theoretical maximum Shannon entropy for a uniform distribution.

    Args:
        total_possible_pairs: C(n, 2) total possible pairs

    Returns:
        Maximum entropy in bits
    """
    if total_possible_pairs <= 0:
        return 0.0
    return math.log2(total_possible_pairs)


def compute_normalized_entropy(pair_counts: dict[str, int], total_possible_pairs: int) -> float:
    """
    Compute entropy normalized to [0, 1] range.

    1.0 = perfectly uniform distribution (maximum diversity)
    0.0 = all adjacencies concentrated in one pair

    Args:
        pair_counts: pair frequency mapping
        total_possible_pairs: C(n, 2)

    Returns:
        Normalized entropy (0.0 to 1.0)
    """
    max_ent = compute_max_entropy(total_possible_pairs)
    if max_ent == 0:
        return 0.0
    current_ent = compute_shannon_entropy(pair_counts, total_possible_pairs)
    return current_ent / max_ent


def score_arrangement(
    arrangement: list[int] | np.ndarray,
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int] | np.ndarray],
    day_index: int,
    weights: OptimizerWeights,
    num_people: int,
    recent_arrangements: Optional[list[list[int]]] = None,
) -> float:
    """
    Compute the composite score for a single candidate arrangement.

    This is the core scoring function used by the optimizer and simulation.
    It balances all soft objectives via weighted penalty/reward terms.

    Score components:
    1. PAIR DIVERSITY — reward novel pairs, penalize over-represented ones
    2. BACK-TO-BACK AVOIDANCE — heavy penalty for day-over-day repetition
    3. EDGE FAIRNESS — prefer edge assignments for under-served people
    4. ENTROPY BONUS — reward arrangements that increase overall entropy
    5. DETERMINISTIC TIEBREAKER — hash-based for reproducibility
    6. EXACT REPEAT AVOIDANCE — huge penalty for repeating recent arrangements

    Args:
        arrangement: candidate seat assignment
        graph: current pair interaction graph
        seat_counts: (num_people, num_seats) occupation matrix
        last_arrangement: previous day's arrangement, or None
        day_index: 0-based day index
        weights: scoring weight configuration
        num_people: number of people
        recent_arrangements: history of arrangements to avoid repeating

    Returns:
        Composite score (higher = better)
    """
    score = 0.0
    pairs = get_adjacent_pairs(arrangement)
    pair_counts = graph.pair_counts

    # ── 1. PAIR DIVERSITY ──
    min_pair_count = graph.get_min_pair_count()

    for p in pairs:
        cnt = pair_counts.get(p, 0)

        # Penalize pairs that are over-represented relative to the minimum
        score -= (cnt - min_pair_count) * weights.pair_imbalance_penalty

        # Bonus for completely new pairs
        if cnt == 0:
            score += weights.new_pair_reward

        # Bonus for pairs at the minimum count
        if cnt == min_pair_count:
            score += weights.min_pair_reward

    # ── 2. BACK-TO-BACK AVOIDANCE ──
    if last_arrangement is not None:
        prev_pairs = set(get_adjacent_pairs(last_arrangement))

        # Penalize repeating any pair from yesterday
        for p in pairs:
            if p in prev_pairs:
                score -= weights.back_to_back_pair_penalty

        # Penalize same person in same seat as yesterday
        for s in range(len(arrangement)):
            if int(arrangement[s]) == int(last_arrangement[s]):
                score -= weights.same_seat_penalty

        # Penalize same edge people as yesterday
        last_arr = [int(x) for x in last_arrangement]
        curr_arr = [int(x) for x in arrangement]
        if curr_arr[0] == last_arr[0] or curr_arr[0] == last_arr[-1]:
            score -= weights.same_edge_penalty
        if curr_arr[-1] == last_arr[0] or curr_arr[-1] == last_arr[-1]:
            score -= weights.same_edge_penalty

    # ── 2b. EXACT REPEAT AVOIDANCE ──
    if recent_arrangements:
        curr_tuple = tuple(int(x) for x in arrangement)
        for recent_arr in recent_arrangements:
            recent_tuple = tuple(int(x) for x in recent_arr)
            if curr_tuple == recent_tuple:
                score -= weights.exact_repeat_penalty
                break  # Only penalize once even if it appears multiple times

    # ── 2c. NEAR-REPEAT AVOIDANCE ──
    # Penalize arrangements that differ in fewer than 2 positions from any recent one
    if recent_arrangements:
        num_seats = len(arrangement)
        for recent_arr in recent_arrangements:
            same_count = sum(1 for s in range(num_seats) if int(arrangement[s]) == int(recent_arr[s]))
            if same_count >= num_seats - 1:  # Only 0 or 1 seat different
                score -= weights.exact_repeat_penalty // 2

    # ── 3. EDGE FAIRNESS ──
    min_edge = float("inf")
    for p_idx in range(num_people):
        ec = int(seat_counts[p_idx, 0]) + int(seat_counts[p_idx, -1])
        if ec < min_edge:
            min_edge = ec

    edge_l = int(seat_counts[int(arrangement[0]), 0]) + int(seat_counts[int(arrangement[0]), -1])
    edge_r = int(seat_counts[int(arrangement[-1]), 0]) + int(seat_counts[int(arrangement[-1]), -1])
    score -= (edge_l - min_edge) * weights.edge_imbalance_penalty
    score -= (edge_r - min_edge) * weights.edge_imbalance_penalty

    # ── 4. ENTROPY BONUS ──
    # Simulate what entropy would be if we added this arrangement's pairs
    hypothetical_counts = dict(pair_counts)
    for p in pairs:
        hypothetical_counts[p] = hypothetical_counts.get(p, 0) + 1
    hyp_entropy = compute_normalized_entropy(
        hypothetical_counts, graph.total_possible_pairs
    )
    score += hyp_entropy * weights.entropy_weight

    # ── 5. DETERMINISTIC TIEBREAKER ──
    hash_val = 0
    for i, v in enumerate(arrangement):
        hash_val += int(v) * (7 ** i)
    tiebreak = ((hash_val * 2654435761 + day_index * 1000000007) % 997) * weights.tiebreak_scale
    score += tiebreak

    return score


def compute_arrangement_cost_terms(
    arrangement: list[int] | np.ndarray,
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    last_arrangement: Optional[list[int] | np.ndarray],
    num_people: int,
) -> dict[str, int]:
    """
    Decompose the arrangement into individual cost terms for CP-SAT.

    Returns integer costs (CP-SAT requires integer arithmetic).
    These are used as soft constraint penalties in the solver.

    Args:
        arrangement: candidate seat assignment
        graph: current pair interaction graph
        seat_counts: occupation matrix
        last_arrangement: previous day's arrangement
        num_people: number of people

    Returns:
        Dictionary of named cost terms (all integers, lower = better)
    """
    costs: dict[str, int] = {}
    pairs = get_adjacent_pairs(arrangement)
    pair_counts = graph.pair_counts
    min_pair_count = graph.get_min_pair_count()

    # Pair imbalance cost
    pair_cost = 0
    for p in pairs:
        cnt = pair_counts.get(p, 0)
        pair_cost += max(0, cnt - min_pair_count)
    costs["pair_imbalance"] = pair_cost

    # New pair count (negative = reward → we minimize cost)
    new_pairs = sum(1 for p in pairs if pair_counts.get(p, 0) == 0)
    costs["new_pair_bonus"] = -new_pairs  # negative cost = reward

    # Back-to-back cost
    btb_cost = 0
    if last_arrangement is not None:
        prev_pairs = set(get_adjacent_pairs(last_arrangement))
        btb_cost = sum(1 for p in pairs if p in prev_pairs)
    costs["back_to_back"] = btb_cost

    # Same-seat cost
    same_seat = 0
    if last_arrangement is not None:
        for s in range(len(arrangement)):
            if int(arrangement[s]) == int(last_arrangement[s]):
                same_seat += 1
    costs["same_seat"] = same_seat

    # Edge imbalance cost
    min_edge = min(
        int(seat_counts[p, 0]) + int(seat_counts[p, -1])
        for p in range(num_people)
    )
    edge_l = int(seat_counts[int(arrangement[0]), 0]) + int(seat_counts[int(arrangement[0]), -1])
    edge_r = int(seat_counts[int(arrangement[-1]), 0]) + int(seat_counts[int(arrangement[-1]), -1])
    costs["edge_imbalance"] = (edge_l - min_edge) + (edge_r - min_edge)

    return costs


def compute_diversity_score(pair_counts: dict[str, int], num_people: int) -> float:
    """
    Composite diversity score combining coverage and balance.

    Coverage (70% weight): What fraction of all possible pairs have been seen.
    Balance (30% weight): How evenly distributed the pair counts are.

    Args:
        pair_counts: current pair counts
        num_people: number of people

    Returns:
        Diversity score (0–100)
    """
    max_possible = num_people * (num_people - 1) // 2
    seen = sum(1 for v in pair_counts.values() if v > 0)
    coverage_score = (seen / max_possible) * 100 if max_possible > 0 else 0

    values = list(pair_counts.values())
    if values:
        imbalance = max(values) - min(values)
    else:
        imbalance = 0

    balance_score = max(0, 100 - imbalance * 15)
    return round(0.7 * coverage_score + 0.3 * balance_score)


def compute_coverage(pair_counts: dict[str, int], num_people: int) -> float:
    """
    Compute pair coverage — fraction of all possible pairs seen.

    Args:
        pair_counts: current pair counts
        num_people: number of people

    Returns:
        Coverage fraction (0.0 to 1.0)
    """
    max_possible = num_people * (num_people - 1) // 2
    seen = sum(1 for v in pair_counts.values() if v > 0)
    return seen / max_possible if max_possible > 0 else 0.0
