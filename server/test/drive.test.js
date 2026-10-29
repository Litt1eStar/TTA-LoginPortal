import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { createDrive, ROOT_FOLDER_NAME } from '../src/drive.js';
import { getSetting } from '../src/settings.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, FOLDER_MIME } from './fakeGoogle.js';

function setup({ connected = true, token } = {}) {
  const db = openDb(':memory:');
  const config = loadConfig({ NODE_ENV: 'test', ...GOOGLE_ENV });
  const google = fakeGoogle();
  if (connected) connectDrive(db, config, token);
  return { db, config, google, drive: createDrive({ db, config, fetch: google.fetch }) };
}

describe('createDrive', () => {
  it('is not connected without a stored token, and Drive calls give 503', async () => {
    const { drive } = setup({ connected: false });
    expect(drive.isConnected()).toBe(false);
    await expect(drive.ensureUniversityFolder('kmutt')).rejects.toMatchObject({ statusCode: 503, code: 'drive_unavailable' });
  });

  it('creates the root folder then the university folder once, and remembers both', async () => {
    const { db, drive, google } = setup();
    const id1 = await drive.ensureUniversityFolder('kmutt');
    const id2 = await drive.ensureUniversityFolder('kmutt');
    expect(id1).toBe(id2);
    const [root] = google.foldersNamed(ROOT_FOLDER_NAME);
    expect(root.parents).toEqual([]);
    expect(google.files.get(id1)).toMatchObject({ name: 'kmutt', mimeType: FOLDER_MIME, parents: [root.id] });
    expect(getSetting(db, 'drive.root_folder')).toBe(root.id);
    expect(getSetting(db, 'drive.folder.kmutt')).toBe(id1);
    expect(google.calls.filter(c => c.url.pathname === '/token')).toHaveLength(1); // access token cached
  });

  it('starts a resumable session with Origin and X-Upload headers', async () => {
    const { config, drive, google } = setup();
    const url = await drive.createResumableSession({ name: 'clip.mp4', size: 1234, mime: 'video/mp4', parent: 'folder-x' });
    expect(url).toMatch(/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?uploadType=resumable&upload_id=/);
    const call = google.calls.find(c => c.url.pathname === '/upload/drive/v3/files');
    expect(call.url.searchParams.get('uploadType')).toBe('resumable');
    expect(call.headers.get('origin')).toBe(config.appOrigin);
    expect(call.headers.get('x-upload-content-type')).toBe('video/mp4');
    expect(call.headers.get('x-upload-content-length')).toBe('1234');
    expect(JSON.parse(call.body)).toEqual({ name: 'clip.mp4', mimeType: 'video/mp4', parents: ['folder-x'] });
  });

  it('reads and deletes file metadata, null / no error when missing', async () => {
    const { drive, google } = setup();
    google.addFile({ id: 'vid1', name: 'a.mp4', size: '10', mimeType: 'video/mp4', parents: ['p'] });
    expect(await drive.getFileMeta('vid1')).toMatchObject({ id: 'vid1', parents: ['p'] });
    await drive.deleteFile('vid1');
    expect(google.files.has('vid1')).toBe(false);
    expect(await drive.getFileMeta('vid1')).toBeNull();
    await expect(drive.deleteFile('vid1')).resolves.toBeUndefined();
  });

  it('reports the account email and quota', async () => {
    const { drive } = setup();
    expect(await drive.getAbout()).toEqual({ email: 'lead@gmail.com', quota: { limit: 16106127360, usage: 1048576 } });
  });

  it('forgets a revoked refresh token and answers 503', async () => {
    const { db, drive } = setup({ token: 'rt-revoked' });
    await expect(drive.getAbout()).rejects.toMatchObject({ statusCode: 503 });
    expect(getSetting(db, 'google.refresh_token')).toBeNull();
    expect(drive.isConnected()).toBe(false);
  });
});
