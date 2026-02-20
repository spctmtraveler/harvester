# Reporter Requirements (Job 4)

Source: `Reference Docs/requirements.md` (v3.1)  
Last updated: 2026-02-20

## Goal

Generate cited report outputs where each claim resolves to supporting sentence evidence, and export the same substance in Designer JSON format.

## Implementation Status

Progress: **11/12 complete (92%)**

- [x] Read `insights` rows and linked `insight_sentences` evidence.
- [x] Generate plain-text narrative report output (complete sentences) with explicit citations.
- [x] Generate Designer-importable JSON output (`config` + `slides`) using the same report substance.
- [x] Enforce no uncited claims in both output formats.
- [x] Preserve traceability path claim -> insight -> sentence -> timestamp/source.
- [x] Respect evidence hierarchy (`quote_rank`, `support_role`) when selecting support.
- [x] Keep plain-text and Designer JSON outputs content-equivalent.
- [x] Validate cited sentence IDs resolve in DB.
- [x] Validate Designer JSON shape before export.
- [x] Add API/debug observability (traffic view + debug bundle export).
- [x] Track interactive trace/drill-down UX as deferred phase.
- [ ] Deliver interactive trace/drill-down UX implementation (deferred to Phase 2).

## Inputs

- `insights` rows
- `insight_sentences` links to source `sentences`

## Outputs

- Plain-text report copy with explicit citation linkage
- Designer-compatible deck JSON payload
- Deferred (Phase 2): interactive evidence drill-down view

## Hard Rules

- No uncited claims.
- Preserve traceability path in output formatting and IDs.
- Respect semantic-block evidence hierarchy via `quote_rank` and `support_role`.
