# Designer (Heart Walk Deck) — Instruction Set

Audience: AI agents wanting to produce Live Neuron Lab PowerPoint documents using or propriatary "Designer" app.

This app allows you to create a JSON file in a specific format that Designer can turn into a fully editable PowerPoint slide fitting a tight style template.

This document explains:
- what Designer does,
- how the editor behaves,
- exactly what JSON imports cleanly,
- which keys are required vs optional,
- which settings live in deck JSON vs only in the app/database.

Designer is implemented as a browser app using index.html and app.js. This instruction set reflects the current implementation.

---

## 1) What Designer does

Designer is a browser-based slide editor that:
- imports deck JSON,
- normalizes imperfect input into a safe internal shape,
- renders editable slides,
- autosaves the active deck to browser storage and the remote DB,
- exports JSON,
- generates a PowerPoint `.pptx`.

Designer also supports:
- text, image, and quote field modes,
- deck-level numbered references for transcript evidence,
- single-image slides with optional titles,
- per-slide hover actions for delete, copy slide JSON, and paste slide JSON,
- AI image prompt drafting,
- AI image generation,
- batch generation for missing images,
- per-slide speaker notes,
- in-place conversion between standard and two-column slides,
- a stacked two-column layout with top-left text, bottom-left quote, and full-height right graphic space.

Important: Designer is intentionally forgiving. It will often fix malformed but recognizable JSON instead of rejecting it.

Current import repair behavior:
- trailing commas are removed automatically,
- JSON can be extracted from surrounding AI prose,
- malformed slides are skipped instead of aborting the whole deck when possible,
- malformed field objects are replaced with safe defaults when possible,
- malformed `sources` entries are ignored item-by-item with import notes.

---

## 2) Operator workflow

### Import
Designer can import by:
1. uploading a `.json` file,
2. reading from the clipboard,
3. pasting text into the import box.

Accepted input can include:
- plain JSON,
- AI prose wrapped around JSON,
- fenced code blocks like ```json ... ```.

If Designer had to repair or reinterpret your payload, it shows Import Notes.

If part of the deck is unusable but the rest is valid, Designer should import the usable portion and report what it skipped or repaired.

Current import behavior note:
- importing JSON creates a new deck document in the current tab by default,
- this is intentional so loading JSON in one tab does not overwrite a different deck already open in another tab.

### Edit
Designer supports:
- editable slide text,
- Text / Image / Quote field mode switching,
- a hover toolbar beside the active slide for delete / copy slide JSON / paste slide JSON,
- file upload, drag/drop, paste, and direct URL loading for image fields,
- Auto Prompt for drafting an image prompt from slide content,
- Generate for creating an image from the current prompt,
- queued generate behavior when Auto Prompt is still in flight,
- adding/removing the second column on the current slide,
- draggable split divider for two-column slides,
- speaker notes per slide.

### Export
- Export JSON copies the current deck JSON to clipboard.
- Download `.PPTX` creates a PowerPoint.

### Slide copy / paste / delete
- The hover toolbar just left of the active slide exposes 3 slide-level actions: Delete, Copy, and Paste.
- Delete removes the current slide and shows a toast with a 30-second Undo action.
- Copy writes slide-only JSON to the clipboard using the same top-level contract Designer already understands: a root object with `slides` and optional `references`.
- The copied slide payload also includes a `meta` object that marks it as slide clipboard JSON.
- Paste reads clipboard text, parses it with the same resilient JSON pipeline as Import, and inserts every slide in that payload immediately after the current slide.
- Paste accepts one slide or many slides. AI-authored slide-paste JSON should therefore always use a `slides` array, even when there is only one slide.
- If pasted slides use inline reference markers like `(12)`, include matching `references` whenever possible.
- If pasted reference IDs collide with the current deck, Designer automatically renumbers them to fit the destination deck.
- If pasted slides cite references that are missing from `references`, Designer creates blank placeholder references and warns the user.

### Persistence
- Each tab tracks its own active deck ID in session storage.
- Each deck autosaves locally under its own browser-storage key instead of using one shared autosave slot.
- Each deck also autosaves to the remote DB under its own deck record.
- If a tab opens without a tab-specific active deck, Designer may reopen whichever deck was most recently active in the browser.
- Some app-level settings also use the remote DB.

