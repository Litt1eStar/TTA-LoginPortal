# Backend B: Files and Google Drive Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the API real photo and work-file uploads (stored on disk by sha256, checked by content) and video uploads that go straight from the browser to the project lead's Google Drive, plus the shared checklist rule that accepts an uploaded video.

**Architecture:** Three Fastify plugins added to the plan-A app: `files.js` (multipart upload → temp file while hashing → `file-type` sniff → `uploads/<sha256>` → `files` row; download and refcounted delete), `drive.js` (a `createDrive()` client over an injectable `fetch`, plus the admin OAuth routes) and `video.js` (resumable-session creation, confirm, delete). The Google refresh token is stored AES-256-GCM-encrypted in a new `settings` table. Tests never touch the network: `buildApp` takes a `googleFetch` option and the tests pass a fake Google.

**Tech Stack:** Node ≥ 22.13 (`node:sqlite`, global `fetch`), Fastify 5, `@fastify/multipart` 10.1.6, `file-type` 22.2.0 (ESM-only; Node API `fileTypeFromFile`), vitest. No `googleapis` package: the four Drive calls are plain `fetch`.

**Binding contract:** `docs/superpowers/plans/2026-10-29-backend-00-contracts.md`, including its "Amendments from plan A" (`links` holds only `video`; helpers `ensureRows`, `nowSec`, `ERRORS`; auth decorators exposed through `fastify-plugin`; sync `buildApp({ db, config, logger })`). Every route, error code and shape below comes from it. Where this plan had to add something the contract doesn't name, it is listed in "Contract notes" at the end.

---

## File structure

```
server/
  package.json                 + file-type, @fastify/multipart
  migrations/002_settings.sql  NEW  settings table
  src/settings.js              NEW  getSetting / setSetting / deleteSetting / listSettings / deleteSettingsLike
  src/crypto.js                NEW  encrypt / decrypt (AES-256-GCM, config.tokenKey)
  src/files.js                 NEW  plugin: POST /submissions/:key/files, GET/DELETE /files/:id; writableEntry()
  src/drive.js                 NEW  createDrive({ db, config, fetch }) + plugin: /admin/google/connect|callback|status
  src/video.js                 NEW  plugin: /submissions/clip/video, /confirm, DELETE /:driveFileId
  src/app.js                   EDIT register multipart + the three plugins; buildApp accepts googleFetch
  test/helpers.js              EDIT makeTestApp(overrides, appOptions) forwards appOptions to buildApp
  test/fixtures.js             NEW  multipart body builder, sample bytes (jpeg, pdf, zip, cfb)
  test/fakeGoogle.js           NEW  fake Google token + Drive endpoints; connectDrive()
  test/settings.test.js        NEW
  test/requirements.test.js    NEW  (tests the shared src/utils/requirements.js)
  test/files.test.js           NEW
  test/drive.test.js           NEW
  test/oauth.test.js           NEW
  test/video.test.js           NEW
src/utils/requirements.js      EDIT deliverables passes with data.video?.driveFileId
```

All commands run from `server/` on the `backend` branch (it exists from plan A):

```bash
git checkout backend
cd server
```

---

### Task 1: Packages, `settings` table, settings helpers, token encryption

**Files:**
- Modify: `server/package.json` (via npm)
- Create: `server/migrations/002_settings.sql`, `server/src/settings.js`, `server/src/crypto.js`, `server/test/settings.test.js`

- [ ] **Step 1: Install the two packages at exact versions**

```bash
npm install --save-exact file-type@22.2.0 @fastify/multipart@10.1.6
```

Expected: both appear in `dependencies` of `server/package.json`. `file-type` 22 is ESM-only and needs Node ≥ 22; the server is `"type": "module"`, so `import { fileTypeFromFile } from 'file-type'` works.

- [ ] **Step 2: Write the failing test**

`server/test/settings.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { getSetting, setSetting, deleteSetting, listSettings, deleteSettingsLike } from '../src/settings.js';
import { encrypt, decrypt } from '../src/crypto.js';

const KEY = '11'.repeat(32);

describe('settings table', () => {
  it('is created by migration 002', () => {
    const db = openDb(':memory:');
    expect(db.prepare('PRAGMA user_version').get().user_version).toBeGreaterThanOrEqual(2);
    expect(getSetting(db, 'missing')).toBeNull();
  });

  it('sets, overwrites, lists and deletes values', () => {
    const db = openDb(':memory:');
    setSetting(db, 'drive.folder.kmutt', 'a');
    setSetting(db, 'drive.folder.kmutt', 'b');
    setSetting(db, 'drive.folder.rmutt', 'c');
    setSetting(db, 'google.email', 'x@gmail.com');
    expect(getSetting(db, 'drive.folder.kmutt')).toBe('b');
    expect(listSettings(db, 'drive.folder.').sort()).toEqual(['b', 'c']);
    deleteSetting(db, 'google.email');
    expect(getSetting(db, 'google.email')).toBeNull();
    deleteSettingsLike(db, 'drive.');
    expect(listSettings(db, 'drive.')).toEqual([]);
  });
});

describe('token encryption', () => {
  it('round-trips and never contains the plain text', () => {
    const enc = encrypt('rt-secret-123', KEY);
    expect(enc).not.toContain('rt-secret-123');
    expect(encrypt('rt-secret-123', KEY)).not.toBe(enc); // random IV
    expect(decrypt(enc, KEY)).toBe('rt-secret-123');
  });

  it('fails with the wrong key or a tampered value', () => {
    const enc = encrypt('rt-secret-123', KEY);
    expect(() => decrypt(enc, '22'.repeat(32))).toThrow();
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow();
  });

  it('rejects a key that is not 64 hex characters', () => {
    expect(() => encrypt('x', '')).toThrow(/TOKEN_KEY/);
    expect(() => encrypt('x', 'abc')).toThrow(/TOKEN_KEY/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

```bash
npx vitest run test/settings.test.js
```

Expected: FAIL, `Cannot find module '../src/settings.js'`.

- [ ] **Step 4: Add the migration**

`server/migrations/002_settings.sql` (exactly the contract's table; `openDb` applies it because 2 > `user_version`):

```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
-- keys: 'google.refresh_token' (AES-256-GCM, base64), 'google.email', 'drive.root_folder',
--       'drive.folder.<universityCode>'
```

- [ ] **Step 5: Add the settings helpers**

`server/src/settings.js`:

```js
// Small key/value store in the `settings` table (migration 002).

