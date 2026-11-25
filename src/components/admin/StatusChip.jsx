import React from 'react';
import { CheckCircle, PencilSimpleLine, WarningCircle } from '@phosphor-icons/react';
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

// A draft the coordinator still has to finish: a failed requirement or a missing photo
export const isIncompleteDraft = (status, summary) =>
  status === 'draft' && !!summary && (!summary.ready || summary.missingPhotoCount > 0);

const CELL_LABEL = { submitted: 'ส่งแล้ว', draft: 'ฉบับร่าง', not_started: 'ยังไม่เริ่ม' };

// One cell of the admin ledger: status by fill, a problem by icon, the number is people in the entry
export const StatusCell = ({ status, summary, onClick, title, dim = false }) => {
  const st = status || 'not_started';
  const count = summary?.memberCount || 0;
  const warn = isIncompleteDraft(st, summary);
  const problem = warn
    ? (summary.missingPhotoCount > 0 ? `ยังขาดรูปถ่าย ${summary.missingPhotoCount} คน` : summary.firstError)
    : '';
  const label = `${title}: ${warn ? 'ฉบับร่างที่ยังขาดข้อมูล' : CELL_LABEL[st]}${count ? `, ${count} คน` : ''}${problem ? `, ${problem}` : ''}`;
  const kind = warn ? 'warn' : st;
  return (
    <button
      type="button"
      onClick={onClick}
      title={problem ? `${title}
${problem}` : title}
      aria-label={label}
      className={`adm-cell adm-cell--${kind}${dim ? ' is-dim' : ''}`}
    >
      {st === 'submitted' && <CheckCircle size={14} weight="fill" aria-hidden="true" />}
      {st === 'draft' && !warn && <PencilSimpleLine size={14} weight="bold" aria-hidden="true" />}
      {warn && <WarningCircle size={14} weight="fill" aria-hidden="true" />}
      <span>{st === 'not_started' ? '–' : count}</span>
    </button>
  );
};
