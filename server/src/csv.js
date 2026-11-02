// Members CSV for the organisers: RFC 4180, UTF-8 with BOM (Excel reads Thai), CRLF line ends.
export const CSV_HEADERS = [
  'มหาวิทยาลัย', 'ประเภท', 'กลุ่มสาขาวิชา/ประเภทย่อย', 'สถานะ', 'บทบาท(อาจารย์/ผู้แข่งขัน)', 'หัวหน้าทีม',
  'คำนำหน้า', 'ชื่อ-นามสกุล', 'หน่วยงาน', 'รหัสนักศึกษา', 'ชั้นปี', 'อีเมล', 'เบอร์โทร', 'ลิงก์รูปถ่าย', 'ส่งเมื่อ', 'รหัสอ้างอิง'
];

const FIELDS = [
  'university', 'type', 'subType', 'status', 'role', 'leader',
  'title', 'fullName', 'dept', 'studentId', 'year', 'email', 'phone', 'photoUrl', 'submittedAt', 'hash'
];

// A cell that starts with = + - @ (or tab / CR) can run as a formula in Excel or Sheets:
// prefix it with ' so it is shown as text (OWASP CSV injection guidance).
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: flat member rows with the FIELDS keys (see collectMemberRows in admin.js)
// extra: optional [{ header, field }] columns appended after the standard ones
export function buildMembersCsv(rows, extra = []) {
  const headers = [...CSV_HEADERS, ...extra.map(c => c.header)];
  const fields = [...FIELDS, ...extra.map(c => c.field)];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(fields.map(f => csvCell(row[f])).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
