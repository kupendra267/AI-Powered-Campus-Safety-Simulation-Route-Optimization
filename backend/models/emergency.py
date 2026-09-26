"""
Emergency Scenario and Evacuation Simulation Database Models
=============================================================
Defines data structures for Emergency Scenarios, Simulation Executions,
and Detailed Route/Exit Allocation Results.
"""

import json
from datetime import datetime, timezone
from backend.extensions import db


class EmergencyScenario(db.Model):
    __tablename__ = 'emergency_scenarios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    emergency_type = db.Column(db.String(50), nullable=False, default='GENERAL_EVACUATION')  # FIRE, EARTHQUAKE, FLOOD, GAS_LEAK, GENERAL_EVACUATION
    emergency_location_id = db.Column(db.Integer, db.ForeignKey('buildings.id', ondelete='SET NULL'), nullable=True)
    emergency_node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='SET NULL'), nullable=True)
    severity = db.Column(db.String(20), nullable=False, default='HIGH')  # LOW, MEDIUM, HIGH, CRITICAL
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='CREATED')  # CREATED, ACTIVE, COMPLETED, CANCELLED
    affected_people_count = db.Column(db.Integer, nullable=False, default=500)
    
    # JSON arrays of path IDs to block and exit IDs to disable
    blocked_path_ids = db.Column(db.Text, nullable=False, default='[]')
    disabled_exit_ids = db.Column(db.Text, nullable=False, default='[]')
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = db.Column(db.DateTime, nullable=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    building = db.relationship('Building', backref=db.backref('emergency_scenarios', lazy=True))
    node = db.relationship('Node', backref=db.backref('emergency_scenarios', lazy=True))
    simulations = db.relationship('Simulation', backref='scenario', lazy=True, cascade='all, delete-orphan')

    def get_blocked_path_ids(self):
        try:
            return json.loads(self.blocked_path_ids or '[]')
        except Exception:
            return []

    def get_disabled_exit_ids(self):
        try:
            return json.loads(self.disabled_exit_ids or '[]')
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'emergency_type': self.emergency_type,
            'emergency_location_id': self.emergency_location_id,
            'location_name': self.building.name if self.building else (self.node.name if self.node else "Campus Wide"),
            'location_latitude': self.building.latitude if self.building else (self.node.latitude if self.node else None),
            'location_longitude': self.building.longitude if self.building else (self.node.longitude if self.node else None),
            'emergency_node_id': self.emergency_node_id,
            'severity': self.severity,
            'description': self.description,
            'status': self.status,
            'affected_people_count': self.affected_people_count,
            'blocked_path_ids': self.get_blocked_path_ids(),
            'disabled_exit_ids': self.get_disabled_exit_ids(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'latest_simulation_id': self.simulations[-1].id if self.simulations else None
        }

    def __repr__(self):
        return f"<EmergencyScenario #{self.id}: {self.name} [{self.emergency_type} - {self.status}]>"


class Simulation(db.Model):
    __tablename__ = 'simulations'

    id = db.Column(db.Integer, primary_key=True)
    scenario_id = db.Column(db.Integer, db.ForeignKey('emergency_scenarios.id', ondelete='CASCADE'), nullable=True)
    people_count = db.Column(db.Integer, nullable=False, default=0)
    simulation_mode = db.Column(db.String(50), nullable=False, default='LIVE_CROWD')  # LIVE_CROWD, MANUAL, PREDICTIVE_ML
    estimated_evacuation_time = db.Column(db.Float, nullable=False, default=0.0)  # Seconds
    max_congestion = db.Column(db.String(20), nullable=False, default='LOW')  # LOW, MEDIUM, HIGH, CRITICAL
    bottleneck_count = db.Column(db.Integer, nullable=False, default=0)
    successfully_assigned = db.Column(db.Integer, nullable=False, default=0)
    unassigned_people = db.Column(db.Integer, nullable=False, default=0)
    evacuation_progress_percentage = db.Column(db.Float, nullable=False, default=100.0)
    status = db.Column(db.String(20), nullable=False, default='COMPLETED')  # COMPLETED, FAILED, PARTIAL
    
    # JSON-encoded discrete time-series steps for visual playback
    timeline_steps = db.Column(db.Text, nullable=False, default='[]')
    
    # JSON-encoded summary of bottlenecks and exit load distribution
    bottlenecks_summary = db.Column(db.Text, nullable=False, default='[]')
    exit_utilization_summary = db.Column(db.Text, nullable=False, default='[]')
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    results = db.relationship('SimulationResult', backref='simulation', lazy=True, cascade='all, delete-orphan')

    def get_timeline_steps(self):
        try:
            return json.loads(self.timeline_steps or '[]')
        except Exception:
            return []

    def get_bottlenecks(self):
        try:
            return json.loads(self.bottlenecks_summary or '[]')
        except Exception:
            return []

    def get_exit_utilization(self):
        try:
            return json.loads(self.exit_utilization_summary or '[]')
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'scenario_id': self.scenario_id,
            'scenario_name': self.scenario.name if self.scenario else "Ad-Hoc Evacuation Simulation",
            'emergency_type': self.scenario.emergency_type if self.scenario else "GENERAL_EVACUATION",
            'people_count': self.people_count,
            'simulation_mode': self.simulation_mode,
            'estimated_evacuation_time': round(self.estimated_evacuation_time, 1),
            'estimated_time_formatted': f"{int(self.estimated_evacuation_time // 60)}m {int(self.estimated_evacuation_time % 60):02d}s" if self.estimated_evacuation_time >= 60 else f"{int(self.estimated_evacuation_time)}s",
            'max_congestion': self.max_congestion,
            'bottleneck_count': self.bottleneck_count,
            'successfully_assigned': self.successfully_assigned,
            'unassigned_people': self.unassigned_people,
            'evacuation_progress_percentage': round(self.evacuation_progress_percentage, 1),
            'status': self.status,
            'bottlenecks': self.get_bottlenecks(),
            'exit_utilization': self.get_exit_utilization(),
            'timeline_steps': self.get_timeline_steps(),
            'total_routes': len(self.results) if self.results else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'disclaimer': "Simulation-based evacuation recommendation — For Academic Demonstration"
        }

    def __repr__(self):
        return f"<Simulation #{self.id}: {self.people_count} people -> {self.estimated_evacuation_time}s ({self.status})>"


