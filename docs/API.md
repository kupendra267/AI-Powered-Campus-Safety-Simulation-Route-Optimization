# Campus Simulation & Emergency Optimization REST API Documentation

Comprehensive reference documentation for all REST API endpoints provided by the backend Flask server.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new user account (Student or Admin).
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@campus.edu",
    "password": "SecurePassword@123",
    "role": "STUDENT"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "data": {
      "user": {
        "id": 3,
        "name": "Jane Doe",
        "email": "jane@campus.edu",
        "role": "STUDENT"
      },
      "access_token": "eyJhbGciOi..."
    }
  }
  ```

### `POST /api/auth/login`
Authenticates user and issues JWT bearer token.
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "email": "admin@campus.edu",
    "password": "Admin@123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "user": {
        "id": 1,
        "name": "Campus Administrator",
        "email": "admin@campus.edu",
        "role": "ADMIN"
      },
      "access_token": "eyJhbGci..."
    }
  }
  ```

### `GET /api/auth/profile`
Retrieves profile for authenticated user.
- **Authentication**: `Bearer <JWT_TOKEN>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "Campus Administrator",
      "email": "admin@campus.edu",
      "role": "ADMIN"
    }
  }
  ```

---

## 2. Campus Spatial Topology (`/api/campus`)

### `GET /api/campus/graph`
Returns complete campus graph including nodes, adjacency list, buildings, paths, and exits.
- **Authentication**: Optional
- **Response `200 OK`**: Contains `nodes`, `edges`, `buildings`, `exits`, `graph_metadata`.

### `GET /api/campus/buildings`
Returns list of all campus facilities and current capacities.
- **Authentication**: Optional

### `POST /api/campus/paths/<path_id>/toggle-status`
Admin endpoint to dynamically block or unblock a corridor path.
- **Authentication**: `Bearer <JWT_TOKEN>` (Admin role required)
- **Response `200 OK`**: Returns updated path status (`ACTIVE` / `BLOCKED`).

---

## 3. Crowd Monitoring & Density (`/api/crowd`)

### `GET /api/crowd/current`
Returns latest crowd occupancy counts, densities (%), and congestion levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) across all 12 facilities.
- **Authentication**: Optional

### `GET /api/crowd/summary`
Campus-wide aggregate statistics (total people on campus, average density, alert level).
- **Authentication**: Optional

### `POST /api/crowd`
Records new crowd reading.
- **Authentication**: `Bearer <JWT_TOKEN>` (Admin role required)

---

## 4. Machine Learning Predictions (`/api/predictions`)

### `POST /api/predictions/predict`
Calculates single-step or multi-step crowd forecast for a facility.
- **Authentication**: Optional
- **Request Body**:
  ```json
  {
    "location_id": 2,
    "horizon_steps": 6
  }
  ```
- **Response `200 OK`**: Returns forecasted crowd counts, predicted density percentages, risk level, and time horizons.

### `GET /api/predictions/summary`
Returns ML forecasts for all campus facilities over the next 1–4 hours.

### `GET /api/predictions/metadata`
Returns champion model performance metrics ($R^2$, MAE, RMSE, training timestamp, dataset size).

---

## 5. Intelligent Routing Engine (`/api/routes`)

### `POST /api/routes/calculate`
Calculates optimal route and alternatives between any two campus nodes.
- **Authentication**: Optional
- **Request Body**:
  ```json
  {
    "start_node_id": 1,
    "destination_node_id": 14,
    "mode": "CROWD_AWARE",
    "horizon_hours": 1
  }
  ```
- **Supported Modes**: `SHORTEST`, `FASTEST`, `CROWD_AWARE`, `PREDICTIVE`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "mode": "CROWD_AWARE",
      "distance_meters": 245.5,
      "estimated_time_seconds": 182.0,
      "max_congestion": "MEDIUM",
      "path_nodes": [1, 3, 7, 14],
      "alternative_routes": [...]
    }
  }
  ```

---

## 6. Emergency Simulation (`/api/emergency` & `/api/simulation`)

### `GET /api/emergency`
Lists all declared emergency scenarios.

### `POST /api/emergency`
Creates a new emergency scenario (Admin only).

### `POST /api/simulation/run`
Executes spatial evacuation simulation for a scenario.
- **Request Body**: `{"scenario_id": 1}`
- **Response `200 OK`**: Returns clearance time, route allocations, detected bottlenecks, and unassigned evacuee count.

---

## 7. Evacuation Flow Optimization (`/api/optimization`)

### `POST /api/optimization/run`
Executes capacity-constrained minimum cost flow optimization for an emergency evacuation.
- **Request Body**: `{"scenario_id": 1}`
- **Response `200 OK`**: Returns baseline vs. optimized comparison, percentage improvement in clearance time, congestion mitigation, and balanced exit load distributions.

### `GET /api/optimization/history`
Returns history of all optimization runs and comparative metrics.

---

## 8. What-If Scenario Analysis (`/api/what-if`)

### `POST /api/what-if/quick-run`
Runs an on-the-fly contingency simulation without mutating database state.
- **Supported Types**: `EXIT_BLOCKED`, `PATH_BLOCKED`, `CROWD_SURGE`, `CROWD_REDUCTION`, `MULTIPLE_FAILURES`.
- **Request Body**:
  ```json
  {
    "name": "North Gate Closure Test",
    "scenario_type": "EXIT_BLOCKED",
    "parameters": {
      "blocked_exit_ids": [1]
    }
  }
  ```
- **Response `200 OK`**: Returns baseline vs scenario delta metrics ($\Delta$ time, $\Delta$ congestion, new bottlenecks).

---

## 9. Advanced Analytics & Reporting (`/api/analytics`)

### `GET /api/analytics/overview`
Master KPI summary (total records, simulations, optimizations, average evacuation times).

### `GET /api/analytics/crowd`
Spatio-temporal crowd density time series, facility density comparisons, and peak hour detection.

### `GET /api/analytics/predictions`
Champion regression model evaluation, $R^2$, MAE, RMSE, actual vs. predicted validation points, and feature importances.

### `GET /api/analytics/routing`
Direct performance comparison between Shortest, Fastest, Crowd-Aware, and Predictive algorithms.

### `GET /api/analytics/emergency`
Evacuation clearance time distributions across disaster types.

### `GET /api/analytics/optimization`
Quantitative optimization benchmark statistics.

### `GET /api/analytics/what-if`
Sensitivity and contingency matrix across all What-If runs.

### `GET /api/analytics/performance`
Measured computational latency log across all subsystem operations.

### `GET /api/analytics/export`
Generates and downloads the full academic research CSV report.
