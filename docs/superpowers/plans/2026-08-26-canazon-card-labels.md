# CAMazon Card Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CAMazon's Amazon card treatments match its popup legend, correct the reproduced Stanfield's and Hanes classifications, and deliver a verified installable ZIP.

**Architecture:** Keep the existing three-state detector and card renderer. Make the smallest data/matching corrections in the detector, render the popup's existing maple-leaf glyph on cards, add distinct filled and outlined badge CSS, then mirror the verified runtime files into `dist/` and package them.

**Tech Stack:** Chrome Manifest V3, browser JavaScript, CSS, Node.js built-in test runner, ZIP packaging, browser-based Amazon visual QA.

**Spec:** `docs/superpowers/specs/2026-08-26-canazon-card-labels.md`

## Global Constraints

- Work only in the CAMazon checkout `/Users/steve/conductor/workspaces/canazon/halifax`; never reference or mix another extension project's code, rules, assets, or terminology.
- Use the existing `🍁` glyph from the popup; add no dependency and no new runtime abstraction.
- Made in Canada is filled red; Canadian-owned/made-abroad is white with a red outline; American remains full-card frosted; neutral remains untouched.
- Preserve version `0.1.0` and produce `CANazon-0.1.0.zip` with `manifest.json` at its root.
- Do not modify or delete `.playwright-cli/` or `data/madeinca-missing-candidates.json`.

---

### Task 1: Correct Stanfield's and Hanes classification

**Files:**
- Modify: `tests/detector.test.mjs`
- Modify: `src/detector.js`
- Modify: `data/us-brands-extra.js`

**Interfaces:**
- Consumes: `globalThis.TNDetector.classify(brandText, titleText)` and the existing pipe-delimited supplemental US brand format.
- Produces: stable Canadian-owned output for Stanfield's apparel, neutral output for the unrelated book title, and US output for Hanes.

- [ ] **Step 1: Add failing detector regressions**

Add these cases to `tests/detector.test.mjs`:

```js
t("Stanfield's byline -> Canadian-owned, made abroad", () => {
  const r = D.classify("Stanfield's", "Stanfield's Men's Premium Crew Neck T-Shirt");
  assert.strictEqual(r.state, 'canadian');
  assert.strictEqual(r.name, 'Stanfields');
  assert.strictEqual(r.madeInCanada, false);
});

t('Stanfields leading title -> Canadian-owned, made abroad', () => {
  const r = D.classify('', "Stanfield’s Men’s Premium Long Sleeve Shirt");
  assert.strictEqual(r.state, 'canadian');
  assert.strictEqual(r.madeInCanada, false);
});

t('Stanfields inside an unrelated book title stays neutral', () => {
  assert.strictEqual(D.classify('', 'The Last of the Stanfields: A Novel'), null);
});

t('Hanes apparel -> recognized American', () => {
  const r = D.classify('', "Hanes Men's Beefy T-Shirt");
  assert.strictEqual(r.state, 'us');
  assert.strictEqual(r.name, 'Hanes');
  assert.strictEqual(r.madeInUSA, false);
});
```

- [ ] **Step 2: Run the focused detector test and confirm RED**

Run: `node tests/detector.test.mjs`

Expected: the two Stanfield's positive cases and Hanes fail under the current code; the unrelated book currently exposes the false-positive behavior.

- [ ] **Step 3: Apply the minimal matching and data changes**

In `src/detector.js`, remove straight and curly apostrophes before replacing other punctuation, so possessives remain one token:

```js
.replace(/[’']/g, '')
.replace(/[^a-z0-9]+/g, ' ')
```

Add `'stanfields'` to `CA_LEADING`, which permits an exact byline or leading title token but prevents a mid-title book match. Add this line to the curated template in `data/us-brands-extra.js`:

```text
Hanes|Hanes|auto|Apparel
```

- [ ] **Step 4: Run the focused detector test and confirm GREEN**

Run: `node tests/detector.test.mjs`

Expected: all detector checks pass with `0 failed`.

