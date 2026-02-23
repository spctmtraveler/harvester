# Designer (Heart Walk Deck) — Instruction Set

Audience: human operators and AI agents new to the project.

This document explains:
- What Designer does.
- How to use it (import → edit → export).
- The JSON structure that imports cleanly (what’s required/optional and what each field is used for).

Designer is implemented as a single-file browser app. The behaviors described here are based on the current implementation in `index.html`.

---

## 1) What Designer is / does

Designer is a client-side slide editor that:
- Imports “deck JSON”, normalizes it into a safe internal shape, and renders editable slides.
- Persists your work automatically to browser `localStorage`.
- Exports JSON (copy-to-clipboard) and generates a downloadable PowerPoint (`.pptx`).

Important: Designer tries hard to accept imperfect JSON. If it has to “fix up” your input, it will show **Import Notes** listing what it corrected.

---

## 2) How to use Designer (operator workflow)

### Import
Designer can import in three ways:
1. Upload a `.json` file.
2. Read JSON from clipboard.
3. Paste text into the import textarea.

Notes:
- Pasted AI output is allowed: Designer will attempt to extract the first complete JSON object/array from surrounding prose.
- Markdown code fences are allowed (e.g. ```json … ```).

### Edit
- Each slide renders with editable text areas.
- Content “fields” support different modes (Text / Image / Quote), switchable via the hover mode buttons.
- Slides can be added/removed from the UI.
- Two-column slides have a draggable split divider.

Power features / shortcuts:
- **Ctrl + Click** selects movable blocks (Title wrapper and/or Body wrapper).
- **Ctrl + Arrow keys** nudges the current selection.
- Nudge scope can be changed (All Slides / This Template / This Slide):
  - **All Slides** writes to `config.globalX` / `config.globalY`.
  - **This Template** writes to `config.typeOffsets[slideType].x/y`.
  - **This Slide** writes to the current slide’s `x/y`.
- When nudging selected wrappers, Designer writes per-slide wrapper offsets:
  - `titleX/titleY` for the title wrapper
  - `bodyX/bodyY` for the body wrapper
- **Right-click** on cover/section slides (when shapes are enabled) opens the shape color menu; selection is stored in `slide.shapeColor`.

### Export
- **Export JSON** copies the current deck as pretty-printed JSON to your clipboard.
- **Download .PPTX** generates and downloads a PowerPoint.

### Persistence / Reset
- Designer autosaves to browser `localStorage` under a versioned key.
- There is a “Clear All / Reset” action that wipes the saved state and reloads.

---

## 3) Import pipeline (what happens when JSON is loaded)

Designer uses a resilient import pipeline:

1. Parse JSON
   - If input is already JSON → parse directly.
   - If input is prose-wrapped (AI output) → extract JSON substring then parse.
   - If input is code-fenced → fences are stripped.

2. Normalize to a deck object shape:
   - Always ends up as `{ config, slides }`.

3. Sanitize slide/field structure
   - Each slide is coerced into a supported slide type and gets required sub-objects.
   - Each field is coerced into a supported field shape with defaults.

4. Render + persist
   - The normalized deck renders immediately and is saved to `localStorage`.

5. Surface warnings
   - Any fixups (e.g., unknown slide types, missing fields, array-wrapped input) show in **Import Notes**.

---

## 4) Root JSON contract (deck)

### 4.1 Minimum JSON that always imports

```json
{
  "slides": [
    { "type": "standard", "title": "Hello", "content": "* One bullet" }
  ]
}
```

Rules:
- `slides` is required (or you may provide a bare array of slide objects).
- `config` is optional.

### 4.2 Accepted input shapes (what Designer will accept)

Designer accepts several “root shapes” and normalizes them:

| Input shape | Accepted? | Normalized result |
|---|---:|---|
| `{ "config": {…}, "slides": [ … ] }` | Yes | Used as-is (slides are still sanitized) |
| `{ "slides": [ … ] }` | Yes | `config` treated as missing |
| `[ {…slide…}, {…slide…} ]` | Yes | Interpreted as `slides` with `config:null` |
| `{ "deck": [ … ] }` | Yes | `deck` array is used as `slides` |
| `{ …singleSlide… }` | Sometimes | If it looks like a slide (has `type` and string `title`), it’s wrapped into a one-slide deck |

Rejected cases (import will error):
- JSON object with no `slides` array, no `deck` array, and not recognized as a single slide.
- `slides` exists but contains no usable slide objects.

### 4.3 Export shape (what Designer outputs)

Designer always exports (to clipboard) exactly:

```json
{
  "config": { /* current app config */ },
  "slides": [ /* current slides */ ]
}
```

