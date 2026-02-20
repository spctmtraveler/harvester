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

## 3. JSON Schema Definition

To ingest data into the app, generate a JSON object with two root keys: `config` and `slides`.

### The Config Object
```json
{
  "config": {
    "font-title": "'Source Sans 3', sans-serif",
    "size-title": "32pt",
    "color-title": "#16bfec",
    "showShapes": true,
    "globalX": 0,
    "globalY": 0,
    "typeOffsets": {
        "cover": { "x": 0, "y": 0 },
        "section": { "x": 0, "y": 0 },
        "standard": { "x": 0, "y": 0 },
        "two-column": { "x": 0, "y": 0 }
    }
  }
}
```

### The Slides Array
```json
{
  "slides": [
    {
      "type": "cover",
      "title": "Project Alpha",
      "subtitle": "Q1 Report",
      "shapeColor": "var(--c-emotional)"
    },
    {
      "type": "standard",
      "title": "Key Metrics",
      "content": "### Growth\n* Revenue up 20%",
      "bodyField": {
        "mode": "text",
        "text": "### Growth\n* Revenue up 20%",
        "imageUrl": "",
        "imageAlign": "center",
        "imagePrompt": "A chart showing year-over-year revenue growth",
        "quoteText": "",
        "quoteAttribution": ""
      }
    },
    {
      "type": "two-column",
      "title": "What Leaders Say",
      "content": "• Key insight\n• Another point",
      "columns": {
        "splitPct": 55,
        "leftField": {
          "mode": "text",
          "text": "• Key insight\n• Another point",
          "imageUrl": "",
          "imageAlign": "center",
          "imagePrompt": "",
          "quoteText": "",
          "quoteAttribution": ""
        },
        "rightField": {
          "mode": "quote",
          "text": "",
          "imageUrl": "",
          "imageAlign": "center",
          "imagePrompt": "",
          "quoteText": "This was a game-changer for us.",
          "quoteAttribution": "Lauren Verrill"
        }
      }
    }
  ]
}
```

### Slide Types

| Type | Description |
|------|-------------|
| `cover` | Title + subtitle, centered, decorative shape |
| `section` | Section divider, centered H1 |
| `standard` | Title + single content field (bodyField) |
| `two-column` | Title + two side-by-side fields with draggable divider |

### Field Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `"text"` / `"image"` / `"quote"` | Determines rendering mode |
| `text` | string | Markdown text content (used when mode=text) |
| `imageUrl` | string | URL or data-URI (used when mode=image) |
| `imageAlign` | `"center"` / `"left"` / `"right"` / `"top"` / `"bottom"` | Image alignment |
| `imagePrompt` | string | AI-suggested image description (shown as hint) |
| `quoteText` | string | Quote body text (used when mode=quote) |
| `quoteAttribution` | string | Speaker name for quote attribution |

## 4. Robust Ingestion Strategy

The app includes a Sanitizer Engine to handle imperfect JSON input from external AI agents.

> **Philosophy: "Accept everything, break nothing."**

- **Missing Fields**: If `type` is missing, defaults to `standard`. If `config` is missing, loads default brand palette. If `bodyField` is missing on a standard slide, it is auto-created from `content`.
- **Unexpected Fields**: Preserved in JSON but ignored for rendering. Data survives Export → Modify → Import cycles.
- **Backward Compatibility**: Legacy slides without `bodyField` or `columns` are auto-migrated via `ensureSlideSchema()`.
- **Reporting**: Toast notifications list what was auto-corrected.

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
- [ ] AI image generation (DALL-E 3 integration — deferred, proxy extension needed)
- [ ] Image version history (deferred)
- [ ] Image prompt editing and regeneration (deferred)