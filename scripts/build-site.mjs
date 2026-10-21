/**
 * Static site builder for arcadefork.
 *
 * Runs after `vite build` and writes the HTML into dist/.
 * Everything is deterministic: same inputs -> same output, so the nightly
 * rebuild only adds new pages instead of churning URLs.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import content from '../content/games.json' with { type: 'json' };
import sponsors from '../content/sponsors.json' with { type: 'json' };
import { gameShell } from './shell.mjs';
import {
  generateWordBoard,
  boardAnswers,
  dateSeed,
  todayISO,
  addDays,
} from '../src/shared/daily.js';
import { themeForDate } from '../src/shared/wordlists.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const SITE = content.site;
const GAMES = content.games;
const CATEGORIES = content.categories.filter((c) => GAMES.some((g) => g.category === c.id));

const PAST_DAYS = 30;
const FUTURE_DAYS = 7;

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const abs = (path) => new URL(path, SITE.baseUrl).href;

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
<html lang="en">
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
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap">
${head}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}"${bodyAttrs ? ' ' + bodyAttrs : ''}>
${body}
${script}
</body>
</html>`;
}

/* ---------------------------------------------------------------- icons */

function gameIcon(id, accent) {
  const a = accent || '#2fe6ff';
  const wrap = (inner) =>
    `<svg viewBox="0 0 96 96" width="72" height="72" role="img" aria-hidden="true">${inner}</svg>`;
  if (id === 'wordsearch') {
    const letters = 'ARCADE';
    let cells = '';
    let k = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const on = r === c; // the hidden word runs down the diagonal
        cells += `<rect x="${8 + c * 20}" y="${8 + r * 20}" width="18" height="18" rx="4" fill="${
          on ? a : '#1b2440'
        }"/>`;
        cells += `<text x="${17 + c * 20}" y="${22 + r * 20}" font-size="11" font-family="Outfit, sans-serif" font-weight="700" fill="${
          on ? '#080c16' : '#8c96bc'
        }" text-anchor="middle">${letters[k % letters.length]}</text>`;
        k++;
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
       <text x="27" y="35" font-size="22" font-family="Outfit, sans-serif" font-weight="800" fill="#080c16" text-anchor="middle">2</text>
       <text x="69" y="35" font-size="22" font-family="Outfit, sans-serif" font-weight="800" fill="#e9edff" text-anchor="middle">8</text>`,
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
  return wrap(`<circle cx="48" cy="48" r="30" fill="${a}"/>`);
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
    { href: '/', label: 'Home' },
    ...CATEGORIES.map((c) => ({ href: `/categories/${c.id}/`, label: c.title })),
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
  return `<footer class="site-footer"><div class="wrap">
  <p>${esc(SITE.name)} — free browser games. No download, no sign-up.</p>
  <p><a href="/sitemap.xml">Sitemap</a> · <a href="/daily/">Daily puzzle archive</a> · <a href="/categories/word/">Word games</a></p>
</div></footer>`;
}

function gameTiles(ids) {
  return `<div class="grid">${ids
    .map((g) => {
      const cat = CATEGORIES.find((c) => c.id === g.category);
      return `<a class="tile" href="/games/${g.id}/">
      <div class="thumb">${gameIcon(g.id, g.accent)}</div>
      <h3>${esc(g.title)}</h3>
      <p>${esc(g.tagline)}</p>
      ${cat ? `<p class="pill" style="margin-top:10px">${esc(cat.title)}</p>` : ''}
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
    <div class="cat-row">${CATEGORIES.map(
      (c) => `<a class="cat-chip" href="/categories/${c.id}/">${esc(c.title)}</a>`,
    ).join('')}</div>
  </section>

  <section class="section">
    <h2>Today's puzzle</h2>
    <div class="grid">
      <a class="tile" href="/daily/${today}/">
        <div class="thumb">${gameIcon('wordsearch', theme.accent)}</div>
        <h3>Daily Word Search</h3>
        <p>${esc(theme.title)} theme — ${today}. Everyone plays the same grid.</p>
      </a>
      <a class="tile" href="/daily/${today}/answers/">
        <div class="thumb" style="font-size:30px;font-weight:800;color:${theme.accent}">?</div>
        <h3>Today's answers</h3>
        <p>The full solved grid with every word and where it starts.</p>
      </a>
    </div>
  </section>

  <section class="section">
    <h2>All games</h2>
    ${gameTiles(GAMES)}
  </section>

  <section class="section prose">
    <h2>Why arcadefork</h2>
    <p>Every game here runs entirely in your browser. Nothing to install, no account to create, no email required. The page is under a megabyte, so it starts instantly on a phone connection.</p>
    <p>New puzzles are added regularly, and the <a href="/daily/">daily puzzle archive</a> keeps every past grid so you can look up the answers or replay an old board.</p>
  </section>
</main>
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
  const related = GAMES.filter((g) => game.related?.includes(g.id) || g.category === game.category).filter(
    (g) => g.id !== game.id,
  );
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
  const body = `${gameShell(game)}
<section class="wrap prose" style="padding-bottom:40px">
  <h1>${esc(game.title)} — play free online</h1>
  <p>${esc(game.description)}</p>
  ${sponsorBanner(game.category)}
  <h2>How to play ${esc(game.title)}</h2>
  <ul>${game.howToPlay.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
  <h2>Frequently asked questions</h2>
  <div class="faq">${game.faq
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('')}</div>
  <h2>More free games</h2>
  <div class="linklist">${related.map((g) => `<a href="/games/${g.id}/">${esc(g.title)}</a>`).join('')}</div>
</section>
<script type="module" src="/assets/host.js"></script>`;
  write(
    `games/${game.id}/index.html`,
    layout({
      title: `${game.title} — play free online | ${SITE.name}`,
      description: game.description,
      canonical: abs(`/games/${game.id}/`),
      body,
      bodyClass: 'is-game',
      bodyAttrs: `data-game="${game.id}"`,
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

function buildNotFound() {
  const body = `${siteHeader('/')}
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

  buildDailyPages();
  urls.push({ loc: abs('/daily/'), lastmod: today });
  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
    const d = addDays(today, i);
    urls.push({ loc: abs(`/daily/${d}/`), lastmod: d });
    urls.push({ loc: abs(`/daily/${d}/answers/`), lastmod: d });
  }

  buildSitemap(urls);
  buildRobots();
  buildNotFound();

  const total = urls.length;
  console.log(`arcadefork: built ${total} URLs (${GAMES.length} games, ${CATEGORIES.length} categories)`);
}

main();
