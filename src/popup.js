import QRCode from 'qrcode';

document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0] ? tabs[0] : null;
        const url = activeTab && typeof activeTab.url === 'string' ? activeTab.url : '';

        if (isRestrictedUrl(url) || url === '') {
            showRestrictedMessage();
            return;
        }

        const previewContainer = document.getElementById('qrcode-container');
        renderPreviewQRCode(previewContainer, url);

        wireUpUi(url);
    });
});

function isRestrictedUrl(url) {
    if (!url) return true;
    return url.startsWith('chrome://') || url === 'about:blank';
}

function showRestrictedMessage() {
    const root = document.getElementById('container') || document.body;
    if (root) {
        root.innerHTML = '';
        const message = document.createElement('div');
        message.textContent = 'QR code cannot be generated for this page.';
        message.style.padding = '16px';
        message.style.color = '#333';
        root.appendChild(message);
    }
}

function renderPreviewQRCode(container, url) {
    if (!container) return;
    // Fixed preview size independent from export size controls
    QRCode.toCanvas(url, { width: 280 }, (error, canvas) => {
        if (error) {
            console.error(error);
            return;
        }
        container.innerHTML = '';
        container.appendChild(canvas);
    });
}

function parseSizeInput(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 512; // default
    }
    return parsed;
}

function wireUpUi(url) {
    const showUrlCheckbox = document.getElementById('show-url-checkbox');
    const urlContainer = document.getElementById('url-container');
    const urlDisplay = document.getElementById('url-display');
    const sizeInput = document.getElementById('size-input');
    const copyBtn = document.getElementById('copy-btn');
    const saveAsBtn = document.getElementById('save-as-btn');
    const quickSaveBtn = document.getElementById('quick-save-btn');

    // Show URL toggle
    if (showUrlCheckbox && urlContainer && urlDisplay) {
        showUrlCheckbox.addEventListener('change', () => {
            const checked = showUrlCheckbox.checked;
            urlDisplay.value = checked ? url : '';
            urlContainer.style.display = checked ? 'block' : 'none';
        });
    }

    // Copy to clipboard
    if (copyBtn && sizeInput) {
        copyBtn.addEventListener('click', async () => {
            const requestedSize = parseSizeInput(sizeInput.value);
            try {
                const includeCaption = !!(showUrlCheckbox && showUrlCheckbox.checked);
                const canvas = await generateExportCanvas(url, requestedSize, includeCaption, url);
                await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create image blob'));
                            return;
                        }
                        const item = new ClipboardItem({ 'image/png': blob });
                        navigator.clipboard.write([item]).then(resolve).catch(reject);
                    }, 'image/png');
                });
                flashButton(copyBtn, 'Copied!');
            } catch (err) {
                console.error('Copy failed:', err);
            }
        });
    }

    // Save as... (user chooses location)
    if (saveAsBtn && sizeInput) {
        saveAsBtn.addEventListener('click', async () => {
            const requestedSize = parseSizeInput(sizeInput.value);
            try {
                const includeCaption = !!(showUrlCheckbox && showUrlCheckbox.checked);
                const canvas = await generateExportCanvas(url, requestedSize, includeCaption, url);
                const dataUrl = canvas.toDataURL('image/png');
                if (chrome && chrome.downloads && typeof chrome.downloads.download === 'function') {
                    chrome.downloads.download({
                        url: dataUrl,
                        filename: 'qrcode.png',
                        saveAs: true
                    });
                } else {
                    // Fallback: anchor click (will likely auto-save without dialog in Chrome)
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'qrcode.png';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                }
            } catch (err) {
                console.error('Save as failed:', err);
            }
        });
    }

    // Quick Save (fixed 512x512 to Downloads/qr-codes/)
    if (quickSaveBtn) {
        quickSaveBtn.addEventListener('click', async () => {
            const defaultSize = 512;
            try {
                const includeCaption = !!(showUrlCheckbox && showUrlCheckbox.checked);
                const canvas = await generateExportCanvas(url, defaultSize, includeCaption, url);
                const dataUrl = canvas.toDataURL('image/png');
                if (chrome && chrome.downloads && typeof chrome.downloads.download === 'function') {
                    chrome.downloads.download({
                        url: dataUrl,
                        filename: 'qr-codes/qrcode.png',
                        saveAs: false
                    });
                } else {
                    // Fallback: trigger normal download if API unavailable
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'qrcode.png';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                }
            } catch (err) {
                console.error('Quick Save failed:', err);
            }
        });
    }
}

function generateQrCanvas(text, size) {
    return new Promise((resolve, reject) => {
        QRCode.toCanvas(text, { width: size }, (error, canvas) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(canvas);
        });
    });
}

function flashButton(buttonEl, tempText) {
    if (!buttonEl) return;
    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = tempText;
    setTimeout(() => {
        buttonEl.textContent = originalText;
        buttonEl.disabled = false;
    }, 1200);
}

async function generateExportCanvas(qrText, qrSize, includeCaption, captionText) {
    const qrCanvas = await generateQrCanvas(qrText, qrSize);
    if (!includeCaption) return qrCanvas;

    const horizontalPaddingPx = Math.round(Math.max(8, qrSize * 0.02));
    const verticalPaddingPx = Math.round(Math.max(8, qrSize * 0.02));
    const fontSizePx = Math.max(10, Math.min(18, Math.round(qrSize * 0.035)));
    const lineHeightPx = Math.round(fontSizePx * 1.3);
    const maxTextWidthPx = qrSize - horizontalPaddingPx * 2;

    const ctxMeasure = document.createElement('canvas').getContext('2d');
    ctxMeasure.font = `${fontSizePx}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
    const lines = wrapTextToWidth(ctxMeasure, captionText, maxTextWidthPx);
    const captionHeightPx = verticalPaddingPx + lines.length * lineHeightPx + verticalPaddingPx;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = qrSize;
    outCanvas.height = qrSize + captionHeightPx;
    const ctx = outCanvas.getContext('2d');

    // Draw QR (already has white modules/background as produced by library)
    ctx.drawImage(qrCanvas, 0, 0);

    // Draw caption background white to ensure readability
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, qrSize, outCanvas.width, captionHeightPx);

    // Draw caption text
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSizePx}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    let y = qrSize + verticalPaddingPx;
    const x = horizontalPaddingPx;
    for (const line of lines) {
        ctx.fillText(line, x, y);
        y += lineHeightPx;
    }

    return outCanvas;
}

function wrapTextToWidth(ctx, text, maxWidth) {
    // URLs can be long without spaces: break by characters
    const lines = [];
    let currentLine = '';
    for (let i = 0; i < text.length; i += 1) {
        const nextLine = currentLine + text[i];
        const metrics = ctx.measureText(nextLine);
        if (metrics.width <= maxWidth || currentLine.length === 0) {
            currentLine = nextLine;
        } else {
            lines.push(currentLine);
            currentLine = text[i];
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}
