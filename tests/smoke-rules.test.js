/**
 * A gate is only useful if "red" means "broken". Each case here is a failure
 * that was reported on a page that works, so the classifier has to keep saying
 * benign - and keep saying defect for everything it was not taught.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIO_ENV,
  classifyConsoleError,
  isAudioOnly,
  classifyPageError,
  errorVerdict,
} from '../scripts/smoke-rules.mjs';

test('the autoplay policy is not a page defect', () => {
  const verdict = classifyPageError({
    name: 'NotAllowedError',
    message: "play() failed because the user didn't interact with the document first.",
  });
  assert.deepEqual(verdict, { benign: true, reason: 'autoplay-policy' });
});

test('the same error still counts when the browser prefixes the name into the message', () => {
  // Puppeteer hands the error over as a plain Error whose message carries the
  // DOMException string; the gate saw exactly this on radius-raid and failed a
  // game that plays fine.
  const verdict = classifyPageError({
    name: 'Error',
    message: "NotAllowedError: play() failed because the user didn't interact with the document first.",
  });
  assert.deepEqual(verdict, { benign: true, reason: 'autoplay-policy' });
});

test('a NotAllowedError that is not about playback stays a defect', () => {
  const verdict = classifyPageError({
    name: 'NotAllowedError',
    message: 'The request is not allowed by the user agent or the platform.',
  });
  assert.equal(verdict.benign, false);
});

test('a real page error stays a defect', () => {
  for (const error of [
    { name: 'TypeError', message: "Cannot read properties of undefined (reading '10')" },
    { name: 'ReferenceError', message: 'foo is not defined' },
    { name: '', message: 'Uncaught SyntaxError' },
    {},
  ]) {
    assert.equal(classifyPageError(error).benign, false, JSON.stringify(error));
  }
});

test('an audio-device failure is a runner limitation, named as such', () => {
  assert.equal(AUDIO_ENV.test("pageerror: AbortError: Unable to load a worklet's module."), true);
  assert.equal(AUDIO_ENV.test('pageerror: loadSound is not defined'), false);
});

test('a frame stuck on its loading screen because of audio is waived, not failed', () => {
  assert.equal(
    isAudioOnly([
      "pageerror: AbortError: Unable to load a worklet's module.",
      'third-party frame looks dead (canvas false, 0px, text 10)',
    ]),
    true,
  );
  // one unrelated error keeps it a failure
  assert.equal(
    isAudioOnly([
      "pageerror: AbortError: Unable to load a worklet's module.",
      'pageerror: Cannot read properties of undefined (reading 10)',
    ]),
    false,
  );
  assert.equal(isAudioOnly([]), false);
});

test('errors on a page that renders and responds are not fatal', () => {
  assert.deepEqual(errorVerdict({ alive: true }).fatal, false);
  assert.deepEqual(errorVerdict({ alive: false }).fatal, true);
});

test('console noise that is not ours is a warning', () => {
  assert.deepEqual(classifyConsoleError('Failed to load resource: 404'), {
    benign: true,
    reason: 'resource-load',
  });
  assert.deepEqual(
    classifyConsoleError("Access to fetch has been blocked by CORS policy: No 'Access-Control-Allow-Origin'"),
    { benign: true, reason: 'cors' },
  );
  assert.deepEqual(
    classifyConsoleError('The Content Security Policy directive was delivered in a report-only policy.'),
    { benign: true, reason: 'csp-report-only' },
  );
  assert.deepEqual(
    classifyConsoleError('report-only Content Security Policy: frame-src blocklisted'),
    { benign: true, reason: 'csp-report-only' },
  );
});

test('a console error the page caused is still a defect', () => {
  const verdict = classifyConsoleError(
    '[FleaComments] could not load DiversityComments SDK: https://huazie.github.io/js/x.js',
  );
  assert.equal(verdict.benign, false);
});
