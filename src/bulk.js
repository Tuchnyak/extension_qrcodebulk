import QRCode from 'qrcode';
import JSZip from 'jszip';

// Global state
let isGenerating = false;

// DOM elements
let elements = {};
let originalGenerateBtnText = '';

// Color defaults
const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_FG_COLOR = '#000000';

// Feature flags
const ENABLE_CENTER_LABEL = true;

// Small helpers to update progress on the Generate button
function saveOriginalGenerateButtonText() {
    if (elements.generateBtn) originalGenerateBtnText = elements.generateBtn.textContent;
}

function updateGenerateButtonProgress(current, total) {
    if (!elements.generateBtn) return;
    elements.generateBtn.textContent = `Generating ${current}/${total}`;
}

function restoreGenerateButtonText() {
    if (!elements.generateBtn) return;
    if (originalGenerateBtnText) elements.generateBtn.textContent = originalGenerateBtnText;
    else updateGenerateButtonText();
}

function nextTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}



function initializeElements() {
    elements = {
        separatorInput: document.getElementById('separator-input'),
        topTextCheckbox: document.getElementById('top-text-checkbox'),
        bottomTextCheckbox: document.getElementById('bottom-text-checkbox'),
        uploadCsvBtn: document.getElementById('upload-csv-btn'),
        csvFileInput: document.getElementById('csv-file-input'),
        dataTextarea: document.getElementById('data-textarea'),
        generateBtn: document.getElementById('generate-btn'),
        imageSizeInput: document.getElementById('image-size-input'),
        fileNameInput: document.getElementById('file-name-input'),
        zipCheckbox: document.getElementById('zip-checkbox'),
        statusArea: document.getElementById('status-area'),
        previewToggle: document.getElementById('preview-toggle'),
        previewPanel: document.getElementById('preview-panel'),
        previewCanvas: document.getElementById('preview-canvas'),
        previewPlaceholder: document.getElementById('preview-placeholder'),
        bgColorBtn: document.getElementById('bg-color-btn'),
        bgHexInput: document.getElementById('bg-hex-input'),
        bgPickerPanel: document.getElementById('bg-picker-panel'),
        bgPickerCanvas: document.getElementById('bg-picker-canvas'),
        fgColorBtn: document.getElementById('fg-color-btn'),
        fgHexInput: document.getElementById('fg-hex-input'),
        fgPickerPanel: document.getElementById('fg-picker-panel'),
        fgPickerCanvas: document.getElementById('fg-picker-canvas'),
        resetColorsBtn: document.getElementById('reset-colors-btn')
    };
}

function wireUpEventListeners() {
    // CSV file upload
    elements.uploadCsvBtn.addEventListener('click', () => {
        elements.csvFileInput.click();
    });

    elements.csvFileInput.addEventListener('change', handleFileUpload);

    // Textarea changes - update CSV controls, preview, and save text
    elements.dataTextarea.addEventListener('input', () => {
        updateCSVControls();
        updateGenerateButtonText();
        renderPreview();
        saveTextareaContent();
    });

    // Separator changes - update CSV controls and preview
    elements.separatorInput.addEventListener('input', () => {
        updateCSVControls();
        renderPreview();
    });

    // Preview toggle
    elements.previewToggle.addEventListener('click', togglePreview);

    // Top/bottom text checkboxes - update preview
    elements.topTextCheckbox.addEventListener('change', renderPreview);
    elements.bottomTextCheckbox.addEventListener('change', renderPreview);

    // Image size - update preview
    elements.imageSizeInput.addEventListener('change', renderPreview);

    // Generate button
    elements.generateBtn.addEventListener('click', handleGenerate);

    // File name validation
    elements.fileNameInput.addEventListener('input', validateFileName);

    // Color customization
    elements.bgColorBtn.addEventListener('click', (e) => toggleColorPicker('bg', e));
    elements.fgColorBtn.addEventListener('click', (e) => toggleColorPicker('fg', e));
    elements.bgHexInput.addEventListener('input', (e) => handleHexInput('bg', e));
    elements.fgHexInput.addEventListener('input', (e) => handleHexInput('fg', e));
    elements.resetColorsBtn.addEventListener('click', resetColorsToDefault);

    // Close pickers on outside click
    document.addEventListener('click', handleColorPickerOutsideClick);

    // Initialize pickers after DOM
    initColorPickers();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        elements.dataTextarea.value = e.target.result;
        updateCSVControls();
        updateGenerateButtonText();
        saveTextareaContent();
    };
    reader.readAsText(file);

    // Reset the file input value to allow re-uploading the same file
    event.target.value = null;
}

