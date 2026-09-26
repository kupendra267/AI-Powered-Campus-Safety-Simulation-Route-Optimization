import json
from datetime import datetime, timezone
from backend.extensions import db

class MLModelMetadata(db.Model):
    __tablename__ = 'ml_model_metadata'

    id = db.Column(db.Integer, primary_key=True)
    model_version = db.Column(db.String(50), nullable=False, unique=True)
    model_name = db.Column(db.String(100), nullable=False)
    mae = db.Column(db.Float, nullable=False)
    rmse = db.Column(db.Float, nullable=False)
    r2_score = db.Column(db.Float, nullable=False)
    dataset_size = db.Column(db.Integer, nullable=False)
    dataset_type = db.Column(db.String(120), nullable=False, default="Synthetic/Simulation Data — For Academic Demonstration")
    training_features = db.Column(db.Text, nullable=False, default='[]')
    is_active = db.Column(db.Boolean, default=True)
    trained_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def get_features(self):
        try:
            return json.loads(self.training_features)
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'model_version': self.model_version,
            'model_name': self.model_name,
            'mae': round(self.mae, 3) if self.mae is not None else None,
            'rmse': round(self.rmse, 3) if self.rmse is not None else None,
            'r2_score': round(self.r2_score, 4) if self.r2_score is not None else None,
            'dataset_size': self.dataset_size,
            'dataset_type': self.dataset_type,
            'training_features': self.get_features(),
            'is_active': self.is_active,
            'trained_at': self.trained_at.isoformat() if self.trained_at else None
        }

    def __repr__(self):
        return f"<MLModelMetadata {self.model_version}: {self.model_name} (R²={self.r2_score:.3f})>"


class PredictionLog(db.Model):
    __tablename__ = 'prediction_logs'

    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('buildings.id', ondelete='CASCADE'), nullable=False, index=True)
    target_time = db.Column(db.DateTime, nullable=False, index=True)
    predicted_crowd = db.Column(db.Integer, nullable=False)
    predicted_density = db.Column(db.Float, nullable=False)
    congestion_level = db.Column(db.String(20), nullable=False, default='LOW')
    horizon_hours = db.Column(db.Integer, nullable=False, default=1)
    model_version = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    building = db.relationship('Building', backref=db.backref('predictions', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'location_id': self.location_id,
            'location_name': self.building.name if self.building else f"Location #{self.location_id}",
            'target_time': self.target_time.isoformat() if self.target_time else None,
            'predicted_crowd': self.predicted_crowd,
            'predicted_density': self.predicted_density,
            'congestion_level': self.congestion_level,
            'horizon_hours': self.horizon_hours,
            'model_version': self.model_version,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<PredictionLog {self.id}: Loc {self.location_id} -> {self.predicted_crowd} ({self.congestion_level})>"
