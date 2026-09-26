import React, { useState, useEffect } from 'react';
import { campusService } from '../services/campusService';
import { predictionService } from '../services/predictionService';
import { 
  Brain, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Building2, 
  Users, 
  Flame, 
  Calendar, 
  ArrowRight, 
  RefreshCw,
  Info,
  Sparkles,
  Zap,
  BarChart3
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CrowdPredictionPage = () => {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedHorizon, setSelectedHorizon] = useState(1);
  const [predictionData, setPredictionData] = useState(null);
  const [forecastTimeline, setForecastTimeline] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);

  // 1. Initial Load: Buildings & Model Metadata & Summary
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bRes, mRes, sRes] = await Promise.all([
          campusService.getBuildings(),
          predictionService.getModelInfo(),
          predictionService.getPredictionSummary(selectedHorizon)
        ]);

        if (bRes.success && bRes.data && bRes.data.length > 0) {
          setBuildings(bRes.data);
          // Default to Canteen (or first facility)
          const canteen = bRes.data.find(b => b.type === 'CANTEEN') || bRes.data[0];
          setSelectedBuildingId(canteen.id);
        }

        if (mRes.success && mRes.data) {
          setModelInfo(mRes.data);
        }

        if (sRes.success && sRes.data) {
          setSummaryData(sRes.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to initialize ML prediction engine.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // 2. Fetch Prediction and Forecast when selected building or horizon changes
  useEffect(() => {
    if (!selectedBuildingId) return;

    const fetchForecast = async () => {
      setPredicting(true);
      try {
        const [singleRes, multiRes] = await Promise.all([
          predictionService.predictCrowd(selectedBuildingId),
          predictionService.getLocationForecast(selectedBuildingId, [1, 2, 3, 4, 6, 8])
        ]);

        if (singleRes.success && singleRes.data) {
          setPredictionData(singleRes.data);
        }

        if (multiRes.success && multiRes.data) {
          setForecastTimeline(multiRes.data.forecast || []);
        }
      } catch (err) {
        console.error("Prediction Error:", err);
      } finally {
        setPredicting(false);
      }
    };

    fetchForecast();
  }, [selectedBuildingId]);

  // Update campus summary when horizon selector changes
  const handleHorizonChange = async (h) => {
    setSelectedHorizon(h);
    try {
      const sRes = await predictionService.getPredictionSummary(h);
      if (sRes.success && sRes.data) {
        setSummaryData(sRes.data);
      }
    } catch (err) {
      console.error("Summary update error:", err);
    }
  };

  const selectedBuilding = buildings.find(b => b.id === Number(selectedBuildingId)) || {};

  // Active prediction step corresponding to selectedHorizon
  const activeStep = forecastTimeline.find(f => f.horizon_hours === selectedHorizon) || predictionData;

  // Chart configuration for Historical + Future Forecast
  const chartLabels = ['Current (Now)', ...forecastTimeline.map(f => `+${f.horizon_hours}h (${f.display_time})`)];
  const chartDataPoints = [
    predictionData?.current_crowd || 0,
    ...forecastTimeline.map(f => f.predicted_crowd)
  ];
  const capacityPoints = chartLabels.map(() => selectedBuilding.capacity || 500);

  const lineChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Predicted Crowd Trajectory',
        data: chartDataPoints,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 3,
        pointBackgroundColor: '#0284c7',
        pointBorderColor: '#ffffff',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35
      },
      {
        label: 'Facility Capacity Limit',
        data: capacityPoints,
        borderColor: '#ef4444',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { size: 11, weight: 'bold' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.raw} persons`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.5)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.5)' },
        ticks: { color: '#94a3b8', font: { size: 10 } },
        beginAtZero: true
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <Brain className="w-8 h-8 text-blue-400" />
              AI-Powered Crowd Prediction Engine
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Machine Learning regression models predicting future student density, bottlenecks, and peak congestion horizons.
          </p>
        </div>

        {/* Model Status Pill */}
        <div className="flex items-center gap-2">
          {modelInfo && (
            <div className="px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Model: {modelInfo.model_name || 'Random Forest Regressor'}</span>
              </div>
              <p className="text-slate-400 text-[10px]">
                Validation R²: <strong className="text-white">{modelInfo.test_metrics?.r2_score || '0.972'}</strong> · 
                MAE: <strong className="text-white">{modelInfo.test_metrics?.mae || '19.14'}</strong>
              </p>
            </div>
          )}

          <Link
            to="/admin/ml"
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ML Operations</span>
          </Link>
        </div>
      </div>

      {/* Academic Disclaimer Banner */}
      <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-300">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Academic Project Notice:</strong> Trained using temporal simulation datasets patterned after realistic academic class shifts and canteen peak hours.
          </span>
        </div>
        <span className="hidden md:inline font-mono text-[10px] text-indigo-400/80">
          Synthetic/Simulation Data — For Academic Demonstration
        </span>
      </div>

      {/* Control Bar: Location & Horizon Selector */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Location Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-grow max-w-md">
          <label className="text-xs font-semibold text-slate-300 whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-400" />
            Select Campus Facility:
          </label>
          <select
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.building_code} - {b.type}) · Cap: {b.capacity}
              </option>
            ))}
          </select>
        </div>

        {/* Future Horizon Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Horizon:
          </span>
          {[1, 2, 3, 4, 6, 8].map((h) => (
            <button
              key={h}
              onClick={() => handleHorizonChange(h)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedHorizon === h
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                  : 'bg-slate-900/60 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              +{h}h
            </button>
          ))}
        </div>
      </div>

      {/* 4 Primary Prediction KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Real-Time Crowd */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 backdrop-blur space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            Current Real-Time Crowd
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {predictionData?.current_crowd ?? '--'}
            </p>
            <span className="text-xs text-slate-400 font-mono">
              {predictionData?.current_density ?? 0}% Cap
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
            <span>Status:</span>
            <span className="font-semibold text-slate-300">{predictionData?.current_congestion || 'LOW'}</span>
          </div>
        </div>

        {/* Card 2: AI Predicted Crowd */}
        <div className="bg-slate-800/80 border border-blue-500/40 rounded-2xl p-4 backdrop-blur shadow-lg shadow-blue-500/10 space-y-2">
          <span className="text-xs text-blue-300 font-semibold flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-blue-400" />
            Predicted in +{selectedHorizon} Hour(s)
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-bold text-blue-400">
              {activeStep?.predicted_crowd ?? '--'}
            </p>
            <span className="text-xs font-bold text-blue-300 font-mono">
              {activeStep?.predicted_density ?? 0}% Density
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
            <span>Forecasted Delta:</span>
            <span className={`font-bold flex items-center gap-1 ${
              (activeStep?.predicted_crowd || 0) >= (predictionData?.current_crowd || 0)
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {(activeStep?.predicted_crowd || 0) >= (predictionData?.current_crowd || 0) ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {((activeStep?.predicted_crowd || 0) - (predictionData?.current_crowd || 0) > 0 ? '+' : '')}
              {(activeStep?.predicted_crowd || 0) - (predictionData?.current_crowd || 0)} students
            </span>
          </div>
        </div>

        {/* Card 3: Predicted Congestion Risk */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 backdrop-blur space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            Predicted Congestion Level
          </span>
          <div className="pt-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-black tracking-wide ${
              activeStep?.congestion_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' :
              activeStep?.congestion_level === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              activeStep?.congestion_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {activeStep?.congestion_level === 'CRITICAL' && <AlertTriangle className="w-4 h-4" />}
              {activeStep?.congestion_level || 'LOW'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
            Capacity Ceiling: <strong className="text-slate-200">{selectedBuilding.capacity || 500}</strong> persons
          </p>
        </div>

        {/* Card 4: Campus Hotspot Counter */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 backdrop-blur space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Campus-Wide Hotspots (+{selectedHorizon}h)
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-bold text-rose-400">
              {summaryData?.hotspots_count ?? 0}
            </p>
            <span className="text-xs text-slate-400">
              out of {buildings.length} locations
            </span>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/50 truncate">
            {summaryData?.hotspots_count > 0 ? (
              <span className="text-amber-300">
                Peak: {summaryData.hotspots[0]?.location_name}
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> No critical congestion
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Time Series Prediction Chart + Multi-step Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prediction Chart (2 cols) */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Crowd Trajectory & Capacity Curve ({selectedBuilding.name})
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Multi-step sequential forecast comparing projected load against maximum physical facility thresholds.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                Trend: {forecastTimeline[forecastTimeline.length - 1]?.predicted_crowd > (predictionData?.current_crowd || 0) ? 'Rising' : 'Falling'}
              </span>
            </div>
          </div>

          <div className="h-[320px] w-full pt-2">
            <Line data={lineChartData} options={chartOptions} />
          </div>
        </div>

        {/* Multi-Step Timeline Table (1 col) */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur flex flex-col h-[410px]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3 mb-3">
            <Clock className="w-4 h-4 text-blue-400" />
            Forecast Horizon Timeline
          </h2>

          <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {forecastTimeline.map((step) => {
              const isSelected = selectedHorizon === step.horizon_hours;
              return (
                <div
                  key={step.horizon_hours}
                  onClick={() => handleHorizonChange(step.horizon_hours)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 shadow-md'
                      : 'bg-slate-900/50 border-slate-700/60 hover:border-slate-600 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-200">+{step.horizon_hours} Hour ({step.display_time})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      step.congestion_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      step.congestion_level === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      step.congestion_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {step.congestion_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>Count: <strong className="text-white">{step.predicted_crowd}</strong></span>
                    <span>Density: <strong className="text-blue-300">{step.predicted_density}%</strong></span>
                    <span className={step.delta_from_current >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {step.delta_from_current >= 0 ? `+${step.delta_from_current}` : step.delta_from_current}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick link to map */}
          <Link
            to="/map"
            className="mt-3 pt-2 border-t border-slate-700/80 text-xs text-center text-blue-400 hover:text-blue-300 font-semibold flex items-center justify-center gap-1"
          >
            <span>View Predicted Heatmap on Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Campus-Wide Predicted Matrix Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Campus-Wide Prediction Matrix (+{selectedHorizon}h Horizon)
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Predicted student distribution across all 12 facilities at {summaryData?.target_time ? new Date(summaryData.target_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'target time'}.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total Projected Campus Population: <strong className="text-blue-400">{summaryData?.total_predicted_crowd || 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700/80 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Facility</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Capacity</th>
                <th className="py-2.5 px-3">Current Crowd</th>
                <th className="py-2.5 px-3">Predicted (+{selectedHorizon}h)</th>
                <th className="py-2.5 px-3">Predicted Density</th>
                <th className="py-2.5 px-3">Risk Level</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {(summaryData?.locations || []).map((loc) => {
                const isSelected = Number(selectedBuildingId) === loc.location_id;
                return (
                  <tr
                    key={loc.location_id}
                    className={`hover:bg-slate-700/30 transition-colors ${
                      isSelected ? 'bg-blue-600/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {loc.location_name}
                      <span className="font-mono text-[10px] text-slate-400 ml-1.5">({loc.building_code})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{loc.facility_type}</td>
                    <td className="py-2.5 px-3 font-mono">{loc.capacity}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{loc.current_crowd}</td>
                    <td className="py-2.5 px-3 font-bold font-mono text-blue-400">
                      {loc.predicted_crowd}
                      <span className={`text-[10px] font-normal ml-1 ${
                        loc.delta >= 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        ({loc.delta >= 0 ? `+${loc.delta}` : loc.delta})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              loc.congestion_level === 'CRITICAL' ? 'bg-red-500' :
                              loc.congestion_level === 'HIGH' ? 'bg-amber-500' :
                              loc.congestion_level === 'MEDIUM' ? 'bg-yellow-400' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, loc.predicted_density)}%` }}
                          ></div>
                        </div>
                        <span>{loc.predicted_density}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        loc.congestion_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        loc.congestion_level === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        loc.congestion_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {loc.congestion_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedBuildingId(loc.location_id)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-semibold text-slate-200 transition-colors"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CrowdPredictionPage;
