# Backend D: Admin, Export and Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins an overview of all 10 universities × 17 entries, entry detail with unlock, a members CSV that opens in Excel with correct Thai, a per-category zip of photos and work files, and a Google Drive status card. Then ship the API and the built frontend as one process (Docker or bare Node) with health checks, daily backups, a load test, a restore drill and a go-live checklist.

**Architecture:** One more Fastify route plugin, `server/src/admin.js`, uses `entries.js` (`listEntries`, `ensureRows`, `unlockEntry`) and two pure helpers: `server/src/csv.js` (CSV text) and `buildZipPlan` (the list of zip entries, which `archiver` then streams). `server/src/static.js` serves `dist/` with an SPA fallback when `config.serveStatic` is true, so production is a single Node process behind Caddy or nginx. The frontend gets `src/components/admin/*` and an `/admin` route that only admins can open.

**Tech Stack:** Node ≥ 22.13 (`node:sqlite`), Fastify 5, `archiver@8.0.0` (ESM, `ZipArchive`), `@fastify/static@10.1.8` (Fastify 5.x), vitest, `yauzl@3.4.0` (tests read the zip), `autocannon@8.0.0` (load test), React 18 + react-router 7, Docker (`node:22-alpine`), systemd, and Caddy or nginx.

**Binding inputs:** `docs/superpowers/plans/2026-10-29-backend-00-contracts.md`, including its "Amendments from plan A". Plans A, B and C are merged into branch `backend` before this plan starts. Names from them that this plan uses:
- `entries.js`: `allEntryKeys`, `isValidEntryKey`, `listEntries`, `getEntryRow`, `rowToEntry`, `saveDraft`, `nowSec`, `ensureRows`
- `errors.js`: `httpError`, `notFoundHandler`
- `db.js`: `openDb`
- `app.js`: `buildApp`
- `test/helpers.js`: `makeTestApp(overrides, appOptions)`, `loginAs`. No test in this plan touches Google. If one is added that hits `/api/admin/google/status`, pass the fake from `test/fakeGoogle.js` as `appOptions.googleFetch`.
- `app.js`: `buildApp({ db, config, logger, googleFetch })`. Uploads live at `<uploadDir>/<sha256>`, with in-progress uploads in `<uploadDir>/tmp/` (plan B). Zip Drive links come from `entry.video.driveFileId`.
- `app.requireAdmin`
- frontend `src/api.js` → `api`
- `usePortal()` → `user`, `logout`, `showToast`

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `server/src/config.js` | modify | adds `serveStatic` and `staticDir` |
| `server/.env.example` | modify | documents the new variables plus `HOST` and `BACKUP_DIR` |
| `server/src/entries.js` | modify | adds `unlockEntry(db, universityId, key)` |
| `server/src/csv.js` | create | `CSV_HEADERS`, `csvCell`, `buildMembersCsv(rows)` |
| `server/src/admin.js` | create | `/api/admin/overview`, `/submissions/:universityId/:key`, `/unlock`, `/export.csv`, `/files.zip`; exports `collectMemberRows` and `buildZipPlan` |
| `server/src/health.js` | create | `GET /api/health` (public) |
| `server/src/static.js` | create | `registerStatic(app, config)`, `spaNotFoundHandler(config)` |
| `server/src/app.js` | modify | registers admin, health and static |
| `server/scripts/backup.js` | create | `runBackup({...})`: SQLite snapshot, incremental uploads copy, keeps 14 days |
| `server/scripts/loadtest.js` | create | self-contained autocannon run: 50 concurrent PUT saves |
| `server/test/unlock.test.js`, `csv.test.js`, `admin.test.js`, `zip.test.js`, `health-static.test.js`, `backup.test.js`, `config-deploy.test.js` | create | tests |
| `server/Dockerfile` | create | two stages: frontend build, then the API image (non-root) |
| `.dockerignore` | modify | keeps server data, secrets and node_modules out of the build context |
| `docker-compose.yml` (repo root) | create | `api` service, `portal-data` volume, `./backups` bind |
| `server/deploy/tta-api.service` | create | systemd unit for bare Node (Scenario B) |
| `server/deploy/tta-backup.service`, `server/deploy/tta-backup.timer` | create | daily backup on bare Node |
| `server/deploy/Caddyfile.example`, `server/deploy/nginx.conf.example` | create | HTTPS reverse proxy |
| `src/components/admin/StatusChip.jsx` | create | status chip (same colours as History) |
| `src/components/admin/DriveCard.jsx` | create | Google Drive status and connect |
| `src/components/admin/EntryDetailModal.jsx` | create | members, files and links, plus an unlock button with an in-page confirm |
| `src/components/admin/AdminView.jsx` | create | page: matrix, export, zip and Drive |
| `src/App.jsx` | modify | `/admin` route; admins are sent to `/admin`, coordinators away from it |
| `src/components/layout/Navbar.jsx` | modify | admins see only "ผู้ดูแลระบบ" and logout |

`dist/` is tracked in git. After every `npm run build`, run `git checkout -- dist; git clean -fq dist`. **Never commit `dist/`.**

All commands are run from the repo root unless they start with `cd server;`. Work on branch `backend`.

---

### Task 1: Dependencies and config fields

**Files:**
- Modify: `server/package.json`, `server/src/config.js`, `server/.env.example`
- Test: `server/test/config-deploy.test.js`

- [ ] **Step 1: Switch branch and install**

```powershell
git checkout backend
cd server; npm install archiver@8.0.0 @fastify/static@10.1.8; npm install -D yauzl@3.4.0 autocannon@8.0.0
cd server; npm pkg set "scripts.backup=node scripts/backup.js" "scripts.loadtest=node scripts/loadtest.js"
```
Expected: `server/package.json` lists `archiver` and `@fastify/static` under dependencies, `yauzl` and `autocannon` under devDependencies, and has the `backup` and `loadtest` scripts.

- [ ] **Step 2: Write the failing test** `server/test/config-deploy.test.js`

```js
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('deploy config', () => {
  it('serves no static files by default', () => {
    const c = loadConfig({});
    expect(c.serveStatic).toBe(false);
    expect(c.staticDir).toBe('../dist');
  });
  it('reads SERVE_STATIC and STATIC_DIR', () => {
    const c = loadConfig({ SERVE_STATIC: 'true', STATIC_DIR: '/app/dist' });
    expect(c.serveStatic).toBe(true);
    expect(c.staticDir).toBe('/app/dist');
  });
});
```

- [ ] **Step 3: Run it**

Run: `cd server; npx vitest run test/config-deploy.test.js`
Expected: FAIL (`serveStatic` is `undefined`).

- [ ] **Step 4: Implement it.** In `server/src/config.js`, replace
```js
    appOrigin: env.APP_ORIGIN || 'http://localhost:3000'
  };
```
with
```js
    appOrigin: env.APP_ORIGIN || 'http://localhost:3000',
    serveStatic: env.SERVE_STATIC === 'true',          // production: serve ../dist from the API
    staticDir: env.STATIC_DIR || '../dist'             // relative to server/
  };
```
Append to `server/.env.example`:
```
# --- deploy (plan D) ---
# HOST is read by src/index.js only; 0.0.0.0 inside Docker
HOST=127.0.0.1
# true in production: the API also serves the built frontend (dist/)
SERVE_STATIC=false
STATIC_DIR=../dist
# where scripts/backup.js writes (relative to server/)
BACKUP_DIR=backups
```
Append `backups/` to `server/.gitignore` (create the file with that one line if it doesn't exist).

- [ ] **Step 5: Run it**

Run: `cd server; npx vitest run test/config-deploy.test.js test/config.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/package.json server/package-lock.json server/src/config.js server/.env.example server/.gitignore server/test/config-deploy.test.js
git commit -m "chore(server): admin/deploy deps and static config" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `unlockEntry`

**Files:**
- Modify: `server/src/entries.js`
- Test: `server/test/unlock.test.js`

- [ ] **Step 1: Write the failing test** `server/test/unlock.test.js`

```js
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp } from './helpers.js';
import { listEntries, saveDraft, unlockEntry } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function forceSubmitted(db, universityId, key) {
  db.prepare("UPDATE submissions SET status = 2, submitted_at = ?, hash = 'abcdefabcdef', version = version + 1 WHERE university_id = ? AND entry_key = ?")
    .run(Math.floor(Date.now() / 1000), universityId, key);
}

