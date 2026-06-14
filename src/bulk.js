import QRCode from 'qrcode';
import JSZip from 'jszip';

// Global state
let isGenerating = false;

// Column mapping state
let columnMapping = { qrContent: null, title: null, footer: null };
let lastKnownColumnCount = null;
let pendingFileUpload = false;
let templateDebounceTimer = null;

// DOM elements
let elements = {};
let originalGenerateBtnText = '';

// Color defaults
const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_FG_COLOR = '#000000';

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

function parseCSVLine(line, separator) {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"' && current.trim() === '') {
                inQuotes = true;
                current = '';
            } else if (ch === separator) {
                parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    parts.push(current.trim());
    return parts;
}

function applyMapping(parsedLine, mapping) {
    const cols = parsedLine.columns;
    return {
        url:        mapping.qrContent !== null ? (cols[mapping.qrContent] || '') : '',
        topText:    mapping.title     !== null ? (cols[mapping.title]     || '') : '',
        bottomText: mapping.footer    !== null ? (cols[mapping.footer]    || '') : ''
    };
}

function applyAutoDefaults(colCount) {
    columnMapping = colCount >= 3
        ? { qrContent: 1, title: 0, footer: 2 }
        : { qrContent: 0, title: null, footer: null };
}

function resolveTemplate(template, parsedLine, headers, count, padding, batchDate) {
    const cols = parsedLine.columns;
    const year  = String(batchDate.getFullYear());
    const month = String(batchDate.getMonth() + 1).padStart(2, '0');
    const day   = String(batchDate.getDate()).padStart(2, '0');

    let result = template.replace(/\{([^}]+)\}/g, (match, token) => {
        if (token === 'count') {
            return String(count).padStart(padding, '0');
        }
        if (token === 'date') {
            return `${year}${month}${day}`;
        }
        if (token.startsWith('date:')) {
            const fmt = token.slice(5);
            return fmt.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day);
        }
        if (token.startsWith('col-')) {
            const colPart = token.slice(4);
            if (/^\d+$/.test(colPart)) {
                // numeric 1-based index; return '' for empty cols, match for out-of-range
                const idx = parseInt(colPart, 10) - 1;
                return cols[idx] !== undefined ? cols[idx] : match;
            }
            // header name lookup; col-Name with headers off → leave as-is
            if (!headers) return match;
            const hi = headers.indexOf(colPart);
            return hi !== -1 && cols[hi] !== undefined ? cols[hi] : match;
        }
        return match; // unknown token → leave as-is
    });

    // Sanitize forbidden filename characters
    result = result.replace(/[/\\:*?"<>|]/g, '_');

    // Fallback to zero-padded count if result is empty
    if (!result.trim()) {
        result = String(count).padStart(padding, '0');
    }

    return result;
}

function getUniqueFileName(name, usedNames) {
    if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
    }
    let n = 2;
    while (usedNames.has(`${name}_${n}`)) n++;
    const unique = `${name}_${n}`;
    usedNames.add(unique);
    return unique;
}

function updateTemplatePreview() {
    const template = elements.filenameTemplateInput.value.trim();
    if (!template) {
        elements.filenameTemplatePreview.textContent = '';
        return;
    }
    const { parsedLines, headers } = parseData();
    const previewPadding = parsedLines.length > 0
        ? Math.max(2, Math.ceil(Math.log10(parsedLines.length + 1)))
        : 2;
    const batchDate = new Date();
    let preview;
    if (parsedLines.length > 0) {
        preview = resolveTemplate(template, parsedLines[0], headers, 1, previewPadding, batchDate);
    } else {
        preview = resolveTemplate(template, { columns: [] }, null, 1, previewPadding, batchDate);
    }
    elements.filenameTemplatePreview.textContent = `Preview: ${preview}`;
}

function saveFilenameTemplate() {
    chrome.storage.local.set({ filenameTemplate: elements.filenameTemplateInput.value });
}

function parseHeadersFromTextarea() {
    const separator = elements.separatorInput.value;
    const firstLine = elements.dataTextarea.value.split('\n').find(l => l.trim());
    if (!firstLine || !firstLine.includes(separator)) return null;
    return parseCSVLine(firstLine, separator);
}

