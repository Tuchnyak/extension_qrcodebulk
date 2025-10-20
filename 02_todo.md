# Project Blueprint: Bulk QR Code Generator Extension

This document provides a step-by-step implementation plan for refactoring the QR Code extension into a bulk generation tool. Each step is designed as a prompt for a code-generation LLM, ensuring safe, incremental progress.

---

### Phase 1: Foundational Shift from Popup to Tab

Goal: Change the extension's core behavior from opening a popup to opening a dedicated tab.

- [x] **Step 1: Modify Manifest and Create Background Script**
    - **Goal**: Configure the extension to open a new tab when the icon is clicked.
    - **Tasks**:
        1.  Edit `manifest.json`: remove the `action.default_popup` key.
        2.  Add a `background` service worker pointing to `background.js`.
        3.  Create `background.js` to listen for `chrome.action.onClicked` and open `bulk.html` in a new tab.

- [x] **Step 2: Create the New HTML Page Structure**
    - **Goal**: Set up the basic HTML file that will serve as the main application page.
    - **Tasks**:
        1.  Rename `src/popup.html` to `src/bulk.html`.
        2.  Rename `src/popup.js` to `src/bulk.js`.
        3.  Rename `src/popup.css` to `src/bulk.css`.
        4.  Update `src/bulk.html` to be a full-page document and link it to `bulk.css` and `bulk.js`.
        5.  Clean up the content of `bulk.html`, leaving only a basic title and a `<h1>` placeholder.

- [x] **Verification**:
    - **Goal**: Confirm the foundational changes are working.
    - **Action**: Load the unpacked extension in Chrome. Click the extension icon. Verify that a new tab opens with the `bulk.html` page showing the `<h1>` placeholder.

---

### Phase 2: Building the User Interface

Goal: Construct the full static UI for the bulk generator page according to the specification.

- [x] **Step 3: Build the Static HTML Layout**
    - **Goal**: Add all required UI elements to `bulk.html` without any active logic.
    - **Tasks**:
        1.  In `bulk.html`, create the structure for all UI components: header, instructions, CSV controls (input, checkboxes, button), textarea, generate button, and the advanced settings spoiler with its internal inputs.
        2.  Assign clear and consistent IDs to all interactive elements.

- [x] **Step 4: Apply CSS for a Responsive Layout**
    - **Goal**: Style the UI to be clean, modern, and responsive.
    - **Tasks**:
        1.  In `bulk.css`, add styles for a centered, max-width main container.
        2.  Use flexbox or grid for layout of control groups.
        3.  Ensure the textarea has a fixed height and visible scrollbar on overflow.
        4.  Style the advanced settings spoiler to be functional (though the JS for toggling will come later).
        5.  Add media queries to ensure the layout adapts well to smaller screen widths.

- [x] **Verification**:
    - **Goal**: Confirm the static UI is rendered correctly.
    - **Action**: Reload the extension in Chrome and open the main tab. Verify that all UI elements are present, styled, and responsive. Test resizing the window to check the mobile layout.

---

### Phase 3: Implementing Core Logic

Goal: Breathe life into the UI by implementing the data processing and QR generation logic.

- [x] **Step 5: Implement Data Parsing and Validation**
    - **Goal**: Write the JavaScript logic to read and interpret the user's input from the textarea.
    - **Tasks**:
        1.  In `bulk.js`, add an event listener to the "Generate" button.
        2.  Inside the listener, grab the content from the textarea and the separator input.
        3.  Create a `parseData` function that splits the content into lines, ignores empty ones, and processes each line based on the separator's presence.
        4.  The function should return two arrays: `validLines` and `invalidLines`.
        5.  For now, `console.log` the contents of these two arrays.

- [x] **Step 6: Implement Single QR Code Generation and Download**
    - **Goal**: Verify that a single QR code can be generated and saved with the correct naming convention.
    - **Tasks**:
        1.  Create a `generateAndDownload` async function that takes a single data object and an index.
        2.  This function should:
            - Generate a QR code to a canvas.
            - Get the current timestamp and custom filename text.
            - Format the directory path and filename according to the spec (e.g., `~/Downloads/001_bulk_qr_codes/20251019_1400_qr_code/20251019_1400_qr_code_001.png`).
            - Use `chrome.downloads.download()` to save the canvas as a PNG.
        3.  Update the "Generate" button listener to call this function for just the *first* valid line from the parsed data.

