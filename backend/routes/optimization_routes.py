"""
Optimization REST API Endpoints (Phase 7)
=========================================
Routes for executing comparative evacuation optimization, retrieving results,
managing objective weights, and viewing optimization history.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.services.optimization_service import OptimizationService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

optimization_bp = Blueprint('optimization', __name__, url_prefix='/api/optimization')


@optimization_bp.route('/run', methods=['POST'])
@admin_required
def run_optimization():
    """Executes comparative evacuation optimization for a simulation or scenario."""
    data = request.get_json() or {}
    res, status_code = OptimizationService.run_optimization(data)
    return api_response(
        success=res['success'],
        data=res.get('data') or res,
        message=res.get('message', 'Optimization executed.'),
        error=res.get('error'),
        status_code=status_code
    )


@optimization_bp.route('/<int:opt_id>', methods=['GET'])
@jwt_required(optional=True)
def get_optimization(opt_id):
    """Retrieves a specific optimization result by ID."""
    res, status_code = OptimizationService.get_optimization_by_id(opt_id)
    if not res.get('success'):
        return api_response(success=False, message=res.get('message'), error="NOT_FOUND", status_code=status_code)
    return api_response(success=True, data=res['data'], message="Optimization result retrieved.", status_code=status_code)


@optimization_bp.route('/history', methods=['GET'])
@jwt_required(optional=True)
def get_history():
    """Retrieves list of past optimization runs."""
    limit = int(request.args.get('limit', 20))
    history = OptimizationService.get_history(limit=limit)
    return api_response(success=True, data=history, message="Optimization history retrieved.", status_code=200)


@optimization_bp.route('/config', methods=['GET'])
@jwt_required(optional=True)
def get_config():
    """Retrieves active objective function weights and optimization parameters."""
    cfg = OptimizationService.get_config()
    return api_response(success=True, data=cfg, message="Optimization configuration retrieved.", status_code=200)


@optimization_bp.route('/config', methods=['PUT'])
@admin_required
def update_config():
    """Updates objective function weights and optimization parameters."""
    data = request.get_json() or {}
    res, status_code = OptimizationService.update_config(data)
    return api_response(
        success=res['success'],
        data=res['data'],
        message=res['message'],
        status_code=status_code
    )
