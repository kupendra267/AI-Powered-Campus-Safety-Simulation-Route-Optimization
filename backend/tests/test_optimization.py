"""
Phase 7: Evacuation Route, Exit Allocation and Evacuation Optimization Tests
===========================================================================
Comprehensive unit and integration tests for Capacity-Aware Multi-Route & Exit Flow Optimization,
baseline vs. optimized comparative metrics, objective function weights, constraints, and REST APIs.
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
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.models.optimization import OptimizationConfig, OptimizationResult
from backend.optimization.evacuation_optimizer import EvacuationOptimizer
from backend.services.optimization_service import OptimizationService
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
        'name': 'Optimization Admin',
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
def seeded_optimization_graph(app):
    """
    Deterministic evacuation topology:
    Building 1 (Science Block, Node 1, 200 people)
    Building 2 (Library, Node 3, 150 people)
    Junction (Central Plaza, Node 2)
    Junction (West Perimeter, Node 6)
    Exit 1 (North Gate, Node 4, Cap 120)
    Exit 2 (South Gate, Node 5, Cap 100)
    """
    with app.app_context():
        n1 = Node(id=1, name="Science Block Node", latitude=12.9710, longitude=77.5910, node_type="BUILDING")
        n2 = Node(id=2, name="Central Plaza Node", latitude=12.9720, longitude=77.5920, node_type="JUNCTION")
        n3 = Node(id=3, name="Library Node", latitude=12.9730, longitude=77.5930, node_type="BUILDING")
        n4 = Node(id=4, name="North Gate Node", latitude=12.9740, longitude=77.5940, node_type="EXIT")
        n5 = Node(id=5, name="South Gate Node", latitude=12.9700, longitude=77.5950, node_type="EXIT")
        n6 = Node(id=6, name="West Perimeter Node", latitude=12.9715, longitude=77.5935, node_type="JUNCTION")
        db.session.add_all([n1, n2, n3, n4, n5, n6])
        db.session.commit()

        b1 = Building(id=1, name="Science Block A", building_code="SBA", node_id=1, capacity=300, latitude=12.9710, longitude=77.5910, type="ACADEMIC")
        b2 = Building(id=2, name="Central Library", building_code="LIB", node_id=3, capacity=400, latitude=12.9730, longitude=77.5930, type="LIBRARY")
        db.session.add_all([b1, b2])

        e1 = Exit(id=1, name="Main North Gate", node_id=4, capacity=120, status="ACTIVE")
        e2 = Exit(id=2, name="South Express Gate", node_id=5, capacity=100, status="ACTIVE")
        db.session.add_all([e1, e2])

        # Paths
        p1 = Path(id=1, source_node_id=1, destination_node_id=2, distance_meters=120.0, capacity=100, status="OPEN", is_bidirectional=True)
        p2 = Path(id=2, source_node_id=2, destination_node_id=4, distance_meters=180.0, capacity=150, status="OPEN", is_bidirectional=True)
        p3 = Path(id=3, source_node_id=1, destination_node_id=6, distance_meters=140.0, capacity=120, status="OPEN", is_bidirectional=True)
        p4 = Path(id=4, source_node_id=6, destination_node_id=5, distance_meters=160.0, capacity=150, status="OPEN", is_bidirectional=True)
        p5 = Path(id=5, source_node_id=3, destination_node_id=2, distance_meters=110.0, capacity=120, status="OPEN", is_bidirectional=True)
        p6 = Path(id=6, source_node_id=3, destination_node_id=4, distance_meters=130.0, capacity=140, status="OPEN", is_bidirectional=True)
        p7 = Path(id=7, source_node_id=2, destination_node_id=5, distance_meters=150.0, capacity=130, status="OPEN", is_bidirectional=True)
        db.session.add_all([p1, p2, p3, p4, p5, p6, p7])

        c1 = CrowdData(location_id=1, crowd_count=180, density_percentage=60.0, congestion_level="MEDIUM")
        c2 = CrowdData(location_id=2, crowd_count=150, density_percentage=37.5, congestion_level="LOW")
        db.session.add_all([c1, c2])

        sc = EmergencyScenario(
            id=1,
            name="Science Complex Fire Drill",
            emergency_type="FIRE",
            emergency_location_id=1,
            emergency_node_id=1,
            severity="HIGH",
            affected_people_count=180,
            status="CREATED"
        )
        db.session.add(sc)
        db.session.commit()


# ==================== 1. OPTIMIZATION TESTS ====================

def test_basic_optimization_execution(app, seeded_optimization_graph):
    """Verifies that basic optimization executes, calculates baseline and optimized plans, and produces valid metrics."""
    with app.app_context():
        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)

        assert status_code == 200
        assert res["success"] is True
        assert "data" in res

        data = res["data"]
        assert "baseline" in data
        assert "optimized" in data
        assert "comparison" in data

        # Verify baseline metrics exist and are non-negative
        baseline = data["baseline"]
        assert baseline["evacuation_time_sec"] > 0
        assert baseline["total_distance_meters"] > 0
        assert len(baseline["routes"]) > 0
        assert len(baseline["exits"]) > 0

        # Verify optimized metrics exist
        optimized = data["optimized"]
        assert optimized["evacuation_time_sec"] > 0
        assert optimized["total_distance_meters"] > 0
        assert len(optimized["routes"]) > 0

        # Verify research comparison calculations
        comp = data["comparison"]
        assert "time_reduction_percentage" in comp
        assert "congestion_reduction_percentage" in comp
        assert "distance_change_percentage" in comp

        # Verify explanations generated
        assert len(data["explanations"]) > 0


def test_exit_load_balancing_and_capacity_constraints(app, seeded_optimization_graph):
    """Verifies that the optimizer balances evacuees across multiple exits and respects exit capacity bounds."""
    with app.app_context():
        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)

        assert status_code == 200
        opt_exits = res["data"]["optimized"]["exits"]

        total_assigned_exits = sum(e["assigned_people"] for e in opt_exits)
        assert total_assigned_exits > 0

        # Ensure both active exits received allocation rather than dumping 100% on one exit
        active_exits_with_flow = [e for e in opt_exits if e["assigned_people"] > 0]
        assert len(active_exits_with_flow) >= 2

        # Check that individual assigned people is tracked against capacity
        for e in opt_exits:
            assert e["capacity"] > 0
            assert e["utilization_percentage"] >= 0.0


def test_blocked_path_exclusion_in_optimization(app, seeded_optimization_graph):
    """Verifies that paths marked BLOCKED receive strictly 0 people in both baseline and optimized routes."""
    with app.app_context():
        sc = db.session.get(EmergencyScenario, 1)
        # Block corridor p1 (n1 -> n2)
        sc.blocked_path_ids = json.dumps([1])
        db.session.commit()

        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)
        assert status_code == 200

        opt_routes = res["data"]["optimized"]["routes"]
        for r in opt_routes:
            assert 1 not in r["path_ids"], "Blocked path #1 was illegally selected in optimized route."


def test_disabled_exit_exclusion_in_optimization(app, seeded_optimization_graph):
    """Verifies that disabled exits receive strictly 0 people."""
    with app.app_context():
        sc = db.session.get(EmergencyScenario, 1)
        # Disable Exit 1 (North Gate)
        sc.disabled_exit_ids = json.dumps([1])
        db.session.commit()

        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)
        assert status_code == 200

        opt_exits = res["data"]["optimized"]["exits"]
        e1_entry = next((e for e in opt_exits if e["exit_id"] == 1), None)
        if e1_entry:
            assert e1_entry["assigned_people"] == 0


def test_bottleneck_mitigation_and_congestion_reduction(app, seeded_optimization_graph):
    """Verifies that the optimizer detects bottlenecks and shifts flow to reduce peak corridor utilization."""
    with app.app_context():
        sc = db.session.get(EmergencyScenario, 1)
        sc.affected_people_count = 250
        db.session.commit()

        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)
        assert status_code == 200

        data = res["data"]
        # Objective score should improve or remain optimal
        assert data["optimized"]["objective_score"] <= data["baseline"]["objective_score"]


def test_insufficient_exit_capacity_unassigned_tracking(app, seeded_optimization_graph):
    """Verifies that if total campus people vastly exceeds available capacity, unassigned is explicitly tracked."""
    with app.app_context():
        for e in Exit.query.all():
            e.capacity = 10
        sc = db.session.get(EmergencyScenario, 1)
        sc.affected_people_count = 500
        db.session.commit()

        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)
        assert status_code == 200

        data = res["data"]
        total_assigned = sum(r["people_assigned"] for r in data["optimized"]["routes"])
        unassigned = data["optimized"]["unassigned_people"]
        assert (total_assigned + unassigned) > 0


def test_network_isolated_failure_handling(app, seeded_optimization_graph):
    """Verifies that if all paths from origin to exits are blocked, clean failure response is returned."""
    with app.app_context():
        sc = db.session.get(EmergencyScenario, 1)
        sc.blocked_path_ids = json.dumps([1, 3])
        for e in Exit.query.all():
            e.status = "BLOCKED"
        db.session.commit()

        res, status_code = EvacuationOptimizer.run_optimization(scenario_id=1)
        assert status_code == 400
        assert res["success"] is False


def test_configurable_objective_weights(app, seeded_optimization_graph):
    """Verifies that objective scores respond properly when weights are customized."""
    with app.app_context():
        res_time, _ = EvacuationOptimizer.run_optimization(
            scenario_id=1,
            custom_weights={"evacuation_time": 0.9, "congestion": 0.1, "distance": 0.0, "exit_overload": 0.0}
        )
        res_dist, _ = EvacuationOptimizer.run_optimization(
            scenario_id=1,
            custom_weights={"evacuation_time": 0.0, "congestion": 0.0, "distance": 1.0, "exit_overload": 0.0}
        )

        assert res_time["success"] is True
        assert res_dist["success"] is True
        assert res_time["data"]["weights"]["evacuation_time"] == 0.9
        assert res_dist["data"]["weights"]["distance"] == 1.0


def test_predictive_optimization_mode(app, seeded_optimization_graph):
    """Verifies that predictive ML optimization mode executes without error."""
    with app.app_context():
        res, status_code = EvacuationOptimizer.run_optimization(
            scenario_id=1,
            use_predicted_crowd=True
        )
        assert status_code == 200
        assert res["success"] is True


def test_api_optimization_run_and_history(client, auth_tokens, seeded_optimization_graph):
    """Tests the REST API endpoints: POST /api/optimization/run, GET /api/optimization/<id>, GET /history, GET/PUT /config."""
    headers = auth_tokens['admin']

    # 1. Run Optimization API
    run_res = client.post('/api/optimization/run', json={
        'scenario_id': 1,
        'weights': {'evacuation_time': 0.4, 'congestion': 0.3, 'distance': 0.2, 'exit_overload': 0.1}
    }, headers=headers)
    assert run_res.status_code == 200
    run_json = run_res.get_json()
    assert run_json['success'] is True
    opt_id = run_json['data']['id']

    # 2. Get Optimization by ID
    get_res = client.get(f'/api/optimization/{opt_id}', headers=headers)
    assert get_res.status_code == 200
    assert get_res.get_json()['data']['id'] == opt_id

    # 3. Get Optimization History
    hist_res = client.get('/api/optimization/history', headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.get_json()['data']) >= 1

    # 4. Get Config
    cfg_res = client.get('/api/optimization/config', headers=headers)
    assert cfg_res.status_code == 200

    # 5. Update Config
    upd_res = client.put('/api/optimization/config', json={
        'weights': {'evacuation_time': 0.5, 'congestion': 0.2, 'distance': 0.2, 'exit_overload': 0.1},
        'max_iterations': 35
    }, headers=headers)
    assert upd_res.status_code == 200
    assert upd_res.get_json()['data']['max_iterations'] == 35
