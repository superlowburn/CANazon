#!/usr/bin/env node
// Regenerate data/canadian-brands.js from the r/BuyCanadian community wiki.
//
//   node scripts/harvest-buycanadian.mjs
//
// It fetches each category's Reddit wiki `.json` (which returns raw markdown in
// `data.content_md`), parses the pipe tables, dedupes brands across categories,
// and writes the bundled data file.
//
// NOTE ON ACCESS: Reddit blocks datacenter/CI IPs (HTTP 403 with a captcha
// page), so this will NOT run from most cloud runners. Run it from a normal
// residential connection. If you are blocked, open each URL below in a logged-in
// browser, copy `data.content_md`, and paste the pieces into raw/ then run with
// `--from-dir raw`. The parser is identical either way.
import fs from 'node:fs';
import path from 'node:path';

const CATEGORIES = [
  'babyandkids', 'clothingandaccessories', 'coffeeteaandalcohol', 'electronics',
  'furnitureandhomegoods', 'cosmeticsandtoiletries', 'homeimprovement',
  'sportshobbiesandoutdoors', 'entertainment',
];
const BASE = 'https://www.reddit.com/r/BuyCanadian/wiki/directories/';
const OUT = path.join(process.cwd(), 'data', 'canadian-brands.js');

// Keep in sync with src/detector.js norm().
const stripLinks = (t) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
const decode = (t) => t.replace(/&amp;/g, '&').replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

function tagsFor(notes) {
  const n = notes.toLowerCase(); const t = [];
  if (/indigenous|first nation|m[eé]tis|inuit/.test(n)) t.push('indigenous-owned');
  if (/woman|women|female/.test(n)) t.push('woman-owned');
  if (/poc|colour-owned|color-owned|black-owned/.test(n)) t.push('poc-owned');
  if (/vegan/.test(n)) t.push('vegan');
  if (/sustainab|eco/.test(n)) t.push('sustainable');
  return t;
}

// Parse one category's markdown into rows.
function parseMd(cat, md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (/^#{1,6}\s+/.test(line)) continue;
    if (!line.startsWith('|')) continue;
    if (/:-|(\bBrand\b.*\bWhere To Buy\b)/i.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    const aster = /\*/.test(cells[0]);
    const name = decode(stripLinks(cells[0])).replace(/\\?\*/g, '').replace(/\\/g, '').trim();
    if (!name) continue;
    const notes = cells.length >= 3 ? decode(stripLinks(cells[2])) : '';
    rows.push({ cat, name, aster, notes });
  }
  return rows;
}

async function getMarkdown(slug, fromDir) {
  if (fromDir) return fs.readFileSync(path.join(fromDir, slug + '.md'), 'utf8');
  const res = await fetch(BASE + slug + '.json', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${slug} (Reddit likely blocking this IP — see header note)`);
  const j = await res.json();
  return j.data.content_md;
}

async function main() {
  const fromDirIdx = process.argv.indexOf('--from-dir');
  const fromDir = fromDirIdx !== -1 ? process.argv[fromDirIdx + 1] : null;

  const allRows = [];
  for (const cat of CATEGORIES) {
    const md = await getMarkdown(cat, fromDir);
    allRows.push(...parseMd(cat, md));
  }

  // Dedupe by normalized name; a brand flagged `*` in ANY category is treated
  // as made-abroad (conservative — outline badge).
  const map = new Map();
  for (const r of allRows) {
    const key = norm(r.name);
    if (key.length < 2) continue;
    if (!map.has(key)) map.set(key, { name: r.name, aster: false, cats: new Set(), tags: new Set() });
    const e = map.get(key);
    if (r.aster) e.aster = true;
    e.cats.add(r.cat);
    tagsFor(r.notes).forEach((t) => e.tags.add(t));
    if (r.name.length < e.name.length) e.name = r.name;
  }

  const brands = [...map.values()]
    .map((e) => ({ name: e.name.replace(/[.\s]+$/, ''), mic: !e.aster, cats: [...e.cats], tags: [...e.tags] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines = brands.map((b) => `${b.name.replace(/[|]/g, '/')}|${b.mic ? 1 : 0}|${b.cats.join(',')}|${b.tags.join(',')}`);
  const today = new Date().toISOString().slice(0, 10);
  const mic = brands.filter((b) => b.mic).length;
  const file = `// AUTO-GENERATED — regenerate with \`node scripts/harvest-buycanadian.mjs\`.
// Source: r/BuyCanadian community wiki (${BASE})
//   Harvested ${today}. Brands: ${brands.length} (${mic} made-in-Canada, ${brands.length - mic} Canadian-owned/made-abroad).
//   Data © the r/BuyCanadian community, used with attribution. This project's CODE is MIT.
//
// Format: name|madeInCanada(1/0)|categories|tags
globalThis.CANADIAN_BRANDS_RAW = \`
${lines.join('\n')}
\`;
`;
  fs.writeFileSync(OUT, file);
  console.log(`Wrote ${OUT}: ${brands.length} brands (${mic} made-in-Canada).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
