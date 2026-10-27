import React from 'react';
import { Check } from '@phosphor-icons/react';

// Numbered circle in front of a section title; turns into a check when the section is complete.
export const SectionNum = ({ number, done }) => {
  if (!number) return null;
  return (
    <span className={`section-num ${done ? 'done' : ''}`} aria-label={done ? `ส่วนที่ ${number} ครบแล้ว` : `ส่วนที่ ${number}`}>
      {done ? <Check size={16} weight="bold" /> : number}
    </span>
  );
};
