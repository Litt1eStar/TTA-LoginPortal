export const FINAL_DEADLINE = '2027-01-15T23:59:00+07:00';

// Subject groups (กลุ่มสาขาวิชา), names as given by the organisers
const SUBJECT_GROUPS = [
  'กลุ่มสาขาวิชาไฟฟ้า',
  'กลุ่มสาขาวิชาอุตสาหการ',
  'กลุ่มสาขาวิชาโยธา',
  'กลุ่มสาขาวิชาเครื่องกล',
  'กลุ่มสาขาวิชาคอมพิวเตอร์'
];

// Fields each group covers (from ข้อมูลให้เบ้น.xlsx), shown as a hint when choosing a group
export const SUBJECT_GROUP_HINTS = [
  'ไฟฟ้า / อิเล็กทรอนิกส์ / โทรคมนาคม',
  'อุตสาหการ / การผลิต / การเชื่อม',
  'โยธา / สถาปัตยกรรม / ออกแบบ',
  'เครื่องกล / เมคคาทรอนิกส์ / ยานยนต์สมัยใหม่',
  'คอมพิวเตอร์ / มัลติมีเดีย / ดิจิทัล / เทคโนโลยีและสื่อสารการศึกษา'
];

// Practice uses only the first 4 groups (no computer group)
const PRACTICE_SUBJECT_GROUPS = SUBJECT_GROUPS.slice(0, 4);

export const CULTURE_CATEGORY = 'การแข่งขันศิลปวัฒนธรรม';

