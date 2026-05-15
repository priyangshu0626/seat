"""
graph_model.py — Graph-based pair interaction tracking.

Models all seating relationships as a weighted undirected graph using
NetworkX. This enables:
  - O(1) adjacency lookups
  - Efficient pair frequency analysis
  - Graph-theoretic fairness metrics
  - Adjacency matrix export for CP-SAT integration
  - Visual pair interaction heatmaps

The graph is the mathematical backbone of the optimization engine.
Every pair (i, j) where i < j has an edge with weight = number of times
they've been adjacent neighbors.

Key structures:
  - interaction_graph: NetworkX Graph with edge weights
  - adjacency_matrix: NxN numpy array for fast numerical access
  - edge_frequency_vector: sorted list of (pair, count) for analysis
"""

from __future__ import annotations

from typing import Optional
import numpy as np

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False

from .state_manager import EngineConfig, PairGraphEdge


def canonical_pair_key(a: int, b: int) -> str:
    """
    Canonicalize a pair of person indices into a string key.
    The smaller index always comes first to ensure uniqueness.

    Args:
        a: person index
        b: person index

    Returns:
        Canonical pair key like "0-1", "2-4", etc.
    """
    if a > b:
        a, b = b, a
    return f"{a}-{b}"


def get_adjacent_pairs(arrangement: list[int] | np.ndarray) -> list[str]:
    """
    Extract adjacent neighbor pairs from a seating arrangement.

    For [A, B, C, D, E], pairs are: A-B, B-C, C-D, D-E
    Pairs are canonicalized so the smaller index always comes first.

    Args:
        arrangement: 1D array/list of person indices in seat order

    Returns:
        List of canonical pair keys
    """
    pairs = []
    for i in range(len(arrangement) - 1):
        a, b = int(arrangement[i]), int(arrangement[i + 1])
        pairs.append(canonical_pair_key(a, b))
    return pairs


