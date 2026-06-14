# SVG Export + Center Label Toggle — Design Spec

**Version:** 1.2.0  
**Date:** 2026-06-14  
**Status:** Approved

---

## Overview

Two features shipped together:

1. **SVG export** — output format selector (PNG / SVG) in Advanced Settings. SVG includes full feature parity with PNG: Pax Cultura center label and Title/Footer text overlays rendered as native SVG elements.
2. **Center label toggle** — checkbox in Advanced Settings to show/hide the Pax Cultura symbol. Replaces the `ENABLE_CENTER_LABEL` code constant. Applies to both PNG and SVG output, and to the preview panel.

---

## UI Changes

### Advanced Settings block

Each control on its own line (no inline "train"). New controls added below the existing Image Size row:

```
Image Size (px):   [select ▾]

Output format:     [select ▾]   ← new (PNG / SVG)

[✓] Center label (Pax Cultura)  ← new checkbox
```

**Output format select** (`id="output-format-select"`):
- Options: `PNG` (value `png`), `SVG` (value `svg`)
- Default: `png`
- Persisted to `chrome.storage.local` key `outputFormat`

**Center label checkbox** (`id="center-label-checkbox"`):
- Label: `Center label (Pax Cultura)`
- Default: checked
- Persisted to `chrome.storage.local` key `showCenterLabel`
- Replaces the `const ENABLE_CENTER_LABEL = true` constant in `bulk.js` — the constant is removed

### Behavior on change

Both controls trigger `renderPreview()` immediately on change.

---

## PNG path (unchanged behavior)

`generateQRCodeBlob()` receives `showCenterLabel` from the checkbox (previously hardcoded via constant). No other changes to the PNG path.

---

## SVG Generation

New function:

```
generateQRCodeSVG(lineData, imageSize, fgColor, bgColor, showCenterLabel)
  → Promise<Blob>
```

### Steps

**1. Generate base SVG from library**

```js
QRCode.toString(lineData.url, {
    type: 'svg',
    width: imageSize,
    color: { dark: fgColor, light: bgColor }
})
```

Returns an SVG string with a square `viewBox="0 0 N N"` and a `<path>` element for QR modules.

**2. Parse into DOM**

```js
const parser = new DOMParser();
const doc = parser.parseFromString(svgString, 'image/svg+xml');
const svg = doc.documentElement;
```

**3. Add center label (if `showCenterLabel`)**

Translate the Canvas 2D Pax Cultura drawing into SVG elements appended to `<svg>`:

- Parse `viewBox` to get `size` (width = height of the square QR area).
- `r = size * 0.07` (same proportion as Canvas version)
- `cx = cy = size / 2`
- `pad = r * 0.15`, `cornerR = r * 0.22`, `sw = r * 0.13`

Elements to append:
```xml
<!-- Rounded background -->
<rect x="cx-r-pad" y="cy-r-pad" width="(r+pad)*2" height="(r+pad)*2"
      rx="cornerR" ry="cornerR" fill="bgColor" />

<!-- Outer ring -->
<circle cx="cx" cy="cy" r="r - sw/2"
        stroke="fgColor" stroke-width="sw" fill="none" />

<!-- Three dots: equilateral triangle, apex up -->
<!-- offsets: [0,-1], [-0.866,0.5], [0.866,0.5] × dotDist -->
<!-- dotDist = r * 0.47, dotR = r * 0.24 -->
<circle cx="..." cy="..." r="dotR" fill="fgColor" />
<circle cx="..." cy="..." r="dotR" fill="fgColor" />
<circle cx="..." cy="..." r="dotR" fill="fgColor" />
```

**4. Add text overlays (if topText or bottomText)**

Font size and line height use the same ratios as PNG:
- `fontSize = Math.max(12, Math.round(imageSize * 0.08))`
- `lineHeight = Math.round(fontSize * 1.3)`
- `padding = Math.max(8, imageSize * 0.02)`

Text wrapping via SVG measurement:
- Create a temporary off-screen `<svg>` element appended to `document.body`.
- Add a `<text>` element with the target font; measure `getComputedTextLength()` character by character (same algorithm as Canvas `wrapTextToWidth`).
- Remove the temporary element after measurement.
- Result: array of wrapped lines.

ViewBox adjustment:
- `topHeight = padding + topLines.length * lineHeight + padding` (0 if no topText)
- `bottomHeight = padding + bottomLines.length * lineHeight + padding` (0 if no bottomText)
- New `viewBox`: `"0 0 {size} {size + topHeight + bottomHeight}"`
- Existing QR content wrapped in `<g transform="translate(0, {topHeight})">` (shifts QR down to make room for top text). Center label elements, if added in step 3, must also be inside this `<g>` — they should be appended there, not directly to `<svg>`.

Top text block:
```xml
<text x="size/2" y="padding" font-size="fontSize"
      font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
      fill="fgColor" text-anchor="middle" dominant-baseline="hanging">
  <tspan x="size/2" dy="0">line 1</tspan>
  <tspan x="size/2" dy="lineHeight">line 2</tspan>
  ...
</text>
```

Bottom text block: `y = size + topHeight + padding`, same structure.

**5. Serialize and return Blob**

```js
const serializer = new XMLSerializer();
const svgText = serializer.serializeToString(svg);
return new Blob([svgText], { type: 'image/svg+xml' });
```

---

## handleGenerate integration

```
const format = elements.outputFormatSelect.value; // 'png' or 'svg'
const showCenterLabel = elements.centerLabelCheckbox.checked;

// inside loop:
const blob = format === 'svg'
    ? await generateQRCodeSVG(lineData, imageSize, fgColor, bgColor, showCenterLabel)
    : await generateQRCodeBlob(lineData, imageSize, true, true, showCenterLabel);

const fileName = getUniqueFileName(rawName, usedFileNames) + (format === 'svg' ? '.svg' : '.png');
```

ZIP mode: SVG blobs added to zip the same way as PNG blobs. No change to ZIP logic.

---

## Preview Panel

Preview always renders via Canvas (PNG path). `showCenterLabel` is read from the checkbox and passed to `drawCenterLabel()`. No SVG rendering in preview.

The `drawCenterLabel()` function signature change:
```js
// before: reads ENABLE_CENTER_LABEL constant internally
// after: caller passes showCenterLabel boolean
function drawCenterLabel(ctx, size, fgColor, bgColor, showCenterLabel) {
    if (!showCenterLabel) return;
    // ... rest unchanged
}
```

---

## Storage

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `outputFormat` | string | `'png'` | Selected output format |
| `showCenterLabel` | boolean | `true` | Center label visibility |

Both restored on `DOMContentLoaded` with fallback to defaults.

---

## CSS

Advanced Settings rows follow the existing `control-group` pattern. Each new control is its own `.control-group` div — same as Image Size row. No new CSS classes needed.

---

## Version

`manifest.json`: `1.1.0` → `1.2.0`

---

## What is NOT changing

- PNG generation logic (except center label boolean threading)
- ZIP assembly logic
- Filename template system
- Column mapping
- Error log (`errors.txt`)
- File destination folder structure

---

## Out of scope

- SVG preview in the preview panel
- Per-file format selection (format is batch-level)
- SVG → PDF conversion
- Custom center image (remains deferred)
