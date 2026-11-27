import React, { useEffect, useState } from 'react';
import {
  X, CaretLeft, CaretRight, Copy, CheckCircle, WarningCircle,
  UserPlus, UserMinus, PencilSimpleLine, Paperclip, VideoCamera
} from '@phosphor-icons/react';
import { formatSize } from '../../utils/formatters';
import { publicUrl } from '../../utils/publicUrl';

export const ACTION_LABELS = {
  'auth.login': 'เข้าสู่ระบบสำเร็จ',
  'auth.login_failed': 'เข้าสู่ระบบไม่สำเร็จ',
  'auth.logout': 'ออกจากระบบ',
  'submission.save_draft': 'บันทึกฉบับร่าง',
  'submission.save_failed': 'บันทึกฉบับร่างไม่สำเร็จ',
  'submission.submit': 'ยืนยันส่งผลงาน',
  'submission.submit_failed': 'ส่งผลงานไม่สำเร็จ',
  'file.upload': 'อัปโหลดไฟล์',
  'file.upload_failed': 'อัปโหลดไฟล์ไม่สำเร็จ',
  'file.delete': 'ลบไฟล์แนบ',
  'video.session': 'เริ่มอัปโหลดวิดีโอ',
  'video.confirm': 'ยืนยันวิดีโอบน Google Drive',
  'video.delete': 'ลบไฟล์วิดีโอ',
  'admin.unlock': 'ผู้ดูแลปลดล็อกผลงาน',
  'admin.export': 'ผู้ดูแลส่งออกข้อมูล'
};

export const ROLE_LABELS = {
  coordinator: 'ผู้ประสานงาน',
  admin: 'ผู้ดูแลระบบ',
  dev: 'นักพัฒนาระบบ (Dev)',
  anonymous: 'ยังไม่ระบุตัวตน'
};

const FIELD_LABELS = {
  projectName: 'ชื่อผลงาน',
  summary: 'บทคัดย่อ / แนวคิดผลงาน',
  notes: 'หมายเหตุ',
  'links.video': 'ลิงก์วิดีโอ (YouTube)',
  type: 'ประเภทสมาชิก',
  title: 'คำนำหน้า',
  fullName: 'ชื่อ-นามสกุล',
  studentId: 'รหัสนักศึกษา',
  year: 'ชั้นปี',
  role: 'บทบาท',
  email: 'อีเมล',
  phone: 'เบอร์โทรศัพท์',
  dept: 'หน่วยงาน / คณะ',
  isLeader: 'หัวหน้าทีม',
  photoFileId: 'ไฟล์รูปถ่าย (File ID)'
};

const formatThaiDateTimeFull = (iso) => {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(iso);
  }
};

const formatVal = (val) => {
  if (val === null || val === undefined || val === '') return '— (ว่าง)';
  if (typeof val === 'boolean') return val ? 'ใช่' : 'ไม่ใช่';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const thStyle = {
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: '12.5px',
  color: 'var(--color-ink-2)',
  textAlign: 'left',
  borderBottom: '1px solid var(--color-rule)',
  background: 'var(--color-paper-3)'
};

const tdStyle = {
  padding: '8px 12px',
  fontSize: '13.5px',
  color: 'var(--color-ink)',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--color-rule)',
  overflowWrap: 'anywhere'
};

