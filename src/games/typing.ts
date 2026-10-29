import type { EngineContext, GameInstance, GameResult, GameSpec, HudLine } from '../engine/types';
import { MUTED, PANEL, TEXT, fillRound, setFont } from '../engine/render';
import { roundSeconds, wordQueue, wpm } from '../shared/typing.js';

const QUEUE = 240;

/**
 * The host binds R (restart) and M (mute) before it forwards keys to the game,
 * so without help any word containing r or m would be untypable. While a round
 * is live a capture-phase listener claims letters and Backspace; Space and
 * Enter still reach the host, so the start and result overlays keep working
 * and the round can always be restarted.
 */
let active: TypingSprint | null = null;

class TypingSprint implements GameInstance {
  result?: GameResult;

  private ctx: EngineContext;
  private words: string[];
  private index = 0;
  private typed = '';
  private chars = 0;
  private correct = 0;
  private elapsed = 0;
  private duration: number;
  private wrongFlash = 0;
  private flashText = '';
  private score = 0;
  private over = false;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    this.words = wordQueue(ctx.seed, QUEUE);
    this.duration = roundSeconds(ctx.difficulty);
    active = this;
  }

  /** True only while the clock is running, i.e. after Play and before the result. */
  get live(): boolean {
    return !this.over && this.elapsed > 0;
  }

  private get word(): string {
    return this.words[this.index];
  }

  update(dt: number): void {
    if (this.over) return;
    this.elapsed += dt;
    if (this.wrongFlash > 0) this.wrongFlash = Math.max(0, this.wrongFlash - dt);
    if (this.elapsed >= this.duration) this.finish();
  }

  key(e: KeyboardEvent): void {
    if (this.over) return;
    if (e.key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      this.submit();
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      this.typed = (this.typed + e.key).slice(0, 24);
      e.preventDefault();
    }
  }

  private submit(): void {
    if (this.over || !this.typed) return;
    const healthy = this.typed.toLowerCase() === this.word;
    if (healthy) {
      this.correct += 1;
      this.chars += this.word.length;
      this.score += this.word.length * 10;
      this.ctx.audio.play('found', { gain: 0.3 });
    } else {
      this.wrongFlash = 0.4;
      this.flashText = this.typed;
      this.ctx.audio.play('wrong', { gain: 0.2 });
    }
    this.typed = '';
    this.index = (this.index + 1) % this.words.length;
  }

  private rate(): number {
    return wpm(this.chars, this.elapsed);
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
    this.ctx.analytics.track('game_over', { game: 'typing', score, wpm: this.rate(), correct: this.correct });
    this.result = {
      score,
      best,
      record: score > previous,
      won: false,
      detail: `${this.rate()} WPM · ${this.correct} words`,
    };
  }

  hud(): HudLine[] {
    return [
      { label: 'WPM', value: String(this.rate()) },
      { label: 'Correct', value: String(this.correct) },
      { label: 'Time', value: `${Math.max(0, Math.ceil(this.duration - this.elapsed))}s` },
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const left = 24;
    const barW = this.ctx.width - left * 2;
    const remaining = Math.max(0, 1 - this.elapsed / this.duration);
    fillRound(ctx, left, 26, barW, 6, 3, PANEL);
    fillRound(ctx, left, 26, barW * remaining, 6, 3, this.ctx.accent);

    const word = this.word;
    const typedLen = Math.min(this.typed.length, word.length);
    const maxW = this.ctx.width - 48;
    let size = 48;
    setFont(ctx, size, 800);
    while (ctx.measureText(word).width > maxW && size > 16) {
      size -= 2;
      setFont(ctx, size, 800);
    }
    const full = ctx.measureText(word).width;
    const x0 = (this.ctx.width - full) / 2;
    const y = this.ctx.height * 0.42;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const head = word.slice(0, typedLen);
    ctx.fillStyle = this.ctx.accent;
    ctx.fillText(head, x0, y);
    const headW = ctx.measureText(head).width;
    ctx.fillStyle = this.wrongFlash > 0 ? '#ff6b6b' : TEXT;
    ctx.fillText(word.slice(typedLen), x0 + headW, y);

    if (this.wrongFlash > 0 && this.flashText) {
      ctx.fillStyle = '#ff6b6b';
      setFont(ctx, Math.max(14, size * 0.5), 700);
      ctx.textAlign = 'center';
      ctx.fillText(`- ${this.flashText} -`, this.ctx.width / 2, y + size * 0.95);
    }

    ctx.fillStyle = MUTED;
    setFont(ctx, 12, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TYPE THE WORD · SPACE TO SUBMIT · BACKSPACE TO FIX', this.ctx.width / 2, this.ctx.height - 62);

    const next = `${this.words[(this.index + 1) % this.words.length]} · ${this.words[(this.index + 2) % this.words.length]}`;
    ctx.fillStyle = 'rgba(155, 151, 141, 0.65)';
    setFont(ctx, 14, 600);
    ctx.fillText(`NEXT ${next}`, this.ctx.width / 2, this.ctx.height - 36);
  }

  shareCard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ctx.accent;
    ctx.font = '800 62px Outfit, system-ui, sans-serif';
    ctx.fillText('Typing Sprint', w / 2, 150);
    ctx.fillStyle = TEXT;
    ctx.font = '800 120px Outfit, system-ui, sans-serif';
    ctx.fillText(`${this.rate()} WPM`, w / 2, 300);
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px Outfit, system-ui, sans-serif';
    ctx.fillText(`${this.correct} words · arcadefork.com`, w / 2, 420);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      const game = active;
      if (!game || !game.live) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.key !== 'Backspace' && !(e.key.length === 1 && /[a-z]/i.test(e.key))) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      game.key(e);
    },
    true,
  );
}

export const typing: GameSpec = {
  id: 'typing',
  title: 'Typing Sprint',
  category: 'word',
  daily: true,
  create(ctx) {
    return new TypingSprint(ctx);
  },
};
