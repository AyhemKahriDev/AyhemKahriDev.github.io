/**
 * The harvest entry point: one CLI, one phase list, no duplicate pipeline.
 *
 * The rewrite moved the four phases behind scripts/harvest/cli.mjs and left
 * scripts/harvest-games.mjs as a forwarding shim (batch.mjs and
 * tests/legacy-pipeline.test.js still name it). These tests pin the parts that
 * would otherwise rot silently: the knob names, the failure mode for a typo in
 * the phase, the "nothing to do" path that must not rewrite the catalogue, and
 * the fact that the shim has no second implementation left in it.
 *
 * Everything here is offline: the sweep is given a report directory that
 * already holds enough candidates to be over its target, so it makes no GitHub
 * call at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PHASES, settings } from '../scripts/harvest/cli.mjs';
import { PHASES as SHIM_PHASES } from '../scripts/harvest-games.mjs';

const root = new URL('..', import.meta.url).pathname;
const cli = join(root, 'scripts/harvest/cli.mjs');

/** A temp directory that is removed whatever the test does. */
function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'arc-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/* --------------------------------------------------------------- knobs */

/**
 * Every documented variable, the flag that overrides it, and the field the
 * pipeline reads. A variable missing from this table is a variable that
 * silently stops working, which is exactly how `--workers=6` went unnoticed.
 */
const KNOBS = [
  { env: 'HARVEST_FAMILY', value: 'arcade,puzzle', flag: '--family', flagValue: 'word', field: 'families', expected: 'arcade,puzzle', flagExpected: 'word' },
  { env: 'HARVEST_TARGET', value: '650', flag: '--target', flagValue: '12', field: 'target', expected: 650, flagExpected: 12 },
  { env: 'HARVEST_PAGES', value: '2', flag: '--pages', flagValue: '4', field: 'pages', expected: 2, flagExpected: 4 },
  { env: 'HARVEST_CALLS', value: '400', flag: '--calls', flagValue: '7', field: 'calls', expected: 400, flagExpected: 7 },
  { env: 'HARVEST_LIMIT', value: '650', flag: '--limit', flagValue: '3', field: 'limit', expected: 650, flagExpected: 3 },
  { env: 'HARVEST_CONCURRENCY', value: '8', flag: '--concurrency', flagValue: '2', field: 'concurrency', expected: 8, flagExpected: 2 },
  { env: 'HARVEST_MIN_STARS', value: '5', flag: '--min-stars', flagValue: '0', field: 'minStars', expected: 5, flagExpected: 0 },
  { env: 'HARVEST_CAPS', value: '120', flag: '--caps', flagValue: '40', field: 'caps', expected: 120, flagExpected: 40 },
  { env: 'HARVEST_BUDGET', value: '465', flag: '--budget', flagValue: '9', field: 'budget', expected: 465, flagExpected: 9 },
  { env: 'HARVEST_ROUNDS', value: '3', flag: '--rounds', flagValue: '2', field: 'rounds', expected: 3, flagExpected: 2 },
  { env: 'VALIDATE_WORKERS', value: '4', flag: '--workers', flagValue: '1', field: 'workers', expected: 4, flagExpected: 1 },
  { env: 'HARVEST_PORT', value: '4299', flag: '--port', flagValue: '4300', field: 'port', expected: '4299', flagExpected: '4300' },
];

test('the CLI parses every documented env var, and the flag wins', (t) => {
  const dir = sandbox(t);

  for (const knob of KNOBS) {
    const fromEnv = settings({ ...process.env, [knob.env]: knob.value }, {});
    assert.equal(
      fromEnv[knob.field],
      knob.expected,
      `${knob.env} did not reach settings().${knob.field}`,
    );

    // Same variable set, plus the flag: the flag has to win, not be ignored
    // because a variable was also present.
    const both = settings(
      { ...process.env, [knob.env]: knob.value },
      { [knob.flag.slice(2)]: knob.flagValue },
    );
    assert.equal(
      both[knob.field],
      knob.flagExpected,
      `${knob.flag} did not override ${knob.env}`,
    );
  }

  // HARVEST_DIR is a path, not a number, and resolves against the cwd.
  const work = settings({ ...process.env, HARVEST_DIR: dir }, {});
  assert.equal(work.work, dir);
  assert.equal(settings({ ...process.env, HARVEST_DIR: '' }, {}).work.endsWith('.harvest'), true);

  // Defaults, so a bare `npm run harvest` stays bounded.
  const defaults = settings({}, {});
  assert.equal(defaults.target, 0);
  assert.equal(defaults.limit, 0);
  assert.equal(defaults.pages, 10);
  assert.equal(defaults.caps, 80);
  assert.equal(defaults.budget, 500);
  assert.equal(defaults.workers, 6);
  assert.equal(defaults.rounds, 1);
  assert.equal(defaults.families, 'all');
});

/* ------------------------------------------------------- unknown phase */

test('an unknown phase exits non-zero and names the valid phases', () => {
  const result = spawnSync(process.execPath, [cli, 'sweep-and-pray'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'a typo in the phase must not run `all`');
  assert.match(result.stderr, /unknown phase/);
  assert.match(result.stderr, /sweep-and-pray/);
  for (const phase of PHASES) {
    assert.ok(
      result.stderr.includes(phase),
      `the error message does not mention the valid phase "${phase}": ${result.stderr}`,
    );
  }
  // It must not have started a sweep or created a report directory.
  assert.equal(result.stdout.includes('sweep:'), false);
});

/* ------------------------------------------------------------ --help */

test('--help prints usage without running a phase', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: node scripts\/harvest\/cli\.mjs/);
  for (const phase of ['sweep', 'vendor', 'validate', 'import', 'all']) {
    assert.ok(result.stdout.includes(phase), `usage does not list ${phase}`);
  }
});

