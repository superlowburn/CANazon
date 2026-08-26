// CANazon popup: show live counts for the active tab and toggle the filter.
// Talks to the content script directly (no tab URL / host permission needed).
'use strict';

function setCounts(c) {
  document.getElementById('tn-frosted').textContent = c ? c.us : '–';
  document.getElementById('tn-canadian').textContent = c ? c.canadian : '–';
  document.getElementById('tn-total').textContent = c ? c.total : '–';
}

document.addEventListener('DOMContentLoaded', function () {
  var note = document.getElementById('tn-note');
  document.getElementById('tn-settings').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab) { note.textContent = 'No active tab.'; return; }

    chrome.tabs.sendMessage(tab.id, { type: 'tn-get-counts' }, function (resp) {
      if (chrome.runtime.lastError || !resp) {
        // No content script on this page (not Amazon, or needs a reload).
        note.textContent = 'Open an Amazon search, then reload the tab.';
        return;
      }
      setCounts(resp.counts);
      note.textContent = resp.counts && resp.counts.total
        ? 'Showing ' + resp.counts.canadian + ' Canadian of ' + resp.counts.total + '.'
        : 'No listings detected on this page yet.';
    });

  });
});
