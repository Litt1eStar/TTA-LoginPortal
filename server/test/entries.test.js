import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { TYPES, CULTURE_CATEGORY, getTrack } from '../../src/data/tracks.js';
import { isValidEntryKey, allEntryKeys, blankData, sanitizeData, listEntries, getEntryRow, rowToEntry } from '../src/entries.js';

let db;
beforeEach(() => {
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
});

describe('isValidEntryKey', () => {
  it.each([
    ['clip', true], ['hardware', true], ['theory.g0', true], ['theory.g4', true], ['practice.g3', true],
    ['theory.g5', false], ['practice.g4', false], ['theory', false], ['practice', false],
    ['clip.g0', false], ['__proto__', false], ['constructor', false], ['constructor.g0', false], ['theory.g01', false], ['nope', false], ['', false], [undefined, false]
  ])('%s -> %s', (key, ok) => {
    expect(isValidEntryKey(key)).toBe(ok);
  });
});

describe('allEntryKeys', () => {
  it('has 18 valid keys in TRACKS order', () => {
    const keys = allEntryKeys();
    expect(keys).toHaveLength(18);
    expect(keys.slice(0, 2)).toEqual(['theory.g0', 'theory.g1']);
    expect(keys).toContain('practice.g3');
    expect(keys.at(-1)).toBe('participants');
    expect(keys.every(isValidEntryKey)).toBe(true);
  });
});

describe('blankData', () => {
  it('sets the subject group for grouped keys and has no status', () => {
    const d = blankData('theory.g4');
    expect(d.subjectGroup).toBe('กลุ่มสาขาวิชาคอมพิวเตอร์');
    expect(d).not.toHaveProperty('status');
    expect(d.video).toBeNull();
    expect(d.links).toEqual({ video: '' });
    expect(blankData('clip').subjectGroup).toBe('');
  });
});

describe('sanitizeData', () => {
  it('drops unknown keys, rebuilds file refs and caps members', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, type: 'student', fullName: 'x'.repeat(500), dept: 'd', evil: 1,
      photo: { fileId: 7, name: 'p.jpg', size: 10, ext: 'jpg', mime: 'image/jpeg', dataUrl: 'javascript:alert(1)' }
    }));
    const d = sanitizeData('hardware', {
      projectName: '  ok  ', status: 'submitted', hash: 'x', universityId: 2, members,
      files: [{ fileId: 3, name: 'a.pdf', size: 5, ext: 'pdf', mime: 'application/pdf' }, { name: 'nofileid' }],
      links: { video: 'https://youtu.be/x', github: 'g' }, video: { driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' }
    });
    expect(d).not.toHaveProperty('status');
    expect(d).not.toHaveProperty('hash');
    expect(d).not.toHaveProperty('universityId');
    expect(d.projectName).toBe('ok');
    expect(d.members).toHaveLength(3); // hardware: max 3 competitors (0 advisors in input)
    expect(d.members[0]).not.toHaveProperty('evil');
    expect(d.members[0].fullName).toHaveLength(200);
    expect(d.members[0].photo.dataUrl).toBe('/api/files/7');
    expect(d.files).toEqual([{ id: 3, fileId: 3, name: 'a.pdf', size: 5, ext: 'pdf', mime: 'application/pdf', status: 'done', progress: 100, url: '/api/files/3' }]);
    expect(d.links).toEqual({ video: 'https://youtu.be/x' });
    expect(d.video).toBeNull(); // only clip keeps a video
    expect(sanitizeData('clip', { video: { driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' } }).video)
      .toEqual({ driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' });
  });

  it('forces the subject group from the key', () => {
    expect(sanitizeData('theory.g0', { subjectGroup: 'hack' }).subjectGroup).toBe('กลุ่มสาขาวิชาไฟฟ้า');
  });
});

describe('sanitizeData robustness', () => {
  it.each([[null], [[]], ['str'], [42]])('treats non-object data %j as {}', (bad) => {
    const d = sanitizeData('hardware', bad);
    expect(d.projectName).toBe('');
    expect(d.members).toEqual([]);
  });
  it.each([['str'], [[]], [42], [null]])('non-object video %j becomes null on clip', (v) => {
    expect(sanitizeData('clip', { video: v }).video).toBeNull();
  });
  it('slices raw members before mapping and caps advisors', () => {
    const adv = (i) => ({ id: 'a' + i, type: 'advisor', fullName: 'a' });
    const stu = (i) => ({ id: 's' + i, type: 'student', fullName: 's' });
    const d = sanitizeData('hardware', { members: [adv(1), adv(2), stu(1), stu(2)] });
    expect(d.members.map(m => m.id)).toEqual(['a1', 's1', 's2']);
    const many = [...Array(5000).fill(null), stu(1)];
    expect(sanitizeData('hardware', { members: many }).members).toEqual([]);
  });
});

describe('listEntries', () => {
  it('creates 18 blank entries on first call, once', () => {
    const entries = listEntries(db, 1);
    expect(Object.keys(entries)).toHaveLength(18);
    expect(entries.clip).toMatchObject({ status: 'not_started', version: 1, draftAt: null, submittedAt: null, hash: null, projectName: '' });
    listEntries(db, 1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n).toBe(18);
    expect(rowToEntry(getEntryRow(db, 1, 'theory.g2')).subjectGroup).toBe('กลุ่มสาขาวิชาโยธา');
  });
});

describe('participants track (P-5)', () => {
  it('allows up to 10 participants, drops advisors, and strips dept/studentId/contact', () => {
    expect(sanitizeData('participants', { members: [{ id: 'a1', type: 'advisor', fullName: 'อ.' }] }, 'kmutt').members).toEqual([]);
    const members = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, type: 'student', title: 'นาย', fullName: `คน ${i}`,
      dept: 'D', studentId: '640', year: '2', email: 'a@b.c', phone: '081', isLeader: true
    }));
    const d = sanitizeData('participants', { members }, 'kmutt');
    expect(d.members).toHaveLength(10);
    expect(d.members[0]).toMatchObject({
      id: 'p0', type: 'student', role: 'ผู้เข้าร่วม',
      dept: '', studentId: '', year: '', email: '', phone: '', isLeader: false
    });
  });
});

