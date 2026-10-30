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

test('the same throw on a page that never came to life is still a failure', () => {
  const verdict = judgeGame({
    failed: [],
    jsErrors: ["AbortError: Unable to load a worklet's module."],
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
