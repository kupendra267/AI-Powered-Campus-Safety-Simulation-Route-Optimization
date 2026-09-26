"""
Evacuation Simulation Engine (Phase 6)
======================================
Coordinates multi-exit evacuation pathfinding, multi-commodity flow allocation,
corridor utilization calculation, bottleneck detection, and discrete time-step simulation.

Academic Project Notice:
Simulation-based evacuation recommendation — For Academic Demonstration.
"""

import json
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple

from backend.extensions import db
from backend.models.campus import Node, Path, Building, Exit
from backend.models.crowd import CrowdData
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.services.crowd_prediction_service import CrowdPredictionService
from backend.algorithms.pathfinding import CampusPathFinder, RoutingConfig, haversine_distance


class EvacuationSimulator:
    ACADEMIC_DISCLAIMER = "Simulation-based evacuation recommendation — For Academic Demonstration"

    @classmethod
    def run_simulation(cls, scenario_id: Optional[int] = None, 
                       custom_params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """
        Executes a complete discrete evacuation simulation.
        Can run from a saved EmergencyScenario or ad-hoc custom parameters.
        """
        scenario = None
        if scenario_id:
            scenario = db.session.get(EmergencyScenario, int(scenario_id))
            if not scenario:
                return {"success": False, "message": f"Emergency Scenario #{scenario_id} not found."}, 404

        # Extract parameters
        params = custom_params or {}
        scenario_name = scenario.name if scenario else params.get("name", "Ad-Hoc Campus Evacuation")
        emergency_type = scenario.emergency_type if scenario else params.get("emergency_type", "GENERAL_EVACUATION")
        location_id = scenario.emergency_location_id if scenario else params.get("emergency_location_id")
        node_id = scenario.emergency_node_id if scenario else params.get("emergency_node_id")
        people_count = scenario.affected_people_count if scenario else int(params.get("people_count", 600))
        sim_mode = params.get("simulation_mode", "LIVE_CROWD")
        blocked_path_ids = set(scenario.get_blocked_path_ids() if scenario else params.get("blocked_path_ids", []))
        disabled_exit_ids = set(scenario.get_disabled_exit_ids() if scenario else params.get("disabled_exit_ids", []))
        base_walking_speed = float(params.get("walking_speed", RoutingConfig.DEFAULT_WALKING_SPEED))

        # 1. Load Campus Graph Topology
        nodes = Node.query.all()
        paths = Path.query.all()
        buildings = Building.query.all()
        exits = Exit.query.all()

        if not nodes or not paths:
            return {"success": False, "message": "Campus topology graph is empty."}, 400

        nodes_map = {n.id: n.to_dict() for n in nodes}
        building_node_map = {b.node_id: b for b in buildings}
        building_id_map = {b.id: b for b in buildings}

        # 2. Determine Emergency Epicenter Node
        epicenter_node_id = node_id
        if location_id and location_id in building_id_map:
            epicenter_node_id = building_id_map[location_id].node_id
        elif not epicenter_node_id and buildings:
            epicenter_node_id = buildings[0].node_id
        elif not epicenter_node_id and nodes:
            epicenter_node_id = nodes[0].id

        # 3. Filter Available Exits
        available_exits = [
            e for e in exits 
            if e.status == "ACTIVE" and e.id not in disabled_exit_ids and e.node_id in nodes_map
        ]

        if not available_exits:
            # Failure state: zero exits available
            failed_sim = Simulation(
                scenario_id=scenario.id if scenario else None,
                people_count=people_count,
                simulation_mode=sim_mode,
                estimated_evacuation_time=0.0,
                max_congestion="CRITICAL",
                bottleneck_count=1,
                successfully_assigned=0,
                unassigned_people=people_count,
                evacuation_progress_percentage=0.0,
                status="FAILED",
                timeline_steps=json.dumps([]),
                bottlenecks_summary=json.dumps([{
                    "location": "All Campus Exits",
                    "congestion": "CRITICAL",
                    "utilization": 100.0,
                    "affected_people": people_count,
                    "reason": "All evacuation exits are marked BLOCKED or disabled."
                }]),
                exit_utilization_summary=json.dumps([])
            )
            db.session.add(failed_sim)
            db.session.commit()

            return {
                "success": False,
                "error": "ALL_EXITS_UNAVAILABLE",
                "message": "No active evacuation exits are currently available in the campus network.",
                "simulation": failed_sim.to_dict()
            }, 400

        # 4. Ingest Crowd Distribution
        crowd_distribution = {}
        if sim_mode == "PREDICTIVE_ML":
            try:
                pred_summary = CrowdPredictionService.predict_campus_summary(horizon_hours=1)
                if pred_summary and pred_summary[0].get("success"):
                    locs = pred_summary[0].get("data", {}).get("locations", [])
                    for loc in locs:
                        crowd_distribution[loc["location_id"]] = loc.get("predicted_crowd", 50)
            except Exception:
                pass

        if not crowd_distribution:
            # Live crowd or baseline
            for b in buildings:
                latest = CrowdData.query.filter_by(location_id=b.id).order_by(CrowdData.timestamp.desc()).first()
                crowd_distribution[b.id] = latest.crowd_count if latest else int(b.capacity * 0.3)

        # Ensure epicenter has specified people count
        if location_id and location_id in crowd_distribution:
            crowd_distribution[location_id] = max(people_count, crowd_distribution[location_id])

        # 5. Build Evacuation Graph (Pruning Blocked Paths)
        adjacency: Dict[int, List[Dict[str, Any]]] = {n.id: [] for n in nodes}
        for path in paths:
            is_blocked = (path.status == "BLOCKED") or (path.id in blocked_path_ids)
            if is_blocked:
                continue

            # Forward Edge
            adjacency[path.source_node_id].append({
                "path_id": path.id,
                "source_node_id": path.source_node_id,
                "target_node_id": path.destination_node_id,
                "distance_meters": path.distance_meters,
                "capacity": path.capacity,
                "status": "OPEN",
                "emergency_safe": path.emergency_safe
            })

            # Reverse Edge if bidirectional
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

        # 6. Multi-Exit Evacuation Route Calculation
        # Identify starting origin nodes with evacuees
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

        # Calculate best evacuation route from each origin to each reachable exit
        evacuation_routes_pool = []
        for origin in origin_nodes_with_people:
            origin_node_id = origin["node_id"]
            
            for exit_obj in available_exits:
                exit_node_id = exit_obj.node_id
                
                # Run A* pathfinding
                path_obj = pathfinder.find_shortest_path_astar(
                    origin_node_id, exit_node_id, mode="FASTEST", base_speed=base_walking_speed
                )
                
                if path_obj:
                    evacuation_routes_pool.append({
                        "origin": origin,
                        "exit": exit_obj,
                        "path_obj": path_obj,
                        "distance": path_obj["total_distance"],
                        "walking_time": path_obj["total_time_seconds"],
                        "score": path_obj["total_time_seconds"] + (0.0 if origin["is_epicenter"] else 15.0)
                    })

        if not evacuation_routes_pool:
            # Network isolated / trapped
            failed_sim = Simulation(
                scenario_id=scenario.id if scenario else None,
                people_count=people_count,
                simulation_mode=sim_mode,
                estimated_evacuation_time=0.0,
                max_congestion="CRITICAL",
                bottleneck_count=1,
                successfully_assigned=0,
                unassigned_people=people_count,
                evacuation_progress_percentage=0.0,
                status="FAILED",
                timeline_steps=json.dumps([]),
                bottlenecks_summary=json.dumps([{
                    "location": "Emergency Origin Area",
                    "congestion": "CRITICAL",
                    "utilization": 100.0,
                    "affected_people": people_count,
                    "reason": "All pathways connecting the emergency location to exits are completely blocked."
                }]),
                exit_utilization_summary=json.dumps([])
            )
            db.session.add(failed_sim)
            db.session.commit()

            return {
                "success": False,
                "error": "NETWORK_ISOLATED",
                "message": "No safe route is currently available between the emergency location and any exit.",
                "simulation": failed_sim.to_dict()
            }, 400

        # 7. Flow Allocation & Multi-Exit Load Balancing
        # Track remaining exit capacity (throughput capacity)
        exit_allocations = {e.id: {"exit": e, "assigned_people": 0, "capacity": e.capacity * 2} for e in available_exits}
        path_flow_counts = {}  # path_id -> total people traversing
        assigned_results = []
        total_successfully_assigned = 0
        total_unassigned = 0

        for origin in origin_nodes_with_people:
            origin_routes = [r for r in evacuation_routes_pool if r["origin"]["building_id"] == origin["building_id"]]

            if not origin_routes:
                total_unassigned += origin["people"]
                continue

            remaining_origin_people = origin["people"]

            # Compute multi-exit capacity-weighted distribution weights
            total_weight = 0.0
            route_weights = []
            for r in origin_routes:
                exit_id = r["exit"].id
                cap_rem = max(0, exit_allocations[exit_id]["capacity"] - exit_allocations[exit_id]["assigned_people"])
                dist_factor = max(10.0, r["distance"]) ** 0.5
                w = (cap_rem / dist_factor) if cap_rem > 0 else 0.0
                route_weights.append(w)
                total_weight += w

            # Proportional allocation across candidate exits
            for i, r in enumerate(origin_routes):
                if remaining_origin_people <= 0:
                    break

                exit_id = r["exit"].id
                cap_rem = max(0, exit_allocations[exit_id]["capacity"] - exit_allocations[exit_id]["assigned_people"])
                if cap_rem <= 0:
                    continue

                if total_weight > 0 and i < len(origin_routes) - 1:
                    target_alloc = int(round(origin["people"] * (route_weights[i] / total_weight)))
                    allocation = min(remaining_origin_people, min(target_alloc, cap_rem))
                else:
                    allocation = min(remaining_origin_people, cap_rem)

                if allocation <= 0:
                    continue

                exit_allocations[exit_id]["assigned_people"] += allocation
                remaining_origin_people -= allocation
                total_successfully_assigned += allocation

                # Record path flows
                for pid in r["path_obj"]["path_ids"]:
                    path_flow_counts[pid] = path_flow_counts.get(pid, 0) + allocation

                assigned_results.append({
                    "start_location_id": origin["building_id"],
                    "start_location_name": origin["building_name"],
                    "exit_id": exit_id,
                    "exit_name": r["exit"].name,
                    "route_nodes": r["path_obj"]["nodes"],
                    "path_ids": r["path_obj"]["path_ids"],
                    "people_assigned": allocation,
                    "distance": r["distance"],
                    "estimated_time": r["walking_time"],
                    "congestion": "LOW", # Will be computed in next step
                    "utilization": 0.0
                })

            if remaining_origin_people > 0:
                total_unassigned += remaining_origin_people

        # 8. Path Congestion & Bottleneck Detection
        bottlenecks = []
        max_congestion_level = "LOW"
        congestion_rank = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        inv_rank = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}
        paths_by_id = {p.id: p for p in paths}

        for res in assigned_results:
            # Compute path utilizations along route
            route_utilizations = []
            route_congestions = []

            for pid in res["path_ids"]:
                p_obj = paths_by_id.get(pid)
                cap = max(1, p_obj.capacity if p_obj else 150)
                flow = path_flow_counts.get(pid, 0)
                util = round((flow / cap) * 100.0, 1)
                route_utilizations.append(util)

                if util <= 40.0:
                    c_lvl = "LOW"
                elif util <= 70.0:
                    c_lvl = "MEDIUM"
                elif util <= 90.0:
                    c_lvl = "HIGH"
                else:
                    c_lvl = "CRITICAL"

                route_congestions.append(c_lvl)

                if congestion_rank[c_lvl] > congestion_rank[max_congestion_level]:
                    max_congestion_level = c_lvl

                # Flag bottleneck if utilization >= 85% or HIGH/CRITICAL
                if util >= 85.0:
                    existing = next((b for b in bottlenecks if b["path_id"] == pid), None)
                    if not existing:
                        bottlenecks.append({
                            "path_id": pid,
                            "location": f"Corridor #{pid} ({p_obj.source_node.name if p_obj else 'Src'} -> {p_obj.destination_node.name if p_obj else 'Dst'})",
                            "capacity": cap,
                            "assigned_flow": flow,
                            "utilization": util,
                            "congestion": c_lvl,
                            "affected_people": flow,
                            "severity": "CRITICAL" if util > 100 else ("HIGH" if util >= 90 else "MEDIUM")
                        })

            res["utilization"] = max(route_utilizations) if route_utilizations else 0.0
            res["congestion"] = max(route_congestions, key=lambda c: congestion_rank.get(c, 1)) if route_congestions else "LOW"

        # Sort bottlenecks by utilization severity
        bottlenecks.sort(key=lambda b: (b["utilization"], b["affected_people"]), reverse=True)

        # 9. Estimated Simulation Evacuation Time
        # Time = Max Route Walking Time + Exit Queue Clearance Time
        max_evac_time = 0.0
        for res in assigned_results:
            walking_sec = res["estimated_time"]
            exit_obj = next((e for e in available_exits if e.id == res["exit_id"]), None)
            exit_cap_per_sec = max(1.0, (exit_obj.capacity if exit_obj else 500) / 60.0)
            exit_clearance_sec = res["people_assigned"] / exit_cap_per_sec
            
            route_total_sec = walking_sec + exit_clearance_sec
            if route_total_sec > max_evac_time:
                max_evac_time = route_total_sec

        max_evac_time = max(30.0, round(max_evac_time, 1))

        # 10. Exit Utilization Summary
        exit_summary = []
        for e in available_exits:
            assigned = exit_allocations[e.id]["assigned_people"]
            cap = exit_allocations[e.id]["capacity"]
            util_pct = round((assigned / max(1, cap)) * 100.0, 1)
            exit_summary.append({
                "exit_id": e.id,
                "exit_name": e.name,
                "capacity": e.capacity,
                "assigned_people": assigned,
                "utilization_percentage": util_pct,
                "status": e.status
            })

        # 11. Discrete Time-Step Simulation Timeline (for Visual Playback)
        total_people = max(1, total_successfully_assigned + total_unassigned)
        num_steps = 10
        timeline_steps = []
        
        for step_idx in range(num_steps + 1):
            t_frac = step_idx / num_steps
            cur_time_sec = round(max_evac_time * t_frac, 1)
            
            # S-curve / sigmoid pedestrian exit progress
            if t_frac <= 0.2:
                prog_frac = t_frac * 0.5  # Initial movement
            elif t_frac <= 0.8:
                prog_frac = 0.10 + (t_frac - 0.2) * 1.25  # Bulk evacuation
            else:
                prog_frac = 0.85 + (t_frac - 0.8) * 0.75  # Final clearance
            
            prog_frac = min(1.0, max(0.0, prog_frac))
            evacuated_count = int(total_successfully_assigned * prog_frac)
            remaining_count = max(0, total_people - evacuated_count)
            progress_pct = round((evacuated_count / total_people) * 100.0, 1)

            timeline_steps.append({
                "step": step_idx,
                "time_seconds": cur_time_sec,
                "display_time": f"{int(cur_time_sec // 60)}m {int(cur_time_sec % 60):02d}s",
                "evacuated": evacuated_count,
                "remaining": remaining_count,
                "progress_percentage": progress_pct,
                "active_routes_count": len(assigned_results) if step_idx < num_steps else 0
            })

        progress_overall = round((total_successfully_assigned / total_people) * 100.0, 1)
        sim_status = "COMPLETED" if total_unassigned == 0 else "PARTIAL"

        # 12. Persist Simulation Execution in Database
        sim_record = Simulation(
            scenario_id=scenario.id if scenario else None,
            people_count=total_people,
            simulation_mode=sim_mode,
            estimated_evacuation_time=max_evac_time,
            max_congestion=max_congestion_level,
            bottleneck_count=len(bottlenecks),
            successfully_assigned=total_successfully_assigned,
            unassigned_people=total_unassigned,
            evacuation_progress_percentage=progress_overall,
            status=sim_status,
            timeline_steps=json.dumps(timeline_steps),
            bottlenecks_summary=json.dumps(bottlenecks),
            exit_utilization_summary=json.dumps(exit_summary)
        )
        db.session.add(sim_record)
        db.session.flush()

        # Persist detailed route records
        for res in assigned_results:
            sr = SimulationResult(
                simulation_id=sim_record.id,
                start_location_id=res["start_location_id"],
                start_location_name=res["start_location_name"],
                exit_id=res["exit_id"],
                exit_name=res["exit_name"],
                route_nodes=json.dumps(res["route_nodes"]),
                path_ids=json.dumps(res["path_ids"]),
                people_assigned=res["people_assigned"],
                distance=res["distance"],
                estimated_time=res["estimated_time"],
                congestion=res["congestion"],
                utilization=res["utilization"]
            )
            db.session.add(sr)

        db.session.commit()

        return {
            "success": True,
            "message": f"Evacuation simulation completed ({sim_status}). Estimated clearance time: {sim_record.to_dict()['estimated_time_formatted']}.",
            "simulation": sim_record.to_dict(),
            "results": [r.to_dict() for r in sim_record.results],
            "bottlenecks": bottlenecks,
            "exit_utilization": exit_summary,
            "timeline_steps": timeline_steps
        }, 200
