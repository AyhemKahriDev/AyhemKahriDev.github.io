import type {
  EngineContext,
  GameInstance,
  GameResult,
  GameSpec,
  HudLine,
  Vec2,
} from '../engine/types';
import {
  GRID_LINE,
  MUTED,
  PANEL_2,
  TEXT,
  drawFitCenter,
  fillRound,
  formatTime,
  hexToRgba,
  setFont,
} from '../engine/render';
import { generateWordBoard, dateSeed } from '../shared/daily.js';
import { themeForDate } from '../shared/wordlists.js';

const SIZE = 10;
const TOTAL = 11;

interface Placed {
  word: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

interface Sel {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  valid: boolean;
}

class WordSearch implements GameInstance {
  private ctx: EngineContext;
  private grid: string[][] = [];
  private placed: Placed[] = [];
  private found = new Set<string>();
  private sel: Sel | null = null;
  private timeLeft: number;
  private score = 0;
  private over = false;
  private accent: string;
  private themeTitle: string;
  private date: string;

  result?: GameResult;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.accent = ctx.accent;
    this.date = ctx.date;
    const theme = themeForDate(ctx.date, dateSeed(ctx.date));
    this.themeTitle = theme.title;
    const board = generateWordBoard(ctx.date, theme, SIZE, TOTAL);
    this.grid = board.grid as unknown as string[][];
    this.placed = board.placed as unknown as Placed[];
    const limit = ctx.difficulty === 'easy' ? 150 : ctx.difficulty === 'hard' ? 60 : 100;
    this.timeLeft = limit;
  }

  private get timeTotal(): number {
    return this.ctx.difficulty === 'easy' ? 150 : this.ctx.difficulty === 'hard' ? 60 : 100;
  }

