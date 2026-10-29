/**
 * Batch driver: vendor -> validate -> import, repeatedly, until the catalogue
 * reaches the target or a round stops making progress.
 *
 *   node scripts/harvest/batch.mjs --target 500 --batch 250 --rounds 12
 *
 * Caps are 200 per family. Measured: 205 games passed the browser gate and a
 * cap of 80 published only 80 of them, because the supply really is arcade-heavy
 * (snake/tetris/breakout dominate open-source games). The quality control that
 * matters is perTitle in the importer - no game name may appear more than three
 * times - not a blunt family cap that throws away games that actually play.
 *
 * Why rounds and not one big pass:
 *   - vendor is network-bound and resumable, so a batch per round bounds the
 *     blast radius of a dead download or a GitHub hiccup;
 *   - validate deletes what it rejects, so the vendored tree shrinks to what
 *     actually plays before the next batch adds more;
 *   - import is pure and idempotent: it rewrites content/harvest-published.json
 *     from .harvest/validated.json every time, so a failed round never leaves
 *     the catalogue half-written.
 *
 * The site is NOT rebuilt here. The integrator builds and runs the gates, so a
 * batch run cannot publish a half-validated catalogue.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};

const target = flag('target', 500);
const batch = flag('batch', 250);
const rounds = flag('rounds', 12);
const caps = flag('caps', 200);
const concurrency = flag('concurrency', 8);
const workers = flag('workers', 6);

const run = (label, command, args, env = {}) => {
  console.log(`\n== ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) console.log(`${label}: exit ${result.status} (continuing)`);
  return result.status;
};

const published = () => {
  const file = join(root, 'content/harvest-published.json');
  if (!existsSync(file)) return 0;
  return JSON.parse(readFileSync(file, 'utf8')).games?.length ?? 0;
};

const candidates = () => {
  const file = join(root, '.harvest/candidates.json');
  if (!existsSync(file)) return 0;
  return JSON.parse(readFileSync(file, 'utf8')).length ?? 0;
};

let previous = published();
console.log(`batch: target ${target}, starting from ${previous} published of ${candidates()} candidates`);

for (let round = 1; round <= rounds; round++) {
  run(`round ${round}: vendor`, 'node', ['scripts/harvest-games.mjs', 'vendor'], {
    HARVEST_LIMIT: String(batch),
    HARVEST_CONCURRENCY: String(concurrency),
  });
  // validate exits 1 when it rejected something - that is a normal outcome.
  run(`round ${round}: validate`, 'node', ['scripts/harvest/validate.mjs', '--workers', String(workers)]);
  // Flags are space-separated: the CLIs parse `--flag value`, and `--caps=80`
  // silently fell back to the default 40, halving every round's output.
  run(`round ${round}: import`, 'node', ['scripts/harvest/import.mjs', '--caps', String(caps), '--budget', String(target)]);

  const now = published();
  console.log(`round ${round}: ${now} published (+${now - previous})`);

  if (now >= target) {
    console.log(`batch: target reached (${now})`);
    break;
  }
  if (now === previous) {
    console.log('batch: a full round added nothing - stopping rather than grinding');
    break;
  }
  previous = now;
}
