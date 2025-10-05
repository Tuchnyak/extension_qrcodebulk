# Project Blueprint: QR Code Generator Extension

This document provides a step-by-step implementation plan, broken down into a series of prompts for a code-generation LLM. Each step builds upon the previous one, ensuring incremental and safe progress.

---

### Phase 1: The Core Skeleton

Our first goal is to create a minimal, installable Chrome extension that does nothing but show a placeholder popup. This verifies the basic project structure.

- [x] **Step 1: Create the Manifest and Popup HTML**

```text
Create the foundational files for a Chrome extension.

1.  **`manifest.json`**:
    - Use Manifest V3.
    - Set the name to "QR Code Generator".
    - Set the version to "1.0".
    - Set the description to "Generates a QR code for the current page URL."
    - Define the `action` to use a `default_popup` pointing to `popup.html`.
    - Request the `activeTab` permission.

2.  **`popup.html`**:
    - Create a basic HTML5 structure.
    - Set the title to "QR Code Generator".
    - Add a single `div` with the ID `qrcode-container` inside the body. This div will hold the QR code later.
    - Set a fixed size for the body (e.g., 300px width) to create a stable popup window.
```

---

### Phase 2: Core Logic Implementation

Now, let's bring the extension to life by implementing the primary function: getting the URL and displaying the QR code.

- [x] **Step 2: Create the Popup Script and Get the URL**

```text
Create the main JavaScript file and link it to the popup. The goal is to verify that we can correctly retrieve the URL of the active tab.

1.  **Create `popup.js`**.
2.  **Modify `popup.html`**:
    - Add a `<script src="popup.js" defer></script>` tag at the end of the `<body>`.
3.  **In `popup.js`**:
    - Write a script that executes when the popup is opened.
    - Use the `chrome.tabs.query({active: true, currentWindow: true})` API to get the current active tab.
    - Once you have the tab, extract its URL.
    - For now, simply log the URL to the console using `console.log(url)`. This allows us to verify this step is working correctly.
```

- [x] **Step 3: Integrate QR Code Generation Library**
  - Implemented using npm package `qrcode` and bundling via `esbuild` into `dist/popup.js` (instead of copying a local `lib/qrcode.min.js`). Functionality equivalent.

```text
Download a QR code generation library and use it to display the QR code from the retrieved URL.

1.  **Create a `lib` directory.**
2.  **Download `qrcode.min.js`**: Fetch the minified version of the 'qrcode' library (from a reliable source like a CDN, e.g., `https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`) and save it as `lib/qrcode.min.js`.
3.  **Modify `popup.html`**:
    - Include the local library by adding `<script src="lib/qrcode.min.js" defer></script>` *before* the `popup.js` script tag.
4.  **Modify `popup.js`**:
    - Remove the `console.log(url)`.
    - Use the `QRCode.toCanvas()` method from the library to generate the QR code.
    - The data for the QR code should be the URL of the active tab.
    - The generated `<canvas>` element should be appended to the `qrcode-container` div from `popup.html`.
    - Set the canvas width and height to a reasonable default, like 280px.
```

---

### Phase 3: Building the User Interface

With the core logic working, we'll now build the full user interface as specified.

- [x] **Step 4: Create the Full HTML Structure and CSS**

```text
Expand the popup's UI to include all the controls from the specification and apply basic styling for a clean layout.

1.  **Create `popup.css`**.
2.  **Modify `popup.html`**:
    - Link the stylesheet: `<link rel="stylesheet" href="popup.css">`.
    - Below the `qrcode-container`, add the following elements inside a `controls` div:
        - A `div` for the "Show URL" option containing a checkbox (`id="show-url-checkbox"`) and its label.
        - A `div` containing the URL display area (`id="url-container"`, initially hidden).
        - A `div` for the size input, containing a label and a number input (`id="size-input"`, default value `512`).
        - A `div` for the action buttons, containing three buttons:
            - "Quick Save" (`id="quick-save-btn"`)
            - "Save as..." (`id="save-as-btn"`)
            - "Copy to clipboard" (`id="copy-btn"`)
3.  **In `popup.css`**:
    - Use flexbox to create a clean, centered layout.
    - Add basic styling (padding, margins, font sizes) to make the UI look modern and organized.
    - Hide the `url-container` by default (`display: none`).
```

