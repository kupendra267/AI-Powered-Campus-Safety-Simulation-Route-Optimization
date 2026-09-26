import React, { useState, useEffect } from 'react';
import { campusService } from '../services/campusService';
import { crowdService } from '../services/crowdService';
import { predictionService } from '../services/predictionService';
import { useAuth } from '../context/AuthContext';
import CampusLeafletMap from '../components/map/CampusLeafletMap';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  DoorOpen, 
  Layers, 
  Search, 
  SlidersHorizontal, 
  Ban, 
  CheckCircle, 
  AlertCircle,
  Activity,
  RefreshCw,
  Plus,
  Flame,
  Users,
  Brain,
  Clock,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CampusMapPage = () => {
  const { isAdmin } = useAuth();
  
  const [graphData, setGraphData] = useState({
    buildings: [],
    nodes: [],
    edges: [],
    exits: [],
    summary: {}
  });
  const [crowdData, setCrowdData] = useState([]);
  const [predictedSummary, setPredictedSummary] = useState(null);
  const [forecastMode, setForecastMode] = useState('LIVE'); // 'LIVE' | 'PRED_1H' | 'PRED_2H'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selection and filtering state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [activeTab, setActiveTab] = useState('buildings'); // 'buildings' | 'exits' | 'paths'
  
  // Layer toggles
  const [showNodes, setShowNodes] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showExits, setShowExits] = useState(true);
  const [showCrowdHeatmap, setShowCrowdHeatmap] = useState(true);

  const fetchGraphAndCrowdData = async () => {
    setLoading(true);
    setError(null);
    try {
      const horizonHours = forecastMode === 'PRED_2H' ? 2 : 1;
      const [gRes, cRes, pRes] = await Promise.all([
        campusService.getCampusGraph(),
        crowdService.getCurrentCrowd(),
        predictionService.getPredictionSummary(horizonHours)
      ]);
      if (gRes && gRes.success && gRes.data) {
        setGraphData(gRes.data);
      }
      if (cRes && cRes.success && cRes.data) {
        setCrowdData(cRes.data);
      }
      if (pRes && pRes.success && pRes.data) {
        setPredictedSummary(pRes.data);
      }
    } catch (err) {
      console.error("Map Data Fetch Error:", err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGraphData = fetchGraphAndCrowdData;

  useEffect(() => {
    fetchGraphAndCrowdData();
  }, [forecastMode]);

  const handleTogglePath = async (pathId) => {
    try {
      const res = await campusService.togglePathStatus(pathId);
      if (res && res.success) {
        fetchGraphAndCrowdData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle path status.');
    }
  };

  // Filtered Buildings
  const filteredBuildings = (graphData.buildings || []).filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.building_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || b.type === filterType;
    return matchesSearch && matchesType;
  });

  const buildingTypes = ['ALL', 'ACADEMIC', 'LIBRARY', 'CANTEEN', 'HOSTEL', 'ADMIN', 'AUDITORIUM', 'LAB', 'MEDICAL'];

  const isPredictionActive = forecastMode !== 'LIVE';
  const predictionHorizon = forecastMode === 'PRED_2H' ? 2 : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-7 h-7 text-blue-400" />
            Interactive Campus Topology Map
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Geographic representation of campus facilities, junctions, pathways, and emergency evacuation terminals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time vs AI Forecast Mode Selector */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setForecastMode('LIVE')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                forecastMode === 'LIVE'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </button>
            <button
              onClick={() => setForecastMode('PRED_1H')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                forecastMode === 'PRED_1H'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              AI +1h
            </button>
            <button
              onClick={() => setForecastMode('PRED_2H')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                forecastMode === 'PRED_2H'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              AI +2h
            </button>
          </div>

          <button
            onClick={fetchGraphAndCrowdData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
            title="Refresh Map Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link
            to="/routes"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">Route Finder</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin/campus"
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Campus Topology</span>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 backdrop-blur">
          <span className="text-[11px] text-slate-400 font-medium">Campus Buildings</span>
          <p className="text-xl font-bold text-white mt-0.5">{graphData.summary?.total_buildings || 0}</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 backdrop-blur">
          <span className="text-[11px] text-slate-400 font-medium">Graph Junctions & Nodes</span>
          <p className="text-xl font-bold text-blue-400 mt-0.5">{graphData.summary?.total_nodes || 0}</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 backdrop-blur">
          <span className="text-[11px] text-slate-400 font-medium">Corridors & Paths</span>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">
            {graphData.summary?.total_paths || 0}
            <span className="text-xs text-slate-400 font-normal ml-1">
              ({graphData.summary?.blocked_paths || 0} Blocked)
            </span>
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 backdrop-blur">
          <span className="text-[11px] text-slate-400 font-medium">
            {isPredictionActive ? `Predicted Hotspots (+${predictionHorizon}h)` : 'Evacuation Gates'}
          </span>
          <p className="text-xl font-bold text-amber-400 mt-0.5">
            {isPredictionActive ? (predictedSummary?.hotspots_count ?? 0) : (graphData.summary?.total_exits || 0)}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Map + Directory Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Layer Controls Bar */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Layer Overlays:
            </span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 hover:text-amber-200 font-semibold">
                <input
                  type="checkbox"
                  checked={showCrowdHeatmap}
                  onChange={(e) => setShowCrowdHeatmap(e.target.checked)}
                  className="rounded bg-slate-900 border-amber-500 text-amber-500 focus:ring-0"
                />
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Crowd Density
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showBuildings}
                  onChange={(e) => setShowBuildings(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
                Buildings
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showPaths}
                  onChange={(e) => setShowPaths(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
                Corridors
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showNodes}
                  onChange={(e) => setShowNodes(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
                Junctions
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showExits}
                  onChange={(e) => setShowExits(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
                Exits
              </label>
            </div>
          </div>

          {/* Leaflet Map */}
          {loading ? (
            <div className="h-[550px] bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-xs">Loading campus geographic coordinates...</p>
              </div>
            </div>
          ) : (
            <CampusLeafletMap
              buildings={graphData.buildings}
              nodes={graphData.nodes}
              paths={graphData.edges}
              exits={graphData.exits}
              crowdData={crowdData}
              predictedData={predictedSummary?.locations || []}
              isPredictionMode={isPredictionActive}
              predictionHorizon={predictionHorizon}
              selectedLocation={selectedLocation}
              onSelectLocation={(loc) => setSelectedLocation(loc)}
              onTogglePathStatus={isAdmin ? handleTogglePath : null}
              isAdmin={isAdmin}
              showNodes={showNodes}
              showPaths={showPaths}
              showBuildings={showBuildings}
              showExits={showExits}
              showCrowdHeatmap={showCrowdHeatmap}
              height="550px"
            />
          )}
        </div>

        {/* Directory & Inspector Column */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 backdrop-blur flex flex-col h-[610px]">
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-700/60 text-xs mb-3">
            <button
              onClick={() => setActiveTab('buildings')}
              className={`py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'buildings'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Buildings ({graphData.buildings?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('exits')}
              className={`py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'exits'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Exits ({graphData.exits?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('paths')}
              className={`py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'paths'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Paths ({graphData.edges?.length || 0})
            </button>
          </div>

          {/* Tab 1: Buildings List with Search & Category Filter */}
          {activeTab === 'buildings' && (
            <div className="flex flex-col flex-grow overflow-hidden space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search building name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] scrollbar-thin">
                {buildingTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2 py-0.5 rounded-md whitespace-nowrap font-medium transition-colors ${
                      filterType === type
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-slate-900/40 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Scrollable List */}
              <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                {filteredBuildings.map((b) => {
                  const isSelected = selectedLocation?.id === b.id && selectedLocation?.type === 'BUILDING';
                  const liveCrowd = (crowdData || []).find(c => c.location_id === b.id);
                  const predCrowd = (predictedSummary?.locations || []).find(p => p.location_id === b.id);
                  const activeCrowd = isPredictionActive ? (predCrowd || liveCrowd) : liveCrowd;

                  return (
                    <div
                      key={`list-b-${b.id}`}
                      onClick={() => setSelectedLocation({ type: 'BUILDING', ...b, crowd: activeCrowd, pred: predCrowd })}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                          : 'bg-slate-900/50 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="truncate">{b.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-400">
                          {b.building_code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                        <span>{b.type}</span>
                        {isPredictionActive && predCrowd ? (
                          <span className="font-semibold text-blue-300">
                            Pred: <strong>{predCrowd.predicted_crowd}</strong> ({predCrowd.congestion_level})
                          </span>
                        ) : (
                          <span>Cap: <strong className="text-slate-200">{b.capacity}</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredBuildings.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-6">No matching buildings found.</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Exits List */}
          {activeTab === 'exits' && (
            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
              {(graphData.exits || []).map((exit) => (
                <div
                  key={`list-ex-${exit.id}`}
                  onClick={() => setSelectedLocation({ type: 'EXIT', ...exit })}
                  className="p-3 bg-slate-900/50 border border-slate-700/60 rounded-xl text-xs space-y-1 cursor-pointer hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span>{exit.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      exit.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {exit.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Throughput Cap: {exit.capacity} people/min</p>
                  <p className="text-[10px] text-slate-500">{exit.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Paths List with 1-click status toggle */}
          {activeTab === 'paths' && (
            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
              {(graphData.edges || []).map((p) => (
                <div
                  key={`list-p-${p.id}`}
                  className="p-3 bg-slate-900/50 border border-slate-700/60 rounded-xl text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span className="truncate">#{p.id}: {p.source_node_name} &harr; {p.destination_node_name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      p.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Dist: {p.distance_meters}m</span>
                    <span>Cap: {p.capacity}/min</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleTogglePath(p.id)}
                      className={`w-full py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                        p.status === 'BLOCKED'
                          ? 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {p.status === 'BLOCKED' ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                      {p.status === 'BLOCKED' ? 'Re-open Path' : 'Block Path'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected Location Details Footer */}
          {selectedLocation && (
            <div className="mt-3 pt-3 border-t border-slate-700/80 bg-slate-900/40 p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                Selected {selectedLocation.type}
              </span>
              <p className="font-bold text-white text-xs mt-0.5 truncate">{selectedLocation.name}</p>
              {selectedLocation.capacity && (
                <p className="text-[11px] text-slate-400 mt-0.5">Capacity: {selectedLocation.capacity} persons</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampusMapPage;
