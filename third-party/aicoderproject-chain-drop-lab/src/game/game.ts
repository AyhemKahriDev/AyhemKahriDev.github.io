import { Board, BOARD_ROWS, BOARD_COLS } from './board';
import { Renderer } from './render';
import { SoundManager } from './audio';
import { SafeStorage } from './storage';
import { GameState, GameMode, Gem, GemColor } from './types';

export class Game {
  private board: Board;
  private renderer: Renderer;
  public state: GameState;

  // Active falling pair: [0] is axis gem, [1] is sub gem
  private activeGems: Gem[] = [];
  private nextGemColors: GemColor[] = [];

  // Drop timings
  private lastDropTime = 0;
  private dropInterval = 1000; // ms

  // Game loop controls
  private animFrameId = 0;
  private isProcessingChain = false;
  private currentChainStep = 0;

  // Rotation orientation: 0 = Up, 1 = Right, 2 = Down, 3 = Left
  private subGemOrientation = 0;

  private demoMovesQueue: { x: number; rot: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.board = new Board();
    this.renderer = new Renderer(canvas);

    const savedHighScore = SafeStorage.getItem('highScore');
    this.state = {
      score: 0,
      highScore: savedHighScore ? parseInt(savedHighScore, 10) : 0,
      chainCount: 0,
      maxChainCount: 0,
      level: 1,
      gameOver: false,
      paused: false,
      mode: 'NORMAL',
    };

    this.initInput();
    this.startNewGame('NORMAL');
  }

  public startNewGame(mode: GameMode): void {
    this.board.clear();
    this.renderer.particles = [];
    this.renderer.floatingTexts = [];
    this.state.score = 0;
    this.state.chainCount = 0;
    this.state.gameOver = false;
    this.state.paused = false;
    this.state.mode = mode;

    this.demoMovesQueue = [];

    // Set colors according to mode
    if (mode === 'BOOST') {
      this.dropInterval = 800; // slightly faster but super easy
    } else if (mode === 'DEMO') {
      this.dropInterval = 400; // fast show
      this.setupDemoChainQueue();
    } else {
      this.dropInterval = 1000;
    }

    this.generateNextColors();
    this.spawnGems();
    this.lastDropTime = performance.now();
  }

  private generateNextColors(): void {
    this.nextGemColors = [this.getRandomColor(), this.getRandomColor()];
  }

