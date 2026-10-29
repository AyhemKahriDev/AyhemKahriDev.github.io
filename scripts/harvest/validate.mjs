/**
 * Browser gate for harvested games, built for hundreds of them.
 *
 *   node scripts/harvest/validate.mjs [--workers 6] [--limit N] [--port 4191]
 *
 * Also accepted: --settle <ms> (default 2200), --verbose (print every retry and
 * browser relaunch), --work <dir> (read the reports from somewhere other than
 * .harvest/ - used by the smoke tests).
 *
 * Every vendored repo is opened in a real browser and judged with judgeGame()
 * from scripts/embed-health.mjs - the same rule the post-build audit uses, so
 * a game cannot pass here and be dead on the live site.
 *
 * Why a pool: a game needs ~2.2 s of settle time after load, and almost all of
 * that is waiting, not computing. At 500 games one page at a time is ~40
 * minutes; six pages in one browser brings it to ~10. One browser, many pages,
 * because each extra browser costs a process and a profile for no extra
 * throughput.
 *
 * Resumable: a slug whose .harvested.json already says `validated: true` is
 * skipped, and .harvest/validated.json is rewritten atomically after every
 * verdict, so a killed run loses at most the pages that were open.
 *
 * A `dead` game is deleted from third-party/. content/blocked.json is never
 * edited from here: the block list is a hand-curated record of repos that must
 * never be vendored again, and appending to it automatically would turn one
 * bad judgement on a slow machine into a permanent ban. Dead games that are
 * already on the list are reported as documented rejects; the rest are printed
 * so a human can decide.
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { findChrome } from '../chrome.mjs';
import { judgeGame } from '../embed-health.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const thirdParty = join(root, 'third-party');

/* --------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  return value === undefined ? fallback : value;
};
const verbose = argv.includes('--verbose');

const work = flag('work', process.env.HARVEST_DIR ?? join(root, '.harvest'));
const workers = Math.max(1, Math.min(32, Number(flag('workers', process.env.VALIDATE_WORKERS ?? 6)) || 6));
const limit = Number(flag('limit', 0)) || 0;
const port = String(flag('port', process.env.HARVEST_PORT ?? 4191));
const origin = `http://localhost:${port}`;
/** How long a page gets to paint after its document is ready. */
const SETTLE_MS = Number(flag('settle', process.env.VALIDATE_SETTLE ?? 2200));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chrome said goodbye: the page is not at fault and must be retried.
 *
 * The exact wording depends on where the page was when the browser died - a
 * navigation reports "Target closed", an evaluation reports "detached Frame",
 * a fresh page reports "Connection closed" - so this matches all of them. The
 * browser's own `connected` flag is the real authority; this is the fallback
 * for errors that arrive before the disconnect event does.
 */
const CONNECTION_DEAD =
  /Connection closed|Target closed|Session closed|browser has been closed|Protocol error|detached Frame|Page closed|frame was detached|Cannot find context|Execution context was destroyed|Target page, context or browser has been closed/i;

/* ---------------------------------------------------------------- I/O */

