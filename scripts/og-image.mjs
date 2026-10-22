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
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const card = join(root, 'scripts/og-card.html');
const out = join(root, 'public/og.png');

function findChrome() {
  const base = join(process.env.HOME ?? '', '.cache/hyperframes/chrome/chrome-headless-shell');
  if (existsSync(base)) {
    for (const v of readdirSync(base)) {
      const p = join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome found. Run: npx hyperframes browser ensure');
}

const chrome = findChrome();
mkdirSync(dirname(out), { recursive: true });

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
    `file://${card}`,
  ],
  { stdio: 'ignore' },
);

proc.on('exit', (code) => {
  if (code !== 0 || !existsSync(out)) {
    console.error(`og-image: the browser exited with ${code}`);
    process.exit(1);
  }
  const { size } = statSync(out);
  console.log(`og-image: wrote public/og.png (${Math.round(size / 1024)} kB)`);
});
