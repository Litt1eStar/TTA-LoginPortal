# Backend A: Server Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `server/` API on port 3001: SQLite database with migrations, cookie sessions (login/logout/me) with rate limiting, and the coordinator submissions API (list / save draft / submit) with version conflicts, locking and the deadline, plus a seed script and the Vite `/api` proxy.

**Architecture:** Fastify 5 app built by `buildApp({ db, config })` (never listens itself, so tests use `app.inject()`). Data lives in `node:sqlite` (`DatabaseSync`) with plain SQL and numbered migration files. Business rules live in `src/entries.js` as plain functions over the db; route plugins are thin. Track rules are imported straight from the frontend (`../../src/data/tracks.js`, `../../src/utils/requirements.js`, `../../src/data/seedData.js`). All names and shapes follow `docs/superpowers/plans/2026-10-29-backend-00-contracts.md`.

**Tech Stack:** Node ≥ 22.13 (dev machine: Node 26), `node:sqlite`, fastify ^5.12.7, fastify-plugin ^5.1.0, @fastify/cookie ^11.1.5, @fastify/helmet ^13.2.0, @fastify/rate-limit ^11.2.1, @fastify/compress ^9.3.0, bcryptjs ^3.0.3, vitest ^5.0.5.

---

## Verified facts (checked before writing this plan)

- `node:sqlite` on the dev machine: `new DatabaseSync(path)`, `db.exec(sql)`, `db.prepare(sql).run(...)` → `{ changes, lastInsertRowid }`, `.get(...)` → row object (null prototype) or `undefined`, `.all(...)` → array. `PRAGMA user_version` reads as `{ user_version: 0 }`. No transaction helper: use `BEGIN` / `COMMIT` / `ROLLBACK` via `exec`.
- The repo root `package.json` has `"type": "module"`, so `src/data/tracks.js`, `src/utils/requirements.js` and `src/data/seedData.js` load in Node ESM (checked with `node --input-type=module -e "import('./src/data/tracks.js')…"`). None of them import anything.
- `src/data/referenceData.js` imports `'./tracks'` without an extension, which Node ESM rejects. **The server never imports `referenceData.js`.** The 10 universities are written out in `scripts/seed.js`.
- `emptySubmission()` returns `links: { video, github, drive }`. The contract's entry shape has `links: { video: '' }`, so `blankData()` and the sanitiser keep only `links.video`.
- 17 entry keys: theory `.g0`–`.g4` (5 groups), practice `.g0`–`.g3` (4 groups), plus 8 single tracks.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `server/package.json` | create | `"type": "module"`, deps, scripts `dev`, `start`, `test`, `seed` (`backup` is added by plan D) |
| `server/.gitignore` | create | ignore `node_modules/`, `data/`, `.env` |
| `server/.env.example` | create | every variable read by `config.js`, safe values |
| `server/vitest.config.js` | create | node environment, test file glob |
| `server/migrations/001_init.sql` | create | schema from the contracts |
| `server/src/config.js` | create | `loadConfig(env)` |
| `server/src/db.js` | create | `openDb(path)`, `migrate(db)`, `tx(db, fn)` |
| `server/src/errors.js` | create | `httpError`, `ERRORS` message table, `errorHandler`, `notFoundHandler` |
| `server/src/users.js` | create | `getUserAuth`, `getUserById`, `getUserByUsername`, `bumpSessionVersion`, `clearUserCache`, `toClientUser` |
| `server/src/auth.js` | create | plugin: `/api/login`, `/api/logout`, `/api/me`; decorators `requireUser`, `requireAdmin`, `requireCoordinator` |
| `server/src/entries.js` | create | `isValidEntryKey`, `allEntryKeys`, `blankData`, `sanitizeData`, `rowToEntry`, `listEntries`, `getEntryRow`, `saveDraft`, `submitEntry`, `assertBeforeDeadline` |
| `server/src/submissions.js` | create | plugin: `GET /api/submissions`, `PUT /api/submissions/:key`, `POST /api/submissions/:key/submit` |
| `server/src/app.js` | create | `buildApp({ db, config })` |
| `server/src/index.js` | create | entry point: config → db → app → listen |
| `server/scripts/seed.js` | create | `UNIVERSITY_CODES`, `parseAccounts(md)`, `seed(db, accounts, cost)`; CLI reads the accounts note |
| `server/test/helpers.js` | create | `makeTestApp`, `loginAs` |
| `server/test/*.test.js` | create | config, db, errors, auth, entries, submissions, seed tests |
| `vite.config.js` | modify | `server.proxy = { '/api': 'http://localhost:3001' }` |

All commands below run in PowerShell from the repo root unless they start with `cd server;`.

---

### Task 1: Branch and scaffold

**Files:**
- Create: `server/package.json`, `server/.gitignore`, `server/.env.example`, `server/vitest.config.js`, `server/test/smoke.test.js`

- [ ] **Step 1: Create the branch and commit the pending work**

```powershell
git checkout main
git checkout -b backend
git add docs/ src/utils/photo.js
git commit -m "docs: backend plans and photo util update" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write `server/package.json`**

```json
{
  "name": "tta-portal-server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "vitest run",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "@fastify/compress": "^9.3.0",
    "@fastify/cookie": "^11.1.5",
    "@fastify/helmet": "^13.2.0",
    "@fastify/rate-limit": "^11.2.1",
    "bcryptjs": "^3.0.3",
    "fastify": "^5.12.7",
    "fastify-plugin": "^5.1.0"
  },
  "devDependencies": {
    "vitest": "^5.0.5"
  }
}
```

- [ ] **Step 3: Write `server/.gitignore`**

```
node_modules/
data/
.env
```

- [ ] **Step 4: Write `server/.env.example`**

```
# Copy to .env (never commit .env). Values here are safe examples.
NODE_ENV=development
PORT=3001
DB_PATH=data/portal.db
UPLOAD_DIR=data/uploads
# At least 32 characters in production
SESSION_SECRET=change-me-to-a-long-random-string-of-32-plus-chars
COOKIE_SECURE=false
# ISO time; defaults to FINAL_DEADLINE in src/data/tracks.js
DEADLINE=2027-01-15T23:59:00+07:00
MAX_PHOTO_KB=200
MAX_WORK_MB=50
MAX_VIDEO_MB=500
# 64 hex chars (plan B)
TOKEN_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/admin/google/callback
APP_ORIGIN=http://localhost:3000
```

- [ ] **Step 5: Write `server/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js']
  }
});
```

- [ ] **Step 6: Install**

Run: `cd server; npm install`
Expected: `added N packages`, no errors, `server/package-lock.json` created.

- [ ] **Step 7: Write a smoke test that proves the shared frontend files load**

`server/test/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { TRACKS, FINAL_DEADLINE } from '../../src/data/tracks.js';
import { getRequirements } from '../../src/utils/requirements.js';
import { emptySubmission } from '../../src/data/seedData.js';

describe('shared frontend modules', () => {
  it('load in node', () => {
    expect(TRACKS.length).toBe(10);
    expect(typeof FINAL_DEADLINE).toBe('string');
    expect(typeof getRequirements).toBe('function');
    expect(emptySubmission().status).toBe('not_started');
  });
});
```

- [ ] **Step 8: Run it**

Run: `cd server; npx vitest run test/smoke.test.js`
Expected: PASS (1 test). If it fails with `ERR_MODULE_NOT_FOUND`, one of the three files gained an extensionless import; fix that import in the frontend file before continuing.

- [ ] **Step 9: Commit**

```powershell
git add server/package.json server/package-lock.json server/.gitignore server/.env.example server/vitest.config.js server/test/smoke.test.js
git commit -m "chore(server): scaffold Fastify server package" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Config

