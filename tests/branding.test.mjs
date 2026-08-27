import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

test('uses CANazon for product-facing branding', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const popup = await readFile(new URL('popup/popup.html', root), 'utf8');
  const content = await readFile(new URL('src/content.js', root), 'utf8');

  assert.equal(manifest.name, 'CANazon - Buy Canadian');
  assert.equal(manifest.version, '0.3');
  assert.equal(manifest.action.default_title, 'CANazon - Buy Canadian');
  assert.match(popup, /<title>CANazon<\/title>/);
  assert.match(popup, /<h1>CANazon<\/h1>/);
  assert.match(content, /\[CANazon\]/);
});

test('README gives current ZIP installation instructions', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');

  assert.match(readme, /chromewebstore\.google\.com\/detail\/canazon-buy-canadian\/kfeobiokdejmibohjjofajkbhfiblohk/);
  assert.match(readme, /CANazon-0\.3\.zip/);
  assert.match(readme, /Load unpacked/);
  assert.match(readme, /manifest\.json/);
});

test('distribution includes the README screenshot asset', async () => {
  const readme = await readFile(new URL('dist/README.md', root), 'utf8');
  const match = readme.match(/\]\((store-assets\/[^)]+)\)/);

  assert.ok(match, 'expected a README image path');
  assert.ok((await stat(new URL('dist/' + match[1], root))).isFile());
});

test('Canadian card badges match the legend states', async () => {
  const css = await readFile(new URL('src/frost.css', root), 'utf8');

  assert.match(css, /\.tn-badge\.tn-made\s*\{[^}]*background:\s*#d52b1e;/);
  assert.match(css, /\.tn-badge\.tn-owned\s*\{[^}]*background:\s*#fff;[^}]*border:\s*2px solid #d52b1e;/);
  assert.doesNotMatch(css, /\.tn-maple\s*\{[^}]*clip-path:/);
});

test('toolbar badge reports the Canadian product count', async () => {
  const source = await readFile(new URL('src/background.js', root), 'utf8');
  const listeners = [];
  const badgeTexts = [];
  const context = {
    chrome: {
      runtime: { onMessage: { addListener(listener) { listeners.push(listener); } } },
      action: {
        setBadgeBackgroundColor() {},
        setBadgeText(value) { badgeTexts.push(value); },
      },
      tabs: { onRemoved: { addListener() {} } },
    },
  };

  vm.runInNewContext(source, context);
  listeners[0]({ type: 'tn-counts', counts: { canadian: 4, us: 2, total: 10 } }, { tab: { id: 7 } });

  assert.equal(badgeTexts.length, 1);
  assert.equal(badgeTexts[0].tabId, 7);
  assert.equal(badgeTexts[0].text, '4');
});

test('Canadian card badges sit in the top-right corner', async () => {
  const css = await readFile(new URL('src/frost.css', root), 'utf8');
  const badgeRule = css.match(/\.tn-badge\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(badgeRule, /right:\s*4px;/);
  assert.doesNotMatch(badgeRule, /left:/);
});
