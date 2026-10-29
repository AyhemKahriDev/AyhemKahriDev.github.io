/**
 * The /games/ index is paged at build time.
 *
 * These tests pin the maths that decides which games land on which page, the
 * URLs those pages are served from, and the shape of the compact catalogue the
 * browser fetches for search. A wrong slice here does not throw: it silently
 * drops a game from the catalogue (no page links to it) or shows one twice.
 * That is invisible in a screenshot and fatal to a 500-game arcade, so it is
 * checked arithmetically instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES,
  GAMES_PER_PAGE,
  pageCountFor,
  pageHref,
  pageCanonical,
  pageSlice,
  catalogEntries,
  catalogJson,
  pagerHtml,
} from '../scripts/build-site.mjs';

/** A catalogue of `n` synthetic games, ids g0..g(n-1), in catalogue order. */
function fakeGames(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `g${i}`,
    title: `Game ${i}`,
    category: i % 2 ? 'arcade' : 'puzzle',
    accent: '#123456',
    keywords: ['ignored', 'by', 'the', 'export'],
  }));
}

test('page count maths: 1, 60, 61, 465 and 500 games', () => {
  assert.equal(GAMES_PER_PAGE, 60);
  assert.equal(pageCountFor(1), 1);
  assert.equal(pageCountFor(60), 1);
  assert.equal(pageCountFor(61), 2);
  assert.equal(pageCountFor(465), 8);
  assert.equal(pageCountFor(500), 9);
  // An empty catalogue still needs one page: /games/ must exist.
  assert.equal(pageCountFor(0), 1);
  // The page size is a parameter, not a constant baked into the maths.
  assert.equal(pageCountFor(120, 25), 5);
  assert.equal(pageCountFor(125, 25), 5);
  assert.equal(pageCountFor(126, 25), 6);
});

test('page N slices the catalogue in order, with a short last page', () => {
  const games = fakeGames(200);
  const ids = (n) => pageSlice(games, n).map((g) => g.id);

  assert.equal(pageSlice(games, 1).length, 60);
  assert.equal(ids(1)[0], 'g0');
  assert.equal(ids(1).at(-1), 'g59');
  assert.equal(ids(2)[0], 'g60');
  assert.equal(ids(2).at(-1), 'g119');
  assert.equal(pageSlice(games, 4).length, 20);
  assert.equal(ids(4)[0], 'g180');
  assert.equal(ids(4).at(-1), 'g199');
  // Past the end is empty, never a throw: a stale link can land here.
  assert.deepEqual(pageSlice(games, 5), []);
});

test('canonical URL: page 1 is /games/, page 2 is /games/page/2/, both absolute', () => {
  assert.equal(pageHref(1), '/games/');
  assert.equal(pageHref(2), '/games/page/2/');
  assert.equal(pageHref(8), '/games/page/8/');

  const one = pageCanonical(1);
  const two = pageCanonical(2);

  assert.notEqual(one, two);
  assert.match(one, /^https:\/\//);
  assert.match(two, /^https:\/\//);
  assert.equal(new URL(one).pathname, '/games/');
  assert.equal(new URL(two).pathname, '/games/page/2/');
  assert.ok(!/^https?:\/\/[^/]*\/\//.test(one), `doubled slash in ${one}`);
  assert.ok(!/^https?:\/\/[^/]*\/\//.test(two), `doubled slash in ${two}`);
  // Self-referencing: a canonical that 404s is worse than none.
  assert.equal(new URL(two).protocol, 'https:');
});

test('catalogue export carries exactly the four compact fields, for every game', () => {
  const entries = catalogEntries(fakeGames(3));
  assert.deepEqual(entries[0], { i: 'g0', t: 'Game 0', c: 'puzzle', a: '#123456' });
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['a', 'c', 'i', 't']);
  }

  // The real catalogue: every published game, nothing extra.
  const real = catalogEntries(GAMES);
  assert.equal(real.length, GAMES.length);
  assert.ok(real.length > 0);
  const ids = new Set(real.map((e) => e.i));
  assert.equal(ids.size, GAMES.length, 'a game id is duplicated or missing');
  for (const game of GAMES) assert.ok(ids.has(game.id), `${game.id} is missing from the export`);
  // Keywords, taglines and descriptions stay out: the payload is fetched on
  // the first keystroke and must stay small.
  const serialised = JSON.stringify(real);
  assert.ok(!serialised.includes('keywords'));
  assert.ok(!serialised.includes('tagline'));
});

test('tile order is stable across pages: no duplicates, no gaps', () => {
  const games = fakeGames(465);
  const pages = pageCountFor(games.length);
  const walked = [];
  for (let n = 1; n <= pages; n++) walked.push(...pageSlice(games, n).map((g) => g.id));

  assert.equal(walked.length, games.length);
  assert.deepEqual(walked, games.map((g) => g.id));
  assert.equal(new Set(walked).size, walked.length, 'a game appears on two pages');
});

test('the catalogue JSON cannot close its own script tag', () => {
  const hostile = [
    { id: 'x', title: 'Break </script><script>alert(1)</script>', category: 'arcade', accent: '#fff' },
  ];
  const json = catalogJson(hostile);

  assert.ok(!json.includes('</script>'), 'raw </script> survived the escape');
  assert.ok(!json.includes('<script'), 'raw <script survived the escape');
  // Escaping must not corrupt the data: the browser still has to parse it.
  const round = JSON.parse(json);
  assert.equal(round[0].t, hostile[0].title);
  assert.equal(round[0].i, 'x');
});

test('pager markup: numbered links, prev/next, current page marked', () => {
  const first = pagerHtml(1, 8);
  assert.match(first, /<nav[^>]*class="pager/);
  for (let n = 1; n <= 8; n++) assert.ok(first.includes(`href="${pageHref(n)}"`), `page ${n} link`);
  assert.match(first, /aria-current="page"[^>]*>1</);
  assert.ok(!first.includes('href="/games/page/0/"'), 'page 0 must not be linked');

  const middle = pagerHtml(2, 8);
  assert.ok(middle.includes(`href="${pageHref(1)}"`), 'page 2 links back to page 1');
  assert.ok(middle.includes(`href="${pageHref(3)}"`), 'page 2 links on to page 3');
  assert.match(middle, /aria-current="page"[^>]*>2</);

  const last = pagerHtml(8, 8);
  assert.ok(!last.includes('href="/games/page/9/"'), 'the last page must not link forward');
  assert.match(last, /aria-current="page"[^>]*>8</);

  // A single page of games still renders the nav, with nothing to click.
  const only = pagerHtml(1, 1);
  assert.match(only, /<nav/);
  assert.ok(!/href="\/games\/page\/2\/"/.test(only));
});
