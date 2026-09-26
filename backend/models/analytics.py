"""
Analytics & Performance Logging Database Models (Phase 9)
==========================================================
Defines database models for tracking route calculations, system execution
latencies, and data quality metrics for academic performance evaluation.
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.extensions import db


class RouteLog(db.Model):
    __tablename__ = 'route_logs'

    id = db.Column(db.Integer, primary_key=True)
    origin_name = db.Column(db.String(150), nullable=True)
    destination_name = db.Column(db.String(150), nullable=True)
    origin_node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='SET NULL'), nullable=True)
    destination_node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='SET NULL'), nullable=True)
    
    # SHORTEST, FASTEST, CROWD_AWARE, PREDICTIVE, ALTERNATIVE
    routing_mode = db.Column(db.String(50), nullable=False, default='SHORTEST', index=True)
    distance_meters = db.Column(db.Float, nullable=False, default=0.0)
    estimated_time_sec = db.Column(db.Float, nullable=False, default=0.0)
    max_congestion = db.Column(db.String(20), nullable=False, default='LOW')
    avg_congestion_score = db.Column(db.Float, nullable=False, default=0.0)
    risk_level = db.Column(db.String(20), nullable=False, default='LOW')
    node_count = db.Column(db.Integer, nullable=False, default=0)
    path_ids = db.Column(db.Text, nullable=False, default='[]')
    selected_exit_id = db.Column(db.Integer, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def get_path_ids(self):
        try:
            return json.loads(self.path_ids or '[]')
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'origin_name': self.origin_name,
            'destination_name': self.destination_name,
            'origin_node_id': self.origin_node_id,
            'destination_node_id': self.destination_node_id,
            'routing_mode': self.routing_mode,
            'distance_meters': round(self.distance_meters, 2),
            'estimated_time_sec': round(self.estimated_time_sec, 2),
            'max_congestion': self.max_congestion,
            'avg_congestion_score': round(self.avg_congestion_score, 2),
            'risk_level': self.risk_level,
            'node_count': self.node_count,
            'path_ids': self.get_path_ids(),
            'selected_exit_id': self.selected_exit_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PerformanceLog(db.Model):
    __tablename__ = 'performance_logs'

    id = db.Column(db.Integer, primary_key=True)
    operation = db.Column(db.String(80), nullable=False, index=True)
    execution_time_ms = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(20), nullable=False, default='SUCCESS')
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    @classmethod
    def record(cls, operation: str, execution_time_ms: float, status: str = 'SUCCESS', details: Optional[Dict[str, Any]] = None):
        try:
            log_entry = cls(
                operation=operation,
                execution_time_ms=round(float(execution_time_ms), 3),
                status=status,
                details=json.dumps(details) if details else None,
                timestamp=datetime.now(timezone.utc)
            )
            db.session.add(log_entry)
            db.session.commit()
            return log_entry
        except Exception:
            db.session.rollback()
            return None

    def to_dict(self):
        return {
            'id': self.id,
            'operation': self.operation,
            'execution_time_ms': round(self.execution_time_ms, 2),
            'status': self.status,
            'details': json.loads(self.details) if self.details else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
