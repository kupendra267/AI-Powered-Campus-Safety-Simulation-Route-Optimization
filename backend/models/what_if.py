"""
What-If Scenario and Comparative Simulation Database Models (Phase 8)
======================================================================
Defines data structures for hypothetical What-If scenarios, parameter specifications,
isolated simulation/optimization results, baseline comparisons, and explainable AI shift rationale.

Academic Project Notice:
Simulation-based evacuation recommendation — For Academic Demonstration.
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from backend.extensions import db


class WhatIfScenario(db.Model):
    __tablename__ = 'what_if_scenarios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Base Reference
    base_simulation_id = db.Column(db.Integer, db.ForeignKey('simulations.id', ondelete='SET NULL'), nullable=True)
    base_scenario_id = db.Column(db.Integer, db.ForeignKey('emergency_scenarios.id', ondelete='SET NULL'), nullable=True)
    
    # Scenario Configuration
    # EXIT_BLOCKED, PATH_BLOCKED, CROWD_INCREASE, CROWD_DECREASE, CROWD_OVERRIDE, MULTIPLE_FAILURES, PEAK_HOUR
    scenario_type = db.Column(db.String(50), nullable=False, default='MULTIPLE_FAILURES')
    
    # JSON-encoded parameters: e.g. {"blocked_exit_ids": [1], "blocked_path_ids": [2, 3], "crowd_modifications": [...]}
    parameters = db.Column(db.Text, nullable=False, default='{}')
    
    # Baseline vs Scenario Execution Metrics (JSON-encoded)
    baseline_metrics = db.Column(db.Text, nullable=False, default='{}')
    scenario_metrics = db.Column(db.Text, nullable=False, default='{}')
    comparison = db.Column(db.Text, nullable=False, default='{}')
    
    # Full Result Payloads (JSON-encoded Phase 6 Simulation & Phase 7 Optimization)
    simulation_result = db.Column(db.Text, nullable=False, default='{}')
    optimization_result = db.Column(db.Text, nullable=False, default='{}')
    
    # Explainable AI Statements (JSON-encoded array of shift analysis strings)
    explanations = db.Column(db.Text, nullable=False, default='[]')
    
    # Status & Audit
    status = db.Column(db.String(20), nullable=False, default='CREATED')  # CREATED, RUNNING, COMPLETED, FAILED
    error_message = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    base_simulation = db.relationship('Simulation', backref=db.backref('what_if_scenarios', lazy=True))
    base_scenario = db.relationship('EmergencyScenario', backref=db.backref('what_if_scenarios', lazy=True))
    author = db.relationship('User', backref=db.backref('what_if_scenarios', lazy=True))

    def get_parameters(self) -> Dict[str, Any]:
        try:
            return json.loads(self.parameters or '{}')
        except Exception:
            return {}

    def get_baseline_metrics(self) -> Dict[str, Any]:
        try:
            return json.loads(self.baseline_metrics or '{}')
        except Exception:
            return {}

    def get_scenario_metrics(self) -> Dict[str, Any]:
        try:
            return json.loads(self.scenario_metrics or '{}')
        except Exception:
            return {}

    def get_comparison(self) -> Dict[str, Any]:
        try:
            return json.loads(self.comparison or '{}')
        except Exception:
            return {}

    def get_simulation_result(self) -> Dict[str, Any]:
        try:
            return json.loads(self.simulation_result or '{}')
        except Exception:
            return {}

    def get_optimization_result(self) -> Dict[str, Any]:
        try:
            return json.loads(self.optimization_result or '{}')
        except Exception:
            return {}

    def get_explanations(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.explanations or '[]')
        except Exception:
            return []

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'base_simulation_id': self.base_simulation_id,
            'base_scenario_id': self.base_scenario_id,
            'base_scenario_name': self.base_scenario.name if self.base_scenario else (
                self.base_simulation.scenario.name if (self.base_simulation and self.base_simulation.scenario) else 'Base Campus Graph'
            ),
            'scenario_type': self.scenario_type,
            'parameters': self.get_parameters(),
            'baseline_metrics': self.get_baseline_metrics(),
            'scenario_metrics': self.get_scenario_metrics(),
            'comparison': self.get_comparison(),
            'simulation_result': self.get_simulation_result(),
            'optimization_result': self.get_optimization_result(),
            'explanations': self.get_explanations(),
            'status': self.status,
            'error_message': self.error_message,
            'created_by': self.created_by,
            'created_by_name': self.author.name if self.author else 'System Admin',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

    def __repr__(self):
        return f"<WhatIfScenario #{self.id}: {self.name} [{self.scenario_type} - {self.status}]>"
