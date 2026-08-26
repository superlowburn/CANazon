// CANazon detector — clean-room. Three-state classifier per listing:
//   'canadian' -> flag badge (seek it)
//   'us'       -> frost (avoid it)
//   null       -> neutral (non-US import / unknown; left untouched)
// Canadian ALWAYS wins over US, so a shared name (Canada's "Napoleon" vs a US
// "Napoleon") is never frosted as American.
//
// Ambiguity handling is per-brand:
//   'generic'  -> match ONLY an exact brand byline, never title text.
//   'leading'  -> match an exact byline OR the LEADING token of a title (so
//                 "Apple AirPods" frosts but "apple cider vinegar" does not).
//   'normal'   -> full matching (byline, multi-word anywhere, leading, long
//                 single-word anywhere).
// US brands carry this from the dataset's "Safe exact match?" column (auto ->
// normal, review -> leading). Canadian brands use static curated lists.
//
// globalThis.TNDetector.classify(brandText, title) ->
//   { state:'canadian', madeInCanada, name, tags } | { state:'us', name } | null
(function () {
  'use strict';

  function norm(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Canadian-side ambiguity (the wiki has no flags, so these are curated).
  var CA_GENERIC = new Set([
    'tool', 'found', 'only', 'brand', 'article', 'attic', 'cove', 'crave',
    'woods', 'fable', 'aspen', 'iota', 'libra', 'luna', 'meyer', 'partake',
    'reunion', 'routine', 'selfish', 'simile', 'om', 'jm', 'ande', 'leka',
    'soje', 'oraki', 'ole', 'nice', 'kent', 'kobo', 'laura', 'mox', 'elix',
    'traffic', 'supplier',
  ]);
  var CA_LEADING = new Set([
    'mint', 'pilot', 'helix', 'challenger', 'paradigm', 'equator', 'monogram',
    'endy', 'attitude', 'hatch', 'bows', 'subtext', 'tanit', 'calita', 'lija',
    'onze', 'nemesis', 'stanfields',
  ]);

  // amb(entry) -> 'generic' | 'leading' | 'normal'
  function buildIndex(raw, mapLine, amb) {
    var byKey = new Map();
    (raw || '').split('\n').forEach(function (line) {
      if (!line || line.indexOf('|') === -1) return;
      var entry = mapLine(line.split('|'));
      if (!entry) return;
      var key = norm(entry.name);
      if (key.length < 2) return;
      if (byKey.has(key)) return;
      entry._key = key;
      entry._amb = amb(entry, key);
      byKey.set(key, entry);
    });
    var multiAll = [], multiLeading = [], single = [];
    byKey.forEach(function (e, key) {
      var multi = key.indexOf(' ') !== -1;
      if (e._amb === 'generic') return; // byline-exact only
      if (multi) {
        (e._amb === 'leading' ? multiLeading : multiAll).push(key);
      } else if (e._amb === 'normal' && key.length >= 5) {
        single.push(key);
      }
    });
    var byLen = function (a, b) { return b.length - a.length; };
    multiAll.sort(byLen); multiLeading.sort(byLen); single.sort(byLen);
    return { byKey: byKey, multiAll: multiAll, multiLeading: multiLeading, single: single };
  }

  function ambOf(idx, key) { var e = idx.byKey.get(key); return e ? e._amb : 'normal'; }

  function allowsLeadingTitle(key, title) {
    return key !== 'stanfields' || /(?:^| )(men|women|unisex|shirt|tee|t shirt|underwear|brief|boxer|sock|thermal|fleece|hoodie|sweater|jacket|pants|legging|pajama|clothing|apparel)(?: |$)/.test(title);
  }

  function matchIn(idx, brandText, titleText) {
    // 1) Exact brand byline (most reliable; any ambiguity level).
    var bkey = norm(brandText);
    if (bkey && idx.byKey.has(bkey)) return idx.byKey.get(bkey);

    // 2) Byline is a leading-word prefix of a multi-word brand key
    //    ("Napoleon" -> "Napoleon BBQ"). Byline is authoritative; skip generic.
    if (bkey && bkey.length >= 4) {
      var lists2 = [idx.multiAll, idx.multiLeading];
      for (var l = 0; l < lists2.length; l++) {
        for (var m = 0; m < lists2[l].length; m++) {
          var mk = lists2[l][m];
          if (mk === bkey || mk.indexOf(bkey + ' ') === 0) return idx.byKey.get(mk);
        }
      }
    }

    var title = norm(titleText);
    if (!title) return null;
    if (idx.byKey.has(title) && allowsLeadingTitle(title, title)) return idx.byKey.get(title);
    var padded = ' ' + title + ' ';

    // 3) Normal multi-word brand anywhere in the title.
    for (var i = 0; i < idx.multiAll.length; i++) {
      if (padded.indexOf(' ' + idx.multiAll[i] + ' ') !== -1) return idx.byKey.get(idx.multiAll[i]);
    }
    // 4) Leading-only multi-word brand at the very start of the title.
    for (var k = 0; k < idx.multiLeading.length; k++) {
      if (title === idx.multiLeading[k] || title.indexOf(idx.multiLeading[k] + ' ') === 0) {
        return idx.byKey.get(idx.multiLeading[k]);
      }
    }
    // 5) Leading single-word token (allows 'leading' + 'normal', not 'generic').
    var first = title.split(' ')[0];
    if (first && idx.byKey.has(first) && ambOf(idx, first) !== 'generic' && allowsLeadingTitle(first, title)) return idx.byKey.get(first);
    // 6) Long normal single-word brand anywhere.
    for (var j = 0; j < idx.single.length; j++) {
      if (padded.indexOf(' ' + idx.single[j] + ' ') !== -1) return idx.byKey.get(idx.single[j]);
    }
    return null;
  }

  var caIdx = null, usIdx = null, usMadeKeys = new Set(), ready = false;

  function init() {
    if (ready) return;
    caIdx = buildIndex(
      globalThis.CANADIAN_BRANDS_RAW,
      function (p) {
        var name = (p[0] || '').trim();
        if (!name) return null;
        return {
          name: name,
          madeInCanada: p[1] === '1',
          tags: (p[3] || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        };
      },
      function (_e, key) { return CA_GENERIC.has(key) ? 'generic' : CA_LEADING.has(key) ? 'leading' : 'normal'; }
    );
    // Verified made-in-USA brands: matchable (auto) AND flagged, so they frost
    // even when absent from the ownership list.
    var usMadeLines = '';
    (globalThis.US_MADE_RAW || '').split('\n').forEach(function (line) {
      if (!line || line.indexOf('|') === -1) return;
      var name = line.split('|')[0].trim();
      if (!name) return;
      usMadeKeys.add(norm(name));
      usMadeLines += name + '|' + name + '|auto|Made in USA\n';
    });
    usIdx = buildIndex(
      (globalThis.US_BRANDS_RAW || '') + '\n' + (globalThis.US_BRANDS_EXTRA_RAW || '') + '\n' + usMadeLines,
      function (p) {
        var name = (p[0] || '').trim();
        if (!name) return null;
        // alias|canonical|mode|category
        return { name: name, canonical: (p[1] || name).trim(), mode: (p[2] || 'auto').trim() };
      },
      function (e) { return e.mode === 'review' ? 'leading' : 'normal'; }
    );
    ready = true;
  }

  function classify(brandText, titleText) {
    if (!ready) init();
    var ca = matchIn(caIdx, brandText, titleText);
    if (ca) return { state: 'canadian', madeInCanada: ca.madeInCanada, name: ca.name, tags: ca.tags };
    var us = matchIn(usIdx, brandText, titleText);
    if (us) {
      var madeInUSA = usMadeKeys.has(us._key) || usMadeKeys.has(norm(us.canonical || us.name));
      return { state: 'us', name: us.canonical || us.name, madeInUSA: madeInUSA };
    }
    return null;
  }

  function stats() {
    if (!ready) init();
    var mic = 0;
    caIdx.byKey.forEach(function (v) { if (v.madeInCanada) mic++; });
    return { canadian: caIdx.byKey.size, madeInCanada: mic, us: usIdx.byKey.size };
  }

  globalThis.TNDetector = { init: init, classify: classify, norm: norm, stats: stats };
})();
