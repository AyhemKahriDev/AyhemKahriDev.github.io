// One-off splice: replace validate() in harvest-games.mjs with a coherent,
// restart-resilient implementation. Run: node scripts/fix-validate-splice.mjs
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const file = '/home/ayhem/Projects/arcadefork/scripts/harvest-games.mjs';
copyFileSync(file, file + '.bak');

const src = readFileSync(file, 'utf8');
const start = src.indexOf('async function validate() {');
const end = src.indexOf('/* ---------------------------------------------------------- generate */');
if (start === -1 || end === -1 || end < start) {
  console.error('markers not found');
  process.exit(1);
}

const replacement = `async function validate() {
  const vendored = readJson(join(work, 'vendored.json'), []);
  if (!vendored.length) {
    console.log('validate: nothing vendored yet');
    return [];
  }

  const port = process.env.HARVEST_PORT ?? 4191;
  const { spawn } = await import('node:child_process');

  const serverHealth = async () => {
    try {
      // Check a file that exists - the repo root itself has no index.html.
      const res = await fetch(\\\`http://localhost:\\\${port}/package.json\\\`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const startServer = () => {
    // detached: the server survives if the parent is killed by an environment
    // restart, so a half-finished pass can resume instead oflosing everything.
    const s = spawn(process.execPath, [join(root, 'scripts/serve-root.mjs')], {
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
      detached: true,
    });
    s.unref();
    return s;
  };

  const ensureServer = async () => {
    if (await serverHealth()) return true;
    console.error('\\n  static server died - restarting it');
    startServer();
    for (let i = 0; i < 40; i++) {
      if (await serverHealth()) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

  if (!(await ensureServer())) {
    console.error(\`validate: static server on :\${port} never came up. Nothing was deleted.\`);
    process.exit(1);
  }

  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const passed = [];
  const rejected = [];
  const inconclusive = [];
  let index = 0;

  for (const v of vendored) {
    index++;
    const dir = join(thirdParty, v.slug);
    if (!existsSync(join(dir, 'index.html'))) continue; // pruned or never vendored
    if (readJson(join(dir, '.harvested.json'), {}).validated) {
      // Already passed an earlier pass - keep it without re-testing.
      passed.push(v);
      continue;
    }
    // The server dies when this environment restarts. Check every 20 games so
    // a death costs at most 20 results, never the whole run.
    if (index % 20 === 0) await ensureServer();

    let verdict = ''; // 'pass' | 'dead' | ''
    let lastReason = '';

    for (let attempt = 0; attempt < 2 && !verdict; attempt++) {
      if (attempt > 0 && !(await ensureServer())) break;
      // A fresh page per game: no listener or state leaks between games.
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });
      try {
        const errors = [];
        const bad = [];
        page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
        page.on('response', (r) => {
          if (r.status() >= 400) bad.push(\\\`\\\${r.status()} \\\${r.url()}\\\`);
        });

        await page.goto(\`http://localhost:\${port}/third-party/\${v.slug}/index.html\`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await new Promise((r) => setTimeout(r, 2200));
        // Many games draw only after the first input.
        try {
          await page.keyboard.press('Space');
          await page.keyboard.press('Enter');
          await new Promise((r) => setTimeout(r, 600));
        } catch {
          /* the page may not accept synthetic keys */
        }

        const probe = await page.evaluate(() => {
          const canvases = [...document.querySelectorAll('canvas')];
          // Sample the WHOLE canvas. A corner sample misses games that draw
          // in the middle, which is most of them.
          const canvasPixels = canvases.reduce((total, c) => {
            try {
              const ctx = c.getContext('2d');
              if (!ctx) return total;
              const d = ctx.getImageData(0, 0, Math.min(c.width, 800), Math.min(c.height, 800)).data;
              let n = 0;
              for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
              return total + n;
            } catch {
              return total;
            }
          }, 0);
          const text = (document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim();
          return {
            canvasPixels,
            textLen: text.length,
            text: text.slice(0, 300),
            controls: document.querySelectorAll('button, a, input, [role=button]').length,
            canvases: canvases.length,
          };
        });

        const fatal = errors.filter((e) => !/favicon|ERR_/.test(e));
        // Only same-origin failures matter - a game's own analytics or ribbon
        // images failing is not a broken game.
        const missing = bad.filter((b) => !/favicon/.test(b) && b.includes('localhost'));

        // Alive if it paints, or presents a real interface, or has a canvas
        // plus readable text (many draw on the first keypress only).
        const paints = probe.canvasPixels > 200;
        const interactive = probe.textLen > 120 && probe.controls >= 1;
        const alive = probe.canvases > 0 && probe.textLen > 40;

        if (/404|not found|error occurred/i.test(probe.text)) {
          verdict = 'dead';
          lastReason = 'page reports an error';
        } else if (paints || interactive || alive) {
          if (missing.length > 6) {
            verdict = 'dead';
            lastReason =\\\`\\\${missing.length} failed resources\\\`;
          } else if (fatal.length > 0) {
            verdict = 'dead';
            lastReason = \\\`js error: \\\${fatal[0].slice(0, 80)}\\\`;
          } else {
            verdict = 'pass';
          }
        } else {
          verdict = 'dead';
          lastReason = \\\`nothing playable (canvas \\\${probe.canvasPixels}px, text \\\${probe.textLen})\\\`;
        }
      } catch (err) {
        // A load failure is NOT a verdict. The game stays on disk and is
        // retried once (after a server restart, if the server was the cause).
        lastReason = \\\`load failed: \\\${String(err.message).slice(0, 60)}\\\`;
        verdict = '';
      } finally {
        await page.close().catch(() => {});
      }
    }

    if (verdict === 'pass') {
      passed.push(v);
      writeJson(join(dir, '.harvested.json'), { ...v, validated: true });
    } else if (verdict === 'dead') {
      rmSync(dir, { recursive: true, force: true });
      rejected.push(v.slug);
    } else {
      inconclusive.push(v.slug);
    }
    process.stdout.write(
      \\\`\\\\r  \\\${index}/\\\${vendored.length}  pass \\\${passed.length}  dead \\\${rejected.length}  retry-later \\\${inconclusive.length}   \\\`,
    );
  }

  await browser.close();
  console.log(
    \\\`\\\\nvalidate: \\\${passed.length} passed, \\\${rejected.length} rejected, \\\${inconclusive.length} left for another pass\\\`,
  );
  writeJson(join(work, 'passed.json'), passed);
  return passed;
}

`;

writeFileSync(file, src.slice(0, start) + replacement + src.slice(end));
console.log('spliced. validating syntax...');
