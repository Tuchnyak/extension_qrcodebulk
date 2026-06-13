# Changelog

## 1.1.0 - 2026-06-13
### Added
- N-column CSV support: any number of columns, not just 1 or 3
- Column mapping UI: three dropdowns to assign QR content, title, and footer roles to any column
- "First row is headers" checkbox: header names shown in mapping selects and usable in templates
- File name templating: `{count}`, `{date}`, `{date:FORMAT}`, `{col-N}`, `{col-Name}` variables
- Live template preview (debounced 300 ms)
- Collision handling: duplicate resolved names get `_2`, `_3` suffix
- All new settings (separator, mapping, template) persisted across restarts

### Changed
- "Include top/bottom text" checkboxes removed — replaced by column mapping
- "Custom Filename" field removed — replaced by file name template
- Folder and archive names now include seconds (`yyyyMMdd_HHmmss`) for uniqueness
- Rating banner moved to bottom-left corner
- File upload no longer resets existing column mapping or separator

### Fixed
- RFC 4180 quoted field support: values like `"Braund, Mr. Owen Harris"` parsed as a single field
- UTF-8 BOM stripped from uploaded CSV files (Excel export compatibility)
- Column count and header detection were using naive `.split()` — fixed to use RFC 4180 parser
- Template ignored in plain URL mode (was silently applying `{count}-qrcode` default)
- `restoreColumnMapping` now reliably runs after `restoreTextareaContent` (explicit callback chaining)
- Auto-defaults only applied when no mapping is configured; file upload preserves existing mapping

## 1.0.7 - 2026-05-25
- Pax Cultura branded center label on all QR codes (Canvas 2D, kill switch available)

## 1.0.6 - 2026-05-23
- QR code color customization (background and foreground) with custom Canvas picker
- Colors persisted across sessions

## 1.0.5 - 2026-03-29
- QR preview panel (collapsible, slides in from right)
- Preview updates live on data and settings changes

## 1.0.2 - 2025-11-16
- ZIP archive option
- Progress indicator on Generate button during generation

## 1.0.1 - 2025-10-06
- Welcome page on first install
- Rating banner

## 1.0.0 - 2025-10-06
- Initial release: bulk QR code generation from URLs or 3-column CSV