Config nuance:
- If imported `config` is missing/`null`/invalid, Designer keeps its current config (defaults or whatever is already in the editor) rather than overwriting.

---

## 5) Slide object contract

Each element of `slides[]` is a slide object.

### 5.1 Supported slide types

Designer supports exactly these slide types:
- `cover`
- `section`
- `standard`
- `two-column`

If `type` is missing or unknown:
- Missing/unknown `type` is coerced to `"standard"`.
- If it was unknown (explicit invalid value), Designer records the original value in `_originalType`.

### 5.2 Slide keys (required vs optional)

| Key | Required | Used for | If missing / invalid |
|---|---:|---|---|
| `type` | No | Chooses slide renderer/sanitizer | Coerced to `standard` if missing/unknown |
| `title` | No | Slide header text | Defaults to `"Untitled Deck"` on `cover`, else `""` |
| `subtitle` | No | Cover subtitle | Always defaulted to `""` on cover |
| `shapeColor` | No | Decorative shape color for cover/section | Defaults to app behavior (uses a default if absent) |
| `content` | No | Legacy text source; also used as fallback for missing field text | May be backfilled from field text |
| `bodyField` | No (practical for `standard`) | Primary editable field for standard slides | Auto-created from `content` |
| `columns` | No (practical for `two-column`) | Holds two fields + divider split | Auto-created and clamped |

### 5.3 Standard slide behavior (`type: "standard"`)

A standard slide should have:
- `title` (optional)
- `bodyField` (recommended)

Import sanitizer behavior:
- Ensures `bodyField` exists and is a valid field object.
- If `content` is missing, Designer sets `content` to `bodyField.text`.

#### Automatic quote-bubble migration (legacy Markdown pattern)
If a standard slide’s body text contains a “quote bubble” marker in the following pattern:
- a line starting with `> **Quote Bubble` (case-insensitive), and
- a subsequent blockquote line `> "…"` holding the quote text

Designer will auto-convert the slide into `type: "two-column"`:
- Left column becomes the non-quote text.
- Right column becomes a `quote` field (quote text + optional speaker).

This is designed to make old “single text block” slides render as proper quote layouts.

### 5.4 Two-column slide behavior (`type: "two-column"`)

A two-column slide uses `columns`:

```json
{
  "type": "two-column",
  "title": "Example",
  "columns": {
    "splitPct": 50,
    "leftField": { "mode": "text", "text": "Left" },
    "rightField": { "mode": "image", "imageUrl": "" }
  }
}
```

Import sanitizer behavior:
- Ensures `columns.leftField` and `columns.rightField` exist and are valid field objects.
- Ensures `columns.splitPct` is numeric and clamps it to `20..80`.
- If `content` is missing, Designer backfills `content` from left field text.

---

## 6) Field object contract (bodyField / leftField / rightField)

Fields are where content lives. A field object is always normalized into this shape:

| Key | Type | Required | What it is for | Defaults / coercions |
|---|---|---:|---|---|
| `mode` | string | No | Which UI renderer to use | Invalid/missing → `"text"` |
| `text` | string | No | Text content (Text mode) | Defaults to fallback text |
| `imageUrl` | string | No | Image URL or data-URI (Image mode) | Default `""` |
| `imageAlign` | string | No | Visual alignment for image in the field | Invalid/missing → `"center"` |
| `imagePrompt` | string | No | Hint/prompt used for AI image generation UX | Default `""` |
| `imageHistory` | array of strings | No | Undo stack of previous `imageUrl` values | Default `[]` |
| `quoteText` | string | No | Quote body text (Quote mode) | Defaults to fallback text |
| `quoteAttribution` | string | No | Quote speaker/attribution | Default `""` |
| `textScale` | string | No | Paragraph scale selector | Invalid/missing → `"normal"` |
| `fontDelta` | number | No | Per-field font size nudge | Clamped to `-12..12` |

Mode-specific usage:
- `mode: "text"` → uses `text`.
- `mode: "image"` → uses `imageUrl` (if empty, shows drop zone). `imageAlign` affects on-screen positioning.
- `mode: "quote"` → uses `quoteText` and `quoteAttribution`.

---

## 7) Config contract (appearance + some behavior)

`config` is optional. If present, Designer reads known keys and ignores unknown ones.

Common keys (all optional):
- Typography keys like `font-title`, `size-title`, `color-title` (and similarly for `subtitle`, `h1`, `h2`, `h3`, and `p-*`).
- `showShapes` (boolean): show/hide decorative shapes on cover/section slides.
- `hideAttrib` (boolean): visually hide quote attributions and omit them from PPTX.
- `globalX`, `globalY` (numbers): global positioning offsets for the HTML renderer.
- `typeOffsets` object: template offsets per slide type (cover/section/standard/two-column) for the HTML renderer.

