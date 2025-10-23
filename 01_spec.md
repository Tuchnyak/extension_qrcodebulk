# Developer Specification: Bulk QR Code Generator Chrome Extension

## 1. Overview

This document outlines the technical specification for a Chrome extension that bulk-generates QR codes from user-provided data. The extension operates in a dedicated browser tab, offering a rich user interface for managing input, settings, and generation.

## 2. Core Functionality & Requirements

### 2.1. Activation
- The extension is activated by clicking its icon in the Chrome toolbar.
- Each click opens the main application in a **new browser tab**. It does not reuse existing tabs.

### 2.2. Main Page Interface Components
The UI must be responsive and functional in narrow (mobile-like) views.

1.  **Header**: Displays the extension's name, "Bulk QR Code Generator".
2.  **Instructions**: A non-editable text block explaining the accepted data formats (one URL per line or CSV).
3.  **CSV Controls**: A horizontal group of controls for CSV processing:
    - **Separator Input**: A text input for the CSV separator. Default value: `;`.
    - **Top Text Checkbox**: A checkbox labeled "Include top text". Enabled only when the separator is detected in the input data.
    - **Bottom Text Checkbox**: A checkbox labeled "Include bottom text". Enabled only when the separator is detected.
    - **Upload CSV Button**: A button that opens a file dialog to select a `.csv` or `.txt` file.
4.  **Data Input Textarea**:
    - A multi-line textarea for user data.
    - Fixed height with a scrollbar for overflow.
    - Placeholder text shows examples:
        - `https://google.com`
        - `top_text;https://example.com;bottom_text`
5.  **Generate Button**: A prominent button to start the QR code generation process.
6.  **Advanced Settings (Spoiler)**:
    - A collapsible section labeled "Advanced settings".
    - **Image Size Input**: A number input for QR code pixel dimensions. Default: `512`.
    - **File Name Input**: A text input for a custom part of the output filename. Default: `qr_code`.
        - Validation: Must only contain letters, numbers, hyphens (`-`), and underscores (`_`). No spaces.
7.  **Status Area**: A designated area to display feedback after generation (e.g., "Saved 95 files. 5 lines had errors. See errors.txt for details.").

## 3. Architecture

- **`manifest.json`**:
    - Manifest V3.
    - **Permissions**: `downloads`.
    - **Action**: No `default_popup`. The icon click is handled by the background script.
    - **Background Script**: A non-persistent script (`background.js`) that listens for `chrome.action.onClicked` and executes `chrome.tabs.create()` to open the main application page (`bulk.html`).
- **Main Application (`bulk.html`, `bulk.js`, `bulk.css`)**:
    - `bulk.html`: The structure for the main UI.
    - `bulk.css`: Styles for a responsive and modern UI.
    - `bulk.js`: All client-side logic, including UI event handling, data parsing, validation, QR generation, and file saving.
    - Build: Source files from `src/` are bundled to `dist/` using `esbuild`. The `qrcode` library is an npm dependency.

## 4. Data Handling & Logic

- **Data Parsing**:
    - The script reads the content of the textarea and splits it into lines. Empty lines are ignored.
    - For each line, it checks for the presence of the user-defined separator.
    - **If separator exists**: The line is split into three parts (`top_text`, `URL`, `bottom_text`). If there are not exactly three parts, the line is marked as invalid.
    - **If no separator**: The entire line is treated as the data to be encoded (e.g., a URL).
- **CSV Upload**: When a user uploads a file, its content **replaces** any existing content in the textarea.
- **QR Code Generation**:
    - The `qrcode` library is used to generate QR codes.
    - If "Include top/bottom text" checkboxes are checked and the data is available, the final PNG is a composite image: a canvas containing the text, the QR code, and then more text.
- **File Saving**:
    - A single timestamp is captured at the moment the "Generate" button is clicked.
    - A main output directory is created if it doesn't exist: `~/Downloads/001_bulk_qr_codes/`.
    - A unique sub-directory is created for each generation batch: `~/Downloads/001_bulk_qr_codes/yyyyMMdd_hhmm_customText/`.
    - Files are named according to the pattern: `yyyyMMdd-hhmm_customText_####.png`.
    - The number of digits in the file number (`####`) is determined by the total count of valid lines (e.g., 80 lines -> `_01.png`, 120 lines -> `_001.png`).
    - All downloads are handled via the `chrome.downloads.download()` API.

## 5. Error Handling

- **Partial Generation**: The process does not stop on error. It generates QR codes for all valid lines and skips invalid ones.
- **Error Logging**: All skipped lines (due to incorrect CSV format or other issues) are collected.
- After generation, if there were errors, an `errors.txt` file containing all invalid lines is created and saved to the same output sub-directory.
- The UI displays a summary message indicating the number of successful saves and errors.
- **UI Feedback**: During generation, the "Generate" button and all other form controls are disabled to prevent changes. The button text changes to "Generating...".

## 6. Testing Plan

| # | Scenario                                       | Expected Outcome                                                                                                                            |
|---|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Activation**                                 | Click extension icon. A new tab opens with the bulk generator UI.                                                                           |
| 2 | **Simple Generation**                          | Paste 10 URLs into the textarea. Click Generate. A new folder is created containing 10 correctly named QR code images (`..._qr_code_01.png` to `..._qr_code_10.png`). |
| 3 | **CSV Generation**                             | Paste 5 valid CSV lines. Check both "Include" checkboxes. Click Generate. 5 images are created, each with text captions above and below the QR code. |
| 4 | **Mixed Data & Errors**                        | Paste 5 valid URLs and 3 invalid CSV lines (e.g., 2 or 4 columns). Click Generate. 5 QR codes are saved. An `errors.txt` file is created containing the 3 invalid lines. The UI shows a summary. |
| 5 | **Custom Separator**                           | Change separator to `,`. Paste `top,url,bottom`. Click Generate. The CSV is parsed correctly.                                               |
| 6 | **Custom Filename**                            | Change "File Name" input to `my-batch`. Click Generate. The output folder and all files include `my-batch` in their names.                  |
| 7 | **Dynamic Padding**                            | Generate 105 QR codes. The filenames should be padded to 3 digits (e.g., `_001.png`, `_105.png`).                                           |
| 8 | **CSV Upload**                                 | Have text in the textarea. Click "Upload CSV" and select a file. The textarea content is replaced by the file content.                      |
| 9 | **UI State During Generation**                 | Click Generate. All inputs and buttons become disabled. The Generate button shows "Generating...". After completion, everything is re-enabled. |
| 10| **Input Validation**                           | Enter "invalid name" (with a space) in the File Name input. The generation should be blocked or the input sanitized.                        |