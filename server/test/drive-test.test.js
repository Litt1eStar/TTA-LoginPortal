import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, FOLDER_MIME } from './fakeGoogle.js';
import { getSetting } from '../src/settings.js';
import { TEST_FOLDER_NAME, ROOT_FOLDER_NAME } from '../src/drive.js';

// Admin "test Google Drive upload": the same browser -> Drive resumable path as the clip video,
// plus the server -> Drive path used by the photo sync, all inside one test folder.

let t, google, admin;
beforeEach(async () => {
  google = fakeGoogle();
  t = await makeTestApp(GOOGLE_ENV, { googleFetch: google.fetch });
  connectDrive(t.db, t.config);
  admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
});
afterEach(() => t.app.close());

const post = (url, payload, cookie = admin) =>
  t.app.inject({ method: 'POST', url: `/api/admin/drive-test${url}`, payload, headers: { cookie } });
const del = (id, cookie = admin) =>
  t.app.inject({ method: 'DELETE', url: `/api/admin/drive-test/${encodeURIComponent(id)}`, headers: { cookie } });
const testFolder = () => getSetting(t.db, 'drive.test_folder');

describe('admin Drive upload test', () => {
  it('is admin only', async () => {
    const kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
    expect((await post('/session', { name: 'a.txt', size: 10 }, kmutt)).statusCode).toBe(403);
    expect((await post('/server', {}, kmutt)).statusCode).toBe(403);
    expect((await del('file-00001', kmutt)).statusCode).toBe(403);
  });

  it('answers 503 when Drive is not connected', async () => {
    const bare = await makeTestApp(GOOGLE_ENV, { googleFetch: fakeGoogle().fetch });
    const c = await loginAs(bare.app, 'admin1', 'pass-admin-1');
    const res = await bare.app.inject({ method: 'POST', url: '/api/admin/drive-test/session',
      payload: { name: 'a.txt', size: 10 }, headers: { cookie: c } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('drive_unavailable');
    await bare.app.close();
  });

  it('opens a resumable session in the test folder under the root folder', async () => {
    const res = await post('/session', { name: 'clip.mp4', size: 1234, mime: 'video/mp4' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadUrl).toMatch(/uploadType=resumable/);
    expect(body.folderUrl).toBe(`https://drive.google.com/drive/folders/${testFolder()}`);

    const [folder] = google.foldersNamed(TEST_FOLDER_NAME);
    expect(folder.id).toBe(testFolder());
    expect(folder.parents).toEqual([google.foldersNamed(ROOT_FOLDER_NAME)[0].id]);

    const session = google.calls.find(c => c.url.pathname === '/upload/drive/v3/files' && c.method === 'POST');
    expect(JSON.parse(session.body)).toEqual({ name: 'clip.mp4', mimeType: 'video/mp4', parents: [testFolder()] });
    expect(session.headers.get('x-upload-content-length')).toBe('1234');
    expect(session.headers.get('origin')).toBe(t.config.appOrigin);
  });

  it('defaults an unknown type and rejects files over the video limit', async () => {
    const ok = await post('/session', { name: 'data.bin', size: 5 });
    expect(ok.statusCode).toBe(200);
    const session = google.calls.findLast(c => c.url.pathname === '/upload/drive/v3/files');
    expect(JSON.parse(session.body).mimeType).toBe('application/octet-stream');

    const big = await post('/session', { name: 'big.mp4', size: t.config.maxVideoMB * 1024 * 1024 + 1 });
    expect(big.statusCode).toBe(413);
  });

  it('confirms an uploaded file in the test folder with the expected size', async () => {
    await post('/session', { name: 'x.txt', size: 1234 });
    google.addFile({ id: 'file-upload-1', name: 'x.txt', mimeType: 'text/plain', parents: [testFolder()], size: '1234' });
    const res = await post('/confirm', { driveFileId: 'file-upload-1', size: 1234 });
    expect(res.statusCode).toBe(200);
    expect(res.json().file).toEqual({
      id: 'file-upload-1', name: 'x.txt', size: 1234, mimeType: 'text/plain',
      url: 'https://drive.google.com/file/d/file-upload-1/view'
    });
  });

  it('reports a size mismatch, a file outside the test folder, and a missing file', async () => {
    await post('/session', { name: 'x.txt', size: 1234 });
    google.addFile({ id: 'file-short', name: 'x.txt', mimeType: 'text/plain', parents: [testFolder()], size: '1000' });
    google.addFile({ id: 'file-elsewhere', name: 'y.txt', mimeType: 'text/plain', parents: ['other'], size: '1234' });

    const short = await post('/confirm', { driveFileId: 'file-short', size: 1234 });
    expect(short.statusCode).toBe(422);
    expect(short.json().message).toContain('1000');

    expect((await post('/confirm', { driveFileId: 'file-elsewhere', size: 1234 })).statusCode).toBe(403);
    expect((await post('/confirm', { driveFileId: 'file-missing-1', size: 1 })).statusCode).toBe(404);
  });

  it('uploads a small file from the server into the test folder', async () => {
    const res = await post('/server', {});
    expect(res.statusCode).toBe(200);
    const { file, folderUrl } = res.json();
    expect(file.name).toMatch(/^server-test-.*\.txt$/);
    expect(file.size).toBeGreaterThan(0);
    expect(google.files.get(file.id).parents).toEqual([testFolder()]);
    expect(folderUrl).toContain(testFolder());
  });

  it('deletes test files only', async () => {
    await post('/session', { name: 'x.txt', size: 3 });
    google.addFile({ id: 'file-test-1', name: 'x.txt', mimeType: 'text/plain', parents: [testFolder()], size: '3' });
    google.addFile({ id: 'file-real-1', name: 'v.mp4', mimeType: 'video/mp4', parents: ['uni-folder'], size: '3' });

    expect((await del('file-test-1')).statusCode).toBe(200);
    expect(google.files.has('file-test-1')).toBe(false);

    expect((await del('file-real-1')).statusCode).toBe(403);
    expect(google.files.has('file-real-1')).toBe(true);

    expect((await del(testFolder())).statusCode).toBe(403);
    expect(google.files.get(testFolder()).mimeType).toBe(FOLDER_MIME);

    expect((await del('file-gone-123')).statusCode).toBe(200);   // already gone: nothing to do
  });
});
