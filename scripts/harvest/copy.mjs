/**
 * Deterministic player-facing copy for harvested games.
 *
 * A harvested repository gives us three unreliable things: a folder name, a
 * one-line GitHub description and a README written for developers. None of
 * them is page copy. This module turns them into a tagline, a description,
 * three controls, two questions and five keywords, using a fixed vocabulary
 * of game families. Same input always produces the same output - no clock,
 * no randomness - so a rebuild never churns the catalogue.
 *
 * The control lines are only allowed to claim what public/play.js really
 * injects: arrow keys, Space, swipe-to-arrow and the on-screen pad. No mouse
 * only, no gamepad, no multiplayer.
 */

/* ------------------------------------------------------------------ jargon */

/**
 * Developer and repository language that must never reach a player.
 *
 * Word boundaries matter: `div` must not match "divide", `repo` must not
 * match "report". Case-insensitive, non-global so `.test()` is stateless.
 */
const DEV_PATTERNS = [
  String.raw`\bnpm\b`,
  String.raw`\byarn\s+(?:install|add|run|start|build|dev)\b`,
  String.raw`\byarn\.lock\b`,
  String.raw`\bwebpack\b`,
  String.raw`\bvite\b`,
  String.raw`\bjquery\b`,
  String.raw`\bgit\s+clone\b`,
  String.raw`\bpackage\.json\b`,
  String.raw`\breadme\b`,
  String.raw`\brepositor(?:y|ies)\b`,
  String.raw`\brepos?\b`,
  String.raw`\bdemo\s+page\b`,
  String.raw`\burl:\s*https?\b`,
  String.raw`https?:\/\/github\.com`,
  String.raw`<script`,
  String.raw`\.css\b`,
  String.raw`\bcss\b`,
  String.raw`\bcanvas\s+element\b`,
  String.raw`\bin:name\b`,
  String.raw`\bin:description\b`,
  String.raw`\bimport\b`,
  String.raw`\brequire\s*\(`,
  String.raw`\bdiv\b`,
  String.raw`\bhtml\s+file\b`,
  String.raw`\bhtml5?\b`,
  String.raw`\bjavascript\b`,
  String.raw`\btypescript\b`,
  String.raw`\bjs\b`,
  String.raw`\bgithub\b`,
  String.raw`\binstall(?:ation|ing|ed)?\b`,
];

export const DEV_JARGON = new RegExp(DEV_PATTERNS.join('|'), 'i');

/**
 * Common English words used to tell an English description from a
 * foreign-language one. Token membership rather than `\b` regexes, because
 * accented letters are not word characters to JavaScript.
 */
const ENGLISH_STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'with',
  'for',
  'you',
  'your',
  'is',
  'are',
  'it',
  'this',
  'that',
  'play',
  'game',
  'games',
  'classic',
  'puzzle',
  'arcade',
  'browser',
  'quick',
  'simple',
  'small',
  'build',
  'world',
  'level',
  'score',
  'player',
  'welcome',
  'all',
  'one',
  'no',
  'not',
  'more',
  'new',
  'can',
  'how',
  'what',
]);

/** US spellings that should read as British in our copy. */
const US_TO_UK = new Map(
  Object.entries({
    color: 'colour',
    colors: 'colours',
    colored: 'coloured',
    coloring: 'colouring',
    colorful: 'colourful',
    favorite: 'favourite',
    favorites: 'favourites',
    gray: 'grey',
    center: 'centre',
    centers: 'centres',
    defense: 'defence',
    offense: 'offence',
    traveling: 'travelling',
    traveled: 'travelled',
    organize: 'organise',
    organizes: 'organises',
    organized: 'organised',
    organizing: 'organising',
    realize: 'realise',
    realizes: 'realises',
    realized: 'realised',
    realizing: 'realising',
    customize: 'customise',
    customizes: 'customises',
    customized: 'customised',
    customizing: 'customising',
    optimize: 'optimise',
    optimizes: 'optimises',
    optimized: 'optimised',
    optimizing: 'optimising',
  }),
);

/* ---------------------------------------------------------------- families */

/**
 * One family per kind of game the harvest actually turns up.
 *
 * `match` runs against the normalised title + description. `tagline` must
 * stay at or under 70 characters. `controls` is exactly three sentences, all
 * of them true of the injected pad and swipe layer.
 */
