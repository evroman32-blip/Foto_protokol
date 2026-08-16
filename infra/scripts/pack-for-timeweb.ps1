# Pack project for upload to Timeweb (run on Windows from repo root)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$out = Join-Path $root "mandarin-timeweb-demo.tgz"
Set-Location $root

if (Test-Path $out) { Remove-Item $out -Force }

$items = @(
  "apps",
  "packages",
  "infra",
  "docs",
  "docker-compose.demo.yml",
  "docker-compose.yml",
  "package.json",
  "package-lock.json",
  "turbo.json",
  "tsconfig.base.json",
  ".env.demo.example",
  ".dockerignore",
  ".gitignore",
  "README.md",
  "tools/sync-jaw-relation-requirements.ts"
)

foreach ($item in $items) {
  if (-not (Test-Path -LiteralPath $item)) {
    throw "Missing $item"
  }
}

Write-Host "Packing $root -> $out"
& tar -czf $out `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=dist `
  --exclude=.turbo `
  --exclude=*.log `
  --exclude=.env.local `
  --exclude=apps/web/.env.local `
  @items

if ($LASTEXITCODE -ne 0) { throw "tar failed: $LASTEXITCODE" }
$sizeMb = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host "Done: $out ($sizeMb MB)"
Write-Host "Upload code:  scp mandarin-timeweb-demo.tgz root@176.98.177.79:/root/"
if (Test-Path (Join-Path $root ".env.demo")) {
  Write-Host "Upload env:   scp .env.demo root@176.98.177.79:/root/env.demo"
}
Write-Host "Then follow docs/TIMEWEB_DEMO.md"
