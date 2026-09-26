import pytest
import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_user_registration_success(client):
    response = client.post('/api/auth/register', json={
        'name': 'Test Student',
        'email': 'teststudent@campus.edu',
        'password': 'Password@123',
        'role': 'STUDENT'
    })
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']
    assert data['data']['user']['email'] == 'teststudent@campus.edu'
    assert data['data']['user']['role'] == 'STUDENT'

def test_duplicate_email_registration(client):
    client.post('/api/auth/register', json={
        'name': 'Original User',
        'email': 'duplicate@campus.edu',
        'password': 'Password@123',
        'role': 'STUDENT'
    })
    response = client.post('/api/auth/register', json={
        'name': 'Duplicate User',
        'email': 'duplicate@campus.edu',
        'password': 'Password@456',
        'role': 'STUDENT'
    })
    assert response.status_code == 409
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'DUPLICATE_EMAIL'

def test_registration_validation_errors(client):
    # Invalid email
    resp1 = client.post('/api/auth/register', json={
        'name': 'User',
        'email': 'not-an-email',
        'password': 'Password@123'
    })
    assert resp1.status_code == 400

    # Short password (< 6 chars)
    resp2 = client.post('/api/auth/register', json={
        'name': 'User',
        'email': 'valid@campus.edu',
        'password': '123'
    })
    assert resp2.status_code == 400

def test_login_success(client):
    client.post('/api/auth/register', json={
        'name': 'Login User',
        'email': 'login@campus.edu',
        'password': 'Login@123',
        'role': 'STUDENT'
    })
    response = client.post('/api/auth/login', json={
        'email': 'login@campus.edu',
        'password': 'Login@123'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']
    assert data['data']['user']['email'] == 'login@campus.edu'

def test_login_invalid_password(client):
    client.post('/api/auth/register', json={
        'name': 'User',
        'email': 'user@campus.edu',
        'password': 'CorrectPassword@123'
    })
    response = client.post('/api/auth/login', json={
        'email': 'user@campus.edu',
        'password': 'WrongPassword'
    })
    assert response.status_code == 401
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'INVALID_CREDENTIALS'

def test_protected_profile_endpoint(client):
    # Register & get token
    reg_resp = client.post('/api/auth/register', json={
        'name': 'Profile User',
        'email': 'profile@campus.edu',
        'password': 'Profile@123',
        'role': 'STUDENT'
    })
    token = reg_resp.get_json()['data']['access_token']

    # Access /api/auth/me without token -> 401
    unauth_resp = client.get('/api/auth/me')
    assert unauth_resp.status_code == 401

    # Access with token -> 200
    auth_resp = client.get('/api/auth/me', headers={
        'Authorization': f'Bearer {token}'
    })
    assert auth_resp.status_code == 200
    assert auth_resp.get_json()['data']['user']['email'] == 'profile@campus.edu'

def test_role_based_access_control(client):
    # Register Admin
    admin_resp = client.post('/api/auth/register', json={
        'name': 'Admin User',
        'email': 'admin@test.edu',
        'password': 'AdminPassword@123',
        'role': 'ADMIN'
    })
    admin_token = admin_resp.get_json()['data']['access_token']

    # Register Student
    student_resp = client.post('/api/auth/register', json={
        'name': 'Student User',
        'email': 'student@test.edu',
        'password': 'StudentPassword@123',
        'role': 'STUDENT'
    })
    student_token = student_resp.get_json()['data']['access_token']

    # Admin accessing admin endpoint -> 200
    resp_admin = client.get('/api/auth/admin-check', headers={
        'Authorization': f'Bearer {admin_token}'
    })
    assert resp_admin.status_code == 200
    assert resp_admin.get_json()['data']['role'] == 'ADMIN'

    # Student accessing admin endpoint -> 403 Forbidden
    resp_student_admin = client.get('/api/auth/admin-check', headers={
        'Authorization': f'Bearer {student_token}'
    })
    assert resp_student_admin.status_code == 403
    assert resp_student_admin.get_json()['error'] == 'FORBIDDEN_ROLE'

    # Both accessing student check endpoint -> 200
    resp_student_pass = client.get('/api/auth/student-check', headers={
        'Authorization': f'Bearer {student_token}'
    })
    assert resp_student_pass.status_code == 200
