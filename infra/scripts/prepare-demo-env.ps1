# Generates .env.demo for Timeweb from .env.demo.example
param(
  [Parameter(Mandatory = $true)]
  [string]$PublicHost,
  [string]$BootstrapEmail = "",
  [string]$BootstrapPassword = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$src = Join-Path $root ".env.demo.example"
$dst = Join-Path $root ".env.demo"

if (-not (Test-Path $src)) { throw "Missing .env.demo.example" }

function New-UrlSafeSecret([int]$Len = 40) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray()
  $bytes = New-Object byte[] $Len
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $sb = New-Object System.Text.StringBuilder
  foreach ($b in $bytes) {
    [void]$sb.Append($chars[$b % $chars.Length])
  }
  return $sb.ToString()
}

if (-not $BootstrapPassword) { $BootstrapPassword = New-UrlSafeSecret 20 }

$content = Get-Content $src -Raw
$content = $content.Replace("YOUR_DOMAIN", $PublicHost)
$content = $content -replace "JWT_SECRET=.*", ("JWT_SECRET=" + (New-UrlSafeSecret 48))
$content = $content -replace "SESSION_SECRET=.*", ("SESSION_SECRET=" + (New-UrlSafeSecret 48))
$content = $content -replace "POSTGRES_PASSWORD=.*", ("POSTGRES_PASSWORD=" + (New-UrlSafeSecret 28))
$content = $content -replace "S3_ACCESS_KEY=.*", ("S3_ACCESS_KEY=" + (New-UrlSafeSecret 16))
$content = $content -replace "S3_SECRET_ACCESS_KEY=.*", ("S3_SECRET_ACCESS_KEY=" + (New-UrlSafeSecret 28))
if ($BootstrapEmail) {
  $content = $content -replace "BOOTSTRAP_ADMIN_EMAIL=.*", ("BOOTSTRAP_ADMIN_EMAIL=" + $BootstrapEmail)
}
$content = $content -replace "BOOTSTRAP_ADMIN_PASSWORD=.*", ("BOOTSTRAP_ADMIN_PASSWORD=" + $BootstrapPassword)

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($dst, $content.TrimEnd() + "`n", $utf8)
Write-Host "Created $dst"
Write-Host "PUBLIC_HOST=$PublicHost"
if ($BootstrapEmail) {
  Write-Host "BOOTSTRAP_ADMIN_EMAIL=$BootstrapEmail"
  Write-Host "BOOTSTRAP_ADMIN_PASSWORD=$BootstrapPassword"
}
Write-Host "Next: pack with infra/scripts/pack-for-timeweb.ps1 and follow docs/TIMEWEB_DEMO.md"
