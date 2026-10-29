/**
 * The click test: what a player's first keypress does to a game.
 *
 * The paint gate (judgeGame) answers "did this page load". It cannot answer
 * "does it survive being played", and the difference is not academic: 23 games
 * painted a canvas, showed text, passed the gate, were published - and then
 * threw `Cannot read properties of undefined (reading '15')`, failed a WASM MIME
 * check or opened a WebSocket to a host that cannot exist on a static server the
 * moment the player pressed a key. Smoke found them at deploy time; the import
 * gate had already let them in.
 *
 * So this is the same judgement smoke makes, in two halves:
 *
 *   - judgeInteraction(): pure. Given what the page logged, answered and
 *     rendered after it was driven, is it still a game? No browser, no I/O, so
 *     the rulebook is testable.
 *   - clickTest(): the driver. Loads the page, focuses it, sends the keys and
 *     clicks a player would, waits, then reads the page back.
 *
 * A benign allowlist keeps the noisy-but-harmless third-party console output
 * (Redux's NODE_ENV notice, CSP meta/report-only notices, favicon and
 * robots.txt 404s, ad and analytics CORS refusals) from failing a game that
 * works. It is data, not inline regexes, so tests can read it - see
 * BENIGN_CONSOLE.
 */

/**
 * Console noise that does not mean the game is broken.
 *
 * Every rule carries the sample it is meant to match, so a test can prove the
 * rule still matches what Chrome actually emits.
 */
const CORS_TOKENS = 'CORS|cross-origin|Access-Control-Allow-Origin';
/** An ad/analytics host plus a CORS refusal: both halves must be present. */
const corsNoise = (hosts) => new RegExp(`(?=.*(?:${hosts}))(?=.*(?:${CORS_TOKENS}))`, 'i');

export const BENIGN_CONSOLE = [
  {
    id: 'redux-nonprod',
    why: 'Redux/React notice that the bundle is not running under NODE_ENV=production; the game still runs.',
    test: /minified code outside of NODE_ENV|Minified React error|development build of (?:Redux|React)/i,
    sample:
      'Warning: You are currently using minified code outside of NODE_ENV === \'production\'. This means that you are running a slower development build of Redux.',
  },
  {
    id: 'csp-frame-ancestors-meta',
    why: 'Chrome ignores frame-ancestors when it arrives in a <meta> tag, and several vendored games ship exactly that.',
    test: /frame-ancestors[^.]*\bignored\b|\bignored\b[^.]*frame-ancestors/i,
    sample:
      "The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.",
  },
  {
    id: 'csp-report-only',
    why: 'A report-only CSP cannot block anything: the browser logs it and loads the resource anyway.',
    test: /report-only Content Security Policy|Content Security Policy[^.]*report-only/i,
    sample:
      "The Content Security Policy 'script-src' was delivered in report-only mode, so it cannot block the resource.",
  },
  {
    id: 'cosmetic-404',
    why: 'A missing favicon, manifest or robots.txt changes nothing a player can see or do.',
    test: /favicon|robots\.txt|apple-touch-icon|site\.webmanifest|manifest\.json/i,
    sample:
      'Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:4191/third-party/demo/favicon.ico',
  },
  {
    id: 'ad-network-cors',
    why: 'An ad script the game owner embedded is refused on our origin; the game itself is unaffected.',
    test: corsNoise('\\bads?\\b|adsystem|adservice|googletag|googlesyndication'),
    sample:
      "Access to XMLHttpRequest at 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' from origin 'http://localhost:4191' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
  },
  {
    id: 'analytics-cors',
    why: 'A ping to an analytics or ad host is CORS-refused on a static host; the game keeps playing.',
    test: corsNoise('analytics|doubleclick|googletagmanager|google-analytics'),
    sample:
      "Access to fetch at 'https://www.google-analytics.com/collect' from origin 'http://localhost:4191' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.",
  },
  {
    id: 'resource-load-failure',
    why: 'Chrome writes "Failed to load resource" with no address, so it cannot be attributed; the response listener records every 404 with its URL instead.',
    test: /^Failed to load resource/i,
    sample: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
  },
];

/** True when a console message matches a documented benign rule. */
export function isBenign(message) {
  const text = String(message ?? '');
  if (!text.trim()) return false;
  return BENIGN_CONSOLE.some((rule) => rule.test.test(text));
}

/* ------------------------------------------------------------- failures */

/** A bare "404 <url>" is how a same-origin listener writes a failure. */
function urlOf(entry) {
  if (entry && typeof entry === 'object') return String(entry.url ?? '');
  return String(entry ?? '')
    .replace(/^\s*(?:\d{3}|failed)\s+/i, '')
    .trim();
}

