(function () { /* de-moduled */
'use strict';
/**
 * Star Guardian — Defender-style side-scrolling shooter
 * Built on the Galaxy Zone shared engine.
 */




// ── Constants ────────────────────────────────────────────────

const W = 800, H = 600;
const WORLD_W = W * 4;       // wide scrolling world
const GROUND_Y = 540;         // terrain floor
const RADAR_H = 30;           // minimap height at top
const RADAR_Y = 0;
const PLAY_TOP = RADAR_H + 4; // playfield top boundary

const PLAYER_W = 24, PLAYER_H = 14;
const PLAYER_ACCEL = 800;
const PLAYER_MAX_VX = 400;
const PLAYER_MAX_VY = 320;
const PLAYER_FRICTION = 0.92;
const PLAYER_V_FRICTION = 0.88;

const LASER_SPEED = 700;
const LASER_W = 16, LASER_H = 2;
const FIRE_RATE = 0.08;       // seconds between shots

const HUMAN_COUNT = 10;
const HUMAN_W = 6, HUMAN_H = 10;
const HUMAN_FALL_LETHAL = 200; // fall height that kills a human

const SMART_BOMBS_PER_LIFE = 3;

const LANDER_SPEED = 40;
const LANDER_GRAB_SPEED = 30;
const LANDER_CARRY_SPEED = 50;

const MUTANT_SPEED = 200;
const BOMBER_SPEED = 80;
const BOMBER_MINE_INTERVAL = 3;
const MINE_LIFETIME = 12;
const POD_SPEED = 30;
const SWARMER_SPEED = 250;
const BAITER_SPEED = 350;
const BAITER_INITIAL_DELAY = 20; // seconds before baiters start

const WAVE_INTRO_TIME = 2.5;
const WAVE_CLEAR_TIME = 2.5;

// ── Helpers ──────────────────────────────────────────────────

const rand = (lo, hi) => Math.random() * (hi - lo) + lo;
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const wrap = (x, w) => ((x % w) + w) % w;
const dist = (a, b) => {
  const dx = Math.min(Math.abs(a.x - b.x), WORLD_W - Math.abs(a.x - b.x));
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};
const worldDX = (from, to) => {
  let d = to - from;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
};

// ── Terrain Generation ───────────────────────────────────────

function generateTerrain(segments) {
  const pts = [];
  const step = WORLD_W / segments;
  for (let i = 0; i <= segments; i++) {
    const x = i * step;
    // layered sine waves for mountain silhouette
    let y = GROUND_Y;
    y -= Math.sin(i * 0.15) * 25;
    y -= Math.sin(i * 0.07 + 1) * 35;
    y -= Math.sin(i * 0.3 + 2) * 10;
    y -= Math.abs(Math.sin(i * 0.04)) * 20;
    // occasional city blocks
    if (i % 7 === 0) y -= randInt(5, 30);
    pts.push({ x, y });
  }
  return pts;
}

// ── Star field ───────────────────────────────────────────────

function generateStars(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(0, WORLD_W),
      y: rand(PLAY_TOP, GROUND_Y - 40),
      size: rand(0.5, 2),
      brightness: rand(0.3, 1),
      parallax: rand(0.2, 0.6),
    });
  }
  return stars;
}

// ── Game Class ───────────────────────────────────────────────

class StarGuardian extends GameEngine {
  init() {
    // Achievements
    this.achievements = new AchievementManager('star-guardian');
    this.achievements.define([
      { id: 'guardian', name: 'Guardian', description: 'Save your first human', icon: '\u{1F6E1}' },
      { id: 'smart-move', name: 'Smart Move', description: 'Destroy 5+ enemies with one smart bomb', icon: '\u{1F4A3}' },
      { id: 'full-rescue', name: 'Full Rescue', description: 'Complete a wave with all 10 humans alive', icon: '\u{1F31F}' },
      { id: 'mutant-slayer', name: 'Mutant Slayer', description: 'Defeat 10 mutants in one game', icon: '\u{2694}' },
      { id: 'star-defender', name: 'Star Defender', description: 'Reach wave 10', icon: '\u{1F680}' },
    ]);

    // Persistent stats
    this.mutantsKilled = 0;
    this.totalHumansSaved = 0;

    // Generate world
    this.terrain = generateTerrain(200);
    this.stars = generateStars(150);

    // Game objects
    this.player = null;
    this.lasers = [];
    this.enemies = [];
    this.mines = [];
    this.humans = [];
    this.smartBombs = 0;

    // Camera
    this.camX = 0;

    // Wave management
    this.wave = 1;
    this.waveTimer = 0;
    this.waveState = 'intro'; // intro, playing, clear
    this.baiterTimer = 0;
    this.planetDestroyed = false;

    // Fire timing
    this.fireTimer = 0;

    // Smart bomb tracking
    this.smartBombKillCount = 0;

    // Menu terrain scroll
    this.menuScroll = 0;
  }

  // ── State Transitions ──────────────────────────────────────

  onEnterState(state) {
    if (state === 'playing') {
      this._resetGame();
    }
  }

