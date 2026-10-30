/**
 * Remove files from a vendored game that a browser can never use — and cut the
 * file COUNT, not just the bytes.
 *
 *   pruneVendored(dir)            -> { removed, bytes, rules, ... }  (deletes)
 *   pruneVendored(dir, {dryRun})  -> the same shape, nothing deleted
 *
 *   node scripts/prune-vendored.mjs            -> dry run, prints the table
 *   node scripts/prune-vendored.mjs --apply    -> deletes what the rules cover
 *
 * Why the count matters: Cloudflare Pages rejects a deployment above 20,000
 * files, and the built site reached 19,655 in October 2026 (345 files of
 * headroom; 18,363 after this pass). A single asset-heavy repository (or one
 * more locale) breaches that,
 * and the deploy fails at upload time, after a 15-minute build. Bytes are the
 * other half of the same problem: 660 MB is stored and transferred on every
 * cold visit. So this pass removes what is provably not part of the game, and
 * `scripts/audit-size.mjs` fails the build when either number is over budget.
 *
 * The rule is reachability first, rule class second. A file is deleted only
 * when BOTH hold:
 *
 *   1. it is not reachable from the game's entry page (a transitive walk of
 *      href/src/srcset/url()/@import/import/fetch/require/new Audio(...)/
 *      new Worker(...) references, plus any quoted local path inside the
 *      loaded text), and its filename is not mentioned anywhere in the game's
 *      text — clumsy-bird concatenates its BGM filename at runtime, so
 *      "mentioned but not statically reachable" must not be deleted;
 *   2. it matches one of the rule classes below (dev tree, unreferenced
 *      docs/ image, archive, source map, half of a minified pair, duplicate
 *      media format, source in a non-web language, docs prose, CI config,
 *      VCS/editor metadata).
 *
 * If the entry page cannot be resolved, nothing in that game is removed: an
 * unknown entry makes every reachability verdict doubtful, and a doubtful
 * verdict keeps the file.
 *
 * Entry resolution mirrors the catalogue: every `embed.src` in content/*.json
 * that points into /third-party/<slug>/, plus scripts/harvest/entry.mjs
 * (pickEntry) — the same ranking the harvest uses. A repository that hosts
 * several games therefore seeds the walk with all of them, not just the first.
 */
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pickEntry } from './harvest/entry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MB = 1024 * 1024;

/* ------------------------------------------------------------ rule tables */

/** Directories that hold a project's development life, never a playable page. */
const DEV_DIR = new Set([
  'test', 'tests', 'spec', 'specs', '__tests__', '__mocks__', 'e2e', 'cypress',
  'playwright', 'examples', 'example', 'samples', 'sample',
  'screenshots', 'screenshot', 'coverage', '.nyc_output',
  '.git', '.github', '.gitlab', '.circleci', 'travis',
  '.idea', '.vscode', '.devcontainer', '__MACOSX', 'node_modules',
  'android', 'ios', 'macos', 'windows', 'linux_build', 'build-tools',
]);

/**
 * `docs/` is NOT a dev tree: 24 vendored repositories ARE a GitHub Pages site
 * whose game lives in docs/index.html, and their assets are the game. Only
 * images inside docs/ are pruned, and only when unreachable — a doc page's
 * screenshots never load into the canvas.
 */
const DOCS_DIR = new Set(['docs', 'doc']);
// .ico is deliberately absent: it is a page's favicon, not a gallery image, and
// a broken <link rel="icon"> is a visible 404 in a way a dropped screenshot is
// not.
const IMAGE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.tif', '.tiff',
]);
const AV_EXT = new Set([
  '.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus',
  '.mp4', '.webm', '.ogv', '.mov', '.m4v',
]);
const MEDIA_EXT = new Set([...IMAGE_EXT, ...AV_EXT]);

/** Rule class (d): things a browser cannot open at all. */
const ARCHIVE_EXT = new Set([
  '.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.tgz',
  '.apk', '.aab', '.ipa', '.dmg', '.exe', '.msi', '.jar', '.class', '.swf',
  '.psd', '.ai', '.xcf', '.sketch', '.fig', '.blend', '.max', '.c4d',
]);

