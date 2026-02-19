# Reporter Requirements (Job 4)

Source: `Reference Docs/requirements.md` (v3.1)

Progress: **0/17 complete (0%)**

## Goal

Generate a cited report/slide deck from approved insights.

## Inputs

- [ ] `Insight` rows with `review_status='finalized'`
- [ ] Linked semantic block rows for quotes

## Outputs

- [ ] Markdown Report / Slide Copy
- [ ] Structure organized by Taxonomy Categories
- [ ] Sections for:
  - [ ] Problems
  - [ ] Solutions
  - [ ] Mechanisms / Explanation
- [ ] Citations included:
  - [ ] Quote text
  - [ ] Source file name
  - [ ] Timestamp link

## Hard Rules

- [ ] **Constraint:** Every claim must have a citation link.
- [ ] **Constraint:** Do not hallucinate findings not in the DB.
- [ ] **Constraint:** Use `quote_rank` to select the best evidence for the report.
- [ ] **Constraint:** App must expose editable prompt template before/during processing.

## Validation / Smoke Tests

- [ ] **Citation Audit:** Verify every bullet point has a `(Source: ...)` suffix.
- [ ] **Link Check:** Verify timestamps match the source DB.
