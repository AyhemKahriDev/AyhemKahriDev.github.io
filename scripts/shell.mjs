/**
 * The in-game shell. Shared by the site builder and the itch.io packager so
 * both produce the same markup.
 */
export function gameShell(game) {
  return `<div class="game-body">
  <div class="topbar">
    <a class="brand" href="/">arcade<span>fork</span></a>
    <div class="hud" id="hud"></div>
    <button class="icon-btn" id="mute" aria-label="Toggle sound">🔊</button>
  </div>
  <div class="stage" id="stage">
    <canvas id="game" aria-label="${game.title}"></canvas>
    <div class="overlay" id="overlay"></div>
  </div>
</div>`;
}

export function gamePageHead({ title, description, canonical, jsonLd = null }) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  return `<!doctype html>
<html lang="en">
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
