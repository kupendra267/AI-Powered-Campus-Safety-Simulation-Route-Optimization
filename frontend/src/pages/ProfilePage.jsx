import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Shield, 
  CheckCircle, 
  LogOut, 
  Bell, 
  Compass, 
  MapPin, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

const ProfilePage = () => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Profile Main Card */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl space-y-6">
        {/* User Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/80">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${
              isAdmin 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{user?.name || 'User'}</h1>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isAdmin 
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
          }`}>
            {user?.role || 'STUDENT'}
          </span>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Details */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Account Information
            </h3>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Full Name</span>
                <span className="font-medium text-white">{user?.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Email Address</span>
                <span className="font-medium text-slate-200">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Access Role</span>
                <span className={`font-semibold ${isAdmin ? 'text-amber-400' : 'text-blue-400'}`}>{user?.role}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Account Status</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Active & Verified
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Notification Preferences */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              Campus Safety Settings
            </h3>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Default Routing Mode</span>
                <span className="text-white font-medium">Crowd-Aware Safe Route</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Emergency Broadcast Alerts</span>
                <span className="text-emerald-400 font-medium">Enabled (High Priority)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Live Congestion Updates</span>
                <span className="text-emerald-400 font-medium">Real-Time Influx</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Hazard Auto-Rerouting</span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Shortcuts */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Quick Navigation Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/map"
              className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/40 rounded-xl text-xs flex items-center justify-between text-slate-300 hover:text-white transition-all group"
            >
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                Campus Map
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/routes"
              className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-xs flex items-center justify-between text-slate-300 hover:text-white transition-all group"
            >
              <span className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                Route Finder
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/emergency"
              className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 hover:border-red-500/40 rounded-xl text-xs flex items-center justify-between text-slate-300 hover:text-white transition-all group"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Emergency Evac
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4 border-t border-slate-700/60">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
