import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
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
    ['clip.g0', false], ['theory.g01', false], ['nope', false], ['', false], [undefined, false]
  ])('%s -> %s', (key, ok) => {
    expect(isValidEntryKey(key)).toBe(ok);
  });
});

describe('allEntryKeys', () => {
  it('has 17 valid keys in TRACKS order', () => {
    const keys = allEntryKeys();
    expect(keys).toHaveLength(17);
    expect(keys.slice(0, 2)).toEqual(['theory.g0', 'theory.g1']);
    expect(keys).toContain('practice.g3');
    expect(keys.at(-1)).toBe('pitching');
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
    expect(d.members).toHaveLength(4); // hardware: 3 competitors + 1 advisor
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

describe('listEntries', () => {
  it('creates 17 blank entries on first call, once', () => {
    const entries = listEntries(db, 1);
    expect(Object.keys(entries)).toHaveLength(17);
    expect(entries.clip).toMatchObject({ status: 'not_started', version: 1, draftAt: null, submittedAt: null, hash: null, projectName: '' });
    listEntries(db, 1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n).toBe(17);
    expect(rowToEntry(getEntryRow(db, 1, 'theory.g2')).subjectGroup).toBe('กลุ่มสาขาวิชาโยธา');
  });
});
