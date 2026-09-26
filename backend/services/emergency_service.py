"""
Emergency Management Service
============================
Coordinates emergency scenario lifecycle (creation, activation, termination),
historical simulation query tracking, and What-If contingency re-evaluations.
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy import desc

from backend.extensions import db
from backend.models.campus import Building, Node, Path, Exit
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.models.crowd import SystemAlert
from backend.simulation.evacuation_simulation import EvacuationSimulator


class EmergencyService:
    @staticmethod
    def seed_default_scenarios_if_empty():
        """Auto-seeds default scenarios if none exist in the database."""
        if EmergencyScenario.query.count() > 0:
            return
        
        buildings = Building.query.all()
        if not buildings:
            return

        b1 = buildings[0]
        b2 = buildings[1] if len(buildings) > 1 else b1
        b3 = buildings[2] if len(buildings) > 2 else b1

        sc1 = EmergencyScenario(
            name="Main Science Complex Chemical Fire",
            emergency_type="FIRE",
            emergency_location_id=b1.id,
            emergency_node_id=b1.node_id,
            severity="HIGH",
            description="Hazardous chemical containment fire reported in Laboratory Block. Immediate evacuation required.",
            affected_people_count=450,
            blocked_path_ids=json.dumps([]),
            disabled_exit_ids=json.dumps([]),
            status="CREATED"
        )
        sc2 = EmergencyScenario(
            name="North Academic Quad Earthquake Evacuation",
            emergency_type="EARTHQUAKE",
            emergency_location_id=b2.id,
            emergency_node_id=b2.node_id,
            severity="CRITICAL",
            description="High-magnitude structural seismic tremor. Campus-wide evacuation to open assembly perimeter.",
            affected_people_count=600,
            blocked_path_ids=json.dumps([]),
            disabled_exit_ids=json.dumps([]),
            status="CREATED"
        )
        sc3 = EmergencyScenario(
            name="Central Library Gas Leak Incident",
            emergency_type="GAS_LEAK",
            emergency_location_id=b3.id,
            emergency_node_id=b3.node_id,
            severity="MEDIUM",
            description="Suspected utility pipeline rupture in basement. Evacuate occupants away from central plaza.",
            affected_people_count=350,
            blocked_path_ids=json.dumps([]),
            disabled_exit_ids=json.dumps([]),
            status="CREATED"
        )
        db.session.add_all([sc1, sc2, sc3])
        db.session.commit()

    @staticmethod
    def get_all_scenarios(status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves list of emergency scenarios with optional status filter."""
        EmergencyService.seed_default_scenarios_if_empty()
        query = EmergencyScenario.query
        if status and status != 'ALL':
            query = query.filter_by(status=status.upper())
        scenarios = query.order_by(desc(EmergencyScenario.created_at)).all()
        return [s.to_dict() for s in scenarios]

    @staticmethod
    def get_active_scenario() -> Optional[Dict[str, Any]]:
        """Retrieves the currently active emergency scenario if one exists."""
        scenario = EmergencyScenario.query.filter_by(status='ACTIVE').order_by(desc(EmergencyScenario.started_at)).first()
        return scenario.to_dict() if scenario else None

    @staticmethod
    def get_scenario_by_id(scenario_id: int) -> Optional[EmergencyScenario]:
        """Retrieves an emergency scenario by ID."""
        return db.session.get(EmergencyScenario, int(scenario_id))

    @staticmethod
    def create_scenario(data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """Creates a new emergency evacuation scenario."""
        name = data.get('name', '').strip()
        emergency_type = data.get('emergency_type', 'GENERAL_EVACUATION').strip().upper()
        location_id = data.get('emergency_location_id') or data.get('epicenter_building_id')
        node_id = data.get('emergency_node_id')
        severity = data.get('severity', 'HIGH').strip().upper()
        description = data.get('description', '')
        affected_people = int(data.get('affected_people_count', 500))
        blocked_paths = data.get('blocked_path_ids', [])
        disabled_exits = data.get('disabled_exit_ids', [])

        if not name:
            return {"success": False, "message": "Emergency scenario name is required."}, 400

        allowed_types = ['FIRE', 'EARTHQUAKE', 'FLOOD', 'GAS_LEAK', 'ACTIVE_THREAT', 'POWER_OUTAGE', 'DRILL', 'GENERAL_EVACUATION']
        if emergency_type not in allowed_types:
            return {"success": False, "message": f"Invalid emergency type. Allowed: {', '.join(allowed_types)}"}, 400

        # If location_id provided but not node_id, resolve node_id
        if location_id and not node_id:
            b_obj = db.session.get(Building, int(location_id))
            if b_obj:
                node_id = b_obj.node_id

        new_scenario = EmergencyScenario(
            name=name,
            emergency_type=emergency_type,
            emergency_location_id=int(location_id) if location_id else None,
            emergency_node_id=int(node_id) if node_id else None,
            severity=severity,
            description=description,
            affected_people_count=affected_people,
            blocked_path_ids=json.dumps(blocked_paths),
            disabled_exit_ids=json.dumps(disabled_exits),
            status='CREATED'
        )
        db.session.add(new_scenario)
        db.session.commit()

        return {
            "success": True,
            "message": f"Emergency Scenario '{name}' created successfully.",
            "data": new_scenario.to_dict()
        }, 201

    @staticmethod
    def update_scenario(scenario_id: int, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        scenario = db.session.get(EmergencyScenario, int(scenario_id))
        if not scenario:
            return {"success": False, "message": "Emergency Scenario not found."}, 404

        if 'name' in data and data['name']:
            scenario.name = data['name'].strip()
        if 'emergency_type' in data and data['emergency_type']:
            scenario.emergency_type = data['emergency_type'].strip().upper()
        if 'emergency_location_id' in data:
            scenario.emergency_location_id = int(data['emergency_location_id']) if data['emergency_location_id'] else None
        if 'emergency_node_id' in data:
            scenario.emergency_node_id = int(data['emergency_node_id']) if data['emergency_node_id'] else None
        if 'severity' in data and data['severity']:
            scenario.severity = data['severity'].strip().upper()
        if 'description' in data:
            scenario.description = data['description']
        if 'affected_people_count' in data and data['affected_people_count'] is not None:
            scenario.affected_people_count = int(data['affected_people_count'])
        if 'blocked_path_ids' in data:
            scenario.blocked_path_ids = json.dumps(data['blocked_path_ids'])
        if 'disabled_exit_ids' in data:
            scenario.disabled_exit_ids = json.dumps(data['disabled_exit_ids'])

        db.session.commit()
        return {"success": True, "message": "Scenario updated successfully.", "data": scenario.to_dict()}, 200

    @staticmethod
    def delete_scenario(scenario_id: int) -> Tuple[Dict[str, Any], int]:
        scenario = db.session.get(EmergencyScenario, int(scenario_id))
        if not scenario:
            return {"success": False, "message": "Scenario not found."}, 404

        db.session.delete(scenario)
        db.session.commit()
        return {"success": True, "message": "Emergency Scenario deleted successfully."}, 200

    @staticmethod
    def start_emergency(scenario_id: int) -> Tuple[Dict[str, Any], int]:
        """Activates emergency scenario and triggers critical system alert."""
        scenario = db.session.get(EmergencyScenario, int(scenario_id))
        if not scenario:
            return {"success": False, "message": "Scenario not found."}, 404

        # Deactivate any previously active scenarios
        EmergencyScenario.query.filter_by(status='ACTIVE').update({'status': 'COMPLETED', 'ended_at': datetime.now(timezone.utc)})

        scenario.status = 'ACTIVE'
        scenario.started_at = datetime.now(timezone.utc)
        scenario.ended_at = None

        # Dispatch Emergency Alert
        alert_title = f"EMERGENCY EVACUATION: {scenario.name}"
        alert_msg = f"Active {scenario.emergency_type} declared at {scenario.building.name if scenario.building else 'Campus'}. Proceed immediately to designated emergency exits."
        alert = SystemAlert(
            title=alert_title,
            message=alert_msg,
            alert_type='EMERGENCY',
            severity='DANGER',
            related_location_id=scenario.emergency_location_id,
            is_active=True
        )
        db.session.add(alert)
        db.session.commit()

        # Run initial simulation automatically
        sim_res, _ = EvacuationSimulator.run_simulation(scenario.id)

        return {
            "success": True,
            "message": f"Emergency '{scenario.name}' is now ACTIVE across campus.",
            "data": scenario.to_dict(),
            "simulation": sim_res.get("simulation")
        }, 200

    @staticmethod
    def stop_emergency(scenario_id: int) -> Tuple[Dict[str, Any], int]:
        """Terminates active emergency scenario."""
        scenario = db.session.get(EmergencyScenario, int(scenario_id))
        if not scenario:
            return {"success": False, "message": "Scenario not found."}, 404

        scenario.status = 'COMPLETED'
        scenario.ended_at = datetime.now(timezone.utc)

        # Deactivate active emergency alerts
        SystemAlert.query.filter_by(alert_type='EMERGENCY', is_active=True).update({'is_active': False})
        db.session.commit()

        return {
            "success": True,
            "message": f"Emergency '{scenario.name}' has been terminated.",
            "data": scenario.to_dict()
        }, 200

    @staticmethod
    def get_simulation_by_id(simulation_id: int) -> Tuple[Dict[str, Any], int]:
        sim = db.session.get(Simulation, int(simulation_id))
        if not sim:
            return {"success": False, "message": "Simulation not found."}, 404

        return {
            "success": True,
            "simulation": sim.to_dict(),
            "results": [r.to_dict() for r in sim.results],
            "bottlenecks": sim.get_bottlenecks(),
            "exit_utilization": sim.get_exit_utilization(),
            "timeline_steps": sim.get_timeline_steps()
        }, 200

    @staticmethod
    def get_simulation_history(limit: int = 20) -> List[Dict[str, Any]]:
        sims = Simulation.query.order_by(desc(Simulation.created_at)).limit(limit).all()
        return [s.to_dict() for s in sims]

    @staticmethod
    def what_if_block_exit(scenario_id: int, exit_to_block_id: int) -> Tuple[Dict[str, Any], int]:
        """
        Quick What-If scenario: temporarily disables an exit and recomputes evacuation flow.
        """
        scenario = db.session.get(EmergencyScenario, int(scenario_id))
        if not scenario:
            return {"success": False, "message": "Scenario not found."}, 404

        disabled_exits = list(set(scenario.get_disabled_exit_ids() + [int(exit_to_block_id)]))
        custom_params = {
            "name": f"{scenario.name} (What-If: Exit #{exit_to_block_id} Blocked)",
            "emergency_type": scenario.emergency_type,
            "emergency_location_id": scenario.emergency_location_id,
            "emergency_node_id": scenario.emergency_node_id,
            "people_count": scenario.affected_people_count,
            "blocked_path_ids": scenario.get_blocked_path_ids(),
            "disabled_exit_ids": disabled_exits,
            "simulation_mode": "LIVE_CROWD"
        }

        return EvacuationSimulator.run_simulation(custom_params=custom_params)
