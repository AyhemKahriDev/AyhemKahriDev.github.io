/**
 * The harvest pipeline: the one way a GitHub repository becomes a catalogue game.
 *
 *   node scripts/harvest/cli.mjs sweep      # GitHub search -> .harvest/candidates.json
 *   node scripts/harvest/cli.mjs vendor     # preflight + download + prune -> .harvest/vendored.json
 *   node scripts/harvest/cli.mjs validate   # headless browser gate -> .harvest/validated.json
 *   node scripts/harvest/cli.mjs import     # validated.json -> content/harvest-published.json
 *   node scripts/harvest/cli.mjs all        # sweep -> vendor/validate/import -> summary
 *
 * `generate` is accepted as a synonym for `import`: it is the phase name the
 * pre-rewrite driver used, and docs/HARVEST.md still says it.
 *
 * This file owns policy, not mechanics. Search rules come from
 * scripts/harvest/queries.mjs + filters.mjs, entry discovery from entry.mjs,
 * downloads from vendor.mjs, the browser gate from validate.mjs and catalogue
 * assembly from import.mjs. `all` does not reimplement the rounds either: it
 * runs scripts/harvest/batch.mjs, which already vendors, validates and imports
 * in rounds until the published layer stops growing.
 *
 * Every knob is an environment variable and a flag (the flag wins); --help
 * prints the list. `import --dry-run` prints the counts and a sample instead of
 * writing. HARVEST_DIR moves the report directory for every phase, so a run can
 * read a live .harvest/ from another worktree without touching it.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { queriesFor } from './queries.mjs';
import { pickEntry } from './entry.mjs';
import { importGames } from './import.mjs';
import {
  SEARCH_LICENCES,
  dedupeCandidates,
  normaliseRepo,
  shouldAccept,
  slugify,
} from './filters.mjs';
import { makePreflight } from './preflight.mjs';
import { vendorAll } from './vendor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const thirdParty = join(root, 'third-party');

/** Every phase name this CLI accepts. `generate` is the old name for `import`. */
export const PHASES = Object.freeze(['sweep', 'vendor', 'validate', 'import', 'generate', 'all']);

/** What `--help` and an unknown phase both print. */
export const USAGE = `Usage: node scripts/harvest/cli.mjs <phase> [--flag value]

Phases:
  sweep      search GitHub -> .harvest/candidates.json
  vendor     preflight, download and prune -> .harvest/vendored.json
  validate   headless browser gate -> .harvest/validated.json
  import     build content/harvest-published.json from the reports
  generate   synonym for import (the pre-rewrite phase name)
  all        sweep, then batch vendor/validate/import rounds, then a summary

Knobs: HARVEST_FAMILY, HARVEST_TARGET, HARVEST_PAGES, HARVEST_CALLS,
HARVEST_LIMIT, HARVEST_CONCURRENCY, HARVEST_MIN_STARS, HARVEST_CAPS,
HARVEST_BUDGET, HARVEST_ROUNDS, VALIDATE_WORKERS, HARVEST_PORT, HARVEST_DIR.
Every knob also has a flag (--family, --target, --pages, --calls, --limit,
--concurrency, --min-stars, --caps, --budget, --rounds, --workers, --port,
--work); the flag wins. --dry-run prints what import would write.`;

/* --------------------------------------------------------------- args */

/**
 * One parser for the phase and the `--flag=value` / `--flag value` knobs.
 *
 * Positional arguments are phases; anything else is reported so the caller can
 * fail with the phase list instead of silently running `all`.
 */
export function parseCli(argv = []) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = 'true';
    } else if (arg === '--dry-run') {
      flags['dry-run'] = 'true';
    } else if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = 'true';
      }
    } else {
      positionals.push(arg);
    }
  }

  const phase = positionals[0] ?? 'all';
  const unknown = positionals.filter((arg) => !PHASES.includes(arg));
  return { phase, flags, unknown };
}

/**
 * The resolved knobs for this run: flag first, then the matching variable,
 * then the default.
 *
 * Pure on purpose - the tests assert every documented variable lands in the
 * same field the pipeline reads, without touching a filesystem or a network.
 */
