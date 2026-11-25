# KMUTT Server Deploy Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the KMUTT university-server deployment (`TeachingAcademy/university-server/`) into this repo, fix what would break it over plain HTTP, and go live by **Friday 2026-11-27**, with the CMM droplet as a ready fallback.

**Architecture:** One Node process (`server/src/index.js`) serves both `/api` and the built frontend (`SERVE_STATIC=true`) from `C:\tta-portal` on `CIT_TTA2027` (10.2.15.250, Windows Server 2025, no Docker), started by a Scheduled Task. The release zip is built on the laptop from the **committed HEAD** and copied over Remote Desktop. The Docker/CMM path (`server/Dockerfile`, `infra/`, `.github/workflows/deploy.yml`) stays as the fallback.

**Tech Stack:** Node ≥ 22.13 (`node:sqlite`), Fastify 5 + `@fastify/helmet` 13 (helmet 8), Vite 6, PowerShell 5.1, Windows Task Scheduler.

---

## Context: what was found (2026-11-25)

| # | Finding | Impact | Task |
|---|---|---|---|
| 1 | Helmet's default CSP sends `upgrade-insecure-requests` (and HSTS). The KMUTT portal is served over **plain http** at `http://10.2.15.250:3001`. Browsers then request `/assets/*.js` over `https://`, which fails, and the page stays blank. Login over `localhost`/`127.0.0.1` still works, because browsers exempt loopback, which is why the laptop smoke test passed. **Not yet reproduced on a LAN IP:** the local test that binds to the network was blocked in this session. | Probably a blank page for every user | 2 |
| 2 | `package-release.ps1` copies the **working tree**, so uncommitted edits ship and the release matches no commit. The current `release/tta-portal.zip` already contains the uncommitted CSP change in `server/src/app.js`. | A release you can't reproduce or roll back | 3 |
| 3 | The deploy scripts and runbook live outside git (`university-server/` is not a repo). | Lost or out of step with the code | 3, 4 |
| 4 | Google OAuth only accepts `https` redirect URIs (or `localhost`). With `http://10.2.15.250:3001` the admin cannot connect Google Drive, so **video upload (`VideoUploader`) won't work** until there is a domain and HTTPS. YouTube links still work. | One feature disabled at launch | 6 (decision) |
| 5 | The other 9 universities are not on the KMUTT network. Until CITES opens the port and outside access, only KMUTT/VPN users can reach the portal. | **The main risk for Friday** | 7 (go/no-go) |
| 6 | Task Scheduler's `RestartCount` restarts a task that *fails to start*; whether it restarts `run.cmd` after `node` exits is unverified. | The portal may stay down after a crash | 6 |
| 7 | Uncommitted on `backend`: the deploy fixes for the CMM fallback (`deploy.yml` → `server/Dockerfile` + `/api/health` smoke check, data volumes in `infra/docker-compose.yml`, the `connect-src` CSP for Drive uploads, `server/test/csp.test.js`). | Needed for both targets | 1 |

## File structure

| Path | Responsibility |
|---|---|
| `server/src/app.js` | Helmet config: HTTPS-only headers only when `COOKIE_SECURE=true` |
| `server/test/csp.test.js` | Tests for the security headers in both modes |
| `deploy/kmutt/package-release.ps1` | Laptop: builds `deploy/kmutt/release/tta-portal.zip` from `git HEAD` (moved from `university-server/`) |
| `deploy/kmutt/install-on-server.ps1` | Server: install/update, seed, tasks, firewall, health check (moved; crash-loop added) |
| `deploy/kmutt/README.md` | KMUTT runbook (moved from `university-server/DEPLOYMENT_GUIDE.md`, paths updated) |
| `deploy/cmm/README.md` | The CMM droplet guide (moved from root `DEPLOYMENT_GUIDE.md`) |
| `DEPLOYMENT_GUIDE.md` (root) | Short index: primary = KMUTT, fallback = CMM |
| `.gitignore` | Ignore `deploy/kmutt/release/` |

---

### Task 1: Commit the pending deploy fixes

