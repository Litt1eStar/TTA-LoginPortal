import React, { useEffect, useState } from 'react';
import { X, LockSimpleOpen, Warning, Paperclip, YoutubeLogo, GoogleDriveLogo, UsersThree, CaretLeft, CaretRight, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { api } from '../../api';
import { fmtDateTime, formatSize } from '../../utils/formatters';
import { StatusChip } from './StatusChip';

const th = { padding: '10px 12px', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink-2)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', fontSize: '14px', color: 'var(--color-ink)', verticalAlign: 'top' };

const formatCertName = (m) => `${String(m.title || '').trim()}${String(m.fullName || '').trim()}`;

const exportPhotoFilename = (uniCode, m, counts) => {
  const code = String(uniCode || '').trim();
  const uniName = code ? code[0].toUpperCase() + code.slice(1) : 'Uni';
  const roleKey = m.type === 'advisor' ? 'advisor' : 'student';
  const idx = counts[roleKey];
  const fallback = `${roleKey === 'advisor' ? 'Advisor' : 'Student'}${String(idx).padStart(2, '0')}`;
  const raw = roleKey === 'advisor' ? String(m.email || '').split('@')[0] : m.studentId;
  const id = String(raw || '').trim() || fallback;
  const ext = m.photo?.ext || 'jpg';
  return `ProfileImage_${uniName}_${id}.${ext}`;
};

export const EntryDetailModal = ({ university, column, onClose, onUnlocked, onPrev, onNext, positionLabel }) => {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [previewMember, setPreviewMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = `/admin/submissions/${university.id}/${encodeURIComponent(column.key)}`;

  useEffect(() => {
    let alive = true;
    setEntry(null);
    setError('');
    setConfirming(false);
    setPreviewMember(null);
    api.get(base)
      .then(r => { if (alive) setEntry(r.entry); })
      .catch(err => { if (alive) setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); });
    return () => { alive = false; };
  }, [base]);

  useEffect(() => {
    const onKey = (e) => {
      if (busy) return;
      if (e.key === 'Escape') {
        if (previewMember) setPreviewMember(null);
        else if (confirming) setConfirming(false);
        else onClose();
        return;
      }
      if (previewMember || confirming) return;
      if (e.key === 'ArrowLeft' && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirming, previewMember, onClose, onPrev, onNext]);

  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post(`${base}/unlock`, {});
      setEntry(r.entry);
      setConfirming(false);
      onUnlocked(r.entry);
    } catch (err) {
      setError(err.message || 'ปลดล็อกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const members = entry?.members || [];
  const files = entry?.files || [];
  const counts = { advisor: 0, student: 0 };

  return (
    <div className="modal-overlay" data-theme="admin" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-detail-title" style={{ width: 'min(100%, 960px)' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div id="entry-detail-title" className="modal-title">{column.title}{column.sub ? ` · ${column.sub}` : ''}</div>
              {positionLabel && (
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'var(--color-paper-3)', color: 'var(--color-ink-2)' }}>
                  {positionLabel}
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{university.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {onPrev && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onPrev} disabled={busy} aria-label="รายการก่อนหน้า" title="ก่อนหน้า (ลูกศรซ้าย)">
                <CaretLeft size={18} weight="bold" />
              </button>
            )}
            {onNext && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onNext} disabled={busy} aria-label="รายการถัดไป" title="ถัดไป (ลูกศรขวา)">
                <CaretRight size={18} weight="bold" />
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {error && <p role="alert" style={{ color: 'var(--danger)', display: 'flex', gap: '6px', alignItems: 'center' }}><Warning size={18} /> {error}</p>}
          {!entry && !error && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด…</p>}

          {entry && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <StatusChip status={entry.status} />
                {entry.submittedAt && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>ส่งเมื่อ {fmtDateTime(entry.submittedAt)}</span>}
                {!entry.submittedAt && entry.draftAt && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>บันทึกร่างล่าสุด {fmtDateTime(entry.draftAt)}</span>}
                {entry.hash && <code style={{ background: 'var(--color-done-bg)', color: 'var(--color-done)', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>#{entry.hash}</code>}
              </div>

              {(entry.projectName || entry.summary) && (
                <div>
                  {entry.projectName && <div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{entry.projectName}</div>}
                  {entry.summary && <p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{entry.summary}</p>}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '8px' }}>
                  <UsersThree size={18} /> สมาชิก ({members.length})
                </div>
                {members.length === 0 ? (
                  <p style={{ color: 'var(--text-light)' }}>ยังไม่มีสมาชิก</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-rule)', borderRadius: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-paper-3)', borderBottom: '1px solid var(--color-rule)' }}>
                          <th style={th}>รูป</th><th style={th}>บทบาท</th><th style={th}>ชื่อสำหรับใบเกียรติบัตร</th>
                          <th style={th}>หน่วยงาน</th><th style={th}>รหัส / ชั้นปี</th><th style={th}>ติดต่อ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => {
                          const roleKey = m.type === 'advisor' ? 'advisor' : 'student';
                          counts[roleKey] += 1;
                          const photoFileName = m.photo?.dataUrl ? exportPhotoFilename(university.code, m, counts) : '';
                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid var(--color-rule)' }}>
                              <td style={td}>
                                {m.photo?.dataUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMember({ ...m, photoFileName })}
                                    title="คลิกเพื่อขยายรูปถ่าย"
                                    style={{ position: 'relative', padding: 0, borderRadius: '10px', overflow: 'hidden', display: 'block', background: 'transparent' }}
                                  >
                                    <img src={m.photo.dataUrl} alt={m.fullName} width="46" height="46" style={{ borderRadius: '10px', objectFit: 'cover', display: 'block' }} />
                                    <span style={{ position: 'absolute', right: '2px', bottom: '2px', background: 'rgba(0,0,0,0.55)', color: 'var(--color-accent-ink)', borderRadius: '6px', padding: '1px 3px', display: 'grid', placeItems: 'center' }}>
                                      <MagnifyingGlassPlus size={12} weight="bold" />
                                    </span>
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '12.5px' }}>ขาดรูป</span>
                                )}
                              </td>
                              <td style={td}>
                                <span style={{
                                  display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                                  background: m.type === 'advisor' ? 'var(--yellow-bg)' : 'var(--blue-bg)',
                                  color: m.type === 'advisor' ? 'var(--color-draft)' : 'var(--blue-text)'
                                }}>
                                  {m.type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : (m.role || 'ผู้แข่งขัน')}
                                </span>
                              </td>
                              <td style={td}>
                                <div style={{ fontWeight: 700 }}>{formatCertName(m)}</div>
                                {m.title && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>คำนำหน้า: {m.title} · ชื่อ: {m.fullName}</div>}
                              </td>
                              <td style={td}>{m.dept || '–'}</td>
                              <td style={td}>{m.type === 'student' ? `${m.studentId || '–'}${m.year ? ` / ปี ${m.year}` : ''}` : '–'}</td>
                              <td style={td}><div>{m.email || '–'}</div><div style={{ color: 'var(--text-muted)' }}>{m.phone}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(files.length > 0 || entry.links?.video || entry.video) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 700 }}>ไฟล์และลิงก์</div>
                  {files.map(f => (
                    <a key={f.fileId} href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <Paperclip size={16} /> {f.name} <span style={{ color: 'var(--text-muted)' }}>({formatSize(f.size)})</span>
                    </a>
                  ))}
                  {entry.video?.driveFileId && (
                    <a href={`https://drive.google.com/file/d/${entry.video.driveFileId}/view`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <GoogleDriveLogo size={16} /> เปิดใน Google Drive: {entry.video.name} ({formatSize(entry.video.size)})
                    </a>
                  )}
                  {entry.links?.video && (
                    <a href={entry.links.video} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <YoutubeLogo size={16} /> {entry.links.video}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onPrev && (
              <button type="button" className="btn btn-sm" onClick={onPrev} disabled={busy}>
                <CaretLeft size={16} weight="bold" /> ก่อนหน้า
              </button>
            )}
            {onNext && (
              <button type="button" className="btn btn-sm" onClick={onNext} disabled={busy}>
                ถัดไป <CaretRight size={16} weight="bold" />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>ปิด</button>
            {entry?.status === 'submitted' && (
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={busy}>
                <LockSimpleOpen size={18} /> ปลดล็อกให้แก้ไข
              </button>
            )}
          </div>
        </div>
      </div>

      {previewMember && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewMember(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="ดูรูปถ่ายขนาดใหญ่" style={{ width: 'min(100%, 460px)' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{formatCertName(previewMember)}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  {previewMember.type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : (previewMember.role || 'ผู้แข่งขัน')} · {university.name}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPreviewMember(null)} aria-label="ปิดรูป"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center' }}>
              <img
                src={previewMember.photo.dataUrl}
                alt={previewMember.fullName}
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '14px', background: 'var(--color-paper-3)' }}
              />
              {previewMember.photoFileName && (
                <code style={{ fontSize: '12.5px', background: 'var(--color-paper-3)', padding: '4px 10px', borderRadius: '8px', color: 'var(--color-ink-2)' }}>
                  {previewMember.photoFileName}
                </code>
              )}
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setConfirming(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="unlock-title" style={{ width: 'min(100%, 440px)' }}>
            <div className="modal-header"><div id="unlock-title" className="modal-title">ยืนยันการปลดล็อก</div></div>
            <div className="modal-body">
              <p>
                ผลงาน <strong>{column.title}{column.sub ? ` · ${column.sub}` : ''}</strong> ของ <strong>{university.name}</strong> จะกลับเป็น
                “ฉบับร่าง” รหัสอ้างอิงเดิมจะถูกยกเลิก และผู้ประสานงานต้องกดส่งใหม่อีกครั้ง
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy} autoFocus>ยกเลิก</button>
              <button type="button" className="btn btn-danger" onClick={unlock} disabled={busy}>
                {busy ? 'กำลังปลดล็อก…' : 'ปลดล็อก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
