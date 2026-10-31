// Security hardening tests — COOP/COEP headers, cache content-type validation, grid bounds
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SW_SRC = readFileSync(resolve(__dirname, '../sw.js'), 'utf-8');
const HTML_SRC = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');
const GAME_SRC = readFileSync(resolve(__dirname, 'game.js'), 'utf-8');

describe('SW security headers', () => {
  it('includes Cross-Origin-Opener-Policy: same-origin', () => {
    expect(SW_SRC).toContain("'Cross-Origin-Opener-Policy': 'same-origin'");
  });

  it('includes Cross-Origin-Embedder-Policy: require-corp', () => {
    expect(SW_SRC).toContain("'Cross-Origin-Embedder-Policy': 'require-corp'");
  });

  it('includes Permissions-Policy header', () => {
    expect(SW_SRC).toContain("'Permissions-Policy':");
  });

  it('defines SAFE_CACHE_TYPES allowlist', () => {
    expect(SW_SRC).toContain('SAFE_CACHE_TYPES');
    expect(SW_SRC).toContain('text/html');
    expect(SW_SRC).toContain('application/javascript');
  });

  it('validates content-type before caching responses', () => {
    expect(SW_SRC).toContain("content-type");
    expect(SW_SRC).toContain('SAFE_CACHE_TYPES.has(ct)');
  });
});

describe('index.html security meta tags', () => {
  it('has Cross-Origin-Opener-Policy meta tag', () => {
    expect(HTML_SRC).toContain('Cross-Origin-Opener-Policy');
    expect(HTML_SRC).toContain('same-origin');
  });

  it('has Content-Security-Policy meta tag', () => {
    expect(HTML_SRC).toContain('Content-Security-Policy');
  });

  it('has X-Frame-Options DENY', () => {
    expect(HTML_SRC).toContain('X-Frame-Options');
    expect(HTML_SRC).toContain('DENY');
  });

  it('has Permissions-Policy meta tag', () => {
    expect(HTML_SRC).toContain('Permissions-Policy');
    expect(HTML_SRC).toContain('camera=()');
  });

  it('has SRI integrity attribute on CDN script', () => {
    expect(HTML_SRC).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
  });

  it('has crossorigin attribute on CDN script', () => {
    expect(HTML_SRC).toContain('crossorigin="anonymous"');
  });
});

describe('game.js input validation', () => {
  it('has bounds guard in swapBubbles', () => {
    expect(GAME_SRC).toContain('r1 < 0 || r1 >= GRID_ROWS');
    expect(GAME_SRC).toContain('c1 < 0 || c1 >= GRID_COLS');
  });

  it('has MAX_CHAIN_DEPTH recursion cap on processMatches', () => {
    expect(GAME_SRC).toContain('MAX_CHAIN_DEPTH');
    expect(GAME_SRC).toMatch(/depth > GameScene\.MAX_CHAIN_DEPTH/);
  });

  it('has VALID_MODES allowlist for gameMode', () => {
    expect(GAME_SRC).toContain('VALID_MODES');
    expect(GAME_SRC).toContain("Object.freeze(new Set(['timed', 'zen', 'daily'])");
  });

  it('uses safeScore to guard against NaN/Infinity in scoring', () => {
    expect(GAME_SRC).toContain('function safeScore');
    expect(GAME_SRC).toContain('Number.isFinite(n)');
  });

  it('uses safeDiv to guard against division by zero', () => {
    expect(GAME_SRC).toContain('function safeDiv');
  });

  it('counts totalPopped only for actually-popped bubbles, not power-up survivors', () => {
    // The old code did `totalPopped += group.length` BEFORE filtering out power-up
    // bubbles, inflating scores. The fix moves the increment inside the pop branch.
    expect(GAME_SRC).not.toMatch(/totalPopped\s*\+=\s*group\.length/);
    // Ensure totalPopped increments alongside popBubble, not before the filter
    expect(GAME_SRC).toMatch(/this\.popBubble\(bubble\);\s*\n\s*popIdx\+\+;\s*\n\s*totalPopped\+\+;/);
  });

  it('skips per-frame rendering when game is paused', () => {
    // update() must early-return on isPaused to avoid GPU work behind the pause overlay
    expect(GAME_SRC).toMatch(/update\(time\)\s*\{[^}]*if\s*\(this\.isPaused\)\s*return/s);
  });
});
