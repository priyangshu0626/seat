# Seat Planner V3 — Industrial-Grade Seating Optimization Engine
#
# Hybrid architecture:
#   Layer 1: Hard constraints via OR-Tools CP-SAT
#   Layer 2: Global optimization via weighted objectives
#   Layer 3: Long-horizon planning via Monte Carlo rollouts
#
# Modules:
#   state_manager  — Pydantic models, configuration, API schemas
#   graph_model    — NetworkX pair interaction graph
#   constraints    — CP-SAT hard constraint builder
#   optimizer      — Core solver + objective functions
#   scoring        — Multi-objective scoring, entropy
#   simulation     — Monte Carlo rollouts, beam search
#   fairness       — Variance analysis, fairness metrics
#   analytics      — Coverage, heatmaps, statistics
#   ai_assistant   — Gemini 2.5 Pro advisory layer
