# SVG Export + Center Label Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SVG output format with full feature parity (center label + text overlays as native SVG elements), and a checkbox to toggle the Pax Cultura center label on/off for both PNG and SVG.

**Architecture:** All changes in `src/bulk.html` and `src/bulk.js`. Two new pure helpers (`addCenterLabelToSVG`, `wrapTextToSVGWidth`) feed a new `generateQRCodeSVG` async function. Format dispatch in `handleGenerate` selects between existing PNG path and new SVG path.

**Tech Stack:** Plain JS (ES6+), `qrcode` library (`QRCode.toString` with `type: 'svg'`), `DOMParser`, `XMLSerializer`, SVG DOM (`createElementNS`, `getComputedTextLength`).

**Spec:** `docs/superpowers/specs/2026-06-14-svg-export-design.md`

---

### Task 1: Feature branch + version bump

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/svg-export
```

- [ ] **Step 2: Bump version in `manifest.json`**

Change:
```json
"version": "1.1.0",
```
to:
```json
"version": "1.2.0",
```

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "chore: bump version to 1.2.0"
```

---

### Task 2: Center label toggle

Removes the `ENABLE_CENTER_LABEL` constant, threads a `showCenterLabel` boolean into `drawCenterLabel` and `generateQRCodeBlob`, adds a checkbox to the UI, wires storage.

**Files:**
- Modify: `src/bulk.js`
- Modify: `src/bulk.html`

- [ ] **Step 1: Remove `ENABLE_CENTER_LABEL` constant from `src/bulk.js`**

Delete line 21:
```js
const ENABLE_CENTER_LABEL = true;
```

- [ ] **Step 2: Update `drawCenterLabel` signature (line 733)**

Change:
```js
function drawCenterLabel(ctx, size, fgColor, bgColor) {
    if (!ENABLE_CENTER_LABEL) return;
```
to:
```js
function drawCenterLabel(ctx, size, fgColor, bgColor, showCenterLabel) {
    if (!showCenterLabel) return;
```

- [ ] **Step 3: Update `generateQRCodeBlob` — add parameter (line 597)**

Change signature:
```js
async function generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText) {
```
to:
```js
async function generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText, showCenterLabel) {
```

Change the `drawCenterLabel` call inside it (line 619):
```js
drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor, showCenterLabel);
```

- [ ] **Step 4: Update `generatePreviewQR` — read checkbox (line 1009)**

Change:
```js
drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor);
```
to:
```js
drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor, elements.centerLabelCheckbox.checked);
```

- [ ] **Step 5: Add checkbox to `src/bulk.html`**

In the Advanced Settings block, after the `image-size-input` control-group div, add:
```html
<div class="control-group">
    <label class="has-header-label">
        <input type="checkbox" id="center-label-checkbox" checked> Center label (Pax Cultura)
    </label>
</div>
```

- [ ] **Step 6: Add element to `initializeElements()` in `src/bulk.js`**

Add to the `elements = { ... }` object:
```js
centerLabelCheckbox: document.getElementById('center-label-checkbox'),
```

- [ ] **Step 7: Add event listener in `wireUpEventListeners()`**

Add:
```js
elements.centerLabelCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ showCenterLabel: elements.centerLabelCheckbox.checked });
    renderPreview();
});
```

- [ ] **Step 8: Add restore function** (after `restoreColorSettings`):

```js
function restoreShowCenterLabel() {
    chrome.storage.local.get(['showCenterLabel'], (result) => {
        if (result.showCenterLabel !== undefined) {
            elements.centerLabelCheckbox.checked = result.showCenterLabel;
        }
        renderPreview();
    });
}
```

- [ ] **Step 9: Call restore in `DOMContentLoaded`** (after `restoreColorSettings()`, line 1354):

```js
restoreShowCenterLabel();
```

- [ ] **Step 10: Add to `lockUI` and `unlockUI` controls arrays**

In both the `lockUI()` and `unlockUI()` functions, add to the `controls` array:
```js
elements.centerLabelCheckbox,
```

- [ ] **Step 11: Build and smoke test**

```bash
npm run build
```

Load unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → project root).

Verify:
- Checkbox appears in Advanced Settings.
- Toggling it updates the preview panel immediately (label appears/disappears).
- Refreshing the page restores the saved checkbox state.

- [ ] **Step 12: Commit**

```bash
git add src/bulk.html src/bulk.js
git commit -m "feat: replace ENABLE_CENTER_LABEL constant with UI checkbox"
```

---

### Task 3: Output format select

**Files:**
- Modify: `src/bulk.html`
- Modify: `src/bulk.js`

