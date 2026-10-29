/**
 * Turn the harvest reports into catalogue entries.
 *
 *   node scripts/harvest/import.mjs [--caps 40] [--budget 500]
 *
 * Test hooks (not part of the pipeline): --work <dir> reads the reports from
 * somewhere other than .harvest/, --out <file> writes somewhere other than
 * content/harvest-published.json.
 *
 * This is the only place a harvested repository becomes something the site
 * publishes, so it is the only place that can enforce the rules a 600-game
 * catalogue needs:
 *
 *   - a game with no passing browser verdict is never imported;
 *   - two repos with the same title produce one page, not two;
 *   - one genre cannot take over the catalogue (capPerFamily);
 *   - one run cannot publish more than `budget` new pages.
 *
 * `importGames()` itself is pure - no fs, no network, no clock - so the rules
 * can be tested without a browser and a broken harvest report can be replayed
 * offline. The CLI wrapper at the bottom is the only part that touches disk.
 *
 * Copy and category come from scripts/harvest/copy.mjs and category.mjs, owned
 * by the structured-copy chunk. Those modules are optional here: if they are
 * missing the importer falls back to the README-derived defaults below, and
 * every function is injectable so tests (and the integrator) can supply their
 * own without touching this file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupeByTitle, defaultFamilyOf } from './dedupe.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The two chunk-B modules, loaded if they exist.
 *
 * A static `import ... from './copy.mjs'` would fail the whole importer while
 * that chunk is still in flight, so the dependency is resolved at load time
 * instead. Once the real modules land, the importer picks them up with no
 * change here - the fallbacks are only for the window before they exist.
 */
async function optionalModule(specifier) {
  try {
    return await import(specifier);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw err; // a real syntax error in copy.mjs must not be swallowed
  }
}

const copyModule = await optionalModule('./copy.mjs');
const categoryModule = await optionalModule('./category.mjs');

/* ------------------------------------------------------------ helpers */

/** URL/id slug, identical to the rule the rest of the harvest pipeline uses. */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * A colour that belongs to the game and never moves: same id, same accent, on
 * every build. Stable accents mean a page keeps its identity when the
 * catalogue is re-imported.
 */
export function accentFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 85% 62%)`;
}

/** Category rules, used when scripts/harvest/category.mjs is not present. */
const CATEGORY_RULES = [
  ['word', ['word', 'anagram', 'letter', 'spelling', 'vocabulary', 'hangman', 'wordle', 'crossword']],
  ['puzzle', ['puzzle', '2048', 'sudoku', 'mahjong', 'match', 'merge', 'slide', 'nonogram', 'picross']],
  ['strategy', ['strategy', 'tower defense', 'towerdefence', 'rts', 'chess', 'checkers', 'cards', 'solitaire', 'klondike', 'spider', 'freecell', 'connect four']],
  ['brain', ['memory', 'brain', 'quiz', 'trivia', 'concentration', 'reaction', 'math']],
  ['sandbox', ['sandbox', 'simulator', 'idle', 'clicker', 'tycoon', 'drawing']],
  ['arcade', ['shooter', 'arcade', 'maze', 'snake', 'pacman', 'platformer', 'runner', 'flappy', 'invaders', 'asteroid', 'breakout', 'brick', 'doodle', 'ball', 'jump', 'racing', 'shoot']],
];

/** @param {string} text lowercased text describing the game */
export function defaultCategory(text) {
  const haystack = String(text ?? '').toLowerCase();
  for (const [category, words] of CATEGORY_RULES) {
    if (words.some((word) => haystack.includes(word))) return category;
  }
  return 'arcade';
}

/** "i-just-want-to-play-tetris" -> "I Just Want To Play Tetris". */
function titleFrom(repo) {
  const base = String(repo ?? '').split('/')[1] ?? String(repo ?? '');
  let title = base
    .replace(/[-_.]+/g, ' ')
    .replace(/\b(html5|js|javascript|web|game|the|classic|simple)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) title = base.replace(/[-_.]+/g, ' ');
  title = title.replace(/\b\w/g, (c) => c.toUpperCase());
  return title.length > 42 ? `${title.slice(0, 40).trim()}…` : title;
}

/**
 * README prose, reduced to sentences a player can read. Kept deliberately
 * small: this is the fallback for when the structured copy module is absent,
 * not the copy pipeline.
 */
function readmeSentences(readme) {
  if (!readme) return [];
  let text = String(readme)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(=+|-{3,}|\*{3,})\s*$/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*>\s?/gm, ' ')
    .replace(/:[a-z0-9_+-]+:/gi, ' ')
    .replace(/[*_`]/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');

  const sentences = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean.length < 25) continue;
    if (/^(https?:|www\.|git |npm |yarn |cd |sudo |\$|>|@|\.\/|\/)/i.test(clean)) continue;
    if (/[{};=<>[\]]/.test(clean)) continue;
    for (const piece of clean.split(/(?<=[.!?])\s+/)) {
      const sentence = piece.trim();
      if (sentence.length < 40 || sentence.length > 320) continue;
      if (!/^[A-Z0-9"'(]/.test(sentence) || !/\s/.test(sentence)) continue;
      sentences.push(sentence);
    }
  }
  return [...new Set(sentences)].slice(0, 12);
}