  update(dt: number): void {
    if (this.over) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish(false);
    }
  }

  private cellAt(p: Vec2): { r: number; c: number } | null {
    const geo = this.geo();
    const c = Math.floor((p.x - geo.x) / geo.cell);
    const r = Math.floor((p.y - geo.y) / geo.cell);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return { r, c };
  }

  private geo() {
    const pad = 14;
    // Leave room for the theme strip above the board.
    const side = Math.min(this.ctx.width - pad * 2, this.ctx.height - 120);
    const cell = side / SIZE;
    const sidePx = cell * SIZE;
    return {
      x: (this.ctx.width - sidePx) / 2,
      y: (this.ctx.height - sidePx) / 2 + 26,
      cell,
      side: sidePx,
    };
  }

  pointerDown(p: Vec2): void {
    if (this.over) return;
    const cell = this.cellAt(p);
    if (!cell) return;
    this.sel = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c, valid: true };
    this.ctx.audio.play('tap', { gain: 0.1 });
  }

  pointerMove(p: Vec2): void {
    if (!this.sel || this.over) return;
    const cell = this.cellAt(p);
    if (!cell) return;
    const dr = cell.r - this.sel.r0;
    const dc = cell.c - this.sel.c0;
    const step = alignedStep(dr, dc);
    if (!step) return;
    const len = Math.max(Math.abs(dr), Math.abs(dc));
    this.sel.r1 = this.sel.r0 + step[0] * len;
    this.sel.c1 = this.sel.c0 + step[1] * len;
    this.sel.valid = true;
  }

  pointerUp(_p: Vec2): void {
    if (!this.sel || this.over) return;
    const sel = this.sel;
    this.sel = null;
    const word = this.spelled(sel);
    if (!word) return;
    const target = this.placed.find((p) => p.word === word);
    if (target && !this.found.has(word)) {
      this.found.add(word);
      this.score += 60 + word.length * 20 + Math.floor(this.timeLeft) * 2;
      this.ctx.audio.play('found');
      this.ctx.analytics.track('word_found', { word, remaining: this.placed.length - this.found.size });
      if (this.found.size === this.placed.length) this.finish(true);
    } else {
      this.ctx.audio.play('wrong', { gain: 0.1 });
    }
  }

  private spelled(sel: Sel): string {
    const step = alignedStep(sel.r1 - sel.r0, sel.c1 - sel.c0);
    if (!step) return '';
    const len = Math.max(Math.abs(sel.r1 - sel.r0), Math.abs(sel.c1 - sel.c0));
    let out = '';
    for (let i = 0; i <= len; i++) {
      const r = sel.r0 + step[0] * i;
      const c = sel.c0 + step[1] * i;
      const ch = this.grid[r]?.[c];
      if (!ch) return '';
      out += ch;
    }
    return out;
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    const best = Math.max(this.score, this.ctx.storage.number('best', 0));
    this.ctx.storage.set('best', best);
    this.ctx.storage.inc('plays', 1);
    this.ctx.audio.play(won ? 'win' : 'gameover');
    this.ctx.analytics.track('game_over', {
      score: this.score,
      found: this.found.size,
      won,
      seconds: Math.round(this.timeTotal - this.timeLeft),
    });
    this.result = {
      score: this.score,
      best,
      won,
      detail: `${this.found.size}/${this.placed.length} words`,
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'Found', value: `${this.found.size}/${this.placed.length}` },
      { label: 'Time', value: formatTime(this.timeLeft) },
      { label: 'Score', value: String(this.score) },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const geo = this.geo();
    const cell = geo.cell;
    const foundCells = new Map<string, string>();
    for (const p of this.placed) {
      if (!this.found.has(p.word)) continue;
      forEachCell(p, (r, c) => foundCells.set(`${r},${c}`, p.word));
    }

    const selCells = new Map<string, boolean>();
    if (this.sel) {
      const step = alignedStep(this.sel.r1 - this.sel.r0, this.sel.c1 - this.sel.c0);
      if (step) {
        const len = Math.max(
          Math.abs(this.sel.r1 - this.sel.r0),
          Math.abs(this.sel.c1 - this.sel.c0),
        );
        for (let i = 0; i <= len; i++) {
          selCells.set(`${this.sel.r0 + step[0] * i},${this.sel.c0 + step[1] * i}`, true);
        }
      }
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = geo.x + c * cell;
        const y = geo.y + r * cell;
        const key = `${r},${c}`;
        const isFound = foundCells.has(key);
        const isSel = selCells.has(key);
        let fill = PANEL_2;
        if (isFound) fill = hexToRgba(this.accent, 0.22);
        else if (isSel) fill = hexToRgba(this.accent, 0.12);
        fillRound(ctx, x + 2, y + 2, cell - 4, cell - 4, 7, fill, isFound ? this.accent : GRID_LINE);

        ctx.fillStyle = isFound ? this.accent : TEXT;
        drawFitCenter(ctx, this.grid[r][c], x + cell / 2, y + cell / 2, cell - 8, cell * 0.5, 700);
      }
    }

    // Theme strip directly above the board, current pick below it.
    setFont(ctx, 13, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MUTED;
    ctx.fillText(
      `TODAY'S PUZZLE · ${this.themeTitle.toUpperCase()}`,
      this.ctx.width / 2,
      geo.y - 20,
    );

    if (this.sel) {
      const word = this.spelled(this.sel);
      if (word.length > 1) {
        ctx.fillStyle = this.accent;
        drawFitCenter(ctx, word, this.ctx.width / 2, geo.y + geo.side + 22, this.ctx.width - 40, 18, 700);
      }
    }
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.accent;
    ctx.font = `800 64px ${'Outfit, system-ui, sans-serif'}`;
    ctx.fillText('Daily Word Search', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = `700 120px ${'Outfit, system-ui, sans-serif'}`;
    ctx.fillText(`${this.found.size}/${this.placed.length}`, w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = `600 40px ${'Outfit, system-ui, sans-serif'}`;
    ctx.fillText(
      `${this.date} · score ${this.score} · arcadefork.com`,
      w / 2,
      420,
    );
  }
}

function forEachCell(p: Placed, fn: (r: number, c: number) => void): void {
  const dr = Math.sign(p.r1 - p.r0);
  const dc = Math.sign(p.c1 - p.c0);
  const len = Math.max(Math.abs(p.r1 - p.r0), Math.abs(p.c1 - p.c0));
  for (let i = 0; i <= len; i++) fn(p.r0 + dr * i, p.c0 + dc * i);
}

function alignedStep(dr: number, dc: number): [number, number] | null {
  if (dr === 0 && dc === 0) return [0, 0];
  if (dr === 0) return [0, Math.sign(dc)];
  if (dc === 0) return [Math.sign(dr), 0];
  if (Math.abs(dr) === Math.abs(dc)) return [Math.sign(dr), Math.sign(dc)];
  return null;
}

export const wordSearch: GameSpec = {
  id: 'wordsearch',
  title: 'Daily Word Search',
  category: 'word',
  daily: true,
  create(ctx) {
    return new WordSearch(ctx);
  },
};