export function settings(env = process.env, flags = {}) {
  const pick = (flag, name, fallback) => {
    const raw = flags[flag] ?? env[name];
    return raw === undefined || raw === '' ? fallback : raw;
  };
  const num = (flag, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const n = Number(pick(flag, name, fallback));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
  };

  return {
    /**
     * Report directory. HARVEST_DIR is the same override the phase scripts
     * honour, so a dry run can read a live .harvest/ from another worktree
     * without writing to it.
     */
    work: resolve(String(pick('work', 'HARVEST_DIR', join(root, '.harvest')))),
    families: String(pick('family', 'HARVEST_FAMILY', 'all')),
    target: num('target', 'HARVEST_TARGET', 0),
    pages: num('pages', 'HARVEST_PAGES', 10, { min: 1, max: 100 }),
    calls: num('calls', 'HARVEST_CALLS', 0),
    limit: num('limit', 'HARVEST_LIMIT', 0),
    concurrency: num('concurrency', 'HARVEST_CONCURRENCY', 6, { min: 1, max: 32 }),
    minStars: num('min-stars', 'HARVEST_MIN_STARS', 2),
    caps: num('caps', 'HARVEST_CAPS', 80, { min: 1 }),
    budget: num('budget', 'HARVEST_BUDGET', 500, { min: 0 }),
    rounds: num('rounds', 'HARVEST_ROUNDS', 1, { min: 1, max: 50 }),
    workers: num('workers', 'VALIDATE_WORKERS', 6, { min: 1, max: 32 }),
    port: String(pick('port', 'HARVEST_PORT', '4191')),
    dryRun: flags['dry-run'] === 'true' || flags['dry-run'] === true,
  };
}

/* ------------------------------------------------------------- helpers */

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write through a temp file so a killed run cannot leave corrupt JSON. */
function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

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

/**
 * Star floor for the search query.
 *
 * The floor used to be hardcoded `stars:>2`, which quietly excluded the long
 * tail where most small open-source games live: a full 60-query sweep found
 * only 1,561 candidates, and ~1,500 of them had already been seen. GitHub's
 * search accepts `stars:>=0`, so the floor is a knob - the browser gate, not a
 * popularity filter, decides what is publishable.
 */
function starsFilter(s) {
  return s.minStars > 0 ? `stars:>=${s.minStars}` : 'stars:>=0';
}

/** Repositories that must never be published, straight from content/blocked.json. */
function blockedRepos() {
  return new Set(
    (readJson(join(root, 'content/blocked.json'), { repos: [] }).repos ?? []).map(normaliseRepo),
  );
}

/** Repositories already hand-picked into content/games.json - not harvest candidates. */
function curatedRepos() {
  return new Set(
    readJson(join(root, 'content/games.json'), { games: [] }).games
      .map((g) => g.credit?.source)
      .filter(Boolean)
      .map((u) => u.replace('https://github.com/', '').replace(/\/$/, '')),
  );
}

/* --------------------------------------------------------------- sweep */

/**
 * Search GitHub for candidate repositories and checkpoint the result.
 *
 * Bounded on purpose: 124 queries x 9 licences x 10 pages is thousands of calls
 * at 30/minute and looks like a hang. TARGET stops at enough material, PAGES
 * limits depth, CALLS caps the API, FAMILY picks the genre slices.
 */
