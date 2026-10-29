# Portal backend plan

Goal: by **4 Nov 2026**, 10 university coordinators log in and submit for real, and the organisers can see and export everything.
Today all data lives in each browser's localStorage ([PortalContext.jsx](../src/context/PortalContext.jsx)), and the logins are demo accounts ([accounts.js](../src/data/accounts.js)).

Stack: **Node.js ≥ 22.13 + Fastify + SQLite (Node's built-in `node:sqlite`, WAL mode), plain SQL with no ORM**. Detailed task plans: `docs/superpowers/plans/2026-10-29-backend-*.md`. Files are stored on disk. The same code runs in Docker or directly on the server (see `../../data/University Server Deploy Plan.md`).

Why this stack (size: 10 universities, ~170 entries, a few hundred members, a few GB of uploads):
- **SQLite instead of PostgreSQL.** The database runs inside the Node process, with no network hop and no connection pool. Reads take microseconds. All non-file data fits in one file of about 1 MB, backed up by copying that file. WAL mode with `synchronous=NORMAL` handles 10 people writing at once easily.
- **Built-in `node:sqlite` with plain SQL instead of Prisma.** There's no query-engine binary (about 40 MB) and no native build step: `better-sqlite3` would need C++ build tools on Windows. The schema is about 40 lines of SQL. Moving to PostgreSQL later means porting those queries.
- **Fastify instead of Express.** About 2–3× the raw throughput, with built-in JSON-schema validation.
- **Language stays Node.js.** Bun or Go would gain less than 1 ms per request at this scale, which no one can feel, and Go would lose the shared `requirements.js` / `tracks.js`. Response time is decided by network distance, file size and the number of round-trips, so those are where the optimisations below go.

## Key decisions

1. **Reuse the frontend rules on the server.** `src/utils/requirements.js` and `src/data/tracks.js` are plain JS with no browser APIs. The server imports them directly, so "can this be submitted?" uses one rule set in both places.
2. **One row per entry, data as JSONB.** The frontend already keeps each entry as one object (`projectName`, `summary`, `notes`, `links`, `members[]`, `subjectGroup`). It's stored as is, with no table per member. That keeps the frontend change small, and the CSV export flattens it.
3. **Files are real uploads; only references live in the JSON.** A photo becomes `{ fileId, name, size, ext, dataUrl: "/api/files/<id>" }`. Keeping the `dataUrl` key means every `<img src={m.photo.dataUrl}>` and the photo check in `requirements.js` keep working unchanged.
   - Photos are shrunk in the browser (`utils/photo.js`) to 400px **WebP** at 0.8 quality before upload, about 20–30 KB each. It falls back to JPEG if the browser can't encode WebP.
   - Stored files are named by their sha256 hash, so a photo uploaded twice is stored once. They are served with `Cache-Control: immutable`, so each photo downloads only once.
4. **The university always comes from the session, never from the request.** A coordinator can't read or write another university's data, whatever they send.
5. **Autosave.** Each change is saved to the server about 1 second later. Only the entry that changed is sent, and nothing is sent if its data didn't change. The "บันทึกฉบับร่าง" button saves immediately. A small "กำลังบันทึก… / บันทึกแล้ว" indicator shows the state.
   - Login returns the user and all of their entries in one response, so the app needs no second request on start.
   - API JSON is gzip/brotli compressed. Static assets are pre-compressed at build time.
6. **A submitted entry is locked** (matches the current UI text "ระบบทำการล็อกข้อมูลแล้ว"). Confirmed by the organisers: universities can't edit after submitting. Only an admin can unlock one.

## Folder layout

```
TTA-LoginPortal/
  server/
    package.json          (separate deps from the frontend)
    drizzle/              generated SQL migrations
    data/                 portal.db (SQLite) + uploads/ (not committed)
    src/
      db/schema.js        Drizzle schema
      index.js            app + routes
      config.js           env vars
      auth.js             login, sessions, requireUser / requireAdmin
      submissions.js      entry routes
      files.js            upload / download / delete
      admin.js            overview, unlock, CSV export, file zip
      validate.js         JSON schemas for entry data (Fastify built-in validation)
    scripts/seed.js       creates universities + accounts and prints passwords once
    scripts/backup.sh     SQLite .backup + uploads copy
    test/                 vitest + fastify.inject
    Dockerfile
```

There is no database container: SQLite is just a file under `server/data/`.

`vite.config.js`: proxy `/api` to `localhost:3000` in development.

## Database (SQLite, compact schema)

Rules:
- Small integers stand in for repeated text: university id, and codes for status, kind and role.
- Times are integer epoch seconds.
- Entry data is compact JSON text.
- Each table has exactly the indexes its lookups need, and no more.

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE universities (
  id   INTEGER PRIMARY KEY,           -- 1..10
  name TEXT NOT NULL UNIQUE           -- full Thai name, stored once
);

CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  university_id   INTEGER REFERENCES universities(id),  -- NULL for admins
  role            INTEGER NOT NULL DEFAULT 0,           -- 0 coordinator, 1 admin
  session_version INTEGER NOT NULL DEFAULT 0,           -- bump to log out everywhere
  disabled        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE submissions (
  university_id INTEGER NOT NULL REFERENCES universities(id),
  entry_key     TEXT    NOT NULL,     -- 'theory.g0', 'singing', 'clip', ...
  status        INTEGER NOT NULL DEFAULT 0,   -- 0 not_started, 1 draft, 2 submitted
  data          TEXT    NOT NULL DEFAULT '{}', -- projectName, summary, notes, links, members, subjectGroup
  version       INTEGER NOT NULL DEFAULT 1,   -- guards against two open tabs overwriting each other
  draft_at      INTEGER,
  submitted_at  INTEGER,
  hash          TEXT,
  PRIMARY KEY (university_id, entry_key)
) WITHOUT ROWID;                      -- the primary key is the only index needed

CREATE TABLE files (
  id            INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL,
  entry_key     TEXT    NOT NULL,
  kind          INTEGER NOT NULL,     -- 0 photo, 1 work
  sha256        TEXT    NOT NULL,     -- file on disk is uploads/<sha256>, so duplicates are stored once
  size          INTEGER NOT NULL,
  mime          TEXT    NOT NULL,
  original_name TEXT    NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (university_id, entry_key) REFERENCES submissions(university_id, entry_key)
);
CREATE INDEX files_by_entry ON files(university_id, entry_key);
```

- A file on disk is deleted only when no `files` row references its sha256 any more.
- **Sessions:** a signed, HttpOnly cookie holds `{ userId, sessionVersion }`. There is no session table and no database lookup per request: the small `users` table is cached in memory and refreshed on change. Logging out, or disabling an account, bumps `session_version`, which takes effect immediately.
- **Expected size:** the database file is about 1 MB for the whole contest. Almost all storage is the uploaded files.

## API

All routes are under `/api` and require login unless marked otherwise. "Own" means the session user's university.

| Method | Path | Does |
|---|---|---|
| POST | `/login` (public) | username and password → session cookie, and returns the same body as `/me` plus `/submissions` in one response. Rate limited. |
| POST | `/logout` | ends the session |
| GET | `/me` | `{ username, name, university, role }` |
| GET | `/submissions` | all own entries as `{ [entryKey]: entry }`; missing entries are created blank (same as `normalizeSubmissions`) |
| PUT | `/submissions/:key` | saves draft data with `{ data, version }`. 409 if version is stale, 423 if submitted, 403 after the deadline |
| POST | `/submissions/:key/submit` | runs `getRequirements`; if all pass, locks the entry and returns `{ hash, submittedAt }`. Otherwise returns 422 with the failed items |
| POST | `/submissions/:key/files?kind=photo\|work` | multipart upload, returns the file reference |
| GET | `/files/:id` | streams the file if it belongs to an own entry (or the user is an admin) |
| DELETE | `/files/:id` | only while the entry isn't submitted |
| GET | `/admin/overview` | universities × entries with status |
| GET | `/admin/submissions/:university/:key` | full entry |
| POST | `/admin/submissions/:university/:key/unlock` | back to draft |
| GET | `/admin/export.csv` | one row per member (university, category, group, role, title, name, faculty, ...). UTF-8 with BOM so Excel reads Thai |
| GET | `/admin/files.zip?key=` | all photos and work files of one category, in folders per university |

Server checks:
- **Entry key:** must exist in `TRACKS` (and the group index must be in range).
- **Entry data:** validated with Fastify's JSON schema. Members are capped at track max + advisor limit, and text fields have length limits.
- **Files:** checked by real content, not just the extension (`file-type`). Photos: webp/jpeg at most 200 KB after resizing (a 400px WebP is about 25 KB). They are written to disk as a stream, never buffered whole in memory. Work files: pdf/zip/ppt/pptx on the portal server. Videos: mp4/mov at most **500 MB**, stored in Google Drive (see below). Photo originals at most **5 MB** before resizing. Both limits come from env (`MAX_WORK_MB`, `MAX_PHOTO_MB`), so they can change later without code changes. Large uploads are resumable in chunks, so a dropped connection doesn't restart a 500 MB file. A cap on total files per entry.
- **Deadline:** `DEADLINE` from env (default `FINAL_DEADLINE` from tracks.js). After it, saves, uploads and submits are refused.

## Video uploads to Google Drive (สื่อสร้างสรรค์ only)

- **What users upload:** an MP4/MOV video (up to 500 MB) in the สื่อสร้างสรรค์ form, alongside the existing YouTube link field. Either one passes the checklist.
- **Where it's stored:** the project lead's **personal Gmail Drive**, not the portal server, in a folder the portal creates itself: "TTA 2027 วิดีโอ". Its id is saved in the database the first time Google is connected.
- **Storage:** videos use that Gmail account's storage (15 GB free, shared with Gmail and Photos). The worst case is 10 universities × 500 MB = 5 GB, so check there's room. The admin page shows the remaining space.

**Why not a service account:** service accounts can't store files in a personal Gmail Drive, because they have no storage quota and Shared Drives need Google Workspace. So the server uploads **as the Gmail owner**, using OAuth.

**Account set-up (one-time, done by the project lead):**
1. In Google Cloud, use the project with the Drive API enabled. The service account and its key aren't needed; delete the key.
2. Set up the **OAuth consent screen**:
   - User type **External**, app name "TTA Portal".
   - Add your own Gmail as a test user.
   - Under **Data access / Scopes**, add only `.../auth/drive.file`. This is a *non-sensitive* scope: the app can see only the files it creates. Remove any other Drive scope, because the full `drive` scope is *restricted* and blocks publishing until Google's verification review, which takes weeks.
   - Then press **Publish app** to move it to *In production*. While it's in *Testing*, Google expires the permission every 7 days and uploads would stop. With only non-sensitive scopes, publishing needs no review.
3. Create credentials: **OAuth client ID → Web application**.
   - Add the redirect URI `http://localhost:3000/api/admin/google/callback`, and the production URL later.
   - Download the client JSON and keep it outside the repo.
4. Server env:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
5. Log in to the portal as an admin and press **"เชื่อมต่อ Google Drive"**.
   - Choose the Gmail account and allow access (scope `drive.file`). On the first connect, the server creates the "TTA 2027 วิดีโอ" folder in that Drive and saves its id.
   - The server stores only the **refresh token**, encrypted in the database with `TOKEN_KEY` from env.
   - The page then shows "เชื่อมต่อแล้ว" and the account's free space. If the token is ever revoked, the page shows "ต้องเชื่อมต่อใหม่", and video uploads pause with a clear message.

**Upload flow (the browser sends the video straight to Google, not through our server):**
1. The browser asks `POST /api/submissions/clip/video` with `{ name, size, mime }`. The server checks:
   - login and the university
   - that the entry isn't submitted
   - that it's before the deadline
   - that the type is mp4/mov
   - that the size is ≤ `MAX_VIDEO_MB` (500)
2. The server creates the folder `TTA 2027 วิดีโอ/<university short name>/` if it doesn't exist. It then starts a Drive **resumable upload session** with the stored OAuth token (sending the browser's `Origin` so CORS is allowed) and returns only the one-time session URL.
3. The browser uploads the file to that URL in 8 MB chunks, with a real progress bar. If the connection drops, it asks Google how much arrived and continues from there.
4. When Google answers with the file id, the browser calls `POST /api/submissions/clip/video/confirm` with `{ driveFileId }`. The server reads the file's metadata from Drive and rejects it, deleting it from Drive, unless:
   - it is in the right folder
   - its size is within the limit
   - its type is video/mp4 or video/quicktime
