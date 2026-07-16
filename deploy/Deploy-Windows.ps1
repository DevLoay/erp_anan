param(
  [switch]$Apply,
  [switch]$RunMigrations
)

$ErrorActionPreference = "Stop"
$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $appRoot

$steps = @(
  "npm ci",
  "npx prisma validate",
  "npx prisma generate",
  $(if ($RunMigrations) { "npx prisma migrate deploy" } else { "migration skipped" }),
  "npm run typecheck",
  "npm run build"
)

if (-not $Apply) {
  [ordered]@{
    ok = $true
    mode = "dry-run"
    appRoot = $appRoot.Path
    envProductionExists = Test-Path (Join-Path $appRoot ".env.production")
    steps = $steps
    applyCommand = ".\deploy\Deploy-Windows.ps1 -Apply -RunMigrations"
  } | ConvertTo-Json -Depth 4
  exit 0
}

if (-not (Test-Path (Join-Path $appRoot ".env.production"))) {
  throw ".env.production is required. Copy .env.production.example and replace every placeholder."
}

$env:NODE_ENV = "production"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npx prisma validate
if ($LASTEXITCODE -ne 0) { throw "prisma validate failed" }
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }
if ($RunMigrations) {
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed" }
}
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

[ordered]@{
  ok = $true
  mode = "apply"
  migrationsApplied = [bool]$RunMigrations
  nextCommand = "npm start"
  healthUrl = "http://127.0.0.1:3040/api/health"
} | ConvertTo-Json -Depth 3
