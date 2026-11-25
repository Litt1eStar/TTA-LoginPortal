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
$tag = (git -C $repo tag --points-at HEAD) -join ','   # describe+2>$null throws under Stop in PS 5.1
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
