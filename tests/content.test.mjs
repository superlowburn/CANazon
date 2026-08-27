import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const contentSource = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../src/config.js', import.meta.url), 'utf8');

function classListFor(node) {
  return {
    add(...names) {
      node.className = [...new Set(`${node.className} ${names.join(' ')}`.trim().split(/\s+/))].join(' ');
    },
    remove(...names) {
      node.className = node.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(' ');
    },
    contains(name) {
      return node.className.split(/\s+/).includes(name);
    },
  };
}

function element(tagName) {
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className: '',
    style: {},
    children: [],
    textContent: '',
    parentNode: null,
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
    },
    removeChild(child) {
      node.children = node.children.filter((candidate) => candidate !== child);
      child.parentNode = null;
    },
    addEventListener(type, listener) {
      node.listeners[type] = listener;
    },
    click() {
      node.listeners.click?.({ preventDefault() {}, stopPropagation() {} });
    },
    contains(candidate) {
      return node.children.some((child) => child === candidate || child.contains?.(candidate));
    },
    setAttribute(name, value) {
      node.attributes[name] = { value };
    },
    getAttribute(name) {
      return node.attributes[name]?.value ?? null;
    },
    attributes: {},
    listeners: {},
  };
  node.classList = classListFor(node);
  return node;
}

function contentHarness({ hydrated, pageType = 'search', state = 'us', madeInCanada = true, madeInUSA = false, sponsored = false }) {
  let titlesReady = hydrated;
  let title = 'Amazon Basics Cast Iron Skillet';
  let brand = '';
  let mutationCallback;
  let messageListener;
  let reports = 0;
  let classifications = 0;
  const tile = element('div');
  const nested = element('div');
  const inserted = [];
  const resultsRoot = { parentNode: { insertBefore(node) { inserted.push(node); } } };

  if (pageType === 'nested') tile.appendChild(nested);

  tile.querySelector = (selector) => {
    if ((pageType === 'search' || pageType === 'nested') &&
        (selector === 'h2 a span' || selector === 'h2 span' || selector === 'h2')) {
      return titlesReady ? { textContent: title } : null;
    }
    if ((pageType === 'best-sellers' || pageType === 'sponsored-section' || pageType === 'homepage' || pageType === 'deals' || pageType === 'grocery') &&
        selector === 'a.a-link-normal[href*="/dp/"]:not([aria-hidden="true"])') {
      return titlesReady ? { textContent: title } : null;
    }
    if (pageType === 'category' && selector === '.octopus-pc-asin-title') {
      return titlesReady ? { textContent: title } : null;
    }
    if (selector === '.s-line-clamp-1') return brand ? { textContent: brand } : null;
    if (selector === '.tn-overlay') {
      return tile.children.find((child) => child.classList.contains('tn-overlay')) ?? null;
    }
    if (selector === '.tn-reveal') {
      return tile.children.find((child) => child.classList.contains('tn-overlay'))?.children.find((child) => child.classList.contains('tn-reveal')) ?? null;
    }
    if (selector === '.tn-badge') {
      return tile.children.find((child) => child.classList.contains('tn-badge')) ?? null;
    }
    if (selector === '.puis-sponsored-label-text, [class*="ad-feedback-text"]') return sponsored ? element('span') : null;
    return null;
  };
  nested.querySelector = tile.querySelector;

  const context = {
    console: { log() {} },
    TNDetector: {
      init() {},
      classify() {
        classifications++;
        return state === 'canadian'
          ? { state: 'canadian', madeInCanada, name: 'Test Canada', tags: [] }
          : state === 'us' ? { state: 'us', madeInUSA, name: 'Test USA' } : null;
      },
    },
    document: {
      readyState: 'complete',
      body: {},
      querySelectorAll(selector) {
        if (pageType === 'nested') {
          if (selector === 'div[data-a-card-type="product"]') return [tile];
          if (selector === 'div[data-asin][data-index]:not([data-asin=""])') return [tile, nested];
          return [];
        }
        if (!titlesReady) return [];
        var tileSelector = pageType === 'best-sellers'
          ? 'div[id^="gridItemRoot"]'
          : pageType === 'sponsored-section'
            ? 'div[id^="CardInstance"].sb-video-creative'
            : pageType === 'category'
              ? 'li.octopus-pc-item'
              : pageType === 'homepage'
                ? 'div[data-a-card-type="product"]'
                : pageType === 'deals'
                  ? 'div[data-testid="deal-card"]'
                  : pageType === 'grocery'
                    ? 'div[data-asin][data-index]:not([data-asin=""])'
                    : pageType === 'banner'
                      ? null
                      : 'div[data-component-type="s-search-result"]';
        return selector === tileSelector ? [tile] : [];
      },
      querySelector(selector) {
        if (selector === '[data-tn-toolbar]') return inserted.find((node) => node.getAttribute('data-tn-toolbar')) ?? null;
        if (selector === '.s-main-slot.s-result-list') return resultsRoot;
        return null;
      },
      createElement: element,
      addEventListener() {},
    },
    chrome: {
      runtime: {
        sendMessage(message) { reports += 1; context.lastCounts = message.counts; },
        onMessage: { addListener(listener) { messageListener = listener; } },
      },
    },
    MutationObserver: class {
      constructor(callback) { mutationCallback = callback; }
      observe() {}
    },
    getComputedStyle() { return { position: 'static' }; },
    setTimeout,
  };

  vm.runInNewContext(configSource, context);
  vm.runInNewContext(contentSource, context);

  return {
    hydrate() { titlesReady = true; },
    mutate(addedNodes) { mutationCallback([{ addedNodes }]); },
    overlay() { return tile.querySelector('.tn-overlay'); },
    badge() { return tile.querySelector('.tn-badge'); },
    processed() { return tile.getAttribute('data-tn-done'); },
    reports() { return reports; },
    counts() { return context.lastCounts; },
    classifications() { return classifications; },
    toolbar() { return inserted[0] ?? null; },
    setMode(mode) { messageListener({ type: 'tn-set-mode', mode }, null, function () {}); },
    setProduct(next) {
      title = next.title ?? title;
      brand = next.brand ?? brand;
    },
    reveal() { tile.querySelector('.tn-reveal')?.click(); },
    removeBadge() { const badge = tile.querySelector('.tn-badge'); if (badge) tile.removeChild(badge); },
    removeOverlay() { const overlay = tile.querySelector('.tn-overlay'); if (overlay) tile.removeChild(overlay); },
    nested,
    tile,
  };
}

