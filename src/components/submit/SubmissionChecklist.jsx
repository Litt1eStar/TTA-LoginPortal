import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { fmtDateTime } from '../../utils/formatters';
import {
  CheckCircle,
  Circle,
  FloppyDisk,
  PaperPlaneTilt,
  LockSimple,
  Receipt
} from '@phosphor-icons/react';

export const SubmissionChecklist = ({ trackId, onAttemptSubmit, isLocked, onSaveDraft }) => {
  const { submissions } = usePortal();
  const sub = submissions[trackId] || { members: [], files: [], links: {} };

  const hasProjectName = !!(sub.projectName || '').trim();
  const hasAdvisor = (sub.members || []).some(m => m.type === 'advisor');
  const students = (sub.members || []).filter(m => m.type === 'student');
  const hasStudents = students.length > 0;
  const hasLeader = students.some(m => m.isLeader);
  const hasTeam = hasStudents && hasLeader;

  const hasFiles = (sub.files || []).some(f => f.status === 'done');
  const hasLinks = !!(sub.links?.video || sub.links?.github || sub.links?.drive);
  const hasDeliverables = hasFiles || hasLinks;

  const criteria = [
    { label: 'ระบุชื่อผลงาน', ok: hasProjectName },
    { label: 'ระบุอาจารย์ที่ปรึกษา (1 ท่าน)', ok: hasAdvisor },
    { label: `มีนักศึกษา ${students.length > 0 ? `(${students.length} คน)` : ''} พร้อมหัวหน้าทีม`, ok: hasTeam },
    { label: 'อัปโหลดไฟล์หรือแนบลิงก์ผลงาน', ok: hasDeliverables }
  ];

  const completedCount = criteria.filter(c => c.ok).length;
  const percentage = Math.round((completedCount / criteria.length) * 100);

  const getSavedLabel = () => {
    if (isLocked && sub.submittedAt) {
      return `ส่งเมื่อ ${fmtDateTime(sub.submittedAt)}`;
    }
    if (sub.draftAt) {
      return `บันทึกฉบับร่าง ${fmtDateTime(sub.draftAt)}`;
    }
    return 'ยังไม่ได้บันทึกฉบับร่าง';
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      border: '1px solid #ECECF1',
      padding: '24px',
      boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      position: 'sticky',
      top: '94px'
    }}>
      {/* Header and readiness meter */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1B1D29' }}>
            ความพร้อมในการส่งผลงาน
          </h3>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#FF5F1C' }}>
            {percentage}%
          </span>
        </div>

        <div style={{
          width: '100%',
          height: '8px',
          background: '#F0F1F5',
          borderRadius: '20px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: percentage === 100 ? '#2A9FF7' : 'linear-gradient(90deg, #FF5F1C 0%, #FF8D20 100%)',
            borderRadius: '20px',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {criteria.map((c, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13.5px',
              color: c.ok ? '#1B1D29' : '#6B6F80',
              fontWeight: c.ok ? 600 : 500
            }}
          >
            {c.ok ? (
              <CheckCircle size={19} weight="fill" color="#2A9FF7" style={{ flexShrink: 0 }} />
            ) : (
              <Circle size={19} color="#C4C6D0" style={{ flexShrink: 0 }} />
            )}
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Submission status timestamp / hash */}
      <div style={{
        background: '#FAFAFC',
        borderRadius: '14px',
        padding: '12px 14px',
        border: '1px solid #ECECF1',
        fontSize: '12.5px'
      }}>
        <div style={{ color: '#6B6F80' }}>
          สถานะ: <strong>{getSavedLabel()}</strong>
        </div>

        {sub.hash && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '6px',
            fontSize: '12px',
            color: '#0A65B0',
            fontWeight: 700
          }}>
            <Receipt size={14} weight="bold" />
            <span>รหัสใบเสร็จ: #{sub.hash}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isLocked ? (
        <div style={{
          background: '#EAF5FE',
          color: '#0A65B0',
          padding: '12px',
          borderRadius: '14px',
          textAlign: 'center',
          fontSize: '13.5px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <LockSimple size={16} weight="bold" />
          <span>ผลงานนี้ถูกส่งและล็อกแล้ว</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={onAttemptSubmit}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 18px rgba(255, 95, 28, 0.35)'
            }}
          >
            <PaperPlaneTilt size={18} weight="fill" />
            <span>ตรวจสอบและส่งผลงาน</span>
          </button>

          <button
            type="button"
            onClick={onSaveDraft}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1.5px solid #E0E1E8',
              color: '#1B1D29',
              fontWeight: 700,
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FloppyDisk size={16} weight="bold" />
            <span>บันทึกฉบับร่าง</span>
          </button>
        </div>
      )}
    </div>
  );
};
