"""
Phase 9: Advanced Analytics, Performance Evaluation & Research Dashboard Tests
==============================================================================
Comprehensive unit and integration tests verifying:
1. Overview analytics calculation
2. Crowd analytics & peak period detection
3. ML model analytics & error metrics (MAE, RMSE, MAPE)
4. Routing mode comparisons & corridor utilization
5. Emergency evacuation simulation analytics
6. Capacity optimization comparative metrics & deltas
7. What-If scenario analytics
8. Bottleneck corridor analytics & chokepoint detection
9. Exit capacity & load balancing analytics
10. System execution latency tracking & performance
11. Data quality & topology integrity validation
12. Multi-parameter filtering (dates, locations, modes)
13. CSV export endpoint generation
14. Empty-data handling & graceful defaults
15. Invalid filter resilience
"""

import os
import sys
import pytest
import json
from datetime import datetime, timezone, timedelta

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.campus import Building, Node, Path, Exit
from backend.models.crowd import CrowdData
from backend.models.prediction import MLModelMetadata, PredictionLog
from backend.models.emergency import EmergencyScenario, Simulation
from backend.models.optimization import OptimizationResult
from backend.models.what_if import WhatIfScenario
from backend.models.analytics import RouteLog, PerformanceLog
from backend.services.analytics_service import AnalyticsService


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
        'name': 'Analytics Admin',
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
        'admin_token': admin_token,
        'student_token': student_token,
        'admin_headers': {'Authorization': f'Bearer {admin_token}'},
        'student_headers': {'Authorization': f'Bearer {student_token}'}
    }


