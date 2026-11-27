# Audit Logger & Dev Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record an evidence-grade SQLite audit log for every coordinator and admin action (including structured before/after diffs on draft saves) and expose a dedicated `/dev` web interface accessible exclusively to a new `dev` user role (`role = 2`).

**Architecture:** Migration `004_audit_logs.sql` adds the `audit_logs` table. `server/src/audit.js` provides `writeAuditLog`, `diffEntryData` (computes field, member, file, and video changes between before/after `Entry` objects), and query/CSV helpers. `server/src/users.js`, `auth.js`, and `scripts/seed.js` add the `dev` role (`role = 2`) and `app.requireDev`. Existing route plugins (`auth.js`, `submissions.js`, `files.js`, `video.js`, `admin.js`) record both successful and failed actions, and a new `server/src/dev.js` plugin + `src/components/dev/DevLogsView.jsx` powers the `/dev` log explorer while keeping logs completely hidden from `admin` and `coordinator`.

**Tech Stack:** Node.js ≥ 22.13 (`node:sqlite`), Fastify 5, React 18, React Router 7, `@phosphor-icons/react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-audit-logger-dev-role-design.md`

## Global Constraints

- **Runtime & DB:** Built-in `node:sqlite` (`DatabaseSync`), no external ORM or logger dependencies. Timestamps in SQLite are epoch seconds (`nowSec()`); timestamps in API responses are ISO strings.
- **Role separation:** `role = 0` is `'coordinator'`, `role = 1` is `'admin'`, `role = 2` is `'dev'`. `app.requireAdmin` allows ONLY `'admin'`. `app.requireDev` allows ONLY `'dev'`. Neither `admin` nor `coordinator` can call `/api/dev/*` or view `/dev`.
- **Security & privacy:** Never store plaintext passwords, session cookies, or OAuth tokens in `audit_logs`. Sanitize CSV cells through `csvCell` from `server/src/csv.js`.
- **No-op autosave suppression:** If `PUT /api/submissions/:key` receives sanitized data identical to the currently stored data (when `row.status === 1` and `diff.hasChanges === false`), still update `draft_at` / `version` as the API contract requires, or log only when `diff.hasChanges || row.status === 0`. (Specifically: if `row.status === 0` or `diff.hasChanges === true`, write a `submission.save_draft` log; if `row.status === 1` and `!diff.hasChanges`, skip inserting a duplicate log row.)
- **Never commit `dist/`:** If `npm run build` is run for verification, clean `dist/` afterwards if untracked/modified.

## Review Focus

1. **Admin trying to access `/api/dev/logs` or `/dev`:** Must receive `403 forbidden` on the API and be redirected to `/admin` on the frontend.
2. **Failed coordinator actions (`version_conflict`, `locked`, `incomplete`, `deadline_passed`, `bad_credentials`):** Must still be written to `audit_logs` with `status: 'error'` and `error_code` even though the route throws an `httpError` (so the transaction rolling back the submission write does NOT roll back the error audit log).
3. **Member photo/field edits during autosave:** `diffEntryData(before, after)` must clearly identify which member was added, removed, or edited (by member `id` and `fullName`) and which fields on that member changed, rather than dumping an unreadable blob.
4. **Seed script backward compatibility:** `parseAccounts(md)` must still pass when a markdown file only has `## Coordinators` and `## Admins` without a `## Devs` section.
5. **CSV injection in `/api/dev/logs.csv`:** Any user-supplied string (`attemptedUsername`, `summary`, `userAgent`) starting with `=`, `+`, `-`, `@` must be escaped via `csvCell`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `server/migrations/004_audit_logs.sql` | Create | `audit_logs` table and indexes |
| `server/src/users.js` | Modify | Map `role === 2` to `'dev'` |
| `server/scripts/seed.js` | Modify | Parse optional `## Devs` table and seed with `role = 2` |
| `server/src/auth.js` | Modify | Add `app.requireDev`; log `auth.login`, `auth.login_failed`, `auth.logout` |
| `server/src/audit.js` | Create | `diffEntryData(before, after)`, `writeAuditLog(db, event)`, `queryAuditLogs(db, filters)`, `getAuditLogById(db, id)`, `buildAuditLogsCsv(rows)` |
| `server/src/submissions.js` | Modify | Log `submission.save_draft`, `submission.save_failed`, `submission.submit`, `submission.submit_failed` |
| `server/src/files.js` | Modify | Allow `dev` on `GET /api/files/:id`; log `file.upload`, `file.upload_failed`, `file.delete` |
| `server/src/video.js` | Modify | Log `video.session`, `video.confirm`, `video.delete` |
| `server/src/admin.js` | Modify | Log `admin.unlock`, `admin.export` |
| `server/src/dev.js` | Create | Fastify plugin: `GET /api/dev/logs`, `GET /api/dev/logs/:id`, `GET /api/dev/logs.csv` |
| `server/src/app.js` | Modify | Register `devPlugin` |
| `server/test/helpers.js` | Modify | Seed `dev1` (`pass-dev-1`, `role = 2`) in `makeTestApp` |
| `server/test/audit.test.js` | Create | Unit & integration tests for migration, `diffEntryData`, action logging, and `/api/dev/*` |
| `src/context/PortalContext.jsx` | Modify | Expose `isDev: user?.role === 'dev'` |
| `src/App.jsx` | Modify | Add `DevLayout` at `/dev` and update `homeFor(user)` & route guards for `'dev'` |
| `src/components/layout/Navbar.jsx` | Modify | Show Dev nav item (`บันทึกการทำงานระบบ`) and user badge for `dev` users |
| `src/components/dev/DevLogsView.jsx` | Create | Dev audit log explorer UI: stats strip, filters, table, detail modal with before/after diff, CSV export |
| `src/components/dev/DevLogDetailModal.jsx` | Create | Modal displaying actor metadata, request info, structured diff of fields/members/files, and raw JSON |