  private getRandomColor(): GemColor {
    // Boost mode only uses 3 colors for crazy connection rates
    const colors: GemColor[] = this.state.mode === 'BOOST' 
      ? ['red', 'blue', 'green'] 
      : ['red', 'blue', 'green', 'yellow', 'purple'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private spawnGems(): void {
    if (this.board.isGameOver()) {
      this.state.gameOver = true;
      SoundManager.playGameOver();
      // Save high score
      if (this.state.score > this.state.highScore) {
        this.state.highScore = this.state.score;
        SafeStorage.setItem('highScore', this.state.highScore.toString());
      }
      return;
    }

    const c1 = this.nextGemColors[0];
    const c2 = this.nextGemColors[1];
    this.generateNextColors();

    // spawn at middle columns: col 2 is axis, col 3 is sub gem
    this.activeGems = [
      { id: 'act1_' + Math.random(), color: c1, x: 2, y: 0, animY: 0, isNew: true },
      { id: 'act2_' + Math.random(), color: c2, x: 3, y: 0, animY: 0, isNew: true },
    ];
    this.subGemOrientation = 1; // Sub-gem is to the right of axis (col 3 vs col 2)
  }

  private setupDemoChainQueue(): void {
    // Generate moves that will build a perfect cascade (staircase style)
    // We stack gems of specific columns so that when the final piece drops, a 10+ chain triggers.
    // In order to make it look professional, we feed a preset array of (targetCol, targetRotation).
    
    // We want to drop a sequence of pieces. Let's make a beautiful 12-pair preset.
    // 0 = Up, 1 = Right, 2 = Down, 3 = Left
    this.demoMovesQueue = [
      { x: 0, rot: 1 }, // red & blue
      { x: 1, rot: 1 }, 
      { x: 2, rot: 1 },
      { x: 0, rot: 1 }, 
      { x: 1, rot: 1 }, 
      { x: 2, rot: 1 },
      { x: 3, rot: 1 }, 
      { x: 4, rot: 1 }, 
      { x: 5, rot: 1 },
      { x: 3, rot: 1 }, 
      { x: 4, rot: 1 }, 
      { x: 5, rot: 1 },
    ];
    
    // Override random colors for Demo to guarantee exact matches
    // We want columns 0, 1, 2 to stack: Red, Green, Blue, Yellow, Purple in staircase
    // For simplicity, let's inject a pre-calculated deck of colors
    const colorsDeck: GemColor[] = [];
    const colorCycle: GemColor[] = ['red', 'blue', 'green', 'yellow', 'purple'];
    
    for (let i = 0; i < 50; i++) {
      colorsDeck.push(colorCycle[i % colorCycle.length]);
    }
    
    // Replace the random color generator for demo mode
    this.getRandomColor = () => {
      const c = colorsDeck.shift();
      if (!c) return 'red';
      return c;
    };
  }

  private initInput(): void {
    window.addEventListener('keydown', (e) => {
      // Prevent default page scroll behaviors for typical game keys
      const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyZ', 'KeyX', 'KeyP'];
      if (gameKeys.includes(e.code)) {
        e.preventDefault();
      }

      if (this.state.gameOver || this.state.paused || this.isProcessingChain) {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.handleSpaceKey();
        } else if (e.code === 'KeyP' && !this.state.gameOver && !this.isProcessingChain) {
          this.handleSpaceKey();
        }
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
          this.moveActive(-1);
          break;
        case 'ArrowRight':
          this.moveActive(1);
          break;
        case 'ArrowDown':
          this.softDrop();
          break;
        case 'ArrowUp':
          if (this.state.mode === 'PRACTICE' || this.state.mode === 'DEMO') {
            this.quickDrop();
          }
          break;
        case 'KeyZ':
          this.rotateActive(-1);
          break;
        case 'KeyX':
          this.rotateActive(1);
          break;
        case 'Space':
        case 'Enter':
        case 'KeyP':
          this.handleSpaceKey();
          break;
      }
    });

    // Touch/Mouse Input to fulfill standard interface support requirement
    window.addEventListener('pointerdown', (e) => {
      if (this.state.gameOver || this.state.paused || this.isProcessingChain) return;

      const screenX = e.clientX;
      const screenY = e.clientY;
      const halfWidth = window.innerWidth / 2;
      const bottomHeight = window.innerHeight * 0.75;

      if (screenY > bottomHeight) {
        this.softDrop();
      } else if (screenX < halfWidth - 100) {
        this.moveActive(-1);
      } else if (screenX > halfWidth + 100) {
        this.moveActive(1);
      } else {
        this.rotateActive(1);
      }
    });
  }

  private handleSpaceKey(): void {
    if (this.state.gameOver) {
      this.startNewGame(this.state.mode);
    } else {
      this.state.paused = !this.state.paused;
    }
  }

  private moveActive(dx: number): void {
    const [axis, sub] = this.activeGems;
    const nextAxisX = axis.x + dx;
    const nextSubX = sub.x + dx;

    // Check bounds
    if (nextAxisX < 0 || nextAxisX >= BOARD_COLS || nextSubX < 0 || nextSubX >= BOARD_COLS) return;

    // Check grid collision
    if (this.board.getCell(axis.y, nextAxisX) || this.board.getCell(sub.y, nextSubX)) return;

    axis.x = nextAxisX;
    sub.x = nextSubX;
    SoundManager.playMove();
  }

  private rotateActive(dir: number): void {
    const [axis, sub] = this.activeGems;
    
    // Orientation: 0=Up, 1=Right, 2=Down, 3=Left
    const nextOrientation = (this.subGemOrientation + dir + 4) % 4;
    let nextSubX = axis.x;
    let nextSubY = axis.y;

    if (nextOrientation === 0) { // Up
      nextSubY = axis.y - 1;
    } else if (nextOrientation === 1) { // Right
      nextSubX = axis.x + 1;
    } else if (nextOrientation === 2) { // Down
      nextSubY = axis.y + 1;
    } else if (nextOrientation === 3) { // Left
      nextSubX = axis.x - 1;
    }

    // Check bounds & wall kick
    if (nextSubX < 0) {
      // Kick right
      if (axis.x + 1 < BOARD_COLS && !this.board.getCell(axis.y, axis.x + 1)) {
        axis.x += 1;
        nextSubX += 1;
      } else {
        return;
      }
    } else if (nextSubX >= BOARD_COLS) {
      // Kick left
      if (axis.x - 1 >= 0 && !this.board.getCell(axis.y, axis.x - 1)) {
        axis.x -= 1;
        nextSubX -= 1;
      } else {
        return;
      }
    }

    if (nextSubY >= BOARD_ROWS || this.board.getCell(nextSubY, nextSubX)) {
      // Cannot rotate due to collision
      return;
    }

    sub.x = nextSubX;
    sub.y = nextSubY;
    sub.animY = nextSubY;
    this.subGemOrientation = nextOrientation;
    SoundManager.playRotate();
  }

  private softDrop(): void {
    const [axis, sub] = this.activeGems;
    const nextAxisY = axis.y + 1;
    const nextSubY = sub.y + 1;

    let hitGround = false;
    if (nextAxisY >= BOARD_ROWS || this.board.getCell(nextAxisY, axis.x)) hitGround = true;
    if (nextSubY >= BOARD_ROWS || this.board.getCell(nextSubY, sub.x)) hitGround = true;

    if (hitGround) {
      this.lockActiveGems();
    } else {
      axis.y = nextAxisY;
      sub.y = nextSubY;
      axis.animY = nextAxisY;
      sub.animY = nextSubY;
      this.state.score += 1; // Soft drop bonus points
      SoundManager.playMove();
    }
  }

  private quickDrop(): void {
    // Drop all the way down instantly
    while (true) {
      const [axis, sub] = this.activeGems;
      const nextAxisY = axis.y + 1;
      const nextSubY = sub.y + 1;
      let collides = false;
      if (nextAxisY >= BOARD_ROWS || this.board.getCell(nextAxisY, axis.x)) collides = true;
      if (nextSubY >= BOARD_ROWS || this.board.getCell(nextSubY, sub.x)) collides = true;

      if (collides) {
        this.lockActiveGems();
        break;
      } else {
        axis.y = nextAxisY;
        sub.y = nextSubY;
        axis.animY = nextAxisY;
        sub.animY = nextSubY;
      }
    }
  }

  private lockActiveGems(): void {
    // Sort so the lower gem locks first
    const gemsToPlace = [...this.activeGems].sort((a, b) => b.y - a.y);
    gemsToPlace.forEach(gem => {
      this.board.placeGem(gem);
    });

    this.activeGems = [];
    SoundManager.playDrop();
    
    // Start match check & chain sequence
    this.isProcessingChain = true;
    this.currentChainStep = 0;
    this.state.chainCount = 0;
    this.processChainStep();
  }

  private processChainStep(): void {
    const matches = this.board.findMatches();

    if (matches.length > 0) {
      this.currentChainStep++;
      this.state.chainCount = this.currentChainStep;
      if (this.state.chainCount > this.state.maxChainCount) {
        this.state.maxChainCount = this.state.chainCount;
      }

      // Add scores and trigger sounds
      const baseCleared = matches.length;
      const chainMultiplier = Math.pow(2, this.currentChainStep - 1);
      const scoreGained = baseCleared * 10 * chainMultiplier;
      this.state.score += scoreGained;

      SoundManager.playClear(this.currentChainStep);

      // Camera shake based on chain
      const shakeAmt = Math.min(2 + this.currentChainStep * 3, 20);
      const shakeDuration = Math.min(10 + this.currentChainStep * 5, 45);
      this.renderer.triggerShake(shakeDuration, shakeAmt);

      // Create clear particles & floating text
      matches.forEach(m => {
        const gem = this.board.getCell(m.r, m.c);
        if (gem) {
          this.renderer.addClearParticles(m.r, m.c, gem.color);
        }
      });

      // Special display text for high chains
      let text = `${this.currentChainStep} CHAIN!`;
      let color = '#38bdf8';
      let size = 32;

      if (this.currentChainStep >= 5) {
        text = `💥 SUPER ${this.currentChainStep} CHAIN!`;
        color = '#fbbf24'; // Golden
        size = 38;
      }
      if (this.currentChainStep >= 10) {
        text = `🔥 LAB CASCADE! ${this.currentChainStep} CHAIN!`;
        color = '#f43f5e'; // Flame red-rose
        size = 46;
      }
      this.renderer.addFloatingText(text, size, color);

      // Clear the actual gems
      this.board.clearGems(matches);

      // Wait a short time for visual clear, then apply gravity
      setTimeout(() => {
        this.board.applyGravity();
        // Wait for gravity falling animation before doing next match scan
        setTimeout(() => {
          this.processChainStep();
        }, 300);
      }, 400);

    } else {
      // Chain finished
      this.isProcessingChain = false;
      this.state.chainCount = 0;
      this.spawnGems();
    }
  }

  // AI auto-play for Demo Chain Mode
  private runDemoAI(): void {
    if (this.isProcessingChain || this.activeGems.length === 0) return;

    if (this.demoMovesQueue.length > 0) {
      const targetMove = this.demoMovesQueue[0];
      const [axis] = this.activeGems;

      // Adjust rotation first
      if (this.subGemOrientation !== targetMove.rot) {
        this.rotateActive(1);
        return;
      }

      // Adjust X coordinate next
      if (axis.x < targetMove.x) {
        this.moveActive(1);
      } else if (axis.x > targetMove.x) {
        this.moveActive(-1);
      } else {
        // Correct position and rotation reached: perform drop
        this.demoMovesQueue.shift(); // remove processed move
        this.quickDrop();
      }
    } else {
      // Out of preset queue: refill or just randomly place
      this.quickDrop();
    }
  }

  public update(time: number): void {
    if (this.state.gameOver || this.state.paused) return;

    // Handle Active Dropping Gems
    if (!this.isProcessingChain && this.activeGems.length > 0) {
      // AI check for Demo Mode
      if (this.state.mode === 'DEMO') {
        this.runDemoAI();
      } else {
        // standard soft gravity
        if (time - this.lastDropTime > this.dropInterval) {
          this.softDrop();
          this.lastDropTime = time;
        }
      }
    }

    // Smooth Y animation coordinates
    const lerpSpeed = 0.2;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const gem = this.board.getCell(r, c);
        if (gem) {
          gem.animY += (gem.y - gem.animY) * lerpSpeed;
        }
      }
    }

    this.activeGems.forEach(gem => {
      gem.animY += (gem.y - gem.animY) * lerpSpeed;
    });

    this.renderer.updateEffects();
  }

  public render(): void {
    this.renderer.draw(this.board, this.activeGems, this.nextGemColors, this.state);
  }

  public loop(time: number): void {
    this.update(time);
    this.render();
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  public start(): void {
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  public stop(): void {
    cancelAnimationFrame(this.animFrameId);
  }
}
