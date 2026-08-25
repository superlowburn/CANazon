// True North service worker (MV3). Relays live counts from content scripts to
// the toolbar badge and the popup. No network, no storage of browsing data.
'use strict';

var latest = {}; // tabId -> counts

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (msg && msg.type === 'tn-counts' && sender.tab && sender.tab.id != null) {
    latest[sender.tab.id] = msg.counts;
    var n = msg.counts && msg.counts.us ? String(msg.counts.us) : '';
    try {
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#d52b1e' });
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: n });
    } catch (e) { /* ignore */ }
  }
});

// Popup pulls the cached counts for its tab.
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg && msg.type === 'tn-popup-get' && msg.tabId != null) {
    sendResponse({ counts: latest[msg.tabId] || null });
    return true;
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) { delete latest[tabId]; });

// Content scripts only auto-inject into pages loaded AFTER the extension is
// installed/updated. So on install/update, inject into any already-open Amazon
// tabs — otherwise the user sees "nothing working" until they reload the tab.
var TN_MATCHES = [
  '*://*.amazon.ca/*', '*://*.amazon.com/*', '*://*.amazon.co.uk/*',
  '*://*.amazon.com.au/*', '*://*.amazon.de/*', '*://*.amazon.fr/*',
  '*://*.amazon.it/*', '*://*.amazon.es/*', '*://*.amazon.co.jp/*',
  '*://*.amazon.in/*', '*://*.amazon.com.mx/*', '*://*.amazon.com.br/*',
  '*://*.amazon.nl/*', '*://*.amazon.se/*',
];
var TN_JS = [
  'data/canadian-brands.js', 'data/us-brands.js', 'data/us-brands-extra.js',
  'data/us-made.js', 'src/config.js', 'src/detector.js', 'src/content.js',
];

chrome.runtime.onInstalled.addListener(function () {
  chrome.tabs.query({ url: TN_MATCHES }, function (tabs) {
    (tabs || []).forEach(function (t) {
      if (t.id == null) return;
      chrome.scripting.insertCSS({ target: { tabId: t.id }, files: ['src/frost.css'] })
        .catch(function () {});
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: TN_JS })
        .catch(function () {});
    });
  });
});
