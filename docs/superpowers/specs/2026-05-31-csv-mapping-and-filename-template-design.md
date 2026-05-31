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
- On **new file upload or column count change**: mapping resets to auto-selection defaults
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
- Ragged CSV: shorter rows padded with `''` to match the widest row.

**New `applyMapping(parsedLine, mapping)` → `{ url, topText, bottomText }`:**

```javascript
// mapping: { qrContent: 0, title: null, footer: 2 }  (0-based indices, null = not set)
function applyMapping(parsedLine, mapping) {
    const cols = parsedLine.columns;
    return {
        url:      mapping.qrContent !== null ? (cols[mapping.qrContent] || '') : '',
        topText:  mapping.title     !== null ? (cols[mapping.title]     || '') : '',
        bottomText: mapping.footer  !== null ? (cols[mapping.footer]    || '') : ''
    };
}
```

A line where `url === ''` after mapping → treated as invalid (goes to error log).

**Mapping state (module-level):**

```javascript
let columnMapping = { qrContent: null, title: null, footer: null };
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
1. Parse textarea to detect CSV (any line with separator) and count columns.
2. If CSV detected: show `#mapping-section`, hide old checkbox groups.
3. If column count changed from last known: reset `columnMapping` to auto-defaults, rebuild selects.
4. If column count unchanged: rebuild select labels only (update header names if toggled).
5. If no CSV: hide `#mapping-section`.

Track `lastKnownColumnCount` (module-level, not persisted).

**`handleGenerate()`** — two additions:
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
    //   (includeTopText/includeBottomText are now always true — mapping controls presence)
}
```

**`renderPreview()`** — uses `parseData()` first line + `applyMapping()` instead of inline parsing.

**`lockUI()` / `unlockUI()`** — remove old checkboxes from controls list; add `hasHeaderCheckbox` and three mapping selects.

**`initializeElements()`** — add `hasHeaderCheckbox`, `mappingSection`, `mappingQrContent`, `mappingTitle`, `mappingFooter`.

**`wireUpEventListeners()`** — add listeners for `hasHeaderCheckbox` and three mapping selects (each triggers `saveColumnMapping()` + `renderPreview()`).

### Storage

| Key | Type | When saved |
|---|---|---|
| `hasHeaderRow` | boolean | on checkbox change |
| `columnMapping` | `{qrContent, title, footer}` | on any select change |

**`restoreColumnMapping()`** — called at DOMContentLoaded, after `restoreTextareaContent()`. Restores both keys from storage; if CSV data is present, validates that saved column indices are within range of current column count. If any index is out of range → fall back to auto-defaults for all three roles.

---

## Stage 2 — File Name Templating

### `resolveTemplate()` — pure function

```javascript
resolveTemplate(template, parsedLine, headers, count, padding, batchDate) → string
```

**Supported variables:**

| Variable | Resolution |
|---|---|
| `{col-1}`, `{col-N}` | `parsedLine.columns[N-1]` (1-based) |
| `{col-Name}` | column by header name (only if "has header row" is on; else leave as-is) |
| `{count}` | `String(count).padStart(padding, '0')` — reuses existing padding logic |
| `{date}` | `batchDate` formatted as `YYYYMMDD` |
| `{date:FORMAT}` | `batchDate` with tokens YYYY, MM, DD replaced |

Rules:
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
    ? resolveTemplate(template, parsedLines[i], columnMapping, headers, i + 1, padding, batchDate)
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
