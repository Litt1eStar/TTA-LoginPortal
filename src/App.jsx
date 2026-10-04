import React from 'react';
import { usePortal } from './context/PortalContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { UrgentBanner } from './components/layout/UrgentBanner';
import { Toast } from './components/layout/Toast';
import { DashboardView } from './components/dashboard/DashboardView';
import { SubmitView } from './components/submit/SubmitView';
import { HistoryView } from './components/history/HistoryView';

export function AppContent() {
  const { isAuthenticated, currentView } = usePortal();

  if (!isAuthenticated) {
    return (
      <main>
        <LoginView />
        <Toast />
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UrgentBanner />
      <Navbar />

      <main style={{ flex: 1 }}>
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'submit' && <SubmitView />}
        {currentView === 'history' && <HistoryView />}
      </main>

      <Toast />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
