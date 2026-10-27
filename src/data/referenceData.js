// Reference lists for the submission form.
// Sources: ข้อมูลให้เบ้น.xlsx (titles, universities) and placeholders for data still pending.
import { TRACKS, isGrouped, entryKey } from './tracks';

// คำนำหน้า (from the sheet)
export const TITLE_PREFIXES = [
  'นาย', 'นางสาว', 'ดร.', 'ผศ.', 'รศ.', 'ศ.', 'ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.',
  'ว่าที่ร้อยตรี', 'ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', 'ร้อยตรีหญิง'
];

// มหาวิทยาลัย (from the sheet)
export const UNIVERSITIES = [
  { short: 'สจล.', full: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' },
  { short: 'มจธ.', full: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' },
  { short: 'มจพ.', full: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' },
  { short: 'มทร.กรุงเทพ', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ' },
  { short: 'มทร.สุวรรณภูมิ', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ' },
  { short: 'มทร.พระนคร', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร' },
  { short: 'มทร.ธัญบุรี', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี' },
  { short: 'มทร.ล้านนา', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา' },
  { short: 'มทร.ศรีวิชัย', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย' },
  { short: 'มทร.อีสาน', full: 'มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน' }
];

// หน่วยงาน (Department) dropdown for every member — same 3 options for every university.
export const DEPARTMENTS = [
  'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
  'คณะครุศาสตร์อุตสาหกรรม',
  'คณะวิศวกรรมศาสตร์'
];

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
