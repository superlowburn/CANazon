import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('uses CANazon for product-facing branding', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const popup = await readFile(new URL('popup/popup.html', root), 'utf8');
  const content = await readFile(new URL('src/content.js', root), 'utf8');

  assert.equal(manifest.name, 'CANazon');
  assert.equal(manifest.action.default_title, 'CANazon');
  assert.match(popup, /<title>CANazon<\/title>/);
  assert.match(popup, /<h1>CANazon<\/h1>/);
  assert.match(content, /\[CANazon\]/);
});

test('README gives ZIP installation instructions', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');

  assert.match(readme, /CANazon-0\.1\.0\.zip/);
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
