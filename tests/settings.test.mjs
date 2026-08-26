import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

test('manifest exposes the CANazon settings page and stores preferences', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));

  assert.equal(manifest.options_ui.page, 'options/options.html');
  assert.equal(manifest.options_ui.open_in_tab, true);
  assert.ok(manifest.permissions.includes('storage'));
});

test('settings page uses the approved plain-language modes', async () => {
  const html = await readFile(new URL('options/options.html', root), 'utf8');

  assert.match(html, /How should CANazon help\?/);
  assert.match(html, /<div class="purpose">Buy Canadian<\/div>/);
  assert.match(html, /Sort Canadian first/);
  assert.match(html, /Sort Canadian products first\. Frost American-owned products\./);
  assert.match(html, /Show labels only/);
  assert.match(html, /Highlight Canadian products\. Frost American-owned products\./);
  assert.doesNotMatch(html, /See what changes/);
  assert.doesNotMatch(html, /class="preview"/);
  assert.match(html, /Pause CANazon/);
  assert.match(html, /Leave Amazon unchanged\./);
  assert.match(html, /Saved automatically/);
});

test('share controls open prefilled X and Facebook composers', async () => {
  const source = await readFile(new URL('options/options.js', root), 'utf8');
  const opened = [];
  const nodes = new Map(['share-x', 'share-facebook', 'status'].map((id) => [id, {
    addEventListener(_type, listener) { this.listener = listener; },
    setAttribute() {},
    classList: { toggle() {} },
    textContent: '',
  }]));
  const context = {
    URL,
    URLSearchParams,
    document: {
      addEventListener(_type, listener) { listener(); },
      getElementById(id) { return nodes.get(id) ?? null; },
      querySelectorAll() { return []; },
    },
    chrome: { storage: { sync: { get(_defaults, callback) { callback({ mode: 'canadian-first' }); }, set(_value, callback) { callback(); } } } },
    window: { open(url) { opened.push(url); } },
    setTimeout,
  };

  vm.runInNewContext(source, context);
  nodes.get('share-x').listener({ preventDefault() {} });
  nodes.get('share-facebook').listener({ preventDefault() {} });

  const x = new URL(opened[0]);
  assert.equal(x.hostname, 'twitter.com');
  assert.match(x.searchParams.get('text'), /CANazon/);
  assert.match(x.searchParams.get('url'), /chromewebstore\.google\.com/);

  const facebook = new URL(opened[1]);
  assert.equal(facebook.hostname, 'www.facebook.com');
  assert.match(facebook.searchParams.get('quote'), /CANazon/);
  assert.match(facebook.searchParams.get('u'), /chromewebstore\.google\.com/);
});

test('popup opens the settings page', async () => {
  const html = await readFile(new URL('popup/popup.html', root), 'utf8');
  const source = await readFile(new URL('popup/popup.js', root), 'utf8');

  assert.match(html, /id="tn-settings"/);
  assert.match(source, /openOptionsPage/);
});