---

### Task 1: Migration `004_audit_logs.sql`, `dev` Role in `users.js` & `seed.js`

**Files:**
- Create: `server/migrations/004_audit_logs.sql`
- Modify: `server/src/users.js:15-27`
- Modify: `server/scripts/seed.js:44-86`
- Modify: `server/test/helpers.js:17-22`
- Test: `server/test/users.test.js`, `server/test/seed.test.js`

**Interfaces:**
- Produces:
  - `audit_logs` SQLite table (migration version 4)
  - `getUserAuth(db, id)` returning `user.role: 'coordinator' | 'admin' | 'dev'`
  - `parseAccounts(md)` returning `{ coordinators, admins, devs }`
  - `seed(db, { coordinators, admins, devs = [] }, cost)` returning `{ coordinators: number, admins: number, devs: number }`
  - `makeTestApp()` seeding `dev1` / `'pass-dev-1'` with `role = 2`

- [ ] **Step 1: Write failing tests in `server/test/users.test.js` and `server/test/seed.test.js`**

Add to `server/test/users.test.js`:
```js
  it('maps role 2 to dev', () => {
    db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (3, 'dev1', 'h', 'System Dev', NULL, 2)").run();
    expect(getUserById(db, 3)).toEqual({
      id: 3, username: 'dev1', name: 'System Dev', role: 'dev',
      universityId: null, university: null, universityCode: null
    });
  });
```

