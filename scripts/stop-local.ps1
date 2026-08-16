# Останавливает локальные процессы PhotoProtocol (API, Web, Worker, MinIO, Redis, PostgreSQL).

$ErrorActionPreference = "Continue"

function Resolve-ToolsRoot {
  $here = Split-Path -Parent $PSScriptRoot
  $parent = Split-Path -Parent $here
  foreach ($c in @((Join-Path $here "tools"), (Join-Path $parent "tools"))) {
    if (Test-Path (Join-Path $c "pgsql\bin\pg_ctl.exe")) { return (Resolve-Path $c).Path }
  }
  return $null
}

Write-Host "=== Остановка локальной версии ===" -ForegroundColor Cyan

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -match "mandarin|@mandarin/(api|web|worker)|next dev|nest start|tsx watch src/main"
    )
  } |
  ForEach-Object {
    Write-Host "  stop pid $($_.ProcessId) $($_.Name)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    if ($_ -and $_ -ne 0) {
      Write-Host "  stop port pid $_"
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
  }

Get-Process minio, redis-server -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "  stop $($_.Name) $($_.Id)"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

$tools = Resolve-ToolsRoot
if ($tools) {
  $pgCtl = Join-Path $tools "pgsql\bin\pg_ctl.exe"
  $pgData = Join-Path $tools "pgdata"
  if ((Test-Path $pgCtl) -and (Test-Path $pgData)) {
    Write-Host "  stop PostgreSQL"
    & $pgCtl -D $pgData stop -m fast 2>$null | Out-Null
  }
}

Write-Host "Готово." -ForegroundColor Green
