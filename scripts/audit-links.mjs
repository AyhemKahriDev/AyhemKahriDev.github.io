/**
 * Link + page audit over the built site in dist/.
 *
 *   node scripts/audit-links.mjs
 *
 * Checks every internal href/src in every generated HTML page against the
 * files that actually exist in dist/, and cross-checks the sitemap. Exits
 * non-zero when something is broken, so it can gate a deploy.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('audit-links: dist/ does not exist — run `npm run build` first');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(dist);
const problems = [];
let checked = 0;

/** Resolve a site-absolute path to the file that would serve it. */
function targetFor(pathname) {
  // A vendored game may link `tetris%20game.html`; the file on disk is
  // `tetris game.html`. Resolving the encoded form reported a broken link on a
  // game that works.
  let p;
  try {
    p = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  } catch {
    p = pathname.split('#')[0].split('?')[0];
  }
  if (p === '' || p === '/') p = '/index.html';
  else if (p.endsWith('/')) p += 'index.html';
  const abs = join(dist, p);
  if (existsSync(abs)) {
    const s = statSync(abs);
    if (s.isDirectory()) return join(abs, 'index.html');
    return abs;
  }
  // clean-URL style: /games/foo -> dist/games/foo/index.html
  const asIndex = join(abs, 'index.html');
  if (existsSync(asIndex)) return asIndex;
  // extensionless file
  const asHtml = `${abs}.html`;
  if (existsSync(asHtml)) return asHtml;
  return null;
}

const ATTR = /(?:href|src)\s*=\s*"([^"]+)"/g;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const rel = '/' + relative(dist, file).split('\\').join('/');
  // Vendored games are somebody else's markup. Their references are checked
  // by scripts/audit-embed-assets.mjs, which knows which file was supposed
  // to be where.
  if (rel.startsWith('/third-party/')) continue;
  for (const m of html.matchAll(ATTR)) {
    const href = m[1];
    if (!href) continue;
    if (/^(https?:)?\/\//.test(href)) continue; // external
    if (/^(mailto:|tel:|data:|javascript:|#)/.test(href)) continue;
    if (!href.startsWith('/')) {
      // relative link — resolve against the page
      const dir = dirname(rel);
      const abs = resolve('/', dir, href);
      checked++;
      if (!targetFor(abs)) problems.push(`${rel}: relative link not found -> ${href}`);
      continue;
    }
    checked++;
    if (!targetFor(href)) problems.push(`${rel}: broken internal link -> ${href}`);
  }
}

// Sitemap cross-check.
const sitemapPath = join(dist, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const xml = readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    let p;
    try {
      p = new URL(loc).pathname;
    } catch {
      problems.push(`sitemap: bad url ${loc}`);
      continue;
    }
    if (!targetFor(p)) problems.push(`sitemap: url has no page -> ${loc}`);
  }
  console.log(`audit-links: ${locs.length} sitemap urls, ${pages.length} html pages`);
} else {
  problems.push('sitemap.xml is missing from dist/');
}

console.log(`audit-links: checked ${checked} internal references across ${pages.length} pages`);

if (problems.length) {
  console.error(`audit-links: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 200)) console.error('  ' + p);
  process.exit(1);
}
console.log('audit-links: OK — no broken internal links');
