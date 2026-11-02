import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, DownloadSimple, FileZip, ArrowsClockwise, UsersThree } from '@phosphor-icons/react';
import { api } from '../../api';
import { usePortal } from '../../context/PortalContext';
import { TRACKS, groupShortName } from '../../data/tracks';
import { getOverviewItems } from '../../utils/entries';
import { StatusChip, StatusCell } from './StatusChip';
import { EntryDetailModal } from './EntryDetailModal';
import { DriveCard } from './DriveCard';

// The 17 columns, in the same order and with the same labels as the dashboard
const COLUMNS = getOverviewItems({}).map(it => ({
  key: it.key,
  title: it.track.th,
  sub: it.groupLabel ? groupShortName(it.groupLabel) : ''
}));

const headCell = { padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'center', verticalAlign: 'bottom' };
const STATUS_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'submitted', label: 'ส่งแล้ว' },
  { id: 'draft', label: 'ร่าง' },
  { id: 'not_started', label: 'ยังไม่เริ่ม' }
];

const stickyCol = { position: 'sticky', left: 0, background: '#FFFFFF', zIndex: 1, textAlign: 'left', padding: '12px 16px', minWidth: '220px' };

export const AdminView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { university, column }
  const [zipKey, setZipKey] = useState(TRACKS[0].id);
  const [statusFilter, setStatusFilter] = useState('all');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);

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
  };

  const statusOf = (uid, key) => overview?.entries?.[uid]?.[key]?.status || 'not_started';
  const submittedCount = (uid) => COLUMNS.filter(c => statusOf(uid, c.key) === 'submitted').length;
  const columnCount = (key) => (overview?.universities || []).filter(u => statusOf(u.id, key) === 'submitted').length;
  // Status filter dims non-matching cells and hides universities with no matching cell
  const visibleUniversities = (overview?.universities || []).filter(u =>
    (!incompleteOnly || submittedCount(u.id) < COLUMNS.length) &&
    (statusFilter === 'all' || COLUMNS.some(c => statusOf(u.id, c.key) === statusFilter)));
  const loadedTime = loadedAt ? loadedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker"><ShieldCheck size={18} weight="bold" /><span>ผู้ดูแลระบบ</span></div>
          <h1 className="page-title">ภาพรวมการส่งผลงาน</h1>
          <p className="page-desc">คลิกช่องในตารางเพื่อดูรายละเอียดและปลดล็อกผลงานที่ส่งแล้ว</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={load}><ArrowsClockwise size={18} /> รีเฟรช</button>
          <a className="btn btn-primary" href="/api/admin/export.csv" download>
            <DownloadSimple size={18} weight="bold" /> ส่งออก CSV รายชื่อ
          </a>
          <a className="btn" href="/api/admin/members.zip" download>
            <UsersThree size={18} /> ดาวน์โหลดรายชื่อ + รูปถ่าย (.zip)
          </a>
        </div>
      </div>

      {/* Zip download */}
      <section className="card" aria-labelledby="zip-title">
        <h2 id="zip-title" className="section-title">ดาวน์โหลดไฟล์ตามประเภท (.zip)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          รูปถ่ายและไฟล์ผลงานของทุกมหาวิทยาลัย แยกโฟลเดอร์ตามมหาวิทยาลัย · สื่อสร้างสรรค์มีไฟล์ links.txt สำหรับลิงก์วิดีโอ
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="zip-key" style={{ fontWeight: 600 }}>ประเภท</label>
          <select id="zip-key" value={zipKey} onChange={(e) => setZipKey(e.target.value)} style={{ minHeight: '44px', borderRadius: '12px', padding: '0 12px', border: '1.5px solid #D5D7E0' }}>
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

      {/* Matrix */}
      <section style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #ECECF1', boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1' }}>
          <strong>สถานะ:</strong>
          <StatusChip status="submitted" /><StatusChip status="draft" /><StatusChip status="not_started" />
          {loadedTime && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>อัปเดตล่าสุด {loadedTime}</span>}
        </div>
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
          {overview && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>({visibleUniversities.length}/{overview.universities.length} มหาวิทยาลัย)</span>}
        </div>
        {error && <p role="alert" style={{ padding: '16px 20px', color: 'var(--danger)' }}>{error}</p>}
        {!overview && !error && <p style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>กำลังโหลด…</p>}
        {overview && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
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
                      {columnCount(c.key)}/{overview.universities.length}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DriveCard />

      {selected && (
        <EntryDetailModal
          university={selected.university}
          column={selected.column}
          onClose={closeDetail}
          onUnlocked={onUnlocked}
        />
      )}
    </div>
  );
};
