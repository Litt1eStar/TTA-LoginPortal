import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { usePortal } from './context/PortalContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { UrgentBanner } from './components/layout/UrgentBanner';
import { Toast } from './components/layout/Toast';
import { DashboardView } from './components/dashboard/DashboardView';
import { SubmitView } from './components/submit/SubmitView';
import { HistoryView } from './components/history/HistoryView';

// Protected Route Guard & Layout
function ProtectedLayout() {
  const { isAuthenticated } = usePortal();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UrgentBanner />
      <Navbar />

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <Toast />
    </div>
  );
}

// Public-only Route Guard (Login page)
function PublicLoginRoute() {
  const { isAuthenticated } = usePortal();
  const location = useLocation();

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return (
    <main>
      <LoginView />
      <Toast />
    </main>
  );
}

// Redirect /submit to active track (e.g. /submit/theory)
function SubmitRedirect() {
  const { activeTrackId } = usePortal();
  return <Navigate to={`/submit/${activeTrackId || 'theory'}`} replace />;
}

export default function App() {
  const { isAuthenticated } = usePortal();

  return (
    <Routes>
      {/* Login path: /login */}
      <Route path="/login" element={<PublicLoginRoute />} />

      {/* Authenticated routes */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/submit" element={<SubmitRedirect />} />
        <Route path="/submit/:trackId" element={<SubmitView />} />
        <Route path="/history" element={<HistoryView />} />
      </Route>

      {/* Fallback route */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}