- [x] **Step 7: Implement Full Bulk Processing**
    - **Goal**: Loop through all valid lines and manage the UI state during generation.
    - **Tasks**:
        1.  Modify the "Generate" button listener to iterate over the entire `validLines` array.
        2.  Implement the dynamic zero-padding for the filenames based on the length of the `validLines` array.
        3.  Create `lockUI` and `unlockUI` functions to disable/enable all form controls and update the "Generate" button's text and state.
        4.  Wrap the generation loop with `lockUI()` at the start and `unlockUI()` at the end.

- [x] **Verification**:
    - **Goal**: Confirm the core bulk generation logic is working.
    - **Action**: Reload the extension. Paste a small batch of valid URLs into the textarea. Click "Generate". Verify that the UI locks during the process, the correctly named QR code files are saved to the correct folder, and the UI unlocks upon completion.

---

### Phase 4: Finalizing Features and Edge Cases

Goal: Implement the remaining features like error logging and advanced controls.

- [x] **Step 8: Implement Error Logging and UI Feedback**
    - **Goal**: Create the `errors.log` file and display a summary message.
    - **Tasks**:
        1.  If the `invalidLines` array is not empty after parsing, create a string or Blob containing the content of these lines.
        2.  Download this Blob as `errors.log` to the same output sub-directory.
        3.  Implement a function to update the status area on the page with a summary message.

- [x] **Step 9: Wire Up Advanced Settings and CSV Controls**
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

- [x] **Step 10: Final Polish**
    - **Goal**: Add final touches for a complete user experience.
    - **Tasks**:
        1.  Ensure the placeholder text in the textarea is styled correctly (e.g., light gray).
        2.  Review all UI text for clarity and consistency.
        3.  Perform a final round of manual testing based on the spec's testing plan.

- [x] **Final Verification**:
    - **Goal**: Confirm all features are integrated and working correctly.
    - **Action**: Perform a full end-to-end test. Use mixed valid and invalid data. Test the CSV upload, custom separator, advanced settings, and error log generation. Ensure the final user experience is smooth and robust.

---

### Phase 5: UI/UX Improvements Based on Testing Feedback

Goal: Address identified issues and enhance user experience based on real-world testing.

- [x] **Step 11: Fix CSS Layout Issues**
    - **Goal**: Resolve visual layout problems identified during testing.
    - **Tasks**:
        1. Fix separator input field overlapping with checkbox labels in CSV controls section.
        2. Ensure proper spacing and alignment for all form elements.

- [ ] **Step 12: Enhance Generate Button with File Count**
    - **Goal**: Show user how many files will be generated before starting the process.
    - **Tasks**:
        1. Add dynamic file count display to the Generate button (e.g., "Generate QR Codes (5 files)").
        2. Update the count in real-time as user modifies the textarea content.
        3. Handle edge cases (empty input, invalid lines).

- [ ] **Step 13: Improve Text Rendering on QR Images**
    - **Goal**: Make text on composite images more readable and properly sized.
    - **Tasks**:
        1. Increase font size for text overlays on QR code images.
        2. Make font size responsive to QR code dimensions (larger QR = larger text).
        3. Improve text positioning and padding calculations.

- [ ] **Step 14: Add Generation Time Tracking**
    - **Goal**: Provide user feedback on processing time.
    - **Tasks**:
        1. Track start and end time of the generation process.
        2. Display elapsed time in the completion status message.
        3. Format time appropriately (seconds for small batches, minutes for large ones).

- [ ] **Step 15: Add File Manager Integration**
    - **Goal**: Allow users to easily access generated files.
    - **Tasks**:
        1. Add a button or link in the completion message to open file manager.
        2. Use appropriate API to open the Downloads folder or specific subdirectory.
        3. Handle cross-platform compatibility (Windows, Mac, Linux).

- [ ] **Step 16: Implement ZIP Archive Option**
    - **Goal**: Provide option to save all QR codes as a single ZIP file.
    - **Tasks**:
        1. Add checkbox "Save as ZIP archive" in advanced settings.
        2. Implement ZIP creation using JavaScript library (e.g., JSZip).
        3. Modify download logic to create single ZIP file instead of multiple PNG files.
        4. Update file naming convention for ZIP files.

- [ ] **Step 17: Replace Extension Icons (Final Step)**
    - **Goal**: Update extension icons to better represent bulk QR generation.
    - **Tasks**:
        1. Design or source new icons that reflect bulk/multiple QR code generation.
        2. Create icons in required sizes (16px, 48px, 128px).
        3. Update icon files and test display in Chrome toolbar.

- [ ] **Final Testing and Polish**:
    - **Goal**: Ensure all improvements work together seamlessly.
    - **Action**: Perform comprehensive testing of all new features. Verify UI improvements, time tracking, file manager integration, and ZIP functionality. Test with various data sizes and formats.
