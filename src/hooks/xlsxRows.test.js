import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { read, write, utils } from 'xlsx';
import { parseXlsxBuffer } from './xlsxRows';
import { evaluateCsvRows } from './useCsvParser';

const TEMPLATE = 'public/templates/tta-team-template.xlsx';

// Fill the real template the way a coordinator would, then read it back as the import does
function filledTemplate(rows) {
  const wb = read(fs.readFileSync(TEMPLATE), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  utils.sheet_add_aoa(ws, rows, { origin: 'A2' });
  return write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('Excel import', () => {
  it('the shipped template has the headers the import expects', () => {
    const [header] = parseXlsxBuffer(fs.readFileSync(TEMPLATE));
    const res = evaluateCsvRows([header, ['นักศึกษา', 'นาย', 'ก ข', 'คณะวิศวกรรมศาสตร์', '1', '1', '', '', '']]);
    expect(res.headerError).toBe('');
    expect(res.rows[0]).toMatchObject({ type: 'student', title: 'นาย', dept: 'คณะวิศวกรรมศาสตร์', studentId: '1', year: '1' });
  });

  it('imports filled rows and keeps the phone leading zero', () => {
    const buf = filledTemplate([
      ['อาจารย์', 'ผศ.ดร.', 'สมหญิง สอนดี', 'คณะครุศาสตร์อุตสาหกรรม', '', '', 's@x.ac.th', '0812345678', ''],
      ['นักศึกษา', 'นาย', 'ทดสอบ จริงใจ', 'คณะวิศวกรรมศาสตร์', 6409999999, 2, 't@x.ac.th', '089-111-2222', 'ใช่']
    ]);
    const { headerError, rows } = evaluateCsvRows(parseXlsxBuffer(buf));
    expect(headerError).toBe('');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: 'advisor', title: 'ผศ.ดร.', phone: '0812345678', ok: true });
    expect(rows[1]).toMatchObject({ type: 'student', studentId: '6409999999', year: '2', isLeader: true, ok: true });
  });
});
