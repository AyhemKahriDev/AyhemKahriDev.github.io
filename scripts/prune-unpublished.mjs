/**
 * Delete vendored games that can never be published.
 *
 *   node scripts/prune-unpublished.mjs --dry-run
 *   node scripts/prune-unpublished.mjs
 *
 * A harvest round vendors more than it publishes: caps drop some, the dedupe
 * drops others, and validation deletes the dead ones it finds. What is left is
 * a third-party/ directory of 968 games for a 502-game catalogue - 1.3 GB of
 * files that are in the repository, in every clone, and in no page.
 *
 * Only two kinds of directory are removed:
 *   - validated:true in .harvested.json and NOT published (cap/dedupe rejects);
 *   - validated:false/dead (validation rejected it but the delete failed).
 * Anything still awaiting validation is kept: deleting it would throw away work
 * that could still pass, and the candidate list can always re-vendor it.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const thirdParty = join(root, 'third-party');
const dryRun = process.argv.includes('--dry-run');

const read = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(join(root, p), 'utf8'));
  } catch {
    return fallback;
  }
};

const published = new Set(
  (read('content/harvest-published.json', { games: [] }).games ?? []).map((g) => {
    const m = String(g.embed?.src ?? '').match(/^\/third-party\/([^/]+)\//);
    return m ? m[1] : '';
  }),
);
for (const g of read('content/games.json', { games: [] }).games ?? []) {
  const m = String(g.embed?.src ?? '').match(/^\/third-party\/([^/]+)\//);
  if (m) published.add(m[1]);
}
for (const g of read('content/curated.json', { games: [] }).games ?? []) {
  const m = String(g.embed?.src ?? '').match(/^\/third-party\/([^/]+)\//);
  if (m) published.add(m[1]);
}

const dirSize = (dir) => {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else {
      try {
        total += statSync(p).size;
      } catch {
        /* vanished */
      }
    }
  }
  return total;
};

let removed = 0;
let bytes = 0;
let kept = 0;
const reasons = { unpublishable: 0, dead: 0 };

for (const slug of readdirSync(thirdParty)) {
  const dir = join(thirdParty, slug);
  if (!statSync(dir).isDirectory()) continue;
  if (published.has(slug)) {
    kept += 1;
    continue;
  }
  const metaPath = join(dir, '.harvested.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const size = dirSize(dir);

  if (meta.validated === true) {
    reasons.unpublishable += 1;
  } else if (meta.validated === false) {
    reasons.dead += 1;
  } else {
    kept += 1; // still awaiting validation
    continue;
  }

  removed += 1;
  bytes += size;
  console.log(`  - ${slug} (${(size / 1048576).toFixed(1)} MB)`);
  if (!dryRun) rmSync(dir, { recursive: true, force: true });
}

console.log(
  `prune-unpublished: ${dryRun ? 'would remove' : 'removed'} ${removed} directories ` +
    `(${(bytes / 1048576).toFixed(0)} MB) - ${reasons.unpublishable} cap/dedupe rejects, ` +
    `${reasons.dead} dead; kept ${kept} published or pending`,
);
