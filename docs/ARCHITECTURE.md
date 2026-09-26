# System Architecture Documentation

## 1. High-Level Architecture Overview

The system is architected as a modular, full-stack multi-tier platform comprising:
1. **Interactive Client Tier (SPA)**: React 18 + Vite + Tailwind CSS + Leaflet GIS + Chart.js
2. **API & Security Gateway Tier**: Flask RESTful Blueprints + JWT Auth + RBAC Guard
3. **Core Computation Engine Tier**:
   - Spatio-temporal Graph Engine
   - Intelligent Routing Engine (Dijkstra + Crowd Impedance Cost Function)
   - Machine Learning Time-Series Prediction Engine (Random Forest Regressor Pipeline)
   - Cellular/Spatial Evacuation Simulation Engine
   - Capacity-Constrained Evacuation Flow Optimization Engine (Min-Cost Max-Flow)
   - What-If Sensitivity & Contingency Engine
   - Analytics, Audit & Reporting Service
4. **Data Persistence Tier**: SQLAlchemy ORM + SQLite (Development/Local) / PostgreSQL (Production)

```
+-------------------------------------------------------------------------------+
|                           CLIENT TIER (React 18 SPA)                          |
|  - Campus GIS Map (Leaflet)     - Intelligent Route Finder                    |
|  - ML Prediction Console        - Emergency Evacuation Visualizer             |
|  - Capacity Flow Optimizer      - What-If Contingency Simulator               |
|  - Master Analytics Dashboard   - Academic CSV Report Exporter                |
+-------------------------------------------------------------------------------+
                                      |
                           HTTPS / REST JSON API
                                      |
+-------------------------------------------------------------------------------+
|                            API & SECURITY GATEWAY                             |
|  - JWT Authentication & RBAC    - CORS Policy Enforcement                     |
|  - Request Validation Layer     - Centralized Error / Exception Handler       |
+-------------------------------------------------------------------------------+
                                      |
+-------------------------------------------------------------------------------+
|                           BACKEND SERVICES & ENGINES                          |
|                                                                               |
|  +--------------------+  +--------------------+  +-------------------------+  |
|  |   Graph Routing    |  |   ML Crowd Model   |  |  Evacuation Simulation  |  |
|  | - Shortest / Fast  |  | - Random Forest    |  | - Bottleneck Detection  |  |
|  | - Crowd-Aware Cost |  | - Time-Series Lags |  | - Exit Load Accumulator |  |
|  | - Predictive Graph |  | - Multi-Step Ahead |  | - Clearance Estimator   |  |
|  +--------------------+  +--------------------+  +-------------------------+  |
|            |                       |                          |               |
|            +-----------------------+--------------------------+               |
|                                    |                                          |
|            +-----------------------+--------------------------+               |
|            |                                                  |               |
|  +--------------------+  +--------------------+  +-------------------------+  |
|  | Flow Optimization  |  |  What-If Engine    |  |   Master Analytics      |  |
|  | - Min-Cost Flow    |  | - Isolation Sandbox|  | - Empirical Aggregator  |  |
|  | - Capacity Aware   |  | - Delta Matrix     |  | - Latency Benchmarker   |  |
|  | - Exit Balancing   |  | - Sensitivity Eval |  | - CSV Report Generator  |  |
|  +--------------------+  +--------------------+  +-------------------------+  |
+-------------------------------------------------------------------------------+
                                      |
                               SQLAlchemy ORM
                                      |
+-------------------------------------------------------------------------------+
|                            DATA PERSISTENCE LAYER                             |
|  - Users & Roles                - Campus Spatial Topology (Nodes/Paths/Exits) |
|  - Historical Crowd Records     - ML Model Metadata & Logs                    |
|  - Simulation Results           - Optimization Outcomes                       |
|  - What-If Contingency Scenarios- Operational Performance Logs                |
+-------------------------------------------------------------------------------+
```

---

## 2. End-to-End Data Flow Pipeline

The end-to-end data processing lifecycle flows sequentially across nine integrated phases:

$$\text{Campus Topology \& GIS} \longrightarrow \text{Crowd Ingestion} \longrightarrow \text{ML Multi-Step Forecasting} \longrightarrow \text{Intelligent Routing}$$

$$\longrightarrow \text{Emergency Trigger} \longrightarrow \text{Evacuation Simulation} \longrightarrow \text{Capacity Optimization}$$

$$\longrightarrow \text{What-If Perturbation Analysis} \longrightarrow \text{Master Analytics \& Reporting}$$

1. **Topology Definition**: 24 Nodes, 12 Buildings, 37 Corridors, and 4 Perimeter Exits represent physical campus geometry with geocoordinates, widths, lengths, and capacities.
2. **Crowd Ingestion**: Sensor streams record occupancy, calculating density $\rho = \frac{\text{count}}{\text{capacity}} \times 100\%$.
3. **ML Prediction Engine**: Evaluates feature vectors ($t, d, \text{is\_weekend}, \text{prev\_occupancy}$) to forecast $\hat{y}_{t+h}$ across future horizons.
4. **Intelligent Routing**: Dynamic impedance weights calculate least-effort paths:
   $$W(e) = \text{Distance}(e) \times \left(1.0 + \alpha \cdot \frac{\text{Crowd}(e)}{\text{Capacity}(e)}\right)$$
5. **Emergency Simulation**: Evacuates occupants toward nearest exits, tracking corridor capacities and chokepoints.
6. **Flow Optimization**: Resolves bottleneck congestion using minimum cost capacity-constrained flow network optimization.
7. **What-If Engine**: Evaluates disaster resilience by perturbing node/corridor/exit states without altering underlying database data.
8. **Master Analytics**: Aggregates mathematical KPIs, latency metrics, and outputs formatted research evaluation reports.
