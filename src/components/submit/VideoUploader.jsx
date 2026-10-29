import React, { useEffect, useRef, useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { api } from '../../api';
import { uploadResumable, validateVideoFile, MAX_VIDEO_MB } from '../../utils/resumableUpload';
import { formatSize } from '../../utils/formatters';
import { SectionNum } from './SectionNum';
import { VideoCamera, UploadSimple, Trash, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';

// Clip only. Flow:
// 1. POST /api/submissions/clip/video, which gives a Drive resumable uploadUrl
// 2. PUT the file to Drive in 8 MB chunks, resuming after drops
// 3. POST /confirm, which gives a VideoRef; it is stored in entry.video and autosaved
export const VideoUploader = ({ trackId, isLocked, number }) => {
  const { submissions, updateField, flushEntry, syncVersion } = usePortal();
  const video = submissions[trackId]?.video || null;

  const [progress, setProgress] = useState(null); // null when idle, 0–100 while uploading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  // Leaving the page stops a running upload
  useEffect(() => () => abortRef.current?.abort(), []);

  const startUpload = async (file) => {
    if (!file) return;
    const check = validateVideoFile(file, MAX_VIDEO_MB);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError('');
    setBusy(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { uploadUrl } = await api.post('/submissions/clip/video', { name: file.name, size: file.size, mime: check.mime });
      const { driveFileId } = await uploadResumable({ uploadUrl, file, onProgress: setProgress, signal: controller.signal });
      const { video: ref } = await api.post('/submissions/clip/video/confirm', { driveFileId });
      updateField(trackId, 'video', ref);
    } catch (err) {
      setError(err?.name === 'AbortError' ? 'ยกเลิกการอัปโหลดแล้ว' : (err?.message || 'อัปโหลดวิดีโอไม่สำเร็จ กรุณาลองใหม่'));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  };

  const removeVideo = async () => {
    if (!video) return;
    setBusy(true);
    setError('');
    try {
      // The server clears entry.video itself and bumps the entry's version:
      // save what is pending first, and take the new version afterwards.
      await flushEntry(trackId);
      await api.del(`/submissions/clip/video/${encodeURIComponent(video.driveFileId)}`);
      updateField(trackId, 'video', null);
      await syncVersion(trackId);
    } catch (err) {
      if (err.status === 404) updateField(trackId, 'video', null);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="card" id="section-video">
      <div>
        <h3 className="section-title">
          <SectionNum number={number} done={!!video} />
          ไฟล์วิดีโอ
        </h3>
        <p className="section-desc">ไฟล์ MP4 หรือ MOV ไม่เกิน {MAX_VIDEO_MB} MB (ไม่บังคับ หากแนบลิงก์ YouTube แล้ว)</p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <WarningCircle size={18} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {video ? (
        <div className="row-item" style={{ flexWrap: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <VideoCamera size={24} weight="fill" color="var(--primary)" />
            <div style={{ minWidth: 0 }}>
              <div className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</div>
              <div className="row-meta">{formatSize(video.size)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className="badge badge-blue">
              <CheckCircle size={14} weight="fill" />
              อัปโหลดแล้ว
            </span>
            {!isLocked && (
              <button type="button" className="icon-btn" disabled={busy} onClick={removeVideo} title="ลบวิดีโอ" aria-label={`ลบวิดีโอ ${video.name}`}>
                <Trash size={18} weight="bold" />
              </button>
            )}
          </div>
        </div>
      ) : uploading ? (
        <div className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span className="row-title">กำลังอัปโหลดวิดีโอ {progress}%</span>
            <button type="button" className="btn btn-sm" onClick={() => abortRef.current?.abort()}>
              <X size={16} weight="bold" />
              <span>ยกเลิก</span>
            </button>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            style={{ height: '8px', borderRadius: '999px', background: 'var(--bg-main)', overflow: 'hidden' }}
          >
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.3s' }} />
          </div>
          <span className="row-meta">อย่าปิดหน้านี้จนกว่าจะอัปโหลดเสร็จ หากสัญญาณหลุด ระบบจะอัปโหลดต่อให้อัตโนมัติ</span>
        </div>
      ) : isLocked ? (
        <div className="dropzone">ไม่มีไฟล์วิดีโอ</div>
      ) : (
        <div
          className="dropzone clickable"
          onClick={() => !busy && inputRef.current?.click()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.mov,video/mp4,video/quicktime"
            style={{ display: 'none' }}
            aria-label="เลือกไฟล์วิดีโอ"
            onChange={(e) => { startUpload(e.target.files?.[0]); e.target.value = ''; }}
          />
          <UploadSimple size={30} weight="bold" color="var(--primary)" />
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>คลิกเพื่อเลือกไฟล์วิดีโอ</div>
        </div>
      )}
    </div>
  );
};
