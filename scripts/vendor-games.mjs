/**
 * Vendor third-party open-source games into the site.
 *
 *   node scripts/vendor-games.mjs
 *
 * Every game here is vendored verbatim with its original LICENSE file and a
 * NOTICE that credits the author and links the source. Nothing is modified
 * except:
 *   - optional media re-encoding (bg_music.mp3) to cut page weight
 *   - one external stylesheet (pacman) is downloaded and served locally so the
 *     game does not hotlink another site
 *
 * The output lands in third-party/<id>/ and is copied into dist/ at build time.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'third-party');
const tmp = join(root, '.vendor-tmp');

/** @type {Array<{id:string,repo:string,branch:string,license:string,title:string,author:string,url:string,keep?:string[],drop?:string[],notes?:string[]}>} */
const GAMES = [
  {
    id: 'trust',
    repo: 'ncase/trust',
    branch: 'gh-pages',
    license: 'CC0-1.0',
    title: 'The Evolution of Trust',
    author: ' Nicky Case',
    url: 'https://github.com/ncase/trust',
    drop: ['notes', '.git', 'README.md'],
    notes: [
      'Vendored verbatim from the gh-pages branch of ncase/trust.',
      'The only change: assets/sounds/bg_music.mp3 was re-encoded to a lower bitrate to cut page weight.',
    ],
  },
  {
    id: 'loopy',
    repo: 'ncase/loopy',
    branch: 'gh-pages',
    license: 'CC0-1.0',
    title: 'Loopy',
    author: ' Nicky Case',
    url: 'https://github.com/ncase/loopy',
    drop: ['v1', 'social', '.git', 'README.md'],
    notes: [
      'Vendored verbatim from the gh-pages branch of ncase/loopy.',
      'The older v1 folder was dropped; index.html loads v1.1.',
    ],
  },
  {
    id: 'tetris',
    repo: 'jakesgordon/javascript-tetris',
    branch: 'master',
    license: 'MIT',
    title: 'Javascript Tetris',
    author: 'Jake Gordon',
    url: 'https://github.com/jakesgordon/javascript-tetris',
    drop: ['.git', 'README.md'],
    notes: ['Vendored verbatim from jakesgordon/javascript-tetris.'],
  },
  {
    id: 'pacman',
    repo: 'mumuy/pacman',
    branch: 'master',
    license: 'MIT',
    title: 'Pacman',
    author: 'mumuy',
    url: 'https://github.com/mumuy/pacman',
    drop: ['.git', 'README.md'],
    notes: [
      'Vendored verbatim from mumuy/pacman.',
      'The stylesheet that the original linked to passer-by.com was downloaded and served locally, so the game makes no external requests.',
    ],
  },
];

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Download external resources a game hotlinks and serve them locally, so the
 * vendored copy makes no third-party requests and cannot break when the
 * original site moves.
 */
async function localiseExternal(dest, assets) {
  for (const asset of assets) {
    try {
      const res = await fetch(asset.url);
      if (!res.ok) {
        console.warn(`  ${asset.url} -> HTTP ${res.status}, skipped`);
        continue;
      }
      const target = join(dest, asset.to);
      mkdirSync(dirname(target), { recursive: true });
      const body = Buffer.from(await res.arrayBuffer());
      writeFileSync(target, body);

      // Rewrite the absolute URL to the local path everywhere in the folder.
      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(p);
            continue;
          }
          if (!/\.(html|css|js)$/i.test(entry.name)) continue;
          const text = readFileSync(p, 'utf8');
          if (!text.includes(asset.url)) continue;
          writeFileSync(p, text.split(asset.url).join(asset.to));
        }
      };
      walk(dest);
      console.log(`  localised ${asset.url.split('/').pop()} -> ${asset.to}`);
    } catch (err) {
      console.warn(`  could not localise ${asset.url}: ${err.message}`);
    }
  }
}

