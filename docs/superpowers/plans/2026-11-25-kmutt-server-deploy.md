# KMUTT Production Deploy: Trackable Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The TTA 2027 portal is live on the KMUTT server `CIT_TTA2027` on **Friday 2026-11-27**, all 10 university coordinators can log in, and there is a tested way back if something goes wrong.

**Architecture:** One Node process (`server/src/index.js`, `SERVE_STATIC=true`) serves `/api` and the built frontend from `C:\tta-portal` on `10.2.15.250:3001` (Windows Server 2025, no Docker), kept running by the Scheduled Task `TTA-Portal`. The release zip is built on the laptop **from a tagged commit on `main`** and copied in over Remote Desktop. The CMM droplet pipeline (`server/Dockerfile`, `infra/`, `.github/workflows/deploy.yml`) is the fallback.

**Tech Stack:** Node ≥ 22.13 (`node:sqlite`), Fastify 5 + `@fastify/helmet` 13 (helmet 8), Vite 6, PowerShell 5.1, Windows Task Scheduler.

**How to track:** tick boxes as you go, and update the **Status board** below when a phase changes state. Each phase ends with a **Gate**: don't start the next phase until the gate's checks are ticked.

---

## Status board

| Phase | What | Owner | Due | State |
|---|---|---|---|---|
| 0 | Code ready: release built from a tag (branch `deploy/kmutt`) | Dev (laptop) | Wed 25 Nov | 🟨 In progress |
| D | Domain placeholder `tta.cmm.works` → KMUTT | Owner (GoDaddy) | Wed 25 Nov | ⬜ Not started |
| 1 | CITES: web port, outside access, domain | Owner → CITES | Ask Wed 25, need by Thu 26 12:00 | ⬜ Not started |
| 2 | Install on `CIT_TTA2027` | Owner (VPN + RDP) | Thu 26 Nov AM | ⬜ Not started |
| 3 | Verify on the server | Owner | Thu 26 Nov AM | ⬜ Not started |
| 4 | Go / no-go | Owner | **Thu 26 Nov 12:00** | ⬜ Not started |
| 5 | Launch | Owner | Fri 27 Nov | ⬜ Not started |
| 6 | After launch | Owner | Week of 30 Nov | ⬜ Not started |

States: ⬜ Not started · 🟨 In progress · ✅ Done · 🟥 Blocked (write why)

## Baseline (checked 2026-11-25 on `main` @ `7c10233`; the submit-form work was committed in `b23ed15`, `09dc087`)

| Check | Result |
|---|---|
| Server tests | ✅ 237 passed |
| Frontend tests | ✅ 45 passed |
| Production build | ✅ builds |
| CMM fallback pipeline (API image, data volumes, `connect-src` for Drive) | ✅ on `main` (`9546fcf`) |
| Working tree | ✅ The submit-form edits were committed on `main` (`b23ed15`, `09dc087`). Phase 0 runs in worktree `../TTA-LoginPortal-deploy` on branch `deploy/kmutt`. |
| `dist/` in git | ⚠️ Doesn't match a fresh build. Harmless: the release always builds fresh. Never deploy the tracked `dist/`. |
| `main` vs `origin/main` | ⚠️ `main` is 88 commits ahead. Pushing `main` starts the **CMM** deploy workflow, so don't push until the CMM side is set up or the workflow is disabled (Task 0.7). |

## Risks found in review

