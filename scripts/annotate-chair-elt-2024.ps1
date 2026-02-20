$source = "transcripts/app output/reporter/example reports for language reference only/chair elt research report 2024.md"
$target = "transcripts/app output/reporter/chair-elt-research-report-2024-annotated-against-2026.md"

function Get-HeadingAssessment([string]$heading) {
  $status = "🟡 Partially Supported"
  $note = "Not explicitly mapped; likely directionally relevant but not directly verified in current wave."

  switch -Regex ($heading) {
    '^Assignment$' { $status = "✅ Supported"; $note = "Core assignment still aligns: recruiting Chairs/ELT is still hard in 2026 interviews."; break }
    '^What Does Success Look Like\?$' { $status = "🟡 Partially Supported"; $note = "Directionally true, but 2026 data focuses more on ELT operations/onboarding than explicit chair outcomes."; break }
    '^Who We Talked To$' { $status = "❌ Not Comparable"; $note = "Different respondent set and study wave; keep as historical context only."; break }
    '^The Approach$' { $status = "✅ Supported"; $note = "Theme-based qualitative synthesis is consistent with new system outputs."; break }

    '^People Have Very Different.*Why' { $status = "🟡 Partially Supported"; $note = "Mission-driven motivation appears in 2026, but fewer personal/family narratives were captured."; break }
    '^Staff Are Crucial$' { $status = "✅ Supported"; $note = "Strongly echoed in 2026: staff continuity, coaching, and prep quality drive outcomes."; break }
    '^Execs Are Very Busy' { $status = "✅ Supported"; $note = "Still true: strong staff enablement is repeatedly described as the success multiplier."; break }
    '^It.*All About Their Why$' { $status = "✅ Supported"; $note = "Still present in CEO/leader engagement framing in 2026 findings."; break }
    '^Bring Home the Mission / Impact$' { $status = "🟡 Partially Supported"; $note = "Mission framing is present, though fewer concrete mission-immersion examples in 2026."; break }
    '^Make the Mission Yours$' { $status = "🟡 Partially Supported"; $note = "Directionally true; explicit custom mission rituals are less evidenced in 2026 set."; break }
    '^Tap Into Family Identity & Relationships$' { $status = "❌ Not Supported"; $note = "This specific family-identity mechanism is not clearly evidenced in the 2026 staff interviews."; break }
    '^Not Everyone Is a Salesperson$' { $status = "🟡 Partially Supported"; $note = "Recruiting/asking difficulty remains true, but direct persona split is less explicit."; break }
    '^Chair Alongside Me$' { $status = "❌ Not Supported"; $note = "Co-chair tactic is not directly surfaced in the 2026 output."; break }
    '^Host Salons / Social Dinners$' { $status = "❌ Not Supported"; $note = "Specific salon/dinner tactic not evidenced in new findings."; break }
    '^Different Chairs, Different Approaches$' { $status = "✅ Supported"; $note = "Variation in leader style/approach remains a recurring theme."; break }

    '^The Right Chair Is Key$' { $status = "✅ Supported"; $note = "Strongly supported by continued focus on ELT/chair quality and fit."; break }
    '^Set Clear Expectations$' { $status = "✅ Supported"; $note = "Very strongly supported: role confusion and need for clearer agendas/job aids."; break }
    '^Be Flexible, But Don.*t Settle$' { $status = "🟡 Partially Supported"; $note = "Quality-vs-speed tension appears, though explicit phrase is less direct in 2026 set."; break }
    '^Find Their Why$' { $status = "✅ Supported"; $note = "Mission-first framing remains a key recruitment mechanism."; break }
    '^Relationships, Not Transactions$' { $status = "✅ Supported"; $note = "Personal/volunteer connectors and relationship-led asks are repeatedly supported."; break }
    '^Show Them How They Make an Impact$' { $status = "🟡 Partially Supported"; $note = "Impact framing remains important, but fewer concrete impact-conversion examples."; break }
    '^Make It Easy for the Volunteer$' { $status = "✅ Supported"; $note = "Still true via clear asks, better materials, and simpler process demands."; break }
    '^Make It Feel Easier to Ask$' { $status = "✅ Supported"; $note = "Still true; confidence and structure for asks remains a live issue."; break }
    '^Get Out From Behind the Computer$' { $status = "🟡 Partially Supported"; $note = "Relationship/networking emphasis implies this, but explicit field-activity contrast is limited."; break }
    '^Showing New Staff the Way$' { $status = "✅ Supported"; $note = "Strong support from onboarding/training gaps identified in 2026 outputs."; break }
    '^Tactics to Make the Connection$' { $status = "✅ Supported"; $note = "Supported via volunteer connectors, LinkedIn/network prospecting, and cross-market outreach."; break }
    '^Always Bring a Volunteer to the Meeting$' { $status = "🟡 Partially Supported"; $note = "Volunteer-led asks are supported, though this exact tactic is not consistently explicit."; break }
    '^Leverage Existing Events$' { $status = "🟡 Partially Supported"; $note = "Directionally plausible, but sparse direct evidence in current wave."; break }
    '^Tap Into Existing Volunteers$' { $status = "✅ Supported"; $note = "Strongly supported through connector/legacy-network themes."; break }
    '^Think Long-Term$' { $status = "✅ Supported"; $note = "Supported by pipeline/prospecting references and multi-year chair planning constraints."; break }
    '^Leadership Recruitment Committee$' { $status = "🟡 Partially Supported"; $note = "Committee-like coordination implied, but explicit structure not strongly evidenced."; break }
    '^Some Markets Are in a Hole$' { $status = "🟡 Partially Supported"; $note = "Resource/political instability themes support risk unevenness across markets."; break }

    '^What.*Different Post-COVID\?$' { $status = "❌ Not Supported"; $note = "2026 report does not directly isolate post-COVID causal effects."; break }
    '^SWOT Snapshot$' { $status = "✅ Supported"; $note = "SWOT framing still fits; strengths/constraints/opportunities are well represented."; break }
    '^Mapping the Process \(Simplified\)$' { $status = "✅ Supported"; $note = "Process clarity gap is one of the clearest 2026 signals."; break }
    '^We Already Know What Works$' { $status = "🟡 Partially Supported"; $note = "Some known tactics persist, but operational execution remains inconsistent."; break }
    '^Staff . Why They Don.*t Ask$' { $status = "✅ Supported"; $note = "Supported via trust/clarity/time/resource barriers and uneven enablement."; break }
    '^CEOs . Why They Don.*t Say Yes$' { $status = "🟡 Partially Supported"; $note = "Some support via mission-framing and capacity constraints; direct CEO refusal diagnostics are thinner."; break }
    '^Key Behavioral Factors$' { $status = "✅ Supported"; $note = "Behavioral drivers (friction, confidence, social proof, identity) remain evident."; break }
    '^Levers of Change$' { $status = "✅ Supported"; $note = "Still strongly supported: structural clarity, emotional motivation, and relationship channels."; break }
    '^No Clarity = Hard$' { $status = "✅ Supported"; $note = "Very strong support from missing job aids/annotated agendas/onboarding fragmentation."; break }
    '^Clarity & Structure = Easy$' { $status = "✅ Supported"; $note = "Strong support: staff repeatedly request clearer process and standardized resources."; break }
    '^Focus the Week$' { $status = "🟡 Partially Supported"; $note = "Time/focus constraints are present; exact weekly-focus device not directly tested."; break }
    '^Clarity & Structure . What It Means$' { $status = "✅ Supported"; $note = "Directly aligned with 2026 findings about enablement and procedural consistency."; break }
    '^Transactional vs Emotional$' { $status = "✅ Supported"; $note = "Mission-vs-money framing remains explicit in new report."; break }
    '^Strengthen Emotional WHY$' { $status = "✅ Supported"; $note = "Strongly supported by mission-led engagement findings."; break }
    '^Business Identity vs Whole Person Identity$' { $status = "🟡 Partially Supported"; $note = "Identity nuance appears, but whole-person framework is not deeply surfaced."; break }
    '^Engage the Whole Person$' { $status = "🟡 Partially Supported"; $note = "Directionally true, but supporting detail is lighter in the current wave."; break }
    '^Tap Into Legacy Volunteers$' { $status = "✅ Supported"; $note = "Strongly supported by existing-volunteer/connector pipeline themes."; break }
    '^The Three Levers \(Summary\)$' { $status = "✅ Supported"; $note = "Still holds: structure, emotional motivation, and relational pathways remain central."; break }
  }

  return @{ status = $status; note = $note }
}

$lines = Get-Content -Path $source
$out = New-Object System.Collections.Generic.List[string]

$out.Add("# Chair/ELT Recruiting (2024) — Annotated vs 2026 Research")
$out.Add("")
$out.Add("> Legend: ✅ Supported | 🟡 Partially Supported | ❌ Not Supported/Not Comparable")
$out.Add("> Source for comparison: transcripts/app output/reporter/narrative-report-output.md")
$out.Add("")

$currentStatus = "🟡 Partially Supported"

foreach ($line in $lines) {
  $out.Add($line)

  if ($line -match "^##\s+(.+)$") {
    $heading = $Matches[1].Trim()
    if ($heading -notmatch "^--- Page ") {
      $assessment = Get-HeadingAssessment $heading
      $currentStatus = $assessment.status
      $note = $assessment.note
      $out.Add("")
      $out.Add("> **2026 Check:** $currentStatus — $note")
      $out.Add("")
    }
  }
  elseif ($line -match "^\*\s+") {
    $clean = $line.Substring(2)
    $out[$out.Count - 1] = "* [$currentStatus] $clean"
  }
}

Set-Content -Path $target -Value $out -Encoding UTF8
Write-Host "Annotated file created: $target"
