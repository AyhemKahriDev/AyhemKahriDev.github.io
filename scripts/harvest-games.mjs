/**
 * Harvest open-source HTML5 games from GitHub, validate them in a real browser,
 * and emit catalogue metadata.
 *
 *   node scripts/harvest-games.mjs sweep      # find candidates (cached)
 *   node scripts/harvest-games.mjs vendor     # download + license-check
 *   node scripts/harvest-games.mjs validate   # headless browser gate
 *   node scripts/harvest-games.mjs generate   # write content/harvest-published.json
 *   node scripts/harvest-games.mjs all        # sweep -> vendor -> validate -> generate
 *
 * Every phase writes a JSON report to .harvest/ so phases can be resumed.
 * Only games that pass the browser gate are ever published.
 *
 * validate and generate are thin: they resolve the page each game actually
 * ships, then delegate to scripts/harvest/validate.mjs and to importGames()
 * from scripts/harvest/import.mjs - the same two modules `npm run harvest`
 * used to reimplement, and the same ones scripts/harvest/batch.mjs drives. A
 * game with a nested entry (docs/index.html, dist/index.html, game.html) is
 * therefore opened where it really is, and player copy comes from
 * scripts/harvest/copy.mjs, never from a README.
 *
 * Knobs (environment variable or --flag, the flag wins):
 *   HARVEST_FAMILY=arcade,puzzle   genre slices to search (default: all)
 *   HARVEST_TARGET=650             stop sweeping once there are enough candidates
 *   HARVEST_PAGES=2                search depth per query/licence
 *   HARVEST_CALLS=400              hard cap on search API calls
 *   HARVEST_LIMIT=650              max repos to vendor in this run
 *   HARVEST_CONCURRENCY=8          parallel downloads (default 6)
 *   HARVEST_MIN_STARS=2            star floor for the sweep query
 *   HARVEST_CAPS=80                most games one genre may publish
 *   HARVEST_BUDGET=500             most games the published layer may hold
 *   VALIDATE_WORKERS=6             browser workers for the validate phase
 *   HARVEST_PORT=4191              port for the static server validate starts
 *   HARVEST_DIR=<path>             report directory (default .harvest/)
 *
 * `generate --dry-run` prints the count and the first three games instead of
 * writing anything.
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
  renameSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queriesFor } from './harvest/queries.mjs';
import { pickEntry } from './harvest/entry.mjs';
import { importGames } from './harvest/import.mjs';
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
/**
 * Report directory. HARVEST_DIR is the same override the modern modules
 * honour, so a dry run can read a live .harvest/ from another worktree
 * without writing to it.
 */
const work = process.env.HARVEST_DIR
  ? resolve(process.env.HARVEST_DIR)
  : join(root, '.harvest');
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

/**
 * Files under a game folder, repo-relative, as scripts/harvest/entry.mjs wants
 * them.
 *
 * The vendored tree is the only trustworthy list of what a game actually
 * ships: preflight sees a GitHub tree, but the vendor step prunes (LICENSE,
 * README, nested node_modules) and the game that is left may have lost the
 * page preflight picked. Compiled once per folder, capped so a pathological
 * repo cannot make the walk quadratic.
 */
export function filesUnder(dir, base = '', budget = { left: 20000 }) {
  let entries;
  try {
    entries = readdirSync(base ? join(dir, base) : dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (budget.left <= 0) break;
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    budget.left -= 1;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesUnder(dir, rel, budget));
    else out.push(rel);
  }
  return out;
}

/**
 * A vendored entry path, made safe to open.
 *
 * The path comes from a JSON file on disk and ends up in a URL under
 * /third-party/<slug>/, so anything that could escape that folder (`..`, an
 * absolute path) is refused rather than normalised.
 */
export function safeEntry(raw) {
  const clean = String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    // `./dist/index.html` is a path the vendor step writes; only a segment
    // that is still `..` after this can escape the game folder.
    .replace(/^(?:\.\/)+/, '');
  const segments = clean.split('/').filter(Boolean);
  if (!segments.length || segments.some((s) => s === '.' || s === '..')) return null;
  return segments.join('/');
}

