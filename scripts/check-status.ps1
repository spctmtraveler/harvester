<#
.SYNOPSIS
  Quick status check for the Heart Walk pipeline DB state.

.DESCRIPTION
  Queries all key tables and shows counts, statuses, and latest app_output entries.

.EXAMPLE
  .\check-status.ps1
  .\check-status.ps1 -ShowOutputs
#>
param(
  [switch]$ShowOutputs,
  [string]$AppName = "HWIE_v2"
)

$SECRET_KEY = "z3Do9mKf8Q_autoDB_2025"
$SQL_URL    = "https://happydo.xyz/api_auto_db/sql_proxy.php?key=$SECRET_KEY"

function Invoke-DB {
  param([string]$sql)
  $body = @{ app = $AppName; sql = $sql; params = @{} } | ConvertTo-Json -Depth 4
  $res = Invoke-RestMethod -Uri $SQL_URL -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
  if ($res.error) { throw "DB error: $($res.error)" }
  return $res.rows
}

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Heart Walk DB Status ($AppName)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Interviews
try {
  $iv = Invoke-DB "SELECT COUNT(*) AS c FROM interviews"
  Write-Host "Interviews: $($iv[0].c)" -ForegroundColor Green
} catch { Write-Host "Interviews: (table missing)" -ForegroundColor DarkGray }

# Sentences
try {
  $rows = Invoke-DB "SELECT review_status, COUNT(*) AS c FROM sentences GROUP BY review_status ORDER BY review_status"
  $total = ($rows | Measure-Object -Property c -Sum).Sum
  Write-Host "Sentences: $total total" -ForegroundColor Green
  foreach ($r in $rows) {
    Write-Host "  $($r.review_status): $($r.c)" -ForegroundColor DarkGray
  }
} catch { Write-Host "Sentences: (table missing)" -ForegroundColor DarkGray }

# Tags
try {
  $tags = Invoke-DB "SELECT COUNT(DISTINCT tag_key) AS c FROM tags"
  $tagLinks = Invoke-DB "SELECT COUNT(*) AS c FROM sentence_tags"
  Write-Host "Tags: $($tags[0].c) unique, $($tagLinks[0].c) links" -ForegroundColor Green
} catch { Write-Host "Tags: (table missing)" -ForegroundColor DarkGray }

# Synthesis Queue
try {
  $qRows = Invoke-DB "SELECT status, COUNT(*) AS c FROM sentence_synthesis_queue GROUP BY status ORDER BY status"
  $qTotal = ($qRows | Measure-Object -Property c -Sum).Sum
  Write-Host "Synthesis Queue: $qTotal total" -ForegroundColor Green
  foreach ($r in $qRows) {
    Write-Host "  $($r.status): $($r.c)" -ForegroundColor DarkGray
  }
} catch { Write-Host "Synthesis Queue: (table missing)" -ForegroundColor DarkGray }

# AI Runs
try {
  $runs = Invoke-DB "SELECT purpose, COUNT(*) AS c FROM ai_runs GROUP BY purpose"
  foreach ($r in $runs) {
    Write-Host "AI Runs ($($r.purpose)): $($r.c)" -ForegroundColor Green
  }
  if (-not $runs -or $runs.Count -eq 0) {
    Write-Host "AI Runs: 0" -ForegroundColor DarkGray
  }
} catch { Write-Host "AI Runs: (table missing)" -ForegroundColor DarkGray }

# Insights
try {
  $ins = Invoke-DB "SELECT COUNT(*) AS c FROM insights"
  $links = Invoke-DB "SELECT COUNT(*) AS c FROM insight_sentences"
  Write-Host "Insights: $($ins[0].c), Evidence links: $($links[0].c)" -ForegroundColor Green
} catch { Write-Host "Insights: (table missing)" -ForegroundColor DarkGray }

# App Output
try {
  $outputs = Invoke-DB "SELECT app_stage, status, created_at FROM app_output ORDER BY output_id DESC LIMIT 10"
  if ($outputs -and $outputs.Count -gt 0) {
    Write-Host ""
    Write-Host "Recent app_output entries:" -ForegroundColor Cyan
    foreach ($o in $outputs) {
      Write-Host "  [$($o.created_at)] $($o.app_stage) — $($o.status)" -ForegroundColor DarkGray
    }
    if ($ShowOutputs) {
      Write-Host ""
      $latest = Invoke-DB "SELECT app_stage, payload FROM app_output ORDER BY output_id DESC LIMIT 1"
      if ($latest -and $latest.Count -gt 0) {
        Write-Host "Latest payload ($($latest[0].app_stage)):" -ForegroundColor Cyan
        try {
          $latest[0].payload | ConvertFrom-Json -Depth 10 | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
          Write-Host $latest[0].payload
        }
      }
    }
  } else {
      Write-Host ""
      Write-Host "App Output: no entries (pipeline hasn't run yet)" -ForegroundColor DarkGray
  }
} catch { Write-Host "App Output: (table missing)" -ForegroundColor DarkGray }
