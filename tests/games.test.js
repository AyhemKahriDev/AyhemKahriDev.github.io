import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, generateSudoku, solve } from '../src/shared/sudoku.js';
import { applyFirstClick, countsFor, floodFrom, generateMines, neighbours } from '../src/shared/minesweeper.js';
import { SIZE, movesFor, scramble, solveByToggling, toggle } from '../src/shared/lightsout.js';
import { GAP, padDuration, sequence, startLength } from '../src/shared/simon.js';
import { roundSeconds, wordQueue, wpm } from '../src/shared/typing.js';

const rows = (grid) => Array.from({ length: 9 }, (_, r) => grid.slice(r * 9, r * 9 + 9));
const cols = (grid) => Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => grid[r * 9 + c]));
const boxes = (grid) => {
  const out = [];
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const box = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) box.push(grid[(br * 3 + dr) * 9 + bc * 3 + dc]);
    out.push(box);
  }
  return out;
};
const isFull = (grid) => grid.every((v) => v >= 1 && v <= 9);
const valid = (grid) => [rows, cols, boxes].every((fn) => fn(grid).every((unit) => new Set(unit).size === 9));

test('candidates never repeat a row, column or box value', () => {
  const grid = new Array(81).fill(0);
  grid[0] = 5;
  assert.ok(!candidates(grid, 8).includes(5));  // same row
  assert.ok(!candidates(grid, 72).includes(5)); // same column
  assert.ok(!candidates(grid, 10).includes(5)); // same box
});

test('a generated sudoku has one solution, and the puzzle agrees with it', () => {
  const { puzzle, solution } = generateSudoku(12345, 36);
  assert.equal(puzzle.length, 81);
  assert.ok(isFull(solution) && valid(solution));
  assert.ok(puzzle.every((v, i) => v === 0 || v === solution[i]));
  assert.equal(solve(puzzle, 2).length, 1, 'puzzle must have exactly one solution');
});

test('the same seed always produces the same puzzle', () => {
  assert.deepEqual(generateSudoku(999, 36).puzzle, generateSudoku(999, 36).puzzle);
});

test('harder levels give fewer clues', () => {
  const easy = generateSudoku(7, 46).clues;
  const hard = generateSudoku(7, 30).clues;
  assert.ok(easy > hard, `easy ${easy} should exceed hard ${hard}`);
  assert.ok(hard >= 26);
});

test('a seeded minefield has exactly the requested mines and correct counts', () => {
  const { isMine, counts } = generateMines(9, 9, 10, 42);
  assert.equal(isMine.filter(Boolean).length, 10);
  for (let i = 0; i < 81; i++) {
    if (isMine[i]) { assert.equal(counts[i], -1); continue; }
    assert.equal(counts[i], neighbours(i, 9, 9).filter((n) => isMine[n]).length);
  }
});

test('the first click is never a mine', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const field = generateMines(9, 9, 10, seed);
    const safe = applyFirstClick(field, 40);
    assert.equal(safe.isMine[40], false, `seed ${seed} left a mine under the first click`);
    assert.equal(safe.isMine.filter(Boolean).length, 10);
  }
});

test('neighbours are bounded at the edges', () => {
  assert.equal(neighbours(0, 9, 9).length, 3);
  assert.equal(neighbours(40, 9, 9).length, 8);
  assert.equal(neighbours(80, 9, 9).length, 3);
});

test('floodFrom opens the empty region and its numbered border', () => {
  const empty = new Array(81).fill(false);
  const counts = countsFor(empty, 9, 9);
  assert.equal(floodFrom(counts, 0, 9, 9).length, 81);

  const oneMine = empty.slice();
  oneMine[40] = true;
  const ring = countsFor(oneMine, 9, 9);
  const opened = floodFrom(ring, 0, 9, 9);
  assert.ok(opened.length > 0 && opened.length < 81);
  assert.ok(!opened.includes(40), 'the mine itself is never opened');
  for (const i of opened) assert.ok(ring[i] === 0 || ring[i] > 0);
});

/* ------------------------------------------------------------- lights out */

test('scramble builds its board from its own move list, and repeats for a seed', () => {
  const seed = 4242;
  const moves = movesFor(seed);
  assert.equal(moves.length, 8 + (seed % 6));

  const expected = new Array(SIZE * SIZE).fill(false);
  for (const index of moves) {
    const next = toggle(expected, index);
    for (let i = 0; i < next.length; i++) expected[i] = next[i];
  }
  assert.deepEqual(scramble(seed), expected);
  assert.deepEqual(scramble(seed), scramble(seed));
  assert.notDeepEqual(scramble(seed), scramble(seed + 1));
});

test('toggle flips a cell and its orthogonal neighbours only, and cancels itself', () => {
  const off = new Array(SIZE * SIZE).fill(false);
  const once = toggle(off, 12);
  const lit = once.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(lit.sort((a, b) => a - b), [7, 11, 12, 13, 17]);

  const twice = toggle(once, 12);
  assert.deepEqual(twice, off);
});

test('every scrambled lights-out board can be toggled back to all off', () => {
  for (let seed = 0; seed < 25; seed++) {
    const { solved, board } = solveByToggling(scramble(seed));
    assert.equal(solved, true, `seed ${seed} was not solvable`);
    assert.ok(board.every((v) => !v), `seed ${seed} still had a light on`);
  }
});

/* ----------------------------------------------------------------- simon */

test('simon sequences are deterministic, bounded and the right length', () => {
  const seq = sequence(2026, 12);
  assert.equal(seq.length, 12);
  assert.deepEqual(seq, sequence(2026, 12));
  assert.notDeepEqual(seq, sequence(2027, 12));
  for (const pad of seq) assert.ok(Number.isInteger(pad) && pad >= 0 && pad <= 3, `bad pad ${pad}`);
});

test('simon starts longer and plays faster as the difficulty rises', () => {
  assert.equal(startLength('easy'), 3);
  assert.equal(startLength('hard'), 5);
  assert.ok(padDuration('easy') > padDuration('normal'));
  assert.ok(padDuration('normal') > padDuration('hard'));
  assert.ok(GAP > 0);
});

/* ---------------------------------------------------------------- typing */

test('the typing queue is 20 unique 4-8 letter words, stable per seed', () => {
  const words = wordQueue(77, 20);
  assert.equal(words.length, 20);
  assert.equal(new Set(words).size, 20);
  for (const word of words) {
    assert.ok(word.length >= 4 && word.length <= 8, `${word} is outside 4-8 letters`);
  }
  assert.deepEqual(words, wordQueue(77, 20));
  assert.notDeepEqual(words, wordQueue(78, 20));
});

test('typing round length and words-per-minute follow the difficulty', () => {
  assert.ok(roundSeconds('easy') > roundSeconds('normal'));
  assert.ok(roundSeconds('normal') > roundSeconds('hard'));
  assert.equal(wpm(250, 60), 50);
  assert.equal(wpm(0, 60), 0);
});
