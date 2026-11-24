import React, { useEffect, useRef } from 'react';
import { ArrowRight, LockSimple, CheckCircle } from '@phosphor-icons/react';

// Full-screen moment after a successful submit: mascot, a "ส่งแล้ว" stamp and the
// confirmation code. Closable at once (button, Escape, or a click outside).
export const SubmitCelebration = ({ track, groupName, hash, onClose, onNext }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay celebrate-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal celebrate-card" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
        <div className="celebrate-hero" aria-hidden="true">
          <span className="celebrate-rays" />
          {track.image ? (
            <img className="celebrate-mascot" src={track.image} alt="" width="112" height="112" decoding="async" />
          ) : (
            <CheckCircle className="celebrate-mascot" size={112} weight="fill" color="#FFFFFF" />
          )}
          <span className="stamp">ส่งแล้ว</span>
        </div>

        <div className="celebrate-body">
          <h2 id="celebrate-title" className="rise" style={{ '--d': '250ms', fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>
            ส่งผลงานเรียบร้อย
          </h2>
          <p className="rise" style={{ '--d': '320ms', fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-dark)' }}>
            {track.full}{groupName ? ` · ${groupName}` : ''}
          </p>

          <div className="celebrate-hash rise" style={{ '--d': '420ms' }}>
            <span>รหัสยืนยัน</span>
            <strong>#{hash}</strong>
          </div>

          <p className="rise" style={{ '--d': '480ms', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <LockSimple size={15} weight="bold" />
            ระบบล็อกข้อมูลแล้ว หากต้องแก้ไขกรุณาติดต่อกองอำนวยการ
          </p>

          <div className="rise" style={{ '--d': '540ms', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
            {onNext && (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                <span>ไปประเภทถัดไปที่ยังไม่ส่ง</span>
                <ArrowRight size={18} weight="bold" />
              </button>
            )}
            <button ref={closeRef} type="button" className="btn" onClick={onClose}>ปิด</button>
          </div>
        </div>
      </div>
    </div>
  );
};
