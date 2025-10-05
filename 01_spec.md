# Developer Specification: QR Code Generator Chrome Extension

## 1. Overview

This document outlines the technical specification for a Chrome browser extension that generates a QR code for the current page's URL. The primary goal is to provide a simple, fast, and intuitive user experience.

## 2. Core Functionality & Requirements

### 2.1. Activation and UI
- The extension is activated by clicking its icon in the Chrome toolbar.
- A popup UI appears directly below the icon.

### 2.2. Popup Interface Components
1.  **QR Code Image**: The generated QR code is the central element of the popup.
2.  **URL Display Checkbox**:
    - A checkbox labeled "Show URL".
    - Default state: Unchecked.
    - When checked, a read-only text field with the full URL appears below the QR code.
    - When checked, any exported image (Copy, Save as..., Quick Save) includes the URL as a caption rendered under the QR code.
3.  **Image Size Input**:
    - A number input field allowing the user to specify the side length of the QR code image in pixels.
    - Default value: `512`.
4.  **Action Buttons**:
    - **"Quick Save"**:
        - Saves the QR code as a PNG image.
        - Image size is fixed at the default value (`512x512` pixels).
        - The file is saved directly to the user's `Downloads/qr-codes/` directory without a "Save as" dialog.
    - **"Save as..."**:
        - Opens the system's "Save as" dialog.
        - Image size is determined by the value in the **Image Size Input** field.
        - Implemented via `chrome.downloads.download({ saveAs: true })`.
    - **"Copy to clipboard"**:
        - Copies the QR code image to the system clipboard.
        - Image size is determined by the value in the **Image Size Input** field.

## 3. Architecture

The extension will use a minimal and efficient architecture consisting only of a **Manifest V3** and a **Popup Script**.

- **`manifest.json`**:
    - Defines the extension's properties, permissions, and entry points.
    - **Permissions**: Requires `activeTab` (to read the current tab URL) and `downloads` (for Quick Save and Save as...).
    - **Action**: Defines the `default_popup` as the built popup HTML served from `dist/`.
- **Popup Scripts (`popup.html`, `popup.js`, `popup.css`)**:
    - `popup.html`: Contains the structure of the popup UI.
    - `popup.css`: Contains the styles for the popup UI.
    - `popup.js`: Contains all the client-side logic:
        - Fetching the URL from the active tab.
        - Handling user interactions (button clicks, checkbox toggles, input changes).
        - Calling the QR code generation library.
        - Implementing the save and copy functionalities.
    - Build: Source files live under `src/` and are bundled to `dist/` using `esbuild`. The QR library is consumed as an npm dependency (`qrcode`).

A background script is not necessary for this initial version, as no background processing or state management is required.

## 4. Data Handling & Logic

- **URL Acquisition**: The URL of the active tab will be retrieved using the `chrome.tabs.query({active: true, currentWindow: true})` API call within `popup.js`.
- **QR Code Generation**: A well-maintained, third-party JavaScript library (e.g., `qrcode`) will be used for generating the QR code data.
- **User Input Validation**: The value from the **Image Size Input** field should be validated. If the input is not a positive integer, the default value of `512` should be used for the "Save as..." and "Copy" operations.
 - **Caption Rendering**: If "Show URL" is enabled, exports compose a larger canvas: QR of the requested size on top, plus a text caption area below with wrapping and a white background for readability.

## 5. Error Handling

- **Unavailable Pages**: If the extension is activated on a page where the URL is inaccessible (e.g., `chrome://extensions`, `about:blank`, the New Tab Page), the popup should not display the QR code generator UI. Instead, it should show a clear, user-friendly message, such as "QR code cannot be generated for this page."
- **Invalid Size Input**: As mentioned above, non-numeric or non-positive input in the size field should be handled gracefully by falling back to the default size. The input field could optionally be highlighted with a red border to indicate an error.

## 6. Testing Plan

A manual testing plan should be executed to ensure quality before release.

| # | Scenario                               | Expected Outcome                                                                                             |
|---|----------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1 | **Basic Generation**                   | Click icon on a standard webpage (`https://google.com`). A valid QR code is displayed.                         |
| 2 | **Long URL**                           | Test with a very long URL (e.g., with many query parameters). A more complex but valid QR code is generated.   |
| 3 | **"Show URL" Checkbox**                | Toggle the checkbox. The URL text should appear and disappear accordingly.                                   |
| 4 | **"Quick Save" Button**                | Click "Quick Save". A `512x512` PNG file is saved to `Downloads/qr-codes/`.                                    |
| 5 | **"Save as..." Button**                | Change size to `1024`. Click "Save as...". The "Save as" dialog appears. The saved file is `1024x1024`.        |
| 6 | **"Copy to clipboard" Button**         | Change size to `256`. Click "Copy". Paste into an image editor. The pasted image is `256x256`.                  |
| 7 | **Caption When Enabled**               | Enable "Show URL". Use Copy/Save/Quick Save. Exported image contains the URL caption under the QR.             |
| 8 | **Invalid Page**                       | Open `chrome://extensions` and click the icon. The popup shows the specified error message.                  |
| 9 | **Invalid Size Input**                 | Enter "abc" in the size field and click "Save as...". The dialog opens to save a `512x512` image.              |

## 7. Future Enhancements (Post-V1)

The following features are scoped out for future releases and could be part of a premium/pro version:

- **QR Code Customization**:
    - Add a custom logo/image to the center of the QR code.
    - Allow changing the color of the QR code.
- **URL Optimization**:
    - Option to automatically strip tracking parameters (e.g., UTM, fbclid) from the URL before generation.
- **UX Improvements**:
    - Dynamically disable (grey out) the extension icon on pages where it cannot be used.
