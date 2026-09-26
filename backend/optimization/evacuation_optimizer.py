"""
Evacuation Optimization Engine (Phase 7)
=========================================
Capacity-Aware Multi-Route & Exit Flow Optimization.
Determines optimal distribution of evacuees across campus paths and emergency exits
to minimize evacuation clearance time, peak congestion, exit overloads, and route distance.

Academic Project Notice:
Simulation-based evacuation recommendation — For Academic Demonstration.
"""

import json
import math
import copy
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple

from backend.extensions import db
from backend.models.campus import Node, Path, Building, Exit
from backend.models.crowd import CrowdData
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.models.optimization import OptimizationConfig, OptimizationResult
from backend.services.crowd_prediction_service import CrowdPredictionService
from backend.algorithms.pathfinding import CampusPathFinder, RoutingConfig, haversine_distance


class EvacuationOptimizer:
    ACADEMIC_DISCLAIMER = "Simulation-based evacuation recommendation — For Academic Demonstration"

    @classmethod
    def run_optimization(cls, simulation_id: Optional[int] = None,
                         scenario_id: Optional[int] = None,
                         custom_weights: Optional[Dict[str, float]] = None,
                         max_iterations: Optional[int] = None,
                         use_predicted_crowd: Optional[bool] = None,
                         custom_params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """
        Executes full Phase 7 Baseline vs. Optimized comparative evacuation optimization.
        Can run from an existing Simulation, directly from an EmergencyScenario, or custom What-If params.
        """
        config = OptimizationConfig.get_or_create()
        weights = custom_weights or config.get_normalized_weights()
        
        # Normalize weights
        w_time = max(0.0, float(weights.get('evacuation_time', 0.40)))
        w_cong = max(0.0, float(weights.get('congestion', 0.30)))
        w_dist = max(0.0, float(weights.get('distance', 0.20)))
        w_exit = max(0.0, float(weights.get('exit_overload', 0.10)))
        total_w = w_time + w_cong + w_dist + w_exit
        if total_w > 0:
            norm_weights = {
                'evacuation_time': round(w_time / total_w, 3),
                'congestion': round(w_cong / total_w, 3),
                'distance': round(w_dist / total_w, 3),
                'exit_overload': round(w_exit / total_w, 3)
            }
        else:
            norm_weights = {'evacuation_time': 0.40, 'congestion': 0.30, 'distance': 0.20, 'exit_overload': 0.10}

        iters_limit = max_iterations or config.max_iterations or 30
        is_predictive = use_predicted_crowd if use_predicted_crowd is not None else config.use_predicted_crowd

        # 1. Resolve Scenario / Simulation
        scenario = None
        sim_record = None

        if simulation_id:
            sim_record = db.session.get(Simulation, int(simulation_id))
            if not sim_record:
                return {"success": False, "message": f"Simulation #{simulation_id} not found."}, 404
            scenario = sim_record.scenario

        if not scenario and scenario_id:
            scenario = db.session.get(EmergencyScenario, int(scenario_id))

        if not scenario and not sim_record and not custom_params:
            from backend.services.emergency_service import EmergencyService
            EmergencyService.seed_default_scenarios_if_empty()
            scenario = EmergencyScenario.query.first()

        scenario_name = scenario.name if scenario else (sim_record.scenario_name if sim_record else "Ad-Hoc Evacuation Scenario")
        location_id = scenario.emergency_location_id if scenario else None
        node_id = scenario.emergency_node_id if scenario else None
        people_count = scenario.affected_people_count if scenario else (sim_record.people_count if sim_record else 600)
        blocked_path_ids = set(scenario.get_blocked_path_ids() if scenario else [])
        disabled_exit_ids = set(scenario.get_disabled_exit_ids() if scenario else [])

        # Override from custom_params if provided (for Phase 8 What-If isolated execution)
        if custom_params:
            if "name" in custom_params:
                scenario_name = custom_params["name"]
            if "emergency_location_id" in custom_params:
                location_id = custom_params["emergency_location_id"]
            if "emergency_node_id" in custom_params:
                node_id = custom_params["emergency_node_id"]
            if "people_count" in custom_params:
                people_count = int(custom_params["people_count"])
            if "blocked_path_ids" in custom_params:
                blocked_path_ids = set(custom_params["blocked_path_ids"])
            if "disabled_exit_ids" in custom_params:
                disabled_exit_ids = set(custom_params["disabled_exit_ids"])

        # 2. Ingest Campus Topology
        nodes = Node.query.all()
        paths = Path.query.all()
        buildings = Building.query.all()
        exits = Exit.query.all()

        if not nodes or not paths:
            return {"success": False, "message": "Campus topology graph is empty."}, 400

        nodes_map = {n.id: n.to_dict() for n in nodes}
        paths_map = {p.id: p for p in paths}
        building_id_map = {b.id: b for b in buildings}

        # Determine Emergency Epicenter Node
        epicenter_node_id = node_id
        if location_id and location_id in building_id_map:
            epicenter_node_id = building_id_map[location_id].node_id
        elif not epicenter_node_id and buildings:
            epicenter_node_id = buildings[0].node_id
        elif not epicenter_node_id and nodes:
            epicenter_node_id = nodes[0].id

        # Available Exits Filter
        available_exits = [
            e for e in exits 
            if e.status == "ACTIVE" and e.id not in disabled_exit_ids and e.node_id in nodes_map
        ]

        if not available_exits:
            return {
                "success": False,
                "error": "ALL_EXITS_UNAVAILABLE",
                "message": "No active evacuation exits are available for optimization."
            }, 400

        # 3. Ingest Population / Crowd Distribution
        crowd_distribution = {}
        if is_predictive:
            try:
                pred_summary = CrowdPredictionService.predict_campus_summary(horizon_hours=1)
                if pred_summary and pred_summary[0].get("success"):
                    locs = pred_summary[0].get("data", {}).get("locations", [])
                    for loc in locs:
                        crowd_distribution[loc["location_id"]] = loc.get("predicted_crowd", 50)
            except Exception:
                pass

        if not crowd_distribution:
            for b in buildings:
                latest = CrowdData.query.filter_by(location_id=b.id).order_by(CrowdData.timestamp.desc()).first()
                crowd_distribution[b.id] = latest.crowd_count if latest else int(b.capacity * 0.3)

        if location_id and location_id in crowd_distribution:
            crowd_distribution[location_id] = max(people_count, crowd_distribution[location_id])

        # Apply custom crowd distribution overrides if supplied in custom_params
        if custom_params and "crowd_distribution" in custom_params and isinstance(custom_params["crowd_distribution"], dict):
            for cid, cval in custom_params["crowd_distribution"].items():
                crowd_distribution[int(cid)] = int(cval)

        # 4. Construct Graph Topology (Excluding Blocked Paths)
        adjacency: Dict[int, List[Dict[str, Any]]] = {n.id: [] for n in nodes}
        for path in paths:
            is_blocked = (path.status == "BLOCKED") or (path.id in blocked_path_ids)
            if is_blocked:
                continue

            adjacency[path.source_node_id].append({
                "path_id": path.id,
                "source_node_id": path.source_node_id,
                "target_node_id": path.destination_node_id,
                "distance_meters": path.distance_meters,
                "capacity": path.capacity,
                "status": "OPEN",
                "emergency_safe": path.emergency_safe
            })

            if path.is_bidirectional and path.destination_node_id in adjacency:
                adjacency[path.destination_node_id].append({
                    "path_id": path.id,
                    "source_node_id": path.destination_node_id,
                    "target_node_id": path.source_node_id,
                    "distance_meters": path.distance_meters,
                    "capacity": path.capacity,
                    "status": "OPEN",
                    "emergency_safe": path.emergency_safe
                })

        pathfinder = CampusPathFinder(nodes_map, adjacency)

        # 5. Extract Origin Nodes with People
        origin_nodes_with_people = []
        for b in buildings:
            cnt = crowd_distribution.get(b.id, 0)
            if cnt > 0 and b.node_id in nodes_map:
                origin_nodes_with_people.append({
                    "building_id": b.id,
                    "building_name": b.name,
                    "node_id": b.node_id,
                    "people": cnt,
                    "is_epicenter": (b.id == location_id or b.node_id == epicenter_node_id)
                })

        if not origin_nodes_with_people and epicenter_node_id in nodes_map:
            origin_nodes_with_people.append({
                "building_id": location_id or 1,
                "building_name": nodes_map[epicenter_node_id]["name"],
                "node_id": epicenter_node_id,
                "people": people_count,
                "is_epicenter": True
            })

        # 6. Generate Candidate Routes Pool ($K$-Shortest Paths to All Exits)
        candidate_routes_by_origin: Dict[int, List[Dict[str, Any]]] = {}
        all_candidate_routes: List[Dict[str, Any]] = []

        for origin in origin_nodes_with_people:
            orig_b_id = origin["building_id"]
            orig_node_id = origin["node_id"]
            candidate_routes_by_origin[orig_b_id] = []

            for exit_obj in available_exits:
                exit_node_id = exit_obj.node_id

                # Find primary shortest path
                p1 = pathfinder.find_shortest_path_astar(orig_node_id, exit_node_id, mode="SHORTEST")
                if p1:
                    route_item_1 = {
                        "route_id": f"{orig_b_id}_{exit_obj.id}_p1",
                        "origin": origin,
                        "exit": exit_obj,
                        "path_obj": p1,
                        "distance": p1["total_distance"],
                        "walking_time": p1["total_time_seconds"],
                        "path_ids": p1["path_ids"],
                        "nodes": p1["nodes"],
                        "route_type": "SHORTEST"
                    }
                    candidate_routes_by_origin[orig_b_id].append(route_item_1)
                    all_candidate_routes.append(route_item_1)

                # Find alternative fastest / crowd-aware route
                p2 = pathfinder.find_shortest_path_astar(orig_node_id, exit_node_id, mode="FASTEST")
                if p2 and (not p1 or p2["path_ids"] != p1["path_ids"]):
                    route_item_2 = {
                        "route_id": f"{orig_b_id}_{exit_obj.id}_p2",
                        "origin": origin,
                        "exit": exit_obj,
                        "path_obj": p2,
                        "distance": p2["total_distance"],
                        "walking_time": p2["total_time_seconds"],
                        "path_ids": p2["path_ids"],
                        "nodes": p2["nodes"],
                        "route_type": "FASTEST_ALT"
                    }
                    candidate_routes_by_origin[orig_b_id].append(route_item_2)
                    all_candidate_routes.append(route_item_2)

        if not all_candidate_routes:
            return {
                "success": False,
                "error": "NO_VALID_ROUTES",
                "message": "No valid evacuation routes could be calculated from campus origins to any exit."
            }, 400

        # 7. Compute Ground-Truth Baseline Allocation (Phase 6 Proportional Logic)
        baseline_plan = cls._compute_baseline_allocation(
            origin_nodes_with_people, candidate_routes_by_origin, exits, paths_map, norm_weights
        )

        # 8. Run Iterative Capacity-Aware Min-Cost Flow Optimization
        optimized_plan, explanations, total_iters = cls._optimize_flow_allocation(
            origin_nodes_with_people, candidate_routes_by_origin, exits,
            paths_map, norm_weights, iters_limit, baseline_plan
        )

        # 9. Compute Actual Research Comparison Metrics
        b_time = baseline_plan["evacuation_time"]
        o_time = optimized_plan["evacuation_time"]
        time_reduction_pct = round(((b_time - o_time) / b_time * 100.0), 1) if b_time > 0 else 0.0

        b_util = baseline_plan["avg_utilization"]
        o_util = optimized_plan["avg_utilization"]
        cong_reduction_pct = round(((b_util - o_util) / b_util * 100.0), 1) if b_util > 0 else 0.0

        b_dist = baseline_plan["total_distance"]
        o_dist = optimized_plan["total_distance"]
        dist_change_pct = round(((o_dist - b_dist) / b_dist * 100.0), 1) if b_dist > 0 else 0.0

        b_btnk_cnt = len(baseline_plan["bottlenecks"])
        o_btnk_cnt = len(optimized_plan["bottlenecks"])
        btnk_reduction_pct = round(((b_btnk_cnt - o_btnk_cnt) / max(1, b_btnk_cnt) * 100.0), 1) if b_btnk_cnt > 0 else 0.0

        opt_status = "OPTIMAL" if optimized_plan["unassigned_people"] == 0 else "PARTIAL"

        # 10. Persist OptimizationResult in Database
        opt_record = OptimizationResult(
            simulation_id=sim_record.id if sim_record else None,
            scenario_id=scenario.id if scenario else None,
            scenario_name=scenario_name,
            optimization_method="CAPACITY_AWARE_MIN_COST_FLOW",
            baseline_time=b_time,
            baseline_max_congestion=baseline_plan["max_congestion"],
            baseline_avg_utilization=b_util,
            baseline_total_distance=b_dist,
            baseline_unassigned=baseline_plan["unassigned_people"],
            baseline_bottlenecks_count=b_btnk_cnt,
            optimized_time=o_time,
            optimized_max_congestion=optimized_plan["max_congestion"],
            optimized_avg_utilization=o_util,
            optimized_total_distance=o_dist,
            optimized_unassigned=optimized_plan["unassigned_people"],
            optimized_bottlenecks_count=o_btnk_cnt,
            time_reduction_percentage=time_reduction_pct,
            congestion_reduction_percentage=cong_reduction_pct,
            distance_change_percentage=dist_change_pct,
            bottlenecks_reduction_percentage=btnk_reduction_pct,
            objective_score_baseline=baseline_plan["objective_score"],
            objective_score_optimized=optimized_plan["objective_score"],
            iterations=total_iters,
            weights_json=json.dumps(norm_weights),
            baseline_routes_json=json.dumps(baseline_plan["assigned_routes"]),
            optimized_routes_json=json.dumps(optimized_plan["assigned_routes"]),
            baseline_exits_json=json.dumps(baseline_plan["exit_summary"]),
            optimized_exits_json=json.dumps(optimized_plan["exit_summary"]),
            baseline_bottlenecks_json=json.dumps(baseline_plan["bottlenecks"]),
            optimized_bottlenecks_json=json.dumps(optimized_plan["bottlenecks"]),
            explanations_json=json.dumps(explanations),
            status=opt_status
        )

        db.session.add(opt_record)
        db.session.commit()

        return {
            "success": True,
            "message": f"Phase 7 evacuation optimization completed ({opt_status}). Evacuation time: {b_time}s -> {o_time}s ({time_reduction_pct}% reduction).",
            "optimization_id": opt_record.id,
            "data": opt_record.to_dict()
        }, 200

    @classmethod
    def _compute_baseline_allocation(cls, origins: List[Dict[str, Any]],
                                    candidate_routes: Dict[int, List[Dict[str, Any]]],
                                    exits: List[Exit],
                                    paths_map: Dict[int, Path],
                                    weights: Dict[str, float]) -> Dict[str, Any]:
        """Computes Phase 6 proportional nearest-exit baseline allocation."""
        exit_caps = {e.id: e.capacity * 2 for e in exits}
        exit_assigned = {e.id: 0 for e in exits}
        path_flows: Dict[int, int] = {}
        assigned_routes = []
        total_unassigned = 0

        for origin in origins:
            orig_b_id = origin["building_id"]
            routes = candidate_routes.get(orig_b_id, [])
            if not routes:
                total_unassigned += origin["people"]
                continue

            rem_people = origin["people"]
            
            # Distance and capacity weighted allocation
            route_weights = []
            tot_w = 0.0
            for r in routes:
                e_id = r["exit"].id
                cap_rem = max(0, exit_caps[e_id] - exit_assigned[e_id])
                w = (cap_rem / max(10.0, r["distance"] ** 0.5)) if cap_rem > 0 else 0.0
                route_weights.append(w)
                tot_w += w

            for idx, r in enumerate(routes):
                if rem_people <= 0:
                    break
                e_id = r["exit"].id
                cap_rem = max(0, exit_caps[e_id] - exit_assigned[e_id])
                if cap_rem <= 0:
                    continue

                if tot_w > 0 and idx < len(routes) - 1:
                    target = int(round(origin["people"] * (route_weights[idx] / tot_w)))
                    alloc = min(rem_people, min(target, cap_rem))
                else:
                    alloc = min(rem_people, cap_rem)

                if alloc <= 0:
                    continue

                exit_assigned[e_id] += alloc
                rem_people -= alloc

                for pid in r["path_ids"]:
                    path_flows[pid] = path_flows.get(pid, 0) + alloc

                assigned_routes.append({
                    "route_id": r["route_id"],
                    "origin_id": orig_b_id,
                    "origin_name": origin["building_name"],
                    "exit_id": e_id,
                    "exit_name": r["exit"].name,
                    "exit_capacity": r["exit"].capacity,
                    "nodes": r["nodes"],
                    "path_ids": r["path_ids"],
                    "people_assigned": alloc,
                    "distance": round(r["distance"], 1),
                    "walking_time": round(r["walking_time"], 1)
                })

            if rem_people > 0:
                total_unassigned += rem_people

        return cls._evaluate_plan_metrics(assigned_routes, exit_assigned, path_flows, total_unassigned, exits, paths_map, weights)

    @classmethod
    def _optimize_flow_allocation(cls, origins: List[Dict[str, Any]],
                                 candidate_routes: Dict[int, List[Dict[str, Any]]],
                                 exits: List[Exit],
                                 paths_map: Dict[int, Path],
                                 weights: Dict[str, float],
                                 max_iterations: int,
                                 baseline_plan: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """
        Iterative Min-Cost Congestion Gradient Flow Optimization.
        Alleviates corridor bottlenecks and exit overloads by dynamically re-routing flow.
        """
        explanations: List[Dict[str, Any]] = []
        current_plan = copy.deepcopy(baseline_plan)
        best_plan = copy.deepcopy(baseline_plan)
        best_score = baseline_plan["objective_score"]
        
        exit_obj_map = {e.id: e for e in exits}
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            improved_in_step = False

            # Identify top bottleneck corridor in current allocation
            bottlenecks = current_plan.get("bottlenecks", [])
            overloaded_exits = [e for e in current_plan.get("exit_summary", []) if e["utilization_percentage"] > 90.0]

            # Strategy 1: Relieve most severe corridor bottleneck
            if bottlenecks:
                target_btnk = bottlenecks[0]
                target_pid = target_btnk["path_id"]

                # Find assigned routes traversing this bottleneck
                traversing_routes = [
                    r for r in current_plan["assigned_routes"] 
                    if target_pid in r["path_ids"] and r["people_assigned"] > 5
                ]

                # Sort by largest flow contributor
                traversing_routes.sort(key=lambda r: r["people_assigned"], reverse=True)

                for r in traversing_routes:
                    orig_id = r["origin_id"]
                    alt_candidates = [
                        alt for alt in candidate_routes.get(orig_id, [])
                        if target_pid not in alt["path_ids"]
                    ]

                    if not alt_candidates:
                        continue

                    # Select best alternative route with lowest current congestion and spare exit capacity
                    shift_amount = max(5, int(r["people_assigned"] * 0.40))

                    for alt_r in alt_candidates:
                        candidate_plan = cls._attempt_flow_shift(
                            current_plan, r, alt_r, shift_amount, exits, paths_map, weights
                        )

                        if candidate_plan and candidate_plan["objective_score"] < best_score:
                            best_score = candidate_plan["objective_score"]
                            best_plan = copy.deepcopy(candidate_plan)
                            current_plan = copy.deepcopy(candidate_plan)
                            improved_in_step = True

                            explanations.append({
                                "step": iteration,
                                "type": "BOTTLENECK_RELIEF",
                                "origin": r["origin_name"],
                                "action": f"Diverted {shift_amount} evacuees from Corridor #{target_pid} to alternative {alt_r['route_type']} via {alt_r['exit'].name}.",
                                "reason": f"Corridor #{target_pid} utilization was {target_btnk['utilization']}%. Shift reduced peak corridor congestion.",
                                "impact": f"Objective score improved to {round(best_score, 4)}"
                            })
                            break

                    if improved_in_step:
                        break

            # Strategy 2: Relieve exit overload if any exit is saturated
            if not improved_in_step and overloaded_exits:
                target_exit = overloaded_exits[0]
                t_exit_id = target_exit["exit_id"]

                # Find routes feeding into this exit
                feeding_routes = [
                    r for r in current_plan["assigned_routes"]
                    if r["exit_id"] == t_exit_id and r["people_assigned"] > 5
                ]
                feeding_routes.sort(key=lambda r: r["people_assigned"], reverse=True)

                for r in feeding_routes:
                    orig_id = r["origin_id"]
                    alt_candidates = [
                        alt for alt in candidate_routes.get(orig_id, [])
                        if alt["exit"].id != t_exit_id
                    ]

                    if not alt_candidates:
                        continue

                    shift_amount = max(5, int(r["people_assigned"] * 0.35))

                    for alt_r in alt_candidates:
                        candidate_plan = cls._attempt_flow_shift(
                            current_plan, r, alt_r, shift_amount, exits, paths_map, weights
                        )

                        if candidate_plan and candidate_plan["objective_score"] < best_score:
                            best_score = candidate_plan["objective_score"]
                            best_plan = copy.deepcopy(candidate_plan)
                            current_plan = copy.deepcopy(candidate_plan)
                            improved_in_step = True

                            explanations.append({
                                "step": iteration,
                                "type": "EXIT_LOAD_BALANCING",
                                "origin": r["origin_name"],
                                "action": f"Reassigned {shift_amount} evacuees from {r['exit_name']} to {alt_r['exit'].name}.",
                                "reason": f"{r['exit_name']} was operating at {target_exit['utilization_percentage']}% load ceiling. Reassignment balances exit queue discharge.",
                                "impact": f"Objective score improved to {round(best_score, 4)}"
                            })
                            break

                    if improved_in_step:
                        break

            # Stop if no further improvement found
            if not improved_in_step:
                break

        if not explanations:
            explanations.append({
                "step": 1,
                "type": "CONVERGENCE",
                "action": "Baseline allocation is already at local Pareto optimality across exit capacities and paths.",
                "reason": "No single flow reassignment further improved the weighted objective score.",
                "impact": "Optimization converged."
            })

        return best_plan, explanations, iteration

    @classmethod
    def _attempt_flow_shift(cls, current_plan: Dict[str, Any],
                           from_route: Dict[str, Any],
                           to_route_obj: Dict[str, Any],
                           shift_amount: int,
                           exits: List[Exit],
                           paths_map: Dict[int, Path],
                           weights: Dict[str, float]) -> Optional[Dict[str, Any]]:
        """Simulates shifting flow from one route to another and recomputes all metrics."""
        assigned_routes = copy.deepcopy(current_plan["assigned_routes"])
        
        # Find from_route entry
        src_entry = next((r for r in assigned_routes if r["route_id"] == from_route["route_id"] and r["origin_id"] == from_route["origin_id"]), None)
        if not src_entry or src_entry["people_assigned"] < shift_amount:
            return None

        # Decrease from src
        src_entry["people_assigned"] -= shift_amount

        # Increase or add to dest
        dest_entry = next((r for r in assigned_routes if r["route_id"] == to_route_obj["route_id"] and r["origin_id"] == to_route_obj["origin"]["building_id"]), None)
        if dest_entry:
            dest_entry["people_assigned"] += shift_amount
        else:
            assigned_routes.append({
                "route_id": to_route_obj["route_id"],
                "origin_id": to_route_obj["origin"]["building_id"],
                "origin_name": to_route_obj["origin"]["building_name"],
                "exit_id": to_route_obj["exit"].id,
                "exit_name": to_route_obj["exit"].name,
                "exit_capacity": to_route_obj["exit"].capacity,
                "nodes": to_route_obj["nodes"],
                "path_ids": to_route_obj["path_ids"],
                "people_assigned": shift_amount,
                "distance": round(to_route_obj["distance"], 1),
                "walking_time": round(to_route_obj["walking_time"], 1)
            })

        # Filter out 0-people routes
        assigned_routes = [r for r in assigned_routes if r["people_assigned"] > 0]

        # Recompute path flows & exit loads
        exit_assigned = {e.id: 0 for e in exits}
        path_flows: Dict[int, int] = {}
        for r in assigned_routes:
            exit_assigned[r["exit_id"]] = exit_assigned.get(r["exit_id"], 0) + r["people_assigned"]
            for pid in r["path_ids"]:
                path_flows[pid] = path_flows.get(pid, 0) + r["people_assigned"]

        return cls._evaluate_plan_metrics(
            assigned_routes, exit_assigned, path_flows,
            current_plan["unassigned_people"], exits, paths_map, weights
        )

    @classmethod
    def _evaluate_plan_metrics(cls, assigned_routes: List[Dict[str, Any]],
                              exit_assigned: Dict[int, int],
                              path_flows: Dict[int, int],
                              unassigned_people: int,
                              exits: List[Exit],
                              paths_map: Dict[int, Path],
                              weights: Dict[str, float]) -> Dict[str, Any]:
        """Calculates exact mathematical evacuation metrics, bottlenecks, exit loads, and objective score."""
        # 1. Bottlenecks & Corridor Utilizations
        bottlenecks = []
        path_utilizations = []
        congestion_rank = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        inv_rank = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}
        max_cong_level = "LOW"

        for r in assigned_routes:
            r_utils = []
            for pid in r["path_ids"]:
                p_obj = paths_map.get(pid)
                cap = max(1, p_obj.capacity if p_obj else 150)
                flow = path_flows.get(pid, 0)
                util = round((flow / cap) * 100.0, 1)
                r_utils.append(util)
                path_utilizations.append(util)

                if util <= 40.0:
                    c_lvl = "LOW"
                elif util <= 70.0:
                    c_lvl = "MEDIUM"
                elif util <= 90.0:
                    c_lvl = "HIGH"
                else:
                    c_lvl = "CRITICAL"

                if congestion_rank[c_lvl] > congestion_rank[max_cong_level]:
                    max_cong_level = c_lvl

                if util >= 85.0:
                    existing = next((b for b in bottlenecks if b["path_id"] == pid), None)
                    if not existing:
                        src_coords = [float(p_obj.source_node.latitude), float(p_obj.source_node.longitude)] if (p_obj and p_obj.source_node and p_obj.source_node.latitude is not None) else None
                        dst_coords = [float(p_obj.destination_node.latitude), float(p_obj.destination_node.longitude)] if (p_obj and p_obj.destination_node and p_obj.destination_node.latitude is not None) else None
                        bottlenecks.append({
                            "path_id": pid,
                            "source_node_name": p_obj.source_node.name if p_obj and p_obj.source_node else f"Node {p_obj.source_node_id if p_obj else 'Src'}",
                            "destination_node_name": p_obj.destination_node.name if p_obj and p_obj.destination_node else f"Node {p_obj.destination_node_id if p_obj else 'Dst'}",
                            "source_coordinates": src_coords,
                            "destination_coordinates": dst_coords,
                            "capacity": cap,
                            "assigned_flow": flow,
                            "total_flow_rate": flow,
                            "utilization": util,
                            "utilization_percentage": util,
                            "congestion": c_lvl,
                            "severity": "CRITICAL" if util > 100 else ("HIGH" if util >= 90 else "MEDIUM"),
                            "recommended_action": f"Divert flow away from corridor #{pid} (Load: {util}%, Cap: {cap} p/min)"
                        })

            r["utilization"] = max(r_utils) if r_utils else 0.0
            r["congestion"] = "CRITICAL" if r["utilization"] > 90 else ("HIGH" if r["utilization"] > 70 else ("MEDIUM" if r["utilization"] > 40 else "LOW"))

        bottlenecks.sort(key=lambda b: b["utilization"], reverse=True)
        avg_utilization = round(sum(path_utilizations) / len(path_utilizations), 1) if path_utilizations else 0.0
        max_utilization = max(path_utilizations) if path_utilizations else 0.0

        # 2. Evacuation Time Calculation
        # Time = Max Route (Walking Time + Queue Clearance at Exit)
        max_evac_time = 0.0
        total_dist_weighted = 0.0
        total_people_assigned = 0

        for r in assigned_routes:
            w_sec = r["walking_time"]
            e_obj = next((e for e in exits if e.id == r["exit_id"]), None)
            e_cap_per_sec = max(1.0, (e_obj.capacity if e_obj else 500) / 60.0)
            e_clearance_sec = exit_assigned[r["exit_id"]] / e_cap_per_sec
            
            total_route_sec = w_sec + e_clearance_sec
            if total_route_sec > max_evac_time:
                max_evac_time = total_route_sec

            total_dist_weighted += r["distance"] * r["people_assigned"]
            total_people_assigned += r["people_assigned"]

        max_evac_time = max(30.0, round(max_evac_time, 1))
        avg_dist = round(total_dist_weighted / max(1, total_people_assigned), 1)

        # 3. Exit Load Summary & Overload Metric
        exit_summary = []
        total_exit_overload = 0.0

        for e in exits:
            assigned = exit_assigned.get(e.id, 0)
            cap = e.capacity * 2
            util_pct = round((assigned / max(1, cap)) * 100.0, 1)
            overload = max(0, assigned - cap)
            total_exit_overload += overload

            exit_summary.append({
                "exit_id": e.id,
                "exit_name": e.name,
                "capacity": e.capacity,
                "max_throughput_capacity": cap,
                "assigned_people": assigned,
                "utilization_percentage": util_pct,
                "overload_people": overload,
                "status": "OVERLOADED" if util_pct > 100.0 else ("OPTIMAL" if util_pct >= 40.0 else "UNDERUTILIZED")
            })

        # 4. Configurable Composite Objective Function Score
        # J = w_time * (T / 300) + w_cong * (U_max / 100) + w_dist * (D_avg / 500) + w_exit * (Overload / 200)
        norm_t = max_evac_time / 300.0
        norm_u = max_utilization / 100.0
        norm_d = avg_dist / 500.0
        norm_o = (total_exit_overload + (unassigned_people * 5)) / 200.0

        objective_score = round(
            (weights.get('evacuation_time', 0.40) * norm_t) +
            (weights.get('congestion', 0.30) * norm_u) +
            (weights.get('distance', 0.20) * norm_d) +
            (weights.get('exit_overload', 0.10) * norm_o),
            4
        )

        return {
            "assigned_routes": assigned_routes,
            "exit_summary": exit_summary,
            "bottlenecks": bottlenecks,
            "evacuation_time": max_evac_time,
            "max_congestion": max_cong_level,
            "max_utilization": max_utilization,
            "avg_utilization": avg_utilization,
            "total_distance": avg_dist,
            "unassigned_people": unassigned_people,
            "objective_score": objective_score
        }
