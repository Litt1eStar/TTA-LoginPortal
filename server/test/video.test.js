import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV } from './fakeGoogle.js';
import { getSetting } from '../src/settings.js';
import { ROOT_FOLDER_NAME } from '../src/drive.js';

const MB = 1024 * 1024;
let t, google, kmutt;
beforeEach(async () => {
  google = fakeGoogle();
  t = await makeTestApp(GOOGLE_ENV, { googleFetch: google.fetch });
  kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
});
afterEach(() => t.app.close());

const post = (url, body, cookie = kmutt) =>
  t.app.inject({ method: 'POST', url: `/api/submissions/clip/video${url}`, payload: body, headers: { cookie } });
const session = (body = { name: 'clip.mp4', size: 10 * MB, mime: 'video/mp4' }, cookie) => post('', body, cookie);

async function kmuttFolder() {
  await session();
  return getSetting(t.db, 'drive.folder.kmutt');
}

describe('POST /api/submissions/clip/video', () => {
  it('is 503 drive_unavailable when Google is not connected', async () => {
    const res = await session();
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('drive_unavailable');
  });

  it('returns the upload URL and creates TTA 2027 วิดีโอ/kmutt once', async () => {
    connectDrive(t.db, t.config);
    const res = await session();
    expect(res.statusCode).toBe(200);
    expect(res.json().uploadUrl).toMatch(/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?uploadType=resumable/);
    const [root] = google.foldersNamed(ROOT_FOLDER_NAME);
    const [uni] = google.foldersNamed('kmutt');
    expect(uni.parents).toEqual([root.id]);
    const init = google.calls.find(c => c.url.pathname === '/upload/drive/v3/files');
    expect(JSON.parse(init.body).parents).toEqual([uni.id]);
    expect(init.headers.get('origin')).toBe(t.config.appOrigin);

    await session();
    expect(google.foldersNamed('kmutt')).toHaveLength(1);
    expect(google.foldersNamed(ROOT_FOLDER_NAME)).toHaveLength(1);
  });

  it('checks type, extension and size before calling Google', async () => {
    connectDrive(t.db, t.config);
    expect((await session({ name: 'a.avi', size: MB, mime: 'video/x-msvideo' })).statusCode).toBe(415);
    expect((await session({ name: 'a.avi', size: MB, mime: 'video/mp4' })).statusCode).toBe(415);
    expect((await session({ name: 'a.mov', size: MB, mime: 'video/quicktime' })).statusCode).toBe(200);
    const big = await session({ name: 'a.mp4', size: t.config.maxVideoMB * MB + 1, mime: 'video/mp4' });
    expect(big.statusCode).toBe(413);
    expect(big.json().error).toBe('too_large');
  });

  it('refuses a submitted clip entry with 423 and admins with 403', async () => {
    connectDrive(t.db, t.config);
    await session();
    t.db.prepare("UPDATE submissions SET status = 2 WHERE university_id = 1 AND entry_key = 'clip'").run();
    expect((await session()).statusCode).toBe(423);
    const admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
    expect((await session(undefined, admin)).statusCode).toBe(403);
  });
});

