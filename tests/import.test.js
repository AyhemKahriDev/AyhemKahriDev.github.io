/**
 * The importer is the only place that turns harvested repositories into
 * catalogue entries, so it is also the only place that can enforce the rules
 * the site needs at 600 games: no duplicate titles, no family flooding the
 * front page, no dead game, and a budget so one run cannot publish a
 * thousand pages.
 *
 * These tests drive it with a fixture, not the network: importGames() is pure,
 * and copyFor/familyFor/categoryFor are injected the same way the real
 * scripts/harvest/copy.mjs and category.mjs will be at integration time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { importGames, slugify, accentFor } from '../scripts/harvest/import.mjs';
import { normaliseTitle, dedupeByTitle } from '../scripts/harvest/dedupe.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/harvest-sample.json', import.meta.url), 'utf8'),
);
const ROWS = fixture.entries;

/** Fixture rows, split the way the CLI splits the two harvest reports. */
const vendoredRows = (rows = ROWS) => rows.map(({ verdict, reason, ...v }) => ({ ...v }));
const validatedRows = (rows = ROWS) =>
  rows.map((r) => ({ slug: r.slug, repo: r.repo, verdict: r.verdict, reason: r.reason }));

/** Stand-ins for the chunk-B copy/category modules. */
const copyFor = (v) => ({
  title: v.title,
  tagline: `A free ${v.title} browser game.`,
  description: `${v.description} Play ${v.title} instantly, no download.`,
  keywords: [`${v.title.toLowerCase()} game`, 'browser game'],
  howToPlay: ['Open the game and follow the on-screen instructions.'],
  faq: [{ q: `Is ${v.title} free?`, a: 'Yes.' }],
});
const familyFor = (v) => v.family;
const categoryFor = () => 'puzzle';

/**
 * One import run. capPerFamily is 3 so the five tetris rows in the fixture
 * actually exercise the cap; budget is left generous unless a test overrides
 * it.
 */
function run(overrides = {}) {
  const rows = overrides.rows ?? ROWS;
  return importGames({
    vendored: vendoredRows(rows),
    validated: validatedRows(rows),
    copyFor,
    familyFor,
    categoryFor,
    capPerFamily: 3,
    budget: 500,
    ...overrides,
    rows: undefined,
  });
}

/** id -> the vendored slug it was built from, so paths can be checked. */
const SLUG_OF_ID = new Map(ROWS.map((r) => [slugify(r.repo), r.slug]));
/** id -> family, for the cap assertion. */
const FAMILY_OF_ID = new Map(ROWS.map((r) => [slugify(r.repo), r.family]));

const fieldsOf = (g) => Object.keys(g).sort();

