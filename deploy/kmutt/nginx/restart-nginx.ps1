# Run ON THE SERVER (PowerShell as Administrator) after changing C:\nginx\conf\nginx.conf.
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\temp\TTA-LoginPortal\deploy\kmutt\nginx\restart-nginx.ps1
# Why not "nginx -s reload": nginx runs as SYSTEM (Task TTA-Nginx), and Windows refuses the reload
# signal from an Administrator session ("OpenEvent(...) failed (5: Access is denied)").
# This checks the config first, then restarts the task: about 5 seconds of downtime.
#requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$nginxDir = 'C:\nginx'

Push-Location $nginxDir
try {
  & .\nginx.exe -t
  if ($LASTEXITCODE) { throw 'nginx config test failed: nothing was restarted, the old config keeps running' }
} finally { Pop-Location }

Stop-ScheduledTask -TaskName 'TTA-Nginx' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like '*run-nginx.cmd*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'TTA-Nginx'

$ok = $false
for ($i = 0; $i -lt 10 -and -not $ok; $i++) {
  Start-Sleep -Seconds 1
  $ok = [bool](Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue)
}
if ($ok) { Write-Host 'OK: nginx restarted and listening on port 80' }
else { Write-Host "nginx is NOT listening on port 80. Read $nginxDir\logs\error.log" -ForegroundColor Red; exit 1 }
