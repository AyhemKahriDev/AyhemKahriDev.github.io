/**
 * RTL / Arabic guard rails.
 *
 * These read the stylesheets as text on purpose: no browser, no jsdom, no
 * dependency. The site is a static arcade whose CSS is hand-written, so the
 * failure mode we care about is not "a computed value is 3px off" but "someone
 * added a physical left/right rule that silently breaks the Arabic pages, or
 * dropped the Arabic face and the /ar/ tree fell back to a serif".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const fonts = readFileSync(new URL('../public/fonts.css', import.meta.url), 'utf8');

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The RTL work lives between two sentinels so this test can tell "a physical
 * property used as an override" apart from "a physical property in the shared
 * LTR path". If you move the block, move the sentinels with it.
 */
const RTL_BEGIN = '==== RTL BEGIN ====';
const RTL_END = '==== RTL END ====';

const rtlBlock = (() => {
  const start = styles.indexOf(RTL_BEGIN);
  const end = styles.indexOf(RTL_END);
  if (start === -1 || end === -1 || end < start) return '';
  return strip(styles.slice(start, end));
})();

const arabicBlock = (() => {
  const start = styles.indexOf('==== Arabic typography BEGIN ====');
  const end = styles.indexOf('==== Arabic typography END ====');
  if (start === -1 || end === -1 || end < start) return '';
  return strip(styles.slice(start, end));
})();

/** Every physical margin-left / margin-right in a chunk of CSS. */
const physicalMargins = (css) => [...strip(css).matchAll(/margin-(left|right)\s*:/g)];

/** All @font-face blocks in a stylesheet, as raw text. */
const fontFaces = (css) =>
  [...strip(css).matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);

test('an Arabic @font-face ships with the site and covers U+0600-06FF', () => {
  const arabic = fontFaces(fonts).filter((b) => /unicode-range:\s*[^;]*U\+06/i.test(b));
  assert.ok(arabic.length > 0, 'no @font-face declares an Arabic unicode-range');

  for (const face of arabic) {
    // The committed file, not a Google Fonts URL: the site must not call out
    // to a third party for type.
    const src = face.match(/src:\s*url\('([^']+\.woff2)'\)/);
    assert.ok(src, `Arabic face without a local .woff2 src:\n${face}`);
    assert.ok(
      src[1].startsWith('/fonts/noto-sans-arabic-'),
      `Arabic face should point at the committed Noto Sans Arabic subset, got ${src[1]}`,
    );
    assert.match(face, /font-display:\s*swap/, 'Arabic face needs font-display: swap');
    // Covered blocks: the Arabic block itself plus the presentation forms that
    // carry the shaped glyphs a text node may resolve to.
    for (const range of ['U+0600-06FF', 'U+0750-077F', 'U+08A0-08FF', 'U+FB50-FDFF', 'U+FE70-FEFF']) {
      assert.ok(face.includes(range), `Arabic face is missing unicode-range ${range}`);
    }
    // And the file has to be on disk, otherwise the swap never happens.
    const file = new URL(`../public${src[1]}`, import.meta.url);
    assert.ok(statSync(file).size > 4000, `${src[1]} is missing or truncated`);
  }
});

test('a [dir="rtl"] block exists and is delimited by its sentinels', () => {
  assert.ok(rtlBlock, 'the RTL section sentinels are gone; the block cannot be audited');
  assert.match(rtlBlock, /\[dir=['"]rtl['"]\]/, 'no [dir="rtl"] selector in the RTL block');
  assert.ok(rtlBlock.length > 400, 'the RTL block is suspiciously small');
});

test('nothing inside the RTL block floats left or right', () => {
  const floats = [...rtlBlock.matchAll(/float\s*:\s*(left|right)/g)];
  assert.deepEqual(floats.map((m) => m[0]), [], 'floats are not direction-aware; use flex/grid');
});

test('LTR stays free of physical margins, and the count did not grow', () => {
  // Before Arabic support there were exactly three physical margins:
  // .theme-item::after, .embed-open and .embed-actions. All three are logical
  // now, so zero is both the "did not grow" and the "nothing new outside RTL"
  // assertion.
  const BASELINE = 3;

  // Everything except the RTL block is the shared path: it must not carry a
  // physical margin at all, because that is what breaks the other direction.
  const outside = physicalMargins([styles.slice(0, styles.indexOf(RTL_BEGIN)), styles.slice(styles.indexOf(RTL_END))].join('\n'));
  assert.deepEqual(
    outside.map((m) => m[0]),
    [],
    'physical margin-left/margin-right in the shared path — use margin-inline-*',
  );

  const total = physicalMargins(styles).length;
  assert.ok(total <= BASELINE, `physical margin count grew: ${total} (baseline ${BASELINE})`);
});

test('the HUD, the canvas and iframes are pinned to direction: ltr', () => {
  const shared = strip(styles);
  // Declared once, for both directions, so an Arabic page cannot mirror a
  // score or a game surface.
  const ltrRule = shared.match(/(^|\})\s*([^{}]*\{[^{}]*direction:\s*ltr[^{}]*\})/g) || [];
  const selectors = ltrRule.map((r) => r.slice(r.indexOf('}') + 1, r.indexOf('{'))).join(',');
  for (const target of ['.hud', '.stage', 'canvas', 'iframe']) {
    assert.ok(selectors.includes(target), `direction: ltr is not declared for ${target}`);
  }
});

test('Arabic pages get the Arabic family, Latin pages get the Latin family', () => {
  assert.match(
    arabicBlock,
    /\[lang=['"]ar['"]\][^{]*\{[^}]*Noto Sans Arabic/,
    'no [lang="ar"] rule names Noto Sans Arabic',
  );
  // Latin must survive inside Arabic pages: the Arabic face is first in the
  // stack but its subset has no Latin glyphs, so the Latin faces still win
  // per character.
  for (const latin of ['Bricolage Grotesque', 'Outfit', 'Geist Mono']) {
    assert.ok(arabicBlock.includes(latin), `the Arabic stack drops ${latin} for Latin text`);
  }
  // Arabic is cursive: tracking pulls the joins apart, so it has to be reset.
  assert.match(arabicBlock, /letter-spacing:\s*normal/, 'letter-spacing is not reset for Arabic');
});

test('the stylesheet is still structurally sane', () => {
  const open = (styles.match(/\{/g) || []).length;
  const close = (styles.match(/\}/g) || []).length;
  assert.equal(open, close, 'unbalanced braces in public/styles.css');
  assert.ok(!/;\s*;/.test(strip(styles)), 'stray double semicolon');

  const openF = (fonts.match(/\{/g) || []).length;
  const closeF = (fonts.match(/\}/g) || []).length;
  assert.equal(openF, closeF, 'unbalanced braces in public/fonts.css');
});
