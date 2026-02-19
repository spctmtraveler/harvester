# Platform Data Model Requirements

Source: `Reference Docs/requirements.md` (v3.1)

## Required Tables

- `Interview`
- `Sentence`
- `Tag`
- `SentenceTag`
- `Insight`
- `InsightSentence`
- `AI_Run`

## Implementation Status

Progress: **13/16 complete (81%)**

- [x] Required table set exists across implemented apps (`Interview`, `Sentence`, `Tag`, `SentenceTag`, `Insight`, `InsightSentence`, `AI_Run`).
- [x] `Sentence` acts as durable source of truth.
- [x] `Insight` is derived from linked sentence evidence.
- [x] `SentenceTag` relation is many-to-many.
- [ ] Every sentence has at least 1 tag at all times (depends on runtime processing completeness).
- [x] `catch_miscellaneous` and `catch_irrelevant` are exclusive single-tag outcomes.
- [ ] 100% final completion rule is currently data-state dependent (not always true in active/incomplete runs).
- [x] `catch_irrelevant` implies all boolean flags are `false`.
- [x] AI prompts include Systems Overview context.
- [ ] Every AI prompt includes canonical tag dictionary (currently strict in Analyst prompt; not universal across all prompts).
- [x] AI prompts require strict JSON output schemas.
- [x] AI prompts include self-check rules.
- [x] Uses existing SQL DB helper stack.
- [x] Maintains relational joins for sentence-tag and insight-sentence linkage.
- [x] Supports queue/review lifecycle statuses (`unprocessed`, `queued`, `processed`, `finalized`, `needs_human_review`, `error`).
- [x] Supports audit logging via `ai_runs`.

## Source of Truth Rule

- `Sentence` is the durable source of truth.
- `Insight` is derived from linked semantic blocks stored in `Sentence`.

## Tagging Constraints

- `SentenceTag` is many-to-many.
- Every semantic block has at least 1 tag.
- `catch_miscellaneous` and `catch_irrelevant` are exclusive single-tag outcomes.

## Audit/Coverage

Sentence `review_status` enum:
- `unprocessed`
- `queued`
- `processed`
- `finalized`
- `needs_human_review`
- `error`

Completion rule:
- 100% of semantic blocks are `finalized` or explicitly queued in `needs_human_review`.
- If `catch_irrelevant` is assigned, all boolean flags must be `false`.

## Prompting Requirements

Every AI prompt includes:
1. Systems Overview context
2. Canonical Tag Dictionary
3. Strict JSON output schema
4. Self-checks (no missing IDs, no invalid tags)

## Implementation Notes

- Use the existing SQL DB.
- Maintain strict relational joins for sentence-tag and insight-sentence linkage.
