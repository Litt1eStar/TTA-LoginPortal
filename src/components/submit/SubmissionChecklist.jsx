import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { getTrack } from '../../data/tracks';
import { getRequirements } from '../../utils/requirements';
import { fmtDateTime } from '../../utils/formatters';
import {
  CheckCircle,
  Circle,
  FloppyDisk,
  PaperPlaneTilt,
  LockSimple,
  Receipt,
  Warning
} from '@phosphor-icons/react';

// Circular progress (SVG ring), sized for the readiness panel
const Ring = ({ value, total }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  const complete = value === total;
  return (
    <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#ECEDF3" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={complete ? 'var(--blue)' : 'var(--primary)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 42 42)"
          style={{ transition: 'stroke-dashoffset 0.6s var(--ease-out), stroke 0.3s' }}
        />
      </svg>
      <div className="num-xl" style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px'
      }}>
        {value}/{total}
      </div>
    </div>
  );
};

export const SubmissionChecklist = ({ trackId, onAttemptSubmit, isLocked, onSaveDraft }) => {
  const { submissions } = usePortal();
  const sub = submissions[trackId] || { members: [], files: [], links: {} };

  const criteria = getRequirements(getTrack(trackId), sub);
  const completed = criteria.filter(c => c.ok).length;
  const allDone = completed === criteria.length;

  const savedLabel = isLocked && sub.submittedAt
    ? `ส่งเมื่อ ${fmtDateTime(sub.submittedAt)}`
    : sub.draftAt
      ? `บันทึกร่างเมื่อ ${fmtDateTime(sub.draftAt)}`
      : 'ยังไม่ได้บันทึก';

  const jumpTo = (section) =>
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <aside className="ready-panel reveal" style={{ '--i': 1 }} aria-label="ความพร้อมในการส่ง">
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Ring value={completed} total={criteria.length} />
        <div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>ความพร้อมในการส่ง</h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--on-ink-muted)' }}>
            {allDone ? 'ครบแล้ว พร้อมส่ง' : `เหลืออีก ${criteria.length - completed} รายการ`}
          </p>
        </div>
      </div>

      {/* Checklist: each item jumps to its section */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {criteria.map((c) => (
          <li key={c.key}>
            <button type="button" className={`check-item ${c.ok ? 'ok' : ''}`} onClick={() => jumpTo(c.section)}>
              {c.ok
                ? <CheckCircle size={20} weight="fill" color="var(--blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                : <Circle size={20} color="#A0A3B1" style={{ flexShrink: 0, marginTop: '2px' }} />}
              <span>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Status */}
      <div style={{
        borderTop: '1px solid var(--ink-line)',
        paddingTop: '14px',
        fontSize: 'var(--fs-sm)',
        color: 'var(--on-ink-muted)'
      }}>
        <div>สถานะ: <strong style={{ color: 'var(--on-ink)' }}>{savedLabel}</strong></div>
        {sub.hash && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--blue-text)', fontWeight: 700 }}>
            <Receipt size={16} weight="bold" />
            <span>รหัสยืนยัน #{sub.hash}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isLocked ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--blue-bg)',
          color: 'var(--blue-text)',
          fontWeight: 700
        }}>
          <LockSimple size={18} weight="bold" />
          <span>ส่งแล้ว แก้ไขไม่ได้</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Pre-submit warning (FEEDBACK #4) */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--yellow-bg)', border: '1px solid rgba(255, 197, 37, 0.6)',
            color: '#6B4500',
            fontSize: 'var(--fs-sm)',
            lineHeight: 1.55
          }}>
            <Warning size={18} weight="fill" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>ตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง เมื่อส่งแล้วจะแก้ไขไม่ได้</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onAttemptSubmit}
            style={{ minHeight: '54px', fontSize: '16px' }}
          >
            <PaperPlaneTilt size={20} weight="fill" />
            <span>ตรวจสอบและส่งผลงาน</span>
          </button>

          <button type="button" className="btn btn-block" onClick={onSaveDraft}>
            <FloppyDisk size={18} weight="bold" />
            <span>บันทึกฉบับร่าง</span>
          </button>
        </div>
      )}
    </aside>
  );
};