---

## 3) What is stored where

This is important for AI authors.

### Stored in deck JSON
These travel with the deck and export/import cleanly:
- `slides`
- `config`
- `references`
- optional `meta` markers used to label slide clipboard payloads
- `config.imagePromptStyle`
- slide content and fields
- slide speaker notes
- slide and wrapper offsets
- field-level image prompts and notes
- field-level `sources`

### Not stored in deck JSON
These are app-level settings, not part of the deck contract:
- the current deck document ID used by the app
- the current deck display name stored in the deck library / DB record
- the per-tab active deck selection
- the library of named image styles saved to DB
- the editable Heart Walk systems overview text saved to DB

Those values affect app behavior, but they are not exported as part of the deck JSON.

### Deck document persistence model

Designer now behaves more like a lightweight document editor:
- every saved deck gets its own document ID,
- unnamed decks are still valid and appear in the deck list as `Unnamed - <date/time>`,
- the deck name can be added or changed later without changing the JSON contract,
- multiple tabs can work on different decks at the same time because their autosaves no longer share one browser key or one DB row.

Important limitation:
- two tabs editing the same deck ID are still last-write-wins; Designer does not implement live collaborative merging or record locking.

---

## 4) Root JSON contract

### 4.1 Minimum valid deck

```json
{
  "slides": [
    { "type": "standard", "title": "Hello", "bodyField": { "mode": "text", "text": "* One bullet" } }
  ]
}
```

### 4.2 Required vs optional at root

| Key | Required | Type | Notes |
|---|---:|---|---|
| `slides` | Yes, unless root is a bare array | array | Main deck content |
| `meta` | No | object | Optional metadata. Slide-copy payloads use this to declare they are clipboard slide JSON |
| `config` | No | object | Optional settings object |
| `references` | No | array | Deck-level evidence/reference registry used by inline `(12)` markers |

### 4.3 Accepted root input forms

Designer accepts and normalizes all of the following:

| Input shape | Accepted | Normalized to |
|---|---:|---|
| `{ "config": { ... }, "slides": [ ... ] }` | Yes | Used as deck object |
| `{ "meta": { ... }, "slides": [ ... ] }` | Yes | Common slide-paste / clipboard payload |
| `{ "slides": [ ... ] }` | Yes | Deck with missing config |
| `[ { ...slide... }, { ...slide... } ]` | Yes | Treated as `slides` |
| `{ "deck": [ ... ] }` | Yes | `deck` is used as `slides` |
| prose-wrapped JSON | Yes | JSON is extracted first |
| fenced JSON block | Yes | Code fences are stripped first |

Rejected:
- an object with no usable `slides` array,
- an object that is not recognizable as a deck,
- invalid JSON after extraction attempts.

Repairable but warned:
- trailing commas,
- string-valued `sources` items,
- malformed field objects,
- malformed slide objects that can be skipped without losing the rest of the deck.

### 4.4 Export shape

Designer exports exactly this shape:

```json
{
  "config": { ... },
  "references": [ ... ],
  "slides": [ ... ]
}
```

Slide-copy payloads use the same shape, but usually omit deck-wide `config` and instead add a small `meta` object:

```json
{
  "meta": {
    "designerPayloadType": "slide-clipboard",
    "slideClipboard": true,
    "slideCount": 2
  },
  "references": [ ... ],
  "slides": [ ... ]
}
```

Important for AI authors:
- For hover Paste, `slides` may contain 1 slide or many slides.
- `config` is ignored during hover Paste because the destination deck keeps its own styling and settings.
- If you only want to paste slides, prefer the `meta` + `slides` + optional `references` shape above.

### 4.5 `references` contract

`references` is optional.

Each reference item should look like:

```json
{
  "id": 12,
  "sources": [
    {
      "text": "Quoted supporting evidence.",
      "interviewee": "Lauren Verrill",
      "sourceLabel": "Lauren Verrill.md",
      "timestamp": "00:14:32"
    },
    {
      "text": "Second supporting quote for the same sentence.",
      "interviewee": "Katie Belusa"
    }
  ]
}
```