function buildMappingSelects(colCount, headers) {
    const roles = [
        { el: elements.mappingQrContent, key: 'qrContent' },
        { el: elements.mappingTitle,     key: 'title' },
        { el: elements.mappingFooter,    key: 'footer' }
    ];

    roles.forEach(({ el, key }) => {
        el.innerHTML = '';

        const notSet = document.createElement('option');
        notSet.value = '';
        notSet.textContent = '— not set —';
        el.appendChild(notSet);

        for (let i = 0; i < colCount; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = (headers && headers[i]) ? headers[i] : `Column ${i + 1}`;
            el.appendChild(opt);
        }

        const current = columnMapping[key];
        el.value = current !== null ? String(current) : '';
    });
}

function initializeElements() {
    elements = {
        separatorInput: document.getElementById('separator-input'),
        hasHeaderCheckbox: document.getElementById('has-header-checkbox'),
        mappingSection: document.getElementById('mapping-section'),
        mappingQrContent: document.getElementById('mapping-qr-content'),
        mappingTitle: document.getElementById('mapping-title'),
        mappingFooter: document.getElementById('mapping-footer'),
        mappingHint: document.getElementById('mapping-hint'),
        uploadCsvBtn: document.getElementById('upload-csv-btn'),
        csvFileInput: document.getElementById('csv-file-input'),
        dataTextarea: document.getElementById('data-textarea'),
        generateBtn: document.getElementById('generate-btn'),
        imageSizeInput: document.getElementById('image-size-input'),
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
        resetColorsBtn: document.getElementById('reset-colors-btn'),
        versionLabel: document.getElementById('version-label'),
        feedbackLink: document.getElementById('feedback-link'),
        filenameTemplateInput: document.getElementById('filename-template-input'),
        filenameTemplatePreview: document.getElementById('filename-template-preview'),
        centerLabelCheckbox: document.getElementById('center-label-checkbox'),
        outputFormatSelect: document.getElementById('output-format-select'),
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
        updateGenerateBtn();
        renderPreview();
        saveTextareaContent();
    });

    // Separator changes - update CSV controls and preview
    elements.separatorInput.addEventListener('input', () => {
        chrome.storage.local.set({ separator: elements.separatorInput.value });
        updateCSVControls();
        renderPreview();
    });

    // Has-header checkbox — rebuild mapping and preview
    elements.hasHeaderCheckbox.addEventListener('change', () => {
        saveHasHeaderRow();
        updateCSVControls();
        updateGenerateButtonText();
        renderPreview();
    });

    // Mapping selects
    [elements.mappingQrContent, elements.mappingTitle, elements.mappingFooter].forEach(sel => {
        sel.addEventListener('change', () => {
            readMappingFromSelects();
            saveColumnMapping();
            updateGenerateBtn();
            renderPreview();
        });
    });

    // Preview toggle
    elements.previewToggle.addEventListener('click', togglePreview);

    // Image size - update preview
    elements.imageSizeInput.addEventListener('change', renderPreview);

    // Generate button
    elements.generateBtn.addEventListener('click', handleGenerate);

    elements.filenameTemplateInput.addEventListener('input', () => {
        saveFilenameTemplate();
        clearTimeout(templateDebounceTimer);
        templateDebounceTimer = setTimeout(updateTemplatePreview, 300);
    });

    elements.centerLabelCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ showCenterLabel: elements.centerLabelCheckbox.checked });
        renderPreview();
    });

    elements.outputFormatSelect.addEventListener('change', () => {
        chrome.storage.local.set({ outputFormat: elements.outputFormatSelect.value });
    });

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

    pendingFileUpload = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.dataTextarea.value = e.target.result.replace(/^﻿/, '');
        updateCSVControls();
        updateGenerateButtonText();
        saveTextareaContent();
    };
    reader.readAsText(file);

    // Reset the file input value to allow re-uploading the same file
    event.target.value = null;
}

function updateCSVControls() {
    const separator = elements.separatorInput.value;
    const textareaContent = elements.dataTextarea.value;
    const hasHeader = elements.hasHeaderCheckbox ? elements.hasHeaderCheckbox.checked : false;

    // Detect whether any data line (after optional header) contains the separator
    const allLines = textareaContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const dataLines = hasHeader && allLines.length > 0 ? allLines.slice(1) : allLines;
    const hasCSVData = dataLines.some(line => separator && line.includes(separator));

    if (!hasCSVData) {
        elements.mappingSection.style.display = 'none';
        lastKnownColumnCount = null;
        updateGenerateBtn();
        return;
    }

    // Find max column count across all data lines
    let maxCols = 1;
    dataLines.forEach(line => {
        if (line.includes(separator)) {
            const count = parseCSVLine(line, separator).length;
            if (count > maxCols) maxCols = count;
        }
    });

    const isFileUpload = pendingFileUpload;
    const isFirstLoad = lastKnownColumnCount === null;
    pendingFileUpload = false;
    lastKnownColumnCount = maxCols;

    // Apply auto-defaults only when no mapping has been set yet
    if (columnMapping.qrContent === null) {
        applyAutoDefaults(maxCols);
    }

    // Build selects using header names if available
    const headers = hasHeader ? parseHeadersFromTextarea() : null;
    buildMappingSelects(maxCols, headers);
    // Sync in-memory mapping from select values — handles out-of-range indices after column count changes
    readMappingFromSelects();
    elements.mappingSection.style.display = '';
    updateGenerateBtn();
}