export const FAMILIES = [
  {
    id: 'snake',
    match: /\bsnake\b|serpent|nokia snake/,
    category: 'arcade',
    tagline: () => 'Eat, grow and keep clear of your own tail.',
    controls: [
      'Steer with the arrow keys, or use the on-screen pad.',
      'Swipe on a phone to send the snake a new direction.',
      'Eat the food, grow longer and never touch the walls or your own tail.',
    ],
  },
  {
    id: 'tetris',
    match: /tetris|blockrain|block ?out|falling block|tetromino|line clear/,
    category: 'arcade',
    tagline: () => 'Stack the falling blocks and clear every line.',
    controls: [
      'Move with the left and right arrows, rotate with the up arrow.',
      'Soft-drop with the down arrow and hard-drop with Space.',
      'Fill a whole row across the board to clear it and keep the stack low.',
    ],
  },
  {
    id: 'pong',
    match: /\bpong\b|ping ?pong|table tennis/,
    category: 'classics',
    tagline: () => 'Keep the ball in play and return every shot.',
    controls: [
      'Move your paddle with the up and down arrows, or use the on-screen pad.',
      'Swipe up or down on a phone to move the paddle.',
      'Return the ball past your opponent to win the point.',
    ],
  },
  {
    id: 'pacman',
    match: /pac ?-?man|dot muncher/,
    category: 'arcade',
    tagline: () => 'Clear the maze while the ghosts hunt you down.',
    controls: [
      'Move with the arrow keys, or use the on-screen pad.',
      'Swipe on a phone to turn at the next corner.',
      'Eat every dot in the maze and keep away from the ghosts.',
    ],
  },
  {
    id: 'breakout',
    match: /breakout|arkanoid|brick ?breaker|brickles|brick game|paddle game/,
    category: 'arcade',
    tagline: () => 'Bounce the ball, break the wall and keep the paddle ready.',
    controls: [
      'Slide the paddle with the left and right arrows, or use the on-screen pad.',
      'Bounce the ball into the bricks without letting it past you.',
      'Clear every brick to finish the wall and move on.',
    ],
  },
  {
    id: 'invaders',
    match: /\binvaders?\b|\basteroids?\b|galaga|galaxian|centipede|space invaders|missile command/,
    category: 'arcade',
    tagline: () => 'Hold the line and clear the sky, wave after wave.',
    controls: [
      'Move with the left and right arrows, or use the on-screen pad.',
      'Fire with Space or the A button on the pad.',
      'Clear each wave before it reaches the bottom of the screen.',
    ],
  },
  {
    id: 'racing',
    match: /\brace\b|\bracing\b|\bracer\b|\bkart\b|\brally\b|\bdrift\b|motocross|grand prix/,
    category: 'racing',
    tagline: () => 'Steer for the line and keep your foot down.',
    controls: [
      'Steer with the left and right arrows, or use the on-screen pad.',
      'Accelerate with the up arrow and brake with the down arrow.',
      'Swipe left or right on a phone to steer through the corner.',
    ],
  },
  {
    id: 'platformer',
    match: /platform(?:er|ing)?|side ?scroll|jump(?:ing)? game|\brunner\b|doodle jump/,
    category: 'arcade',
    tagline: () => 'Run, jump and reach the end of the level.',
    controls: [
      'Move with the left and right arrows, or use the on-screen pad.',
      'Jump with Space or the up arrow.',
      'Swipe up on a phone to jump, and swipe left or right to run.',
    ],
  },
  {
    id: 'flappy',
    match: /flappy|\bflap\b|helicopter|\bbird\b/,
    category: 'arcade',
    tagline: () => 'Tap to flap and thread every gap.',
    controls: [
      'Tap the screen or press Space to flap.',
      'Pass through each gap without touching the edges.',
      'Press R to start again after a crash.',
    ],
  },
  {
    id: 'maze',
    match: /\bmaze\b|\blabyrinth\b/,
    category: 'brain',
    tagline: () => 'Find the way out before the walls close in.',
    controls: [
      'Move with the arrow keys, or use the on-screen pad.',
      'Swipe on a phone to turn at the next junction.',
      'Reach the way out without getting stuck in a dead end.',
    ],
  },
  {
    id: 'match3',
    match: /match[- ]?(?:3|three)|bejewel|jewel|gem|three in a row|candy crush|same ?game|collapse/,
    category: 'brain',
    tagline: () => 'Swap two tiles, line up three and watch them go.',
    controls: [
      'Pick a tile with a tap or a click, then pick the one next to it.',
      'Line up three or more of the same colour to clear them.',
      'Move the selection with the arrow keys or the on-screen pad.',
    ],
  },
  {
    id: '2048',
    match: /\b2048\b|\bthrees\b|sliding tiles|number merge|merge tiles/,
    category: 'puzzle',
    tagline: () => 'Slide, merge and build the biggest number on the board.',
    controls: [
      'Slide every tile with the arrow keys, or use the on-screen pad.',
      'Two tiles with the same number merge into one when they meet.',
      'Swipe on a phone to send the whole board that way.',
    ],
  },
  {
    id: 'sliding',
    match: /fifteen puzzle|15 puzzle|sliding puzzle|slide puzzle|puzzle ?15/,
    category: 'puzzle',
    tagline: () => 'Slide the tiles into order, one move at a time.',
    controls: [
      'Move a tile into the empty space with the arrow keys.',
      'Swipe on a phone to slide the tile in that direction.',
      'Put every tile back in order to finish the puzzle.',
    ],
  },
  {
    id: 'sokoban',
    match: /sokoban|box ?push|crate push|push the crates?/,
    category: 'puzzle',
    tagline: () => 'Push every crate into place without getting stuck.',
    controls: [
      'Move with the arrow keys, or use the on-screen pad.',
      'Walk into a crate to push it one square.',
      'Swipe on a phone to push the crate in that direction.',
    ],
  },
  {
    id: 'memory',
    match: /memory|concentration|\bpairs\b|matching pairs|simon says/,
    category: 'brain',
    tagline: () => 'Turn two cards, remember where they were, find the pairs.',
    controls: [
      'Pick a card with a tap or a click to turn it over.',
      'Turn a second card and keep the pair when the two match.',
      'Move the selection with the arrow keys or the on-screen pad.',
    ],
  },
  {
    id: 'sudoku',
    match: /sudoku|killer sudoku|number place/,
    category: 'table',
    tagline: () => 'Fill the grid so every row, column and box is complete.',
    controls: [
      'Pick a square with a tap or a click, then choose the number you want.',
      'Move between squares with the arrow keys or the on-screen pad.',
      'Every row, column and box must hold each number exactly once.',
    ],
  },
  {
    id: 'solitaire',
    match: /solitaire|klondike|freecell|spider solitaire|\bpatience\b/,
    category: 'table',
    tagline: () => 'Build the four suits from ace to king and clear the table.',
    controls: [
      'Pick up a card with a tap or a click, then pick the pile it belongs on.',
      'Move the selection with the arrow keys or the on-screen pad.',
      'Build each suit in order and turn over the hidden cards as you go.',
    ],
  },
  {
    id: 'mahjong',
    match: /mahjong|mah-jongg?|shanghai tile|tile matching/,
    category: 'table',
    tagline: () => 'Clear the board by pairing matching tiles from the edges.',
    controls: [
      'Pick two matching tiles with a tap or a click.',
      'Move the selection with the arrow keys or the on-screen pad.',
      'Only tiles with a free side can be taken, so work inwards from the edges.',
    ],
  },
  {
    id: 'hangman',
    match: /hang ?man/,
    category: 'word',
    tagline: () => 'Guess the hidden word before the picture is complete.',
    controls: [
      'Choose a letter with a tap or a click.',
      'Move between letters with the arrow keys or the on-screen pad.',
      'Six wrong guesses end the round, so start with the common letters.',
    ],
  },
  {
    id: 'wordsearch',
    match: /word ?search|wordsearch|word find|find a word|word puzzle/,
    category: 'word',
    tagline: () => 'Find every hidden word in the grid.',
    controls: [
      'Drag across a line of letters, or move the cursor with the arrow keys.',
      'Words can run across, down, up or diagonally.',
      'Mark every word on the list to finish the puzzle.',
    ],
  },
  {
    id: 'wordle',
    match: /wordle|guess the word|five[- ]letter|5[- ]letter|daily word/,
    category: 'word',
    tagline: () => 'Six guesses to find the five-letter word.',
    controls: [
      'Type a word, or pick the letters on the keyboard shown in the game.',
      'Green means the right letter in the right place; yellow means it belongs elsewhere.',
      'Press Enter or the B button on the pad to submit your guess.',
    ],
  },
  {
    id: 'quiz',
    match: /\bquiz\b|trivia|questions? and answers?/,
    category: 'word',
    tagline: () => 'Answer the questions and see how much you know.',
    controls: [
      'Pick an answer with a tap or a click.',
      'Move between answers with the arrow keys or the on-screen pad.',
      'Every correct answer adds to your score, and the questions keep coming.',
    ],
  },
  {
    id: 'typing',
    match: /typing|type ?racer|keyboard hero|speed typing|type test/,
    category: 'word',
    tagline: () => 'Type the words as fast and as accurately as you can.',
    controls: [
      'Type each word that appears, then press Space to move on.',
      'Keep your hands on the keyboard and your eyes on the text.',
      'Accuracy and speed both count towards your score.',
    ],
  },
  {
    id: 'towerdefense',
    match: /tower[- ]?defen[cs]e|\btd\b|defend the (?:base|tower|path)/,
    category: 'strategy',
    tagline: () => 'Build your towers and hold the line against the waves.',
    controls: [
      'Pick a tower with a tap or a click, then pick a spot beside the path.',
      'Move between build spots with the arrow keys or the on-screen pad.',
      'Each wave is stronger than the last, so upgrade before it arrives.',
    ],
  },
  {
    id: 'roguelike',
    match: /rogue[- ]?like|dungeon|nethack|dwarf fortress|procgen|permadeath/,
    category: 'strategy',
    tagline: () => 'One life, a fresh dungeon and a fight to the last floor.',
    controls: [
      'Move one square at a time with the arrow keys, or use the on-screen pad.',
      'Walk into a monster to attack it and step on an item to pick it up.',
      'Swipe on a phone to move one square at a time.',
    ],
  },
  {
    id: 'shooter',
    match: /\bshoot(?:er|ing)?\b|\bgun\b|gunfight|turret|bullet hell|space war|\btank\b/,
    category: 'arcade',
    tagline: () => 'Keep moving, keep firing and stay alive.',
    controls: [
      'Move with the arrow keys, or use the on-screen pad.',
      'Fire with Space or the A button on the pad.',
      'Dodge what comes at you and clear the screen.',
    ],
  },
  {
    id: 'idle',
    match: /\bidle\b|clicker|incremental|tycoon|simulator|factory|\bminer\b|farming|builder/,
    category: 'sandbox',
    tagline: () => 'Start small, earn steadily and watch the numbers grow.',
    controls: [
      'Tap or click to earn your first coins.',
      'Spend what you earn on upgrades that earn faster.',
      'Move between upgrades with the arrow keys or the on-screen pad.',
    ],
  },
  {
    id: 'board',
    match: /board game|\bchess\b|checkers|draughts|reversi|othello|backgammon|\bludo\b|domino|poker|blackjack|connect four|four in a row|tic tac toe|noughts and crosses/,
    category: 'table',
    tagline: () => 'Take turns, think ahead and win the board.',
    controls: [
      'Pick a piece with a tap or a click, then pick where it moves.',
      'Move the selection with the arrow keys or the on-screen pad.',
      'Take turns with your opponent and protect your own pieces.',
    ],
  },
  {
    id: 'generic',
    // Never matched by familyFor; it is the explicit fallback below.
    match: /(?:)^/,
    category: 'sandbox',
    tagline: () => 'A quick game to pick up and play in the browser.',
    controls: [
      'Tap or click to start, then follow the prompts inside the game.',
      'Move with the arrow keys, or use the on-screen pad.',
      'Swipe on a phone to send the arrow keys the game expects.',
    ],
  },
];

