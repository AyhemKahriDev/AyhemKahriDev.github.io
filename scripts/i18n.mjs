/**
 * Locale registry, catalog loader and translation lookup.
 *
 * The site is built once per locale into its own URL tree (`/`, `/fr/`,
 * `/ar/`). Every string a reader sees comes from a catalog in
 * content/i18n/<id>.json, which is written by a separate job and may not
 * exist yet; this module therefore ships a complete English catalog and
 * merges whatever is on disk over it, key by key. A missing file, a missing
 * key, a broken key - none of them can render `undefined` or a raw key on a
 * page.
 *
 * Nothing here may import the site builder: tests load this module directly.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The three trees, in the order they are emitted and linked.
 *
 * `prefix` is the URL tree (`''` is the root), `hreflang` is the value in the
 * alternate links, `dir` is the writing direction of the page, and `ogLocale`
 * is the Open Graph spelling (`fr_FR`, not `fr`).
 */
export const LOCALES = [
  { id: 'en', prefix: '', name: 'English', hreflang: 'en', dir: 'ltr', ogLocale: 'en_US' },
  { id: 'fr', prefix: '/fr', name: 'Français', hreflang: 'fr', dir: 'ltr', ogLocale: 'fr_FR' },
  { id: 'ar', prefix: '/ar', name: 'العربية', hreflang: 'ar', dir: 'rtl', ogLocale: 'ar_AR' },
];

export const DEFAULT_LOCALE = 'en';
/** Where a reader lands when the site cannot tell what they speak. */
export const X_DEFAULT = 'en';

/** Locale by id, or the default one. Never undefined. */
export function localeById(id) {
  return LOCALES.find((l) => l.id === id) ?? LOCALES[0];
}

/**
 * The built-in English catalog.
 *
 * This is the last line of defence: the site must build and read correctly
 * with content/i18n/ absent, and English is the language every other locale
 * falls back to per key.
 */
