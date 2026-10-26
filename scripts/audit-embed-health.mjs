/**
 * Health audit for the published third-party embeds.
 *
 *   node scripts/audit-embed-health.mjs [--json]
 *
 * The harvest validator checks a vendored repo's `index.html`. That is not
 * always the file the catalogue publishes, and its "alive" test is lenient
 * enough that a game whose main script 404s still passes (a <canvas> element
 * plus some static text is enough).
 *
 * This script tests what a player actually loads: the exact `embed.src` from
 * the catalogue, served from the built site. A game is dead when
 *
 *   - a same-origin script or stylesheet failed to load, or
 *   - it painted nothing and shows no playable text, or
 *   - it threw a fatal JavaScript error.
 *
 * Exits non-zero when a dead game is published, so a broken catalogue cannot
 * be deployed.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome as findChromeImpl } from './chrome.mjs';
import { judgeGame } from './embed-health.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number(process.env.AUDIT_PORT ?? 4181);

/**
 * Where to check.
 *
 * By default the built site is served from dist/ and checked. Point
 * AUDIT_ORIGIN at a live URL to run the same gate against production:
 *
 *   AUDIT_ORIGIN=https://arcadefork.pages.dev node scripts/audit-embed-health.mjs
 */
const liveOrigin = process.env.AUDIT_ORIGIN?.replace(/\/+$/, '') ?? null;

const curated = JSON.parse(readFileSync(join(root, 'content/games.json'), 'utf8'));
const generatedPath = join(root, 'content/games.generated.json');
const generated = existsSync(generatedPath)
  ? JSON.parse(readFileSync(generatedPath, 'utf8'))
  : { games: [] };
const GAMES = [...curated.games, ...(generated.games ?? generated)];

function findChrome() {
  return findChromeImpl();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  return false;
}