5. The entry stores only a small reference: `video: { driveFileId, name, size, mime }`. Replacing or removing a video deletes the old file from Drive while the entry is still a draft.

**Why direct-to-Drive:**
- A 500 MB file never passes through or fills the portal server.
- The upload is faster, since there is one hop instead of two.
- Google handles resuming the upload.
- The Google token never leaves the server; the browser only ever sees one short-lived upload URL.

**Viewing:**
- **Coordinators** see the file name, size and a status.
- **Admins** get a "เปิดใน Google Drive" link. To let the other admins browse the folder directly, share it with their Google accounts as *Viewer*. The zip export lists Drive links instead of copying videos.

**Frontend:**
- `submit/FileUploader.jsx` gets a "วิดีโอ (MP4/MOV)" upload area with progress, retry and remove.
- `requirements.js` deliverables passes with an uploaded file, a video or a YouTube link.

Security basics: bcrypt (cost 12), `@fastify/helmet`, `@fastify/rate-limit` on login, `SameSite=Lax` + `HttpOnly` + `Secure` cookie, JSON-only bodies with a size limit, uploads stored outside any served folder, and no stack traces in responses.

## Frontend changes

| File | Change |
|---|---|
| `src/api.js` (new) | small `fetch` wrapper: JSON, cookies, errors to Thai messages, 401 → back to login |
| `context/PortalContext.jsx` | load `/me` and `/submissions` on start; keep a loading state; replace the localStorage effects with a per-entry debounced `PUT`; `login`, `saveDraft` and `confirmSubmit` become async; `addFiles` / `removeFile` call the files API with upload progress; remove `resetAllDataToDefault` |
| `auth/LoginView.jsx` | await `login`; remove the demo-fill button and the demo hint |
| `submit/MemberModal.jsx` | after `processPhoto`, upload the result and store the returned reference |
| `submit/FileUploader.jsx` | show the real upload progress and errors from the server |
| `submit/ConfirmSubmitModal.jsx` | await `confirmSubmit`; show the server's error if it refuses |
| `layout/Navbar.jsx` | remove the "reset demo data" button; show the save indicator |
| `data/accounts.js`, `data/seedData.js` | no longer used in the live build (kept only for a demo mode, or deleted) |
| `admin/AdminView.jsx` (new) | `/admin` route for admins: status table per university, CSV export button, zip download per category |

