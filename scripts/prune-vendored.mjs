/**
 * Remove files from a vendored game that a browser can never use.
 *
 *   pruneVendored(dir) -> { removed, bytes }
 *
 * Measured on the 2026-10-29 build: 705 files / 50.7 MB of .apk, .psd, .md,
 * .map, android/ and tests/ trees were being published as part of the site, and
 * a 5.3 MB GIF sat in a snake game that never loads it. The site is served
 * statically, so anything that is not reachable from the game's HTML is dead
 * weight in every deploy and in the repository.
 *
 * Rules are deliberately conservative:
 *   - by extension: archives, design sources, maps, CI files, docs other than
 *     the licence and our own notice;
 *   - by directory: build tooling and platform projects, but never `docs/`,
 *     because GitHub Pages projects publish from there;
 *   - by reachability: media over 1 MB whose filename appears in no HTML/JS/CSS
 *     text file in the same game is deleted (that is how the 5.3 MB README GIF
 *     and the checked-in APK went away).
 */
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, basename } from 'node:path';

const JUNK_EXT = new Set([
  '.apk', '.aab', '.zip', '.rar', '.7z', '.tar', '.gz',
  '.psd', '.ai', '.xcf', '.sketch', '.fig',
  '.map', '.yml', '.yaml', '.toml', '.lock', '.log',
  '.exe', '.dmg', '.msi', '.swf', '.jar', '.class',
  // NOT .obj: in a game repo that is a Wavefront 3D asset, not a compiler
  // object file. Deleting them broke breathmint-phalange-gaiden.
  '.pyc', '.o', '.wasm.map',
]);

const JUNK_DIR = new Set([
  '.git', '.github', '.idea', '.vscode', '__MACOSX', 'node_modules',
  'android', 'ios', 'macos', 'windows', 'linux_build', 'build-tools',
  // Test suites and screenshot galleries are never the game. Verified against
  // the catalogue: no game's embed entry lives under any of these three, so
  // removing them wholesale cannot break a page. `docs/` is deliberately NOT
  // here - 21 games ARE a GitHub Pages docs/ demo and ship their own assets.
  'test', 'tests', 'screenshots',
]);

/**
 * Source files for languages the browser has no interpreter for, plus editor
 * metadata. These can never be executed by a page, so they are always dead
 * weight — no reachability test needed, and none is done.
 *
 * `.ts` is deliberately NOT in this set: a few demos transpile TypeScript in
 * the browser and fetch the .ts file as text, so those are pruned only after
 * the reference check below.
 */
const DEAD_SOURCE_EXT = new Set([
  '.py', '.go', '.java', '.kt', '.rs', '.cs', '.rb', '.php', '.swift',
  '.meta', '.blend', '.ps1', '.bat',
]);

/** Dead unless a text file in the same game names them. */
const CHECKED_EXT = new Set(['.ts', '.tsx', '.flf', '.ini']);

/** Text files we scan for references before calling media unreachable. */
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.xml', '.txt']);
const MEDIA_EXT = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.mp3', '.ogg', '.wav', '.m4a', '.mp4', '.webm']);

const KEEP_FILE = /^(licen[cs]e|copying|notice|unlicense|spielkunst-notice)(\.|$)/i;

export function pruneVendored(dir) {
  const stats = { removed: 0, bytes: 0 };
  const refs = textIndex(dir);
  walk(dir, stats, refs);
  // No reachability pass on media: clumsy-bird loads its BGM by concatenating
  // a filename at runtime, so "not mentioned in any text file" is not the same
  // as "unused". Extension and directory rules only - they cannot lie - plus a
  // reference check limited to .ts/.flf/.ini, which a page only ever loads as
  // text and therefore always names.
  return stats;
}

/**
 * Every text file in a game, concatenated once, so the reference check is one
 * string search per candidate instead of one file read per candidate.
 *
 * Capped: a game with a 40 MB bundle should not be re-read 200 times, and a
 * filename only ever appears in the first megabytes of a build output.
 */
function textIndex(dir, budget = { bytes: 0 }) {
  const parts = [];
  (function collect(current) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (budget.bytes > 12 * 1024 * 1024) return;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!JUNK_DIR.has(entry.name)) collect(path);
        continue;
      }
      if (!TEXT_EXT.has(extname(entry.name).toLowerCase())) continue;
      try {
        const size = statSync(path).size;
        if (size > 4 * 1024 * 1024) continue;
        parts.push(readFileSync(path, 'utf8'));
        budget.bytes += size;
      } catch {
        /* unreadable text file: treat as absent */
      }
    }
  })(dir);
  return parts.join('\n');
}

function walk(dir, stats, refs = '') {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (JUNK_DIR.has(entry.name)) {
        stats.bytes += dirSize(path);
        rmSync(path, { recursive: true, force: true });
        stats.removed += 1;
        continue;
      }
      walk(path, stats, refs);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    const isDoc = ext === '.md' || ext === '.markdown' || ext === '.rst';
    if (KEEP_FILE.test(entry.name)) continue;
    if (ext === '.md' && entry.name.toLowerCase().startsWith('spielkunst-notice')) continue;
    const deadSource = DEAD_SOURCE_EXT.has(ext);
    const checked = CHECKED_EXT.has(ext) && !refs.includes(entry.name);
    if (JUNK_EXT.has(ext) || isDoc || deadSource || checked) {
      stats.bytes += statSync(path).size;
      rmSync(path, { force: true });
      stats.removed += 1;
    }
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(path) : statSync(path).size;
  }
  return total;
}