**Files:**
- Create: `server/src/config.js`, `server/test/config.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/config.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { FINAL_DEADLINE } from '../../src/data/tracks.js';

describe('loadConfig', () => {
  it('has dev defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3001);
    expect(c.dbPath).toBe('data/portal.db');
    expect(c.uploadDir).toBe('data/uploads');
    expect(c.deadline).toBe(FINAL_DEADLINE);
    expect(c.cookieSecure).toBe(false);
    expect(c.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(c.google.redirectUri).toBe('http://localhost:3000/api/admin/google/callback');
    expect(c.appOrigin).toBe('http://localhost:3000');
  });

  it('reads env values', () => {
    const c = loadConfig({ PORT: '4000', COOKIE_SECURE: 'true', DEADLINE: '2030-01-01T00:00:00Z', MAX_WORK_MB: '10' });
    expect(c.port).toBe(4000);
    expect(c.cookieSecure).toBe(true);
    expect(c.deadline).toBe('2030-01-01T00:00:00Z');
    expect(c.maxWorkMB).toBe(10);
  });

  it('rejects a short secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('accepts a 32-char secret in production', () => {
    const c = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) });
    expect(c.sessionSecret).toBe('x'.repeat(32));
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/config.test.js`
Expected: FAIL — `Failed to load url ../src/config.js` (module does not exist).

- [ ] **Step 3: Implement `server/src/config.js`**

```js
import { FINAL_DEADLINE } from '../../src/data/tracks.js';

export function loadConfig(env = process.env) {
  if (env.NODE_ENV === 'production' && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }
  return {
    port: Number(env.PORT || 3001),
    dbPath: env.DB_PATH || 'data/portal.db',
    uploadDir: env.UPLOAD_DIR || 'data/uploads',
    sessionSecret: env.SESSION_SECRET || 'dev-only-secret-change-me-dev-only-secret',
    cookieSecure: env.COOKIE_SECURE === 'true',
    deadline: env.DEADLINE || FINAL_DEADLINE,
    maxPhotoKB: Number(env.MAX_PHOTO_KB || 200),
    maxWorkMB: Number(env.MAX_WORK_MB || 50),
    maxVideoMB: Number(env.MAX_VIDEO_MB || 500),
    tokenKey: env.TOKEN_KEY || '',
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/admin/google/callback'
    },
    appOrigin: env.APP_ORIGIN || 'http://localhost:3000'
  };
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/config.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add server/src/config.js server/test/config.test.js
git commit -m "feat(server): add loadConfig with production secret check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Database and migrations

**Files:**
- Create: `server/migrations/001_init.sql`, `server/src/db.js`, `server/test/db.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/db.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, migrate, tx } from '../src/db.js';

const MIGRATION_COUNT = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter(f => /^\d{3}_.*\.sql$/.test(f)).length;
const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);