function updateCSVControls() {
    const textareaContent = elements.dataTextarea.value;
    const separator = elements.separatorInput.value;
    
    // Check if any line contains the separator
    const hasCSVData = textareaContent.split('\n').some(line => 
        line.trim() && separator && line.includes(separator)
    );

    // Get the parent control groups for the checkboxes
    const topTextControlGroup = elements.topTextCheckbox.closest('.control-group');
    const bottomTextControlGroup = elements.bottomTextCheckbox.closest('.control-group');

    // Apply display logic only to the checkbox control groups
    if (topTextControlGroup) {
        topTextControlGroup.style.display = hasCSVData ? '' : 'none';
    }
    if (bottomTextControlGroup) {
        bottomTextControlGroup.style.display = hasCSVData ? '' : 'none';
    }

    // The separator input's control group is intentionally not modified here,
    // ensuring it remains always visible.
}

function updateGenerateButtonText() {
    const lineCount = elements.dataTextarea.value
        .split('\n')
        .filter(line => line.trim().length > 0)
        .length;

    if (lineCount > 0) {
        elements.generateBtn.textContent = `Generate QR Codes (${lineCount} files)`;
    } else {
        elements.generateBtn.textContent = 'Generate QR Codes';
    }
}

function validateFileName() {
    // Use the fileName input value and a safe regex (escape hyphen)
    if (!elements.fileNameInput) return;
    const fileName = elements.fileNameInput.value;
    const validPattern = /^[A-Za-z0-9_\-]+$/;

    if (fileName && !validPattern.test(fileName)) {
        elements.fileNameInput.setCustomValidity('File name can only contain letters, numbers, hyphens, and underscores');
    } else {
        elements.fileNameInput.setCustomValidity('');
    }
}

function parseData() {
    const textareaContent = elements.dataTextarea.value.trim();
    const separator = elements.separatorInput.value;
    
    if (!textareaContent) {
        return { validLines: [], invalidLines: [] };
    }

    const lines = textareaContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const validLines = [];
    const invalidLines = [];

    lines.forEach((line, index) => {
        if (line.includes(separator)) {
            // CSV format: top_text;URL;bottom_text
            const parts = line.split(separator).map(part => part.trim());
            if (parts.length === 3) {
                validLines.push({
                    topText: parts[0],
                    url: parts[1],
                    bottomText: parts[2],
                    originalLine: line,
                    lineNumber: index + 1
                });
            } else {
                invalidLines.push({
                    line: line,
                    lineNumber: index + 1,
                    reason: `Expected 3 parts separated by '${separator}', got ${parts.length}`
                });
            }
        } else {
            // Simple URL format
            validLines.push({
                topText: '',
                url: line,
                bottomText: '',
                originalLine: line,
                lineNumber: index + 1
            });
        }
    });

    return { validLines, invalidLines };
}