Per reference item keys:

| Key | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | positive integer | The deck-wide reference number used in inline markers like `(12)` |
| `sources` | Yes, practically | array | List every supporting quote that backs the sentence or quote using this number |

Per `sources[]` item keys:

| Key | Required | Type | Notes |
|---|---:|---|---|
| `text` | Yes, practically | string | Supporting quote or evidence text |
| `interviewee` | No | string | Person or role label |
| `sourceLabel` | No | string | Transcript/source label |
| `timestamp` | No | string | Timestamp or semantic-block locator |

Inline usage rule:
- Any plain `(12)` marker inside a text field or quote body means “link this sentence/claim to deck reference #12.”
- Use one marker number per sentence or quote whenever possible.
- If a sentence or quote is supported by multiple transcript excerpts, keep the single marker number and list all of those supporting quotes inside `references[n].sources`.
- The marker is visible in the slide text, but the quote/interviewee details live only once in the top-level `references` array.

---

## 5) `config` contract

`config` is optional.

If `config` is missing, Designer uses defaults and/or the current editor state.

### 5.1 Common config keys

All config keys are optional.

| Key | Type | Used for |
|---|---|---|
| `globalX` | number | Global on-screen slide offset |
| `globalY` | number | Global on-screen slide offset |
| `showShapes` | boolean | Show decorative shapes on cover/section slides |
| `hideAllImages` | boolean | Hide images and switch quote bubbles to plain mode |
| `hideAttrib` | boolean | Hide quote attributions in app and PPTX |
| `hideSourceAttribution` | boolean | Hide interviewee/source attribution in source previews and PPTX speaker-note footnotes |
| `showSpeakerNotes` | boolean | Open the speaker notes panel in the app |
| `imagePromptStyle` | string | Universal image style appended to AI image prompts |
| `universalQuoteAttribution` | string | Overrides all quote attributions in app and PPTX |
| `shapePath` | string or null | Custom decorative SVG path |
| `shapeViewBox` | string or null | Custom decorative SVG viewBox |
| `typeOffsets` | object | Per-slide-type on-screen template offsets |

### 5.2 Typography config keys

All typography keys are optional.

Supported groups:
- `title`
- `subtitle`
- `h1`
- `h2`
- `h3`
- `normal`
- `p-large`
- `p-normal`
- `p-small`
- `quote-body`
- `quote-attrib`

For each group, Designer may use:
- `font-<group>`
- `size-<group>`
- `color-<group>`

Examples:
- `font-title`
- `size-h2`
- `color-p-normal`
- `font-quote-body`

### 5.3 `typeOffsets` shape

Optional object keyed by slide type:

```json
{
  "typeOffsets": {
    "cover": { "x": 0, "y": 0 },
    "section": { "x": 0, "y": 0 },
    "standard": { "x": 0, "y": 0 },
    "image": { "x": 0, "y": 0 },
    "two-column": { "x": 0, "y": 0 }
  }
}
```

If missing, Designer creates these defaults internally.

---

## 6) Slide object contract

Each element of `slides[]` is a slide object.

### 6.1 Supported slide types

Supported `type` values:
- `cover`
- `section`
- `standard`
- `image`
- `two-column`

If `type` is missing or unknown:
- Designer coerces it to `standard`.
- If the original value was invalid, it may preserve that invalid value in `_originalType` for debugging.

### 6.2 Slide-level keys

| Key | Required | Type | Applies to | Notes |
|---|---:|---|---|---|
| `type` | No | string | all slides | Missing/invalid becomes `standard` |
| `title` | No | string | all slides | Defaults to `"Untitled Deck"` on cover, else `""` |
| `subtitle` | No | string | cover, section input is tolerated | Cover subtitle; cover defaults to `""` |
| `speakerNotes` | No | string | all slides | Slide-level speaker notes |
| `shapeColor` | No | string | cover, section | Decorative shape color token or CSS var |
| `content` | No | string | standard, image, two-column legacy support | Legacy text fallback |
| `bodyField` | No, but recommended for `standard` and `image` | object | standard, image | Auto-created if missing |
| `columns` | No, but recommended for `two-column` | object | two-column | Auto-created if missing |
| `x` | No | number | all slides | Per-slide on-screen offset |
| `y` | No | number | all slides | Per-slide on-screen offset |
| `titleX` | No | number | all slides | Title wrapper offset |
| `titleY` | No | number | all slides | Title wrapper offset |
| `bodyX` | No | number | all slides | Body wrapper offset |
| `bodyY` | No | number | all slides | Body wrapper offset |

