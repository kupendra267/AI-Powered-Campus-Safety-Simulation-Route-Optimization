import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldX, ArrowLeft, LayoutDashboard } from 'lucide-react';

const UnauthorizedPage = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 border border-red-500/30 rounded-2xl p-8 backdrop-blur text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
          <ShieldX className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
            HTTP 403 FORBIDDEN
          </span>
          <h2 className="text-2xl font-bold text-white mt-3">Access Restricted</h2>
          <p className="text-sm text-slate-400 mt-2">
            Your current account (<span className="text-blue-400 font-semibold">{user?.role || 'Guest'}</span>) does not have sufficient administrative privileges to view this resource.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Link
            to={isAdmin ? "/admin/dashboard" : "/dashboard"}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-all shadow-md"
          >
            <LayoutDashboard className="w-4 h-4" />
            Return to My Dashboard
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-all border border-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
