/**
 * Harvest open-source HTML5 games from GitHub, validate them in a real browser,
 * and emit catalogue metadata.
 *
 *   node scripts/harvest-games.mjs sweep      # find candidates (cached)
 *   node scripts/harvest-games.mjs vendor     # download + license-check
 *   node scripts/harvest-games.mjs validate   # headless browser gate
 *   node scripts/harvest-games.mjs generate   # write content/games.generated.json
 *   node scripts/harvest-games.mjs all
 *
 * Every phase writes a JSON report to .harvest/ so phases can be resumed.
 * Only games that pass the browser gate are ever published.
 *
 * Knobs (environment variable or --flag, the flag wins):
 *   HARVEST_FAMILY=arcade,puzzle   genre slices to search (default: all)
 *   HARVEST_TARGET=650             stop sweeping once there are enough candidates
 *   HARVEST_PAGES=2                search depth per query/licence
 *   HARVEST_CALLS=400              hard cap on search API calls
 *   HARVEST_LIMIT=650              max repos to vendor in this run
 *   HARVEST_CONCURRENCY=8          parallel downloads (default 6)
 *
 * Search, filtering, preflight and vendoring live in scripts/harvest/ so they
 * can be sliced across runs and tested without touching the network.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { judgeGame } from './embed-health.mjs';
import { findChrome } from './chrome.mjs';
import { queriesFor } from './harvest/queries.mjs';
import {
  SEARCH_LICENCES,
  dedupeCandidates,
  normaliseRepo,
  shouldAccept,
  slugify,
} from './harvest/filters.mjs';
import { makePreflight } from './harvest/preflight.mjs';
import { vendorAll } from './harvest/vendor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, '.harvest');
const thirdParty = join(root, 'third-party');

const PHASES = new Set(['sweep', 'vendor', 'validate', 'generate', 'all']);

/**
 * One parser for the phase and the `--flag=value` knobs.
 *
 * The phase CLI is the contract (`node scripts/harvest-games.mjs vendor`);
 * flags are an alternative to the HARVEST_* environment variables, so a
 * parallel slice can be labelled on the command line and still inherit the
 * budget from the shell.
 */
function parseCli(argv) {
  const flags = {};
  let phase = 'all';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = 'true';
      }
    } else if (PHASES.has(arg)) {
      phase = arg;
    }
  }
  return { phase, flags };
}

const CLI = parseCli(process.argv.slice(2));

/** Flag first, then the matching HARVEST_* variable, then the default. */
function setting(flag, env, fallback) {
  const raw = CLI.flags[flag] ?? process.env[env];
  return raw === undefined || raw === '' ? fallback : raw;
}

