# Requirements Split Index

This folder splits `Reference Docs/requirements.md` into focused documents by app/stage.

The original file is preserved as backup and remains the single full-source reference.

## Files

- `00-shared-core-requirements.md`
- `01-platform-data-model-requirements.md`
- `30-synthesizer-requirements.md`
- `40-reporter-requirements.md`

App-specific requirement files live under:

- `Reference Docs/apps/10-gatekeeper/10-gatekeeper-requirements.md`
- `Reference Docs/apps/20-analyst/20-analyst-requirements.md`
- `Reference Docs/apps/30-synthesizer/30-synthesizer-requirements.md`
- `Reference Docs/apps/40-reporter/40-reporter-requirements.md`

## Progress Dashboard

Status source: checkbox totals in app requirement files.

| Scope | Done | Total | Percent |
|---|---:|---:|---:|
| Gatekeeper (Job 1) | 19 | 20 | 95% |
| Analyst (Job 2) | 21 | 21 | 100% |
| Synthesizer (Job 3) | 8 | 16 | 50% |
| Reporter (Job 4) | 24 | 28 | 86% |
| **Project Overall** | **72** | **85** | **85%** |

## Suggested usage

1. Read `00-shared-core-requirements.md` first.
2. Read `01-platform-data-model-requirements.md` for schema/audit/prompting constraints.
3. Read the app-specific file for the stage you are implementing.

## Note

To avoid drift, update `Reference Docs/requirements.md` first, then sync these split docs.
