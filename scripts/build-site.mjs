/**
 * Static site builder for spielkunst.
 *
 * Runs after `vite build` and writes the HTML into dist/.
 * Everything is deterministic: same inputs -> same output, so the nightly
 * rebuild only adds new pages instead of churning URLs.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, cpSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import content from '../content/games.json' with { type: 'json' };
import generated from '../content/games.generated.json' with { type: 'json' };
import sponsors from '../content/sponsors.json' with { type: 'json' };
import { gameShell, embedShell } from './shell.mjs';

// The arcade's own pages get the strict policy as a meta tag rather than a
// response header: Cloudflare applies *every* matching _headers rule to a path
// and the browser intersects two CSP headers, so a permissive /third-party/*
// rule could never relax a global /* one. The first deployment of that split
// carried both headers on every game page and the games stayed blocked. A meta
// tag applies to the pages that carry it, and to nothing else.
const STRICT_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' blob:",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "frame-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const STRICT_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${STRICT_CSP}">`;
import { gameIcon, iconSprite, glyph, brandMark, tileAccent } from './icons.mjs';
import { cleanTagline, creditLicence } from './content-utils.mjs';
import { sanitizeHtml } from './sanitize-embed.mjs';
import { mergeCatalogue, layerGames } from './catalogue.mjs';
import { pruneVendored } from './prune-vendored.mjs';
import {
  LOCALES,
  DEFAULT_LOCALE,
  loadCatalog,
  t as translate,
  tPlural,
  tList,
  localePath,
  alternatesFor,
  categoryTitle,
  categoryDescription,
  gameCopy,
} from './i18n.mjs';
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
 * stage. Adding one here is the whole change: CSS block + this entry + the
 * coat's name and hint in the three catalogues (`theme.<id>.name` /
 * `theme.<id>.hint`).
 *
 * The name and the hint are *not* here: they are chrome, so they live in
 * content/i18n/, and a French page says "Borne d'arcade · cabinet ambré"
 * rather than "Coin-op · amber cabinet". ui.js keeps learning the picker's
 * label from the button, so the contract is unchanged.
 */
export const THEMES = [
  { id: 'signal', sw: '#c9f94b', sw2: '#08090a' },
  { id: 'lights', sw: '#c2f23f', sw2: '#f7f4ec' },
  { id: 'coinop', sw: '#ffb648', sw2: '#0d0907' },
  { id: 'ice', sw: '#4fe3ff', sw2: '#050b12' },
  { id: 'dmg', sw: '#9bbc0f', sw2: '#0b1410' },
  { id: 'vapor', sw: '#ff6ec7', sw2: '#0d0716' },
  { id: 'pixel', sw: '#ffcc4d', sw2: '#14121f' },
  { id: 'crt', sw: '#39ff88', sw2: '#04120c' },
  { id: 'newsprint', sw: '#b3402e', sw2: '#f2efe4', light: true },
];
/** A coat's name and caption in the active language. */
const coatName = (theme) => tn(`theme.${theme.id}.name`);
const coatHint = (theme) => tn(`theme.${theme.id}.hint`);
/** Themes whose stage is paper, not a screen: the browser chrome follows. */
const LIGHT_THEMES = THEMES.filter((t) => t.light).map((t) => t.id);
/**
 * The one count that JavaScript writes: the filter status on /games/.
 *
 * ui.js composes that line from two strings - `{count} game` for exactly one
 * hit, `{count} games` for everything else - because it ships as a static file
 * with no plural data in it. On a French page that renders "0 jeux", and in
 * Arabic it can only ever be right for two of the language's six forms.
 *
 * The builder knows the language, so it ships the full table with the page and
 * gives the element that holds the sentence a plural-aware setter: the count is
 * the first thing in the line, so the leading number plus the words ui.js put
 * after it are replaced with the form this language's plural rule selects.
 * Everything after that ("matching “tetris”", the pager note) is left exactly
 * as ui.js wrote it. Without Intl.PluralRules the setter is not installed and
 * the page is what it was before.
 */
function statusPluralScript() {
  const forms = Object.fromEntries(
    ['zero', 'one', 'two', 'few', 'many', 'other'].map((category) => [
      category,
      translate(L.catalog, `count.games_${category}`),
    ]),
  );
  const legacy = {
    one: translate(L.catalog, 'count.games_one'),
    many: translate(L.catalog, 'count.games'),
  };
  return `<script>
/* The filter status counts games: the plural rule for that count is the
   reader's language, not English's one-or-not-one. */
(function () {
  var el = document.getElementById('filter-status');
  var desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (!el || !desc || !desc.set || !desc.get || !window.Intl || !Intl.PluralRules) return;
  var FORMS = ${JSON.stringify(forms)};
  var LEGACY = ${JSON.stringify(legacy)};
  var rules;
  try { rules = new Intl.PluralRules(document.documentElement.lang || 'en'); } catch (e) { return; }
  function form(n) {
    var tpl = FORMS[rules.select(n)] || FORMS.other || LEGACY.many;
    return String(tpl).replace(/\\{count\\}/g, n);
  }
  function repair(text) {
    var hit = /^(\\d+)/.exec(text);
    if (!hit) return text;
    var n = Number(hit[1]);
    var used = (n === 1 ? LEGACY.one : LEGACY.many).replace(/\\{count\\}/g, n);
    if (text.indexOf(used) !== 0) return text;
    var better = form(n);
    return better === used ? text : better + text.slice(used.length);
  }
  Object.defineProperty(el, 'textContent', {
    configurable: true,
    get: function () { return desc.get.call(el); },
    set: function (value) { desc.set.call(el, repair(String(value))); },
  });
})();
</script>`;
}

/**
 * Read an optional catalogue layer from content/.
 *
 * `content/engine-new.json` and `content/harvest-published.json` are written by
 * other chunks of the same job and may not exist yet, so a missing file is an
 * empty layer rather than a build failure - a static `import ... with { type:
 * 'json' }` cannot express that (it throws at load time, before any code runs).
 */
