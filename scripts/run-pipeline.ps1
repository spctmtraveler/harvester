<#
.SYNOPSIS
  Run the full Heart Walk pipeline: Gatekeeper → Analyst → Synthesizer → Reporter.

.DESCRIPTION
  Opens each app in the browser with ?autorun=1, waits for it to deposit results
  to the app_output DB table, then proceeds to the next stage.
  Can also run individual stages.

.PARAMETER Stage
  Which stages to run. Default: all.
  Options: all, gatekeeper, analyst, synthesizer, reporter

.PARAMETER Reset
  Include &reset=1 to reset each app's data before running.

.PARAMETER BatchSize
  Override batch size for Analyst + Synthesizer. Default: 20

.PARAMETER Model
  Override AI model. Default: gpt-4o

.PARAMETER PollInterval
  Seconds between DB polls to check for completion. Default: 15

.PARAMETER Timeout
  Max minutes to wait for each stage before giving up. Default: 30

.EXAMPLE
  .\run-pipeline.ps1
  .\run-pipeline.ps1 -Stage synthesizer -Reset
  .\run-pipeline.ps1 -Stage all -Reset -BatchSize 10 -Model gpt-4o-mini
#>
param(
  [ValidateSet("all","gatekeeper","analyst","synthesizer","reporter")]
  [string]$Stage = "all",
  [switch]$Reset,
  [int]$BatchSize = 20,
  [string]$Model = "gpt-4o",
  [int]$PollInterval = 15,
  [int]$Timeout = 30,
  [string]$AppName = "HWIE_v2"
)

$ErrorActionPreference = "Stop"

$SECRET_KEY = "z3Do9mKf8Q_autoDB_2025"
$SQL_URL    = "https://happydo.xyz/api_auto_db/sql_proxy.php?key=$SECRET_KEY"
$BASE_URL   = "https://happydo.xyz/harvester"

function Invoke-DB {
  param([string]$sql)
  $body = @{ app = $AppName; sql = $sql; params = @{} } | ConvertTo-Json -Depth 4
  $res = Invoke-RestMethod -Uri $SQL_URL -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
  if ($res.error) { throw "DB error: $($res.error)" }
  return $res.rows
}

function Get-LatestOutput {
  param([string]$stage)
  $rows = Invoke-DB "SELECT output_id, app_stage, status, payload, created_at FROM app_output WHERE app_stage='$stage' ORDER BY output_id DESC LIMIT 1"
  if ($rows -and $rows.Count -gt 0) { return $rows[0] }
  return $null
}

function Wait-ForStageCompletion {
  param([string]$stage, [int]$afterOutputId)

  $maxPolls = [math]::Ceiling(($Timeout * 60) / $PollInterval)
  Write-Host "  Waiting for '$stage' to deposit results (polling every ${PollInterval}s, timeout ${Timeout}m)..." -ForegroundColor DarkGray

  for ($i = 0; $i -lt $maxPolls; $i++) {
    Start-Sleep -Seconds $PollInterval
    try {
      $row = Get-LatestOutput $stage
      if ($row -and [int]$row.output_id -gt $afterOutputId) {
        Write-Host "  Stage '$stage' completed!" -ForegroundColor Green
        try {
          $payload = $row.payload | ConvertFrom-Json -Depth 10
          Write-Host "  Payload:" -ForegroundColor DarkGray
          $payload | Format-List | Out-String | Write-Host
        } catch {
          Write-Host "  Raw payload: $($row.payload.Substring(0, [math]::Min(500, $row.payload.Length)))" -ForegroundColor DarkGray
        }
        return $true
      }
    } catch {
      # DB poll failed — retry
    }
    $elapsed = ($i + 1) * $PollInterval
    Write-Host "  ... $elapsed s elapsed" -ForegroundColor DarkGray
  }
  Write-Host "  TIMEOUT: Stage '$stage' did not complete within $Timeout minutes." -ForegroundColor Red
  return $false
}

