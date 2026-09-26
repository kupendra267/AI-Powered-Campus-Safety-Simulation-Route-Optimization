from functools import wraps
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from backend.utils.response import api_response

def role_required(*allowed_roles):
    """
    Decorator to restrict endpoint access to specific roles.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role", "").upper()
            
            normalized_allowed_roles = [r.upper() for r in allowed_roles]
            if user_role not in normalized_allowed_roles:
                return api_response(
                    success=False,
                    message=f"Access forbidden: requires one of {allowed_roles} roles",
                    error="FORBIDDEN_ROLE",
                    status_code=403
                )
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def admin_required(fn):
    """
    Convenience decorator for admin-only endpoints.
    """
    return role_required("ADMIN")(fn)