describe('openDb', () => {
  it('creates the schema in memory', () => {
    const db = openDb(':memory:');
    expect(tables(db)).toEqual(expect.arrayContaining(['files', 'submissions', 'universities', 'users']));
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATION_COUNT);
    expect(db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1);
  });

  it('is idempotent on a file database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-db-'));
    const file = path.join(dir, 'portal.db');
    const db1 = openDb(file);
    db1.prepare("INSERT INTO universities (code, name) VALUES ('kmutt', 'x')").run();
    expect(db1.prepare('PRAGMA journal_mode').get().journal_mode).toBe('wal');
    db1.close();
    const db2 = openDb(file);
    migrate(db2);
    expect(db2.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(1);
    expect(db2.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATION_COUNT);
    db2.close();
  });

  it('tx rolls back on error', () => {
    const db = openDb(':memory:');
    expect(() => tx(db, () => {
      db.prepare("INSERT INTO universities (code, name) VALUES ('a', 'a')").run();
      throw new Error('boom');
    })).toThrow('boom');
    expect(db.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(0);
    expect(tx(db, () => 42)).toBe(42);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/db.test.js`
Expected: FAIL — `Failed to load url ../src/db.js`.

- [ ] **Step 3: Write `server/migrations/001_init.sql`** (copied from the contracts)

```sql
CREATE TABLE universities (
  id   INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  university_id   INTEGER REFERENCES universities(id),
  role            INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 0,
  disabled        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE submissions (
  university_id INTEGER NOT NULL REFERENCES universities(id),
  entry_key     TEXT    NOT NULL,
  status        INTEGER NOT NULL DEFAULT 0,
  data          TEXT    NOT NULL DEFAULT '{}',
  version       INTEGER NOT NULL DEFAULT 1,
  draft_at      INTEGER,
  submitted_at  INTEGER,
  hash          TEXT,
  PRIMARY KEY (university_id, entry_key)
) WITHOUT ROWID;

CREATE TABLE files (
  id            INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL,
  entry_key     TEXT    NOT NULL,
  kind          INTEGER NOT NULL,
  sha256        TEXT    NOT NULL,
  size          INTEGER NOT NULL,
  mime          TEXT    NOT NULL,
  original_name TEXT    NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (university_id, entry_key) REFERENCES submissions(university_id, entry_key)
);
CREATE INDEX files_by_entry ON files(university_id, entry_key);
```

- [ ] **Step 4: Implement `server/src/db.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

// Runs fn inside BEGIN/COMMIT; rolls back and rethrows on error. Not re-entrant.
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Applies every migrations/NNN_*.sql whose number is above PRAGMA user_version.
export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const n = Number(file.slice(0, 3));
    if (n <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    tx(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${n}`);
    });
  }
}

export function openDb(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}
```

- [ ] **Step 5: Run it**

Run: `cd server; npx vitest run test/db.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```powershell
git add server/migrations/001_init.sql server/src/db.js server/test/db.test.js
git commit -m "feat(server): node:sqlite database with numbered migrations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Errors

**Files:**
- Create: `server/src/errors.js`, `server/test/errors.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/errors.test.js`:
```js
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { httpError, errorHandler, notFoundHandler, ERRORS } from '../src/errors.js';

function app() {
  const a = Fastify({ logger: false });
  a.setErrorHandler(errorHandler);
  a.setNotFoundHandler(notFoundHandler);
  a.get('/conflict', async () => { throw httpError(409, 'version_conflict', undefined, { entry: { version: 3 } }); });
  a.get('/boom', async () => { throw new Error('secret internals'); });
  a.post('/schema', { schema: { body: { type: 'object', required: ['x'], properties: { x: { type: 'integer' } } } } }, async () => ({ ok: true }));
  return a;
}

describe('errors', () => {
  it('httpError carries status, code, default Thai message and extra', () => {
    const e = httpError(423, 'locked');
    expect(e.statusCode).toBe(423);
    expect(e.code).toBe('locked');
    expect(e.message).toBe(ERRORS.locked);
  });

  it('sends { error, message, ...extra }', async () => {
    const res = await app().inject({ method: 'GET', url: '/conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'version_conflict', message: ERRORS.version_conflict, entry: { version: 3 } });
  });

  it('hides 5xx details', async () => {
    const res = await app().inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('server_error');
    expect(res.body).not.toContain('secret internals');
  });

  it('maps validation errors to 400 bad_request', async () => {
    const res = await app().inject({ method: 'POST', url: '/schema', payload: { x: 'no' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_request', message: ERRORS.bad_request });
  });

  it('404 not_found', async () => {
    const res = await app().inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/errors.test.js`
Expected: FAIL — `Failed to load url ../src/errors.js`.

- [ ] **Step 3: Implement `server/src/errors.js`**

```js
export const ERRORS = {
  bad_request: 'ข้อมูลไม่ถูกต้อง',
  unauthenticated: 'กรุณาเข้าสู่ระบบ',
  bad_credentials: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  forbidden: 'ไม่มีสิทธิ์เข้าถึง',
  deadline_passed: 'หมดเวลาส่งผลงานแล้ว',
  not_found: 'ไม่พบข้อมูล',
  version_conflict: 'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่',
  too_large: 'ไฟล์มีขนาดใหญ่เกินกำหนด',
  bad_type: 'ไม่รองรับไฟล์ประเภทนี้',
  incomplete: 'ยังกรอกข้อมูลไม่ครบ',
  locked: 'ส่งผลงานแล้ว แก้ไขไม่ได้',
  rate_limited: 'ลองใหม่อีกครั้งในภายหลัง',
  drive_unavailable: 'ยังไม่ได้เชื่อมต่อ Google Drive',
  server_error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่'
};

const CODE_BY_STATUS = { 400: 'bad_request', 401: 'unauthenticated', 403: 'forbidden', 404: 'not_found', 413: 'too_large', 415: 'bad_type', 429: 'rate_limited' };

export function httpError(status, code, message = ERRORS[code], extra = {}) {
  const err = new Error(message);
  err.statusCode = status;
  err.code = code;
  err.extra = extra;
  err.isHttpError = true;
  return err;
}

export function errorHandler(err, request, reply) {
  if (err.isHttpError) {
    return reply.code(err.statusCode).send({ error: err.code, message: err.message, ...err.extra });
  }
  if (err.validation) {
    return reply.code(400).send({ error: 'bad_request', message: ERRORS.bad_request });
  }
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  if (status >= 500) {
    request.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: ERRORS.server_error });
  }
  const code = CODE_BY_STATUS[status] || 'bad_request';
  return reply.code(status).send({ error: code, message: ERRORS[code] });
}

export function notFoundHandler(request, reply) {
  reply.code(404).send({ error: 'not_found', message: ERRORS.not_found });
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/errors.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```powershell
git add server/src/errors.js server/test/errors.test.js
git commit -m "feat(server): error helper and JSON error handler" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Users

**Files:**
- Create: `server/src/users.js`, `server/test/users.test.js`

`getUserAuth(db, id)` is an addition to the contract's list: it returns `{ user: PublicUser, sessionVersion, disabled }` so `requireUser` can check the session without leaking those fields into `PublicUser`. `getUserById` is built on it.

- [ ] **Step 1: Write the failing test**

`server/test/users.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { getUserById, getUserByUsername, getUserAuth, bumpSessionVersion, clearUserCache, toClientUser } from '../src/users.js';

let db;
beforeEach(() => {
  clearUserCache();
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (1, 'kmutt', 'h', 'ผู้ประสานงาน', 1, 0)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (2, 'admin1', 'h', 'Admin', NULL, 1)").run();
});

describe('users', () => {
  it('getUserById returns a PublicUser', () => {
    expect(getUserById(db, 1)).toEqual({ id: 1, username: 'kmutt', name: 'ผู้ประสานงาน', role: 'coordinator', universityId: 1, university: 'มจธ', universityCode: 'kmutt' });
    expect(getUserById(db, 2)).toEqual({ id: 2, username: 'admin1', name: 'Admin', role: 'admin', universityId: null, university: null, universityCode: null });
    expect(getUserById(db, 99)).toBeNull();
  });

  it('getUserByUsername includes password_hash', () => {
    expect(getUserByUsername(db, 'kmutt').password_hash).toBe('h');
    expect(getUserByUsername(db, 'nobody')).toBeUndefined();
  });

  it('bumpSessionVersion updates the row and the cache', () => {
    expect(getUserAuth(db, 1).sessionVersion).toBe(0);
    bumpSessionVersion(db, 1);
    expect(getUserAuth(db, 1).sessionVersion).toBe(1);
  });

  it('toClientUser keeps only username, name, university, role', () => {
    expect(toClientUser(getUserById(db, 1))).toEqual({ username: 'kmutt', name: 'ผู้ประสานงาน', university: 'มจธ', role: 'coordinator' });
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/users.test.js`
Expected: FAIL — `Failed to load url ../src/users.js`.

- [ ] **Step 3: Implement `server/src/users.js`**

```js
// id -> { user: PublicUser, sessionVersion, disabled }
const cache = new Map();

export function clearUserCache() {
  cache.clear();
}

export function getUserAuth(db, id) {
  if (cache.has(id)) return cache.get(id);
  const row = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.university_id, u.session_version, u.disabled,
           un.name AS university_name, un.code AS university_code
    FROM users u LEFT JOIN universities un ON un.id = u.university_id
    WHERE u.id = ?`).get(id);
  if (!row) return null;
  const record = {
    user: {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role === 1 ? 'admin' : 'coordinator',
      universityId: row.university_id ?? null,
      university: row.university_name ?? null,
      universityCode: row.university_code ?? null
    },
    sessionVersion: row.session_version,
    disabled: row.disabled === 1
  };
  cache.set(id, record);
  return record;
}

export function getUserById(db, id) {
  return getUserAuth(db, id)?.user ?? null;
}

export function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function bumpSessionVersion(db, id) {
  db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(id);
  clearUserCache();
}

// Shape sent to the browser
export function toClientUser(user) {
  return { username: user.username, name: user.name, university: user.university, role: user.role };
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/users.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add server/src/users.js server/test/users.test.js
git commit -m "feat(server): user lookups with cache" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Entry helpers (keys, blanks, sanitising, list)

**Files:**
- Create: `server/src/entries.js`, `server/test/entries.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/entries.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { isValidEntryKey, allEntryKeys, blankData, sanitizeData, listEntries, getEntryRow, rowToEntry } from '../src/entries.js';

let db;
beforeEach(() => {
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
});

describe('isValidEntryKey', () => {
  it.each([
    ['clip', true], ['hardware', true], ['theory.g0', true], ['theory.g4', true], ['practice.g3', true],
    ['theory.g5', false], ['practice.g4', false], ['theory', false], ['practice', false],
    ['clip.g0', false], ['theory.g01', false], ['nope', false], ['', false], [undefined, false]
  ])('%s -> %s', (key, ok) => {
    expect(isValidEntryKey(key)).toBe(ok);
  });
});

describe('allEntryKeys', () => {
  it('has 17 valid keys in TRACKS order', () => {
    const keys = allEntryKeys();
    expect(keys).toHaveLength(17);
    expect(keys.slice(0, 2)).toEqual(['theory.g0', 'theory.g1']);
    expect(keys).toContain('practice.g3');
    expect(keys.at(-1)).toBe('pitching');
    expect(keys.every(isValidEntryKey)).toBe(true);
  });
});

describe('blankData', () => {
  it('sets the subject group for grouped keys and has no status', () => {
    const d = blankData('theory.g4');
    expect(d.subjectGroup).toBe('กลุ่มสาขาวิชาคอมพิวเตอร์');
    expect(d).not.toHaveProperty('status');
    expect(d.video).toBeNull();
    expect(d.links).toEqual({ video: '' });
    expect(blankData('clip').subjectGroup).toBe('');
  });
});

describe('sanitizeData', () => {
  it('drops unknown keys, rebuilds file refs and caps members', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, type: 'student', fullName: 'x'.repeat(500), dept: 'd', evil: 1,
      photo: { fileId: 7, name: 'p.jpg', size: 10, ext: 'jpg', mime: 'image/jpeg', dataUrl: 'javascript:alert(1)' }
    }));
    const d = sanitizeData('hardware', {
      projectName: '  ok  ', status: 'submitted', hash: 'x', universityId: 2, members,
      files: [{ fileId: 3, name: 'a.pdf', size: 5, ext: 'pdf', mime: 'application/pdf' }, { name: 'nofileid' }],
      links: { video: 'https://youtu.be/x', github: 'g' }, video: { driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' }
    });
    expect(d).not.toHaveProperty('status');
    expect(d).not.toHaveProperty('hash');
    expect(d).not.toHaveProperty('universityId');
    expect(d.projectName).toBe('ok');
    expect(d.members).toHaveLength(4); // hardware: 3 competitors + 1 advisor
    expect(d.members[0]).not.toHaveProperty('evil');
    expect(d.members[0].fullName).toHaveLength(200);
    expect(d.members[0].photo.dataUrl).toBe('/api/files/7');
    expect(d.files).toEqual([{ id: 3, fileId: 3, name: 'a.pdf', size: 5, ext: 'pdf', mime: 'application/pdf', status: 'done', progress: 100, url: '/api/files/3' }]);
    expect(d.links).toEqual({ video: 'https://youtu.be/x' });
    expect(d.video).toBeNull(); // only clip keeps a video
    expect(sanitizeData('clip', { video: { driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' } }).video)
      .toEqual({ driveFileId: 'abc', name: 'v', size: 1, mime: 'video/mp4' });
  });

  it('forces the subject group from the key', () => {
    expect(sanitizeData('theory.g0', { subjectGroup: 'hack' }).subjectGroup).toBe('กลุ่มสาขาวิชาไฟฟ้า');
  });
});

describe('listEntries', () => {
  it('creates 17 blank entries on first call, once', () => {
    const entries = listEntries(db, 1);
    expect(Object.keys(entries)).toHaveLength(17);
    expect(entries.clip).toMatchObject({ status: 'not_started', version: 1, draftAt: null, submittedAt: null, hash: null, projectName: '' });
    listEntries(db, 1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n).toBe(17);
    expect(rowToEntry(getEntryRow(db, 1, 'theory.g2')).subjectGroup).toBe('กลุ่มสาขาวิชาโยธา');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/entries.test.js`
Expected: FAIL — `Failed to load url ../src/entries.js`.

- [ ] **Step 3: Implement `server/src/entries.js`** (first part; Task 7 appends `saveDraft`, `submitEntry`, `assertBeforeDeadline`)

```js
import { TRACKS, getTrack, entryKey, parseEntryKey, isGrouped } from '../../src/data/tracks.js';
import { emptySubmission } from '../../src/data/seedData.js';
import { tx } from './db.js';

const STATUS_NAMES = ['not_started', 'draft', 'submitted'];
const LIMITS = { short: 50, name: 200, text: 2000, url: 500, id: 64 };
const MAX_FILES = 20;

const nowSec = () => Math.floor(Date.now() / 1000);
const iso = (sec) => (sec == null ? null : new Date(sec * 1000).toISOString());
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fileId = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);
const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

const findTrack = (id) => TRACKS.find(t => t.id === id);

export function isValidEntryKey(key) {
  if (typeof key !== 'string') return false;
  const plain = findTrack(key);
  if (plain) return !isGrouped(plain);
  const m = /^([a-z]+)\.g(0|[1-9]\d*)$/.exec(key);
  if (!m) return false;
  const track = findTrack(m[1]);
  return !!track && isGrouped(track) && Number(m[2]) < track.subjectGroups.length;
}

export function allEntryKeys() {
  return TRACKS.flatMap(t => (isGrouped(t) ? t.subjectGroups.map((_, i) => entryKey(t.id, i)) : [t.id]));
}

const subjectGroupFor = (key) => {
  const track = getTrack(key);
  return isGrouped(track) ? track.subjectGroups[parseEntryKey(key).groupIdx] : '';
};

export function blankData(key) {
  const { status, ...rest } = emptySubmission({ subjectGroup: subjectGroupFor(key) });
  return { ...rest, links: { video: '' }, video: null };
}

function sanitizePhoto(p) {
  const id = fileId(p?.fileId);
  if (!id) return null;
  return { fileId: id, name: str(p.name, LIMITS.name), size: num(p.size), ext: str(p.ext, 10), mime: str(p.mime, 100), dataUrl: `/api/files/${id}` };
}

function sanitizeFile(f) {
  const id = fileId(f?.fileId);
  if (!id) return null;
  return { id, fileId: id, name: str(f.name, LIMITS.name), size: num(f.size), ext: str(f.ext, 10), mime: str(f.mime, 100), status: 'done', progress: 100, url: `/api/files/${id}` };
}

function sanitizeMember(m) {
  if (!m || (m.type !== 'advisor' && m.type !== 'student')) return null;
  const out = {
    id: str(m.id, LIMITS.id),
    type: m.type,
    title: str(m.title, LIMITS.short),
    fullName: str(m.fullName, LIMITS.name),
    dept: str(m.dept, LIMITS.name),
    university: str(m.university, LIMITS.name),
    email: str(m.email, LIMITS.name),
    phone: str(m.phone, LIMITS.short),
    source: str(m.source, LIMITS.short),
    photo: sanitizePhoto(m.photo)
  };
  if (m.type === 'student') {
    out.studentId = str(m.studentId, LIMITS.short);
    out.year = str(m.year, 10);
    out.isLeader = m.isLeader === true;
  }
  return out;
}

function sanitizeVideo(v) {
  if (!v || typeof v.driveFileId !== 'string' || !v.driveFileId) return null;
  return { driveFileId: str(v.driveFileId, 200), name: str(v.name, LIMITS.name), size: num(v.size), mime: str(v.mime, 100) };
}

// Keeps only known keys; never trusts status/hash/version/times from the client.
export function sanitizeData(key, data = {}) {
  const track = getTrack(key);
  const maxMembers = track.maxCompetitors + (track.advisorCount || 1);
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    projectName: str(data.projectName, LIMITS.name),
    summary: str(data.summary, LIMITS.text),
    notes: str(data.notes, LIMITS.text),
    members: list(data.members).map(sanitizeMember).filter(Boolean).slice(0, maxMembers),
    files: list(data.files).map(sanitizeFile).filter(Boolean).slice(0, MAX_FILES),
    links: { video: str(data.links?.video, LIMITS.url) },
    video: track.id === 'clip' ? sanitizeVideo(data.video) : null,
    subjectGroup: subjectGroupFor(key)
  };
}

export function rowToEntry(row) {
  return {
    ...JSON.parse(row.data),
    status: STATUS_NAMES[row.status],
    draftAt: iso(row.draft_at),
    submittedAt: iso(row.submitted_at),
    hash: row.hash ?? null,
    version: row.version
  };
}

export function getEntryRow(db, universityId, key) {
  return db.prepare('SELECT * FROM submissions WHERE university_id = ? AND entry_key = ?').get(universityId, key);
}

function ensureRows(db, universityId) {
  const have = new Set(db.prepare('SELECT entry_key FROM submissions WHERE university_id = ?').all(universityId).map(r => r.entry_key));
  const missing = allEntryKeys().filter(k => !have.has(k));
  if (!missing.length) return;
  const insert = db.prepare('INSERT OR IGNORE INTO submissions (university_id, entry_key, data) VALUES (?, ?, ?)');
  tx(db, () => {
    for (const key of missing) insert.run(universityId, key, JSON.stringify(blankData(key)));
  });
}

export function listEntries(db, universityId) {
  ensureRows(db, universityId);
  const rows = db.prepare('SELECT * FROM submissions WHERE university_id = ?').all(universityId);
  const byKey = Object.fromEntries(rows.map(r => [r.entry_key, r]));
  const out = {};
  for (const key of allEntryKeys()) out[key] = rowToEntry(byKey[key]);
  return out;
}

export { nowSec, ensureRows };
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/entries.test.js`
Expected: PASS (all `isValidEntryKey` cases, `allEntryKeys`, `blankData`, 2 `sanitizeData`, `listEntries`).

- [ ] **Step 5: Commit**

```powershell
git add server/src/entries.js server/test/entries.test.js
git commit -m "feat(server): entry keys, blank entries, sanitising, listEntries" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Save, submit and deadline helpers

**Files:**
- Modify: `server/src/entries.js` (append)
- Create: `server/test/entries-write.test.js`

- [ ] **Step 1: Write the failing test**

`server/test/entries-write.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { listEntries, saveDraft, submitEntry, assertBeforeDeadline, getEntryRow } from '../src/entries.js';

let db;
beforeEach(() => {
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id) VALUES (1, 'kmutt', 'h', 'k', 1)").run();
  listEntries(db, 1);
});

const addFile = (id, key) => db.prepare(
  "INSERT INTO files (id, university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (?, 1, ?, 0, 'x', 1, 'image/jpeg', 'p.jpg', 1, 0)"
).run(id, key);

const photo = (fileId) => ({ fileId, name: 'p.jpg', size: 1, ext: 'jpg', mime: 'image/jpeg' });
const completeHardware = () => ({
  members: [
    { id: 'a', type: 'advisor', fullName: 'อาจารย์', dept: 'D', photo: photo(1) },
    { id: 's', type: 'student', fullName: 'นักศึกษา', dept: 'D', isLeader: true, photo: photo(2) }
  ]
});

const code = (fn) => { try { fn(); } catch (e) { return e; } throw new Error('expected throw'); };

describe('saveDraft', () => {
  it('saves, sets draft and bumps the version', () => {
    const e = saveDraft(db, 1, 'hardware', { projectName: 'x' }, 1);
    expect(e).toMatchObject({ status: 'draft', version: 2, projectName: 'x' });
    expect(e.draftAt).toMatch(/^\d{4}-/);
  });

  it('throws version_conflict with the current entry', () => {
    saveDraft(db, 1, 'hardware', { projectName: 'first' }, 1);
    const err = code(() => saveDraft(db, 1, 'hardware', { projectName: 'stale' }, 1));
    expect(err.code).toBe('version_conflict');
    expect(err.statusCode).toBe(409);
    expect(err.extra.entry).toMatchObject({ projectName: 'first', version: 2 });
  });
});

describe('submitEntry', () => {
  it('fails with the incomplete list', () => {
    const err = code(() => submitEntry(db, 1, 'hardware'));
    expect(err.statusCode).toBe(422);
    expect(err.extra.failed.map(f => f.key)).toEqual(expect.arrayContaining(['advisors', 'team', 'photos']));
    expect(err.extra.failed[0]).toHaveProperty('label');
    expect(err.extra.failed[0]).toHaveProperty('error');
  });

  it('fails when a photo file is not in the files table', () => {
    addFile(1, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    const err = code(() => submitEntry(db, 1, 'hardware'));
    expect(err.statusCode).toBe(422);
    expect(err.extra.failed).toEqual([{ key: 'files', label: 'ไฟล์แนบไม่ถูกต้อง', error: 'ไฟล์แนบไม่ถูกต้อง' }]);
  });

  it('submits a complete entry, then locks it', () => {
    addFile(1, 'hardware');
    addFile(2, 'hardware');
    saveDraft(db, 1, 'hardware', completeHardware(), 1);
    const e = submitEntry(db, 1, 'hardware');
    expect(e.status).toBe('submitted');
    expect(e.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(e.submittedAt).toMatch(/^\d{4}-/);
    expect(code(() => saveDraft(db, 1, 'hardware', {}, e.version)).statusCode).toBe(423);
    expect(code(() => submitEntry(db, 1, 'hardware')).statusCode).toBe(423);
    expect(getEntryRow(db, 1, 'hardware').status).toBe(2);
  });
});

describe('assertBeforeDeadline', () => {
  it('throws deadline_passed after the deadline', () => {
    expect(() => assertBeforeDeadline({ deadline: '2999-01-01T00:00:00Z' })).not.toThrow();
    const err = code(() => assertBeforeDeadline({ deadline: '2000-01-01T00:00:00Z' }));
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('deadline_passed');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/entries-write.test.js`
Expected: FAIL — `SyntaxError: The requested module '../src/entries.js' does not provide an export named 'saveDraft'`.

- [ ] **Step 3: Append to `server/src/entries.js`**

Add these imports at the top of the file, below the existing ones:
```js
import crypto from 'node:crypto';
import { getRequirements } from '../../src/utils/requirements.js';
import { httpError } from './errors.js';
```

Append at the end of the file:
```js
export function assertBeforeDeadline(config) {
  if (Date.now() > Date.parse(config.deadline)) throw httpError(403, 'deadline_passed');
}

function loadRow(db, universityId, key) {
  ensureRows(db, universityId);
  return getEntryRow(db, universityId, key);
}

export function saveDraft(db, universityId, key, data, version) {
  const row = loadRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked');
  if (row.version !== version) throw httpError(409, 'version_conflict', undefined, { entry: rowToEntry(row) });
  const clean = sanitizeData(key, data);
  const res = db.prepare(`
    UPDATE submissions SET data = ?, status = 1, draft_at = ?, version = version + 1
    WHERE university_id = ? AND entry_key = ? AND version = ? AND status <> 2`
  ).run(JSON.stringify(clean), nowSec(), universityId, key, version);
  if (res.changes !== 1) {
    const current = getEntryRow(db, universityId, key);
    if (current.status === 2) throw httpError(423, 'locked');
    throw httpError(409, 'version_conflict', undefined, { entry: rowToEntry(current) });
  }
  return rowToEntry(getEntryRow(db, universityId, key));
}

const FILES_LABEL = 'ไฟล์แนบไม่ถูกต้อง';

function missingFileRefs(db, universityId, key, entry) {
  const ids = [
    ...(entry.members || []).map(m => m.photo?.fileId).filter(Boolean),
    ...(entry.files || []).map(f => f.fileId)
  ];
  if (!ids.length) return false;
  const known = new Set(db.prepare('SELECT id FROM files WHERE university_id = ? AND entry_key = ?').all(universityId, key).map(r => r.id));
  return ids.some(id => !known.has(id));
}

export function submitEntry(db, universityId, key) {
  const row = loadRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked');
  const entry = rowToEntry(row);
  const failed = getRequirements(getTrack(key), entry)
    .filter(r => !r.ok)
    .map(r => ({ key: r.key, label: r.label, error: r.error }));
  if (!failed.length && missingFileRefs(db, universityId, key, entry)) {
    failed.push({ key: 'files', label: FILES_LABEL, error: FILES_LABEL });
  }
  if (failed.length) throw httpError(422, 'incomplete', undefined, { failed });
  const hash = crypto.randomBytes(6).toString('hex');
  db.prepare(`
    UPDATE submissions SET status = 2, submitted_at = ?, hash = ?, version = version + 1
    WHERE university_id = ? AND entry_key = ? AND status <> 2`
  ).run(nowSec(), hash, universityId, key);
  return rowToEntry(getEntryRow(db, universityId, key));
}
```

Note: submit also bumps `version`, so an open tab holding the old version gets 423 (locked) first, never a silent overwrite.

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/entries-write.test.js test/entries.test.js`
Expected: PASS (all tests in both files).

- [ ] **Step 5: Commit**

```powershell
git add server/src/entries.js server/test/entries-write.test.js
git commit -m "feat(server): saveDraft, submitEntry and deadline check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: App, auth plugin and test helpers

**Files:**
- Create: `server/src/auth.js`, `server/src/app.js`, `server/test/helpers.js`, `server/test/auth.test.js`

- [ ] **Step 1: Write the test helpers**

`server/test/helpers.js`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { clearUserCache } from '../src/users.js';

export async function makeTestApp(overrides = {}) {
  clearUserCache();
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-up-'));
  const config = loadConfig({ NODE_ENV: 'test', UPLOAD_DIR: uploadDir, ...overrides });
  const db = openDb(':memory:');
  db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)').run(1, 'kmutt', 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี');
  db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)').run(2, 'rmutt', 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี');
  const addUser = db.prepare('INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, ?)');
  addUser.run('kmutt', bcrypt.hashSync('pass-kmutt-1', 4), 'ผู้ประสานงาน มจธ.', 1, 0);
  addUser.run('rmutt', bcrypt.hashSync('pass-rmutt-1', 4), 'ผู้ประสานงาน มทร.ธัญบุรี', 2, 0);
  addUser.run('admin1', bcrypt.hashSync('pass-admin-1', 4), 'Admin', null, 1);
  const app = buildApp({ db, config });
  await app.ready();
  return { app, db, config };
}

export async function loginAs(app, username, password) {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find(c => c.name === 'tta_session');
  return `tta_session=${cookie.value}`;
}
```

- [ ] **Step 2: Write the failing test**

`server/test/auth.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { clearUserCache } from '../src/users.js';

const login = (app, username, password) => app.inject({ method: 'POST', url: '/api/login', payload: { username, password } });

describe('POST /api/login', () => {
  it('logs in a coordinator and returns user + 17 submissions', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toEqual({ username: 'kmutt', name: 'ผู้ประสานงาน มจธ.', university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', role: 'coordinator' });
    expect(Object.keys(body.submissions)).toHaveLength(17);
    const cookie = res.cookies.find(c => c.name === 'tta_session');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBe(7 * 24 * 3600);
  });

  it('admin login returns empty submissions', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'admin1', 'pass-admin-1');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { role: 'admin', university: null }, submissions: {} });
  });

  it('wrong password -> 401 bad_credentials', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'wrong');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('bad_credentials');
    expect((await login(app, 'nobody', 'x')).json().error).toBe('bad_credentials');
  });

  it('disabled user -> 401 bad_credentials', async () => {
    const { app, db } = await makeTestApp();
    db.prepare("UPDATE users SET disabled = 1 WHERE username = 'kmutt'").run();
    clearUserCache();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('bad_credentials');
  });

  it('missing fields -> 400 bad_request', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { username: 'kmutt' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('bad_request');
  });

  it('rate limits after 10 attempts per minute', async () => {
    const { app } = await makeTestApp();
    for (let i = 0; i < 10; i++) expect((await login(app, 'kmutt', 'wrong')).statusCode).toBe(401);
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited', message: 'ลองใหม่อีกครั้งในภายหลัง' });
  });
});

describe('GET /api/me', () => {
  it('401 without a cookie', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('unauthenticated');
  });

  it('401 with a forged (unsigned) cookie', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: 'tta_session=1.0' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns user and submissions with a cookie', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('kmutt');
    expect(Object.keys(res.json().submissions)).toHaveLength(17);
  });

  it('401 once the user is disabled', async () => {
    const { app, db } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    db.prepare("UPDATE users SET disabled = 1 WHERE username = 'kmutt'").run();
    clearUserCache();
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('POST /api/logout', () => {
  it('clears the cookie and invalidates the old one', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const out = await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);
    expect(out.json()).toEqual({ ok: true });
    expect(out.cookies.find(c => c.name === 'tta_session').value).toBe('');
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: Run it**

Run: `cd server; npx vitest run test/auth.test.js`
Expected: FAIL — `Failed to load url ../src/app.js`.

- [ ] **Step 4: Implement `server/src/auth.js`**

```js
import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import { httpError } from './errors.js';
import { getUserAuth, getUserByUsername, bumpSessionVersion, toClientUser } from './users.js';
import { listEntries } from './entries.js';

export const COOKIE_NAME = 'tta_session';
const MAX_AGE = 7 * 24 * 3600;
let dummyHash = null; // compared when the username is unknown, so timing does not reveal it

function cookieOptions(config) {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: MAX_AGE };
}

function submissionsFor(db, user) {
  return user.role === 'coordinator' ? listEntries(db, user.universityId) : {};
}

async function authPlugin(app, { db, config }) {
  app.decorateRequest('user', null);

  async function requireUser(request) {
    const raw = request.cookies[COOKIE_NAME];
    if (!raw) throw httpError(401, 'unauthenticated');
    const { valid, value } = request.unsignCookie(raw);
    const m = valid && /^(\d+)\.(\d+)$/.exec(value);
    if (!m) throw httpError(401, 'unauthenticated');
    const record = getUserAuth(db, Number(m[1]));
    if (!record || record.disabled || record.sessionVersion !== Number(m[2])) throw httpError(401, 'unauthenticated');
    request.user = record.user;
  }

  async function requireAdmin(request) {
    await requireUser(request);
    if (request.user.role !== 'admin') throw httpError(403, 'forbidden');
  }

  async function requireCoordinator(request) {
    await requireUser(request);
    if (request.user.role !== 'coordinator') throw httpError(403, 'forbidden');
  }

  app.decorate('requireUser', requireUser);
  app.decorate('requireAdmin', requireAdmin);
  app.decorate('requireCoordinator', requireCoordinator);

  app.post('/api/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: { type: 'string', minLength: 1, maxLength: 100 }, password: { type: 'string', minLength: 1, maxLength: 200 } }
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body;
    const row = getUserByUsername(db, username.trim().toLowerCase());
    if (!row) {
      dummyHash ??= await bcrypt.hash('dummy-password', 12);
      await bcrypt.compare(password, dummyHash);
      throw httpError(401, 'bad_credentials');
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok || row.disabled === 1) throw httpError(401, 'bad_credentials');
    const record = getUserAuth(db, row.id);
    reply.setCookie(COOKIE_NAME, `${row.id}.${record.sessionVersion}`, cookieOptions(config));
    return { user: toClientUser(record.user), submissions: submissionsFor(db, record.user) };
  });

  app.post('/api/logout', { preHandler: requireUser }, async (request, reply) => {
    bumpSessionVersion(db, request.user.id);
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', { preHandler: requireUser }, async (request) => {
    return { user: toClientUser(request.user), submissions: submissionsFor(db, request.user) };
  });
}

export default fp(authPlugin, { name: 'tta-auth' });
```

- [ ] **Step 5: Implement `server/src/app.js`**

```js
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { errorHandler, notFoundHandler, httpError } from './errors.js';
import authPlugin from './auth.js';

export function buildApp({ db, config, logger = false }) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 1024 * 1024 });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(helmet);
  app.register(compress);
  app.register(cookie, { secret: config.sessionSecret });
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => httpError(429, 'rate_limited')
  });

  app.register(authPlugin, { db, config });
  return app;
}
```

- [ ] **Step 6: Run it**

Run: `cd server; npx vitest run test/auth.test.js`
Expected: PASS (11 tests). If the rate-limit test gets 401 instead of 429 on the 11th call, `@fastify/rate-limit` was registered after the route: keep its `register` above `authPlugin`.

- [ ] **Step 7: Commit**

```powershell
git add server/src/auth.js server/src/app.js server/test/helpers.js server/test/auth.test.js
git commit -m "feat(server): cookie sessions with login, logout, me and rate limit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Submissions routes

**Files:**
- Create: `server/src/submissions.js`, `server/test/submissions.test.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Write the failing test**

`server/test/submissions.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';

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
    { id: 's', type: 'student', fullName: 'นักศึกษา', dept: 'D', isLeader: true, photo: photo(2) }
  ]
};

describe('GET /api/submissions', () => {
  it('returns 17 entries for a coordinator', async () => {
    const { app, cookie } = await asKmutt();
    const res = await req(app, cookie, 'GET', '/api/submissions');
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().submissions)).toHaveLength(17);
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
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/submissions.test.js`
Expected: FAIL — the first test gets `404` (`expected 404 to be 200`) because the routes do not exist yet.

- [ ] **Step 3: Implement `server/src/submissions.js`**

```js
import { httpError } from './errors.js';
import { isValidEntryKey, listEntries, saveDraft, submitEntry, assertBeforeDeadline } from './entries.js';

const keyParams = {
  type: 'object',
  required: ['key'],
  properties: { key: { type: 'string', maxLength: 40 } }
};

function checkKey(key) {
  if (!isValidEntryKey(key)) throw httpError(400, 'bad_request');
}

// Coordinator routes: the university always comes from request.user, never from the URL or body.
export default async function submissionsPlugin(app, { db, config }) {
  app.get('/api/submissions', { preHandler: app.requireCoordinator }, async (request) => {
    return { submissions: listEntries(db, request.user.universityId) };
  });

  app.put('/api/submissions/:key', {
    preHandler: app.requireCoordinator,
    schema: {
      params: keyParams,
      body: {
        type: 'object',
        required: ['data', 'version'],
        properties: { data: { type: 'object' }, version: { type: 'integer', minimum: 1 } }
      }
    }
  }, async (request) => {
    assertBeforeDeadline(config);
    const { key } = request.params;
    checkKey(key);
    const { data, version } = request.body;
    return { entry: saveDraft(db, request.user.universityId, key, data, version) };
  });

  app.post('/api/submissions/:key/submit', {
    preHandler: app.requireCoordinator,
    schema: { params: keyParams }
  }, async (request) => {
    assertBeforeDeadline(config);
    const { key } = request.params;
    checkKey(key);
    return { entry: submitEntry(db, request.user.universityId, key) };
  });
}
```

- [ ] **Step 4: Register it in `server/src/app.js`**

Add the import below `import authPlugin from './auth.js';`:
```js
import submissionsPlugin from './submissions.js';
```
Add below `app.register(authPlugin, { db, config });`:
```js
  app.register(submissionsPlugin, { db, config });
```

- [ ] **Step 5: Run it**

Run: `cd server; npx vitest run test/submissions.test.js`
Expected: PASS (11 tests).

- [ ] **Step 6: Run the whole suite**

Run: `cd server; npm test`
Expected: all test files PASS.

- [ ] **Step 7: Commit**

```powershell
git add server/src/submissions.js server/src/app.js server/test/submissions.test.js
git commit -m "feat(server): submissions list, save and submit routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Entry point and Vite proxy

**Files:**
- Create: `server/src/index.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Implement `server/src/index.js`**

```js
import fs from 'node:fs';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';

// Node ≥ 22.13 reads .env itself when present (process.loadEnvFile)
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig(process.env);
fs.mkdirSync(config.uploadDir, { recursive: true });
const db = openDb(config.dbPath);
const app = buildApp({ db, config, logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' } });

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: process.env.HOST || '127.0.0.1' });
```

(`HOST` is read only here, not in `config.js`; plan D's Docker image sets `HOST=0.0.0.0`.)

- [ ] **Step 2: Start it**

Run: `cd server; npm start`
Expected: a log line `Server listening at http://127.0.0.1:3001` and `server/data/portal.db` exists. Stop with Ctrl+C.

- [ ] **Step 3: Modify `vite.config.js`**

Replace the whole file with:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: { '/api': 'http://localhost:3001' }
  }
});
```

- [ ] **Step 4: Commit**

```powershell
git add server/src/index.js vite.config.js
git commit -m "feat(server): entry point and Vite /api proxy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Seed script

