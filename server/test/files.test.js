import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { sweepOrphanBlobs, moveIntoPlace } from '../src/files.js';
import { makeTestApp, loginAs } from './helpers.js';
import { multipartBody, jpegBytes, pdfBytes, cfbBytes, zipBytes } from './fixtures.js';

export const blobs = (config) => readdirSync(config.uploadDir).filter(n => /^[0-9a-f]{64}$/.test(n));

export async function upload(app, cookie, key, kind, filename, bytes) {
  return app.inject({ method: 'POST', url: `/api/submissions/${key}/files?kind=${kind}`,
    ...withCookie(multipartBody(filename, bytes), cookie) });
}
function withCookie(body, cookie) {
  return { payload: body.payload, headers: { ...body.headers, cookie } };
}

let t, kmutt;
beforeEach(async () => {
  t = await makeTestApp();
  kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
});
afterEach(() => t.app.close());

describe('POST /api/submissions/:key/files', () => {
  it('stores a photo and returns a PhotoRef', async () => {
    const res = await upload(t.app, kmutt, 'singing', 'photo', 'me.jpg', jpegBytes());
    expect(res.statusCode).toBe(200);
    const { file } = res.json();
    expect(file).toEqual({ fileId: expect.any(Number), name: 'me.jpg', size: 64, ext: 'jpg',
      mime: 'image/jpeg', dataUrl: `/api/files/${file.fileId}` });
    expect(blobs(t.config)).toHaveLength(1);
    const row = t.db.prepare('SELECT * FROM files WHERE id = ?').get(file.fileId);
    expect(row).toMatchObject({ university_id: 1, entry_key: 'singing', kind: 0, size: 64 });
  });

  it('returns a FileRef for a work pdf', async () => {
    const res = await upload(t.app, kmutt, 'clip', 'work', 'งาน.pdf', pdfBytes());
    expect(res.statusCode).toBe(200);
    const { file } = res.json();
    expect(file).toMatchObject({ id: file.fileId, name: 'งาน.pdf', ext: 'pdf', mime: 'application/pdf',
      status: 'done', progress: 100, url: `/api/files/${file.fileId}` });
  });

  it('accepts a pptx that sniffs as a plain zip, and a ppt that sniffs as CFB', async () => {
    const pptx = await upload(t.app, kmutt, 'clip', 'work', 'slides.pptx', zipBytes('[Content_Types].xml', '<Types/>'));
    expect(pptx.statusCode).toBe(200);
    expect(pptx.json().file.mime).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const ppt = await upload(t.app, kmutt, 'clip', 'work', 'old.ppt', cfbBytes());
    expect(ppt.statusCode).toBe(200);
    expect(ppt.json().file.mime).toBe('application/vnd.ms-powerpoint');
  });

  it('rejects a fake .jpg (text bytes) with 415 and keeps nothing', async () => {
    const res = await upload(t.app, kmutt, 'singing', 'photo', 'fake.jpg', Buffer.from('hello, not a jpeg'));
    expect(res.statusCode).toBe(415);
    expect(res.json().error).toBe('bad_type');
    expect(blobs(t.config)).toHaveLength(0);
    expect(readdirSync(t.config.uploadDir + '/tmp')).toHaveLength(0);
  });

  it('rejects a pdf sent as a photo, and a zip renamed to .pdf', async () => {
    expect((await upload(t.app, kmutt, 'singing', 'photo', 'a.pdf', pdfBytes())).statusCode).toBe(415);
    expect((await upload(t.app, kmutt, 'clip', 'work', 'a.pdf', zipBytes())).statusCode).toBe(415);
  });

  it('rejects an oversize photo with 413', async () => {
    const small = await makeTestApp({ MAX_PHOTO_KB: '1' });
    const cookie = await loginAs(small.app, 'kmutt', 'pass-kmutt-1');
    const res = await upload(small.app, cookie, 'singing', 'photo', 'big.jpg', jpegBytes(2048));
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe('too_large');
    expect(blobs(small.config)).toHaveLength(0);
    await small.app.close();
  });

  it('stores identical bytes once (dedupe by sha256)', async () => {
    const a = await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes());
    const b = await upload(t.app, kmutt, 'dance', 'photo', 'b.jpg', jpegBytes());
    expect(a.json().file.fileId).not.toBe(b.json().file.fileId);
    expect(blobs(t.config)).toHaveLength(1);
  });

  it('refuses a submitted entry with 423', async () => {
    await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes()); // creates the rows
    t.db.prepare("UPDATE submissions SET status = 2 WHERE university_id = 1 AND entry_key = 'singing'").run();
    const res = await upload(t.app, kmutt, 'singing', 'photo', 'b.jpg', jpegBytes(64, 1));
    expect(res.statusCode).toBe(423);
    expect(res.json().error).toBe('locked');
  });

  it('refuses after the deadline, an unknown key, a bad kind, admins and anonymous users', async () => {
    const late = await makeTestApp({ DEADLINE: '2000-01-01T00:00:00Z' });
    const c = await loginAs(late.app, 'kmutt', 'pass-kmutt-1');
    expect((await upload(late.app, c, 'singing', 'photo', 'a.jpg', jpegBytes())).statusCode).toBe(403);
    await late.app.close();

    expect((await upload(t.app, kmutt, 'theory', 'photo', 'a.jpg', jpegBytes())).statusCode).toBe(400);
    expect((await upload(t.app, kmutt, 'singing', 'video', 'a.jpg', jpegBytes())).statusCode).toBe(400);
    const admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
    expect((await upload(t.app, admin, 'singing', 'photo', 'a.jpg', jpegBytes())).statusCode).toBe(403);
    expect((await upload(t.app, '', 'singing', 'photo', 'a.jpg', jpegBytes())).statusCode).toBe(401);
  });

  it('caps an entry at 40 files', async () => {
    for (let i = 0; i < 40; i++) {
      const r = await upload(t.app, kmutt, 'dance', 'photo', `p${i}.jpg`, jpegBytes(64, i));
      expect(r.statusCode).toBe(200);
    }
    const res = await upload(t.app, kmutt, 'dance', 'photo', 'p40.jpg', jpegBytes(64, 200));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('bad_request');
  });
});
describe('GET /api/files/:id', () => {
  it('streams the bytes with mime and immutable cache to the owner', async () => {
    const { file } = (await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes())).json();
    const res = await t.app.inject({ method: 'GET', url: file.dataUrl, headers: { cookie: kmutt } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(res.rawPayload.equals(jpegBytes())).toBe(true);
  });

  it('is 403 for another university and 200 for an admin', async () => {
    const { file } = (await upload(t.app, kmutt, 'clip', 'work', 'w.pdf', pdfBytes())).json();
    const rmutt = await loginAs(t.app, 'rmutt', 'pass-rmutt-1');
    const other = await t.app.inject({ method: 'GET', url: file.url, headers: { cookie: rmutt } });
    expect(other.statusCode).toBe(403);
    const admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
    const ok = await t.app.inject({ method: 'GET', url: file.url, headers: { cookie: admin } });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-disposition']).toBe("attachment; filename=\"w.pdf\"; filename*=UTF-8''w.pdf");
  });

  it('is 404 for an unknown id and 401 without a session', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/files/999', headers: { cookie: kmutt } })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'GET', url: '/api/files/1' })).statusCode).toBe(401);
  });
});