/** Source for a language the page has no interpreter for. */
const DEAD_SOURCE_EXT = new Set([
  '.py', '.pyc', '.go', '.java', '.kt', '.rs', '.cs', '.rb', '.php', '.swift',
  '.ps1', '.bat', '.sh', '.pl', '.lua',
  // Compiled-and-checked-in languages a browser cannot run. Real in this
  // corpus: game repositories ship their C/C++ sources next to the Emscripten
  // build, and a TypeScript game ships its .ts next to the bundled .js.
  '.ts', '.tsx', '.jsx', '.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.hxx',
  '.m', '.mm', '.asm', '.nim', '.dart', '.hs', '.scala', '.ex', '.exs', '.jl',
  // Build inputs and dead formats: preprocessors with no runtime meaning in a
  // static deploy, figlet fonts, and JSON-with-comments (browsers refuse it).
  '.scss', '.sass', '.less', '.styl', '.coffee', '.pug', '.jade', '.jsonc',
  '.flf', '.pde',
  // NOT .obj: in a game repository that suffix is a Wavefront 3D asset, not a
  // compiler object file, so it is never in this list.
  '.o', '.meta',
]);

const DOC_EXT = new Set(['.md', '.markdown', '.rst', '.adoc', '.rdoc']);
const CONFIG_EXT = new Set([
  '.yml', '.yaml', '.toml', '.lock', '.log', '.ini', '.editorconfig', '.gitignore',
  '.gitattributes', '.prettierrc', '.eslintrc', '.babelrc',
]);

/** Text we read: both to walk references and to look for a filename mention. */
const TEXT_EXT = new Set([
  '.html', '.htm', '.xhtml', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.css', '.json', '.json5', '.xml', '.txt', '.svg', '.md',
  '.glsl', '.frag', '.vert', '.shader', '.fnt', '.atlas', '.tmf',
  '.webmanifest', '.manifest', '.csv',
]);

/**
 * Licence and attribution files are never touched — not by a rule, not by a
 * reachability verdict, not for file-count budget. This is an obligation, not
 * an optimisation: `SPIELKUNST-NOTICE.md` (the older `ARCADEFORK-NOTICE.md` in
 * trees vendored before the rename), `LICENSE*`, `COPYING*`, `NOTICE*`,
 * `AUTHORS*` and the third-party manifest ship next to every vendored game.
 *
 * The anywhere-in-the-name form matters: a repo that ships
 * `THIRD-PARTY-NOTICE.txt` or `LICENSE-MIT` keeps both, and a count budget is
 * never a reason to drop attribution.
 */
const KEEP_FILE = /(?:^|[-_.])(?:licen[cs]e|copying|notice|unlicense|authors|manifest)(?:$|[-_.])/i;

/**
 * A vendored README at the repository root is where many of these projects
 * state their licence and author, so it is exempt from the docs-prose rule at
 * depth 0-1 (root, or one folder down). Only nested documentation is prose.
 */
const ROOT_README = /^readme(?:\.[a-z0-9]+)?$/i;

/**
 * Version-control, editor and harvest bookkeeping: never requested by a page.
 * `EXT` cannot see these — `.gitignore` has no extension — so they are matched
 * by name.
 */
const DEV_METADATA = new Set([
  '.gitignore', '.gitattributes', '.gitmodules', '.gitkeep', '.git-blame-ignore-revs',
  '.editorconfig', '.babelrc', '.browserslistrc', '.eslintrc', '.eslintignore',
  '.prettierrc', '.prettierignore', '.npmrc', '.nvmrc', '.stylelintrc',
  '.hgignore', '.mailmap', '.ds_store', '.harvested.json', '.gitignore.txt',
]);

/* --------------------------------------------------------------- helpers */

const lower = (s) => s.toLowerCase();
const nameOf = (rel) => rel.slice(rel.lastIndexOf('/') + 1);
const dirOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const segments = (rel) => rel.split('/').slice(0, -1).map(lower);
const stemOf = (rel) => {
  const name = nameOf(rel);
  const ext = extname(name);
  return join(dirOf(rel), name.slice(0, name.length - ext.length));
};

