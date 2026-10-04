import { generateId } from '../utils/formatters';

export const parseCsvText = (text) => {
  if (!text) return [];
  // Strip BOM
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (insideQuote && next === '"') {
        cur += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (c === ',' && !insideQuote) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !insideQuote) {
      if (c === '\r' && next === '\n') i++;
      row.push(cur.trim());
      if (row.some(cell => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(cell => cell.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
};

export const normalizeMemberType = (raw) => {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'advisor' || s.includes('อาจารย์') || s.includes('ที่ปรึกษา')) return 'advisor';
  if (s === 'student' || s.includes('นักศึกษา') || s.includes('นิสิต')) return 'student';
  return '';
};

export const evaluateCsvRows = (parsedRows, existingMembers = []) => {
  if (!parsedRows || parsedRows.length < 2) {
    return { headerError: 'ไฟล์ CSV ไม่มีข้อมูลหรือหัวตาราง', rows: [] };
  }

  const rawHeaders = parsedRows[0].map(h => h.toLowerCase().trim());
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    if (h.includes('type') || h.includes('ประเภท')) headerMap.type = idx;
    else if (h.includes('full_name') || h.includes('name') || h.includes('ชื่อ')) headerMap.fullName = idx;
    else if (h.includes('student_id') || h.includes('รหัส')) headerMap.studentId = idx;
    else if (h.includes('email') || h.includes('อีเมล')) headerMap.email = idx;
    else if (h.includes('phone') || h.includes('โทร')) headerMap.phone = idx;
    else if (h.includes('faculty') || h.includes('dept') || h.includes('คณะ') || h.includes('สาขา')) headerMap.deptOrFaculty = idx;
    else if (h.includes('year') || h.includes('ชั้นปี') || h.includes('ปี')) headerMap.year = idx;
    else if (h.includes('title') || h.includes('คำนำหน้า')) headerMap.title = idx;
    else if (h.includes('leader') || h.includes('หัวหน้า')) headerMap.isLeader = idx;
  });

  if (headerMap.fullName === undefined || headerMap.email === undefined) {
    return {
      headerError: 'หัวตารางต้องมีคอลัมน์ full_name (ชื่อ) และ email (อีเมล)',
      rows: []
    };
  }

  const seenEmails = new Set();
  const existingEmails = new Set(existingMembers.map(m => m.email.toLowerCase()));

  const evaluated = parsedRows.slice(1).map((r, i) => {
    const getVal = (col) => (col !== undefined && r[col] ? String(r[col]).trim() : '');
    const typeRaw = getVal(headerMap.type);
    const type = normalizeMemberType(typeRaw) || (getVal(headerMap.studentId) ? 'student' : 'advisor');
    const fullName = getVal(headerMap.fullName);
    const studentId = getVal(headerMap.studentId);
    const email = getVal(headerMap.email);
    const phone = getVal(headerMap.phone);
    const deptOrFaculty = getVal(headerMap.deptOrFaculty);
    const year = getVal(headerMap.year);
    const title = getVal(headerMap.title) || (type === 'advisor' ? 'ดร.' : '');
    const leaderRaw = getVal(headerMap.isLeader).toLowerCase();
    const isLeader = ['yes', 'y', 'true', '1', 'หัวหน้า', 'หัวหน้าทีม'].includes(leaderRaw);

    const errors = [];
    if (!fullName) errors.push('ขาดชื่อ-นามสกุล');
    if (!email) errors.push('ขาดอีเมล');
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('รูปแบบอีเมลไม่ถูกต้อง');
    else if (seenEmails.has(email.toLowerCase())) errors.push('อีเมลซ้ำในไฟล์');
    else seenEmails.add(email.toLowerCase());

    if (type === 'student' && !studentId) errors.push('ขาดรหัสนักศึกษา');

    const ok = errors.length === 0;

    return {
      line: i + 2,
      id: generateId('csv'),
      type,
      title,
      fullName,
      studentId,
      email,
      phone,
      faculty: type === 'student' ? deptOrFaculty : '',
      dept: type === 'advisor' ? deptOrFaculty : '',
      year,
      isLeader,
      source: 'csv',
      ok,
      error: errors.join(', ')
    };
  });

  return { headerError: '', rows: evaluated };
};
