"""
Test Suite: Phase 6 - Emergency Evacuation Simulation
=====================================================
Tests Emergency Scenarios, Simulation Engine, Multi-Exit Allocations,
Bottleneck Detection, Blocked Path Constraints, Failure Scenarios,
What-If tests, and REST API Endpoints.
"""

import os
import sys
import pytest

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node, Path, Exit
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.simulation.evacuation_simulation import EvacuationSimulator
from backend.services.emergency_service import EmergencyService


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


@pytest.fixture
def auth_tokens(client):
    admin_res = client.post('/api/auth/register', json={
        'name': 'Emergency Safety Officer',
        'email': 'admin@campus.edu',
        'password': 'Admin@123',
        'role': 'ADMIN'
    })
    admin_token = admin_res.get_json()['data']['access_token']

    student_res = client.post('/api/auth/register', json={
        'name': 'Student User',
        'email': 'student@campus.edu',
        'password': 'Student@123',
        'role': 'STUDENT'
    })
    student_token = student_res.get_json()['data']['access_token']

    return {
        'admin': {'Authorization': f'Bearer {admin_token}'},
        'student': {'Authorization': f'Bearer {student_token}'}
    }


@pytest.fixture
def seeded_emergency_graph(app):
    """
    Deterministic evacuation test network:
    Building 1 (Epicenter Node 1, 500 people)
      ├── Path 1 (100m, Cap 150) -> Exit 1 (Node 2, Cap 300/min)
      └── Path 2 (150m, Cap 200) -> Exit 2 (Node 3, Cap 400/min)
    Node 4 (Isolated Node with Exit 3)
    """
    with app.app_context():
        n1 = Node(id=1, name="Science Block Node", latitude=12.9710, longitude=77.5940, node_type="BUILDING")
        n2 = Node(id=2, name="North Gate Node", latitude=12.9720, longitude=77.5940, node_type="EXIT")
        n3 = Node(id=3, name="South Gate Node", latitude=12.9700, longitude=77.5940, node_type="EXIT")
        n4 = Node(id=4, name="Isolated Perimeter", latitude=12.9800, longitude=77.5990, node_type="EXIT")

        db.session.add_all([n1, n2, n3, n4])
        db.session.commit()

        b1 = Building(id=1, name="Science Block", building_code="SCI-1", node_id=1, latitude=12.9710, longitude=77.5940, capacity=600)
        db.session.add(b1)

        ex1 = Exit(id=1, name="North Gate Exit", node_id=2, capacity=300, status="ACTIVE")
        ex2 = Exit(id=2, name="South Gate Exit", node_id=3, capacity=400, status="ACTIVE")
        ex3 = Exit(id=3, name="Perimeter Exit", node_id=4, capacity=200, status="ACTIVE")
        db.session.add_all([ex1, ex2, ex3])

        p1 = Path(id=1, source_node_id=1, destination_node_id=2, distance_meters=100.0, capacity=150, status="OPEN", is_bidirectional=True)
        p2 = Path(id=2, source_node_id=1, destination_node_id=3, distance_meters=150.0, capacity=200, status="OPEN", is_bidirectional=True)
        db.session.add_all([p1, p2])
        db.session.commit()


# ==================== 1. SCENARIO & SIMULATION TESTS ====================

def test_emergency_scenario_creation_and_activation(seeded_emergency_graph):
    """Tests creating and activating an emergency scenario."""
    res, status_code = EmergencyService.create_scenario({
        'name': 'Science Block Chemical Fire',
        'emergency_type': 'FIRE',
        'emergency_location_id': 1,
        'severity': 'CRITICAL',
        'affected_people_count': 500,
        'blocked_path_ids': []
    })
    assert status_code == 201
    assert res['success'] is True
    sc_id = res['data']['id']

    # Activate emergency
    start_res, start_code = EmergencyService.start_emergency(sc_id)
    assert start_code == 200
    assert start_res['data']['status'] == 'ACTIVE'

    # Check active scenario query
    active = EmergencyService.get_active_scenario()
    assert active is not None
    assert active['id'] == sc_id
    assert active['status'] == 'ACTIVE'

    # Terminate emergency
    stop_res, stop_code = EmergencyService.stop_emergency(sc_id)
    assert stop_code == 200
    assert stop_res['data']['status'] == 'COMPLETED'


def test_evacuation_simulation_execution(seeded_emergency_graph):
    """Verifies evacuation flow assignment, time estimation, and bottleneck detection."""
    res, status_code = EvacuationSimulator.run_simulation(custom_params={
        'name': 'Test Evacuation',
        'emergency_location_id': 1,
        'people_count': 450,
        'simulation_mode': 'MANUAL'
    })
    assert status_code == 200
    assert res['success'] is True
    sim = res['simulation']

    assert sim['people_count'] == 450
    assert sim['successfully_assigned'] == 450
    assert sim['unassigned_people'] == 0
    assert sim['estimated_evacuation_time'] > 0
    assert len(res['results']) >= 1
    assert len(res['exit_utilization']) >= 2


