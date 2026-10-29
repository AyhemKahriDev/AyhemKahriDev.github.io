// What's Poppin — Service Worker Test Suite
// Tests: hardenResponse, fetch strategy, offline fallback, cache lifecycle, CSP headers

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── SW constants (mirrored from sw.js for isolated testing) ──────
const CACHE_NAME = 'whatspoppin-v7';

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const OFFLINE_CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const ASSETS = [
  '/', '/index.html', '/manifest.json', '/src/styles.css',
  '/src/init.js', '/src/game.js', '/src/audio.js', '/src/icons.js',
  '/src/powerups.js', '/src/characters.js', '/src/offline.css',
  'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
];

// ── hardenResponse (extracted from sw.js) ────────────────────────
function hardenResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (response.headers.get('content-type')?.includes('text/html')) {
    headers.set('Content-Security-Policy', CSP_POLICY);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ══════════════════════════════════════════════════════════════════
// CSP POLICY INTEGRITY
// ══════════════════════════════════════════════════════════════════
describe('CSP Policy constants', () => {
  it('CSP_POLICY includes all required directives', () => {
    const required = [
      'default-src', 'script-src', 'style-src', 'img-src',
      'connect-src', 'font-src', 'media-src', 'worker-src',
      'base-uri', 'form-action', 'frame-ancestors',
    ];
    required.forEach(dir => {
      expect(CSP_POLICY).toContain(dir);
    });
  });

  it('CSP_POLICY blocks frames (clickjacking protection)', () => {
    expect(CSP_POLICY).toContain("frame-ancestors 'none'");
  });

  it('CSP_POLICY allows only self and jsdelivr for scripts', () => {
    expect(CSP_POLICY).toContain("script-src 'self' https://cdn.jsdelivr.net");
    expect(CSP_POLICY).not.toContain('unsafe-inline');
    expect(CSP_POLICY).not.toContain('unsafe-eval');
  });

  it('OFFLINE_CSP is maximally restrictive', () => {
    expect(OFFLINE_CSP).toContain("default-src 'none'");
    expect(OFFLINE_CSP).not.toContain('script-src');
    expect(OFFLINE_CSP).not.toContain('unsafe-inline');
  });

  it('OFFLINE_CSP allows only self-hosted styles', () => {
    expect(OFFLINE_CSP).toContain("style-src 'self'");
  });
});

// ══════════════════════════════════════════════════════════════════
// ASSET MANIFEST
// ══════════════════════════════════════════════════════════════════
describe('ASSETS manifest', () => {
  it('includes index.html and root route', () => {
    expect(ASSETS).toContain('/');
    expect(ASSETS).toContain('/index.html');
  });

  it('includes all source modules', () => {
    const srcFiles = [
      '/src/init.js', '/src/game.js', '/src/audio.js',
      '/src/icons.js', '/src/powerups.js', '/src/characters.js',
    ];
    srcFiles.forEach(f => expect(ASSETS).toContain(f));
  });

  it('includes offline.css for fallback page', () => {
    expect(ASSETS).toContain('/src/offline.css');
  });

  it('pins Phaser CDN to exact version (no floating)', () => {
    const phaserUrl = ASSETS.find(a => a.includes('phaser'));
    expect(phaserUrl).toBeDefined();
    expect(phaserUrl).toMatch(/phaser@3\.\d+\.\d+/);
    expect(phaserUrl).not.toContain('^');
    expect(phaserUrl).not.toContain('~');
  });

  it('has no duplicate entries', () => {
    expect(new Set(ASSETS).size).toBe(ASSETS.length);
  });
});

// ══════════════════════════════════════════════════════════════════
// hardenResponse — SECURITY HEADER INJECTION
// ══════════════════════════════════════════════════════════════════
describe('hardenResponse', () => {
  it('adds X-Content-Type-Options: nosniff to any response', () => {
    const original = new Response('body', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('injects full CSP on HTML responses', () => {
    const original = new Response('<html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('Content-Security-Policy')).toBe(CSP_POLICY);
  });

  it('does NOT inject CSP on non-HTML responses', () => {
    const original = new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('does NOT inject CSP on CSS responses', () => {
    const original = new Response('body{}', {
      status: 200,
      headers: { 'Content-Type': 'text/css' },
    });
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('preserves original status code', () => {
    const original = new Response('', { status: 206, statusText: 'Partial Content' });
    const hardened = hardenResponse(original);
    expect(hardened.status).toBe(206);
    expect(hardened.statusText).toBe('Partial Content');
  });

  it('preserves original headers while adding security ones', () => {
    const original = new Response('x', {
      headers: { 'X-Custom': 'keep-me', 'Content-Type': 'text/plain' },
    });
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('X-Custom')).toBe('keep-me');
    expect(hardened.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('handles response with no content-type header gracefully', () => {
    const original = new Response('raw');
    const hardened = hardenResponse(original);
    expect(hardened.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(hardened.headers.get('Content-Security-Policy')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// OFFLINE FALLBACK RESPONSE
// ══════════════════════════════════════════════════════════════════
describe('Offline fallback response', () => {
  // Simulates what the SW builds when network fails for a document request
  function buildOfflineResponse() {
    return new Response(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Offline — What\'s Poppin</title>' +
      '<link rel="stylesheet" href="/src/offline.css">' +
      '</head><body><div><h1>You\'re Offline</h1>' +
      '<p>Reconnect and reload to keep poppin\'.</p></div></body></html>',
      {
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Content-Security-Policy': OFFLINE_CSP,
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }

  function buildNonDocumentFallback() {
    return new Response('', {
      status: 503,
      headers: { 'X-Content-Type-Options': 'nosniff' },
    });
  }

  it('offline HTML includes nosniff header', () => {
    const res = buildOfflineResponse();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('offline HTML uses restrictive OFFLINE_CSP', () => {
    const res = buildOfflineResponse();
    expect(res.headers.get('Content-Security-Policy')).toBe(OFFLINE_CSP);
  });

  it('offline HTML references offline.css', async () => {
    const res = buildOfflineResponse();
    const body = await res.text();
    expect(body).toContain('offline.css');
  });

  it('offline HTML is valid with DOCTYPE and lang', async () => {
    const res = buildOfflineResponse();
    const body = await res.text();
    expect(body).toMatch(/^<!DOCTYPE html>/);
    expect(body).toContain('lang="en"');
  });

  it('non-document fallback returns 503', () => {
    const res = buildNonDocumentFallback();
    expect(res.status).toBe(503);
  });

  it('non-document fallback has nosniff', () => {
    const res = buildNonDocumentFallback();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('non-document fallback body is empty', async () => {
    const res = buildNonDocumentFallback();
    const body = await res.text();
    expect(body).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════════
// CACHE NAME VERSIONING
// ══════════════════════════════════════════════════════════════════
describe('Cache versioning', () => {
  it('CACHE_NAME follows whatspoppin-vN format', () => {
    expect(CACHE_NAME).toMatch(/^whatspoppin-v\d+$/);
  });

  it('activate prune logic filters correctly', () => {
    // Simulates the activate filter — all keys except current get deleted
    const keys = ['whatspoppin-v5', 'whatspoppin-v6', CACHE_NAME, 'other-cache'];
    const toDelete = keys.filter(k => k !== CACHE_NAME);
    expect(toDelete).toEqual(['whatspoppin-v5', 'whatspoppin-v6', 'other-cache']);
    expect(toDelete).not.toContain(CACHE_NAME);
  });

  it('activate prune keeps current cache when it is the only one', () => {
    const keys = [CACHE_NAME];
    const toDelete = keys.filter(k => k !== CACHE_NAME);
    expect(toDelete).toHaveLength(0);
  });
});
