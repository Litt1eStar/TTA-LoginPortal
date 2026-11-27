# Deploying to the KMUTT server, step by step

First-time install of the two TTA projects on `CIT_TTA2027` (Windows Server 2025, `10.2.15.250`).
For updating them later, see [`docs/MAINTENANCE_WORKFLOW.md`](../../docs/MAINTENANCE_WORKFLOW.md).

| | Variant 1: **Fullstack website** (Login Portal) | Variant 2: **Landing Page** |
|---|---|---|
| What it is | React website **+** Node API **+** SQLite database | React website only (static files) |
| Repo | `Litt1eStar/TTA-LoginPortal` | `Litt1eStar/TTA-LandingPage` |
| Runs as | Node, started by Scheduled Task `TTA-Portal` | Files served by nginx (Scheduled Task `TTA-Nginx`) |
| Port | 3001, reached through nginx on 80 (`/portal/`, `/api/`) | 80 (nginx, `/`) |
| Address | `https://tta2027.kmutt.ac.th/portal/` | `https://tta2027.kmutt.ac.th/` |
| Needs on the server | Node.js 22.13+, Git | Node.js (to build), Git, nginx |

Do Part 0 once, then Variant 1, then nginx and the domain
([`NGINX_DOMAIN_SETUP.md`](NGINX_DOMAIN_SETUP.md)), then Variant 2 if you want the Landing Page here too. Every command block goes into **PowerShell as
Administrator** on the server. Copy each block whole and press Enter.

---

## Part 0: Prepare (once per server)

### 0.1 Connect to the server

1. On the laptop, connect to the **KMUTT VPN**.
2. Press `Win + R`, type `mstsc`, press Enter.
3. **Computer:** `10.2.15.250` · **User name:** `10.2.15.250\Administrator`.
4. Click **Show Options → Local Resources → More…** and untick **Drives**, **Smart cards**,
   **Ports** and **WebAuthn**. Keep **Clipboard** ticked (lets you copy text into the server).
5. Click **Connect** and enter the password.

If it stays on a black "Please wait" screen for more than 5 minutes: close it, run
`mstsc /admin /v:10.2.15.250` with **everything** unticked (Clipboard too), and accept if it offers
to disconnect another session. If it still hangs, ask CITES to sign out the stuck session or
restart the server. Only Remote Desktop (port 3389) is reachable from the VPN; there is no SSH or
remote PowerShell.

### 0.2 Open PowerShell as Administrator

Start → type `PowerShell` → right-click **Windows PowerShell** → **Run as administrator** → **Yes**.

### 0.3 Install Node.js and Git