class SimulationResult(db.Model):
    __tablename__ = 'simulation_results'

    id = db.Column(db.Integer, primary_key=True)
    simulation_id = db.Column(db.Integer, db.ForeignKey('simulations.id', ondelete='CASCADE'), nullable=False)
    start_location_id = db.Column(db.Integer, nullable=False)
    start_location_name = db.Column(db.String(120), nullable=False)
    exit_id = db.Column(db.Integer, nullable=False)
    exit_name = db.Column(db.String(120), nullable=False)
    route_nodes = db.Column(db.Text, nullable=False, default='[]')  # JSON list of node dicts/IDs
    path_ids = db.Column(db.Text, nullable=False, default='[]')      # JSON list of path IDs
    people_assigned = db.Column(db.Integer, nullable=False, default=0)
    distance = db.Column(db.Float, nullable=False, default=0.0)      # Meters
    estimated_time = db.Column(db.Float, nullable=False, default=0.0) # Seconds
    congestion = db.Column(db.String(20), nullable=False, default='LOW')
    utilization = db.Column(db.Float, nullable=False, default=0.0)   # Percentage
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def get_route(self):
        try:
            return json.loads(self.route_nodes or '[]')
        except Exception:
            return []

    def get_path_ids(self):
        try:
            return json.loads(self.path_ids or '[]')
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'simulation_id': self.simulation_id,
            'start_location_id': self.start_location_id,
            'start_location_name': self.start_location_name,
            'exit_id': self.exit_id,
            'exit_name': self.exit_name,
            'route_nodes': self.get_route(),
            'path_ids': self.get_path_ids(),
            'people_assigned': self.people_assigned,
            'distance': round(self.distance, 1),
            'estimated_time': round(self.estimated_time, 1),
            'estimated_time_formatted': f"{int(self.estimated_time // 60)}m {int(self.estimated_time % 60):02d}s" if self.estimated_time >= 60 else f"{int(self.estimated_time)}s",
            'congestion': self.congestion,
            'utilization': round(self.utilization, 1),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<SimulationResult #{self.id}: {self.start_location_name} -> {self.exit_name} ({self.people_assigned} people)>"