Related slide-level positioning keys (all optional; created when using the nudge/selection tools):
- `x`, `y`: per-slide offset (used in “This Slide” nudge scope).
- `titleX`, `titleY`: local offset for the slide title wrapper.
- `bodyX`, `bodyY`: local offset for the slide body wrapper.

Important:
- PPTX export does not currently apply the nudge/offset system (it uses fixed placements).

---

## 8) Data preservation / round-trip behavior (critical for AI authors)

Designer tries to preserve slide data for “round-trip” editing, but normalization has limits:

- Slide-level unknown keys: generally preserved.
  - Reason: slides are sanitized by mutating the existing slide object (it does not rebuild the entire slide from scratch).

- Field-level unknown keys: NOT preserved.
  - Reason: fields are replaced with a new object created by the field-defaulting function, which only includes known keys.

- Two-column `columns` unknown keys: NOT preserved.
  - Reason: `columns` is overwritten with a new object containing only `splitPct`, `leftField`, and `rightField`.

If you need round-trip safety for custom metadata, prefer attaching it at the slide level (not inside `bodyField` / `leftField` / `rightField`).

---

## 9) Image handling (upload, alignment, history)

### Upload behavior
In Image mode (`mode:"image"`):
- Drag/drop or file-pick uploads the image.
- Designer first attempts server upload (multipart form field name: `image`).
- If the server upload fails, Designer falls back to embedding the image as a data-URI.

Tradeoff:
- Data-URI fallback works offline but can make JSON very large.

### Image history undo
Designer maintains a per-field history stack (`imageHistory`) and can undo to prior images.
- Max history length is capped (to reduce localStorage bloat).

### Image alignment
`imageAlign` controls how the image is positioned within its box on-screen (`left`, `right`, `top`, `bottom`, `center`).
- PPTX export currently uses “contain” sizing and does not apply `imageAlign`.

---

## 10) PPTX export behavior (what transfers into PowerPoint)

Designer generates PPTX with these key behaviors:

Text slides:
- Parses simple Markdown-ish patterns:
  - `### Header` lines become bold and slightly larger with extra spacing.
  - `* ` or `- ` lines become bullets.

Quote fields:
- Render as a rounded rectangle with quote text inside.
- Attribution is omitted if `config.hideAttrib` is true.

Image fields:
- Adds images with “contain” sizing when possible.
- If image insertion fails, it falls back to writing `Image: <url>` as text.

Known limitation:
- The nudge/offset positioning system affects the HTML renderer but is not currently applied to PPTX placements.

---

## 11) Common Import Notes (warnings) and what they mean

Designer may show Import Notes like:
- “Input was a plain array — interpreted as slides (no config).”
- “Found "deck" array instead of "slides" — used it.”
- “JSON was extracted from surrounding text (AI prose wrapper detected).”
- “X slide(s) had unknown types → converted to "standard".”
- “X standard slide(s) were missing bodyField → auto-created from content.”
- “No "config" found — using default design settings.”
- “No "config" found — using current/default design settings.”

These warnings are informational: the deck will still load.

---

## 12) Minimal examples

### Example A — minimum deck

```json
{
  "slides": [
    { "type": "standard", "title": "Hello", "content": "* One bullet" }
  ]
}
```

### Example B — one of each slide type

```json
{
  "config": {
    "showShapes": true,
    "hideAttrib": false
  },
  "slides": [
    {
      "type": "cover",
      "title": "Heart Walk",
      "subtitle": "Deck draft"
    },
    {
      "type": "section",
      "title": "Key Themes"
    },
    {
      "type": "standard",
      "title": "What we heard",
      "bodyField": {
        "mode": "text",
        "text": "### Highlights\n* First point\n* Second point",
        "textScale": "normal",
        "fontDelta": 0
      }
    },
    {
      "type": "two-column",
      "title": "Evidence",
      "columns": {
        "splitPct": 55,
        "leftField": {
          "mode": "text",
          "text": "* Context and setup"
        },
        "rightField": {
          "mode": "quote",
          "quoteText": "We rely on workarounds more than we should.",
          "quoteAttribution": "Staff"
        }
      }
    },
    {
      "type": "two-column",
      "title": "Visual + notes",
      "columns": {
        "splitPct": 50,
        "leftField": {
          "mode": "image",
          "imageUrl": "",
          "imagePrompt": "A simple diagram showing the process flow",
          "imageAlign": "center"
        },
        "rightField": {
          "mode": "text",
          "text": "* Add annotations here"
        }
      }
    }
  ]
}
```
