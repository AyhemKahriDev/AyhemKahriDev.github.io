import content from '../content/games.json';
import { createEngineBundle } from './engine';
import { attachPointer } from './engine/input';
import { startLoop } from './engine/loop';
import { shareResult } from './engine/share';
import { getGame } from './games';
import { dateSeed, mulberry32, todayISO } from './shared/daily.js';
import type { EngineContext, GameInstance, GameSpec } from './engine/types';

interface GameMeta {
  id: string;
  title: string;
  accent: string;
  tagline: string;
  daily?: boolean;
}

const gameId = document.body.dataset.game ?? '';
const meta = content.games.find((g) => g.id === gameId) as GameMeta | undefined;
const spec: GameSpec | undefined = getGame(gameId);

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const stage = document.getElementById('stage') as HTMLElement | null;
const hudEl = document.getElementById('hud') as HTMLElement | null;
const overlay = document.getElementById('overlay') as HTMLElement | null;
const muteBtn = document.getElementById('mute') as HTMLButtonElement | null;

if (!canvas || !stage || !spec || !meta) {
  if (overlay) {
    overlay.innerHTML =
      '<div class="card"><h2>Game unavailable</h2><p>That game could not be loaded.</p><a class="btn" href="/">Back to arcadefork</a></div>';
    overlay.classList.add('is-open');
  }
} else {
  boot();
}

function boot(): void {
  const date = todayISO();
  const seed = dateSeed(date);
  const difficulty = readDifficulty();

  const houseAds = content.games
    .filter((g) => g.id !== meta?.id)
    .map((g) => ({
      title: g.title,
      subtitle: g.tagline,
      href: `/games/${g.id}/`,
    }));

  const bundle = createEngineBundle({
    gameId: spec!.id,
    houseAds,
  });

  let W = 640;
  let H = 480;

  const engineCtx: EngineContext = {
    date,
    seed,
    rng: mulberry32(seed),
    storage: bundle.storage,
    audio: bundle.audio,
    ads: bundle.ads,
    analytics: bundle.analytics,
    difficulty,
    get width() {
      return W;
    },
    get height() {
      return H;
    },
    accent: meta!.accent,
    siteBase: content.site.baseUrl,
  };

  let instance: GameInstance = spec!.create(engineCtx);
  let resultShown = false;
  let playing = false;

  const ctx = canvas!.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  function resize(): void {
    const rect = stage!.getBoundingClientRect();
    W = Math.max(240, Math.floor(rect.width));
    H = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.floor(W * dpr);
    canvas!.height = Math.floor(H * dpr);
    canvas!.style.width = `${W}px`;
    canvas!.style.height = `${H}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  attachPointer(canvas!, {
    onDown: (p) => {
      if (!playing) return;
      instance.pointerDown?.(p);
    },
    onMove: (p) => {
      if (!playing) return;
      instance.pointerMove?.(p);
    },
    onUp: (p) => {
      if (!playing) return;
      instance.pointerUp?.(p);
    },
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      restart();
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      toggleMute();
      return;
    }
    instance.key?.(e);
  });

  function toggleMute(): void {
    const muted = bundle.audio.toggleMute();
    if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
  }
  if (muteBtn) muteBtn.textContent = bundle.audio.muted() ? '🔇' : '🔊';

  function restart(): void {
    instance = spec!.create(engineCtx);
    resultShown = false;
    playing = true;
    hideOverlay();
    bundle.analytics.track('restart', { game: spec!.id });
  }

  function showOverlay(html: string): void {
    if (!overlay) return;
    overlay.innerHTML = html;
    overlay.classList.add('is-open');
  }

  function hideOverlay(): void {
    overlay?.classList.remove('is-open');
    if (overlay) overlay.innerHTML = '';
  }

  function startOverlay(): void {
    showOverlay(
      `<div class="card">
        <h1>${escapeHtml(meta!.title)}</h1>
        <p>${escapeHtml(meta!.tagline)}</p>
        <button class="btn btn-primary" data-act="play">Play now</button>
        <p class="fine">Free &middot; no sign-up &middot; works on any device</p>
      </div>`,
    );
    overlay!.querySelector('[data-act="play"]')?.addEventListener('click', () => {
      bundle.audio.unlock();
      bundle.analytics.track('play', { game: spec!.id });
      playing = true;
      hideOverlay();
    });
  }

  function resultOverlay(): void {
    const r = instance.result!;
    const promo = bundle.ads.houseAd();
    const best = r.score >= r.best;
    showOverlay(
      `<div class="card">
        <h2>${r.won ? 'Solved!' : 'Run over'}</h2>
        <div class="score">${r.score}</div>
        <div class="meta">${r.detail ? escapeHtml(r.detail) + ' &middot; ' : ''}best ${r.best}${best ? ' &#9733;' : ''}</div>
        <div class="row">
          <button class="btn btn-primary" data-act="again">Play again</button>
          <button class="btn" data-act="share">Share</button>
        </div>
        ${
          promo
            ? `<a class="promo" href="${promo.href}"><strong>${escapeHtml(promo.title)}</strong><span>${escapeHtml(promo.subtitle)}</span></a>`
            : ''
        }
      </div>`,
    );
    overlay!.querySelector('[data-act="again"]')?.addEventListener('click', restart);
    overlay!.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
      const url = `${content.site.baseUrl}/games/${spec!.id}/`;
      const outcome = await shareResult({
        title: meta!.title,
        text: `${meta!.title} - score ${r.score} on arcadefork`,
        url,
        draw: (c, w, h) => {
          if (instance.shareCard) {
            instance.shareCard(c, w, h);
            return;
          }
          c.fillStyle = '#080C16';
          c.fillRect(0, 0, w, h);
          c.fillStyle = '#E9EDFF';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = '700 80px system-ui, sans-serif';
          c.fillText(meta!.title, w / 2, h / 2 - 40);
          c.font = '700 120px system-ui, sans-serif';
          c.fillText(String(r.score), w / 2, h / 2 + 80);
        },
      });
      bundle.analytics.track('share', { game: spec!.id, outcome });
    });
  }

  startOverlay();

  startLoop((dt) => {
    if (playing && !resultShown) instance.update(dt);

    if (hudEl) {
      hudEl.innerHTML = instance
        .hud()
        .map(
          (l) =>
            `<span class="hud-item"><span class="hud-label">${escapeHtml(
              l.label,
            )}</span><span class="hud-value">${escapeHtml(l.value)}</span></span>`,
        )
        .join('');
    }

    ctx!.clearRect(0, 0, W, H);
    instance.render(ctx!);

    if (instance.result && !resultShown) {
      resultShown = true;
      void bundle.ads.showInterstitial();
      resultOverlay();
    }
  });
}

function readDifficulty(): 'easy' | 'normal' | 'hard' {
  const param = new URLSearchParams(location.search).get('d');
  if (param === 'easy' || param === 'hard' || param === 'normal') return param;
  try {
    const stored = localStorage.getItem('af:difficulty');
    if (stored === 'easy' || stored === 'hard' || stored === 'normal') return stored;
  } catch {
    /* ignore */
  }
  return 'normal';
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
