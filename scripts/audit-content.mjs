/**
 * Content gate: the catalogue must not read like a repository.
 *
 *   node scripts/audit-content.mjs            fails (exit 1) on any problem
 *   node scripts/audit-content.mjs --report   prints counts, always exits 0
 *
 * The report mode exists because the copy rewrite is a long job: while
 * curation is in progress the counts are the useful signal, and only the final
 * gate should block a deploy.
 *
 * Checks
 *   a. developer jargon in user-visible copy (tagline / description / howToPlay)
 *   b. two games sharing a title, compared lowercased with whitespace collapsed
 *   c. an overlay that patches an id no layer produced
 *   d. dist/robots.txt with a doubled slash after the host, or no Sitemap line
 *   e. dist/games empty - the build has not run
 *
 * Copy is checked AFTER the overlays are applied, because that is the text a
 * reader actually gets: a patch that fixes a README paragraph has to clear the
 * gate, and a patch that reintroduces jargon has to fail it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeCatalogue, layerGames } from './catalogue.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const report = process.argv.includes('--report');

/** Optional layer: a missing file is an empty layer, not a crash. */
function readLayer(rel) {
  const file = join(root, rel);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${rel} is not valid JSON: ${err.message}`);
  }
}

/**
 * Repository language a player never needs to read.
 *
 * Deliberately word-bounded: "readme" and "jquery" only match as whole words,
 * so a game called "JQuerying" would not be flagged but "see the README" is.
 */
const DEV_JARGON = new RegExp(
  [
    /\bnpm\b/,
    /\byarn\s+install\b/,
    /\bwebpack\b/,
    /\bjquery\b/,
    /\bgit\s+clone\b/,
    /\bpackage\.json\b/,
    /\breadme\b/,
    /\brepository\b/,
    /\burl:\s*https?:/,
    /<script/i,
    /\.css\s+file/i,
    /\bin:name\b/,
    /\bin:description\b/,
  ]
    .map((re) => re.source)
    .join('|'),
  'i',
);

const problems = [];
const counts = { copy: 0, titles: 0, overlays: 0, robots: 0, build: 0 };

const base = readLayer('content/games.json');
const overlaysDoc = readLayer('content/overlays.json');
const overlays = overlaysDoc.games ?? {};

const layers = {
  base: layerGames(base),
  engine: layerGames(readLayer('content/engine-new.json')),
  curated: layerGames(readLayer('content/curated.json')),
  published: layerGames(readLayer('content/harvest-published.json')),
  generated: layerGames(readLayer('content/games.generated.json')),
};

// (c) an overlay for an unknown id. Checked against the merged ids without the
// overlays, so the report can name the typo instead of only throwing. Unknown
// keys are then dropped before the merge, so one typo does not hide the state
// of the other 500 overlays.
const bare = mergeCatalogue(layers);
const known = new Set(bare.map((g) => g.id));
const usableOverlays = {};
for (const [id, patch] of Object.entries(overlays)) {
  if (known.has(id)) usableOverlays[id] = patch;
  else {
    counts.overlays += 1;
    problems.push(`overlays.json references unknown game: ${id}`);
  }
}

/** The catalogue as it ships: layered merge with the copy overlays applied. */
const games = mergeCatalogue({ ...layers, overlays: usableOverlays });

// (b) duplicate titles, and (a) developer jargon in user-visible copy.
const seen = new Map();
for (const game of games) {
  const title = String(game.title ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (title) {
    if (seen.has(title)) {
      counts.titles += 1;
      problems.push(`duplicate title "${game.title}": ${seen.get(title)} and ${game.id}`);
    } else {
      seen.set(title, game.id);
    }
  }

  const copy = [game.tagline, game.description, ...(Array.isArray(game.howToPlay) ? game.howToPlay : [])]
    .filter((part) => part !== undefined && part !== null)
    .map((part) => (typeof part === 'string' ? part : String(part?.text ?? part?.line ?? JSON.stringify(part))))
    .filter(Boolean)
    .join(' \n ');
  if (DEV_JARGON.test(copy)) {
    counts.copy += 1;
    const hit = copy.match(DEV_JARGON)?.[0] ?? '';
    problems.push(`${game.id}: developer text in ${fieldWith(game)} ("${hit}")`);
  }
}

/** Which user-visible field holds the jargon - the first one that matches. */
function fieldWith(game) {
  for (const key of ['tagline', 'description', 'howToPlay']) {
    const value = game[key];
    if (value === undefined) continue;
    const text = Array.isArray(value) ? value.join(' \n ') : String(value);
    if (DEV_JARGON.test(text)) return key;
  }
  return 'copy';
}

// (d) robots.txt advertises a malformed sitemap or none at all.
const robots = join(root, 'dist/robots.txt');
if (existsSync(robots)) {
  const line = readFileSync(robots, 'utf8')
    .split('\n')
    .find((l) => /^\s*Sitemap:/i.test(l));
  if (!line) {
    counts.robots += 1;
    problems.push('dist/robots.txt has no Sitemap line');
  } else if (/:\/\/[^/\s]+\/\//.test(line)) {
    counts.robots += 1;
    problems.push(`dist/robots.txt sitemap has a doubled slash: ${line.trim()}`);
  }
} else {
  counts.robots += 1;
  problems.push('dist/robots.txt is missing - run `npm run build` first');
}

// (e) the build ran at all.
const gamesDir = join(root, 'dist/games');
const pages = existsSync(gamesDir) ? readdirSync(gamesDir, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
if (!pages.length) {
  counts.build += 1;
  problems.push('dist/games is empty - run `npm run build` first');
}

const summary = `audit-content: ${games.length} games, ${pages.length} pages, ${problems.length} problems`;

if (!problems.length) {
  console.log(`audit-content: ${games.length} games, ${pages.length} pages, 0 problems`);
  process.exit(0);
}

console.error(summary);
console.error(`  copy: ${counts.copy} game(s) with developer text`);
console.error(`  titles: ${counts.titles} duplicate title(s)`);
console.error(`  overlays: ${counts.overlays} unknown id(s)`);
console.error(`  robots: ${counts.robots} problem(s)`);
console.error(`  build: ${counts.build} problem(s)`);
for (const problem of problems.slice(0, 40)) console.error(` - ${problem}`);
if (problems.length > 40) console.error(` - ... ${problems.length - 40} more`);

if (report) {
  console.error(`audit-content: report mode - ${problems.length} problem(s) outstanding, not failing`);
  process.exit(0);
}
process.exit(1);
