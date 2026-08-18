# Mandarin PhotoProtocol — локальный запуск без Docker
# Поднимает PostgreSQL, Redis, MinIO, затем API / Worker / Web (dev).
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1

$ErrorActionPreference = "Stop"

function Resolve-CodeRoot {
  $here = Split-Path -Parent $PSScriptRoot
  if (-not $here) { $here = (Get-Location).Path }
  $here = (Resolve-Path $here).Path
  $parent = Split-Path -Parent $here
  if ((Test-Path (Join-Path $here "package.json")) -and (Test-Path (Join-Path $here "node_modules"))) {
    return $here
  }
  if ($parent -and (Test-Path (Join-Path $parent "package.json")) -and (Test-Path (Join-Path $parent "node_modules"))) {
    return (Resolve-Path $parent).Path
  }
  return $here
}

function Resolve-ToolsRoot([string]$CodeRoot) {
  $candidates = @(
    (Join-Path $CodeRoot "tools"),
    (Join-Path (Split-Path -Parent $CodeRoot) "tools")
  )
  foreach ($c in $candidates) {
    if ((Test-Path (Join-Path $c "pgsql\bin\pg_ctl.exe")) -and (Test-Path (Join-Path $c "minio.exe"))) {
      return (Resolve-Path $c).Path
    }
  }
  throw "Не найдены portable-инструменты (pgsql, minio). Ожидается папка tools рядом с проектом."
}

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
  }
}

function Test-PortOpen([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $c.Connected) { $c.EndConnect($iar); $c.Close(); return $true }
    $c.Close()
    return $false
  } catch { return $false }
}

function Wait-Port([int]$Port, [int]$TimeoutSec, [string]$Name) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (Test-PortOpen $Port) {
      Write-Host "  OK  $Name :$Port" -ForegroundColor Green
      return $true
    }
    Start-Sleep -Milliseconds 400
  }
  Write-Host "  FAIL $Name :$Port" -ForegroundColor Red
  return $false
}

