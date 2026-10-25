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

export const SubmissionChecklist = ({ trackId, onAttemptSubmit, isLocked, onSaveDraft }) => {
  const { submissions } = usePortal();
  const sub = submissions[trackId] || { members: [], files: [], links: {} };

  const criteria = getRequirements(getTrack(trackId), sub);
  const completedCount = criteria.filter(c => c.ok).length;
  const percentage = Math.round((completedCount / criteria.length) * 100);

  const savedLabel = isLocked && sub.submittedAt
    ? `ส่งเมื่อ ${fmtDateTime(sub.submittedAt)}`
    : sub.draftAt
      ? `บันทึกร่างเมื่อ ${fmtDateTime(sub.draftAt)}`
      : 'ยังไม่ได้บันทึก';

  const jumpTo = (section) =>
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="card" style={{ position: 'sticky', top: '94px', gap: '18px' }}>
      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>ความพร้อมในการส่ง</h3>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: percentage === 100 ? 'var(--blue-text)' : 'var(--primary)' }}>
            {completedCount}/{criteria.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: '100%', height: '10px', background: '#ECECF1', borderRadius: '20px', overflow: 'hidden' }}
        >
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: percentage === 100 ? 'var(--blue)' : 'linear-gradient(90deg, var(--primary) 0%, var(--amber) 100%)',
            borderRadius: '20px',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Checklist — each item jumps to its section */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {criteria.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => jumpTo(c.section)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '6px 8px',
                borderRadius: '10px',
                background: 'transparent',
                textAlign: 'left',
                fontSize: '15px',
                lineHeight: 1.5,
                color: c.ok ? 'var(--text-dark)' : 'var(--text-muted)',
                fontWeight: c.ok ? 600 : 500
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-main)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
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
        background: 'var(--bg-main)',
        borderRadius: '12px',
        padding: '12px 14px',
        fontSize: 'var(--fs-sm)',
        color: 'var(--text-muted)'
      }}>
        <div>สถานะ: <strong style={{ color: 'var(--text-dark)' }}>{savedLabel}</strong></div>
        {sub.hash && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--blue-text)', fontWeight: 700 }}>
            <Receipt size={16} weight="bold" />
            <span>รหัสยืนยัน #{sub.hash}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isLocked ? (
        <div className="alert alert-info" style={{ justifyContent: 'center', fontWeight: 700 }}>
          <LockSimple size={18} weight="bold" />
          <span>ส่งแล้ว · แก้ไขไม่ได้</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Pre-submit warning (FEEDBACK #4) */}
          <div className="alert alert-warning" style={{ fontSize: 'var(--fs-sm)' }}>
            <Warning size={18} weight="fill" />
            <span>ตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง เมื่อส่งแล้วจะแก้ไขไม่ได้</span>
          </div>

          <button type="button" className="btn btn-primary btn-block" onClick={onAttemptSubmit} style={{ minHeight: '52px', fontSize: '16px' }}>
            <PaperPlaneTilt size={20} weight="fill" />
            <span>ตรวจสอบและส่งผลงาน</span>
          </button>

          <button type="button" className="btn btn-block" onClick={onSaveDraft}>
            <FloppyDisk size={18} weight="bold" />
            <span>บันทึกฉบับร่าง</span>
          </button>
        </div>
      )}
    </div>
  );
};
