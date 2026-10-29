/**
 * The three-tree build: locales, catalog fallback, URL prefixes, hreflang,
 * the language switcher and per-locale sitemaps.
 *
 * Rendering is exercised through `renderProbePage`, which runs the real
 * layout() for a locale without touching dist/. The last two tests read a
 * built page when dist/ exists, because some things (a title in the page, no
 * "undefined" in a text node) are only worth checking on a real file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LOCALES,
  DEFAULT_LOCALE,
  loadCatalog,
  t,
  tList,
  interpolate,
  localeById,
  localePath,
  absoluteUrl,
  alternatesFor,
  categoryTitle,
  categoryDescription,
  familyFor,
} from '../scripts/i18n.mjs';
import { pageHref, pageCanonical, renderProbePage, sitemapIndexXml, GAMES } from '../scripts/build-site.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const BASE = 'https://arcadefork.pages.dev/';

/* ------------------------------------------------------------- registry */

test('LOCALES: three trees, English at the root, fr and ar under prefixes', () => {
  assert.equal(LOCALES.length, 3);
  assert.deepEqual(
    LOCALES.map((l) => l.id),
    ['en', 'fr', 'ar'],
  );
  assert.deepEqual(
    LOCALES.map((l) => l.prefix),
    ['', '/fr', '/ar'],
  );
  assert.deepEqual(
    LOCALES.map((l) => l.hreflang),
    ['en', 'fr', 'ar'],
  );
  assert.equal(DEFAULT_LOCALE, 'en');
  // Only Arabic reads right to left; French is ltr like English.
  assert.equal(LOCALES[0].dir, 'ltr');
  assert.equal(LOCALES[1].dir, 'ltr');
  assert.equal(LOCALES[2].dir, 'rtl');
  // An unknown id must resolve to something, never undefined.
  assert.equal(localeById('de').id, 'en');
  assert.equal(localeById(undefined).id, 'en');
  for (const l of LOCALES) assert.ok(l.name && l.name.length > 1, `${l.id} has a name`);
});

/* ------------------------------------------------------------ t() lookup */

test('t(): interpolates {vars}, prefers the locale, falls back to English', () => {
  const fr = { locale: 'fr', strings: { 'nav.games': 'Jeux', 'home.kicker': '{count} jeux · gratuit' } };
  assert.equal(t(fr, 'nav.games'), 'Jeux');
  assert.equal(t(fr, 'home.kicker', { count: 464 }), '464 jeux · gratuit');
  assert.equal(interpolate('Hi {name}, {name}', { name: 'Ada' }), 'Hi Ada, Ada');

  // Not in French -> the English string, not the key and not undefined.
  const english = t(fr, 'nav.daily');
  assert.equal(typeof english, 'string');
  assert.ok(english.length > 0);
  assert.notEqual(english, 'nav.daily');
  assert.ok(!/undefined/.test(english));

  // Interpolation also survives the fallback path.
  assert.match(t(fr, 'search.placeholder', { count: 464 }), /464/);

  // A key that exists nowhere still yields readable text, never "undefined".
  const nowhere = t(fr, 'does.not.exist');
  assert.equal(typeof nowhere, 'string');
  assert.ok(!/undefined/.test(nowhere));
  assert.ok(!nowhere.includes('.'));
});

test('t(): missing catalog file and missing keys fall back to the built-in English', () => {
  // An empty catalog is what a missing or half-written file amounts to.
  assert.equal(t({ locale: 'fr', strings: {} }, 'nav.games'), 'All games');
  assert.equal(t({}, 'nav.daily'), 'Daily');
  assert.equal(categoryTitle({ categories: {} }, 'arcade'), 'Arcade Games');
  assert.equal(categoryDescription({ categories: {} }, 'arcade', 'fallback'), 'Classic arcade action, rebuilt for the browser and playable on a phone.');

  // loadCatalog always answers with a complete catalog, file or no file.
  const fr = loadCatalog('fr');
  assert.equal(fr.locale, 'fr');
  assert.equal(fr.dir, 'ltr');
  assert.equal(typeof fr.strings, 'object');
  assert.equal(typeof fr.categories, 'object');
  for (const key of ['nav.games', 'nav.daily', 'foot.nav.credits', 'game.howTo']) {
    const s = t(fr, key, { title: 'Snake' });
    assert.ok(typeof s === 'string' && s.length > 0, `${key} renders`);
    assert.ok(!/undefined/.test(s), `${key} has no "undefined"`);
  }
  const ar = loadCatalog('ar');
  assert.equal(ar.locale, 'ar');
  assert.equal(ar.dir, 'rtl');
});

