# Reporter Requirements (Job 4)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Generate report/deck outputs where every claim can immediately resolve to supporting sentence evidence.

## Implementation Status

Progress: **0/7 complete (0%)**

- [ ] Read approved `Insight` rows and linked `InsightSentence` evidence.
- [ ] Generate markdown/report/deck output with explicit citations.
- [ ] Support fast drill-down claim → insight → sentence → timestamp.
- [ ] Enforce no uncited claims.
- [ ] Preserve traceability path in output formatting and IDs.
- [ ] Respect evidence hierarchy (`quote_rank`, `support_role`).
- [ ] Expose editable prompt/template before/during report generation.

## Inputs

- Approved `Insight` rows
- `InsightSentence` links to source sentences

## Outputs

- Markdown/report/deck copy with explicit citation linkage
- Fast evidence drill-down from claim -> insight -> sentence -> timestamp

## Hard Rules

- No uncited claims.
- Preserve traceability path in output formatting and IDs.
- Respect semantic-block evidence hierarchy via `quote_rank` and `support_role`.
