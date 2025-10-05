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
                const canvas = await generateQrCanvas(url, requestedSize);
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
                const canvas = await generateQrCanvas(url, requestedSize);
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
                const canvas = await generateQrCanvas(url, defaultSize);
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
