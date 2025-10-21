import QRCode from 'qrcode';

// Global state
let isGenerating = false;

// DOM elements
let elements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    wireUpEventListeners();
    updateCSVControls();
    updateGenerateButtonText();
});

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
        statusArea: document.getElementById('status-area')
    };
}

function wireUpEventListeners() {
    // CSV file upload
    elements.uploadCsvBtn.addEventListener('click', () => {
        elements.csvFileInput.click();
    });

    elements.csvFileInput.addEventListener('change', handleFileUpload);

    // Textarea changes - update CSV controls
    elements.dataTextarea.addEventListener('input', () => {
        updateCSVControls();
        updateGenerateButtonText();
    });

    // Separator changes - update CSV controls
    elements.separatorInput.addEventListener('input', updateCSVControls);

    // Generate button
    elements.generateBtn.addEventListener('click', handleGenerate);

    // File name validation
    elements.fileNameInput.addEventListener('input', validateFileName);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        elements.dataTextarea.value = e.target.result;
        updateCSVControls();
        updateGenerateButtonText();
    };
    reader.readAsText(file);
}

function updateCSVControls() {
    const textareaContent = elements.dataTextarea.value;
    const separator = elements.separatorInput.value;
    
    // Check if any line contains the separator
    const hasCSVData = textareaContent.split('\n').some(line => 
        line.trim() && line.includes(separator)
    );

    // Enable/disable checkboxes based on CSV data presence
    elements.topTextCheckbox.disabled = !hasCSVData;
    elements.bottomTextCheckbox.disabled = !hasCSVData;

    // Uncheck if disabled
    if (!hasCSVData) {
        elements.topTextCheckbox.checked = false;
        elements.bottomTextCheckbox.checked = false;
    }
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
    const fileName = elements.fileName-input.value;
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    
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
            const parts = line.split(separator);
            if (parts.length === 3) {
                validLines.push({
                    topText: parts[0].trim(),
                    url: parts[1].trim(),
                    bottomText: parts[2].trim(),
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
    lockUI();

    try {
        const timestamp = new Date();
        const customFileName = elements.fileNameInput.value || 'qr_code';
        const imageSize = parseInt(elements.imageSizeInput.value) || 512;
        const includeTopText = elements.topTextCheckbox.checked;
        const includeBottomText = elements.bottomTextCheckbox.checked;

        // Create directory structure
        const baseDir = '001_bulk_qr_codes';
        const timestampStr = formatTimestamp(timestamp);
        const subDir = `${baseDir}/${timestampStr}_${customFileName}`;

        // Calculate padding for file numbers
        const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));

        let successCount = 0;
        const errors = [];

        // Process each valid line
        for (let i = 0; i < validLines.length; i++) {
            const lineData = validLines[i];
            const fileNumber = String(i + 1).padStart(padding, '0');
            const fileName = `${timestampStr}_${customFileName}_${fileNumber}.png`;

            try {
                await generateAndDownloadQRCode(
                    lineData,
                    imageSize,
                    includeTopText,
                    includeBottomText,
                    `${subDir}/${fileName}`
                );
                successCount++;
            } catch (error) {
                errors.push({
                    line: lineData.originalLine,
                    lineNumber: lineData.lineNumber,
                    reason: error.message
                });
            }
        }

        // Create error log if there are errors
        if (invalidLines.length > 0 || errors.length > 0) {
            const allErrors = [...invalidLines, ...errors];
            await createErrorLog(allErrors, subDir);
        }

        // Show status message
        const message = `Generated ${successCount} QR codes successfully.`;
        const errorCount = invalidLines.length + errors.length;
        const fullMessage = errorCount > 0 
            ? `${message} ${errorCount} lines had errors. See errors.log for details.`
            : message;
        
        showStatus(fullMessage, errorCount > 0 ? 'error' : 'success');

    } catch (error) {
        console.error('Generation failed:', error);
        showStatus('Generation failed: ' + error.message, 'error');
    } finally {
        isGenerating = false;
        unlockUI();
    }
}

async function generateAndDownloadQRCode(lineData, imageSize, includeTopText, includeBottomText, filePath) {
    return new Promise((resolve, reject) => {
        // Generate QR code
        QRCode.toCanvas(lineData.url, { width: imageSize }, (error, qrCanvas) => {
            if (error) {
                reject(new Error('QR code generation failed: ' + error.message));
                return;
            }

            try {
                let finalCanvas = qrCanvas;

                // Add text if requested and available
                if ((includeTopText && lineData.topText) || (includeBottomText && lineData.bottomText)) {
                    finalCanvas = createCompositeCanvas(qrCanvas, lineData, imageSize, includeTopText, includeBottomText);
                }

                // Convert to blob and download
                finalCanvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create image blob'));
                        return;
                    }

                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: url,
                        filename: filePath,
                        saveAs: false
                    }, (downloadId) => {
                        URL.revokeObjectURL(url);
                        if (chrome.runtime.lastError) {
                            reject(new Error('Download failed: ' + chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                }, 'image/png');
            } catch (error) {
                reject(error);
            }
        });
    });
}

function createCompositeCanvas(qrCanvas, lineData, imageSize, includeTopText, includeBottomText) {
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    // Draw QR code
    ctx.drawImage(qrCanvas, 0, topTextHeight);

    // Draw top text
    if (includeTopText && lineData.topText) {
        ctx.fillStyle = '#000000';
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
    ctx.fillStyle = '#000000';
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

async function createErrorLog(errors, subDir) {
    const errorContent = errors.map(error => 
        `Line ${error.lineNumber}: ${error.line} - ${error.reason}`
    ).join('\n');

    const blob = new Blob([errorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: url,
            filename: `${subDir}/errors.log`,
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

function showStatus(message, type = 'info') {
    elements.statusArea.textContent = message;
    elements.statusArea.className = `status-area ${type}`;
}
