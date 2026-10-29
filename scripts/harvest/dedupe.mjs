/**
 * Duplicate and family control for the harvested catalogue.
 *
 * Two problems show up once a harvest is bigger than one batch:
 *
 *   - the same game arrives twice, from two repos that both call it "Tetris",
 *     and the site grows two pages that compete with each other for the same
 *     search query;
 *   - one genre arrives forty times in a single sweep (there are a great many
 *     tetris and snake repos on GitHub), so the front page turns into one game
 *     repeated.
 *
 * Both rules live here rather than in the importer so they can be reasoned
 * about - and tested - on their own. `familyOf` is injected because deciding
 * what family a game belongs to needs the copy module, which the importer owns
 * the wiring for.
 */

/**
 * Fold a title down to the thing that decides "same game": case, accents,
 * punctuation and the little words that differ between repos' spellings.
 *
 * "The Snake: Reloaded" and "snake  reloaded!" are the same page to a player
 * and the same title to Google, so they must be the same key here.
 */
export function normaliseTitle(title) {
  return String(title ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents left by NFKD
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Genre words, used only when no real family function is injected. */
const FAMILY_RULES = [
  ['tetris', /tetris|tetromino|falling[- ]block|block drop|stacker/i],
  ['snake', /\bsnake\b/i],
  ['2048', /2048|threes|merge|tile/i],
  ['breakout', /breakout|arkanoid|brick|paddle|pong/i],
  ['space', /invaders|asteroid|shooter|shmup|space/i],
  ['platformer', /platformer|jump|runner|mario|doodle/i],
  ['solitaire', /solitaire|klondike|spider|freecell|card/i],
  ['sudoku', /sudoku|nonogram|picross|grid/i],
  ['word', /wordle|word|anagram|hangman|crossword|spelling/i],
  ['memory', /memory|match|concentration/i],
  ['racing', /racer|racing|car|kart|drift/i],
  ['maze', /maze|labyrinth|pacman|pac-man/i],
];

/**
 * Best-effort family for a record when scripts/harvest/copy.mjs has not
 * supplied `familyFor`. Falls back to the record's slug so every game is its
 * own family rather than all of them landing in one capped bucket.
 */
export function defaultFamilyOf(entry) {
  const text = `${entry?.title ?? ''} ${entry?.repo ?? ''} ${entry?.description ?? ''}`;
  for (const [family, pattern] of FAMILY_RULES) {
    if (pattern.test(text)) return family;
  }
  return String(entry?.slug ?? normaliseTitle(entry?.title) ?? 'other') || 'other';
}

/**
 * How good a record is, as a sortable array: most stars first, then the most
 * complete record (a description and a README beat a bare listing), then the
 * slug so the order never depends on the order the harvest reports were
 * written in.
 */
function rankOf(entry) {
  const stars = Number(entry?.stars ?? 0) || 0;
  const enrichment =
    String(entry?.description ?? '').length + String(entry?.readme ?? '').length;
  return [-stars, -enrichment, String(entry?.slug ?? entry?.id ?? '')];
}

/** Lexicographic compare of two rank arrays. */
function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Drop duplicate titles, then cap how many games one family may publish.
 *
 * @param {object[]} entries  records carrying at least { title, slug, stars }
 * @param {object}   [options]
 * @param {(entry: object) => string} [options.familyOf]
 * @param {number}   [options.capPerFamily=40]
 * @returns {object[]} the surviving records, strongest first
 */
export function dedupeByTitle(
  entries = [],
  { familyOf = defaultFamilyOf, capPerFamily = 40, perTitle = 1 } = {},
) {
  if (!Array.isArray(entries)) throw new TypeError('dedupeByTitle: entries must be an array');
  const cap = Number(capPerFamily);
  if (!Number.isFinite(cap) || cap < 1) {
    throw new RangeError(`dedupeByTitle: capPerFamily must be a positive number, got ${capPerFamily}`);
  }

  /**
   * `perTitle` survivors per normalised title, strongest first.
   *
   * 1 is the SEO answer: two pages called "Tetris" compete for one query.
   * The importer raises it to 3 because a big harvest is dominated by a dozen
   * famous names - dropping every "Snake" but one threw away 42 % of the games
   * that passed the browser gate, and each one is a genuinely different
   * implementation. Beyond three, a title really is clutter.
   */
  const quota = Math.max(1, Number(perTitle) || 1);
  const byTitle = new Map();
  for (const entry of entries) {
    const key = normaliseTitle(entry?.title);
    const bucket = byTitle.get(key) ?? [];
    bucket.push(entry);
    byTitle.set(key, bucket);
  }

  // Strongest first, so a family cap always keeps its best members.
  const candidates = [];
  for (const bucket of byTitle.values()) {
    bucket.sort((a, b) => compareRank(rankOf(a), rankOf(b)));
    candidates.push(...bucket.slice(0, quota));
  }
  candidates.sort((a, b) => compareRank(rankOf(a), rankOf(b)));

  const perFamily = new Map();
  const kept = [];
  for (const entry of candidates) {
    const family = String(familyOf(entry) ?? '') || 'other';
    const seen = perFamily.get(family) ?? 0;
    if (seen >= cap) continue;
    perFamily.set(family, seen + 1);
    kept.push(entry);
  }
  return kept;
}