test('no family publishes more than capPerFamily games', () => {
  const games = run({ capPerFamily: 3 });
  const counts = new Map();
  for (const g of games) {
    const family = FAMILY_OF_ID.get(g.id) ?? 'unknown';
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  assert.ok(games.length > 0, 'the fixture should publish something');
  for (const [family, n] of counts) {
    assert.ok(n <= 3, `${family} published ${n} games, cap is 3`);
  }
  // The fixture has 5 tetris rows; 4 have distinct titles, so the cap must
  // have bitten rather than the duplicates alone doing the work.
  assert.equal(counts.get('tetris'), 3);
});

test('duplicate normalised titles are dropped, keeping the best-starred copy', () => {
  const games = run({ capPerFamily: 40 });
  const ids = games.map((g) => g.id);
  // Alpha (1200 stars) beat Gamma (400 stars) for the title "Block Drop".
  assert.ok(ids.includes('alpha-tetris'), 'the higher-starred Block Drop should survive');
  assert.ok(!ids.includes('gamma-blocks'), 'the lower-starred duplicate should be dropped');

  const titles = games.map((g) => normaliseTitle(g.title));
  assert.equal(new Set(titles).size, titles.length, 'published titles must be unique');
});

test('every game carries every field with the type the site renders', () => {
  const games = run();
  assert.ok(games.length >= 8, 'fixture should produce a decent catalogue');
  const required = [
    'accent', 'category', 'credit', 'daily', 'description', 'embed', 'faq',
    'howToPlay', 'id', 'keywords', 'related', 'tagline', 'title',
  ];
  for (const g of games) {
    assert.deepEqual(fieldsOf(g), required, `${g.id} has the wrong field set`);
    for (const key of ['id', 'title', 'tagline', 'description', 'category', 'accent']) {
      assert.equal(typeof g[key], 'string', `${g.id}.${key} must be a string`);
      assert.ok(g[key].length > 0, `${g.id}.${key} must not be empty`);
    }
    assert.equal(g.daily, false);
    assert.equal(typeof g.embed, 'object');
    assert.equal(typeof g.embed.src, 'string');
    assert.match(g.embed.src, /^\/third-party\/[a-z0-9-]+\/index\.html$/);
    assert.equal(typeof g.credit, 'object');
    for (const key of ['author', 'licence', 'source']) {
      assert.equal(typeof g.credit[key], 'string', `${g.id}.credit.${key} must be a string`);
      assert.ok(g.credit[key].length > 0, `${g.id}.credit.${key} must not be empty`);
    }
    assert.match(g.credit.source, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    for (const key of ['keywords', 'howToPlay', 'related']) {
      assert.ok(Array.isArray(g[key]), `${g.id}.${key} must be an array`);
      assert.ok(g[key].length > 0, `${g.id}.${key} must not be empty`);
      for (const item of g[key]) assert.equal(typeof item, 'string');
    }
    assert.ok(g.faq.length > 0);
    for (const item of g.faq) {
      assert.equal(typeof item.q, 'string');
      assert.equal(typeof item.a, 'string');
      assert.ok(item.q.length > 0 && item.a.length > 0);
    }
  }
});

test('ids are unique and slug-shaped', () => {
  const ids = run().map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${id} is not a slug`);
    assert.ok(id.length <= 60, `${id} is longer than 60 characters`);
  }
});

test('embed src points at the vendored directory the game was copied from', () => {
  for (const g of run()) {
    const slug = SLUG_OF_ID.get(g.id);
    assert.ok(slug, `${g.id} does not come from the fixture`);
    assert.equal(g.embed.src, `/third-party/${slug}/index.html`);
  }
});

test('import is deterministic, even when the harvest reports are shuffled', () => {
  const first = run();
  const second = run();
  assert.deepEqual(first, second, 'two runs over the same input must be identical');

  // A resume pass rewrites .harvest/*.json in whatever order pages finished.
  const shuffled = [...ROWS].reverse();
  const reordered = run({ rows: shuffled });
  assert.deepEqual(
    reordered.map((g) => g.id),
    first.map((g) => g.id),
    'output order must not depend on the order of the harvest reports',
  );
});

test('the budget is a hard cap and keeps the strongest games', () => {
  const all = run();
  const capped = run({ budget: 4 });
  assert.equal(capped.length, 4);
  assert.deepEqual(
    capped.map((g) => g.id),
    all.slice(0, 4).map((g) => g.id),
    'the budget must truncate the ranked list, not reshuffle it',
  );
  // 999999-star Mu/broken-game is dead; if the dead filter ran after the
  // ranking, it would have taken one of these four slots.
  assert.ok(!capped.some((g) => g.id.includes('broken')));
});

test('a dead verdict never reaches the published catalogue', () => {
  const games = run({ budget: 500 });
  assert.ok(!games.some((g) => g.id === slugify('Mu/broken-game')));
  assert.ok(!games.some((g) => g.embed.src.includes('/third-party/mu-broken/')));
  assert.ok(!games.some((g) => g.title === 'Broken Game'));
});

test('an unvalidated game (no verdict at all) is not published', () => {
  const vendored = vendoredRows([ROWS[0], ROWS[5]]);
  const validated = validatedRows([ROWS[0]]); // Snake never got a verdict
  const games = importGames({ vendored, validated, copyFor, familyFor, categoryFor, capPerFamily: 40 });
  assert.deepEqual(games.map((g) => g.id), [slugify('Alpha/tetris')]);
});

test('importGames does not mutate its inputs', () => {
  const frozenRows = ROWS.map((r) => Object.freeze({ ...r }));
  const vendored = Object.freeze(frozenRows.map(({ verdict, reason, ...v }) => Object.freeze(v)));
  const validated = Object.freeze(validatedRows());
  // Frozen objects throw on write in ESM strict mode, so a mutation anywhere
  // in the pipeline fails this test instead of silently corrupting the report.
  const games = importGames({ vendored, validated, copyFor, familyFor, categoryFor, capPerFamily: 3 });
  assert.ok(games.length > 0);
});

test('accents are deterministic, id-derived hsl colours', () => {
  const games = run();
  for (const g of games) {
    assert.match(g.accent, /^hsl\(\d{1,3} 85% 62%\)$/, `${g.id} accent is ${g.accent}`);
    assert.equal(g.accent, accentFor(g.id), 'accent must depend only on the id');
  }
  const distinct = new Set(games.map((g) => g.accent));
  assert.ok(distinct.size > 1, 'accents should vary across the catalogue');
});

test('related games stay inside the published catalogue', () => {
  const games = run();
  const ids = new Set(games.map((g) => g.id));
  for (const g of games) {
    assert.ok(!g.related.includes(g.id), `${g.id} is related to itself`);
    for (const other of g.related) assert.ok(ids.has(other), `${g.id} points at unpublished ${other}`);
  }
});

test('normaliseTitle folds case, punctuation and spacing', () => {
  assert.equal(normaliseTitle('Block  Drop!'), 'block drop');
  assert.equal(normaliseTitle('The Snake: Reloaded'), 'snake reloaded');
  assert.equal(normaliseTitle('2048'), '2048');
  assert.equal(normaliseTitle('Snake & Ladder'), 'snake and ladder');
  assert.equal(normaliseTitle('  TETRIS  '), 'tetris');
});

test('dedupeByTitle keeps the richest record and is independent of input order', () => {
  const a = { slug: 'a', title: 'Same Name', stars: 10, description: 'short' };
  const b = { slug: 'b', title: 'same  name', stars: 50, description: 'longer' };
  const familyOf = () => 'f';
  const kept = dedupeByTitle([a, b], { familyOf, capPerFamily: 40 });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].slug, 'b');
  assert.deepEqual(
    dedupeByTitle([b, a], { familyOf, capPerFamily: 40 }).map((e) => e.slug),
    ['b'],
  );
});