/** README-derived copy, used when scripts/harvest/copy.mjs is not present. */
export function defaultCopy(record = {}) {
  const title = record.title || titleFrom(record.repo);
  const sentences = readmeSentences(record.readme);
  // Descriptions on GitHub are markdown one-liners, emoji shortcodes and all.
  const tidy = (text) =>
    String(text ?? '')
      .replace(/:[a-z0-9_+-]+:/gi, ' ')
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const blurb = tidy(record.description || sentences[0] || '') || `A free ${title} browser game.`;
  const prose = sentences.filter((s) => !blurb.toLowerCase().startsWith(s.slice(0, 20).toLowerCase()));
  const howToPlay = (prose.length ? prose : sentences).slice(0, 5);

  return {
    title,
    tagline: blurb.slice(0, 90),
    description: `${blurb} Play ${title} instantly on arcadefork - no download, no sign-up, works on any device.`.slice(0, 320),
    keywords: [
      `${title.toLowerCase()} game`,
      `play ${title.toLowerCase()} online`,
      `free ${title.toLowerCase()}`,
      `${title.toLowerCase()} unblocked`,
      'browser game',
      'free online game',
    ],
    howToPlay: howToPlay.length
      ? howToPlay.map((s) => String(s).trim())
      : [
          'Open the game and follow the on-screen instructions.',
          'Play with the keyboard, the mouse or touch - the controls are shown in the game.',
          'Score points and try to beat your best run.',
        ],
    faq: [
      {
        q: `Is ${title} free?`,
        a: `Yes. ${title} runs entirely in your browser on arcadefork - no download, no account, no payment.`,
      },
      {
        q: `Who made this version of ${title}?`,
        a: `${title} is an open-source project by ${record.owner ?? 'its author'}, published under the ${record.licence ?? 'original'} licence.`,
      },
      {
        q: `Does ${title} work on a phone?`,
        a: 'It is served as a normal web page, so it scales to your screen. If it needs a keyboard, the on-screen controls are still there.',
      },
    ],
  };
}

/* -------------------------------------------------------------- import */

/**
 * The vendored entry path, made safe to put in an iframe URL.
 *
 * Vendored repos do not always ship index.html at their root: the vendor step
 * records whatever scripts/harvest/entry.mjs discovered (docs/index.html,
 * game/index.html, ...). Old records have no `entry` and keep the URL they
 * were published under, so this never re-points an existing game.
 */
