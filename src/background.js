// This script listens for the extension icon to be clicked.
chrome.action.onClicked.addListener((tab) => {
  // When the icon is clicked, open a new tab with the bulk.html page.
  chrome.tabs.create({
    url: 'dist/bulk.html'
  });
});