const EN = {
  site: {
    tagline: 'Free browser games. No download, no sign-up, no ads before you play.',
    description:
      'arcadefork is a free browser arcade with word games, puzzle games and arcade classics. Play instantly on any device, no install required.',
  },
  strings: {
    /* ---------------------------------------------------------- chrome */
    'a11y.skip': 'Skip to content',
    'a11y.lang': 'Language',
    'brand.home': 'arcadefork — home',
    'nav.main': 'Main',
    'nav.categories': 'Categories',
    'nav.footer': 'Footer',
    'nav.breadcrumb': 'Breadcrumb',
    'nav.games': 'All games',
    'nav.daily': 'Daily',
    'nav.home': 'Home',
    'nav.gamePages': 'Game pages',
    'search.placeholder': 'Search {count} games',
    'search.label': 'Search all games',
    'theme.label': 'Theme',
    'theme.button': 'Theme: {name}',
    'pager.prev': 'Prev',
    'pager.next': 'Next',
    'count.games_one': '{count} game',
    'count.games': '{count} games',

    /* ---------------------------------------------------------- footer */
    'foot.count': '{count} free browser games.',
    'foot.blurb':
      "No download, no sign-up, no paywall — the whole arcade is one HTML file's worth of JavaScript.",
    'foot.tips': 'Like the arcade? Tips keep it free: {links}.',
    'foot.free':
      'Free forever — funded by sponsor slots. One is <a href="{href}">open right now</a>.',
    'foot.nav.games': 'All games',
    'foot.nav.archive': 'Daily puzzle archive',
    'foot.nav.sponsor': 'Sponsor a slot',
    'foot.nav.credits': 'Credits',
    'foot.nav.sitemap': 'Sitemap',
    'foot.thirdParty':
      'Includes {count} open-source games, credited on the <a href="{href}">credits page</a>.',
    'foot.copyright': '© {year} Ayhem Kahri · {site} — free to play, forever.',

    /* ------------------------------------------------------------ home */
    'home.title': 'free browser games, no download',
    'home.kicker': '{count} games · free forever',
    'home.h1.pre': 'Free browser games that ',
    'home.h1.em': 'start instantly',
    'home.h1.post': '.',
    'home.lede':
      'Pick a game and you are playing in one second — nothing to install, nothing to unlock, no account.',
    'home.browseAll': 'Browse all {count} games',
    'home.random': 'Play something random',
    'home.trust1': 'Loads in about a second',
    'home.trust2': 'Plays offline after first visit',
    'home.trust3': 'No tracking, no ads that follow you',
    'home.today': "Today's grid",
    'home.ticket': "TODAY'S TOKEN * {date}",
    'home.words_one': '{count} word',
    'home.words': '{count} words',
    'home.play': 'Play',
    'home.ticker1': 'ONE NEW GRID EVERY DAY',
    'home.ticker2': '{count} GAMES, ZERO DOWNLOADS',
    'home.ticker3': 'NO ACCOUNT, NO EMAIL, NO PAYWALL',
    'home.ticker4': 'PLAYS OFFLINE AFTER FIRST LOAD',
    'home.ticker5': 'MADE OF HTML, JAVASCRIPT AND NOTHING ELSE',
    'home.stats.label': 'The arcade in numbers',
    'home.stats.games': 'games',
    'home.stats.daily': 'new grid daily',
    'home.stats.accounts': 'accounts needed',
    'home.stats.forever': 'forever',
    'home.start': 'Start here',
    'home.allGames': 'All {count} games',
    'home.mood': 'Browse by mood',
    'home.everything': 'Everything',
    'home.todayPuzzle': "Today's puzzle",
    'home.midnight': 'new at midnight UTC',
    'home.daily.title': 'Daily Word Search',
    'home.daily.body':
      '{theme} — {date}. Ten by ten, {count} words, 100 seconds. Everyone plays the same grid.',
    'home.daily.tag': "Play today's grid",
    'home.answers.title': "Today's answers",
    'home.answers.body':
      'The full solved grid with every word, and a row and column for where each one starts.',
    'home.answers.tag': 'Look it up',
    'home.cabinet': 'The whole cabinet',
    'home.seeAll': 'See all {count}',
    'home.recent': 'Pick up where you left off',
    'home.device': 'on this device',
    'home.slots': 'Cabinet slots',
    'home.advertise': 'Advertise',
    'home.why': 'Why it is free',
    'home.f1.title': 'Nothing to load first',
    'home.f1.body':
      'Every game is plain JavaScript and canvas. No install, no engine download, no loading bar.',
    'home.f2.title': 'Nothing to sign up for',
    'home.f2.body':
      'No account, no email, no cookie wall. Your scores and recents stay in your own browser.',
    'home.f3.title': 'Nothing to pay',
    'home.f3.body':
      'The arcade is funded by labelled sponsor slots, not by interrupting a game you are winning.',
    'home.about': 'About {site}',
    'home.about1':
      'Every game here runs entirely in your browser. The page is under a megabyte, so it starts instantly on a phone connection, and the <a href="{archive}">daily puzzle archive</a> keeps every past grid so you can look up the answers or replay an old board.',
    'home.about2':
      '{count} of the games are open source, vendored with their original licences and credited on the <a href="{credits}">credits page</a>. The rest are built on the arcadefork engine.',
    'home.slot.title': 'Your game here',
    'home.slot.body':
      'A labelled sponsor card beside one category of games — an indie game, a dev tool, a newsletter. No pop-ups, ever.',
    'home.slot.price': 'Open — from $15/month',
    'home.sponsored': 'Sponsored',

    /* -------------------------------------------------------- category */
    'cat.kicker': '{count} free {categoryLower}',
    'cat.random': 'Random {categoryLower} game',
    'cat.more': 'More {site} games',
    'cat.titleSuffix': 'free online games',
    'cat.metaSuffix': 'Play free {category} in your browser on {site}.',
    'cat.metaInBrowser': 'free online games in your browser',

    /* ------------------------------------------------------------ game */
    'game.h1': '{title} — play free online',
    'game.titleSuffix': 'play free online',
    'game.metaDesc': '{desc}',
    'game.howTo': 'How to play {title}',
    'game.faq': 'Frequently asked questions',
    'game.more': 'More free games',
    'game.credit': 'Originally by {author} · {licence} licence · <a href="{source}" rel="noopener nofollow" target="_blank">source</a>',
    'game.howToDefault1': 'Open {title} and follow the on-screen instructions.',
    'game.howToDefault2':
      'Play with the keyboard, the mouse or touch - the controls are shown in the game.',
    'game.howToDefault3': 'Score points and try to beat your best run.',
    'game.aboutLabel': 'About this game',
    'game.allGames': 'All games',
    'game.moreLikeThis': 'More like this',
    'game.keepPlaying': 'Keep playing',
    'game.sponsored': 'Sponsored',
    'game.sideFoot': 'Free to play · no sign-up · works on any device',
    'game.difficulty': 'Difficulty',
    'game.easy': 'Easy',
    'game.normal': 'Normal',
    'game.hard': 'Hard',
    'game.sound': 'Toggle sound',
    'game.fullscreen': 'Fullscreen',
    'game.canvas': '{title}. Press space to start.',
    'game.pressSpace': 'Press space to start.',
    'game.original': 'Original',
    'game.viewSource': 'View source',
    'game.openFull': 'Open full',
    'game.loading': 'Loading {title}…',
    'game.pad': 'On-screen controls',
    'game.fullScreen': 'Full screen',
    'tile.openSource': 'Open source',

    /* ------------------------------------------------------- games index */
    'index.title1': 'All {count} free browser games — the full arcade',
    'index.titleN': 'All {count} free browser games — page {page} of {pages}',
    'index.desc1':
      'Browse all {count} free browser games on {site}: {categories}. Instant play, no download, no sign-up.',
    'index.descN':
      'Games {from}–{to} of {count} free browser games on {site}, page {page} of {pages}. Instant play, no download, no sign-up.',
    'index.kicker1': '{count} games · {cats} categories · all free',
    'index.kickerN': 'Page {page} of {pages} · games {from}–{to} of {count}',
    'index.h1.1': 'Every game in the arcade',
    'index.h1.n': 'All games — page {page} of {pages}',
    'index.lede1':
      'No download, no sign-up, no paywall. Search by name, filter by category, or just press the random button and see what happens.',
    'index.ledeN':
      'The same arcade, split across {pages} pages so it opens fast. Search reaches all {count} games, whichever page they live on.',
    'index.placeholder': 'Search {count} games…',
    'index.searchLabel': 'Search games by name',
    'index.sortLabel': 'Sort games',
    'index.sortDefault': 'Arcade order',
    'index.sortAZ': 'A → Z',
    'index.sortZA': 'Z → A',
    'index.random': 'Random',
    'index.everything': 'Everything',
    'index.showing': 'Showing {from}–{to} of {count}',
    'index.range': 'Games {from}–{to}',
    'index.pagePill': 'page {page} of {pages}',
    'index.emptyTitle': 'No game matches that.',
    'index.emptyBody': 'Try a shorter word, or <a href="{href}">clear the filter</a>.',
    'index.status.match': 'matching “{q}”',
    'index.status.in': 'in {category}',
    'index.status.all': '· all {count} games',
    'index.status.broken': '· catalogue unavailable, this page only',
    'index.status.page': '· this page, loading the rest',

    /* --------------------------------------------------------- credits */
    'credits.title': 'Credits — the games and people behind {site}',
    'credits.desc':
      'Credits for {site}: original games by Ayhem Kahri plus open-source games by Nicky Case, Jake Gordon and mumuy, with licences and source links.',
    'credits.h1': 'Credits',
    'credits.pill': '{count} games',
    'credits.intro':
      '{site} is built by Ayhem Kahri. Some games are original; the rest are open-source projects by other people, vendored here with their original licences and a link back to the source.',
    'credits.original': 'Original games',
    'credits.originalBody':
      'Written for {site}, running on a custom TypeScript engine with no third-party runtime dependencies.',
    'credits.oss': 'Open-source games',
    'credits.ossBody':
      "Each of these is the author's original work, vendored under its own licence. The full licence text ships inside each game's folder.",
    'credits.thanks': 'Thanks',
    'credits.thanksBody':
      'Nicky Case for Trust and Loopy, Jake Gordon for Javascript Tetris, and mumuy for Pacman. Their work made this collection what it is.',
    'credits.col.game': 'Game',
    'credits.col.by': 'By',
    'credits.col.licence': 'Licence',
    'credits.col.source': 'Source',

    /* ----------------------------------------------------------- daily */
    'daily.title': 'Daily Word Search archive — every puzzle and answer',
    'daily.desc':
      'Play or look up every daily word search puzzle. A new free 10x10 grid every day with the full answer list for each one.',
    'daily.pill': 'New puzzle every day',
    'daily.h1': 'Daily Word Search archive',
    'daily.intro':
      'One new 10x10 word search every day. Everyone plays the same grid, so you can compare scores with friends or look back at a puzzle you missed.',
    'daily.col.date': 'Date',
    'daily.col.theme': 'Theme',
    /* The ten rotating word lists. The words stay English (they are the
       puzzle); the theme's name is chrome and gets translated. */
    'daily.theme.haunt': 'Ghost Haunt',
    'daily.theme.neon': 'Neon City',
    'daily.theme.space': 'Deep Space',
    'daily.theme.magic': 'Ancient Magic',
    'daily.theme.nature': 'Wild Nature',
    'daily.theme.candy': 'Candy Rush',
    'daily.theme.ocean': 'Deep Ocean',
    'daily.theme.retro': 'Retro Arcade',
    'daily.theme.kitchen': 'The Kitchen',
    'daily.theme.sport': 'Game Day',
    'daily.answers': 'answers',
    'daily.today': 'today',
    'daily.howTitle': 'How the daily puzzle works',
    'daily.howBody':
      'The grid is generated from the date, which means every player gets exactly the same board at the same time. Drag across a straight line of letters to select a word — horizontally, vertically or diagonally. You have 100 seconds.',
    'daily.puzzle.title': 'Daily Word Search {date} — free puzzle and answers',
    'daily.puzzle.desc':
      'Free daily word search for {date}. {theme} theme, {count} hidden words, 100 seconds to find them. Same grid for every player.',
    'daily.puzzle.h1': 'Daily Word Search — {date}',
    'daily.puzzle.lede':
      'Free daily word search puzzle for {date}. 10x10 grid, {count} hidden words, 100 seconds on the clock. The same grid for every player.',
    'daily.playFull': 'Play the full game',
    'daily.seeAnswers': 'See the answers',
    'daily.wordsIn': 'Words in the {date} puzzle',
    'daily.stuck':
      '{count} words are hidden in this grid. If you are stuck, the <a href="{href}">answer page for {date}</a> lists every word and where it starts and ends.',
    'daily.howPlayTitle': 'How to play',
    'daily.howPlay1': 'Drag across a straight line of letters — horizontal, vertical or diagonal.',
    'daily.howPlay2': 'Release to submit. Correct words stay highlighted.',
    'daily.howPlay3': '100 seconds. Longer words and faster finds score more.',
    'daily.other': 'Other daily puzzles',
    'daily.answersTitle': 'Word search answers for {date} — {count} words',
    'daily.answersDesc':
      'Full answer list for the {date} daily word search: {words}. Solved grid and start/end positions for every word.',
    'daily.answers.h1': 'Daily Word Search answers — {date}',
    'daily.answers.lede':
      'Every word hidden in the {date} puzzle, with the row and column where each one starts and ends. {count} words in total.',
    'daily.col.word': 'Word',
    'daily.col.starts': 'Starts (row, col)',
    'daily.col.ends': 'Ends (row, col)',
    'daily.wordsList': 'Words: {words}.',
    'daily.about': 'About this puzzle',
    'daily.aboutBody':
      'This puzzle was generated on {date} using the {theme} word list. Every player gets the same grid, and a new one appears every day at midnight UTC. Play it free on <a href="{game}">{site}</a> or browse the <a href="{archive}">full archive</a>.',

    /* -------------------------------------------------------- advertise */
    'ad.title': 'Advertise — sponsor a slot in the arcade',
    'ad.desc':
      'Put your game, tool or newsletter in front of {site} players: one labelled sponsor slot per category, no pop-ups, from $5. Sponsors only — no ad networks.',
    'ad.pill': 'Sponsors only — no ad networks',
    'ad.h1': 'Put your thing in the cabinet.',
    'ad.intro':
      'arcadefork is a free arcade with a daily puzzle that brings people back every day. A few quiet, labelled sponsor slots are what keep it free — and one of them can be yours.',
    'ad.whatTitle': 'What a slot is',
    'ad.whatBody':
      "A text (or small image) card, always marked <strong>Sponsored</strong>, shown beside the games of one category and on that category's hub pages. One sponsor per category — a player sees yours, and only yours.",
    'ad.rule1':
      'No pop-ups, interstitials, auto-playing sound or floating panels — those would kill an arcade like this.',
    'ad.rule2': 'Never mixed into game results, scores or the puzzle grid.',
    'ad.rule3': 'No tracking scripts at any price.',
    'ad.whatFoot':
      'What you buy is placement, not scale: traffic here is real, small, and growing through the daily puzzle. Prices match that.',
    'ad.prices': 'Prices',
    'ad.col.slot': 'Slot',
    'ad.col.where': 'Where it shows',
    'ad.col.price': 'Price',
    'ad.row1.name': 'Launch week',
    'ad.row1.where': 'Any slot, one week, first month only',
    'ad.row1.price': '$5',
    'ad.row2.name': 'Category slot',
    'ad.row2.where': 'Every page of one category',
    'ad.row2.price': '$15 / month',
    'ad.row3.name': 'Site-wide slot',
    'ad.row3.where': 'Every game and category page',
    'ad.row3.price': '$35 / month',
    'ad.flat':
      'Flat. No impressions, no bidding, no renewals held hostage — cancel any month.',
    'ad.startTitle': 'How it starts',
    'ad.start1': 'Write to me with your name, what you advertise and the link.',
    'ad.start2':
      'Your slot goes live on the next build — usually the same day — and you see it on the real site before paying anything.',
    'ad.start3': 'The payment link arrives with the confirmation. You only pay once it is live.',
    'ad.fits': 'What fits',
    'ad.fitsBody':
      "Games, game-dev tools, word-game and puzzle books, education, indie newsletters. Family-friendly only: no gambling, no crypto, no loot boxes, nothing you couldn't explain to a nine-year-old.",
    'ad.contact': 'Contact',
    'ad.contactBody': 'One line is enough to start:',

    /* ------------------------------------------------------------- 404 */
    'nf.title': 'Page not found',
    'nf.desc': 'That page does not exist on {site}.',
    'nf.h1': 'That page is not in the cabinet.',
    'nf.body':
      'It may have moved, or it never existed. The games all still work — pick one, or go back to the start.',
  },
  categories: {
    word: {
      short: 'Word',
      title: 'Word Games',
      description: 'Word puzzles you can play in under a minute. New challenges every day.',
    },
    puzzle: {
      short: 'Puzzle',
      title: 'Puzzle Games',
      description: 'Logic and number puzzles with instant restart and no waiting.',
    },
    arcade: {
      short: 'Arcade',
      title: 'Arcade Games',
      description: 'Classic arcade action, rebuilt for the browser and playable on a phone.',
    },
    brain: {
      short: 'Brain',
      title: 'Brain Games',
      description: 'Memory, attention and pattern games that train while you play.',
    },
    strategy: {
      short: 'Strategy',
      title: 'Strategy Games',
      description: 'Games about decisions, trust and systems. Think it through before you play.',
    },
    sandbox: {
      short: 'Sandbox & Tools',
      title: 'Sandbox & Tools',
      description: 'Open-ended toys for playing with ideas. No score, no timer, just make something.',
    },
    classics: {
      short: 'Classics',
      title: 'Classics',
      description:
        'Pong, Breakout, Space Invaders and the cabinets they came from. Same rules, no quarters.',
    },
    racing: {
      short: 'Racing',
      title: 'Racing Games',
      description: 'Top-down and side-scrolling racers you can steer with two thumbs.',
    },
    table: {
      short: 'Table',
      title: 'Table Games',
      description: 'Board and card games with no setup: sudoku, solitaire, mahjong, ludo, go.',
    },
  },
  families: {},
};

