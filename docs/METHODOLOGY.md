# Research Methodology & Mathematical Formulations

## 1. Machine Learning Crowd Prediction

### Problem Formulation
Given historical crowd observations $X = \{x_1, x_2, \dots, x_N\}$ where each observation $x_i = (\text{facility\_id}, t, d, \text{is\_weekend}, \text{event\_flag})$, our objective is to learn a regression function $f: \mathcal{X} \to \mathbb{R}^+$ that predicts the future crowd occupancy count $\hat{y}_{t+h}$ over forecasting horizons $h \in \{1, 2, 3, 4, 5, 6\}$ time steps (15-minute intervals).

### Feature Engineering
1. **Temporal Features**: Hour-of-day sine/cosine cyclicity:
   $$\text{Hour}_{\sin} = \sin\left(\frac{2\pi \cdot t_{\text{hour}}}{24}\right), \quad \text{Hour}_{\cos} = \cos\left(\frac{2\pi \cdot t_{\text{hour}}}{24}\right)$$
2. **Calendar Features**: Day of week $d \in [0, 6]$, Weekend indicator $w \in \{0, 1\}$.
3. **Spatial Features**: Facility Type Categorical Encoding (Admin, Academic, Library, Canteen, Hostel, Sports, Medical).
4. **Capacity Normalization**: Facility designed capacity $C_{\text{facility}}$.

### Model Comparison & Validation Metrics
We trained and benchmarked four candidate regression architectures using a chronological 70/15/15 train/val/test split on 25,920 records:

| Model Architecture | Validation MAE | Validation RMSE | Validation $R^2$ Score |
| :--- | :---: | :---: | :---: |
| **Linear Regression (Baseline)** | 64.06 | 103.22 | 0.6959 |
| **HistGradientBoosting Regressor** | 20.57 | 30.75 | 0.9730 |
| **Gradient Boosting Regressor** | 21.92 | 34.61 | 0.9658 |
| **Random Forest Regressor (Champion)** | **19.07** | **29.93** | **0.9744** |

**Final Test Set Evaluation (Random Forest)**:
- Test MAE: **19.09**
- Test RMSE: **29.99**
- Test $R^2$: **0.9743**

---

## 2. Graph Modeling & Intelligent Routing Algorithms

### Campus Graph Construction
The campus is modeled as a directed spatial graph $G = (V, E)$ where:
- $V = \{v_1, v_2, \dots, v_{24}\}$: Intersections, building entrance hubs, and perimeter exit gates.
- $E = \{e_1, e_2, \dots, e_{37}\}$: Campus pathways and pedestrian corridors.
- Each edge $e = (u, v) \in E$ has length $L_e$ (meters), width $W_e$ (meters), nominal pedestrian capacity $C_e$, and dynamic crowd count $N_e(t)$.

### Cost Functions
1. **Shortest Distance Mode**:
   $$\text{Cost}_{\text{dist}}(e) = L_e$$
2. **Fastest Travel Time Mode**:
   $$\text{Cost}_{\text{time}}(e) = \frac{L_e}{v_0}$$
   where nominal walking speed $v_0 = 1.33 \text{ m/s}$ (approx. $4.8 \text{ km/h}$).
3. **Crowd-Aware Cost Function (Weidmann Pedestrian Impedance)**:
   $$v(e) = v_0 \cdot \max\left(0.2, 1.0 - 0.8 \cdot \frac{N_e(t)}{C_e}\right)$$
   $$\text{Cost}_{\text{crowd}}(e) = \frac{L_e}{v(e)} \times \left(1.0 + \beta \cdot \max\left(0, \frac{N_e(t)}{C_e} - 0.7\right)\right)$$
4. **Predictive Routing Mode**:
   Substitutes $N_e(t)$ with ML forecasted occupancy $\hat{N}_e(t + \Delta t_{\text{travel}})$.

---

## 3. Emergency Evacuation Simulation & Flow Optimization

### Evacuation Dynamics
During an emergency event (Fire, Gas Leak, Earthquake), affected buildings must evacuate all occupants $P_b$ across available exits $X \subset V$.

### Optimization Objective Formulation
The Min-Cost Capacity Flow Optimization solves:
$$\min \sum_{e \in E} \left[ w_{\text{time}} \cdot T_e(f_e) + w_{\text{cong}} \cdot \left(\frac{f_e}{C_e}\right)^2 + w_{\text{dist}} \cdot L_e \right] + w_{\text{exit}} \sum_{x \in X} \text{Overload}(x)$$

Subject to:
1. **Flow Conservation**:
   $$\sum_{w: (u, w) \in E} f_{uw} - \sum_{v: (v, u) \in E} f_{vu} = \begin{cases} P_u & \text{if } u \text{ is source} \\ -E_u & \text{if } u \text{ is exit} \\ 0 & \text{otherwise} \end{cases}$$
2. **Corridor Edge Capacities**:
   $$0 \le f_e \le C_e \quad \forall e \in E$$
3. **Exit Capacity Constraints**:
   $$\sum_{e \in \text{Inflow}(x)} f_e \le C_x \quad \forall x \in X$$

---

## 4. What-If Contingency & Sensitivity Evaluation

The What-If Engine creates an in-memory isolated overlay graph $G' = (V', E')$ with simulated perturbations:
1. **Corridor Failure**: Sets $E' = E \setminus \{e_{\text{blocked}}\}$.
2. **Exit Outage**: Sets $X' = X \setminus \{x_{\text{disabled}}\}$.
3. **Crowd Surges**: Adjusts source volumes $P'_b = P_b \cdot (1 + \delta_{\text{surge}})$.

Simulates evacuation and calculates percentage deltas:
$$\Delta T = \frac{T_{\text{scenario}} - T_{\text{baseline}}}{T_{\text{baseline}}} \times 100\%$$
$$\Delta B = B_{\text{scenario}} - B_{\text{baseline}}$$
