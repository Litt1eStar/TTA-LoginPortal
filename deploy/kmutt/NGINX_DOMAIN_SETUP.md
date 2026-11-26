# Putting the Login Portal on `https://tta2027.kmutt.ac.th` (nginx on the KMUTT server)

> **Final layout (Part H):** the Landing Page at `https://tta2027.kmutt.ac.th/` and the Login Portal
> at `https://tta2027.kmutt.ac.th/portal/`. Parts A–E (done on 26 Nov) first put the portal at `/`;
> a server already through Part E only needs **Part H**.

## How it fits together

```
 browser ──https──▶ university reverse proxy ──http:80──▶ nginx (this server) ──▶ Login Portal
                    mainwebreverse.kmutt.ac.th            C:\nginx, port 80         127.0.0.1:3001
                    (KMUTT IT, holds the certificate)     (Scheduled Task)          (Scheduled Task)
```

What was checked from the laptop on 26 Nov 2026:

- `tta2027.kmutt.ac.th` is a CNAME for `mainwebreverse.kmutt.ac.th`: public `202.44.11.241/242`,
  inside KMUTT `10.1.67.251/252`. It works from inside KMUTT, on the VPN, and from the internet.
- `http://tta2027.kmutt.ac.th` redirects to `https://`. The proxy runs nginx and has the certificate.
- `https://tta2027.kmutt.ac.th` connects but times out: the proxy forwards to port 80 on our server,
  where nothing answers yet. Installing nginx on port 80 fixes that.

So **HTTPS is KMUTT IT's job and is already done**. Our nginx only listens on plain http port 80 and
passes everything to the portal. Later, more sites can share port 80, each with its own domain.

Do the parts in order. Every command block goes into **PowerShell as Administrator** on the server
(Remote Desktop → Start → type `PowerShell` → right-click → *Run as administrator*). The portal keeps
working on `http://10.2.15.250:3001` until Part E.

---

## Part A: Check port 80 is free

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, OwningProcess
Get-Service W3SVC -ErrorAction SilentlyContinue | Select-Object Name, Status
```

- Nothing printed by the first line: port 80 is free; go to Part B.
- `W3SVC  Running` (IIS is installed and holds port 80): stop it, so nginx can have the port:
  ```powershell
  Stop-Service W3SVC; Set-Service W3SVC -StartupType Disabled
  ```
- Another process holds it: `Get-Process -Id <OwningProcess>` and send me the name before going on.

---

## Part B: Get the nginx config from GitHub

```powershell
cd C:\temp\TTA-LoginPortal
git pull
Test-Path .\deploy\kmutt\nginx\nginx.conf      # must print True
```

---

## Part C: Install nginx

```powershell
$v = '1.30.8'     # "Stable version" on https://nginx.org/en/download.html
Invoke-WebRequest "https://nginx.org/download/nginx-$v.zip" -OutFile C:\temp\nginx.zip -UseBasicParsing
Expand-Archive C:\temp\nginx.zip C:\temp\nginx-unzip -Force
Move-Item "C:\temp\nginx-unzip\nginx-$v" C:\nginx
Remove-Item C:\temp\nginx-unzip, C:\temp\nginx.zip -Recurse -Force
Copy-Item C:\temp\TTA-LoginPortal\deploy\kmutt\nginx\nginx.conf C:\nginx\conf\nginx.conf -Force
cd C:\nginx
.\nginx.exe -t
```

The last command must print:

```
nginx: the configuration file C:\nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:\nginx/conf/nginx.conf test is successful
```

If `Move-Item` says `C:\nginx` already exists, an older copy is there: rename it
(`Rename-Item C:\nginx C:\nginx-old`) and run the block again. If `-t` reports an error, send me
the text and don't continue.

---

## Part D: Run nginx at startup and open port 80

```powershell
@(
  '@echo off',
  'cd /d C:\nginx',
  ':loop',
  'nginx.exe',
  'echo %date% %time% nginx exited with %errorlevel%, restarting in 5 s >> logs\restart.log',
  'ping -n 6 127.0.0.1 > nul',
  'goto loop'
) | Set-Content C:\nginx\run-nginx.cmd -Encoding ASCII

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'TTA-Nginx' -Force -Principal $principal -Settings $settings `
  -Action (New-ScheduledTaskAction -Execute 'C:\nginx\run-nginx.cmd' -WorkingDirectory 'C:\nginx') `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) | Out-Null

