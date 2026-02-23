# Designer Requirements (Job 5)

Source:
- `Reference Docs/apps/50-designer/designer requirements.md` (v3.4 usage guide)
- `Reference Docs/apps/40-reporter/40-reporter-requirements.md` (Designer JSON contract dependencies)
- `Reference Docs/requirements.md` (pipeline-level constraints)

Last updated: 2026-02-23

Progress: **29/29 complete (100%)**

> Status reflects currently documented behavior in the Designer usage guide and linked app requirements. Use this checklist as the tracking baseline for implementation + validation.

## Goal

Render, edit, import, and export publication-ready Heart Walk slide decks with stable JSON schema compatibility and reliable PPTX output.

## Scope

Phase 1 (Now):
- Browser-based deck editing workflow
- JSON import/export with schema sanitation
- Field modes (`text`, `image`, `quote`) across supported slide types
- PPTX export fidelity
- Reporter-to-Designer handoff compatibility

Phase 2 (Now):
- AI image generation and image workflow enhancements
- Anonymous / hide attribution toggle

## Inputs

- [x] JSON with top-level `config` and `slides`
- [x] Reporter-produced slide payloads using Designer field schema
- [x] Legacy JSON payloads missing newer fields (auto-migration path)

## Outputs

- [x] Editable in-browser deck state persisted via local storage
- [x] Exportable JSON preserving deck structure and field data
- [x] Exportable `.pptx` file via PptxGenJS

## Slide + Field Schema Requirements

- [x] Support slide type `cover`
- [x] Support slide type `section`
- [x] Support slide type `standard`
- [x] Support slide type `two-column`
- [x] Enforce/expect standard-slide `bodyField` object
- [x] Enforce/expect two-column `columns` object with `leftField` and `rightField`
- [x] Support field mode `text`
- [x] Support field mode `image`
- [x] Support field mode `quote`
- [x] Respect `imagePrompt` as hint text in empty image fields
- [x] Preserve/round-trip `imageAlign` values (`center`, `left`, `right`, `top`, `bottom`)
- [x] Keep `two-column` split percentage constrained to 20–80 and persisted

## Editing UX Requirements

- [x] Icon-only hover mode selector for field mode switching
- [x] Markdown authoring support in text mode
- [x] Quote field with editable quote body + attribution
- [x] Drag/drop + picker + URL image intake in image mode
- [x] Edge-click image alignment snapping
- [x] Hide Quote Attributions toggle (global setting, preserves data, respects PPT export)
- [x] 3-level positioning model: Global / Template / Local nudging
- [x] Keyboard/context interactions (`Ctrl+Click`, `Ctrl+Arrow`, right-click shape menu)

## Import Robustness + Compatibility

- [x] Default missing slide `type` to `standard`
- [x] Auto-create missing `bodyField` from legacy `content`
- [x] Auto-migrate legacy slides lacking `bodyField`/`columns`
- [x] Preserve unknown/unexpected JSON fields during import-export cycles
- [x] Report sanitizer corrections to the user (toast/notice path)
- [x] Keep Reporter compatibility for allowed slide types (`cover`, `section`, `standard`, `two-column`)

## Export + Infrastructure Requirements

- [x] PPTX export supports all active field modes
- [x] Upload images to `/harvester/api/image-store.php` when reachable
- [x] Fall back to data-URI image persistence when upload endpoint is unavailable

## Validation / Smoke Tests (Tracking)

- [x] JSON contract smoke test: import + export preserves required schema keys and slide types
- [x] Field-mode smoke test: each mode renders/editable on `standard` and `two-column` fields
- [x] PPTX smoke test: exported deck preserves title/body/quote/image content placement
- [x] Import sanitizer smoke test: malformed legacy payload auto-corrected without crash
- [x] Image upload smoke test: endpoint success path + fallback path both verified
- [x] Reporter handoff smoke test: Reporter JSON imports without manual patching

## Deferred / Open Items

- [x] AI image generation integration (via `generateImage()` in ailnl.js proxy)
- [x] Image prompt editing + regeneration workflow
- [x] Image version history management (per-field history stack, undo button, capped at 10)

## Hard Rules

- JSON import must be resilient: "accept everything, break nothing"
- Designer JSON must remain Reporter-compatible for field schema and slide types
- Unknown fields must not be destroyed during round-trip edits
- Deck export must remain possible even if image upload infrastructure is down (fallback required)
