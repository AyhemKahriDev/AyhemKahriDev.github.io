import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Package the original game and shared entrance alongside the independent 3D game.
function editions(): Plugin {
  const files = [
    'index.html',
    'classic.html',
    'style.css',
    'sw.js',
    'manifest.webmanifest',
    ...['js', 'icons', 'selection'].flatMap((dir) =>
      readdirSync(resolve(projectRoot, dir)).map((name) => `${dir}/${name}`),
    ),
  ];
  function source(file: string) {
    const bytes = readFileSync(resolve(projectRoot, file));
    return file === 'index.html'
      ? Buffer.from(bytes.toString().replace('Delta-Strike-3d/dist/3d.html', '3d.html'))
      : bytes;
  }
  return {
    name: 'delta-strike-editions',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const file = pathname === '/' ? 'index.html' : pathname.slice(1);
        if (!files.includes(file)) return next();
        const mime: Record<string, string> = {
          html: 'text/html; charset=utf-8',
          css: 'text/css',
          js: 'text/javascript',
          png: 'image/png',
          jpg: 'image/jpeg',
          webmanifest: 'application/manifest+json',
        };
        res.setHeader('Content-Type', mime[file.split('.').pop()!] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        // Keep development navigation live while still exercising the real service worker in preview.
        if (file === 'sw.js') {
          res.end(
            "self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));",
          );
        } else res.end(source(file));
      });
    },
    generateBundle() {
      for (const file of files)
        this.emitFile({ type: 'asset', fileName: file, source: source(file) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [editions()],
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./3d.html', import.meta.url)),
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
