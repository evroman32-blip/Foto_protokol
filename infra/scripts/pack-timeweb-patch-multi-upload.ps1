# Pack ONLY the multi-file upload fix for Timeweb demo.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File infra\scripts\pack-timeweb-patch-multi-upload.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "dist-patches\multi-upload-$stamp"
$zipPath = Join-Path $root "dist-patches\mandarin-patch-multi-upload-$stamp.zip"

$files = @(
  "apps\web\app\(app)\cases\[id]\stages\[stageId]\upload\page.tsx"
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

$apply = @"
Mandarin PhotoProtocol — патч: несколько файлов на положение (minCount)

Проблема
  При мин. кол-ве > 1 (например 3 видео) каждый новый файл архивировал предыдущие.
  В просмотрщике открывался весь этап, из-за чего казалось, что файл один.

Исправление
  - minCount <= 1: как раньше, новый файл заменяет старый
  - minCount > 1: файлы добавляются; можно выбрать несколько сразу
  - просмотр — только файлы выбранного положения (стрелки листают 1/3, 2/3, 3/3)

Файлы в архиве (пути относительно /opt/mandarin-pp):
$(($files | ForEach-Object { "  - $_" }) -join "`n")

=== На Windows: залить на сервер ===

1) Распакуйте zip локально или заливайте zip целиком:

   scp "$zipPath" root@176.98.177.79:/root/

2) На сервере:

   cd /opt/mandarin-pp
   mkdir -p /tmp/mandarin-patch
   unzip -o /root/$(Split-Path $zipPath -Leaf) -d /tmp/mandarin-patch
   # структура внутри zip: apps/web/...
   cp -a /tmp/mandarin-patch/apps/. ./apps/

   docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build web

3) В браузере: Ctrl+F5

Проверка
  Положение с мин. кол-во = 3 → загрузить 3 видео → счётчик 3/3 →
  «Файлов по положению: 3» → открыть просмотр → 1/3, 2/3, 3/3.
"@

Set-Content -Path (Join-Path $outDir "APPLY.txt") -Value $apply -Encoding UTF8

# Zip via tar (Windows 10+)
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
Write-Host "Instructions: $outDir\APPLY.txt"
Write-Host ""
Write-Host "Upload example:"
Write-Host "  scp `"$zipPath`" root@176.98.177.79:/root/"
