import pytest
import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Node, Building, Path, Exit
from backend.seed.seed_campus import seed_campus_topology

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        # Seed test admin & student
        admin = User(name="Admin", email="admin@test.edu", role="ADMIN")
        admin.set_password("Admin@123")
        student = User(name="Student", email="student@test.edu", role="STUDENT")
        student.set_password("Student@123")
        db.session.add_all([admin, student])
        db.session.commit()
        
        # Seed campus topology
        seed_campus_topology()

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

def test_get_campus_graph(client, student_token):
    res = client.get('/api/campus/graph', headers={'Authorization': f'Bearer {student_token}'})
    assert res.status_code == 200
    data = res.get_json()['data']
    assert len(data['nodes']) >= 20
    assert len(data['buildings']) >= 10
    assert len(data['exits']) >= 4
    assert len(data['edges']) >= 25
    assert 'adjacency' in data

def test_building_crud(client, admin_token, student_token):
    # 1. List buildings
    res = client.get('/api/campus/buildings', headers={'Authorization': f'Bearer {student_token}'})
    assert res.status_code == 200
    assert len(res.get_json()['data']) >= 10

    # 2. Student cannot create building (RBAC)
    unauth_create = client.post('/api/campus/buildings', json={
        'name': 'New Quantum Lab',
        'building_code': 'QNT-01',
        'node_id': 1,
        'capacity': 200,
        'type': 'LAB'
    }, headers={'Authorization': f'Bearer {student_token}'})
    assert unauth_create.status_code == 403

    # 3. Admin can create building
    create_res = client.post('/api/campus/buildings', json={
        'name': 'New Quantum Lab',
        'building_code': 'QNT-01',
        'node_id': 1,
        'capacity': 200,
        'type': 'LAB'
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert create_res.status_code == 201
    b_id = create_res.get_json()['data']['id']

    # 4. Admin update building
    update_res = client.put(f'/api/campus/buildings/{b_id}', json={
        'capacity': 350
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert update_res.status_code == 200
    assert update_res.get_json()['data']['capacity'] == 350

    # 5. Admin delete building
    del_res = client.delete(f'/api/campus/buildings/{b_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200

def test_path_crud_and_toggle_status(client, admin_token):
    # 1. Create custom path
    create_res = client.post('/api/campus/paths', json={
        'source_node_id': 1,
        'destination_node_id': 8,
        'capacity': 200,
        'status': 'OPEN'
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert create_res.status_code == 201
    path_id = create_res.get_json()['data']['id']
    assert create_res.get_json()['data']['distance_meters'] > 0

    # 2. Toggle status to BLOCKED
    toggle_res = client.post(f'/api/campus/paths/{path_id}/toggle-status', headers={'Authorization': f'Bearer {admin_token}'})
    assert toggle_res.status_code == 200
    assert toggle_res.get_json()['data']['status'] == 'BLOCKED'

    # 3. Toggle back to OPEN
    toggle_back = client.post(f'/api/campus/paths/{path_id}/toggle-status', headers={'Authorization': f'Bearer {admin_token}'})
    assert toggle_back.status_code == 200
    assert toggle_back.get_json()['data']['status'] == 'OPEN'

    # 4. Delete path
    del_res = client.delete(f'/api/campus/paths/{path_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200

def test_exit_crud(client, admin_token):
    # 1. Create new exit
    create_res = client.post('/api/campus/exits', json={
        'name': 'Gate 5 - Heliport Access',
        'node_id': 15,
        'capacity': 300,
        'status': 'ACTIVE'
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert create_res.status_code == 201
    exit_id = create_res.get_json()['data']['id']

    # 2. Delete exit
    del_res = client.delete(f'/api/campus/exits/{exit_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200