function statusOf(entry) {
  if (entry && typeof entry === 'object') return Number(entry.status ?? 0);
  const match = /(\d{3})/.exec(String(entry ?? ''));
  return match ? Number(match[1]) : 0;
}

/**
 * Which 404s are ours?
 *
 * The driver tags every response with the origin it was told to trust, so a
 * third-party CDN 404 stays the game owner's business - exactly as smoke keeps
 * only same-origin failures. A string entry without a tag, or one given without
 * an `origin`, is treated as same-origin: that is how the existing gate writes
 * `failed` entries, and being strict is the safe direction for an import gate.
 */
function isOwnFailure(entry, origin) {
  if (entry && typeof entry === 'object' && typeof entry.sameOrigin === 'boolean') return entry.sameOrigin;
  const url = urlOf(entry);
  if (origin) return url.startsWith(origin);
  return true;
}

/**
 * The decision.
 *
 * A game fails when, after it was driven, it
 *   - threw a pageerror,
 *   - logged a console error that no allowlist rule explains,
 *   - answered a same-origin request with a 404,
 *   - answered the page request itself with a 4xx/5xx,
 *   - or shows nothing playable: no pixels and less than 60 characters of text.
 *
 * The probe `pixels === -1` means "a canvas exists but its pixels are
 * unreadable" (tainted or GL); the last rule then cannot fire, which is the
 * same waiver judgeGame and smoke make for WebGL games. `probe.error` means the
 * page stopped answering its own scripts, which is a failure with its own
 * reason.
 *
 * Pure and deterministic: no I/O, no clock, no mutation of the arguments.
 *
 * @param {object}   input
 * @param {string[]} [input.consoleErrors]     console messages of type error
 * @param {string[]} [input.pageErrors]        uncaught exceptions
 * @param {object}   [input.probeAfterInput]   { pixels, textLen, controls, canvases, webgl, error }
 * @param {number}   [input.status]            status of the page request
 * @param {Array<{status: number, url: string, sameOrigin?: boolean}|string>} [input.httpErrors]
 * @param {string}   [input.origin]            when given, untagged URLs are compared against it
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function judgeInteraction({
  consoleErrors = [],
  pageErrors = [],
  probeAfterInput = {},
  status = 200,
  httpErrors = [],
  origin = '',
} = {}) {
  const reasons = [];

  if (Number(status) >= 400) reasons.push(`the page itself answered ${Number(status)}`);

  for (const error of pageErrors ?? []) {
    const text = String(error ?? '').trim();
    if (!text) continue;
    reasons.push(`js error after input: ${text.slice(0, 120)}`);
  }

  for (const message of consoleErrors ?? []) {
    const text = String(message ?? '').trim();
    if (!text || isBenign(text)) continue;
    reasons.push(`console error after input: ${text.slice(0, 120)}`);
  }

  for (const entry of httpErrors ?? []) {
    if (statusOf(entry) !== 404) continue;
    if (!isOwnFailure(entry, origin)) continue;
    reasons.push(`404 after input: ${urlOf(entry).slice(0, 120)}`);
  }

  const probe = probeAfterInput ?? {};
  const pixels = Number(probe.pixels ?? 0);
  const textLen = Number(probe.textLen ?? 0);
  if (probe.error) {
    reasons.push(`the page stopped answering after input: ${String(probe.error).slice(0, 100)}`);
  } else if (pixels === 0 && textLen < 60 && probe.webgl !== true) {
    reasons.push(
      `nothing playable after input (${pixels}px painted, ${textLen} characters of text, ` +
        `${Number(probe.canvases ?? 0)} canvas)`,
    );
  }

  // One reason per distinct finding: six keypresses producing the same
  // exception is one bug, and the caller slices this into a 160-character
  // record that would otherwise be spent on five copies of it.
  const unique = [...new Set(reasons)];
  return { ok: unique.length === 0, reasons: unique };
}

/* --------------------------------------------------------------- driver */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chrome said goodbye mid-test. That is evidence about the runner, not about
 * the game, so clickTest raises it instead of turning it into a verdict.
 */
const DEAD_BROWSER =
  /Target closed|Session closed|Connection closed|Page closed|detached Frame|frame was detached|Cannot find context|Execution context was destroyed|browser has been closed/i;

/** The keys smoke sends, in the order a player would try them. */
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'Enter'];

