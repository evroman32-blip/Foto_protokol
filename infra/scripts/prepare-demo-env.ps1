# Generates .env.demo for Timeweb from .env.demo.example
param(
  [Parameter(Mandatory = $true)]
  [string]$PublicHost
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$src = Join-Path $root ".env.demo.example"
$dst = Join-Path $root ".env.demo"

if (-not (Test-Path $src)) { throw "Missing .env.demo.example" }

function New-Secret([int]$Len = 48) {
  $bytes = New-Object byte[] $Len
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

$content = Get-Content $src -Raw
$content = $content.Replace("YOUR_DOMAIN", $PublicHost)
$content = $content -replace "JWT_SECRET=.*", ("JWT_SECRET=" + (New-Secret 40))
$content = $content -replace "SESSION_SECRET=.*", ("SESSION_SECRET=" + (New-Secret 40))
$content = $content -replace "POSTGRES_PASSWORD=.*", ("POSTGRES_PASSWORD=" + (New-Secret 24))
$content = $content -replace "S3_SECRET_ACCESS_KEY=.*", ("S3_SECRET_ACCESS_KEY=" + (New-Secret 24))
$content = $content -replace "DEMO_PASSWORD=.*", "DEMO_PASSWORD=DemoReview2026!"

Set-Content -Path $dst -Value $content -Encoding UTF8
Write-Host "Created $dst"
Write-Host "PUBLIC_HOST=$PublicHost"
Write-Host "DEMO_PASSWORD=DemoReview2026!"
Write-Host "Next: upload project to Timeweb and run bash infra/scripts/deploy-timeweb-demo.sh"
Write-Host "See docs/TIMEWEB_DEMO.md"
