# Stage 2: File Name Templating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file name template input (e.g. `{col-1}_{date}_{count}`) that resolves per CSV row when generating QR codes, with a live preview, collision handling, and storage persistence.

**Architecture:** Pure `resolveTemplate()` function handles variable substitution and sanitization. UI: a text input + debounced preview line in Advanced Settings. `handleGenerate()` uses the template per-file if non-empty, falling back to the existing naming logic otherwise. `parsedLine` (raw columns) is threaded through `validLines` so the template can access any column independent of mapping roles.

**Tech Stack:** Vanilla JS (ES6+), Chrome Extension MV3, `chrome.storage.local`. No automated tests — verification is manual in Chrome.

---

## Working branch

All commits go to `feature/cvs-templating`.

## How to reload after each build

```
npm run build
```
`chrome://extensions` → **Reload** → click extension icon.

## Context from Stage 1

`parseData()` returns `{ parsedLines, headers }`:
- `parsedLine.columns` — raw column values array (0-based)
- `headers` — array of header names from first row, or `null` if "has header row" is off

`handleGenerate()` already has:
- `const { parsedLines, headers } = parseData();`
- `const timestamp = new Date();` — use this as `batchDate`
- `const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));`
- `const baseName = \`${timestampStr}_${customFileName}\`;`
- Two filename lines: one in ZIP loop (~line 374), one in individual loop (~line 423)

---

## Task 1: HTML — add template input + preview to Advanced Settings

**Files:**
- Modify: `src/bulk.html`

- [ ] **Step 1: Add template control-group after Custom Filename**

In `src/bulk.html`, find the Custom Filename `control-group` (around line 97–100):
```html
<div class="control-group">
    <label for="file-name-input">Custom Filename:</label>
    <input type="text" id="file-name-input" value="qr_code" pattern="[a-zA-Z0-9_-]+">
</div>
```

Insert this block immediately after it (before the closing `</div>` of `.advanced-settings`):
```html
<div class="control-group">
    <label for="filename-template-input">File name template:</label>
    <input type="text" id="filename-template-input" placeholder="leave empty for default">
    <div id="filename-template-preview" class="template-preview"></div>
</div>
```

- [ ] **Step 2: Build and verify**

```
npm run build
```

Reload extension. Open Advanced Settings — verify the new input and (empty) preview div appear below "Custom Filename".

- [ ] **Step 3: Commit**

```bash
git add src/bulk.html
git commit -m "feat: add filename template input to Advanced Settings"
```

---

## Task 2: CSS — style `.template-preview`

**Files:**
- Modify: `src/bulk.css`

- [ ] **Step 1: Append styles**

Add to the end of `src/bulk.css`:

```css
/* Filename template preview */
.template-preview {
    font-size: 12px;
    color: #6c757d;
    margin-top: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    min-height: 16px;
}
```

- [ ] **Step 2: Build**

```
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/bulk.css
git commit -m "feat: add CSS for filename template preview"
```

---

## Task 3: JS — add `resolveTemplate()` pure function

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add `resolveTemplate()` after `applyAutoDefaults()`**

Find `applyAutoDefaults()` in `src/bulk.js`. Add this function immediately after it:

```javascript
function resolveTemplate(template, parsedLine, headers, count, padding, batchDate) {
    const cols = parsedLine.columns;
    const year  = String(batchDate.getFullYear());
    const month = String(batchDate.getMonth() + 1).padStart(2, '0');
    const day   = String(batchDate.getDate()).padStart(2, '0');

    let result = template.replace(/\{([^}]+)\}/g, (match, token) => {
        if (token === 'count') {
            return String(count).padStart(padding, '0');
        }
        if (token === 'date') {
            return `${year}${month}${day}`;
        }
        if (token.startsWith('date:')) {
            const fmt = token.slice(5);
            return fmt.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day);
        }
        if (token.startsWith('col-')) {
            const colPart = token.slice(4);
            if (/^\d+$/.test(colPart)) {
                // numeric 1-based index; return '' for empty cols, match for out-of-range
                const idx = parseInt(colPart, 10) - 1;
                return cols[idx] !== undefined ? cols[idx] : match;
            }
            // header name lookup; col-Name with headers off → leave as-is
            if (!headers) return match;
            const hi = headers.indexOf(colPart);
            return hi !== -1 && cols[hi] !== undefined ? cols[hi] : match;
        }
        return match; // unknown token → leave as-is
    });

    // Sanitize forbidden filename characters
    result = result.replace(/[/\\:*?"<>|]/g, '_');

    // Fallback to zero-padded count if result is empty
    if (!result.trim()) {
        result = String(count).padStart(padding, '0');
    }

    return result;
}
```

- [ ] **Step 2: Add `getUniqueFileName()` helper after `resolveTemplate()`**