function readJsonLayer(rel) {
  const file = join(root, rel);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${rel} is not valid JSON: ${err.message}`);
  }
}

/**
 * One catalogue, five layers plus overlays. Earlier layers win by id, so
 * nothing the harvest regenerates can overwrite hand-written curation, and the
 * overlays in content/overlays.json are applied last. See scripts/catalogue.mjs.
 */
export const GAMES = mergeCatalogue({
  base: content.games ?? [],
  engine: layerGames(readJsonLayer('content/engine-new.json')),
  curated: layerGames(readJsonLayer('content/curated.json')),
  published: layerGames(readJsonLayer('content/harvest-published.json')),
  generated: generated.games ?? [],
  overlays: readJsonLayer('content/overlays.json').games ?? {},
});
/**
 * Drop any game whose embedded files are not on disk.
 *
 * Validation deletes games that do not play, but a catalogue layer written
 * before that run can still reference one - which shipped a page whose iframe
 * 404s. The build is the last place this can be caught cheaply, and a missing
 * page is better than a broken one.
 */
const vendored = GAMES.filter((game) => {
  const src = game.embed?.src;
  if (!src) return true;
  const rel = src.replace(/^\//, '').split('?')[0];
  // Vendored games link filenames with spaces percent-encoded; the file on
  // disk is the decoded name, so an encoded check dropped five working games.
  let decoded = rel;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    /* malformed escape: fall through with the raw path */
  }
  return existsSync(join(root, rel)) || existsSync(join(root, decoded));
});
if (vendored.length !== GAMES.length) {
  console.log(`spielkunst: dropped ${GAMES.length - vendored.length} game(s) whose files are gone`);
}
GAMES.length = 0;
GAMES.push(...vendored);

const CATEGORIES = content.categories.filter((c) => GAMES.some((g) => g.category === c.id));

const PAST_DAYS = 30;
const FUTURE_DAYS = 7;

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const abs = (path) => new URL(path, SITE.baseUrl).href;

/* ------------------------------------------------------------- locales */

/**
 * The locale being emitted right now.
 *
 * The builder is synchronous and single threaded, so the active locale is
 * module state rather than a parameter on fifteen functions: `useLocale()` is
 * called once per tree in main(), and everything below - paths, headings,
 * sitemap entries - reads it. Rendering English is exactly what it always
 * was, because English's prefix is the empty string.
 */
const catalogs = new Map();
function catalogOf(id) {
  if (!catalogs.has(id)) catalogs.set(id, loadCatalog(id));
  return catalogs.get(id);
}
function makeLocale(id) {
  const meta = LOCALES.find((l) => l.id === id) ?? LOCALES[0];
  return { ...meta, catalog: catalogOf(meta.id) };
}
let L = makeLocale(LOCALES[0].id);

/** Switch the active locale; returns it so a caller can log or assert. */
function useLocale(id) {
  L = makeLocale(id);
  return L;
}

/** A path inside the active tree: '/games/x/' -> '/fr/games/x/'. */
const lp = (path = '/') => localePath(L, path);

/** Absolute URL of a page in the active tree (canonicals, sitemaps, JSON-LD). */
const pageUrl = (path = '/') => abs(lp(path));

/**
 * Escape for text and double-quoted attributes.
 *
 * Same as esc() minus the apostrophe: `Today&#39;s grid` is valid but it
 * churns every hashed byte of the English pages for no benefit, and a bare
 * apostrophe is legal in both text nodes and double-quoted attributes.
 */
const tesc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The message for `key`, in the reader's language, with the language's own
 * plural form when the call carries a count.
 *
 * `{count}` used to be resolved by the caller with `n === 1 ? 'key_one' :
 * 'key'`, which is the English rule - French says "0 jeu" and Arabic has six
 * forms. Every count goes through tPlural now, so a call site only has to pass
 * the number; a key with no variants still resolves to itself.
 */
function message(key, vars) {
  return typeof vars?.count === 'number'
    ? tPlural(L.catalog, key, vars.count, vars)
    : translate(L.catalog, key, vars ?? {});
}

/** Localised text, escaped. Falls back to English per key, never to undefined. */
function tn(key, vars) {
  return tesc(message(key, vars));
}

/**
 * Localised text for a place that escapes on its own - <title>, a meta
 * description, an og: field. layout() runs esc() over all of them, so a
 * value escaped here as well would reach the page as `&amp;amp;`.
 */
function plain(key, vars) {
  return message(key, vars);
}

/**
 * Localised text that carries markup, emitted as-is.
 *
 * Some sentences have a link in the middle of them ("...the daily puzzle
 * archive keeps every past grid"), and the link has to be translatable in
 * place, not glued on afterwards. Those catalog strings are trusted markup -
 * they live in this repo - and the values in `vars` are escaped by the caller
 * (an href, a count), so the only thing a translator controls is where the
 * link sits.
 */
function rich(key, vars = {}) {
  return message(key, vars);
}

/** Category title / short label / description in the active locale. */
const catTitle = (c) => categoryTitle(L.catalog, c.id, c.title);
const catShort = (c) => {
  const own = L.catalog?.categories?.[c.id]?.short;
  if (typeof own === 'string' && own.trim()) return own;
  return catTitle(c).replace(/\s+Games$/i, '');
};
/**
 * The category name as it reads mid-sentence.
 *
 * English wants it lowercased ("565 free word games"); German capitalises
 * every noun, so `title.toLowerCase()` produced "565 kostenlose wortspiele".
 * The registry says which way a language writes a common noun (`nounCase`),
 * so no locale is branched on by name here.
 */
const catLower = (c) => (L.nounCase === 'caps' ? catTitle(c) : catTitle(c).toLowerCase());
const catDesc = (c) => categoryDescription(L.catalog, c.id, c.description);

/**
 * The name of a rotating word list, in the reader's language.
 *
 * The words themselves stay English - they are the puzzle - but "Retro Arcade"
 * is chrome, and chrome is translated. An id with no catalogue entry falls
 * back to the harvested title rather than to a dotted key.
 */
const themeName = (theme) => {
  const own = L.catalog?.strings?.[`daily.theme.${theme?.id}`];
  return typeof own === 'string' && own.trim() ? own : String(theme?.title ?? '');
};

/**
 * The "how to play" lines of a game, as plain sentences.
 *
 * The catalogue used to hold objects where strings belong, which rendered
 * as "[object Object]" on every game page. Anything that is not a usable
 * sentence is dropped here, and a page never renders an empty list.
 *
 * The lines come from the copy `gameCopy` resolved for this tree: the game's
 * own steps in English, the genre template outside it. English keeps the
 * stricter length cut because the catalogue's own lines are prose, while a
 * translated template line can be short and still be a sentence.
 */
function howToLines(copy, game) {
  const min = L.id === DEFAULT_LOCALE ? 12 : 3;
  const lines = (Array.isArray(copy?.howToPlay) ? copy.howToPlay : [])
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > min);
  if (lines.length) return lines.slice(0, 5);
  return [
    translate(L.catalog, 'game.howToDefault1', { title: game.title }),
    translate(L.catalog, 'game.howToDefault2', { title: game.title }),
    translate(L.catalog, 'game.howToDefault3', { title: game.title }),
  ];
}

/**
 * A game's copy for the tree being built, resolved once per game.
 *
 * A game page, its tile on the index and the rail inside the game all ask for
 * the same four fields, and the homepage carries all 464 games, so the family
 * lookup is memoised per tree: the catalogue is English data and the genre
 * template is the localised version of it (see gameCopy in scripts/i18n.mjs).
 */
const copyCache = new Map();
function copyFor(game) {
  const key = `${L.id}\u0000${game?.id ?? ''}`;
  const hit = copyCache.get(key);
  if (hit) return hit;
  const copy = gameCopy(L.catalog, game, L.id);
  copyCache.set(key, copy);
  return copy;
}

/**
 * The game with its localised tagline and description attached - the shape
 * shell.mjs and cleanTagline read. Titles, ids, categories, accents and credit
 * are left alone: a name is a proper noun, not prose.
 */
function localGame(game) {
  const copy = copyFor(game);
  return { ...game, tagline: copy.tagline, description: copy.description };
}

/** Write a page into the active locale's tree: 'index.html' -> /fr/index.html. */
function write(relPath, html) {
  const clean = String(relPath).replace(/^\/+/, '');
  const file = L.prefix ? join(dist, L.prefix.slice(1), clean) : join(dist, clean);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

/** Write a file once at the site root (sitemaps, robots): never per locale. */
function writeRoot(relPath, body) {
  const file = join(dist, String(relPath).replace(/^\/+/, ''));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

/** The strings ui.js needs to finish a page after load, shipped as JSON. */
function uiStrings() {
  const s = (key) => translate(L.catalog, key);
  return {
    locale: L.id,
    prefix: L.prefix,
    dir: L.dir,
    strings: {
      match: s('index.status.match'),
      in: s('index.status.in'),
      all: s('index.status.all'),
      broken: s('index.status.broken'),
      page: s('index.status.page'),
      one: s('count.games_one'),
      many: s('count.games'),
    },
  };
}

function layout({
  title,
  description,
  path = '/',
  canonical,
  head = '',
  body = '',
  bodyClass = '',
  bodyAttrs = '',
  script = '',
  jsonLd = null,
  alternates = true,
  indexable = true,
}) {
  // Canonical is self-referencing and absolute, in this page's own tree: a
  // page that points at another language's URL is telling Google not to
  // serve it.
  const canon = canonical ?? pageUrl(path);
  const altTags = alternates
    ? alternatesFor(path, SITE.baseUrl)
        .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`)
        .join('\n')
    : '';
  const ogAlt = LOCALES.filter((l) => l.id !== L.id)
    .map((l) => `<meta property="og:locale:alternate" content="${esc(l.ogLocale)}">`)
    .join('\n');
  return `<!doctype html>
<html lang="${L.id}" dir="${L.dir}" data-locale="${L.id}" class="no-js">
<head>
<meta charset="utf-8">
${STRICT_CSP_META}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="language" content="${esc(L.id)}">
${indexable ? '' : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${esc(canon)}">
${altTags}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(abs('/og.png'))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)} — ${tn('site.tagline')}">
<meta property="og:locale" content="${esc(L.ogLocale)}">
${ogAlt}
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
  var ok = ${JSON.stringify(THEMES.map((t) => t.id))};
  var light = ${JSON.stringify(LIGHT_THEMES)};
  var t = 'signal';
  try {
    var saved = localStorage.getItem('af_theme');
    if (saved && ok.indexOf(saved) !== -1) t = saved;
  } catch (e) {}
  r.setAttribute('data-theme', t);
  r.setAttribute('data-chrome', light.indexOf(t) !== -1 ? 'light' : 'dark');
  r.classList.remove('no-js');
  r.classList.add('js');
})();
</script>
${head}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}"${bodyAttrs ? ' ' + bodyAttrs : ''}${L.dir === 'rtl' ? ' dir="rtl"' : ''}>
<a class="skip-link" href="#main">${tn('a11y.skip')}</a>
${iconSprite()}
${body}
${script}
<script id="af-i18n" type="application/json">${JSON.stringify(uiStrings()).replace(/</g, '\\u003c')}</script>
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
/**
 * Ticket-stub stamp for today's date, e.g. "TODAY'S TOKEN * OCT 24".
 *
 * The words come from the catalogue and the date is formatted for the page's
 * own locale, so an Arabic stub does not read "TODAY'S TOKEN * OCT 24".
 */
