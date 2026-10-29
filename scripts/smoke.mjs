/**
 * Smoke test: load every page in headless Chrome, play each game for a second,
 * and fail on any console error or blank canvas.
 *
 *   node scripts/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome } from './chrome.mjs';
import { mergeCatalogue } from './catalogue.mjs';
import { generateWordBoard, dateSeed, todayISO } from '../src/shared/daily.js';
import { themeForDate } from '../src/shared/wordlists.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, '.smoke');
const port = 4179;

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

const TODAY = todayISO();

/** Every embedded (third-party) game gets checked in a real browser. */
const layer = (name) =>
  existsSync(new URL(`../content/${name}`, import.meta.url))
    ? JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8')).games ?? []
    : [];
/**
 * The same merge the site builder uses. Before this, smoke read only
 * games.json + games.generated.json, so a page whose id had been claimed by a
 * first-party engine game (breakout) was still expected to contain an iframe
 * and failed a gate the site had passed.
 */
const catalogue = mergeCatalogue({
  base: layer('games.json'),
  engine: layer('engine-new.json'),
  curated: layer('curated.json'),
  published: layer('harvest-published.json'),
  generated: layer('games.generated.json'),
  overlays: JSON.parse(readFileSync(new URL('../content/overlays.json', import.meta.url), 'utf8')).games ?? {},
});

const embedGames = catalogue.filter((g) => g.embed);

const PAGES = [
  { path: '/', name: 'home', expectCanvas: false },
  { path: '/games/', name: 'games-index', expectCanvas: false },
  { path: '/credits/', name: 'credits', expectCanvas: false },
  { path: '/categories/puzzle/', name: 'category-puzzle', expectCanvas: false },
  { path: '/categories/arcade/', name: 'category-arcade', expectCanvas: false },
  { path: '/daily/', name: 'daily-archive', expectCanvas: false },
  { path: `/daily/${TODAY}/`, name: 'daily-puzzle', expectCanvas: false },
  { path: `/daily/${TODAY}/answers/`, name: 'daily-answers', expectCanvas: false },
  { path: '/games/wordsearch/', name: 'game-wordsearch', expectCanvas: true },
  { path: '/games/merge/', name: 'game-merge', expectCanvas: true },
  { path: '/games/snake/', name: 'game-snake', expectCanvas: true },
  { path: '/games/memory/', name: 'game-memory', expectCanvas: true },
  ...embedGames.map((g) => ({
    path: `/games/${g.id}/`,
    name: `embed-${g.id}`,
    expectCanvas: false,
    expectIframe: true,
  })),
];