test('rescans when Amazon hydrates a result with text', async () => {
  const page = contentHarness({ hydrated: false });

  page.hydrate();
  page.mutate([{ nodeType: 3 }]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(page.reports(), 2);
  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes result tiles found by the configured selectors', () => {
  const page = contentHarness({ hydrated: true });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes Amazon Best Sellers product cards', () => {
  const page = contentHarness({ hydrated: true, pageType: 'best-sellers' });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes Amazon category product cards', () => {
  const page = contentHarness({ hydrated: true, pageType: 'category' });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes Amazon homepage product cards', () => {
  const page = contentHarness({ hydrated: true, pageType: 'homepage' });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes Amazon Deals product cards', () => {
  const page = contentHarness({ hydrated: true, pageType: 'deals' });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('processes Amazon grocery landing product cards', () => {
  const page = contentHarness({ hydrated: true, pageType: 'grocery' });

  assert.equal(page.processed(), '1');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});

test('ignores non-product banner shapes', () => {
  const page = contentHarness({ hydrated: true, pageType: 'banner' });

  assert.equal(page.processed(), null);
  assert.equal(page.overlay(), null);
  assert.equal(page.badge(), null);
});

test('processes only the outer card when product selectors overlap or nest', () => {
  const page = contentHarness({ hydrated: true, pageType: 'nested' });

  assert.equal(page.processed(), '1');
  assert.equal(page.nested.getAttribute('data-tn-done'), null);
});

test('adds a red X marker to American frost', () => {
  const page = contentHarness({ hydrated: true });
  const overlay = page.overlay();

  assert.ok(overlay.children.some((child) => child.classList.contains('tn-us-x')));
});

test('uses one American-owned reveal control without an overlapping US badge', () => {
  const page = contentHarness({ hydrated: true, state: 'us' });

  assert.equal(page.badge(), null);
  assert.equal(page.overlay().children.filter((child) => child.classList.contains('tn-reveal')).length, 1);
  assert.equal(page.overlay().children.find((child) => child.classList.contains('tn-reveal')).textContent, 'American-owned · Reveal');
});

test('uses the made-in-USA wording in its single reveal control', () => {
  const page = contentHarness({ hydrated: true, state: 'us', madeInUSA: true });

  assert.equal(page.badge(), null);
  assert.equal(page.overlay().children.find((child) => child.classList.contains('tn-reveal')).textContent, 'Made in USA · Reveal');
});

test('adds a filled-state maple leaf marker to made-in-Canada cards', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian', madeInCanada: true });
  const badge = page.badge();
  const leaf = badge.children.find((child) => child.classList.contains('tn-maple'));

  assert.equal(badge.classList.contains('tn-made'), true);
  assert.equal(leaf.textContent, '🍁');
  assert.equal(badge.children[1].textContent, 'Made in Canada');
});

test('adds an outlined-state maple leaf marker to Canadian-owned cards', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian', madeInCanada: false });
  const badge = page.badge();
  const leaf = badge.children.find((child) => child.classList.contains('tn-maple'));

  assert.equal(badge.classList.contains('tn-owned'), true);
  assert.equal(leaf.textContent, '🍁');
  assert.equal(badge.children[1].textContent, 'Canadian-owned · Made elsewhere');
});

test('labels sponsored Canadian cards without frosting them', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian', sponsored: true });

  assert.equal(page.overlay(), null);
  assert.equal(page.badge().children[1].textContent, 'Made in Canada');
  assert.equal(page.tile.classList.contains('tn-frost'), false);
});

