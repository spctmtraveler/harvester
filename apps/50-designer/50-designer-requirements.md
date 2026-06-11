# Designer Requirements (Job 5)

Source:
- `apps/50-designer/designer requirements.md` (v3.4 usage guide)
- `apps/40-reporter/40-reporter-requirements.md` (Designer JSON contract dependencies)
- `Reference Docs/requirements.md` (pipeline-level constraints)

Last updated: 2026-06-10

Progress: **35/35 complete (100%)**

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
- [x] Support slide type `image`
- [x] Support slide type `statement`
- [x] Support slide type `statement-image`
- [x] Support slide type `two-column`
- [x] Enforce/expect standard-slide `bodyField` object
- [x] Enforce/expect statement-slide `bodyField` object
- [x] Enforce/expect statement-image `imageField` object
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
- [x] On-demand top-bar slide type picker for both add-slide and convert-slide flows
- [x] Slide type conversion preserves non-visible layout data so users can switch back without losing prior fields

## Import Robustness + Compatibility

- [x] Default missing slide `type` to `standard`
- [x] Auto-create missing `bodyField` from legacy `content`
- [x] Auto-migrate legacy slides lacking `bodyField`/`columns`
- [x] Preserve unknown/unexpected JSON fields during import-export cycles
- [x] Preserve hidden `typeState` conversion data during import-export cycles
- [x] Report sanitizer corrections to the user (toast/notice path)
- [x] Keep Reporter compatibility for allowed slide types (`cover`, `section`, `standard`, `two-column`)

## Export + Infrastructure Requirements

- [x] PPTX export supports all active field modes
- [x] Upload images to `/harvester/api/image-store.php` when reachable
- [x] Fall back to data-URI image persistence when upload endpoint is unavailable

## Validation / Smoke Tests (Tracking)

- [x] JSON contract smoke test: import + export preserves required schema keys and slide types
- [x] Field-mode smoke test: each mode renders/editable on `standard` and `two-column` fields
- [x] Reversible conversion smoke test: convert away from a slide type and back without losing hidden target-specific fields
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
- Hidden conversion-only slide data must remain serialized so later reconversion can restore prior layouts
- Deck export must remain possible even if image upload infrastructure is down (fallback required)



## NOT REQUIREMENTS! JUST MUSING ON POSSIBLE FUTURE REQUIREMENTS. JUST IGNORE THIS SECTION ##


So, Designer is really becoming something bigger than what it started out as. Now it's evolving toward a tool where I can have AI agents be able to generate and edit PowerPoint documents (at least within a narrow range of options - like our brand pp deck template). It would be really great to be able to have an AI chat directly inside Designer where I could talk to it and ask it to do things like "Rewrite this slide to be more casual" or "break this slide into to slides" or "Please look through the deck and figure out where images would be helpful, then add them in (which would require adding the second column then writing an image prompt and triggering the generation). Or "please grammer and spell check this entire document" (it would just change the text, not actually flag what it did). Or "Bold all the vocabulary words on this page."

Does the current app have a feature to save any images which were generated for the current deck even if they are not currently on a given slide? Or if they didn't end up on a slide in the first place? (I just tried to generate a new image and I can't find it anywhere. It didn't end up going to the slide. I don't know if it returned an error, or if it came back, but just didn't get to the image slot on the slide. Can you please make sure that 1) If an image returns, it is immediately stored in a library that I can access through a new Image tab in the settings panel? After that it gets added to the actual slide that requested it. (Move the other image-related settings and tools into this new images tab too, like generate all images etc.).  Additionally, if the API call returns anykind of error, please show that error in the image field that requested the image in the first place so that I know it failed and what the reason was. Don't make that error blocking, but it should be the first thing you see when you look at that slide (only in the app) and that error should have an X to clear it and try again. Also, while an image is being rendered by the AI (while we wait for the )