(() => {
  // src/background.js
  chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
      url: "dist/bulk.html"
    });
  });
})();
