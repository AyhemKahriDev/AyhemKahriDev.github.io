/**
 * Search families for the harvest sweep.
 *
 * One flat list of 61 queries could only ever find the same ~700 repositories.
 * A 500-game harvest needs many more doors into GitHub, so the queries are
 * grouped by the kind of game a player would look for. Families overlap on
 * purpose (a tower defence game is both strategy and action, a Phaser game can
 * be anything); duplicates are removed once, in queriesFor().
 *
 * Every string is a real GitHub repository-search expression. The sweep adds
 * `license:<spdx> stars:>2` and paging on top, so nothing here may carry those.
 */

export const QUERY_FAMILIES = {
  arcade: [
    'topic:html5-game',
    'topic:arcade-game',
    'topic:arcade',
    'topic:snake-game',
    'topic:tetris',
    'topic:breakout',
    'topic:space-invaders',
    'topic:pacman',
    'topic:platformer',
    'topic:shmup',
    'topic:js13k',
    'topic:game-jam',
    'topic:gamejam',
    'topic:2d-game',
    'topic:retro-games',
    'arcade in:name',
    'snake in:name',
    'tetris in:name',
    'breakout in:description',
    'arcade game in:description',
  ],
  puzzle: [
    'topic:puzzle-game',
    'topic:puzzle',
    'topic:2048',
    'topic:sudoku',
    'topic:nonogram',
    'topic:picross',
    'topic:match-3',
    'topic:sokoban',
    'topic:mahjong',
    'topic:block-puzzle',
    'topic:tile-matching',
    'puzzle in:name',
    'sudoku in:description',
    '2048 in:description',
    'nonogram in:description',
    'topic:js13k puzzle',
    'topic:html5-game puzzle',
  ],
  word: [
    'topic:wordle',
    'topic:word-game',
    'topic:wordsearch',
    'topic:crossword',
    'topic:hangman',
    'topic:anagram',
    'topic:typing-game',
    'topic:spelling',
    'topic:vocabulary',
    'wordle in:description',
    'word game in:description',
    'hangman in:name',
    'crossword in:name',
    'word search in:description',
    'topic:quiz-game',
    'topic:trivia',
  ],
  action: [
    'topic:shooter',
    'topic:shmup',
    'topic:platformer',
    'topic:roguelike',
    'topic:rogue-like',
    'topic:bullet-hell',
    'topic:endless-runner',
    'topic:zombie-game',
    'topic:action-game',
    'topic:phaser',
    'topic:createjs',
    'topic:pixi',
    'topic:game-jam',
    'shooter in:description',
    'platformer in:name',
    'roguelike in:description',
    'invaders in:description',
  ],
  board: [
    'topic:board-game',
    'topic:boardgame',
    'topic:chess',
    'topic:checkers',
    'topic:solitaire',
    'topic:card-game',
    'topic:mahjong',
    'topic:connect-four',
    'topic:tic-tac-toe',
    'topic:reversi',
    'topic:backgammon',
    'topic:dominoes',
    'chess in:description',
    'solitaire in:name',
    'card game in:description',
    'board game in:description',
  ],
  racing: [
    'topic:racing-game',
    'topic:racing',
    'topic:car-game',
    'topic:driving-game',
    'topic:endless-runner',
    'topic:bike-game',
    'topic:kart',
    'topic:drift',
    'topic:turbo',
    'racing in:name',
    'racing game in:description',
    'car game in:description',
    'topic:canvas-game racing',
    'topic:javascript-game racing',
    'topic:game-jam racing',
  ],
  strategy: [
    'topic:tower-defense',
    'topic:towerdefence',
    'topic:strategy-game',
    'topic:rts',
    'topic:turn-based',
    'topic:roguelike',
    'topic:chess',
    'topic:defense-game',
    'topic:hex-strategy',
    'topic:4x',
    'topic:city-builder',
    'tower defense in:description',
    'strategy game in:description',
    'td game in:description',
    'topic:phaser strategy',
    'topic:createjs',
  ],
  sandbox: [
    'topic:sandbox-game',
    'topic:sandbox',
    'topic:idle-game',
    'topic:clicker',
    'topic:incremental-game',
    'topic:tycoon',
    'topic:simulation-game',
    'topic:falling-sand',
    'topic:cellular-automata',
    'topic:physics-sandbox',
    'topic:city-builder',
    'topic:matter-js',
    'idle game in:description',
    'clicker in:name',
    'sandbox in:name',
    'topic:javascript-game sandbox',
  ],
};

/** Family ids in a stable order - the sweep walks them in this order. */
export const FAMILY_IDS = Object.freeze(Object.keys(QUERY_FAMILIES));

/** `HARVEST_FAMILY` and `--family` both speak comma-separated family ids. */
function selectedFamilies(families) {
  if (families == null) return FAMILY_IDS;
  const raw = Array.isArray(families) ? families : String(families).split(',');
  const ids = raw
    .flatMap((f) => String(f).split(','))
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  // "all", or nothing at all, means the whole matrix.
  if (!ids.length || ids.includes('all')) return FAMILY_IDS;
  const unknown = ids.filter((id) => !QUERY_FAMILIES[id]);
  if (unknown.length) {
    throw new Error(
      `unknown harvest family: ${unknown.join(', ')} (known: ${FAMILY_IDS.join(', ')})`,
    );
  }
  return [...new Set(ids)];
}

/**
 * Flatten the selected families into one de-duplicated query list.
 *
 * @param {string|string[]|null|undefined} families family id(s), comma-separated
 *   string, array of ids, or nothing for every family.
 * @returns {string[]}
 */
export function queriesFor(families) {
  const out = [];
  const seen = new Set();
  for (const id of selectedFamilies(families)) {
    for (const raw of QUERY_FAMILIES[id]) {
      const query = raw.trim().replace(/\s+/g, ' ');
      if (!query || seen.has(query)) continue;
      seen.add(query);
      out.push(query);
    }
  }
  return out;
}
