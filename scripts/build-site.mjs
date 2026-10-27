/**
 * Static site builder for arcadefork.
 *
 * Runs after `vite build` and writes the HTML into dist/.
 * Everything is deterministic: same inputs -> same output, so the nightly
 * rebuild only adds new pages instead of churning URLs.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, cpSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import content from '../content/games.json' with { type: 'json' };
import generated from '../content/games.generated.json' with { type: 'json' };
import sponsors from '../content/sponsors.json' with { type: 'json' };
import { gameShell, embedShell } from './shell.mjs';
import { gameIcon, iconSprite, glyph, brandMark, tileAccent } from './icons.mjs';
import { cleanTagline, creditLicence } from './content-utils.mjs';
import { sanitizeHtml } from './sanitize-embed.mjs';
import {
  generateWordBoard,
  boardAnswers,
  dateSeed,
  todayISO,
  addDays,
} from '../src/shared/daily.js';
import { themeForDate } from '../src/shared/wordlists.js';
import { createHash } from 'node:crypto';

/** All .html files under a directory (used to sanitise vendored pages). */
function htmlFilesIn(dir, depth = 0) {
  const out = [];
  if (depth > 3) return out;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFilesIn(p, depth + 1));
    else if (/\.html?$/i.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Content hash for /styles.css and /ui.js.
 *
 * Without a version the browser keeps the previous stylesheet for up to a
 * week (the CDN sends max-age=604800), so a deploy can serve new HTML with
 * last week's CSS - that is how the ticker once rendered as a wall of text.
 * The query string changes whenever the file changes, so every deploy is
 * picked up immediately.
 */
let assetVersion = '0';
/**
 * The hashed filename of the game bundle that vite just emitted, e.g.
 * `assets/host.a1b2c3d4.js`. Discovered rather than assumed: the entry is
 * content-hashed, so a hardcoded name would 404 after the first deploy that
 * changes the engine.
 */
let hostBundle = '/assets/host.js';
function findHostBundle() {
  const dir = join(dist, 'assets');
  if (!existsSync(dir)) return hostBundle;
  const hit = readdirSync(dir).find((f) => /^host\.[A-Za-z0-9_-]+\.js$/.test(f));
  if (hit) {
    hostBundle = `/assets/${hit}`;
    // Keep a copy at the old fixed path for the transition: a visitor whose
    // HTML is still in the HTTP cache asks for /assets/host.js, and this
    // deploy no longer ships that name. The copy revalidates on every load
    // (public/_headers), while the hashed original stays immutable.
    try {
      copyFileSync(join(dir, hit), join(dir, 'host.js'));
    } catch {
      /* the copy is a courtesy, not a requirement */
    }
  } else if (existsSync(join(dir, 'host.js'))) hostBundle = '/assets/host.js';
  return hostBundle;
}

/**
 * Version the offline cache with the deploy.
 *
 * The cache name used to be fixed, so a returning visitor kept the first
 * stylesheet and ui.js they ever saw until the service worker happened to
 * refresh them - and the stale entries were never evicted. Tying the name to
 * the asset hash makes each deploy a new cache, and activate() deletes the
 * rest.
 */
function versionServiceWorker() {
  const file = join(dist, 'sw.js');
  if (!existsSync(file)) return;
  const src = readFileSync(file, 'utf8');
  const out = src.replace(/__AF_VERSION__/g, assetVersion);
  if (out !== src) writeFileSync(file, out);
}

/**
 * Write dist/_headers: the committed file plus one generated, exact rule for
 * the hashed game bundle.
 *
 * The bundle's name is only known after vite runs, and a wildcard will not do:
 * Cloudflare merges every rule whose path matches, and `/assets/host.*.js`
 * matches `/assets/host.js` as well, which produced a single header reading
 * `max-age=0, must-revalidate, max-age=31536000, immutable` on the live site -
 * both policies at once.
 */
function writeHeaders() {
  const src = join(root, 'public/_headers');
  if (!existsSync(src)) return;
  const base = readFileSync(src, 'utf8').trimEnd();
  const hashed = hostBundle === '/assets/host.js' ? '' : hostBundle;
  const generated = hashed
    ? `\n\n# Generated: the content-hashed game bundle (see scripts/build-site.mjs).\n${hashed}\n  Cache-Control: public, max-age=31536000, immutable\n`
    : '';
  writeFileSync(join(dist, '_headers'), `${base}${generated}`);
}

function computeAssetVersion() {
  const parts = [];
  for (const f of ['public/styles.css', 'public/ui.js', 'public/play.js']) {
    const p = join(root, f);
    if (existsSync(p)) parts.push(readFileSync(p));
  }
  const hash = createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 8);
  assetVersion = hash;
  return hash;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const SITE = content.site;

/**
 * Themes are token overrides only — same shape, spacing, motion and type.
 * The swatch is drawn from the two colours that define the coat: signal and
 * stage. Adding one here is the whole change: CSS block + this entry.
 */
const THEMES = [
  { id: 'signal', name: 'Signal', hint: 'ink + lime', sw: '#c9f94b', sw2: '#08090a' },
  { id: 'lights', name: 'Lights on', hint: 'paper', sw: '#c2f23f', sw2: '#f7f4ec' },
  { id: 'coinop', name: 'Coin-op', hint: 'amber cabinet', sw: '#ffb648', sw2: '#0d0907' },
  { id: 'ice', name: 'Ice', hint: 'cyan', sw: '#4fe3ff', sw2: '#050b12' },
  { id: 'dmg', name: 'DMG', hint: '1989 green', sw: '#9bbc0f', sw2: '#0b1410' },
  { id: 'vapor', name: 'Vapor', hint: 'hot pink', sw: '#ff6ec7', sw2: '#0d0716' },
];
/** Curated games first, then the harvested catalogue. */
const GAMES = [...content.games, ...(generated.games ?? [])];
const CATEGORIES = content.categories.filter((c) => GAMES.some((g) => g.category === c.id));

const PAST_DAYS = 30;
const FUTURE_DAYS = 7;

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const abs = (path) => new URL(path, SITE.baseUrl).href;

/**
 * The "how to play" lines of a game, as plain sentences.
 *
 * The catalogue used to hold objects where strings belong, which rendered
 * as "[object Object]" on every game page. Anything that is not a usable
 * sentence is dropped here, and a page never renders an empty list.
 */
function howToLines(game) {
  const list = Array.isArray(game.howToPlay) ? game.howToPlay : [];
  const lines = list
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  if (lines.length) return lines.slice(0, 5);
  return [
    `Open ${game.title} and follow the on-screen instructions.`,
    'Play with the keyboard, the mouse or touch - the controls are shown in the game.',
    'Score points and try to beat your best run.',
  ];
}


function write(relPath, html) {
  const file = join(dist, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function layout({
  title,
  description,
  canonical,
  head = '',
  body = '',
  bodyClass = '',
  bodyAttrs = '',
  script = '',
  jsonLd = null,
}) {
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(abs('/og.png'))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)} — ${esc(SITE.tagline)}">
<meta property="og:locale" content="en">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(abs('/og.png'))}">
<meta name="theme-color" id="meta-theme" content="#08090a">
<meta name="color-scheme" content="dark light">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts.css?v=${assetVersion}">
<link rel="stylesheet" href="/styles.css?v=${assetVersion}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script>
/* Theme before first paint: no flash, and no render-blocking request. */
(function () {
  var r = document.documentElement;
  var ok = ['signal', 'lights', 'coinop', 'ice', 'dmg', 'vapor'];
  var t = 'signal';
  try {
    var saved = localStorage.getItem('af_theme');
    if (saved && ok.indexOf(saved) !== -1) t = saved;
  } catch (e) {}
  r.setAttribute('data-theme', t);
  r.setAttribute('data-chrome', t === 'lights' ? 'light' : 'dark');
  r.classList.remove('no-js');
  r.classList.add('js');
})();
</script>
${head}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}"${bodyAttrs ? ' ' + bodyAttrs : ''}>
<a class="skip-link" href="#main">Skip to content</a>
${iconSprite()}
${body}
${script}
<script src="/ui.js?v=${assetVersion}" defer></script>
</body>
</html>`;
}

/* ---------------------------------------------------------- sponsors */

/**
 * Direct-sponsor slots. These are sold by hand - there is no ad network, no
 * approval step and no minimum spend. An empty slot falls back to promoting
 * our own catalogue.
 */
/** Ticket-stub stamp for today's date, e.g. "TODAY'S TOKEN · OCT 24". */
function ticketStamp(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const [, m, d] = date.split('-').map(Number);
  return `TODAY'S TOKEN * ${months[(m || 1) - 1]} ${d || ''}`;
}

