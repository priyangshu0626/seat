"""
fairness.py — Provable fairness analysis and variance metrics.

Implements mathematical fairness measures that quantify how equitably
the seating system distributes burden (edge seats) and benefit (middle
seats) across all participants.

Key metrics:
  1. Edge Duty Fairness Score — based on max-min spread
  2. Gini Coefficient — income-inequality-inspired fairness measure
  3. Standard Deviation — statistical dispersion of edge counts
  4. Coefficient of Variation — normalized std deviation
  5. Seat Distribution Variance — per-seat occupancy fairness
  6. Projected Fairness — estimate future fairness based on trends

All metrics are designed to be interpretable:
  - 100 = perfect fairness
  - 0 = maximum unfairness
  - Gini: 0 = perfect equality, 1 = maximum inequality
"""

from __future__ import annotations

import math
from typing import Optional
import numpy as np


def compute_edge_fairness_score(
    seat_counts: np.ndarray,
    num_people: int,
) -> float:
    """
    Edge-duty fairness score based on max-min spread.

    Measures how evenly edge-seat duties (seat 0 and seat N-1) are
    distributed across all people. Perfect fairness = 100.

    Mathematical guarantee: with the CP-SAT seat balance constraint,
    this will converge to 100 after every complete N-day cycle.

    Args:
        seat_counts: (num_people, num_seats) matrix
        num_people: number of people

    Returns:
        Fairness score (0–100)
    """
    edge_counts = seat_counts[:, 0] + seat_counts[:, -1]
    total = edge_counts.sum()

    if total == 0:
        return 100.0

    max_edge = int(edge_counts.max())
    min_edge = int(edge_counts.min())

    return max(0.0, 100.0 - (max_edge - min_edge) * 10.0)


def compute_gini_coefficient(values: np.ndarray | list) -> float:
    """
    Compute the Gini coefficient of a distribution.

    The Gini coefficient measures inequality on [0, 1]:
      - 0.0 = perfect equality (everyone has the same value)
      - 1.0 = perfect inequality (one person has everything)

    Used for edge duty distribution, seat distribution, pair distribution.

    Mathematical formula:
      G = (2 * Σᵢ (i+1)*yᵢ) / (n * Σᵢ yᵢ) - (n+1)/n

    Args:
        values: array of non-negative values

    Returns:
        Gini coefficient (0.0 to 1.0)
    """
    arr = np.array(values, dtype=np.float64)
    if len(arr) == 0 or arr.sum() == 0:
        return 0.0

    arr = np.sort(arr)
    n = len(arr)
    numerator = 2.0 * np.sum((np.arange(1, n + 1)) * arr)
    denominator = n * arr.sum()

    return (numerator / denominator) - (n + 1) / n


def compute_edge_std_deviation(
    seat_counts: np.ndarray,
    num_people: int,
) -> float:
    """
    Compute the standard deviation of edge duty counts.

    Lower = more fair. Target is 0.0 (all people have equal edge duty).

    Args:
        seat_counts: (num_people, num_seats) matrix
        num_people: number of people

    Returns:
        Standard deviation of edge duty counts
    """
    edge_counts = seat_counts[:, 0] + seat_counts[:, -1]
    return float(np.std(edge_counts))


def compute_coefficient_of_variation(
    seat_counts: np.ndarray,
    num_people: int,
) -> float:
    """
    Compute the coefficient of variation (CV) of edge duty counts.

    CV = std / mean. Normalized measure of dispersion.
    Lower = more fair. 0 = perfectly uniform.

    Args:
        seat_counts: (num_people, num_seats) matrix
        num_people: number of people

    Returns:
        Coefficient of variation (0.0+)
    """
    edge_counts = seat_counts[:, 0].astype(np.float64) + seat_counts[:, -1].astype(np.float64)
    mean = edge_counts.mean()
    if mean == 0:
        return 0.0
    return float(np.std(edge_counts) / mean)


def compute_seat_distribution_variance(
    seat_counts: np.ndarray,
    num_people: int,
    num_seats: int,
) -> float:
    """
    Compute overall seat distribution fairness.

    Measures how evenly ALL seats are distributed across all people.
    This captures middle-seat fairness, not just edge fairness.

    Returns a score from 0 (perfectly fair) to higher values (unfair).

    Args:
        seat_counts: (num_people, num_seats) matrix
        num_people: number of people
        num_seats: number of seats

    Returns:
        Total variance across all seat positions
    """
    total_variance = 0.0
    for s in range(num_seats):
        col = seat_counts[:, s].astype(np.float64)
        total_variance += float(np.var(col))
    return total_variance


def compute_projected_fairness(
    seat_counts: np.ndarray,
    num_people: int,
    current_day: int,
    projection_days: int = 30,
) -> float:
    """
    Project fairness score forward based on current trajectory.

    Uses the current rate of edge duty accumulation to estimate
    what the fairness score will be in `projection_days`.

    Args:
        seat_counts: current seat counts
        num_people: number of people
        current_day: current day index
        projection_days: how far ahead to project

    Returns:
        Projected fairness score (0–100)
    """
    if current_day == 0:
        return 100.0

    edge_counts = seat_counts[:, 0].astype(np.float64) + seat_counts[:, -1].astype(np.float64)
    total_edge = edge_counts.sum()

    if total_edge == 0:
        return 100.0

    # Average edge duties per day
    avg_edge_per_day = total_edge / current_day

    # Project forward: each day adds ~2 edge duties (1 left + 1 right)
    projected_total = total_edge + 2 * projection_days
    ideal_per_person = projected_total / num_people

    # Current rates per person
    rates = edge_counts / current_day
    projected_counts = edge_counts + rates * projection_days

    # Projected max-min spread
    proj_max = float(projected_counts.max())
    proj_min = float(projected_counts.min())

    return max(0.0, 100.0 - (proj_max - proj_min) * 10.0)


def compute_fairness_report(
    seat_counts: np.ndarray,
    pair_counts: dict[str, int],
    num_people: int,
    num_seats: int,
    current_day: int,
) -> dict:
    """
    Generate a comprehensive fairness report.

    Returns all fairness metrics in a single dictionary for
    API response and AI analysis.

    Args:
        seat_counts: (num_people, num_seats) matrix
        pair_counts: pair frequency mapping
        num_people: number of people
        num_seats: number of seats
        current_day: current day index

    Returns:
        Dictionary with all fairness metrics
    """
    edge_counts = seat_counts[:, 0] + seat_counts[:, -1]

    # Pair fairness
    pair_values = list(pair_counts.values()) if pair_counts else [0]
    pair_gini = compute_gini_coefficient(pair_values)

    return {
        "edge_fairness_score": compute_edge_fairness_score(seat_counts, num_people),
        "edge_gini_coefficient": compute_gini_coefficient(edge_counts),
        "edge_std_deviation": compute_edge_std_deviation(seat_counts, num_people),
        "edge_cv": compute_coefficient_of_variation(seat_counts, num_people),
        "seat_distribution_variance": compute_seat_distribution_variance(
            seat_counts, num_people, num_seats
        ),
        "pair_gini_coefficient": pair_gini,
        "projected_fairness_30d": compute_projected_fairness(
            seat_counts, num_people, current_day, 30
        ),
        "edge_counts_per_person": edge_counts.tolist(),
        "total_edge_duties": int(edge_counts.sum()),
        "max_min_spread": int(edge_counts.max() - edge_counts.min()) if edge_counts.sum() > 0 else 0,
    }
