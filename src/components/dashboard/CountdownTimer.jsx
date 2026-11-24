import React, { useState } from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { FINAL_DEADLINE } from '../../data/tracks';
import { fmtDate } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useMotion';

// One split-flap card: the old top half folds down onto the new bottom half
const FlipUnit = ({ value }) => {
  const [pair, setPair] = useState({ cur: value, prev: value });
  if (pair.cur !== value) setPair({ cur: value, prev: pair.cur });
  const { cur, prev } = pair;
  return (
    <span className="flip num-xl" aria-hidden="true">
      <span className="flip-half flip-top"><span>{cur}</span></span>
      <span className="flip-half flip-bottom"><span>{prev}</span></span>
      {cur !== prev && (
        <>
          <span key={`fold-${cur}`} className="flip-half flip-top flip-fold"><span>{prev}</span></span>
          <span key={`unfold-${cur}`} className="flip-half flip-bottom flip-unfold"><span>{cur}</span></span>
        </>
      )}
    </span>
  );
};

// Countdown tile: the day count is the headline, the rest is supporting detail.
export const CountdownTimer = () => {
  const { days, hours, minutes, seconds } = useCountdown();
  const shownDays = useCountUp(days, { duration: 1300, delay: 200 });

  const small = [
    { label: 'ชั่วโมง', val: hours },
    { label: 'นาที', val: minutes },
    { label: 'วินาที', val: seconds }
  ];

  return (
    <section
      className="tile tile-orange alive span-5 reveal"
      style={{ '--i': 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}
      aria-label="เวลาที่เหลือก่อนปิดรับลงทะเบียน"
    >
      <div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="live-dot" aria-hidden="true" />
          ปิดรับลงทะเบียนในอีก
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, opacity: 0.85 }}>{fmtDate(FINAL_DEADLINE)} เวลา 23:59 น.</div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, opacity: 0.78, marginTop: '2px' }}>กำหนดส่งเอกสาร: ประกาศเร็วๆ นี้</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span className="num-xl" style={{ fontSize: 'clamp(84px, 11vw, 128px)' }}>{shownDays}</span>
        <span style={{ fontSize: '28px', fontWeight: 700 }}>วัน</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {small.map(b => (
          <div key={b.label} style={{ textAlign: 'center' }}>
            <FlipUnit value={String(b.val).padStart(2, '0')} />
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginTop: '6px' }}>
              <span className="sr-only">{String(b.val).padStart(2, '0')} </span>{b.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
