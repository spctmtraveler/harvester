# Analyst Requirements (Job 2)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Code every semantic block using canonical tags, sentiment, and boolean flags.

## Inputs

- [ ] Uncoded or partially coded semantic block rows (stored in `Sentence` table)

## Outputs (Per Block)

- [ ] 1+ canonical tags assigned via `SentenceTag`
- [ ] Exclusive `catch_miscellaneous` / `catch_irrelevant` handled correctly
- [ ] `sentiment_score` assigned (-2..+2)
- [ ] `explanation` assigned (required, <=30 words)
- [ ] Boolean flags populated:
  - [ ] `is_problem`
  - [ ] `is_solution`
  - [ ] `is_explanation`
  - [ ] `is_workaround`
- [ ] Updated `review_status` to `finalized`

## Hard Rules

- [ ] **Constraint:** Use only canonical tags from the tag library.
- [ ] **Constraint:** No invented tags.
- [ ] **Constraint:** Every block is output exactly once.
- [ ] **Constraint:** Run self-checks for missing block IDs and invalid tags before commit.
- [ ] **Constraint:** If block tag is `catch_irrelevant`, all flags must be `false`.
- [ ] **Constraint:** Every tagged block includes a concise explanation (<=30 words).
- [ ] **Constraint:** App must expose editable prompt template before/during processing.

## Validation / Smoke Tests

- [ ] **Tag Validity Test:** Ensure stored tags exist in `tags` table.
- [ ] **Completeness Test:** Verify `count(output_blocks) == count(input_blocks)`.
- [ ] **Explanation Test:** Ensure explanation exists for all tagged blocks and is <=30 words.

