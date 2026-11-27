# Run ON THE SERVER (PowerShell as Administrator) to update the Login Portal to the latest pushed code.
# One command instead of the steps in docs/MAINTENANCE_WORKFLOW.md section 4.1:
#   pull -> build the release (package-release.ps1) -> install it (install-on-server.ps1) -> health checks
#
# Usage (from the clone, normally C:\temp\TTA-LoginPortal):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\redeploy.ps1
#   ... -Commit 4b1c221     deploy that commit instead of the newest one on -Branch (e.g. to go back)
#   ... -Force              rebuild and reinstall even if that commit is already running
#   ... -DryRun             pull and build only; nothing on the running portal changes
#   ... -Rollback           put back the previous release (C:\tta-portal-previous); no pull, no build
#
# Safe to repeat. The install step backs up the database and uploads first, keeps the running release in
# C:\tta-portal-previous, and never touches server\.env, the database or uploads.
# A log of every run is written to C:\tta-portal\logs\redeploy-<date-time>.log.
param(
  [string]$Branch = 'main',
  [string]$Commit = '',
  [string]$InstallDir = 'C:\tta-portal',
  [int]$Port = 3001,
  [switch]$Force,
  [switch]$DryRun,
  [switch]$Rollback
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskName = 'TTA-Portal'
# Ensure this shell is not holding a lock inside deploy\kmutt\release\tta-portal from an earlier manual install
Set-Location $repo

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Check-Robocopy { if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" } }
function Running-Commit {
  if (Test-Path "$InstallDir\RELEASE.txt") {
    $line = Get-Content "$InstallDir\RELEASE.txt" | Where-Object { $_ -like 'commit *' } | Select-Object -First 1
    if ($line) { return $line.Substring(7).Trim() }
  }
  return ''
}
function Test-Health($url) {
  try { return [bool](Invoke-RestMethod $url -TimeoutSec 5).ok } catch { return $false }
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DryRun) { throw 'Run this in PowerShell opened as Administrator (Start > PowerShell > right-click > Run as administrator).' }

$logDir = if (Test-Path $InstallDir) { "$InstallDir\logs" } else { Join-Path $env:TEMP 'tta-redeploy-logs' }
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("redeploy-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Start-Transcript -Path $log | Out-Null
try {
  Write-Host "Running now: $(if (Running-Commit) { Running-Commit } else { 'nothing installed yet' })"

  if ($Rollback) {
    # docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md, "Rollback": code only, data stays
    $prev = "$InstallDir-previous"
    if (-not (Test-Path "$prev\RELEASE.txt")) { throw "No previous release in $prev to roll back to." }
    Step "Rolling back to: $((Get-Content "$prev\RELEASE.txt") -join ', ')"
    if ($DryRun) { Write-Host 'DryRun: stopping here.'; return }
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
      Where-Object { $_.CommandLine -like "*$InstallDir\server\run.cmd*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    robocopy $prev $InstallDir /E /XD "$prev\server\data" "$prev\server\backups" "$prev\logs" /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
    # A failed update leaves this marker; clear it so the next update saves a new previous release
    Remove-Item "$InstallDir\UPDATING" -Force -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName $taskName
  }
  else {
    # 1. Get the code
    Step "Updating the code ($(if ($Commit) { "commit $Commit" } else { "newest on $Branch" }))"
    Push-Location $repo
    try {
      if (git status --porcelain --untracked-files=no) {
        throw "There are local edits in $repo. The server copy should only ever be pulled: run 'git status', then 'git checkout -- .' to drop them, and re-run."
      }
      git fetch origin --tags --prune
      if ($LASTEXITCODE) { throw 'git fetch failed (is the server online?)' }
      if ($Commit) {
        git checkout --detach $Commit
        if ($LASTEXITCODE) { throw "git checkout $Commit failed" }
      } else {
        git checkout $Branch
        if ($LASTEXITCODE) { throw "git checkout $Branch failed" }
        git merge --ff-only "origin/$Branch"
        if ($LASTEXITCODE) { throw "git merge --ff-only origin/$Branch failed" }
      }
      $target = (git rev-parse --short HEAD).Trim()
      git log -1 --format='Deploying: %h %s (%cr)'
    } finally { Pop-Location }

    if (-not $Force -and (Running-Commit) -eq $target) {
      Write-Host "`nAlready running commit $target. Nothing to do (use -Force to reinstall it)." -ForegroundColor Green
      return
    }

    # 2. Build the release (a clean export of HEAD, so it never ships stray files)
    Step 'Building the release (a few minutes)'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'package-release.ps1') -NoZip
    if ($LASTEXITCODE) { throw 'package-release.ps1 failed; the running portal was not touched.' }
    $release = Join-Path $PSScriptRoot 'release\tta-portal'
    if ((Get-Content "$release\RELEASE.txt" | Select-Object -First 1) -ne "commit $target") {
      throw "The built release is not commit $target; the running portal was not touched."
    }
    if ($DryRun) { Write-Host "`nDryRun: release built in $release; the running portal was not touched." -ForegroundColor Green; return }

    # 3. Install (stops the portal ~20 s, backs up data, keeps the previous release, starts, checks /api/health)
    Step 'Installing'
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$release\install-on-server.ps1" -InstallDir $InstallDir -Port $Port
    if ($LASTEXITCODE) {
      throw "Install failed. Read $InstallDir\logs\portal.log. To put the previous version back: .\deploy\kmutt\redeploy.ps1 -Rollback"
    }
  }

  # 4. Health checks: the portal itself, then through nginx (port 80) as visitors reach it
  Step 'Checking'
  $ok = $false
  for ($i = 0; $i -lt 20 -and -not $ok; $i++) { Start-Sleep -Seconds 1; $ok = Test-Health "http://127.0.0.1:$Port/portal/api/health" }
  if (-not $ok) { throw "The portal does not answer on port $Port. Read $InstallDir\logs\portal.log" }
  Write-Host "Portal on port ${Port}: OK"
  if (Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue) {
    if (Test-Health 'http://127.0.0.1/portal/api/health') { Write-Host 'Through nginx (port 80): OK' }
    else { Write-Warning 'The portal is up but nginx (port 80) does not reach it. See NGINX_DOMAIN_SETUP.md.' }
  }
  Write-Host "`nDONE. Running: $((Get-Content "$InstallDir\RELEASE.txt") -join ', ')" -ForegroundColor Green
}
finally {
  Stop-Transcript | Out-Null
  Write-Host "Log: $log"
}
