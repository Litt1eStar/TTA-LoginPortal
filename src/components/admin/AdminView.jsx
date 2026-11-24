import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, DownloadSimple, FileZip, ArrowsClockwise, UsersThree,
  Certificate, MagnifyingGlass, Table, ListBullets, WarningCircle, X, MagnifyingGlassPlus
} from '@phosphor-icons/react';
import { api } from '../../api';
import { usePortal } from '../../context/PortalContext';
import { TRACKS, groupShortName } from '../../data/tracks';
import { getOverviewItems } from '../../utils/entries';
import { StatusChip, StatusCell } from './StatusChip';
import { EntryDetailModal } from './EntryDetailModal';
import { DriveCard } from './DriveCard';

// All 18 submission columns, in the same order as the coordinator dashboard
const COLUMNS = getOverviewItems({}).map(it => ({
  key: it.key,
  title: it.track.th,
  sub: it.groupLabel ? groupShortName(it.groupLabel) : ''
}));

const headCell = { padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'center', verticalAlign: 'bottom' };
const dirHead = { padding: '10px 12px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'left', whiteSpace: 'nowrap' };
const dirCell = { padding: '10px 12px', fontSize: '13.5px', color: '#1B1D29', verticalAlign: 'top' };

const STATUS_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'submitted', label: 'ส่งแล้ว' },
  { id: 'draft', label: 'ร่าง' },
  { id: 'not_started', label: 'ยังไม่เริ่ม' }
];

const GROUP_OPTIONS = [
  { id: 'all', label: 'ทุกกลุ่มผู้รับ', labelTh: '' },
  { id: 'competitor', label: 'เฉพาะผู้แข่งขัน', labelTh: 'ผู้แข่งขัน' },
  { id: 'advisor', label: 'เฉพาะอาจารย์ที่ปรึกษา', labelTh: 'อาจารย์ที่ปรึกษา' },
  { id: 'participant', label: 'เฉพาะผู้เข้าร่วม', labelTh: 'ผู้เข้าร่วม' }
];

const stickyCol = { position: 'sticky', left: 0, background: '#FFFFFF', zIndex: 1, textAlign: 'left', padding: '12px 16px', minWidth: '220px' };

const selectStyle = {
  minHeight: '42px',
  borderRadius: '12px',
  padding: '0 12px',
  border: '1.5px solid #D5D7E0',
  background: '#FFFFFF',
  fontSize: '14px',
  fontFamily: 'inherit'
};

