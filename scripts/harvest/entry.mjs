/**
 * Find a repository's actual entry HTML file.
 *
 * The old preflight demanded `index.html` at the repository root and refused
 * everything else, which cost 181 of 212 candidates in a live sweep - while the
 * catalogue itself has always been happy to embed any path under
 * /third-party/<slug>/ (content/overrides.json ships blockrain's demo.html).
 * Perfectly playable games ship as `docs/index.html` (GitHub Pages),
 * `dist/index.html` (committed build), `game/index.html`, and so on.
 *
 * Pure on purpose: no fs, no network, no clock. The caller decides what a
 * repository's file list is (one `git/trees?recursive=1` call) and whether the
 * answer is worth downloading; this module only ranks the html it was given.
 *
 * Ranking, highest first - a score rather than "first match", because a repo
 * usually has several plausible pages and the most obvious one is often not
 * the game:
 *
 *   100  index.html at the root
 *    90  dist/index.html         committed build
 *    88  build/index.html
 *    86  public/index.html
 *    84  docs/index.html         GitHub Pages convention
 *    80  <game|games|src|www|app|play>/index.html
 *    60  any other <dir>/index.html, shallower first, +5 when a .js sits
 *        next to it (a page next to javascript is a game, not a landing page)
 *    40  a lone *.html at the root, e.g. game.html
 */
/** Directories that never hold the playable entry. */
const NOISE_DIRS = new Set([
  'node_modules',
  'test',
  'tests',
  'example',
  'examples',
  'demo',
  'demos',
  '.github',
  '.git',
  // Documentation-site output: a "game" there is a rendered doc page.
  '_site',
  'coverage',
  'mkdocs',
  'docusaurus',
]);

/** Directory names typed as the GitHub Pages / committed-build convention. */
const PREFERRED_DIRS = new Map([
  ['dist', 90],
  ['build', 88],
  ['public', 86],
  ['docs', 84],
]);

/** Directory names that usually *are* the game. */
const GAME_DIRS = new Set(['game', 'games', 'src', 'www', 'app', 'play']);

/** Root pages that are about the project, never the game. */
const LANDING_PAGE = /^(about|contact|privacy|terms|404|readme)(?:$|[-_])/i;

const HTML_RE = /\.html?$/i;
const JS_RE = /\.m?js$/i;

/** `.\\dist\\index.html` -> `dist/index.html`, `./a.html` -> `a.html`. */
function normalise(path) {
  return String(path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');
}

/**
 * Split a repo-relative path into the parts the rules need.
 * `depth` is the number of directories above the file: root file = 0.
 */
function split(path) {
  const clean = normalise(path);
  const segments = clean.split('/').filter(Boolean);
  const name = segments[segments.length - 1] ?? '';
  const dirs = segments.slice(0, -1);
  return { clean, segments, name, dirs, depth: dirs.length };
}

function isNoise(dirs) {
  return dirs.some((segment) => NOISE_DIRS.has(segment.toLowerCase()));
}

/**
 * @param {string[]} paths repo-relative file paths (a `git/trees` listing)
 * @param {{ maxDepth?: number }} [options] how many directories deep to look
 * @returns {{ entry: string|null, score: number, reason: string }}
 */
export function pickEntry(paths, { maxDepth = 3 } = {}) {
  const list = Array.isArray(paths) ? paths : [];
  const limit = Number.isFinite(Number(maxDepth)) ? Number(maxDepth) : 3;

  // Which directories hold javascript *directly*: the strongest cheap signal
  // that a page in that directory is a game rather than prose.
  const jsDirs = new Set();
  for (const path of list) {
    const { clean, dirs } = split(path);
    if (!clean || !JS_RE.test(clean)) continue;
    if (isNoise(dirs)) continue;
    jsDirs.add(dirs.join('/'));
  }

  const candidates = [];
  for (const path of list) {
    const { clean, name, dirs, depth } = split(path);
    if (!clean || !HTML_RE.test(clean)) continue;
    if (depth > limit) continue; // "anything deeper than maxDepth"
    if (isNoise(dirs)) continue;

    const dirKey = dirs.join('/');
    const hasSiblingJs = jsDirs.has(dirKey);
    const lower = name.toLowerCase();

    if (lower === 'index.html') {
      if (depth === 0) {
        candidates.push({ entry: clean, score: 100, depth, reason: 'root index.html' });
        continue;
      }
      const parent = dirs[dirs.length - 1].toLowerCase();
      const preferred = depth === 1 ? PREFERRED_DIRS.get(parent) : undefined;
      if (preferred !== undefined) {
        candidates.push({
          entry: clean,
          score: preferred,
          depth,
          reason: `${parent}/ is a committed build or GitHub Pages root`,
        });
        continue;
      }
      if (GAME_DIRS.has(parent)) {
        candidates.push({
          entry: clean,
          score: 80,
          depth,
          reason: `${parent}/ is a game directory`,
        });
        continue;
      }
      // Any other directory: shallower is better, javascript next door is
      // better. 60 is the base the catalogue has always assumed.
      candidates.push({
        entry: clean,
        score: 60 - (depth - 1) * 2 + (hasSiblingJs ? 5 : 0),
        depth,
        reason: `nested index.html${hasSiblingJs ? ' next to javascript' : ''}`,
      });
      continue;
    }

    // Rule 5 is about the repository root only: the game page is the site.
    if (depth !== 0) continue;
    const stem = lower.replace(/\.[^.]+$/, '');
    if (LANDING_PAGE.test(stem)) continue;
    candidates.push({ entry: clean, score: 40, depth, reason: `root page ${clean}` });
  }

  if (!candidates.length) {
    return {
      entry: null,
      score: 0,
      reason: `no usable html entry within ${limit} director${limit === 1 ? 'y' : 'ies'}`,
    };
  }

  // Highest score, then shallowest, then alphabetical so two runs over the
  // same tree always agree.
  candidates.sort(
    (a, b) => b.score - a.score || a.depth - b.depth || a.entry.localeCompare(b.entry),
  );
  const best = candidates[0];
  const tied = candidates.filter((c) => c.score === best.score && c.depth === best.depth).length;
  return {
    entry: best.entry,
    score: best.score,
    reason: tied > 1 ? `${best.reason} (best of ${tied})` : best.reason,
  };
}

/**
 * The cheap sanity check before any download: a repo with neither javascript
 * nor html cannot be a playable browser game. Used to drop obvious dead ends
 * without spending a vendor slot on them.
 *
 * @param {string[]} paths
 * @returns {boolean}
 */
export function looksLikeGameShell(paths) {
  const list = Array.isArray(paths) ? paths : [];
  let html = false;
  let js = false;
  for (const path of list) {
    const { clean, dirs } = split(path);
    if (!clean || isNoise(dirs)) continue;
    if (HTML_RE.test(clean)) html = true;
    else if (JS_RE.test(clean)) js = true;
    if (html && js) return true;
  }
  return false;
}
