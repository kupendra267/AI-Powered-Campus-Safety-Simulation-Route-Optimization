"""
Prediction API Endpoints
========================
Provides RESTful APIs for single-step, multi-step rolling forecasts, campus-wide
congestion predictions, ML evaluation curves, and administrative model retraining.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from backend.services.crowd_prediction_service import CrowdPredictionService
from backend.models.prediction import PredictionLog
from backend.utils.response import api_response
from backend.utils.decorators import admin_required

prediction_bp = Blueprint('predictions', __name__, url_prefix='/api/predictions')


@prediction_bp.route('/predict', methods=['POST'])
@jwt_required(optional=True)
def predict_crowd():
    """Generates future crowd count and congestion estimate for a specified location."""
    data = request.get_json() or {}
    location_id = data.get('location_id')
    prediction_time = data.get('prediction_time')

    if not location_id:
        return api_response(success=False, message="location_id is required for prediction.", status_code=400)

    res, status_code = CrowdPredictionService.predict_future(
        location_id=location_id,
        prediction_time=prediction_time
    )
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Prediction generated successfully.'),
        status_code=status_code
    )


@prediction_bp.route('/location/<int:location_id>', methods=['GET'])
@jwt_required(optional=True)
def get_location_predictions(location_id):
    """Generates multi-step timeline predictions (+1h, +2h, +3h, +4h, +6h) for a location."""
    horizons_param = request.args.get('horizons')
    if horizons_param:
        try:
            horizons = [int(h.strip()) for h in horizons_param.split(',') if h.strip()]
        except Exception:
            horizons = [1, 2, 3, 4, 6]
    else:
        horizons = [1, 2, 3, 4, 6]

    res, status_code = CrowdPredictionService.predict_multi_step(
        location_id=location_id,
        horizons_hours=horizons
    )
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Multi-step location forecast generated.",
        status_code=status_code
    )


@prediction_bp.route('/summary', methods=['GET'])
@jwt_required(optional=True)
def get_prediction_summary():
    """Generates campus-wide predicted congestion distribution for all buildings."""
    horizon = int(request.args.get('horizon', 1))
    res, status_code = CrowdPredictionService.predict_campus_summary(horizon_hours=horizon)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="Campus prediction summary computed.",
        status_code=status_code
    )


@prediction_bp.route('/model-info', methods=['GET'])
@jwt_required(optional=True)
def get_model_info():
    """Returns trained model architecture, genuine evaluation metrics (MAE, RMSE, R²), and feature details."""
    res, status_code = CrowdPredictionService.get_model_info()
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message="ML Model metrics and metadata retrieved.",
        status_code=status_code
    )


@prediction_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_prediction_logs():
    """Retrieves logged prediction history."""
    location_id = request.args.get('location_id')
    limit = int(request.args.get('limit', 50))

    query = PredictionLog.query.order_by(PredictionLog.created_at.desc())
    if location_id:
        query = query.filter_by(location_id=int(location_id))

    logs = query.limit(limit).all()
    return api_response(
        success=True,
        data=[log.to_dict() for log in logs],
        message="Prediction logs retrieved."
    )


@prediction_bp.route('/train', methods=['POST'])
@admin_required
def train_model():
    """Admin-only endpoint to trigger model retraining pipeline on demand."""
    data = request.get_json() or {}
    days = int(data.get('days', 90))
    res, status_code = CrowdPredictionService.retrain_model_on_demand(days=days)
    return api_response(
        success=res['success'],
        data=res.get('data'),
        message=res.get('message', 'Model retraining completed.'),
        status_code=status_code
    )