/* ------------------------------------------------------- fallback writing */

/**
 * One sentence per family, used when the harvested description is empty or
 * nothing player-facing survives the clean-up. Kept between 60 and 140
 * characters so the assembled description always lands in its 60-200 window.
 */
const FALLBACK = {
  snake:
    'A game of quick turns: eat what you can, grow longer and keep clear of the walls and your own tail.',
  tetris:
    'A falling-block puzzle: stack the shapes, fill the rows and keep the board from filling up.',
  pong: 'A paddle-and-ball classic: return every shot, find the angle and win the point.',
  pacman: 'A maze chase: eat every dot, dodge the ghosts and clear the level before they corner you.',
  breakout:
    'A brick-breaking game: keep the ball in play, aim it with the paddle and clear the wall.',
  invaders:
    'A wave shooter: move along the bottom, fire upwards and clear the formation before it lands.',
  racing:
    'A race against the clock: steer through the course, hold your line and finish first.',
  platformer:
    'A side-on platform game: run, jump across the gaps and reach the end of the level.',
  flappy: 'A one-button game: flap to stay in the air and thread through every gap.',
  maze: 'A maze to solve: find the route through the walls and reach the way out.',
  match3:
    'A match-three puzzle: swap neighbouring tiles, line up three of a colour and clear the board.',
  '2048':
    'A sliding-tile puzzle: merge matching numbers, build bigger tiles and keep the board moving.',
  sliding:
    'A sliding-tile puzzle: move one tile at a time and put the whole board back in order.',
  sokoban:
    'A box-pushing puzzle: walk the room, push every crate onto its mark and never trap yourself.',
  memory:
    'A memory game: turn two cards at a time and remember where each picture was.',
  sudoku:
    'A number puzzle: fill every row, column and box with the digits one to nine, each used once.',
  solitaire:
    'A card game for one: build the suits in order, turn over the hidden cards and clear the table.',
  mahjong:
    'A tile-matching puzzle: pair identical tiles from the edges and work your way inwards.',
  hangman:
    'A word game: guess the hidden word one letter at a time before your chances run out.',
  wordsearch:
    'A word puzzle: scan the grid across, down and diagonally to find every word on the list.',
  wordle: 'A word puzzle: six guesses, five letters and a colour clue after every try.',
  quiz: 'A quiz: answer the questions, keep the score ticking and see how far you get.',
  typing:
    'A typing challenge: copy the words on screen as quickly and accurately as you can.',
  towerdefense:
    'A tower defence game: place your towers along the path and stop every wave.',
  roguelike:
    'A dungeon run: one life, a fresh layout each time and a fight for every floor.',
  shooter: 'A shoot-out: keep moving, fire at what comes for you and stay alive.',
  idle: 'An idle game: earn a little, spend it on upgrades and watch the numbers climb.',
  board: 'A board game: take turns, plan a few moves ahead and protect your pieces.',
  generic: 'A browser game that is quick to learn and easy to pick up again.',
};

