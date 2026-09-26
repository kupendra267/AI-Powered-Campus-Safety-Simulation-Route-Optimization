import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 backdrop-blur text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-slate-700/50 border border-slate-600 flex items-center justify-center text-slate-400 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded border border-slate-600">
            HTTP 404 NOT FOUND
          </span>
          <h2 className="text-2xl font-bold text-white mt-3">Page Not Found</h2>
          <p className="text-sm text-slate-400 mt-2">
            The page you are looking for does not exist on the campus platform.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-all shadow-md"
        >
          <Home className="w-4 h-4" />
          Return Home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