function sponsorFor(category) {
  return (
    sponsors.slots.find(
      (s) => !s.categories || s.categories.length === 0 || s.categories.includes(category),
    ) ?? null
  );
}

function sponsorBanner(category) {
  const s = sponsorFor(category);
  if (!s) return '';
  const inner = s.image
    ? `<img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy">`
    : `<strong>${esc(s.title)}</strong><span>${esc(s.subtitle ?? '')}</span>`;
  return `<a class="sponsor" href="${esc(s.href)}" target="_blank" rel="sponsored nofollow">${inner}</a>`;
}

/**
 * Homepage slot cards. With no sponsor yet they read as open commercial
 * space — honest placeholders that sell /advertise/ to the only people who
 * would pay for them: this site's own founders and indie makers. When a
 * slot is filled in sponsors.json the real card renders instead.
 */
function advertiseSlots(count = 2) {
  const real = sponsors.slots.slice(0, count);
  const cards = real.map((s) =>
    `<a class="ad-slot ad-real" href="${esc(s.href)}" target="_blank" rel="sponsored nofollow">
      <b>${esc(s.title)}</b><span>${esc(s.subtitle ?? '')}</span><em>Sponsored</em>
    </a>`,
  );
  for (let i = real.length; i < count; i++) {
    cards.push(
      `<a class="ad-slot ad-open" href="/advertise/">
        <b>Your game here</b>
        <span>A labelled sponsor card beside one category of games — an indie game, a dev tool, a newsletter. No pop-ups, ever.</span>
        <em>Open — from $15/month</em>
      </a>`,
    );
  }
  return cards.join('');
}

/* ------------------------------------------------------------ site pages */

