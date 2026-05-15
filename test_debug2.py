import sys
sys.path.append(".")
from engine.optimizer import SeatOptimizer

def test():
    opt = SeatOptimizer()
    results = opt.generate_schedule(
        start_day=0,
        num_days=6,
        use_planning=False,
    )
    for day, (arr, sc, prof) in enumerate(results):
        print(f"Day {day}: {arr.tolist()}, Score: {sc}")
test()
