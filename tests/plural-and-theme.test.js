/**
 * Counted nouns and the theme picker: the two places a language's own rules
 * were being replaced by English ones.
 *
 * The plural half runs the real helper against the real catalogues, so it
 * proves the *catalogue* carries the forms the rule asks for - not just that
 * Intl.PluralRules knows French. The theme half reads the built header markup:
 * a French page must not ship "Theme: Signal / ink + lime".
 *
 * Nothing here touches dist/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LOCALES,
  loadCatalog,
  tPlural,
  pluralCategory,
  interpolate,
} from '../scripts/i18n.mjs';
import { THEMES, renderProbePage } from '../scripts/build-site.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = (id) => JSON.parse(readFileSync(join(root, 'content', 'i18n', `${id}.json`), 'utf8'));

const catalogs = Object.fromEntries(LOCALES.map((l) => [l.id, loadCatalog(l.id)]));
const raw = Object.fromEntries(LOCALES.map((l) => [l.id, read(l.id)]));

/** Every leaf path in a catalogue, so two files can be compared exactly. */
function flatten(value, path = '', out = {}) {
  if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path}.${k}` : k, out);
  } else out[path] = value;
  return out;
}

/* ---------------------------------------------------------------- plurals */

test('French counts follow the French rule: 0 and 1 are singular, 2 is plural', () => {
  const fr = catalogs.fr;
  // CLDR puts zero in the singular category for French - the reason "0 jeux"
  // was wrong and "0 jeu" is right.
  assert.equal(pluralCategory('fr', 0), 'one');
  assert.equal(pluralCategory('fr', 1), 'one');
  assert.equal(pluralCategory('fr', 2), 'other');

  assert.equal(tPlural(fr, 'count.games', 0), '0 jeu');
  assert.equal(tPlural(fr, 'count.games', 1), '1 jeu');
  assert.equal(tPlural(fr, 'count.games', 2), '2 jeux');
  assert.equal(tPlural(fr, 'count.games', 464), '464 jeux');
});

test('Arabic counts select the category Intl.PluralRules names, and read it', () => {
  const ar = catalogs.ar;
  const rules = new Intl.PluralRules('ar');
  const expected = { 0: 'zero', 1: 'one', 2: 'two', 3: 'few', 11: 'many' };
  const seen = new Map();

  for (const [count, category] of Object.entries(expected)) {
    const n = Number(count);
    assert.equal(rules.select(n), category, `ar: Intl says ${n} is ${category}`);
    assert.equal(pluralCategory('ar', n), category, `ar: the helper agrees on ${n}`);

    // The helper must return that category's catalogue string, not English
    // and not the generic form.
    const own = ar.strings[`count.games_${category}`];
    assert.equal(typeof own, 'string', `ar: count.games_${category} exists`);
    assert.equal(tPlural(ar, 'count.games', n), interpolate(own, { count: n }));
    seen.set(category, tPlural(ar, 'count.games', n));
  }

  // The five forms are genuinely five different sentences: a catalogue that
  // copies the same string into every category passes a key check and still
  // reads wrong.
  assert.equal(new Set(seen.values()).size, 5, `ar: distinct forms, got ${[...seen.values()].join(' | ')}`);
  for (const form of seen.values()) {
    assert.match(form, /[\u0600-\u06FF]/, `ar: "${form}" is Arabic`);
  }
});

test('English keeps its own rule: 1 game, 2 games', () => {
  assert.equal(tPlural(catalogs.en, 'count.games', 1), '1 game');
  assert.equal(tPlural(catalogs.en, 'count.games', 2), '2 games');
  assert.equal(tPlural(catalogs.en, 'count.games', 0), '0 games');
});

test('the helper falls back to the base key when a language has no variants', () => {
  const bare = { locale: 'fr', strings: { 'thing.n': 'des choses' } };
  assert.equal(tPlural(bare, 'thing.n', 2), 'des choses');
});

test('built French pages count games in French', (t) => {
  if (!existsSync(join(dist, 'fr', 'index.html'))) return t.skip('dist/ is not built');
  const html = readFileSync(join(dist, 'fr', 'games', 'index.html'), 'utf8');
  // The count changes with every harvest, so read it from the page instead of
  // pinning a number: the assertion is that a plural count uses the plural
  // form, not that the catalogue has 464 games forever.
  const match = html.match(/(\d[\d\u00a0 ]*) jeux/);
  assert.ok(match, 'the French index counts games with the plural noun');
  assert.ok(Number(match[1].replace(/[^\d]/g, '')) >= 2, 'the plural form is only used for 2 or more');
  assert.doesNotMatch(html, /\b(0|1) jeux\b/, 'no French page may say 0 jeux or 1 jeux');
});

/* ------------------------------------------------------- counted nouns */

test('every counted noun the builder renders has the forms its language needs', () => {
  for (const { id } of LOCALES) {
    for (const base of ['count.games']) {
      const strings = raw[id].strings;
      const missing = ['zero', 'one', 'two', 'few', 'many', 'other'].filter(
        (c) => typeof strings[`${base}_${c}`] !== 'string' || !strings[`${base}_${c}`].trim(),
      );
      assert.deepEqual(missing, [], `${id}: ${base} is missing ${missing.join(', ')}`);
      assert.equal(typeof strings[base], 'string', `${id}: ${base} stays as the legacy alias`);
    }
  }
});

/* ----------------------------------------------------------- theme coats */

test('every theme has a name and a hint in all three catalogues', () => {
  const ids = THEMES.map((t) => t.id);
  assert.ok(ids.length >= 9, `expected the full coat rail, got ${ids.length}`);
  for (const { id: locale } of LOCALES) {
    for (const id of ids) {
      const name = catalogs[locale]?.strings?.[`theme.${id}.name`];
      const hint = catalogs[locale]?.strings?.[`theme.${id}.hint`];
      assert.ok(typeof name === 'string' && name.trim(), `${locale}: theme.${id}.name is missing`);
      assert.ok(typeof hint === 'string' && hint.trim(), `${locale}: theme.${id}.hint is missing`);
    }
  }
});

test('no theme hint is left in English on the French or Arabic pages', () => {
  for (const id of THEMES.map((t) => t.id)) {
    const enHint = catalogs.en.strings[`theme.${id}.hint`];
    const enName = catalogs.en.strings[`theme.${id}.name`];
    const frHint = catalogs.fr.strings[`theme.${id}.hint`];
    const arHint = catalogs.ar.strings[`theme.${id}.hint`];
    const frName = catalogs.fr.strings[`theme.${id}.name`];
    const arName = catalogs.ar.strings[`theme.${id}.name`];

    // The hint is prose in every language, so it can never be the English one.
    assert.notEqual(frHint, enHint, `fr: theme.${id}.hint is still the English "${enHint}"`);
    assert.notEqual(arHint, enHint, `ar: theme.${id}.hint is still the English "${enHint}"`);
    assert.match(arHint, /[\u0600-\u06FF]/, `ar: theme.${id}.hint is Arabic`);
    assert.match(arName, /[\u0600-\u06FF]/, `ar: theme.${id}.name is Arabic`);

    // A one-word coat name may legitimately be the same in two languages
    // ("Signal", "DMG"); an English phrase like "Lights on" may not.
    if (enName.trim().includes(' ')) {
      assert.notEqual(frName, enName, `fr: theme.${id}.name is still the English "${enName}"`);
      assert.notEqual(arName, enName, `ar: theme.${id}.name is still the English "${enName}"`);
    }
  }
});

test('the theme picker renders localised names, with a separator before the hint', () => {
  for (const locale of ['fr', 'ar']) {
    const html = renderProbePage(locale, { path: '/' });
    const pop = html.match(/<div class="theme-pop"[\s\S]*?<\/div>\s*<\/div>/);
    assert.ok(pop, `${locale}: the coat menu is rendered`);

    for (const id of THEMES.map((t) => t.id)) {
      const name = catalogs[locale].strings[`theme.${id}.name`];
      const hint = catalogs[locale].strings[`theme.${id}.hint`];
      assert.ok(pop[0].includes(name), `${locale}: the menu names ${id} as "${name}"`);
      assert.ok(pop[0].includes(hint), `${locale}: the menu hints ${id} as "${hint}"`);
      // The hint is a caption on its own line, not glued to the name.
      assert.match(
        pop[0],
        new RegExp(`<em>[^<]*·\\s*${hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</em>`),
        `${locale}: ${id} separates the hint from the name`,
      );
    }
    // No English coat name survives in a translated menu.
    for (const t of THEMES) {
      const englishName = catalogs.en.strings[`theme.${t.id}.name`];
      const localName = catalogs[locale].strings[`theme.${t.id}.name`];
      // A proper noun ("DMG") may legitimately be the same in two languages.
      if (localName === englishName) continue;
      assert.ok(!pop[0].includes(`>${englishName}<`), `${locale}: "${englishName}" is still English`);
    }
  }
});

test('the picker label the page ships is in the page language', () => {
  for (const { id } of LOCALES) {
    const html = renderProbePage(id, { path: '/' });
    const label = html.match(/id="btn-theme"[\s\S]*?aria-label="([^"]*)"/);
    assert.ok(label, `${id}: the picker has an aria-label`);
    const first = catalogs[id].strings[`theme.${THEMES[0].id}.name`];
    assert.ok(label[1].includes(first), `${id}: the label names the first coat ("${label[1]}")`);
    // English is the one page where the English template is correct.
    if (id !== 'en') assert.doesNotMatch(label[1], /Theme:/, `${id}: the label is not the English template`);
  }
});

/* --------------------------------------------------------- catalogue shape */

test('the three catalogues still carry identical key sets', () => {
  const sets = Object.fromEntries(LOCALES.map((l) => [l.id, Object.keys(flatten(raw[l.id])).sort()]));
  for (const { id } of LOCALES.slice(1)) {
    const missing = sets.en.filter((k) => !(k in flatten(raw[id])));
    const extra = sets[id].filter((k) => !(k in flatten(raw.en)));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${id} differs from en`);
  }
});

