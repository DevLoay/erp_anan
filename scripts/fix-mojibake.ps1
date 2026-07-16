param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$src = Join-Path $root "src"
$marker = [regex]::new("[\u0637\u0638]|[\u00D8\u00D9\u00C3]")
$allowed = @(
  "src/lib/cities/cityNormalization.ts",
  "src/lib/application-accounts/accountLinking.ts"
)
$cp1256 = [Text.Encoding]::GetEncoding(
  1256,
  [Text.EncoderFallback]::ExceptionFallback,
  [Text.DecoderFallback]::ExceptionFallback
)
$utf8Strict = [Text.UTF8Encoding]::new($false, $true)
$utf8 = [Text.UTF8Encoding]::new($false)
$report = [ordered]@{
  ok = $true
  mode = $(if ($Apply) { "apply" } else { "dry-run" })
  changedFiles = 0
  changedLines = 0
  skippedCompatibilityFiles = @()
  files = @()
}

Get-ChildItem -Recurse -File -LiteralPath $src |
  Where-Object { $_.Extension -in ".ts", ".tsx", ".css", ".json" } |
  ForEach-Object {
    $file = $_
    $relative = $file.FullName.Substring($root.Path.Length + 1).Replace("\", "/")
    if ($allowed -contains $relative) {
      if ($marker.IsMatch([IO.File]::ReadAllText($file.FullName))) {
        $report.skippedCompatibilityFiles += $relative
      }
      return
    }

    $text = [IO.File]::ReadAllText($file.FullName)
    $parts = [regex]::Split($text, "(`r`n|`n)")
    $changed = 0
    for ($index = 0; $index -lt $parts.Length; $index += 2) {
      $line = $parts[$index]
      if (-not $marker.IsMatch($line)) { continue }
      try {
        $candidate = $utf8Strict.GetString($cp1256.GetBytes($line))
        if ($candidate -ne $line -and $marker.Matches($candidate).Count -lt $marker.Matches($line).Count) {
          $parts[$index] = $candidate
          $changed++
        }
      } catch {
        # Mixed valid Arabic and legacy mojibake is intentionally left for manual review.
      }
    }

    if ($changed -gt 0) {
      $report.changedFiles++
      $report.changedLines += $changed
      $report.files += [ordered]@{ file = $relative; lines = $changed }
      if ($Apply) {
        [IO.File]::WriteAllText($file.FullName, [string]::Concat($parts), $utf8)
      }
    }
  }

$report | ConvertTo-Json -Depth 5