function listFiles(dir) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    let entries;
    try {
      entries = readdirSync(join(dir, relDir), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        stack.push(rel);
        continue;
      }
      let size;
      try {
        const stat = statSync(join(dir, rel));
        if (!stat.isFile()) continue;
        size = stat.size;
      } catch {
        continue;
      }
      out.push({ rel, size, ext: lower(extname(entry.name)), name: entry.name });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/* ------------------------------------------------------- entry resolution */

let CATALOGUE = null;

/**
 * Every embed.src in the catalogue layers, grouped by third-party slug.
 *
 * Parsed once per process (the build calls pruneVendored once per game) and
 * read defensively: a missing or half-written layer is skipped, because the
 * fallback — pickEntry — is enough to resolve a normal repository, and a pruner
 * must never be the reason a build dies.
 */
function catalogueBySlug() {
  if (CATALOGUE) return CATALOGUE;
  const map = new Map();
  CATALOGUE = map;
  const layers = [
    'content/games.json',
    'content/games.generated.json',
    'content/engine-new.json',
    'content/curated.json',
    'content/harvest-published.json',
    'content/overlays.json',
  ];
  const seen = new Set();
  const collect = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) collect(item);
      return;
    }
    const src = node.embed?.src;
    if (typeof src === 'string') {
      const parsed = /^\/third-party\/([^/?#]+)\/([^?#]+)/.exec(src);
      if (parsed) {
        let rel = parsed[2];
        try {
          rel = decodeURIComponent(rel);
        } catch {
          /* keep the raw path */
        }
        if (!map.has(parsed[1])) map.set(parsed[1], new Set());
        map.get(parsed[1]).add(rel);
      }
    }
    for (const value of Object.values(node)) collect(value);
  };
  for (const layer of layers) {
    try {
      collect(JSON.parse(readFileSync(join(ROOT, layer), 'utf8')));
    } catch {
      /* absent or unreadable layer: pickEntry still resolves the entry */
    }
  }
  return map;
}

/**
 * The pages a game is published as: every catalogue embed.src into this slug,
 * plus the best entry pickEntry would choose. Empty means "no idea", and the
 * caller then keeps everything.
 */
function resolveEntries(dir, files) {
  const slug = basename(dir);
  const html = files.filter((f) => /\.x?html?$/i.test(f.rel)).map((f) => f.rel);
  const pageSet = new Set(html);
  const entries = new Set();
  for (const rel of catalogueBySlug().get(slug) ?? []) {
    if (pageSet.has(rel)) entries.add(rel);
  }
  const picked = pickEntry(html);
  if (picked.entry) entries.add(picked.entry);
  return [...entries].sort();
}

/* ------------------------------------------------------- reference walking */

/**
 * Attribute/path patterns a static page can load a local file with.
 *
 * `pageBase` marks references the *document* resolves, not the file that
 * contains the string: `new Audio("sfx/boom.ogg")` inside js/game.js loads
 * /sfx/boom.ogg, because Audio resolves against the page. Only src/href/url()
 * and ES imports resolve against the containing file.
 */