/* ---------------------------------------------- language switcher markup */

test('the filter status has a plural layer, anchored to what ui.js reads', (t) => {
  // The builder repairs the leading count phrase, which only works while ui.js
  // picks between these two payload strings with "is it exactly one". If that
  // ever changes, this test says so instead of the page quietly saying
  // "0 jeux" again.
  const ui = readFileSync(join(root, 'public', 'ui.js'), 'utf8');
  assert.match(
    ui,
    /hits === 1 \? 'one' : 'many'/,
    'ui.js composes the count phrase differently now: rework statusPluralScript()',
  );

  if (!existsSync(join(dist, 'fr', 'games', 'index.html'))) return t.skip('dist/ is not built');
  const html = readFileSync(join(dist, 'fr', 'games', 'index.html'), 'utf8');
  const payload = JSON.parse(
    html.match(/<script id="af-i18n" type="application\/(?:ld\+)?json">([\s\S]*?)<\/script>/)[1],
  );
  const forms = html.match(/var FORMS = (\{[^\n]*\});/);
  const legacy = html.match(/var LEGACY = (\{[^\n]*\});/);
  assert.ok(forms && legacy, 'the French index ships the plural layer');

  const F = JSON.parse(forms[1]);
  const L2 = JSON.parse(legacy[1]);
  assert.equal(F.one, payload.strings.one, 'the singular form is the one ui.js uses for 1');
  assert.equal(F.other, payload.strings.many, 'the plural form is the one ui.js uses for the rest');
  assert.equal(L2.one, payload.strings.one);
  assert.equal(L2.many, payload.strings.many);
  // And the phrase the page starts from is the one that needed repairing.
  assert.equal(F.one.replace('{count}', '0'), '0 jeu');
});

test('the language switcher carries no inline layout: the stylesheet owns it', () => {
  for (const { id } of LOCALES) {
    const html = renderProbePage(id, { path: '/' });
    const nav = html.match(/<header[\s\S]*?<\/header>/);
    const switcher = nav[0].match(/<nav class="lang-switch"[\s\S]*?<\/nav>/);
    assert.ok(switcher, `${id}: the switcher is in the header`);
    assert.doesNotMatch(switcher[0], /style="/, `${id}: no inline styles to override the sheet`);
    assert.equal((switcher[0].match(/<a /g) ?? []).length, 3, `${id}: three links`);
  }
});
