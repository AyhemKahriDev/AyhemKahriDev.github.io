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
 *     trees - which the browser never requests but every deploy still stores.
 *
 * So the gate is three-sided: per game, per file, and in total. It reads the
 * built dist/, because that is what actually ships - build-site.mjs already
 * copies only the directories the catalogue references.
 *
 * Limits: 10 MB per game, 20 MB per file, 700 MB for all of dist. Measured
 * 2026-10-29 after pruning: 173 games, dist 143 MB, heaviest game 8.8 MB
 * (courier-city, audio + sprite sheets it actually loads). 3 MB per game was
 * tried first and rejected 14 of 164 legitimately working games; the point of
 * the gate is to catch a game that ships its build tooling, not to punish art.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MB = 1024 * 1024;
const MAX_GAME = 10 * MB;
const MAX_FILE = 20 * MB;
const MAX_TOTAL = 700 * MB;

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const dist = flag('dist') ?? process.env.AUDIT_DIST ?? join(root, 'dist');
const asJson = argv.includes('--json');

const mb = (bytes) => (bytes / MB).toFixed(1);

/**
 * Walk dist once. Symlinks are measured but never followed: a symlink into
 * node_modules would make dist look enormous (or loop forever) while shipping
 * nothing.
 */
function walk(dir) {
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

function main() {
  if (!existsSync(dist)) {
    console.error(`audit-size: ${dist} is missing - run \`npm run build\` first`);
    process.exit(1);
  }

  const files = walk(dist);
  const total = files.reduce((sum, f) => sum + f.size, 0);

  // Per vendored game: everything under dist/third-party/<slug>/.
  const thirdParty = join(dist, 'third-party');
  const games = new Map();
  for (const file of files) {
    const rel = relative(dist, file.path);
    const parts = rel.split(sep);
    if (parts[0] !== 'third-party' || parts.length < 2) continue;
    const slug = parts[1];
    games.set(slug, (games.get(slug) ?? 0) + file.size);
  }

  const fatGames = [...games]
    .filter(([, size]) => size > MAX_GAME)
    .sort((a, b) => b[1] - a[1]);
  const fatFiles = files.filter((f) => f.size > MAX_FILE).sort((a, b) => b.size - a.size);

  const problems = [];
  if (total > MAX_TOTAL) {
    problems.push(`dist is ${mb(total)} MB, over the ${mb(MAX_TOTAL)} MB budget`);
  }
  for (const [slug, size] of fatGames) {
    problems.push(`third-party/${slug} is ${mb(size)} MB, over the ${mb(MAX_GAME)} MB per-game budget`);
  }
  for (const file of fatFiles) {
    problems.push(`${relative(dist, file.path)} is ${mb(file.size)} MB, over the 20 MB per-file budget`);
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          dist: mb(total),
          games: games.size,
          files: files.length,
          limit: { game: mb(MAX_GAME), file: mb(MAX_FILE), total: mb(MAX_TOTAL) },
          fatGames: fatGames.map(([slug, size]) => ({ slug, mb: mb(size) })),
          fatFiles: fatFiles.map((f) => ({ path: relative(dist, f.path), mb: mb(f.size) })),
          ok: problems.length === 0,
        },
        null,
        2,
      ),
    );
  } else if (problems.length) {
    console.error(`audit-size: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`  dist total ${mb(total)} MB across ${files.length} files in ${games.size} games`);
  } else {
    console.log(
      `audit-size: dist ${mb(total)} MB, no game over ${mb(MAX_GAME)} MB, no file over ${Math.round(MAX_FILE / MB)} MB`,
    );
  }

  if (problems.length) process.exit(1);
}

main();
