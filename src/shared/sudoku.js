/**
 * Seeded sudoku. Pure, no DOM: unit-tested and shared with the site builder.
 * Measured: 3-7 ms to generate a unique puzzle on this machine.
 */
import { mulberry32 } from './daily.js';

export function candidates(grid, index) {
  const used = new Set();
  const r = Math.floor(index / 9);
  const c = index % 9;
  for (let k = 0; k < 9; k++) {
    used.add(grid[r * 9 + k]);
    used.add(grid[k * 9 + c]);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) used.add(grid[(br + dr) * 9 + bc + dc]);
  }
  const out = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}

/** Up to `limit` solutions of `grid`. The input array is never mutated. */
export function solve(grid, limit = 2, rng = Math.random) {
  const work = grid.slice();
  const found = [];
  const step = () => {
    if (found.length >= limit) return;
    let pick = -1;
    let pickCand = null;
    for (let i = 0; i < 81; i++) {
      if (work[i] !== 0) continue;
      const cand = candidates(work, i);
      if (cand.length === 0) return;
      if (!pickCand || cand.length < pickCand.length) {
        pick = i;
        pickCand = cand;
        if (cand.length === 1) break;
      }
    }
    if (pick === -1) { found.push(work.slice()); return; }
    for (let k = pickCand.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [pickCand[k], pickCand[j]] = [pickCand[j], pickCand[k]];
    }
    for (const v of pickCand) {
      work[pick] = v;
      step();
      work[pick] = 0;
      if (found.length >= limit) return;
    }
  };
  step();
  return found;
}

/** A puzzle with exactly one solution and as close to `clues` givens as it can get. */
export function generateSudoku(seed, clues = 36) {
  const rng = mulberry32(seed);
  const solution = solve(new Array(81).fill(0), 1, rng)[0];
  const puzzle = solution.slice();
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = 80; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let removed = 0;
  for (const i of order) {
    if (81 - removed <= clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (solve(puzzle, 2, rng).length === 1) removed++;
    else puzzle[i] = keep;
  }
  return { puzzle, solution, clues: 81 - removed };
}
