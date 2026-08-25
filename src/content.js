// CANazon content script — clean-room. Scans Amazon search tiles, frosts
// non-Canadian listings (Strict), badges Canadian ones with a flag, keeps a
// live count, and re-scans on infinite scroll. No network.
(function () {
  'use strict';

  // Guard against double-injection (declarative content_script + programmatic
  // background injection can both fire into the same isolated world).
  if (globalThis.__TN_RAN__) return;
  globalThis.__TN_RAN__ = true;

  console.log('[CANazon] content script loaded', {
    hasConfig: !!globalThis.TN_CONFIG,
    hasDetector: !!globalThis.TNDetector,
    hasCanadaData: !!globalThis.CANADIAN_BRANDS_RAW,
    hasUSData: !!globalThis.US_BRANDS_RAW
  });

  var cfg = globalThis.TN_CONFIG;
  var revealed = new WeakSet(); // tiles the user un-frosted this session
  var counts = { total: 0, canadian: 0, us: 0 };
  var enabled = true;

  function firstText(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = root.querySelector(selectors[i]);
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function tiles() {
    var set = new Set();
    cfg.tileSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (n) { set.add(n); });
    });
    return Array.from(set);
  }

  // Build the frost overlay + reveal pill for a tile.
  function frost(tile, madeInUSA) {
    tile.classList.add(cfg.frostClass);
    if (tile.querySelector('.tn-overlay')) return;
    var ov = document.createElement('div');
    ov.className = 'tn-overlay' + (madeInUSA ? ' tn-made-us' : '');
    var x = document.createElement('span');
    x.className = 'tn-us-x';
    x.textContent = '×';
    x.setAttribute('aria-hidden', 'true');
    var pill = document.createElement('button');
    pill.className = 'tn-reveal';
    pill.type = 'button';
    pill.textContent = (madeInUSA ? 'Made in USA · Reveal' : 'American · Reveal');
    pill.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      revealed.add(tile);
      tile.classList.remove(cfg.frostClass);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    });
    ov.appendChild(x);
    ov.appendChild(pill);
    // Tile needs positioning context for the absolute overlay.
    var cs = getComputedStyle(tile);
    if (cs.position === 'static') tile.style.position = 'relative';
    tile.appendChild(ov);
  }

  // Add the Canadian flag badge. Solid flag = made in
  // Canada; outline flag = Canadian-owned but made abroad.
  function badge(tile, entry) {
    tile.classList.add(cfg.canadianClass);
    if (tile.querySelector('.tn-badge')) return;
    var b = document.createElement('div');
    b.className = 'tn-badge' + (entry.madeInCanada ? ' tn-made' : ' tn-owned');
    var leaf = document.createElement('span');
    leaf.className = 'tn-maple';
    leaf.setAttribute('aria-hidden', 'true');
    b.appendChild(leaf);
    var label = entry.madeInCanada ? 'Made in Canada' : 'Canadian-owned (made abroad)';
    if (entry.tags && entry.tags.length) label += ' · ' + entry.tags.join(', ');
    b.title = entry.name + ' — ' + label;
    b.setAttribute('aria-label', b.title);
    var cs = getComputedStyle(tile);
    if (cs.position === 'static') tile.style.position = 'relative';
    tile.appendChild(b);
  }

  function clearMarks(tile) {
    tile.classList.remove(cfg.frostClass, cfg.canadianClass);
    var ov = tile.querySelector('.tn-overlay');
    if (ov) ov.parentNode.removeChild(ov);
    var bd = tile.querySelector('.tn-badge');
    if (bd) bd.parentNode.removeChild(bd);
  }

  function scan() {
    counts = { total: 0, canadian: 0, us: 0 };
    var list = tiles();
    list.forEach(function (tile) {
      // Only real result rows with content.
      var title = firstText(tile, cfg.titleSelectors);
      if (!title) return;
      counts.total++;

      if (!enabled) { clearMarks(tile); return; }

      var brand = firstText(tile, cfg.brandSelectors);
      var v = globalThis.TNDetector.classify(brand, title);

      // Reset prior marks before re-deciding (layout can recycle nodes).
      clearMarks(tile);

      if (v && v.state === 'canadian') {
        counts.canadian++;
        badge(tile, v);
      } else if (v && v.state === 'us') {
        if (!revealed.has(tile)) { counts.us++; frost(tile, v.madeInUSA); }
      }
      // else: neutral (non-US import / unknown) — left untouched.
      tile.setAttribute(cfg.processedAttr, '1');
    });
    report();
  }

  function report() {
    try {
      chrome.runtime.sendMessage({ type: 'tn-counts', counts: counts });
    } catch (e) { /* popup/service worker may be asleep; ignore */ }
  }

  // Debounced re-scan on DOM mutations (infinite scroll / SPA nav).
  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; scan(); }, 250);
  }

  function start() {
    globalThis.TNDetector.init();
    scan();
    console.log('[CANazon] first scan complete', counts);
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          // Ignore our own overlay/badge insertions, or we'd loop forever.
          if (n.nodeType !== 1 ||
              !(n.classList && (n.classList.contains('tn-overlay') || n.classList.contains('tn-badge')))) {
            schedule();
            return;
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Popup asks for counts / toggles the filter.
  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg) return;
    if (msg.type === 'tn-get-counts') { sendResponse({ counts: counts, enabled: enabled }); return true; }
    if (msg.type === 'tn-set-enabled') { enabled = !!msg.enabled; scan(); sendResponse({ ok: true }); return true; }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
