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
import { FacultySection } from './FacultySection';
import { ApplicantPhotoSection } from './ApplicantPhotoSection';
import { getRequirements, getFormErrors } from '../../utils/requirements';
import { LockSimple, CheckCircle, CalendarBlank } from '@phosphor-icons/react';

export const SubmitView = () => {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const { activeTrackId, setActiveTrackId, submissions, saveDraft, confirmSubmit, showToast } = usePortal();

  // Keep activeTrackId in sync with a valid trackId in the URL
  useEffect(() => {
    if (trackId) {
      const match = TRACKS.find(t => t.id === trackId);
      if (match && match.id !== activeTrackId) {
        setActiveTrackId(match.id);
      } else if (!match) {
        navigate(`/submit/${activeTrackId || 'theory'}`, { replace: true });
      }
    }
  }, [trackId, activeTrackId, setActiveTrackId, navigate]);

  const currentTrackId = (trackId && TRACKS.some(t => t.id === trackId)) ? trackId : activeTrackId;
  const activeTrack = TRACKS.find(t => t.id === currentTrackId) || TRACKS[0];
  const sub = submissions[activeTrack.id] || { members: [], files: [], links: {} };

  const [formErrors, setFormErrors] = useState({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Errors belong to one track; clear them when switching tracks
  useEffect(() => {
    setFormErrors({});
  }, [activeTrack.id]);

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
    const errors = getFormErrors(getRequirements(activeTrack, sub));

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('ยังกรอกข้อมูลไม่ครบ กรุณาตรวจสอบรายการที่มีเครื่องหมายสีแดง');
      // Bring the first problem into view
      const first = Object.keys(errors)[0];
      document.getElementById(`section-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setFormErrors({});
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    confirmSubmit(activeTrack.id);
    setConfirmModalOpen(false);
  };

  // Section numbers follow the order they appear on the page
  let n = 0;
  const next = () => ++n;
  const hasGroups = !!activeTrack.subjectGroups?.length;

  return (
    <div className="app-container" style={{ padding: '28px 20px 80px' }}>
      <TrackSelector />

      {/* Track header */}
      <div className="card" style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div className="page-kicker">ประเภทการแข่งขัน</div>
          <h1 className="page-title">{activeTrack.full}</h1>
        </div>

        {isLocked ? (
          <span className="badge badge-blue" style={{ fontSize: '15px', padding: '8px 16px' }}>
            <LockSimple size={16} weight="bold" />
            ส่งแล้ว · แก้ไขไม่ได้
          </span>
        ) : (
          <span className="badge badge-orange" style={{ fontSize: '15px', padding: '8px 16px' }}>
            <CalendarBlank size={16} weight="bold" />
            ปิดรับ {fmtDate(activeTrack.deadline)} · เหลือ {daysLeft} วัน
          </span>
        )}
      </div>

      {isLocked && (
        <div className="alert alert-info" style={{ marginBottom: '24px' }}>
          <CheckCircle size={20} weight="fill" />
          <span>ส่งผลงานประเภทนี้เรียบร้อยแล้ว หากต้องการแก้ไขข้อมูล กรุณาติดต่อกองอำนวยการ</span>
        </div>
      )}

      <div className="submit-grid">
        {/* Form sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          <TeamMembersSection
            trackId={activeTrack.id}
            isLocked={isLocked}
            error={formErrors.team}
            number={next()}
          />

          {hasGroups && (
            <FacultySection
              trackId={activeTrack.id}
              isLocked={isLocked}
              error={formErrors.subjectGroup}
              number={next()}
            />
          )}

          <ApplicantPhotoSection
            trackId={activeTrack.id}
            isLocked={isLocked}
            error={formErrors.photo}
            number={next()}
          />

          {/* Project info, links and files: video clip only */}
          {activeTrack.needsWorkInfo && (
            <>
              <ProjectInfoSection
                trackId={activeTrack.id}
                isLocked={isLocked}
                error={formErrors.projectName}
                number={next()}
              />
              <ExternalLinksSection
                trackId={activeTrack.id}
                isLocked={isLocked}
                number={next()}
              />
              <FileUploader
                trackId={activeTrack.id}
                isLocked={isLocked}
                error={formErrors.deliverables}
                number={next()}
              />
            </>
          )}
        </div>

        {/* Sticky checklist */}
        <div>
          <SubmissionChecklist
            trackId={activeTrack.id}
            isLocked={isLocked}
            onAttemptSubmit={handleAttemptSubmit}
            onSaveDraft={handleSaveDraft}
          />
        </div>
      </div>

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