if (-not (Get-NetFirewallRule -DisplayName 'TTA nginx (http 80)' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'TTA nginx (http 80)' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow | Out-Null
}

Start-ScheduledTask 'TTA-Nginx'
Start-Sleep 3
(Invoke-WebRequest http://localhost/api/health -UseBasicParsing).Content
```

The last line must print `{"ok":true,...}`: nginx on port 80 reaches the portal.

Like the portal, nginx now starts at boot as SYSTEM (nobody needs to be signed in) and restarts by
itself 5 seconds after a crash.

### Check from outside

From the laptop (on VPN or any internet connection), open **https://tta2027.kmutt.ac.th/**. The
login page must appear with a padlock. Log in once, press F5, and log out.

It works even before Part E, because the browser talks HTTPS to the university proxy. If it still
times out, the university proxy cannot reach our port 80: send KMUTT IT the message in Part G.

---

## Part E: Switch the portal to HTTPS mode

Do this only after the check above works. Open the settings:

```powershell
notepad C:\tta-portal\server\.env
```

Change or add these three lines (keep everything else), then save:

```
APP_ORIGIN=https://tta2027.kmutt.ac.th
COOKIE_SECURE=true
TRUST_PROXY=2
```

| Setting | Effect |
|---|---|
| `APP_ORIGIN` | Photo links in admin exports and Google Drive use the domain |
| `COOKIE_SECURE=true` | Login cookie only travels over HTTPS; adds the HTTPS-only security headers |
| `TRUST_PROXY=2` | The portal sees each visitor's real IP through the two proxies (university + nginx), so the login rate limit (30 a minute per IP) applies per visitor and not to everyone at once |

Restart the portal:

```powershell
Stop-ScheduledTask TTA-Portal; Start-Sleep 3
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like '*src\index.js*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-ScheduledTask TTA-Portal
Start-Sleep 5
(Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing).Content
```

Check again at https://tta2027.kmutt.ac.th/: log in, F5, log out.

> From now on use **only** `https://tta2027.kmutt.ac.th`. The old `http://10.2.15.250:3001` address
> no longer works for logging in (the browser won't send a secure cookie over plain http).
>
> To undo: set `COOKIE_SECURE=false` in `.env` and restart the portal.

---

## Part F: Google Drive (video upload and photo sync)

Needs the HTTPS domain, so do it after Part E.

1. **Google Cloud Console** (<https://console.cloud.google.com>) → your project → **APIs & Services**:
   - **Library**: *Google Drive API* is enabled.
   - **OAuth consent screen**: under *Authorized domains* add `kmutt.ac.th`. If Google asks to verify
     ownership of the domain, that is KMUTT IT's part.
   - **Credentials → Create credentials → OAuth client ID** (type *Web application*), or edit the
     existing one:
     - *Authorized JavaScript origins*: `https://tta2027.kmutt.ac.th`
     - *Authorized redirect URIs*: `https://tta2027.kmutt.ac.th/api/admin/google/callback`
   - Copy the **Client ID** and **Client secret**.
2. **Make an encryption key** for the stored Google token (64 hex characters), on the server:
   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```
3. **Add to `C:\tta-portal\server\.env`** (`notepad C:\tta-portal\server\.env`):
   ```
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   GOOGLE_REDIRECT_URI=https://tta2027.kmutt.ac.th/api/admin/google/callback
   TOKEN_KEY=<the 64 characters from step 2>
   ```
   Keep `TOKEN_KEY` unchanged afterwards: changing it makes the stored Google connection unreadable
   (you would have to connect Drive again).
4. **Restart the portal** (the block in Part E).
5. Log in as **admin** at https://tta2027.kmutt.ac.th/portal/admin and click **connect Google Drive**. Sign in
   with the Google account that owns the Drive folder and allow access. You return to the admin page
   with Drive shown as connected.

---

## Part G: What to confirm with KMUTT IT

Send them this (one message):

> The TTA 2027 portal is ready behind `tta2027.kmutt.ac.th`. Our server `10.2.15.250` answers on
> plain **http port 80** (nginx). Please confirm on the reverse proxy for this name:
> 1. it forwards to `http://10.2.15.250:80`;
> 2. it sends `X-Forwarded-For` (and `X-Forwarded-Proto: https`);
> 3. the upload limit (`client_max_body_size`) is at least **60 MB**;
> 4. the read timeout is at least **120 s**.

Point 2 makes the per-visitor login limit work. Point 3 matters for file uploads (nginx's default of
1 MB would reject them). You can check point 2 yourself after a few visits:

```powershell
Get-Content C:\nginx\logs\access.log -Tail 5
```

Each line shows `xff="<visitor IP>"`. If it is empty (`xff=""` or `xff="-"`) on every line, the
university proxy does not send it, and the portal sees every visitor as the proxy's address: the
login limit of 30 attempts a minute is then shared by everyone. With about 13 accounts that is
unlikely to bite, but ask IT to add the header.

---

## Everyday nginx commands

```powershell
cd C:\nginx
.\nginx.exe -t                       # check the config after editing conf\nginx.conf
.\nginx.exe -s reload                # apply it, no downtime
Get-Content logs\access.log -Tail 20 # recent requests
Get-Content logs\error.log -Tail 20  # errors (e.g. "connect() failed" = the portal is down)
Get-ScheduledTask TTA-Nginx | Select-Object TaskName, State
```

Change the config in the repo (`deploy/kmutt/nginx/nginx.conf`), push, then on the server `git pull`,
copy it to `C:\nginx\conf\nginx.conf`, `-t`, `-s reload`.

Stop nginx completely (e.g. to replace it):

```powershell
Stop-ScheduledTask TTA-Nginx
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object CommandLine -like '*run-nginx.cmd*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force
```

Start it again with `Start-ScheduledTask TTA-Nginx`.

| Symptom | Likely cause | Check / fix |
|---|---|---|
| `https://tta2027...` times out | nginx not running, or port 80 blocked | `Get-NetTCPConnection -LocalPort 80 -State Listen`; Task `TTA-Nginx`; firewall rule |
| `502 Bad Gateway` | nginx is fine, the portal is down | `Get-Content C:\tta-portal\logs\portal.log -Tail 40`; restart the portal |
| `413 Request Entity Too Large` | Upload larger than a proxy allows | Ours is 60 MB; otherwise the university proxy's limit (Part G) |
| Page is blank after Part E | `.env` typo, or opened over plain http | Use `https://tta2027.kmutt.ac.th`; check `.env` |
| Everyone gets "too many attempts" at login | Real visitor IP not seen | Part G point 2; `TRUST_PROXY` value |

---

## Part H: Landing Page at `/`, Login Portal at `/portal/`

```
https://tta2027.kmutt.ac.th/           ─▶ nginx ─▶ Landing Page files   C:\sites\tta-landing\site
https://tta2027.kmutt.ac.th/portal/    ─▶ nginx ─▶ Login Portal         127.0.0.1:3001
https://tta2027.kmutt.ac.th/api/...    ─▶ nginx ─▶ Login Portal API     (photo links, downloads, Google)
```

How it works:

- The portal's website is built for `/portal/` (`package-release.ps1` sets it), and `BASE_PATH=/portal`
  in its `.env` makes the server answer under that prefix. The installer adds the line if it is missing.
- The portal's API still also answers at `/api/...`: photo links saved in the database
  (`/api/files/...`), the export/download buttons and the Google callback use that path. So `/api` on
  this domain belongs to the portal; the Landing Page must not use it.
- The Landing Page's Login button opens `https://tta2027.kmutt.ac.th/portal/`.

Do the steps **in this order**; the site stays up except for about 20 seconds in H2. Every block goes
into PowerShell as Administrator on the server.

### H1. Prerequisites

- On GitHub: the Login Portal `main` with the `/portal` change, and the Landing Page `main` with its
  Login button pointing at `https://tta2027.kmutt.ac.th/portal/`.
- On the server: Node, Git and nginx (Parts C–D) are installed.

### H2. Update the Login Portal

```powershell
cd C:\temp\TTA-LoginPortal
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
cd .\deploy\kmutt\release\tta-portal
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-on-server.ps1
Select-String C:\tta-portal\server\.env -Pattern 'BASE_PATH'     # BASE_PATH=/portal
Get-Content C:\tta-portal\RELEASE.txt                             # shows "base /portal/"
```

The installer must print `Added BASE_PATH=/portal to .env` (the first time) and
`OK: portal is running`. Until H4, `https://tta2027.kmutt.ac.th/portal/` already works; the bare
`https://tta2027.kmutt.ac.th/` shows a blank page for a few minutes, which H4 fixes.

### H3. Build and copy the Landing Page

```powershell
if (Test-Path C:\temp\TTA-LandingPage) { cd C:\temp\TTA-LandingPage; git pull }
else { git clone https://github.com/Litt1eStar/TTA-LandingPage.git C:\temp\TTA-LandingPage; cd C:\temp\TTA-LandingPage }
git log -1 --oneline
npm.cmd ci
npm.cmd run build
Select-String .\dist\static\*.js -Pattern 'tta2027.kmutt.ac.th/portal/' -List | Select-Object -First 1   # the Login link is in the build
New-Item -ItemType Directory -Force C:\sites\tta-landing\site | Out-Null
robocopy .\dist C:\sites\tta-landing\site /MIR /NFL /NDL /NJH /NJS
"robocopy exit code: $LASTEXITCODE  (0-7 = OK)"
Test-Path C:\sites\tta-landing\site\index.html     # True
```

If the `Select-String` line prints nothing, the Landing Page on GitHub still has the old Login link:
push it from the laptop first (H1), then run H3 again.

### H4. Switch nginx

```powershell
Copy-Item C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.before-landing -Force    # for undo
Copy-Item C:\temp\TTA-LoginPortal\deploy\kmutt\nginx\nginx.conf C:\nginx\conf\nginx.conf -Force
cd C:\nginx
.\nginx.exe -t            # must say "syntax is ok" and "test is successful"
.\nginx.exe -s reload
```

If `-t` fails, do **not** reload; send me the message. nginx keeps serving the old config.

### H5. Check

On the server:

```powershell
curl.exe -s -o NUL -w "landing %{http_code}`n" http://localhost/
curl.exe -s -o NUL -w "portal  %{http_code}`n" http://localhost/portal/
curl.exe -s http://localhost/portal/api/health; ""
curl.exe -s http://localhost/api/health; ""
curl.exe -s -o NUL -w "redirect %{http_code} -> %{redirect_url}`n" http://localhost/portal
```

Expected: `landing 200`, `portal 200`, two `{"ok":true,...}`, and `redirect 301 -> .../portal/`.

Then on the laptop or a phone:

1. `https://tta2027.kmutt.ac.th/`: the Landing Page. Press Ctrl+F5 once (the browser may have the
   portal's page cached at that address).
2. Click **Login**: opens `https://tta2027.kmutt.ac.th/portal/` with the login page.
3. Log in as a coordinator, press F5 on the dashboard, open a submission page, log out.
4. Log in as an admin: `https://tta2027.kmutt.ac.th/portal/admin` loads; a member photo shows.

### Undo H4 (back to the portal at `/`)

```powershell
Copy-Item C:\nginx\conf\nginx.conf.before-landing C:\nginx\conf\nginx.conf -Force
cd C:\nginx; .\nginx.exe -t; .\nginx.exe -s reload
```

The portal then answers at `https://tta2027.kmutt.ac.th/portal/` only (its pages are built for
`/portal/`); to go fully back, also roll the portal back (`docs/MAINTENANCE_WORKFLOW.md`, §6).

---

## Updating the portal later

Nothing changes: `git pull` → `package-release.ps1` → `install-on-server.ps1` as in
`docs/MAINTENANCE_WORKFLOW.md`. The installer keeps `.env`, so the HTTPS settings stay. nginx does
not need to be touched; during the ~20 seconds the portal restarts, visitors see `502` on `/portal/`
and a refresh fixes it. Landing Page updates: `docs/MAINTENANCE_WORKFLOW.md` §4.2.
