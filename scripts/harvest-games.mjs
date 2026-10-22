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
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { judgeGame } from './embed-health.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, '.harvest');
const thirdParty = join(root, 'third-party');

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

/** Repositories are compared without punctuation or case. */
function normaliseRepo(repo) {
  return String(repo).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Per-game overrides, keyed by catalogue id.
 *
 * Used when the file a repository ships as index.html is not the one the
 * catalogue should embed - typically because index.html is the project's
 * landing page and the game itself lives somewhere else.
 */
const OVERRIDES = readJson(join(root, 'content/overrides.json'), { games: {} }).games ?? {};
mkdirSync(work, { recursive: true });

/**
 * Permissive licences are straightforward. Copyleft licences are also usable
 * here because the vendored copy ships with its original licence and the
 * corresponding source is published in this repository - which is exactly what
 * those licences require. AGPL is excluded: it carries extra obligations for
 * network-served modifications we do not want to take on.
 */
const ALLOWED_LICENCE = new Map([
  ['MIT', 'MIT'],
  ['CC0-1.0', 'CC0-1.0'],
  ['Apache-2.0', 'Apache-2.0'],
  ['BSD-3-Clause', 'BSD-3-Clause'],
  ['BSD-2-Clause', 'BSD-2-Clause'],
  ['ISC', 'ISC'],
  ['Unlicense', 'Unlicense'],
  ['0BSD', '0BSD'],
  ['GPL-3.0', 'GPL-3.0'],
  ['GPL-2.0', 'GPL-2.0'],
  ['LGPL-3.0', 'LGPL-3.0'],
  ['LGPL-2.1', 'LGPL-2.1'],
  ['MPL-2.0', 'MPL-2.0'],
]);

/** Words that suggest a repo is actually a game, not a library or a demo. */
const GAME_WORDS = [
  'game', 'games', 'puzzle', 'arcade', 'shooter', 'platformer', 'maze', 'tetris',
  'snake', 'pacman', 'pac-man', 'solitaire', 'card', 'cards', 'quiz', 'trivia',
  'tower', 'roguelike', 'rogue-like', 'rpg', 'sandbox', 'board', 'match', 'merge',
  '2048', 'breakout', 'invaders', 'flappy', 'runner', 'doodle', 'asteroid', 'brick',
  'word search', 'sudoku', 'mahjong', 'checkers', 'chess', 'pinball', 'arkanoid',
  'ball', 'jump', 'clicker', 'idle', 'tycoon', 'coloring', 'colouring', 'memory',
];

/** A generic "game" word is too weak - these are specific genres/mechanics. */
const STRONG_GAME_WORDS = [
  'puzzle', 'arcade', 'shooter', 'shmup', 'platformer', 'maze', 'tetris', 'snake',
  'pacman', 'pac-man', 'solitaire', 'klondike', 'spider solitaire', 'freecell',
  'quiz', 'trivia', 'tower defense', 'towerdefence', 'roguelike', 'rogue-like',
  'breakout', 'arkanoid', 'invaders', 'flappy', 'endless runner', 'asteroid',
  'word search', 'wordsearch', 'wordle', 'hangman', 'sudoku', 'mahjong', 'nonogram',
  'picross', 'bubble shooter', 'match-3', 'match 3', '2048', 'pinball', 'ping pong',
  'doodle jump', 'flappy bird', 'angry birds', 'cut the rope', 'fruit ninja',
  'snake game', 'brick breaker', 'space invaders', 'pong', 'golf game', 'solitaire game',
  'card game', 'board game', 'card table', 'dice', 'slot machine', 'casino',
  'racing game', 'car game', 'bike game', 'helicopter', 'zombie', 'tower blocks',
  'sokoban', 'block puzzle', 'tile match', 'jewel', 'bejeweled', 'crossword',
  'pixel game', 'retro game', 'classic game', 'arcade game', 'video game',
];

const SKIP_WORDS = [
  'framework', 'library', 'boilerplate', 'starter', 'template', 'tutorial',
  'course', 'awesome', 'curated', 'list of', 'roadmap', 'cheatsheet', 'toolkit',
  'sdk', 'api wrapper', 'react component', 'theme', 'cli', 'editor', 'wallpaper',
  'icon set', 'font', 'plugin', 'extension', 'vscode', 'atom plugin', 'webpack',
  'babel', 'polyfill', 'css framework', 'learning', 'learn ', 'course', 'practice',
  'exercise', 'cheatsheet', 'interview', 'portfolio', 'resume', 'marketing',
];

const QUERIES = [
  'topic:html5-game',
  'topic:html5',
  'topic:javascript-game',
  'topic:canvas-game',
  'topic:web-game',
  'topic:browser-game',
  'topic:game language:JavaScript',
  'topic:game language:HTML',
  'topic:arcade-game',
  'topic:puzzle-game',
  'topic:casual-game',
  'topic:card-game',
  'topic:board-game',
  'topic:strategy-game',
  'topic:platformer',
  'topic:roguelike',
  'topic:shmup',
  'topic:gamejam',
  'topic:js13k',
  'topic:tetris',
  'topic:snake-game',
  'topic:maze-game',
  'topic:quiz-game',
  'topic:trivia-game',
  'topic:html5-canvas',
  'topic:webgame',
  'topic:2d-game',
  'topic:pixel-art-game',
  'topic:retro-games',
  'topic:classic-games',
  'topic:hypercasual',
  'topic:js-game',
  'topic:vanilla-js',
  'topic:interactive',
  'topic:game-development',
  'topic:game-dev',
  'topic:canvas',
  'topic:browser',
  'topic:html5-game-engine',
  'topic:javascript-project',
  'topic:mini-game',
  'html5 game in:name',
  'html5 game in:description',
  'browser game in:description',
  'canvas game in:description',
  'javascript game in:description',
  'web game in:description',
  'mini game in:description',
  'html5 canvas game in:description',
  'play online in:description game',
  'game in:name javascript',
  'game in:name canvas',
  'game in:name html5',
  'webgame in:name',
  'mini-game in:name',
  'browser-game in:name',
  'canvas-game in:name',
  'vanilla javascript game in:description',
  'built with canvas in:description',
  'no dependencies game in:description',
];

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

/* ------------------------------------------------------------- sweep */

function sweep() {
  const seen = new Map();
  let queries = 0;

  for (const q of QUERIES) {
    for (const lic of ['mit', 'cc0-1.0', 'apache-2.0', 'bsd-3-clause', 'isc', 'gpl-3.0', 'gpl-2.0', 'lgpl-3.0', 'mpl-2.0']) {
      for (const page of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const raw = gh([
          'api',
          `search/repositories?q=${encodeURIComponent(`${q} license:${lic} stars:>2`)}&per_page=100&page=${page}&sort=stars`,
        ]);
        if (!raw) break;
        let payload = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          break;
        }
        const items = payload.items ?? [];
        if (!items.length) break;
        queries++;
        for (const r of items) {
          if (seen.has(r.full_name)) continue;
          const spdx = r.license?.spdx_id ?? null;
          if (!spdx || !ALLOWED_LICENCE.has(spdx)) continue;
          if (!r.size || r.size > 6000) continue;
          const text = `${r.full_name} ${r.description ?? ''}`.toLowerCase();
          if (SKIP_WORDS.some((w) => text.includes(w))) continue;
          if (!STRONG_GAME_WORDS.some((w) => text.includes(w))) continue;
          seen.set(r.full_name, {
            repo: r.full_name,
            stars: r.stargazers_count ?? 0,
            licence: spdx,
            sizeKB: r.size,
            pushedAt: r.pushed_at ?? '',
            description: (r.description ?? '').trim(),
            defaultBranch: r.default_branch ?? 'main',
            owner: r.owner?.login ?? r.full_name.split('/')[0],
          });
        }
      }
    }
  }

  const list = [...seen.values()].sort((a, b) => b.stars - a.stars);
  writeJson(join(work, 'candidates.json'), list);
  console.log(`sweep: ${queries} queries -> ${list.length} game-shaped candidates`);
  return list;
}