// Track fields:
//   th             short label used in the track bar and cards
//   full           official category name, used as the page heading
//   category       parent group, e.g. การแข่งขันศิลปวัฒนธรรม (optional)
//   desc           Thai description shown under an English name (optional)
//   maxCompetitors max competitors per team (from the sheet)
//   teacherStudent number of นักศึกษาครู slots (from the sheet, info only)
//   advisorCount   max advisors (ผู้ควบคุมทีม / อาจารย์ที่ปรึกษา)
//   needsWorkInfo  true → form also asks for project info, links and files
//   subjectGroups  กลุ่มสาขาวิชา list (theory / practice only)
//   icon           Phosphor icon name — final icons will come from the team (FEEDBACK #6)
//
// Order follows the organisers' list.
// TODO (FEEDBACK #8): advisorCount = 2 for singing is a placeholder until พี่เต๋อ's Excel confirms.
export const TRACKS = [
  { id: 'theory', th: 'สอนทฤษฎี', full: 'สอนทฤษฎี', en: 'Teaching Theory', icon: 'ChalkboardTeacher', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false, subjectGroups: SUBJECT_GROUPS },
  { id: 'practice', th: 'สอนปฏิบัติ', full: 'สอนปฏิบัติ', en: 'Teaching Practice', icon: 'HandPointing', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false, subjectGroups: PRACTICE_SUBJECT_GROUPS },
  { id: 'singing', th: 'ร้องเพลงลูกทุ่ง', full: 'ประกวดร้องเพลงลูกทุ่ง', category: CULTURE_CATEGORY, en: 'Luk Thung Singing', icon: 'MicrophoneStage', deadline: FINAL_DEADLINE, maxCompetitors: 1, teacherStudent: 0, advisorCount: 2, needsWorkInfo: false },
  { id: 'dance', th: 'แดนเซอร์จินตลีลา', full: 'แดนเซอร์จินตลีลา', category: CULTURE_CATEGORY, en: 'Creative Movement Dance', icon: 'PersonSimpleRun', deadline: FINAL_DEADLINE, maxCompetitors: 13, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'clip', th: 'สื่อสร้างสรรค์', full: 'การแข่งขันประเภทสื่อสร้างสรรค์', category: CULTURE_CATEGORY, en: 'Creative Media', icon: 'VideoCamera', deadline: FINAL_DEADLINE, maxCompetitors: 4, teacherStudent: 1, advisorCount: 1, needsWorkInfo: true },
  { id: 'hardware', th: 'Hardware', full: 'Hardware', desc: 'สื่อฯ นวัตกรรมฮาร์ดแวร์', en: 'Hardware Innovation', icon: 'Cpu', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'software', th: 'Software', full: 'Software', desc: 'สื่อฯ นวัตกรรมซอฟต์แวร์', en: 'Software Innovation', icon: 'Code', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 1, advisorCount: 1, needsWorkInfo: false },
  { id: 'robot', th: 'Robot', full: 'Robot', desc: 'การแข่งขันหุ่นยนต์ (Robot Contest)', en: 'Robot Contest', icon: 'Robot', deadline: FINAL_DEADLINE, maxCompetitors: 2, teacherStudent: 1, advisorCount: 1, needsWorkInfo: false },
  { id: 'research', th: 'วิจัยในชั้นเรียน', full: 'วิจัยในชั้นเรียน', desc: 'นวัตกรรมงานวิจัยในชั้นเรียน', en: 'Classroom Research', icon: 'Flask', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
  { id: 'pitching', th: 'Pitching', full: 'Pitching', desc: 'การเป็นผู้ประกอบการ', en: 'Entrepreneur Pitching', icon: 'PresentationChart', deadline: FINAL_DEADLINE, maxCompetitors: 3, teacherStudent: 0, advisorCount: 1, needsWorkInfo: false },
];

// Second line under a category name: its parent group or Thai description
export const trackSubtitle = (track) => track?.category || track?.desc || '';

// ---- Top-level types (8), as the organisers list them ----
// Tracks that share a `category` become one type with sub-types
// (การแข่งขันศิลปวัฒนธรรม → ร้องเพลงลูกทุ่ง / แดนเซอร์จินตลีลา / สื่อสร้างสรรค์).
// Every other track is a type of its own.
const CATEGORY_META = {
  [CULTURE_CATEGORY]: { id: 'culture', icon: 'MaskHappy' }
};

export const TYPES = (() => {
  const out = [];
  const byCategory = {};
  TRACKS.forEach(t => {
    if (!t.category) {
      out.push({ id: t.id, label: t.th, icon: t.icon, tracks: [t] });
      return;
    }
    if (!byCategory[t.category]) {
      byCategory[t.category] = { ...CATEGORY_META[t.category], label: t.category, tracks: [] };
      out.push(byCategory[t.category]);
    }
    byCategory[t.category].tracks.push(t);
  });
  return out;
})();

export const hasSubTypes = (type) => type.tracks.length > 1;

// The type a track (or entry key) belongs to
export const getTypeOfTrack = (id) => {
  const trackId = getTrack(id).id;
  return TYPES.find(ty => ty.tracks.some(t => t.id === trackId));
};

// ---- Entries ----
// Most tracks have one submission, stored under the track id.
// Grouped tracks (theory / practice): every กลุ่มสาขาวิชา is a sub-type with its own
// submission, created blank automatically: submissions[`${trackId}.g${i}`]
export const isGrouped = (track) => !!track?.subjectGroups?.length;

export const entryKey = (trackId, groupIdx) =>
  groupIdx == null ? trackId : `${trackId}.g${groupIdx}`;

export const parseEntryKey = (key) => {
  const [trackId, g] = String(key).split('.g');
  return { trackId, groupIdx: g == null ? null : Number(g) };
};

// Accepts a track id or an entry key
export const getTrack = (id) => {
  const base = parseEntryKey(id).trackId;
  return TRACKS.find(t => t.id === base) || TRACKS[0];
};

// Short label for a subject group, e.g. "ไฟฟ้า" from "กลุ่มสาขาวิชาไฟฟ้า"
// (also accepts the older "ไฟฟ้า / อิเล็กทรอนิกส์ / ..." form)
export const groupShortName = (group) =>
  String(group || '').replace(/^กลุ่มสาขาวิชา/, '').split(' / ')[0];

export const ALLOWED_EXTENSIONS = ['pdf', 'zip', 'ppt', 'pptx'];
