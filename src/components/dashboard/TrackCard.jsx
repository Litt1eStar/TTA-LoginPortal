import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { fmtDateTime } from '../../utils/formatters';
import { submissionSummary } from '../../utils/requirements';
import { getEntries, getTrackStatus, getTypeStatus } from '../../utils/entries';
import { isGrouped, groupShortName, hasSubTypes } from '../../data/tracks';
import {
  MaskHappy,
  ChalkboardTeacher,
  HandPointing,
  Cpu,
  Code,
  Flask,
  VideoCamera,
  PresentationChart,
  Robot,
  MicrophoneStage,
  PersonSimpleRun,
  ArrowRight,
  LockSimple
} from '@phosphor-icons/react';

const ICON_MAP = {
  MaskHappy,
  ChalkboardTeacher,
  HandPointing,
  Cpu,
  Code,
  Flask,
  VideoCamera,
  PresentationChart,
  Robot,
  MicrophoneStage,
  PersonSimpleRun
};

// Colours per status: accent bar, icon tile and badge
const STATUS = {
  submitted: { label: 'ส่งแล้ว', accent: 'var(--blue)', tileBg: 'var(--blue-bg)', tileFg: 'var(--blue-text)', badge: 'badge-blue', action: 'ดูข้อมูล' },
  draft: { label: 'ฉบับร่าง', accent: 'var(--yellow)', tileBg: 'var(--yellow-bg)', tileFg: '#B07A00', badge: 'badge-yellow', action: 'ทำต่อ' },
  not_started: { label: 'ยังไม่เริ่ม', accent: '#D5D7E0', tileBg: 'var(--primary-subtle)', tileFg: 'var(--primary)', badge: '', action: 'เริ่มส่ง' }
};

// One card per top-level type (8). A type with sub-types (การแข่งขันศิลปวัฒนธรรม)
// summarises its sub-types; otherwise the card shows its single track.
export const TrackCard = ({ type, index = 0 }) => {
  const { submissions, openTrack, setActiveTrackId } = usePortal();
  const navigate = useNavigate();
  const track = type.tracks[0];
  const status = getTypeStatus(type, submissions);
  const s = STATUS[status] || STATUS.not_started;
  const Icon = ICON_MAP[type.icon] || ChalkboardTeacher;
  const entries = getEntries(track, submissions);
  const multi = hasSubTypes(type);

  // Open the first sub-type (or กลุ่มสาขาวิชา) that isn't sent yet
  const target = multi
    ? (type.tracks.find(t => getTrackStatus(t, submissions) !== 'submitted') || track)
    : track;
  const targetGroup = !multi && isGrouped(track)
    ? (entries.find(e => e.sub.status !== 'submitted') || entries[0]).groupIdx
    : null;
  const open = () => {
    if (targetGroup == null) return openTrack(target.id);
    setActiveTrackId(track.id);
    navigate(`/submit/${track.id}/${targetGroup}`);
  };

  let summary;
  let footnote;
  if (multi) {
    const sent = type.tracks.filter(t => getTrackStatus(t, submissions) === 'submitted').length;
    summary = `${type.tracks.length} ประเภทย่อย · ส่งแล้ว ${sent}`;
    footnote = type.tracks.map(t => t.th).join(', ');
  } else if (isGrouped(track)) {
    // Theory / practice: every กลุ่มสาขาวิชา is a sub-type (same wording as the culture card)
    const sent = entries.filter(e => e.sub.status === 'submitted').length;
    summary = `${entries.length} กลุ่มสาขาวิชา · ส่งแล้ว ${sent}`;
    footnote = entries.map(e => groupShortName(e.group)).join(', ');
  } else {
    const sub = entries[0].sub;
    summary = submissionSummary(track, sub);
    footnote = sub.status === 'submitted' && sub.submittedAt
      ? `ส่งเมื่อ ${fmtDateTime(sub.submittedAt)}`
      : sub.status === 'draft' && sub.draftAt
        ? `บันทึกล่าสุด ${fmtDateTime(sub.draftAt)}`
        : 'ยังไม่มีข้อมูล';
  }

  return (
    <button
      type="button"
      className="track-card reveal"
      style={{ '--accent': s.accent, '--i': index + 2 }}
      onClick={open}
      aria-label={`${multi ? type.label : track.full}: ${s.label}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: s.tileBg,
          color: s.tileFg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={28} weight="duotone" />
        </div>
        <span className={`badge ${s.badge}`}>
          {status === 'submitted' && <LockSimple size={13} weight="bold" />}
          {s.label}
        </span>
      </div>

      <div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.3 }}>{type.label}</h3>
        {!multi && track.desc && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '2px' }}>{track.desc}</div>
        )}
      </div>

      {summary && (
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)' }}>{summary}</div>
      )}

      <div style={{
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{footnote}</span>
        <span className="go" aria-hidden="true" title={s.action}>
          <ArrowRight size={18} weight="bold" />
        </span>
      </div>
    </button>
  );
};
