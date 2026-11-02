import { describe, it, expect } from 'vitest';
import { generateCsvTemplateContent } from '../data/csvTemplate';
import { parseCsvText, evaluateCsvRows } from './useCsvParser';

const template = generateCsvTemplateContent();

describe('members CSV template', () => {
  it('has only example rows, which are not imported', () => {
    const res = evaluateCsvRows(parseCsvText(template));
    expect(res.rows).toHaveLength(0);
    expect(res.headerError).toContain('แถวตัวอย่าง');
  });

  it('imports a row filled in below the examples, with Thai values', () => {
    const csv = template + 'นักศึกษา,นาย,ทดสอบ จริงใจ,คณะวิศวกรรมศาสตร์,6409999999,2,t@x.ac.th,081-222-3333,ใช่\r\n'
      + 'อาจารย์,ผศ.ดร.,สมหญิง สอนดี,คณะครุศาสตร์อุตสาหกรรม,,,s@x.ac.th,,\r\n';
    const { headerError, rows } = evaluateCsvRows(parseCsvText(csv));
    expect(headerError).toBe('');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 5, type: 'student', title: 'นาย', fullName: 'ทดสอบ จริงใจ', dept: 'คณะวิศวกรรมศาสตร์',
      studentId: '6409999999', year: '2', email: 't@x.ac.th', phone: '081-222-3333', isLeader: true, ok: true
    });
    expect(rows[1]).toMatchObject({ line: 6, type: 'advisor', title: 'ผศ.ดร.', isLeader: false, ok: true });
  });

  it('still reads the old English-header files', () => {
    const csv = 'type,full_name,student_id,email,phone,faculty_or_department,year,academic_title,is_leader\r\n'
      + 'student,เก่า แบบเดิม,6400000001,o@x.ac.th,,คณะวิศวกรรมศาสตร์,1,นาย,yes\r\n';
    const { rows } = evaluateCsvRows(parseCsvText(csv));
    expect(rows[0]).toMatchObject({ type: 'student', fullName: 'เก่า แบบเดิม', isLeader: true, ok: true });
  });
});
