import { Board, BOARD_ROWS, BOARD_COLS } from './board';
import { Gem, Particle, FloatingText, GameState, GemColor } from './types';

const COLOR_MAP: Record<GemColor, string> = {
  red: '#ff4d4d',
  blue: '#3399ff',
  green: '#33cc33',
  yellow: '#ffcc00',
  purple: '#b366ff',
};

const COLOR_GLOW: Record<GemColor, string> = {
  red: 'rgba(255, 77, 77, 0.4)',
  blue: 'rgba(51, 153, 255, 0.4)',
  green: 'rgba(51, 204, 51, 0.4)',
  yellow: 'rgba(255, 204, 0, 0.4)',
  purple: 'rgba(179, 102, 255, 0.4)',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize = 40;
  private boardOffsetX = 200;
  private boardOffsetY = 50;

  // Visual effects state
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  private shakeTime = 0;
  private shakeAmount = 0;
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D Context');
    this.ctx = context;
    this.resizeCanvas();
    
    try {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      this.reducedMotion = false;
    }
  }

  public resizeCanvas(): void {
    // Keep internal logical resolution stable (e.g. 800x650)
    this.canvas.width = 800;
    this.canvas.height = 650;
  }

  public triggerShake(durationFrames: number, amount: number): void {
    if (this.reducedMotion) {
      this.shakeTime = 0;
      this.shakeAmount = 0;
      return;
    }
    this.shakeTime = durationFrames;
    this.shakeAmount = amount;
  }

  public addClearParticles(r: number, c: number, color: GemColor): void {
    const x = this.boardOffsetX + c * this.cellSize + this.cellSize / 2;
    const y = this.boardOffsetY + r * this.cellSize + this.cellSize / 2;

    const particleCount = this.reducedMotion ? 3 : 15;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slightly upwards
        color: COLOR_MAP[color],
        size: 3 + Math.random() * 4,
        life: 1.0,
        maxLife: 30 + Math.floor(Math.random() * 20),
      });
    }
  }

  public addFloatingText(text: string, size = 30, color = '#ffffff'): void {
    this.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x: this.boardOffsetX + (BOARD_COLS * this.cellSize) / 2,
      y: this.boardOffsetY + (BOARD_ROWS * this.cellSize) / 2,
      size,
      color,
      life: 1.0,
      maxLife: 60, // 1 second at 60fps
    });
  }

  public updateEffects(): void {
    // Update Shake
    if (this.shakeTime > 0) {
      this.shakeTime--;
    }

    // Update Particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life -= 1.0 / p.maxLife;
      return p.life > 0;
    });

    // Update Floating Texts
    this.floatingTexts = this.floatingTexts.filter(t => {
      t.y -= 0.8; // float up
      t.life -= 1.0 / t.maxLife;
      return t.life > 0;
    });
  }

  public draw(board: Board, activeGems: Gem[], nextGems: GemColor[], state: GameState): void {
    // Clear whole screen
    this.ctx.fillStyle = '#0f172a'; // Deep slate dark mode
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply Camera Shake
    this.ctx.save();
    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * this.shakeAmount;
      const dy = (Math.random() - 0.5) * this.shakeAmount;
      this.ctx.translate(dx, dy);
    }

    // Draw grid background
    this.drawBoardBackground();

    // Draw static board gems
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const gem = board.getCell(r, c);
        if (gem) {
          this.drawGem(gem.animY, gem.x, gem.color, false);
        }
      }
    }

    // Draw active dropping gems
    activeGems.forEach(gem => {
      this.drawGem(gem.animY, gem.x, gem.color, true);
    });

    // Draw particles
    this.drawParticles();

    this.ctx.restore(); // end of camera shake

    // Draw HUD & UI
    this.drawUI(state, nextGems);

    // Draw Floating Chain / Score Texts on top of everything
    this.drawFloatingTexts();
  }

  private drawBoardBackground(): void {
    const width = BOARD_COLS * this.cellSize;
    const height = BOARD_ROWS * this.cellSize;

    // Board container glow/shadow
    this.ctx.fillStyle = '#1e293b'; // slightly lighter slate
    this.ctx.fillRect(this.boardOffsetX, this.boardOffsetY, width, height);

    // Grid lines
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= BOARD_COLS; c++) {
      const x = this.boardOffsetX + c * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.boardOffsetY);
      this.ctx.lineTo(x, this.boardOffsetY + height);
      this.ctx.stroke();
    }
    for (let r = 0; r <= BOARD_ROWS; r++) {
      const y = this.boardOffsetY + r * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(this.boardOffsetX, y);
      this.ctx.lineTo(this.boardOffsetX + width, y);
      this.ctx.stroke();
    }

    // Border
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(this.boardOffsetX, this.boardOffsetY, width, height);
  }

  private drawGem(y: number, x: number, color: GemColor, isActive: boolean): void {
    const screenX = this.boardOffsetX + x * this.cellSize + this.cellSize / 2;
    const screenY = this.boardOffsetY + y * this.cellSize + this.cellSize / 2;
    const radius = this.cellSize / 2 - 3;

    this.ctx.save();

    // Subtle breathing / active animation scaling
    let currentRadius = radius;
    if (isActive) {
      currentRadius += Math.sin(Date.now() * 0.01) * 1.5;
    }

    // Glow Effect
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = COLOR_GLOW[color];

    // Radial gradient for 3D gemstone effect
    const grad = this.ctx.createRadialGradient(
      screenX - currentRadius / 3,
      screenY - currentRadius / 3,
      currentRadius / 10,
      screenX,
      screenY,
      currentRadius
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, COLOR_MAP[color]);
    grad.addColorStop(1, '#000000');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw metallic highlight ring
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Central core for sci-fi look
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.beginPath();
    this.ctx.arc(screenX - currentRadius / 4, screenY - currentRadius / 4, currentRadius / 3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawParticles(): void {
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = p.color;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private drawFloatingTexts(): void {
    this.floatingTexts.forEach(t => {
      this.ctx.save();
      this.ctx.globalAlpha = t.life;
      this.ctx.fillStyle = t.color;
      this.ctx.font = `bold ${t.size}px 'Outfit', 'Inter', sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 10;

      // Scale text slightly based on life for bouncing out animation
      const scale = this.reducedMotion ? 1.0 : 1.0 + (1.0 - t.life) * 0.3;
      this.ctx.translate(t.x, t.y);
      this.ctx.scale(scale, scale);
      this.ctx.fillText(t.text, 0, 0);
      this.ctx.restore();
    });
  }

  private drawUI(state: GameState, nextGems: GemColor[]): void {
    // Draw Logo / Title
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = "bold 28px 'Outfit', 'Inter', sans-serif";
    this.ctx.textAlign = 'left';
    this.ctx.fillText('CHAIN DROP LAB', 20, 45);

    // Subtitle
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = "12px 'Inter', sans-serif";
    this.ctx.fillText('Dynamic Cascading Laboratory', 20, 65);

    // Left Panel: Mode & Status
    const panelY = 90;
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(20, panelY, 160, 200);
    this.ctx.strokeStyle = '#334155';
    this.ctx.strokeRect(20, panelY, 160, 200);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = "bold 16px 'Inter', sans-serif";
    this.ctx.fillText('GAME STATE', 30, panelY + 30);

    this.ctx.fillStyle = '#38bdf8'; // bright teal
    this.ctx.font = "bold 14px 'Inter', sans-serif";
    this.ctx.fillText(state.mode + ' MODE', 30, panelY + 60);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = "12px 'Inter', sans-serif";
    this.ctx.fillText('SCORE', 30, panelY + 90);
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = "bold 20px 'Outfit', 'Inter', sans-serif";
    this.ctx.fillText(state.score.toString(), 30, panelY + 115);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = "12px 'Inter', sans-serif";
    this.ctx.fillText('HIGH SCORE', 30, panelY + 145);
    this.ctx.fillStyle = '#fbbf24'; // gold
    this.ctx.font = "bold 20px 'Outfit', 'Inter', sans-serif";
    this.ctx.fillText(state.highScore.toString(), 30, panelY + 170);

    // Current Chain display
    if (state.chainCount > 0) {
      this.ctx.fillStyle = '#f43f5e'; // vivid rose pink
      this.ctx.font = "bold 24px 'Outfit', sans-serif";
      this.ctx.fillText(`${state.chainCount} CHAIN!`, 30, panelY + 225);
    }

    // Right Panel: Next Queue
    const rightX = 460;
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(rightX, 90, 100, 160);
    this.ctx.strokeStyle = '#334155';
    this.ctx.strokeRect(rightX, 90, 100, 160);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = "bold 14px 'Inter', sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.fillText('NEXT', rightX + 50, 115);

    if (nextGems && nextGems.length >= 2) {
      this.drawGemAt(150, rightX + 50, nextGems[0]);
      this.drawGemAt(200, rightX + 50, nextGems[1]);
    }

    // Controller Hints Panel
    const controlY = 310;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = "bold 12px 'Inter', sans-serif";
    this.ctx.fillText('CONTROLS:', 20, controlY);
    this.ctx.font = "11px 'Inter', sans-serif";
    this.ctx.fillText('Left/Right : Move Left/Right', 20, controlY + 20);
    this.ctx.fillText('Down      : Soft Drop', 20, controlY + 35);
    this.ctx.fillText('Z / X     : Rotate CCW / CW', 20, controlY + 50);
    this.ctx.fillText('Space     : Pause / Play', 20, controlY + 65);
    if (state.mode === 'PRACTICE' || state.mode === 'DEMO') {
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillText('Up        : Quick Drop', 20, controlY + 85);
    }

    // Game Over Overlay
    if (state.gameOver) {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.fillRect(this.boardOffsetX, this.boardOffsetY, BOARD_COLS * this.cellSize, BOARD_ROWS * this.cellSize);

      this.ctx.fillStyle = '#ef4444';
      this.ctx.font = "bold 32px 'Outfit', sans-serif";
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', this.boardOffsetX + (BOARD_COLS * this.cellSize) / 2, this.boardOffsetY + 180);

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = "14px 'Inter', sans-serif";
      this.ctx.fillText('Press SPACE to Restart', this.boardOffsetX + (BOARD_COLS * this.cellSize) / 2, this.boardOffsetY + 240);
    } else if (state.paused) {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      this.ctx.fillRect(this.boardOffsetX, this.boardOffsetY, BOARD_COLS * this.cellSize, BOARD_ROWS * this.cellSize);

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = "bold 28px 'Outfit', sans-serif";
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PAUSED', this.boardOffsetX + (BOARD_COLS * this.cellSize) / 2, this.boardOffsetY + 220);
    }
  }

  private drawGemAt(y: number, x: number, color: GemColor): void {
    const radius = 15;
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      x - radius / 3,
      y - radius / 3,
      radius / 10,
      x,
      y,
      radius
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, COLOR_MAP[color]);
    grad.addColorStop(1, '#000000');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.stroke();
    this.ctx.restore();
  }
}
