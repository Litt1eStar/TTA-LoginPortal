import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { connectDrive, GOOGLE_ENV } from './fakeGoogle.js';

const asKmutt = async (overrides) => {
  const t = await makeTestApp(overrides);
  return { ...t, cookie: await loginAs(t.app, 'kmutt', 'pass-kmutt-1') };
};
const req = (app, cookie, method, url, payload) => app.inject({ method, url, headers: { cookie }, payload });

const addFile = (db, id, uni, key) => db.prepare(
  "INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (?, ?, ?, 0, 'x', 1, 'image/jpeg', 'p.jpg', 1, 0)"
).run(id, uni, key);
const photo = (fileId) => ({ fileId, name: 'p.jpg', size: 1, ext: 'jpg', mime: 'image/jpeg' });
const completeHardware = {
  members: [
    { id: 'a', type: 'advisor', fullName: 'อาจารย์', dept: 'D', photo: photo(1) },
    { id: 's1', type: 'student', fullName: 'นักศึกษา 1', dept: 'D', photo: photo(2) },
    { id: 's2', type: 'student', fullName: 'นักศึกษา 2', dept: 'D', photo: photo(2) },
    { id: 's3', type: 'student', fullName: 'นักศึกษา 3', dept: 'D', photo: photo(2) }
  ]
};

describe('GET /api/submissions', () => {
  it('returns 18 entries for a coordinator', async () => {
    const { app, cookie } = await asKmutt();
    const res = await req(app, cookie, 'GET', '/api/submissions');
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().submissions)).toHaveLength(18);
  });

  it('403 for an admin', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const res = await req(app, cookie, 'GET', '/api/submissions');
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('forbidden');
  });

  it('401 without a session', async () => {
    const { app } = await makeTestApp();
    expect((await app.inject({ method: 'GET', url: '/api/submissions' })).statusCode).toBe(401);
  });
});

describe('PUT /api/submissions/:key', () => {
  it('saves and bumps the version', async () => {
    const { app, cookie } = await asKmutt();
    const res = await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: { notes: 'hi' }, version: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json().entry).toMatchObject({ status: 'draft', notes: 'hi', version: 2 });
  });

  it('409 with the current entry on a stale version', async () => {
    const { app, cookie } = await asKmutt();
    await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: { notes: 'first' }, version: 1 });
    const res = await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: { notes: 'stale' }, version: 1 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'version_conflict', entry: { notes: 'first', version: 2 } });
  });

  it('400 for an unknown or old key', async () => {
    const { app, cookie } = await asKmutt();
    for (const key of ['theory', 'theory.g5', 'practice.g4', 'nope']) {
      const res = await req(app, cookie, 'PUT', `/api/submissions/${key}`, { data: {}, version: 1 });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('bad_request');
    }
  });

  it('400 for a bad body', async () => {
    const { app, cookie } = await asKmutt();
    const res = await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: {}, version: 'x' });
    expect(res.statusCode).toBe(400);
  });

  it('university A cannot read or write B (university always comes from the session)', async () => {
    const { app, db, cookie } = await asKmutt();
    const other = await loginAs(app, 'rmutt', 'pass-rmutt-1');
    await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: { notes: 'kmutt only', universityId: 2 }, version: 1 });
    const theirs = await req(app, other, 'GET', '/api/submissions');
    expect(theirs.json().submissions.hardware).toMatchObject({ notes: '', version: 1, status: 'not_started' });
    await req(app, other, 'PUT', '/api/submissions/hardware?universityId=1', { data: { notes: 'rmutt' }, version: 1 });
    const rows = db.prepare("SELECT university_id, data FROM submissions WHERE entry_key = 'hardware' ORDER BY university_id").all();
    expect(JSON.parse(rows[0].data).notes).toBe('kmutt only');
    expect(JSON.parse(rows[1].data).notes).toBe('rmutt');
  });

  it('does not block PUT /api/submissions/:key when Google Drive photo sync stalls', async () => {
    let releaseDrive;
    const stalledDrive = new Promise(resolve => { releaseDrive = resolve; });
    const t = await makeTestApp(GOOGLE_ENV, {
      googleFetch: async () => {
        await stalledDrive;
        throw new Error('drive timeout');
      }
    });
    try {
      connectDrive(t.db, t.config);
      const cookie = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
      await req(t.app, cookie, 'GET', '/api/submissions');
      addFile(t.db, 1, 1, 'hardware');
      fs.mkdirSync(t.config.uploadDir, { recursive: true });
      fs.writeFileSync(path.resolve(t.config.uploadDir, 'x'), 'jpg-bytes');
      let finished = false;
      const putPromise = req(t.app, cookie, 'PUT', '/api/submissions/hardware', {
        data: { members: [{ id: 's1', type: 'student', fullName: 'สมชาย', photo: photo(1) }] },
        version: 1
      }).then(res => { finished = true; return res; });

      await new Promise(r => setTimeout(r, 50));
      expect(finished).toBe(true);
      const res = await putPromise;
      expect(res.statusCode).toBe(200);
    } finally {
      releaseDrive();
      await t.app.close();
    }
  });
});

describe('POST /api/submissions/:key/submit', () => {
  it('422 with the failed list when incomplete', async () => {
    const { app, cookie } = await asKmutt();
    const res = await req(app, cookie, 'POST', '/api/submissions/hardware/submit');
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('incomplete');
    expect(res.json().failed.length).toBeGreaterThan(0);
  });

  it('submits a complete entry with a hash, then save is 423', async () => {
    const { app, db, cookie } = await asKmutt();
    await req(app, cookie, 'GET', '/api/submissions');
    addFile(db, 1, 1, 'hardware');
    addFile(db, 2, 1, 'hardware');
    await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: completeHardware, version: 1 });
    const res = await req(app, cookie, 'POST', '/api/submissions/hardware/submit');
    expect(res.statusCode).toBe(200);
    expect(res.json().entry.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(res.json().entry.status).toBe('submitted');
    const save = await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: {}, version: res.json().entry.version });
    expect(save.statusCode).toBe(423);
    expect(save.json().error).toBe('locked');
  });
});

describe('deadline', () => {
  it('403 deadline_passed on save and submit', async () => {
    const { app, cookie } = await asKmutt({ DEADLINE: '2000-01-01T00:00:00Z' });
    const save = await req(app, cookie, 'PUT', '/api/submissions/hardware', { data: {}, version: 1 });
    expect(save.statusCode).toBe(403);
    expect(save.json().error).toBe('deadline_passed');
    const submit = await req(app, cookie, 'POST', '/api/submissions/hardware/submit');
    expect(submit.statusCode).toBe(403);
    expect(submit.json().error).toBe('deadline_passed');
    expect((await req(app, cookie, 'GET', '/api/submissions')).statusCode).toBe(200);
  });
});
