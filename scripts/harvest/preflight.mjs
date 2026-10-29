/**
 * Cheap, cached "can this repository be served as a game page?" check.
 *
 * Vendoring a repo is expensive (tar download + extract + copy); asking GitHub
 * for its file list is one call. What makes a repo servable is an html entry
 * file *somewhere* in the tree, plus a licence to ship with the copy.
 *
 * The first version demanded `index.html` at the root and refused 181 of 212
 * candidates in a live sweep, even though the catalogue has always been able to
 * embed any path under /third-party/<slug>/. The entry is now discovered (see
 * ./entry.mjs) from a single `git/trees?recursive=1` call - the whole tree in
 * one request, much cheaper than walking directories - and carried in the
 * verdict so vendor, validate and import all address the same file.
 *
 * `gh` is injected - `gh(args) => string` - so tests never touch the network
 * and the orchestrator can decide what a failed call means.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pickEntry } from './entry.mjs';

/**
 * A licence file at the repository root: `LICENSE`, `LICENCE.md`, `COPYING`,
 * `UNLICENSE`, `LICENSE-MIT`, ... all carry terms we redistribute under.
 */
const LICENCE_FILE = /^(licen[cs]e|copying|unlicense)/i;

/**
 * Branch names to ask for a tree. `HEAD` resolves on any repo with a commit,
 * so the common case needs no knowledge of main vs master; the rest are the
 * fallback for hosts that will not resolve HEAD.
 */
const BRANCHES = ['HEAD', 'main', 'master'];

/**
 * Directories worth one extra listing call when the tree endpoint cannot
 * answer - the names entry.mjs ranks highest. Bounded on purpose: this is a
 * fallback, not a directory walker.
 */
const LIKELY_DIRS = ['docs', 'dist', 'build', 'public', 'game', 'games', 'src', 'www', 'app', 'play'];
const MAX_DESCENT = 5;

/**
 * Bumped when a verdict means something different. Only old *refusals* are
 * discarded: a repo that had a root index.html still has one, but a repo
 * refused for "no root index.html" may be perfectly playable now.
 */
const CACHE_VERSION = 2;

function readCache(cachePath) {
  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* first run, or a truncated file from a killed one: start clean */
  }
  return {};
}

/** Files sitting at the repository root, out of a full or partial path list. */
function rootFiles(paths) {
  return paths.filter((path) => typeof path === 'string' && path && !path.includes('/'));
}

/**
 * Interpret whatever `gh` printed.
 *
 * Three shapes arrive here: the `--jq '.tree[].path'` newline list, raw
 * `{ "tree": [{ "path": ... }] }` JSON (older gh, or no --jq), and a plain
 * directory listing (`[{ name, type }]`) from the contents endpoint.
 *
 * @returns {{ paths: string[], files: string[] } | null} `files` is always the
 *   root-level files; null when the response is not a listing at all (an API
 *   error object, a truncated body, ...).
 */
function readListing(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith('[') || text.startsWith('{')) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return null;
    }

    if (Array.isArray(payload)) {
      const paths = [];
      const files = [];
      let typed = false;
      for (const item of payload) {
        if (typeof item === 'string') {
          if (!item) return null;
          paths.push(item);
        } else if (item && typeof item.path === 'string') {
          paths.push(item.path); // git/tree entry
        } else if (item && typeof item.name === 'string') {
          paths.push(item.name); // contents entry
          if (typeof item.type === 'string') {
            typed = true;
            if (item.type !== 'dir' && item.type !== 'tree') files.push(item.name);
          }
        } else {
          return null;
        }
      }
      return { paths, files: typed ? files : rootFiles(paths) };
    }

    if (payload && Array.isArray(payload.tree)) {
      const paths = payload.tree
        .map((entry) => entry?.path)
        .filter((path) => typeof path === 'string' && path);
      return { paths, files: rootFiles(paths) };
    }

    // { "message": "Not Found" } - an answer, but not a listing.
    return null;
  }

  // `gh api ... --jq '.tree[].path'`: one repo-relative path per line.
  const paths = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return { paths, files: rootFiles(paths) };
}

/**
 * @param {{ gh: (args: string[]) => string, cachePath: string, branches?: string[] }} options
 * @returns {(repo: string) => { ok: boolean, reason: string, files: string[], entry: string|null }}
 */
