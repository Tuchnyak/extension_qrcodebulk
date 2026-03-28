import QRCode from 'qrcode';

self.onmessage = async function(event) {
    const { id, url, width, topText, bottomText, includeTopText, includeBottomText } = event.data;
    
    try {
        const dataUrl = await generateQRDataURL(url, width);
        const blob = await dataURLtoBlob(dataUrl);
        
        if ((includeTopText && topText) || (includeBottomText && bottomText)) {
            const finalBlob = await createCompositeImage(blob, topText, bottomText, width, includeTopText, includeBottomText);
            self.postMessage({ id, success: true, blob: finalBlob });
        } else {
            self.postMessage({ id, success: true, blob: blob });
        }
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

function generateQRDataURL(text, width) {
    return new Promise((resolve, reject) => {
        try {
            const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
            const size = qr.modules.size;
            const margin = 1;
            const scale = width / (size + margin * 2);
            const outputSize = Math.floor((size + margin * 2) * scale);
            
            const canvas = new OffscreenCanvas(outputSize, outputSize);
            const ctx = canvas.getContext('2d');
            
            const imageData = ctx.createImageData(outputSize, outputSize);
            const palette = [255, 255, 255, 255, 0, 0, 0, 255];
            
            for (let y = 0; y < outputSize; y++) {
                for (let x = 0; x < outputSize; x++) {
                    const srcX = Math.floor((x / scale) - margin);
                    const srcY = Math.floor((y / scale) - margin);
                    
                    let colorIndex = 0;
                    if (srcX >= 0 && srcX < size && srcY >= 0 && srcY < size) {
                        colorIndex = qr.modules.data[srcY * size + srcX] ? 1 : 0;
                    } else {
                        colorIndex = 0;
                    }
                    
                    const pixelIndex = (y * outputSize + x) * 4;
                    imageData.data[pixelIndex] = palette[colorIndex * 4];
                    imageData.data[pixelIndex + 1] = palette[colorIndex * 4 + 1];
                    imageData.data[pixelIndex + 2] = palette[colorIndex * 4 + 2];
                    imageData.data[pixelIndex + 3] = palette[colorIndex * 4 + 3];
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                blob.arrayBuffer().then(buffer => {
                    const base64 = arrayBufferToBase64(buffer);
                    resolve('data:image/png;base64,' + base64);
                });
            });
        } catch (error) {
            reject(error);
        }
    });
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function dataURLtoBlob(dataUrl) {
    return new Promise((resolve, reject) => {
        try {
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            resolve(new Blob([u8arr], { type: mime }));
        } catch (error) {
            reject(error);
        }
    });
}

async function createCompositeImage(qrBlob, topText, bottomText, imageSize, includeTopText, includeBottomText) {
    const FONT_SIZE_RATIO = 0.08;
    const padding = Math.max(8, imageSize * 0.02);
    const fontSize = Math.max(12, Math.round(imageSize * FONT_SIZE_RATIO));
    const lineHeight = Math.round(fontSize * 1.3);

    const ctxMeasure = new OffscreenCanvas(1, 1).getContext('2d');
    ctxMeasure.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;

    let topTextHeight = 0;
    let bottomTextHeight = 0;

    if (includeTopText && topText) {
        const topLines = wrapTextToWidth(ctxMeasure, topText, imageSize - padding * 2);
        topTextHeight = padding + topLines.length * lineHeight + padding;
    }

    if (includeBottomText && bottomText) {
        const bottomLines = wrapTextToWidth(ctxMeasure, bottomText, imageSize - padding * 2);
        bottomTextHeight = padding + bottomLines.length * lineHeight + padding;
    }

    const qrBitmap = await createImageBitmap(qrBlob);
    const compositeCanvas = new OffscreenCanvas(imageSize, imageSize + topTextHeight + bottomTextHeight);
    const ctx = compositeCanvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
    ctx.drawImage(qrBitmap, 0, topTextHeight);

    if (includeTopText && topText) {
        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';

        const topLines = wrapTextToWidth(ctxMeasure, topText, imageSize - padding * 2);
        let y = padding;
        for (const line of topLines) {
            ctx.fillText(line, imageSize / 2, y);
            y += lineHeight;
        }
    }

    if (includeBottomText && bottomText) {
        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';

        const bottomLines = wrapTextToWidth(ctxMeasure, bottomText, imageSize - padding * 2);
        let y = imageSize + topTextHeight + padding;
        for (const line of bottomLines) {
            ctx.fillText(line, imageSize / 2, y);
            y += lineHeight;
        }
    }

    return compositeCanvas.convertToBlob({ type: 'image/png' });
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
