import type {
  EngineContext,
  GameInstance,
  GameResult,
  GameSpec,
  HudLine,
  Vec2,
} from '../engine/types';
import { GRID_LINE, MUTED, PANEL, PANEL_2, TEXT, drawFitCenter, fillRound, setFont } from '../engine/render';

const N = 4;
const TARGET = 2048;

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#2B3550', fg: '#C9D3F5' },
  4: { bg: '#354268', fg: '#D8E0FF' },
  8: { bg: '#4A6BC4', fg: '#FFFFFF' },
  16: { bg: '#5E86E8', fg: '#FFFFFF' },
  32: { bg: '#4FA3C7', fg: '#FFFFFF' },
  64: { bg: '#46B98A', fg: '#FFFFFF' },
  128: { bg: '#8FBF3F', fg: '#10210A' },
  256: { bg: '#D9C33A', fg: '#221C02' },
  512: { bg: '#EFA02E', fg: '#241603' },
  1024: { bg: '#E9702E', fg: '#241203' },
  2048: { bg: '#E8484C', fg: '#FFFFFF' },
};

type Dir = 'up' | 'down' | 'left' | 'right';

class Merge implements GameInstance {
  private ctx: EngineContext;
  private tiles: number[][] = [];
  private score = 0;
  private best = 0;
  private over = false;
  private won = false;
  private accent: string;
  private swipeStart: Vec2 | null = null;
  private pop: { r: number; c: number; v: number; t: number }[] = [];

