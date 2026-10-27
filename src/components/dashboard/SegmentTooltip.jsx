import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRequirements } from '../../utils/requirements';
import { trackSubtitle } from '../../data/tracks';
import { fmtDateTime, daysUntil } from '../../utils/formatters';
import { LockSimple, PencilSimple, CircleDashed, Receipt, Users, Images } from '@phosphor-icons/react';

const STATUS = {
  submitted: { label: 'ส่งแล้ว', badge: 'badge-blue', Icon: LockSimple },
  draft: { label: 'ฉบับร่าง', badge: 'badge-yellow', Icon: PencilSimple },
  not_started: { label: 'ยังไม่เริ่ม', badge: '', Icon: CircleDashed }
};

const OFFSET = 14;
const EDGE = 12;

// Detail card for one overview item. `pos` is { x, y } in viewport pixels
// (mouse position, or under the segment when focused by keyboard).
export const SegmentTooltip = ({ item, pos }) => {
  const ref = useRef(null);
  const [place, setPlace] = useState({ left: pos.x + OFFSET, top: pos.y + OFFSET });

  // Keep the card inside the viewport: flip to the left / above the cursor near the edges
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = pos.x + OFFSET;
    let top = pos.y + OFFSET;
    if (left + width > window.innerWidth - EDGE) left = pos.x - OFFSET - width;
    if (top + height > window.innerHeight - EDGE) top = pos.y - OFFSET - height;
    setPlace({ left: Math.max(EDGE, left), top: Math.max(EDGE, top) });
  }, [pos.x, pos.y, item.key]);

  const { track, sub, status, groupLabel } = item;
  const s = STATUS[status] || STATUS.not_started;
  const members = sub.members || [];
  const students = members.filter(m => m.type === 'student').length;
  const advisors = members.filter(m => m.type === 'advisor').length;
  const photos = members.filter(m => m.photo?.dataUrl).length;
  const reqs = getRequirements(track, sub);
  const passed = reqs.filter(r => r.ok).length;
  const nextMissing = reqs.find(r => !r.ok);
  const daysLeft = daysUntil(track.deadline);

  // Portal to <body> so animated (transformed) parents don't offset position: fixed
  return createPortal(
    <div ref={ref} className="seg-tip" role="tooltip" id="seg-tip" style={place}>
      {/* Name */}
      <div>
        <div className="seg-tip-title">{track.full}</div>
        {(groupLabel || trackSubtitle(track)) && (
          <div className="seg-tip-sub">{groupLabel || trackSubtitle(track)}</div>
        )}
      </div>

      {/* Status */}
      <div className="seg-tip-row">
        <span className={`badge ${s.badge}`}>
          <s.Icon size={13} weight="bold" />
          {s.label}
        </span>
      </div>

      {/* Checklist progress (not needed once locked) */}
      {status !== 'submitted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="seg-tip-row" style={{ justifyContent: 'space-between' }}>
            <span>ความพร้อมก่อนส่ง</span>
            <strong>ครบ {passed}/{reqs.length} ข้อ</strong>
          </div>
          <div className="seg-tip-bar"><span style={{ width: `${(passed / reqs.length) * 100}%` }} /></div>
          {nextMissing && (
            <div className="seg-tip-muted" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              ยังขาด: {nextMissing.label}
            </div>
          )}
        </div>
      )}

      {/* Team */}
      {members.length > 0 && (
        <div className="seg-tip-row">
          <Users size={15} weight="bold" color="var(--text-muted)" />
          <span>
            ผู้แข่งขัน {students}/{track.maxCompetitors} · อาจารย์ {advisors}/{track.advisorCount || 1}
          </span>
          <span className="seg-tip-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Images size={14} weight="bold" />
            รูปถ่าย {photos}/{members.length}
          </span>
        </div>
      )}

      {/* Time */}
      <div className="seg-tip-muted" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {status === 'submitted' && (
          <>
            <span>ส่งเมื่อ {fmtDateTime(sub.submittedAt)}</span>
            {sub.hash && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', color: 'var(--blue-text)', fontWeight: 700 }}>
                <Receipt size={13} weight="bold" /> #{sub.hash}
              </span>
            )}
          </>
        )}
        {status === 'draft' && sub.draftAt && <span>บันทึกล่าสุด {fmtDateTime(sub.draftAt)}</span>}
        {status !== 'submitted' && (
          <span>{daysLeft >= 0 ? `เหลือ ${daysLeft} วันก่อนปิดรับ` : 'ปิดรับแล้ว'}</span>
        )}
      </div>

      <div className="seg-tip-hint">
        {status === 'submitted' ? 'คลิกเพื่อดูรายละเอียด' : status === 'draft' ? 'คลิกเพื่อทำต่อ' : 'คลิกเพื่อเริ่มส่ง'}
      </div>
    </div>,
    document.body
  );
};
