export const FINAL_DEADLINE = '2027-01-15T23:59:00+07:00';

// Subject groups (กลุ่มสาขา) from ข้อมูลให้เบ้น.xlsx
const SUBJECT_GROUPS = [
  'ไฟฟ้า / อิเล็กทรอนิกส์ / โทรคมนาคม',
  'อุตสาหการ / การผลิต / การเชื่อม',
  'โยธา / สถาปัตยกรรม / ออกแบบ',
  'เครื่องกล / เมคคาทรอนิกส์ / ยานยนต์สมัยใหม่',
  'คอมพิวเตอร์ / มัลติมีเดีย / ดิจิทัล / เทคโนโลยีและสื่อสารการศึกษา'
];

// Practice uses only the first 4 groups (no computer group), per the sheet
const PRACTICE_SUBJECT_GROUPS = SUBJECT_GROUPS.slice(0, 4);

// Track fields:
//   th             short label used in the track bar
//   full           full category name used as the page heading
//   maxCompetitors max competitors per team (from the sheet)
//   teacherStudent number of นักศึกษาครู slots (from the sheet, info only)
//   advisorCount   max advisors (ผู้ควบคุมทีม / อาจารย์ที่ปรึกษา)
//   needsWorkInfo  true → form also asks for project info, links and files
//   subjectGroups  list for the กลุ่มสาขา dropdown (theory / practice only)
//   icon           Phosphor icon name — final icons will come from the team (FEEDBACK #6)
//
// TODO (FEEDBACK #8): advisorCount = 2 for singing is a placeholder until พี่เต๋อ's Excel confirms.
export const TRACKS = [
  { id: 'theory', th: 'สอนทฤษฎี', full: 'สอนทฤษฎี', en: 'Teaching Theory', icon: 'ChalkboardTeacher', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false, subjectGroups: SUBJECT_GROUPS },
  { id: 'practice', th: 'สอนปฏิบัติ', full: 'สอนปฏิบัติ', en: 'Teaching Practice', icon: 'HandPointing', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false, subjectGroups: PRACTICE_SUBJECT_GROUPS },
  { id: 'hardware', th: 'Hardware', full: 'สื่อฯ นวัตกรรมฮาร์ดแวร์', en: 'Hardware Innovation', icon: 'Cpu', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'software', th: 'Software', full: 'สื่อฯ นวัตกรรมซอฟต์แวร์', en: 'Software Innovation', icon: 'Code', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 1, advisorCount: 1, needsWorkInfo: false },
  { id: 'research', th: 'วิจัยในชั้นเรียน', full: 'นวัตกรรมงานวิจัยในชั้นเรียน', en: 'Classroom Research', icon: 'Flask', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'clip', th: 'Clip VDO', full: 'สื่อสร้างสรรค์ (คลิปวิดีโอ)', en: 'Video Clip', icon: 'VideoCamera', deadline: FINAL_DEADLINE, maxCompetitors: 4, teacherStudent: 1, advisorCount: 1, needsWorkInfo: true },
  { id: 'pitching', th: 'Pitching', full: 'Pitching การเป็นผู้ประกอบการ', en: 'Entrepreneur Pitching', icon: 'PresentationChart', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'robot', th: 'Robot', full: 'หุ่นยนต์ (Robot Contest)', en: 'Robot Contest', icon: 'Robot', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 1, advisorCount: 1, needsWorkInfo: false },
  { id: 'singing', th: 'ร้องเพลง', full: 'ประกวดร้องเพลงลูกทุ่ง', en: 'Luk Thung Singing', icon: 'MicrophoneStage', deadline: FINAL_DEADLINE, maxCompetitors: 1, teacherStudent: 0, advisorCount: 2, needsWorkInfo: false },
  { id: 'dance', th: 'จินตลีลา', full: 'แดนเซอร์จินตลีลา', en: 'Creative Movement Dance', icon: 'PersonSimpleRun', deadline: FINAL_DEADLINE, maxCompetitors: 13, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
];

export const getTrack = (id) => TRACKS.find(t => t.id === id) || TRACKS[0];

export const ALLOWED_EXTENSIONS = ['pdf', 'zip', 'ppt', 'pptx'];
