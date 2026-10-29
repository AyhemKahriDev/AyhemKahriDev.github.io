/**
 * Contract tests for the translated catalogues.
 *
 * Three hand-written catalogues (en, fr, ar) that a build step reads by key
 * cannot be allowed to drift: a missing key in one locale is a blank label on
 * a live page, and a key that exists in fr but not in ar is invisible until
 * someone loads the Arabic site.
 *
 * The vocabulary is not decided here. `scripts/i18n.mjs` owns the key map the
 * builder asks for, and it exports that key list; these tests fail if a
 * catalogue is missing one of those keys, or if a catalogue carries a `strings`
 * key the builder never asks for. Genre families are the one exception - their
 * id list comes from the copy synthesiser, which is the single source of truth
 * for genres - so anything outside `CATALOG_KEYS` must be under `families.`.
 *
 * The shape is pinned, not the wording, so a translator can rewrite a sentence
 * without touching a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FAMILIES } from '../scripts/harvest/copy.mjs';
import { CATALOG_KEYS, LOCALES as REGISTRY, localeById } from '../scripts/i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['en', 'fr', 'ar'];

const ARABIC = /[\u0600-\u06FF]/;

function readCatalog(locale) {
  const path = join(ROOT, 'content/i18n', `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const catalogs = Object.fromEntries(LOCALES.map((l) => [l, readCatalog(l)]));
const categoryIds = JSON.parse(readFileSync(join(ROOT, 'content/games.json'), 'utf8')).categories.map(
  (c) => c.id,
);
const familyIds = FAMILIES.map((f) => f.id);

/**
 * Flatten to dotted leaf paths, array indices included, so "the same keys"
 * means the same thing at every depth: a family missing its second FAQ answer
 * shows up as `families.snake.faq.1.a`, not as a whole-object mismatch.
 */
function flatten(value, path = '', out = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, path ? `${path}.${i}` : String(i), out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, path ? `${path}.${key}` : key, out);
    }
  } else {
    out[path] = value;
  }
  return out;
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(catalogs[l])]));
const keys = Object.fromEntries(LOCALES.map((l) => [l, Object.keys(flat[l]).sort()]));
const words = (s) => String(s).trim().split(/\s+/).length;

/** Leaf strings only — nothing structural in a catalogue is prose. */
function prose(locale, predicate = () => true) {
  return Object.entries(flat[locale])
    .filter(([path, value]) => typeof value === 'string' && predicate(path))
    .map(([path, value]) => [path, value]);
}

test('the three catalogues carry byte-identical key sets at every depth', () => {
  const reference = keys.en;
  for (const locale of LOCALES.slice(1)) {
    const missing = reference.filter((k) => !flat[locale].hasOwnProperty(k));
    const extra = keys[locale].filter((k) => !flat.en.hasOwnProperty(k));
    assert.deepEqual(
      { missing, extra },
      { missing: [], extra: [] },
      `${locale}.json does not match en.json: ${missing.length} missing (${missing
        .slice(0, 8)
        .join(', ')}), ${extra.length} extra (${extra.slice(0, 8).join(', ')})`,
    );
  }
});

test('the catalogues speak the builder vocabulary: every key the map exposes, nothing else', () => {
  assert.ok(CATALOG_KEYS.length > 200, `expected a full key map, got ${CATALOG_KEYS.length} keys`);

  for (const locale of LOCALES) {
    const missing = CATALOG_KEYS.filter((k) => !flat[locale].hasOwnProperty(k));
    assert.deepEqual(
      missing,
      [],
      `${locale}.json is missing builder keys: ${missing.slice(0, 12).join(', ')}`,
    );

    // A key left over from an older vocabulary is dead weight that silently
    // never renders - and it hides the fact that the real key is missing.
    const orphans = keys[locale].filter(
      (k) => !CATALOG_KEYS.includes(k) && !k.startsWith('families.'),
    );
    assert.deepEqual(
      orphans,
      [],
      `${locale}.json carries keys the builder never asks for: ${orphans.slice(0, 12).join(', ')}`,
    );
  }

  // The English side must be the map's English, byte for byte, not a copy that
  // drifted while French was being written.
  for (const key of CATALOG_KEYS.filter((k) => k.startsWith('strings.'))) {
    const short = key.slice('strings.'.length);
    assert.ok(
      Object.prototype.hasOwnProperty.call(catalogs.en.strings, short),
      `en.json has no strings.${short}`,
    );
  }
});

