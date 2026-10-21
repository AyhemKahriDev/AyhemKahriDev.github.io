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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, '.harvest');
const thirdParty = join(root, 'third-party');
mkdirSync(work, { recursive: true });

const ALLOWED_LICENCE = new Map([
  ['MIT', 'MIT'],
  ['CC0-1.0', 'CC0-1.0'],
  ['Apache-2.0', 'Apache-2.0'],
  ['BSD-3-Clause', 'BSD-3-Clause'],
  ['BSD-2-Clause', 'BSD-2-Clause'],
  ['ISC', 'ISC'],
  ['Unlicense', 'Unlicense'],
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
    for (const lic of ['mit', 'cc0-1.0', 'apache-2.0', 'bsd-3-clause', 'isc']) {
      for (const page of [1, 2, 3, 4]) {
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

    // Pull the repo.
    const tgz = join(work, `${slug}.tgz`);
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

  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const passed = [];
  let index = 0;

  for (const v of vendored) {
    index++;
    const entry = `http://localhost:${process.env.HARVEST_PORT ?? 4191}/third-party/${v.slug}/index.html`;
    let ok = false;
    let reason = '';

    try {
      const errors = [];
      const onErr = (e) => errors.push(String(e.message ?? e));
      page.on('pageerror', onErr);
      const bad = [];
      page.on('response', (r) => {
        if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
      });

      await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1800));

      const probe = await page.evaluate(() => {
        const canvases = [...document.querySelectorAll('canvas')];
        const canvasPixels = canvases.reduce((total, c) => {
          try {
            const ctx = c.getContext('2d');
            if (!ctx) return total;
            const d = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 400)).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            return total + n;
          } catch {
            return total;
          }
        }, 0);
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const hasControls = document.querySelectorAll('button, a, input, [role=button]').length;
        return {
          canvasPixels,
          textLen: text.length,
          text: text.slice(0, 300),
          controls: hasControls,
          canvases: canvases.length,
          title: document.title ?? '',
        };
      });

      const fatal = errors.filter((e) => !/favicon|ERR_/.test(e));
      // Only same-origin failures matter - a game's own analytics or ribbon
      // images failing is not a broken game.
      const missing = bad.filter((b) => !/favicon/.test(b) && b.includes('localhost'));

      // A game must paint something or present a real interface.
      const paints = probe.canvasPixels > 500;
      const interactive = probe.textLen > 120 && probe.controls >= 1;
      const looksLikeAnError = /404|not found|error occurred/i.test(probe.text);

      if (looksLikeAnError) {
        reason = 'page reports an error';
      } else if (!paints && !interactive) {
        reason = `nothing playable (canvas ${probe.canvasPixels}px, text ${probe.textLen})`;
      } else if (missing.length > 4) {
        reason = `${missing.length} failed resources`;
      } else if (fatal.length > 0) {
        reason = `js error: ${fatal[0].slice(0, 80)}`;
      } else {
        ok = true;
      }

      page.off('pageerror', onErr);
    } catch (err) {
      reason = `load failed: ${String(err.message).slice(0, 60)}`;
    }

    if (ok) {
      passed.push(v);
      writeJson(join(thirdParty, v.slug, '.harvested.json'), { ...v, validated: true });
    } else {
      rmSync(join(thirdParty, v.slug), { recursive: true, force: true });
    }
    process.stdout.write(`\r  validated ${index}/${vendored.length} (kept ${passed.length})   `);
  }

  await browser.close();
  writeJson(join(work, 'passed.json'), passed);
  console.log(`\nvalidate: ${passed.length}/${vendored.length} passed the browser gate`);
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
    .replace(/\b(html5|js|javascript|canvas|web|game|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) t = base;
  t = t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (t.length > 42) t = `${t.slice(0, 40)}…`;
  return t;
}

function readmeSentences(readme) {
  if (!readme) return [];
  const cleaned = readme
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>|]/g, ' ')
    .replace(/\r/g, '');
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 320 && !/^[-*=|]/.test(s));
  return parts.slice(0, 12);
}

function generate() {
  const passed = readJson(join(work, 'passed.json'), []);
  const games = [];
  const used = new Set(
    readJson(join(root, 'content/games.json'), { games: [] }).games.map((g) => g.id),
  );

  for (const v of passed) {
    let slug = v.slug;
    let n = 2;
    while (used.has(slug)) slug = `${v.slug}-${n++}`;
    used.add(slug);

    const sentences = readmeSentences(v.readme);
    const desc = v.description || sentences[0] || '';
    const title = titleFrom(v.repo, v.description);

    const prose = sentences.filter((s) => !desc.toLowerCase().startsWith(s.slice(0, 20).toLowerCase()));
    const howToPlay = (prose.length ? prose : sentences).slice(0, 5).map((s) => ({
      ...s,
    }));
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

    games.push({
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
    });
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
