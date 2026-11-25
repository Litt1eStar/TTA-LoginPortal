import { describe, it, expect } from 'vitest';
import { buildMembersCsv, buildCertificatesCsv, csvCell, CSV_HEADERS, CERT_CSV_HEADERS } from '../src/csv.js';

describe('csvCell', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=1+2')).toBe("'=1+2");
    expect(csvCell('+66812345678')).toBe("'+66812345678");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe('buildMembersCsv', () => {
  it('starts with a BOM and the Thai header, CRLF line ends, one line per row', () => {
    const csv = buildMembersCsv([
      { university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', type: 'สอนทฤษฎี', subType: 'กลุ่มสาขาวิชาไฟฟ้า', status: 'ส่งแล้ว', role: 'อาจารย์', leader: '', title: 'ดร.', fullName: 'สมชาย ใจดี', dept: 'ไฟฟ้า', studentId: '', year: '', email: 'a@x.th', phone: '0812345678', photoUrl: '', submittedAt: '2026-11-04 10:15:00', hash: 'abcdefabcdef' }
    ]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    expect(lines[1]).toContain('สมชาย ใจดี');
    expect(lines.length).toBe(3); // header, 1 row, trailing empty string
  });
  it('has the 16 agreed headers', () => {
    expect(CSV_HEADERS).toEqual([
      'มหาวิทยาลัย', 'ประเภท', 'กลุ่มสาขาวิชา/ประเภทย่อย', 'สถานะ', 'บทบาท(อาจารย์/ผู้แข่งขัน)', 'หัวหน้าทีม',
      'คำนำหน้า', 'ชื่อ-นามสกุล', 'หน่วยงาน', 'รหัสนักศึกษา', 'ชั้นปี', 'อีเมล', 'เบอร์โทร', 'ลิงก์รูปถ่าย', 'ส่งเมื่อ', 'รหัสอ้างอิง'
    ]);
  });
});

describe('buildCertificatesCsv', () => {
  it('writes BOM, certificate headers, sequential index and concatenated names', () => {
    const csv = buildCertificatesCsv([
      {
        certName: 'นายสมชาย ใจดี',
        title: 'นาย',
        fullName: 'สมชาย ใจดี',
        recipientGroup: 'ผู้แข่งขัน',
        role: 'ผู้สอนหลัก',
        certCompetition: 'สอนทฤษฎี (กลุ่มสาขาวิชาไฟฟ้า)',
        type: 'สอนทฤษฎี',
        subType: 'กลุ่มสาขาวิชาไฟฟ้า',
        university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี',
        dept: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
        studentId: '6401234567',
        year: '3',
        email: 's@kmutt.ac.th',
        phone: '0899999999',
        drivePhotoUrl: 'https://drive.google.com/file/d/1AbCdEf/view',
        status: 'ส่งแล้ว',
        submittedAt: '2026-11-04 10:15:00',
        hash: 'abcdefabcdef'
      }
    ]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const lines = csv.slice(1).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(CERT_CSV_HEADERS.join(','));
    expect(lines[1].startsWith('1,นายสมชาย ใจดี,นาย,สมชาย ใจดี,ผู้แข่งขัน,ผู้สอนหลัก,สอนทฤษฎี (กลุ่มสาขาวิชาไฟฟ้า),')).toBe(true);
    expect(lines[1]).toContain(',https://drive.google.com/file/d/1AbCdEf/view,ส่งแล้ว,2026-11-04 10:15:00,abcdefabcdef');
  });
});
