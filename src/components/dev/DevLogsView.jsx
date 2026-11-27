import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowsClockwise, DownloadSimple, MagnifyingGlass, WarningCircle,
  CheckCircle, Eye, CaretLeft, CaretRight
} from '@phosphor-icons/react';
import { api } from '../../api';
import { usePortal } from '../../context/PortalContext';
import { groupShortName } from '../../data/tracks';
import { getOverviewItems } from '../../utils/entries';
import { publicUrl } from '../../utils/publicUrl';
import { DevLogDetailModal, ACTION_LABELS, ROLE_LABELS } from './DevLogDetailModal';
import '../admin/admin.css';

const PAGE_SIZE = 100;

const ENTRY_OPTIONS = getOverviewItems({}).map(it => ({
  key: it.key,
  label: `${it.track.th}${it.groupLabel ? ` (${groupShortName(it.groupLabel)})` : ''}`
}));

const ENTRY_TITLE_BY_KEY = Object.fromEntries(ENTRY_OPTIONS.map(e => [e.key, e.label]));

const ACTION_FILTERS = [
  { id: '', label: 'ทุกการกระทำ' },
  { id: 'submission.save_draft', label: 'บันทึกฉบับร่าง (save_draft)' },
  { id: 'submission.submit', label: 'ยืนยันส่งผลงาน (submit)' },
  { id: 'submission.', label: 'การส่ง/บันทึกผลงานทั้งหมด' },
  { id: 'file.', label: 'อัปโหลด / ลบไฟล์แนบทั้งหมด' },
  { id: 'video.', label: 'อัปโหลด / ยืนยัน / ลบวิดีโอ' },
  { id: 'admin.unlock', label: 'ผู้ดูแลปลดล็อกผลงาน' },
  { id: 'admin.export', label: 'ผู้ดูแลส่งออกข้อมูล' },
  { id: 'auth.', label: 'การเข้าสู่ระบบ / ออกจากระบบ' }
];

const STATUS_FILTERS = [
  { id: '', label: 'ทุกสถานะ' },
  { id: 'ok', label: 'สำเร็จ (OK)' },
  { id: 'error', label: 'ข้อผิดพลาด (Error)' }
];

const ROLE_FILTERS = [
  { id: '', label: 'ทุกบทบาท' },
  { id: 'coordinator', label: 'ผู้ประสานงานมหาวิทยาลัย' },
  { id: 'admin', label: 'ผู้ดูแลระบบ (กรรมการ)' },
  { id: 'dev', label: 'นักพัฒนาระบบ (Dev)' },
  { id: 'anonymous', label: 'ยังไม่ระบุตัวตน' }
];

const DEFAULTS = {
  uni: '',
  action: '',
  entryKey: '',
  status: '',
  role: '',
  q: '',
  page: '1'
};

const formatShortThaiTime = (iso) => {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(iso);
  }
};