async function handleGenerate() {
    if (isGenerating) return;

    const { validLines, invalidLines } = parseData();
    
    if (validLines.length === 0) {
        showStatus('No valid data to process. Please enter URLs or CSV data.', 'error');
        return;
    }

    isGenerating = true;
    saveOriginalGenerateButtonText();
    lockUI();
    const startTime = performance.now();

    let lastDownloadId = null;
    const isZipEnabled = elements.zipCheckbox.checked;

    try {
        const timestamp = new Date();
        const customFileName = elements.fileNameInput.value || 'qr_code';
        const imageSize = parseInt(elements.imageSizeInput.value) || 512;
        const includeTopText = elements.topTextCheckbox.checked;
        const includeBottomText = elements.bottomTextCheckbox.checked;

        const timestampStr = formatTimestamp(timestamp);
        const baseName = `${timestampStr}_${customFileName}`;
        const subDir = `001_bulk_qr_codes/${baseName}`;

        const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));
        let successCount = 0;
        const errors = [];

        if (isZipEnabled) {
            // ZIP Archive Logic
            const zip = new JSZip();
            for (let i = 0; i < validLines.length; i++) {
                const lineData = validLines[i];
                const fileNumber = String(i + 1).padStart(padding, '0');
                const fileName = `${baseName}_${fileNumber}.png`;
                try {
                    const blob = await generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText);
                    zip.file(fileName, blob);
                    successCount++;
                    // update progress and yield briefly to allow UI update on large batches
                    if (i % 5 === 0) {
                        updateGenerateButtonProgress(successCount, validLines.length);
                        await nextTick();
                    }
                } catch (error) {
                    errors.push({ line: lineData.originalLine, lineNumber: lineData.lineNumber, reason: error.message });
                }
            }

            // Merge parsing invalidLines into errors array so they are included in the ZIP
            if (invalidLines.length > 0) {
                invalidLines.forEach(il => errors.push({ line: il.line || il, lineNumber: il.lineNumber || '?', reason: il.reason || 'Invalid format' }));
            }

            // If there are errors, add errors.txt into the ZIP so the archive contains diagnostic info
            if (errors.length > 0) {
                const errorContent = errors.map(err => `Line ${err.lineNumber}: ${err.line} - ${err.reason}`).join('\n');
                zip.file('errors.txt', errorContent);
            }

            // Download ZIP if there are any files or at least an errors.txt to provide feedback
            if (successCount > 0 || errors.length > 0) {
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(zipBlob);
                lastDownloadId = await new Promise((resolve, reject) => {
                    chrome.downloads.download({
                        url: zipUrl,
                        filename: `${subDir}.zip`,
                        saveAs: false
                    }, (id) => {
                        // Delay revoke to ensure Chrome had time to start the download
                        setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);
                        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                        else resolve(id);
                    });
                });
            }

        } else {
            // Individual File Logic
            for (let i = 0; i < validLines.length; i++) {
                const lineData = validLines[i];
                const fileNumber = String(i + 1).padStart(padding, '0');
                const fileName = `${baseName}_${fileNumber}.png`;
                try {
                    const blob = await generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText);
                    const url = URL.createObjectURL(blob);
                    lastDownloadId = await new Promise((resolve, reject) => {
                        chrome.downloads.download({
                            url: url,
                            filename: `${subDir}/${fileName}`,
                            saveAs: false
                        }, (id) => {
                            URL.revokeObjectURL(url);
                            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                            else resolve(id);
                        });
                    });
                    successCount++;
                    // update progress and yield occasionally
                    if (i % 5 === 0) {
                        updateGenerateButtonProgress(successCount, validLines.length);
                        await nextTick();
                    }
                } catch (error) {
                    errors.push({ line: lineData.originalLine, lineNumber: lineData.lineNumber, reason: error.message });
                }
            }
        }

        // Create error log if there are errors and ZIP is not used
        if (!isZipEnabled && (invalidLines.length > 0 || errors.length > 0)) {
            const allErrors = [...invalidLines, ...errors];
            await createErrorLog(allErrors, subDir);
        }

        // Show status message
        const endTime = performance.now();
        const duration = formatDuration(endTime - startTime);
        const message = `Generated ${successCount} QR codes in ${duration}.`;
        const errorCount = invalidLines.length + errors.length;
        
        let fullMessage = message;
        if (errorCount > 0) {
            fullMessage += ' There are some problems. See errors.txt for details.';
        }

        showStatus(fullMessage, errorCount > 0 ? 'error' : 'success', lastDownloadId);

    } catch (error) {
        console.error('Generation failed:', error);
        showStatus('Generation failed: ' + error.message, 'error');
    } finally {
        isGenerating = false;
        restoreGenerateButtonText();
        unlockUI();
    }
}

async function generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText) {
    const bgColor = rgbToHex(elements.bgColorBtn.style.backgroundColor) || DEFAULT_BG_COLOR;
    const fgColor = rgbToHex(elements.fgColorBtn.style.backgroundColor) || DEFAULT_FG_COLOR;

    return new Promise((resolve, reject) => {
        // Generate QR code with custom colors
        QRCode.toCanvas(lineData.url, {
            width: imageSize,
            color: {
                dark: fgColor,
                light: bgColor
            }
        }, (error, qrCanvas) => {
            if (error) {
                reject(new Error('QR code generation failed: ' + error.message));
                return;
            }

            try {
                let finalCanvas = qrCanvas;

                // Draw center label (Pax Cultura symbol)
                drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor);

                // Add text if requested and available
                if ((includeTopText && lineData.topText) || (includeBottomText && lineData.bottomText)) {
                    finalCanvas = createCompositeCanvas(qrCanvas, lineData, imageSize, includeTopText, includeBottomText, fgColor, bgColor);
                }

                // Convert to blob
                finalCanvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create image blob'));
                    } else {
                        resolve(blob);
                    }
                }, 'image/png');
            } catch (error) {
                reject(error);
            }
        });
    });
}