/**
 * Every leaf path the built-in map exposes: `site.*`, the flat `strings`
 * vocabulary and the three fields of each category. Tests compare the
 * catalogues against this list, so a key the builder asks for cannot exist in
 * one place only. `families.*` is data (genre templates over a harvested id
 * list) and is pinned by that list instead.
 */
function flattenKeys(value, path = '', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => flattenKeys(v, path ? `${path}.${i}` : String(i), out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flattenKeys(v, path ? `${path}.${k}` : k, out);
  } else out.push(path);
  return out;
}

export const CATALOG_KEYS = Object.freeze(flattenKeys(EN));

/** Deep merge of plain objects; arrays and scalars from `over` win outright. */
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v) && typeof base?.[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const cache = new Map();

/**
 * The catalog for `id`, merged over English.
 *
 * content/i18n/<id>.json -> content/i18n/en.json -> the built-in map. Missing
 * files are not an error: the build must work before the translations land,
 * and a half-filled file must still render a complete page.
 */
export function loadCatalog(id, { reload = false } = {}) {
  const locale = localeById(id);
  if (cache.has(locale.id) && !reload) return cache.get(locale.id);

  const read = (f) => {
    const path = join(root, 'content', 'i18n', `${f}.json`);
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      console.warn(`i18n: content/i18n/${f}.json is not valid JSON (${err.message}) — using English`);
      return {};
    }
  };

  const english = locale.id === DEFAULT_LOCALE ? {} : read(DEFAULT_LOCALE);
  const own = read(locale.id);

  let catalog = merge(merge(EN, english), own);
  // The catalog's own metadata always describes the tree being built: a file
  // with a stale "locale" field must not label French pages as English.
  catalog = {
    ...catalog,
    locale: locale.id,
    name: own.name || locale.name,
    hreflang: locale.hreflang,
    dir: own.dir || locale.dir,
  };
  cache.set(locale.id, catalog);
  return catalog;
}

