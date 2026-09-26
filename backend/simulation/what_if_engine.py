"""
What-If Scenario Simulation & Comparative Optimization Engine (Phase 8)
========================================================================
Executes isolated hypothetical What-If campus scenarios without modifying persistent
database records. Answers questions like:
- "What if Exit 1 and Exit 2 are blocked?"
- "What if a major arterial path is blocked?"
- "What if the crowd in the Academic Block increases by 50%?"
- "What if multiple failures occur during peak hours?"

Calculates mathematical baseline vs. scenario comparisons, multi-exit flow reallocations,
corridor bottleneck evolutions, and Explainable AI impact audits.

Academic Project Notice:
Simulation-based evacuation recommendation — For Academic Demonstration.
"""

import json
import copy
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple

from backend.extensions import db
from backend.models.campus import Building, Node, Path, Exit
from backend.models.crowd import CrowdData
from backend.models.emergency import EmergencyScenario, Simulation
from backend.models.optimization import OptimizationResult
from backend.models.what_if import WhatIfScenario
from backend.simulation.evacuation_simulation import EvacuationSimulator
from backend.optimization.evacuation_optimizer import EvacuationOptimizer
from backend.services.crowd_prediction_service import CrowdPredictionService


class WhatIfEngine:
    ACADEMIC_DISCLAIMER = "Simulation-based evacuation recommendation — For Academic Demonstration"
    
    ALLOWED_SCENARIO_TYPES = [
        'EXIT_BLOCKED',
        'PATH_BLOCKED',
        'CROWD_INCREASE',
        'CROWD_DECREASE',
        'CROWD_OVERRIDE',
        'MULTIPLE_FAILURES',
        'PEAK_HOUR'
    ]

    @classmethod
    def run_what_if_analysis(cls, scenario_id: Optional[int] = None,
                             custom_params: Optional[Dict[str, Any]] = None,
                             user_id: Optional[int] = None) -> Tuple[Dict[str, Any], int]:
        """
        Executes a complete isolated What-If scenario analysis:
        1. Ingests and validates scenario parameters.
        2. Computes / extracts ground-truth baseline (Phase 6 & 7).
        3. Constructs isolated in-memory modified campus state.
        4. Runs discrete evacuation simulation (Phase 6).
        5. Runs capacity-aware flow optimization (Phase 7).
        6. Computes mathematical delta comparison metrics.
        7. Generates explainable AI shift rationale statements.
        8. Persists and returns WhatIfScenario result.
        """
        scenario_record = None
        if scenario_id:
            scenario_record = db.session.get(WhatIfScenario, int(scenario_id))
            if not scenario_record:
                return {"success": False, "message": f"What-If Scenario #{scenario_id} not found."}, 404

        params = custom_params or (scenario_record.get_parameters() if scenario_record else {})
        scenario_name = params.get('name') or (scenario_record.name if scenario_record else "Hypothetical Contingency Scenario")
        scenario_type = (params.get('scenario_type') or (scenario_record.scenario_type if scenario_record else 'MULTIPLE_FAILURES')).upper()
        description = params.get('description') or (scenario_record.description if scenario_record else "")
        base_scenario_id = params.get('base_scenario_id') or (scenario_record.base_scenario_id if scenario_record else None)
        base_simulation_id = params.get('base_simulation_id') or (scenario_record.base_simulation_id if scenario_record else None)

        if scenario_type not in cls.ALLOWED_SCENARIO_TYPES:
            return {
                "success": False,
                "message": f"Invalid scenario type '{scenario_type}'. Allowed: {', '.join(cls.ALLOWED_SCENARIO_TYPES)}"
            }, 400

        # 1. Ingest Campus Topology (Read-only verification)
        nodes = Node.query.all()
        paths = Path.query.all()
        buildings = Building.query.all()
        exits = Exit.query.all()

        if not nodes or not paths or not exits:
            return {"success": False, "message": "Campus topology graph is incomplete or unseeded."}, 400

        valid_node_ids = {n.id for n in nodes}
        valid_path_ids = {p.id for p in paths}
        valid_exit_ids = {e.id for e in exits}
        valid_building_ids = {b.id for b in buildings}

        # 2. Resolve Base Emergency Context
        base_scenario = None
        if base_scenario_id:
            base_scenario = db.session.get(EmergencyScenario, int(base_scenario_id))
        elif base_simulation_id:
            base_sim_obj = db.session.get(Simulation, int(base_simulation_id))
            if base_sim_obj:
                base_scenario = base_sim_obj.scenario

        if not base_scenario:
            from backend.services.emergency_service import EmergencyService
            EmergencyService.seed_default_scenarios_if_empty()
            base_scenario = EmergencyScenario.query.first()
            if base_scenario:
                base_scenario_id = base_scenario.id

        base_blocked_paths = set(base_scenario.get_blocked_path_ids() if base_scenario else [])
        base_disabled_exits = set(base_scenario.get_disabled_exit_ids() if base_scenario else [])
        base_people_count = base_scenario.affected_people_count if base_scenario else 500
        epicenter_loc_id = base_scenario.emergency_location_id if base_scenario else (buildings[0].id if buildings else 1)
        epicenter_node_id = base_scenario.emergency_node_id if base_scenario else (buildings[0].node_id if buildings else 1)

        # 3. Parse and Validate Hypothetical What-If Modifications
        hypothetical_blocked_exits = set()
        hypothetical_blocked_paths = set()
        crowd_adjustments: Dict[int, int] = {}  # building_id -> absolute crowd count

        # Extract explicit parameter fields
        raw_blocked_exits = params.get('blocked_exit_ids') or []
        raw_blocked_paths = params.get('blocked_path_ids') or []
        crowd_pct = float(params.get('percentage', 0.0))
        target_loc_id = params.get('location_id')
        target_crowd_val = params.get('crowd_count')
        crowd_mods = params.get('crowd_modifications') or []

        # Validate blocked exits
        for eid in raw_blocked_exits:
            try:
                eid_int = int(eid)
                if eid_int in valid_exit_ids:
                    hypothetical_blocked_exits.add(eid_int)
            except (ValueError, TypeError):
                pass

        # Validate blocked paths
        for pid in raw_blocked_paths:
            try:
                pid_int = int(pid)
                if pid_int in valid_path_ids:
                    hypothetical_blocked_paths.add(pid_int)
            except (ValueError, TypeError):
                pass

        # Ingest baseline crowd distribution for buildings
        base_crowd_distribution: Dict[int, int] = {}
        for b in buildings:
            latest = CrowdData.query.filter_by(location_id=b.id).order_by(CrowdData.timestamp.desc()).first()
            base_crowd_distribution[b.id] = latest.crowd_count if latest else int(b.capacity * 0.35)

        if epicenter_loc_id and epicenter_loc_id in base_crowd_distribution:
            base_crowd_distribution[epicenter_loc_id] = max(base_people_count, base_crowd_distribution[epicenter_loc_id])

        what_if_crowd_distribution = copy.deepcopy(base_crowd_distribution)

        # Apply specific scenario type transformations
        if scenario_type == 'EXIT_BLOCKED':
            if not hypothetical_blocked_exits:
                # Default to blocking first exit if none specified
                hypothetical_blocked_exits.add(exits[0].id)

        elif scenario_type == 'PATH_BLOCKED':
            if not hypothetical_blocked_paths:
                # Default to blocking first path if none specified
                hypothetical_blocked_paths.add(paths[0].id)

        elif scenario_type == 'CROWD_INCREASE':
            pct = max(1.0, crowd_pct if crowd_pct > 0 else 30.0)
            loc = int(target_loc_id) if target_loc_id and int(target_loc_id) in valid_building_ids else epicenter_loc_id
            curr = what_if_crowd_distribution.get(loc, 300)
            what_if_crowd_distribution[loc] = int(round(curr * (1.0 + pct / 100.0)))

        elif scenario_type == 'CROWD_DECREASE':
            pct = min(90.0, max(1.0, crowd_pct if crowd_pct > 0 else 20.0))
            loc = int(target_loc_id) if target_loc_id and int(target_loc_id) in valid_building_ids else epicenter_loc_id
            curr = what_if_crowd_distribution.get(loc, 300)
            what_if_crowd_distribution[loc] = max(10, int(round(curr * (1.0 - pct / 100.0))))

        elif scenario_type == 'CROWD_OVERRIDE':
            val = max(0, int(target_crowd_val) if target_crowd_val is not None else 750)
            loc = int(target_loc_id) if target_loc_id and int(target_loc_id) in valid_building_ids else epicenter_loc_id
            what_if_crowd_distribution[loc] = val

        elif scenario_type == 'PEAK_HOUR':
            # Apply peak factor (+40% to academic/library hubs, +25% general)
            for b in buildings:
                b_type = getattr(b, 'type', 'ACADEMIC')
                factor = 1.45 if b_type in ['ACADEMIC', 'LIBRARY', 'CANTEEN'] else 1.25
                what_if_crowd_distribution[b.id] = int(round(what_if_crowd_distribution[b.id] * factor))

        elif scenario_type == 'MULTIPLE_FAILURES':
            # Ingest multiple crowd modifications if provided
            for mod in crowd_mods:
                m_loc = int(mod.get('location_id', 0))
                if m_loc in valid_building_ids:
                    m_mode = mod.get('mode', 'INCREASE')
                    m_val = float(mod.get('value', 20.0))
                    curr = what_if_crowd_distribution.get(m_loc, 250)
                    if m_mode == 'INCREASE':
                        what_if_crowd_distribution[m_loc] = int(round(curr * (1.0 + m_val / 100.0)))
                    elif m_mode == 'DECREASE':
                        what_if_crowd_distribution[m_loc] = max(10, int(round(curr * (1.0 - m_val / 100.0))))
                    elif m_mode == 'OVERRIDE':
                        what_if_crowd_distribution[m_loc] = max(0, int(m_val))

        # Check if all exits would be blocked
        effective_disabled_exits = base_disabled_exits.union(hypothetical_blocked_exits)
        effective_blocked_paths = base_blocked_paths.union(hypothetical_blocked_paths)

        if len(effective_disabled_exits) >= len(exits):
            return {
                "success": False,
                "error": "ALL_EXITS_BLOCKED",
                "message": "All campus evacuation exits are marked disabled under this scenario. At least one exit must remain operational."
            }, 400

        # 4. Compute Ground-Truth Baseline (Phase 6 & 7 on Unmodified Base Scenario)
        baseline_sim_res, _ = EvacuationSimulator.run_simulation(
            scenario_id=base_scenario.id if base_scenario else None,
            custom_params={
                "name": f"Baseline - {scenario_name}",
                "emergency_location_id": epicenter_loc_id,
                "emergency_node_id": epicenter_node_id,
                "people_count": base_people_count,
                "blocked_path_ids": list(base_blocked_paths),
                "disabled_exit_ids": list(base_disabled_exits),
                "crowd_distribution": base_crowd_distribution
            }
        )

        baseline_opt_res, _ = EvacuationOptimizer.run_optimization(
            scenario_id=base_scenario.id if base_scenario else None,
            custom_params={
                "name": f"Baseline - {scenario_name}",
                "emergency_location_id": epicenter_loc_id,
                "emergency_node_id": epicenter_node_id,
                "people_count": base_people_count,
                "blocked_path_ids": list(base_blocked_paths),
                "disabled_exit_ids": list(base_disabled_exits),
                "crowd_distribution": base_crowd_distribution
            }
        )

        b_sim_data = baseline_sim_res.get("simulation", {})
        b_opt_data = baseline_opt_res.get("data", {})
        b_plan_opt = b_opt_data.get("optimized", {})

        baseline_metrics = {
            "evacuation_time_sec": b_plan_opt.get("evacuation_time_sec", b_sim_data.get("estimated_evacuation_time", 180.0)),
            "max_congestion": b_plan_opt.get("max_congestion", b_sim_data.get("max_congestion", "MEDIUM")),
            "avg_utilization_percentage": b_plan_opt.get("avg_utilization_percentage", 55.0),
            "total_distance_meters": b_plan_opt.get("total_distance_meters", 320.0),
            "evacuated_people": b_sim_data.get("successfully_assigned", base_people_count),
            "unassigned_people": b_plan_opt.get("unassigned_people", b_sim_data.get("unassigned_people", 0)),
            "bottlenecks_count": b_plan_opt.get("bottlenecks_count", len(baseline_sim_res.get("bottlenecks", []))),
            "objective_score": b_plan_opt.get("objective_score", 1.25),
            "exits": b_plan_opt.get("exits", baseline_sim_res.get("exit_utilization", [])),
            "bottlenecks": b_plan_opt.get("bottlenecks", baseline_sim_res.get("bottlenecks", [])),
            "routes": b_plan_opt.get("routes", [])
        }

        # 5. Execute Phase 6 Simulation & Phase 7 Optimization on Isolated What-If State
        scenario_people_count = sum(what_if_crowd_distribution.values()) if what_if_crowd_distribution else base_people_count

        what_if_sim_res, sim_code = EvacuationSimulator.run_simulation(
            custom_params={
                "name": f"What-If: {scenario_name}",
                "emergency_location_id": epicenter_loc_id,
                "emergency_node_id": epicenter_node_id,
                "people_count": scenario_people_count,
                "blocked_path_ids": list(effective_blocked_paths),
                "disabled_exit_ids": list(effective_disabled_exits),
                "crowd_distribution": what_if_crowd_distribution
            }
        )

        what_if_opt_res, opt_code = EvacuationOptimizer.run_optimization(
            custom_params={
                "name": f"What-If: {scenario_name}",
                "emergency_location_id": epicenter_loc_id,
                "emergency_node_id": epicenter_node_id,
                "people_count": scenario_people_count,
                "blocked_path_ids": list(effective_blocked_paths),
                "disabled_exit_ids": list(effective_disabled_exits),
                "crowd_distribution": what_if_crowd_distribution
            }
        )

        if not what_if_opt_res.get("success"):
            return {
                "success": False,
                "error": what_if_opt_res.get("error", "SIMULATION_FAILED"),
                "message": what_if_opt_res.get("message", "What-If optimization could not complete with the provided constraints.")
            }, 400

        s_sim_data = what_if_sim_res.get("simulation", {})
        s_opt_data = what_if_opt_res.get("data", {})
        s_plan_opt = s_opt_data.get("optimized", {})

        scenario_metrics = {
            "evacuation_time_sec": s_plan_opt.get("evacuation_time_sec", s_sim_data.get("estimated_evacuation_time", 210.0)),
            "max_congestion": s_plan_opt.get("max_congestion", s_sim_data.get("max_congestion", "HIGH")),
            "avg_utilization_percentage": s_plan_opt.get("avg_utilization_percentage", 65.0),
            "total_distance_meters": s_plan_opt.get("total_distance_meters", 350.0),
            "evacuated_people": s_sim_data.get("successfully_assigned", scenario_people_count),
            "unassigned_people": s_plan_opt.get("unassigned_people", s_sim_data.get("unassigned_people", 0)),
            "bottlenecks_count": s_plan_opt.get("bottlenecks_count", len(what_if_sim_res.get("bottlenecks", []))),
            "objective_score": s_plan_opt.get("objective_score", 1.45),
            "exits": s_plan_opt.get("exits", what_if_sim_res.get("exit_utilization", [])),
            "bottlenecks": s_plan_opt.get("bottlenecks", what_if_sim_res.get("bottlenecks", [])),
            "routes": s_plan_opt.get("routes", [])
        }

        # 6. Calculate Mathematical Comparison Deltas & Percentage Changes
        # Formula: ((Scenario - Baseline) / Baseline) * 100
        b_t = baseline_metrics["evacuation_time_sec"]
        s_t = scenario_metrics["evacuation_time_sec"]
        time_diff = round(s_t - b_t, 1)
        time_pct = round(((s_t - b_t) / b_t * 100.0), 1) if b_t > 0 else 0.0

        b_u = baseline_metrics["avg_utilization_percentage"]
        s_u = scenario_metrics["avg_utilization_percentage"]
        cong_diff = round(s_u - b_u, 1)
        cong_pct = round(((s_u - b_u) / b_u * 100.0), 1) if b_u > 0 else 0.0

        b_d = baseline_metrics["total_distance_meters"]
        s_d = scenario_metrics["total_distance_meters"]
        dist_diff = round(s_d - b_d, 1)
        dist_pct = round(((s_d - b_d) / b_d * 100.0), 1) if b_d > 0 else 0.0

        b_un = baseline_metrics["unassigned_people"]
        s_un = scenario_metrics["unassigned_people"]
        unassigned_diff = s_un - b_un
        unassigned_pct = round(((s_un - b_un) / max(1, b_un) * 100.0), 1) if b_un > 0 else (100.0 if s_un > 0 else 0.0)

        b_btnk = baseline_metrics["bottlenecks_count"]
        s_btnk = scenario_metrics["bottlenecks_count"]
        btnk_diff = s_btnk - b_btnk

        b_score = baseline_metrics["objective_score"]
        s_score = scenario_metrics["objective_score"]
        score_diff = round(s_score - b_score, 4)
        score_pct = round(((s_score - b_score) / b_score * 100.0), 1) if b_score > 0 else 0.0

        comparison = {
            "time_difference_sec": time_diff,
            "time_change_percentage": time_pct,
            "time_impact": "INCREASED" if time_diff > 0 else ("DECREASED" if time_diff < 0 else "UNCHANGED"),
            "congestion_difference_percentage": cong_diff,
            "congestion_change_percentage": cong_pct,
            "congestion_impact": "INCREASED" if cong_diff > 0 else ("DECREASED" if cong_diff < 0 else "UNCHANGED"),
            "distance_difference_meters": dist_diff,
            "distance_change_percentage": dist_pct,
            "distance_impact": "INCREASED" if dist_diff > 0 else ("DECREASED" if dist_diff < 0 else "UNCHANGED"),
            "unassigned_difference": unassigned_diff,
            "unassigned_change_percentage": unassigned_pct,
            "bottlenecks_difference": btnk_diff,
            "objective_score_difference": score_diff,
            "objective_score_change_percentage": score_pct
        }

        # 7. Generate Explainable AI Shift Analysis Statements
        explanations = cls._generate_explainable_ai_impacts(
            scenario_type=scenario_type,
            blocked_exits=hypothetical_blocked_exits,
            blocked_paths=hypothetical_blocked_paths,
            crowd_mods=what_if_crowd_distribution,
            base_crowd=base_crowd_distribution,
            baseline_metrics=baseline_metrics,
            scenario_metrics=scenario_metrics,
            comparison=comparison,
            exits_list=exits,
            paths_list=paths
        )

        # 8. Persist or Update WhatIfScenario Record
        saved_params = {
            "name": scenario_name,
            "scenario_type": scenario_type,
            "description": description,
            "base_scenario_id": base_scenario_id,
            "base_simulation_id": base_simulation_id,
            "blocked_exit_ids": list(hypothetical_blocked_exits),
            "blocked_path_ids": list(hypothetical_blocked_paths),
            "percentage": crowd_pct,
            "location_id": target_loc_id,
            "crowd_count": target_crowd_val,
            "crowd_modifications": crowd_mods
        }

        if not scenario_record:
            scenario_record = WhatIfScenario(
                name=scenario_name,
                description=description,
                base_simulation_id=base_simulation_id,
                base_scenario_id=base_scenario_id,
                scenario_type=scenario_type,
                parameters=json.dumps(saved_params),
                baseline_metrics=json.dumps(baseline_metrics),
                scenario_metrics=json.dumps(scenario_metrics),
                comparison=json.dumps(comparison),
                simulation_result=json.dumps(what_if_sim_res),
                optimization_result=json.dumps(s_opt_data),
                explanations=json.dumps(explanations),
                status='COMPLETED',
                created_by=user_id,
                completed_at=datetime.now(timezone.utc)
            )
            db.session.add(scenario_record)
        else:
            scenario_record.name = scenario_name
            scenario_record.description = description
            scenario_record.scenario_type = scenario_type
            scenario_record.parameters = json.dumps(saved_params)
            scenario_record.baseline_metrics = json.dumps(baseline_metrics)
            scenario_record.scenario_metrics = json.dumps(scenario_metrics)
            scenario_record.comparison = json.dumps(comparison)
            scenario_record.simulation_result = json.dumps(what_if_sim_res)
            scenario_record.optimization_result = json.dumps(s_opt_data)
            scenario_record.explanations = json.dumps(explanations)
            scenario_record.status = 'COMPLETED'
            scenario_record.completed_at = datetime.now(timezone.utc)

        db.session.commit()

        return {
            "success": True,
            "message": f"What-If scenario '{scenario_name}' analyzed successfully. Evacuation time shifted by {time_diff}s ({time_pct}%).",
            "data": scenario_record.to_dict()
        }, 200

    @classmethod
    def _generate_explainable_ai_impacts(cls, scenario_type: str,
                                        blocked_exits: set,
                                        blocked_paths: set,
                                        crowd_mods: Dict[int, int],
                                        base_crowd: Dict[int, int],
                                        baseline_metrics: Dict[str, Any],
                                        scenario_metrics: Dict[str, Any],
                                        comparison: Dict[str, Any],
                                        exits_list: List[Exit],
                                        paths_list: List[Path]) -> List[Dict[str, Any]]:
        """
        Generates mathematically grounded algorithmic explanation statements for why evacuation metrics changed.
        """
        explanations: List[Dict[str, Any]] = []
        step = 1

        # 1. Exit Reallocation Analysis
        if blocked_exits:
            exit_names = [e.name for e in exits_list if e.id in blocked_exits]
            surviving_exits = [e for e in exits_list if e.id not in blocked_exits]
            
            # Find which surviving exit took the largest burden
            b_exit_loads = {e["exit_id"]: e.get("assigned_people", 0) for e in baseline_metrics.get("exits", [])}
            s_exit_loads = {e["exit_id"]: e.get("assigned_people", 0) for e in scenario_metrics.get("exits", [])}

            top_spillover_exit = None
            max_spillover = 0
            for eid, load in s_exit_loads.items():
                prev = b_exit_loads.get(eid, 0)
                gain = load - prev
                if gain > max_spillover:
                    max_spillover = gain
                    top_spillover_exit = next((e.name for e in exits_list if e.id == eid), f"Exit #{eid}")

            explanations.append({
                "step": step,
                "category": "EXIT_DIVERSION",
                "finding": f"Disabling {', '.join(exit_names)} removed direct egress discharge capacity.",
                "mechanism": f"Rerouted flow shifted a net +{max_spillover} evacuees to {top_spillover_exit or 'surviving gates'}, increasing queue clearance latency.",
                "quantified_impact": f"Evacuation time changed by {comparison['time_difference_sec']}s ({comparison['time_change_percentage']}%)."
            })
            step += 1

        # 2. Corridor Bottleneck & Path Diversion Analysis
        if blocked_paths:
            path_strs = [f"Corridor #{pid}" for pid in blocked_paths]
            new_btnks = scenario_metrics.get("bottlenecks_count", 0) - baseline_metrics.get("bottlenecks_count", 0)
            explanations.append({
                "step": step,
                "category": "PATH_CLOSURE",
                "finding": f"Blocked arterial paths ({', '.join(path_strs)}) forced pathfinder diversion to secondary bypasses.",
                "mechanism": f"Sub-optimal bypass paths increased average transit distance by {comparison['distance_difference_meters']}m and formed {max(0, new_btnks)} new bottleneck points.",
                "quantified_impact": f"Average network corridor congestion shifted by {comparison['congestion_difference_percentage']}%."
            })
            step += 1

        # 3. Crowd Surge / Density Modification Analysis
        crowd_diff = sum(crowd_mods.values()) - sum(base_crowd.values())
        if abs(crowd_diff) > 20:
            direction = "increase" if crowd_diff > 0 else "reduction"
            explanations.append({
                "step": step,
                "category": "POPULATION_SURGE",
                "finding": f"Campus population {direction} of {abs(crowd_diff)} individuals ({scenario_type}) directly altered initial density.",
                "mechanism": f"Pedestrian density adjustments modified effective walking velocities (Weidmann's flow model) and exit gate discharge queues.",
                "quantified_impact": f"Peak network load reached {scenario_metrics.get('avg_utilization_percentage', 0)}% (Δ {comparison['congestion_difference_percentage']}%)."
            })
            step += 1

        # 4. Optimization Engine Mitigation Audit
        opt_routes = scenario_metrics.get("routes", [])
        if opt_routes:
            explanations.append({
                "step": step,
                "category": "OPTIMIZATION_MITIGATION",
                "finding": "Min-Cost Gradient Flow Optimizer balanced multi-exit allocations across surviving perimeter gates.",
                "mechanism": f"Flow redistribution split evacuees across {len(opt_routes)} distinct corridors to minimize exit queue backlogs.",
                "quantified_impact": f"Optimization score achieved {scenario_metrics.get('objective_score', 0)} (Δ {comparison['objective_score_change_percentage']}% score impact)."
            })
            step += 1

        return explanations

    @classmethod
    def compare_multiple_scenarios(cls, scenario_ids: List[int]) -> Tuple[Dict[str, Any], int]:
        """
        Retrieves and constructs a multi-scenario research comparison matrix against baseline.
        """
        if not scenario_ids or not isinstance(scenario_ids, list):
            return {"success": False, "message": "List of scenario IDs is required for comparison."}, 400

        scenarios = WhatIfScenario.query.filter(WhatIfScenario.id.in_(scenario_ids)).all()
        if not scenarios:
            return {"success": False, "message": "No matching What-If scenarios found."}, 404

        # Extract baseline from first scenario
        first_sc = scenarios[0]
        baseline = first_sc.get_baseline_metrics()

        matrix: List[Dict[str, Any]] = [
            {
                "id": "baseline",
                "name": "Ground-Truth Baseline",
                "scenario_type": "BASELINE",
                "evacuation_time_sec": baseline.get("evacuation_time_sec", 0),
                "max_congestion": baseline.get("max_congestion", "LOW"),
                "avg_utilization_percentage": baseline.get("avg_utilization_percentage", 0),
                "total_distance_meters": baseline.get("total_distance_meters", 0),
                "unassigned_people": baseline.get("unassigned_people", 0),
                "bottlenecks_count": baseline.get("bottlenecks_count", 0),
                "objective_score": baseline.get("objective_score", 0),
                "time_change_percentage": 0.0,
                "congestion_change_percentage": 0.0,
                "distance_change_percentage": 0.0
            }
        ]

        for sc in scenarios:
            s_m = sc.get_scenario_metrics()
            c_m = sc.get_comparison()
            matrix.append({
                "id": sc.id,
                "name": sc.name,
                "scenario_type": sc.scenario_type,
                "evacuation_time_sec": s_m.get("evacuation_time_sec", 0),
                "max_congestion": s_m.get("max_congestion", "LOW"),
                "avg_utilization_percentage": s_m.get("avg_utilization_percentage", 0),
                "total_distance_meters": s_m.get("total_distance_meters", 0),
                "unassigned_people": s_m.get("unassigned_people", 0),
                "bottlenecks_count": s_m.get("bottlenecks_count", 0),
                "objective_score": s_m.get("objective_score", 0),
                "time_change_percentage": c_m.get("time_change_percentage", 0.0),
                "congestion_change_percentage": c_m.get("congestion_change_percentage", 0.0),
                "distance_change_percentage": c_m.get("distance_change_percentage", 0.0),
                "explanations": sc.get_explanations()
            })

        return {
            "success": True,
            "message": f"Multi-scenario comparative analysis generated for {len(scenarios)} scenarios.",
            "data": {
                "scenarios_count": len(scenarios),
                "comparison_matrix": matrix
            }
        }, 200