function settingNumber(flag, env, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(setting(flag, env, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** The search families this run is allowed to walk. */
function familiesInPlay() {
  return setting('family', 'HARVEST_FAMILY', 'all');
}

/**
 * Repositories that must never be published.
 *
 * Each of these was vendored, opened in a real browser and rejected: the
 * published page is a landing page rather than a game, or the game needs a
 * build step (webpack, vite, emscripten) and can never run in a browser.
 * Listing them here means the next harvest cannot bring them back.
 */
const BLOCKED = new Set(
  (
    readJson(join(root, 'content/blocked.json'), { repos: [] }).repos ?? []
  ).map((r) => normaliseRepo(r)),
);

/**
 * Per-game overrides, keyed by catalogue id.
 *
 * Used when the file a repository ships as index.html is not the one the
 * catalogue should embed - typically because index.html is the project's
 * landing page and the game itself lives somewhere else.
 */
const OVERRIDES = readJson(join(root, 'content/overrides.json'), { games: {} }).games ?? {};
mkdirSync(work, { recursive: true });

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 96 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Search API calls are capped at 30/minute. A call that comes back empty is
 * almost always that cap rather than "no results", so wait for the window to
 * reset and ask again instead of silently ending the sweep - which is how an
 * earlier run collected 144 candidates out of a 1600 target and looked fine.
 */
function ghSearch(args) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = gh(args);
    if (raw) return raw;
    let reset = 0;
    try {
      reset = Number(
        JSON.parse(gh(['api', 'rate_limit']) || '{}')?.resources?.search?.reset ?? 0,
      );
    } catch {
      reset = 0;
    }
    const waitS = reset ? Math.ceil(reset - Date.now() / 1000) + 2 : 15;
    execFileSync('sleep', [String(Math.max(2, Math.min(waitS, 90)))]);
  }
  return '';
}

/* ------------------------------------------------------------- sweep */

/**
 * Star floor for the search query.
 *
 * The floor used to be hardcoded `stars:>2`, which quietly excluded the long
 * tail where most small open-source games live: a full 60-query sweep found
 * only 1,561 candidates, and ~1,500 of them had already been seen. GitHub's
 * search accepts `stars:>=0`, so the floor is now a knob - the browser gate,
 * not a popularity filter, decides what is publishable.
 */
function starsFilter() {
  const min = Number(process.env.HARVEST_MIN_STARS ?? 2);
  return Number.isFinite(min) && min > 0 ? `stars:>=${min}` : 'stars:>=0';
}

function sweep() {
  // Candidates found by an earlier sweep are kept: a deep sweep is meant to
  // accumulate across runs, and overwriting the file threw away every repo the
  // previous run had already paid API calls for.
  const previous = dedupeCandidates(readJson(join(work, 'candidates.json'), []));
  const seen = new Map(previous.map((c) => [c.repo, c]));
  const queries = queriesFor(familiesInPlay());
  let answered = 0;
  let calls = 0;
  let added = 0;

  // A sweep is bounded on purpose: 130+ queries x 9 licences x 10 pages is
  // thousands of search calls at 30/minute and looks like a hang.
  // HARVEST_TARGET stops as soon as there is enough material, HARVEST_PAGES
  // limits depth, HARVEST_CALLS caps the API, and HARVEST_FAMILY picks which
  // genre slices to walk.
  const target = settingNumber('target', 'HARVEST_TARGET', 0);
  const maxPages = settingNumber('pages', 'HARVEST_PAGES', 10, { min: 1, max: 100 });
  const maxCalls = settingNumber('calls', 'HARVEST_CALLS', 0);
  const already = new Set(existsSync(thirdParty) ? readdirSync(thirdParty) : []);
  // Repos already judged unusable (no root index.html or no licence file):
  // they used to be re-downloaded and re-rejected on every run.
  const skipped = new Set(readJson(join(work, 'skipped.json'), []));

  // A deep sweep is hours of API calls. Without a checkpoint, a killed run
  // loses every candidate it found - so persist as we go.
  const checkpoint = () => {
    writeJson(
      join(work, 'candidates.json'),
      [...seen.values()].sort((a, b) => b.stars - a.stars),
    );
  };

  const outOfBudget = () =>
    (maxCalls > 0 && calls >= maxCalls) || (target > 0 && seen.size >= target);

  for (const q of queries) {
    for (const lic of SEARCH_LICENCES) {
      for (let page = 1; page <= maxPages; page++) {
        if (outOfBudget()) break;
        calls++;
        if (calls % 25 === 0) {
          process.stderr.write(
            `  sweep: ${calls} calls, ${seen.size} candidates (${q} / ${lic} / p${page})\n`,
          );
        }
        if (calls % 50 === 0) checkpoint();

        const raw = ghSearch([
          'api',
          `search/repositories?q=${encodeURIComponent(`${q} license:${lic} ${starsFilter()}`)}&per_page=100&page=${page}&sort=stars`,
        ]);
        // 30 a minute is the cap; 2.1s a call keeps a long sweep under it
        // instead of spending most of its budget waiting for a reset.
        execFileSync('sleep', ['2.1']);
        if (!raw) break;

        let payload = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          break;
        }
        const items = payload.items ?? [];
        if (!items.length) break;
        answered++;

        for (const r of items) {
          if (seen.has(r.full_name)) continue;
          // On the block list: it can never be published, so it is not a
          // candidate - no point spending a download on it later.
          if (BLOCKED.has(normaliseRepo(r.full_name))) continue;
          if (already.has(slugify(r.full_name))) continue;
          if (skipped.has(r.full_name)) continue;
          // Licence, size, "looks like a library/tutorial" and the game
          // signal all live in one pure, tested function.
          if (!shouldAccept(r, { minStars: Number(process.env.HARVEST_MIN_STARS ?? 2) })) continue;
          seen.set(r.full_name, {
            repo: r.full_name,
            stars: r.stargazers_count ?? 0,
            licence: r.license?.spdx_id ?? null,
            sizeKB: r.size,
            pushedAt: r.pushed_at ?? '',
            description: (r.description ?? '').trim(),
            defaultBranch: r.default_branch ?? 'main',
            owner: r.owner?.login ?? r.full_name.split('/')[0],
          });
          added++;
        }
      }
      if (outOfBudget()) break;
    }
    if (outOfBudget()) break;
  }

  const list = [...seen.values()].sort((a, b) => b.stars - a.stars);

  // Silence is the failure mode this used to have: an unauthenticated `gh`
  // returns '' for every call, so the sweep "succeeded" with zero candidates
  // and nothing said so.
  if (!list.length) {
    throw new Error(
      `sweep: 0 candidates from ${calls} calls. Check \`gh auth status\` and the network; ` +
        `nothing was vendored, and content/games.generated.json is untouched.`,
    );
  }

  writeJson(join(work, 'candidates.json'), list);
  console.log(
    `sweep: ${answered} queries answered, ${calls} API calls -> ${list.length} candidates (+${added} new)`,
  );
  return list;
}

