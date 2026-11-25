# Maintaining the TTA projects: from an edit to the live server

How a change goes from your laptop to the KMUTT server. For the first install on a new server, see
[`deploy/kmutt/DEPLOY_STEP_BY_STEP.md`](../deploy/kmutt/DEPLOY_STEP_BY_STEP.md).

```
 LAPTOP                                   GITHUB                    KMUTT SERVER (10.2.15.250)
 edit → run locally → test → commit  →    git push   →   Remote Desktop: git pull → build → install → check
```

---

## 1. What lives where

| | Login Portal (fullstack) | Landing Page (static) |
|---|---|---|
| Laptop folder | `TeachingAcademy\TTA-LoginPortal` | `TeachingAcademy\TTA-LandingPage` |
| GitHub | `Litt1eStar/TTA-LoginPortal` | `Litt1eStar/TTA-LandingPage` |
| Branch the server builds | `deploy/kmutt` (switch to `main` once it is merged, see §6) | `main` |
| Source on the server | `C:\temp\TTA-LoginPortal` (git clone) | `C:\temp\TTA-LandingPage` (git clone) |
| Installed and running from | `C:\tta-portal` | `C:\tta-landing\site` |
| Served by | Node, Scheduled Task `TTA-Portal`, port **3001** | IIS website `TTA-Landing`, port **80** |
| Data | `C:\tta-portal\server\data\` (`portal.db`, `uploads\`) | none |
| Settings | `C:\tta-portal\server\.env` (never in git) | none (the portal link is in `src\App.jsx`) |

Rules that keep this safe:

- **The server only ever builds what is on GitHub.** Never edit code on the server; edit on the
  laptop, push, pull.
- **Never put secrets in git**: no `.env`, no accounts file, no passwords, no tokens.
- **Data never moves with an update.** The installer keeps `server\data`, `server\backups` and `.env`.

---

## 2. On the laptop: edit and check

### 2.1 Login Portal

Run it locally (two terminals in `TTA-LoginPortal`):

```powershell
# terminal 1: API on http://127.0.0.1:3001
cd server
npm.cmd run dev

# terminal 2: website on http://localhost:3000 (Vite)
npm.cmd run dev
```

If `npm run dev` fails with `EADDRINUSE 127.0.0.1:3001`, an old API is still running: close its
terminal (or end that `node.exe`) and try again. If it says `'vite' is not recognized`, run
`npm.cmd ci` first.

Before you commit, all three must pass:

```powershell
npm.cmd test                       # website tests
cd server; npm.cmd test; cd ..     # API tests
npm.cmd run build                  # the website builds
```

Changes to the database go in a **new** file in `server\migrations\` (`004_...sql`, `005_...sql`);
never edit an old one. The server applies new migrations by itself when it starts.

### 2.2 Landing Page

```powershell
cd TTA-LandingPage
npm.cmd run dev        # http://localhost:5173
npm.cmd test
npm.cmd run build
```

The "Login" button points at the constant `PORTAL_URL` in `src\App.jsx`. Change it when the portal's
address changes (for example to the university domain).

---

## 3. Commit and push

```powershell
git status                       # check nothing secret is listed
git add -A
git commit -m "fix: what you changed"
git push
```

Work on a feature branch if you like, but **the server only pulls the branch in the table in §1**, so
merge into that branch before you deploy.

If GitHub refuses the push with `refusing to allow a Personal Access Token to create or update
workflow ... without workflow scope`, your token needs the **workflow** permission (GitHub →
Settings → Developer settings → Personal access tokens), or the change to `.github/workflows/` must
wait.

---

## 4. On the server: pull, build, install

Connect with Remote Desktop (`10.2.15.250`, user `10.2.15.250\Administrator`, on the KMUTT VPN) and
open **PowerShell as Administrator** (Start → type `PowerShell` → right-click → *Run as
administrator*).

> If Remote Desktop hangs at "Please wait": connect with `mstsc /admin` and Local Resources →
> More… → everything unticked. If it still hangs, CITES has to sign out the session or restart the
> server.

### 4.1 Login Portal (about 5 minutes, portal down for ~20 seconds)

```powershell
cd C:\temp\TTA-LoginPortal
git pull
git log -1 --oneline        # must show the commit you just pushed
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
cd .\deploy\kmutt\release\tta-portal
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-on-server.ps1
```

- **Do not** pass `-AccountsFile` on an update.
- `package-release.ps1` ends with `Done: ...tta-portal.zip (commit <yours> ...)`.
- `install-on-server.ps1` stops the portal, backs up the database and uploads, keeps the old version in
  `C:\tta-portal-previous`, installs the new one and starts it. It ends with
  `OK: portal is running (commit <yours>, ...)`.

### 4.2 Landing Page (about 2 minutes, no downtime)

```powershell
cd C:\temp\TTA-LandingPage
git pull
git log -1 --oneline
npm.cmd ci
npm.cmd run build
robocopy .\dist C:\tta-landing\site /MIR /XF web.config
```

`/XF web.config` keeps the IIS settings file that is not in the build. Robocopy exit codes 0–7 are
success. IIS serves the new files at once; no restart.

---

## 5. Check it

Login Portal:

```powershell
Get-Content C:\tta-portal\RELEASE.txt                                          # the commit you expect
(Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing).Content  # {"ok":true,...}
Get-Content C:\tta-portal\logs\portal.log -Tail 20                              # no errors
```

Then in a browser, `http://localhost:3001/` on the server (or `http://10.2.15.250:3001/` from the
laptop on VPN): log in, look at what you changed, log out.