**Files:**
- Create: `server/scripts/seed.js`, `server/test/seed.test.js`

The accounts note (`TeachingAcademy/data/TTA-portal-accounts.md`, outside the repo, i.e. `../../data/` from `server/`) has two markdown tables:
- under `## Coordinators`: columns `Username | Password | University`
- under `## Admins …`: columns `Username | Password | Name`; a name of `(to fill in)` means "use the username".

Only bcrypt hashes are stored. Passwords are never printed or logged. Re-running the seed updates hashes and names (upsert), leaving `session_version` and `disabled` untouched.

- [ ] **Step 1: Write the failing test** (uses made-up passwords only)

`server/test/seed.test.js`:
```js
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { openDb } from '../src/db.js';
import { UNIVERSITY_CODES, parseAccounts, seed } from '../scripts/seed.js';

const MD = `# accounts

## Coordinators

| Username | Password | University |
|---|---|---|
| kmitl | test-pass-a | สจล. สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง |
| kmutt | test-pass-b | มจธ. มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี |

## Admins (committee)

Some text.

| Username | Password | Name |
|---|---|---|
| admin1 | test-pass-c | (to fill in) |
| admin2 | test-pass-d | สมศรี |
`;

describe('seed', () => {
  it('lists 10 universities in UNIVERSITIES order', () => {
    expect(UNIVERSITY_CODES.map(u => u.code)).toEqual(['kmitl', 'kmutt', 'kmutnb', 'rmutk', 'rmutsb', 'rmutp', 'rmutt', 'rmutl', 'rmutsv', 'rmuti']);
    expect(UNIVERSITY_CODES[1].name).toBe('มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี');
  });

  it('parses both tables', () => {
    const a = parseAccounts(MD);
    expect(a.coordinators).toEqual([{ username: 'kmitl', password: 'test-pass-a' }, { username: 'kmutt', password: 'test-pass-b' }]);
    expect(a.admins).toEqual([{ username: 'admin1', password: 'test-pass-c', name: 'admin1' }, { username: 'admin2', password: 'test-pass-d', name: 'สมศรี' }]);
  });

  it('seeds universities and users, idempotently', () => {
    const db = openDb(':memory:');
    seed(db, parseAccounts(MD), 4);
    seed(db, parseAccounts(MD), 4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(10);
    const k = db.prepare("SELECT u.*, un.code FROM users u JOIN universities un ON un.id = u.university_id WHERE username = 'kmutt'").get();
    expect(k.code).toBe('kmutt');
    expect(k.role).toBe(0);
    expect(bcrypt.compareSync('test-pass-b', k.password_hash)).toBe(true);
    const admin = db.prepare("SELECT * FROM users WHERE username = 'admin2'").get();
    expect(admin).toMatchObject({ role: 1, university_id: null, name: 'สมศรี' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(4);
  });

  it('rejects an unknown coordinator username', () => {
    const db = openDb(':memory:');
    expect(() => seed(db, { coordinators: [{ username: 'xyz', password: 'p' }], admins: [] }, 4)).toThrow(/xyz/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd server; npx vitest run test/seed.test.js`
