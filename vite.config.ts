import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // `plugins: []` is explicit on purpose - some tooling that inspects this
  // config (Cloudflare's framework detector) fails on a missing array.
  plugins: [cloudflare()],
  root: r('./src'),
  publicDir: r('./public'),
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: { host: r('./src/host.ts') },
      output: {
        // Content-hashed entry name. /assets/* is served `immutable` with a
        // one-year max-age, so a fixed name would pin the old game bundle in
        // every returning visitor's cache for a year after a deploy. The site
        // builder discovers the real filename.
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});