export const DevLogsView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ logs: [], total: 0, stats: { total: 0, errors: 0, submits: 0, saves: 0 }, universities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const f = useMemo(() => {
    const out = {};
    for (const [k, d] of Object.entries(DEFAULTS)) out[k] = searchParams.get(k) ?? d;
    return out;
  }, [searchParams]);

  const page = Math.max(1, Number(f.page) || 1);

  const setFilters = useCallback((patch, { reset = false } = {}) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(reset ? '' : prev);
      if (!('page' in patch)) next.delete('page');
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '' || v === DEFAULTS[k]) next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (f.uni) p.set('universityId', f.uni);
    if (f.action) p.set('action', f.action);
    if (f.entryKey) p.set('entryKey', f.entryKey);
    if (f.status) p.set('status', f.status);
    if (f.role) p.set('role', f.role);
    if (f.q.trim()) p.set('q', f.q.trim());
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String((page - 1) * PAGE_SIZE));
    return p.toString();
  }, [f, page]);

  const csvHref = useMemo(() => {
    const p = new URLSearchParams();
    if (f.uni) p.set('universityId', f.uni);
    if (f.action) p.set('action', f.action);
    if (f.entryKey) p.set('entryKey', f.entryKey);
    if (f.status) p.set('status', f.status);
    if (f.role) p.set('role', f.role);
    if (f.q.trim()) p.set('q', f.q.trim());
    const qs = p.toString();
    return publicUrl(`/api/dev/logs.csv${qs ? `?${qs}` : ''}`);
  }, [f]);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.get(`/dev/logs?${queryString}`);
      setData(res);
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message || 'โหลดบันทึกการทำงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const hasCustomFilter = Boolean(f.uni || f.action || f.entryKey || f.status || f.role || f.q.trim());
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const selectedLog = selectedIndex != null ? data.logs[selectedIndex] : null;

  return (
    <div className="adm" data-theme="admin">
      {/* Header */}
      <header className="adm-head">
        <div>
          <h1>บันทึกหลักฐานการทำงานของระบบ (System Audit Logs)</h1>
          <p>
            สำหรับนักพัฒนาระบบ (Dev เท่านั้น) — บันทึกทุกการกระทำของผู้ประสานงานและผู้ดูแลระบบพร้อมข้อมูลเปรียบเทียบก่อน-หลัง (Before / After Diff)
          </p>
        </div>
        <div className="adm-head-tools">
          {loadedAt && (
            <span>อัปเดตเมื่อ {loadedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <button type="button" className="btn btn-sm" onClick={load} disabled={loading}>
            <ArrowsClockwise size={16} className={loading ? 'adm-spin' : undefined} /> รีเฟรช
          </button>
          <a className="btn btn-sm btn-primary" href={csvHref}>
            <DownloadSimple size={16} weight="bold" /> ส่งออก CSV ({data.total.toLocaleString()} รายการ)
          </a>
        </div>
      </header>

      {/* Pulse strip */}
      <section className="adm-pulse" aria-label="ภาพรวมบันทึกการทำงาน">
        <button
          type="button"
          className="adm-pulse-item"
          aria-pressed={!f.action && !f.status}
          onClick={() => setFilters({ action: '', status: '' })}
        >
          <span className="adm-pulse-label">บันทึกเหตุการณ์ทั้งหมด</span>
          <span className="adm-pulse-figure">{data.stats.total.toLocaleString()} <small>รายการ</small></span>
          <span className="adm-pulse-note">คลิกเพื่อแสดงทุกเหตุการณ์ในระบบ</span>
        </button>

        <button
          type="button"
          className="adm-pulse-item"
          aria-pressed={f.action === 'submission.submit'}
          onClick={() => setFilters({ action: f.action === 'submission.submit' ? '' : 'submission.submit', status: '' })}
        >
          <span className="adm-pulse-label">การยืนยันส่งผลงานสำเร็จ</span>
          <span className="adm-pulse-figure">{data.stats.submits.toLocaleString()} <small>ครั้ง</small></span>
          <span className="adm-pulse-note">พร้อมรหัสอ้างอิงและจำนวนสมาชิก</span>
        </button>

        <button
          type="button"
          className="adm-pulse-item"
          aria-pressed={f.action === 'submission.save_draft'}
          onClick={() => setFilters({ action: f.action === 'submission.save_draft' ? '' : 'submission.save_draft', status: '' })}
        >
          <span className="adm-pulse-label">การแก้ไขฉบับร่างที่มีการเปลี่ยนแปลง</span>
          <span className="adm-pulse-figure">{data.stats.saves.toLocaleString()} <small>ครั้ง</small></span>
          <span className="adm-pulse-note">บันทึกเฉพาะครั้งที่ข้อมูลเปลี่ยนจริง</span>
        </button>

        <button
          type="button"
          className="adm-pulse-item"
          aria-pressed={f.status === 'error'}
          onClick={() => setFilters({ status: f.status === 'error' ? '' : 'error', action: '' })}
        >
          <span className="adm-pulse-label">รายการที่เกิดข้อผิดพลาด / ถูกปฏิเสธ</span>
          <span className={`adm-pulse-figure ${data.stats.errors > 0 ? 'is-alert' : ''}`}>
            {data.stats.errors.toLocaleString()} <small>ครั้ง</small>
          </span>
          <span className="adm-pulse-note">รหัสผ่านผิด, ข้อมูลไม่ครบ, หรือส่งซ้ำ</span>
        </button>
      </section>

      {/* Main Workspace */}
      <section className="adm-work" aria-label="ตารางบันทึกหลักฐาน">
        <div className="adm-filters">
          <label className="adm-field adm-field--grow">
            <span>ค้นหา (ชื่อผู้ใช้, มหาวิทยาลัย, รายการ, รหัสอ้างอิง, IP, สรุปเหตุการณ์)</span>
            <span className="adm-search">
              <MagnifyingGlass size={16} />
              <input
                type="search"
                className="adm-input"
                placeholder="พิมพ์คำค้นหา เช่น kmutt, สมชาย, theory.g0, รหัสอ้างอิง…"
                value={f.q}
                onChange={(e) => setFilters({ q: e.target.value })}
              />
            </span>
          </label>

          <label className="adm-field">
            <span>มหาวิทยาลัย</span>
            <select className="adm-select" value={f.uni} onChange={(e) => setFilters({ uni: e.target.value })}>
              <option value="">ทุกมหาวิทยาลัย</option>
              {data.universities.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.code.toUpperCase()} — {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>ประเภทการกระทำ</span>
            <select className="adm-select" value={f.action} onChange={(e) => setFilters({ action: e.target.value })}>
              {ACTION_FILTERS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>รายการแข่งขัน</span>
            <select className="adm-select" value={f.entryKey} onChange={(e) => setFilters({ entryKey: e.target.value })}>
              <option value="">ทุกรายการแข่งขัน (18 รายการ)</option>
              {ENTRY_OPTIONS.map(e => (
                <option key={e.key} value={e.key}>{e.key} — {e.label}</option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>สถานะ</span>
            <select className="adm-select" style={{ width: '160px' }} value={f.status} onChange={(e) => setFilters({ status: e.target.value })}>
              {STATUS_FILTERS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>บทบาท</span>
            <select className="adm-select" style={{ width: '175px' }} value={f.role} onChange={(e) => setFilters({ role: e.target.value })}>
              {ROLE_FILTERS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>

          {hasCustomFilter && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ height: 'var(--control-h)' }}
              onClick={() => setFilters({}, { reset: true })}
            >
              ล้างตัวกรอง
            </button>
          )}

          <div className="adm-count">
            พบ <strong>{data.total.toLocaleString()}</strong> รายการ
            {totalPages > 1 ? ` (หน้า ${page}/${totalPages})` : ''}
          </div>
        </div>

        {error && (
          <div className="adm-state adm-state--error" role="alert">
            <strong>โหลดข้อมูลไม่สำเร็จ</strong>
            <p>{error}</p>
            <button type="button" className="btn btn-sm" onClick={load}>ลองอีกครั้ง</button>
          </div>
        )}

        {!error && loading && data.logs.length === 0 && (
          <div className="adm-skel" aria-label="กำลังโหลดบันทึก">
            <span /><span /><span /><span />
          </div>
        )}

        {!error && !loading && data.logs.length === 0 && (
          <div className="adm-state">
            <strong>ไม่พบบันทึกการทำงานที่ตรงกับเงื่อนไข</strong>
            <p>ลองเปลี่ยนตัวกรองหรือกด “ล้างตัวกรอง” เพื่อดูประวัติการทำงานทั้งหมด</p>
          </div>
        )}

        {!error && data.logs.length > 0 && (
          <>
            <div className="adm-scroll">
              <table className="adm-table adm-people">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>ID</th>
                    <th style={{ width: '155px' }}>วัน-เวลา (ไทย)</th>
                    <th style={{ width: '190px' }}>ผู้ใช้งาน / มหาวิทยาลัย</th>
                    <th style={{ width: '175px' }}>การกระทำ</th>
                    <th style={{ width: '190px' }}>รายการแข่งขัน</th>
                    <th>สรุปสิ่งที่เปลี่ยนแปลง</th>
                    <th style={{ width: '115px' }}>IP Address</th>
                    <th style={{ width: '115px' }}>สถานะ</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>หลักฐาน</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, idx) => {
                    const diff = log.details?.diff;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedIndex(idx)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="num" style={{ fontWeight: 700, color: 'var(--color-ink-2)' }}>#{log.id}</td>
                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                          {formatShortThaiTime(log.createdAt)}
                        </td>
                        <td>
                          <div className="adm-strong">
                            {log.username}
                            {log.universityCode && (
                              <span style={{ marginLeft: '6px', fontSize: '11.5px', padding: '1px 6px', borderRadius: '6px', background: 'var(--color-paper-3)' }}>
                                {log.universityCode.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="adm-sub">
                            {ROLE_LABELS[log.userRole] || log.userRole}
                            {log.universityName ? ` · ${log.universityName}` : ''}
                          </span>
                        </td>
                        <td>
                          <div className="adm-strong">{ACTION_LABELS[log.action] || log.action}</div>
                          <code className="adm-sub" style={{ fontSize: '11.5px' }}>{log.action}</code>
                        </td>
                        <td>
                          {log.entryKey ? (
                            <>
                              <div className="adm-strong">{ENTRY_TITLE_BY_KEY[log.entryKey] || log.entryKey}</div>
                              <code className="adm-sub" style={{ fontSize: '11.5px' }}>{log.entryKey}</code>
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-muted)' }}>–</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{log.summary}</div>
                          {diff && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', fontSize: '12px' }}>
                              {diff.fields?.length > 0 && (
                                <span style={{ padding: '1px 7px', borderRadius: '999px', background: 'var(--color-done-bg)', color: 'var(--color-done)', fontWeight: 600 }}>
                                  แก้ฟิลด์ {diff.fields.length}
                                </span>
                              )}
                              {diff.membersAdded?.length > 0 && (
                                <span style={{ padding: '1px 7px', borderRadius: '999px', background: 'rgba(31, 122, 61, 0.12)', color: '#1F7A3D', fontWeight: 600 }}>
                                  +สมาชิก {diff.membersAdded.length}
                                </span>
                              )}
                              {diff.membersUpdated?.length > 0 && (
                                <span style={{ padding: '1px 7px', borderRadius: '999px', background: 'var(--color-draft-bg)', color: 'var(--color-draft)', fontWeight: 600 }}>
                                  ~แก้สมาชิก {diff.membersUpdated.length}
                                </span>
                              )}
                              {diff.membersRemoved?.length > 0 && (
                                <span style={{ padding: '1px 7px', borderRadius: '999px', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontWeight: 600 }}>
                                  -ลบสมาชิก {diff.membersRemoved.length}
                                </span>
                              )}
                              {(diff.filesAdded?.length > 0 || diff.filesRemoved?.length > 0) && (
                                <span style={{ padding: '1px 7px', borderRadius: '999px', background: 'var(--color-paper-3)', color: 'var(--color-ink)', fontWeight: 600 }}>
                                  ไฟล์ +{diff.filesAdded?.length || 0}/-{diff.filesRemoved?.length || 0}
                                </span>
                              )}
                            </div>
                          )}
                          {log.targetId && (
                            <span className="adm-sub">รหัสอ้างอิง/เป้าหมาย: <code>{log.targetId}</code></span>
                          )}
                        </td>
                        <td className="num">
                          <code style={{ fontSize: '12px' }}>{log.ip || '–'}</code>
                        </td>
                        <td>
                          {log.status === 'error' ? (
                            <span className="adm-status" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                              <WarningCircle size={14} weight="fill" /> {log.errorCode || 'error'}
                            </span>
                          ) : (
                            <span className="adm-status adm-status--submitted">
                              <CheckCircle size={14} weight="fill" /> สำเร็จ
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIndex(idx);
                            }}
                          >
                            <Eye size={15} /> ดูหลักฐาน
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderTop: '1px solid var(--color-rule)',
                background: 'var(--color-paper-3)'
              }}>
                <span style={{ fontSize: '13.5px', color: 'var(--color-ink-2)' }}>
                  หน้า <strong>{page}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด {data.total.toLocaleString()} รายการ)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page <= 1}
                    onClick={() => setFilters({ page: String(page - 1) })}
                  >
                    <CaretLeft size={15} weight="bold" /> ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setFilters({ page: String(page + 1) })}
                  >
                    ถัดไป <CaretRight size={15} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedLog && (
        <DevLogDetailModal
          log={selectedLog}
          entryTitle={selectedLog.entryKey ? ENTRY_TITLE_BY_KEY[selectedLog.entryKey] : ''}
          positionLabel={`${selectedIndex + 1} / ${data.logs.length}`}
          onClose={() => setSelectedIndex(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : null}
          onNext={selectedIndex < data.logs.length - 1 ? () => setSelectedIndex(selectedIndex + 1) : null}
          onCopy={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
};
