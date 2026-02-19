# Gatekeeper (Job 1)

This app ingests transcript/markdown files into the Auto-DB system as durable `Interview` + `Sentence` rows.

## How to run

- Open `index.html` in a browser.

## ID scheme (deterministic)

- You choose a 2-letter `interviewee_code` per file (defaults from filename).
- The app derives:
  - `interview_id`: deterministic from `interviewee_code` + filename (stable across re-ingest)
  - `interview_prefix`: used in `sentence_id` and starts with the 2-letter code
- `sentence_id` format:
  - `{interview_prefix}.{NNNN}` (e.g. `LV.1A2B.0001`)
- Stability:
  - Each extracted sentence also gets a `sentence_uid` hash based on `(interview_id, timestamp, speaker, raw_text)`.
  - On re-ingest, existing `sentence_uid` rows reuse the same `sentence_id` and are not duplicated.

