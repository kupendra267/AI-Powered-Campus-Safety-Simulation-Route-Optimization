import React, { useState, useEffect, useRef } from 'react';
import { emergencyService } from '../../services/emergencyService';
import { campusService } from '../../services/campusService';
import { crowdService } from '../../services/crowdService';
import CampusLeafletMap from '../../components/map/CampusLeafletMap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Users,
  Flame,
  DoorOpen,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Info,
  RefreshCw,
  Zap,
  Activity,
  ChevronRight,
  Sliders,
  Compass
} from 'lucide-react';

// Register Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EmergencyManagement = () => {
  // Data states
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [exits, setExits] = useState([]);
  const [crowdData, setCrowdData] = useState([]);

  // UI / Loading states
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [selectedWhatIfExit, setSelectedWhatIfExit] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Playback states
  const [playbackTime, setPlaybackTime] = useState(0); // in seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x
  const playbackIntervalRef = useRef(null);

  // Create Scenario Form state
  const [formData, setFormData] = useState({
    name: '',
    emergency_type: 'FIRE',
    severity: 'HIGH',
    description: '',
    epicenter_building_id: '',
    affected_radius_meters: 100,
    affected_people_count: '',
    blocked_path_ids: [],
    disabled_exit_ids: []
  });

  // Initial Data Load
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        scenariosRes,
        activeRes,
        buildingsRes,
        nodesRes,
        pathsRes,
        exitsRes,
        crowdRes,
        historyRes
      ] = await Promise.all([
        emergencyService.getScenarios(),
        emergencyService.getActiveEmergency(),
        campusService.getBuildings(),
        campusService.getNodes(),
        campusService.getPaths(),
        campusService.getExits(),
        crowdService.getCurrentCrowd(),
        emergencyService.getSimulationHistory(15)
      ]);

      setScenarios(scenariosRes.data || []);
      setActiveEmergency(activeRes.data || null);
      setBuildings(buildingsRes.data || []);
      setNodes(nodesRes.data || []);
      setPaths(pathsRes.data || []);
      setExits(exitsRes.data || []);
      setCrowdData(crowdRes.data || []);
      setSimulationHistory(historyRes.data || []);

      if (scenariosRes.data && scenariosRes.data.length > 0) {
        setSelectedScenario(scenariosRes.data[0]);
      }
    } catch (err) {
      console.error('Failed to load emergency data:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load emergency scenarios.' });
    } finally {
      setLoading(false);
    }
  };

  // Playback timer ticker
  useEffect(() => {
    if (isPlaying && simulationData?.results?.timeline_steps) {
      const maxTime = simulationData.results.estimated_evacuation_time_sec || 300;
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackTime(prev => {
          const next = prev + 5 * playbackSpeed;
          if (next >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return next;
        });
      }, 500);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, simulationData]);

  // Run Evacuation Simulation
  const handleRunSimulation = async (scenarioId = null) => {
    try {
      setSimulating(true);
      setStatusMessage(null);
      setWhatIfResult(null);

      const targetId = scenarioId || selectedScenario?.id;
      const response = await emergencyService.runSimulation({
        scenario_id: targetId
      });

      if (response.success && response.data) {
        setSimulationData(response.data);
        setPlaybackTime(0);
        setIsPlaying(true);
        setStatusMessage({ type: 'success', text: `Simulation executed: ${response.message}` });
        
        // Refresh history
        const hist = await emergencyService.getSimulationHistory(15);
        setSimulationHistory(hist.data || []);
      }
    } catch (err) {
      console.error('Simulation execution failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to execute evacuation simulation.'
      });
    } finally {
      setSimulating(false);
    }
  };

  // Start / Activate Emergency
  const handleStartEmergency = async (scenarioId) => {
    try {
      const res = await emergencyService.startEmergency(scenarioId);
      setStatusMessage({ type: 'success', text: `Emergency declared: ${res.message}` });
      loadAllData();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to start emergency.'
      });
    }
  };

  // Stop Emergency
  const handleStopEmergency = async (scenarioId) => {
    try {
      const res = await emergencyService.stopEmergency(scenarioId);
      setStatusMessage({ type: 'success', text: `Emergency stood down: ${res.message}` });
      loadAllData();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to stop emergency.'
      });
    }
  };

  // Delete Scenario
  const handleDeleteScenario = async (scenarioId) => {
    if (!window.confirm('Are you sure you want to delete this emergency scenario?')) return;
    try {
      await emergencyService.deleteScenario(scenarioId);
      setStatusMessage({ type: 'success', text: 'Scenario deleted successfully.' });
      loadAllData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete scenario.' });
    }
  };

  // Create Scenario Submission
  const handleCreateScenario = async (e) => {
    e.preventDefault();
    try {
      let epicLat = null;
      let epicLng = null;

      if (formData.epicenter_building_id) {
        const b = buildings.find(x => x.id === Number(formData.epicenter_building_id));
        if (b) {
          epicLat = parseFloat(b.latitude);
          epicLng = parseFloat(b.longitude);
        }
      }

      const payload = {
        name: formData.name,
        emergency_type: formData.emergency_type,
        severity: formData.severity,
        description: formData.description,
        epicenter_building_id: formData.epicenter_building_id ? Number(formData.epicenter_building_id) : null,
        epicenter_latitude: epicLat,
        epicenter_longitude: epicLng,
        affected_radius_meters: Number(formData.affected_radius_meters) || 100,
        affected_people_count: formData.affected_people_count ? Number(formData.affected_people_count) : null,
        blocked_path_ids: formData.blocked_path_ids.map(Number),
        disabled_exit_ids: formData.disabled_exit_ids.map(Number)
      };

      const res = await emergencyService.createScenario(payload);
      setShowCreateModal(false);
      setStatusMessage({ type: 'success', text: 'Emergency scenario created successfully.' });
      
      // Reset form
      setFormData({
        name: '',
        emergency_type: 'FIRE',
        severity: 'HIGH',
        description: '',
        epicenter_building_id: '',
        affected_radius_meters: 100,
        affected_people_count: '',
        blocked_path_ids: [],
        disabled_exit_ids: []
      });

      loadAllData();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create scenario.'
      });
    }
  };

  // What-If Block Exit Contingency Test
  const handleWhatIfBlockExit = async () => {
    if (!selectedWhatIfExit || !selectedScenario) return;
    try {
      setWhatIfLoading(true);
      const res = await emergencyService.whatIfBlockExit(selectedScenario.id, selectedWhatIfExit);
      setWhatIfResult(res.data || res);
      setStatusMessage({ type: 'success', text: 'What-If contingency test completed.' });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to run What-If test.'
      });
    } finally {
      setWhatIfLoading(false);
    }
  };

  // Current simulation snapshot at playback time
  const currentStep = (() => {
    if (!simulationData?.results?.timeline_steps) return null;
    const steps = simulationData.results.timeline_steps;
    // Find closest step <= playbackTime
    let best = steps[0];
    for (const s of steps) {
      if (s.time_sec <= playbackTime) {
        best = s;
      } else {
        break;
      }
    }
    return best;
  })();

  // Epicenter object for Leaflet Map
  const mapEpicenter = selectedScenario ? {
    latitude: selectedScenario.epicenter_latitude,
    longitude: selectedScenario.epicenter_longitude,
    building_id: selectedScenario.epicenter_building_id,
    radius: selectedScenario.affected_radius_meters || 100,
    type: selectedScenario.emergency_type,
    label: selectedScenario.name
  } : null;

  // Chart Data: Evacuation Timeline
  const timelineChartData = {
    labels: (simulationData?.results?.timeline_steps || []).map(s => `${s.time_sec}s`),
    datasets: [
      {
        label: 'Evacuees Remaining in Danger',
        data: (simulationData?.results?.timeline_steps || []).map(s => s.people_remaining),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5
      },
      {
        label: 'Successfully Evacuated',
        data: (simulationData?.results?.timeline_steps || []).map(s => s.people_evacuated),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5
      }
    ]
  };

  // Chart Data: Exit Throughput Utilization
  const exitUtilData = {
    labels: (simulationData?.exit_utilization || []).map(e => e.exit_name || `Exit #${e.exit_id}`),
    datasets: [
      {
        label: 'Evacuees Assigned (People)',
        data: (simulationData?.exit_utilization || []).map(e => e.assigned_evacuees || 0),
        backgroundColor: '#38bdf8',
        borderRadius: 6
      },
      {
        label: 'Exit Throughput Capacity (p/min)',
        data: (simulationData?.exit_utilization || []).map(e => e.capacity_per_min || 0),
        backgroundColor: '#64748b',
        borderRadius: 6
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
              Academic & Simulation Notice
            </span>
            <p className="text-xs text-amber-100/90 font-medium">
              Simulation-based evacuation recommendation — <strong>For Academic Demonstration and Campus Safety Planning</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300/80 bg-amber-950/80 px-3 py-1.5 rounded-lg border border-amber-700/50">
          <span>Simulation Engine: v2.4 (A* Multi-Exit Flow)</span>
        </div>
      </div>

      {/* 2. HEADER & ACTIVE EMERGENCY STATUS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-600/20 border border-red-500/40 text-red-400 rounded-2xl">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Emergency Evacuation Simulation
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Model emergency scenarios, compute multi-exit flow allocations, detect corridor bottlenecks, and execute contingency simulations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all hover:scale-102"
          >
            <Plus className="w-4 h-4" />
            Create Scenario
          </button>
          <button
            onClick={loadAllData}
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

      {/* 3. ACTIVE CAMPUS EMERGENCY ALERT BANNER */}
      {activeEmergency && (
        <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-red-950/80 border-2 border-red-500 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/50 animate-pulse">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-md font-black tracking-wider animate-bounce">
                  ACTIVE EMERGENCY
                </span>
                <span className="text-xs font-mono text-red-400 font-bold">
                  [{activeEmergency.emergency_type}] · Severity: {activeEmergency.severity}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{activeEmergency.name}</h2>
              <p className="text-xs text-slate-300">
                Epicenter: <strong>{activeEmergency.epicenter_building_name || 'Campus Center'}</strong> · Affected Radius: <strong>{activeEmergency.affected_radius_meters}m</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-end md:self-center">
            <button
              onClick={() => handleRunSimulation(activeEmergency.id)}
              disabled={simulating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
            >
              <Play className="w-3.5 h-3.5" />
              {simulating ? 'Simulating...' : 'Simulate Active Alert'}
            </button>
            <button
              onClick={() => handleStopEmergency(activeEmergency.id)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              Stand Down Alert
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: SCENARIOS LIST & MAP VISUALIZATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario Selector & Execution (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Scenario Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-400" />
                Emergency Scenarios ({scenarios.length})
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">Select to test</span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {scenarios.map((sc) => {
                const isSelected = selectedScenario?.id === sc.id;
                const isActive = sc.status === 'ACTIVE';

                return (
                  <div
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenario(sc);
                      setWhatIfResult(null);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-red-500/80 shadow-md shadow-red-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            sc.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            sc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {sc.emergency_type}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-xs text-white mt-1">{sc.name}</h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{sc.description || 'No description provided.'}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScenario(sc.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete scenario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Epicenter: <strong>{sc.epicenter_building_name || 'Central'}</strong></span>
                      <span>Radius: <strong>{sc.affected_radius_meters}m</strong></span>
                    </div>
                  </div>
                );
              })}

              {scenarios.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No emergency scenarios configured. Click "Create Scenario" above.
                </div>
              )}
            </div>

            {/* Scenario Action Buttons */}
            {selectedScenario && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => handleRunSimulation(selectedScenario.id)}
                  disabled={simulating}
                  className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {simulating ? 'Computing Evacuation Flow...' : `Run Simulation: "${selectedScenario.name}"`}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {selectedScenario.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleStopEmergency(selectedScenario.id)}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/40 rounded-xl text-[11px] font-bold"
                    >
                      Deactivate Alert
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartEmergency(selectedScenario.id)}
                      className="py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/50 rounded-xl text-[11px] font-bold"
                    >
                      Declare Live Alert
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedWhatIfExit(exits[0]?.id || '');
                    }}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold"
                  >
                    What-If Tester
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* What-If Exit Blockage Contingency Tester */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                What-If Exit Blockage Tester
              </h2>
              <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                Contingency
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Select Exit to Simulate Blockade:
                </label>
                <select
                  value={selectedWhatIfExit}
                  onChange={(e) => setSelectedWhatIfExit(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose an Exit to Block --</option>
                  {exits.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (Capacity: {ex.capacity} p/min)
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleWhatIfBlockExit}
                disabled={!selectedWhatIfExit || whatIfLoading || !selectedScenario}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {whatIfLoading ? 'Analyzing Contingency...' : 'Evaluate Blockade Impact'}
              </button>
            </div>

            {/* What-If Results Summary Card */}
            {whatIfResult && (
              <div className="mt-4 p-3.5 bg-slate-950 border border-amber-500/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-xs font-bold text-amber-300">Contingency Report:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    whatIfResult.impact?.time_difference_sec > 60 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    +{whatIfResult.impact?.time_difference_sec || 0}s Delay
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Baseline Time:</span>
                    <strong className="text-white">{whatIfResult.baseline_evacuation_time_sec}s</strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Blocked Time:</span>
                    <strong className="text-red-400">{whatIfResult.simulated_evacuation_time_sec}s</strong>
                  </div>
                </div>

                <div className="text-[10px] text-slate-300 space-y-1">
                  <p>• Rerouted Evacuees: <strong>{whatIfResult.impact?.evacuees_rerouted || 0} people</strong></p>
                  <p>• Blocked Exit: <strong>{whatIfResult.blocked_exit_name}</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Leaflet Map Visualizer (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-400" />
                  Campus Evacuation Spatial Map
                </h2>
                <p className="text-[11px] text-slate-400">
                  Real-time visualization of safe routes, hazard zones, and corridor bottlenecks.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-emerald-400">● Open Exits</span>
                <span className="text-red-400">● Danger Zone</span>
                <span className="text-amber-400">⚠️ Bottlenecks</span>
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
              evacuationRoutes={simulationData?.results?.route_allocations || []}
              bottlenecks={simulationData?.bottlenecks || []}
              disabledExitIds={selectedScenario?.disabled_exit_ids || []}
              blockedPathIds={selectedScenario?.blocked_path_ids || []}
              height="480px"
            />
          </div>
        </div>
      </div>

      {/* 5. SIMULATION PLAYBACK & KPI CONTROLS */}
      {simulationData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Top playback bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-3 rounded-2xl text-white shadow-lg transition-all ${
                  isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  setPlaybackTime(0);
                  setIsPlaying(false);
                }}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700"
                title="Reset to T=0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div>
                <span className="text-xs font-mono text-slate-400 block">SIMULATION TIMELINE</span>
                <span className="text-xl font-mono font-black text-white">
                  T = {playbackTime}s / {simulationData.results?.estimated_evacuation_time_sec || 0}s
                </span>
              </div>
            </div>

            {/* Slider */}
            <div className="flex-1 max-w-xl mx-2">
              <input
                type="range"
                min={0}
                max={simulationData.results?.estimated_evacuation_time_sec || 300}
                value={playbackTime}
                onChange={(e) => setPlaybackTime(Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>0s (Start)</span>
                <span>50%</span>
                <span>{simulationData.results?.estimated_evacuation_time_sec || 300}s (Evacuation Complete)</span>
              </div>
            </div>

            {/* Speed toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-end md:self-auto">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic KPI Cards at Time T */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Evacuees</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-black text-white">
                {simulationData.results?.total_affected_people || 0}
              </p>
              <span className="text-[10px] text-slate-500">Across campus origin nodes</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Evacuation Time</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-black text-emerald-400">
                {simulationData.results?.estimated_evacuation_time_formatted || '0m 0s'}
              </p>
              <span className="text-[10px] text-emerald-500/80 font-mono">Max exit clearance</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Evacuated at T</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xl font-black text-cyan-400">
                {currentStep ? `${currentStep.evacuation_rate_pct}%` : '0%'}
              </p>
              <span className="text-[10px] text-slate-500">{currentStep?.people_evacuated || 0} people safe</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Still in Transit</span>
                <TrendingDown className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-black text-amber-400">
                {currentStep?.people_remaining || 0}
              </p>
              <span className="text-[10px] text-amber-500/80">In corridors toward exits</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Bottlenecks</span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-xl font-black text-red-400">
                {simulationData.bottlenecks?.length || 0}
              </p>
              <span className="text-[10px] text-red-500/80">Capacity load &ge; 85%</span>
            </div>
          </div>

          {/* 6. CHARTS & BOTTLENECK ANALYSIS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* Timeline Curve (6 cols) */}
            <div className="lg:col-span-6 bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" />
                Evacuation Clearance Curve (People vs. Time)
              </h3>
              <div className="h-56">
                <Line
                  data={timelineChartData}
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

            {/* Exit Utilization Bar Chart (6 cols) */}
            <div className="lg:col-span-6 bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-cyan-400" />
                Multi-Exit Throughput Load Balancing
              </h3>
              <div className="h-56">
                <Bar
                  data={exitUtilData}
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

          {/* 7. BOTTLENECK RANKING TABLE */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Detected Corridor Bottlenecks ({simulationData.bottlenecks?.length || 0})
              </h3>
              <span className="text-[10px] text-slate-400">Ranked by load utilization %</span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Corridor</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3">Assigned Flow</th>
                    <th className="p-3">Utilization %</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Mitigation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {(simulationData.bottlenecks || []).map((btnk, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-white">
                        Path #{btnk.path_id} ({btnk.source_node_name || `Node ${btnk.source_node_id}`} → {btnk.destination_node_name || `Node ${btnk.destination_node_id}`})
                      </td>
                      <td className="p-3 text-slate-300 font-mono">{btnk.capacity} p/min</td>
                      <td className="p-3 text-red-400 font-mono font-bold">{btnk.total_flow_rate} p/min</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                          {btnk.utilization_percentage}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          btnk.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {btnk.severity}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 text-[11px]">
                        {btnk.recommended_action || 'Reroute flow to parallel corridor'}
                      </td>
                    </tr>
                  ))}

                  {(!simulationData.bottlenecks || simulationData.bottlenecks.length === 0) && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">
                        No critical bottlenecks detected. Multi-exit flow allocation is balanced.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. SIMULATION RUN HISTORY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          Simulation Execution History
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Scenario</th>
                <th className="p-3">Evacuees</th>
                <th className="p-3">Evacuation Time</th>
                <th className="p-3">Bottlenecks</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {simulationHistory.map((hist) => (
                <tr key={hist.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono text-slate-400">{new Date(hist.created_at).toLocaleString()}</td>
                  <td className="p-3 font-bold text-white">{hist.scenario_name || `Custom Run #${hist.id}`}</td>
                  <td className="p-3 text-slate-300 font-mono">{hist.total_evacuees}</td>
                  <td className="p-3 text-emerald-400 font-mono font-bold">{hist.evacuation_time_formatted || `${Math.round(hist.total_evacuation_time_sec)}s`}</td>
                  <td className="p-3 text-red-400 font-bold">{hist.bottlenecks_count}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      hist.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {hist.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={async () => {
                        const full = await emergencyService.getSimulationResults(hist.id);
                        if (full.data) {
                          setSimulationData(full.data);
                          setPlaybackTime(0);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded text-[11px] font-bold"
                    >
                      Load Replay
                    </button>
                  </td>
                </tr>
              ))}
              {simulationHistory.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    No simulation history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9. CREATE SCENARIO MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Create Emergency Scenario</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Scenario Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Block Chemical Fire Drill"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Emergency Type *</label>
                  <select
                    value={formData.emergency_type}
                    onChange={(e) => setFormData({ ...formData, emergency_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="FIRE">FIRE (Structure / Chemical)</option>
                    <option value="EARTHQUAKE">EARTHQUAKE (Structural Hazard)</option>
                    <option value="GAS_LEAK">GAS LEAK (Hazardous Materials)</option>
                    <option value="ACTIVE_THREAT">ACTIVE THREAT (Security Alert)</option>
                    <option value="POWER_OUTAGE">POWER OUTAGE (Infrastructure)</option>
                    <option value="DRILL">SAFETY DRILL (Training)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Severity Level *</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="LOW">LOW (Localized)</option>
                    <option value="MEDIUM">MEDIUM (Cautionary)</option>
                    <option value="HIGH">HIGH (Immediate Evacuation)</option>
                    <option value="CRITICAL">CRITICAL (Campus-Wide Evacuation)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Epicenter Facility</label>
                  <select
                    value={formData.epicenter_building_id}
                    onChange={(e) => setFormData({ ...formData, epicenter_building_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">-- Campus Center / Custom --</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.building_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Affected Danger Radius (m)</label>
                  <input
                    type="number"
                    min={20}
                    max={500}
                    value={formData.affected_radius_meters}
                    onChange={(e) => setFormData({ ...formData, affected_radius_meters: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description & Safety Directives</label>
                <textarea
                  rows={2}
                  placeholder="Outline emergency details and protocols..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Blocked Corridors & Disabled Exits */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Simulate Blocked Corridors</label>
                  <select
                    multiple
                    size={3}
                    value={formData.blocked_path_ids}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, opt => opt.value);
                      setFormData({ ...formData, blocked_path_ids: values });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-[11px] text-white focus:outline-none focus:border-red-500"
                  >
                    {paths.map(p => (
                      <option key={p.id} value={p.id}>
                        Corridor #{p.id} ({p.source_node_name} → {p.destination_node_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Simulate Disabled Exits</label>
                  <select
                    multiple
                    size={3}
                    value={formData.disabled_exit_ids}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, opt => opt.value);
                      setFormData({ ...formData, disabled_exit_ids: values });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-[11px] text-white focus:outline-none focus:border-red-500"
                  >
                    {exits.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} (Exit #{ex.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20"
                >
                  Save Scenario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyManagement;