function updateGenerateButtonText() {
    const { parsedLines } = parseData();
    if (parsedLines.length > 0) {
        elements.generateBtn.textContent = `Generate QR Codes (${parsedLines.length} files)`;
    } else {
        elements.generateBtn.textContent = 'Generate QR Codes';
    }
}


function parseData() {
    const textareaContent = elements.dataTextarea.value.trim();
    const separator = elements.separatorInput.value;
    const hasHeader = elements.hasHeaderCheckbox ? elements.hasHeaderCheckbox.checked : false;

    if (!textareaContent) return { parsedLines: [], headers: null };

    const rawLines = textareaContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (rawLines.length === 0) return { parsedLines: [], headers: null };

    let headers = null;
    let dataLines = rawLines;
    if (hasHeader && rawLines.length > 0) {
        headers = parseCSVLine(rawLines[0], separator);
        dataLines = rawLines.slice(1);
    }

    // Split into columns, track max column count for padding
    let maxCols = 1;
    const split = dataLines.map((line, idx) => {
        const parts = separator && line.includes(separator)
            ? parseCSVLine(line, separator)
            : [line.trim()];
        if (parts.length > maxCols) maxCols = parts.length;
        return { parts, line, idx };
    });

    const parsedLines = split.map(({ parts, line, idx }) => ({
        columns: parts.concat(Array(Math.max(0, maxCols - parts.length)).fill('')),
        originalLine: line,
        lineNumber: (hasHeader ? 2 : 1) + idx
    }));

    return { parsedLines, headers };
}