function siteHeader(active = '') {
  const links = [
    { href: '/games/', label: 'All games' },
    ...CATEGORIES.slice(0, 5).map((c) => ({ href: `/categories/${c.id}/`, label: c.title.replace(/ Games$/, '') })),
    { href: '/daily/', label: 'Daily' },
  ];
  const nav = links
    .map(
      (l) =>
        `<a href="${l.href}"${l.href === active ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`,
    )
    .join('');
  return `<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="arcadefork — home">${brandMark()}<span>arcade<b>fork</b></span></a>
    <nav class="site-nav" aria-label="Main">${nav}</nav>
    <div class="top-tools">
      <form class="search" action="/games/" method="get" role="search">
        ${glyph('a-search', 15)}
        <input type="search" name="q" placeholder="Search ${GAMES.length} games" aria-label="Search all games" autocomplete="off" spellcheck="false">
        <kbd>/</kbd>
      </form>
      <div class="theme-menu">
        <button class="theme-btn" id="btn-theme" type="button" aria-haspopup="menu"
                aria-expanded="false" aria-controls="theme-pop" aria-label="Theme: Signal">
          <span class="sw" aria-hidden="true"></span>
        </button>
        <div class="theme-pop" id="theme-pop" role="menu" aria-label="Theme" hidden>
          <p class="theme-pop-label">Theme</p>
          ${THEMES.map(
            (t) => `<button class="theme-item" type="button" role="menuitemradio" aria-checked="false"
              data-theme-id="${t.id}" style="--sw:${t.sw};--sw2:${t.sw2}">
              <span class="sw" aria-hidden="true"></span>
              <span class="nm">${t.name}<em>${t.hint}</em></span>
            </button>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <nav class="nav-strip" aria-label="Categories">${nav}</nav>
</header>`;
}

function siteFooter() {
  const year = new Date().getUTCFullYear();
  const thirdParty = GAMES.filter((g) => g.credit);
  const tips = sponsors.tips ?? {};
  const tipDefs = [
    ['kofi', 'Ko-fi'],
    ['githubSponsors', 'GitHub Sponsors'],
    ['patreon', 'Patreon'],
  ];
  const tipLinks = tipDefs
    .filter(([k]) => tips[k])
    .map(([k, label]) => `<a href="${esc(tips[k])}" rel="noopener nofollow" target="_blank">${label}</a>`)
    .join(' · ');
  const tipsLine = tipLinks
    ? `Like the arcade? Tips keep it free: ${tipLinks}.`
    : `Free forever — funded by sponsor slots. One is <a href="/advertise/">open right now</a>.`;
  return `<footer class="site-footer"><div class="wrap">
  <a class="brand" href="/">${brandMark(24)}<span>arcade<b>fork</b></span></a>
  <p><strong>${GAMES.length} free browser games.</strong> No download, no sign-up, no paywall — the whole arcade is one HTML file's worth of JavaScript.</p>
  <p class="foot-tips">${tipsLine}</p>
  <nav class="foot-nav" aria-label="Footer">
    <a href="/games/">All games</a>
    <a href="/daily/">Daily puzzle archive</a>
    <a href="/advertise/">Sponsor a slot</a>
    <a href="/credits/">Credits</a>
    <a href="/sitemap.xml">Sitemap</a>
  </nav>
  ${
    thirdParty.length
      ? `<p class="foot-note">Includes ${thirdParty.length} open-source games, credited on the <a href="/credits/">credits page</a>.</p>`
      : ''
  }
  <p class="copyright">&copy; ${year} Ayhem Kahri · ${esc(SITE.name)} — free to play, forever.</p>
</div></footer>`;
}

function gameTiles(ids, opts = {}) {
  const gridClass = opts.featured ? 'grid grid-featured' : 'grid';
  const start = opts.start ?? 0;
  return `<div class="${gridClass}"${opts.id ? ` id="${opts.id}"` : ''}>${ids
    .map((g, i) => {
      const cat = CATEGORIES.find((c) => c.id === g.category);
      const accent = tileAccent(g);
      const kw = [g.title, g.category, cat?.title, ...(g.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return `<a class="tile${opts.noReveal ? '' : ' reveal'}" href="/games/${g.id}/"
   data-name="${esc(g.title.toLowerCase())}" data-cat="${esc(g.category)}" data-kw="${esc(kw)}"
   style="--tile-accent:${esc(accent)};--glow:${esc(accent)};--i:${i + start}">
      <div class="thumb">${gameIcon(g.id, g.accent, g.category)}</div>
      ${g.credit ? '<span class="badge">Open source</span>' : ''}
      <h3>${esc(g.title)}</h3>
      <p>${esc(cleanTagline(g))}</p>
      ${cat ? `<span class="tag">${esc(cat.title.replace(/ Games$/, ''))}</span>` : ''}
    </a>`;
    })
    .join('')}</div>`;
}

function todayPage() {
  const today = todayISO();
  const theme = themeForDate(today, dateSeed(today));
  const board = generateWordBoard(today, theme, 10, 11);
  return { today, theme, board };
}

/**
 * Pick a spread of games rather than the raw catalogue order. The harvest
 * brought in dozens of near-duplicates ("Snake", "Snake 2D", "Snake 3D"), and
 * a homepage that shows nine snakes in a row is worse than fewer games. The
 * key is the first word of the title, so one snake, one tetris, one 2048.
 */
function diversePicks(list, n) {
  const seen = new Set();
  const out = [];
  const key = (g) =>
    String(g.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')[0] || g.id;
  for (const g of list) {
    if (out.length >= n) break;
    const k = key(g);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
  }
  for (const g of list) {
    if (out.length >= n) break;
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

/** A 10x10 teaser of today's grid with one word already found. */
function miniBoard(board) {
  const p = board.placed?.[0];
  const on = new Set();
  if (p) {
    const dr = Math.sign(p.r1 - p.r0);
    const dc = Math.sign(p.c1 - p.c0);
    const len = Math.max(Math.abs(p.r1 - p.r0), Math.abs(p.c1 - p.c0));
    for (let i = 0; i <= len; i++) on.add(`${p.r0 + dr * i},${p.c0 + dc * i}`);
  }
  let cells = '';
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      cells += `<span${on.has(`${r},${c}`) ? ' class="on"' : ''}>${esc(board.grid[r][c])}</span>`;
    }
  }
  return `<div class="mini-grid" aria-hidden="true">${cells}</div>`;
}

function buildHome() {
  const { today, theme, board } = todayPage();
  const wordCount = board.placed?.length ?? 0;
  // The originals first: they are the fastest thing to love about the site.
  // Then one game per title family, so six snake forks do not fill the grid.
  const featured = diversePicks(
    [
      ...GAMES.filter((g) => /wordsearch|merge|snake|memory|trust|loopy/.test(g.id)),
      ...GAMES,
    ].filter((g, i, a) => a.findIndex((x) => x.id === g.id) === i),
    64,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.baseUrl,
    description: SITE.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.baseUrl}/games/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const catCard = (c) => {
    const n = GAMES.filter((g) => g.category === c.id).length;
    return `<a class="cat-card" href="/categories/${c.id}/" style="--c:${esc(c.accent)}">
      <span class="cat-dot" aria-hidden="true"></span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.description)}</p>
      <span class="cat-count">${n} game${n === 1 ? '' : 's'} →</span>
    </a>`;
  };

  const body = `${siteHeader('/')}
<main id="main">
<div class="wrap">
  <section class="hero hero-split">
    <div class="hero-copy">
      <p class="kicker"><i></i>${GAMES.length} games · free forever</p>
      <h1>Free browser games that <em>start instantly</em>.</h1>
      <p class="lede">${esc(SITE.description)} Pick a game and you are playing in one second — nothing to install, nothing to unlock, no account.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/games/">Browse all ${GAMES.length} games</a>
        <button class="btn" id="btn-random" type="button">${glyph('a-dice', 18)} Play something random</button>
      </div>
      <ul class="trust">
        <li>${glyph('a-bolt', 15)} Loads in about a second</li>
        <li>${glyph('a-wifi-off', 15)} Plays offline after first visit</li>
        <li>${glyph('a-shield', 15)} No tracking, no ads that follow you</li>
      </ul>
    </div>

    <aside class="hero-card" aria-labelledby="today-card-title">
      <div class="hero-card-head">
        <h2 id="today-card-title">Today's grid</h2>
        <span class="ticket">${ticketStamp(today)}</span>
      </div>
      ${miniBoard(board)}
      <div class="hero-card-foot">
        <span class="meta">${esc(theme.title)} · ${wordCount} words · ${today}</span>
        <a class="btn btn-primary" href="/daily/${today}/" style="height:38px;padding:0 14px;font-size:13.5px">Play ${glyph('a-arrow', 15)}</a>
      </div>
    </aside>
  </section>
</div>
</main>

<section class="ticker" aria-hidden="true"><div class="ticker-track"><span class="ticker-set">${[
    'ONE NEW GRID EVERY DAY',
    `${GAMES.length} GAMES, ZERO DOWNLOADS`,
    'NO ACCOUNT, NO EMAIL, NO PAYWALL',
    'PLAYS OFFLINE AFTER FIRST LOAD',
    'MADE OF HTML, JAVASCRIPT AND NOTHING ELSE',
  ]
    .map((t) => `<b>${t}</b><i>◆</i>`)
    .join('')}</span></div></section>

<div class="wrap">
  <section class="stats-strip" aria-label="The arcade in numbers">
    <span><b>${GAMES.length}</b><i>games</i></span>
    <span><b>1</b><i>new grid daily</i></span>
    <span><b>0</b><i>accounts needed</i></span>
    <span><b>$0</b><i>forever</i></span>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Start here</h2>
      <a class="section-more" href="/games/">All ${GAMES.length} games ${glyph('a-arrow', 15)}</a>
    </div>
    ${gameTiles(featured.slice(0, 12))}
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Browse by mood</h2>
      <a class="section-more" href="/games/">Everything ${glyph('a-arrow', 15)}</a>
    </div>
    <div class="cat-grid">${CATEGORIES.map(catCard).join('')}</div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Today's puzzle</h2>
      <span class="pill"><i></i>new at midnight UTC</span>
    </div>
    <div class="grid grid-featured">
      <a class="tile" href="/daily/${today}/" style="--glow:var(--coin)">
        <div class="thumb">${gameIcon('wordsearch', theme.accent)}</div>
        <h3>Daily Word Search</h3>
        <p>${esc(theme.title)} — ${today}. Ten by ten, ${wordCount} words, 100 seconds. Everyone plays the same grid.</p>
        <span class="tag">Play today's grid</span>
      </a>
      <a class="tile" href="/daily/${today}/answers/" style="--glow:var(--coin)">
        <div class="thumb thumb-plain" style="font-size:34px">?</div>
        <h3>Today's answers</h3>
        <p>The full solved grid with every word, and a row and column for where each one starts.</p>
        <span class="tag">Look it up</span>
      </a>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>The whole cabinet</h2>
      <a class="section-more" href="/games/">See all ${GAMES.length} ${glyph('a-arrow', 15)}</a>
    </div>
    ${gameTiles(featured.slice(12, 36), { start: 6, id: 'cabinet-grid' })}
  </section>

  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>Pick up where you left off</h2>
      <span class="pill">on this device</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>

  <section class="section" id="sponsor-slots">
    <div class="section-head">
      <h2>Cabinet slots</h2>
      <a class="section-more" href="/advertise/">Advertise ${glyph('a-arrow', 15)}</a>
    </div>
    <div class="ad-grid">${advertiseSlots()}</div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Why it is free</h2>
    </div>
    <div class="feature-grid">
      <div class="feature">${glyph('a-bolt', 22)}
        <h3>Nothing to load first</h3>
        <p>Every game is plain JavaScript and canvas. No install, no engine download, no loading bar.</p>
      </div>
      <div class="feature">${glyph('a-shield', 22)}
        <h3>Nothing to sign up for</h3>
        <p>No account, no email, no cookie wall. Your scores and recents stay in your own browser.</p>
      </div>
      <div class="feature">${glyph('a-coin', 22)}
        <h3>Nothing to pay</h3>
        <p>The arcade is funded by labelled sponsor slots, not by interrupting a game you are winning.</p>
      </div>
    </div>
  </section>

  <section class="section prose">
    <h2>About arcadefork</h2>
    <p>Every game here runs entirely in your browser. The page is under a megabyte, so it starts instantly on a phone connection, and the <a href="/daily/">daily puzzle archive</a> keeps every past grid so you can look up the answers or replay an old board.</p>
    <p>${GAMES.filter((g) => g.credit).length} of the games are open source, vendored with their original licences and credited on the <a href="/credits/">credits page</a>. The rest are built on the arcadefork engine.</p>
  </section>
</div>
</main>
<script id="af-catalog-json" type="application/json">${JSON.stringify(
    GAMES.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent })),
  ).replace(/</g, '\\u003c')}</script>
