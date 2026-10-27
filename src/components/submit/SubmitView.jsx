import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { TRACKS, isGrouped, entryKey, getTypeOfTrack, hasSubTypes } from '../../data/tracks';
import { SubTypeBar } from './SubTypeBar';
import { daysUntil, fmtDate } from '../../utils/formatters';
import { TrackSelector } from './TrackSelector';
import { GroupBar } from './GroupBar';
import { ProjectInfoSection } from './ProjectInfoSection';
import { ExternalLinksSection } from './ExternalLinksSection';
import { TeamMembersSection } from './TeamMembersSection';
import { FileUploader } from './FileUploader';
import { SubmissionChecklist } from './SubmissionChecklist';
import { ConfirmSubmitModal } from './ConfirmSubmitModal';
import { getRequirements, getFormErrors } from '../../utils/requirements';
import { emptySubmission } from '../../data/seedData';
import { LockSimple, CheckCircle, CalendarBlank } from '@phosphor-icons/react';

export const SubmitView = () => {
  const { trackId, groupIdx: groupParam } = useParams();
  const navigate = useNavigate();
  const { activeTrackId, setActiveTrackId, submissions, saveDraft, confirmSubmit, showToast } = usePortal();

  const validTrack = TRACKS.find(t => t.id === trackId);
  const activeTrack = validTrack || TRACKS.find(t => t.id === activeTrackId) || TRACKS[0];
  const activeType = getTypeOfTrack(activeTrack.id);
  const grouped = isGrouped(activeTrack);
  // Grouped: every กลุ่มสาขาวิชา always exists; default to the first one
  const requestedGroup = groupParam != null ? Number(groupParam) : null;
  const activeGroup = grouped
    ? (activeTrack.subjectGroups[requestedGroup] != null ? requestedGroup : 0)
    : null;

  // Keep URL and active track in sync; fix invalid track or group in the URL
  useEffect(() => {
    if (!validTrack) {
      navigate(`/submit/${activeTrackId || 'theory'}`, { replace: true });
      return;
    }
    if (validTrack.id !== activeTrackId) setActiveTrackId(validTrack.id);
    if (grouped) {
      const want = `/submit/${validTrack.id}/${activeGroup}`;
      const has = groupParam == null ? `/submit/${validTrack.id}` : `/submit/${validTrack.id}/${groupParam}`;
      if (want !== has) navigate(want, { replace: true });
    }
  }, [validTrack, activeTrackId, setActiveTrackId, navigate, grouped, activeGroup, groupParam]);

  // The submission this page edits: the track itself, or the chosen group's entry
  const entryId = grouped ? entryKey(activeTrack.id, activeGroup) : activeTrack.id;
  const sub = (entryId && submissions[entryId]) || emptySubmission();

  const [formErrors, setFormErrors] = useState({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Errors belong to one entry; clear them when switching
  useEffect(() => {
    setFormErrors({});
  }, [entryId]);

  const isLocked = sub.status === 'submitted';
  const daysLeft = daysUntil(activeTrack.deadline);

  const handleSaveDraft = () => {
    const res = saveDraft(entryId);
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
      const first = Object.keys(errors)[0];
      document.getElementById(`section-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setFormErrors({});
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    confirmSubmit(entryId);
    setConfirmModalOpen(false);
  };

  // Section numbers follow the order they appear on the page
  let n = 0;
  const next = () => ++n;

  // A section is "done" when every requirement that belongs to it passes
  const reqs = getRequirements(activeTrack, sub);
  const done = (section) => {
    const list = reqs.filter(r => r.section === section);
    return list.length > 0 && list.every(r => r.ok);
  };
  const hasLink = !!(sub.links?.video || sub.links?.github || sub.links?.drive);
  const groupName = grouped && activeGroup != null ? activeTrack.subjectGroups[activeGroup] : null;

  return (
    <div className="app-container" style={{ padding: '28px 20px 80px' }}>
      <TrackSelector />

      {/* Track title band */}
      <div className="tile tile-hero reveal" style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        padding: '28px 32px'
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--primary)' }}>
            {activeTrack.category || 'ประเภทการแข่งขัน'}
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 700, marginTop: '2px' }}>
            {activeTrack.full}
          </h1>
          {(groupName || activeTrack.desc) && (
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {groupName || activeTrack.desc}
            </div>
          )}
        </div>

        {entryId && (isLocked ? (
          <span className="badge" style={{ fontSize: '15px', padding: '8px 16px', background: 'var(--blue-bg)', color: 'var(--blue-text)' }}>
            <LockSimple size={16} weight="bold" />
            ส่งแล้ว แก้ไขไม่ได้
          </span>
        ) : (
          <span className="badge" style={{ fontSize: '15px', padding: '8px 16px', background: 'var(--primary)', color: '#FFFFFF' }}>
            <CalendarBlank size={16} weight="bold" />
            ปิดรับ {fmtDate(activeTrack.deadline)} (อีก {daysLeft} วัน)
          </span>
        ))}
      </div>

      {hasSubTypes(activeType) && <SubTypeBar type={activeType} activeTrackId={activeTrack.id} />}

      {grouped && (
        <GroupBar
          track={activeTrack}
          activeGroup={activeGroup}
          onSelect={(i) => navigate(`/submit/${activeTrack.id}/${i}`)}
        />
      )}

      {entryId && (
        <>
          {isLocked && (
            <div className="alert alert-info" style={{ marginBottom: '24px' }}>
              <CheckCircle size={20} weight="fill" />
              <span>
                ส่งผลงาน{groupName ? 'กลุ่มสาขานี้' : 'ประเภทนี้'}เรียบร้อยแล้ว หากต้องการแก้ไขข้อมูล กรุณาติดต่อกองอำนวยการ
              </span>
            </div>
          )}

          <div className="submit-grid">
            {/* Form sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              <TeamMembersSection
                trackId={entryId}
                isLocked={isLocked}
                error={formErrors.team}
                number={next()}
                done={done('team')}
              />

              {/* Project info, links and files: video clip only */}
              {activeTrack.needsWorkInfo && (
                <>
                  <ProjectInfoSection
                    trackId={entryId}
                    isLocked={isLocked}
                    error={formErrors.projectName}
                    number={next()}
                    done={done('projectName')}
                  />
                  <ExternalLinksSection
                    trackId={entryId}
                    isLocked={isLocked}
                    number={next()}
                    done={hasLink}
                  />
                  <FileUploader
                    trackId={entryId}
                    isLocked={isLocked}
                    error={formErrors.deliverables}
                    number={next()}
                    done={done('deliverables')}
                  />
                </>
              )}
            </div>

            {/* Sticky checklist */}
            <div>
              <SubmissionChecklist
                trackId={entryId}
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
        </>
      )}
    </div>
  );
};
