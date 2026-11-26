import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DownloadSimple, FileZip, ArrowsClockwise, UsersThree, Certificate, MagnifyingGlass,
  Table, ListBullets, WarningCircle, X, CheckCircle, PencilSimpleLine
} from '@phosphor-icons/react';
import { api } from '../../api';
import { usePortal } from '../../context/PortalContext';
import { useSwapTransition } from '../../hooks/useSwapTransition';
import { TRACKS, groupShortName } from '../../data/tracks';
import { getOverviewItems } from '../../utils/entries';
import { StatusCell, isIncompleteDraft } from './StatusChip';
import { EntryDetailModal } from './EntryDetailModal';
import { DriveCard } from './DriveCard';
import { DriveTestCard } from './DriveTestCard';
import './admin.css';

// All 18 submission columns, in the same order as the coordinator dashboard
const COLUMNS = getOverviewItems({}).map(it => ({
  key: it.key,
  trackId: it.track.id,
  title: it.track.th,
  sub: it.groupLabel ? groupShortName(it.groupLabel) : ''
}));

const CELL_FILTERS = [
  { id: 'all', label: 'ทุกสถานะ' },
  { id: 'submitted', label: 'ส่งแล้ว' },
  { id: 'draft', label: 'ฉบับร่าง' },
  { id: 'incomplete', label: 'ฉบับร่างที่ยังขาดข้อมูล' },
  { id: 'not_started', label: 'ยังไม่เริ่ม' }
];

const ROW_FILTERS = [
  { id: 'all', label: 'ทุกมหาวิทยาลัย' },
  { id: 'incomplete', label: 'ยังส่งไม่ครบ' },
  { id: 'none', label: 'ยังไม่ส่งเลย' }
];

const GROUP_OPTIONS = [
  { id: 'all', label: 'ทุกกลุ่มผู้รับ', labelTh: '' },
  { id: 'competitor', label: 'ผู้แข่งขัน', labelTh: 'ผู้แข่งขัน' },
  { id: 'advisor', label: 'อาจารย์ที่ปรึกษา', labelTh: 'อาจารย์ที่ปรึกษา' },
  { id: 'participant', label: 'ผู้เข้าร่วม', labelTh: 'ผู้เข้าร่วม' }
];

const ENTRY_STATUS = [
  { id: 'all', label: 'ทุกสถานะ' },
  { id: 'submitted', label: 'ส่งแล้ว' },
  { id: 'draft', label: 'ฉบับร่าง' }
];

const STATUS_LABEL = { submitted: 'ส่งแล้ว', draft: 'ฉบับร่าง', not_started: 'ยังไม่เริ่ม' };

// Every filter lives in the URL; a value equal to its default is left out
const DEFAULTS = { view: 'matrix', uni: 'all', track: 'all', cell: 'all', rows: 'all', q: '', group: 'all', est: 'submitted', photo: '' };

// Same fields as the server's export filter (server/src/admin.js, memberSearchText)
const memberSearchText = (m) =>
  [m.certName, m.fullName, m.studentId, m.email, m.phone, m.role, m.certCompetition, m.university, m.dept]
    .map(v => v || '').join(' ').toLowerCase();

