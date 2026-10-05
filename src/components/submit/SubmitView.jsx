import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { daysUntil, fmtDate } from '../../utils/formatters';
import { TrackSelector } from './TrackSelector';
import { ProjectInfoSection } from './ProjectInfoSection';
import { ExternalLinksSection } from './ExternalLinksSection';
import { TeamMembersSection } from './TeamMembersSection';
import { FileUploader } from './FileUploader';
import { SubmissionChecklist } from './SubmissionChecklist';
import { ConfirmSubmitModal } from './ConfirmSubmitModal';
import { LockSimple, WarningCircle, CheckCircle } from '@phosphor-icons/react';

export const SubmitView = () => {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const { activeTrackId, setActiveTrackId, submissions, saveDraft, confirmSubmit, showToast } = usePortal();

  // If a valid trackId is in URL, keep activeTrackId in sync
  useEffect(() => {
    if (trackId) {
      const match = TRACKS.find(t => t.id === trackId);
      if (match && match.id !== activeTrackId) {
        setActiveTrackId(match.id);
      } else if (!match) {
        // Fallback to activeTrackId if invalid param is typed
        navigate(`/submit/${activeTrackId || 'theory'}`, { replace: true });
      }
    }
  }, [trackId, activeTrackId, setActiveTrackId, navigate]);

  const currentTrackId = (trackId && TRACKS.some(t => t.id === trackId)) ? trackId : activeTrackId;
  const activeTrack = TRACKS.find(t => t.id === currentTrackId) || TRACKS[0];
  const sub = submissions[activeTrack.id] || { members: [], files: [], links: {} };

  const [formErrors, setFormErrors] = useState({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const isLocked = sub.status === 'submitted';
  const daysLeft = daysUntil(activeTrack.deadline);

  const handleSaveDraft = () => {
    const res = saveDraft(activeTrack.id);
    if (!res.success) {
      setFormErrors({ projectName: res.error });
      showToast(res.error);
    } else {
      setFormErrors({});
    }
  };

  const handleAttemptSubmit = () => {
    const errors = {};
    if (!(sub.projectName || '').trim()) {
      errors.projectName = 'กรุณาระบุชื่อผลงานก่อนส่ง';
    }

    const hasAdvisor = (sub.members || []).some(m => m.type === 'advisor');
    const students = (sub.members || []).filter(m => m.type === 'student');
    const hasLeader = students.some(m => m.isLeader);

    if (!hasAdvisor || students.length === 0 || !hasLeader) {
      if (!hasAdvisor && students.length === 0) {
        errors.team = 'กรุณาเพิ่มอาจารย์ที่ปรึกษา และนักศึกษาอย่างน้อย 1 คนพร้อมกำหนดหัวหน้าทีม';
      } else if (!hasAdvisor) {
        errors.team = 'กรุณาระบุอาจารย์ที่ปรึกษา (1 ท่าน)';
      } else if (students.length === 0) {
        errors.team = 'กรุณาเพิ่มนักศึกษาอย่างน้อย 1 คน';
      } else if (!hasLeader) {
        errors.team = 'กรุณากำหนดหัวหน้าทีมสำหรับนักศึกษา';
      }
    }

    const hasFiles = (sub.files || []).some(f => f.status === 'done');
    const hasLinks = !!(sub.links?.video || sub.links?.github || sub.links?.drive);
    if (!hasFiles && !hasLinks) {
      errors.deliverables = 'กรุณาอัปโหลดไฟล์ หรือแนบลิงก์ผลงานอย่างน้อย 1 รายการ';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('กรุณากรอกข้อมูลให้ครบถ้วนตามข้อกำหนดก่อนส่งผลงาน');
      return;
    }

    setFormErrors({});
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    confirmSubmit(activeTrack.id);
    setConfirmModalOpen(false);
  };

  return (
    <div className="app-container" style={{ padding: '32px 20px 80px 20px' }}>
      {/* 1. Track Switcher */}
      <TrackSelector />

      {/* 2. Track Header Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        padding: '24px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(27, 29, 41, 0.03)'
      }}>
        <div>
          <div style={{
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#FF5F1C',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: '4px'
          }}>
            หมวดหมู่การแข่งขันที่เลือก
          </div>
          <h1 style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#1B1D29',
            letterSpacing: '-0.3px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>{activeTrack.th}</span>
            <span style={{ fontSize: '18px', color: '#6B6F80', fontWeight: 500 }}>
              ({activeTrack.en})
            </span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isLocked ? (
            <div style={{
              background: '#EAF5FE',
              color: '#0A65B0',
              border: '1px solid rgba(42, 159, 247, 0.3)',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <LockSimple size={16} weight="bold" />
              <span>ส่งผลงานแล้ว (ล็อกการแก้ไข)</span>
            </div>
          ) : (
            <div style={{
              background: '#FFF1EB',
              color: '#C2410C',
              border: '1px solid rgba(255, 95, 28, 0.25)',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700
            }}>
              ปิดรับ {fmtDate(activeTrack.deadline)} · เหลืออีก {daysLeft} วัน
            </div>
          )}
        </div>
      </div>

      {/* Lock alert notice if submitted */}
      {isLocked && (
        <div style={{
          background: '#EAF5FE',
          border: '1px solid #B6E0FE',
          borderRadius: '16px',
          padding: '14px 20px',
          marginBottom: '24px',
          color: '#0A65B0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          fontWeight: 600
        }}>
          <CheckCircle size={20} weight="fill" />
          <span>
            ผลงานหมวดหมู่นี้ถูกส่งเรียบร้อยแล้ว หากต้องการเปลี่ยนแปลงข้อมูลเร่งด่วน กรุณาติดต่อกองอำนวยการจัดการประกวด
          </span>
        </div>
      )}

      {/* 3. Main Workspace Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Form & Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ProjectInfoSection
            trackId={activeTrack.id}
            isLocked={isLocked}
            error={formErrors.projectName}
          />

          <ExternalLinksSection
            trackId={activeTrack.id}
            isLocked={isLocked}
          />

          <TeamMembersSection
            trackId={activeTrack.id}
            isLocked={isLocked}
            error={formErrors.team}
          />

          <FileUploader
            trackId={activeTrack.id}
            isLocked={isLocked}
          />
        </div>

        {/* Right Column: Sticky Checklist */}
        <div>
          <SubmissionChecklist
            trackId={activeTrack.id}
            isLocked={isLocked}
            onAttemptSubmit={handleAttemptSubmit}
            onSaveDraft={handleSaveDraft}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmSubmitModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        track={activeTrack}
        submission={sub}
      />
    </div>
  );
};
