import QRCode from 'qrcode';

self.onmessage = async function(event) {
    const { id, url, width, topText, bottomText, includeTopText, includeBottomText } = event.data;

    try {
        const blob = await generateQRCodeBlob(url, width, topText, bottomText, includeTopText, includeBottomText);
        self.postMessage({ id, success: true, blob });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

async function generateQRCodeBlob(url, width, topText, bottomText, includeTopText, includeBottomText) {
    return new Promise((resolve, reject) => {
        QRCode.toCanvas(url, { width }, (error, qrCanvas) => {
            if (error) {
                reject(new Error('QR code generation failed: ' + error.message));
                return;
            }

            try {
                let finalCanvas = qrCanvas;

                if ((includeTopText && topText) || (includeBottomText && bottomText)) {
                    finalCanvas = createCompositeCanvas(qrCanvas, topText, bottomText, width, includeTopText, includeBottomText);
                }

                finalCanvas.convertToBlob((blob) => {
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

function createCompositeCanvas(qrCanvas, topText, bottomText, imageSize, includeTopText, includeBottomText) {
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

    const compositeCanvas = new OffscreenCanvas(imageSize, imageSize + topTextHeight + bottomTextHeight);
    const ctx = compositeCanvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    ctx.drawImage(qrCanvas, 0, topTextHeight);

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