export function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

export function deleteSetting(db, key) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Values of every key that starts with `prefix`.
export function listSettings(db, prefix) {
  return db.prepare("SELECT value FROM settings WHERE substr(key, 1, length(?)) = ?")
    .all(prefix, prefix)
    .map(r => r.value);
}

export function deleteSettingsLike(db, prefix) {
  db.prepare('DELETE FROM settings WHERE substr(key, 1, length(?)) = ?').run(prefix, prefix);
}
```

(`substr` instead of `LIKE` so `_` and `%` in a prefix are literal.)

- [ ] **Step 6: Add the encryption helpers**

`server/src/crypto.js`:

```js
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM. Stored form: base64( iv[12] | tag[16] | ciphertext ).
function keyBuffer(hex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex || '')) {
    throw new Error('TOKEN_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function isValidTokenKey(hex) {
  return /^[0-9a-fA-F]{64}$/.test(hex || '');
}

export function encrypt(text, hexKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(hexKey), iv);
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(stored, hexKey) {
  const buf = Buffer.from(stored, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(hexKey), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 7: Run it to see it pass**

```bash
npx vitest run test/settings.test.js
```

Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json migrations/002_settings.sql src/settings.js src/crypto.js test/settings.test.js
git commit -m "feat(server): settings table and encrypted token helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Checklist accepts an uploaded video (shared `requirements.js`)

**Files:**
- Create: `server/test/requirements.test.js`
- Modify: `src/utils/requirements.js` (repo root, shared with the frontend)

- [ ] **Step 1: Write the failing test**

`server/test/requirements.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getRequirements } from '../../src/utils/requirements.js';
import { getTrack } from '../../src/data/tracks.js';

const clip = getTrack('clip');
const deliverables = (sub) => getRequirements(clip, sub).find(r => r.key === 'deliverables');

describe('deliverables rule (clip)', () => {
  it('fails with no file, link or video', () => {
    expect(deliverables({}).ok).toBe(false);
    expect(deliverables({ files: [], links: { video: '' }, video: null }).ok).toBe(false);
  });

  it('passes with a Drive video only', () => {
    const sub = { files: [], links: { video: '' },
      video: { driveFileId: '1AbCdEfGhIjK', name: 'clip.mp4', size: 1000, mime: 'video/mp4' } };
    expect(deliverables(sub).ok).toBe(true);
  });

  it('does not pass with a video object that has no driveFileId', () => {
    expect(deliverables({ video: { name: 'clip.mp4' } }).ok).toBe(false);
  });

  it('still passes with a YouTube link or a finished file', () => {
    expect(deliverables({ links: { video: 'https://youtu.be/x' } }).ok).toBe(true);
    expect(deliverables({ files: [{ status: 'done' }] }).ok).toBe(true);
  });

  it('mentions the video in the label', () => {
    expect(deliverables({}).label).toContain('วิดีโอ');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx vitest run test/requirements.test.js
```

Expected: FAIL in "passes with a Drive video only" and "mentions the video in the label".

- [ ] **Step 3: Change the rule**

In `src/utils/requirements.js`, replace the whole `if (track.needsWorkInfo) { const hasFiles … }` block (the deliverables one at the end of `getRequirements`) with:

```js
  if (track.needsWorkInfo) {
    const hasFiles = (sub.files || []).some(f => f.status === 'done');
    const hasLinks = !!sub.links?.video;
    const hasVideo = !!sub.video?.driveFileId;
    reqs.push({
      key: 'deliverables',
      section: 'deliverables',
      label: 'อัปโหลดไฟล์ วิดีโอ หรือแนบลิงก์ YouTube',
      ok: hasFiles || hasLinks || hasVideo,
      error: 'กรุณาอัปโหลดไฟล์ วิดีโอ หรือแนบลิงก์ YouTube อย่างน้อย 1 รายการ'
    });
  }
```

- [ ] **Step 4: Run it to see it pass**

```bash
npx vitest run test/requirements.test.js
```

Expected: PASS (5 tests). Also run the whole suite (`npx vitest run`) to check plan A's submit tests still pass.

- [ ] **Step 5: Commit**

```bash
git add ../src/utils/requirements.js test/requirements.test.js
git commit -m "feat: deliverables check accepts an uploaded Drive video

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Photo and work-file upload

**Files:**
- Create: `server/src/files.js`, `server/test/fixtures.js`, `server/test/files.test.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Add test fixtures**

`server/test/fixtures.js` (byte samples were checked against `file-type` 22.2.0: jpeg → `image/jpeg`, text → `undefined`, pdf → `application/pdf`, the zip → `application/zip`, the CFB header → `application/x-cfb`):

```js
// Multipart body for app.inject(), field name "file".
export function multipartBody(filename, bytes, contentType = 'application/octet-stream') {
  const boundary = '----ttatest' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, Buffer.from(bytes), tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }
  };
}

// Smallest bytes file-type recognises as JPEG; `fill` changes the content (and so the sha256).
export function jpegBytes(size = 64, fill = 0) {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
  return Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, size - head.length), fill)]);
}

export const pdfBytes = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const cfbBytes = () =>
  Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)]);

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// A real one-entry stored zip (file-type reports application/zip).
export function zipBytes(entryName = 'hello.txt', content = 'hi') {
  const n = Buffer.from(entryName);
  const d = Buffer.from(content);
  const crc = crc32(d);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(d.length, 18); local.writeUInt32LE(d.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(d.length, 20); central.writeUInt32LE(d.length, 24);
  central.writeUInt16LE(n.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + n.length, 12); end.writeUInt32LE(30 + n.length + d.length, 16);
  return Buffer.concat([local, n, d, central, n, end]);
}
```

- [ ] **Step 2: Write the failing test**

`server/test/files.test.js` (upload part; Task 4 appends the download/delete tests to this file):

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdirSync } from 'node:fs';
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
```

- [ ] **Step 3: Run it to see it fail**

```bash
npx vitest run test/files.test.js
```

Expected: FAIL, every upload returns 404 (route not registered).

- [ ] **Step 4: Write `files.js` (upload route + shared helpers)**

`server/src/files.js`:

```js
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileTypeFromFile } from 'file-type';
import { httpError } from './errors.js';
import { isValidEntryKey, getEntryRow, ensureRows, nowSec, assertBeforeDeadline } from './entries.js';
import { ALLOWED_EXTENSIONS } from '../../src/data/tracks.js';

export const MAX_FILES_PER_ENTRY = 40;
const KIND = { photo: 0, work: 1 };
const PHOTO_MIMES = new Set(['image/webp', 'image/jpeg', 'image/png']);
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
// Stored/served mime per allowed work extension.
const WORK_MIME = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: PPTX_MIME
};
// What file-type may report for each extension. A pptx is a zip container and is
// often reported as plain application/zip; an old .ppt is a CFB (OLE) container.
const SNIFFED_AS = {
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  ppt: ['application/x-cfb'],
  pptx: [PPTX_MIME, 'application/zip']
};

