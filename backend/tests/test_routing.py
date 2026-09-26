"""
Test Suite: Phase 5 - Intelligent Route Calculation & Crowd-Aware Routing
==========================================================================
Tests A* algorithm, Yen's K-Shortest paths, Shortest, Fastest, Crowd-Aware,
Predictive routing modes, blocked path exclusions, error cases, and REST endpoints.
"""

import pytest
import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node, Path, Exit
from backend.models.crowd import CrowdData
from backend.algorithms.pathfinding import CampusPathFinder, RoutingConfig, haversine_distance
from backend.services.routing_service import RoutingService


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
    """Creates admin and student accounts, returns JWT auth headers."""
    # Admin
    admin_res = client.post('/api/auth/register', json={
        'name': 'Campus Safety Admin',
        'email': 'admin@campus.edu',
        'password': 'Admin@123',
        'role': 'ADMIN'
    })
    admin_token = admin_res.get_json()['data']['access_token']

    # Student
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
def seeded_campus_graph(app):
    """
    Constructs a controlled diamond-shaped test graph with a bypass:
    Node 1 (Origin) -> Node 2 (Short, but High Congestion) -> Node 4 (Goal)
    Node 1 (Origin) -> Node 3 (Longer, but Low Congestion)  -> Node 4 (Goal)
    Node 1 (Origin) -> Node 5 (Alternative Bypass)         -> Node 4 (Goal)
    """
    with app.app_context():
        n1 = Node(id=1, name="Origin Gate", latitude=12.9710, longitude=77.5940, node_type="GATEWAY")
        n2 = Node(id=2, name="Central Corridor", latitude=12.9715, longitude=77.5940, node_type="JUNCTION")
        n3 = Node(id=3, name="East Garden Walk", latitude=12.9715, longitude=77.5950, node_type="JUNCTION")
        n4 = Node(id=4, name="Auditorium Goal", latitude=12.9720, longitude=77.5940, node_type="BUILDING")
        n5 = Node(id=5, name="West Perimeter", latitude=12.9715, longitude=77.5930, node_type="JUNCTION")
        n6 = Node(id=6, name="Isolated Node", latitude=12.9800, longitude=77.5990, node_type="JUNCTION")

        db.session.add_all([n1, n2, n3, n4, n5, n6])
        db.session.commit()

        # Buildings
        b1 = Building(id=1, name="Main Entrance", building_code="GATE-1", node_id=1, latitude=12.9710, longitude=77.5940, capacity=300)
        b2 = Building(id=2, name="Central Food Court", building_code="CANTEEN", node_id=2, latitude=12.9715, longitude=77.5940, capacity=200)
        b4 = Building(id=4, name="Main Auditorium", building_code="AUD-1", node_id=4, latitude=12.9720, longitude=77.5940, capacity=600)
        db.session.add_all([b1, b2, b4])

        # Paths:
        # Route A: 1 -> 2 -> 4 (Distance: 100m + 100m = 200m; High Crowd: 180/200 = 90%)
        p1 = Path(id=1, source_node_id=1, destination_node_id=2, distance_meters=100.0, capacity=200, current_crowd=180, status="OPEN", is_bidirectional=True)
        p2 = Path(id=2, source_node_id=2, destination_node_id=4, distance_meters=100.0, capacity=200, current_crowd=180, status="OPEN", is_bidirectional=True)

        # Route B: 1 -> 3 -> 4 (Distance: 150m + 150m = 300m; Low Crowd: 20/200 = 10%)
        p3 = Path(id=3, source_node_id=1, destination_node_id=3, distance_meters=150.0, capacity=200, current_crowd=20, status="OPEN", is_bidirectional=True)
        p4 = Path(id=4, source_node_id=3, destination_node_id=4, distance_meters=150.0, capacity=200, current_crowd=20, status="OPEN", is_bidirectional=True)

        # Route C: 1 -> 5 -> 4 (Distance: 180m + 180m = 360m; Low Crowd: 10/200 = 5%)
        p5 = Path(id=5, source_node_id=1, destination_node_id=5, distance_meters=180.0, capacity=200, current_crowd=10, status="OPEN", is_bidirectional=True)
        p6 = Path(id=6, source_node_id=5, destination_node_id=4, distance_meters=180.0, capacity=200, current_crowd=10, status="OPEN", is_bidirectional=True)

        db.session.add_all([p1, p2, p3, p4, p5, p6])
        db.session.commit()


# ==================== 1. UNIT TESTS: PATHFINDING ALGORITHMS ====================

def test_haversine_distance_calculation():
    """Verifies geographic Haversine distance matches physical geometry."""
    # ~111 meters per 0.001 degree latitude at equator
    dist = haversine_distance(12.9710, 77.5940, 12.9720, 77.5940)
    assert 100.0 <= dist <= 120.0


def test_shortest_distance_routing(seeded_campus_graph):
    """SHORTEST mode must choose Route A (200m) over Route B (300m) regardless of crowd."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="SHORTEST")
    assert status_code == 200
    assert res["success"] is True
    assert res["mode"] == "SHORTEST"

    rec = res["recommended_route"]
    assert rec["node_ids"] == [1, 2, 4]
    assert rec["total_distance_meters"] == 200.0
    assert rec["paths_count"] == 2


def test_crowd_aware_routing_bypasses_congested_route(seeded_campus_graph):
    """CROWD_AWARE mode must bypass congested Route A (90% density) in favor of calm Route B (10% density)."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="CROWD_AWARE")
    assert status_code == 200
    assert res["success"] is True
    assert res["mode"] == "CROWD_AWARE"

    rec = res["recommended_route"]
    # Due to crowd penalty on Node 2, algorithm must intelligently choose Route B (1 -> 3 -> 4)
    assert rec["node_ids"] == [1, 3, 4]
    assert rec["total_distance_meters"] == 300.0
    assert rec["average_congestion"] in ["LOW", "MEDIUM"]


