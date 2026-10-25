import React, { useState, useEffect } from 'react';
import { WarningCircle, X, Check, LockSimple } from '@phosphor-icons/react';

const SummaryItem = ({ label, children, wide }) => (
  <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-dark)' }}>{children}</div>
  </div>
);

export const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, track, submission }) => {
  const [acknowledged, setAcknowledged] = useState(false);

  // Untick the checkbox every time the popup opens
  useEffect(() => {
    if (isOpen) setAcknowledged(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const showWorkInfo = !!track?.needsWorkInfo;
  const advisors = (submission.members || []).filter(m => m.type === 'advisor').length;
  const students = (submission.members || []).filter(m => m.type === 'student').length;
  const filesCount = (submission.files || []).filter(f => f.status === 'done').length;
  const linksCount = ['video', 'github', 'drive'].filter(k => submission.links?.[k]).length;

  return (
    <div className="modal-overlay">
      <div className="modal animate-slide-up" role="dialog" aria-modal="true" style={{ width: 'min(100%, 520px)' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <LockSimple size={22} weight="fill" />
            </div>
            <div>
              <h3 className="modal-title">ยืนยันการส่งผลงาน</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{track?.full}</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="modal-body">
          <div className="alert alert-error" style={{ fontWeight: 500 }}>
            <WarningCircle size={20} weight="fill" />
            <span>เมื่อยืนยันแล้ว <strong>ระบบจะล็อกข้อมูลและแก้ไขไม่ได้</strong></span>
          </div>

          <div style={{
            background: '#FAFAFC',
            border: '1px solid var(--border-light)',
            borderRadius: '14px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px'
          }}>
            {showWorkInfo && (
              <SummaryItem label="ชื่อผลงาน" wide>{submission.projectName || '—'}</SummaryItem>
            )}
            <SummaryItem label="ทีม">อาจารย์ {advisors} · ผู้แข่งขัน {students}</SummaryItem>
            {showWorkInfo
              ? <SummaryItem label="ไฟล์และลิงก์">{filesCount} ไฟล์ · {linksCount} ลิงก์</SummaryItem>
              : <SummaryItem label="ภาพถ่ายผู้สมัคร">{submission.photo ? 'อัปโหลดแล้ว' : '—'}</SummaryItem>}
            {submission.subjectGroup && (
              <SummaryItem label="กลุ่มสาขา" wide>{submission.subjectGroup}</SummaryItem>
            )}
          </div>

          {/* Must tick before confirming (FEEDBACK #4) */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '15px'
          }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <span>ข้าพเจ้าตรวจสอบแล้วว่า <strong>ข้อมูลถูกต้องครบถ้วน</strong></span>
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>กลับไปตรวจสอบ</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={!acknowledged}>
            <Check size={18} weight="bold" />
            <span>ยืนยันส่งผลงาน</span>
          </button>
        </div>
      </div>
    </div>
  );
};