The CSV import, tracks, requirements, dashboard, history and certificates screens stay as they are.

## Work order

| # | Day | Task | Done when |
|---|---|---|---|
| 1 | 29 Oct | Scaffold `server/` (Fastify), SQLite + Drizzle schema + first migration, config | `npm run dev` starts the API and creates `portal.db` |
| 2 | 29 Oct | Auth: login/logout/me, sessions, seed script | tests: right password ok, wrong refused, rate limit kicks in |
| 3 | 30 Oct | Submissions: list, save, submit, version check, deadline | tests: A can't read or write B; a submitted entry can't be changed; incomplete entries can't be submitted |
| 4 | 30 Oct | Files: upload, download, delete, type and size checks | tests: a fake .jpg is rejected; no downloading another university's file |
| 4b | 31 Oct | Video to Google Drive: OAuth connect (admin), resumable session, confirm check, delete on replace | a 500 MB MP4 lands in `TTA 2027 วิดีโอ/<university>/`; a dropped connection resumes; a wrong type or oversize file is rejected and removed |
| 5 | 30–31 Oct | Frontend wiring (table above) | a full flow in the browser; reload on another browser shows the same data |
| 6 | 31 Oct | Admin view + CSV + zip | CSV opens in Excel with Thai correct |
| 7 | 31 Oct | API Dockerfile, production compose, backup script, staging on the CMM droplet | staging test from a phone on mobile data; `autocannon` with 50 concurrent saves shows p99 < 20 ms and no write errors; restoring from backup works |
| 8 | 1–3 Nov | University server install (Scenario A or B), real accounts, full test | go-live checklist in the deploy plan passes |