test('category titles and genre templates: locale first, English second', () => {
  const fr = { categories: { arcade: { title: 'Jeux d’arcade', description: 'Action.' } } };
  assert.equal(categoryTitle(fr, 'arcade'), 'Jeux d’arcade');
  assert.equal(categoryTitle(fr, 'word'), 'Word Games'); // falls back per key
  assert.equal(categoryDescription(fr, 'arcade'), 'Action.');

  const withFamily = {
    families: { snake: { tagline: 'Mangez, grandissez.', howToPlay: ['a', 'b'], faq: [{ q: 'q', a: 'a' }] } },
  };
  assert.ok(familyFor(withFamily, { id: 'snake-3d', title: 'Snake 3D', category: 'arcade' }));
  assert.equal(familyFor(withFamily, { id: 'tetris', title: 'Tetris', category: 'arcade' }), null);
  assert.equal(tList(withFamily, 'families.snake.howToPlay').length, 2);
});

/* --------------------------------------------------------------- paths */

test('localePath: /fr/ and /ar/ prefixes, English left alone', () => {
  assert.equal(localePath('fr', '/games/snake/'), '/fr/games/snake/');
  assert.equal(localePath('ar', '/games/snake/'), '/ar/games/snake/');
  assert.equal(localePath('en', '/games/snake/'), '/games/snake/');
  assert.equal(localePath('/fr', '/games/snake/'), '/fr/games/snake/');
  assert.equal(localePath('fr', '/'), '/fr/');
  assert.equal(localePath('ar', '/'), '/ar/');
  assert.equal(localePath('en', '/'), '/');
  // Deep paths, no double slashes, relative input tolerated.
  assert.equal(localePath('fr', '/games/page/3/'), '/fr/games/page/3/');
  assert.equal(localePath('fr', 'games/snake/'), '/fr/games/snake/');
  assert.ok(!localePath('fr', '/games/').includes('//'));

  assert.equal(pageHref(1), '/games/');
  assert.equal(pageHref(3, '/fr'), '/fr/games/page/3/');
  assert.equal(pageHref(1, '/ar'), '/ar/games/');
  assert.equal(new URL(pageCanonical(2, '/ar')).pathname, '/ar/games/page/2/');
});

/* ------------------------------------------------------------- hreflang */