const badType = () => httpError(415, 'bad_type', 'ไม่รองรับไฟล์ประเภทนี้');
const tooLarge = () => httpError(413, 'too_large', 'ไฟล์มีขนาดใหญ่เกินกำหนด');
const badRequest = (message = 'ข้อมูลไม่ถูกต้อง') => httpError(400, 'bad_request', message);

export const extOf = (name) => {
  const i = String(name).lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i + 1).toLowerCase();
};

export const cleanName = (name) =>
  path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'file';

// Shared by files.js and video.js: valid key, before the deadline, entry not submitted.
// Creates the university's entry rows first if they don't exist yet (files has an FK to them).
export function writableEntry(db, config, universityId, key) {
  if (!isValidEntryKey(key)) throw badRequest();
  assertBeforeDeadline(config);
  ensureRows(db, universityId);
  const row = getEntryRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked', 'ส่งผลงานแล้ว แก้ไขไม่ได้');
  return row;
}

// Stream to `dest` while hashing; never holds the whole file in memory.
async function saveStream(source, dest) {
  const hash = createHash('sha256');
  let size = 0;
  const tap = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      size += chunk.length;
      cb(null, chunk);
    }
  });
  await pipeline(source, tap, createWriteStream(dest));
  return { sha256: hash.digest('hex'), size };
}

async function checkType(kind, tmpPath, nameExt) {
  const sniffed = await fileTypeFromFile(tmpPath);
  if (!sniffed) throw badType();
  if (kind === 'photo') {
    if (!PHOTO_MIMES.has(sniffed.mime)) throw badType();
    return { ext: sniffed.ext, mime: sniffed.mime };
  }
  if (!ALLOWED_EXTENSIONS.includes(nameExt)) throw badType();
  if (!SNIFFED_AS[nameExt].includes(sniffed.mime)) throw badType();
  return { ext: nameExt, mime: WORK_MIME[nameExt] };
}

function toRef(kind, fileId, { name, size, ext, mime }) {
  const url = `/api/files/${fileId}`;
  if (kind === 'photo') return { fileId, name, size, ext, mime, dataUrl: url };
  return { id: fileId, fileId, name, size, ext, mime, status: 'done', progress: 100, url };
}

export default async function filesRoutes(app, { db, config }) {
  const uploadDir = path.resolve(config.uploadDir);
  const tmpDir = path.join(uploadDir, 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const blobPath = (sha256) => path.join(uploadDir, sha256);

  // Move the temp file to uploads/<sha256>, unless the same bytes are already stored.
  async function storeBlob(tmpPath, sha256) {
    try {
      await stat(blobPath(sha256));
    } catch {
      await rename(tmpPath, blobPath(sha256));
    }
  }

  app.post('/submissions/:key/files', {
    preHandler: app.requireCoordinator,
    schema: {
      querystring: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { type: 'string', enum: ['photo', 'work'] } }
      }
    }
  }, async (request) => {
    const { key } = request.params;
    const { kind } = request.query;
    const universityId = request.user.universityId;

    writableEntry(db, config, universityId, key);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM files WHERE university_id = ? AND entry_key = ?')
      .get(universityId, key);
    if (n >= MAX_FILES_PER_ENTRY) throw badRequest(`แนบไฟล์ได้สูงสุด ${MAX_FILES_PER_ENTRY} ไฟล์ต่อรายการ`);
    if (!request.isMultipart()) throw badRequest();

    const maxBytes = kind === 'photo' ? config.maxPhotoKB * 1024 : config.maxWorkMB * 1024 * 1024;
    const part = await request.file({ limits: { fileSize: maxBytes } });
    if (!part || part.fieldname !== 'file') throw badRequest();

    const tmpPath = path.join(tmpDir, randomBytes(16).toString('hex'));
    try {
      const { sha256, size } = await saveStream(part.file, tmpPath);
      if (part.file.truncated) throw tooLarge();
      if (size === 0) throw badRequest();
      const name = cleanName(part.filename);
      const { ext, mime } = await checkType(kind, tmpPath, extOf(name));
      await storeBlob(tmpPath, sha256);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO files (university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(universityId, key, KIND[kind], sha256, size, mime, name, request.user.id, nowSec());
      return { file: toRef(kind, Number(lastInsertRowid), { name, size, ext, mime }) };
    } finally {
      await rm(tmpPath, { force: true });
    }
  });
}
```

Note: with per-request `limits.fileSize`, `@fastify/multipart` 10 truncates the stream instead of throwing (checked with `inject`), so `part.file.truncated` is the 413 signal.

- [ ] **Step 5: Register multipart and the plugin in `src/app.js`**

Add these imports at the top of `server/src/app.js`:

```js
import multipart from '@fastify/multipart';
import filesRoutes from './files.js';
```

and, inside `buildApp`, after plan A's `app.register(submissionsRoutes, …)` line (the auth plugin is wrapped in `fastify-plugin`, so `app.requireUser` / `requireCoordinator` / `requireAdmin` are visible to these plugins):

```js
  app.register(multipart, { limits: { files: 1, fields: 5 } });
  app.register(filesRoutes, { prefix: '/api', db, config });