Landing Page: open `http://localhost/` on the server (or `http://10.2.15.250/` from the laptop),
press **Ctrl+F5**, and click the Login button.

---

## 6. If something goes wrong

### Roll back the Login Portal to the previous version

The data stays as it is; only the program goes back.

```powershell
Stop-ScheduledTask TTA-Portal; Start-Sleep 3
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like '*src\index.js*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
robocopy C:\tta-portal-previous C:\tta-portal /E /XD C:\tta-portal-previous\server\data C:\tta-portal-previous\server\backups /XF .env
Remove-Item C:\tta-portal\UPDATING -ErrorAction SilentlyContinue
Start-ScheduledTask TTA-Portal
Get-Content C:\tta-portal\RELEASE.txt
```

Then fix the problem on the laptop, push, and update again.

> A rollback cannot undo a new migration that has already run. Migrations only ever add tables or
> columns, so the older version normally still works, but test schema changes locally first.

### Roll back the Landing Page

```powershell
cd C:\temp\TTA-LandingPage
git log --oneline -5                 # pick the last good commit
git checkout <good-commit>
npm.cmd ci; npm.cmd run build
robocopy .\dist C:\tta-landing\site /MIR /XF web.config
git checkout main                    # back to normal for the next update
```

### Common problems

| Symptom | Cause / fix |
|---|---|
| `git pull` says *Your local changes would be overwritten* | Someone edited files on the server. `git checkout -- .` then pull again (server copies are never edited). |
| `package-release.ps1`: `npm ci failed` | No internet on the server, or a broken `package-lock.json`. Paste the last 30 lines. |
| Installer: `port 3001 is still in use` | `Get-NetTCPConnection -LocalPort 3001 \| Select OwningProcess`, end that process, run the installer again. |
| Installer: health check failed | `Get-Content C:\tta-portal\logs\portal.log -Tail 40`; fix, push, update again, or roll back. |
| Portal page is blank over http | `COOKIE_SECURE=true` in `.env` without HTTPS. Set it to `false` and restart. |
| Landing page still shows the old version | Browser cache: Ctrl+F5. Check `C:\tta-landing\site\index.html` changed. |

### Restart the portal (after editing `.env`)

```powershell
Stop-ScheduledTask TTA-Portal; Start-Sleep 3
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like '*src\index.js*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-ScheduledTask TTA-Portal
```

---

## 7. One-time clean-up still to do

- **Merge `deploy/kmutt` into `main`** of the Login Portal and push. Then on the server:
  `cd C:\temp\TTA-LoginPortal; git checkout main; git pull`, and use `main` from then on. Until
  that merge, do **not** push `main`: its old `.github/workflows/deploy.yml` deploys to the CMM
  droplet on every push.
- Optionally move the server copies out of `C:\temp` (e.g. to `C:\src\`) so they are not deleted by
  accident, and use the new paths above.

---

## 8. Checklist (copy for each update)

- [ ] Tested locally; tests and build pass
- [ ] Committed and pushed to the branch the server builds
- [ ] Remote Desktop → PowerShell as Administrator
- [ ] `git pull`; `git log -1` shows my commit
- [ ] Built and installed; saw `OK: portal is running` / robocopy finished
- [ ] `RELEASE.txt` / health / browser check done
- [ ] Logged out of Remote Desktop with **Start → Sign out**
