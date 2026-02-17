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

## Source of Truth Rule

- `Sentence` is the durable source of truth.
- `Insight` is derived from linked sentences.

## Tagging Constraints

- `SentenceTag` is many-to-many.
- Every sentence has at least 1 tag.
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
- 100% of sentences are `finalized` or explicitly queued in `needs_human_review`.
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
