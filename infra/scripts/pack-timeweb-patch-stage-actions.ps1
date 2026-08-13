# Pack: stage page without tabs (upload + close only) and read-only media after stage close.
# Includes the previous slice-batch patch (same files).
#   powershell -ExecutionPolicy Bypass -File infra\scripts\pack-timeweb-patch-stage-actions.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "dist-patches\stage-actions-$stamp"
$zipPath = Join-Path $root "dist-patches\mandarin-patch-stage-actions-$stamp.zip"

$files = @(
  "apps\api\src\common\services\stage-media-access.service.ts",
  "apps\api\src\modules\upload\upload.module.ts",
  "apps\api\src\modules\media\media.module.ts",
  "apps\api\src\modules\implants\implants.module.ts",
  "apps\api\src\modules\radiology\radiology.module.ts",
  "apps\web\lib\use-current-user.ts",
  "apps\web\lib\prevent-file-navigation.ts",
  "apps\web\components\ImplantSliceCardsForm.tsx",
  "apps\web\app\(app)\cases\[id]\stages\[stageId]\page.tsx",
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
Mandarin PhotoProtocol — патч: страница этапа и блокировка правок после закрытия

Страница этапа
  - убрана строка вкладок (Фото / Видео / Документы / 3D-скан / Рентгенология /
    Чек-лист / История) — вкладки остались на экране загрузки материалов;
  - в блоке «Действия» осталось две кнопки: «Загрузить материалы» и «Закрыть этап»;
  - убраны «Проверка и назначение», «Отчёт этапа» и отдельная кнопка подтверждения:
    подтверждение врача (для хирургического этапа — подтверждение хирурга)
    выполняется автоматически внутри закрытия этапа.

После закрытия этапа
  - врачи не могут менять состав загруженных файлов: загрузка, замена, удаление,
    очистка дубликатов и срезы имплантатов недоступны;
  - изменения разрешены только ролям SYSTEM_ADMIN (администратор) и CHIEF_DOCTOR
    (главный врач); проверка выполняется на сервере (403), а не только в интерфейсе;
  - правка закрытого этапа главным врачом не сбрасывает статус CLOSED.

Также включён предыдущий патч: срезы имплантатов сохраняются пакетом
(предзагрузка в окна зубов -> одна кнопка «Сохранить выбранные»).

Файлы:
$(($files | ForEach-Object { "  - $_" }) -join "`n")

=== Windows ===
scp `"$zipPath`" root@176.98.177.79:/root/

=== Сервер ===
cd /opt/mandarin-pp
unzip -o /root/$zipName -d /tmp/mandarin-patch-stage-actions
cp -a /tmp/mandarin-patch-stage-actions/apps/. ./apps/
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build api web

Ctrl+F5 в браузере. Пересобираются ДВА сервиса: api и web.

Проверка
  1. Случай -> этап: над блоками нет вкладок, в «Действиях» только
     «Загрузить материалы» и «Закрыть этап».
  2. Закрыть этап обычным врачом -> кнопки загрузки и удаления пропадают,
     на экране загрузки появляется предупреждение о закрытом этапе.
  3. Войти главным врачом/админом -> правки доступны, этап остаётся закрытым.
"@

Set-Content -Path (Join-Path $outDir "APPLY.txt") -Value $apply -Encoding UTF8
Push-Location $outDir
try { & tar -a -cf $zipPath * } finally { Pop-Location }

Write-Host ""
Write-Host "Zip: $zipPath"
Write-Host "scp `"$zipPath`" root@176.98.177.79:/root/"
