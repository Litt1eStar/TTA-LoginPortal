import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { historyRows } from '../../utils/history';
import {
  ClockCounterClockwise,
  Receipt,
  ArrowRight,
  LockSimple,
  PencilSimple,
  CircleDashed,
  FileText,
  LinkSimple
} from '@phosphor-icons/react';

export const HistoryView = () => {
  const { submissions, openTrack, user } = usePortal();
  const navigate = useNavigate();
  const rows = historyRows(submissions);
  const open = (r) => (r.groupIdx != null ? navigate(`/submit/${r.track.id}/${r.groupIdx}`) : openTrack(r.track.id));

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px' }}>
      {/* Header */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        padding: '28px',
        marginBottom: '28px',
        boxShadow: '0 2px 8px rgba(27, 29, 41, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div className="page-kicker">
            <ClockCounterClockwise size={18} weight="bold" />
            <span>ประวัติการส่ง</span>
          </div>
          <h1 className="page-title">ประวัติการส่งผลงาน</h1>
          <p style={{ fontSize: '15px', color: '#4F5366', marginTop: '4px' }}>
            สถาบัน: <strong>{user?.university}</strong> · บัญชีผู้ประสานงาน: <strong>{user?.name}</strong>
          </p>
        </div>
      </div>

      {/* Below 1024px: one card per entry (the table needs 780px) */}
      <ul className="history-cards">
        {rows.map((r) => (
          <li key={r.key} className="history-card">
            <div className="history-card-head">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1B1D29' }}>{r.title}</div>
                <div style={{ fontSize: '13px', color: '#4F5366' }}>{r.subtitle}</div>
              </div>
              <span className="history-chip" style={{ background: r.meta.badgeBg, color: r.meta.badgeColor, border: r.meta.badgeBorder }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: r.meta.dotColor }} />
                {r.meta.label}
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: r.summary ? 700 : 500, color: r.summary ? '#1B1D29' : '#9A9DAD' }}>
              {r.summary || 'ยังไม่มีข้อมูล'}
            </div>
            <div className="history-card-meta">
              <span>{r.timestamp}</span>
              <span>{r.team}</span>
              {(r.filesCount > 0 || r.linksCount > 0) && <span>{r.filesCount} ไฟล์ · {r.linksCount} ลิงก์</span>}
              {r.hash && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0A65B0', fontWeight: 700, fontFamily: 'monospace' }}>
                  <Receipt size={13} weight="bold" />#{r.hash}
                </span>
              )}
            </div>
            <button type="button" className={`btn ${r.isSubmitted ? '' : 'btn-soft-orange'}`} onClick={() => open(r)}>
              <span>{r.action}</span>
              <ArrowRight size={14} weight="bold" />
            </button>
          </li>
        ))}
      </ul>

      {/* History Table (laptops and up) */}
      <div className="history-table" style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1', color: '#4F5366', fontSize: '14px' }}>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>หมวดหมู่</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>รายละเอียด</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>สถานะ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>ทีมผู้จัดทำ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>หลักฐาน / ใบเสร็จ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const { meta, isSubmitted, summary, timestamp, filesCount, linksCount } = r;
                return (
                  <tr
                    key={r.key}
                    style={{
                      borderBottom: '1px solid #F0F1F5',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAFAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* Track Title */}
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#1B1D29' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#4F5366' }}>
                        {r.subtitle}
                      </div>
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: '18px 20px', maxWidth: '240px' }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: summary ? 700 : 500,
                        color: summary ? '#1B1D29' : '#9A9DAD',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {summary || 'ยังไม่มีข้อมูล'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#4F5366', marginTop: '2px' }}>
                        {timestamp}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '18px 20px' }}>
                      <span className="nowrap" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: meta.badgeBg,
                        color: meta.badgeColor,
                        border: meta.badgeBorder
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dotColor }} />
                        <span>{meta.label}</span>
                      </span>
                    </td>

                    {/* Team Count */}
                    <td style={{ padding: '18px 20px', fontSize: '14px', color: '#4A4E5E', fontWeight: 600 }}>
                      {r.team}
                    </td>

                    {/* Receipt Hash & Deliverables */}
                    <td style={{ padding: '18px 20px' }}>
                      {r.hash ? (
                        <div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#EAF5FE',
                            color: '#0A65B0',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}>
                            <Receipt size={13} weight="bold" />
                            <span>#{r.hash}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#4F5366', marginTop: '4px' }}>
                            {filesCount} ไฟล์ · {linksCount} ลิงก์
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#6B6F80' }}>
                          {filesCount || linksCount ? `${filesCount} ไฟล์ · ${linksCount} ลิงก์` : '-'}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => open(r)}
                        style={{
                          background: isSubmitted ? '#FAFAFC' : '#FFF1EB',
                          border: isSubmitted ? '1px solid #ECECF1' : '1px solid rgba(255, 95, 28, 0.25)',
                          color: isSubmitted ? '#4A4E5E' : '#C2410C',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{r.action}</span>
                        <ArrowRight size={13} weight="bold" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