function createCompositeCanvas(qrCanvas, lineData, imageSize, includeTopText, includeBottomText, fgColor, bgColor) {
    const FONT_SIZE_RATIO = 0.08;
    const padding = Math.max(8, imageSize * 0.02);
    const fontSize = Math.max(12, Math.round(imageSize * FONT_SIZE_RATIO));
    const lineHeight = Math.round(fontSize * 1.3);

    // Calculate text dimensions
    const ctxMeasure = document.createElement('canvas').getContext('2d');
    ctxMeasure.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;

    let topTextHeight = 0;
    let bottomTextHeight = 0;

    if (includeTopText && lineData.topText) {
        const topLines = wrapTextToWidth(ctxMeasure, lineData.topText, imageSize - padding * 2);
        topTextHeight = padding + topLines.length * lineHeight + padding;
    }

    if (includeBottomText && lineData.bottomText) {
        const bottomLines = wrapTextToWidth(ctxMeasure, lineData.bottomText, imageSize - padding * 2);
        bottomTextHeight = padding + bottomLines.length * lineHeight + padding;
    }

    // Create composite canvas
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = imageSize;
    compositeCanvas.height = imageSize + topTextHeight + bottomTextHeight;
    const ctx = compositeCanvas.getContext('2d');

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    // Draw QR code
    ctx.drawImage(qrCanvas, 0, topTextHeight);

    // Draw top text
    if (includeTopText && lineData.topText) {
        ctx.fillStyle = fgColor;
        ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        
        const topLines = wrapTextToWidth(ctxMeasure, lineData.topText, imageSize - padding * 2);
        let y = padding;
        for (const line of topLines) {
            ctx.fillText(line, imageSize / 2, y);
            y += lineHeight;
        }
    }

    // Draw bottom text
    if (includeBottomText && lineData.bottomText) {
        ctx.fillStyle = fgColor;
        ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        
        const bottomLines = wrapTextToWidth(ctxMeasure, lineData.bottomText, imageSize - padding * 2);
        let y = imageSize + topTextHeight + padding;
        for (const line of bottomLines) {
            ctx.fillText(line, imageSize / 2, y);
            y += lineHeight;
        }
    }

    return compositeCanvas;
}