1. In **Microsoft Edge** on the server, go to <https://nodejs.org> and download the **LTS**
   **Windows Installer (.msi), x64**. Run it with all defaults (leave "Automatically install the
   necessary tools" unticked).
2. Go to <https://git-scm.com/download/win>, click **Click here to download** (64-bit), run it with
   all defaults.
3. **Close every PowerShell window** and open a new one as Administrator (0.2), so it finds the new
   programs.

### 0.4 Check

```powershell
node --version
git --version
New-Item -ItemType Directory -Force C:\temp | Out-Null
```

Expected: `v22.13.0` or higher (v24 is fine) and `git version 2.x`. If either says *not
recognized*, sign out of Windows (**Start → Sign out**) and back in.

---

## Variant 1: Fullstack website (Login Portal)

### 1.1 Put the accounts file on the server

The accounts file (`TeachingAcademy\data\TTA-portal-accounts.md`) holds the starting passwords. It
is **never** put in git.

Copy it to `C:\temp\TTA-portal-accounts.md` on the server in one of these ways:

- Clipboard: Ctrl+C the file on the laptop, Ctrl+V into `C:\temp` in the Remote Desktop window, or
- Notepad: open it on the laptop, copy all the text, paste into Notepad on the server, **Save As**
  `C:\temp\TTA-portal-accounts.md` with *Save as type* = **All files** (otherwise it becomes `.md.txt`), or
- Your private OneDrive/Google Drive in Edge, then delete it from the cloud afterwards.

Check:

```powershell
Test-Path C:\temp\TTA-portal-accounts.md     # must print True
```

### 1.2 Download the code

```powershell
git clone -b deploy/kmutt https://github.com/Litt1eStar/TTA-LoginPortal.git C:\temp\TTA-LoginPortal
cd C:\temp\TTA-LoginPortal
git branch --show-current
git log -1 --oneline
```

The branch must be `deploy/kmutt` (or `main` once `deploy/kmutt` has been merged into it). The repo is
public, so no GitHub sign-in is needed. If the folder already exists, use `git pull` inside it instead.

### 1.3 Build the release

```powershell
cd C:\temp\TTA-LoginPortal
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
```

Takes a few minutes. Yellow `npm warn` lines are fine. The last line must be like:

```
Done: C:\temp\TTA-LoginPortal\deploy\kmutt\release\tta-portal.zip  (commit 5b8ae42 v2026.11.27, 9.2 MB)
```

### 1.4 Install and start

Replace the address after `-AppOrigin` with the address people will use to open the portal
(`http://10.2.15.250:3001` for now).

```powershell
cd C:\temp\TTA-LoginPortal\deploy\kmutt\release\tta-portal
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-on-server.ps1 -AccountsFile C:\temp\TTA-portal-accounts.md -AppOrigin http://10.2.15.250:3001
```

What it does:

| Creates / sets | Where |
|---|---|
| The portal (website + API) | `C:\tta-portal` |
| Settings with a random session secret, created once | `C:\tta-portal\server\.env` |
| Database with the accounts (password hashes only) | `C:\tta-portal\server\data\portal.db` |
| Auto-start at boot as SYSTEM, auto-restart on crash | Scheduled Task `TTA-Portal` → `server\run.cmd` |
| Daily backup at 03:00, kept 14 days | Scheduled Task `TTA-Portal-Backup` → `server\backups\` |
| Firewall rule for TCP 3001 | Windows Firewall rule "TTA Portal" |

The last line must be `OK: portal is running (commit ..., tag ..., built ...)`.

### 1.5 Delete the accounts file

```powershell
Remove-Item C:\temp\TTA-portal-accounts.md
```

### 1.6 Check

```powershell
(Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing).Content   # {"ok":true,...}
Get-ScheduledTask TTA-Portal, TTA-Portal-Backup | Select-Object TaskName, State # Running / Ready
```

In Edge on the server open `http://localhost:3001/`: log in with an admin account, press F5 (still
logged in), log out. From the laptop on VPN, open `http://10.2.15.250:3001/` and do the same.

### 1.7 Settings you may change later

Edit with `notepad C:\tta-portal\server\.env`, then restart (see the Maintenance workflow, §6).

| Setting | Now | When to change |
|---|---|---|
| `APP_ORIGIN` | `http://10.2.15.250:3001` | The portal gets a domain. Used for photo links in exports and Google Drive. |
| `COOKIE_SECURE` | `false` | `true` **only** once the portal is reached over HTTPS. On plain http it breaks login. |
| `TRUST_PROXY` | (not set) | `TRUST_PROXY=2` once the portal is reached through the university proxy **and** nginx (see `NGINX_DOMAIN_SETUP.md`). |
| `DEADLINE` | `2026-12-30T23:59:00+07:00` | The submission deadline moves. |

Never share `.env`; it holds `SESSION_SECRET`.

---

## Variant 2: Landing Page (static website)

The Landing Page is plain files (HTML, JS, images) after `npm run build`. It shares the portal's
domain and is served by the **nginx** that sits on port 80 ([`NGINX_DOMAIN_SETUP.md`](NGINX_DOMAIN_SETUP.md)).
No Node process and no IIS run for it.

```
https://tta2027.kmutt.ac.th/          ─▶ nginx ─▶ Landing Page files   C:\sites\tta-landing\site
https://tta2027.kmutt.ac.th/portal/   ─▶ nginx ─▶ Login Portal         127.0.0.1:3001
https://tta2027.kmutt.ac.th/api/...   ─▶ nginx ─▶ Login Portal API
```

Prerequisites: Variant 1 installed, and nginx running (`NGINX_DOMAIN_SETUP.md`, Parts A–D). No extra
domain or request to IT is needed.

### 2.1 Before you start (on the laptop)

