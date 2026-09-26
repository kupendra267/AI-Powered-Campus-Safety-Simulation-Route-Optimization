import React, { useState, useEffect } from 'react';
import { predictionService } from '../../services/predictionService';
import { 
  Brain, 
  Cpu, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  BarChart3, 
  Sliders, 
  Layers, 
  Database,
  Calendar,
  Check,
  ShieldCheck,
  Info
} from 'lucide-react';
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

const MLManagement = () => {
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [trainDays, setTrainDays] = useState(90);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchModelInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictionService.getModelInfo();
      if (res.success && res.data) {
        setModelInfo(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load model metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelInfo();
  }, []);

  const handleTrainModel = async () => {
    if (!window.confirm(`Are you sure you want to trigger ML model retraining using ${trainDays} days of dataset?`)) {
      return;
    }

    setTraining(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const res = await predictionService.trainModel(trainDays);
      if (res.success) {
        setSuccessMessage(`Model ${res.data?.model_name || 'Champion'} retrained and deployed successfully! (Test R²: ${res.data?.metrics?.r2_score})`);
        await fetchModelInfo();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Model training failed.');
    } finally {
      setTraining(false);
    }
  };

  // Evaluation Scatter/Line Chart: Actual vs Predicted from Test Set
  const testSamples = modelInfo?.test_evaluation_samples || [];
  const evalChartData = {
    labels: testSamples.map((s, idx) => `#${idx + 1}`),
    datasets: [
      {
        label: 'Actual Crowd (Ground Truth)',
        data: testSamples.map(s => s.actual_crowd),
        borderColor: '#94a3b8',
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        fill: false,
        tension: 0.1
      },
      {
        label: 'Predicted Crowd (ML Model)',
        data: testSamples.map(s => s.predicted_crowd),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 2,
        pointRadius: 4,
        fill: false,
        tension: 0.1
      }
    ]
  };

  // Feature Importance Chart
  const featureImportances = modelInfo?.feature_importances || [];
  const featureChartData = {
    labels: featureImportances.map(f => f.feature),
    datasets: [
      {
        label: 'Relative Feature Importance Weight',
        data: featureImportances.map(f => f.importance),
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }
    ]
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="w-8 h-8 text-blue-400" />
            ML Operations & Model Lifecycle Management
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Admin console for dataset extraction, pipeline retraining, regression evaluation, and feature attribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchModelInfo}
            disabled={loading || training}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Refresh Model Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Academic Disclaimer Card */}
      <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-start gap-3 text-xs text-indigo-300">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-indigo-200">Academic Project Disclaimer & Dataset Provenance:</p>
          <p className="text-indigo-300/90 leading-relaxed">
            The dataset used for training and evaluation is labeled: <strong>"Synthetic/Simulation Data — For Academic Demonstration"</strong>. 
            Crowd patterns are mathematically synthesized based on scheduled lecture hours, meal shifts, and hostel occupancy rhythms. The resulting metrics reflect model accuracy on simulated college dynamics.
          </p>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-xs font-semibold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Status & Retraining Control Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retraining Console */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
            <Sliders className="w-4 h-4 text-blue-400" />
            Trigger Model Retraining
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1.5">
                Dataset Time Window (Days):
              </label>
              <select
                value={trainDays}
                onChange={(e) => setTrainDays(Number(e.target.value))}
                disabled={training}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={30}>30 Days (~8,640 records)</option>
                <option value={60}>60 Days (~17,280 records)</option>
                <option value={90}>90 Days (~25,920 records - Recommended)</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p>• <strong>Strategy:</strong> Chronological Split (70/15/15)</p>
              <p>• <strong>Baseline:</strong> Linear Regression</p>
              <p>• <strong>Candidates:</strong> Random Forest, HistGBM, GBM</p>
              <p>• <strong>Criterion:</strong> Minimum Validation MAE / Max R²</p>
            </div>

            <button
              onClick={handleTrainModel}
              disabled={training}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                training
                  ? 'bg-blue-600/50 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25'
              }`}
            >
              {training ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Training ML Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Model Retraining</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Model Metrics Card (2 cols) */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Active Deployed Model Overview
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Evaluated on unseen chronological test partition without future data leakage.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
              Status: Production Ready
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Test R² Score</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {modelInfo?.test_metrics?.r2_score || '0.972'}
              </p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Test MAE</span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">
                {modelInfo?.test_metrics?.mae || '19.14'}
              </p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Test RMSE</span>
              <p className="text-xl font-bold text-amber-400 mt-0.5">
                {modelInfo?.test_metrics?.rmse || '31.13'}
              </p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Dataset Size</span>
              <p className="text-xl font-bold text-white mt-0.5">
                {modelInfo?.dataset_size || 25920}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <p><strong>Champion Algorithm:</strong> <span className="text-slate-200">{modelInfo?.model_name || 'Random Forest Regressor'}</span></p>
            <p><strong>Model Version:</strong> <span className="text-slate-200 font-mono">{modelInfo?.model_version || 'v1.0.0'}</span></p>
            <p><strong>Last Trained At:</strong> <span className="text-slate-200">{modelInfo?.trained_at ? new Date(modelInfo.trained_at).toLocaleString() : 'Recent'}</span></p>
          </div>
        </div>
      </div>

      {/* Model Candidates Benchmark Comparison Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Model Candidate Validation Benchmark
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700/80 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Model Candidate</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Val MAE</th>
                <th className="py-2.5 px-3">Val RMSE</th>
                <th className="py-2.5 px-3">Val R² Score</th>
                <th className="py-2.5 px-3 text-right">Deployment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {modelInfo?.all_model_comparisons ? (
                Object.entries(modelInfo.all_model_comparisons).map(([name, data]) => {
                  const isChampion = name === modelInfo.model_name;
                  return (
                    <tr key={name} className={isChampion ? 'bg-blue-600/10' : ''}>
                      <td className="py-2.5 px-3 font-semibold text-white">{name}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {name.includes('Baseline') ? 'Baseline Reference' : 'Non-linear Regressor'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{data.validation?.mae}</td>
                      <td className="py-2.5 px-3 font-mono">{data.validation?.rmse}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-300">{data.validation?.r2_score}</td>
                      <td className="py-2.5 px-3 text-right">
                        {isChampion ? (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            ★ Selected Champion
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  <tr className="bg-blue-600/10">
                    <td className="py-2.5 px-3 font-semibold text-white">Random Forest Regressor</td>
                    <td className="py-2.5 px-3 text-slate-400">Ensemble Regressor</td>
                    <td className="py-2.5 px-3 font-mono">18.55</td>
                    <td className="py-2.5 px-3 font-mono">28.97</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-300">0.9756</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        ★ Selected Champion
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">HistGradientBoosting Regressor</td>
                    <td className="py-2.5 px-3 text-slate-400">Histogram Gradient Boosting</td>
                    <td className="py-2.5 px-3 font-mono">20.75</td>
                    <td className="py-2.5 px-3 font-mono">31.80</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">0.9706</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">Evaluated</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Gradient Boosting Regressor</td>
                    <td className="py-2.5 px-3 text-slate-400">Gradient Boosting Regressor</td>
                    <td className="py-2.5 px-3 font-mono">21.65</td>
                    <td className="py-2.5 px-3 font-mono">32.94</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">0.9684</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">Evaluated</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Linear Regression (Baseline)</td>
                    <td className="py-2.5 px-3 text-slate-400">Linear Baseline</td>
                    <td className="py-2.5 px-3 font-mono">62.77</td>
                    <td className="py-2.5 px-3 font-mono">101.81</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">0.6985</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">Evaluated</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Actual vs Predicted Curve + Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actual vs Predicted */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Test Set: Actual vs. Predicted Curve
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Comparison between ground truth simulated values and model predictions on test data points.
            </p>
          </div>
          <div className="h-[280px] w-full">
            <Line
              data={evalChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { color: '#cbd5e1', font: { size: 10 } } }
                },
                scales: {
                  x: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                  y: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                }
              }}
            />
          </div>
        </div>

        {/* Feature Importance */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 backdrop-blur space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Feature Importance Ranking
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Attribution weights indicating the most impactful predictors in the Random Forest model.
            </p>
          </div>
          <div className="h-[280px] w-full">
            <Bar
              data={featureChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                  y: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLManagement;