---

### Phase 4: Wiring Up UI Actions

The UI is in place. Now, let's make the buttons and controls functional.

- [x] **Step 5: Implement "Copy to Clipboard"**

```text
Wire up the "Copy to clipboard" button. This is a good first action as it's self-contained.

1.  **Modify `popup.js`**:
    - Get a reference to the "Copy" button and the size input field.
    - Add a click event listener to the button.
    - Inside the listener, read the desired size from the input field.
    - Generate a new, temporary canvas with the specified size using the QR code library.
    - Convert the canvas to a blob (`canvas.toBlob()`).
    - Use the `navigator.clipboard.write()` API with a `ClipboardItem` to copy the image blob to the clipboard.
    - Briefly change the button text to "Copied!" for user feedback.
```

- [x] **Step 6: Implement "Save as..."**
  - Implemented using `chrome.downloads.download({ saveAs: true })` to reliably show the system dialog.

```text
Wire up the "Save as..." button. This uses a standard web technique to trigger a download.

1.  **Modify `popup.js`**:
    - Get a reference to the "Save as..." button.
    - Add a click event listener.
    - Inside the listener, similar to the copy function, generate a temporary canvas with the size specified in the input field.
    - Convert the canvas to a data URL (`canvas.toDataURL('image/png')`).
    - Create a temporary `<a>` element.
    - Set its `href` to the data URL.
    - Set its `download` attribute to a descriptive name, like `qrcode.png`.
    - Programmatically click the link to trigger the download dialog, then remove the link from the DOM.
```

- [x] **Step 7: Implement "Quick Save"**

```text
Wire up the "Quick Save" button using the `chrome.downloads` API.

1.  **Modify `manifest.json`**:
    - Add the `downloads` permission to the `permissions` array.
2.  **Modify `popup.js`**:
    - Get a reference to the "Quick Save" button.
    - Add a click event listener.
    - Inside the listener, generate a temporary canvas with the default size of `512x512`.
    - Convert the canvas to a data URL.
    - Use the `chrome.downloads.download()` API to save the file.
    - Set the `filename` property in the options to `qr-codes/qrcode.png` to place it in the desired subdirectory.
```

---

### Phase 5: Finalizing Logic and Edge Cases

This is the final phase of coding, where we tie up loose ends and handle special conditions.

- [x] **Step 8: Implement Remaining UI Logic and Error Handling**

```text
Finalize the remaining interactive elements and implement the error handling for special pages.

1.  **Modify `popup.js`**:
    - **"Show URL" Checkbox**: Add an event listener to the checkbox. On change, toggle the visibility of the `url-container` and populate it with the current tab's URL.
    - **Input Validation**: In the "Copy" and "Save as..." functions, add a check to ensure the value from the size input is a valid positive number. If not, fall back to the default of 512.
    - **Error Handling**: At the very beginning of the script, check if the retrieved URL starts with `chrome://` or is `about:blank`. If it is, hide the main controls and display an error message inside the popup body instead.
```

- [ ] **Step 9: Add Extension Icons**

```text
Add the necessary icons to make the extension look professional in the Chrome toolbar and extensions page.

1.  **Create an `icons` directory.**
2.  **Add placeholder icons**: Create or add three PNG icons in this directory:
    - `icon16.png` (16x16)
    - `icon48.png` (48x48)
    - `icon128.png` (128x128)
3.  **Modify `manifest.json`**:
    - Update the `action` object to include a `default_icon` section pointing to the different icon sizes.
    - Add a top-level `icons` key pointing to the icon sizes for use on the extensions page and in the web store.
```