/* ------------------------------------------------------------ vendor */

function slugify(repo) {
  return repo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function vendor() {
  const candidates = readJson(join(work, 'candidates.json'), []);
  const curated = new Set(
    readJson(join(root, 'content/games.json'), { games: [] }).games
      .map((g) => g.credit?.source)
      .filter(Boolean)
      .map((u) => u.replace('https://github.com/', '').replace(/\/$/, '')),
  );
  const results = [];

  for (const c of candidates) {
    if (curated.has(c.repo)) continue;
    const slug = slugify(c.repo);
    const dest = join(thirdParty, slug);
    if (existsSync(join(dest, '.harvested.json'))) {
      results.push(readJson(join(dest, '.harvested.json'), c));
      continue;
    }

    const raw = gh(['api', `repos/${c.repo}/contents/`]);
    if (!raw) continue;
    let files = [];
    try {
      files = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(files)) continue;
    const names = files.map((f) => f.name);
    const hasIndex = names.includes('index.html');
    const licenseFile = names.find((n) => /^licen[cs]e(\.|$)/i.test(n));
    if (!hasIndex || !licenseFile) continue;

    // Pull the repo. Reuse a cached tarball when there is one, so a second
    // validation pass does not re-download everything.
    const tgz = join(work, `${slug}.tgz`);
    if (!existsSync(tgz) || stat(tgz) < 2000) {
      try {
        execFileSync(
          'curl',
          [
            '-sL', '-m', '180',
            `https://codeload.github.com/${c.repo}/tar.gz/refs/heads/${c.defaultBranch}`,
            '-o', tgz,
          ],
          { stdio: 'ignore' },
        );
      } catch {
        continue;
      }
    }
    if (!existsSync(tgz) || stat(tgz) < 2000) continue;

    const tmp = join(work, `x-${slug}`);
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    try {
      execFileSync('tar', ['xzf', tgz, '-C', tmp, '--strip-components=1'], { stdio: 'ignore' });
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      continue;
    }

    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(tmp)) {
      if (entry === '.git' || entry === 'node_modules') continue;
      cpSync(join(tmp, entry), join(dest, entry), { recursive: true });
    }
    rmSync(tmp, { recursive: true, force: true });

    // Readme for real content.
    let readme = '';
    for (const n of ['README.md', 'readme.md', 'README', 'Readme.md']) {
      const p = join(dest, n);
      if (existsSync(p)) {
        readme = readFileSync(p, 'utf8');
        break;
      }
    }

    const meta = {
      ...c,
      slug,
      dest: `third-party/${slug}`,
      readme: readme.slice(0, 6000),
      licenceFile: licenseFile,
    };
    writeJson(join(dest, '.harvested.json'), meta);
    writeFileSync(
      join(dest, 'ARCADEFORK-NOTICE.md'),
      `# ${c.repo} - vendored third-party game

- **Repository:** https://github.com/${c.repo}
- **Author:** ${c.owner}
- **Licence:** ${c.licence} (see ${licenseFile} in this folder)
- **Vendored by:** arcadefork (Ayhem Kahri)

The original ${c.licence} licence text ships in this folder and applies to its contents.
`,
    );
    results.push(meta);
    process.stdout.write(`\r  vendored ${results.length}/${candidates.length} (${slug})   `);
  }
  writeJson(join(work, 'vendored.json'), results);
  console.log(`\nvendor: ${results.length} repos vendored into third-party/`);
  return results;
}

function stat(p) {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

/* ---------------------------------------------------------- validate */

function findChrome() {
  const base = join(homedir(), '.cache/hyperframes/chrome/chrome-headless-shell');
  if (existsSync(base)) {
    for (const v of readdirSync(base)) {
      const p = join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome found');
}

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
  const used = new Set(
    readJson(join(root, 'content/games.json'), { games: [] }).games.map((g) => g.id),
  );
  const titleCounts = new Map(
    readJson(join(root, 'content/games.json'), { games: [] }).games.map((g) => [g.title, 1]),
  );

  for (const v of passed) {
    // Skip anything removed after validation (a second pass may have dropped it).
    if (!existsSync(join(thirdParty, v.slug, 'index.html'))) continue;
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

  writeJson(join(root, 'content/games.generated.json'), { games });
  console.log(`generate: wrote ${games.length} game entries to content/games.generated.json`);
  return games;
}

/* ------------------------------------------------------------- main */

const phase = process.argv[2] ?? 'all';

if (phase === 'sweep' || phase === 'all') sweep();
if (phase === 'vendor' || phase === 'all') vendor();
if (phase === 'validate' || phase === 'all') await validate();
if (phase === 'generate' || phase === 'all') generate();

console.log('\ndone');
