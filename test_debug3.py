import sys
sys.path.append(".")
import numpy as np
from engine.optimizer import SeatOptimizer
from engine.simulation import apply_all_hard_constraints, score_arrangement
from engine.graph_model import PairInteractionGraph

def test():
    opt = SeatOptimizer()
    # run exactly 5 days
    results = opt.generate_schedule(start_day=0, num_days=5, use_planning=False)
    
    # manually prepare for day 5
    pair_counts = {}
    seat_counts = np.zeros((5, 5), dtype=np.int32)
    history = []
    
    for arr, sc, _ in results:
        arr_list = arr.tolist()
        history.append(arr_list)
        for s, p in enumerate(arr_list):
            seat_counts[p, s] += 1
        for i in range(4):
            a, b = arr_list[i], arr_list[i+1]
            pair = f"{min(a,b)}-{max(a,b)}"
            pair_counts[pair] = pair_counts.get(pair, 0) + 1
            
    print(f"Seat counts after 5 days:\n{seat_counts}")
    print(f"Pair counts after 5 days:\n{pair_counts}")
            
    graph = PairInteractionGraph(opt.config, pair_counts)
    
    candidates = apply_all_hard_constraints(
        opt.all_perms, seat_counts, history[-1], 5, 5
    )
    
    print(f"Number of hard candidates for Day 5: {len(candidates)}")
    
    scores = []
    for cand in candidates:
        sc = score_arrangement(
            cand, graph, seat_counts, history[-1], 5, opt.config.weights, 5, history
        )
        scores.append((cand.tolist(), sc))
        
    scores.sort(key=lambda x: x[1], reverse=True)
    
    print("Top 10 candidates:")
    for arr, sc in scores[:10]:
        print(f"  {arr}: {sc}")
test()
