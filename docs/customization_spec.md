# QR Code Customization Specification

## Overview

Extension: Bulk QR Code Generator
Feature: QR Code Customization (colors, branded label, custom image)

---

## Stage 1: Color Customization

### UI Elements (in Preview Panel)
- **Background Color Picker** — `<input type="color">` for QR background
- **Foreground Color Picker** — `<input type="color">` for QR code + text
- **Reset Button** — resets both colors to defaults

### Default Values
- Background: `#ffffff`
- Foreground: `#000000`

### Behavior
- Colors applied via `qrcode` library options: `{ color: { dark: '#000000', light: '#ffffff' } }`
- `createCompositeCanvas()` uses foreground color for text
- Selected colors saved to `chrome.storage.local` (keys: `qrBackgroundColor`, `qrForegroundColor`)
- On load: restore colors from storage (if exists)

### Implementation Points
- `bulk.html`: add color controls in preview panel
- `bulk.css`: style color pickers and reset button
- `bulk.js`:
  - Add elements for color inputs and reset button
  - Wire up event listeners
  - Update `generateQRCodeBlob()` to pass colors to QRCode
  - Update `createCompositeCanvas()` to use foreground color
  - Add functions to save/load colors from storage
  - Add reset function

---

## Stage 2: Branded Center Label (Pax Cultura)

### Visual
- Symbol: Pax Cultura (Рерих) — circle with three dots inside
- SVG, monochrome, color from foreground color
- Positioned at center of QR code
- Size: 20% of QR code width (max safe zone to preserve scanability)

### Behavior
- Always present by default
- Drawn on top of QR code using canvas `drawImage()`
- Respects foreground color setting

### Implementation Points
- Create inline SVG for Pax Cultura symbol
- Add `drawCenterLabel()` function that renders SVG to temporary canvas
- Call `drawCenterLabel()` in `generateQRCodeBlob()` and `generatePreviewQR()`
- Scale and center the label within safe zone

---

## Stage 3: Custom Center Image

### UI Elements (in Preview Panel)
- **Upload Button** — file input for images (PNG, JPG, SVG)
- Image replaces Pax Cultura symbol when uploaded
- Reset action: returns to Pax Cultura symbol (no separate "remove" button)

### Default State
- Pax Cultura symbol (Stage 2)

### Behavior
- User uploads image → image displayed in center
- Image data saved to `chrome.storage.local` as base64 (key: `customCenterImage`)
- Max dimensions: 25% of QR code size (preserves scanability)
- Supported formats: PNG, JPG, SVG
- "Reset to default" button returns to Pax Cultura symbol

### Implementation Points
- Add file input and upload button in preview panel
- Add `loadCustomImage()` function using FileReader
- Modify center label logic: if custom image exists, draw it; otherwise draw Pax Cultura
- Save/load custom image data from storage
- Add reset functionality to clear custom image and return to symbol

---

## File Structure

```
src/
  bulk.html      # Add customization controls to preview panel
  bulk.css       # Style customization UI
  bulk.js        # Core logic modifications
```

---

## Technical Notes

### QR Scanability Safety
- Center image/logo area must not exceed 20-30% of QR code size
- Default Pax Cultura symbol: 20% width
- Custom images: constrained to max 25% width
- Use QRCode library `margin: 2` option for spacing

### Storage Keys
- `qrBackgroundColor` — hex color string for background
- `qrForegroundColor` — hex color string for foreground
- `customCenterImage` — base64 encoded image data (null/empty = use Pax Cultura)

### Libraries
- `qrcode` — QR generation with color support
- Native Canvas API — drawing overlays