describe('unlockEntry', () => {
  it('turns a submitted entry back into a draft and bumps version', async () => {
    ctx = await makeTestApp();
    const { db } = ctx;
    listEntries(db, 1);
    saveDraft(db, 1, 'singing', { projectName: 'เพลง' }, 1);
    forceSubmitted(db, 1, 'singing');
    const before = listEntries(db, 1).singing;
    expect(before.status).toBe('submitted');

    const entry = unlockEntry(db, 1, 'singing');
    expect(entry.status).toBe('draft');
    expect(entry.hash).toBeNull();
    expect(entry.submittedAt).toBeNull();
    expect(entry.version).toBe(before.version + 1);
    expect(entry.projectName).toBe('เพลง');

    const again = saveDraft(db, 1, 'singing', { projectName: 'แก้แล้ว' }, entry.version);
    expect(again.projectName).toBe('แก้แล้ว');
  });

  it('leaves a draft unchanged', async () => {
    ctx = await makeTestApp();
    listEntries(ctx.db, 1);
    const saved = saveDraft(ctx.db, 1, 'clip', { projectName: 'x' }, 1);
    const entry = unlockEntry(ctx.db, 1, 'clip');
    expect(entry.status).toBe('draft');
    expect(entry.version).toBe(saved.version);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/unlock.test.js`
Expected: FAIL (`unlockEntry` is not exported).

- [ ] **Step 3: Implement it.** Append to `server/src/entries.js` (it already imports `httpError` and defines `nowSec` and `ensureRows`):

```js
// Admin only: a submitted entry goes back to draft. The version is bumped so a coordinator tab
// still holding the submitted copy reloads before it can save.
export function unlockEntry(db, universityId, key) {
  ensureRows(db, universityId);
  const row = getEntryRow(db, universityId, key);
  if (!row) throw httpError(404, 'not_found');
  if (row.status === 2) {
    db.prepare(`
      UPDATE submissions SET status = 1, submitted_at = NULL, hash = NULL, draft_at = ?, version = version + 1
      WHERE university_id = ? AND entry_key = ? AND status = 2`
    ).run(nowSec(), universityId, key);
  }
  return rowToEntry(getEntryRow(db, universityId, key));
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/unlock.test.js test/entries-write.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/entries.js server/test/unlock.test.js
git commit -m "feat(server): unlockEntry for admins" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CSV builder

**Files:**
- Create: `server/src/csv.js`
- Test: `server/test/csv.test.js`

- [ ] **Step 1: Write the failing test** `server/test/csv.test.js`

```js
import { describe, it, expect } from 'vitest';
import { buildMembersCsv, csvCell, CSV_HEADERS } from '../src/csv.js';

describe('csvCell', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=1+2')).toBe("'=1+2");
    expect(csvCell('+66812345678')).toBe("'+66812345678");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe('buildMembersCsv', () => {
  it('starts with a BOM and the Thai header, CRLF line ends, one line per row', () => {
    const csv = buildMembersCsv([
      { university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', type: 'สอนทฤษฎี', subType: 'กลุ่มสาขาวิชาไฟฟ้า', status: 'ส่งแล้ว', role: 'อาจารย์', leader: '', title: 'ดร.', fullName: 'สมชาย ใจดี', dept: 'ไฟฟ้า', studentId: '', year: '', email: 'a@x.th', phone: '0812345678', photoUrl: '', submittedAt: '2026-11-04 10:15:00', hash: 'abcdefabcdef' }
    ]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    expect(lines[1]).toContain('สมชาย ใจดี');
    expect(lines.length).toBe(3); // header, 1 row, trailing empty string
  });
  it('has the 16 agreed headers', () => {
    expect(CSV_HEADERS).toEqual([
      'มหาวิทยาลัย', 'ประเภท', 'กลุ่มสาขาวิชา/ประเภทย่อย', 'สถานะ', 'บทบาท(อาจารย์/ผู้แข่งขัน)', 'หัวหน้าทีม',
      'คำนำหน้า', 'ชื่อ-นามสกุล', 'หน่วยงาน', 'รหัสนักศึกษา', 'ชั้นปี', 'อีเมล', 'เบอร์โทร', 'ลิงก์รูปถ่าย', 'ส่งเมื่อ', 'รหัสอ้างอิง'
    ]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/csv.test.js`
Expected: FAIL (cannot find `../src/csv.js`).

- [ ] **Step 3: Implement** `server/src/csv.js`

```js
// Members CSV for the organisers: RFC 4180, UTF-8 with BOM (Excel reads Thai), CRLF line ends.
export const CSV_HEADERS = [
  'มหาวิทยาลัย', 'ประเภท', 'กลุ่มสาขาวิชา/ประเภทย่อย', 'สถานะ', 'บทบาท(อาจารย์/ผู้แข่งขัน)', 'หัวหน้าทีม',
  'คำนำหน้า', 'ชื่อ-นามสกุล', 'หน่วยงาน', 'รหัสนักศึกษา', 'ชั้นปี', 'อีเมล', 'เบอร์โทร', 'ลิงก์รูปถ่าย', 'ส่งเมื่อ', 'รหัสอ้างอิง'
];

const FIELDS = [
  'university', 'type', 'subType', 'status', 'role', 'leader',
  'title', 'fullName', 'dept', 'studentId', 'year', 'email', 'phone', 'photoUrl', 'submittedAt', 'hash'
];

// A cell that starts with = + - @ (or tab / CR) can run as a formula in Excel or Sheets:
// prefix it with ' so it is shown as text (OWASP CSV injection guidance).
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: flat member rows with the FIELDS keys (see collectMemberRows in admin.js)
export function buildMembersCsv(rows) {
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const row of rows) lines.push(FIELDS.map(f => csvCell(row[f])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/csv.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add server/src/csv.js server/test/csv.test.js
git commit -m "feat(server): members CSV builder with BOM and formula guard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin routes (overview, detail, unlock, CSV, zip)

**Files:**
- Create: `server/src/admin.js`
- Modify: `server/src/app.js`
- Test: `server/test/admin.test.js`, `server/test/zip.test.js`

- [ ] **Step 1: Write the failing test** `server/test/admin.test.js`

```js
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { listEntries, saveDraft } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

const advisor = { id: 'a1', type: 'advisor', title: 'ดร.', fullName: 'สมชาย ใจดี', dept: 'วิศวกรรมไฟฟ้า', university: 'มจธ.', email: 'somchai@kmutt.ac.th', phone: '0812345678', source: 'manual', photo: null };
const student = { id: 's1', type: 'student', title: 'นาย', fullName: '=1+2', dept: 'ครุศาสตร์, ไฟฟ้า', university: 'มจธ.', studentId: '6401234567', year: '3', email: 's@kmutt.ac.th', phone: '0899999999', isLeader: true, source: 'manual', photo: null };

function seedEntries(db) {
  listEntries(db, 1);
  listEntries(db, 2);
  saveDraft(db, 1, 'theory.g0', { projectName: 'โครงการ', members: [advisor, student] }, 1);
  saveDraft(db, 2, 'singing', { members: [{ ...advisor, id: 'a2', fullName: 'สมหญิง ร้องดี' }] }, 1);
  db.prepare("UPDATE submissions SET status = 2, submitted_at = ?, hash = 'abcdefabcdef', version = version + 1 WHERE university_id = 1 AND entry_key = 'theory.g0'")
    .run(Math.floor(Date.parse('2026-11-04T03:15:00Z') / 1000));
}

const ADMIN_ROUTES = [
  ['GET', '/api/admin/overview'],
  ['GET', '/api/admin/submissions/1/theory.g0'],
  ['POST', '/api/admin/submissions/1/theory.g0/unlock'],
  ['GET', '/api/admin/export.csv'],
  ['GET', '/api/admin/files.zip?key=theory']
];

describe('admin access', () => {
  it('gives 403 forbidden to coordinators on every admin route', async () => {
    ctx = await makeTestApp();
    const cookie = await loginAs(ctx.app, 'kmutt', 'pass-kmutt-1');
    for (const [method, url] of ADMIN_ROUTES) {
      const res = await ctx.app.inject({ method, url, headers: { cookie }, payload: method === 'POST' ? {} : undefined });
      expect(res.statusCode, url).toBe(403);
      expect(res.json().error).toBe('forbidden');
    }
  });
  it('gives 401 without a session', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/overview' });
    expect(res.statusCode).toBe(401);
  });
});

describe('admin overview and detail', () => {
  it('lists every university with all 17 keys', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/overview', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.universities.map(u => u.code)).toEqual(['kmutt', 'rmutt']);
    expect(Object.keys(body.entries['1'])).toHaveLength(17);
    expect(body.entries['1']['theory.g0']).toEqual({ status: 'submitted', submittedAt: '2026-11-04T03:15:00.000Z' });
    expect(body.entries['2'].singing.status).toBe('draft');
    expect(body.entries['2'].clip).toEqual({ status: 'not_started', submittedAt: null });
  });

  it('returns one entry, 404 for an unknown university, 400 for a bad key', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const ok = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/1/theory.g0', headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().entry.members).toHaveLength(2);
    const missing = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/99/theory.g0', headers: { cookie } });
    expect(missing.statusCode).toBe(404);
    const bad = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/1/theory', headers: { cookie } });
    expect(bad.statusCode).toBe(400);
  });
});

describe('admin unlock', () => {
  it('returns a draft and lets the coordinator save again', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const coord = await loginAs(ctx.app, 'kmutt', 'pass-kmutt-1');
    const admin = await loginAs(ctx.app, 'admin1', 'pass-admin-1');

    const locked = await ctx.app.inject({ method: 'PUT', url: '/api/submissions/theory.g0', headers: { cookie: coord }, payload: { data: { projectName: 'x' }, version: 3 } });
    expect(locked.statusCode).toBe(423);

    const res = await ctx.app.inject({ method: 'POST', url: '/api/admin/submissions/1/theory.g0/unlock', headers: { cookie: admin }, payload: {} });
    expect(res.statusCode).toBe(200);
    const { entry } = res.json();
    expect(entry.status).toBe('draft');
    expect(entry.hash).toBeNull();

    const saved = await ctx.app.inject({ method: 'PUT', url: '/api/submissions/theory.g0', headers: { cookie: coord }, payload: { data: { projectName: 'แก้หลังปลดล็อก', members: [advisor, student] }, version: entry.version } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().entry.projectName).toBe('แก้หลังปลดล็อก');
  });
});

describe('admin export.csv', () => {
  it('has BOM, Thai text, escaped formulas and one row per member', async () => {
    ctx = await makeTestApp({ APP_ORIGIN: 'https://portal.example.ac.th' });
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/export.csv', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="tta-members-\d{8}\.csv"/);
    expect([...res.rawPayload.subarray(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);

    const text = res.rawPayload.toString('utf8').slice(1);
    const lines = text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1 + 3); // header + 3 members
    expect(lines[1].startsWith('มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี,สอนทฤษฎี,กลุ่มสาขาวิชาไฟฟ้า,ส่งแล้ว,อาจารย์,')).toBe(true);
    expect(lines[1]).toContain(',2026-11-04 10:15:00,abcdefabcdef');
    expect(lines[2]).toContain(",ผู้แข่งขัน,ใช่,นาย,'=1+2,\"ครุศาสตร์, ไฟฟ้า\",6401234567,3,");
    expect(lines[3]).toContain('มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี,การแข่งขันศิลปวัฒนธรรม,ร้องเพลงลูกทุ่ง,ฉบับร่าง,อาจารย์');
  });
});
```

- [ ] **Step 2: Write the failing zip test** `server/test/zip.test.js`

```js
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
```

- [ ] **Step 3: Run them**

Run: `cd server; npx vitest run test/admin.test.js test/zip.test.js`
Expected: FAIL (404s, because no admin routes exist yet).

- [ ] **Step 4: Implement** `server/src/admin.js`

```js
import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { getTrack, parseEntryKey } from '../../src/data/tracks.js';
import { httpError } from './errors.js';
import { allEntryKeys, isValidEntryKey, listEntries, unlockEntry } from './entries.js';
import { buildMembersCsv } from './csv.js';

const STATUS_TH = { submitted: 'ส่งแล้ว', draft: 'ฉบับร่าง', not_started: 'ยังไม่เริ่ม' };

const MIME_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

// Uploads are content-addressed: <uploadDir>/<sha256> (plan B)
export const storedFilePath = (config, sha256) => path.resolve(config.uploadDir, sha256);

// Epoch/ISO → "YYYY-MM-DD HH:mm:ss" in Thai time, which Excel reads as a date
const bangkokTime = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }) : '');

