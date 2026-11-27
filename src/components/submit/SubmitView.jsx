import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicUrl, isSubmitUrl } from '../../utils/publicUrl';
import { usePortal } from '../../context/PortalContext';
import { useSwapTransition } from '../../hooks/useSwapTransition';
import { TRACKS, isGrouped, entryKey, getTypeOfTrack, hasSubTypes } from '../../data/tracks';
import { SubTypeBar } from './SubTypeBar';
import { deadlineState, fmtDate } from '../../utils/formatters';
import { TrackSelector } from './TrackSelector';
import { GroupBar } from './GroupBar';
import { ProjectInfoSection } from './ProjectInfoSection';
import { ExternalLinksSection } from './ExternalLinksSection';
import { TeamMembersSection } from './TeamMembersSection';
import { VideoUploader } from './VideoUploader';
import { SubmissionChecklist } from './SubmissionChecklist';
import { MobileSubmitBar } from './MobileSubmitBar';
import { ConfirmSubmitModal } from './ConfirmSubmitModal';
import { SubmitCelebration } from './SubmitCelebration';
import { getRequirements, getFormErrors } from '../../utils/requirements';
import { emptySubmission } from '../../data/seedData';
import { LockSimple, CheckCircle, CalendarBlank } from '@phosphor-icons/react';

const ALL_ENTRY_KEYS = TRACKS.flatMap(t =>
  isGrouped(t) ? t.subjectGroups.map((_, i) => entryKey(t.id, i)) : [t.id]
);
const ENTRY_ORDER = new Map(ALL_ENTRY_KEYS.map((k, idx) => [k, idx]));