/* ------------------------------------------------------------ vendor */

async function vendor() {
  const candidates = dedupeCandidates(readJson(join(work, 'candidates.json'), []));
  if (!candidates.length) {
    console.log('vendor: no candidates in .harvest/candidates.json - run sweep first');
    return [];
  }

  const curated = new Set(
    readJson(join(root, 'content/games.json'), { games: [] }).games
      .map((g) => g.credit?.source)
      .filter(Boolean)
      .map((u) => u.replace('https://github.com/', '').replace(/\/$/, '')),
  );

  const slugOf = (c) => c.slug || slugify(c.repo);
  const isDone = (c) => existsSync(join(thirdParty, slugOf(c), '.harvested.json'));
  // Repos preflight already refused (no root index.html, no licence) are not
  // pending: retrying them would spend part of a small HARVEST_LIMIT on work
  // that is known to be wasted.
  const refused = new Set(readJson(join(work, 'skipped.json'), []));
  const allowed = candidates.filter((c) => !curated.has(c.repo));
  const pending = allowed.filter((c) => !isDone(c) && !refused.has(c.repo));

  // HARVEST_LIMIT is a *download* budget: only repos that still need vendoring
  // count against it, so a resumed run never spends its allowance on repos
  // that are already on disk.
  const limit = settingNumber('limit', 'HARVEST_LIMIT', 0);
  const batch = limit > 0 ? pending.slice(0, limit) : pending;
  // Already-vendored repos ride along so vendored.json stays the full picture
  // validate() expects; vendorAll reuses their metadata without a download.
  const queue = [...allowed.filter(isDone), ...batch];

  const concurrency = settingNumber('concurrency', 'HARVEST_CONCURRENCY', 6, { min: 1, max: 32 });
  const preflight = makePreflight({ gh, cachePath: join(work, 'preflight.json') });

  console.log(
    `vendor: ${queue.length} repos queued (${pending.length} pending, limit ${limit || 'none'}), concurrency ${concurrency}`,
  );

  let tick = 0;
  const { vendored, skipped, failed } = await vendorAll(queue, {
    concurrency,
    thirdPartyDir: thirdParty,
    workDir: work,
    preflight,
    onProgress: ({ total, status, slug, reason }) => {
      tick += 1;
      const note = status === 'skipped' || status === 'failed' ? ` (${reason})` : '';
      process.stderr.write(`\r  ${tick}/${total}  ${status}${note} ${slug}   `);
    },
  });

  const newly = vendored.filter((v) => v.reused !== true).length;
  const clean = vendored.map(({ reused, ...meta }) => meta);

  writeJson(join(work, 'vendored.json'), clean);
  // Remember preflight rejections so the next sweep does not spend candidates
  // on a repo that can never be served as a game page.
  writeJson(
    join(work, 'skipped.json'),
    [...new Set([...readJson(join(work, 'skipped.json'), []), ...skipped.map((s) => s.repo)])],
  );

  process.stderr.write('\n');
  for (const f of failed) console.error(`  failed ${f.repo}: ${f.reason}`);
  console.log(`vendor: ${newly} vendored, ${skipped.length} skipped, ${failed.length} failed`);
  return clean;
}

