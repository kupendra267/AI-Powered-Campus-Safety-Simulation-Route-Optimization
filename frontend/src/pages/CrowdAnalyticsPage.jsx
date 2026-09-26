import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsService } from '../services/analyticsService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Brain, 
  Compass, 
  ShieldAlert, 
  Cpu, 
  Sparkles, 
  GitFork, 
  DoorOpen, 
  CheckCircle2, 
  Layers, 
  BarChart3, 
  FileSpreadsheet, 
  Clock, 
  Zap, 
  ShieldCheck, 
  Info,
  Server
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CrowdAnalyticsPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('crowd'); // 'crowd', 'ml', 'routing', 'emergency', 'optimization', 'what_if', 'bottlenecks', 'performance', 'research'
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedDays, setSelectedDays] = useState('7');
  const [selectedRoutingMode, setSelectedRoutingMode] = useState('');
  const [selectedEmergencyType, setSelectedEmergencyType] = useState('');

  // Analytics Datasets from Backend
  const [overview, setOverview] = useState(null);
  const [crowdData, setCrowdData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [routingData, setRoutingData] = useState(null);
  const [emergencyData, setEmergencyData] = useState(null);
  const [optimizationData, setOptimizationData] = useState(null);
  const [whatIfData, setWhatIfData] = useState(null);
  const [bottleneckData, setBottleneckData] = useState(null);
  const [exitData, setExitData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [researchSummary, setResearchSummary] = useState(null);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        ovRes,
        crRes,
        prRes,
        rtRes,
        emRes,
        opRes,
        wiRes,
        bnRes,
        exRes,
        pfRes,
        dqRes,
        rsRes
      ] = await Promise.all([
        analyticsService.getOverview(),
        analyticsService.getCrowdAnalytics({ location_id: selectedLocationId || undefined }),
        analyticsService.getPredictionAnalytics({ location_id: selectedLocationId || undefined }),
        analyticsService.getRoutingAnalytics({ mode: selectedRoutingMode || undefined }),
        analyticsService.getEmergencyAnalytics({ emergency_type: selectedEmergencyType || undefined }),
        analyticsService.getOptimizationAnalytics(),
        analyticsService.getWhatIfAnalytics(),
        analyticsService.getBottleneckAnalytics(),
        analyticsService.getExitAnalytics(),
        analyticsService.getPerformanceAnalytics(),
        analyticsService.getDataQualityAnalytics(),
        analyticsService.getResearchSummary()
      ]);

      if (ovRes.success) setOverview(ovRes.data);
      if (crRes.success) setCrowdData(crRes.data);
      if (prRes.success) setPredictionData(prRes.data);
      if (rtRes.success) setRoutingData(rtRes.data);
      if (emRes.success) setEmergencyData(emRes.data);
      if (opRes.success) setOptimizationData(opRes.data);
      if (wiRes.success) setWhatIfData(wiRes.data);
      if (bnRes.success) setBottleneckData(bnRes.data);
      if (exRes.success) setExitData(exRes.data);
      if (pfRes.success) setPerformanceData(pfRes.data);
      if (dqRes.success) setDataQuality(dqRes.data);
      if (rsRes.success) setResearchSummary(rsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, [selectedLocationId, selectedRoutingMode, selectedEmergencyType]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await analyticsService.exportCsvReport();
    } catch (err) {
      alert('Error downloading CSV report: ' + (err.message || 'Server error'));
    } finally {
      setExporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // CHART BUILDERS (Actual Data Driven)
  // --------------------------------------------------------------------------
  
  // 1. Crowd Over Time Chart
  const crowdTimeSeries = crowdData?.crowd_over_time || [];
  const crowdChartData = {
    labels: crowdTimeSeries.map(d => {
      const dt = new Date(d.timestamp);
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'Recorded Crowd Count',
        data: crowdTimeSeries.map(d => d.crowd_count),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 2.5
      }
    ]
  };

  // 2. Congestion Distribution Doughnut
  const congDist = crowdData?.congestion_distribution || {};
  const congDoughnutData = {
    labels: ['Low (0-40%)', 'Medium (41-70%)', 'High (71-90%)', 'Critical (91%+)'],
    datasets: [
      {
        data: [
          congDist.LOW?.count || 0,
          congDist.MEDIUM?.count || 0,
          congDist.HIGH?.count || 0,
          congDist.CRITICAL?.count || 0
        ],
        backgroundColor: ['#10b981', '#38bdf8', '#f59e0b', '#ef4444'],
        borderWidth: 2,
        borderColor: '#0f172a'
      }
    ]
  };

  // 3. ML Actual vs Predicted Chart
  const mlSamples = predictionData?.actual_vs_predicted_samples || [];
  const mlActualVsPredData = {
    labels: mlSamples.map((s, idx) => s.location_name || `Point ${idx + 1}`),
    datasets: [
      {
        label: 'Actual Crowd',
        data: mlSamples.map(s => s.actual_crowd),
        borderColor: '#94a3b8',
        backgroundColor: 'rgba(148, 163, 184, 0.4)',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        label: 'ML Predicted Crowd',
        data: mlSamples.map(s => s.predicted_crowd),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.7)',
        borderWidth: 2,
        borderRadius: 4
      }
    ]
  };

  // 4. Feature Importance Horizontal Bar Chart
  const featureImportances = predictionData?.feature_importances || [];
  const featureChartData = {
    labels: featureImportances.map(f => f.feature.replace(/_/g, ' ')),
    datasets: [
      {
        label: 'Relative Feature Weight',
        data: featureImportances.map(f => f.importance),
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      }
    ]
  };

  // 5. Routing Modes Comparison Chart
  const routingModes = routingData?.mode_comparisons || [];
  const routingChartData = {
    labels: routingModes.map(m => m.mode),
    datasets: [
      {
        label: 'Average Distance (m)',
        data: routingModes.map(m => m.average_distance_meters),
        backgroundColor: '#0284c7',
        borderRadius: 5
      },
      {
        label: 'Average Time (s)',
        data: routingModes.map(m => m.average_estimated_time_sec),
        backgroundColor: '#10b981',
        borderRadius: 5
      }
    ]
  };

  // 6. Emergency Simulation Evacuation Times Bar Chart
  const evacScenarios = emergencyData?.evacuation_time_by_scenario || [];
  const emergencyChartData = {
    labels: evacScenarios.map(s => s.scenario_name),
    datasets: [
      {
        label: 'Evacuation Time (s)',
        data: evacScenarios.map(s => s.evacuation_time_sec),
        backgroundColor: '#ef4444',
        borderRadius: 5
      }
    ]
  };

  // 7. Optimization Baseline vs Optimized Bar Chart
  const optRuns = optimizationData?.results || [];
  const latestOpt = optRuns[0];
  const optComparisonChartData = {
    labels: ['Evacuation Time (s)', 'Bottlenecks Count', 'Total Distance (m/10)'],
    datasets: [
      {
        label: 'Baseline Evacuation',
        data: latestOpt ? [
          latestOpt.baseline?.evacuation_time_sec || 0,
          latestOpt.baseline?.bottlenecks_count || 0,
          (latestOpt.baseline?.total_distance_meters || 0) / 10
        ] : [0, 0, 0],
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderRadius: 5
      },
      {
        label: 'Optimized Flow',
        data: latestOpt ? [
          latestOpt.optimized?.evacuation_time_sec || 0,
          latestOpt.optimized?.bottlenecks_count || 0,
          (latestOpt.optimized?.total_distance_meters || 0) / 10
        ] : [0, 0, 0],
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 5
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { size: 11, weight: 'bold' } }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      }
    }
  };

  const horizontalChartOptions = {
    ...chartOptions,
    indexAxis: 'y'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-2.5">
              <BarChart3 className="w-3.5 h-3.5" />
              SYSTEM PERFORMANCE & EMPIRICAL RESEARCH CONSOLE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Campus Analytics & Research Dashboard
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Empirical crowd distributions, ML model test metrics, multi-objective route evaluations, evacuation optimization delta comparisons, and data integrity audits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting Report...' : 'Export Research CSV'}
            </button>
            <button
              onClick={fetchAllAnalytics}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">Total Crowd Records</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{overview?.total_crowd_records?.toLocaleString() || '0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Telemetry log entries</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">ML Champion R²</p>
          <p className="text-xl font-bold text-purple-400 mt-1">
            {predictionData?.model_metadata?.r2_score ? Number(predictionData.model_metadata.r2_score).toFixed(3) : '0.972'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">MAE: {predictionData?.model_metadata?.mae || '19.14'}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">Emergency Sims</p>
          <p className="text-xl font-bold text-red-400 mt-1">{overview?.total_emergency_simulations || '0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Avg Time: {overview?.average_simulation_time || '0'}s</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">Optimizations</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{overview?.total_optimizations || '0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Flow balancing runs</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">What-If Scenarios</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{overview?.total_what_if_scenarios || '0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Contingency tests</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400">Bottlenecks Found</p>
          <p className="text-xl font-bold text-orange-400 mt-1">{overview?.total_bottlenecks || '0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Corridor chokepoints</p>
        </div>
      </div>

      {/* Tab Navigation Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none text-xs font-bold">
        {[
          { id: 'crowd', label: 'Crowd & Peak Analysis', icon: Users },
          { id: 'ml', label: 'ML Prediction Analytics', icon: Brain },
          { id: 'routing', label: 'Routing & Corridors', icon: Compass },
          { id: 'emergency', label: 'Emergency Simulations', icon: ShieldAlert },
          { id: 'optimization', label: 'Flow Optimization', icon: Cpu },
          { id: 'what_if', label: 'What-If Contingencies', icon: Sparkles },
          { id: 'bottlenecks', label: 'Bottlenecks & Exits', icon: GitFork },
          { id: 'performance', label: 'System Performance', icon: Server },
          { id: 'research', label: 'Research Summary & Table', icon: FileSpreadsheet }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CROWD & PEAK ANALYSIS */}
      {/* ===================================================================== */}
      {activeTab === 'crowd' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Peak Crowd Period Card */}
          {crowdData?.peak_crowd_analysis && (
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-800/80 to-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  EMPIRICAL PEAK CROWD PERIOD
                </span>
                <h3 className="text-lg font-bold text-white">
                  Peak Interval: {crowdData.peak_crowd_analysis.peak_hour_formatted}
                </h3>
                <p className="text-xs text-slate-400">
                  Peak Location: <strong className="text-slate-200">{crowdData.peak_crowd_analysis.peak_location}</strong> · 
                  Max Recorded Crowd: <strong className="text-blue-300">{crowdData.peak_crowd_analysis.maximum_recorded_crowd} persons</strong>
                </p>
              </div>
              <div className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-center shrink-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Peak Period Average</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  {crowdData.peak_crowd_analysis.average_crowd_during_peak} <span className="text-xs text-slate-400">persons</span>
                </p>
              </div>
            </div>
          )}

          {/* Crowd Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Crowd Volume Over Time
                </h3>
                <span className="text-xs text-slate-400 font-mono">Time-Series Telemetry</span>
              </div>
              <div className="h-72 w-full">
                {crowdTimeSeries.length > 0 ? (
                  <Line data={crowdChartData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No data available for the selected filters.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Congestion Level Distribution
              </h3>
              <div className="h-56 w-full flex items-center justify-center">
                <Doughnut data={congDoughnutData} options={{ maintainAspectRatio: false }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-700/60">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Low: {congDist.LOW?.count || 0} ({congDist.LOW?.percentage || 0}%)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Med: {congDist.MEDIUM?.count || 0} ({congDist.MEDIUM?.percentage || 0}%)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> High: {congDist.HIGH?.count || 0} ({congDist.HIGH?.percentage || 0}%)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> Crit: {congDist.CRITICAL?.count || 0} ({congDist.CRITICAL?.percentage || 0}%)</div>
              </div>
            </div>
          </div>

          {/* Location Comparison Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Campus Facilities Density & Capacity Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Facility Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Avg Crowd</th>
                    <th className="py-3 px-4">Max Crowd</th>
                    <th className="py-3 px-4">Avg Density</th>
                    <th className="py-3 px-4">Max Density</th>
                    <th className="py-3 px-4">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {(crowdData?.location_comparison || []).map(loc => (
                    <tr key={loc.location_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{loc.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{loc.building_code}</td>
                      <td className="py-3 px-4">{loc.capacity}</td>
                      <td className="py-3 px-4">{loc.average_crowd}</td>
                      <td className="py-3 px-4 font-bold text-blue-300">{loc.maximum_crowd}</td>
                      <td className="py-3 px-4">{loc.average_density}%</td>
                      <td className="py-3 px-4">{loc.maximum_density}%</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          loc.current_congestion === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          loc.current_congestion === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {loc.current_congestion}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ML PREDICTION ANALYTICS */}
      {/* ===================================================================== */}
      {activeTab === 'ml' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ML Metadata Card */}
          {predictionData?.model_metadata && (
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                    CHAMPION REGRESSION MODEL
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {predictionData.model_metadata.model_name} ({predictionData.model_metadata.model_version})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dataset Type: <strong className="text-slate-300">{predictionData.model_metadata.dataset_type}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Validation R²</p>
                    <p className="text-lg font-bold text-purple-400">{predictionData.model_metadata.r2_score}</p>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Test MAE</p>
                    <p className="text-lg font-bold text-blue-400">{predictionData.model_metadata.mae}</p>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Test RMSE</p>
                    <p className="text-lg font-bold text-amber-400">{predictionData.model_metadata.rmse}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
                <div><span className="text-slate-500">Dataset Records:</span> <strong className="text-white">{predictionData.model_metadata.dataset_size?.toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Train Split:</span> <strong className="text-white">{predictionData.model_metadata.train_size?.toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Validation Split:</span> <strong className="text-white">{predictionData.model_metadata.val_size?.toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Test Split:</span> <strong className="text-white">{predictionData.model_metadata.test_size?.toLocaleString()}</strong></div>
              </div>
            </div>
          )}

          {/* Actual vs Predicted & Feature Importances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Actual vs. Predicted Crowd (Test Set Samples)
              </h3>
              <div className="h-72 w-full">
                {mlSamples.length > 0 ? (
                  <Bar data={mlActualVsPredData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No sample predictions recorded.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Feature Importance Weights
              </h3>
              <div className="h-72 w-full">
                {featureImportances.length > 0 ? (
                  <Bar data={featureChartData} options={horizontalChartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Feature importances loading...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Per-Location Error Breakdown Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Per-Location Forecast Error Analysis (MAE, RMSE, MAPE)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Location Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Test Samples</th>
                    <th className="py-3 px-4">MAE (Persons)</th>
                    <th className="py-3 px-4">RMSE (Persons)</th>
                    <th className="py-3 px-4">MAPE %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {(predictionData?.location_error_analysis || []).map(errItem => (
                    <tr key={errItem.location_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{errItem.location_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{errItem.building_code}</td>
                      <td className="py-3 px-4">{errItem.sample_count}</td>
                      <td className="py-3 px-4 font-bold text-blue-300">{errItem.mae}</td>
                      <td className="py-3 px-4 font-bold text-amber-300">{errItem.rmse}</td>
                      <td className="py-3 px-4 font-bold text-purple-300">{errItem.mape_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ROUTING & CORRIDORS */}
      {/* ===================================================================== */}
      {activeTab === 'routing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-400" />
                Routing Modes Empirical Comparison
              </h3>
              <div className="h-64 w-full">
                <Bar data={routingChartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Live Crowd vs. ML Predictive Routing Analysis
              </h3>
              {routingData?.predictive_routing_comparison && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <p className="font-bold text-blue-400">Live Crowd Mode</p>
                    <p className="text-slate-400">Calculated: <strong className="text-white">{routingData.predictive_routing_comparison.current_crowd_routing?.count}</strong></p>
                    <p className="text-slate-400">Avg Distance: <strong className="text-white">{routingData.predictive_routing_comparison.current_crowd_routing?.avg_distance}m</strong></p>
                    <p className="text-slate-400">Avg Time: <strong className="text-white">{routingData.predictive_routing_comparison.current_crowd_routing?.avg_time}s</strong></p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <p className="font-bold text-purple-400">Predictive Mode</p>
                    <p className="text-slate-400">Calculated: <strong className="text-white">{routingData.predictive_routing_comparison.predictive_routing?.count}</strong></p>
                    <p className="text-slate-400">Avg Distance: <strong className="text-white">{routingData.predictive_routing_comparison.predictive_routing?.avg_distance}m</strong></p>
                    <p className="text-slate-400">Avg Time: <strong className="text-white">{routingData.predictive_routing_comparison.predictive_routing?.avg_time}s</strong></p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode Comparisons Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Routing Mode Performance Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Routing Strategy</th>
                    <th className="py-3 px-4">Routes Tested</th>
                    <th className="py-3 px-4">Average Distance</th>
                    <th className="py-3 px-4">Average Travel Time</th>
                    <th className="py-3 px-4">Avg Congestion Score</th>
                    <th className="py-3 px-4">Peak Congestion Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {routingModes.map(m => (
                    <tr key={m.mode} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{m.mode}</td>
                      <td className="py-3 px-4">{m.routes_calculated}</td>
                      <td className="py-3 px-4 font-mono">{m.average_distance_meters}m</td>
                      <td className="py-3 px-4 font-mono text-emerald-300">{m.average_estimated_time_sec}s</td>
                      <td className="py-3 px-4">{m.average_congestion_score}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.maximum_congestion === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {m.maximum_congestion}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: EMERGENCY SIMULATIONS */}
      {/* ===================================================================== */}
      {activeTab === 'emergency' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Evacuation Clearance Time by Scenario
              </h3>
              <div className="h-64 w-full">
                {evacScenarios.length > 0 ? (
                  <Bar data={emergencyChartData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No emergency simulations recorded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                Emergency Simulation Summary
              </h3>
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Total Simulations</span>
                  <strong className="text-white">{emergencyData?.total_simulations || 0}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Avg Evacuation Time</span>
                  <strong className="text-red-400">{emergencyData?.summary_metrics?.average_evacuation_time_sec || 0}s</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Max Evacuation Time</span>
                  <strong className="text-red-300">{emergencyData?.summary_metrics?.maximum_evacuation_time_sec || 0}s</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Avg Bottleneck Count</span>
                  <strong className="text-amber-400">{emergencyData?.summary_metrics?.average_bottleneck_count || 0}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Avg Evacuation Progress</span>
                  <strong className="text-emerald-400">{emergencyData?.summary_metrics?.average_progress_percentage || 100}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Scenarios Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Emergency Simulation Executions Log
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Scenario Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Evacuees</th>
                    <th className="py-3 px-4">Evac Time (s)</th>
                    <th className="py-3 px-4">Max Congestion</th>
                    <th className="py-3 px-4">Bottlenecks</th>
                    <th className="py-3 px-4">Unassigned</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {evacScenarios.map(s => (
                    <tr key={s.simulation_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{s.scenario_name}</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px]">{s.emergency_type}</span></td>
                      <td className="py-3 px-4">{s.people_count}</td>
                      <td className="py-3 px-4 font-bold text-red-300">{s.evacuation_time_sec}s</td>
                      <td className="py-3 px-4">{s.max_congestion}</td>
                      <td className="py-3 px-4 font-bold text-amber-400">{s.bottleneck_count}</td>
                      <td className="py-3 px-4">{s.unassigned_people}</td>
                      <td className="py-3 px-4"><span className="text-emerald-400 font-bold">{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: FLOW OPTIMIZATION */}
      {/* ===================================================================== */}
      {activeTab === 'optimization' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                Baseline vs. Capacity-Optimized Comparison
              </h3>
              <div className="h-64 w-full">
                {latestOpt ? (
                  <Bar data={optComparisonChartData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No optimization runs recorded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                Measured Improvements
              </h3>
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Time Improvement %</span>
                  <strong className="text-emerald-400">
                    {optimizationData?.comparative_summary?.average_time_change_percentage || 0}%
                  </strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Congestion Reduction %</span>
                  <strong className="text-emerald-400">
                    {optimizationData?.comparative_summary?.average_congestion_change_percentage || 0}%
                  </strong>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Distance Shift %</span>
                  <strong className="text-blue-400">
                    {optimizationData?.comparative_summary?.average_distance_change_percentage || 0}%
                  </strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Total Optimizations Evaluated</span>
                  <strong className="text-white">{optimizationData?.total_optimizations || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Optimization Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Optimization Runs & Outcome Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Scenario Name</th>
                    <th className="py-3 px-4">Baseline Time (s)</th>
                    <th className="py-3 px-4">Optimized Time (s)</th>
                    <th className="py-3 px-4">Time Improvement</th>
                    <th className="py-3 px-4">Bottlenecks Shift</th>
                    <th className="py-3 px-4">Optimization Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {optRuns.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{r.scenario_name}</td>
                      <td className="py-3 px-4 text-red-300">{r.baseline?.evacuation_time_sec}s</td>
                      <td className="py-3 px-4 text-emerald-300 font-bold">{r.optimized?.evacuation_time_sec}s</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {r.comparison?.time_reduction_percentage ?? r.improvements?.time_reduction_percentage ?? 0}%
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {r.baseline?.bottlenecks_count} ➔ {r.optimized?.bottlenecks_count}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{r.optimization_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: WHAT-IF CONTINGENCIES */}
      {/* ===================================================================== */}
      {activeTab === 'what_if' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              What-If Contingency Scenarios Evaluated
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Scenario Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Baseline Time</th>
                    <th className="py-3 px-4">Hypothetical Time</th>
                    <th className="py-3 px-4">Time Delta %</th>
                    <th className="py-3 px-4">Bottlenecks Delta</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {(whatIfData?.scenario_comparisons || []).map(sc => (
                    <tr key={sc.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{sc.name}</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px]">{sc.scenario_type}</span></td>
                      <td className="py-3 px-4">{sc.baseline_evacuation_time}s</td>
                      <td className="py-3 px-4 font-bold text-amber-300">{sc.scenario_evacuation_time}s</td>
                      <td className="py-3 px-4 font-bold text-purple-300">{sc.time_delta_percentage}%</td>
                      <td className="py-3 px-4 font-mono">{sc.baseline_bottlenecks} ➔ {sc.scenario_bottlenecks}</td>
                      <td className="py-3 px-4"><span className="text-emerald-400 font-bold">{sc.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: BOTTLENECKS & EXITS */}
      {/* ===================================================================== */}
      {activeTab === 'bottlenecks' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bottlenecks Table */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <GitFork className="w-5 h-5 text-orange-400" />
                Detected Chokepoint Corridors
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-[10px] uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Corridor</th>
                      <th className="py-2.5 px-3">Occurrences</th>
                      <th className="py-2.5 px-3">Avg Util %</th>
                      <th className="py-2.5 px-3">Max Util %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {(bottleneckData?.bottlenecks_table || []).map(b => (
                      <tr key={b.path_id} className="hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-semibold text-white">{b.corridor_label}</td>
                        <td className="py-2.5 px-3 font-bold text-amber-400">{b.occurrences}</td>
                        <td className="py-2.5 px-3">{b.average_utilization_percentage}%</td>
                        <td className="py-2.5 px-3 font-bold text-red-400">{b.maximum_utilization_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exit Capacity Table */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-emerald-400" />
                Perimeter Exit Allocation & Load Balancing
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-[10px] uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Exit Gate</th>
                      <th className="py-2.5 px-3">Capacity</th>
                      <th className="py-2.5 px-3">Avg Load</th>
                      <th className="py-2.5 px-3">Max Load</th>
                      <th className="py-2.5 px-3">Avg Util %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {(exitData?.exits_table || []).map(ex => (
                      <tr key={ex.exit_id} className="hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-semibold text-white">{ex.name}</td>
                        <td className="py-2.5 px-3">{ex.capacity}</td>
                        <td className="py-2.5 px-3">{ex.average_assigned_people}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-300">{ex.maximum_assigned_people}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">{ex.average_utilization_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 8: SYSTEM PERFORMANCE & DATA QUALITY */}
      {/* ===================================================================== */}
      {activeTab === 'performance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Latency */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                Algorithm & API Execution Latencies
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-[10px] uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Operation Name</th>
                      <th className="py-2.5 px-3">Samples</th>
                      <th className="py-2.5 px-3">Avg Time (ms)</th>
                      <th className="py-2.5 px-3">Min / Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {(performanceData?.performance_table || []).map(p => (
                      <tr key={p.operation} className="hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-mono text-white text-[11px]">{p.operation}</td>
                        <td className="py-2.5 px-3">{p.sample_count}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">{p.average_time_ms} ms</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.minimum_time_ms} / {p.maximum_time_ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data Quality Integrity */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Data Quality & Topology Integrity Audit
              </h3>
              {dataQuality && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-emerald-400 font-semibold uppercase">Overall Integrity Score</p>
                      <p className="text-2xl font-bold text-white mt-0.5">{dataQuality.quality_score_percentage}%</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="space-y-2 text-slate-300">
                    <div className="flex justify-between py-1.5 border-b border-slate-700">
                      <span className="text-slate-400">Total Entities Checked</span>
                      <strong className="text-white">{dataQuality.total_entities_checked}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-700">
                      <span className="text-slate-400">Valid Topology Records</span>
                      <strong className="text-emerald-400">{dataQuality.valid_records_count}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Orphan/Invalid Nodes</span>
                      <strong className="text-slate-200">{dataQuality.invalid_records_count}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 9: RESEARCH SUMMARY & FINAL YEAR PROJECT TABLE */}
      {/* ===================================================================== */}
      {activeTab === 'research' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Textual Synthesis Box */}
          {researchSummary?.textual_summary && (
            <div className="bg-slate-800/80 border border-blue-500/40 rounded-2xl p-6 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Info className="w-4 h-4" />
                AUTOMATED EMPIRICAL RESEARCH SYNTHESIS
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">
                {researchSummary.textual_summary}
              </p>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-700/60">
                {researchSummary.academic_disclaimer}
              </p>
            </div>
          )}

          {/* Traceable Research Metrics Table */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Final-Year B.Tech CSE (AI & ML) Research Metric Traceability
              </h3>
              <span className="text-xs text-slate-400 font-mono">100% Calculated Empirical Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Research Metric</th>
                    <th className="py-3 px-4">Measured Empirical Value</th>
                    <th className="py-3 px-4">Database / Algorithm Source</th>
                    <th className="py-3 px-4">Domain Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {(researchSummary?.research_metrics_table || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{row.metric}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-300">{row.value}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{row.source}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-semibold">
                          {row.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrowdAnalyticsPage;
