"""
analytics.py — Schedule quality analytics and statistics.

Provides functions for computing aggregate statistics about the
generated schedule, including coverage tracking, heatmap data,
trend analysis, and quality metrics over time.

Used by the API to return rich analytics in responses and by
the AI assistant for schedule analysis.
"""

from __future__ import annotations

from typing import Optional
import numpy as np

from .graph_model import PairInteractionGraph, get_adjacent_pairs
from .scoring import compute_normalized_entropy, compute_coverage, compute_diversity_score
from .fairness import (
    compute_edge_fairness_score,
    compute_gini_coefficient,
    compute_fairness_report,
)


def compute_schedule_quality(
    graph: PairInteractionGraph,
    seat_counts: np.ndarray,
    num_people: int,
    num_seats: int,
    current_day: int,
) -> dict:
    """
    Compute a comprehensive quality report for the current schedule.

    Args:
        graph: pair interaction graph
        seat_counts: seat occupation matrix
        num_people: number of people
        num_seats: number of seats
        current_day: current day index

    Returns:
        Dictionary with all quality metrics
    """
    pair_counts = graph.pair_counts

    # Core metrics
    coverage = compute_coverage(pair_counts, num_people)
    diversity = compute_diversity_score(pair_counts, num_people)
    entropy = compute_normalized_entropy(pair_counts, graph.total_possible_pairs)
    fairness = compute_edge_fairness_score(seat_counts, num_people)

    # Fairness report
    fairness_report = compute_fairness_report(
        seat_counts, pair_counts, num_people, num_seats, current_day
    )

    # Pair statistics
    pair_values = list(pair_counts.values()) if pair_counts else []
    pair_mean = np.mean(pair_values) if pair_values else 0.0
    pair_std = np.std(pair_values) if pair_values else 0.0

    # Seat distribution statistics
    seat_per_person = []
    for p in range(num_people):
        seat_per_person.append(seat_counts[p].tolist())

    # Degree centrality from graph
    centrality = graph.get_degree_centrality()

    return {
        "coverage_progress": coverage,
        "diversity_score": diversity,
        "entropy_score": entropy,
        "fairness_score": fairness,
        "fairness_report": fairness_report,
        "pair_mean": float(pair_mean),
        "pair_std": float(pair_std),
        "pair_min": int(min(pair_values)) if pair_values else 0,
        "pair_max": int(max(pair_values)) if pair_values else 0,
        "total_pairs_seen": sum(1 for v in pair_values if v > 0),
        "total_possible_pairs": graph.total_possible_pairs,
        "seat_distribution": seat_per_person,
        "degree_centrality": centrality,
        "current_day": current_day,
    }


def compute_trend_data(
    arrangements: list[list[int]],
    num_people: int,
    num_seats: int,
) -> dict:
    """
    Compute trend data showing how metrics evolve over the schedule.

    Used for rendering fairness graphs and diversity charts on the frontend.

    Args:
        arrangements: list of all arrangements in order
        num_people: number of people
        num_seats: number of seats

    Returns:
        Dictionary with per-day metric arrays
    """
    pair_counts: dict[str, int] = {}
    seat_counts = np.zeros((num_people, num_seats), dtype=np.int32)

    coverage_trend = []
    fairness_trend = []
    diversity_trend = []
    edge_counts_trend = []

    from .graph_model import PairInteractionGraph
    from .state_manager import EngineConfig

    config = EngineConfig()

    for day_idx, arrangement in enumerate(arrangements):
        # Update pair counts
        pairs = get_adjacent_pairs(arrangement)
        for p in pairs:
            pair_counts[p] = pair_counts.get(p, 0) + 1

        # Update seat counts
        for seat_idx, person_idx in enumerate(arrangement):
            seat_counts[person_idx, seat_idx] += 1

        # Record metrics
        coverage_trend.append(compute_coverage(pair_counts, num_people))
        fairness_trend.append(compute_edge_fairness_score(seat_counts, num_people))
        diversity_trend.append(compute_diversity_score(pair_counts, num_people))

        edge_counts = (seat_counts[:, 0] + seat_counts[:, -1]).tolist()
        edge_counts_trend.append(edge_counts)

    return {
        "coverage_trend": coverage_trend,
        "fairness_trend": fairness_trend,
        "diversity_trend": diversity_trend,
        "edge_counts_trend": edge_counts_trend,
        "total_days": len(arrangements),
    }


def count_new_pairs(
    arrangement: list[int] | np.ndarray,
    pair_counts: dict[str, int],
) -> int:
    """
    Count how many pairs in this arrangement are completely new
    (have never been seen before).

    Args:
        arrangement: the chosen seating arrangement
        pair_counts: current pair counts (BEFORE this arrangement)

    Returns:
        Number of new pairs
    """
    pairs = get_adjacent_pairs(arrangement)
    return sum(1 for p in pairs if pair_counts.get(p, 0) == 0)
