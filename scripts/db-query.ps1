<#
.SYNOPSIS
  Direct SQL query tool for the HWIE_v2 database via the happydo.xyz auto-DB proxy.

.DESCRIPTION
  Sends arbitrary SQL to the sql_proxy endpoint and returns results as JSON/table.
  Use this to inspect DB state without needing a browser.

.PARAMETER Sql
  The SQL query to execute. Required.

.PARAMETER AppName
  The Auto-DB app name. Default: HWIE_v2

.PARAMETER Raw
  Output raw JSON instead of formatted table.

.PARAMETER Quiet
  Suppress header/status messages.

.EXAMPLE
  .\db-query.ps1 "SELECT COUNT(*) AS cnt FROM insights"
  .\db-query.ps1 "SELECT * FROM ai_runs ORDER BY run_id DESC LIMIT 5" -Raw
  .\db-query.ps1 "SELECT * FROM sentence_synthesis_queue WHERE status='error' LIMIT 10"
#>
param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Sql,

  [string]$AppName = "HWIE_v2",

  [switch]$Raw,

  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$SECRET_KEY = "z3Do9mKf8Q_autoDB_2025"
$PROXY_URL  = "https://happydo.xyz/api_auto_db/sql_proxy.php?key=$SECRET_KEY"

if (-not $Quiet) {
  Write-Host "DB Query Tool — $AppName" -ForegroundColor Cyan
  Write-Host "SQL: $Sql" -ForegroundColor DarkGray
  Write-Host ""
}

$body = @{
  app = $AppName
  sql = $Sql
  params = @{}
} | ConvertTo-Json -Depth 4

try {
  $response = Invoke-RestMethod -Uri $PROXY_URL -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 30

  if ($Raw) {
    $response | ConvertTo-Json -Depth 10
    return
  }

  if ($response.error) {
    Write-Host "ERROR: $($response.error)" -ForegroundColor Red
    return
  }

  $rows = $response.rows
  if (-not $rows -or $rows.Count -eq 0) {
    if (-not $Quiet) { Write-Host "(no rows returned)" -ForegroundColor Yellow }
    # Still output any non-row response info
    if ($response.affected_rows) {
      Write-Host "Affected rows: $($response.affected_rows)" -ForegroundColor Green
    }
    return
  }

  if (-not $Quiet) {
    Write-Host "Rows: $($rows.Count)" -ForegroundColor Green
    Write-Host ""
  }

  # Output as table
  $rows | Format-Table -AutoSize | Out-String | Write-Host

} catch {
  Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.Exception.Response) {
    try {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      Write-Host "Response body: $($reader.ReadToEnd())" -ForegroundColor DarkRed
      $reader.Close()
    } catch {}
  }
  exit 1
}
