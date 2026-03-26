# PptxGenJS Reference — Lessons & Patterns from the Designer App

> A practical guide to everything we've learned about generating PowerPoint decks
> from a browser-based app using **PptxGenJS v3.12.0**.

---

## 1. Library Loading

Load the bundle from CDN — no npm/build step required:

```html
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
```

This exposes the global `PptxGenJS` constructor.

---

## 2. Presentation Creation & Layout

```js
let pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE';   // 13.33 × 7.5 inches
```

| Layout constant | Width (in) | Height (in) |
|-----------------|-----------|-------------|
| `LAYOUT_16x9`  | 10.0      | 5.63        |
| `LAYOUT_WIDE`  | 13.33     | 7.5         |

**We use `LAYOUT_WIDE`** because it's closer to a modern widescreen deck and
gives enough horizontal real-estate for two-column layouts.

### CSS-to-Inches Mapping (Designer Canvas)

The canvas preview is 1280 × 720 px with `padding: 60px 80px`.

| CSS value | Inches equivalent | Notes |
|-----------|------------------|-------|
| 80 px left padding  | 0.83 in | `baseX` in export code |
| 60 px top padding   | 0.63 in | `baseY` for title row  |
| 1280 px total width | 13.33 in | `LAYOUT_WIDE` width   |
| 720 px total height | 7.5 in  | `LAYOUT_WIDE` height  |
| Content area 1120 px | 11.67 in | `totalW` for body fields |

Conversion factor: **1 inch ≈ 96 CSS-px** at this scale.

---

## 3. Slides

```js
slidesData.forEach((data, index) => {
    let slide = pres.addSlide();
    // populate…
});
```

Each slide is built imperatively—add text, images, shapes one call at a time.

### Slide Numbers

```js
slide.slideNumber = { x: '95%', y: '90%', fontSize: 10, color: '999999' };
```

---

## 4. Text — `addText()`

### Simple call

```js
slide.addText('Hello World', {
    x: 0.83, y: 0.63, w: 11.67, h: 1,
    fontSize: 28, color: '16bfec',
    bold: true, align: 'center', fontFace: 'Arial'
});
```

### Key text options

| Option | Type | Notes |
|--------|------|-------|
| `x`, `y` | number or `'50%'` | Position in inches or percentage of slide |
| `w`, `h` | number or `'90%'` | Size in inches or percentage |
| `fontSize` | number (pt) | |
| `color` | hex string **without** `#` | e.g. `'333333'` |
| `bold` | boolean | |
| `italic` | boolean | |
| `align` | `'left'` · `'center'` · `'right'` | Horizontal |
| `valign` | `'top'` · `'middle'` · `'bottom'` | Vertical |
| `fontFace` | string | e.g. `'Arial'` |
| `paraSpaceBefore` | number (pt) | Space before paragraph |
| `paraSpaceAfter` | number (pt) | Space after paragraph |
| `breakLine` | boolean | Forces a line-break after this text run |
| `bullet` | `{ indent: N }` or `{ type:'number', indent: N }` or `false` | |
| `indentLevel` | number | Nesting depth for bullets |

### Rich text (array of text-objects)

`addText()` also accepts an **array** of objects, each with its own `text` and
`options`. This is how we render bullet lists and mixed formatting:

```js
slide.addText([
    { text: 'Bold header', options: { bold: true, fontSize: 20, breakLine: true } },
    { text: 'Normal body',  options: { fontSize: 16, breakLine: true } }
], { x: 0.83, y: 1.83, w: 11.67, h: 5, valign: 'top' });
```

---

## 5. Images — `addImage()`

### From a URL / file path

```js
slide.addImage({
    path: imageUrl,
    x: 1, y: 2, w: 4, h: 3,
    sizing: { type: 'contain', x: 1, y: 2, w: 4, h: 3 }
});
```

`sizing: { type: 'contain' }` keeps aspect ratio inside the bounding box.

### From a base64 data-URI

```js
slide.addImage({
    data: 'data:image/png;base64,' + b64String,
    x: 0, y: 0, w: 13.33, h: 7.5
});
```

### Inline SVG → base64 (the most useful trick)

