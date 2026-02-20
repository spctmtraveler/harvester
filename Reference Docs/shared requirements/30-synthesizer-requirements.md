# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)  
Last updated: 2026-02-20

## Goal

Extract concise insights from coded semantic blocks and preserve reliable evidence linkage.

## Implementation Status

Progress: **4/8 complete (50%)**

- [x] Ingest coded semantic block rows from `Sentence` + `SentenceTag`.
- [x] Create `Insight` rows with concise summaries.
- [ ] Reliably create `InsightSentence` evidence links for every accepted insight.
- [ ] Reliably persist `quote_rank` (0..3) on evidence links.
- [ ] Reliably persist `support_role` on evidence links.
- [x] Compute/store dominant sentiment from supporting blocks.
- [ ] Enforce evidence-backed persistence (no orphan insights in DB state).
- [x] Ground insight topics on supporting block tags (no independent non-canonical topic system).

## Current Caveat

Latest observed runs show orphan insight persistence and missing evidence links; this blocks fully cited downstream reporting until fixed.