describe('tracks & member roles (P-3, P-4)', () => {
  it('moves clip to its own top-level type and keeps 2 sub-types under culture', () => {
    expect(getTrack('clip').category).toBeUndefined();
    const culture = TYPES.find(t => t.label === CULTURE_CATEGORY);
    expect(culture.tracks.map(t => t.id)).toEqual(['singing', 'dance']);
    expect(TYPES.some(t => t.id === 'clip')).toBe(true);
    expect(getTrack('dance').maxCompetitors).toBe(14);
  });

  it('enforces per-role maxima and rejects unknown roles in sanitizeData', () => {
    const stu = (id, role, extra = {}) => ({ id, type: 'student', fullName: id, role, ...extra });

    const theory = sanitizeData('theory.g0', {
      members: [
        stu('s1', 'ผู้สอนหลัก', { isLeader: true }),
        stu('s2', 'ผู้สอนหลัก'),
        stu('s3', 'ผู้ช่วยสอน'),
        stu('s4', 'ผู้ช่วยสอน')
      ]
    });
    expect(theory.members.map(m => [m.id, m.role, m.isLeader])).toEqual([
      ['s1', 'ผู้สอนหลัก', false],
      ['s3', 'ผู้ช่วยสอน', false]
    ]);

    const danceMembers = [
      ...Array.from({ length: 11 }, (_, i) => stu(`d${i}`, 'นักแสดง')),
      ...Array.from({ length: 4 }, (_, i) => stu(`b${i}`, 'Backstage')),
      stu('l1', 'ผู้ควบคุมไฟ'),
      stu('a1', 'ผู้ควบคุมเสียง')
    ];
    const dance = sanitizeData('dance', { members: danceMembers });
    expect(dance.members).toHaveLength(14);
    expect(dance.members.filter(m => m.role === 'นักแสดง')).toHaveLength(10);
    expect(dance.members.filter(m => m.role === 'Backstage')).toHaveLength(4);
    expect(dance.members.filter(m => m.role === 'ผู้ควบคุมไฟ')).toHaveLength(0);
    expect(dance.members.filter(m => m.role === 'ผู้ควบคุมเสียง')).toHaveLength(0);

    const danceCaps = sanitizeData('dance', {
      members: [
        stu('l1', 'ผู้ควบคุมไฟ'),
        stu('l2', 'ผู้ควบคุมไฟ'),
        stu('a1', 'ผู้ควบคุมเสียง'),
        stu('a2', 'ผู้ควบคุมเสียง'),
        ...Array.from({ length: 5 }, (_, i) => stu(`b${i}`, 'Backstage'))
      ]
    });
    expect(danceCaps.members).toHaveLength(4);
    expect(danceCaps.members.filter(m => m.role === 'ผู้ควบคุมไฟ')).toHaveLength(1);
    expect(danceCaps.members.filter(m => m.role === 'ผู้ควบคุมเสียง')).toHaveLength(1);
    expect(danceCaps.members.filter(m => m.role === 'Backstage')).toHaveLength(2);

    const bad = sanitizeData('singing', { members: [stu('x', 'บทบาทปลอม')] });
    expect(bad.members).toEqual([]);
  });

  it('defaults missing role on old saved student members when read', () => {
    listEntries(db, 1);
    db.prepare("UPDATE submissions SET data = ? WHERE university_id = 1 AND entry_key = 'theory.g0'")
      .run(JSON.stringify({ ...blankData('theory.g0'), members: [{ id: 's1', type: 'student', fullName: 'ก' }] }));
    db.prepare("UPDATE submissions SET data = ? WHERE university_id = 1 AND entry_key = 'singing'")
      .run(JSON.stringify({ ...blankData('singing'), members: [{ id: 's2', type: 'student', fullName: 'ข' }] }));
    expect(rowToEntry(getEntryRow(db, 1, 'theory.g0')).members[0].role).toBe('ผู้สอนหลัก');
    expect(rowToEntry(getEntryRow(db, 1, 'singing')).members[0].role).toBe('นักร้อง');
  });
});
