import React, { useState, useEffect } from 'react';
import { defaultRole } from '../../data/tracks';
import { WarningCircle, X, Check, LockSimple } from '@phosphor-icons/react';

const SummaryItem = ({ label, children, wide }) => (
  <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-dark)' }}>{children}</div>
  </div>
);

// onConfirm: async () => { success, error?, failed?: [{ key, label, error }] }
export const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, track, submission }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState([]);

  // Reset every time the popup opens
  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setSubmitting(false);
      setError('');
      setFailed([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    setFailed([]);
    const res = await onConfirm();
    if (!res?.success) {
      setSubmitting(false);
      setError(res?.error || 'ส่งผลงานไม่สำเร็จ กรุณาลองใหม่');
      setFailed(res?.failed || []);
    }
  };

  const showWorkInfo = !!track?.needsWorkInfo;
  const isParticipants = !!track?.participantsOnly;
  const showAdvisors = (track?.advisorCount ?? 1) > 0;
  const nameOf = (m) => [m.title, m.fullName].filter(Boolean).join(' ');
  const advisors = (submission.members || []).filter(m => m.type === 'advisor');
  const students = (submission.members || []).filter(m => m.type === 'student');
  const doneFiles = (submission.files || []).filter(f => f.status === 'done');
  const listStyle = { margin: '2px 0 0', paddingLeft: '18px', fontWeight: 500 };

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
          <button type="button" className="icon-btn" onClick={onClose} disabled={submitting} aria-label="ปิด">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="modal-body">
          <div className="alert alert-error" style={{ fontWeight: 500 }}>
            <WarningCircle size={20} weight="fill" />
            <span>เมื่อยืนยันแล้ว <strong>ระบบจะล็อกข้อมูลและแก้ไขไม่ได้</strong></span>
          </div>

          {error && (
            <div className="alert alert-error" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <WarningCircle size={20} weight="fill" />
                <span>{error}</span>
              </div>
              {failed.length > 0 && (
                <ul style={{ margin: '4px 0 0 28px', padding: 0 }}>
                  {failed.map(f => (
                    <li key={f.key}>{f.label}{f.error ? `: ${f.error}` : ''}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
              <SummaryItem label="ชื่อผลงาน" wide>{submission.projectName || '-'}</SummaryItem>
            )}
            {showAdvisors && (
              <SummaryItem label={`อาจารย์ที่ปรึกษา (${advisors.length})`}>
                <ul style={listStyle}>{advisors.map(m => <li key={m.id}>{nameOf(m)}</li>)}</ul>
              </SummaryItem>
            )}
            <SummaryItem label={`${isParticipants ? 'ผู้เข้าร่วม' : 'ผู้แข่งขัน'} (${students.length})`} wide={!showAdvisors}>
              <ul style={listStyle}>
                {students.map(m => (
                  <li key={m.id}>
                    {nameOf(m)}
                    {!isParticipants ? ` (${m.role || defaultRole(track)})` : ''}
                  </li>
                ))}
              </ul>
            </SummaryItem>
            {showWorkInfo
              ? <SummaryItem label="ไฟล์และลิงก์" wide>
                <ul style={{ ...listStyle, wordBreak: 'break-word' }}>
                  {doneFiles.map(f => <li key={f.id || f.name}>{f.name}</li>)}
                  {submission.video && <li>วิดีโอ: {submission.video.name || 'อัปโหลดแล้ว'}</li>}
                  {submission.links?.video && <li>ลิงก์: {submission.links.video}</li>}
                  {!doneFiles.length && !submission.video && !submission.links?.video && <li>-</li>}
                </ul>
              </SummaryItem>
              : <SummaryItem label="รูปถ่าย">
                {(submission.members || []).filter(m => m.photo?.dataUrl).length}/{(submission.members || []).length} คน
              </SummaryItem>}
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
              disabled={submitting}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <span>ข้าพเจ้าตรวจสอบแล้วว่า <strong>ข้อมูลถูกต้องครบถ้วน</strong></span>
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>กลับไปตรวจสอบ</button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={!acknowledged || submitting}>
            <Check size={18} weight="bold" />
            <span>{submitting ? 'กำลังส่ง…' : 'ยืนยันส่งผลงาน'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
