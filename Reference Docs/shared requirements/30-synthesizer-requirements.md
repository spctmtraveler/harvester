# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Extract concise insights from coded semantic blocks and preserve evidence linkage.

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
