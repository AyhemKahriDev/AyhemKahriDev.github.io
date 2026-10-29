/**
 * The import gate must make the same judgement smoke makes: a game that paints
 * and then crashes the moment a player presses a key is not a game.
 *
 * These tests pin the decision half of scripts/harvest/click-test.mjs. No
 * browser, no server, no network: judgeInteraction() is pure, so the whole
 * rulebook can be exercised from a fixture, and the browser driver is the only
 * part that needs a real page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BENIGN_CONSOLE,
  isBenign,
  judgeInteraction,
} from '../scripts/harvest/click-test.mjs';
import { importGames } from '../scripts/harvest/import.mjs';

/** A game that survived the click: it painted, and it still has an interface. */
const LIVE = { pixels: 4200, textLen: 180, controls: 3, canvases: 1, webgl: false };
/** A game that answered the first key with a blank page. */
const DEAD = { pixels: 0, textLen: 20, controls: 0, canvases: 1, webgl: false };

const verdict = (overrides = {}) =>
  judgeInteraction({ probeAfterInput: LIVE, status: 200, ...overrides });

/* ------------------------------------------------------------ failures */

test('a pageerror thrown after the first input fails the game', () => {
  const result = verdict({
    pageErrors: ["Cannot read properties of undefined (reading '15')"],
    consoleErrors: [],
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((r) => /undefined/.test(r)),
    `the reason should name the error, got ${JSON.stringify(result.reasons)}`,
  );
});

test('a console error that is not allowlisted fails the game', () => {
  const result = verdict({ consoleErrors: ['Refused to execute inline script'] });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length >= 1);
});

test('a dead probe fails: nothing painted and almost no text', () => {
  const result = verdict({ probeAfterInput: DEAD });
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((r) => /nothing|dead|blank|painted/i.test(r)),
    `expected a dead-page reason, got ${JSON.stringify(result.reasons)}`,
  );
});

test('a same-origin 404 after input fails the game', () => {
  const result = verdict({
    httpErrors: [{ status: 404, url: 'http://localhost:4191/third-party/demo/game.js', sameOrigin: true }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => /404/.test(r)));
});

test('a page that answers with its own 404 status fails', () => {
  const result = verdict({ status: 404 });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => /404/.test(r)));
});

/* ---------------------------------------------------------------- passes */

test('a live probe with no errors passes with no reasons', () => {
  const result = verdict();
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test('a third-party 404 is the game owner’s business, not a build failure', () => {
  const result = verdict({
    httpErrors: [{ status: 404, url: 'https://cdn.example.com/ads/banner.png', sameOrigin: false }],
  });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
});

test('a WebGL canvas with no readable pixels is not called dead', () => {
  // smoke waives exactly this case: a GL canvas cannot be read back through a
  // 2D context, so the context itself is the evidence that something renders.
  const result = verdict({
    probeAfterInput: { pixels: 0, textLen: 12, controls: 0, canvases: 1, webgl: true },
  });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
});

/* ------------------------------------------------------------- allowlist */

test('the allowlist is a data structure, not a pile of inline regexes', () => {
  assert.ok(Array.isArray(BENIGN_CONSOLE), 'BENIGN_CONSOLE must be an array');
  assert.ok(BENIGN_CONSOLE.length >= 6, `expected at least 6 rules, got ${BENIGN_CONSOLE.length}`);
  const ids = new Set();
  for (const rule of BENIGN_CONSOLE) {
    assert.equal(typeof rule, 'object');
    assert.equal(typeof rule.id, 'string', 'each rule needs an id');
    assert.ok(rule.id.length > 0);
    assert.ok(!ids.has(rule.id), `duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.test instanceof RegExp, `${rule.id}.test must be a RegExp`);
    assert.equal(typeof rule.why, 'string', `${rule.id} must say why it is benign`);
    assert.ok(rule.why.length > 10, `${rule.id} needs a real explanation`);
    assert.equal(typeof rule.sample, 'string', `${rule.id} needs a sample message`);
    assert.match(rule.sample, rule.test, `${rule.id}.sample must match its own rule`);
  }
});

test('every allowlisted message is benign, one test per rule', () => {
  for (const rule of BENIGN_CONSOLE) {
    assert.equal(isBenign(rule.sample), true, `${rule.id} should be benign`);
    const result = verdict({ consoleErrors: [rule.sample] });
    assert.deepEqual(result, { ok: true, reasons: [] }, `${rule.id} must not fail the game`);
  }
});

test('an allowlisted word does not swallow a real error', () => {
  // "ad" appears inside half the words in a stack trace; the rule must not
  // launder a genuine crash just because a URL contains it.
  assert.equal(isBenign("Uncaught TypeError: Cannot read properties of undefined (reading '15')"), false);
  assert.equal(isBenign('Uncaught SyntaxError: Unexpected token <'), false);
  const result = verdict({
    consoleErrors: ['Uncaught TypeError: loadAd is not a function'],
  });
  assert.equal(result.ok, false);
});

/* ---------------------------------------------------------------- import */

const ROW = {
  slug: 'demo-button-mash',
  repo: 'demo/button-mash',
  title: 'Button Mash',
  description: 'A demo game used to pin the importer.',
  family: 'arcade',
  stars: 10,
  licence: 'MIT',
};

const copyFor = (v) => ({
  title: v.title,
  tagline: 'A free Button Mash browser game.',
  description: `${v.description} Play instantly, no download.`,
  keywords: ['button mash game'],
  howToPlay: ['Press the button.'],
  faq: [{ q: 'Is it free?', a: 'Yes.' }],
});

const importWith = (clickTest) =>
  importGames({
    vendored: [{ ...ROW }],
    validated: [{ slug: ROW.slug, repo: ROW.repo, verdict: 'pass', ...(clickTest ? { clickTest } : {}) }],
    copyFor,
    familyFor: () => ROW.family,
    categoryFor: () => 'arcade',
    capPerFamily: 10,
    budget: 10,
  });

test('a clickTest failure is unpublishable even though the paint verdict passed', () => {
  assert.equal(importWith().length, 1, 'a plain pass must still import');
  assert.equal(importWith('pass').length, 1, 'clickTest pass must not block');
  assert.deepEqual(importWith('fail'), [], 'clickTest fail must never publish');
});

/* ---------------------------------------------------------- determinism */

test('one finding is reported once, however many keys produced it', () => {
  const crash = "Cannot read properties of undefined (reading '15')";
  const result = judgeInteraction({
    pageErrors: Array.from({ length: 5 }, () => crash),
    probeAfterInput: LIVE,
  });
  assert.equal(result.reasons.length, 1, 'five copies of one exception are one reason');
  assert.match(result.reasons[0], /reading '15'/);
});

test('the verdict is deterministic and never mutates its input', () => {
  const input = {
    consoleErrors: [BENIGN_CONSOLE[0].sample],
    pageErrors: [],
    probeAfterInput: { ...LIVE },
    status: 200,
    httpErrors: [{ status: 404, url: 'https://cdn.example.com/x.png', sameOrigin: false }],
  };
  const before = JSON.stringify(input);
  const first = judgeInteraction(input);
  for (let i = 0; i < 4; i++) assert.deepEqual(judgeInteraction(input), first);
  assert.equal(JSON.stringify(input), before, 'judgeInteraction must not write to its input');

  // Reasons are ordered, not a Set: the same failure always reads the same way.
  const failing = { pageErrors: ['boom'], consoleErrors: ['bad'], probeAfterInput: DEAD, status: 200 };
  assert.deepEqual(judgeInteraction(failing).reasons, judgeInteraction({ ...failing }).reasons);
});
