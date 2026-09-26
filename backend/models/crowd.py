from datetime import datetime, timezone
from backend.extensions import db

class CrowdData(db.Model):
    __tablename__ = 'crowd_data'

    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('buildings.id', ondelete='CASCADE'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    crowd_count = db.Column(db.Integer, nullable=False, default=0)
    capacity = db.Column(db.Integer, nullable=False, default=500)
    density_percentage = db.Column(db.Float, nullable=False, default=0.0)
    congestion_level = db.Column(db.String(20), nullable=False, default='LOW')  # LOW, MEDIUM, HIGH, CRITICAL
    source = db.Column(db.String(50), nullable=False, default='SIMULATION')  # SIMULATION, SENSOR_FEED, MANUAL_ENTRY
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to Building
    building = db.relationship('Building', backref=db.backref('crowd_records', lazy=True, cascade='all, delete-orphan'))

    @staticmethod
    def compute_density_and_congestion(crowd_count, capacity):
        """
        Calculates density percentage and assigns congestion levels:
        0 - 40%      -> LOW
        41 - 70%     -> MEDIUM
        71 - 90%     -> HIGH
        91 - 100%+   -> CRITICAL
        """
        if not capacity or capacity <= 0:
            capacity = 1
        
        crowd_count = max(0, crowd_count)
        density = round((crowd_count / capacity) * 100, 2)

        if density <= 40.0:
            congestion = 'LOW'
        elif density <= 70.0:
            congestion = 'MEDIUM'
        elif density <= 90.0:
            congestion = 'HIGH'
        else:
            congestion = 'CRITICAL'

        return density, congestion

    def to_dict(self):
        return {
            'id': self.id,
            'location_id': self.location_id,
            'location_name': self.building.name if self.building else f"Location #{self.location_id}",
            'building_code': self.building.building_code if self.building else None,
            'latitude': self.building.latitude if self.building else None,
            'longitude': self.building.longitude if self.building else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'crowd_count': self.crowd_count,
            'capacity': self.capacity,
            'density_percentage': self.density_percentage,
            'congestion_level': self.congestion_level,
            'source': self.source,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<CrowdData {self.id}: Location {self.location_id} - {self.crowd_count}/{self.capacity} ({self.congestion_level})>"


class SystemAlert(db.Model):
    __tablename__ = 'system_alerts'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    alert_type = db.Column(db.String(30), nullable=False, default='CONGESTION')  # CONGESTION, EMERGENCY, PATH_BLOCKED, SYSTEM
    severity = db.Column(db.String(20), nullable=False, default='INFO')  # INFO, WARNING, DANGER
    related_location_id = db.Column(db.Integer, db.ForeignKey('buildings.id', ondelete='SET NULL'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    building = db.relationship('Building', backref=db.backref('alerts', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'alert_type': self.alert_type,
            'severity': self.severity,
            'related_location_id': self.related_location_id,
            'location_name': self.building.name if self.building else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<SystemAlert {self.id}: [{self.severity}] {self.title}>"
