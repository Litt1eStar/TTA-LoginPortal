import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yauzl from 'yauzl';
import { makeTestApp, loginAs } from './helpers.js';
import { listEntries, saveDraft } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function addStoredFile(db, config, { universityId, key, kind, bytes, mime, name }) {
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, sha), bytes);
  const userId = db.prepare("SELECT id FROM users WHERE username = 'kmutt'").get().id;
  const r = db.prepare('INSERT INTO files (university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(universityId, key, kind, sha, bytes.length, mime, name, userId, Math.floor(Date.now() / 1000));
  return Number(r.lastInsertRowid);
}

function readZip(buffer) {
  return new Promise((resolve, reject) => {
    const out = new Map();
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', () => resolve(out));
      zip.on('entry', (entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e) return reject(e);
          const chunks = [];
          stream.on('data', c => chunks.push(c));
          stream.on('end', () => { out.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

describe('admin files.zip', () => {
  it('puts photos and work files in folders per university code and entry', async () => {
    ctx = await makeTestApp();
    const { db, config, app } = ctx;
    listEntries(db, 1);
    const photoId = addStoredFile(db, config, { universityId: 1, key: 'theory.g0', kind: 0, bytes: Buffer.from('photo-bytes'), mime: 'image/webp', name: 'me.webp' });
    const workId = addStoredFile(db, config, { universityId: 1, key: 'theory.g0', kind: 1, bytes: Buffer.from('%PDF-1.4 fake'), mime: 'application/pdf', name: 'slides.pdf' });
    saveDraft(db, 1, 'theory.g0', {
      members: [{ id: 'a1', type: 'advisor', title: 'ดร.', fullName: 'สมชาย ใจดี', dept: '', university: '', email: '', phone: '', source: 'manual',
        photo: { fileId: photoId, name: 'me.webp', size: 11, ext: 'webp', mime: 'image/webp' } }],
      files: [{ fileId: workId, name: 'slides.pdf', size: 13, ext: 'pdf', mime: 'application/pdf' }]
    }, 1);

    const cookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const res = await app.inject({ method: 'GET', url: '/api/admin/files.zip?key=theory', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toBe('attachment; filename="tta-theory.zip"');

    const files = await readZip(res.rawPayload);
    expect([...files.keys()].sort()).toEqual([
      'kmutt/theory.g0/files/slides.pdf',
      'kmutt/theory.g0/photos/01-สมชาย ใจดี.webp'
    ]);
    expect(files.get('kmutt/theory.g0/files/slides.pdf').toString()).toBe('%PDF-1.4 fake');
  });

  it('adds links.txt with Drive and YouTube links for clip', async () => {
    ctx = await makeTestApp();
    const { db, app } = ctx;
    listEntries(db, 2);
    // saveDraft only keeps a video the server has confirmed (plan C)
    db.prepare('INSERT INTO video_confirmations (university_id, drive_file_id, created_at) VALUES (?, ?, ?)').run(2, '1AbCdEf', Math.floor(Date.now() / 1000));
    saveDraft(db, 2, 'clip', {
      links: { video: 'https://youtu.be/abc123' },
      video: { driveFileId: '1AbCdEf', name: 'clip.mp4', size: 1000, mime: 'video/mp4' }
    }, 1);
    const cookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const res = await app.inject({ method: 'GET', url: '/api/admin/files.zip?key=clip', headers: { cookie } });
    const files = await readZip(res.rawPayload);
    const links = files.get('rmutt/clip/links.txt').toString('utf8');
    expect(links).toContain('https://drive.google.com/file/d/1AbCdEf/view');
    expect(links).toContain('https://youtu.be/abc123');
  });

  it('lists files missing on disk in _missing.txt instead of failing', async () => {
    ctx = await makeTestApp();
    const { db, config, app } = ctx;
    listEntries(db, 1);
    const workId = addStoredFile(db, config, { universityId: 1, key: 'robot', kind: 1, bytes: Buffer.from('zz'), mime: 'application/zip', name: 'code.zip' });
    saveDraft(db, 1, 'robot', { files: [{ fileId: workId, name: 'code.zip', size: 2, ext: 'zip', mime: 'application/zip' }] }, 1);
    const sha = db.prepare('SELECT sha256 FROM files WHERE id = ?').get(workId).sha256;
    fs.rmSync(path.join(config.uploadDir, sha));
    const cookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const res = await app.inject({ method: 'GET', url: '/api/admin/files.zip?key=robot', headers: { cookie } });
    const files = await readZip(res.rawPayload);
    expect(files.get('_missing.txt').toString('utf8')).toContain('kmutt/robot: code.zip');
  });

  it('rejects an unknown key with 400', async () => {
    ctx = await makeTestApp();
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/files.zip?key=nope', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });
});
