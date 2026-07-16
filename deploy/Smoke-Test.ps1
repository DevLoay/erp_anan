param(
  [string]$BaseUrl = "http://127.0.0.1:3040"
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
$health = Invoke-RestMethod -Uri "$base/api/health" -Method Get -TimeoutSec 10
$login = Invoke-WebRequest -Uri "$base/login" -Method Get -UseBasicParsing -TimeoutSec 10
$protectedStatus = 0
$protectedLocation = ""
try {
  $protected = Invoke-WebRequest -Uri "$base/dashboard" -Method Get -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10
  $protectedStatus = [int]$protected.StatusCode
  $protectedLocation = [string]$protected.Headers.Location
} catch {
  if ($_.Exception.Response) {
    $protectedStatus = [int]$_.Exception.Response.StatusCode
    $protectedLocation = [string]$_.Exception.Response.Headers["Location"]
  } else {
    throw
  }
}

$report = [ordered]@{
  ok = [bool]($health.ok -and $health.database -and $login.StatusCode -eq 200 -and $protectedStatus -in 302, 303, 307, 308)
  health = [ordered]@{ status = 200; ok = $health.ok; database = $health.database }
  loginStatus = $login.StatusCode
  protectedRouteStatus = $protectedStatus
  protectedRouteLocation = $protectedLocation
}
$report | ConvertTo-Json -Depth 4
if (-not $report.ok) { exit 1 }