class PairInteractionGraph:
    """
    Graph-based model of all pair interactions.

    Tracks every adjacency relationship as weighted graph edges.
    Provides O(1) lookups and efficient mathematical analysis.

    Attributes:
        num_people: number of people in the system
        config: engine configuration reference
        _pair_counts: canonical pair key → count mapping
        _adjacency_matrix: NxN numpy array (symmetric)
        _graph: NetworkX Graph (if available)
        _all_possible_pairs: set of all C(n,2) possible pair keys
        _edge_counts: per-person edge seat count tracking
    """

    def __init__(self, config: EngineConfig, pair_counts: Optional[dict[str, int]] = None):
        self.num_people = config.num_people
        self.config = config
        self._pair_counts: dict[str, int] = dict(pair_counts) if pair_counts else {}

        # Precompute all possible pair keys: C(n, 2) pairs
        self._all_possible_pairs: set[str] = set()
        for i in range(self.num_people):
            for j in range(i + 1, self.num_people):
                self._all_possible_pairs.add(canonical_pair_key(i, j))

        # Build adjacency matrix
        self._adjacency_matrix = np.zeros(
            (self.num_people, self.num_people), dtype=np.int32
        )
        for pair_key, count in self._pair_counts.items():
            parts = pair_key.split("-")
            a, b = int(parts[0]), int(parts[1])
            self._adjacency_matrix[a, b] = count
            self._adjacency_matrix[b, a] = count

        # Build NetworkX graph if available
        self._graph = None
        if HAS_NETWORKX:
            self._build_nx_graph()

    def _build_nx_graph(self) -> None:
        """Build or rebuild the NetworkX graph from current pair counts."""
        self._graph = nx.Graph()
        self._graph.add_nodes_from(range(self.num_people))
        for pair_key, count in self._pair_counts.items():
            parts = pair_key.split("-")
            a, b = int(parts[0]), int(parts[1])
            self._graph.add_edge(a, b, weight=count)

    def get_pair_count(self, a: int, b: int) -> int:
        """Get the number of times two people have been adjacent."""
        return self._pair_counts.get(canonical_pair_key(a, b), 0)

    def get_min_pair_count(self) -> int:
        """Get the global minimum pair count across all observed pairs."""
        if not self._pair_counts:
            return 0
        return min(self._pair_counts.values())

    def get_max_pair_count(self) -> int:
        """Get the maximum pair count."""
        if not self._pair_counts:
            return 0
        return max(self._pair_counts.values())

    def get_pair_counts_for_arrangement(self, arrangement: list[int] | np.ndarray) -> list[int]:
        """Get the current pair counts for each adjacent pair in an arrangement."""
        pairs = get_adjacent_pairs(arrangement)
        return [self._pair_counts.get(p, 0) for p in pairs]

    def count_new_pairs(self, arrangement: list[int] | np.ndarray) -> int:
        """Count how many pairs in this arrangement have never been seen."""
        pairs = get_adjacent_pairs(arrangement)
        return sum(1 for p in pairs if self._pair_counts.get(p, 0) == 0)

    def get_unseen_pairs(self) -> set[str]:
        """Get all pairs that have never been adjacent."""
        seen = set(k for k, v in self._pair_counts.items() if v > 0)
        return self._all_possible_pairs - seen

    def get_coverage_fraction(self) -> float:
        """Fraction of all possible pairs that have been seen at least once."""
        total = len(self._all_possible_pairs)
        seen = sum(1 for v in self._pair_counts.values() if v > 0)
        return seen / total if total > 0 else 0.0

    @property
    def adjacency_matrix(self) -> np.ndarray:
        """Return the NxN adjacency matrix (symmetric, integer weights)."""
        return self._adjacency_matrix

    @property
    def pair_counts(self) -> dict[str, int]:
        """Return the pair counts dictionary."""
        return self._pair_counts

    @property
    def total_possible_pairs(self) -> int:
        """Total number of possible unique pairs: C(n, 2)."""
        return len(self._all_possible_pairs)

    def get_pair_frequency_vector(self) -> np.ndarray:
        """
        Return a vector of all pair frequencies, including zero counts
        for unseen pairs. Length = C(n, 2). Sorted by pair key.
        """
        sorted_pairs = sorted(self._all_possible_pairs)
        return np.array(
            [self._pair_counts.get(p, 0) for p in sorted_pairs],
            dtype=np.int32
        )

    def get_pair_graph_edges(self) -> list[PairGraphEdge]:
        """Export pair graph as a list of PairGraphEdge objects for the API."""
        edges = []
        for pair_key in sorted(self._all_possible_pairs):
            parts = pair_key.split("-")
            a, b = int(parts[0]), int(parts[1])
            count = self._pair_counts.get(pair_key, 0)
            edges.append(PairGraphEdge(
                source=a,
                target=b,
                weight=count,
                source_name=self.config.people[a].name,
                target_name=self.config.people[b].name,
            ))
        return edges

    def apply_arrangement(self, arrangement: list[int] | np.ndarray) -> None:
        """
        Update the graph after an arrangement is chosen (mutates in place).

        Args:
            arrangement: the chosen seating arrangement for this day
        """
        pairs = get_adjacent_pairs(arrangement)
        for pair_key in pairs:
            self._pair_counts[pair_key] = self._pair_counts.get(pair_key, 0) + 1
            parts = pair_key.split("-")
            a, b = int(parts[0]), int(parts[1])
            self._adjacency_matrix[a, b] += 1
            self._adjacency_matrix[b, a] += 1

        if HAS_NETWORKX and self._graph is not None:
            for pair_key in pairs:
                parts = pair_key.split("-")
                a, b = int(parts[0]), int(parts[1])
                if self._graph.has_edge(a, b):
                    self._graph[a][b]["weight"] += 1
                else:
                    self._graph.add_edge(a, b, weight=1)

    def clone(self) -> "PairInteractionGraph":
        """Create a deep copy for simulation/lookahead without side effects."""
        return PairInteractionGraph(self.config, dict(self._pair_counts))

    def get_degree_centrality(self) -> dict[int, float]:
        """
        Compute degree centrality for each person in the interaction graph.
        Higher centrality = more diverse neighbor interactions.
        """
        if HAS_NETWORKX and self._graph is not None:
            return nx.degree_centrality(self._graph)
        # Fallback: manual computation
        centrality = {}
        for i in range(self.num_people):
            neighbors_seen = sum(
                1 for j in range(self.num_people)
                if i != j and self._adjacency_matrix[i, j] > 0
            )
            centrality[i] = neighbors_seen / (self.num_people - 1) if self.num_people > 1 else 0
        return centrality
