import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine, Vec2 } from '../engine/types';
import { GRID_LINE, MUTED, TEXT, drawFitCenter, fillRound, setFont } from '../engine/render';
import { GAP, padDuration, sequence, startLength } from '../shared/simon.js';

const MAX_STEPS = 64;

/** Four fixed, clearly separated pad colours - the memory game fails if two pads look alike. */
const PADS = [
  { lit: '#ff6b6b', dim: '#3d2226', ink: '#ffd9d9' },
  { lit: '#3dffa9', dim: '#1c3a2c', ink: '#c9ffe7' },
  { lit: '#4fa3ff', dim: '#1d3150', ink: '#d3e7ff' },
  { lit: '#ffc93e', dim: '#453715', ink: '#ffe9b3' },
];

type Phase = 'show' | 'input' | 'over';

class Simon implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private seq: number[];
  private startLen: number;
  private length: number;
  private padMs: number;
  private phase: Phase = 'show';
  private showClock = 0;
  private inputIndex = 0;
  private flashPad = -1;
  private flashClock = 0;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.seq = sequence(ctx.seed, MAX_STEPS);
    this.startLen = startLength(ctx.difficulty);
    this.length = this.startLen;
    this.padMs = padDuration(ctx.difficulty);
    this.ctx.audio.play('start', { gain: 0.4 });
  }

  private geo() {
    const gap = 14;
    const side = Math.min(this.ctx.width - 40, this.ctx.height - 140);
    const cell = (side - gap) / 2;
    return {
      cell,
      gap,
      x: (this.ctx.width - (cell * 2 + gap)) / 2,
      y: (this.ctx.height - (cell * 2 + gap)) / 2 + 14,
    };
  }

  private padAt(p: Vec2): number {
    const g = this.geo();
    const c = Math.floor((p.x - g.x) / (g.cell + g.gap));
    const r = Math.floor((p.y - g.y) / (g.cell + g.gap));
    if (r < 0 || r > 1 || c < 0 || c > 1) return -1;
    const x = g.x + c * (g.cell + g.gap);
    const y = g.y + r * (g.cell + g.gap);
    if (p.x > x + g.cell || p.y > y + g.cell) return -1;
    return r * 2 + c;
  }

  update(dt: number): void {
    if (this.flashClock > 0) {
      this.flashClock -= dt;
      if (this.flashClock <= 0) this.flashPad = -1;
    }
    if (this.phase !== 'show') return;
    this.showClock += dt;
    const cycle = this.padMs + GAP;
    if (Math.floor(this.showClock / cycle) >= this.length) {
      this.phase = 'input';
      this.inputIndex = 0;
      this.showClock = 0;
    }
  }

  pointerDown(p: Vec2): void {
    if (this.phase !== 'input') return;
    const pad = this.padAt(p);
    if (pad < 0) return;
    this.flashPad = pad;
    this.flashClock = 0.14;
    if (pad !== this.seq[this.inputIndex]) {
      this.ctx.audio.play('wrong', { gain: 0.4 });
      this.finish(false);
      return;
    }
    this.ctx.audio.play('select', { gain: 0.4 });
    this.inputIndex += 1;
    if (this.inputIndex < this.length) return;
    // Full repeat: one more step, then show it from the top.
    this.length += 1;
    if (this.length > MAX_STEPS) {
      this.finish(true);
      return;
    }
    this.phase = 'show';
    this.showClock = 0;
    this.inputIndex = 0;
    this.ctx.audio.play('found', { gain: 0.3 });
  }

  private score(): number {
    return Math.max(0, this.length - this.startLen) * 100;
  }

  private finish(won: boolean): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const previous = this.ctx.storage.number('best', 0);
    const score = this.score();
    const best = Math.max(score, previous);
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play(won ? 'win' : 'gameover');
    this.ctx.analytics.track('game_over', { game: 'simon', score, won, steps: this.length - 1 });
    this.result = {
      score,
      best,
      record: score > previous,
      won,
      detail: `${this.length - 1} steps in the sequence`,
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Round', value: String(this.length - this.startLen + 1) },
      { label: 'Steps', value: String(this.length) },
      { label: 'Score', value: String(this.score()) },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    const cycle = this.padMs + GAP;
    const showing = this.phase === 'show';
    const step = showing ? Math.floor(this.showClock / cycle) : -1;
    const litNow = showing && step < this.length && this.showClock - step * cycle < this.padMs ? this.seq[step] : -1;

    for (let pad = 0; pad < 4; pad++) {
      const r = Math.floor(pad / 2);
      const c = pad % 2;
      const x = g.x + c * (g.cell + g.gap);
      const y = g.y + r * (g.cell + g.gap);
      const lit = pad === litNow || pad === this.flashPad;
      const colours = PADS[pad];
      fillRound(ctx, x, y, g.cell, g.cell, 18, lit ? colours.lit : colours.dim, GRID_LINE);
      ctx.fillStyle = lit ? '#08090a' : colours.ink;
      drawFitCenter(ctx, String(pad + 1), x + g.cell / 2, y + g.cell / 2, g.cell - 20, g.cell * 0.3, 800);
    }

    const label =
      this.phase === 'show'
        ? 'WATCH THE PADS'
        : this.phase === 'input'
          ? `REPEAT ${this.length} STEPS · ${this.inputIndex}/${this.length}`
          : 'PRESS R FOR ANOTHER RUN';
    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.ctx.width / 2, g.y - 22);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Simon Says', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 110px Outfit, system-ui, sans-serif';
    ctx.fillText(`${Math.max(0, this.length - 1)} steps`, w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText('spielkunst.com', w / 2, 420);
  }
}

export const simon: GameSpec = {
  id: 'simon',
  title: 'Simon Says',
  category: 'brain',
  daily: false,
  create(ctx) {
    return new Simon(ctx);
  },
};
