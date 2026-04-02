// This script listens for the extension icon to be clicked.
chrome.action.onClicked.addListener((tab) => {
  // When the icon is clicked, open a new tab with the bulk.html page.
  chrome.tabs.create({
    url: 'dist/bulk.html'
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // Code to be executed on first install
    // eg. open a tab with a url
    chrome.tabs.create({
      url: "https://tuchnyak.github.io/extension_qrcodebulk/welcome.html",
    });
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    // When extension is updated
  } else if (
    details.reason === chrome.runtime.OnInstalledReason.CHROME_UPDATE
  ) {
    // When browser is updated
  } else if (
    details.reason === chrome.runtime.OnInstalledReason.SHARED_MODULE_UPDATE
  ) {
    // When a shared module is updated
  }
});

const UNINSTALL_URL = "https://tuchnyak.github.io/extension_qrcodebulk/uninstall.html";
chrome.runtime.setUninstallURL(UNINSTALL_URL);

