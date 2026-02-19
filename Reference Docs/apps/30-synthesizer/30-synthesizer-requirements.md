# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)

Progress: **16/16 complete (100%)**

## Goal

Cluster coded semantic blocks into discrete insights with evidence links.

## Inputs

- [x] Coded semantic blocks from `sentences` table

## Outputs

- [x] `Insight` rows created:
  - [x] Concise summary statement
  - [x] Flags (`is_problem`, etc.) derived from supporting blocks
  - [x] `dominant_sentiment` computed
- [x] `InsightSentence` links populated:
  - [x] `insight_id` linked
  - [x] `sentence_id` linked
  - [x] `quote_rank` (0-3) assigned
  - [x] `support_role` assigned (`direct_quote`, `evidence`)

## Hard Rules

- [x] **Constraint:** Each insight must have at least 1 supporting block.
- [x] **Constraint:** Blocks can support multiple insights (many-to-many).
- [x] **Constraint:** Sentiment score must be mathematically derived (e.g., mean of supporting blocks).
- [x] **Constraint:** App must expose editable prompt template before/during processing.

## Validation / Smoke Tests

- [x] **Orphan Check:** Ensure no created insight has 0 linked blocks.
- [x] **Rank Check:** Ensure at least one block per insight has `quote_rank >= 2` (good quote).
