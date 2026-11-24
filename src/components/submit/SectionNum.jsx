import React, { useEffect, useRef, useState } from 'react';
import { Check } from '@phosphor-icons/react';

const PARTICLES = Array.from({ length: 8 }, (_, i) => i);

// Numbered circle in front of a section title; turns into a check when the section is complete.
// Going from not-done to done (not on first render) fires a small burst and a light sweep
// around the parent card (.card:has(.just-done) in index.css).
export const SectionNum = ({ number, done }) => {
  const prevDone = useRef(done);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (done && !prevDone.current) setBurst(b => b + 1);
    prevDone.current = done;
  }, [done]);

  useEffect(() => {
    if (!burst) return undefined;
    const t = setTimeout(() => setBurst(0), 1300);
    return () => clearTimeout(t);
  }, [burst]);

  if (!number) return null;
  return (
    <span
      key={done ? 'done' : 'todo'}
      className={`section-num ${done ? 'done pop-in' : ''} ${burst ? 'just-done' : ''}`}
      aria-label={done ? `ส่วนที่ ${number} ครบแล้ว` : `ส่วนที่ ${number}`}
    >
      {done ? <Check size={16} weight="bold" /> : number}
      {burst > 0 && (
        <span key={burst} className="burst" aria-hidden="true">
          {PARTICLES.map(i => <i key={i} style={{ '--a': `${i * 45}deg` }} />)}
        </span>
      )}
    </span>
  );
};
