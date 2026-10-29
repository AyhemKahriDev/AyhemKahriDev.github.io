/**
 * Pure candidate rules for the harvest pipeline.
 *
 * Everything in here is a function of its arguments: no filesystem, no child
 * process, no network. The sweep feeds GitHub's search results through
 * shouldAccept(), vendor.mjs derives directory names with slugify(), and the
 * tests exercise the same code the pipeline runs - rather than a copy of it
 * that quietly drifts.
 */

/**
 * Permissive licences are straightforward. Copyleft licences are also usable
 * here because the vendored copy ships with its original licence and the
 * corresponding source is published in this repository - which is exactly what
 * those licences require. AGPL is excluded: it carries extra obligations for
 * network-served modifications we do not want to take on.
 */
export const ALLOWED_LICENCE = new Map([
  ['MIT', 'MIT'],
  ['CC0-1.0', 'CC0-1.0'],
  ['Apache-2.0', 'Apache-2.0'],
  ['BSD-3-Clause', 'BSD-3-Clause'],
  ['BSD-2-Clause', 'BSD-2-Clause'],
  ['ISC', 'ISC'],
  ['Unlicense', 'Unlicense'],
  ['0BSD', '0BSD'],
  ['GPL-3.0', 'GPL-3.0'],
  ['GPL-2.0', 'GPL-2.0'],
  ['LGPL-3.0', 'LGPL-3.0'],
  ['LGPL-2.1', 'LGPL-2.1'],
  ['MPL-2.0', 'MPL-2.0'],
]);

/** Licence ids the sweep asks GitHub for, in the form its `license:` takes. */
export const SEARCH_LICENCES = Object.freeze(
  ['MIT', 'CC0-1.0', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'MPL-2.0'].map(
    (id) => id.toLowerCase(),
  ),
);

/** Words that suggest a repo is a game project rather than something else. */
export const GAME_WORDS = [
  'game', 'games', 'puzzle', 'arcade', 'shooter', 'platformer', 'maze', 'tetris',
  'snake', 'pacman', 'pac-man', 'solitaire', 'card', 'cards', 'quiz', 'trivia',
  'tower', 'roguelike', 'rogue-like', 'rpg', 'sandbox', 'board', 'match', 'merge',
  '2048', 'breakout', 'invaders', 'flappy', 'runner', 'doodle', 'asteroid', 'brick',
  'word search', 'sudoku', 'mahjong', 'checkers', 'chess', 'pinball', 'arkanoid',
  'ball', 'jump', 'clicker', 'idle', 'tycoon', 'coloring', 'colouring', 'memory',
];

/** A generic "game" word is too weak - these are specific genres/mechanics. */
export const STRONG_GAME_WORDS = [
  'puzzle', 'arcade', 'shooter', 'shmup', 'platformer', 'maze', 'tetris', 'snake',
  'pacman', 'pac-man', 'solitaire', 'klondike', 'spider solitaire', 'freecell',
  'quiz', 'trivia', 'tower defense', 'towerdefence', 'roguelike', 'rogue-like',
  'breakout', 'arkanoid', 'invaders', 'flappy', 'endless runner', 'asteroid',
  'word search', 'wordsearch', 'wordle', 'hangman', 'sudoku', 'mahjong', 'nonogram',
  'picross', 'bubble shooter', 'match-3', 'match 3', '2048', 'pinball', 'ping pong',
  'doodle jump', 'flappy bird', 'angry birds', 'cut the rope', 'fruit ninja',
  'snake game', 'brick breaker', 'space invaders', 'pong', 'golf game', 'solitaire game',
  'card game', 'board game', 'card table', 'dice', 'slot machine', 'casino',
  'racing game', 'car game', 'bike game', 'helicopter', 'zombie', 'tower blocks',
  'sokoban', 'block puzzle', 'tile match', 'jewel', 'bejeweled', 'crossword',
  'pixel game', 'retro game', 'classic game', 'arcade game', 'video game',
  'typing game', 'clicker', 'idle game', 'tower defense',
];

/**
 * Words that mark a repository as infrastructure, a learning exercise or a
 * personal site rather than a game somebody can play.
 */
export const SKIP_WORDS = [
  'framework', 'library', 'boilerplate', 'starter', 'template', 'tutorial',
  'course', 'awesome', 'curated', 'list of', 'roadmap', 'cheatsheet', 'toolkit',
  'sdk', 'api wrapper', 'react component', 'theme', 'cli', 'editor', 'wallpaper',
  'icon set', 'font', 'plugin', 'extension', 'vscode', 'atom plugin', 'webpack',
  'babel', 'polyfill', 'css framework', 'learning', 'learn ', 'course', 'practice',
  'exercise', 'cheatsheet', 'interview', 'portfolio', 'resume', 'marketing',
];

