"""
AI/ML Data Preprocessing Pipeline
=================================
Provides reproducible data validation, cyclical temporal feature engineering,
categorical encoding, and scaling pipelines using scikit-learn and pandas.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

class CyclicalTimeTransformer(BaseEstimator, TransformerMixin):
    """
    Transforms cyclical temporal variables (hour, day_of_week) into continuous sine/cosine components.
    Ensures 23:00 and 00:00 or Sunday (6) and Monday (0) maintain spatial continuity.
    """
    def __init__(self):
        pass

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X_copy = X.copy()
        if 'hour' in X_copy.columns:
            X_copy['sin_hour'] = np.sin(2 * np.pi * X_copy['hour'] / 24.0)
            X_copy['cos_hour'] = np.cos(2 * np.pi * X_copy['hour'] / 24.0)
        if 'day_of_week' in X_copy.columns:
            X_copy['sin_dow'] = np.sin(2 * np.pi * X_copy['day_of_week'] / 7.0)
            X_copy['cos_dow'] = np.cos(2 * np.pi * X_copy['day_of_week'] / 7.0)
        return X_copy


class CrowdDataPreprocessor:
    """
    Comprehensive ML Preprocessing and Feature Engineering Pipeline for Campus Crowd Prediction.
    """
    NUMERICAL_FEATURES = [
        'capacity',
        'is_weekend',
        'previous_crowd',
        'lag_2_crowd',
        'rolling_average_3h',
        'previous_density',
        'sin_hour',
        'cos_hour',
        'sin_dow',
        'cos_dow'
    ]

    CATEGORICAL_FEATURES = [
        'location_id',
        'facility_type'
    ]

    TARGET_FEATURE = 'crowd_count'

    def __init__(self):
        self.pipeline = None
        self.feature_names = None
        self.is_fitted = False

    def engineer_features(self, df):
        """Creates cyclical and temporal features from input DataFrame."""
        X = df.copy()

        # Ensure datetime parsing if timestamp column exists
        if 'timestamp' in X.columns:
            if not pd.api.types.is_datetime64_any_dtype(X['timestamp']):
                X['timestamp'] = pd.to_datetime(X['timestamp'])
            X['hour'] = X['timestamp'].dt.hour
            X['day_of_week'] = X['timestamp'].dt.dayofweek
            X['day_of_month'] = X['timestamp'].dt.day
            X['month'] = X['timestamp'].dt.month
            X['is_weekend'] = (X['day_of_week'] >= 5).astype(int)

        # Compute cyclical features
        cyclical = CyclicalTimeTransformer()
        X = cyclical.transform(X)

        # Fallback defaults for lag features if missing
        if 'previous_crowd' not in X.columns:
            X['previous_crowd'] = (X.get('capacity', 500) * 0.25).astype(int)
        if 'lag_2_crowd' not in X.columns:
            X['lag_2_crowd'] = X['previous_crowd']
        if 'rolling_average_3h' not in X.columns:
            X['rolling_average_3h'] = X['previous_crowd']
        if 'previous_density' not in X.columns:
            cap = X.get('capacity', 500)
            X['previous_density'] = ((X['previous_crowd'] / cap) * 100).round(2)

        # Clean NaNs in numericals
        for col in self.NUMERICAL_FEATURES:
            if col in X.columns:
                X[col] = pd.to_numeric(X[col], errors='coerce').fillna(0)

        # Clean categorical
        if 'location_id' in X.columns:
            X['location_id'] = X['location_id'].astype(str)
        if 'facility_type' in X.columns:
            X['facility_type'] = X['facility_type'].astype(str)

        return X

    def build_pipeline(self):
        """Constructs the Scikit-Learn ColumnTransformer pipeline."""
        num_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])

        cat_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='UNKNOWN')),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ])

        preprocessor = ColumnTransformer(
            transformers=[
                ('num', num_transformer, self.NUMERICAL_FEATURES),
                ('cat', cat_transformer, self.CATEGORICAL_FEATURES)
            ],
            remainder='drop'
        )
        return preprocessor

    def fit(self, df):
        """Fits the preprocessing pipeline on training DataFrame."""
        X_eng = self.engineer_features(df)
        self.pipeline = self.build_pipeline()
        self.pipeline.fit(X_eng)
        self.is_fitted = True

        # Extract generated feature names
        try:
            cat_encoder = self.pipeline.named_transformers_['cat'].named_steps['onehot']
            cat_cols = cat_encoder.get_feature_names_out(self.CATEGORICAL_FEATURES).tolist()
            self.feature_names = self.NUMERICAL_FEATURES + cat_cols
        except Exception:
            self.feature_names = self.NUMERICAL_FEATURES + self.CATEGORICAL_FEATURES

        return self

    def transform(self, df):
        """Transforms input DataFrame using the fitted pipeline."""
        if not self.is_fitted or self.pipeline is None:
            raise ValueError("Preprocessor must be fitted before transform.")
        X_eng = self.engineer_features(df)
        return self.pipeline.transform(X_eng)

    def fit_transform(self, df):
        """Fits and transforms input DataFrame."""
        return self.fit(df).transform(df)

    def save(self, filepath):
        """Serializes the preprocessor pipeline to disk."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        joblib.dump(self, filepath)

    @staticmethod
    def load(filepath):
        """Loads a serialized preprocessor pipeline from disk."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Preprocessor file not found at: {filepath}")
        return joblib.load(filepath)
