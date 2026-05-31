# Stage 1: CSV Column Mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add N-column CSV support with a column mapping UI (QR content / Title / Footer) and a "first row is headers" checkbox, replacing the hardcoded 3-column logic.

**Architecture:** `parseData()` is rewritten to return raw `{ columns[], originalLine, lineNumber }` per line; a new pure `applyMapping()` bridges that to `{ url, topText, bottomText }` used by generation and preview. `updateCSVControls()` is extended to build mapping selects and apply auto-defaults on file upload. Module-level `columnMapping` state persists to `chrome.storage.local`.

**Tech Stack:** Vanilla JS (ES6+), Chrome Extension MV3, `chrome.storage.local`. No automated tests — verification is manual in Chrome.

---

## Working branch

All commits go to `feature/cvs-templating`.

## How to reload the extension after each build

```
npm run build
```
Then in Chrome: `chrome://extensions` → click **Reload** on Bulk QR Code Generator → click the extension icon to open the tab.

---

## Task 1: HTML — remove old checkboxes, add has-header checkbox, add mapping section

**Files:**
- Modify: `src/bulk.html`

- [ ] **Step 1: Remove both csv-options checkbox groups**

Delete these two `<div>` blocks from `src/bulk.html` (they are inside `.csv-controls`):

```html
<div class="control-group csv-options">
    <label for="top-text-checkbox">Include top text</label>
    <input type="checkbox" id="top-text-checkbox" checked>
</div>
<div class="control-group csv-options">
    <label for="bottom-text-checkbox">Include bottom text</label>
    <input type="checkbox" id="bottom-text-checkbox" checked>
</div>
```

- [ ] **Step 2: Add has-header checkbox to the Upload CSV control-group**

Replace the existing upload control-group:

```html
<div class="control-group">
    <button id="upload-csv-btn">Upload CSV</button>
    <input type="file" id="csv-file-input" accept=".csv,.txt" style="display: none;">
</div>
```

With:

```html
<div class="control-group">
    <button id="upload-csv-btn">Upload CSV</button>
    <input type="file" id="csv-file-input" accept=".csv,.txt" style="display: none;">
    <label class="has-header-label">
        <input type="checkbox" id="has-header-checkbox"> First row is headers
    </label>
</div>
```

- [ ] **Step 3: Add mapping section between `.csv-controls` and `.data-input`**

Insert this block in `src/bulk.html` between the closing `</div>` of `.csv-controls` and the opening `<div class="data-input">`:

```html
<!-- Column Mapping -->
<div id="mapping-section" class="mapping-section" style="display: none;">
    <div class="mapping-row">
        <div class="mapping-field">
            <label>QR content <span class="required">*</span></label>
            <select id="mapping-qr-content"></select>
        </div>
        <div class="mapping-field">
            <label>Title</label>
            <select id="mapping-title"></select>
        </div>
        <div class="mapping-field">
            <label>Footer</label>
            <select id="mapping-footer"></select>
        </div>
    </div>
    <p id="mapping-hint" class="mapping-hint" style="display: none;">
        Select a column for QR content to enable generation.
    </p>
</div>
```

- [ ] **Step 4: Build and verify**

```
npm run build
```

