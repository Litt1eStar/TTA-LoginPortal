import React from 'react';
import { statusMeta } from '../../utils/formatters';

// Same colours as the History table badges
export const StatusChip = ({ status }) => {
  const meta = statusMeta(status || 'not_started', null);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px',
      fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
      background: meta.badgeBg, color: meta.badgeColor, border: meta.badgeBorder
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dotColor }} />
      <span>{meta.label}</span>
    </span>
  );
};

// Compact cell for the matrix
const SHORT = { submitted: 'ส่งแล้ว', draft: 'ร่าง', not_started: '–' };

export const StatusCell = ({ status, onClick, title }) => {
  const meta = statusMeta(status || 'not_started', null);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: '100%', minWidth: '58px', padding: '6px 4px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
        background: meta.badgeBg, color: meta.badgeColor, border: meta.badgeBorder,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dotColor }} />
      {SHORT[status] || '–'}
    </button>
  );
};
