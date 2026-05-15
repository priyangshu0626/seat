"""
ai_assistant.py — Gemini 2.5 Pro advisory layer.

This module provides AI-powered analysis and explanation capabilities.
The AI is used ONLY as an advisory layer — it NEVER directly chooses
schedules. All optimization remains deterministic and mathematical.

AI capabilities:
  1. EXPLAIN — why a schedule was selected (natural language)
  2. DETECT — emerging unfairness or patterns
  3. SUGGEST — heuristic tuning recommendations
  4. ANALYZE — long-term diversity quality

The module gracefully degrades if the Gemini API is unavailable:
all functions return sensible defaults without AI.

Architecture:
  - Uses google-genai SDK
  - API key from GEMINI_API_KEY environment variable
  - All calls are async-compatible but synchronous by default
  - Responses are cached per schedule state to avoid redundant calls
"""

from __future__ import annotations

import os
import json
import hashlib
from typing import Optional


# ── AI client initialization ──
_ai_client = None
_ai_available = False

def _init_ai():
    """Lazily initialize the Gemini AI client."""
    global _ai_client, _ai_available

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        _ai_available = False
        return

    try:
        from google import genai
        _ai_client = genai.Client(api_key=api_key)
        _ai_available = True
    except Exception:
        _ai_available = False


# Response cache to avoid redundant API calls
_explanation_cache: dict[str, str] = {}


def _make_cache_key(data: dict) -> str:
    """Create a deterministic cache key from analysis data."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.md5(serialized.encode()).hexdigest()


def is_ai_available() -> bool:
    """Check if the Gemini AI client is available."""
    if _ai_client is None:
        _init_ai()
    return _ai_available


def explain_schedule(
    arrangement: list[int],
    people_names: list[str],
    pair_counts: dict[str, int],
    seat_counts: list[list[int]],
    fairness_score: float,
    diversity_score: float,
    entropy_score: float,
    day_index: int,
) -> str:
    """
    Generate a natural-language explanation of why this schedule was chosen.

    Uses Gemini 2.5 Pro to analyze the mathematical properties of the
    selected arrangement and explain them in human-readable terms.

    Args:
        arrangement: the selected seat assignment
        people_names: list of person names
        pair_counts: current pair frequency map
        seat_counts: seat occupation matrix
        fairness_score: current fairness metric
        diversity_score: current diversity metric
        entropy_score: current entropy metric
        day_index: current day index

    Returns:
        Human-readable explanation string
    """
    if not is_ai_available():
        return _generate_deterministic_explanation(
            arrangement, people_names, pair_counts, seat_counts,
            fairness_score, diversity_score, entropy_score, day_index
        )

    cache_data = {
        "arrangement": arrangement,
        "pair_counts": pair_counts,
        "day_index": day_index,
    }
    cache_key = _make_cache_key(cache_data)

    if cache_key in _explanation_cache:
        return _explanation_cache[cache_key]

    # Build prompt
    seat_labels = ["Seat 1 (Edge)", "Seat 2 (Near)", "Seat 3 (Middle)", "Seat 4 (Near)", "Seat 5 (Edge)"]
    seating_desc = ", ".join(
        f"{people_names[arrangement[s]]} → {seat_labels[s]}"
        for s in range(len(arrangement))
    )

    prompt = f"""You are analyzing a mathematically optimized seating arrangement for a group of {len(people_names)} people.

Today's arrangement (Day {day_index + 1}): {seating_desc}

Current metrics:
- Fairness Score: {fairness_score:.1f}/100
- Diversity Score: {diversity_score}/100
- Entropy Score: {entropy_score:.3f}

Pair interaction counts: {json.dumps(pair_counts)}

In 2-3 concise sentences, explain WHY this arrangement was mathematically optimal for today. Focus on:
1. Which pairs are new or under-represented
2. Why these edge-seat assignments are fair
3. How this improves long-term diversity

Be specific about the people's names. Keep it brief and insightful."""

    try:
        from google import genai
        response = _ai_client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
        )
        explanation = response.text.strip()
        _explanation_cache[cache_key] = explanation
        return explanation
    except Exception as e:
        return _generate_deterministic_explanation(
            arrangement, people_names, pair_counts, seat_counts,
            fairness_score, diversity_score, entropy_score, day_index
        )


def analyze_schedule_quality(
    pair_counts: dict[str, int],
    seat_counts: list[list[int]],
    total_days: int,
    people_names: list[str],
    recent_arrangements: list[list[int]],
) -> dict:
    """
    Perform AI-powered quality analysis of the overall schedule.

    Returns analysis of fairness, diversity, and recommendations.
    Gracefully degrades without AI.

    Args:
        pair_counts: accumulated pair counts
        seat_counts: seat occupation matrix
        total_days: total days scheduled
        people_names: list of person names
        recent_arrangements: last 5-10 arrangements

    Returns:
        Dictionary with analysis results
    """
    if not is_ai_available():
        return _generate_deterministic_analysis(
            pair_counts, seat_counts, total_days, people_names
        )

    prompt = f"""Analyze the quality of a seating schedule for {len(people_names)} people ({', '.join(people_names)}) over {total_days} days.

Pair interaction counts: {json.dumps(pair_counts)}
Seat occupation matrix (person x seat): {json.dumps(seat_counts)}

Provide a JSON response with these fields:
{{
  "fairness_analysis": "2-3 sentences about edge-duty fairness",
  "diversity_analysis": "2-3 sentences about pair diversity",
  "recommendations": ["list", "of", "specific", "recommendations"]
}}

Be specific about names and numbers. Focus on actionable insights."""

    try:
        from google import genai
        response = _ai_client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
        )
        text = response.text.strip()
        # Try to parse JSON from response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        return result
    except Exception:
        return _generate_deterministic_analysis(
            pair_counts, seat_counts, total_days, people_names
        )