/**
 * The page a vendored game is played at, or null when there is none.
 *
 * The entry the modern pipeline recorded wins (`entry` on the vendored record,
 * then in the game's own .harvested.json). Only when neither says anything, or
 * the page it names was pruned on the way in, does this look at what is
 * actually on disk - and then it asks pickEntry() rather than assuming
 * index.html. A game with no playable page at all resolves to null: the caller
 * skips it instead of opening a 404 and calling the game dead.
 */
export function resolveEntry(record, { thirdPartyDir = thirdParty } = {}) {
  const slug = String(record?.slug ?? '').trim();
  if (!slug) return null;
  const dir = join(thirdPartyDir, slug);
  const meta = readJson(join(dir, '.harvested.json'), {});
  const declared = safeEntry(record?.entry) ?? safeEntry(meta.entry);
  if (declared && existsSync(join(dir, declared))) return declared;
  const picked = pickEntry(filesUnder(dir));
  return picked.entry && existsSync(join(dir, picked.entry)) ? picked.entry : null;
}

/**
 * Split the vendored report into the games the browser gate can open and the
 * ones it must not guess at.
 *
 * Exported so the rule can be tested without a browser, a server or a network:
 * `ready` carries the resolved entry, `skipped` is the slugs with no page on
 * disk at all.
 */
export function planValidation(vendored, { thirdPartyDir = thirdParty } = {}) {
  const ready = [];
  const skipped = [];
  for (const record of vendored ?? []) {
    if (!record?.slug) continue;
    const entry = resolveEntry(record, { thirdPartyDir });
    if (!entry) {
      skipped.push(record.slug);
      continue;
    }
    ready.push({ ...record, entry });
  }
  return { ready, skipped };
}

/** Write through a temp file so a crash mid-write cannot leave corrupt JSON. */
function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

/**
 * Browser gate - delegated to scripts/harvest/validate.mjs.
 *
 * This phase used to reimplement the whole gate: its own static server, its
 * own Chrome pool, its own probe - and it opened
 * /third-party/<slug>/index.html no matter what was vendored, so every game
 * with a nested entry (docs/index.html, dist/index.html, game.html) was
 * judged "dead" and its folder deleted. The modern validator already asks the
 * record which page it is, retries a dead browser, deletes what is truly
 * unplayable and writes .harvest/validated.json - the report the importer
 * reads. So this phase resolves entries, records them and runs that script.
 */
