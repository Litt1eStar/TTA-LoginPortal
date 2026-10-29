import React from 'react';

// Shown while GET /api/me decides whether a session exists
export const FullPageLoader = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      background: '#F6F6F9',
      color: 'var(--text-muted)',
      fontSize: '15px'
    }}
  >
    <img
      src="/assets/ttaa13-logo.png"
      alt=""
      style={{ height: '48px', width: 'auto', animation: 'ttaa-pulse 1.4s ease-in-out infinite' }}
    />
    <span>กำลังโหลด…</span>
  </div>
);
