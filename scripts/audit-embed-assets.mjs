/**
 * Static asset resolver for the published third-party embeds.
 *
 *   node scripts/audit-embed-assets.mjs [--json]
 *
 * For every game in the catalogue that is embedded, resolve the script,
 * stylesheet, image and media references of the published HTML against the
 * files that actually ship. Anything that cannot be resolved is either
 *
 *   - FIXABLE: the file exists in the game folder but the page asks for it
 *     with a root-absolute path ("/scripts/main.js"), which breaks the game
 *     as soon as it is served from /third-party/<name>/, or
 *   - UNBUILDABLE: the file does not exist anywhere - the game needs a build
 *     step (webpack, vite, emscripten) and can never run in a browser.
 *
 * Exit code 0 when every reference resolves.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeCatalogue, layerGames } from './catalogue.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
// Every catalogue layer, exactly as the build merges them. This gate used to
// resolve references for games.json + games.generated.json only - the 168-game
// subset the site had before the catalogue grew - so 397 published games were
// never asset-checked at all. scripts/catalogue.mjs is the one merge.
const GAMES = mergeCatalogue({
  base: readJson('content/games.json').games ?? [],
  engine: layerGames(readJson('content/engine-new.json')),
  curated: layerGames(readJson('content/curated.json')),
  published: layerGames(readJson('content/harvest-published.json')),
  generated: readJson('content/games.generated.json').games ?? [],
  overlays: readJson('content/overlays.json').games ?? {},
});

/** Files that are nice to have, not required for the game to run. */
const COSMETIC =
  /favicon|apple-touch|manifest|android-chrome|site\.webmanifest|paypal|qr|badge|logo\.png|screenshot|preview|\.map($|\?)/i;

/** A reference to a file the browser cannot execute. */
const CODE = /\.(js|mjs|css|wasm)$/i;

const REF = /<(?:script|link|img|audio|video|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

/**
 * A value in src= is not necessarily a filename.
 *
 * The vendored games are other people's code, and some of them write markup
 * inside JavaScript template strings ("${show.image ? show.image.medium : ...}")
 * or pass a function call through ("imagePath()"). Those matched the attribute
 * regex and were reported as missing files, which is exactly the kind of false
 * alarm that teaches everyone to ignore the gate.
 */
function looksLikePath(ref) {
  if (/\$\{|\{\{|<<</.test(ref)) return false;
  if (/[\s<>(){}`+*|\[\]\\]/.test(ref)) return false;
  if (ref.startsWith('${')) return false;
  return true;
}

const rows = [];

for (const g of GAMES) {
  if (!g.embed?.src) continue;
  const pagePath = join(dist, g.embed.src.replace(/^\/+/, ''));
  if (!existsSync(pagePath)) {
    rows.push({ id: g.id, src: g.embed.src, verdict: 'NO_PAGE' });
    continue;
  }
  const html = readFileSync(pagePath, 'utf8');
  const pageDir = posix.dirname('/' + relative(dist, pagePath).split('\\').join('/'));
  const gameDir = posix.dirname('/' + g.embed.src.replace(/^\/+/, ''));

  const unresolved = [];
  for (const m of html.matchAll(REF)) {
    const ref = m[1].trim();
    if (!ref) continue;
    if (!looksLikePath(ref)) continue;
    if (/^(https?:)?\/\//i.test(ref)) continue;
    if (/^(data:|mailto:|tel:|javascript:|#)/i.test(ref)) continue;

    let target;
    let fixable = false;
    if (ref.startsWith('/')) {
      // Root-absolute: the browser asks the site root, not the game folder,
      // so that is where the file has to be for the page to work.
      target = ref.split(/[?#]/)[0];
      // The same file inside the game folder means the page used a
      // root-absolute path and the game is one rewrite away from working.
      fixable = existsSync(join(dist, gameDir.replace(/^\/+/, ''), ref.replace(/^\/+/, '')));
    } else {
      target = posix.normalize(posix.join(pageDir, ref.split(/[?#]/)[0]));
    }
    if (existsSync(join(dist, target.replace(/^\/+/, '')))) continue;

    const asIs = ref.startsWith('/');
    unresolved.push({
      ref,
      kind: CODE.test(ref) ? 'code' : 'asset',
      fixable,
    });
  }

  const codeProblems = unresolved.filter((u) => u.kind === 'code' && !COSMETIC.test(u.ref));
  const assetProblems = unresolved.filter((u) => u.kind === 'asset' && !COSMETIC.test(u.ref));
  if (!unresolved.length) continue;
  rows.push({
    id: g.id,
    src: g.embed.src,
    verdict: codeProblems.length ? 'DEAD' : assetProblems.length ? 'DEGRADED' : 'COSMETIC',
    code: codeProblems,
    assets: assetProblems,
  });
}

const dead = rows.filter((r) => r.verdict === 'DEAD');
const degraded = rows.filter((r) => r.verdict === 'DEGRADED');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ dead, degraded }, null, 2));
} else {
  console.log(`audit-embed-assets: ${dead.length} dead, ${degraded.length} degraded, ${rows.length - dead.length - degraded.length} cosmetic-only`);
  for (const d of dead) {
    console.log(`  DEAD ${d.id}`);
    for (const c of d.code) console.log(`        ${c.fixable ? 'FIXABLE' : 'UNBUILDABLE'}  ${c.ref}`);
  }
  for (const d of degraded) {
    console.log(`  DEGRADED ${d.id}`);
    for (const c of d.assets) console.log(`        ${c.fixable ? 'FIXABLE' : 'MISSING  '}  ${c.ref}`);
  }
}
if (dead.length) process.exit(1);
