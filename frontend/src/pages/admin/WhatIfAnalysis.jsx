import React, { useState, useEffect } from 'react';
import { whatIfService } from '../../services/whatIfService';
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
import { Bar, Radar } from 'react-chartjs-2';
import {
  HelpCircle,
  Play,
  RotateCcw,
  AlertTriangle,
  Clock,
  Activity,
  Compass,
  Users,
  ShieldCheck,
  DoorOpen,
  ArrowRight,
  Sparkles,
  Layers,
  History,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Zap,
  Sliders,
  Maximize2,
  FileSpreadsheet,
  RefreshCw,
  Ban,
  Building2,
  Plus
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

const WhatIfAnalysis = () => {
  // Data States
  const [scenarios, setScenarios] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [exits, setExits] = useState([]);
  const [crowdData, setCrowdData] = useState([]);

  // Active Scenario Builder State
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [selectedBaseScenarioId, setSelectedBaseScenarioId] = useState('');
  const [scenarioType, setScenarioType] = useState('EXIT_BLOCKED');
  const [blockedExitIds, setBlockedExitIds] = useState([]);
  const [blockedPathIds, setBlockedPathIds] = useState([]);
  const [targetLocationId, setTargetLocationId] = useState('');
  const [crowdPercentage, setCrowdPercentage] = useState(30);
  const [crowdCountOverride, setCrowdCountOverride] = useState(700);

  // Active Results State
  const [activeResult, setActiveResult] = useState(null);
  const [viewMode, setViewMode] = useState('WHAT_IF_OPTIMIZED'); // 'BASELINE' | 'WHAT_IF_SIM' | 'WHAT_IF_OPTIMIZED'
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Multi-Scenario Comparison Modal State
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [comparisonMatrix, setComparisonMatrix] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [scenariosRes, buildingsRes, nodesRes, pathsRes, exitsRes, crowdRes, whatIfHistoryRes] =
        await Promise.all([
          emergencyService.getScenarios(),
          campusService.getBuildings(),
          campusService.getNodes(),
          campusService.getPaths(),
          campusService.getExits(),
          crowdService.getCurrentCrowd(),
          whatIfService.getScenarios({ limit: 25 })
        ]);

      const scList = scenariosRes.data || [];
      const bList = buildingsRes.data || [];
      const eList = exitsRes.data || [];
      const pList = pathsRes.data || [];
      const histList = whatIfHistoryRes.data || [];

      setScenarios(scList);
      setBuildings(bList);
      setNodes(nodesRes.data || []);
      setPaths(pList);
      setExits(eList);
      setCrowdData(crowdRes.data || []);
      setHistoryList(histList);

      if (scList.length > 0) {
        setSelectedBaseScenarioId(scList[0].id);
      }

      if (bList.length > 0) {
        setTargetLocationId(bList[0].id);
      }

      // Default name
      setScenarioName('Hypothetical Exit 1 Closure');

      if (histList.length > 0) {
        setActiveResult(histList[0]);
      }
    } catch (err) {
      console.error('Failed to load What-If analysis data:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load initial data.' });
    } finally {
      setLoading(false);
    }
  };

  // Scenario Type Change Handler
  const handleScenarioTypeChange = (type) => {
    setScenarioType(type);
    if (type === 'EXIT_BLOCKED') {
      setScenarioName(exits.length > 0 ? `Hypothetical ${exits[0].name} Closure` : 'Hypothetical Exit Closure');
      setBlockedExitIds(exits.length > 0 ? [exits[0].id] : []);
      setBlockedPathIds([]);
    } else if (type === 'PATH_BLOCKED') {
      setScenarioName(paths.length > 0 ? `Hypothetical Corridor #${paths[0].id} Blockage` : 'Hypothetical Path Blockage');
      setBlockedExitIds([]);
      setBlockedPathIds(paths.length > 0 ? [paths[0].id] : []);
    } else if (type === 'CROWD_INCREASE') {
      const loc = buildings.find(b => b.id === Number(targetLocationId)) || buildings[0];
      setScenarioName(`Crowd Surge (+30%) at ${loc?.name || 'Campus Complex'}`);
      setBlockedExitIds([]);
      setBlockedPathIds([]);
      setCrowdPercentage(30);
    } else if (type === 'CROWD_DECREASE') {
      const loc = buildings.find(b => b.id === Number(targetLocationId)) || buildings[0];
      setScenarioName(`Crowd Reduction (-20%) at ${loc?.name || 'Campus Complex'}`);
      setBlockedExitIds([]);
      setBlockedPathIds([]);
      setCrowdPercentage(20);
    } else if (type === 'CROWD_OVERRIDE') {
      const loc = buildings.find(b => b.id === Number(targetLocationId)) || buildings[0];
      setScenarioName(`High Density Crowd Override at ${loc?.name || 'Campus Complex'}`);
      setBlockedExitIds([]);
      setBlockedPathIds([]);
      setCrowdCountOverride(800);
    } else if (type === 'PEAK_HOUR') {
      setScenarioName('Campus Wide Peak Hour Evacuation (+45% Load)');
      setBlockedExitIds([]);
      setBlockedPathIds([]);
    } else if (type === 'MULTIPLE_FAILURES') {
      setScenarioName('Compound Disaster: Exit 1 Blocked + Main Path Blocked + Crowd Surge');
      setBlockedExitIds(exits.length > 0 ? [exits[0].id] : []);
      setBlockedPathIds(paths.length > 0 ? [paths[0].id] : []);
      setCrowdPercentage(25);
    }
  };

  // Toggle Exit Checkbox
  const toggleExitBlock = (exitId) => {
    if (blockedExitIds.includes(exitId)) {
      setBlockedExitIds(blockedExitIds.filter(id => id !== exitId));
    } else {
      setBlockedExitIds([...blockedExitIds, exitId]);
    }
  };

  // Toggle Path Checkbox
  const togglePathBlock = (pathId) => {
    if (blockedPathIds.includes(pathId)) {
      setBlockedPathIds(blockedPathIds.filter(id => id !== pathId));
    } else {
      setBlockedPathIds([...blockedPathIds, pathId]);
    }
  };

  // Execute What-If Simulation
  const handleRunWhatIfSimulation = async () => {
    try {
      setRunning(true);
      setStatusMessage(null);

      const payload = {
        name: scenarioName || `What-If ${scenarioType}`,
        description: scenarioDescription,
        base_scenario_id: selectedBaseScenarioId ? Number(selectedBaseScenarioId) : undefined,
        scenario_type: scenarioType,
        blocked_exit_ids: blockedExitIds,
        blocked_path_ids: blockedPathIds,
        location_id: targetLocationId ? Number(targetLocationId) : undefined,
        percentage: Number(crowdPercentage),
        crowd_count: Number(crowdCountOverride)
      };

      const res = await whatIfService.quickRun(payload);

      if (res.success && res.data) {
        setActiveResult(res.data);
        setStatusMessage({ type: 'success', text: res.message });

        // Refresh History
        const hist = await whatIfService.getScenarios({ limit: 25 });
        setHistoryList(hist.data || []);
      }
    } catch (err) {
      console.error('What-If simulation error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to execute What-If simulation.'
      });
    } finally {
      setRunning(false);
    }
  };

  // Delete History Scenario
  const handleDeleteScenario = async (id, e) => {
    e.stopPropagation();
    try {
      await whatIfService.deleteScenario(id);
      setHistoryList(historyList.filter(h => h.id !== id));
      if (activeResult?.id === id) {
        setActiveResult(null);
      }
      setStatusMessage({ type: 'success', text: 'What-If scenario removed.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete scenario.' });
    }
  };

  // Run Multi-Scenario Comparison
  const handleCompareScenarios = async () => {
    if (selectedCompareIds.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one scenario to compare.' });
      return;
    }
    try {
      setComparing(true);
      const res = await whatIfService.compareScenarios(selectedCompareIds);
      if (res.success) {
        setComparisonMatrix(res.data);
        setShowCompareModal(true);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to generate comparison matrix.' });
    } finally {
      setComparing(false);
    }
  };

  const selectedBaseScenario = scenarios.find(s => s.id === Number(selectedBaseScenarioId));

  // Spatial Map Epicenter
  const mapEpicenter = selectedBaseScenario ? {
    latitude: selectedBaseScenario.location_latitude,
    longitude: selectedBaseScenario.location_longitude,
    building_id: selectedBaseScenario.emergency_location_id,
    radius: 100,
    type: selectedBaseScenario.emergency_type,
    label: selectedBaseScenario.name
  } : null;

  // Active Map Overlay Data based on viewMode
  const displayedRoutes = activeResult
    ? (viewMode === 'BASELINE'
        ? activeResult.baseline_metrics?.routes
        : (viewMode === 'WHAT_IF_SIM'
            ? activeResult.simulation_result?.results
            : activeResult.scenario_metrics?.routes)) || []
    : [];

  const displayedBottlenecks = activeResult
    ? (viewMode === 'BASELINE'
        ? activeResult.baseline_metrics?.bottlenecks
        : activeResult.scenario_metrics?.bottlenecks) || []
    : [];

  const effectiveDisabledExits = [
    ...(selectedBaseScenario?.disabled_exit_ids || []),
    ...(viewMode !== 'BASELINE' ? (activeResult?.parameters?.blocked_exit_ids || blockedExitIds) : [])
  ];

  const effectiveBlockedPaths = [
    ...(selectedBaseScenario?.blocked_path_ids || []),
    ...(viewMode !== 'BASELINE' ? (activeResult?.parameters?.blocked_path_ids || blockedPathIds) : [])
  ];

  // Chart Data: Baseline vs What-If Metrics Bar Chart
  const comparisonBarChartData = {
    labels: ['Evac Time (s)', 'Congestion (%)', 'Avg Dist (10m)', 'Bottlenecks', 'Unassigned (p)'],
    datasets: [
      {
        label: 'Baseline Plan',
        data: activeResult ? [
          activeResult.baseline_metrics?.evacuation_time_sec || 0,
          activeResult.baseline_metrics?.avg_utilization_percentage || 0,
          (activeResult.baseline_metrics?.total_distance_meters || 0) / 10,
          activeResult.baseline_metrics?.bottlenecks_count || 0,
          activeResult.baseline_metrics?.unassigned_people || 0
        ] : [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6
      },
      {
        label: `What-If: ${activeResult?.scenario_type || 'Scenario'}`,
        data: activeResult ? [
          activeResult.scenario_metrics?.evacuation_time_sec || 0,
          activeResult.scenario_metrics?.avg_utilization_percentage || 0,
          (activeResult.scenario_metrics?.total_distance_meters || 0) / 10,
          activeResult.scenario_metrics?.bottlenecks_count || 0,
          activeResult.scenario_metrics?.unassigned_people || 0
        ] : [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 6
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. ACADEMIC & COMPARATIVE RESEARCH DISCLAIMER */}
      <div className="bg-purple-950/40 border border-purple-500/50 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/40">
            <HelpCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-widest block">
              Academic & Contingency Simulation Notice
            </span>
            <p className="text-xs text-purple-100/90 font-medium">
              Simulation-based evacuation recommendation — <strong>For Academic Demonstration & What-If Scenario Analysis</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-purple-300/80 bg-purple-950/80 px-3 py-1.5 rounded-lg border border-purple-700/50">
          <span>Engine: Isolated In-Memory What-If v1.0</span>
        </div>
      </div>

      {/* 2. HEADER & ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/20 border border-purple-500/40 text-purple-400 rounded-2xl">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                What-If Scenario Analysis
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Simulate hypothetical campus conditions (blocked gates, arterial closures, population surges) without altering baseline database topology.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleCompareScenarios}
            disabled={comparing || selectedCompareIds.length === 0}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            Compare Selected ({selectedCompareIds.length})
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

      {/* Status Messages */}
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

      {/* 3. SCENARIO BUILDER CONSOLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            Interactive Scenario Builder
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            Answers: "What would happen if this condition changed?"
          </span>
        </div>

        {/* Row 1: Scenario Type Pills */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2">
            1. Select Hypothetical Condition Type:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { type: 'EXIT_BLOCKED', label: 'Exit Blocked', icon: DoorOpen },
              { type: 'PATH_BLOCKED', label: 'Path Blocked', icon: Ban },
              { type: 'CROWD_INCREASE', label: 'Crowd Surge (+%)', icon: TrendingUp },
              { type: 'CROWD_DECREASE', label: 'Crowd Drop (-%)', icon: TrendingDown },
              { type: 'CROWD_OVERRIDE', label: 'Crowd Override', icon: Users },
              { type: 'PEAK_HOUR', label: 'Peak Hour', icon: Clock },
              { type: 'MULTIPLE_FAILURES', label: 'Compound Failure', icon: AlertTriangle }
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleScenarioTypeChange(type)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                  scenarioType === type
                    ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${scenarioType === type ? 'text-white' : 'text-purple-400'}`} />
                <span className="text-[11px] font-bold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Base Scenario & Scenario Name */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Base Emergency Context:
            </label>
            <select
              value={selectedBaseScenarioId}
              onChange={(e) => setSelectedBaseScenarioId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} [{sc.emergency_type}] ({sc.affected_people_count} p)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Scenario Name:
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g. Exit 1 Blocked during Chemical Fire"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Description (Optional):
            </label>
            <input
              type="text"
              value={scenarioDescription}
              onChange={(e) => setScenarioDescription(e.target.value)}
              placeholder="Hypothetical evaluation rationale"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Row 3: Dynamic Parameters per Scenario Type */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          {/* Dynamic Section: EXIT_BLOCKED or MULTIPLE_FAILURES */}
          {(scenarioType === 'EXIT_BLOCKED' || scenarioType === 'MULTIPLE_FAILURES') && (
            <div>
              <span className="block text-xs font-bold text-purple-400 mb-2 flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5" />
                Select Emergency Exits to Block (Hypothetically Disabled):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {exits.map((e) => {
                  const isBlocked = blockedExitIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleExitBlock(e.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                        isBlocked
                          ? 'bg-red-950/60 border-red-500 text-red-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{e.name}</div>
                        <div className="text-[10px] text-slate-400">Cap: {e.capacity} p/min</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        isBlocked ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isBlocked ? 'BLOCKED' : 'OPEN'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Section: PATH_BLOCKED or MULTIPLE_FAILURES */}
          {(scenarioType === 'PATH_BLOCKED' || scenarioType === 'MULTIPLE_FAILURES') && (
            <div>
              <span className="block text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                Select Campus Corridors to Block:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                {paths.map((p) => {
                  const isBlocked = blockedPathIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePathBlock(p.id)}
                      className={`p-2 rounded-lg border text-left text-xs flex items-center justify-between transition-colors ${
                        isBlocked
                          ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate pr-1">
                        Corridor #{p.id} ({p.source_node?.name?.slice(0, 10)} ↔ {p.destination_node?.name?.slice(0, 10)})
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                        isBlocked ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {isBlocked ? 'CLOSED' : 'OPEN'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Section: CROWD_INCREASE, CROWD_DECREASE, CROWD_OVERRIDE */}
          {(scenarioType === 'CROWD_INCREASE' || scenarioType === 'CROWD_DECREASE' || scenarioType === 'CROWD_OVERRIDE') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-cyan-400 mb-1.5">
                  Target Campus Facility:
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} [{b.building_type}] (Capacity: {b.capacity})
                    </option>
                  ))}
                </select>
              </div>

              {scenarioType === 'CROWD_OVERRIDE' ? (
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-1.5">
                    Override Crowd Population Count:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    value={crowdCountOverride}
                    onChange={(e) => setCrowdCountOverride(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-xs font-bold text-cyan-400 mb-1.5">
                    <span>Population Shift Percentage:</span>
                    <span className="font-mono text-white">
                      {scenarioType === 'CROWD_INCREASE' ? `+${crowdPercentage}%` : `-${crowdPercentage}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[10, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setCrowdPercentage(pct)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                          crowdPercentage === pct
                            ? 'bg-cyan-600 text-white border-cyan-400'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {scenarioType === 'CROWD_INCREASE' ? `+${pct}%` : `-${pct}%`}
                      </button>
                    ))}
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={crowdPercentage}
                      onChange={(e) => setCrowdPercentage(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Section: PEAK_HOUR */}
          {scenarioType === 'PEAK_HOUR' && (
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-bold text-emerald-400">Peak Hour Load Model:</span>
              <p className="text-slate-400">
                Simulates peak academic class exchange traffic with an automated +45% pedestrian surge on Lecture Blocks and Libraries, and +25% general perimeter influx.
              </p>
            </div>
          )}
        </div>

        {/* Action Button: Run What-If Simulation */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleRunWhatIfSimulation}
            disabled={running}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {running ? 'Executing What-If Discrete Simulation...' : 'Run What-If Simulation & Optimization'}
          </button>
        </div>
      </div>

      {/* 4. BASELINE VS WHAT-IF KPI RESEARCH COMPARISON CARDS */}
      {activeResult && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* KPI 1: Evacuation Clearance Time */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Evacuation Time</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {activeResult.scenario_metrics?.evacuation_time_sec}s
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Base: {activeResult.baseline_metrics?.evacuation_time_sec}s)
              </span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${
              activeResult.comparison?.time_difference_sec > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeResult.comparison?.time_difference_sec > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {activeResult.comparison?.time_difference_sec > 0 ? `+${activeResult.comparison?.time_difference_sec}s` : `${activeResult.comparison?.time_difference_sec}s`} ({activeResult.comparison?.time_change_percentage}%)
              </span>
            </div>
          </div>

          {/* KPI 2: Network Congestion */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Avg Congestion</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {activeResult.scenario_metrics?.avg_utilization_percentage}%
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Base: {activeResult.baseline_metrics?.avg_utilization_percentage}%)
              </span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${
              activeResult.comparison?.congestion_difference_percentage > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeResult.comparison?.congestion_difference_percentage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                Δ {activeResult.comparison?.congestion_difference_percentage}% ({activeResult.comparison?.congestion_change_percentage}%)
              </span>
            </div>
          </div>

          {/* KPI 3: Average Egress Distance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Avg Egress Dist</span>
              <Compass className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {activeResult.scenario_metrics?.total_distance_meters}m
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Base: {activeResult.baseline_metrics?.total_distance_meters}m)
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Δ {activeResult.comparison?.distance_difference_meters}m ({activeResult.comparison?.distance_change_percentage}%)
            </div>
          </div>

          {/* KPI 4: Bottlenecks Formed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Bottlenecks</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {activeResult.scenario_metrics?.bottlenecks_count}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Base: {activeResult.baseline_metrics?.bottlenecks_count})
              </span>
            </div>
            <div className="text-[10px] text-amber-400 font-mono">
              Δ {activeResult.comparison?.bottlenecks_difference > 0 ? `+${activeResult.comparison?.bottlenecks_difference}` : activeResult.comparison?.bottlenecks_difference} points
            </div>
          </div>

          {/* KPI 5: Evacuated vs Unassigned */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Unassigned Pop.</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {activeResult.scenario_metrics?.unassigned_people}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Base: {activeResult.baseline_metrics?.unassigned_people})
              </span>
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">
              {activeResult.scenario_metrics?.unassigned_people === 0 ? '100% Evacuated' : `${activeResult.scenario_metrics?.unassigned_people} stranded`}
            </div>
          </div>

          {/* KPI 6: Objective Cost Impact */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Objective Score</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-purple-400 font-mono">
                {activeResult.scenario_metrics?.objective_score}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({activeResult.baseline_metrics?.objective_score})
              </span>
            </div>
            <div className="text-[10px] text-purple-300 font-mono">
              Δ {activeResult.comparison?.objective_score_difference} ({activeResult.comparison?.objective_score_change_percentage}%)
            </div>
          </div>
        </div>
      )}

      {/* 5. SPATIAL MAP & COMPARATIVE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leaflet Map with Baseline vs What-If Mode Toggle (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  What-If Isolated Network Spatial Map
                </h2>
                <p className="text-[11px] text-slate-400">
                  Visualizes dynamic route rerouting, blocked points, and bottleneck redistribution.
                </p>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('BASELINE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'BASELINE'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Baseline Plan
                </button>
                <button
                  onClick={() => setViewMode('WHAT_IF_OPTIMIZED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'WHAT_IF_OPTIMIZED'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  What-If Optimized
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
                allocated_people: r.people_assigned || r.allocated_people || r.evacuees_count,
                exit_name: r.exit_name,
                origin_building_name: r.origin_name || r.origin_building_name
              }))}
              bottlenecks={displayedBottlenecks}
              disabledExitIds={effectiveDisabledExits}
              blockedPathIds={effectiveBlockedPaths}
              height="460px"
            />
          </div>
        </div>

        {/* Right Column: Comparative Charts & Metric Table (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Chart: Baseline vs What-If Metrics Bar Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Comparative Metrics Overview
            </h3>
            <div className="h-44">
              <Bar
                data={comparisonBarChartData}
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

          {/* Baseline vs What-If Detailed Difference Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              Direct Metric Delta Evaluation
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-1.5">Metric</th>
                    <th className="pb-1.5">Baseline</th>
                    <th className="pb-1.5">Scenario</th>
                    <th className="pb-1.5">Δ Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  <tr>
                    <td className="py-2 text-slate-300 font-sans font-semibold">Evacuation Time</td>
                    <td className="py-2 text-slate-400">{activeResult?.baseline_metrics?.evacuation_time_sec}s</td>
                    <td className="py-2 text-white font-bold">{activeResult?.scenario_metrics?.evacuation_time_sec}s</td>
                    <td className={`py-2 font-bold ${activeResult?.comparison?.time_difference_sec > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {activeResult?.comparison?.time_change_percentage}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-sans font-semibold">Corridor Load</td>
                    <td className="py-2 text-slate-400">{activeResult?.baseline_metrics?.avg_utilization_percentage}%</td>
                    <td className="py-2 text-white font-bold">{activeResult?.scenario_metrics?.avg_utilization_percentage}%</td>
                    <td className={`py-2 font-bold ${activeResult?.comparison?.congestion_difference_percentage > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      Δ {activeResult?.comparison?.congestion_difference_percentage}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-sans font-semibold">Avg Distance</td>
                    <td className="py-2 text-slate-400">{activeResult?.baseline_metrics?.total_distance_meters}m</td>
                    <td className="py-2 text-white font-bold">{activeResult?.scenario_metrics?.total_distance_meters}m</td>
                    <td className="py-2 text-slate-400">Δ {activeResult?.comparison?.distance_difference_meters}m</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-sans font-semibold">Bottleneck Points</td>
                    <td className="py-2 text-slate-400">{activeResult?.baseline_metrics?.bottlenecks_count}</td>
                    <td className="py-2 text-white font-bold">{activeResult?.scenario_metrics?.bottlenecks_count}</td>
                    <td className="py-2 text-amber-400">Δ {activeResult?.comparison?.bottlenecks_difference}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-sans font-semibold">Unassigned</td>
                    <td className="py-2 text-slate-400">{activeResult?.baseline_metrics?.unassigned_people}</td>
                    <td className="py-2 text-white font-bold">{activeResult?.scenario_metrics?.unassigned_people}</td>
                    <td className="py-2 text-emerald-400">Δ {activeResult?.comparison?.unassigned_difference}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 6. EXPLAINABLE AI SHIFT ANALYSIS */}
      {activeResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Explainable AI What-If Impact Rationale
            </h2>
            <span className="text-[10px] text-purple-400 font-mono">Algorithmic Shift Audit</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(activeResult.explanations || []).map((exp, idx) => (
              <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                    exp.category === 'EXIT_DIVERSION' ? 'bg-blue-500/20 text-blue-400' :
                    exp.category === 'PATH_CLOSURE' ? 'bg-amber-500/20 text-amber-400' :
                    exp.category === 'POPULATION_SURGE' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    STEP #{exp.step || idx + 1}: {exp.category}
                  </span>
                </div>
                <p className="font-bold text-slate-200">{exp.finding}</p>
                <p className="text-[11px] text-slate-400">{exp.mechanism}</p>
                <div className="text-[10px] text-purple-300 font-mono pt-1">
                  • {exp.quantified_impact}
                </div>
              </div>
            ))}
            {(!activeResult.explanations || activeResult.explanations.length === 0) && (
              <div className="col-span-2 text-center py-6 text-slate-500 text-xs">
                No shift explanations recorded for this run.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. WHAT-IF EXECUTION HISTORY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            What-If Scenario Execution History
          </h2>
          <span className="text-[10px] text-slate-400">
            {historyList.length} scenarios stored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Select</th>
                <th className="p-3">Scenario Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Base Emergency</th>
                <th className="p-3">Evac Time</th>
                <th className="p-3">Time Change (Δ%)</th>
                <th className="p-3">Congestion (Δ%)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {historyList.map((hist) => {
                const isSelectedForCompare = selectedCompareIds.includes(hist.id);
                return (
                  <tr
                    key={hist.id}
                    onClick={() => setActiveResult(hist)}
                    className={`cursor-pointer transition-colors ${
                      activeResult?.id === hist.id ? 'bg-purple-950/40' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelectedForCompare}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCompareIds([...selectedCompareIds, hist.id]);
                          } else {
                            setSelectedCompareIds(selectedCompareIds.filter(id => id !== hist.id));
                          }
                        }}
                        className="rounded accent-purple-500"
                      />
                    </td>
                    <td className="p-3 font-bold text-white">{hist.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-purple-300">
                        {hist.scenario_type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{hist.base_scenario_name || 'Campus Wide'}</td>
                    <td className="p-3 font-mono text-slate-300">{hist.scenario_metrics?.evacuation_time_sec}s</td>
                    <td className={`p-3 font-bold ${hist.comparison?.time_difference_sec > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {hist.comparison?.time_change_percentage}%
                    </td>
                    <td className="p-3 font-mono text-slate-400">{hist.comparison?.congestion_change_percentage}%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {hist.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveResult(hist)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded text-[11px] font-bold"
                      >
                        Load
                      </button>
                      <button
                        onClick={(e) => handleDeleteScenario(hist.id, e)}
                        className="p-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title="Delete Scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {historyList.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    No What-If scenarios executed yet. Build and run a hypothetical scenario above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. MULTI-SCENARIO COMPARISON MODAL */}
      {showCompareModal && comparisonMatrix && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Multi-Scenario Comparative Research Matrix</h3>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Scenario</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Evac Time (s)</th>
                    <th className="p-3">Time Shift (Δ%)</th>
                    <th className="p-3">Peak Congestion</th>
                    <th className="p-3">Avg Dist</th>
                    <th className="p-3">Bottlenecks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {comparisonMatrix.comparison_matrix.map((row, idx) => (
                    <tr key={idx} className={row.id === 'baseline' ? 'bg-blue-950/30 font-bold' : 'hover:bg-slate-800/40'}>
                      <td className="p-3 font-sans text-white">{row.name}</td>
                      <td className="p-3 text-purple-300">{row.scenario_type}</td>
                      <td className="p-3 text-white">{row.evacuation_time_sec}s</td>
                      <td className={`p-3 font-bold ${row.time_change_percentage > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {row.time_change_percentage > 0 ? `+${row.time_change_percentage}%` : `${row.time_change_percentage}%`}
                      </td>
                      <td className="p-3 text-slate-300">{row.avg_utilization_percentage}%</td>
                      <td className="p-3 text-slate-400">{row.total_distance_meters}m</td>
                      <td className="p-3 text-amber-400">{row.bottlenecks_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/25"
              >
                Close Comparison Matrix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatIfAnalysis;