- [ ] **Step 5: Run the complete baseline suite**

Run: `node --test`

Expected: all branding, content, and detector tests pass with `0 failed`.

- [ ] **Step 6: Commit the independently working detector fix**

```bash
git add tests/detector.test.mjs src/detector.js data/us-brands-extra.js
git commit -m "fix: classify Stanfields and Hanes cards correctly"
```

---

### Task 2: Match card badges to the popup legend

**Files:**
- Modify: `tests/content.test.mjs`
- Modify: `tests/branding.test.mjs`
- Modify: `src/content.js`
- Modify: `src/frost.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: detector entries shaped as `{ state: 'canadian', madeInCanada: boolean, name: string, tags: string[] }`.
- Produces: `.tn-badge.tn-made` with a visible `🍁` for made-in-Canada and `.tn-badge.tn-owned` with the same glyph for Canadian-owned/made-abroad.

- [ ] **Step 1: Add failing card-state regressions**

Extend `contentHarness` with a `madeInCanada = true` option and pass it through its Canadian detector result. Replace the existing maple-leaf test and add the owned state:

```js
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
```

Add a `tests/branding.test.mjs` check that reads `src/frost.css` and asserts a red background for `.tn-badge.tn-made`, a white background and red border for `.tn-badge.tn-owned`, and no `clip-path` declaration for `.tn-maple`.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/content.test.mjs tests/branding.test.mjs`

Expected: the glyph assertion and distinct CSS-state assertions fail against the current star-like polygon and identical transparent badges.

- [ ] **Step 3: Render the popup glyph and distinct state containers**

In `src/content.js`, add the glyph when creating the leaf span:

```js
leaf.className = 'tn-maple';
leaf.textContent = '🍁';
leaf.setAttribute('aria-hidden', 'true');
```

In `src/frost.css`, remove the polygon and make the leaf typographic:

```css
.tn-maple {
  display: block;
  font: 28px/1 Apple Color Emoji, Segoe UI Emoji, sans-serif;
}

.tn-badge.tn-made {
  color: #fff;
  background: #d52b1e;
  border: 2px solid #d52b1e;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.tn-badge.tn-owned {
  color: #d52b1e;
  background: #fff;
  border: 2px solid #d52b1e;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
```

Update the two Canadian README bullets so the written behavior distinguishes Made in Canada from Canadian-owned/made-abroad.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `node --test tests/content.test.mjs tests/branding.test.mjs`

Expected: all focused card and branding tests pass with `0 failed`.

- [ ] **Step 5: Run the complete suite**

Run: `node --test`

Expected: all tests pass with `0 failed`.

- [ ] **Step 6: Commit the independently working visual fix**

```bash
git add tests/content.test.mjs tests/branding.test.mjs src/content.js src/frost.css README.md
git commit -m "fix: match Canadian card badges to legend"
```

---

### Task 3: Build and verify the deliverable

**Files:**
- Modify mechanically: `dist/README.md`
- Modify mechanically: `dist/data/us-brands-extra.js`
- Modify mechanically: `dist/src/content.js`
- Modify mechanically: `dist/src/detector.js`
- Modify mechanically: `dist/src/frost.css`
- Replace: `CANazon-0.1.0.zip`
- Create: `.gstack/qa-reports/screenshots/canazon-made-in-canada-2026-08-26.png`
- Create: `.gstack/qa-reports/screenshots/canazon-canadian-owned-2026-08-26.png`
- Create: `.gstack/qa-reports/screenshots/canazon-american-frost-2026-08-26.png`
- Update: `.gstack/qa-reports/qa-report-amazon-com-2026-08-26.md`

**Interfaces:**
- Consumes: the verified source files and Amazon search result DOM.
- Produces: an installable root-manifest ZIP and screenshot-backed QA evidence for every promised treatment.

- [ ] **Step 1: Mirror only tracked runtime inputs into `dist/`**

Run:

```bash
cp README.md LICENSE manifest.json dist/
cp data/canadian-brands.js data/us-brands.js data/us-brands-extra.js data/us-made.js dist/data/
cp popup/popup.css popup/popup.html popup/popup.js dist/popup/
cp src/background.js src/config.js src/content.js src/detector.js src/frost.css dist/src/
cp icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png dist/icons/
```

Verify source and distribution parity:

```bash
cmp src/content.js dist/src/content.js
cmp src/detector.js dist/src/detector.js
cmp src/frost.css dist/src/frost.css
cmp data/us-brands-extra.js dist/data/us-brands-extra.js
cmp popup/popup.html dist/popup/popup.html
```

Expected: every `cmp` exits `0`.

- [ ] **Step 2: Rebuild the versioned ZIP from `dist/`**

Create a temporary archive and then replace the tracked deliverable:

```bash
archive_dir=$(mktemp -d)
(cd dist && zip -qr "$archive_dir/CANazon-0.1.0.zip" .)
mv "$archive_dir/CANazon-0.1.0.zip" CANazon-0.1.0.zip
rmdir "$archive_dir"
```

- [ ] **Step 3: Run package and full-suite verification**

Run:

```bash
node --test
unzip -t CANazon-0.1.0.zip
test "$(unzip -Z1 CANazon-0.1.0.zip | grep -c '^manifest.json$')" -eq 1
unzip -p CANazon-0.1.0.zip manifest.json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const m=JSON.parse(s);process.exit(m.name==='CANazon'&&m.version==='0.1.0'?0:1)})"
```

Expected: full suite has `0 failed`; `unzip -t` ends with no errors; exactly one root `manifest.json`; manifest name/version check exits `0`.

- [ ] **Step 4: Run browser QA on reliable Amazon pages**

Load the rebuilt `dist/` extension into an isolated browser session and inspect these pages:

```text
https://www.amazon.ca/s?k=kamik+boots
https://www.amazon.ca/s?k=napoleon+bbq
https://www.amazon.ca/s?k=lodge+cast+iron
https://www.amazon.ca/s?k=zojirushi
https://www.amazon.com/s?k=stanfields&crid=3MWJDGIU2AFC9&sprefix=stanfields%2Caps%2C162&ref=nb_sb_noss_1
https://www.amazon.com/s?k=hanes
```

Verify and record:

```text
Kamik: .tn-badge.tn-made, filled red 38px badge, visible 🍁.
Napoleon: .tn-badge.tn-owned, white 38px badge with red 2px border, visible 🍁.
Lodge: .tn-overlay.tn-made-us with “Made in USA · Reveal”; clicking Reveal removes frost from only that card.
Hanes: .tn-overlay with “American · Reveal”.
Zojirushi: no .tn-badge and no .tn-overlay.
Stanfield's apparel: .tn-badge.tn-owned.
The Last of the Stanfields book: no .tn-badge.
Popup: legend remains visibly consistent with card states.
Console: no CAMazon JavaScript errors after load, reveal, refresh, and dynamic card hydration.
```

Capture the three named treatment screenshots and inspect each image before reporting it as evidence. If Amazon, Chrome policy, CAPTCHA, or extension loading blocks a page, record the exact blocker and do not call that page passed.

- [ ] **Step 5: Update the QA report and final health score**

In `.gstack/qa-reports/qa-report-amazon-com-2026-08-26.md`, mark each original issue as verified only when its after screenshot and DOM/computed-style evidence agree. Add a final summary with pages tested, console errors, fixes verified, blockers, and baseline-to-final health score.

- [ ] **Step 6: Commit the packaged delivery and QA report**

The `.gstack/qa-reports/` evidence stays in its existing ignored local report directory; commit only the distributable files:

```bash
git add dist/ CANazon-0.1.0.zip
git commit -m "build: package and verify CANazon 0.1.0 fix"
```

- [ ] **Step 7: Run final branch verification**

Run:

```bash
node --test
unzip -t CANazon-0.1.0.zip
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: tests and archive validation pass; only the preserved pre-existing untracked paths remain; the branch contains the detector, visual, and package commits.
