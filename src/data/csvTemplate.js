// Excel template served from public/templates; the template button downloads it under the Thai name
export const XLSX_TEMPLATE_URL = '/templates/tta-team-template.xlsx';
export const XLSX_TEMPLATE_NAME = 'TTA 2027 – แม่แบบรายชื่อสมาชิกทีม.xlsx';

// Members CSV template. Photos are not in the CSV: coordinators upload them per member afterwards.
// Header names must keep matching evaluateCsvRows in hooks/useCsvParser.js.
export const CSV_TEMPLATE_HEADERS = [
  'ประเภท (อาจารย์/นักศึกษา)',
  'คำนำหน้า',
  'ชื่อ-นามสกุล',
  'หน่วยงาน (คณะ)',
  'รหัสนักศึกษา',
  'ชั้นปี',
  'อีเมล',
  'เบอร์โทร',
  'หัวหน้าทีม (ใส่ ใช่)'
];

// Rows whose name starts with "ตัวอย่าง" are skipped on import, so the file can be filled in as is.
// หน่วยงาน must be one of DEPARTMENTS, คำนำหน้า one of TITLE_PREFIXES (data/referenceData.js).
export const CSV_TEMPLATE_SAMPLE_ROWS = [
  ['อาจารย์', 'รศ.ดร.', 'ตัวอย่าง สมชาย ใจดี', 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี', '', '', 'somchai.j@university.ac.th', '081-234-5678', ''],
  ['นักศึกษา', 'นางสาว', 'ตัวอย่าง นิด สุวรรณี', 'คณะครุศาสตร์อุตสาหกรรม', '6401234567', '3', 'nid.s@university.ac.th', '089-111-2222', 'ใช่'],
  ['นักศึกษา', 'นาย', 'ตัวอย่าง อาร์ม ธนพล', 'คณะวิศวกรรมศาสตร์', '6401234588', '3', '', '', '']
];

const cell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const generateCsvTemplateContent = () => {
  const lines = [CSV_TEMPLATE_HEADERS, ...CSV_TEMPLATE_SAMPLE_ROWS].map(row => row.map(cell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
};