### 6.3 `cover` slide

Minimum useful shape:

```json
{
  "type": "cover",
  "title": "Deck Title",
  "subtitle": "Optional subtitle"
}
```

Required keys:
- none beyond being a usable slide object.

Optional keys:
- `title`
- `subtitle`
- `shapeColor`
- `speakerNotes`
- positioning keys

### 6.4 `section` slide

Minimum useful shape:

```json
{
  "type": "section",
  "title": "Section Header"
}
```

Optional keys:
- `title`
- `subtitle` is tolerated but not central to rendering
- `shapeColor`
- `speakerNotes`
- positioning keys

### 6.5 `standard` slide

Minimum useful shape:

```json
{
  "type": "standard",
  "title": "Slide title",
  "bodyField": {
    "mode": "text",
    "text": "Bullet or paragraph text"
  }
}
```

Optional but commonly used keys:
- `title`
- `speakerNotes`
- `content`
- `bodyField`
- positioning keys

Normalization behavior:
- if `bodyField` is missing, Designer creates it from `content`,
- if `content` is missing, Designer backfills it from `bodyField.text`.

### 6.6 `image` slide

Purpose:
- one large image field in the content area,
- a normal slide title when wanted,
- and no broken header region when the title is intentionally blank.

Minimum useful shape:

```json
{
  "type": "image",
  "title": "Optional image title",
  "bodyField": {
    "mode": "image",
    "imageUrl": ""
  }
}
```

Optional but commonly used keys:
- `title`
- `speakerNotes`
- `bodyField`
- positioning keys

Normalization behavior:
- if `bodyField` is missing, Designer creates it,
- `bodyField.mode` is forced to `image`,
- if `title` is blank, Designer omits the title row and renders only the large image area.

### 6.7 `two-column` slide

Minimum useful shape:

```json
{
  "type": "two-column",
  "title": "Two-column title",
  "columns": {
    "layoutMode": "side-by-side",
    "splitPct": 50,
    "stackSplitPct": 50,
    "leftField": { "mode": "text", "text": "Left content" },
    "rightField": { "mode": "image", "imageUrl": "" }
  }
}
```

Optional but commonly used keys:
- `title`
- `speakerNotes`
- `content`
- `columns.layoutMode`
- `columns.splitPct`
- `columns.stackSplitPct`
- `columns.leftField`
- `columns.bottomField`
- `columns.rightField`
- positioning keys

Normalization behavior:
- if `columns` is missing, Designer creates it,
- `columns.layoutMode` defaults to `side-by-side`,
- `splitPct` is clamped to `20..80`,
- `stackSplitPct` is clamped to `25..75`,
- if `content` is missing, Designer backfills it from the left field text.

Optional stacked variant:

```json
{
  "type": "two-column",
  "title": "Text + quote + graphic",
  "columns": {
    "layoutMode": "stacked-left",
    "splitPct": 55,
    "stackSplitPct": 48,
    "leftField": { "mode": "text", "text": "Top-left text (12)" },
    "bottomField": { "mode": "quote", "quoteText": "Supporting quote (12)", "quoteAttribution": "Katie Belusa" },
    "rightField": { "mode": "image", "imageUrl": "" }
  }
}
```

Meaning of `layoutMode` values:
- `side-by-side`: regular two-column layout using `leftField` and `rightField`
- `stacked-left`: top-left `leftField`, bottom-left `bottomField`, full-height right `rightField`

`stackSplitPct` meaning:
- percent of the stacked-left column height reserved for the top-left panel
- remaining height goes to `bottomField`

### 6.8 In-place layout conversion behavior

Designer UI supports converting layouts without adding a new slide:

- `standard` -> `two-column`
  - current `bodyField` becomes `columns.leftField`
  - new `columns.rightField` defaults to an image field

- `two-column` -> `standard`
  - `columns.leftField` becomes `bodyField`
  - right-column content is discarded after confirmation if meaningful content exists

- `two-column side-by-side` -> `two-column stacked-left`
  - `leftField` stays in the top-left area
  - a quote can move into `bottomField`
  - `rightField` becomes the full-height graphic space

This is editor behavior, not a special JSON shape.

---

## 7) Field object contract

Fields are used in:
- `bodyField`
- `columns.leftField`
- `columns.bottomField`
- `columns.rightField`

### 7.1 Supported field modes

Supported `mode` values:
- `text`
- `image`
- `quote`

If `mode` is missing or invalid, it becomes `text`.

### 7.2 Field-level keys

All field keys are optional. Designer fills defaults.

| Key | Type | Used by | Notes |
|---|---|---|---|
| `mode` | string | all fields | `text`, `image`, or `quote` |
| `text` | string | text mode | Main text content |
| `imageUrl` | string | image mode | Image URL or data URI |
| `imageAlign` | string | image mode | `center`, `left`, `right`, `top`, `bottom` |
| `imagePrompt` | string | image mode | Saved prompt text for AI generation |
| `imageNotes` | string | image mode | Notes/alt text; also used as prompt source |
| `imageHistory` | array of strings | image mode | Undo stack of prior image URLs |
| `quoteText` | string | quote mode | Quote body text |
| `quoteAttribution` | string | quote mode | Quote source line |
| `sources` | array | any mode | Optional provenance list for claims/insights |
| `textScale` | string | text mode | `large`, `normal`, `small` |
| `fontDelta` | number | text/quote mode | Per-field font nudge, clamped to `-12..12` |

### 7.3 Inline reference markers

Preferred claim-traceability pattern:
- Put numbered markers like `(12)` directly into `text` or `quoteText`.
- Store the actual evidence details once in the top-level `references` array.
- A single sentence or quote should normally use one marker number.
- If that sentence or quote is backed by multiple excerpts, put all of those excerpts in the same `references[n].sources` array.

Example:

```json
{
  "references": [
    {
      "id": 12,
      "sources": [
        {
          "text": "People repeatedly described the process as fragmented and manual.",
          "interviewee": "Caleb Bone"
        },
        {
          "text": "Several staff said they rely on workarounds to bridge the gaps.",
          "interviewee": "Lauren Verrill"
        }
      ]
    }
  ],
  "slides": [
    {
      "type": "standard",
      "title": "What we heard",
      "bodyField": {
        "mode": "text",
        "text": "* Staff described the handoff process as fragmented and manual (12)"
      }
    }
  ]
}
```

Notes:
- multiple markers may appear in the same text blob,
- the same reference id can be reused across multiple slides,
- one marker number may point to multiple supporting quotes through `references[n].sources`,
- a marker with no matching top-level reference is treated as unresolved until the reference is added.

### 7.4 `sources` contract

`sources` is optional and may appear on any field.

Shape:

```json
{
  "sources": [
    {
      "text": "Quoted supporting evidence.",
      "interviewee": "Person Name"
    }
  ]
}
```

Per source item keys:

| Key | Required | Type | Notes |
|---|---:|---|---|
| `text` | Yes, practically | string | Supporting quote/evidence text |
| `interviewee` | No | string | Source/person label |

Notes:
- multiple sources are allowed,
- an empty or missing `sources` array is valid,
- plain strings inside `sources` are accepted and converted to `{ "text": "..." }`,
- malformed source items are ignored instead of aborting import,
- the array is stored in deck JSON.

### 7.5 Text mode example

```json
{
  "mode": "text",
  "text": "### Heading\n* Bullet one (12)\n* Bullet two",
  "textScale": "normal",
  "fontDelta": 0,
  "sources": [
    {
      "text": "People repeatedly described this as manual and fragmented.",
      "interviewee": "Caleb Bone"
    }
  ]
}
```

### 7.6 Image mode example

