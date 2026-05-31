# Design: CSV Column Mapping + File Name Templating

Date: 2026-05-31  
Stages: Stage 1 (CSV mapping) + Stage 2 (filename template)

---

## Context

Chrome extension Bulk QR Code Generator. All logic lives in `src/bulk.js` (1077 lines). No test suite — manual testing only. Build via esbuild to `dist/`.

Current CSV parsing (`parseData`) is hardcoded for 1 or 3 columns and returns `{ topText, url, bottomText }` per line. Both stages extend this without rewriting it.

### Decisions from brainstorming

- Mapping section placed **above textarea** (between csv-controls and data-input)
- Old "Include top text" / "Include bottom text" checkboxes **removed entirely** — replaced by mapping
- Mapping resets to auto-defaults **only on file upload**, not on manual textarea editing
- On **extension restart** with saved textarea content: mapping restored from storage
- `{timestamp}` removed from Stage 2 — per-file is wasteful at scale, per-batch is pointless

---

## Stage 1 — CSV Column Mapping

### Data layer

**`parseData()` — new return shape:**

```javascript
{
  parsedLines: [{ columns: string[], originalLine: string, lineNumber: number }],
  headers: string[] | null   // null if "has header row" is off
}
```

Rules:
- Any non-empty line → valid. No more "expected 3 parts" rejection.
- "Has header row" ON: first line becomes `headers[]`, excluded from `parsedLines`.
- Lines without separator → `columns: [line]` (single column).
- Ragged CSV: shorter rows padded with `''` to match the widest row in the dataset.

**New `applyMapping(parsedLine, mapping)` → `{ url, topText, bottomText }`:**

```javascript
// mapping: { qrContent: 0, title: null, footer: 2 }  (0-based indices, null = not set)
function applyMapping(parsedLine, mapping) {
    const cols = parsedLine.columns;
    return {
        url:        mapping.qrContent !== null ? (cols[mapping.qrContent] || '') : '',
        topText:    mapping.title     !== null ? (cols[mapping.title]     || '') : '',
        bottomText: mapping.footer    !== null ? (cols[mapping.footer]    || '') : ''
    };
}
```

The `|| ''` fallback handles ragged rows gracefully — out-of-range index returns `''` without crashing.

A line where `url === ''` after mapping → treated as invalid (goes to error log).

**Mapping state (module-level):**

```javascript
let columnMapping = { qrContent: null, title: null, footer: null };
let lastKnownColumnCount = null;  // null = uninitialized; not persisted
```

**Auto-selection defaults (reproduce current behaviour):**

| Column count | qrContent | title | footer |
|---|---|---|---|
| 1 | col-1 (idx 0) | null | null |
| 2 | col-1 (idx 0) | null | null |
| 3+ | col-2 (idx 1) | col-1 (idx 0) | col-3 (idx 2) |

### UI changes

**Removed from HTML:**
- Both `control-group.csv-options` wrappers for `#top-text-checkbox` and `#bottom-text-checkbox`
- Corresponding entries in `initializeElements()`, `lockUI()`, `unlockUI()`, `wireUpEventListeners()`

**Added to HTML — "has header row" checkbox (same control-group as Upload CSV):**

```html
<div class="control-group">
    <button id="upload-csv-btn">Upload CSV</button>
    <input type="file" id="csv-file-input" accept=".csv,.txt" style="display: none;">
    <label class="has-header-label">
        <input type="checkbox" id="has-header-checkbox"> First row is headers
    </label>
</div>
```

**Added to HTML — mapping section (between csv-controls and data-input), hidden by default:**

```html
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
</div>
```

Select options: `— not set —` + `Column 1`, `Column 2`, ... (or header names if "has header row" is on).

### Logic changes in bulk.js

