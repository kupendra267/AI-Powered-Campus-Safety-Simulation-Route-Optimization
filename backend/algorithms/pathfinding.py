"""
Pathfinding Algorithms & Routing Engine
=======================================
Implements A* graph search, Dijkstra baseline, Yen's K-Shortest alternative paths,
and multi-objective cost evaluation (Distance, Travel Time, Crowd Congestion, ML Prediction, Risk).
"""

import math
import heapq
from typing import Dict, List, Tuple, Optional, Any


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle geographic distance in meters between two lat/lon points.
    Guaranteed admissible heuristic for A* pathfinding on spherical earth coordinates.
    """
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return round(R * c, 2)


class RoutingConfig:
    """Configurable parameters for campus routing calculation."""
    # Standard pedestrian walking speed (1.4 m/s ~= 5.04 km/h)
    DEFAULT_WALKING_SPEED = 1.4
    
    # Weight coefficients for multi-objective cost formulas
    DISTANCE_WEIGHT = 0.40
    CONGESTION_WEIGHT = 0.60
    PREDICTION_WEIGHT = 0.70
    RISK_WEIGHT = 0.50

    @classmethod
    def get_effective_walking_speed(cls, density_pct: float, base_speed: float = None) -> float:
        """
        Calculates walking speed reduction based on pedestrian density (Weidmann's model).
        - Low density (0-40%): 100% nominal speed (1.40 m/s)
        - Medium density (41-70%): ~75% nominal speed (1.05 m/s)
        - High density (71-90%): ~50% nominal speed (0.70 m/s)
        - Critical density (>90%): ~25% nominal speed (0.35 m/s)
        """
        speed = base_speed or cls.DEFAULT_WALKING_SPEED
        if density_pct <= 40.0:
            return max(0.2, speed * 1.0)
        elif density_pct <= 70.0:
            return max(0.2, speed * (1.0 - 0.25 * ((density_pct - 40.0) / 30.0)))
        elif density_pct <= 90.0:
            return max(0.2, speed * (0.75 - 0.25 * ((density_pct - 70.0) / 20.0)))
        else:
            return max(0.2, speed * max(0.25, 0.50 - 0.25 * min(1.0, (density_pct - 90.0) / 30.0)))

    @classmethod
    def compute_edge_cost(cls, edge: Dict[str, Any], mode: str = "SHORTEST", 
                          weights: Dict[str, float] = None, base_speed: float = None) -> float:
        """
        Computes the traversal cost for an edge based on the selected routing mode:
        - SHORTEST: Cost = distance
        - FASTEST: Cost = estimated travel time (accounting for congestion speed slowdown)
        - CROWD_AWARE: Cost = distance_weight * distance + crowd_weight * (distance * congestion_multiplier)
        - PREDICTIVE: Cost = distance_weight * distance + pred_weight * (distance * predicted_congestion_multiplier)
        """
        w = weights or {
            "distance": cls.DISTANCE_WEIGHT,
            "congestion": cls.CONGESTION_WEIGHT,
            "prediction": cls.PREDICTION_WEIGHT
        }
        speed = base_speed or cls.DEFAULT_WALKING_SPEED

        distance = float(edge.get("distance_meters", 10.0))
        density = float(edge.get("density_percentage", 0.0))
        pred_density = float(edge.get("predicted_density", density))

        if mode == "SHORTEST":
            return distance

        elif mode == "FASTEST":
            eff_speed = cls.get_effective_walking_speed(density, speed)
            travel_time_seconds = distance / eff_speed
            return travel_time_seconds

        elif mode == "CROWD_AWARE":
            # Multiplier ranges from 1.0 (calm) to 4.5 (packed bottleneck)
            congestion_factor = 1.0 + (density / 100.0) * 3.5
            cost = (w.get("distance", cls.DISTANCE_WEIGHT) * distance +
                    w.get("congestion", cls.CONGESTION_WEIGHT) * (distance * congestion_factor))
            return cost

        elif mode == "PREDICTIVE":
            # Uses ML predicted density weighting
            effective_density = max(density * 0.4, pred_density * 0.8)
            congestion_factor = 1.0 + (effective_density / 100.0) * 4.0
            cost = (w.get("distance", cls.DISTANCE_WEIGHT) * distance +
                    w.get("prediction", cls.PREDICTION_WEIGHT) * (distance * congestion_factor))
            return cost

        else: # Default fallback to distance
            return distance


class CampusPathFinder:
    """
    Graph Pathfinding Engine implementing A* and Yen's K-Shortest algorithm.
    Excludes blocked pathways, handles directional corridors, and generates verified alternative routes.
    """

    def __init__(self, nodes_dict: Dict[int, Dict[str, Any]], 
                 adjacency_dict: Dict[int, List[Dict[str, Any]]]):
        """
        :param nodes_dict: Map of node_id -> {id, name, latitude, longitude, node_type, ...}
        :param adjacency_dict: Map of node_id -> list of outgoing edges {path_id, target_node_id, distance_meters, capacity, status, ...}
        """
        self.nodes = nodes_dict
        self.adjacency = adjacency_dict

    def _heuristic(self, node_id: int, goal_id: int, mode: str = "SHORTEST", base_speed: float = 1.4) -> float:
        """Admissible A* heuristic function."""
        node = self.nodes.get(node_id)
        goal = self.nodes.get(goal_id)
        if not node or not goal:
            return 0.0

        lat1, lon1 = float(node["latitude"]), float(node["longitude"])
        lat2, lon2 = float(goal["latitude"]), float(goal["longitude"])
        dist = haversine_distance(lat1, lon1, lat2, lon2)

        if mode == "FASTEST":
            # Admissible time heuristic: straight-line distance divided by maximum possible walking speed
            return dist / (base_speed * 1.2)
        elif mode in ["CROWD_AWARE", "PREDICTIVE"]:
            # Admissible multi-objective lower bound
            return dist * RoutingConfig.DISTANCE_WEIGHT
        else:
            return dist

    def find_shortest_path_astar(self, start_id: int, goal_id: int, 
                                 mode: str = "SHORTEST", 
                                 ignored_edges: set = None, 
                                 ignored_nodes: set = None,
                                 weights: Dict[str, float] = None,
                                 base_speed: float = 1.4) -> Optional[Dict[str, Any]]:
        """
        A* algorithm calculating the optimal path from start_id to goal_id.
        Strictly ignores BLOCKED paths, ignored_edges, and ignored_nodes.
        """
        if start_id not in self.nodes or goal_id not in self.nodes:
            return None

        if start_id == goal_id:
            node = self.nodes[start_id]
            return {
                "nodes": [node],
                "node_ids": [start_id],
                "path_ids": [],
                "edges": [],
                "total_distance": 0.0,
                "total_time_seconds": 0.0,
                "cost": 0.0
            }

        ignored_edges = ignored_edges or set()
        ignored_nodes = ignored_nodes or set()

        # Priority queue stores: (f_score, current_cost, node_id, path_node_ids, path_edge_objs)
        open_set = []
        h_start = self._heuristic(start_id, goal_id, mode, base_speed)
        heapq.heappush(open_set, (h_start, 0.0, start_id, [start_id], []))

        g_score = {start_id: 0.0}
        visited = set()

        while open_set:
            f, current_g, current_node, path_nodes, path_edges = heapq.heappop(open_set)

            if current_node == goal_id:
                # Goal reached! Reconstruct and return path details
                total_dist = sum(e.get("distance_meters", 0.0) for e in path_edges)
                
                # Calculate travel time accounting for segment congestion
                total_time = 0.0
                for e in path_edges:
                    d = float(e.get("distance_meters", 0.0))
                    dens = float(e.get("density_percentage", 0.0))
                    spd = RoutingConfig.get_effective_walking_speed(dens, base_speed)
                    total_time += d / max(0.1, spd)

                return {
                    "nodes": [self.nodes[n_id] for n_id in path_nodes if n_id in self.nodes],
                    "node_ids": path_nodes,
                    "path_ids": [e["path_id"] for e in path_edges if "path_id" in e],
                    "edges": path_edges,
                    "total_distance": round(total_dist, 2),
                    "total_time_seconds": round(total_time, 1),
                    "cost": round(current_g, 2)
                }

            if current_node in visited and g_score.get(current_node, float('inf')) < current_g:
                continue
            visited.add(current_node)

            for edge in self.adjacency.get(current_node, []):
                next_node = edge["target_node_id"]
                path_id = edge.get("path_id")
                status = edge.get("status", "OPEN")

                # Prune blocked paths, edge exclusions, and node exclusions
                if status == "BLOCKED":
                    continue
                if (current_node, next_node) in ignored_edges or path_id in ignored_edges:
                    continue
                if next_node in ignored_nodes and next_node != goal_id:
                    continue

                edge_cost = RoutingConfig.compute_edge_cost(edge, mode, weights, base_speed)
                tentative_g = current_g + edge_cost

                if tentative_g < g_score.get(next_node, float('inf')):
                    g_score[next_node] = tentative_g
                    h = self._heuristic(next_node, goal_id, mode, base_speed)
                    f_next = tentative_g + h
                    heapq.heappush(open_set, (
                        f_next,
                        tentative_g,
                        next_node,
                        path_nodes + [next_node],
                        path_edges + [edge]
                    ))

        return None

    def find_k_shortest_paths_yen(self, start_id: int, goal_id: int, k: int = 3,
                                  mode: str = "SHORTEST",
                                  weights: Dict[str, float] = None,
                                  base_speed: float = 1.4) -> List[Dict[str, Any]]:
        """
        Yen's algorithm finding up to K loopless, distinct shortest/alternative paths.
        Guarantees non-duplicate routes with clear topological divergence.
        """
        if start_id == goal_id:
            single = self.find_shortest_path_astar(start_id, goal_id, mode, weights=weights, base_speed=base_speed)
            return [single] if single else []

        A: List[Dict[str, Any]] = []
        B: List[Dict[str, Any]] = []  # Candidate pool

        # 1. First shortest path
        first_path = self.find_shortest_path_astar(start_id, goal_id, mode, weights=weights, base_speed=base_speed)
        if not first_path:
            return []
        A.append(first_path)

        seen_node_sequences = {tuple(first_path["node_ids"])}

        # 2. Iterate to discover up to K-1 alternative paths
        for k_idx in range(1, k):
            prev_path = A[k_idx - 1]
            prev_nodes = prev_path["node_ids"]
            prev_edges = prev_path["edges"]

            for i in range(len(prev_nodes) - 1):
                spur_node = prev_nodes[i]
                root_path_nodes = prev_nodes[:i + 1]
                root_path_edges = prev_edges[:i]

                # Calculate root path cost and distance
                root_cost = sum(
                    RoutingConfig.compute_edge_cost(e, mode, weights, base_speed)
                    for e in root_path_edges
                )

                # Collect edges to ignore
                ignored_edges = set()
                for p in A:
                    p_nodes = p["node_ids"]
                    p_edges = p["edges"]
                    if len(p_nodes) > i and p_nodes[:i + 1] == root_path_nodes and len(p_edges) > i:
                        ignored_edges.add(p_edges[i]["path_id"])
                        ignored_edges.add((p_nodes[i], p_nodes[i + 1]))

                # Ignore root path nodes except spur_node
                ignored_nodes = set(root_path_nodes[:-1])

                # Find spur path from spur_node to goal
                spur_path = self.find_shortest_path_astar(
                    spur_node, goal_id, mode,
                    ignored_edges=ignored_edges,
                    ignored_nodes=ignored_nodes,
                    weights=weights,
                    base_speed=base_speed
                )

                if spur_path:
                    # Combine root and spur
                    total_node_ids = root_path_nodes[:-1] + spur_path["node_ids"]
                    total_node_seq = tuple(total_node_ids)

                    if total_node_seq not in seen_node_sequences:
                        seen_node_sequences.add(total_node_seq)
                        total_edges = root_path_edges + spur_path["edges"]
                        total_dist = sum(e.get("distance_meters", 0.0) for e in total_edges)
                        
                        total_time = 0.0
                        for e in total_edges:
                            d = float(e.get("distance_meters", 0.0))
                            dens = float(e.get("density_percentage", 0.0))
                            spd = RoutingConfig.get_effective_walking_speed(dens, base_speed)
                            total_time += d / max(0.1, spd)

                        total_cost = root_cost + spur_path["cost"]

                        candidate = {
                            "nodes": [self.nodes[n_id] for n_id in total_node_ids if n_id in self.nodes],
                            "node_ids": total_node_ids,
                            "path_ids": [e["path_id"] for e in total_edges if "path_id" in e],
                            "edges": total_edges,
                            "total_distance": round(total_dist, 2),
                            "total_time_seconds": round(total_time, 1),
                            "cost": round(total_cost, 2)
                        }
                        B.append(candidate)

            if not B:
                break

            # Select lowest cost candidate from B
            B.sort(key=lambda x: (x["cost"], x["total_distance"]))
            next_best = B.pop(0)
            A.append(next_best)

        return A