Expected: FAIL — `Failed to load url ../scripts/seed.js`.

- [ ] **Step 3: Implement `server/scripts/seed.js`**

```js
// Usage (from server/): npm run seed [-- path/to/TTA-portal-accounts.md]
// Stores bcrypt hashes only. Never prints passwords.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { openDb, tx } from '../src/db.js';
import { loadConfig } from '../src/config.js';

// Same order as UNIVERSITIES in src/data/referenceData.js (not imported: it uses extensionless imports)
export const UNIVERSITY_CODES = [
  { code: 'kmitl', name: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' },
  { code: 'kmutt', name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' },
  { code: 'kmutnb', name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' },
  { code: 'rmutk', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ' },
  { code: 'rmutsb', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ' },
  { code: 'rmutp', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร' },
  { code: 'rmutt', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี' },
  { code: 'rmutl', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา' },
  { code: 'rmutsv', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย' },
  { code: 'rmuti', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน' }
];

const PLACEHOLDER_NAME = '(to fill in)';

// Returns the data rows (array of cell arrays) of the first table after the heading line that starts with `heading`.
function tableAfter(lines, heading) {
  const start = lines.findIndex(l => l.startsWith(heading));
  if (start < 0) return [];
  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) { if (inTable) break; continue; }
    inTable = true;
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
    if (cells.every(c => /^:?-+:?$/.test(c))) continue; // separator row
    rows.push(cells);
  }
  return rows.slice(1); // drop the header row
}

export function parseAccounts(md) {
  const lines = md.split(/\r?\n/);
  const coordinators = tableAfter(lines, '## Coordinators')
    .map(([username, password]) => ({ username, password }));
  const admins = tableAfter(lines, '## Admins')
    .map(([username, password, name]) => ({ username, password, name: !name || name === PLACEHOLDER_NAME ? username : name }));
  return { coordinators, admins };
}

export function seed(db, { coordinators, admins }, cost = 12) {
  const upsertUni = db.prepare('INSERT INTO universities (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name');
  const uniId = db.prepare('SELECT id FROM universities WHERE code = ?');
  const upsertUser = db.prepare(`
    INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name,
      university_id = excluded.university_id, role = excluded.role`);
  const hashed = [
    ...coordinators.map(c => ({ ...c, role: 0 })),
    ...admins.map(a => ({ ...a, role: 1 }))
  ].map(u => ({ ...u, hash: bcrypt.hashSync(u.password, cost) }));

  tx(db, () => {
    for (const u of UNIVERSITY_CODES) upsertUni.run(u.code, u.name);
    for (const u of hashed) {
      if (u.role === 0) {
        const uni = UNIVERSITY_CODES.find(x => x.code === u.username);
        if (!uni) throw new Error(`Unknown coordinator username (must be a university code): ${u.username}`);
        upsertUser.run(u.username, u.hash, `ผู้ประสานงาน ${uni.name}`, uniId.get(u.username).id, 0);
      } else {
        upsertUser.run(u.username, u.hash, u.name, null, 1);
      }
    }
  });
  return { coordinators: coordinators.length, admins: admins.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const serverDir = fileURLToPath(new URL('..', import.meta.url));
  const file = process.argv[2] || path.resolve(serverDir, '../../data/TTA-portal-accounts.md');
  if (fs.existsSync(path.join(serverDir, '.env'))) process.loadEnvFile(path.join(serverDir, '.env'));
  const config = loadConfig(process.env);
  const db = openDb(path.resolve(serverDir, config.dbPath));
  const counts = seed(db, parseAccounts(fs.readFileSync(file, 'utf8')));
  db.close();
  console.log(`Seeded 10 universities, ${counts.coordinators} coordinators, ${counts.admins} admins (passwords not shown).`);
}
```

