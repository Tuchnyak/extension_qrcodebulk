# Developer Specification: Bulk QR Code Generator Chrome Extension

## 1. Overview

This document outlines the technical specification for a Chrome extension that bulk-generates QR codes from user-provided data. The extension operates in a dedicated browser tab, offering a rich user interface for managing input, settings, and generation.

## 2. Core Functionality & Requirements

### 2.1. Activation
- The extension is activated by clicking its icon in the Chrome toolbar.
- Each click opens the main application in a **new browser tab**. It does not reuse existing tabs.

### 2.2. Main Page Interface Components
The UI must be responsive and functional in narrow (mobile-like) views.

1.  **Header**: Displays the extension's name, "Bulk QR Code Generator", and version label.

2.  **Instructions**: A non-editable text block explaining the accepted data formats and available template variables:
    - One URL per line (plain mode)
    - CSV with separator (multi-column mode)
    - Template variables: `{count}`, `{date}`, `{date:DD-MM-YYYY}`, `{col-1}`, `{col-Name}`

3.  **CSV Controls**: A horizontal group of controls:
    - **Upload CSV Button**: Opens a file dialog for `.csv` or `.txt` files. File content replaces textarea content. UTF-8 BOM is stripped automatically.
    - **First row is headers** checkbox: When checked, the first CSV row is treated as column headers (used in mapping selects and `{col-Name}` template variables).
    - **Separator Input**: A text input for the CSV separator. Default: `;`. Always visible. Value persisted to `chrome.storage.local`.

4.  **Column Mapping Section** (`#mapping-section`): Visible only when multi-column CSV data is detected. Contains:
    - Three labeled dropdowns: **QR content** (required, marked with `*`), **Title**, **Footer** — each listing available columns by name (if headers are on) or by number.
    - **File name template input**: Text field for per-file naming. Default: `{count}-qrcode`. Supports `{count}`, `{date}`, `{date:FORMAT}`, `{col-N}` (1-based index), `{col-Name}` (header lookup). Value persisted.
    - **Template preview**: A read-only line showing what the first file's name would resolve to, updated with 300 ms debounce.
    - A hint message is shown in red if QR content column is not selected.
    - Auto-defaults are applied when no mapping has been configured yet (first CSV detection or file upload with no prior mapping). File upload does **not** reset an existing mapping.
    - Mapping state (`columnMapping`, `hasHeaderRow`) persisted to `chrome.storage.local`.

5.  **Data Input Textarea**: Multi-line input. Monospace font. Content persisted to `chrome.storage.local`.

6.  **Status Area**: Feedback after generation (success count, error count, elapsed time). Positioned between textarea and generate button.

7.  **Generate Button & Controls**:
    - Button label shows file count: `Generate QR Codes (N files)`.
    - **Save as ZIP archive** checkbox to its right (label underlined in red).

8.  **Advanced Settings** (always visible):
    - **Image Size**: Dropdown — 64, 128, 256, 512 (default), 1024, 2048, 4096 px.

9.  **QR Preview Panel** (collapsible, slides in from the right):
    - Toggle button fixed to the right edge.
    - Live canvas preview of the first line's QR code.
    - **Color customization**: background and foreground color pickers (custom Canvas-based). Reset button. Colors persisted.
    - **Pax Cultura center label**: A branded symbol drawn in the center of every QR code. Pure Canvas 2D, no SVG. 20% of QR width diameter. Kill switch: `const ENABLE_CENTER_LABEL = true` in `bulk.js`.

10. **Rating Banner**: Fixed to the bottom-left corner. Star rating (1–5). Clicking 1–3 stars → feedback form; 4–5 stars → Chrome Web Store page.

### 2.3. Column Mapping Behavior

- **Plain URL mode** (no separator in data): Mapping section hidden. `effectiveMapping` fallback: `{ qrContent: 0, title: null, footer: null }`. File name template is **ignored** in this mode; files use timestamp-based naming.
- **CSV mode**: Mapping section shown. Up to N columns selectable. Each row is mapped via `applyMapping(parsedLine, mapping)` → `{ url, topText, bottomText }`.
- A row where `url === ''` after mapping → treated as invalid (written to `errors.txt`).

## 3. Architecture

- **`manifest.json`**: Manifest V3. Permissions: `downloads`, `storage`. Background service worker (`background.js`).
- **`background.js`**: Listens for `chrome.action.onClicked` → `chrome.tabs.create()` to open `dist/bulk.html`. Listens for `chrome.runtime.onInstalled` → opens welcome page on first install.
- **`src/bulk.html`** / **`src/bulk.css`** / **`src/bulk.js`**: All UI and logic. Built to `dist/` via esbuild.
- **Dependencies**: `qrcode` (QR generation), `jszip` (ZIP archives), `esbuild` (bundler), `copyfiles` (static asset copy).