export const DevLogDetailModal = ({ log, entryTitle, onClose, onPrev, onNext, positionLabel, onCopy }) => {
  const [tab, setTab] = useState('diff');

  useEffect(() => {
    setTab('diff');
  }, [log?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft' && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  if (!log) return null;

  const details = log.details || {};
  const diff = details.diff || null;
  const hasBeforeAfter = Boolean(details.before || details.after);

  const copyEvidence = async () => {
    const payload = JSON.stringify(log, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      if (onCopy) onCopy('คัดลอกข้อมูลหลักฐาน (JSON) เรียบร้อยแล้ว');
    } catch {
      if (onCopy) onCopy('คัดลอกไม่สำเร็จ กรุณาคัดลอกจากช่อง JSON ด้านล่าง');
    }
  };

  return (
    <div
      className="modal-overlay"
      data-theme="admin"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-log-modal-title"
        style={{ width: 'min(100%, 980px)' }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: 'monospace', background: 'var(--color-paper-3)', padding: '2px 8px', borderRadius: '6px' }}>
                Log #{log.id}
              </span>
              <div id="dev-log-modal-title" className="modal-title">
                {ACTION_LABELS[log.action] || log.action}
              </div>
              <span className={`adm-status ${log.status === 'error' ? '' : 'adm-status--submitted'}`} style={log.status === 'error' ? { background: 'var(--color-error-bg)', color: 'var(--color-error)' } : undefined}>
                {log.status === 'error' ? <WarningCircle size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />}
                {log.status === 'error' ? `ข้อผิดพลาด${log.errorCode ? ` (${log.errorCode})` : ''}` : 'สำเร็จ (OK)'}
              </span>
              {positionLabel && (
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'var(--color-paper-3)', color: 'var(--color-ink-2)' }}>
                  {positionLabel}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--color-ink-2)', marginTop: '4px' }}>
              {formatThaiDateTimeFull(log.createdAt)} ({log.createdAt})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {onPrev && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onPrev} aria-label="รายการก่อนหน้า" title="ก่อนหน้า (ลูกศรซ้าย)">
                <CaretLeft size={18} weight="bold" />
              </button>
            )}
            {onNext && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onNext} aria-label="รายการถัดไป" title="ถัดไป (ลูกศรขวา)">
                <CaretRight size={18} weight="bold" />
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="ปิด">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Banner */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: log.status === 'error' ? 'var(--color-error-bg)' : 'var(--color-paper-3)',
            border: '1px solid var(--color-rule)',
            fontWeight: 600,
            fontSize: '14.5px',
            color: log.status === 'error' ? 'var(--color-error)' : 'var(--color-ink)'
          }}>
            {log.summary}
          </div>

          {/* Actor & Target Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ border: '1px solid var(--color-rule)', borderRadius: '12px', padding: '12px 14px', background: 'var(--color-paper-2)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-2)', marginBottom: '6px' }}>
                ผู้กระทำและเซสชัน (Actor & Context)
              </div>
              <div style={{ fontSize: '13.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>ผู้ใช้งาน:</strong> <code>{log.username}</code> {log.userId ? `(ID #${log.userId})` : ''}</div>
                <div><strong>บทบาท:</strong> {ROLE_LABELS[log.userRole] || log.userRole}</div>
                <div>
                  <strong>มหาวิทยาลัย:</strong>{' '}
                  {log.universityCode ? `${log.universityCode.toUpperCase()} · ${log.universityName || ''}` : '–'}
                </div>
                <div><strong>IP Address:</strong> <code>{log.ip || '–'}</code></div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-2)', overflowWrap: 'anywhere' }}>
                  <strong>User-Agent:</strong> {log.userAgent || '–'}
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-rule)', borderRadius: '12px', padding: '12px 14px', background: 'var(--color-paper-2)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-2)', marginBottom: '6px' }}>
                เป้าหมายการกระทำ (Target & Version)
              </div>
              <div style={{ fontSize: '13.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>รหัสการกระทำ:</strong> <code>{log.action}</code></div>
                <div>
                  <strong>รายการแข่งขัน:</strong>{' '}
                  {log.entryKey ? (
                    <><code>{log.entryKey}</code> {entryTitle ? `(${entryTitle})` : ''}</>
                  ) : '–'}
                </div>
                <div><strong>รหัสอ้างอิง / เป้าหมาย:</strong> {log.targetId ? <code>{log.targetId}</code> : '–'}</div>
                {(details.versionBefore != null || details.versionAfter != null || details.version != null) && (
                  <div>
                    <strong>Version ข้อมูล:</strong>{' '}
                    {details.versionBefore != null && details.versionAfter != null
                      ? `v${details.versionBefore} → v${details.versionAfter}`
                      : `v${details.version ?? details.versionAfter}`}
                  </div>
                )}
                {details.hash && (
                  <div><strong>Confirmation Hash:</strong> <code style={{ color: 'var(--color-done)', fontWeight: 700 }}>#{details.hash}</code></div>
                )}
              </div>
            </div>
          </div>

          {/* View Tabs when Before/After or Diff exists */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-rule)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: tab === 'diff' ? 'var(--color-ink)' : 'var(--color-paper-3)',
                  color: tab === 'diff' ? '#fff' : 'var(--color-ink)'
                }}
                onClick={() => setTab('diff')}
              >
                สรุปการเปลี่ยนแปลง (Evidence Diff)
              </button>
              {hasBeforeAfter && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: tab === 'after' ? 'var(--color-ink)' : 'var(--color-paper-3)',
                      color: tab === 'after' ? '#fff' : 'var(--color-ink)'
                    }}
                    onClick={() => setTab('after')}
                  >
                    ข้อมูลหลังบันทึก (After)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: tab === 'before' ? 'var(--color-ink)' : 'var(--color-paper-3)',
                      color: tab === 'before' ? '#fff' : 'var(--color-ink)'
                    }}
                    onClick={() => setTab('before')}
                  >
                    ข้อมูลก่อนบันทึก (Before)
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: tab === 'raw' ? 'var(--color-ink)' : 'var(--color-paper-3)',
                  color: tab === 'raw' ? '#fff' : 'var(--color-ink)'
                }}
                onClick={() => setTab('raw')}
              >
                Raw JSON ทั้งหมด
              </button>
            </div>

            <button type="button" className="btn btn-sm" onClick={copyEvidence}>
              <Copy size={16} /> คัดลอกหลักฐาน (JSON)
            </button>
          </div>

          {/* Tab Content: Structured Diff */}
          {tab === 'diff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {diff ? (
                <>
                  {!diff.hasChanges && (
                    <p style={{ color: 'var(--color-ink-2)', fontSize: '13.5px' }}>
                      เริ่มสร้างฉบับร่างครั้งแรก (ยังไม่มีความต่างของฟิลด์จากค่าเริ่มต้น)
                    </p>
                  )}

                  {/* 1. Changed Project Fields */}
                  {diff.fields?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PencilSimpleLine size={17} /> ข้อมูลผลงานที่แก้ไข ({diff.fields.length} รายการ)
                      </div>
                      <div style={{ border: '1px solid var(--color-rule)', borderRadius: '10px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, width: '24%' }}>ฟิลด์</th>
                              <th style={{ ...thStyle, width: '38%' }}>ค่าเดิม (Before)</th>
                              <th style={{ ...thStyle, width: '38%' }}>ค่าใหม่ (After)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.fields.map((f) => (
                              <tr key={f.field}>
                                <td style={{ ...tdStyle, fontWeight: 700 }}>{FIELD_LABELS[f.field] || f.field}</td>
                                <td style={{ ...tdStyle, color: 'var(--color-error)', background: 'rgba(220, 38, 38, 0.04)', whiteSpace: 'pre-wrap' }}>
                                  {formatVal(f.before)}
                                </td>
                                <td style={{ ...tdStyle, color: '#1F7A3D', background: 'rgba(31, 122, 61, 0.05)', whiteSpace: 'pre-wrap' }}>
                                  {formatVal(f.after)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. Added Members */}
                  {diff.membersAdded?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1F7A3D', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserPlus size={17} weight="bold" /> เพิ่มสมาชิกใหม่ ({diff.membersAdded.length} คน)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {diff.membersAdded.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'rgba(31, 122, 61, 0.07)',
                              border: '1px solid rgba(31, 122, 61, 0.25)',
                              fontSize: '13.5px'
                            }}
                          >
                            <strong>+ {m.title}{m.fullName || '(ยังไม่ระบุชื่อ)'}</strong>{' '}
                            <span style={{ color: 'var(--color-ink-2)' }}>
                              ({m.type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : (m.role || 'ผู้แข่งขัน')}
                              {m.studentId ? ` · รหัส ${m.studentId}` : ''}
                              {m.isLeader ? ' · หัวหน้าทีม' : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Updated Members */}
                  {diff.membersUpdated?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-done)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PencilSimpleLine size={17} weight="bold" /> แก้ไขข้อมูลสมาชิก ({diff.membersUpdated.length} คน)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {diff.membersUpdated.map((m) => (
                          <div key={m.id} style={{ border: '1px solid var(--color-rule)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ padding: '7px 12px', background: 'var(--color-paper-3)', fontWeight: 700, fontSize: '13.5px' }}>
                              ~ {m.fullName || '(ไม่ระบุชื่อ)'} <code style={{ fontSize: '11.5px', color: 'var(--color-ink-2)' }}>({m.id})</code>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thStyle, width: '28%' }}>ข้อมูลที่เปลี่ยน</th>
                                  <th style={{ ...thStyle, width: '36%' }}>ค่าเดิม</th>
                                  <th style={{ ...thStyle, width: '36%' }}>ค่าใหม่</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.changes.map((c) => (
                                  <tr key={c.field}>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{FIELD_LABELS[c.field] || c.field}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-error)' }}>
                                      {c.field === 'photoFileId' && c.before ? (
                                        <a href={publicUrl(`/api/files/${c.before}`)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-error)', textDecoration: 'underline' }}>
                                          รูปเดิม #{c.before}
                                        </a>
                                      ) : formatVal(c.before)}
                                    </td>
                                    <td style={{ ...tdStyle, color: '#1F7A3D' }}>
                                      {c.field === 'photoFileId' && c.after ? (
                                        <a href={publicUrl(`/api/files/${c.after}`)} target="_blank" rel="noreferrer" style={{ color: '#1F7A3D', textDecoration: 'underline' }}>
                                          รูปใหม่ #{c.after}
                                        </a>
                                      ) : formatVal(c.after)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Removed Members */}
                  {diff.membersRemoved?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-error)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserMinus size={17} weight="bold" /> ลบสมาชิกออก ({diff.membersRemoved.length} คน)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {diff.membersRemoved.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'var(--color-error-bg)',
                              border: '1px solid rgba(220, 38, 38, 0.25)',
                              fontSize: '13.5px',
                              color: 'var(--color-error)'
                            }}
                          >
                            <strong>- {m.title}{m.fullName || '(ไม่ระบุชื่อ)'}</strong>{' '}
                            <span>
                              ({m.type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : (m.role || 'ผู้แข่งขัน')}
                              {m.studentId ? ` · รหัส ${m.studentId}` : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Files Added / Removed */}
                  {(diff.filesAdded?.length > 0 || diff.filesRemoved?.length > 0) && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Paperclip size={17} /> การเปลี่ยนแปลงไฟล์แนบ
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(diff.filesAdded || []).map((f) => (
                          <div key={`add-${f.fileId}`} style={{ padding: '7px 12px', borderRadius: '8px', background: 'rgba(31, 122, 61, 0.07)', fontSize: '13.5px', color: '#1F7A3D' }}>
                            + แนบไฟล์เพิ่ม:{' '}
                            <a href={publicUrl(`/api/files/${f.fileId}`)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'inherit', textDecoration: 'underline' }}>
                              {f.name}
                            </a>{' '}
                            (#{f.fileId}, {formatSize(f.size)})
                          </div>
                        ))}
                        {(diff.filesRemoved || []).map((f) => (
                          <div key={`rem-${f.fileId}`} style={{ padding: '7px 12px', borderRadius: '8px', background: 'var(--color-error-bg)', fontSize: '13.5px', color: 'var(--color-error)' }}>
                            - นำไฟล์ออก: <strong>{f.name}</strong> (#{f.fileId}, {formatSize(f.size)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. Video Changed */}
                  {diff.videoChanged && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <VideoCamera size={17} /> การเปลี่ยนแปลงไฟล์วิดีโอ (Google Drive)
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-rule)', fontSize: '13.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><strong>วิดีโอเดิม:</strong> {diff.videoChanged.before ? `${diff.videoChanged.before.name} (${diff.videoChanged.before.driveFileId})` : '— ไม่มี'}</div>
                        <div><strong>วิดีโอใหม่:</strong> {diff.videoChanged.after ? `${diff.videoChanged.after.name} (${diff.videoChanged.after.driveFileId})` : '— ลบออก'}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Non-draft event details table */
                <div style={{ border: '1px solid var(--color-rule)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--color-paper-3)', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink-2)' }}>
                    ข้อมูลรายละเอียดของเหตุการณ์ (Event Details)
                  </div>
                  <pre style={{
                    margin: 0,
                    padding: '14px',
                    fontSize: '12.5px',
                    lineHeight: 1.5,
                    background: 'var(--color-paper-2)',
                    overflowX: 'auto',
                    maxHeight: '360px'
                  }}>
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {tab === 'after' && (
            <pre style={{
              margin: 0,
              padding: '14px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              border: '1px solid var(--color-rule)',
              borderRadius: '10px',
              background: 'var(--color-paper-3)',
              overflowX: 'auto',
              maxHeight: '460px'
            }}>
              {JSON.stringify(details.after ?? {}, null, 2)}
            </pre>
          )}

          {tab === 'before' && (
            <pre style={{
              margin: 0,
              padding: '14px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              border: '1px solid var(--color-rule)',
              borderRadius: '10px',
              background: 'var(--color-paper-3)',
              overflowX: 'auto',
              maxHeight: '460px'
            }}>
              {JSON.stringify(details.before ?? {}, null, 2)}
            </pre>
          )}

          {tab === 'raw' && (
            <pre style={{
              margin: 0,
              padding: '14px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              border: '1px solid var(--color-rule)',
              borderRadius: '10px',
              background: 'var(--color-paper-3)',
              overflowX: 'auto',
              maxHeight: '460px'
            }}>
              {JSON.stringify(log, null, 2)}
            </pre>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onPrev && (
              <button type="button" className="btn btn-sm" onClick={onPrev}>
                <CaretLeft size={16} weight="bold" /> ก่อนหน้า
              </button>
            )}
            {onNext && (
              <button type="button" className="btn btn-sm" onClick={onNext}>
                ถัดไป <CaretRight size={16} weight="bold" />
              </button>
            )}
          </div>
          <button type="button" className="btn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
};
