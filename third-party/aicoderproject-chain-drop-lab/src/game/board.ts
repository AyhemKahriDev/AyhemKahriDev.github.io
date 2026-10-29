import { GridCell, Gem } from './types';

export const BOARD_ROWS = 12;
export const BOARD_COLS = 6;

export class Board {
  public grid: GridCell[][];

  constructor() {
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  }

  public getCell(r: number, c: number): GridCell {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return null;
    return this.grid[r][c];
  }

  public setCell(r: number, c: number, gem: GridCell): void {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return;
    this.grid[r][c] = gem;
    if (gem) {
      gem.x = c;
      gem.y = r;
    }
  }

  /**
   * Clears the board
   */
  public clear(): void {
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  }

  /**
   * Places a gem at grid coordinates (x, y). Returns true if successful.
   */
  public placeGem(gem: Gem): boolean {
    if (gem.y < 0 || gem.y >= BOARD_ROWS || gem.x < 0 || gem.x >= BOARD_COLS) {
      return false;
    }
    this.setCell(gem.y, gem.x, gem);
    return true;
  }

  /**
   * Scans the board for connected gems of the same color.
   * Returns a list of coordinates that should be cleared.
   */
  public findMatches(): { r: number; c: number }[] {
    const visited = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(false));
    const toClear: { r: number; c: number }[] = [];

    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const gem = this.getCell(r, c);
        if (gem && !visited[r][c]) {
          const color = gem.color;
          const group: { r: number; c: number }[] = [];
          const queue: { r: number; c: number }[] = [{ r, c }];
          visited[r][c] = true;

          while (queue.length > 0) {
            const curr = queue.shift()!;
            group.push(curr);

            for (const dir of dirs) {
              const nr = curr.r + dir.dr;
              const nc = curr.c + dir.dc;
              const nextGem = this.getCell(nr, nc);

              if (nextGem && !visited[nr][nc] && nextGem.color === color) {
                visited[nr][nc] = true;
                queue.push({ r: nr, c: nc });
              }
            }
          }

          if (group.length >= 4) {
            toClear.push(...group);
          }
        }
      }
    }

    return toClear;
  }

  /**
   * Clears specified gems and returns the number of gems cleared.
   */
  public clearGems(matches: { r: number; c: number }[]): number {
    matches.forEach(({ r, c }) => {
      this.grid[r][c] = null;
    });
    return matches.length;
  }

  /**
   * Applies gravity to the board. Gems fall down to fill empty spaces.
   * Returns an array of gems that actually moved, so they can be animated.
   */
  public applyGravity(): { gem: Gem; fromY: number; toY: number }[] {
    const moves: { gem: Gem; fromY: number; toY: number }[] = [];

    for (let c = 0; c < BOARD_COLS; c++) {
      // Traverse from bottom to top
      let writeRow = BOARD_ROWS - 1;
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        const gem = this.grid[r][c];
        if (gem) {
          if (r !== writeRow) {
            const oldY = gem.y;
            this.grid[writeRow][c] = gem;
            this.grid[r][c] = null;
            gem.y = writeRow;
            moves.push({ gem, fromY: oldY, toY: writeRow });
          }
          writeRow--;
        }
      }
    }

    return moves;
  }

  /**
   * Returns true if the top cell of the third column (default spawn location) is blocked.
   */
  public isGameOver(): boolean {
    // Standard spawn is at col 2 and 3 (0-indexed). If these are filled, game over.
    return this.getCell(0, 2) !== null || this.getCell(0, 3) !== null;
  }
}
