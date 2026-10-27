// Demo submissions.
// - Only the clip track uses projectName / summary / files / links.
// - Every member has university, dept and their own photo (demo SVG portrait).
// - Submitted entries must pass every requirement; PortalContext also downgrades any that don't.
// - Theory / practice: one entry per group under `${trackId}.g${index}` (see entryKey).
//   Groups not listed here are created blank by PortalContext.
const UNI = 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี';
const D1 = 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี';
const D2 = 'คณะครุศาสตร์อุตสาหกรรม';
const D3 = 'คณะวิศวกรรมศาสตร์';

// Demo portrait: first letter of the name on a soft colour, as an SVG data URL.
// Same { name, size, ext, dataUrl } shape as an uploaded photo.
const PHOTO_COLORS = [['#FFE4D6', '#C2410C'], ['#DCEEFF', '#0A65B0'], ['#FFF3C4', '#8A6100'], ['#E3F5E8', '#1F7A3D']];
const placeholderPhoto = (fullName) => {
  const letter = String(fullName || '?').trim().charAt(0);
  const [bg, fg] = PHOTO_COLORS[letter.charCodeAt(0) % PHOTO_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150">`
    + `<rect width="120" height="150" fill="${bg}"/>`
    + `<circle cx="60" cy="58" r="26" fill="${fg}" opacity="0.18"/>`
    + `<path d="M18 150c4-30 22-44 42-44s38 14 42 44z" fill="${fg}" opacity="0.18"/>`
    + `<text x="60" y="68" font-family="sans-serif" font-size="30" font-weight="700" fill="${fg}" text-anchor="middle">${letter}</text>`
    + `</svg>`;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { name: 'photo.svg', size: svg.length, ext: 'svg', dataUrl };
};

const advisor = (id, title, fullName, email, dept, photo = true) =>
  ({ id, type: 'advisor', title, fullName, email, phone: '', dept, university: UNI, photo: photo ? placeholderPhoto(fullName) : null, source: 'manual' });

const student = (id, title, fullName, studentId, dept, isLeader = false, photo = true) =>
  ({ id, type: 'student', title, fullName, studentId, email: '', phone: '', dept, university: UNI, photo: photo ? placeholderPhoto(fullName) : null, year: '3', isLeader, source: 'manual' });

export const emptySubmission = (extra = {}) => ({
  status: 'not_started',
  projectName: '',
  summary: '',
  notes: '',
  members: [],
  files: [],
  links: { video: '', github: '', drive: '' },
  subjectGroup: '',
  ...extra
});

export const createSeedSubmissions = () => ({
  // Theory: the computer group (index 4) is already submitted; other groups start blank
  'theory.g4': emptySubmission({
    status: 'submitted',
    subjectGroup: 'กลุ่มสาขาวิชาคอมพิวเตอร์',
    members: [
      advisor('m-adv-1', 'รศ.', 'สมชาย ใจดี', 'somchai.j@rtc.ac.th', D1),
      student('m-st-1', 'นางสาว', 'นิด สุวรรณี', '6401234567', D1, true),
      student('m-st-2', 'นาย', 'อาร์ม ธนพล', '6401234588', D1)
    ],
    submittedAt: '2026-09-05T10:15:00+07:00',
    hash: 'a13f92c7b0e4'
  }),

  // Practice: two groups — electrical submitted, mechanical still a draft
  'practice.g0': emptySubmission({
    status: 'submitted',
    subjectGroup: 'กลุ่มสาขาวิชาไฟฟ้า',
    members: [
      advisor('m-adv-2', 'ดร.', 'อนงค์ ศรีสุข', 'anong.s@rtc.ac.th', D2),
      student('m-st-3', 'นางสาว', 'พลอย รัชนี', '6402210011', D2, true),
      student('m-st-4', 'นาย', 'กาย ณัฐพงษ์', '6402210027', D2)
    ],
    submittedAt: '2026-09-06T14:40:00+07:00',
    hash: 'e5d81ac2f930'
  }),
  'practice.g3': emptySubmission({
    status: 'draft',
    subjectGroup: 'กลุ่มสาขาวิชาเครื่องกล',
    members: [
      advisor('m-adv-6', 'ผศ.', 'ประเสริฐ มั่นคง', 'prasert.m@rtc.ac.th', D3),
      // Draft on purpose: this student has no photo yet
      student('m-st-12', 'นาย', 'ภูมิ ธนากร', '6502330017', D3, true, false)
    ],
    draftAt: '2026-10-02T15:30:00+07:00'
  }),

  hardware: emptySubmission({
    status: 'draft',
    members: [
      advisor('m-adv-3', 'ดร.', 'กิตติพงษ์ วงศ์ษา', 'kittipong.w@rtc.ac.th', D3),
      student('m-st-5', 'นาย', 'ตี๋ อนุวัฒน์', '6502110034', D3, true),
      student('m-st-6', 'นางสาว', 'กิ๊ฟ กันยารัตน์', '6502110051', D3)
    ],
    draftAt: '2026-09-28T09:00:00+07:00'
  }),
  software: emptySubmission({
    status: 'submitted',
    members: [
      advisor('m-adv-4', 'ผศ.', 'วิชัย ทองดี', 'wichai.t@rtc.ac.th', D1),
      student('m-st-7', 'นางสาว', 'ฟ้า นภัสสร', '6401330102', D1, true),
      student('m-st-8', 'นาย', 'โบ๊ท ศิรวิทย์', '6401330118', D1)
    ],
    submittedAt: '2026-09-07T11:20:00+07:00',
    hash: 'ff02b7c81a5e'
  }),
  research: emptySubmission({
    status: 'submitted',
    members: [
      advisor('m-adv-5', 'ศ.', 'สิรินทร์ ชัยพร', 'sirin.c@rtc.ac.th', D2),
      student('m-st-10', 'นางสาว', 'บี โชติกา', '6301120044', D2, true),
      student('m-st-11', 'นาย', 'น้ำ ภัทรพล', '6301120059', D2)
    ],
    submittedAt: '2026-09-02T16:00:00+07:00',
    hash: '0c9d4e2a8b71'
  }),
  clip: emptySubmission({
    status: 'draft',
    projectName: 'เรียนรู้ไฟฟ้าใน 60 วินาที',
    summary: 'คลิปวิดีโอสั้นอธิบายหลักการวงจรไฟฟ้าพื้นฐานด้วยแอนิเมชัน',
    links: { video: 'https://youtu.be/mock-clip-demo', github: '', drive: '' },
    draftAt: '2026-09-20T13:00:00+07:00'
  }),
  pitching: emptySubmission(),
  robot: emptySubmission({
    status: 'draft',
    draftAt: '2026-09-03T08:30:00+07:00'
  }),
  singing: emptySubmission(),
  dance: emptySubmission()
});
