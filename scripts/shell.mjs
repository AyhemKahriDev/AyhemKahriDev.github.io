/**
 * The in-game shell. Shared by the site builder and the itch.io packager so
 * both produce the same markup.
 */
import { gameIcon, brandMark, glyph } from './icons.mjs';
import { cleanTagline, creditLicence } from './content-utils.mjs';

function rail(game, related, opts, extra = '') {
  return `
    <aside class="game-side" aria-label="About this game">
      <div class="side-head">
        <div class="side-title">${gameIcon(game.id, game.accent, game.category)}<span>${game.title}</span></div>
        <p class="side-tag">${cleanTagline(game)}</p>
      </div>
      <div class="side-actions">
        <a class="btn" href="/">${glyph('a-grid', 16)} All games</a>
        <a class="btn" href="/categories/${game.category}/">More like this</a>
        ${extra}
      </div>
      ${
        related.length
          ? `<div class="side-block">
        <div class="side-label">Keep playing</div>
        <div class="side-links">${related
          .map((g) => `<a href="/games/${g.id}/">${g.title}</a>`)
          .join('')}</div>
      </div>`
          : ''
      }
      ${
        opts.sponsor
          ? `<div class="side-block"><div class="side-label">Sponsored</div>${opts.sponsor}</div>`
          : ''
      }
      <p class="side-foot">Free to play · no sign-up · works on any device</p>
    </aside>`;
}

/**
 * Difficulty, for the games that are built on this engine. The setting lives
 * in localStorage (`af:difficulty`) and is applied by restarting the round, so
 * the control has to look like a control: three real buttons, one pressed.
 */
function difficultyControl() {
  const levels = [
    ['easy', 'Easy', 'E'],
    ['normal', 'Normal', 'N'],
    ['hard', 'Hard', 'H'],
  ];
  return `<div class="diff" role="group" aria-label="Difficulty">
        ${levels
          .map(
            ([id, label, short]) => `<button class="diff-btn" type="button" data-diff="${id}"
          aria-pressed="${id === 'normal' ? 'true' : 'false'}"
          title="${label} difficulty"><span class="diff-long">${label}</span><span class="diff-short" aria-hidden="true">${short}</span></button>`,
          )
          .join('')}
      </div>`;
}

export function gameShell(game, opts = {}) {
  const related = opts.related ?? [];
  const native = game.mobile === 'native' ? ' data-mobile="native"' : '';
  return `<main id="main" class="game-layout">
  <div class="game-main">
    <div class="topbar">
      <a class="brand" href="/" aria-label="arcadefork — home">${brandMark(26)}<span>arcade<b>fork</b></span></a>
      <div class="hud" id="hud"></div>
      <div class="top-actions">
        ${difficultyControl()}
        <button class="icon-btn" id="mute" type="button" aria-label="Toggle sound" aria-pressed="false">${glyph('a-sound', 17)}</button>
        <button class="icon-btn" id="fullscreen" type="button" aria-label="Fullscreen">${glyph('a-expand', 17)}</button>
      </div>
    </div>
    <div class="stage" id="stage"${native}>
      <canvas id="game" tabindex="-1" aria-label="${game.title}. Press space to start."></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
    <p class="sr-only" id="announce" role="status" aria-live="polite"></p>
  </div>
  ${rail(game, related, opts)}
</main>`;
}

/** Third-party games keep their own UI, so they get an iframe stage instead. */
export function embedShell(game, opts = {}) {
  const related = opts.related ?? [];
  const credit = game.credit
    ? `<div class="side-block">
        <div class="side-label">Original</div>
        <p class="side-credit">${game.credit.author} · ${creditLicence(game.credit)}<br>
        <a href="${game.credit.source}" target="_blank" rel="noopener nofollow">View source</a></p>
      </div>`
    : '';
  // Keyboard overrides for the on-screen pad, e.g. { "a": "KeyZ" }.
  const padKeys = JSON.stringify(game.pad ?? {});
  const native = game.mobile === 'native' ? ' data-mobile="native"' : '';
  return `<main id="main" class="game-layout">
  <div class="game-main embed-main">
    <div class="embed-bar">
      <a class="brand" href="/" aria-label="arcadefork — home">${brandMark(26)}<span>arcade<b>fork</b></span></a>
      <span class="embed-title">${gameIcon(game.id, game.accent, game.category)}<span class="embed-name">${game.title}</span></span>
      <div class="embed-actions">
        <button class="icon-btn" id="af-pad-toggle" type="button" aria-pressed="false" aria-label="On-screen controls">${glyph('a-pad', 17)}</button>
        <button class="icon-btn" id="af-full" type="button" aria-pressed="false" aria-label="Full screen">${glyph('a-expand', 17)}</button>
        <a class="embed-open" href="${game.embed.src}" target="_blank" rel="noopener">Open full ${glyph('a-arrow', 13)}</a>
      </div>
    </div>
    <div class="embed-stage" data-keys='${padKeys}'${native}>
      <div class="embed-splash" aria-hidden="true">
        <span class="embed-spinner"></span>
        <span>Loading ${game.title}…</span>
      </div>
      <iframe id="af-frame" src="${game.embed.src}" title="${game.title}" loading="lazy"
              referrerpolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-modals allow-presentation allow-downloads"
              allow="autoplay; fullscreen; gamepad; clipboard-write"
              allowfullscreen></iframe>
    </div>
  </div>
  ${rail(game, related, opts, credit)}
</main>`;
}

export function gamePageHead({ title, description, canonical, jsonLd = null }) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="styles.css">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}
