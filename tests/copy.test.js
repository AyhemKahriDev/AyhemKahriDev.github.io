/**
 * Contract tests for the deterministic catalogue copy synthesiser.
 *
 * These are written before the implementation on purpose: they describe what
 * a player-facing page needs (three controls, two questions, five keywords,
 * no developer language anywhere) and the category mapping the build reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEV_JARGON,
  FAMILIES,
  familyFor,
  cleanTitle,
  cleanDescription,
  copyFor,
} from '../scripts/harvest/copy.mjs';
import { CATEGORY_BY_FAMILY, categoryFor } from '../scripts/harvest/category.mjs';

const FAMILY_IDS = [
  'snake',
  'tetris',
  'breakout',
  'pong',
  'invaders',
  'racing',
  'platformer',
  'flappy',
  'maze',
  'match3',
  '2048',
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

const CATEGORIES = [
  'word',
  'puzzle',
  'arcade',
  'brain',
  'strategy',
  'sandbox',
  'classics',
  'racing',
  'table',
];

const SAMPLE = {
  title: 'Neon Snake Deluxe',
  repo: 'pixelforge/neon-snake-deluxe',
  description:
    'A fast snake game built with canvas where you eat glowing pellets, grow longer and dodge your own tail.',
  family: 'snake',
};

/** Every player-visible string in one blob, so one assertion covers the page. */
function textOf(out) {
  return [
    out.tagline,
    out.description,
    ...out.howToPlay,
    ...out.faq.flatMap((f) => [f.q, f.a]),
    ...out.keywords,
  ].join(' | ');
}

test('every family is declared once, with the required shape', () => {
  assert.ok(Array.isArray(FAMILIES));
  const ids = FAMILIES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'family ids must be unique');
  for (const id of FAMILY_IDS) assert.ok(ids.includes(id), `missing family ${id}`);
  for (const f of FAMILIES) {
    assert.equal(typeof f.id, 'string');
    assert.ok(f.match instanceof RegExp, `${f.id} needs a RegExp match`);
    assert.equal(typeof f.tagline, 'function', `${f.id} needs a tagline function`);
    assert.equal(f.controls.length, 3, `${f.id} needs exactly 3 controls`);
    assert.ok(CATEGORIES.includes(f.category), `${f.id} has category ${f.category}`);
  }
});

test('taglines and controls are player-facing, short and jargon free', () => {
  for (const f of FAMILIES) {
    const tagline = f.tagline('Test Game');
    assert.ok(tagline.length > 0, `${f.id} tagline is empty`);
    assert.ok(tagline.length <= 70, `${f.id} tagline is ${tagline.length} chars`);
    assert.ok(!DEV_JARGON.test(tagline), `${f.id} tagline leaks jargon: ${tagline}`);
    assert.ok(!tagline.includes('!'), `${f.id} tagline shouts`);

    for (const line of f.controls) {
      assert.ok(line.length >= 20, `${f.id} control is too short: ${line}`);
      assert.ok(!DEV_JARGON.test(line), `${f.id} control leaks jargon: ${line}`);
      assert.ok(!line.includes('!'), `${f.id} control shouts: ${line}`);
      assert.ok(
        !/\b(gamepad|joystick|multiplayer|mouse only|keyboard only)\b/i.test(line),
        `${f.id} claims a control we do not provide: ${line}`,
      );
    }

    const blob = f.controls.join(' ');
    assert.ok(
      /\barrows?\b|\bswipe\b|\bpad\b|\bspace\b/i.test(blob),
      `${f.id} never mentions a control the play page actually injects`,
    );
  }
});

test('familyFor reads the normalised title and description', () => {
  assert.equal(familyFor('Neon Snake Deluxe'), 'snake');
  assert.equal(familyFor('Tetris'), 'tetris');
  assert.equal(familyFor('Space Invaders'), 'invaders');
  assert.equal(familyFor('Wordle Craft'), 'wordle');
  assert.equal(familyFor('2048'), '2048');
  assert.equal(familyFor('Brick Breaker Deluxe'), 'breakout');
  assert.equal(familyFor('a totally unspecified thing'), 'generic');
  assert.equal(familyFor(''), 'generic');
});