| # | Risk | Effect | Handled in |
|---|---|---|---|
| R1 | Helmet sends `upgrade-insecure-requests` and HSTS. The site is plain `http://10.2.15.250:3001`, so browsers fetch `/assets/*` over `https`, fail, and show a blank page. Loopback (`localhost`) is exempt, which is why laptop tests pass. Not reproduced on a LAN IP yet. | Probable blank page for every user | 0.2, 3 |
| R2 | `university-server/package-release.ps1` packs the **working tree**: uncommitted edits ship, and no commit matches what runs. | Can't reproduce or roll back | 0.3 |
| R3 | `install-on-server.ps1` doesn't back up the database before an update. | A bad update can lose data | 0.4 |
| R4 | `RestartCount` in Task Scheduler is not proven to restart `node` after a crash. | Portal stays down after a crash | 0.4, 3 |
| R5 | The other 9 universities are outside the KMUTT network. Until CITES opens outside access, only KMUTT/VPN users can reach the portal. | **Launch blocker** | 1, 4 |
| R6 | Google OAuth needs an `https` redirect URI, so the admin can't connect Drive on `http://10.2.15.250:3001`. Video upload and the new Drive photo sync (`8f7aa8d`) are off until HTTPS. Photo sync is safe while disconnected (`syncEntryPhotos` returns at once). YouTube links and portal-stored photos work. | Two features off at launch | 3.6, 6 |
| R7 | Once Drive *is* connected, draft save and submit **wait** for the photo sync (`server/src/submissions.js`, `await syncPhotos`); each Google call can take up to 20 s. | Slow saves while Drive is slow | 6.4 |

---

## Phase 0: Code ready (laptop)

### Task 0.1: Finish and commit the in-progress submit-form work ✅ (`b23ed15`, `09dc087`)

- [x] **Step 1:** Finish or stash the 6 uncommitted files listed in the baseline. Decide whether they ship on Friday.
- [x] **Step 2:** Run both suites: `cd server; npm.cmd test` and `cd ..; npm.cmd test`. Expected: all pass.
- [x] **Step 3:** Commit them on `main`, or `git stash` them if they're not for Friday.

### Task 0.2: Don't upgrade to HTTPS while serving plain HTTP (R1)

**Files:** Modify `server/src/app.js` (the `app.register(helmet, …)` call). Test: `server/test/csp.test.js`.

- [ ] **Step 1: Write the failing tests.** In `server/test/csp.test.js`, replace the `csp` helper with:

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

and add:

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

- [ ] **Step 2: Run and see the two "plain http" tests fail**

Run: `cd server; npx vitest run test/csp.test.js`
Expected: 2 FAIL (plain http), 4 PASS

- [ ] **Step 3: Implement.** Replace the helmet registration in `server/src/app.js` with:

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

- [ ] **Step 4: Full server suite**

Run: `cd server; npm.cmd test`
Expected: all pass (237 + 4 = 241 on the baseline)

- [ ] **Step 5: Commit**

```bash
git add server/src/app.js server/test/csp.test.js
git commit -m "fix(server): skip HTTPS upgrade and HSTS when served over plain http"
```

### Task 0.3: Release scripts in the repo, built from a commit (R2)

**Files:** Create `deploy/kmutt/package-release.ps1` and `deploy/kmutt/install-on-server.ps1`. Modify `.gitignore`.

- [ ] **Step 1: Copy the install script in unchanged.** It's changed in 0.4.

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
$tag = (git -C $repo describe --tags --exact-match HEAD 2>$null)
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
"commit $sha`ntag $tag`nbuilt $(Get-Date -Format s)" | Set-Content "$out\RELEASE.txt" -Encoding ASCII
Remove-Item $work -Recurse -Force

$zip = Join-Path $releaseDir 'tta-portal.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$out\*" -DestinationPath $zip
"Done: $zip  (commit $sha $tag, {0:N1} MB)" -f ((Get-Item $zip).Length / 1MB)
```

- [ ] **Step 3: Ignore the generated release.** Append to `.gitignore`:

```
# KMUTT release output (built by deploy/kmutt/package-release.ps1)
/deploy/kmutt/release/
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore deploy/kmutt/package-release.ps1 deploy/kmutt/install-on-server.ps1
git commit -m "chore(deploy): KMUTT release and install scripts, built from HEAD"
```

### Task 0.4: Install script: back up before updating, restart after a crash (R3, R4)

**Files:** Modify `deploy/kmutt/install-on-server.ps1`.

- [ ] **Step 1: Stop the restart loop and back up before copying.** In section `# 2. Stop the running portal`, replace everything from `if (Get-ScheduledTask …` up to and including `Start-Sleep -Seconds 2` with:

