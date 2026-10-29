// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../game/game';

describe('Game Modes and State Management', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Mock basic document canvas environment
    canvas = document.createElement('canvas');
    canvas.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn()
      }),
    });
    
    // Mock requestAnimationFrame to prevent async loop delays during testing
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      // Just run once or instantly mock
      return 1;
    });
  });

  it('should initialize game state in normal mode', () => {
    const game = new Game(canvas);
    expect(game.state.gameOver).toBe(false);
    expect(game.state.score).toBe(0);
    expect(game.state.mode).toBe('NORMAL');
  });

  it('should transition game modes correctly', () => {
    const game = new Game(canvas);
    
    game.startNewGame('BOOST');
    expect(game.state.mode).toBe('BOOST');
    
    game.startNewGame('DEMO');
    expect(game.state.mode).toBe('DEMO');
    
    game.startNewGame('PRACTICE');
    expect(game.state.mode).toBe('PRACTICE');
  });

  it('should restrict color palette in BOOST mode to 3 colors', () => {
    const game = new Game(canvas);
    game.startNewGame('BOOST');

    // Access private or internal color generation using prototype / type assertions
    // To verify color restriction, let's gather multiple colors generated from game's getRandomColor
    const colorsGenerated = new Set<string>();
    
    // Invoke game's color generator multiple times
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getRandomColor = (game as any).getRandomColor.bind(game);
    for (let i = 0; i < 100; i++) {
      colorsGenerated.add(getRandomColor());
    }

    expect(colorsGenerated.size).toBeLessThanOrEqual(3);
    expect(colorsGenerated.has('yellow')).toBe(false);
    expect(colorsGenerated.has('purple')).toBe(false);
  });

  it('should load preset AI moves in DEMO mode', () => {
    const game = new Game(canvas);
    game.startNewGame('DEMO');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const demoMovesQueue = (game as any).demoMovesQueue;
    expect(demoMovesQueue.length).toBeGreaterThan(0);
    expect(demoMovesQueue[0]).toHaveProperty('x');
    expect(demoMovesQueue[0]).toHaveProperty('rot');
  });

  it('should handle keyboard controls correctly', () => {
    const game = new Game(canvas);
    
    // Simulate ArrowLeft keydown to move active gem left
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalX = (game as any).activeGems[0].x;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    
    // Gem axis X should decrease by 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((game as any).activeGems[0].x).toBe(originalX - 1);

    // Simulate KeyP down to trigger pause state
    expect(game.state.paused).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    expect(game.state.paused).toBe(true);
  });
});