function ticketStamp(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const stamp = Number.isNaN(parsed.getTime())
    ? String(date ?? '')
    : new Intl.DateTimeFormat(L.id, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed);
  return tn('home.ticket', { date: stamp });
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
      <b>${esc(s.title)}</b><span>${esc(s.subtitle ?? '')}</span><em>${tn('home.sponsored')}</em>
    </a>`,
  );
  for (let i = real.length; i < count; i++) {
    cards.push(
      `<a class="ad-slot ad-open" href="${lp('/advertise/')}">
        <b>${tn('home.slot.title')}</b>
        <span>${tn('home.slot.body')}</span>
        <em>${tn('home.slot.price')}</em>
      </a>`,
    );
  }
  return cards.join('');
}

/* ------------------------------------------------------------ site pages */

/**
 * The language switcher: three real links, not a menu.
 *
 * Every link points at the same page in another tree, so a reader who is on
 * page 3 of the games index (or on a 2001 daily answer page) stays exactly
 * where they are and only the language changes. It works with JavaScript
 * off, which a <select> would not.
 */
function langSwitcher(path) {
  // Three real links. Every rule that draws them - spacing, the active pill,
  // the 32px touch target that keeps them on one row at 375px - lives in
  // public/styles.css under .lang-switch: inline styles here would beat the
  // stylesheet and stack the three codes on a phone.
  const items = LOCALES.map((l) => {
    const current = l.id === L.id;
    return `<a href="${esc(localePath(l, path))}" data-lang="${l.id}" lang="${l.id}" title="${esc(
      l.name,
    )}"${current ? ' aria-current="page"' : ''}>${l.id.toUpperCase()}</a>`;
  }).join('');
  return `<nav class="lang-switch" aria-label="${tn('a11y.lang')}" data-locale="${L.id}">${items}</nav>`;
}

