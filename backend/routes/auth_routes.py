from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from backend.services.auth_service import AuthService
from backend.utils.response import api_response
from backend.utils.decorators import admin_required, role_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'STUDENT')

    result, status_code = AuthService.register(name, email, password, role)
    if not result.get('success'):
        return api_response(
            success=False,
            message=result.get('message'),
            error=result.get('error'),
            data=result.get('details'),
            status_code=status_code
        )
    return api_response(
        success=True,
        data=result.get('data'),
        message=result.get('message'),
        status_code=status_code
    )

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    result, status_code = AuthService.login(email, password)
    if not result.get('success'):
        return api_response(
            success=False,
            message=result.get('message'),
            error=result.get('error'),
            status_code=status_code
        )
    return api_response(
        success=True,
        data=result.get('data'),
        message=result.get('message'),
        status_code=status_code
    )

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # Stateless JWT logout acknowledged
    return api_response(
        success=True,
        message="Logged out successfully.",
        status_code=200
    )

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    result, status_code = AuthService.get_user_profile(user_id)
    if not result.get('success'):
        return api_response(
            success=False,
            message=result.get('message'),
            error=result.get('error'),
            status_code=status_code
        )
    return api_response(
        success=True,
        data=result.get('data'),
        message="User profile retrieved.",
        status_code=status_code
    )

@auth_bp.route('/admin-check', methods=['GET'])
@admin_required
def admin_check():
    claims = get_jwt()
    return api_response(
        success=True,
        data={
            "authorized": True,
            "role": claims.get("role"),
            "email": claims.get("email")
        },
        message="Admin access granted.",
        status_code=200
    )

@auth_bp.route('/student-check', methods=['GET'])
@role_required('STUDENT', 'ADMIN')
def student_check():
    claims = get_jwt()
    return api_response(
        success=True,
        data={
            "authorized": True,
            "role": claims.get("role"),
            "email": claims.get("email")
        },
        message="Student/User access granted.",
        status_code=200
    )
