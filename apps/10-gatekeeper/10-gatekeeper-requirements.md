# Gatekeeper Requirements (Job 1)

Source: `Reference Docs/requirements.md` (v3.1)

Progress: **19/20 complete (95%)**

## Goal

Ingest transcript/markdown files into durable semantic block rows without data loss.

## Inputs

- [x] Support ingest from raw transcript/markdown (`.txt`, `.md`)
- [x] Capture interview metadata (`interviewee_name`, `date`, `source_type`, `source_file`) into `Interview`

## Outputs

- [x] Create `Sentence` rows for every semantic block in the input (no drops)
- [x] Persist verbatim source text to `Sentence.raw_text` (never edited)
- [x] Optionally compute conservative `Sentence.clean_text` (no semantic rewrite)
- [x] Extract or infer `Sentence.timestamp_block` and carry forward within a section when needed
- [x] Extract `Sentence.speaker` when present (otherwise leave null/empty)
- [x] Assign stable `Sentence.sentence_id` (document the ID scheme)
- [x] Link each `Sentence` to `Interview` via `Sentence.interview_id`
- [x] Initialize `Sentence.review_status` to `unprocessed` (or your chosen initial enum value)

## Hard Rules

- [x] Preserve timestamps; carry forward within section if required
- [x] Do not delete filler/noise at ingest time (tagging handles relevance later)
- [x] No silent drops: every semantic block ends up as a durable DB row
- [x] Exactly-once semantics per ingest run (prevent accidental duplicates)
- [x] Never modify `raw_text` after initial insert

## Validation / Smoke Tests

- [x] Ingest test: `Sentence` count matches parsed semantic block count for a file
- [x] Coverage test: every parsed semantic block has a `sentence_id` and `interview_id`
- [x] Timestamp test: verify timestamp carry-forward works for blocks (no unintended null defaults)
- [ ] Raw-text test: `raw_text` matches the original verbatim text for random samples
- [x] Idempotency test: re-ingesting the same file does not create duplicate sentence rows