const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 100) || 'file';

function uniqueName(used, wanted) {
  if (!used.has(wanted)) { used.add(wanted); return wanted; }
  const dot = wanted.lastIndexOf('.');
  const [base, ext] = dot > wanted.lastIndexOf('/') ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const name = `${base}-${n}${ext}`;
  used.add(name);
  return name;
}

function listUniversities(db) {
  return db.prepare('SELECT id, code, name FROM universities ORDER BY id').all().map(u => ({ id: u.id, code: u.code, name: u.name }));
}

function findUniversity(db, rawId) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) throw httpError(400, 'bad_request');
  const u = db.prepare('SELECT id, code, name FROM universities WHERE id = ?').get(id);
  if (!u) throw httpError(404, 'not_found');
  return { id: u.id, code: u.code, name: u.name };
}

function checkKey(key) {
  if (!isValidEntryKey(key)) throw httpError(400, 'bad_request');
  return key;
}

// One flat row per member, in university → TRACKS order → member order
export function collectMemberRows(db, config) {
  const rows = [];
  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    for (const key of allEntryKeys()) {
      const entry = entries[key];
      const track = getTrack(key);
      const { groupIdx } = parseEntryKey(key);
      const type = track.category || track.full;
      const subType = groupIdx != null ? track.subjectGroups[groupIdx] : (track.category ? track.th : '');
      for (const m of entry.members || []) {
        rows.push({
          university: uni.name,
          type,
          subType,
          status: STATUS_TH[entry.status] || entry.status,
          role: m.type === 'advisor' ? 'อาจารย์' : 'ผู้แข่งขัน',
          leader: m.isLeader ? 'ใช่' : '',
          title: m.title,
          fullName: m.fullName,
          dept: m.dept,
          studentId: m.type === 'student' ? m.studentId : '',
          year: m.type === 'student' ? m.year : '',
          email: m.email,
          phone: m.phone,
          photoUrl: m.photo?.fileId ? `${config.appOrigin}/api/files/${m.photo.fileId}` : '',
          submittedAt: bangkokTime(entry.submittedAt),
          hash: entry.hash || ''
        });
      }
    }
  }
  return rows;
}

// Items for the zip of one track: { name, file } (path on disk) or { name, text }
export function buildZipPlan(db, config, trackId) {
  const keys = allEntryKeys().filter(k => parseEntryKey(k).trackId === trackId);
  if (!keys.length) throw httpError(400, 'bad_request');
  const fileRow = db.prepare('SELECT id, sha256, mime, original_name FROM files WHERE id = ? AND university_id = ? AND entry_key = ?');
  const items = [];
  const missing = [];

  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    for (const key of keys) {
      const entry = entries[key];
      const base = `${uni.code}/${key}`;
      const used = new Set();

      const add = (fileId, folder, makeName) => {
        const row = fileRow.get(Number(fileId), uni.id, key);
        if (!row) { missing.push(`${base}: fileId ${fileId} (ไม่พบในฐานข้อมูล)`); return; }
        const abs = storedFilePath(config, row.sha256);
        if (!fs.existsSync(abs)) { missing.push(`${base}: ${row.original_name} (ไม่พบไฟล์บนดิสก์)`); return; }
        const ext = MIME_EXT[row.mime] || path.extname(row.original_name).slice(1) || 'bin';
        items.push({ name: uniqueName(used, `${base}/${folder}/${makeName(row, ext)}`), file: abs });
      };

      (entry.members || []).forEach((m, i) => {
        if (m.photo?.fileId) add(m.photo.fileId, 'photos', (_row, ext) => `${String(i + 1).padStart(2, '0')}-${safeName(m.fullName || m.id)}.${ext}`);
      });
      (entry.files || []).forEach(f => add(f.fileId, 'files', (row) => safeName(row.original_name)));

      if (getTrack(key).id === 'clip') {
        const lines = [];
        if (entry.video?.driveFileId) lines.push(`Google Drive: https://drive.google.com/file/d/${entry.video.driveFileId}/view  (${entry.video.name})`);
        if (entry.links?.video) lines.push(`YouTube: ${entry.links.video}`);
        if (lines.length) items.push({ name: `${base}/links.txt`, text: lines.join('\r\n') + '\r\n' });
      }
    }
  }
  if (missing.length) items.push({ name: '_missing.txt', text: missing.join('\r\n') + '\r\n' });
  return items;
}