describe('DELETE /api/files/:id', () => {
  const del = (id, cookie) => t.app.inject({ method: 'DELETE', url: `/api/files/${id}`, headers: { cookie } });

  it('keeps the disk file while another row still uses it', async () => {
    const a = (await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes())).json().file;
    const b = (await upload(t.app, kmutt, 'dance', 'photo', 'b.jpg', jpegBytes())).json().file;
    const [blob] = blobs(t.config);
    const blobFile = path.join(t.config.uploadDir, blob);

    expect((await del(a.fileId, kmutt)).json()).toEqual({ ok: true });
    expect(existsSync(blobFile)).toBe(true);
    expect(await sweepOrphanBlobs(t.db, t.config.uploadDir, 0)).toEqual([]); // still referenced
    expect((await del(b.fileId, kmutt)).statusCode).toBe(200);
    expect(existsSync(blobFile)).toBe(true); // DELETE only removes the row
    expect(await sweepOrphanBlobs(t.db, t.config.uploadDir)).toEqual([]); // too young to sweep
    expect(await sweepOrphanBlobs(t.db, t.config.uploadDir, 0)).toEqual([blob]);
    expect(existsSync(blobFile)).toBe(false);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM files').get().n).toBe(0);
  });

  it('refuses another university (403) and a submitted entry (423)', async () => {
    const f = (await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes())).json().file;
    const rmutt = await loginAs(t.app, 'rmutt', 'pass-rmutt-1');
    expect((await del(f.fileId, rmutt)).statusCode).toBe(403);
    t.db.prepare("UPDATE submissions SET status = 2 WHERE university_id = 1 AND entry_key = 'singing'").run();
    expect((await del(f.fileId, kmutt)).statusCode).toBe(423);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM files').get().n).toBe(1);
  });
});

describe('hardening', () => {
  it('moveIntoPlace keeps going when the target already exists', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tta-mv-'));
    try {
      const target = path.join(dir, 'target');
      const tmp = path.join(dir, 'tmpfile');
      writeFileSync(target, 'a'); writeFileSync(tmp, 'a');
      await moveIntoPlace(tmp, target);
      expect(existsSync(tmp)).toBe(false);
      expect(existsSync(target)).toBe(true);
      await expect(moveIntoPlace(path.join(dir, 'nope'), path.join(dir, 'other'))).rejects.toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('GET is 404 when the blob is missing from disk', async () => {
    const { file } = (await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes())).json();
    rmSync(path.join(t.config.uploadDir, blobs(t.config)[0]));
    const res = await t.app.inject({ method: 'GET', url: file.dataUrl, headers: { cookie: kmutt } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('refuses an upload once the entry was submitted meanwhile (423)', async () => {
    expect((await upload(t.app, kmutt, 'singing', 'photo', 'a.jpg', jpegBytes())).statusCode).toBe(200);
    t.db.prepare("UPDATE submissions SET status = 2 WHERE university_id = 1 AND entry_key = 'singing'").run();
    expect((await upload(t.app, kmutt, 'singing', 'photo', 'b.jpg', jpegBytes(64, 3))).statusCode).toBe(423);
  });

  it('rejects an oversize work file with 413', async () => {
    const small = await makeTestApp({ MAX_WORK_MB: '0.001' });
    const cookie = await loginAs(small.app, 'kmutt', 'pass-kmutt-1');
    const res = await upload(small.app, cookie, 'clip', 'work', 'big.pdf', Buffer.concat([pdfBytes(), Buffer.alloc(4096)]));
    expect(res.statusCode).toBe(413);
    expect(blobs(small.config)).toHaveLength(0);
    await small.app.close();
  });

  it('sets nosniff and encodes a Thai filename with an ASCII fallback', async () => {
    const { file } = (await upload(t.app, kmutt, 'clip', 'work', "งาน's (1).pdf", pdfBytes())).json();
    const res = await t.app.inject({ method: 'GET', url: file.url, headers: { cookie: kmutt } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe(
      "attachment; filename=\"___'s (1).pdf\"; filename*=UTF-8''%E0%B8%87%E0%B8%B2%E0%B8%99%27s%20%281%29.pdf");
  });
});
