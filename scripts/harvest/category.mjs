/**
 * Catalogue category for a harvested game.
 *
 * The family is the strongest signal: a snake game belongs in arcade even if
 * its description happens to say "puzzle". When there is no family (or the
 * family is the catch-all `generic`), the title and description are scanned
 * for category words, and arcade is the last resort.
 */

/**
 * Every family id from copy.mjs, mapped to one of the catalogue categories.
 * `generic` is the catch-all and is deliberately not short-circuited by
 * categoryFor - a nameless game still gets its category from its words.
 */
export const CATEGORY_BY_FAMILY = {
  snake: 'arcade',
  tetris: 'arcade',
  pong: 'classics',
  pacman: 'arcade',
  breakout: 'arcade',
  invaders: 'arcade',
  racing: 'racing',
  platformer: 'arcade',
  flappy: 'arcade',
  maze: 'brain',
  match3: 'brain',
  '2048': 'puzzle',
  sliding: 'puzzle',
  sokoban: 'puzzle',
  memory: 'brain',
  sudoku: 'table',
  solitaire: 'table',
  mahjong: 'table',
  hangman: 'word',
  wordsearch: 'word',
  wordle: 'word',
  quiz: 'word',
  typing: 'word',
  towerdefense: 'strategy',
  roguelike: 'strategy',
  shooter: 'arcade',
  idle: 'sandbox',
  board: 'table',
  generic: 'sandbox',
};

/**
 * Keyword rules, most specific first. Each pattern runs against the
 * lowercased `title + description`, so a stray "word" does not drag a chess
 * game into the word category.
 */
const RULES = [
  ['word', /\b(word|words|wordle|anagram|letters?|spelling|vocabulary|hangman|crossword|typing|quiz|trivia|scrabble)\b/],
  ['racing', /\b(racing|race|racer|kart|rally|drift|motocross|speedway)\b/],
  ['strategy', /\b(strategy|tower defen[cs]e|roguelike|rts|tactics|empire|conquest|defence)\b/],
  ['brain', /\b(memory|maze|match[- ]?3|brain|logic|concentration|match three)\b/],
  ['table', /\b(sudoku|solitaire|klondike|freecell|mahjong|chess|checkers|draughts|backgammon|domino|ludo|poker|blackjack|card game)\b/],
  ['puzzle', /\b(2048|merge|slide|tetris|nonogram|picross|jigsaw|puzzle|tangram|sokoban)\b/],
  ['sandbox', /\b(sandbox|idle|clicker|simulator|tycoon|builder|drawing|paint)\b/],
  ['classics', /\b(pong|invaders|asteroids|pac ?man|galaga|centipede)\b/],
  ['arcade', /\b(arcade|snake|shooter|platformer|platform game|jump|runner|flappy|breakout|brick|ball|paddle)\b/],
];

const CATEGORIES = new Set([
  'word',
  'puzzle',
  'arcade',
  'brain',
  'strategy',
  'sandbox',
  'classics',
  'racing',
  'table',
]);

/**
 * Pick a category for a game.
 *
 * Order of authority: the family (unless it is the generic fallback), then a
 * keyword match on the title and description, then `'arcade'`.
 *
 * @param {string} family       Family id from copy.mjs, or anything else.
 * @param {string} [title]      Game title.
 * @param {string} [description] Clean game description.
 * @returns {string} One of word, puzzle, arcade, brain, strategy, sandbox,
 *   classics, racing, table.
 */
export function categoryFor(family, title = '', description = '') {
  const id = String(family ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  if (id && id !== 'generic' && Object.hasOwn(CATEGORY_BY_FAMILY, id)) {
    return CATEGORY_BY_FAMILY[id];
  }

  const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) return category;
  }
  return 'arcade';
}

/** All valid category ids, for callers that want to validate input. */
export const CATEGORIES_ALLOWED = Object.freeze([...CATEGORIES]);
