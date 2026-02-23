<#
.SYNOPSIS
  Extract the latest Reporter output from the database and save all components locally.

.DESCRIPTION
  Pulls the most recent Reporter auto-deposit from app_output, then saves:
  - The narrative report (markdown)
  - The full payload as JSON (for AI agent inspection)
  - Quality check results (if present)
  All files go to transcripts/app output/reporter/

.EXAMPLE
  .\extract-narrative.ps1
#>

$ErrorActionPreference = "Stop"
$SECRET_KEY = "z3Do9mKf8Q_autoDB_2025"
$PROXY_URL  = "https://happydo.xyz/api_auto_db/sql_proxy.php?key=$SECRET_KEY"
$OUT_DIR    = "transcripts/app output/reporter"

Write-Host "Fetching latest Reporter output from database..." -ForegroundColor Cyan

$body = @{
  app = 'HWIE_v2'
  sql = "SELECT output_id, payload, created_at FROM app_output WHERE app_stage='reporter' ORDER BY output_id DESC LIMIT 1"
  params = @{}
} | ConvertTo-Json -Depth 4

$resp = Invoke-RestMethod -Uri $PROXY_URL -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 30

if (-not $resp.rows -or $resp.rows.Count -eq 0) {
  Write-Host "No Reporter output found in database." -ForegroundColor Yellow
  exit 0
}

$row = $resp.rows[0]
$p = $row.payload | ConvertFrom-Json

Write-Host "Found output_id=$($row.output_id) from $($row.created_at)" -ForegroundColor Green
Write-Host "  Claims: $($p.claims_count)  Slides: $($p.narrative_slides_count)  Report length: $($p.report_length) chars" -ForegroundColor DarkGray

# 1. Save narrative report
if ($p.report_preview) {
  $narrativePath = Join-Path $OUT_DIR "narrative-report-output.md"
  $p.report_preview | Set-Content -Path $narrativePath -Encoding utf8
  Write-Host "  Saved narrative: $narrativePath ($($p.report_preview.Length) chars)" -ForegroundColor Green
}

# 2. Save full payload JSON (everything the AI agent needs to inspect)
$fullPath = Join-Path $OUT_DIR "reporter-full-payload.json"
$p | ConvertTo-Json -Depth 20 | Set-Content -Path $fullPath -Encoding utf8
Write-Host "  Saved full payload: $fullPath" -ForegroundColor Green

# 3. Save quality check results separately (easy to read)
if ($p.quality_check) {
  $qcPath = Join-Path $OUT_DIR "quality-check-results.json"
  $p.quality_check | ConvertTo-Json -Depth 10 | Set-Content -Path $qcPath -Encoding utf8
  $issues = if ($p.quality_check.issues) { $p.quality_check.issues.Count } else { 0 }
  $status = if ($p.quality_check.passed) { "PASSED" } else { "FAILED" }
  Write-Host "  Saved quality check: $qcPath ($status, $issues issue(s))" -ForegroundColor $(if ($p.quality_check.passed) { "Green" } else { "Yellow" })
} else {
  Write-Host "  No quality check data (run was before Step 4 was added)" -ForegroundColor DarkGray
}

# 4. Save intermediates if present
if ($p.intermediates) {
  $intPath = Join-Path $OUT_DIR "intermediates.json"
  $p.intermediates | ConvertTo-Json -Depth 20 | Set-Content -Path $intPath -Encoding utf8
  Write-Host "  Saved intermediates: $intPath" -ForegroundColor Green
}

Write-Host "`nDone. Files ready for AI agent review in: $OUT_DIR" -ForegroundColor Cyan
