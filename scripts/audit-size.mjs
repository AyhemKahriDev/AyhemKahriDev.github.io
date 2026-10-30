/**
 * Size gate for the published site.
 *
 *   node scripts/audit-size.mjs [--dist <dir>] [--json]
 *
 * The catalogue is heading for ~600 vendored games, and a static host does not
 * charge for compute, it charges for bytes moved. Two things destroy that
 * budget quietly:
 *
 *   - one "game" that ships a 40 MB asset pack (a PSD, a WAV soundtrack, a
 *     Unity build) and drags the whole deploy with it;
 *   - a thousand small files nobody can use - .apk, .psd, .md, .map, test
 *     trees - which the browser never requests but every deploy still stores,
 *     and which Cloudflare Pages counts against a hard ceiling.
 *
 * So the gate is four-sided: per game, per file, file count, and in total. It
 * reads the built dist/, because that is what actually ships - build-site.mjs
 * already copies only the directories the catalogue references, and
 * prune-vendored.mjs removes what a page cannot reach inside them.
 *
 * Limits, and why each number:
 *
 *   - MAX_GAME 10 MiB. A single playable page has no business being larger; the
 *     measured 2026-10 build has no game anywhere near it.
 *   - MAX_FILE 20 MiB. The platform limit is 25 MiB per single asset; 20 MiB
 *     keeps 5 MiB of margin so a borderline asset fails here, before an upload
 *     fails at 90%. In practice the per-game budget catches anything this large
 *     inside third-party/, so this rule guards the rest of dist (a stray
 *     public/ asset) and reports it by name.
 *   - MAX_FILES 18,500. **This is the gate that was missing.** Cloudflare Pages
 *     Free rejects a deployment above 20,000 files, and the site measured
 *     19,655 files before the prune rewrite of 2026-10-30: 345 files of
 *     headroom, under 2%. One more locale is 659 URLs, one more asset-heavy
 *     repository is hundreds of files,
 *     and `wrangler pages deploy` then fails after a full build. 18,500 leaves
 *     1,500 files - about two locales, or a few hundred games' worth of new
 *     pages - while still being a number the current build can be held to.
 *   - MAX_TOTAL 800 MiB. GitHub Pages allows a 1 GB published site, so 800 MiB
 *     leaves headroom without pretending the site is weightless - the
 *     catalogue is capped here, not the budget.
 *
 * Measured 2026-10-30 after the prune rewrite: dist 633.8 MB, 18,363 files,
 * 550 vendored games.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const MB = 1024 * 1024;

/* The platform's own numbers, quoted so the margins above can be reasoned
 * about instead of remembered: Cloudflare Pages Free, "Limits" page —
 * 20,000 files per site, 25 MiB per asset. */
export const PLATFORM_MAX_FILES = 20_000;
export const PLATFORM_MAX_ASSET = 25 * MB;

export const MAX_GAME = 10 * MB;
export const MAX_FILE = 20 * MB;
export const MAX_FILES = 18_500;
export const MAX_TOTAL = 800 * MB;

export const mb = (bytes) => (bytes / MB).toFixed(1);

/**
 * Walk dist once. Symlinks are measured but never followed: a symlink into
 * node_modules would make dist look enormous (or loop forever) while shipping
 * nothing.
 */
export function walk(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      files.push({ path, size: stat.size });
    }
  }
  return files;
}

/**
 * Measure a built tree and say whether it may be deployed.
 *
 * Pure: no printing, no process.exit, so the gate can be tested against
 * synthetic trees instead of a 700 MB dist/.
 */
export function auditDist(dist, limits = {}) {
  const maxGame = limits.maxGame ?? MAX_GAME;
  const maxFile = limits.maxFile ?? MAX_FILE;
  const maxFiles = limits.maxFiles ?? MAX_FILES;
  const maxTotal = limits.maxTotal ?? MAX_TOTAL;

  const files = walk(dist);
  const total = files.reduce((sum, f) => sum + f.size, 0);

  // Per vendored game: everything under dist/third-party/<slug>/.
  const games = new Map();
  for (const file of files) {
    const rel = relative(dist, file.path);
    const parts = rel.split(sep);
    if (parts[0] !== 'third-party' || parts.length < 2) continue;
    const slug = parts[1];
    games.set(slug, (games.get(slug) ?? 0) + file.size);
  }

  const fatGames = [...games]
    .filter(([, size]) => size > maxGame)
    .sort((a, b) => b[1] - a[1]);
  const fatFiles = files.filter((f) => f.size > maxFile).sort((a, b) => b.size - a.size);

  const problems = [];
  if (total > maxTotal) {
    problems.push(`dist is ${mb(total)} MB, over the ${mb(maxTotal)} MB budget`);
  }
  if (files.length > maxFiles) {
    const room = PLATFORM_MAX_FILES - files.length;
    problems.push(
      `dist has ${files.length} files, over the ${maxFiles}-file budget ` +
        `(platform ceiling ${PLATFORM_MAX_FILES}; ` +
        (room >= 0
          ? `${room} files left before \`wrangler pages deploy\` rejects the site)`
          : `${-room} files OVER the platform ceiling, the deploy cannot succeed)`),
    );
  }
  for (const [slug, size] of fatGames) {
    problems.push(`third-party/${slug} is ${mb(size)} MB, over the ${mb(maxGame)} MB per-game budget`);
  }
  for (const file of fatFiles) {
    problems.push(
      `${relative(dist, file.path)} is ${mb(file.size)} MB, over the ${mb(maxFile)} MB per-file budget`,
    );
  }

  return { files, count: files.length, total, games, fatGames, fatFiles, problems, ok: problems.length === 0 };
}

/** The one-line verdict every build prints, pass or fail. */
export function verdictLine(report) {
  return (
    `audit-size: dist ${mb(report.total)} MB across ${report.count} files ` +
    `(limit ${MAX_FILES}), no game over ${mb(MAX_GAME)} MB, ` +
    `no file over ${Math.round(MAX_FILE / MB)} MB`
  );
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };

  const dist = flag('dist') ?? process.env.AUDIT_DIST ?? join(root, 'dist');
  const asJson = argv.includes('--json');

  if (!existsSync(dist)) {
    console.error(`audit-size: ${dist} is missing - run \`npm run build\` first`);
    process.exit(1);
  }

  const report = auditDist(dist);
  const { problems, fatGames, fatFiles, games } = report;

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          dist: mb(report.total),
          games: games.size,
          files: report.count,
          limit: { game: mb(MAX_GAME), file: mb(MAX_FILE), files: MAX_FILES, total: mb(MAX_TOTAL) },
          fatGames: fatGames.map(([slug, size]) => ({ slug, mb: mb(size) })),
          fatFiles: fatFiles.map((f) => ({ path: relative(dist, f.path), mb: mb(f.size) })),
          ok: problems.length === 0,
        },
        null,
        2,
      ),
    );
  } else if (problems.length) {
    // The summary line comes first on failure: a CI log is read from the tail,
    // and "19,655 files" is the number that has to be seen.
    console.error(
      `audit-size: FAIL - dist ${mb(report.total)} MB across ${report.count} files ` +
        `(file budget ${MAX_FILES}, platform ceiling ${PLATFORM_MAX_FILES})`,
    );
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`  dist total ${mb(report.total)} MB across ${report.count} files in ${games.size} games`);
  } else {
    console.log(verdictLine(report));
  }

  if (problems.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
