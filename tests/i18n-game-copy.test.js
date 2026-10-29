/**
 * What a game says about itself, in the reader's language.
 *
 * The catalogue in content/ is English data: a game's tagline, description,
 * how-to steps and FAQ were written once, in English, and the harvest keeps
 * rewriting them. A translated chrome over an English description still reads
 * as English on /fr/ and /ar/, so the page takes its copy from the genre
 * template for that locale instead: `families.snake` in French for a snake
 * game, `families.generic` for a game no genre claims.
 *
 * The rule these tests pin, in order:
 *   1. English is the source of truth - the game's own words, never a template.
 *   2. Else the genre template for the resolved family, in that locale.
 *   3. Else the English values, because an untranslated sentence beats a blank.
 *   4. Nothing comes back undefined or empty, whatever the caller hands over.
 *
 * A game's NAME is a proper noun and is not translated, so it is not tested
 * here: titles come straight from the catalogue at every level.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, familyFor, gameCopy, loadCatalog } from '../scripts/i18n.mjs';
import { GAMES } from '../scripts/build-site.mjs';

const ARABIC = /[\u0600-\u06FF]/;
const catalogs = Object.fromEntries(LOCALES.map((l) => [l.id, loadCatalog(l.id)]));

const snake = GAMES.find((g) => g.id === 'snake');
assert.ok(snake, 'the catalogue must still carry a snake game');

/**
 * A game no genre template claims. Every harvested title that matches no
 * family lands on `families.generic`; the tests below treat "no family" and
 * "the generic family" as the same thing, because that is what the builder
 * does.
 */
const genericGame = GAMES.find((g) => {
  const family = familyFor(catalogs.fr, g);
  return family === null || family === catalogs.fr.families.generic;
});
assert.ok(genericGame, 'need at least one game outside every genre family');

const pairs = (faq) => faq.map(({ q, a }) => ({ q, a }));

/* --------------------------------------------------------------- English */

test('English returns the game own copy, not a genre template', () => {
  const copy = gameCopy(catalogs.en, snake, 'en');
  assert.equal(copy.tagline, snake.tagline);
  assert.equal(copy.description, snake.description);
  assert.deepEqual(copy.howToPlay, snake.howToPlay);
  assert.deepEqual(copy.faq, pairs(snake.faq));
  // The English catalogue is specific to this game; the family entry is not.
  assert.notEqual(copy.description, catalogs.en.families.snake.description);
});

test('English stays the game own copy for a game the genres do not claim', () => {
  const copy = gameCopy(catalogs.en, genericGame, 'en');
  assert.equal(copy.description, genericGame.description);
  assert.equal(copy.tagline, genericGame.tagline);
});

/* ---------------------------------------------------------------- French */

test('French returns the genre template for the resolved family', () => {
  const copy = gameCopy(catalogs.fr, snake, 'fr');
  const template = catalogs.fr.families.snake;
  assert.equal(copy.tagline, template.tagline);
  assert.equal(copy.description, template.description);
  assert.deepEqual(copy.howToPlay, template.howToPlay);
  assert.deepEqual(copy.faq, pairs(template.faq));
});

test('the French description of a snake game is not the English one', () => {
  const en = gameCopy(catalogs.en, snake, 'en');
  const fr = gameCopy(catalogs.fr, snake, 'fr');
  assert.notEqual(fr.description, en.description);
  assert.notEqual(fr.tagline, en.tagline);
  assert.notEqual(fr.description, snake.description);
});

test('a game with no genre of its own gets the generic template, translated', () => {
  const copy = gameCopy(catalogs.fr, genericGame, 'fr');
  const template = catalogs.fr.families.generic;
  assert.equal(copy.description, template.description);
  assert.deepEqual(copy.howToPlay, template.howToPlay);
  assert.deepEqual(copy.faq, pairs(template.faq));
  // ... which is French, not the English sentence it replaces.
  assert.notEqual(copy.description, genericGame.description);
});

/* ----------------------------------------------------------------- Arabic */

test('Arabic returns Arabic script, not French with an Arabic heading', () => {
  const copy = gameCopy(catalogs.ar, snake, 'ar');
  for (const key of ['tagline', 'description']) {
    assert.match(copy[key], ARABIC, `Arabic ${key} is not in Arabic script`);
  }
  for (const step of copy.howToPlay) assert.match(step, ARABIC, 'an Arabic step is not in Arabic');
  for (const entry of copy.faq) {
    assert.match(entry.q, ARABIC, 'an Arabic question is not in Arabic');
    assert.match(entry.a, ARABIC, 'an Arabic answer is not in Arabic');
  }
  assert.notEqual(copy.description, gameCopy(catalogs.fr, snake, 'fr').description);
});

/* -------------------------------------------------------------- fallback */

test('an unknown or missing locale falls back to English', () => {
  const english = gameCopy(catalogs.en, snake, 'en');
  assert.deepEqual(gameCopy(catalogs.fr, snake, 'zz'), english);
  assert.deepEqual(gameCopy(catalogs.fr, snake, 'fr-CA'), english);
  assert.deepEqual(gameCopy(catalogs.en, snake), english);
  // A locale the catalog does not know, spelled in another case, still counts.
  assert.deepEqual(gameCopy(catalogs.fr, snake, ' FR '), gameCopy(catalogs.fr, snake, 'fr'));
});

test('a catalog with no families at all still returns the English copy', () => {
  const bare = { locale: 'fr', strings: {} };
  const copy = gameCopy(bare, snake, 'fr');
  assert.equal(copy.description, snake.description);
  assert.deepEqual(copy.howToPlay, snake.howToPlay);
});

/* ------------------------------------------------------------------ shape */

test('no returned field is undefined or empty, for any game in any locale', () => {
  for (const locale of LOCALES) {
    const catalog = catalogs[locale.id];
    for (const game of GAMES) {
      const copy = gameCopy(catalog, game, locale.id);
      const where = `${locale.id}/${game.id}`;
      assert.equal(typeof copy.tagline, 'string', `${where} tagline is not a string`);
      assert.equal(typeof copy.description, 'string', `${where} description is not a string`);
      assert.ok(copy.tagline.trim(), `${where} has a blank tagline`);
      assert.ok(copy.description.trim(), `${where} has a blank description`);
      assert.ok(Array.isArray(copy.howToPlay) && copy.howToPlay.length, `${where} has no steps`);
      assert.ok(
        copy.howToPlay.every((s) => typeof s === 'string' && s.trim()),
        `${where} has a blank step`,
      );
      assert.ok(Array.isArray(copy.faq) && copy.faq.length, `${where} has no FAQ`);
      assert.ok(
        copy.faq.every((f) => f && String(f.q).trim() && String(f.a).trim()),
        `${where} has a blank question or answer`,
      );
    }
  }
});

test('a game with nothing but a title still returns usable fields', () => {
  const copy = gameCopy(catalogs.fr, { id: 'mystery-game', title: 'Mystery Game' }, 'fr');
  assert.ok(copy.tagline.trim());
  assert.ok(copy.description.trim());
  assert.ok(copy.howToPlay.length);
  assert.ok(copy.faq.length);
  // Nothing to translate and no family: the honest fallback is the title.
  const bare = gameCopy({ locale: 'fr', strings: {} }, { id: 'x', title: 'Mystery Game' }, 'fr');
  assert.equal(bare.description, 'Mystery Game');
});
