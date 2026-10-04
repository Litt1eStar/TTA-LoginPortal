import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { fmtDateTime, statusMeta, teamLabel } from '../../utils/formatters';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF5F1C', marginBottom: '4px' }}>
            <ClockCounterClockwise size={18} weight="bold" />
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
              Submission History & Receipts
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#1B1D29', letterSpacing: '-0.3px' }}>
            ประวัติการส่งผลงานและใบเสร็จยืนยัน
          </h1>
          <p style={{ fontSize: '14px', color: '#6B6F80', marginTop: '4px' }}>
            สถาบัน: <strong>{user?.university}</strong> · บัญชีผู้ประสานงาน: <strong>{user?.name}</strong>
          </p>
        </div>
      </div>

      {/* History Table */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1', color: '#6B6F80', fontSize: '12.5px' }}>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>หมวดหมู่</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>ชื่อผลงาน</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>สถานะ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>ทีมผู้จัดทำ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700 }}>หลักฐาน / ใบเสร็จ</th>
                <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {TRACKS.map((t) => {
                const sub = submissions[t.id] || { members: [], files: [], links: {} };
                const meta = statusMeta(sub.status, 0);
                const isSubmitted = sub.status === 'submitted';
                const isDraft = sub.status === 'draft';

                const timestamp = sub.submittedAt
                  ? fmtDateTime(sub.submittedAt)
                  : (sub.draftAt ? `${fmtDateTime(sub.draftAt)} (ร่าง)` : '—');

                const filesCount = (sub.files || []).filter(f => f.status === 'done').length;
                const linksCount = ['video', 'github', 'drive'].filter(k => sub.links && sub.links[k]).length;

                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid #F0F1F5',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAFAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* Track Title */}
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#1B1D29' }}>
                        {t.th}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B6F80' }}>
                        {t.en}
                      </div>
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: '18px 20px', maxWidth: '240px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: sub.projectName ? 700 : 500,
                        color: sub.projectName ? '#1B1D29' : '#9A9DAD',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {sub.projectName ? sub.projectName : 'ยังไม่มีผลงาน'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#6B6F80', marginTop: '2px' }}>
                        {timestamp}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '18px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
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
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#4A4E5E', fontWeight: 600 }}>
                      {teamLabel(sub.members)}
                    </td>

                    {/* Receipt Hash & Deliverables */}
                    <td style={{ padding: '18px 20px' }}>
                      {isSubmitted && sub.hash ? (
                        <div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#EAF5FE',
                            color: '#0A65B0',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}>
                            <Receipt size={13} weight="bold" />
                            <span>#{sub.hash}</span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#6B6F80', marginTop: '4px' }}>
                            {filesCount} ไฟล์ · {linksCount} ลิงก์
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#9A9DAD' }}>
                          {filesCount || linksCount ? `${filesCount} ไฟล์ · ${linksCount} ลิงก์` : '—'}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => openTrack(t.id)}
                        style={{
                          background: isSubmitted ? '#FAFAFC' : '#FFF1EB',
                          border: isSubmitted ? '1px solid #ECECF1' : '1px solid rgba(255, 95, 28, 0.25)',
                          color: isSubmitted ? '#4A4E5E' : '#C2410C',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{isSubmitted ? 'ดูรายละเอียด' : (isDraft ? 'แก้ไขต่อ' : 'เริ่มส่ง')}</span>
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
