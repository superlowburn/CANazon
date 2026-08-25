// True North service worker (MV3). Relays live counts from content scripts to
// the toolbar badge and the popup. No network, no storage of browsing data.
// Content scripts inject declaratively (see manifest content_scripts) — no host
// permissions, so Chrome auto-runs them on Amazon with no per-site opt-in.
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
