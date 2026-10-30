/**
 * Per-locale metadata on the built site: the Open Graph locale a crawler reads
 * for the page itself, the two alternates pointing at the other trees, and
 * `inLanguage` on the JSON-LD nodes that describe content.
 *
 * Three language trees compete for three audiences; without these a crawler
 * has only the URL prefix to go on, and the French and Arabic pages can be
 * treated as duplicates of the English one.
 *
 * The first test is the registry contract and needs no build. The rest read
 * dist/ when it exists and skip when it does not (a fresh clone, a unit run).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCALES } from '../scripts/i18n.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** The Open Graph spelling each tree must advertise. */
const OG = { en: 'en_GB', fr: 'fr_FR', ar: 'ar_AR', de: 'de_DE' };

/** JSON-LD nodes that describe content, so they must state their language. */
const CONTENT_TYPES = new Set(['WebSite', 'CollectionPage', 'VideoGame', 'FAQPage']);

/* ------------------------------------------------------------- the pages */

/** Every page this builder renders, skipping the vendored games' own HTML. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // third-party/ is somebody else's markup: it carries no af head at all.
    if (entry.name === 'third-party') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let cached = null;

/** Built pages, parsed once: { file, locale, html } for each. */
function builtPages() {
  if (cached) return cached;
  cached = [];
  if (!existsSync(dist)) return cached;
  for (const file of walk(dist)) {
    const rel = relative(dist, file);
    const first = rel.split(sep)[0];
    // Every tree is a registry prefix; anything else is the root (English).
    const byPrefix = new Map(LOCALES.filter((l) => l.prefix).map((l) => [l.prefix.slice(1), l.id]));
    const locale = byPrefix.get(first) ?? 'en';
    cached.push({ file: rel, locale, html: readFileSync(file, 'utf8') });
  }
  return cached;
}

function page(relPath) {
  return builtPages().find((p) => p.file === relPath);
}

/** The one <html …> tag: its lang, dir and data-locale. */
function htmlTag(html) {
  const tag = html.match(/<html [^>]*>/);
  assert.ok(tag, 'the page has an <html> tag');
  return tag[0];
}

function jsonLdNodes(html) {
  const nodes = [];
  const blocks = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const block of blocks) {
    const parsed = JSON.parse(block[1]); // a crawler cannot read broken JSON
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      nodes.push(node);
      if (node && Array.isArray(node.hasPart)) nodes.push(...node.hasPart);
    }
  }
  return nodes;
}

/* ---------------------------------------------------------- the registry */

test('LOCALES: one Open Graph spelling per tree, and it is the right one', () => {
  const spellings = Object.fromEntries(LOCALES.map((l) => [l.id, l.ogLocale]));
  assert.deepEqual(spellings, OG);

  // Open Graph wants a territory (`en_GB`), not a bare language (`en`), and
  // the language half has to agree with the tree it describes.
  for (const l of LOCALES) {
    assert.match(l.ogLocale, /^[a-z]{2}_[A-Z]{2}$/, `${l.id}: og:locale is lang_TERRITORY`);
    assert.equal(l.ogLocale.split('_')[0], l.id, `${l.id}: og:locale speaks the tree's language`);
  }
  assert.equal(new Set(LOCALES.map((l) => l.ogLocale)).size, LOCALES.length, 'no two trees share one');
});

/* ------------------------------------------------------------ every page */

test('built pages: og:locale is the page own, alternates are the other two', (t) => {
  const pages = builtPages();
  if (!pages.length) return t.skip('dist/ not built yet - run npm run build');

  for (const p of pages) {
    const want = OG[p.locale];
    const others = Object.entries(OG)
      .filter(([id]) => id !== p.locale)
      .map(([, value]) => value)
      .sort();

    const tag = htmlTag(p.html);
    assert.match(tag, new RegExp(`lang="${p.locale}"`), `${p.file}: html lang`);
    assert.match(tag, new RegExp(`data-locale="${p.locale}"`), `${p.file}: data-locale`);

    const primary = [...p.html.matchAll(/<meta property="og:locale" content="([^"]+)">/g)];
    assert.equal(primary.length, 1, `${p.file}: exactly one og:locale`);
    assert.equal(primary[0][1], want, `${p.file}: og:locale is ${want}`);

    const alternates = [...p.html.matchAll(/<meta property="og:locale:alternate" content="([^"]+)">/g)]
      .map((m) => m[1])
      .sort();
    assert.deepEqual(alternates, others, `${p.file}: og:locale:alternate names the other two trees`);

    // The legacy hint some crawlers still read, agree with the html tag.
    const lang = p.html.match(/<meta name="language" content="([^"]+)">/);
    assert.ok(lang, `${p.file}: meta name="language" is present`);
    assert.equal(lang[1], p.locale, `${p.file}: meta name="language" matches the page`);
  }
});