${siteFooter()}`;
  write('index.html', layout({
    title: `${SITE.name} — free browser games, no download`,
    description: SITE.description,
    canonical: abs('/'),
    body,
    jsonLd,
  }));
}

function buildCategory(cat) {
  const games = GAMES.filter((g) => g.category === cat.id);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.title,
    url: abs(`/categories/${cat.id}/`),
    description: cat.description,
    hasPart: games.map((g) => ({
      '@type': 'VideoGame',
      name: g.title,
      url: abs(`/games/${g.id}/`),
      genre: cat.title,
      gamePlatform: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    })),
  };
  const body = `${siteHeader(`/categories/${cat.id}/`)}
<main class="wrap" id="main">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>/</span><a href="/games/">All games</a><span>/</span><span>${esc(cat.title)}</span>
  </nav>
  <section class="hero" style="padding-top:24px;padding-bottom:8px">
    <div>
      <p class="kicker"><i style="background:${esc(cat.accent)};box-shadow:0 0 0 4px ${esc(cat.accent)}22"></i>${games.length} free ${esc(
        cat.title.toLowerCase(),
      )}</p>
      <h1>${esc(cat.title)}</h1>
      <p class="lede">${esc(cat.description)}</p>
      <div class="hero-cta">
        <button class="btn" id="btn-random" type="button" data-scope="${esc(cat.id)}">${glyph('a-dice', 18)} Random ${esc(
          cat.title.replace(/ Games$/, '').toLowerCase(),
        )} game</button>
      </div>
    </div>
  </section>
  <section class="section">${gameTiles(games)}</section>
  <section class="section prose">
    ${sponsorBanner(cat.id)}
    <h2>More arcadefork games</h2>
    <div class="linklist">${GAMES.filter((g) => g.category !== cat.id)
      .slice(0, 24)
      .map((g) => `<a href="/games/${g.id}/">${esc(g.title)}</a>`)
      .join('')}</div>
  </section>