export function sweep(s = settings()) {
  mkdirSync(s.work, { recursive: true });

  // Candidates found by an earlier sweep are kept: a deep sweep is meant to
  // accumulate across runs, and overwriting the file threw away every repo the
  // previous run had already paid API calls for.
  const previous = dedupeCandidates(readJson(join(s.work, 'candidates.json'), []));
  const seen = new Map(previous.map((c) => [c.repo, c]));
  const queries = queriesFor(s.families);
  const maxCalls = s.calls;
  const maxPages = s.pages;
  const target = s.target;
  const already = new Set(existsSync(thirdParty) ? readdirSync(thirdParty) : []);
  // Repos already judged unusable (no usable entry, no licence file):
  // they used to be re-downloaded and re-rejected on every run.
  const skipped = new Set(readJson(join(s.work, 'skipped.json'), []));
  const blocked = blockedRepos();

  let answered = 0;
  let calls = 0;
  let added = 0;

  // A deep sweep is hours of API calls. Without a checkpoint, a killed run
  // loses every candidate it found - so persist as we go.
  const checkpoint = () => {
    writeJson(join(s.work, 'candidates.json'), [...seen.values()].sort((a, b) => b.stars - a.stars));
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
          `search/repositories?q=${encodeURIComponent(`${q} license:${lic} ${starsFilter(s)}`)}&per_page=100&page=${page}&sort=stars`,
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
          if (blocked.has(normaliseRepo(r.full_name))) continue;
          if (already.has(slugify(r.full_name))) continue;
          if (skipped.has(r.full_name)) continue;
          // Licence, size, "looks like a library/tutorial" and the game
          // signal all live in one pure, tested function.
          if (!shouldAccept(r, { minStars: s.minStars })) continue;
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
        'nothing was vendored, and content/harvest-published.json is untouched.',
    );
  }

  writeJson(join(s.work, 'candidates.json'), list);
  console.log(
    `sweep: ${answered} queries answered, ${calls} API calls -> ${list.length} candidates (+${added} new)`,
  );
  return list;
}

/* -------------------------------------------------------------- vendor */

/**
 * The candidates still worth a download, and the reasons for the ones that are not.
 *
 * One definition, used by both the vendor phase and `all`'s "is there anything
 * to do?" test, so the summary can never disagree with what vendor will queue.
 */
export function pendingCandidates(s = settings()) {
  const candidates = dedupeCandidates(readJson(join(s.work, 'candidates.json'), []));
  const curated = curatedRepos();
  // Repos preflight already refused (no usable entry, no licence) are not
  // pending: retrying them would spend part of a small HARVEST_LIMIT on work
  // that is known to be wasted.
  const refused = new Set(readJson(join(s.work, 'skipped.json'), []));
  const allowed = candidates.filter((c) => !curated.has(c.repo));
  const isDone = (c) => existsSync(join(thirdParty, c.slug || slugify(c.repo), '.harvested.json'));
  return {
    candidates,
    allowed,
    done: allowed.filter((c) => isDone(c)),
    pending: allowed.filter((c) => !isDone(c) && !refused.has(c.repo)),
    refused: allowed.filter((c) => refused.has(c.repo)),
  };
}

export async function vendor(s = settings()) {
  mkdirSync(s.work, { recursive: true });
  const { candidates, allowed, done, pending } = pendingCandidates(s);
  if (!candidates.length) {
    console.log('vendor: no candidates in .harvest/candidates.json - run sweep first');
    return [];
  }

  // HARVEST_LIMIT is a *download* budget: only repos that still need vendoring
  // count against it, so a resumed run never spends its allowance on repos
  // that are already on disk.
  const batch = s.limit > 0 ? pending.slice(0, s.limit) : pending;
  // Already-vendored repos ride along so vendored.json stays the full picture
  // validate() expects; vendorAll reuses their metadata without a download.
  const queue = [...done, ...batch];

  const preflight = makePreflight({ gh, cachePath: join(s.work, 'preflight.json') });

  console.log(
    `vendor: ${queue.length} repos queued (${pending.length} pending, limit ${s.limit || 'none'}), concurrency ${s.concurrency}`,
  );

  let tick = 0;
  const { vendored, skipped, failed } = await vendorAll(queue, {
    concurrency: s.concurrency,
    thirdPartyDir: thirdParty,
    workDir: s.work,
    preflight,
    onProgress: ({ total, status, slug, reason }) => {
      tick += 1;
      const note = status === 'skipped' || status === 'failed' ? ` (${reason})` : '';
      process.stderr.write(`\r  ${tick}/${total}  ${status}${note} ${slug}   `);
    },
  });

  const newly = vendored.filter((v) => v.reused !== true).length;
  const clean = vendored.map(({ reused, ...meta }) => meta);

  writeJson(join(s.work, 'vendored.json'), clean);
  // Remember preflight rejections so the next sweep does not spend candidates
  // on a repo that can never be served as a game page.
  writeJson(
    join(s.work, 'skipped.json'),
    [...new Set([...readJson(join(s.work, 'skipped.json'), []), ...skipped.map((x) => x.repo)])],
  );

  process.stderr.write('\n');
  for (const f of failed) console.error(`  failed ${f.repo}: ${f.reason}`);
  console.log(`vendor: ${newly} vendored, ${skipped.length} skipped, ${failed.length} failed`);
  return clean;
}

