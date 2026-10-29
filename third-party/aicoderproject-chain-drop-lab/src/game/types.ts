export type GameMode = 'NORMAL' | 'BOOST' | 'PRACTICE' | 'DEMO';

export type GemColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

export interface Gem {
  id: string;
  color: GemColor;
  x: number; // Grid coordinate X (0-5)
  y: number; // Grid coordinate Y (0-11)
  animY: number; // For smooth falling animation (visual Y)
  isNew: boolean;
}

export type GridCell = Gem | null;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
  maxLife: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface GameState {
  score: number;
  highScore: number;
  chainCount: number;
  maxChainCount: number;
  level: number;
  gameOver: boolean;
  paused: boolean;
  mode: GameMode;
}