test('no translated value is empty or whitespace', () => {
  for (const locale of LOCALES) {
    const blank = prose(locale).filter(([, value]) => value.trim() === '');
    assert.deepEqual(blank.map(([path]) => path), [], `${locale}.json has blank values`);
  }
});

test('every genre family is translated in all three locales, with three steps and two answers', () => {
  for (const locale of LOCALES) {
    const families = catalogs[locale].families;
    assert.deepEqual(
      Object.keys(families).sort(),
      [...familyIds].sort(),
      `${locale}.json family ids do not match scripts/harvest/copy.mjs FAMILIES`,
    );
    for (const id of familyIds) {
      const family = families[id];
      assert.ok(family.tagline.trim(), `${locale}/${id} tagline is blank`);
      assert.ok(family.description.trim(), `${locale}/${id} description is blank`);
      assert.equal(
        family.howToPlay.length,
        3,
        `${locale}/${id} needs exactly three howToPlay lines`,
      );
      assert.equal(family.faq.length, 2, `${locale}/${id} needs exactly two FAQ entries`);
      assert.ok(family.howToPlay.every((s) => s.trim()), `${locale}/${id} has a blank step`);
      assert.ok(
        family.faq.every((f) => f.q.trim() && f.a.trim()),
        `${locale}/${id} has a blank question or answer`,
      );
    }
  }
});

test('every catalogue category is translated in all three locales', () => {
  for (const locale of LOCALES) {
    const categories = catalogs[locale].categories;
    assert.deepEqual(
      Object.keys(categories).sort(),
      [...categoryIds].sort(),
      `${locale}.json category ids do not match content/games.json`,
    );
    for (const id of categoryIds) {
      assert.ok(categories[id].short.trim(), `${locale}/${id} short label is blank`);
      assert.ok(categories[id].title.trim(), `${locale}/${id} title is blank`);
      assert.ok(categories[id].description.trim(), `${locale}/${id} description is blank`);
    }
  }
});