</main>
${siteFooter()}`;
  write(
    `categories/${cat.id}/index.html`,
    layout({
      title: `${cat.title} — free online games | ${SITE.name}`,
      description: `${cat.description} Play free ${cat.title.toLowerCase()} in your browser on ${SITE.name}.`,
      canonical: abs(`/categories/${cat.id}/`),
      body,
      jsonLd,
    }),
  );
}

function buildGamePage(game) {
  const cat = CATEGORIES.find((c) => c.id === game.category);
  const related = GAMES.filter(
    (g) => (game.related ?? []).includes(g.id) || g.category === game.category,
  )
    .filter((g) => g.id !== game.id)
    .slice(0, 6);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: game.title,
      url: abs(`/games/${game.id}/`),
      description: game.description,
      genre: cat?.title ?? 'Arcade',
      gamePlatform: 'Web Browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.baseUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: game.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    // The breadcrumb is already on the page as markup; saying the same thing
    // in structured data is what lets a result show Home › Category › Game
    // instead of a bare URL.
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
        {
          '@type': 'ListItem',
          position: 2,
          name: cat?.title ?? 'Games',
          item: abs(`/categories/${game.category}/`),
        },
        { '@type': 'ListItem', position: 3, name: game.title, item: abs(`/games/${game.id}/`) },
      ],
    },
  ];
  const isEmbed = Boolean(game.embed);
  const shellOpts = { related, sponsor: sponsorBanner(game.category) };
  const body = `${isEmbed ? embedShell(game, shellOpts) : gameShell(game, shellOpts)}
<section class="wrap prose" style="padding-bottom:48px" id="about">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>/</span><a href="/categories/${esc(game.category)}/">${esc(
      cat?.title ?? 'Games',
    )}</a><span>/</span><span>${esc(game.title)}</span>
  </nav>
  <h1 style="margin-top:18px">${esc(game.title)} — play free online</h1>
  <p>${esc(game.description)}</p>
  ${
    game.credit
      ? `<p class="credit-line">Originally by ${esc(game.credit.author)} · ${esc(creditLicence(game.credit))} licence · <a href="${esc(game.credit.source)}" rel="noopener nofollow" target="_blank">source</a></p>`
      : ''
  }
  <h2>How to play ${esc(game.title)}</h2>
  <ul>${howToLines(game).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
  <h2>Frequently asked questions</h2>
  <div class="faq">${game.faq
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('')}</div>
  <h2>More free games</h2>
  <div class="linklist">${related.map((g) => `<a href="/games/${g.id}/">${esc(g.title)}</a>`).join('')}</div>
</section>
${isEmbed ? '' : `<script type="module" src="${hostBundle}"></script>`}
<script src="/play.js?v=${assetVersion}" defer></script>`;
  write(
    `games/${game.id}/index.html`,
    layout({
      title: `${game.title} — play free online | ${SITE.name}`,
      description: game.description,
      canonical: abs(`/games/${game.id}/`),
      body,
      bodyClass: 'is-game',
      bodyAttrs: `data-game="${game.id}" data-gtitle="${esc(game.title)}" data-gcat="${esc(
        game.category,
      )}" data-gaccent="${esc(game.accent)}"`,
      script: '',
      jsonLd,
    }),
  );
}

/* ---------------------------------------------------------- daily pages */

function boardHtml(board, hits) {
  let cells = '';
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const hit = hits && hits.has(`${r},${c}`);
      cells += `<div${hit ? ' style="background:' + board.accent + ';color:#080c16"' : ''}>${esc(
        board.grid[r][c],
      )}</div>`;
    }
  }
  return `<div class="board" style="grid-template-columns:repeat(${board.size},1fr)">${cells}</div>`;
}

