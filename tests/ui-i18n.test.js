/**
 * ui.js is the only JavaScript that writes words into a page after load, so it
 * is the last place English can leak into a French or Arabic document.
 *
 * The file is an IIFE with no exports and no DOM in Node, so these tests read
 * it as text for the structural claims (no English chrome literal, the payload
 * is read before it is used) and then run the pieces that decide wording -
 * the fallback table, the string lookup, the theme-label template - in a
 * sandbox with a fake payload and a fake document. That proves the localisation
 * path works rather than just that the right words are spelled in the source.
 *
 * The last test reads a built page when dist/ exists: it checks the payload
 * the builder ships against what ui.js asks for, and that an Arabic document
 * arrives already labelled in Arabic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'public', 'ui.js'), 'utf8');

/** Drop comment-only lines and trailing `// ...` notes, keep the code. */
function stripComments(text) {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*\/\*.*?\*\/\s*$/, '')
        .replace(/^\s*(\/\/|\*\/?|\*\*?).*$/, '')
        .replace(/^([^'"`]*?[;,}\)])\s*\/\/.*$/, '$1'),
    )
    .join('\n');
}

const code = stripComments(src);

/** The strings this file owns, as keys - the payload ships the same names. */
const OWNED = ['one', 'many', 'match', 'in', 'all', 'broken', 'page', 'themeButton'];

/** The fallback table, parsed out of the source rather than duplicated here. */
const FALLBACK_SRC = src.match(/var FALLBACK = \{[\s\S]*?\n {2}\};/);
assert.ok(FALLBACK_SRC, 'ui.js defines an English fallback table');

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start > -1, `${name}() exists in ui.js`);
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}()`);
}

/** Run the real snippets against a fake payload and a fake document. */
function run(snippets, globals, expression) {
  const ctx = vm.createContext({ ...globals });
  vm.runInContext(snippets.join('\n'), ctx);
  return vm.runInContext(expression, ctx);
}

/* --------------------------------------------------------- payload first */

test('ui.js: the i18n payload is read and parsed before any string is used', () => {
  const nodeAt = src.indexOf("getElementById('af-i18n')");
  const parseAt = src.indexOf('JSON.parse(afNode.textContent)');
  const strAt = src.indexOf('var STR = AF.strings');

  assert.ok(nodeAt > -1, 'the af-i18n script element is read');
  assert.ok(parseAt > nodeAt, 'its JSON is parsed');
  assert.ok(strAt > parseAt, 'the strings are bound only after the parse');

  // The default, for a document that ships no payload at all, is English.
  assert.match(
    src,
    /var AF = \{ locale: 'en', prefix: '', strings: \{\} \};/,
    'the fallback payload is English with no strings',
  );

  // Nothing may reach for the payload before it has been read.
  const beforePayload = src.slice(0, nodeAt);
  assert.ok(!/AF\.strings/.test(beforePayload), 'AF.strings is not touched before the parse');
});

/* ----------------------------------------------------- no English literals */

test('ui.js: no hardcoded English chrome literal is left in the code', () => {
  // Comments are stripped first: prose about "Random" is not a string in the
  // DOM. The fallback table is allowed to be English - it is the fallback.
  const codeOnly = code.replace(/var FALLBACK = \{[\s\S]*?\n {2}\};/, 'var FALLBACK = {};');

  const banned = [
    'Theme: ', // the picker prefix used to be concatenated here
    'Random',
    'Keep playing',
    'Sort games',
    'No matches',
    'Nothing found',
    'All games',
    'Games',
  ];
  for (const phrase of banned) {
    assert.ok(
      !codeOnly.includes(phrase),
      `"${phrase}" is hardcoded in ui.js - it must come from the payload`,
    );
  }

  // The status line is assembled from payload strings only: no branch builds
  // its own prose in the source.
  assert.doesNotMatch(codeOnly, /bits\.push\(\s*['"]/);

  // The picker's label is a template, so the coat name is the only variable.
  assert.match(FALLBACK_SRC[0], /themeButton: '[^']*\{name\}'/);
  assert.match(codeOnly, /fill\(THEME_LABEL, \{ name: themeLabels\[id\] \|\| id \}\)/);
});

test('ui.js: every status string goes through the payload-or-English lookup', () => {
  for (const key of ['one', 'many', 'match', 'in', 'all', 'broken', 'page']) {
    assert.match(
      code,
      new RegExp(`str\\([^()]*'${key}'`),
      `status string "${key}" is read through str()`,
    );
  }

  // The old direct reads would render "undefined games" without a payload.
  assert.doesNotMatch(code, /\bSTR\.(one|many|match|in|all|broken|page)\b/);
  assert.doesNotMatch(code, /fill\(STR\./);

  // Every owned key has an entry in the fallback table, so str() never
  // returns undefined for a string this file actually writes.
  for (const key of OWNED) {
    assert.match(FALLBACK_SRC[0], new RegExp(`\\b${key}:`), `fallback table has "${key}"`);
  }
});

test('ui.js: theme labels drop the coat hint instead of gluing it to the name', () => {
  // `.nm` holds "<span>Signal<em>ink + lime</em></span>": the label must be
  // "Signal", which is what the server-rendered aria-label also uses.
  assert.match(code, /querySelector\('em'\)/);
  assert.doesNotMatch(code, /split\('\\n'\)/);
});

/* ------------------------------------------------ the fallback, for real */

test('ui.js: with no payload the strings read as English, never undefined', () => {
  const snippet = [FALLBACK_SRC[0], extractFunction(src, 'str')];
  const english = run(snippet, { STR: {} }, `(${JSON.stringify(OWNED)}).map(str)`);

  assert.equal(english.length, OWNED.length);
  for (const value of english) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0, 'a fallback string is never empty');
    assert.ok(!/undefined/.test(value), 'a fallback string never reads "undefined"');
  }
  assert.equal(english[0], '{count} game');
  assert.equal(english[1], '{count} games');
  assert.equal(english[7], 'Theme: {name}');
});

test('ui.js: with a payload the payload wins, per key, and only per key', () => {
  const snippet = [FALLBACK_SRC[0], extractFunction(src, 'str')];
  const fr = { one: '{count} jeu', match: 'correspondant à « {q} »' };
  assert.equal(run(snippet, { STR: fr }, "str('one')"), '{count} jeu');
  assert.equal(run(snippet, { STR: fr }, "str('match')"), 'correspondant à « {q} »');
  // A key the catalogue has not filled in falls back on its own.
  assert.equal(run(snippet, { STR: fr }, "str('many')"), '{count} games');
});

test('ui.js: the theme picker takes its wording from the page it is on', () => {
  const snippet = [FALLBACK_SRC[0], extractFunction(src, 'themeLabelTemplate')];
  const doc = (label, firstId, firstName) => ({
    STR: {},
    themeBtn: label === null ? null : { getAttribute: () => label },
    themeItems: firstId ? [{ getAttribute: () => firstId }] : [],
    themeLabels: firstId ? { [firstId]: firstName } : {},
  });

  // French page: the document renders "Thème : Signal" for the first coat.
  assert.equal(
    run(snippet, doc('Thème : Signal', 'signal', 'Signal'), 'themeLabelTemplate()'),
    'Thème : {name}',
  );
  // Arabic page, right-to-left.
  assert.equal(
    run(snippet, doc('المظهر: إشارة', 'signal', 'إشارة'), 'themeLabelTemplate()'),
    'المظهر: {name}',
  );
  // A payload that ships the template itself wins over the DOM.
  assert.equal(
    run(
      snippet,
      { ...doc('Theme: Signal', 'signal', 'Signal'), STR: { themeButton: 'المظهر: {name}' } },
      'themeLabelTemplate()',
    ),
    'المظهر: {name}',
  );
  // No markup to learn from, or none of our attributes: English, not blank.
  assert.equal(run(snippet, doc(null, null, null), 'themeLabelTemplate()'), 'Theme: {name}');
  assert.equal(run(snippet, doc('Unlabelled', null, null), 'themeLabelTemplate()'), 'Theme: {name}');
});

/* ------------------------------------------------------- built page (dist) */

test('built Arabic index: the payload it ships is the one ui.js reads', (t) => {
  const page = join(root, 'dist', 'ar', 'games', 'index.html');
  if (!existsSync(page)) return t.skip('dist/ not built yet - run npm run build');
  const html = readFileSync(page, 'utf8');

  const payload = html.match(/<script id="af-i18n" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(payload, 'the page ships an af-i18n payload');
  const af = JSON.parse(payload[1].replace(/\\u003c/g, '<'));

  assert.equal(af.locale, 'ar');
  assert.equal(af.prefix, '/ar');
  assert.equal(af.dir, 'rtl');
  for (const key of ['one', 'many', 'match', 'in', 'all', 'broken', 'page']) {
    assert.ok(typeof af.strings[key] === 'string' && af.strings[key].length, `ar payload has "${key}"`);
  }
  // Localised, not the English fallback: once the {count} placeholder is
  // removed, the Arabic count string has no Latin letters left.
  const withoutPlaceholders = af.strings.many.replace(/\{\w+\}/g, '');
  assert.ok(!/[A-Za-z]/.test(withoutPlaceholders), 'the Arabic count string is Arabic');
  assert.notEqual(af.strings.many, '{count} games');

  // The document already labels the picker in Arabic; ui.js only re-labels it
  // for another coat, so no English prefix can reach the DOM.
  assert.match(html, /id="btn-theme"[^>]*aria-label="المظهر: /);
  assert.doesNotMatch(html, /aria-label="Theme: /);
});