/**
 * Closing clause. Four variants, assigned per family, so 500 pages do not all
 * end with the same eight words. All four sit in the 59-63 character range.
 */
const SUFFIX_VARIANTS = [
  'Free to play in your browser, with no download and no sign-up.',
  'Play free in your browser, with no download and no account.',
  'Free in your browser, with no download and no sign-up at all.',
  'Runs in your browser, free, with no download and no sign-up.',
];

const SUFFIX_FAMILIES = [
  'snake',
  'tetris',
  'pong',
  'pacman',
  'breakout',
  'invaders',
  'racing',
  'platformer',
  'flappy',
  'maze',
  'match3',
  '2048',
  'sliding',
  'sokoban',
  'memory',
  'sudoku',
  'solitaire',
  'mahjong',
  'hangman',
  'wordsearch',
  'wordle',
  'quiz',
  'typing',
  'towerdefense',
  'roguelike',
  'shooter',
  'idle',
  'board',
  'generic',
];

const SUFFIX = Object.fromEntries(
  SUFFIX_FAMILIES.map((id, i) => [id, SUFFIX_VARIANTS[i % SUFFIX_VARIANTS.length]]),
);

/** Short human label per family, used to build search keywords. */
const FAMILY_LABEL = {
  snake: 'snake',
  tetris: 'block puzzle',
  pong: 'pong',
  pacman: 'pacman',
  breakout: 'brick breaker',
  invaders: 'space shooter',
  racing: 'racing',
  platformer: 'platform',
  flappy: 'one-button',
  maze: 'maze',
  match3: 'match three',
  '2048': 'number puzzle',
  sliding: 'sliding puzzle',
  sokoban: 'sokoban',
  memory: 'memory',
  sudoku: 'sudoku',
  solitaire: 'solitaire',
  mahjong: 'mahjong',
  hangman: 'hangman',
  wordsearch: 'word search',
  wordle: 'wordle',
  quiz: 'quiz',
  typing: 'typing',
  towerdefense: 'tower defence',
  roguelike: 'dungeon',
  shooter: 'shooter',
  idle: 'idle',
  board: 'board',
  generic: 'quick',
};