function buildDailyPages() {
  const today = todayISO();
  const dates = [];
  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) dates.push(addDays(today, i));

  const hubRows = [];
  for (const date of dates) {
    const theme = themeForDate(date, dateSeed(date));
    const isToday = date === today;
    hubRows.push(
      `<tr><td><a href="/daily/${date}/">${date}</a></td><td>${esc(theme.title)}</td><td><a href="/daily/${date}/answers/">answers</a></td>${
        isToday ? '<td>today</td>' : '<td></td>'
      }</tr>`,
    );
  }

  const hubBody = `${siteHeader('/daily/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">New puzzle every day</span>
    <h1>Daily Word Search archive</h1>
    <p>One new 10x10 word search every day. Everyone plays the same grid, so you can compare scores with friends or look back at a puzzle you missed.</p>
  </section>
  <section class="section">
    <table class="answer-table"><thead><tr><th>Date</th><th>Theme</th><th></th><th></th></tr></thead><tbody>${hubRows.join(
      '',
    )}</tbody></table>
  </section>
  <section class="section prose">
    <h2>How the daily puzzle works</h2>
    <p>The grid is generated from the date, which means every player gets exactly the same board at the same time. Drag across a straight line of letters to select a word — horizontally, vertically or diagonally. You have 100 seconds.</p>
  </section>
</main>
${siteFooter()}`;
  write(
    'daily/index.html',
    layout({
      title: `Daily Word Search archive — every puzzle and answer | ${SITE.name}`,
      description: `Play or look up every daily word search puzzle. A new free 10x10 grid every day with the full answer list for each one.`,
      canonical: abs('/daily/'),
      body: hubBody,
    }),
  );

  for (const date of dates) {
    const theme = themeForDate(date, dateSeed(date));
    const board = generateWordBoard(date, theme, 10, 11);
    const answers = boardAnswers(board);
    const answerWords = answers.map((a) => a.word).join(', ');

    // Puzzle page
    const puzzleBody = `${siteHeader('/daily/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${esc(theme.title)}</span>
    <h1>Daily Word Search — ${date}</h1>
    <p>Free daily word search puzzle for ${date}. 10x10 grid, ${answers.length} hidden words, 100 seconds on the clock. The same grid for every player.</p>
  </section>
  <section class="section">
    ${boardHtml(board, null)}
    <div class="row"><a class="btn btn-primary" href="/games/wordsearch/">Play the full game</a> <a class="btn" href="/daily/${date}/answers/">See the answers</a></div>
  </section>
  <section class="section prose">
    <h2>Words in the ${date} puzzle</h2>
    <p>${answers.length} words are hidden in this grid. If you are stuck, the <a href="/daily/${date}/answers/">answer page for ${date}</a> lists every word and where it starts and ends.</p>
    <h2>How to play</h2>
    <ul>
      <li>Drag across a straight line of letters — horizontal, vertical or diagonal.</li>
      <li>Release to submit. Correct words stay highlighted.</li>
      <li>100 seconds. Longer words and faster finds score more.</li>
    </ul>
    <h2>Other daily puzzles</h2>
    <div class="linklist">${dates
      .filter((d) => d !== date)
      .slice(-14)
      .reverse()
      .map((d) => `<a href="/daily/${d}/">${d}</a>`)
      .join('')}</div>
  </section>
</main>
${siteFooter()}`;
    write(
      `daily/${date}/index.html`,
      layout({
        title: `Daily Word Search ${date} — free puzzle and answers | ${SITE.name}`,
        description: `Free daily word search for ${date}. ${esc(
          theme.title,
        )} theme, ${answers.length} hidden words, 100 seconds to find them. Same grid for every player.`,
        canonical: abs(`/daily/${date}/`),
        body: puzzleBody,
      }),
    );

    // Answers page
    const hits = new Map();
    for (const p of board.placed) {
      const dr = Math.sign(p.r1 - p.r0);
      const dc = Math.sign(p.c1 - p.c0);
      const len = Math.max(Math.abs(p.r1 - p.r0), Math.abs(p.c1 - p.c0));
      for (let i = 0; i <= len; i++) hits.set(`${p.r0 + dr * i},${p.c0 + dc * i}`, true);
    }
    const hitSet = new Set(hits.keys());

    const answersBody = `${siteHeader('/daily/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${esc(theme.title)}</span>
    <h1>Daily Word Search answers — ${date}</h1>
    <p>Every word hidden in the ${date} puzzle, with the row and column where each one starts and ends. ${answers.length} words in total.</p>
  </section>
  <section class="section">
    ${boardHtml(board, hitSet)}
    <table class="answer-table"><thead><tr><th>Word</th><th>Starts (row, col)</th><th>Ends (row, col)</th></tr></thead><tbody>${answers
      .map((a) => `<tr><td><strong>${esc(a.word)}</strong></td><td>${esc(a.start)}</td><td>${esc(a.end)}</td></tr>`)
      .join('')}</tbody></table>
    <p class="prose">Words: ${esc(answerWords)}.</p>
  </section>
  <section class="section prose">
    <h2>About this puzzle</h2>
    <p>This puzzle was generated on ${date} using the ${esc(
      theme.title,
    )} word list. Every player gets the same grid, and a new one appears every day at midnight UTC. Play it free on <a href="/games/wordsearch/">arcadefork</a> or browse the <a href="/daily/">full archive</a>.</p>
  </section>
</main>
${siteFooter()}`;
    write(
      `daily/${date}/answers/index.html`,
      layout({
        title: `Word search answers for ${date} — ${answers.length} words | ${SITE.name}`,
        description: `Full answer list for the ${date} daily word search: ${esc(
          answerWords,
        )}. Solved grid and start/end positions for every word.`,
        canonical: abs(`/daily/${date}/answers/`),
        body: answersBody,
      }),
    );
  }
}

/* --------------------------------------------------------- misc + sitemap */

function buildSitemap(urls) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  write('sitemap.xml', xml);
}

function buildRobots() {
  write(
    'robots.txt',
    `User-agent: *
Allow: /

Sitemap: ${SITE.baseUrl}/sitemap.xml
`,
  );
}

/**
 * Copy the vendored third-party games into the build output.
 *
 * Only games that are listed in the catalogue are copied, so a harvest run in
 * progress can never publish a game that has not passed the browser gate.
 */
