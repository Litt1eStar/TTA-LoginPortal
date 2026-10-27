// Submission rules shared by the submit button and the readiness checklist.
// Each requirement: { key, section, label, ok, error }
// `section` matches the form section that shows the error.
export const getRequirements = (track, sub = {}) => {
  const members = sub.members || [];
  const advisors = members.filter(m => m.type === 'advisor');
  const students = members.filter(m => m.type === 'student');
  const hasLeader = students.some(m => m.isLeader);
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

  const advisorLimit = track.advisorCount || 1;
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

  const max = track.maxCompetitors;
  const withinMax = !max || students.length <= max;
  let teamError = '';
  if (students.length === 0) teamError = 'กรุณาเพิ่มผู้แข่งขันอย่างน้อย 1 คน';
  else if (!withinMax) teamError = `จำนวนผู้แข่งขันเกินที่กำหนด (สูงสุด ${max} คน)`;
  else if (!hasLeader) teamError = 'กรุณากำหนดหัวหน้าทีม';
  reqs.push({
    key: 'team',
    section: 'team',
    label: `ผู้แข่งขัน ${students.length}${max ? `/${max}` : ''} คน พร้อมหัวหน้าทีม`,
    ok: !teamError,
    error: teamError
  });

  const missingDept = members.filter(m => !m.dept);
  reqs.push({
    key: 'dept',
    section: 'team',
    label: 'ทุกคนระบุหน่วยงาน',
    ok: members.length > 0 && missingDept.length === 0,
    error: missingDept.length
      ? `กรุณาระบุหน่วยงานของ ${missingDept.map(m => m.fullName).join(', ')}`
      : 'กรุณาเพิ่มรายชื่อทีม'
  });

  // Every person (advisors and competitors) needs their own photo
  const missingPhoto = members.filter(m => !m.photo?.dataUrl);
  reqs.push({
    key: 'photos',
    section: 'team',
    label: 'ทุกคนมีรูปถ่าย',
    ok: members.length > 0 && missingPhoto.length === 0,
    error: missingPhoto.length
      ? `กรุณาอัปโหลดรูปถ่ายของ ${missingPhoto.map(m => m.fullName).join(', ')}`
      : 'กรุณาเพิ่มรายชื่อทีม'
  });

  if (track.needsWorkInfo) {
    const hasFiles = (sub.files || []).some(f => f.status === 'done');
    const hasLinks = !!(sub.links?.video || sub.links?.github || sub.links?.drive);
    reqs.push({
      key: 'deliverables',
      section: 'deliverables',
      label: 'อัปโหลดไฟล์หรือแนบลิงก์ผลงาน',
      ok: hasFiles || hasLinks,
      error: 'กรุณาอัปโหลดไฟล์ หรือแนบลิงก์ผลงานอย่างน้อย 1 รายการ'
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
  const advisors = (sub.members || []).filter(m => m.type === 'advisor').length;
  if (!students && !advisors) return '';
  return [students ? `ผู้แข่งขัน ${students} คน` : '', advisors ? `อาจารย์ ${advisors} ท่าน` : ''].filter(Boolean).join(' · ');
};
