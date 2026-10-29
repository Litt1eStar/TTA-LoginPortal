# Backend shared contracts (read before any backend plan)

This file fixes the names, shapes and interfaces that plans A–D all use. If a plan disagrees with this file, this file wins.

Background: `docs/BACKEND_PLAN.md` explains the *why*. Plans in this folder are the *how*:

| Plan | Covers |
|---|---|
| `2026-10-29-backend-a-server-core.md` | scaffold, database, auth, entries API |
| `2026-10-29-backend-b-files-drive.md` | photo and work-file uploads, video to Google Drive |
| `2026-10-29-backend-c-frontend.md` | wiring the React app to the API |
| `2026-10-29-backend-d-admin-deploy.md` | admin API and page, CSV, zip, Docker, backup |

Execution order: A, then B, then C, then D. B, C and D assume A is merged.

## Amendments from plan A (binding)

1. **`links` keeps only `video`.** `blankData` and the sanitiser drop the old `github` / `drive` keys.
2. **Seed file location:** the seed script reads `../../data/TTA-portal-accounts.md` relative to `server/` (the private `TeachingAcademy/data` folder). A path argument overrides it.
3. **Submit bumps `version`**, as save does. A tab still holding the old version then gets 423, not a silent overwrite.
4. **Extra error:** 500 `server_error`, "เกิดข้อผิดพลาด กรุณาลองใหม่". It is used for unexpected errors and never includes details.
5. **`fastify-plugin` ^5** wraps the auth plugin, so `requireUser`, `requireAdmin` and `requireCoordinator` are visible to every route plugin.
6. **Extra exports:**
   - `users.js`: `getUserAuth` and `toClientUser`
   - `errors.js`: `ERRORS`, `errorHandler` and `notFoundHandler`
   - `entries.js`: `nowSec` and `ensureRows`
   - `buildApp` takes an optional `logger` option.
7. **`HOST` env** is read only in `index.js`; it defaults to `127.0.0.1`.

## Amendments from plan B (binding)

1. **Test hooks:** `makeTestApp(overrides = {}, appOptions = {})`, and `buildApp({ db, config, logger, googleFetch })`. `googleFetch` replaces `fetch` for every Google call, so tests never touch the real Google.
2. **Video sanitising:** `video` survives sanitising only on `clip` and only as `{ driveFileId, name, size, mime }`; anything else becomes `null`. Plan A already does this.
3. **File cap:** more than 40 files on one entry gives 400 `bad_request` with "แนบไฟล์ได้สูงสุด 40 ไฟล์ต่อรายการ".
4. **Wrong-folder confirm:** a video confirm pointing at a file in another university's Drive folder gets 422, and that file is **never deleted**. A file in an unknown folder is deleted.
5. **Google failures:** a Drive error after connecting gives 503 `drive_unavailable`, with the message "Google Drive ขัดข้อง กรุณาลองใหม่".
6. **Photo types:** photos accept webp, jpeg and png. The browser sends webp or jpeg; png is accepted only as a fallback.

## Amendments from plans C and D (binding)

1. **423 `locked` body:** it has no `entry`. The frontend reloads `GET /submissions` after a 423.
2. **`unlockEntry` bumps `version`**, as submit does.
3. **New config fields:** `serveStatic: env.SERVE_STATIC === 'true'` and `staticDir: env.STATIC_DIR || '../dist'`. In production the API serves the built frontend, with an SPA fallback. Requests under `/api` still get the JSON 404.
4. **Public health check:** `GET /api/health` returns `{ ok: true }`.
5. **Frontend limits are copied, not sent:** the frontend hard-codes the work-file limit (50 MB, pdf/zip/ppt/pptx) and the video limit (500 MB, mp4/mov) to match the server defaults. If the env limits change, change `src/data/tracks.js` too.
6. **The old Docker setup stays:** the existing root `Dockerfile` and `infra/` are left untouched. The new API image is a separate compose project, `tta-api`. Switching CI over is a separate change that needs approval.

## Stack decisions (final)

