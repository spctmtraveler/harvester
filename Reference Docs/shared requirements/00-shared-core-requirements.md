# Shared Core Requirements

Source: `Reference Docs/requirements.md` (v3.1)

## North Star

Zero-Loss, Fully Traceable Synthesis.

- Every claim and recommendation must be traceable to specific timestamped source sentences.
- The system is an evidence database, not a summarizer.

## Core Mandates

1. Zero Loss / Full Coverage
- Every ingested sentence becomes a durable DB row.
- Every sentence must end in a final disposition.

2. Strict Traceability
- Insights must link to supporting sentences using relational joins.
- Click-through from insight to source sentences is required.

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