test('built pages: JSON-LD parses, and content nodes carry the page language', (t) => {
  const pages = builtPages();
  if (!pages.length) return t.skip('dist/ not built yet - run npm run build');

  let described = 0;
  for (const p of pages) {
    const nodes = jsonLdNodes(p.html);
    const content = nodes.filter((n) => n && CONTENT_TYPES.has(n['@type']));
    for (const node of content) {
      described += 1;
      assert.equal(
        node.inLanguage,
        p.locale,
        `${p.file}: ${node['@type']} says inLanguage "${node.inLanguage}"`, 
      );
    }
  }

  // Not vacuous: every game, category and home page describes its content.
  assert.ok(described > 1000, `expected the catalogue's JSON-LD, saw ${described} nodes`);
});

test('built pages: the three trees are all present and each is in its own language', (t) => {
  const pages = builtPages();
  if (!pages.length) return t.skip('dist/ not built yet - run npm run build');

  for (const l of LOCALES) {
    const inTree = pages.filter((p) => p.locale === l.id);
    assert.ok(inTree.length > 100, `${l.id}: the tree has pages (${inTree.length})`);
    // A tree never advertises another tree's locale as its own.
    for (const p of inTree.slice(0, 5)) {
      assert.equal(p.html.match(/<meta property="og:locale" content="([^"]+)">/)[1], OG[l.id], `${p.file}`);
    }
  }
});

/* --------------------------------------------------------- spot checks */

test('English pages: en_GB, with fr_FR and ar_AR as the alternates', (t) => {
  if (!builtPages().length) return t.skip('dist/ not built yet - run npm run build');

  for (const rel of ['index.html', 'games/snake/index.html', 'categories/word/index.html']) {
    const p = page(rel);
    assert.ok(p, `dist/${rel} exists`);
    assert.match(p.html, /<meta property="og:locale" content="en_GB">/, `${rel}: og:locale en_GB`);
    assert.match(p.html, /<meta property="og:locale:alternate" content="fr_FR">/, `${rel}: fr alternate`);
    assert.match(p.html, /<meta property="og:locale:alternate" content="ar_AR">/, `${rel}: ar alternate`);
    assert.match(p.html, /<meta name="language" content="en">/, `${rel}: meta language`);
  }
});

test('Arabic and French game pages: the structured data speaks the page language', (t) => {
  if (!builtPages().length) return t.skip('dist/ not built yet - run npm run build');

  const ar = page(join('ar', 'games', 'snake', 'index.html'));
  assert.ok(ar, 'dist/ar/games/snake/index.html exists');
  assert.match(ar.html, /<meta property="og:locale" content="ar_AR">/);
  assert.match(ar.html, /<meta property="og:locale:alternate" content="en_GB">/);
  assert.match(ar.html, /<meta property="og:locale:alternate" content="fr_FR">/);

  const types = jsonLdNodes(ar.html).filter((n) => CONTENT_TYPES.has(n['@type']));
  assert.deepEqual(types.map((n) => n['@type']).sort(), ['FAQPage', 'VideoGame']);
  for (const node of types) assert.equal(node.inLanguage, 'ar', `${node['@type']} is Arabic`);

  const fr = page(join('fr', 'games', 'snake', 'index.html'));
  assert.ok(fr, 'dist/fr/games/snake/index.html exists');
  assert.match(fr.html, /<meta property="og:locale" content="fr_FR">/);
  for (const node of jsonLdNodes(fr.html).filter((n) => CONTENT_TYPES.has(n['@type']))) {
    assert.equal(node.inLanguage, 'fr', `${node['@type']} is French`);
  }
});
