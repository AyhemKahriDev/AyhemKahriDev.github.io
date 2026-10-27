/**
 * Phone check — the half of the site a desktop smoke test cannot see.
 *
 *   node scripts/mobile-check.mjs
 *
 * A phone is not a small desktop: the pointer is a thumb, the viewport has a
 * notch, and a downward swipe at the top of the page belongs to the browser.
 * This asserts the three things that made Tetris unplayable on a phone:
 *
 *   - the page cannot be pulled down to refresh,
 *   - a swipe on the game steers instead of scrolling,
 *   - the pad exists, is thumb-sized, and actually delivers a key to the game.
 *
 * Screenshots land in .smoke/mobile-<game>.png as evidence.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome } from './chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, '.smoke');
const port = 4180;
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const catalogue = readJson('content/games.json');
const generated = existsSync(join(root, 'content/games.generated.json'))
  ? readJson('content/games.generated.json')
  : { games: [] };
const embeds = [...catalogue.games, ...(generated.games ?? [])].filter((g) => g.embed);

// The curated keyboard game that broke on the phone, plus two harvested ones.
const TARGETS = ['tetris']
  .concat(embeds.filter((g) => g.id !== 'tetris' && g.mobile !== 'native').slice(0, 2).map((g) => g.id))
  .filter((id) => embeds.some((g) => g.id === id));

const server = spawn(process.execPath, [join(root, 'scripts/serve-dist.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error('server did not start');
}

/** The frame has to be same-origin and parsed before anything can be injected. */
async function waitForFrame(page) {
  await page.waitForFunction(
    () => {
      const f = document.getElementById('af-frame');
      try {
        return Boolean(f && f.contentDocument && f.contentDocument.body);
      } catch {
        return false;
      }
    },
    { timeout: 40000 },
  );
}

async function checkPhone(browser, id) {
  const fails = [];
  const page = await browser.newPage();
  page.on('pageerror', (e) => fails.push(`page error: ${String(e).slice(0, 120)}`));

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/games/${id}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  try {
    await waitForFrame(page);
    // The gesture handlers are attached to the frame's live document; give
    // them the same moment the player would.
    await page.waitForFunction(
      () => {
        const f = document.getElementById('af-frame');
        try {
          return Boolean(f && f.contentDocument && f.contentDocument.__afGestures);
        } catch {
          return false;
        }
      },
      { timeout: 15000 },
    );
  } catch {
    fails.push('game frame never loaded or never took the gestures');
  }

  const state = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const pad = document.getElementById('af-pad');
    const key = pad && pad.querySelector('.af-key');
    const box = key ? key.getBoundingClientRect() : null;
    return {
      htmlOverscroll: html.overscrollBehaviorY,
      bodyOverscroll: bodyStyle.overscrollBehaviorY,
      htmlOverflow: html.overflowY,
      immersive: document.body.classList.contains('is-immersive'),
      padOn: Boolean(pad) && !pad.classList.contains('is-off'),
      keySize: box ? [Math.round(box.width), Math.round(box.height)] : null,
      toggle: Boolean(document.getElementById('af-pad-toggle')),
      full: Boolean(document.getElementById('af-full')),
      exit: Boolean(document.getElementById('af-exit')),
      scrollY: window.scrollY,
    };
  });

  if (state.htmlOverscroll !== 'none') fails.push(`html overscroll-behavior: ${state.htmlOverscroll}`);
  if (state.bodyOverscroll !== 'none') fails.push(`body overscroll-behavior: ${state.bodyOverscroll}`);
  if (!state.immersive) fails.push('page did not go immersive on a phone');
  if (state.htmlOverflow !== 'hidden') fails.push(`page not scroll-locked (overflow-y: ${state.htmlOverflow})`);
  if (!state.padOn) fails.push('no on-screen pad');
  if (!state.keySize || state.keySize[0] < 40 || state.keySize[1] < 40) {
    fails.push(`pad targets too small: ${JSON.stringify(state.keySize)}`);
  }
  if (!state.toggle) fails.push('no pad toggle in the bar');
  if (!state.full) fails.push('no fullscreen button in the bar');
  if (!state.exit) fails.push('no exit button while immersive');

  // Listen on the game window in the capture phase: a game that calls
  // stopImmediatePropagation in its own key handler (many do) would otherwise
  // hide the very events this is checking for.
  await page.evaluate(() => {
    window.__afKeys = [];
    const f = document.getElementById('af-frame');
    try {
      f.contentWindow.addEventListener('keydown', (e) => window.__afKeys.push(e.keyCode), true);
    } catch {
      /* the assertion below will fail, which is the point */
    }
  });

  const aKey = await page.evaluate(() => {
    const b = document.querySelector('#af-pad [data-k="a"]');
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  // A lazy frame can swallow the first tap while it settles, so allow a retry:
  // the assertion is "the pad delivers a key", not "one tap is always enough".
  let keys = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.touchscreen.tap(aKey.x, aKey.y);
    await sleep(350);
    keys = await page.evaluate(() => window.__afKeys || []);
    if (keys.includes(32)) break;
  }
  if (!keys.includes(32)) fails.push(`pad A delivered ${JSON.stringify(keys)}, expected Space(32)`);

  // A swipe down: steering, not a page refresh.
  const before = await page.evaluate(() => window.scrollY);
  const urlBefore = page.url();
  await page.touchscreen.touchStart(195, 360);
  for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(195, 360 + i * 14);
  await page.touchscreen.touchEnd();
  await sleep(300);
  const after = await page.evaluate(() => window.scrollY);
  keys = await page.evaluate(() => window.__afKeys || []);
  if (after !== before) fails.push(`swipe scrolled the page: ${before} -> ${after}`);
  if (page.url() !== urlBefore) fails.push('swipe navigated away from the game');
  if (!keys.includes(40)) fails.push(`swipe down delivered ${JSON.stringify(keys)}, expected ArrowDown(40)`);

  await page.screenshot({ path: join(shots, `mobile-${id}.png`) });
  await page.close();
  return fails;
}

async function checkDesktop(browser, id) {
  const fails = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/games/${id}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(600);
  const state = await page.evaluate(() => {
    const pad = document.getElementById('af-pad');
    return {
      immersive: document.body.classList.contains('is-immersive'),
      padOn: Boolean(pad) && !pad.classList.contains('is-off'),
      rail: Boolean(document.querySelector('.game-side')),
    };
  });
  if (state.immersive) fails.push('desktop opened in immersive mode');
  if (state.padOn) fails.push('pad appeared on a desktop by itself');
  if (!state.rail) fails.push('desktop lost the side rail');
  await page.close();
  return fails;
}

async function main() {
  await waitForServer();
  mkdirSync(shots, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  });

  let failed = 0;
  for (const id of TARGETS) {
    const phone = await checkPhone(browser, id);
    const desktop = await checkDesktop(browser, id);
    const fails = [...phone, ...desktop];
    console.log(`${fails.length ? 'FAIL' : 'ok  '} ${id}${fails.length ? '' : ' — phone + desktop'}`);
    for (const f of fails) console.log(`     ${f}`);
    if (fails.length) failed++;
  }

  await browser.close();
  server.kill();
  console.log(failed ? `\n${failed}/${TARGETS.length} phone checks failed` : `\n${TARGETS.length} phone checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  server.kill();
  console.error(err);
  process.exit(1);
});
