/**
 * The entry picker is what turns "this repo has no root index.html" from a
 * refusal into a game. 181 of 212 candidates in the last live sweep died on
 * that one rule, while the catalogue itself has always supported any entry
 * path (content/overrides.json embeds blockrain's demo.html).
 *
 * Everything here is offline: pickEntry is pure and the trees come from
 * tests/fixtures/tree-sample.json, which are real-shaped `gh api .../git/trees`
 * listings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pickEntry, looksLikeGameShell } from '../scripts/harvest/entry.mjs';
import { makePreflight } from '../scripts/harvest/preflight.mjs';
import { importGames } from '../scripts/harvest/import.mjs';

const TREES = JSON.parse(
  readFileSync(new URL('./fixtures/tree-sample.json', import.meta.url), 'utf8'),
);
const tree = (name) => TREES[name];

/* ------------------------------------------------------------ the rules */

test('a root index.html always wins', () => {
  const verdict = pickEntry(tree('rootIndex'));
  assert.equal(verdict.entry, 'index.html');
  assert.equal(verdict.score, 100);
  assert.ok(verdict.reason.length > 0, 'every verdict explains itself');

  // Same answer in the kitchen-sink repo, which also has dist/ and docs/.
  assert.equal(pickEntry(tree('kitchen')).entry, 'index.html');
});

test('docs/index.html beats a randomly nested index.html', () => {
  const verdict = pickEntry(tree('docsBuild'));
  // The GitHub Pages convention, not src/engine/physics/ - that is a module
  // demo inside the source tree, not the game.
  assert.equal(verdict.entry, 'docs/index.html');
  assert.equal(verdict.score, 84);
});

test('a nested game/ directory is discovered', () => {
  const verdict = pickEntry(tree('gameDirectory'));
  assert.equal(verdict.entry, 'game/index.html');
  assert.equal(verdict.score, 80);
  assert.match(verdict.reason, /game/i);
});

test('node_modules and tests/ are never the entry', () => {
  const verdict = pickEntry(tree('noiseOnly'));
  assert.equal(verdict.entry, null);
  assert.equal(verdict.score, 0);
  assert.ok(verdict.reason.length > 0);

  // The same paths, but with a real root page present, must still pick the
  // root page rather than something under node_modules.
  const mixed = [...tree('noiseOnly'), 'game.html', 'game.js'];
  assert.equal(pickEntry(mixed).entry, 'game.html');
});

test('anything deeper than maxDepth is rejected, and maxDepth is honoured', () => {
  assert.equal(pickEntry(tree('tooDeep')).entry, null);

  // The default is 3, so the same path is reachable when asked for.
  assert.equal(pickEntry(tree('tooDeep'), { maxDepth: 4 }).entry, 'src/js/levels/maps/index.html');

  // Exactly three directories deep is still inside the default budget.
  const depth3 = ['LICENSE', 'a/b/c/index.html', 'a/b/c/c.js'];
  assert.equal(pickEntry(depth3).entry, 'a/b/c/index.html');
});

test('documentation sites are rejected', () => {
  assert.equal(pickEntry(tree('docsSite')).entry, null);

  // Individually, so one accepted path cannot mask a rejected one.
  for (const path of ['mkdocs/index.html', 'docs/_site/index.html', 'coverage/index.html']) {
    assert.equal(pickEntry(['LICENSE', path, 'x.js']).entry, null, `${path} was accepted`);
  }
});

test('a repo with no html at all reports null with a reason', () => {
  const verdict = pickEntry(tree('noHtml'));
  assert.equal(verdict.entry, null);
  assert.equal(verdict.score, 0);
  assert.match(verdict.reason, /no .*html/i);
  assert.equal(pickEntry([]).entry, null);
  assert.equal(pickEntry(undefined).entry, null);
});

test('a single root page such as game.html is accepted', () => {
  const verdict = pickEntry(tree('singlePage'));
  assert.equal(verdict.entry, 'game.html');
  assert.equal(verdict.score, 40);
});

test('landing and legal pages are not mistaken for the game', () => {
  assert.equal(pickEntry(tree('landingOnly')).entry, null);
});

test('ties prefer the shallower path', () => {
  const verdict = pickEntry(tree('tieBreak'));
  assert.equal(verdict.entry, 'zoo/index.html', 'depth 1 must beat depth 2 at equal signal');
  assert.ok(verdict.score > 60, 'a .js neighbour is worth something');
});

test('pickEntry is deterministic and does not mutate its input', () => {
  const paths = Object.freeze([...tree('rootIndex')]);
  const a = pickEntry(paths);
  const b = pickEntry(paths);
  assert.deepEqual(a, b);
  // Windows separators and a leading ./ are the same file.
  assert.equal(pickEntry(['.\\dist\\index.html', 'LICENSE']).entry, 'dist/index.html');
});

/* ------------------------------------------------------ repo sanity gate */

