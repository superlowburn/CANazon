# True North — Buy Canadian on Amazon 🍁

A Chrome/Firefox extension that puts a **frost pane** over Amazon search results
that aren't Canadian, so your eye goes to the Canadian options. Built for the
"buy Canadian" moment: you can't quit Amazon (it still ships a lot of Canadian
goods), but you can make the Canadian choices obvious.

Runs entirely on your device. No accounts, no tracking, no network calls.

## What it does

- **Strict by default.** Every listing that isn't a confirmed Canadian brand gets
  frosted. Frost is a translucent, blurred, iced-glass overlay — the tile is still
  there, one click on **Reveal** un-frosts it for the session.
- **Canadian listings get a flag badge** (🍁, top-left):
  - **Solid red chip** = Made in Canada.
  - **Outline chip** = Canadian-*owned* brand that manufactures some/most/all
    abroad (still a Canadian company — shown, not frosted).
- **Live count** in the toolbar popup and a badge count on the icon: how many
  listings are frosted vs Canadian on the current page.
- **Infinite scroll aware** — new results are frosted as they load.

## The two brand lists

**Frost trigger — US-owned brands** (`data/us-brands.js`, ~1,004): generated from a
sourced "US-linked Amazon brands" dataset (canonical brand, category, evidence URL,
and a **Safe-exact-match** flag). Ambiguous names ("Apple", "Ring", "Off", "Method")
are flagged `review` and only match an exact brand byline or the *leading* title token,
so "Apple AirPods" frosts but "apple cider vinegar" doesn't. `data/us-brands-extra.js`
is a small hand-curated supplement for electronics/outdoor-cooking brands the dataset
under-covers (Bose, Cuisinart, Char-Broil, GoPro, Roku…). Ownership ≠ manufacturing:
this flags US-*owned* brands, which is the "don't fund American companies" signal —
Amazon has no reliable made-in field.

**Verified Made-in-USA** (`data/us-made.js`, 23): brands with a manufacturer-stated
U.S. production claim (Lodge, Zippo, Cutco, New Balance, All-Clad…). These get a
stronger frost and a "Made in USA" label — the hardest "avoid" tier — and frost even
if foreign-owned (made-in-USA is the strongest signal). Claims are scoped to named
lines; verify the exact ASIN.

**Badge — Canadian brands** (`data/canadian-brands.js`, ~1,164): see below.

## Where the Canadian data comes from

The Canadian brand list in `data/canadian-brands.js` is compiled from the
[r/BuyCanadian community wiki](https://www.reddit.com/r/BuyCanadian/wiki/). It
carries ~1,160 brands, each tagged made-in-Canada vs made-abroad (the wiki's `*`
convention), plus community tags like Indigenous-/woman-owned where noted.

It's a **snapshot**, not a live feed (the wiki updates slowly and is one
volunteer's queue), and it's DTC-skewed, so many listed brands don't appear on
Amazon. That's expected — see "Known limits."

To refresh it:

```bash
node scripts/harvest-buycanadian.mjs
```

(Reddit blocks datacenter IPs, so run it from a normal connection. See the script
header for the browser fallback.)

## Install (unpacked, for development)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open an `amazon.ca` search and watch non-Canadian tiles frost over.

## How matching works

Per tile we read the product title (and brand byline when present), normalize it
(lowercase, strip accents/punctuation), and look it up against the Canadian list:
exact byline match → multi-word brand anywhere in the title → single-word brand
as the leading token. Common English words that are also brand names (Tool, Only,
Found, …) require a stricter match to avoid false hits. If nothing matches, the
tile is frosted.

## Known limits (v1)

- **Coverage is only as good as the wiki.** Staples like toilet paper are thin
  because the wiki points those at an external grocery guide. Expect lots of
  frost on commodity searches — that's the honest signal, not a bug.
- **Title-based matching** can miss a Canadian brand buried mid-title, or (rarely)
  clear a look-alike. The generic-word guard reduces false clears.
- **No in-extension corrections yet.** Fix a brand by editing
  `data/canadian-brands.js` and opening a PR.

## Develop

```bash
node tests/detector.test.mjs     # matcher unit tests
```

Structure:

- `manifest.json` — MV3, matches all Amazon domains.
- `data/canadian-brands.js` — bundled brand list (pipe-delimited, human-editable).
- `src/config.js` — Amazon selectors + tunables.
- `src/detector.js` — normalize + match (clean-room).
- `src/content.js` — tile scan, frost overlay, flag badge, MutationObserver.
- `src/background.js` — service worker, toolbar badge count.
- `popup/` — toolbar panel.
- `scripts/harvest-buycanadian.mjs` — regenerate the data from the wiki.

## Credits & license

Code is **MIT**. Brand data © the r/BuyCanadian community, used with attribution.
Independent clean-room project; inspired by the Knockoff extension's approach but
contains none of its code or data.
