# Pax Cultura Center Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw Pax Cultura symbol in the center of every QR code, clean up debug logs, and remove stale artifacts — branch ready to merge to master.

**Architecture:** New `drawCenterLabel(ctx, size, fgColor, bgColor)` function draws directly onto `qrCanvas` using Canvas 2D API after QR generation and before composite text. Called in both `generateQRCodeBlob()` and `generatePreviewQR()`. Top-level `ENABLE_CENTER_LABEL` constant acts as instant kill switch.

**Tech Stack:** Plain JavaScript, Canvas 2D API (`arc`, `roundRect`), esbuild

**Spec:** `docs/superpowers/specs/2026-05-22-pax-cultura-center-label-design.md`

---

## Files

- Modify: `src/bulk.js` — add constant, add function, wire up in two places, remove 3 console.logs
- Modify: `02_todo.md` — mark Step 41 as deferred
- Delete: `dist/qr-worker.js` — stale artifact from deprecated Phase 10
- Rebuild: `dist/` — via `npm run build`

---

## Task 1: Add ENABLE_CENTER_LABEL constant

**File:** `src/bulk.js`

The constant goes right after the existing color defaults block (after line with `DEFAULT_FG_COLOR`).

- [ ] **Step 1.1: Add constant**

Find this block in `src/bulk.js`:
```javascript
// Color defaults
const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_FG_COLOR = '#000000';
```

Replace with:
```javascript
// Color defaults
const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_FG_COLOR = '#000000';

// Feature flags
const ENABLE_CENTER_LABEL = true;
```

- [ ] **Step 1.2: Commit**
```bash
git add src/bulk.js
git commit -m "feat: add ENABLE_CENTER_LABEL feature flag"
```

---

## Task 2: Add drawCenterLabel function

**File:** `src/bulk.js`

Add the function after the `wrapTextToWidth` function (which ends around the `return lines;` / closing brace before `createErrorLog`).

- [ ] **Step 2.1: Add function**

Find in `src/bulk.js`:
```javascript
async function createErrorLog(errors, subDir) {
```

Insert the following block **immediately before** that line:
```javascript
function drawCenterLabel(ctx, size, fgColor, bgColor) {
    if (!ENABLE_CENTER_LABEL) return;

    const r       = size * 0.10;
    const cx      = size / 2;
    const cy      = size / 2;
    const pad     = r * 0.15;
    const cornerR = r * 0.22;

    // Rounded background in bgColor
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(cx - r - pad, cy - r - pad, (r + pad) * 2, (r + pad) * 2, cornerR);
    ctx.fill();

    // Outer ring
    const sw = r * 0.13;
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.arc(cx, cy, r - sw / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Three dots: equilateral triangle, apex up
    const dotR    = r * 0.24;
    const dotDist = r * 0.47;
    ctx.fillStyle = fgColor;
    [[0, -1], [-0.866, 0.5], [0.866, 0.5]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx * dotDist, cy + dy * dotDist, dotR, 0, Math.PI * 2);
        ctx.fill();
    });
}

```

- [ ] **Step 2.2: Commit**
```bash
git add src/bulk.js
git commit -m "feat: add drawCenterLabel() — Pax Cultura symbol via Canvas 2D"
```

---

## Task 3: Wire up in generateQRCodeBlob

**File:** `src/bulk.js`

`generateQRCodeBlob` calls `QRCode.toCanvas()` and receives `qrCanvas` in the callback. The label must be drawn onto `qrCanvas` **after** QR generation and **before** `createCompositeCanvas`.

- [ ] **Step 3.1: Add call**

Find in `src/bulk.js` inside `generateQRCodeBlob`:
```javascript
            try {
                let finalCanvas = qrCanvas;

                // Add text if requested and available
                if ((includeTopText && lineData.topText) || (includeBottomText && lineData.bottomText)) {
```

