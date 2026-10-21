/**
 * Package each game as a standalone zip for itch.io.
 *
 * itch.io hosts the file for free, serves it on its own subdomain, lets you
 * embed ad code, and takes 10% by default (settable to 0% under
 * Settings -> Open revenue sharing). No domain, no ad account, no cost.
 *
 *   npm run package:itch
 *   -> dist/itch/<game>/index.html + dist/itch/<game>.zip
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import content from '../content/games.json' with { type: 'json' };
import { gameShell, gamePageHead } from './shell.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(dist, 'itch');

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function zip(sourceDir, zipPath) {
  // Prefer the system zip, fall back to 7z. Both are usually present; if
  // neither is, the folder is still on disk to zip by hand.
  try {
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: sourceDir });
    return 'zip';
  } catch {
    try {
      execFileSync('7z', ['a', '-tzip', '-y', zipPath, '.'], { cwd: sourceDir, stdio: 'ignore' });
      return '7z';
    } catch {
      return null;
    }
  }
}

function main() {
  if (!existsSync(dist)) {
    console.error('dist/ not found - run `npm run build` first');
    process.exit(1);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const assets = join(dist, 'assets');
  const styles = join(dist, 'styles.css');
  const favicon = join(dist, 'favicon.svg');

  for (const game of content.games) {
    const dir = join(out, game.id);
    mkdirSync(dir, { recursive: true });

    cpSync(assets, join(dir, 'assets'), { recursive: true });
    cpSync(styles, join(dir, 'styles.css'));
    cpSync(favicon, join(dir, 'favicon.svg'));

    const html = `${gamePageHead({
      title: `${game.title} - free browser game`,
      description: game.description,
      canonical: null,
    })}
<body class="is-game" data-game="${game.id}">
${gameShell(game)}
<section class="wrap prose" style="padding:20px 16px 40px">
  <h2>${esc(game.title)}</h2>
  <p>${esc(game.description)}</p>
  <p>Free to play in your browser - no download, no sign-up. More free games at arcadefork.pages.dev.</p>
</section>
<script type="module" src="assets/host.js"></script>
</body>
</html>`;
    writeFileSync(join(dir, 'index.html'), html);

    writeFileSync(
      join(dir, 'README.txt'),
      [
        game.title,
        '',
        game.description,
        '',
        'Upload this folder to itch.io as a browser game.',
        '  1. Create a new project, set the kind to "HTML" and the upload to "This file will be played in the browser".',
        '  2. Zip the contents of this folder (index.html at the root) and upload.',
        '  3. Under "Settings" you can embed ad code and set the revenue share.',
        '',
      ].join('\n'),
    );

    const zipPath = join(out, `${game.id}.zip`);
    const used = zip(dir, zipPath);
    console.log(
      used
        ? `packaged ${game.id} -> dist/itch/${game.id}.zip (${used})`
        : `packaged ${game.id} -> dist/itch/${game.id}/  (no zip tool found, zip it by hand)`,
    );
  }

  console.log(`\n${content.games.length} game packages ready in dist/itch/`);
}

main();
