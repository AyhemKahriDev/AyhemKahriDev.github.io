import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine, Vec2 } from '../engine/types';
import { MUTED, TEXT, fillRound, setFont } from '../engine/render';

const COLS = 8;
const ROWS = 5;
const BALL_R = 6;
const BASE_SPEED = 240;
const SPEED_STEP = 1.18;
const BRICKS = COLS * ROWS;

interface Level {
  lives: number;
  speed: number;
  paddle: number;
}

const LEVELS: Record<string, Level> = {
  easy: { lives: 3, speed: 1, paddle: 0.3 },
  normal: { lives: 3, speed: 1.1, paddle: 0.22 },
  hard: { lives: 2, speed: 1.25, paddle: 0.22 },
};

function hueOf(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return (hue * 60 + 360) % 360;
}

class Breakout implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private level: Level;
  private hue: number;
  private stage = 1;
  private lives: number;
  private score = 0;
  private alive: boolean[] = new Array(BRICKS).fill(true);
  private paddleX: number;
  private ballX = 0;
  private ballY = 0;
  private vx = 0;
  private vy = 0;
  private launched = false;
  private over = false;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.level = LEVELS[ctx.difficulty] ?? LEVELS.normal;
    this.lives = this.level.lives;
    this.hue = hueOf(ctx.accent);
    this.paddleX = ctx.width / 2;
    this.resetBall();
  }

  private field() {
    const left = 12;
    const right = this.ctx.width - 12;
    const top = 64;
    const bottom = this.ctx.height - 14;
    const w = right - left;
    const h = bottom - top;
    // Eight columns across the full width; brick height is 0.9 of a column and
    // is capped so five rows always leave the paddle room underneath.
    const bw = w / COLS;
    const bh = Math.max(6, Math.min(bw * 0.9, (h * 0.46) / ROWS));
    return { left, right, top, bottom, w, h, bw, bh };
  }

  private paddleWidth(): number {
    return Math.min(this.field().w, this.ctx.width * this.level.paddle);
  }

  private paddleY(): number {
    return this.field().bottom - 24;
  }

  private speed(): number {
    return BASE_SPEED * Math.pow(SPEED_STEP, this.stage - 1) * this.level.speed;
  }

  private brickRect(i: number) {
    const f = this.field();
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return { x: f.left + col * f.bw + 1, y: f.top + row * f.bh + 1, w: f.bw - 2, h: f.bh - 2, row };
  }

  private resetBall(): void {
    this.launched = false;
    this.vx = 0;
    this.vy = 0;
    this.ballX = this.paddleX;
    this.ballY = this.paddleY() - BALL_R - 2;
  }

  private launch(): void {
    if (this.over || this.launched) return;
    const speed = this.speed();
    const angle = 0.32 * (this.ctx.rng() > 0.5 ? 1 : -1);
    this.vx = Math.sin(angle) * speed;
    this.vy = -Math.cos(angle) * speed;
    this.launched = true;
    this.ctx.audio.play('start', { gain: 0.4 });
  }

  update(dt: number): void {
    if (this.over) return;
    if (!this.launched) {
      this.ballX = this.paddleX;
      this.ballY = this.paddleY() - BALL_R - 2;
      return;
    }
    const speed = this.speed();
    const len = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / len) * speed;
    this.vy = (this.vy / len) * speed;
    const steps = Math.max(1, Math.ceil((speed * dt) / 4));
    const step = dt / steps;
    for (let s = 0; s < steps; s++) {
      if (!this.launched || this.over) break;
      const prevX = this.ballX;
      const prevY = this.ballY;
      this.ballX += this.vx * step;
      this.ballY += this.vy * step;
      this.collide(prevX, prevY);
    }
    if (!this.over && this.alive.every((a) => !a)) this.nextStage();
  }

  private collide(prevX: number, prevY: number): void {
    const f = this.field();
    if (this.ballX - BALL_R < f.left) {
      this.ballX = f.left + BALL_R;
      this.vx = Math.abs(this.vx);
    } else if (this.ballX + BALL_R > f.right) {
      this.ballX = f.right - BALL_R;
      this.vx = -Math.abs(this.vx);
    }
    if (this.ballY - BALL_R < f.top) {
      this.ballY = f.top + BALL_R;
      this.vy = Math.abs(this.vy);
    }
    if (this.ballY - BALL_R > f.bottom) {
      this.loseLife();
      return;
    }

    // Paddle: only from above, and only while falling.
    const pw = this.paddleWidth();
    const py = this.paddleY();
    if (
      this.vy > 0 &&
      this.ballY + BALL_R >= py &&
      this.ballY - BALL_R <= py + 12 &&
      this.ballX >= this.paddleX - pw / 2 - BALL_R &&
      this.ballX <= this.paddleX + pw / 2 + BALL_R
    ) {
      const speed = this.speed();
      const offset = Math.max(-1, Math.min(1, (this.ballX - this.paddleX) / (pw / 2)));
      const angle = offset * 1.05;
      this.ballX += offset * 4;
      this.ballY = py - BALL_R - 1;
      this.vx = Math.sin(angle) * speed;
      this.vy = -Math.abs(Math.cos(angle) * speed);
      this.ctx.audio.play('tap', { gain: 0.25 });
      return;
    }

    for (let i = 0; i < BRICKS; i++) {
      if (!this.alive[i]) continue;
      const b = this.brickRect(i);
      const nearX = Math.max(b.x, Math.min(this.ballX, b.x + b.w));
      const nearY = Math.max(b.y, Math.min(this.ballY, b.y + b.h));
      if ((nearX - this.ballX) ** 2 + (nearY - this.ballY) ** 2 > BALL_R * BALL_R) continue;
      this.alive[i] = false;
      this.score += (ROWS - b.row) * 10;
      this.ctx.audio.play('found', { gain: 0.22 });
      if (prevY + BALL_R <= b.y || prevY - BALL_R >= b.y + b.h) this.vy = -this.vy;
      else if (prevX + BALL_R <= b.x || prevX - BALL_R >= b.x + b.w) this.vx = -this.vx;
      else this.vy = -this.vy;
      return;
    }
  }

  private loseLife(): void {
    if (this.over) return;
    this.lives -= 1;
    this.ctx.audio.play('wrong', { gain: 0.3 });
    if (this.lives <= 0) {
      this.finish();
      return;
    }
    this.resetBall();
  }

  private nextStage(): void {
    this.stage += 1;
    this.alive = new Array(BRICKS).fill(true);
    this.ctx.audio.play('win', { gain: 0.35 });
    this.score += 100;
    this.resetBall();
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    const previous = this.ctx.storage.number('best', 0);
    const score = this.score;
    const best = Math.max(score, previous);
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play('gameover');
    this.ctx.analytics.track('game_over', { game: 'breakout', score, stage: this.stage });
    this.result = {
      score,
      best,
      record: score > previous,
      won: false,
      detail: `${score} points · reached level ${this.stage}`,
    };
  }

  private movePaddle(x: number): void {
    const f = this.field();
    const half = this.paddleWidth() / 2;
    this.paddleX = Math.max(f.left + half, Math.min(f.right - half, x));
    if (!this.launched) {
      this.ballX = this.paddleX;
      this.ballY = this.paddleY() - BALL_R - 2;
    }
  }

  pointerMove(p: Vec2): void {
    if (this.over) return;
    this.movePaddle(p.x);
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    this.movePaddle(p.x);
    this.launch();
  }

  key(e: KeyboardEvent): void {
    if (this.over) return;
    if (e.key === 'ArrowLeft') this.movePaddle(this.paddleX - 12);
    else if (e.key === 'ArrowRight') this.movePaddle(this.paddleX + 12);
    else if (e.key === ' ' || e.key === 'Enter') this.launch();
    else return;
    e.preventDefault();
  }

  hud(): HudLine[] {
    return [
      { label: 'Level', value: String(this.stage) },
      { label: 'Lives', value: String(this.lives) },
      { label: 'Score', value: String(this.score) },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.field();
    ctx.strokeStyle = '#20262e';
    ctx.lineWidth = 2;
    ctx.strokeRect(f.left, f.top - 8, f.w, f.bottom - f.top + 8);

    for (let i = 0; i < BRICKS; i++) {
      if (!this.alive[i]) continue;
      const b = this.brickRect(i);
      const fill = `hsl(${Math.round(this.hue + b.row * 16)} 85% ${56 - b.row * 4}%)`;
      fillRound(ctx, b.x, b.y, b.w, b.h, 3, fill);
    }

    const pw = this.paddleWidth();
    fillRound(ctx, this.paddleX - pw / 2, this.paddleY(), pw, 12, 6, this.ctx.accent);

    ctx.fillStyle = TEXT;
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.launched ? 'DRAG OR USE THE ARROW KEYS' : 'TAP OR PRESS SPACE TO LAUNCH',
      this.ctx.width / 2,
      f.top - 22,
    );
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Neon Breakout', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 120px Outfit, system-ui, sans-serif';
    ctx.fillText(String(this.score), w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText(`level ${this.stage} · arcadefork.com`, w / 2, 420);
  }
}

export const breakout: GameSpec = {
  id: 'breakout',
  title: 'Neon Breakout',
  category: 'arcade',
  daily: false,
  create(ctx) {
    return new Breakout(ctx);
  },
};
