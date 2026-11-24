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

export const StatusCell = ({ status, summary, onClick, title }) => {
  const meta = statusMeta(status || 'not_started', null);
  const count = summary?.memberCount || 0;
  const warn = status === 'draft' && summary && (!summary.ready || summary.missingPhotoCount > 0);
  const hint = warn
    ? `${title}\n${summary.missingPhotoCount > 0 ? `ยังขาดรูปถ่าย ${summary.missingPhotoCount} คน` : summary.firstError}`
    : title;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      style={{
        width: '100%', minWidth: '64px', padding: '6px 5px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700,
        background: meta.badgeBg, color: meta.badgeColor, border: meta.badgeBorder,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        position: 'relative', whiteSpace: 'nowrap'
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: warn ? '#D92D20' : meta.dotColor, flexShrink: 0 }} />
      <span>{SHORT[status] || '–'}</span>
      {count > 0 && <span style={{ opacity: 0.78, fontSize: '11.5px', fontWeight: 700 }}>· {count}</span>}
    </button>
  );
};
