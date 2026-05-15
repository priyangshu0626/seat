"""
state_manager.py — Pydantic models, typed state, and API schemas.

This is the single source of truth for all data structures used across
the optimization pipeline. Every module imports from here — no circular
dependencies, no implicit state.

Architecture:
  - PersonConfig / SeatConfig: static metadata
  - OptimizerWeights: tunable scoring parameters
  - EngineConfig: full system configuration
  - ScheduleState: mutable optimization state passed through the pipeline
  - Request/Response schemas for the FastAPI endpoints
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ─── CONFIGURATION ─────────────────────────────────────────────────

class PersonConfig(BaseModel):
    """Metadata for a single person in the rotation."""
    name: str
    initial: str
    color: str
    index: int


class SeatConfig(BaseModel):
    """Metadata for a single seat position."""
    label: str
    comfort_label: str
    color: str
    comfort_pct: int
    css_class: str
    badge_class: str
    badge_text: str


class OptimizerWeights(BaseModel):
    """
    Tunable weights for the multi-objective scoring function.

    These control how the CP-SAT solver and scoring engine balance
    competing objectives. All soft constraint penalties are expressed
    as integer costs (CP-SAT requires integer arithmetic).

    Weight categories:
      - Pair diversity: controls neighbor variety enforcement
      - Back-to-back: prevents day-over-day repetition
      - Edge fairness: equalizes edge-seat distribution
      - Future flexibility: preserves downstream options
      - Entropy: maximizes schedule unpredictability
    """
    # ── Pair diversity ──
    pair_imbalance_penalty: int = Field(
        default=10000,
        description="Cost per excess pair count over the global minimum"
    )
    new_pair_reward: int = Field(
        default=5000,
        description="Bonus for completely unseen neighbor pairs"
    )
    min_pair_reward: int = Field(
        default=2000,
        description="Bonus for pairs at the global minimum count"
    )

    # ── Back-to-back avoidance ──
    back_to_back_pair_penalty: int = Field(
        default=500000,
        description="Cost for repeating a neighbor pair from the previous day"
    )
    same_seat_penalty: int = Field(
        default=50000,
        description="Cost for keeping a person in the same seat as yesterday"
    )
    same_edge_penalty: int = Field(
        default=100000,
        description="Cost for the same person on an edge as yesterday"
    )

    # ── Edge fairness ──
    edge_imbalance_penalty: int = Field(
        default=500,
        description="Cost per unit of edge-duty imbalance"
    )

    # ── Future flexibility ──
    future_flexibility_weight: int = Field(
        default=1000,
        description="Weight for preserving future valid state count"
    )

    # ── Entropy ──
    entropy_weight: int = Field(
        default=800,
        description="Weight for Shannon entropy of pair distribution"
    )

    # ── Deterministic tiebreaker ──
    tiebreak_scale: float = Field(
        default=0.001,
        description="Scale of the deterministic hash tiebreaker"
    )


class EngineConfig(BaseModel):
    """
    Full engine configuration — people, seats, optimizer weights,
    and planning horizon parameters.

    This is immutable at runtime. Changing people or seats requires
    a server restart (by design — the optimizer precomputes structures
    based on this configuration).
    """
    people: list[PersonConfig] = Field(default_factory=lambda: [
        PersonConfig(name="Sachin", initial="S", color="#ff6b35", index=0),
        PersonConfig(name="Priyangshu", initial="P", color="#7b61ff", index=1),
        PersonConfig(name="Gaurav", initial="G", color="#1a936f", index=2),
        PersonConfig(name="Yatharth", initial="Y", color="#e8b84b", index=3),
        PersonConfig(name="Aryavrat", initial="A", color="#e63946", index=4),
    ])
    seats: list[SeatConfig] = Field(default_factory=lambda: [
        SeatConfig(label="Seat 1", comfort_label="Edge 😖", color="#e63946",
                   comfort_pct=10, css_class="edge-seat", badge_class="badge-edge", badge_text="EDGE"),
        SeatConfig(label="Seat 2", comfort_label="Near-edge 😐", color="#f7c59f",
                   comfort_pct=55, css_class="near-seat", badge_class="badge-near", badge_text="NEAR"),
        SeatConfig(label="Seat 3", comfort_label="Middle 😎", color="#1a936f",
                   comfort_pct=100, css_class="best-seat", badge_class="badge-mid", badge_text="BEST"),
        SeatConfig(label="Seat 4", comfort_label="Near-edge 😐", color="#f7c59f",
                   comfort_pct=55, css_class="near-seat", badge_class="badge-near", badge_text="NEAR"),
        SeatConfig(label="Seat 5", comfort_label="Edge 😖", color="#e63946",
                   comfort_pct=10, css_class="edge-seat", badge_class="badge-edge", badge_text="EDGE"),
    ])
    weights: OptimizerWeights = Field(default_factory=OptimizerWeights)
    start_date: str = "2026-04-24"
    num_people: int = 5
    num_seats: int = 5

    # ── Planning horizon ──
    lookahead_depth: int = Field(
        default=14,
        description="Number of future days to simulate in Monte Carlo rollouts"
    )
    beam_width: int = Field(
        default=20,
        description="Number of top candidates to carry forward in beam search"
    )
    monte_carlo_samples: int = Field(
        default=50,
        description="Number of random rollouts per beam candidate"
    )
    solver_time_limit_ms: int = Field(
        default=150,
        description="CP-SAT solver time limit per day in milliseconds"
    )


# ─── MUTABLE SCHEDULE STATE ──────────────────────────────────────

class ScheduleState(BaseModel):
    """
    Mutable state passed through the optimization pipeline.

    This encapsulates all accumulated history needed to compute
    the next optimal arrangement. It is explicitly passed (not global)
    to enable lookahead simulation without side effects.
    """
    pair_counts: dict[str, int] = Field(default_factory=dict)
    seat_counts: list[list[int]] = Field(default_factory=list)
    last_arrangement: Optional[list[int]] = None
    day_index: int = 0
    total_days_scheduled: int = 0


# ─── API SCHEMAS ───────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    """
    Input payload for POST /generate.

    Contains all state needed to compute the optimal arrangement for a
    single day. The frontend sends accumulated pair/seat/edge state so
    the backend remains stateless per request.
    """
    day_index: int = Field(..., ge=0, description="0-based class day index")
    pair_counts: dict[str, int] = Field(
        default_factory=dict,
        description="Accumulated neighbor pair counts, e.g. {'0-1': 3, '2-4': 1}"
    )
    seat_counts: list[list[int]] = Field(
        default_factory=list,
        description="NxN matrix: seat_counts[person][seat] = count"
    )
    last_row: Optional[list[int]] = Field(
        default=None,
        description="Previous day's arrangement, or null for day 0"
    )


class PairGraphEdge(BaseModel):
    """Single edge in the pair interaction graph."""
    source: int
    target: int
    weight: int
    source_name: str
    target_name: str


class ArrangementMeta(BaseModel):
    """Metadata about the generated arrangement's quality."""
    new_pairs: int = Field(description="Number of completely new pairs in this arrangement")
    coverage_progress: float = Field(description="Fraction of all possible pairs seen so far (0.0–1.0)")
    fairness_score: float = Field(description="Edge-duty fairness metric (0–100)")
    diversity_score: float = Field(description="Overall neighbour diversity score (0–100)")
    entropy_score: float = Field(default=0.0, description="Shannon entropy of pair distribution")
    future_risk: float = Field(default=0.0, description="Risk of future dead-ends (0.0 = safe, 1.0 = critical)")
    computation_ms: float = Field(description="Time spent computing this arrangement (milliseconds)")
    solver_status: str = Field(default="OPTIMAL", description="CP-SAT solver status")