async function main() {
  if (!existsSync(dist)) {
    console.error('audit-embed-health: dist/ is missing — run `npm run build` first');
    process.exit(1);
  }

  const server = liveOrigin
    ? null
    : spawn(process.execPath, [join(root, 'scripts/serve-dist.mjs')], {
        env: { ...process.env, PORT: String(port) },
        stdio: 'ignore',
      });
  if (!liveOrigin && !(await waitForServer())) {
    server.kill();
    throw new Error('static server never came up');
  }

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const origin = liveOrigin ?? `http://localhost:${port}`;
  const results = [];

  // `node scripts/audit-embed-health.mjs <id> [<id>...]` checks only the
  // named games - useful when iterating on a single one.
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targets = only.length
    ? GAMES.filter((g) => g.embed?.src && only.includes(g.id))
    : GAMES.filter((g) => g.embed?.src);

  /**
   * Check one game. Split out of the loop so several can run at once: a
   * single-threaded sweep is dominated by navigations and settle delays
   * (27 s for 15 games on a warm machine), and four at a time brings the same
   * 15 to 7 s and all 149 games to about 1 m 50 s.
   */
  async function check(g, order) {
    process.stdout.write(`\r  ${order + 1}/${targets.length} ${g.id}          `);
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    const failed = [];
    const jsErrors = [];
    let docStatus = 0;
    // A game that opens an alert() blocks the page until it is dismissed.
    // Left alone it looks like a hang.
    page.on('dialog', async (d) => {
      try {
        await d.dismiss();
      } catch {
        /* the page may be gone */
      }
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith(origin)) failed.push(`${r.status()} ${r.url()}`);
    });
    page.on('requestfailed', (r) => {
      const err = r.failure()?.errorText ?? '';
      // A media download that is still running when the page closes is
      // aborted, not missing. Only a real failure counts.
      if (err.includes('ERR_ABORTED')) return;
      if (r.url().startsWith(origin)) failed.push(`failed ${r.url()}`);
    });
    page.on('pageerror', (e) => jsErrors.push(String(e.message ?? e)));

    let probe = { pixels: 0, textLen: 0, controls: 0, canvases: 0 };
    const navWarnings = [];
    try {
      // A cold, loaded CI runner can miss one 20s window on a game that is
      // perfectly fine locally, so a timeout gets one bounded retry. Any
      // other navigation error (DNS, refused, 404) is real and fails at once.
      // If both attempts time out there is no committed document to probe -
      // page.evaluate() on a page that never navigated waits forever - so the
      // timeout itself becomes the verdict.
      let res = null;
      let retried = false;
      for (let attempt = 1; attempt <= 2 && !res; attempt++) {
        try {
          res = await page.goto(origin + g.embed.src, {
            waitUntil: 'domcontentloaded',
            timeout: attempt === 1 ? 20000 : 30000,
          });
        } catch (err) {
          const msg = String(err?.message ?? err);
          if (!/timeout/i.test(msg)) throw err;
          if (attempt === 1) {
            retried = true;
            await sleep(1500);
          } else {
            throw new Error(`navigation timed out twice: ${msg.slice(0, 60)}`);
          }
        }
      }
      // Only a retry that actually succeeded is worth reporting: on a dead
      // page the timeout is already the verdict.
      if (retried) navWarnings.push('first navigation attempt timed out - retried once');
      docStatus = res?.status() ?? 0;
      await sleep(1200);
      // Many games wait for a click before they draw, and many of them want
      // a name before they start. Start one if the page offers a start
      // button, so a game behind a start screen is not mistaken for a dead
      // game.
      const started = await page.evaluate(() => {
        // An author's promo modal covers the game until it is dismissed.
        const modal = document.querySelector('.swal2-container, .swal2-popup, .modal.show');
        const modalBtn = modal?.querySelector('.swal2-confirm, .swal2-cancel, .btn-close, button');
        if (modalBtn) {
          modalBtn.click();
          return true;
        }
        for (const input of document.querySelectorAll('input[type=text], input:not([type])')) {
          if (!input.value) {
            input.value = 'Player';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        const buttons = [...document.querySelectorAll('button, [role=button], input[type=button], input[type=submit]')];
        const start = buttons.find((b) => /start|play|begin|new game|launch/i.test(b.innerText || b.value || ''));
        if (!start) return false;
        start.click();
        return true;
      });
      if (started) {
        // Some games count down before they start. Give them time to.
        await sleep(4000);
      }
      try {
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
        await sleep(400);
      } catch {
        /* not focusable */
      }
      probe = await page.evaluate(() => {
        const canvases = [...document.querySelectorAll('canvas')];
        let pixels = 0;
        for (const c of canvases) {
          try {
            const ctx = c.getContext('2d');
            if (!ctx) continue;
            const d = ctx.getImageData(0, 0, Math.min(c.width, 800), Math.min(c.height, 800)).data;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) pixels++;
          } catch {
            /* tainted or webgl canvas */
          }
        }
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        return {
          pixels,
          textLen: text.length,
          controls: document.querySelectorAll('button, a, input, [role=button]').length,
          canvases: canvases.length,
        };
      });
    } catch (err) {
      jsErrors.push(`navigation: ${String(err.message ?? err).slice(0, 90)}`);
    }
    // Closing a page whose target the browser already dropped throws. That is
    // not a finding about the game, and it must never abort the audit.
    try {
      await page.close();
    } catch {
      /* target already gone */
    }

    // One rule for "is this a working game?", shared with the harvest
    // validator so the two can never disagree.
    const verdict = judgeGame({ failed, jsErrors, status: docStatus, probe });

    results.push({
      order,
      id: g.id,
      title: g.title,
      src: g.embed.src,
      verdict: verdict.ok ? 'ok' : 'DEAD',
      problems: verdict.reasons,
      warnings: [...verdict.warnings, ...navWarnings],
      detail: { ...probe, failed: failed.slice(0, 6), jsErrors: jsErrors.slice(0, 3) },
    });
  }

  /* Four pages at a time is enough to keep the browser busy waiting on
     navigations; more just competes for the same CPU and makes the 20s
     timeouts flaky on a loaded runner. Override with AUDIT_JOBS. */
  const jobs = Math.min(targets.length, Math.max(1, Number(process.env.AUDIT_JOBS ?? 4) || 4));
  let next = 0;
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (next < targets.length) {
        const i = next++;
        try {
          await check(targets[i], i);
        } catch (err) {
          results.push({
            order: i,
            id: targets[i].id,
            title: targets[i].title,
            src: targets[i].embed.src,
            verdict: 'DEAD',
            problems: [`the check itself failed: ${String(err?.message ?? err).slice(0, 90)}`],
            warnings: [],
            detail: { failed: [], jsErrors: [] },
          });
        }
      }
    }),
  );
  results.sort((a, b) => a.order - b.order);

  await browser.close().catch(() => undefined);
  server?.kill();

  const dead = results.filter((r) => r.verdict === 'DEAD');
  const warned = results.filter((r) => r.warnings?.length);
  if (process.argv.includes('--json')) {
    const strip = (r) => {
      const { order, ...rest } = r;
      return rest;
    };
    console.log(
      JSON.stringify({ total: results.length, dead: dead.map(strip), warned: warned.map(strip) }, null, 2),
    );
  } else {
    console.log(
      `audit-embed-health: ${results.length} embedded games, ${dead.length} dead, ${warned.length} with warnings`,
    );
    for (const d of dead) {
      console.log(`  DEAD ${d.id} (${d.src})`);
      for (const p of d.problems) console.log(`        - ${p}`);
      for (const f of d.detail.failed) console.log(`        ! ${f}`);
      for (const e of d.detail.jsErrors) console.log(`        ! ${e}`);
    }
    for (const w of warned) {
      console.log(`  WARN ${w.id}`);
      for (const p of w.warnings) console.log(`        - ${p}`);
    }
  }
  if (dead.length) process.exit(1);
}

main().catch((err) => {
  console.error('audit-embed-health:', err);
  process.exit(1);
});
