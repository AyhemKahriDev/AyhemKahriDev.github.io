(function () { /* de-moduled */
'use strict';
/**
 * City Defense — Missile Command-style arcade game
 * Defend 6 cities from incoming missiles using 3 counter-missile bases.
 */



const W = 800, H = 600, GROUND_Y = 560, TAU = Math.PI * 2;
const rand = (lo, hi) => Math.random() * (hi - lo) + lo;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const lerp = (a, b, t) => a + (b - a) * t;

const CITY_X = [100, 200, 300, 500, 600, 700];
const BASE_X = [50, 400, 750];
const BASE_AMMO = 10;

// Building clusters per city: [xOff, width, height]
const BUILDINGS = [
  [[-18,8,22],[-8,12,30],[6,10,18]],  [[-16,10,26],[-4,8,20],[8,12,32]],
  [[-20,12,20],[-6,10,28],[8,8,16]],   [[-14,10,32],[-2,12,22],[12,8,18]],
  [[-18,8,18],[-6,14,28],[10,10,24]],  [[-16,12,26],[-2,8,20],[8,12,30]],
];

const STARS = Array.from({ length: 120 }, () => ({
  x: rand(0, W), y: rand(0, GROUND_Y - 40),
  s: rand(0.5, 2), tw: rand(0, TAU), sp: rand(0.5, 2),
}));

function waveConfig(w) {
  return {
    count: 8 + w * 3, speed: 30 + w * 8,
    mirvChance: Math.min(0.05 + w * 0.06, 0.5),
    bomberChance: w >= 3 ? Math.min(0.15 + (w - 3) * 0.05, 0.4) : 0,
    interval: Math.max(2.0 - w * 0.12, 0.5),
  };
}

class CityDefenseGame extends GameEngine {
  constructor() {
    super('game-canvas', { width: W, height: H, background: '#000012' });
    this.achievements = new AchievementManager('city-defense');
    this.achievements.define([
      { id: 'first-defense',  name: 'First Defense',  description: 'Destroy your first missile',                  icon: '\u{1F6E1}' },
      { id: 'chain-reaction', name: 'Chain Reaction', description: 'Destroy 3+ missiles in one explosion chain',  icon: '\u{1F4A5}' },
      { id: 'perfect-wave',   name: 'Perfect Wave',   description: 'Complete a wave with all 6 cities intact',     icon: '\u{2B50}'  },
      { id: 'mirv-buster',    name: 'MIRV Buster',    description: 'Destroy a MIRV before it splits',              icon: '\u{1F3AF}' },
      { id: 'guardian',       name: 'Guardian',        description: 'Reach wave 10',                                icon: '\u{1F3F0}' },
    ]);
    this._mx = W / 2; this._my = H / 2; this._clicks = [];
    this._bindInput();
  }

  _bindInput() {
    const coords = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    this.canvas.addEventListener('mousemove', (e) => { const p = coords(e); this._mx = p.x; this._my = p.y; });
    this.canvas.addEventListener('click', (e) => {
      e.preventDefault(); const p = coords(e); this._mx = p.x; this._my = p.y;
      this._clicks.push(p); this.audio._init();
    });
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); const t = e.changedTouches[0]; const p = coords(t);
      this._mx = p.x; this._my = p.y; this._clicks.push(p); this.audio._init();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault(); const t = e.changedTouches[0]; const p = coords(t);
      this._mx = p.x; this._my = p.y;
    }, { passive: false });
    this.canvas.style.cursor = 'none';
  }

  // ── State management ──────────────────────────────────────
  _reset() {
    this.cities = CITY_X.map((x, i) => ({ x, alive: true, bld: BUILDINGS[i] }));
    this.bases = BASE_X.map(x => ({ x, y: GROUND_Y, ammo: BASE_AMMO, alive: true }));
    this.enemies = []; this.players = []; this.explosions = []; this.bombers = [];
    this.wave = 1; this.wConf = waveConfig(1);
    this.spawned = 0; this.spawnT = 1.5; this.tally = null; this.destroyed = 0;
  }

  onEnterState(st) {
    if (st === 'menu') this._reset();
    if (st === 'playing' && (this._prevState === 'menu' || this._prevState === 'gameover')) {
      this.score = 0; this.level = 1; this._reset();
    }
  }

  updateMenu() {
    if (this._clicks.length > 0) { this._clicks.length = 0; this._startGame(); }
  }

  renderMenu(ctx) {
    this._drawScene(ctx);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff4444'; ctx.font = 'bold 52px "Courier New", monospace';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20;
    ctx.fillText('CITY DEFENSE', W / 2, H * 0.25); ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaa'; ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Protect your cities from incoming missiles', W / 2, H * 0.38);
    if (Math.floor(performance.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#0ff'; ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillText('CLICK TO DEFEND', W / 2, H * 0.52);
    }
    ctx.restore();
  }

  _startGame() {
    this.score = 0; this.level = 1; this.particles.clear(); this._reset();
    this.audio.play('start'); this.setState('playing');
  }

  // ── Main update ───────────────────────────────────────────
  update(dt) {
    if (this.tally) { this._updateTally(dt); return; }
    this._spawn(dt); this._handleClicks();
    this._updatePlayers(dt); this._updateEnemies(dt);
    this._updateExplosions(dt); this._updateBombers(dt);
    this._updateTrails(dt); this._checkWave(); this._checkOver();
    this._syncHUD();
  }

  _syncHUD() {
    const se = document.getElementById('hud-score');
    const le = document.getElementById('hud-level');
    const me = document.getElementById('hud-missiles');
    if (se) se.textContent = `SCORE ${String(this.score).padStart(8, '0')}`;
    if (le) le.textContent = `LV ${this.wave}`;
    const ammo = this.bases.reduce((s, b) => s + (b.alive ? b.ammo : 0), 0);
    if (me) me.textContent = `MISSILES ${ammo}`;
  }

  // ── Spawning ──────────────────────────────────────────────
  _spawn(dt) {
    if (this.spawned >= this.wConf.count) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.wConf.interval * rand(0.6, 1.4);
      this._addMissile(); this.spawned++;
      if (Math.random() < this.wConf.bomberChance && this.bombers.length < 2) this._addBomber();
    }
  }

  _addMissile() {
    const targets = [...this.cities.filter(c => c.alive), ...this.bases.filter(b => b.alive)];
    if (!targets.length) return;
    const tgt = targets[Math.floor(Math.random() * targets.length)];
    const sx = rand(50, W - 50);
    const mirv = Math.random() < this.wConf.mirvChance;
    this.enemies.push({
      sx, sy: -10, x: sx, y: -10, tx: tgt.x, ty: GROUND_Y,
      speed: this.wConf.speed * rand(0.8, 1.2),
      mirv, splitY: mirv ? rand(H * 0.25, H * 0.5) : -1, split: false, trail: [],
    });
  }

  _addBomber() {
    const right = Math.random() < 0.5;
    this.bombers.push({
      x: right ? -40 : W + 40, y: rand(40, 120),
      vx: (right ? 1 : -1) * rand(60, 100), dropT: rand(1, 2.5), dropped: false,
    });
  }

  // ── Click → fire ──────────────────────────────────────────
  _handleClicks() {
    for (const c of this._clicks) {
      if (c.y > GROUND_Y - 20) continue;
      const avail = this.bases.filter(b => b.alive && b.ammo > 0)
        .sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y));
      if (!avail.length) continue;
      const base = avail[0]; base.ammo--;
      const d = dist(base.x, base.y, c.x, c.y); const spd = 500;
      this.players.push({
        sx: base.x, sy: base.y - 10, x: base.x, y: base.y - 10,
        tx: c.x, ty: c.y, time: d / spd, el: 0, trail: [],
      });
      this.audio.play('shoot', { pitch: rand(0.8, 1.2), pan: (base.x / W) * 2 - 1 });
    }
    this._clicks.length = 0;
  }

  // ── Player missiles ───────────────────────────────────────
  _updatePlayers(dt) {
    for (let i = this.players.length - 1; i >= 0; i--) {
      const m = this.players[i]; m.el += dt;
      const t = Math.min(m.el / m.time, 1);
      m.x = lerp(m.sx, m.tx, t); m.y = lerp(m.sy, m.ty, t);
      m.trail.push({ x: m.x, y: m.y, life: 0.5 });
      if (t >= 1) { this._boom(m.tx, m.ty, 40, true); this.players.splice(i, 1); }
    }
  }

  // ── Enemy missiles ────────────────────────────────────────
  _updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const m = this.enemies[i];
      const td = Math.hypot(m.tx - m.sx, m.ty - m.sy);
      m.x += ((m.tx - m.sx) / td) * m.speed * dt;
      m.y += ((m.ty - m.sy) / td) * m.speed * dt;
      m.trail.push({ x: m.x, y: m.y, life: 0.8 });

      // MIRV split
      if (m.mirv && !m.split && m.y >= m.splitY) {
        m.split = true;
        const alive = this.cities.filter(c => c.alive);
        for (let c = 0; c < 1 + Math.floor(Math.random() * 2); c++) {
          const tgt = alive.length ? alive[Math.floor(Math.random() * alive.length)] : { x: rand(50, W - 50) };
          this.enemies.push({
            sx: m.x, sy: m.y, x: m.x, y: m.y, tx: tgt.x, ty: GROUND_Y,
            speed: m.speed * rand(1, 1.3), mirv: false, splitY: -1, split: false, trail: [],
          });
        }
        this.audio.play('powerup', { volume: 0.4, pitch: 0.5 });
      }

      // Hit ground
      if (m.y >= GROUND_Y) { this._impact(m); this.enemies.splice(i, 1); continue; }

      // Caught in player explosion
      let hit = false;
      for (const e of this.explosions) {
        if (e.player && dist(m.x, m.y, e.x, e.y) < e.r) {
          this._killMissile(m, e); this.enemies.splice(i, 1); hit = true; break;
        }
      }
      if (hit) continue;
    }
  }

  _impact(m) {
    this._boom(m.x, GROUND_Y, 30, false);
    for (const c of this.cities) {
      if (c.alive && Math.abs(c.x - m.x) < 25) {
        c.alive = false; this.effects.shake(8, 0.4); this.effects.flash('#ff2200', 0.15);
        this.audio.play('die', { volume: 0.8, pitch: 0.6 });
        this.particles.emit(c.x, GROUND_Y - 10, 'debris', 15);
        this.particles.emit(c.x, GROUND_Y - 10, 'fire', 10);
      }
    }
    for (const b of this.bases) {
      if (b.alive && Math.abs(b.x - m.x) < 20) {
        b.alive = false; this.effects.shake(6, 0.3);
        this.audio.play('explosion', { volume: 0.7 });
        this.particles.emit(b.x, GROUND_Y - 5, 'debris', 10);
      }
    }
  }

  _killMissile(m, exp) {
    const pts = m.mirv && !m.split ? 50 : 25;
    this.addScore(pts, m.x, m.y); this.destroyed++;
    this._boom(m.x, m.y, 25, true);
    exp._chain = (exp._chain || 0) + 1;
    this.audio.play('hit', { pitch: rand(0.7, 1.3), pan: (m.x / W) * 2 - 1 });
    if (this.destroyed === 1) this.achievements.unlock('first-defense');
    if (m.mirv && !m.split) this.achievements.unlock('mirv-buster');
    if (exp._chain >= 3) this.achievements.unlock('chain-reaction');
  }

  // ── Explosions ────────────────────────────────────────────
  _boom(x, y, maxR, player) {
    this.explosions.push({
      x, y, maxR, r: 0, phase: 0, t: 0, // phase: 0=grow,1=hold,2=shrink
      grow: 0.15, hold: 0.3, shrink: 0.25, player, _chain: 0,
      col: player ? ['#00ffff','#0088ff','#ffffff'] : ['#ff4400','#ff8800','#ffcc00'],
    });
    this.audio.play('explosion', { volume: player ? 0.5 : 0.6, pitch: rand(0.6, 1.4), pan: (x / W) * 2 - 1 });
  }

  _updateExplosions(dt) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i]; e.t += dt;
      if (e.phase === 0) {
        const p = Math.min(e.t / e.grow, 1); e.r = e.maxR * p;
        if (p >= 1) { e.phase = 1; e.t = 0; }
      } else if (e.phase === 1) {
        e.r = e.maxR; if (e.t >= e.hold) { e.phase = 2; e.t = 0; }
      } else {
        const p = Math.min(e.t / e.shrink, 1); e.r = e.maxR * (1 - p);
        if (p >= 1) this.explosions.splice(i, 1);
      }
    }
  }

  // ── Bombers ───────────────────────────────────────────────
  _updateBombers(dt) {
    for (let i = this.bombers.length - 1; i >= 0; i--) {
      const b = this.bombers[i]; b.x += b.vx * dt; b.dropT -= dt;
      if (b.dropT <= 0 && !b.dropped) {
        b.dropped = true;
        const alive = this.cities.filter(c => c.alive);
        if (alive.length) {
          const tgt = alive[Math.floor(Math.random() * alive.length)];
          this.enemies.push({
            sx: b.x, sy: b.y, x: b.x, y: b.y, tx: tgt.x, ty: GROUND_Y,
            speed: this.wConf.speed * 1.3, mirv: false, splitY: -1, split: false, trail: [],
          });
        }
      }
      let dead = false;
      for (const e of this.explosions) {
        if (e.player && dist(b.x, b.y, e.x, e.y) < e.r + 15) {
          this.addScore(100, b.x, b.y); this.particles.emit(b.x, b.y, 'explosion', 20);
          this.audio.play('explosion', { pitch: 1.2 });
          this.bombers.splice(i, 1); dead = true; break;
        }
      }
      if (dead) continue;
      if (b.x < -60 || b.x > W + 60) this.bombers.splice(i, 1);
    }
  }

  // ── Trails ────────────────────────────────────────────────
  _updateTrails(dt) {
    for (const m of [...this.players, ...this.enemies]) {
      for (let i = m.trail.length - 1; i >= 0; i--) {
        m.trail[i].life -= dt; if (m.trail[i].life <= 0) m.trail.splice(i, 1);
      }
    }
  }

  // ── Wave management ───────────────────────────────────────
  _checkWave() {
    if (this.spawned < this.wConf.count || this.enemies.length || this.explosions.length || this.bombers.length || this.tally) return;
    const cities = this.cities.filter(c => c.alive).length;
    const ammo = this.bases.reduce((s, b) => s + (b.alive ? b.ammo : 0), 0);
    this.tally = { phase: 0, cities, ammo, mc: 0, cc: 0, t: 0, tick: 0.12 };
    if (cities === 6) this.achievements.unlock('perfect-wave');
  }

  _updateTally(dt) {
    const t = this.tally; t.t += dt;
    if (t.phase === 0) { // count missiles
      if (t.mc < t.ammo) {
        if (t.t >= t.tick) { t.t = 0; t.mc++; this.addScore(5); this.audio.play('coin', { volume: 0.3, pitch: 1 + t.mc * 0.05 }); }
      } else { t.phase = 1; t.t = 0; }
    } else if (t.phase === 1) { // count cities
      if (t.cc < t.cities) {
        if (t.t >= t.tick * 1.5) { t.t = 0; t.cc++; this.addScore(100); this.audio.play('score', { volume: 0.4, pitch: 0.8 + t.cc * 0.1 }); }
      } else { t.phase = 2; t.t = 0; }
    } else if (t.t >= 1.5) { this._nextWave(); }
  }

  _nextWave() {
    this.wave++; this.level = this.wave; this.wConf = waveConfig(this.wave);
    this.spawned = 0; this.spawnT = 1.5; this.tally = null;
    for (const b of this.bases) { if (b.alive) b.ammo = BASE_AMMO; }
    const dead = this.bases.filter(b => !b.alive);
    if (dead.length) { dead[0].alive = true; dead[0].ammo = BASE_AMMO; }
    if (this.wave % 3 === 0) {
      const dc = this.cities.filter(c => !c.alive);
      if (dc.length) { dc[0].alive = true; this.audio.play('powerup'); }
    }
    if (this.wave >= 10) this.achievements.unlock('guardian');
    this.audio.play('start', { volume: 0.5 });
  }

  _checkOver() {
    if (!this.cities.some(c => c.alive) && !this.tally) {
      this.achievements.reportScore(this.score); AchievementManager.checkCrossGame();
      this.gameOver();
    }
  }

  // ── Rendering ─────────────────────────────────────────────
  render(ctx) {
    this._drawScene(ctx);
    this._drawTrails(ctx); this._drawEnemyHeads(ctx); this._drawPlayerHeads(ctx);
    this._drawExplosionFX(ctx); this._drawBomberFX(ctx); this._drawCrosshair(ctx);
    if (this.tally) this._drawTally(ctx);
  }

  _drawScene(ctx) {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#000020'); g.addColorStop(0.6, '#000018'); g.addColorStop(1, '#000830');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND_Y);
    // Stars
    const now = performance.now() / 1000;
    for (const s of STARS) {
      ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now * s.sp + s.tw));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Ground
    ctx.fillStyle = '#1a3320'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#2a5530'; ctx.fillRect(0, GROUND_Y, W, 3);
    // Cities
    for (const c of this.cities) c.alive ? this._drawCity(ctx, c) : this._drawRubble(ctx, c.x);
    // Bases
    for (const b of this.bases) {
      if (!b.alive) { ctx.fillStyle = '#444'; ctx.fillRect(b.x - 8, GROUND_Y - 4, 16, 4); continue; }
      ctx.fillStyle = '#00aa44'; ctx.beginPath();
      ctx.moveTo(b.x - 14, GROUND_Y); ctx.lineTo(b.x + 14, GROUND_Y); ctx.lineTo(b.x, GROUND_Y - 18);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#0f0'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(b.ammo), b.x, GROUND_Y + 14);
    }
  }

  _drawCity(ctx, city) {
    const now = performance.now() / 1000;
    for (const [xo, w, h] of city.bld) {
      const bx = city.x + xo, by = GROUND_Y - h;
      ctx.fillStyle = '#223355'; ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = '#3355aa'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w, h);
      ctx.fillStyle = '#ffdd44';
      for (let wy = by + 4; wy < GROUND_Y - 4; wy += 6) {
        for (let wx = bx + 2; wx < bx + w - 2; wx += 5) {
          const seed = (wx * 17 + wy * 31) % 7;
          if (seed < 4 && Math.sin(now * 0.5 + seed * 3) > 0.2) {
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now + seed); ctx.fillRect(wx, wy, 2, 3);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawRubble(ctx, x) {
    ctx.fillStyle = '#333';
    for (let i = -15; i < 15; i += 4) {
      const h = 2 + Math.abs(((x + i) * 7) % 5);
      ctx.fillRect(x + i, GROUND_Y - h, 3, h);
    }
  }

  _drawTrails(ctx) {
    for (const m of this.enemies) {
      if (m.trail.length < 2) continue;
      ctx.strokeStyle = 'rgba(255,80,0,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(m.trail[0].x, m.trail[0].y);
      for (let i = 1; i < m.trail.length; i++) { ctx.globalAlpha = m.trail[i].life; ctx.lineTo(m.trail[i].x, m.trail[i].y); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const m of this.players) {
      if (m.trail.length < 2) continue;
      ctx.strokeStyle = 'rgba(0,200,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(m.trail[0].x, m.trail[0].y);
      for (let i = 1; i < m.trail.length; i++) { ctx.globalAlpha = m.trail[i].life / 0.5; ctx.lineTo(m.trail[i].x, m.trail[i].y); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  _drawEnemyHeads(ctx) {
    for (const m of this.enemies) {
      const isMirv = m.mirv && !m.split;
      ctx.fillStyle = ctx.shadowColor = isMirv ? '#ff00ff' : '#ff4400';
      ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(m.x, m.y, isMirv ? 4 : 3, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  _drawPlayerHeads(ctx) {
    ctx.fillStyle = ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 6;
    for (const m of this.players) { ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
  }

  _drawExplosionFX(ctx) {
    for (const e of this.explosions) {
      if (e.r <= 0) continue;
      for (let l = 0; l < 3; l++) {
        const r = e.r * (1 - l * 0.2); if (r <= 0) continue;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        const c = e.col[l] || e.col[0];
        g.addColorStop(0, c); g.addColorStop(0.4, c + 'aa'); g.addColorStop(1, c + '00');
        ctx.globalAlpha = 0.7 - l * 0.15; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawBomberFX(ctx) {
    for (const b of this.bombers) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.vx > 0 ? 1 : -1, 1);
      ctx.fillStyle = '#aa0000'; ctx.fillRect(-15, -4, 30, 8); ctx.fillRect(-5, -8, 20, 4);
      ctx.fillRect(-15, -10, 6, 6); ctx.fillStyle = '#ff6666'; ctx.fillRect(10, -2, 5, 4);
      ctx.restore();
      const gx = b.x - (b.vx > 0 ? 15 : -15);
      ctx.fillStyle = '#ff8800'; ctx.globalAlpha = 0.5 + Math.random() * 0.3;
      ctx.beginPath(); ctx.arc(gx, b.y, 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  _drawCrosshair(ctx) {
    if (this.state !== 'playing') return;
    ctx.save(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    const s = 12;
    ctx.beginPath();
    ctx.moveTo(this._mx - s, this._my); ctx.lineTo(this._mx - 4, this._my);
    ctx.moveTo(this._mx + 4, this._my); ctx.lineTo(this._mx + s, this._my);
    ctx.moveTo(this._mx, this._my - s); ctx.lineTo(this._mx, this._my - 4);
    ctx.moveTo(this._mx, this._my + 4); ctx.lineTo(this._mx, this._my + s);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(this._mx, this._my, 8, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  _drawTally(ctx) {
    const t = this.tally; ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0ff'; ctx.font = 'bold 32px "Courier New", monospace';
    ctx.fillText(`WAVE ${this.wave} COMPLETE`, W / 2, H * 0.2);
    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = t.phase === 0 || t.mc > 0 ? '#ffcc00' : '#666';
    ctx.fillText(`MISSILES REMAINING: ${t.mc} x 5 = ${t.mc * 5}`, W / 2, H * 0.38);
    ctx.fillStyle = t.phase === 1 || t.cc > 0 ? '#00ff88' : '#666';
    ctx.fillText(`CITIES SAVED: ${t.cc} x 100 = ${t.cc * 100}`, W / 2, H * 0.48);
    if (t.phase === 2) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillText(`WAVE BONUS: ${t.mc * 5 + t.cc * 100}`, W / 2, H * 0.62);
    }
    ctx.restore();
  }

  drawHUD(ctx) {
    ctx.save(); ctx.fillStyle = '#0ff'; ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.fillText(`SCORE ${String(this.score).padStart(8, '0')}`, 10, 8);
    ctx.textAlign = 'center'; ctx.fillText(`WAVE ${this.wave}`, W / 2, 8);
    ctx.textAlign = 'right';
    ctx.fillText(`MISSILES ${this.bases.reduce((s, b) => s + (b.alive ? b.ammo : 0), 0)}`, W - 10, 8);
    ctx.restore();
  }

  renderGameOver(ctx) { this._drawScene(ctx); }
}

const game = new CityDefenseGame();
game.start();

})();