def test_fastest_travel_time_routing(seeded_campus_graph):
    """FASTEST mode must calculate route factoring pedestrian slowdown under congestion."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="FASTEST")
    assert status_code == 200
    assert res["success"] is True
    assert res["mode"] == "FASTEST"

    rec = res["recommended_route"]
    assert rec["estimated_time_seconds"] > 0
    assert "s" in rec["estimated_time_formatted"]


def test_predictive_routing_mode(seeded_campus_graph):
    """PREDICTIVE mode executes using predictive parameters and returns transparent metadata."""
    res, status_code = RoutingService.calculate_route(
        start_node_id=1, destination_node_id=4, mode="PREDICTIVE", horizon_hours=2
    )
    assert status_code == 200
    assert res["success"] is True
    assert res["mode"] == "PREDICTIVE"
    assert "prediction_meta" in res


def test_alternative_routes_generation(seeded_campus_graph):
    """Yen's algorithm must return distinct, non-duplicate alternative routes."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="SHORTEST")
    assert status_code == 200
    
    alts = res["alternative_routes"]
    assert len(alts) >= 1

    # Check non-duplication
    all_node_seqs = [tuple(res["recommended_route"]["node_ids"])] + [tuple(a["node_ids"]) for a in alts]
    assert len(all_node_seqs) == len(set(all_node_seqs))


def test_blocked_path_exclusion_and_dynamic_rerouting(app, seeded_campus_graph):
    """When the shortest path is BLOCKED, the algorithm must dynamically find the alternative open path."""
    with app.app_context():
        # Block Route A (Path 1)
        p1 = db.session.get(Path, 1)
        p1.status = "BLOCKED"
        db.session.commit()

    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="SHORTEST")
    assert status_code == 200
    rec = res["recommended_route"]

    # Blocked Node 2 cannot be used, route must divert through Node 3 or Node 5
    assert 2 not in rec["node_ids"]
    assert 1 not in rec["path_ids"]
    assert rec["node_ids"] in [[1, 3, 4], [1, 5, 4]]


def test_no_route_available_when_all_paths_blocked(app, seeded_campus_graph):
    """When all connecting corridors are BLOCKED, system returns clean error without crashing."""
    with app.app_context():
        # Block all outgoing paths from Node 1
        for pid in [1, 3, 5]:
            p = db.session.get(Path, pid)
            p.status = "BLOCKED"
        db.session.commit()

    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4)
    assert status_code == 404
    assert res["success"] is False
    assert res["error"] == "NO_ROUTE_AVAILABLE"
    assert "No safe route" in res["message"]


def test_isolated_node_handling(seeded_campus_graph):
    """Routing to an unlinked node must return 404 NO_ROUTE_AVAILABLE."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=6)
    assert status_code == 404
    assert res["success"] is False
    assert res["error"] == "NO_ROUTE_AVAILABLE"


def test_same_start_and_destination(seeded_campus_graph):
    """Origin == Destination returns zero distance and time with success."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=1)
    assert status_code == 200
    assert res["success"] is True
    assert res["recommended_route"]["total_distance_meters"] == 0.0
    assert res["recommended_route"]["estimated_time_seconds"] == 0.0


def test_invalid_node_ids(seeded_campus_graph):
    """Non-existent node IDs return 404 with meaningful message."""
    res, status_code = RoutingService.calculate_route(start_node_id=999, destination_node_id=4)
    assert status_code == 404
    assert res["success"] is False


def test_simulation_risk_score_calculation(seeded_campus_graph):
    """Verifies simulation risk score and categorization."""
    res, status_code = RoutingService.calculate_route(start_node_id=1, destination_node_id=4, mode="SHORTEST")
    rec = res["recommended_route"]
    assert 0.0 <= rec["simulation_risk_score"] <= 100.0
    assert rec["risk_level"] in ["MINIMAL_RISK", "MODERATE_RISK", "ELEVATED_RISK", "CRITICAL_RISK"]


# ==================== 2. INTEGRATION TESTS: ROUTING REST APIS ====================

def test_api_calculate_route_endpoint(client, seeded_campus_graph):
    """Tests POST /api/routes/calculate with JSON payload."""
    res = client.post('/api/routes/calculate', json={
        'start_node_id': 1,
        'destination_node_id': 4,
        'mode': 'CROWD_AWARE'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert 'recommended_route' in data['data']
    assert 'alternative_routes' in data['data']


def test_api_routing_config_get_and_update(client, auth_tokens):
    """Tests GET /api/routes/config and PUT /api/routes/config (Admin guarded)."""
    # GET config
    get_res = client.get('/api/routes/config')
    assert get_res.status_code == 200
    assert get_res.get_json()['data']['walking_speed'] == 1.4

    # Student cannot update (403)
    put_student = client.put('/api/routes/config', headers=auth_tokens['student'], json={'walking_speed': 1.6})
    assert put_student.status_code == 403

    # Admin updates config successfully
    put_admin = client.put('/api/routes/config', headers=auth_tokens['admin'], json={
        'walking_speed': 1.5,
        'congestion_weight': 0.75
    })
    assert put_admin.status_code == 200
    assert put_admin.get_json()['data']['walking_speed'] == 1.5
    assert put_admin.get_json()['data']['congestion_weight'] == 0.75