export const AdminView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { university, column }
  const [zipKey, setZipKey] = useState(TRACKS[0].id);
  const [loadedAt, setLoadedAt] = useState(null);
  const [previewMember, setPreviewMember] = useState(null);

  const f = useMemo(() => {
    const out = {};
    for (const [k, d] of Object.entries(DEFAULTS)) out[k] = searchParams.get(k) ?? d;
    out.view = out.view === 'people' ? 'directory' : 'matrix';
    return out;
  }, [searchParams]);

  const setFilters = useCallback((patch, { reset = false } = {}) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(reset ? '' : prev);
      for (const [k, v] of Object.entries(patch)) {
        const value = k === 'view' ? (v === 'directory' ? 'people' : v) : v;
        if (value === undefined || value === null || value === DEFAULTS[k] || (k === 'view' && value === 'matrix')) next.delete(k);
        else next.set(k, value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const viewMode = f.view;
  const viewSwap = useSwapTransition(viewMode, {
    keyOf: (m) => m,
    orderOf: (m) => (m === 'directory' ? 1 : 0),
    outMs: 105
  });

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setOverview(await api.get('/admin/overview'));
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Google OAuth comes back with ?google=…; drop only that key so the filters stay
  useEffect(() => {
    const g = searchParams.get('google');
    if (!g) return;
    if (g === 'connected') showToast('เชื่อมต่อ Google Drive เรียบร้อยแล้ว');
    else if (g === 'denied') showToast('ยกเลิกการเชื่อมต่อ Google Drive แล้ว');
    else if (g === 'error') showToast('เชื่อมต่อ Google Drive ไม่สำเร็จ กรุณาลองใหม่');
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('google'); return next; }, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  useEffect(() => {
    if (!previewMember) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPreviewMember(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMember]);

  const closeDetail = useCallback(() => setSelected(null), []);

  const onUnlocked = (entry) => {
    const { university, column } = selected;
    setOverview(o => ({
      ...o,
      entries: {
        ...o.entries,
        [university.id]: { ...o.entries[university.id], [column.key]: { status: entry.status, submittedAt: entry.submittedAt } }
      }
    }));
    showToast(`ปลดล็อก ${column.title}${column.sub ? ` (${column.sub})` : ''} ของ ${university.name} แล้ว`);
    load();
  };

  const statusOf = useCallback((uid, key) => overview?.entries?.[uid]?.[key]?.status || 'not_started', [overview]);
  const summaryOf = useCallback((uid, key) => overview?.summaries?.[uid]?.[key], [overview]);
  const warnOf = useCallback((uid, key) => isIncompleteDraft(statusOf(uid, key), summaryOf(uid, key)), [statusOf, summaryOf]);
  const submittedCount = useCallback((uid) => COLUMNS.filter(c => statusOf(uid, c.key) === 'submitted').length, [statusOf]);

  const universities = useMemo(() => overview?.universities || [], [overview]);
  const allMembers = useMemo(() => overview?.members || [], [overview]);

  const stats = useMemo(() => {
    let submittedEntries = 0;
    let incompleteDrafts = 0;
    for (const u of universities) {
      for (const c of COLUMNS) {
        if (statusOf(u.id, c.key) === 'submitted') submittedEntries += 1;
        else if (warnOf(u.id, c.key)) incompleteDrafts += 1;
      }
    }
    return {
      totalEntries: universities.length * COLUMNS.length,
      submittedEntries,
      incompleteDrafts,
      noSubmission: universities.filter(u => submittedCount(u.id) === 0).length,
      missingPhotos: allMembers.filter(m => !m.hasPhoto).length,
      competitors: allMembers.filter(m => m.recipientGroup === 'ผู้แข่งขัน').length,
      advisors: allMembers.filter(m => m.recipientGroup === 'อาจารย์ที่ปรึกษา').length,
      participants: allMembers.filter(m => m.recipientGroup === 'ผู้เข้าร่วม').length
    };
  }, [universities, allMembers, statusOf, warnOf, submittedCount]);

  // ---------- Ledger (matrix) ----------
  const visibleColumns = useMemo(() => COLUMNS.filter(c => f.track === 'all' || c.trackId === f.track), [f.track]);

  const cellMatches = useCallback((uid, key) => {
    if (f.cell === 'all') return true;
    if (f.cell === 'incomplete') return warnOf(uid, key);
    return statusOf(uid, key) === f.cell;
  }, [f.cell, statusOf, warnOf]);

  const visibleUniversities = useMemo(() => universities.filter(u => {
    if (f.uni !== 'all' && String(u.id) !== f.uni) return false;
    const done = submittedCount(u.id);
    if (f.rows === 'incomplete' && done >= COLUMNS.length) return false;
    if (f.rows === 'none' && done > 0) return false;
    if (f.cell !== 'all' && !visibleColumns.some(c => cellMatches(u.id, c.key))) return false;
    return true;
  }), [universities, f.uni, f.rows, f.cell, visibleColumns, cellMatches, submittedCount]);

  // Prev / Next in EntryDetailModal walk only the cells on screen
  const navCells = useMemo(() => {
    const out = [];
    for (const u of visibleUniversities) {
      for (const c of visibleColumns) out.push({ university: u, column: c });
    }
    return out;
  }, [visibleUniversities, visibleColumns]);

  const selectedIndex = selected
    ? navCells.findIndex(item => item.university.id === selected.university.id && item.column.key === selected.column.key)
    : -1;

  // ---------- People (directory) and the export that matches it ----------
  const directoryMembers = useMemo(() => {
    const q = f.q.trim().toLowerCase().slice(0, 200);
    const groupLabel = GROUP_OPTIONS.find(g => g.id === f.group)?.labelTh || '';
    return allMembers.filter(m => {
      if (f.est !== 'all' && m.entryStatus !== f.est) return false;
      if (groupLabel && m.recipientGroup !== groupLabel) return false;
      if (f.uni !== 'all' && String(m.universityId) !== f.uni) return false;
      if (f.track !== 'all' && m.trackId !== f.track) return false;
      if (f.photo === 'missing' && m.hasPhoto) return false;
      if (q && !memberSearchText(m).includes(q)) return false;
      return true;
    });
  }, [allMembers, f.q, f.group, f.est, f.uni, f.track, f.photo]);

  const draftsInSet = useMemo(() => directoryMembers.filter(m => m.entryStatus === 'draft').length, [directoryMembers]);

  const exportQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('status', f.est);
    if (f.group !== 'all') p.set('group', f.group);
    if (f.uni !== 'all') p.set('universityId', f.uni);
    if (f.track !== 'all') p.set('trackId', f.track);
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.photo === 'missing') p.set('missingPhoto', '1');
    return p.toString();
  }, [f.est, f.group, f.uni, f.track, f.q, f.photo]);

  const openMemberEntry = (m) => {
    const university = universities.find(u => u.id === m.universityId);
    const column = COLUMNS.find(c => c.key === m.entryKey);
    if (university && column) setSelected({ university, column });
  };

  const filtersActive = viewMode === 'matrix'
    ? f.uni !== 'all' || f.track !== 'all' || f.cell !== 'all' || f.rows !== 'all'
    : f.uni !== 'all' || f.track !== 'all' || f.group !== 'all' || f.est !== DEFAULTS.est || f.photo !== '' || f.q !== '';
  const clearFilters = () => setFilters({ view: viewMode }, { reset: true });

  const loadedTime = loadedAt ? loadedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const sample = directoryMembers[0];
  const pct = stats.totalEntries ? Math.round((stats.submittedEntries / stats.totalEntries) * 100) : 0;

  const pulseItem = ({ id, label, figure, note, onClick, pressed, alert }) => {
    const body = (
      <>
        <span className="adm-pulse-label">{label}</span>
        <span className={`adm-pulse-figure${alert ? ' is-alert' : ''}`}>{figure}</span>
        {note}
      </>
    );
    return onClick
      ? <button key={id} type="button" className="adm-pulse-item" aria-pressed={pressed} onClick={onClick}>{body}</button>
      : <div key={id} className="adm-pulse-item">{body}</div>;
  };

  const universitySelect = (
    <label className="adm-field">
      มหาวิทยาลัย
      <select className="adm-select" value={f.uni} onChange={(e) => setFilters({ uni: e.target.value })}>
        <option value="all">ทุกมหาวิทยาลัย</option>
        {universities.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
      </select>
    </label>
  );
  const trackSelect = (
    <label className="adm-field">
      ประเภทการแข่งขัน
      <select className="adm-select" value={f.track} onChange={(e) => setFilters({ track: e.target.value })}>
        <option value="all">ทุกประเภท</option>
        {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
      </select>
    </label>
  );

  return (
    <div className="adm" data-theme="admin">
      <header className="adm-head">
        <div>
          <h1>ภาพรวมและส่งออกข้อมูล</h1>
          <p>ตรวจสอบรายชื่อ รูปถ่าย สถานะการส่ง และส่งออกไฟล์ CSV สำหรับทำใบเกียรติบัตร</p>
        </div>
        <div className="adm-head-tools">
          {loadedTime && <span>อัปเดตล่าสุด <span className="num">{loadedTime}</span> น.</span>}
          <button type="button" className="btn btn-sm" onClick={load} disabled={loading} aria-busy={loading}>
            <ArrowsClockwise size={16} /> {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </button>
        </div>
      </header>

      {/* Attention strip: each figure filters the table to exactly the set it counts */}
      {(overview || !error) && <section className="adm-pulse" aria-label="สรุปสิ่งที่ต้องติดตาม">
        {!overview ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} className="adm-pulse-item" aria-hidden="true">
              <span className="adm-skel-figure" />
            </div>
          ))
        ) : (
          <>
            {pulseItem({
              id: 'done',
              label: 'รายการที่ส่งแล้ว',
              figure: <>{stats.submittedEntries} <small>/ {stats.totalEntries} รายการ</small></>,
              note: <span className="adm-meter" role="img" aria-label={`ส่งแล้ว ${pct}%`}><span style={{ transform: `scaleX(${pct / 100})` }} /></span>,
              onClick: stats.submittedEntries ? () => setFilters({ view: 'matrix', cell: 'submitted' }, { reset: true }) : null,
              pressed: viewMode === 'matrix' && f.cell === 'submitted'
            })}
            {pulseItem({
              id: 'incomplete',
              label: 'ฉบับร่างที่ยังขาดข้อมูล',
              figure: <>{stats.incompleteDrafts} <small>รายการ</small></>,
              note: <span className="adm-pulse-note">{stats.incompleteDrafts ? 'ขาดไฟล์ ข้อมูล หรือรูปถ่าย' : 'ไม่มีฉบับร่างที่ขาดข้อมูล'}</span>,
              onClick: stats.incompleteDrafts ? () => setFilters({ view: 'matrix', cell: 'incomplete' }, { reset: true }) : null,
              pressed: viewMode === 'matrix' && f.cell === 'incomplete',
              alert: stats.incompleteDrafts > 0
            })}
            {pulseItem({
              id: 'none',
              label: 'มหาวิทยาลัยที่ยังไม่ส่งเลย',
              figure: <>{stats.noSubmission} <small>/ {universities.length} แห่ง</small></>,
              note: <span className="adm-pulse-note">{stats.noSubmission ? 'ยังไม่มีรายการที่ส่งแล้ว' : 'ทุกแห่งส่งแล้วอย่างน้อย 1 รายการ'}</span>,
              onClick: stats.noSubmission ? () => setFilters({ view: 'matrix', rows: 'none' }, { reset: true }) : null,
              pressed: viewMode === 'matrix' && f.rows === 'none',
              alert: stats.noSubmission > 0
            })}
            {pulseItem({
              id: 'photos',
              label: 'รายชื่อที่ขาดรูปถ่าย',
              figure: <>{stats.missingPhotos} <small>/ {allMembers.length} คน</small></>,
              note: <span className="adm-pulse-note">{stats.missingPhotos ? 'คลิกเพื่อดูรายชื่อ' : 'รูปถ่ายครบทุกคน'}</span>,
              onClick: stats.missingPhotos ? () => setFilters({ view: 'directory', photo: 'missing', est: 'all' }, { reset: true }) : null,
              pressed: viewMode === 'directory' && f.photo === 'missing',
              alert: stats.missingPhotos > 0
            })}
          </>
        )}
      </section>}

      {/* Workspace */}
      <section className="adm-work" aria-label="ตรวจสอบข้อมูล">
        <div className="adm-tabs" role="tablist" aria-label="มุมมองตรวจสอบข้อมูล">
          <button type="button" role="tab" className="adm-tab" aria-selected={viewMode === 'matrix'} onClick={() => setFilters({ view: 'matrix' })}>
            <Table size={18} weight="bold" /> ติดตามการส่ง
          </button>
          <button type="button" role="tab" className="adm-tab" aria-selected={viewMode === 'directory'} onClick={() => setFilters({ view: 'directory' })}>
            <ListBullets size={18} weight="bold" /> รายชื่อและส่งออก {overview && <span className="num">{allMembers.length}</span>}
          </button>
          {viewMode === 'matrix' && (
            <div className="adm-tabs-end" aria-label="คำอธิบายสัญลักษณ์">
              <span className="adm-legend"><CheckCircle size={14} weight="fill" color="var(--color-done)" /> ส่งแล้ว</span>
              <span className="adm-legend"><PencilSimpleLine size={14} weight="bold" color="var(--color-draft)" /> ฉบับร่าง</span>
              <span className="adm-legend"><WarningCircle size={14} weight="fill" color="var(--color-error)" /> ร่างที่ขาดข้อมูล</span>
              <span>ตัวเลข คือ จำนวนคน</span>
            </div>
          )}
        </div>

        {/* Shared filter row */}
        {viewMode === 'matrix' ? (
          <div className="adm-filters">
            {universitySelect}
            {trackSelect}
            <label className="adm-field">
              สถานะรายการ
              <select className="adm-select" value={f.cell} onChange={(e) => setFilters({ cell: e.target.value })}>
                {CELL_FILTERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="adm-field">
              ความคืบหน้า
              <select className="adm-select" value={f.rows} onChange={(e) => setFilters({ rows: e.target.value })}>
                {ROW_FILTERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {filtersActive && <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}><X size={14} /> ล้างตัวกรอง</button>}
            {overview && (
              <span className="adm-count">แสดง <strong className="num">{visibleUniversities.length}</strong> / <span className="num">{universities.length}</span> มหาวิทยาลัย</span>
            )}
          </div>
        ) : (
          <div className="adm-filters">
            <label className="adm-field adm-field--grow">
              ค้นหา
              <span className="adm-search">
                <MagnifyingGlass size={16} />
                <input
                  type="search"
                  className="adm-input"
                  value={f.q}
                  onChange={(e) => setFilters({ q: e.target.value })}
                  placeholder="ชื่อ รหัสนักศึกษา อีเมล เบอร์โทร บทบาท"
                />
              </span>
            </label>
            {universitySelect}
            {trackSelect}
            <label className="adm-field">
              กลุ่มผู้รับ
              <select className="adm-select" value={f.group} onChange={(e) => setFilters({ group: e.target.value })}>
                {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </label>
            <label className="adm-field">
              สถานะการส่ง
              <select className="adm-select" value={f.est} onChange={(e) => setFilters({ est: e.target.value })}>
                {ENTRY_STATUS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={f.photo === 'missing'} onChange={(e) => setFilters({ photo: e.target.checked ? 'missing' : '' })} />
              ขาดรูปถ่ายเท่านั้น
            </label>
            {filtersActive && <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}><X size={14} /> ล้างตัวกรอง</button>}
            {overview && (
              <span className="adm-count">พบ <strong className="num">{directoryMembers.length}</strong> / <span className="num">{allMembers.length}</span> คน</span>
            )}
          </div>
        )}

        {/* Export bar: the files contain exactly the rows below */}
        {viewMode === 'directory' && overview && (
          <div className="adm-export">
            <div className="adm-export-what">
              <strong>ส่งออกตามตัวกรองนี้ <span className="num">{directoryMembers.length}</span> คน</strong>
              <span className="adm-export-sample">ไฟล์ใบเกียรติบัตรมีคอลัมน์ “ชื่อ-นามสกุล (สำหรับใบเกียรติบัตร)” ที่คำนำหน้าติดกับชื่อ และ “รายการแข่งขัน (สำหรับใบเกียรติบัตร)” พร้อมนำเข้า Canva Bulk Create หรือ Excel</span>
              {sample ? (
                <span className="adm-export-sample">
                  <span>แถวแรก <b>{sample.certName}</b></span>
                  <span>{sample.recipientGroup} ({sample.role})</span>
                  <span>{sample.certCompetition}</span>
                  <span>{sample.university}</span>
                </span>
              ) : (
                <span className="adm-export-sample">ไม่มีรายชื่อตรงกับตัวกรอง ไฟล์จะมีเฉพาะหัวตาราง</span>
              )}
            </div>
            <div className="adm-export-actions">
              <a className="btn btn-sm btn-primary" href={`/api/admin/certificates.csv?${exportQuery}`} download>
                <Certificate size={16} weight="bold" /> ใบเกียรติบัตร (.csv)
              </a>
              <a className="btn btn-sm" href={`/api/admin/export.csv?${exportQuery}`} download>
                <DownloadSimple size={16} /> ข้อมูลดิบ (.csv)
              </a>
            </div>
            {draftsInSet > 0 && (
              <div className="adm-export-warn" role="status">
                <WarningCircle size={16} weight="fill" />
                <span>ชุดนี้มีรายชื่อจากฉบับร่าง <span className="num">{draftsInSet}</span> คน ใบเกียรติบัตรควรใช้เฉพาะรายการที่ส่งแล้ว</span>
                <button type="button" className="adm-link-btn" onClick={() => setFilters({ est: 'submitted' })}>แสดงเฉพาะที่ส่งแล้ว</button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="adm-state adm-state--error" role="alert">
            <strong>{error}</strong>
            <p>ข้อมูลที่แสดงอาจไม่เป็นปัจจุบัน ตรวจสอบการเชื่อมต่อแล้วลองโหลดใหม่</p>
            <button type="button" className="btn btn-sm" onClick={load}><ArrowsClockwise size={16} /> ลองใหม่</button>
          </div>
        )}
        {!overview && !error && (
          <div className="adm-skel" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
            {[0, 1, 2, 3, 4, 5].map(i => <span key={i} />)}
          </div>
        )}

        {overview && (
          <div key={viewSwap.displayedKey} className={viewSwap.className} style={{ ...viewSwap.style, '--swap-in-ms': '220ms' }}>
            {viewSwap.displayed === 'matrix' && (
              <div className="adm-scroll">
                <table className="adm-table adm-ledger">
                  <thead>
                    <tr>
                      <th scope="col" className="adm-rowhead">มหาวิทยาลัย</th>
                      {visibleColumns.map(c => (
                        <th scope="col" key={c.key} className="adm-col">
                          {c.title}
                          {c.sub && <span className="adm-sub">{c.sub}</span>}
                        </th>
                      ))}
                      <th scope="col" className="adm-total">ส่งแล้ว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUniversities.length === 0 && (
                      <tr>
                        <td colSpan={visibleColumns.length + 2}>
                          <div className="adm-state">
                            <strong>ไม่มีมหาวิทยาลัยที่ตรงกับตัวกรอง</strong>
                            <button type="button" className="btn btn-sm" onClick={clearFilters}>ล้างตัวกรอง</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {visibleUniversities.map(u => {
                      const done = submittedCount(u.id);
                      return (
                        <tr key={u.id}>
                          <th scope="row" className="adm-rowhead">
                            <span className="adm-strong">{u.name}</span>
                            <span className="adm-sub">{u.code}</span>
                          </th>
                          {visibleColumns.map(c => (
                            <td key={c.key} className="adm-cellwrap">
                              <StatusCell
                                status={statusOf(u.id, c.key)}
                                summary={summaryOf(u.id, c.key)}
                                dim={!cellMatches(u.id, c.key)}
                                title={`${u.name} ${c.title}${c.sub ? ` (${c.sub})` : ''}`}
                                onClick={() => setSelected({ university: u, column: c })}
                              />
                            </td>
                          ))}
                          <td className="adm-total">
                            <span className="num adm-strong">{done}/{COLUMNS.length}</span>
                            <span className="adm-meter" aria-hidden="true"><span style={{ transform: `scaleX(${done / COLUMNS.length})` }} /></span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="adm-rowhead">ส่งแล้ว (มหาวิทยาลัย)</th>
                      {visibleColumns.map(c => (
                        <td key={c.key} className="num">
                          {universities.filter(u => statusOf(u.id, c.key) === 'submitted').length}/{universities.length}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {viewSwap.displayed === 'directory' && (
              allMembers.length === 0 ? (
                <div className="adm-state">
                  <strong>ยังไม่มีรายชื่อในระบบ</strong>
                  <p>รายชื่อจะปรากฏที่นี่เมื่อผู้ประสานงานของแต่ละมหาวิทยาลัยเพิ่มสมาชิกในรายการ</p>
                  <button type="button" className="btn btn-sm" onClick={load}><ArrowsClockwise size={16} /> โหลดใหม่</button>
                </div>
              ) : (
                <div className="adm-scroll">
                  <table className="adm-table adm-people">
                    <thead>
                      <tr>
                        <th scope="col">รูป</th>
                        <th scope="col">ชื่อสำหรับใบเกียรติบัตร</th>
                        <th scope="col">บทบาท / กลุ่ม</th>
                        <th scope="col">รายการแข่งขัน</th>
                        <th scope="col">มหาวิทยาลัย / หน่วยงาน</th>
                        <th scope="col">รหัส / ติดต่อ</th>
                        <th scope="col">สถานะ</th>
                        <th scope="col">ดูรายการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directoryMembers.length === 0 && (
                        <tr>
                          <td colSpan={8}>
                            <div className="adm-state">
                              <strong>ไม่พบรายชื่อที่ตรงกับตัวกรอง</strong>
                              <button type="button" className="btn btn-sm" onClick={clearFilters}>ล้างตัวกรอง</button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {directoryMembers.map((m, idx) => (
                        <tr key={`${m.universityId}-${m.entryKey}-${m.memberId}-${idx}`}>
                          <td>
                            {m.hasPhoto && m.photoDataUrl ? (
                              <button type="button" className="adm-thumb" onClick={() => setPreviewMember(m)} aria-label={`ขยายรูปถ่าย ${m.fullName}`}>
                                <img src={m.photoDataUrl} alt="" width="42" height="42" />
                              </button>
                            ) : (
                              <span className="adm-missing"><WarningCircle size={14} weight="fill" /> ขาดรูป</span>
                            )}
                          </td>
                          <td>
                            <span className="adm-strong">{m.certName}</span>
                            <span className="adm-sub">{m.title || '-'} / {m.fullName}</span>
                          </td>
                          <td>
                            <span className="adm-strong">{m.role}</span>
                            <span className="adm-sub">{m.recipientGroup}</span>
                          </td>
                          <td>{m.certCompetition}</td>
                          <td>
                            <span className="adm-strong">{m.university}</span>
                            <span className="adm-sub">{m.dept || '–'}</span>
                          </td>
                          <td>
                            <span>{m.studentId ? `${m.studentId}${m.year ? ` (ปี ${m.year})` : ''}` : '–'}</span>
                            <span className="adm-sub">{m.email || m.phone || ''}</span>
                          </td>
                          <td><span className={`adm-status adm-status--${m.entryStatus}`}>{STATUS_LABEL[m.entryStatus] || m.entryStatus}</span></td>
                          <td><button type="button" className="btn btn-sm" onClick={() => openMemberEntry(m)}>เปิด</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Whole-event files and storage */}
      <div className="adm-foot">
        <section className="adm-files" aria-labelledby="files-title">
          <h2 id="files-title">ไฟล์รวมสำหรับดาวน์โหลด</h2>
          <div className="adm-files-row">
            <span className="adm-files-title">รายชื่อและรูปถ่ายทั้งหมด (.zip)</span>
            <p>โฟลเดอร์ตามมหาวิทยาลัยและประเภท มีไฟล์รายชื่อ (CSV) และรูปชื่อ ProfileImage_มหาวิทยาลัย_รหัสนักศึกษา</p>
            {overview && (
              <p>
                ผู้แข่งขัน <span className="num">{stats.competitors}</span> คน, อาจารย์ <span className="num">{stats.advisors}</span> คน, ผู้เข้าร่วม <span className="num">{stats.participants}</span> คน
              </p>
            )}
            <div className="adm-files-act">
              <a className="btn btn-sm" href="/api/admin/members.zip" download>
                <UsersThree size={16} /> ดาวน์โหลดรายชื่อ + รูปถ่าย
              </a>
            </div>
          </div>
          <div className="adm-files-row">
            <span className="adm-files-title">ไฟล์ผลงานตามประเภท (.zip)</span>
            <p>รูปถ่ายและไฟล์ผลงานของทุกมหาวิทยาลัย แยกโฟลเดอร์ตามมหาวิทยาลัย สื่อสร้างสรรค์มีไฟล์ links.txt สำหรับลิงก์วิดีโอ</p>
            <div className="adm-files-act">
              <label className="adm-field">
                ประเภท
                <select id="zip-key" className="adm-select" value={zipKey} onChange={(e) => setZipKey(e.target.value)}>
                  {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
                </select>
              </label>
              <a className="btn btn-sm" href={`/api/admin/files.zip?key=${encodeURIComponent(zipKey)}`} download style={{ alignSelf: 'flex-end' }}>
                <FileZip size={16} /> ดาวน์โหลด .zip
              </a>
            </div>
          </div>
        </section>

        <DriveCard />
        <DriveTestCard />
      </div>

      {selected && (
        <EntryDetailModal
          university={selected.university}
          column={selected.column}
          onClose={closeDetail}
          onUnlocked={onUnlocked}
          positionLabel={selectedIndex >= 0 ? `${selectedIndex + 1} / ${navCells.length}` : ''}
          onPrev={selectedIndex > 0 ? () => setSelected(navCells[selectedIndex - 1]) : null}
          onNext={selectedIndex >= 0 && selectedIndex < navCells.length - 1 ? () => setSelected(navCells[selectedIndex + 1]) : null}
        />
      )}

      {previewMember && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewMember(null); }}>
          <div className="modal adm-lightbox" role="dialog" aria-modal="true" aria-label="ดูรูปถ่ายขนาดใหญ่" style={{ width: 'min(100%, 460px)' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{previewMember.certName}</div>
                <div className="adm-note">{previewMember.role}, {previewMember.university}</div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPreviewMember(null)} aria-label="ปิดรูป"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center' }}>
              <img src={previewMember.photoDataUrl} alt={previewMember.fullName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
