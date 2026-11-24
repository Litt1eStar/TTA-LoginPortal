import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react';

export const Toast = () => {
  const { toast, toastUndo, toastActionLabel, handleUndo } = usePortal();

  if (!toast) return null;

  return (
    <div
      key={toast}
      className="toast"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        zIndex: 9999,
        background: '#16182A',
        color: '#FFFFFF',
        padding: '12px 22px',
        borderRadius: '24px',
        boxShadow: '0 16px 36px rgba(22, 24, 42, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '15px',
        fontWeight: 500,
        maxWidth: '90vw'
      }}
    >
      <CheckCircle className="toast-icon" size={20} weight="fill" color="#2A9FF7" style={{ flexShrink: 0 }} />
      <span>{toast}</span>

      {toastUndo && (
        <button
          type="button"
          onClick={handleUndo}
          style={{
            marginLeft: '8px',
            background: 'rgba(255, 255, 255, 0.16)',
            color: '#FF8D20',
            border: '1px solid rgba(255, 141, 32, 0.4)',
            padding: '4px 12px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          {toastActionLabel
            ? <span>{toastActionLabel}</span>
            : <><ArrowCounterClockwise size={14} weight="bold" /><span>เลิกทำ</span></>}
        </button>
      )}
    </div>
  );
};
