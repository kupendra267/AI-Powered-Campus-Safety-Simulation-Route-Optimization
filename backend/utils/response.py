from datetime import datetime, timezone
from flask import jsonify

def api_response(success=True, data=None, message="", error=None, status_code=200):
    """
    Standardized API JSON response structure across the entire application.
    """
    payload = {
        "success": success,
        "data": data,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    if error is not None:
        payload["error"] = error
    return jsonify(payload), status_code
