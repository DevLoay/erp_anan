param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDirectory = "C:\ERPBackups"
)

$ErrorActionPreference = "Stop"
if (-not $DatabaseUrl) { throw "DATABASE_URL must be supplied through the environment or -DatabaseUrl." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump is not installed or not in PATH." }

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDirectory "mohamed-shawki-erp-$stamp.dump"

& pg_dump --dbname=$DatabaseUrl --format=custom --no-owner --no-privileges --file=$target
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash
[ordered]@{
  ok = $true
  file = $target
  bytes = (Get-Item -LiteralPath $target).Length
  sha256 = $hash
} | ConvertTo-Json
