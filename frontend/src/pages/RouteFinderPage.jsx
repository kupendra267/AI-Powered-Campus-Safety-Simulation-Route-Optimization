import React, { useState, useEffect } from 'react';
import { campusService } from '../services/campusService';
import { routeService } from '../services/routeService';
import { crowdService } from '../services/crowdService';
import { useAuth } from '../context/AuthContext';
import CampusLeafletMap from '../components/map/CampusLeafletMap';
import { 
  Navigation, 
  MapPin, 
  Flag, 
  ArrowRight, 
  ArrowLeftRight, 
  Clock, 
  Users, 
  Brain, 
  Zap, 
  Flame, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  CheckCircle, 
  Sliders, 
  RefreshCw,
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sparkles
} from 'lucide-react';

const RouteFinderPage = () => {
  const { isAdmin } = useAuth();

  // Campus topology state
  const [graphData, setGraphData] = useState({ buildings: [], nodes: [], edges: [], exits: [] });
  const [crowdData, setCrowdData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(true);

  // Route calculation selection state
  const [startNodeId, setStartNodeId] = useState('');
  const [destNodeId, setDestNodeId] = useState('');
  const [routingMode, setRoutingMode] = useState('CROWD_AWARE'); // SHORTEST | FASTEST | CROWD_AWARE | PREDICTIVE
  const [horizonHours, setHorizonHours] = useState(1);

  // Route result state
  const [calculating, setCalculating] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0); // 0 = recommended, 1 = alt 1, 2 = alt 2
  const [error, setError] = useState(null);

  // Admin Config state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState({
    walking_speed: 1.4,
    distance_weight: 0.4,
    congestion_weight: 0.6,
    prediction_weight: 0.7,
    risk_weight: 0.5
  });
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(null);

  // 1. Initial Load: Campus Graph, Buildings, Exits, Live Crowd
  useEffect(() => {
    const initData = async () => {
      setLoadingGraph(true);
      setError(null);
      try {
        const [gRes, cRes, cfgRes] = await Promise.all([
          campusService.getCampusGraph(),
          crowdService.getCurrentCrowd(),
          routeService.getRoutingConfig()
        ]);

        if (gRes.success && gRes.data) {
          setGraphData(gRes.data);

          // Set default start (Main Gate / First node) & default destination (Auditorium / Canteen)
          const buildings = gRes.data.buildings || [];
          const exits = gRes.data.exits || [];
          const nodes = gRes.data.nodes || [];

          if (buildings.length > 0) {
            const originBldg = buildings.find(b => b.building_code === 'ADM-1' || b.type === 'ADMIN') || buildings[0];
            const destBldg = buildings.find(b => b.type === 'AUDITORIUM' || b.type === 'CANTEEN') || (buildings.length > 1 ? buildings[1] : buildings[0]);
            
            setStartNodeId(originBldg.node_id);
            setDestNodeId(destBldg.node_id);
          } else if (nodes.length > 1) {
            setStartNodeId(nodes[0].id);
            setDestNodeId(nodes[nodes.length - 1].id);
          }
        }

        if (cRes.success && cRes.data) {
          setCrowdData(cRes.data);
        }

        if (cfgRes.success && cfgRes.data) {
          setConfigData(cfgRes.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to connect to routing service.');
      } finally {
        setLoadingGraph(false);
      }
    };

    initData();
  }, []);

  // 2. Route calculation handler
  const handleCalculateRoute = async () => {
    if (!startNodeId || !destNodeId) {
      setError('Please select both Origin (Start) and Destination locations.');
      return;
    }

    setCalculating(true);
    setError(null);
    setSelectedRouteIndex(0);

    try {
      const res = await routeService.calculateRoute({
        start_node_id: startNodeId,
        destination_node_id: destNodeId,
        mode: routingMode,
        horizon_hours: horizonHours
      });

      if (res.success && res.data) {
        setRouteResult(res.data);
      } else {
        setError(res.message || 'No safe route available between selected locations.');
        setRouteResult(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.details || err.message || 'Path calculation failed.';
      setError(msg);
      setRouteResult(null);
    } finally {
      setCalculating(false);
    }
  };

  // Swap Start & Destination
  const handleSwapLocations = () => {
    setStartNodeId(destNodeId);
    setDestNodeId(startNodeId);
  };

  // Admin Config update handler
  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    setUpdatingConfig(true);
    setConfigSuccess(null);
    try {
      const res = await routeService.updateRoutingConfig(configData);
      if (res.success) {
        setConfigSuccess('Routing parameters updated successfully!');
        setTimeout(() => setShowConfigModal(false), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update configuration.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  // Build combined list of selectable locations (Buildings, Exits, Junctions)
  const selectableLocations = [
    ...(graphData.buildings || []).map(b => ({
      id: b.node_id,
      label: `${b.name} (${b.building_code}) - ${b.type}`,
      type: 'BUILDING',
      name: b.name
    })),
    ...(graphData.exits || []).map(e => ({
      id: e.node_id,
      label: `[EXIT] ${e.name} (${e.status})`,
      type: 'EXIT',
      name: e.name
    })),
    ...(graphData.nodes || []).filter(n => n.node_type === 'JUNCTION').map(n => ({
      id: n.id,
      label: `[JUNCTION] ${n.name} (#${n.id})`,
      type: 'JUNCTION',
      name: n.name
    }))
  ];

  // Active route being displayed (Recommended vs Alternative 1 vs Alternative 2)
  const allRoutesList = routeResult ? [
    routeResult.recommended_route,
    ...(routeResult.alternative_routes || [])
  ] : [];

  const currentActiveRoute = allRoutesList[selectedRouteIndex] || routeResult?.recommended_route;
  const currentAlternativeRoutes = allRoutesList.filter((_, idx) => idx !== selectedRouteIndex);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <Navigation className="w-8 h-8 text-blue-400" />
              Intelligent Route Finder & Navigation
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Multi-objective A* graph routing balancing physical distance, real-time crowd impedance, and AI ML crowd predictions.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Routing Parameters</span>
          </button>
        )}
      </div>

      {/* Control Console: Origin, Destination & Mode Selector */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-2xl backdrop-blur space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Origin Dropdown (5 cols) */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Origin / Start Point:
            </label>
            <select
              value={startNodeId}
              onChange={(e) => setStartNodeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {selectableLocations.map((loc) => (
                <option key={`start-${loc.type}-${loc.id}`} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button (2 cols / centered) */}
          <div className="md:col-span-2 flex items-center justify-center pt-2 md:pt-4">
            <button
              onClick={handleSwapLocations}
              className="p-2.5 bg-slate-700/80 hover:bg-blue-600 rounded-xl text-slate-300 hover:text-white transition-all shadow-md"
              title="Swap Start and Destination"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Dropdown (5 cols) */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-rose-400" />
              Destination / Target Goal:
            </label>
            <select
              value={destNodeId}
              onChange={(e) => setDestNodeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {selectableLocations.map((loc) => (
                <option key={`dest-${loc.type}-${loc.id}`} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Routing Mode Buttons & Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-700/70">
          {/* Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-1">Routing Mode:</span>

            <button
              onClick={() => setRoutingMode('CROWD_AWARE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                routingMode === 'CROWD_AWARE'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-400'
                  : 'bg-slate-900/60 border border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Crowd-Aware (Smart Balance)</span>
            </button>

            <button
              onClick={() => setRoutingMode('PREDICTIVE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                routingMode === 'PREDICTIVE'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-400'
                  : 'bg-slate-900/60 border border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-purple-300" />
              <span>Predictive (AI ML Forecast)</span>
            </button>

            <button
              onClick={() => setRoutingMode('FASTEST')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                routingMode === 'FASTEST'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400'
                  : 'bg-slate-900/60 border border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fastest (Time)</span>
            </button>

            <button
              onClick={() => setRoutingMode('SHORTEST')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                routingMode === 'SHORTEST'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400'
                  : 'bg-slate-900/60 border border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-300" />
              <span>Shortest (Distance)</span>
            </button>
          </div>

          {/* Predictive Horizon Selector if PREDICTIVE active */}
          {routingMode === 'PREDICTIVE' && (
            <div className="flex items-center gap-1.5 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] text-purple-300 font-semibold">Forecast Horizon:</span>
              {[1, 2, 3, 4, 6, 8].map(h => (
                <button
                  key={h}
                  onClick={() => setHorizonHours(h)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    horizonHours === h ? 'bg-purple-600 text-white shadow' : 'text-purple-300 hover:bg-purple-800/40'
                  }`}
                >
                  +{h}h
                </button>
              ))}
            </div>
          )}

          {/* Calculate Route Action Button */}
          <button
            onClick={handleCalculateRoute}
            disabled={calculating || loadingGraph}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running A* Pathfinder...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Calculate Optimal Route</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">{error}</p>
            <p className="text-slate-400 text-[11px]">
              Tip: If a path is blocked or disconnected, select a different origin/destination or unblock corridors via Campus Topology.
            </p>
          </div>
        </div>
      )}

      {/* Main Routing Layout: 3 Columns (Route Cards + Map + Detailed Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Route Selection Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Calculated Route Options
            </h2>
            {routeResult && (
              <span className="text-[10px] font-mono text-slate-400">
                Mode: <strong className="text-blue-400">{routeResult.mode}</strong>
              </span>
            )}
          </div>

          {!routeResult ? (
            <div className="p-8 bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl text-center space-y-2">
              <Navigation className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">No active route calculated yet.</p>
              <p className="text-[11px] text-slate-500">
                Choose start & destination above and click <strong>"Calculate Optimal Route"</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allRoutesList.map((route, idx) => {
                const isSelected = selectedRouteIndex === idx;
                const isRecommended = idx === 0;

                return (
                  <div
                    key={`route-card-${route.route_id || idx}`}
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/50'
                        : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isRecommended ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            ★ Recommended
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                            Alternative {idx}
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-white">{route.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{route.paths_count} Corridors</span>
                    </div>

                    {/* Metric Badges */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-700/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total Distance</span>
                        <p className="text-base font-bold text-white font-mono">{route.total_distance_meters} m</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Estimated Time</span>
                        <p className="text-base font-bold text-blue-400 font-mono">{route.estimated_time_formatted}</p>
                      </div>
                    </div>

                    {/* Congestion & Risk Bar */}
                    <div className="flex items-center justify-between text-[11px] pt-2 mt-2 border-t border-slate-700/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">Congestion:</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          route.maximum_congestion === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                          route.maximum_congestion === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                          route.maximum_congestion === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {route.maximum_congestion} ({route.average_density_percentage}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Risk:</span>
                        <span className="text-[10px] font-bold text-slate-300 font-mono">
                          {route.simulation_risk_score}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Informational disclaimer */}
              <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <p className="text-slate-300 font-semibold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  Routing Topology Note:
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {routeResult.alternatives_note || 'Alternative paths generated using Yen’s K-Shortest graph algorithm.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Map & Segment Inspector (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Leaflet Map with Route Visualization */}
          <CampusLeafletMap
            buildings={graphData.buildings}
            nodes={graphData.nodes}
            paths={graphData.edges}
            exits={graphData.exits}
            crowdData={crowdData}
            activeRoute={currentActiveRoute}
            alternativeRoutes={currentAlternativeRoutes}
            onSelectAlternativeRoute={(alt) => {
              const idx = allRoutesList.findIndex(r => r.route_id === alt.route_id);
              if (idx !== -1) setSelectedRouteIndex(idx);
            }}
            isPredictionMode={routingMode === 'PREDICTIVE'}
            predictionHorizon={horizonHours}
            isAdmin={isAdmin}
            height="460px"
          />

          {/* Active Route Step-by-Step Corridor Breakdown */}
          {currentActiveRoute && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    Turn-by-Turn Corridor Trajectory ({currentActiveRoute.name})
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Step-by-step segment impedance, walking distance, and live pedestrian density.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold font-mono">
                    Total: {currentActiveRoute.total_distance_meters}m · ~{currentActiveRoute.estimated_time_formatted}
                  </span>
                </div>
              </div>

              {/* Segments Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/80 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Step</th>
                      <th className="py-2.5 px-3">Corridor Segment</th>
                      <th className="py-2.5 px-3">Distance</th>
                      <th className="py-2.5 px-3">Capacity</th>
                      <th className="py-2.5 px-3">Live Crowd</th>
                      <th className="py-2.5 px-3">Congestion</th>
                      <th className="py-2.5 px-3 text-right">Est. Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {(currentActiveRoute.segments || []).map((seg, idx) => (
                      <tr key={`seg-${seg.path_id}-${idx}`} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-400">#{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-white">
                            <span>{seg.source_node_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span>{seg.destination_node_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Corridor #{seg.path_id}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{seg.distance_meters} m</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{seg.capacity}/min</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">{seg.current_crowd}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            seg.congestion_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            seg.congestion_level === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            seg.congestion_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {seg.congestion_level} ({seg.density_percentage}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-300">
                          {seg.estimated_time_formatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Route Comparison Matrix (When alternatives exist) */}
          {allRoutesList.length > 1 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
                <Sliders className="w-4 h-4 text-blue-400" />
                Comparative Route Matrix (Multi-Objective Evaluation)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/80 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Route Candidate</th>
                      <th className="py-2 px-3">Total Distance</th>
                      <th className="py-2 px-3">Travel Time</th>
                      <th className="py-2 px-3">Max Congestion</th>
                      <th className="py-2 px-3">Simulation Risk Score</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {allRoutesList.map((r, idx) => (
                      <tr key={`comp-${r.route_id || idx}`} className={selectedRouteIndex === idx ? 'bg-blue-600/10' : ''}>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {r.name} {idx === 0 && <span className="text-[10px] text-emerald-400 font-bold ml-1">(Best)</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.total_distance_meters} m</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-300">{r.estimated_time_formatted}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.maximum_congestion === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                            r.maximum_congestion === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                            r.maximum_congestion === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {r.maximum_congestion}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                          {r.simulation_risk_score} ({r.risk_level})
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedRouteIndex(idx)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-blue-600 rounded text-[11px] font-semibold text-slate-200 transition-colors"
                          >
                            {selectedRouteIndex === idx ? 'Viewing' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Routing Settings Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                Admin Routing Engine Parameters
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {configSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{configSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateConfig} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nominal Pedestrian Walking Speed (m/s):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.4"
                  max="3.0"
                  value={configData.walking_speed}
                  onChange={(e) => setConfigData({ ...configData, walking_speed: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
                <span className="text-[10px] text-slate-500">Default: 1.4 m/s (~5.04 km/h)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Distance Weight ($w_{dist}$):</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={configData.distance_weight}
                    onChange={(e) => setConfigData({ ...configData, distance_weight: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Congestion Weight ($w_{crowd}$):</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={configData.congestion_weight}
                    onChange={(e) => setConfigData({ ...configData, congestion_weight: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingConfig}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
                >
                  {updatingConfig ? 'Saving...' : 'Apply Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteFinderPage;
