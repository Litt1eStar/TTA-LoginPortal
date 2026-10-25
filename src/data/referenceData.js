// Reference lists for the submission form.
// Sources: ข้อมูลให้เบ้น.xlsx (titles, universities) and placeholders for data still pending.

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

// Certificate download links per track id. Empty until certificates are ready.
// Example: { theory: 'https://.../theory-certificates.zip' }
export const CERTIFICATES = {};
