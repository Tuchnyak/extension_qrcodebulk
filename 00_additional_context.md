# LLM Context: Chrome QR Code Generator Project

## Project Core
- **Goal**: Create a Chrome extension to generate a QR code for the active tab's URL.
- **Root Directory**: `/home/tuchnyak/Repos/plugins/chrome-extensions/qrcode`
- **Primary Specification**: See `01_spec.md`.
- **Implementation Plan**: See `02_todo.md`.

## User & Agent Roles
- **User Profile**: The client, who provides requirements, feedback, and approves key decisions.
- **Agent Role**: The executor/developer. The agent is responsible for proposing professional solutions, implementing the project, and demonstrating progress for approval.
- **Language**: Russian for communication, English for code and technical terms.

## Technical Stack & Architecture
- **Stack**: Plain HTML, CSS, JavaScript. No frameworks.
- **Manifest**: Version 3.
- **Architecture**: Simple popup-based. No background script for V1.
- **Permissions**: `activeTab`, `downloads`.
- **Dependencies**: `qrcode.js` library, to be included locally.

## Key Design Decisions (V1)
- **UI**: A popup window triggered by the extension's action icon.
- **Default QR Size**: 512x512 pixels. This is the standard for "Quick Save" and the default value in the size input field.
- **Features**:
    - **Quick Save**: Saves a 512x512px PNG directly to `Downloads/qr-codes/` using the `chrome.downloads` API. No user dialog.
    - **Save as...**: Opens a system dialog to save a PNG of a user-specified size.
    - **Copy to clipboard**: Copies a user-specified size PNG to the clipboard.
- **Error Handling**: For restricted pages (`chrome://`, `about:blank`), the popup will display an error message. The simpler implementation was chosen over disabling the icon.

## Deferred Features (Post-V1 / Potential Pro Version)
- **Customization**: Adding a logo/image to the QR code center.
- **Styling**: Changing the QR code's color.
- **URL Processing**: Option to strip UTM and other tracking parameters.
- **Advanced UX**: Dynamically disabling the action icon on restricted pages (requires a background script).

## Current Project Status
- **Phase**: Initialization.
- **Completed**: Specification (`01_spec.md`), step-by-step plan (`02_todo.md`), and this context file (`03_additional_context.md`) have been created.
- **Next Action**: Commit the three markdown files, then proceed with Step 1 from `02_todo.md` (creating `manifest.json` and `popup.html`).