/**
 * Drive one page and judge the result.
 *
 * Loads `url`, waits, focuses the canvas (or the body), sends the arrow keys,
 * Space and Enter, clicks the middle of the page twice, waits `settleMs`, then
 * reads the page back: sampled canvas pixels, visible text length, how many
 * controls survive.
 *
 * The caller owns the page, the browser, the server and any timeout; this
 * function owns the judgement.
 *
 * @param {object} input
 * @param {import('puppeteer-core').Page} input.page
 * @param {string} input.url
 * @param {number} [input.settleMs=1200] how long the page gets to react to the input
 * @returns {Promise<{ok: boolean, reasons: string[], probe: object, status: number}>}
 */
export async function clickTest({ page, url, settleMs = 1200 } = {}) {
  if (!page || typeof page.evaluate !== 'function') throw new Error('clickTest: a puppeteer page is required');
  if (!url) throw new Error('clickTest: a url is required');
  const origin = new URL(url).origin;

  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];

  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Chrome logs an unattributed "Failed to load resource" for every 404,
    // including a third-party CDN's. The response listener below records the
    // ones we can attribute, with their address.
    if (/^Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  };
  const onPageError = (error) => pageErrors.push(String(error?.message ?? error));
  const onResponse = (response) => {
    if (response.status() !== 404) return;
    const target = response.url();
    httpErrors.push({ status: 404, url: target, sameOrigin: target.startsWith(origin) });
  };
  // A game that alerts on its first keypress blocks the page until it is
  // dismissed - that is a bad game, not a hung test.
  const onDialog = (dialog) => {
    dialog.dismiss().catch(() => {});
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  page.on('dialog', onDialog);

  let status = 0;
  try {
    // A fresh document is the honest test: a page that survived one load and
    // then reloaded for the click is not showing the player the same thing.
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    status = response?.status() ?? 0;

    // Decode and the first animation frame; the caller has already given the
    // document its paint settle time, this only covers the navigation itself.
    await sleep(300);

    // Many games ignore keys until something inside them has focus.
    const centre = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      if (rect && rect.width >= 2 && rect.height >= 2) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    });
    await page
      .evaluate(() => {
        const canvas = document.querySelector('canvas');
        const target = canvas ?? document.body;
        target?.focus?.();
        window.focus?.();
      })
      .catch(() => {
        /* a game may replace its own body before we can focus it */
      });

    for (const key of KEYS) {
      try {
        await page.keyboard.press(key);
      } catch {
        /* the page may not accept synthetic keys; the probe still decides */
      }
      await sleep(60);
    }

    // Two clicks: menus often need one, canvases the other.
    for (let i = 0; i < 2; i++) {
      try {
        await page.mouse.click(centre.x, centre.y);
      } catch {
        /* same */
      }
      await sleep(150);
    }

    await sleep(settleMs);

    const probe = await readProbe(page);
    const judgement = judgeInteraction({
      consoleErrors,
      pageErrors,
      probeAfterInput: probe,
      status,
      httpErrors,
    });
    return { ...judgement, probe, status };
  } finally {
    for (const [event, handler] of [
      ['console', onConsole],
      ['pageerror', onPageError],
      ['response', onResponse],
      ['dialog', onDialog],
    ]) {
      try {
        page.off?.(event, handler);
      } catch {
        /* an already-closed page cannot drop listeners */
      }
    }
  }
}

/**
 * Read the page back after it was driven.
 *
 * Two attempts, because a game that is mid-render can refuse one evaluation.
 * A browser-level failure is rethrown (the caller knows what to do with a dead
 * browser); a page that simply will not answer becomes `probe.error`, which is
 * a verdict about the game.
 */
async function readProbe(page) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await page.evaluate(() => {
        const canvases = [...document.querySelectorAll('canvas')];
        let pixels = 0;
        for (const canvas of canvases) {
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            const data = ctx.getImageData(
              0,
              0,
              Math.min(canvas.width, 800),
              Math.min(canvas.height, 800),
            ).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) pixels++;
          } catch {
            // Tainted or GL: the canvas exists but cannot be read. -1 keeps it
            // out of the "nothing painted" rule, as smoke and judgeGame do.
            pixels = -1;
          }
        }
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const webgl = canvases.some((canvas) => {
          try {
            return !!(
              (canvas.getContext('webgl2') || canvas.getContext('webgl')) &&
              canvas.width >= 32 &&
              canvas.height >= 32
            );
          } catch {
            return false;
          }
        });
        return {
          pixels,
          textLen: text.length,
          controls: document.querySelectorAll('button, a, input, [role=button]').length,
          canvases: canvases.length,
          webgl,
          focused: document.activeElement?.tagName ?? '',
        };
      });
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      if (DEAD_BROWSER.test(message)) throw error;
      await sleep(250);
    }
  }
  return {
    error: String(lastError?.message ?? lastError ?? 'no answer'),
    pixels: 0,
    textLen: 0,
    controls: 0,
    canvases: 0,
    webgl: false,
  };
}
