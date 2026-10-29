import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine, Vec2 } from '../engine/types';
import { GRID_LINE, MUTED, PANEL, PANEL_2, TEXT, drawFitCenter, fillRound, setFont } from '../engine/render';
import { generateSudoku } from '../shared/sudoku.js';

const CLUES: Record<string, number> = { easy: 46, normal: 36, hard: 30 };

class Sudoku implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private grid: number[];
  private solution: number[];
  private fixed: boolean[];
  private selected = 40;
  private mistakes = 0;
  private seconds = 0;
  private over = false;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    const { puzzle, solution } = generateSudoku(ctx.seed, CLUES[ctx.difficulty] ?? 36);
    this.grid = puzzle.slice();
    this.solution = solution;
    this.fixed = puzzle.map((v: number) => v !== 0);
  }

  private geo() {
    const side = Math.min(this.ctx.width - 28, this.ctx.height - 96);
    const cell = Math.floor(side / 9);
    return { cell, x: (this.ctx.width - cell * 9) / 2, y: (this.ctx.height - cell * 9) / 2 + 14 };
  }

  update(dt: number): void {
    if (!this.over) this.seconds += dt;
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    const g = this.geo();
    const c = Math.floor((p.x - g.x) / g.cell);
    const r = Math.floor((p.y - g.y) / g.cell);
    if (r < 0 || r > 8 || c < 0 || c > 8) return;
    this.selected = r * 9 + c;
    this.ctx.audio.play('tap', { gain: 0.25 });
  }

  key(e: KeyboardEvent): void {
    if (this.over) return;
    const r = Math.floor(this.selected / 9);
    const c = this.selected % 9;
    if (e.key === 'ArrowUp') this.selected = ((r + 8) % 9) * 9 + c;
    else if (e.key === 'ArrowDown') this.selected = ((r + 1) % 9) * 9 + c;
    else if (e.key === 'ArrowLeft') this.selected = r * 9 + ((c + 8) % 9);
    else if (e.key === 'ArrowRight') this.selected = r * 9 + ((c + 1) % 9);
    else if (/^[1-9]$/.test(e.key)) this.enter(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') this.enter(0);
    else return;
    e.preventDefault();
  }

  private enter(value: number): void {
    if (this.over || this.fixed[this.selected]) return;
    if (value === 0) {
      this.grid[this.selected] = 0;
      return;
    }
    this.grid[this.selected] = value;
    if (value !== this.solution[this.selected]) {
      this.mistakes += 1;
      this.ctx.audio.play('wrong', { gain: 0.12 });
      if (this.mistakes >= 3) this.finish(false);
      return;
    }
    this.ctx.audio.play('found', { gain: 0.5 });
    if (this.grid.every((v, i) => v === this.solution[i])) this.finish(true);
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    const previous = this.ctx.storage.number('best', 0);
    const score = won ? Math.max(200, 4200 - Math.floor(this.seconds) * 8 - this.mistakes * 400) : 0;
    const best = Math.max(score, previous);
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play(won ? 'win' : 'gameover');
    this.ctx.analytics.track('game_over', { game: 'sudoku', score, won, mistakes: this.mistakes });
    this.result = {
      score,
      best,
      record: score > previous,
      won,
      detail: won ? `${Math.floor(this.seconds)}s · ${this.mistakes} mistakes` : 'three mistakes - try again',
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Filled', value: `${this.grid.filter((v) => v !== 0).length}/81` },
      { label: 'Mistakes', value: `${this.mistakes}/3` },
      { label: 'Time', value: `${Math.floor(this.seconds)}s` },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      const x = g.x + c * g.cell;
      const y = g.y + r * g.cell;
      fillRound(ctx, x + 1, y + 1, g.cell - 2, g.cell - 2, 4, i === this.selected ? PANEL_2 : PANEL, GRID_LINE);
      const v = this.grid[i];
      if (!v) continue;
      const wrong = !this.fixed[i] && v !== this.solution[i];
      ctx.fillStyle = wrong ? '#ff6b6b' : this.fixed[i] ? TEXT : this.ctx.accent;
      drawFitCenter(ctx, String(v), x + g.cell / 2, y + g.cell / 2, g.cell - 8, g.cell * 0.62, this.fixed[i] ? 700 : 800);
    }
    ctx.strokeStyle = '#3a414a';
    ctx.lineWidth = 2;
    for (let k = 1; k < 3; k++) {
      const dx = g.x + k * 3 * g.cell;
      const dy = g.y + k * 3 * g.cell;
      ctx.beginPath();
      ctx.moveTo(dx, g.y);
      ctx.lineTo(dx, g.y + g.cell * 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.x, dy);
      ctx.lineTo(g.x + g.cell * 9, dy);
      ctx.stroke();
    }
    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP A CELL · TYPE 1-9 · BACKSPACE TO CLEAR', this.ctx.width / 2, g.y - 16);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Sudoku', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 110px Outfit, system-ui, sans-serif';
    ctx.fillText(this.result?.won ? 'Solved' : 'Three strikes', w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText(`${Math.floor(this.seconds)} seconds · arcadefork.com`, w / 2, 420);
  }
}

export const sudoku: GameSpec = {
  id: 'sudoku',
  title: 'Daily Sudoku',
  category: 'puzzle',
  daily: true,
  create(ctx) {
    return new Sudoku(ctx);
  },
};
