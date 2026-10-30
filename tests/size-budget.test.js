/**
 * The deploy budget: a static host has two hard ceilings — 20,000 files and
 * 25 MiB per asset — and for a year nothing in the repo measured the first one.
 * These tests pin both halves of the answer:
 *
 *   - scripts/audit-size.mjs refuses a tree over its file or byte budget, and
 *     says nothing when the tree is inside it;
 *   - scripts/prune-vendored.mjs keeps everything a page can reach and only
 *     removes unreachable files that a rule class covers — the reachability
 *     helper is the contract, so it is tested directly rather than through the
 *     build.
 *
 * Every fixture is synthetic and lives under os.tmpdir(): no test reads or
 * writes dist/, third-party/ or content/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_FILES,
  MAX_FILE,
  PLATFORM_MAX_ASSET,
  PLATFORM_MAX_FILES,
  auditDist,
} from '../scripts/audit-size.mjs';
import { analyseVendored, pruneVendored } from '../scripts/prune-vendored.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const auditCli = join(here, '..', 'scripts', 'audit-size.mjs');

/** A temp directory that is removed whatever the test does. */
function sandbox(t, prefix = 'arc-size-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Write { 'rel/path': 'content' } into dir, creating parents. */
function tree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

/* --------------------------------------------------------------- the gate */

test('the file ceiling sits under the platform limit with room to grow', () => {
  assert.equal(PLATFORM_MAX_FILES, 20_000);
  assert.ok(MAX_FILES < PLATFORM_MAX_FILES, `${MAX_FILES} must stay under ${PLATFORM_MAX_FILES}`);
  // The measured 2026-10 build added 664 URLs per locale; the headroom is the
  // budget for the next one, not a round number picked for looks.
  assert.ok(PLATFORM_MAX_FILES - MAX_FILES >= 664, 'headroom must cover at least one more locale');
});

test('the per-file ceiling is a margin below the platform asset limit', () => {
  assert.equal(PLATFORM_MAX_ASSET, 25 * 1024 * 1024);
  assert.ok(MAX_FILE < PLATFORM_MAX_ASSET, 'MAX_FILE must be stricter than the platform');
  assert.equal(MAX_FILE, 20 * 1024 * 1024);
});

test('a tree inside the budget passes', (t) => {
  const dist = sandbox(t);
  tree(dist, {
    'index.html': '<html></html>',
    'assets/app.js': 'x'.repeat(64),
    'third-party/tetris/index.html': '<canvas></canvas>',
  });

  const report = auditDist(dist);
  assert.equal(report.ok, true, report.problems.join('; '));
  assert.equal(report.count, 3);
  assert.deepEqual(report.problems, []);
});

test('a tree over the file count fails, and names the count', (t) => {
  const dist = sandbox(t);
  const files = {};
  for (let i = 0; i < 12; i += 1) files[`third-party/tiny/file-${i}.js`] = 'x';
  tree(dist, files);

  // The real ceiling needs 18,500 files to cross; the gate is the same code
  // path with a smaller budget, which keeps this test to milliseconds.
  const report = auditDist(dist, { maxFiles: 10 });
  assert.equal(report.ok, false);
  assert.equal(report.count, 12);
  assert.match(report.problems.join('\n'), /12 files, over the 10-file budget/);
  assert.match(report.problems.join('\n'), /platform ceiling 20000/);
});

test('a tree over the per-file budget fails, and names the file', (t) => {
  const dist = sandbox(t);
  tree(dist, {
    'index.html': '<html></html>',
    'assets/huge.bin': 'x'.repeat(2048),
  });

  const report = auditDist(dist, { maxFile: 1024 });
  assert.equal(report.ok, false);
  assert.match(report.problems.join('\n'), /assets\/huge\.bin is 0\.0 MB, over the 0\.0 MB per-file budget/);
});

test('a game over the per-game budget fails, and names the slug', (t) => {
  const dist = sandbox(t);
  tree(dist, {
    'third-party/porky/index.html': 'x',
    'third-party/porky/pack.bin': 'x'.repeat(2048),
  });

  const report = auditDist(dist, { maxGame: 1024 });
  assert.equal(report.ok, false);
  assert.match(report.problems.join('\n'), /third-party\/porky is 0\.0 MB, over the 0\.0 MB per-game budget/);
});

test('the gate fails loudly instead of crashing when dist is absent', (t) => {
  const missing = join(sandbox(t), 'never-built');
  assert.equal(existsSync(missing), false);

  const run = spawnSync(process.execPath, [auditCli, '--dist', missing], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /is missing - run `npm run build` first/);
  assert.doesNotMatch(run.stderr, /TypeError|ENOENT/);
});

/* ------------------------------------------------------------- the pruner */

/**
 * A game that exercises every rule at once: a page that loads one script, one
 * stylesheet, one sound and one level; plus an unreachable test suite, a second
 * audio format nobody asks for, an archive, a source map, a licence and the
 * attribution notice.
 */
function gameFixture(t) {
  const dir = sandbox(t, 'arc-prune-');
  tree(dir, {
    'index.html': [
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="css/style.css">',
      '</head><body><canvas id="c"></canvas>',
      '<script src="js/game.js"></script>',
      '<script src="js/lib.min.js"></script>',
      '</body></html>',
    ].join('\n'),
    'css/style.css': 'body { background: url("../img/bg.png") }',
    // Both URLs resolve against the page, not against js/: that is the base
    // the browser uses for Audio and fetch, and getting it wrong would call
    // reachable files unreachable.
    'js/game.js': [
      'const s = new Audio("sfx/boom.ogg");',
      'const t = new Audio("sfx/theme.ogg");',
      'fetch("data/level1.json");',
    ].join('\n'),
    'img/bg.png': 'png',
    'sfx/boom.ogg': 'ogg',
    'data/level1.json': '{}',
    // (b) the same track in a format the entry never names
    'sfx/theme.ogg': 'ogg',
    'sfx/theme.mp3': 'mp3',
    // (a) a development tree
    'tests/game.test.js': 'test("it runs", () => {})',
    '.github/workflows/ci.yml': 'on: push',
    // (c) a source map and an unminified twin of a file the page does load
    'js/game.js.map': '{}',
    'js/lib.min.js': 'min',
    'js/lib.js': 'unminified library',
    // (d) an archive
    'asset-pack.zip': 'PK',
    // never pruned
    'LICENSE': 'MIT',
    'ARCADEFORK-NOTICE.md': '# vendored from somewhere',
    'README.md': '# Play it\n\nLicence: MIT, by A. Author.',
  });
  return dir;
}

test('the reachability walk follows href, src, url() and runtime loads', (t) => {
  const dir = gameFixture(t);
  const report = analyseVendored(dir);

  assert.equal(report.entries[0], 'index.html');
  for (const rel of ['index.html', 'css/style.css', 'img/bg.png', 'js/game.js', 'sfx/boom.ogg', 'data/level1.json']) {
    assert.ok(report.reachable.has(rel), `${rel} must be reachable from index.html`);
  }
  // The sheet is reached via <link href>, and the image only via url() inside
  // it — that is the second hop the walk exists for.
  assert.ok(!report.reachable.has('sfx/theme.mp3'));
});

test('an unreferenced file a rule covers is removable, a referenced one is kept', (t) => {
  const dir = gameFixture(t);
  const report = analyseVendored(dir);
  const byRel = new Map(report.candidates.map((c) => [c.rel, c.rule]));

  const removable = {
    'tests/game.test.js': 'dev-tree',
    '.github/workflows/ci.yml': 'dev-tree',
    'sfx/theme.mp3': 'dup-media',
    'js/lib.js': 'minified-dup',
    'js/game.js.map': 'source-map',
    'asset-pack.zip': 'archive',
  };
  for (const [rel, rule] of Object.entries(removable)) {
    assert.equal(byRel.get(rel), rule, `${rel} should be removable as ${rule}`);
  }
  for (const rel of [
    'index.html', 'js/game.js', 'css/style.css', 'img/bg.png',
    'sfx/boom.ogg', 'sfx/theme.ogg',
    // attribution and the root README where many repos state their licence
    'LICENSE', 'ARCADEFORK-NOTICE.md', 'README.md',
  ]) {
    assert.equal(byRel.has(rel), false, `${rel} must be kept`);
  }
});

test('licence files are kept whatever their name and wherever they sit', (t) => {
  const dir = sandbox(t, 'arc-prune-');
  tree(dir, {
    'index.html': '<script src="game.js"></script>',
    'game.js': 'console.log(1)',
    'LICENSE': 'MIT',
    'LICENSE-MIT.txt': 'MIT',
    'COPYING': 'GPL',
    'NOTICE': 'attribution',
    'AUTHORS.md': 'A. Author',
    'THIRD-PARTY-MANIFEST.md': '# who wrote what',
    'vendor/ARCADEFORK-NOTICE.md': '# nested notice',
    'vendor/LEGAL/NOTICE.txt': 'attribution',
  });

  const report = analyseVendored(dir);
  const removable = new Set(report.candidates.map((c) => c.rel));
  for (const rel of ['LICENSE', 'LICENSE-MIT.txt', 'COPYING', 'NOTICE', 'AUTHORS.md', 'THIRD-PARTY-MANIFEST.md', 'vendor/ARCADEFORK-NOTICE.md', 'vendor/LEGAL/NOTICE.txt']) {
    assert.equal(removable.has(rel), false, `${rel} is attribution, not dead prose`);
  }
});

test('a root or first-level README is exempt from the docs-prose rule', (t) => {
  const dir = sandbox(t, 'arc-prune-');
  tree(dir, {
    'index.html': '<script src="game.js"></script>',
    'game.js': 'console.log(1)',
    'README.md': '# the repo README',
    'docs/README.md': '# docs front page',
    'docs/notes/design.md': '# internal notes',
    'js/vendor/README.md': '# a nested README is still prose',
  });

  const report = analyseVendored(dir);
  const byRel = new Map(report.candidates.map((c) => [c.rel, c.rule]));
  assert.equal(byRel.has('README.md'), false);
  assert.equal(byRel.has('docs/README.md'), false);
  assert.equal(byRel.get('docs/notes/design.md'), 'docs');
  assert.equal(byRel.get('js/vendor/README.md'), 'docs');
});

test('a file the text mentions but never loads statically is kept', (t) => {
  const dir = sandbox(t, 'arc-prune-');
  tree(dir, {
    'index.html': '<script src="game.js"></script>',
    // clumsy-bird builds its BGM name at runtime, so the name is only a string
    // in the bundle — never a literal path.
    'game.js': 'const bgm = "assets/" + "theme.mp3"; new Audio(bgm);',
    'assets/theme.mp3': 'mp3',
    'assets/theme.ogg': 'ogg',
  });

  const report = analyseVendored(dir);
  const rels = report.candidates.map((c) => c.rel);
  assert.ok(!rels.includes('assets/theme.mp3'), 'a mentioned filename must survive the dup-media rule');
});

test('a game whose entry cannot be found is left whole', (t) => {
  const dir = sandbox(t, 'arc-prune-');
  tree(dir, {
    'notes/readme.md': 'nothing to see',
    'tools/build.py': 'print(1)',
  });

  const report = analyseVendored(dir);
  assert.deepEqual(report.entries, []);
  assert.deepEqual(report.candidates, []);
});

test('--dry-run reports the same numbers and deletes nothing', (t) => {
  const dir = gameFixture(t);
  const before = analyseVendored(dir).candidates.length;
  assert.ok(before > 0);

  const dry = pruneVendored(dir, { dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.removed, before, 'dry run must count what it would remove');
  assert.ok(dry.bytes > 0);
  assert.ok(existsSync(join(dir, 'tests/game.test.js')), 'dry run must not delete');
  assert.ok(existsSync(join(dir, 'asset-pack.zip')), 'dry run must not delete');

  const real = pruneVendored(dir);
  assert.equal(real.removed, before);
  assert.ok(!existsSync(join(dir, 'tests/game.test.js')));
  assert.ok(!existsSync(join(dir, 'asset-pack.zip')));
  assert.ok(existsSync(join(dir, 'index.html')), 'the entry page must survive a real run');
  assert.ok(existsSync(join(dir, 'js/game.js')));
  assert.ok(existsSync(join(dir, 'ARCADEFORK-NOTICE.md')));
});

test('the CLI deletes nothing unless --apply is passed', (t) => {
  const dir = gameFixture(t);
  const cli = join(here, '..', 'scripts', 'prune-vendored.mjs');

  // `--dir` and `--json` alone must stay a report: running a reporting
  // command against third-party/ once deleted a game's notice and README.
  for (const args of [[], ['--json']]) {
    const run = spawnSync(process.execPath, [cli, '--dir', dir, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(existsSync(join(dir, 'tests/game.test.js')), `nothing may be deleted for ${args.join(' ') || 'no flags'}`);
    assert.ok(existsSync(join(dir, 'ARCADEFORK-NOTICE.md')));
  }
  const report = JSON.parse(spawnSync(process.execPath, [cli, '--dir', dir, '--json'], { encoding: 'utf8' }).stdout);
  assert.equal(report.dryRun, true);
  assert.ok(report.removed > 0);
});

test('pruning is idempotent: a second run finds nothing left to remove', (t) => {
  const dir = gameFixture(t);
  pruneVendored(dir);
  const again = pruneVendored(dir, { dryRun: true });
  assert.equal(again.removed, 0);
});
