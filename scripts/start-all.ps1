# Mandarin PhotoProtocol - portable start WITHOUT Docker
#
# Expected layout (any drive letter: D:, E:, ...):
#
#   <ROOT>\
#     mandarin-pp\                 <- this folder (start-all.ps1 lives here)
#       start-all.ps1
#       pgdata\                    <- PostgreSQL data
#       pgsql\                     <- PostgreSQL binaries
#       web-ascii\                 <- Next.js (ASCII path only!)
#       src\                       <- API monorepo
#       app\tools\
#         minio.exe
#         minio-data\              <- object storage
#         redis\redis-server.exe
#         redis-data\
#       logs\
#       node\                      <- optional portable Node (node.exe inside)
#     Foto_protokol\               <- sources (optional for runtime)
#
# Run from any drive:
#   powershell -ExecutionPolicy Bypass -File D:\FotoProtocol\mandarin-pp\start-all.ps1
#   powershell -ExecutionPolicy Bypass -File E:\FotoProtocol\mandarin-pp\start-all.ps1
#
# Paths are NOT edited by hand: everything is relative to $PSScriptRoot.

$ErrorActionPreference = "Stop"

# --- runtime root = folder containing this script ---
$Root = $PSScriptRoot
if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$Root = (Resolve-Path $Root).Path

$Drive = (Split-Path -Qualifier $Root)
Write-Host "=== Mandarin PhotoProtocol (portable) ===" -ForegroundColor Cyan
Write-Host "Root : $Root"
Write-Host "Drive: $Drive"
Write-Host ""

# --- paths relative to $Root ---
$PgData     = Join-Path $Root "pgdata"
$PgBin      = Join-Path $Root "pgsql\bin"
$WebDir     = Join-Path $Root "web-ascii"
$ApiDir     = Join-Path $Root "src"
$ApiEntry   = Join-Path $ApiDir "apps\api\dist\main.js"
$ToolsDir   = Join-Path $Root "app\tools"
$MinioExe   = Join-Path $ToolsDir "minio.exe"
$MinioData  = Join-Path $ToolsDir "minio-data"
$RedisExe   = Join-Path $ToolsDir "redis\redis-server.exe"
$RedisData  = Join-Path $ToolsDir "redis-data"
$RedisConf  = Join-Path $ToolsDir "redis\redis.windows.conf"
$LogsDir    = Join-Path $Root "logs"
$PortableNode = Join-Path $Root "node\node.exe"

# fallbacks (older layout)
if (-not (Test-Path $RedisExe)) {
  $alt = Join-Path $Root "runtime\redis\Redis-x64-3.0.504\redis-server.exe"
  if (Test-Path $alt) {
    $RedisExe  = $alt
    $RedisData = Join-Path $Root "runtime\redis-data"
    $RedisConf = Join-Path (Split-Path $alt) "redis.windows.conf"
  }
}
if (-not (Test-Path $MinioData)) {
  $alt = Join-Path $Root "tools\minio-data"
  if (Test-Path $alt) { $MinioData = $alt }
}
if (-not (Test-Path $MinioExe)) {
  $alt = Join-Path $Root "tools\minio.exe"
  if (Test-Path $alt) { $MinioExe = $alt }
}

# --- Node.js: .\node\ -> PATH -> Temp ---
function Resolve-Node {
  if (Test-Path $PortableNode) {
    return (Resolve-Path $PortableNode).Path
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $temp = Join-Path $env:LOCALAPPDATA "Temp\node-v22.17.0-win-x64\node.exe"
  if (Test-Path $temp) { return (Resolve-Path $temp).Path }
  return $null
}

$NodeExe = Resolve-Node
if (-not $NodeExe) {
  throw @"
Node.js not found.
Put portable Node here: $Root\node\node.exe
or install Node >= 20 and add it to PATH.
"@
}
$NodeDir = Split-Path $NodeExe
if ($env:Path -notlike "*$NodeDir*") {
  $env:Path = "$NodeDir;$env:Path"
}
Write-Host "Node : $NodeExe ($(& $NodeExe -v))"

# --- required paths ---
$required = @(
  @{ N = "PostgreSQL data"; P = $PgData },
  @{ N = "PostgreSQL bin";  P = (Join-Path $PgBin "pg_ctl.exe") },
  @{ N = "Web (web-ascii)"; P = $WebDir },
  @{ N = "API entry";       P = $ApiEntry },
  @{ N = "MinIO exe";       P = $MinioExe },
  @{ N = "MinIO data";      P = $MinioData },
  @{ N = "Redis exe";       P = $RedisExe }
)
$missing = @()
foreach ($r in $required) {
  if (-not (Test-Path $r.P)) { $missing += "  - $($r.N): $($r.P)" }
}
if ($missing.Count -gt 0) {
  Write-Host "Missing required paths:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  throw "Copy the full mandarin-pp folder to the drive and run again."
}

New-Item -ItemType Directory -Force -Path $LogsDir, $RedisData | Out-Null

# --- helpers ---
function Test-PortOpen([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $c.Connected) { $c.EndConnect($iar); $c.Close(); return $true }
    $c.Close(); return $false
  } catch { return $false }
}