async function validate() {
  const vendored = readJson(join(work, 'vendored.json'), []);
  if (!vendored.length) {
    console.log('validate: nothing vendored yet');
    return [];
  }

  const { ready, skipped } = planValidation(vendored);
  for (const slug of skipped) console.log(`skip ${slug}: no entry`);

  if (!ready.length) {
    console.log(`validate: nothing to check (${skipped.length} skipped, no entry on disk)`);
    return [];
  }

  // The validator reads record.entry before it falls back to index.html, so
  // recording what was found is what makes a nested entry get opened - and it
  // spares the next run the folder walk. The report is only rewritten when
  // something was actually learned, and atomically, so a concurrent vendor
  // phase can never read half a file.
  const before = new Map(vendored.map((v) => [v.slug, v]));
  const learned = ready.filter((r) => before.get(r.slug)?.entry !== r.entry);
  if (learned.length) {
    const bySlug = new Map(ready.map((r) => [r.slug, r]));
    writeJsonAtomic(
      join(work, 'vendored.json'),
      vendored.map((v) => bySlug.get(v.slug) ?? v),
    );
    process.stderr.write(`  validate: recorded ${learned.length} entries found on disk\n`);
  }

  const workers = settingNumber('workers', 'VALIDATE_WORKERS', 6, { min: 1, max: 32 });
  const port = String(process.env.HARVEST_PORT ?? '4191');
  process.stderr.write(
    `  validate: ${ready.length} games via scripts/harvest/validate.mjs (${workers} workers on :${port})\n`,
  );

  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/harvest/validate.mjs'), `--workers=${workers}`, `--port=${port}`],
    { cwd: root, stdio: 'inherit', env: { ...process.env, HARVEST_DIR: work } },
  );
  if (result.error) {
    console.error(`validate: could not start scripts/harvest/validate.mjs - ${result.error.message}`);
    throw result.error;
  }

  const verdicts = readJson(join(work, 'validated.json'), []);
  const count = (verdict) => verdicts.filter((v) => v?.verdict === verdict).length;
  const pass = count('pass');
  const dead = count('dead');
  const unclear = verdicts.filter((v) => v && v.verdict !== 'pass' && v.verdict !== 'dead').length;
  console.log(
    `validate: ${pass} pass, ${dead} dead, ${unclear} inconclusive (${verdicts.length} verdicts on record), ` +
      `${skipped.length} skipped (no entry) - ${ready.length} in this run`,
  );

  // The validator exits 1 when it rejected something: that is a normal result,
  // not a reason to stop a full `all` run before generate. Standalone, the
  // exit code is passed through so a caller can tell.
  if (result.status !== 0 && CLI.phase !== 'all') process.exitCode = result.status;

  const readyBySlug = new Map(ready.map((r) => [r.slug, r]));
  return verdicts
    .filter((v) => v?.verdict === 'pass')
    // A verdict for a record this run skipped can only be a stale entry in
    // validated.json; it is returned as-is rather than with an invented page.
    .map((v) => readyBySlug.get(v.slug) ?? { ...v });
}

/* ---------------------------------------------------------- generate */

/**
 * The header every generated catalogue layer carries. Byte-identical to
 * scripts/harvest/import.mjs's CLI output on purpose: the two routes must
 * produce the same file, or a diff after `npm run harvest` would be noise.
 */
export const PUBLISHED_COMMENT =
  'Generated by scripts/harvest/import.mjs from .harvest/vendored.json + .harvest/validated.json. ' +
  'Do not edit by hand - per-game overrides belong in content/overrides.json.';

/**
 * Catalogue layer - delegated to scripts/harvest/import.mjs.
 *
 * The old version scraped READMEs, built its own titles, categories and ids
 * and wrote content/games.generated.json. That is how developer prose
 * ("npm install, then open index.html") ended up as player-facing
 * descriptions on 57 pages, and how the harvest kept overwriting a layer the
 * integrator had already cleaned. Now the importer makes the decisions - the
 * same pure importGames() the batch uses - and the result lands in
 * content/harvest-published.json, the layer the modern pipeline owns, with the
 * same _comment and games keys as the importer's CLI.
 *
 * @param {object}  [options]
 * @param {boolean} [options.dryRun]        print the counts and a sample, write nothing
 * @param {string}  [options.workDir]       report directory (defaults to .harvest/)
 * @param {string}  [options.outFile]       output file
 * @param {string}  [options.rootDir]       where content/ lives
 * @param {number}  [options.capPerFamily]  one genre's share of the layer (80, the batch default)
 * @param {number}  [options.budget]        most games this layer may hold
 * @returns {object[]} the games that would be (or were) published
 */
