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

/**
 * A category with one glyph per game produces a wall of identical icons
 * once a category has 110 entries. Each pool keeps the category legible
 * while the id hash picks the variant, so neighbours differ.
 */
const CAT_GLYPH_POOL = {
  word: ['a-word', 'a-search', 'a-puzzle'],
  puzzle: ['a-puzzle', 'a-grid', 'a-blocks', 'a-spark'],
  arcade: ['a-pad', 'a-play', 'a-bolt', 'a-dice'],
  brain: ['a-bulb', 'a-grid', 'a-spark', 'a-shield'],
  strategy: ['a-flag', 'a-shield', 'a-grid'],
  sandbox: ['a-blocks', 'a-grid', 'a-bolt'],
};

const GLYPH_DEFAULT = 'a-spark';

/**
 * Sprite glyph per hand-drawn game, for client-side re-renders (ui.js
 * recently-played rows) that build tiles from the shared sprite instead of
 * shipping inline SVG. Keep in sync with ui.js GAME_GLYPHS.
 */
export const CLIENT_SPECIAL = {
  wordsearch: 'a-search',
  merge: 'a-merge',
  snake: 'a-snake',
  memory: 'a-memory',
  trust: 'a-trust',
  loopy: 'a-loopy',
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
export const SPECIAL_IDS = new Set(['wordsearch', 'merge', 'snake', 'memory', 'trust', 'loopy', 'answers']);

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
<linearGradient id="af-sheen" x1="0" y1="0" x2="0.6" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
  <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
</defs>
<symbol id="a-mark" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="9" fill="currentColor"/>
  <g fill="none" stroke="#0b1000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 26V16"/>
    <path d="M16 16c0-3.6-2.6-4.8-5.5-4.8M16 16c0-3.6 2.6-4.8 5.5-4.8"/>
  </g>
  <circle cx="10.5" cy="11.2" r="1.9" fill="#0b1000"/>
  <circle cx="21.5" cy="11.2" r="1.9" fill="#0b1000"/>
</symbol>
<symbol id="a-sun" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="12" cy="12" r="4.2"/>
  <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>
</g></symbol>
<symbol id="a-moon" viewBox="0 0 24 24"><path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.5 8.5 0 1 0 10.6 10.6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="a-arrow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h15M13.5 6l6 6-6 6"/></g></symbol>
<symbol id="a-check" viewBox="0 0 24 24"><path d="M4.5 12.8l4.6 4.4L19.5 6.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="a-bolt" viewBox="0 0 24 24"><path d="M13.6 2.5 4.8 13.4h6L10.4 21.5 19.2 10.6h-6l.4-8.1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="a-shield" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.8 4.8 5.6v6c0 4.4 3 8 7.2 9.6 4.2-1.6 7.2-5.2 7.2-9.6v-6L12 2.8Z"/><path d="M8.8 12.2l2.4 2.4 4-4.4" stroke-linecap="round"/></g></symbol>
<symbol id="a-wifi-off" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5.5 20.5 19"/><path d="M5.2 9.6a14 14 0 0 1 4.1-2.1M14.8 7.7a14 14 0 0 1 4 1.9M8.6 13.1a9 9 0 0 1 2.5-1.2M15.8 12.6c.6.3 1.1.6 1.6 1M12 17.4v.1"/></g></symbol>
<symbol id="a-expand" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"/></g></symbol>
<symbol id="a-restart" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4h4"/></g></symbol>
<symbol id="a-sound" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3L12 5v14L7 14.5H4v-5Z"/><path d="M16 9a4.2 4.2 0 0 1 0 6"/><path d="M18.8 6.4a8 8 0 0 1 0 11.2"/></g></symbol>
<symbol id="a-muted" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3L12 5v14L7 14.5H4v-5Z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></g></symbol>
<symbol id="a-coin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6v8.8M9.6 10.2h3.6a1.9 1.9 0 1 1 0 3.8H9.6" stroke-linecap="round"/></g></symbol>
<symbol id="a-grid" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.2" y="3.2" width="7" height="7" rx="1.8"/><rect x="13.8" y="3.2" width="7" height="7" rx="1.8"/><rect x="3.2" y="13.8" width="7" height="7" rx="1.8"/><rect x="13.8" y="13.8" width="7" height="7" rx="1.8"/></g></symbol>
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
<symbol id="a-trust" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="8" height="8" rx="2"/>
  <rect x="13" y="3" width="8" height="8" rx="2"/>
  <rect x="3" y="13" width="8" height="8" rx="2"/>
  <path d="M5.6 7l1.6 1.6 2.6-3"/>
  <path d="M15.2 15.2l3.6 3.6"/>
  <path d="M18.8 15.2l-3.6 3.6"/>
</g></symbol>
<symbol id="a-loopy" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5"/>
  <path d="M11.4 2.7l3.9-1.7.1 4.2Z" fill="currentColor" stroke="none"/>
  <circle cx="19.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>
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
    `<svg viewBox="0 0 96 96" width="72" height="72" role="img" aria-hidden="true" class="gicon-svg">` +
    `<rect x="0" y="0" width="96" height="96" rx="22" fill="#101316"/>` +
    `<rect x="0" y="0" width="96" height="96" rx="22" fill="${a}" opacity="0.16"/>` +
    `<rect x="0" y="0" width="96" height="96" rx="22" fill="url(#af-sheen)"/>` +
    `${inner}</svg>`;

  if (id === 'wordsearch') {
    // A 4x4 grid of letters with one word highlighted horizontally.
    const letters = 'CATSDOGSSUNSRAYS';
    let cells = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const on = r === 0;
        const ch = letters[r * 4 + c];
        cells += `<rect x="${8 + c * 20}" y="${8 + r * 20}" width="18" height="18" rx="4" fill="${
          on ? a : '#191d21'
        }"/>`;
        cells += `<text x="${17 + c * 20}" y="${22 + r * 20}" font-size="11" font-family="${FONT}" font-weight="700" fill="${
          on ? '#08090a' : '#8a867d'
        }" text-anchor="middle">${ch}</text>`;
      }
    }
    return wrap(cells);
  }
  if (id === 'merge') {
    return wrap(
      `<rect x="8" y="8" width="38" height="38" rx="8" fill="${a}"/>
       <rect x="50" y="8" width="38" height="38" rx="8" fill="#191d21"/>
       <rect x="8" y="50" width="38" height="38" rx="8" fill="#191d21"/>
       <rect x="50" y="50" width="38" height="38" rx="8" fill="${a}" opacity="0.5"/>
       <text x="27" y="35" font-size="22" font-family="${FONT}" font-weight="800" fill="#08090a" text-anchor="middle">2</text>
       <text x="69" y="35" font-size="22" font-family="${FONT}" font-weight="800" fill="#f6f3eb" text-anchor="middle">8</text>`,
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
      `<rect x="8" y="14" width="38" height="52" rx="10" fill="#191d21"/>
       <circle cx="27" cy="40" r="7" fill="${a}" opacity="0.55"/>
       <rect x="38" y="24" width="46" height="60" rx="11" fill="${a}"/>
       <text x="61" y="66" font-size="34" font-family="${FONT}" font-weight="800" fill="#08090a" text-anchor="middle">?</text>`,
    );
  }
  if (id === 'trust') {
    // The Evolution of Trust: a 2x2 payoff matrix — mutual win highlighted,
    // betrayal cells marked, mutual defection crossed out.
    const cell = (x, y, fill) =>
      `<rect x="${x}" y="${y}" width="38" height="38" rx="9" fill="${fill}"/>`;
    const ok = (x, y, c, w) =>
      `<path d="M${x + 8} ${y + 20}l5 5 9 -10" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const no = (x, y, c, w) =>
      `<g stroke="${c}" stroke-width="${w}" stroke-linecap="round"><path d="M${x + 11} ${y + 13}l14 14M${x + 25} ${y + 13}l-14 14"/></g>`;
    return wrap(
      cell(6, 6, a) + ok(6, 6, '#08090a', 5) +
      cell(52, 6, '#191d21') + ok(52, 6, a, 4) + no(64, 6, '#8a867d', 4) +
      cell(6, 52, '#191d21') + ok(8, 50, a, 4) + no(20, 52, '#8a867d', 4) +
      cell(52, 52, '#191d21') + no(56, 56, '#ff5470', 5),
    );
  }
  if (id === 'loopy') {
    // Loopy: a feedback loop — big arc, arrowhead, stock node on the ring.
    return wrap(
      `<path d="M48 12a36 36 0 1 0 36 36" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/>
       <path d="M43 6.5l16-4.4-1 16.5Z" fill="${a}"/>
       <circle cx="84" cy="48" r="9" fill="#08090a" opacity="0.35"/>
       <circle cx="84" cy="48" r="5.5" fill="${a}"/>
       <circle cx="48" cy="48" r="7" fill="${a}" opacity="0.28"/>`,
    );
  }
  if (id === 'answers') {
    return wrap(
      `<rect x="0" y="0" width="96" height="96" rx="20" fill="${a}"/>
       <text x="48" y="70" font-size="52" font-family="${FONT}" font-weight="800" fill="#08090a" text-anchor="middle">?</text>`,
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
  const pool = CAT_GLYPH_POOL[category];
  const sym = pool ? pool[hueForId(id + '|sym') % pool.length] : GLYPH_DEFAULT;
  const grad = gid(id);
  return `<svg viewBox="0 0 96 96" width="72" height="72" role="img" aria-hidden="true" class="gicon-svg">
  <defs><linearGradient id="${grad}" ${axis}>
    <stop offset="0" stop-color="hsl(${h1} 72% 54%)"/>
    <stop offset="1" stop-color="hsl(${h2} 76% 38%)"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#${grad})"/>
  <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#af-sheen)"/>
  <use href="#${sym}" x="21" y="21" width="54" height="54"/>
</svg>`;
}

/** Small inline chrome icon (buttons etc.) referencing the sprite. */
export function glyph(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" class="af-glyph"><use href="#${name}"/></svg>`;
}

/** The identity mark: a path that forks. Lime tile, ink glyph. */
export function brandMark(size = 30) {
  return `<svg class="mark" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><use href="#a-mark"/></svg>`;
}

export default { gameIcon, iconSprite, glyph, huePair, hueFromHex, CAT_GLYPH };
