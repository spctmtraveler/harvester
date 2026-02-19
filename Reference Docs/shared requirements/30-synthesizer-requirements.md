# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Extract concise insights from coded semantic blocks and preserve evidence linkage.

## Implementation Status

Progress: **8/8 complete (100%)**

- [x] Ingests coded semantic block rows from `Sentence` + `SentenceTag`.
- [x] Creates `Insight` rows with concise summaries.
- [x] Creates `InsightSentence` evidence links.
- [x] Stores `quote_rank` (0..3) for evidence quality.
- [x] Stores `support_role` for evidence semantics.
- [x] Computes/stores dominant sentiment from supporting blocks.
- [x] Enforces evidence-backed insights (no orphan insights).
- [x] Prevents non-canonical topic invention by grounding on supporting block tags.

## Inputs

- Coded semantic block rows in `Sentence` + `SentenceTag`

## Outputs

- `Insight` rows with concise summaries
- `InsightSentence` links for evidence
- `quote_rank` per linked block (0..3)
- `support_role` per linked block (`direct_quote`, `evidence`, `context`, `counterpoint`)
- `dominant_sentiment_score` computed or stored

## Hard Rules

- Every insight must be evidence-backed by block links.
- Insight topic semantics come from supporting block tags.
- Do not invent separate non-canonical insight labels.
