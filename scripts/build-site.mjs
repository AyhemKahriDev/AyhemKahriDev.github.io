/**
 * Static site builder for arcadefork.
 *
 * Runs after `vite build` and writes the HTML into dist/.
 * Everything is deterministic: same inputs -> same output, so the nightly
 * rebuild only adds new pages instead of churning URLs.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import content from '../content/games.json' with { type: 'json' };
import generated from '../content/games.generated.json' with { type: 'json' };
import sponsors from '../content/sponsors.json' with { type: 'json' };
import { gameShell, embedShell } from './shell.mjs';
import { gameIcon, iconSprite, glyph, tileAccent } from './icons.mjs';
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
function computeAssetVersion() {
  const parts = [];
  for (const f of ['public/styles.css', 'public/ui.js']) {
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
<link rel="stylesheet" href="/styles.css?v=${assetVersion}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap">
${head}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}"${bodyAttrs ? ' ' + bodyAttrs : ''}>
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

/* ------------------------------------------------------------ site pages */

function siteHeader(active = '') {
  const links = [
    { href: '/games/', label: 'All games' },
    ...CATEGORIES.slice(0, 5).map((c) => ({ href: `/categories/${c.id}/`, label: c.title })),
    { href: '/daily/', label: 'Daily puzzle' },
  ];
  return `<header class="site-header"><div class="wrap bar">
  <a class="brand" href="/">arcade<span>fork</span></a>
  <nav class="site-nav">${links
    .map(
      (l) =>
        `<a href="${l.href}"${l.href === active ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`,
    )
    .join('')}</nav>
</div></header>`;
}

function siteFooter() {
  const year = new Date().getUTCFullYear();
  const thirdParty = GAMES.filter((g) => g.credit);
  return `<footer class="site-footer"><div class="wrap">
  <p>${esc(SITE.name)} — free browser games. No download, no sign-up.</p>
  <nav class="foot-nav">
    <a href="/sitemap.xml">Sitemap</a>
    <a href="/daily/">Daily puzzle archive</a>
    <a href="/categories/word/">Word games</a>
    <a href="/categories/arcade/">Arcade games</a>
    <a href="/credits/">Credits</a>
  </nav>
  ${
    thirdParty.length
      ? `<p class="foot-note">Includes ${thirdParty.length} open-source games, credited on the <a href="/credits/">credits page</a>.</p>`
      : ''
  }
  <p class="copyright">&copy; ${year} Ayhem Kahri. ${esc(SITE.name)} — free to play, forever.</p>
</div></footer>`;
}

function gameTiles(ids, opts = {}) {
  const gridClass = opts.featured ? 'grid grid-featured' : 'grid';
  return `<div class="${gridClass}">${ids
    .map((g, i) => {
      const cat = CATEGORIES.find((c) => c.id === g.category);
      const accent = tileAccent(g);
      return `<a class="tile reveal" href="/games/${g.id}/" data-cat="${esc(g.category)}"
   style="--tile-accent:${esc(accent)};--glow:${esc(accent)};--i:${i}">
      <div class="thumb">${gameIcon(g.id, g.accent, g.category)}</div>
      ${g.credit ? '<span class="badge">Open source</span>' : ''}
      <h3>${esc(g.title)}</h3>
      <p>${esc(cleanTagline(g))}</p>
      ${cat ? `<span class="tag">${esc(cat.title)}</span>` : ''}
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

function buildHome() {
  const { today, theme } = todayPage();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.baseUrl,
    description: SITE.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.baseUrl}/daily/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  const body = `${siteHeader('/')}
<main class="wrap">
  <section class="hero">
    <span class="pill">${GAMES.length} free games</span>
    <span class="pill">No sign-up</span>
    <span class="pill">Works on any device</span>
    <h1>Free browser games<br>that load instantly.</h1>
    <p>${esc(SITE.description)}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="/games/">Browse all ${GAMES.length} games</a>
      <button class="btn btn-ghost btn-dice" id="btn-random" type="button">${glyph('a-dice', 18)} Play a random game</button>
    </div>
    <div class="cat-row">${CATEGORIES.map(
      (c) => `<a class="cat-chip" href="/categories/${c.id}/">${esc(c.title)}</a>`,
    ).join('')}</div>
  </section>

  <section class="ticker" aria-hidden="true"><div class="ticker-track"><span class="ticker-set">${GAMES.map(
    (g) => `<b>${esc(g.title)}</b><i>✦</i>`,
  ).join('')}</span></div></section>

  <section class="section">
    <h2>Today's puzzle</h2>
    <div class="grid grid-featured">
      <a class="tile" href="/daily/${today}/" style="--tile-accent:${esc(theme.accent)};--glow:${esc(theme.accent)}">
        <div class="thumb">${gameIcon('wordsearch', theme.accent)}</div>
        <h3>Daily Word Search</h3>
        <p>${esc(theme.title)} theme — ${today}. Everyone plays the same grid.</p>
        <span class="tag">New every day</span>
      </a>
      <a class="tile" href="/daily/${today}/answers/" style="--tile-accent:${esc(theme.accent)};--glow:${esc(theme.accent)}">
        <div class="thumb thumb-plain" style="font-size:38px;font-weight:800;color:${theme.accent}">?</div>
        <h3>Today's answers</h3>
        <p>The full solved grid with every word and where it starts.</p>
        <span class="tag">Answers</span>
      </a>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>All games</h2>
      <a class="section-more" href="/games/">See all ${GAMES.length} games →</a>
    </div>
    ${gameTiles(GAMES.slice(0, 12))}
  </section>

  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>Recently played</h2>
      <span class="pill">yours</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>

  <section class="section prose">
    <h2>Why arcadefork</h2>
    <p>Every game here runs entirely in your browser. Nothing to install, no account to create, no email required. The page is under a megabyte, so it starts instantly on a phone connection.</p>
    <p>New puzzles are added regularly, and the <a href="/daily/">daily puzzle archive</a> keeps every past grid so you can look up the answers or replay an old board.</p>
  </section>
</main>
<script id="af-catalog-json" type="application/json">${JSON.stringify(
    GAMES.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent })),
  )}</script>
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
<main class="wrap">
  <section class="hero">
    <span class="pill">${games.length} game${games.length === 1 ? '' : 's'}</span>
    <h1>${esc(cat.title)}</h1>
    <p>${esc(cat.description)}</p>
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
  ];
  const isEmbed = Boolean(game.embed);
  const shellOpts = { related, sponsor: sponsorBanner(game.category) };
  const body = `${isEmbed ? embedShell(game, shellOpts) : gameShell(game, shellOpts)}
<section class="wrap prose" style="padding-bottom:40px">
  <h1>${esc(game.title)} — play free online</h1>
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
${isEmbed ? '' : '<script type="module" src="/assets/host.js"></script>'}`;
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
<main class="wrap">
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
<main class="wrap">
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
<main class="wrap">
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
<main class="wrap">
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
      <span class="pill">${c.games.length}</span>
    </div>
    ${gameTiles(c.games)}
  </section>`,
    )
    .join('');

  const body = `${siteHeader('/games/')}
<main class="wrap">
  <section class="hero">
    <span class="pill">${total} free games</span>
    <h1>Every game</h1>
    <p>${total} free browser games across ${byCategory.length} categories. No download, no sign-up, no paywall. Filter by name or category.</p>
    <input id="game-filter" class="filter-input" type="search" placeholder="Search ${total} games…"
           autocomplete="off" aria-label="Search games">
    <p id="filter-status" class="filter-status"></p>
    <div class="hero-cta">
      <button class="btn btn-ghost btn-dice" id="btn-random" type="button">${glyph('a-dice', 18)} Play a random game</button>
    </div>
  </section>
  <div id="game-sections">${sections}</div>

  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>Recently played</h2>
      <span class="pill">yours</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>
</main>
<script id="af-catalog-json" type="application/json">${JSON.stringify(
    GAMES.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent })),
  )}</script>
${siteFooter()}
<script>
(function () {
  var input = document.getElementById('game-filter');
  var status = document.getElementById('filter-status');
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.cat-block'));
  if (!input) return;
  function apply() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    blocks.forEach(function (block) {
      var tiles = Array.prototype.slice.call(block.querySelectorAll('.tile'));
      var visible = 0;
      tiles.forEach(function (tile) {
        var hit = !q || tile.textContent.toLowerCase().indexOf(q) !== -1;
        tile.style.display = hit ? '' : 'none';
        if (hit) visible++;
      });
      block.style.display = visible ? '' : 'none';
      shown += visible;
    });
    status.textContent = q ? shown + ' game' + (shown === 1 ? '' : 's') + ' match "' + input.value + '"' : '';
  }
  input.addEventListener('input', apply);
  input.addEventListener('search', apply);
})();
</script>`;

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

function buildNotFound() {  const body = `${siteHeader('/')}
<main class="wrap">
  <section class="hero"><h1>Page not found</h1><p>That page does not exist. Try one of the games instead.</p></section>
  <section class="section">${gameTiles(GAMES)}</section>
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

  const vendored = copyThirdParty();
  const total = urls.length;
  console.log(
    `arcadefork: built ${total} URLs (${GAMES.length} games, ${CATEGORIES.length} categories, ${vendored} vendored third-party)`,
  );
}

main();
