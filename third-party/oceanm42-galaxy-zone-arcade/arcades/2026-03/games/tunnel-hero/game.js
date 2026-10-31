(function () { /* de-moduled */
'use strict';
/**
 * Tunnel Hero — A Dig Dug-style digging/inflating arcade game.
 * Dig through underground dirt, inflate enemies until they pop!
 */



// ── Constants ────────────────────────────────────────────────
const COLS = 20, ROWS = 14, CELL = 40, SKY_H = 40;
const MOVE_SPD = 120, PUMP_RANGE = 2.5, PUMPS_TO_POP = 3;
const INFLATE_RATE = 1.8, DEFLATE_RATE = 0.6;
const ROCK_DELAY = 0.4, ROCK_SPD = 280;
const FIRE_RANGE = 3, FIRE_DUR = 0.8;
const GHOST_SPD = 0.7, PHASE_CHANCE = 0.003, VEGGIE_DUR = 6;

const LAYERS = ['#c47a3a', '#a05e2a', '#7a4420', '#5a2e14'];
const LAYER_ROWS = [0, 4, 8, 11];
const DEPTH_PTS = [200, 300, 400, 500];
const VEG_PTS = [400, 600, 800, 1000, 1200];
const DIR_VEC = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const rand = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
function depthLayer(r) {
  for (let i = 3; i >= 0; i--) if (r >= LAYER_ROWS[i]) return i;
  return 0;
}

// ── Main Game ────────────────────────────────────────────────
class TunnelHeroGame extends GameEngine {
  constructor() {
    super('game-canvas', { width: 800, height: 600, background: '#87CEEB' });
    this.ach = new AchievementManager('tunnel-hero');
    this.ach.define([
      { id: 'digger', name: 'Digger', description: 'Clear level 1', icon: '\u26CF' },
      { id: 'rock-drop', name: 'Rock Drop', description: 'Crush an enemy with a rock', icon: '\uD83E\uDEA8' },
      { id: 'double-crush', name: 'Double Crush', description: 'Crush 2+ enemies with one rock', icon: '\uD83D\uDCA5' },
      { id: 'dragon-slayer', name: 'Dragon Slayer', description: 'Kill a Fygar from the side', icon: '\uD83D\uDC09' },
      { id: 'deep-diver', name: 'Deep Diver', description: 'Kill an enemy on the deepest layer', icon: '\u2B07' },
    ]);
  }

  init() {
    this.grid = [];
    this.player = null;
    this.enemies = [];
    this.rocks = [];
    this.fires = [];
    this.hose = null;
    this.pumpTarget = null;
    this.veggie = null;
    this.vegTimer = 0;
    this.rocksDrop = 0;
    this.clearT = 0;
    this.deathT = 0;
    this.dying = false;
    this.menuT = 0;
  }

  // ── Level Generation ─────────────────────────────────────
  _build() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
    const corridors = [2, 6, 10];
    for (const r of corridors)
      for (let c = 2; c < COLS - 2; c++) this.grid[r][c] = 0;

    // Player start position
    this.player = {
      x: 10 * CELL, y: SKY_H + 2 * CELL, col: 10, row: 2,
      tx: 10 * CELL, ty: SKY_H + 2 * CELL,
      dir: 0, moving: false, wf: 0,
    };

    // Spawn enemies on non-player corridors
    this.enemies = [];
    const nE = Math.min(3 + this.level, 8);
    const nF = Math.min(Math.floor(this.level / 2), 3);
    const spots = [];
    for (const r of corridors) {
      if (r === 2) continue;
      for (let c = 3; c < COLS - 3; c += 3) spots.push({ r, c });
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = randI(0, i);
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let i = 0; i < nE && i < spots.length; i++) {
      const s = spots[i];
      this.enemies.push({
        type: i < nF ? 'fygar' : 'pooka',
        x: s.c * CELL, y: SKY_H + s.r * CELL, col: s.c, row: s.r,
        tx: s.c * CELL, ty: SKY_H + s.r * CELL,
        dir: Math.random() < 0.5 ? 0 : 2, moving: false,
        inflate: 0, spd: 50 + this.level * 5,
        phasing: false, phaseT: 0, ghost: false,
        fireCD: rand(3, 6), alive: true, wf: 0,
      });
    }

    // Place rocks
    this.rocks = [];
    const nR = Math.min(2 + Math.floor(this.level / 3), 4);
    for (let i = 0; i < nR; i++) {
      const r = randI(1, ROWS - 3), c = randI(2, COLS - 3);
      this.grid[r][c] = 0;
      this.rocks.push({
        col: c, row: r, x: c * CELL, y: SKY_H + r * CELL,
        falling: false, delay: 0, sup: true, settled: true, done: false,
      });
    }

    this.hose = null;
    this.pumpTarget = null;
    this.veggie = null;
    this.vegTimer = 0;
    this.rocksDrop = 0;
    this.clearT = 0;
    this.deathT = 0;
    this.dying = false;
    this.fires = [];
  }

  onEnterState(s) { if (s === 'playing') this._build(); }

  // ── Update ───────────────────────────────────────────────
  update(dt) {
    if (this.dying) {
      this.deathT -= dt;
      if (this.deathT <= 0) {
        this.dying = false;
        this.lives--;
        if (this.lives <= 0) { this.ach.reportScore(this.score); this.gameOver(); }
        else this._build();
      }
      return;
    }
    if (this.clearT > 0) {
      this.clearT -= dt;
      if (this.clearT <= 0) {
        this.level++;
        if (this.level === 2) this.ach.unlock('digger');
        this._build();
      }
      return;
    }

    this._updPlayer(dt);
    this._updEnemies(dt);
    this._updRocks(dt);
    this._updPump(dt);
    this._updFire(dt);
    this._updVeg(dt);
    this._collide();

    if (this.enemies.every(e => !e.alive)) {
      this.clearT = 1.5;
      this.audio.play('powerup');
    }
  }

  // ── Player Movement ──────────────────────────────────────
  _updPlayer(dt) {
    const p = this.player;
    p.wf += dt * 8;

    if (!p.moving) {
      let dr = 0, dc = 0;
      if (this.input.isDown('UP')) { dr = -1; p.dir = 3; }
      else if (this.input.isDown('DOWN')) { dr = 1; p.dir = 1; }
      else if (this.input.isDown('LEFT')) { dc = -1; p.dir = 2; }
      else if (this.input.isDown('RIGHT')) { dc = 1; p.dir = 0; }

      if (dr || dc) {
        const nr = p.row + dr, nc = p.col + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
            !this.rocks.some(r => r.col === nc && r.row === nr && !r.done)) {
          p.tx = nc * CELL; p.ty = SKY_H + nr * CELL;
          p.moving = true; p.row = nr; p.col = nc;

          if (this.grid[nr][nc] === 1) {
            this.grid[nr][nc] = 0;
            this.audio.play('hit', { volume: 0.3, pitch: 1.5 });
            this.particles.emit(nc * CELL + CELL / 2, SKY_H + nr * CELL + CELL / 2, {
              count: 6, speed: 60, speedVariance: 30,
              life: 0.4, lifeVariance: 0.1, size: 3, sizeVariance: 1, endSize: 0,
              color: [LAYERS[depthLayer(nr)], '#ddb07a'],
              gravity: 200, friction: 0.97, shape: 'square', angle: 0, spread: Math.PI,
            });
          }
        }
      }
    }

    // Smooth interpolation toward target
    if (p.moving) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 2) { p.x = p.tx; p.y = p.ty; p.moving = false; }
      else { const s = Math.min(MOVE_SPD * dt, d); p.x += dx / d * s; p.y += dy / d * s; }
    }

    // Check rock support after digging beneath
    for (const rock of this.rocks) {
      if (rock.done || rock.falling) continue;
      const below = rock.row + 1;
      if (below < ROWS && this.grid[below][rock.col] === 0 &&
          !this.rocks.some(r => r.col === rock.col && r.row === below && !r.done)) {
        rock.sup = false;
        if (rock.settled) { rock.settled = false; rock.delay = ROCK_DELAY; }
      }
    }
  }

  // ── Enemy AI ─────────────────────────────────────────────
  _updEnemies(dt) {
    const alive = this.enemies.filter(e => e.alive);
    const lastOne = alive.length === 1;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.inflate > 0) { e.wf = 0; continue; }
      e.wf += dt * 6;

      // Last enemy goes ghost mode — escapes to surface
      if (lastOne && !e.ghost) e.ghost = true;
      if (e.ghost) { this._ghostMove(e, dt, true); continue; }

      // Pooka can phase through dirt occasionally
      if (e.type === 'pooka' && !e.phasing && Math.random() < PHASE_CHANCE) {
        e.phasing = true;
        e.phaseT = rand(1.5, 3);
      }
      if (e.phasing) {
        this._ghostMove(e, dt, false);
        e.phaseT -= dt;
        if (e.phaseT <= 0) {
          e.phasing = false;
          e.col = Math.max(0, Math.min(COLS - 1, Math.round(e.x / CELL)));
          e.row = Math.max(0, Math.min(ROWS - 1, Math.round((e.y - SKY_H) / CELL)));
          e.x = e.col * CELL; e.y = SKY_H + e.row * CELL;
          e.tx = e.x; e.ty = e.y; e.moving = false;
          if (this.grid[e.row]) this.grid[e.row][e.col] = 0;
        }
        continue;
      }

      // Fygar fire breathing
      if (e.type === 'fygar') {
        e.fireCD -= dt;
        if (e.fireCD <= 0 && !e.moving) {
          if (e.row === this.player.row) {
            e.dir = this.player.col > e.col ? 0 : 2;
            this._spawnFire(e);
            e.fireCD = rand(3, 6);
          } else {
            e.fireCD = rand(1, 2);
          }
        }
      }

      // Standard tunnel movement
      if (!e.moving) this._chooseDir(e);
      if (e.moving) {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        const step = Math.min(e.spd * dt, d);
        if (d < 2) { e.x = e.tx; e.y = e.ty; e.moving = false; }
        else { e.x += dx / d * step; e.y += dy / d * step; }
      }
    }
  }

  _ghostMove(e, dt, escape) {
    const spd = e.spd * GHOST_SPD;
    let tx, ty;
    if (escape) {
      tx = e.col < COLS / 2 ? -CELL : (COLS + 1) * CELL;
      ty = SKY_H - CELL;
    } else {
      tx = this.player.x; ty = this.player.y;
    }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d > 2) { e.x += dx / d * spd * dt; e.y += dy / d * spd * dt; e.dir = dx > 0 ? 0 : 2; }
    if (escape && e.y < SKY_H - CELL) e.alive = false;
    e.col = Math.round(e.x / CELL);
    e.row = Math.round((e.y - SKY_H) / CELL);
  }

  _chooseDir(e) {
    const dirs = [{ dr: 0, dc: 1, d: 0 }, { dr: 1, dc: 0, d: 1 },
                  { dr: 0, dc: -1, d: 2 }, { dr: -1, dc: 0, d: 3 }];
    const scored = dirs.map(({ dr, dc, d }) => {
      const nr = e.row + dr, nc = e.col + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return null;
      if (this.grid[nr][nc] !== 0) return null;
      if ((d + 2) % 4 === e.dir) return null;
      if (this.rocks.some(r => r.col === nc && r.row === nr && !r.done)) return null;
      return { nr, nc, d, dist: Math.abs(nc - this.player.col) + Math.abs(nr - this.player.row) };
    }).filter(Boolean);

    if (!scored.length) {
      const rev = (e.dir + 2) % 4, rd = dirs[rev];
      const nr = e.row + rd.dr, nc = e.col + rd.dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && this.grid[nr][nc] === 0) {
        e.dir = rev; e.tx = nc * CELL; e.ty = SKY_H + nr * CELL;
        e.row = nr; e.col = nc; e.moving = true;
      }
      return;
    }
    scored.sort((a, b) => a.dist - b.dist);
    const ch = Math.random() < 0.7 ? scored[0] : scored[randI(0, scored.length - 1)];
    e.dir = ch.d; e.tx = ch.nc * CELL; e.ty = SKY_H + ch.nr * CELL;
    e.row = ch.nr; e.col = ch.nc; e.moving = true;
  }

  // ── Pump / Inflate ───────────────────────────────────────
  _updPump(dt) {
    const p = this.player;

    if (this.input.isDown('ACTION1') && !this.dying) {
      // Acquire target if none
      if (!this.pumpTarget) {
        const [dx, dy] = DIR_VEC[p.dir];
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const ec = Math.round(e.x / CELL), er = Math.round((e.y - SKY_H) / CELL);
          const dc = ec - p.col, dr = er - p.row;
          const along = dc * dx + dr * dy, perp = Math.abs(dc * dy - dr * dx);
          if (along > 0 && along <= PUMP_RANGE && perp === 0) {
            let blocked = false;
            for (let s = 1; s < along; s++) {
              const cr = p.row + dy * s, cc = p.col + dx * s;
              if (cr >= 0 && cr < ROWS && cc >= 0 && cc < COLS && this.grid[cr][cc] === 1) { blocked = true; break; }
            }
            if (!blocked) {
              this.pumpTarget = e;
              this.hose = { sx: p.x + CELL / 2, sy: p.y + CELL / 2, ex: e.x + CELL / 2, ey: e.y + CELL / 2 };
              this.audio.play('shoot', { volume: 0.3, pitch: 2 });
              break;
            }
          }
        }
      }

      // Pump inflation
      if (this.pumpTarget && this.pumpTarget.alive) {
        this.pumpTarget.inflate += INFLATE_RATE * dt;
        this.pumpTarget.moving = false;
        this.hose.sx = p.x + CELL / 2; this.hose.sy = p.y + CELL / 2;
        this.hose.ex = this.pumpTarget.x + CELL / 2; this.hose.ey = this.pumpTarget.y + CELL / 2;
        if (this.pumpTarget.inflate >= PUMPS_TO_POP) {
          this._pop(this.pumpTarget);
          this.pumpTarget = null; this.hose = null;
        }
      }
    } else {
      this.pumpTarget = null; this.hose = null;
    }

    // Deflate enemies not being pumped
    for (const e of this.enemies) {
      if (!e.alive || e === this.pumpTarget) continue;
      if (e.inflate > 0) e.inflate = Math.max(0, e.inflate - DEFLATE_RATE * dt);
    }
  }

  _pop(e) {
    e.alive = false;
    const ly = depthLayer(e.row);
    let pts = DEPTH_PTS[ly];
    if (e.type === 'fygar' && e.row === this.player.row) {
      pts *= 2;
      this.ach.unlock('dragon-slayer');
    }
    if (ly === 3) this.ach.unlock('deep-diver');

    this.addScore(pts, e.x + CELL / 2, e.y);
    this.audio.play('explosion', { volume: 0.5, pitch: 1.5 });
    this.effects.hit(2);
    this.particles.emit(e.x + CELL / 2, e.y + CELL / 2, {
      count: 15, speed: 120, speedVariance: 60, life: 0.5, lifeVariance: 0.2,
      size: 4, sizeVariance: 2, endSize: 0,
      color: e.type === 'pooka' ? ['#ff4444', '#ff8888', '#ffaaaa'] : ['#44cc44', '#88ff88', '#44ff44'],
      gravity: 100, friction: 0.96, shape: 'circle', angle: 0, spread: Math.PI,
    });
  }

  // ── Fire Breathing ───────────────────────────────────────
  _spawnFire(e) {
    const dx = e.dir === 0 ? 1 : -1;
    this.fires.push({
      x: e.x + (dx > 0 ? CELL : 0), y: e.y + CELL / 2 - 8,
      dir: dx, t: FIRE_DUR, row: e.row, rng: FIRE_RANGE * CELL,
    });
    this.audio.play('shoot', { volume: 0.4, pitch: 0.5 });
  }

  _updFire(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      if (Math.random() < 0.5) {
        this.particles.emit(f.x + f.dir * f.rng * (1 - f.t / FIRE_DUR), f.y, {
          count: 2, speed: 40, speedVariance: 20, life: 0.3, lifeVariance: 0.1,
          size: 5, sizeVariance: 2, endSize: 0, color: ['#ff4400', '#ff8800', '#ffcc00'],
          gravity: -40, friction: 0.97, shape: 'circle', angle: -Math.PI / 2, spread: 0.5,
        });
      }
    }
  }

  // ── Rocks ────────────────────────────────────────────────
  _updRocks(dt) {
    for (const rk of this.rocks) {
      if (rk.done) continue;

      if (!rk.sup && !rk.falling) {
        rk.delay -= dt;
        if (rk.delay <= 0) { rk.falling = true; this.audio.play('hit', { volume: 0.6, pitch: 0.5 }); }
      }
      if (!rk.falling) continue;

      rk.y += ROCK_SPD * dt;
      const gr = Math.round((rk.y - SKY_H) / CELL);

      // Hit ground or dirt
      if (gr >= ROWS || (gr >= 0 && gr < ROWS && this.grid[gr][rk.col] === 1)) {
        rk.falling = false; rk.done = true; this.rocksDrop++;
        this.audio.play('explosion', { volume: 0.6, pitch: 0.6 });
        this.effects.shake(4, 0.3);
        this.particles.emit(rk.x + CELL / 2, rk.y + CELL / 2, 'debris');

        // Spawn veggie on first rock drop
        if (this.rocksDrop === 1 && !this.veggie) {
          const vi = Math.min(this.level - 1, VEG_PTS.length - 1);
          this.veggie = { score: VEG_PTS[vi], x: (COLS / 2) * CELL, y: SKY_H - CELL + 4 };
          this.vegTimer = VEGGIE_DUR;
        }

        // Check enemy crush
        let cc = 0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const ec = Math.round(e.x / CELL), er = Math.round((e.y - SKY_H) / CELL);
          if (ec === rk.col && Math.abs(er - gr) <= 1) {
            e.alive = false; cc++;
            this.addScore(DEPTH_PTS[depthLayer(er)] * 2, e.x + CELL / 2, e.y);
          }
        }
        if (cc >= 1) this.ach.unlock('rock-drop');
        if (cc >= 2) this.ach.unlock('double-crush');
        continue;
      }

      // Carve tunnel as rock falls
      if (gr >= 0 && gr < ROWS) this.grid[gr][rk.col] = 0;

      // Check if rock hits player
      const pr = Math.round((this.player.y - SKY_H) / CELL);
      if (rk.col === this.player.col && pr === gr) this._kill();
    }
  }

  // ── Veggie ───────────────────────────────────────────────
  _updVeg(dt) {
    if (!this.veggie) return;
    this.vegTimer -= dt;
    if (this.vegTimer <= 0) { this.veggie = null; return; }
    if (Math.abs(this.player.x - this.veggie.x) < CELL * 0.8 &&
        Math.abs(this.player.y - this.veggie.y) < CELL * 0.8) {
      this.addScore(this.veggie.score, this.veggie.x + CELL / 2, this.veggie.y);
      this.audio.play('coin');
      this.veggie = null;
    }
  }

  // ── Collisions ───────────────────────────────────────────
  _collide() {
    if (this.dying) return;
    const p = this.player;

    for (const e of this.enemies) {
      if (!e.alive || e.inflate > 0.5) continue;
      if (Math.abs(p.x - e.x) < CELL * 0.6 && Math.abs(p.y - e.y) < CELL * 0.6) {
        this._kill(); return;
      }
    }

    for (const f of this.fires) {
      if (Math.round((p.y - SKY_H) / CELL) !== f.row) continue;
      const fe = f.x + f.dir * f.rng * (1 - f.t / FIRE_DUR);
      const mn = Math.min(f.x, fe), mx = Math.max(f.x, fe), px = p.x + CELL / 2;
      if (px > mn - 10 && px < mx + 10) { this._kill(); return; }
    }
  }

  _kill() {
    if (this.dying) return;
    this.dying = true; this.deathT = 1;
    this.audio.play('die');
    this.effects.shake(6, 0.4);
    this.particles.emit(this.player.x + CELL / 2, this.player.y + CELL / 2, 'explosion');
  }

  // ── Render ───────────────────────────────────────────────
  render(ctx) {
    // Sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, 800, SKY_H);
    ctx.fillStyle = '#5a8a3a';
    ctx.fillRect(0, SKY_H - 4, 800, 8);

    // Dirt & tunnels
    for (let r = 0; r < ROWS; r++) {
      const ly = depthLayer(r);
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL, y = SKY_H + r * CELL;
        if (this.grid[r][c]) {
          ctx.fillStyle = LAYERS[ly];
          ctx.fillRect(x, y, CELL, CELL);
          // Texture dots
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          for (let i = 0; i < 3; i++)
            ctx.fillRect(x + ((c * 7 + r * 13 + i * 17) % 30) + 5,
                         y + ((c * 11 + r * 7 + i * 23) % 28) + 6, 2, 2);
        } else {
          ctx.fillStyle = '#1a0e08';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    // Tunnel edge lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (this.grid[r][c]) continue;
      const x = c * CELL, y = SKY_H + r * CELL;
      if (c > 0 && this.grid[r][c - 1]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
      if (c < COLS - 1 && this.grid[r][c + 1]) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
      if (r > 0 && this.grid[r - 1][c]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
      if (r < ROWS - 1 && this.grid[r + 1][c]) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
    }

    // Rocks
    for (const rk of this.rocks) if (!rk.done) this._drawRock(ctx, rk.x, rk.y);

    // Veggie bonus item
    if (this.veggie) {
      const vx = this.veggie.x + CELL / 2, vy = this.veggie.y + CELL / 2;
      const sc = 1 + Math.sin(performance.now() / 200) * 0.1;
      ctx.save(); ctx.translate(vx, vy); ctx.scale(sc, sc);
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#44aa22';
      ctx.beginPath(); ctx.ellipse(-4, -14, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, -14, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(this.veggie.score, 0, 24);
      ctx.restore();
    }

    // Fire breaths
    for (const f of this.fires) {
      const prog = 1 - f.t / FIRE_DUR, len = f.rng * prog;
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(performance.now() / 50);
      const gr = ctx.createLinearGradient(f.x, f.y, f.x + f.dir * len, f.y);
      gr.addColorStop(0, '#ff4400'); gr.addColorStop(0.5, '#ff8800');
      gr.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = gr;
      const fw = Math.abs(len);
      ctx.fillRect(f.dir > 0 ? f.x : f.x - fw, f.y - 6, fw, 16);
      ctx.restore();
    }

    // Pump hose
    if (this.hose) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(this.hose.sx, this.hose.sy);
      ctx.lineTo(this.hose.ex, this.hose.ey); ctx.stroke(); ctx.setLineDash([]);
    }

    // Enemies
    for (const e of this.enemies) if (e.alive) this._drawEnemy(ctx, e);

    // Player (flickers during death)
    if (!this.dying || Math.floor(performance.now() / 100) % 2)
      this._drawPlayer(ctx);

    // Level clear overlay
    if (this.clearT > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL CLEAR!', 400, 280);
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText(`Level ${this.level} Complete`, 400, 330);
      ctx.restore();
    }
  }

  // ── Draw Helpers ─────────────────────────────────────────
  _drawPlayer(ctx) {
    const p = this.player, cx = p.x + CELL / 2, cy = p.y + CELL / 2;
    const bob = Math.sin(p.wf) * 2;
    ctx.save(); ctx.translate(cx, cy + bob);

    // Body
    ctx.fillStyle = '#4488ff'; ctx.fillRect(-10, -10, 20, 20);
    // Helmet
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -10, 10, Math.PI, 0); ctx.fill();
    // Visor
    ctx.fillStyle = '#224488'; ctx.beginPath(); ctx.arc(0, -10, 6, Math.PI * 1.2, Math.PI * 1.8); ctx.fill();
    // Legs
    const lg = Math.sin(p.wf * 2) * 3;
    ctx.fillStyle = '#4488ff'; ctx.fillRect(-8, 10, 6, 8 + lg); ctx.fillRect(2, 10, 6, 8 - lg);
    // Direction indicator
    const [dx, dy] = DIR_VEC[p.dir];
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(dx * 12 - 2, dy * 12 - 6, 4, 4);
    ctx.restore();
  }

  _drawEnemy(ctx, e) {
    const cx = e.x + CELL / 2, cy = e.y + CELL / 2;
    const sc = 1 + e.inflate * 0.35, bob = Math.sin(e.wf) * 1.5;
    ctx.save(); ctx.translate(cx, cy + bob); ctx.scale(sc, sc);
    if (e.phasing || e.ghost) ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 100) * 0.3;

    if (e.type === 'pooka') {
      ctx.fillStyle = e.inflate > 2 ? '#ff8888' : e.inflate > 1 ? '#ff6666' : '#ff4444';
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      // Goggles
      ctx.fillStyle = '#fff'; ctx.fillRect(-10, -7, 8, 6); ctx.fillRect(2, -7, 8, 6);
      ctx.fillStyle = '#222'; ctx.fillRect(-8, -5, 4, 3); ctx.fillRect(4, -5, 4, 3);
      if (e.inflate > 0) {
        ctx.fillStyle = '#880000'; ctx.beginPath();
        ctx.arc(0, 5, 3 + e.inflate * 2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // Fygar — dragon-like
      ctx.fillStyle = e.inflate > 2 ? '#88ff88' : e.inflate > 1 ? '#66dd66' : '#44bb44';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
      const sd = e.dir === 2 ? -1 : 1;
      ctx.fillStyle = '#44bb44'; ctx.fillRect(sd * 10, -4, sd * 8, 8);
      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sd * 4, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(sd * 5, -4, 2, 0, Math.PI * 2); ctx.fill();
      // Wings
      ctx.fillStyle = '#33aa33'; ctx.beginPath();
      ctx.moveTo(-4, -10); ctx.lineTo(4, -10); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
      if (e.inflate > 0) {
        ctx.fillStyle = '#116611'; ctx.beginPath();
        ctx.arc(sd * 2, 4, 2 + e.inflate * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawRock(ctx, x, y) {
    ctx.save(); ctx.translate(x + CELL / 2, y + CELL / 2);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(-16, 6); ctx.lineTo(-14, -10); ctx.lineTo(-4, -16); ctx.lineTo(10, -12);
    ctx.lineTo(16, -2); ctx.lineTo(14, 10); ctx.lineTo(4, 16); ctx.lineTo(-10, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aaa'; ctx.beginPath();
    ctx.moveTo(-8, -6); ctx.lineTo(-2, -12); ctx.lineTo(6, -8); ctx.lineTo(2, -2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#666'; ctx.beginPath();
    ctx.moveTo(4, 4); ctx.lineTo(12, 0); ctx.lineTo(10, 8); ctx.lineTo(2, 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── Menu / Game Over ─────────────────────────────────────
  updateMenu(dt) { this.menuT += dt; }

  renderMenu(ctx) {
    ctx.fillStyle = '#1a0e08'; ctx.fillRect(0, 0, 800, 600);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = LAYERS[i]; ctx.fillRect(0, 100 + i * 120, 800, 120); }

    // Animated digging player
    const digX = ((this.menuT * 80) % 900) - 50;
    ctx.fillStyle = '#1a0e08'; ctx.fillRect(digX - 30, 260, 60, 40);
    ctx.fillStyle = '#4488ff'; ctx.fillRect(digX - 8, 265, 16, 16);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(digX, 257, 8, Math.PI, 0); ctx.fill();

    ctx.save();
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 15;
    ctx.fillText('TUNNEL HERO', 400, 180);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff'; ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Dig tunnels! Inflate enemies! Drop rocks!', 400, 460);
    ctx.fillStyle = '#aaa'; ctx.font = '14px "Courier New", monospace';
    ctx.fillText('Arrow keys / WASD to move', 400, 500);
    ctx.fillText('SPACE to pump enemies', 400, 520);
    ctx.restore();
  }

  renderGameOver(ctx) {
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(0, 0, 800, 600);
  }
}

// ── Boot ─────────────────────────────────────────────────────
const game = new TunnelHeroGame();
game.start();

})();