```json
{
  "mode": "image",
  "imageUrl": "",
  "imageAlign": "center",
  "imagePrompt": "A clean process-flow diagram with warm documentary styling",
  "imageNotes": "A clean process-flow diagram with warm documentary styling",
  "imageHistory": []
}
```

### 7.7 Quote mode example

```json
{
  "mode": "quote",
  "quoteText": "We rely on workarounds more than we should. (12)",
  "quoteAttribution": "Staff member",
  "fontDelta": 0
}
```

Important:
- `quoteAttribution` is the displayed speaker/source line for the quote box itself.
- inline markers like `(12)` on the quote body are separate evidence links and may point to one or more supporting transcript quotes in `references[n].sources`.
- this allows the visible quote attribution to be anonymized while the supporting evidence remains linked behind the same marker number.

---

## 8) AI image behavior and related JSON

### 8.1 Universal style

Deck-level universal style lives in:

```json
{
  "config": {
    "imagePromptStyle": "cinematic documentary photo, warm natural light"
  }
}
```

This is optional.

If present, Designer appends it to AI image generation prompts.

### 8.2 Per-field prompt storage

Per-field prompt data lives in:
- `imagePrompt`
- `imageNotes`

When Designer automatically drafts an image prompt, it writes the same prompt into both keys.

### 8.3 DB-backed but not exported

Designer also supports these app-level features:
- named image styles stored in DB,
- editable Heart Walk systems overview text stored in DB,
- batch generation controls.

These are not part of the deck JSON contract.

### 8.4 Generate workflow

For a single empty image field:
- user can type a prompt manually and click Generate,
- user can click Auto Prompt to have AI draft the prompt from slide context,
- if Generate is clicked while Auto Prompt is still running, image generation is queued and starts automatically when the drafted prompt returns.

### 8.5 Batch workflow

Generate Missing Images scans the deck for image-mode fields with empty `imageUrl`.

For each target field:
- if a prompt already exists, Designer uses it,
- otherwise Designer auto-drafts one,
- then Designer generates the image.

This is sequential editor behavior. It does not change the JSON schema.

---

## 9) Legacy and normalization behaviors

### 9.1 Standard-slide legacy `content`

`content` is a legacy text property.

Designer still accepts it and may use it to seed `bodyField.text`.

Preferred modern authoring:
- use `bodyField` for standard slides,
- use `type: "image"` with `bodyField.mode: "image"` for single-image slides,
- use `columns.leftField` / `columns.rightField` for ordinary two-column slides,
- use `columns.layoutMode: "stacked-left"` plus `columns.bottomField` when the left column should stack text above a quote and reserve the right column for graphics.

### 9.2 Legacy quote-bubble Markdown conversion

If a standard slide text block includes a legacy quote-bubble marker pattern, Designer may convert that standard slide into a two-column slide automatically.

Purpose:
- preserve older content that embedded quote layouts into one markdown block.

### 9.3 Unknown keys preservation

Important round-trip behavior:

- unknown slide-level keys are usually preserved,
- unknown field-level keys are not guaranteed to be preserved,
- unknown keys inside `columns` are not guaranteed to be preserved.

Important import resiliency behavior:

- invalid slide objects may be skipped if the rest of the deck is usable,
- invalid field objects are normalized to safe defaults when possible,
- invalid `sources` or `imageHistory` entries are dropped item-by-item,
- Import Notes should explain each repair or skip.

If you need custom metadata to survive editing, attach it at the slide level rather than inside field objects.

---

## 10) Positioning and editor-only behavior

These keys may appear after editing in Designer:
- `x`, `y`
- `titleX`, `titleY`
- `bodyX`, `bodyY`

These are optional and valid in exported JSON.

Notes:
- they affect the browser renderer,
- PPTX export currently uses fixed placements and does not fully apply the HTML nudge system.

---

## 11) PPTX export behavior

Designer exports:
- slide titles,
- text content,
- quote bubbles,
- images,
- speaker notes.

