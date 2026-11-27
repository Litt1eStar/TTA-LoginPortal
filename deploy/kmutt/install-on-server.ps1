# Run ON THE SERVER (PowerShell as Administrator) from the extracted tta-portal folder.
# First install:  .\install-on-server.ps1 -AccountsFile C:\temp\TTA-portal-accounts.md
# Update later:   .\install-on-server.ps1            (keeps .env, database and uploads)
#requires -RunAsAdministrator
param(
  [string]$InstallDir = 'C:\tta-portal',
  [string]$AccountsFile = '',
  [int]$Port = 3001,
  [string]$AppOrigin = 'http://10.2.15.250:3001'
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$taskName = 'TTA-Portal'
$backupTask = 'TTA-Portal-Backup'

function Check-Robocopy { if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" } }

# 1. Node.js >= 22.13
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nodeCmd) { throw 'Node.js not found. Install the Node.js LTS (22 or newer) MSI from https://nodejs.org, then open a NEW PowerShell window and re-run.' }
$ver = [version]((& node --version).TrimStart('v'))
if ($ver -lt [version]'22.13.0') { throw "Node $ver is too old. Need 22.13 or newer." }
$nodeExe = $nodeCmd.Source
Write-Host "Node $ver at $nodeExe"

# 2. Stop the running portal (if this is an update)
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
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is still in use after stopping the portal; stop that process and re-run" }

# Update: snapshot the database and uploads before touching any file
if (Test-Path "$InstallDir\server\data\portal.db") {
  Push-Location "$InstallDir\server"
  try {
    & $nodeExe scripts\backup.js
    if ($LASTEXITCODE) {
      Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
      throw 'pre-update backup failed; nothing was changed and the portal was restarted'
    }
    Write-Host 'Pre-update backup written to server\backups'
  } finally { Pop-Location }
}

if ((Test-Path "$InstallDir\RELEASE.txt") -and -not (Test-Path "$InstallDir\UPDATING")) {
  $prev = "$InstallDir-previous"
  if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
  New-Item -ItemType Directory -Force $prev | Out-Null
  robocopy "$InstallDir" $prev /E /XD "$InstallDir\server\data" "$InstallDir\server\backups" "$InstallDir\logs" /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
}
# Marker: an update is in progress. If it fails and is re-run, the good previous release above is not overwritten.
New-Item -ItemType Directory -Force $InstallDir | Out-Null
New-Item -ItemType File -Force "$InstallDir\UPDATING" | Out-Null

# 3. Copy files (never touches .env, data\, backups\)
New-Item -ItemType Directory -Force $InstallDir, "$InstallDir\logs" | Out-Null
robocopy "$src\dist" "$InstallDir\dist" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$src\server" "$InstallDir\server" /E /XD data backups node_modules /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$src\src" "$InstallDir\src" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
Copy-Item "$src\package.json" "$InstallDir\package.json" -Force
Copy-Item "$src\RELEASE.txt" "$InstallDir\RELEASE.txt" -Force

# 4. Dependencies (bundled production node_modules from the release; no internet needed)
robocopy "$src\server\node_modules" "$InstallDir\server\node_modules" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
Push-Location "$InstallDir\server"
try {

  # 5. .env (created once; edit it by hand afterwards)
  $envFile = "$InstallDir\server\.env"
  if (-not (Test-Path $envFile)) {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    @(
      'NODE_ENV=production',
      "PORT=$Port",
      'HOST=0.0.0.0',
      'SERVE_STATIC=true',
      'STATIC_DIR=../dist',
      "SESSION_SECRET=$secret",
      '# Must stay false while the site is served over plain http, otherwise login cookies are dropped.',
      'COOKIE_SECURE=false',
      'DEADLINE=2026-12-30T23:59:00+07:00',
      "APP_ORIGIN=$AppOrigin",
      'DB_PATH=data/portal.db',
      'UPLOAD_DIR=data/uploads',
      'BACKUP_DIR=backups',
      '# The website is built for /portal/ (package-release.ps1); the Landing Page owns /.',
      'BASE_PATH=/portal'
    ) | Set-Content -Path $envFile -Encoding ASCII
    Write-Host "Created $envFile"
  } else {
    Write-Host '.env already exists, kept as is'
    # Releases are built for /portal/: an older .env without BASE_PATH would serve a blank page.
    if (-not (Select-String -Path $envFile -Pattern '^\s*BASE_PATH\s*=' -Quiet)) {
      Add-Content -Path $envFile -Value @('', '# Added by install-on-server.ps1: the website is built for /portal/', 'BASE_PATH=/portal') -Encoding ASCII
      Write-Host 'Added BASE_PATH=/portal to .env'
    }
    # The deadline moved from 15 to 30 Dec 2026. Only the old default is replaced: a deadline set by hand is kept.
    $oldDeadline = 'DEADLINE=2026-12-15T23:59:00+07:00'
    $lines = Get-Content -Path $envFile
    if ($lines -contains $oldDeadline) {
      $lines | ForEach-Object { if ($_ -eq $oldDeadline) { 'DEADLINE=2026-12-30T23:59:00+07:00' } else { $_ } } | Set-Content -Path $envFile -Encoding ASCII
      Write-Host 'Moved DEADLINE in .env from 15 Dec to 30 Dec 2026'
    }
  }

  # 6. Accounts (bcrypt hashes only; the note itself is not copied anywhere)
  if ($AccountsFile) {
    npm.cmd run seed -- "$AccountsFile"
    if ($LASTEXITCODE) { throw 'seed failed' }
  }
}
finally { Pop-Location }

# 7. Start at boot, restart if it crashes
@(
  '@echo off',
  'cd /d "%~dp0"',
  ':loop',
  "`"$nodeExe`" src\index.js >> ..\logs\portal.log 2>&1",
  'echo %date% %time% portal exited with %errorlevel%, restarting in 5 s >> ..\logs\portal.log',
  'ping -n 6 127.0.0.1 > nul',
  'goto loop'
) | Set-Content -Path "$InstallDir\server\run.cmd" -Encoding ASCII
@(
  '@echo off',
  'cd /d "%~dp0"',
  "`"$nodeExe`" scripts\backup.js >> ..\logs\backup.log 2>&1"
) | Set-Content -Path "$InstallDir\server\run-backup.cmd" -Encoding ASCII

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -Priority 4
Register-ScheduledTask -TaskName $taskName -Force -Principal $principal -Settings $settings `
  -Action (New-ScheduledTaskAction -Execute "$InstallDir\server\run.cmd" -WorkingDirectory "$InstallDir\server") `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) | Out-Null
Register-ScheduledTask -TaskName $backupTask -Force -Principal $principal `
  -Action (New-ScheduledTaskAction -Execute "$InstallDir\server\run-backup.cmd" -WorkingDirectory "$InstallDir\server") `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 3am) | Out-Null

# 8. Firewall for the web port
if (-not (Get-NetFirewallRule -DisplayName 'TTA Portal' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'TTA Portal' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
}

# 9. Start and check
Start-ScheduledTask -TaskName $taskName
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
  Start-Sleep -Seconds 1
  try { $ok = (Invoke-RestMethod "http://127.0.0.1:$Port/portal/api/health").ok } catch { }
}
if ($ok) {
  Remove-Item "$InstallDir\UPDATING" -Force -ErrorAction SilentlyContinue
  Write-Host "OK: portal is running ($((Get-Content "$InstallDir\RELEASE.txt") -join ', ')). Open $AppOrigin/portal/"
} else {
  Write-Host "NOT healthy. Read $InstallDir\logs\portal.log" -ForegroundColor Red
  exit 1
}