function siteHeader(path = '/') {
  // A nav item is current for a whole subtree: page 3 of the index keeps
  // /games/ lit, a dated daily page keeps /daily/ lit.
  const active = path.startsWith('/games/page/')
    ? '/games/'
    : path.startsWith('/daily/')
      ? '/daily/'
      : path;
  const links = [
    { href: '/games/', label: tn('nav.games') },
    ...CATEGORIES.slice(0, 5).map((c) => ({
      href: `/categories/${c.id}/`,
      label: esc(catShort(c)),
    })),
    { href: '/daily/', label: tn('nav.daily') },
  ];
  const nav = links
    .map(
      (l) =>
        `<a href="${lp(l.href)}"${l.href === active ? ' aria-current="page"' : ''}>${l.label}</a>`,
    )
    .join('');
  return `<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${lp('/')}" aria-label="${tn('brand.home')}">${brandMark()}<span>spiel<b>kunst</b></span></a>
    <nav class="site-nav" aria-label="${tn('nav.main')}">${nav}</nav>
    <div class="top-tools">
      ${langSwitcher(path)}
      <form class="search" action="${lp('/games/')}" method="get" role="search">
        ${glyph('a-search', 15)}
        <input type="search" name="q" placeholder="${tn('search.placeholder', { count: GAMES.length })}" aria-label="${tn('search.label')}" autocomplete="off" spellcheck="false">
        <kbd>/</kbd>
      </form>
      <div class="theme-menu">
        <button class="theme-btn" id="btn-theme" type="button" aria-haspopup="menu"
                aria-expanded="false" aria-controls="theme-pop" aria-label="${tn('theme.button', { name: coatName(THEMES[0]) })}">
          <span class="sw" aria-hidden="true"></span>
        </button>
        <div class="theme-pop" id="theme-pop" role="menu" aria-label="${tn('theme.label')}" hidden>
          <p class="theme-pop-label">${tn('theme.label')}</p>
          ${THEMES.map(
            (t) => `<button class="theme-item" type="button" role="menuitemradio" aria-checked="false"
              data-theme-id="${t.id}"${t.light ? ' data-light="1"' : ''} style="--sw:${t.sw};--sw2:${t.sw2}">
              <span class="sw" aria-hidden="true"></span>
              <span class="nm">${coatName(t)}<em>· ${coatHint(t)}</em></span>
            </button>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <nav class="nav-strip" aria-label="${tn('nav.categories')}">${nav}</nav>
</header>`;
}

function siteFooter(path = '/') {
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
    ? rich('foot.tips', { links: tipLinks })
    : rich('foot.free', { href: esc(lp('/advertise/')) });
  return `<footer class="site-footer"><div class="wrap">
  <a class="brand" href="${lp('/')}">${brandMark(24)}<span>spiel<b>kunst</b></span></a>
  <p><strong>${tn('foot.count', { count: GAMES.length })}</strong> ${tn('foot.blurb')}</p>
  <p class="foot-tips">${tipsLine}</p>
  <nav class="foot-nav" aria-label="${tn('nav.footer')}">
    <a href="${lp('/games/')}">${tn('foot.nav.games')}</a>
    <a href="${lp('/daily/')}">${tn('foot.nav.archive')}</a>
    <a href="${lp('/advertise/')}">${tn('foot.nav.sponsor')}</a>
    <a href="${lp('/credits/')}">${tn('foot.nav.credits')}</a>
    <a href="/sitemap.xml">${tn('foot.nav.sitemap')}</a>
  </nav>
  ${
    thirdParty.length
      ? `<p class="foot-note">${rich('foot.thirdParty', {
          count: thirdParty.length,
          href: esc(lp('/credits/')),
        })}</p>`
      : ''
  }
  ${langSwitcher(path)}
  <p class="copyright">${tn('foot.copyright', { year, site: SITE.name })}</p>
</div></footer>`;
}

function gameTiles(ids, opts = {}) {
  const gridClass = opts.featured ? 'grid grid-featured' : 'grid';
  const start = opts.start ?? 0;
  return `<div class="${gridClass}"${opts.id ? ` id="${opts.id}"` : ''}>${ids
    .map((g, i) => {
      const cat = CATEGORIES.find((c) => c.id === g.category);
      const accent = tileAccent(g);
      const kw = [g.title, g.category, cat ? catTitle(cat) : '', ...(g.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return `<a class="tile${opts.noReveal ? '' : ' reveal'}" href="${lp(`/games/${g.id}/`)}"
   data-name="${esc(g.title.toLowerCase())}" data-cat="${esc(g.category)}" data-kw="${esc(kw)}"
   style="--tile-accent:${esc(accent)};--glow:${esc(accent)};--i:${i + start}">
      <div class="thumb">${gameIcon(g.id, g.accent, g.category)}</div>
      ${g.credit ? `<span class="badge">${tn('tile.openSource')}</span>` : ''}
      <h3>${esc(g.title)}</h3>
      <p>${esc(cleanTagline(localGame(g)))}</p>
      ${cat ? `<span class="tag">${esc(catShort(cat))}</span>` : ''}
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
  const siteDesc = translate(L.catalog, 'site.description');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: pageUrl('/'),
    inLanguage: L.id,
    description: siteDesc,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${pageUrl('/games/')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const catCard = (c) => {
    const n = GAMES.filter((g) => g.category === c.id).length;
    return `<a class="cat-card" href="${lp(`/categories/${c.id}/`)}" style="--c:${esc(c.accent)}">
      <span class="cat-dot" aria-hidden="true"></span>
      <h3>${esc(catTitle(c))}</h3>
      <p>${esc(catDesc(c))}</p>
      <span class="cat-count">${tn('count.games', { count: n })} <span class="cat-arrow" aria-hidden="true">${L.dir === 'rtl' ? '←' : '→'}</span></span>
    </a>`;
  };

  const body = `${siteHeader('/')}
<main id="main">
<div class="wrap">
  <section class="hero hero-split">
    <div class="hero-copy">
      <p class="kicker"><i></i>${tn('home.kicker', { count: GAMES.length })}</p>
      <h1>${tn('home.h1.pre')}<em>${tn('home.h1.em')}</em>${tn('home.h1.post')}</h1>
      <p class="lede">${esc(siteDesc)} ${tn('home.lede')}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="${lp('/games/')}">${tn('home.browseAll', { count: GAMES.length })}</a>
        <button class="btn" id="btn-random" type="button">${glyph('a-dice', 18)} ${tn('home.random')}</button>
      </div>
      <ul class="trust">
        <li>${glyph('a-bolt', 15)} ${tn('home.trust1')}</li>
        <li>${glyph('a-wifi-off', 15)} ${tn('home.trust2')}</li>
        <li>${glyph('a-shield', 15)} ${tn('home.trust3')}</li>
      </ul>
    </div>

    <aside class="hero-card" aria-labelledby="today-card-title">
      <div class="hero-card-head">
        <h2 id="today-card-title">${tn('home.today')}</h2>
        <span class="ticket">${ticketStamp(today)}</span>
      </div>
      ${miniBoard(board)}
      <div class="hero-card-foot">
        <span class="meta">${esc(themeName(theme))} · ${tn('home.words', { count: wordCount })} · ${today}</span>
        <a class="btn btn-primary" href="${lp(`/daily/${today}/`)}" style="height:38px;padding:0 14px;font-size:13.5px">${tn('home.play')} ${glyph('a-arrow', 15)}</a>
      </div>
    </aside>
  </section>
</div>
</main>

<section class="ticker" aria-hidden="true"><div class="ticker-track"><span class="ticker-set">${[
    tn('home.ticker1'),
    tn('home.ticker2', { count: GAMES.length }),
    tn('home.ticker3'),
    tn('home.ticker4'),
    tn('home.ticker5'),
  ]
    .map((t) => `<b>${t}</b><i>◆</i>`)
    .join('')}</span></div></section>

<div class="wrap">
  <section class="stats-strip" aria-label="${tn('home.stats.label')}">
    <span><b>${GAMES.length}</b><i>${tn('home.stats.games')}</i></span>
    <span><b>1</b><i>${tn('home.stats.daily')}</i></span>
    <span><b>0</b><i>${tn('home.stats.accounts')}</i></span>
    <span><b>$0</b><i>${tn('home.stats.forever')}</i></span>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>${tn('home.start')}</h2>
      <a class="section-more" href="${lp('/games/')}">${tn('home.allGames', { count: GAMES.length })} ${glyph('a-arrow', 15)}</a>
    </div>
    ${gameTiles(featured.slice(0, 12))}
  </section>

  <section class="section">
    <div class="section-head">
      <h2>${tn('home.mood')}</h2>
      <a class="section-more" href="${lp('/games/')}">${tn('home.everything')} ${glyph('a-arrow', 15)}</a>
    </div>
    <div class="cat-grid">${CATEGORIES.map(catCard).join('')}</div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>${tn('home.todayPuzzle')}</h2>
      <span class="pill"><i></i>${tn('home.midnight')}</span>
    </div>
    <div class="grid grid-featured">
      <a class="tile" href="${lp(`/daily/${today}/`)}" style="--glow:var(--coin)">
        <div class="thumb">${gameIcon('wordsearch', theme.accent)}</div>
        <h3>${tn('home.daily.title')}</h3>
        <p>${tn('home.daily.body', { theme: themeName(theme), date: today, count: wordCount })}</p>
        <span class="tag">${tn('home.daily.tag')}</span>
      </a>
      <a class="tile" href="${lp(`/daily/${today}/answers/`)}" style="--glow:var(--coin)">
        <div class="thumb thumb-plain" style="font-size:34px">?</div>
        <h3>${tn('home.answers.title')}</h3>
        <p>${tn('home.answers.body')}</p>
        <span class="tag">${tn('home.answers.tag')}</span>
      </a>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>${tn('home.cabinet')}</h2>
      <a class="section-more" href="${lp('/games/')}">${tn('home.seeAll', { count: GAMES.length })} ${glyph('a-arrow', 15)}</a>
    </div>
    ${gameTiles(featured.slice(12, 36), { start: 6, id: 'cabinet-grid' })}
  </section>

  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>${tn('home.recent')}</h2>
      <span class="pill">${tn('home.device')}</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>

  <section class="section" id="sponsor-slots">
    <div class="section-head">
      <h2>${tn('home.slots')}</h2>
      <a class="section-more" href="${lp('/advertise/')}">${tn('home.advertise')} ${glyph('a-arrow', 15)}</a>
    </div>
    <div class="ad-grid">${advertiseSlots()}</div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>${tn('home.why')}</h2>
    </div>
    <div class="feature-grid">
      <div class="feature">${glyph('a-bolt', 22)}
        <h3>${tn('home.f1.title')}</h3>
        <p>${tn('home.f1.body')}</p>
      </div>
      <div class="feature">${glyph('a-shield', 22)}
        <h3>${tn('home.f2.title')}</h3>
        <p>${tn('home.f2.body')}</p>
      </div>
      <div class="feature">${glyph('a-coin', 22)}
        <h3>${tn('home.f3.title')}</h3>
        <p>${tn('home.f3.body')}</p>
      </div>
    </div>
  </section>

  <section class="section prose">
    <h2>${tn('home.about', { site: SITE.name })}</h2>
    <p>${rich('home.about1', { archive: esc(lp('/daily/')) })}</p>
    <p>${rich('home.about2', {
      count: GAMES.filter((g) => g.credit).length,
      credits: esc(lp('/credits/')),
    })}</p>
  </section>
</div>
</main>
<script id="af-catalog-json" type="application/json">${JSON.stringify(
    GAMES.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent })),
  ).replace(/</g, '\\u003c')}</script>
${siteFooter('/')}`;
  write('index.html', layout({
    title: `${SITE.name} — ${plain('home.title')}`,
    description: siteDesc,
    path: '/',
    body,
    jsonLd,
  }));
}

function buildCategory(cat) {
  const games = GAMES.filter((g) => g.category === cat.id);
  const title = catTitle(cat);
  const description = catDesc(cat);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: pageUrl(`/categories/${cat.id}/`),
    inLanguage: L.id,
    description,
    hasPart: games.map((g) => ({
      '@type': 'VideoGame',
      name: g.title,
      url: pageUrl(`/games/${g.id}/`),
      inLanguage: L.id,
      genre: title,
      gamePlatform: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    })),
  };
  const body = `${siteHeader(`/categories/${cat.id}/`)}
<main class="wrap" id="main">
  <nav class="crumbs" aria-label="${tn('nav.breadcrumb')}">
    <a href="${lp('/')}">${tn('nav.home')}</a><span>/</span><a href="${lp('/games/')}">${tn('nav.games')}</a><span>/</span><span>${esc(title)}</span>
  </nav>
  <section class="hero" style="padding-top:24px;padding-bottom:8px">
    <div>
      <p class="kicker"><i style="background:${esc(cat.accent)};box-shadow:0 0 0 4px ${esc(cat.accent)}22"></i>${tn('cat.kicker', {
        count: games.length,
        category: title,
        categoryLower: catLower(cat),
      })}</p>
      <h1>${esc(title)}</h1>
      <p class="lede">${esc(description)}</p>
      <div class="hero-cta">
        <button class="btn" id="btn-random" type="button" data-scope="${esc(cat.id)}">${glyph('a-dice', 18)} ${tn('cat.random', {
          category: catShort(cat),
          categoryLower: catLower(cat),
        })}</button>
      </div>
    </div>
  </section>
  <section class="section">${gameTiles(games)}</section>
  <section class="section prose">
    ${sponsorBanner(cat.id)}
    <h2>${tn('cat.more', { site: SITE.name })}</h2>
    <div class="linklist">${GAMES.filter((g) => g.category !== cat.id)
      .slice(0, 24)
      .map((g) => `<a href="${lp(`/games/${g.id}/`)}">${esc(g.title)}</a>`)
      .join('')}</div>
  </section>
</main>
${siteFooter(`/categories/${cat.id}/`)}`;
  write(
    `categories/${cat.id}/index.html`,
    layout({
      title: `${title} — ${plain('cat.titleSuffix')} | ${SITE.name}`,
      description: `${description} ${plain('cat.metaSuffix', {
        category: catLower(cat),
        site: SITE.name,
      })}`,
      path: `/categories/${cat.id}/`,
      body,
      jsonLd,
    }),
  );
}

/**
 * Game pages wear the in-game shell, which owns its own topbar, so the
 * language switcher is spliced into that topbar: a reader deep in a game
 * must be able to switch language without going back to the index first.
 */
function shellWithSwitcher(html, path) {
  const nav = langSwitcher(path);
  for (const marker of ['<div class="top-actions">', '<div class="embed-actions">']) {
    const at = html.indexOf(marker);
    if (at !== -1) return html.slice(0, at) + nav + html.slice(at);
  }
  return `${nav}${html}`;
}

/**
 * Translate the in-game shell for a non-English tree.
 *
 * scripts/shell.mjs is shared with the itch.io packager, which builds one
 * English bundle, so its labels live there and not in the catalog. Rather
 * than fork that file, the shell's own English fragments are replaced here -
 * each one appears exactly once - and its root-relative links are moved into
 * this tree. If the shell is edited the replacements become no-ops: the page
 * falls back to English rather than breaking.
 *
 * `/third-party/` is deliberately left alone: vendored games are copied once,
 * at the root, and a prefixed iframe src would 404.
 */
function localiseShell(html, game = null) {
  if (L.id === DEFAULT_LOCALE) return html;
  let out = html
    .replace(/href="\/games\//g, `href="${L.prefix}/games/`)
    .replace(/href="\/categories\//g, `href="${L.prefix}/categories/`)
    .replace(/href="\/"/g, `href="${L.prefix}/"`);
  const swaps = [
    ['aria-label="spielkunst — home"', `aria-label="${tn('brand.home')}"`],
    ['aria-label="About this game"', `aria-label="${tn('game.aboutLabel')}"`],
    [' All games</a>', ` ${tn('game.allGames')}</a>`],
    ['>More like this</a>', `>${tn('game.moreLikeThis')}</a>`],
    ['<div class="side-label">Keep playing</div>', `<div class="side-label">${tn('game.keepPlaying')}</div>`],
    ['<div class="side-label">Sponsored</div>', `<div class="side-label">${tn('game.sponsored')}</div>`],
    ['<div class="side-label">Original</div>', `<div class="side-label">${tn('game.original')}</div>`],
    [
      '<p class="side-foot">Free to play · no sign-up · works on any device</p>',
      `<p class="side-foot">${tn('game.sideFoot')}</p>`,
    ],
    ['aria-label="Difficulty"', `aria-label="${tn('game.difficulty')}"`],
    ['title="Easy difficulty"', `title="${tn('game.easy')}"`],
    ['title="Normal difficulty"', `title="${tn('game.normal')}"`],
    ['title="Hard difficulty"', `title="${tn('game.hard')}"`],
    ['<span class="diff-long">Easy</span>', `<span class="diff-long">${tn('game.easy')}</span>`],
    ['<span class="diff-long">Normal</span>', `<span class="diff-long">${tn('game.normal')}</span>`],
    ['<span class="diff-long">Hard</span>', `<span class="diff-long">${tn('game.hard')}</span>`],
    ['aria-label="Toggle sound"', `aria-label="${tn('game.sound')}"`],
    ['aria-label="Fullscreen"', `aria-label="${tn('game.fullscreen')}"`],
    [' Press space to start."', ` ${tn('game.pressSpace')}"`],
    ['aria-label="On-screen controls"', `aria-label="${tn('game.pad')}"`],
    ['aria-label="Full screen"', `aria-label="${tn('game.fullScreen')}"`],
    ['>Open full ', `>${tn('game.openFull')} `],
    ['>View source</a>', `>${tn('game.viewSource')}</a>`],
  ];
  for (const [from, to] of swaps) out = out.split(from).join(to);
  // The splash line carries the game's own name, so it is matched as a whole.
  if (game?.title) {
    out = out.replace(`Loading ${game.title}…`, tn('game.loading', { title: game.title }));
  }
  return out;
}

function buildGamePage(game) {
  const cat = CATEGORIES.find((c) => c.id === game.category);
  const path = `/games/${game.id}/`;
  const related = GAMES.filter(
    (g) => (game.related ?? []).includes(g.id) || g.category === game.category,
  )
    .filter((g) => g.id !== game.id)
    .slice(0, 6);
  // Everything the page says about the game in prose: its own words in
  // English, the genre template for this locale outside it. The title is not
  // in here - a name is a proper noun and stays as it is.
  const copy = copyFor(game);
  const faq = copy.faq;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: game.title,
      url: pageUrl(path),
      inLanguage: L.id,
      description: copy.description,
      genre: cat ? catTitle(cat) : 'Arcade',
      gamePlatform: 'Web Browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.baseUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: L.id,
      mainEntity: faq.map((f) => ({
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
        { '@type': 'ListItem', position: 1, name: translate(L.catalog, 'nav.home'), item: pageUrl('/') },
        {
          '@type': 'ListItem',
          position: 2,
          name: cat ? catTitle(cat) : translate(L.catalog, 'nav.games'),
          item: pageUrl(`/categories/${game.category}/`),
        },
        { '@type': 'ListItem', position: 3, name: game.title, item: pageUrl(path) },
      ],
    },
  ];
  const isEmbed = Boolean(game.embed);
  const shellOpts = { related, sponsor: sponsorBanner(game.category) };
  const shellGame = localGame(game);
  const shell = localiseShell(
    isEmbed ? embedShell(shellGame, shellOpts) : gameShell(shellGame, shellOpts),
    game,
  );
  const body = `${shellWithSwitcher(shell, path)}
<section class="wrap prose" style="padding-bottom:48px" id="about">
  <nav class="crumbs" aria-label="${tn('nav.breadcrumb')}">
    <a href="${lp('/')}">${tn('nav.home')}</a><span>/</span><a href="${lp(`/categories/${esc(game.category)}/`)}">${esc(
      cat ? catTitle(cat) : translate(L.catalog, 'nav.games'),
    )}</a><span>/</span><span>${esc(game.title)}</span>
  </nav>
  <h1 style="margin-top:18px">${tn('game.h1', { title: game.title })}</h1>
  <p>${esc(copy.description)}</p>
  ${
    game.credit
      ? `<p class="credit-line">${rich('game.credit', {
          author: esc(game.credit.author),
          licence: esc(creditLicence(game.credit)),
          source: esc(game.credit.source),
        })}</p>`
      : ''
  }
  <h2>${tn('game.howTo', { title: game.title })}</h2>
  <ul>${howToLines(copy, game).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
  <h2>${tn('game.faq')}</h2>
  <div class="faq">${faq
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('')}</div>
  <h2>${tn('game.more')}</h2>
  <div class="linklist">${related.map((g) => `<a href="${lp(`/games/${g.id}/`)}">${esc(g.title)}</a>`).join('')}</div>
</section>
${isEmbed ? '' : `<script type="module" src="${hostBundle}"></script>`}
<script src="/play.js?v=${assetVersion}" defer></script>`;
  write(
    `games/${game.id}/index.html`,
    layout({
      title: `${game.title} — ${plain('game.titleSuffix')} | ${SITE.name}`,
      description: plain('game.metaDesc', { title: game.title, desc: copy.description }),
      path,
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
      `<tr><td><a href="${lp(`/daily/${date}/`)}">${date}</a></td><td>${esc(themeName(theme))}</td><td><a href="${lp(`/daily/${date}/answers/`)}">${tn('daily.answers')}</a></td>${
        isToday ? `<td>${tn('daily.today')}</td>` : '<td></td>'
      }</tr>`,
    );
  }

  const hubBody = `${siteHeader('/daily/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${tn('daily.pill')}</span>
    <h1>${tn('daily.h1')}</h1>
    <p>${tn('daily.intro')}</p>
  </section>
  <section class="section">
    <table class="answer-table"><thead><tr><th>${tn('daily.col.date')}</th><th>${tn('daily.col.theme')}</th><th></th><th></th></tr></thead><tbody>${hubRows.join(
      '',
    )}</tbody></table>
  </section>
  <section class="section prose">
    <h2>${tn('daily.howTitle')}</h2>
    <p>${tn('daily.howBody')}</p>
  </section>
</main>
${siteFooter('/daily/')}`;
  write(
    'daily/index.html',
    layout({
      title: `${plain('daily.title')} | ${SITE.name}`,
      description: plain('daily.desc'),
      path: '/daily/',
      body: hubBody,
    }),
  );

  for (const date of dates) {
    const theme = themeForDate(date, dateSeed(date));
    const board = generateWordBoard(date, theme, 10, 11);
    const answers = boardAnswers(board);
    const answerWords = answers.map((a) => a.word).join(', ');

    // Puzzle page
    const puzzleBody = `${siteHeader(`/daily/${date}/`)}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${esc(themeName(theme))}</span>
    <h1>${tn('daily.puzzle.h1', { date })}</h1>
    <p>${tn('daily.puzzle.lede', { date, count: answers.length, theme: themeName(theme) })}</p>
  </section>
  <section class="section">
    ${boardHtml(board, null)}
    <div class="row"><a class="btn btn-primary" href="${lp('/games/wordsearch/')}">${tn('daily.playFull')}</a> <a class="btn" href="${lp(`/daily/${date}/answers/`)}">${tn('daily.seeAnswers')}</a></div>
  </section>
  <section class="section prose">
    <h2>${tn('daily.wordsIn', { date })}</h2>
    <p>${rich('daily.stuck', { count: answers.length, date, href: esc(lp(`/daily/${date}/answers/`)) })}</p>
    <h2>${tn('daily.howPlayTitle')}</h2>
    <ul>
      <li>${tn('daily.howPlay1')}</li>
      <li>${tn('daily.howPlay2')}</li>
      <li>${tn('daily.howPlay3')}</li>
    </ul>
    <h2>${tn('daily.other')}</h2>
    <div class="linklist">${dates
      .filter((d) => d !== date)
      .slice(-14)
      .reverse()
      .map((d) => `<a href="${lp(`/daily/${d}/`)}">${d}</a>`)
      .join('')}</div>
  </section>
</main>
${siteFooter(`/daily/${date}/`)}`;
    write(
      `daily/${date}/index.html`,
      layout({
        title: `${plain('daily.puzzle.title', { date })} | ${SITE.name}`,
        description: plain('daily.puzzle.desc', { date, count: answers.length, theme: themeName(theme) }),
        path: `/daily/${date}/`,
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

    const answersBody = `${siteHeader(`/daily/${date}/answers/`)}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${esc(themeName(theme))}</span>
    <h1>${tn('daily.answers.h1', { date })}</h1>
    <p>${tn('daily.answers.lede', { date, count: answers.length })}</p>
  </section>
  <section class="section">
    ${boardHtml(board, hitSet)}
    <table class="answer-table"><thead><tr><th>${tn('daily.col.word')}</th><th>${tn('daily.col.starts')}</th><th>${tn('daily.col.ends')}</th></tr></thead><tbody>${answers
      .map((a) => `<tr><td><strong>${esc(a.word)}</strong></td><td>${esc(a.start)}</td><td>${esc(a.end)}</td></tr>`)
      .join('')}</tbody></table>
    <p class="prose">${tn('daily.wordsList', { words: answerWords })}</p>
  </section>
  <section class="section prose">
    <h2>${tn('daily.about')}</h2>
    <p>${rich('daily.aboutBody', {
      date,
      theme: esc(themeName(theme)),
      game: esc(lp('/games/wordsearch/')),
      site: SITE.name,
      archive: esc(lp('/daily/')),
    })}</p>
  </section>
</main>
${siteFooter(`/daily/${date}/answers/`)}`;
    write(
      `daily/${date}/answers/index.html`,
      layout({
        title: `${plain('daily.answersTitle', { date, count: answers.length })} | ${SITE.name}`,
        description: plain('daily.answersDesc', {
          date,
          words: answerWords,
          count: answers.length,
        }),
        path: `/daily/${date}/answers/`,
        body: answersBody,
      }),
    );
  }
}

/* --------------------------------------------------------- misc + sitemap */

/**
 * The sitemap index over the three language sitemaps.
 *
 * A sitemap must list URLs of one language: mixing them is how a French page
 * gets indexed as the English one. So each tree gets its own urlset and
 * /sitemap.xml becomes an index of the three - the one URL robots.txt points
 * at, and the one that does not change when a language is added.
 */
export function sitemapIndexXml(baseUrl, lastmod = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  const rows = LOCALES.map(
    (l) =>
      `  <sitemap><loc>${esc(`${base}/sitemap-${l.hreflang}.xml`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</sitemap>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows}
</sitemapindex>
`;
}

/** One urlset per locale, plus the index. Called once, after every tree exists. */
function buildSitemaps(byLocale, today) {
  for (const l of LOCALES) {
    const urls = byLocale[l.id] ?? [];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
    writeRoot(`sitemap-${l.hreflang}.xml`, xml);
  }
  writeRoot('sitemap.xml', sitemapIndexXml(SITE.baseUrl, today));
}

function buildRobots() {
  // SITE.baseUrl already ends in a slash ("https://spielkunst.pages.dev/"),
  // so appending "/sitemap.xml" produced a doubled slash in the live file.
  writeRoot(
    'robots.txt',
    `User-agent: *
Allow: /

Sitemap: ${SITE.baseUrl.replace(/\/+$/, '')}/sitemap.xml
`,
  );
}

/**
 * The web app manifest, generated instead of kept in public/.
 *
 * The description carries the real game count: as a static file it said "153"
 * long after the catalogue had grown, and nothing in the build could notice.
 * Everything else here is fixed chrome the install prompt reads once.
 */
function writeManifest() {
  const manifest = {
    name: `${SITE.name} — free browser games`,
    short_name: SITE.name,
    description: `${GAMES.length} free browser games that start instantly. No download, no sign-up, no paywall.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#08090a',
    theme_color: '#08090a',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: "Today's word search", url: '/games/wordsearch/' },
      { name: 'All games', url: '/games/' },
    ],
  };
  writeRoot('site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
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
  let prunedFiles = 0;
  let prunedBytes = 0;
  const fixups = { refresh: 0, topTarget: 0, topNav: 0, rel: 0, widget: 0, files: 0 };
  for (const name of wanted) {
    const from = join(src, name);
    if (!existsSync(from)) continue;
    const to = join(destRoot, name);
    cpSync(from, to, { recursive: true });
    copied++;
    // Drop what a browser can never load (APKs, PSDs, READMEs, CI files,
    // unreferenced multi-megabyte media) so the deploy - and the repo - carry
    // the game, not the project around it.
    const pruned = pruneVendored(to);
    prunedFiles += pruned.removed;
    prunedBytes += pruned.bytes;
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
        fixups.widget += changes.widget;
      }
    }
  }
  if (fixups.files) {
    console.log(
      `spielkunst: sanitised ${fixups.files} vendored pages ` +
        `(${fixups.topTarget} target=_top, ${fixups.topNav} top-navigation, ` +
        `${fixups.refresh} meta refresh, ${fixups.rel} rel=noopener, ` +
        `${fixups.widget} comment widget)`,
    );
  }
  if (prunedFiles) {
    console.log(
      `spielkunst: pruned ${prunedFiles} non-web files ` +
        `(${(prunedBytes / 1048576).toFixed(1)} MB) from vendored games`,
    );
  }
  return copied;
}

function buildCredits() {
  const thirdParty = GAMES.filter((g) => g.credit);
  const original = GAMES.filter((g) => !g.credit);

  const body = `${siteHeader('/credits/')}
<main class="wrap" id="main">
  <section class="hero">
    <span class="pill">${tn('count.games', { count: GAMES.length })}</span>
    <h1>${tn('credits.h1')}</h1>
    <p>${tn('credits.intro', { site: SITE.name })}</p>
  </section>

  <section class="section prose">
    <h2>${tn('credits.original')}</h2>
    <p>${tn('credits.originalBody', { site: SITE.name })}</p>
    <div class="linklist">${original
      .map((g) => `<a href="${lp(`/games/${g.id}/`)}">${esc(g.title)}</a>`)
      .join('')}</div>
  </section>

  <section class="section prose">
    <h2>${tn('credits.oss')}</h2>
    <p>${tn('credits.ossBody')}</p>
    <table class="answer-table credits-table">
      <thead><tr><th>${tn('credits.col.game')}</th><th>${tn('credits.col.by')}</th><th>${tn('credits.col.licence')}</th><th>${tn('credits.col.source')}</th></tr></thead>
      <tbody>${thirdParty
        .map(
          (g) =>
            `<tr><td><a href="${lp(`/games/${g.id}/`)}">${esc(g.title)}</a></td><td>${esc(
              g.credit.author,
            )}</td><td>${esc(creditLicence(g.credit))}</td><td><a href="${esc(
              g.credit.source,
            )}" rel="noopener nofollow" target="_blank">github</a></td></tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>

  <section class="section prose">
    <h2>${tn('credits.thanks')}</h2>
    <p>${tn('credits.thanksBody')}</p>
  </section>
</main>
${siteFooter('/credits/')}`;

  write(
    'credits/index.html',
    layout({
      title: plain('credits.title', { site: SITE.name }),
      description: plain('credits.desc', { site: SITE.name }),
      path: '/credits/',
      body,
    }),
  );
}

/* --------------------------------------------------- games index paging */

/**
 * Games per page of the /games/ index.
 *
 * The index used to ship every tile in one document - 465 and climbing, ~550 kB
 * of HTML, the heaviest page on the site and the one every crawl lands on. 60
 * fills a desktop grid in about two screenfuls, is one thumb-flick on a phone,
 * and keeps the document smaller than most of the games it links to.
 */
export const GAMES_PER_PAGE = 60;

/** How many index pages a catalogue of `total` games needs (never fewer than one). */
export function pageCountFor(total, perPage = GAMES_PER_PAGE) {
  const count = Math.floor(Number(total) || 0);
  const size = Math.floor(Number(perPage) || 0);
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil(count / (size > 0 ? size : 1)));
}

/**
 * Site path of page `page`.
 *
 * Page 1 is the canonical /games/ so the URL everyone links and the one in the
 * sitemap is the shallow one; deeper pages are real paths, not query strings,
 * so they are crawlable, cacheable and shareable without JavaScript.
 */
export function pageHref(page, prefix = '') {
  const n = Math.max(1, Math.floor(Number(page) || 1));
  const p = n === 1 ? '/games/' : `/games/page/${n}/`;
  return localePath(prefix, p);
}

/** The absolute, self-referencing canonical URL for page `page`. */
export function pageCanonical(page, prefix = '') {
  return abs(pageHref(page, prefix));
}

/** The games on page `page`, in catalogue order. Past the end: empty. */
export function pageSlice(games, page, perPage = GAMES_PER_PAGE) {
  const size = Math.max(1, Math.floor(Number(perPage) || GAMES_PER_PAGE));
  const n = Math.max(1, Math.floor(Number(page) || 1));
  const start = (n - 1) * size;
  return games.slice(start, start + size);
}

/**
 * The compact catalogue the browser fetches for search: exactly four fields.
 *
 * The tiles in the document are only this page; search has to reach the whole
 * catalogue, so it needs id, title, category and accent - enough to match a
 * game and draw a result - and nothing else. Keywords, taglines and
 * descriptions would triple the payload for no visible gain.
 */
export function catalogEntries(games) {
  return games.map((g) => ({ i: g.id, t: g.title, c: g.category, a: g.accent }));
}

/**
 * /games/catalog.json as a string.
 *
 * `<` is escaped to \u003c. The payload used to be inlined in a <script>
 * block, where a game titled "…</script>" would have ended it early; it is a
 * fetched file now, but the escaping costs 0 bytes after gzip and means the
 * build can never emit JSON that breaks a document.
 */
export function catalogJson(games) {
  return JSON.stringify(catalogEntries(games)).replace(/</g, '\\u003c');
}

/**
 * Server-rendered page links.
 *
 * Rendered twice per page - above and below the grid - because walking 60
 * tiles to reach the bottom of the list is a long scroll on a phone. Real
 * anchors, so the whole catalogue is reachable with JavaScript off.
 */
export function pagerHtml(page, pages, opts = {}) {
  const total = Math.max(1, Math.floor(Number(pages) || 1));
  const at = Math.min(Math.max(1, Math.floor(Number(page) || 1)), total);
  const prefix = opts.prefix ?? '';
  const numbers = [];
  for (let n = 1; n <= total; n++) {
    numbers.push(
      n === at
        ? `<li><a href="${pageHref(n, prefix)}" aria-current="page">${n}</a></li>`
        : `<li><a href="${pageHref(n, prefix)}">${n}</a></li>`,
    );
  }
  const prevLabel = translate(L.catalog, 'pager.prev');
  const nextLabel = translate(L.catalog, 'pager.next');
  const prev =
    at > 1
      ? `<a class="pager-step" href="${pageHref(at - 1, prefix)}" rel="prev"><span aria-hidden="true">‹</span> ${prevLabel}</a>`
      : `<span class="pager-step is-off" aria-hidden="true"><span>‹</span> ${prevLabel}</span>`;
  const next =
    at < total
      ? `<a class="pager-step" href="${pageHref(at + 1, prefix)}" rel="next">${nextLabel} <span aria-hidden="true">›</span></a>`
      : `<span class="pager-step is-off" aria-hidden="true">${nextLabel} <span>›</span></span>`;
  return `<nav class="pager"${opts.id ? ` id="${opts.id}"` : ''} data-pager aria-label="${translate(L.catalog, 'nav.gamePages')}">
  ${prev}
  <ol class="pager-list">${numbers.join('')}</ol>
  ${next}
</nav>`;
}

function buildGamesIndex() {
  const total = GAMES.length;
  const perPage = GAMES_PER_PAGE;
  const pages = pageCountFor(total, perPage);
  const prefix = L.prefix;
  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    games: GAMES.filter((g) => g.category === c.id),
  })).filter((c) => c.games.length);

  const chips = [
    `<button class="chip is-on" type="button" data-cat-chip="all" data-cat-title="${tn(
      'index.everything',
    )}" aria-pressed="true">${tn('index.everything')} <b>${total}</b></button>`,
    ...byCategory.map((c) => {
      const label = catShort(c);
      return `<button class="chip" type="button" data-cat-chip="${esc(c.id)}" data-cat-title="${esc(
        label,
      )}" aria-pressed="false">${esc(label)} <b>${c.games.length}</b></button>`;
    }),
  ].join('');

  const categoryList = byCategory.map((c) => catTitle(c).toLowerCase()).join(', ');

  /** Deeper pages are discovered from page 1 and from each other. */
  const pageUrls = [];

  for (let page = 1; page <= pages; page++) {
    const slice = pageSlice(GAMES, page, perPage);
    const from = (page - 1) * perPage + 1;
    const to = from + slice.length - 1;
    const isFirst = page === 1;

    const title = isFirst
      ? `${plain('index.title1', { count: total })} | ${SITE.name}`
      : `${plain('index.titleN', { count: total, page, pages })} | ${SITE.name}`;
    const description = isFirst
      ? plain('index.desc1', { count: total, site: SITE.name, categories: categoryList })
      : plain('index.descN', { count: total, from, to, page, pages, site: SITE.name });

    const head = [
      page > 1 ? `<link rel="prev" href="${esc(pageCanonical(page - 1, prefix))}">` : '',
      page < pages ? `<link rel="next" href="${esc(pageCanonical(page + 1, prefix))}">` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const pager = pages > 1 ? pagerHtml(page, pages, { prefix }) : '';

    const body = `${siteHeader(pageHref(page))}
<main class="wrap" id="main">
  <section class="hero" style="padding-bottom:8px">
    <div>
      <p class="kicker"><i></i>${
        isFirst
          ? tn('index.kicker1', { count: total, cats: byCategory.length })
          : tn('index.kickerN', { page, pages, from, to, count: total })
      }</p>
      <h1>${isFirst ? tn('index.h1.1') : tn('index.h1.n', { page, pages })}</h1>
      <p class="lede">${
        isFirst ? tn('index.lede1') : tn('index.ledeN', { pages, count: total })
      }</p>
      <form class="filter-bar" role="search" onsubmit="return false">
        <input id="game-filter" class="filter-input" type="search" name="q" placeholder="${tn('index.placeholder', { count: total })}"
               autocomplete="off" spellcheck="false" aria-label="${tn('index.searchLabel')}"
               aria-describedby="filter-status">
        <select id="sort-games" class="sort-select" aria-label="${tn('index.sortLabel')}">
          <option value="default">${tn('index.sortDefault')}</option>
          <option value="az">${tn('index.sortAZ')}</option>
          <option value="za">${tn('index.sortZA')}</option>
        </select>
        <button class="btn" id="btn-random" type="button">${glyph('a-dice', 18)} ${tn('index.random')}</button>
      </form>
      <div class="chips" id="cat-chips">${chips}</div>
      <p id="filter-status" class="filter-status" role="status" aria-live="polite"></p>
    </div>
  </section>
  <div id="game-sections" data-catalog="/games/catalog.json">
    ${pages > 1 ? pagerHtml(page, pages, { id: 'game-pager-top', prefix }) : ''}
    <section class="section" id="index-tiles" data-page="${page}">
      <div class="section-head">
        <h2>${
          isFirst
            ? tn('index.showing', { from, to, count: total })
            : tn('index.range', { from, to })
        }</h2>
        <span class="pill">${tn('index.pagePill', { page, pages })}</span>
      </div>
      ${gameTiles(slice)}
    </section>
    <div class="grid" id="sorted-grid" hidden></div>
    ${pager}
  </div>
  <div class="empty" id="filter-empty" hidden>
    <b>${tn('index.emptyTitle')}</b>
    ${rich('index.emptyBody', { href: esc(lp('/games/')) })}
  </div>
${
  isFirst
    ? `
  <section class="section" id="recent-section">
    <div class="section-head">
      <h2>${tn('home.recent')}</h2>
      <span class="pill">${tn('home.device')}</span>
    </div>
    <div class="hscroll" aria-live="polite"></div>
  </section>`
    : ''
}
</main>
${siteFooter(pageHref(page))}`;

    write(
      isFirst ? 'games/index.html' : `games/page/${page}/index.html`,
      layout({
        title,
        description,
        path: pageHref(page),
        head,
        body,
        script: statusPluralScript(),
      }),
    );

    if (!isFirst) pageUrls.push(pageCanonical(page, prefix));
  }

  // The whole catalogue in four fields per game, fetched on the first
  // keystroke rather than shipped with the page. Titles are proper nouns, so
  // one copy serves all three trees.
  if (L.id === DEFAULT_LOCALE) writeRoot('games/catalog.json', catalogJson(GAMES));

  return { total, perPage, pages, urls: pageUrls };
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
    <span class="pill">${tn('ad.pill')}</span>
    <h1>${tn('ad.h1')}</h1>
    <p>${tn('ad.intro')}</p>
  </section>

  <section class="section prose">
    <h2>${tn('ad.whatTitle')}</h2>
    <p>${rich('ad.whatBody', {})}</p>
    <ul>
      <li>${tn('ad.rule1')}</li>
      <li>${tn('ad.rule2')}</li>
      <li>${tn('ad.rule3')}</li>
    </ul>
    <p>${tn('ad.whatFoot')}</p>
  </section>

  <section class="section">
    <h2>${tn('ad.prices')}</h2>
    <table class="answer-table">
      <thead><tr><th>${tn('ad.col.slot')}</th><th>${tn('ad.col.where')}</th><th>${tn('ad.col.price')}</th></tr></thead>
      <tbody>
        <tr><td><strong>${tn('ad.row1.name')}</strong></td><td>${tn('ad.row1.where')}</td><td>${tn('ad.row1.price')}</td></tr>
        <tr><td><strong>${tn('ad.row2.name')}</strong></td><td>${tn('ad.row2.where')}</td><td>${tn('ad.row2.price')}</td></tr>
        <tr><td><strong>${tn('ad.row3.name')}</strong></td><td>${tn('ad.row3.where')}</td><td>${tn('ad.row3.price')}</td></tr>
      </tbody>
    </table>
    <p class="prose">${tn('ad.flat')}</p>
  </section>

  <section class="section prose">
    <h2>${tn('ad.startTitle')}</h2>
    <ol>
      <li>${tn('ad.start1')}</li>
      <li>${tn('ad.start2')}</li>
      <li>${tn('ad.start3')}</li>
    </ol>
  </section>

  <section class="section prose">
    <h2>${tn('ad.fits')}</h2>
    <p>${tn('ad.fitsBody')}</p>
  </section>

  <section class="section prose">
    <h2>${tn('ad.contact')}</h2>
    <p>${tn('ad.contactBody')}</p>
    <div class="linklist">${contactLinks}</div>
  </section>
</main>
${siteFooter('/advertise/')}`;
  write(
    'advertise/index.html',
    layout({
      title: `${plain('ad.title')} | ${SITE.name}`,
      description: plain('ad.desc', { site: SITE.name }),
      path: '/advertise/',
      body,
    }),
  );
}

/**
 * The 404 page is built once, in English, at the site root.
 *
 * A host serves /404.html for any miss, whichever tree the miss was in, so
 * three copies would be three files nobody is served. It carries no
 * alternates for the same reason, and noindex: a 404 in the index is a
 * self-inflicted wound.
 */
function buildNotFound() {
  const body = `${siteHeader('/')}
<main class="wrap" id="main">
  <section class="hero" style="min-height:38vh;justify-content:center">
    <p class="kicker"><i></i>404</p>
    <h1>${tn('nf.h1')}</h1>
    <p>${tn('nf.body')}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="${lp('/games/')}">${tn('home.browseAll', { count: GAMES.length })}</a>
      <a class="btn" href="${lp('/')}">${tn('nav.home')}</a>
    </div>
  </section>
  <section class="section">${gameTiles(GAMES.slice(0, 10))}</section>
</main>
${siteFooter('/')}`;
  writeRoot(
    '404.html',
    layout({
      title: `${plain('nf.title')} | ${SITE.name}`,
      description: plain('nf.desc', { site: SITE.name }),
      path: '/404.html',
      body,
      alternates: false,
      indexable: false,
    }),
  );
}

/**
 * Render one page's skeleton in memory, for the tests.
 *
 * lang/dir, the canonical, the alternate set and the switcher are page-level
 * contracts; the only honest way to check them is to run the real layout()
 * instead of asserting on its source.
 */
export function renderProbePage(localeId = DEFAULT_LOCALE, opts = {}) {
  const previous = L;
  useLocale(localeId);
  const path = opts.path ?? '/games/snake/';
  try {
    return layout({
      title: 'Probe page',
      description: 'Probe description',
      path,
      body: `${siteHeader(path)}<main id="main"></main>${siteFooter(path)}`,
    });
  } finally {
    L = previous;
  }
}

/* ------------------------------------------------------------------ main */

function main() {
  if (existsSync(dist)) {
    for (const entry of [
      'index.html',
      'games',
      'categories',
      'daily',
      'credits',
      'advertise',
      'sitemap.xml',
      'sitemap-en.xml',
      'sitemap-fr.xml',
      'sitemap-ar.xml',
      '404.html',
      // The language trees, so a locale removed from the registry does not
      // leave a stale /fr/ behind in dist/ or in the deploy.
      ...LOCALES.map((l) => l.prefix.replace(/^\//, '')).filter(Boolean),
    ]) {
      rmSync(join(dist, entry), { recursive: true, force: true });
    }
  }
  mkdirSync(dist, { recursive: true });

  computeAssetVersion();
  findHostBundle();
  versionServiceWorker();
  writeHeaders();
  const today = todayISO();
  /** URL list per locale: one sitemap each, never a mixed one. */
  const byLocale = {};

  for (const locale of LOCALES) {
    useLocale(locale.id);
    const urls = [];

    buildHome();
    urls.push({ loc: pageUrl('/'), lastmod: today });

    for (const c of CATEGORIES) {
      buildCategory(c);
      urls.push({ loc: pageUrl(`/categories/${c.id}/`), lastmod: today });
    }

    for (const g of GAMES) {
      buildGamePage(g);
      urls.push({ loc: pageUrl(`/games/${g.id}/`), lastmod: today });
    }

    buildCredits();
    urls.push({ loc: pageUrl('/credits/'), lastmod: today });
    urls.push({ loc: pageUrl('/games/'), lastmod: today });
    urls.push({ loc: pageUrl('/advertise/'), lastmod: today });

    buildDailyPages();
    urls.push({ loc: pageUrl('/daily/'), lastmod: today });
    for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
      const d = addDays(today, i);
      urls.push({ loc: pageUrl(`/daily/${d}/`), lastmod: d });
      urls.push({ loc: pageUrl(`/daily/${d}/answers/`), lastmod: d });
    }

    // The index is paged, so it is built before the sitemap that lists its
    // pages. buildGamesIndex also writes the shared catalog.json, once.
    const index = buildGamesIndex();
    for (const loc of index.urls) urls.push({ loc, lastmod: today });

    buildAdvertise();

    byLocale[locale.id] = urls;
  }

  // Site-wide files, written once, outside any tree.
  buildRobots();
  buildSitemaps(byLocale, today);
  useLocale(DEFAULT_LOCALE);
  buildNotFound();
  writeManifest();

  const vendored = copyThirdParty();
  const total = LOCALES.reduce((n, l) => n + (byLocale[l.id]?.length ?? 0), 0);
  const perLocale = LOCALES.map((l) => `${l.id} ${byLocale[l.id]?.length ?? 0}`).join(', ');
  console.log(
    `spielkunst: built ${total} URLs across ${LOCALES.length} languages (${perLocale}) — ` +
      `${GAMES.length} games, ${CATEGORIES.length} categories, ${vendored} vendored third-party`,
  );
}

/**
 * Run only when executed, never on import.
 *
 * tests/index-paging.test.js imports the paging helpers from this module, and
 * an unguarded main() would build the whole site - and rewrite dist/ - as a
 * side effect of running the tests.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
