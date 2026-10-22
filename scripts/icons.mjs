/**
 * arcadefork icon system.
 *
 * Every game gets a deterministic icon: a two-hue gradient tile (hashed from
 * the game's id/accent) with a category glyph on top. Four hand-drawn icons
 * (wordsearch, merge, snake, memory) cover the original engine games.
 *
 * Server-side: build-site.mjs injects `iconSprite()` once per page (the
 * <symbol> defs shared by every `<use>` reference) and calls `gameIcon()`
 * per tile. Client-side: ui.js re-renders recently-played tiles using the
 * same sprite, so it must stay in sync with clients' expectation.
 */

export const CAT_GLYPH = {
  word: 'a-word',
  puzzle: 'a-puzzle',
  arcade: 'a-pad',
  brain: 'a-bulb',
  strategy: 'a-flag',
  sandbox: 'a-blocks',
};

const GLYPH_DEFAULT = 'a-spark';

/** Symbols for categories without a hand-drawn 96px special. */
const CLIENT_SPECIAL = {
  wordsearch: 'a-search',
  merge: 'a-merge',
  snake: 'a-snake',
  memory: 'a-memory',
};

/** Hex accent -> hue. Used so tile accents and icon gradients agree. */
export function hueFromHex(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full.length === 6 ? full : '2fe6ff', 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
  }
  return ((hue * 60) % 360 + 360) % 360;
}

/** [h, h2] pair for the gradient: second hue rotated for contrast. */
export function huePair(accent) {
  const h = Math.round(hueFromHex(accent));
  return [h, (h + 42) % 360];
}

/** Stable djb2 string hash -> hue. Spreads games across the color wheel. */
export function hueForId(id) {
  let x = 5381;
  const s = String(id);
  for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x % 360;
}

/** Ids with hand-drawn art that keeps their curated accent color. */
export const SPECIAL_IDS = new Set(['wordsearch', 'merge', 'snake', 'memory', 'answers']);

/**
 * The tile accent/glow color for a game. Hand-drawn tiles keep their
 * curated accent; everything else gets a deterministic hue from the id so
 * the grid never collapses into one color family.
 */
export function tileAccent(game) {
  if (SPECIAL_IDS.has(game.id)) return game.accent || '#2fe6ff';
  return `hsl(${hueForId(game.id)} 80% 64%)`;
}

/** Gradient axis variants so same-glyph neighbours still differ. */
const GRADIENT_AXES = [
  'x1="0" y1="0" x2="0.85" y2="1"',
  'x1="0" y1="1" x2="1" y2="0"',
  'x1="0" y1="0" x2="1" y2="0.4"',
  'x1="0" y1="0" x2="0.35" y2="1"',
];

const gid = (id) => 'gx-' + String(id).toLowerCase().replace(/[^a-z0-9-]/g, '');

