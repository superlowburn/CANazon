// Unit tests for the True North detector. Run: node tests/detector.test.mjs
import assert from 'node:assert';
import '../data/canadian-brands.js';
import '../data/us-brands.js';
import '../data/us-brands-extra.js';
import '../src/detector.js';

const D = globalThis.TNDetector;
D.init();

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error('✗ ' + name + ' — ' + e.message); }
}

t('data loaded', () => {
  const s = D.stats();
  assert.ok(s.canadian > 1000, 'expected >1000 Canadian brands, got ' + s.canadian);
  assert.ok(s.us > 900, 'expected >900 US brands, got ' + s.us);
});

// --- Canadian (badge) ---
t('Canadian made-in-Canada -> canadian, madeInCanada true (Kamik)', () => {
  const r = D.classify('', "Kamik Women's Momentum 2 Snow Boot");
  assert.strictEqual(r.state, 'canadian');
  assert.strictEqual(r.madeInCanada, true);
});

t('Canadian-owned/made-abroad byline prefix (Napoleon -> Napoleon BBQ)', () => {
  const r = D.classify('Napoleon', 'Napoleon');
  assert.strictEqual(r.state, 'canadian');
  assert.strictEqual(r.name, 'Napoleon BBQ');
  assert.strictEqual(r.madeInCanada, false);
});

t('Canadian single-word leading title (Royale toilet paper)', () => {
  assert.strictEqual(D.classify('', 'Royale Velour Toilet Paper, 12 Equal 24 Rolls').state, 'canadian');
});

// --- US (frost) ---
t('US auto brand -> us (Charmin)', () => {
  assert.strictEqual(D.classify('Charmin', 'Charmin Toilet Paper Ultra Soft').state, 'us');
});

t('US auto brand leading title, no byline (Coleman)', () => {
  assert.strictEqual(D.classify('', 'Coleman Portable Camping Chair').state, 'us');
});

t('US multi-word brand mid-title (Betty Crocker)', () => {
  assert.strictEqual(D.classify('', 'Delicious Betty Crocker Fruit Snacks Variety').state, 'us');
});

t('Amazon Basics -> us', () => {
  assert.strictEqual(D.classify('Amazon Basics', 'Amazon Basics 2-Ply Soft Toilet Paper').state, 'us');
});

// --- Ambiguous US brand (dataset "review" -> leading only) ---
t('ambiguous US brand frosts as LEADING title token (Apple)', () => {
  assert.strictEqual(D.classify('', 'Apple AirPods Max 2 - Orange').state, 'us');
});

t('ambiguous US brand mid-title does NOT false-frost (apple cider)', () => {
  assert.strictEqual(D.classify('', 'Organic Apple Cider Vinegar Gummies'), null);
});

// --- Neutral ---
t('unknown/non-US import -> null (neutral, untouched)', () => {
  assert.strictEqual(D.classify('', 'Generic Nonexistent Widget 3000'), null);
});

t('generic word does not false-match (Tool)', () => {
  assert.strictEqual(D.classify('', 'Tool Box Organizer Tray Set'), null);
});

// --- Precedence: Canadian beats US on shared names ---
t('Canadian precedence over US on shared name (Napoleon)', () => {
  assert.strictEqual(D.classify('Napoleon', 'Napoleon Prestige Grill').state, 'canadian');
});

t('normalizer handles accents/punctuation', () => {
  assert.strictEqual(D.norm('Lolë!'), 'lole');
  assert.strictEqual(D.norm('Char-Broil'), 'char broil');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
