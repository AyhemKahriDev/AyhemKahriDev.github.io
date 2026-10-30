/* spielkunst offline shell.
   Navigations are network-first (so a deploy is picked up immediately) with a
   cached fallback; every other same-origin GET is stale-while-revalidate, so
   a game you have played once still opens with no connection.

   The cache name carries the deploy's asset hash, replaced at build time by
   scripts/build-site.mjs. Every deploy therefore starts a new cache and
   activate() throws the previous one away - a fixed name kept first-visit
   copies of styles.css and ui.js around for as long as the browser kept the
   cache, and nothing ever evicted them. */

const CACHE = 'sk-__AF_VERSION__';
const SHELL = [
  '/',
  '/games/',
  '/styles.css',
  '/fonts.css',
  '/ui.js',
  // The play layer is what makes a game usable on a phone; a cached page
  // without it opens into an unplayable frame when offline.
  '/play.js',
  '/favicon.svg',
];

/* Keeps the cache from growing without limit: 153 games plus art is a lot of
   megabytes on a phone. */
const MAX_ENTRIES = 140;

/* How long a navigation waits for the network before using the cache. A
   captive portal or a dying 3G connection can otherwise hang the first paint
   for the browser's own timeout. */
const NAV_TIMEOUT = 3500;

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline — spielkunst</title>
<style>
  html{background:#08090a;color:#f6f3eb;font:16px/1.5 system-ui,sans-serif}
  body{min-height:100dvh;display:grid;place-items:center;margin:0;padding:24px;text-align:center}
  h1{font-size:26px;margin:0 0 8px}
  p{color:#a8a9ad;margin:0 0 20px;max-width:34ch}
  a{display:inline-block;padding:12px 20px;border-radius:12px;background:#c9f94b;color:#08090a;font-weight:700;text-decoration:none}
</style></head>
<body><main>
  <h1>No connection</h1>
  <p>This page has not been played on this device yet. Anything you have already opened still works offline.</p>
  <a href="/">Back to the arcade</a>
</main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Drop the oldest entries once the cache is over its budget. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Partial responses cannot be replayed from the cache.
  if (req.headers.has('range')) return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const fallback = () => {
          if (settled) return;
          settled = true;
          caches
            .match(req)
            .then((hit) => hit || caches.match('/'))
            .then((hit) => hit || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }))
            .then(resolve);
        };
        const timer = setTimeout(fallback, NAV_TIMEOUT);
        fetch(req)
          .then((res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (res && res.ok) {
              const copy = res.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(req, copy))
                .catch(() => undefined);
            }
            resolve(res);
          })
          .catch(() => {
            clearTimeout(timer);
            fallback();
          });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          // Only a complete, successful response is worth storing: a 404 or a
          // 206 body would poison the cache with something that can never be
          // served.
          if (res && res.ok && res.status === 200 && res.type !== 'opaque') {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(req, copy).then(() => trim(cache)))
              .catch(() => undefined);
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