test('classifies sponsored brand sections by origin', () => {
  const page = contentHarness({ hydrated: true, pageType: 'sponsored-section', state: 'canadian', sponsored: true });

  assert.equal(page.processed(), '1');
  assert.equal(page.badge().children[1].textContent, 'Made in Canada');
  assert.equal(page.tile.classList.contains('tn-frost'), false);
});

test('labels unknown products neutrally', () => {
  const page = contentHarness({ hydrated: true, state: 'unknown' });

  assert.equal(page.badge().classList.contains('tn-unknown'), true);
  assert.equal(page.badge().children[1].textContent, 'Origin unknown');
  assert.equal(page.tile.classList.contains('tn-frost'), false);
});

test('orders Canadian, unknown, then American products', () => {
  assert.equal(contentHarness({ hydrated: true, state: 'canadian' }).tile.style.order, '0');
  assert.equal(contentHarness({ hydrated: true, state: 'unknown' }).tile.style.order, '1');
  assert.equal(contentHarness({ hydrated: true, state: 'us' }).tile.style.order, '2');
});

test('sorts Canadian products without injecting extra controls', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian' });

  assert.equal(page.toolbar(), null);
  assert.equal(page.tile.style.order, '0');
});

test('labels-only mode keeps Amazon order while frosting American-owned products', () => {
  const page = contentHarness({ hydrated: true, state: 'us' });

  page.setMode('labels-only');

  assert.equal(page.tile.style.order, '');
  assert.equal(page.tile.classList.contains('tn-frost'), true);
  assert.equal(page.badge(), null);
  assert.equal(page.overlay().children.find((child) => child.classList.contains('tn-reveal')).textContent, 'American-owned · Reveal');
});

test('paused mode leaves Amazon unchanged', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian' });

  page.setMode('paused');

  assert.equal(page.tile.style.order, '');
  assert.equal(page.tile.classList.contains('tn-frost'), false);
  assert.equal(page.badge(), null);
});

test('ignores its own overlay mutation', async () => {
  const page = contentHarness({ hydrated: true });
  const overlay = page.overlay();
  assert.ok(overlay);
  assert.equal(page.reports(), 1);

  page.mutate([overlay]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(page.reports(), 1);
});

test('does not rebuild an unchanged card after an unrelated Amazon mutation', async () => {
  const page = contentHarness({ hydrated: true });
  const overlay = page.overlay();

  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(page.classifications(), 1);
  assert.equal(page.overlay(), overlay);
});

test('reclassifies a recycled card when its product title changes', async () => {
  const page = contentHarness({ hydrated: true });
  const oldOverlay = page.overlay();

  page.setProduct({ title: 'Charmin Ultra Soft Toilet Paper' });
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(page.classifications(), 2);
  assert.notEqual(page.overlay(), oldOverlay);
});

test('re-frosts a recycled American card after revealing its previous product', async () => {
  const page = contentHarness({ hydrated: true });

  page.reveal();
  assert.equal(page.overlay(), null);
  page.setProduct({ title: 'Charmin Ultra Soft Toilet Paper', brand: 'Charmin' });
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.ok(page.overlay());
  assert.equal(page.counts().us, 1);
});

test('keeps a legitimately revealed American card unfrosted on unrelated mutations', async () => {
  const page = contentHarness({ hydrated: true });

  page.reveal();
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(page.overlay(), null);
  assert.equal(page.tile.classList.contains('tn-frost'), false);
});

test('restores a Canadian badge removed by Amazon without changing the product', async () => {
  const page = contentHarness({ hydrated: true, state: 'canadian' });

  page.removeBadge();
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.ok(page.badge());
  assert.equal(page.tile.classList.contains('tn-canadian'), true);
});

test('restores an unknown-origin badge removed by Amazon without changing the product', async () => {
  const page = contentHarness({ hydrated: true, state: 'unknown' });

  page.removeBadge();
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.ok(page.badge());
});

test('restores an unrevealed American overlay removed by Amazon without changing the product', async () => {
  const page = contentHarness({ hydrated: true });

  page.removeOverlay();
  page.mutate([element('span')]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.ok(page.overlay());
  assert.equal(page.tile.classList.contains('tn-frost'), true);
});