Current behavior highlights:
- markdown-like bullets and `###` subheads are converted into PPT text objects,
- inline `**bold**` and `*italic*` emphasis inside text and quote copy is preserved in the downloaded PPTX,
- image fields export with contain sizing,
- quote attribution may be overridden by `config.universalQuoteAttribution`,
- quote attribution may be hidden by `config.hideAttrib`,
- inline source markers remain in slide text, and the corresponding supporting quotes are appended to that slide's speaker notes as numbered footnotes,
- if `config.hideSourceAttribution` is true, those speaker-note footnotes omit interviewee/source names and show only the quote text,
- `hideAllImages` changes quote export styling too,
- speaker notes export as actual PowerPoint speaker notes.

---

## 12) Required vs optional summary

### Root
- Required: `slides` unless root is a bare slide array
- Optional: `config`
- Optional: `references`

### Slide
- Required: no single key is strictly required if the object can be recognized and normalized as a slide
- Strongly recommended:
  - `type`
  - `title`
  - `bodyField` for standard slides
  - `columns` for two-column slides

### Field
- Required: no single key is strictly required because Designer fills defaults
- Strongly recommended:
  - `mode`
  - `text` for text fields
  - `imageUrl` or `imagePrompt`/`imageNotes` for image fields
  - `quoteText` for quote fields

### Sources
- `sources` is optional
- each source item should include `text`
- `interviewee` is optional

### References
- `references` is optional
- each reference item should include integer `id` and a `sources` array
- each `sources[]` item should include `text`
- `interviewee`, `sourceLabel`, and `timestamp` are optional per source item
- inline `(12)` markers resolve against this top-level list

---

## 13) Minimal examples

### Example A — smallest useful deck

```json
{
  "slides": [
    {
      "type": "standard",
      "title": "Hello",
      "bodyField": {
        "mode": "text",
        "text": "* One bullet"
      }
    }
  ]
}
```

### Example B — deck with universal image style

```json
{
  "references": [
    {
      "id": 12,
      "sources": [
        {
          "text": "The process depends on workarounds and manual coordination.",
          "interviewee": "Lauren Verrill",
          "sourceLabel": "Lauren Verrill.md"
        },
        {
          "text": "Handoffs still depend on individual follow-up and memory.",
          "interviewee": "Caleb Bone"
        }
      ]
    }
  ],
  "config": {
    "showShapes": true,
    "hideAttrib": false,
    "imagePromptStyle": "cinematic documentary photo, warm natural light"
  },
  "slides": [
    {
      "type": "cover",
      "title": "Heart Walk",
      "subtitle": "Deck draft"
    },
    {
      "type": "standard",
      "title": "What we heard",
      "bodyField": {
        "mode": "text",
        "text": "### Highlights\n* First point (12)\n* Second point"
      }
    },
    {
      "type": "image",
      "title": "",
      "bodyField": {
        "mode": "image",
        "imageUrl": ""
      }
    },
    {
      "type": "two-column",
      "title": "Visual + notes",
      "columns": {
        "layoutMode": "stacked-left",
        "splitPct": 50,
        "leftField": {
          "mode": "text",
          "text": "* Add annotations here (12)"
        },
        "bottomField": {
          "mode": "quote",
          "quoteText": "The process depends on workarounds and manual coordination. (12)",
          "quoteAttribution": "Lauren Verrill"
        },
        "rightField": {
          "mode": "image",
          "imageUrl": "",
          "imagePrompt": "A simple diagram showing the process flow",
          "imageNotes": "A simple diagram showing the process flow",
          "imageAlign": "center"
        }
      }
    }
  ]
}
```

---

## 14) Recommendations for AI authors

When asking an AI to produce Designer JSON:
- request valid JSON only,
- prefer explicit `bodyField` / `columns` over legacy `content`,
- use `type: "image"` when the slide should be one large image with an optional title,
- use top-level `references` plus inline `(12)` markers when individual claims need transcript traceability,
- make each numbered reference contain all supporting quotes for that sentence or quote inside `references[n].sources`,
- include `config.imagePromptStyle` only if you want a deck-level universal style,
- use `imagePrompt` and `imageNotes` for image fields that should be generatable,
- include `sources` only when provenance should be retained,
- keep custom metadata at the slide level if it must survive round-trip editing.

If in doubt, use the Example B pattern above.