class GenerateResponse(BaseModel):
    """Output payload from POST /generate."""
    arrangement: list[int] = Field(description="Seat assignments: arrangement[seat_index] = person_index")
    score: float = Field(description="Raw optimizer score for this arrangement")
    meta: ArrangementMeta
    pair_graph: list[PairGraphEdge] = Field(default_factory=list, description="Pair interaction graph edges")
    explanation: str = Field(default="", description="AI-generated explanation (if available)")


class BulkGenerateRequest(BaseModel):
    """
    Input payload for POST /generate-bulk.

    Generates arrangements for multiple consecutive days in a single call.
    The engine handles state propagation internally between days.
    """
    start_day_index: int = Field(..., ge=0, description="First day index to generate")
    num_days: int = Field(..., ge=1, le=365, description="Number of consecutive days to generate")
    initial_pair_counts: dict[str, int] = Field(default_factory=dict)
    initial_seat_counts: list[list[int]] = Field(default_factory=list)
    initial_last_row: Optional[list[int]] = Field(default=None)


class BulkDayResult(BaseModel):
    """Result for a single day within a bulk generation."""
    day_index: int
    arrangement: list[int]
    score: float
    meta: ArrangementMeta


class BulkGenerateResponse(BaseModel):
    """Output payload from POST /generate-bulk."""
    days: list[BulkDayResult]


class AnalyzeRequest(BaseModel):
    """Input for POST /analyze — request AI analysis of schedule quality."""
    pair_counts: dict[str, int] = Field(default_factory=dict)
    seat_counts: list[list[int]] = Field(default_factory=list)
    total_days: int = 0
    recent_arrangements: list[list[int]] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    """Output from POST /analyze."""
    fairness_analysis: str
    diversity_analysis: str
    recommendations: list[str]
    entropy_score: float
    gini_coefficient: float
    projected_fairness_30d: float


class ConfigResponse(BaseModel):
    """Output payload from GET /config."""
    people: list[PersonConfig]
    seats: list[SeatConfig]
    weights: OptimizerWeights
    start_date: str
    num_people: int
    num_seats: int