/** Shared defs every page needs once, right after <body>. */
export function iconSprite() {
  return `<svg class="af-sprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
<defs>
<pattern id="af-scan" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
  <rect x="0" y="2.6" width="4" height="1" fill="#06060c" opacity="0.38"/>
</pattern>
<linearGradient id="af-sheen" x1="0" y1="0" x2="0.85" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.36"/>
  <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.06"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
</defs>
<symbol id="a-pad" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7.4 7h9.2c2.3 0 3.9 1.7 4.5 4.2.5 2.2.9 4.9.7 6.4-.2 1.6-1.4 2.6-3 2.6-1.4 0-2.4-.8-3.2-2l-.8-1.2H9.2l-.8 1.2c-.8 1.2-1.8 2-3.2 2-1.6 0-2.8-1-3-2.6-.2-1.5.2-4.2.7-6.4C3.5 8.7 5.1 7 7.4 7Z"/>
  <path d="M7 10.6v4M5 12.6h4"/>
  <circle cx="15.4" cy="11.2" r="1" fill="currentColor" stroke="none"/>
  <circle cx="18" cy="13.8" r="1" fill="currentColor" stroke="none"/>
</g></symbol>
<symbol id="a-puzzle" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="8" height="8" rx="2"/>
  <rect x="13" y="3" width="8" height="8" rx="2"/>
  <rect x="3" y="13" width="8" height="8" rx="2"/>
  <circle cx="17" cy="17" r="4"/>
</g></symbol>
<symbol id="a-word" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2.5" y="2.5" width="19" height="19" rx="5"/>
  <text x="12" y="16.4" text-anchor="middle" font-size="10.5" font-family="Outfit, ui-sans-serif, system-ui, sans-serif" font-weight="800" fill="currentColor" stroke="none">Aa</text>
</g></symbol>
<symbol id="a-bulb" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3a6 6 0 0 1 3.9 10.6c-.8.7-1.3 1.5-1.5 2.4h-4.8c-.2-.9-.7-1.7-1.5-2.4A6 6 0 0 1 12 3Z"/>
  <path d="M9.6 19.5h4.8M10.9 22h2.2"/>
</g></symbol>
<symbol id="a-flag" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 21V4"/>
  <path d="M5 4.5h12.6l-2.6 3.9 2.6 3.9H5"/>
</g></symbol>
<symbol id="a-blocks" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.6"/>
  <rect x="13" y="13.5" width="7.5" height="7" rx="1.6"/>
  <rect x="8.25" y="4" width="7.5" height="7" rx="1.6"/>
</g></symbol>
<symbol id="a-dice" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/>
  <circle cx="8.3" cy="8.3" r="1.35" fill="currentColor" stroke="none"/>
  <circle cx="15.7" cy="8.3" r="1.35" fill="currentColor" stroke="none"/>
  <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/>
  <circle cx="8.3" cy="15.7" r="1.35" fill="currentColor" stroke="none"/>
  <circle cx="15.7" cy="15.7" r="1.35" fill="currentColor" stroke="none"/>
</g></symbol>
<symbol id="a-play" viewBox="0 0 24 24">
  <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" stroke="none"/>
</symbol>
<symbol id="a-spark" viewBox="0 0 24 24">
  <path d="M12 3l2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1Z" fill="currentColor" stroke="none"/>
</symbol>
<symbol id="a-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="10.5" cy="10.5" r="6.5"/>
  <path d="M15.3 15.3 21 21"/>
  <path d="M8.2 9.2v3.4M10.5 9.2v3.4M12.8 9.2v3.4" stroke-width="1.4"/>
</g></symbol>
<symbol id="a-merge" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 4.5 10 10.5V7M10 10.5H6.5"/>
  <path d="M20 4.5 14 10.5V7M14 10.5h3.5"/>
  <path d="M4 19.5 10 13.5v3.5M10 13.5H6.5"/>
  <path d="M20 19.5 14 13.5v3.5M14 13.5h3.5"/>
</g></symbol>
<symbol id="a-snake" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18.5 4.5h-10a3.5 3.5 0 0 0 0 7h7.5a3.5 3.5 0 0 1 0 7h-11"/>
</g></symbol>
<symbol id="a-memory" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4.5" width="10" height="14" rx="2.5"/>
  <rect x="10.5" y="6.5" width="10.5" height="13.5" rx="2.5"/>
  <path d="M15.75 15.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z" stroke-width="1.5"/>
</g></symbol>
</svg>`;
}

/** Font stack used inside tiles. */
const FONT = 'Outfit, ui-sans-serif, system-ui, sans-serif';

/**
 * Hand-drawn 96px icons for the original engine games (and the daily
 * answers tile). These are self-contained: no sprite `<use>` references,
 * so they also work inside the itch.io bundle.
 */