/** Words that are stripped from repository names before they become titles. */
const TITLE_NOISE = new Set([
  'github',
  'html',
  'html5',
  'javascript',
  'typescript',
  'js',
  'ts',
  'jquery',
  'canvas',
  'webgl',
  'phaser',
  'pixi',
  'pixijs',
  'webpack',
  'vite',
  'npm',
  'yarn',
  'demo',
  'example',
  'tutorial',
  'sample',
]);

const TITLE_TAIL = /^(?:games?|clone|remake|copy)$/i;

const TITLE_MINOR = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'via',
  'vs',
  'with',
]);

/* --------------------------------------------------------------- helpers */

/** Collapse whitespace and trim. */
function squash(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cut a sentence down to `limit` characters without leaving a dangling
 * conjunction. Always returns something endable with a full stop.
 */
function shorten(sentence, limit) {
  const s = squash(sentence);
  if (s.length <= limit) return s;
  const cap = Math.max(1, limit - 1);
  const window = s.slice(0, cap);
  const stop = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! '),
  );
  if (stop >= Math.floor(cap * 0.4)) return window.slice(0, stop + 1).trim();

  const lastSpace = window.lastIndexOf(' ');
  let cut = (lastSpace > 0 ? window.slice(0, lastSpace) : window).replace(/[\s,;:+-]+$/, '');
  for (let i = 0; i < 3; i += 1) {
    const next = cut
      .replace(
        /\b(?:and|or|but|with|for|of|the|a|an|to|in|on|at|by|from|that|which|is|are|was|were|as)\s*$/i,
        '',
      )
      .replace(/[\s,;:+-]+$/, '');
    if (next === cut) break;
    cut = next;
  }
  if (!cut) cut = window.trim();
  return `${cut.replace(/\.+$/, '')}.`;
}

/** True when the string is shouting or is a single short all-caps token. */
function isAllCaps(value) {
  const s = squash(value);
  return /[A-Z]{2}/.test(s) && !/[a-z]/.test(s);
}

