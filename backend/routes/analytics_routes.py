"""
Analytics & Research Dashboard REST API Routes (Phase 9)
=========================================================
Exposes endpoints for aggregated crowd metrics, ML model performance,
routing evaluations, emergency simulations, capacity optimizations,
What-If contingencies, data quality, and CSV reporting.
"""

from flask import Blueprint, request, Response
from flask_jwt_extended import jwt_required, get_jwt

from backend.services.analytics_service import AnalyticsService
from backend.utils.decorators import admin_required
from backend.utils.response import api_response

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


# =========================================================================
# 1. OVERVIEW & RESEARCH SUMMARY
# =========================================================================
@analytics_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    """Returns top-level KPIs across all campus subsystems."""
    data = AnalyticsService.get_overview_analytics()
    return api_response(success=True, data=data, message="Overview analytics retrieved successfully.")


@analytics_bp.route('/research-summary', methods=['GET'])
@jwt_required()
def get_research_summary():
    """Returns traceable research summary table for academic project evaluation."""
    data = AnalyticsService.get_research_summary()
    return api_response(success=True, data=data, message="Research summary retrieved successfully.")


# =========================================================================
# 2. CROWD & PEAK ANALYTICS
# =========================================================================
@analytics_bp.route('/crowd', methods=['GET'])
@jwt_required()
def get_crowd():
    """Returns crowd density time series, location comparisons, and peak period analysis."""
    location_id = request.args.get('location_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    time_range = request.args.get('time_range')

    data = AnalyticsService.get_crowd_analytics(
        location_id=location_id,
        start_date=start_date,
        end_date=end_date,
        time_range=time_range
    )
    return api_response(success=True, data=data, message="Crowd analytics retrieved successfully.")


# =========================================================================
# 3. PREDICTIONS & ML ERROR ANALYTICS
# =========================================================================
@analytics_bp.route('/predictions', methods=['GET'])
@jwt_required()
def get_predictions():
    """Returns ML validation metrics, actual vs predicted samples, and per-location error analysis."""
    location_id = request.args.get('location_id', type=int)
    horizon = request.args.get('horizon', type=int)

    data = AnalyticsService.get_predictions_analytics(location_id=location_id, horizon=horizon)
    return api_response(success=True, data=data, message="ML prediction analytics retrieved successfully.")


# =========================================================================
# 4. ROUTING & CORRIDOR CONGESTION ANALYTICS
# =========================================================================
@analytics_bp.route('/routing', methods=['GET'])
@jwt_required()
def get_routing():
    """Returns comparative evaluation across routing modes and path utilization."""
    mode = request.args.get('mode')
    data = AnalyticsService.get_routing_analytics(mode=mode)
    return api_response(success=True, data=data, message="Routing analytics retrieved successfully.")


# =========================================================================
# 5. EMERGENCY SIMULATION ANALYTICS
# =========================================================================
@analytics_bp.route('/emergency', methods=['GET'])
@jwt_required()
def get_emergency():
    """Returns Phase 6 emergency evacuation simulation history and outcomes."""
    emergency_type = request.args.get('emergency_type')
    scenario_id = request.args.get('scenario_id', type=int)

    data = AnalyticsService.get_emergency_analytics(emergency_type=emergency_type, scenario_id=scenario_id)
    return api_response(success=True, data=data, message="Emergency simulation analytics retrieved successfully.")


# =========================================================================
# 6. OPTIMIZATION ANALYTICS
# =========================================================================
@analytics_bp.route('/optimization', methods=['GET'])
@jwt_required()
def get_optimization():
    """Returns Phase 7 evacuation optimization comparative metrics and exit balancing."""
    scenario_id = request.args.get('scenario_id', type=int)
    data = AnalyticsService.get_optimization_analytics(scenario_id=scenario_id)
    return api_response(success=True, data=data, message="Optimization analytics retrieved successfully.")


# =========================================================================
# 7. WHAT-IF SCENARIO ANALYTICS
# =========================================================================
@analytics_bp.route('/what-if', methods=['GET'])
@jwt_required()
def get_what_if():
    """Returns Phase 8 What-If contingency scenario results and sensitivity comparisons."""
    scenario_type = request.args.get('scenario_type')
    data = AnalyticsService.get_what_if_analytics(scenario_type=scenario_type)
    return api_response(success=True, data=data, message="What-If analytics retrieved successfully.")


# =========================================================================
# 8. BOTTLENECK & EXIT ANALYTICS
# =========================================================================
@analytics_bp.route('/bottlenecks', methods=['GET'])
@jwt_required()
def get_bottlenecks():
    """Returns identified corridor chokepoints, load percentages, and occurrences."""
    data = AnalyticsService.get_bottleneck_analytics()
    return api_response(success=True, data=data, message="Bottleneck analytics retrieved successfully.")


@analytics_bp.route('/exits', methods=['GET'])
@jwt_required()
def get_exits():
    """Returns perimeter exit capacity allocations, average load, and blockage counts."""
    data = AnalyticsService.get_exit_analytics()
    return api_response(success=True, data=data, message="Exit analytics retrieved successfully.")


# =========================================================================
# 9. PERFORMANCE & DATA QUALITY ANALYTICS
# =========================================================================
@analytics_bp.route('/performance', methods=['GET'])
@jwt_required()
def get_performance():
    """Returns system execution latencies (min, max, avg) for operations."""
    data = AnalyticsService.get_performance_analytics()
    return api_response(success=True, data=data, message="Performance analytics retrieved successfully.")


@analytics_bp.route('/data-quality', methods=['GET'])
@jwt_required()
def get_data_quality():
    """Returns data integrity audit across graph topology, crowd feeds, and model artifacts."""
    data = AnalyticsService.get_data_quality_analytics()
    return api_response(success=True, data=data, message="Data quality metrics retrieved successfully.")


# =========================================================================
# 10. EXPORT REPORT (CSV)
# =========================================================================
@analytics_bp.route('/export', methods=['GET'])
@jwt_required()
def export_report():
    """Exports a comprehensive research CSV report containing actual system metrics."""
    csv_content = AnalyticsService.export_analytics_report_csv()
    
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=campus_research_analytics_report.csv",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )
