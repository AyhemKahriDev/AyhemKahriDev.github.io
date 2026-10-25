import content from '../content/games.json';
import sponsors from '../content/sponsors.json';
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
  category: string;
  daily?: boolean;
}

/** Telegram Mini App integration - free distribution, no domain needed. */
interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
  };
}

function telegram(): TelegramWebApp | undefined {
  const tg = (
    window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }
  ).Telegram?.WebApp;
  if (!tg) return undefined;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.('#08090a');
    tg.setBackgroundColor?.('#08090a');
  } catch {
    /* ignore */
  }
  return tg;
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

  const sponsorSlots = sponsors.slots as {
    title: string;
    subtitle?: string;
    href: string;
    categories?: string[];
  }[];

  const houseAds = [
    // A paid sponsor for this category always wins the slot.
    ...sponsorSlots
      .filter(
        (s) =>
          !s.categories ||
          s.categories.length === 0 ||
          s.categories.includes(meta!.category as string),
      )
      .map((s) => ({
        title: s.title,
        subtitle: s.subtitle ?? 'Sponsored',
        href: s.href,
      })),
    // Otherwise promote our own catalogue - free inventory.
    ...content.games
      .filter((g) => g.id !== meta?.id)
      .map((g) => ({
        title: g.title,
        subtitle: g.tagline,
        href: `/games/${g.id}/`,
      })),
  ];

  const bundle = createEngineBundle({
    gameId: spec!.id,
    houseAds,
  });

  const tg = telegram();

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
    const cs = getComputedStyle(stage!);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 0;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) || 0;
    W = Math.max(240, Math.floor(rect.width - padX));
    H = Math.max(240, Math.floor(rect.height - padY));
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
    // Space / Enter act on whatever overlay is up: start, or play again.
    if ((e.key === ' ' || e.key === 'Enter') && overlay?.classList.contains('is-open')) {
      e.preventDefault();
      if (resultShown) restart();
      else begin();
      return;
    }
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

  function paintMute(): void {
    if (!muteBtn) return;
    const muted = bundle.audio.muted();
    muteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" class="af-glyph"><use href="#${
      muted ? 'a-muted' : 'a-sound'
    }"/></svg>`;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Sound is off — turn it on' : 'Sound is on — mute it');
  }

  function toggleMute(): void {
    bundle.audio.toggleMute();
    paintMute();
  }
  paintMute();

  // Fullscreen: the stage is the thing worth filling, not the rail.
  const fsBtn = document.getElementById('fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const el = stage!;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen?.().catch(() => undefined);
    });
    document.addEventListener('fullscreenchange', () => {
      const on = Boolean(document.fullscreenElement);
      fsBtn.setAttribute('aria-pressed', String(on));
      fsBtn.setAttribute('aria-label', on ? 'Leave fullscreen' : 'Fullscreen');
      resize();
    });
  }

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

  function begin(): void {
    bundle.audio.unlock();
    tg?.HapticFeedback?.impactOccurred('light');
    bundle.analytics.track('play', { game: spec!.id });
    playing = true;
    hideOverlay();
  }

  function startOverlay(): void {
    showOverlay(
      `<div class="card">
        <h2>${escapeHtml(meta!.title)}</h2>
        <p>${escapeHtml(meta!.tagline)}</p>
        <button class="btn btn-primary" data-act="play">Play now</button>
        <p class="fine">Free &middot; no sign-up &middot; press <kbd>Space</kbd> to start</p>
      </div>`,
    );
    overlay!.querySelector('[data-act="play"]')?.addEventListener('click', begin);
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
      const url = `${content.site.baseUrl.replace(/\/$/, '')}/games/${spec!.id}/`;
      const outcome = await shareResult({
        title: meta!.title,
        text: `${meta!.title} - score ${r.score} on arcadefork`,
        url,
        draw: (c, w, h) => {
          if (instance.shareCard) {
            instance.shareCard(c, w, h);
            return;
          }
          c.fillStyle = '#08090a';
          c.fillRect(0, 0, w, h);
          c.fillStyle = '#f6f3eb';
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
      tg?.HapticFeedback?.notificationOccurred(
        instance.result.won ? 'success' : 'error',
      );
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
