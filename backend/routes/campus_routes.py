from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.services.campus_service import CampusService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

campus_bp = Blueprint('campus', __name__, url_prefix='/api/campus')

# ==================== BUILDINGS ====================
@campus_bp.route('/buildings', methods=['GET'])
@jwt_required(optional=True)
def get_buildings():
    buildings = CampusService.get_all_buildings()
    return api_response(success=True, data=buildings, message="Buildings retrieved successfully.")

@campus_bp.route('/buildings/<int:building_id>', methods=['GET'])
@jwt_required(optional=True)
def get_building(building_id):
    building = CampusService.get_building_by_id(building_id)
    if not building:
        return api_response(success=False, message="Building not found.", error="NOT_FOUND", status_code=404)
    return api_response(success=True, data=building.to_dict(), message="Building details retrieved.")

@campus_bp.route('/buildings', methods=['POST'])
@admin_required
def create_building():
    data = request.get_json() or {}
    res, status_code = CampusService.create_building(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/buildings/<int:building_id>', methods=['PUT'])
@admin_required
def update_building(building_id):
    data = request.get_json() or {}
    res, status_code = CampusService.update_building(building_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/buildings/<int:building_id>', methods=['DELETE'])
@admin_required
def delete_building(building_id):
    res, status_code = CampusService.delete_building(building_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )

# ==================== NODES ====================
@campus_bp.route('/nodes', methods=['GET'])
@jwt_required(optional=True)
def get_nodes():
    nodes = CampusService.get_all_nodes()
    return api_response(success=True, data=nodes, message="Nodes retrieved successfully.")

@campus_bp.route('/nodes/<int:node_id>', methods=['GET'])
@jwt_required(optional=True)
def get_node(node_id):
    node = CampusService.get_node_by_id(node_id)
    if not node:
        return api_response(success=False, message="Node not found.", error="NOT_FOUND", status_code=404)
    return api_response(success=True, data=node.to_dict(), message="Node details retrieved.")

@campus_bp.route('/nodes', methods=['POST'])
@admin_required
def create_node():
    data = request.get_json() or {}
    res, status_code = CampusService.create_node(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/nodes/<int:node_id>', methods=['PUT'])
@admin_required
def update_node(node_id):
    data = request.get_json() or {}
    res, status_code = CampusService.update_node(node_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/nodes/<int:node_id>', methods=['DELETE'])
@admin_required
def delete_node(node_id):
    res, status_code = CampusService.delete_node(node_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )

# ==================== PATHS ====================
@campus_bp.route('/paths', methods=['GET'])
@jwt_required(optional=True)
def get_paths():
    paths = CampusService.get_all_paths()
    return api_response(success=True, data=paths, message="Paths retrieved successfully.")

@campus_bp.route('/paths/<int:path_id>', methods=['GET'])
@jwt_required(optional=True)
def get_path(path_id):
    path = CampusService.get_path_by_id(path_id)
    if not path:
        return api_response(success=False, message="Path not found.", error="NOT_FOUND", status_code=404)
    return api_response(success=True, data=path.to_dict(), message="Path details retrieved.")

@campus_bp.route('/paths', methods=['POST'])
@admin_required
def create_path():
    data = request.get_json() or {}
    res, status_code = CampusService.create_path(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/paths/<int:path_id>', methods=['PUT'])
@admin_required
def update_path(path_id):
    data = request.get_json() or {}
    res, status_code = CampusService.update_path(path_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/paths/<int:path_id>/toggle-status', methods=['POST'])
@admin_required
def toggle_path_status(path_id):
    res, status_code = CampusService.toggle_path_status(path_id)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/paths/<int:path_id>', methods=['DELETE'])
@admin_required
def delete_path(path_id):
    res, status_code = CampusService.delete_path(path_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )

# ==================== EXITS ====================
@campus_bp.route('/exits', methods=['GET'])
@jwt_required(optional=True)
def get_exits():
    exits = CampusService.get_all_exits()
    return api_response(success=True, data=exits, message="Exits retrieved successfully.")

@campus_bp.route('/exits/<int:exit_id>', methods=['GET'])
@jwt_required(optional=True)
def get_exit(exit_id):
    exit_obj = CampusService.get_exit_by_id(exit_id)
    if not exit_obj:
        return api_response(success=False, message="Exit not found.", error="NOT_FOUND", status_code=404)
    return api_response(success=True, data=exit_obj.to_dict(), message="Exit details retrieved.")

@campus_bp.route('/exits', methods=['POST'])
@admin_required
def create_exit():
    data = request.get_json() or {}
    res, status_code = CampusService.create_exit(data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/exits/<int:exit_id>', methods=['PUT'])
@admin_required
def update_exit(exit_id):
    data = request.get_json() or {}
    res, status_code = CampusService.update_exit(exit_id, data)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res['message'],
        status_code=status_code
    )

@campus_bp.route('/exits/<int:exit_id>', methods=['DELETE'])
@admin_required
def delete_exit(exit_id):
    res, status_code = CampusService.delete_exit(exit_id)
    return api_response(
        success=res['success'],
        message=res['message'],
        status_code=status_code
    )

# ==================== GRAPH TOPOLOGY ====================
@campus_bp.route('/graph', methods=['GET'])
@jwt_required(optional=True)
def get_graph():
    graph_data = CampusService.get_campus_graph()
    return api_response(
        success=True,
        data=graph_data,
        message="Campus graph topology retrieved successfully."
    )