/* ------------------------------------------------------------ validate */

/**
 * Files under a game folder, repo-relative, as scripts/harvest/entry.mjs wants
 * them. The vendored tree is the only trustworthy list of what a game ships:
 * the vendor step prunes, so the page preflight picked may be gone. Capped so a
 * pathological repo cannot make the walk quadratic.
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
 * A vendored entry path, made safe to open. The path comes from JSON on disk
 * and ends up in a URL under /third-party/<slug>/, so anything that could
 * escape that folder (`..`, an absolute path) is refused, not normalised.
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
  if (!segments.length || segments.some((x) => x === '.' || x === '..')) return null;
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

/**
 * Browser gate - delegated to scripts/harvest/validate.mjs.
 *
 * This phase used to reimplement the gate and always opened index.html, so
 * every game with a nested entry (docs/, dist/, game.html) was judged dead and
 * its folder deleted. Now it resolves and records the real entry, then runs
 * the validator that retries, deletes only what is unplayable, and writes
 * .harvest/validated.json.
 */
export async function validate(s = settings(), { standalone = true, thirdPartyDir = thirdParty } = {}) {
  const vendored = readJson(join(s.work, 'vendored.json'), []);
  if (!vendored.length) {
    console.log('validate: nothing vendored yet');
    return [];
  }

  const { ready, skipped } = planValidation(vendored, { thirdPartyDir });
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
    writeJson(
      join(s.work, 'vendored.json'),
      vendored.map((v) => bySlug.get(v.slug) ?? v),
    );
    process.stderr.write(`  validate: recorded ${learned.length} entries found on disk\n`);
  }

  process.stderr.write(
    `  validate: ${ready.length} games via scripts/harvest/validate.mjs (${s.workers} workers on :${s.port})\n`,
  );

  // Flags are space-separated: validate.mjs parses `--flag value`, and
  // `--workers=6` is silently ignored - which is how a run asked for more
  // workers and got the default.
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'scripts/harvest/validate.mjs'),
      '--workers',
      String(s.workers),
      '--port',
      s.port,
      '--work',
      s.work,
    ],
    { cwd: root, stdio: 'inherit', env: { ...process.env, HARVEST_DIR: s.work } },
  );
  if (result.error) {
    console.error(`validate: could not start scripts/harvest/validate.mjs - ${result.error.message}`);
    throw result.error;
  }

  const verdicts = readJson(join(s.work, 'validated.json'), []);
  const count = (verdict) => verdicts.filter((v) => v?.verdict === verdict).length;
  const pass = count('pass');
  const dead = count('dead');
  const unclear = verdicts.filter((v) => v && v.verdict !== 'pass' && v.verdict !== 'dead').length;
  console.log(
    `validate: ${pass} pass, ${dead} dead, ${unclear} inconclusive (${verdicts.length} verdicts on record), ` +
      `${skipped.length} skipped (no entry) - ${ready.length} in this run`,
  );

  // The validator exits 1 when it rejected something: that is a normal result,
  // not a reason to stop a full `all` run before import. Standalone, the exit
  // code is passed through so a caller can tell.
  if (result.status !== 0 && standalone) process.exitCode = result.status;
  return verdicts;
}

/* -------------------------------------------------------------- import */

/**
 * The header every generated catalogue layer carries. Byte-identical to
 * scripts/harvest/import.mjs's CLI output on purpose: the two routes must
 * produce the same file, or a diff after `npm run harvest` would be noise.
 */
