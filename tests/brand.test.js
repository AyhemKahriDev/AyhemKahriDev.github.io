import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LEGACY = ['arcadefork', 'ArcadeFork', 'ARCADEFORK'];
const SITE = JSON.parse(readFileSync('content/games.json', 'utf8')).site;

/** Files that are history, not product. The rename must not rewrite these. */
const HISTORY = [
  'THIRD-PARTY-MANIFEST.md',
  'outreach-pitch.md',
  'docs/PLAN-2026-10-29.md',
  'docs/NAME-CHECK.md',
  'docs/BRAND.md',
];

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.harvest',
  '.smoke',
  '.hermes',
  'third-party',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(json|mjs|js|ts|css|html|md|xml|txt|webmanifest|yml|yaml)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = walk('.').filter(
  (p) => !HISTORY.some((h) => p.endsWith(h)) && !p.endsWith('tests/brand.test.js'),
);

test('the site name is a lowercase ASCII word, no developer jargon', () => {
  assert.match(SITE.name, /^[a-z0-9]{3,16}$/);
  assert.ok(!/fork|repo|github|npm|code|dev/i.test(SITE.name), `jargon in name: ${SITE.name}`);
});

test('no legacy name survives anywhere player-visible', () => {
  const hits = [];
  for (const f of FILES) {
    // `ARCADEFORK-NOTICE.md` is a real generated filename inside 555 vendored
    // repos (the licence notice the harvester writes). It is not player-facing:
    // the build prunes .md from dist/. Renaming the file would churn every
    // vendored repo for no reader-visible gain, so the token is exempt.
    const body = readFileSync(f, 'utf8').split('ARCADEFORK-NOTICE').join('NOTICE');
    for (const legacy of LEGACY) if (body.includes(legacy)) hits.push(`${f}: ${legacy}`);
  }
  assert.deepEqual(hits, [], `legacy name still present:\n${hits.join('\n')}`);
});

test('the harvest generator reads the name from the catalogue, never a literal', () => {
  const src = readFileSync('scripts/harvest/import.mjs', 'utf8');
  assert.ok(!/arcadefork/i.test(src));
  assert.match(src, /SITE_NAME/, 'import.mjs must interpolate SITE_NAME');
});

test('the stripper and the generator agree on the name', () => {
  const src = readFileSync('scripts/harvest/copy.mjs', 'utf8');
  assert.ok(!/on arcadefork/i.test(src), 'copy.mjs still hardcodes the old name in its strip regex');
});

test('the wordmark keeps its two-tone split on every page that prints it', () => {
  // The mark lives in three places: scripts/shell.mjs (game shell) and
  // scripts/build-site.mjs (site header + footer). Checking the built HTML is
  // the only way to catch all of them — a grep for the old *name* never sees
  // `arcade<b>fork</b>`, which is why this test asserts on the artifact.
  for (const page of ['dist/index.html', 'dist/games/snake/index.html']) {
    const html = readFileSync(page, 'utf8');
    assert.ok(html.includes('spiel<b>kunst</b>'), `${page} lost the spiel/kunst split`);
    assert.ok(!html.includes('arcade<b>fork</b>'), `${page} still prints the old wordmark`);
  }
});

test('no page prints a domain the site does not own', () => {
  const snake = readFileSync('src/games/snake.ts', 'utf8');
  assert.ok(!/\.com\b/.test(snake), 'snake.ts prints a .com domain that does not exist');
});

test('the manifest count matches the catalogue', () => {
  assert.ok(existsSync('dist/site.webmanifest'), 'build first');
  const manifest = JSON.parse(readFileSync('dist/site.webmanifest', 'utf8'));
  const catalogue = JSON.parse(readFileSync('dist/games/catalog.json', 'utf8'));
  const total = Array.isArray(catalogue) ? catalogue.length : (catalogue.games?.length ?? 0);
  assert.ok(
    manifest.description.includes(String(total)),
    `manifest says "${manifest.description}", catalogue has ${total}`,
  );
});

test('the name reaches the home title, the manifest and the OG card', () => {
  const home = readFileSync('dist/index.html', 'utf8');
  assert.ok(home.includes(SITE.name), 'home page must print the site name');
  const manifest = JSON.parse(readFileSync('dist/site.webmanifest', 'utf8'));
  assert.equal(manifest.name.toLowerCase().includes(SITE.name), true);
  assert.ok(/og:site_name" content="[^"]+"/.test(home));
});