async function handleGenerate() {
    if (isGenerating) return;

    const { parsedLines, headers } = parseData();

    // When mapping UI is visible and QR content role is not assigned, block generation.
    // When mapping UI is hidden (plain URL mode), fall back to col-0 silently.
    const mappingActive = elements.mappingSection.style.display !== 'none';
    if (mappingActive && columnMapping.qrContent === null) {
        showStatus('Select a column for QR content to generate.', 'error');
        return;
    }
    const effectiveMapping = mappingActive
        ? columnMapping
        : { qrContent: 0, title: null, footer: null };

    const mappedLines = parsedLines.map(pl => ({
        ...applyMapping(pl, effectiveMapping),
        originalLine: pl.originalLine,
        lineNumber: pl.lineNumber,
        parsedLine: pl
    }));
    const validLines = mappedLines.filter(l => l.url.trim() !== '');
    const invalidLines = mappedLines
        .filter(l => l.url.trim() === '')
        .map(l => ({ line: l.originalLine, lineNumber: l.lineNumber, reason: 'QR content column is empty' }));

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
        const imageSize = parseInt(elements.imageSizeInput.value) || 512;

        const timestampStr = formatTimestamp(timestamp);
        const baseName = timestampStr;
        const subDir = `001_bulk_qr_codes/${baseName}`;

        const padding = Math.max(2, Math.ceil(Math.log10(validLines.length + 1)));
        const mappingVisible = elements.mappingSection.style.display !== 'none';
        const template = mappingVisible ? elements.filenameTemplateInput.value.trim() : '';
        const usedFileNames = new Set();
        let successCount = 0;
        const errors = [];

        if (isZipEnabled) {
            // ZIP Archive Logic
            const zip = new JSZip();
            for (let i = 0; i < validLines.length; i++) {
                const lineData = validLines[i];
                const fileNumber = String(i + 1).padStart(padding, '0');
                const rawName = template
                    ? resolveTemplate(template, lineData.parsedLine, headers, i + 1, padding, timestamp)
                    : `${baseName}_${fileNumber}`;
                const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
                try {
                    const blob = await generateQRCodeBlob(lineData, imageSize, true, true);
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
                const rawName = template
                    ? resolveTemplate(template, lineData.parsedLine, headers, i + 1, padding, timestamp)
                    : `${baseName}_${fileNumber}`;
                const fileName = getUniqueFileName(rawName, usedFileNames) + '.png';
                try {
                    const blob = await generateQRCodeBlob(lineData, imageSize, true, true);
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

async function generateQRCodeBlob(lineData, imageSize, includeTopText, includeBottomText, showCenterLabel) {
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
                drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor, showCenterLabel);

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

function wrapTextToSVGWidth(text, maxWidth, fontSize, viewBox) {
    const ns = 'http://www.w3.org/2000/svg';
    const testSvg = document.createElementNS(ns, 'svg');
    testSvg.setAttribute('viewBox', viewBox);
    testSvg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:1px;height:1px';
    document.body.appendChild(testSvg);

    const testText = document.createElementNS(ns, 'text');
    testText.setAttribute('font-size', fontSize);
    testText.setAttribute('font-family', 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
    testSvg.appendChild(testText);

    const lines = [];
    let currentLine = '';

    for (const ch of text) {
        const next = currentLine + ch;
        testText.textContent = next;
        if (testText.getComputedTextLength() <= maxWidth || currentLine.length === 0) {
            currentLine = next;
        } else {
            lines.push(currentLine);
            currentLine = ch;
        }
    }
    if (currentLine) lines.push(currentLine);

    document.body.removeChild(testSvg);
    return lines;
}

function drawCenterLabel(ctx, size, fgColor, bgColor, showCenterLabel) {
    if (!showCenterLabel) return;

    const r       = size * 0.07; // 14% diameter — safe under QR EC level M (15% area tolerance)
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

function addCenterLabelToSVG(container, size, fgColor, bgColor) {
    const doc = container.ownerDocument;
    const ns = 'http://www.w3.org/2000/svg';
    const r = size * 0.07;
    const cx = size / 2;
    const cy = size / 2;
    const pad = r * 0.15;
    const cornerR = r * 0.22;
    const sw = r * 0.13;
    const dotR = r * 0.24;
    const dotDist = r * 0.47;

    const bg = doc.createElementNS(ns, 'rect');
    bg.setAttribute('x', cx - r - pad);
    bg.setAttribute('y', cy - r - pad);
    bg.setAttribute('width', (r + pad) * 2);
    bg.setAttribute('height', (r + pad) * 2);
    bg.setAttribute('rx', cornerR);
    bg.setAttribute('ry', cornerR);
    bg.setAttribute('fill', bgColor);
    container.appendChild(bg);

    const ring = doc.createElementNS(ns, 'circle');
    ring.setAttribute('cx', cx);
    ring.setAttribute('cy', cy);
    ring.setAttribute('r', r - sw / 2);
    ring.setAttribute('stroke', fgColor);
    ring.setAttribute('stroke-width', sw);
    ring.setAttribute('fill', 'none');
    container.appendChild(ring);

    [[0, -1], [-0.866, 0.5], [0.866, 0.5]].forEach(([dx, dy]) => {
        const dot = doc.createElementNS(ns, 'circle');
        dot.setAttribute('cx', cx + dx * dotDist);
        dot.setAttribute('cy', cy + dy * dotDist);
        dot.setAttribute('r', dotR);
        dot.setAttribute('fill', fgColor);
        container.appendChild(dot);
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
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
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
        elements.uploadCsvBtn,
        elements.dataTextarea,
        elements.imageSizeInput,
        elements.hasHeaderCheckbox,
        elements.mappingQrContent,
        elements.mappingTitle,
        elements.mappingFooter,
        elements.filenameTemplateInput,
        elements.centerLabelCheckbox,
        elements.outputFormatSelect,
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
        elements.uploadCsvBtn,
        elements.dataTextarea,
        elements.imageSizeInput,
        elements.hasHeaderCheckbox,
        elements.mappingQrContent,
        elements.mappingTitle,
        elements.mappingFooter,
        elements.filenameTemplateInput,
        elements.centerLabelCheckbox,
        elements.outputFormatSelect,
    ];

    controls.forEach(control => {
        if (control) control.disabled = false;
    });
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

function saveHasHeaderRow() {
    chrome.storage.local.set({ hasHeaderRow: elements.hasHeaderCheckbox.checked });
}

function restoreSeparator() {
    chrome.storage.local.get(['separator'], (result) => {
        if (result.separator !== undefined) {
            elements.separatorInput.value = result.separator;
            updateCSVControls();
        }
    });
}

function readMappingFromSelects() {
    function parseVal(el) {
        return el.value === '' ? null : parseInt(el.value, 10);
    }
    columnMapping = {
        qrContent: parseVal(elements.mappingQrContent),
        title:     parseVal(elements.mappingTitle),
        footer:    parseVal(elements.mappingFooter)
    };
}

function saveColumnMapping() {
    chrome.storage.local.set({ columnMapping });
}

function updateGenerateBtn() {
    const { parsedLines } = parseData();
    const csvVisible = elements.mappingSection.style.display !== 'none';
    const needsMapping = csvVisible && parsedLines.length > 0;
    const missingQR = needsMapping && columnMapping.qrContent === null;

    elements.generateBtn.disabled = missingQR;
    elements.mappingHint.style.display = missingQR ? '' : 'none';
}

function renderPreview() {
    const imageSize = parseInt(elements.imageSizeInput.value) || 512;
    const { parsedLines } = parseData();

    if (parsedLines.length === 0) {
        showPreviewPlaceholder('Enter a URL or CSV data to see preview');
        return;
    }

    // Same effectiveMapping logic as handleGenerate: plain URL mode falls back to col-0
    const mappingActive = elements.mappingSection.style.display !== 'none';
    const effectiveMapping = mappingActive
        ? columnMapping
        : { qrContent: 0, title: null, footer: null };

    const lineData = applyMapping(parsedLines[0], effectiveMapping);

    if (!lineData.url) {
        showPreviewPlaceholder('No valid URL — check column mapping for QR content');
        return;
    }

    generatePreviewQR(lineData.url, imageSize, lineData.topText, lineData.bottomText, true, true);
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
        drawCenterLabel(qrCanvas.getContext('2d'), imageSize, fgColor, bgColor, elements.centerLabelCheckbox.checked);

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

    const feedbackLink = document.getElementById('feedback-link');
    if (feedbackLink) {
        feedbackLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: GOOGLE_FORM_URL });
        });
    }

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
    event.stopPropagation();
    const panel = type === 'bg' ? elements.bgPickerPanel : elements.fgPickerPanel;
    const btn = type === 'bg' ? elements.bgColorBtn : elements.fgColorBtn;
    const hexInput = type === 'bg' ? elements.bgHexInput : elements.fgHexInput;

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

function restoreOutputFormat() {
    chrome.storage.local.get(['outputFormat'], (result) => {
        if (result.outputFormat) {
            elements.outputFormatSelect.value = result.outputFormat;
        }
    });
}

function restoreShowCenterLabel() {
    chrome.storage.local.get(['showCenterLabel'], (result) => {
        if (result.showCenterLabel !== undefined) {
            elements.centerLabelCheckbox.checked = result.showCenterLabel;
        }
        renderPreview();
    });
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
        restoreColumnMapping();
    });
}

function restoreColumnMapping() {
    chrome.storage.local.get(['hasHeaderRow', 'columnMapping'], (result) => {
        // Restore has-header checkbox
        if (result.hasHeaderRow) {
            elements.hasHeaderCheckbox.checked = true;
        }

        // Get current column count from already-restored textarea content
        const { parsedLines } = parseData();
        const currentColCount = parsedLines.length > 0 ? parsedLines[0].columns.length : 0;

        if (result.columnMapping && currentColCount > 0) {
            const saved = result.columnMapping;
            // Validate all non-null indices are in range
            const indices = [saved.qrContent, saved.title, saved.footer].filter(v => v !== null);
            const isValid = indices.every(v => v < currentColCount);

            if (isValid) {
                columnMapping = saved;
                lastKnownColumnCount = currentColCount;
                // Rebuild selects to reflect restored mapping
                const headers = elements.hasHeaderCheckbox.checked ? parseHeadersFromTextarea() : null;
                buildMappingSelects(currentColCount, headers);
                elements.mappingSection.style.display = '';
            }
        }

        updateGenerateBtn();
    });
}

function restoreFilenameTemplate() {
    chrome.storage.local.get(['filenameTemplate'], (result) => {
        if (result.filenameTemplate !== undefined) {
            elements.filenameTemplateInput.value = result.filenameTemplate;
        }
        updateTemplatePreview();
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
    elements.versionLabel.textContent = 'v' + chrome.runtime.getManifest().version;
    wireUpEventListeners();
    updateCSVControls();
    updateGenerateButtonText();
    setupRatingBanner();
    restorePreviewPanelState();
    restoreSeparator();
    restoreTextareaContent();    // calls restoreColumnMapping() in its callback
    restoreFilenameTemplate();
    restoreColorSettings();
    restoreShowCenterLabel();
    restoreOutputFormat();
});
