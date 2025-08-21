// Receives download requests from the content script and uses chrome.downloads
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "download" && msg?.url) {
    const filename = msg.filename || "dribbble-image";
    chrome.downloads.download(
      { url: msg.url, filename, saveAs: false },
      (id) => sendResponse({ ok: !!id, downloadId: id, lastError: chrome.runtime.lastError?.message })
    );
    return true; // keep the message channel open for async sendResponse
  }
});
