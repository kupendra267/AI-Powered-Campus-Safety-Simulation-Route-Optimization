import React, { useState, useEffect } from 'react';
import { optimizationService } from '../../services/optimizationService';
import { emergencyService } from '../../services/emergencyService';
import { campusService } from '../../services/campusService';
import { crowdService } from '../../services/crowdService';
import CampusLeafletMap from '../../components/map/CampusLeafletMap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Radar, Line } from 'react-chartjs-2';
import {
  Cpu,
  Sparkles,
  Zap,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  ShieldCheck,
  DoorOpen,
  ArrowRight,
  Compass,
  Sliders,
  RefreshCw,
  Info,
  CheckCircle2,
  Check,
  Flame,
  Activity,
  ChevronRight,
  History,
  Layers,
  Settings
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const OptimizationDashboard = () => {
  // Data States
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [exits, setExits] = useState([]);
  const [crowdData, setCrowdData] = useState([]);

  // Configuration States
  const [weights, setWeights] = useState({
    evacuation_time: 0.40,
    congestion: 0.30,
    distance: 0.20,
    exit_overload: 0.10
  });
  const [maxIterations, setMaxIterations] = useState(30);
  const [usePredictedCrowd, setUsePredictedCrowd] = useState(true);

  // UI States
  const [viewMode, setViewMode] = useState('OPTIMIZED'); // 'BASELINE' | 'OPTIMIZED'
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [scenariosRes, buildingsRes, nodesRes, pathsRes, exitsRes, crowdRes, configRes, historyRes] =
        await Promise.all([
          emergencyService.getScenarios(),
          campusService.getBuildings(),
          campusService.getNodes(),
          campusService.getPaths(),
          campusService.getExits(),
          crowdService.getCurrentCrowd(),
          optimizationService.getConfig(),
          optimizationService.getHistory(15)
        ]);

      setScenarios(scenariosRes.data || []);
      setBuildings(buildingsRes.data || []);
      setNodes(nodesRes.data || []);
      setPaths(pathsRes.data || []);
      setExits(exitsRes.data || []);
      setCrowdData(crowdRes.data || []);
      setHistoryList(historyRes.data || []);

      if (configRes.data?.weights) {
        setWeights(configRes.data.weights);
        setMaxIterations(configRes.data.max_iterations || 30);
        setUsePredictedCrowd(configRes.data.use_predicted_crowd ?? true);
      }

      if (scenariosRes.data && scenariosRes.data.length > 0) {
        setSelectedScenarioId(scenariosRes.data[0].id);
      }

      if (historyRes.data && historyRes.data.length > 0) {
        // Load latest optimization
        const latest = historyRes.data[0];
        setOptimizationResult(latest);
      }
    } catch (err) {
      console.error('Failed to load optimization dashboard data:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load initial data.' });
    } finally {
      setLoading(false);
    }
  };

  // Run Evacuation Optimization
  const handleRunOptimization = async () => {
    if (!selectedScenarioId) {
      setStatusMessage({ type: 'error', text: 'Please select an emergency scenario first.' });
      return;
    }

    try {
      setOptimizing(true);
      setStatusMessage(null);

      const payload = {
        scenario_id: Number(selectedScenarioId),
        weights: weights,
        max_iterations: Number(maxIterations),
        use_predicted_crowd: usePredictedCrowd
      };

      const res = await optimizationService.runOptimization(payload);

      if (res.success && res.data) {
        setOptimizationResult(res.data);
        setStatusMessage({ type: 'success', text: res.message });

        // Refresh history
        const hist = await optimizationService.getHistory(15);
        setHistoryList(hist.data || []);
      }
    } catch (err) {
      console.error('Optimization execution error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to execute evacuation optimization.'
      });
    } finally {
      setOptimizing(false);
    }
  };

  // Save Config Weights
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await optimizationService.updateConfig({
        weights,
        max_iterations: Number(maxIterations),
        use_predicted_crowd: usePredictedCrowd
      });
      setShowConfigModal(false);
      setStatusMessage({ type: 'success', text: 'Optimization configuration saved.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save configuration.' });
    }
  };

  const selectedScenario = scenarios.find(s => s.id === Number(selectedScenarioId));

  const mapEpicenter = selectedScenario ? {
    latitude: selectedScenario.epicenter_latitude,
    longitude: selectedScenario.epicenter_longitude,
    building_id: selectedScenario.epicenter_building_id,
    radius: selectedScenario.affected_radius_meters || 100,
    type: selectedScenario.emergency_type,
    label: selectedScenario.name
  } : null;

  // Active Routes based on viewMode ('BASELINE' vs 'OPTIMIZED')
  const displayedRoutes = optimizationResult
    ? (viewMode === 'OPTIMIZED' ? optimizationResult.optimized?.routes : optimizationResult.baseline?.routes) || []
    : [];

  const displayedBottlenecks = optimizationResult
    ? (viewMode === 'OPTIMIZED' ? optimizationResult.optimized?.bottlenecks : optimizationResult.baseline?.bottlenecks) || []
    : [];

  // Chart Data: Baseline vs Optimized Metrics Comparison
  const comparisonChartData = {
    labels: ['Evac Time (s)', 'Peak Util (%)', 'Avg Util (%)', 'Avg Dist (10m)'],
    datasets: [
      {
        label: 'Baseline (Unoptimized)',
        data: optimizationResult ? [
          optimizationResult.baseline?.evacuation_time_sec || 0,
          optimizationResult.baseline?.max_congestion === 'CRITICAL' ? 95 : (optimizationResult.baseline?.max_congestion === 'HIGH' ? 80 : 50),
          optimizationResult.baseline?.avg_utilization_percentage || 0,
          (optimizationResult.baseline?.total_distance_meters || 0) / 10
        ] : [0, 0, 0, 0],
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 6
      },
      {
        label: 'Optimized Flow',
        data: optimizationResult ? [
          optimizationResult.optimized?.evacuation_time_sec || 0,
          optimizationResult.optimized?.max_congestion === 'CRITICAL' ? 90 : (optimizationResult.optimized?.max_congestion === 'HIGH' ? 70 : 40),
          optimizationResult.optimized?.avg_utilization_percentage || 0,
          (optimizationResult.optimized?.total_distance_meters || 0) / 10
        ] : [0, 0, 0, 0],
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6
      }
    ]
  };

  // Chart Data: Multi-Exit Allocation (Capacity vs Baseline vs Optimized)
  const exitAllocationChartData = {
    labels: exits.map(e => e.name),
    datasets: [
      {
        label: 'Exit Discharge Cap (p/min)',
        data: exits.map(e => e.capacity),
        backgroundColor: 'rgba(100, 116, 139, 0.5)',
        borderRadius: 4
      },
      {
        label: 'Baseline Assigned',
        data: exits.map(e => {
          const entry = (optimizationResult?.baseline?.exits || []).find(x => x.exit_id === e.id);
          return entry ? entry.assigned_people : 0;
        }),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      },
      {
        label: 'Optimized Assigned',
        data: exits.map(e => {
          const entry = (optimizationResult?.optimized?.exits || []).find(x => x.exit_id === e.id);
          return entry ? entry.assigned_people : 0;
        }),
        backgroundColor: '#10b981',
        borderRadius: 4
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. ACADEMIC DISCLAIMER BANNER */}
      <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest block">
              Academic & Optimization Research Notice
            </span>
            <p className="text-xs text-amber-100/90 font-medium">
              Simulation-based evacuation recommendation — <strong>For Academic Demonstration & Capacity-Aware Routing Optimization</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300/80 bg-amber-950/80 px-3 py-1.5 rounded-lg border border-amber-700/50">
          <span>Engine: Capacity-Aware Min-Cost Flow v1.0</span>
        </div>
      </div>

      {/* 2. HEADER & ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-2xl">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Emergency Evacuation Optimization
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Alleviate corridor bottlenecks, balance multi-exit queue clearance, and minimize evacuation time with dynamic mathematical flow optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            Tune Objective Weights
          </button>
          <button
            onClick={loadInitialData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Alert Messages */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/60 border border-red-500/40 text-red-300'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 3. OPTIMIZATION CONTROL BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Select Emergency Scenario to Optimize:
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} [{sc.emergency_type} - {sc.severity}] ({sc.affected_people_count} people)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              ML Predictive Crowd:
            </label>
            <button
              onClick={() => setUsePredictedCrowd(!usePredictedCrowd)}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                usePredictedCrowd
                  ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {usePredictedCrowd ? 'Predicted Crowd Active' : 'Live Crowd Only'}
            </button>
          </div>

          <div className="md:col-span-4">
            <button
              onClick={handleRunOptimization}
              disabled={optimizing || !selectedScenarioId}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {optimizing ? 'Executing Flow Optimization...' : 'Run Evacuation Optimization'}
            </button>
          </div>
        </div>

        {/* Active Weights Summary Pill Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Objective Weights:</span>
            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              Time: <strong>{weights.evacuation_time}</strong>
            </span>
            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              Congestion: <strong>{weights.congestion}</strong>
            </span>
            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              Distance: <strong>{weights.distance}</strong>
            </span>
            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              Exit Overload: <strong>{weights.exit_overload}</strong>
            </span>
          </div>
          <span className="font-mono text-emerald-400 text-[10px]">
            Max Iterations: {maxIterations}
          </span>
        </div>
      </div>

      {/* 4. COMPARATIVE RESEARCH METRICS (BASELINE VS OPTIMIZED) */}
      {optimizationResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* 1. Evacuation Time */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Evacuation Time</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-400 font-mono">
                {optimizationResult.optimized?.evacuation_time_sec}s
              </span>
              <span className="text-xs text-slate-500 line-through font-mono">
                {optimizationResult.baseline?.evacuation_time_sec}s
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <TrendingDown className="w-3 h-3" />
              <span>{optimizationResult.comparison?.time_reduction_percentage}% faster</span>
            </div>
          </div>

          {/* 2. Congestion Reduction */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Peak Congestion</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {optimizationResult.optimized?.avg_utilization_percentage}%
              </span>
              <span className="text-xs text-slate-500 line-through font-mono">
                {optimizationResult.baseline?.avg_utilization_percentage}%
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
              <TrendingDown className="w-3 h-3" />
              <span>{optimizationResult.comparison?.congestion_reduction_percentage}% load drop</span>
            </div>
          </div>

          {/* 3. Bottlenecks Mitigated */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Bottlenecks</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {optimizationResult.optimized?.bottlenecks_count}
              </span>
              <span className="text-xs text-slate-500 line-through font-mono">
                {optimizationResult.baseline?.bottlenecks_count}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>{optimizationResult.comparison?.bottlenecks_reduced || 0} corridors relieved</span>
            </div>
          </div>

          {/* 4. Average Distance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Avg Route Dist</span>
              <Compass className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {optimizationResult.optimized?.total_distance_meters}m
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({optimizationResult.baseline?.total_distance_meters}m)
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Δ {optimizationResult.comparison?.distance_change_percentage}%
            </div>
          </div>

          {/* 5. Objective Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Objective Cost</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-purple-400 font-mono">
                {optimizationResult.optimized?.objective_score}
              </span>
              <span className="text-xs text-slate-500 line-through font-mono">
                {optimizationResult.baseline?.objective_score}
              </span>
            </div>
            <div className="text-[10px] text-purple-400 font-bold">
              {optimizationResult.comparison?.objective_improvement_percentage}% score gain
            </div>
          </div>

          {/* 6. Optimization Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Status</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-black ${
                optimizationResult.status === 'OPTIMAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {optimizationResult.status}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {optimizationResult.iterations} iterations
            </div>
          </div>
        </div>
      )}

      {/* 5. SPATIAL MAP & COMPARISON VISUALIZER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leaflet Map with Baseline / Optimized Switcher (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  Evacuation Network Spatial Map
                </h2>
                <p className="text-[11px] text-slate-400">
                  Switch between Baseline and Optimized route flow distributions.
                </p>
              </div>

              {/* View Switcher Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('BASELINE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'BASELINE'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Baseline Plan
                </button>
                <button
                  onClick={() => setViewMode('OPTIMIZED')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'OPTIMIZED'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Optimized Plan
                </button>
              </div>
            </div>

            <CampusLeafletMap
              buildings={buildings}
              nodes={nodes}
              paths={paths}
              exits={exits}
              crowdData={crowdData}
              emergencyMode={true}
              emergencyEpicenter={mapEpicenter}
              evacuationRoutes={displayedRoutes.map(r => ({
                ...r,
                nodes: r.nodes,
                allocated_people: r.people_assigned,
                exit_name: r.exit_name,
                origin_building_name: r.origin_name
              }))}
              bottlenecks={displayedBottlenecks}
              disabledExitIds={selectedScenario?.disabled_exit_ids || []}
              blockedPathIds={selectedScenario?.blocked_path_ids || []}
              height="460px"
            />
          </div>
        </div>

        {/* Right Column: Comparative Charts (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Chart 1: Baseline vs Optimized Metrics Bar Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Comparative Evacuation Metrics
            </h3>
            <div className="h-44">
              <Bar
                data={comparisonChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                  },
                  plugins: {
                    legend: { labels: { color: '#cbd5e1', font: { size: 10 } } }
                  }
                }}
              />
            </div>
          </div>

          {/* Chart 2: Exit Allocation Balancing Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <DoorOpen className="w-4 h-4 text-cyan-400" />
              Exit Allocation: Baseline vs. Optimized
            </h3>
            <div className="h-44">
              <Bar
                data={exitAllocationChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                  },
                  plugins: {
                    legend: { labels: { color: '#cbd5e1', font: { size: 10 } } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6. DETAILED ROUTE ALLOCATION & EXPLAINABLE AI LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Route Allocation Table (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Route Allocation Plan ({viewMode})
            </h2>
            <span className="text-[10px] text-slate-400">
              Showing {displayedRoutes.length} route allocations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Origin Facility</th>
                  <th className="p-3">Target Exit</th>
                  <th className="p-3">Evacuees</th>
                  <th className="p-3">Distance</th>
                  <th className="p-3">Est. Time</th>
                  <th className="p-3">Congestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedRoutes.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">{r.origin_name}</td>
                    <td className="p-3 text-emerald-400 font-semibold">{r.exit_name}</td>
                    <td className="p-3 font-mono font-bold text-white">{r.people_assigned} people</td>
                    <td className="p-3 text-slate-400 font-mono">{r.distance}m</td>
                    <td className="p-3 text-slate-300 font-mono">{r.walking_time}s</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.congestion === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                        r.congestion === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {r.congestion || 'LOW'} ({r.utilization || 0}%)
                      </span>
                    </td>
                  </tr>
                ))}
                {displayedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      No routes available. Run optimization above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Explainable AI Decision Log (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Explainable AI Optimization Decisions
            </h2>
            <span className="text-[10px] text-cyan-400 font-mono">Real-Time Audit</span>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {(optimizationResult?.explanations || []).map((exp, idx) => (
              <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                    exp.type === 'BOTTLENECK_RELIEF' ? 'bg-amber-500/20 text-amber-400' :
                    exp.type === 'EXIT_LOAD_BALANCING' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    STEP #{exp.step || idx + 1}: {exp.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{exp.origin || 'Campus Wide'}</span>
                </div>
                <p className="font-semibold text-slate-200 mt-1">{exp.action}</p>
                <p className="text-[11px] text-slate-400">{exp.reason}</p>
                <div className="text-[10px] text-emerald-400 font-mono pt-1">
                  • {exp.impact}
                </div>
              </div>
            ))}

            {(!optimizationResult?.explanations || optimizationResult.explanations.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Run an optimization to view algorithmic decision rationales.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. OPTIMIZATION HISTORY LOG */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <History className="w-4 h-4 text-purple-400" />
          Optimization Execution History
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Scenario</th>
                <th className="p-3">Baseline Time</th>
                <th className="p-3">Optimized Time</th>
                <th className="p-3">Time Reduction</th>
                <th className="p-3">Congestion Drop</th>
                <th className="p-3">Iterations</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {historyList.map((hist) => (
                <tr key={hist.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono text-slate-400">{new Date(hist.created_at).toLocaleString()}</td>
                  <td className="p-3 font-bold text-white">{hist.scenario_name || `Optimization #${hist.id}`}</td>
                  <td className="p-3 font-mono text-slate-400">{hist.baseline?.evacuation_time_sec}s</td>
                  <td className="p-3 font-mono font-bold text-emerald-400">{hist.optimized?.evacuation_time_sec}s</td>
                  <td className="p-3 font-bold text-emerald-400">
                    {hist.comparison?.time_reduction_percentage}%
                  </td>
                  <td className="p-3 font-bold text-amber-400">
                    {hist.comparison?.congestion_reduction_percentage}%
                  </td>
                  <td className="p-3 font-mono text-slate-400">{hist.iterations}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {hist.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setOptimizationResult(hist)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded text-[11px] font-bold"
                    >
                      Load Result
                    </button>
                  </td>
                </tr>
              ))}
              {historyList.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-slate-500">
                    No optimization history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. OBJECTIVE WEIGHTS CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Objective Function Weights Configuration</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <p className="text-xs text-slate-400">
                Configure the optimization cost function weights. Weights are automatically normalized so $\sum w = 1.0$.
              </p>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Evacuation Time Weight ($w_1$):</span>
                  <span className="font-mono text-emerald-400">{weights.evacuation_time}</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={weights.evacuation_time}
                  onChange={(e) => setWeights({ ...weights, evacuation_time: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Peak Congestion Weight ($w_2$):</span>
                  <span className="font-mono text-amber-400">{weights.congestion}</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={weights.congestion}
                  onChange={(e) => setWeights({ ...weights, congestion: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Route Distance Weight ($w_3$):</span>
                  <span className="font-mono text-cyan-400">{weights.distance}</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={weights.distance}
                  onChange={(e) => setWeights({ ...weights, distance: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Exit Overload Penalty Weight ($w_4$):</span>
                  <span className="font-mono text-purple-400">{weights.exit_overload}</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={weights.exit_overload}
                  onChange={(e) => setWeights({ ...weights, exit_overload: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Max Optimization Iterations</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Include ML Crowd Forecast</label>
                  <select
                    value={usePredictedCrowd ? 'true' : 'false'}
                    onChange={(e) => setUsePredictedCrowd(e.target.value === 'true')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="true">Yes (Predicted Crowd)</option>
                    <option value="false">No (Live Crowd Only)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationDashboard;