**`updateCSVControls()`** — extended:
1. Parse textarea to detect CSV (any line with separator) and count columns (widest row).
2. If CSV detected: show `#mapping-section`, hide old checkbox groups.
3. If column count changed from `lastKnownColumnCount` **AND** change came from file upload: reset `columnMapping` to auto-defaults, set `lastKnownColumnCount`, rebuild selects.
4. If column count changed via manual textarea editing: update `lastKnownColumnCount`, rebuild select labels only — do NOT reset `columnMapping` (out-of-range indices are handled gracefully by `applyMapping`'s `|| ''` fallback).
5. If column count unchanged: rebuild select labels only (update header names if "has header row" was toggled).
6. If no CSV: hide `#mapping-section`, set `lastKnownColumnCount = null`.

To distinguish file upload from textarea change: `handleFileUpload()` sets a flag `let pendingFileUpload = true` before calling `updateCSVControls()`, which is consumed and cleared inside.

**`handleGenerate()`** — changes:
```javascript
const { parsedLines, headers } = parseData();

// Validate mapping
if (columnMapping.qrContent === null) {
    showStatus('Select a column for QR content to generate.', 'error');
    return;
}

// Per-line mapping (replaces direct topText/url/bottomText access)
for (let i = 0; i < parsedLines.length; i++) {
    const lineData = applyMapping(parsedLines[i], columnMapping);
    // lineData.url empty → push to errors, skip
    // otherwise: generateQRCodeBlob(lineData, imageSize, true, true)
}
```

**Why `includeTopText = true` and `includeBottomText = true` is safe:**
The existing code checks `(includeTopText && lineData.topText)` before creating the composite canvas, and again before allocating height inside `createCompositeCanvas()`. Since `'' ` is falsy in JS, `true && ''` evaluates to `''` (falsy) — no composite canvas is created and no height is reserved when topText/bottomText is empty. Mapping controls presence via the value itself; no additional guard needed.

**`renderPreview()`** — uses `parseData()` first line + `applyMapping()` instead of inline parsing.

**`lockUI()` / `unlockUI()`** — remove old checkboxes from controls list; add `hasHeaderCheckbox` and three mapping selects.

**`initializeElements()`** — add `hasHeaderCheckbox`, `mappingSection`, `mappingQrContent`, `mappingTitle`, `mappingFooter`.

**`wireUpEventListeners()`** — add listeners for `hasHeaderCheckbox` (triggers `updateCSVControls()`) and three mapping selects (each triggers `saveColumnMapping()` + `renderPreview()`).

### Storage

| Key | Type | When saved |
|---|---|---|
| `hasHeaderRow` | boolean | on checkbox change |
| `columnMapping` | `{qrContent, title, footer}` | on any select change |

### Restore flow on extension startup

**Order in `DOMContentLoaded`:**

```javascript
initializeElements();
wireUpEventListeners();
updateCSVControls();          // runs with empty textarea, lastKnownColumnCount = null
updateGenerateButtonText();
setupRatingBanner();
restorePreviewPanelState();
restoreTextareaContent();     // restores textarea, calls updateCSVControls() internally
                              //   → may reset mapping to auto-defaults (lastKnownColumnCount was null)
restoreColumnMapping();       // MUST run after restoreTextareaContent
restoreColorSettings();
```

**`restoreColumnMapping()`** logic:
1. Read `hasHeaderRow` and `columnMapping` from storage.
2. Restore `hasHeaderCheckbox.checked`.
3. If `columnMapping` exists in storage:
   - Validate all non-null indices are `< lastKnownColumnCount` (current column count).
   - If valid: override `columnMapping` module variable, set `lastKnownColumnCount` to current column count, rebuild selects to reflect restored mapping.
   - If invalid (columns shifted): keep auto-defaults that were already applied.
4. If no saved `columnMapping`: keep auto-defaults.

This guarantees: if user had 3-column CSV and mapping col-2/col-1/col-3, reopening the extension with the same textarea content restores that mapping exactly.

---

## Stage 2 — File Name Templating

### `resolveTemplate()` — pure function

```javascript
resolveTemplate(template, parsedLine, headers, count, padding, batchDate) → string
```

Note: `columnMapping` is NOT a parameter. `{col-N}` references raw column indices, not mapped roles — the template can use any column regardless of mapping.

**Supported variables:**

| Variable | Resolution |
|---|---|
| `{col-1}`, `{col-N}` | `parsedLine.columns[N-1]` (1-based numeric index) |
| `{col-Name}` | column by header name lookup in `headers[]` |
| `{count}` | `String(count).padStart(padding, '0')` — reuses existing padding logic |
| `{date}` | `batchDate` formatted as `YYYYMMDD` |
| `{date:FORMAT}` | `batchDate` with tokens YYYY, MM, DD replaced (regex `/YYYY/g`, `/MM/g`, `/DD/g`) |

**Disambiguation: `{col-X}` vs `{col-Name}`:**
- If the part after `col-` consists entirely of digits → treat as 1-based numeric index.
- Otherwise → treat as header name (lookup in `headers[]`; if "has header row" is off, leave as-is).
- Edge case: a header literally named `"1"` cannot be accessed by name via `{col-1}` — it will be treated as index 1. Acceptable limitation; document in UI tooltip if needed.

**Date token replacement:**
Use global regex to handle repeated tokens correctly:
```javascript
format.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day)
```

**Rules:**
- Unknown variable → leave as-is, no error.
- `{col-Name}` with headers off → leave as-is.
- After resolution: sanitize `/ \ : * ? " < > |` → `_`.
- Empty result after sanitization → fallback to `String(count).padStart(padding, '0')`.

### UI

In Advanced Settings, new `control-group` below Custom Filename:

```html
<div class="control-group">
    <label for="filename-template-input">File name template:</label>
    <input type="text" id="filename-template-input" placeholder="leave empty for default">
    <div id="filename-template-preview" class="template-preview"></div>
</div>
```

Preview: updates on input with 300 ms debounce. Shows resolved name for first CSV row (or `001` if no data). Example: `SKU-042_20260525_001`.

Template value saved to `chrome.storage.local` key `filenameTemplate`.

### Integration in `handleGenerate()`

```javascript
const batchDate = new Date();  // already exists
const template = elements.filenameTemplateInput.value.trim();

// Per-file:
const fileName = template
    ? resolveTemplate(template, parsedLines[i], headers, i + 1, padding, batchDate)
    : `${baseName}_${fileNumber}`;  // existing logic, unchanged
```

**Collision handling:** maintain a `Set` of used names per batch. On collision: append `_2`, `_3`, etc.

`batchDate` is computed once per batch run (already the case via existing `timestamp` variable in `handleGenerate()`).

---

## What is NOT touched

- QR code generation logic (`generateQRCodeBlob`, `createCompositeCanvas`, `drawCenterLabel`)
- Color customization
- Preview panel toggle and rendering (only the data source changes)
- ZIP logic structure
- Rating banner
- Export format (PNG only)
