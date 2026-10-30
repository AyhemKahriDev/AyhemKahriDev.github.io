/**
 * `judgeGame` is the one rule the harvest validator and the post-build audit
 * share, so a change here changes what the site publishes. These cases pin the
 * distinction that cost a CI run: the runner has no audio device.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { judgeGame } from '../scripts/embed-health.mjs';

const live = { pixels: 0, textLen: 200, controls: 3, canvases: 1, webgl: false };

test('a game whose only complaint is the missing audio device is healthy', () => {
  const verdict = judgeGame({
    failed: [],
    jsErrors: ["AbortError: Unable to load a worklet's module."],
    status: 200,
    probe: live,
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.reasons));
});

test('a p5.sound game that cannot start here is unverified, not dead', () => {
  // Headless has no audio device; the worklet AbortError cascades into an empty
  // frame. Neither "healthy" nor "broken" can be claimed from this runner, so
  // the record says so - and the audit does not fail the build on it.
  const verdict = judgeGame({
    failed: [],
    jsErrors: ["AbortError: Unable to load a worklet's module."],
    status: 200,
    probe: { pixels: 0, textLen: 0, controls: 0, canvases: 0, webgl: false },
  });
  assert.equal(verdict.ok, true);
  assert.match(verdict.unverified, /audio device/);
});

test('an empty page with no audio error is dead', () => {
  const verdict = judgeGame({
    failed: [],
    jsErrors: ['TypeError: boom'],
    status: 200,
    probe: { pixels: 0, textLen: 0, controls: 0, canvases: 0, webgl: false },
  });
  assert.equal(verdict.ok, false);
});

test('an ordinary JavaScript error fails a live page', () => {
  const verdict = judgeGame({
    failed: [],
    jsErrors: ['TypeError: cannot read properties of undefined'],
    status: 200,
    probe: live,
  });
  assert.equal(verdict.ok, false);
});

test('a missing script fails whatever the audio did', () => {
  const verdict = judgeGame({
    failed: ['404 http://x/third-party/y/main.js'],
    jsErrors: [],
    status: 200,
    probe: live,
  });
  assert.equal(verdict.ok, false);
});
