/**
 * Probe GitHub for HTML5 game repos that can be vendored as static files.
 * Read-only reconnaissance: no downloads, just counts and a sample.
 *
 *   node scripts/probe-candidates.mjs [sampleSize]
 */
import { execFileSync } from 'node:child_process';

const SAMPLE = Number(process.argv[2] ?? 150);

const QUERIES = [
  'topic:html5-game',
  'topic:html5',
  'topic:javascript-game',
  'topic:canvas-game',
  'topic:web-game',
  'topic:browser-game',
];

const ALLOWED = new Set([
  'MIT',
  'CC0-1.0',
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'ISC',
  'Unlicense',
  '0BSD',
  'MIT-0',
]);

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

const seen = new Map();

for (const q of QUERIES) {
  for (const lic of ['mit', 'cc0-1.0', 'apache-2.0', 'bsd-3-clause', 'isc']) {
    for (const page of [1, 2]) {
      const raw = gh([
        'api',
        `search/repositories?q=${encodeURIComponent(`${q} license:${lic} stars:>3`)}&per_page=100&page=${page}&sort=stars`,
      ]);
      if (!raw) break;
      let payload = {};
      try {
        payload = JSON.parse(raw);
      } catch {
        break;
      }
      const items = payload.items ?? [];
      if (items.length === 0) break;
      for (const r of items) {
        if (seen.has(r.full_name)) continue;
        seen.set(r.full_name, {
          fullName: r.full_name,
          stars: r.stargazers_count ?? 0,
          spdx: r.license?.spdx_id ?? null,
          sizeKB: r.size ?? 0,
          pushedAt: r.pushed_at ?? '',
          description: (r.description ?? '').slice(0, 90),
        });
      }
    }
  }
}

const all = [...seen.values()];
console.log(`unique candidates: ${all.length}`);
console.log('licence keys seen:', [...new Set(all.map((c) => c.spdx))].join(', '));

const usable = all.filter(
  (c) => c.spdx && ALLOWED.has(c.spdx) && c.sizeKB > 0 && c.sizeKB < 4000,
);
console.log(`allowed licence + under 4 MB: ${usable.length}`);
console.log(`pushed since 2021: ${usable.filter((c) => c.pushedAt > '2021-01-01').length}`);

usable.sort((a, b) => b.stars - a.stars);

console.log(`\nchecking root index.html for ${Math.min(SAMPLE, usable.length)} candidates...`);
let staticOk = 0;
let checked = 0;
const samples = [];
for (const c of usable.slice(0, SAMPLE)) {
  checked++;
  const raw = gh(['api', `repos/${c.fullName}/contents/`]);
  if (!raw) continue;
  let files = [];
  try {
    files = JSON.parse(raw);
  } catch {
    continue;
  }
  if (!Array.isArray(files)) continue;
  const names = files.map((f) => f.name);
  const hasIndex = names.includes('index.html');
  const hasLicense = names.some((n) => /^licen[cs]e/i.test(n));
  if (hasIndex && hasLicense) {
    staticOk++;
    if (samples.length < 15) {
      samples.push(`  ok  ${c.fullName} (${c.spdx}, ${c.sizeKB}KB, ${c.stars}*) - ${c.description}`);
    }
  }
}
console.log(samples.join('\n'));
console.log(`\nstatic + licensed root index.html: ${staticOk}/${checked} sampled`);
