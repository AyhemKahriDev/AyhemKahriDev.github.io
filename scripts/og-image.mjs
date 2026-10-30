/**
 * Render the social preview card.
 *
 *   node scripts/og-image.mjs
 *
 * Writes public/og.png (1200x630), the image every shared link of the site
 * shows. The card is rendered by a headless browser from
 * public/og-card.html, so the artwork lives in HTML and can be edited
 * without touching this script.
 *
 * The PNG is committed to the repository: the build must not need a browser,
 * or the deploy would depend on one.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './chrome.mjs';
import { layerGames, mergeCatalogue } from './catalogue.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const card = join(root, 'scripts/og-card.html');
const out = join(root, 'public/og.png');

/** One catalogue layer, or [] when the file is absent. */
function layer(name) {
  const p = join(root, 'content', name);
  if (!existsSync(p)) return [];
  return layerGames(JSON.parse(readFileSync(p, 'utf8')));
}

/**
 * The number of games in the catalogue, so the card can never claim a
 * number the site does not have.
 *
 * This used to add only content/games.json and content/games.generated.json,
 * which is two of the five layers — the card said "168 games" while the site
 * served 565. It now merges exactly the way the site builder does.
 */
function gameCount() {
  const overlaysPath = join(root, 'content/overlays.json');
  const overlays = existsSync(overlaysPath)
    ? (JSON.parse(readFileSync(overlaysPath, 'utf8')).games ?? {})
    : {};
  return mergeCatalogue({
    base: layer('games.json'),
    engine: layer('engine-new.json'),
    curated: layer('curated.json'),
    published: layer('harvest-published.json'),
    generated: layer('games.generated.json'),
    overlays,
  }).length;
}

const chrome = findChrome();
mkdirSync(dirname(out), { recursive: true });

// The card is authored as HTML with a placeholder for the game count, so
// the artwork can never claim a number the site does not have.
const count = gameCount();
const rendered = join(root, '.og-card.rendered.html');
writeFileSync(
  rendered,
  readFileSync(card, 'utf8').replace(/\{\{GAME_COUNT\}\}/g, String(count)),
);

const proc = spawn(
  chrome,
  [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--screenshot=${out}`,
    `file://${rendered}`,
  ],
  { stdio: 'ignore' },
);

proc.on('exit', (code) => {
  rmSync(rendered, { force: true });
  if (code !== 0 || !existsSync(out)) {
    console.error(`og-image: the browser exited with ${code}`);
    process.exit(1);
  }
  const { size } = statSync(out);
  console.log(`og-image: wrote public/og.png (${Math.round(size / 1024)} kB, ${count} games)`);
});