function Start-LoggedProcess([string]$File, [string[]]$ArgList, [string]$WorkDir, [string]$LogName) {
  $out = Join-Path $LogsDir "$LogName.out.log"
  $err = Join-Path $LogsDir "$LogName.err.log"
  return Start-Process -FilePath $File -ArgumentList $ArgList -WorkingDirectory $WorkDir `
    -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
}

function Resolve-Node([string]$ToolsRoot, [string]$CodeRoot) {
  $candidates = @(
    (Join-Path $ToolsRoot "node\node.exe"),
    (Join-Path $CodeRoot "node\node.exe"),
    (Join-Path $env:LOCALAPPDATA "Temp\node-v22.17.0-win-x64\node.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return (Resolve-Path $c).Path }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$CodeRoot = Resolve-CodeRoot
$ToolsRoot = Resolve-ToolsRoot $CodeRoot
$LogsDir = Join-Path $ToolsRoot "logs"
$PgData = Join-Path $ToolsRoot "pgdata"
$PgBin = Join-Path $ToolsRoot "pgsql\bin"
$MinioExe = Join-Path $ToolsRoot "minio.exe"
$MinioData = Join-Path $ToolsRoot "minio-data"
$RedisExe = Join-Path $ToolsRoot "redis\redis-server.exe"
$RedisData = Join-Path $ToolsRoot "redis-data"
$EnvFile = Join-Path $CodeRoot ".env"

New-Item -ItemType Directory -Force -Path $LogsDir, $RedisData, $MinioData | Out-Null

Write-Host "=== Mandarin PhotoProtocol — локальная версия ===" -ForegroundColor Cyan
Write-Host "Код : $CodeRoot"
Write-Host "Tools: $ToolsRoot"
Write-Host ""

if (-not (Test-Path $EnvFile)) {
  $example = Join-Path $CodeRoot ".env.example"
  if (Test-Path $example) {
    Copy-Item $example $EnvFile
    Write-Host "Создан .env из .env.example"
  }
}
Import-DotEnv $EnvFile

$NodeExe = Resolve-Node $ToolsRoot $CodeRoot
if (-not $NodeExe) {
  throw "Node.js не найден. Положите portable Node в $ToolsRoot\node\node.exe"
}
$NodeDir = Split-Path $NodeExe
$NpmCmd = Join-Path $NodeDir "npm.cmd"
if ($env:Path -notlike "*$NodeDir*") {
  $env:Path = "$NodeDir;$PgBin;$env:Path"
}
Write-Host "Node: $NodeExe ($(& $NodeExe -v))"

# --- PostgreSQL ---
Write-Host "`n[1/6] PostgreSQL..." -ForegroundColor Yellow
$pgCtl = Join-Path $PgBin "pg_ctl.exe"
$pgIsReady = Join-Path $PgBin "pg_isready.exe"
$initDb = Join-Path $PgBin "initdb.exe"
$psql = Join-Path $PgBin "psql.exe"

if (-not (Test-Path (Join-Path $PgData "PG_VERSION"))) {
  Write-Host "  initdb → $PgData"
  & $initDb -D $PgData -U postgres -A trust -E UTF8 --no-locale | Out-Host
}

$pgRunning = $false
try {
  & $pgIsReady -h 127.0.0.1 -p 5432 | Out-Null
  if ($LASTEXITCODE -eq 0) { $pgRunning = $true }
} catch {}

if ($pgRunning) {
  Write-Host "  уже запущен :5432"
} else {
  & $pgCtl -D $PgData -l (Join-Path $LogsDir "postgres.log") start | Out-Host
  if (-not (Wait-Port 5432 45 "PostgreSQL")) {
    throw "PostgreSQL не стартовал. Лог: $LogsDir\postgres.log"
  }
}

$env:PGPASSWORD = "photoprotocol"
$roleName = & $psql -U postgres -h 127.0.0.1 -d postgres -tAc "SELECT rolname FROM pg_roles WHERE rolname = 'photoprotocol'"
if (-not $roleName) {
  & $psql -U postgres -h 127.0.0.1 -d postgres -c "CREATE ROLE photoprotocol LOGIN PASSWORD 'photoprotocol';" | Out-Host
}
$dbName = & $psql -U postgres -h 127.0.0.1 -d postgres -tAc "SELECT datname FROM pg_database WHERE datname = 'photoprotocol'"
if (-not $dbName) {
  & $psql -U postgres -h 127.0.0.1 -d postgres -c "CREATE DATABASE photoprotocol OWNER photoprotocol;" | Out-Host
}

# --- Redis ---
Write-Host "`n[2/6] Redis..." -ForegroundColor Yellow
if (Test-PortOpen 6379) {
  Write-Host "  уже запущен :6379"
} else {
  Start-LoggedProcess $RedisExe @("--dir", $RedisData, "--logfile", (Join-Path $LogsDir "redis.log"), "--appendonly", "no") (Split-Path $RedisExe) "redis" | Out-Null
  if (-not (Wait-Port 6379 20 "Redis")) {
    Write-Host "  Redis не ответил — очереди могут не работать" -ForegroundColor DarkYellow
  }
}

# --- MinIO ---
Write-Host "`n[3/6] MinIO..." -ForegroundColor Yellow
$env:MINIO_ROOT_USER = $(if ($env:S3_ACCESS_KEY) { $env:S3_ACCESS_KEY } else { "minioadmin" })
$env:MINIO_ROOT_PASSWORD = $(if ($env:S3_SECRET_ACCESS_KEY) { $env:S3_SECRET_ACCESS_KEY } else { "minioadmin" })
if (Test-PortOpen 9000) {
  Write-Host "  уже запущен :9000"
} else {
  Start-LoggedProcess $MinioExe @("server", $MinioData, "--address", ":9000", "--console-address", ":9001") (Split-Path $MinioExe) "minio" | Out-Null
  if (-not (Wait-Port 9000 30 "MinIO")) {
    throw "MinIO не стартовал. Лог: $LogsDir\minio.*.log"
  }
}

# --- deps + db ---
Write-Host "`n[4/6] Зависимости и БД..." -ForegroundColor Yellow
Set-Location $CodeRoot
if (-not (Test-Path (Join-Path $CodeRoot "node_modules\turbo"))) {
  Write-Host "  npm install..."
  & $NpmCmd install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install завершился с ошибкой" }
}

& $NpmCmd run db:generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate не удался" }

& $NpmCmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw "prisma migrate не удался" }

