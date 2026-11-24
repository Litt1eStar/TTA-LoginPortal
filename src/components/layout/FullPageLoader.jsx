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
    <span aria-hidden="true" style={{ width: '140px', height: '4px', borderRadius: '999px', background: '#E6E7EE', overflow: 'hidden' }}>
      <span style={{
        display: 'block',
        width: '40%',
        height: '100%',
        borderRadius: 'inherit',
        background: 'linear-gradient(90deg, var(--primary), var(--amber))',
        animation: 'ttaa-loader-bar 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite'
      }} />
    </span>
    <span>กำลังโหลด…</span>
  </div>
);