const readJson = (file, fallback) => {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/** Write through a temp file so a crash mid-write cannot leave corrupt JSON. */
function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

/** Repos are compared without punctuation or case, as the rest of the pipeline does. */
const normaliseRepo = (repo) => String(repo ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The page to open for a vendored game.
 *
 * vendor records the entry it discovered (`docs/index.html`, `game/index.html`,
 * ...). Games vendored before that existed only ever kept a root index.html,
 * which is the correct default. The path is treated as untrusted - it comes
 * from a JSON file on disk - so it must stay inside the game's folder.
 */
function entryOf(record, meta = {}) {
  const raw = String(record?.entry ?? meta.entry ?? 'index.html')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const segments = raw.split('/').filter(Boolean);
  if (!segments.length || segments.some((s) => s === '.' || s === '..')) return 'index.html';
  return segments.join('/');
}

/* ------------------------------------------------------------- server */

async function serverUp() {
  try {
    // Check a file that exists: the repo root has no index.html.
    const res = await fetch(`${origin}/package.json`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return null; // someone else's server, leave it alone
  const child = spawn(process.execPath, [join(root, 'scripts/serve-root.mjs')], {
    env: { ...process.env, PORT: port },
    stdio: 'ignore',
  });
  child.unref?.();
  for (let i = 0; i < 60; i++) {
    if (await serverUp()) return child;
    await sleep(200);
  }
  child.kill();
  throw new Error(`static server on :${port} never came up`);
}

/* ------------------------------------------------------------ browser */

let browser = null;
let launching = null;

const isAlive = (b) =>
  !!b && (typeof b.connected === 'boolean' ? b.connected : b.isConnected?.() !== false);

/**
 * One browser for the whole run.
 *
 * Concurrent workers all ask for the browser; only one launch may be in
 * flight or six workers would start six Chromes. A browser that died is
 * dropped and relaunched on the next request - the pool recovers instead of
 * turning every remaining game into a failure.
 */
async function getBrowser() {
  if (isAlive(browser)) return browser;
  if (!launching) {
    launching = puppeteer
      .launch({
        executablePath: findChrome(),
        headless: 'shell',
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
      .then((b) => {
        b.once('disconnected', () => {
          if (browser === b) browser = null;
        });
        browser = b;
        launching = null;
        return b;
      })
      .catch((err) => {
        launching = null;
        throw err;
      });
  }
  return launching;
}

/** A page that spins forever must not stall the run. */
function withTimeout(promise, ms, what) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);
}

/* --------------------------------------------------------------- probe */

/**
 * Open one game and judge it.
 *
 * Everything that could survive being handed to judgeGame() - failed
 * same-origin requests, JS errors, the document status, what actually painted
 * - is collected exactly as the post-build audit collects it.
 */
async function probe(slug, entry = 'index.html') {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const failed = [];
  const jsErrors = [];
  let status = 0;

  // A game that opens an alert() blocks the page until it is dismissed.
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(origin)) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    // A download still running when the page closes is aborted, not missing.
    if (err.includes('ERR_ABORTED')) return;
    if (r.url().startsWith(origin)) failed.push(`failed ${r.url()}`);
  });
  page.on('pageerror', (e) => jsErrors.push(String(e.message ?? e)));

  try {
    const res = await withTimeout(
      page.goto(encodeURI(`${origin}/third-party/${slug}/${entry}`), {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }),
      20000,
      'goto',
    );
    status = res?.status() ?? 0;

    // Games draw on a timer or on the first requestAnimationFrame; 2.2 s is
    // what the existing gate has always allowed.
    await sleep(SETTLE_MS);

    // Many games draw only after the first input.
    try {
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      await sleep(400);
    } catch {
      /* the page may not accept synthetic keys */
    }

    const result = await withTimeout(
      page.evaluate(() => {
        const canvases = [...document.querySelectorAll('canvas')];
        let pixels = 0;
        for (const canvas of canvases) {
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            // Sample the whole canvas: a corner sample misses games that draw
            // in the middle, which is most of them.
            const data = ctx.getImageData(0, 0, Math.min(canvas.width, 800), Math.min(canvas.height, 800)).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) pixels++;
          } catch {
            /* tainted or webgl canvas */
          }
        }
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const webgl = canvases.some((canvas) => {
          try {
            return !!((canvas.getContext('webgl2') || canvas.getContext('webgl')) && canvas.width >= 32 && canvas.height >= 32);
          } catch {
            return false;
          }
        });
        return {
          pixels,
          textLen: text.length,
          controls: document.querySelectorAll('button, a, input, [role=button]').length,
          canvases: canvases.length,
          webgl,
        };
      }),
      12000,
      'probe',
    );

    // One rule for "is this a working game?", shared with the post-build audit.
    const verdict = judgeGame({ failed, jsErrors, status, probe: result });
    return {
      verdict: verdict.ok ? 'pass' : 'dead',
      reason: verdict.ok ? (verdict.warnings[0] ?? '') : verdict.reasons.join('; ').slice(0, 160),
    };
  } finally {
    // Closing a page whose target the browser already dropped throws; that is
    // not a finding about the game.
    await page.close().catch(() => {});
  }
}

/**
 * Probe with one retry, for two different reasons kept apart on purpose:
 *
 *   - the browser died: relaunch and open the page again. Says nothing about
 *     the game, so a second death is inconclusive, not dead.
 *   - the page timed out: retry once. Twice in a row means it hangs for a real
 *     player too, so that is dead. Any other failure is inconclusive - the
 *     game stays on disk and gets picked up by the next pass.
 */
async function judgeSlug(v, { verbose = false } = {}) {
  const meta = readJson(join(thirdParty, v.slug, '.harvested.json'), {});
  const entry = entryOf(v, meta);
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await probe(v.slug, entry);
    } catch (err) {
      const message = String(err?.message ?? err);
      lastError = message;
      // A dead browser is conclusive regardless of the wording of the error:
      // whatever the page was doing, it did not get a fair test. The
      // disconnect handler usually nulls `browser` before we get here.
      const crashed = CONNECTION_DEAD.test(message) || !isAlive(browser);
      if (crashed) {
        if (attempt === 1) {
          if (verbose) process.stderr.write(`\n  browser died on ${v.slug} (${message.slice(0, 60)}) - relaunching\n`);
          // Drop the corpse so the next probe launches a fresh browser.
          browser = null;
          launching = null;
          await sleep(500);
          continue;
        }
        return { verdict: 'inconclusive', reason: `browser died twice: ${message.slice(0, 80)}` };
      }
      if (/timed out/i.test(message)) {
        if (attempt === 1) {
          if (verbose) process.stderr.write(`\n  ${v.slug} timed out once - retrying\n`);
          continue;
        }
        return { verdict: 'dead', reason: `page hung: ${message.slice(0, 80)}` };
      }
      return { verdict: 'inconclusive', reason: `load failed: ${message.slice(0, 100)}` };
    }
  }
  return { verdict: 'inconclusive', reason: `load failed: ${lastError.slice(0, 100)}` };
}

