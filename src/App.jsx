import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { usePortal } from './context/PortalContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { Toast } from './components/layout/Toast';
import { FullPageLoader } from './components/layout/FullPageLoader';
import { DashboardView } from './components/dashboard/DashboardView';
import { SubmitView } from './components/submit/SubmitView';
import { HistoryView } from './components/history/HistoryView';
import { CertificatesView } from './components/certificates/CertificatesView';
import { AdminView } from './components/admin/AdminView';

const homeFor = (user) => (user?.role === 'admin' ? '/admin' : '/dashboard');

// Coordinator routes: guard & layout
function ProtectedLayout() {
  const { isAuthenticated, user } = usePortal();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <Toast />
    </div>
  );
}

// Admin routes: guard & layout
function AdminLayout() {
  const { isAuthenticated, user } = usePortal();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
  const { isAuthenticated, user } = usePortal();
  const location = useLocation();

  if (isAuthenticated) {
    const from = user.role === 'admin' ? '/admin' : (location.state?.from?.pathname || '/dashboard');
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
  const { isAuthenticated, loading, user } = usePortal();

  if (loading) return <FullPageLoader />;

  return (
    <Routes>
      {/* Login path: /login */}
      <Route path="/login" element={<PublicLoginRoute />} />

      {/* Coordinator routes */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/submit" element={<SubmitRedirect />} />
        <Route path="/submit/:trackId" element={<SubmitView />} />
        <Route path="/submit/:trackId/:groupIdx" element={<SubmitView />} />
        <Route path="/history" element={<HistoryView />} />
        <Route path="/certificates" element={<CertificatesView />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminView />} />
      </Route>

      {/* Fallback route */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? homeFor(user) : '/login'} replace />}
      />
    </Routes>
  );
}
