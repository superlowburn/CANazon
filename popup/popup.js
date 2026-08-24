// True North popup: show live counts for the active tab and toggle the filter.
'use strict';

function setCounts(c) {
  document.getElementById('tn-frosted').textContent = c ? c.us : '–';
  document.getElementById('tn-canadian').textContent = c ? c.canadian : '–';
  document.getElementById('tn-total').textContent = c ? c.total : '–';
}

function activeTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    cb(tabs && tabs[0] ? tabs[0] : null);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var note = document.getElementById('tn-note');
  var toggle = document.getElementById('tn-enabled');

  activeTab(function (tab) {
    if (!tab) return;
    var onAmazon = /:\/\/[^/]*amazon\./.test(tab.url || '');
    if (!onAmazon) { note.textContent = 'Open an Amazon search to see it work.'; return; }

    // Ask the content script directly (fresh counts + enabled state).
    chrome.tabs.sendMessage(tab.id, { type: 'tn-get-counts' }, function (resp) {
      if (chrome.runtime.lastError || !resp) {
        note.textContent = 'Reload the Amazon tab to start filtering.';
        return;
      }
      setCounts(resp.counts);
      toggle.checked = resp.enabled !== false;
      note.textContent = resp.counts && resp.counts.total
        ? 'Showing ' + resp.counts.canadian + ' Canadian of ' + resp.counts.total + '.'
        : 'No listings detected on this page yet.';
    });

    toggle.addEventListener('change', function () {
      chrome.tabs.sendMessage(tab.id, { type: 'tn-set-enabled', enabled: toggle.checked }, function (r) {
        if (chrome.runtime.lastError) return;
      });
    });
  });
});