- [ ] **Step 4: Run it**

Run: `cd server; npx vitest run test/seed.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Seed the dev database for real**

Run: `cd server; npm run seed`
Expected: `Seeded 10 universities, 10 coordinators, 3 admins (passwords not shown).`

- [ ] **Step 6: Commit**

```powershell
git add server/scripts/seed.js server/test/seed.test.js
git commit -m "feat(server): seed universities and accounts from the private note" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Manual smoke test and self-review

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `cd server; npm test`
Expected: every test file PASS, 0 failures.

- [ ] **Step 2: Start both servers**

Terminal 1: `cd server; npm run dev` → `Server listening at http://127.0.0.1:3001`
Terminal 2 (repo root): `npm run dev` → Vite on `http://localhost:3000`

- [ ] **Step 3: Exercise the API through the Vite proxy (PowerShell)**

Use a password from the private accounts note; type it in, do not paste it into any file.
```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$pw = Read-Host 'kmutt password'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/login -WebSession $s -ContentType 'application/json' -Body (@{ username = 'kmutt'; password = $pw } | ConvertTo-Json) | Select-Object -ExpandProperty user
(Invoke-RestMethod -Uri http://localhost:3000/api/me -WebSession $s).submissions.PSObject.Properties.Name.Count   # 17
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/submissions/hardware -WebSession $s -ContentType 'application/json' -Body '{"data":{"notes":"smoke"},"version":1}' | Select-Object -ExpandProperty entry | Select-Object status, version   # draft, 2
try { Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/submissions/hardware -WebSession $s -ContentType 'application/json' -Body '{"data":{},"version":1}' } catch { $_.ErrorDetails.Message }   # version_conflict
try { Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/submissions/hardware/submit -WebSession $s } catch { $_.ErrorDetails.Message }   # incomplete + failed list
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/logout -WebSession $s   # ok: True
try { Invoke-RestMethod -Uri http://localhost:3000/api/me -WebSession $s } catch { $_.Exception.Response.StatusCode.value__ }   # 401
```
Expected: the values in the comments. Also check the response headers of any call include `x-content-type-options: nosniff` (helmet).

