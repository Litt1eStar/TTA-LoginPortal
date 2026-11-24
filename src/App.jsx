import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { usePortal } from './context/PortalContext';
import { useSwapTransition } from './hooks/useSwapTransition';
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

const PAGE_GROUPS = {
  dashboard: 0,
  submit: 1,
  history: 2,
  certificates: 3
};

const pageGroupOf = (pathname = '') => {
  if (pathname.startsWith('/submit')) return 'submit';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/certificates')) return 'certificates';
  return 'dashboard';
};

// Redirect /submit to active track (e.g. /submit/theory)
function SubmitRedirect() {
  const { activeTrackId } = usePortal();
  return <Navigate to={`/submit/${activeTrackId || 'theory'}`} replace />;
}

// Coordinator routes: guard, layout & directional page-to-page transition
function ProtectedLayout() {
  const { isAuthenticated, user } = usePortal();
  const location = useLocation();
  const swap = useSwapTransition(location, {
    keyOf: (loc) => pageGroupOf(loc.pathname),
    orderOf: (loc) => PAGE_GROUPS[pageGroupOf(loc.pathname)] ?? 0,
    outMs: 125,
    onSwap: () => {
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {/* Brand-colour strip that runs under the navbar while the page swaps */}
      {swap.phase !== 'idle' && (
        <div key={pageGroupOf(location.pathname)} className="page-strip" aria-hidden="true" style={{ '--swap-dir': swap.dir }} />
      )}

      <main style={{ flex: 1, overflowX: 'clip' }}>
        <div
          key={swap.displayedKey}
          className={swap.className}
          style={{ ...swap.style, '--swap-in-ms': '260ms' }}
        >
          <Routes location={swap.displayed}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/submit" element={<SubmitRedirect />} />
            <Route path="/submit/:trackId" element={<SubmitView />} />
            <Route path="/submit/:trackId/:groupIdx" element={<SubmitView />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/certificates" element={<CertificatesView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
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
      <main style={{ flex: 1 }} className="swap-stage swap-in">
        <AdminView />
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
    <main className="swap-stage swap-in">
      <LoginView />
      <Toast />
    </main>
  );
}

export default function App() {
  const { isAuthenticated, loading, user } = usePortal();

  if (loading) return <FullPageLoader />;

  return (
    <Routes>
      {/* Login path: /login */}
      <Route path="/login" element={<PublicLoginRoute />} />

      {/* Admin path: /admin */}
      <Route path="/admin" element={<AdminLayout />} />

      {/* Coordinator routes (handles directional Out -> In page swaps) */}
      <Route
        path="/*"
        element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