/* ---------------------------------------------------------------- main */

async function main() {
  const vendored = readJson(join(work, 'vendored.json'), []);
  if (!vendored.length) {
    console.error(`validate: ${join(work, 'vendored.json')} is empty or missing - run the vendor phase first`);
    process.exit(1);
  }

  const blocked = new Set(
    (readJson(join(root, 'content/blocked.json'), { repos: [] }).repos ?? []).map(normaliseRepo),
  );

  // Prior verdicts are kept: a run with --limit must not erase the rest.
  const previous = readJson(join(work, 'validated.json'), []);
  const resultsBySlug = new Map();
  for (const entry of previous) if (entry?.slug) resultsBySlug.set(entry.slug, entry);

  const queue = [];
  const resumed = [];
  for (const v of vendored) {
    if (!v?.slug) continue;
    const dir = join(thirdParty, v.slug);
    const meta = readJson(join(dir, '.harvested.json'), {});
    // Pruned or never vendored: the file that has to exist is the game's
    // entry, which is no longer necessarily index.html.
    if (!existsSync(join(dir, entryOf(v, meta)))) continue;
    if (meta.validated) {
      // Already passed an earlier pass - keep it without re-testing.
      resumed.push(v);
      const prior = resultsBySlug.get(v.slug);
      resultsBySlug.set(v.slug, {
        slug: v.slug,
        repo: v.repo,
        verdict: 'pass',
        reason: prior?.reason || 'already validated in an earlier pass',
      });
      continue;
    }
    queue.push(v);
  }

  const targets = limit > 0 ? queue.slice(0, limit) : queue;
  console.log(
    `validate: ${targets.length} to check (${resumed.length} already validated), ${workers} workers on :${port}`,
  );

  const server = targets.length ? await ensureServer() : null;

  const counts = { pass: 0, dead: 0, inconclusive: 0 };
  const deadSlugs = [];
  let done = 0;
  let next = 0;

  const flush = () => writeJson(join(work, 'validated.json'), [...resultsBySlug.values()]);

  async function worker() {
    while (next < targets.length) {
      const v = targets[next++];
      const { verdict, reason } = await judgeSlug(v, { verbose });
      counts[verdict]++;
      done++;

      resultsBySlug.set(v.slug, { slug: v.slug, repo: v.repo, verdict, reason: reason ?? '' });

      const dir = join(thirdParty, v.slug);
      if (verdict === 'pass') {
        // Resume marker: the next pass must not re-open a game that already
        // passed, or 500 games would take 10 minutes every time.
        const meta = readJson(join(dir, '.harvested.json'), {});
        writeJson(join(dir, '.harvested.json'), { ...meta, ...v, validated: true });
      } else if (verdict === 'dead') {
        // A dead game is unplayable, so it must not stay on disk pretending
        // to be a candidate - and its folder is megabytes of dead weight in
        // the next deploy.
        rmSync(dir, { recursive: true, force: true });
        deadSlugs.push(v);
      }

      flush();
      process.stdout.write(
        `\r  ${done}/${targets.length}  pass ${counts.pass}  dead ${counts.dead}  inconclusive ${counts.inconclusive}   `,
      );
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(workers, Math.max(1, targets.length)) }, worker));
  } finally {
    await browser?.close().catch(() => {});
    browser = null;
    server?.kill();
  }

  flush();

  const total = targets.length + resumed.length;
  console.log(
    `\nvalidate: ${counts.pass + resumed.length} pass, ${counts.dead} dead, ${counts.inconclusive} inconclusive of ${total}`,
  );

  if (deadSlugs.length) {
    console.log('  dead games deleted from third-party/:');
    for (const v of deadSlugs) {
      const entry = resultsBySlug.get(v.slug);
      const documented = blocked.has(normaliseRepo(v.repo));
      const note = documented
        ? 'already on content/blocked.json'
        : 'not on content/blocked.json - add it by hand if it should never be vendored again';
      console.log(`    ${v.slug} (${v.repo}) - ${entry?.reason ?? 'no reason recorded'} [${note}]`);
    }
  }

  if (counts.dead > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nvalidate:', err);
  process.exit(1);
});