- **Runtime:** Node.js ≥ 22.13, using the built-in **`node:sqlite`** (`DatabaseSync`). There is no `better-sqlite3` (it needs native build tools on Windows) and no ORM. Queries are plain SQL with prepared statements.
- **Fastify 5**, with these plugins:
  - `@fastify/cookie` (signed cookies)
  - `@fastify/helmet`
  - `@fastify/rate-limit`
  - `@fastify/multipart` (uploads, plan B)
  - `@fastify/compress`
- **Passwords:** `bcryptjs`, which is pure JS so it needs no native build. Cost 12.
- **Tests:** `vitest`, with `app.inject()` (no real network). Every test uses an in-memory database (`':memory:'`).
- **Ports:** the API listens on **3001**. Vite (frontend dev) stays on **3000** and proxies `/api` to 3001. That way the Google redirect URI `http://localhost:3000/api/admin/google/callback` reaches the API through the proxy.
- **Shared rules:** the server imports the frontend's plain-JS files directly. These files must stay free of browser APIs and of imports from React files.
  - `../../src/data/tracks.js` provides `TRACKS`, `getTrack`, `entryKey`, `parseEntryKey`, `isGrouped`, `FINAL_DEADLINE` and `SUBJECT_GROUP_HINTS`.
  - `../../src/utils/requirements.js` provides `getRequirements`.
  - `../../src/data/seedData.js` provides `emptySubmission`.

## Folder layout (server)

```
server/
  package.json            "type": "module"; scripts: dev, start, test, seed, backup
  .env.example            every variable from config.js, with safe example values
  migrations/001_init.sql
  migrations/002_settings.sql        (plan B: Google token + folder ids)
  src/config.js           loadConfig(env = process.env) -> config object
  src/db.js               openDb(path) -> DatabaseSync (pragmas + migrations)
  src/app.js              buildApp({ db, config }) -> Fastify instance (not listening)
  src/index.js            loads config, opens db, buildApp, listen
  src/errors.js           httpError(status, code, message) + the error handler
  src/users.js            user lookups + in-memory cache
  src/auth.js             plugin: /api/login, /api/logout, /api/me; requireUser / requireAdmin
  src/entries.js          entry helpers (pure functions + db access)
  src/submissions.js      plugin: /api/submissions routes
  src/files.js            plugin: /api/submissions/:key/files, /api/files/:id   (plan B)
  src/drive.js            Google OAuth + Drive client                          (plan B)
  src/video.js            plugin: /api/submissions/clip/video routes            (plan B)
  src/admin.js            plugin: /api/admin routes                             (plan D)
  src/csv.js              buildMembersCsv(rows)                                 (plan D)
  scripts/seed.js         reads ../data/TTA-portal-accounts.md -> users table
  scripts/backup.js       SQLite backup + uploads copy                          (plan D)
  test/helpers.js         makeTestApp(), loginAs()
  test/*.test.js
  data/                   portal.db + uploads/   (git-ignored)
```

## config (`src/config.js`)

`loadConfig(env)` returns the object below. It throws if `SESSION_SECRET` is shorter than 32 characters while `NODE_ENV=production`.

```js
{
  port: Number(env.PORT || 3001),
  dbPath: env.DB_PATH || 'data/portal.db',            // relative to server/
  uploadDir: env.UPLOAD_DIR || 'data/uploads',
  sessionSecret: env.SESSION_SECRET || 'dev-only-secret-change-me-dev-only-secret',
  cookieSecure: env.COOKIE_SECURE === 'true',
  deadline: env.DEADLINE || FINAL_DEADLINE,            // ISO string
  maxPhotoKB: Number(env.MAX_PHOTO_KB || 200),         // resized photo (server check)
  maxWorkMB: Number(env.MAX_WORK_MB || 50),            // pdf/zip/ppt/pptx
  maxVideoMB: Number(env.MAX_VIDEO_MB || 500),         // mp4/mov (Drive)
  tokenKey: env.TOKEN_KEY || '',                       // 64 hex chars; encrypts the Google refresh token
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/admin/google/callback'
  },
  appOrigin: env.APP_ORIGIN || 'http://localhost:3000' // browser origin, for Drive CORS + redirects
}
```

