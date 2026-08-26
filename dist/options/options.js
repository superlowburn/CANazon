'use strict';

var SHARE_TEXT = 'Shop Canadian first with CANazon, a Chrome extension that labels product origins on Amazon.';
var SHARE_URL = 'https://chromewebstore.google.com/search/CANazon';

function selectMode(mode) {
  document.querySelectorAll('.mode').forEach(function (label) {
    var input = label.querySelector('input');
    var selected = input.value === mode;
    input.checked = selected;
    label.classList.toggle('selected', selected);
  });
}

function openShare(platform) {
  var url = platform === 'x'
    ? 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(SHARE_TEXT) + '&url=' + encodeURIComponent(SHARE_URL)
    : 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SHARE_URL) + '&quote=' + encodeURIComponent(SHARE_TEXT);
  window.open(url, '_blank', 'noopener,noreferrer');
}

document.addEventListener('DOMContentLoaded', function () {
  var choices = document.querySelectorAll('input[name="mode"]');
  chrome.storage.sync.get({ mode: 'canadian-first' }, function (saved) { selectMode(saved.mode); });

  choices.forEach(function (choice) {
    choice.addEventListener('change', function () {
      selectMode(choice.value);
      chrome.storage.sync.set({ mode: choice.value });
    });
  });

  document.getElementById('share-x').addEventListener('click', function (event) { event.preventDefault(); openShare('x'); });
  document.getElementById('share-facebook').addEventListener('click', function (event) { event.preventDefault(); openShare('facebook'); });
});
