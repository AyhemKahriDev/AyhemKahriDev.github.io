(function () { /* de-moduled */
'use strict';
/**
 * Sal's Galaxy Zone Arcade — Homepage JavaScript
 * ES Module — starfield, card effects, secret game, mini-animations
 */




const STORAGE_PREFIX = 'galaxy-arcade-achievements-';
const SECRET_KEY = 'galaxy-arcade-secret-unlocked';
const audio = new AudioManager();

// ─── Starfield ──────────────────────────────────────────────────────────────

class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.shootingStars = [];
    this.mouse = { x: 0.5, y: 0.5 };
    this.paused = false;
    this.lastTime = 0;
    this.shootingTimer = 0;

    const speeds = [0.15, 0.4, 0.8];
    const sizes = [1, 1.5, 2.2];
    const alphas = [0.4, 0.6, 1];
    for (let i = 0; i < 200; i++) {
      const layer = i < 80 ? 0 : i < 150 ? 1 : 2;
      this.stars.push({
        x: Math.random(), y: Math.random(),
        speed: speeds[layer], size: sizes[layer] * (0.7 + Math.random() * 0.6),
        alpha: alphas[layer] * (0.6 + Math.random() * 0.4), layer,
      });
    }

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX / this.w;
      this.mouse.y = e.clientY / this.h;
    });
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!this.paused) { this.lastTime = 0; this._loop(performance.now()); }
    });
  }

  _resize() {
    this.w = this.canvas.width = window.innerWidth;
    this.h = this.canvas.height = window.innerHeight;
  }

  start() { this._loop(performance.now()); }

  _loop(now) {
    if (this.paused) return;
    const dt = this.lastTime ? Math.min(now - this.lastTime, 50) / 16.67 : 1;
    this.lastTime = now;
    this._update(dt);
    this._draw();
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const px = (this.mouse.x - 0.5) * 2;
    const py = (this.mouse.y - 0.5) * 2;
    const parallax = [0.3, 0.6, 1.0];

    for (const s of this.stars) {
      s.y += s.speed * dt * 0.003;
      s.x += px * parallax[s.layer] * 0.0004 * dt;
      s.y += py * parallax[s.layer] * 0.0002 * dt;
      if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      if (s.y < 0) { s.y = 1; s.x = Math.random(); }
      if (s.x > 1) s.x = 0; if (s.x < 0) s.x = 1;
    }

    // Shooting stars
    this.shootingTimer -= dt;
    if (this.shootingTimer <= 0) {
      this.shootingTimer = 120 + Math.random() * 300;
      this.shootingStars.push({
        x: Math.random() * 0.8, y: Math.random() * 0.3,
        vx: 0.012 + Math.random() * 0.008, vy: 0.006 + Math.random() * 0.004,
        life: 1, trail: [],
      });
    }
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i];
      ss.x += ss.vx * dt; ss.y += ss.vy * dt;
      ss.life -= 0.025 * dt;
      ss.trail.push({ x: ss.x, y: ss.y, a: ss.life });
      if (ss.trail.length > 20) ss.trail.shift();
      if (ss.life <= 0 || ss.x > 1.1 || ss.y > 1.1) this.shootingStars.splice(i, 1);
    }
  }

  _draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shooting stars
    for (const ss of this.shootingStars) {
      for (let i = 0; i < ss.trail.length; i++) {
        const t = ss.trail[i];
        const a = t.a * (i / ss.trail.length) * 0.8;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(t.x * w, t.y * h, 2.5 * (i / ss.trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Card Manager ───────────────────────────────────────────────────────────

class CardManager {
  constructor() {
    this.cards = [...document.querySelectorAll('.game-card')];
    this._initHoverEffects();
    this._initCardAnimations();
    this._loadHighScores();
    this._initCoverAnimations();
  }

  _initHoverEffects() {
    for (const card of this.cards) {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const rotY = (x - 0.5) * 20;
        const rotX = (0.5 - y) * 15;
        card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.05)`;
        card.style.boxShadow = `${(x - 0.5) * 20}px ${(y - 0.5) * 20}px 30px rgba(0,255,255,0.15), 0 0 15px rgba(0,255,255,0.1)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
      });
    }
  }

  _initCardAnimations() {
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].style.setProperty('--card-index', i);
    }
  }

  _loadHighScores() {
    for (const span of document.querySelectorAll('.hi-score[data-game]')) {
      const id = span.dataset.game;
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id));
        if (data?.scores?.highest) {
          span.textContent = data.scores.highest.toLocaleString();
        }
      } catch { /* no score */ }
    }
  }

  _initCoverAnimations() {
    const anims = {
      'pac-chase': this._pacChase,
      'space-defenders': this._spaceDefenders,
      'asteroid-blaster': this._asteroidBlaster,
      'barrel-jump': this._barrelJump,
      'road-hopper': this._roadHopper,
      'galaxy-raiders': this._galaxyRaiders,
      'brick-breaker': this._brickBreaker,
      'retro-tennis': this._retroTennis,
      'bug-shooter': this._bugShooter,
      'city-defense': this._cityDefense,
      'tunnel-hero': this._tunnelHero,
      'cube-hopper': this._cubeHopper,
      'knight-flyer': this._knightFlyer,
      'star-guardian': this._starGuardian,
      'neon-cycles': this._neonCycles,
    };

    for (const [id, drawFn] of Object.entries(anims)) {
      const cover = document.getElementById(`cover-${id}`);
      if (!cover) continue;
      const c = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 0.3s;z-index:1;';
      cover.style.position = 'relative';
      cover.appendChild(c);
      const resize = () => { c.width = cover.clientWidth; c.height = cover.clientHeight; };
      resize();
      new ResizeObserver(resize).observe(cover);
      const ctx = c.getContext('2d');
      let t = 0, running = false;
      const loop = () => { if (!running) return; t += 0.03; drawFn(ctx, c.width, c.height, t); requestAnimationFrame(loop); };
      // Show canvas animation on hover
      const card = cover.closest('.game-card');
      card.addEventListener('mouseenter', () => { c.style.opacity = '1'; running = true; loop(); });
      card.addEventListener('mouseleave', () => { c.style.opacity = '0'; running = false; });
    }
  }

  // Mini-animation draw functions — each takes (ctx, w, h, time)
  _pacChase(c, w, h, t) {
    c.clearRect(0, 0, w, h);
    const cx = w * 0.3 + Math.sin(t) * w * 0.15, cy = h / 2, m = Math.abs(Math.sin(t * 4)) * 0.8;
    c.fillStyle = '#ff0'; c.beginPath(); c.arc(cx, cy, 14, m, Math.PI * 2 - m); c.lineTo(cx, cy); c.fill();
    for (let i = 0; i < 4; i++) { const dx = cx + 30 + i * 16; if (dx < w - 10) { c.fillStyle = '#fff'; c.beginPath(); c.arc(dx, cy, 3, 0, Math.PI * 2); c.fill(); } }
  }
  _spaceDefenders(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#0f0'; c.fillRect(w / 2 - 10, h - 20, 20, 10);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#ff0'; c.fillRect(w / 2 - 1, h - 30 - ((t * 40 + i * 30) % (h - 20)), 3, 8); }
    for (let i = 0; i < 5; i++) { c.fillStyle = '#f0f'; c.fillRect(15 + i * (w - 30) / 4 + Math.sin(t + i) * 8 - 8, 15, 16, 10); }
  }
  _asteroidBlaster(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#888'; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(((t * 15 + i * 70) % (w + 40)) - 20, 20 + i * (h - 40) / 3, 8 + i * 3, 0, Math.PI * 2); c.stroke(); }
  }
  _barrelJump(c, w, h, t) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f00'; c.fillRect(w * 0.3 - 5, h - 20 - Math.abs(Math.sin(t * 3)) * 25 - 12, 10, 12);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#a52'; c.beginPath(); c.arc(((t * 20 + i * 60) % (w + 20)) - 10, h - 15, 8, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#555'; c.fillRect(0, h - 6, w, 6);
  }
  _roadHopper(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#333'; c.fillRect(0, h * 0.3, w, h * 0.4);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#ff0'; c.fillRect(((t * 20 + i * 40) % (w + 20)) - 10, h * 0.49, 15, 3); }
    c.fillStyle = '#0f0'; c.fillRect(w / 2 - 5, h * 0.5 - Math.abs(Math.sin(t * 2)) * 15 - 8, 10, 8);
  }
  _galaxyRaiders(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#0ff'; c.beginPath(); c.moveTo(w / 2, h - 25); c.lineTo(w / 2 - 8, h - 12); c.lineTo(w / 2 + 8, h - 12); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = `hsl(${i * 60},100%,60%)`; c.fillRect(10 + ((i * 30 + t * 10) % (w - 20)) - 4, 10 + (i * 12) % (h * 0.4) - 4, 8, 8); }
  }
  _brickBreaker(c, w, h, t) {
    c.clearRect(0, 0, w, h); const cols = ['#f00', '#ff0', '#0f0', '#0ff'];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { c.fillStyle = cols[r]; c.fillRect(6 + i * (w - 12) / 6, 8 + r * 10, (w - 24) / 6, 7); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2 + Math.sin(t * 2) * w * 0.3, h * 0.6 + Math.cos(t * 3) * 15, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0ff'; c.fillRect(w / 2 + Math.sin(t) * 25 - 15, h - 12, 30, 5);
  }
  _retroTennis(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#333'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2 + Math.sin(t * 2) * w * 0.3, h / 2 + Math.sin(t * 3) * h * 0.3, 4, 0, Math.PI * 2); c.fill();
    c.fillRect(8, h / 2 + Math.sin(t * 2.5) * 20 - 15, 5, 30); c.fillRect(w - 13, h / 2 + Math.sin(t * 3) * 20 - 15, 5, 30);
  }
  _bugShooter(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#0f0'; c.fillRect(w / 2 - 8, h - 18, 16, 10);
    for (let i = 0; i < 5; i++) { c.fillStyle = '#f0f'; c.beginPath(); c.arc(w * 0.2 + i * w * 0.15 + Math.sin(t + i * 2) * 10, 15 + Math.cos(t * 1.5 + i) * 8, 5, 0, Math.PI * 2); c.fill(); }
  }
  _cityDefense(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#444';
    const s = Math.sin(t * 0.3); // deterministic instead of random
    for (let i = 0; i < 5; i++) c.fillRect(10 + i * (w - 20) / 5, h - 18 - Math.abs(Math.sin(s + i)) * 8, 12, 18);
    for (let i = 0; i < 2; i++) { c.fillStyle = '#f00'; c.beginPath(); c.arc(((t * 15 + i * 80) % (w + 20)) - 10, 10 + i * 15, 3, 0, Math.PI * 2); c.fill(); }
  }
  _tunnelHero(c, w, h, t) {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const s = 1 - i * 0.12, off = Math.sin(t + i * 0.5) * 10; c.strokeStyle = `hsl(${180 + i * 20},100%,50%)`; c.lineWidth = 1; c.strokeRect(w / 2 - w * s / 2 + off, h / 2 - h * s / 2, w * s, h * s); }
    c.fillStyle = '#0ff'; c.fillRect(w / 2 - 4, h / 2 - 4, 8, 8);
  }
  _cubeHopper(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#f0f'; c.fillRect(w * 0.3 - 6, h - 20 - Math.abs(Math.sin(t * 3)) * 30 - 12, 12, 12);
    for (let i = 0; i < 5; i++) { c.fillStyle = `hsl(${i * 50},80%,40%)`; c.fillRect(10 + i * (w - 30) / 5, h - 10 - (i % 2) * 15, (w - 40) / 5, 10); }
  }
  _knightFlyer(c, w, h, t) {
    c.clearRect(0, 0, w, h); const px = w * 0.3, py = h / 2 + Math.sin(t * 2) * 15;
    c.fillStyle = '#ff0'; c.beginPath(); c.moveTo(px + 12, py); c.lineTo(px - 8, py - 7); c.lineTo(px - 8, py + 7); c.fill();
    for (let i = 0; i < 3; i++) { c.fillStyle = '#555'; c.fillRect(((t * 25 + i * 50) % (w + 30)) - 15, 10 + i * 20, 20, 8); }
  }
  _starGuardian(c, w, h, t) {
    c.clearRect(0, 0, w, h); c.fillStyle = '#0ff'; c.beginPath(); c.arc(w / 2, h / 2, 10, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 4; i++) { const a = t + i * Math.PI / 2; c.fillStyle = '#f00'; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 25, h / 2 + Math.sin(a) * 25, 4, 0, Math.PI * 2); c.fill(); }
  }
  _neonCycles(c, w, h, t) {
    c.clearRect(0, 0, w, h); const colors = ['#0ff', '#f0f'];
    for (let p = 0; p < 2; p++) { c.strokeStyle = colors[p]; c.lineWidth = 2; c.shadowColor = colors[p]; c.shadowBlur = 6; c.beginPath(); const cx = w * (0.3 + p * 0.4) + Math.sin(t * (1.5 + p)) * 20, cy = h * (0.3 + p * 0.4) + Math.cos(t * (1.5 + p)) * 15; c.moveTo(cx - 20, cy); c.lineTo(cx, cy); c.lineTo(cx, cy - 20); c.stroke(); }
    c.shadowBlur = 0;
  }
}

