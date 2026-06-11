Since this app works pretty well already, in leu of requirements, here is a usage guide, including the json format it uses:

Heart Walk Deck: Architecture & Usage Guide

This document serves as the "Instruction Manual" for both human operators and AI agents generating content for the Heart Walk Deck application. It details the app's capabilities, hidden positioning logic, and the strict JSON schema required for ingestion.

## Version History

- v3.3 — Flexible field modes (text/image/quote), two-column template, quote vector boxes, image alignment, draggable split divider
- v3.4 — Icon-only hover mode selector, image upload/drag-drop with server storage, imagePrompt hint text, image drop zone UX

## 1. Core Concept

The Heart Walk Deck is a client-side, browser-based slide editor. It bridges the gap between simple HTML design and professional PowerPoint (.pptx) export. It relies on localStorage for saving progress and uses PptxGenJS for generation.

## 2. Key Features & Hidden Mechanics

### Field Mode System (v3.3+)

Every content panel supports three modes, switchable via hover icon buttons:
- **Text** (lines icon) — Contenteditable text area with Markdown parsing
- **Image** (image icon) — Upload/drop/URL image with contain sizing and edge-click alignment
- **Quote** (speech bubble icon) — Vector speech bubble quote box with editable body and attribution

Mode selector icons appear on hover over any content field. The active mode is highlighted.

### Image Upload (v3.4+)

Image mode shows a drop zone when no image is loaded:
- Drag-and-drop image files directly onto the field
- Click the drop zone to open a file browser
- Or paste a URL and click Load
- Images are uploaded to the server (`/harvester/api/image-store.php`)
- Falls back to data-URI embedding if server is unreachable

### AI Image Prompts (v3.4+)

Fields can carry an `imagePrompt` property — a text suggestion for what image would complement the slide. When no image is loaded, the drop zone shows the prompt as hint text (💡 Suggested: "..."). This is populated by the Reporter app.

### Two-Column Layout (v3.3+)

Slides of type `two-column` show a draggable center divider. Each column is an independent field that can be text, image, or quote mode. Split percentage (20–80%) is stored and exported.

### The Nudge System (Positioning)

The app uses a 3-layer positioning system. This is often missed by new users.
- **Global Mode**: Moves elements on every slide simultaneously.
- **Template Mode**: Moves elements only on slides of the same type.
- **Local Mode**: Moves elements only on the current active slide.
Toggle this by clicking the "Mode" text in Settings.

### Context Actions

- **Ctrl + Click**: Selects a text block (Title or Body)
- **Ctrl + Arrow Keys**: Nudges the selected block(s)
- **Right Click** (on Cover/Section): Opens color menu for decorative shape
- **Edge click** (on loaded image): Snaps image alignment to that edge

### Markdown Parsing

Use `**bold**`, `*italic*`, `### Header`, and `* Bullet points`.
When exporting to PPTX, `### Headers` are converted to Bold text with extra spacing.

## 3. Designer Import Instruction Set (Canonical)

Use this section as the source-of-truth for producing JSON that imports cleanly.

### What Designer does with imported JSON

Designer imports deck JSON, normalizes missing pieces, renders editable slides, then preserves structure on export/PPTX generation.

Pipeline on import:
1. Parse JSON (raw object, bare array, or JSON extracted from AI prose wrappers).
2. Normalize to `{ config, slides }` shape.
3. Sanitize each slide/field (`ensureSlideSchema` + field defaults).
4. Render slides and persist to localStorage.
5. Keep unknown keys for round-trip safety.

### Minimum JSON that always imports

```json
{
  "slides": [
    { "type": "standard", "title": "Hello", "content": "* One bullet" }
  ]
}
```

`config` is optional. `slides` is required (or a bare array of slide objects).

### Root-level contract

| Key | Required | Purpose | If missing / invalid |
|-----|----------|---------|----------------------|
| `slides` | Yes (or bare array input) | Slide data to render/edit/export | Import fails only if no recoverable slides are found |
| `config` | No | Theme/font/color/layout settings | Current/default settings are used |

Accepted root shapes:
- Object with `slides`
- Object with `deck` (auto-mapped to `slides`)
- Single slide object (wrapped into one-slide deck)
- Bare array of slides (wrapped as `{ config:null, slides:[...] }`)

### Slide object contract

| Key | Required | Used by | If missing / invalid |
|-----|----------|---------|----------------------|
| `type` | No | Selects layout renderer | Defaults to `standard`; unknown values are coerced to `standard` |
| `title` | No | Header text | Defaults to `"Untitled Deck"` for cover, else empty |
| `subtitle` | Cover only (practical) | Cover subtitle | Defaults to empty |
| `shapeColor` | No | Cover/section decorative shape color | Falls back to app default shape color |
| `content` | No (legacy support) | Legacy text source; still used as fallback when fields missing | Used to auto-build missing field text |
| `bodyField` | Standard only (practical) | Main editable field for standard slide | Auto-created from `content` |
| `columns` | Two-column only (practical) | Left/right editable fields + split | Auto-created with default left/right fields |

