/**
 * How much of the catalogue does a genre template actually claim?
 *
 * The localised pages take their tagline, description, how-to steps and FAQ
 * from `families.<id>` in content/i18n/{fr,ar}.json, resolved per game by
 * familyFor() in scripts/i18n.mjs. A game that resolves to no family renders
 * `families.generic`, so every such page shares one paragraph with every other
 * unclaimed page.
 *
 * Measured over the merged catalogue (content/games.json + engine-new +
 * curated + harvest-published + games.generated, overlays applied):
 *
 *   2026-10-29, classifier reading title + description only:  341 / 464 = 73.5%
 *   2026-10-29, classifier reading title, id, repository, keywords, description
 *               and category:                                 119 / 464 = 25.6%
 *
 * The threshold is the achieved number plus a small margin, not a wish. It is
 * raised or lowered only with a measurement, and the comment says when it was
 * taken.
 *
 * Why it is 25.6% and not lower: 81 of the remaining 119 are `arcade` records
 * whose title is a repository name (`Kavun Flabbybox`, `Pyxio`, `Notbot`), whose
 * description is the neutral generic template and whose keywords are generated
 * from that same title - there is no genre in the record to read. The other 38
 * are genres this catalogue has no template for (Minesweeper, Tangram,
 * Mastermind, 24 Points, Tower of Hanoi, pinball, slot machines). Forcing those
 * onto a family is how you ship a page that tells a quiz player to shoot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, familyFor, loadCatalog } from '../scripts/i18n.mjs';
import { familyFor as classify } from '../scripts/harvest/copy.mjs';
import { GAMES } from '../scripts/build-site.mjs';

const catalogs = Object.fromEntries(LOCALES.map((l) => [l.id, loadCatalog(l.id)]));

// A family entry is `{tagline, description, howToPlay, faq}`: it does not carry
// its own key, so resolve the returned object back to the id it came from.
const familyIds = new Map(Object.entries(catalogs.fr.families).map(([id, value]) => [value, id]));

/** The family id a game resolves to, `generic` meaning "no genre claims it". */
const familyOf = (game) => familyIds.get(familyFor(catalogs.fr, game)) ?? 'generic';

/** Every game, once, in catalogue order. */
const rows = GAMES.map((game) => ({ game, family: familyOf(game) }));