test('cleanTitle strips owner prefixes and developer words', () => {
  assert.equal(cleanTitle('luleoa12/wordle-craft', 'A wordle clone'), 'Wordle Craft');
  assert.equal(cleanTitle('bocaletto-luca/arkanoid'), 'Arkanoid');

  const stripped = cleanTitle('someone/html5-snake-game-js', '');
  assert.equal(stripped, 'Snake');
  assert.ok(!/[A-Z]{2,}/.test(stripped), 'title must not be all caps');
  assert.ok(!/[.,;:!?]$/.test(stripped), 'title must not end in punctuation');
  assert.ok(stripped.split(' ').length <= 6, 'title must stay short');
});

test('cleanDescription strips markdown, links, URLs and emoji', () => {
  const raw =
    '🎮 A [neon](https://example.com/neon) arcade game built with canvas https://example.com — glowing bricks ✨ everywhere.';
  const out = cleanDescription(raw);

  assert.ok(out.length > 0);
  assert.ok(/neon/i.test(out), `link text should survive: ${out}`);
  assert.ok(!/https?:\/\//i.test(out), `URL survived: ${out}`);
  assert.ok(!/[\[\]()]/.test(out), `markdown punctuation survived: ${out}`);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/u.test(out), `emoji survived: ${out}`);
  assert.ok(!DEV_JARGON.test(out), `jargon survived: ${out}`);
  assert.ok(/\.$/.test(out), 'should end as a sentence');

  assert.ok(cleanDescription('').length > 0, 'empty input needs a fallback');
  assert.ok(cleanDescription('npm install && npm run build').length > 0);
  assert.ok(!DEV_JARGON.test(cleanDescription('npm install && npm run build')));

  // Regression: the old generator's boilerplate and emoji shortcodes must not
  // survive a round trip, or 500 pages inherit the same developer sentence.
  const recycled = cleanDescription(
    'HTML5 Tetris Game for jQuery Play Tetris instantly on spielkunst - no download, no sign-up, works on any device.',
  );
  assert.ok(/block|tetris/i.test(recycled), recycled);
  assert.ok(!/instantly on spielkunst|no download|jquery/i.test(recycled), recycled);

  const shortcode = cleanDescription(
    ':space_invader: The original TETRIS game simulator Play Tetris instantly on spielkunst.',
  );
  assert.ok(/block|tetris/i.test(shortcode), shortcode);
  assert.ok(!/space_invader|:/i.test(shortcode), shortcode);

  // File sizes and foreign-language descriptions are not player copy.
  assert.ok(!/13\s*kb/i.test(cleanDescription('A roguelike platformer in 13KB of JavaScript')));
  assert.ok(/game/i.test(cleanDescription('O jogo da cobrinha feita em JS')));

  // British spelling, even when the source used US spelling.
  const british = cleanDescription(
    'A colorful arcade game with a gray center line and a favorite cat.',
  );
  assert.match(british, /colourful/i);
  assert.match(british, /grey/i);
  assert.match(british, /centre/i);
  assert.match(british, /favourite/i);
});

test('copyFor returns a complete, jargon-free page for every family', () => {
  for (const { id } of FAMILIES) {
    const out = copyFor({
      title: 'Test Game',
      repo: 'owner/test-game',
      description: '',
      family: id,
    });

    assert.equal(out.howToPlay.length, 3, `${id} howToPlay`);
    assert.equal(out.faq.length, 2, `${id} faq`);
    assert.equal(out.keywords.length, 5, `${id} keywords`);
    assert.ok(out.tagline.length > 0 && out.tagline.length <= 70, `${id} tagline length`);
    assert.ok(
      out.description.length >= 60 && out.description.length <= 200,
      `${id} description is ${out.description.length} chars`,
    );

    for (const item of out.faq) {
      assert.ok(item.q.length > 0, `${id} has an empty question`);
      assert.ok(item.a.length > 0, `${id} has an empty answer`);
    }
    for (const line of out.howToPlay) assert.equal(typeof line, 'string');
    for (const key of out.keywords) assert.ok(key.length > 0, `${id} has an empty keyword`);

    assert.ok(!DEV_JARGON.test(textOf(out)), `${id} leaks jargon: ${DEV_JARGON.exec(textOf(out))?.[0]}`);
    assert.ok(!/github|repository|installation/i.test(textOf(out)), `${id} mentions a repository`);
  }
});

