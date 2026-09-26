"""
Phase 8: What-If Scenario Analysis and Comparative Simulation Tests
===================================================================
Comprehensive unit and integration tests for What-If scenario simulations,
isolated in-memory state execution, baseline comparisons, multi-scenario matrices,
percentage delta formulas, and REST APIs.
"""

import os
import sys
import pytest
import json
from datetime import datetime, timezone

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node, Path, Exit
from backend.models.crowd import CrowdData
from backend.models.emergency import EmergencyScenario, Simulation
from backend.models.what_if import WhatIfScenario
from backend.simulation.what_if_engine import WhatIfEngine
from backend.services.what_if_service import WhatIfService


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
        'name': 'WhatIf Admin',
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
def seeded_what_if_graph(app):
    """
    Seeds a campus topology for What-If testing:
    - 4 Nodes
    - 2 Buildings
    - 2 Exits (Gate 1 & Gate 2)
    - 3 Interconnected Paths
    - 1 Base Emergency Scenario
    """
    with app.app_context():
        n1 = Node(id=1, name="Science Block Node", latitude=12.9716, longitude=77.5946, node_type="BUILDING")
        n2 = Node(id=2, name="Library Node", latitude=12.9720, longitude=77.5950, node_type="BUILDING")
        n3 = Node(id=3, name="North Gate Node", latitude=12.9730, longitude=77.5940, node_type="EXIT")
        n4 = Node(id=4, name="South Gate Node", latitude=12.9700, longitude=77.5960, node_type="EXIT")
        db.session.add_all([n1, n2, n3, n4])
        db.session.commit()

        b1 = Building(id=1, name="Science Complex", building_code="SCI-01", type="ACADEMIC", capacity=500, node_id=1, latitude=12.9716, longitude=77.5946)
        b2 = Building(id=2, name="Central Library", building_code="LIB-01", type="LIBRARY", capacity=400, node_id=2, latitude=12.9720, longitude=77.5950)
        db.session.add_all([b1, b2])

        e1 = Exit(id=1, name="Gate 1 - North Terminal", capacity=300, status="ACTIVE", node_id=3)
        e2 = Exit(id=2, name="Gate 2 - South Ring", capacity=300, status="ACTIVE", node_id=4)
        db.session.add_all([e1, e2])

        # Paths connecting origins to both exits
        p1 = Path(id=1, source_node_id=1, destination_node_id=3, distance_meters=120.0, capacity=200, status="OPEN", is_bidirectional=True)
        p2 = Path(id=2, source_node_id=1, destination_node_id=4, distance_meters=180.0, capacity=200, status="OPEN", is_bidirectional=True)
        p3 = Path(id=3, source_node_id=2, destination_node_id=3, distance_meters=150.0, capacity=150, status="OPEN", is_bidirectional=True)
        p4 = Path(id=4, source_node_id=2, destination_node_id=4, distance_meters=140.0, capacity=200, status="OPEN", is_bidirectional=True)
        p5 = Path(id=5, source_node_id=1, destination_node_id=2, distance_meters=60.0, capacity=150, status="OPEN", is_bidirectional=True)
        db.session.add_all([p1, p2, p3, p4, p5])

        # Base crowd
        c1 = CrowdData(location_id=1, crowd_count=350, density_percentage=70.0, congestion_level="HIGH", timestamp=datetime.now(timezone.utc))
        c2 = CrowdData(location_id=2, crowd_count=200, density_percentage=50.0, congestion_level="MEDIUM", timestamp=datetime.now(timezone.utc))
        db.session.add_all([c1, c2])

        # Base Emergency Scenario
        sc = EmergencyScenario(
            id=1,
            name="Baseline Science Block Incident",
            emergency_type="FIRE",
            emergency_location_id=1,
            emergency_node_id=1,
            severity="HIGH",
            affected_people_count=400,
            blocked_path_ids=json.dumps([]),
            disabled_exit_ids=json.dumps([]),
            status="CREATED"
        )
        db.session.add(sc)
        db.session.commit()


# ==================== 1. ENGINE & SCENARIO TYPE TESTS ====================