function copyThirdParty() {
  const src = join(root, 'third-party');
  if (!existsSync(src)) return 0;

  const wanted = new Set();
  for (const g of GAMES) {
    if (!g.embed) continue;
    const m = g.embed.src.match(/^\/third-party\/([^/]+)\//);
    if (m) wanted.add(m[1]);
  }

  const destRoot = join(dist, 'third-party');
  rmSync(destRoot, { recursive: true, force: true });
  mkdirSync(destRoot, { recursive: true });

  let copied = 0;
  const fixups = { refresh: 0, topTarget: 0, topNav: 0, rel: 0, files: 0 };
  for (const name of wanted) {
    const from = join(src, name);
    if (!existsSync(from)) continue;
    const to = join(destRoot, name);
    cpSync(from, to, { recursive: true });
    copied++;
    // Neutralise anything that could navigate us out of the arcade.
    for (const file of htmlFilesIn(to)) {
      const raw = readFileSync(file, 'utf8');
      const { html, changes } = sanitizeHtml(raw);
      if (html !== raw) {
        writeFileSync(file, html);
        fixups.files++;
        fixups.refresh += changes.refresh;
        fixups.topTarget += changes.topTarget;
        fixups.topNav += changes.topNav;
        fixups.rel += changes.rel;
      }
    }
  }
  if (fixups.files) {
    console.log(
      `arcadefork: sanitised ${fixups.files} vendored pages ` +
        `(${fixups.topTarget} target=_top, ${fixups.topNav} top-navigation, ` +
        `${fixups.refresh} meta refresh, ${fixups.rel} rel=noopener)`,
    );
  }
  return copied;
}

function buildCredits() {
  const thirdParty = GAMES.filter((g) => g.credit);
  const original = GAMES.filter((g) => !g.credit);
  const year = new Date().getUTCFullYear();

  const body = `${siteHeader('/credits/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${GAMES.length} games</span>
    <h1>Credits</h1>
    <p>arcadefork is built by Ayhem Kahri. Some games are original; the rest are open-source projects by other people, vendored here with their original licences and a link back to the source.</p>
  </section>

  <section class="section prose">
    <h2>Original games</h2>
    <p>Written for arcadefork, running on a custom TypeScript engine with no third-party runtime dependencies.</p>
    <div class="linklist">${original
      .map((g) => `<a href="/games/${g.id}/">${esc(g.title)}</a>`)
      .join('')}</div>
  </section>

  <section class="section prose">
    <h2>Open-source games</h2>
    <p>Each of these is the author's original work, vendored under its own licence. The full licence text ships inside each game's folder.</p>
    <table class="answer-table credits-table">
      <thead><tr><th>Game</th><th>By</th><th>Licence</th><th>Source</th></tr></thead>
      <tbody>${thirdParty
        .map(
          (g) =>
            `<tr><td><a href="/games/${g.id}/">${esc(g.title)}</a></td><td>${esc(
              g.credit.author,
            )}</td><td>${esc(creditLicence(g.credit))}</td><td><a href="${esc(
              g.credit.source,
            )}" rel="noopener nofollow" target="_blank">github</a></td></tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>

  <section class="section prose">
    <h2>Thanks</h2>
    <p>Nicky Case for Trust and Loopy, Jake Gordon for Javascript Tetris, and mumuy for Pacman. Their work made this collection what it is.</p>
  </section>
</main>
${siteFooter()}`;

  write(
    'credits/index.html',
    layout({
      title: `Credits — the games and people behind arcadefork`,
      description: `Credits for arcadefork: original games by Ayhem Kahri plus open-source games by Nicky Case, Jake Gordon and mumuy, with licences and source links.`,
      canonical: abs('/credits/'),
      body,
    }),
  );
}

function buildGamesIndex() {
  const total = GAMES.length;
  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    games: GAMES.filter((g) => g.category === c.id),
  })).filter((c) => c.games.length);

  const sections = byCategory
    .map(
      (c) => `<section class="section cat-block" data-category="${esc(c.id)}" data-name="${esc(
        c.title.toLowerCase(),
      )}">
    <div class="section-head">
      <h2>${esc(c.title)}</h2>
      <span class="pill">${c.games.length} game${c.games.length === 1 ? '' : 's'}</span>
    </div>
    ${gameTiles(c.games)}
  </section>`,
    )
    .join('');

  const chips = [
    `<button class="chip is-on" type="button" data-cat-chip="all" aria-pressed="true">Everything <b>${total}</b></button>`,
    ...byCategory.map(
      (c) =>
        `<button class="chip" type="button" data-cat-chip="${esc(c.id)}" aria-pressed="false">${esc(
          c.title.replace(/ Games$/, ''),
        )} <b>${c.games.length}</b></button>`,
    ),
  ].join('');

  const body = `${siteHeader('/games/')}
<main class="wrap" id="main">
  <section class="hero" style="padding-bottom:8px">
    <div>
      <p class="kicker"><i></i>${total} games · ${byCategory.length} categories · all free</p>
      <h1>Every game in the arcade</h1>
      <p class="lede">No download, no sign-up, no paywall. Search by name, filter by category, or just press the random button and see what happens.</p>
      <form class="filter-bar" role="search" onsubmit="return false">
        <input id="game-filter" class="filter-input" type="search" name="q" placeholder="Search ${total} games…"
               autocomplete="off" spellcheck="false" aria-label="Search games by name"
               aria-describedby="filter-status">
        <select id="sort-games" class="sort-select" aria-label="Sort games">
          <option value="default">Arcade order</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
        <button class="btn" id="btn-random" type="button">${glyph('a-dice', 18)} Random</button>
      </form>
      <div class="chips" id="cat-chips">${chips}</div>
      <p id="filter-status" class="filter-status" role="status" aria-live="polite"></p>
    </div>
  </section>
  <div id="game-sections">${sections}</div>
  <div class="empty" id="filter-empty" hidden>
    <b>No game matches that.</b>
    Try a shorter word, or <a href="/games/">clear the filter</a>.
  </div>

  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>Pick up where you left off</h2>
      <span class="pill">on this device</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>
</main>
<script id="af-catalog-json" type="application/json">${JSON.stringify(
    GAMES.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent })),
  ).replace(/</g, '\\u003c')}</script>