function entryPathOf(record) {
  const raw = String(record?.entry ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const segments = raw.split('/').filter(Boolean);
  // A '.' or '..' segment would escape /third-party/<slug>/: refuse it.
  if (!segments.length || segments.some((s) => s === '.' || s === '..')) return 'index.html';
  return segments.map(encodeURIComponent).join('/');
}

/**
 * Build catalogue entries from the two harvest reports.
 *
 * Pure: same input, same output, no I/O. Every dependency that needs a
 * decision - copy, family, category - is a parameter so the integrator can
 * point it at the real modules and the tests at stubs.
 *
 * @param {object}   options
 * @param {object[]} options.vendored   .harvest/vendored.json records
 * @param {object[]} options.validated  .harvest/validated.json verdicts
 * @param {number}   [options.capPerFamily=40]
 * @param {number}   [options.budget=500]
 * @param {(record: object) => object} [options.copyFor]
 * @param {(record: object) => string} [options.familyFor]
 * @param {(text: string) => string}   [options.categoryFor]
 * @returns {object[]} publishable games, strongest first
 */
export function importGames({
  vendored = [],
  validated = [],
  capPerFamily = 40,
  budget = 500,
  existingTitles = [],
  existingIds = [],
  copyFor = copyModule?.copyFor ?? defaultCopy,
  familyFor = copyModule?.familyFor ?? defaultFamilyOf,
  categoryFor = categoryModule?.categoryFor ?? defaultCategory,
} = {}) {
  const vendoredBySlug = new Map();
  for (const record of vendored ?? []) {
    if (record?.slug) vendoredBySlug.set(record.slug, record);
  }

  // Only a passing verdict from a real browser is publishable. A record with
  // no verdict at all is not "probably fine" - it was never opened.
  const passed = (validated ?? []).filter((v) => v?.verdict === 'pass' && v.slug);

  const records = [];
  for (const verdict of passed) {
    const source = vendoredBySlug.get(verdict.slug) ?? {};
    // Never write to the caller's objects: a frozen report must import fine.
    const record = {
      ...source,
      slug: verdict.slug,
      repo: verdict.repo ?? source.repo ?? verdict.slug,
    };
    const partial = copyFor({ ...record }) ?? {};
    const copy = { ...defaultCopy(record) };
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined && value !== null) copy[key] = value;
    }
    record.title = String(copy.title || titleFrom(record.repo));
    record.family = String(familyFor(record) ?? '') || defaultFamilyOf(record);
    record.copy = copy;
    records.push(record);
  }

  const kept = dedupeByTitle(records, { familyOf: (r) => r.family, capPerFamily });
  const limited = Number.isFinite(Number(budget)) ? kept.slice(0, Math.max(0, Number(budget))) : kept;

  // Ids are derived from the repo, so they can be built without knowing about
  // the rest of the catalogue; a collision (two repos that slugify the same)
  // still has to be broken, or one page would overwrite the other.
  const usedIds = new Set(existingIds);
  /**
   * Titles already published by another catalogue layer. Two repos called
   * "Snake" are two different games: disambiguate with the author rather than
   * dropping one, or the site ships two pages with the same name (and the
   * content gate fails the build).
   */
  const normalise = (s) =>
    String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const takenTitles = new Set([...existingTitles].map(normalise));
  const games = [];
  const families = new Map();

  for (const record of limited) {
    let id = slugify(record.repo) || slugify(record.slug);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    const copy = record.copy;
    const category = String(
      categoryFor(`${record.repo} ${record.description ?? ''} ${record.title}`.toLowerCase()) || 'arcade',
    );

    let title = String(copy.title);
    if (takenTitles.has(normalise(title))) {
      const owner = String(record.owner ?? record.repo.split('/')[0] ?? '')
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (owner) title = `${title} (${owner})`;
    }
    takenTitles.add(normalise(title));

    games.push({
      id,
      title,
      tagline: String(copy.tagline ?? '').slice(0, 90),
      description: String(copy.description ?? ''),
      category,
      accent: accentFor(id),
      daily: false,
      embed: { src: `/third-party/${record.slug}/${entryPathOf(record)}` },
      credit: {
        author: String(record.owner ?? record.repo.split('/')[0] ?? 'Unknown'),
        licence: String(record.licence ?? 'Unknown'),
        source: `https://github.com/${record.repo}`,
      },
      keywords: Array.isArray(copy.keywords) ? copy.keywords.map(String) : [],
      howToPlay: Array.isArray(copy.howToPlay) ? copy.howToPlay.map(String) : [],
      faq: Array.isArray(copy.faq) ? copy.faq.map((f) => ({ q: String(f.q), a: String(f.a) })) : [],
      related: [],
    });
    families.set(id, record.family);
  }

  // Siblings first (a tetris page should link another tetris page), then the
  // rest of the catalogue, so every game has somewhere to go. Computed after
  // the budget so related ids always exist in the published set.
  for (const game of games) {
    const family = families.get(game.id);
    const siblings = games
      .filter((g) => g.id !== game.id && families.get(g.id) === family)
      .map((g) => g.id);
    const rest = games.filter((g) => g.id !== game.id && families.get(g.id) !== family).map((g) => g.id);
    game.related = [...siblings, ...rest].slice(0, 3);
  }

  return games;
}

/* ----------------------------------------------------------------- CLI */

const readJson = (file, fallback) => {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };

  const work = flag('work', process.env.HARVEST_DIR ?? join(root, '.harvest'));
  const out = flag('out', join(root, 'content/harvest-published.json'));
  const capPerFamily = Number(flag('caps', 40));
  const budget = Number(flag('budget', 500));

  const vendored = readJson(join(work, 'vendored.json'), []);
  if (!vendored.length) {
    console.error(`import: ${join(work, 'vendored.json')} is empty or missing - run the vendor phase first`);
    process.exit(1);
  }
  const validated = readJson(join(work, 'validated.json'), null);
  if (!validated) {
    console.error(`import: ${join(work, 'validated.json')} is missing - run \`node scripts/harvest/validate.mjs\` first`);
    process.exit(1);
  }

  // Titles and ids the rest of the catalogue already publishes. Without this,
  // a harvested "Snake" collides with the one already on the site and the
  // content gate fails the build after a successful import.
  const layer = (p) => readJson(join(root, p), { games: [] }).games ?? [];
  const existing = [...layer('content/games.json'), ...layer('content/engine-new.json'), ...layer('content/curated.json'), ...layer('content/games.generated.json')];
  const existingTitles = existing.map((g) => g.title);
  const existingIds = existing.map((g) => g.id);

  const games = importGames({ vendored, validated, capPerFamily, budget, existingTitles, existingIds });
  const passedCount = validated.filter((v) => v?.verdict === 'pass').length;

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        _comment:
          'Generated by scripts/harvest/import.mjs from .harvest/vendored.json + .harvest/validated.json. ' +
          'Do not edit by hand - per-game overrides belong in content/overrides.json.',
        games,
      },
      null,
      2,
    ),
  );

  console.log(`import: ${games.length} games, ${passedCount - games.length} duplicates/caps`);
}

// Only run the CLI when executed, so tests can import the pure functions.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