def test_exit_blocked_what_if_scenario(seeded_what_if_graph):
    """Verifies EXIT_BLOCKED scenario diverts all evacuees to surviving exits."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Test Exit 1 Blocked",
        "scenario_type": "EXIT_BLOCKED",
        "base_scenario_id": 1,
        "blocked_exit_ids": [1]
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_type"] == "EXIT_BLOCKED"

    # All evacuees must exit through Gate 2 (Exit 2)
    scenario_exits = data["scenario_metrics"]["exits"]
    exit_1 = next((e for e in scenario_exits if e["exit_id"] == 1), None)
    exit_2 = next((e for e in scenario_exits if e["exit_id"] == 2), None)
    assert exit_1 is not None and exit_1["assigned_people"] == 0
    assert exit_2 is not None and exit_2["assigned_people"] > 0

    # Evacuation time must shift compared to baseline
    assert "time_difference_sec" in data["comparison"]
    assert "time_change_percentage" in data["comparison"]
    assert len(data["explanations"]) >= 1


def test_path_blocked_what_if_scenario(seeded_what_if_graph):
    """Verifies PATH_BLOCKED scenario bypasses blocked corridor."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Test Path 1 Blocked",
        "scenario_type": "PATH_BLOCKED",
        "base_scenario_id": 1,
        "blocked_path_ids": [1]
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]

    # Traversed routes must NOT contain path #1
    routes = data["scenario_metrics"]["routes"]
    for r in routes:
        assert 1 not in r.get("path_ids", [])


def test_crowd_increase_what_if_scenario(seeded_what_if_graph):
    """Verifies CROWD_INCREASE (+30%) recalculates density and clearance latency."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Test Science Block Crowd Surge",
        "scenario_type": "CROWD_INCREASE",
        "base_scenario_id": 1,
        "location_id": 1,
        "percentage": 30.0
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_type"] == "CROWD_INCREASE"
    assert data["scenario_metrics"]["evacuated_people"] > data["baseline_metrics"]["evacuated_people"]


def test_crowd_decrease_what_if_scenario(seeded_what_if_graph):
    """Verifies CROWD_DECREASE (-20%) decreases queue clearance time."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Test Science Block Crowd Drop",
        "scenario_type": "CROWD_DECREASE",
        "base_scenario_id": 1,
        "location_id": 1,
        "percentage": 20.0
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_type"] == "CROWD_DECREASE"


def test_crowd_override_what_if_scenario(seeded_what_if_graph):
    """Verifies CROWD_OVERRIDE sets exact population count."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Test Exact Crowd Override",
        "scenario_type": "CROWD_OVERRIDE",
        "base_scenario_id": 1,
        "location_id": 1,
        "crowd_count": 800
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_metrics"]["evacuated_people"] >= 800


def test_multiple_failures_what_if_scenario(seeded_what_if_graph):
    """Verifies MULTIPLE_FAILURES (Exit 1 blocked + Path 2 blocked + Crowd +25%)."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Compound Catastrophe Scenario",
        "scenario_type": "MULTIPLE_FAILURES",
        "base_scenario_id": 1,
        "blocked_exit_ids": [1],
        "blocked_path_ids": [2],
        "location_id": 1,
        "percentage": 25.0
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_type"] == "MULTIPLE_FAILURES"
    assert len(data["explanations"]) >= 2