- [ ] **Step 4: Reset the smoke data**

Stop the API, delete `server/data/portal.db*`, then `cd server; npm run seed`.

- [ ] **Step 5: Self-review checklist**

- `git status` shows no `server/data/` or `.env` files staged; `git check-ignore server/data/portal.db` prints the path.
- `git grep -n "Password\|password" -- server/` shows no real password (only test values `pass-*`, `test-pass-*`).
- Names match the contracts: `loadConfig`, `openDb`, `buildApp`, `httpError`, `getUserById`, `getUserByUsername`, `bumpSessionVersion`, `clearUserCache`, `isValidEntryKey`, `allEntryKeys`, `blankData`, `rowToEntry`, `listEntries`, `getEntryRow`, `saveDraft`, `submitEntry`, `assertBeforeDeadline`, `makeTestApp`, `loginAs`, cookie `tta_session`.
- No coordinator route reads a university id from params, query or body (`git grep -n "universityId" -- server/src/submissions.js` shows only `request.user.universityId`).

- [ ] **Step 6: Commit (only if Step 5 needed fixes)**

```powershell
git add server/
git commit -m "chore(server): fixes from plan A self-review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Notes for plans B–D

- `entries.js` also exports `nowSec` and `ensureRows` for reuse (plan B upload routes need the row to exist before inserting into `files`, because of the foreign key).
- `unlockEntry` (plan D) belongs in `entries.js`: `UPDATE submissions SET status = 1, hash = NULL, submitted_at = NULL, version = version + 1`.
- `buildApp` accepts an optional `logger` option (default `false`) in addition to `{ db, config }`.
- `users.js` adds `getUserAuth(db, id)` and `toClientUser(user)` to the contract's list.
- `errors.js` adds `server_error` (500) to the contract's table, and exports `ERRORS`, `errorHandler`, `notFoundHandler`.
