import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { useSwapTransition } from '../../hooks/useSwapTransition';
import { useSlidingIndicator } from '../../hooks/useMotion';
import { CountdownTimer } from './CountdownTimer';
import { ProgressStats } from './ProgressStats';
import { TrackCard } from './TrackCard';
import { TYPES } from '../../data/tracks';
import { getTypeStatus } from '../../utils/entries';

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด', match: () => true },
  { id: 'todo', label: 'ยังไม่ส่ง', match: (s) => s !== 'submitted' },
  { id: 'done', label: 'ส่งแล้ว', match: (s) => s === 'submitted' }
];

export const DashboardView = () => {
  const { submissions } = usePortal();
  const [filter, setFilter] = useState('all');
  const filterSwap = useSwapTransition(filter, {
    keyOf: (id) => id,
    orderOf: (id) => FILTERS.findIndex(f => f.id === id),
    outMs: 95
  });
  const [filterRef, pill] = useSlidingIndicator(filter);

  // Cards and counts are per top-level type
  const statusOf = (type) => getTypeStatus(type, submissions);
  const active = FILTERS.find(f => f.id === filterSwap.displayed) || FILTERS[0];
  const visible = TYPES.filter(t => active.match(statusOf(t)));

  return (
    <div className="app-container" style={{ padding: '32px 20px 72px' }}>
      <div className="bento" style={{ marginBottom: '48px' }}>
        <ProgressStats />
        <CountdownTimer />
      </div>

      <section aria-labelledby="tracks-heading">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <h2 id="tracks-heading" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700 }}>ประเภทการแข่งขัน</h2>

          <div ref={filterRef} className={`seg-control slide-track ${pill ? 'has-pill' : ''}`} role="group" aria-label="กรองตามสถานะ">
            {pill && (
              <span
                className="slide-pill"
                aria-hidden="true"
                style={{ width: `${pill.w}px`, height: `${pill.h}px`, transform: `translate(${pill.x}px, ${pill.y}px)` }}
              />
            )}
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                data-active={filter === f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label} {TYPES.filter(t => f.match(statusOf(t))).length}
              </button>
            ))}
          </div>
        </div>

        <div
          key={filterSwap.displayedKey}
          className={filterSwap.className}
          style={{ ...filterSwap.style, '--swap-in-ms': '210ms' }}
        >
          {visible.length > 0 ? (
            <div className="track-grid">
              {visible.map((type, i) => (
                <TrackCard key={type.id} type={type} index={i} />
              ))}
            </div>
          ) : (
            <div className="dropzone" style={{ padding: '40px' }}>
              {filterSwap.displayed === 'done' ? 'ยังไม่มีประเภทที่ส่งแล้ว' : 'ส่งครบทุกประเภทแล้ว'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
