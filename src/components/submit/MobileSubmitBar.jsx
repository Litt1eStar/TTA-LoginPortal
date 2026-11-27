import React from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../../context/PortalContext';
import { getTrack } from '../../data/tracks';
import { getRequirements } from '../../utils/requirements';
import { PaperPlaneTilt } from '@phosphor-icons/react';

// Below 980px the readiness panel sits at the end of a long form. This bar stays at the bottom of
// the screen (shown by index.css) with the readiness count and the submit button. Tapping the
// count jumps to the full checklist.
export const MobileSubmitBar = ({ trackId, isLocked, isClosed, onAttemptSubmit }) => {
  const { submissions } = usePortal();
  if (isLocked) return null;
  const sub = submissions[trackId] || { members: [], files: [], links: {} };
  const criteria = getRequirements(getTrack(trackId), sub);
  const completed = criteria.filter(c => c.ok).length;
  const allDone = completed === criteria.length;

  const showChecklist = () =>
    document.querySelector('.ready-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Portalled to <body>: the page wrappers animate with transforms, which would break position: fixed
  return createPortal(
    <div className="mobile-submit-bar" role="region" aria-label="ส่งผลงาน">
      <button type="button" className="msb-ready" onClick={showChecklist} data-done={allDone}>
        <strong>{completed}/{criteria.length}</strong>
        <span>{allDone ? 'พร้อมส่ง' : 'ดูรายการที่ขาด'}</span>
      </button>
      <button
        type="button"
        className={`btn btn-primary ${allDone && !isClosed ? 'btn-ready' : ''}`}
        onClick={onAttemptSubmit}
        disabled={isClosed}
      >
        <PaperPlaneTilt size={18} weight="fill" />
        <span>{isClosed ? 'ปิดรับแล้ว' : 'ตรวจสอบและส่ง'}</span>
      </button>
    </div>,
    document.body
  );
};
