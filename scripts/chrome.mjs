/**
 * One Chrome lookup, for every gate that needs a browser.
 *
 * Five scripts each carried their own copy of this, and each copy assumed one
 * exact directory layout: `<cache>/chrome-headless-shell/<version>/chrome-
 * headless-shell-linux64/chrome-headless-shell`. `npx @puppeteer/browsers
 * install chrome-headless-shell` does not produce that layout on every
 * platform - it nests an extra directory - so every gate died with "No Chrome
 * found" on a machine where Chrome was installed and working.
 *
 * This version walks the cache directory instead of guessing, then falls back
 * to the usual system paths.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE = join(homedir(), '.cache/hyperframes/chrome');
const BINARIES = new Set(['chrome', 'chrome-headless-shell', 'chromium']);
const SYSTEM = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

/** Depth-limited walk; the cache is shallow and a full walk is wasteful. */
function walk(dir, depth = 0) {
  if (depth > 4) return [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const found = [];
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isFile() && BINARIES.has(name)) found.push(p);
    else if (st.isDirectory()) found.push(...walk(p, depth + 1));
  }
  return found;
}

export function findChrome({ required = true } = {}) {
  const cached = walk(CACHE)
    .map((p) => {
      let mtime = 0;
      try {
        mtime = statSync(p).mtimeMs;
      } catch {
        /* unreadable: it sorts last, it will not be picked */
      }
      // A headless shell is the binary the gates want; a full Chrome works
      // too but starts slower and opens a profile.
      return { p, score: (p.includes('headless-shell') ? 0 : 1) * 1e15 - mtime };
    })
    .sort((a, b) => a.score - b.score);
  if (cached.length) return cached[0].p;

  for (const p of SYSTEM) {
    if (existsSync(p)) return p;
  }
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  if (!required) return null;
  throw new Error(
    'No Chrome found. Install one with:\n' +
      '  npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/hyperframes/chrome/chrome-headless-shell\n' +
      'or set CHROME_PATH to a Chrome/Chromium binary.',
  );
}
