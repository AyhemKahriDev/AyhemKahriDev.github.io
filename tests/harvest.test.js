/**
 * Tests for the front half of the harvest pipeline.
 *
 * Everything here runs offline: the GitHub call is injected into preflight,
 * and vendorAll is exercised on candidates that preflight rejects (or that are
 * already on disk), so no tarball is ever downloaded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { QUERY_FAMILIES, FAMILY_IDS, queriesFor } from '../scripts/harvest/queries.mjs';
import {
  ALLOWED_LICENCE,
  dedupeCandidates,
  normaliseRepo,
  rejectReason,
  shouldAccept,
  slugify,
} from '../scripts/harvest/filters.mjs';
import { makePreflight } from '../scripts/harvest/preflight.mjs';
import { vendorAll } from '../scripts/harvest/vendor.mjs';

const root = new URL('..', import.meta.url).pathname;

/** A passing GitHub search item; individual tests bend one field. */
function item(overrides = {}) {
  return {
    full_name: 'example/snake-game',
    description: 'A classic snake game in vanilla JavaScript',
    stargazers_count: 40,
    size: 220,
    license: { spdx_id: 'MIT' },
    ...overrides,
  };
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'arcadefork-harvest-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/* ------------------------------------------------------------ slugify */

test('slugify is stable and reproduces the slugs already on disk', () => {
  // These directories exist in the repository today; a change here would
  // orphan (or duplicate) every vendored game on the next harvest.
  assert.equal(slugify('bocaletto-luca/snake'), 'bocaletto-luca-snake');
  assert.equal(
    slugify('bocaletto-luca/who-wants-to-be-a-millionaire'),
    'bocaletto-luca-who-wants-to-be-a-millionaire',
  );
  assert.equal(slugify('123survesh/tetris'), '123survesh-tetris');
  assert.ok(existsSync(join(root, 'third-party/123survesh-tetris')));

  // Punctuation, spacing and case all collapse to single dashes, trimmed.
  assert.equal(slugify('  Foo_Bar.Baz  '), 'foo-bar-baz');
  assert.equal(slugify('---/---'), '');
  assert.equal(slugify('a/b'), 'a-b');

  // Deterministic, and never longer than 60 characters or dash-terminated.
  const long = slugify('owner/' + 'very-long-game-name-'.repeat(8));
  assert.equal(long, slugify('owner/' + 'very-long-game-name-'.repeat(8)));
  assert.ok(long.length <= 60);
  assert.ok(!long.endsWith('-'));
});

test('normaliseRepo collapses punctuation and case for block-list checks', () => {
  assert.equal(normaliseRepo('Bocaletto-Luca/Snake'), 'bocalettolucasnake');
  assert.equal(normaliseRepo('a.b_c-d'), 'abcd');
});

/* --------------------------------------------------------- candidates */

test('shouldAccept rejects a licence that is not on the allowlist', () => {
  assert.ok(ALLOWED_LICENCE.has('MIT'));
  assert.equal(shouldAccept(item()), true);

  const agpl = item({ license: { spdx_id: 'AGPL-3.0' } });
  assert.equal(shouldAccept(agpl), false);
  assert.match(rejectReason(agpl), /licence AGPL-3\.0/);

  const none = item({ license: null });
  assert.equal(shouldAccept(none), false);
  assert.match(rejectReason(none), /no licence/);
});

test('shouldAccept rejects a repository over the 6 MB cap', () => {
  assert.equal(shouldAccept(item({ size: 7000 })), false);
  assert.match(rejectReason(item({ size: 7000 })), /too large/);
  assert.equal(shouldAccept(item({ size: 6000 })), true);
  // Stored candidates use sizeKB rather than GitHub's size - both work.
  assert.equal(shouldAccept({ repo: 'example/snake', licence: 'MIT', sizeKB: 9000, stars: 9 }), false);
  assert.equal(shouldAccept({ repo: 'example/snake', licence: 'MIT', sizeKB: 900, stars: 9 }), true);
});

test("shouldAccept rejects a repo whose description says 'tutorial'", () => {
  const tutorial = item({ description: 'A tutorial: build a snake game step by step' });
  assert.equal(shouldAccept(tutorial), false);
  assert.match(rejectReason(tutorial), /tutorial/);

  // And a name that is infrastructure rather than a game.
  assert.equal(shouldAccept(item({ full_name: 'example/html5-game-engine' })), false);
});

test('shouldAccept still rejects repos with no game signal at all', () => {
  const vague = item({ full_name: 'example/thing', description: 'some code I wrote' });
  assert.equal(shouldAccept(vague), false);
  assert.match(rejectReason(vague), /no game signal/);
});

test('dedupeCandidates keeps the first record per repository', () => {
  const first = { repo: 'bocaletto-luca/snake', stars: 90 };
  const second = { repo: 'Bocaletto-Luca/Snake', stars: 10 };
  const other = { repo: 'someone/2048', stars: 4 };
  const out = dedupeCandidates([first, second, other]);
  assert.equal(out.length, 2);
  assert.equal(out[0], first);
  assert.equal(out[1], other);
  assert.deepEqual(dedupeCandidates(undefined), []);
});

/* ------------------------------------------------------------ queries */

test('queriesFor dedupes and respects a family filter', () => {
  // Every family is a usable size, and the whole matrix is much bigger than
  // the 61 queries the old pipeline shipped.
  for (const id of FAMILY_IDS) {
    const family = QUERY_FAMILIES[id];
    assert.ok(family.length >= 12 && family.length <= 20, `${id} has ${family.length} queries`);
    assert.equal(new Set(family).size, family.length, `${id} repeats a query`);
  }

  const all = queriesFor();
  assert.equal(new Set(all).size, all.length, 'queriesFor must de-duplicate');
  assert.ok(all.length > 61);

  const arcade = queriesFor('arcade');
  assert.deepEqual(arcade, [...new Set(QUERY_FAMILIES.arcade)]);
  assert.ok(arcade.includes('topic:html5-game'));
  assert.ok(arcade.includes('snake in:description') === false);

  // Overlapping families collapse to one list.
  const slice = queriesFor(['puzzle', 'word']);
  assert.equal(new Set(slice).size, slice.length);
  for (const q of QUERY_FAMILIES.word) assert.ok(slice.includes(q));

  // A comma-separated string is what HARVEST_FAMILY carries.
  assert.deepEqual(queriesFor('arcade, puzzle'), queriesFor(['arcade', 'puzzle']));
  assert.deepEqual(queriesFor('all'), all);
  assert.throws(() => queriesFor('arcade,not-a-family'), /unknown harvest family/);
});

/* --------------------------------------------------------- preflight */

test('preflight rejects a repo with no root index.html', (t) => {
  const dir = tempDir(t);
  const cachePath = join(dir, 'preflight.json');
  const gh = () =>
    JSON.stringify([
      { name: 'README.md', type: 'file' },
      { name: 'LICENSE', type: 'file' },
      { name: 'src', type: 'dir' },
    ]);
  const preflight = makePreflight({ gh, cachePath });
  const verdict = preflight('someone/no-index');
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /no root index\.html/);
  assert.deepEqual(verdict.files, ['README.md', 'LICENSE']);
});

