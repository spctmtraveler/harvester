<#
.SYNOPSIS
  Test harness for the Synthesizer: runs one batch via the AI proxy and reports results.

.DESCRIPTION
  Fetches a thematic batch from the DB, builds the prompt, calls the AI proxy,
  parses the response, and reports results — all from the terminal.
  Does NOT write to the DB by default (dry-run). Use -Persist to write.

.PARAMETER BatchSize
  Number of sentences to include in the batch. Default: 10

.PARAMETER Model
  AI model to use. Default: gpt-4o

.PARAMETER Persist
  Actually write insights/links to DB. Without this flag, it's read-only.

.PARAMETER SaveResponse
  Save raw AI response to a file in scripts/test-output/

.EXAMPLE
  .\test-synth.ps1
  .\test-synth.ps1 -BatchSize 5 -Model gpt-4o-mini -SaveResponse
  .\test-synth.ps1 -BatchSize 15 -Persist
#>
param(
  [int]$BatchSize = 10,
  [string]$Model = "gpt-4o",
  [switch]$Persist,
  [switch]$SaveResponse,
  [string]$AppName = "HWIE_v2"
)

$ErrorActionPreference = "Stop"

$SECRET_KEY = "z3Do9mKf8Q_autoDB_2025"
$SQL_URL    = "https://happydo.xyz/api_auto_db/sql_proxy.php?key=$SECRET_KEY"
$AI_URL     = "https://happydo.xyz/api/aiproxy.php"

$EXCLUDED_TAGS = @("catch_irrelevant", "catch_miscellaneous")
$EXCLUDED_SQL  = ($EXCLUDED_TAGS | ForEach-Object { "'$_'" }) -join ","

function Invoke-DB {
  param([string]$sql)
  $body = @{ app = $AppName; sql = $sql; params = @{} } | ConvertTo-Json -Depth 4
  $res = Invoke-RestMethod -Uri $SQL_URL -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
  if ($res.error) { throw "DB error: $($res.error)" }
  return $res.rows
}

function Invoke-AI {
  param([string]$prompt, [string]$model, [double]$temperature = 0.2)
  $body = @{ model = $model; prompt = $prompt; temperature = $temperature; type = "text" } | ConvertTo-Json -Depth 4
  $res = Invoke-RestMethod -Uri $AI_URL -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
  if ($res.error) { throw "AI error: $($res.error.message ?? $res.error)" }
  return $res.response
}

# ── Header ──
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Synthesizer Test Harness" -ForegroundColor Cyan
Write-Host " BatchSize=$BatchSize  Model=$Model  Persist=$Persist" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Find seed sentence ──
Write-Host "[1/6] Finding seed sentence..." -ForegroundColor Yellow
$seed = Invoke-DB "
  SELECT s.sentence_id
  FROM sentences s
  JOIN sentence_synthesis_queue q ON q.sentence_id = s.sentence_id
  JOIN sentence_tags st ON st.sentence_id = s.sentence_id
  JOIN tags t ON t.tag_id = st.tag_id
  WHERE s.review_status = 'finalized'
    AND q.status = 'unprocessed'
    AND t.tag_key NOT IN ($EXCLUDED_SQL)
  GROUP BY s.sentence_id
  ORDER BY s.sentence_id ASC
  LIMIT 1
"
if (-not $seed -or $seed.Count -eq 0) {
  Write-Host "  No eligible seed sentence found. Queue may be empty or all blocks are irrelevant/misc." -ForegroundColor Red
  exit 0
}
$seedId = $seed[0].sentence_id
Write-Host "  Seed: $seedId" -ForegroundColor Green

# ── Step 2: Get seed tags ──
Write-Host "[2/6] Fetching seed tags..." -ForegroundColor Yellow
$safeSeed = $seedId -replace "'", "''"
$tagRows = Invoke-DB "
  SELECT DISTINCT t.tag_key
  FROM sentence_tags st
  JOIN tags t ON t.tag_id = st.tag_id
  WHERE st.sentence_id='$safeSeed'
    AND t.tag_key NOT IN ($EXCLUDED_SQL)