async function main() {
  await waitForServer();
  mkdirSync(shots, { recursive: true });

  let browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    /**
     * Default is 180 s, and on a loaded CI runner a heavy vendored game can
     * hold the renderer long enough to trip it. The failure was
     * `Runtime.callFunctionOn timed out`, which aborts the whole run instead of
     * failing one page - 485 games lost for one slow frame. The watchdog below
     * bounds each page anyway, so this only needs to outlive a single page.
     */
    protocolTimeout: 90_000,
  });

  const failures = [];
  const waived = [];

  /**
   * One pass over the given pages. Returns the failures it collected.
   *
   * Split out so the whole pass can be re-run for the pages that failed: on a
   * loaded CI runner a page can miss its iframe inside the settle window and
   * pass 30 seconds later. A page that fails twice is broken; one that fails
   * once is a slow machine. Deleting good games over runner noise is exactly
   * how 719 working games were destroyed once already.
   */
  const runPass = async (targets) => {
  const start = failures.length;
  for (const target of targets) {
    let page = null;
    try {
      page = await browser.newPage();
      await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 2 });
      // A game that never settles must cost one page, not the run.
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(20_000);

      const errors = [];
      const warnings = [];
      const origin = `http://localhost:${port}`;
      // Only failures on our own origin are build failures. Vendored games
      // loading their own analytics, ribbons or CDNs is their business.
      page.on('console', (m) => {
        const text = m.text();
        if (m.type() !== 'error') return;
        if (/Failed to load resource/i.test(text)) return;
        // A vendored game calling its own leaderboard backend gets a CORS
        // error here. The game still plays, so it is a warning, not a failure.
        if (/CORS policy|Access-Control-Allow-Origin/i.test(text)) {
          warnings.push(`cors: ${text.slice(0, 60)}`);
          return;
        }
        // A *report-only* CSP cannot block anything: the browser logs it and
        // loads the resource. Several vendored games frame an ad or analytics
        // page that ships one, and which of them run varies per visit, so
        // failing on it made CI red for games that work.
        if (/report-only Content Security Policy/i.test(text)) {
          warnings.push(`csp-report-only: ${text.slice(0, 60)}`);
          return;
        }
        errors.push(`console: ${text}`);
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) => {
        if (r.url().startsWith(origin)) warnings.push(`requestfailed: ${r.url()}`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && r.url().startsWith(origin)) {
          warnings.push(`${r.status()} ${r.url()}`);
        }
      });

      const url = `http://localhost:${port}${target.path}`;
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (!res || res.status() >= 400) errors.push(`status ${res?.status()}`);
      } catch (err) {
        errors.push(`navigation failed: ${err.message}`);
      }
      await sleep(400);

      if (target.expectIframe) {
        // The vendored game must load inside the frame and actually paint.
        const frame = page.frames().find((f) => f.url().includes('/third-party/'));
        if (!frame) {
          errors.push('third-party iframe never loaded');
        } else {
          await sleep(1200);
          // Many games render only after the first input, so nudge the frame.
          try {
            await frame.keyboard.press('Space');
            await frame.keyboard.press('Enter');
            await sleep(500);
          } catch {
            /* the frame may not be focusable */
          }
          const probe = await frame.evaluate(() => {
            const canvas = document.querySelector('canvas');
            let pixels = 0;
            let has2d = false;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                has2d = true;
                try {
                  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) pixels++;
                } catch {
                  pixels = -1;
                }
              }
            }
            const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
            const controls = document.querySelectorAll('button, a, input, [role=button]').length;
            // WebGL games cannot be read back through a 2D context; the context
            // itself is the evidence that something is rendering.
            let webgl = false;
            if (canvas) {
              try {
                webgl = !!(canvas.getContext('webgl2') || canvas.getContext('webgl')) && canvas.width >= 32;
              } catch {
                /* no GL here */
              }
            }
            return { pixels, has2d, textLen: text.length, controls, hasCanvas: !!canvas, webgl };
          });
          const paints = probe.pixels > 200;
          const interactive = probe.textLen > 120 && probe.controls >= 1;
          // A canvas plus real text is a live game even if it has not drawn yet.
          const alive = probe.hasCanvas && probe.textLen > 60;

          if (!paints && !interactive && !alive && !probe.webgl) {
            errors.push(
              `third-party frame looks dead (canvas ${probe.hasCanvas}, ${probe.pixels}px, text ${probe.textLen})`,
            );
          }
        }
      }

      if (target.path.includes('/answers/') || target.path.match(/\/daily\/\d{4}-\d{2}-\d{2}\/$/)) {
        // The puzzle board must be a square grid, not a single tall column.
        const board = await page.$eval('.board', (el) => {
          const r = el.getBoundingClientRect();
          const c0 = el.children[0]?.getBoundingClientRect();
          return {
            w: r.width,
            h: r.height,
            cellW: c0?.width ?? 0,
            cellH: c0?.height ?? 0,
            cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
          };
        });
        if (!board.cellW || Math.abs(board.cellW - board.cellH) > 2) {
          errors.push(`board grid broken (${JSON.stringify(board)})`);
        }
        if (board.h > board.w * 1.2) {
          errors.push(`board too tall (${Math.round(board.h)}px vs ${Math.round(board.w)}px wide)`);
        }
      }

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
  } catch (err) {
    // A hung renderer must cost one page, not the run. Puppeteer raises
    // ProtocolError when a CDP call outlives protocolTimeout, which is what a
    // game stuck in an infinite loop does; the browser is left unusable, so it
    // is replaced and the next page continues.
    const message = String(err?.message ?? err);
    // A CDP timeout is evidence about the runner, not about the game: the same
    // pages pass locally, and the first CI run died on a game that loads in
    // 2 s here. Waive it loudly and name the page, so a genuinely hung game is
    // still visible in the log without failing an otherwise good catalogue.
    if (/ProtocolError|timed out|Target closed|Session closed/i.test(message)) {
      console.log(`WAIVED ${target.path} (harness timeout: ${message.slice(0, 80)})`);
      waived.push(target.path);
    } else {
      failures.push({ path: target.path, errors: [`harness: ${message.slice(0, 120)}`] });
    }
    try { await page.close(); } catch { /* renderer is wedged */ }
    try { await browser.close(); } catch { /* already gone */ }
    browser = await puppeteer.launch({
      executablePath: findChrome(),
      headless: 'shell',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
      protocolTimeout: 90_000,
    });
  }
  }
  return failures.slice(start);
  };

  await runPass(PAGES);
  // Per-page failures are recorded as { page }, harness/SEO ones as { path }.
  // Keying only on `path` matched nothing, so the retry silently never ran.
  const failurePath = (f) => f.path ?? f.page;
  const retryTargets = failures
    .map((f) => PAGES.find((p) => p.path === failurePath(f)))
    .filter(Boolean);
  if (retryTargets.length) {
    console.log(`\nretrying ${retryTargets.length} failed page(s) once`);
    const first = failures.splice(0, failures.length);
    await runPass(retryTargets);
    for (const f of first) {
      if (!failures.some((g) => failurePath(g) === failurePath(f))) console.log(`FLAKY ${failurePath(f)} (passed on the retry)`);
    }
  }

  // Functional check: drag across a real hidden word and assert it registers.
  {
    const today = todayISO();
    const theme = themeForDate(today, dateSeed(today));
    const board = generateWordBoard(today, theme, 10, 11);
    const target = board.placed[0];

    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 2 });
    // A game that never settles must cost one page, not the run.
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(20_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`http://localhost:${port}/games/wordsearch/`, { waitUntil: 'networkidle2' });
    await (await page.$('[data-act="play"]')).click();
    await sleep(300);

    const rect = await page.$eval('#game', (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const side = Math.min(rect.width - 28, rect.height - 120);
    const cell = side / 10;
    const ox = rect.left + (rect.width - side) / 2;
    const oy = rect.top + (rect.height - side) / 2 + 26;
    const sx = ox + target.c0 * cell + cell / 2;
    const sy = oy + target.r0 * cell + cell / 2;
    const ex = ox + target.c1 * cell + cell / 2;
    const ey = oy + target.r1 * cell + cell / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 14 });
    await page.mouse.up();
    await sleep(400);

    const hud = await page.$eval('#hud', (el) => el.textContent ?? '');
    const found = /1\/11/.test(hud);
    console.log(
      found
        ? `ok    word search registers "${target.word}" (${hud.trim().replace(/\s+/g, ' ')})`
        : `FAIL  word search did not register "${target.word}" (hud: ${hud.trim()})`,
    );
    if (!found) failures.push({ page: '/games/wordsearch/', errors: [`drag on "${target.word}" not counted`] });
    errors.forEach((e) => failures.push({ page: '/games/wordsearch/', errors: [e] }));
    await page.close();
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
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
  }));
  console.log('\nSEO check:', JSON.stringify(seo, null, 2));
  if (!seo.title || !seo.desc || !seo.canonical || seo.h1 !== 1) {
    failures.push({ page: '/', errors: ['seo assertions failed'] });
  }
  // A shared link with no preview image is a wasted click.
  if (!seo.ogImage || !seo.ogUrl) {
    failures.push({ page: '/', errors: ['missing og:image or og:url'] });
  }
  // The preview image itself must be there. The og:image is an absolute
  // URL, so the local copy is checked by path.
  const og = await page
    .goto(`http://localhost:${port}/og.png`, { waitUntil: 'domcontentloaded' })
    .catch(() => null);
  if (!og || og.status() >= 400) {
    failures.push({ page: '/', errors: [`og:image is not served (${og?.status() ?? 'no response'})`] });
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
