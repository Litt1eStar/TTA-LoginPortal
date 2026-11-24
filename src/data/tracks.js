export const FINAL_DEADLINE = '2026-12-15T23:59:00+07:00';

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
//   maxCompetitors max competitors per team (from the sheet / meeting 2)
//   advisorCount   max advisors (ผู้ควบคุมทีม / อาจารย์ที่ปรึกษา)
//   needsWorkInfo  true → form also asks for project info, links and files
//   subjectGroups  กลุ่มสาขาวิชา list (theory / practice only)
//   roles          allowed competitor roles: [{ name, max, required? }]
//   usesLeader     true → team designates one หัวหน้าทีม
//   image          optional path to mascot image (falls back to Phosphor `icon`)
//   icon           Phosphor icon name — fallback when `image` is not set
//
// Order follows the organisers' list.
// TODO (FEEDBACK #8): advisorCount = 2 for singing is a placeholder until พี่เต๋อ's Excel confirms.
export const TRACKS = [
  {
    id: 'theory', th: 'สอนทฤษฎี', full: 'สอนทฤษฎี', en: 'Teaching Theory', icon: 'ChalkboardTeacher', image: '/assets/mascots/theory.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งไฟล์แผนการสอน (.pdf) ภายใน 3 ก.พ. 2027 · ส่งรูปเล่ม 3 ชุด วันที่ 6 ก.พ. 2027 (ก่อน 09:00 น.)',
    maxCompetitors: 2, advisorCount: 1, needsWorkInfo: false, subjectGroups: SUBJECT_GROUPS,
    roles: [{ name: 'ผู้สอนหลัก', max: 1, required: true }, { name: 'ผู้ช่วยสอน', max: 1, required: true }],
    usesLeader: false
  },
  {
    id: 'practice', th: 'สอนปฏิบัติ', full: 'สอนปฏิบัติ', en: 'Teaching Practice', icon: 'HandPointing', image: '/assets/mascots/practice.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'เตรียมแผนการสอนและสื่อประกอบในวันแข่งขัน (6–7 ก.พ. 2027)',
    maxCompetitors: 2, advisorCount: 1, needsWorkInfo: false, subjectGroups: PRACTICE_SUBJECT_GROUPS,
    roles: [{ name: 'ผู้สอนหลัก', max: 1, required: true }, { name: 'ผู้ช่วยสอน', max: 1, required: true }],
    usesLeader: false
  },
  {
    id: 'singing', th: 'ร้องเพลงลูกทุ่ง', full: 'ประกวดร้องเพลงลูกทุ่ง', category: CULTURE_CATEGORY, en: 'Luk Thung Singing', icon: 'MicrophoneStage', image: '/assets/mascots/culture.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งไฟล์เพลง Backing Track ณ จุดลงทะเบียนก่อนแข่งขัน',
    maxCompetitors: 1, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'นักร้อง', max: 1 }],
    usesLeader: false
  },
  {
    id: 'dance', th: 'แดนเซอร์จินตลีลา', full: 'แดนเซอร์จินตลีลา', category: CULTURE_CATEGORY, en: 'Creative Movement Dance', icon: 'PersonSimpleRun', image: '/assets/mascots/culture.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'รายงานตัวพร้อมนักแสดงและอุปกรณ์ในวันแข่งขัน',
    maxCompetitors: 14, advisorCount: 1, backstageCap: 4, needsWorkInfo: false,
    roles: [
      { name: 'นักแสดง', max: 10 },
      { name: 'Backstage', max: 4, group: 'backstage' },
      { name: 'ผู้ควบคุมไฟ', max: 1, group: 'backstage' },
      { name: 'ผู้ควบคุมเสียง', max: 1, group: 'backstage' }
    ],
    usesLeader: false
  },
  {
    id: 'clip', th: 'สื่อสร้างสรรค์', full: 'การแข่งขันประเภทสื่อสร้างสรรค์', en: 'Creative Media', icon: 'VideoCamera', image: '/assets/mascots/clip.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งไฟล์คลิป 16:9 และ Teaser 9:16 ภายใน 13 ม.ค. 2027 เวลา 18:00 น.',
    minCompetitors: 3, maxCompetitors: 5, advisorCount: 1, needsWorkInfo: true,
    roles: [{ name: 'ผู้แข่งขัน', max: 5 }],
    usesLeader: false
  },
  {
    id: 'hardware', th: 'Hardware', full: 'Hardware', desc: 'สื่อฯ นวัตกรรมฮาร์ดแวร์', en: 'Hardware Innovation', icon: 'Cpu', image: '/assets/mascots/hardware.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งคู่มือ 3 ชุด + ไฟล์ .pdf และติดตั้งชิ้นงาน วันที่ 6 ก.พ. 2027 (13:30–16:00 น.)',
    minCompetitors: 3, maxCompetitors: 3, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'ผู้แข่งขัน', max: 3 }],
    usesLeader: false
  },
  {
    id: 'software', th: 'Software', full: 'Software', desc: 'สื่อฯ นวัตกรรมซอฟต์แวร์', en: 'Software Innovation', icon: 'Code', image: '/assets/mascots/software.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งคู่มือ 3 ชุด + Soft File วันที่ 6 ก.พ. 2027 (ก่อน 10:00 น.)',
    maxCompetitors: 3, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'ผู้แข่งขัน', max: 3 }],
    usesLeader: false
  },
  {
    id: 'robot', th: 'Robot', full: 'Robot', desc: 'การแข่งขันหุ่นยนต์ (Robot Contest)', en: 'Robot Contest', icon: 'Robot', image: '/assets/mascots/robot.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'นำหุ่นยนต์ตรวจขนาด (25×25 ซม.) และแรงดันไฟ (≤ 25V) ณ จุดลงทะเบียนก่อนแข่งขัน',
    maxCompetitors: 3, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'ผู้แข่งขัน', max: 3 }],
    usesLeader: false
  },
  {
    id: 'research', th: 'วิจัยในชั้นเรียน', full: 'วิจัยในชั้นเรียน', desc: 'นวัตกรรมงานวิจัยในชั้นเรียน', en: 'Classroom Research', icon: 'Flask', image: '/assets/mascots/research.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ติดโปสเตอร์ A0 (09:00–11:00 น.) และส่งไฟล์ .pdf ก่อน 10:00 น. วันที่ 6 ก.พ. 2027',
    maxCompetitors: 3, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'ผู้แข่งขัน', max: 3 }],
    usesLeader: false
  },
  {
    id: 'pitching', th: 'Pitching', full: 'Pitching', desc: 'การเป็นผู้ประกอบการ', en: 'Entrepreneur Pitching', icon: 'PresentationChart', image: '/assets/mascots/pitching.webp',
    deadline: FINAL_DEADLINE, docDeadlineLabel: 'ส่งเอกสารข้อเสนอ (≤ 5 หน้า PDF) และสไลด์นำเสนอ (≤ 20 หน้า) ตามกำหนด',
    maxCompetitors: 3, advisorCount: 1, needsWorkInfo: false,
    roles: [{ name: 'ผู้แข่งขัน', max: 3 }],
    usesLeader: false
  },
  {
    id: 'participants', th: 'ผู้เข้าร่วม', full: 'ผู้เข้าร่วม', desc: 'ผู้เข้าร่วมงาน (ไม่เกิน 10 คน)', en: 'Participants', icon: 'UsersThree',
    deadline: FINAL_DEADLINE, maxCompetitors: 10, advisorCount: 0, needsWorkInfo: false,
    roles: [{ name: 'ผู้เข้าร่วม', max: 10 }],
    usesLeader: false,
    participantsOnly: true
  }
];

export const trackRoles = (track) => track?.roles || [{ name: 'ผู้แข่งขัน', max: track?.maxCompetitors || 1 }];
export const defaultRole = (track) => trackRoles(track)[0].name;
export const hasMultipleRoles = (track) => trackRoles(track).length > 1;
export const usesLeader = (track) => !!track?.usesLeader;

// Second line under a category name: its parent group or Thai description
export const trackSubtitle = (track) => track?.category || track?.desc || '';

// ---- Top-level types (10), as the organisers list them ----
// Tracks that share a `category` become one type with sub-types
// (การแข่งขันศิลปวัฒนธรรม → ร้องเพลงลูกทุ่ง / แดนเซอร์จินตลีลา).
// Every other track is a type of its own.
const CATEGORY_META = {
  [CULTURE_CATEGORY]: { id: 'culture', icon: 'MaskHappy', image: '/assets/mascots/culture.webp' }
};

export const TYPES = (() => {
  const out = [];
  const byCategory = {};
  TRACKS.forEach(t => {
    if (!t.category) {
      out.push({ id: t.id, label: t.th, icon: t.icon, image: t.image || null, tracks: [t] });
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
