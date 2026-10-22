/**
 * Diagnose one published embed in a real browser.
 *
 *   node scripts/probe-game.mjs <path-under-/third-party/>
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = 4183;
const target = process.argv[2];

function findChrome() {
  const base = join(process.env.HOME ?? '', '.cache/hyperframes/chrome/chrome-headless-shell');
  if (existsSync(base)) {
    for (const v of readdirSync(base)) {
      const p = join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chrome found');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [join(root, 'scripts/serve-dist.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${port}/`)).ok) break;
  } catch {
    /* retry */
  }
  await sleep(100);
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 768 });
page.on('console', (m) => console.log(`  [console.${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e.message).slice(0, 300)}`));
page.on('response', (r) => {
  if (r.status() >= 400) console.log(`  [http ${r.status()}] ${r.url()}`);
});
page.on('requestfailed', (r) => console.log(`  [reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto(`http://localhost:${port}${target}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2000);

const before = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || b.value || '').trim()).filter(Boolean).slice(0, 12),
  text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
}));
console.log('before click:', JSON.stringify(before, null, 1));

const clicked = await page.evaluate(() => {
  // Dismiss an author's promo modal first - it covers the game.
  const modal = document.querySelector('.swal2-container, .swal2-popup');
  const modalBtn = modal?.querySelector('.swal2-confirm, .swal2-cancel, button');
  if (modalBtn) {
    modalBtn.click();
    return 'modal:' + (modalBtn.innerText || '').trim();
  }
  const b = [...document.querySelectorAll('button, input[type=button], input[type=submit]')].find((x) =>
    /start|play|begin|new game|launch/i.test(x.innerText || x.value || ''),
  );
  if (!b) return null;
  b.click();
  return (b.innerText || b.value || '').trim();
});
console.log('clicked:', clicked);
await sleep(2500);

const after = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  let pixels = 0;
  for (const c of canvases) {
    try {
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      const d = ctx.getImageData(0, 0, Math.min(c.width, 800), Math.min(c.height, 800)).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) pixels++;
    } catch {
      /* webgl */
    }
  }
  return {
    canvases: canvases.length,
    sizes: canvases.map((c) => `${c.width}x${c.height}`),
    pixels,
    text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
  };
});
console.log('after click:', JSON.stringify(after, null, 1));

await browser.close();
server.kill();
