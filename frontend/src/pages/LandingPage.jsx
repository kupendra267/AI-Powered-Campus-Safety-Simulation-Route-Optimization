import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Brain, Activity, Navigation, ArrowRight, Layers } from 'lucide-react';

const LandingPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            Campus Simulation, AI Forecasting & Emergency Optimization
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            AI-Powered Campus Safety <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Simulation & Route Optimization
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            An intelligent campus safety platform that models physical campus topology, predicts spatio-temporal crowd congestion using machine learning, and dynamically routes multi-agent evacuation during emergencies.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to={isAdmin ? "/admin/dashboard" : "/dashboard"}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 text-sm"
              >
                Go to {isAdmin ? "Admin Console" : "Student Portal"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 text-sm"
                >
                  Sign In to Platform
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors text-sm"
                >
                  Create Student Account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur hover:border-slate-600 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Campus Topology Graph</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Interactive Leaflet map modeling 12+ buildings, 25+ junctions, corridors, and emergency exits with real coordinates.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur hover:border-slate-600 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">ML Crowd Forecasting</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Random Forest and Gradient Boosting models predicting hourly congestion levels across zones with high R² accuracy.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur hover:border-slate-600 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <Navigation className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Dynamic Route Optimizer</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Multi-objective Dijkstra & A* routing balancing physical distance, live crowd impedance, and hazard risk avoidance.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur hover:border-slate-600 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Evacuation Simulation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Discrete flow simulation modeling multi-exit load balancing, chokepoint detection, and comparative What-If scenarios.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        AI-Powered Campus Simulation & Safety Platform
      </footer>
    </div>
  );
};

export default LandingPage;
