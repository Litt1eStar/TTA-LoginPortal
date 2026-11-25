import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { createDrive, ROOT_FOLDER_NAME, entryDriveFolderName, memberDrivePhotoName } from '../src/drive.js';
import { getSetting, deleteSetting } from '../src/settings.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, FOLDER_MIME } from './fakeGoogle.js';

function setup({ connected = true, token, uploadDir } = {}) {
  const db = openDb(':memory:');
  const config = loadConfig({ NODE_ENV: 'test', ...GOOGLE_ENV, ...(uploadDir ? { UPLOAD_DIR: uploadDir } : {}) });
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

  it('reuses an existing root and university folder in Drive instead of creating duplicates', async () => {
    const { db, drive, google } = setup();
    const id1 = await drive.ensureUniversityFolder('kmutnb');
    const rootId = getSetting(db, 'drive.root_folder');

    // Simulate settings being cleared while folders remain in Google Drive
    deleteSetting(db, 'drive.root_folder');
    deleteSetting(db, 'drive.folder.kmutnb');

    const id2 = await drive.ensureUniversityFolder('kmutnb');
    expect(id2).toBe(id1);
    expect(getSetting(db, 'drive.root_folder')).toBe(rootId);
    expect(google.foldersNamed(ROOT_FOLDER_NAME)).toHaveLength(1);
    expect(google.foldersNamed('kmutnb')).toHaveLength(1);
  });

  it('syncs member profile photos to <Root>/<uni>/<track>/<title+fullName>.<ext>, renames on name edit, and deletes on removal', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-drive-photos-'));
    try {
      const { db, drive, google } = setup({ uploadDir: tmpDir });
      db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutnb', 'มจพ.')").run();
      db.prepare("INSERT INTO users (id, username, password_hash, name, university_id) VALUES (1, 'kmutnb', 'h', 'k', 1)").run();
      db.prepare("INSERT INTO submissions (university_id, entry_key, status, data) VALUES (1, 'theory.g0', 1, '{}')").run();

      const sha1 = 'a'.repeat(64);
      const sha2 = 'b'.repeat(64);
      fs.writeFileSync(path.join(tmpDir, sha1), 'webp-bytes-1');
      fs.writeFileSync(path.join(tmpDir, sha2), 'webp-bytes-2');
      db.prepare("INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (10, 1, 'theory.g0', 0, ?, 12, 'image/webp', 'photo.webp', 1, 0)").run(sha1);
      db.prepare("INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (11, 1, 'theory.g0', 0, ?, 12, 'image/webp', 'photo2.webp', 1, 0)").run(sha2);

      expect(entryDriveFolderName('theory.g0')).toBe('สอนทฤษฎี - กลุ่มสาขาวิชาไฟฟ้า');
      expect(memberDrivePhotoName({ title: 'นาย', fullName: 'สมชาย ใจดี' }, 'webp')).toBe('นายสมชาย ใจดี.webp');

      await drive.syncEntryPhotos('kmutnb', 1, 'theory.g0', [
        { id: 'm1', title: 'ดร.', fullName: 'อาร์ม ธนพล', photo: { fileId: 10 } },
        { id: 'm2', title: 'นาย', fullName: 'กฤติน ประกอบดี', photo: { fileId: 11 } }
      ]);

      const entryFolderId = getSetting(db, 'drive.folder.kmutnb.theory.g0');
      const uniFolderId = getSetting(db, 'drive.folder.kmutnb');
      expect(google.files.get(entryFolderId)).toMatchObject({
        name: 'สอนทฤษฎี - กลุ่มสาขาวิชาไฟฟ้า',
        mimeType: FOLDER_MIME,
        parents: [uniFolderId]
      });

      const uploaded = [...google.files.values()].filter(f => f.mimeType === 'image/webp');
      expect(uploaded.map(f => f.name).sort()).toEqual(['ดร.อาร์ม ธนพล.webp', 'นายกฤติน ประกอบดี.webp'].sort());
      expect(uploaded.every(f => f.parents[0] === entryFolderId)).toBe(true);

      // Rename member m1 without changing photo -> renames existing Drive file
      await drive.syncEntryPhotos('kmutnb', 1, 'theory.g0', [
        { id: 'm1', title: 'ผศ.ดร.', fullName: 'อาร์ม ธนพล', photo: { fileId: 10 } },
        { id: 'm2', title: 'นาย', fullName: 'กฤติน ประกอบดี', photo: { fileId: 11 } }
      ]);
      const afterRename = [...google.files.values()].filter(f => f.mimeType === 'image/webp');
      expect(afterRename.map(f => f.name).sort()).toEqual(['นายกฤติน ประกอบดี.webp', 'ผศ.ดร.อาร์ม ธนพล.webp'].sort());

      // Remove member m2 -> deletes m2's Drive file
      await drive.syncEntryPhotos('kmutnb', 1, 'theory.g0', [
        { id: 'm1', title: 'ผศ.ดร.', fullName: 'อาร์ม ธนพล', photo: { fileId: 10 } }
      ]);
      const afterRemove = [...google.files.values()].filter(f => f.mimeType === 'image/webp');
      expect(afterRemove.map(f => f.name)).toEqual(['ผศ.ดร.อาร์ม ธนพล.webp']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
