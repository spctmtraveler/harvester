# Requirements Split Index

This folder splits `Reference Docs/requirements.md` into focused documents by app/stage.

The original file is preserved as backup and remains the single full-source reference.

## Files

- `00-shared-core-requirements.md`
- `01-platform-data-model-requirements.md`
- `10-gatekeeper-requirements.md`
- `20-analyst-requirements.md`
- `30-synthesizer-requirements.md`
- `40-reporter-requirements.md`

## Suggested usage

1. Read `00-shared-core-requirements.md` first.
2. Read `01-platform-data-model-requirements.md` for schema/audit/prompting constraints.
3. Read the app-specific file for the stage you are implementing.

## Note

To avoid drift, update `Reference Docs/requirements.md` first, then sync these split docs.
