# Pack fix: slice cards upload use staged pre-upload + single save (like other requirements).
#   powershell -ExecutionPolicy Bypass -File infra\scripts\pack-timeweb-patch-slice-batch.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "dist-patches\slice-batch-$stamp"
$zipPath = Join-Path $root "dist-patches\mandarin-patch-slice-batch-$stamp.zip"

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
Mandarin PhotoProtocol — патч: срезы имплантатов сохраняются пакетом

Было
  Каждый JPG-срез отправлялся на сервер сразу при выборе файла:
  свой upload-batch на файл, ожидание после каждого окна зуба.

Стало
  - выбор/перетаскивание файла в окно зуба только ставит его в очередь (без сети);
  - окно зуба подсвечивается как «К сохранению», есть «Убрать из очереди»;
  - все срезы сохраняются одним upload-пакетом кнопкой «Сохранить выбранные (N)»
    внизу страницы — вместе с файлами обычных положений этапа;
  - счётчик кнопки включает срезы, показывается прогресс сохранения;
  - челюсть определяется номером зуба, поэтому очередь не ломается
    при переключении ВЧ/НЧ до сохранения.

Файлы:
$(($files | ForEach-Object { "  - $_" }) -join "`n")

=== Windows ===
scp `"$zipPath`" root@176.98.177.79:/root/

=== Сервер ===
cd /opt/mandarin-pp
unzip -o /root/$zipName -d /tmp/mandarin-patch-slice-batch
cp -a /tmp/mandarin-patch-slice-batch/apps/. ./apps/
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build web

Ctrl+F5 в браузере.

Проверка
  Случай -> этап «Постоперационный рентген-контроль» -> «Карточки срезов имплантатов»:
  выбрать JPG в 3-4 окна зубов (быстро, без ожидания), затем «Сохранить выбранные».
"@

Set-Content -Path (Join-Path $outDir "APPLY.txt") -Value $apply -Encoding UTF8
Push-Location $outDir
try { & tar -a -cf $zipPath * } finally { Pop-Location }

Write-Host ""
Write-Host "Zip: $zipPath"
Write-Host "scp `"$zipPath`" root@176.98.177.79:/root/"
