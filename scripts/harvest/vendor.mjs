/**
 * Concurrent, resumable vendoring.
 *
 * The first version downloaded one repository at a time - a 300-repo harvest
 * spent most of an hour waiting on curl - and it had no preflight, so every
 * repo without a root index.html was downloaded, extracted and thrown away.
 *
 * This module is the back half of `sweep | vendor`: a pure promise pool (no
 * dependencies), a cached preflight per repo, a hard archive size cap, and a
 * temp directory per repo so parallel downloads cannot collide.
 */
import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { slugify } from './filters.mjs';
import { pickEntry } from './entry.mjs';
import { pruneVendored } from '../prune-vendored.mjs';

const run = promisify(execFile);

/** Refuse to unpack anything bigger than this - a repo that size is not a game. */
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

const CURL_TIMEOUT_S = 180;
const README_NAMES = ['README.md', 'readme.md', 'README', 'Readme.md'];
const LICENCE_FILE = /^licen[cs]e(\.[^/]*)?$/i;

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function sizeOf(file) {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

/** A policy rejection: the repo will never be servable, do not retry it. */
function skip(reason) {
  return Object.assign(new Error(reason), { skip: true });
}

/**
 * Simple promise pool. Keeps at most `limit` workers alive and resolves once
 * every item has been handled, preserving the caller's ordering.
 */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function repoOf(candidate) {
  return String(candidate?.repo ?? candidate?.full_name ?? '').trim();
}

/**
 * The entry path a preflight verdict carries, or null.
 *
 * Cached verdicts come from a file on disk, so the path is treated as
 * untrusted: it has to stay inside the vendored directory.
 */
function entryFromVerdict(verdict) {
  const raw = String(verdict?.entry ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const segments = raw.split('/').filter(Boolean);
  if (!segments.length || segments.some((s) => s === '.' || s === '..')) return null;
  return segments.join('/');
}

/** Every file in an extracted tree, repo-relative and forward-slashed. */
function walkPaths(dir, base = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    // Never index a dependency tree or git metadata: the picker would spend
    // its time on node_modules and can only find the wrong answer there.
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkPaths(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function branchOf(candidate) {
  return String(candidate?.defaultBranch ?? candidate?.default_branch ?? 'main').trim() || 'main';
}

/**
 * Vendor every candidate that passes preflight.
 *
 * @param {Array<object>} candidates sweep records ({ repo, defaultBranch, ... })
 * @param {{
 *   concurrency?: number,
 *   thirdPartyDir: string,
 *   workDir: string,
 *   preflight: (repo: string) => { ok: boolean, reason: string, files: string[] },
 *   onProgress?: (event: object) => void,
 * }} options
 * @returns {Promise<{ vendored: object[], skipped: object[], failed: object[] }>}
 */
export async function vendorAll(candidates, options = {}) {
  const {
    concurrency = 6,
    thirdPartyDir,
    workDir,
    preflight,
    onProgress,
  } = options;

  if (!thirdPartyDir) throw new TypeError('vendorAll needs a thirdPartyDir');
  if (!workDir) throw new TypeError('vendorAll needs a workDir');
  if (typeof preflight !== 'function') throw new TypeError('vendorAll needs a preflight(repo) function');

  const workers = Math.max(1, Math.min(32, Math.floor(Number(concurrency) || 6)));
  const list = Array.isArray(candidates) ? candidates : [];
  const tmpRoot = join(workDir, 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  mkdirSync(thirdPartyDir, { recursive: true });

  const total = list.length;
  let done = 0;

  const report = (event) => {
    done += 1;
    if (typeof onProgress === 'function') onProgress({ index: done, total, ...event });
  };

  async function vendorOne(candidate) {
    const repo = repoOf(candidate);
    if (!repo || !repo.includes('/')) {
      return { status: 'failed', repo, slug: '', reason: 'invalid repo name' };
    }

    const slug = candidate.slug || slugify(repo);
    const dest = join(thirdPartyDir, slug);

    // Already vendored (possibly by an earlier run): reuse the metadata
    // rather than re-downloading the same tarball.
    if (existsSync(join(dest, '.harvested.json'))) {
      const meta = readJson(join(dest, '.harvested.json'), { ...candidate, slug });
      return { status: 'reused', meta: { ...meta, reused: true }, repo, slug };
    }

    const verdict = await preflight(repo);
    if (!verdict?.ok) {
      return { status: 'skipped', repo, slug, reason: verdict?.reason || 'preflight rejected' };
    }

    const licenceFile =
      (verdict.files ?? []).find((name) => LICENCE_FILE.test(name)) || 'LICENSE';
    const url = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${branchOf(candidate)}`;

    // mkdtemp guarantees a unique directory, so six parallel workers cannot
    // extract into each other's tree.
    const tmp = mkdtempSync(join(tmpRoot, `${slug.slice(0, 40).replace(/[^a-z0-9-]/g, '')}-`));
    const tarball = join(tmp, 'repo.tgz');
    const tree = join(tmp, 'tree');

    try {
      try {
        await run(
          'curl',
          [
            '-sL', '--fail', '--retry', '2', '--retry-connrefused',
            '-m', String(CURL_TIMEOUT_S),
            url, '-o', tarball,
          ],
          { maxBuffer: 4 * 1024 * 1024 },
        );
      } catch (err) {
        throw new Error(`download failed: ${String(err?.stderr || err?.message || err).trim().slice(0, 120)}`);
      }

      const bytes = sizeOf(tarball);
      if (bytes < 2000) throw skip(`download too small (${bytes} bytes)`);
      if (bytes > MAX_ARCHIVE_BYTES) {
        throw skip(`archive too large (${(bytes / 1024 / 1024).toFixed(1)} MB > 25 MB)`);
      }

      mkdirSync(tree, { recursive: true });
      try {
        await run('tar', ['xzf', tarball, '-C', tree, '--strip-components=1'], {
          maxBuffer: 4 * 1024 * 1024,
        });
      } catch (err) {
        throw new Error(`extract failed: ${String(err?.stderr || err?.message || err).trim().slice(0, 120)}`);
      }

      // A repo whose game lives in a subdirectory used to be thrown away
      // here: only /third-party/<slug>/index.html was considered servable.
      // The catalogue embeds any path, so require the entry preflight found
      // instead. The verdict came from the API tree, which can lag the
      // tarball by a commit, so the extracted copy is the authority.
      let entry = entryFromVerdict(verdict);
      if (!entry || !existsSync(join(tree, entry))) {
        entry = pickEntry(walkPaths(tree)).entry;
      }
      if (!entry) throw skip('no entry html after extract');

      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      for (const entry of readdirSync(tree)) {
        if (entry === '.git' || entry === 'node_modules') continue;
        cpSync(join(tree, entry), join(dest, entry), { recursive: true });
      }

      let readme = '';
      for (const name of README_NAMES) {
        const p = join(dest, name);
        if (existsSync(p)) {
          readme = readFileSync(p, 'utf8');
          break;
        }
      }

      // Prune before committing: the repo is the deploy. APKs, PSDs, READMEs,
      // CI files and unreferenced multi-megabyte media never reach git.
      pruneVendored(dest);
      if (!existsSync(join(dest, entry))) {
        // pruned anyway (a .gitkeep-only docs/ build, say): do not publish a
        // game whose page is not there.
        rmSync(dest, { recursive: true, force: true });
        throw skip(`entry ${entry} did not survive prune`);
      }

      const licence = candidate.licence ?? candidate.license?.spdx_id ?? 'UNKNOWN';
      const owner = candidate.owner ?? repo.split('/')[0];

      // Same shape the original vendor() wrote: validate and generate read it.
      const meta = {
        ...candidate,
        repo,
        licence,
        slug,
        dest: `third-party/${slug}`,
        readme: readme.slice(0, 6000),
        licenceFile,
        // Where the game actually starts, relative to the vendored folder.
        // validate opens this and import publishes it as embed.src.
        entry,
      };
      writeJson(join(dest, '.harvested.json'), meta);
      writeFileSync(
        join(dest, 'ARCADEFORK-NOTICE.md'),
        `# ${repo} - vendored third-party game

- **Repository:** https://github.com/${repo}
- **Author:** ${owner}
- **Licence:** ${licence} (see ${licenceFile} in this folder)
- **Vendored by:** arcadefork (Ayhem Kahri)

The original ${licence} licence text ships in this folder and applies to its contents.
`,
      );

      return { status: 'vendored', meta, repo, slug };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  const outcomes = await pool(list, workers, async (candidate) => {
    let outcome;
    try {
      outcome = await vendorOne(candidate);
    } catch (err) {
      const repo = repoOf(candidate);
      outcome = {
        status: err?.skip ? 'skipped' : 'failed',
        repo,
        slug: candidate?.slug || (repo ? slugify(repo) : ''),
        reason: String(err?.message ?? err).slice(0, 200),
      };
    }
    report({ status: outcome.status, repo: outcome.repo, slug: outcome.slug, reason: outcome.reason });
    return outcome;
  });

  const vendored = [];
  const skipped = [];
  const failed = [];
  for (const outcome of outcomes) {
    if (!outcome) continue;
    if (outcome.status === 'vendored' || outcome.status === 'reused') vendored.push(outcome.meta);
    else if (outcome.status === 'skipped') {
      skipped.push({ repo: outcome.repo, slug: outcome.slug, reason: outcome.reason });
    } else {
      failed.push({ repo: outcome.repo, slug: outcome.slug, reason: outcome.reason });
    }
  }

  // Written even when empty, so a resumed run can tell "no failures" from
  // "the last run never finished".
  writeJson(join(workDir, 'failed.json'), failed);

  return { vendored, skipped, failed };
}
