# LLM Context: Chrome Bulk QR Code Generator Project

## Project Core
- **Goal**: Transform the Chrome extension from a single-URL QR code generator into a powerful bulk generation tool that operates in its own dedicated tab.
- **Root Directory**: `~/Repos/plugins/chrome-extensions/qrcodebulk`
- **Primary Specification**: See `01_spec.md`.
- **Implementation Plan**: See `02_todo.md`.

## User & Agent Roles
- **User Profile**: The client and backend developer, who provides requirements, feedback, and approves key decisions.
- **Agent Role**: The executor and frontend developer. The agent is responsible for proposing professional solutions, implementing the project, and demonstrating progress for approval.
- **Language**: Russian for communication, English for code and technical terms.

## Technical Stack & Architecture
- **Stack**: Plain HTML, CSS, JavaScript. No frameworks.
- **Manifest**: Version 3.
- **Architecture**:
    - A **background script** listens for the extension icon click.
    - On click, it opens a **dedicated tab** with the main application (`bulk.html`).
    - All logic and UI are contained within the `bulk.html` page and its associated JS/CSS files.
- **Permissions**: `downloads`. The `activeTab` permission is no longer needed.
- **Dependencies**: npm `qrcode` bundled via `esbuild` into `dist/bulk.js`.

## Key Design Decisions (V2 - Bulk Generator) ✅ IMPLEMENTED
- **UI**: A full, responsive web page in a dedicated tab, not a small popup. ✅
- **Data Input**: A primary textarea for pasting data, supporting both simple URLs (one per line) and CSV data (`top_text;URL;bottom_text`). ✅
- **CSV Flexibility**: The separator character (`;`) is user-configurable. ✅
- **File Upload**: A CSV file can be uploaded, replacing the content of the textarea. ✅
- **Generation Logic**:
    - **Partial Success**: The tool processes all valid lines and generates QR codes for them. ✅
    - **Error Handling**: Invalid lines are skipped and logged into an `errors.log` file, which is saved alongside the generated images. A summary message is displayed in the UI. ✅
- **File Naming**: A precise, timestamped naming convention for both the output folder and the image files (`yyyyMMdd-hhmm_customText_001.png`). Zero-padding for the file number is dynamic based on the total count. ✅
- **User Experience**: The UI is disabled during the generation process to prevent concurrent modifications, with clear feedback provided to the user. ✅

## Implementation Status
- **Phase 1**: ✅ COMPLETED - Foundational shift from popup to tab
- **Phase 2**: ✅ COMPLETED - Full UI implementation with responsive design
- **Phase 3**: ✅ COMPLETED - Core logic implementation (parsing, generation, bulk processing)
- **Phase 4**: ✅ COMPLETED - Error logging, advanced controls, and final polish

## Current State
The extension is fully functional and ready for testing. All features from the specification have been implemented:
- Background script opens dedicated tab on icon click
- Complete UI with all required controls
- Data parsing for URLs and CSV format
- Bulk QR code generation with composite images
- Error logging and user feedback
- File upload functionality
- Advanced settings (image size, custom filename)
- Responsive design for mobile/desktop