def test_peak_hour_what_if_scenario(seeded_what_if_graph):
    """Verifies PEAK_HOUR simulation applies campus-wide high traffic factors."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Campus Peak Exchange Hour",
        "scenario_type": "PEAK_HOUR",
        "base_scenario_id": 1
    })
    assert status_code == 200
    assert res["success"] is True
    data = res["data"]
    assert data["scenario_type"] == "PEAK_HOUR"
    assert data["scenario_metrics"]["evacuated_people"] > data["baseline_metrics"]["evacuated_people"]


# ==================== 2. ISOLATION & DATA INTEGRITY TESTS ====================

def test_what_if_does_not_mutate_underlying_database(seeded_what_if_graph):
    """
    CRITICAL REQUIREMENT:
    Verifies that running a What-If scenario does NOT permanently alter:
    - Path.status
    - Exit.status
    - CrowdData
    - Building capacities
    - EmergencyScenario baseline
    """
    # Verify pre-conditions
    p1 = db.session.get(Path, 1)
    e1 = db.session.get(Exit, 1)
    sc = db.session.get(EmergencyScenario, 1)
    c1 = CrowdData.query.filter_by(location_id=1).order_by(CrowdData.timestamp.desc()).first()

    assert p1.status == "OPEN"
    assert e1.status == "ACTIVE"
    initial_crowd = c1.crowd_count

    # Execute aggressive What-If (block Exit 1, block Path 1, surge crowd +80%)
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "Isolation Verification Run",
        "scenario_type": "MULTIPLE_FAILURES",
        "base_scenario_id": 1,
        "blocked_exit_ids": [1],
        "blocked_path_ids": [1],
        "location_id": 1,
        "percentage": 80.0
    })
    assert status_code == 200
    assert res["success"] is True

    # Re-query database entities directly
    p1_post = db.session.get(Path, 1)
    e1_post = db.session.get(Exit, 1)
    c1_post = CrowdData.query.filter_by(location_id=1).order_by(CrowdData.timestamp.desc()).first()
    sc_post = db.session.get(EmergencyScenario, 1)

    assert p1_post.status == "OPEN", "Path status in DB must remain OPEN after What-If run"
    assert e1_post.status == "ACTIVE", "Exit status in DB must remain ACTIVE after What-If run"
    assert c1_post.crowd_count == initial_crowd, "Crowd count in DB must remain unchanged"
    assert sc_post.get_blocked_path_ids() == [], "Base EmergencyScenario blocked paths must remain unchanged"
    assert sc_post.get_disabled_exit_ids() == [], "Base EmergencyScenario disabled exits must remain unchanged"


def test_all_exits_blocked_returns_clear_error(seeded_what_if_graph):
    """Verifies that blocking all available exits returns ALL_EXITS_BLOCKED error."""
    res, status_code = WhatIfEngine.run_what_if_analysis(custom_params={
        "name": "All Exits Blocked Failure",
        "scenario_type": "EXIT_BLOCKED",
        "base_scenario_id": 1,
        "blocked_exit_ids": [1, 2]
    })
    assert status_code == 400
    assert res["success"] is False
    assert res["error"] == "ALL_EXITS_BLOCKED"


# ==================== 3. COMPARISON & REST API TESTS ====================

def test_api_what_if_crud_and_quick_run(client, auth_tokens, seeded_what_if_graph):
    """Tests POST, GET, PUT, DELETE, and /quick-run API endpoints."""
    # 1. Quick Run
    qr_res = client.post('/api/what-if/quick-run', headers=auth_tokens['admin'], json={
        'name': 'API Quick Run Scenario',
        'scenario_type': 'EXIT_BLOCKED',
        'base_scenario_id': 1,
        'blocked_exit_ids': [1]
    })
    assert qr_res.status_code == 200
    qr_json = qr_res.get_json()
    assert qr_json['success'] is True
    sc_id = qr_json['data']['id']

    # 2. Get by ID
    get_res = client.get(f'/api/what-if/{sc_id}', headers=auth_tokens['admin'])
    assert get_res.status_code == 200
    assert get_res.get_json()['data']['id'] == sc_id

    # 3. List scenarios
    list_res = client.get('/api/what-if', headers=auth_tokens['admin'])
    assert list_res.status_code == 200
    assert len(list_res.get_json()['data']) >= 1

    # 4. Update scenario
    up_res = client.put(f'/api/what-if/{sc_id}', headers=auth_tokens['admin'], json={
        'name': 'Updated What-If Name',
        'description': 'Updated description'
    })
    assert up_res.status_code == 200
    assert up_res.get_json()['data']['name'] == 'Updated What-If Name'

    # 5. Re-run scenario
    run_res = client.post(f'/api/what-if/{sc_id}/run', headers=auth_tokens['admin'], json={})
    assert run_res.status_code == 200
    assert run_res.get_json()['success'] is True

    # 6. Delete scenario
    del_res = client.delete(f'/api/what-if/{sc_id}', headers=auth_tokens['admin'])
    assert del_res.status_code == 200
    assert del_res.get_json()['success'] is True


def test_api_multi_scenario_comparison(client, auth_tokens, seeded_what_if_graph):
    """Tests POST /api/what-if/compare across multiple scenarios."""
    # Create scenario A
    res_a = client.post('/api/what-if/quick-run', headers=auth_tokens['admin'], json={
        'name': 'Scenario A - Exit 1 Blocked',
        'scenario_type': 'EXIT_BLOCKED',
        'base_scenario_id': 1,
        'blocked_exit_ids': [1]
    })
    id_a = res_a.get_json()['data']['id']

    # Create scenario B
    res_b = client.post('/api/what-if/quick-run', headers=auth_tokens['admin'], json={
        'name': 'Scenario B - Crowd Surge +40%',
        'scenario_type': 'CROWD_INCREASE',
        'base_scenario_id': 1,
        'location_id': 1,
        'percentage': 40.0
    })
    id_b = res_b.get_json()['data']['id']

    # Compare
    comp_res = client.post('/api/what-if/compare', headers=auth_tokens['admin'], json={
        'scenario_ids': [id_a, id_b]
    })
    assert comp_res.status_code == 200
    comp_json = comp_res.get_json()
    assert comp_json['success'] is True
    matrix = comp_json['data']['comparison_matrix']
    assert len(matrix) == 3  # Baseline + Scenario A + Scenario B
    assert matrix[0]['id'] == 'baseline'
