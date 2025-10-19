# Project Blueprint: Bulk QR Code Generator Extension

This document provides a step-by-step implementation plan for refactoring the QR Code extension into a bulk generation tool. Each step is designed as a prompt for a code-generation LLM, ensuring safe, incremental progress.

---

### Phase 1: Foundational Shift from Popup to Tab

Goal: Change the extension's core behavior from opening a popup to opening a dedicated tab.

- [ ] **Step 1: Modify Manifest and Create Background Script**
    - **Goal**: Configure the extension to open a new tab when the icon is clicked.
    - **Tasks**:
        1.  Edit `manifest.json`: remove the `action.default_popup` key.
        2.  Add a `background` service worker pointing to `background.js`.
        3.  Create `background.js` to listen for `chrome.action.onClicked` and open `bulk.html` in a new tab.

- [ ] **Step 2: Create the New HTML Page Structure**
    - **Goal**: Set up the basic HTML file that will serve as the main application page.
    - **Tasks**:
        1.  Rename `src/popup.html` to `src/bulk.html`.
        2.  Rename `src/popup.js` to `src/bulk.js`.
        3.  Rename `src/popup.css` to `src/bulk.css`.
        4.  Update `src/bulk.html` to be a full-page document and link it to `bulk.css` and `bulk.js`.
        5.  Clean up the content of `bulk.html`, leaving only a basic title and a `<h1>` placeholder.

---

### Phase 2: Building the User Interface

Goal: Construct the full static UI for the bulk generator page according to the specification.

- [ ] **Step 3: Build the Static HTML Layout**
    - **Goal**: Add all required UI elements to `bulk.html` without any active logic.
    - **Tasks**:
        1.  In `bulk.html`, create the structure for all UI components: header, instructions, CSV controls (input, checkboxes, button), textarea, generate button, and the advanced settings spoiler with its internal inputs.
        2.  Assign clear and consistent IDs to all interactive elements.

- [ ] **Step 4: Apply CSS for a Responsive Layout**
    - **Goal**: Style the UI to be clean, modern, and responsive.
    - **Tasks**:
        1.  In `bulk.css`, add styles for a centered, max-width main container.
        2.  Use flexbox or grid for layout of control groups.
        3.  Ensure the textarea has a fixed height and visible scrollbar on overflow.
        4.  Style the advanced settings spoiler to be functional (though the JS for toggling will come later).
        5.  Add media queries to ensure the layout adapts well to smaller screen widths.

---

### Phase 3: Implementing Core Logic

Goal: Breathe life into the UI by implementing the data processing and QR generation logic.

- [ ] **Step 5: Implement Data Parsing and Validation**
    - **Goal**: Write the JavaScript logic to read and interpret the user's input from the textarea.
    - **Tasks**:
        1.  In `bulk.js`, add an event listener to the "Generate" button.
        2.  Inside the listener, grab the content from the textarea and the separator input.
        3.  Create a `parseData` function that splits the content into lines, ignores empty ones, and processes each line based on the separator's presence.
        4.  The function should return two arrays: `validLines` and `invalidLines`.
        5.  For now, `console.log` the contents of these two arrays.

- [ ] **Step 6: Implement Single QR Code Generation and Download**
    - **Goal**: Verify that a single QR code can be generated and saved with the correct naming convention.
    - **Tasks**:
        1.  Create a `generateAndDownload` async function that takes a single data object and an index.
        2.  This function should:
            - Generate a QR code to a canvas.
            - Get the current timestamp and custom filename text.
            - Format the directory path and filename according to the spec (e.g., `~/Downloads/001_bulk_qr_codes/20251019_1400_qr_code/20251019_1400_qr_code_001.png`).
            - Use `chrome.downloads.download()` to save the canvas as a PNG.
        3.  Update the "Generate" button listener to call this function for just the *first* valid line from the parsed data.

- [ ] **Step 7: Implement Full Bulk Processing**
    - **Goal**: Loop through all valid lines and manage the UI state during generation.
    - **Tasks**:
        1.  Modify the "Generate" button listener to iterate over the entire `validLines` array.
        2.  Implement the dynamic zero-padding for the filenames based on the length of the `validLines` array.
        3.  Create `lockUI` and `unlockUI` functions to disable/enable all form controls and update the "Generate" button's text and state.
        4.  Wrap the generation loop with `lockUI()` at the start and `unlockUI()` at the end.

---

### Phase 4: Finalizing Features and Edge Cases

Goal: Implement the remaining features like error logging and advanced controls.

- [ ] **Step 8: Implement Error Logging and UI Feedback**
    - **Goal**: Create the `errors.log` file and display a summary message.
    - **Tasks**:
        1.  If the `invalidLines` array is not empty after parsing, create a string or Blob containing the content of these lines.
        2.  Download this Blob as `errors.log` to the same output sub-directory.
        3.  Implement a function to update the status area on the page with a summary message.

- [ ] **Step 9: Wire Up Advanced Settings and CSV Controls**
    - **Goal**: Make all remaining UI controls functional.
    - **Tasks**:
        1.  **Advanced Settings**:
            - Wire up the spoiler/details element to be clickable.
            - Make the generation logic respect the "Image Size" and "File Name" inputs.
            - Add the required validation for the "File Name" input.
        2.  **CSV Controls**:
            - Implement the "Upload CSV" button logic to read a file and replace the textarea content.
            - Add logic to enable/disable the "Include text" checkboxes based on the textarea content.
            - Modify the QR generation function to handle rendering text captions on the canvas if the checkboxes are checked.

- [ ] **Step 10: Final Polish**
    - **Goal**: Add final touches for a complete user experience.
    - **Tasks**:
        1.  Ensure the placeholder text in the textarea is styled correctly (e.g., light gray).
        2.  Review all UI text for clarity and consistency.
        3.  Perform a final round of manual testing based on the spec's testing plan.