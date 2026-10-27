import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { entryKey, SUBJECT_GROUP_HINTS } from '../../data/tracks';
import { LockSimple, PencilSimple, CircleDashed } from '@phosphor-icons/react';

const statusIcon = (status, active) => {
  const color = active ? '#FFFFFF' : undefined;
  if (status === 'submitted') return <LockSimple size={15} weight="bold" color={color || 'var(--blue-text)'} aria-label="ส่งแล้ว" />;
  if (status === 'draft') return <PencilSimple size={15} weight="bold" color={color || '#B07A00'} aria-label="ฉบับร่าง" />;
  return <CircleDashed size={15} weight="bold" color={color || '#8A8D9C'} aria-label="ยังไม่เริ่ม" />;
};

// Theory / practice: every กลุ่มสาขาวิชา is a sub-type with its own team and submit,
// always listed (blank until filled), the same way as the culture sub-types.
export const GroupBar = ({ track, activeGroup, onSelect }) => {
  const { submissions } = usePortal();
  const statusOf = (i) => submissions[entryKey(track.id, i)]?.status || 'not_started';
  const sent = track.subjectGroups.filter((g, i) => statusOf(i) === 'submitted').length;

  return (
    <div className="card" style={{ marginBottom: '24px', gap: '14px' }}>
      <h3 className="section-title" style={{ fontSize: 'var(--fs-lg)' }}>
        กลุ่มสาขาวิชา <span className="badge badge-orange">ส่งแล้ว {sent}/{track.subjectGroups.length}</span>
      </h3>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="tablist" aria-label="กลุ่มสาขาวิชา">
        {track.subjectGroups.map((group, i) => {
          const isActive = i === activeGroup;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={SUBJECT_GROUP_HINTS[i]}
              onClick={() => onSelect(i)}
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
              <span>{group}</span>
              {statusIcon(statusOf(i), isActive)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