function Start-LoggedProcess([string]$File, [string[]]$ArgList, [string]$WorkDir, [string]$LogName) {
  $out = Join-Path $LogsDir "$LogName.out.log"
  $err = Join-Path $LogsDir "$LogName.err.log"
  $p = Start-Process -FilePath $File -ArgumentList $ArgList -WorkingDirectory $WorkDir `
    -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
  return $p
}

function Wait-Port([int]$Port, [int]$TimeoutSec = 60, [string]$Name = "service") {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (Test-PortOpen $Port) {
      Write-Host "OK  $Name :$Port" -ForegroundColor Green
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  Write-Host "FAIL $Name :$Port (timeout ${TimeoutSec}s)" -ForegroundColor Red
  return $false
}

# --- 1. PostgreSQL ---
Write-Host "`n[1/5] PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
$pgCtl = Join-Path $PgBin "pg_ctl.exe"
$pgIsReady = Join-Path $PgBin "pg_isready.exe"

$pgRunning = $false
try {
  & $pgIsReady -h 127.0.0.1 -p 5432 | Out-Null
  if ($LASTEXITCODE -eq 0) { $pgRunning = $true }
} catch {}

if ($pgRunning) {
  Write-Host "  already running on :5432"
} else {
  # do not use runtime\pgdata - that was an empty seed DB
  & $pgCtl -D $PgData -l (Join-Path $LogsDir "postgres.log") start | Out-Null
  if (-not (Wait-Port 5432 45 "PostgreSQL")) {
    throw "PostgreSQL failed. Log: $LogsDir\postgres.log"
  }
}

# --- 2. Redis ---
Write-Host "`n[2/5] Redis..." -ForegroundColor Yellow
if (Test-PortOpen 6379) {
  Write-Host "  already running on :6379"
} else {
  $redisArgs = @("--dir", $RedisData, "--logfile", (Join-Path $LogsDir "redis.log"), "--appendonly", "no")
  if (Test-Path $RedisConf) {
    $redisArgs = @($RedisConf) + $redisArgs
  }
  Start-LoggedProcess $RedisExe $redisArgs (Split-Path $RedisExe) "redis" | Out-Null
  if (-not (Wait-Port 6379 20 "Redis")) {
    Write-Host "  warning: Redis did not respond - API may run without queues" -ForegroundColor DarkYellow
  }
}

# --- 3. MinIO ---
Write-Host "`n[3/5] MinIO..." -ForegroundColor Yellow
if (Test-PortOpen 9000) {
  Write-Host "  already running on :9000 (data: $MinioData)"
} else {
  $env:MINIO_ROOT_USER = "minio"
  $env:MINIO_ROOT_PASSWORD = "minio12345"
  Start-LoggedProcess $MinioExe @("server", $MinioData, "--address", ":9000", "--console-address", ":9001") `
    (Split-Path $MinioExe) "minio" | Out-Null
  if (-not (Wait-Port 9000 30 "MinIO")) {
    throw "MinIO failed. Log: $LogsDir\minio.*.log  data: $MinioData"
  }
}

# --- 4. API ---
Write-Host "`n[4/5] API..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/mandarin_pp?schema=public"
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:S3_ENDPOINT = "http://127.0.0.1:9000"
$env:S3_REGION = "us-east-1"
$env:S3_ACCESS_KEY = "minio"
$env:S3_SECRET_KEY = "minio12345"
$env:S3_BUCKET = "mandarin-media"
$env:S3_FORCE_PATH_STYLE = "true"
$env:JWT_SECRET = "dev-jwt-secret-change-me"
$env:PORT = "3001"
$env:NODE_ENV = "production"

if (Test-PortOpen 3001) {
  Write-Host "  already running on :3001"
} else {
  Start-LoggedProcess $NodeExe @($ApiEntry) $ApiDir "api" | Out-Null
  if (-not (Wait-Port 3001 45 "API")) {
    throw "API failed. Log: $LogsDir\api.*.log"
  }
}

# --- 5. Web ---
Write-Host "`n[5/5] Web (Next.js)..." -ForegroundColor Yellow
$env:NEXT_PUBLIC_API_URL = "http://localhost:3001"
$env:PORT = "3000"

if (Test-PortOpen 3000) {
  Write-Host "  already running on :3000"
} else {
  $nextCli = Join-Path $WebDir "node_modules\next\dist\bin\next"
  if (-not (Test-Path $nextCli)) {
    throw "Next.js not found in $WebDir (need npm install / .next build)"
  }
  Start-LoggedProcess $NodeExe @($nextCli, "start", "-p", "3000", "-H", "0.0.0.0") $WebDir "web" | Out-Null
  if (-not (Wait-Port 3000 60 "Web")) {
    throw "Web failed. Log: $LogsDir\web.*.log"
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Ready. Open in browser:" -ForegroundColor Cyan
Write-Host "   Web : http://localhost:3000"
Write-Host "   API : http://localhost:3001/api/docs"
Write-Host " Login: surgeon@example.local / ChangeMe123!"
Write-Host " Logs : $LogsDir"
Write-Host " Data : $PgData"
Write-Host " Files: $MinioData"
Write-Host "========================================" -ForegroundColor Cyan
