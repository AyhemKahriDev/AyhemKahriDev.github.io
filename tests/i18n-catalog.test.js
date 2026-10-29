/**
 * Contract tests for the translated catalogues.
 *
 * Three hand-written catalogues (en, fr, ar) that a build step reads by key
 * cannot be allowed to drift: a missing key in one locale is a blank label on
 * a live page, and a key that exists in fr but not in ar is invisible until
 * someone loads the Arabic site. These tests pin the shape rather than the
 * wording, so translators can rewrite a sentence without touching a test.
 *
 * The families come from the copy synthesiser, which is the single source of
 * truth for genre ids and English taglines, and the categories come from the
 * catalogue itself. Neither list is copied here, so adding a genre to the
 * harvest script fails this suite until all three locales carry it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FAMILIES } from '../scripts/harvest/copy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['en', 'fr', 'ar'];
const EXPECTED = {
  en: { name: 'English', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
};

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

/** Leaf strings only — the locale/name/dir header values are not prose. */
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
      assert.ok(categories[id].title.trim(), `${locale}/${id} title is blank`);
      assert.ok(categories[id].description.trim(), `${locale}/${id} description is blank`);
    }
  }
});

test('Arabic uses Arabic punctuation and real Arabic prose', () => {
  assert.equal(catalogs.ar.dir, 'rtl', 'ar.json must declare dir: rtl');
  const bad = prose('ar')
    .filter(([, value]) => /[?!]/.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(bad, [], 'Arabic values must use ؟ rather than ? and must not use !');

  const latinComma = prose('ar')
    .filter(([, value]) => value.includes(','))
    .map(([path]) => path);
  assert.deepEqual(latinComma, [], 'Arabic values must use ، rather than an ASCII comma');

  const noArabic = prose('ar')
    .filter(([, value]) => value.trim().split(/\s+/).length > 1)
    .filter(([, value]) => !ARABIC.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(noArabic, [], 'multi-word Arabic values must contain Arabic characters');
});

test('French prose is not a copy of the English', () => {
  assert.equal(catalogs.fr.dir, 'ltr');
  const copyPaste = Object.entries(flat.en)
    .filter(([path]) => /^(families|categories)\./.test(path))
    .filter(([, value]) => typeof value === 'string' && value.trim().split(/\s+/).length > 2)
    .filter(([path, value]) => flat.fr[path] === value)
    .map(([path]) => `${path}: ${flat.en[path]}`);
  assert.deepEqual(copyPaste, [], 'these French values are identical to the English');
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

test('every catalogue declares its own locale and language name', () => {
  for (const locale of LOCALES) {
    assert.equal(catalogs[locale].locale, locale, `${locale}.json locale field`);
    assert.equal(catalogs[locale].name, EXPECTED[locale].name, `${locale}.json name field`);
    assert.equal(catalogs[locale].dir, EXPECTED[locale].dir, `${locale}.json dir field`);
  }
  // The four meta templates are what search results and social cards show, so
  // they must exist as templates with their placeholders intact.
  const meta = Object.keys(flat.en).filter((k) => k.startsWith('strings.meta.'));
  assert.ok(meta.length >= 4, 'at least four meta.* description templates are expected');
  for (const locale of LOCALES) {
    for (const key of meta) {
      assert.ok(flat[locale][key].trim(), `${locale}.json is missing ${key}`);
    }
  }
});