Replace with:
```javascript
            try {
                let finalCanvas = qrCanvas;

                // Draw center label (Pax Cultura symbol)
                drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor);

                // Add text if requested and available
                if ((includeTopText && lineData.topText) || (includeBottomText && lineData.bottomText)) {
```

- [ ] **Step 3.2: Commit**
```bash
git add src/bulk.js
git commit -m "feat: draw Pax Cultura label in generateQRCodeBlob"
```

---

## Task 4: Wire up in generatePreviewQR

**File:** `src/bulk.js`

`generatePreviewQR` uses the async form of `QRCode.toCanvas()` (returns a Promise). The label must be drawn onto `qrCanvas` after it resolves and before `createCompositeCanvas`.

- [ ] **Step 4.1: Add call**

Find in `src/bulk.js` inside `generatePreviewQR`:
```javascript
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;

        let finalCanvas = qrCanvas;

        if ((includeTopText && topText) || (includeBottomText && bottomText)) {
```

Replace with:
```javascript
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;

        // Draw center label (Pax Cultura symbol)
        drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor);

        let finalCanvas = qrCanvas;

        if ((includeTopText && topText) || (includeBottomText && bottomText)) {
```

- [ ] **Step 4.2: Commit**
```bash
git add src/bulk.js
git commit -m "feat: draw Pax Cultura label in generatePreviewQR"
```

---

## Task 5: Remove debug console.logs

**File:** `src/bulk.js` — function `toggleColorPicker`

Three leftover debug lines from Step 39 development.

- [ ] **Step 5.1: Remove first two logs**

Find in `toggleColorPicker`:
```javascript
function toggleColorPicker(type, event) {
    console.log('toggleColorPicker called:', type);
    event.stopPropagation();
    const panel = type === 'bg' ? elements.bgPickerPanel : elements.fgPickerPanel;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
    const hexInput = type === 'bg' ? elements.bgHexInput : elements.fgHexInput;

    console.log('panel:', panel, 'btn:', btn);

    hexInput.value = rgbToHex(btn.style.backgroundColor) || (type === 'bg' ? DEFAULT_BG_COLOR : DEFAULT_FG_COLOR);
```

Replace with:
```javascript
function toggleColorPicker(type, event) {
    event.stopPropagation();
    const panel = type === 'bg' ? elements.bgPickerPanel : elements.fgPickerPanel;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
    const hexInput = type === 'bg' ? elements.bgHexInput : elements.fgHexInput;

    hexInput.value = rgbToHex(btn.style.backgroundColor) || (type === 'bg' ? DEFAULT_BG_COLOR : DEFAULT_FG_COLOR);
```

- [ ] **Step 5.2: Remove third log**

Find in `toggleColorPicker`:
```javascript
        console.log('Setting panel top:', top, 'left:', left);
        panel.style.top = `${top}px`;
```

Replace with:
```javascript
        panel.style.top = `${top}px`;
```

- [ ] **Step 5.3: Commit**
```bash
git add src/bulk.js
git commit -m "chore: remove debug console.logs from toggleColorPicker"
```

---

## Task 6: Defer Step 41 in documentation

**File:** `02_todo.md`

- [ ] **Step 6.1: Mark Step 41 as deferred**

Find in `02_todo.md`:
```markdown
- [ ] **Step 41: Custom Center Image**
    - **Goal**: Allow users to upload their own image to display in the center instead of Pax Cultura.
```

Replace `- [ ]` with `- [ ] ~~` and append `~~ *(deferred — see future features)*`:
```markdown
- [ ] ~~**Step 41: Custom Center Image**~~ *(deferred to future release)*
    - **Goal**: Allow users to upload their own image to display in the center instead of Pax Cultura.
```