1. The **Login button** points at `PORTAL_URL` in `TTA-LandingPage\src\App.jsx`:
   ```js
   const PORTAL_URL = 'https://tta2027.kmutt.ac.th/portal/';
   ```
2. `npm.cmd test` and `npm.cmd run build` pass; commit; everything to publish is on **`main`** and
   pushed. The server builds `main`.

> Pushing the Landing Page's `main` also deploys it to the CMM droplet (`https://tta.cmm.works`)
> through its own GitHub workflow. That copy's Login button then opens the KMUTT portal too.

### 2.2 Build, copy, and switch nginx on the server

Follow `NGINX_DOMAIN_SETUP.md` **Part H**:

| Step | What it does |
|---|---|
| H2 | Updates the portal to the `/portal/` build (adds `BASE_PATH=/portal` to its `.env`) |
| H3 | Clones and builds the Landing Page, copies it to `C:\sites\tta-landing\site` |
| H4 | Installs the nginx config that serves `/` from those files and `/portal/` + `/api/` from the portal |
| H5 | Checks both, on the server and from outside |

### 2.3 Updating the Landing Page later

On the laptop: edit → test → push `main`. On the server (`docs/MAINTENANCE_WORKFLOW.md` §4.2):

```powershell
cd C:\temp\TTA-LandingPage
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\redeploy.ps1
```

(First time: `git pull` before it, so the clone has the script.) It tests, builds, keeps the live
version in `site-previous`, publishes and checks the site, and puts the previous version back if the
check fails. nginx serves the new files at once; no restart, no reload.

> The Landing Page must not have its own `/portal/` or `/api/` paths: on this domain they belong to
> the Login Portal.

---

## Part 3: After both are installed

### 3.1 Restart test (do once before launch)

```powershell
Restart-Computer
```

Wait 3–5 minutes, reconnect, and check both without doing anything else:

```powershell
(Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing).StatusCode   # 200: portal
(Invoke-WebRequest http://localhost/api/health -UseBasicParsing).StatusCode        # 200: nginx -> portal
curl.exe -s -o NUL -w "%{http_code}" http://localhost/portal/                      # 200: nginx -> portal page
curl.exe -s -o NUL -w "%{http_code}" http://localhost/                             # 200: Landing Page
```

Then open `https://tta2027.kmutt.ac.th/` and `https://tta2027.kmutt.ac.th/portal/` from the laptop.

Do this when CITES can help, in case Remote Desktop hangs after the restart.

### 3.2 Domain names and outside access

`10.2.15.250` is a **private** address: it only works on the KMUTT network or VPN. The university
publishes sites through its own reverse proxy (`mainwebreverse.kmutt.ac.th`, nginx), which holds the
HTTPS certificate and forwards to **port 80** on this server.

The portal's domain is **`tta2027.kmutt.ac.th`**. Its full setup (nginx on port 80 → portal on 3001,
`.env` switch to HTTPS, Google Drive) is in [`NGINX_DOMAIN_SETUP.md`](NGINX_DOMAIN_SETUP.md).

Because every domain arrives on port 80, each further site (the Landing Page, or another project)
gets its own domain from IT and its own `server { }` block in nginx, as in Variant 2. Don't put IIS
or anything else on port 80: nginx needs it.

### 3.3 Where everything is

| What | Where |
|---|---|
| Portal program | `C:\tta-portal` (previous version: `C:\tta-portal-previous`) |
| Portal database and uploads | `C:\tta-portal\server\data\` |
| Portal backups | `C:\tta-portal\server\backups\` |
| Portal settings | `C:\tta-portal\server\.env` |
| Portal log | `C:\tta-portal\logs\portal.log` |
| Portal version | `C:\tta-portal\RELEASE.txt` |
| nginx (port 80) | `C:\nginx` (config `conf\nginx.conf`, logs `logs\`), Task `TTA-Nginx` |
| Landing Page files | `C:\sites\tta-landing\site` |
| Landing Page settings | Its `server { }` block in `C:\nginx\conf\nginx.conf` (from `deploy/kmutt/nginx/nginx.conf`) |
| Source code (for updates) | `C:\temp\TTA-LoginPortal`, `C:\temp\TTA-LandingPage` |