const REF_PATTERNS = [
  // src="…", href='…', poster=…, data-src=… — quoted or bare.
  { re: /\b(?:src|href|poster|data-src|data-href|data-url|data-file|data-path|data-asset|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/gi },
  // srcset="a.png 1x, b.png 2x" — comma separated, with descriptors.
  { re: /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, srcset: true },
  // url(...) in CSS and inline styles: relative to the stylesheet.
  { re: /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi },
  // @import "x.css"
  { re: /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi },
  // import x from '…' / export … from '…'
  { re: /\bfrom\s*["']([^"']+)["']/g },
  // import('…')
  { re: /\bimport\s*\(\s*["']([^"']+)["']/g },
  // import '…' / import("…") / require('…')
  { re: /\b(?:import|require)\s*\(\s*["']([^"']+)["']/g },
  { re: /\bimport\s+["']([^"']+)["']/g },
  // fetch('…'), new Audio('…'), new Worker('…'), importScripts('…') …: the URL
  // is resolved by the browser against the document, not the script.
  {
    re: /\b(?:fetch|Worker|SharedWorker|Audio|Image|WebSocket|EventSource|XMLHttpRequest|importScripts|locateFile|createElement)\s*\(\s*["']([^"']+)["']/g,
    pageBase: true,
  },
  // xhr.open('GET', '…')
  { re: /\.open\s*\(\s*["'][A-Za-z]+["']\s*,\s*["']([^"']+)["']/g, pageBase: true },
  // Any quoted string that looks like a local asset path — catches runtime
  // concatenation ("assets/" + name) and manifests that name files as data.
  {
    re: /["'`]([^"'`\s<>(){}]+\.(?:js|mjs|cjs|css|html?|xhtml|png|jpe?g|gif|webp|avif|svg|ico|mp3|ogg|oga|wav|m4a|aac|flac|opus|mp4|webm|ogv|mov|json|xml|txt|csv|woff2?|ttf|otf|eot|wasm|glb|gltf|obj|mtl|fbx|bin|dat|pak|unity3d|fnt|atlas|tmx|ts|tsx|zip|data)["'`])/gi,
    pageBase: true,
  },
];

/** @returns {{ref: string, pageBase: boolean}[]} */
function extractRefs(text) {
  const refs = [];
  if (!text) return refs;
  for (const { re, srcset, pageBase } of REF_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (!raw) continue;
      if (srcset) {
        for (const part of raw.split(',')) {
          const url = part.trim().split(/\s+/)[0];
          if (url) refs.push({ ref: url, pageBase: true });
        }
        continue;
      }
      refs.push({ ref: raw, pageBase: pageBase === true });
    }
  }
  return refs;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i;

/**
 * Resolve a reference to a file in the tree, or null.
 *
 * `pageDirs` are the directories of the entry pages: a runtime load
 * (`fetch`, `new Audio`) is resolved against those as well as against the file
 * that contains the string, because the browser picks the document as base.
 */
function resolveRef(raw, fromRel, index, slug, pageDirs = []) {
  let ref = raw.replace(/&amp;/g, '&').trim();
  if (!ref || ref.includes('${') || EXTERNAL.test(ref)) return null;
  const absolute = ref.startsWith('/');
  ref = ref.split('#')[0].split('?')[0];
  if (!ref) return null;
  try {
    ref = decodeURIComponent(ref);
  } catch {
    /* malformed escape: try the raw string */
  }
  ref = ref.replace(/\\/g, '/');
  // An absolute site path may carry the deploy prefix.
  if (ref.startsWith('/')) {
    ref = ref.slice(1);
    if (ref.startsWith(`third-party/${slug}/`)) ref = ref.slice(`third-party/${slug}/`.length);
  }
  const bases = absolute ? [''] : [...new Set([dirOf(fromRel), ...pageDirs])];
  for (const base of bases) {
    const parts = base ? base.split('/') : [];
    for (const segment of ref.split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        parts.pop();
        continue;
      }
      parts.push(segment);
    }
    const joined = parts.join('/');
    for (const candidate of [joined, `${joined}/index.html`, `${joined}.html`]) {
      if (!candidate) continue;
      if (index.exact.has(candidate)) return candidate;
      const folded = index.folded.get(lower(candidate));
      if (folded) return folded;
    }
  }
  return null;
}

/**
 * Walk every reference reachable from the entry pages, transitively.
 *
 * @returns {Set<string>} relative paths that the page can load
 */
export function walkReachable(files, entries, texts, slug) {
  const index = {
    exact: new Set(files.map((f) => f.rel)),
    folded: new Map(files.map((f) => [lower(f.rel), f.rel])),
  };
  const pageDirs = [...new Set(entries.map(dirOf))];
  const reachable = new Set();
  const queue = [...entries];
  while (queue.length) {
    const next = queue.shift();
    if (reachable.has(next)) continue;
    reachable.add(next);
    const text = texts.get(next);
    if (!text) continue;
    for (const ref of extractRefs(text)) {
      const target = resolveRef(ref.ref, next, index, slug, ref.pageBase ? pageDirs : []);
      if (target && !reachable.has(target)) queue.push(target);
    }
  }
  return reachable;
}

/* ------------------------------------------------------------- the rules */

/**
 * Which rule class a file belongs to, given it is already known to be
 * unreachable. Returns null for "keep, no rule covers it".
 */
function classify(file, ctx) {
  const parts = segments(file.rel);
  if (ctx.protectedPrefixes.some((prefix) => file.rel.startsWith(`${prefix}/`))) return null;
  if (parts.some((part) => DEV_DIR.has(part))) return 'dev-tree';
  if (!ctx.docsIsRoot && parts.some((part) => DOCS_DIR.has(part)) && IMAGE_EXT.has(file.ext)) {
    return 'docs-image';
  }
  if (DEV_METADATA.has(lower(file.name))) return 'dev-metadata';
  if (ARCHIVE_EXT.has(file.ext)) return 'archive';
  if (file.ext === '.map') return 'source-map';
  if (ctx.minifiedCounterpart?.has(file.rel)) return 'minified-dup';
  if (MEDIA_EXT.has(file.ext) && ctx.mediaCounterpart?.has(file.rel)) return 'dup-media';
  // The safe half of the unreachable pool: an image no page loads and no text in
  // the game names. Code (.js/.html/.json) is deliberately NOT covered — a path
  // can be assembled at runtime in a way no text mentions — but an image is
  // only ever referenced by name, and the stem net above already rescued every
  // image whose name appears in a sprite table. `.ico` is exempt: a browser
  // requests /favicon.ico without being told to.
  if (IMAGE_EXT.has(file.ext) && file.ext !== '.ico') {
    // A game that assembles image paths at run time (${id}.png, 'font/' + c +
    // '.png') proves nothing by not naming this file - see buildsPathsAtRuntime.
    if (ctx.runtimePaths) return null;
    if (ctx.docsIsRoot && parts.some((part) => DOCS_DIR.has(part))) return null;
    return 'unreached-image';
  }
  if (DEAD_SOURCE_EXT.has(file.ext)) return 'dead-source';
  if (DOC_EXT.has(file.ext)) {
    const depth = file.rel.split('/').length - 1;
    if (ROOT_README.test(file.name) && depth <= 1) return null;
    return 'docs';
  }
  if (CONFIG_EXT.has(file.ext)) return 'ci-config';
  return null;
}

/**
 * Media formats that duplicate a format the page does keep: music.ogg is
 * reachable, music.mp3 is not. Only a *kept* sibling makes the other one safe
 * to drop — two unreachable copies are left to the rules above, not guessed at.
 */
function mediaCounterparts(files, kept, has) {
  const byStem = new Map();
  for (const file of files) {
    if (!MEDIA_EXT.has(file.ext)) continue;
    const stem = stemOf(file.rel);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(file);
  }
  const out = new Set();
  for (const group of byStem.values()) {
    if (group.length < 2) continue;
    for (const file of group) {
      if (kept.has(file.rel)) continue;
      if (group.some((other) => other.rel !== file.rel && other.ext !== file.ext && kept.has(other.rel))) {
        out.add(file.rel);
      }
    }
  }
  return out;
}

/**
 * foo.js next to foo.min.js: keep whichever the page loads, drop the other —
 * but only when exactly one of the pair is kept. If neither is reachable the
 * pair is left alone (the minified build may be named at runtime).
 */
function minifiedCounterparts(files, kept) {
  const present = new Set(files.map((f) => f.rel));
  const out = new Set();
  for (const file of files) {
    if (!/\.(?:m?js|css)$/.test(file.ext)) continue;
    if (kept.has(file.rel)) continue;
    const stem = stemOf(file.rel);
    const name = nameOf(file.rel);
    const ext = file.ext;
    const other = name.includes('.min.')
      ? join(dirOf(file.rel), name.replace('.min.', '.'))
      : join(dirOf(file.rel), `${name.slice(0, name.length - ext.length)}.min${ext}`);
    if (present.has(other) && kept.has(other)) out.add(file.rel);
  }
  return out;
}

/* --------------------------------------------------------------- analysis */

/**
 * Does this game build image paths at run time instead of naming them?
 *
 * `data/font/basic-' + colour + '.png`, `` `${id}.png` ``, `img/frameset/${dir}/${n}.png`
 * - the file name never appears in the text, so "unreachable and unmentioned"
 * says nothing about it. Cocos, Phaser and Godot exports name every asset this
 * way (hash-named raw-assets), and deleting them ships a blank canvas. If the
 * game's own text shows the pattern anywhere, that game keeps its images and
 * the byte budget has to come from somewhere else.
 */
function buildsPathsAtRuntime(blob) {
  const EXT = '(?:png|jpe?g|gif|webp|svg|bmp)';
  return (
    // The strongest signal there is: the extension on its own in a string
    // literal, `resource.src += '.png'`, `[ '.png', '.json' ]`. A game that
    // writes the suffix separately is naming its images at run time.
    new RegExp('[\'"]\\.' + EXT + '[\'"]', 'i').test(blob) ||
    // template literal: `${...}.png`
    new RegExp('`[^`]{0,120}\\$\\{[^}]{1,80}\\}[^`]{0,120}\\.' + EXT + '`', 'i').test(blob) ||
    // concatenation either way round: "a/" + name + ".png"
    new RegExp('[\'"][^\'"]{0,120}\\.' + EXT + '[\'"]\\s*\\+', 'i').test(blob) ||
    new RegExp('\\+\\s*[\'"][^\'"]{0,120}\\.' + EXT + '[\'"]', 'i').test(blob)
  );
}

/**
 * Read the game's text once. Capped: a 40 MB bundle should not be re-read per
 * candidate, and a filename only ever appears in the first megabytes of a
 * build output. A game that busts the cap simply looks less reachable — which
 * keeps files rather than deleting them.
 */
function readTexts(dir, files, { perFile = 4 * MB, total = 24 * MB } = {}) {
  const texts = new Map();
  let used = 0;
  for (const file of files) {
    if (used >= total) break;
    if (!TEXT_EXT.has(file.ext)) continue;
    if (file.size > perFile) continue;
    try {
      texts.set(file.rel, readFileSync(join(dir, file.rel), 'utf8'));
      used += file.size;
    } catch {
      /* unreadable: treated as absent */
    }
  }
  return texts;
}

/**
 * Everything the pruner knows about one vendored directory: what the page can
 * reach, what it mentions, and which unreachable files a rule covers.
 *
 * Pure apart from reading the directory — no deletion happens here, which is
 * what makes `--dry-run` and the tests trustworthy.
 */
export function analyseVendored(dir) {
  const files = listFiles(dir);
  const entries = resolveEntries(dir, files);
  const slug = basename(dir);
  const texts = readTexts(dir, files);
  const reachable = walkReachable(files, entries, texts, slug);

  // Mentioned-but-not-statically-reachable counts as reachable: a filename that
  // appears in the game's own text may be loaded by string concatenation. Names
  // under four characters match too much to mean anything, so those are kept as
  // well rather than guessed away.
  const blob = [...texts.values()].join('\n');
  const mentioned = new Set();
  const stemMentioned = new Set();
  for (const file of files) {
    if (file.name.length < 4 || blob.includes(file.name)) mentioned.add(file.rel);
    // The stem net is for media only: a sprite table names `icons/${id}.png`,
    // while a script's stem is `game.js` in `game.js.map` — a false positive
    // that would keep every source map in the tree.
    if (!MEDIA_EXT.has(file.ext)) continue;
    const stem = nameOf(stemOf(file.rel));
    if (stem.length >= 5 && blob.includes(stem)) stemMentioned.add(file.rel);
  }
  const kept = new Set([...reachable, ...mentioned]);
  for (const file of files) {
    if (KEEP_FILE.test(file.name)) kept.add(file.rel);
  }

  // A mention only counts for a file a browser could load. Two cases where it
  // proves nothing and the rule class decides instead:
  //   - inside a development tree, `tests/run.py` is named by package.json;
  //   - a language or archive no page can execute or open (.py, .psd, .zip,
  //     .map), however often the README names it.
  // Reachability and licence files still win over both.
  const unloadable = (file) => DEAD_SOURCE_EXT.has(file.ext) || ARCHIVE_EXT.has(file.ext) || file.ext === '.map';
  for (const file of files) {
    if (reachable.has(file.rel) || KEEP_FILE.test(file.name)) continue;
    const devTree = segments(file.rel).some((part) => DEV_DIR.has(part));
    if (devTree || unloadable(file)) kept.delete(file.rel);
  }

  // A docs/ page is the publish root for the 24 repositories that host their
  // game on GitHub Pages: docs/assets/ there is sprite data, not screenshots,
  // and it is loaded by name from a table in the game's own JS.
  const docsIsRoot = entries.some((entry) => segments(entry).some((part) => DOCS_DIR.has(part)));

  // If a published page ever lives inside a tree this file prunes by name
  // (tests/, docs/, android/ …), that tree is the game, not tooling. No
  // catalogue layer does this today; the guard costs one Set lookup and means
  // the rule cannot ship a 404 the day one does.
  const protectedPrefixes = new Set();
  for (const entry of entries) {
    let prefix = '';
    for (const part of entry.split('/').slice(0, -1)) {
      prefix = prefix ? `${prefix}/${part}` : part;
      if (DEV_DIR.has(part) || DOCS_DIR.has(part)) protectedPrefixes.add(prefix);
    }
  }

  const ctx = {
    runtimePaths: buildsPathsAtRuntime(blob),
    docsIsRoot,
    protectedPrefixes: [...protectedPrefixes],
    mediaCounterpart: mediaCounterparts(files, kept),
    minifiedCounterpart: minifiedCounterparts(files, kept),
  };

  // A second, weaker net for data tables that name an asset by stem only
  // (`assets/icons/${id}.png` with `id: "potion"` in a JS array). It is weaker
  // than a filename, so it does not override the duplicate rules: a kept
  // sibling is proof the other format is unused, whatever the text says.
  const DUPLICATE_RULES = new Set(['dup-media', 'minified-dup']);

  // No entry means every reachability verdict is doubtful: keep the lot.
  const candidates = entries.length
    ? files
        .filter((file) => !kept.has(file.rel))
        .map((file) => ({ ...file, rule: classify(file, ctx) }))
        .filter((file) => {
          if (!file.rule) return false;
          return DUPLICATE_RULES.has(file.rule) || !stemMentioned.has(file.rel);
        })
    : [];

  return { dir, slug, files, entries, reachable, kept, candidates };
}

/**
 * Prune one copied game.
 *
 * @param {string} dir absolute path to dist/third-party/<slug>
 * @param {{ dryRun?: boolean, entries?: string[] }} [options]
 * @returns {{ removed: number, bytes: number, rules: Record<string, {files: number, bytes: number}>, resolved: string[], dryRun: boolean }}
 */
export function pruneVendored(dir, options = {}) {
  const dryRun = options.dryRun === true;
  const report = analyseVendored(dir);
  const rules = {};
  let removed = 0;
  let bytes = 0;
  for (const candidate of report.candidates) {
    if (!dryRun) {
      try {
        rmSync(join(dir, candidate.rel), { force: true });
      } catch {
        continue; // could not delete: do not count it as removed
      }
    }
    removed += 1;
    bytes += candidate.size;
    const bucket = (rules[candidate.rule] ??= { files: 0, bytes: 0 });
    bucket.files += 1;
    bucket.bytes += candidate.size;
  }
  return { removed, bytes, rules, resolved: report.entries, dryRun };
}

/* -------------------------------------------------------------------- CLI */

const RULE_LABEL = {
  'dev-tree': 'development tree (tests, examples, CI, platform projects)',
  'docs-image': 'docs/ image',
  archive: 'archive / design source (.zip .7z .apk .psd .ai …)',
  'source-map': 'source map',
  'minified-dup': 'minified/unminified duplicate',
  'dup-media': 'duplicate audio/video format',
  'unreached-image': 'image no page loads and no text names',
  'dead-source': 'source in a non-web language',
  docs: 'docs prose (.md .rst)',
  'ci-config': 'CI / editor config',
  'dev-metadata': 'VCS / editor / harvest metadata',
};

const mb = (bytes) => (bytes / MB).toFixed(1);

function cli() {
  const argv = process.argv.slice(2);
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  // Deleting is opt-in. A flag typo must not edit the vendored tree: `--json`
  // and `--dry-run` both print the table and touch nothing.
  const dryRun = !argv.includes('--apply');
  const asJson = argv.includes('--json');
  const single = value('dir');
  const root = single ?? value('root') ?? join(ROOT, 'third-party');

  let dirs = [root];
  if (!single) {
    try {
      dirs = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(root, entry.name))
        .sort();
    } catch {
      console.error(`prune-vendored: ${root} is missing`);
      process.exit(1);
    }
  }

  const totals = {};
  let removed = 0;
  let bytes = 0;
  let unresolved = 0;

  for (const dir of dirs) {
    const result = pruneVendored(dir, { dryRun });
    if (!result.resolved.length) unresolved += 1;
    removed += result.removed;
    bytes += result.bytes;
    for (const [rule, bucket] of Object.entries(result.rules)) {
      const total = (totals[rule] ??= { files: 0, bytes: 0 });
      total.files += bucket.files;
      total.bytes += bucket.bytes;
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ dryRun, dirs: dirs.length, removed, bytes, rules: totals, unresolved }, null, 2));
    return;
  }

  const rows = Object.entries(totals).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [rule, bucket] of rows) {
    console.log(
      `  ${rule.padEnd(13)} ${String(bucket.files).padStart(6)} files ${mb(bucket.bytes).padStart(8)} MB  ${RULE_LABEL[rule] ?? ''}`,
    );
  }
  const verb = dryRun ? 'would remove' : 'removed';
  console.log(
    `prune-vendored: ${verb} ${removed} files / ${mb(bytes)} MB ` +
      `from ${dirs.length} vendored games` +
      (unresolved ? ` (${unresolved} without a resolvable entry, kept whole)` : '') +
      (dryRun ? ' — dry run, nothing deleted (pass --apply to delete)' : ''),
  );
  if (!removed) console.log('prune-vendored: nothing to prune');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
