import React, { useRef, useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { PHOTO_RULES } from '../../data/referenceData';
import { Camera, Trash, ArrowsClockwise, WarningCircle } from '@phosphor-icons/react';

export const ApplicantPhotoSection = ({ trackId, isLocked, error, number }) => {
  const { submissions, setPhoto, showToast } = usePortal();
  const sub = submissions[trackId] || {};
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const accept = PHOTO_RULES.exts.map(e => `.${e}`).join(',');
  const shownError = localError || (!sub.photo ? error : '');

  const handleFile = async (file) => {
    if (!file || isLocked) return;
    const res = await setPhoto(trackId, file);
    setLocalError(res.success ? '' : res.error);
    if (!res.success) showToast(res.error);
  };

  const pick = () => !isLocked && inputRef.current?.click();

  return (
    <div className="card" id="section-photo">
      <div>
        <h3 className="section-title">
          {number && <span className="section-num">{number}</span>}
          ภาพถ่ายผู้สมัคร <span className="required">*</span>
        </h3>
        <p className="section-desc">
          ไฟล์ {PHOTO_RULES.exts.join(', ').toUpperCase()} ขนาดไม่เกิน {PHOTO_RULES.maxMB} MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {sub.photo?.dataUrl ? (
        <div className="row-item" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <img
              src={sub.photo.dataUrl}
              alt="ภาพถ่ายผู้สมัคร"
              style={{ width: '96px', height: '120px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-light)' }}
            />
            <div style={{ minWidth: 0 }}>
              <div className="row-title" style={{ wordBreak: 'break-all' }}>{sub.photo.name}</div>
              <div className="row-meta">{(sub.photo.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
          {!isLocked && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="btn btn-sm" onClick={pick}>
                <ArrowsClockwise size={15} weight="bold" />
                <span>เปลี่ยนรูป</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => { setPhoto(trackId, null); setLocalError(''); }}
              >
                <Trash size={15} weight="bold" />
                <span>ลบ</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`dropzone ${isLocked ? '' : 'clickable'}`}
          onClick={pick}
          onDragOver={(e) => { e.preventDefault(); if (!isLocked) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            padding: '32px',
            borderColor: shownError || dragOver ? 'var(--primary)' : undefined,
            background: dragOver ? '#FFF8F4' : undefined
          }}
        >
          <Camera size={34} weight="duotone" color="var(--primary)" />
          <div style={{ marginTop: '6px' }}>
            {isLocked ? 'ไม่มีภาพถ่ายผู้สมัคร' : 'คลิกเพื่อเลือกรูป หรือลากไฟล์มาวางที่นี่'}
          </div>
        </div>
      )}

      {shownError && (
        <div className="field-error"><WarningCircle size={16} weight="fill" />{shownError}</div>
      )}
    </div>
  );
};
