# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)  
Last updated: 2026-02-20

Progress: **8/16 complete (50%)**

## Goal

Cluster coded semantic blocks into discrete insights with reliable persisted evidence links.

## Implementation Status

- [x] Ingest coded semantic block batches from `sentences` and `sentence_tags`.
- [x] Generate insight candidates using AI prompt + JSON schema parsing.
- [x] Validate evidence schema (`sentence_id`, `quote_rank`, `support_role`) before persistence.
- [x] Derive insight sentiment/flags from linked evidence sentence rows.
- [x] Expose editable prompt template in-app.
- [x] Provide queue controls and reset controls for synthesis outputs.
- [x] Provide smoke test UI and debug export tooling.
- [x] Record request/response diagnostics in API Traffic view.
- [ ] Reliably capture non-null `run_id` for each synthesis batch in `ai_runs`.
- [ ] Reliably finalize `ai_runs.status` from `running` to `completed` / `error`.
- [ ] Reliably retrieve inserted `insight_id` across proxy/stateless DB sessions.
- [ ] Guarantee `insight_sentences` links persist for all accepted insights.
- [ ] Enforce no orphan insights in persisted DB state.
- [ ] Enforce quote-strength requirement (`>=1 quote_rank >= 2`) in persisted DB state.
- [ ] Prevent empty-array (`[]`) loops from repeatedly recycling the same queue item.
- [ ] Complete end-to-end run on latest dataset with non-zero evidence links and no orphan defects.

## Known Open Defects (Current)

- `ai_runs` rows can remain `running` with missing run linkage in session telemetry.
- Insight rows can exist without `insight_sentences` links in latest failing runs.
- Reporter currently reads these rows as uncited/orphan insights and excludes them from claims.

## Hard Rules (Target State)

- Every persisted insight must have at least one persisted evidence link.
- Supporting evidence must only reference input `sentence_id` rows.
- Sentiment and boolean flags are derived from linked evidence rows.
- Evidence quality must preserve `quote_rank` and `support_role`.