test('copyFor keeps the harness sample player-facing', () => {
  const out = copyFor(SAMPLE);

  assert.equal(out.howToPlay.length, 3);
  assert.equal(out.faq.length, 2);
  assert.equal(out.keywords.length, 5);
  assert.equal(new Set(out.keywords).size, 5, 'keywords must be unique');
  assert.ok(out.keywords.every((k) => k === k.toLowerCase()), 'keywords are lowercase');
  assert.ok(out.description.length >= 60 && out.description.length <= 200);
  assert.ok(/snake/i.test(out.description), 'description should keep the recognisable subject');
  assert.ok(!DEV_JARGON.test(textOf(out)));
});

test('copyFor honours an explicit family over the title guess', () => {
  const out = copyFor({
    title: 'Neon Snake Deluxe',
    repo: 'owner/neon-snake-deluxe',
    description: '',
    family: 'racing',
  });
  assert.match(out.howToPlay.join(' '), /steer|accelerate|brake/i);
});

test('copyFor is deterministic', () => {
  assert.deepEqual(copyFor(SAMPLE), copyFor(SAMPLE));
  assert.deepEqual(
    copyFor({ title: 'Puzzle', repo: 'x/puzzle', description: 'A puzzle.', family: 'generic' }),
    copyFor({ title: 'Puzzle', repo: 'x/puzzle', description: 'A puzzle.', family: 'generic' }),
  );
});

test('every family maps to a real catalogue category', () => {
  for (const { id } of FAMILIES) {
    assert.ok(id in CATEGORY_BY_FAMILY, `${id} is missing from CATEGORY_BY_FAMILY`);
    assert.ok(CATEGORIES.includes(CATEGORY_BY_FAMILY[id]), `${id} maps to ${CATEGORY_BY_FAMILY[id]}`);
  }
});

test('categoryFor prefers the family, then the words, then arcade', () => {
  for (const { id } of FAMILIES) {
    assert.ok(CATEGORIES.includes(categoryFor(id, 'Anything', 'at all')), `${id} category`);
  }
  assert.equal(categoryFor('racing', 'Snake', 'a puzzle'), 'racing');
  assert.equal(categoryFor('generic', 'Wordle clone', 'guess the hidden word'), 'word');
  assert.equal(categoryFor('generic', 'Sudoku', 'fill the grid'), 'table');
  assert.ok(CATEGORIES.includes(categoryFor('nonsense-family', '', '')));
  assert.equal(categoryFor('nonsense-family', '', ''), 'arcade');
});

test('FAMILIES categories agree with CATEGORY_BY_FAMILY', () => {
  for (const f of FAMILIES) {
    assert.equal(
      CATEGORY_BY_FAMILY[f.id],
      f.category,
      `${f.id} disagrees: ${CATEGORY_BY_FAMILY[f.id]} vs ${f.category}`,
    );
  }
});

/* ------------------------------------------------------------------ titles */

/**
 * The live catalogue, as it was published before this module learned to read
 * repository names: the left-hand side is what a player saw on the games
 * index, the right-hand side is the title the page should carry. All but
 * `tv-show-explorer` (a slug from the current harvest batch) are repositories
 * listed in content/harvest-published.json.
 */
const LIVE_TITLES = [
  ['stefanweck/dungeongeneration', 'Dungeon Generation'],
  ['Bozar/cursedSouls', 'Cursed Souls'],
  ['cxong/DrunkenViking', 'Drunken Viking'],
  ['selenebun/towerdefense', 'Tower Defence'],
  ['Ideosorter/ideosorter.github.io', 'Ideosorter'],
  ['tv-show-explorer', 'TV Show Explorer'],
  ['moar-tech/spacerocks', 'Space Rocks'],
  ['Milchreis/Snake3D', 'Snake 3D'],
  ['Milchreis/tinydefence2', 'Tiny Defence 2'],
  ['dag7dev/JSQuizee', 'Quizee'],
  ['omackenzie/Doodle-Jump-in-JS', 'Doodle Jump'],
  ['i8sumPi/2048-circle', '2048 Circle'],
  ['bburky/blocktoblock', 'Block to Block'],
  ['omar-mazen/weatherio', 'Weather'],
  ['awslabs/the-qubit-factory', 'The Qubit Factory'],
  ['johannruiz/Daytona-USA-Web', 'Daytona USA'],
];

