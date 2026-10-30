import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, DownloadSimple, FileZip, ArrowsClockwise } from '@phosphor-icons/react';
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
const stickyCol = { position: 'sticky', left: 0, background: '#FFFFFF', zIndex: 1, textAlign: 'left', padding: '12px 16px', minWidth: '220px' };

export const AdminView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { university, column }
  const [zipKey, setZipKey] = useState(TRACKS[0].id);

  const load = useCallback(async () => {
    setError('');
    try {
      setOverview(await api.get('/admin/overview'));
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
      </section>

      {/* Matrix */}
      <section style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #ECECF1', boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1' }}>
          <strong>สถานะ:</strong>
          <StatusChip status="submitted" /><StatusChip status="draft" /><StatusChip status="not_started" />
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
                {overview.universities.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F0F1F5' }}>
                    <th scope="row" style={{ ...stickyCol, fontWeight: 700, fontSize: '14px' }}>
                      <div>{u.name}</div>
                      <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-light)' }}>{u.code}</div>
                    </th>
                    {COLUMNS.map(c => (
                      <td key={c.key} style={{ padding: '8px 4px', textAlign: 'center' }}>
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
