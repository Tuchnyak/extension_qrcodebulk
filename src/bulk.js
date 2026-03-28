import QRCode from 'qrcode';
import JSZip from 'jszip';

class WorkerPool {
    constructor(workerPath, poolSize) {
        this.workerPath = workerPath;
        this.poolSize = poolSize || navigator.hardwareConcurrency || 4;
        this.workers = [];
        this.taskQueue = [];
        this.activeWorkers = 0;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(this.workerPath);
            worker.onmessage = (event) => this.handleWorkerMessage(worker, event.data);
            worker.onerror = (error) => this.handleWorkerError(worker, error);
            this.workers.push({ worker, busy: false });
        }

        this.isInitialized = true;
    }

    handleWorkerMessage(worker, data) {
        const task = this.taskQueue.find(t => t.id === data.id);
        if (!task) return;

        if (data.success) {
            task.resolve(data.blob);
        } else {
            task.reject(new Error(data.error));
        }

        worker.busy = false;
        this.activeWorkers--;
        this.processNextTask();
    }

    handleWorkerError(worker, error) {
        console.error('Worker error:', error);
        const task = this.taskQueue.find(t => t.worker === worker);
        if (task) {
            task.reject(error);
            this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
            worker.busy = false;
            this.activeWorkers--;
        }
    }

    processNextTask() {
        if (this.taskQueue.length === 0) return;

        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker) return;

        const task = this.taskQueue.shift();
        if (!task) return;

        availableWorker.busy = true;
        this.activeWorkers++;
        task.worker = availableWorker.worker;

        availableWorker.worker.postMessage({
            id: task.id,
            url: task.url,
            width: task.width,
            topText: task.topText,
            bottomText: task.bottomText,
            includeTopText: task.includeTopText,
            includeBottomText: task.includeBottomText
        });
    }

    enqueue(taskData) {
        return new Promise((resolve, reject) => {
            const task = {
                id: Date.now() + Math.random(),
                url: taskData.url,
                width: taskData.width,
                topText: taskData.topText,
                bottomText: taskData.bottomText,
                includeTopText: taskData.includeTopText,
                includeBottomText: taskData.includeBottomText,
                resolve,
                reject,
                worker: null
            };

            this.taskQueue.push(task);
            this.processNextTask();
        });
    }

    terminate() {
        this.workers.forEach(w => w.worker.terminate());
        this.workers = [];
        this.taskQueue = [];
        this.isInitialized = false;
    }
}

// Global state
let isGenerating = false;

// DOM elements
let elements = {};
let originalGenerateBtnText = '';

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

// Add setupRatingBanner to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    wireUpEventListeners();
    updateCSVControls();
    updateGenerateButtonText();
    setupRatingBanner(); // Call the new function here
});