/** Title-case one token, leaving the small joining words alone. */
function titleWord(word, index) {
  const lower = word.toLowerCase();
  if (/^\d+$/.test(word)) return word;
  if (/^\d+[a-z]+$/.test(lower)) return word.toUpperCase();
  if (index > 0 && TITLE_MINOR.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/* ------------------------------------------------------------------ title */

/**
 * Turn a repository slug into a human title.
 *
 * `bocaletto-luca/arkanoid` becomes `Arkanoid`; `luleoa12/wordle-craft`
 * becomes `Wordle Craft`. Owner prefixes, technology words, trailing `game`
 * and repeated words are removed, and the result is Title Cased.
 *
 * @param {string} repo  Repository name, optionally `owner/name`.
 * @param {string} [description] Used only when the repository is empty.
 * @returns {string} A short human title.
 */
export function cleanTitle(repo, description) {
  let raw = squash(repo);
  raw = raw.replace(/^https?:\/\/[^/]+\//i, '').replace(/\.git$/i, '');
  if (raw.includes('/')) raw = raw.split('/').filter(Boolean).pop() || '';
  if (!raw) {
    raw = squash(description).split(/\s+/).slice(0, 4).join(' ');
  }

  let words = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.,+]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !TITLE_NOISE.has(word.toLowerCase()));

  while (words.length > 1 && TITLE_TAIL.test(words[words.length - 1])) words.pop();
  words = words.filter((word, i) => i === 0 || word.toLowerCase() !== words[i - 1].toLowerCase());
  while (words.length > 1 && TITLE_MINOR.has(words[words.length - 1].toLowerCase())) words.pop();

  if (!words.length) words = ['Arcade', 'Classic'];
  if (words.length > 6) words = words.slice(0, 6);

  const title = words
    .map((word, i) => titleWord(word, i))
    .join(' ')
    .replace(/[\s,;:.\-]+$/, '');
  return title || 'Arcade Classic';
}

/* ------------------------------------------------------------ description */

/**
 * Reduce a repository description to one player-facing sentence.
 *
 * Markdown, links, bare URLs, emoji, HTML, technology words and code clauses
 * are removed; the first surviving sentence is returned. Returns an empty
 * string when nothing usable is left, so callers can fall back to a family
 * template.
 *
 * @param {string} description  Raw repository description.
 * @returns {string} A clean sentence, or `''`.
 */
function deriveSentence(description) {
  if (typeof description !== 'string') return '';
  let s = description;

  // Code, comments and inline code carry no player value.
  s = s.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/`[^`]*`/g, ' ');

  // Images vanish; links keep their words.
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  s = s.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, ' ');

  // HTML tags (including script tags) and bare URLs.
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/https?:\/\/\S+/gi, ' ').replace(/\bwww\.\S+/gi, ' ');

  // Emoji, variation selectors, joiners and keycaps.
  s = s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u200B]/gu, ' ');
  s = s.replace(/[0-9#*]\uFE0F?\u20E3/gu, ' ');
  // Emoji shortcodes such as :space_invader:.
  s = s.replace(/:[a-z][a-z0-9_+-]{1,30}:/gi, ' ');

  // Markdown decoration.
  s = s.replace(/[*_~]+/g, ' ');
  s = s.replace(/^\s*>+\s?/gm, ' ');
  s = s.replace(/^\s*\|.*\|\s*$/gm, ' ');
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, '-');
  s = squash(s);

  // Boilerplate appended by the older generator must never be fed back in.
  s = s.replace(/\s*play\b[^.!?]*?\bon arcadefork\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\s*[-–—]?\s*no download,?\s*no sign-up[^.!?]*[.!?]?/gi, ' ');
  s = squash(s);

  // One sentence is enough for a catalogue card.
  const first = s.split(/(?<=[.!?])\s+/)[0] || s;
  s = first;

  // "built with canvas and JavaScript" disappears; "built with love" stays.
  s = s.replace(
    /\b(?:built|made|written|coded|created|developed|implemented)\s+(?:with|in|using)\s+(html5?|javascript|typescript|js|css3?|canvas|webgl|jquery|react|vue|svelte|phaser|pixi(?:js)?|p5(?:\.?js)?|three\.?js|node\.?js|es6|es2015|vanilla|mediapipe|dom|api|sdk)\b/gi,
    ' ',
  );
  s = s.replace(
    /\b(?:in|with|using|powered by)\s+(html5?|javascript|typescript|js|css3?|canvas|webgl|jquery|phaser|pixi(?:js)?|p5(?:\.?js)?|three\.?js|node\.?js|es6|vanilla|mediapipe)\b/gi,
    ' ',
  );
  s = s.replace(
    /\b(html5?|javascript|typescript|jquery|webpack|vite|npm|yarn|css3?|webgl|phaser|pixijs?|p5(?:\.?js)?|three\.?js|node\.?js|vanilla|mediapipe|canvas|web[- ]?based|web[- ]?browser|browser[- ]based|web game|web audio|single[- ]file)\b/gi,
    ' ',
  );
  // "Bullet hell asteroids game and Vue." leaves a framework stranded.
  s = s.replace(/\b(?:and|or|with|in)\s+(?:react|vue|svelte|angular|next|nuxt)(?:\.?js)?\b/gi, ' ');
  // File sizes and line counts are developer trivia, not a reason to play.
  s = s.replace(/\bin\s+\d+(?:\.\d+)?\s*(?:kb|mb|gb|bytes?)\b(?:\s+of)?/gi, ' ');
  s = s.replace(/\b(?:with|in|of)\s+\d+\s+lines?\b(?:\s+of\s+code)?/gi, ' ');
  s = s.replace(/\b\d+\s+lines?\s+of\s+code\b/gi, ' ');
  // Removing "HTML, CSS and JS" leaves "game , , and ." behind.
  s = s.replace(/\s*,\s*(?=,|\.)/g, '');
  s = s.replace(/\s*,\s*(?=(?:and|or)\b)/gi, ' ');
  s = s.replace(/(?:\s*,\s*)+/g, ', ');
  s = s.replace(/,\s*(?:and|or)?\s*\./gi, '.');
  s = s.replace(/\s+(?:and|or)\s*\./gi, '.');
  s = s.replace(/\s+([,.;:])/g, '$1');
  s = squash(s);

  // A README sentence about how the thing was made is not a reason to play.
  if (/^\s*(?:building|making|creating|implementing|writing|porting|rewriting)\b/i.test(s)) {
    return '';
  }

  // Leading throat-clearing: "This is a", "A simple", "A clone of".
  s = s.replace(
    /^\s*(?:this\s+(?:is|was)\s+)?(?:an?\s+)?(?:very\s+)?(?:simple|small|minimal|tiny|basic|quick|little|responsive)\s+/i,
    '',
  );
  s = s.replace(
    /^\s*(?:this\s+(?:is|was)\s+)?(?:an?\s+)?(?:simple\s+|small\s+|basic\s+)?(?:clone\s+(?:game\s+)?of|recreation\s+of|remake\s+of|version\s+of|implementation\s+of|port\s+of)\s+/i,
    '',
  );
  s = s.replace(/^\s*(?:this\s+(?:is|was)\s+)?(?:an?\s+)/i, '');
  // "This is Mahjong game" has no article to drop.
  s = s.replace(/^\s*this\s+(?:is|was)\s+/i, '');
  // The page heading already says the name; "Welcome to" is noise.
  s = s.replace(/^\s*welcome to\s+/i, '');

  // "Wordle clone" is just "Wordle" on a card.
  s = s.replace(/\s+(?:clone|remake|recreation|copy)\s*$/i, '');

  // A dangling "for" or "in" left behind by a removed technology word.
  for (let i = 0; i < 3; i += 1) {
    const next = squash(s).replace(
      /\s+(?:for|with|in|on|at|by|from|of|and|or|using|based|built|made)\s*$/i,
      '',
    );
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[\s,]+(?:built|made|written)\s+(?:entirely|from scratch|by hand)\s*\.?$/i, '.');

  // Punctuation noise, then sentence shape.
  s = s.replace(/!+/g, '.').replace(/\(\s*\)/g, ' ');
  s = squash(s).replace(/[\s,;:|\-+]+$/, '').replace(/\.+$/, '');
  s = s.replace(/^[\s\-–—/|:;,.+¿¡!?]+/, '');
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // SHOUTED words in a repo description are not sentence case.
  s = s.replace(/\b[A-Z]{4,}\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
  if (!/[.!?]$/.test(s)) s = `${s}.`;

  // A README sentence about how the thing was made is not a reason to play.
  if (
    /\b(?:written|rendered|implemented|coded|developed|codebase|source code|boilerplate|scaffold|framework|responsive|prototype|programming)\b|my first|thrown together|working on|for fun\b|practice project|learning project|toy project|work in progress|weekend project/i.test(
      s,
    )
  ) {
    return '';
  }
  // Mixed scripts do not read as English catalogue copy; use the template.
  if (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}]/u.test(
      s,
    )
  ) {
    return '';
  }

  // Not enough words to be a sentence, or still full of developer language.
  // "Racing game." is thinner than the family template, so it is not kept.
  if (s.length < 20) return '';
  if ((s.match(/[a-z]/gi) || []).length < 6) return '';
  if (!/\s/.test(s) && s.length < 8) return '';
  // A long sentence with no common English word at all is a foreign-language
  // description; the family template reads better than a half-translated card.
  // Token membership, not a regex: `\b` would split accented words.
  const words = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const english = words.filter((word) => ENGLISH_STOP.has(word)).length;
  if (words.length >= 5 && english === 0) return '';
  // British spelling, even when the repository author used US spelling.
  s = s.replace(
    /\b(?:color|colors|colored|coloring|colorful|favorite|favorites|gray|center|centers|defense|offense|traveling|traveled|organize|organizes|organized|organizing|realize|realizes|realized|realizing|customize|customizes|customized|customizing|optimize|optimizes|optimized|optimizing)\b/gi,
    (word) => {
      const uk = US_TO_UK.get(word.toLowerCase());
      if (!uk) return word;
      return /^[A-Z]/.test(word) ? uk.charAt(0).toUpperCase() + uk.slice(1) : uk;
    },
  );
  if (DEV_JARGON.test(s)) return '';
  return s;
}

/**
 * One clean sentence for a catalogue card.
 *
 * Falls back to a template chosen from the family the description hints at,
 * so this never returns an empty string and never leaks repository language.
 *
 * @param {string} description  Raw repository description.
 * @returns {string} A player-facing sentence.
 */
export function cleanDescription(description) {
  const derived = deriveSentence(description);
  if (derived) return derived;
  const guess = familyFor(typeof description === 'string' ? description : '');
  return FALLBACK[guess] || FALLBACK.generic;
}

/* ---------------------------------------------------------------- family */

/**
 * Normalise free text for matching: lowercase, punctuation to spaces.
 *
 * @param {string} text
 * @returns {string}
 */
function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick the family whose pattern matches the title and description.
 *
 * @param {string} text  Usually `${title} ${description}`.
 * @returns {string} A family id from FAMILIES, or `'generic'`.
 */
export function familyFor(text) {
  const haystack = normalise(text);
  for (const family of FAMILIES) {
    if (family.id === 'generic') continue;
    if (family.match.test(haystack)) return family.id;
  }
  return 'generic';
}

/** Resolve a supplied family id, falling back to the title guess. */
function resolveFamily(family, title, description) {
  const id = normalise(family).replace(/\s+/g, '');
  const exact = FAMILIES.find((f) => f.id === id);
  if (exact) return exact;
  const guessed = familyFor(`${title} ${description}`);
  return FAMILIES.find((f) => f.id === guessed) || FAMILIES[FAMILIES.length - 1];
}

/**
 * Keep a supplied title when it is already human; otherwise rebuild it.
 * A title carrying developer words, shouting, or running long is not usable.
 */
function resolveTitle(title, repo, description) {
  const given = squash(title);
  const usable =
    given.length >= 2 &&
    given.length <= 48 &&
    !DEV_JARGON.test(given) &&
    !isAllCaps(given) &&
    /[a-z]/i.test(given) &&
    /^[\p{L}\p{N} '&.\-]+$/u.test(given);
  if (usable) return given.replace(/[\s,;:.\-]+$/, '');
  return cleanTitle(repo || given, description);
}

/* ------------------------------------------------------------------- copy */

/** Assemble a description inside the 60-200 character window. */
function composeDescription(base, familyId) {
  const MAX = 200;
  const suffix = SUFFIX[familyId] || SUFFIX.generic;
  const room = MAX - suffix.length - 1;
  let body = squash(base);
  if (body.length > room) body = shorten(body, room);
  let out = squash(`${body} ${suffix}`);
  if (out.length < 60) out = squash(`${out} It is free to play in your browser.`);
  if (out.length > MAX) out = shorten(out, MAX);
  return out;
}

/** Five unique, lowercase keywords, always the same for the same input. */
function keywordsFor(title, family) {
  const lower = title.toLowerCase();
  const label = FAMILY_LABEL[family.id] || family.id;
  const wanted = [
    `${lower} game`,
    `play ${lower} online`,
    `free ${lower}`,
    `online ${label} game`,
    `${family.category} game`,
    'browser game',
    'free online game',
    'quick game',
    'arcade game',
    'puzzle game',
  ];

  const seen = new Set();
  const out = [];
  for (const keyword of wanted) {
    const clean = squash(keyword);
    if (!clean || seen.has(clean) || DEV_JARGON.test(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length === 5) break;
  }
  return out;
}

/**
 * Build the player-facing block for one catalogue page.
 *
 * Deterministic: the same input always returns the same object. Every string
 * is free of developer language, and the control lines only claim the arrows,
 * Space, swipe and on-screen pad the play page injects.
 *
 * @param {object} game
 * @param {string} game.title        Human title, already cleaned or raw.
 * @param {string} [game.repo]       `owner/name` repository slug.
 * @param {string} [game.description] Raw repository description.
 * @param {string} [game.family]     Family id; guessed when absent.
 * @returns {{tagline: string, description: string, howToPlay: string[],
 *   faq: Array<{q: string, a: string}>, keywords: string[]}}
 */
export function copyFor({ title, repo, description, family } = {}) {
  const safeTitle = resolveTitle(title, repo, description);
  const entry = resolveFamily(family, safeTitle, description);

  const tagline = shorten(entry.tagline(safeTitle), 70);
  const base = deriveSentence(description) || FALLBACK[entry.id] || FALLBACK.generic;
  const descriptionText = composeDescription(base, entry.id);

  const howToPlay = entry.controls.map((line) => squash(line));
  const faq = [
    {
      q: `Is ${safeTitle} free to play?`,
      a: `Yes. ${safeTitle} is free to play in your browser, with no account, no download and no payment.`,
    },
    {
      q: `Does ${safeTitle} work on a phone?`,
      a: 'Yes. It runs in a phone browser, and the on-screen pad and swipe controls send the same keys as a keyboard.',
    },
  ];
  const keywords = keywordsFor(safeTitle, entry);

  return { tagline, description: descriptionText, howToPlay, faq, keywords };
}