```powershell
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}
# End the run.cmd restart loop first, so it can't start node again
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like "*$InstallDir\server\run.cmd*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Update: snapshot the database and uploads before touching any file
if (Test-Path "$InstallDir\server\data\portal.db") {
  Push-Location "$InstallDir\server"
  try {
    & $nodeExe scripts\backup.js
    if ($LASTEXITCODE) { throw 'pre-update backup failed; nothing was changed' }
    Write-Host 'Pre-update backup written to server\backups'
  } finally { Pop-Location }
}
```

- [ ] **Step 2: Keep a copy of the previous release, for rollback.** Before `# 3. Copy files`, add:

```powershell
if (Test-Path "$InstallDir\RELEASE.txt") {
  $prev = "$InstallDir-previous"
  if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
  New-Item -ItemType Directory -Force $prev | Out-Null
  robocopy "$InstallDir" $prev /E /XD "$InstallDir\server\data" "$InstallDir\server\backups" "$InstallDir\server\node_modules" "$InstallDir\logs" /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
}
```

and after the `Copy-Item "$src\package.json" …` line in section 3:

```powershell
Copy-Item "$src\RELEASE.txt" "$InstallDir\RELEASE.txt" -Force
```

- [ ] **Step 3: Restart loop.** In section `# 7.`, replace the `run.cmd` here-array with:

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

- [ ] **Step 4: Print the release on success.** Replace the `Write-Host "OK: portal is running. …"` line with:

```powershell
Write-Host "OK: portal is running ($((Get-Content "$InstallDir\RELEASE.txt") -join ', ')). Open $AppOrigin from a machine on the KMUTT network or VPN."
```

- [ ] **Step 5: Commit**

```bash
git add deploy/kmutt/install-on-server.ps1
git commit -m "fix(deploy): back up before update, keep previous release, restart after crash"
```

### Task 0.5: One home for the deploy docs

**Files:** Create `deploy/kmutt/README.md` and `deploy/cmm/README.md`. Modify `DEPLOYMENT_GUIDE.md` (root).

- [ ] **Step 1:** `git mv DEPLOYMENT_GUIDE.md deploy/cmm/README.md`
- [ ] **Step 2:** Copy `../university-server/DEPLOYMENT_GUIDE.md` to `deploy/kmutt/README.md`, then edit it:

| Find | Replace with |
|---|---|
| `The CMM droplet template is a different file: \`TTA-LoginPortal/DEPLOYMENT_GUIDE.md\`.` | `The CMM droplet fallback is \`deploy/cmm/README.md\`. Progress is tracked in \`docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md\`.` |
| Section 2 code block | `cd "C:\Users\krittin pragopdee\OneDrive\Desktop\University\TeachingAcademy\TTA-LoginPortal"` then `powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1` |
| `Result: \`university-server\release\tta-portal.zip\`` | `Result: \`deploy\kmutt\release\tta-portal.zip\`, built from the last commit (\`RELEASE.txt\` inside names it). Uncommitted edits are not included.` |
| Section 3 step 1 path `...\university-server\release\tta-portal.zip` | `...\TTA-LoginPortal\deploy\kmutt\release\tta-portal.zip` |
| Section 5, row "Restart" | `Stop-ScheduledTask TTA-Portal; Get-NetTCPConnection -LocalPort 3001 -State Listen \| % { Stop-Process -Id $_.OwningProcess -Force }; Start-ScheduledTask TTA-Portal` |
| Fallback line `(\`TTA-LoginPortal/DEPLOYMENT_GUIDE.md\`)` | `(\`deploy/cmm/README.md\`)` |
| Section 8 table | rows for `README.md`, `package-release.ps1`, `install-on-server.ps1`, `release/` (git-ignored) |

Add a section 5 row: `| Roll back | See the deploy plan, Phase 6 "Rollback" |`.

- [ ] **Step 3: Write the root `DEPLOYMENT_GUIDE.md`**

