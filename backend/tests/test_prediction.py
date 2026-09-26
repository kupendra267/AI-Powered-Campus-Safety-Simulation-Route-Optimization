import json
import pytest
import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node
from backend.models.crowd import CrowdData, SystemAlert
from backend.models.prediction import MLModelMetadata, PredictionLog
from backend.ml.generate_dataset import generate_campus_crowd_dataset
from backend.ml.preprocessing import CrowdDataPreprocessor
from backend.services.crowd_prediction_service import CrowdPredictionService

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()

        # Seed test node & building
        node = Node(id=1, name="Test Node", latitude=12.972, longitude=77.594, node_type="BUILDING")
        db.session.add(node)
        db.session.commit()

        b1 = Building(
            id=1, 
            name="Test CS Complex", 
            building_code="TEST-CS", 
            node_id=1, 
            latitude=12.972, 
            longitude=77.594, 
            capacity=500, 
            type="ACADEMIC"
        )
        b2 = Building(
            id=2, 
            name="Test Canteen Hub", 
            building_code="TEST-CAN", 
            node_id=1, 
            latitude=12.973, 
            longitude=77.595, 
            capacity=400, 
            type="CANTEEN"
        )
        db.session.add_all([b1, b2])

        # Seed crowd records
        c1 = CrowdData(location_id=1, crowd_count=150, capacity=500, density_percentage=30.0, congestion_level="LOW")
        c2 = CrowdData(location_id=2, crowd_count=350, capacity=400, density_percentage=87.5, congestion_level="HIGH")
        db.session.add_all([c1, c2])

        # Seed admin and student users
        admin = User(name="Admin", email="admin@test.com", role="ADMIN")
        admin.set_password("Admin@123")
        student = User(name="Student", email="student@test.com", role="STUDENT")
        student.set_password("Student@123")
        db.session.add_all([admin, student])

        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def admin_token(client):
    res = client.post('/api/auth/login', json={'email': 'admin@test.com', 'password': 'Admin@123'})
    return res.get_json()['data']['access_token']

@pytest.fixture
def student_token(client):
    res = client.post('/api/auth/login', json={'email': 'student@test.com', 'password': 'Student@123'})
    return res.get_json()['data']['access_token']


def test_dataset_generation_and_preprocessing():
    """Verify synthetic dataset generator produces valid time-series with lag features."""
    df = generate_campus_crowd_dataset(days=5)
    assert len(df) > 0
    assert 'previous_crowd' in df.columns
    assert 'rolling_average_3h' in df.columns
    assert 'crowd_count' in df.columns

    preprocessor = CrowdDataPreprocessor()
    X = preprocessor.fit_transform(df)
    assert X.shape[0] == len(df)
    assert X.shape[1] > 5


def test_prediction_service_single_step(app):
    """Test single step prediction calculation."""
    with app.app_context():
        res, status = CrowdPredictionService.predict_future(location_id=1)
        assert status == 200
        assert res['success'] is True
        data = res['data']
        assert data['location_id'] == 1
        assert data['predicted_crowd'] >= 0
        assert data['predicted_density'] >= 0
        assert data['congestion_level'] in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        assert 'delta_crowd' in data


def test_prediction_service_multi_step(app):
    """Test multi-step rolling forecast timeline."""
    with app.app_context():
        res, status = CrowdPredictionService.predict_multi_step(location_id=1, horizons_hours=[1, 2, 3, 4])
        assert status == 200
        assert res['success'] is True
        data = res['data']
        assert len(data['forecast']) == 4
        assert data['trend'] in ['RISING', 'FALLING', 'STABLE']


def test_prediction_campus_summary(app):
    """Test campus-wide prediction summary."""
    with app.app_context():
        res, status = CrowdPredictionService.predict_campus_summary(horizon_hours=1)
        assert status == 200
        assert res['success'] is True
        data = res['data']
        assert len(data['locations']) >= 2
        assert 'total_predicted_crowd' in data


def test_prediction_api_endpoints(client, admin_token, student_token):
    """Test all /api/predictions REST endpoints."""
    # 1. Single prediction endpoint
    res = client.post('/api/predictions/predict', json={'location_id': 1})
    assert res.status_code == 200
    assert res.get_json()['success'] is True

    # 2. Location multi-step endpoint
    res = client.get('/api/predictions/location/1?horizons=1,2,3')
    assert res.status_code == 200
    assert len(res.get_json()['data']['forecast']) == 3

    # 3. Summary endpoint
    res = client.get('/api/predictions/summary?horizon=2')
    assert res.status_code == 200
    assert res.get_json()['success'] is True

    # 4. Model info endpoint
    res = client.get('/api/predictions/model-info')
    assert res.status_code == 200
    assert 'test_metrics' in res.get_json()['data']

    # 5. Invalid location handling
    res = client.post('/api/predictions/predict', json={'location_id': 99999})
    assert res.status_code == 404

    # 6. Admin retraining authorization check
    res_unauth = client.post('/api/predictions/train', headers={'Authorization': f'Bearer {student_token}'})
    assert res_unauth.status_code == 403  # Forbidden for students

    res_auth = client.post('/api/predictions/train', json={'days': 5}, headers={'Authorization': f'Bearer {admin_token}'})
    assert res_auth.status_code == 200
    assert res_auth.get_json()['success'] is True
