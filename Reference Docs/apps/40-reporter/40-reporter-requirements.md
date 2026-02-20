# Reporter Requirements (Job 4)

Source: `Reference Docs/requirements.md` (v3.1)  
Last updated: 2026-02-20

Progress: **24/28 complete (86%)**

## Goal

Generate publication-ready reporter outputs from synthesized insights with strict claim-level traceability to source semantic blocks.

## Scope

Phase 1 (Now):
- Plain-text, human-readable report output
- Designer-compatible JSON output
- Strict evidence citation policy
- Debug and audit tooling

Phase 2 (Later):
- Interactive trace explorer
- Bidirectional claim <-> transcript linking

## Implementation Status

- [x] Produce plain-text report with complete-sentence narrative output.
- [x] Produce Designer-compatible JSON deck payload.
- [x] Ensure both outputs carry explicit claim-level evidence citations.
- [x] Read `insights` rows from DB.
- [x] Read `insight_sentences` evidence links from DB.
- [x] Read `sentences` metadata (`timestamp_block`, `speaker`, `source_file`, `interview_id`).
- [ ] Use optional `interviews` metadata for source labeling (not implemented yet).
- [x] Include Executive Summary section in plain-text output.
- [x] Include Problems section in plain-text output.
- [x] Include Solutions section in plain-text output.
- [x] Include Mechanisms / Explanation section in plain-text output.
- [x] Include citation bundle per claim (`insight_id`, `sentence_id`, timestamp/source when available).
- [x] Export JSON with top-level `config` and `slides`.
- [x] Restrict slide `type` usage to Designer-supported values (`cover`, `section`, `standard`).
- [x] Keep plain-text and JSON content substantively equivalent.
- [x] Enforce no uncited claims in exported outputs (uncited insights excluded).
- [x] Enforce DB-backed evidence-only reporting (no generated claims without evidence links).
- [x] Prefer stronger evidence using `quote_rank` prioritization.
- [x] Preserve claim -> insight -> sentence trace path in output formatting.
- [x] Implement Citation Audit smoke test.
- [x] Implement Evidence Link Audit smoke test.
- [ ] Implement Quote Strength Audit smoke test (`>=1 quote_rank >= 2` when available) as explicit reporter test.
- [x] Implement Designer JSON shape smoke test.
- [x] Implement cross-output parity smoke test.
- [x] Add API Traffic monitor tab with upstream `ai_runs` visibility and session traffic logs.
- [x] Add full debug bundle download (counts, outputs, smoke summary, AI runs, API traffic, log history).
- [ ] Implement interactive trace explorer UI (deferred).
- [ ] Implement bidirectional linking between report claims and transcript/semantic block view (deferred).

## Hard Rules

- No uncited claims.
- Reporter uses only DB-backed evidence.
- Citation selection prefers higher `quote_rank`.
- Claim trace path stays explicit and machine-readable.
- Designer JSON must remain import-safe (`slides` required; valid `type` values).

## Notes

- Current output behavior intentionally excludes uncited insights instead of emitting uncited claims.
- Interactive trace UX is tracked but postponed to Phase 2.