export const AdminView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { university, column }
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'directory'
  const [zipKey, setZipKey] = useState(TRACKS[0].id);
  const [statusFilter, setStatusFilter] = useState('all');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);

  // Certificate & filtered CSV export controls
  const [exportStatus, setExportStatus] = useState('submitted');
  const [exportGroup, setExportGroup] = useState('all');
  const [exportUniversity, setExportUniversity] = useState('all');
  const [exportTrack, setExportTrack] = useState('all');

  // Directory filters
  const [searchText, setSearchText] = useState('');
  const [dirUniversity, setDirUniversity] = useState('all');
  const [dirTrack, setDirTrack] = useState('all');
  const [dirGroup, setDirGroup] = useState('all');
  const [dirStatus, setDirStatus] = useState('all');
  const [missingPhotoOnly, setMissingPhotoOnly] = useState(false);
  const [previewMember, setPreviewMember] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setOverview(await api.get('/admin/overview'));
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      showToast('เชื่อมต่อ Google Drive เรียบร้อยแล้ว');
      setSearchParams({}, { replace: true });
    }
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
    showToast(`ปลดล็อก ${column.title}${column.sub ? ` · ${column.sub}` : ''} ของ ${university.name} แล้ว`);
    load();
  };

  const statusOf = useCallback((uid, key) => overview?.entries?.[uid]?.[key]?.status || 'not_started', [overview]);
  const summaryOf = useCallback((uid, key) => overview?.summaries?.[uid]?.[key], [overview]);
  const submittedCount = (uid) => COLUMNS.filter(c => statusOf(uid, c.key) === 'submitted').length;
  const columnCount = (key) => (overview?.universities || []).filter(u => statusOf(u.id, key) === 'submitted').length;

  const universities = overview?.universities || [];
  const allMembers = overview?.members || [];

  const stats = useMemo(() => {
    let submittedEntries = 0;
    let draftEntries = 0;
    let draftWithWarnings = 0;
    for (const u of universities) {
      for (const c of COLUMNS) {
        const st = statusOf(u.id, c.key);
        const sm = summaryOf(u.id, c.key);
        if (st === 'submitted') submittedEntries += 1;
        else if (st === 'draft') {
          draftEntries += 1;
          if (sm && (!sm.ready || sm.missingPhotoCount > 0)) draftWithWarnings += 1;
        }
      }
    }
    const competitors = allMembers.filter(m => m.recipientGroup === 'ผู้แข่งขัน').length;
    const advisors = allMembers.filter(m => m.recipientGroup === 'อาจารย์ที่ปรึกษา').length;
    const participants = allMembers.filter(m => m.recipientGroup === 'ผู้เข้าร่วม').length;
    const missingPhotos = allMembers.filter(m => !m.hasPhoto).length;
    return {
      totalEntries: universities.length * COLUMNS.length,
      submittedEntries,
      draftEntries,
      draftWithWarnings,
      competitors,
      advisors,
      participants,
      missingPhotos
    };
  }, [universities, allMembers, statusOf, summaryOf]);

  // Status filter dims non-matching cells and hides universities with no matching cell
  const visibleUniversities = universities.filter(u =>
    (!incompleteOnly || submittedCount(u.id) < COLUMNS.length) &&
    (statusFilter === 'all' || COLUMNS.some(c => statusOf(u.id, c.key) === statusFilter)));

  // Navigation order for Prev / Next in EntryDetailModal
  const navCells = useMemo(() => {
    const out = [];
    for (const u of visibleUniversities) {
      for (const c of COLUMNS) out.push({ university: u, column: c });
    }
    return out;
  }, [visibleUniversities]);

  const selectedIndex = selected
    ? navCells.findIndex(item => item.university.id === selected.university.id && item.column.key === selected.column.key)
    : -1;

  // Live preview of filtered rows matching the certificate CSV settings
  const matchingExportMembers = useMemo(() => {
    const groupLabel = GROUP_OPTIONS.find(g => g.id === exportGroup)?.labelTh || '';
    return allMembers.filter(m => {
      if (exportStatus !== 'all' && m.entryStatus !== exportStatus) return false;
      if (groupLabel && m.recipientGroup !== groupLabel) return false;
      if (exportUniversity !== 'all' && String(m.universityId) !== exportUniversity) return false;
      if (exportTrack !== 'all' && m.trackId !== exportTrack) return false;
      return true;
    });
  }, [allMembers, exportStatus, exportGroup, exportUniversity, exportTrack]);

  const exportQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('status', exportStatus);
    if (exportGroup !== 'all') p.set('group', exportGroup);
    if (exportUniversity !== 'all') p.set('universityId', exportUniversity);
    if (exportTrack !== 'all') p.set('trackId', exportTrack);
    return p.toString();
  }, [exportStatus, exportGroup, exportUniversity, exportTrack]);

  // Filtered list for Directory view
  const directoryMembers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const groupLabel = GROUP_OPTIONS.find(g => g.id === dirGroup)?.labelTh || '';
    return allMembers.filter(m => {
      if (dirUniversity !== 'all' && String(m.universityId) !== dirUniversity) return false;
      if (dirTrack !== 'all' && m.trackId !== dirTrack) return false;
      if (groupLabel && m.recipientGroup !== groupLabel) return false;
      if (dirStatus !== 'all' && m.entryStatus !== dirStatus) return false;
      if (missingPhotoOnly && m.hasPhoto) return false;
      if (q) {
        const hay = `${m.certName} ${m.fullName} ${m.studentId} ${m.email} ${m.phone} ${m.role} ${m.certCompetition} ${m.university} ${m.dept}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allMembers, searchText, dirUniversity, dirTrack, dirGroup, dirStatus, missingPhotoOnly]);

  const openMemberEntry = (m) => {
    const university = universities.find(u => u.id === m.universityId);
    const column = COLUMNS.find(c => c.key === m.entryKey);
    if (university && column) setSelected({ university, column });
  };

  const loadedTime = loadedAt ? loadedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker"><ShieldCheck size={18} weight="bold" /><span>ผู้ดูแลระบบ</span></div>
          <h1 className="page-title">ภาพรวมและส่งออกข้อมูล</h1>
          <p className="page-desc">ตรวจสอบรายชื่อ รูปถ่าย สถานะการส่ง และส่งออกไฟล์ CSV สำหรับทำใบเกียรติบัตร</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={load}><ArrowsClockwise size={18} /> รีเฟรช</button>
          <a className="btn btn-primary" href={`/api/admin/certificates.csv?${exportQuery}`} download>
            <Certificate size={18} weight="bold" /> ส่งออก CSV ใบเกียรติบัตร
          </a>
          <a className="btn" href="/api/admin/members.zip" download>
            <UsersThree size={18} /> ดาวน์โหลดรายชื่อ + รูปถ่าย (.zip)
          </a>
        </div>
      </div>

      {/* Summary KPIs */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div className="card" style={{ padding: '18px 20px', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>รายการที่ส่งแล้ว</span>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)' }}>
              {stats.submittedEntries} <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-light)' }}>/ {stats.totalEntries} รายการ</span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ฉบับร่าง {stats.draftEntries} รายการ{stats.draftWithWarnings > 0 ? ` · ขาดข้อมูล ${stats.draftWithWarnings}` : ''}
            </span>
          </div>

          <div className="card" style={{ padding: '18px 20px', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>รายชื่อทั้งหมดในระบบ</span>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--blue-text)' }}>
              {allMembers.length} <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-light)' }}>คน</span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ผู้แข่งขัน {stats.competitors} · อาจารย์ {stats.advisors} · ผู้เข้าร่วม {stats.participants}
            </span>
          </div>

          <div className="card" style={{ padding: '18px 20px', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>ความครบถ้วนของรูปถ่าย</span>
            <div style={{ fontSize: '26px', fontWeight: 800, color: stats.missingPhotos > 0 ? 'var(--danger)' : '#0B7A4B' }}>
              {stats.missingPhotos > 0 ? `ขาดรูป ${stats.missingPhotos} คน` : 'รูปถ่ายครบทุกคน'}
            </div>
            {stats.missingPhotos > 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ alignSelf: 'flex-start', padding: '0 4px', minHeight: '28px', color: 'var(--danger)' }}
                onClick={() => { setViewMode('directory'); setMissingPhotoOnly(true); }}
              >
                <WarningCircle size={15} weight="fill" /> ดูรายชื่อที่ขาดรูป
              </button>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>จากทั้งหมด {allMembers.length} คน</span>
            )}
          </div>
        </div>
      )}

      {/* Certificate Export Card */}
      <section className="card" aria-labelledby="cert-export-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 id="cert-export-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Certificate size={22} weight="duotone" color="var(--primary)" />
              ส่งออกไฟล์สำหรับทำใบเกียรติบัตร (.csv)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              รวมคอลัมน์ <strong>“ชื่อ-นามสกุล (สำหรับใบเกียรติบัตร)”</strong> (คำนำหน้าติดกับชื่อ เช่น <code>นายสมชาย ใจดี</code>) และ <strong>“รายการแข่งขัน (สำหรับใบเกียรติบัตร)”</strong> พร้อมนำเข้า Canva Bulk Create / Excel
            </p>
          </div>
          {overview && (
            <span style={{ padding: '6px 12px', borderRadius: '999px', background: '#F2F4F8', fontSize: '13px', fontWeight: 700, color: '#1B1D29' }}>
              ตรงตามเงื่อนไข {matchingExportMembers.length} คน
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginTop: '6px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
            สถานะการส่ง
            <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} style={selectStyle}>
              <option value="submitted">เฉพาะที่ส่งแล้ว (แนะนำ)</option>
              <option value="all">ทั้งหมด (รวมฉบับร่าง)</option>
              <option value="draft">เฉพาะฉบับร่าง</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
            กลุ่มผู้รับ
            <select value={exportGroup} onChange={(e) => setExportGroup(e.target.value)} style={selectStyle}>
              {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
            มหาวิทยาลัย
            <select value={exportUniversity} onChange={(e) => setExportUniversity(e.target.value)} style={selectStyle}>
              <option value="all">ทุกมหาวิทยาลัย</option>
              {universities.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
            ประเภทการแข่งขัน
            <select value={exportTrack} onChange={(e) => setExportTrack(e.target.value)} style={selectStyle}>
              <option value="all">ทุกประเภท</option>
              {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
            </select>
          </label>
        </div>

        {matchingExportMembers[0] && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: '#FAFAFC', padding: '10px 14px', borderRadius: '12px', border: '1px solid #ECECF1' }}>
            ตัวอย่างแถวแรก: <strong>{matchingExportMembers[0].certName}</strong> · {matchingExportMembers[0].recipientGroup} ({matchingExportMembers[0].role}) · {matchingExportMembers[0].certCompetition} · {matchingExportMembers[0].university}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
          <a className="btn btn-primary" href={`/api/admin/certificates.csv?${exportQuery}`} download>
            <Certificate size={18} weight="bold" /> ดาวน์โหลด CSV ใบเกียรติบัตร ({matchingExportMembers.length} คน)
          </a>
          <a className="btn" href={`/api/admin/export.csv?${exportQuery}`} download>
            <DownloadSimple size={18} /> ดาวน์โหลด CSV ข้อมูลดิบ (ตามตัวกรองนี้)
          </a>
        </div>
      </section>

      {/* Zip download */}
      <section className="card" aria-labelledby="zip-title">
        <h2 id="zip-title" className="section-title">ดาวน์โหลดไฟล์ตามประเภท (.zip)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          รูปถ่ายและไฟล์ผลงานของทุกมหาวิทยาลัย แยกโฟลเดอร์ตามมหาวิทยาลัย · สื่อสร้างสรรค์มีไฟล์ links.txt สำหรับลิงก์วิดีโอ
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="zip-key" style={{ fontWeight: 600 }}>ประเภท</label>
          <select id="zip-key" value={zipKey} onChange={(e) => setZipKey(e.target.value)} style={selectStyle}>
            {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
          </select>
          <a className="btn" href={`/api/admin/files.zip?key=${encodeURIComponent(zipKey)}`} download>
            <FileZip size={18} /> ดาวน์โหลด .zip
          </a>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginTop: '8px' }}>
          ปุ่ม "ดาวน์โหลดรายชื่อ + รูปถ่าย" ด้านบน: โฟลเดอร์ตามมหาวิทยาลัยและประเภท มีไฟล์รายชื่อ (CSV) และรูปชื่อ ProfileImage_มหาวิทยาลัย_รหัสนักศึกษา
        </p>
      </section>

      {/* Main Inspection Section (Matrix / Directory switcher) */}
      <section style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #ECECF1', boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)', overflow: 'hidden' }}>
        {/* View mode switcher + status legend */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1' }}>
          <div role="tablist" aria-label="มุมมองตรวจสอบข้อมูล" style={{ display: 'inline-flex', background: '#F2F4F8', padding: '4px', borderRadius: '12px', gap: '4px' }}>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'matrix'}
              onClick={() => setViewMode('matrix')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9px',
                fontWeight: 700, fontSize: '14px',
                background: viewMode === 'matrix' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'matrix' ? '#1B1D29' : '#4F5366',
                boxShadow: viewMode === 'matrix' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Table size={16} weight="bold" /> ตาราง 18 รายการ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'directory'}
              onClick={() => setViewMode('directory')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9px',
                fontWeight: 700, fontSize: '14px',
                background: viewMode === 'directory' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'directory' ? '#1B1D29' : '#4F5366',
                boxShadow: viewMode === 'directory' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <ListBullets size={16} weight="bold" /> ค้นหารายชื่อ ({allMembers.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip status="submitted" /><StatusChip status="draft" /><StatusChip status="not_started" />
          </div>
          {loadedTime && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>อัปเดตล่าสุด {loadedTime}</span>}
        </div>

        {error && <p role="alert" style={{ padding: '16px 20px', color: 'var(--danger)' }}>{error}</p>}
        {!overview && !error && <p style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>กำลังโหลด…</p>}

        {/* Matrix view */}
        {overview && viewMode === 'matrix' && (
          <>
            <div style={{ padding: '12px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>แสดง:</span>
              <div role="group" aria-label="กรองตามสถานะ" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map(f => (
                  <button key={f.id} type="button" className={`btn${statusFilter === f.id ? ' btn-primary' : ''}`}
                    aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}
                    style={{ minHeight: '36px', padding: '0 14px' }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', marginLeft: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
                ยังไม่ครบเท่านั้น
              </label>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                ({visibleUniversities.length}/{universities.length} มหาวิทยาลัย · ตัวเลขในช่อง = จำนวนคนในรายการนั้น)
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1580px' }}>
                <thead>
                  <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1' }}>
                    <th style={{ ...headCell, ...stickyCol, background: '#FAFAFC' }}>มหาวิทยาลัย</th>
                    {COLUMNS.map(c => (
                      <th key={c.key} style={headCell}>
                        <div>{c.title}</div>
                        {c.sub && <div style={{ fontWeight: 500, color: 'var(--text-light)' }}>{c.sub}</div>}
                      </th>
                    ))}
                    <th style={headCell}>ส่งแล้ว</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUniversities.length === 0 && (
                    <tr><td colSpan={COLUMNS.length + 2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่มีมหาวิทยาลัยที่ตรงกับตัวกรอง</td></tr>
                  )}
                  {visibleUniversities.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F0F1F5' }}>
                      <th scope="row" style={{ ...stickyCol, fontWeight: 700, fontSize: '14px' }}>
                        <div>{u.name}</div>
                        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-light)' }}>{u.code}</div>
                      </th>
                      {COLUMNS.map(c => (
                        <td key={c.key} style={{ padding: '8px 4px', textAlign: 'center', opacity: statusFilter === 'all' || statusOf(u.id, c.key) === statusFilter ? 1 : 0.2 }}>
                          <StatusCell
                            status={statusOf(u.id, c.key)}
                            summary={summaryOf(u.id, c.key)}
                            title={`${u.name} · ${c.title}${c.sub ? ` · ${c.sub}` : ''}`}
                            onClick={() => setSelected({ university: u, column: c })}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{submittedCount(u.id)}/{COLUMNS.length}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#FAFAFC' }}>
                    <th scope="row" style={{ ...stickyCol, background: '#FAFAFC', fontSize: '13px' }}>ส่งแล้ว (มหาวิทยาลัย)</th>
                    {COLUMNS.map(c => (
                      <td key={c.key} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }}>
                        {columnCount(c.key)}/{universities.length}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Searchable Member Directory view */}
        {overview && viewMode === 'directory' && (
          <>
            <div style={{ padding: '14px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1', background: '#FAFAFC' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                <MagnifyingGlass size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input
                  type="search"
                  className="input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัสนักศึกษา, อีเมล, เบอร์โทร, บทบาท…"
                  style={{ paddingLeft: '36px', minHeight: '42px' }}
                />
              </div>
              <select value={dirUniversity} onChange={(e) => setDirUniversity(e.target.value)} style={selectStyle} aria-label="กรองตามมหาวิทยาลัย">
                <option value="all">ทุกมหาวิทยาลัย</option>
                {universities.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </select>
              <select value={dirTrack} onChange={(e) => setDirTrack(e.target.value)} style={selectStyle} aria-label="กรองตามประเภท">
                <option value="all">ทุกประเภท</option>
                {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
              </select>
              <select value={dirGroup} onChange={(e) => setDirGroup(e.target.value)} style={selectStyle} aria-label="กรองตามกลุ่มผู้รับ">
                {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              <select value={dirStatus} onChange={(e) => setDirStatus(e.target.value)} style={selectStyle} aria-label="กรองตามสถานะ">
                <option value="all">ทุกสถานะ</option>
                <option value="submitted">ส่งแล้วเท่านั้น</option>
                <option value="draft">ฉบับร่างเท่านั้น</option>
              </select>
              <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', fontSize: '13.5px', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={missingPhotoOnly} onChange={(e) => setMissingPhotoOnly(e.target.checked)} />
                ขาดรูปถ่ายเท่านั้น
              </label>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                พบ {directoryMembers.length} / {allMembers.length} คน
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1080px' }}>
                <thead>
                  <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1' }}>
                    <th style={dirHead}>รูป</th>
                    <th style={dirHead}>ชื่อสำหรับใบเกียรติบัตร</th>
                    <th style={dirHead}>บทบาท / กลุ่ม</th>
                    <th style={dirHead}>รายการแข่งขัน</th>
                    <th style={dirHead}>มหาวิทยาลัย / หน่วยงาน</th>
                    <th style={dirHead}>รหัส / ติดต่อ</th>
                    <th style={dirHead}>สถานะ</th>
                    <th style={dirHead}>ดูรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {directoryMembers.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบรายชื่อที่ตรงกับเงื่อนไข</td></tr>
                  )}
                  {directoryMembers.map((m, idx) => (
                    <tr key={`${m.universityId}-${m.entryKey}-${m.memberId}-${idx}`} style={{ borderBottom: '1px solid #F0F1F5' }}>
                      <td style={dirCell}>
                        {m.hasPhoto && m.photoDataUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewMember(m)}
                            title="คลิกเพื่อขยายรูปถ่าย"
                            style={{ position: 'relative', padding: 0, borderRadius: '10px', overflow: 'hidden', display: 'block', background: 'transparent' }}
                          >
                            <img src={m.photoDataUrl} alt={m.fullName} width="42" height="42" style={{ borderRadius: '10px', objectFit: 'cover', display: 'block' }} />
                            <span style={{ position: 'absolute', right: '2px', bottom: '2px', background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '6px', padding: '1px 3px', display: 'grid', placeItems: 'center' }}>
                              <MagnifyingGlassPlus size={11} weight="bold" />
                            </span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontSize: '12.5px', fontWeight: 700 }}>ขาดรูป</span>
                        )}
                      </td>
                      <td style={dirCell}>
                        <div style={{ fontWeight: 700 }}>{m.certName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.title || '-'} / {m.fullName}</div>
                      </td>
                      <td style={dirCell}>
                        <div style={{ fontWeight: 700 }}>{m.role}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.recipientGroup}</div>
                      </td>
                      <td style={dirCell}>{m.certCompetition}</td>
                      <td style={dirCell}>
                        <div style={{ fontWeight: 600 }}>{m.university}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.dept || '–'}</div>
                      </td>
                      <td style={dirCell}>
                        <div>{m.studentId ? `${m.studentId}${m.year ? ` (ปี ${m.year})` : ''}` : '–'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.email || m.phone || ''}</div>
                      </td>
                      <td style={dirCell}><StatusChip status={m.entryStatus} /></td>
                      <td style={dirCell}>
                        <button type="button" className="btn btn-sm" onClick={() => openMemberEntry(m)}>เปิด</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <DriveCard />

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
          <div className="modal" role="dialog" aria-modal="true" aria-label="ดูรูปถ่ายขนาดใหญ่" style={{ width: 'min(100%, 460px)' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{previewMember.certName}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  {previewMember.role} · {previewMember.university}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPreviewMember(null)} aria-label="ปิดรูป"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center' }}>
              <img
                src={previewMember.photoDataUrl}
                alt={previewMember.fullName}
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '14px', background: '#F6F7FB' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
