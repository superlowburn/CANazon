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
    parentNode: null,
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
    },
    removeChild(child) {
      node.children = node.children.filter((candidate) => candidate !== child);
      child.parentNode = null;
    },
    addEventListener() {},
    setAttribute(name, value) {
      node.attributes[name] = value;
    },
    attributes: {},
  };
  node.classList = classListFor(node);
  return node;
}

function contentHarness({ hydrated, pageType = 'search', state = 'us', madeInCanada = true }) {
  let titlesReady = hydrated;
  let mutationCallback;
  let reports = 0;
  const tile = element('div');

  tile.querySelector = (selector) => {
    if (pageType === 'search' &&
        (selector === 'h2 a span' || selector === 'h2 span' || selector === 'h2')) {
      return titlesReady ? { textContent: 'Amazon Basics Cast Iron Skillet' } : null;
    }
    if (pageType === 'best-sellers' &&
        selector === 'a.a-link-normal[href*="/dp/"]:not([aria-hidden="true"])') {
      return titlesReady ? { textContent: 'Nespresso Vertuo Coffee Pods' } : null;
    }
    if (pageType === 'category' && selector === '.octopus-pc-asin-title') {
      return titlesReady ? { textContent: 'Amazon Basics Shower Curtain' } : null;
    }
    if (selector === '.tn-overlay') {
      return tile.children.find((child) => child.classList.contains('tn-overlay')) ?? null;
    }
    if (selector === '.tn-badge') {
      return tile.children.find((child) => child.classList.contains('tn-badge')) ?? null;
    }
    return null;
  };

  const context = {
    console: { log() {} },
    TNDetector: {
      init() {},
      classify() {
        return state === 'canadian'
          ? { state: 'canadian', madeInCanada, name: 'Test Canada', tags: [] }
          : { state: 'us', madeInUSA: false };
      },
    },
    document: {
      readyState: 'complete',
      body: {},
      querySelectorAll(selector) {
        if (!titlesReady) return [];
        var tileSelector = pageType === 'best-sellers'
          ? 'div[id^="gridItemRoot"]'
          : pageType === 'category'
            ? 'li.octopus-pc-item'
            : 'div[data-component-type="s-search-result"]';
        return selector === tileSelector ? [tile] : [];
      },
      createElement: element,
      addEventListener() {},
    },
    chrome: {
      runtime: {
        sendMessage() { reports += 1; },
        onMessage: { addListener() {} },
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
    processed() { return tile.attributes['data-tn-done']; },
    reports() { return reports; },
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

test('adds a red X marker to American frost', () => {
  const page = contentHarness({ hydrated: true });
  const overlay = page.overlay();

  assert.ok(overlay.children.some((child) => child.classList.contains('tn-us-x')));
});

test('adds a filled-state maple leaf marker to made-in-Canada cards', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian', madeInCanada: true });
  const badge = page.badge();
  const leaf = badge.children.find((child) => child.classList.contains('tn-maple'));

  assert.equal(badge.classList.contains('tn-made'), true);
  assert.equal(leaf.textContent, '🍁');
});

test('adds an outlined-state maple leaf marker to Canadian-owned cards', () => {
  const page = contentHarness({ hydrated: true, state: 'canadian', madeInCanada: false });
  const badge = page.badge();
  const leaf = badge.children.find((child) => child.classList.contains('tn-maple'));

  assert.equal(badge.classList.contains('tn-owned'), true);
  assert.equal(leaf.textContent, '🍁');
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