@pytest.fixture
def seed_campus_analytics_data(app):
    """Populates realistic database entities across all domains for analytics testing."""
    with app.app_context():
        # 1. Nodes & Buildings
        n1 = Node(name="Main Gate Junction", node_type="INTERSECTION", latitude=12.9710, longitude=77.5930)
        n2 = Node(name="CSE Block Node", node_type="BUILDING", latitude=12.9720, longitude=77.5940)
        n3 = Node(name="Library Node", node_type="BUILDING", latitude=12.9730, longitude=77.5950)
        n4 = Node(name="North Gate Node", node_type="EXIT", latitude=12.9740, longitude=77.5960)
        db.session.add_all([n1, n2, n3, n4])
        db.session.commit()

        b1 = Building(name="Computer Science Block", building_code="CSE-01", type="ACADEMIC", capacity=600, node_id=n2.id, latitude=12.9720, longitude=77.5940)
        b2 = Building(name="Central Library", building_code="LIB-01", type="FACILITY", capacity=400, node_id=n3.id, latitude=12.9730, longitude=77.5950)
        db.session.add_all([b1, b2])

        ex1 = Exit(name="North Perimeter Gate", capacity=350, node_id=n4.id, status="ACTIVE")
        db.session.add(ex1)

        p1 = Path(source_node_id=n1.id, destination_node_id=n2.id, distance_meters=120.0, capacity=200, current_crowd=50, status="OPEN", is_bidirectional=True)
        p2 = Path(source_node_id=n2.id, destination_node_id=n3.id, distance_meters=140.0, capacity=220, current_crowd=70, status="OPEN", is_bidirectional=True)
        p3 = Path(source_node_id=n3.id, destination_node_id=n4.id, distance_meters=110.0, capacity=300, current_crowd=40, status="OPEN", is_bidirectional=True)
        db.session.add_all([p1, p2, p3])
        db.session.commit()

        # 2. Crowd Data Time Series (Multiple timestamps)
        now = datetime.now(timezone.utc)
        c1 = CrowdData(location_id=b1.id, crowd_count=450, capacity=600, density_percentage=75.0, congestion_level='HIGH', timestamp=now - timedelta(hours=3))
        c2 = CrowdData(location_id=b1.id, crowd_count=520, capacity=600, density_percentage=86.67, congestion_level='HIGH', timestamp=now - timedelta(hours=2))
        c3 = CrowdData(location_id=b2.id, crowd_count=150, capacity=400, density_percentage=37.5, congestion_level='LOW', timestamp=now - timedelta(hours=1))
        c4 = CrowdData(location_id=b2.id, crowd_count=200, capacity=400, density_percentage=50.0, congestion_level='MEDIUM', timestamp=now)
        db.session.add_all([c1, c2, c3, c4])

        # 3. Emergency Simulation & Optimization
        scenario = EmergencyScenario(
            name="CSE Lab Chemical Incident",
            emergency_type="GAS_LEAK",
            emergency_location_id=b1.id,
            emergency_node_id=n2.id,
            severity="HIGH",
            affected_people_count=400,
            status="COMPLETED"
        )
        db.session.add(scenario)
        db.session.commit()

        sim = Simulation(
            scenario_id=scenario.id,
            people_count=400,
            simulation_mode="LIVE_CROWD",
            estimated_evacuation_time=88.5,
            max_congestion="HIGH",
            bottleneck_count=1,
            successfully_assigned=400,
            unassigned_people=0,
            evacuation_progress_percentage=100.0,
            bottlenecks_summary=json.dumps([{
                "path_id": p2.id,
                "utilization_percentage": 88.5,
                "total_flow_rate": 180,
                "capacity": 220,
                "severity": "HIGH",
                "recommended_action": "Reroute to library bypass"
            }]),
            exit_utilization_summary=json.dumps([{
                "exit_id": ex1.id,
                "assigned_people": 400,
                "capacity": 350
            }])
        )
        db.session.add(sim)
        db.session.commit()

        opt = OptimizationResult(
            simulation_id=sim.id,
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            optimization_method="CAPACITY_AWARE_MIN_COST_FLOW",
            baseline_time=88.5,
            baseline_max_congestion="HIGH",
            baseline_avg_utilization=65.0,
            baseline_total_distance=350.0,
            baseline_unassigned=0,
            baseline_bottlenecks_count=1,
            optimized_time=68.2,
            optimized_max_congestion="MEDIUM",
            optimized_avg_utilization=48.0,
            optimized_total_distance=370.0,
            optimized_unassigned=0,
            optimized_bottlenecks_count=0,
            time_reduction_percentage=22.94,
            congestion_reduction_percentage=26.15,
            distance_change_percentage=5.71,
            optimized_exits_json=json.dumps([{
                "exit_id": ex1.id,
                "exit_name": ex1.name,
                "capacity": 350,
                "baseline_assigned_people": 400,
                "optimized_assigned_people": 350
            }])
        )
        db.session.add(opt)

        # 4. What-If Scenario
        wi = WhatIfScenario(
            name="North Gate Reduced Capacity Test",
            scenario_type="EXIT_BLOCKED",
            status="COMPLETED",
            parameters=json.dumps({"blocked_exit_ids": [ex1.id]}),
            baseline_metrics=json.dumps({"evacuation_time_sec": 88.5, "bottlenecks_count": 1}),
            scenario_metrics=json.dumps({"evacuation_time_sec": 112.0, "bottlenecks_count": 2}),
            comparison=json.dumps({"time_delta_sec": 23.5, "time_delta_percentage": 26.55})
        )
        db.session.add(wi)

        # 5. Route Logs & Performance Logs
        rlog = RouteLog(
            origin_name=b1.name,
            destination_name=ex1.name,
            origin_node_id=n2.id,
            destination_node_id=n4.id,
            routing_mode='CROWD_AWARE',
            distance_meters=250.0,
            estimated_time_sec=180.0,
            max_congestion='MEDIUM',
            avg_congestion_score=45.0,
            risk_level='LOW',
            node_count=3,
            path_ids=json.dumps([p2.id, p3.id])
        )
        db.session.add(rlog)

        PerformanceLog.record('ROUTE_CALCULATION', 15.4, 'SUCCESS')
        PerformanceLog.record('EMERGENCY_SIMULATION', 92.1, 'SUCCESS')
        PerformanceLog.record('OPTIMIZATION_EXECUTION', 110.5, 'SUCCESS')
        db.session.commit()


