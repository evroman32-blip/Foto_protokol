# Pack project for upload to Timeweb (run on Windows from repo root)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$out = Join-Path $root "mandarin-timeweb-demo.tgz"
Set-Location $root

if (Test-Path $out) { Remove-Item $out -Force }

# Prefer tar (Windows 10+)
$excludes = @(
  "--exclude=node_modules",
  "--exclude=.next",
  "--exclude=dist",
  "--exclude=.git",
  "--exclude=.turbo",
  "--exclude=tools/pgsql",
  "--exclude=tools/minio-data",
  "--exclude=tools/redis",
  "--exclude=tools/redis-data",
  "--exclude=tools/*.exe",
  "--exclude=tools/*.zip",
  "--exclude=.env",
  "--exclude=.env.demo",
  "--exclude=mandarin-timeweb-demo.tgz",
  "--exclude=*.log"
)

Write-Host "Packing $root -> $out"
& tar -czf $out @excludes .
Write-Host "Done: $out"
Write-Host "Upload: scp mandarin-timeweb-demo.tgz root@SERVER_IP:/root/"
Write-Host "Then follow docs/TIMEWEB_DEMO.md"