/**
 * The repository *name* alone is held to a stricter rule than the description.
 * A game can legitimately mention a tutorial in its README blurb ("built from
 * a tutorial"), but a repo called `html5-game-engine` is the engine, not a
 * game - and `gamejam-template` is a starting point, not a finished entry.
 */
const NAME_REJECT = [
  /(^|[-_.])(engine|framework|library|lib|sdk|api|boilerplate|template|starter|tutorial|course|portfolio|resume|docs?|examples?|exercises?|cheatsheet|awesome|tutorials)([-_.]|$)/,
];

/**
 * Directory/URL slug for a repository, unchanged from the original pipeline:
 * lowercase, runs of non-alphanumerics collapsed to one dash, dashes trimmed,
 * at most 60 characters. `bocaletto-luca/snake` -> `bocaletto-luca-snake`.
 */
export function slugify(repo) {
  return String(repo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Repositories are compared without punctuation or case. */
export function normaliseRepo(repo) {
  return String(repo).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Candidate records (candidates.json) and raw GitHub items both work here. */
function repoName(candidate) {
  return String(candidate?.repo ?? candidate?.full_name ?? '').trim();
}

function licenceOf(candidate) {
  const raw = candidate?.licence ?? candidate?.license?.spdx_id ?? candidate?.license ?? null;
  if (!raw) return null;
  return String(raw).trim() || null;
}

function sizeOf(candidate) {
  const raw = candidate?.sizeKB ?? candidate?.size ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function starsOf(candidate) {
  const raw = candidate?.stars ?? candidate?.stargazers_count ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Why a search result is not a publishable game. An empty string means accept.
 *
 * The rules, in order: a real `owner/name`, a licence on the allowlist, an
 * existing (and not oversized) repository, a game signal in the name or
 * description, and nothing in the text that says "this is a library, a course
 * or a portfolio".
 */
/**
 * Hardware/firmware projects.
 *
 * `techniccontroller/wordclock-esp8266` described itself as "Wordclock …
 * with Pong, Tetris and Snake" and sailed through every game-keyword filter,
 * then passed the browser gate because an embedded web UI paints. It is a
 * firmware repository, not a game, and there is no way to play it.
 */
export const HARDWARE = /\b(esp8266|esp32|arduino|raspberry ?pi|neopixel|firmware|microcontroller|stm32|atmega|platformio|wordclock|led ?matrix|fpga)\b/i;

export function rejectReason(candidate, { minStars = 2, maxSizeKB = 6000 } = {}) {
  const repo = repoName(candidate);
  if (!repo) return 'missing repo name';
  if (!repo.includes('/')) return `not an owner/name repository: ${repo}`;

  const spdx = licenceOf(candidate);
  if (!spdx) return 'no licence';
  if (!ALLOWED_LICENCE.has(spdx)) return `licence ${spdx} is not on the allowlist`;

  const sizeKB = sizeOf(candidate);
  if (sizeKB === null) return 'unknown repository size';
  if (sizeKB <= 0) return 'empty repository';
  if (sizeKB > maxSizeKB) return `repository too large (${sizeKB} KB > ${maxSizeKB} KB)`;

  const stars = starsOf(candidate);
  if (stars !== null && stars < minStars) return `too few stars (${stars} < ${minStars})`;

  const text = `${repo} ${candidate?.description ?? ''}`.toLowerCase();
  if (HARDWARE.test(text)) return 'hardware/firmware project, not a browser game';

  const skip = SKIP_WORDS.find((word) => text.includes(word));
  if (skip) return `looks like a non-game ("${skip}")`;

  const strong = STRONG_GAME_WORDS.find((word) => text.includes(word));
  if (!strong) return 'no game signal in the name or description';

  const base = repo.split('/')[1].toLowerCase();
  const badName = NAME_REJECT.find((pattern) => pattern.test(base));
  if (badName) return `repository name looks like a library, course or portfolio: ${base}`;

  return '';
}

/** True when the candidate is a game we are willing to vendor. */
export function shouldAccept(candidate, options) {
  return rejectReason(candidate, options) === '';
}

/**
 * Collapse duplicate repositories, keeping the first record seen. GitHub
 * returns the same repo from many queries; stars sort first, so keeping the
 * first preserves the caller's ordering.
 */
export function dedupeCandidates(list) {
  const seen = new Set();
  const out = [];
  for (const candidate of Array.isArray(list) ? list : []) {
    const repo = repoName(candidate);
    const key = normaliseRepo(repo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}