test('alternates: exactly en, fr, ar and x-default, all absolute', () => {
  const alts = alternatesFor('/games/snake/', BASE);
  assert.deepEqual(
    alts.map((a) => a.hreflang),
    ['en', 'fr', 'ar', 'x-default'],
  );
  for (const a of alts) assert.match(a.href, /^https:\/\//, `${a.hreflang} is absolute`);
  assert.equal(new URL(alts[0].href).pathname, '/games/snake/');
  assert.equal(new URL(alts[1].href).pathname, '/fr/games/snake/');
  assert.equal(new URL(alts[2].href).pathname, '/ar/games/snake/');
  // x-default is the English page: the one a reader with no matching
  // language should land on.
  assert.equal(alts[3].href, alts[0].href);
  assert.equal(absoluteUrl('fr', '/games/snake/', BASE), 'https://arcadefork.pages.dev/fr/games/snake/');
});

/* -------------------------------------------------------------- sitemaps */

test('sitemap index lists exactly three sitemaps, one per locale', () => {
  const xml = sitemapIndexXml(BASE, '2026-10-29');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, 3);
  assert.ok(xml.includes('<sitemapindex'));
  assert.ok(!xml.includes('<urlset'), 'the index is not a urlset');
  assert.deepEqual(
    locs.map((l) => new URL(l).pathname),
    ['/sitemap-en.xml', '/sitemap-fr.xml', '/sitemap-ar.xml'],
  );
  for (const l of locs) assert.match(l, /^https:\/\//);
});

/* -------------------------------------------------------- rendered pages */

test('rendered pages: lang, dir, self-canonical and four alternates', () => {
  for (const loc of LOCALES) {
    const path = '/games/snake/';
    const html = renderProbePage(loc.id, { path });
    assert.match(html, new RegExp(`<html lang="${loc.id}" dir="${loc.dir}"`), `${loc.id}: lang and dir`);

    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/);
    assert.ok(canonical, `${loc.id}: canonical is present`);
    assert.equal(new URL(canonical[1]).pathname, localePath(loc.id, path));

    const hreflangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
    assert.deepEqual(
      hreflangs.map((m) => m[1]),
      ['en', 'fr', 'ar', 'x-default'],
      `${loc.id}: the alternate set is complete on every tree`,
    );
    for (const [, hl, href] of hreflangs) {
      assert.match(href, /^https:\/\//, `${loc.id}/${hl} is absolute`);
    }
    // The English page carries the set too: a cluster needs both ends.
    assert.equal(new URL(hreflangs[3][2]).pathname, path);
  }
});

test('language switcher: three real links to the same page, active one marked', () => {
  for (const loc of LOCALES) {
    const html = renderProbePage(loc.id, { path: '/games/snake/' });
    const nav = html.match(/<nav class="lang-switch"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${loc.id}: the switcher is in the header`);
    const links = [...nav[0].matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)];
    assert.equal(links.length, 3, `${loc.id}: three links, not a menu`);
    assert.deepEqual(
      links.map((m) => new URL(m[1], 'https://example.test').pathname),
      ['/games/snake/', '/fr/games/snake/', '/ar/games/snake/'],
      `${loc.id}: the switcher keeps the reader on the same page`,
    );
    const current = [...nav[0].matchAll(/<a [^>]*aria-current="page"[^>]*>([A-Z]{2})</g)];
    assert.equal(current.length, 1, `${loc.id}: exactly one active language`);
    assert.equal(current[0][1], loc.id.toUpperCase());
    // The links must not need JavaScript.
    assert.ok(!/onclick=/.test(nav[0]));
  }
});

test('no rendered page contains "undefined" in a text node', () => {
  const textOnly = (html) =>
    html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
  for (const loc of LOCALES) {
    for (const path of ['/', '/games/', '/categories/arcade/', '/games/snake/', '/daily/', '/credits/']) {
      const html = renderProbePage(loc.id, { path });
      assert.ok(!/undefined/.test(textOnly(html)), `${loc.id}${path} renders "undefined" in text`);
    }
  }
});

/* ----------------------------------------------------- built pages (dist) */

test('built tree: page 3 of the games index exists in every locale', (t0) => {
  if (!existsSync(dist)) return t0.skip('dist/ not built yet — run npm run build');
  for (const loc of LOCALES) {
    const file = join(dist, localePath(loc.id, '/games/page/3/').slice(1), 'index.html');
    assert.ok(existsSync(file), `${loc.id}: ${file} is missing`);
    const html = readFileSync(file, 'utf8');
    assert.match(html, new RegExp(`<html lang="${loc.id}"`));
  }
});

test('built tree: a French game page keeps the game title and French chrome', (t0) => {
  if (!existsSync(dist)) return t0.skip('dist/ not built yet — run npm run build');
  const dir = join(dist, 'fr', 'games');
  assert.ok(existsSync(dir), 'dist/fr/games/ is missing');
  const id = readdirSync(dir).find((d) => existsSync(join(dir, d, 'index.html')));
  const html = readFileSync(join(dir, id, 'index.html'), 'utf8');
  const game = GAMES.find((g) => g.id === id);
  assert.ok(game, `${id} is not in the catalogue`);
  // The proper noun is the same in every language.
  assert.ok(html.includes(game.title), 'the game title is on the page');
  assert.ok(html.includes(`<html lang="fr"`), 'the page is marked French');
  assert.match(html, /href="\/fr\/games\//, 'its links stay in the French tree');
  assert.match(html, /hreflang="x-default"/, 'the page carries the alternate set');
  assert.ok(!/undefined/.test(html.replace(/<script[\s\S]*?<\/script>/g, ' ')), 'no undefined');
});