## Database (`migrations/001_init.sql`)

`openDb(path)`:
1. Opens the file.
2. Runs the pragmas (`journal_mode=WAL` except for `:memory:`, `synchronous=NORMAL`, `foreign_keys=ON`).
3. Applies every `migrations/NNN_*.sql` whose number is greater than `PRAGMA user_version`, in a transaction, then sets `user_version`.

```sql
CREATE TABLE universities (
  id   INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,      -- 'kmutt' (also the coordinator username and Drive folder name)
  name TEXT NOT NULL UNIQUE       -- full Thai name
);

CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  university_id   INTEGER REFERENCES universities(id),
  role            INTEGER NOT NULL DEFAULT 0,   -- 0 coordinator, 1 admin
  session_version INTEGER NOT NULL DEFAULT 0,
  disabled        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE submissions (
  university_id INTEGER NOT NULL REFERENCES universities(id),
  entry_key     TEXT    NOT NULL,
  status        INTEGER NOT NULL DEFAULT 0,     -- 0 not_started, 1 draft, 2 submitted
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
  kind          INTEGER NOT NULL,             -- 0 photo, 1 work
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

`migrations/002_settings.sql` (plan B):
```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
-- keys: 'google.refresh_token' (AES-256-GCM, base64), 'google.email', 'drive.root_folder',
--       'drive.folder.<universityCode>'
```

Times in the database are **epoch seconds**. Times in the API are **ISO strings**.

## Session and user (`src/auth.js`, `src/users.js`)

- **Cookie:** the name is `tta_session`; it is signed with `config.sessionSecret`. The value is `"<userId>.<sessionVersion>"`.
  - Flags: `httpOnly`, `sameSite: 'lax'`, `secure: config.cookieSecure`, `path: '/'`, `maxAge` 7 days.
- **`users.js`:**
  - `getUserById(db, id)` returns `PublicUser` or `null`.
  - `getUserByUsername(db, username)` returns a row including `password_hash`.
  - `bumpSessionVersion(db, id)`.
  - Rows are cached in a `Map`, which is cleared by `clearUserCache()` after any write.
- **`request.user`** (set by `requireUser`) is a `PublicUser`:
  ```js
  { id, username, name, role: 'coordinator' | 'admin', universityId: number | null, university: string | null, universityCode: string | null }
  ```
- **Hooks:**
  - `app.requireUser` (a preHandler) gives **401 `unauthenticated`** when there's no or a bad cookie, the user is disabled, or the version doesn't match.
  - `app.requireAdmin` runs `requireUser`, then gives **403 `forbidden`** unless the role is admin.
  - `app.requireCoordinator` runs `requireUser`, then gives **403 `forbidden`** unless the role is coordinator.

## Error format (`src/errors.js`)

Every error body is `{ "error": "<code>", "message": "<Thai text for the user>" }`. Some errors add extra fields, listed below.

`httpError(status, code, message, extra = {})` returns an `Error` carrying `statusCode`, `code` and `extra`. The app's `setErrorHandler`:
- maps Fastify validation errors to 400 `bad_request`
- never sends stack traces
- logs 5xx errors

| Status | code | Thai message | Used for |
|---|---|---|---|
| 400 | `bad_request` | ข้อมูลไม่ถูกต้อง | schema failures, unknown entry key |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ | no or invalid session |
| 401 | `bad_credentials` | ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง | login |
| 403 | `forbidden` | ไม่มีสิทธิ์เข้าถึง | role or university mismatch |
| 403 | `deadline_passed` | หมดเวลาส่งผลงานแล้ว | save, upload or submit after the deadline |
| 404 | `not_found` | ไม่พบข้อมูล | |
| 409 | `version_conflict` | ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่ | extra `{ entry }` = the current server entry |
| 413 | `too_large` | ไฟล์มีขนาดใหญ่เกินกำหนด | |
| 415 | `bad_type` | ไม่รองรับไฟล์ประเภทนี้ | |
| 422 | `incomplete` | ยังกรอกข้อมูลไม่ครบ | extra `{ failed: [{ key, label, error }] }` |
| 423 | `locked` | ส่งผลงานแล้ว แก้ไขไม่ได้ | |
| 429 | `rate_limited` | ลองใหม่อีกครั้งในภายหลัง | |
| 503 | `drive_unavailable` | ยังไม่ได้เชื่อมต่อ Google Drive | plan B |

## Entry shape (API ↔ frontend)

The API returns entries in exactly the shape the frontend already uses (`emptySubmission()` in `src/data/seedData.js`), plus a `version` field:

```js
{
  status: 'not_started' | 'draft' | 'submitted',
  projectName, summary, notes,                       // strings
  members: [ { id, type: 'advisor'|'student', title, fullName, dept, university, studentId?, year?,
               email, phone, isLeader?, source, photo: null | PhotoRef } ],
  files:   [ FileRef ],                             // work files
  links:   { video: '' },                           // YouTube link
  video:   null | VideoRef,                         // plan B, clip only
  subjectGroup: '',
  draftAt: ISO | null, submittedAt: ISO | null, hash: string | null,
  version: number
}
PhotoRef = { fileId, name, size, ext, mime, dataUrl: '/api/files/<fileId>' }
FileRef  = { id: fileId, fileId, name, size, ext, mime, status: 'done', progress: 100, url: '/api/files/<fileId>' }
VideoRef = { driveFileId, name, size, mime }
```

- **Stored vs. computed:** the database `data` column stores everything *except* `status`, `draftAt`, `submittedAt`, `hash` and `version`. Those come from their own columns.
- **`src/entries.js` exports:**
  - `isValidEntryKey(key) -> boolean`: the key must be a non-grouped track id, or `<groupedTrackId>.g<n>` with `n` in range. The old bare `theory` / `practice` keys are invalid.
  - `allEntryKeys() -> string[]`: all 17, in `TRACKS` order.
  - `blankData(key) -> object`: `emptySubmission({ subjectGroup })` minus `status`, plus `video: null`.
  - `rowToEntry(row) -> Entry`.
  - `listEntries(db, universityId) -> { [key]: Entry }`: inserts any missing rows first, in one transaction.
  - `getEntryRow(db, universityId, key) -> row | undefined`.
  - `saveDraft(db, universityId, key, data, version) -> Entry`: throws `version_conflict` or `locked`. It sets status 1 and `draft_at`, and bumps the version.
  - `submitEntry(db, universityId, key) -> Entry`: runs `getRequirements`, throws `incomplete` or `locked`, then sets status 2, `submitted_at` and `hash` (12 hex characters from `crypto.randomBytes(6)`).
  - `unlockEntry(db, universityId, key) -> Entry` (plan D): sets status 1 and clears `hash` and `submitted_at`.
- **Saved data is sanitised:** only the known keys are kept, strings are trimmed to limits, and members are capped at `track.maxCompetitors + (track.advisorCount || 1)`.

## API

All under `/api`. "Own" means `request.user.universityId`. **Coordinator routes always take the university from the session**, never from the URL or body.

| Method | Path | Auth | Body | 200 response |
|---|---|---|---|---|
| POST | `/login` | public, rate-limited 10/min/IP | `{ username, password }` | `{ user, submissions }`, plus it sets the cookie |
| POST | `/logout` | user | none | `{ ok: true }`, clears the cookie, bumps `session_version` |
| GET | `/me` | user | none | `{ user, submissions }` (`submissions` is `{}` for admins) |
| GET | `/submissions` | coordinator | none | `{ submissions }` |
| PUT | `/submissions/:key` | coordinator | `{ data, version }` | `{ entry }` |
| POST | `/submissions/:key/submit` | coordinator | none | `{ entry }` |
| POST | `/submissions/:key/files?kind=photo\|work` | coordinator | multipart field `file` | `{ file: PhotoRef \| FileRef }` (B) |
| GET | `/files/:id` | owner's university or admin | none | file bytes, `Cache-Control: private, max-age=31536000, immutable` (B) |
| DELETE | `/files/:id` | coordinator (own, entry not submitted) | none | `{ ok: true }` (B) |
| POST | `/submissions/clip/video` | coordinator | `{ name, size, mime }` | `{ uploadUrl }` (B) |
| POST | `/submissions/clip/video/confirm` | coordinator | `{ driveFileId }` | `{ video: VideoRef }` (B) |
| DELETE | `/submissions/clip/video/:driveFileId` | coordinator | none | `{ ok: true }` (B) |
| GET | `/admin/google/connect` | admin | none | 302 to Google (B) |
| GET | `/admin/google/callback` | admin | `?code&state` | 302 to `${appOrigin}/admin?google=connected` (B) |
| GET | `/admin/google/status` | admin | none | `{ connected, email, quota: { limit, usage } \| null }` (B) |
| GET | `/admin/overview` | admin | none | `{ universities: [{ id, code, name }], entries: { [universityId]: { [key]: { status, submittedAt } } } }` (D) |
| GET | `/admin/submissions/:universityId/:key` | admin | none | `{ entry }` (D) |
| POST | `/admin/submissions/:universityId/:key/unlock` | admin | none | `{ entry }` (D) |
| GET | `/admin/export.csv` | admin | none | CSV, UTF-8 with BOM (D) |
| GET | `/admin/files.zip?key=` | admin | none | zip stream (D) |

`user` in responses is `{ username, name, university, role }`.

Every write route (save, submit, upload, video, delete) returns **403 `deadline_passed`** when `Date.now() > Date.parse(config.deadline)`. The check is one shared helper, `assertBeforeDeadline(config)`, in `src/entries.js`.

**Uploads don't change entry data.** The frontend puts the returned `PhotoRef`, `FileRef` or `VideoRef` into the entry and saves through `PUT /submissions/:key`.

**On submit, file references are checked.** `submitEntry` checks that every `members[].photo.fileId` and `files[].fileId` is a row in `files` for the same university and entry. A missing reference fails with 422 (`key: 'files'`, label `ไฟล์แนบไม่ถูกต้อง`).

## Test helpers (`server/test/helpers.js`)

```js
export async function makeTestApp(overrides = {}) // -> { app, db, config }
// opens ':memory:'; config = loadConfig({ NODE_ENV: 'test', UPLOAD_DIR: <fresh tmp dir>, ...overrides })
// seeds universities 1 'kmutt' 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' and 2 'rmutt' 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี'
// users: kmutt / 'pass-kmutt-1' (coordinator, uni 1), rmutt / 'pass-rmutt-1' (coordinator, uni 2),
//        admin1 / 'pass-admin-1' (admin, no university). bcrypt cost 4 in tests for speed.
export async function loginAs(app, username, password) // -> cookie header string 'tta_session=...'
```

## Frontend contracts (plan C)

- **`src/api.js`:**
  - `export class ApiError extends Error { status; code; extra }`
  - `export const api = { get(path), post(path, body), put(path, body), del(path) }`. JSON in and out, `credentials: 'include'`, path relative to `/api`.
  - On 401 it calls the handler registered with `onUnauthenticated(fn)`.
  - `export function uploadFile(path, file, { onProgress, signal }) -> Promise<json>`, using XHR multipart field `file`.
- **`vite.config.js`:** `server.proxy = { '/api': 'http://localhost:3001' }`.
- **PortalContext** keeps its existing function names (`login`, `logout`, `saveDraft`, `confirmSubmit`, `addOrUpdateMember`, `addFiles`, `removeFile`, …), so components change as little as possible. `login`, `saveDraft` and `confirmSubmit` become `async`.
  - New fields: `loading`, `saveState: 'idle' | 'saving' | 'saved' | 'error'`.
