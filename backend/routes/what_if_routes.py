"""
What-If Scenario REST API Endpoints (Phase 8)
==============================================
Routes for creating, managing, executing, and comparing What-If hypothetical
contingency scenarios.

Academic Project Notice:
Simulation-based evacuation recommendation — For Academic Demonstration.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.services.what_if_service import WhatIfService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

what_if_bp = Blueprint('what_if', __name__, url_prefix='/api/what-if')


@what_if_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_scenarios():
    """Retrieves list of What-If scenarios with optional type filter."""
    limit = int(request.args.get('limit', 50))
    scenario_type = request.args.get('type')
    scenarios = WhatIfService.get_all_scenarios(limit=limit, scenario_type=scenario_type)
    return api_response(
        success=True,
        data=scenarios,
        message="What-If scenarios retrieved successfully.",
        status_code=200
    )


@what_if_bp.route('/<int:scenario_id>', methods=['GET'])
@jwt_required(optional=True)
def get_scenario(scenario_id):
    """Retrieves a single What-If scenario by ID."""
    res, status_code = WhatIfService.get_scenario_by_id(scenario_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Scenario details retrieved.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('', methods=['POST'])
@admin_required
def create_scenario():
    """Creates a new What-If scenario specification."""
    data = request.get_json() or {}
    user_identity = get_jwt_identity()
    user_id = user_identity.get('id') if isinstance(user_identity, dict) else None
    
    res, status_code = WhatIfService.create_scenario(data, user_id=user_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Scenario created.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('/<int:scenario_id>', methods=['PUT'])
@admin_required
def update_scenario(scenario_id):
    """Updates an existing What-If scenario."""
    data = request.get_json() or {}
    res, status_code = WhatIfService.update_scenario(scenario_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Scenario updated.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('/<int:scenario_id>', methods=['DELETE'])
@admin_required
def delete_scenario(scenario_id):
    """Deletes a What-If scenario."""
    res, status_code = WhatIfService.delete_scenario(scenario_id)
    return api_response(
        success=res['success'],
        message=res.get('message', 'Scenario deleted.'),
        status_code=status_code
    )


@what_if_bp.route('/<int:scenario_id>/run', methods=['POST'])
@admin_required
def run_scenario(scenario_id):
    """Executes What-If simulation and optimization on a saved scenario."""
    data = request.get_json() or {}
    user_identity = get_jwt_identity()
    user_id = user_identity.get('id') if isinstance(user_identity, dict) else None

    res, status_code = WhatIfService.run_scenario(scenario_id, user_id=user_id, custom_params=data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'What-If analysis executed.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('/<int:scenario_id>/results', methods=['GET'])
@jwt_required(optional=True)
def get_scenario_results(scenario_id):
    """Retrieves full baseline vs. what-if results for a scenario."""
    res, status_code = WhatIfService.get_scenario_by_id(scenario_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Scenario results retrieved.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('/quick-run', methods=['POST'])
@admin_required
def quick_run():
    """Executes a What-If scenario on-the-fly without requiring prior save."""
    data = request.get_json() or {}
    user_identity = get_jwt_identity()
    user_id = user_identity.get('id') if isinstance(user_identity, dict) else None

    res, status_code = WhatIfService.quick_run(data, user_id=user_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'What-If analysis executed.'),
        error=res.get('error'),
        status_code=status_code
    )


@what_if_bp.route('/compare', methods=['POST'])
@admin_required
def compare_scenarios():
    """Generates comparative multi-scenario research comparison matrix."""
    data = request.get_json() or {}
    scenario_ids = data.get('scenario_ids', [])
    res, status_code = WhatIfService.compare_scenarios(scenario_ids)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Scenario comparison matrix generated.'),
        error=res.get('error'),
        status_code=status_code
    )
