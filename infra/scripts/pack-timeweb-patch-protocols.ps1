# Pack protocol directory (create/edit) patch for Timeweb demo.
#   powershell -ExecutionPolicy Bypass -File infra\scripts\pack-timeweb-patch-protocols.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "dist-patches\protocols-$stamp"
$zipPath = Join-Path $root "dist-patches\mandarin-patch-protocols-$stamp.zip"

$files = @(
  "apps\api\src\modules\admin\admin.module.ts",
  "apps\web\lib\api.ts",
  "apps\web\app\(app)\admin\protocols\page.tsx"
)

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Missing file: $rel"
  }
  $dest = Join-Path $outDir $rel
  $destParent = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $destParent | Out-Null
  Copy-Item -LiteralPath $src -Destination $dest -Force
  Write-Host "OK  $rel"
}

$zipName = Split-Path $zipPath -Leaf
$apply = @"
Mandarin PhotoProtocol — патч: справочник протоколов (создание / редактирование)

Что появилось
  - форма «Новый протокол» (название, код, версия, описание, опубликовать сразу)
  - редактирование протокола в таблице (название, код, описание, активность)
  - смена статуса версии: DRAFT / PUBLISHED / ARCHIVED
  - ссылка «Настроить шаблоны» как раньше (этапы и положения)

Файлы (пути относительно /opt/mandarin-pp):
$(($files | ForEach-Object { "  - $_" }) -join "`n")

=== Windows → сервер ===

scp `"$zipPath`" root@176.98.177.79:/root/

=== На сервере ===

cd /opt/mandarin-pp
unzip -o /root/$zipName -d /tmp/mandarin-patch-protocols
cp -a /tmp/mandarin-patch-protocols/apps/. ./apps/

docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build api web

Затем в браузере Ctrl+F5 → Администрирование → Протоколы.
"@

Set-Content -Path (Join-Path $outDir "APPLY.txt") -Value $apply -Encoding UTF8

$zipDir = Split-Path $zipPath -Parent
New-Item -ItemType Directory -Force -Path $zipDir | Out-Null
Push-Location $outDir
try {
  & tar -a -cf $zipPath *
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Patch folder: $outDir"
Write-Host "Zip:          $zipPath"
Write-Host "Instructions: $(Join-Path $outDir 'APPLY.txt')"
Write-Host ""
Write-Host "Upload:"
Write-Host "  scp `"$zipPath`" root@176.98.177.79:/root/"
