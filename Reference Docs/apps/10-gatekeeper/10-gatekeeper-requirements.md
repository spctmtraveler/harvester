# Gatekeeper Requirements (Job 1)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Ingest transcript/markdown files into durable sentence rows without data loss.

## Inputs

- [ ] Support ingest from raw transcript/markdown (`.txt`, `.md`)
- [ ] Capture interview metadata (`interviewee_name`, `date`, `source_type`, `source_file`) into `Interview`

## Outputs

- [ ] Create `Sentence` rows for every sentence in the input (no drops)
- [ ] Persist verbatim source text to `Sentence.raw_text` (never edited)
- [ ] Optionally compute conservative `Sentence.clean_text` (no semantic rewrite)
- [ ] Extract or infer `Sentence.timestamp_block` and carry forward within a section when needed
- [ ] Extract `Sentence.speaker` when present (otherwise leave null/empty)
- [ ] Assign stable `Sentence.sentence_id` (document the ID scheme)
- [ ] Link each `Sentence` to `Interview` via `Sentence.interview_id`
- [ ] Initialize `Sentence.review_status` to `unprocessed` (or your chosen initial enum value)

## Hard Rules

- [ ] Preserve timestamps; carry forward within section if required
- [ ] Do not delete filler/noise at ingest time (tagging handles relevance later)
- [ ] No silent drops: every sentence ends up as a durable DB row
- [ ] Exactly-once semantics per ingest run (prevent accidental duplicates)
- [ ] Never modify `raw_text` after initial insert

## Validation / Smoke Tests

- [ ] Ingest test: `Sentence` count matches parsed sentence count for a file
- [ ] Coverage test: every parsed sentence has a `sentence_id` and `interview_id`
- [ ] Timestamp test: verify timestamp carry-forward works for blocks (no unintended null defaults)
- [ ] Raw-text test: `raw_text` matches the original verbatim text for random samples
- [ ] Idempotency test: re-ingesting the same file does not create duplicate sentence rows