function Open-Stage {
  param([string]$name, [string]$urlPath, [hashtable]$extraParams = @{})

  Write-Host ""
  Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host " Stage: $name" -ForegroundColor Cyan
  Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

  # Get current max output_id for this stage (or 0)
  $currentRow = Get-LatestOutput $name.ToLower()
  $afterId = if ($currentRow) { [int]$currentRow.output_id } else { 0 }

  $qs = "autorun=1&_cb=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  if ($Reset) { $qs += "&reset=1" }
  foreach ($k in $extraParams.Keys) { $qs += "&$k=$($extraParams[$k])" }

  $url = "$BASE_URL/$urlPath`?$qs"
  Write-Host "  Opening: $url" -ForegroundColor DarkGray
  Start-Process $url

  $ok = Wait-ForStageCompletion -stage $name.ToLower() -afterOutputId $afterId
  if (-not $ok) {
    Write-Host "  Pipeline halted at '$name'. Check the browser for errors." -ForegroundColor Red
    exit 1
  }
  return $true
}

# ── Header ──
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Heart Walk Pipeline Orchestrator" -ForegroundColor Cyan
Write-Host " Stage=$Stage  Reset=$Reset  Batch=$BatchSize  Model=$Model" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

# Ensure app_output table exists
try {
  Invoke-DB "CREATE TABLE IF NOT EXISTS app_output (
    output_id   INT PRIMARY KEY AUTO_INCREMENT,
    app_stage   VARCHAR(50) NOT NULL,
    status      VARCHAR(20) DEFAULT 'ok',
    payload     LONGTEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )"
} catch {
  Write-Host "Warning: Could not ensure app_output table: $_" -ForegroundColor Yellow
}

$stages = @("gatekeeper","analyst","synthesizer","reporter")
if ($Stage -ne "all") { $stages = @($Stage) }

foreach ($s in $stages) {
  switch ($s) {
    "gatekeeper" {
      Open-Stage -name "Gatekeeper" -urlPath "10-gatekeeper/"
    }
    "analyst" {
      Open-Stage -name "Analyst" -urlPath "20-analyst/" -extraParams @{
        batchSize = $BatchSize
        model = $Model
      }
    }
    "synthesizer" {
      Open-Stage -name "Synthesizer" -urlPath "30-synthesizer/" -extraParams @{
        batchSize = $BatchSize
        model = $Model
      }
    }
    "reporter" {
      Open-Stage -name "Reporter" -urlPath "40-reporter/"
    }
  }
}

# ── Final summary ──
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host " Pipeline complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green

# Show final DB state
try {
  Write-Host ""
  Write-Host "Final DB state:" -ForegroundColor Cyan
  $sentences = Invoke-DB "SELECT COUNT(*) AS c FROM sentences"
  $finalized = Invoke-DB "SELECT COUNT(*) AS c FROM sentences WHERE review_status='finalized'"
  $insights = Invoke-DB "SELECT COUNT(*) AS c FROM insights"
  $links = Invoke-DB "SELECT COUNT(*) AS c FROM insight_sentences"
  Write-Host "  Sentences: $($sentences[0].c)" -ForegroundColor DarkGray
  Write-Host "  Finalized: $($finalized[0].c)" -ForegroundColor DarkGray
  Write-Host "  Insights:  $($insights[0].c)" -ForegroundColor DarkGray
  Write-Host "  Links:     $($links[0].c)" -ForegroundColor DarkGray

  # Get latest reporter output
  $rpt = Get-LatestOutput "reporter"
  if ($rpt) {
    try {
      $rptPayload = $rpt.payload | ConvertFrom-Json -Depth 10
      Write-Host "  Report claims: $($rptPayload.claims_count)" -ForegroundColor DarkGray
      Write-Host "  Slides:        $($rptPayload.slides_count)" -ForegroundColor DarkGray
    } catch {}
  }
} catch {
  Write-Host "  (Could not query final state)" -ForegroundColor Yellow
}
