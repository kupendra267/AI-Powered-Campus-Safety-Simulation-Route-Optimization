import React, { useState, useEffect } from 'react';
import { emergencyService } from '../services/emergencyService';
import { campusService } from '../services/campusService';
import { routeService } from '../services/routeService';
import { crowdService } from '../services/crowdService';
import CampusLeafletMap from '../components/map/CampusLeafletMap';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Navigation,
  Compass,
  DoorOpen,
  Clock,
  MapPin,
  Info,
  PhoneCall,
  Activity,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

const StudentEmergencyPage = () => {
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [exits, setExits] = useState([]);
  const [crowdData, setCrowdData] = useState([]);

  // User location & route guidance
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [evacuationRoute, setEvacuationRoute] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routeError, setRouteError] = useState(null);

  useEffect(() => {
    loadEmergencyStatus();
  }, []);

  const loadEmergencyStatus = async () => {
    try {
      setLoading(true);
      const [activeRes, buildingsRes, nodesRes, pathsRes, exitsRes, crowdRes] = await Promise.all([
        emergencyService.getActiveEmergency(),
        campusService.getBuildings(),
        campusService.getNodes(),
        campusService.getPaths(),
        campusService.getExits(),
        crowdService.getCurrentCrowd()
      ]);

      setActiveEmergency(activeRes.data || null);
      setBuildings(buildingsRes.data || []);
      setNodes(nodesRes.data || []);
      setPaths(pathsRes.data || []);
      setExits(exitsRes.data || []);
      setCrowdData(crowdRes.data || []);

      if (buildingsRes.data && buildingsRes.data.length > 0) {
        setSelectedBuildingId(buildingsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load emergency status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate nearest safe exit evacuation route for the selected building
  useEffect(() => {
    if (!selectedBuildingId || buildings.length === 0 || exits.length === 0) return;

    const computeSafeEvacuationRoute = async () => {
      try {
        setCalculatingRoute(true);
        setRouteError(null);

        const currentBuilding = buildings.find(b => b.id === Number(selectedBuildingId));
        if (!currentBuilding || !currentBuilding.node_id) {
          setRouteError('Selected location is not linked to a campus graph node.');
          return;
        }

        // Filter active exits (excluding any disabled in active emergency)
        const disabledExits = new Set(activeEmergency?.disabled_exit_ids || []);
        const activeExitsList = exits.filter(e => e.status === 'ACTIVE' && !disabledExits.has(e.id));

        if (activeExitsList.length === 0) {
          setRouteError('All campus emergency exits are currently marked unavailable. Shelter in place.');
          setEvacuationRoute(null);
          return;
        }

        // Test route calculation to each candidate exit and select shortest / fastest safe exit
        let bestRoute = null;
        let lowestCost = Infinity;

        for (const exit of activeExitsList) {
          try {
            const res = await routeService.calculateRoute({
              start_node_id: currentBuilding.node_id,
              destination_node_id: exit.node_id,
              mode: 'SHORTEST'
            });

            if (res.success && res.data?.recommended_route) {
              const route = res.data.recommended_route;
              if (route.total_distance_meters < lowestCost) {
                lowestCost = route.total_distance_meters;
                bestRoute = {
                  ...route,
                  target_exit_name: exit.name,
                  target_exit_id: exit.id,
                  target_exit_capacity: exit.capacity
                };
              }
            }
          } catch (e) {
            // Ignore unreachable candidate exit
          }
        }

        if (bestRoute) {
          setEvacuationRoute(bestRoute);
        } else {
          setRouteError('No clear evacuation pathway found from this building due to corridor blockages.');
          setEvacuationRoute(null);
        }
      } catch (err) {
        console.error('Evacuation route computation failed:', err);
        setRouteError('Failed to compute safe evacuation route.');
      } finally {
        setCalculatingRoute(false);
      }
    };

    computeSafeEvacuationRoute();
  }, [selectedBuildingId, activeEmergency, buildings, exits]);

  const currentBuildingObj = buildings.find(b => b.id === Number(selectedBuildingId));

  const mapEpicenter = activeEmergency ? {
    latitude: activeEmergency.epicenter_latitude,
    longitude: activeEmergency.epicenter_longitude,
    building_id: activeEmergency.epicenter_building_id,
    radius: activeEmergency.affected_radius_meters || 100,
    type: activeEmergency.emergency_type,
    label: activeEmergency.name
  } : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. ACADEMIC DISCLAIMER BANNER */}
      <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest block">
              Academic Simulation Mode
            </span>
            <p className="text-xs text-amber-100/90 font-medium">
              Simulation-based evacuation recommendation — <strong>For Academic Demonstration & Campus Safety</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* 2. EMERGENCY STATUS HEADER */}
      {activeEmergency ? (
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500 rounded-2xl p-5 md:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-500/30 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-600/50 animate-pulse">
                <Flame className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-red-600 text-white rounded-md text-xs font-black uppercase tracking-wider animate-bounce">
                    CAMPUS EMERGENCY ACTIVE
                  </span>
                  <span className="text-xs font-mono text-red-300 font-bold">
                    SEVERITY: {activeEmergency.severity}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white mt-1">
                  {activeEmergency.name}
                </h1>
                <p className="text-xs text-slate-300">
                  {activeEmergency.description || 'Emergency declared across campus sector. Please follow safe exit navigation immediately.'}
                </p>
              </div>
            </div>

            <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-3 text-xs space-y-1 self-start md:self-auto">
              <span className="text-red-300 font-bold block">EMERGENCY PROTOCOL</span>
              <p className="text-slate-300 text-[11px]">
                1. Remain calm and proceed to nearest safe exit.<br />
                2. Avoid danger epicenter area.<br />
                3. Do not use elevators during fire emergencies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-300 font-mono">
            <span>Epicenter: <strong className="text-white">{activeEmergency.epicenter_building_name || 'Central Campus'}</strong></span>
            <span>Danger Radius: <strong className="text-red-400">{activeEmergency.affected_radius_meters}m</strong></span>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-500/40 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-md text-[10px] font-bold">
                  CAMPUS STATUS: NORMAL
                </span>
              </div>
              <h1 className="text-xl font-bold text-white mt-1">
                No Active Emergency Declared
              </h1>
              <p className="text-xs text-slate-400">
                You are in Emergency Simulation & Safety Drill mode. Test your nearest safe evacuation exit from any facility.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. EVACUATION GUIDANCE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Location Selector & Step-by-Step Guidance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Your Current Location / Facility
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Select your building:
              </label>
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.building_code}) - {b.type}
                  </option>
                ))}
              </select>
            </div>

            {/* Nearest Safe Exit Card */}
            {evacuationRoute && (
              <div className="bg-slate-950 border border-emerald-500/50 rounded-xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <DoorOpen className="w-4 h-4" />
                    Recommended Safe Exit
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded">
                    OPTIMAL ROUTE
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {evacuationRoute.target_exit_name || 'Designated Campus Exit'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Throughput Capacity: <strong>{evacuationRoute.target_exit_capacity || 80} people/min</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Distance:</span>
                    <strong className="text-white font-mono text-sm">{evacuationRoute.total_distance_meters} meters</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Est. Walking Time:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{evacuationRoute.estimated_time_formatted}</strong>
                  </div>
                </div>

                {/* Step-by-step corridor directions */}
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block">Corridor-by-Corridor Guidance:</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {(evacuationRoute.nodes || []).map((node, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                        <span className="w-4 h-4 rounded-full bg-emerald-600/30 text-emerald-400 text-[9px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="truncate">{node.name}</span>
                        {idx === (evacuationRoute.nodes.length - 1) && (
                          <span className="ml-auto text-[9px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded">
                            SAFE EXIT
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {routeError && (
              <div className="p-3.5 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Evacuation Path Warning
                </p>
                <p className="text-[11px] text-red-200">{routeError}</p>
              </div>
            )}

            {/* Emergency Contacts card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                Campus Emergency Hotlines
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div>Campus Control Room: <strong className="text-white block">+91 98765 43210</strong></div>
                <div>Campus Medical Center: <strong className="text-white block">+91 98765 43211</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Campus Map Evacuation Visualizer (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  Live Safe Evacuation Map
                </h2>
                <p className="text-[11px] text-slate-400">
                  Follow highlighted green pathway toward the nearest safe exit.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-1 rounded border border-emerald-800">
                Safe Path Active
              </span>
            </div>

            <CampusLeafletMap
              buildings={buildings}
              nodes={nodes}
              paths={paths}
              exits={exits}
              crowdData={crowdData}
              emergencyMode={!!activeEmergency}
              emergencyEpicenter={mapEpicenter}
              activeRoute={evacuationRoute}
              disabledExitIds={activeEmergency?.disabled_exit_ids || []}
              blockedPathIds={activeEmergency?.blocked_path_ids || []}
              height="500px"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentEmergencyPage;