  _resetGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.mutantsKilled = 0;
    this.totalHumansSaved = 0;
    this.planetDestroyed = false;
    this.terrain = generateTerrain(200);
    this._initPlayer();
    this._initWave();
  }

  _initPlayer() {
    this.player = {
      x: WORLD_W / 2, y: H / 2,
      vx: 0, vy: 0,
      facing: 1, // 1 = right, -1 = left
      alive: true,
      respawnTimer: 0,
      invincible: 0,
    };
    this.smartBombs = SMART_BOMBS_PER_LIFE;
    this.lasers = [];
    this.mines = [];
    this.fireTimer = 0;
    this.camX = this.player.x - W / 2;
  }

  _initWave() {
    this.enemies = [];
    this.waveState = 'intro';
    this.waveTimer = WAVE_INTRO_TIME;
    this.baiterTimer = BAITER_INITIAL_DELAY - Math.min(this.wave * 1.5, 10);

    // Spawn humans if not planet-destroyed
    if (!this.planetDestroyed) {
      this.humans = [];
      for (let i = 0; i < HUMAN_COUNT; i++) {
        const tx = this._terrainYAt(rand(100, WORLD_W - 100));
        this.humans.push({
          x: rand(100, WORLD_W - 100),
          y: tx,
          vy: 0,
          grounded: true,
          alive: true,
          grabbed: false,
          grabber: null,
          falling: false,
          fallStart: 0,
        });
      }
    }

    // Spawn landers
    const landerCount = 4 + this.wave * 2;
    for (let i = 0; i < landerCount; i++) {
      this._spawnLander();
    }

    // Spawn bombers starting wave 2
    if (this.wave >= 2) {
      const bomberCount = Math.min(this.wave - 1, 4);
      for (let i = 0; i < bomberCount; i++) {
        this._spawnBomber();
      }
    }

    // Spawn pods starting wave 3
    if (this.wave >= 3) {
      const podCount = Math.min(Math.floor((this.wave - 2) / 2), 3);
      for (let i = 0; i < podCount; i++) {
        this._spawnPod();
      }
    }
  }

  // ── Enemy Spawning ─────────────────────────────────────────

  _spawnLander() {
    this.enemies.push({
      type: 'lander', x: rand(0, WORLD_W), y: rand(PLAY_TOP + 20, 120),
      vx: rand(-30, 30), vy: LANDER_SPEED,
      w: 14, h: 14,
      state: 'descending', // descending, grabbing, carrying
      target: null,
      hp: 1,
    });
  }

  _spawnBomber() {
    this.enemies.push({
      type: 'bomber', x: rand(0, WORLD_W), y: rand(PLAY_TOP + 40, 200),
      vx: (Math.random() > 0.5 ? 1 : -1) * BOMBER_SPEED, vy: 0,
      w: 16, h: 10,
      mineTimer: rand(1, BOMBER_MINE_INTERVAL),
      hp: 1,
    });
  }

  _spawnPod() {
    this.enemies.push({
      type: 'pod', x: rand(0, WORLD_W), y: rand(PLAY_TOP + 60, 250),
      vx: rand(-POD_SPEED, POD_SPEED), vy: rand(-POD_SPEED, POD_SPEED),
      w: 18, h: 18,
      hp: 1,
    });
  }

  _spawnSwarmer(x, y) {
    for (let i = 0; i < 5; i++) {
      this.enemies.push({
        type: 'swarmer', x, y,
        vx: rand(-SWARMER_SPEED, SWARMER_SPEED),
        vy: rand(-SWARMER_SPEED, SWARMER_SPEED),
        w: 6, h: 6,
        timer: 0,
        hp: 1,
      });
    }
  }

  _spawnMutant(x, y) {
    this.enemies.push({
      type: 'mutant', x, y,
      vx: 0, vy: 0,
      w: 14, h: 14,
      hp: 1,
    });
  }

  _spawnBaiter() {
    const px = this.player.x;
    this.enemies.push({
      type: 'baiter',
      x: wrap(px + (Math.random() > 0.5 ? W : -W), WORLD_W),
      y: rand(PLAY_TOP + 40, 300),
      vx: 0, vy: 0,
      w: 20, h: 8,
      hp: 2,
    });
    this.audio.play('hit', { pitch: 0.5 });
  }

  // ── Terrain Helpers ────────────────────────────────────────

  _terrainYAt(x) {
    const wx = wrap(x, WORLD_W);
    const step = WORLD_W / (this.terrain.length - 1);
    const idx = wx / step;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, this.terrain.length - 1);
    const t = idx - i0;
    return this.terrain[i0].y * (1 - t) + this.terrain[i1].y * t;
  }

  // ── Update ─────────────────────────────────────────────────

  update(dt) {
    if (!this.player.alive) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.achievements.reportScore(this.score);
          AchievementManager.checkCrossGame();
          this.gameOver();
          return;
        }
        this._respawnPlayer();
      }
      this._updateEnemies(dt);
      this._updateMines(dt);
      this._updateLasers(dt);
      return;
    }

    // Wave state machine
    if (this.waveState === 'intro') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.waveState = 'playing';
      this._updateCamera(dt);
      return;
    }

    if (this.waveState === 'clear') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave++;
        if (this.wave >= 10) {
          this.achievements.unlock('star-defender');
        }
        this._initWave();
      }
      this._updateCamera(dt);
      return;
    }

    // Main gameplay
    this._updatePlayer(dt);
    this._updateCamera(dt);
    this._updateLasers(dt);
    this._updateEnemies(dt);
    this._updateMines(dt);
    this._updateHumans(dt);
    this._checkCollisions();

    // Baiter spawning
    this.baiterTimer -= dt;
    if (this.baiterTimer <= 0) {
      this._spawnBaiter();
      this.baiterTimer = Math.max(5, 15 - this.wave);
    }

    // Check wave clear
    if (this.enemies.length === 0 && this.waveState === 'playing') {
      this.waveState = 'clear';
      this.waveTimer = WAVE_CLEAR_TIME;
      // Bonus for surviving humans
      const aliveHumans = this.humans.filter(h => h.alive).length;
      if (aliveHumans === HUMAN_COUNT) {
        this.achievements.unlock('full-rescue');
      }
      this.addScore(aliveHumans * 100);
      this.audio.play('powerup');
    }

    // Check if all humans dead
    if (!this.planetDestroyed && this.humans.length > 0 && this.humans.every(h => !h.alive)) {
      this._destroyPlanet();
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    const inp = this.input;

    // Invincibility timer
    if (p.invincible > 0) p.invincible -= dt;

    // Facing & horizontal thrust
    if (inp.isDown('RIGHT')) {
      p.facing = 1;
      p.vx += PLAYER_ACCEL * dt;
    } else if (inp.isDown('LEFT')) {
      p.facing = -1;
      p.vx -= PLAYER_ACCEL * dt;
    } else {
      p.vx *= PLAYER_FRICTION;
    }

    // Vertical movement
    if (inp.isDown('UP')) {
      p.vy -= PLAYER_ACCEL * 0.8 * dt;
    } else if (inp.isDown('DOWN')) {
      p.vy += PLAYER_ACCEL * 0.8 * dt;
    } else {
      p.vy *= PLAYER_V_FRICTION;
    }

    // Clamp speed
    p.vx = Math.max(-PLAYER_MAX_VX, Math.min(PLAYER_MAX_VX, p.vx));
    p.vy = Math.max(-PLAYER_MAX_VY, Math.min(PLAYER_MAX_VY, p.vy));

    // Move
    p.x = wrap(p.x + p.vx * dt, WORLD_W);
    p.y += p.vy * dt;

    // Clamp vertical
    const tY = this._terrainYAt(p.x) - PLAYER_H;
    p.y = Math.max(PLAY_TOP + PLAYER_H, Math.min(tY, p.y));

    // Fire
    this.fireTimer -= dt;
    if (inp.isDown('ACTION1') && this.fireTimer <= 0) {
      this._fireLaser();
      this.fireTimer = FIRE_RATE;
    }

    // Smart bomb
    if (inp.isPressed('ACTION2') && this.smartBombs > 0) {
      this._detonateSmartBomb();
    }

    // Hyperspace
    if (inp.isPressed('ACTION3')) {
      this._hyperspace();
    }

    // Engine trail particles
    if (Math.abs(p.vx) > 50 || Math.abs(p.vy) > 50) {
      const tx = p.x - p.facing * 12;
      const screenX = this._worldToScreenX(tx);
      if (screenX > -50 && screenX < W + 50) {
        this.particles.emit(screenX, p.y, {
          count: 1, speed: 40, angle: p.facing > 0 ? Math.PI : 0,
          spread: 0.3, life: 0.2, size: 3, endSize: 0,
          color: ['#0af', '#08f', '#06d'], friction: 0.95, shape: 'circle',
        });
      }
    }
  }

  _fireLaser() {
    const p = this.player;
    this.lasers.push({
      x: p.x + p.facing * 15,
      y: p.y,
      vx: LASER_SPEED * p.facing + p.vx * 0.3,
      dir: p.facing,
      life: 1.2,
    });
    this.audio.play('shoot', { pitch: rand(1.2, 1.6), volume: 0.5 });
  }

  _detonateSmartBomb() {
    this.smartBombs--;
    this.smartBombKillCount = 0;

    // Kill all on-screen enemies
    const killed = [];
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sx = this._worldToScreenX(e.x);
      if (sx > -50 && sx < W + 50) {
        killed.push(e);
        // Release grabbed human
        if (e.type === 'lander' && e.state === 'carrying' && e.target) {
          e.target.grabbed = false;
          e.target.grabber = null;
          e.target.falling = true;
          e.target.vy = 0;
          e.target.fallStart = e.target.y;
        }
        this._enemyExplosion(e);
        this.enemies.splice(i, 1);
        this.smartBombKillCount++;
      }
    }

    // Clear on-screen mines
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      const sx = this._worldToScreenX(m.x);
      if (sx > -50 && sx < W + 50) {
        this.mines.splice(i, 1);
      }
    }

    if (this.smartBombKillCount >= 5) {
      this.achievements.unlock('smart-move');
    }

    // Visual effect
    this.effects.flash('#fff', 0.4);
    this.effects.shake(12, 0.6);
    this.audio.play('explosion', { volume: 1, pitch: 0.5 });

    // Shockwave particles
    const sx = this._worldToScreenX(this.player.x);
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      this.particles.emit(sx, this.player.y, {
        count: 1, speed: 300, angle: a, spread: 0.05,
        life: 0.5, size: 4, endSize: 0,
        color: '#fff', friction: 0.96, shape: 'circle',
      });
    }
  }

  _hyperspace() {
    const p = this.player;
    p.x = rand(0, WORLD_W);
    p.y = rand(PLAY_TOP + 40, 300);
    p.vx = 0;
    p.vy = 0;
    // Risk: 15% chance of dying
    if (Math.random() < 0.15) {
      this._killPlayer();
    }
    this.audio.play('jump', { pitch: 0.6 });
    // Teleport flash
    const sx = this._worldToScreenX(p.x);
    this.particles.emit(sx, p.y, {
      count: 20, speed: 150, angle: 0, spread: Math.PI,
      life: 0.4, size: 3, endSize: 0,
      color: ['#fff', '#aaf', '#88f'], friction: 0.95, shape: 'circle',
    });
  }

  _killPlayer() {
    const p = this.player;
    if (p.invincible > 0) return;
    p.alive = false;
    p.respawnTimer = 2;
    this.lives--;

    // Explosion
    const sx = this._worldToScreenX(p.x);
    this.particles.emit(sx, p.y, 'explosion', 40);
    this.effects.shake(8, 0.5);
    this.effects.flash('#f44', 0.3);
    this.audio.play('die');
  }

  _respawnPlayer() {
    this.player.alive = true;
    this.player.invincible = 3;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.y = H / 2;
    this.smartBombs = SMART_BOMBS_PER_LIFE;
  }

  _destroyPlanet() {
    this.planetDestroyed = true;
    // All remaining landers become mutants
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.type === 'lander') {
        e.type = 'mutant';
        e.w = 14; e.h = 14;
      }
    }
    this.effects.shake(15, 1);
    this.effects.flash('#f80', 0.5);
    this.audio.play('explosion', { pitch: 0.3, volume: 1 });
  }

  // ── Camera ─────────────────────────────────────────────────

  _updateCamera(dt) {
    const target = this.player.x - W / 2 + this.player.vx * 0.15;
    const dx = worldDX(this.camX, target);
    this.camX = wrap(this.camX + dx * 4 * dt, WORLD_W);
  }

  _worldToScreenX(wx) {
    let dx = wx - this.camX;
    if (dx > WORLD_W / 2) dx -= WORLD_W;
    if (dx < -WORLD_W / 2) dx += WORLD_W;
    return dx;
  }

  // ── Lasers ─────────────────────────────────────────────────

  _updateLasers(dt) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.x = wrap(l.x + l.vx * dt, WORLD_W);
      l.life -= dt;
      if (l.life <= 0) {
        this.lasers.splice(i, 1);
      }
    }
  }

  // ── Enemies ────────────────────────────────────────────────

  _updateEnemies(dt) {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      switch (e.type) {
        case 'lander':
          this._updateLander(e, dt);
          break;
        case 'mutant':
          this._updateMutant(e, dt, p);
          break;
        case 'bomber':
          this._updateBomber(e, dt);
          break;
        case 'pod':
          e.x = wrap(e.x + e.vx * dt, WORLD_W);
          e.y += e.vy * dt;
          if (e.y < PLAY_TOP + 20 || e.y > GROUND_Y - 40) e.vy *= -1;
          break;
        case 'swarmer':
          this._updateSwarmer(e, dt, p);
          break;
        case 'baiter':
          this._updateBaiter(e, dt, p);
          break;
      }

      // Wrap horizontally
      e.x = wrap(e.x, WORLD_W);
    }
  }

  _updateLander(e, dt) {
    if (e.state === 'descending') {
      e.x = wrap(e.x + e.vx * dt, WORLD_W);
      e.y += e.vy * dt;
      // Look for a human to grab
      if (e.y > 300 && !this.planetDestroyed) {
        const closest = this.humans
          .filter(h => h.alive && !h.grabbed)
          .sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (closest && dist(e, closest) < 200) {
          e.state = 'grabbing';
          e.target = closest;
        }
      }
      const tY = this._terrainYAt(e.x) - 20;
      if (e.y >= tY) {
        e.vy = -Math.abs(e.vy);
        e.y = tY;
      }
      if (e.y <= PLAY_TOP + 20) e.vy = Math.abs(e.vy);
    } else if (e.state === 'grabbing') {
      // Move toward target human
      const t = e.target;
      if (!t || !t.alive) { e.state = 'descending'; e.vy = LANDER_SPEED; return; }
      const dx = worldDX(e.x, t.x);
      const dy = t.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) {
        e.x = wrap(e.x + (dx / d) * LANDER_GRAB_SPEED * dt * 3, WORLD_W);
        e.y += (dy / d) * LANDER_GRAB_SPEED * dt * 3;
      }
      if (d < 15) {
        e.state = 'carrying';
        t.grabbed = true;
        t.grabber = e;
        t.grounded = false;
        this.audio.play('hit', { pitch: 2, volume: 0.6 }); // scream
      }
    } else if (e.state === 'carrying') {
      // Carry human upward
      e.y -= LANDER_CARRY_SPEED * dt;
      e.x = wrap(e.x + e.vx * 0.5 * dt, WORLD_W);
      if (e.target) {
        e.target.x = e.x;
        e.target.y = e.y + 12;
      }
      // Reached top = becomes mutant
      if (e.y <= PLAY_TOP + 10) {
        if (e.target) {
          e.target.alive = false;
          e.target.grabbed = false;
        }
        this._spawnMutant(e.x, e.y);
        this.enemies.splice(this.enemies.indexOf(e), 1);
        return;
      }
    }
  }

  _updateMutant(e, dt, p) {
    // Aggressively home in on player
    if (!p.alive) { e.x = wrap(e.x + rand(-80, 80) * dt, WORLD_W); return; }
    const dx = worldDX(e.x, p.x);
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = MUTANT_SPEED + this.wave * 10;
    e.vx = (dx / d) * speed;
    e.vy = (dy / d) * speed;
    e.x = wrap(e.x + e.vx * dt, WORLD_W);
    e.y += e.vy * dt;
  }

  _updateBomber(e, dt) {
    e.x = wrap(e.x + e.vx * dt, WORLD_W);
    e.y += Math.sin(performance.now() * 0.001 + e.x) * 0.5;
    e.mineTimer -= dt;
    if (e.mineTimer <= 0) {
      e.mineTimer = BOMBER_MINE_INTERVAL + rand(-0.5, 0.5);
      this.mines.push({ x: e.x, y: e.y, life: MINE_LIFETIME, w: 6, h: 6 });
    }
  }

  _updateSwarmer(e, dt, p) {
    e.timer += dt;
    if (e.timer > 0.5) {
      e.timer = 0;
      if (p.alive) {
        const dx = worldDX(e.x, p.x);
        const dy = p.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        e.vx = (dx / d) * SWARMER_SPEED * rand(0.5, 1.5);
        e.vy = (dy / d) * SWARMER_SPEED * rand(0.5, 1.5);
      }
    }
    e.x = wrap(e.x + e.vx * dt, WORLD_W);
    e.y += e.vy * dt;
    e.y = Math.max(PLAY_TOP + 10, Math.min(GROUND_Y - 10, e.y));
  }

  _updateBaiter(e, dt, p) {
    if (!p.alive) return;
    const dx = worldDX(e.x, p.x);
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.vx += (dx / d) * BAITER_SPEED * 2 * dt;
    e.vy += (dy / d) * BAITER_SPEED * 2 * dt;
    const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    if (spd > BAITER_SPEED) {
      e.vx = (e.vx / spd) * BAITER_SPEED;
      e.vy = (e.vy / spd) * BAITER_SPEED;
    }
    e.x = wrap(e.x + e.vx * dt, WORLD_W);
    e.y += e.vy * dt;
    e.y = Math.max(PLAY_TOP + 10, Math.min(GROUND_Y - 10, e.y));
  }

  // ── Mines ──────────────────────────────────────────────────

  _updateMines(dt) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      this.mines[i].life -= dt;
      // Slight drift
      this.mines[i].y += Math.sin(performance.now() * 0.003 + i) * 0.3;
      if (this.mines[i].life <= 0) {
        this.mines.splice(i, 1);
      }
    }
  }

  // ── Humans ─────────────────────────────────────────────────

  _updateHumans(dt) {
    for (const h of this.humans) {
      if (!h.alive || h.grabbed) continue;

      if (h.falling) {
        h.vy += 400 * dt; // gravity
        h.y += h.vy * dt;
        const tY = this._terrainYAt(h.x);
        if (h.y >= tY) {
          h.y = tY;
          h.vy = 0;
          h.falling = false;
          h.grounded = true;
          // Check if fall was lethal
          if (h.y - h.fallStart > HUMAN_FALL_LETHAL) {
            h.alive = false;
            const sx = this._worldToScreenX(h.x);
            this.particles.emit(sx, h.y, {
              count: 8, speed: 60, angle: -Math.PI / 2, spread: 0.8,
              life: 0.5, size: 2, endSize: 0, color: '#f44', shape: 'circle',
            });
            this.audio.play('hit', { pitch: 0.7 });
          }
        }

        // Check if player catches them
        if (this.player.alive && !h.grounded) {
          const p = this.player;
          const dx = Math.abs(worldDX(h.x, p.x));
          const dy = Math.abs(h.y - p.y);
          if (dx < 20 && dy < 20) {
            // Caught! Ride on player
            h.falling = false;
            h.grabbed = true;
            h.grabber = 'player';
            this.addScore(500, this._worldToScreenX(h.x), h.y);
            this.audio.play('coin');
            this.totalHumansSaved++;
            this.achievements.unlock('guardian');
          }
        }
      }

      // If riding on player, follow and set down when near ground
      if (h.grabbed && h.grabber === 'player' && this.player.alive) {
        h.x = this.player.x;
        h.y = this.player.y + 12;
        const tY = this._terrainYAt(h.x);
        if (h.y >= tY - 5) {
          h.grabbed = false;
          h.grabber = null;
          h.grounded = true;
          h.y = tY;
          this.addScore(500, this._worldToScreenX(h.x), h.y);
          this.audio.play('powerup');
        }
      }
    }
  }

  // ── Collisions ─────────────────────────────────────────────

  _checkCollisions() {
    const p = this.player;
    if (!p.alive) return;

    // Lasers vs enemies
    for (let li = this.lasers.length - 1; li >= 0; li--) {
      const l = this.lasers[li];
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        const dx = Math.abs(worldDX(l.x, e.x));
        const dy = Math.abs(l.y - e.y);
        if (dx < e.w && dy < e.h) {
          // Hit
          e.hp--;
          if (e.hp <= 0) {
            this._destroyEnemy(e, ei);
          } else {
            this.audio.play('hit', { volume: 0.4 });
          }
          this.lasers.splice(li, 1);
          break;
        }
      }
    }

    // Lasers vs mines
    for (let li = this.lasers.length - 1; li >= 0; li--) {
      const l = this.lasers[li];
      for (let mi = this.mines.length - 1; mi >= 0; mi--) {
        const m = this.mines[mi];
        const dx = Math.abs(worldDX(l.x, m.x));
        const dy = Math.abs(l.y - m.y);
        if (dx < m.w + 4 && dy < m.h + 4) {
          const sx = this._worldToScreenX(m.x);
          this.particles.emit(sx, m.y, 'sparkle', 6);
          this.mines.splice(mi, 1);
          this.lasers.splice(li, 1);
          this.addScore(25);
          this.audio.play('hit', { volume: 0.3 });
          break;
        }
      }
    }

    // Player vs enemies
    if (p.invincible <= 0) {
      for (const e of this.enemies) {
        const dx = Math.abs(worldDX(p.x, e.x));
        const dy = Math.abs(p.y - e.y);
        if (dx < (PLAYER_W + e.w) / 2 && dy < (PLAYER_H + e.h) / 2) {
          this._killPlayer();
          break;
        }
      }

      // Player vs mines
      for (const m of this.mines) {
        const dx = Math.abs(worldDX(p.x, m.x));
        const dy = Math.abs(p.y - m.y);
        if (dx < (PLAYER_W + m.w) / 2 && dy < (PLAYER_H + m.h) / 2) {
          this._killPlayer();
          break;
        }
      }
    }
  }

  _destroyEnemy(e, idx) {
    // Points
    const points = { lander: 150, mutant: 150, bomber: 250, pod: 1000, swarmer: 150, baiter: 200 };
    const pts = points[e.type] || 100;
    this.addScore(pts, this._worldToScreenX(e.x), e.y);

    if (e.type === 'mutant') {
      this.mutantsKilled++;
      if (this.mutantsKilled >= 10) {
        this.achievements.unlock('mutant-slayer');
      }
    }

    // Release grabbed human
    if (e.type === 'lander' && (e.state === 'carrying' || e.state === 'grabbing') && e.target) {
      const h = e.target;
      h.grabbed = false;
      h.grabber = null;
      if (!h.grounded) {
        h.falling = true;
        h.vy = 0;
        h.fallStart = h.y;
      }
    }

    // Pod splits into swarmers
    if (e.type === 'pod') {
      this._spawnSwarmer(e.x, e.y);
    }

    this._enemyExplosion(e);
    this.enemies.splice(idx, 1);
  }

  _enemyExplosion(e) {
    const colors = {
      lander: ['#f44', '#f88', '#faa'],
      mutant: ['#f0f', '#f8f', '#faf'],
      bomber: ['#4f4', '#8f8', '#afa'],
      pod: ['#ff0', '#ff8', '#ffa'],
      swarmer: ['#4ff', '#8ff', '#aff'],
      baiter: ['#f80', '#fa0', '#fc0'],
    };
    const sx = this._worldToScreenX(e.x);
    this.particles.emit(sx, e.y, {
      count: 15, speed: 120, speedVariance: 60, angle: 0, spread: Math.PI,
      life: 0.4, lifeVariance: 0.15, size: 4, sizeVariance: 2, endSize: 0,
      color: colors[e.type] || ['#fff'], friction: 0.95, shape: 'circle',
    });
    this.audio.play('explosion', { pitch: rand(0.8, 1.4), volume: 0.6 });
  }

  // ── Render ─────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Stars
    this._renderStars(ctx);

    // Terrain
    if (!this.planetDestroyed) {
      this._renderTerrain(ctx);
    }

    // Humans
    this._renderHumans(ctx);

    // Lasers
    this._renderLasers(ctx);

    // Enemies
    this._renderEnemies(ctx);

    // Mines
    this._renderMines(ctx);

    // Player
    this._renderPlayer(ctx);

    // Radar
    this._renderRadar(ctx);

    // Wave states
    if (this.waveState === 'intro') {
      this._renderWaveIntro(ctx);
    } else if (this.waveState === 'clear') {
      this._renderWaveClear(ctx);
    }
  }

  _renderStars(ctx) {
    for (const s of this.stars) {
      let sx = this._worldToScreenX(s.x) * s.parallax + (1 - s.parallax) * W / 2;
      // Simple wrap for stars on screen
      sx = ((sx % W) + W) % W;
      if (this.planetDestroyed || (s.y < GROUND_Y - 20)) {
        ctx.globalAlpha = s.brightness * (0.6 + 0.4 * Math.sin(performance.now() * 0.002 + s.x));
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  _renderTerrain(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, H);

    const step = WORLD_W / (this.terrain.length - 1);
    for (let i = 0; i < this.terrain.length; i++) {
      const sx = this._worldToScreenX(this.terrain[i].x);
      // Only draw visible segment
      if (sx > -step * 2 && sx < W + step * 2) {
        ctx.lineTo(sx, this.terrain[i].y);
      }
    }

    ctx.lineTo(W, H);
    ctx.closePath();

    // Gradient terrain fill
    const grad = ctx.createLinearGradient(0, GROUND_Y - 60, 0, H);
    grad.addColorStop(0, '#1a5');
    grad.addColorStop(0.4, '#083');
    grad.addColorStop(1, '#041');
    ctx.fillStyle = grad;
    ctx.fill();

    // Terrain outline
    ctx.strokeStyle = '#2f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const sx = this._worldToScreenX(this.terrain[i].x);
      if (sx > -step * 2 && sx < W + step * 2) {
        if (i === 0 || this._worldToScreenX(this.terrain[i - 1].x) <= -step * 2) {
          ctx.moveTo(sx, this.terrain[i].y);
        } else {
          ctx.lineTo(sx, this.terrain[i].y);
        }
      }
    }
    ctx.stroke();
  }

  _renderHumans(ctx) {
    for (const h of this.humans) {
      if (!h.alive) continue;
      const sx = this._worldToScreenX(h.x);
      if (sx < -20 || sx > W + 20) continue;

      ctx.fillStyle = h.grabbed ? '#ff0' : '#0f0';
      // Simple humanoid shape
      ctx.fillRect(sx - 2, h.y - HUMAN_H, 4, 6); // body
      ctx.fillRect(sx - 3, h.y - HUMAN_H + 6, 6, 4); // legs
      ctx.fillStyle = '#ff8';
      ctx.fillRect(sx - 2, h.y - HUMAN_H - 3, 4, 3); // head
    }
  }

  _renderLasers(ctx) {
    for (const l of this.lasers) {
      const sx = this._worldToScreenX(l.x);
      if (sx < -20 || sx > W + 20) continue;

      ctx.fillStyle = '#0ff';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(sx - LASER_W / 2, l.y - LASER_H / 2, LASER_W, LASER_H);
      ctx.shadowBlur = 0;
    }
  }

  _renderEnemies(ctx) {
    for (const e of this.enemies) {
      const sx = this._worldToScreenX(e.x);
      if (sx < -30 || sx > W + 30) continue;

      ctx.save();
      switch (e.type) {
        case 'lander':
          this._drawLander(ctx, sx, e.y, e);
          break;
        case 'mutant':
          this._drawMutant(ctx, sx, e.y);
          break;
        case 'bomber':
          this._drawBomber(ctx, sx, e.y);
          break;
        case 'pod':
          this._drawPod(ctx, sx, e.y);
          break;
        case 'swarmer':
          this._drawSwarmer(ctx, sx, e.y);
          break;
        case 'baiter':
          this._drawBaiter(ctx, sx, e.y);
          break;
      }
      ctx.restore();
    }
  }

  _drawLander(ctx, x, y, e) {
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x + 5, y + 7);
    ctx.lineTo(x - 5, y + 7);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
    // Indicator when carrying
    if (e.state === 'carrying') {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
    }
  }

  _drawMutant(ctx, x, y) {
    const t = performance.now() * 0.01;
    ctx.fillStyle = `hsl(${(t * 10) % 360}, 100%, 60%)`;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t;
      const r = 7 + Math.sin(t * 3 + i) * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawBomber(ctx, x, y) {
    ctx.fillStyle = '#4f4';
    ctx.fillRect(x - 8, y - 5, 16, 10);
    ctx.fillStyle = '#2a2';
    ctx.fillRect(x - 5, y - 3, 10, 6);
  }

  _drawPod(ctx, x, y) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a80';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSwarmer(ctx, x, y) {
    ctx.fillStyle = '#4ff';
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }

  _drawBaiter(ctx, x, y) {
    ctx.fillStyle = '#f80';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fa0';
    ctx.fillRect(x - 4, y - 2, 8, 4);
  }

  _renderMines(ctx) {
    for (const m of this.mines) {
      const sx = this._worldToScreenX(m.x);
      if (sx < -10 || sx > W + 10) continue;
      const flash = Math.sin(performance.now() * 0.01) > 0;
      ctx.fillStyle = flash ? '#f44' : '#a22';
      ctx.fillRect(sx - 3, m.y - 3, 6, 6);
    }
  }

  _renderPlayer(ctx) {
    const p = this.player;
    if (!p.alive) return;

    // Invincibility blink
    if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) return;

    const sx = this._worldToScreenX(p.x);
    const dir = p.facing;

    ctx.save();
    ctx.translate(sx, p.y);
    if (dir < 0) ctx.scale(-1, 1);

    // Ship body
    ctx.fillStyle = '#0ef';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#fff';
    ctx.fillRect(4, -2, 5, 4);

    // Engine glow
    ctx.fillStyle = '#08f';
    ctx.fillRect(-10, -3, 4, 6);

    ctx.restore();
  }

  // ── Radar / Minimap ────────────────────────────────────────

  _renderRadar(ctx) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 40, 0.85)';
    ctx.fillRect(0, RADAR_Y, W, RADAR_H);
    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, RADAR_Y, W, RADAR_H);

    const mapScale = W / WORLD_W;
    const radarH = RADAR_H - 4;
    const worldH = GROUND_Y - PLAY_TOP;

    const dot = (wx, wy, color, size = 2) => {
      const rx = wrap(wx, WORLD_W) * mapScale;
      const ry = RADAR_Y + 2 + ((wy - PLAY_TOP) / worldH) * radarH;
      ctx.fillStyle = color;
      ctx.fillRect(rx - size / 2, ry - size / 2, size, size);
    };

    // Terrain line on radar
    ctx.strokeStyle = '#1a5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.terrain.length; i += 3) {
      const rx = this.terrain[i].x * mapScale;
      const ry = RADAR_Y + 2 + ((this.terrain[i].y - PLAY_TOP) / worldH) * radarH;
      i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
    }
    ctx.stroke();

    // Humans
    for (const h of this.humans) {
      if (h.alive) dot(h.x, h.y, '#0f0', 2);
    }

    // Enemies
    for (const e of this.enemies) {
      const colors = {
        lander: '#f44', mutant: '#f0f', bomber: '#4f4',
        pod: '#ff0', swarmer: '#4ff', baiter: '#f80',
      };
      dot(e.x, e.y, colors[e.type] || '#f00', e.type === 'baiter' ? 3 : 2);
    }

    // Player
    if (this.player.alive) {
      dot(this.player.x, this.player.y, '#fff', 3);
    }

    // Viewport indicator
    const vpLeft = wrap(this.camX, WORLD_W) * mapScale;
    const vpW = W * mapScale;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpLeft, RADAR_Y + 1, vpW, RADAR_H - 2);
  }

  // ── Wave UI ────────────────────────────────────────────────

  _renderWaveIntro(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText(`WAVE ${this.wave}`, W / 2, H / 2 - 30);

    const aliveHumans = this.humans.filter(h => h.alive).length;
    ctx.fillStyle = '#0f0';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(`${aliveHumans} HUMANS REMAINING`, W / 2, H / 2 + 20);

    ctx.restore();
  }

  _renderWaveClear(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillText('WAVE CLEAR!', W / 2, H / 2 - 30);

    const aliveHumans = this.humans.filter(h => h.alive).length;
    ctx.fillStyle = '#0f0';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(`HUMANS SAVED: ${aliveHumans}/${HUMAN_COUNT}`, W / 2, H / 2 + 10);
    ctx.fillStyle = '#ff8';
    ctx.fillText(`BONUS: ${aliveHumans * 100}`, W / 2, H / 2 + 40);

    ctx.restore();
  }

  // ── HUD Override ───────────────────────────────────────────

  drawHUD(ctx) {
    // Score
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = `SCORE ${String(this.score).padStart(8, '0')}`;
    const waveEl = document.getElementById('hud-wave');
    if (waveEl) waveEl.textContent = `WAVE ${this.wave}`;
    const livesEl = document.getElementById('hud-lives');
    if (livesEl) {
      livesEl.innerHTML = '\u2764'.repeat(Math.max(0, this.lives)) +
        ` | BOMBS: ${this.smartBombs}`;
    }
  }

  // ── Menu ───────────────────────────────────────────────────

  updateMenu(dt) {
    this.menuScroll += dt * 60;
  }

  renderMenu(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Animated stars
    for (let i = 0; i < 80; i++) {
      const x = (i * 47 + this.menuScroll * 0.3) % W;
      const y = (i * 73 + Math.sin(i) * 50 + 100) % (H - 100);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.15})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Scrolling terrain preview
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < W; i += 4) {
      const wx = (i + this.menuScroll) * 3;
      const ty = GROUND_Y - Math.sin(wx * 0.003) * 25 - Math.sin(wx * 0.007) * 15;
      ctx.lineTo(i, ty);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = '#083';
    ctx.fill();
    ctx.strokeStyle = '#2f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < W; i += 4) {
      const wx = (i + this.menuScroll) * 3;
      const ty = GROUND_Y - Math.sin(wx * 0.003) * 25 - Math.sin(wx * 0.007) * 15;
      i === 0 ? ctx.moveTo(i, ty) : ctx.lineTo(i, ty);
    }
    ctx.stroke();

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 54px "Courier New", monospace';
    ctx.fillText('STAR GUARDIAN', W / 2, H * 0.25);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#08a';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('DEFEND THE HUMANS', W / 2, H * 0.35);

    // Controls info
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New", monospace';
    const controls = [
      'ARROWS / WASD: Move & Face direction',
      'SPACE: Rapid Fire',
      'Z: Smart Bomb',
      'X: Hyperspace (risky!)',
    ];
    controls.forEach((line, i) => {
      ctx.fillText(line, W / 2, H * 0.44 + i * 22);
    });

    // High score
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`HIGH SCORE: ${this.highScore}`, W / 2, H * 0.55);

    ctx.restore();
  }

  renderGameOver(ctx) {
    // Additional game-over info drawn under the default overlay
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f0';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(`HUMANS SAVED: ${this.totalHumansSaved}`, W / 2, H * 0.6);
    ctx.fillStyle = '#0af';
    ctx.fillText(`WAVES REACHED: ${this.wave}`, W / 2, H * 0.65);
    ctx.restore();
  }
}

// ── Bootstrap ────────────────────────────────────────────────

const game = new StarGuardian('game-canvas', {
  width: W, height: H, background: '#000',
});
game.start();

})();