test('Arabic uses Arabic punctuation and real Arabic prose', () => {
  // The writing direction is registry data - the builder stamps it on <html>
  // from LOCALES - so a catalogue cannot disagree with it.
  assert.equal(localeById('ar').dir, 'rtl', 'the registry must build Arabic as rtl');
  assert.ok(
    REGISTRY.filter((l) => l.dir === 'rtl').map((l) => l.id).join(',') === 'ar',
    'Arabic is the only right-to-left tree',
  );

  const bad = prose('ar')
    .filter(([, value]) => /[?!]/.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(bad, [], 'Arabic values must use ؟ rather than ? and must not use !');

  const latinComma = prose('ar')
    .filter(([, value]) => value.includes(','))
    .map(([path]) => path);
  assert.deepEqual(latinComma, [], 'Arabic values must use ، rather than an ASCII comma');

  const noArabic = prose('ar')
    .filter(([, value]) => words(value) > 3)
    .filter(([, value]) => !ARABIC.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(noArabic, [], 'multi-word Arabic values must contain Arabic characters');
});

test('French and Arabic prose is not a copy of the English', () => {
  for (const locale of ['fr', 'ar']) {
    const copyPaste = Object.entries(flat.en)
      .filter(([path, value]) => typeof value === 'string' && words(value) > 2)
      // Descriptions and the long sentences are the ones a lazy translation
      // leaves in English; single words ("Contact", "Arcade") may legitimately
      // be the same in two languages.
      .filter(([path]) => /^(families|categories)\./.test(path) || path.endsWith('.description'))
      .filter(([path, value]) => flat[locale][path] === value)
      .map(([path]) => `${path}: ${flat.en[path]}`);
    assert.deepEqual(copyPaste, [], `these ${locale} values are identical to the English`);

    const sentences = Object.entries(flat.en)
      .filter(([path, value]) => path.startsWith('strings.') && words(value) >= 8)
      .filter(([path, value]) => flat[locale][path] === value)
      .map(([path]) => path);
    assert.deepEqual(sentences, [], `these ${locale} sentences are still English`);
  }
});

test('family descriptions sit between 60 and 200 characters in every locale', () => {
  for (const locale of LOCALES) {
    for (const id of familyIds) {
      const { description } = catalogs[locale].families[id];
      assert.ok(
        description.length >= 60 && description.length <= 200,
        `${locale}/${id} description is ${description.length} chars: ${description}`,
      );
    }
  }
});

test('English is exactly the map the builder reads', async () => {
  const { t, loadCatalog } = await import('../scripts/i18n.mjs');
  const en = loadCatalog('en');
  for (const key of CATALOG_KEYS.filter((k) => k.startsWith('strings.'))) {
    const short = key.slice('strings.'.length);
    assert.equal(
      t(en, short),
      flat.en[`strings.${short}`],
      `en.json disagrees with the built-in map on ${short}`,
    );
  }
});

/**
 * The end-to-end half: a build that renders English onto a French page is the
 * bug these catalogues exist to prevent, and only the emitted HTML can prove
 * it is gone. Skipped when dist/ has not been built (a fresh clone, a unit
 * test run), so `npm test` stays useful without a 90-second build.
 */
const ENGLISH_ONLY = [
  // chrome
  'Skip to content',
  'All games',
  'Main',
  'Start here',
  'Browse by',
  'Everything',
  'Random',
  'Loads in about a second',
  'Plays offline after first visit',
  'No tracking',
  'Play something random',
  'Browse all',
  'Free browser games',
  'The arcade in numbers',
  // ticker and stats strip
  'ONE NEW GRID EVERY DAY',
  'NO ACCOUNT, NO EMAIL, NO PAYWALL',
  'MADE OF HTML',
  'ZERO DOWNLOADS',
  'accounts needed',
  'new grid daily',
  // daily card labels (the card's own heading; "Daily Word Search" is also a
  // game title in content/games.json, so that one is checked in place below)
  "TODAY'S TOKEN",
  "Today's puzzle",
  'new at midnight UTC',
  // section heads and feature lines
  'Why it is free',
  'The whole cabinet',
  'Cabinet slots',
  'Pick up where you left off',
  'Nothing to load first',
  'Nothing to sign up for',
  'Nothing to pay',
  'Advertise',
  // categories, as headings
  'Word Games',
  'Puzzle Games',
  'Arcade Games',
  'Brain Games',
  'Strategy Games',
  'Table Games',
  'Racing Games',
  'Sandbox & Tools',
  // search / sort
  'Search games by name',
  'Sort games',
  'Arcade order',
];

/** The heading text of the first tile whose href matches `marker`. */
function headingAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return '';
  const slice = html.slice(at, at + 20000);
  const m = slice.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
}

for (const locale of ['fr', 'ar']) {
  // The home page carries the nav, the hero, the ticker, the stats row, the
  // daily card and the category cards; the games index carries the search
  // placeholder and the sort options. Both used to render English chrome.
  const pages = [join(ROOT, 'dist', locale, 'index.html'), join(ROOT, 'dist', locale, 'games/index.html')];
  const built = pages.every((p) => existsSync(p));

  test(`the built /${locale}/ pages carry no English chrome`, { skip: !built }, () => {
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      const survived = ENGLISH_ONLY.filter((s) => html.includes(s));
      // "Search 464 games" is a template, so the count is matched, not the text.
      if (/Search \d+ games/.test(html)) survived.push('Search <count> games');
      assert.deepEqual(
        survived,
        [],
        `${page.replace(`${ROOT}/`, '')} still renders: ${survived.join(' | ')}`,
      );
    }
  });

  test(`the built /${locale}/ home page really is in ${locale}`, { skip: !built }, () => {
    const html = readFileSync(pages[0], 'utf8');

    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
    assert.ok(h1.trim(), `/${locale}/ has no <h1>`);
    assert.ok(
      locale === 'fr' ? /jeux/i.test(h1) : ARABIC.test(h1),
      `the /${locale}/ <h1> is not in ${locale}: ${h1}`,
    );

    // The nine category cards are the ones that used to read "Word"/"Puzzle".
    const headings = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) =>
      m[1].replace(/<[^>]*>/g, '').trim(),
    );
    assert.ok(
      locale === 'fr'
        ? headings.some((h) => /Jeux de mots|Casse-tête/i.test(h))
        : headings.some((h) => ARABIC.test(h)),
      `the /${locale}/ category headings are not localised`,
    );

    // The daily card heading is catalogue copy; the game tile next to it keeps
    // its English title because that is the game's name.
    const dailyHeading = headingAfter(html, `<a class="tile" href="/${locale}/daily/`);
    assert.ok(dailyHeading, `/${locale}/ has no daily card`);
    assert.ok(
      locale === 'fr' ? /mots/i.test(dailyHeading) : ARABIC.test(dailyHeading),
      `the /${locale}/ daily card heading is not localised: ${dailyHeading}`,
    );
  });
}
