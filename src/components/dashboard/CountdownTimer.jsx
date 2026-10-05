import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { HourglassMedium, ArrowRight } from '@phosphor-icons/react';

export const CountdownTimer = () => {
  const { days, hours, minutes, seconds } = useCountdown();
  const { submissions, openTrack } = usePortal();

  const total = TRACKS.length;
  let submittedCount = 0;
  TRACKS.forEach(t => {
    if (submissions[t.id]?.status === 'submitted') {
      submittedCount++;
    }
  });
  const unsubmittedCount = total - submittedCount;

  const handleGoSubmit = () => {
    const nextTrack = TRACKS.find(t => submissions[t.id]?.status !== 'submitted') || TRACKS[0];
    openTrack(nextTrack.id);
  };

  const blocks = [
    { label: 'วัน', val: days },
    { label: 'ชั่วโมง', val: hours },
    { label: 'นาที', val: minutes },
    { label: 'วินาที', val: seconds }
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FF5B18 0%, #FF8510 50%, #FFA31E 100%)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 10px 30px -4px rgba(255, 95, 28, 0.35)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Watermark Hourglass */}
      <div style={{
        position: 'absolute',
        top: '-16px',
        right: '-8px',
        color: 'rgba(255, 255, 255, 0.22)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <HourglassMedium size={145} weight="bold" />
      </div>

      {/* Header section */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#1B1D29',
          fontSize: '17px',
          fontWeight: 800,
          letterSpacing: '-0.2px'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#1B1D29',
            display: 'inline-block',
            flexShrink: 0
          }} />
          <span>เวลาที่เหลือก่อนปิดรับผลงาน</span>
        </div>
        <div style={{
          fontSize: '13.5px',
          fontWeight: 600,
          color: '#1B1D29',
          marginTop: '4px',
          paddingLeft: '15px'
        }}>
          ปิดรับ 15 ม.ค. 2570
        </div>
      </div>

      {/* 4 Countdown Blocks */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginTop: '18px',
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        {blocks.map((b, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(255, 255, 255, 0.38)',
              borderRadius: '16px',
              padding: '14px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
          >
            <span style={{
              fontSize: 'clamp(22px, 3.2vw, 28px)',
              fontWeight: 800,
              color: '#1B1D29',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1
            }}>
              {b.val}
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#1B1D29',
              marginTop: '4px'
            }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom status and action */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '14.5px',
          fontWeight: 700,
          color: '#1B1D29',
          marginBottom: '14px'
        }}>
          ยังไม่ได้ส่งอีก {unsubmittedCount} จาก {total} ประเภท
        </div>

        <button
          onClick={handleGoSubmit}
          style={{
            background: '#1B1D29',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '11px 20px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(27, 29, 41, 0.25)',
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.background = '#25283D';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = '#1B1D29';
          }}
        >
          <span>ไปที่หน้าส่งผลงาน</span>
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
};