Add to `server/test/seed.test.js`:
```js
  it('parses optional ## Devs table and seeds role = 2 users', () => {
    const mdWithDevs = `${MD}\n## Devs\n\n| Username | Password | Name |\n|---|---|---|\n| dev1 | test-pass-e | นักพัฒนาระบบ |\n`;
    const parsed = parseAccounts(mdWithDevs);
    expect(parsed.devs).toEqual([{ username: 'dev1', password: 'test-pass-e', name: 'นักพัฒนาระบบ' }]);
    const db = openDb(':memory:');
    const counts = seed(db, parsed, 4);
    expect(counts.devs).toBe(1);
    const devRow = db.prepare("SELECT * FROM users WHERE username = 'dev1'").get();
    expect(devRow).toMatchObject({ role: 2, university_id: null, name: 'นักพัฒนาระบบ' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server; npx vitest run test/users.test.js test/seed.test.js`
Expected: FAIL (`role` is `'coordinator'` instead of `'dev'`; `parsed.devs` is `undefined`).

- [ ] **Step 3: Create `server/migrations/004_audit_logs.sql` and update `users.js`, `seed.js`, and `test/helpers.js`**

Create `server/migrations/004_audit_logs.sql` with the exact SQL from Section 3 of the spec.

In `server/src/users.js`, update role mapping:
```js
const ROLE_NAMES = { 0: 'coordinator', 1: 'admin', 2: 'dev' };
// inside getUserAuth:
role: ROLE_NAMES[row.role] || 'coordinator',
```

In `server/scripts/seed.js`:
- In `parseAccounts(md)`, add:
  ```js
  const devs = tableAfter(lines, '## Devs')
    .map(([username, password, name]) => ({ username, password, name: !name || name === PLACEHOLDER_NAME ? username : name }));
  return { coordinators, admins, devs };
  ```
- In `seed(db, { coordinators, admins, devs = [] }, cost = 12)`:
  Include `...devs.map(d => ({ ...d, role: 2 }))` in `hashed`, insert with `upsertUser.run(u.username, u.hash, u.name, null, u.role)` when `u.role !== 0`, and return `{ coordinators: coordinators.length, admins: admins.length, devs: devs.length }`.

In `server/test/helpers.js`, add after `admin1`:
```js
  addUser.run('dev1', bcrypt.hashSync('pass-dev-1', 4), 'System Dev', null, 2);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server; npx vitest run test/users.test.js test/seed.test.js test/db.test.js`
Expected: PASS. (If `test/db.test.js` asserts `user_version`, update its expected version from `3` to `4`.)

- [ ] **Step 5: Commit**

```powershell
git add server/migrations/004_audit_logs.sql server/src/users.js server/scripts/seed.js server/test/helpers.js server/test/users.test.js server/test/seed.test.js server/test/db.test.js
git commit -m "feat(server): add audit_logs migration and dev user role"
```

---

### Task 2: Audit Diff Engine & Logger Service (`server/src/audit.js`)

**Files:**
- Create: `server/src/audit.js`
- Test: `server/test/audit.test.js`

**Interfaces:**
- Produces in `server/src/audit.js`:
  - `diffEntryData(beforeEntry, afterEntry) -> { hasChanges: boolean, fields: Array<{ field: string, before: string, after: string }>, membersAdded: Array<{ id: string, type: string, role: string, fullName: string, studentId: string }>, membersRemoved: Array<{ id: string, type: string, role: string, fullName: string, studentId: string }>, membersUpdated: Array<{ id: string, fullName: string, changes: Array<{ field: string, before: any, after: any }> }>, filesAdded: Array<{ fileId: number, name: string, size: number }>, filesRemoved: Array<{ fileId: number, name: string, size: number }>, videoChanged: { before: object | null, after: object | null } | null }`
  - `summarizeDraftDiff(key, diff, previousStatus) -> string` (Thai human-readable summary, e.g. `"บันทึกฉบับร่าง theory.g0: แก้ไขชื่อผลงาน, เพิ่มสมาชิก 2 คน, แนบไฟล์ 1 ไฟล์"`)
  - `writeAuditLog(db, { request, user, action, entryKey, targetId, universityId, universityCode, status, errorCode, summary, details }) -> number` (returns inserted log `id`; never throws if `request.user` is null — falls back to passed `user` or `{ username: 'anonymous', role: 'anonymous' }`)
  - `queryAuditLogs(db, filters) -> { logs: Array<AuditLogItem>, total: number, stats: { total: number, errors: number, submits: number, saves: number } }`
  - `getAuditLogById(db, id) -> AuditLogDetail | null`
  - `buildAuditLogsCsv(rows) -> string` (UTF-8 with BOM, CRLF, using `csvCell`)

- [ ] **Step 1: Write failing unit tests in `server/test/audit.test.js` for `diffEntryData`, `writeAuditLog`, `queryAuditLogs`, and `buildAuditLogsCsv`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { diffEntryData, summarizeDraftDiff, writeAuditLog, queryAuditLogs, getAuditLogById, buildAuditLogsCsv } from '../src/audit.js';
import { blankData } from '../src/entries.js';

describe('diffEntryData', () => {
  it('detects no changes on identical entries', () => {
    const a = blankData('theory.g0');
    const b = blankData('theory.g0');
    const diff = diffEntryData(a, b);
    expect(diff.hasChanges).toBe(false);
  });

  it('detects project field changes, member additions/updates/removals, file changes, and video changes', () => {
    const before = {
      ...blankData('clip'),
      projectName: 'เดิม',
      members: [
        { id: 'm1', type: 'student', title: 'นาย', fullName: 'ก', studentId: '111', role: 'ผู้แข่งขัน', isLeader: true, photo: null },
        { id: 'm2', type: 'student', title: 'นางสาว', fullName: 'ข', studentId: '222', role: 'ผู้แข่งขัน', isLeader: false, photo: null }
      ],
      files: [{ fileId: 10, name: 'old.pdf', size: 100 }]
    };
    const after = {
      ...blankData('clip'),
      projectName: 'ใหม่',
      links: { video: 'https://youtu.be/123' },
      members: [
        { id: 'm1', type: 'student', title: 'นาย', fullName: 'ก แก้ชื่อ', studentId: '111', role: 'ผู้แข่งขัน', isLeader: true, photo: { fileId: 55, name: 'p.webp' } },
        { id: 'm3', type: 'advisor', title: 'ดร.', fullName: 'ค', studentId: '', role: 'อาจารย์', isLeader: false, photo: null }
      ],
      files: [{ fileId: 11, name: 'new.pdf', size: 200 }],
      video: { driveFileId: 'drv1', name: 'v.mp4', size: 999, mime: 'video/mp4' }
    };
    const diff = diffEntryData(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.fields).toEqual([
      { field: 'projectName', before: 'เดิม', after: 'ใหม่' },
      { field: 'links.video', before: '', after: 'https://youtu.be/123' }
    ]);
    expect(diff.membersAdded).toMatchObject([{ id: 'm3', fullName: 'ค' }]);
    expect(diff.membersRemoved).toMatchObject([{ id: 'm2', fullName: 'ข' }]);
    expect(diff.membersUpdated).toHaveLength(1);
    expect(diff.membersUpdated[0].id).toBe('m1');
    expect(diff.membersUpdated[0].changes).toEqual([
      { field: 'fullName', before: 'ก', after: 'ก แก้ชื่อ' },
      { field: 'photoFileId', before: null, after: 55 }
    ]);
    expect(diff.filesAdded).toEqual([{ fileId: 11, name: 'new.pdf', size: 200 }]);
    expect(diff.filesRemoved).toEqual([{ fileId: 10, name: 'old.pdf', size: 100 }]);
    expect(diff.videoChanged).toEqual({
      before: null,
      after: { driveFileId: 'drv1', name: 'v.mp4', size: 999, mime: 'video/mp4' }
    });
  });
});

describe('writeAuditLog and queryAuditLogs', () => {
  let db;
  beforeEach(() => {
    db = openDb(':memory:');
    db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ.')").run();
    db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (1, 'kmutt', 'h', 'ผู้ประสานงาน มจธ.', 1, 0)").run();
  });

  it('inserts and filters audit logs and exports formula-safe CSV', () => {
    const id1 = writeAuditLog(db, {
      user: { id: 1, username: 'kmutt', role: 'coordinator', universityId: 1, universityCode: 'kmutt' },
      action: 'submission.submit',
      entryKey: 'theory.g0',
      status: 'ok',
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      summary: 'ส่งผลงาน theory.g0 (รหัสอ้างอิง abc123def456)',
      details: { hash: 'abc123def456' }
    });
    writeAuditLog(db, {
      user: { id: null, username: '=cmd()', role: 'anonymous' },
      action: 'auth.login_failed',
      status: 'error',
      errorCode: 'bad_credentials',
      ip: '10.0.0.2',
      summary: 'เข้าสู่ระบบไม่สำเร็จ',
      details: { attemptedUsername: '=cmd()' }
    });

    const all = queryAuditLogs(db, {});
    expect(all.total).toBe(2);
    expect(all.stats).toEqual({ total: 2, errors: 1, submits: 1, saves: 0 });

    const onlyUni1 = queryAuditLogs(db, { universityId: '1' });
    expect(onlyUni1.total).toBe(1);
    expect(onlyUni1.logs[0].id).toBe(id1);

    const detail = getAuditLogById(db, id1);
    expect(detail.details).toEqual({ hash: 'abc123def456' });

    const csv = buildAuditLogsCsv(all.logs);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain("'=cmd()");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server; npx vitest run test/audit.test.js`
Expected: FAIL (`Cannot find module '../src/audit.js'`).

- [ ] **Step 3: Implement `server/src/audit.js`**

Implement `diffEntryData`, `summarizeDraftDiff`, `writeAuditLog`, `queryAuditLogs`, `getAuditLogById`, and `buildAuditLogsCsv` in `server/src/audit.js`:
- Compare top-level scalar fields: `projectName`, `summary`, `notes`, `links.video`.
- Compare `members` by `m.id`:
  - Member scalar fields to compare: `type`, `title`, `fullName`, `studentId`, `year`, `role`, `email`, `phone`, `dept`, `isLeader`, and `photoFileId` (`m.photo?.fileId ?? null`).
- Compare `files` by `f.fileId`.
- Compare `video` by `v?.driveFileId ?? null`.
- In `writeAuditLog(db, opts)`:
  - Extract actor from `opts.user || opts.request?.user`: `userId = actor?.id ?? null`, `username = String(actor?.username || 'anonymous').slice(0, 100)`, `userRole = String(actor?.role || 'anonymous')`, `universityId = opts.universityId ?? actor?.universityId ?? null`, `universityCode = opts.universityCode ?? actor?.universityCode ?? null`.
  - Extract `ip = opts.ip ?? opts.request?.ip ?? null` and `userAgent = String(opts.userAgent ?? opts.request?.headers?.['user-agent'] ?? '').slice(0, 300) || null`.
  - Insert into `audit_logs` and return `Number(res.lastInsertRowid)`.
- In `queryAuditLogs(db, filters = {})`:
  - Support filters: `universityId`, `action` (exact match or prefix like `'submission.'` when ending in `.`), `status` (`'ok' | 'error'`), `role` (`'coordinator' | 'admin' | 'dev'`), `entryKey`, `q` (case-insensitive substring match against `username`, `summary`, `entry_key`, `university_code`, `ip`, `error_code`), `from` (ISO date/time), `to` (ISO date/time), `limit` (default 100, max 500), `offset` (default 0).
  - Order by `created_at DESC, id DESC`.
  - Note: `logs` rows returned by `queryAuditLogs` parse `details` JSON and convert `created_at` to ISO string `createdAt`.
- In `buildAuditLogsCsv(rows)`:
  - Headers: `['ID', 'วันเวลา (เวลาไทย)', 'ผู้ใช้งาน', 'บทบาท', 'มหาวิทยาลัย', 'การกระทำ', 'รายการแข่งขัน', 'สถานะ', 'รหัสข้อผิดพลาด', 'IP Address', 'รายละเอียดสรุป']`
  - Format `createdAt` in `Asia/Bangkok` (`sv-SE` locale) and escape every cell with `csvCell` from `./csv.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server; npx vitest run test/audit.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/audit.js server/test/audit.test.js
git commit -m "feat(server): add audit log service and submission diff engine"
```

---

### Task 3: Instrument Auth, Submissions, Files, Video, and Admin Routes + Add `requireDev`

**Files:**
- Modify: `server/src/auth.js:39-103`
- Modify: `server/src/submissions.js:17-67`
- Modify: `server/src/files.js:137-228`
- Modify: `server/src/video.js:23-130`
- Modify: `server/src/admin.js:306-360`
- Test: `server/test/audit.test.js`

**Interfaces:**
- Consumes: `writeAuditLog`, `diffEntryData`, `summarizeDraftDiff` from `server/src/audit.js`; `getEntryRow`, `rowToEntry` from `server/src/entries.js`.
- Produces:
  - `app.requireDev` decorator on Fastify instance in `server/src/auth.js`
  - Automatic audit log creation across all write/auth/export routes

- [ ] **Step 1: Add integration tests in `server/test/audit.test.js` for coordinator and admin actions**

Append tests to `server/test/audit.test.js`:
```js
import { makeTestApp, loginAs } from './helpers.js';

describe('route audit logging', () => {
  it('logs login failure, login success, draft save with diff, no-op save suppression, submit failure, submit success, admin unlock, and logout', async () => {
    const { app, db } = await makeTestApp();

    // 1. Failed login
    const badLogin = await app.inject({ method: 'POST', url: '/api/login', payload: { username: 'kmutt', password: 'wrong' } });
    expect(badLogin.statusCode).toBe(401);

    // 2. Successful login
    const coordCookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');

    // 3. First draft save (creates diff)
    const member = {
      id: 'm1', type: 'student', title: 'นาย', fullName: 'สมชาย ใจดี',
      studentId: '6500001', year: '2', email: 's@kmutt.ac.th', phone: '0811111111',
      role: 'ผู้แข่งขัน', isLeader: true
    };
    const save1 = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'เพลงลูกทุ่ง', members: [member] }, version: 1 }
    });
    expect(save1.statusCode).toBe(200);

    // 4. Identical no-op save (should NOT create a second submission.save_draft row)
    const save2 = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'เพลงลูกทุ่ง', members: [member] }, version: 2 }
    });
    expect(save2.statusCode).toBe(200);

    // 5. Version conflict save failure (should log submission.save_failed)
    const saveConflict = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'แก้ซ้ำ' }, version: 1 }
    });
    expect(saveConflict.statusCode).toBe(409);

    // 6. Incomplete submit failure (missing photo/advisor -> 422, should log submission.submit_failed)
    const subFail = await app.inject({
      method: 'POST',
      url: '/api/submissions/singing/submit',
      headers: { cookie: coordCookie }
    });
    expect(subFail.statusCode).toBe(422);

    // 7. Logout
    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: coordCookie } });

    const { logs } = queryAuditLogs(db, {});
    const actions = logs.map(l => `${l.action}:${l.status}`).reverse();
    expect(actions).toEqual([
      'auth.login_failed:error',
      'auth.login:ok',
      'submission.save_draft:ok',
      'submission.save_failed:error',
      'submission.submit_failed:error',
      'auth.logout:ok'
    ]);

    const draftLog = logs.find(l => l.action === 'submission.save_draft');
    expect(draftLog.details.diff.fields).toEqual([{ field: 'projectName', before: '', after: 'เพลงลูกทุ่ง' }]);
    expect(draftLog.details.diff.membersAdded).toHaveLength(1);
    expect(draftLog.details.diff.membersAdded[0].fullName).toBe('สมชาย ใจดี');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server; npx vitest run test/audit.test.js`
Expected: FAIL (`actions` is `[]`).

- [ ] **Step 3: Instrument `auth.js`, `submissions.js`, `files.js`, `video.js`, and `admin.js`**

1. **`server/src/auth.js`:**
   - Add `requireDev`:
     ```js
     async function requireDev(request) {
       await requireUser(request);
       if (request.user.role !== 'dev') throw httpError(403, 'forbidden');
     }
     app.decorate('requireDev', requireDev);
     ```
   - In `POST /api/login`:
     - When user not found, password mismatch, or disabled: call `writeAuditLog(db, { request, user: { id: row?.id ?? null, username: cleanUsername, role: row ? (row.role === 2 ? 'dev' : row.role === 1 ? 'admin' : 'coordinator') : 'anonymous', universityId: row?.university_id ?? null }, action: 'auth.login_failed', status: 'error', errorCode: 'bad_credentials', summary: `เข้าสู่ระบบไม่สำเร็จ (${cleanUsername})`, details: { attemptedUsername: cleanUsername, reason: !row ? 'unknown_user' : row.disabled === 1 ? 'disabled' : 'bad_password' } })` before throwing `401`.
     - When login succeeds: call `writeAuditLog(db, { request, user: record.user, action: 'auth.login', summary: `เข้าสู่ระบบสำเร็จ (${record.user.username})` })`.
   - In `POST /api/logout`:
     - Call `writeAuditLog(db, { request, action: 'auth.logout', summary: `ออกจากระบบ (${request.user.username})` })`.

2. **`server/src/submissions.js`:**
   - In `PUT /api/submissions/:key`:
     - Load current row before calling `saveDraft`: `const prevRow = getEntryRow(db, request.user.universityId, key); const beforeEntry = prevRow ? rowToEntry(prevRow) : blankData(key); const prevStatus = prevRow?.status ?? 0;`
     - Wrap `assertBeforeDeadline(config)` + `saveDraft(...)` in `try / catch (err)`:
       - On success: compute `const diff = diffEntryData(beforeEntry, entry);`. If `prevStatus === 0 || diff.hasChanges`, call `writeAuditLog(db, { request, action: 'submission.save_draft', entryKey: key, summary: summarizeDraftDiff(key, diff, prevStatus), details: { versionBefore: version, versionAfter: entry.version, diff, before: { projectName: beforeEntry.projectName, summary: beforeEntry.summary, notes: beforeEntry.notes, links: beforeEntry.links, members: beforeEntry.members, files: beforeEntry.files, video: beforeEntry.video }, after: { projectName: entry.projectName, summary: entry.summary, notes: entry.notes, links: entry.links, members: entry.members, files: entry.files, video: entry.video } } })`.
       - On catch: call `writeAuditLog(db, { request, action: 'submission.save_failed', entryKey: key, status: 'error', errorCode: err.code || 'server_error', summary: `บันทึกฉบับร่าง ${key} ไม่สำเร็จ (${err.code || 'error'})`, details: { clientVersion: version, serverVersion: prevRow?.version ?? null, errorCode: err.code } })` and rethrow `err`.
   - In `POST /api/submissions/:key/submit`:
     - Wrap in `try / catch (err)`:
       - On success: call `writeAuditLog(db, { request, action: 'submission.submit', entryKey: key, targetId: entry.hash, summary: `ส่งผลงาน ${key} สำเร็จ (รหัสอ้างอิง ${entry.hash})`, details: { hash: entry.hash, version: entry.version, projectName: entry.projectName, memberCount: (entry.members || []).length, fileCount: (entry.files || []).length, hasVideo: Boolean(entry.video?.driveFileId), youtubeUrl: entry.links?.video || '' } })`.
       - On catch: call `writeAuditLog(db, { request, action: 'submission.submit_failed', entryKey: key, status: 'error', errorCode: err.code || 'server_error', summary: `ส่งผลงาน ${key} ไม่สำเร็จ (${err.code || 'error'})`, details: { errorCode: err.code, failed: err.extra?.failed || [] } })` and rethrow `err`.

3. **`server/src/files.js`:**
   - In `GET /files/:id`: allow both `'admin'` and `'dev'` to view any university's file:
     ```js
     if (request.user.role !== 'admin' && request.user.role !== 'dev' && row.university_id !== request.user.universityId) throw forbidden();
     ```
   - In `POST /submissions/:key/files`: log `file.upload` on success (`details: { fileId: Number(lastInsertRowid), kind, name, size, mime, sha256 }`) and `file.upload_failed` on error.
   - In `DELETE /files/:id`: log `file.delete` on success (`entryKey: row.entry_key, targetId: String(row.id), details: { fileId: row.id, kind: row.kind === 0 ? 'photo' : 'work', name: row.original_name, size: row.size, mime: row.mime, sha256: row.sha256 }`).

4. **`server/src/video.js`:**
   - In `POST /submissions/clip/video`: log `video.session` (`entryKey: 'clip', details: { name: cleanName(name), size, mime }`).
   - In `POST /submissions/clip/video/confirm`: log `video.confirm` (`entryKey: 'clip', targetId: meta.id, details: { driveFileId: meta.id, name: meta.name, size, mime: meta.mimeType, replacedDriveFileIds: previous.map(p => p.drive_file_id) }`).
   - In `DELETE /submissions/clip/video/:driveFileId`: log `video.delete` (`entryKey: 'clip', targetId: driveFileId, details: { driveFileId }`).

5. **`server/src/admin.js`:**
   - In `POST /api/admin/submissions/:universityId/:key/unlock`: read `before = listEntries(db, uni.id)[key]` before `unlockEntry`, then log `admin.unlock` with `universityId: uni.id, universityCode: uni.code, entryKey: key, details: { targetUniversityId: uni.id, targetUniversityCode: uni.code, previousHash: before?.hash ?? null, previousSubmittedAt: before?.submittedAt ?? null, versionAfter: entry.version }`.
   - In `GET /api/admin/export.csv`, `certificates.csv`, `files.zip`, `members.zip`: log `admin.export` (`details: { format: 'export.csv' | 'certificates.csv' | 'files.zip' | 'members.zip', query: request.query }`).

- [ ] **Step 4: Run test suite to verify all existing and new tests pass**

Run: `cd server; npm test`
Expected: PASS across all test files.

- [ ] **Step 5: Commit**

```powershell
git add server/src/auth.js server/src/submissions.js server/src/files.js server/src/video.js server/src/admin.js server/test/audit.test.js
git commit -m "feat(server): record audit logs across auth, submissions, files, video, and admin routes"
```

---

### Task 4: Dev Audit API Plugin (`server/src/dev.js`)

**Files:**
- Create: `server/src/dev.js`
- Modify: `server/src/app.js:14-95`
- Test: `server/test/audit.test.js`

**Interfaces:**
- Consumes: `app.requireDev`, `queryAuditLogs`, `getAuditLogById`, `buildAuditLogsCsv`
- Produces HTTP endpoints:
  - `GET /api/dev/logs` -> `{ logs, total, stats, universities }`
  - `GET /api/dev/logs/:id` -> `{ log }` (or `404 not_found`)
  - `GET /api/dev/logs.csv` -> `text/csv; charset=utf-8` attachment `tta-audit-logs-YYYYMMDD.csv`

- [ ] **Step 1: Write failing API tests in `server/test/audit.test.js`**

Append to `server/test/audit.test.js`:
```js
describe('dev audit API (/api/dev/*)', () => {
  it('blocks anonymous (401), coordinator (403), and admin (403) from /api/dev/*, and allows dev (200)', async () => {
    const { app } = await makeTestApp();
    const coordCookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const adminCookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const devCookie = await loginAs(app, 'dev1', 'pass-dev-1');

    for (const url of ['/api/dev/logs', '/api/dev/logs/1', '/api/dev/logs.csv']) {
      const anon = await app.inject({ method: 'GET', url });
      expect(anon.statusCode, `anon ${url}`).toBe(401);

      const coord = await app.inject({ method: 'GET', url, headers: { cookie: coordCookie } });
      expect(coord.statusCode, `coord ${url}`).toBe(403);

      const adm = await app.inject({ method: 'GET', url, headers: { cookie: adminCookie } });
      expect(adm.statusCode, `admin ${url}`).toBe(403);
    }

    // Also verify dev cannot access admin or coordinator routes
    const devToAdmin = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: { cookie: devCookie } });
    expect(devToAdmin.statusCode).toBe(403);
    const devToCoord = await app.inject({ method: 'GET', url: '/api/submissions', headers: { cookie: devCookie } });
    expect(devToCoord.statusCode).toBe(403);

    const listRes = await app.inject({ method: 'GET', url: '/api/dev/logs', headers: { cookie: devCookie } });
    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.universities).toHaveLength(2);
    expect(body.logs.length).toBeGreaterThanOrEqual(3); // 3 logins above

    const firstId = body.logs[0].id;
    const detailRes = await app.inject({ method: 'GET', url: `/api/dev/logs/${firstId}`, headers: { cookie: devCookie } });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().log.id).toBe(firstId);

    const csvRes = await app.inject({ method: 'GET', url: '/api/dev/logs.csv', headers: { cookie: devCookie } });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server; npx vitest run test/audit.test.js`
Expected: FAIL (`404` on `/api/dev/logs`).

- [ ] **Step 3: Create `server/src/dev.js` and register in `server/src/app.js`**

In `server/src/dev.js`:
```js
import { httpError } from './errors.js';
import { queryAuditLogs, getAuditLogById, buildAuditLogsCsv } from './audit.js';

const bangkokStamp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');

export default async function devPlugin(app, { db }) {
  const pre = { preHandler: app.requireDev };

  app.get('/api/dev/logs', pre, async (request) => {
    const universities = db.prepare('SELECT id, code, name FROM universities ORDER BY id').all();
    const result = queryAuditLogs(db, request.query);
    return { ...result, universities };
  });

  app.get('/api/dev/logs/:id', pre, async (request) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw httpError(400, 'bad_request');
    const log = getAuditLogById(db, id);
    if (!log) throw httpError(404, 'not_found');
    return { log };
  });

  app.get('/api/dev/logs.csv', pre, async (request, reply) => {
    const { logs } = queryAuditLogs(db, { ...request.query, limit: 5000, offset: 0 });
    const csv = buildAuditLogsCsv(logs);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-audit-logs-${bangkokStamp()}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });
}
```

Register `devPlugin` in `server/src/app.js` right after `app.register(adminPlugin, { db, config });`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server; npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/dev.js server/src/app.js server/test/audit.test.js
git commit -m "feat(server): add /api/dev/logs endpoints guarded by requireDev"
```

---

### Task 5: Frontend Dev Role Routing & Detailed Audit Log Explorer (`/dev`)

**Files:**
- Modify: `src/context/PortalContext.jsx:479-485`
- Modify: `src/App.jsx:14-154`
- Modify: `src/components/layout/Navbar.jsx:54-69`
- Create: `src/components/dev/DevLogsView.jsx`
- Create: `src/components/dev/DevLogDetailModal.jsx`

**Interfaces:**
- Consumes: `GET /api/dev/logs`, `GET /api/dev/logs/:id`, `GET /api/dev/logs.csv`, `src/components/admin/admin.css` (`[data-theme="admin"]` classes `.adm*`)
- Produces:
  - `isDev` in `usePortal()`
  - `/dev` route guarded by `DevLayout` (redirects `admin` to `/admin`, `coordinator` to `/dashboard`, unauthenticated to `/login`)
  - Redirects `dev` users away from `/admin` and coordinator routes to `/dev`
  - `DevLogsView` & `DevLogDetailModal` components

- [ ] **Step 1: Update `PortalContext.jsx`, `App.jsx`, and `Navbar.jsx` for the `dev` role**

1. In `src/context/PortalContext.jsx`:
   Add `isDev: user?.role === 'dev'` to the `PortalContext.Provider` value.
2. In `src/App.jsx`:
   - Lazy-load `DevLogsView`:
     ```js
     const DevLogsView = lazy(() => import('./components/dev/DevLogsView').then(m => ({ default: m.DevLogsView })));
     ```
   - Update `homeFor(user)`:
     ```js
     const homeFor = (user) => (user?.role === 'dev' ? '/dev' : user?.role === 'admin' ? '/admin' : '/dashboard');
     ```
   - In `ProtectedLayout`: if `user.role === 'admin'` navigate to `/admin`; if `user.role === 'dev'` navigate to `/dev`.
   - In `AdminLayout`: if `user.role !== 'admin'` navigate to `homeFor(user)`.
   - Add `DevLayout`:
     ```jsx
     function DevLayout() {
       const { isAuthenticated, user } = usePortal();
       const location = useLocation();
       if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
       if (user.role !== 'dev') return <Navigate to={homeFor(user)} replace />;
       return (
         <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
           <Navbar />
           <main style={{ flex: 1 }} className="swap-stage swap-in">
             <Suspense fallback={<FullPageLoader />}>
               <DevLogsView />
             </Suspense>
           </main>
           <Toast />
         </div>
       );
     }
     ```
   - In `PublicLoginRoute`:
     ```js
     const from = user.role === 'dev' ? '/dev' : user.role === 'admin' ? '/admin' : (location.state?.from?.pathname || '/dashboard');
     ```
   - Add `<Route path="/dev" element={<DevLayout />} />` in `App()`.
3. In `src/components/layout/Navbar.jsx`:
   - Import `TerminalWindow` from `@phosphor-icons/react`.
   - Add `const isDev = user.role === 'dev';` and `const isStaff = isAdmin || isDev;`.
   - Set `homePath = isDev ? '/dev' : isAdmin ? '/admin' : '/dashboard'`.
   - When `isDev`, set `navItems = [{ id: 'dev', path: '/dev', label: 'บันทึกการทำงานระบบ (Dev)', icon: TerminalWindow, isActive: location.pathname === '/dev' }]`.
   - Hide `<SaveIndicator />` and `<MobileTabBar />` when `isStaff` (`!isStaff`).

- [ ] **Step 2: Create `src/components/dev/DevLogDetailModal.jsx` and `src/components/dev/DevLogsView.jsx`**

1. **`src/components/dev/DevLogDetailModal.jsx`:**
   - Displays full evidence for a selected log entry (`log`):
     - **Actor & Session Card:** Timestamp (Thai locale with seconds + UTC ISO), Username, Role badge (`coordinator` / `admin` / `dev`), University name & code, IP Address, User-Agent.
     - **Action & Outcome Card:** Action code + Thai label, Target Entry Key (`track.th` + subject group), Target ID / Confirmation Hash, Status (`ok` / `error` with `errorCode`).
     - **Structured Diff Section (when `log.details?.diff` is present):**
       - Changed project fields table (`Field`, `Before`, `After`).
       - Team member changes:
         - Added members (`+ ชื่อ-นามสกุล (บทบาท, รหัสนักศึกษา)` in green)
         - Removed members (`- ชื่อ-นามสกุล (บทบาท, รหัสนักศึกษา)` in red)
         - Edited members (`~ ชื่อ-นามสกุล`: list each changed property `before → after`)
       - File changes (added/removed work files with file ID, filename, byte size) and clip video changes.
     - **Before / After / Raw JSON Snapshot:** Collapsible or tabbed `<pre>` block with a "คัดลอกหลักฐาน (JSON)" button that copies the full log JSON to clipboard and triggers `showToast('คัดลอกข้อมูลหลักฐานเรียบร้อยแล้ว')`.

2. **`src/components/dev/DevLogsView.jsx`:**
   - Reuses `../admin/admin.css` (`<div className="adm" data-theme="admin">`) so typography, table density, tokens, and responsive breakpoints match the portal's design language.
   - **Header:** `"บันทึกหลักฐานการทำงานของระบบ (System Audit Logs)"`, subtitle `"สำหรับนักพัฒนาระบบ (Dev เท่านั้น) — บันทึกทุกการกระทำของผู้ประสานงานและผู้ดูแลระบบพร้อมข้อมูลเปรียบเทียบก่อน-หลัง"`, refresh button, and CSV export link (`/api/dev/logs.csv?...`).
   - **Pulse strip (`.adm-pulse`):**
     1. บันทึกทั้งหมด (`stats.total`)
     2. การส่งผลงานยืนยันแล้ว (`stats.submits`, filters to `action=submission.submit`)
     3. การแก้ไขฉบับร่าง (`stats.saves`, filters to `action=submission.save_draft`)
     4. รายการที่เกิดข้อผิดพลาด (`stats.errors`, alert style when `> 0`, filters to `status=error`)
   - **Filter bar (`.adm-filters`):**
     - Search box (`q`: ค้นหาชื่อผู้ใช้, มหาวิทยาลัย, รายการ, IP, สรุปเหตุการณ์)
     - University select (`universityId`: ทุกมหาวิทยาลัย + 10 universities)
     - Action select (`action`: ทุกการกระทำ, เข้า/ออกจากระบบ `auth.`, บันทึกฉบับร่าง `submission.save_draft`, ส่งผลงาน `submission.submit`, อัปโหลด/ลบไฟล์ `file.`, วิดีโอ `video.`, ผู้ดูแลปลดล็อก/ส่งออก `admin.`)
     - Entry/Track select (`entryKey`: ทุกรายการแข่งขัน + all 18 entry keys)
     - Status select (`status`: ทุกสถานะ, สำเร็จ `ok`, ข้อผิดพลาด `error`)
     - Role select (`role`: ทุกบทบาท, ผู้ประสานงาน `coordinator`, ผู้ดูแล `admin`, นักพัฒนา `dev`)
   - **Logs Table (`.adm-table`):**
     - Columns: `วัน-เวลา`, `ผู้ใช้งาน / มหาวิทยาลัย`, `การกระทำ`, `รายการแข่งขัน`, `สรุปสิ่งที่เปลี่ยนแปลง`, `IP`, `สถานะ`, `ดูหลักฐาน`
     - Clicking any row or `"ดูหลักฐาน"` opens `DevLogDetailModal`.
     - Pagination controls (`ก่อนหน้า` / `ถัดไป`, 100 rows per page).

- [ ] **Step 3: Run frontend and backend tests and verify production build**

Run: `npm test; cd server; npm test; cd ..; npm run build`
Expected: All frontend tests PASS, all server tests PASS, and `vite build` succeeds with zero errors. Clean `dist/` if modified (`git checkout -- dist; git clean -fq dist`).

- [ ] **Step 4: Commit**

```powershell
git add src/context/PortalContext.jsx src/App.jsx src/components/layout/Navbar.jsx src/components/dev/DevLogsView.jsx src/components/dev/DevLogDetailModal.jsx
git commit -m "feat(dev): add /dev audit log viewer and dev role routing"
```
