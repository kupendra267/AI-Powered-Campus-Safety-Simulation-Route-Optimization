import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronDown,
  LogOut,
  Shield
} from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;
  const isAdminActive = location.pathname.startsWith('/admin') && location.pathname !== '/admin/dashboard';

  return (
    <nav className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="bg-blue-600 p-2 rounded-xl shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                AI Campus <span className="text-blue-400 font-semibold">Safety</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">Simulation & Optimization</span>
            </div>
          </Link>

          {/* Clean Navigation Text Links (No Cluttered Icons) */}
          <div className="hidden md:flex items-center gap-1.5">
            {isAuthenticated ? (
              <>
                <Link
                  to={isAdmin ? "/admin/dashboard" : "/dashboard"}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive(isAdmin ? "/admin/dashboard" : "/dashboard")
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Dashboard
                </Link>

                <Link
                  to="/map"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive('/map')
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Campus Map
                </Link>

                <Link
                  to="/routes"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive('/routes')
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Route Finder
                </Link>

                <Link
                  to="/predictions"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive('/predictions')
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  AI Prediction
                </Link>

                <Link
                  to="/emergency"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive('/emergency')
                      ? "bg-red-600 text-white shadow-md shadow-red-600/25"
                      : "text-red-400 hover:text-white hover:bg-red-500/20"
                  }`}
                >
                  Emergency
                </Link>

                <Link
                  to="/analytics"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive('/analytics')
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Analytics
                </Link>

                {/* Admin Management Dropdown */}
                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors flex items-center gap-1 border ${
                        isAdminActive || adminDropdownOpen
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "border-slate-700 bg-slate-800/80 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                      }`}
                    >
                      Admin Suite
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>

                    {adminDropdownOpen && (
                      <div 
                        className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
                        onMouseLeave={() => setAdminDropdownOpen(false)}
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          Admin Consoles
                        </div>

                        <Link
                          to="/admin/campus"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/campus') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>Topology & Graph Editor</div>
                          <div className="text-[10px] text-slate-400 font-normal">Manage Nodes, Paths & Gates</div>
                        </Link>

                        <Link
                          to="/admin/crowd"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/crowd') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>Live Crowd Influx Mode</div>
                          <div className="text-[10px] text-slate-400 font-normal">Real-Time Density Simulator</div>
                        </Link>

                        <Link
                          to="/admin/ml"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/ml') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>ML Prediction Engine</div>
                          <div className="text-[10px] text-slate-400 font-normal">Train & Evaluate Regressors</div>
                        </Link>

                        <Link
                          to="/admin/emergency"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/emergency') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>Emergency Evacuation Sim</div>
                          <div className="text-[10px] text-slate-400 font-normal">Discrete Evacuation Modeling</div>
                        </Link>

                        <Link
                          to="/admin/optimization"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/optimization') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>Evacuation Optimization</div>
                          <div className="text-[10px] text-slate-400 font-normal">Capacity Flow Balancing</div>
                        </Link>

                        <Link
                          to="/admin/what-if"
                          onClick={() => setAdminDropdownOpen(false)}
                          className={`flex flex-col px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isActive('/admin/what-if') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>What-If Scenario Analysis</div>
                          <div className="text-[10px] text-slate-400 font-normal">Contingency Matrix Testing</div>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/') ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Overview
                </Link>
              </>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/profile"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    isActive('/profile')
                      ? 'bg-slate-800 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300 font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="leading-none text-slate-200 text-xs font-semibold">{user?.name}</p>
                    <span className={`text-[10px] font-mono font-bold ${isAdmin ? 'text-amber-400' : 'text-blue-400'}`}>
                      {user?.role}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl border border-red-500/30 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-500/20 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