/* ---------------------------------------------------------- validate */

async function validate() {
  const vendored = readJson(join(work, 'vendored.json'), []);
  if (!vendored.length) {
    console.log('validate: nothing vendored yet');
    return [];
  }

  const port = process.env.HARVEST_PORT ?? 4191;
  const { spawn } = await import('node:child_process');

  const serverHealth = async () => {
    try {
      // Check a file that exists - the repo root itself has no index.html.
      const res = await fetch(`http://localhost:${port}/package.json`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const startServer = () => {
    // detached: the server can outlive a killed parent, so a half-finished
    // pass can be resumed instead of losing everything.
    const s = spawn(process.execPath, [join(root, 'scripts/serve-root.mjs')], {
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
      detached: true,
    });
    s.unref();
    return s;
  };

  const ensureServer = async () => {
    if (await serverHealth()) return true;
    console.error('\n  static server died - restarting it');
    startServer();
    for (let i = 0; i < 40; i++) {
      if (await serverHealth()) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

  if (!(await ensureServer())) {
    console.error(`validate: static server on :${port} never came up. Nothing was deleted.`);
    process.exit(1);
  }

  const { default: puppeteer } = await import('puppeteer-core');
  let browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  // Hard deadlines so a page that spins forever cannot stall the whole run.
  const withTimeout = (promise, ms, what) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${what} timed out`)), ms),
      ),
    ]);

  const CONNECTION_DEAD = /Connection closed|Target closed|Session closed|browser has been closed/i;

  const passed = [];
  const rejected = [];
  const inconclusive = [];
  let index = 0;

  for (const v of vendored) {
    index++;
    const dir = join(thirdParty, v.slug);
    if (!existsSync(join(dir, 'index.html'))) continue; // pruned or never vendored
    if (BLOCKED.has(normaliseRepo(v.repo))) {
      // On the block list: never publish it, and do not keep it on disk.
      rmSync(dir, { recursive: true, force: true });
      rejected.push(v.slug);
      continue;
    }
    if (readJson(join(dir, '.harvested.json'), {}).validated) {
      // Already passed an earlier pass - keep it without re-testing.
      passed.push(v);
      continue;
    }
    // The environment restarts cheaply here; re-check the server every 20
    // games so a death costs at most 20 results, never the whole run.
    if (index % 20 === 0) await ensureServer();

    let verdict = ''; // 'pass' | 'dead' | ''
    let lastReason = '';
    let browserDead = false;

    for (let attempt = 0; attempt < 2 && !verdict; attempt++) {
      if (attempt > 0) {
        if (browserDead) {
          try {
            await browser.close();
          } catch {
            /* already gone */
          }
          browser = await puppeteer.launch({
            executablePath: findChrome(),
            headless: 'shell',
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
          });
        }
        browserDead = false;
        if (!(await ensureServer())) break;
      }
      let page;
      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1024, height: 768 });
        const errors = [];
        const bad = [];
        page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
        page.on('response', (r) => {
          if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
        });

        await withTimeout(
          page.goto(`http://localhost:${port}/third-party/${v.slug}/index.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          }),
          20000,
          'goto',
        );
        await new Promise((r) => setTimeout(r, 2200));
        // Many games draw only after the first input.
        try {
          await page.keyboard.press('Space');
          await page.keyboard.press('Enter');
          await new Promise((r) => setTimeout(r, 600));
        } catch {
          /* the page may not accept synthetic keys */
        }

        const probe = await withTimeout(
          page.evaluate(() => {
            const canvases = [...document.querySelectorAll('canvas')];
            // Sample the WHOLE canvas. A corner sample misses games that draw
            // in the middle, which is most of them.
            const canvasPixels = canvases.reduce((total, c) => {
              try {
                const ctx = c.getContext('2d');
                if (!ctx) return total;
                const d = ctx
                  .getImageData(0, 0, Math.min(c.width, 800), Math.min(c.height, 800))
                  .data;
                let n = 0;
                for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
                return total + n;
              } catch {
                return total;
              }
            }, 0);
            const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
            // A repo whose landing page is the author's personal site (blog,
            // portfolio, social hub) is not a game - it once shipped and
            // walked players to a stranger's homepage.
            const identityHosts = [
              'github.com', 'gitee.com', 'gitlab.com', 'linkedin.com',
              'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
              'youtube.com', 'weibo.com', 'zhihu.com', 'medium.com',
              'patreon.com', 'paypal.me', 't.me', 'whatsapp.com',
              'strava.com', 'buymeacoffee.com', 'ko-fi.com', 'itch.io',
            ];
            const sharePath = /\/(sharer|share|intent|submit|send)/i;
            const identityLinks = [...document.querySelectorAll('a[href]')]
              .map((a) => a.href)
              .filter((href) => {
                if (!/^https?:\/\//i.test(href)) return false;
                let u;
                try { u = new URL(href); } catch { return false; }
                const host = u.hostname.replace(/^www\./, '');
                if (!identityHosts.some((h) => host === h || host.endsWith('.' + h))) return false;
                if (sharePath.test(u.pathname + u.search)) return false;
                if (host === 'github.com' || host === 'gitlab.com') {
                  const parts = u.pathname.split('/').filter(Boolean);
                  if (parts.length >= 2 && !/fork|star|sponsor|follow/i.test(u.pathname)) return false;
                }
                return true;
              });
            const html = document.documentElement.innerHTML;
            const payment = /\b(usdt|bitcoin|ethereum|crypto\.com|coinbase|binance|metamask|buy\s+me\s+a\s+coffee|sberbank|webmoney|qiwi)/i.test(html);
            return {
              canvasPixels,
              textLen: text.length,
              text: text.slice(0, 300),
              raw: text.slice(0, 2000),
              controls: document.querySelectorAll('button, a, input, [role=button]').length,
              canvases: canvases.length,
              identityLinks: identityLinks.length,
              payment,
            };
          }),
          12000,
          'probe',
        );

        const fatal = errors.filter((e) => !/favicon|ERR_/.test(e));
        // Only same-origin failures matter - a game's own analytics or its
        // ribbon images failing is not a broken game.
        const missing = bad.filter((b) => !/favicon/.test(b) && b.includes('localhost'));

        // One rule for "is this a working game?", shared with the post-build
        // audit (scripts/embed-health.mjs) so the two cannot disagree.
        const verdict2 = judgeGame({
          failed: missing,
          jsErrors: fatal,
          status: 200,
          probe: {
            pixels: probe.canvasPixels,
            textLen: probe.textLen,
            controls: probe.controls,
            canvases: probe.canvases,
          },
        });

        if (probe.payment) {
          verdict = 'dead';
          lastReason = 'landing page shows payment/crypto chrome, not a game';
        } else if (
          // A repo selling its source code and art is a shop, not a game -
          // it paints real text and real buttons, so the painting check alone
          // cannot tell it apart from a game menu.
          /(源码|完整源码|source\s*\+\s*art|full\s*source\s*code|source\s*code\s*(package|available|for\s*sale)|assets?\s*for\s*sale)/i.test(
            probe.raw ?? '',
          )
        ) {
          verdict = 'dead';
          lastReason = 'landing page is selling source code / art assets';
        } else if (probe.identityLinks >= 4) {
          verdict = 'dead';
          lastReason = `landing page is a personal hub (${probe.identityLinks} profile links)`;
        } else if (/404|not found|error occurred/i.test(probe.text)) {
          verdict = 'dead';
          lastReason = 'page reports an error';
        } else if (verdict2.ok) {
          verdict = 'pass';
        } else {
          verdict = 'dead';
          lastReason = verdict2.reasons.join('; ').slice(0, 120);
        }
      } catch (err) {
        const msg = String(err?.message ?? err);
        if (CONNECTION_DEAD.test(msg)) {
          // Chrome died with the environment restart. Relaunch and retry;
          // this says nothing about the game.
          browserDead = true;
          lastReason = `browser died: ${msg.slice(0, 50)}`;
          verdict = '';
        } else if (/timed out$/.test(msg) && attempt > 0) {
          // Hung on two attempts in a row: spinning forever or never
          // finishing. Unplayable for a real user too.
          verdict = 'dead';
          lastReason = `page hung: ${msg.slice(0, 50)}`;
        } else {
          // Any other failure is not a verdict. The game stays on disk and
          // gets its retry.
          lastReason = `load failed: ${msg.slice(0, 60)}`;
          verdict = '';
        }
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }

    if (verdict === 'pass') {
      passed.push(v);
      writeJson(join(dir, '.harvested.json'), { ...v, validated: true });
    } else if (verdict === 'dead') {
      rmSync(dir, { recursive: true, force: true });
      rejected.push(v.slug);
    } else {
      inconclusive.push(v.slug);
    }
    process.stdout.write(
      `\r  ${index}/${vendored.length}  pass ${passed.length}  dead ${rejected.length}  retry-later ${inconclusive.length}   `,
    );
  }

  await browser.close().catch(() => {});
  console.log(
    `\nvalidate: ${passed.length} passed, ${rejected.length} rejected, ${inconclusive.length} left for another pass`,
  );
  writeJson(join(work, 'passed.json'), passed);
  return passed;
}

/* ---------------------------------------------------------- generate */

const CATEGORY_RULES = [
  ['word', ['word', 'anagram', 'letter', 'spelling', 'vocabulary', 'hangman', 'wordle', 'crossword']],
  ['puzzle', ['puzzle', '2048', 'sudoku', 'mahjong', 'match', 'merge', 'slide', 'mahjong', 'nonogram', 'picross']],
  ['strategy', ['strategy', 'tower defense', 'towerdefence', 'rts', 'strategy', 'chess', 'checkers', 'go ', 'cards', 'solitaire', 'klondike', 'spider', 'freecell', 'golf', 'hexagon', 'connect four']],
  ['brain', ['memory', 'brain', 'quiz', 'trivia', 'puzzle', 'concentration', 'reaction', 'math']],
  ['sandbox', ['sandbox', 'simulator', 'idle', 'clicker', 'tycoon', 'drawing', 'sandbox', 'sandbox']],
  ['arcade', ['shooter', 'arcade', 'maze', 'snake', 'pacman', 'platformer', 'runner', 'flappy', 'invaders', 'asteroid', 'breakout', 'brick', 'doodle', 'ball', 'jump', 'racing', 'shoot']],
];

function categoryFor(text) {
  for (const [cat, words] of CATEGORY_RULES) {
    if (words.some((w) => text.includes(w))) return cat;
  }
  return 'arcade';
}

function accentFor(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 85% 62%)`;
}

function titleFrom(repo, description) {
  const base = repo.split('/')[1] ?? repo;
  let t = base
    .replace(/[-_.]+/g, ' ')
    .replace(/\b(html5|js|javascript|web|game|the|classic|simple)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) t = base;
  t = t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (t.length > 42) t = `${t.slice(0, 40)}…`;
  return t;
}

/**
 * Turn a README into sentences a player can actually read.
 *
 * READMEs are full of markup: headings, code blocks, tables, badges, lists
 * of links. Left alone they turn into a "How to play" list that reads like
 * a diff. Everything that is not a sentence is dropped here.
 */
function readmeSentences(readme) {
  if (!readme) return [];
  let text = readme;

  // Fenced code blocks and indented code.
  text = text.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
  // Images first, then links - keep the link text, drop the target.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Reference-style links: [text][1] and [1]: url
  text = text.replace(/^\[[^\]]+\]:\s*\S+.*$/gm, ' ');
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  // HTML tags, including comments.
  text = text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  // Setext underlines and horizontal rules.
  text = text.replace(/^\s*(=+|-{3,}|\*{3,})\s*$/gm, ' ');
  // ATX headings keep their text, but the marker goes.
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  // Table rows and block quotes.
  text = text.replace(/^\s*\|.*\|\s*$/gm, ' ');
  text = text.replace(/^\s*>\s?/gm, '');
  // Badges, shields and emoji shortcodes.
  text = text.replace(/!\[.*?\]\(.*?\)/g, ' ');
  text = text.replace(/:[a-z0-9_+-]+:/gi, ' ');
  // Emphasis, inline code, list markers, pipes.
  text = text.replace(/[*_`]/g, ' ').replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '');

  const parts = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (clean.length < 25) continue;
    // A line that is a path, a command or a URL is not a sentence.
    if (/^(https?:|www\.|git |npm |yarn |cd |sudo |\$|>|@|\.\/|\/)/i.test(clean)) continue;
    if (/[{};=<>[\]]/.test(clean)) continue;
    for (const piece of clean.split(/(?<=[.!?])\s+/)) {
      const s = piece.trim();
      if (s.length < 40 || s.length > 320) continue;
      if (!/^[A-Z0-9"'(]/.test(s)) continue;
      if (!/\s/.test(s)) continue;
      parts.push(s);
    }
  }
  // Deduplicate, keep the order.
  const seen = new Set();
  return parts.filter((s) => !seen.has(s) && seen.add(s)).slice(0, 12);
}

