/**
 * Deterministic player-facing copy for harvested games.
 *
 * A harvested repository gives us three unreliable things: a folder name, a
 * one-line GitHub description and a README written for developers. None of
 * them is page copy. This module turns them into a title, a tagline, a
 * description, three controls, two questions and five keywords, using a fixed
 * vocabulary of game families. Same input always produces the same output -
 * no clock, no randomness - so a rebuild never churns the catalogue.
 *
 * The control lines are only allowed to claim what public/play.js really
 * injects: arrow keys, Space, swipe-to-arrow and the on-screen pad. No mouse
 * only, no gamepad, no multiplayer.
 */

import { SITE_NAME } from '../site.mjs';

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
    description: (title) =>
      'Steer a snake around the board, eat what spawns and avoid your own tail as the body gets longer.',
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
    description: (title) =>
      'Drop the falling blocks into place, fill a full row across the board and keep the stack away from the top.',
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
    description: (title) =>
      'Move your paddle to meet every shot, angle the ball past your opponent and take the point.',
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
    description: (title) =>
      'Run the maze, eat every dot along the way and slip past the ghosts before they close in.',
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
    description: (title) =>
      'Slide the paddle, bounce the ball into the bricks and clear the whole wall without losing it.',
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
    description: (title) =>
      'Hold the line at the bottom of the screen, fire upwards and clear each formation before it lands.',
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
    description: (title) =>
      'Steer through the course, brake into the corners and hold your line all the way to the flag.',
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
    description: (title) =>
      'Run along the level, jump the gaps and time each leap so you land on solid ground.',
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
    description: (title) =>
      'Tap to keep the bird in the air, thread every gap and see how far one run will take you.',
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
    description: (title) =>
      'Find the route through the walls, remember the dead ends and make your way to the exit.',
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
    description: (title) =>
      'Swap two neighbouring tiles, line up three of a colour and clear them to open up the board.',
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
    description: (title) =>
      'Slide the whole board with each move, merge matching numbers and build the largest tile you can.',
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
    description: (title) =>
      'Move one tile at a time into the empty space and put the whole picture back in order.',
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
    description: (title) =>
      'Walk the room, push each crate onto its mark and take care never to trap it against a wall.',
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
    description: (title) =>
      'Turn two cards at a time, remember where each picture sits and pair up the whole board.',
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
    description: (title) =>
      'Fill every row, column and box with the digits one to nine, each of them used exactly once.',
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
    description: (title) =>
      'Deal the cards, build each suit from ace to king and turn over the hidden cards as you go.',
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
    description: (title) =>
      'Pair identical tiles from the edges and work inwards until the whole board has been cleared.',
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
    description: (title) =>
      'Guess the hidden word one letter at a time and keep your wrong guesses down to a handful.',
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
    description: (title) =>
      'Scan the grid across, down and diagonally to find every word on the list before the round ends.',
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
    description: (title) =>
      'Guess the five-letter word in six tries, using the colour clues after each attempt to narrow it down.',
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
    description: (title) =>
      'Answer a run of questions, pick from the choices on screen and see how many you get right.',
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
    description: (title) =>
      'Type each word that appears as quickly and accurately as you can, and keep the run going.',
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
    description: (title) =>
      'Place towers along the path, spend what you earn on upgrades and stop every wave before it reaches the base.',
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
    description: (title) =>
      'Take one life into a fresh dungeon, fight what you meet and see how deep you can get.',
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
    description: (title) =>
      'Keep moving, aim at whatever comes for you and clear the screen without taking a hit.',
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
    description: (title) =>
      'Tap to earn your first coins, spend them on upgrades and watch the numbers climb while you wait.',
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
    description: (title) =>
      'Take turns moving your pieces, plan a few moves ahead and protect your own side of the board.',
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
    description: (title) =>
      'Read the prompts, pick up the controls as you go and see how far one run of this browser game takes you.',
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
 * nothing player-facing survives the clean-up. These are the families'
 * `description()` templates read back by id, so there is exactly one copy of
 * each sentence and no family can drift from its fallback.
 *
 * The templates accept the page title but do not repeat it: a genre sentence
 * plus the game's name in the same breath is keyword stuffing, and several
 * harvested titles are still being repaired elsewhere.
 */
