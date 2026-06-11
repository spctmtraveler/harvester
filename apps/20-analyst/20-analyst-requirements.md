# Analyst Requirements (Job 2)

Source: `Reference Docs/requirements.md` (v3.1)

Progress: **21/21 complete (100%)**

## Goal

Code every semantic block using canonical tags, sentiment, and boolean flags.

## Inputs

- [x] Uncoded or partially coded semantic block rows (stored in `Sentence` table)

## Outputs (Per Block)

- [x] 1+ canonical tags assigned via `SentenceTag`
- [x] Exclusive `catch_miscellaneous` / `catch_irrelevant` handled correctly
- [x] `sentiment_score` assigned (-2..+2)
- [x] `explanation` assigned (required, <=30 words)
- [x] Boolean flags populated:
  - [x] `is_problem`
  - [x] `is_solution`
  - [x] `is_explanation`
  - [x] `is_workaround`
- [x] Updated `review_status` to `finalized`

## Hard Rules

- [x] **Constraint:** Use only canonical tags from the tag library.
- [x] **Constraint:** No invented tags.
- [x] **Constraint:** Every block is output exactly once.
- [x] **Constraint:** Run self-checks for missing block IDs and invalid tags before commit.
- [x] **Constraint:** If block tag is `catch_irrelevant`, all flags must be `false`.
- [x] **Constraint:** Every tagged block includes a concise explanation (<=30 words).
- [x] **Constraint:** App must expose editable prompt template before/during processing.

## Validation / Smoke Tests

- [x] **Tag Validity Test:** Ensure stored tags exist in `tags` table.
- [x] **Completeness Test:** Verify `count(output_blocks) == count(input_blocks)`.
- [x] **Explanation Test:** Ensure explanation exists for all tagged blocks and is <=30 words.

