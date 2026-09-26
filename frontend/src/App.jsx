import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Common Components
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import CampusMapPage from './pages/CampusMapPage';
import RouteFinderPage from './pages/RouteFinderPage';
import CampusManagement from './pages/admin/CampusManagement';
import CrowdAnalyticsPage from './pages/CrowdAnalyticsPage';
import CrowdPredictionPage from './pages/CrowdPredictionPage';
import CrowdManagement from './pages/admin/CrowdManagement';
import MLManagement from './pages/admin/MLManagement';
import EmergencyManagement from './pages/admin/EmergencyManagement';
import OptimizationDashboard from './pages/admin/OptimizationDashboard';
import WhatIfAnalysis from './pages/admin/WhatIfAnalysis';
import StudentEmergencyPage from './pages/StudentEmergencyPage';
import ProfilePage from './pages/ProfilePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected Student / User Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/map"
                element={
                  <ProtectedRoute>
                    <CampusMapPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/routes"
                element={
                  <ProtectedRoute>
                    <RouteFinderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/predictions"
                element={
                  <ProtectedRoute>
                    <CrowdPredictionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <CrowdAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/emergency"
                element={
                  <ProtectedRoute>
                    <StudentEmergencyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/campus"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <CampusManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/crowd"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <CrowdManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ml"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <MLManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/emergency"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <EmergencyManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/optimization"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <OptimizationDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/what-if"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <WhatIfAnalysis />
                  </ProtectedRoute>
                }
              />

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