const FALLBACK = Object.fromEntries(FAMILIES.map((family) => [family.id, family.description('')]));

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

/**
 * Words that are stripped from repository names before they become titles.
 * `io` and `com` are here because a repository called `weatherio` or
 * `games.com` is naming a host, not a game.
 */
const TITLE_NOISE = new Set([
  'github',
  'io',
  'com',
  'www',
  'html',
  'html5',
  'javascript',
  'typescript',
  'js',
  'ts',
  'jquery',
  'canvas',
  'web',
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
  'source',
  'assets',
  'asset',
  'complete',
  'art',
  'arts',
  'final',
  'wip',
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

/** Acronyms and numeric labels that stay upper-case in a title. */
const TITLE_ACRONYMS = new Set([
  'tv',
  'ai',
  'hd',
  'hdmi',
  '3d',
  '2d',
  '4k',
  '8k',
  'vr',
  'ar',
  'rpg',
  'fps',
  'pvp',
  'td',
  'dps',
  'html5',
  'n64',
  'gba',
  'nes',
  'snes',
  'usa',
  'uk',
]);

/** Two-letter words that may sit in the middle of a run-together name. */
const TITLE_CONNECTORS = new Set(['to']);

/**
 * Common game words, used to break run-together repository names such as
 * `dungeongeneration` or `towerdefense` back into words. Only lowercase
 * entries belong here; `splitRunTogether` matches whole pieces.
 */
const TITLE_WORDS = new Set([
  // The core vocabulary: every family the catalogue publishes.
  'dungeon',
  'generation',
  'cursed',
  'souls',
  'tower',
  'defense',
  'defence',
  'snake',
  'tetris',
  'breakout',
  'flappy',
  'bird',
  'racing',
  'puzzle',
  'memory',
  'space',
  'invaders',
  'platform',
  'runner',
  'maze',
  'card',
  'cards',
  'solitaire',
  'sudoku',
  'mahjong',
  'hangman',
  'word',
  'search',
  'typing',
  'quiz',
  'trivia',
  'blocks',
  'block',
  'bricks',
  'ball',
  'paddle',
  'alien',
  'aliens',
  'zombie',
  'zombies',
  'ninja',
  'knights',
  'adventure',
  'quest',
  'battle',
  'arena',
  'drift',
  'kart',
  'tank',
  'tanks',
  'war',
  'chess',
  'checkers',
  'go',
  'ludo',
  'bingo',
  // Words the live harvest actually needs to split cleanly.
  'to',
  'game',
  'games',
  'rocks',
  'tiny',
  'asteroid',
  'asteroids',
  'galaxy',
  'pinball',
  'bubble',
  'fruit',
  'candy',
  'jewel',
  'gems',
  'match',
  'merge',
  'stack',
  'skies',
  'flight',
  'plane',
  'cars',
  'car',
  'truck',
  'moto',
  'bike',
  'dash',
  'rush',
  'hero',
  'heroes',
  'knight',
  'dragon',
  'magic',
  'sword',
  'castle',
  'kingdom',
  'farm',
  'city',
  'tycoon',
  'idle',
  'clicker',
  'fish',
  'fishing',
  'soccer',
  'football',
  'tennis',
  'golf',
  'pool',
  'bowling',
  'darts',
  'shooter',
  'survival',
  'defender',
  'pong',
  'pacman',
  'doodle',
  'jump',
  'bounce',
  'climb',
]);

/**
 * Words that really do end in `io`/`com`; the site-suffix strip in
 * `cleanTitle` must leave them alone.
 */
const TITLE_KEEP_SUFFIX = new Set([
  'radio',
  'studio',
  'portfolio',
  'scenario',
  'scorpio',
  'audio',
  'trio',
  'ratio',
  'patio',
  'folio',
  'rodeo',
]);

/** Repository-name furniture: a Pages site, a host suffix, a branch name. */
const SITE_SUFFIX = [
  /\.github\.io$/i,
  /[-_.]github[-_.]io$/i,
  /[-_.]github[-_.]com$/i,
  /[-_.]gh[-_.]pages$/i,
  /[-_.]game[-_.]web$/i,
  /[-_.]web$/i,
  /[-_.]master$/i,
  /[-_.]main$/i,
];

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

/** Title-case one token, leaving acronyms and small joining words alone. */
function titleWord(word, index) {
  const lower = word.toLowerCase();
  if (TITLE_ACRONYMS.has(lower) || /^\d+[a-z]$/.test(lower)) return lower.toUpperCase();
  if (/^\d+$/.test(word)) return word;
  // A title should use British spelling where the word has two forms.
  const base = US_TO_UK.get(lower) || lower;
  if (index > 0 && TITLE_MINOR.has(base)) return base;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Split camelCase and PascalCase: `CursedSouls` -> `Cursed Souls`. */
function splitCamel(text) {
  return String(text)
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2');
}

/** Split letter/digit boundaries: `2048Game` -> `2048 Game`. */
function splitDigits(text) {
  return String(text).replace(/(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/gu, ' ');
}

/** `owner/name` (or a bare URL) -> its two parts. */
function splitRepo(repo) {
  const raw = squash(repo)
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts.pop() || '';
  const owner = parts.pop() || '';
  return { owner, name };
}

/** Strip repository furniture such as `-github-io`, `-web` and `-master`. */
function stripSiteNoise(name) {
  let s = String(name ?? '');
  for (let pass = 0; pass < 3; pass += 1) {
    const before = s;
    for (const pattern of SITE_SUFFIX) s = s.replace(pattern, '');
    s = s.replace(/^[-_.\s]+/, '').replace(/[-_.\s]+$/, '');
    if (s === before) break;
  }
  return s;
}

/**
 * Split a lowercase run-together word into the fewest known game words.
 * Returns `null` unless the whole word can be covered by at least two.
 */
function splitRunTogether(word) {
  const lower = word.toLowerCase();
  if (lower.length < 6 || TITLE_WORDS.has(lower)) return null;

  const memo = new Map();
  const solve = (start) => {
    if (start === lower.length) return [];
    if (memo.has(start)) return memo.get(start);
    let best = null;
    const most = Math.min(12, lower.length - start);
    for (let len = most; len >= 2; len -= 1) {
      const piece = lower.slice(start, start + len);
      if (!TITLE_WORDS.has(piece)) continue;
      // A two-letter piece is only a word at the edge of a name, or when it
      // is a joiner such as `to`; in the middle it is almost always a
      // coincidence such as the `go` in `mangoes`.
      const edge = start === 0 || start + len === lower.length;
      if (len === 2 && !edge && !TITLE_CONNECTORS.has(piece)) continue;
      const rest = solve(start + len);
      if (!rest) continue;
      const candidate = [piece, ...rest];
      if (!best || candidate.length < best.length) best = candidate;
    }
    memo.set(start, best);
    return best;
  };

  const parts = solve(0);
  return parts && parts.length >= 2 ? parts : null;
}

/**
 * Every word a repository name contributes, in order.
 *
 * CamelCase and PascalCase are split first, then letter/digit boundaries,
 * then run-together lowercase names are broken against `TITLE_WORDS`, and
 * finally technology words and host names are dropped.
 */
function wordsFromName(raw) {
  const out = [];
  for (const chunk of String(raw).split(/[^\p{L}\p{N}]+/u)) {
    if (!chunk || TITLE_NOISE.has(chunk.toLowerCase())) continue;
    for (const piece of splitCamel(chunk).split(' ')) {
      if (!piece) continue;
      for (const bit of splitDigits(piece).split(' ')) {
        if (!bit || TITLE_NOISE.has(bit.toLowerCase())) continue;
        const parts = /^\p{L}+$/u.test(bit) ? splitRunTogether(bit) : null;
        if (parts) out.push(...parts);
        else out.push(bit);
      }
    }
  }

  // `Snake3D` splits into `Snake 3 D`; the pair is one word again.
  const merged = [];
  for (let i = 0; i < out.length; i += 1) {
    const next = out[i + 1];
    const joined = next ? `${out[i]}${next}`.toLowerCase() : '';
    if (/^\d+$/.test(out[i]) && next && next.length === 1 && TITLE_ACRONYMS.has(joined)) {
      merged.push(`${out[i]}${next}`);
      i += 1;
    } else {
      merged.push(out[i]);
    }
  }
  return merged;
}

/** Lowercase words of an owner name, without the dictionary or noise rules. */
function ownerWords(owner) {
  return splitCamel(owner)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** Drop the author's own name from the front of a repository name. */
function stripOwner(words, owner) {
  const owned = ownerWords(owner);
  if (!owned.length || words.length <= owned.length) return words;
  const lower = words.map((word) => word.toLowerCase());
  if (owned.every((word, i) => lower[i] === word)) return words.slice(owned.length);
  // `bocaletto-luca/...` and a `luca-monopoly` name: the surname is enough.
  if (owned.length >= 2 && lower[0] === owned[owned.length - 1] && words.length > 1) {
    return words.slice(1);
  }
  return words;
}

/* ------------------------------------------------------------------ title */

/**
 * Turn a repository slug into a human title.
 *
 * `Bozar/cursedSouls` becomes `Cursed Souls`; `Ideosorter/ideosorter.github.io`
 * becomes `Ideosorter`; `stefanweck/dungeongeneration` becomes
 * `Dungeon Generation`. The six rules below run in order so the same slug
 * always produces the same title.
 *
 * @param {string} repo  Repository name, optionally `owner/name`.
 * @param {string} [description] Used only when the repository is empty.
 * @returns {string} A short human title.
 */
export function cleanTitle(repo, description) {
  const { owner, name } = splitRepo(repo);
  // A repository that is only a Pages host (`foo.github.io`) names no game at
  // all once the host is gone, so the description is the only clue left.
  const raw =
    stripSiteNoise(name) || squash(description).split(/\s+/).slice(0, 4).join(' ');

  // Rules 1-4 happen word by word inside `wordsFromName`: camelCase and
  // PascalCase are split before anything is discarded (`CursedSouls` ->
  // `Cursed Souls`), letter/digit boundaries are split (`2048Game` ->
  // `2048 Game`), technology and host words are dropped, and a run-together
  // lowercase name is broken against the small game vocabulary
  // (`dungeongeneration` -> `dungeon generation`).
  let words = wordsFromName(raw);

  // Rule 3, continued: the author is not part of the game's name
  // (`bocaletto-luca/...`), and a trailing `game`/`clone` adds nothing - except
  // after a number, where `2048 Game` is the name itself.
  words = stripOwner(words, owner);
  while (
    words.length > 1 &&
    TITLE_TAIL.test(words[words.length - 1]) &&
    !/^\d+$/.test(words[words.length - 2])
  ) {
    words.pop();
  }
  words = words.filter((word, i) => i === 0 || word.toLowerCase() !== words[i - 1].toLowerCase());
  while (words.length > 1 && TITLE_MINOR.has(words[words.length - 1].toLowerCase())) words.pop();

  if (!words.length) words = ['Arcade', 'Classic'];

  // Rule 6: the title never ends in a host suffix, so `weatherio` becomes
  // `Weather` while real words such as `radio` survive.
  const last = words[words.length - 1].toLowerCase();
  if (/^[a-z]{4,}io$/.test(last) && !TITLE_KEEP_SUFFIX.has(last)) {
    words[words.length - 1] = words[words.length - 1].slice(0, -2);
  } else if (/^[a-z]{5,}com$/.test(last) && !TITLE_KEEP_SUFFIX.has(last)) {
    words[words.length - 1] = words[words.length - 1].slice(0, -3);
  }

  // Rule 6: keep it inside six words. A name that splits into a single
  // unknown word (`Bytle`, `Daddelkiste`) stays whole rather than being
  // padded with an invented second word.
  if (words.length > 6) words = words.slice(0, 6);

  // Rule 5: acronyms stay upper-case, everything else is Title Cased, with
  // British spelling where a word has two forms.
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
  s = s.replace(new RegExp(String.raw`\s*play\b[^.!?]*?\bon ${SITE_NAME}\b[^.!?]*[.!?]?`, 'gi'), ' ');
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
 * "A game built with canvas" and "built with React" describe the build, not
 * the play, so they never become catalogue copy.
 */
const GENERIC_BUILD =
  /^(?:(?:a|an|the)?\s*(?:game|project|demo|app|tool|toy|thing)\s+)?(?:built|made|created|written|coded|developed|implemented|powered)\s+(?:with|in|using|by)\b/i;

/** Our own family sentences, so recycled copy is never treated as repo copy. */
const OWN_TEMPLATES = new Set(FAMILIES.map((family) => squash(family.description(''))));

/**
 * The repository's own description, but only when a player could read it.
 *
 * Shorter than 40 characters is a fragment ("A snake game."), developer
 * language and "built with X" sentences are about the code, and one of our
 * own templates is copy a previous run already wrote. All four send the
 * caller to the family template instead.
 *
 * @param {string} description  Raw repository description.
 * @returns {string} A usable sentence, or `''`.
 */
function usableRepoDescription(description) {
  const derived = deriveSentence(description);
  if (!derived) return '';
  if (derived.length < 40) return '';
  if (DEV_JARGON.test(derived)) return '';
  if (GENERIC_BUILD.test(derived)) return '';
  if (/\b(?:built|made|written|coded|developed|implemented)\s+(?:with|in|using|by)\s*\.?$/i.test(derived)) {
    return '';
  }
  if (OWN_TEMPLATES.has(squash(derived))) return '';
  return derived;
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
  const derived = usableRepoDescription(description);
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
 * Genre words the catalogue carries that `FAMILIES[].match` does not cover.
 *
 * Those patterns stay as they are: `copyFor()` publishes the English copy with
 * them, so widening them would rewrite the English pages on the next harvest.
 * This table is for `familyFor()`'s second job - choosing the genre template a
 * localised page shows - where the caller hands over the whole catalogue
 * record and there is nothing to regenerate.
 *
 * Every entry is a word a game's own author put in the name, the keywords or
 * the repository, not a guess about the genre: that is the difference between
 * reading a signal and inventing one.
 */
const GENRE_WORDS = {
  snake: /serpent|\bnibbles?\b|\bworms?\b|\bwormgame\b|\bsnakey\b/,
  tetris: /tetromino|falling ?blocks?|line ?clear|block ?rain/,
  pong: /ping ?pong|bat and ball/,
  pacman: /dot muncher|gobble/,
  breakout: /brick ?breaker|brick ?break\b|breakout|arkanoid|brickles/,
  invaders: /space ?shooter|star ?fighter|\bshmup\b|galaga|space invaders/,
  racing: /speedway|pit ?stop|\btrack ?racing\b/,
  platformer: /doodle ?jump|endless (?:[a-z]+ )?run\b|side ?scroll|\bjumper\b|crossy road|\bhopper\b|jump and run|\bdino\b/,
  flappy: /one ?button|helicopter/,
  maze: /labyrinth|\bamaze\b|\bmazes?\b/,
  match3: /match[- ]?(?:3|three)|bejewel|candy crush|\bjewels?\b|\bgems?\b/,
  2048: /\b2048\b|\bthrees\b|number merge|merge tiles/,
  sliding: /sliding puzzle|slide puzzle|fifteen puzzle|15 puzzle|picture puzzle|tile puzzle/,
  sokoban: /sokoban|box ?push|crate ?push/,
  memory: /simon says|matching pairs|\bpairs\b|concentration/,
  sudoku: /sudoku|number place/,
  solitaire: /solitaire|klondike|freecell|\bpatience\b/,
  mahjong: /mah ?jong/,
  hangman: /hang ?man/,
  wordsearch: /word ?search|word ?find/,
  wordle: /wordle|word guess|guess the word/,
  quiz: /\bquiz|trivia|questions? and answers?/,
  typing: /typing|type ?test|type ?racer|keysprint|keyboard hero/,
  towerdefense: /tower ?defen[cs]e|\btd\b|defend the (?:base|tower|path)|plants vs\.? zombies/,
  roguelike: /rogue[- ]?like|\bdungeon\b|procgen|permadeath/,
  shooter: /\bshoot(?:er|ing)?\b|bullet ?hell|space ?war|\bgun\b|\bturret\b|\bfps\b|river raid/,
  idle: /\bidle\b|clicker|incremental|tycoon|\bfactory\b|\bminer\b|farming/,
  board: /board ?game|\bchess\b|checkers|draughts|reversi|othello|backgammon|\bludo\b|domino|poker|blackjack|connect ?4|four in a row|tic tac toe|noughts and crosses|gomoku|gobang|quoridor|monopoly|scopa|mah ?jong/,
};

/**
 * Phrases that outrank a family word they happen to contain.
 *
 * "Snake and Ladder" is a board game, not a snake game, and no amount of
 * matching `snake` makes the serpent template right for it.
 */
const EXCEPTIONS = [[/snakes? (?:and|&) ladders?/, 'board']];

/**
 * The order a claim is believed when two families both match the same field.
 *
 * Distinctive names come first: a game that says "quiz" or "sudoku" or
 * "tetris" in its own title is that game, and a description that also says
 * "shoot" does not make it a shooter. Broad, easily-borrowed words (racing,
 * platform, shooter, idle) come last so they cannot outvote a specific claim.
 */
const FAMILY_ORDER = [
  'tetris',
  '2048',
  'sudoku',
  'mahjong',
  'solitaire',
  'hangman',
  'wordsearch',
  'wordle',
  'quiz',
  'typing',
  'sokoban',
  'snake',
  'pong',
  'pacman',
  'breakout',
  'towerdefense',
  'invaders',
  'match3',
  'memory',
  'maze',
  'sliding',
  'board',
  'roguelike',
  'racing',
  'platformer',
  'flappy',
  'shooter',
  'idle',
];

/** One matcher per family: the harvest pattern plus the words above. */
const MATCHERS = (() => {
  const byId = new Map(FAMILIES.map((family) => [family.id, family]));
  const ordered = [
    ...FAMILY_ORDER.filter((id) => byId.has(id)),
    ...FAMILIES.map((family) => family.id).filter((id) => id !== 'generic' && !FAMILY_ORDER.includes(id)),
  ];
  return ordered.map((id) => {
    const base = byId.get(id).match.source;
    const extra = GENRE_WORDS[id]?.source;
    return { id, match: new RegExp(extra ? `${base}|${extra}` : base) };
  });
})();

/**
 * The family whose own description template the text repeats.
 *
 * `copyFor()` writes a family's template into a catalogue description when the
 * repository's own words were unusable, so a record whose description *is* the
 * shooter template was classified as a shooter when it was harvested. Reading
 * it back is not circular rounding: it recovers the classification the English
 * page already ships, so the French page can agree with it instead of falling
 * back to the generic paragraph. A record that carries the *generic* template
 * says nothing and is skipped.
 */
const TEMPLATES = FAMILIES.filter((family) => family.id !== 'generic').map((family) => ({
  id: family.id,
  text: normalise(family.description('')).split(/(?<=[.!?]) /)[0],
}));

/** The family whose template sentence the prose opens with, if any. */
function templateFamily(prose) {
  if (!prose) return '';
  for (const { id, text } of TEMPLATES) {
    if (text && prose.startsWith(text)) return id;
  }
  return '';
}

/** The first family in belief order whose matcher fires on one haystack. */
function matchFamily(haystack) {
  if (!haystack) return '';
  for (const [pattern, id] of EXCEPTIONS) {
    if (pattern.test(haystack)) return id;
  }
  for (const { id, match } of MATCHERS) {
    if (match.test(haystack)) return id;
  }
  return '';
}

/**
 * The genre a category implies when the record itself named nothing.
 *
 * `arcade` and `classics` carry no genre at all - that is 292 of the 464 games
 * - so they stay generic rather than guess.
 *
 * The other five name a *kind* of game without naming a *genre*: a puzzle can
 * be a sliding puzzle, a jigsaw, a Tower of Hanoi or a maths teaser, a word
 * game can be a word search or a crossword, a brain game can be memory or
 * logic. Letting the category alone pick `sliding` for those pages told
 * Lights Out to slide a tile into an empty space and Tangram to rebuild a
 * picture, so each of these mappings carries the vocabulary that makes it true
 * and abstains without it.
 */
const CATEGORY_DEFAULT = {
  puzzle: { family: 'sliding', evidence: /tile|slide|image|picture|jigsaw|\b1[0-9]\b|fifteen|shift|swap/ },
  word: { family: 'wordsearch', evidence: /word ?search|word ?find|hidden word|grid of letters|hide the words/ },
  brain: { family: 'memory', evidence: /memor|pairs?\b|sequence|simon/ },
  strategy: { family: 'towerdefense', evidence: /tower|\btd\b|wave|creep|base|defen[cs]e/ },
  racing: { family: 'racing' },
  table: { family: 'board' },
};

/**
 * Words that make a default a lie even when its evidence word is there: a
 * Water Sort clone is not a sliding puzzle however many tiles it shows, and a
 * Monopoly board is not a tower defence.
 */
const DEFAULT_VETO = {
  sliding: /crossword|nonogram|picross|jigsaw|hanoi|\bsort\b|bubble|hidden object|spot the difference|minesweeper|word/,
  wordsearch: /crossword|anagram|boggle|scrabble|spelling/,
  board: /mah ?jong|minesweeper/,
  memory: /minesweeper|sort|sudoku/,
  towerdefense: /trust|evolution|simulat|monopoly|chess|quoridor|board game|poker|card/,
  racing: /parking|driving school/,
};

/**
 * Pick the family a record belongs to, reading everything the catalogue says.
 *
 * The one-string form is the original contract (`familyFor(`${title}
 * ${description}`)`) and still works: a lone string is believed as the game's
 * own name. Callers that hold the whole record pass the fields it carries as a
 * second argument, and each is read in the order it can be trusted:
 *
 *   1. the name - title, id and repository slug. An author names their game
 *      after what it is, so a genre word here is the strongest thing a record
 *      says, and `Kavun Flabbybox` still says `flabby`.
 *   2. the record's own description, when it is one of our templates: that is
 *      the family it was harvested as.
 *   3. the free prose (description, tagline) - developer text, but often the
 *      only sentence that says what the thing is.
 *   4. the keyword list, where the harvest writes `online <genre> game`. It
 *      ranks below the prose because it was generated from the harvest's
 *      classification, and a generated keyword must not outvote the words the
 *      game's author wrote: `Courier City` says it is a GTA-style open world,
 *      so a stray `one-button` keyword does not make it a flappy game. Where
 *      the description was unusable and only our template is left, the
 *      keyword list is the last place that classification survived.
 *   5. the category, where the category implies a genre and the record says
 *      nothing that contradicts it.
 *
 * Where nothing fires the answer is `'generic'`: a paragraph that is true of
 * every browser game beats a genre the record never claimed.
 *
 * @param {string} text  Usually `${title} ${description}`.
 * @param {{title?: string, id?: string, description?: string, tagline?: string,
 *   keywords?: string[]|string, category?: string, repo?: string}} [record]
 *   The rest of the catalogue entry, when the caller has it.
 * @returns {string} A family id from FAMILIES, or `'generic'`.
 */
export function familyFor(text, record = {}) {
  const extra = record && typeof record === 'object' ? record : {};
  const str = (value) => (typeof value === 'string' ? value : '');
  const keywords = Array.isArray(extra.keywords)
    ? extra.keywords.filter((word) => typeof word === 'string').join(' ')
    : str(extra.keywords);

  const prose = normalise([str(text), str(extra.description), str(extra.tagline)].filter(Boolean).join(' '));
  const name = normalise([str(extra.title), str(extra.id), str(extra.repo)].filter(Boolean).join(' '));
  const words = normalise(keywords);
  // A lone string is the legacy call: it is a name, not prose, because the
  // callers that pass one are passing a title.
  const lone = !name && !words;
  const template = templateFamily(prose);

  return (
    matchFamily(lone ? prose : name) ||
    template ||
    (lone ? '' : matchFamily(prose)) ||
    (!prose || template ? matchFamily(words) : '') ||
    categoryHint(str(extra.category), `${name} ${words} ${prose}`) ||
    'generic'
  );
}

/** The category's genre, when the record supports it and does not contradict it. */
function categoryHint(category, evidence) {
  const entry = CATEGORY_DEFAULT[normalise(category)];
  if (!entry) return '';
  const veto = DEFAULT_VETO[entry.family];
  if (veto && veto.test(evidence)) return '';
  if (entry.evidence && !entry.evidence.test(evidence)) return '';
  return entry.family;
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
 * A title that is only the repository slug (`Dungeongeneration`,
 * `Ideosorter Github Io`) has not been written yet, so it is rebuilt too.
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
  if (usable) {
    const slug = splitRepo(repo).name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const same = squash(given).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (slug && same === slug) {
      const rebuilt = cleanTitle(repo, description);
      if (rebuilt) return rebuilt;
    }
    return given.replace(/[\s,;:.\-]+$/, '');
  }
  return cleanTitle(repo || given, description);
}

/* ------------------------------------------------------------------- copy */

/**
 * Assemble a description inside the 60-200 character window.
 *
 * A sentence that already fits is left alone: the family templates are
 * written to that length, and a repo description that survives at that
 * length does not need marketing bolted on. Only a short survivor gets a
 * closing clause, so the card still reads as a complete paragraph.
 */
function composeDescription(base, familyId) {
  const MAX = 200;
  let body = squash(base);
  if (body.length > MAX) body = shorten(body, MAX);
  if (body.length >= 60) return body;
  const suffix = SUFFIX[familyId] || SUFFIX.generic;
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
 * @returns {{title: string, tagline: string, description: string,
 *   howToPlay: string[], faq: Array<{q: string, a: string}>,
 *   keywords: string[]}}
 */
export function copyFor({ title, repo, description, family } = {}) {
  const safeTitle = resolveTitle(title, repo, description);
  const entry = resolveFamily(family, safeTitle, description);

  const tagline = shorten(entry.tagline(safeTitle), 70);
  // The repository's own words when they are usable, the family's template
  // when they are not: a snake game and a card game must not share a sentence.
  const base = usableRepoDescription(description) || FALLBACK[entry.id] || FALLBACK.generic;
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

  return { title: safeTitle, tagline, description: descriptionText, howToPlay, faq, keywords };
}