function notice(game, licenseText) {
  return `# ${game.title} - vendored third-party game

- **Original:** ${game.title}
- **Author:** ${game.author}
- **Source:** ${game.url}
- **License:** ${game.license}
- **Vendored by:** spielkunst (Ayhem Kahri)

The original ${game.license} license text is in the LICENSE file in this folder
and applies to this folder's contents.

${game.notes.map((n) => `- ${n}`).join('\n')}

---

${licenseText}
`;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  const canFfmpeg = hasFfmpeg();
  const report = [];

  for (const game of GAMES) {
    console.log(`\n=== ${game.id} (${game.repo})`);
    const tgz = join(tmp, `${game.id}.tgz`);
    run('curl', [
      '-sL',
      '-m',
      '300',
      `https://codeload.github.com/${game.repo}/tar.gz/refs/heads/${game.branch}`,
      '-o',
      tgz,
    ]);

    const extracted = join(tmp, game.id);
    mkdirSync(extracted, { recursive: true });
    run('tar', ['xzf', tgz, '-C', extracted, '--strip-components=1']);

    const dest = join(outDir, game.id);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });

    for (const entry of (game.keep ?? ['.'])) {
      const src = join(extracted, entry);
      if (!existsSync(src)) continue;
      cpSync(src, join(dest, entry), { recursive: true });
    }

    for (const drop of game.drop ?? []) {
      rmSync(join(dest, drop), { recursive: true, force: true });
    }

    // License: keep whatever the original repo shipped.
    const licenseName = ['LICENSE', 'LICENSE.txt', 'LICENSE.md'].find((n) =>
      existsSync(join(dest, n)),
    );
    let licenseText = '';
    if (licenseName) {
      licenseText = readFileSync(join(dest, licenseName), 'utf8');
    } else {
      licenseText = `See ${game.url} for the full license text.`;
    }

    writeFileSync(join(dest, 'SPIELKUNST-NOTICE.md'), notice(game, licenseText));

    // pacman: bring the author's site chrome local so the game is self-contained.
    if (game.id === 'pacman') {
      await localiseExternal(dest, [
        { url: 'https://passer-by.com/static/style/common.css', to: 'static/style/common.css' },
        { url: 'https://passer-by.com/static/script/common.js', to: 'static/ext/common.js' },
        { url: 'https://passer-by.com/static/script/projects.js', to: 'static/ext/projects.js' },
        { url: 'https://passer-by.com/static/script/stat.js', to: 'static/ext/stat.js' },
        { url: 'https://passer-by.com/static/image/public/icon-gotop.png', to: 'static/ext/icon-gotop.png' },
        { url: 'https://passer-by.com/static/image/public/logo.png', to: 'static/ext/logo.png' },
        { url: 'https://passer-by.com/static/image/public/bg.svg', to: 'static/image/public/bg.svg' },
        { url: 'https://buttons.github.io/buttons.js', to: 'static/ext/buttons.js' },
      ]);
    }

    // trust: shrink the background music so the page is not 8 MB.
    if (game.id === 'trust' && canFfmpeg) {
      const mp3 = join(dest, 'assets/sounds/bg_music.mp3');
      if (existsSync(mp3)) {
        const before = statSync(mp3).size;
        try {
          run('ffmpeg', [
            '-y', '-loglevel', 'error', '-i', mp3,
            '-b:a', '48k', '-ac', '1', '-map_metadata', '-1',
            join(tmp, 'bg_music.mp3'),
          ]);
          const out = join(tmp, 'bg_music.mp3');
          if (statSync(out).size < before) {
            cpSync(out, mp3);
            console.log(
              `  bg_music.mp3 ${mb(before)} -> ${mb(statSync(mp3).size)}`,
            );
          }
        } catch {
          console.warn('  ffmpeg re-encode failed, keeping original');
        }
      }
    }

    const size = dirSize(dest);
    report.push({ id: game.id, license: game.license, size: mb(size) });
    console.log(`  vendored -> third-party/${game.id} (${mb(size)})`);
  }

  rmSync(tmp, { recursive: true, force: true });

  console.log('\n--- summary');
  for (const r of report) console.log(`  ${r.id.padEnd(8)} ${r.license.padEnd(9)} ${r.size}`);
  console.log('\nThird-party games are copied into dist/ at build time.');
}

main();