test('cleanTitle splits camelCase and PascalCase into words', () => {
  assert.equal(cleanTitle('Bozar/cursedSouls'), 'Cursed Souls');
  assert.equal(cleanTitle('cxong/DrunkenViking'), 'Drunken Viking');
  assert.equal(cleanTitle('audioslayer/NanoArcade'), 'Nano Arcade');
  assert.equal(cleanTitle('dgatewood/ShapeCrush'), 'Shape Crush');
  assert.equal(cleanTitle('someone/neonSnakeDeluxe'), 'Neon Snake Deluxe');
});

test('cleanTitle splits letter and digit boundaries without breaking acronyms', () => {
  assert.equal(cleanTitle('someone/2048Game'), '2048 Game');
  assert.equal(cleanTitle('Milchreis/Snake3D'), 'Snake 3D');
  assert.equal(cleanTitle('i8sumPi/2048-circle'), '2048 Circle');
});

test('cleanTitle strips pages, host and branch furniture', () => {
  assert.equal(cleanTitle('Ideosorter/ideosorter.github.io'), 'Ideosorter');
  assert.equal(cleanTitle('someone/cursed-souls-github-io'), 'Cursed Souls');
  assert.equal(cleanTitle('someone/cursed-souls-gh-pages'), 'Cursed Souls');
  assert.equal(cleanTitle('iliagrigorevdev/quoridor-web'), 'Quoridor');
  assert.equal(cleanTitle('someone/snake-game-web'), 'Snake');
  assert.equal(cleanTitle('someone/tetris-master'), 'Tetris');
  assert.equal(cleanTitle('someone/tetris-main'), 'Tetris');
  assert.equal(cleanTitle('pixel/neon-snake-deluxe'), 'Neon Snake Deluxe');
});

test('cleanTitle drops the author prefix a repository repeats', () => {
  assert.equal(
    cleanTitle('bocaletto-luca/bocaletto-luca-monopoly-multiplayer'),
    'Monopoly Multiplayer',
  );
  assert.equal(cleanTitle('bocaletto-luca/arkanoid'), 'Arkanoid');
});

test('cleanTitle splits run-together lowercase names against the game vocabulary', () => {
  assert.equal(cleanTitle('stefanweck/dungeongeneration'), 'Dungeon Generation');
  assert.equal(cleanTitle('selenebun/towerdefense'), 'Tower Defence');
  assert.equal(cleanTitle('moar-tech/spacerocks'), 'Space Rocks');
  assert.equal(cleanTitle('bburky/blocktoblock'), 'Block to Block');
  assert.equal(cleanTitle('someone/cursedsouls'), 'Cursed Souls');
  // No two-word split exists, so the name stays whole and only the first
  // letter is upper-cased.
  assert.equal(cleanTitle('James-Livesey/bytle'), 'Bytle');
  assert.equal(cleanTitle('RainerWessOS/Daddelkiste'), 'Daddelkiste');
});

test('cleanTitle keeps acronyms upper-case and uses British spelling', () => {
  assert.equal(cleanTitle('tv-show-explorer'), 'TV Show Explorer');
  assert.equal(cleanTitle('RichLewis007/AI-Pong-game'), 'AI Pong');
  assert.equal(cleanTitle('someone/flappy-birds-ai'), 'Flappy Birds AI');
  assert.equal(cleanTitle('x/snake-hd'), 'Snake HD');
  assert.equal(cleanTitle('x/tower-defence-3d'), 'Tower Defence 3D');
});

test('cleanTitle produces the 16 live titles the index needs', () => {
  for (const [repo, expected] of LIVE_TITLES) {
    assert.equal(cleanTitle(repo), expected, `${repo} should read as "${expected}"`);
  }
});

