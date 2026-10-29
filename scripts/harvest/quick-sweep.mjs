/**
 * Fast candidate collector: fixed pacing, no retry storms.
 *
 *   node scripts/harvest/quick-sweep.mjs --calls 600 --pages 2
 *
 * The main sweep in scripts/harvest-games.mjs retries an empty search result
 * four times with 15-90 s sleeps, which is right for a nightly job and wrong
 * when you are watching a run: one query with no hits looks like a hang. This
 * does the opposite - one call per query/licence/page, 2.1 s apart, a skipped
 * page on anything empty, and it prints progress every 25 calls.
 *
 * It writes the same candidate shape the rest of the pipeline reads, so
 * `scripts/harvest-games.mjs vendor` picks the results up unchanged.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = join(root, '.harvest');
const thirdParty = join(root, 'third-party');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
const maxCalls = flag('calls', 400);
const pages = flag('pages', 2);
const minStars = flag('stars', 0);

const LICENCES = ['mit', 'apache-2.0', 'gpl-3.0', 'bsd-3-clause', 'cc0-1.0', 'mpl-2.0'];

/** Queries that produced games before, plus genre terms the first sweep never tried. */
const QUERIES = [
  'topic:html5-game', 'topic:javascript-game', 'topic:canvas-game', 'topic:web-game',
  'topic:browser-game', 'topic:arcade-game', 'topic:puzzle-game', 'topic:casual-game',
  'topic:card-game', 'topic:board-game', 'topic:platformer', 'topic:roguelike',
  'topic:shmup', 'topic:gamejam', 'topic:js13k', 'topic:tetris', 'topic:snake-game',
  'topic:maze-game', 'topic:quiz-game', 'topic:trivia-game', 'topic:html5-canvas',
  'topic:webgame', 'topic:2d-game', 'topic:pixel-art-game', 'topic:retro-games',
  'topic:classic-games', 'topic:hypercasual', 'topic:js-game', 'topic:mini-game',
  'topic:wordle', 'topic:nonogram', 'topic:typing-game', 'topic:tower-defense',
  'topic:phaser', 'topic:pixi', 'topic:createjs', 'topic:game-jam', 'topic:match3',
  'topic:breakout', 'topic:pong', 'topic:invaders', 'topic:asteroids', 'topic:flappy',
  'topic:2048', 'topic:solitaire', 'topic:mahjong', 'topic:sudoku', 'topic:hangman',
  'topic:wordsearch', 'topic:memory-game', 'topic:racing-game', 'topic:shooter-game',
  'topic:idle-game', 'topic:clicker-game', 'topic:dungeon-crawler', 'topic:rpg-game',
  'game in:name html5', 'game in:name canvas', 'game in:name javascript', 'webgame in:name',
  'mini-game in:name', 'html5 game in:description', 'browser game in:description',
  'canvas game in:description', 'javascript game in:description', 'vanilla javascript game in:description',
];

const slugify = (repo) =>
  repo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const gh = (args) => {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
};

const candidatesFile = join(work, 'candidates.json');
const previous = existsSync(candidatesFile) ? JSON.parse(readFileSync(candidatesFile, 'utf8')) : [];
const seen = new Map(previous.map((c) => [c.repo, c]));
const already = new Set(existsSync(thirdParty) ? readdirSync(thirdParty) : []);
const skipped = new Set(existsSync(join(work, 'skipped.json')) ? JSON.parse(readFileSync(join(work, 'skipped.json'), 'utf8')) : []);
const startCount = seen.size;

let calls = 0;
outer: for (const query of QUERIES) {
  for (const licence of LICENCES) {
    for (let page = 1; page <= pages; page++) {
      if (calls >= maxCalls) break outer;
      calls += 1;
      const q = `${query} license:${licence} stars:>=${minStars}`;
      const raw = gh(['api', `search/repositories?q=${encodeURIComponent(q)}&per_page=100&page=${page}&sort=stars`]);
      execFileSync('sleep', ['2.1']);
      if (!raw) continue;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const r of payload.items ?? []) {
        if (!r.full_name || seen.has(r.full_name)) continue;
        const spdx = r.license?.spdx_id ?? null;
        if (!spdx) continue;
        if (!r.size || r.size > 6000) continue;
        if (already.has(slugify(r.full_name)) || skipped.has(r.full_name)) continue;
        const text = `${r.full_name} ${r.description ?? ''}`.toLowerCase();
        if (/(tutorial|boilerplate|template|framework|library|course|awesome|portfolio|resume)/.test(text)) continue;
        if (!/(game|puzzle|arcade|snake|tetris|breakout|invaders|platformer|flappy|maze|solitaire|sudoku|wordle|quiz|trivia|shooter|racing|pong|2048|match|memory|mahjong|hangman|typing|roguelike|tower|dungeon|pinball|brick|ball|jump|runner)/.test(text)) continue;
        seen.set(r.full_name, {
          repo: r.full_name,
          stars: r.stargazers_count ?? 0,
          licence: spdx,
          sizeKB: r.size,
          pushedAt: r.pushed_at ?? '',
          description: (r.description ?? '').trim(),
          defaultBranch: r.default_branch ?? 'main',
          owner: r.owner?.login ?? r.full_name.split('/')[0],
        });
      }
      if (calls % 25 === 0) {
        console.log(`quick-sweep: ${calls}/${maxCalls} calls, ${seen.size} candidates (+${seen.size - startCount}) - ${query} / ${licence} / p${page}`);
        writeFileSync(candidatesFile, `${JSON.stringify([...seen.values()].sort((a, b) => b.stars - a.stars), null, 2)}\n`);
      }
    }
  }
}

writeFileSync(candidatesFile, `${JSON.stringify([...seen.values()].sort((a, b) => b.stars - a.stars), null, 2)}\n`);
console.log(`quick-sweep: ${calls} calls -> ${seen.size} candidates (+${seen.size - startCount} new)`);
