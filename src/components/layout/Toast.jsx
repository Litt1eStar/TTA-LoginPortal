import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react';

export const Toast = () => {
  const { toast, toastUndo, handleUndo } = usePortal();

  if (!toast) return null;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#16182A',
        color: '#FFFFFF',
        padding: '12px 22px',
        borderRadius: '24px',
        boxShadow: '0 16px 36px rgba(22, 24, 42, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '14px',
        fontWeight: 500,
        maxWidth: '90vw'
      }}
    >
      <CheckCircle size={20} weight="fill" color="#2A9FF7" />
      <span>{toast}</span>

      {toastUndo && (
        <button
          onClick={handleUndo}
          style={{
            marginLeft: '8px',
            background: 'rgba(255, 255, 255, 0.16)',
            color: '#FF8D20',
            border: '1px solid rgba(255, 141, 32, 0.4)',
            padding: '4px 12px',
            borderRadius: '14px',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          <span>เลิกทำ</span>
        </button>
      )}
    </div>
  );
};
