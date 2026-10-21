import type {
  EngineContext,
  GameInstance,
  GameResult,
  GameSpec,
  HudLine,
  Vec2,
} from '../engine/types';
import { GRID_LINE, MUTED, PANEL, PANEL_2, TEXT, drawFitCenter, fillRound, setFont } from '../engine/render';

interface Card {
  r: number;
  c: number;
  value: number;
  flipped: boolean;
  matched: boolean;
}

class Memory implements GameInstance {
  private ctx: EngineContext;
  private cols: number;
  private rows: number;
  private cards: Card[] = [];
  private first: Card | null = null;
  private second: Card | null = null;
  private lock = false;
  private moves = 0;
  private matched = 0;
  private seconds = 0;
  private over = false;
  private accent: string;

  result?: GameResult;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.accent = ctx.accent;
    if (ctx.difficulty === 'easy') {
      this.cols = 4;
      this.rows = 3;
    } else if (ctx.difficulty === 'hard') {
      this.cols = 6;
      this.rows = 4;
    } else {
      this.cols = 4;
      this.rows = 4;
    }
    this.reset();
  }

  private reset(): void {
    const total = this.cols * this.rows;
    const values: number[] = [];
    for (let i = 0; i < total / 2; i++) {
      values.push(i, i);
    }
    // Fisher-Yates with the seeded rng.
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.ctx.rng() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    this.cards = values.map((value, i) => ({
      r: Math.floor(i / this.cols),
      c: i % this.cols,
      value,
      flipped: false,
      matched: false,
    }));
    this.first = null;
    this.second = null;
    this.lock = false;
    this.moves = 0;
    this.matched = 0;
    this.seconds = 0;
    this.over = false;
  }

  update(dt: number): void {
    if (this.over) return;
    this.seconds += dt;
  }

  private geo() {
    const pad = 14;
    const side = Math.min(this.ctx.width - pad * 2, this.ctx.height - 110);
    const gap = 8;
    const cw = (side - gap * (this.cols - 1)) / this.cols;
    const ch = (side - gap * (this.rows - 1)) / this.rows;
    return {
      x: (this.ctx.width - side) / 2,
      y: (this.ctx.height - side) / 2 + 18,
      cw,
      ch,
      gap,
    };
  }

  pointerDown(p: Vec2): void {
    if (this.over || this.lock) return;
    const g = this.geo();
    for (const card of this.cards) {
      const x = g.x + card.c * (g.cw + g.gap);
      const y = g.y + card.r * (g.ch + g.gap);
      if (p.x >= x && p.x <= x + g.cw && p.y >= y && p.y <= y + g.ch) {
        this.tap(card);
        return;
      }
    }
  }

  private tap(card: Card): void {
    if (card.matched || card.flipped) return;
    card.flipped = true;
    this.ctx.audio.play('select');

    if (!this.first) {
      this.first = card;
      return;
    }
    this.second = card;
    this.moves++;
    this.lock = true;

    if (this.first.value === card.value) {
      this.first.matched = true;
      card.matched = true;
      this.first.flipped = false;
      card.flipped = false;
      this.matched++;
      this.first = null;
      this.second = null;
      this.lock = false;
      this.ctx.audio.play('found');
      if (this.matched === this.cards.length / 2) this.finish();
    } else {
      this.ctx.audio.play('wrong', { gain: 0.1 });
      setTimeout(() => {
        if (this.first) this.first.flipped = false;
        if (this.second) this.second.flipped = false;
        this.first = null;
        this.second = null;
        this.lock = false;
      }, 650);
    }
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    const score = Math.max(100, 1200 - this.moves * 25 - Math.floor(this.seconds) * 4);
    const best = Math.max(score, this.ctx.storage.number('best', 0));
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play('win');
    this.ctx.analytics.track('game_over', { game: 'memory', score, moves: this.moves });
    this.result = {
      score,
      best,
      won: true,
      detail: `${this.moves} moves · ${Math.floor(this.seconds)}s`,
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Pairs', value: `${this.matched}/${this.cards.length / 2}` },
      { label: 'Moves', value: String(this.moves) },
      { label: 'Time', value: `${Math.floor(this.seconds)}s` },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    for (const card of this.cards) {
      const x = g.x + card.c * (g.cw + g.gap);
      const y = g.y + card.r * (g.ch + g.gap);
      const show = card.flipped || card.matched;
      fillRound(ctx, x, y, g.cw, g.ch, 10, show ? PANEL_2 : PANEL, GRID_LINE);
      if (show) {
        ctx.fillStyle = card.matched ? this.accent : TEXT;
        drawFitCenter(ctx, String(card.value + 1), x + g.cw / 2, y + g.ch / 2, g.cw - 10, g.cw * 0.45, 800);
      } else {
        ctx.fillStyle = MUTED;
        drawFitCenter(ctx, '?', x + g.cw / 2, y + g.ch / 2, g.cw - 10, g.cw * 0.5, 800);
      }
    }

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TWO MATCHING CARDS DISAPPEAR', this.ctx.width / 2, g.y - 20);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.accent;
    ctx.font = `800 62px Outfit, system-ui, sans-serif`;
    ctx.fillText('Memory Match', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = `800 120px Outfit, system-ui, sans-serif`;
    ctx.fillText(`${this.moves} moves`, w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = `600 40px Outfit, system-ui, sans-serif`;
    ctx.fillText(`${Math.floor(this.seconds)} seconds · arcadefork.com`, w / 2, 420);
  }
}

export const memory: GameSpec = {
  id: 'memory',
  title: 'Memory Match',
  category: 'brain',
  create(ctx) {
    return new Memory(ctx);
  },
};
