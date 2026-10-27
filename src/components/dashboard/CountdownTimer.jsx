import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { FINAL_DEADLINE } from '../../data/tracks';
import { fmtDate } from '../../utils/formatters';

// Countdown tile: the day count is the headline, the rest is supporting detail.
export const CountdownTimer = () => {
  const { days, hours, minutes, seconds } = useCountdown();

  const small = [
    { label: 'ชั่วโมง', val: hours },
    { label: 'นาที', val: minutes },
    { label: 'วินาที', val: seconds }
  ];

  return (
    <section
      className="tile tile-orange span-5 reveal"
      style={{ '--i': 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}
      aria-label="เวลาที่เหลือก่อนปิดรับผลงาน"
    >
      <div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>ปิดรับผลงานในอีก</div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, opacity: 0.8 }}>{fmtDate(FINAL_DEADLINE)} เวลา 23:59 น.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span className="num-xl" style={{ fontSize: 'clamp(84px, 11vw, 128px)' }}>{days}</span>
        <span style={{ fontSize: '28px', fontWeight: 700 }}>วัน</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {small.map(b => (
          <div
            key={b.label}
            style={{
              background: 'rgba(20, 22, 42, 0.12)',
              borderRadius: '14px',
              padding: '10px 8px',
              textAlign: 'center'
            }}
          >
            <div className="num-xl" style={{ fontSize: '26px' }}>{String(b.val).padStart(2, '0')}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginTop: '4px' }}>{b.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