export const PUBLISHED_COMMENT =
  'Generated by scripts/harvest/import.mjs from .harvest/vendored.json + .harvest/validated.json. ' +
  'Do not edit by hand - per-game overrides belong in content/overrides.json.';

/**
 * Catalogue layer - delegated to importGames() in scripts/harvest/import.mjs.
 *
 * The old body scraped READMEs and wrote content/games.generated.json, which is
 * how "npm install, then open index.html" became player copy on 57 pages. The
 * importer now makes every decision, so this writes the same file, with the
 * same keys, as scripts/harvest/import.mjs - plus content/overrides.json,
 * which the importer's CLI does not apply.
 *
 * @param {object}  [options]
 * @param {boolean} [options.dryRun]        print the counts and a sample, write nothing
 * @param {string}  [options.workDir]       report directory (defaults to .harvest/)
 * @param {string}  [options.outFile]       output file
 * @param {string}  [options.rootDir]       where content/ lives
 * @param {number}  [options.capPerFamily]  one genre's share of the layer (80, the generate default)
 * @param {number}  [options.budget]        most games this layer may hold
 * @returns {object[]} the games that would be (or were) published
 */
export function generate({
  dryRun = false,
  workDir = settings().work,
  outFile = join(root, 'content/harvest-published.json'),
  rootDir = root,
  thirdPartyDir = thirdParty,
  capPerFamily = settings().caps,
  budget = settings().budget,
} = {}) {
  const vendored = readJson(join(workDir, 'vendored.json'), []);
  if (!vendored.length) {
    console.error(`import: ${join(workDir, 'vendored.json')} is empty or missing - run the vendor phase first`);
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
      `import: ${join(workDir, 'validated.json')} is missing - run \`node scripts/harvest/cli.mjs validate\` first`,
    );
    if (!dryRun) process.exitCode = 1;
    return [];
  }

  // Record the entry on every record that has one on disk, so the importer
  // builds /third-party/<slug>/<entry> instead of assuming index.html. A
  // record whose page is gone is left to the importer: it has a passing
  // verdict, and silently dropping it here would make the layer depend on the
  // order validate and import ran in.
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
  const overrides = readJson(join(rootDir, 'content/overrides.json'), { games: {} }).games ?? {};
  for (const game of games) {
    const override = overrides[game.id];
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      game[key] =
        value && typeof value === 'object' && !Array.isArray(value)
          ? { ...game[key], ...value }
          : value;
    }
  }

  if (dryRun) {
    console.log(`import: dry run - ${games.length} games, nothing written`);
    for (const g of games.slice(0, 3)) {
      console.log(
        `  ${JSON.stringify({ id: g.id, title: g.title, category: g.category, description: g.description })}`,
      );
    }
    return games;
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ _comment: PUBLISHED_COMMENT, games }, null, 2));
  const passed = validated.filter((v) => v?.verdict === 'pass').length;
  console.log(
    `import: ${games.length} games written to ${outFile.replace(`${rootDir}/`, '')} ` +
      `(${passed - games.length} duplicates/caps)`,
  );
  return games;
}

/* ------------------------------------------------------------- summary */

/**
 * What the run produced, in one block. Deliberately build-agnostic: no build,
 * no gate, so a harvest cannot publish a half-validated catalogue.
 */
