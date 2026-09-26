"""
Model Training & Evaluation Pipeline
====================================
Trains baseline (Linear Regression) and advanced regression models (Random Forest,
Gradient Boosting, HistGradientBoosting) with chronological time-series splitting,
calculates genuine evaluation metrics (MAE, RMSE, R²), selects the best model,
and serializes artifacts for production deployment.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from backend.ml.generate_dataset import generate_campus_crowd_dataset, DATASET_DISCLAIMER
from backend.ml.preprocessing import CrowdDataPreprocessor

# Path configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")

MODEL_PATH = os.path.join(MODELS_DIR, "crowd_model.joblib")
PREPROCESSOR_PATH = os.path.join(MODELS_DIR, "preprocessing.joblib")
FEATURE_INFO_PATH = os.path.join(MODELS_DIR, "feature_info.json")
METRICS_PATH = os.path.join(MODELS_DIR, "metrics.json")


def compute_metrics(y_true, y_pred):
    """Computes MAE, RMSE, and R2 regression performance metrics."""
    mae = float(mean_absolute_error(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_true, y_pred))
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2_score": round(r2, 4)
    }


def train_and_evaluate_models(df, model_version="v1.0.0"):
    """
    Executes full training lifecycle:
    1. Chronological Train/Val/Test Split (Avoid temporal leakage)
    2. Feature Preprocessing
    3. Baseline vs Advanced Model Training
    4. Metric Calculation (MAE, RMSE, R²)
    5. Best Model Selection and Serialization
    """
    print("================================================================")
    print("  AI-Powered Campus Crowd Prediction Model Training Pipeline    ")
    print("================================================================")
    print(f"[*] Dataset Size: {len(df)} records across {df['location_id'].nunique()} facilities")

    # 1. Chronological Split (70% Train, 15% Validation, 15% Test)
    if 'timestamp' in df.columns:
        df = df.sort_values(by=['timestamp', 'location_id']).reset_index(drop=True)

    n = len(df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)

    train_df = df.iloc[:train_end].copy()
    val_df = df.iloc[train_end:val_end].copy()
    test_df = df.iloc[val_end:].copy()

    print(f"[*] Chronological Split: Train={len(train_df)} | Val={len(val_df)} | Test={len(test_df)}")

    # 2. Preprocessing & Feature Extraction
    preprocessor = CrowdDataPreprocessor()
    X_train = preprocessor.fit_transform(train_df)
    y_train = train_df[CrowdDataPreprocessor.TARGET_FEATURE].values

    X_val = preprocessor.transform(val_df)
    y_val = val_df[CrowdDataPreprocessor.TARGET_FEATURE].values

    X_test = preprocessor.transform(test_df)
    y_test = test_df[CrowdDataPreprocessor.TARGET_FEATURE].values

    # 3. Model Candidates
    candidates = {
        "Linear Regression (Baseline)": LinearRegression(),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=120, 
            max_depth=16, 
            min_samples_split=4, 
            random_state=42, 
            n_jobs=-1
        ),
        "HistGradientBoosting Regressor": HistGradientBoostingRegressor(
            max_iter=150, 
            max_depth=12, 
            learning_rate=0.08, 
            random_state=42
        ),
        "Gradient Boosting Regressor": GradientBoostingRegressor(
            n_estimators=100, 
            max_depth=6, 
            learning_rate=0.1, 
            random_state=42
        )
    }

    comparison_results = {}
    best_model_name = None
    best_model_instance = None
    best_val_r2 = -float("inf")

    print("\n----------------------------------------------------------------")
    print(f"{'Model Candidate':<32} | {'Val MAE':<9} | {'Val RMSE':<9} | {'Val R2':<8}")
    print("----------------------------------------------------------------")

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        val_preds = model.predict(X_val)
        val_metrics = compute_metrics(y_val, val_preds)

        train_preds = model.predict(X_train)
        train_metrics = compute_metrics(y_train, train_preds)

        comparison_results[name] = {
            "train": train_metrics,
            "validation": val_metrics
        }

        print(f"{name:<32} | {val_metrics['mae']:<9.2f} | {val_metrics['rmse']:<9.2f} | {val_metrics['r2_score']:<8.4f}")

        # Model selection heuristic (favor higher R2 score on validation set)
        if val_metrics['r2_score'] > best_val_r2:
            best_val_r2 = val_metrics['r2_score']
            best_model_name = name
            best_model_instance = model

    print("----------------------------------------------------------------")
    print(f" [SELECTED] Champion Model: {best_model_name} (Val R2 = {best_val_r2:.4f})")

    # 4. Final Evaluation on Unseen Test Set
    test_preds = best_model_instance.predict(X_test)
    test_metrics = compute_metrics(y_test, test_preds)

    print(f"\n[*] Test Set Final Evaluation for {best_model_name}:")
    print(f"    - Test MAE  : {test_metrics['mae']}")
    print(f"    - Test RMSE : {test_metrics['rmse']}")
    print(f"    - Test R2   : {test_metrics['r2_score']}")

    # 5. Extract Feature Importance (if supported)
    feature_importances = []
    if hasattr(best_model_instance, "feature_importances_") and preprocessor.feature_names:
        importances = best_model_instance.feature_importances_
        sorted_indices = np.argsort(importances)[::-1]
        for idx in sorted_indices[:15]:
            if idx < len(preprocessor.feature_names):
                feature_importances.append({
                    "feature": preprocessor.feature_names[idx],
                    "importance": round(float(importances[idx]), 4)
                })

    # 6. Sample Actual vs Predicted Test Data Points (for frontend evaluation scatter/chart)
    sample_indices = np.linspace(0, len(y_test) - 1, num=min(60, len(y_test)), dtype=int)
    test_samples = []
    for idx in sample_indices:
        test_samples.append({
            "timestamp": str(test_df.iloc[idx].get('timestamp', f"Step {idx}")),
            "location_name": str(test_df.iloc[idx].get('location_name', f"Facility {test_df.iloc[idx].get('location_id')}")),
            "actual_crowd": int(round(y_test[idx])),
            "predicted_crowd": max(0, int(round(test_preds[idx]))),
            "capacity": int(test_df.iloc[idx].get('capacity', 500))
        })

    # 7. Serialize Artifacts
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Save Model & Preprocessor
    joblib.dump(best_model_instance, MODEL_PATH)
    preprocessor.save(PREPROCESSOR_PATH)

    # Save Feature Info
    feature_info = {
        "model_name": best_model_name,
        "model_version": model_version,
        "features": preprocessor.feature_names,
        "numerical_features": CrowdDataPreprocessor.NUMERICAL_FEATURES,
        "categorical_features": CrowdDataPreprocessor.CATEGORICAL_FEATURES,
        "feature_importances": feature_importances,
        "trained_at": datetime.now(timezone.utc).isoformat()
    }
    with open(FEATURE_INFO_PATH, "w") as f:
        json.dump(feature_info, f, indent=2)

    # Save Comprehensive Metrics
    metrics_data = {
        "model_version": model_version,
        "model_name": best_model_name,
        "dataset_type": DATASET_DISCLAIMER,
        "dataset_size": len(df),
        "train_size": len(train_df),
        "val_size": len(val_df),
        "test_size": len(test_df),
        "test_metrics": test_metrics,
        "validation_metrics": comparison_results[best_model_name]["validation"],
        "all_model_comparisons": comparison_results,
        "feature_importances": feature_importances,
        "test_evaluation_samples": test_samples,
        "trained_at": datetime.now(timezone.utc).isoformat()
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_data, f, indent=2)

    print(f"\n [OK] Successfully saved artifacts:")
    print(f"     - Model: {MODEL_PATH}")
    print(f"     - Preprocessing Pipeline: {PREPROCESSOR_PATH}")
    print(f"     - Metrics Summary: {METRICS_PATH}")
    print(f"     - Feature Info: {FEATURE_INFO_PATH}")
    print("================================================================\n")

    return {
        "success": True,
        "model_name": best_model_name,
        "model_version": model_version,
        "metrics": test_metrics,
        "dataset_size": len(df),
        "all_comparisons": comparison_results
    }


def run_full_training_pipeline(days=90):
    """Generates dataset and runs full model training pipeline."""
    csv_path = os.path.join(DATA_DIR, "campus_crowd_synthetic.csv")
    df = generate_campus_crowd_dataset(days=days, output_path=csv_path)
    return train_and_evaluate_models(df)


if __name__ == "__main__":
    run_full_training_pipeline()
