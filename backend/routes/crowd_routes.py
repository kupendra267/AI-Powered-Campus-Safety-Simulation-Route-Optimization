from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.services.crowd_service import CrowdService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

crowd_bp = Blueprint('crowd', __name__, url_prefix='/api/crowd')

@crowd_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_crowd_records():
    location_id = request.args.get('location_id')
    congestion_level = request.args.get('congestion_level')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))

    res, status_code = CrowdService.get_crowd_records(
        location_id=location_id,
        congestion_level=congestion_level,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit
    )
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Crowd records retrieved.",
        status_code=status_code
    )

@crowd_bp.route('/<int:record_id>', methods=['GET'])
@jwt_required(optional=True)
def get_crowd_record(record_id):
    res, status_code = CrowdService.get_crowd_record_by_id(record_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Crowd record retrieved.'),
        status_code=status_code
    )

@crowd_bp.route('', methods=['POST'])
@admin_required
def create_crowd_record():
    data = request.get_json() or {}
    res, status_code = CrowdService.create_crowd_record(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@crowd_bp.route('/<int:record_id>', methods=['PUT'])
@admin_required
def update_crowd_record(record_id):
    data = request.get_json() or {}
    res, status_code = CrowdService.update_crowd_record(record_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@crowd_bp.route('/<int:record_id>', methods=['DELETE'])
@admin_required
def delete_crowd_record(record_id):
    res, status_code = CrowdService.delete_crowd_record(record_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )

@crowd_bp.route('/location/<int:location_id>', methods=['GET'])
@jwt_required(optional=True)
def get_location_crowd(location_id):
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    res, status_code = CrowdService.get_crowd_records(location_id=location_id, page=page, limit=limit)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=f"Crowd records for location {location_id} retrieved.",
        status_code=status_code
    )

@crowd_bp.route('/current', methods=['GET'])
@jwt_required(optional=True)
def get_current_crowd():
    res, status_code = CrowdService.get_current_crowd()
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Current campus crowd distribution retrieved.",
        status_code=status_code
    )

@crowd_bp.route('/summary', methods=['GET'])
@jwt_required(optional=True)
def get_crowd_summary():
    res, status_code = CrowdService.get_crowd_summary()
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Crowd summary metrics computed.",
        status_code=status_code
    )

@crowd_bp.route('/trends', methods=['GET'])
@jwt_required(optional=True)
def get_crowd_trends():
    days = int(request.args.get('days', 1))
    location_id = request.args.get('location_id')
    res, status_code = CrowdService.get_crowd_trends(days=days, location_id=location_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Crowd trends and chart data retrieved.",
        status_code=status_code
    )

@crowd_bp.route('/simulation/step', methods=['POST'])
@admin_required
def simulation_step():
    data = request.get_json() or {}
    scenario = data.get('scenario', 'random')
    res, status_code = CrowdService.run_simulation_step(scenario)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@crowd_bp.route('/simulation/reset', methods=['POST'])
@admin_required
def simulation_reset():
    res, status_code = CrowdService.reset_simulation()
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@crowd_bp.route('/alerts', methods=['GET'])
@jwt_required(optional=True)
def get_alerts():
    is_active = request.args.get('is_active')
    if is_active is not None:
        is_active = is_active.lower() == 'true'
    res, status_code = CrowdService.get_alerts(is_active=is_active)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="System alerts retrieved.",
        status_code=status_code
    )

@crowd_bp.route('/alerts/<int:alert_id>/dismiss', methods=['POST'])
@admin_required
def dismiss_alert(alert_id):
    res, status_code = CrowdService.dismiss_alert(alert_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )
