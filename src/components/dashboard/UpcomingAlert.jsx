import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { daysUntil, fmtDate } from '../../utils/formatters';
import { CalendarBlank, ArrowRight } from '@phosphor-icons/react';

export const UpcomingAlert = () => {
  const { submissions, openTrack } = usePortal();

  // Find next upcoming deadline that is not submitted yet
  const upcoming = TRACKS.find(t => submissions[t.id]?.status !== 'submitted');

  if (!upcoming) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #16182A 0%, #1E2138 100%)',
        color: '#FFFFFF',
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 8px 24px -4px rgba(22, 24, 42, 0.25)'
      }}>
        <div>
          <div style={{ fontSize: '13px', color: '#FFC525', fontWeight: 700, marginBottom: '4px' }}>
            ยอดเยี่ยม! คุณส่งผลงานครบแล้ว
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800 }}>
            ส่งผลงานครบทั้ง 10 ประเภทเรียบร้อย
          </h3>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
            คุณสามารถตรวจสอบหลักฐานและใบเสร็จการส่งได้ที่หน้าประวัติการส่ง
          </p>
        </div>
      </div>
    );
  }

  const daysLeft = daysUntil(upcoming.deadline);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #16182A 0%, #1E2138 100%)',
      color: '#FFFFFF',
      borderRadius: '24px',
      padding: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px',
      boxShadow: '0 8px 24px -4px rgba(22, 24, 42, 0.25)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: 'rgba(255, 95, 28, 0.2)',
          border: '1px solid rgba(255, 95, 28, 0.4)',
          color: '#FF8D20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <CalendarBlank size={28} weight="fill" />
        </div>
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#FF8D20',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: '4px'
          }}>
            รายการถัดไปที่ต้องดำเนินการ
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.2px' }}>
            {upcoming.th} ({upcoming.en})
          </h3>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>
            กำหนดส่งภายใน {fmtDate(upcoming.deadline)} · เหลืออีก {daysLeft} วัน
          </div>
        </div>
      </div>

      <button
        onClick={() => openTrack(upcoming.id)}
        style={{
          background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
          color: '#FFFFFF',
          padding: '12px 22px',
          borderRadius: '14px',
          fontWeight: 700,
          fontSize: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(255, 95, 28, 0.35)'
        }}
      >
        <span>ไปที่หน้าส่งผลงาน</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </div>
  );
};