- [ ] **Step 1: Add select to `src/bulk.html`**

In the Advanced Settings block, after the center-label-checkbox div (added in Task 2), add:
```html
<div class="control-group">
    <label for="output-format-select">Output format:</label>
    <select id="output-format-select">
        <option value="png">PNG</option>
        <option value="svg">SVG</option>
    </select>
</div>
```

- [ ] **Step 2: Add element to `initializeElements()`**

Add to the `elements = { ... }` object:
```js
outputFormatSelect: document.getElementById('output-format-select'),
```

- [ ] **Step 3: Add event listener in `wireUpEventListeners()`**

Add:
```js
elements.outputFormatSelect.addEventListener('change', () => {
    chrome.storage.local.set({ outputFormat: elements.outputFormatSelect.value });
});
```

- [ ] **Step 4: Add restore function** (after `restoreShowCenterLabel`):

```js
function restoreOutputFormat() {
    chrome.storage.local.get(['outputFormat'], (result) => {
        if (result.outputFormat) {
            elements.outputFormatSelect.value = result.outputFormat;
        }
    });
}
```

- [ ] **Step 5: Call restore in `DOMContentLoaded`** (after `restoreShowCenterLabel()`):

```js
restoreOutputFormat();
```

- [ ] **Step 6: Add to `lockUI` and `unlockUI` controls arrays**

In both functions, add:
```js
elements.outputFormatSelect,
```

- [ ] **Step 7: Build and smoke test**

```bash
npm run build
```

Verify: select appears in Advanced Settings. Switching to SVG and refreshing stays on SVG.

- [ ] **Step 8: Commit**

```bash
git add src/bulk.html src/bulk.js
git commit -m "feat: add output format selector (PNG/SVG)"
```

---

### Task 4: `addCenterLabelToSVG()` helper

Pure function that appends Pax Cultura SVG elements to any SVG container (`<svg>` or `<g>`). Proportions are identical to `drawCenterLabel()`. Uses `container.ownerDocument` so elements are created in the correct SVG document.

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add function after `drawCenterLabel` (after line 765)**

```js
function addCenterLabelToSVG(container, size, fgColor, bgColor) {
    const doc = container.ownerDocument;
    const ns = 'http://www.w3.org/2000/svg';
    const r = size * 0.07;
    const cx = size / 2;
    const cy = size / 2;
    const pad = r * 0.15;
    const cornerR = r * 0.22;
    const sw = r * 0.13;
    const dotR = r * 0.24;
    const dotDist = r * 0.47;

    const bg = doc.createElementNS(ns, 'rect');
    bg.setAttribute('x', cx - r - pad);
    bg.setAttribute('y', cy - r - pad);
    bg.setAttribute('width', (r + pad) * 2);
    bg.setAttribute('height', (r + pad) * 2);
    bg.setAttribute('rx', cornerR);
    bg.setAttribute('ry', cornerR);
    bg.setAttribute('fill', bgColor);
    container.appendChild(bg);

    const ring = doc.createElementNS(ns, 'circle');
    ring.setAttribute('cx', cx);
    ring.setAttribute('cy', cy);
    ring.setAttribute('r', r - sw / 2);
    ring.setAttribute('stroke', fgColor);
    ring.setAttribute('stroke-width', sw);
    ring.setAttribute('fill', 'none');
    container.appendChild(ring);

    [[0, -1], [-0.866, 0.5], [0.866, 0.5]].forEach(([dx, dy]) => {
        const dot = doc.createElementNS(ns, 'circle');
        dot.setAttribute('cx', cx + dx * dotDist);
        dot.setAttribute('cy', cy + dy * dotDist);
        dot.setAttribute('r', dotR);
        dot.setAttribute('fill', fgColor);
        container.appendChild(dot);
    });
}
```

- [ ] **Step 2: Build to verify no syntax errors**

```bash
npm run build
```

Expected: exits without errors.

- [ ] **Step 3: Commit**

```bash
git add src/bulk.js
git commit -m "feat: add addCenterLabelToSVG() helper"
```

---

### Task 5: `wrapTextToSVGWidth()` helper

Mirrors `wrapTextToWidth()` but uses SVG `getComputedTextLength()`. Accepts the target SVG's `viewBox` string so the temporary measurement SVG shares the same coordinate space — ensuring the returned line widths are in SVG user units.

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add function after `wrapTextToWidth` (after line 731)**

