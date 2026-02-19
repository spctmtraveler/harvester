# Shared Core Requirements

Source: `Reference Docs/requirements.md` (v3.1)

## North Star

Zero-Loss, Fully Traceable Synthesis.

- Every claim and recommendation must be traceable to specific timestamped source semantic blocks.
- The system is an evidence database, not a summarizer.

## Implementation Status

Progress: **6/8 complete (75%)**

- [x] Every ingested semantic block becomes a durable DB row.
- [ ] Every semantic block ends in a final disposition (`finalized` or `needs_human_review`) at project completion.
- [x] Insights link to supporting blocks using relational joins.
- [x] Insight evidence is visible in-app for click-through review.
- [x] AI prompts include Heart Walk systems overview context.
- [ ] Every AI prompt includes canonical tag dictionary context where applicable.
- [x] Controlled vocabulary enforced for Analyst tagging.
- [x] Prompt/template text is user-editable in active coding apps.

## Core Mandates

1. Zero Loss / Full Coverage
- Every ingested semantic block becomes a durable DB row.
- Every semantic block must end in a final disposition.

2. Strict Traceability
- Insights must link to supporting semantic blocks using relational joins.
- Click-through from insight to source semantic blocks is required.

3. Context-Aware
- Every AI step must include:
  - `Reference Docs/Heart Walk Systems Overview.md`
  - `Reference Docs/Heart Walk Canonical Tag Library.md`

4. Controlled Vocabulary
- Only canonical tags are allowed.
- Relevant but unmatched content uses `catch_miscellaneous`.
- Non-relevant content uses `catch_irrelevant`.

5. Reusability
- Taxonomy and prompts should remain configurable for future projects.
