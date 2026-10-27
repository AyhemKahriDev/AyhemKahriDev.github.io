/**
 * Contrast gate — every theme is a token swap, so it can be checked without a
 * browser: parse each `html[data-theme='…']` block out of public/styles.css,
 * resolve the handful of pairs that actually carry text, and assert WCAG AA.
 *
 *   node scripts/theme-contrast.mjs          # report, exit 1 on a failure
 *   node scripts/theme-contrast.mjs --all    # also print AAA misses
 *
 * A theme that fails here is not shipped: the swatch menu would offer a coat
 * nobody can read.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'public/styles.css'), 'utf8');

/* ---- parse the default :root block, then each theme override ---- */

function blockFor(selectorStart) {
  const at = css.indexOf(selectorStart);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

function tokens(text) {
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2].trim();
  return out;
}

const base = tokens(blockFor(':root {') ?? '');
const themes = { signal: {} };
const reTheme = /html\[data-theme='([a-z0-9-]+)'\]\s*\{/g;
let t;
while ((t = reTheme.exec(css))) {
  const name = t[1];
  const start = t.index;
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  themes[name] = tokens(css.slice(open + 1, close));
}

function resolve(value, scope, depth = 0) {
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(value).trim());
  if (!m || depth > 6) return value;
  const next = scope[m[1]] ?? base[m[1]];
  return next ? resolve(next, scope, depth + 1) : value;
}

/* ---- colour maths ---- */

function rgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // alpha is composited by the browser, assume on-stage
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function lum([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* ---- the pairs that carry text ---- */

const PAIRS = [
  ['--paper', '--ink', 4.5, 'body on stage'],
  ['--paper-2', '--ink', 4.5, 'secondary text on stage'],
  ['--paper-3', '--ink', 4.5, 'meta text on stage'],
  ['--paper', '--panel', 4.5, 'body on panel'],
  ['--paper-2', '--panel', 4.5, 'secondary on panel'],
  ['--paper-3', '--panel-2', 4.5, 'meta on raised panel'],
  ['--signal-ink', '--signal', 4.5, 'text on a signal button'],
  ['--signal-text', '--ink', 4.5, 'signal text on stage'],
  ['--signal-text', '--panel', 4.5, 'signal text on panel'],
  ['--coin-ink', '--coin', 4.5, 'text on a coin button'],
  ['--coin-text', '--ink', 4.5, 'coin text on stage'],
  ['--paper', '--panel-2', 4.5, 'body on raised panel'],
];

const verbose = process.argv.includes('--all');
let failures = 0;
let checks = 0;

for (const [name, scope] of Object.entries(themes)) {
  const merged = { ...scope };
  const rows = [];
  for (const [fgKey, bgKey, min, label] of PAIRS) {
    const fg = resolve(merged[fgKey] ?? base[fgKey], merged);
    const bg = resolve(merged[bgKey] ?? base[bgKey], merged);
    const a = rgb(fg);
    const b = rgb(bg);
    if (!a || !b) continue; // a token this theme leaves alone and that is not a flat colour
    checks++;
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) {
      failures++;
      rows.push(`  FAIL ${label.padEnd(30)} ${fgKey} on ${bgKey} = ${r.toFixed(2)}:1 (needs ${min})`);
    } else if (verbose) {
      rows.push(`  ok   ${label.padEnd(30)} ${r.toFixed(2)}:1`);
    }
  }
  const bad = rows.filter((r) => r.includes('FAIL'));
  const head = `${bad.length ? 'FAIL' : 'ok  '} ${name} (${(base && scope ? Object.keys(scope).length : 0)} tokens)`;
  console.log(head);
  (bad.length ? bad : verbose ? rows : []).forEach((r) => console.log(r));
}

console.log(`\n${checks} pairs checked across ${Object.keys(themes).length} themes, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