function wrapTextToWidth(ctx, text, maxWidth) {
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
        const nextLine = currentLine + text[i];
        const metrics = ctx.measureText(nextLine);
        
        if (metrics.width <= maxWidth || currentLine.length === 0) {
            currentLine = nextLine;
        } else {
            lines.push(currentLine);
            currentLine = text[i];
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

function drawCenterLabel(ctx, size, fgColor, bgColor) {
    if (!ENABLE_CENTER_LABEL) return;

    const r       = size * 0.10;
    const cx      = size / 2;
    const cy      = size / 2;
    const pad     = r * 0.15;
    const cornerR = r * 0.22;

    // Rounded background in bgColor
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(cx - r - pad, cy - r - pad, (r + pad) * 2, (r + pad) * 2, cornerR);
    ctx.fill();

    // Outer ring
    const sw = r * 0.13;
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.arc(cx, cy, r - sw / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Three dots: equilateral triangle, apex up
    const dotR    = r * 0.24;
    const dotDist = r * 0.47;
    ctx.fillStyle = fgColor;
    [[0, -1], [-0.866, 0.5], [0.866, 0.5]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx * dotDist, cy + dy * dotDist, dotR, 0, Math.PI * 2);
        ctx.fill();
    });
}

async function createErrorLog(errors, subDir) {
    const errorContent = errors.map(error => 
        `Line ${error.lineNumber}: ${error.line} - ${error.reason}`
    ).join('\n');

    const blob = new Blob([errorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: url,
            filename: `${subDir}/errors.txt`,
            saveAs: false
        }, (downloadId) => {
            URL.revokeObjectURL(url);
            if (chrome.runtime.lastError) {
                reject(new Error('Error log download failed: ' + chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

function formatTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}`;
}

function formatDuration(milliseconds) {
    if (milliseconds < 1000) {
        return `${Math.round(milliseconds)} ms`;
    }
    const seconds = milliseconds / 1000;
    return `${seconds.toFixed(2)} seconds`;
}

function lockUI() {
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = 'Generating...';
    
    // Disable all form controls
    const controls = [
        elements.separatorInput,
        elements.topTextCheckbox,
        elements.bottomTextCheckbox,
        elements.uploadCsvBtn,
        elements.dataTextarea,
        elements.imageSizeInput,
        elements.fileNameInput
    ];
    
    controls.forEach(control => {
        if (control) control.disabled = true;
    });
}

function unlockUI() {
    elements.generateBtn.disabled = false;
    updateGenerateButtonText();
    
    // Re-enable all form controls
    const controls = [
        elements.separatorInput,
        elements.topTextCheckbox,
        elements.bottomTextCheckbox,
        elements.uploadCsvBtn,
        elements.dataTextarea,
        elements.imageSizeInput,
        elements.fileNameInput
    ];
    
    controls.forEach(control => {
        if (control) control.disabled = false;
    });
    
    // Update CSV controls state
    updateCSVControls();
}

function showStatus(message, type = 'info', lastDownloadId = null) {
    // Clear previous content
    elements.statusArea.innerHTML = '';
    elements.statusArea.className = `status-area ${type}`;

    // Add the main message
    const messageNode = document.createElement('span');
    messageNode.textContent = message;
    elements.statusArea.appendChild(messageNode);

    if (lastDownloadId) {
        const linkNode = document.createElement('a');
        linkNode.href = '#';
        linkNode.textContent = 'Show last file';
        linkNode.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.downloads.show(lastDownloadId);
        });
        
        const actionNode = document.createElement('span');
        actionNode.style.marginLeft = '8px'; // Add some space
        actionNode.appendChild(linkNode);
        elements.statusArea.appendChild(actionNode);
    }
}

// Preview Panel Logic
function togglePreview() {
    const isExpanded = elements.previewPanel.classList.toggle('expanded');
    
    if (isExpanded) {
        elements.previewToggle.style.right = getPreviewPanelWidth();
        renderPreview();
    } else {
        elements.previewToggle.style.right = '0';
    }
    
    chrome.storage.local.set({ previewPanelExpanded: isExpanded });
}

function getPreviewPanelWidth() {
    const width = window.innerWidth;
    if (width <= 480) return '100%';
    if (width <= 768) return '250px';
    if (width <= 1024) return '280px';
    return '400px';
}

function restorePreviewPanelState() {
    chrome.storage.local.get(['previewPanelExpanded'], (result) => {
        if (result.previewPanelExpanded) {
            elements.previewPanel.classList.add('expanded');
            elements.previewToggle.style.right = getPreviewPanelWidth();
            renderPreview();
        }
    });
}

function saveTextareaContent() {
    const content = elements.dataTextarea.value;
    if (content) {
        chrome.storage.local.set({ textareaContent: content });
    }
}

function renderPreview() {
    const textareaContent = elements.dataTextarea.value.trim();
    const separator = elements.separatorInput.value;
    const includeTopText = elements.topTextCheckbox.checked;
    const includeBottomText = elements.bottomTextCheckbox.checked;
    const imageSize = parseInt(elements.imageSizeInput.value) || 512;

    if (!textareaContent) {
        showPreviewPlaceholder('Enter a URL or CSV data to see preview');
        return;
    }

    const firstLine = textareaContent.split('\n')[0].trim();
    if (!firstLine) {
        showPreviewPlaceholder('Enter a URL or CSV data to see preview');
        return;
    }

    let topText = '';
    let url = '';
    let bottomText = '';

    if (firstLine.includes(separator)) {
        const parts = firstLine.split(separator).map(part => part.trim());
        if (parts.length === 3) {
            topText = parts[0];
            url = parts[1];
            bottomText = parts[2];
        } else {
            showPreviewPlaceholder('Invalid CSV format. Expected: text;URL;text');
            return;
        }
    } else {
        url = firstLine;
    }

    if (!url) {
        showPreviewPlaceholder('No valid URL found');
        return;
    }

    generatePreviewQR(url, imageSize, topText, bottomText, includeTopText, includeBottomText);
}

function showPreviewPlaceholder(message) {
    elements.previewCanvas.style.display = 'none';
    elements.previewPlaceholder.style.display = 'block';
    elements.previewPlaceholder.textContent = message;
}

async function generatePreviewQR(url, imageSize, topText, bottomText, includeTopText, includeBottomText) {
    const bgColor = rgbToHex(elements.bgColorBtn.style.backgroundColor) || DEFAULT_BG_COLOR;
    const fgColor = rgbToHex(elements.fgColorBtn.style.backgroundColor) || DEFAULT_FG_COLOR;

    try {
        const canvas = elements.previewCanvas;
        const ctx = canvas.getContext('2d');

        const qrCanvas = await QRCode.toCanvas(url, {
            width: imageSize,
            color: {
                dark: fgColor,
                light: bgColor
            }
        });

        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;

        // Draw center label (Pax Cultura symbol)
        drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor);

        let finalCanvas = qrCanvas;

        if ((includeTopText && topText) || (includeBottomText && bottomText)) {
            finalCanvas = createCompositeCanvas(qrCanvas, { topText, bottomText }, imageSize, includeTopText, includeBottomText, fgColor, bgColor);
        }

        canvas.width = finalCanvas.width;
        canvas.height = finalCanvas.height;
        ctx.drawImage(finalCanvas, 0, 0);

        elements.previewCanvas.style.display = 'block';
        elements.previewPlaceholder.style.display = 'none';
    } catch (error) {
        showPreviewPlaceholder('Failed to generate preview');
    }
}

// Rating Banner Logic
const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/bulk-qr-code-generator/nkpcheohehognkoamimhhjpgclhhleap?hl=en";
const GOOGLE_FORM_URL = "https://forms.gle/43rRgL9snFnLXKFe8";

let lastRatingValue = 0; // Global variable to store the last selected rating

function setupRatingBanner() {
    const ratingStarsContainer = document.getElementById('rating-stars');
    if (!ratingStarsContainer) return;

    const stars = ratingStarsContainer.querySelectorAll('.star');

    // Load last rating from storage
    chrome.storage.local.get(['lastRatingValue'], (result) => {
        if (result.lastRatingValue) {
            lastRatingValue = result.lastRatingValue;
            applySelectedStars(lastRatingValue);
        }
    });

    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const value = parseInt(star.dataset.value);
            highlightStars(value);
        });

        star.addEventListener('mouseout', () => {
            resetStars();
        });

        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            lastRatingValue = value; // Update global state
            chrome.storage.local.set({ lastRatingValue: value }); // Save to storage
            applySelectedStars(value); // Apply selected state
            handleStarClick(value);
        });
    });
}

function highlightStars(value) {
    const stars = document.querySelectorAll('.rating-banner .star');
    stars.forEach(star => {
        if (parseInt(star.dataset.value) <= value) {
            star.classList.add('hover');
        } else {
            star.classList.remove('hover');
        }
    });
}

function resetStars() {
    const stars = document.querySelectorAll('.rating-banner .star');
    stars.forEach(star => {
        star.classList.remove('hover');
    });
    // If a rating was previously selected, re-apply it
    if (lastRatingValue > 0) {
        applySelectedStars(lastRatingValue);
    }
}

function applySelectedStars(value) {
    const stars = document.querySelectorAll('.rating-banner .star');
    stars.forEach(star => {
        if (parseInt(star.dataset.value) <= value) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
}

function handleStarClick(value) {
    if (value >= 4) {
        chrome.tabs.create({ url: CHROME_WEB_STORE_URL });
    } else {
        chrome.tabs.create({ url: GOOGLE_FORM_URL });
    }
}

// Color customization functions
let activePicker = null;

function initColorPickers() {
    drawColorPicker(elements.bgPickerCanvas);
    drawColorPicker(elements.fgPickerCanvas);

    elements.bgPickerCanvas.addEventListener('click', (e) => handlePickerClick('bg', e));
    elements.fgPickerCanvas.addEventListener('click', (e) => handlePickerClick('fg', e));
}

function drawColorPicker(canvas) {
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const hue = (x / size) * 360;
            const sat = 100;
            const light = 100 - (y / size) * 100;
            ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

function toggleColorPicker(type, event) {
    console.log('toggleColorPicker called:', type);
    event.stopPropagation();
    const panel = type === 'bg' ? elements.bgPickerPanel : elements.fgPickerPanel;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
    const hexInput = type === 'bg' ? elements.bgHexInput : elements.fgHexInput;

    console.log('panel:', panel, 'btn:', btn);

    hexInput.value = rgbToHex(btn.style.backgroundColor) || (type === 'bg' ? DEFAULT_BG_COLOR : DEFAULT_FG_COLOR);

    if (activePicker === type) {
        panel.style.display = 'none';
        activePicker = null;
    } else {
        if (elements.bgPickerPanel.style.display === 'block') elements.bgPickerPanel.style.display = 'none';
        if (elements.fgPickerPanel.style.display === 'block') elements.fgPickerPanel.style.display = 'none';

        // Calculate position
        const btnRect = btn.getBoundingClientRect();
        const panelHeight = 240;
        const panelWidth = 200;

        let top = btnRect.bottom + 4;
        let left = btnRect.left;

        if (btnRect.bottom + panelHeight > window.innerHeight) {
            top = btnRect.top - panelHeight - 4;
        }

        if (btnRect.left + panelWidth > window.innerWidth) {
            left = window.innerWidth - panelWidth - 10;
        }

        if (btnRect.left < 0) {
            left = 10;
        }

        console.log('Setting panel top:', top, 'left:', left);
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.display = 'block';
        activePicker = type;
    }
}

function handlePickerClick(type, event) {
    const canvas = type === 'bg' ? elements.bgPickerCanvas : elements.fgPickerCanvas;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
    const hexInput = type === 'bg' ? elements.bgHexInput : elements.fgHexInput;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hue = (x / canvas.width) * 360;
    const light = 100 - (y / canvas.height) * 100;
    const color = `hsl(${hue}, 100%, ${light}%)`;

    btn.style.backgroundColor = color;
    hexInput.value = hslToHex(hue, 100, light);
    saveColors();
    renderPreview();
}

function handleHexInput(type, event) {
    const hex = event.target.value;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;

    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        btn.style.backgroundColor = hex;
        saveColors();
        renderPreview();
    }
}

function handleColorPickerOutsideClick(e) {
    if (activePicker) {
        const panel = activePicker === 'bg' ? elements.bgPickerPanel : elements.fgPickerPanel;
        const btn = activePicker === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.style.display = 'none';
            activePicker = null;
        }
    }
}

function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return null;
    const r = parseInt(result[0]).toString(16).padStart(2, '0');
    const g = parseInt(result[1]).toString(16).padStart(2, '0');
    const b = parseInt(result[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function saveColors() {
    const bgColor = rgbToHex(elements.bgColorBtn.style.backgroundColor) || DEFAULT_BG_COLOR;
    const fgColor = rgbToHex(elements.fgColorBtn.style.backgroundColor) || DEFAULT_FG_COLOR;
    if (bgColor !== DEFAULT_BG_COLOR || fgColor !== DEFAULT_FG_COLOR) {
        chrome.storage.local.set({
            qrBackgroundColor: bgColor,
            qrForegroundColor: fgColor
        });
    }
}

function restoreColorSettings() {
    chrome.storage.local.get(['qrBackgroundColor', 'qrForegroundColor'], (result) => {
        if (result.qrBackgroundColor) {
            elements.bgColorBtn.style.backgroundColor = result.qrBackgroundColor;
            elements.bgHexInput.value = result.qrBackgroundColor;
        }
        if (result.qrForegroundColor) {
            elements.fgColorBtn.style.backgroundColor = result.qrForegroundColor;
            elements.fgHexInput.value = result.qrForegroundColor;
        }
    });
}

function resetColorsToDefault() {
    elements.bgColorBtn.style.backgroundColor = DEFAULT_BG_COLOR;
    elements.bgHexInput.value = DEFAULT_BG_COLOR;
    elements.fgColorBtn.style.backgroundColor = DEFAULT_FG_COLOR;
    elements.fgHexInput.value = DEFAULT_FG_COLOR;
    saveColors();
    renderPreview();
}

function restoreTextareaContent() {
    chrome.storage.local.get(['textareaContent'], (result) => {
        if (result.textareaContent) {
            elements.dataTextarea.value = result.textareaContent;
            updateCSVControls();
            updateGenerateButtonText();
            checkAndRenderPreview();
        }
    });
}

function checkAndRenderPreview() {
    chrome.storage.local.get(['previewPanelExpanded'], (result) => {
        if (result.previewPanelExpanded) {
            renderPreview();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    wireUpEventListeners();
    updateCSVControls();
    updateGenerateButtonText();
    setupRatingBanner();
    restorePreviewPanelState();
    restoreTextareaContent();
    restoreColorSettings();
});