```javascript
function getUniqueFileName(name, usedNames) {
    if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
    }
    let n = 2;
    while (usedNames.has(`${name}_${n}`)) n++;
    const unique = `${name}_${n}`;
    usedNames.add(unique);
    return unique;
}
```

- [ ] **Step 3: Build**

```
npm run build
```

Expected: build succeeds (functions are not yet wired, just defined).

- [ ] **Step 4: Commit**

```bash
git add src/bulk.js
git commit -m "feat: add resolveTemplate() and getUniqueFileName() pure functions"
```

---

## Task 4: JS — UI wiring (elements, preview, debounce, storage save, lockUI)

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add module-level debounce timer**

Near the top of `src/bulk.js`, after the other `let` declarations, add:

```javascript
let templateDebounceTimer = null;
```

- [ ] **Step 2: Add new elements to `initializeElements()`**

In `initializeElements()`, add these two entries to the `elements` object:

```javascript
filenameTemplateInput: document.getElementById('filename-template-input'),
filenameTemplatePreview: document.getElementById('filename-template-preview'),
```

- [ ] **Step 3: Add `updateTemplatePreview()` function**

Add after `getUniqueFileName()`:

```javascript
function updateTemplatePreview() {
    const template = elements.filenameTemplateInput.value.trim();
    if (!template) {
        elements.filenameTemplatePreview.textContent = '';
        return;
    }
    const { parsedLines, headers } = parseData();
    const previewPadding = 3;
    const batchDate = new Date();
    let preview;
    if (parsedLines.length > 0) {
        preview = resolveTemplate(template, parsedLines[0], headers, 1, previewPadding, batchDate);
    } else {
        preview = resolveTemplate(template, { columns: [] }, null, 1, previewPadding, batchDate);
    }
    elements.filenameTemplatePreview.textContent = `Preview: ${preview}`;
}
```

- [ ] **Step 4: Add `saveFilenameTemplate()` function**

Add after `updateTemplatePreview()`:

```javascript
function saveFilenameTemplate() {
    chrome.storage.local.set({ filenameTemplate: elements.filenameTemplateInput.value });
}
```

- [ ] **Step 5: Add event listener in `wireUpEventListeners()`**

Find the `elements.fileNameInput.addEventListener('input', validateFileName)` line.
Add this block immediately after it:

```javascript
elements.filenameTemplateInput.addEventListener('input', () => {
    saveFilenameTemplate();
    clearTimeout(templateDebounceTimer);
    templateDebounceTimer = setTimeout(updateTemplatePreview, 300);
});
```

- [ ] **Step 6: Add `filenameTemplateInput` to `lockUI()` / `unlockUI()` controls array**

In both `lockUI()` and `unlockUI()`, add to the `controls` array:
```javascript
elements.filenameTemplateInput,
```

- [ ] **Step 7: Build**

```
npm run build
```

- [ ] **Step 8: Verify preview works**

Reload extension. Paste a 3-column CSV, type `{col-1}_{date}_{count}` into the template input.
After 300 ms: preview shows e.g. `Preview: Title1_20260605_001`.
Clear the field: preview disappears.

- [ ] **Step 9: Commit**

```bash
git add src/bulk.js
git commit -m "feat: wire filename template UI — preview, debounce, storage save"
```

---

## Task 5: JS — integrate template into `handleGenerate()`

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Thread `parsedLine` through `mappedLines`**

In `handleGenerate()`, find the `mappedLines` mapping (around line 332):

```javascript
const mappedLines = parsedLines.map(pl => ({
    ...applyMapping(pl, effectiveMapping),
    originalLine: pl.originalLine,
    lineNumber: pl.lineNumber
}));
```

Add `parsedLine: pl` to carry the raw columns through to the loop:

```javascript
const mappedLines = parsedLines.map(pl => ({
    ...applyMapping(pl, effectiveMapping),
    originalLine: pl.originalLine,
    lineNumber: pl.lineNumber,
    parsedLine: pl
}));
```

- [ ] **Step 2: Add template and collision-tracking variables**

In `handleGenerate()`, find this block inside the `try {`:
```javascript
const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));
let successCount = 0;
const errors = [];
```

Add two lines after `padding`:
```javascript
const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));
const template = elements.filenameTemplateInput.value.trim();
const usedFileNames = new Set();
let successCount = 0;
const errors = [];
```

- [ ] **Step 3: Update filename line in ZIP loop**

In the ZIP loop (inside `if (isZipEnabled)`), find:
```javascript
const fileNumber = String(i + 1).padStart(padding, '0');
const fileName = `${baseName}_${fileNumber}.png`;
```

Replace with:
```javascript
const fileNumber = String(i + 1).padStart(padding, '0');
const rawName = template
    ? resolveTemplate(template, lineData.parsedLine, headers, i + 1, padding, timestamp)
    : `${baseName}_${fileNumber}`;
const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
```

