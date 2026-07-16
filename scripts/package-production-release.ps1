param(
  [string]$OutputDirectory = "",
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"
$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceRoot = Resolve-Path (Join-Path $appRoot "..\..")
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $workspaceRoot "delivery" }
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

if (-not $SkipChecks) {
  Push-Location $appRoot
  try {
    node scripts\audit-production-readiness.js
    if ($LASTEXITCODE -ne 0) { throw "Production readiness audit failed." }
    node scripts\check-auth-permissions.js
    if ($LASTEXITCODE -ne 0) { throw "Auth audit failed." }
    node scripts\check-mojibake.js
    if ($LASTEXITCODE -ne 0) { throw "Mojibake audit failed." }
  } finally {
    Pop-Location
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$releaseName = "MOHAMED-SHAWKI-ERP-PRODUCTION-$stamp"
$staging = Join-Path $outputRoot $releaseName
$zip = Join-Path $outputRoot "$releaseName.zip"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$excludedDirectories = @(
  ".git", ".next", "node_modules", "backups", "backup-before-hs-payroll-ui-20260626-005829",
  "Erp_system", ".codex-logs", "delivery"
)
$excludedFiles = @(".env", ".env.local", ".env.production", ".env.development")
$excludedExtensions = @(".log", ".zip", ".tsbuildinfo")

try {
  Get-ChildItem -Recurse -File -LiteralPath $appRoot | ForEach-Object {
    $relative = $_.FullName.Substring($appRoot.Path.Length + 1)
    $segments = $relative -split "[\\/]"
    if ($segments | Where-Object { $excludedDirectories -contains $_ -or $_ -like "backup-before-*" }) { return }
    if ($excludedFiles -contains $_.Name) { return }
    if ($excludedExtensions -contains $_.Extension) { return }
    if ($relative -like "public\uploads\*" -and $_.Name -ne ".gitkeep") { return }

    $target = Join-Path $staging $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }

  $forbidden = Get-ChildItem -Recurse -File -LiteralPath $staging | Where-Object {
    $_.Name -in ".env", ".env.local", ".env.production" -or $_.FullName -match "node_modules|\\.next|\\backups"
  }
  if ($forbidden) { throw "Release contains forbidden files." }

  $files = Get-ChildItem -Recurse -File -LiteralPath $staging
  $checksums = $files | ForEach-Object {
    $relative = $_.FullName.Substring($staging.Length + 1).Replace("\", "/")
    "{0}  {1}" -f (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash, $relative
  }
  [IO.File]::WriteAllLines((Join-Path $staging "RELEASE-SHA256.txt"), $checksums, [Text.UTF8Encoding]::new($false))

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip -CompressionLevel Optimal
  $zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash
  [ordered]@{
    ok = $true
    release = $zip
    bytes = (Get-Item -LiteralPath $zip).Length
    files = $files.Count + 1
    sha256 = $zipHash
    secretsIncluded = $false
  } | ConvertTo-Json
} finally {
  if (Test-Path $staging) {
    $resolvedStaging = (Resolve-Path $staging).Path
    if (-not $resolvedStaging.StartsWith($outputRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Unsafe staging cleanup path."
    }
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
  }
}
