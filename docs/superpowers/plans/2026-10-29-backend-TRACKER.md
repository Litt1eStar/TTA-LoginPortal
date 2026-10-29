# Backend implementation tracker

One list for the whole backend build. Tick a box when its task is done and committed. The detail for each task (code, tests, commands) lives in the linked plan; read [00 contracts](2026-10-29-backend-00-contracts.md) first.

**Goal:** 10 universities submit for real by **4 Nov 2026**.
**Branch:** `backend`, merged into `main` only after approval.
**Status key:** ⬜ todo · 🟨 in progress · ✅ done · ⛔ blocked (say why in Notes)

## Progress

| Phase | Plan | Tasks | Done | Target |
|---|---|---|---|---|
| A | [Server core](2026-10-29-backend-a-server-core.md) | 12 | 12 ✅ (awaiting approval) | 29–30 Oct |
| B | [Files + Google Drive video](2026-10-29-backend-b-files-drive.md) | 8 | 0 | 30–31 Oct |
| C | [Frontend wiring](2026-10-29-backend-c-frontend.md) | 14 | 0 | 30–31 Oct |
| D | [Admin, export, deploy](2026-10-29-backend-d-admin-deploy.md) | 13 | 0 | 31 Oct–3 Nov |
| **All** | | **47** | **12** | **go-live 4 Nov** |

**Order:** A must be finished before anything else. After that, B and C can run side by side. Exceptions:
- C11 (video UI) needs B7.
- D4 needs B5.
- D12 needs everything else.

## Must-have for 4 Nov

These have to be done by go-live:
- all of A
- B1–B4 and B6–B7
- C0–C10 and C12–C13
- D2–D4 (at least the CSV), D5, D8, D10 or D11, and D12

These can follow later: the D6 admin page polish, and the D4 zip download. Until the zip exists, files can be pulled for the organisers by hand.

## A · Server core — [plan](2026-10-29-backend-a-server-core.md)

- [x] **A1** Branch `backend` + scaffold `server/` (package.json, .gitignore, .env.example, vitest); commit pending `docs/` + `photo.js`
- [x] **A2** Config (`loadConfig`, production secret check)
- [x] **A3** Database + migrations (`openDb`, `001_init.sql`, WAL)
- [x] **A4** Errors (`httpError`, Thai messages, error and 404 handlers)
- [x] **A5** Users (lookups, cache, session version)
- [x] **A6** Entry helpers (17 keys, blanks, sanitising, list)
- [x] **A7** Save / submit / deadline helpers (409, 422, 423, hash)
- [x] **A8** App + auth plugin + test helpers (login, logout, me, rate limit)
- [x] **A9** Submissions routes (cross-university isolation tests)
- [x] **A10** Entry point + Vite `/api` proxy
- [x] **A11** Seed script (10 universities, accounts from the private note, hashes only)
- [x] **A12** Manual smoke test + self-review

## B · Files + Google Drive video — [plan](2026-10-29-backend-b-files-drive.md)

- [ ] **B1** Packages, `settings` table, token encryption (AES-256-GCM)
- [ ] **B2** Checklist accepts an uploaded video (shared `requirements.js`)
- [ ] **B3** Photo + work-file upload (real type check, sha256 dedupe, limits)
- [ ] **B4** Download + delete files (own university or admin)
- [ ] **B5** Google Drive client with injectable fetch (folders, resumable session, quota)
- [ ] **B6** Admin OAuth connect / callback / status
- [ ] **B7** Video routes (session, confirm, delete)
- [ ] **B8** 👤 Manual check with the real Google account *(needs you)*

## C · Frontend wiring — [plan](2026-10-29-backend-c-frontend.md)

- [ ] **C0** Preflight (branch, commit pending `photo.js` change)
- [ ] **C1** Vitest + dev proxy
- [ ] **C2** `src/api.js` (ApiError, JSON calls, upload with progress)
- [ ] **C3** Autosave helper (1 s debounce, skip unchanged, versions)
- [ ] **C4** Photo data URL → File
- [ ] **C5** Resumable Drive upload helper (8 MB chunks, resume, cancel)
- [ ] **C6** PortalContext on the server + loader + routes + login
- [ ] **C7** Async draft / submit (SubmitView, ConfirmSubmitModal, 422 list)
- [ ] **C8** Navbar save indicator (replaces reset-demo button)
- [ ] **C9** Photo upload in MemberModal
- [ ] **C10** FileUploader with real progress
- [ ] **C11** Video upload for สื่อสร้างสรรค์ *(needs B7)*
- [ ] **C12** Remove demo data from the live build
- [ ] **C13** Full flow check in the browser

## D · Admin, export, deploy — [plan](2026-10-29-backend-d-admin-deploy.md)

- [ ] **D1** Dependencies + config fields (`serveStatic`, `staticDir`)
- [ ] **D2** `unlockEntry`
- [ ] **D3** CSV builder (BOM, Thai headers, formula-injection guard)
- [ ] **D4** Admin routes: overview, detail, unlock, CSV, zip *(needs B5)*
- [ ] **D5** Health route + serve the frontend from the API (one process)
- [ ] **D6** Admin page (matrix, detail, unlock, Drive card, downloads)
- [ ] **D7** `/admin` route guard + admin navbar
- [ ] **D8** Backup script (SQLite backup, uploads copy, 14 days)
- [ ] **D9** Load test (50 concurrent saves, p99 < 20 ms)
- [ ] **D10** Docker image + compose (Scenario A)
- [ ] **D11** Bare-Node systemd + reverse proxy (Scenario B)
- [ ] **D12** 👤 Install on server, real accounts, load test, restore drill, go-live checklist *(needs you)*
- [ ] **D13** 👤 Merge `backend` → `main` *(only after your approval)*

## Needs you (human steps)

- [x] Google OAuth app published (In production) and client JSON saved privately
- [x] Homepage + privacy policy live on GitHub Pages
- [x] Coordinator + admin passwords generated (private note)
- [ ] Fill in the admin names in the private accounts note (`admin1`–`admin3`)
- [ ] B8: copy the Google client values into `server/.env` (never commit it), then connect Drive
- [ ] Choose a deploy target: Scenario A (Docker) or B (bare Node) on the university server
- [ ] Add the production redirect URI to the Google OAuth client
- [ ] D12: go-live checklist sign-off
- [ ] D13: approve the merge to `main`
- [ ] Confirm the final deadline (currently 15 Jan 2027 23:59, set by `DEADLINE`)

## Known risks

| Risk | Mitigation |
|---|---|
| A dropped video upload can't resume if Google hides the `Range` header from the browser | C11's manual check tests it early; fallback is restarting the upload |
| Excel drops leading zeros in phone numbers and student IDs | Runbook: import with Data → From Text/CSV and set those columns to Text |
| The Google token stops working if the app is moved back to Testing | Keep the app In production; the admin page shows "ต้องเชื่อมต่อใหม่" |
| Gmail storage (15 GB) fills up | The admin Drive card shows the quota; worst case is about 5 GB |
| Tight timeline | Must-have list above; the zip and admin-page polish can follow |

## Notes / log

| Date | Task | Note |
|---|---|---|
| 29 Oct | — | All plans written; nothing implemented yet |
| 29 Oct | A1–A12 | Plan A built on `backend`: 17 commits, 114 tests passing. Review fixes: atomic submit, input hardening, CSRF 415 hook, trusted proxy, login caps (10/min per IP+user, 30/min per IP), server-side 7-day session expiry, server-relative paths. Real accounts not seeded yet (needs you). |
