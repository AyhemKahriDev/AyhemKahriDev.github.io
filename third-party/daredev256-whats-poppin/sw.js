// Service Worker for offline play
const CACHE_NAME = 'whatspoppin-v5';

// Canonical CSP — applied to all served responses (cached, synthesized, and offline)
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

// Security headers injected on every same-origin response
const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Content-types safe to cache — rejects unexpected MIME types from cache poisoning. */
const SAFE_CACHE_TYPES = new Set([
  'text/html', 'text/css', 'text/javascript', 'application/javascript',
  'application/json', 'image/png', 'image/svg+xml', 'image/jpeg',
  'image/webp', 'font/woff2', 'application/wasm',
]);

/**
 * Clone a response with security headers injected.
 * CDN responses (cross-origin) are returned as-is since
 * modifying opaque responses would break SRI verification.
 */
function hardenResponse(response) {
  // Don't modify cross-origin (opaque) responses — breaks SRI
  if (response.type === 'opaque' || response.type === 'opaqueredirect') {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const ASSETS = [
  '/',
  '/index.html',
  '/src/init.js',
  '/src/game.js',
  '/src/audio.js',
  '/src/icons.js',
  '/src/powerups.js',
  '/src/characters.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return hardenResponse(cached);
      return fetch(event.request).then((response) => {
        // Only cache same-origin or approved CDN responses with valid content-types
        if (response && response.status === 200) {
          const url = new URL(event.request.url);
          const ct = (response.headers.get('content-type') || '').split(';')[0].trim();
          const originOk = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';
          if (originOk && (!ct || SAFE_CACHE_TYPES.has(ct))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }
        return hardenResponse(response);
      }).catch(() => {
        // Network failure with no cache — return a hardened offline response
        if (event.request.destination === 'document') {
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Offline — What\'s Poppin</title>' +
            '<style>body{background:#0a0a0f;color:#e0e0e0;font-family:system-ui,sans-serif;' +
            'display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;' +
            'text-align:center}h1{font-size:1.5rem;margin-bottom:.5rem}p{opacity:.6;font-size:.9rem}</style>' +
            '</head><body><div><h1>You\'re Offline</h1>' +
            '<p>Reconnect and reload to keep poppin\'.</p></div></body></html>',
            {
              headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                ...SECURITY_HEADERS,
              },
            }
          );
        }
        return new Response('', { status: 503, headers: SECURITY_HEADERS });
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
