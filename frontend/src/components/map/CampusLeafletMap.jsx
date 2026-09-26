import React, { useEffect, useState, Component } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Building2, 
  DoorOpen, 
  AlertTriangle, 
  CheckCircle, 
  Ban, 
  MapPin, 
  Info,
  Users,
  Activity,
  Flame,
  Layers,
  RotateCcw,
  Navigation,
  Flag,
  ArrowRight,
  ShieldAlert,
  Zap
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Coordinate validation helper
const isValidCoord = (lat, lng) => {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  return !isNaN(numLat) && !isNaN(numLng) && Number.isFinite(numLat) && Number.isFinite(numLng);
};

// Map lifecycle & sizing helper
const MapResizer = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (bounds && bounds.length > 1) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], animate: true });
      } catch (e) {
        // Fallback to center
      }
    } else if (center && center.length === 2 && isValidCoord(center[0], center[1])) {
      map.setView([parseFloat(center[0]), parseFloat(center[1])], zoom || 16, { animate: true });
    }
  }, [center, zoom, bounds, map]);

  return null;
};

// Error boundary to prevent white-screen crashes
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Leaflet Map Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[550px] w-full bg-slate-900 border border-slate-700 rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Map Display Reset Required</h3>
          <p className="text-slate-400 text-xs max-w-md">
            The interactive map encountered a rendering interruption. Click below to reload the campus topology.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Map Canvas
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Custom DivIcon generators
const createBuildingIcon = (type, code, isSelected, crowdInfo, isEpicenter = false) => {
  let colorClass = 'bg-blue-600 border-blue-400 text-white';
  if (type === 'ADMIN') colorClass = 'bg-slate-700 border-slate-500 text-white';
  if (type === 'LIBRARY') colorClass = 'bg-indigo-600 border-indigo-400 text-white';
  if (type === 'CANTEEN') colorClass = 'bg-orange-600 border-orange-400 text-white';
  if (type === 'HOSTEL') colorClass = 'bg-emerald-600 border-emerald-400 text-white';
  if (type === 'AUDITORIUM') colorClass = 'bg-purple-600 border-purple-400 text-white';
  if (type === 'MEDICAL') colorClass = 'bg-rose-600 border-rose-400 text-white';

  if (isEpicenter) {
    colorClass = 'bg-red-700 border-red-300 text-white animate-pulse';
  }

  let crowdBadge = '';
  let borderPulse = '';

  if (crowdInfo) {
    const level = crowdInfo.congestion_level;
    if (level === 'CRITICAL' || isEpicenter) {
      crowdBadge = `<span style="padding: 1px 4px; border-radius: 4px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 900;">${isEpicenter ? 'HAZARD' : 'CRIT'}</span>`;
      borderPulse = 'box-shadow: 0 0 14px #ef4444; border-color: #ef4444;';
    } else if (level === 'HIGH') {
      crowdBadge = `<span style="padding: 1px 4px; border-radius: 4px; background: #f97316; color: #fff; font-size: 9px; font-weight: 700;">HIGH</span>`;
      borderPulse = 'box-shadow: 0 0 8px #f97316;';
    } else if (level === 'MEDIUM') {
      crowdBadge = `<span style="padding: 1px 4px; border-radius: 4px; background: #eab308; color: #000; font-size: 9px; font-weight: 700;">MED</span>`;
    } else {
      crowdBadge = `<span style="padding: 1px 4px; border-radius: 4px; background: #10b981; color: #fff; font-size: 9px; font-weight: 600;">LOW</span>`;
    }
  }

  const ringStyle = isSelected ? 'outline: 3px solid #facc15; transform: scale(1.1);' : borderPulse;

  return L.divIcon({
    className: 'custom-building-icon',
    html: `
      <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; ${ringStyle}" class="${colorClass} border shadow-lg">
        <span>${isEpicenter ? '🚨 ' : ''}${code}</span>
        ${crowdBadge}
      </div>
    `,
    iconSize: [isEpicenter ? 80 : 68, 26],
    iconAnchor: [isEpicenter ? 40 : 34, 13]
  });
};

