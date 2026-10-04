import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { Clock } from '@phosphor-icons/react';

export const CountdownTimer = () => {
  const { days, hours, minutes, seconds } = useCountdown();

  const blocks = [
    { label: 'วัน', val: days },
    { label: 'ชั่วโมง', val: hours },
    { label: 'นาที', val: minutes },
    { label: 'วินาที', val: seconds }
  ];

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      padding: '24px',
      border: '1px solid #ECECF1',
      boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B1D29' }}>
          <div style={{
            background: '#FFF1EB',
            color: '#FF5F1C',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={18} weight="fill" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>เวลาที่เหลือก่อนปิดรับผลงาน</div>
            <div style={{ fontSize: '12px', color: '#6B6F80' }}>กำหนดส่งสุดท้าย: 15 มกราคม 2570 เวลา 23:59 น.</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px'
      }}>
        {blocks.map((b, idx) => (
          <div
            key={idx}
            style={{
              background: '#FAFAFC',
              border: '1px solid #ECECF1',
              borderRadius: '16px',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontWeight: 800,
              color: '#FF5F1C',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1
            }}>
              {b.val}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B6F80', marginTop: '4px' }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
