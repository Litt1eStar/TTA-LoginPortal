import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { LockSimple, PencilSimple, CircleDashed } from '@phosphor-icons/react';

export const TrackSelector = () => {
  const { activeTrackId, setActiveTrackId, submissions } = usePortal();

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1px solid #ECECF1',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      overflowX: 'auto',
      boxShadow: '0 2px 8px rgba(27, 29, 41, 0.03)',
      scrollbarWidth: 'none',
      marginBottom: '28px'
    }}>
      {TRACKS.map(t => {
        const isActive = t.id === activeTrackId;
        const sub = submissions[t.id] || {};
        const isSubmitted = sub.status === 'submitted';
        const isDraft = sub.status === 'draft';

        return (
          <button
            key={t.id}
            onClick={() => setActiveTrackId(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: '14px',
              border: isActive ? '1.5px solid #FF5F1C' : '1.5px solid transparent',
              background: isActive ? '#FF5F1C' : '#FAFAFC',
              color: isActive ? '#FFFFFF' : '#1B1D29',
              fontSize: '13.5px',
              fontWeight: isActive ? 700 : 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: isActive ? '0 4px 12px rgba(255, 95, 28, 0.3)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <span>{t.th}</span>
            {isSubmitted ? (
              <LockSimple size={13} weight="bold" color={isActive ? '#FFFFFF' : '#0A65B0'} />
            ) : isDraft ? (
              <PencilSimple size={13} weight="bold" color={isActive ? '#FFFFFF' : '#D99A00'} />
            ) : (
              <CircleDashed size={13} weight="bold" color={isActive ? '#FFFFFF' : '#A3A6B4'} />
            )}
          </button>
        );
      })}
    </div>
  );
};