export function summary(s = settings()) {
  const candidates = readJson(join(s.work, 'candidates.json'), []);
  const vendored = readJson(join(s.work, 'vendored.json'), []);
  const validated = readJson(join(s.work, 'validated.json'), []);
  const published = readJson(join(root, 'content/harvest-published.json'), { games: [] }).games ?? [];
  const byCategory = {};
  for (const game of published) {
    byCategory[game.category ?? 'none'] = (byCategory[game.category ?? 'none'] ?? 0) + 1;
  }
  const verdicts = (name) => validated.filter((v) => v?.verdict === name).length;
  const categories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name} ${n}`)
    .join(', ');

  console.log('\nharvest: summary');
  console.log(`  candidates  ${candidates.length}  (${join(s.work, 'candidates.json')})`);
  console.log(`  vendored    ${vendored.length}  (${join(s.work, 'vendored.json')})`);
  console.log(
    `  validated   ${verdicts('pass')} pass, ${verdicts('dead')} dead, ` +
      `${validated.length - verdicts('pass') - verdicts('dead')} inconclusive`,
  );
  console.log(`  published   ${published.length}  (content/harvest-published.json)`);
  if (categories) console.log(`  by category ${categories}`);
  console.log('  not built and not gated - next: npm test && npm run build && npm run audit && npm run smoke');
}

/* ---------------------------------------------------------------- all */

/**
 * sweep -> vendor -> validate -> import, then a summary. Never builds.
 *
 * The middle three phases are the batch driver: it already does them in rounds,
 * stops when a round adds nothing, and treats a rejected game as a normal
 * outcome. `all` imports again afterwards only for content/overrides.json,
 * which the importer's CLI does not apply and `npm run harvest` always has.
 */
export async function all(s = settings()) {
  sweep(s);

  const vendored = readJson(join(s.work, 'vendored.json'), []);
  const { pending } = pendingCandidates(s);

  if (!pending.length && !vendored.length) {
    console.log(
      '\nharvest: nothing to do - no pending candidates and nothing vendored yet. ' +
        'content/ was not touched.',
    );
    return;
  }

  if (pending.length) {
    console.log(
      `\nharvest: ${pending.length} pending candidate(s) -> batch (${s.rounds} round(s), limit ${s.limit || 'none'}, caps ${s.caps}, budget ${s.budget})`,
    );
    // batch reads --target as the published count it aims at and passes it to
    // import as the budget, so the budget is the target. --batch 0 is vendor's
    // "no limit", which is what an unbudgeted harvest has always done.
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'scripts/harvest/batch.mjs'),
        '--target', String(s.budget),
        '--batch', String(s.limit),
        '--rounds', String(s.rounds),
        '--caps', String(s.caps),
        '--concurrency', String(s.concurrency),
        '--workers', String(s.workers),
      ],
      { cwd: root, stdio: 'inherit', env: { ...process.env, HARVEST_DIR: s.work } },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      // Vendor is network-bound; a dead download is not a reason to skip
      // publishing what is already proven playable, but it is a failed run.
      console.error(`harvest: batch exited ${result.status}`);
      process.exitCode = 1;
    }
  } else {
    console.log('\nharvest: no pending downloads - publishing what is already validated');
  }

  generate({ dryRun: s.dryRun, workDir: s.work, capPerFamily: s.caps, budget: s.budget });
  summary(s);
}

/* --------------------------------------------------------------- main */

/**
 * Run one phase. Exit codes go through process.exitCode. Exported so
 * scripts/harvest-games.mjs can forward without spawning a second process.
 */
export async function main(argv = process.argv.slice(2)) {
  const { phase, flags, unknown } = parseCli(argv);

  if (flags.help === 'true') {
    console.log(USAGE);
    return;
  }
  if (unknown.length) {
    console.error(`harvest: unknown phase "${unknown[0]}"`);
    console.error(`harvest: valid phases are ${PHASES.join(', ')}`);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const s = settings(process.env, flags);

  try {
    if (phase === 'sweep') {
      sweep(s);
    } else if (phase === 'vendor') {
      await vendor(s);
    } else if (phase === 'validate') {
      await validate(s, { standalone: true });
    } else if (phase === 'import' || phase === 'generate') {
      generate({
        dryRun: s.dryRun,
        workDir: s.work,
        ...(flags.out ? { outFile: resolve(flags.out) } : {}),
        capPerFamily: s.caps,
        budget: s.budget,
      });
    } else {
      await all(s);
    }
  } catch (err) {
    console.error(`harvest: ${err?.message ?? err}`);
    process.exitCode = 1;
    return;
  }

  if (phase !== 'all') console.log('\ndone');
}

/**
 * Only run when executed, never when imported.
 *
 * tests/legacy-pipeline.test.js imports the entry resolver and the generate
 * phase from the compatibility shim; without this guard a bare import would
 * start sweeping GitHub.
 */
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return process.argv[1].endsWith('cli.mjs');
  }
})();

if (invokedDirectly) await main();
