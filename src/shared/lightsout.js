/**
 * Lights Out on a 5x5 board. Pure, no DOM: unit-tested and shared with the site builder.
 * Boards are built by playing the game backwards, so every board is solvable.
 */
import { mulberry32 } from './daily.js';

export const SIZE = 5;

/** Index of every cell a press at `index` flips: itself plus its orthogonal neighbours. */
export function affected(index) {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const out = [index];
  if (r > 0) out.push(index - SIZE);
  if (r < SIZE - 1) out.push(index + SIZE);
  if (c > 0) out.push(index - 1);
  if (c < SIZE - 1) out.push(index + 1);
  return out;
}

/** A new board with the press at `index` applied. Never mutates the input. */
export function toggle(board, index) {
  const next = board.slice();
  for (const i of affected(index)) next[i] = !next[i];
  return next;
}

/** Deterministic list of presses used to scramble a board: 8 to 13 of them. */
export function movesFor(seed) {
  const rng = mulberry32(seed);
  const count = 8 + (((seed % 6) + 6) % 6);
  const moves = [];
  for (let k = 0; k < count; k++) moves.push(Math.floor(rng() * SIZE * SIZE));
  return moves;
}

/** All-off board with the seed's presses applied: solvable by construction. */
export function scramble(seed) {
  let board = new Array(SIZE * SIZE).fill(false);
  for (const index of movesFor(seed)) board = toggle(board, index);
  return board;
}

/**
 * Press list that turns `board` all off, or `{ solved: false }` if impossible.
 * Standard chase: try every top-row press pattern (32), then press the cell under
 * each light that is still on, row by row. Any solvable board has one such pattern.
 */
export function solveByToggling(board) {
  for (let mask = 0; mask < 1 << SIZE; mask++) {
    let work = board.slice();
    const presses = [];
    for (let c = 0; c < SIZE; c++) {
      if (!(mask & (1 << c))) continue;
      presses.push(c);
      work = toggle(work, c);
    }
    for (let r = 0; r < SIZE - 1; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!work[r * SIZE + c]) continue;
        const below = (r + 1) * SIZE + c;
        presses.push(below);
        work = toggle(work, below);
      }
    }
    if (work.every((v) => !v)) return { solved: true, presses, board: work };
  }
  return { solved: false, presses: [], board: board.slice() };
}
