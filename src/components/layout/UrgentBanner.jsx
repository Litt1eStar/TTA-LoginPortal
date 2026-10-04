import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { WarningCircle, X, ArrowRight } from '@phosphor-icons/react';
import { useCountdown } from '../../hooks/useCountdown';

export const UrgentBanner = () => {
  const { bannerDismissed, dismissBanner, openTrack, submissions } = usePortal();
  const { days } = useCountdown();

  if (bannerDismissed) return null;

  // Find first unsubmitted track
  const tracksList = Object.keys(submissions);
  const unsubmittedTrack = tracksList.find(t => submissions[t].status !== 'submitted') || 'theory';

  return (
    <div style={{
      background: 'linear-gradient(90deg, #FF5F1C 0%, #FF8D20 100%)',
      color: '#FFFFFF',
      padding: '10px 20px',
      fontSize: '13.5px',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      boxShadow: '0 2px 8px rgba(255, 95, 28, 0.25)',
      position: 'relative',
      zIndex: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{
          background: 'rgba(255,255,255,0.22)',
          padding: '4px 8px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontWeight: 700,
          fontSize: '12px'
        }}>
          <WarningCircle size={15} weight="fill" />
          <span>แจ้งเตือนสำคัญ</span>
        </div>
        <span>
          ระบบจะปิดรับผลงานทุกประเภทในอีก <strong>{days} วัน</strong> กรุณาตรวจสอบและส่งผลงานให้ครบถ้วนตามกำหนด
        </span>
        <button
          onClick={() => openTrack(unsubmittedTrack)}
          style={{
            background: '#FFFFFF',
            color: '#FF5F1C',
            padding: '4px 12px',
            borderRadius: '16px',
            fontWeight: 700,
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>ส่งผลงานที่เหลือ</span>
          <ArrowRight size={13} weight="bold" />
        </button>
      </div>

      <button
        onClick={dismissBanner}
        aria-label="ปิดการแจ้งเตือน"
        style={{
          background: 'transparent',
          color: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '50%'
        }}
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  );
};