- [ ] **Step 4: Update filename line in individual file loop**

In the individual file loop (inside `else`), find the same pattern:
```javascript
const fileNumber = String(i + 1).padStart(padding, '0');
const fileName = `${baseName}_${fileNumber}.png`;
```

Replace with:
```javascript
const fileNumber = String(i + 1).padStart(padding, '0');
const rawName = template
    ? resolveTemplate(template, lineData.parsedLine, headers, i + 1, padding, timestamp)
    : `${baseName}_${fileNumber}`;
const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
```

- [ ] **Step 5: Build**

```
npm run build
```

- [ ] **Step 6: Verify integration**

Reload extension. Load 3-column CSV. Enter `{col-1}_{count}` as template. Generate.
Expected: files are named `<col-1-value>_01.png`, `<col-1-value>_02.png`, etc.

Clear template field. Generate again.
Expected: files use original naming (`<timestamp>_qr_code_01.png`).

- [ ] **Step 7: Commit**

```bash
git add src/bulk.js
git commit -m "feat: integrate resolveTemplate into handleGenerate with collision handling"
```

---

## Task 6: JS — `restoreFilenameTemplate()` + DOMContentLoaded

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add `restoreFilenameTemplate()`**

Find `restoreColumnMapping()`. Add this function immediately after it:

```javascript
function restoreFilenameTemplate() {
    chrome.storage.local.get(['filenameTemplate'], (result) => {
        if (result.filenameTemplate) {
            elements.filenameTemplateInput.value = result.filenameTemplate;
            updateTemplatePreview();
        }
    });
}
```

- [ ] **Step 2: Add call to `DOMContentLoaded`**

Find the `DOMContentLoaded` listener at the bottom of `src/bulk.js`. Add `restoreFilenameTemplate()` after `restoreColumnMapping()`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    elements.versionLabel.textContent = 'v' + chrome.runtime.getManifest().version;
    wireUpEventListeners();
    updateCSVControls();
    updateGenerateButtonText();
    setupRatingBanner();
    restorePreviewPanelState();
    restoreTextareaContent();
    restoreColumnMapping();
    restoreFilenameTemplate();    // ← add this line
    restoreColorSettings();
});
```

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Verify persistence**

1. Enter template `{col-1}_{date}`. Close extension tab. Reopen.
2. Template input shows `{col-1}_{date}`, preview renders correctly.

- [ ] **Step 5: Commit**

```bash
git add src/bulk.js
git commit -m "feat: restoreFilenameTemplate — persist template across restarts"
```

---

## Task 7: Manual testing — Stage 2 DoD

Build once, reload extension, run through each scenario.

- [ ] **DoD 1: Empty template → existing naming unchanged**

Clear template field. Generate 3 QR codes.
Expected: files named `<timestamp>_qr_code_01.png`, `_02.png`, `_03.png` — identical to pre-Stage-2 behaviour.

- [ ] **DoD 2: `{count}` only**

Template: `{count}`
Expected: files `001.png`, `002.png`, `003.png` (zero-padded to width 3 for ≤999 files).

- [ ] **DoD 3: Column + date + count**

3-column CSV:
```
SKU-042;https://example.com;Blue
SKU-043;https://google.com;Red
```
Template: `{col-1}_{date}_{count}`
Expected: `SKU-042_20260605_01.png`, `SKU-043_20260605_02.png`.

- [ ] **DoD 4: Header name lookup**

Enable "First row is headers". CSV:
```
SKU;URL;Color
SKU-042;https://example.com;Blue
```
Template: `{col-SKU}_{count}`
Expected: `SKU-042_01.png`.

- [ ] **DoD 5: Invalid characters in data get replaced**

CSV with slashes: `AC/DC;https://example.com`
Template: `{col-1}_{count}`
Expected: `AC_DC_01.png` (slash → underscore).

- [ ] **DoD 6: Empty result → fallback to count**

Template: `   ` (spaces only — no tokens, no forbidden chars, but trims to empty).
Expected: files named `01.png`, `02.png` (fallback to zero-padded count).

- [ ] **DoD 7: Collision handling**

Two CSV rows where `{col-1}` resolves to the same value:
```
product;https://a.com
product;https://b.com
```
Template: `{col-1}`
Expected: `product.png` and `product_2.png`.

- [ ] **DoD 8: Template survives restart**

Enter template `{col-1}_{count}`. Close tab. Reopen.
Expected: template field populated, preview rendered.

- [ ] **DoD 9: Preview updates with debounce**

Type slowly in template field — preview updates ~300 ms after last keystroke.
Preview shows resolved name for first CSV row.
No CSV loaded → preview shows count-only result (e.g. `001`).

- [ ] **Step: Commit if any fixes were needed**

```bash
git add src/bulk.js src/bulk.html src/bulk.css
git commit -m "fix: Stage 2 DoD testing corrections"
```