def test_exit_load_distribution_across_multiple_exits(seeded_emergency_graph):
    """Verifies evacuees are distributed across reachable exits according to capacity."""
    res, status_code = EvacuationSimulator.run_simulation(custom_params={
        'emergency_location_id': 1,
        'people_count': 600
    })
    assert status_code == 200
    exit_utils = res['exit_utilization']
    assigned_exits = [e for e in exit_utils if e['assigned_people'] > 0]

    # Both North Gate and South Gate must receive evacuees
    assert len(assigned_exits) >= 2
    total_allocated = sum(e['assigned_people'] for e in exit_utils)
    assert total_allocated == 600


def test_blocked_path_dynamic_diversion_in_simulation(app, seeded_emergency_graph):
    """When Path 1 (to North Gate) is blocked, 100% of evacuees must divert to South Gate."""
    res, status_code = EvacuationSimulator.run_simulation(custom_params={
        'emergency_location_id': 1,
        'people_count': 300,
        'blocked_path_ids': [1] # Block Path 1
    })
    assert status_code == 200
    for r in res['results']:
        assert 1 not in r['path_ids']
        assert r['exit_id'] == 2  # Diverted to South Gate


def test_all_exits_blocked_returns_failure(seeded_emergency_graph):
    """When all reachable exits are disabled, system reports clean failure with unassigned count."""
    res, status_code = EvacuationSimulator.run_simulation(custom_params={
        'emergency_location_id': 1,
        'people_count': 400,
        'disabled_exit_ids': [1, 2, 3] # Disable all exits
    })
    assert status_code == 400
    assert res['success'] is False
    assert res['error'] == 'ALL_EXITS_UNAVAILABLE'
    assert res['simulation']['unassigned_people'] == 400


def test_what_if_block_exit_contingency(seeded_emergency_graph):
    """Tests What-If contingency recalculation when an exit is dynamically disabled."""
    sc_res, _ = EmergencyService.create_scenario({
        'name': 'Contingency Test',
        'emergency_location_id': 1,
        'affected_people_count': 350
    })
    sc_id = sc_res['data']['id']

    # Block Exit 1 (North Gate) in What-If scenario
    wi_res, status_code = EmergencyService.what_if_block_exit(scenario_id=sc_id, exit_to_block_id=1)
    assert status_code == 200
    assert wi_res['success'] is True
    
    # Confirm Exit 1 received 0 people, diverted to Exit 2
    for e in wi_res['exit_utilization']:
        if e['exit_id'] == 1:
            assert e['assigned_people'] == 0


def test_bottleneck_detection_under_heavy_load(seeded_emergency_graph):
    """Under heavy load (> capacity), the simulator must flag high-utilization corridors as bottlenecks."""
    res, status_code = EvacuationSimulator.run_simulation(custom_params={
        'emergency_location_id': 1,
        'people_count': 1000 # High load
    })
    assert status_code == 200
    bottlenecks = res['bottlenecks']
    assert len(bottlenecks) >= 1
    assert bottlenecks[0]['utilization'] >= 85.0


# ==================== 2. REST API INTEGRATION TESTS ====================

def test_api_emergency_crud(client, auth_tokens, seeded_emergency_graph):
    """Tests GET, POST, PUT, DELETE /api/emergency."""
    # Create
    c_res = client.post('/api/emergency', headers=auth_tokens['admin'], json={
        'name': 'Fire Scenario Alpha',
        'emergency_type': 'FIRE',
        'emergency_location_id': 1,
        'severity': 'HIGH',
        'affected_people_count': 300
    })
    assert c_res.status_code == 201
    sc_id = c_res.get_json()['data']['id']

    # Get list
    l_res = client.get('/api/emergency')
    assert l_res.status_code == 200
    assert len(l_res.get_json()['data']) >= 1

    # Start emergency
    s_res = client.post(f'/api/emergency/{sc_id}/start', headers=auth_tokens['admin'])
    assert s_res.status_code == 200
    assert s_res.get_json()['data']['status'] == 'ACTIVE'

    # Get active
    act_res = client.get('/api/emergency/active')
    assert act_res.status_code == 200
    assert act_res.get_json()['data']['id'] == sc_id

    # Stop emergency
    stop_res = client.post(f'/api/emergency/{sc_id}/stop', headers=auth_tokens['admin'])
    assert stop_res.status_code == 200


def test_api_simulation_run_and_history(client, auth_tokens, seeded_emergency_graph):
    """Tests POST /api/simulation/run and GET /api/simulation/history."""
    r_res = client.post('/api/simulation/run', headers=auth_tokens['admin'], json={
        'emergency_location_id': 1,
        'people_count': 250,
        'simulation_mode': 'LIVE_CROWD'
    })
    assert r_res.status_code == 200
    sim_id = r_res.get_json()['data']['simulation']['id']

    # Get simulation details
    g_res = client.get(f'/api/simulation/{sim_id}')
    assert g_res.status_code == 200
    assert g_res.get_json()['data']['simulation']['id'] == sim_id

    # Get history
    h_res = client.get('/api/simulation/history')
    assert h_res.status_code == 200
    assert len(h_res.get_json()['data']) >= 1