Construct an SVG string in JS, convert it to base64 with `btoa()`, and embed it
as an image. This lets you create **arbitrary vector graphics** — shapes,
speech-bubbles, decorative corners — directly in the PPTX without external
files.

```js
const svg = '<svg xmlns="http://www.w3.org/2000/svg"'
    + ' viewBox="0 0 1720 963" preserveAspectRatio="none">'
    + '<path d="M0 200.6C0 89.8…" fill="#F5E5B3"/>'
    + '</svg>';

slide.addImage({
    data: 'data:image/svg+xml;base64,' + btoa(svg),
    x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH
});
```

**Key points:**

- Always include `xmlns="http://www.w3.org/2000/svg"` or the PPTX won't render it.
- Use `preserveAspectRatio="none"` when you want the SVG stretched to fill
  the bounding box exactly (e.g. background shapes).
- Omit `preserveAspectRatio` (or use `"xMidYMid meet"`) when you want the
  SVG to scale uniformly.
- Colors inside the SVG use the `#` prefix normally; no need to strip it.

---

## 6. Bullet & Numbered Lists — `parseBullets()`

This is the pattern we use to convert markdown-style text into PptxGenJS
rich-text arrays:

```js
const parseBullets = (mdText, basePt) => {
    const lines = mdText.split('\n');
    let items = [];

    lines.forEach(line => {
        // ── Indentation ──
        const indentMatch = line.match(/^(\s*)/);
        const rawIndent = indentMatch ? indentMatch[1] : '';
        const indentLevel = Math.floor(
            rawIndent.replace(/\t/g, '  ').length / 2
        );
        let clean = line.trim();

        // Empty line → small spacer
        if (!clean) {
            items.push({
                text: '',
                options: { breakLine: true, fontSize: basePt * 0.5 }
            });
            return;
        }

        let isBullet = false, isNumbered = false, isBold = false;
        let fontSize = basePt;

        // ### Header
        if (clean.startsWith('### ')) {
            clean = clean.substring(4);
            isBold = true;
            fontSize += 2;
        }
        // Bullet: *, -, +
        else if (/^[\*\-\+]\s+/.test(clean)) {
            clean = clean.replace(/^[\*\-\+]\s+/, '');
            isBullet = true;
        }
        // Numbered: 1. or 1)
        else if (/^\d+[\.\)]\s+/.test(clean)) {
            clean = clean.replace(/^\d+[\.\)]\s+/, '');
            isNumbered = true;
        }

        // Paragraph spacing
        const isRoot = (isBullet || isNumbered) && indentLevel === 0;
        const paraSpaceAfter = (!isBullet && !isNumbered && !isBold) ? 12
            : isRoot ? 8
            : 3;

        items.push({
            text: clean,
            options: {
                breakLine: true,
                bullet: isBullet
                    ? { indent: indentLevel * 18 }
                    : isNumbered
                        ? { type: 'number', indent: indentLevel * 18 }
                        : false,
                bold: isBold,
                fontSize,
                indentLevel,
                paraSpaceBefore: isBold ? 10 : (indentLevel > 0 ? 2 : 5),
                paraSpaceAfter
            }
        });
    });
    return items;
};
```

### Using it

```js
const basePt = getPt('size-p-normal', '16pt');
const textObjects = parseBullets(fieldText, basePt);

// Apply color/font to every item
textObjects.forEach(obj => {
    obj.options.color = '333333';
    obj.options.fontFace = 'Arial';
});

slide.addText(textObjects, { x, y, w, h, valign: 'top' });
```

---

## 7. SVG Embedding Patterns

### Decorative shape (background, stretched)

```js
const shapeSvg = '<svg xmlns="http://www.w3.org/2000/svg"'
    + ' viewBox="' + viewBox + '" preserveAspectRatio="none">'
    + '<path d="' + pathData + '" fill="#' + hex + '" fill-opacity="0.9"/>'
    + '</svg>';

slide.addImage({
    data: 'data:image/svg+xml;base64,' + btoa(shapeSvg),
    x: '55%', y: '35%', w: '45%', h: '65%'
});
```

### Speech-bubble quote box

