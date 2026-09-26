"""
Crowd Prediction Service
========================
Coordinates AI/ML inference, feature extraction, multi-step rolling forecasting,
congestion severity estimation, alert dispatching, and model lifecycle management.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

from backend.extensions import db
from backend.models.campus import Building
from backend.models.crowd import CrowdData, SystemAlert
from backend.models.prediction import MLModelMetadata, PredictionLog
from backend.ml.train_model import (
    MODEL_PATH, 
    PREPROCESSOR_PATH, 
    METRICS_PATH, 
    FEATURE_INFO_PATH,
    run_full_training_pipeline,
    DATASET_DISCLAIMER
)

class CrowdPredictionService:
    _model = None
    _preprocessor = None
    _metrics = None
    _feature_info = None
    _last_mtime = 0

    @classmethod
    def _ensure_artifacts_loaded(cls, force=False):
        """Lazy loads model, preprocessor, and metadata from disk, re-syncing if disk files change."""
        current_mtime = os.path.getmtime(MODEL_PATH) if os.path.exists(MODEL_PATH) else 0
        needs_reload = force or cls._model is None or cls._preprocessor is None or current_mtime > cls._last_mtime

        if needs_reload:
            if not os.path.exists(MODEL_PATH) or not os.path.exists(PREPROCESSOR_PATH):
                print("[*] ML Model artifacts not found. Initiating initial automated training...")
                run_full_training_pipeline(days=90)

            cls._model = joblib.load(MODEL_PATH)
            cls._preprocessor = joblib.load(PREPROCESSOR_PATH)
            cls._last_mtime = os.path.getmtime(MODEL_PATH) if os.path.exists(MODEL_PATH) else 0

            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH, "r") as f:
                    cls._metrics = json.load(f)

            if os.path.exists(FEATURE_INFO_PATH):
                with open(FEATURE_INFO_PATH, "r") as f:
                    cls._feature_info = json.load(f)

    @classmethod
    def get_recent_crowd_context(cls, location_id):
        """Retrieves historical lag features from recent CrowdData records."""
        records = CrowdData.query.filter_by(location_id=location_id)\
            .order_by(CrowdData.timestamp.desc())\
            .limit(4).all()

        building = db.session.get(Building, location_id)
        capacity = building.capacity if building else 500

        if not records:
            # Cold-start defaults
            default_count = int(capacity * 0.25)
            return {
                "current_crowd": default_count,
                "current_density": round((default_count / capacity) * 100, 2),
                "current_congestion": "LOW",
                "previous_crowd": default_count,
                "lag_2_crowd": default_count,
                "rolling_average_3h": default_count,
                "previous_density": round((default_count / capacity) * 100, 2),
                "capacity": capacity
            }

        counts = [r.crowd_count for r in records]
        current_crowd = counts[0]
        prev_crowd = counts[1] if len(counts) > 1 else current_crowd
        lag_2_crowd = counts[2] if len(counts) > 2 else prev_crowd
        rolling_avg = float(np.mean(counts[:3]))

        return {
            "current_crowd": current_crowd,
            "current_density": records[0].density_percentage,
            "current_congestion": records[0].congestion_level,
            "previous_crowd": prev_crowd,
            "lag_2_crowd": lag_2_crowd,
            "rolling_average_3h": round(rolling_avg, 1),
            "previous_density": round((prev_crowd / capacity) * 100, 2),
            "capacity": capacity
        }

    @classmethod
    def predict_future(cls, location_id, prediction_time=None, log_prediction=True):
        """
        Runs ML model inference for a specific facility at target timestamp.
        Calculates predicted crowd count, density %, and congestion classification.
        """
        cls._ensure_artifacts_loaded()

        building = db.session.get(Building, int(location_id))
        if not building:
            return {"success": False, "message": f"Campus location with ID {location_id} not found."}, 404

        # Parse target prediction time
        now = datetime.now(timezone.utc)
        if prediction_time is None:
            target_dt = now + timedelta(hours=1)
        elif isinstance(prediction_time, str):
            try:
                target_dt = datetime.fromisoformat(prediction_time.replace('Z', '+00:00'))
            except Exception:
                target_dt = now + timedelta(hours=1)
        elif isinstance(prediction_time, datetime):
            target_dt = prediction_time
        else:
            target_dt = now + timedelta(hours=1)

        # Ensure UTC tz
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)

        # Retrieve recent historical context
        ctx = cls.get_recent_crowd_context(building.id)

        # Horizon in hours
        horizon_hours = max(1, int(round((target_dt - now).total_seconds() / 3600.0)))

        # Build feature row
        row = {
            "location_id": str(building.id),
            "facility_type": building.type,
            "capacity": building.capacity,
            "hour": target_dt.hour,
            "day_of_week": target_dt.weekday(),
            "day_of_month": target_dt.day,
            "month": target_dt.month,
            "is_weekend": 1 if target_dt.weekday() >= 5 else 0,
            "previous_crowd": ctx["previous_crowd"],
            "lag_2_crowd": ctx["lag_2_crowd"],
            "rolling_average_3h": ctx["rolling_average_3h"],
            "previous_density": ctx["previous_density"]
        }

        feature_df = pd.DataFrame([row])
        X_trans = cls._preprocessor.transform(feature_df)

        # Model Inference
        raw_pred = float(cls._model.predict(X_trans)[0])
        predicted_crowd = max(0, int(round(raw_pred)))

        # Enforce realistic ceiling based on facility capacity with buffer
        max_possible = int(building.capacity * 1.35)
        predicted_crowd = min(predicted_crowd, max_possible)

        # Compute Density & Congestion using standardized formula
        density_pct, congestion_lvl = CrowdData.compute_density_and_congestion(predicted_crowd, building.capacity)

        delta_crowd = predicted_crowd - ctx["current_crowd"]

        # Alert generation for critical predictions
        if congestion_lvl in ['HIGH', 'CRITICAL']:
            alert_severity = 'DANGER' if congestion_lvl == 'CRITICAL' else 'WARNING'
            existing_alert = SystemAlert.query.filter_by(
                related_location_id=building.id,
                alert_type='PREDICTED_CONGESTION',
                is_active=True
            ).first()

            if not existing_alert:
                alert = SystemAlert(
                    title=f"Predicted {congestion_lvl} Crowd at {building.name}",
                    message=f"AI model projects {predicted_crowd} occupants ({density_pct}% capacity) in ~{horizon_hours}h. Consider early crowd dispersal or secondary pathway routing.",
                    alert_type='PREDICTED_CONGESTION',
                    severity=alert_severity,
                    related_location_id=building.id,
                    is_active=True
                )
                db.session.add(alert)
                db.session.commit()

        # Log prediction
        if log_prediction:
            pred_log = PredictionLog(
                location_id=building.id,
                target_time=target_dt,
                predicted_crowd=predicted_crowd,
                predicted_density=density_pct,
                congestion_level=congestion_lvl,
                horizon_hours=horizon_hours,
                model_version=cls._metrics.get("model_version", "v1.0.0") if cls._metrics else "v1.0.0"
            )
            db.session.add(pred_log)
            db.session.commit()

        result = {
            "location_id": building.id,
            "location_name": building.name,
            "building_code": building.building_code,
            "facility_type": building.type,
            "capacity": building.capacity,
            "current_crowd": ctx["current_crowd"],
            "current_density": ctx["current_density"],
            "current_congestion": ctx["current_congestion"],
            "prediction_time": target_dt.isoformat(),
            "predicted_crowd": predicted_crowd,
            "predicted_density": density_pct,
            "congestion_level": congestion_lvl,
            "delta_crowd": delta_crowd,
            "horizon_hours": horizon_hours,
            "model_version": cls._metrics.get("model_version", "v1.0.0") if cls._metrics else "v1.0.0",
            "dataset_type": DATASET_DISCLAIMER
        }

        return {"success": True, "data": result}, 200

    @classmethod
    def predict_multi_step(cls, location_id, horizons_hours=None):
        """
        Generates continuous multi-step rolling predictions (e.g. +1h, +2h, +3h, +4h, +6h, +8h).
        Feeds forward predictions into sequential lag estimates.
        """
        cls._ensure_artifacts_loaded()

        if horizons_hours is None:
            horizons_hours = [1, 2, 3, 4, 6, 8]

        building = db.session.get(Building, int(location_id))
        if not building:
            return {"success": False, "message": f"Building {location_id} not found."}, 404

        now = datetime.now(timezone.utc)
        ctx = cls.get_recent_crowd_context(building.id)

        forecast_steps = []
        sim_prev_crowd = ctx["current_crowd"]
        sim_lag2_crowd = ctx["previous_crowd"]
        rolling_buffer = [sim_lag2_crowd, sim_prev_crowd]

        for h in horizons_hours:
            target_dt = now + timedelta(hours=h)
            rolling_avg = float(np.mean(rolling_buffer[-3:]))
            prev_dens = round((sim_prev_crowd / building.capacity) * 100, 2)

            row = {
                "location_id": str(building.id),
                "facility_type": building.type,
                "capacity": building.capacity,
                "hour": target_dt.hour,
                "day_of_week": target_dt.weekday(),
                "day_of_month": target_dt.day,
                "month": target_dt.month,
                "is_weekend": 1 if target_dt.weekday() >= 5 else 0,
                "previous_crowd": sim_prev_crowd,
                "lag_2_crowd": sim_lag2_crowd,
                "rolling_average_3h": round(rolling_avg, 1),
                "previous_density": prev_dens
            }

            feature_df = pd.DataFrame([row])
            X_trans = cls._preprocessor.transform(feature_df)
            raw_pred = float(cls._model.predict(X_trans)[0])
            pred_count = max(0, min(int(round(raw_pred)), int(building.capacity * 1.35)))

            density_pct, congestion_lvl = CrowdData.compute_density_and_congestion(pred_count, building.capacity)

            forecast_steps.append({
                "horizon_hours": h,
                "target_time": target_dt.isoformat(),
                "display_time": target_dt.strftime("%I:%M %p"),
                "predicted_crowd": pred_count,
                "predicted_density": density_pct,
                "congestion_level": congestion_lvl,
                "delta_from_current": pred_count - ctx["current_crowd"]
            })

            # Roll state forward
            sim_lag2_crowd = sim_prev_crowd
            sim_prev_crowd = pred_count
            rolling_buffer.append(pred_count)

        # Calculate overall trend
        first_step = forecast_steps[0]["predicted_crowd"]
        last_step = forecast_steps[-1]["predicted_crowd"]
        if last_step > ctx["current_crowd"] * 1.15:
            trend = "RISING"
        elif last_step < ctx["current_crowd"] * 0.85:
            trend = "FALLING"
        else:
            trend = "STABLE"

        return {
            "success": True,
            "data": {
                "location_id": building.id,
                "location_name": building.name,
                "building_code": building.building_code,
                "capacity": building.capacity,
                "current_crowd": ctx["current_crowd"],
                "current_density": ctx["current_density"],
                "current_congestion": ctx["current_congestion"],
                "trend": trend,
                "forecast": forecast_steps,
                "dataset_type": DATASET_DISCLAIMER
            }
        }, 200

    @classmethod
    def predict_campus_summary(cls, horizon_hours=1):
        """
        Generates campus-wide predicted congestion distribution across all facilities.
        Useful for live map overlay layer and global analytics dashboard.
        """
        cls._ensure_artifacts_loaded()

        buildings = Building.query.order_by(Building.name).all()
        now = datetime.now(timezone.utc)
        target_dt = now + timedelta(hours=int(horizon_hours))

        predictions = []
        hotspots = []
        total_current_crowd = 0
        total_predicted_crowd = 0

        for b in buildings:
            ctx = cls.get_recent_crowd_context(b.id)
            
            row = {
                "location_id": str(b.id),
                "facility_type": b.type,
                "capacity": b.capacity,
                "hour": target_dt.hour,
                "day_of_week": target_dt.weekday(),
                "day_of_month": target_dt.day,
                "month": target_dt.month,
                "is_weekend": 1 if target_dt.weekday() >= 5 else 0,
                "previous_crowd": ctx["previous_crowd"],
                "lag_2_crowd": ctx["lag_2_crowd"],
                "rolling_average_3h": ctx["rolling_average_3h"],
                "previous_density": ctx["previous_density"]
            }

            feature_df = pd.DataFrame([row])
            X_trans = cls._preprocessor.transform(feature_df)
            pred_count = max(0, min(int(round(float(cls._model.predict(X_trans)[0]))), int(b.capacity * 1.35)))

            density_pct, congestion_lvl = CrowdData.compute_density_and_congestion(pred_count, b.capacity)

            pred_item = {
                "location_id": b.id,
                "location_name": b.name,
                "building_code": b.building_code,
                "facility_type": b.type,
                "latitude": b.latitude,
                "longitude": b.longitude,
                "capacity": b.capacity,
                "current_crowd": ctx["current_crowd"],
                "current_density": ctx["current_density"],
                "current_congestion": ctx["current_congestion"],
                "predicted_crowd": pred_count,
                "predicted_density": density_pct,
                "congestion_level": congestion_lvl,
                "delta": pred_count - ctx["current_crowd"]
            }
            predictions.append(pred_item)

            total_current_crowd += ctx["current_crowd"]
            total_predicted_crowd += pred_count

            if congestion_lvl in ['HIGH', 'CRITICAL']:
                hotspots.append(pred_item)

        return {
            "success": True,
            "data": {
                "target_time": target_dt.isoformat(),
                "horizon_hours": int(horizon_hours),
                "total_current_crowd": total_current_crowd,
                "total_predicted_crowd": total_predicted_crowd,
                "hotspots_count": len(hotspots),
                "hotspots": hotspots,
                "locations": predictions,
                "dataset_type": DATASET_DISCLAIMER
            }
        }, 200

    @classmethod
    def get_model_info(cls):
        """Returns comprehensive ML model metadata, architecture details, and evaluation metrics."""
        cls._ensure_artifacts_loaded()

        if not cls._metrics:
            return {"success": False, "message": "Model metrics not available. Please train model."}, 404

        return {
            "success": True,
            "data": cls._metrics
        }, 200

    @classmethod
    def retrain_model_on_demand(cls, days=90):
        """Triggers complete model retraining pipeline and updates DB metadata."""
        try:
            print(f"[*] On-Demand Model Retraining Triggered for {days} days...")
            result = run_full_training_pipeline(days=days)

            # Reload into memory
            cls._model = joblib.load(MODEL_PATH)
            cls._preprocessor = joblib.load(PREPROCESSOR_PATH)
            with open(METRICS_PATH, "r") as f:
                cls._metrics = json.load(f)
            with open(FEATURE_INFO_PATH, "r") as f:
                cls._feature_info = json.load(f)

            # Record in DB MLModelMetadata table
            new_version = f"v1.{int(datetime.now(timezone.utc).timestamp())}"
            metadata = MLModelMetadata(
                model_version=new_version,
                model_name=result["model_name"],
                mae=result["metrics"]["mae"],
                rmse=result["metrics"]["rmse"],
                r2_score=result["metrics"]["r2_score"],
                dataset_size=result["dataset_size"],
                dataset_type=DATASET_DISCLAIMER,
                training_features=json.dumps(cls._feature_info.get("features", [])),
                is_active=True
            )
            db.session.add(metadata)
            db.session.commit()

            return {
                "success": True,
                "message": f"ML Model {result['model_name']} retrained successfully.",
                "data": {
                    "model_version": new_version,
                    "model_name": result["model_name"],
                    "metrics": result["metrics"],
                    "dataset_size": result["dataset_size"]
                }
            }, 200

        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": f"Training failed: {str(e)}"}, 500
