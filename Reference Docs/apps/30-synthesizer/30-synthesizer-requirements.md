# Synthesizer Requirements (Job 3)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Cluster coded semantic blocks into discrete insights with evidence links.

## Inputs

- [ ] Coded semantic blocks from `sentences` table

## Outputs

- [ ] `Insight` rows created:
  - [ ] Concise summary statement
  - [ ] Flags (`is_problem`, etc.) derived from supporting blocks
  - [ ] `dominant_sentiment` computed
- [ ] `InsightSentence` links populated:
  - [ ] `insight_id` linked
  - [ ] `sentence_id` linked
  - [ ] `quote_rank` (0-3) assigned
  - [ ] `support_role` assigned (`direct_quote`, `evidence`)

## Hard Rules

- [ ] **Constraint:** Each insight must have at least 1 supporting block.
- [ ] **Constraint:** Blocks can support multiple insights (many-to-many).
- [ ] **Constraint:** Sentiment score must be mathematically derived (e.g., mean of supporting blocks).
- [ ] **Constraint:** App must expose editable prompt template before/during processing.

## Validation / Smoke Tests

- [ ] **Orphan Check:** Ensure no created insight has 0 linked blocks.
- [ ] **Rank Check:** Ensure at least one block per insight has `quote_rank >= 2` (good quote).
