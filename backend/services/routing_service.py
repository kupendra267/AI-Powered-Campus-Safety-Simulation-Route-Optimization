"""
Campus Routing Service
======================
Coordinates intelligent pathfinding, multi-objective route evaluation,
real-time crowd impedance integration, Phase 4 ML predictive forecasting,
and alternative route generation for campus navigation.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy import desc

from backend.extensions import db
from backend.models.campus import Node, Path, Building, Exit
from backend.models.crowd import CrowdData
from backend.services.crowd_prediction_service import CrowdPredictionService
from backend.algorithms.pathfinding import (
    CampusPathFinder,
    RoutingConfig,
    haversine_distance
)

# Global in-memory admin routing configuration (with sensible defaults)
_ADMIN_ROUTING_CONFIG = {
    "walking_speed": RoutingConfig.DEFAULT_WALKING_SPEED,
    "distance_weight": RoutingConfig.DISTANCE_WEIGHT,
    "congestion_weight": RoutingConfig.CONGESTION_WEIGHT,
    "prediction_weight": RoutingConfig.PREDICTION_WEIGHT,
    "risk_weight": RoutingConfig.RISK_WEIGHT
}


class RoutingService:
    @classmethod
    def get_routing_config(cls) -> Dict[str, Any]:
        """Returns active routing engine configuration and weights."""
        return {
            "success": True,
            "data": {
                **_ADMIN_ROUTING_CONFIG,
                "speed_units": "meters/second",
                "nominal_speed_kmh": round(_ADMIN_ROUTING_CONFIG["walking_speed"] * 3.6, 2),
                "description": "Pedestrian movement and impedance weights for multi-objective path calculation."
            }
        }

    @classmethod
    def update_routing_config(cls, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """Updates active routing parameters (Admin only)."""
        global _ADMIN_ROUTING_CONFIG

        if "walking_speed" in data and data["walking_speed"] is not None:
            spd = float(data["walking_speed"])
            if spd < 0.2 or spd > 5.0:
                return {"success": False, "message": "Walking speed must be between 0.2 and 5.0 m/s."}, 400
            _ADMIN_ROUTING_CONFIG["walking_speed"] = round(spd, 2)

        if "distance_weight" in data and data["distance_weight"] is not None:
            _ADMIN_ROUTING_CONFIG["distance_weight"] = max(0.0, min(1.0, float(data["distance_weight"])))

        if "congestion_weight" in data and data["congestion_weight"] is not None:
            _ADMIN_ROUTING_CONFIG["congestion_weight"] = max(0.0, min(1.0, float(data["congestion_weight"])))

        if "prediction_weight" in data and data["prediction_weight"] is not None:
            _ADMIN_ROUTING_CONFIG["prediction_weight"] = max(0.0, min(1.0, float(data["prediction_weight"])))

        if "risk_weight" in data and data["risk_weight"] is not None:
            _ADMIN_ROUTING_CONFIG["risk_weight"] = max(0.0, min(1.0, float(data["risk_weight"])))

        return {
            "success": True,
            "message": "Routing configuration updated successfully.",
            "data": _ADMIN_ROUTING_CONFIG
        }, 200

    @classmethod
    def _load_enriched_graph(cls, mode: str = "SHORTEST", 
                             horizon_hours: int = 1,
                             prediction_time: str = None) -> Tuple[Dict[int, Dict[str, Any]], Dict[int, List[Dict[str, Any]]], Dict[str, Any]]:
        """
        Loads all nodes, buildings, exits, and paths from database.
        Enriches each edge with live crowd metrics and Phase 4 ML predicted densities.
        """
        nodes = Node.query.all()
        paths = Path.query.all()
        buildings = Building.query.all()
        exits = Exit.query.all()

        nodes_map = {n.id: n.to_dict() for n in nodes}
        building_node_map = {b.node_id: b for b in buildings}
        exit_node_map = {e.node_id: e for e in exits}

        # 1. Fetch live crowd data across buildings
        latest_crowd_by_building = {}
        for b in buildings:
            latest = CrowdData.query.filter_by(location_id=b.id).order_by(desc(CrowdData.timestamp)).first()
            if latest:
                latest_crowd_by_building[b.id] = latest.to_dict()
            else:
                default_count = int(b.capacity * 0.25)
                density, congestion = CrowdData.compute_density_and_congestion(default_count, b.capacity)
                latest_crowd_by_building[b.id] = {
                    "crowd_count": default_count,
                    "capacity": b.capacity,
                    "density_percentage": density,
                    "congestion_level": congestion
                }

        # 2. Fetch ML predicted densities if in PREDICTIVE mode or requested
        predicted_by_building = {}
        prediction_meta = {"source": "LIVE_CROWD_DATA", "horizon_hours": horizon_hours}

        if mode == "PREDICTIVE" or prediction_time:
            try:
                pred_summary = CrowdPredictionService.predict_campus_summary(horizon_hours=horizon_hours)
                if pred_summary and pred_summary[0].get("success"):
                    locations = pred_summary[0].get("data", {}).get("locations", [])
                    for loc in locations:
                        predicted_by_building[loc["location_id"]] = loc
                    prediction_meta = {
                        "source": "ML_PREDICTED_DATA",
                        "horizon_hours": horizon_hours,
                        "target_time": pred_summary[0].get("data", {}).get("target_time")
                    }
            except Exception as e:
                print(f"[!] Warning: Prediction enrichment fallback to live crowd: {str(e)}")
                prediction_meta = {
                    "source": "CURRENT_CROWD (Prediction Fallback)",
                    "note": "ML inference unavailable, fell back to real-time crowd metrics."
                }

        # 3. Build adjacency list with enriched edge weights
        adjacency: Dict[int, List[Dict[str, Any]]] = {n.id: [] for n in nodes}

        for path in paths:
            # Determine path crowd & density
            # Corridor's own crowd / capacity
            corridor_cap = max(1, path.capacity)
            corridor_crowd = path.current_crowd

            # Check if source or destination node connects to a building
            src_bldg = building_node_map.get(path.source_node_id)
            dst_bldg = building_node_map.get(path.destination_node_id)

            # Combined density: average of corridor density and connected endpoint densities
            src_density = latest_crowd_by_building.get(src_bldg.id, {}).get("density_percentage", 25.0) if src_bldg else 20.0
            dst_density = latest_crowd_by_building.get(dst_bldg.id, {}).get("density_percentage", 25.0) if dst_bldg else 20.0
            corridor_density = round((corridor_crowd / corridor_cap) * 100.0, 2)

            effective_density = round((corridor_density * 0.5) + ((src_density + dst_density) / 2.0) * 0.5, 2)
            _, congestion_lvl = CrowdData.compute_density_and_congestion(
                int((effective_density / 100.0) * corridor_cap), corridor_cap
            )

            # Predicted density for predictive routing
            src_pred_dens = predicted_by_building.get(src_bldg.id, {}).get("predicted_density", src_density) if src_bldg else src_density
            dst_pred_dens = predicted_by_building.get(dst_bldg.id, {}).get("predicted_density", dst_density) if dst_bldg else dst_density
            effective_pred_density = round((src_pred_dens + dst_pred_dens) / 2.0, 2)

            edge_fwd = {
                "path_id": path.id,
                "source_node_id": path.source_node_id,
                "source_node_name": nodes_map.get(path.source_node_id, {}).get("name"),
                "target_node_id": path.destination_node_id,
                "target_node_name": nodes_map.get(path.destination_node_id, {}).get("name"),
                "distance_meters": path.distance_meters,
                "capacity": path.capacity,
                "current_crowd": path.current_crowd,
                "density_percentage": effective_density,
                "predicted_density": effective_pred_density,
                "congestion_level": congestion_lvl,
                "status": path.status,
                "emergency_safe": path.emergency_safe,
                "is_bidirectional": path.is_bidirectional
            }
            adjacency[path.source_node_id].append(edge_fwd)

            if path.is_bidirectional and path.destination_node_id in adjacency:
                edge_rev = {
                    "path_id": path.id,
                    "source_node_id": path.destination_node_id,
                    "source_node_name": nodes_map.get(path.destination_node_id, {}).get("name"),
                    "target_node_id": path.source_node_id,
                    "target_node_name": nodes_map.get(path.source_node_id, {}).get("name"),
                    "distance_meters": path.distance_meters,
                    "capacity": path.capacity,
                    "current_crowd": path.current_crowd,
                    "density_percentage": effective_density,
                    "predicted_density": effective_pred_density,
                    "congestion_level": congestion_lvl,
                    "status": path.status,
                    "emergency_safe": path.emergency_safe,
                    "is_bidirectional": path.is_bidirectional
                }
                adjacency[path.destination_node_id].append(edge_rev)

        return nodes_map, adjacency, prediction_meta

    @classmethod
    def _format_time_string(cls, seconds: float) -> str:
        """Formats seconds into human-readable duration (e.g. '2m 15s' or '45s')."""
        sec = int(round(seconds))
        if sec < 60:
            return f"{sec}s"
        m, s = divmod(sec, 60)
        return f"{m}m {s:02d}s"

    @classmethod
    def _calculate_route_metrics(cls, route_obj: Dict[str, Any], route_name: str, 
                                 mode: str, base_speed: float) -> Dict[str, Any]:
        """
        Calculates comprehensive summary and individual segment metrics for a calculated route:
        - Segment-by-segment breakdown
        - Average & Peak Congestion
        - Simulation Risk Score (clearly labeled as a simulation indicator)
        """
        edges = route_obj.get("edges", [])
        nodes = route_obj.get("nodes", [])

        if not edges and len(nodes) <= 1:
            return {
                "route_id": route_name.lower().replace(" ", "_"),
                "name": route_name,
                "mode": mode,
                "nodes": nodes,
                "node_ids": route_obj.get("node_ids", []),
                "path_ids": [],
                "segments": [],
                "total_distance_meters": 0.0,
                "estimated_time_seconds": 0.0,
                "estimated_time_formatted": "0s",
                "average_density_percentage": 0.0,
                "average_congestion": "LOW",
                "maximum_congestion": "LOW",
                "maximum_density_percentage": 0.0,
                "simulation_risk_score": 0.0,
                "risk_level": "MINIMAL_RISK",
                "nodes_count": len(nodes),
                "paths_count": 0
            }

        densities = [float(e.get("density_percentage", 0.0)) for e in edges]
        avg_density = round(sum(densities) / max(1, len(densities)), 2)
        max_density = max(densities) if densities else 0.0

        # Congestion classifications
        congestion_rank = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        inv_rank = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}

        edge_congestions = [e.get("congestion_level", "LOW") for e in edges]
        max_cong_level = max(edge_congestions, key=lambda c: congestion_rank.get(c, 1)) if edge_congestions else "LOW"
        
        avg_rank_val = sum(congestion_rank.get(c, 1) for c in edge_congestions) / max(1, len(edge_congestions))
        avg_cong_level = inv_rank[min(4, max(1, int(round(avg_rank_val))))]

        # Calculate Simulation Risk Score (0-100 scale)
        # Factors: Density load (50%), High-density segments (30%), Narrow corridor penalties (20%)
        density_risk_component = min(50.0, (avg_density / 100.0) * 50.0)
        critical_segments = sum(1 for c in edge_congestions if c in ["HIGH", "CRITICAL"])
        critical_risk_component = min(30.0, (critical_segments / max(1, len(edges))) * 30.0)
        bottleneck_count = sum(1 for e in edges if e.get("capacity", 150) < 120)
        bottleneck_risk_component = min(20.0, (bottleneck_count / max(1, len(edges))) * 20.0)

        simulation_risk = round(density_risk_component + critical_risk_component + bottleneck_risk_component, 1)

        if simulation_risk <= 25.0:
            risk_level = "MINIMAL_RISK"
        elif simulation_risk <= 50.0:
            risk_level = "MODERATE_RISK"
        elif simulation_risk <= 75.0:
            risk_level = "ELEVATED_RISK"
        else:
            risk_level = "CRITICAL_RISK"

        # Build detailed segment objects
        segments = []
        for e in edges:
            dist = float(e.get("distance_meters", 0.0))
            dens = float(e.get("density_percentage", 0.0))
            spd = RoutingConfig.get_effective_walking_speed(dens, base_speed)
            seg_time = round(dist / max(0.1, spd), 1)

            segments.append({
                "path_id": e.get("path_id"),
                "source_node_id": e.get("source_node_id"),
                "source_node_name": e.get("source_node_name"),
                "destination_node_id": e.get("target_node_id"),
                "destination_node_name": e.get("target_node_name"),
                "distance_meters": dist,
                "capacity": e.get("capacity", 150),
                "current_crowd": e.get("current_crowd", 0),
                "density_percentage": dens,
                "predicted_density": e.get("predicted_density", dens),
                "congestion_level": e.get("congestion_level", "LOW"),
                "status": e.get("status", "OPEN"),
                "estimated_time_seconds": seg_time,
                "estimated_time_formatted": cls._format_time_string(seg_time),
                "emergency_safe": e.get("emergency_safe", True)
            })

        total_distance = route_obj.get("total_distance", 0.0)
        total_time = route_obj.get("total_time_seconds", 0.0)

        return {
            "route_id": route_name.lower().replace(" ", "_"),
            "name": route_name,
            "mode": mode,
            "nodes": nodes,
            "node_ids": route_obj.get("node_ids", []),
            "path_ids": route_obj.get("path_ids", []),
            "segments": segments,
            "total_distance_meters": round(total_distance, 1),
            "estimated_time_seconds": round(total_time, 1),
            "estimated_time_formatted": cls._format_time_string(total_time),
            "average_density_percentage": avg_density,
            "average_congestion": avg_cong_level,
            "maximum_congestion": max_cong_level,
            "maximum_density_percentage": max_density,
            "simulation_risk_score": simulation_risk,
            "risk_level": risk_level,
            "nodes_count": len(nodes),
            "paths_count": len(segments)
        }

    @classmethod
    def calculate_route(cls, start_node_id: int, destination_node_id: int, 
                        mode: str = "CROWD_AWARE", 
                        horizon_hours: int = 1,
                        prediction_time: str = None) -> Tuple[Dict[str, Any], int]:
        """
        Calculates the primary recommended route and up to 2 alternative routes
        between start_node_id and destination_node_id.
        """
        # Validate inputs
        if not start_node_id or not destination_node_id:
            return {"success": False, "message": "start_node_id and destination_node_id are required."}, 400

        try:
            start_id = int(start_node_id)
            dest_id = int(destination_node_id)
        except ValueError:
            return {"success": False, "message": "Node IDs must be valid integers."}, 400

        valid_modes = ["SHORTEST", "FASTEST", "CROWD_AWARE", "PREDICTIVE"]
        mode = mode.upper() if mode else "CROWD_AWARE"
        if mode not in valid_modes:
            return {
                "success": False,
                "message": f"Invalid routing mode '{mode}'. Allowed modes: {', '.join(valid_modes)}."
            }, 400

        # Load nodes and enriched graph topology
        nodes_map, adjacency, prediction_meta = cls._load_enriched_graph(
            mode=mode, horizon_hours=horizon_hours, prediction_time=prediction_time
        )

        # Check node existence
        start_node = nodes_map.get(start_id)
        dest_node = nodes_map.get(dest_id)

        if not start_node:
            return {"success": False, "message": f"Origin node #{start_id} does not exist in campus graph."}, 404
        if not dest_node:
            return {"success": False, "message": f"Destination node #{dest_id} does not exist in campus graph."}, 404

        # Check same start & destination
        if start_id == dest_id:
            single_route = cls._calculate_route_metrics(
                {
                    "nodes": [start_node],
                    "node_ids": [start_id],
                    "path_ids": [],
                    "edges": [],
                    "total_distance": 0.0,
                    "total_time_seconds": 0.0,
                    "cost": 0.0
                },
                route_name="Current Location",
                mode=mode,
                base_speed=_ADMIN_ROUTING_CONFIG["walking_speed"]
            )
            return {
                "success": True,
                "mode": mode,
                "routing_source": prediction_meta.get("source", "GRAPH"),
                "prediction_meta": prediction_meta,
                "start_node": start_node,
                "destination_node": dest_node,
                "recommended_route": single_route,
                "alternative_routes": [],
                "alternatives_count": 0,
                "alternatives_note": "Origin and destination are the exact same campus node."
            }, 200

        # Run Pathfinding Engine
        pathfinder = CampusPathFinder(nodes_map, adjacency)
        weights = {
            "distance": _ADMIN_ROUTING_CONFIG["distance_weight"],
            "congestion": _ADMIN_ROUTING_CONFIG["congestion_weight"],
            "prediction": _ADMIN_ROUTING_CONFIG["prediction_weight"]
        }
        base_speed = _ADMIN_ROUTING_CONFIG["walking_speed"]

        # Calculate K=3 distinct paths (Recommended, Alt 1, Alt 2)
        raw_routes = pathfinder.find_k_shortest_paths_yen(
            start_id, dest_id, k=3, mode=mode, weights=weights, base_speed=base_speed
        )

        if not raw_routes or len(raw_routes) == 0:
            return {
                "success": False,
                "error": "NO_ROUTE_AVAILABLE",
                "message": "No safe route is currently available between the selected locations.",
                "details": "All connecting paths may be currently marked as BLOCKED or the network is partitioned."
            }, 404

        # Process Primary Recommended Route
        recommended_route = cls._calculate_route_metrics(
            raw_routes[0], route_name="Recommended Route", mode=mode, base_speed=base_speed
        )

        # Process Alternative Routes
        alternative_routes = []
        for i, alt in enumerate(raw_routes[1:], start=1):
            alt_metrics = cls._calculate_route_metrics(
                alt, route_name=f"Alternative Route {i}", mode=mode, base_speed=base_speed
            )
            alternative_routes.append(alt_metrics)

        # Construct alternatives description
        if len(alternative_routes) == 2:
            alt_note = "2 distinct alternative routes calculated across campus graph topology."
        elif len(alternative_routes) == 1:
            alt_note = "1 alternative route found; campus graph topology provides limited distinct paths between these nodes."
        else:
            alt_note = "No alternative non-looping routes exist for this origin/destination pair."

        return {
            "success": True,
            "mode": mode,
            "routing_source": prediction_meta.get("source", "LIVE_CROWD_DATA"),
            "prediction_meta": prediction_meta,
            "start_node": start_node,
            "destination_node": dest_node,
            "recommended_route": recommended_route,
            "alternative_routes": alternative_routes,
            "alternatives_count": len(alternative_routes),
            "alternatives_note": alt_note,
            "routing_config": _ADMIN_ROUTING_CONFIG
        }, 200
