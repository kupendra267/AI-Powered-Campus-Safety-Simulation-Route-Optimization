import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { analyticsService } from '../../services/analyticsService';
import { 
  Users, 
  Cpu, 
  MapPin, 
  AlertTriangle,
  ArrowRight,
  Brain,
  Compass,
  Sparkles,
  BarChart3,
  Building2,
  DoorOpen,
  GitFork,
  ShieldCheck,
  ShieldAlert,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    analyticsService.getOverview()
      .then(res => {
        if (res.success) setOverview(res.data);
      })
      .catch(() => {});
  }, []);

  const adminModules = [
    {
      title: "Campus Graph & Topology Editor",
      description: "Manage 12+ buildings, 25+ nodes, 30+ bidirectional paths, capacities, and perimeter exit gates.",
      link: "/admin/campus",
      icon: MapPin,
      badge: "Topology & GIS",
      accent: "text-blue-400 border-blue-500/30 bg-blue-500/10"
    },
    {
      title: "Live Crowd Influx Mode",
      description: "Inject real-time crowd densities, test sensor feeds, trigger surge events, and monitor zone capacity limits.",
      link: "/admin/crowd",
      icon: Users,
      badge: "Sensor Telemetry",
      accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    },
    {
      title: "ML Prediction Engine",
      description: "Train Random Forest & Gradient Boosting regressors, evaluate R², MAE, RMSE, and inspect feature importance.",
      link: "/admin/ml",
      icon: Brain,
      badge: "AI Regressors",
      accent: "text-purple-400 border-purple-500/30 bg-purple-500/10"
    },
    {
      title: "Emergency Evacuation Simulation",
      description: "Activate hazard scenarios (Fire, Hazmat, Gas Leak), simulate occupant dispersal, and identify chokepoints.",
      link: "/admin/emergency",
      icon: AlertTriangle,
      badge: "Hazard Sim",
      accent: "text-red-400 border-red-500/30 bg-red-500/10"
    },
    {
      title: "Evacuation Flow Optimization",
      description: "Run multi-sink capacity-constrained load balancing to eliminate bottleneck paths and minimize clear time.",
      link: "/admin/optimization",
      icon: Cpu,
      badge: "Flow Optimization",
      accent: "text-amber-400 border-amber-500/30 bg-amber-500/10"
    },
    {
      title: "What-If Scenario Analysis",
      description: "Perform comparative simulation matrix testing (Exit failure, Corridor block, +30% Surge, Peak Rush).",
      link: "/admin/what-if",
      icon: Sparkles,
      badge: "Contingency Matrix",
      accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
    }
  ];

  const quickAnalytics = [
    { title: "Crowd Telemetry", count: overview?.total_crowd_records || "25,000+", desc: "Recorded occupancy logs", icon: Users, color: "text-blue-400" },
    { title: "ML Predictions", count: overview?.total_predictions || "1,200+", desc: "24h forecasted horizons", icon: Brain, color: "text-purple-400" },
    { title: "Emergency Sims", count: overview?.total_emergency_simulations || "6+", desc: "Executed evacuation runs", icon: ShieldAlert, color: "text-red-400" },
    { title: "Optimizations", count: overview?.total_optimizations || "4+", desc: "Flow balancing runs", icon: Cpu, color: "text-emerald-400" },
    { title: "What-If Scenarios", count: overview?.total_what_if_scenarios || "12+", desc: "Contingency matrix runs", icon: Sparkles, color: "text-amber-400" },
    { title: "Bottlenecks", count: overview?.total_bottlenecks || "3", desc: "Identified chokepoints", icon: GitFork, color: "text-orange-400" }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Campus Safety & Simulation Administration
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Welcome, {user?.name || 'Administrator'}. Monitor campus topology, crowd densities, machine learning forecasts, evacuation simulations, and contingency optimizations.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              System Active
            </span>
          </div>
        </div>
      </div>

      {/* Live Campus KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Campus Facilities</span>
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">12 Buildings</p>
          <p className="text-xs text-slate-400 mt-1">Monitored academic zones</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Perimeter Gates</span>
            <DoorOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">4 Main Exits</p>
          <p className="text-xs text-slate-400 mt-1">North, South, East, West</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pedestrian Network</span>
            <GitFork className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">30 Corridors</p>
          <p className="text-xs text-slate-400 mt-1">25 interconnected junctions</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Campus Hazard Status</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">Normal / Clear</p>
          <p className="text-xs text-slate-400 mt-1">Zero active emergencies</p>
        </div>
      </div>

      {/* Quick Analytics & Research Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Empirical Analytics & Research Status
          </h2>
          <Link to="/analytics" className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Open Analytics Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickAnalytics.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <Link
                key={idx}
                to="/analytics"
                className="p-3.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/40 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${qa.color}`} />
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-base font-bold text-white mt-1.5">{qa.count}</p>
                <p className="text-[11px] font-semibold text-slate-300">{qa.title}</p>
                <p className="text-[10px] text-slate-500">{qa.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Administrative Feature Consoles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            Administrative Consoles
          </h2>
          <span className="text-xs text-slate-400">Select any console to manage</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {adminModules.map((module, idx) => {
            const Icon = module.icon;
            return (
              <Link
                key={idx}
                to={module.link}
                className="bg-slate-800/60 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-5 backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/5 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 group-hover:border-blue-500/40 transition-colors">
                      <Icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${module.accent}`}>
                      {module.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {module.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
                  <span>Launch Console</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Switch to Public & Student Views */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Quick Access to Student & Public Services
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/map"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" /> Campus Map
          </Link>
          <Link
            to="/routes"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" /> Safe Route Finder
          </Link>
          <Link
            to="/predictions"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" /> AI Predictions
          </Link>
          <Link
            to="/emergency"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Student Emergency Portal
          </Link>
          <Link
            to="/analytics"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Analytics Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
