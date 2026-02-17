# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Extract concise insights from coded sentences and preserve evidence linkage.

## Inputs

- Coded `Sentence` rows + `SentenceTag`

## Outputs

- `Insight` rows with concise summaries
- `InsightSentence` links for evidence
- `quote_rank` per linked sentence (0..3)
- `support_role` per linked sentence (`direct_quote`, `evidence`, `context`, `counterpoint`)
- `dominant_sentiment_score` computed or stored

## Hard Rules

- Every insight must be evidence-backed by sentence links.
- Insight topic semantics come from supporting sentence tags.
- Do not invent separate non-canonical insight labels.