function specialIcon(id, accent) {
  const a = accent || '#2fe6ff';
  const wrap = (inner) =>
    `<svg viewBox="0 0 96 96" width="72" height="72" role="img" aria-hidden="true" class="gicon-svg">${inner}</svg>`;

  if (id === 'wordsearch') {
    // A 4x4 grid of letters with one word highlighted horizontally.
    const letters = 'CATSDOGSSUNSRAYS';
    let cells = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const on = r === 0;
        const ch = letters[r * 4 + c];
        cells += `<rect x="${8 + c * 20}" y="${8 + r * 20}" width="18" height="18" rx="4" fill="${
          on ? a : '#1b2440'
        }"/>`;
        cells += `<text x="${17 + c * 20}" y="${22 + r * 20}" font-size="11" font-family="${FONT}" font-weight="700" fill="${
          on ? '#080c16' : '#8c96bc'
        }" text-anchor="middle">${ch}</text>`;
      }
    }
    return wrap(cells);
  }
  if (id === 'merge') {
    return wrap(
      `<rect x="8" y="8" width="38" height="38" rx="8" fill="${a}"/>
       <rect x="50" y="8" width="38" height="38" rx="8" fill="#1b2440"/>
       <rect x="8" y="50" width="38" height="38" rx="8" fill="#1b2440"/>
       <rect x="50" y="50" width="38" height="38" rx="8" fill="${a}" opacity="0.5"/>
       <text x="27" y="35" font-size="22" font-family="${FONT}" font-weight="800" fill="#080c16" text-anchor="middle">2</text>
       <text x="69" y="35" font-size="22" font-family="${FONT}" font-weight="800" fill="#e9edff" text-anchor="middle">8</text>`,
    );
  }
  if (id === 'snake') {
    return wrap(
      `<rect x="14" y="14" width="18" height="18" rx="6" fill="${a}"/>
       <rect x="34" y="14" width="18" height="18" rx="6" fill="${a}" opacity="0.75"/>
       <rect x="54" y="14" width="18" height="18" rx="6" fill="${a}" opacity="0.5"/>
       <rect x="54" y="34" width="18" height="18" rx="6" fill="${a}" opacity="0.35"/>
       <circle cx="30" cy="60" r="7" fill="#ff8fb3"/>`,
    );
  }
  if (id === 'memory') {
    return wrap(
      `<rect x="8" y="14" width="38" height="52" rx="10" fill="#1b2440"/>
       <circle cx="27" cy="40" r="7" fill="${a}" opacity="0.55"/>
       <rect x="38" y="24" width="46" height="60" rx="11" fill="${a}"/>
       <text x="61" y="66" font-size="34" font-family="${FONT}" font-weight="800" fill="#080c16" text-anchor="middle">?</text>`,
    );
  }
  if (id === 'answers') {
    return wrap(
      `<rect x="0" y="0" width="96" height="96" rx="20" fill="${a}"/>
       <text x="48" y="70" font-size="52" font-family="${FONT}" font-weight="800" fill="#080c16" text-anchor="middle">?</text>`,
    );
  }
  return null;
}

/**
 * The icon for a game tile: gradient rounded tile + category glyph.
 * `id`/`accent`/`category` come straight from the game entry.
 */
export function gameIcon(id, accent, category) {
  const special = specialIcon(id, accent);
  if (special) return special;

  const [h1, h2] = [hueForId(id), (hueForId(id) + 42) % 360];
  const axis = GRADIENT_AXES[hueForId(id + '|g') % GRADIENT_AXES.length];
  const sym = category && CAT_GLYPH[category] ? CAT_GLYPH[category] : GLYPH_DEFAULT;
  const grad = gid(id);
  return `<svg viewBox="0 0 96 96" width="72" height="72" role="img" aria-hidden="true" class="gicon-svg">
  <defs><linearGradient id="${grad}" ${axis}>
    <stop offset="0" stop-color="hsl(${h1} 76% 56%)"/>
    <stop offset="1" stop-color="hsl(${h2} 84% 40%)"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="96" height="96" rx="20" fill="url(#${grad})"/>
  <rect x="0" y="0" width="96" height="96" rx="20" fill="url(#af-sheen)"/>
  <rect x="0" y="0" width="96" height="96" rx="20" fill="url(#af-scan)"/>
  <use href="#${sym}" x="21" y="21" width="54" height="54"/>
</svg>`;
}

/** Small inline chrome icon (buttons etc.) referencing the sprite. */
export function glyph(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" class="af-glyph"><use href="#${name}"/></svg>`;
}

export default { gameIcon, iconSprite, glyph, huePair, hueFromHex, CAT_GLYPH };
