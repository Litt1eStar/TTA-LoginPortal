export const createSeedSubmissions = () => ({
  theory: {
    status: 'submitted',
    projectName: 'Interactive Fractions Workshop',
    summary: 'ชุดสื่อการสอนเศษส่วนเชิงโต้ตอบสำหรับนักเรียนระดับประถมศึกษา เพื่อพัฒนาทักษะการคำนวณและความเข้าใจเชิงมโนทัศน์',
    notes: 'ผ่านการทดสอบกับกลุ่มตัวอย่าง 60 คน ผลสัมฤทธิ์ทางการเรียนเพิ่มขึ้นอย่างมีนัยสำคัญ',
    members: [
      { id: 'm-adv-1', type: 'advisor', title: 'รศ.', fullName: 'Somchai Jaidee', email: 'somchai.j@rtc.ac.th', phone: '081-234-5678', dept: 'คณะครุศาสตร์', source: 'manual' },
      { id: 'm-st-1', type: 'student', fullName: 'Nid Suwannee', studentId: '6401234567', email: 'nid.s@rtc.ac.th', phone: '089-111-2222', faculty: 'คณิตศาสตร์ศึกษา', year: '3', isLeader: true, source: 'manual' },
      { id: 'm-st-2', type: 'student', fullName: 'Arm Thanapon', studentId: '6401234588', email: 'arm.t@rtc.ac.th', phone: '', faculty: 'คณิตศาสตร์ศึกษา', year: '3', isLeader: false, source: 'manual' }
    ],
    files: [
      { id: 'f1', name: 'lesson-plan.pdf', size: 842000, ext: 'pdf', progress: 100, status: 'done' }
    ],
    links: { video: 'https://youtu.be/mock-fractions-demo', github: '', drive: '' },
    submittedAt: '2026-09-05T10:15:00+07:00',
    hash: 'a13f92c7b0e4'
  },
  practice: {
    status: 'submitted',
    projectName: 'Hands-On Circuit Lab',
    summary: 'ชุดฝึกปฏิบัติการวงจรอิเล็กทรอนิกส์พื้นฐานแบบจำลอง พร้อมระบบตรวจจับข้อผิดพลาดแบบเรียลไทม์',
    notes: '',
    members: [
      { id: 'm-adv-2', type: 'advisor', title: 'ดร.', fullName: 'Anong Srisuk', email: 'anong.s@rtc.ac.th', phone: '', dept: 'คณะครุศาสตร์อุตสาหกรรม', source: 'manual' },
      { id: 'm-st-3', type: 'student', fullName: 'Ploy Ratchanee', studentId: '6402210011', email: 'ploy.r@rtc.ac.th', phone: '', faculty: 'วิศวกรรมไฟฟ้าศึกษา', year: '4', isLeader: true, source: 'manual' },
      { id: 'm-st-4', type: 'student', fullName: 'Guy Nattapong', studentId: '6402210027', email: 'guy.n@rtc.ac.th', phone: '', faculty: 'วิศวกรรมไฟฟ้าศึกษา', year: '4', isLeader: false, source: 'manual' }
    ],
    files: [
      { id: 'f2', name: 'practical-demo.pdf', size: 1204000, ext: 'pdf', progress: 100, status: 'done' }
    ],
    links: { video: '', github: 'https://github.com/mock/circuit-lab-demo', drive: '' },
    submittedAt: '2026-09-06T14:40:00+07:00',
    hash: 'e5d81ac2f930'
  },
  hardware: {
    status: 'draft',
    projectName: 'Smart Attendance Sensor',
    summary: 'เซนเซอร์ RFID ต้นทุนต่ำ บันทึกการเข้าเรียนอัตโนมัติและแจ้งเตือนนักศึกษาที่มีแนวโน้มเรียนไม่ทัน',
    notes: 'อยู่ระหว่างปรับปรุงเอกสารคู่มือประกอบการติดตั้ง',
    members: [
      { id: 'm-adv-3', type: 'advisor', title: 'ดร.', fullName: 'Kittipong Wongsa', email: 'kittipong.w@rtc.ac.th', phone: '082-555-0192', dept: 'คณะครุศาสตร์อุตสาหกรรม', source: 'manual' },
      { id: 'm-st-5', type: 'student', fullName: 'Tee Anuwat', studentId: '6502110034', email: 'tee.a@rtc.ac.th', phone: '', faculty: 'วิศวกรรมคอมพิวเตอร์ศึกษา', year: '2', isLeader: true, source: 'manual' },
      { id: 'm-st-6', type: 'student', fullName: 'Gift Kanyarat', studentId: '6502110051', email: 'gift.k@rtc.ac.th', phone: '', faculty: 'วิศวกรรมคอมพิวเตอร์ศึกษา', year: '2', isLeader: false, source: 'manual' }
    ],
    files: [
      { id: 'f3', name: 'schematic-draft.pdf', size: 530000, ext: 'pdf', progress: 100, status: 'done' }
    ],
    links: { video: '', github: '', drive: '' },
    draftAt: '2026-09-28T09:00:00+07:00'
  },
  software: {
    status: 'submitted',
    projectName: 'Grade Tracker Mobile App',
    summary: 'แอปพลิเคชันมือถือสำหรับติดตามผลการเรียนและการวางแผนการลงทะเบียนเรียนรายบุคคล',
    notes: '',
    members: [
      { id: 'm-adv-4', type: 'advisor', title: 'ผศ.', fullName: 'Wichai Thongdee', email: 'wichai.t@rtc.ac.th', phone: '', dept: 'คณะวิทยาศาสตร์', source: 'manual' },
      { id: 'm-st-7', type: 'student', fullName: 'Fah Napassorn', studentId: '6401330102', email: 'fah.n@rtc.ac.th', phone: '', faculty: 'คอมพิวเตอร์ศึกษา', year: '3', isLeader: true, source: 'manual' },
      { id: 'm-st-8', type: 'student', fullName: 'Boat Sirawit', studentId: '6401330118', email: 'boat.s@rtc.ac.th', phone: '', faculty: 'คอมพิวเตอร์ศึกษา', year: '3', isLeader: false, source: 'manual' },
      { id: 'm-st-9', type: 'student', fullName: 'Kong Peerapat', studentId: '6401330125', email: 'kong.p@rtc.ac.th', phone: '', faculty: 'คอมพิวเตอร์ศึกษา', year: '3', isLeader: false, source: 'manual' }
    ],
    files: [
      { id: 'f4', name: 'source.zip', size: 5200000, ext: 'zip', progress: 100, status: 'done' },
      { id: 'f5', name: 'demo-deck.pptx', size: 3100000, ext: 'pptx', progress: 100, status: 'done' }
    ],
    links: { video: '', github: 'https://github.com/mock/grade-tracker', drive: '' },
    submittedAt: '2026-09-07T11:20:00+07:00',
    hash: 'ff02b7c81a5e'
  },
  research: {
    status: 'submitted',
    projectName: 'Impact of Gamification on Retention',
    summary: 'งานวิจัยศึกษาผลกระทบของการประยุกต์ใช้องค์ประกอบเกม (Gamification) ต่อความคงอยู่ขององค์ความรู้ในวิชาวิทยาศาสตร์',
    notes: '',
    members: [
      { id: 'm-adv-5', type: 'advisor', title: 'ศ.', fullName: 'Sirin Chaiyaporn', email: 'sirin.c@rtc.ac.th', phone: '', dept: 'คณะครุศาสตร์', source: 'manual' },
      { id: 'm-st-10', type: 'student', fullName: 'Bee Chotika', studentId: '6301120044', email: 'bee.c@rtc.ac.th', phone: '', faculty: 'จิตวิทยาการศึกษา', year: '4', isLeader: true, source: 'manual' },
      { id: 'm-st-11', type: 'student', fullName: 'Nam Pattarapon', studentId: '6301120059', email: 'nam.p@rtc.ac.th', phone: '', faculty: 'จิตวิทยาการศึกษา', year: '4', isLeader: false, source: 'manual' }
    ],
    files: [
      { id: 'f6', name: 'research-paper.pdf', size: 980000, ext: 'pdf', progress: 100, status: 'done' }
    ],
    links: { video: '', github: '', drive: 'https://drive.google.com/drive/folders/mock-research-data' },
    submittedAt: '2026-09-02T16:00:00+07:00',
    hash: '0c9d4e2a8b71'
  },
  clip: {
    status: 'not_started',
    projectName: '',
    summary: '',
    notes: '',
    members: [],
    files: [],
    links: { video: '', github: '', drive: '' }
  },
  pitching: {
    status: 'not_started',
    projectName: '',
    summary: '',
    notes: '',
    members: [],
    files: [],
    links: { video: '', github: '', drive: '' }
  },
  robot: {
    status: 'draft',
    projectName: 'Line-Tracking Robot v2',
    summary: 'หุ่นยนต์เดินตามเส้นเพื่อการเรียนรู้ด้านระบบอัตโนมัติเบื้องต้น',
    notes: 'กำลังจัดทำวิดีโอสาธิตการทำงาน',
    members: [],
    files: [],
    links: { video: '', github: '', drive: '' },
    draftAt: '2026-09-03T08:30:00+07:00'
  },
  singing: {
    status: 'not_started',
    projectName: '',
    summary: '',
    notes: '',
    members: [],
    files: [],
    links: { video: '', github: '', drive: '' }
  },
  dance: {
    status: 'not_started',
    projectName: '',
    summary: '',
    notes: '',
    members: [],
    files: [],
    links: { video: '', github: '', drive: '' }
  }
});