# =============================================================================
# UNIT & INTEGRATION TESTS
# =============================================================================

def test_overview_analytics(client, auth_tokens, seed_campus_analytics_data):
    """1. Test GET /api/analytics/overview returns genuine aggregated KPIs."""
    res = client.get('/api/analytics/overview', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_crowd_records'] >= 4
    assert data['average_crowd'] > 0
    assert data['maximum_crowd'] == 520
    assert data['most_congested_location']['name'] == 'Computer Science Block'
    assert data['total_emergency_simulations'] >= 1
    assert data['total_optimizations'] >= 1
    assert data['total_what_if_scenarios'] >= 1
    assert data['average_simulation_time'] > 0


def test_crowd_analytics_and_peak_period(client, auth_tokens, seed_campus_analytics_data):
    """2. Test crowd over time, location comparison, and dynamic peak period detection."""
    res = client.get('/api/analytics/crowd', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert len(data['crowd_over_time']) >= 4
    assert len(data['location_comparison']) >= 2
    assert 'LOW' in data['congestion_distribution']
    assert 'HIGH' in data['congestion_distribution']

    peak = data['peak_crowd_analysis']
    assert peak['maximum_recorded_crowd'] == 520
    assert peak['peak_location'] == 'Computer Science Block'
    assert 0 <= peak['peak_hour'] <= 23


def test_prediction_analytics_and_error_metrics(client, auth_tokens, seed_campus_analytics_data):
    """3. Test ML model analytics, MAE, RMSE, and location error breakdowns."""
    res = client.get('/api/analytics/predictions', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert 'model_metadata' in data
    assert 'location_error_analysis' in data
    assert len(data['location_error_analysis']) >= 2

    # Check non-empty location errors
    loc_err = data['location_error_analysis'][0]
    assert 'mae' in loc_err
    assert 'rmse' in loc_err
    assert 'mape_percentage' in loc_err


def test_routing_analytics_and_mode_comparisons(client, auth_tokens, seed_campus_analytics_data):
    """4. Test Phase 5 routing comparisons across Shortest, Fastest, Crowd-Aware, Predictive."""
    res = client.get('/api/analytics/routing', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    modes = [m['mode'] for m in data['mode_comparisons']]
    assert 'SHORTEST' in modes
    assert 'FASTEST' in modes
    assert 'CROWD_AWARE' in modes
    assert 'PREDICTIVE' in modes

    assert 'corridor_utilization_analysis' in data
    assert 'predictive_routing_comparison' in data


def test_emergency_analytics(client, auth_tokens, seed_campus_analytics_data):
    """5. Test Phase 6 emergency simulation analysis and type breakdown."""
    res = client.get('/api/analytics/emergency', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_simulations'] >= 1
    assert data['summary_metrics']['average_evacuation_time_sec'] > 0
    assert len(data['emergency_type_distribution']) >= 1
    assert data['emergency_type_distribution'][0]['emergency_type'] == 'GAS_LEAK'


def test_optimization_analytics_and_deltas(client, auth_tokens, seed_campus_analytics_data):
    """6. Test Phase 7 optimization metrics, baseline vs optimized, and exit allocations."""
    res = client.get('/api/analytics/optimization', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_optimizations'] >= 1
    assert data['comparative_summary']['average_time_change_percentage'] > 0
    assert len(data['results']) >= 1
    assert data['results'][0]['comparison']['time_reduction_percentage'] > 0


def test_what_if_analytics(client, auth_tokens, seed_campus_analytics_data):
    """7. Test Phase 8 What-If contingency scenario results and delta matrix."""
    res = client.get('/api/analytics/what-if', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_what_if_scenarios'] >= 1
    assert len(data['scenario_type_distribution']) >= 1
    assert data['scenario_type_distribution'][0]['scenario_type'] == 'EXIT_BLOCKED'


def test_bottleneck_analytics(client, auth_tokens, seed_campus_analytics_data):
    """8. Test corridor bottleneck occurrences, load percentages, and chokepoints."""
    res = client.get('/api/analytics/bottlenecks', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_bottlenecks_recorded'] >= 1
    assert len(data['bottlenecks_table']) >= 1
    assert data['bottlenecks_table'][0]['average_utilization_percentage'] > 0


def test_exit_analytics(client, auth_tokens, seed_campus_analytics_data):
    """9. Test exit capacity, assigned people, and utilization percentages."""
    res = client.get('/api/analytics/exits', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_perimeter_exits'] >= 1
    assert len(data['exits_table']) >= 1
    ex = data['exits_table'][0]
    assert ex['name'] == 'North Perimeter Gate'
    assert ex['capacity'] == 350


def test_performance_analytics(client, auth_tokens, seed_campus_analytics_data):
    """10. Test execution latency metrics (min, max, avg time)."""
    res = client.get('/api/analytics/performance', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['total_logged_executions'] >= 3
    ops = [p['operation'] for p in data['performance_table']]
    assert 'ROUTE_CALCULATION' in ops
    assert 'EMERGENCY_SIMULATION' in ops


def test_data_quality_validation(client, auth_tokens, seed_campus_analytics_data):
    """11. Test data quality and topology integrity check."""
    res = client.get('/api/analytics/data-quality', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    assert data['quality_score_percentage'] > 90.0
    assert data['valid_records_count'] > 0
    assert data['integrity_checks']['invalid_facility_capacities'] == 0


def test_analytics_filters(client, auth_tokens, seed_campus_analytics_data):
    """12. Test filtering crowd data by location_id and date boundaries."""
    bldg = Building.query.first()
    res = client.get(f'/api/analytics/crowd?location_id={bldg.id}', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']

    for pt in data['crowd_over_time']:
        assert pt['location_id'] == bldg.id


def test_csv_export_endpoint(client, auth_tokens, seed_campus_analytics_data):
    """13. Test GET /api/analytics/export returns valid CSV report."""
    res = client.get('/api/analytics/export', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    assert res.mimetype == 'text/csv'
    csv_text = res.get_data(as_text=True)

    assert "MASTER RESEARCH REPORT" in csv_text
    assert "CAMPUS FACILITY CROWD" in csv_text
    assert "ROUTING MODES COMPARISON" in csv_text


def test_empty_data_conditions_handling(client, auth_tokens):
    """14. Test analytics services execute safely with zero records without division-by-zero."""
    res = client.get('/api/analytics/overview', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['total_crowd_records'] == 0
    assert data['average_crowd'] == 0.0

    res_cr = client.get('/api/analytics/crowd', headers=auth_tokens['admin_headers'])
    assert res_cr.status_code == 200

    res_em = client.get('/api/analytics/emergency', headers=auth_tokens['admin_headers'])
    assert res_em.status_code == 200
    assert res_em.get_json()['data']['total_simulations'] == 0


def test_invalid_filters_handling(client, auth_tokens, seed_campus_analytics_data):
    """15. Test analytics endpoints handle invalid filter types gracefully."""
    res = client.get('/api/analytics/crowd?location_id=999999&start_date=invalid-date', headers=auth_tokens['admin_headers'])
    assert res.status_code == 200
    data = res.get_json()['data']
    assert len(data['crowd_over_time']) == 0

    res_rt = client.get('/api/analytics/routing?mode=NON_EXISTENT_MODE', headers=auth_tokens['admin_headers'])
    assert res_rt.status_code == 200