function distribution(rows) {
  const counts = new Map();
  for (const { family } of rows) counts.set(family, (counts.get(family) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const table = (rows) => {
  const counts = distribution(rows);
  const total = rows.length;
  return counts
    .map(([id, n]) => `${id.padEnd(14)} ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(1)}%`)
    .join('\n');
};

test('every game resolves to a family the locale actually carries', () => {
  const known = new Set(Object.keys(catalogs.fr.families));
  known.add('generic');
  for (const { game, family } of rows) {
    assert.ok(known.has(family), `${game.id} resolved to unknown family ${family}`);
  }
});

test('generic stays under 27% of the catalogue', () => {
  const generic = rows.filter((r) => r.family === 'generic').length;
  const pct = (generic / rows.length) * 100;
  console.log(`\nfamilies over ${rows.length} games:\n${table(rows)}\ngeneric: ${generic}/${rows.length} = ${pct.toFixed(1)}%`);
  // 2026-10-29: 119/464 = 25.6%. Before the classifier read anything but the
  // title and description: 341/464 = 73.5%.
  assert.ok(pct < 27, `generic is ${pct.toFixed(1)}% (${generic}/${rows.length}), want under 27%`);
});

test('no family swallows half the catalogue', () => {
  const top = distribution(rows)[0];
  assert.ok(
    top[1] / rows.length < 0.5,
    `${top[0]} claims ${top[1]} of ${rows.length} games - the classifier has collapsed`,
  );
});

/* ------------------------------------------------------- no lying claims */

/**
 * The rule the widening must not break: a specific game keeps its own genre,
 * and a game the record says nothing about stays generic rather than being
 * handed a template that describes a different game.
 *
 * Each case is a record the catalogue really carries (`id` is looked up in the
 * merged catalogue where it exists), so this is a regression net over the
 * measured data, not a synthetic one.
 */
const MUST_CLAIM = [
  // title only: what the author called it
  { title: 'Neon Snake Deluxe', family: 'snake' },
  { title: 'Tetris', family: 'tetris' },
  { title: 'Space Invaders', family: 'invaders' },
  { title: 'Wordle Craft', family: 'wordle' },
  { title: '2048', family: '2048' },
  { title: 'Brick Breaker Deluxe', family: 'breakout' },
  // keyword list: `online <genre> game` survives a repository-name title
  { title: 'Kavun Flabbybox', keywords: ['kavun game', 'online tower defence game'], family: 'towerdefense' },
  // repository path
  { title: 'Blockrain', repo: 'https://github.com/Aerolab/blockrain.js', family: 'tetris' },
  // category, where the category really does name the game
  { title: 'Mystery Puzzle Box', category: 'table', family: 'board' },
];

for (const { family, ...record } of MUST_CLAIM) {
  test(`classifies ${record.title} as ${family}`, () => {
    assert.equal(classify('', record), family);
  });
}

const MUST_ABSTAIN = [
  // A specific word in the title beats a broad one in the description.
  { title: 'Music Quiz', description: 'A quiz where you shoot the right answer.', family: 'quiz' },
  { title: 'Daily Solitaire', description: 'Jump and run through the cards.', family: 'solitaire' },
  { title: 'Sudoku', description: 'Slide the tiles into the empty space.', family: 'sudoku' },
  // A category is not a genre: these are real records from the catalogue and
  // none of them is the family the category alone would have picked.
  { id: 'lights-out', title: 'Lights Out', category: 'puzzle', family: 'generic' },
  { title: 'Tangram', category: 'puzzle', family: 'generic' },
  { title: 'Mastermind 3D', category: 'puzzle', family: 'generic' },
  { title: '24 Points', category: 'puzzle', family: 'generic' },
  { id: 'minesweeper', title: 'Minesweeper', category: 'brain', family: 'generic' },
  { id: 'jquery-html5-crossword', title: 'Crossword', category: 'word', family: 'generic' },
  { id: 'trust', title: 'The Evolution of Trust', category: 'strategy', family: 'generic' },
];
for (const { family, ...record } of MUST_ABSTAIN) {
  test(`does not force ${record.title} onto a genre`, () => {
    assert.equal(classify('', record), family);
  });
}

test('a generated keyword never outvotes the words the author wrote', () => {
  // `Courier City` says it is a GTA-style open world in its own description and
  // carries a leftover `one-button` keyword from the harvest: the prose wins.
  const record = {
    title: 'Courier City',
    description: 'GTA-inspired 3D open world browser game.',
    keywords: ['courier city game', 'online one-button game'],
    category: 'arcade',
  };
  assert.equal(classify('', record), 'generic');
});

test('the one-string signature still works for the harvest and the overlays', () => {
  // scripts/harvest/copy.mjs, scripts/seed-overlays.mjs and the i18n wrapper all
  // call familyFor with a single string and must keep doing so.
  assert.equal(classify('Neon Snake Deluxe'), 'snake');
  assert.equal(classify('Tetris'), 'tetris');
  assert.equal(classify('a totally unspecified thing'), 'generic');
  assert.equal(classify(''), 'generic');
  assert.equal(classify(undefined), 'generic');
});

test('a family the locale does not carry is null, not another genre', () => {
  // A catalog with one template cannot answer for the rest: the page falls back
  // to generic through gameCopy instead of borrowing a neighbour's paragraph.
  const thin = { families: { snake: catalogs.fr.families.snake } };
  assert.ok(familyFor(thin, { id: 'snake', title: 'Snake', category: 'arcade' }));
  assert.equal(familyFor(thin, { id: 'sudoku', title: 'Daily Sudoku', category: 'puzzle' }), null);
});
