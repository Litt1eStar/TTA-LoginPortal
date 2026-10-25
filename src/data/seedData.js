// Demo submissions. Only the clip track uses projectName / summary / files / links;
// every track uses members (each with university + dept) and photo
// (plus subjectGroup for theory / practice).
const UNI = 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี';
const D1 = 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี';
const D2 = 'คณะครุศาสตร์อุตสาหกรรม';
const D3 = 'คณะวิศวกรรมศาสตร์';

const advisor = (id, title, fullName, email, dept) =>
  ({ id, type: 'advisor', title, fullName, email, phone: '', dept, university: UNI, source: 'manual' });

const student = (id, title, fullName, studentId, dept, isLeader = false) =>
  ({ id, type: 'student', title, fullName, studentId, email: '', phone: '', dept, university: UNI, year: '3', isLeader, source: 'manual' });

const empty = (extra = {}) => ({
  status: 'not_started',
  projectName: '',
  summary: '',
  notes: '',
  members: [],
  files: [],
  links: { video: '', github: '', drive: '' },
  subjectGroup: '',
  photo: null,
  ...extra
});

export const createSeedSubmissions = () => ({
  theory: empty({
    status: 'submitted',
    subjectGroup: 'คอมพิวเตอร์ / มัลติมีเดีย / ดิจิทัล / เทคโนโลยีและสื่อสารการศึกษา',
    members: [
      advisor('m-adv-1', 'รศ.', 'สมชาย ใจดี', 'somchai.j@rtc.ac.th', D1),
      student('m-st-1', 'นางสาว', 'นิด สุวรรณี', '6401234567', D1, true),
      student('m-st-2', 'นาย', 'อาร์ม ธนพล', '6401234588', D1)
    ],
    submittedAt: '2026-09-05T10:15:00+07:00',
    hash: 'a13f92c7b0e4'
  }),
  practice: empty({
    status: 'submitted',
    subjectGroup: 'ไฟฟ้า / อิเล็กทรอนิกส์ / โทรคมนาคม',
    members: [
      advisor('m-adv-2', 'ดร.', 'อนงค์ ศรีสุข', 'anong.s@rtc.ac.th', D2),
      student('m-st-3', 'นางสาว', 'พลอย รัชนี', '6402210011', D2, true),
      student('m-st-4', 'นาย', 'กาย ณัฐพงษ์', '6402210027', D2)
    ],
    submittedAt: '2026-09-06T14:40:00+07:00',
    hash: 'e5d81ac2f930'
  }),
  hardware: empty({
    status: 'draft',
    members: [
      advisor('m-adv-3', 'ดร.', 'กิตติพงษ์ วงศ์ษา', 'kittipong.w@rtc.ac.th', D3),
      student('m-st-5', 'นาย', 'ตี๋ อนุวัฒน์', '6502110034', D3, true),
      student('m-st-6', 'นางสาว', 'กิ๊ฟ กันยารัตน์', '6502110051', D3)
    ],
    draftAt: '2026-09-28T09:00:00+07:00'
  }),
  software: empty({
    status: 'submitted',
    members: [
      advisor('m-adv-4', 'ผศ.', 'วิชัย ทองดี', 'wichai.t@rtc.ac.th', D1),
      student('m-st-7', 'นางสาว', 'ฟ้า นภัสสร', '6401330102', D1, true),
      student('m-st-8', 'นาย', 'โบ๊ท ศิรวิทย์', '6401330118', D1)
    ],
    submittedAt: '2026-09-07T11:20:00+07:00',
    hash: 'ff02b7c81a5e'
  }),
  research: empty({
    status: 'submitted',
    members: [
      advisor('m-adv-5', 'ศ.', 'สิรินทร์ ชัยพร', 'sirin.c@rtc.ac.th', D2),
      student('m-st-10', 'นางสาว', 'บี โชติกา', '6301120044', D2, true),
      student('m-st-11', 'นาย', 'น้ำ ภัทรพล', '6301120059', D2)
    ],
    submittedAt: '2026-09-02T16:00:00+07:00',
    hash: '0c9d4e2a8b71'
  }),
  clip: empty({
    status: 'draft',
    projectName: 'เรียนรู้ไฟฟ้าใน 60 วินาที',
    summary: 'คลิปวิดีโอสั้นอธิบายหลักการวงจรไฟฟ้าพื้นฐานด้วยแอนิเมชัน',
    links: { video: 'https://youtu.be/mock-clip-demo', github: '', drive: '' },
    draftAt: '2026-09-20T13:00:00+07:00'
  }),
  pitching: empty(),
  robot: empty({
    status: 'draft',
    draftAt: '2026-09-03T08:30:00+07:00'
  }),
  singing: empty(),
  dance: empty()
});