```markdown
# Deploying the TTA Portal

| Target | Status | Runbook |
|---|---|---|
| KMUTT server `CIT_TTA2027` (10.2.15.250), Windows, no Docker | **Primary** | [`deploy/kmutt/README.md`](deploy/kmutt/README.md) |
| CMM droplet (`tta.portal.cmm.works`), Docker + Caddy, deploys on push to `main` | Fallback | [`deploy/cmm/README.md`](deploy/cmm/README.md) |

Both run the same build: one Node process serving `/api` and the frontend, data in `server/data` (SQLite + uploads).
Moving between them = copy `portal.db` and `uploads/`.

Progress: `docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md`.
```

- [ ] **Step 4: Commit**

```bash
git add DEPLOYMENT_GUIDE.md deploy/
git commit -m "docs(deploy): KMUTT runbook as primary, CMM guide as fallback"
```

- [ ] **Step 5 (owner OK first):** Replace `../university-server/DEPLOYMENT_GUIDE.md` with the line `Moved to TTA-LoginPortal/deploy/kmutt/README.md`, and delete its `.ps1` files and `release/`, so nobody builds from the old working-tree script.

### Task 0.6: Tag and build the release

- [ ] **Step 1:** Both suites green: `cd server; npm.cmd test` and `cd ..; npm.cmd test`.
- [ ] **Step 2:** Tag: `git tag -a v2026.11.27 -m "KMUTT launch"`
- [ ] **Step 3:** Build: `powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1`
Expected: `Done: …tta-portal.zip  (commit <sha> v2026.11.27, ~1.6 MB)`
- [ ] **Step 4:** Check the zip contains the 0.2 fix: `Select-String -Path deploy\kmutt\release\tta-portal\server\src\app.js -Pattern 'upgradeInsecureRequests'` finds one line.

### Task 0.7: Keep `main` from deploying to CMM by accident

`main` is 88 commits ahead of `origin/main`. Pushing it runs `deploy.yml` against the droplet, which isn't set up (no DNS, Caddy block, `.env` or GHCR access), so that run fails.

- [ ] **Step 1:** Change the trigger in `.github/workflows/deploy.yml` from `push: branches: [main]` to:

```yaml
on:
  workflow_dispatch:   # CMM is the fallback: run by hand from the Actions tab
```

- [ ] **Step 2:** Commit (`ci: run the CMM deploy by hand only`), then push `main` and the tag: `git push origin main --follow-tags`. The push also backs up the code.

**Gate 0** ✅ when: all of Phase 0 is ticked · the tag exists on `origin` · `deploy\kmutt\release\tta-portal.zip` exists and its `RELEASE.txt` shows the tag.

---

## Phase D: Domain placeholder (today: `tta.cmm.works`; swap for the real name later)

`cmm.works` is the owner's own domain on GoDaddy. Today, every `*.cmm.works` name resolves to the CMM droplet (`139.59.100.44`), so the KMUTT name needs its own record.

**Limits of a placeholder that points at a private IP:** `10.2.15.250` is a KMUTT-internal address. The name works only for people on the KMUTT network or VPN, and no certificate authority can issue HTTPS for it until CITES gives a public address. So today the URL is `http://tta.cmm.works:3001/`.

- [ ] **D.1 (owner, GoDaddy → cmm.works → DNS):** add an `A` record, name `tta`, value `10.2.15.250`, TTL 600. Don't add an AAAA record.
- [ ] **D.2** Check: `nslookup tta.cmm.works 8.8.8.8` → `10.2.15.250`.
- [ ] **D.3** Install with `-AppOrigin http://tta.cmm.works:3001` (Phase 2.4). On an existing install, set `APP_ORIGIN=http://tta.cmm.works:3001` in `C:\tta-portal\server\.env` and restart.
- [ ] **D.4 (when the real domain + public address arrive):** change the record, or the new domain's record, to the public IP CITES gives, then follow 6.3 (HTTPS).

---

## Phase 1: CITES (send today, needed by Thursday 12:00)

