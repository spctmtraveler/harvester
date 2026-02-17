# Analyst Requirements (Job 2)

Source: `Reference Docs/requirements.md` (v3.1)

## Goal

Code every sentence using canonical tags, sentiment, and boolean flags.

## Inputs

- [ ] Uncoded or partially coded `Sentence` rows

## Outputs (Per Sentence)

- [ ] 1+ canonical tags assigned via `SentenceTag`
- [ ] Exclusive `catch_miscellaneous` / `catch_irrelevant` handled correctly
- [ ] `sentiment_score` assigned (-2..+2)
- [ ] Boolean flags populated:
  - [ ] `is_problem`
  - [ ] `is_solution`
  - [ ] `is_explanation`
  - [ ] `is_workaround`
- [ ] Updated `review_status` to `finalized`

## Hard Rules

- [ ] **Constraint:** Use only canonical tags from the tag library.
- [ ] **Constraint:** No invented tags.
- [ ] **Constraint:** Every sentence is output exactly once.
- [ ] **Constraint:** Run self-checks for missing sentence IDs and invalid tags before commit.
- [ ] **Constraint:** If sentence tag is `catch_irrelevant`, all flags must be `false`.

## Validation / Smoke Tests

- [ ] **Tag Validity Test:** Ensure stored tags exist in `tags` table.
- [ ] **Completeness Test:** Verify `count(output_sentences) == count(input_sentences)`.