test('cleanTitle never leaves repository furniture in a title', () => {
  for (const [repo, expected] of LIVE_TITLES) {
    assert.ok(!/\bgithub\b/i.test(expected), `${repo} leaks github`);
    assert.ok(!/\b(?:io|com)$/i.test(expected), `${repo} ends in a host suffix`);
    assert.ok(!/[.,;:!?]$/.test(expected), `${repo} ends in punctuation`);
    assert.ok(expected.split(' ').length <= 6, `${repo} is too long`);
    assert.ok(!/^[a-z]/.test(expected), `${repo} is not capitalised`);
  }
  // Two real words are the target; one-word names have no better split.
  const multiword = LIVE_TITLES.filter(([, title]) => title.includes(' '));
  assert.ok(multiword.length >= 12, 'most of the live catalogue has a two-word title');
});

/* --------------------------------------------------------- descriptions */

test('every family carries its own 60-200 character description template', () => {
  assert.equal(FAMILIES.length, 29);
  const templates = FAMILIES.map((family) => family.description(''));
  assert.equal(new Set(templates).size, templates.length, 'two families share a sentence');

  for (const family of FAMILIES) {
    assert.equal(typeof family.description, 'function', `${family.id} needs a description`);
    const text = family.description('Test Game');
    assert.equal(text, family.description('Test Game'), `${family.id} is not deterministic`);
    assert.ok(text.length >= 60, `${family.id} description is ${text.length} chars`);
    assert.ok(text.length <= 200, `${family.id} description is ${text.length} chars`);
    assert.ok(!text.includes('!'), `${family.id} shouts: ${text}`);
    assert.ok(!DEV_JARGON.test(text), `${family.id} leaks jargon: ${text}`);
    assert.ok(!/\b(?:color|favorite|gray|center|defense|offense)\b/i.test(text), `${family.id} is not British: ${text}`);
    // "States what the player does": a second-person or imperative verb.
    assert.ok(
      /\b(?:steer|drop|move|slide|swap|fill|deal|pair|guess|scan|answer|type|place|take|run|tap|find|hold|keep|turn|walk|read|eat|return|shoot|fight|clear|set)\b/i.test(
        text,
      ),
      `${family.id} never says what the player does: ${text}`,
    );
  }
});

test('cleanDescription falls back to the family sentence, not one shared line', () => {
  assert.equal(cleanDescription(''), FAMILIES.find((f) => f.id === 'generic').description(''));
  const snake = FAMILIES.find((f) => f.id === 'snake').description('');
  const board = FAMILIES.find((f) => f.id === 'board').description('');
  assert.notEqual(snake, board);
  // A repo description that is only a fragment is not card copy.
  assert.equal(cleanDescription('A snake game.'), snake);
});

test('a usable repository description wins over the family template', () => {
  const repoText =
    'A fast snake game where you eat glowing pellets, grow longer and dodge your own tail.';
  const out = copyFor({ title: 'Neon Snake Deluxe', repo: 'pixel/neon-snake-deluxe', description: repoText, family: 'snake' });
  assert.match(out.description, /glowing pellets/);
  assert.ok(out.description.length >= 60 && out.description.length <= 200);

  // Junk descriptions lose to the template: too short, "built with X", dev
  // language, or copy a previous run already generated.
  const template = FAMILIES.find((f) => f.id === 'snake').description('');
  for (const junk of [
    'A snake game.',
    'A snake game built with canvas.',
    'npm install snakepkg and run the dev server',
    template,
  ]) {
    const fallback = copyFor({ title: 'Snake', repo: 'x/snake', description: junk, family: 'snake' });
    assert.equal(fallback.description, template, `"${junk}" should not become card copy`);
  }
});

test('copyFor returns the cleaned title and does not churn', () => {
  const out = copyFor({
    title: 'Dungeongeneration',
    repo: 'stefanweck/dungeongeneration',
    description: '',
    family: 'roguelike',
  });
  assert.equal(out.title, 'Dungeon Generation');
  assert.equal(
    copyFor({ title: 'Dungeongeneration', repo: 'stefanweck/dungeongeneration', description: '', family: 'roguelike' })
      .description,
    out.description,
    'the same record must produce the same copy',
  );
  assert.ok(!/Math\.random/.test(readFileSync(new URL('../scripts/harvest/copy.mjs', import.meta.url), 'utf8')));
});
