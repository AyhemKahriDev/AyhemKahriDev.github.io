/**
 * Smoke test: load every page in headless Chrome, play each game for a second,
 * and fail on any console error or blank canvas.
 *
 *   node scripts/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, '.smoke');
const port = 4179;

function findChrome() {
  const base = join(homedir(), '.cache/hyperframes/chrome/chrome-headless-shell');
  if (existsSync(base)) {
    for (const v of readdirSync(base)) {
      const p = join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  for (const p of [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome found. Run: npx hyperframes browser ensure');
}

const server = spawn(process.execPath, [join(root, 'scripts/serve-dist.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error('server did not start');
}

const PAGES = [
  { path: '/', name: 'home', expectCanvas: false },
  { path: '/categories/puzzle/', name: 'category-puzzle', expectCanvas: false },
  { path: '/daily/', name: 'daily-archive', expectCanvas: false },
  { path: '/games/wordsearch/', name: 'game-wordsearch', expectCanvas: true },
  { path: '/games/merge/', name: 'game-merge', expectCanvas: true },
  { path: '/games/snake/', name: 'game-snake', expectCanvas: true },
  { path: '/games/memory/', name: 'game-memory', expectCanvas: true },
];

async function main() {
  await waitForServer();
  mkdirSync(shots, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  });

  const failures = [];

  for (const target of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 2 });

    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));

    const url = `http://localhost:${port}${target.path}`;
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    if (!res || res.status() >= 400) errors.push(`status ${res?.status()}`);

    if (target.expectCanvas) {
      // Start the round, then play for a moment.
      const play = await page.$('[data-act="play"]');
      if (!play) errors.push('no play button');
      else {
        await play.click();
        await sleep(400);
        const canvas = await page.$('#game');
        if (canvas) {
          const box = await canvas.boundingBox();
          if (box) {
            // Swipe/drag across the middle of the board.
            await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 8 });
            await page.mouse.up();
          }
        }
        await sleep(700);

        const painted = await page.evaluate(() => {
          const c = document.querySelector('#game');
          if (!c) return 0;
          const ctx = c.getContext('2d');
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let nonEmpty = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonEmpty++;
          return nonEmpty;
        });
        if (painted < 500) errors.push(`canvas looks blank (${painted} px)`);

        const hud = await page.$eval('#hud', (el) => el.textContent?.trim() ?? '');
        if (!hud) errors.push('hud empty');
      }
    }

    await page.screenshot({ path: join(shots, `${target.name}.png`), fullPage: !target.expectCanvas });
    await page.close();

    if (errors.length) {
      failures.push({ page: target.path, errors });
      console.log(`FAIL  ${target.path}`);
      errors.forEach((e) => console.log(`      ${e}`));
    } else {
      console.log(`ok    ${target.path}`);
    }
  }

  // Canonical + basic SEO assertions on the home page.
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
  const seo = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? '',
    h1: document.querySelectorAll('h1').length,
    jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
  }));
  console.log('\nSEO check:', JSON.stringify(seo, null, 2));
  if (!seo.title || !seo.desc || !seo.canonical || seo.h1 !== 1) {
    failures.push({ page: '/', errors: ['seo assertions failed'] });
  }
  await page.close();

  await browser.close();
  server.kill();

  if (failures.length) {
    console.error(`\n${failures.length} page(s) failed`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed');
}

main().catch((err) => {
  console.error(err);
  server.kill();
  process.exit(1);
});
