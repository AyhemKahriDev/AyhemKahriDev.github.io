import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine, Vec2 } from '../engine/types';
import { GRID_LINE, MUTED, PANEL_2, TEXT, fillRound, setFont } from '../engine/render';
import { SIZE, scramble, toggle } from '../shared/lightsout.js';

class LightsOut implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private board: boolean[];
  private moves = 0;
  private over = false;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.board = scramble(ctx.seed);
  }

  private geo() {
    const gap = 10;
    const side = Math.min(this.ctx.width - 32, this.ctx.height - 110);
    const cell = (side - gap * (SIZE - 1)) / SIZE;
    return {
      cell,
      gap,
      x: (this.ctx.width - (cell * SIZE + gap * (SIZE - 1))) / 2,
      y: (this.ctx.height - (cell * SIZE + gap * (SIZE - 1))) / 2 + 12,
    };
  }

  update(): void {
    /* nothing moves on its own */
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    const g = this.geo();
    const c = Math.floor((p.x - g.x) / (g.cell + g.gap));
    const r = Math.floor((p.y - g.y) / (g.cell + g.gap));
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    const x = g.x + c * (g.cell + g.gap);
    const y = g.y + r * (g.cell + g.gap);
    if (p.x > x + g.cell || p.y > y + g.cell) return;
    this.board = toggle(this.board, r * SIZE + c);
    this.moves += 1;
    this.ctx.audio.play('tap', { gain: 0.35 });
    if (this.board.every((v) => !v)) this.finish();
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    const previous = this.ctx.storage.number('best', 0);
    const score = Math.max(100, 1200 - this.moves * 20);
    const best = Math.max(score, previous);
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play('win');
    this.ctx.analytics.track('game_over', { game: 'lightsout', score, moves: this.moves });
    this.result = {
      score,
      best,
      record: score > previous,
      won: true,
      detail: `all lights off in ${this.moves} moves`,
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Moves', value: String(this.moves) },
      { label: 'Lit', value: String(this.board.filter(Boolean).length) },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    for (let i = 0; i < SIZE * SIZE; i++) {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      const x = g.x + c * (g.cell + g.gap);
      const y = g.y + r * (g.cell + g.gap);
      const lit = this.board[i];
      fillRound(ctx, x, y, g.cell, g.cell, 12, lit ? this.ctx.accent : PANEL_2, GRID_LINE);
      ctx.fillStyle = lit ? 'rgba(255, 255, 255, 0.28)' : 'rgba(155, 151, 141, 0.18)';
      ctx.beginPath();
      ctx.arc(x + g.cell / 2, y + g.cell / 2, lit ? g.cell * 0.17 : g.cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP A LIGHT · IT FLIPS ITS NEIGHBOURS', this.ctx.width / 2, g.y - 22);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Lights Out', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 120px Outfit, system-ui, sans-serif';
    ctx.fillText(`${this.moves} moves`, w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText('every light off · arcadefork.com', w / 2, 420);
  }
}

export const lightsout: GameSpec = {
  id: 'lightsout',
  title: 'Lights Out',
  category: 'puzzle',
  daily: true,
  create(ctx) {
    return new LightsOut(ctx);
  },
};
