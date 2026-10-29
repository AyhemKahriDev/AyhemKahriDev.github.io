/**
 * Seeded minesweeper field. Pure, no DOM: unit-tested and shared with the site builder.
 * `counts[i]` is the number of neighbouring mines, or -1 for a mine.
 */
import { mulberry32 } from './daily.js';

export function neighbours(index, rows, cols) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

export function countsFor(isMine, rows, cols) {
  const counts = new Array(rows * cols).fill(0);
  for (let i = 0; i < rows * cols; i++) {
    counts[i] = isMine[i] ? -1 : neighbours(i, rows, cols).filter((n) => isMine[n]).length;
  }
  return counts;
}

export function generateMines(rows, cols, mines, seed) {
  const total = rows * cols;
  const rng = mulberry32(seed);
  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const isMine = new Array(total).fill(false);
  for (let k = 0; k < Math.min(mines, total - 9); k++) isMine[order[k]] = true;
  return { isMine, counts: countsFor(isMine, rows, cols), rows, cols };
}

/** Move the mine under the first click to the first free cell that is not a neighbour of it. */
export function applyFirstClick(field, index) {
  const { rows, cols } = field;
  if (!field.isMine[index]) return field;
  const isMine = field.isMine.slice();
  const blocked = new Set([index, ...neighbours(index, rows, cols)]);
  const target = [...Array(rows * cols).keys()].find((i) => !isMine[i] && !blocked.has(i));
  isMine[index] = false;
  if (target !== undefined) isMine[target] = true;
  return { isMine, counts: countsFor(isMine, rows, cols), rows, cols };
}

/** Every index a reveal at `start` opens: the empty region plus its numbered border. */
export function floodFrom(counts, start, rows, cols) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const i = queue.pop();
    if (seen.has(i) || counts[i] === -1) continue;
    seen.add(i);
    if (counts[i] === 0) for (const n of neighbours(i, rows, cols)) if (!seen.has(n)) queue.push(n);
  }
  return [...seen];
}
