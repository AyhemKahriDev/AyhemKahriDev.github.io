/**
 * The offline cache budget has to fit the catalogue.
 *
 * public/sw.js trims its cache down to MAX_ENTRIES, oldest first, on every
 * stored response. A cap smaller than the number of pages in the arcade does
 * not fail loudly: the service worker keeps evicting pages the visitor has
 * already opened, every visit re-downloads, and offline mode silently stops
 * working past the first handful of pages. The cap was 140 while the catalogue
 * held 153 games, then sat at 140 as the catalogue grew to 565 - so this test
 * derives the page count from content/ instead of trusting a number in a
 * comment, and fails if the cap ever falls below it again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeCatalogue, layerGames } from '../scripts/catalogue.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = join(root, 'public/sw.js');
const sw = readFileSync(swPath, 'utf8');

/**
 * One optional catalogue layer from content/, or an empty one.
 *
 * The harvest writes content/engine-new.json and content/harvest-published.json
 * on a different schedule, so their absence is an empty layer rather than a
 * test failure - the same rule scripts/build-site.mjs's readJsonLayer applies.
 */
function readJsonLayer(rel) {
  const file = join(root, rel);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The catalogue exactly as scripts/build-site.mjs builds it, from content/. */
function loadGames() {
  return mergeCatalogue({
    base: readJsonLayer('content/games.json').games ?? [],
    engine: layerGames(readJsonLayer('content/engine-new.json')),
    curated: layerGames(readJsonLayer('content/curated.json')),
    published: layerGames(readJsonLayer('content/harvest-published.json')),
    generated: readJsonLayer('content/games.generated.json').games ?? [],
    overlays: readJsonLayer('content/overlays.json').games ?? {},
  });
}

const games = loadGames();

/* One navigable page per game, plus the /games/ index itself. The paged index
   (page/2 ...), the static pages and the per-game art all ride inside the
   budget's headroom, so this is the floor the cap must clear, not a ceiling. */
const pagesPerLocale = games.length + 1;

/** The numeric value of a `const NAME = <n>;` declaration in the worker. */
function numericConstant(src, name) {
  const match = src.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `public/sw.js no longer declares ${name} as a number`);
  return Number(match[1]);
}

/** The source of the named top-level function, so it can be inspected. */
function functionSource(src, name) {
  const match = src.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `public/sw.js no longer defines ${name}()`);
  return match[0];
}

test('the catalogue is not empty, so the budget below means something', () => {
  assert.ok(games.length > 100, `catalogue has only ${games.length} games`);
  assert.equal(new Set(games.map((g) => g.id)).size, games.length);
});

test('MAX_ENTRIES is a number', () => {
  const cap = numericConstant(sw, 'MAX_ENTRIES');
  assert.ok(Number.isInteger(cap) && cap > 0, `MAX_ENTRIES is ${cap}`);
});

test('MAX_ENTRIES covers a full pass through the catalogue with headroom', () => {
  const cap = numericConstant(sw, 'MAX_ENTRIES');
  assert.ok(
    cap >= pagesPerLocale * 1.3,
    `MAX_ENTRIES ${cap} is below 1.3x the ${pagesPerLocale} pages per locale (${Math.ceil(pagesPerLocale * 1.3)} needed)`,
  );
  assert.ok(cap >= 800, `MAX_ENTRIES ${cap} is below the 800 floor the catalogue needs`);
});

test('trim still evicts, and evicts the oldest entries first', () => {
  const trim = functionSource(sw, 'trim');
  // The cap has to be the thing that decides the cut...
  assert.match(trim, /MAX_ENTRIES/, 'trim() no longer consults MAX_ENTRIES');
  // ...and the cut has to reach cache.delete, or the budget is decorative.
  assert.match(trim, /cache\.delete\(/, 'trim() no longer deletes anything');
  // Cache API keys come back in insertion order, so dropping the first
  // `length - MAX_ENTRIES` is what makes the eviction oldest-first.
  assert.match(
    trim,
    /keys\.slice\(0,\s*keys\.length\s*-\s*MAX_ENTRIES\)/,
    'trim() no longer drops the oldest entries first',
  );
});

test('the cache name still carries the build-time deploy version', () => {
  // VersionServiceWorker() in scripts/build-site.mjs substitutes __AF_VERSION__
  // with the deploy's asset hash, and activate() deletes every other cache, so
  // a cap change reaches returning visitors on the next deploy.
  const cache = sw.match(/const\s+CACHE\s*=\s*'([^']*)'/);
  assert.ok(cache, 'public/sw.js no longer declares CACHE');
  assert.match(cache[1], /__AF_VERSION__/, 'CACHE lost its __AF_VERSION__ placeholder');
});

test('the worker still registers install, activate and fetch', () => {
  for (const type of ['install', 'activate', 'fetch']) {
    assert.match(sw, new RegExp(`addEventListener\\('${type}'`), `no '${type}' listener`);
  }
  assert.match(sw, /cache\.put\(/, 'the worker no longer stores responses it fetches');
});