export const SubmitView = () => {
  const { trackId, groupIdx: groupParam } = useParams();
  const navigate = useNavigate();
  const { activeTrackId, setActiveTrackId, submissions, saveDraft, confirmSubmit, showToast } = usePortal();

  const validTrack = TRACKS.find(t => t.id === trackId);
  const liveTrack = validTrack || TRACKS.find(t => t.id === activeTrackId) || TRACKS[0];
  const liveType = getTypeOfTrack(liveTrack.id);
  const liveGrouped = isGrouped(liveTrack);
  // Grouped: every กลุ่มสาขาวิชา always exists; default to the first one
  const requestedGroup = groupParam != null ? Number(groupParam) : null;
  const liveGroup = liveGrouped
    ? (liveTrack.subjectGroups[requestedGroup] != null ? requestedGroup : 0)
    : null;
  const liveEntryId = liveGrouped ? entryKey(liveTrack.id, liveGroup) : liveTrack.id;

  // Keep URL and active track in sync; fix invalid track or group in the URL
  useEffect(() => {
    // The browser's real URL, not the router's: while the page swap animates out, this view still
    // renders with the old (displayed) location, and fixing that URL would pull the user back here.
    if (typeof window !== 'undefined' && !isSubmitUrl(window.location.pathname)) return;
    if (!validTrack) {
      navigate(`/submit/${activeTrackId || 'theory'}`, { replace: true });
      return;
    }
    if (validTrack.id !== activeTrackId) setActiveTrackId(validTrack.id);
    if (liveGrouped) {
      const want = `/submit/${validTrack.id}/${liveGroup}`;
      const has = groupParam == null ? `/submit/${validTrack.id}` : `/submit/${validTrack.id}/${groupParam}`;
      if (want !== has) navigate(want, { replace: true });
    }
  }, [validTrack, activeTrackId, setActiveTrackId, navigate, liveGrouped, liveGroup, groupParam]);

  // Track whether the active swap crossed top-level types ('type') or stayed within one type ('entry')
  const swapScopeRef = useRef('type');

  const targetView = {
    activeTrack: liveTrack,
    activeType: liveType,
    grouped: liveGrouped,
    activeGroup: liveGroup,
    entryId: liveEntryId
  };

  const entrySwap = useSwapTransition(targetView, {
    keyOf: (v) => v.entryId,
    orderOf: (v) => ENTRY_ORDER.get(v.entryId) ?? 0,
    outMs: 110
  });

  if (liveEntryId !== entrySwap.displayed.entryId) {
    swapScopeRef.current = liveType?.id !== entrySwap.displayed.activeType?.id ? 'type' : 'entry';
  }

  const { activeTrack, grouped, activeGroup, entryId } = entrySwap.displayed;
  const sub = (entryId && submissions[entryId]) || emptySubmission();
  const isTypeTransition = swapScopeRef.current === 'type';

  const [formErrors, setFormErrors] = useState({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [celebration, setCelebration] = useState(null); // { track, groupName, hash, nextPath }

  // Errors belong to one entry; clear them when switching
  useEffect(() => {
    setFormErrors({});
  }, [entryId]);

  const isLocked = sub.status === 'submitted';
  const deadline = deadlineState(activeTrack.deadline);

  const handleSaveDraft = async () => {
    const res = await saveDraft(entryId);
    if (res.success) {
      setFormErrors({});
    } else if (res.field) {
      setFormErrors({ [res.field]: res.error });
      showToast(res.error);
    }
    // Server errors were already shown as a toast by PortalContext
  };

  const handleAttemptSubmit = () => {
    if (deadline.closed) return;
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

  // First other entry (in track order) that is not submitted and still open
  const nextUnsubmittedPath = () => {
    for (const t of TRACKS) {
      if (deadlineState(t.deadline).closed) continue;
      const keys = isGrouped(t)
        ? t.subjectGroups.map((_, i) => ({ key: entryKey(t.id, i), path: `/submit/${t.id}/${i}` }))
        : [{ key: t.id, path: `/submit/${t.id}` }];
      const hit = keys.find(k => k.key !== entryId && submissions[k.key]?.status !== 'submitted');
      if (hit) return hit.path;
    }
    return null;
  };

  // Returns the result so the modal can show the server's reason when it refuses
  const handleConfirmSubmit = async () => {
    const res = await confirmSubmit(entryId);
    if (res.success) {
      setConfirmModalOpen(false);
      setCelebration({
        track: activeTrack,
        groupName: grouped && activeGroup != null ? activeTrack.subjectGroups[activeGroup] : null,
        hash: res.hash,
        nextPath: nextUnsubmittedPath()
      });
    }
    return res;
  };

  const closeCelebration = React.useCallback(() => setCelebration(null), []);

  // Section numbers follow the order they appear on the page
  let n = 0;
  const next = () => ++n;

  // A section is "done" when every requirement that belongs to it passes
  const reqs = getRequirements(activeTrack, sub);
  const done = (section) => {
    const list = reqs.filter(r => r.section === section);
    return list.length > 0 && list.every(r => r.ok);
  };
  const groupName = grouped && activeGroup != null ? activeTrack.subjectGroups[activeGroup] : null;
  const outerClass = isTypeTransition ? entrySwap.className : 'swap-stage';
  const innerClass = !isTypeTransition ? entrySwap.className : 'swap-stage';

  return (
    <div className={`app-container${entryId && !isLocked ? ' has-submit-bar' : ''}`} style={{ padding: '28px 20px 80px', overflowX: 'clip' }}>
      <TrackSelector />

      <div
        key={entrySwap.displayed.activeType?.id}
        className={outerClass}
        style={{ ...entrySwap.style, '--swap-in-ms': '245ms' }}
      >
        {/* Track title band */}
        <div className="tile tile-hero" style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          padding: '28px 32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {activeTrack.image && (
              <span className="mascot-float">
              <img
                key={activeTrack.image}
                className="swap-mascot"
                src={publicUrl(activeTrack.image)}
                alt=""
                width="64"
                height="64"
                decoding="async"
                style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0, '--swap-dir': entrySwap.dir }}
              />
              </span>
            )}
            <div
              key={!isTypeTransition ? entrySwap.displayedKey : undefined}
              className={!isTypeTransition ? entrySwap.className : undefined}
              style={!isTypeTransition ? { ...entrySwap.style, '--swap-in-ms': '220ms' } : undefined}
            >
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--primary)' }}>
                {activeTrack.category || (activeTrack.participantsOnly ? 'ผู้เข้าร่วมงาน' : 'ประเภทการแข่งขัน')}
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
          </div>

          {entryId && (
            <div className="submit-head-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {isLocked ? (
                <span className="badge" style={{ fontSize: '15px', padding: '8px 16px', background: 'var(--blue-bg)', color: 'var(--blue-text)' }}>
                  <LockSimple size={16} weight="bold" />
                  ส่งแล้ว แก้ไขไม่ได้
                </span>
              ) : (
                <span className="badge" style={{
                  fontSize: '15px',
                  padding: '8px 16px',
                  background: deadline.closed ? '#ECEDF3' : deadline.soon ? 'var(--danger)' : 'var(--primary)',
                  color: deadline.closed ? 'var(--text-muted)' : '#FFFFFF'
                }}>
                  <CalendarBlank size={16} weight="bold" />
                  {deadline.closed
                    ? `ปิดรับลงทะเบียนแล้ว (${fmtDate(activeTrack.deadline)})`
                    : <>ปิดรับลงทะเบียน {fmtDate(activeTrack.deadline)} <span className="nowrap">({deadline.label})</span></>}
                </span>
              )}
              {!activeTrack.participantsOnly && (
                <span className="badge" style={{ fontSize: '13.5px', padding: '6px 12px', background: '#F6F6F9', color: 'var(--text-muted)' }}>
                  กำหนดส่งเอกสาร/ผลงาน: {activeTrack.docDeadlineLabel || 'ประกาศเร็วๆ นี้'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sub-type / Subject-group bars read live active pill so clicked tab highlights at 0ms */}
        {hasSubTypes(liveType) && <SubTypeBar type={liveType} activeTrackId={liveTrack.id} />}

        {liveGrouped && (
          <GroupBar
            track={liveTrack}
            activeGroup={liveGroup}
            onSelect={(i) => navigate(`/submit/${liveTrack.id}/${i}`)}
          />
        )}

        {entryId && (
          <div
            key={entrySwap.displayedKey}
            className={innerClass}
            style={{ ...entrySwap.style, '--swap-in-ms': '225ms' }}
          >
            {isLocked && (
              <div className="alert alert-info" style={{ marginBottom: '24px' }}>
                <CheckCircle size={20} weight="fill" />
                <span>
                  ส่งผลงาน{groupName ? 'กลุ่มสาขานี้' : 'ประเภทนี้'}เรียบร้อยแล้ว หากต้องการแก้ไขข้อมูล กรุณาติดต่อกองอำนวยการ
                </span>
              </div>
            )}

            {!isLocked && deadline.closed && (
              <div className="alert alert-error" style={{ marginBottom: '24px' }}>
                <LockSimple size={20} weight="fill" />
                <span>ประเภทนี้ปิดรับผลงานแล้ว ไม่สามารถส่งได้ หากมีข้อสงสัยกรุณาติดต่อกองอำนวยการ</span>
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

                {/* Project info, links and video: video clip only */}
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
                      error={formErrors.links}
                      number={next()}
                      done={done('links')}
                    />
                    {activeTrack.id === 'clip' && (
                      <VideoUploader
                        trackId={entryId}
                        isLocked={isLocked}
                        number={next()}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Sticky checklist */}
              <div>
                <SubmissionChecklist
                  trackId={entryId}
                  isLocked={isLocked}
                  isClosed={deadline.closed}
                  onAttemptSubmit={handleAttemptSubmit}
                  onSaveDraft={handleSaveDraft}
                />
              </div>
            </div>

            <MobileSubmitBar
              trackId={entryId}
              isLocked={isLocked}
              isClosed={deadline.closed}
              onAttemptSubmit={handleAttemptSubmit}
            />

            <ConfirmSubmitModal
              isOpen={confirmModalOpen}
              onClose={() => setConfirmModalOpen(false)}
              onConfirm={handleConfirmSubmit}
              track={activeTrack}
              submission={sub}
            />
          </div>
        )}
      </div>

      {celebration && (
        <SubmitCelebration
          track={celebration.track}
          groupName={celebration.groupName}
          hash={celebration.hash}
          onClose={closeCelebration}
          onNext={celebration.nextPath ? () => { closeCelebration(); navigate(celebration.nextPath); } : null}
        />
      )}
    </div>
  );
};
