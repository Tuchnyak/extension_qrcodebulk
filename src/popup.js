import QRCode from 'qrcode';

document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            const url = tabs[0].url;
            const container = document.getElementById('qrcode-container');

            QRCode.toCanvas(url, { width: 280 }, (error, canvas) => {
                if (error) {
                    console.error(error);
                    return;
                }
                container.appendChild(canvas);
            });
        }
    });
});