& $NpmCmd run db:seed
if ($LASTEXITCODE -ne 0) {
  Write-Host "  seed вернул ошибку (возможно, данные уже есть) — продолжаем" -ForegroundColor DarkYellow
}

$packagesToBuild = @(
  "@mandarin/contracts",
  "@mandarin/config",
  "@mandarin/domain",
  "@mandarin/database",
  "@mandarin/file-processing",
  "@mandarin/yandex-ai",
  "@mandarin/stoma1c",
  "@mandarin/ui"
)
foreach ($pkg in $packagesToBuild) {
  $pkgJson = Get-ChildItem -Path (Join-Path $CodeRoot "packages") -Filter "package.json" -Recurse -Depth 1 |
    Where-Object { (Get-Content $_.FullName -Raw) -match [regex]::Escape("`"$pkg`"") } |
    Select-Object -First 1
  if ($pkgJson) {
    $dist = Join-Path $pkgJson.DirectoryName "dist"
    if (-not (Test-Path (Join-Path $dist "index.js"))) {
      Write-Host "  build $pkg"
      & $NpmCmd run build -w $pkg
    }
  }
}

# --- API / Worker / Web ---
Write-Host "`n[5/6] API + Worker..." -ForegroundColor Yellow
$apiDist = Join-Path $CodeRoot "apps\api\dist\main.js"
if (-not (Test-Path $apiDist)) {
  Write-Host "  nest build..."
  & $NpmCmd run build -w @mandarin/api
  if ($LASTEXITCODE -ne 0) { throw "Сборка API не удалась" }
}

if (Test-PortOpen 3001) {
  Write-Host "  API уже запущен :3001"
} else {
  Start-LoggedProcess $NodeExe @($apiDist) (Join-Path $CodeRoot "apps\api") "api" | Out-Null
  if (-not (Wait-Port 3001 60 "API")) {
    throw "API не стартовал. Лог: $LogsDir\api.*.log"
  }
}

if (-not (Test-PortOpen 3001)) { throw "API не слушает :3001" }
Start-Process -FilePath $NpmCmd -ArgumentList @("run", "dev", "-w", "@mandarin/worker") `
  -WorkingDirectory $CodeRoot -WindowStyle Minimized | Out-Null

Write-Host "`n[6/6] Web..." -ForegroundColor Yellow
$env:NEXT_PUBLIC_API_URL = "http://localhost:3001"
$env:API_URL = "http://localhost:3001"
$env:CI = "1"
if (Test-PortOpen 3000) {
  Write-Host "  Web уже запущен :3000"
} else {
  # Нельзя RedirectStandard* у Next.js: PowerShell ломает вывод с ${...}
  $webCmd = "set PATH=$NodeDir;%PATH% && set NEXT_PUBLIC_API_URL=http://localhost:3001 && set API_URL=http://localhost:3001 && set CI=1 && cd /d `"$(Join-Path $CodeRoot 'apps\web')`" && npm run dev"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "start", "mandarin-web", "/MIN", "cmd.exe", "/k", $webCmd) | Out-Null
  if (-not (Wait-Port 3000 90 "Web")) {
    throw "Web не стартовал. Запустите вручную: npm run dev -w @mandarin/web"
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Локальная версия запущена" -ForegroundColor Cyan
Write-Host "   Web : http://localhost:3000"
Write-Host "   API : http://localhost:3001/api/v1"
Write-Host "   Swagger : http://localhost:3001/api/docs"
Write-Host "   MinIO : http://localhost:9001"
Write-Host " Логин : surgeon@example.local"
Write-Host " Пароль: ChangeMe123!"
Write-Host " Логи  : $LogsDir"
Write-Host " Остановка: .\scripts\stop-local.ps1"
Write-Host "========================================" -ForegroundColor Cyan
