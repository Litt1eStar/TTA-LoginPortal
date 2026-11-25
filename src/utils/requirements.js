import { trackRoles, defaultRole, usesLeader } from '../data/tracks.js';

// Submission rules shared by the submit button and the readiness checklist.
// Each requirement: { key, section, label, ok, error, detail? }
// `detail` names the people still missing something (shown under the checklist item).
// `section` matches the form section that shows the error.
export const getRequirements = (track, sub = {}) => {
  const members = sub.members || [];
  const advisors = members.filter(m => m.type === 'advisor');
  const students = members.filter(m => m.type === 'student');
  const hasLeader = students.some(m => m.isLeader);
  const roles = trackRoles(track);
  const roleCounts = Object.fromEntries(roles.map(r => [r.name, 0]));
  const unknownRoles = [];
  for (const m of students) {
    const rName = m.role || defaultRole(track);
    if (!(rName in roleCounts)) unknownRoles.push(rName);
    else roleCounts[rName] += 1;
  }
  const reqs = [];

  if (track.needsWorkInfo) {
    reqs.push({
      key: 'projectName',
      section: 'projectName',
      label: 'ระบุชื่อผลงาน',
      ok: !!(sub.projectName || '').trim(),
      error: 'กรุณาระบุชื่อผลงานก่อนส่ง'
    });
  }

  const advisorLimit = track.advisorCount ?? 1;
  if (advisorLimit > 0) {
    reqs.push({
      key: 'advisors',
      section: 'team',
      label: advisorLimit > 1
        ? `ระบุอาจารย์ที่ปรึกษา (1-${advisorLimit} ท่าน)`
        : 'ระบุอาจารย์ที่ปรึกษา (1 ท่าน)',
      ok: advisors.length >= 1 && advisors.length <= advisorLimit,
      error: advisors.length === 0
        ? 'กรุณาระบุอาจารย์ที่ปรึกษาอย่างน้อย 1 ท่าน'
        : `อาจารย์ที่ปรึกษาเกินจำนวนที่กำหนด (สูงสุด ${advisorLimit} ท่าน)`
    });
  }

  const isParticipants = !!track.participantsOnly;
  const min = track.minCompetitors ?? 1;
  const max = track.maxCompetitors;
  const withinMax = !max || students.length <= max;
  const needLeader = usesLeader(track);
  const hasRequiredRoles = roles.some(r => r.required);
  const backstageRoles = new Set(roles.filter(r => r.group === 'backstage').map(r => r.name));
  const backstageCount = students.filter(m => backstageRoles.has(m.role || defaultRole(track))).length;
  const personLabel = isParticipants ? 'ผู้เข้าร่วม' : 'ผู้แข่งขัน';
  let teamError = '';
  if (students.length === 0) teamError = `กรุณาเพิ่ม${personLabel}อย่างน้อย ${min} คน`;
  else if (students.length < min) teamError = `จำนวน${personLabel}ไม่ครบตามเกณฑ์ (ต้องมีอย่างน้อย ${min} คน)`;
  else if (!withinMax) teamError = `จำนวน${personLabel}เกินที่กำหนด (สูงสุด ${max} คน)`;
  else if (unknownRoles.length) teamError = `พบบทบาทที่ไม่รองรับ: ${unknownRoles[0]}`;
  else {
    const over = roles.find(r => roleCounts[r.name] > r.max);
    const missingReq = roles.filter(r => r.required && roleCounts[r.name] < 1);
    if (over) teamError = `${over.name}เกินจำนวนที่กำหนด (สูงสุด ${over.max} คน)`;
    else if (track.backstageCap && backstageCount > track.backstageCap) {
      teamError = `ฝ่าย Backstage (รวมผู้ควบคุมไฟและเสียง) เกินจำนวนที่กำหนด (สูงสุด ${track.backstageCap} คน)`;
    }
    else if (missingReq.length) teamError = `กรุณาระบุ${missingReq.map(r => r.name).join(' และ ')}`;
    else if (needLeader && !hasLeader) teamError = 'กรุณากำหนดหัวหน้าทีม';
  }
  const rangeText = max ? (min > 1 && min !== max ? `${min}-${max}` : `${max}`) : '';
  const teamLabelText = hasRequiredRoles
    ? `ผู้สอนหลักและผู้ช่วยสอน (${students.length}/${max} คน)`
    : needLeader
      ? `ผู้แข่งขัน ${students.length}${rangeText ? `/${rangeText}` : ''} คน พร้อมหัวหน้าทีม`
      : `${personLabel} ${students.length}${rangeText ? `/${rangeText}` : ''} คน`;
  reqs.push({
    key: 'team',
    section: 'team',
    label: teamLabelText,
    ok: !teamError,
    detail: students.length > 0 && teamError ? teamError : '',
    error: teamError
  });

  if (!isParticipants) {
    const missingDept = members.filter(m => !m.dept);
    reqs.push({
      key: 'dept',
      section: 'team',
      label: 'ทุกคนระบุหน่วยงาน',
      ok: members.length > 0 && missingDept.length === 0,
      detail: missingDept.length ? `หน่วยงานขาด ${missingDept.length} คน: ${missingDept.map(m => m.fullName).join(', ')}` : '',
      error: missingDept.length
        ? `กรุณาระบุหน่วยงานของ ${missingDept.map(m => m.fullName).join(', ')}`
        : 'กรุณาเพิ่มรายชื่อทีม'
    });
  }

  // Every person (advisors and competitors) needs their own photo
  const missingPhoto = members.filter(m => !m.photo?.dataUrl);
  reqs.push({
    key: 'photos',
    section: 'team',
    label: 'ทุกคนมีรูปถ่าย',
    ok: members.length > 0 && missingPhoto.length === 0,
    detail: missingPhoto.length ? `รูปถ่ายขาด ${missingPhoto.length} คน: ${missingPhoto.map(m => m.fullName).join(', ')}` : '',
    error: missingPhoto.length
      ? `กรุณาอัปโหลดรูปถ่ายของ ${missingPhoto.map(m => m.fullName).join(', ')}`
      : 'กรุณาเพิ่มรายชื่อทีม'
  });

  if (track.needsWorkInfo) {
    // The work-file upload was removed: a clip is delivered as a Drive video or a YouTube link
    const hasLinks = !!sub.links?.video;
    const hasVideo = !!sub.video?.driveFileId;
    reqs.push({
      key: 'deliverables',
      section: 'links',
      label: 'อัปโหลดวิดีโอ หรือแนบลิงก์ YouTube',
      ok: hasLinks || hasVideo,
      error: 'กรุณาอัปโหลดวิดีโอ หรือแนบลิงก์ YouTube อย่างน้อย 1 รายการ'
    });
  }

  return reqs;
};

// Map failed requirements to { [section]: firstErrorMessage }
export const getFormErrors = (reqs) => {
  const errors = {};
  reqs.forEach(r => {
    if (!r.ok && !errors[r.section]) errors[r.section] = r.error;
  });
  return errors;
};

// One-line summary used on dashboard cards and the history table.
// Clip shows the project name; other tracks summarise the team.
export const submissionSummary = (track, sub = {}) => {
  if (track.needsWorkInfo) return sub.projectName ? `“${sub.projectName}”` : '';
  const students = (sub.members || []).filter(m => m.type === 'student').length;
  if (track.participantsOnly) return students ? `ผู้เข้าร่วม ${students} คน` : '';
  const advisors = (sub.members || []).filter(m => m.type === 'advisor').length;
  if (!students && !advisors) return '';
  return [students ? `ผู้แข่งขัน ${students} คน` : '', advisors ? `อาจารย์ ${advisors} ท่าน` : ''].filter(Boolean).join(' · ');
};
