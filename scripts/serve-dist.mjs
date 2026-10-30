/** Minimal static file server for local preview and smoke tests. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT ?? 4178);
// 0.0.0.0 makes the build reachable from a phone on the same network, which is
// the only honest way to test a touch bug. The default stays loopback.
const host = process.env.HOST ?? '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  // Without these the local gate lies: an Emscripten game gets
  // "Incorrect response MIME type. Expected 'application/wasm'" from the
  // streaming compiler and is reported FAIL, while Cloudflare serves the same
  // file correctly and the deployed page works. A gate that fails on the
  // harness teaches people to ignore it.
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

/**
 * The production response headers, copied from `public/_headers`.
 *
 * Without them the local gates are optimistic: Cloudflare serves every page
 * with this CSP, so a game that pulls its engine from a CDN, injects an inline
 * handler or opens a socket to another host passes `npm run smoke` here and
 * then dies in production. Twenty published games were in exactly that state on
 * 2026-10-30. A gate that does not apply the policy it is gating is not a gate.
 */
const HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline' blob:; worker-src 'self' blob:; font-src 'self'; " +
    "frame-src 'self'; connect-src 'self'; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'",
};

/**
 * The `/third-party/*` policy from `public/_headers`. Foreign games load their
 * engine from a CDN and eval; the strict policy above blanks them. Containment
 * is the iframe sandbox, not this header, so the game subtree gets the looser
 * policy - and the local gates must serve the same thing or they certify pages
 * that are dead in production.
 */
const GAME_HEADERS = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob: https: http:; " +
    "style-src 'self' 'unsafe-inline' https: http:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; " +
    "font-src 'self' data: https: http:; media-src 'self' data: blob: https: http:; " +
    "connect-src 'self' blob: data: https: http: ws: wss:; worker-src 'self' blob:; " +
    "object-src 'none'; base-uri 'self'; " +
    "form-action 'self'",
};

const headersFor = (urlPath) =>
  urlPath.startsWith('/third-party/') ? { ...HEADERS, ...GAME_HEADERS } : HEADERS;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    let file = join(root, path);
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, '404.html');
    }
    const body = await readFile(file);
    res.writeHead(file.endsWith('404.html') ? 404 : 200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      ...headersFor(req.url ?? '/'),
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(port, host, () => {
  console.log(`spielkunst dist served on http://${host === '0.0.0.0' ? '<lan-ip>' : host}:${port}`);
});