export default async function adminPlugin(app, { db, config }) {
  const pre = { preHandler: app.requireAdmin };

  app.get('/api/admin/overview', pre, async () => {
    const universities = listUniversities(db);
    const entries = {};
    for (const uni of universities) {
      const list = listEntries(db, uni.id);
      entries[uni.id] = Object.fromEntries(
        Object.entries(list).map(([key, e]) => [key, { status: e.status, submittedAt: e.submittedAt }])
      );
    }
    return { universities, entries };
  });

  app.get('/api/admin/submissions/:universityId/:key', pre, async (request) => {
    const uni = findUniversity(db, request.params.universityId);
    const key = checkKey(request.params.key);
    return { entry: listEntries(db, uni.id)[key] };
  });

  app.post('/api/admin/submissions/:universityId/:key/unlock', pre, async (request) => {
    const uni = findUniversity(db, request.params.universityId);
    const key = checkKey(request.params.key);
    const entry = unlockEntry(db, uni.id, key);
    request.log.info({ admin: request.user.username, universityId: uni.id, key }, 'entry unlocked');
    return { entry };
  });

  app.get('/api/admin/export.csv', pre, async (request, reply) => {
    const csv = buildMembersCsv(collectMemberRows(db, config));
    const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-members-${stamp}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });

  app.get('/api/admin/files.zip', pre, async (request, reply) => {
    const trackId = String(request.query.key || '');
    const items = buildZipPlan(db, config, trackId);
    // Photos, PDFs and zips are already compressed: level 1 keeps CPU low
    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.on('warning', err => request.log.warn(err));
    archive.on('error', err => request.log.error(err));
    for (const item of items) {
      if (item.file) archive.file(item.file, { name: item.name });
      else archive.append(item.text, { name: item.name });
    }
    Promise.resolve(archive.finalize()).catch(err => request.log.error(err));
    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="tta-${trackId}.zip"`)
      .header('Cache-Control', 'no-store');
    return reply.send(archive);
  });
}
```

Register it in `server/src/app.js`. Add the import below `import submissionsPlugin from './submissions.js';`:
```js
import adminPlugin from './admin.js';
```
Add below `app.register(submissionsPlugin, { db, config });`:
```js
  app.register(adminPlugin, { db, config });
```

- [ ] **Step 5: Run them**

Run: `cd server; npx vitest run test/admin.test.js test/zip.test.js`
Expected: PASS (admin 6 tests, zip 4 tests).

If the Thai photo name in the zip comes back garbled, `archiver` did not set the UTF-8 flag. Don't work around it in the test; check that `yauzl` was called with its default `decodeStrings: true`.

- [ ] **Step 6: Run the whole suite**

Run: `cd server; npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add server/src/admin.js server/src/app.js server/test/admin.test.js server/test/zip.test.js
git commit -m "feat(server): admin overview, detail, unlock, CSV export and files zip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Health route and static frontend (one process)

**Files:**
- Create: `server/src/health.js`, `server/src/static.js`
- Modify: `server/src/app.js`
- Test: `server/test/health-static.test.js`

- [ ] **Step 1: Write the failing test** `server/test/health-static.test.js`

```js
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestApp } from './helpers.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function fakeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbCd1234.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'assets', 'ttaa13-logo.png'), 'png');
  return dir;
}

describe('GET /api/health', () => {
  it('is public and reports ok', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe('static frontend', () => {
  it('is off by default: unknown paths give JSON 404', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/dashboard' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('serves index.html for SPA routes, assets with cache headers, JSON 404 under /api', async () => {
    ctx = await makeTestApp({ SERVE_STATIC: 'true', STATIC_DIR: fakeDist() });
    const page = await ctx.app.inject({ method: 'GET', url: '/admin' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.body).toContain('id="root"');
    expect(page.headers['cache-control']).toBe('no-cache');

    const root = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(root.body).toContain('id="root"');

    const js = await ctx.app.inject({ method: 'GET', url: '/assets/index-AbCd1234.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const logo = await ctx.app.inject({ method: 'GET', url: '/assets/ttaa13-logo.png' });
    expect(logo.headers['cache-control']).toBe('public, max-age=3600');

    const api = await ctx.app.inject({ method: 'GET', url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error).toBe('not_found');

    const post = await ctx.app.inject({ method: 'POST', url: '/somewhere', payload: {} });
    expect(post.statusCode).toBe(404);
    expect(post.json().error).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/health-static.test.js`
Expected: FAIL (`/api/health` is 404, and `/admin` is a JSON 404).

- [ ] **Step 3: Implement** `server/src/health.js`

```js
// Public liveness + DB check for Docker HEALTHCHECK, systemd checks and uptime monitors
export default async function healthPlugin(app, { db }) {
  app.get('/api/health', async () => {
    db.prepare('SELECT 1').get();
    return { ok: true, time: new Date().toISOString() };
  });
}
```

`server/src/static.js`:
```js
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { notFoundHandler } from './errors.js';

// Vite build output: hashed names such as index-AbCd1234.js never change → cache forever
const HASHED = /-[A-Za-z0-9_-]{8}\.(js|css|woff2?|png|jpe?g|svg|webp)$/;

export function registerStatic(app, config) {
  if (!config.serveStatic) return;
  app.register(fastifyStatic, {
    root: path.resolve(config.staticDir),
    prefix: '/',
    wildcard: false,
    cacheControl: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      else if (HASHED.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  });
}

// SPA fallback: GET/HEAD for a page → index.html; everything under /api, or any other method → JSON 404
export function spaNotFoundHandler(config) {
  return function handler(request, reply) {
    const isPage = config.serveStatic
      && (request.method === 'GET' || request.method === 'HEAD')
      && !request.url.startsWith('/api');
    if (!isPage) return notFoundHandler(request, reply);
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  };
}
```

Edit `server/src/app.js`:
1. Add the imports below `import adminPlugin from './admin.js';`:
```js
import healthPlugin from './health.js';
import { registerStatic, spaNotFoundHandler } from './static.js';
```
2. Replace `  app.setNotFoundHandler(notFoundHandler);` with:
```js
  app.setNotFoundHandler(spaNotFoundHandler(config));
```
3. Add below `app.register(adminPlugin, { db, config });`:
```js
  app.register(healthPlugin, { db, config });
  registerStatic(app, config);
```
If `notFoundHandler` is now unused in `app.js`, remove it from that file's `errors.js` import line.

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/health-static.test.js; npm test`
Expected: PASS (health-static has 3 tests, and the full suite passes).

- [ ] **Step 5: Commit**

```powershell
git add server/src/health.js server/src/static.js server/src/app.js server/test/health-static.test.js
git commit -m "feat(server): health route and SPA static serving behind SERVE_STATIC" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin page components

**Files:**
- Create: `src/components/admin/StatusChip.jsx`, `src/components/admin/DriveCard.jsx`, `src/components/admin/EntryDetailModal.jsx`, `src/components/admin/AdminView.jsx`

- [ ] **Step 1: `src/components/admin/StatusChip.jsx`**

```jsx
import React from 'react';
import { statusMeta } from '../../utils/formatters';

// Same colours as the History table badges
export const StatusChip = ({ status }) => {
  const meta = statusMeta(status || 'not_started', null);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px',
      fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
      background: meta.badgeBg, color: meta.badgeColor, border: meta.badgeBorder
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dotColor }} />
      <span>{meta.label}</span>
    </span>
  );
};

// Compact cell for the matrix
const SHORT = { submitted: 'ส่งแล้ว', draft: 'ร่าง', not_started: '–' };

export const StatusCell = ({ status, onClick, title }) => {
  const meta = statusMeta(status || 'not_started', null);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: '100%', minWidth: '58px', padding: '6px 4px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
        background: meta.badgeBg, color: meta.badgeColor, border: meta.badgeBorder,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dotColor }} />
      {SHORT[status] || '–'}
    </button>
  );
};
```

- [ ] **Step 2: `src/components/admin/DriveCard.jsx`**

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { GoogleDriveLogo, ArrowsClockwise } from '@phosphor-icons/react';
import { api } from '../../api';

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);

export const DriveCard = () => {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const data = await api.get('/admin/google/status');
      setState({ loading: false, error: '', data });
    } catch (err) {
      setState({ loading: false, error: err.message || 'โหลดสถานะไม่สำเร็จ', data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const limit = Number(data?.quota?.limit) || 0;
  const usage = Number(data?.quota?.usage) || 0;
  const pct = limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

  return (
    <section className="card" aria-labelledby="drive-title">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GoogleDriveLogo size={26} weight="duotone" color="var(--blue)" />
          <h2 id="drive-title" className="section-title">Google Drive (วิดีโอสื่อสร้างสรรค์)</h2>
        </div>
        <button type="button" className="btn btn-sm" onClick={load} disabled={state.loading}>
          <ArrowsClockwise size={16} /> รีเฟรช
        </button>
      </div>

      {state.loading && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด…</p>}
      {state.error && <p role="alert" style={{ color: 'var(--danger)' }}>{state.error}</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className={data.connected ? 'badge badge-blue' : 'badge badge-orange'}>
              {data.connected ? 'เชื่อมต่อแล้ว' : 'ต้องเชื่อมต่อใหม่'}
            </span>
            {data.email && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{data.email}</span>}
          </div>

          {data.connected && data.quota && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="seg-tip-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dark)' }}>
                {limit
                  ? <>ใช้ไป {gb(usage)} GB จาก {gb(limit)} GB · เหลือ <strong>{gb(Math.max(0, limit - usage))} GB</strong></>
                  : <>ใช้ไป {gb(usage)} GB (ไม่จำกัดพื้นที่)</>}
              </div>
            </div>
          )}

          <div>
            <a className={data.connected ? 'btn btn-sm' : 'btn btn-primary btn-sm'} href="/api/admin/google/connect">
              <GoogleDriveLogo size={16} /> {data.connected ? 'เชื่อมต่อบัญชีอื่น' : 'เชื่อมต่อ Google Drive'}
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
```

Before using them, check that the CSS classes exist: `grep -n "^\.badge\b\|^\.badge " src/index.css`. If there is no base `.badge` rule, drop `badge ` from the two class names and keep only `badge-blue` or `badge-orange`, plus `style={{ padding: '4px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '13px' }}`.

- [ ] **Step 3: `src/components/admin/EntryDetailModal.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import { X, LockSimpleOpen, Warning, Paperclip, YoutubeLogo, GoogleDriveLogo, UsersThree } from '@phosphor-icons/react';
import { api } from '../../api';
import { fmtDateTime, formatSize } from '../../utils/formatters';
import { StatusChip } from './StatusChip';

const th = { padding: '10px 12px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', fontSize: '14px', color: '#1B1D29', verticalAlign: 'top' };

export const EntryDetailModal = ({ university, column, onClose, onUnlocked }) => {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/admin/submissions/${university.id}/${encodeURIComponent(column.key)}`;

  useEffect(() => {
    let alive = true;
    api.get(base)
      .then(r => { if (alive) setEntry(r.entry); })
      .catch(err => { if (alive) setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); });
    return () => { alive = false; };
  }, [base]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || busy) return;
      if (confirming) setConfirming(false); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirming, onClose]);

  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post(`${base}/unlock`, {});
      setEntry(r.entry);
      setConfirming(false);
      onUnlocked(r.entry);
    } catch (err) {
      setError(err.message || 'ปลดล็อกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const members = entry?.members || [];
  const files = entry?.files || [];

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-detail-title" style={{ width: 'min(100%, 920px)' }}>
        <div className="modal-header">
          <div>
            <div id="entry-detail-title" className="modal-title">{column.title}{column.sub ? ` · ${column.sub}` : ''}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{university.name}</div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        </div>

        <div className="modal-body">
          {error && <p role="alert" style={{ color: 'var(--danger)', display: 'flex', gap: '6px', alignItems: 'center' }}><Warning size={18} /> {error}</p>}
          {!entry && !error && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด…</p>}

          {entry && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <StatusChip status={entry.status} />
                {entry.submittedAt && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>ส่งเมื่อ {fmtDateTime(entry.submittedAt)}</span>}
                {!entry.submittedAt && entry.draftAt && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>บันทึกร่างล่าสุด {fmtDateTime(entry.draftAt)}</span>}
                {entry.hash && <code style={{ background: '#EAF5FE', color: '#0A65B0', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>#{entry.hash}</code>}
              </div>

              {(entry.projectName || entry.summary) && (
                <div>
                  {entry.projectName && <div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{entry.projectName}</div>}
                  {entry.summary && <p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{entry.summary}</p>}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '8px' }}>
                  <UsersThree size={18} /> สมาชิก ({members.length})
                </div>
                {members.length === 0 ? (
                  <p style={{ color: 'var(--text-light)' }}>ยังไม่มีสมาชิก</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #ECECF1', borderRadius: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                      <thead>
                        <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1' }}>
                          <th style={th}>รูป</th><th style={th}>บทบาท</th><th style={th}>ชื่อ-นามสกุล</th>
                          <th style={th}>หน่วยงาน</th><th style={th}>รหัส / ชั้นปี</th><th style={th}>ติดต่อ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #F0F1F5' }}>
                            <td style={td}>
                              {m.photo?.dataUrl
                                ? <img src={m.photo.dataUrl} alt={m.fullName} width="44" height="44" style={{ borderRadius: '10px', objectFit: 'cover' }} />
                                : <span style={{ color: 'var(--text-light)' }}>–</span>}
                            </td>
                            <td style={td}>{m.type === 'advisor' ? 'อาจารย์' : 'ผู้แข่งขัน'}{m.isLeader ? ' · หัวหน้าทีม' : ''}</td>
                            <td style={{ ...td, fontWeight: 700 }}>{m.title} {m.fullName}</td>
                            <td style={td}>{m.dept || '–'}</td>
                            <td style={td}>{m.type === 'student' ? `${m.studentId || '–'} / ปี ${m.year || '–'}` : '–'}</td>
                            <td style={td}><div>{m.email || '–'}</div><div style={{ color: 'var(--text-muted)' }}>{m.phone}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(files.length > 0 || entry.links?.video || entry.video) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 700 }}>ไฟล์และลิงก์</div>
                  {files.map(f => (
                    <a key={f.fileId} href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <Paperclip size={16} /> {f.name} <span style={{ color: 'var(--text-muted)' }}>({formatSize(f.size)})</span>
                    </a>
                  ))}
                  {entry.video?.driveFileId && (
                    <a href={`https://drive.google.com/file/d/${entry.video.driveFileId}/view`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <GoogleDriveLogo size={16} /> เปิดใน Google Drive: {entry.video.name} ({formatSize(entry.video.size)})
                    </a>
                  )}
                  {entry.links?.video && (
                    <a href={entry.links.video} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-text)' }}>
                      <YoutubeLogo size={16} /> {entry.links.video}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>ปิด</button>
          {entry?.status === 'submitted' && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={busy}>
              <LockSimpleOpen size={18} /> ปลดล็อกให้แก้ไข
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setConfirming(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="unlock-title" style={{ width: 'min(100%, 440px)' }}>
            <div className="modal-header"><div id="unlock-title" className="modal-title">ยืนยันการปลดล็อก</div></div>
            <div className="modal-body">
              <p>
                ผลงาน <strong>{column.title}{column.sub ? ` · ${column.sub}` : ''}</strong> ของ <strong>{university.name}</strong> จะกลับเป็น
                “ฉบับร่าง” รหัสอ้างอิงเดิมจะถูกยกเลิก และผู้ประสานงานต้องกดส่งใหม่อีกครั้ง
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy} autoFocus>ยกเลิก</button>
              <button type="button" className="btn btn-danger" onClick={unlock} disabled={busy}>
                {busy ? 'กำลังปลดล็อก…' : 'ปลดล็อก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: `src/components/admin/AdminView.jsx`**

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, DownloadSimple, FileZip, ArrowsClockwise } from '@phosphor-icons/react';
import { api } from '../../api';
import { usePortal } from '../../context/PortalContext';
import { TRACKS, groupShortName } from '../../data/tracks';
import { getOverviewItems } from '../../utils/entries';
import { StatusChip, StatusCell } from './StatusChip';
import { EntryDetailModal } from './EntryDetailModal';
import { DriveCard } from './DriveCard';

// The 17 columns, in the same order and with the same labels as the dashboard
const COLUMNS = getOverviewItems({}).map(it => ({
  key: it.key,
  title: it.track.th,
  sub: it.groupLabel ? groupShortName(it.groupLabel) : ''
}));

const headCell = { padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: '#4F5366', textAlign: 'center', verticalAlign: 'bottom' };
const stickyCol = { position: 'sticky', left: 0, background: '#FFFFFF', zIndex: 1, textAlign: 'left', padding: '12px 16px', minWidth: '220px' };

export const AdminView = () => {
  const { showToast } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { university, column }
  const [zipKey, setZipKey] = useState(TRACKS[0].id);

  const load = useCallback(async () => {
    setError('');
    try {
      setOverview(await api.get('/admin/overview'));
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      showToast('เชื่อมต่อ Google Drive เรียบร้อยแล้ว');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);

  const closeDetail = useCallback(() => setSelected(null), []);

  const onUnlocked = (entry) => {
    const { university, column } = selected;
    setOverview(o => ({
      ...o,
      entries: {
        ...o.entries,
        [university.id]: { ...o.entries[university.id], [column.key]: { status: entry.status, submittedAt: entry.submittedAt } }
      }
    }));
    showToast(`ปลดล็อก ${column.title}${column.sub ? ` · ${column.sub}` : ''} ของ ${university.name} แล้ว`);
  };

  const statusOf = (uid, key) => overview?.entries?.[uid]?.[key]?.status || 'not_started';
  const submittedCount = (uid) => COLUMNS.filter(c => statusOf(uid, c.key) === 'submitted').length;
  const columnCount = (key) => (overview?.universities || []).filter(u => statusOf(u.id, key) === 'submitted').length;

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker"><ShieldCheck size={18} weight="bold" /><span>ผู้ดูแลระบบ</span></div>
          <h1 className="page-title">ภาพรวมการส่งผลงาน</h1>
          <p className="page-desc">คลิกช่องในตารางเพื่อดูรายละเอียดและปลดล็อกผลงานที่ส่งแล้ว</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={load}><ArrowsClockwise size={18} /> รีเฟรช</button>
          <a className="btn btn-primary" href="/api/admin/export.csv" download>
            <DownloadSimple size={18} weight="bold" /> ส่งออก CSV รายชื่อ
          </a>
        </div>
      </div>

      {/* Zip download */}
      <section className="card" aria-labelledby="zip-title">
        <h2 id="zip-title" className="section-title">ดาวน์โหลดไฟล์ตามประเภท (.zip)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          รูปถ่ายและไฟล์ผลงานของทุกมหาวิทยาลัย แยกโฟลเดอร์ตามมหาวิทยาลัย · สื่อสร้างสรรค์มีไฟล์ links.txt สำหรับลิงก์วิดีโอ
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="zip-key" style={{ fontWeight: 600 }}>ประเภท</label>
          <select id="zip-key" value={zipKey} onChange={(e) => setZipKey(e.target.value)} style={{ minHeight: '44px', borderRadius: '12px', padding: '0 12px', border: '1.5px solid #D5D7E0' }}>
            {TRACKS.map(t => <option key={t.id} value={t.id}>{t.th}</option>)}
          </select>
          <a className="btn" href={`/api/admin/files.zip?key=${encodeURIComponent(zipKey)}`} download>
            <FileZip size={18} /> ดาวน์โหลด .zip
          </a>
        </div>
      </section>

      {/* Matrix */}
      <section style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #ECECF1', boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #ECECF1' }}>
          <strong>สถานะ:</strong>
          <StatusChip status="submitted" /><StatusChip status="draft" /><StatusChip status="not_started" />
        </div>
        {error && <p role="alert" style={{ padding: '16px 20px', color: 'var(--danger)' }}>{error}</p>}
        {!overview && !error && <p style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>กำลังโหลด…</p>}
        {overview && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
              <thead>
                <tr style={{ background: '#FAFAFC', borderBottom: '1px solid #ECECF1' }}>
                  <th style={{ ...headCell, ...stickyCol, background: '#FAFAFC' }}>มหาวิทยาลัย</th>
                  {COLUMNS.map(c => (
                    <th key={c.key} style={headCell}>
                      <div>{c.title}</div>
                      {c.sub && <div style={{ fontWeight: 500, color: 'var(--text-light)' }}>{c.sub}</div>}
                    </th>
                  ))}
                  <th style={headCell}>ส่งแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {overview.universities.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F0F1F5' }}>
                    <th scope="row" style={{ ...stickyCol, fontWeight: 700, fontSize: '14px' }}>
                      <div>{u.name}</div>
                      <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-light)' }}>{u.code}</div>
                    </th>
                    {COLUMNS.map(c => (
                      <td key={c.key} style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <StatusCell
                          status={statusOf(u.id, c.key)}
                          title={`${u.name} · ${c.title}${c.sub ? ` · ${c.sub}` : ''}`}
                          onClick={() => setSelected({ university: u, column: c })}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{submittedCount(u.id)}/{COLUMNS.length}</td>
                  </tr>
                ))}
                <tr style={{ background: '#FAFAFC' }}>
                  <th scope="row" style={{ ...stickyCol, background: '#FAFAFC', fontSize: '13px' }}>ส่งแล้ว (มหาวิทยาลัย)</th>
                  {COLUMNS.map(c => (
                    <td key={c.key} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }}>
                      {columnCount(c.key)}/{overview.universities.length}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DriveCard />

      {selected && (
        <EntryDetailModal
          university={selected.university}
          column={selected.column}
          onClose={closeDetail}
          onUnlocked={onUnlocked}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 5: Build**

Run: `npm run build; git checkout -- dist; git clean -fq dist`
Expected: the Vite build succeeds with no unresolved imports. `git status` shows no changes under `dist/`.

- [ ] **Step 6: Commit**

```powershell
git add src/components/admin
git commit -m "feat(admin): admin overview page, entry detail with unlock, Drive card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `/admin` route and admin navbar

**Files:**
- Modify: `src/App.jsx`, `src/components/layout/Navbar.jsx`

- [ ] **Step 1: Edit `src/App.jsx`**

1. Add the import below `import { CertificatesView } from './components/certificates/CertificatesView';`:
```jsx
import { AdminView } from './components/admin/AdminView';
```
2. Replace
```jsx
function ProtectedLayout() {
  const { isAuthenticated } = usePortal();
```
with
```jsx
function ProtectedLayout() {
  const { isAuthenticated, user } = usePortal();
```
3. Replace
```jsx
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
```
with
```jsx
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admins only use the admin page; coordinator pages make no sense for them
  if (user?.role === 'admin' && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }
```
4. Add this function above `export default function App() {`:
```jsx
// Admin-only page; coordinators are sent back to their dashboard
function AdminRoute() {
  const { user } = usePortal();
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <AdminView />;
}
```
5. Add below `<Route path="/certificates" element={<CertificatesView />} />`:
```jsx
        <Route path="/admin" element={<AdminRoute />} />
```

- [ ] **Step 2: Edit `src/components/layout/Navbar.jsx`**

1. Replace
```jsx
  Certificate
} from '@phosphor-icons/react';
```
with
```jsx
  Certificate,
  ShieldCheck
} from '@phosphor-icons/react';
```
2. Replace `  const navItems = [` with:
```jsx
  const isAdmin = user.role === 'admin';
  const homePath = isAdmin ? '/admin' : '/dashboard';
  const navItems = isAdmin ? [
    { id: 'admin', path: '/admin', label: 'ผู้ดูแลระบบ', icon: ShieldCheck, isActive: location.pathname === '/admin' }
  ] : [
```
3. Replace `onClick={() => navigate('/dashboard')}` (the brand button) with `onClick={() => navigate(homePath)}`.
4. Replace `title={`${user.name} · ${user.university}`}` with `title={user.university ? `${user.name} · ${user.university}` : user.name}`.

Plan C has already removed the reset button. If any coordinator-only control (the save indicator) is still in the right-hand group, wrap it in `{!isAdmin && ( … )}` so admins see only their name and "ออกจากระบบ".

- [ ] **Step 3: Build**

Run: `npm run build; git checkout -- dist; git clean -fq dist`
Expected: success, and no `dist/` changes left.

- [ ] **Step 4: Manual browser check**

Run the API in one terminal (`cd server; npm run dev`, against a dev DB seeded by plan A's seed script) and the frontend in another (`npm run dev`, which opens http://localhost:3000). Check:
- [ ] Log in as `admin1`. You land on `/admin`, and the navbar shows only "ผู้ดูแลระบบ" plus logout.
- [ ] Typing `/dashboard` or `/history` in the address bar sends you back to `/admin`.
- [ ] The matrix has 10 rows and 17 columns (สอนทฤษฎี ×5 groups, สอนปฏิบัติ ×4, then singing … pitching). The headers match the dashboard labels, and the chip colours match the History page.
- [ ] Clicking a cell opens the detail modal, with photos loading from `/api/files/<id>`. Esc closes it, and so does a click outside.
- [ ] On a submitted entry, "ปลดล็อกให้แก้ไข" opens the in-page confirm (not a browser dialog). Confirming turns the cell to ร่าง. In a coordinator browser, that entry is editable again after reload.
- [ ] "ส่งออก CSV รายชื่อ" downloads `tta-members-YYYYMMDD.csv`. Opened by double-click in Excel, the Thai text shows correctly with one row per member.
  - Phone numbers and student IDs may lose their leading 0 in Excel's default view. Tell the organisers to use Data → From Text/CSV and set those columns to Text.
- [ ] The zip for "สอนทฤษฎี" downloads, and opens to `kmutt/theory.g0/photos/…` and `kmutt/theory.g0/files/…`. The zip for "สื่อสร้างสรรค์" has `links.txt`.
- [ ] The Drive card shows its status. "เชื่อมต่อ Google Drive" goes to Google, comes back to `/admin?google=connected`, shows the toast, and the URL is cleaned.
- [ ] Log in as `kmutt` and open `/admin`: you are redirected to `/dashboard`, and the navbar has no admin item.

- [ ] **Step 5: Commit**

```powershell
git add src/App.jsx src/components/layout/Navbar.jsx
git commit -m "feat(admin): /admin route guard and admin-only navbar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Backup script

**Files:**
- Create: `server/scripts/backup.js`
- Test: `server/test/backup.test.js`

`node:sqlite` exports a module-level `backup(sourceDb, path)` (a Promise) since Node 22.16/23.8. On this machine (Node 26), `node -e "console.log(typeof require('node:sqlite').backup)"` prints `function`. Older 22.x builds don't have it, so the script falls back to `VACUUM INTO`.

- [ ] **Step 1: Write the failing test** `server/test/backup.test.js`

```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.js';
import { runBackup } from '../scripts/backup.js';

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-bk-'));
  const dbPath = path.join(dir, 'portal.db');
  const db = openDb(dbPath);
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ.')").run();
  db.close();
  const uploadDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadDir);
  fs.writeFileSync(path.join(uploadDir, 'aaa'), 'one');
  return { dir, dbPath, uploadDir, backupDir: path.join(dir, 'backups') };
}

describe('runBackup', () => {
  it('writes a consistent DB snapshot and copies uploads incrementally', async () => {
    const s = setup();
    const first = await runBackup({ ...s, now: new Date('2026-11-04T19:00:00Z') });
    expect(path.basename(first.dest)).toBe('portal-2026-11-04T19-00-00.db');
    const copy = new DatabaseSync(first.dest);
    expect(copy.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
    expect(copy.prepare('SELECT code FROM universities').get().code).toBe('kmutt');
    copy.close();
    expect(first.copied).toBe(1);
    expect(fs.readFileSync(path.join(s.backupDir, 'uploads', 'aaa'), 'utf8')).toBe('one');

    fs.writeFileSync(path.join(s.uploadDir, 'bbb'), 'two');
    const second = await runBackup({ ...s, now: new Date('2026-11-05T19:00:00Z') });
    expect(second.copied).toBe(1); // only the new file
  });

  it('deletes DB snapshots older than keepDays', async () => {
    const s = setup();
    fs.mkdirSync(path.join(s.backupDir, 'db'), { recursive: true });
    const old = path.join(s.backupDir, 'db', 'portal-2026-10-01T00-00-00.db');
    fs.writeFileSync(old, 'x');
    const oldTime = new Date('2026-10-01T00:00:00Z');
    fs.utimesSync(old, oldTime, oldTime);
    const res = await runBackup({ ...s, keepDays: 14, now: new Date('2026-11-04T00:00:00Z') });
    expect(res.pruned).toEqual(['portal-2026-10-01T00-00-00.db']);
    expect(fs.existsSync(old)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/backup.test.js`
Expected: FAIL (cannot find `../scripts/backup.js`).

- [ ] **Step 3: Implement** `server/scripts/backup.js`

```js
// Daily backup: consistent SQLite snapshot + incremental copy of uploads/, keeps `keepDays` of DB snapshots.
// Usage (from server/): npm run backup      env: DB_PATH, UPLOAD_DIR, BACKUP_DIR (default "backups"), BACKUP_KEEP_DAYS
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sqlite from 'node:sqlite';

export async function runBackup({ dbPath, uploadDir, backupDir, keepDays = 14, now = new Date() }) {
  const dbDir = path.join(backupDir, 'db');
  const upDir = path.join(backupDir, 'uploads');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(upDir, { recursive: true });

  // 1. DB snapshot (safe while the API is running: WAL + online backup)
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const dest = path.join(dbDir, `portal-${stamp}.db`);
  if (fs.existsSync(dest)) fs.rmSync(dest);
  const src = new sqlite.DatabaseSync(dbPath);
  try {
    if (typeof sqlite.backup === 'function') await sqlite.backup(src, dest);
    else src.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    src.close();
  }

  // 2. Uploads: content-addressed (name = sha256), so copy only names not yet in the backup
  let copied = 0;
  if (fs.existsSync(uploadDir)) {
    for (const rel of fs.readdirSync(uploadDir, { recursive: true })) {
      if (rel === 'tmp' || rel.startsWith(`tmp${path.sep}`)) continue; // plan B's in-progress uploads
      const from = path.join(uploadDir, rel);
      if (!fs.statSync(from).isFile()) continue;
      const to = path.join(upDir, rel);
      if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }

  // 3. Keep `keepDays` of DB snapshots
  const cutoff = now.getTime() - keepDays * 86400000;
  const pruned = [];
  for (const name of fs.readdirSync(dbDir)) {
    if (!/^portal-.*\.db$/.test(name)) continue;
    const full = path.join(dbDir, name);
    if (full !== dest && fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full);
      pruned.push(name);
    }
  }
  return { dest, copied, pruned };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (fs.existsSync('.env')) process.loadEnvFile('.env');
  const { loadConfig } = await import('../src/config.js');
  const config = loadConfig(process.env);
  const res = await runBackup({
    dbPath: config.dbPath,
    uploadDir: config.uploadDir,
    backupDir: process.env.BACKUP_DIR || 'backups',
    keepDays: Number(process.env.BACKUP_KEEP_DAYS || 14)
  });
  console.log(`[backup] ${new Date().toISOString()} db=${res.dest} uploadsCopied=${res.copied} pruned=${res.pruned.length}`);
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/backup.test.js`
Expected: PASS (2 tests).

Then a real run: `cd server; npm run backup`
Expected: a `[backup] … db=backups/db/portal-….db uploadsCopied=N pruned=0` line.

- [ ] **Step 5: Commit**

```powershell
git add server/scripts/backup.js server/test/backup.test.js
git commit -m "feat(server): backup script with SQLite snapshot, incremental uploads, 14-day retention" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Load test (50 concurrent saves, p99 < 20 ms)

**Files:**
- Create: `server/scripts/loadtest.js`

The script is self-contained. It creates a throw-away file DB in the OS temp folder (WAL, real disk, like production) with 5 test universities and known test passwords. It starts the real app on a random port and runs autocannon with 50 connections. Each connection owns one distinct (university, entry) pair and tracks its own `version`, so a save never conflicts. It needs no secrets and touches no real data.

- [ ] **Step 1: Write** `server/scripts/loadtest.js`

```js
// Usage (from server/): npm run loadtest      Pass: p99 < 20 ms, 0 non-2xx, 0 errors
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import autocannon from 'autocannon';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { allEntryKeys } from '../src/entries.js';

const CONNECTIONS = 50;
const DURATION = Number(process.env.LOADTEST_SECONDS || 20);
const UNIS = 5;
const KEYS_PER_UNI = CONNECTIONS / UNIS; // 10

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-load-'));
const db = openDb(path.join(dir, 'portal.db'));
const addUni = db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)');
const addUser = db.prepare('INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, 0)');
for (let i = 1; i <= UNIS; i++) {
  addUni.run(i, `load${i}`, `มหาวิทยาลัยทดสอบ ${i}`);
  addUser.run(`load${i}`, bcrypt.hashSync(`load-pass-${i}`, 4), `ผู้ทดสอบ ${i}`, i);
}

const config = loadConfig({ NODE_ENV: 'test', DB_PATH: path.join(dir, 'portal.db'), UPLOAD_DIR: path.join(dir, 'uploads') });
const app = buildApp({ db, config });
await app.listen({ port: 0, host: '127.0.0.1' });
const base = `http://127.0.0.1:${app.server.address().port}`;

// Log in each university and read its starting versions
const slots = [];
const keys = allEntryKeys().slice(0, KEYS_PER_UNI);
for (let i = 1; i <= UNIS; i++) {
  const res = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: `load${i}`, password: `load-pass-${i}` }) });
  if (!res.ok) throw new Error(`login load${i}: ${res.status}`);
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('tta_session=')).split(';')[0];
  const { submissions } = await res.json();
  for (const key of keys) slots.push({ cookie, key, version: submissions[key].version });
}

let nextSlot = 0;
const result = await autocannon({
  url: base,
  connections: CONNECTIONS,
  duration: DURATION,
  requests: [{
    method: 'PUT',
    setupRequest(req, context) {
      if (context.slot == null) context.slot = slots[nextSlot++ % slots.length];
      const s = context.slot;
      return {
        ...req,
        path: `/api/submissions/${s.key}`,
        headers: { 'content-type': 'application/json', cookie: s.cookie },
        body: JSON.stringify({ data: { projectName: `load ${s.version}`, summary: 'ทดสอบโหลด '.repeat(20) }, version: s.version })
      };
    },
    onResponse(status, body, context) {
      if (status === 200) context.slot.version = JSON.parse(body).entry.version;
    }
  }]
});

await app.close();
db.close();
fs.rmSync(dir, { recursive: true, force: true });

const p99 = result.latency.p99;
console.log(autocannon.printResult(result));
console.log(`requests=${result.requests.total} p50=${result.latency.p50}ms p99=${p99}ms non2xx=${result.non2xx} errors=${result.errors} timeouts=${result.timeouts}`);
const pass = p99 < 20 && result.non2xx === 0 && result.errors === 0 && result.timeouts === 0;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
```

- [ ] **Step 2: Run it**

Run: `cd server; npm run loadtest`
Expected: the last lines show `p99=<n>ms` with n < 20, `non2xx=0 errors=0 timeouts=0`, then `PASS`.

If p99 ≥ 20 ms on the Windows dev machine (OneDrive-synced folders slow fsync), set `$env:TMP` to a non-synced folder and rerun. Whatever the dev machine shows, the binding run is the one on the staging or production server (Task 12).

- [ ] **Step 3: Commit**

```powershell
git add server/scripts/loadtest.js
git commit -m "test(server): autocannon load test for 50 concurrent saves" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docker image and compose (Scenario A)

**Files:**
- Create: `server/Dockerfile`, `docker-compose.yml`
- Modify: `.dockerignore`

The existing root `Dockerfile`, `nginx.conf` and `infra/docker-compose.yml` are the old static-only image used by `.github/workflows/deploy.yml`. Leave them unchanged. The new image is a separate file with a separate compose project name (`tta-api`).

- [ ] **Step 1: Replace `.dockerignore`** with:

```
**/node_modules
dist
.git
.github
.env*
**/.env
*.md
docs
graft
site
server/data
server/backups
server/test
```

The old root `Dockerfile` still builds after this change: it only needs `package*.json`, `index.html`, `vite.config.js`, `public` and `src`.

- [ ] **Step 2: Write `server/Dockerfile`** (build context = repo root)

```dockerfile
# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f server/Dockerfile -t tta-api .

# ---- 1. frontend build ----
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- 2. API + static ----
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    SERVE_STATIC=true \
    STATIC_DIR=/app/dist \
    DB_PATH=data/portal.db \
    UPLOAD_DIR=data/uploads \
    BACKUP_DIR=backups
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./
# Shared rules imported as ../../src/... from server/src
COPY src/data /app/src/data
COPY src/utils /app/src/utils
COPY --from=web /app/dist /app/dist
RUN mkdir -p data/uploads backups && chown -R node:node /app/server/data /app/server/backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "src/index.js"]
```

- [ ] **Step 3: Write `docker-compose.yml`** (repo root)

```yaml
name: tta-api

services:
  api:
    build:
      context: .
      dockerfile: server/Dockerfile
    image: tta-api:latest
    restart: unless-stopped
    env_file: server/.env
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      SERVE_STATIC: "true"
      STATIC_DIR: /app/dist
      DB_PATH: data/portal.db
      UPLOAD_DIR: data/uploads
      BACKUP_DIR: backups
    volumes:
      - portal-data:/app/server/data      # portal.db + uploads/
      - ./backups:/app/server/backups      # on the host, so it survives the container
    ports:
      - "127.0.0.1:3001:3001"              # only the host's reverse proxy reaches it

volumes:
  portal-data: {}
```

On the CMM droplet, where the shared Caddy runs in Docker on network `cmm_default`, remove `ports:` and add:
```yaml
    networks: [default]
networks:
  default:
    name: cmm_default
    external: true
```
Then Caddy reaches the service as `api:3001` (or `tta-api-api-1:3001`).

- [ ] **Step 4: Build and smoke-run locally** (needs Docker Desktop)

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose build
docker compose up -d
docker compose ps
curl.exe -s http://127.0.0.1:3001/api/health
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3001/admin
docker compose exec api node -e "console.log(typeof require('node:sqlite').backup)"
docker compose exec api npm run backup
docker compose down
```
Expected:
- `ps` shows `healthy` after about 10 s
- health returns `{"ok":true,…}`
- `/admin` returns `200`, served as the SPA's index.html
- `node:sqlite` prints `function` (or `undefined` on an older 22.x image, where the fallback is used)
- the backup prints a `[backup]` line, and the file appears in `./backups/db/`

`server/.env` must exist for `env_file`. For the local smoke run, copy `server/.env.example` to `server/.env`, and add `SESSION_SECRET` with 40 or more random characters.

Remove the local `backups/` folder afterwards (`Remove-Item -Recurse -Force backups`); it isn't committed.

- [ ] **Step 5: Commit**

```powershell
git add server/Dockerfile docker-compose.yml .dockerignore
git commit -m "build: single-container API image serving the built frontend" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Bare-Node files and reverse proxy (Scenario B)

**Files:**
- Create: `server/deploy/tta-api.service`, `server/deploy/tta-backup.service`, `server/deploy/tta-backup.timer`, `server/deploy/Caddyfile.example`, `server/deploy/nginx.conf.example`

Server layout for Scenario B, with everything owned by user `tta`:
```
/opt/tta/server/        server/ (with node_modules from `npm ci --omit=dev`, .env, data/, backups/)
/opt/tta/src/data/      copy of src/data
/opt/tta/src/utils/     copy of src/utils
/opt/tta/dist/          `npm run build` output (STATIC_DIR=../dist)
```

- [ ] **Step 1: `server/deploy/tta-api.service`**

```ini
[Unit]
Description=TTA Portal API (Fastify + SQLite, serves dist/)
After=network.target

[Service]
Type=simple
User=tta
Group=tta
WorkingDirectory=/opt/tta/server
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=SERVE_STATIC=true
Environment=STATIC_DIR=/opt/tta/dist
EnvironmentFile=/opt/tta/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/tta/server/data /opt/tta/server/backups

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: `server/deploy/tta-backup.service`** and **`server/deploy/tta-backup.timer`**

```ini
[Unit]
Description=TTA Portal daily backup

[Service]
Type=oneshot
User=tta
Group=tta
WorkingDirectory=/opt/tta/server
EnvironmentFile=/opt/tta/server/.env
ExecStart=/usr/bin/node scripts/backup.js
```

```ini
[Unit]
Description=Run TTA Portal backup daily at 02:00

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

On Docker hosts, use a host cron line instead:
`0 2 * * * cd /opt/tta && docker compose exec -T api npm run backup >> /var/log/tta-backup.log 2>&1`

- [ ] **Step 3: `server/deploy/Caddyfile.example`** (automatic HTTPS)

```
portal.tta.example.ac.th {
	encode zstd gzip
	request_body {
		max_size 60MB
	}
	reverse_proxy 127.0.0.1:3001
}
```
(Replace the host name and keep `max_size` ≥ `MAX_WORK_MB`. Videos go straight to Google, not through here.)

- [ ] **Step 4: `server/deploy/nginx.conf.example`** (university certificate or certbot)

```nginx
server {
    listen 80;
    server_name portal.tta.example.ac.th;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.tta.example.ac.th;

    ssl_certificate     /etc/ssl/tta/fullchain.pem;
    ssl_certificate_key /etc/ssl/tta/privkey.pem;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;      # long zip downloads
        proxy_buffering off;          # stream zips instead of buffering them
    }
}
```
Fastify runs with `trustProxy: true` (plan A), so the login rate limit sees real client IPs through `X-Forwarded-For`. Only expose port 3001 on 127.0.0.1.

- [ ] **Step 5: Commit**

```powershell
git add server/deploy
git commit -m "build: systemd units and reverse-proxy examples for bare-Node deploy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Staging/production install, accounts, load test, restore drill (manual runbook)

**Files:** none in the repo. Secrets live only on the server.

- [ ] **Step 1: Production `server/.env`** (on the server only, `chmod 600`, never committed)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | 64 random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `TOKEN_KEY` | 64 hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never change it after connecting Google**, or the stored refresh token can't be decrypted. |
| `COOKIE_SECURE` | `true` |
| `APP_ORIGIN` | `https://portal.tta.<domain>` (no trailing slash) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from the private OAuth client JSON (kept outside the repo) |
| `GOOGLE_REDIRECT_URI` | `https://portal.tta.<domain>/api/admin/google/callback`. **Also add this exact URI** in Google Cloud → Credentials → the OAuth client → Authorised redirect URIs. |
| `DEADLINE` | `2027-01-15T23:59:00+07:00`, or the date the organisers confirm |
| `MAX_PHOTO_KB` / `MAX_WORK_MB` / `MAX_VIDEO_MB` | `200` / `50` / `500` |
| `BACKUP_DIR` | `backups` |

The Docker image sets `HOST`, `SERVE_STATIC`, `STATIC_DIR`, `DB_PATH` and `UPLOAD_DIR` itself; under systemd, the unit sets them.

- [ ] **Step 2: Install**
  - **Scenario A:**
    1. `git clone` (or copy) the repo to `/opt/tta`.
    2. Put `.env` in `/opt/tta/server/.env`.
    3. Run `mkdir -p backups && sudo chown 1000:1000 backups`, then `docker compose up -d --build`.
    4. If the server can't build, build on the dev machine instead: `docker save tta-api:latest | ssh server docker load`, then `docker compose up -d`.
  - **Scenario B:**
    1. Install Node 22 (≥ 22.13).
    2. Create user `tta`.
    3. Copy the layout shown in Task 11.
    4. Run `cd /opt/tta/server && npm ci --omit=dev`.
    5. Copy the unit files to `/etc/systemd/system/`.
    6. Run `systemctl daemon-reload && systemctl enable --now tta-api tta-backup.timer`.
  - Reverse proxy: use the Caddy or nginx example from Task 11. Check `curl https://portal.tta.<domain>/api/health` from **outside** the university network.

- [ ] **Step 3: Seed the real accounts** from the private note `TeachingAcademy/data/TTA-portal-accounts.md`.

  Never copy the note into the repo or the image. Upload it to the server at `/opt/tta/private/TTA-portal-accounts.md` (`chmod 600`). The seed script reads `../../data/TTA-portal-accounts.md` relative to `server/` by default, and a path argument overrides it.
  - Docker:
    ```
    docker compose run --rm -v /opt/tta/private/TTA-portal-accounts.md:/tmp/accounts.md:ro api node scripts/seed.js /tmp/accounts.md
    docker compose restart api
    ```
    The restart clears the in-memory user cache.
  - Bare Node:
    ```
    cd /opt/tta/server && sudo -u tta node scripts/seed.js /opt/tta/private/TTA-portal-accounts.md && sudo systemctl restart tta-api
    ```
  - Afterwards, delete the note from the server: `shred -u /opt/tta/private/TTA-portal-accounts.md`.
  - Check that all 10 coordinators and `admin1`–`admin3` can log in, and that the unused admins are disabled.

- [ ] **Step 4: Connect Google Drive in production.** Log in as an admin, go to `/admin`, and press "เชื่อมต่อ Google Drive". The card should show เชื่อมต่อแล้ว and free GB.

- [ ] **Step 5: Load test on the target server.**
  - Docker: `docker compose run --rm api sh -c "npm i --no-save autocannon@8.0.0 && npm run loadtest"`. The image has no devDependencies, so autocannon is installed just for this run. bcryptjs is a runtime dependency already.
  - Bare Node: `cd /opt/tta/server && npm i --no-save autocannon@8.0.0 && npm run loadtest`.
  - Expected: `PASS` (p99 < 20 ms, 0 non-2xx, 0 errors). It uses its own temporary DB, so production data is untouched.

- [ ] **Step 6: Restore drill** (on staging, or on production before go-live)
  1. As `kmutt`, save a draft with project name `RESTORE-A`.
  2. Run a backup: `docker compose exec -T api npm run backup` (or `systemctl start tta-backup`).
  3. Change the project name to `RESTORE-B`.
  4. Stop the API, then restore the newest snapshot.
     - Docker:
       ```
       docker compose stop api
       docker run --rm -v tta-api_portal-data:/data -v /opt/tta/backups:/backups alpine sh -c 'rm -f /data/portal.db-wal /data/portal.db-shm && cp "$(ls -t /backups/db/portal-*.db | head -1)" /data/portal.db && cp -rn /backups/uploads/. /data/uploads/ && chown -R 1000:1000 /data'
       docker compose start api
       ```
     - Bare Node:
       ```
       systemctl stop tta-api
       cd /opt/tta/server && rm -f data/portal.db-wal data/portal.db-shm && cp "$(ls -t backups/db/portal-*.db | head -1)" data/portal.db && cp -rn backups/uploads/. data/uploads/ && chown -R tta:tta data
       systemctl start tta-api
       ```
  5. Expected:
     - `/api/health` is ok.
     - The entry shows `RESTORE-A`.
     - Photos still load.
     - Log in again if you're asked to.
  6. Write the date of the drill in the go-live checklist.

- [ ] **Step 7: Go-live checklist** (all must pass before sending accounts on 4 Nov)
  - [ ] Portal and Landing load over HTTPS from outside the university network (phone on mobile data)
  - [ ] University A can't read or write university B's data: tested with `curl` against `/api/submissions` and `/api/files/<B's id>` using A's cookie
  - [ ] A coordinator gets 403 on `/api/admin/overview` and is redirected away from `/admin`
  - [ ] Wrong file types and oversized files are rejected by the server
  - [ ] Submitted entries can't be edited (423), and nothing can be saved after the deadline (403 `deadline_passed`). Check the second with a temporary `DEADLINE` in the past on staging.
  - [ ] An admin unlock works, and the coordinator can resubmit
  - [ ] The CSV export opens in Excel with Thai text correct, one row per member, and no cell starting with `=` evaluated
  - [ ] The zip download for one category has the expected folders, and the clip zip has `links.txt`
  - [ ] Google Drive is connected with the production redirect URI, and a test video lands in `TTA 2027 วิดีโอ/<code>/`
  - [ ] Cookies have the `Secure` and `HttpOnly` flags (browser devtools); `SESSION_SECRET` and `TOKEN_KEY` are unique to production
  - [ ] The load test PASSes on the target server
  - [ ] The backup timer/cron ran once by itself, and the restore drill passed (date: ____)
  - [ ] Demo accounts and mock data are gone; the Landing Page login button points to the new Portal URL

---

### Task 13: Merge `backend` into `main` (only after human approval)

- [ ] **Step 1: Final verification**

```powershell
cd server; npm test
npm run build; git checkout -- dist; git clean -fq dist
git status
```
Expected: all server tests pass, the frontend builds, and the working tree is clean (no `dist/` changes).

- [ ] **Step 2: Stop and ask.** Report to the human:
  - the test results
  - the load-test numbers
  - the restore-drill result
  - the go-live checklist status

**Do not merge and do not push until the human explicitly approves.**

- [ ] **Step 3: After approval only**

```powershell
git checkout main
git merge --no-ff backend -m "Merge branch 'backend': API, uploads, admin, deploy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Push only if the human also approves the push (`git push origin main`). The existing GitHub Actions workflow still deploys the old static image; switching CI to `server/Dockerfile` is a separate, approved change.