**Files:** already modified: `.github/workflows/deploy.yml`, `infra/docker-compose.yml`, `server/src/app.js`, `server/test/csp.test.js`

- [ ] **Step 1: Run both suites**

Run: `cd server; npm.cmd test` then `cd ..; npm.cmd test`
Expected: `Tests  231 passed` (server) and `Tests  45 passed` (frontend)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml infra/docker-compose.yml server/src/app.js server/test/csp.test.js
git commit -m "fix(deploy): ship the API image, persist data, allow Drive uploads in CSP"
```

---

### Task 2: Don't upgrade to HTTPS when the site is served over HTTP

`COOKIE_SECURE` already says whether the site is HTTPS (`install-on-server.ps1` writes `COOKIE_SECURE=false`; the CMM `.env` uses `true`). Use it to decide whether to send the HTTPS-only headers.

**Files:**
- Modify: `server/src/app.js` (the `app.register(helmet, …)` call, ~line 49)
- Test: `server/test/csp.test.js`

- [ ] **Step 1: Write the failing tests.** In `server/test/csp.test.js`, replace the `csp` helper and add a `describe` block:

```js
const headers = async (env = {}) => {
  t = await makeTestApp(env);
  return (await t.app.inject({ method: 'GET', url: '/api/health' })).headers;
};

const csp = async (env) => Object.fromEntries((await headers(env))['content-security-policy'].split(';').map(d => {
  const [name, ...values] = d.trim().split(/\s+/);
  return [name, values];
}));
```

```js
describe('plain http deploy (COOKIE_SECURE unset)', () => {
  it('does not tell the browser to upgrade /assets to https', async () => {
    expect(await csp()).not.toHaveProperty('upgrade-insecure-requests');
  });
  it('sends no HSTS', async () => {
    expect(await headers()).not.toHaveProperty('strict-transport-security');
  });
});

