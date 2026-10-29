/**
 * Shrink vendored game assets without changing what a game loads.
 *
 *   node scripts/optimise-media.mjs --dry-run   # report only
 *   node scripts/optimise-media.mjs             # rewrite in place
 *
 * Rules are deliberately conservative - a game is worth more than a megabyte:
 *   - JPEG over 300 KB: strip metadata, cap at 1600 px, quality 82.
 *   - PNG over 400 KB: lossless recompress only (no palette reduction, no
 *     resize) - sprite sheets depend on exact pixels and transparency.
 *   - MP3 over 800 KB: re-encode at 96 kbps mono/stereo as-is. Bitrate is the
 *     only thing touched; filenames and duration stay identical so no game
 *     reference changes.
 *   - OGG over 800 KB: re-encode at quality 4.
 *   - GIF over 1 MB: optimise frames only, never convert to another format,
 *     because the game references the `.gif` path.
 *   - WAV is left alone: converting it to MP3 means rewriting the game's
 *     references, which is how you break a working game.
 *
 * A replacement is only kept when it is actually smaller, so a file that
 * recompresses badly is left untouched.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, existsSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { extname, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const thirdParty = join(root, 'third-party');
const dryRun = process.argv.includes('--dry-run');
const scratch = mkdtempSync(join(tmpdir(), 'af-media-'));

const LIMITS = {
  '.jpg': 300 * 1024,
  '.jpeg': 300 * 1024,
  '.png': 400 * 1024,
  '.mp3': 800 * 1024,
  '.ogg': 800 * 1024,
  '.gif': 1024 * 1024,
};

const saved = {};
const touched = {};

const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // validation deletes dead games while this runs
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    const limit = LIMITS[ext];
    if (!limit) continue;
    let size;
    try {
      size = statSync(path).size;
    } catch {
      continue;
    }
    if (size <= limit) continue;
    const out = join(scratch, `${basename(path)}-out${ext}`);
    try {
      if (ext === '.jpg' || ext === '.jpeg') {
        execFileSync('magick', [path, '-strip', '-resize', '1600x1600>', '-quality', '82', out], { stdio: 'ignore' });
      } else if (ext === '.png') {
        execFileSync('magick', [path, '-strip', '-define', 'png:compression-level=9', '-define', 'png:compression-filter=5', out], { stdio: 'ignore' });
      } else if (ext === '.gif') {
        execFileSync('magick', [path, '-layers', 'Optimize', out], { stdio: 'ignore' });
      } else if (ext === '.mp3') {
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-b:a', '96k', out], { stdio: 'ignore' });
      } else if (ext === '.ogg') {
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-q:a', '4', out], { stdio: 'ignore' });
      }
    } catch {
      continue;
    }
    if (!existsSync(out)) continue;
    const next = statSync(out).size;
    if (next >= size * 0.95) {
      unlinkSync(out);
      continue;
    }
    saved[ext] = (saved[ext] ?? 0) + (size - next);
    touched[ext] = (touched[ext] ?? 0) + 1;
    if (!dryRun) {
      renameSync(path, `${path}.orig`);
      renameSync(out, path);
      unlinkSync(`${path}.orig`);
    } else {
      unlinkSync(out);
    }
  }
};

if (!existsSync(thirdParty)) {
  console.error('optimise-media: no third-party/ directory');
  process.exit(1);
}

walk(thirdParty);
rmSync(scratch, { recursive: true, force: true });

const total = Object.values(saved).reduce((a, b) => a + b, 0);
for (const [ext, bytes] of Object.entries(saved).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ext}: ${touched[ext]} files, ${(bytes / 1048576).toFixed(1)} MB saved`);
}
console.log(
  `optimise-media: ${dryRun ? 'would save' : 'saved'} ${(total / 1048576).toFixed(1)} MB across ` +
    `${Object.values(touched).reduce((a, b) => a + b, 0)} files`,
);
