# Run on the LAPTOP. Builds the last COMMIT of this repo into deploy\kmutt\release\tta-portal.zip.
# Works in a temp copy: never touches the project's node_modules or the tracked dist\, so dev servers keep running.
# Usage (repo root):  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\kmutt\package-release.ps1
# Output: deploy\kmutt\release\tta-portal\  and  deploy\kmutt\release\tta-portal.zip  (no passwords, database or .env)
# The release includes the production server\node_modules (npm ci --omit=dev), so the server needs no internet.
param(
  [switch]$NoZip
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$releaseDir = Join-Path $PSScriptRoot 'release'
$out = Join-Path $releaseDir 'tta-portal'
$work = Join-Path $env:TEMP 'tta-portal-build'
$tarball = "$work.tar"

function Check-Robocopy { if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" } }
function Remove-Tree($path) {
  # PowerShell 5.1 Remove-Item -Recurse often fails on node_modules with "being used by another process"
  # while Windows Defender / directory handles close asynchronously.
  for ($i = 0; $i -lt 5 -and (Test-Path $path); $i++) {
    if ($i -gt 0) { Start-Sleep -Milliseconds 500 }
    cmd.exe /c "rmdir /s /q `"$path`"" 2>$null | Out-Null
    if (Test-Path $path) { Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# Move out of $out / $work if the caller ran this script from inside one of them
Set-Location $repo

# 0. What ships is HEAD, never uncommitted edits
$sha = (git -C $repo rev-parse --short HEAD).Trim()
if ($LASTEXITCODE) { throw 'git rev-parse failed' }
$tag = (git -C $repo tag --points-at HEAD) -join ','   # describe+2>$null throws under Stop in PS 5.1
if (git -C $repo status --porcelain --untracked-files=no) {
  Write-Warning 'Uncommitted changes are NOT in this release. Commit them first if they should ship.'
}

# 1. Clean export of HEAD
Remove-Tree $work
if (Test-Path $work) { throw "Could not clean temp build folder $work" }
New-Item -ItemType Directory -Force $work | Out-Null
git -C $repo archive --format=tar -o $tarball HEAD
if ($LASTEXITCODE) { throw 'git archive failed' }
tar -xf $tarball -C $work
if ($LASTEXITCODE) { throw 'tar -x failed' }
Remove-Item $tarball -Force

# 2. Build the frontend there
Push-Location $work
try {
  npm.cmd ci
  if ($LASTEXITCODE) { throw 'npm ci failed' }
  # KMUTT serves the portal at https://tta2027.kmutt.ac.th/portal/ (the Landing Page owns '/').
  # The server side matches it with BASE_PATH=/portal in server\.env (install-on-server.ps1 adds it).
  $env:PORTAL_BASE = '/portal/'
  npm.cmd run build
  if ($LASTEXITCODE) { throw 'npm run build failed' }
}
finally { Pop-Location; Remove-Item Env:PORTAL_BASE -ErrorAction SilentlyContinue }

# Production server dependencies (pure JS, portable to the Windows x64 server): shipped so the server needs no npm registry
Push-Location "$work\server"
try { npm.cmd ci --omit=dev; if ($LASTEXITCODE) { throw 'server npm ci failed' } } finally { Pop-Location }

# 3. Assemble the release
# Mirror into $out without deleting the $out folder itself, so an Explorer or PowerShell window open in
# deploy\kmutt\release\tta-portal (or a slow Defender handle on it) cannot block the build.
New-Item -ItemType Directory -Force $out, "$out\src" | Out-Null
Get-ChildItem -Path $out -Force |
  Where-Object { $_.Name -notin @('dist', 'server', 'src', 'package.json', 'install-on-server.ps1', 'RELEASE.txt') } |
  ForEach-Object { Remove-Tree $_.FullName }
Get-ChildItem -Path "$out\src" -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notin @('data', 'utils') } |
  ForEach-Object { Remove-Tree $_.FullName }
robocopy "$work\dist" "$out\dist" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$work\server" "$out\server" /MIR /XD "$work\server\data" "$work\server\backups" "$work\server\test" /XF .env /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
# The server imports these shared files via ../../src/...
robocopy "$work\src\data" "$out\src\data" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
robocopy "$work\src\utils" "$out\src\utils" /MIR /NFL /NDL /NJH /NJS | Out-Null; Check-Robocopy
Copy-Item "$work\package.json" "$out\package.json" -Force   # only so ../../src/*.js are treated as ES modules
Copy-Item "$work\deploy\kmutt\install-on-server.ps1" "$out\install-on-server.ps1" -Force
"commit $sha`ntag $tag`nbase /portal/`nbuilt $(Get-Date -Format s)" | Set-Content "$out\RELEASE.txt" -Encoding ASCII
Remove-Tree $work

if ($NoZip) {
  "Done: $out  (commit $sha $tag)"
} else {
  $zip = Join-Path $releaseDir 'tta-portal.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path "$out\*" -DestinationPath $zip
  "Done: $zip  (commit $sha $tag, {0:N1} MB)" -f ((Get-Item $zip).Length / 1MB)
}