function generate() {
  const passed = readJson(join(work, 'passed.json'), []);
  const games = [];
  const curated = readJson(join(root, 'content/games.json'), { games: [] }).games;
  const previous = readJson(join(root, 'content/games.generated.json'), { games: [] }).games ?? [];
  // Ids and titles already in the catalogue - including the ones an earlier
  // harvest produced - so a new batch can never collide with a live page.
  const used = new Set([...curated, ...previous].map((g) => g.id));
  const titleCounts = new Map([...curated, ...previous].map((g) => [g.title, 1]));
  const repoOf = (g) =>
    (g.credit?.source ?? '').replace('https://github.com/', '').replace(/\/$/, '').toLowerCase();
  const publishedSources = new Set([...curated, ...previous].map(repoOf).filter(Boolean));

  for (const v of passed) {
    // Skip anything removed after validation (a second pass may have dropped it).
    if (!existsSync(join(thirdParty, v.slug, 'index.html'))) continue;
    // Already published from the same repository under another slug (two
    // repos can both be "pacman"): a duplicate page is worse than one game.
    if (publishedSources.has(v.repo.toLowerCase())) continue;
    // Skip anything on the block list: a landing page rather than a game, or
    // a game that needs a build step and can never run in a browser.
    if (BLOCKED.has(normaliseRepo(v.repo))) continue;

    // URL slug from the repo name only - no owner prefix, it reads better and
    // ranks better. The owner is still credited on the page.
    let slug = slugify(v.repo.split('/')[1] ?? v.repo);
    if (used.has(slug)) slug = `${slug}-${slugify(v.owner)}`;
    let n = 2;
    while (used.has(slug)) slug = `${slugify(v.repo.split('/')[1] ?? v.repo)}-${n++}`;
    used.add(slug);

    const sentences = readmeSentences(v.readme);
    const desc = v.description || sentences[0] || '';
    let title = titleFrom(v.repo, v.description);

    // Two repos can produce the same title. Qualify the second one so every
    // page in the catalogue has a distinct name.
    if (titleCounts.has(title)) {
      const titleWords = new Set(title.toLowerCase().split(/\s+/));
      const qualifier = (v.description || '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 3 &&
            !titleWords.has(w.toLowerCase()) &&
            !/game|play|html|javascript|canvas|browser|version|modern|simple|classic|responsive|based|implementation|that|which|with|from|your|this|and|the|for/i.test(
              w,
            ),
        )
        .slice(0, 1)
        .join(' ');
      title = qualifier
        ? `${title} ${qualifier}`
        : `${title} ${(titleCounts.get(title) ?? 1) + 1}`;
      if (title.length > 44) title = title.slice(0, 42).trim();
    }
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);

    const prose = sentences.filter((s) => !desc.toLowerCase().startsWith(s.slice(0, 20).toLowerCase()));
    // Plain strings. Spreading a string into an object used to produce
    // {0: 'B', 1: 'l', ...} and every game page rendered "[object Object]".
    const howToPlay = (prose.length ? prose : sentences).slice(0, 5).map((s) => String(s).trim());
    const howTo = howToPlay.length
      ? howToPlay
      : [
          'Open the game and follow the on-screen instructions.',
          'Play with the keyboard, the mouse or touch - the controls are shown in the game.',
          'Score points and try to beat your best run.',
        ];

    const keywords = [
      `${title.toLowerCase()} game`,
      `play ${title.toLowerCase()} online`,
      `free ${title.toLowerCase()}`,
      `${title.toLowerCase()} unblocked`,
      'browser game',
      'free online game',
    ];

    const category = categoryFor(`${v.repo} ${v.description} ${title}`.toLowerCase());

    const entry = {
      id: slug,
      title,
      tagline: (desc || `A free ${title} browser game.`).slice(0, 90),
      description:
        `${desc || `A free browser game.`} Play ${title} instantly on arcadefork - no download, no sign-up, works on any device.`.slice(
          0,
          320,
        ),
      category,
      accent: accentFor(slug),
      daily: false,
      embed: { src: `/third-party/${v.slug}/index.html` },
      credit: {
        author: v.owner,
        licence: v.licence,
        source: `https://github.com/${v.repo}`,
      },
      keywords,
      howToPlay: howTo,
      faq: [
        {
          q: `Is ${title} free?`,
          a: `Yes. ${title} runs entirely in your browser on arcadefork - no download, no account, no payment.`,
        },
        {
          q: `Who made this version of ${title}?`,
          a: `${title} is an open-source project by ${v.owner}, published under the ${v.licence} licence. The original source is linked from the credits page.`,
        },
        {
          q: `Does ${title} work on a phone?`,
          a: `It is served as a normal web page, so it scales to your screen. If it needs a keyboard, the on-screen controls are still there.`,
        },
      ],
      related: [],
    };

    // Per-game overrides - for example a repository whose index.html is the
    // project's landing page while the game lives in another file.
    const override = OVERRIDES[slug];
    if (override) {
      for (const [key, value] of Object.entries(override)) {
        entry[key] = typeof value === 'object' && !Array.isArray(value) ? { ...entry[key], ...value } : value;
      }
    }

    games.push(entry);
  }

  // A harvest run validates one batch, not the whole catalogue - so this is a
  // merge, never a replacement. Generating from `passed` alone once truncated
  // 146 published games down to the 2 that happened to be in the last batch.
  const existing = readJson(join(root, 'content/games.generated.json'), { games: [] }).games ?? [];
  const byId = new Map();
  for (const g of existing) {
    const m = (g.embed?.src ?? '').match(/^\/third-party\/([^/]+)\//);
    if (!m || existsSync(join(thirdParty, m[1], 'index.html'))) byId.set(g.id, g);
  }
  const added = games.filter((g) => !byId.has(g.id)).length;
  for (const g of games) byId.set(g.id, g);
  const merged = [...byId.values()];

  writeJson(join(root, 'content/games.generated.json'), { games: merged });
  console.log(
    `generate: ${games.length} from this batch (${added} new), ${merged.length} in content/games.generated.json`,
  );
  return merged;
}

/* ------------------------------------------------------------- main */

// The phase contract is unchanged: `node scripts/harvest-games.mjs vendor`.
// --family/--limit/--concurrency/--pages/--calls/--target mirror the HARVEST_*
// variables, with the flag winning when both are present.
const phase = CLI.phase;

if (phase === 'sweep' || phase === 'all') sweep();
if (phase === 'vendor' || phase === 'all') await vendor();
if (phase === 'validate' || phase === 'all') await validate();
if (phase === 'generate' || phase === 'all') generate();

console.log('\ndone');