${siteFooter()}`;

  write(
    'games/index.html',
    layout({
      title: `All ${total} free browser games — the full arcade | ${SITE.name}`,
      description: `Browse all ${total} free browser games on ${SITE.name}: ${byCategory
        .map((c) => c.title.toLowerCase())
        .join(', ')}. Instant play, no download, no sign-up.`,
      canonical: abs('/games/'),
      body,
    }),
  );
}

function buildAdvertise() {
  const email = SITE.contactEmail || '';
  const contactLinks = [
    `<a href="https://github.com/AyhemKahriDev" rel="noopener nofollow" target="_blank">GitHub — AyhemKahriDev</a>`,
    email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '',
  ]
    .filter(Boolean)
    .join('');
  const body = `${siteHeader('/advertise/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">Sponsors only — no ad networks</span>
    <h1>Put your thing in the cabinet.</h1>
    <p>arcadefork is a free arcade with a daily puzzle that brings people back every day. A few quiet, labelled sponsor slots are what keep it free — and one of them can be yours.</p>
  </section>

  <section class="section prose">
    <h2>What a slot is</h2>
    <p>A text (or small image) card, always marked <strong>Sponsored</strong>, shown beside the games of one category and on that category's hub pages. One sponsor per category — a player sees yours, and only yours.</p>
    <ul>
      <li>No pop-ups, interstitials, auto-playing sound or floating panels — those would kill an arcade like this.</li>
      <li>Never mixed into game results, scores or the puzzle grid.</li>
      <li>No tracking scripts at any price.</li>
    </ul>
    <p>What you buy is placement, not scale: traffic here is real, small, and growing through the daily puzzle. Prices match that.</p>
  </section>

  <section class="section">
    <h2>Prices</h2>
    <table class="answer-table">
      <thead><tr><th>Slot</th><th>Where it shows</th><th>Price</th></tr></thead>
      <tbody>
        <tr><td><strong>Launch week</strong></td><td>Any slot, one week, first month only</td><td>$5</td></tr>
        <tr><td><strong>Category slot</strong></td><td>Every page of one category</td><td>$15 / month</td></tr>
        <tr><td><strong>Site-wide slot</strong></td><td>Every game and category page</td><td>$35 / month</td></tr>
      </tbody>
    </table>
    <p class="prose">Flat. No impressions, no bidding, no renewals held hostage — cancel any month.</p>
  </section>

  <section class="section prose">
    <h2>How it starts</h2>
    <ol>
      <li>Write to me with your name, what you advertise and the link.</li>
      <li>Your slot goes live on the next build — usually the same day — and you see it on the real site before paying anything.</li>
      <li>The payment link arrives with the confirmation. You only pay once it is live.</li>
    </ol>
  </section>

  <section class="section prose">
    <h2>What fits</h2>
    <p>Games, game-dev tools, word-game and puzzle books, education, indie newsletters. Family-friendly only: no gambling, no crypto, no loot boxes, nothing you couldn't explain to a nine-year-old.</p>
  </section>

  <section class="section prose">
    <h2>Contact</h2>
    <p>One line is enough to start:</p>
    <div class="linklist">${contactLinks}</div>
  </section>
</main>
${siteFooter()}`;
  write(
    'advertise/index.html',
    layout({
      title: `Advertise — sponsor a slot in the arcade | ${SITE.name}`,
      description: `Put your game, tool or newsletter in front of arcadefork players: one labelled sponsor slot per category, no pop-ups, from $5. Sponsors only — no ad networks.`,
      canonical: abs('/advertise/'),
      body,
    }),
  );
}

function buildNotFound() {
  const body = `${siteHeader('/')}
<main class="wrap" id="main">
  <section class="hero" style="min-height:38vh;justify-content:center">
    <p class="kicker"><i></i>404</p>
    <h1>That page is not in the cabinet.</h1>
    <p>It may have moved, or it never existed. The games all still work — pick one, or go back to the start.</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="/games/">Browse all ${GAMES.length} games</a>
      <a class="btn" href="/">Home</a>
    </div>
  </section>
  <section class="section">${gameTiles(GAMES.slice(0, 10))}</section>
</main>
${siteFooter()}`;
  write(
    '404.html',
    layout({
      title: `Page not found | ${SITE.name}`,
      description: 'That page does not exist on arcadefork.',
      canonical: abs('/404.html'),
      body,
    }),
  );
}

/* ------------------------------------------------------------------ main */

function main() {
  if (existsSync(dist)) {
    for (const entry of ['index.html', 'games', 'categories', 'daily', 'sitemap.xml', '404.html']) {
      rmSync(join(dist, entry), { recursive: true, force: true });
    }
  }
  mkdirSync(dist, { recursive: true });

  computeAssetVersion();
  findHostBundle();
  versionServiceWorker();
  writeHeaders();
  const today = todayISO();
  const urls = [];

  buildHome();
  urls.push({ loc: abs('/'), lastmod: today });

  for (const c of CATEGORIES) {
    buildCategory(c);
    urls.push({ loc: abs(`/categories/${c.id}/`), lastmod: today });
  }

  for (const g of GAMES) {
    buildGamePage(g);
    urls.push({ loc: abs(`/games/${g.id}/`), lastmod: today });
  }

  urls.push({ loc: abs('/credits/'), lastmod: today });
  urls.push({ loc: abs('/games/'), lastmod: today });
  urls.push({ loc: abs('/advertise/'), lastmod: today });

  buildDailyPages();
  urls.push({ loc: abs('/daily/'), lastmod: today });
  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
    const d = addDays(today, i);
    urls.push({ loc: abs(`/daily/${d}/`), lastmod: d });
    urls.push({ loc: abs(`/daily/${d}/answers/`), lastmod: d });
  }

  buildSitemap(urls);
  buildRobots();
  buildCredits();
  buildGamesIndex();
  buildNotFound();
  buildAdvertise();

  const vendored = copyThirdParty();
  const total = urls.length;
  console.log(
    `arcadefork: built ${total} URLs (${GAMES.length} games, ${CATEGORIES.length} categories, ${vendored} vendored third-party)`,
  );
}

main();
