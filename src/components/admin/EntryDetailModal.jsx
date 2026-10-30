import React, { useEffect, useState } from 'react';
import { X, LockSimpleOpen, Warning, Paperclip, YoutubeLogo, GoogleDriveLogo, UsersThree } from '@phosphor-icons/react';
import { api } from '../../api';
import { fmtDateTime, formatSize } from '../../utils/formatters';
import { StatusChip } from './StatusChip';

const th = { padding: '10px 12px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', fontSize: '14px', color: '#1B1D29', verticalAlign: 'top' };

export const EntryDetailModal = ({ university, column, onClose, onUnlocked }) => {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/admin/submissions/${university.id}/${encodeURIComponent(column.key)}`;

  useEffect(() => {
    let alive = true;
    api.get(base)
      .then(r => { if (alive) setEntry(r.entry); })
      .catch(err => { if (alive) setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); });
    return () => { alive = false; };
  }, [base]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || busy) return;
      if (confirming) setConfirming(false); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirming, onClose]);

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

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-detail-title" style={{ width: 'min(100%, 920px)' }}>
        <div className="modal-header">
          <div>
            <div id="entry-detail-title" className="modal-title">{column.title}{column.sub ? ` · ${column.sub}` : ''}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{university.name}</div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
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
                {entry.hash && <code style={{ background: '#EAF5FE', color: '#0A65B0', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>#{entry.hash}</code>}
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
                  <div style={{ overflowX: 'auto', border: '1px solid #ECECF1', borderRadius: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                      <thead>
                        <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1' }}>
                          <th style={th}>รูป</th><th style={th}>บทบาท</th><th style={th}>ชื่อ-นามสกุล</th>
                          <th style={th}>หน่วยงาน</th><th style={th}>รหัส / ชั้นปี</th><th style={th}>ติดต่อ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #F0F1F5' }}>
                            <td style={td}>
                              {m.photo?.dataUrl
                                ? <img src={m.photo.dataUrl} alt={m.fullName} width="44" height="44" style={{ borderRadius: '10px', objectFit: 'cover' }} />
                                : <span style={{ color: 'var(--text-light)' }}>–</span>}
                            </td>
                            <td style={td}>{m.type === 'advisor' ? 'อาจารย์' : 'ผู้แข่งขัน'}{m.isLeader ? ' · หัวหน้าทีม' : ''}</td>
                            <td style={{ ...td, fontWeight: 700 }}>{m.title} {m.fullName}</td>
                            <td style={td}>{m.dept || '–'}</td>
                            <td style={td}>{m.type === 'student' ? `${m.studentId || '–'} / ปี ${m.year || '–'}` : '–'}</td>
                            <td style={td}><div>{m.email || '–'}</div><div style={{ color: 'var(--text-muted)' }}>{m.phone}</div></td>
                          </tr>
                        ))}
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

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>ปิด</button>
          {entry?.status === 'submitted' && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={busy}>
              <LockSimpleOpen size={18} /> ปลดล็อกให้แก้ไข
            </button>
          )}
        </div>
      </div>

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
