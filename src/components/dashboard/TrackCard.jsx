import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { statusMeta, teamLabel, daysUntil } from '../../utils/formatters';
import {
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
  LockSimple,
  PencilSimple
} from '@phosphor-icons/react';

const ICON_MAP = {
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

export const TrackCard = ({ track }) => {
  const { submissions, openTrack } = usePortal();
  const sub = submissions[track.id] || { status: 'not_started', projectName: '', members: [] };

  const daysLeft = daysUntil(track.deadline);
  const meta = statusMeta(sub.status, daysLeft);
  const IconComponent = ICON_MAP[track.icon] || ChalkboardTeacher;

  const isSubmitted = sub.status === 'submitted';
  const isDraft = sub.status === 'draft';

  return (
    <div
      onClick={() => openTrack(track.id)}
      style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #ECECF1',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        boxShadow: '0 4px 16px -2px rgba(27, 29, 41, 0.04)',
        transition: 'all 0.22s ease',
        minHeight: '230px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 16px 32px -4px rgba(27, 29, 41, 0.1)';
        e.currentTarget.style.borderColor = '#D5D7E0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 4px 16px -2px rgba(27, 29, 41, 0.04)';
        e.currentTarget.style.borderColor = '#ECECF1';
      }}
    >
      {/* Top Header */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          {/* Icon */}
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: isSubmitted ? '#EAF5FE' : (isDraft ? '#FFF8DB' : '#FFF1EB'),
            color: isSubmitted ? '#2A9FF7' : (isDraft ? '#FF8D20' : '#FF5F1C'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <IconComponent size={24} weight="duotone" />
          </div>

          {/* Status Badge */}
          <div style={{
            background: meta.badgeBg,
            color: meta.badgeColor,
            border: meta.badgeBorder,
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: meta.dotColor
            }} />
            <span>{meta.label}</span>
          </div>
        </div>

        {/* Track Title */}
        <div>
          <h3 style={{
            fontSize: '17px',
            fontWeight: 800,
            color: '#1B1D29',
            marginBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{track.th}</span>
            {isSubmitted && <LockSimple size={14} color="#6B6F80" />}
          </h3>
          <div style={{ fontSize: '12.5px', color: '#6B6F80', fontWeight: 500 }}>
            {track.en}
          </div>
        </div>

        {/* Project Name preview */}
        <div style={{
          marginTop: '14px',
          fontSize: '13.5px',
          fontWeight: sub.projectName ? 700 : 500,
          color: sub.projectName ? '#1B1D29' : '#9A9DAD',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {sub.projectName ? `“${sub.projectName}”` : 'ยังไม่มีผลงาน'}
        </div>
      </div>

      {/* Footer Info & Action */}
      <div style={{
        marginTop: '18px',
        paddingTop: '14px',
        borderTop: '1px solid #F0F1F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12.5px'
      }}>
        <div style={{ color: '#6B6F80', fontWeight: 600 }}>
          {teamLabel(sub.members)}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 700,
          color: isSubmitted ? '#0A65B0' : (isDraft ? '#8A5A00' : '#FF5F1C')
        }}>
          <span>{isSubmitted ? 'ดูผลงาน' : (isDraft ? 'ทำต่อ' : 'เริ่มส่ง')}</span>
          <ArrowRight size={13} weight="bold" />
        </div>
      </div>
    </div>
  );
};
