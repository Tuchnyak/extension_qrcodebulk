# Design Spec: Pax Cultura Center Label (Step 40)

**Date:** 2026-05-22  
**Branch:** feature/visual_options  
**Status:** Approved

---

## Overview

Draw the Pax Cultura / Banner of Peace symbol (Roerich) in the center of every generated QR code. The symbol follows the foreground color setting and sits on a background-colored rounded pad.

---

## Behaviour

- Symbol is always rendered — no user toggle in the UI.
- Kill switch: `const ENABLE_CENTER_LABEL = true` at the top of `src/bulk.js`. Set to `false` to disable globally without touching logic.
- Applied to both final generated images and the live preview.

---

## Visual Design

**Symbol:** Classic Pax Cultura variant — thin outer ring + three filled circles arranged in an equilateral triangle (apex up).

**Sizing (relative to QR canvas width `size`):**

| Property | Value |
|---|---|
| Label diameter | 20% of `size` (radius `r = size * 0.10`) |
| Background pad | 15% of `r` on each side |
| Background corner radius | 22% of `r` |
| Ring stroke width | 13% of `r` |
| Dot radius | 24% of `r` |
| Dot center distance | 47% of `r` from image center |

**Colors:**
- Background pad fill: `bgColor` (matches QR background)
- Ring stroke: `fgColor`
- Dot fill: `fgColor`

---

## Implementation

### New function: `drawCenterLabel(ctx, size, fgColor, bgColor)`

Location: `src/bulk.js`, standalone function.

```
1. Draw rounded-rect background using ctx.roundRect() filled with bgColor
2. Draw outer ring: ctx.arc() with strokeStyle = fgColor
3. Draw three dots at equilateral triangle positions (apex up):
   - Top:          (cx,                cy - dotDist)
   - Bottom-left:  (cx - dotDist*0.866, cy + dotDist*0.5)
   - Bottom-right: (cx + dotDist*0.866, cy + dotDist*0.5)
```

### Integration points

`drawCenterLabel()` is called in two places, immediately after `QRCode.toCanvas()` produces `qrCanvas` and **before** `createCompositeCanvas()` (so the label is part of the QR square, not the text areas):

1. `generateQRCodeBlob()` — affects saved files
2. `generatePreviewQR()` — affects live preview

Both functions already have `fgColor` and `bgColor` available as local variables.

---

## Scope of this PR

| Task | File |
|---|---|
| Add `ENABLE_CENTER_LABEL` constant | `src/bulk.js` |
| Add `drawCenterLabel()` function | `src/bulk.js` |
| Call `drawCenterLabel()` in `generateQRCodeBlob()` | `src/bulk.js` |
| Call `drawCenterLabel()` in `generatePreviewQR()` | `src/bulk.js` |
| Remove 3 debug `console.log` calls from `toggleColorPicker()` | `src/bulk.js` |
| Mark Step 41 as deferred in todo | `02_todo.md` |
| Delete stale artifact | `dist/qr-worker.js` |
| Rebuild | `dist/` |

---

## Out of Scope (deferred)

**Step 41 — Custom Center Image:** Allow user to upload their own image to replace the Pax Cultura symbol. Deferred to a future feature branch due to added complexity and risk to QR scanability.
