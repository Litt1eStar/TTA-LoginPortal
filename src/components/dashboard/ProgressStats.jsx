import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { getOverviewItems } from '../../utils/entries';
import { groupShortName, CULTURE_CATEGORY } from '../../data/tracks';
import { SegmentTooltip } from './SegmentTooltip';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';

const STATUS_LABEL = { submitted: 'ส่งแล้ว', draft: 'ฉบับร่าง', not_started: 'ยังไม่เริ่ม' };

// Bar clusters, in the organisers' order:
// theory groups | practice groups | culture competitions | everything else
const CLUSTERS = [
  { label: 'สอนทฤษฎี', match: (it) => it.track.id === 'theory' },
  { label: 'สอนปฏิบัติ', match: (it) => it.track.id === 'practice' },
  { label: 'ศิลปวัฒนธรรม', match: (it) => it.track.category === CULTURE_CATEGORY },
  { label: 'ประเภทอื่น ๆ', match: (it) => it.groupIdx == null && !it.track.category }
];

const shortName = (it) => (it.groupIdx == null ? it.track.th : `${it.track.th} · ${groupShortName(it.sub.subjectGroup || it.track.subjectGroups[it.groupIdx])}`);

// Dashboard hero tile: greeting, overall progress (one segment per item, 17 in total),
// a detail card on hover, and the one "next" action.
export const ProgressStats = () => {
  const { user, submissions, setActiveTrackId } = usePortal();
  const navigate = useNavigate();
  const [hover, setHover] = useState(null); // { item, pos }

  const items = getOverviewItems(submissions);
  const counts = { submitted: 0, draft: 0, not_started: 0 };
  items.forEach(it => { counts[it.status] += 1; });

  // Next = first draft (already started), otherwise first not-started item
  const next = items.find(it => it.status === 'draft') || items.find(it => it.status === 'not_started');
  const firstName = user?.name ? user.name.split(' ')[0] : '';

  const openItem = (it) => {
    setHover(null);
    setActiveTrackId(it.track.id);
    if (it.groupIdx == null) {
      navigate(`/submit/${it.track.id}`);
      return;
    }
    navigate(`/submit/${it.track.id}/${it.groupIdx}`);
  };

  const showAtMouse = (it) => (e) => setHover({ item: it, pos: { x: e.clientX, y: e.clientY } });
  const showAtElement = (it) => (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ item: it, pos: { x: r.left + r.width / 2, y: r.bottom } });
  };

  return (
    <section className="tile tile-hero span-7 reveal" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--on-ink-muted)' }}>{user?.university}</div>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 700, marginTop: '4px' }}>
          สวัสดี คุณ{firstName}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span className="num-xl" style={{ fontSize: 'clamp(56px, 7vw, 76px)', color: 'var(--primary)' }}>
            {counts.submitted}
          </span>
          <span className="num-xl" style={{ fontSize: '28px', color: 'var(--on-ink-muted)' }}>/{items.length}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, paddingBottom: '8px' }}>รายการส่งแล้ว</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="segbar" aria-label="สถานะแต่ละรายการ" onMouseLeave={() => setHover(null)}>
          {CLUSTERS.map(c => {
            const group = items.filter(c.match);
            return (
              <div key={c.label} className="seg-cluster" style={{ flex: group.length }}>
                <div className="seg-cluster-label">{c.label}</div>
                <div className="seg-cluster-row" role="list" style={{ gridTemplateColumns: `repeat(${group.length}, 1fr)` }}>
                  {group.map(it => (
                    <button
                      key={it.key}
                      type="button"
                      role="listitem"
                      className={`seg-${it.status}`}
                      aria-label={`${shortName(it)}: ${STATUS_LABEL[it.status]}`}
                      aria-describedby={hover?.item.key === it.key ? 'seg-tip' : undefined}
                      aria-expanded={hover?.item.key === it.key}
                      onMouseEnter={showAtMouse(it)}
                      onMouseMove={showAtMouse(it)}
                      onFocus={showAtElement(it)}
                      onBlur={() => setHover(null)}
                      onClick={() => openItem(it)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span><i className="seg-submitted" />ส่งแล้ว {counts.submitted}</span>
          <span><i className="seg-draft" />ฉบับร่าง {counts.draft}</span>
          <span><i className="seg-not_started" />ยังไม่เริ่ม {counts.not_started}</span>
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        {next ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openItem(next)}
            style={{ minHeight: '50px', fontSize: '16px', padding: '12px 22px' }}
          >
            <span>{next.status === 'draft' ? 'ทำต่อ' : 'เริ่มส่ง'}: {shortName(next)}</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
            <CheckCircle size={24} weight="fill" color="var(--blue)" />
            ส่งผลงานครบทุกรายการแล้ว
          </div>
        )}
      </div>

      {hover && <SegmentTooltip item={hover.item} pos={hover.pos} />}
    </section>
  );
};