```js
function wrapTextToSVGWidth(text, maxWidth, fontSize, viewBox) {
    const ns = 'http://www.w3.org/2000/svg';
    const testSvg = document.createElementNS(ns, 'svg');
    testSvg.setAttribute('viewBox', viewBox);
    testSvg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:1px;height:1px';
    document.body.appendChild(testSvg);

    const testText = document.createElementNS(ns, 'text');
    testText.setAttribute('font-size', fontSize);
    testText.setAttribute('font-family', 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
    testSvg.appendChild(testText);

    const lines = [];
    let currentLine = '';

    for (const ch of text) {
        const next = currentLine + ch;
        testText.textContent = next;
        if (testText.getComputedTextLength() <= maxWidth || currentLine.length === 0) {
            currentLine = next;
        } else {
            lines.push(currentLine);
            currentLine = ch;
        }
    }
    if (currentLine) lines.push(currentLine);

    document.body.removeChild(testSvg);
    return lines;
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: exits without errors.

- [ ] **Step 3: Commit**

```bash
git add src/bulk.js
git commit -m "feat: add wrapTextToSVGWidth() helper"
```

---

### Task 6: `generateQRCodeSVG()` function

Full SVG generation pipeline. Returns `Promise<Blob>` (`image/svg+xml`). Reads colors from DOM exactly like `generateQRCodeBlob`. Coordinate arithmetic uses the SVG's own viewBox user-unit space throughout.

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add function after `generateQRCodeBlob` (after line 639)**

```js
async function generateQRCodeSVG(lineData, imageSize, showCenterLabel) {
    const bgColor = rgbToHex(elements.bgColorBtn.style.backgroundColor) || DEFAULT_BG_COLOR;
    const fgColor = rgbToHex(elements.fgColorBtn.style.backgroundColor) || DEFAULT_FG_COLOR;

    const svgString = await QRCode.toString(lineData.url, {
        type: 'svg',
        width: imageSize,
        color: { dark: fgColor, light: bgColor }
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;

    // viewBox coordinate space may differ from imageSize (e.g. "0 0 41 41")
    const viewBoxAttr = svg.getAttribute('viewBox') || `0 0 ${imageSize} ${imageSize}`;
    const svgSize = parseFloat(viewBoxAttr.trim().split(/\s+/)[2]);

    // Typography — same ratios as PNG path, in SVG user units
    const fontSize = svgSize * 0.08;
    const lineHeight = fontSize * 1.3;
    const padding = svgSize * 0.02;
    const maxTextWidth = svgSize - padding * 2;

    const topLines = lineData.topText
        ? wrapTextToSVGWidth(lineData.topText, maxTextWidth, fontSize, viewBoxAttr)
        : [];
    const bottomLines = lineData.bottomText
        ? wrapTextToSVGWidth(lineData.bottomText, maxTextWidth, fontSize, viewBoxAttr)
        : [];

    const topHeight = topLines.length > 0 ? padding + topLines.length * lineHeight + padding : 0;
    const bottomHeight = bottomLines.length > 0 ? padding + bottomLines.length * lineHeight + padding : 0;

    // qrContainer: where QR content and center label live.
    // When text is present, wrap existing SVG children in a <g> shifted down by topHeight.
    let qrContainer;
    if (topHeight > 0 || bottomHeight > 0) {
        const newViewBoxHeight = svgSize + topHeight + bottomHeight;
        svg.setAttribute('viewBox', `0 0 ${svgSize} ${newViewBoxHeight}`);
        const renderedWidth = parseFloat(svg.getAttribute('width')) || imageSize;
        svg.setAttribute('height', Math.round(renderedWidth * newViewBoxHeight / svgSize));

        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(0, ${topHeight})`);
        while (svg.firstChild) g.appendChild(svg.firstChild);
        svg.appendChild(g);
        qrContainer = g;
    } else {
        qrContainer = svg;
    }

    if (showCenterLabel) {
        addCenterLabelToSVG(qrContainer, svgSize, fgColor, bgColor);
    }

    const ns = 'http://www.w3.org/2000/svg';
    const cx = svgSize / 2;

    if (topLines.length > 0) {
        const textEl = doc.createElementNS(ns, 'text');
        textEl.setAttribute('x', cx);
        textEl.setAttribute('y', padding);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-family', 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
        textEl.setAttribute('fill', fgColor);
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'hanging');
        topLines.forEach((line, i) => {
            const tspan = doc.createElementNS(ns, 'tspan');
            tspan.setAttribute('x', cx);
            tspan.setAttribute('dy', i === 0 ? 0 : lineHeight);
            tspan.textContent = line;
            textEl.appendChild(tspan);
        });
        svg.appendChild(textEl);
    }

    if (bottomLines.length > 0) {
        const textEl = doc.createElementNS(ns, 'text');
        textEl.setAttribute('x', cx);
        textEl.setAttribute('y', svgSize + topHeight + padding);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-family', 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
        textEl.setAttribute('fill', fgColor);
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'hanging');
        bottomLines.forEach((line, i) => {
            const tspan = doc.createElementNS(ns, 'tspan');
            tspan.setAttribute('x', cx);
            tspan.setAttribute('dy', i === 0 ? 0 : lineHeight);
            tspan.textContent = line;
            textEl.appendChild(tspan);
        });
        svg.appendChild(textEl);
    }

    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    return new Blob([svgText], { type: 'image/svg+xml' });
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: exits without errors.

- [ ] **Step 3: Commit**

```bash
git add src/bulk.js
git commit -m "feat: add generateQRCodeSVG() function"
```

---

### Task 7: Wire SVG into `handleGenerate()`

Two occurrences each of blob generation and filename extension need updating — one in the ZIP path, one in the individual-files path.

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add format/label reads inside `handleGenerate`**

After `const imageSize = parseInt(elements.imageSizeInput.value) || 512;` (line 467), add:

```js
const format = elements.outputFormatSelect.value;
const showCenterLabel = elements.centerLabelCheckbox.checked;
const ext = format === 'svg' ? '.svg' : '.png';
```

- [ ] **Step 2: Update blob generation in the ZIP path (line 491)**

Change:
```js
const blob = await generateQRCodeBlob(lineData, imageSize, true, true);
```
to:
```js
const blob = format === 'svg'
    ? await generateQRCodeSVG(lineData, imageSize, showCenterLabel)
    : await generateQRCodeBlob(lineData, imageSize, true, true, showCenterLabel);
```

- [ ] **Step 3: Update filename in the ZIP path (line 489)**

Change:
```js
const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
```
to:
```js
const fileName = getUniqueFileName(rawName, usedFileNames) + ext;
```

- [ ] **Step 4: Update blob generation in the individual-files path (line 543)**

Change:
```js
const blob = await generateQRCodeBlob(lineData, imageSize, true, true);
```
to:
```js
const blob = format === 'svg'
    ? await generateQRCodeSVG(lineData, imageSize, showCenterLabel)
    : await generateQRCodeBlob(lineData, imageSize, true, true, showCenterLabel);
```

- [ ] **Step 5: Update filename in the individual-files path (line 541)**

Change:
```js
const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
```
to:
```js
const fileName = getUniqueFileName(rawName, usedFileNames) + ext;
```

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: exits without errors.

- [ ] **Step 7: Commit**

```bash
git add src/bulk.js
git commit -m "feat: dispatch PNG/SVG in handleGenerate, thread showCenterLabel"
```

---

### Task 8: Manual verification

**Files:** none (read-only testing)

- [ ] **Build for clean state**

```bash
npm run build
```

Load unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select project root directory).

- [ ] **Center label toggle — PNG**

Paste `https://example.com`, keep PNG, generate. Open downloaded `.png` → Pax Cultura symbol visible.
Uncheck «Center label», generate again → symbol absent.

- [ ] **Center label persists**

Uncheck «Center label», refresh page → checkbox stays unchecked. Check it, refresh → stays checked.

- [ ] **Preview reacts to center label**

Toggle checkbox → preview QR updates immediately without generating.

- [ ] **SVG basic**

Select SVG, paste `https://example.com`, generate. File downloads with `.svg` extension. Open in Chrome → QR renders, is scannable with phone camera.

- [ ] **SVG + center label on**

With «Center label» checked, generate SVG. Open file in text editor → should contain `<circle`, `<rect` elements for the label.

- [ ] **SVG + center label off**

Uncheck, generate SVG. Open file in text editor → no `<circle`/`<rect` elements besides those inside the QR `<path>`.

- [ ] **SVG colors**

Set background to `#ffff00`, foreground to `#0000ff`. Generate SVG. Open file → `fill="#ffff00"` and `fill="#0000ff"` / `stroke="#0000ff"` visible in SVG markup.

- [ ] **SVG + CSV text overlays**

Paste:
```
Title text;https://example.com;Footer text
```
Set separator `;`, mapping QR→col 2, Title→col 1, Footer→col 3. Select SVG, generate.
Open SVG in Chrome → text appears above and below QR code. Open in text editor → `<text>` elements present.

- [ ] **SVG + ZIP**

Check «Save as ZIP archive», select SVG, generate. Downloads `.zip`. Extract → contains `.svg` files (not `.png`).

- [ ] **Format persists**

Select SVG, refresh page → still SVG selected.

- [ ] **Version label**

UI header shows `v1.2.0`.

- [ ] **Final commit**

```bash
git add .
git commit -m "chore: v1.2.0 verification complete"
```
