# Reporter Requirements (Job 4)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Generate report/deck outputs where every claim can immediately resolve to supporting sentence evidence.

## Inputs

- Approved `Insight` rows
- `InsightSentence` links to source sentences

## Outputs

- Markdown/report/deck copy with explicit citation linkage
- Fast evidence drill-down from claim -> insight -> sentence -> timestamp

## Hard Rules

- No uncited claims.
- Preserve traceability path in output formatting and IDs.
- Respect sentence-level evidence hierarchy via `quote_rank` and `support_role`.
