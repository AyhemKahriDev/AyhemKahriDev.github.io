/**
 * The in-game shell. Shared by the site builder and the itch.io packager so
 * both produce the same markup.
 */
import { gameIcon } from './icons.mjs';

export function gameShell(game, opts = {}) {
  const related = opts.related ?? [];
  const side = `
    <aside class="game-side">
      <div class="side-head">
        <div class="side-title">${gameIcon(game.id, game.accent, game.category)}<span>${game.title}</span></div>
        <p class="side-tag">${game.tagline}</p>
      </div>
      <div class="side-actions">
        <a class="btn btn-ghost" href="/">All games</a>
        <a class="btn btn-ghost" href="/categories/${game.category}/">More in this category</a>
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

  return `<div class="game-layout">
  <div class="game-main">
    <div class="topbar">
      <a class="brand" href="/">arcade<span>fork</span></a>
      <div class="hud" id="hud"></div>
      <button class="icon-btn" id="mute" aria-label="Toggle sound">🔊</button>
    </div>
    <div class="stage" id="stage">
      <canvas id="game" aria-label="${game.title}"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
  </div>
  ${side}
</div>`;
}

/** Third-party games keep their own UI, so they get an iframe stage instead. */
export function embedShell(game, opts = {}) {
  const related = opts.related ?? [];
  const side = `
    <aside class="game-side">
      <div class="side-head">
        <div class="side-title">${gameIcon(game.id, game.accent, game.category)}<span>${game.title}</span></div>
        <p class="side-tag">${game.tagline}</p>
      </div>
      <div class="side-actions">
        <a class="btn btn-ghost" href="/">All games</a>
        <a class="btn btn-ghost" href="${game.embed.src}" target="_blank" rel="noopener">Open full &#8599;</a>
      </div>
      ${
        game.credit
          ? `<div class="side-block">
        <div class="side-label">Original</div>
        <p class="side-credit">${game.credit.author} · ${game.credit.license}<br>
        <a href="${game.credit.source}" target="_blank" rel="noopener nofollow">View source</a></p>
      </div>`
          : ''
      }
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

  return `<div class="game-layout">
  <div class="game-main embed-main">
    <div class="embed-bar">
      <a class="brand" href="/">arcade<span>fork</span></a>
      <span class="embed-title">${gameIcon(game.id, game.accent, game.category)}<span class="embed-name">${game.title}</span></span>
      <a class="embed-open" href="${game.embed.src}" target="_blank" rel="noopener">Open full &#8599;</a>
    </div>
    <div class="embed-stage">
      <iframe src="${game.embed.src}" title="${game.title}" loading="lazy"
              allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
    </div>
  </div>
  ${side}
</div>`;
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
<link rel="stylesheet" href="styles.css">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}