describe('POST /api/submissions/clip/video/confirm', () => {
  beforeEach(() => connectDrive(t.db, t.config));

  it('returns a VideoRef for a file in the university folder', async () => {
    const folder = await kmuttFolder();
    google.addFile({ id: 'vid-ok-0001', name: 'clip.mp4', size: String(10 * MB), mimeType: 'video/mp4', parents: [folder] });
    const res = await post('/confirm', { driveFileId: 'vid-ok-0001' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ video: { driveFileId: 'vid-ok-0001', name: 'clip.mp4', size: 10 * MB, mime: 'video/mp4' } });
  });

  it('deletes a file in the wrong folder and answers 422', async () => {
    await kmuttFolder();
    google.addFile({ id: 'vid-wrong-01', name: 'clip.mp4', size: '100', mimeType: 'video/mp4', parents: ['some-other-folder'] });
    const res = await post('/confirm', { driveFileId: 'vid-wrong-01' });
    expect(res.statusCode).toBe(422);
    expect(google.files.has('vid-wrong-01')).toBe(false);
  });

  it("never deletes another university's video", async () => {
    await kmuttFolder();
    const rmutt = await loginAs(t.app, 'rmutt', 'pass-rmutt-1');
    await session(undefined, rmutt);
    const rmuttFolder = getSetting(t.db, 'drive.folder.rmutt');
    google.addFile({ id: 'vid-rmutt-01', name: 'r.mp4', size: '100', mimeType: 'video/mp4', parents: [rmuttFolder] });
    const res = await post('/confirm', { driveFileId: 'vid-rmutt-01' });
    expect(res.statusCode).toBe(422);
    expect(google.files.has('vid-rmutt-01')).toBe(true);
  });

  it('deletes a wrong type (415) or oversize file (413)', async () => {
    const folder = await kmuttFolder();
    google.addFile({ id: 'vid-type-01', name: 'x.mp4', size: '100', mimeType: 'video/webm', parents: [folder] });
    google.addFile({ id: 'vid-size-01', name: 'y.mp4', size: String(t.config.maxVideoMB * MB + 1), mimeType: 'video/mp4', parents: [folder] });
    expect((await post('/confirm', { driveFileId: 'vid-type-01' })).statusCode).toBe(415);
    expect((await post('/confirm', { driveFileId: 'vid-size-01' })).statusCode).toBe(413);
    expect(google.files.has('vid-type-01')).toBe(false);
    expect(google.files.has('vid-size-01')).toBe(false);
  });

  it('is 404 for an unknown id and 400 for a malformed id', async () => {
    await kmuttFolder();
    expect((await post('/confirm', { driveFileId: 'nope-nope-01' })).statusCode).toBe(404);
    expect((await post('/confirm', { driveFileId: '../x' })).statusCode).toBe(400);
  });

  it('deletes previously confirmed videos for the same university when confirming a new video', async () => {
    const folder = await kmuttFolder();
    google.addFile({ id: 'vid-old-0001', name: 'old.mp4', size: String(5 * MB), mimeType: 'video/mp4', parents: [folder] });
    google.addFile({ id: 'vid-new-0002', name: 'new.mp4', size: String(6 * MB), mimeType: 'video/mp4', parents: [folder] });
    expect((await post('/confirm', { driveFileId: 'vid-old-0001' })).statusCode).toBe(200);
    expect(google.files.has('vid-old-0001')).toBe(true);

    expect((await post('/confirm', { driveFileId: 'vid-new-0002' })).statusCode).toBe(200);
    expect(google.files.has('vid-old-0001')).toBe(false);
    expect(google.files.has('vid-new-0002')).toBe(true);
    const rows = t.db.prepare('SELECT drive_file_id FROM video_confirmations WHERE university_id = 1').all();
    expect(rows.map(r => r.drive_file_id)).toEqual(['vid-new-0002']);
  });
});

describe('DELETE /api/submissions/clip/video/:driveFileId', () => {
  beforeEach(() => connectDrive(t.db, t.config));
  const del = (id, cookie = kmutt) =>
    t.app.inject({ method: 'DELETE', url: `/api/submissions/clip/video/${id}`, headers: { cookie } });

  it('deletes own video while draft, returns updated entry, and refuses when submitted', async () => {
    const folder = await kmuttFolder();
    google.addFile({ id: 'vid-del-001', name: 'a.mp4', size: '1', mimeType: 'video/mp4', parents: [folder] });
    google.addFile({ id: 'vid-del-002', name: 'b.mp4', size: '1', mimeType: 'video/mp4', parents: [folder] });
    const res = await del('vid-del-001');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, entry: { video: null } });
    expect(google.files.has('vid-del-001')).toBe(false);

    t.db.prepare("UPDATE submissions SET status = 2 WHERE university_id = 1 AND entry_key = 'clip'").run();
    expect((await del('vid-del-002')).statusCode).toBe(423);
    expect(google.files.has('vid-del-002')).toBe(true);
  });

  it("refuses to delete another university's video (403)", async () => {
    const rmutt = await loginAs(t.app, 'rmutt', 'pass-rmutt-1');
    await session(undefined, rmutt);
    google.addFile({ id: 'vid-rm-0001', name: 'a.mp4', size: '1', mimeType: 'video/mp4',
      parents: [getSetting(t.db, 'drive.folder.rmutt')] });
    expect((await del('vid-rm-0001')).statusCode).toBe(403);
    expect(google.files.has('vid-rm-0001')).toBe(true);
  });
});
