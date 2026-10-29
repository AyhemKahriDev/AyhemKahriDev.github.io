/**
 * Contract tests for the deterministic catalogue copy synthesiser.
 *
 * These are written before the implementation on purpose: they describe what
 * a player-facing page needs (three controls, two questions, five keywords,
 * no developer language anywhere) and the category mapping the build reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    'HTML5 Tetris Game for jQuery Play Tetris instantly on arcadefork - no download, no sign-up, works on any device.',
  );
  assert.ok(/block|tetris/i.test(recycled), recycled);
  assert.ok(!/instantly on arcadefork|no download|jquery/i.test(recycled), recycled);

  const shortcode = cleanDescription(
    ':space_invader: The original TETRIS game simulator Play Tetris instantly on arcadefork.',
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
