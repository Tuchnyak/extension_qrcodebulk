# QR Code Generator (Chrome Extension)

Simple MV3 extension to generate a QR code for the active tab URL.

## Features
- Generate QR code for current tab
- Copy, Save as..., and Quick Save (512x512 to Downloads/qr-codes/)
- Optional caption with URL on exports when "Show URL" is enabled
- Works on standard pages; shows message on restricted pages

## Development
```bash
npm install
npm run build
# Load unpacked → select project root; popup served from dist/
```

## Packaging
- Build bundled assets:
```bash
npm run build
```
- Create Web Store ZIP:
```bash
npm run zip
```
Archive is created under `release/extension.zip` and contains only files required by MV3.

## Store Submission Checklist
- Manifest v3 with permissions: `activeTab`, `downloads`
- Icons 16/48/128 present and declared
- No remote code execution; QR library bundled via esbuild
- Privacy policy and data usage: no personal data collected; no remote services
- Screenshots: popup on a normal page, copy/save flows

## Privacy
This extension does not collect, transmit, or store any personal data. It operates entirely in the popup context and only accesses the URL of the active tab on user action.

## License
Apache-2.0
