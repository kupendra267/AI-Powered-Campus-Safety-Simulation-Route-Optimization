"""
Optimization Database Models (Phase 7)
=======================================
Defines database models for persistent optimization run results,
comparative baseline vs. optimized evacuation metrics, and configurable objective weights.
"""

import json
from datetime import datetime, timezone
from backend.extensions import db


class OptimizationConfig(db.Model):
    __tablename__ = 'optimization_configs'

    id = db.Column(db.Integer, primary_key=True)
    weight_evacuation_time = db.Column(db.Float, nullable=False, default=0.40)
    weight_congestion = db.Column(db.Float, nullable=False, default=0.30)
    weight_distance = db.Column(db.Float, nullable=False, default=0.20)
    weight_exit_overload = db.Column(db.Float, nullable=False, default=0.10)
    max_iterations = db.Column(db.Integer, nullable=False, default=30)
    use_predicted_crowd = db.Column(db.Boolean, nullable=False, default=True)
    congestion_threshold_critical = db.Column(db.Float, nullable=False, default=85.0)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @classmethod
    def get_or_create(cls):
        config = cls.query.first()
        if not config:
            config = cls(
                weight_evacuation_time=0.40,
                weight_congestion=0.30,
                weight_distance=0.20,
                weight_exit_overload=0.10,
                max_iterations=30,
                use_predicted_crowd=True,
                congestion_threshold_critical=85.0
            )
            db.session.add(config)
            db.session.commit()
        return config

    def get_normalized_weights(self):
        w_time = max(0.0, float(self.weight_evacuation_time))
        w_cong = max(0.0, float(self.weight_congestion))
        w_dist = max(0.0, float(self.weight_distance))
        w_exit = max(0.0, float(self.weight_exit_overload))
        total = w_time + w_cong + w_dist + w_exit
        if total <= 0:
            return {'evacuation_time': 0.40, 'congestion': 0.30, 'distance': 0.20, 'exit_overload': 0.10}
        return {
            'evacuation_time': round(w_time / total, 3),
            'congestion': round(w_cong / total, 3),
            'distance': round(w_dist / total, 3),
            'exit_overload': round(w_exit / total, 3)
        }

    def to_dict(self):
        return {
            'id': self.id,
            'weights': {
                'evacuation_time': self.weight_evacuation_time,
                'congestion': self.weight_congestion,
                'distance': self.weight_distance,
                'exit_overload': self.weight_exit_overload
            },
            'normalized_weights': self.get_normalized_weights(),
            'max_iterations': self.max_iterations,
            'use_predicted_crowd': self.use_predicted_crowd,
            'congestion_threshold_critical': self.congestion_threshold_critical,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class OptimizationResult(db.Model):
    __tablename__ = 'optimization_results'

    id = db.Column(db.Integer, primary_key=True)
    simulation_id = db.Column(db.Integer, db.ForeignKey('simulations.id', ondelete='SET NULL'), nullable=True)
    scenario_id = db.Column(db.Integer, db.ForeignKey('emergency_scenarios.id', ondelete='SET NULL'), nullable=True)
    scenario_name = db.Column(db.String(150), nullable=True, default='Ad-Hoc Evacuation')
    optimization_method = db.Column(db.String(80), nullable=False, default='CAPACITY_AWARE_MIN_COST_FLOW')
    
    # Baseline Metrics
    baseline_time = db.Column(db.Float, nullable=False, default=0.0)
    baseline_max_congestion = db.Column(db.String(20), nullable=False, default='LOW')
    baseline_avg_utilization = db.Column(db.Float, nullable=False, default=0.0)
    baseline_total_distance = db.Column(db.Float, nullable=False, default=0.0)
    baseline_unassigned = db.Column(db.Integer, nullable=False, default=0)
    baseline_bottlenecks_count = db.Column(db.Integer, nullable=False, default=0)
    
    # Optimized Metrics
    optimized_time = db.Column(db.Float, nullable=False, default=0.0)
    optimized_max_congestion = db.Column(db.String(20), nullable=False, default='LOW')
    optimized_avg_utilization = db.Column(db.Float, nullable=False, default=0.0)
    optimized_total_distance = db.Column(db.Float, nullable=False, default=0.0)
    optimized_unassigned = db.Column(db.Integer, nullable=False, default=0)
    optimized_bottlenecks_count = db.Column(db.Integer, nullable=False, default=0)

    # Actual Calculated Research Comparison Metrics
    time_reduction_percentage = db.Column(db.Float, nullable=False, default=0.0)
    congestion_reduction_percentage = db.Column(db.Float, nullable=False, default=0.0)
    distance_change_percentage = db.Column(db.Float, nullable=False, default=0.0)
    bottlenecks_reduction_percentage = db.Column(db.Float, nullable=False, default=0.0)
    
    # Objective Scores & Iterations
    objective_score_baseline = db.Column(db.Float, nullable=False, default=0.0)
    objective_score_optimized = db.Column(db.Float, nullable=False, default=0.0)
    iterations = db.Column(db.Integer, nullable=False, default=1)
    
    # JSON-encoded payloads
    weights_json = db.Column(db.Text, nullable=False, default='{}')
    baseline_routes_json = db.Column(db.Text, nullable=False, default='[]')
    optimized_routes_json = db.Column(db.Text, nullable=False, default='[]')
    baseline_exits_json = db.Column(db.Text, nullable=False, default='[]')
    optimized_exits_json = db.Column(db.Text, nullable=False, default='[]')
    baseline_bottlenecks_json = db.Column(db.Text, nullable=False, default='[]')
    optimized_bottlenecks_json = db.Column(db.Text, nullable=False, default='[]')
    explanations_json = db.Column(db.Text, nullable=False, default='[]')

    status = db.Column(db.String(20), nullable=False, default='OPTIMAL')  # OPTIMAL, FEASIBLE, PARTIAL, FAILED
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    simulation = db.relationship('Simulation', backref=db.backref('optimization_results', lazy=True))
    scenario = db.relationship('EmergencyScenario', backref=db.backref('optimization_results', lazy=True))

    def get_weights(self):
        try:
            return json.loads(self.weights_json or '{}')
        except Exception:
            return {}

    def get_baseline_routes(self):
        try:
            return json.loads(self.baseline_routes_json or '[]')
        except Exception:
            return []

    def get_optimized_routes(self):
        try:
            return json.loads(self.optimized_routes_json or '[]')
        except Exception:
            return []

    def get_baseline_exits(self):
        try:
            return json.loads(self.baseline_exits_json or '[]')
        except Exception:
            return []

    def get_optimized_exits(self):
        try:
            return json.loads(self.optimized_exits_json or '[]')
        except Exception:
            return []

    def get_baseline_bottlenecks(self):
        try:
            return json.loads(self.baseline_bottlenecks_json or '[]')
        except Exception:
            return []

    def get_optimized_bottlenecks(self):
        try:
            return json.loads(self.optimized_bottlenecks_json or '[]')
        except Exception:
            return []

    def get_explanations(self):
        try:
            return json.loads(self.explanations_json or '[]')
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'simulation_id': self.simulation_id,
            'scenario_id': self.scenario_id,
            'scenario_name': self.scenario_name or (self.scenario.name if self.scenario else "Ad-Hoc Simulation"),
            'optimization_method': self.optimization_method,
            'baseline': {
                'evacuation_time_sec': round(self.baseline_time, 1),
                'evacuation_time_formatted': f"{int(self.baseline_time // 60)}m {int(self.baseline_time % 60):02d}s" if self.baseline_time >= 60 else f"{int(self.baseline_time)}s",
                'max_congestion': self.baseline_max_congestion,
                'avg_utilization_percentage': round(self.baseline_avg_utilization, 1),
                'total_distance_meters': round(self.baseline_total_distance, 1),
                'unassigned_people': self.baseline_unassigned,
                'bottlenecks_count': self.baseline_bottlenecks_count,
                'objective_score': round(self.objective_score_baseline, 4),
                'routes': self.get_baseline_routes(),
                'exits': self.get_baseline_exits(),
                'bottlenecks': self.get_baseline_bottlenecks()
            },
            'optimized': {
                'evacuation_time_sec': round(self.optimized_time, 1),
                'evacuation_time_formatted': f"{int(self.optimized_time // 60)}m {int(self.optimized_time % 60):02d}s" if self.optimized_time >= 60 else f"{int(self.optimized_time)}s",
                'max_congestion': self.optimized_max_congestion,
                'avg_utilization_percentage': round(self.optimized_avg_utilization, 1),
                'total_distance_meters': round(self.optimized_total_distance, 1),
                'unassigned_people': self.optimized_unassigned,
                'bottlenecks_count': self.optimized_bottlenecks_count,
                'objective_score': round(self.objective_score_optimized, 4),
                'routes': self.get_optimized_routes(),
                'exits': self.get_optimized_exits(),
                'bottlenecks': self.get_optimized_bottlenecks()
            },
            'comparison': {
                'time_reduction_percentage': round(self.time_reduction_percentage, 1),
                'time_saved_sec': round(max(0.0, self.baseline_time - self.optimized_time), 1),
                'congestion_reduction_percentage': round(self.congestion_reduction_percentage, 1),
                'distance_change_percentage': round(self.distance_change_percentage, 1),
                'bottlenecks_reduced': max(0, self.baseline_bottlenecks_count - self.optimized_bottlenecks_count),
                'bottlenecks_reduction_percentage': round(self.bottlenecks_reduction_percentage, 1),
                'objective_improvement_percentage': round(
                    ((self.objective_score_baseline - self.objective_score_optimized) / max(0.001, self.objective_score_baseline)) * 100.0, 1
                ) if self.objective_score_baseline > 0 else 0.0
            },
            'weights': self.get_weights(),
            'iterations': self.iterations,
            'explanations': self.get_explanations(),
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'disclaimer': "Simulation-based evacuation recommendation — For Academic Demonstration"
        }

    def __repr__(self):
        return f"<OptimizationResult #{self.id}: Baseline {self.baseline_time}s -> Optimized {self.optimized_time}s ({self.status})>"