test('looksLikeGameShell needs both javascript and html', () => {
  assert.equal(looksLikeGameShell(tree('rootIndex')), true);
  assert.equal(looksLikeGameShell(tree('gameDirectory')), true);
  assert.equal(looksLikeGameShell(['index.html', 'README.md']), false, 'html but no js');
  assert.equal(looksLikeGameShell(['src/main.js', 'README.md']), false, 'js but no html');
  assert.equal(looksLikeGameShell(tree('noHtml')), false);
  assert.equal(looksLikeGameShell([]), false);
  // .mjs counts as javascript.
  assert.equal(looksLikeGameShell(['index.html', 'src/game.mjs']), true);
});

/* --------------------------------------------- preflight carries the entry */

/** A preflight over a canned tree listing, in a throwaway cache directory. */
function preflightOver(paths, { answers } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'entry-preflight-'));
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (typeof answers === 'function') return answers(args);
    return paths.join('\n');
  };
  const preflight = makePreflight({ gh, cachePath: join(dir, 'preflight.json') });
  return { preflight, calls, cachePath: join(dir, 'preflight.json'), dir };
}

test('preflight accepts a docs/ game and puts the entry in the verdict', () => {
  const { preflight, calls, dir } = preflightOver(TREES.docsBuild);
  try {
    const verdict = preflight('someone/docs-game');
    assert.equal(verdict.ok, true);
    assert.equal(verdict.entry, 'docs/index.html');
    assert.ok(verdict.files.includes('LICENSE'));
    // One tree call for the whole repo, not one per directory.
    assert.equal(calls.length, 1);
    assert.match(calls[0][1], /git\/trees\/.+\?recursive=1$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preflight refuses a docs-site repo with a reason that names the problem', () => {
  const { preflight, dir } = preflightOver(TREES.docsSite);
  try {
    const verdict = preflight('someone/mkdocs');
    assert.equal(verdict.ok, false);
    assert.equal(verdict.entry, null);
    assert.match(verdict.reason, /no root index\.html/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('COPYING and UNLICENSE count as a licence', () => {
  for (const licence of ['COPYING', 'UNLICENSE.md', 'LICENSE-MIT']) {
    const { preflight, dir } = preflightOver([...TREES.singlePage, licence]);
    try {
      assert.equal(preflight(`someone/${licence}`).ok, true, `${licence} was refused`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('a stale refusal is re-probed, a cached acceptance is trusted', () => {
  const { preflight, calls, cachePath, dir } = preflightOver(TREES.docsBuild);
  try {
    // An older cache entry: same file, no version, refused under the root rule.
    writeFileSync(
      cachePath,
      JSON.stringify({
        'someone/old': { ok: false, reason: 'no root index.html', files: [] },
        'someone/ok': { ok: true, reason: 'ok', files: ['index.html'] },
      }),
    );
    const fresh = makePreflight({ gh: (args) => (calls.push(args), TREES.docsBuild.join('\n')), cachePath });

    const old = fresh('someone/old');
    assert.equal(old.ok, true, 'the 181 "no root index.html" verdicts must be revisited');
    assert.equal(old.entry, 'docs/index.html');

    const before = calls.length;
    const cached = fresh('someone/ok');
    assert.equal(calls.length, before, 'a cached acceptance costs no API call');
    assert.equal(cached.ok, true);
    assert.equal(cached.entry, 'index.html');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the contents endpoint is the fallback when the tree call answers nothing', () => {
  const answers = (args) => {
    if (String(args[1]).includes('git/trees')) return '';
    if (String(args[1]).endsWith('contents/')) {
      return JSON.stringify([
        { name: 'LICENSE', type: 'file' },
        { name: 'README.md', type: 'file' },
        { name: 'docs', type: 'dir' },
      ]);
    }
    return JSON.stringify([
      { name: 'index.html', type: 'file' },
      { name: 'game.js', type: 'file' },
    ]);
  };
  const { preflight, calls, dir } = preflightOver([], { answers });
  try {
    const verdict = preflight('someone/docs-game');
    assert.equal(verdict.ok, true);
    assert.equal(verdict.entry, 'docs/index.html');
    assert.ok(calls.some((args) => String(args[1]).endsWith('contents/docs')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --------------------------------------------------- importer integration */

test('the importer writes embed.src with the discovered entry', () => {
  const vendored = [
    { repo: 'someone/docs-game', slug: 'someone-docs-game', entry: 'docs/index.html', owner: 'someone', licence: 'MIT', stars: 40, description: 'puzzle game' },
    { repo: 'someone/plain', slug: 'someone-plain', owner: 'someone', licence: 'MIT', stars: 10, description: 'arcade game' },
  ];
  const validated = vendored.map((v) => ({ slug: v.slug, repo: v.repo, verdict: 'pass', reason: '' }));
  const games = importGames({
    vendored,
    validated,
    copyFor: (v) => ({ title: v.repo.split('/')[1] }),
    familyFor: () => 'puzzle',
    categoryFor: () => 'puzzle',
    capPerFamily: 40,
    budget: 500,
  });

  const byId = new Map(games.map((g) => [g.id, g]));
  assert.equal(byId.get('someone-docs-game').embed.src, '/third-party/someone-docs-game/docs/index.html');
  // A record without an entry keeps the old URL.
  assert.equal(byId.get('someone-plain').embed.src, '/third-party/someone-plain/index.html');
});