  result?: GameResult;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.accent = ctx.accent;
    this.best = ctx.storage.number('best', 0);
    this.reset();
  }

  private reset(): void {
    this.tiles = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    this.score = 0;
    this.over = false;
    this.won = false;
    this.pop = [];
    this.spawn();
    this.spawn();
  }

  private spawn(): void {
    const empty: { r: number; c: number }[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (this.tiles[r][c] === 0) empty.push({ r, c });
    }
    if (empty.length === 0) return;
    const cell = empty[Math.floor(this.ctx.rng() * empty.length)];
    this.tiles[cell.r][cell.c] = this.ctx.rng() < 0.9 ? 2 : 4;
  }

  update(dt: number): void {
    if (this.over) return;
    for (const p of this.pop) p.t += dt;
    this.pop = this.pop.filter((p) => p.t < 0.22);
  }

  private slide(row: number[], reverse: boolean): { row: number[]; gained: number; merged: number[] } {
    let cells = row.filter((v) => v !== 0);
    if (reverse) cells = cells.reverse();
    const out: number[] = [];
    const merged: number[] = [];
    let gained = 0;
    for (let i = 0; i < cells.length; i++) {
      if (i + 1 < cells.length && cells[i] === cells[i + 1]) {
        const v = cells[i] * 2;
        out.push(v);
        merged.push(v);
        gained += v;
        i++;
      } else {
        out.push(cells[i]);
      }
    }
    while (out.length < N) out.push(0);
    if (reverse) out.reverse();
    return { row: out, gained, merged };
  }

  private move(dir: Dir): boolean {
    if (this.over) return false;
    const before = this.tiles.map((r) => r.slice()).flat().join(',');
    let gained = 0;
    const mergedCells: { r: number; c: number; v: number }[] = [];

    for (let i = 0; i < N; i++) {
      let line: number[];
      let put: (v: number, idx: number) => void;
      if (dir === 'left') {
        line = this.tiles[i].slice();
        put = (v, idx) => {
          this.tiles[i][idx] = v;
        };
      } else if (dir === 'right') {
        line = this.tiles[i].slice();
        put = (v, idx) => {
          this.tiles[i][N - 1 - idx] = v;
        };
      } else if (dir === 'up') {
        line = this.tiles.map((r) => r[i]);
        put = (v, idx) => {
          this.tiles[idx][i] = v;
        };
      } else {
        line = this.tiles.map((r) => r[i]);
        put = (v, idx) => {
          this.tiles[N - 1 - idx][i] = v;
        };
      }

      const reverse = dir === 'right' || dir === 'down';
      const res = this.slide(line, reverse);
      gained += res.gained;
      res.row.forEach((v, idx) => put(v, idx));
      if (res.merged.length) {
        res.merged.forEach((v) => mergedCells.push({ r: i, c: i, v }));
      }
    }

    const after = this.tiles.map((r) => r.slice()).flat().join(',');
    if (before === after) return false;

    this.score += gained;
    if (gained > 0) this.ctx.audio.play('score', { gain: 0.12 });
    else this.ctx.audio.play('tap', { gain: 0.1 });
    this.pop = mergedCells.map((m) => ({ r: m.r, c: m.c, v: m.v, t: 0 }));
    this.spawn();

    if (!this.won && this.tiles.some((row) => row.some((v) => v >= TARGET))) {
      this.won = true;
      this.ctx.audio.play('win');
      this.ctx.analytics.track('win_2048', { score: this.score });
    }

    if (!this.canMove()) this.finish();
    return true;
  }

  private canMove(): boolean {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (this.tiles[r][c] === 0) return true;
        if (c + 1 < N && this.tiles[r][c] === this.tiles[r][c + 1]) return true;
        if (r + 1 < N && this.tiles[r][c] === this.tiles[r + 1][c]) return true;
      }
    }
    return false;
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    this.best = Math.max(this.score, this.ctx.storage.number('best', 0));
    this.ctx.storage.set('best', this.best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play('gameover');
    this.ctx.analytics.track('game_over', { game: 'merge', score: this.score, won: this.won });
    this.result = { score: this.score, best: this.best, won: this.won, detail: this.won ? 'Reached 2048' : 'No moves left' };
  }

  private geo() {
    const pad = 16;
    const bw = 46;
    const bgap = 6;
    const dpadH = bw * 3 + bgap * 2;
    const dpadTop = this.ctx.height - dpadH - 12;
    const hintY = dpadTop - 16;

    const boardBottom = hintY - 18;
    const side = Math.min(this.ctx.width - pad * 2, boardBottom - 10);
    const cell = side / N;
    return {
      x: (this.ctx.width - side) / 2,
      y: 10 + (boardBottom - 10 - side) / 2,
      cell,
      boardSide: side,
      bw,
      bgap,
      dpadTop,
      dpadW: bw * 3 + bgap * 2,
      hintY,
    };
  }

  private dpadButtons() {
    const g = this.geo();
    const b = g.bw;
    const gp = g.bgap;
    const gx = (this.ctx.width - g.dpadW) / 2;
    const gy = g.dpadTop;
    const cell = (col: number, row: number) => ({
      x: gx + col * (b + gp),
      y: gy + row * (b + gp),
      w: b,
      h: b,
    });
    return [
      { dir: 'up' as Dir, ...cell(1, 0) },
      { dir: 'left' as Dir, ...cell(0, 1) },
      { dir: 'right' as Dir, ...cell(2, 1) },
      { dir: 'down' as Dir, ...cell(1, 2) },
    ];
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    for (const b of this.dpadButtons()) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        this.move(b.dir);
        return;
      }
    }
    this.swipeStart = p;
  }

  pointerUp(p: Vec2): void {
    if (!this.swipeStart) return;
    const dx = p.x - this.swipeStart.x;
    const dy = p.y - this.swipeStart.y;
    this.swipeStart = null;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
    else this.move(dy > 0 ? 'down' : 'up');
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
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      this.move(dir);
    }
  }

  hud(): HudLine[] {
    return [
      { label: 'Score', value: String(this.score) },
      { label: 'Best', value: String(this.best) },
      { label: 'Target', value: '2048' },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.geo();
    fillRound(ctx, g.x, g.y, g.cell * N, g.cell * N, 12, PANEL, GRID_LINE);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = this.tiles[r][c];
        const x = g.x + c * g.cell;
        const y = g.y + r * g.cell;
        if (v === 0) {
          fillRound(ctx, x + 4, y + 4, g.cell - 8, g.cell - 8, 9, PANEL_2);
          continue;
        }
        const colors = TILE_COLORS[v] ?? { bg: '#E8484C', fg: '#FFFFFF' };
        const popIdx = this.pop.findIndex((p) => p.r === r && p.c === c);
        let scale = 1;
        if (popIdx >= 0) {
          const t = this.pop[popIdx].t / 0.22;
          scale = 1 + 0.12 * (1 - t);
        }
        const w = (g.cell - 8) * scale;
        const h = (g.cell - 8) * scale;
        const ox = x + 4 + ((g.cell - 8) - w) / 2;
        const oy = y + 4 + ((g.cell - 8) - h) / 2;
        fillRound(ctx, ox, oy, w, h, 9, colors.bg);
        ctx.fillStyle = colors.fg;
        drawFitCenter(ctx, String(v), ox + w / 2, oy + h / 2, w - 10, Math.min(38, g.cell * 0.42), 800);
      }
    }

    // D-pad for touch.
    for (const b of this.dpadButtons()) {
      fillRound(ctx, b.x, b.y, b.w, b.h, 10, PANEL_2, GRID_LINE);
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, 18, 700);
      const arrow = { up: '▲', down: '▼', left: '◀', right: '▶' }[b.dir];
      ctx.fillText(arrow, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SWIPE OR USE ARROW KEYS', this.ctx.width / 2, g.hintY);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.accent;
    ctx.font = `800 60px Outfit, system-ui, sans-serif`;
    ctx.fillText('2048 Merge', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = `800 130px Outfit, system-ui, sans-serif`;
    ctx.fillText(String(this.score), w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = `600 40px Outfit, system-ui, sans-serif`;
    ctx.fillText(`best ${this.best} · arcadefork.com`, w / 2, 430);
  }
}

export const merge: GameSpec = {
  id: 'merge',
  title: '2048 Merge',
  category: 'puzzle',
  create(ctx) {
    return new Merge(ctx);
  },
};
