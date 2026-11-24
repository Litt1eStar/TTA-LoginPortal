// Reference lists for the submission form.
// Sources: ข้อมูลให้เบ้น.xlsx (titles, universities) and placeholders for data still pending.
import { TRACKS, isGrouped, entryKey } from './tracks.js';

// คำนำหน้า (from the sheet)
export const TITLE_PREFIXES = [
  'นาย', 'นางสาว', 'ดร.', 'ผศ.', 'รศ.', 'ศ.', 'ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.',
  'ว่าที่ร้อยตรี', 'ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', 'ร้อยตรีหญิง'
];

// มหาวิทยาลัย (from the sheet)
export const UNIVERSITIES = [
  { code: 'kmitl', short: 'สจล.', full: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' },
  { code: 'kmutt', short: 'มจธ.', full: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' },
  { code: 'kmutnb', short: 'มจพ.', full: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' },
  { code: 'rmutk', short: 'มทร.กรุงเทพ', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ' },
  { code: 'rmutsb', short: 'มทร.สุวรรณภูมิ', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ' },
  { code: 'rmutp', short: 'มทร.พระนคร', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร' },
  { code: 'rmutt', short: 'มทร.ธัญบุรี', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี' },
  { code: 'rmutl', short: 'มทร.ล้านนา', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา' },
  { code: 'rmutsv', short: 'มทร.ศรีวิชัย', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย' },
  { code: 'rmuti', short: 'มทร.อีสาน', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน' }
];

// หน่วยงาน (Department) options and per-university lock mapping
export const DEPARTMENTS = [
  'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
  'คณะครุศาสตร์อุตสาหกรรม',
  'คณะวิศวกรรมศาสตร์'
];

export const DEPT_BY_UNIVERSITY = {
  rmutl: 'คณะวิศวกรรมศาสตร์',
  kmutnb: 'คณะครุศาสตร์อุตสาหกรรม',
  rmutt: 'คณะครุศาสตร์อุตสาหกรรม',
  rmutp: 'คณะครุศาสตร์อุตสาหกรรม',
  rmutk: 'คณะครุศาสตร์อุตสาหกรรม',
  rmutsb: 'คณะครุศาสตร์อุตสาหกรรม',
  rmuti: 'คณะครุศาสตร์อุตสาหกรรม',
  kmitl: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
  kmutt: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
  rmutsv: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี'
};

export const departmentForUniversity = (codeOrName) => {
  if (!codeOrName) return '';
  const key = String(codeOrName).trim().toLowerCase();
  if (DEPT_BY_UNIVERSITY[key]) return DEPT_BY_UNIVERSITY[key];
  const uni = UNIVERSITIES.find(u => u.code === key || u.short === codeOrName || u.full === codeOrName);
  return uni ? (DEPT_BY_UNIVERSITY[uni.code] || '') : '';
};

// TODO (FEEDBACK #7): placeholder photo rules until the team confirms size / format.
export const PHOTO_RULES = {
  exts: ['jpg', 'jpeg', 'png'],
  maxMB: 5
};

// Certificate download links, keyed by the item keys in CERTIFICATE_SECTIONS.
// Empty until certificates are ready.
// Example: { 'theory.g0': 'https://.../theory-electrical.zip', singing: 'https://...' }
export const CERTIFICATES = {};

// Certificate topics, built from TRACKS so they always match the form's categories:
// - theory / practice: one section each, one item per กลุ่มสาขาวิชา (key = entryKey, e.g. 'theory.g0')
// - tracks sharing a `category` (การแข่งขันศิลปวัฒนธรรม): one section
// - everything else: one untitled section
export const CERTIFICATE_SECTIONS = (() => {
  const sections = [];
  const byTitle = {};
  const others = { title: null, items: [] };
  TRACKS.forEach(t => {
    if (isGrouped(t)) {
      sections.push({ title: t.full, items: t.subjectGroups.map((g, i) => ({ key: entryKey(t.id, i), label: g })) });
    } else if (t.category) {
      if (!byTitle[t.category]) {
        byTitle[t.category] = { title: t.category, items: [] };
        sections.push(byTitle[t.category]);
      }
      byTitle[t.category].items.push({ key: t.id, label: t.full });
    } else {
      others.items.push({ key: t.id, label: t.full });
    }
  });
  return others.items.length ? [...sections, others] : sections;
})();
