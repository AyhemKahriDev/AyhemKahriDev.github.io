import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine, Vec2 } from '../engine/types';
import { GRID_LINE, MUTED, PANEL, PANEL_2, TEXT, drawFitCenter, fillRound, setFont } from '../engine/render';
import { applyFirstClick, floodFrom, generateMines } from '../shared/minesweeper.js';

const LEVELS: Record<string, { rows: number; cols: number; mines: number }> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  normal: { rows: 12, cols: 12, mines: 22 },
  hard: { rows: 14, cols: 14, mines: 38 },
};

class Minesweeper implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private rows: number;
  private cols: number;
  private mines: number;
  private isMine: boolean[];
  private counts: number[];
  private open: boolean[];
  private flags: boolean[];
  private started = false;
  private flagMode = false;
  private seconds = 0;
  private over = false;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    const level = LEVELS[ctx.difficulty] ?? LEVELS.normal;
    this.rows = level.rows;
    this.cols = level.cols;
    this.mines = level.mines;
    const field = generateMines(level.rows, level.cols, level.mines, ctx.seed);
    this.isMine = field.isMine;
    this.counts = field.counts;
    this.open = new Array(level.rows * level.cols).fill(false);
    this.flags = new Array(level.rows * level.cols).fill(false);
  }

  private geo() {
    const side = Math.min(this.ctx.width - 24, this.ctx.height - 104);
    const cell = Math.floor(side / this.cols);
    return { cell, x: (this.ctx.width - cell * this.cols) / 2, y: (this.ctx.height - cell * this.rows) / 2 + 16 };
  }

  /** On-canvas flag toggle: the copy promises a mode button, and a phone has no F key. */
  private modeRect() {
    const g = this.geo();
    const w = 168;
    const h = 28;
    return { x: (this.ctx.width - w) / 2, y: Math.max(2, g.y - 60), w, h };
  }

  private indexAt(p: Vec2): number {
    const g = this.geo();
    const c = Math.floor((p.x - g.x) / g.cell);
    const r = Math.floor((p.y - g.y) / g.cell);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return -1;
    return r * this.cols + c;
  }

  update(dt: number): void {
    if (this.started && !this.over) this.seconds += dt;
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'f' || e.key === 'F') this.flagMode = !this.flagMode;
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    const m = this.modeRect();
    if (p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) {
      this.flagMode = !this.flagMode;
      this.ctx.audio.play('tap', { gain: 0.3 });
      return;
    }
    const i = this.indexAt(p);
    if (i < 0) return;
    if (!this.started) {
      const field = applyFirstClick({ isMine: this.isMine, counts: this.counts, rows: this.rows, cols: this.cols }, i);
      this.isMine = field.isMine;
      this.counts = field.counts;
      this.started = true;
    }
    if (this.open[i]) return;

    if (this.flagMode) {
      this.flags[i] = !this.flags[i];
      this.ctx.audio.play('tap', { gain: 0.3 });
      return;
    }
    if (this.flags[i]) return;

    if (this.isMine[i]) {
      this.revealAll();
      this.finish(false);
      return;
    }
    for (const cell of floodFrom(this.counts, i, this.rows, this.cols)) this.open[cell] = true;
    this.ctx.audio.play('select', { gain: 0.35 });
    const safeTotal = this.rows * this.cols - this.mines;
    if (this.open.filter(Boolean).length >= safeTotal) this.finish(true);
  }

  private revealAll(): void {
    for (let i = 0; i < this.isMine.length; i++) if (this.isMine[i]) this.open[i] = true;
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    const previous = this.ctx.storage.number('best', 0);
    const score = won ? Math.max(120, 5000 - Math.floor(this.seconds) * 10) : 0;
    const best = Math.max(score, previous);
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play(won ? 'win' : 'gameover');
    this.ctx.analytics.track('game_over', { game: 'minesweeper', score, won });
    this.result = {
      score,
      best,
      record: score > previous,
      won,
      detail: won ? `cleared in ${Math.floor(this.seconds)}s` : 'boom - press R for a new field',
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Mines', value: `${this.mines - this.flags.filter(Boolean).length}` },
      { label: 'Mode', value: this.flagMode ? 'FLAG' : 'OPEN' },
      { label: 'Time', value: `${Math.floor(this.seconds)}s` },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    const colours = ['', '#4fa3ff', '#4fd18b', '#ffcc4d', '#ff9f6b', '#ff6b6b', '#c98cff', '#e0e0e0', '#9b978d'];
    for (let i = 0; i < this.rows * this.cols; i++) {
      const r = Math.floor(i / this.cols);
      const c = i % this.cols;
      const x = g.x + c * g.cell;
      const y = g.y + r * g.cell;
      fillRound(ctx, x + 1, y + 1, g.cell - 2, g.cell - 2, 4, this.open[i] ? PANEL_2 : PANEL, GRID_LINE);
      if (!this.open[i]) {
        if (this.flags[i]) {
          ctx.fillStyle = this.ctx.accent;
          drawFitCenter(ctx, 'F', x + g.cell / 2, y + g.cell / 2, g.cell - 8, g.cell * 0.5, 800);
        }
        continue;
      }
      if (this.isMine[i]) {
        ctx.fillStyle = '#ff6b6b';
        drawFitCenter(ctx, '*', x + g.cell / 2, y + g.cell / 2, g.cell - 8, g.cell * 0.7, 800);
      } else if (this.counts[i] > 0) {
        ctx.fillStyle = colours[this.counts[i]] ?? TEXT;
        drawFitCenter(ctx, String(this.counts[i]), x + g.cell / 2, y + g.cell / 2, g.cell - 8, g.cell * 0.55, 800);
      }
    }
    const m = this.modeRect();
    fillRound(ctx, m.x, m.y, m.w, m.h, 8, this.flagMode ? this.ctx.accent : PANEL_2, GRID_LINE);
    ctx.fillStyle = this.flagMode ? '#08090a' : TEXT;
    drawFitCenter(ctx, `FLAG MODE: ${this.flagMode ? 'ON' : 'OFF'}`, m.x + m.w / 2, m.y + m.h / 2, m.w - 16, 13, 800);

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRST CLICK IS ALWAYS SAFE · F OR TAP TO FLAG', this.ctx.width / 2, g.y - 18);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Minesweeper', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 110px Outfit, system-ui, sans-serif';
    ctx.fillText(this.result?.won ? 'Field clear' : 'Boom', w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText(`${Math.floor(this.seconds)} seconds · spielkunst.com`, w / 2, 420);
  }
}

export const minesweeper: GameSpec = {
  id: 'minesweeper',
  title: 'Minesweeper',
  category: 'brain',
  daily: true,
  create(ctx) {
    return new Minesweeper(ctx);
  },
};
