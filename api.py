"""
api.py — FastAPI backend for the industrial-grade seating optimization engine.

Endpoints:
  GET  /health           → health check + engine capabilities
  GET  /config           → engine configuration (people, seats, weights)
  POST /generate         → single-day optimal arrangement (CP-SAT + planning)
  POST /generate-bulk    → multi-day schedule generation
  POST /analyze          → AI-powered schedule quality analysis
  GET  /                 → serve frontend

Architecture:
  The API is stateless: all accumulated state (pair counts, seat counts)
  is passed in each request by the frontend. This means:
  - No database needed
  - Multiple frontends can share the same backend
  - Results are deterministic and reproducible

The optimization pipeline:
  1. CP-SAT solver finds hard-constraint-valid arrangements
  2. Multi-objective scoring ranks candidates
  3. Monte Carlo rollouts evaluate long-term consequences
  4. Best arrangement selected with provable fairness properties

CORS is enabled for local development (frontend served separately).
"""

from __future__ import annotations

import time
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from engine.state_manager import (
    EngineConfig,
    GenerateRequest,
    GenerateResponse,
    ArrangementMeta,
    PairGraphEdge,
    BulkGenerateRequest,
    BulkGenerateResponse,
    BulkDayResult,
    AnalyzeRequest,
    AnalyzeResponse,
    ConfigResponse,
)
from engine.optimizer import SeatOptimizer
from engine.graph_model import PairInteractionGraph, get_adjacent_pairs
from engine.scoring import (
    compute_coverage,
    compute_diversity_score,
    compute_normalized_entropy,
)
from engine.fairness import (
    compute_edge_fairness_score,
    compute_gini_coefficient,
    compute_projected_fairness,
)
from engine.analytics import count_new_pairs
from engine.ai_assistant import analyze_schedule_quality, is_ai_available


# ─── APP SETUP ─────────────────────────────────────────────────────

app = FastAPI(
    title="Seat Planner V3 — Industrial-Grade Optimization Engine",
    description=(
        "Mathematically rigorous seating optimizer with OR-Tools CP-SAT solver, "
        "Monte Carlo long-horizon planning, entropy maximization, provable fairness, "
        "and optional Gemini AI advisory layer."
    ),
    version="3.0.0",
)

# CORS — allow frontend origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared engine config and optimizer instance
config = EngineConfig()
optimizer = SeatOptimizer(config)


# ─── STATIC FILE SERVING ──────────────────────────────────────────
# Serve the frontend files from the 'frontend' directory

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the main frontend page."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── ENDPOINTS ─────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint with engine capability report."""
    return {
        "status": "ok",
        "engine": "SeatOptimizer",
        "version": "3.0.0",
        "architecture": "hybrid_cpsat_monte_carlo",
        "capabilities": {
            "cp_sat_solver": True,
            "monte_carlo_rollouts": True,
            "beam_search": True,
            "entropy_maximization": True,
            "pair_interaction_graph": True,
            "fairness_analysis": True,
            "ai_advisory": is_ai_available(),
        },
        "config": {
            "num_people": config.num_people,
            "num_seats": config.num_seats,
            "lookahead_depth": config.lookahead_depth,
            "beam_width": config.beam_width,
            "monte_carlo_samples": config.monte_carlo_samples,
            "solver_time_limit_ms": config.solver_time_limit_ms,
        },
    }