Supported `type` values and intent:
- `cover`: Deck title slide
- `section`: Divider slide
- `standard`: Title + one content field (`bodyField`)
- `two-column`: Title + two independent fields (`columns.leftField`, `columns.rightField`)

### Field object contract (for `bodyField`, `leftField`, `rightField`)

| Key | Required | What it is for | Runtime behavior |
|-----|----------|----------------|------------------|
| `mode` | No | Rendering mode selector | Invalid/missing → `text` |
| `text` | No | Markdown-like body copy (text mode) | Used when `mode="text"`; also fallback text source |
| `imageUrl` | No | URL/data-URI for image mode | Used when `mode="image"`; empty shows drop zone |
| `imageAlign` | No | Image anchoring (`center`,`left`,`right`,`top`,`bottom`) | Invalid/missing → `center` |
| `imagePrompt` | No | AI image generation hint/prompt text | Displayed in empty image field; editable; used by AI generate/regenerate |
| `imageHistory` | No | Previous image versions for undo | If present and array, used for history undo button; else defaults empty |
| `quoteText` | No | Quote body text for quote mode | Used when `mode="quote"` |
| `quoteAttribution` | No | Quote speaker label | Editable; can be hidden by toggle without deleting value |
| `textScale` | No | Paragraph scale (`large`,`normal`,`small`) | Invalid/missing → `normal` |
| `fontDelta` | No | Per-field size nudge | Coerced/clamped to `-12..12` |

### Two-column-specific keys

| Key | Required | Purpose | If missing / invalid |
|-----|----------|---------|----------------------|
| `columns.splitPct` | No | Divider position (% left width) | Coerced/clamped to `20..80` |
| `columns.leftField` | No (practical) | Left content panel | Auto-created |
| `columns.rightField` | No (practical) | Right content panel | Auto-created |

### Config keys (common)

These are optional and mainly affect appearance/positioning:
- Typography and color keys like `font-title`, `size-title`, `color-title` (and same pattern for subtitle/h1/h2/h3/p-*).
- `showShapes` (cover/section decor on/off).
- `globalX`, `globalY` (global deck offset).
- `typeOffsets.cover|section|standard|two-column` (template-level offsets).
- `hideAttrib` (hide quote attributions visually / PPT export while preserving underlying data).

If config keys are absent, Designer uses defaults and still imports.

## 4. Import Sanitizer Behavior (What happens automatically)

> **Philosophy: "Accept everything, break nothing."**

Automatic corrections during import:
- Missing slide `type` → `standard`.
- Unknown slide type → coerced to `standard`.
- Missing `bodyField` on `standard` → created from `content`.
- Missing `columns` on `two-column` → created with safe defaults.
- Missing field internals (`mode`, `imageAlign`, etc.) → defaulted/coerced.
- Markdown-style legacy quote-bubble text may be auto-migrated into proper quote field layout.

Data preservation rules:
- Unknown/unexpected keys are preserved in the JSON object (not used for rendering unless recognized).
- Import warnings are surfaced so operators know what was auto-corrected.
- Round-trip intent: Import → Edit → Export should not silently destroy non-schema keys.

### Practical authoring rules for clean imports

1. Always provide `slides` as an array of objects.
2. Prefer explicit field objects (`bodyField`, `leftField`, `rightField`) over legacy `content`-only slides.
3. Keep `type` to supported values only.
4. Keep `mode` consistent with the populated field payload (`text` vs `imageUrl` vs `quoteText`).
5. Use `imagePrompt` whenever you want AI generation to be available in that field.
6. Treat `content` as compatibility text; canonical editing targets are field objects.

## 5. Server Infrastructure

### Image Upload Endpoint

`POST /harvester/api/image-store.php`
- Accepts multipart/form-data with field `image`
- Stores to `/harvester/uploads/images/` with UUID filenames
- Returns `{ "ok": true, "url": "https://...", "filename": "...", "size": 12345 }`
- Allowed types: JPEG, PNG, GIF, WebP, SVG
- Max size: 10 MB
- CORS restricted to `happydo.xyz`

## 6. Implementation Status

- [x] Slide types: cover, section, standard, two-column
- [x] Field mode system: text, image, quote (all panels)
- [x] Icon-only hover mode selector (3 SVG icons)
- [x] Two-column layout with draggable split divider (20-80% range)
- [x] Quote vector speech bubble (CSS clip-path polygon)
- [x] Image field with contain sizing and edge-click alignment
- [x] Image upload via drag-drop, file picker, or URL
- [x] Server-side image storage (PHP endpoint)
- [x] Data-URI fallback when server unreachable
- [x] imagePrompt hint text in empty image fields
- [x] PPTX export for all field modes
- [x] Backward-compatible schema migration
- [x] Markdown parsing and live editing
- [x] Template/global/local positioning system
- [x] JSON import/export with sanitization
- [x] AI image generation (via `generateImage()` in ailnl.js — editable prompts, regeneration)
- [x] Image version history (per-field stack, undo button, max 10)
- [x] Image prompt editing and regeneration