// ─── Secret Game ────────────────────────────────────────────────────────────

class SecretGameManager {
  constructor() {
    this.card = document.querySelector('.game-card[data-game="secret-game"]');
    if (!this.card) return;
    this.unlocked = localStorage.getItem(SECRET_KEY) === 'true';
    this.konamiSeq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    this.konamiPos = 0;
    this.clickTimes = [];

    if (this.unlocked) { this._reveal(false); return; }

    this._checkCrossGameUnlock();
    this._initKonami();
    this._initRapidClick();
  }

  _initKonami() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === this.konamiSeq[this.konamiPos]) {
        this.konamiPos++;
        if (this.konamiPos === this.konamiSeq.length) { this.konamiPos = 0; this._unlock(); }
      } else {
        this.konamiPos = key === this.konamiSeq[0] ? 1 : 0;
      }
    });
  }

  _initRapidClick() {
    this.card.addEventListener('click', (e) => {
      if (this.unlocked) return;
      e.preventDefault();
      const now = Date.now();
      this.clickTimes.push(now);
      this.clickTimes = this.clickTimes.filter(t => now - t < 3000);
      if (this.clickTimes.length >= 10) this._unlock();
    });
  }

  _checkCrossGameUnlock() {
    if (AchievementManager.getGamesWithMinScore(5000) >= 5) this._unlock();
  }

  _unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    localStorage.setItem(SECRET_KEY, 'true');
    audio.play('powerup');
    this._glitchThenReveal();
  }

  _glitchThenReveal() {
    const card = this.card;
    card.style.animation = 'none';
    let frame = 0;
    const glitch = () => {
      frame++;
      const dx = (Math.random() - 0.5) * 10;
      const dy = (Math.random() - 0.5) * 6;
      const skew = (Math.random() - 0.5) * 8;
      card.style.transform = `translate(${dx}px,${dy}px) skewX(${skew}deg)`;
      card.style.filter = `hue-rotate(${Math.random() * 360}deg) brightness(${1 + Math.random()})`;
      if (frame < 20) requestAnimationFrame(glitch);
      else { card.style.transform = ''; card.style.filter = ''; this._reveal(true); }
    };
    glitch();
  }

  _reveal(animate) {
    const card = this.card;
    card.classList.remove('out-of-order');
    card.classList.add('unlocked');
    card.removeAttribute('data-locked');
    card.href = 'games/robotron/index.html';
    card.dataset.game = 'robotron';
    const title = card.querySelector('.card-title');
    if (title) {
      if (animate) {
        title.textContent = '???';
        setTimeout(() => { title.textContent = 'Robotron'; }, 800);
      } else {
        title.textContent = 'Robotron';
      }
    }
    // Set up cover animation for the newly revealed game
    const cover = card.querySelector('.card-cover');
    if (cover && !cover.querySelector('canvas')) {
      const c = document.createElement('canvas');
      c.style.cssText = 'width:100%;height:100%;display:block;';
      cover.appendChild(c);
      const resize = () => { c.width = cover.clientWidth; c.height = cover.clientHeight; };
      resize();
      new ResizeObserver(resize).observe(cover);
      const ctx = c.getContext('2d');
      let t = 0;
      const loop = () => {
        t += 0.03;
        ctx.clearRect(0, 0, c.width, c.height);
        // Robotron-style: player surrounded by enemies
        const cx = c.width / 2, cy = c.height / 2;
        ctx.fillStyle = '#0f0'; ctx.fillRect(cx - 4, cy - 4, 8, 8);
        for (let i = 0; i < 8; i++) {
          const a = t + i * Math.PI / 4;
          const r = 20 + Math.sin(t * 2 + i) * 8;
          ctx.fillStyle = '#f00'; ctx.fillRect(cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r - 3, 6, 6);
        }
        requestAnimationFrame(loop);
      };
      loop();
    }
  }
}

// ─── Coin Slot ──────────────────────────────────────────────────────────────

function initCoinSlot() {
  const slot = document.querySelector('.coin-slot');
  if (!slot) return;
  slot.style.cursor = 'pointer';
  slot.addEventListener('click', () => {
    audio.play('coin');
    const coin = document.createElement('div');
    coin.style.cssText = `
      position:absolute;width:20px;height:20px;border-radius:50%;
      background:radial-gradient(circle,#ffdd44,#cc8800);border:2px solid #aa7700;
      top:-30px;left:50%;transform:translateX(-50%);pointer-events:none;
      transition:top 0.4s cubic-bezier(0.6,0,1,1),opacity 0.2s;z-index:10;
    `;
    slot.style.position = 'relative';
    slot.appendChild(coin);
    requestAnimationFrame(() => {
      coin.style.top = '50%';
      setTimeout(() => { coin.style.opacity = '0'; setTimeout(() => coin.remove(), 200); }, 400);
    });
  });
}

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const starfield = new Starfield(document.getElementById('starfield'));
  starfield.start();

  new CardManager();
  new SecretGameManager();
  initCoinSlot();
});

})();
