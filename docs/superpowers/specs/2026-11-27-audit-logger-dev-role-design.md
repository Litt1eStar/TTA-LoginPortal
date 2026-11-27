# Audit Logger & Dev Role Design Specification

## 1. Intent & Why

The Teaching Academy Award Portal (`TTA-LoginPortal`) currently stores only the latest state of each university's submission (`submissions` table) and file rows (`files` table). When a dispute or question arises ("Why is this member missing?", "When was this file deleted?", "Did the coordinator submit or did an admin unlock it?"), there is no historical evidence of what a coordinator or admin did.

We are building a **tamper-evident SQLite audit logger** that records every state-changing action (and failed write/auth attempt) by coordinators, admins, and dev users, including structured **before/after diffs and snapshots** of submission changes. To keep this evidence strictly separate from both coordinators and the organizing committee (`admin`), we are introducing a third role: **`dev` (`role = 2`)**. Only `dev` users can access the `/dev` web view and `/api/dev/logs` endpoints; admins (`role = 1`) and coordinators (`role = 0`) never see the audit logs.

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Evidence-grade audit trail:** Log every coordinator and admin action in SQLite (`audit_logs` table) with timestamp, actor (`userId`, `username`, `role`, `universityId`, `universityCode`), request context (`ip`, `userAgent`), action name, target (`universityId`, `entryKey`, `targetId`), outcome (`status`: `'ok'` or `'error'`, `errorCode`), human-readable summary, and JSON `details` (including field/member/file diffs and before/after state).
- **Autosave-friendly draft logging:** Because the portal autosaves 1 second after typing stops (`PUT /api/submissions/:key`), compute a structured diff (`changedFields`, `membersAdded`, `membersUpdated`, `membersRemoved`, `filesAdded`, `filesRemoved`, `videoChanged`, plus `before` and `after` values for changed keys) and skip inserting a no-op log if nothing in the sanitized data actually changed.
- **Dedicated `dev` user role (`role = 2`):**
  - Stored in `users.role = 2`, mapped to `'dev'` in `users.js`.
  - Seeded from an optional `## Devs` table in `TTA-portal-accounts.md` via `server/scripts/seed.js`.
  - Guarded on the backend by `app.requireDev` (`403 forbidden` for `coordinator` and `admin`).
  - Routed on the frontend strictly to `/dev` (`DevLogsView.jsx`), hidden from `AdminView` and coordinator views.
- **Detailed Dev Web UI (`/dev`):** Filter logs by university, actor/username, role, action category, entry key, outcome (`ok`/`error`), date range, and free-text search; inspect full before/after JSON diff in a detail drawer/modal; and export filtered logs as CSV or JSON.

### Non-Goals
- Logging read-only polling routes (`GET /api/me`, `GET /api/submissions`, `GET /api/admin/overview`, `GET /api/health`) — these carry no state change and would flood the database.
- External log shipping (ELK/Datadog/CloudWatch) — everything must stay self-contained in the SQLite database (`portal.db`) and automatically included in `server/scripts/backup.js`.

### Anti-Goals
- **Never expose audit logs to `admin` or `coordinator`:** `/api/dev/*` must reject `admin` (`role = 1`) with `403 forbidden`, and `/admin` UI must have zero links or references to `/dev`.
- **Never log plaintext passwords, session cookies, or Google OAuth tokens** inside `audit_logs.details`.
- **Never let a logging failure crash or block a coordinator's submission:** Wrap log writes safely or run them inside the same SQLite transaction for atomic state transitions.

## 3. Database Schema (`server/migrations/004_audit_logs.sql`)