describe('https deploy (COOKIE_SECURE=true)', () => {
  it('upgrades insecure requests', async () => {
    expect(await csp({ COOKIE_SECURE: 'true' })).toHaveProperty('upgrade-insecure-requests');
  });
  it('sends HSTS', async () => {
    expect(await headers({ COOKIE_SECURE: 'true' })).toHaveProperty('strict-transport-security');
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `cd server; npx vitest run test/csp.test.js`
Expected: the 2 "plain http" tests FAIL; the 2 "https" tests and the 2 existing tests PASS

- [ ] **Step 3: Implement.** In `server/src/app.js`, replace the helmet registration with:

```js
  // The video uploader PUTs straight from the browser to a Drive resumable upload URL.
  // Over plain http (COOKIE_SECURE=false, e.g. http://10.2.15.250:3001) the HTTPS-only headers must be off,
  // or the browser fetches /assets/* over https and the page stays blank.
  app.register(helmet, {
    hsts: config.cookieSecure,
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", 'https://www.googleapis.com'],
        upgradeInsecureRequests: config.cookieSecure ? [] : null
      }
    }
  });
```

- [ ] **Step 4: Run the full server suite**

Run: `cd server; npm.cmd test`
Expected: `Tests  235 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/app.js server/test/csp.test.js
git commit -m "fix(server): skip HTTPS upgrade and HSTS when served over plain http"
```

---

### Task 3: Move the release script into the repo, building from HEAD

**Files:**
- Create: `deploy/kmutt/package-release.ps1` (replaces `university-server/package-release.ps1`)
- Create: `deploy/kmutt/install-on-server.ps1` (copy of `university-server/install-on-server.ps1`; changed in Task 5)
- Modify: `.gitignore`

- [ ] **Step 1: Copy the install script unchanged**

```powershell
New-Item -ItemType Directory -Force deploy\kmutt | Out-Null
Copy-Item ..\university-server\install-on-server.ps1 deploy\kmutt\install-on-server.ps1
```

- [ ] **Step 2: Write `deploy/kmutt/package-release.ps1`**

```powershell
# Run on the LAPTOP. Builds the last COMMIT of this repo into deploy\kmutt\release\tta-portal.zip.
# Works in a temp copy: never touches the project's node_modules or the tracked dist\, so dev servers keep running.
# Usage (repo root):  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
# Output: deploy\kmutt\release\tta-portal\  and  deploy\kmutt\release\tta-portal.zip  (no passwords, database or .env)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$releaseDir = Join-Path $PSScriptRoot 'release'
$out = Join-Path $releaseDir 'tta-portal'
$work = Join-Path $env:TEMP 'tta-portal-build'
$tarball = "$work.tar"

function Check-Robocopy { if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" } }

# 0. What ships is HEAD, never uncommitted edits
$sha = (git -C $repo rev-parse --short HEAD).Trim()
if ($LASTEXITCODE) { throw 'git rev-parse failed' }
if (git -C $repo status --porcelain --untracked-files=no) {
  Write-Warning 'Uncommitted changes are NOT in this release. Commit them first if they should ship.'
}

# 1. Clean export of HEAD
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force $work | Out-Null
git -C $repo archive --format=tar -o $tarball HEAD
if ($LASTEXITCODE) { throw 'git archive failed' }
tar -xf $tarball -C $work
if ($LASTEXITCODE) { throw 'tar -x failed' }
Remove-Item $tarball

# 2. Build the frontend there
Push-Location $work
try {
  npm.cmd ci
  if ($LASTEXITCODE) { throw 'npm ci failed' }
  npm.cmd run build
  if ($LASTEXITCODE) { throw 'npm run build failed' }
}
finally { Pop-Location }

# 3. Assemble the release
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null
robocopy "$work\dist" "$out\dist" /E /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$work\server" "$out\server" /E /XD "$work\server\node_modules" "$work\server\data" "$work\server\backups" "$work\server\test" /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
# The server imports these shared files via ../../src/...
robocopy "$work\src\data" "$out\src\data" /E /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$work\src\utils" "$out\src\utils" /E /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
Copy-Item "$work\package.json" "$out\package.json"   # only so ../../src/*.js are treated as ES modules
Copy-Item "$work\deploy\kmutt\install-on-server.ps1" "$out\install-on-server.ps1"
"commit $sha`nbuilt $(Get-Date -Format s)" | Set-Content "$out\RELEASE.txt" -Encoding ASCII
Remove-Item $work -Recurse -Force

$zip = Join-Path $releaseDir 'tta-portal.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$out\*" -DestinationPath $zip
"Done: $zip  (commit $sha, {0:N1} MB)" -f ((Get-Item $zip).Length / 1MB)
```

- [ ] **Step 3: Ignore the generated release.** Append to `.gitignore`:

```
# KMUTT release output (built by deploy/kmutt/package-release.ps1)
/deploy/kmutt/release/
```

- [ ] **Step 4: Commit, then build and inspect the zip.** The script exports HEAD, so commit before running it:

```bash
git add .gitignore deploy/kmutt/package-release.ps1 deploy/kmutt/install-on-server.ps1
git commit -m "chore(deploy): add KMUTT release and install scripts, built from HEAD"
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
Get-Content deploy\kmutt\release\tta-portal\RELEASE.txt
Select-String -Path deploy\kmutt\release\tta-portal\server\src\app.js -Pattern 'upgradeInsecureRequests'
git status --short
```

Expected: `Done: …tta-portal.zip (commit <sha>, ~1.6 MB)`; `RELEASE.txt` shows the HEAD sha; the `Select-String` finds the Task 2 line; `git status` shows nothing new under `deploy/` (release is ignored) and `dist/` is untouched.

---

### Task 4: One home for the deploy docs

**Files:**
- Create: `deploy/kmutt/README.md`, `deploy/cmm/README.md`
- Modify: `DEPLOYMENT_GUIDE.md` (root)

- [ ] **Step 1: Move the CMM guide**

```bash
mkdir -p deploy/cmm
git mv DEPLOYMENT_GUIDE.md deploy/cmm/README.md
```

- [ ] **Step 2: Copy the KMUTT runbook** from `../university-server/DEPLOYMENT_GUIDE.md` to `deploy/kmutt/README.md`, then make these edits in it:

| Find | Replace with |
|---|---|
| `The CMM droplet template is a different file: \`TTA-LoginPortal/DEPLOYMENT_GUIDE.md\`.` | `The CMM droplet fallback is \`deploy/cmm/README.md\`.` |
| Section 2 code block (`cd "...\university-server"` + `.\package-release.ps1`) | `cd "C:\Users\krittin pragopdee\OneDrive\Desktop\University\TeachingAcademy\TTA-LoginPortal"` then `powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1` |
| `Result: \`university-server\release\tta-portal.zip\`` | `Result: \`deploy\kmutt\release\tta-portal.zip\`, built from the last commit (\`RELEASE.txt\` inside names it). Commit first: uncommitted edits are not included.` |
| `The script builds in a temporary copy, so it does not touch …` paragraph | keep as is |
| Section 3 step 1 path `...\TeachingAcademy\university-server\release\tta-portal.zip` | `...\TeachingAcademy\TTA-LoginPortal\deploy\kmutt\release\tta-portal.zip` |
| Fallback line `(\`TTA-LoginPortal/DEPLOYMENT_GUIDE.md\`)` | `(\`deploy/cmm/README.md\`)` |
| Section 8 table | rows for `README.md`, `package-release.ps1`, `install-on-server.ps1`, `release/` (ignored by git) |

Add to section 4's checklist, after the health line:

```markdown
- [ ] Open `http://10.2.15.250:3001/` **in a browser from the laptop** (not on the server): the login page shows with styles. A blank page means HTTPS-upgrade headers are still being sent (Task 2 of the deploy plan).
- [ ] Crash test: on the server, `Get-NetTCPConnection -LocalPort 3001 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`, wait 10 s, then `/api/health` answers again.
```

Add to section 7's table:

```markdown
| Video upload (Google Drive) | Project owner | Google OAuth needs an https redirect URI, so Drive can't be connected on `http://10.2.15.250:3001`. YouTube links work; video upload waits for the domain + HTTPS. |
```

- [ ] **Step 3: Write the root index `DEPLOYMENT_GUIDE.md`**

```markdown
# Deploying the TTA Portal

| Target | Status | Runbook |
|---|---|---|
| KMUTT server `CIT_TTA2027` (10.2.15.250), Windows, no Docker | **Primary** | [`deploy/kmutt/README.md`](deploy/kmutt/README.md) |
| CMM droplet (`tta.portal.cmm.works`), Docker + Caddy, deploys on push to `main` | Fallback | [`deploy/cmm/README.md`](deploy/cmm/README.md) |

Both run the same build: one Node process serving `/api` and the frontend, data in `server/data` (SQLite + uploads).
Moving between them = copy `portal.db` and `uploads/` from one to the other.

Plan and status: `docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md`.
```

- [ ] **Step 4: Fix the one other reference.** Run `git grep -n "DEPLOYMENT_GUIDE"` and point any hit outside the files above at the new path.

- [ ] **Step 5: Commit**

```bash
git add DEPLOYMENT_GUIDE.md deploy/
git commit -m "docs(deploy): KMUTT runbook as primary, CMM guide as fallback"
```

- [ ] **Step 6: Retire the old folder (ask the owner first).** Replace `../university-server/DEPLOYMENT_GUIDE.md` with one line, `Moved to TTA-LoginPortal/deploy/kmutt/README.md`, and delete its two `.ps1` files and `release/`, so nobody builds from the old working-tree script.

---

### Task 5: Restart the portal when Node exits

Don't rely on Task Scheduler noticing a crash: `run.cmd` loops. Stopping the task ends `cmd.exe`, and the install script already kills whatever listens on the port.

**Files:** Modify `deploy/kmutt/install-on-server.ps1` (section `# 7.`, the `run.cmd` block)

- [ ] **Step 1: Replace the `run.cmd` here-array with:**

```powershell
@(
  '@echo off',
  'cd /d "%~dp0"',
  ':loop',
  "`"$nodeExe`" src\index.js >> ..\logs\portal.log 2>&1",
  'echo %date% %time% portal exited with %errorlevel%, restarting in 5 s >> ..\logs\portal.log',
  'timeout /t 5 /nobreak > nul',
  'goto loop'
) | Set-Content -Path "$InstallDir\server\run.cmd" -Encoding ASCII
```

- [ ] **Step 2: Make "stop" really stop.** In section `# 2.`, after `Stop-ScheduledTask`, the existing `Get-NetTCPConnection … Stop-Process` already kills `node`; also end the loop's `cmd.exe`:

```powershell
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like "*$InstallDir\server\run.cmd*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

Put this **before** the `Get-NetTCPConnection` line, so the loop can't restart `node` after it is killed. Update the runbook's "Restart" row in `deploy/kmutt/README.md` section 5 to: `Stop-ScheduledTask TTA-Portal; Get-NetTCPConnection -LocalPort 3001 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }; Start-ScheduledTask TTA-Portal`.

- [ ] **Step 3: Rebuild the release and commit**

```bash
git add deploy/kmutt/install-on-server.ps1 deploy/kmutt/README.md
git commit -m "fix(deploy): restart the KMUTT portal after a crash"
```

Then `powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1`.

---

### Task 6: Install on `CIT_TTA2027` and verify (manual, over VPN + RDP)

Follow `deploy/kmutt/README.md` sections 1–4. In addition:

- [ ] **Step 1:** After install, `Get-Content C:\tta-portal\RELEASE.txt` shows the sha from Task 5.
- [ ] **Step 2:** From the **laptop browser** over VPN: `http://10.2.15.250:3001/` shows the styled login page. DevTools → Console has no `ERR_SSL_PROTOCOL_ERROR` or CSP errors (only the expected `401` on `/api/me` before login).
- [ ] **Step 3:** Run all of section 4's checklist: coordinator login, draft save + reload, submit locks, `admin1` CSV export.
- [ ] **Step 4:** Crash test (from Task 4's checklist line): the portal answers `/api/health` again within ~10 s.
- [ ] **Step 5:** `Remove-Item C:\temp\TTA-portal-accounts.md`, and change the Administrator password.
- [ ] **Step 6: Decide on video upload for launch.** Drive can't be connected over http (finding 4). Either tell coordinators "YouTube link now, video upload after HTTPS", or hide the uploader until the domain exists. Owner's call; record it in the runbook's decision log.

If the web port isn't reachable from the laptop (works on the server's own `localhost:3001`), send CITES the message in the runbook's section 7 and go to Task 7.

---

### Task 7: Friday go/no-go (Thursday 2026-11-26, 12:00)

The portal is only useful if all 10 universities can reach it.

- [ ] **If CITES has opened outside access** to 10.2.15.250 (test from mobile data, not campus Wi-Fi): launch on KMUTT. Then:
  - set `PORTAL_URL` in `../TTA-LandingPage/src/App.jsx:20` to the final address and redeploy the landing page;
  - once a domain + HTTPS exist: in `C:\tta-portal\server\.env` set `COOKIE_SECURE=true`, `APP_ORIGIN=https://<domain>`, `TRUST_PROXY=1` if a proxy sits in front, and restart. That also turns HSTS back on (Task 2).
- [ ] **If not:** launch on the CMM droplet with `deploy/cmm/README.md` (Task 1 already made that pipeline ship the API). Owner-side items there: DNS `A` record, Caddy block `tta.portal.cmm.works { encode zstd gzip; reverse_proxy tta-portal:3001 }`, `/opt/tta-portal/.env` (`SESSION_SECRET`, `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `APP_ORIGIN=https://tta.portal.cmm.works`), GHCR read access for `ghcr.io/litt1estar/tta-portal`, seed accounts after first boot, then fast-forward `main` to `backend` and push. Move to KMUTT later by copying `portal.db` + `uploads/`.

---

## Self-review

- Every runbook section has a home: build (Task 3), install/operate/check (Tasks 5–6, README), CITES items (Task 6 → 7), landing page URL and HTTPS switch (Task 7).
- No placeholders: every code step shows the full code; `<domain>` in Task 7 is a value only CITES can give.
- Names are consistent: `config.cookieSecure` (from `server/src/config.js`), `deploy/kmutt/release/`, task `TTA-Portal`, `RELEASE.txt`.
