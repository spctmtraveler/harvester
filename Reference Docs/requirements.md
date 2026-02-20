# HWIE Requirements v3.1 — Zero‑Loss Relational Evidence Engine (SQL DB)

## Current Implementation Snapshot (2026-02-20)

- [x] Job 1 Gatekeeper implemented (semantic block ingest + stable IDs + reset control)
- [x] Job 2 Analyst implemented (canonical coding + explanation requirement + editable prompt template)
- [x] Job 3 Synthesizer implemented at feature level (insight extraction UI + evidence-link model + debug tooling)
- [x] Job 4 Reporter Phase 1 implemented (plain text output + Designer JSON output + smoke tests + debug suite)
- [ ] Job 3 persistence hardening pending (known orphan-insight / missing-link failures in latest runs)
- [ ] Job 4 Phase 2 interactive trace explorer pending

See `Reference Docs/shared requirements/README.md` for per-app and overall completion percentages.

## North Star ⭐

**Zero‑Loss, Fully Traceable Synthesis.**

Transform raw interview transcripts into a rigorous research output where **every insight, claim, and recommendation is traceable to specific, timestamped source semantic blocks**.

We are not building a summarizer. We are building an **evidence database**.

---

## Core Mandates

1. **Zero Loss / Full Coverage**

* Every semantic block ingested becomes a row in the database.
* Every semantic block must end in a final disposition (tagged + flagged), so nothing is silently dropped.

2. **Strict Traceability**

* Every insight must link to supporting semantic blocks via a relational table.
* The system must support click-through from an insight to the exact source semantic blocks (with timestamps).

3. **Context-Aware**

* Every AI step includes **Heart Walk Systems Overview Context** and the **Canonical Tag Dictionary**.

4. **Controlled Vocabulary**

* Sentence topic tagging uses **only** canonical tags stored in the `tag` table.
* Anything relevant but not covered → `catch_miscellaneous`.
* Anything not relevant → `catch_irrelevant`.

5. **Reusability**

* Taxonomy + prompts should be configurable via JSON later.

---

## Data Model (Relational)

### A) Interview

Stores metadata about each interview.

* `interview_id` (PK)
* `interviewee_name`
* `date`
* `source_type` (`transcript` | `summary_only`)
* `source_file`

### B) Sentence (Source of Truth)

Stores *every* semantic block as a durable record.

* `sentence_id` (PK, e.g., `LV.001`, `SR.024.s`)
* `interview_id` (FK)
* `timestamp_block` (e.g., `00:12:33`)
* `speaker`
* `raw_text` (verbatim; never edited)
* `clean_text` (optional, conservative cleanup)
* `sentiment_score` (INT, range **-2..+2**)

  * `-2` strong negative
  * `-1` mild negative
  * `0` neutral
  * `+1` mild positive
  * `+2` strong positive
* `is_problem` (BOOL)
* `is_solution` (BOOL)
* `is_explanation` (BOOL)
* `is_workaround` (BOOL)
* `review_status` (ENUM; see Audit section)

### C) Tag (Canonical Vocabulary)

All allowed tags live here.

* `tag_id` (PK)
* `tag_key` (machine)
* `tag_name` (human)
* `category_key` (`roles`, `groups`, `meetings`, `tools_docs`, `actions`, `org_tags`, `catch_all`)
* `is_canonical` (BOOL; true)

### D) SentenceTag (Join)

Many-to-many links between semantic blocks and canonical tags.

* `sentence_id` (FK)
* `tag_id` (FK)

**Rules:**

* Each semantic block must have ≥1 tag.
* `catch_miscellaneous` and `catch_irrelevant` are **exclusive catch-alls**:

  * If either is used, it must be the **only** tag on that sentence.

### E) Insight (Derived)

An insight is a concise finding derived from one or more semantic blocks.

* `insight_id` (PK)
* `summary_plain` (one sentence, concise)
* `summary_long` (optional)
* `dominant_sentiment_score` (INT -2..+2) *(computed or stored)*
* `is_problem` (BOOL)
* `is_solution` (BOOL)
* `is_explanation` (BOOL)
* `is_workaround` (BOOL)
* `created_by_run_id` (FK to AI_Run)

Insight tagging rule:

* Insights are derived from linked semantic blocks and inherit topic semantics from their supporting tags.
* Do not invent separate non-canonical insight topic labels.

### F) InsightSentence (Join + QuoteRank)

Relational link between insights and supporting semantic blocks.

* `insight_id` (FK)
* `sentence_id` (FK)
* `quote_rank` (TINYINT 0..3)

  * `0` = don’t use as quote
  * `1` = ok if necessary
  * `2` = good
  * `3` = great (ideal pull quote)
* `support_role` (ENUM: `direct_quote`, `evidence`, `context`, `counterpoint`)
* `notes` (optional)

### G) AI_Run (Reproducibility)

Tracks model/prompt/schema versions for each batch operation.

* `run_id` (PK)
* `purpose` (`tag_sentences`, `score_sentiment`, `extract_insights`, `cluster_insights`, etc.)
* `model_name`
* `prompt_version_id`
* `input_sentence_ids` (stored as JSON or separate table)
* `output_json` (raw)
* `status`
* `created_at`

---

## Audit & Coverage Requirements (Non-Negotiable)

### Sentence `review_status` enum

* `unprocessed`
* `queued`
* `processed`
* `finalized` *(tags + flags + sentiment assigned)*
* `needs_human_review`
* `error`

**Coverage rule:** You cannot consider an interview “done” until:

* 100% of its semantic blocks are `finalized` (or explicitly `needs_human_review` with a queue).
* If a block is tagged `catch_irrelevant`, all four booleans (`is_problem`, `is_solution`, `is_explanation`, `is_workaround`) must be `false`.

---

## Agent Workflow (Jobs to be Done)

### Job 1: Gatekeeper (Ingest)

**Input:** raw transcript/markdown.
**Output:** semantic block rows in DB.

Requirements:

* Preserve timestamps as blocks (carry forward within section).
* Store verbatim text as `raw_text`.
* Optionally store conservative cleanup as `clean_text`.
* Do **not delete** filler/noise; instead, allow `irrelevant` tagging later.

### Job 2: Analyst (Semantic Block Coding)

**Input:** semantic block rows.
**Output:** for every semantic block:

* 1+ canonical tags (or exclusive `catch_miscellaneous`/`catch_irrelevant`)
* sentiment_score (-2..+2)
* boolean flags (problem/solution/explanation/workaround)
* explanation field (required, <=30 words)

Hard constraints:

* Use only tags from `tag` table.
* Every semantic block must be output exactly once.
* Self-check counts and invalid tags before commit.

### Job 3: Synthesizer (Insight Extraction)

**Input:** coded semantic blocks.
**Output:** insights + evidence links.

Requirements:

* Create discrete insights with concise statements.
* For each insight, populate `InsightSentence` links.
* Assign `quote_rank` (0–3) per linked semantic block.
* Compute or assign `dominant_sentiment_score` from supporting semantic blocks (math allowed).

### Job 4: Reporter (Cited Output)

**Input:** approved insights.
**Output:** report/deck copy where each claim can show its supporting semantic block set instantly.

---

## Sentiment Math (Guideline)

Semantic block sentiment uses -2..+2.

For an insight:

* Default computation: **rounded mean** of supporting semantic block sentiment scores.
* Optionally weight by `quote_rank` (e.g., 0,1,2,3 weights) when computing dominant sentiment.

---

## Prompting Requirements

Every AI prompt must include:

1. **Heart Walk Systems Overview Context** (system overview; sourced from `Reference Docs/Heart Walk Systems Overview.md`)
2. **Canonical Tag Dictionary** (allowed tags)
3. Strict output schema (JSON)
4. A required self-check section (no missing IDs, no invalid tags)

Additionally, app UIs should expose visible, editable prompt/template text before and during processing.

---

## Implementation Notes

* Database: **Existing SQL DB** (not SQLite).
* Tagging is strictly relational:

  * `SentenceTag(sentence_id, tag_id)`
  * `InsightSentence(insight_id, sentence_id, quote_rank, support_role)`

---

## Open Items (Explicit)

* Decide whether to store `input_sentence_ids` in `AI_Run` as JSON or normalized table.
* Decide whether `dominant_sentiment_score` is computed on read or stored on write.
* Decide whether to store additional optional fields later (confidence scores, multi-speaker normalization).