/** Every catalog, keyed by locale id, in registry order. */
export function allCatalogs() {
  return LOCALES.map((l) => [l.id, loadCatalog(l.id)]);
}

/**
 * Look a dot path up in a catalog.
 *
 * Flat keys win (`"nav.games"` is a legal key), then the nested form
 * (`{nav:{games}}`), then the catalogue root so `categories.arcade.title`
 * and `families.snake.faq` resolve without a second function.
 */
function lookup(node, key) {
  if (!node || typeof node !== 'object' || !key) return undefined;
  if (typeof node[key] === 'string') return node[key];
  if (Array.isArray(node[key])) return node[key];
  if (node[key] && typeof node[key] === 'object') return node[key];
  let cur = node;
  for (const part of String(key).split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur === null ? undefined : cur;
}

/** Replace {name} placeholders. Unknown placeholders are left visible. */
export function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== undefined
      ? String(vars[name])
      : whole,
  );
}

/**
 * t(catalog, key, vars) — the string for `key`, in this order:
 * the locale's own catalog, English, the key's last segment.
 *
 * The result is always a string: `undefined` is not a legal answer here, and
 * neither is a raw dotted key leaking into a page.
 */
export function t(catalog, key, vars = {}) {
  const own = lookup(catalog?.strings, key) ?? lookup(catalog, key);
  if (typeof own === 'string') return interpolate(own, vars);

  const english = lookup(EN.strings, key) ?? lookup(EN, key);
  if (typeof english === 'string') return interpolate(english, vars);

  if (process.env.AF_I18N_STRICT) {
    console.warn(`i18n: missing key "${key}"`);
  }
  // Last resort: a readable word instead of a dotted key or "undefined".
  const tail = String(key ?? '').split('.').pop() || '';
  return tail.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
}

