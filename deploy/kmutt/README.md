# Deploying the TTA Portal to the KMUTT server (`CIT_TTA2027`)

Ready-to-use runbook. Last updated 2026-11-25.
Covers only the university server. The CMM droplet fallback is `deploy/cmm/README.md`. Progress is tracked in `docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md`.

> Passwords are not stored here. The Administrator password and the portal accounts live only in `data/TTA-portal-accounts.md` (private, never committed). The Administrator password appeared in a photo: change it when you finish.

## 0. At a glance

| | |
|---|---|
| Server | `CIT_TTA2027`, Windows Server 2025, 4 vCPU, 8 GB RAM |
| Address | `10.2.15.250` (internal KMUTT IP: needs KMUTT network or VPN) |
| Portal URL | `http://tta.cmm.works:3001/` (placeholder name on the owner's GoDaddy domain, A record → 10.2.15.250; VPN/KMUTT network only) or `http://10.2.15.250:3001/`, until a real domain and HTTPS exist |
| How it runs | Node.js, one process serves the API and the website. SQLite file for data. No Docker. |
| Install folder | `C:\tta-portal` (database and uploads in `C:\tta-portal\server\data`) |
| Auto-start | Scheduled Task `TTA-Portal` (at boot, restarts on crash), daily backup task at 03:00 |

Status:

| Step | State |
|---|---|
| VPN + Remote Desktop | Works |
| Release package script and install script | In the repo (`deploy/kmutt/`); release builds from HEAD |
| Install on the server | **Not done yet** |
| SSH (port 22) | Blocked by the network, waiting on CITES (section 6). Not needed for this runbook. |
| Domain, HTTPS, access from outside KMUTT | Waiting on CITES (section 7) |

## 1. Connect

1. Connect **KMUTT VPN** (Windows built-in VPN):
   - Server `vpn.kmutt.ac.th`, type `L2TP/IPsec with pre-shared key`, key `kmutt.ac.th`
   - Username: student ID (10 digits) or staff email prefix. Password: KMUTT account password.
   - Adapter Properties, Security tab: allow CHAP and MS-CHAP v2. Manual: https://cc.kmutt.ac.th/VPN.html
2. Remote Desktop: `Win + R`, `mstsc`, computer `10.2.15.250`, "Use a different account", user `10.2.15.250\Administrator`.
3. Before opening Remote Desktop, click **Show Options, Local Resources, More..., Drives** and tick your `C:` drive. That lets you copy files in the next section.

If a connection fails, check the VPN first. Test from the laptop: `Test-NetConnection 10.2.15.250 -Port 3389`.

## 2. Build the release (on the laptop)

```powershell
cd "C:\Users\krittin pragopdee\OneDrive\Desktop\University\TeachingAcademy\TTA-LoginPortal"
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
```

Result: `deploy\kmutt\release\tta-portal.zip` (about 1.6 MB), built from the last commit: `RELEASE.txt` inside names the commit and tag. Uncommitted edits are not included. It contains no passwords, database or `.env`.

The script builds in a temporary copy, so it does not touch the project's `node_modules` or the tracked `dist\` folder. Run it again whenever the portal code changes.

## 3. Install (on the server)

1. **Copy files in.** In the Remote Desktop session, open File Explorer, then **This PC**. Your laptop drive appears as `C on <laptop name>`. Copy these two files to `C:\temp\` on the server (create the folder):
   - `...\TeachingAcademy\TTA-LoginPortal\deploy\kmutt\release\tta-portal.zip`
   - `...\TeachingAcademy\data\TTA-portal-accounts.md`
2. **Install Node.js** (first time only): download the **LTS MSI (22 or newer)** from https://nodejs.org inside the session (or copy the installer over the same way) and install with the defaults. Then open a **new** PowerShell window as Administrator.
3. **Unzip and run**:

```powershell
Expand-Archive C:\temp\tta-portal.zip C:\temp\tta-portal -Force
cd C:\temp\tta-portal
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-on-server.ps1 -AccountsFile C:\temp\TTA-portal-accounts.md -AppOrigin http://tta.cmm.works:3001
```

   The script:
   - checks Node is 22.13 or newer
   - copies the site to `C:\tta-portal`
   - runs `npm ci --omit=dev`
   - creates `server\.env` once, with a random `SESSION_SECRET`
   - seeds the 10 coordinator and admin accounts (bcrypt hashes only)
   - on an update: stops the portal, backs up the database and uploads, and keeps the previous release in `C:\tta-portal-previous`
   - registers the auto-start and backup tasks
   - restarts the portal by itself if Node exits (loop in `server\run.cmd`)
   - opens firewall port 3001
   - starts the portal and calls `/api/health`
   - ends with `OK: portal is running (commit …)`

4. **Delete the accounts file from the server**:

```powershell
Remove-Item C:\temp\TTA-portal-accounts.md
```

5. **Check from the laptop** (VPN connected): open `http://10.2.15.250:3001/`. If the page does not load, the web port is probably blocked by the network: see section 7. On the server itself, `http://localhost:3001/` should work.

Nothing in the script restarts the machine. If the install step fails, fix the cause and run it again: it is safe to repeat.

## 4. Check it works

Run through this once, from a machine on the KMUTT network or VPN:

- [ ] `http://10.2.15.250:3001/api/health` returns `{"ok":true,...}`
- [ ] Open the portal **in a browser on the laptop** (not on the server): the login page shows with styles. A blank page means the HTTPS-upgrade headers are still being sent.
- [ ] A coordinator account logs in (usernames: `kmitl`, `kmutt`, `kmutnb`, `rmutk`, `rmutsb`, `rmutp`, `rmutt`, `rmutl`, `rmutsv`, `rmuti`) and sees only its own university
- [ ] Add a member with a photo, save a draft, reload: the data is still there
- [ ] Submit one entry: it locks
- [ ] `admin1` logs in at `/admin` and can export the CSV
- [ ] Reboot test (when you can): the portal comes back by itself
- [ ] Crash test: on the server, `Get-NetTCPConnection -LocalPort 3001 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`; within about 10 s `/api/health` answers again.

## 5. Operate

| Task | Command (PowerShell as Administrator) |
|---|---|
| Update to a new version | Build a new zip (section 2), copy it over, unzip, run `install-on-server.ps1` again with no `-AccountsFile`. Keeps `.env`, database and uploads. |
| Restart | `Stop-ScheduledTask TTA-Portal; Get-NetTCPConnection -LocalPort 3001 -State Listen \| % { Stop-Process -Id $_.OwningProcess -Force }; Start-ScheduledTask TTA-Portal` |
| Which version is running | `Get-Content C:\tta-portal\RELEASE.txt` |
| Roll back | See the deploy plan, Phase 6 "Rollback" |
| Logs | `Get-Content C:\tta-portal\logs\portal.log -Tail 50` |
| Is it listening | `Get-NetTCPConnection -LocalPort 3001 -State Listen` |
| Re-seed or reset a password | Copy the accounts file over, then in `C:\tta-portal\server`: `npm.cmd run seed -- C:\temp\TTA-portal-accounts.md`, then delete the file |
| Change the deadline or other settings | Edit `C:\tta-portal\server\.env`, then restart. Default is `DEADLINE=2026-12-15T23:59:00+07:00`. |
| Backup now | `cd C:\tta-portal\server; npm.cmd run backup`. Output in `server\backups` (database snapshots kept 14 days, uploads copied). |
| Restore | Stop the task, replace `server\data\portal.db` with a snapshot from `server\backups\db`, start the task. |

The daily backup stays on the same disk. Copy `C:\tta-portal\server\backups` somewhere else regularly (for example through Remote Desktop drive redirection) until CITES offers off-machine backup.

## 6. SSH (optional, blocked)

SSH would let the assistant deploy from the project. It is not required: sections 2 and 3 work without it.

- Server side is done: `sshd` is running and listening on `0.0.0.0:22`, and `OpenSSH-Server-In-TCP` allows it from any address. There are no block rules.
- From the VPN, port 3389 connects and port 22 does not, and `sshd` logs no attempt. So the packets are dropped on the network before the server: only CITES can open it.
- Do not tunnel around the block. Ask CITES (section 7).
- After CITES opens it: `Test-NetConnection 10.2.15.250 -Port 22`, then add an SSH key (put the public key in `C:\ProgramData\ssh\administrators_authorized_keys`) and change the Administrator password.

## 7. Open items and the message for CITES

| Item | Owner | Why |
|---|---|---|
| Web port reachable (3001, or 80/443) | CITES | Probably blocked even from the VPN. Without it nobody can open the portal. |
| Access from outside KMUTT (public IP or proxy) | CITES | The other 9 universities are not on the KMUTT network. |
| Domain name and HTTPS certificate | CITES / project owner | After that: set `COOKIE_SECURE=true`, `TRUST_PROXY=1` (if behind a proxy) and `APP_ORIGIN=https://<domain>` in `.env`, and restart. |
| TCP 22 (SSH) | CITES | Optional, for scripted deploys. |
| Landing Page address | Project owner | `TTA-LandingPage/src/App.jsx` has `PORTAL_URL = 'https://tta.portal.cmm.works/'`. Change it to the final portal address. |
| Google Drive video upload | Project owner | Needs the final address in `GOOGLE_REDIRECT_URI` and the same redirect URI in the Google OAuth client. |
| Video upload and Drive photo sync | Project owner | Google OAuth needs an https redirect URI, so Drive can't be connected over http. YouTube links and portal-stored photos work; Drive features wait for the domain and HTTPS. |
| Administrator password | Project owner | Change it after the install (`Ctrl+Alt+End` in Remote Desktop, Change a password). |

Message to send CITES:

> ขอเปิดพอร์ตสำหรับเครื่อง CIT_TTA2027 (10.2.15.250) ดังนี้
> 1. TCP 3001 (หรือ 80/443) จากเครือข่าย KMUTT VPN และจากอินเทอร์เน็ตภายนอก สำหรับเว็บ TTA 2027 ที่ผู้ประสานงานจาก 10 มหาวิทยาลัยต้องเข้าใช้
> 2. TCP 22 (SSH) จากเครือข่าย VPN สำหรับ deploy (ฝั่งเครื่องตั้งค่าเสร็จแล้ว: sshd listen 0.0.0.0:22 และ Windows Firewall อนุญาต แต่จากวง VPN ต่อ 3389 ได้ ส่วน 22 ไม่ถึงเครื่อง)
> 3. ขอชื่อโดเมนและใบรับรอง HTTPS (หรือให้ผูกโดเมนของ มจธ. มาที่เครื่องนี้)

Fallback if the university server cannot be reached from outside in time: run the same app on the CMM droplet (`deploy/cmm/README.md`) and move later. The data is one database file plus the uploads folder.

## 8. Files in this folder

| File | Purpose |
|---|---|
| `README.md` | This runbook |
| `package-release.ps1` | Laptop: builds `release\tta-portal.zip` from HEAD |
| `install-on-server.ps1` | Server: installs or updates, backs up, seeds, registers tasks, health-checks |
| `release/` | Generated, ignored by git |

## 9. Decision log

- 2026-11-25: Deploy to the university server first, domain later (owner's call).
- 2026-11-25: Windows Server has no usable Docker. Node runs directly, started by a Scheduled Task as SYSTEM.
- 2026-11-25: RDP works over KMUTT VPN. SSH port 22 is blocked upstream, so deployment goes over Remote Desktop file copy.
- 2026-11-25: Release is built in a temp copy so it never disturbs running dev servers or the tracked `dist\`.
- 2026-11-25: Scripts and runbook moved into the repo (`deploy/kmutt/`); releases are built from a commit. Placeholder name `tta.cmm.works` until the real domain.