export function generate({
  dryRun = false,
  workDir = work,
  outFile = join(root, 'content/harvest-published.json'),
  rootDir = root,
  thirdPartyDir = thirdParty,
  capPerFamily = settingNumber('caps', 'HARVEST_CAPS', 80, { min: 1 }),
  budget = settingNumber('budget', 'HARVEST_BUDGET', 500, { min: 0 }),
} = {}) {
  const vendored = readJson(join(workDir, 'vendored.json'), []);
  if (!vendored.length) {
    console.error(`generate: ${join(workDir, 'vendored.json')} is empty or missing - run the vendor phase first`);
    return [];
  }

  let validated = readJson(join(workDir, 'validated.json'), null);
  if (!Array.isArray(validated)) {
    // A report from before the delegated validator: same information, older
    // shape. Keeping this path means an interrupted upgrade can still publish
    // what the previous pass proved playable instead of requiring a re-run.
    const legacy = readJson(join(workDir, 'passed.json'), []);
    if (legacy.length) {
      validated = legacy.map((v) => ({
        slug: v.slug,
        repo: v.repo,
        verdict: 'pass',
        reason: 'passed.json (legacy validate phase)',
      }));
    }
  }
  if (!Array.isArray(validated) || !validated.length) {
    console.error(
      `generate: ${join(workDir, 'validated.json')} is missing - run \`node scripts/harvest-games.mjs validate\` first`,
    );
    if (!dryRun) process.exitCode = 1;
    return [];
  }

  // Record the entry on every record that has one on disk, so the importer
  // builds /third-party/<slug>/<entry> instead of assuming index.html. A
  // record whose page is gone is left to the importer: it has a passing
  // verdict, and silently dropping it here would make the layer depend on the
  // order validate and generate ran in.
  const withEntries = vendored.map((v) => {
    const entry = v.entry ? safeEntry(v.entry) : resolveEntry(v, { thirdPartyDir });
    return entry && entry !== v.entry ? { ...v, entry } : v;
  });

  // Titles and ids the rest of the catalogue already publishes - the same
  // layers scripts/harvest/import.mjs reads, so both routes break collisions
  // identically.
  const layer = (p) => readJson(join(rootDir, p), { games: [] }).games ?? [];
  const existing = [
    ...layer('content/games.json'),
    ...layer('content/engine-new.json'),
    ...layer('content/curated.json'),
    ...layer('content/games.generated.json'),
  ];

  const games = importGames({
    vendored: withEntries,
    validated,
    capPerFamily,
    budget,
    existingTitles: existing.map((g) => g.title),
    existingIds: existing.map((g) => g.id),
  });

  // Hand-curated patches (content/overrides.json) still apply: they patch one
  // field on one game - typically the embed page for a repo whose index.html
  // is a landing page.
  for (const game of games) {
    const override = OVERRIDES[game.id];
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      game[key] =
        value && typeof value === 'object' && !Array.isArray(value)
          ? { ...game[key], ...value }
          : value;
    }
  }

  if (dryRun) {
    console.log(`generate: dry run - ${games.length} games, nothing written`);
    for (const g of games.slice(0, 3)) {
      console.log(
        `  ${JSON.stringify({ id: g.id, title: g.title, category: g.category, description: g.description })}`,
      );
    }
    return games;
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(
    outFile,
    JSON.stringify({ _comment: PUBLISHED_COMMENT, games }, null, 2),
  );
  const passed = validated.filter((v) => v?.verdict === 'pass').length;
  console.log(
    `generate: ${games.length} games written to ${outFile.replace(`${rootDir}/`, '')} ` +
      `(${passed - games.length} duplicates/caps)`,
  );
  return games;
}

/* ------------------------------------------------------------- main */

// The phase contract is unchanged: `node scripts/harvest-games.mjs vendor`.
// --family/--limit/--concurrency/--pages/--calls/--target mirror the HARVEST_*
// variables, with the flag winning when both are present.
const phase = CLI.phase;

/**
 * Only run when executed, never when imported.
 *
 * tests/legacy-pipeline.test.js imports the entry resolver and the generate
 * phase; without this guard a bare import would start sweeping GitHub.
 */
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return process.argv[1].endsWith('harvest-games.mjs');
  }
})();

if (invokedDirectly) {
  mkdirSync(work, { recursive: true });

  if (phase === 'sweep' || phase === 'all') sweep();
  if (phase === 'vendor' || phase === 'all') await vendor();
  if (phase === 'validate' || phase === 'all') await validate();
  if (phase === 'generate' || phase === 'all') {
    generate({ dryRun: CLI.flags['dry-run'] === 'true' });
  }

  console.log('\ndone');
}