- [ ] **1.1** Send CITES the message in `deploy/kmutt/README.md` section 7: TCP 3001 (or 80/443) from the VPN **and the internet**, TCP 22, plus a domain + HTTPS. Write the date sent and the ticket/contact here: `__________`
- [ ] **1.2** Follow up Thursday 09:00 if there's no answer.
- [ ] **1.3** Record each answer: web port from VPN ⬜ · from the internet ⬜ · domain ⬜ · HTTPS ⬜

**Gate 1** ✅ when: the web port is reachable from the internet (tested in Phase 3), or Phase 4 picks the fallback.

---

## Phase 2: Install on `CIT_TTA2027` (Thursday morning)

Follow `deploy/kmutt/README.md` sections 1 and 3.

- [ ] **2.1** VPN up and Remote Desktop in, with the laptop's `C:` drive shared.
- [ ] **2.2** Node.js LTS (22.13+) installed. In a new admin PowerShell, `node --version` shows `v22.13` or newer.
- [ ] **2.3** Copy `tta-portal.zip` and `data\TTA-portal-accounts.md` to `C:\temp\`.
- [ ] **2.4** Unzip and run `install-on-server.ps1 -AccountsFile C:\temp\TTA-portal-accounts.md -AppOrigin http://tta.cmm.works:3001`. It ends with `OK: portal is running (commit …, tag v2026.11.27 …)`.
- [ ] **2.5** `Remove-Item C:\temp\TTA-portal-accounts.md`
- [ ] **2.6** `Get-Content C:\tta-portal\server\.env` contains `NODE_ENV=production`, `COOKIE_SECURE=false`, `HOST=0.0.0.0` and a long `SESSION_SECRET`.

**Gate 2** ✅ when: the install printed `OK`, and the accounts file is gone from the server.

---

## Phase 3: Verify (Thursday morning)

Use a **browser on the laptop**, over VPN, unless a step says otherwise.

- [ ] **3.1** `http://10.2.15.250:3001/api/health` returns `{"ok":true,…}`.
- [ ] **3.2** `http://10.2.15.250:3001/` shows the **styled** login page. DevTools → Console shows no `ERR_SSL_PROTOCOL_ERROR` and no CSP errors; the only expected entry is the `401` on `/api/me` (R1).
- [ ] **3.3** Wrong password shows `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง`. A coordinator (e.g. `kmutt`) logs in and sees only its own university.
- [ ] **3.4** Add a member with a photo, save, reload: still there. Refresh `/dashboard`: still logged in. Log out, then back in.
- [ ] **3.5** `admin1` logs in at `/admin`, and the CSV export downloads.
- [ ] **3.6** Video upload/Drive panel: confirm it says Drive is not connected, and nothing errors (R6). Decide what to tell coordinators: "use the YouTube link; video upload opens after HTTPS".
- [ ] **3.7 Crash test** (on the server): `Get-NetTCPConnection -LocalPort 3001 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`. Within ~10 s, `/api/health` answers again, and `C:\tta-portal\logs\portal.log` has a `restarting` line (R4).
- [ ] **3.8 Backup test** (on the server): `cd C:\tta-portal\server; npm.cmd run backup` writes a new snapshot under `server\backups\db`.
- [ ] **3.9 Outside test:** from a phone on **mobile data** (not campus Wi-Fi), open `http://10.2.15.250:3001/` or the address CITES gave. Write the result here: `__________`
- [ ] **3.10** Delete the test data from 3.4 (remove the member and save), so coordinators start clean.

**Gate 3** ✅ when: 3.1–3.8 and 3.10 pass. 3.9 is decided in Phase 4.

---

## Phase 4: Go / no-go (Thursday 2026-11-26, 12:00)