```js
// viewBox matches the original design (Figma / Illustrator export)
const bubbleSvg = '<svg xmlns="http://www.w3.org/2000/svg"'
    + ' viewBox="0 0 1720 963" preserveAspectRatio="none">'
    + '<path d="M0 200.6C0 89.8 89.8 0 200.6 0L1519.4 0…" fill="#F5E5B3"/>'
    + '<path d="M257 743 496 743 376.5 963Z" fill="#F5E5B3"/>'  // triangle pointer
    + '</svg>';

const bubbleW = w * 0.9;
const bubbleH = h * 0.5;
const bubbleX = x + (w - bubbleW) / 2;          // centered horizontally
const bubbleY = y + (h * 0.4) - (bubbleH / 2);  // visual center at 40%

slide.addImage({
    data: 'data:image/svg+xml;base64,' + btoa(bubbleSvg),
    x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH
});

// Then overlay the quote text on top of the bubble
slide.addText(quoteText, {
    x: bubbleX + bubbleW * 0.08,
    y: bubbleY + bubbleH * 0.10,
    w: bubbleW * 0.84,
    h: bubbleH * 0.70,
    fontSize: h3Pt, color: '333333',
    fontFace: 'Arial', valign: 'middle', align: 'center'
});
```

---

## 8. Two-Column Layout Calculations

```js
const split = Math.max(20, Math.min(80,
    Number(data.columns?.splitPct ?? 50)
));
const totalW = 11.67;       // usable width in inches
const gap    = 0.18;        // column gap
const leftW  = (totalW - gap) * (split / 100);
const rightW = (totalW - gap) - leftW;
const baseX  = 0.83;        // left margin
const baseY  = 1.83;        // top of body

// Left column
addFieldToPpt(slide, data.columns.left,
    baseX, baseY, leftW, 5.0);

// Right column
addFieldToPpt(slide, data.columns.right,
    baseX + leftW + gap, baseY, rightW, 5.0);
```

---

## 9. Color & Size Helper Functions

```js
// Resolve a CSS variable or hex color to a bare hex string (no #)
const getHex = (key, fallback) => {
    let val = appConfig[key] || fallback;
    if (cssVarMap[val]) val = cssVarMap[val];
    return val.replace('#', '');
};

// Resolve a "28pt" string to a number
const getPt = (key, fallback) => {
    let val = appConfig[key] || fallback;
    return parseInt(val.replace('pt', ''));
};

// Font-size scale key per field
const getScaleKey = (safeField) => {
    const scale = String(safeField?.textScale || 'normal');
    if (scale === 'large')  return 'p-large';
    if (scale === 'small')  return 'p-small';
    return 'p-normal';
};
```

---

## 10. Download / Save

```js
pres.writeFile({ fileName: 'My_Presentation.pptx' });
```

This triggers a browser download of the `.pptx` file. No server round-trip.

---

## Gotchas & Tips

| Problem | Solution |
|---------|----------|
| SVG not rendering in PPTX | Add `xmlns="http://www.w3.org/2000/svg"` to the `<svg>` tag |
| Shape stretched wrong | Use `preserveAspectRatio="none"` to fill the bounding box |
| Colors with `#` cause issues | Strip `#` before passing to PptxGenJS text options |
| CSS `padding-top: 50%` isn't half the height | CSS % padding is relative to the **width** of the parent, not the height. Use `aspect-ratio` or explicit `px`/`vh` instead |
| `LAYOUT_16x9` vs `LAYOUT_WIDE` | They have different dimensions — don't assume 16:9. Double-check the constants. |
| Unicode curly-quotes in source | `\u201C` / `\u201D` can't be matched by some text-replace tools. Use Python scripts for replacements involving these characters. |
| `btoa()` fails on non-ASCII | If your SVG contains non-ASCII, use `btoa(unescape(encodeURIComponent(svgString)))` |
| Bullet `indent` but no visual nesting | You also need `indentLevel` to tell PptxGenJS the depth |
| Empty lines collapse in PPTX | Insert a spacer text-object `{ text:'', options:{ breakLine:true, fontSize: basePt*0.5 }}` |
| Percentage coordinates | `x:'50%'`, `y:'40%'` — percentages are relative to slide width/height respectively |