Reload extension in Chrome. Verify: no "Include top text" / "Include bottom text" checkboxes visible; "First row is headers" checkbox appears next to Upload CSV; no mapping section visible yet (it's hidden by default).

- [ ] **Step 5: Commit**

```bash
git add src/bulk.html
git commit -m "feat: update HTML — remove old checkboxes, add has-header + mapping section"
```

---

## Task 2: CSS — style new elements

**Files:**
- Modify: `src/bulk.css`

- [ ] **Step 1: Add styles for has-header label and mapping section**

Append to `src/bulk.css`:

```css
/* Has-header checkbox label */
.has-header-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-left: 4px;
}

/* Column mapping section */
.mapping-section {
    margin-bottom: 25px;
    padding: 15px 20px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
}

.mapping-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.mapping-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 150px;
}

.mapping-field label {
    font-size: 13px;
    font-weight: 500;
    color: #555;
}

.mapping-field select {
    padding: 6px 8px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 14px;
    background-color: white;
}

.required {
    color: #cc0000;
}

.mapping-hint {
    margin: 10px 0 0;
    font-size: 13px;
    color: #cc0000;
}
```

- [ ] **Step 2: Build and verify layout**

```
npm run build
```

Reload extension. Open DevTools → temporarily set `#mapping-section` display to `block` (in Elements panel) and verify the layout looks correct: three selects side by side, readable labels.

- [ ] **Step 3: Commit**

```bash
git add src/bulk.css
git commit -m "feat: add CSS for has-header label and column mapping section"
```

---

## Task 3: JS — core refactor (parseData, applyMapping, update callers, remove checkbox refs)

This task is one atomic commit. The app will not work mid-task. Complete all steps before building.

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add module-level state variables**

Near the top of `src/bulk.js`, after existing `let` declarations (around line 8), add:

```javascript
// Column mapping state
let columnMapping = { qrContent: null, title: null, footer: null };
let lastKnownColumnCount = null;
let pendingFileUpload = false;
```

- [ ] **Step 2: Add `applyMapping()` pure function**

Add after the `nextTick()` function (around line 36):

```javascript
function applyMapping(parsedLine, mapping) {
    const cols = parsedLine.columns;
    return {
        url:        mapping.qrContent !== null ? (cols[mapping.qrContent] || '') : '',
        topText:    mapping.title     !== null ? (cols[mapping.title]     || '') : '',
        bottomText: mapping.footer    !== null ? (cols[mapping.footer]    || '') : ''
    };
}

function applyAutoDefaults(colCount) {
    columnMapping = colCount >= 3
        ? { qrContent: 1, title: 0, footer: 2 }
        : { qrContent: 0, title: null, footer: null };
}
```

- [ ] **Step 3: Update `initializeElements()` — remove old checkbox entries, add new ones**

In `initializeElements()`, remove these two lines:
```javascript
topTextCheckbox: document.getElementById('top-text-checkbox'),
bottomTextCheckbox: document.getElementById('bottom-text-checkbox'),
```

Add in their place:
```javascript
hasHeaderCheckbox: document.getElementById('has-header-checkbox'),
mappingSection: document.getElementById('mapping-section'),
mappingQrContent: document.getElementById('mapping-qr-content'),
mappingTitle: document.getElementById('mapping-title'),
mappingFooter: document.getElementById('mapping-footer'),
mappingHint: document.getElementById('mapping-hint'),
```

- [ ] **Step 4: Rewrite `parseData()`**

Replace the entire `parseData()` function with:

```javascript
function parseData() {
    const textareaContent = elements.dataTextarea.value.trim();
    const separator = elements.separatorInput.value;
    const hasHeader = elements.hasHeaderCheckbox ? elements.hasHeaderCheckbox.checked : false;

    if (!textareaContent) return { parsedLines: [], headers: null };

    const rawLines = textareaContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (rawLines.length === 0) return { parsedLines: [], headers: null };

    let headers = null;
    let dataLines = rawLines;
    if (hasHeader && rawLines.length > 0) {
        headers = rawLines[0].split(separator).map(h => h.trim());
        dataLines = rawLines.slice(1);
    }

    // Split into columns, track max column count for padding
    let maxCols = 1;
    const split = dataLines.map((line, idx) => {
        const parts = separator && line.includes(separator)
            ? line.split(separator).map(p => p.trim())
            : [line];
        if (parts.length > maxCols) maxCols = parts.length;
        return { parts, line, idx };
    });

    const parsedLines = split.map(({ parts, line, idx }) => ({
        columns: parts.concat(Array(Math.max(0, maxCols - parts.length)).fill('')),
        originalLine: line,
        lineNumber: (hasHeader ? 2 : 1) + idx
    }));

    return { parsedLines, headers };
}
```

- [ ] **Step 5: Update `updateGenerateButtonText()`**

Replace the existing function with:

```javascript
function updateGenerateButtonText() {
    const { parsedLines } = parseData();
    if (parsedLines.length > 0) {
        elements.generateBtn.textContent = `Generate QR Codes (${parsedLines.length} files)`;
    } else {
        elements.generateBtn.textContent = 'Generate QR Codes';
    }
}
```

- [ ] **Step 6: Update `handleGenerate()` — use new parseData format, remove checkbox refs**

At the top of `handleGenerate()`, replace:
```javascript
const { validLines, invalidLines } = parseData();

if (validLines.length === 0) {
    showStatus('No valid data to process. Please enter URLs or CSV data.', 'error');
    return;
}
```

With:
```javascript
const { parsedLines, headers } = parseData();

// When mapping UI is visible and QR content role is not assigned, block generation.
// When mapping UI is hidden (plain URL mode), fall back to col-0 silently.
const mappingActive = elements.mappingSection.style.display !== 'none';
if (mappingActive && columnMapping.qrContent === null) {
    showStatus('Select a column for QR content to generate.', 'error');
    return;
}
const effectiveMapping = mappingActive
    ? columnMapping
    : { qrContent: 0, title: null, footer: null };

const mappedLines = parsedLines.map(pl => ({
    ...applyMapping(pl, effectiveMapping),
    originalLine: pl.originalLine,
    lineNumber: pl.lineNumber
}));
const validLines = mappedLines.filter(l => l.url.trim() !== '');
const invalidLines = mappedLines
    .filter(l => l.url.trim() === '')
    .map(l => ({ line: l.originalLine, lineNumber: l.lineNumber, reason: 'QR content column is empty' }));

if (validLines.length === 0) {
    showStatus('No valid data to process. Please enter URLs or CSV data.', 'error');
    return;
}
```

Remove these two lines from inside `handleGenerate()` (they appear after the `isGenerating = true` block):
```javascript
const includeTopText = elements.topTextCheckbox.checked;
const includeBottomText = elements.bottomTextCheckbox.checked;
```

Replace every call to `generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText)` (appears twice: once in ZIP mode, once in individual mode) with:
```javascript
generateQRCodeBlob(lineData, imageSize, true, true)
```

- [ ] **Step 7: Rewrite `renderPreview()`**

Replace the existing `renderPreview()` function with:

```javascript
function renderPreview() {
    const imageSize = parseInt(elements.imageSizeInput.value) || 512;
    const { parsedLines } = parseData();

    if (parsedLines.length === 0) {
        showPreviewPlaceholder('Enter a URL or CSV data to see preview');
        return;
    }

    // Same effectiveMapping logic as handleGenerate: plain URL mode falls back to col-0
    const mappingActive = elements.mappingSection.style.display !== 'none';
    const effectiveMapping = mappingActive
        ? columnMapping
        : { qrContent: 0, title: null, footer: null };

    const lineData = applyMapping(parsedLines[0], effectiveMapping);

    if (!lineData.url) {
        showPreviewPlaceholder('No valid URL — check column mapping for QR content');
        return;
    }

    generatePreviewQR(lineData.url, imageSize, lineData.topText, lineData.bottomText, true, true);
}
```

- [ ] **Step 8: Update `lockUI()` and `unlockUI()` — remove old checkbox refs**

In `lockUI()`, remove `elements.topTextCheckbox` and `elements.bottomTextCheckbox` from the `controls` array.

In `unlockUI()`, same removal. Also remove the `updateCSVControls()` call at the end of `unlockUI()` (it will be re-added after Task 4 when updateCSVControls no longer references deleted elements).

- [ ] **Step 9: Update `wireUpEventListeners()` — remove old checkbox listeners**

Remove these two lines:
```javascript
elements.topTextCheckbox.addEventListener('change', renderPreview);
elements.bottomTextCheckbox.addEventListener('change', renderPreview);
```

- [ ] **Step 10: Replace `updateCSVControls()` with a working stub**

Replace the entire `updateCSVControls()` function with a minimal version that shows/hides the mapping section without referencing the deleted checkboxes. The full implementation comes in Task 4.

```javascript
function updateCSVControls() {
    const separator = elements.separatorInput.value;
    const hasCSVData = elements.dataTextarea.value.split('\n').some(
        line => line.trim() && separator && line.includes(separator)
    );
    elements.mappingSection.style.display = hasCSVData ? '' : 'none';
}
```

- [ ] **Step 11: Build and verify**

```
npm run build
```

Reload extension. Test these scenarios:
1. Paste a single URL → generates correctly, no mapping section visible
2. Paste 3-column CSV (e.g., `Title;https://example.com;Footer`) → mapping section appears (empty selects for now, that's OK — Task 4 will populate them)
3. Check that generation with single URL still produces a QR code

- [ ] **Step 12: Commit**

```bash
git add src/bulk.js
git commit -m "feat: core JS refactor — N-column parseData, applyMapping, remove checkbox refs"
```

---

## Task 4: Extend `updateCSVControls()` — populate mapping selects, apply auto-defaults on file upload

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Set `pendingFileUpload = true` in `handleFileUpload()`**

In `handleFileUpload()`, add this line immediately before the `reader.onload` assignment:

```javascript
pendingFileUpload = true;
```

So the start of `handleFileUpload()` becomes:
```javascript
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    pendingFileUpload = true;
    const reader = new FileReader();
    // ... rest unchanged
```

- [ ] **Step 2: Add `parseHeadersFromTextarea()` helper**

Add after `applyAutoDefaults()`:

```javascript
function parseHeadersFromTextarea() {
    const separator = elements.separatorInput.value;
    const firstLine = elements.dataTextarea.value.split('\n').find(l => l.trim());
    if (!firstLine || !firstLine.includes(separator)) return null;
    return firstLine.split(separator).map(h => h.trim());
}
```

- [ ] **Step 3: Add `buildMappingSelects()` helper**

Add after `parseHeadersFromTextarea()`:

```javascript
function buildMappingSelects(colCount, headers) {
    const roles = [
        { el: elements.mappingQrContent, key: 'qrContent' },
        { el: elements.mappingTitle,     key: 'title' },
        { el: elements.mappingFooter,    key: 'footer' }
    ];

    roles.forEach(({ el, key }) => {
        el.innerHTML = '';

        const notSet = document.createElement('option');
        notSet.value = '';
        notSet.textContent = '— not set —';
        el.appendChild(notSet);

        for (let i = 0; i < colCount; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = (headers && headers[i]) ? headers[i] : `Column ${i + 1}`;
            el.appendChild(opt);
        }

        const current = columnMapping[key];
        el.value = current !== null ? String(current) : '';
    });
}
```

- [ ] **Step 4: Rewrite `updateCSVControls()` with full logic**

Replace the stub from Task 3 with the full implementation:

```javascript
function updateCSVControls() {
    const separator = elements.separatorInput.value;
    const textareaContent = elements.dataTextarea.value;
    const hasHeader = elements.hasHeaderCheckbox ? elements.hasHeaderCheckbox.checked : false;

    // Detect whether any data line (after optional header) contains the separator
    const allLines = textareaContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const dataLines = hasHeader && allLines.length > 0 ? allLines.slice(1) : allLines;
    const hasCSVData = dataLines.some(line => separator && line.includes(separator));

    if (!hasCSVData) {
        elements.mappingSection.style.display = 'none';
        lastKnownColumnCount = null;
        return;
    }

    // Find max column count across all data lines
    let maxCols = 1;
    dataLines.forEach(line => {
        if (line.includes(separator)) {
            const count = line.split(separator).length;
            if (count > maxCols) maxCols = count;
        }
    });

    const isFileUpload = pendingFileUpload;
    const isFirstLoad = lastKnownColumnCount === null;
    pendingFileUpload = false;
    lastKnownColumnCount = maxCols;

    // Reset mapping to auto-defaults on file upload or first detection
    if (isFileUpload || isFirstLoad) {
        applyAutoDefaults(maxCols);
    }

    // Build selects using header names if available
    const headers = hasHeader ? parseHeadersFromTextarea() : null;
    buildMappingSelects(maxCols, headers);
    elements.mappingSection.style.display = '';
}
```

- [ ] **Step 5: Re-add `updateCSVControls()` call at end of `unlockUI()`**

At the end of `unlockUI()`, add:
```javascript
updateCSVControls();
```

- [ ] **Step 6: Build and verify**

```
npm run build
```

Reload extension. Test:
1. Upload a 1-column CSV (just URLs) → mapping section shows; QR content = Column 1, Title = not set, Footer = not set
2. Upload a 3-column CSV (`Title;URL;Footer` per line) → QR content = Column 2, Title = Column 1, Footer = Column 3
3. Upload a 5-column CSV → QR content = Column 2, Title = Column 1, Footer = Column 3 (3+ defaults)
4. Generate with 3-column CSV → produces correct QR codes with top/bottom text

- [ ] **Step 7: Commit**

```bash
git add src/bulk.js
git commit -m "feat: updateCSVControls — mapping selects, auto-defaults on file upload"
```

---

## Task 5: Wire has-header checkbox — event listener + storage

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add `saveHasHeaderRow()` function**

Add after `saveTextareaContent()`:

```javascript
function saveHasHeaderRow() {
    chrome.storage.local.set({ hasHeaderRow: elements.hasHeaderCheckbox.checked });
}
```

- [ ] **Step 2: Add event listener in `wireUpEventListeners()`**

Add after the separator input listener block:

```javascript
// Has-header checkbox — rebuild mapping and preview
elements.hasHeaderCheckbox.addEventListener('change', () => {
    saveHasHeaderRow();
    updateCSVControls();
    updateGenerateButtonText();
    renderPreview();
});
```

- [ ] **Step 3: Build and verify**

```
npm run build
```

Reload extension. Test:
1. Load a CSV with a header row (`Name;URL;Location` as first line, then data rows)
2. Check "First row is headers" → mapping selects update to show "Name", "URL", "Location" as options; header row excluded from file count
3. Uncheck → reverts to "Column 1", "Column 2", "Column 3"
4. Reload extension → checkbox state NOT restored yet (that comes in Task 7); that's expected

- [ ] **Step 4: Commit**

```bash
git add src/bulk.js
git commit -m "feat: wire has-header checkbox with storage save and UI update"
```

---

## Task 6: Wire mapping selects — change handler, save to storage, QR content validation

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add `readMappingFromSelects()` and `saveColumnMapping()`**

Add after `saveHasHeaderRow()`:

```javascript
function readMappingFromSelects() {
    function parseVal(el) {
        return el.value === '' ? null : parseInt(el.value, 10);
    }
    columnMapping = {
        qrContent: parseVal(elements.mappingQrContent),
        title:     parseVal(elements.mappingTitle),
        footer:    parseVal(elements.mappingFooter)
    };
}

function saveColumnMapping() {
    chrome.storage.local.set({ columnMapping });
}
```

- [ ] **Step 2: Add `updateGenerateBtn()` — disable button and show/hide hint**

Add after `saveColumnMapping()`:

```javascript
function updateGenerateBtn() {
    const { parsedLines } = parseData();
    const csvVisible = elements.mappingSection.style.display !== 'none';
    const needsMapping = csvVisible && parsedLines.length > 0;
    const missingQR = needsMapping && columnMapping.qrContent === null;

    elements.generateBtn.disabled = missingQR;
    elements.mappingHint.style.display = missingQR ? '' : 'none';
}
```

- [ ] **Step 3: Add mapping select event listeners in `wireUpEventListeners()`**

Add after the has-header checkbox listener:

```javascript
// Mapping selects
[elements.mappingQrContent, elements.mappingTitle, elements.mappingFooter].forEach(sel => {
    sel.addEventListener('change', () => {
        readMappingFromSelects();
        saveColumnMapping();
        updateGenerateBtn();
        renderPreview();
    });
});
```

- [ ] **Step 4: Call `updateGenerateBtn()` from `updateCSVControls()`**

At the end of `updateCSVControls()`, before the closing brace, add:

```javascript
updateGenerateBtn();
```

Also add it in the early-return branch (when `!hasCSVData`), so the button is re-enabled if CSV is removed:

```javascript
if (!hasCSVData) {
    elements.mappingSection.style.display = 'none';
    lastKnownColumnCount = null;
    updateGenerateBtn();
    return;
}
```

- [ ] **Step 5: Add mapping selects and has-header checkbox to `lockUI()` / `unlockUI()`**

In the `controls` array inside `lockUI()`, add:
```javascript
elements.hasHeaderCheckbox,
elements.mappingQrContent,
elements.mappingTitle,
elements.mappingFooter,
```

Same in `unlockUI()`.

- [ ] **Step 6: Call `updateGenerateBtn()` from `updateCSVControls()` in textarea input handler**

In `wireUpEventListeners()`, in the textarea `input` handler, add `updateGenerateBtn()`:

```javascript
elements.dataTextarea.addEventListener('input', () => {
    updateCSVControls();
    updateGenerateButtonText();
    updateGenerateBtn();
    renderPreview();
    saveTextareaContent();
});
```

- [ ] **Step 7: Build and verify**

```
npm run build
```

Reload extension. Test:
1. Load 3-column CSV → all selects populated, button enabled
2. Change QR content select to "— not set —" → button becomes disabled, hint "Select a column for QR content" appears
3. Re-select QR content → button re-enabled, hint gone
4. Change Title select → preview updates with new topText
5. Change Footer select → preview updates with new bottomText
6. Generate → correct files produced using selected columns

- [ ] **Step 8: Commit**

```bash
git add src/bulk.js
git commit -m "feat: wire mapping selects — read/save state, QR content validation, button guard"
```

---

## Task 7: `restoreColumnMapping()` + fix `DOMContentLoaded` sequence

**Files:**
- Modify: `src/bulk.js`

- [ ] **Step 1: Add `restoreColumnMapping()`**

Add after `restoreTextareaContent()`:

```javascript
function restoreColumnMapping() {
    chrome.storage.local.get(['hasHeaderRow', 'columnMapping'], (result) => {
        // Restore has-header checkbox
        if (result.hasHeaderRow) {
            elements.hasHeaderCheckbox.checked = true;
        }

        // Get current column count from already-restored textarea content
        const { parsedLines } = parseData();
        const currentColCount = parsedLines.length > 0 ? parsedLines[0].columns.length : 0;

        if (result.columnMapping && currentColCount > 0) {
            const saved = result.columnMapping;
            // Validate all non-null indices are in range
            const indices = [saved.qrContent, saved.title, saved.footer].filter(v => v !== null);
            const isValid = indices.every(v => v < currentColCount);

            if (isValid) {
                columnMapping = saved;
                lastKnownColumnCount = currentColCount;
                // Rebuild selects to reflect restored mapping
                const headers = elements.hasHeaderCheckbox.checked ? parseHeadersFromTextarea() : null;
                buildMappingSelects(currentColCount, headers);
                elements.mappingSection.style.display = '';
            }
        }

        updateGenerateBtn();
    });
}
```

- [ ] **Step 2: Update `DOMContentLoaded` to call `restoreColumnMapping()` after `restoreTextareaContent()`**

Find the `DOMContentLoaded` listener at the bottom of `src/bulk.js`. Update it to:

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
    restoreColumnMapping();      // MUST be after restoreTextareaContent
    restoreColorSettings();
});
```

- [ ] **Step 3: Build and verify**

```
npm run build
```

Reload extension. Test persistence:
1. Load 3-column CSV with headers, enable "First row is headers", change mapping (e.g., set Footer to "— not set —")
2. Close the extension tab
3. Click extension icon to reopen
4. Verify: textarea content restored, "First row is headers" checked, mapping selects show same state as before close

- [ ] **Step 4: Commit**

```bash
git add src/bulk.js
git commit -m "feat: restoreColumnMapping — persist has-header + mapping across restarts"
```

---

## Task 8: Manual testing — Definition of Done verification

**Files:** none — testing only

Run `npm run build` once. Reload extension. Work through the full DoD checklist.

- [ ] **DoD 1: "First row is headers" checkbox displays and works**

Paste:
```
Name;URL;Location
Alice;https://alice.com;NYC
Bob;https://bob.com;LA
```
Check "First row is headers". Verify:
- File count shows 2 (not 3)
- Selects show "Name", "URL", "Location" as options
- Uncheck → shows "Column 1", "Column 2", "Column 3"

- [ ] **DoD 2: CSV with 1, 2, 3, 5+ columns parses without errors**

Test 1 column:
```
https://example.com
https://google.com
```
→ Mapping section hidden (no separator), generation works.

Test 2 columns (paste into textarea, separator = `;`):
```
https://example.com;extra
https://google.com;extra2
```
→ Mapping section shows: QR content = Column 1, Title = not set, Footer = not set.

Test 3 columns:
```
Title1;https://example.com;Footer1
Title2;https://google.com;Footer2
```
→ QR content = Column 2, Title = Column 1, Footer = Column 3.

Test 5 columns:
```
A;https://example.com;C;D;E
```
→ QR content = Column 2, Title = Column 1, Footer = Column 3.

- [ ] **DoD 3: Ragged CSV does not crash**

Paste:
```
A;https://example.com;C
B;https://google.com
```
→ Extension does not crash; second row pads Footer with empty string.

- [ ] **DoD 4: Mapping section appears after CSV load**

Clear textarea, verify mapping section hidden. Paste 3-column CSV, verify mapping section appears.

- [ ] **DoD 5: Default mapping reproduces current behaviour**

1 column → QR = Col 1, Title = not set, Footer = not set.
2 columns → QR = Col 1, Title = not set, Footer = not set.
3+ columns → QR = Col 2, Title = Col 1, Footer = Col 3.

- [ ] **DoD 6: Headers mode shows header names in selects**

Load CSV with "First row is headers" checked → select options show actual header names from first row.

- [ ] **DoD 7: Generation uses correct columns**

With 3-column CSV and default mapping: generate and inspect output images — top text = col-1, QR = col-2, bottom text = col-3.

Manually change Title to "Column 3", Footer to "Column 1", generate → top text = col-3 value, bottom text = col-1 value.

- [ ] **DoD 8: QR content not set → button disabled + hint shown**

Change QR content select to "— not set —" → button disabled, hint text visible below mapping selects.

- [ ] **DoD 9: Settings survive restart**

Configure: enable headers checkbox, set mapping to non-default. Close tab. Reopen → same state.

- [ ] **DoD 10: Regression — default behaviour identical to before**

With a single URL (no separator), paste `https://example.com` → generate → produces one QR code PNG with no top/bottom text. Identical to pre-feature behaviour.

With 3-column CSV and default mapping → identical output to pre-feature behaviour.

- [ ] **Step: Final commit if no issues**

If all DoD items pass, no additional commit needed (each task was committed individually). If any fix was required during testing, commit it:

```bash
git add src/bulk.js src/bulk.html src/bulk.css
git commit -m "fix: DoD testing corrections for Stage 1"
```

---

## Stage 2 Note

Stage 2 (filename templating) plan will be written separately after Stage 1 is reviewed and accepted. The `resolveTemplate()` function in Stage 2 depends on the `parseData()` output format and `headers` established in this stage.