def _generate_deterministic_explanation(
    arrangement: list[int],
    people_names: list[str],
    pair_counts: dict[str, int],
    seat_counts: list[list[int]],
    fairness_score: float,
    diversity_score: float,
    entropy_score: float,
    day_index: int,
) -> str:
    """
    Generate a deterministic explanation without AI.

    Analyzes the mathematical properties of the arrangement and
    constructs a human-readable explanation algorithmically.

    This ensures the API always returns useful explanations even
    without a Gemini API key configured.
    """
    n = len(arrangement)
    edge_left = people_names[arrangement[0]]
    edge_right = people_names[arrangement[-1]]
    middle = people_names[arrangement[n // 2]]

    # Identify new pairs
    from .graph_model import get_adjacent_pairs
    pairs = get_adjacent_pairs(arrangement)
    new_pairs = [p for p in pairs if pair_counts.get(p, 0) == 0]
    min_count_pairs = []
    if pair_counts:
        min_count = min(pair_counts.values())
        min_count_pairs = [p for p in pairs if pair_counts.get(p, 0) == min_count]

    parts = []

    if new_pairs:
        new_pair_names = []
        for p in new_pairs[:2]:
            a, b = p.split("-")
            new_pair_names.append(f"{people_names[int(a)]}-{people_names[int(b)]}")
        parts.append(f"Creates {len(new_pairs)} new pair{'s' if len(new_pairs) > 1 else ''} ({', '.join(new_pair_names)}), maximizing coverage.")

    if fairness_score >= 90:
        parts.append(f"{edge_left} and {edge_right} on edges maintains {fairness_score:.0f}% fairness balance.")
    else:
        parts.append(f"Edge assignments to {edge_left} and {edge_right} improve fairness toward equilibrium.")

    if entropy_score > 0.8:
        parts.append(f"Entropy at {entropy_score:.2f} indicates healthy schedule diversity.")
    elif entropy_score > 0:
        parts.append(f"Entropy of {entropy_score:.2f} — diversity is building as more pairs are explored.")

    return " ".join(parts) if parts else f"Day {day_index + 1}: {edge_left} and {edge_right} on edge duty, optimized for pair balance and fairness."


def _generate_deterministic_analysis(
    pair_counts: dict[str, int],
    seat_counts: list[list[int]],
    total_days: int,
    people_names: list[str],
) -> dict:
    """Generate deterministic analysis without AI."""
    import numpy as np
    from .fairness import compute_gini_coefficient

    sc = np.array(seat_counts, dtype=np.int32) if seat_counts else np.zeros((len(people_names), 5), dtype=np.int32)
    edge_counts = sc[:, 0] + sc[:, -1] if sc.shape[1] >= 2 else np.zeros(len(people_names))

    pair_values = list(pair_counts.values()) if pair_counts else [0]
    pair_gini = compute_gini_coefficient(pair_values)
    edge_gini = compute_gini_coefficient(edge_counts)

    # Fairness analysis
    if edge_gini < 0.05:
        fairness_text = f"Edge duty is excellently balanced across all {len(people_names)} people (Gini={edge_gini:.3f})."
    elif edge_gini < 0.15:
        fairness_text = f"Edge duty is reasonably fair (Gini={edge_gini:.3f}), with minor variations that will self-correct."
    else:
        most_edge = people_names[int(np.argmax(edge_counts))]
        least_edge = people_names[int(np.argmin(edge_counts))]
        fairness_text = f"Edge duty shows some imbalance (Gini={edge_gini:.3f}). {most_edge} has the most edge duties while {least_edge} has the fewest."

    # Diversity analysis
    total_possible = len(people_names) * (len(people_names) - 1) // 2
    seen = sum(1 for v in pair_counts.values() if v > 0)
    coverage_pct = (seen / total_possible * 100) if total_possible > 0 else 0

    if coverage_pct >= 100:
        diversity_text = f"All {total_possible} possible pairs have been explored. Pair distribution Gini is {pair_gini:.3f}."
    else:
        diversity_text = f"{seen}/{total_possible} pairs covered ({coverage_pct:.0f}%). {total_possible - seen} pairs remain unexplored."

    # Recommendations
    recommendations = []
    if coverage_pct < 100:
        recommendations.append(f"Continue scheduling to cover remaining {total_possible - seen} unseen pairs.")
    if edge_gini > 0.1 and total_days >= 5:
        recommendations.append("Monitor edge duty balance — consider increasing edge_imbalance_penalty weight.")
    if pair_gini > 0.15:
        recommendations.append("Pair distribution is uneven — the optimizer will auto-correct over the next cycle.")
    if total_days < 5:
        recommendations.append("Schedule is still in early stages — metrics will stabilize after a full 5-day cycle.")
    if not recommendations:
        recommendations.append("Schedule quality is excellent. No adjustments needed.")

    return {
        "fairness_analysis": fairness_text,
        "diversity_analysis": diversity_text,
        "recommendations": recommendations,
    }
