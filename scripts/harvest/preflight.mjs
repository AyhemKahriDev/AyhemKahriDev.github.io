/**
 * Cheap, cached "can this repository be served as a game page?" check.
 *
 * Vendoring a repo is expensive (tar download + extract + copy); asking GitHub
 * for its root file listing is one API call. The two things that make a repo
 * unservable are visible in that listing: there must be an `index.html` at the
 * root, and there must be a `LICENSE` file to ship with the copy.
 *
 * `gh` is injected - `gh(args) => string` - so tests never touch the network
 * and the orchestrator can decide what a failed call means.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** `LICENSE`, `LICENCE`, `LICENSE.md`, `License.txt`, ... */
const LICENCE_FILE = /^licen[cs]e(\.[^/]*)?$/i;

function readCache(cachePath) {
  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* first run, or a truncated file from a killed one: start clean */
  }
  return {};
}

/**
 * @param {{ gh: (args: string[]) => string, cachePath: string }} options
 * @returns {(repo: string) => { ok: boolean, reason: string, files: string[] }}
 */
export function makePreflight({ gh, cachePath } = {}) {
  if (typeof gh !== 'function') {
    throw new TypeError('makePreflight({ gh }) needs a gh(args) => string function');
  }
  if (!cachePath) {
    throw new TypeError('makePreflight({ cachePath }) needs a cache file path');
  }

  const cache = readCache(cachePath);
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
    cache[key] = verdict;
    dirty = true;
    flush();
    return { ...verdict, files: [...verdict.files] };
  };

  return function preflight(repo) {
    const name = String(repo ?? '').trim();
    if (!name || !name.includes('/')) {
      return { ok: false, reason: 'invalid repo name', files: [] };
    }

    const key = name.toLowerCase();
    const hit = cache[key];
    if (hit && typeof hit === 'object') {
      return { ok: !!hit.ok, reason: hit.reason ?? '', files: [...(hit.files ?? [])] };
    }

    const raw = gh(['api', `repos/${name}/contents/`]);
    // No response is not a verdict. Rate limits and dropped connections are
    // transient, so they are deliberately left uncached and retried.
    if (!raw) return { ok: false, reason: 'contents lookup failed (no API response)', files: [] };

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'contents lookup returned invalid JSON', files: [] };
    }

    // A missing/renamed repo answers with an error object, not an array.
    if (!Array.isArray(payload)) {
      const message = payload?.message ? `: ${String(payload.message).slice(0, 120)}` : '';
      return remember(key, { ok: false, reason: `repository contents unreadable${message}`, files: [] });
    }

    const files = payload
      .filter((entry) => entry && typeof entry.name === 'string')
      .filter((entry) => entry.type === undefined || entry.type === null || entry.type === 'file')
      .map((entry) => entry.name);

    const hasIndex = files.includes('index.html');
    const licenceFile = files.find((name) => LICENCE_FILE.test(name)) ?? '';

    if (!hasIndex) return remember(key, { ok: false, reason: 'no root index.html', files });
    if (!licenceFile) return remember(key, { ok: false, reason: 'no LICENSE file', files });
    return remember(key, { ok: true, reason: 'ok', files });
  };
}
