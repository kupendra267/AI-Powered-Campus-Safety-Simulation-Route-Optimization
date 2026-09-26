import pytest
import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node
from backend.models.crowd import CrowdData, SystemAlert
from backend.seed.seed_campus import seed_campus_topology
from backend.seed.seed_crowd import seed_crowd_data

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        admin = User(name="Admin", email="admin@test.edu", role="ADMIN")
        admin.set_password("Admin@123")
        student = User(name="Student", email="student@test.edu", role="STUDENT")
        student.set_password("Student@123")
        db.session.add_all([admin, student])
        db.session.commit()
        
        seed_campus_topology()
        seed_crowd_data()

        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def admin_token(client):
    res = client.post('/api/auth/login', json={'email': 'admin@test.edu', 'password': 'Admin@123'})
    return res.get_json()['data']['access_token']

@pytest.fixture
def student_token(client):
    res = client.post('/api/auth/login', json={'email': 'student@test.edu', 'password': 'Student@123'})
    return res.get_json()['data']['access_token']

def test_density_and_congestion_calculation():
    # Test formula and thresholds
    d1, c1 = CrowdData.compute_density_and_congestion(30, 100)
    assert d1 == 30.0 and c1 == 'LOW'

    d2, c2 = CrowdData.compute_density_and_congestion(55, 100)
    assert d2 == 55.0 and c2 == 'MEDIUM'

    d3, c3 = CrowdData.compute_density_and_congestion(85, 100)
    assert d3 == 85.0 and c3 == 'HIGH'

    d4, c4 = CrowdData.compute_density_and_congestion(95, 100)
    assert d4 == 95.0 and c4 == 'CRITICAL'

def test_crowd_crud_and_alerts(client, admin_token, student_token):
    # 1. Create a CRITICAL crowd record
    res = client.post('/api/crowd', json={
        'location_id': 1,
        'crowd_count': 380,
        'capacity': 400,
        'source': 'MANUAL_ENTRY'
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 201
    data = res.get_json()['data']
    assert data['density_percentage'] == 95.0
    assert data['congestion_level'] == 'CRITICAL'
    record_id = data['id']

    # 2. Verify alert was automatically created
    alert_res = client.get('/api/crowd/alerts', headers={'Authorization': f'Bearer {student_token}'})
    assert alert_res.status_code == 200
    alerts = alert_res.get_json()['data']
    assert len(alerts) > 0
    assert any('CRITICAL' in a['title'] for a in alerts)

    # 3. Update record
    up_res = client.put(f'/api/crowd/{record_id}', json={
        'crowd_count': 100
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert up_res.status_code == 200
    assert up_res.get_json()['data']['congestion_level'] == 'LOW'

    # 4. Delete record
    del_res = client.delete(f'/api/crowd/{record_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200

def test_current_crowd_and_summary_apis(client, student_token):
    # Test /api/crowd/current
    cur_res = client.get('/api/crowd/current', headers={'Authorization': f'Bearer {student_token}'})
    assert cur_res.status_code == 200
    current_list = cur_res.get_json()['data']
    assert len(current_list) >= 10
    assert 'density_percentage' in current_list[0]
    assert 'congestion_level' in current_list[0]

    # Test /api/crowd/summary
    sum_res = client.get('/api/crowd/summary', headers={'Authorization': f'Bearer {student_token}'})
    assert sum_res.status_code == 200
    summary = sum_res.get_json()['data']
    assert summary['total_crowd'] > 0
    assert summary['average_density'] > 0
    assert 'most_congested_location' in summary

def test_crowd_trends_and_simulation(client, admin_token, student_token):
    # Test /api/crowd/trends
    trend_res = client.get('/api/crowd/trends?days=1', headers={'Authorization': f'Bearer {student_token}'})
    assert trend_res.status_code == 200
    trend_data = trend_res.get_json()['data']
    assert 'crowd_over_time' in trend_data
    assert 'location_comparison' in trend_data
    assert 'congestion_breakdown' in trend_data

    # Test simulation step
    sim_res = client.post('/api/crowd/simulation/step', json={'scenario': 'lunch'}, headers={'Authorization': f'Bearer {admin_token}'})
    assert sim_res.status_code == 200
    assert len(sim_res.get_json()['data']) >= 10

    # Test simulation reset
    reset_res = client.post('/api/crowd/simulation/reset', headers={'Authorization': f'Bearer {admin_token}'})
    assert reset_res.status_code == 200