export function makePreflight({ gh, cachePath, branches } = {}) {
  if (typeof gh !== 'function') {
    throw new TypeError('makePreflight({ gh }) needs a gh(args) => string function');
  }
  if (!cachePath) {
    throw new TypeError('makePreflight({ cachePath }) needs a cache file path');
  }

  const cache = readCache(cachePath);
  const branchList = Array.isArray(branches) && branches.length ? branches : BRANCHES;
  let dirty = false;

  // Written on every new verdict, not at exit: a run killed half way through a
  // 500-repo batch must not pay for the first 250 lookups again.
  const flush = () => {
    if (!dirty) return;
    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
      dirty = false;
    } catch {
      /* an unwritable cache only costs API calls, it is never a verdict */
    }
  };

  const remember = (key, verdict) => {
    cache[key] = { v: CACHE_VERSION, ...verdict };
    dirty = true;
    flush();
    return { ...verdict, files: [...verdict.files] };
  };

  /** gh that fails by throwing means the same as gh that returns nothing. */
  const ask = (args) => {
    try {
      return gh(args);
    } catch {
      return '';
    }
  };

  /** One call, whole tree. null when the tree endpoint could not answer. */
  const treeOf = (repo) => {
    for (const branch of branchList) {
      const raw = ask(['api', `repos/${repo}/git/trees/${branch}?recursive=1`, '--jq', '.tree[].path']);
      const listing = readListing(raw);
      if (listing) return listing;
      // A JSON body that did not parse as a listing is the repository's
      // answer (404, empty repo); another branch name will not change it.
      if (typeof raw === 'string' && /^\s*[[{]/.test(raw)) return null;
    }
    return null;
  };

  /** Fallback: the root listing, plus one level into the likely directories. */
  const contentsOf = (repo) => {
    const listing = readListing(ask(['api', `repos/${repo}/contents/`]));
    if (!listing) return null;
    if (pickEntry(listing.paths).entry) return listing;

    const dirs = listing.paths
      .filter((path) => !path.includes('/'))
      .filter((path) => LIKELY_DIRS.includes(path.toLowerCase()))
      .slice(0, MAX_DESCENT);

    const paths = [...listing.paths];
    for (const dir of dirs) {
      const inner = readListing(ask(['api', `repos/${repo}/contents/${dir}`]));
      if (!inner) continue;
      for (const path of inner.paths) if (!path.includes('/')) paths.push(`${dir}/${path}`);
    }
    return { paths, files: listing.files };
  };

  return function preflight(repo) {
    const name = String(repo ?? '').trim();
    if (!name || !name.includes('/')) {
      return { ok: false, reason: 'invalid repo name', files: [], entry: null };
    }

    const key = name.toLowerCase();
    const hit = cache[key];
    if (hit && typeof hit === 'object') {
      // A current verdict is authoritative. An older *acceptance* is still
      // true (the rule only became more permissive); an older refusal is not,
      // because it may be exactly the "no root index.html" the new rule fixes.
      if (hit.v === CACHE_VERSION || hit.ok === true) {
        return {
          ok: !!hit.ok,
          reason: hit.reason ?? '',
          files: [...(hit.files ?? [])],
          entry: hit.ok ? (hit.entry ?? 'index.html') : (hit.entry ?? null),
        };
      }
    }

    const listing = treeOf(name) ?? contentsOf(name);
    // No response is not a verdict. Rate limits and dropped connections are
    // transient, so they are deliberately left uncached and retried.
    if (!listing) {
      return { ok: false, reason: 'contents lookup failed (no API response)', files: [], entry: null };
    }
    if (!listing.paths.length) {
      return remember(key, { ok: false, reason: 'repository is empty', files: [], entry: null });
    }

    const { entry, reason: why } = pickEntry(listing.paths);
    const licenceFile = listing.files.find((file) => LICENCE_FILE.test(file)) ?? '';

    if (!entry) {
      // Keeps the historic wording: the old refusal is what the cache, the
      // logs and content/blocked.json review notes all refer to.
      return remember(key, {
        ok: false,
        reason: `no root index.html and no nested entry (${why})`,
        files: listing.files,
        entry: null,
      });
    }
    if (!licenceFile) {
      return remember(key, { ok: false, reason: 'no LICENSE file', files: listing.files, entry });
    }
    return remember(key, { ok: true, reason: 'ok', files: listing.files, entry });
  };
}