/* -------------------------------------------- nothing to do, no writes */

/** A catalogue fingerprint: every file name plus the hash of the published layer. */
function fingerprint(dir) {
  const files = readdirSync(dir).sort();
  const published = join(dir, 'harvest-published.json');
  const hash = existsSync(published)
    ? createHash('sha256').update(readFileSync(published)).digest('hex')
    : 'missing';
  return { files, hash };
}

test('npm run harvest with a fake .harvest and nothing pending touches no content/', (t) => {
  const work = sandbox(t);
  const content = join(root, 'content');
  const before = fingerprint(content);

  /**
   * One candidate that is already on the skip list: enough for the sweep to be
   * over its target (so it makes zero GitHub calls), and nothing for vendor to
   * download - the "nothing to do" path.
   */
  writeFileSync(
    join(work, 'candidates.json'),
    JSON.stringify([
      { repo: 'someone/already-refused', stars: 3, licence: 'MIT', sizeKB: 120, description: 'snake game' },
    ]),
  );
  writeFileSync(join(work, 'skipped.json'), JSON.stringify(['someone/already-refused']));

  const result = spawnSync(process.execPath, [cli, 'all'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      HARVEST_DIR: work,
      HARVEST_TARGET: '1',
      HARVEST_LIMIT: '1',
      HARVEST_PAGES: '1',
      HARVEST_FAMILY: 'arcade',
    },
  });

  assert.equal(result.status, 0, `npm run harvest failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /nothing to do/);
  assert.equal(result.stdout.includes('import:'), false, 'import ran with nothing to publish');

  const after = fingerprint(content);
  assert.deepEqual(after, before, 'content/ changed on a run with nothing to do');
  assert.equal(existsSync(join(work, 'vendored.json')), false, 'vendor wrote a report it had no work for');
});

/* --------------------------------------------------------- one pipeline */

test('the shim and the modern CLI agree on the phase list, and the shim holds no pipeline', () => {
  assert.deepEqual(SHIM_PHASES, PHASES, 'harvest-games.mjs must not keep its own phase list');
  for (const phase of ['sweep', 'vendor', 'validate', 'import', 'all']) {
    assert.ok(PHASES.includes(phase), `the modern CLI lost the ${phase} phase`);
  }

  const shim = readFileSync(join(root, 'scripts/harvest-games.mjs'), 'utf8');
  const lines = shim.split('\n').length;
  assert.ok(lines < 60, `the shim grew back into a pipeline (${lines} lines)`);

  // The parts the modern modules own may not reappear in the shim: a query
  // list, the licence map, slugify, shouldAccept, the README scraper, the
  // category rules or a generate() body.
  for (const owned of [
    'topic:html5-game',
    'SEARCH_LICENCES =',
    'ALLOWED_LICENCE',
    'CATEGORY_RULES',
    'export function slugify',
    'export function shouldAccept',
    'function scrapeReadme',
    'export function generate(',
    'vendorAll(',
  ]) {
    assert.equal(shim.includes(owned), false, `harvest-games.mjs still implements ${owned}`);
  }
  // ... and it must bring its exports from the CLI rather than redefine them.
  assert.match(shim, /export \* from '\.\/harvest\/cli\.mjs'/);
});

test('package.json routes harvest at the modern CLI and exposes the batch driver', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  assert.equal(pkg.scripts.harvest, 'node scripts/harvest/cli.mjs all');
  assert.equal(pkg.scripts['harvest:batch'], 'node scripts/harvest/batch.mjs');

  // No harvest script may point at a file that is not there.
  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (!name.startsWith('harvest')) continue;
    const file = command.split(/\s+/)[1];
    assert.ok(existsSync(join(root, file)), `${name} points at a missing file: ${file}`);
  }
});

test('a batch round drives vendor through a phase the CLI still serves', () => {
  // scripts/harvest/batch.mjs spawns `harvest-games.mjs vendor`; that shim has
  // to keep forwarding a real phase, or every batch round vendors nothing.
  const batch = readFileSync(join(root, 'scripts/harvest/batch.mjs'), 'utf8');
  const spawns = [...batch.matchAll(/'(scripts\/[^']+\.mjs)'/g)].map((m) => m[1]);
  assert.ok(spawns.length > 0, 'batch.mjs no longer spawns any script');
  for (const script of spawns) {
    assert.ok(existsSync(join(root, script)), `batch spawns a missing script: ${script}`);
  }
  const phasesItUses = [...batch.matchAll(/'(?:sweep|vendor|validate|import|generate|all)'/g)].map((m) =>
    m[0].replaceAll("'", ''),
  );
  for (const phase of phasesItUses) {
    assert.ok(PHASES.includes(phase), `batch uses a phase the CLI does not accept: ${phase}`);
  }
  // And the vendor phase it names must actually be forwarded by the shim.
  assert.ok(existsSync(join(root, 'scripts/harvest-games.mjs')));
});