Items 1–5 are must-have for 4 Nov. Item 6's CSV is must-have, while the admin page and zip can follow if time runs out (the organisers can use the CSV, and we can pull files for them directly).

## Answers from the organisers

1. **Edit after submit:** no. A submitted entry is locked, and only an admin can unlock it.
2. **Coordinator accounts:**
   - **Usernames:** the university's English short name: `kmitl`, `kmutt`, `kmutnb`, `rmutk`, `rmutsb`, `rmutp`, `rmutt`, `rmutl`, `rmutsv`, `rmuti`. These are used instead of the Thai short names, which are hard to type in a login box.
   - **Passwords:** 10 random characters each, generated once.
   - **Where they're kept:** a private note outside this repository (`../data/TTA-portal-accounts.md`). It is never committed.
   - **Seeding:** `scripts/seed.js` reads that note and stores only bcrypt hashes.
3. **Admins:** 2–3 people from KMUTT, who download the committee information (CSV and files). Accounts are `admin1`–`admin3`; names are still to fill in, and unused ones are disabled.
4. **File limits:** videos are MP4/MOV only, up to 500 MB; photo originals up to 5 MB. Both may change later and are set from env.
5. **Video storage:** videos upload from the platform into a folder in the project lead's personal Gmail Drive (via OAuth), only for สื่อสร้างสรรค์. The YouTube link stays as an alternative.

6. **Deadline:** 15 Jan 2027 23:59 for now. It's set from env `DEADLINE`, so a change later needs only a restart.
7. **Google set-up:** done by the project lead (Woody), with a personal Gmail and the `drive.file` scope, so the app can be published without review. The portal creates its own Drive folder, which means the manually made folder isn't used. Follow "Account set-up" in the video section. ✅ The OAuth app is published to *In production* (29 Oct 2026). Its homepage and privacy policy are on GitHub Pages (`site/`). Still needed before task 4b can be tested: the OAuth client ID and secret, kept outside the repo.

## Still open

Nothing blocking. Confirm the final deadline with the organisers when it's known.
