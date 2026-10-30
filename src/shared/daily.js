/**
 * Deterministic daily content. Plain ESM JS (not TS) so the browser bundle and the
 * Node site builder can both import it without a compile step.
 *
 * Rule: everything here is a pure function of (date, theme). No server, no API,
 * no storage. Same date -> same board for every player, forever.
 */

/** FNV-1a 32-bit hash. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast, well-distributed PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** YYYY-MM-DD in UTC. */
export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Seed for a given date string. */
export function dateSeed(date) {
  return hashString(`spielkunst:${date}`);
}

/** Add days to a YYYY-MM-DD string. */
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIRS = [
  [0, 1], [1, 0], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1],
];

/**
 * Build a deterministic word-search board for a date + theme.
 * @param {string} date YYYY-MM-DD
 * @param {{id:string,title:string,accent:string,words:string[]}} theme
 * @param {number} size grid dimension (square)
 * @param {number} wordCount how many words to hide
 */
export function generateWordBoard(date, theme, size = 10, wordCount = 11) {
  const rng = mulberry32(dateSeed(`${date}:${theme.id}:${size}`));
  const grid = Array.from({ length: size }, () => new Array(size).fill(''));

  const pool = shuffle(
    [...new Set(theme.words.map((w) => w.toUpperCase()))].filter((w) => w.length >= 3 && w.length <= size),
    rng,
  );
  // Longest first: hardest to place, and it reads better (big words to spot).
  const chosen = pool.slice(0, wordCount).sort((a, b) => b.length - a.length);

  const placed = [];
  for (const word of chosen) {
    let done = false;
    for (let attempt = 0; attempt < 220 && !done; attempt++) {
      const dir = DIRS[Math.floor(rng() * DIRS.length)];
      const r0 = Math.floor(rng() * size);
      const c0 = Math.floor(rng() * size);
      const cells = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dir[0] * i;
        const c = c0 + dir[1] * i;
        if (r < 0 || r >= size || c < 0 || c >= size || grid[r][c] !== '') {
          ok = false;
          break;
        }
        cells.push([r, c]);
      }
      if (ok) {
        for (let i = 0; i < word.length; i++) grid[cells[i][0]][cells[i][1]] = word[i];
        placed.push({
          word,
          r0,
          c0,
          r1: r0 + dir[0] * (word.length - 1),
          c1: c0 + dir[1] * (word.length - 1),
        });
        done = true;
      }
    }
  }

  // Junk letters, weighted so decoys look like English.
  const junk = 'EEEETTAAOIINNSSHHRRDDLLCCMMWWFFGGYYPPBBVKXQJZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') grid[r][c] = junk[Math.floor(rng() * junk.length)];
    }
  }

  return { date, themeId: theme.id, themeTitle: theme.title, accent: theme.accent, size, grid, placed };
}

/** Human-readable answer rows for the SEO answer page. */
export function boardAnswers(board) {
  return board.placed
    .map((p) => ({
      word: p.word,
      start: `${p.r0 + 1},${p.c0 + 1}`,
      end: `${p.r1 + 1},${p.c1 + 1}`,
    }))
    .sort((a, b) => a.word.localeCompare(b.word));
}
