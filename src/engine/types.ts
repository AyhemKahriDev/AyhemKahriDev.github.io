export interface Vec2 {
  x: number;
  y: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export type CategoryId = 'word' | 'puzzle' | 'arcade' | 'brain' | 'kids' | 'io';

export interface HudLine {
  label: string;
  value: string;
}

export interface GameResult {
  score: number;
  best: number;
  /**
   * True when this run beat the previous best. Games must compare against the
   * stored best BEFORE writing the new one - `score >= best` is always true
   * once best has been updated, which is how every result card ended up
   * claiming a new record.
   */
  record?: boolean;
  won?: boolean;
  detail?: string;
}

export interface EngineContext {
  /** YYYY-MM-DD */
  readonly date: string;
  /** Deterministic seed for the day. */
  readonly seed: number;
  /** Seeded PRNG. */
  readonly rng: () => number;
  readonly storage: Storage;
  readonly audio: Audio;
  readonly ads: Ads;
  readonly analytics: Analytics;
  readonly difficulty: Difficulty;
  /** CSS pixel size of the canvas. */
  readonly width: number;
  readonly height: number;
  /** Brand accent colour for this game. */
  readonly accent: string;
  /** Root directory of the deployed site, for building share links. */
  readonly siteBase: string;
}

export interface GameInstance {
  /** Fixed-timestep update, seconds. */
  update(dt: number): void;
  /** Draw the frame. Context is pre-translated to CSS pixels. */
  render(ctx: CanvasRenderingContext2D): void;
  pointerDown?(p: Vec2): void;
  pointerMove?(p: Vec2): void;
  pointerUp?(p: Vec2): void;
  key?(e: KeyboardEvent): void;
  /** Top-bar readouts. */
  hud(): HudLine[];
  /** Set when the round ends; the host shows the result overlay. */
  result?: GameResult;
  /** Called when the host wants a share-card rendering. */
  shareCard?(ctx: CanvasRenderingContext2D, w: number, h: number): void;
}

export interface GameSpec {
  id: string;
  title: string;
  category: CategoryId;
  /** True for games that rotate daily (seeded by date). */
  daily?: boolean;
  create(ctx: EngineContext): GameInstance;
}

export interface Storage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  number(key: string, fallback: number): number;
  inc(key: string, by: number): number;
}

export type SfxName =
  | 'tap'
  | 'select'
  | 'found'
  | 'wrong'
  | 'score'
  | 'gameover'
  | 'start'
  | 'win';

export interface Audio {
  unlock(): void;
  play(name: SfxName, opts?: { gain?: number }): void;
  muted(): boolean;
  toggleMute(): boolean;
}

export type AdProvider = 'none' | 'house' | 'poki' | 'crazygames' | 'network';

export interface Ads {
  provider(): AdProvider;
  /** Full-screen ad. Resolves when it is over. */
  showInterstitial(): Promise<void>;
  /** Opt-in rewarded ad. Resolves true if the reward was earned. */
  showRewarded(): Promise<boolean>;
  /** A free promo for another game on the site. */
  houseAd(): { title: string; subtitle: string; href: string } | null;
}

export interface Analytics {
  track(event: string, props?: Record<string, unknown>): void;
}