const createExitIcon = (status, isSelected, isDisabled = false) => {
  const isBlocked = status === 'BLOCKED' || isDisabled;
  const bg = isBlocked ? 'background-color: #dc2626; border-color: #fca5a5;' : 'background-color: #059669; border-color: #6ee7b7;';
  const ring = isSelected ? 'outline: 3px solid #facc15; transform: scale(1.15);' : '';

  return L.divIcon({
    className: 'custom-exit-icon',
    html: `
      <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9999px; ${bg} border: 2px solid; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 10px; font-weight: 900; ${ring}">
        ${isBlocked ? '✕' : 'EXIT'}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

// Route Origin Marker
const createRouteStartIcon = (nodeName) => {
  return L.divIcon({
    className: 'route-start-icon',
    html: `
      <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; background: #059669; border: 2px solid #a7f3d0; color: white; box-shadow: 0 0 15px rgba(5, 150, 105, 0.7); font-size: 10px; font-weight: 900; cursor: pointer;">
        <span>START</span>
      </div>
    `,
    iconSize: [60, 24],
    iconAnchor: [30, 12]
  });
};

// Route Destination Marker
const createRouteDestIcon = (nodeName) => {
  return L.divIcon({
    className: 'route-dest-icon',
    html: `
      <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; background: #dc2626; border: 2px solid #fecaca; color: white; box-shadow: 0 0 15px rgba(220, 38, 38, 0.7); font-size: 10px; font-weight: 900; cursor: pointer;">
        <span>GOAL</span>
      </div>
    `,
    iconSize: [56, 24],
    iconAnchor: [28, 12]
  });
};

// Emergency Epicenter Icon
const createEpicenterIcon = (label, type) => {
  return L.divIcon({
    className: 'emergency-epicenter-icon',
    html: `
      <div style="display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; background: #b91c1c; border: 2px solid #fca5a5; color: white; box-shadow: 0 0 20px rgba(239, 68, 68, 0.9); font-size: 11px; font-weight: 900; cursor: pointer; animation: pulse 1.5s infinite;">
        <span>🚨 ${type || 'HAZARD'}</span>
      </div>
    `,
    iconSize: [95, 26],
    iconAnchor: [47, 13]
  });
};

// Bottleneck Warning Icon
const createBottleneckIcon = (utilization) => {
  return L.divIcon({
    className: 'bottleneck-icon',
    html: `
      <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 9999px; background: #dc2626; border: 2px solid #fef08a; color: white; box-shadow: 0 0 12px rgba(220, 38, 38, 0.8); font-size: 9px; font-weight: 900;">
        ⚠️
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const CampusLeafletMap = ({
  buildings = [],
  nodes = [],
  paths = [],
  exits = [],
  crowdData = [],
  predictedData = [],
  isPredictionMode = false,
  predictionHorizon = 1,
  selectedLocation = null,
  onSelectLocation = () => {},
  onTogglePathStatus = null,
  isAdmin = false,
  showNodes = true,
  showPaths = true,
  showBuildings = true,
  showExits = true,
  showCrowdHeatmap = true,
  // Route Visualization Props
  activeRoute = null,
  alternativeRoutes = [],
  onSelectAlternativeRoute = null,
  // Emergency Visualization Props
  emergencyMode = false,
  emergencyEpicenter = null, // { latitude, longitude, radius, label, type, building_id }
  evacuationRoutes = [], // Array of routes from simulation
  bottlenecks = [], // Array of bottleneck path objects
  disabledExitIds = [],
  blockedPathIds = [],
  height = "550px"
}) => {
  const defaultCenter = [12.9722, 77.5942];
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoomLevel, setZoomLevel] = useState(16);
  const [routeBounds, setRouteBounds] = useState(null);

  // Map location_id to real-time crowd records
  const crowdMap = {};
  if (Array.isArray(crowdData)) {
    crowdData.forEach(c => {
      if (c && c.location_id) {
        crowdMap[c.location_id] = c;
      }
    });
  }

  // Map location_id to predicted crowd records
  const predMap = {};
  if (Array.isArray(predictedData)) {
    predictedData.forEach(p => {
      if (p && p.location_id) {
        predMap[p.location_id] = p;
      }
    });
  }

  // Disabled exit set & blocked path set
  const disabledExitSet = new Set((disabledExitIds || []).map(Number));
  const blockedPathSet = new Set((blockedPathIds || []).map(Number));

  // Focus on selected location
  useEffect(() => {
    if (selectedLocation) {
      const lat = parseFloat(selectedLocation.latitude);
      const lng = parseFloat(selectedLocation.longitude);
      if (isValidCoord(lat, lng)) {
        setMapCenter([lat, lng]);
        setZoomLevel(17);
        setRouteBounds(null);
      }
    }
  }, [selectedLocation]);

  // Focus / fit bounds to active route or emergency epicenter
  useEffect(() => {
    if (activeRoute && activeRoute.nodes && activeRoute.nodes.length > 0) {
      const coords = activeRoute.nodes
        .filter(n => isValidCoord(n.latitude, n.longitude))
        .map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);

      if (coords.length > 1) {
        setRouteBounds(coords);
      }
    } else if (emergencyEpicenter && isValidCoord(emergencyEpicenter.latitude, emergencyEpicenter.longitude)) {
      setMapCenter([parseFloat(emergencyEpicenter.latitude), parseFloat(emergencyEpicenter.longitude)]);
    }
  }, [activeRoute, emergencyEpicenter]);

  // Extract active route positions
  const activeRoutePositions = (activeRoute?.nodes || [])
    .filter(n => isValidCoord(n.latitude, n.longitude))
    .map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);

  const startNode = activeRoute?.nodes && activeRoute.nodes.length > 0 ? activeRoute.nodes[0] : null;
  const destNode = activeRoute?.nodes && activeRoute.nodes.length > 1 ? activeRoute.nodes[activeRoute.nodes.length - 1] : null;

  return (
    <MapErrorBoundary>
      <div 
        className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950" 
        style={{ height: height || '550px', width: '100%', minHeight: '450px' }}
      >
        {/* Floating Emergency Mode Pill */}
        {emergencyMode && (
          <div className="absolute top-3 left-3 z-[1000] bg-red-950/90 backdrop-blur border border-red-500 text-white px-3.5 py-1.5 rounded-xl text-xs shadow-xl flex items-center gap-2 animate-pulse">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>
              <strong>EMERGENCY EVACUATION MODE:</strong> {emergencyEpicenter?.type || 'HAZARD'} · Follow Safe Routes
            </span>
          </div>
        )}

        {/* Active Route Floating Pill */}
        {activeRoute && !emergencyMode && (
          <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur border border-cyan-500/60 text-white px-3.5 py-1.5 rounded-xl text-xs shadow-xl flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>
              <strong>{activeRoute.name || 'Calculated Route'}:</strong> {activeRoute.total_distance_meters}m · {activeRoute.estimated_time_formatted}
            </span>
          </div>
        )}

        {/* Prediction Mode Active Floating Badge */}
        {isPredictionMode && !activeRoute && !emergencyMode && (
          <div className="absolute top-3 right-3 z-[1000] bg-blue-600/90 backdrop-blur border border-blue-400 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Predicted Forecast (+{predictionHorizon}h) Active</span>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={16}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', minHeight: '450px' }}
        >
          <MapResizer center={mapCenter} zoom={zoomLevel} bounds={routeBounds} />

          {/* OpenStreetMap Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* 1. EMERGENCY EPICENTER & DANGER RADIUS OVERLAY */}
          {emergencyEpicenter && isValidCoord(emergencyEpicenter.latitude, emergencyEpicenter.longitude) && (
            <>
              <Circle
                center={[parseFloat(emergencyEpicenter.latitude), parseFloat(emergencyEpicenter.longitude)]}
                radius={emergencyEpicenter.radius || 90}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#b91c1c',
                  fillOpacity: 0.35,
                  weight: 2.5,
                  dashArray: '6, 6'
                }}
              />
              <Marker
                position={[parseFloat(emergencyEpicenter.latitude), parseFloat(emergencyEpicenter.longitude)]}
                icon={createEpicenterIcon(emergencyEpicenter.label, emergencyEpicenter.type)}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1">
                    <p className="font-bold text-red-700">🚨 Hazard Epicenter</p>
                    <p className="text-slate-600">Type: <strong>{emergencyEpicenter.type || 'Emergency'}</strong></p>
                    <p className="text-slate-600">Affected Radius: <strong>{emergencyEpicenter.radius || 90}m</strong></p>
                    <p className="text-[10px] text-red-600 font-semibold">Immediate evacuation area. Avoid this zone.</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* 2. CROWD HEATMAP / DENSITY RADIUS OVERLAYS */}
          {showCrowdHeatmap && !emergencyMode && (buildings || []).map((b) => {
            if (!b || !isValidCoord(b.latitude, b.longitude)) return null;
            
            const liveCrowd = crowdMap[b.id];
            const predCrowd = predMap[b.id];
            const activeCrowd = isPredictionMode ? (predCrowd || liveCrowd) : liveCrowd;
            if (!activeCrowd) return null;

            const density = isPredictionMode 
              ? (activeCrowd.predicted_density ?? activeCrowd.density_percentage ?? 0)
              : (activeCrowd.density_percentage ?? 0);

            let fillColor = '#10b981';
            let radius = 35;
            let fillOpacity = 0.25;

            if (density > 90) {
              fillColor = '#ef4444';
              radius = 65;
              fillOpacity = 0.45;
            } else if (density > 70) {
              fillColor = '#f97316';
              radius = 55;
              fillOpacity = 0.38;
            } else if (density > 40) {
              fillColor = '#eab308';
              radius = 45;
              fillOpacity = 0.30;
            }

            return (
              <Circle
                key={`heat-${b.id}`}
                center={[parseFloat(b.latitude), parseFloat(b.longitude)]}
                radius={radius}
                pathOptions={{
                  color: fillColor,
                  fillColor: fillColor,
                  fillOpacity: fillOpacity,
                  weight: 1.5,
                  dashArray: density > 90 ? '4, 4' : null
                }}
              />
            );
          })}

          {/* 3. BASE CAMPUS PATHS (Polylines) */}
          {showPaths && (paths || []).map((path) => {
            if (!path || !path.source_coordinates || !path.destination_coordinates) return null;
            
            const srcLat = parseFloat(path.source_coordinates[0]);
            const srcLng = parseFloat(path.source_coordinates[1]);
            const dstLat = parseFloat(path.destination_coordinates[0]);
            const dstLng = parseFloat(path.destination_coordinates[1]);

            if (!isValidCoord(srcLat, srcLng) || !isValidCoord(dstLat, dstLng)) return null;

            const isBlocked = path.status === 'BLOCKED' || blockedPathSet.has(path.id);
            const isCongested = path.status === 'CONGESTED';
            
            let pathColor = '#10b981';
            let dashArray = null;
            let weight = 3;
            let opacity = (activeRoute || evacuationRoutes.length > 0) ? 0.35 : 0.85;

            if (isBlocked) {
              pathColor = '#ef4444';
              dashArray = '6, 8';
              weight = 4;
              opacity = 0.9;
            } else if (isCongested) {
              pathColor = '#f59e0b';
              weight = 3;
            }

            const positions = [
              [srcLat, srcLng],
              [dstLat, dstLng]
            ];

            return (
              <Polyline
                key={`path-${path.id}`}
                positions={positions}
                pathOptions={{
                  color: pathColor,
                  weight: weight,
                  opacity: opacity,
                  dashArray: dashArray,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1.5 min-w-[180px]">
                    <div className="font-bold border-b pb-1 flex items-center justify-between">
                      <span>Corridor #{path.id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isBlocked ? 'BLOCKED' : path.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p><strong>From:</strong> {path.source_node_name || `Node ${path.source_node_id}`}</p>
                      <p><strong>To:</strong> {path.destination_node_name || `Node ${path.destination_node_id}`}</p>
                      <p><strong>Distance:</strong> {path.distance_meters} m</p>
                      <p><strong>Capacity:</strong> {path.capacity} people/min</p>
                    </div>
                    {isAdmin && onTogglePathStatus && (
                      <button
                        onClick={() => onTogglePathStatus(path.id)}
                        className={`w-full mt-2 py-1 px-2 rounded text-[11px] font-bold text-white transition-colors flex items-center justify-center gap-1 ${
                          isBlocked ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                        }`}
                      >
                        {isBlocked ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {isBlocked ? 'Unblock Corridor' : 'Block Corridor'}
                      </button>
                    )}
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* 4. EVACUATION FLOW ROUTES */}
          {evacuationRoutes.map((evac, idx) => {
            let evacCoords = [];
            if (evac.nodes && Array.isArray(evac.nodes) && evac.nodes.length > 0) {
              evacCoords = evac.nodes
                .map(n => {
                  if (typeof n === 'number') {
                    const nodeObj = (nodes || []).find(x => x.id === n);
                    return nodeObj && isValidCoord(nodeObj.latitude, nodeObj.longitude)
                      ? [parseFloat(nodeObj.latitude), parseFloat(nodeObj.longitude)]
                      : null;
                  }
                  const lat = n.latitude !== undefined ? n.latitude : (n.lat !== undefined ? n.lat : n[0]);
                  const lng = n.longitude !== undefined ? n.longitude : (n.lng !== undefined ? n.lng : n[1]);
                  return isValidCoord(lat, lng) ? [parseFloat(lat), parseFloat(lng)] : null;
                })
                .filter(Boolean);
            } else if (evac.path_coordinates && Array.isArray(evac.path_coordinates) && evac.path_coordinates.length > 0) {
              evacCoords = evac.path_coordinates
                .filter(n => isValidCoord(n[0], n[1]))
                .map(n => [parseFloat(n[0]), parseFloat(n[1])]);
            } else if (evac.path_ids && Array.isArray(evac.path_ids)) {
              // Reconstruct from path IDs
              evac.path_ids.forEach(pid => {
                const p = (paths || []).find(x => x.id === pid);
                if (p) {
                  const sNode = p.source_node || (nodes || []).find(n => n.id === p.source_node_id);
                  const dNode = p.destination_node || (nodes || []).find(n => n.id === p.destination_node_id);
                  if (sNode && isValidCoord(sNode.latitude, sNode.longitude)) {
                    evacCoords.push([parseFloat(sNode.latitude), parseFloat(sNode.longitude)]);
                  }
                  if (dNode && isValidCoord(dNode.latitude, dNode.longitude)) {
                    evacCoords.push([parseFloat(dNode.latitude), parseFloat(dNode.longitude)]);
                  }
                }
              });
            }

            if (evacCoords.length < 2) return null;

            return (
              <Polyline
                key={`evac-flow-${evac.origin_building_id || evac.origin_id || idx}-${evac.exit_id || idx}`}
                positions={evacCoords}
                pathOptions={{
                  color: '#10b981',
                  weight: 4.5,
                  opacity: 0.85,
                  dashArray: '5, 5',
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1">
                    <p className="font-bold text-emerald-700">Evacuation Flow Path</p>
                    <p className="text-[11px] text-slate-600">Origin: <strong>{evac.origin_building_name || evac.origin_name || `Building #${evac.origin_building_id || evac.origin_id}`}</strong></p>
                    <p className="text-[11px] text-slate-600">Assigned Exit: <strong>{evac.exit_name || `Exit #${evac.exit_id}`}</strong></p>
                    <p className="text-[11px] text-slate-600">Evacuees: <strong>{evac.allocated_people !== undefined ? evac.allocated_people : (evac.people_assigned !== undefined ? evac.people_assigned : (evac.evacuees_count || 0))} people</strong></p>
                    <p className="text-[11px] text-slate-600">Travel Time: <strong>{evac.estimated_travel_time_sec ? `${Math.round(evac.estimated_travel_time_sec)}s` : (evac.walking_time ? `${Math.round(evac.walking_time)}s` : 'N/A')}</strong></p>
                    {evac.distance && <p className="text-[11px] text-slate-600">Distance: <strong>{evac.distance}m</strong></p>}
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* 5. BOTTLENECK CORRIDORS & MARKERS */}
          {bottlenecks.map((btnk, idx) => {
            if (!btnk) return null;
            let src = btnk.source_coordinates;
            let dst = btnk.destination_coordinates;

            if ((!src || !dst) && btnk.path_id) {
              const matchedPath = (paths || []).find(p => p.id === btnk.path_id);
              if (matchedPath) {
                const sNode = matchedPath.source_node || (nodes || []).find(n => n.id === matchedPath.source_node_id);
                const dNode = matchedPath.destination_node || (nodes || []).find(n => n.id === matchedPath.destination_node_id);
                if (sNode && dNode) {
                  src = [sNode.latitude, sNode.longitude];
                  dst = [dNode.latitude, dNode.longitude];
                }
              }
            }

            if (!src || !dst || !isValidCoord(src[0], src[1]) || !isValidCoord(dst[0], dst[1])) return null;

            const midLat = (parseFloat(src[0]) + parseFloat(dst[0])) / 2;
            const midLng = (parseFloat(src[1]) + parseFloat(dst[1])) / 2;
            const utilPct = btnk.utilization_percentage !== undefined ? btnk.utilization_percentage : (btnk.utilization !== undefined ? btnk.utilization : 0);
            const flowRate = btnk.total_flow_rate !== undefined ? btnk.total_flow_rate : (btnk.assigned_flow !== undefined ? btnk.assigned_flow : 0);

            return (
              <React.Fragment key={`btnk-${btnk.path_id || idx}`}>
                <Polyline
                  positions={[
                    [parseFloat(src[0]), parseFloat(src[1])],
                    [parseFloat(dst[0]), parseFloat(dst[1])]
                  ]}
                  pathOptions={{
                    color: '#ef4444',
                    weight: 7,
                    opacity: 0.9,
                    dashArray: '6, 6'
                  }}
                />
                <Marker
                  position={[midLat, midLng]}
                  icon={createBottleneckIcon(utilPct)}
                >
                  <Popup>
                    <div className="text-xs p-1 text-slate-800 space-y-1 min-w-[190px]">
                      <div className="font-bold text-red-700 flex items-center justify-between border-b pb-1">
                        <span>⚠️ Bottleneck Warning</span>
                        <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-[10px] font-black">
                          {utilPct}% LOAD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">Corridor: <strong>#{btnk.path_id}</strong></p>
                      <p className="text-[11px] text-slate-600">Flow: <strong>{flowRate} p/min (Cap: {btnk.capacity})</strong></p>
                      <p className="text-[11px] text-slate-600">Severity: <strong className="text-red-600">{btnk.severity || 'CRITICAL'}</strong></p>
                      <p className="text-[10px] text-amber-700 font-semibold">{btnk.recommended_action || 'Divert evacuees to alternative corridor'}</p>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* 6. ALTERNATIVE ROUTES */}
          {(alternativeRoutes || []).map((alt, idx) => {
            const altPositions = (alt.nodes || [])
              .filter(n => isValidCoord(n.latitude, n.longitude))
              .map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);

            if (altPositions.length < 2) return null;
            const altColor = idx === 0 ? '#a855f7' : '#f59e0b';

            return (
              <Polyline
                key={`alt-route-${alt.route_id || idx}`}
                positions={altPositions}
                pathOptions={{
                  color: altColor,
                  weight: 5,
                  opacity: 0.75,
                  dashArray: '8, 8',
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
                eventHandlers={{
                  click: () => onSelectAlternativeRoute && onSelectAlternativeRoute(alt)
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1">
                    <p className="font-bold text-purple-700">{alt.name || `Alternative Route ${idx + 1}`}</p>
                    <p className="text-[11px] text-slate-600">Distance: <strong>{alt.total_distance_meters}m</strong></p>
                    <p className="text-[11px] text-slate-600">Estimated Time: <strong>{alt.estimated_time_formatted}</strong></p>
                    <p className="text-[11px] text-slate-600">Risk: <strong>{alt.risk_level}</strong></p>
                    {onSelectAlternativeRoute && (
                      <button
                        onClick={() => onSelectAlternativeRoute(alt)}
                        className="w-full mt-1.5 py-1 px-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold"
                      >
                        Select Alternative
                      </button>
                    )}
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* 7. ACTIVE RECOMMENDED ROUTE */}
          {activeRoutePositions.length >= 2 && (
            <>
              <Polyline
                positions={activeRoutePositions}
                pathOptions={{
                  color: emergencyMode ? '#059669' : '#0284c7',
                  weight: 10,
                  opacity: 0.4,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
              <Polyline
                positions={activeRoutePositions}
                pathOptions={{
                  color: emergencyMode ? '#10b981' : '#38bdf8',
                  weight: 6,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1">
                    <p className="font-bold text-emerald-700">{activeRoute.name || 'Recommended Evacuation Route'}</p>
                    <p className="text-[11px] text-slate-600">Total Distance: <strong>{activeRoute.total_distance_meters}m</strong></p>
                    <p className="text-[11px] text-slate-600">Estimated Time: <strong>{activeRoute.estimated_time_formatted}</strong></p>
                    <p className="text-[11px] text-slate-600">Avg Congestion: <strong>{activeRoute.average_congestion}</strong></p>
                  </div>
                </Popup>
              </Polyline>
            </>
          )}

          {/* 8. ROUTE START & GOAL MARKERS */}
          {startNode && isValidCoord(startNode.latitude, startNode.longitude) && (
            <Marker
              position={[parseFloat(startNode.latitude), parseFloat(startNode.longitude)]}
              icon={createRouteStartIcon(startNode.name)}
            >
              <Popup>
                <div className="text-xs p-1 text-slate-800">
                  <p className="font-bold text-emerald-700">Origin Location</p>
                  <p className="text-slate-700 font-semibold">{startNode.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {destNode && isValidCoord(destNode.latitude, destNode.longitude) && (
            <Marker
              position={[parseFloat(destNode.latitude), parseFloat(destNode.longitude)]}
              icon={createRouteDestIcon(destNode.name)}
            >
              <Popup>
                <div className="text-xs p-1 text-slate-800">
                  <p className="font-bold text-red-700">Destination / Safe Exit</p>
                  <p className="text-slate-700 font-semibold">{destNode.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 9. JUNCTION NODES */}
          {showNodes && (nodes || []).filter(n => n && n.node_type === 'JUNCTION').map((node) => {
            if (!isValidCoord(node.latitude, node.longitude)) return null;

            return (
              <CircleMarker
                key={`node-${node.id}`}
                center={[parseFloat(node.latitude), parseFloat(node.longitude)]}
                radius={5}
                pathOptions={{
                  color: '#38bdf8',
                  fillColor: '#0284c7',
                  fillOpacity: 0.9,
                  weight: 1.5
                }}
                eventHandlers={{
                  click: () => onSelectLocation({ type: 'NODE', ...node })
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800">
                    <p className="font-bold text-blue-700">Junction #{node.id}</p>
                    <p className="text-slate-600">{node.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* 10. BUILDINGS */}
          {showBuildings && (buildings || []).map((building) => {
            if (!building || !isValidCoord(building.latitude, building.longitude)) return null;

            const isSelected = selectedLocation?.id === building.id && selectedLocation?.type === 'BUILDING';
            const liveCrowd = crowdMap[building.id];
            const predCrowd = predMap[building.id];
            const activeCrowd = isPredictionMode ? (predCrowd || liveCrowd) : liveCrowd;
            const isEpicenter = emergencyEpicenter && (
              emergencyEpicenter.building_id === building.id ||
              (Math.abs(parseFloat(emergencyEpicenter.latitude) - parseFloat(building.latitude)) < 0.0001 &&
               Math.abs(parseFloat(emergencyEpicenter.longitude) - parseFloat(building.longitude)) < 0.0001)
            );

            return (
              <Marker
                key={`building-${building.id}`}
                position={[parseFloat(building.latitude), parseFloat(building.longitude)]}
                icon={createBuildingIcon(building.type, building.building_code, isSelected, activeCrowd, isEpicenter)}
                eventHandlers={{
                  click: () => onSelectLocation({ type: 'BUILDING', ...building, crowd: activeCrowd, pred: predCrowd })
                }}
              >
                <Popup>
                  <div className="text-xs p-1.5 text-slate-800 space-y-2 min-w-[230px]">
                    <div className="flex items-center justify-between border-b pb-1">
                      <div>
                        <span className="font-bold text-slate-900 block leading-tight">
                          {isEpicenter ? '🚨 ' : ''}{building.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{building.building_code} · {building.type}</span>
                      </div>
                      {isEpicenter && (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">
                          EPICENTER
                        </span>
                      )}
                    </div>

                    {/* Live & Predicted metrics box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          {isPredictionMode ? `Predicted (+${predictionHorizon}h):` : 'Live Status:'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          (activeCrowd?.congestion_level === 'CRITICAL') ? 'bg-red-100 text-red-700 font-black' :
                          (activeCrowd?.congestion_level === 'HIGH') ? 'bg-amber-100 text-amber-700' :
                          (activeCrowd?.congestion_level === 'MEDIUM') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {activeCrowd?.congestion_level || 'LOW'} ({isPredictionMode ? (activeCrowd?.predicted_density ?? 0) : (activeCrowd?.density_percentage ?? 0)}%)
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            activeCrowd?.congestion_level === 'CRITICAL' ? 'bg-red-600' :
                            activeCrowd?.congestion_level === 'HIGH' ? 'bg-amber-500' :
                            activeCrowd?.congestion_level === 'MEDIUM' ? 'bg-yellow-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, isPredictionMode ? (activeCrowd?.predicted_density ?? 0) : (activeCrowd?.density_percentage ?? 0))}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>
                          {isPredictionMode ? 'Predicted:' : 'Current:'} <strong>{isPredictionMode ? (activeCrowd?.predicted_crowd ?? 0) : (activeCrowd?.crowd_count ?? 0)}</strong>
                        </span>
                        <span>Capacity: <strong>{building.capacity}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectLocation({ type: 'BUILDING', ...building, crowd: activeCrowd, pred: predCrowd })}
                      className="w-full py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors"
                    >
                      Select Facility
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* 11. EMERGENCY EXITS */}
          {showExits && (exits || []).map((exit) => {
            if (!exit || !isValidCoord(exit.latitude, exit.longitude)) return null;
            const isSelected = selectedLocation?.id === exit.id && selectedLocation?.type === 'EXIT';
            const isDisabled = disabledExitSet.has(exit.id);

            return (
              <Marker
                key={`exit-${exit.id}`}
                position={[parseFloat(exit.latitude), parseFloat(exit.longitude)]}
                icon={createExitIcon(exit.status, isSelected, isDisabled)}
                eventHandlers={{
                  click: () => onSelectLocation({ type: 'EXIT', ...exit })
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 space-y-1.5 min-w-[190px]">
                    <div className="font-bold border-b pb-1 flex items-center justify-between">
                      <span>{exit.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        (exit.status === 'ACTIVE' && !isDisabled) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isDisabled ? 'DISABLED' : exit.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p><strong>Throughput:</strong> {exit.capacity} people/min</p>
                      <p><strong>Connected Node:</strong> {exit.node_name || `Node ${exit.node_id}`}</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map Legend Overlay */}
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3 text-[11px] text-slate-300 z-[1000] shadow-xl space-y-1.5 pointer-events-auto">
          <p className="font-bold text-white text-xs border-b border-slate-700 pb-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            {emergencyMode ? 'Emergency Legend' : (activeRoute ? 'Active Route Legend' : (isPredictionMode ? `Predicted (+${predictionHorizon}h) Legend` : 'Density Legend'))}
          </p>
          {emergencyMode ? (
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <span>🚨 Hazard Epicenter</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-emerald-400 rounded"></span>
                <span>Safe Evacuation Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-red-500 rounded border-dashed"></span>
                <span>Corridor Bottleneck / Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Open Safe Exit</span>
              </div>
            </div>
          ) : activeRoute ? (
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-sky-400 rounded"></span>
                <span>Recommended Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-purple-500 rounded border-dashed"></span>
                <span>Alternative Route 1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-amber-500 rounded border-dashed"></span>
                <span>Alternative Route 2</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-red-500 rounded border-dashed"></span>
                <span>Blocked Corridor</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>LOW (&lt;40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                <span>MEDIUM (41–70%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span>HIGH (71–90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span>CRITICAL (&gt;90%)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </MapErrorBoundary>
  );
};

export default CampusLeafletMap;
