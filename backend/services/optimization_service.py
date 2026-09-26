"""
Optimization Service (Phase 7)
==============================
Coordinates emergency evacuation optimization requests, weight configuration tuning,
and history retrieval.
"""

from typing import Dict, Any, Tuple, Optional, List
from backend.extensions import db
from backend.models.optimization import OptimizationConfig, OptimizationResult
from backend.optimization.evacuation_optimizer import EvacuationOptimizer


class OptimizationService:

    @classmethod
    def run_optimization(cls, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """Runs comparative baseline vs. optimized evacuation optimization."""
        simulation_id = data.get('simulation_id')
        scenario_id = data.get('scenario_id')
        custom_weights = data.get('weights')
        max_iterations = data.get('max_iterations')
        use_predicted_crowd = data.get('use_predicted_crowd')

        if not simulation_id and not scenario_id:
            from backend.models.emergency import EmergencyScenario
            from backend.services.emergency_service import EmergencyService
            EmergencyService.seed_default_scenarios_if_empty()
            first_sc = EmergencyScenario.query.first()
            if first_sc:
                scenario_id = first_sc.id
            else:
                return {
                    "success": False,
                    "message": "Either 'simulation_id' or 'scenario_id' is required to execute optimization."
                }, 400

        return EvacuationOptimizer.run_optimization(
            simulation_id=simulation_id,
            scenario_id=scenario_id,
            custom_weights=custom_weights,
            max_iterations=max_iterations,
            use_predicted_crowd=use_predicted_crowd
        )

    @classmethod
    def get_optimization_by_id(cls, opt_id: int) -> Tuple[Dict[str, Any], int]:
        result = db.session.get(OptimizationResult, int(opt_id))
        if not result:
            return {"success": False, "message": f"OptimizationResult #{opt_id} not found."}, 404
        return {"success": True, "data": result.to_dict()}, 200

    @classmethod
    def get_history(cls, limit: int = 20) -> List[Dict[str, Any]]:
        results = (
            OptimizationResult.query
            .order_by(OptimizationResult.created_at.desc())
            .limit(limit)
            .all()
        )
        return [r.to_dict() for r in results]

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        config = OptimizationConfig.get_or_create()
        return config.to_dict()

    @classmethod
    def update_config(cls, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        config = OptimizationConfig.get_or_create()

        weights = data.get('weights', {})
        if 'evacuation_time' in weights:
            config.weight_evacuation_time = max(0.0, float(weights['evacuation_time']))
        if 'congestion' in weights:
            config.weight_congestion = max(0.0, float(weights['congestion']))
        if 'distance' in weights:
            config.weight_distance = max(0.0, float(weights['distance']))
        if 'exit_overload' in weights:
            config.weight_exit_overload = max(0.0, float(weights['exit_overload']))

        if 'max_iterations' in data:
            config.max_iterations = max(1, min(100, int(data['max_iterations'])))
        if 'use_predicted_crowd' in data:
            config.use_predicted_crowd = bool(data['use_predicted_crowd'])
        if 'congestion_threshold_critical' in data:
            config.congestion_threshold_critical = float(data['congestion_threshold_critical'])

        db.session.commit()
        return {
            "success": True,
            "message": "Optimization configuration weights updated successfully.",
            "data": config.to_dict()
        }, 200