test('preflight accepts index.html plus a LICENSE file', (t) => {
  const dir = tempDir(t);
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    return JSON.stringify([
      { name: 'index.html', type: 'file' },
      { name: 'LICENSE.md', type: 'file' },
      { name: 'game.js', type: 'file' },
    ]);
  };
  const preflight = makePreflight({ gh, cachePath: join(dir, 'preflight.json') });
  const verdict = preflight('someone/snake');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, 'ok');
  assert.ok(verdict.files.includes('index.html'));
  assert.deepEqual(calls, [['api', 'repos/someone/snake/contents/']]);

  // No index.html, no licence: both are refusals, with distinct reasons.
  const noLicence = makePreflight({
    gh: () => JSON.stringify([{ name: 'index.html', type: 'file' }]),
    cachePath: join(dir, 'other.json'),
  });
  assert.equal(noLicence('someone/snake').ok, false);
  assert.match(noLicence('someone/snake').reason, /no LICENSE/);
});

test('preflight serves the second call from its JSON cache', (t) => {
  const dir = tempDir(t);
  const cachePath = join(dir, 'preflight.json');
  let calls = 0;
  const gh = () => {
    calls += 1;
    return JSON.stringify([
      { name: 'index.html', type: 'file' },
      { name: 'LICENSE', type: 'file' },
    ]);
  };

  const preflight = makePreflight({ gh, cachePath });
  assert.equal(preflight('someone/snake').ok, true);
  assert.equal(calls, 1);

  // Same instance: cached in memory.
  assert.equal(preflight('someone/snake').ok, true);
  assert.equal(calls, 1);

  // New instance, same file: no API call at all - that is the point of a
  // resumable vendor phase.
  const again = makePreflight({ gh, cachePath });
  assert.equal(again('Someone/Snake').ok, true);
  assert.equal(calls, 1);

  const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
  assert.equal(cached['someone/snake'].ok, true);

  // A failed lookup is not a verdict and must not be cached.
  const flaky = makePreflight({ gh: () => '', cachePath: join(dir, 'flaky.json') });
  assert.equal(flaky('someone/snake').ok, false);
  assert.match(flaky('someone/snake').reason, /lookup failed/);
  assert.equal(existsSync(join(dir, 'flaky.json')), false);
});

/* ----------------------------------------------------------- vendor */

test('vendorAll skips on preflight and reuses an existing vendored copy', async (t) => {
  const dir = tempDir(t);
  const thirdPartyDir = join(dir, 'third-party');
  const workDir = join(dir, 'work');

  // Already vendored by an earlier run: no download, no preflight.
  const doneSlug = 'old/snake';
  const doneDir = join(thirdPartyDir, slugify(doneSlug));
  mkdirSync(doneDir, { recursive: true });
  writeFileSync(
    join(doneDir, '.harvested.json'),
    JSON.stringify({ repo: doneSlug, slug: slugify(doneSlug), validated: true }),
  );

  const asked = [];
  const preflight = (repo) => {
    asked.push(repo);
    if (repo === 'someone/no-index') return { ok: false, reason: 'no root index.html', files: [] };
    return { ok: true, reason: 'ok', files: ['index.html', 'LICENSE'] };
  };

  const result = await vendorAll(
    [
      { repo: doneSlug, defaultBranch: 'main' },
      { repo: 'someone/no-index', defaultBranch: 'main' },
    ],
    { concurrency: 2, thirdPartyDir, workDir, preflight },
  );

  assert.equal(result.vendored.length, 1);
  assert.equal(result.vendored[0].reused, true);
  assert.deepEqual(result.skipped.map((s) => s.repo), ['someone/no-index']);
  assert.match(result.skipped[0].reason, /no root index/);
  assert.deepEqual(asked, ['someone/no-index'], 'vendored repos must not be re-checked');

  // Failures are recorded for the resume pass even when there are none.
  const failed = JSON.parse(readFileSync(join(workDir, 'failed.json'), 'utf8'));
  assert.deepEqual(failed, []);
  assert.equal(existsSync(join(thirdPartyDir, slugify('someone/no-index'))), false);
});