Also find the Verification step at the end of Phase 12:
```markdown
- [ ] **Verification**
    - **Goal**: Confirm all customization features work correctly.
    - **Action**:
        1. Test color pickers: change colors, verify QR updates in preview, verify generated images have correct colors.
        2. Test reset button: verify colors return to defaults.
        3. Test Pax Cultura symbol: verify it's present by default in center of QR.
        4. Test custom image upload: upload PNG/JPG, verify it appears in center, verify reset returns to symbol.
        5. Test storage persistence: refresh page, verify colors and custom image are restored.
        6. Verify QR codes are still scannable with all customization options.
```

Replace with:
```markdown
- [x] **Verification** ✅ COMPLETED
    - **Goal**: Confirm color customization and Pax Cultura symbol work correctly.
    - **Action**:
        1. Test color pickers: change colors, verify QR updates in preview, verify generated images have correct colors.
        2. Test reset button: verify colors return to defaults.
        3. Test Pax Cultura symbol: verify it's present in center of QR, color matches foreground.
        4. Test storage persistence: refresh page, verify colors are restored.
        5. Verify QR codes are still scannable.
    - *Note: Step 41 (custom center image) deferred to future release branch.*
```

- [ ] **Step 6.2: Commit**
```bash
git add 02_todo.md
git commit -m "docs: defer Step 41 (custom center image) to future release"
```

---

## Task 7: Remove stale dist/qr-worker.js

**File:** `dist/qr-worker.js` — artifact from deprecated Phase 10 (Web Workers), never produced by current build.

- [ ] **Step 7.1: Delete file**
```bash
rm dist/qr-worker.js
```

- [ ] **Step 7.2: Commit**
```bash
git add -A dist/
git commit -m "chore: remove stale dist/qr-worker.js (deprecated Phase 10 artifact)"
```

---

## Task 8: Rebuild and verify

- [ ] **Step 8.1: Run build**
```bash
cd /home/tuchnyak/wdir/repos/extensions/extension_qrcodebulk && npm run build
```

Expected output:
```
dist/bulk.js        ~250kb
dist/background.js    ~800b
⚡ Done in ~30ms
```
Exit code: 0. `dist/` should contain exactly: `background.js`, `bulk.css`, `bulk.html`, `bulk.js`.

- [ ] **Step 8.2: Verify dist contents**
```bash
ls dist/
```
Expected: `background.js  bulk.css  bulk.html  bulk.js` — no `qr-worker.js`.

- [ ] **Step 8.3: Commit rebuilt dist**
```bash
git add dist/
git commit -m "build: rebuild dist after Pax Cultura label feature"
```

---

## Task 9: Final commit — mark branch ready

- [ ] **Step 9.1: Review all changes**
```bash
git log --oneline master..HEAD
```

Expected commits (newest first):
```
build: rebuild dist after Pax Cultura label feature
chore: remove stale dist/qr-worker.js (deprecated Phase 10 artifact)
docs: defer Step 41 (custom center image) to future release
chore: remove debug console.logs from toggleColorPicker
feat: draw Pax Cultura label in generatePreviewQR
feat: draw Pax Cultura label in generateQRCodeBlob
feat: add drawCenterLabel() — Pax Cultura symbol via Canvas 2D
feat: add ENABLE_CENTER_LABEL feature flag
docs: add Pax Cultura center label design spec + .gitignore for .superpowers
```

- [ ] **Step 9.2: Confirm no untracked or modified files**
```bash
git status
```
Expected: `nothing to commit, working tree clean`

---

## Manual QA Checklist (for human)

After merging to master, verify in Chrome with loaded unpacked extension:

1. Open extension → paste `https://example.com` → open Preview panel → confirm Pax Cultura symbol visible in center of QR
2. Change Foreground color → confirm symbol color changes in preview
3. Change Background color → confirm symbol background pad color changes in preview
4. Generate single QR → open file → confirm symbol present with correct colors
5. Generate with CSV line (`top;https://example.com;bottom`) → confirm symbol present and text overlays appear above/below QR
6. Reset colors to default → confirm symbol reverts to black on white
7. Scan generated QR with phone → confirm it scans correctly
