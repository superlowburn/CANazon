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
  var tileState = new WeakMap(); // last title, brand, mode, and classification per tile
  var activeTiles = new Set(); // canonical tiles from the previous scan
  var counts = { total: 0, canadian: 0, us: 0 };
  var mode = 'canadian-first';

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
    var list = Array.from(set);
    return list.filter(function (tile) {
      return !list.some(function (parent) { return parent !== tile && parent.contains(tile); });
    });
  }

  // Build the frost overlay + reveal pill for a tile.
  function frost(tile, madeInUSA, label) {
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
    pill.textContent = label || (madeInUSA ? 'Made in USA · Reveal' : 'American-owned · Reveal');
    pill.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      revealed.add(tile);
      tile.classList.remove(cfg.frostClass);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      scan();
    });
    if (!label) ov.appendChild(x);
    ov.appendChild(pill);
    // Tile needs positioning context for the absolute overlay.
    var cs = getComputedStyle(tile);
    if (cs.position === 'static') tile.style.position = 'relative';
    tile.appendChild(ov);
  }

  // Add a visible, right-aligned origin label using the existing maple mark.
  function badge(tile, entry) {
    if (entry.state === 'canadian') tile.classList.add(cfg.canadianClass);
    if (tile.querySelector('.tn-badge')) return;
    var b = document.createElement('div');
    var stateClass = entry.unknown ? ' tn-unknown' : entry.state === 'us' ? ' tn-us' : entry.madeInCanada ? ' tn-made' : ' tn-owned';
    b.className = 'tn-badge' + stateClass;
    var leaf = document.createElement('span');
    leaf.className = 'tn-maple';
    leaf.textContent = entry.unknown ? '?' : entry.state === 'us' ? '🇺🇸' : '🍁';
    leaf.setAttribute('aria-hidden', 'true');
    b.appendChild(leaf);
    var label = entry.unknown ? 'Origin unknown' : entry.state === 'us' ? 'American-owned' : entry.madeInCanada ? 'Made in Canada' : 'Canadian-owned · Made elsewhere';
    if (entry.tags && entry.tags.length) label += ' · ' + entry.tags.join(', ');
    var text = document.createElement('span');
    text.className = 'tn-badge-label';
    text.textContent = label;
    b.appendChild(text);
    b.title = entry.name ? entry.name + ' — ' + label : label;
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
    tile.style.order = '';
  }

  function count(entry, tile) {
    if (!entry) return;
    if (entry.state === 'canadian') counts.canadian++;
    else if (entry.state === 'us' && !revealed.has(tile)) counts.us++;
  }

  function marksMatch(tile, entry) {
    var overlay = tile.querySelector('.tn-overlay');
    var badgeEl = tile.querySelector('.tn-badge');
    if (!entry) return !overlay && !badgeEl && !tile.classList.contains(cfg.frostClass) && !tile.classList.contains(cfg.canadianClass);
    if (entry.state === 'canadian') return !!badgeEl && tile.classList.contains(cfg.canadianClass);
    if (entry.state === 'us') return revealed.has(tile)
      ? !overlay && !tile.classList.contains(cfg.frostClass)
      : !!overlay && tile.classList.contains(cfg.frostClass);
    return !!badgeEl;
  }

  function scan(force) {
    counts = { total: 0, canadian: 0, us: 0 };
    var list = tiles();
    var currentTiles = new Set(list);
    activeTiles.forEach(function (tile) {
      if (currentTiles.has(tile)) return;
      clearMarks(tile);
      tile.removeAttribute(cfg.processedAttr);
      tileState.delete(tile);
      revealed.delete(tile);
    });
    activeTiles = currentTiles;
    list.forEach(function (tile) {
      // Only real result rows with content.
      var title = firstText(tile, cfg.titleSelectors);
      if (!title) return;
      counts.total++;

      var brand = firstText(tile, cfg.brandSelectors);
      var key = mode + '\u0000' + title + '\u0000' + brand;
      var productId = tile.getAttribute('data-asin') || tile.getAttribute('data-csa-c-item-id') || '';
      var productKey = productId + '\u0000' + title + '\u0000' + brand;
      var previous = tileState.get(tile);
      if (previous && previous.productKey !== productKey) revealed.delete(tile);
      if (!force && previous && previous.key === key && marksMatch(tile, previous.entry)) {
        count(previous.entry, tile);
        return;
      }

      if (mode === 'paused') {
        clearMarks(tile);
        tileState.set(tile, { key: key, productKey: productKey, entry: null });
        return;
      }

      // Reset prior marks before re-deciding (layout can recycle nodes).
      clearMarks(tile);

      var v = globalThis.TNDetector.classify(brand, title);
      var entry = v || { state: 'unknown' };

      if (v && v.state === 'canadian') {
        counts.canadian++;
        tile.style.order = mode === 'canadian-first' ? '0' : '';
        badge(tile, v);
      } else if (v && v.state === 'us') {
        tile.style.order = mode === 'canadian-first' ? '2' : '';
        if (!revealed.has(tile)) { counts.us++; frost(tile, v.madeInUSA); }
      } else {
        tile.style.order = mode === 'canadian-first' ? '1' : '';
        badge(tile, { unknown: true });
      }
      tileState.set(tile, { key: key, productKey: productKey, entry: entry });
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

  // Popup asks for counts; settings changes update the active page immediately.
  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg) return;
    if (msg.type === 'tn-get-counts') { sendResponse({ counts: counts, mode: mode }); return true; }
    if (msg.type === 'tn-set-mode') { mode = msg.mode || 'canadian-first'; scan(true); sendResponse({ ok: true }); return true; }
    if (msg.type === 'tn-set-enabled') { mode = msg.enabled ? 'canadian-first' : 'paused'; scan(true); sendResponse({ ok: true }); return true; }
  });

  function ready() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ mode: 'canadian-first' }, function (saved) { mode = saved.mode; ready(); });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'sync' && changes.mode) { mode = changes.mode.newValue; scan(true); }
    });
  } else ready();
})();
