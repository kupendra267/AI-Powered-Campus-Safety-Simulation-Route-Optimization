"""
Emergency Scenario and Simulation REST API Endpoints
====================================================
Routes for creating scenarios, starting/stopping emergencies, executing simulations,
querying bottleneck detections, and running What-If block-exit contingencies.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.services.emergency_service import EmergencyService
from backend.simulation.evacuation_simulation import EvacuationSimulator
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

emergency_bp = Blueprint('emergency', __name__, url_prefix='/api/emergency')
simulation_bp = Blueprint('simulation', __name__, url_prefix='/api/simulation')

# ==================== 1. EMERGENCY SCENARIOS ====================

@emergency_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_scenarios():
    status = request.args.get('status')
    scenarios = EmergencyService.get_all_scenarios(status=status)
    return api_response(
        success=True,
        data=scenarios,
        message="Emergency scenarios retrieved successfully.",
        status_code=200
    )


@emergency_bp.route('/active', methods=['GET'])
@jwt_required(optional=True)
def get_active_emergency():
    """Returns currently active emergency scenario for students & campus safety."""
    active = EmergencyService.get_active_scenario()
    return api_response(
        success=True,
        data=active,
        message="Active emergency status retrieved." if active else "No active emergency declared on campus.",
        status_code=200
    )


@emergency_bp.route('/<int:scenario_id>', methods=['GET'])
@jwt_required(optional=True)
def get_scenario(scenario_id):
    scenario = EmergencyService.get_scenario_by_id(scenario_id)
    if not scenario:
        return api_response(success=False, message="Scenario not found.", error="NOT_FOUND", status_code=404)
    return api_response(success=True, data=scenario.to_dict(), message="Scenario details retrieved.", status_code=200)


@emergency_bp.route('', methods=['POST'])
@admin_required
def create_scenario():
    data = request.get_json() or {}
    res, status_code = EmergencyService.create_scenario(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )


@emergency_bp.route('/<int:scenario_id>', methods=['PUT'])
@admin_required
def update_scenario(scenario_id):
    data = request.get_json() or {}
    res, status_code = EmergencyService.update_scenario(scenario_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )


@emergency_bp.route('/<int:scenario_id>', methods=['DELETE'])
@admin_required
def delete_scenario(scenario_id):
    res, status_code = EmergencyService.delete_scenario(scenario_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )


@emergency_bp.route('/<int:scenario_id>/start', methods=['POST'])
@admin_required
def start_emergency(scenario_id):
    res, status_code = EmergencyService.start_emergency(scenario_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )


@emergency_bp.route('/<int:scenario_id>/stop', methods=['POST'])
@admin_required
def stop_emergency(scenario_id):
    res, status_code = EmergencyService.stop_emergency(scenario_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )


# ==================== 2. SIMULATION EXECUTIONS ====================

@simulation_bp.route('/run', methods=['POST'])
@admin_required
def run_simulation():
    """Executes evacuation simulation for a scenario or custom configuration."""
    data = request.get_json() or {}
    scenario_id = data.get('scenario_id')
    res, status_code = EvacuationSimulator.run_simulation(scenario_id=scenario_id, custom_params=data)
    
    if not res.get('success'):
        return api_response(
            success=False,
            message=res.get('message', 'Simulation failed.'),
            error=res.get('error', 'SIMULATION_ERROR'),
            data=res.get('simulation'),
            status_code=status_code
        )

    return api_response(
        success=True,
        data=res,
        message=res.get('message', 'Simulation completed successfully.'),
        status_code=status_code
    )


@simulation_bp.route('/<int:simulation_id>', methods=['GET'])
@jwt_required(optional=True)
def get_simulation(simulation_id):
    res, status_code = EmergencyService.get_simulation_by_id(simulation_id)
    if not res.get('success'):
        return api_response(success=False, message=res.get('message'), error="NOT_FOUND", status_code=status_code)
    return api_response(success=True, data=res, message="Simulation retrieved.", status_code=status_code)


@simulation_bp.route('/<int:simulation_id>/results', methods=['GET'])
@jwt_required(optional=True)
def get_simulation_results(simulation_id):
    res, status_code = EmergencyService.get_simulation_by_id(simulation_id)
    if not res.get('success'):
        return api_response(success=False, message=res.get('message'), error="NOT_FOUND", status_code=status_code)
    return api_response(
        success=True,
        data={
            "simulation": res["simulation"],
            "results": res["results"],
            "bottlenecks": res["bottlenecks"],
            "exit_utilization": res["exit_utilization"]
        },
        message="Simulation results retrieved.",
        status_code=200
    )


@simulation_bp.route('/history', methods=['GET'])
@jwt_required(optional=True)
def get_simulation_history():
    limit = int(request.args.get('limit', 20))
    history = EmergencyService.get_simulation_history(limit=limit)
    return api_response(success=True, data=history, message="Simulation history retrieved.", status_code=200)


@simulation_bp.route('/what-if/block-exit', methods=['POST'])
@admin_required
def what_if_block_exit():
    """Runs a quick What-If simulation test disabling a specific exit."""
    data = request.get_json() or {}
    scenario_id = data.get('scenario_id')
    exit_id = data.get('exit_id')

    if not scenario_id or not exit_id:
        return api_response(success=False, message="scenario_id and exit_id are required.", status_code=400)

    res, status_code = EmergencyService.what_if_block_exit(int(scenario_id), int(exit_id))
    return api_response(
        success=res['success'],
        data=res,
        message=res.get('message', 'What-If simulation completed.'),
        status_code=status_code
    )
