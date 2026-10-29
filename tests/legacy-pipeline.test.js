/**
 * The legacy `npm run harvest` phases, after delegation.
 *
 * Two defects lived in scripts/harvest-games.mjs and neither needed a browser
 * to find: validate() opened /third-party/<slug>/index.html whatever the
 * vendor step had recorded, so a game shipping docs/index.html was judged dead
 * and deleted; generate() scraped READMEs, so developer prose ("npm install,
 * then open index.html") shipped as player-facing copy on 57 pages.
 *
 * Everything here is offline: entry resolution reads a temp folder, generate()
 * reads two JSON reports and writes to a temp file. No network, no browser, no
 * real .harvest/ or third-party/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  PUBLISHED_COMMENT,
  generate,
  planValidation,
  resolveEntry,
  safeEntry,
} from '../scripts/harvest-games.mjs';
import { DEV_JARGON } from '../scripts/harvest/copy.mjs';

/* ------------------------------------------------------------ fixtures */

/** A temp directory that is removed whatever the test does. */
function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'arc-legacy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

/** An html page, plus a javascript module so pickEntry sees a real tree. */
const touch = (file) => write(file, '<!doctype html><title>game</title><script src="game.js"></script>');

/**
 * A fake vendored game: the files it ships and the .harvested.json the vendor
 * step leaves behind. Returns the third-party directory for the caller.
 */
function vendoredGame(root, slug, files, meta = {}) {
  for (const file of files) touch(join(root, 'third-party', slug, file));
  write(join(root, 'third-party', slug, '.harvested.json'), { slug, ...meta });
  return join(root, 'third-party');
}

/** A developer README, the kind that used to become page copy. */
const DEV_README = `# Tetris

![build](https://img.shields.io/badge/build-passing-green)

npm install && npm run dev

Open src/index.html in your browser, or clone the repository and run the
webpack production build. The game logic lives in src/game.js.

## Development

Run the tests with npm test. Pull requests are welcome; please update
CHANGELOG.md.
`;

/**
 * Three games, two of them with nested entries, and the reports the vendor and
 * validate phases leave behind. Descriptions are what GitHub would give us.
 */
function harvestState(root) {
  const third = join(root, 'third-party');
  const rows = [
    {
      repo: 'alice/tetris',
      owner: 'alice',
      licence: 'MIT',
      slug: 'alice-tetris',
      entry: 'dist/index.html',
      description: 'Stack falling blocks and clear lines before the pile reaches the top',
      readme: DEV_README,
      files: ['dist/index.html', 'dist/bundle.js'],
    },
    {
      repo: 'bob/snake',
      owner: 'bob',
      licence: 'Apache-2.0',
      slug: 'bob-snake',
      entry: 'index.html',
      description: 'Eat apples, grow longer and avoid the walls',
      readme: DEV_README,
      files: ['index.html', 'snake.js'],
    },
    {
      repo: 'carol/breakout',
      owner: 'carol',
      licence: 'MIT',
      slug: 'carol-breakout',
      entry: 'game/breakout.html',
      description: 'Smash every brick with a bouncing ball and a paddle you move',
      readme: DEV_README,
      files: ['game/breakout.html', 'game/breakout.js'],
    },
  ];

  const vendored = rows.map(({ files, ...record }) => {
    for (const file of files) touch(join(third, record.slug, file));
    write(join(third, record.slug, '.harvested.json'), { ...record, validated: true });
    return record;
  });

  const work = join(root, 'work');
  write(join(work, 'vendored.json'), vendored);
  write(
    join(work, 'validated.json'),
    vendored.map((v) => ({ slug: v.slug, repo: v.repo, verdict: 'pass', reason: 'already validated' })),
  );
  return { third, work, vendored };
}

/* ------------------------------------------------------ entry resolution */

test('resolveEntry uses the entry recorded in the game .harvested.json', (t) => {
  const root = sandbox(t);
  const third = vendoredGame(root, 'nested-game', ['docs/index.html', 'docs/game.js'], {
    repo: 'someone/nested-game',
    entry: 'docs/index.html',
  });

  // The record carries no entry of its own: the per-game file is the authority.
  assert.equal(resolveEntry({ slug: 'nested-game', repo: 'someone/nested-game' }, { thirdPartyDir: third }), 'docs/index.html');
});

test('a record with no entry field is resolved from the files on disk, not index.html', (t) => {
  const root = sandbox(t);
  const third = vendoredGame(root, 'build-game', ['dist/index.html', 'src/main.js'], {
    repo: 'someone/build-game',
  });

  const entry = resolveEntry({ slug: 'build-game', repo: 'someone/build-game' }, { thirdPartyDir: third });
  assert.equal(entry, 'dist/index.html');
  assert.notEqual(entry, 'index.html');
});

