import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { listEntries, saveDraft, submitEntry, assertBeforeDeadline, getEntryRow } from '../src/entries.js';

let db;
beforeEach(() => {
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id) VALUES (1, 'kmutt', 'h', 'k', 1)").run();
  listEntries(db, 1);
});

const addFile = (id, key) => db.prepare(
  "INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (?, 1, ?, 0, 'x', 1, 'image/jpeg', 'p.jpg', 1, 0)"
).run(id, key);

const photo = (fileId) => ({ fileId, name: 'p.jpg', size: 1, ext: 'jpg', mime: 'image/jpeg' });
const completeHardware = () => ({
  members: [
    { id: 'a', type: 'advisor', fullName: 'อาจารย์', dept: 'D', photo: photo(1) },
    { id: 's', type: 'student', fullName: 'นักศึกษา', dept: 'D', isLeader: true, photo: photo(2) }
  ]
});

const code = (fn) => { try { fn(); } catch (e) { return e; } throw new Error('expected throw'); };

describe('saveDraft', () => {
  it('saves, sets draft and bumps the version', () => {
    const e = saveDraft(db, 1, 'hardware', { projectName: 'x' }, 1);
    expect(e).toMatchObject({ status: 'draft', version: 2, projectName: 'x' });
    expect(e.draftAt).toMatch(/^\d{4}-/);
  });

  it('throws version_conflict with the current entry', () => {
    saveDraft(db, 1, 'hardware', { projectName: 'first' }, 1);
    const err = code(() => saveDraft(db, 1, 'hardware', { projectName: 'stale' }, 1));
    expect(err.code).toBe('version_conflict');
    expect(err.statusCode).toBe(409);
    expect(err.extra.entry).toMatchObject({ projectName: 'first', version: 2 });
  });
});

describe('submitEntry', () => {
  it('fails with the incomplete list', () => {
    const err = code(() => submitEntry(db, 1, 'hardware'));
    expect(err.statusCode).toBe(422);
    expect(err.extra.failed.map(f => f.key)).toEqual(expect.arrayContaining(['advisors', 'team', 'photos']));
    expect(err.extra.failed[0]).toHaveProperty('label');
    expect(err.extra.failed[0]).toHaveProperty('error');
  });

  it('fails when a photo file is not in the files table', () => {
    addFile(1, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    const err = code(() => submitEntry(db, 1, 'hardware'));
    expect(err.statusCode).toBe(422);
    expect(err.extra.failed).toEqual([{ key: 'files', label: 'ไฟล์แนบไม่ถูกต้อง', error: 'ไฟล์แนบไม่ถูกต้อง' }]);
  });

  it('submits a complete entry, then locks it', () => {
    addFile(1, 'hardware');
    addFile(2, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    const e = submitEntry(db, 1, 'hardware');
    expect(e.status).toBe('submitted');
    expect(e.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(e.submittedAt).toMatch(/^\d{4}-/);
    expect(code(() => saveDraft(db, 1, 'hardware', {}, e.version)).statusCode).toBe(423);
    expect(code(() => submitEntry(db, 1, 'hardware')).statusCode).toBe(423);
    expect(getEntryRow(db, 1, 'hardware').status).toBe(2);
  });
});

describe('hardening', () => {
  it('submitting twice gives 423 on the second call', () => {
    addFile(1, 'hardware'); addFile(2, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    submitEntry(db, 1, 'hardware');
    expect(code(() => submitEntry(db, 1, 'hardware')).statusCode).toBe(423);
  });
  it('stale save on a submitted entry gives 423 not 409', () => {
    addFile(1, 'hardware'); addFile(2, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    submitEntry(db, 1, 'hardware');
    expect(code(() => saveDraft(db, 1, 'hardware', {}, 1)).statusCode).toBe(423);
  });
  it('missing files[] reference gives 422 with key files', () => {
    addFile(1, 'hardware'); addFile(2, 'hardware');
    saveDraft(db, 1, 'hardware', { ...completeHardware(), files: [{ fileId: 99, name: 'a.pdf', size: 1, ext: 'pdf', mime: 'application/pdf' }] }, 1);
    const err = code(() => submitEntry(db, 1, 'hardware'));
    expect(err.statusCode).toBe(422);
    expect(err.extra.failed.map(f => f.key)).toEqual(['files']);
  });
  it('photo ref must be kind 0 and files ref kind 1', () => {
    addFile(1, 'hardware');
    db.prepare("INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (2, 1, 'hardware', 1, 'x', 1, 'application/pdf', 'a.pdf', 1, 0)").run();
    saveDraft(db, 1, 'hardware', completeHardware(), 1); // photo 2 is kind 1
    expect(code(() => submitEntry(db, 1, 'hardware')).extra.failed[0].key).toBe('files');
    addFile(3, 'hardware'); // kind 0 used as work file
    saveDraft(db, 1, 'hardware', { members: [
      { id: 'a', type: 'advisor', fullName: 'x', dept: 'D', photo: photo(1) },
      { id: 's', type: 'student', fullName: 'y', dept: 'D', isLeader: true, photo: photo(1) }],
      files: [{ fileId: 3, name: 'a.pdf', size: 1, ext: 'pdf', mime: 'application/pdf' }] }, 2);
    expect(code(() => submitEntry(db, 1, 'hardware')).extra.failed[0].key).toBe('files');
  });
});

describe('assertBeforeDeadline', () => {
  it('throws deadline_passed after the deadline', () => {
    expect(() => assertBeforeDeadline({ deadline: '2999-01-01T00:00:00Z' })).not.toThrow();
    const err = code(() => assertBeforeDeadline({ deadline: '2000-01-01T00:00:00Z' }));
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('deadline_passed');
  });

  it('fails closed on an unparseable deadline', () => {
    expect(code(() => assertBeforeDeadline({ deadline: 'garbage' })).code).toBe('deadline_passed');
    expect(code(() => assertBeforeDeadline({})).statusCode).toBe(403);
  });
});