@app.get("/config", response_model=ConfigResponse)
async def get_config():
    """Return the engine configuration."""
    return ConfigResponse(
        people=config.people,
        seats=config.seats,
        weights=config.weights,
        start_date=config.start_date,
        num_people=config.num_people,
        num_seats=config.num_seats,
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate_arrangement(req: GenerateRequest):
    """
    Generate the optimal seating arrangement for a single day.

    Pipeline:
    1. Build pair interaction graph from history
    2. Construct CP-SAT model with hard constraints
    3. Enumerate feasible solutions
    4. Score with multi-objective function
    5. Evaluate top candidates via Monte Carlo rollouts
    6. Return best arrangement with full analytics
    """
    try:
        pair_counts = dict(req.pair_counts) if req.pair_counts else {}

        if req.seat_counts and len(req.seat_counts) > 0:
            seat_counts = np.array(req.seat_counts, dtype=np.int32)
        else:
            seat_counts = np.zeros(
                (config.num_people, config.num_seats), dtype=np.int32
            )

        last_row = req.last_row

        # Run the optimization pipeline
        arrangement, score, profiling = optimizer.optimize_single_day(
            req.day_index, pair_counts, seat_counts, last_row,
            use_planning=True,
            generate_explanation=True,
        )

        # Build pair interaction graph for response
        graph = PairInteractionGraph(config, pair_counts)
        new_pairs = graph.count_new_pairs(arrangement)
        coverage = graph.get_coverage_fraction()

        fairness = compute_edge_fairness_score(seat_counts, config.num_people)
        diversity = compute_diversity_score(pair_counts, config.num_people)
        entropy = profiling.get("entropy_score", 0.0)
        future_risk = profiling.get("future_risk", 0.0)
        explanation = profiling.get("explanation", "")

        # Export pair graph
        pair_graph_edges = graph.get_pair_graph_edges()

        return GenerateResponse(
            arrangement=arrangement.tolist(),
            score=score,
            meta=ArrangementMeta(
                new_pairs=new_pairs,
                coverage_progress=coverage,
                fairness_score=fairness,
                diversity_score=diversity,
                entropy_score=entropy,
                future_risk=future_risk,
                computation_ms=profiling.get("computation_ms", 0.0),
                solver_status=profiling.get("solver_status", "UNKNOWN"),
            ),
            pair_graph=pair_graph_edges,
            explanation=explanation,
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-bulk", response_model=BulkGenerateResponse)
async def generate_bulk(req: BulkGenerateRequest):
    """
    Generate arrangements for multiple consecutive days.

    The engine propagates state internally between days, applying
    the full optimization pipeline to each day.
    """
    try:
        pair_counts = dict(req.initial_pair_counts) if req.initial_pair_counts else {}

        if req.initial_seat_counts and len(req.initial_seat_counts) > 0:
            seat_counts = np.array(req.initial_seat_counts, dtype=np.int32)
        else:
            seat_counts = np.zeros(
                (config.num_people, config.num_seats), dtype=np.int32
            )

        last_row = req.initial_last_row

        results = optimizer.generate_schedule(
            start_day=req.start_day_index,
            num_days=req.num_days,
            initial_pair_counts=pair_counts,
            initial_seat_counts=seat_counts,
            initial_last_row=last_row,
        )

        running_pair_counts = dict(pair_counts)
        running_seat_counts = seat_counts.copy()
        days = []

        for i, (arrangement, score, profiling) in enumerate(results):
            graph = PairInteractionGraph(config, running_pair_counts)
            new_pairs = graph.count_new_pairs(arrangement)
            coverage = graph.get_coverage_fraction()
            fairness = compute_edge_fairness_score(running_seat_counts, config.num_people)
            diversity = compute_diversity_score(running_pair_counts, config.num_people)
            entropy = profiling.get("entropy_score", 0.0)
            future_risk = profiling.get("future_risk", 0.0)

            days.append(BulkDayResult(
                day_index=req.start_day_index + i,
                arrangement=arrangement.tolist(),
                score=score,
                meta=ArrangementMeta(
                    new_pairs=new_pairs,
                    coverage_progress=coverage,
                    fairness_score=fairness,
                    diversity_score=diversity,
                    entropy_score=entropy,
                    future_risk=future_risk,
                    computation_ms=profiling.get("computation_ms", 0.0),
                    solver_status=profiling.get("solver_status", "UNKNOWN"),
                ),
            ))

            # Update running state
            for pair_key in get_adjacent_pairs(arrangement):
                running_pair_counts[pair_key] = running_pair_counts.get(pair_key, 0) + 1
            for seat_idx, person_idx in enumerate(arrangement):
                running_seat_counts[int(person_idx), seat_idx] += 1

        return BulkGenerateResponse(days=days)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_schedule(req: AnalyzeRequest):
    """
    AI-powered schedule quality analysis.

    Uses Gemini 2.5 Pro (if available) or deterministic analysis
    to evaluate fairness, diversity, and provide recommendations.
    """
    try:
        pair_counts = dict(req.pair_counts) if req.pair_counts else {}
        seat_counts = req.seat_counts if req.seat_counts else [[0] * config.num_seats] * config.num_people

        people_names = [p.name for p in config.people]
        sc_arr = np.array(seat_counts, dtype=np.int32)

        # Get AI analysis
        analysis = analyze_schedule_quality(
            pair_counts, seat_counts, req.total_days,
            people_names, req.recent_arrangements
        )

        # Compute mathematical metrics
        entropy = compute_normalized_entropy(
            pair_counts,
            config.num_people * (config.num_people - 1) // 2
        )

        pair_values = list(pair_counts.values()) if pair_counts else [0]
        gini = compute_gini_coefficient(pair_values)

        projected = compute_projected_fairness(
            sc_arr, config.num_people, req.total_days, 30
        )

        return AnalyzeResponse(
            fairness_analysis=analysis.get("fairness_analysis", ""),
            diversity_analysis=analysis.get("diversity_analysis", ""),
            recommendations=analysis.get("recommendations", []),
            entropy_score=entropy,
            gini_coefficient=gini,
            projected_fairness_30d=projected,
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Mount static files at root — MUST be LAST (catch-all for app.js, data.json, etc.)
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")


# ─── MAIN ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))

    print("🚀 Starting Seat Planner V3 — Industrial-Grade Optimization Engine")
    print(f"   People: {[p.name for p in config.people]}")
    print(f"   Seats:  {config.num_seats}")
    print(f"   Permutations: {len(optimizer.all_perms)}")
    print(f"   Solver: OR-Tools CP-SAT + Monte Carlo")
    print(f"   Lookahead: {config.lookahead_depth} days")
    print(f"   Beam Width: {config.beam_width}")
    print(f"   AI Advisory: {'✓ Gemini 2.5 Pro' if is_ai_available() else '✗ Deterministic fallback'}")
    print(f"   Port:   {port}")
    print()

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
