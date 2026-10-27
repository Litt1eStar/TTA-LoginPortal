import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { getTrackStatus } from '../../utils/entries';
import { LockSimple, PencilSimple, CircleDashed } from '@phosphor-icons/react';

const statusIcon = (status, active) => {
  const color = active ? '#FFFFFF' : undefined;
  if (status === 'submitted') return <LockSimple size={15} weight="bold" color={color || 'var(--blue-text)'} aria-label="ส่งแล้ว" />;
  if (status === 'draft') return <PencilSimple size={15} weight="bold" color={color || '#B07A00'} aria-label="ฉบับร่าง" />;
  return <CircleDashed size={15} weight="bold" color={color || '#8A8D9C'} aria-label="ยังไม่เริ่ม" />;
};

// For a type with sub-types (การแข่งขันศิลปวัฒนธรรม): switch between its sub-types.
// Each sub-type is its own submission with its own team rules.
export const SubTypeBar = ({ type, activeTrackId }) => {
  const navigate = useNavigate();
  const { submissions, setActiveTrackId } = usePortal();
  const sent = type.tracks.filter(t => getTrackStatus(t, submissions) === 'submitted').length;

  return (
    <div className="card" style={{ marginBottom: '24px', gap: '14px' }}>
      <h3 className="section-title" style={{ fontSize: 'var(--fs-lg)' }}>
        ประเภทย่อย <span className="badge badge-orange">ส่งแล้ว {sent}/{type.tracks.length}</span>
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="tablist" aria-label="ประเภทย่อย">
        {type.tracks.map(t => {
          const isActive = t.id === activeTrackId;
          const status = getTrackStatus(t, submissions);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTrackId(t.id);
                navigate(`/submit/${t.id}`);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '999px',
                border: isActive ? '1.5px solid var(--primary)' : '1.5px solid var(--border-light)',
                background: isActive ? 'var(--primary)' : '#FAFAFC',
                color: isActive ? '#FFFFFF' : 'var(--text-dark)',
                fontSize: '15px',
                fontWeight: isActive ? 700 : 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isActive ? '0 4px 12px rgba(255, 95, 28, 0.3)' : 'none'
              }}
            >
              <span>{t.full}</span>
              {statusIcon(status, isActive)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