## 4. Data Handling & Logic

### 4.1. CSV Parsing

`parseCSVLine(line, separator)` — RFC 4180 compliant:
- Handles quoted fields (`"value"`), escaped double-quotes (`""`), commas/separators inside quotes.
- Used everywhere column count or header detection is needed.

`parseData()` returns `{ parsedLines, headers }`:
- `parsedLine.columns` — raw column array (0-based).
- `headers` — array of strings from first row, or `null` if "has header row" is off.
- Ragged rows: shorter rows padded with `''` to match the widest row.
- Lines without separator → `columns: [line]`.

### 4.2. File Naming

**Template mode** (CSV mode, non-empty template):
```
resolveTemplate(template, parsedLine, headers, count, padding, batchDate)
```
- `{count}` → zero-padded sequence number
- `{date}` → `YYYYMMDD`
- `{date:DD-MM-YYYY}` → custom format (supports `YYYY`, `MM`, `DD` tokens)
- `{col-N}` → column value by 1-based index
- `{col-Name}` → column value by header name (case-sensitive)
- Unknown tokens left as-is
- Forbidden filename chars (`/ \ : * ? " < > |`) replaced with `_`
- Empty result → fallback to zero-padded count

**Collision handling**: `getUniqueFileName(name, usedNames)` — appends `_2`, `_3`, etc.

**Fallback mode** (plain URL mode or empty template): `<timestampStr>_<fileNumber>`, where `timestampStr = yyyyMMdd_HHmmss`.

### 4.3. Output Structure

- Individual files: `~/Downloads/001_bulk_qr_codes/<timestampStr>/<timestampStr>_<N>.png`
- ZIP archive: `~/Downloads/001_bulk_qr_codes/<timestampStr>.zip` containing files per template or fallback naming.

### 4.4. Storage Keys (`chrome.storage.local`)

| Key | Value |
|-----|-------|
| `textareaContent` | Last textarea content |
| `separator` | CSV separator character |
| `hasHeaderRow` | boolean |
| `columnMapping` | `{ qrContent, title, footer }` (0-based indices or null) |
| `filenameTemplate` | Template string |
| `previewPanelExpanded` | boolean |
| `qrBackgroundColor` | hex string |
| `qrForegroundColor` | hex string |

## 5. Error Handling

- Generation does not stop on error. Invalid lines (where `url === ''`) are collected.
- If errors exist, an `errors.txt` is saved to the same output directory.
- UI displays summary: success count, error count, elapsed time.
- UI is locked (all controls disabled) during generation; unlocked on completion.

## 6. Testing Plan

| # | Scenario | Expected Outcome |
|---|----------|------------------|
| 1 | **Activation** | Click icon → new tab opens. |
| 2 | **Plain URL mode** | Paste 10 URLs, click Generate. 10 files named `<timestamp>_01.png` … `_10.png`. Mapping section hidden. |
| 3 | **CSV 3-column** | Paste 5 CSV lines (separator `;`). Mapping section appears with auto-defaults. Generate → 5 QR codes with top/bottom text. |
| 4 | **Column mapping manual** | Change QR content column. Generate → correct column used as QR data. |
| 5 | **Headers ON** | First row is headers → selects show column names; `{col-Name}` template resolves. |
| 6 | **File name template** | Template `{col-1}_{date}_{count}` → files named `<col1>_20260613_01.png` etc. |
| 7 | **Template collision** | Two rows with identical col-1. Second file gets `_2` suffix. |
| 8 | **Template fallback** | Empty template, plain URL mode → `<timestamp>_01.png` naming. |
| 9 | **Quoted CSV fields** | `"Braund, Mr. Owen Harris";url` → parsed as single field, no parasitic extra column. |
| 10 | **BOM-prefixed CSV** | Upload Excel-exported CSV with UTF-8 BOM → first header not corrupted. |
| 11 | **Separator persistence** | Change separator to `,`, reload → `,` still set. |
| 12 | **Mapping persistence** | Set custom mapping, reload → mapping restored. |
| 13 | **File upload keeps mapping** | Upload new file → existing mapping and separator preserved. |
| 14 | **ZIP archive** | Check ZIP checkbox, generate → single `.zip` downloaded. |
| 15 | **Color customization** | Change BG/FG colors → QR preview and generated images reflect colors. |
| 16 | **Preview panel** | Toggle preview → slides in/out. Changing data updates preview. |
| 17 | **Dynamic padding** | 105 rows → filenames padded to 3 digits (`_001.png` … `_105.png`). |
| 18 | **Error logging** | Mix valid and invalid rows (empty url column). `errors.txt` created with invalid lines. |
| 19 | **UI lock during generation** | All controls disabled while generating; re-enabled after. |
| 20 | **Seconds in folder name** | Two rapid generations → different folder/archive names (seconds in timestamp). |