```

- [ ] **Step 6: Run it to see it pass**

```bash
npx vitest run test/files.test.js
```

Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add src/files.js src/app.js test/fixtures.js test/files.test.js
git commit -m "feat(server): photo and work-file uploads with type sniffing and sha256 dedupe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Download and delete files

**Files:**
- Modify: `server/src/files.js`, `server/test/files.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/test/files.test.js`:

```js
import { existsSync } from 'node:fs';
import path from 'node:path';

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
    expect(ok.headers['content-disposition']).toBe("attachment; filename*=UTF-8''w.pdf");
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
    expect((await del(b.fileId, kmutt)).statusCode).toBe(200);
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
```

(Move the two new `import` lines to the top of the file with the others.)

- [ ] **Step 2: Run it to see it fail**

```bash
npx vitest run test/files.test.js
```

Expected: FAIL, the new GET/DELETE tests get 404.

- [ ] **Step 3: Add the routes**

In `server/src/files.js`, inside `filesRoutes` after the POST route, add:

```js
  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } }
  };
  const getFileRow = (id) => {
    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    if (!row) throw httpError(404, 'not_found', 'ไม่พบข้อมูล');
    return row;
  };
  const forbidden = () => httpError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึง');

  app.get('/files/:id', { preHandler: app.requireUser, schema: { params: idParams } }, async (request, reply) => {
    const row = getFileRow(request.params.id);
    if (request.user.role !== 'admin' && row.university_id !== request.user.universityId) throw forbidden();
    const disposition = row.kind === KIND.photo ? 'inline' : 'attachment';
    reply
      .header('content-type', row.mime)
      .header('content-length', row.size)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('content-disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
    return reply.send(createReadStream(blobPath(row.sha256)));
  });

  app.delete('/files/:id', { preHandler: app.requireCoordinator, schema: { params: idParams } }, async (request) => {
    const row = getFileRow(request.params.id);
    if (row.university_id !== request.user.universityId) throw forbidden();
    writableEntry(db, config, row.university_id, row.entry_key);
    db.prepare('DELETE FROM files WHERE id = ?').run(row.id);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM files WHERE sha256 = ?').get(row.sha256);
    if (n === 0) await rm(blobPath(row.sha256), { force: true });
    return { ok: true };
  });
```

- [ ] **Step 4: Run it to see it pass**

```bash
npx vitest run test/files.test.js
```

Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/files.js test/files.test.js
git commit -m "feat(server): file download with immutable cache and refcounted delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Google Drive client (`createDrive`) with an injectable fetch

**Files:**
- Create: `server/src/drive.js`, `server/test/fakeGoogle.js`, `server/test/drive.test.js`
- Modify: `server/test/helpers.js`, `server/src/app.js`

- [ ] **Step 1: Let tests pass app options through `makeTestApp`**

In `server/test/helpers.js` change the signature and the `buildApp` call (the rest stays as plan A wrote it):

```js
export async function makeTestApp(overrides = {}, appOptions = {}) {
```

```js
  const app = buildApp({ db, config, ...appOptions });
```

- [ ] **Step 2: Add the fake Google**

`server/test/fakeGoogle.js`:

```js
import { encrypt } from '../src/crypto.js';
import { setSetting } from '../src/settings.js';

export const GOOGLE_ENV = {
  TOKEN_KEY: '11'.repeat(32),
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret'
};
export const GOOD_CODE = 'good-code';
export const REFRESH_TOKEN = 'rt-secret-123';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Pretend the admin already connected Google.
export function connectDrive(db, config, token = REFRESH_TOKEN) {
  setSetting(db, 'google.refresh_token', encrypt(token, config.tokenKey));
  setSetting(db, 'google.email', 'lead@gmail.com');
}

// In-memory stand-in for oauth2.googleapis.com and the Drive v3 endpoints we use.
export function fakeGoogle() {
  const calls = [];
  const files = new Map();
  let seq = 0;
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    calls.push({ method, url, headers, body: init.body });
    const where = url.origin + url.pathname;

    if (where === 'https://oauth2.googleapis.com/token') {
      const p = new URLSearchParams(init.body);
      if (p.get('grant_type') === 'authorization_code') {
        if (p.get('code') !== GOOD_CODE) return json(400, { error: 'invalid_grant' });
        return json(200, { access_token: 'at-code', expires_in: 3599, refresh_token: REFRESH_TOKEN, token_type: 'Bearer' });
      }
      if (p.get('refresh_token') !== REFRESH_TOKEN) return json(400, { error: 'invalid_grant' });
      return json(200, { access_token: 'at-refresh', expires_in: 3599, token_type: 'Bearer' });
    }

    if (!/^Bearer at-/.test(headers.get('authorization') || '')) return json(401, { error: { code: 401 } });

    if (where === 'https://www.googleapis.com/drive/v3/about') {
      return json(200, { user: { emailAddress: 'lead@gmail.com' },
        storageQuota: { limit: '16106127360', usage: '1048576' } });
    }
    if (where === 'https://www.googleapis.com/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(init.body);
      const id = `folder-${++seq}`;
      files.set(id, { id, name: body.name, mimeType: body.mimeType, parents: body.parents || [] });
      return json(200, { id });
    }
    if (where === 'https://www.googleapis.com/upload/drive/v3/files' && method === 'POST') {
      return new Response(null, { status: 200, headers: {
        location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fake-${++seq}` } });
    }
    const m = where.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (!files.has(id)) return json(404, { error: { code: 404, message: 'File not found' } });
      if (method === 'DELETE') {
        files.delete(id);
        return new Response(null, { status: 204 });
      }
      return json(200, { ...files.get(id), trashed: false });
    }
    return json(500, { error: `fake google: unhandled ${method} ${where}` });
  }

  const addFile = (meta) => files.set(meta.id, meta);
  const foldersNamed = (name) =>
    [...files.values()].filter(f => f.mimeType === FOLDER_MIME && f.name === name);
  return { fetch, calls, files, addFile, foldersNamed };
}
```

- [ ] **Step 3: Write the failing test**

`server/test/drive.test.js`:

```js
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
```

- [ ] **Step 4: Run it to see it fail**

```bash
npx vitest run test/drive.test.js
```

Expected: FAIL, `Cannot find module '../src/drive.js'`.

- [ ] **Step 5: Write the Drive client**

`server/src/drive.js` (Task 6 adds the routes plugin to this same file):

```js
import { httpError } from './errors.js';
import { getSetting, setSetting, deleteSetting, deleteSettingsLike } from './settings.js';
import { encrypt, decrypt, isValidTokenKey } from './crypto.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const ROOT_FOLDER_NAME = 'TTA 2027 วิดีโอ';

export const driveUnavailable = (message = 'ยังไม่ได้เชื่อมต่อ Google Drive') =>
  httpError(503, 'drive_unavailable', message);

// All Google HTTP goes through `fetch`, so tests pass a fake one.
export function createDrive({ db, config, fetch = globalThis.fetch }) {
  let cached = null;               // { token, expiresAt } — access token, memory only
  const creating = new Map();      // settings key -> Promise<folderId>, avoids duplicate folders

  const isConfigured = () =>
    !!config.google.clientId && !!config.google.clientSecret && isValidTokenKey(config.tokenKey);
  const isConnected = () => !!getSetting(db, 'google.refresh_token');

  function assertConfigured() {
    if (!isConfigured()) throw driveUnavailable('ยังไม่ได้ตั้งค่า Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / TOKEN_KEY)');
  }

  function authUrl(state) {
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state
    });
    return `${AUTH_URL}?${params}`;
  }

  async function postToken(params) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        ...params
      }).toString()
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body };
  }

  function remember(body) {
    cached = { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in || 3600) - 60) * 1000 };
  }

  async function accessToken() {
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const stored = getSetting(db, 'google.refresh_token');
    if (!stored) throw driveUnavailable();
    const { ok, body } = await postToken({ refresh_token: decrypt(stored, config.tokenKey), grant_type: 'refresh_token' });
    if (!ok) {
      if (body.error === 'invalid_grant') deleteSetting(db, 'google.refresh_token'); // revoked: admin must reconnect
      throw driveUnavailable();
    }
    remember(body);
    return cached.token;
  }

  async function call(method, url, { json, headers = {} } = {}) {
    const token = await accessToken();
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(json ? { 'content-type': 'application/json; charset=UTF-8' } : {}),
        ...headers
      },
      body: json ? JSON.stringify(json) : undefined
    });
    if (res.status === 401) cached = null;
    return res;
  }

  async function callJson(method, url, opts) {
    const res = await call(method, url, opts);
    if (!res.ok) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return res.json();
  }

  // Code from the OAuth callback -> stored (encrypted) refresh token, email and root folder.
  async function exchangeCode(code) {
    const { ok, body } = await postToken({ code, redirect_uri: config.google.redirectUri, grant_type: 'authorization_code' });
    if (!ok || !body.refresh_token) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    setSetting(db, 'google.refresh_token', encrypt(body.refresh_token, config.tokenKey));
    remember(body);
    const { email } = await getAbout();
    const previous = getSetting(db, 'google.email');
    if (previous && previous !== email) deleteSettingsLike(db, 'drive.'); // different account: old folder ids are useless
    setSetting(db, 'google.email', email || '');
    await ensureRootFolder();
  }

  async function getAbout() {
    const fields = encodeURIComponent('user(emailAddress),storageQuota(limit,usage)');
    const b = await callJson('GET', `${API}/about?fields=${fields}`);
    return {
      email: b.user?.emailAddress ?? null,
      quota: {
        limit: b.storageQuota?.limit ? Number(b.storageQuota.limit) : null,
        usage: Number(b.storageQuota?.usage ?? 0)
      }
    };
  }

  function ensureFolder(key, name, parent) {
    const existing = getSetting(db, key);
    if (existing) return Promise.resolve(existing);
    if (creating.has(key)) return creating.get(key);
    const job = (async () => {
      const { id } = await callJson('POST', `${API}/files?fields=id`, {
        json: { name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }
      });
      setSetting(db, key, id);
      return id;
    })().finally(() => creating.delete(key));
    creating.set(key, job);
    return job;
  }

  const ensureRootFolder = () => ensureFolder('drive.root_folder', ROOT_FOLDER_NAME, null);

  async function ensureUniversityFolder(code) {
    const root = await ensureRootFolder();
    return ensureFolder(`drive.folder.${code}`, code, root);
  }

  // Returns the one-time session URL the browser uploads to.
  async function createResumableSession({ name, size, mime, parent }) {
    const res = await call('POST', `${UPLOAD_URL}?uploadType=resumable&fields=id,name,size,mimeType`, {
      json: { name, mimeType: mime, parents: [parent] },
      headers: {
        'x-upload-content-type': mime,
        'x-upload-content-length': String(size),
        origin: config.appOrigin   // Drive echoes it in CORS headers for the browser's PUTs
      }
    });
    const location = res.headers.get('location');
    if (!res.ok || !location) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return location;
  }

  async function getFileMeta(id) {
    const res = await call('GET', `${API}/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents,trashed`);
    if (res.status === 404) return null;
    if (!res.ok) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return res.json();
  }

  async function deleteFile(id) {
    const res = await call('DELETE', `${API}/files/${encodeURIComponent(id)}`);
    if (!res.ok && res.status !== 404) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
  }

  return {
    isConfigured, isConnected, assertConfigured, authUrl, exchangeCode, getAbout,
    ensureRootFolder, ensureUniversityFolder, createResumableSession, getFileMeta, deleteFile
  };
}
```

- [ ] **Step 6: Create the client in `src/app.js`**

Add the import:

```js
import { createDrive } from './drive.js';
```

change the `buildApp` signature to accept the fake fetch:

```js
export function buildApp({ db, config, logger = false, googleFetch = globalThis.fetch }) {
```

and add after the `filesRoutes` line from Task 3:

```js
  const drive = createDrive({ db, config, fetch: googleFetch });
```

(`drive` is passed to the plugins in Tasks 6 and 7.)

- [ ] **Step 7: Run it to see it pass**

```bash
npx vitest run test/drive.test.js
```

Expected: PASS (6 tests). Then `npx vitest run` — all earlier suites still pass.

- [ ] **Step 8: Commit**

```bash
git add src/drive.js src/app.js test/helpers.js test/fakeGoogle.js test/drive.test.js
git commit -m "feat(server): Google Drive client over injectable fetch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin OAuth connect, callback and status

**Files:**
- Modify: `server/src/drive.js`, `server/src/app.js`
- Create: `server/test/oauth.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/oauth.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, GOOD_CODE, REFRESH_TOKEN } from './fakeGoogle.js';
import { getSetting } from '../src/settings.js';
import { decrypt } from '../src/crypto.js';
import { ROOT_FOLDER_NAME } from '../src/drive.js';

let t, google, admin;
beforeEach(async () => {
  google = fakeGoogle();
  t = await makeTestApp(GOOGLE_ENV, { googleFetch: google.fetch });
  admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
});
afterEach(() => t.app.close());

async function connect() {
  const res = await t.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: admin } });
  const state = new URL(res.headers.location).searchParams.get('state');
  const stateCookie = res.cookies.find(c => c.name === 'tta_gstate');
  return { res, state, cookie: `${admin}; tta_gstate=${stateCookie.value}` };
}
const callback = (qs, cookie) =>
  t.app.inject({ method: 'GET', url: `/api/admin/google/callback?${new URLSearchParams(qs)}`, headers: { cookie } });

describe('Google OAuth', () => {
  it('connect redirects to Google with drive.file, offline access, consent and a state', async () => {
    const { res, state } = await connect();
    expect(res.statusCode).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('client_id')).toBe(GOOGLE_ENV.GOOGLE_CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(t.config.google.redirectUri);
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is admin only', async () => {
    const kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: kmutt } });
    expect(res.statusCode).toBe(403);
  });

  it('answers 503 when Google env is not set', async () => {
    const bare = await makeTestApp({}, { googleFetch: google.fetch });
    const c = await loginAs(bare.app, 'admin1', 'pass-admin-1');
    const res = await bare.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: c } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('drive_unavailable');
    await bare.app.close();
  });

  it('rejects a state mismatch with 400 and stores nothing', async () => {
    const { cookie } = await connect();
    const res = await callback({ code: GOOD_CODE, state: 'f'.repeat(32) }, cookie);
    expect(res.statusCode).toBe(400);
    expect(getSetting(t.db, 'google.refresh_token')).toBeNull();
    const noCookie = await callback({ code: GOOD_CODE, state: 'f'.repeat(32) }, admin);
    expect(noCookie.statusCode).toBe(400);
  });

  it('callback stores the token encrypted, the email and the root folder, then redirects', async () => {
    const { state, cookie } = await connect();
    const res = await callback({ code: GOOD_CODE, state }, cookie);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${t.config.appOrigin}/admin?google=connected`);

    const stored = getSetting(t.db, 'google.refresh_token');
    expect(stored).not.toBe(REFRESH_TOKEN);
    expect(stored).not.toContain(REFRESH_TOKEN);
    expect(decrypt(stored, t.config.tokenKey)).toBe(REFRESH_TOKEN);
    expect(getSetting(t.db, 'google.email')).toBe('lead@gmail.com');
    expect(google.foldersNamed(ROOT_FOLDER_NAME)).toHaveLength(1);
    expect(getSetting(t.db, 'drive.root_folder')).toBe(google.foldersNamed(ROOT_FOLDER_NAME)[0].id);
  });

  it('a denied consent redirects with google=denied', async () => {
    const { state, cookie } = await connect();
    const res = await callback({ error: 'access_denied', state }, cookie);
    expect(res.headers.location).toBe(`${t.config.appOrigin}/admin?google=denied`);
  });

  it('status reports disconnected, then connected with quota', async () => {
    const get = () => t.app.inject({ method: 'GET', url: '/api/admin/google/status', headers: { cookie: admin } });
    expect((await get()).json()).toEqual({ connected: false, email: null, quota: null });
    connectDrive(t.db, t.config);
    expect((await get()).json()).toEqual({
      connected: true, email: 'lead@gmail.com', quota: { limit: 16106127360, usage: 1048576 }
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx vitest run test/oauth.test.js
```

Expected: FAIL, the admin routes return 404.

- [ ] **Step 3: Add the routes plugin to `drive.js`**

Add this import at the top of `server/src/drive.js`:

```js
import { randomBytes, timingSafeEqual } from 'node:crypto';
```

and append to the file:

```js
const STATE_COOKIE = 'tta_gstate';
const STATE_PATH = '/api/admin/google';

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Admin routes: /admin/google/connect | callback | status
export default async function driveRoutes(app, { db, config, drive }) {
  app.get('/admin/google/connect', { preHandler: app.requireAdmin }, async (request, reply) => {
    drive.assertConfigured();
    const state = randomBytes(16).toString('hex');
    reply.setCookie(STATE_COOKIE, state, {
      signed: true, httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: STATE_PATH, maxAge: 600
    });
    return reply.redirect(drive.authUrl(state));
  });

  app.get('/admin/google/callback', {
    preHandler: app.requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string', maxLength: 2048 },
          state: { type: 'string', maxLength: 128 },
          error: { type: 'string', maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    const { code, state, error } = request.query;
    const raw = request.cookies[STATE_COOKIE];
    const cookie = raw ? request.unsignCookie(raw) : { valid: false, value: null };
    reply.clearCookie(STATE_COOKIE, { path: STATE_PATH });
    if (!state || !cookie.valid || !sameText(cookie.value, state)) {
      throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    }
    if (error) return reply.redirect(`${config.appOrigin}/admin?google=denied`);
    if (!code) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    drive.assertConfigured();
    await drive.exchangeCode(code);
    return reply.redirect(`${config.appOrigin}/admin?google=connected`);
  });

  app.get('/admin/google/status', { preHandler: app.requireAdmin }, async () => {
    if (!drive.isConnected()) return { connected: false, email: null, quota: null };
    let quota = null;
    try {
      quota = (await drive.getAbout()).quota;
    } catch {
      // revoked token (now forgotten) or Google down: report what we know
    }
    return { connected: drive.isConnected(), email: getSetting(db, 'google.email'), quota };
  });
}
```

- [ ] **Step 4: Register it in `src/app.js`**

Change the Task 5 import to:

```js
import driveRoutes, { createDrive } from './drive.js';
```

and add after `const drive = createDrive(...)`:

```js
  app.register(driveRoutes, { prefix: '/api', db, config, drive });
```

- [ ] **Step 5: Run it to see it pass**

```bash
npx vitest run test/oauth.test.js
```

Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/drive.js src/app.js test/oauth.test.js
git commit -m "feat(server): admin Google OAuth connect, callback and status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Video routes (session, confirm, delete)

**Files:**
- Create: `server/src/video.js`, `server/test/video.test.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Write the failing test**

`server/test/video.test.js`:

```js
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
});

describe('DELETE /api/submissions/clip/video/:driveFileId', () => {
  beforeEach(() => connectDrive(t.db, t.config));
  const del = (id, cookie = kmutt) =>
    t.app.inject({ method: 'DELETE', url: `/api/submissions/clip/video/${id}`, headers: { cookie } });

  it('deletes own video while draft, refuses when submitted', async () => {
    const folder = await kmuttFolder();
    google.addFile({ id: 'vid-del-001', name: 'a.mp4', size: '1', mimeType: 'video/mp4', parents: [folder] });
    google.addFile({ id: 'vid-del-002', name: 'b.mp4', size: '1', mimeType: 'video/mp4', parents: [folder] });
    expect((await del('vid-del-001')).json()).toEqual({ ok: true });
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
```

- [ ] **Step 2: Run it to see it fail**

```bash
npx vitest run test/video.test.js
```

Expected: FAIL, routes return 404.

- [ ] **Step 3: Write `video.js`**

`server/src/video.js`:

```js
import { httpError } from './errors.js';
import { writableEntry, extOf, cleanName } from './files.js';
import { getSetting, listSettings } from './settings.js';

const CLIP_KEY = 'clip';
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);
const VIDEO_EXTS = new Set(['mp4', 'mov']);
const DRIVE_ID = '^[A-Za-z0-9_-]{10,200}$';

const badType = () => httpError(415, 'bad_type', 'ไม่รองรับไฟล์ประเภทนี้');
const tooLarge = () => httpError(413, 'too_large', 'ไฟล์มีขนาดใหญ่เกินกำหนด');
const wrongFolder = () => httpError(422, 'incomplete', 'ยังกรอกข้อมูลไม่ครบ', {
  failed: [{ key: 'video', label: 'วิดีโอ', error: 'ไฟล์วิดีโอไม่ได้อยู่ในโฟลเดอร์ของมหาวิทยาลัย กรุณาอัปโหลดใหม่' }]
});

export default async function videoRoutes(app, { db, config, drive }) {
  const maxBytes = () => config.maxVideoMB * 1024 * 1024;

  app.post('/submissions/clip/video', {
    preHandler: app.requireCoordinator,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'size', 'mime'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          size: { type: 'integer', minimum: 1 },
          mime: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (request) => {
    const { name, size, mime } = request.body;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    if (!VIDEO_MIMES.has(mime) || !VIDEO_EXTS.has(extOf(name))) throw badType();
    if (size > maxBytes()) throw tooLarge();
    const parent = await drive.ensureUniversityFolder(request.user.universityCode);
    const uploadUrl = await drive.createResumableSession({ name: cleanName(name), size, mime, parent });
    return { uploadUrl };
  });

  app.post('/submissions/clip/video/confirm', {
    preHandler: app.requireCoordinator,
    schema: {
      body: {
        type: 'object',
        required: ['driveFileId'],
        additionalProperties: false,
        properties: { driveFileId: { type: 'string', pattern: DRIVE_ID } }
      }
    }
  }, async (request) => {
    const { driveFileId } = request.body;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    const folder = await drive.ensureUniversityFolder(request.user.universityCode);
    const meta = await drive.getFileMeta(driveFileId);
    if (!meta || meta.trashed) throw httpError(404, 'not_found', 'ไม่พบข้อมูล');

    const parents = meta.parents || [];
    if (!parents.includes(folder)) {
      // Never delete a file that sits in another university's folder: the id may be theirs.
      const inOtherUniversity = listSettings(db, 'drive.folder.').some(id => parents.includes(id));
      if (!inOtherUniversity) await drive.deleteFile(driveFileId);
      throw wrongFolder();
    }
    if (!VIDEO_MIMES.has(meta.mimeType) || !VIDEO_EXTS.has(extOf(meta.name))) {
      await drive.deleteFile(driveFileId);
      throw badType();
    }
    const size = Number(meta.size);
    if (!(size > 0) || size > maxBytes()) {
      await drive.deleteFile(driveFileId);
      throw tooLarge();
    }
    return { video: { driveFileId: meta.id, name: meta.name, size, mime: meta.mimeType } };
  });

  app.delete('/submissions/clip/video/:driveFileId', {
    preHandler: app.requireCoordinator,
    schema: {
      params: {
        type: 'object',
        required: ['driveFileId'],
        properties: { driveFileId: { type: 'string', pattern: DRIVE_ID } }
      }
    }
  }, async (request) => {
    const { driveFileId } = request.params;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    const folder = getSetting(db, `drive.folder.${request.user.universityCode}`);
    const meta = await drive.getFileMeta(driveFileId);
    if (!meta) return { ok: true }; // already gone
    if (!folder || !(meta.parents || []).includes(folder)) {
      throw httpError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึง');
    }
    await drive.deleteFile(driveFileId);
    return { ok: true };
  });
}
```

- [ ] **Step 4: Register it in `src/app.js`**

Add the import:

```js
import videoRoutes from './video.js';
```

and after the `driveRoutes` line:

```js
  app.register(videoRoutes, { prefix: '/api', db, config, drive });
```

The plugin section of `buildApp` now reads (plan A's own lines omitted):

```js
  app.register(multipart, { limits: { files: 1, fields: 5 } });
  app.register(filesRoutes, { prefix: '/api', db, config });
  const drive = createDrive({ db, config, fetch: googleFetch });
  app.register(driveRoutes, { prefix: '/api', db, config, drive });
  app.register(videoRoutes, { prefix: '/api', db, config, drive });
```

- [ ] **Step 5: Run it to see it pass**

```bash
npx vitest run test/video.test.js
```

Expected: PASS (11 tests).

- [ ] **Step 6: Run the whole suite**

```bash
npx vitest run
```

Expected: every suite passes (plan A's plus settings, requirements, files, drive, oauth, video). No test makes a network call: the only `fetch` reaching Google code is `fakeGoogle().fetch`.

- [ ] **Step 7: Commit**

```bash
git add src/video.js src/app.js test/video.test.js
git commit -m "feat(server): clip video upload session, confirm and delete via Drive

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Manual end-to-end check with the real Google account (human)

**Files:**
- Modify: `server/.env.example` (document only; no real values)

- [ ] **Step 1: Document the env vars**

Make sure `server/.env.example` contains (safe example values only):

```
TOKEN_KEY=0000000000000000000000000000000000000000000000000000000000000000
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=change-me
GOOGLE_REDIRECT_URI=http://localhost:3000/api/admin/google/callback
APP_ORIGIN=http://localhost:3000
MAX_VIDEO_MB=500
```

```bash
git add .env.example
git commit -m "docs(server): Google Drive env vars in .env.example

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2 (human): Put your real values in `server/.env`, never in git**

1. Open the OAuth client JSON you downloaded from Google Cloud (it's kept outside the repo). Copy `client_id` and `client_secret` by hand into `server/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Don't copy the JSON file into the repo, and don't paste its contents into chat or into a commit.
2. Make a token key and put it in `server/.env` as `TOKEN_KEY`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Keep it: if it changes, the stored refresh token can't be decrypted and you must reconnect.
3. Check `server/.env` is ignored: `git check-ignore server/.env` must print the path. `git status` must not list it.

- [ ] **Step 3 (human): Connect Google**

1. Start the API (`cd server; npm run dev`) and the frontend (`npm run dev` in the repo root, port 3000 with the `/api` proxy).
2. Log in as an admin in the browser, then open `http://localhost:3000/api/admin/google/connect`.
3. Choose the project Gmail, allow access. You land on `http://localhost:3000/admin?google=connected`.
4. Open `http://localhost:3000/api/admin/google/status`: expect `{"connected":true,"email":"<your gmail>","quota":{...}}`.
5. In Google Drive, a folder **TTA 2027 วิดีโอ** now exists.

- [ ] **Step 4 (human): Upload a small MP4 through a resumable session (PowerShell)**

Log in as a coordinator and copy its session cookie, then:

```powershell
$base = 'http://localhost:3001/api'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod "$base/login" -Method Post -WebSession $s -ContentType 'application/json' `
  -Body '{"username":"<coordinator username>","password":"<its password>"}' | Out-Null

$file = Get-Item 'C:\path\to\small.mp4'
$body = @{ name = $file.Name; size = $file.Length; mime = 'video/mp4' } | ConvertTo-Json
$session = Invoke-RestMethod "$base/submissions/clip/video" -Method Post -WebSession $s -ContentType 'application/json' -Body $body
$session.uploadUrl

# One-shot PUT of the whole file to Google (the browser does this in 8 MB chunks)
$put = Invoke-RestMethod $session.uploadUrl -Method Put -InFile $file.FullName -ContentType 'video/mp4'
$put.id

$confirm = Invoke-RestMethod "$base/submissions/clip/video/confirm" -Method Post -WebSession $s `
  -ContentType 'application/json' -Body (@{ driveFileId = $put.id } | ConvertTo-Json)
$confirm.video
```

Expected:
- `uploadUrl` starts with `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=`.
- The PUT returns JSON with `id`.
- `confirm.video` shows `driveFileId`, `name`, `size` and `mime: video/mp4`.
- In Drive, the file is in `TTA 2027 วิดีโอ/<university code>/`.

- [ ] **Step 5 (human): Check the refusals and the delete**

1. Rename a `.txt` file to `.mp4`, start a session with `mime = 'video/mp4'`, PUT it, then confirm. Drive reports it as `text/plain` (or similar), so confirm should answer **415** and the file disappears from Drive.
2. Delete the good video:
   ```powershell
   Invoke-RestMethod "$base/submissions/clip/video/$($put.id)" -Method Delete -WebSession $s
   ```
   Expect `ok : True`. The file is gone from Drive (it goes to the Drive owner's trash).
3. Browser CORS: in plan C's UI, upload a video from `http://localhost:3000` and check that the browser console shows no CORS error on the PUT to `googleapis.com`. If it does, check the `APP_ORIGIN` env value matches the address in the browser bar exactly.
4. Revoke the app at https://myaccount.google.com/permissions, then reload `/api/admin/google/status`: expect `connected: false`. Reconnect with Step 3.

---

## Contract notes (for the plan owner)

These are additions or tensions with `2026-10-29-backend-00-contracts.md`. The plan follows the contract everywhere else.

1. **Test helper signature:** `makeTestApp(overrides = {})` gains a second argument, `appOptions`, forwarded to `buildApp`. `buildApp` gains an optional `googleFetch` (default `globalThis.fetch`). Both are backwards-compatible. Worth adding to the contract.
2. **Too many files per entry** (40) has no listed code. This plan uses **400 `bad_request`** with the Thai message `แนบไฟล์ได้สูงสุด 40 ไฟล์ต่อรายการ`. The count includes photos and work files.
3. **Confirm in the wrong folder** uses **422 `incomplete`** with `failed: [{ key: 'video', ... }]`, the only 422 code in the contract. A file in *another university's* folder is **not** deleted: deleting it would let one coordinator remove another's video by guessing its id. Only files in unknown folders are deleted.
4. **Google errors other than "not connected"** (Google down, a failed folder create) also use **503 `drive_unavailable`**, with a different Thai message, not the amendment's 500 `server_error`: it's an outside service being unavailable, and the frontend can show "try again" for it. The contract has no 502 code.
5. **Entry sanitising (plan A):** the `video` key must survive `saveDraft` sanitising, kept only when it is `null` or `{ driveFileId: string, name: string, size: number, mime: 'video/mp4'|'video/quicktime' }`. The contract lists `video` in the entry shape and in `blankData`, but doesn't say how it's sanitised. Plan A must keep it, or the requirement change in Task 2 never sees a video.
6. **Photo mime list:** the contract's `PhotoRef` has `mime`. This plan also accepts `image/png` (task brief). `photo.js` only produces webp or jpeg, so png is only possible from a hand-made request.
7. **`DEADLINE` override in tests:** Task 3 uses `makeTestApp({ DEADLINE: '2000-01-01T00:00:00Z' })`, relying on `loadConfig` reading `env.DEADLINE` as the contract says.