/** t() for a whole array (how-to steps, FAQ answers). Never returns holes. */
export function tList(catalog, key, vars = {}) {
  const own = lookup(catalog?.strings, key) ?? lookup(catalog, key) ?? lookup(EN.strings, key);
  if (!Array.isArray(own)) return [];
  return own.filter((s) => typeof s === 'string' && s.trim()).map((s) => interpolate(s, vars));
}

/** The localised category title, or the catalogue's own title as a last resort. */
export function categoryTitle(catalog, id, fallback) {
  const own = catalog?.categories?.[id]?.title;
  if (typeof own === 'string' && own.trim()) return own;
  const en = EN.categories[id]?.title;
  return en ?? fallback ?? id;
}

/** The localised category description, or the catalogue's own as a last resort. */
export function categoryDescription(catalog, id, fallback) {
  const own = catalog?.categories?.[id]?.description;
  if (typeof own === 'string' && own.trim()) return own;
  const en = EN.categories[id]?.description;
  return en ?? fallback ?? '';
}

/** The genre template for a game, if the catalog carries one. */
export function familyFor(catalog, game) {
  const families = catalog?.families;
  if (!families || typeof families !== 'object') return null;
  const slug = (s) =>
    String(s ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const firstWord = (String(game?.title ?? '').toLowerCase().match(/[a-z0-9]+/) ?? [])[0] ?? '';
  const candidates = [game?.id, slug(game?.title), firstWord, game?.category].filter(Boolean);
  for (const key of candidates) {
    const hit = families[key];
    if (hit && typeof hit === 'object') return hit;
  }
  // Case/slug-insensitive second pass: families may be keyed "Word Search".
  const wanted = new Set([slug(game?.id), slug(game?.title), firstWord]);
  for (const [key, value] of Object.entries(families)) {
    if (value && typeof value === 'object' && wanted.has(slug(key))) return value;
  }
  return null;
}

/**
 * A game's copy in one locale: everything a page says about it.
 *
 * content/games.json is English data - one tagline, one description, one set of
 * steps and one FAQ per game, all written in English and rewritten by the
 * harvest - so a translated chrome over it still reads as English on /fr/ and
 * /ar/. `families` in content/i18n/*.json holds the same four fields translated
 * per genre, which is what a localised page shows instead.
 *
 * The order is deliberate:
 *
 *   1. English gets the game's own words. They name the thing ("the board wraps
 *      at the edges"); a genre template only generalises, which would be a
 *      regression on the pages the catalogue was written for.
 *   2. Any other locale gets the template for the resolved family. A game no
 *      genre claims resolves to `families.generic`, written to be true of any
 *      browser game rather than false about this one - so it is used, not the
 *      English sentence a French reader cannot read.
 *   3. No template anywhere (a catalog without `families`): the English values.
 *      An untranslated sentence beats a blank one, a dotted key or "undefined".
 *
 * Never returns a hole - every field is a non-empty string or a non-empty list,
 * so a caller can render the result without checking it first. The title is not
 * part of it: a game's name is a proper noun and stays as it is in every tree.
 */
export function gameCopy(catalog, game, locale) {
  const g = game ?? {};
  const asked = String(locale ?? catalog?.locale ?? DEFAULT_LOCALE).trim().toLowerCase();
  const id = LOCALES.some((l) => l.id === asked) ? asked : DEFAULT_LOCALE;
  const text = (v) => (typeof v === 'string' && v.trim() ? v : '');
  const stepsOf = (list) =>
    (Array.isArray(list) ? list : []).map(text).filter((s) => s.trim().length > 3);
  const answersOf = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((f) => f && text(f.q) && text(f.a))
      .map((f) => ({ q: text(f.q).trim(), a: text(f.a).trim() }));
  const firstSentence = (v) => (String(v ?? '').split(/(?<=[.!?])\s+/)[0] ?? '').trim();

  const title = text(g.title).trim() || text(g.id).trim();
  const ownDescription = text(g.description);
  const own = {
    tagline: text(g.tagline).trim() || firstSentence(ownDescription) || title,
    description: ownDescription || text(g.tagline).trim() || title,
    howToPlay: stepsOf(g.howToPlay),
    faq: answersOf(g.faq),
  };

  const family = familyFor(catalog, game) ?? catalog?.families?.generic ?? null;
  const familySteps = family ? stepsOf(family.howToPlay) : [];
  const familyFaq = family ? answersOf(family.faq) : [];
  const familyCopy = family
    ? {
        tagline: text(family.tagline).trim(),
        description: text(family.description).trim(),
        howToPlay: familySteps,
        faq: familyFaq,
      }
    : null;

  if (id !== DEFAULT_LOCALE && familyCopy) {
    // Per field, not all-or-nothing: a template missing its FAQ still gives the
    // page translated steps instead of throwing the whole copy away.
    return {
      tagline: familyCopy.tagline || own.tagline,
      description: familyCopy.description || own.description,
      howToPlay: familyCopy.howToPlay.length ? familyCopy.howToPlay : own.howToPlay,
      faq: familyCopy.faq.length ? familyCopy.faq : own.faq,
    };
  }

  // English, or a locale with no template to offer.
  const defaultSteps = ['game.howToDefault1', 'game.howToDefault2', 'game.howToDefault3']
    .map((key) => t(catalog, key, { title: title || 'this game' }))
    .filter((s) => typeof s === 'string' && s.trim());
  return {
    tagline: own.tagline,
    description: own.description,
    howToPlay: own.howToPlay.length
      ? own.howToPlay
      : familySteps.length
        ? familySteps
        : defaultSteps,
    faq: own.faq.length ? own.faq : familyFaq,
  };
}

/* --------------------------------------------------------------- URLs */

/**
 * A locale-neutral path in a locale's tree.
 *
 *   localePath('fr', '/games/snake/') === '/fr/games/snake/'
 *   localePath('en', '/games/snake/') === '/games/snake/'
 *   localePath('',   '/games/snake/') === '/games/snake/'
 */
export function localePath(localeOrPrefix, path = '/') {
  const prefix =
    typeof localeOrPrefix === 'string'
      ? localeOrPrefix.startsWith('/')
        ? localeOrPrefix
        : (localeById(localeOrPrefix).prefix ?? '')
      : (localeOrPrefix?.prefix ?? '');
  let p = String(path ?? '/');
  if (!p.startsWith('/')) p = `/${p}`;
  if (!prefix) return p;
  return p === '/' ? `${prefix}/` : `${prefix}${p}`;
}

/** Absolute URL of `path` inside `locale`'s tree. */
export function absoluteUrl(locale, path, baseUrl) {
  const base = String(baseUrl ?? '').replace(/\/*$/, '/');
  return new URL(localePath(locale, path).replace(/^\//, ''), base).href;
}

/**
 * The four alternates for a page: one per locale plus x-default on English.
 *
 * Every page in the tree carries this set, including the English one - a set
 * that only appears on the translated pages is not a cluster, it is a
 * suggestion.
 */
export function alternatesFor(path, baseUrl) {
  const links = LOCALES.map((l) => ({
    hreflang: l.hreflang,
    href: absoluteUrl(l, path, baseUrl),
    id: l.id,
  }));
  links.push({
    hreflang: 'x-default',
    href: absoluteUrl(DEFAULT_LOCALE, path, baseUrl),
    id: 'x-default',
  });
  return links;
}

/** The `hreflang` link tags for a page, as markup. */
export function hreflangTags(path, baseUrl, esc = (s) => String(s)) {
  return alternatesFor(path, baseUrl)
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`)
    .join('\n');
}
