import { describe, it, expect, beforeEach } from 'vitest';
import { Board } from '../game/board';
import { Gem } from '../game/types';

describe('Board Puzzle Logic', () => {
  let board: Board;

  // Helper to create a quick gem
  function createGem(id: string, color: 'red' | 'blue' | 'green' | 'yellow' | 'purple', x: number, y: number): Gem {
    return {
      id,
      color,
      x,
      y,
      animY: y,
      isNew: false,
    };
  }

  beforeEach(() => {
    board = new Board();
  });

  it('should initialize with an empty grid', () => {
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 6; c++) {
        expect(board.getCell(r, c)).toBeNull();
      }
    }
  });

  it('should place and retrieve gems correctly', () => {
    const gem = createGem('g1', 'red', 2, 10);
    const success = board.placeGem(gem);
    expect(success).toBe(true);
    expect(board.getCell(10, 2)).toBe(gem);
  });

  it('should detect 4 or more connected gems of the same color', () => {
    // Place 3 connected red gems
    board.placeGem(createGem('g1', 'red', 2, 11));
    board.placeGem(createGem('g2', 'red', 3, 11));
    board.placeGem(createGem('g3', 'red', 4, 11));

    let matches = board.findMatches();
    expect(matches.length).toBe(0); // 3 gems shouldn't match

    // Add 4th red gem to make it 4-connected
    board.placeGem(createGem('g4', 'red', 3, 10));
    matches = board.findMatches();
    expect(matches.length).toBe(4); // 4 connected gems found!
  });

  it('should not detect diagonal connections', () => {
    // Place gems diagonally
    board.placeGem(createGem('g1', 'red', 2, 11));
    board.placeGem(createGem('g2', 'red', 3, 10));
    board.placeGem(createGem('g3', 'red', 4, 9));
    board.placeGem(createGem('g4', 'red', 5, 8));

    const matches = board.findMatches();
    expect(matches.length).toBe(0); // Diagonal doesn't count
  });

  it('should clear matched gems and trigger gravity', () => {
    // Setup board with 4 red gems and a blue gem on top of one of them
    board.placeGem(createGem('g1', 'red', 2, 11));
    board.placeGem(createGem('g2', 'red', 3, 11));
    board.placeGem(createGem('g3', 'red', 4, 11));
    board.placeGem(createGem('g4', 'red', 3, 10));

    const blueGem = createGem('b1', 'blue', 3, 9);
    board.placeGem(blueGem);

    const matches = board.findMatches();
    expect(matches.length).toBe(4);

    const clearedCount = board.clearGems(matches);
    expect(clearedCount).toBe(4);
    expect(board.getCell(11, 3)).toBeNull(); // Cleared red gem

    // Apply gravity
    const moves = board.applyGravity();
    expect(moves.length).toBe(1); // Only blue gem should fall
    expect(moves[0].gem).toBe(blueGem);
    expect(moves[0].fromY).toBe(9);
    expect(moves[0].toY).toBe(11); // Fell into the bottom-most cleared spot
    expect(board.getCell(11, 3)).toBe(blueGem);
  });

  it('should trigger chains correctly', () => {
    // Build a 2-chain preset
    // Row 11: RED, RED, BLUE, RED
    // Row 10: BLUE, BLUE, RED, BLUE (which sits on top of RED)
    // When REDs clear, BLUEs drop and clear.
    board.placeGem(createGem('r1', 'red', 1, 11));
    board.placeGem(createGem('r2', 'red', 2, 11));
    board.placeGem(createGem('r3', 'red', 3, 11));
    board.placeGem(createGem('r4', 'red', 2, 10)); // RED group of 4: (11,1), (11,2), (11,3), (10,2)

    board.placeGem(createGem('b1', 'blue', 2, 9)); // Stacking on red
    board.placeGem(createGem('b2', 'blue', 1, 10)); // Adjacent blue
    board.placeGem(createGem('b3', 'blue', 3, 10)); // Adjacent blue
    board.placeGem(createGem('b4', 'blue', 2, 8)); // Stacking more blue (10,2 blue, 9,2 blue, etc)
    // The group of blue: (10,1), (9,2), (10,3), (8,2). Once red is cleared, blue will fall and connect.

    // 1st Match: RED group
    let matches = board.findMatches();
    expect(matches.length).toBe(4);
    expect(matches.every(m => board.getCell(m.r, m.c)?.color === 'red')).toBe(true);

    board.clearGems(matches);
    board.applyGravity();

    // 2nd Match (Chain 2): BLUE group
    matches = board.findMatches();
    expect(matches.length).toBe(4);
    expect(matches.every(m => board.getCell(m.r, m.c)?.color === 'blue')).toBe(true);
  });

  it('should support multi-level gravity drops correctly', () => {
    // Column 2 setup:
    // row 11: empty
    // row 10: green (gem 1)
    // row 9: empty
    // row 8: green (gem 2)
    const gem1 = createGem('g1', 'green', 2, 10);
    const gem2 = createGem('g2', 'green', 2, 8);
    board.placeGem(gem1);
    board.placeGem(gem2);

    const moves = board.applyGravity();
    // Both gems should fall:
    // gem1 (from 10 to 11)
    // gem2 (from 8 to 10)
    expect(moves.length).toBe(2);
    
    expect(board.getCell(11, 2)).toBe(gem1);
    expect(board.getCell(10, 2)).toBe(gem2);
  });

  it('should identify gameover conditions when top middle columns are filled', () => {
    expect(board.isGameOver()).toBe(false);

    board.placeGem(createGem('g1', 'red', 2, 0));
    expect(board.isGameOver()).toBe(true);
  });
});
