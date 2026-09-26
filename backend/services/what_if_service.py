"""
What-If Scenario Service (Phase 8)
==================================
Coordinates What-If scenario creation, parameter validation, execution orchestration,
history queries, and comparative matrix aggregation.
"""

import json
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime, timezone
from sqlalchemy import desc

from backend.extensions import db
from backend.models.what_if import WhatIfScenario
from backend.simulation.what_if_engine import WhatIfEngine


class WhatIfService:

    @classmethod
    def get_all_scenarios(cls, limit: int = 50, scenario_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves list of What-If scenarios with optional type filter."""
        query = WhatIfScenario.query
        if scenario_type and scenario_type != 'ALL':
            query = query.filter_by(scenario_type=scenario_type.upper())
        scenarios = query.order_by(desc(WhatIfScenario.created_at)).limit(limit).all()
        return [s.to_dict() for s in scenarios]

    @classmethod
    def get_scenario_by_id(cls, scenario_id: int) -> Tuple[Dict[str, Any], int]:
        """Retrieves a single What-If scenario with complete metrics and simulation payload."""
        sc = db.session.get(WhatIfScenario, int(scenario_id))
        if not sc:
            return {"success": False, "message": f"What-If Scenario #{scenario_id} not found."}, 404
        return {"success": True, "data": sc.to_dict()}, 200

    @classmethod
    def create_scenario(cls, data: Dict[str, Any], user_id: Optional[int] = None) -> Tuple[Dict[str, Any], int]:
        """Creates a new What-If scenario specification."""
        name = data.get('name', '').strip()
        scenario_type = data.get('scenario_type', 'MULTIPLE_FAILURES').strip().upper()
        description = data.get('description', '')
        base_scenario_id = data.get('base_scenario_id')
        base_simulation_id = data.get('base_simulation_id')

        if not name:
            return {"success": False, "message": "Scenario name is required."}, 400

        if scenario_type not in WhatIfEngine.ALLOWED_SCENARIO_TYPES:
            return {
                "success": False,
                "message": f"Invalid scenario type '{scenario_type}'. Allowed: {', '.join(WhatIfEngine.ALLOWED_SCENARIO_TYPES)}"
            }, 400

        # Auto-run if requested
        auto_run = data.get('auto_run', False)
        if auto_run:
            return WhatIfEngine.run_what_if_analysis(custom_params=data, user_id=user_id)

        new_sc = WhatIfScenario(
            name=name,
            description=description,
            base_scenario_id=int(base_scenario_id) if base_scenario_id else None,
            base_simulation_id=int(base_simulation_id) if base_simulation_id else None,
            scenario_type=scenario_type,
            parameters=json.dumps(data.get('parameters', data)),
            status='CREATED',
            created_by=user_id
        )
        db.session.add(new_sc)
        db.session.commit()

        return {
            "success": True,
            "message": f"What-If Scenario '{name}' created successfully.",
            "data": new_sc.to_dict()
        }, 201

    @classmethod
    def update_scenario(cls, scenario_id: int, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """Updates parameters or metadata of an existing What-If scenario."""
        sc = db.session.get(WhatIfScenario, int(scenario_id))
        if not sc:
            return {"success": False, "message": "Scenario not found."}, 404

        if 'name' in data and data['name']:
            sc.name = data['name'].strip()
        if 'description' in data:
            sc.description = data['description']
        if 'scenario_type' in data and data['scenario_type']:
            s_type = data['scenario_type'].strip().upper()
            if s_type in WhatIfEngine.ALLOWED_SCENARIO_TYPES:
                sc.scenario_type = s_type
        if 'parameters' in data:
            sc.parameters = json.dumps(data['parameters'])
        elif 'blocked_exit_ids' in data or 'blocked_path_ids' in data or 'crowd_modifications' in data:
            sc.parameters = json.dumps(data)

        db.session.commit()
        return {
            "success": True,
            "message": f"What-If Scenario '{sc.name}' updated successfully.",
            "data": sc.to_dict()
        }, 200

    @classmethod
    def delete_scenario(cls, scenario_id: int) -> Tuple[Dict[str, Any], int]:
        """Deletes a What-If scenario."""
        sc = db.session.get(WhatIfScenario, int(scenario_id))
        if not sc:
            return {"success": False, "message": "Scenario not found."}, 404

        db.session.delete(sc)
        db.session.commit()
        return {"success": True, "message": "What-If Scenario deleted successfully."}, 200

    @classmethod
    def run_scenario(cls, scenario_id: int, user_id: Optional[int] = None,
                     custom_params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Executes What-If analysis on an existing scenario."""
        return WhatIfEngine.run_what_if_analysis(scenario_id=scenario_id, custom_params=custom_params, user_id=user_id)

    @classmethod
    def quick_run(cls, data: Dict[str, Any], user_id: Optional[int] = None) -> Tuple[Dict[str, Any], int]:
        """Creates and executes a What-If scenario in one operation."""
        return WhatIfEngine.run_what_if_analysis(custom_params=data, user_id=user_id)

    @classmethod
    def compare_scenarios(cls, scenario_ids: List[int]) -> Tuple[Dict[str, Any], int]:
        """Compares multiple scenarios side-by-side against baseline."""
        return WhatIfEngine.compare_multiple_scenarios(scenario_ids)
