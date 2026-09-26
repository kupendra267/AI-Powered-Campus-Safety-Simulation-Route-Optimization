"""
Campus Routing API Routes
=========================
REST Endpoints for calculating intelligent crowd-aware, predictive,
shortest, and fastest routes across campus facilities.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.services.routing_service import RoutingService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

route_bp = Blueprint('routes', __name__, url_prefix='/api/routes')


@route_bp.route('/calculate', methods=['POST'])
@jwt_required(optional=True)
def calculate_route():
    """
    Calculates primary recommended route and alternative routes between two campus nodes.
    Supports: SHORTEST, FASTEST, CROWD_AWARE, PREDICTIVE modes.
    """
    data = request.get_json() or {}
    start_node_id = data.get('start_node_id')
    destination_node_id = data.get('destination_node_id')
    mode = data.get('mode', 'CROWD_AWARE')
    horizon_hours = data.get('horizon_hours', 1)
    prediction_time = data.get('prediction_time')

    res, status_code = RoutingService.calculate_route(
        start_node_id=start_node_id,
        destination_node_id=destination_node_id,
        mode=mode,
        horizon_hours=horizon_hours,
        prediction_time=prediction_time
    )

    if not res.get('success'):
        return api_response(
            success=False,
            message=res.get('message', 'Failed to calculate route.'),
            error=res.get('error', 'ROUTING_ERROR'),
            data=res.get('details'),
            status_code=status_code
        )

    return api_response(
        success=True,
        data=res,
        message=f"{res.get('mode')} route calculated successfully.",
        status_code=status_code
    )


@route_bp.route('/config', methods=['GET'])
@jwt_required(optional=True)
def get_routing_config():
    """Retrieves current walking speed, distance weights, and crowd impedance factors."""
    res = RoutingService.get_routing_config()
    return api_response(
        success=True,
        data=res['data'],
        message="Routing configuration retrieved successfully.",
        status_code=200
    )


@route_bp.route('/config', methods=['PUT'])
@admin_required
def update_routing_config():
    """Updates routing configuration and cost weights (Admin only)."""
    data = request.get_json() or {}
    res, status_code = RoutingService.update_routing_config(data)

    if not res.get('success'):
        return api_response(
            success=False,
            message=res.get('message', 'Failed to update routing configuration.'),
            error=res.get('error', 'CONFIG_ERROR'),
            status_code=status_code
        )

    return api_response(
        success=True,
        data=res.get('data'),
        message=res.get('message'),
        status_code=status_code
    )