"
$seedTags = @($tagRows | ForEach-Object { $_.tag_key } | Where-Object { $_ })
if ($seedTags.Count -eq 0) {
  Write-Host "  Seed has no non-excluded tags." -ForegroundColor Red
  exit 0
}
Write-Host "  Tags: $($seedTags -join ', ')" -ForegroundColor Green

# ── Step 3: Fetch thematic batch ──
Write-Host "[3/6] Fetching thematic batch (limit $BatchSize)..." -ForegroundColor Yellow
$tagListSql = ($seedTags | ForEach-Object { "'$($_ -replace "'", "''")'" }) -join ","
$batch = Invoke-DB "
  SELECT DISTINCT s.sentence_id, s.raw_text, s.clean_text, s.sentiment_score,
         s.is_problem, s.is_solution, s.is_explanation, s.is_workaround,
         s.timestamp_block, s.speaker
  FROM sentences s
  JOIN sentence_synthesis_queue q ON q.sentence_id = s.sentence_id
  JOIN sentence_tags st ON st.sentence_id = s.sentence_id
  JOIN tags t ON t.tag_id = st.tag_id
  WHERE s.review_status = 'finalized'
    AND q.status = 'unprocessed'
    AND t.tag_key IN ($tagListSql)
    AND t.tag_key NOT IN ($EXCLUDED_SQL)
  ORDER BY s.sentence_id ASC
  LIMIT $BatchSize
"
if (-not $batch -or $batch.Count -eq 0) {
  Write-Host "  No batch rows returned." -ForegroundColor Red
  exit 0
}
Write-Host "  Batch: $($batch.Count) sentences" -ForegroundColor Green

# Fetch tags for each sentence
$batchIds = ($batch | ForEach-Object { "'$($_.sentence_id -replace "'", "''")'" }) -join ","
$batchTags = Invoke-DB "
  SELECT st.sentence_id, t.tag_key
  FROM sentence_tags st
  JOIN tags t ON t.tag_id = st.tag_id
  WHERE st.sentence_id IN ($batchIds)
    AND t.tag_key NOT IN ($EXCLUDED_SQL)
"
$tagMap = @{}
foreach ($r in $batchTags) {
  if (-not $tagMap[$r.sentence_id]) { $tagMap[$r.sentence_id] = @() }
  $tagMap[$r.sentence_id] += $r.tag_key
}

# ── Step 4: Build prompt ──
Write-Host "[4/6] Building prompt..." -ForegroundColor Yellow

$HW_OVERVIEW = @"
Heart Walk is a market-based fundraising and engagement campaign by the American Heart Association (AHA).
Goals: generate corporate sponsorship revenue, engage companies/community leaders, activate employee participation, build long-term leadership pipelines.
Organizational Structure:
- National Level: sets strategy, develops resources, provides reporting systems, offers regional oversight
- Market Level: executes Heart Walk locally, recruits/manages volunteer leadership, manages corporate relationships, coordinates meetings/events
Internal AHA Leadership (paid staff): Executive Director (ED), Development Director (DD), Senior Development Director, Senior Vice President (SVP), Director
External Volunteer Leadership: ELT Chair, ELT Members, Market Board Members, Corporate Executives, Team Captains
Meetings & Cadence: ELT meetings, GAP meetings, strategy meetings, internal coordination, executive networking breakfasts
Tools/Systems: Salesforce, SharePoint, reporting dashboards, pipeline trackers, impact plans, annotated agendas, slide decks, email/call/text templates
"@

$inputBlocks = @()
foreach ($s in $batch) {
  $tags = @()
  if ($tagMap[$s.sentence_id]) { $tags = $tagMap[$s.sentence_id] }
  $block = @{
    sentence_id      = $s.sentence_id
    text             = if ($s.clean_text) { $s.clean_text } else { $s.raw_text }
    sentiment_score  = [int]($s.sentiment_score ?? 0)
    flags            = @{
      is_problem     = [bool][int]($s.is_problem ?? 0)
      is_solution    = [bool][int]($s.is_solution ?? 0)
      is_explanation = [bool][int]($s.is_explanation ?? 0)
      is_workaround  = [bool][int]($s.is_workaround ?? 0)
    }
    tags             = $tags
    timestamp        = $s.timestamp_block ?? ""
    speaker          = $s.speaker ?? ""
  }
  $inputBlocks += ($block | ConvertTo-Json -Depth 4 -Compress)
}
$inputBlocksStr = $inputBlocks -join "`n"

$prompt = @"
You are the "Synthesizer" agent for the Heart Walk evidence database.

== HEART WALK SYSTEMS OVERVIEW (CONTEXT) ==
$HW_OVERVIEW

== GOAL ==
Cluster the provided coded semantic blocks into discrete, concise insights.

== HARD RULES ==
1. Every insight MUST include at least 1 supporting block.
2. Use ONLY the provided sentence_ids for evidence links.
3. Blocks may support multiple insights (many-to-many).
4. Provide quote_rank 0..3 for each evidence block.
5. Each insight must include at least ONE evidence block with quote_rank >= 2.
6. support_role must be one of: direct_quote, evidence, context, counterpoint.
7. Do not invent topic labels. Topic semantics come from the supporting block tags.
8. Evidence sentence_ids within one insight MUST be unique (no duplicates).
9. Avoid duplicate or near-duplicate insights; merge overlapping ideas into one stronger insight.
10. Prefer 2-6 evidence blocks per insight when available.
11. If an insight cannot satisfy all hard rules, omit it (do not emit invalid items).

== INPUT (CODED BLOCKS) ==
$inputBlocksStr

== REQUIRED OUTPUT (JSON ONLY) ==
Return ONLY a JSON object (no markdown fences, no commentary outside the JSON).
The object MUST have exactly two keys: "insights" (array) and "_meta" (diagnostics object).

{
  "insights": [
    {
      "summary_plain": "One-sentence insight statement.",
      "summary_long": "(optional) 1-3 sentence elaboration.",
      "evidence": [
        {
          "sentence_id": "LV.001",
          "quote_rank": 3,
          "support_role": "direct_quote",
          "notes": "optional"
        }
      ]
    }
  ],
  "_meta": {
    "input_block_count": $($batch.Count),
    "input_ids_received": [$($batch | ForEach-Object { "`"$($_.sentence_id)`"" } | Join-String -Separator ", ")],
    "insights_produced": 0,
    "blocks_used_count": 0,
    "blocks_unused": [],
    "rule_violations_caught": [],
    "warnings": [],
    "model_notes": ""
  }
}

== SELF-CHECK BEFORE OUTPUT ==
- Every evidence.sentence_id must be one of the input sentence_ids.
- quote_rank must be integer 0..3.
- support_role must be one of the allowed enum values.
- Every insight must have evidence.length >= 1 and at least one quote_rank >= 2.
- No duplicate sentence_id inside a single insight.evidence.
- No two insights should express substantially the same summary_plain.
- _meta.input_block_count must equal the number of input blocks you received.
- _meta.blocks_used_count + len(blocks_unused) should account for all input blocks.
- If you cannot produce ANY valid insights, return {"insights":[], "_meta":{...}} with an explanation in model_notes.
"@

Write-Host "  Prompt length: $($prompt.Length) chars" -ForegroundColor Green

# ── Step 5: Call AI ──
Write-Host "[5/6] Calling AI ($Model)..." -ForegroundColor Yellow
$startTime = Get-Date
$rawResponse = Invoke-AI -prompt $prompt -model $Model -temperature 0.2
$elapsed = ((Get-Date) - $startTime).TotalSeconds

Write-Host "  Response received in $([math]::Round($elapsed, 1))s, $($rawResponse.Length) chars" -ForegroundColor Green

# Save raw response if requested
$outputDir = Join-Path $PSScriptRoot "test-output"
if ($SaveResponse -or $true) {
  # Always save for debugging
  if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }
  $timestamp = (Get-Date -Format "yyyyMMdd_HHmmss")
  $outFile = Join-Path $outputDir "synth-response-$timestamp.txt"
  $rawResponse | Out-File -FilePath $outFile -Encoding utf8
  Write-Host "  Saved to: $outFile" -ForegroundColor DarkGray
}

# ── Step 6: Parse response ──
Write-Host "[6/6] Parsing response..." -ForegroundColor Yellow

# Check for proxy error responses
if (-not $rawResponse -or $rawResponse -eq "(no response)") {
  Write-Host "  FAIL: AI returned empty or '(no response)'" -ForegroundColor Red
  Write-Host "  Raw: $rawResponse" -ForegroundColor DarkRed
  exit 1
}
if ($rawResponse -like "Error:*") {
  Write-Host "  FAIL: AI proxy returned error" -ForegroundColor Red
  Write-Host "  Raw: $($rawResponse.Substring(0, [math]::Min(500, $rawResponse.Length)))" -ForegroundColor DarkRed
  exit 1
}

# Strip markdown code fences if present
$cleaned = $rawResponse
if ($cleaned -match '```(?:json)?\s*([\s\S]*?)```') {
  $cleaned = $Matches[1].Trim()
}

# Try to parse JSON
try {
  $parsed = $cleaned | ConvertFrom-Json -Depth 20
} catch {
  Write-Host "  FAIL: JSON parse error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Raw head (500 chars): $($rawResponse.Substring(0, [math]::Min(500, $rawResponse.Length)))" -ForegroundColor DarkRed
  Write-Host "  Raw tail (500 chars): $($rawResponse.Substring([math]::Max(0, $rawResponse.Length - 500)))" -ForegroundColor DarkRed
  exit 1
}

# Extract insights
$insights = $null
$meta = $null
if ($parsed.insights) {
  $insights = @($parsed.insights)
  $meta = $parsed._meta
  Write-Host "  Parsed wrapper object: $($insights.Count) insights" -ForegroundColor Green
} elseif ($parsed -is [array]) {
  $insights = @($parsed)
  Write-Host "  Parsed bare array: $($insights.Count) insights (no _meta)" -ForegroundColor Yellow
} else {
  Write-Host "  FAIL: Response is neither {insights:[]} nor array" -ForegroundColor Red
  Write-Host "  Type: $($parsed.GetType().Name)" -ForegroundColor DarkRed
  exit 1
}

# ── Report ──
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " RESULTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

Write-Host "Insights produced: $($insights.Count)" -ForegroundColor $(if ($insights.Count -gt 0) { "Green" } else { "Red" })

if ($meta) {
  Write-Host ""
  Write-Host "AI _meta diagnostics:" -ForegroundColor Cyan
  Write-Host "  input_block_count:  $($meta.input_block_count)" -ForegroundColor DarkGray
  Write-Host "  insights_produced:  $($meta.insights_produced)" -ForegroundColor DarkGray
  Write-Host "  blocks_used_count:  $($meta.blocks_used_count)" -ForegroundColor DarkGray
  if ($meta.blocks_unused -and $meta.blocks_unused.Count -gt 0) {
    Write-Host "  blocks_unused:" -ForegroundColor Yellow
    foreach ($u in $meta.blocks_unused) {
      Write-Host "    $($u.sentence_id): $($u.reason)" -ForegroundColor Yellow
    }
  }
  if ($meta.rule_violations_caught -and $meta.rule_violations_caught.Count -gt 0) {
    Write-Host "  rule_violations_caught:" -ForegroundColor Yellow
    foreach ($v in $meta.rule_violations_caught) { Write-Host "    - $v" -ForegroundColor Yellow }
  }
  if ($meta.warnings -and $meta.warnings.Count -gt 0) {
    Write-Host "  warnings:" -ForegroundColor Yellow
    foreach ($w in $meta.warnings) { Write-Host "    ⚠ $w" -ForegroundColor Yellow }
  }
  if ($meta.model_notes) {
    Write-Host "  model_notes: $($meta.model_notes)" -ForegroundColor DarkGray
  }
}

# Validate each insight
Write-Host ""
$inputIdSet = [System.Collections.Generic.HashSet[string]]::new()
foreach ($s in $batch) { [void]$inputIdSet.Add($s.sentence_id) }

$valid = 0
$invalid = 0
foreach ($ins in $insights) {
  $issues = @()
  $summary = ($ins.summary_plain ?? "").Trim()
  if (-not $summary -or $summary.Length -lt 10) { $issues += "summary too short" }
  $evidence = @($ins.evidence ?? @())
  if ($evidence.Count -eq 0) { $issues += "no evidence" }
  $hasGoodQuote = $false
  $evIds = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($ev in $evidence) {
    if (-not $ev.sentence_id) { $issues += "missing sentence_id"; continue }
    if (-not $inputIdSet.Contains($ev.sentence_id)) { $issues += "sentence_id $($ev.sentence_id) not in input" }
    if (-not $evIds.Add($ev.sentence_id)) { $issues += "duplicate evidence $($ev.sentence_id)" }
    $qr = [int]($ev.quote_rank ?? -1)
    if ($qr -lt 0 -or $qr -gt 3) { $issues += "invalid quote_rank $qr" }
    if ($qr -ge 2) { $hasGoodQuote = $true }
    $role = $ev.support_role ?? ""
    if ($role -notin @("direct_quote","evidence","context","counterpoint")) { $issues += "invalid support_role '$role'" }
  }
  if (-not $hasGoodQuote -and $evidence.Count -gt 0) { $issues += "no quote_rank >= 2" }

  if ($issues.Count -eq 0) {
    $valid++
    $shortSummary = $summary.Substring(0, [math]::Min(80, $summary.Length))
    Write-Host "  ✅ [$($evidence.Count) ev] $shortSummary" -ForegroundColor Green
  } else {
    $invalid++
    Write-Host "  ❌ $($issues -join '; ')" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Valid: $valid  Invalid: $invalid  Total: $($insights.Count)" -ForegroundColor $(if ($invalid -eq 0 -and $valid -gt 0) { "Green" } else { "Yellow" })

# ── Persist if requested ──
if ($Persist -and $valid -gt 0) {
  Write-Host ""
  Write-Host "Persisting $valid valid insights to DB..." -ForegroundColor Yellow
  # This is a simplified persistence path — the real app does more validation
  Write-Host "  (Persistence via CLI not yet implemented — use the browser app for now)" -ForegroundColor DarkGray
  Write-Host "  The key finding is that parsing works and the AI returns valid insights." -ForegroundColor DarkGray
}

# ── Summary for Copilot ──
$summaryFile = Join-Path $outputDir "synth-test-summary-$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$summaryObj = @{
  timestamp     = (Get-Date -Format "o")
  model         = $Model
  batch_size    = $batch.Count
  seed_id       = $seedId
  seed_tags     = $seedTags
  prompt_length = $prompt.Length
  response_time_sec = [math]::Round($elapsed, 2)
  response_length   = $rawResponse.Length
  insights_total    = $insights.Count
  insights_valid    = $valid
  insights_invalid  = $invalid
  has_meta          = [bool]$meta
  meta              = $meta
}
$summaryObj | ConvertTo-Json -Depth 10 | Out-File -FilePath $summaryFile -Encoding utf8
Write-Host ""
Write-Host "Summary saved: $summaryFile" -ForegroundColor DarkGray
