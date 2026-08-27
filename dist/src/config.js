// Amazon DOM selectors + tunables. Kept in one place so a layout change is a
// one-file fix (mirrors Knockoff's data/config.js idea; original code).
globalThis.TN_CONFIG = {
  // Each organic search result tile.
  tileSelectors: [
    'div[data-component-type="s-search-result"]',
    'div.s-result-item[data-asin]:not([data-asin=""])',
    'div[id^="gridItemRoot"]',
    'li.octopus-pc-item',
    'div[id^="CardInstance"].sb-video-creative',
    // Product-only cards used by known Amazon.ca home and Deals layouts.
    'div[data-a-card-type="product"]',
    '[data-csa-c-item-type="asin"][data-csa-c-type="item"][data-csa-c-owner="Homepage"]',
    'div[data-testid="deal-card"]',
  ],
  // Product title text inside a tile (first match wins).
  titleSelectors: [
    'h2 a span',
    'h2 span',
    'h2',
    'a.a-link-normal[href*="/dp/"]:not([aria-hidden="true"])',
    '.octopus-pc-asin-title',
  ],
  // Optional explicit brand byline inside a tile (best-effort; may be absent).
  brandSelectors: [
    'h2.a-size-mini span',
    '.s-line-clamp-1',
    '.a-row .a-size-base-plus',
  ],
  // Skip sponsored tiles? false = treat them like any other listing.
  skipSponsored: false,
  // Class flags used on tiles.
  frostClass: 'tn-frost',
  canadianClass: 'tn-canadian',
  processedAttr: 'data-tn-done',
};