test('a record with no page on disk is skipped, never defaulted to index.html', (t) => {
  const root = sandbox(t);
  // A build-step repo that was vendored before anyone noticed: source only.
  const third = vendoredGame(root, 'build-only', ['src/main.js', 'package.json'], {
    repo: 'someone/build-only',
  });
  vendoredGame(root, 'docs-game', ['docs/index.html', 'docs/main.js'], { repo: 'someone/docs-game' });

  const { ready, skipped } = planValidation(
    [
      { slug: 'build-only', repo: 'someone/build-only' },
      { slug: 'docs-game', repo: 'someone/docs-game' },
      { slug: 'gone', repo: 'someone/gone' }, // never vendored / pruned
    ],
    { thirdPartyDir: third },
  );

  assert.deepEqual(skipped, ['build-only', 'gone']);
  assert.deepEqual(ready.map((r) => r.slug), ['docs-game']);
  assert.deepEqual(ready.map((r) => r.entry), ['docs/index.html']);
  // The defect this replaces: an index.html URL invented for a page that is
  // not there. Nothing in the plan may claim one.
  assert.ok(![...ready.map((r) => r.entry)].includes('index.html'));
  assert.equal(existsSync(join(third, 'build-only', 'index.html')), false);
});

test('an entry that escapes the game folder is refused', () => {
  assert.equal(safeEntry('../../etc/passwd'), null);
  assert.equal(safeEntry('docs/../../secrets.html'), null);
  assert.equal(safeEntry(''), null);
  assert.equal(safeEntry('/docs/index.html'), 'docs/index.html');
  assert.equal(safeEntry('.\\dist\\index.html'), 'dist/index.html');
  assert.equal(safeEntry('game.html'), 'game.html');
});

/* ------------------------------------------------------------- generate */

test('generate --dry-run writes nothing', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);
  const outFile = join(root, 'content', 'harvest-published.json');

  const games = generate({
    dryRun: true,
    workDir: work,
    outFile,
    rootDir: root,
    thirdPartyDir: third,
  });

  assert.ok(games.length >= 3, `expected the three fixture games, got ${games.length}`);
  assert.equal(existsSync(outFile), false, 'dry run must not create the output file');
  assert.equal(existsSync(join(root, 'content')), false, 'dry run must not create content/');
});

test('generate writes the importer layer with player-facing copy, no README prose', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);
  const outFile = join(root, 'content', 'harvest-published.json');

  generate({ workDir: work, outFile, rootDir: root, thirdPartyDir: third });

  const payload = JSON.parse(readFileSync(outFile, 'utf8'));
  assert.equal(payload._comment, PUBLISHED_COMMENT);
  assert.ok(Array.isArray(payload.games));
  assert.equal(payload.games.length, 3);

  // The header must stay identical to scripts/harvest/import.mjs's CLI, or the
  // same report would produce two different files.
  const importer = readFileSync(new URL('../scripts/harvest/import.mjs', import.meta.url), 'utf8');
  assert.ok(
    importer.includes('Generated by scripts/harvest/import.mjs from .harvest/vendored.json + .harvest/validated.json.'),
    'PUBLISHED_COMMENT drifted from the importer CLI',
  );

  const prose = (game) =>
    [game.title, game.tagline, game.description, ...(game.howToPlay ?? []), ...(game.faq ?? []).flatMap((f) => [f.q, f.a])]
      .join(' ');

  for (const game of payload.games) {
    const text = prose(game);
    assert.ok(!DEV_JARGON.test(text), `${game.id}: developer jargon in player copy: ${text.match(DEV_JARGON)?.[0]}`);
    assert.ok(!/npm install|git clone|readme|repository|webpack/i.test(text), `${game.id}: README prose leaked: ${text}`);
    assert.ok(game.description.length > 40, `${game.id}: description too thin to be page copy`);
    assert.ok(game.embed.src.startsWith(`/third-party/${game.embed.src.split('/')[2]}/`));
  }
});

test('generate embeds each game at the entry it really ships', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);
  const outFile = join(root, 'content', 'harvest-published.json');

  const games = generate({ workDir: work, outFile, rootDir: root, thirdPartyDir: third });
  const embedOf = (id) => games.find((g) => g.id === id)?.embed.src;

  assert.equal(embedOf('alice-tetris'), '/third-party/alice-tetris/dist/index.html');
  assert.equal(embedOf('bob-snake'), '/third-party/bob-snake/index.html');
  assert.equal(embedOf('carol-breakout'), '/third-party/carol-breakout/game/breakout.html');
  assert.equal(games.length, 3);
});

test('generate is idempotent: two runs produce identical bytes', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);
  const outFile = join(root, 'content', 'harvest-published.json');

  generate({ workDir: work, outFile, rootDir: root, thirdPartyDir: third });
  const first = readFileSync(outFile, 'utf8');
  generate({ workDir: work, outFile, rootDir: root, thirdPartyDir: third });
  const second = readFileSync(outFile, 'utf8');

  assert.equal(second, first);
});

test('generate does not resurrect content/games.generated.json', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);

  generate({ workDir: work, outFile: join(root, 'content', 'harvest-published.json'), rootDir: root, thirdPartyDir: third });

  // The legacy generate phase rewrote this layer from READMEs; the modern
  // pipeline never does, and neither may the delegated one.
  assert.equal(existsSync(join(root, 'content', 'games.generated.json')), false);
});

test('generate refuses a report with no verdicts instead of publishing everything', (t) => {
  const root = sandbox(t);
  const { work, third } = harvestState(root);
  write(join(work, 'validated.json'), []);

  const games = generate({
    dryRun: true,
    workDir: work,
    outFile: join(root, 'content', 'harvest-published.json'),
    rootDir: root,
    thirdPartyDir: third,
  });

  assert.deepEqual(games, []);
  assert.equal(existsSync(join(root, 'content', 'harvest-published.json')), false);
});
