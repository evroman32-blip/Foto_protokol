# Pack fix: drag&drop opens file in browser tab instead of uploading.
#   powershell -ExecutionPolicy Bypass -File infra\scripts\pack-timeweb-patch-file-drop.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "dist-patches\file-drop-$stamp"
$zipPath = Join-Path $root "dist-patches\mandarin-patch-file-drop-$stamp.zip"

$files = @(
  "apps\web\lib\prevent-file-navigation.ts",
  "apps\web\components\ImplantSliceCardsForm.tsx",
  "apps\web\app\(app)\cases\[id]\stages\[stageId]\upload\page.tsx"
)

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing file: $rel" }
  $dest = Join-Path $outDir $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dest -Force
  Write-Host "OK  $rel"
}

$zipName = Split-Path $zipPath -Leaf
$apply = @"
Mandarin PhotoProtocol — патч: файл открывается во вкладке вместо загрузки

Причина
  При перетаскивании JPG/видео на область страницы Chrome открывает file:// во вкладке,
  если нет preventDefault на dragover/drop. На карточках зубов drop не обрабатывался.

Исправление
  - глобальный guard на экране загрузки
  - drop на окно зуба → загрузка JPG среза
  - drop на карточку положения → выбор файлов к сохранению

Файлы:
$(($files | ForEach-Object { "  - $_" }) -join "`n")

=== Windows ===
scp `"$zipPath`" root@176.98.177.79:/root/

=== Сервер ===
cd /opt/mandarin-pp
unzip -o /root/$zipName -d /tmp/mandarin-patch-file-drop
cp -a /tmp/mandarin-patch-file-drop/apps/. ./apps/
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build web

Ctrl+F5 в браузере.
"@

Set-Content -Path (Join-Path $outDir "APPLY.txt") -Value $apply -Encoding UTF8
Push-Location $outDir
try { & tar -a -cf $zipPath * } finally { Pop-Location }

Write-Host ""
Write-Host "Zip: $zipPath"
Write-Host "scp `"$zipPath`" root@176.98.177.79:/root/"
