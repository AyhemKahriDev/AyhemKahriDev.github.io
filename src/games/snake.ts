import type {
  EngineContext,
  GameInstance,
  GameResult,
  GameSpec,
  HudLine,
  Vec2,
} from '../engine/types';
import { GRID_LINE, MUTED, PANEL, PANEL_2, TEXT, fillRound, setFont } from '../engine/render';

const N = 18;

type Dir = 'up' | 'down' | 'left' | 'right';

const VEC: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

interface Cell {
  r: number;
  c: number;
}

class Snake implements GameInstance {
  private ctx: EngineContext;
  private body: Cell[] = [];
  private dir: Dir = 'right';
  private queue: Dir[] = [];
  private food: Cell = { r: 0, c: 0 };
  private score = 0;
  private best = 0;
  private over = false;
  private acc = 0;
  private interval = 0.15;
  private accent: string;
  private swipeStart: Vec2 | null = null;
  private dead: Cell | null = null;

  result?: GameResult;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.accent = ctx.accent;
    this.best = ctx.storage.number('best', 0);
    this.reset();
  }

  private reset(): void {
    this.body = [];
    const startC = Math.floor(N / 2);
    for (let i = 0; i < 4; i++) this.body.push({ r: startC, c: startC - i });
    this.dir = 'right';
    this.queue = [];
    this.score = 0;
    this.over = false;
    this.acc = 0;
    this.interval = this.ctx.difficulty === 'easy' ? 0.18 : this.ctx.difficulty === 'hard' ? 0.11 : 0.15;
    this.dead = null;
    this.placeFood();
  }

  private placeFood(): void {
    const free: Cell[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!this.body.some((b) => b.r === r && b.c === c)) free.push({ r, c });
      }
    }
    if (free.length === 0) {
      this.finish();
      return;
    }
    this.food = free[Math.floor(this.ctx.rng() * free.length)];
  }

  update(dt: number): void {
    if (this.over) return;
    this.acc += dt;
    while (this.acc >= this.interval && !this.over) {
      this.acc -= this.interval;
      this.step();
    }
  }

  private step(): void {
    if (this.queue.length) {
      const next = this.queue.shift() as Dir;
      const cur = VEC[this.dir];
      const nxt = VEC[next];
      if (cur[0] + nxt[0] !== 0 || cur[1] + nxt[1] !== 0) this.dir = next;
    }
    const [dr, dc] = VEC[this.dir];
    const head = this.body[0];
    let r = head.r + dr;
    let c = head.c + dc;
    // Wrap around the edges: keeps runs long, which is what the ad slots want.
    r = (r + N) % N;
    c = (c + N) % N;
    this.dead = { r, c };

    if (this.body.some((b) => b.r === r && b.c === c)) {
      this.finish();
      return;
    }

    const ate = r === this.food.r && c === this.food.c;
    this.body.unshift({ r, c });
    if (ate) {
      this.score += 10;
      this.interval = Math.max(0.07, this.interval - 0.0035);
      this.ctx.audio.play('found');
      this.placeFood();
    } else {
      this.body.pop();
    }
    this.dead = null;
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    const previous = this.ctx.storage.number('best', 0);
    this.best = Math.max(this.score, previous);
    this.ctx.storage.set('best', this.best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play('gameover');
    this.ctx.analytics.track('game_over', { game: 'snake', score: this.score });
    this.result = {
      score: this.score,
      best: this.best,
      record: this.score > previous,
      detail: `length ${this.body.length}`,
    };
  }

  private queueDir(d: Dir): void {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    const cur = VEC[last];
    const nxt = VEC[d];
    if (cur[0] + nxt[0] === 0 && cur[1] + nxt[1] === 0) return;
    if (this.queue.length < 2) this.queue.push(d);
  }

  pointerDown(p: Vec2): void {
    this.swipeStart = p;
  }

  pointerUp(p: Vec2): void {
    if (!this.swipeStart) return;
    const dx = p.x - this.swipeStart.x;
    const dy = p.y - this.swipeStart.y;
    this.swipeStart = null;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) this.queueDir(dx > 0 ? 'right' : 'left');
    else this.queueDir(dy > 0 ? 'down' : 'up');
  }

  key(e: KeyboardEvent): void {
    const map: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right',
    };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      this.queueDir(d);
    }
  }

  hud(): HudLine[] {
    return [
      { label: 'Score', value: String(this.score) },
      { label: 'Best', value: String(this.best) },
      { label: 'Length', value: String(this.body.length) },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const pad = 14;
    const side = Math.min(this.ctx.width - pad * 2, this.ctx.height - 110);
    const cell = side / N;
    const x0 = (this.ctx.width - side) / 2;
    const y0 = (this.ctx.height - side) / 2 + 26;

    fillRound(ctx, x0, y0, side, side, 14, PANEL, GRID_LINE);

    // Faint grid so the play area reads as a board.
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let i = 1; i < N; i++) {
      const p = Math.round(x0 + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, y0 + 6);
      ctx.lineTo(p, y0 + side - 6);
      ctx.stroke();
      const q = Math.round(y0 + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x0 + 6, q);
      ctx.lineTo(x0 + side - 6, q);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(
      x0 + this.food.c * cell + cell / 2,
      y0 + this.food.r * cell + cell / 2,
      cell * 0.32,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    for (let i = this.body.length - 1; i >= 0; i--) {
      const b = this.body[i];
      const t = 1 - i / Math.max(1, this.body.length);
      const size = cell * (0.72 + 0.16 * t);
      fillRound(
        ctx,
        x0 + b.c * cell + (cell - size) / 2,
        y0 + b.r * cell + (cell - size) / 2,
        size,
        size,
        cell * 0.28,
        i === 0 ? this.accent : PANEL_2,
        i === 0 ? undefined : GRID_LINE,
      );
    }

    if (this.dead) {
      ctx.fillStyle = '#E8484C';
      ctx.beginPath();
      ctx.arc(
        x0 + this.dead.c * cell + cell / 2,
        y0 + this.dead.r * cell + cell / 2,
        cell * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SWIPE OR USE ARROW KEYS', this.ctx.width / 2, y0 - 20);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.accent;
    ctx.font = `800 64px Outfit, system-ui, sans-serif`;
    ctx.fillText('Snake', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = `800 130px Outfit, system-ui, sans-serif`;
    ctx.fillText(String(this.score), w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = `600 40px Outfit, system-ui, sans-serif`;
    ctx.fillText(`best ${this.best}`, w / 2, 430);
  }
}

export const snake: GameSpec = {
  id: 'snake',
  title: 'Neon Snake',
  category: 'arcade',
  create(ctx) {
    return new Snake(ctx);
  },
};
