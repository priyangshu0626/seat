import sys
sys.path.append(".")
from engine.optimizer import SeatOptimizer

def test():
    opt = SeatOptimizer()
    results = opt.generate_schedule(
        start_day=0,
        num_days=15,
        use_planning=True,
    )
    
    arrs = []
    for day, (arr, sc, prof) in enumerate(results):
        arrs.append(arr.tolist())
        print(f"Day {day}: {arr.tolist()}")
        
    for i in range(len(arrs)):
        for j in range(i+1, len(arrs)):
            if arrs[i] == arrs[j]:
                print(f"FAIL: Day {i} exact match with Day {j}")
                return
    print("SUCCESS: No repeats in 15 days!")
test()