| Condition | Decision |
|---|---|
| Gate 3 ✅ **and** 3.9 works from mobile data | **GO KMUTT**: go to Phase 5 |
| Gate 3 ✅ but there's no outside access, and CITES gives a firm time before Friday 09:00 | Hold; recheck 3.9 at that time |
| No outside access by Thursday 17:00, or Gate 3 fails | **GO CMM fallback**: follow `deploy/cmm/README.md`. Owner-side items: DNS `A` record `tta.portal` → `139.59.100.44`; Caddy block `tta.portal.cmm.works { encode zstd gzip; reverse_proxy tta-portal:3001 }`; `/opt/tta-portal/.env` with a new `SESSION_SECRET`, `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `APP_ORIGIN=https://tta.portal.cmm.works`; GHCR read access to `ghcr.io/litt1estar/tta-portal`; run the workflow from the Actions tab; seed the accounts in the container. Move to KMUTT later by copying `portal.db` + `uploads/`. |

- [ ] **4.1** Decision: ⬜ KMUTT · ⬜ CMM. Made by `______` at `______`. Copy the reason into the runbook's decision log.

---

## Phase 5: Launch (Friday 2026-11-27)

- [ ] **5.1** Set `PORTAL_URL` in `../TTA-LandingPage/src/App.jsx:20` (now `'https://tta.portal.cmm.works/'`) to the chosen address, then redeploy the landing page.
- [ ] **5.2** Before announcing, run `/api/health` and one coordinator login against the final address.
- [ ] **5.3** Send each coordinator their username and password through a private channel, one university at a time, with the portal address and the video note from 3.6.
- [ ] **5.4** For the first two hours, check `Get-Content C:\tta-portal\logs\portal.log -Tail 50` every 30 min. Look for `"level":50` errors and repeated `429`s.
- [ ] **5.5** End of day: run `npm.cmd run backup` by hand, and copy `C:\tta-portal\server\backups` off the server (RDP drive).

**Gate 5** ✅ when: all 10 coordinators have logged in at least once (check in `/admin`).

---

## Phase 6: After launch

- [ ] **6.1** Change the Windows Administrator password (it appeared in a photo).
- [ ] **6.2** Weekly off-server copy of `server\backups` until CITES offers off-machine backup.
- [ ] **6.3** When there's a domain + HTTPS: in `C:\tta-portal\server\.env` set `COOKIE_SECURE=true` (this also turns HSTS and the https upgrade back on), `APP_ORIGIN=https://<domain>`, `TRUST_PROXY=1` if a proxy sits in front, and `GOOGLE_REDIRECT_URI=https://<domain>/api/admin/google/callback` (also register it in Google Cloud). Then restart and connect Drive from `/admin`. Update `PORTAL_URL` again.
- [ ] **6.4** Before connecting Drive (R7): make the photo sync in `server/src/submissions.js` run without blocking the response (`syncPhotos(...)` not awaited, its errors still logged), with a test that a save returns while the Drive fake is stalled.

### Rollback (any time after Phase 2)

1. On the server, as Administrator: `Stop-ScheduledTask TTA-Portal`, then kill whatever listens on 3001 (the Restart row in the runbook).
2. **Code only:** `robocopy C:\tta-portal-previous C:\tta-portal /E /XD data backups node_modules logs /XF .env`, then `cd C:\tta-portal\server; npm.cmd ci --omit=dev; Start-ScheduledTask TTA-Portal`.
3. **Data too:** copy the newest snapshot from `C:\tta-portal\server\backups\db` over `server\data\portal.db`, after deleting `portal.db-wal` and `portal.db-shm`. Then start the task.
4. Check `/api/health` and `Get-Content C:\tta-portal\RELEASE.txt`.

---

## Self-review

- Every runbook section and risk R1–R7 maps to a task: build (0.3, 0.6), install (2), operate and roll back (0.4, Phase 6), CITES (1, 4), landing page (5.1), HTTPS switch (6.3).
- Code steps show full code. Blanks (`______`) are for facts recorded during the deploy, not missing design.
- Names are consistent: `config.cookieSecure`, `deploy/kmutt/release/`, task `TTA-Portal`, `RELEASE.txt`, tag `v2026.11.27`, `C:\tta-portal-previous`.
