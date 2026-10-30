/**
 * The sanitizer is the only place a vendored page is edited before it ships, so
 * every transform in it needs a test: a rule that is wrong here breaks 550
 * games at once, silently, in the build.
 *
 * This file covers the comment-widget rule. A published page was loading
 * `assets/js/comments.js`, a module that fetches a third-party SDK over the
 * network; the site's CSP refuses it, so the page logged an error on every
 * visit (and the smoke gate - "fail on any console error" - was right to fail
 * it). The widget is not part of the game and cannot work behind our policy,
 * so the include is dropped at build time.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeHtml } from '../scripts/sanitize-embed.mjs';

const page = (body) => `<!doctype html><html><head>${body}</head><body><canvas id="c"></canvas></body></html>`;

test('a comment-widget script include is removed', () => {
  const html = page('<script src="assets/js/comments.js"></script><script src="assets/js/game.js"></script>');
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(out.includes('comments.js'), false);
  assert.equal(out.includes('game.js'), true);
  assert.equal(changes.widget, 1);
});

test('the rule follows the file name, not the folder or a query string', () => {
  const variants = [
    '<script src="comments.js"></script>',
    '<script src="./js/Comments.js?v=3"></script>',
    '<script src="../shared/comment-widget.min.js"></script>',
    "<script type='text/javascript' src='js/comments.js' defer></script>",
  ];
  for (const tag of variants) {
    const { html: out, changes } = sanitizeHtml(page(tag));
    assert.equal(changes.widget, 1, `not stripped: ${tag}`);
    assert.equal(/comments?|comment-widget/i.test(out), false, `left behind: ${tag}`);
  }
});

test('a game script whose name only looks similar is kept', () => {
  const html = page('<script src="js/comets.js"></script><script src="js/commentary-engine.js"></script>');
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(changes.widget, 0);
  assert.equal(out.includes('comets.js'), true);
  assert.equal(out.includes('commentary-engine.js'), true);
});

test('external comment hosts are stripped even when the tag names them directly', () => {
  const html = page('<script src="https://giscus.app/client.js"></script><script src="https://cdn.jsdelivr.net/x.js"></script>');
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(out.includes('giscus.app'), false);
  assert.equal(out.includes('jsdelivr'), true, 'a plain CDN tag is not this rule\'s business');
  assert.equal(changes.widget, 1);
});

test('an inline script tag that merely mentions comments is untouched', () => {
  const html = page('<script>var comments = [];</script>');
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(changes.widget, 0);
  assert.equal(out.includes('var comments = []'), true);
});

test('the inline initialiser goes with the module it calls', () => {
  const html = page(
    `<script src="assets/js/comments.js"></script>
     <script>document.addEventListener('DOMContentLoaded', () => { FleaComments.init('shudu'); });</script>
     <script>var keepMe = 1;</script>`,
  );
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(out.includes('FleaComments'), false);
  assert.equal(out.includes('keepMe'), true, 'an unrelated inline script stays');
  assert.equal(changes.widget, 2);
});

test('an inline script mentioning the widget is untouched when no widget include was stripped', () => {
  const html = page('<script>var FleaComments = { stub: true };</script>');
  const { html: out, changes } = sanitizeHtml(html);
  assert.equal(changes.widget, 0);
  assert.equal(out.includes('stub: true'), true);
});

test('a page with no comment widget reports zero changes', () => {
  const { changes } = sanitizeHtml(page('<script src="js/main.js"></script>'));
  assert.equal(changes.widget, 0);
});
