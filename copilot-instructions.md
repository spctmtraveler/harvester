# AI Working Guide: Heart Walk Insight Engine (HWIE)

This repository implements the **Heart Walk Insight Engine (HWIE)** as a **relational evidence engine**. The system stores every sentence, tags with a controlled vocabulary, and derives insights from linked evidence. It is not a generic summarizer.

## 1. North Star

Build **Zero-Loss, Fully Traceable Synthesis**.

- Every source sentence must be represented in the data model.
- Every reported claim must trace back to specific sentence IDs and timestamps.

## 2. Required Reference Docs (Always Load)

For any change touching ingest, tagging, synthesis, reporting, prompts, or schema, always load:

- `Reference Docs/requirements.md`
- `Reference Docs/Heart Walk Systems Overview.md`
- `Reference Docs/Heart Walk Canonical Tag Library.md`

`Reference Docs/Heart Walk Machine.md` is retired and must not be used.

Priority if docs conflict:

1. `Reference Docs/requirements.md`
2. `Reference Docs/Heart Walk Canonical Tag Library.md`
3. `Reference Docs/Heart Walk Systems Overview.md`

## 3. Core Workflow (Jobs To Be Done)

1. Gatekeeper (Ingest)
- Input: transcript/markdown files.
- Output: `Sentence` rows with timestamps preserved and verbatim `raw_text`.
- Rule: do not silently drop text. Potential noise is tagged later.

2. Analyst (Sentence Coding)
- Input: sentence rows.
- Output per sentence:
  - one or more canonical tags via `SentenceTag`, or exactly one catch-all tag (`catch_miscellaneous` or `catch_irrelevant`)
  - `sentiment_score` (-2..+2)
  - flags: `is_problem`, `is_solution`, `is_explanation`, `is_workaround`
  - final disposition status

3. Synthesizer (Insight Extraction)
- Input: coded sentences.
- Output: `Insight` rows linked through `InsightSentence` with quote quality/support role.
- Rule: insights are derived artifacts backed by sentence-level evidence.

4. Reporter (Cited Output)
- Input: approved insights + sentence links.
- Output: report/deck copy where every claim has immediate evidence drill-down.

## 4. Data Model Expectations

Treat **Sentence** as the source of truth and **Insight** as derived.

- Required sentence-level outputs:
  - `sentence_id`, `interview_id`, `timestamp_block`, `raw_text`
  - `sentiment_score`
  - `is_problem`, `is_solution`, `is_explanation`, `is_workaround`
  - `review_status`
  - canonical tag links in `SentenceTag`
- Required insight-level outputs:
  - concise statement fields
  - boolean flags
  - sentence evidence links (`InsightSentence`) with `quote_rank` and `support_role`

## 5. Tagging Rules (Strict)

- Use only canonical tags from `Reference Docs/Heart Walk Canonical Tag Library.md`.
- `tag_key` is the authoritative output token.
- No invented tags.
- Every sentence must have at least one tag.
- Catch-all behavior:
  - `catch_miscellaneous` means relevant content not covered by canonical tags.
  - `catch_irrelevant` means not relevant to Heart Walk operations.
  - If either catch-all tag is used, it must be the only tag on that sentence.

Preflight checks before finalize:

- 0 invalid tags
- 0 untagged sentences
- 100% sentence disposition coverage (`finalized` or `needs_human_review`)

## 6. Context Handling

The AI must never fly blind. Before tagging/synthesis/reporting, ground decisions using:

- `Reference Docs/Heart Walk Systems Overview.md` for domain context
- `Reference Docs/Heart Walk Canonical Tag Library.md` for controlled vocabulary

When classification is ambiguous, add a short rationale and prefer canonical specificity over catch-all tags.

## 7. Implementation Preferences

When the stack is ambiguous, follow `Reference Docs/requirements.md`:

- existing SQL database
- relational joins for `SentenceTag` and `InsightSentence`

Design priorities:

- traceability first
- explicit, testable pipeline stages
- configurable prompts/taxonomy for reuse

## 8. Interaction Rules For AI Assistants

- Be explicit about which stage is being edited (Gatekeeper/Analyst/Synthesizer/Reporter).
- Ask targeted questions only when ambiguity blocks safe categorization or schema correctness.
- If requested work conflicts with strict coverage or canonical tagging rules, call it out before proceeding.

## 9. Minimal Completion Checklist

A change is not done unless all are true:

1. Report/insight output traces to sentence IDs and timestamps.
2. Sentence coverage is complete (no silent drops).
3. Tagging uses canonical tags only, with proper catch-all exclusivity.
4. Prompt/context includes Systems Overview + Canonical Tag Library.
5. Assumptions and tradeoffs are documented in-repo.