```sql
CREATE TABLE audit_logs (
  id              INTEGER PRIMARY KEY,
  created_at      INTEGER NOT NULL,
  user_id         INTEGER REFERENCES users(id),
  username        TEXT    NOT NULL,
  user_role       TEXT    NOT NULL,
  university_id   INTEGER REFERENCES universities(id),
  university_code TEXT,
  action          TEXT    NOT NULL,
  entry_key       TEXT,
  target_id       TEXT,
  status          TEXT    NOT NULL DEFAULT 'ok',
  error_code      TEXT,
  ip              TEXT,
  user_agent      TEXT,
  summary         TEXT    NOT NULL,
  details         TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_logs_created_at ON audit_logs(created_at DESC, id DESC);
CREATE INDEX audit_logs_university ON audit_logs(university_id, created_at DESC);
CREATE INDEX audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX audit_logs_username ON audit_logs(username, created_at DESC);
```

## 4. Roles & Access Control

| DB `users.role` | Client `user.role` | Home Route | Allowed API Prefixes |
|---|---|---|---|
| `0` | `'coordinator'` | `/dashboard` | `/api/submissions/*`, `/api/files/*`, `/api/me`, `/api/logout` |
| `1` | `'admin'` | `/admin` | `/api/admin/*`, `/api/files/:id`, `/api/me`, `/api/logout` |
| `2` | `'dev'` | `/dev` | `/api/dev/*`, `/api/files/:id`, `/api/me`, `/api/logout` |

## 5. Catalog of Logged Actions

| Action Code | Trigger Route | Recorded Details (`details` JSON) |
|---|---|---|
| `auth.login` | `POST /api/login` (200) | `{}` |
| `auth.login_failed` | `POST /api/login` (401/429) | `{ attemptedUsername, reason }` |
| `auth.logout` | `POST /api/logout` (200) | `{}` |
| `submission.save_draft` | `PUT /api/submissions/:key` (200) | `{ versionBefore, versionAfter, diff: { fields, membersAdded, membersUpdated, membersRemoved, filesAdded, filesRemoved, videoChanged }, before, after }` |
| `submission.save_failed` | `PUT /api/submissions/:key` (403/409/423) | `{ clientVersion, serverVersion, errorCode }` |
| `submission.submit` | `POST /api/submissions/:key/submit` (200) | `{ hash, version, projectName, memberCount, fileCount, hasVideo, youtubeUrl }` |
| `submission.submit_failed` | `POST /api/submissions/:key/submit` (403/422/423) | `{ failedRequirements, errorCode }` |
| `file.upload` | `POST /api/submissions/:key/files` (200) | `{ fileId, kind, name, size, mime, sha256 }` |
| `file.upload_failed` | `POST /api/submissions/:key/files` (4xx) | `{ kind, filename, errorCode }` |
| `file.delete` | `DELETE /api/files/:id` (200) | `{ fileId, kind, name, size, mime, sha256 }` |
| `video.session` | `POST /api/submissions/clip/video` (200) | `{ name, size, mime }` |
| `video.confirm` | `POST /api/submissions/clip/video/confirm` (200) | `{ driveFileId, name, size, mime, replacedDriveFileIds }` |
| `video.delete` | `DELETE /api/submissions/clip/video/:driveFileId` (200) | `{ driveFileId }` |
| `admin.unlock` | `POST /api/admin/submissions/:universityId/:key/unlock` (200) | `{ targetUniversityId, targetUniversityCode, previousHash, previousSubmittedAt, versionAfter }` |
| `admin.export` | `GET /api/admin/export.csv`, `certificates.csv`, `files.zip`, `members.zip` | `{ format, query }` |

## 6. Dev API & Web View

- `GET /api/dev/logs`: Paginated & filtered audit logs (`universityId`, `action`, `status`, `role`, `q`, `entryKey`, `from`, `to`, `limit`, `beforeId`) returning `{ logs, total, stats, universities }`.
- `GET /api/dev/logs/:id`: Full single log entry including parsed `details` (`before`, `after`, `diff`).
- `GET /api/dev/logs.csv`: UTF-8 BOM CSV export matching current filter parameters.
- Frontend `/dev` (`src/components/dev/DevLogsView.jsx`): Summary metric strip, filter bar, expandable/modal diff viewer showing exact coordinator changes (added/edited/removed team members, project info edits, uploaded/deleted files, submission hashes), and CSV download button.
