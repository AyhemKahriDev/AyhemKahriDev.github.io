(function () { /* de-moduled */
'use strict';
/**
 * Robotron — Robotron: 2084-style twin-stick shooter
 * The secret 16th game. Sal's cursed cabinet — finally rebuilt in digital form.
 * Built on the Galaxy Zone shared engine.
 */







// ── Constants ────────────────────────────────────────────────

const W = 800, H = 600;
const BORDER = 30;
const ARENA = { x: BORDER, y: BORDER, w: W - BORDER * 2, h: H - BORDER * 2 };
const PLAYER_R = 10, PLAYER_SPEED = 220;
const BULLET_SPEED = 500, BULLET_R = 3, FIRE_RATE = 0.08;
const ENEMY_BULLET_SPEED = 200;
const HUMAN_SPEED = 40;
const SPAWN_MARGIN = 60;

// Enemy colors
const COLORS = {
  player: '#00ffff', bullet: '#ffff00',
  grunt: '#4488ff', electrode: '#ff2244', hulk: '#22ff44',
  brain: '#ff8800', prog: '#ff44ff', spheroid: '#ff66ff',
  enforcer: '#cc44ff', quark: '#ffaa00', tank: '#ff6644',
  human: '#00ff88', humanMom: '#ff88cc', humanDad: '#88ccff', humanKid: '#ffff66',
  eBullet: '#ff4488', tBullet: '#ff8844',
};

// ── Twin-stick raw key tracking ──────────────────────────────
// We bypass InputManager for movement/shooting since it maps WASD
// and arrows to the same actions. We still use InputManager for
// START, PAUSE, etc.

const moveKeys = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
const shootKeys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const rawHeld = {};

document.addEventListener('keydown', e => {
  if (moveKeys[e.code] || shootKeys[e.code]) { e.preventDefault(); rawHeld[e.code] = true; }
});
document.addEventListener('keyup', e => {
  if (moveKeys[e.code] || shootKeys[e.code]) rawHeld[e.code] = false;
});

function getMoveDir() {
  let dx = 0, dy = 0;
  if (rawHeld.KeyA) dx -= 1;
  if (rawHeld.KeyD) dx += 1;
  if (rawHeld.KeyW) dy -= 1;
  if (rawHeld.KeyS) dy += 1;
  const len = Math.hypot(dx, dy);
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

function getShootDir() {
  let dx = 0, dy = 0;
  if (rawHeld.ArrowLeft) dx -= 1;
  if (rawHeld.ArrowRight) dx += 1;
  if (rawHeld.ArrowUp) dy -= 1;
  if (rawHeld.ArrowDown) dy += 1;
  const len = Math.hypot(dx, dy);
  return len > 0 ? { x: dx / len, y: dy / len } : null;
}

// ── Wave definitions ─────────────────────────────────────────

function getWaveConfig(wave) {
  const w = wave;
  return {
    grunts:      Math.min(10 + w * 5, 80),
    electrodes:  Math.min(3 + w * 2, 25),
    hulks:       Math.max(0, Math.min(Math.floor((w - 1) * 1.2), 8)),
    brains:      Math.max(0, Math.min(w - 3, 5)),
    spheroids:   Math.max(0, Math.min(Math.floor((w - 4) * 0.6), 4)),
    quarks:      Math.max(0, Math.min(Math.floor((w - 8) * 0.5), 3)),
    humans:      Math.min(3 + Math.floor(w * 0.8), 9),
    gruntSpeed:  60 + w * 6,
  };
}

// ── Entity factories ─────────────────────────────────────────

function spawnOnEdge() {
  const side = randomInt(0, 3);
  switch (side) {
    case 0: return { x: ARENA.x + SPAWN_MARGIN, y: randomRange(ARENA.y + SPAWN_MARGIN, ARENA.y + ARENA.h - SPAWN_MARGIN) };
    case 1: return { x: ARENA.x + ARENA.w - SPAWN_MARGIN, y: randomRange(ARENA.y + SPAWN_MARGIN, ARENA.y + ARENA.h - SPAWN_MARGIN) };
    case 2: return { x: randomRange(ARENA.x + SPAWN_MARGIN, ARENA.x + ARENA.w - SPAWN_MARGIN), y: ARENA.y + SPAWN_MARGIN };
    case 3: return { x: randomRange(ARENA.x + SPAWN_MARGIN, ARENA.x + ARENA.w - SPAWN_MARGIN), y: ARENA.y + ARENA.h - SPAWN_MARGIN };
  }
}

function spawnInArena() {
  return {
    x: randomRange(ARENA.x + 60, ARENA.x + ARENA.w - 60),
    y: randomRange(ARENA.y + 60, ARENA.y + ARENA.h - 60),
  };
}

function makeEnemy(type, pos, speed) {
  return { type, x: pos.x, y: pos.y, r: 10, speed: speed || 60, alive: true, timer: 0, angle: 0, spawnTimer: 0 };
}

function makeHuman(subtype, pos) {
  return {
    type: 'human', subtype, x: pos.x, y: pos.y, r: 8, alive: true,
    vx: randomRange(-1, 1), vy: randomRange(-1, 1), timer: 0,
  };
}

// ── Main Game ────────────────────────────────────────────────

class Robotron extends GameEngine {
  init() {
    this.achievements = new AchievementManager('robotron');
    this.achievements.define([
      { id: 'first-rescue',   name: 'Last Human Hope',  description: 'Rescue your first human family member', icon: '\u{1F9D1}' },
      { id: 'chain-rescuer',  name: 'Chain Rescuer',    description: 'Rescue 5 humans in one wave (hit 5000 pts bonus)', icon: '\u{1F517}' },
      { id: 'hulk-wrangler',  name: 'Hulk Wrangler',    description: 'Push a Hulk into 3 other enemies', icon: '\u{1F4AA}' },
      { id: 'wave-10',        name: 'Wave 10',           description: 'Survive to wave 10', icon: '\u{1F30A}' },
      { id: 'master',         name: 'Robotron Master',   description: 'Score 100,000+ points', icon: '\u{1F3C6}' },
    ]);

    this.player = { x: W / 2, y: H / 2, r: PLAYER_R, alive: true };
    this.bullets = [];
    this.enemies = [];
    this.humans = [];
    this.eBullets = [];
    this.fireTimer = 0;
    this.wave = 0;
    this.waveIntroTimer = 0;
    this.humanRescueCount = 0;
    this.totalHumansRescued = 0;
    this.respawnTimer = 0;
    this.borderPhase = 0;
    this.menuEnemies = [];
    this.hulkKills = new Map(); // hulkId -> count of enemies pushed into

    for (let i = 0; i < 30; i++) {
      this.menuEnemies.push({
        x: randomRange(BORDER, W - BORDER), y: randomRange(BORDER, H - BORDER),
        vx: randomRange(-80, 80), vy: randomRange(-80, 80),
        type: randomChoice(['grunt', 'electrode', 'hulk', 'brain', 'spheroid']),
      });
    }
  }

  _startGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.level = 1;
    this.bullets = [];
    this.enemies = [];
    this.humans = [];
    this.eBullets = [];
    this.totalHumansRescued = 0;
    this.particles.clear();
    this.player.x = W / 2;
    this.player.y = H / 2;
    this.player.alive = true;
    this.respawnTimer = 0;
    this.audio.play('start');
    this.startWave();
    this.setState('playing');
  }

  startWave() {
    this.wave++;
    this.level = this.wave;
    this.waveIntroTimer = 1.5;
    this.humanRescueCount = 0;
    this.bullets = [];
    this.eBullets = [];
    this.enemies = [];
    this.humans = [];
    this.hulkKills.clear();

    const cfg = getWaveConfig(this.wave);

    // Spawn enemies away from player
    const spawnAway = () => {
      let pos;
      for (let tries = 0; tries < 20; tries++) {
        pos = spawnOnEdge();
        if (vec2Dist(pos, this.player) > 150) return pos;
      }
      return pos || spawnOnEdge();
    };

    for (let i = 0; i < cfg.grunts; i++) this.enemies.push(makeEnemy('grunt', spawnAway(), cfg.gruntSpeed));
    for (let i = 0; i < cfg.electrodes; i++) this.enemies.push(makeEnemy('electrode', spawnInArena(), 0));
    for (let i = 0; i < cfg.hulks; i++) this.enemies.push(makeEnemy('hulk', spawnAway(), 35));
    for (let i = 0; i < cfg.brains; i++) this.enemies.push(makeEnemy('brain', spawnAway(), 55));
    for (let i = 0; i < cfg.spheroids; i++) {
      const e = makeEnemy('spheroid', spawnAway(), 50);
      e.spawnTimer = randomRange(3, 6);
      this.enemies.push(e);
    }
    for (let i = 0; i < cfg.quarks; i++) {
      const e = makeEnemy('quark', spawnAway(), 45);
      e.spawnTimer = randomRange(4, 7);
      this.enemies.push(e);
    }

    const humanTypes = ['dad', 'mom', 'kid'];
    for (let i = 0; i < cfg.humans; i++) {
      this.humans.push(makeHuman(humanTypes[i % 3], spawnInArena()));
    }

    this.effects.flash('#ffffff', 0.15);
    this.audio.play('powerup');

    if (this.wave >= 10) this.achievements.unlock('wave-10');
  }

  update(dt) {
    this.borderPhase += dt * 2;

    // Wave intro countdown
    if (this.waveIntroTimer > 0) {
      this.waveIntroTimer -= dt;
      return;
    }

    // Respawn delay
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.player.alive = true;
        this.player.x = W / 2;
        this.player.y = H / 2;
        this.effects.flash('#00ffff', 0.2);
      }
      return;
    }

    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateHumans(dt);
    this.updateEnemyBullets(dt);
    this.checkCollisions();
    this.checkWaveComplete();
  }

  updatePlayer(dt) {
    if (!this.player.alive) return;

    const move = getMoveDir();
    this.player.x += move.x * PLAYER_SPEED * dt;
    this.player.y += move.y * PLAYER_SPEED * dt;
    this.player.x = clamp(this.player.x, ARENA.x + PLAYER_R, ARENA.x + ARENA.w - PLAYER_R);
    this.player.y = clamp(this.player.y, ARENA.y + PLAYER_R, ARENA.y + ARENA.h - PLAYER_R);

    // Shooting
    this.fireTimer -= dt;
    const shootDir = getShootDir();
    if (shootDir && this.fireTimer <= 0) {
      this.fireTimer = FIRE_RATE;
      this.bullets.push({
        x: this.player.x, y: this.player.y,
        vx: shootDir.x * BULLET_SPEED, vy: shootDir.y * BULLET_SPEED,
        r: BULLET_R,
      });
      this.audio.play('shoot', { volume: 0.3, pitch: randomRange(1.2, 1.6) });
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < ARENA.x || b.x > ARENA.x + ARENA.w || b.y < ARENA.y || b.y > ARENA.y + ARENA.h) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemies(dt) {
    const px = this.player.x, py = this.player.y;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.timer += dt;
      e.angle += dt * 3;

      switch (e.type) {
        case 'grunt': {
          const dir = vec2Normalize({ x: px - e.x, y: py - e.y });
          e.x += dir.x * e.speed * dt;
          e.y += dir.y * e.speed * dt;
          break;
        }
        case 'electrode':
          // Stationary
          break;
        case 'hulk': {
          const dir = vec2Normalize({ x: px - e.x, y: py - e.y });
          e.x += dir.x * e.speed * dt;
          e.y += dir.y * e.speed * dt;
          break;
        }
        case 'brain': {
          // Seek nearest human, or player if no humans
          let target = this.findNearestHuman(e);
          if (!target) target = this.player;
          const dir = vec2Normalize({ x: target.x - e.x, y: target.y - e.y });
          e.x += dir.x * e.speed * dt;
          e.y += dir.y * e.speed * dt;
          // Convert human on contact
          for (let i = this.humans.length - 1; i >= 0; i--) {
            const h = this.humans[i];
            if (h.alive && vec2Dist(e, h) < e.r + h.r) {
              h.alive = false;
              this.enemies.push(makeEnemy('prog', { x: h.x, y: h.y }, 100));
              this.effects.flash('#ff8800', 0.1);
              this.audio.play('hit', { pitch: 0.5 });
              this.particles.emit(h.x, h.y, 'explosion', 10);
            }
          }
          break;
        }
        case 'prog': {
          const dir = vec2Normalize({ x: px - e.x, y: py - e.y });
          e.x += dir.x * e.speed * dt;
          e.y += dir.y * e.speed * dt;
          break;
        }
        case 'spheroid': {
          // Float around semi-randomly
          e.x += Math.sin(e.timer * 1.5) * e.speed * dt;
          e.y += Math.cos(e.timer * 1.1) * e.speed * dt;
          e.spawnTimer -= dt;
          if (e.spawnTimer <= 0) {
            e.spawnTimer = randomRange(2.5, 5);
            const enf = makeEnemy('enforcer', { x: e.x, y: e.y }, 80);
            enf.shootTimer = randomRange(1, 2.5);
            this.enemies.push(enf);
            this.audio.play('select', { pitch: 0.6 });
          }
          break;
        }
        case 'enforcer': {
          // Move toward player somewhat, shoot aimed projectiles
          const dir = vec2Normalize({ x: px - e.x, y: py - e.y });
          e.x += dir.x * e.speed * dt * 0.5 + Math.sin(e.timer * 3) * 30 * dt;
          e.y += dir.y * e.speed * dt * 0.5 + Math.cos(e.timer * 2.5) * 30 * dt;
          e.shootTimer = (e.shootTimer || 2) - dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = randomRange(1.5, 3);
            const bd = vec2Normalize({ x: px - e.x, y: py - e.y });
            this.eBullets.push({
              x: e.x, y: e.y, vx: bd.x * ENEMY_BULLET_SPEED, vy: bd.y * ENEMY_BULLET_SPEED,
              r: 4, type: 'enforcer', bounces: 0,
            });
            this.audio.play('shoot', { volume: 0.2, pitch: 0.6 });
          }
          break;
        }
        case 'quark': {
          e.x += Math.cos(e.timer * 1.8) * e.speed * dt;
          e.y += Math.sin(e.timer * 1.3) * e.speed * dt;
          e.spawnTimer -= dt;
          if (e.spawnTimer <= 0) {
            e.spawnTimer = randomRange(3, 6);
            const tank = makeEnemy('tank', { x: e.x, y: e.y }, 60);
            tank.shootTimer = randomRange(1.5, 3);
            this.enemies.push(tank);
            this.audio.play('select', { pitch: 0.4 });
          }
          break;
        }
        case 'tank': {
          const dir = vec2Normalize({ x: px - e.x, y: py - e.y });
          e.x += dir.x * e.speed * dt * 0.4;
          e.y += dir.y * e.speed * dt * 0.4;
          e.shootTimer = (e.shootTimer || 2) - dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = randomRange(2, 4);
            const ang = Math.atan2(py - e.y, px - e.x) + randomRange(-0.3, 0.3);
            this.eBullets.push({
              x: e.x, y: e.y,
              vx: Math.cos(ang) * ENEMY_BULLET_SPEED * 0.8,
              vy: Math.sin(ang) * ENEMY_BULLET_SPEED * 0.8,
              r: 5, type: 'tank', bounces: 0, maxBounces: 3,
            });
            this.audio.play('shoot', { volume: 0.2, pitch: 0.4 });
          }
          break;
        }
      }

      // Clamp all enemies to arena
      e.x = clamp(e.x, ARENA.x + e.r, ARENA.x + ARENA.w - e.r);
      e.y = clamp(e.y, ARENA.y + e.r, ARENA.y + ARENA.h - e.r);
    }

    // Remove dead
    this.enemies = this.enemies.filter(e => e.alive);
  }

  updateHumans(dt) {
    for (const h of this.humans) {
      if (!h.alive) continue;
      h.timer += dt;
      // Random wandering — change direction occasionally
      if (h.timer > 1.5) {
        h.timer = 0;
        h.vx = randomRange(-1, 1);
        h.vy = randomRange(-1, 1);
      }
      const len = Math.hypot(h.vx, h.vy) || 1;
      h.x += (h.vx / len) * HUMAN_SPEED * dt;
      h.y += (h.vy / len) * HUMAN_SPEED * dt;
      h.x = clamp(h.x, ARENA.x + h.r, ARENA.x + ARENA.w - h.r);
      h.y = clamp(h.y, ARENA.y + h.r, ARENA.y + ARENA.h - h.r);

      // Check hulk killing humans
      for (const e of this.enemies) {
        if (e.alive && e.type === 'hulk' && vec2Dist(e, h) < e.r + h.r) {
          h.alive = false;
          this.particles.emitCustom(h.x, h.y, {
            preset: 'explosion', count: 15,
            color: ['#ff88cc', '#88ccff', '#ffff66'],
          });
          this.audio.play('hit', { pitch: 0.7 });
        }
      }
    }
    this.humans = this.humans.filter(h => h.alive);
  }

  updateEnemyBullets(dt) {
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Tank bullets bounce off walls
      if (b.type === 'tank' && b.maxBounces) {
        let bounced = false;
        if (b.x < ARENA.x + b.r || b.x > ARENA.x + ARENA.w - b.r) { b.vx *= -1; bounced = true; }
        if (b.y < ARENA.y + b.r || b.y > ARENA.y + ARENA.h - b.r) { b.vy *= -1; bounced = true; }
        if (bounced) {
          b.bounces++;
          b.x = clamp(b.x, ARENA.x + b.r, ARENA.x + ARENA.w - b.r);
          b.y = clamp(b.y, ARENA.y + b.r, ARENA.y + ARENA.h - b.r);
          if (b.bounces > b.maxBounces) { this.eBullets.splice(i, 1); continue; }
        }
      }

      if (b.x < ARENA.x || b.x > ARENA.x + ARENA.w || b.y < ARENA.y || b.y > ARENA.y + ARENA.h) {
        this.eBullets.splice(i, 1);
      }
    }
  }

  checkCollisions() {
    if (!this.player.alive) return;

    // Player bullets vs enemies
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (!e.alive) continue;
        if (!circleVsCircle({ x: b.x, y: b.y, r: b.r }, { x: e.x, y: e.y, r: e.r })) continue;

        if (e.type === 'hulk') {
          // Push hulk back
          const dir = vec2Normalize({ x: e.x - b.x, y: e.y - b.y });
          e.x += dir.x * 20;
          e.y += dir.y * 20;
          e.x = clamp(e.x, ARENA.x + e.r, ARENA.x + ARENA.w - e.r);
          e.y = clamp(e.y, ARENA.y + e.r, ARENA.y + ARENA.h - e.r);
          this.bullets.splice(bi, 1);
          this.particles.emitCustom(b.x, b.y, { preset: 'sparkle', count: 3, color: COLORS.hulk });
          // Check if hulk pushed into other enemies
          for (const other of this.enemies) {
            if (other !== e && other.alive && other.type !== 'hulk' && vec2Dist(e, other) < e.r + other.r + 5) {
              const id = this.enemies.indexOf(e);
              this.hulkKills.set(id, (this.hulkKills.get(id) || 0) + 1);
              if (this.hulkKills.get(id) >= 3) this.achievements.unlock('hulk-wrangler');
            }
          }
          break;
        }

        // Kill enemy
        this.killEnemy(e, bi);
        this.bullets.splice(bi, 1);
        break;
      }
    }

    // Player vs enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (circleVsCircle({ x: this.player.x, y: this.player.y, r: this.player.r }, { x: e.x, y: e.y, r: e.r })) {
        this.playerDeath();
        return;
      }
    }

    // Player vs enemy bullets
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      if (circleVsCircle({ x: this.player.x, y: this.player.y, r: this.player.r }, { x: b.x, y: b.y, r: b.r })) {
        this.eBullets.splice(i, 1);
        this.playerDeath();
        return;
      }
    }

    // Player vs humans (rescue)
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      if (!h.alive) continue;
      if (vec2Dist(this.player, h) < this.player.r + h.r + 5) {
        h.alive = false;
        this.humanRescueCount++;
        this.totalHumansRescued++;
        const bonus = Math.min(this.humanRescueCount, 5) * 1000;
        this.addScore(bonus, h.x, h.y);
        this.particles.emitCustom(h.x, h.y, {
          preset: 'confetti', count: 12,
          color: [COLORS.humanMom, COLORS.humanDad, COLORS.humanKid],
        });
        this.audio.play('coin', { pitch: 0.8 + this.humanRescueCount * 0.15 });
        this.achievements.unlock('first-rescue');
        if (this.humanRescueCount >= 5) this.achievements.unlock('chain-rescuer');
      }
    }
  }

  killEnemy(e, bulletIdx) {
    e.alive = false;
    const pts = { grunt: 100, electrode: 25, brain: 500, prog: 100, spheroid: 1000, enforcer: 150, quark: 1000, tank: 200 };
    const points = pts[e.type] || 100;
    this.addScore(points, e.x, e.y);

    const cMap = { grunt: '#4488ff', electrode: '#ff2244', brain: '#ff8800', prog: '#ff44ff',
      spheroid: '#ff66ff', enforcer: '#cc44ff', quark: '#ffaa00', tank: '#ff6644' };
    this.particles.emitCustom(e.x, e.y, {
      preset: 'explosion', count: 20, color: [cMap[e.type] || '#fff', '#ffffff', '#ffcc00'],
    });
    this.effects.shake(3, 0.1);
    this.audio.play('explosion', { volume: 0.4, pitch: randomRange(0.8, 1.5) });

    if (this.score >= 100000) this.achievements.unlock('master');
  }

  playerDeath() {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.lives--;

    this.particles.emitCustom(this.player.x, this.player.y, {
      preset: 'explosion', count: 40,
      color: ['#00ffff', '#88ffff', '#ffffff', '#0088ff'],
    });
    this.effects.shake(12, 0.4);
    this.effects.flash('#ff0000', 0.3);
    this.effects.slowMo(0.15, 1.2, 0.05, 0.4);
    this.audio.play('die');

    if (this.lives <= 0) {
      setTimeout(() => this.gameOver(), 1200);
    } else {
      this.respawnTimer = 1.5;
    }
  }

  gameOver() {
    this.achievements.reportScore(this.score);
    AchievementManager.checkCrossGame();
    super.gameOver();
  }

  checkWaveComplete() {
    const killable = this.enemies.filter(e => e.alive && e.type !== 'hulk' && e.type !== 'electrode');
    if (killable.length === 0 && this.waveIntroTimer <= 0) {
      this.startWave();
    }
  }

  findNearestHuman(from) {
    let nearest = null, nearDist = Infinity;
    for (const h of this.humans) {
      if (!h.alive) continue;
      const d = vec2Dist(from, h);
      if (d < nearDist) { nearDist = d; nearest = h; }
    }
    return nearest;
  }

  // ── Rendering ──────────────────────────────────────────────

  render(ctx) {
    this.drawBorder(ctx);

    for (const h of this.humans) {
      if (!h.alive) continue;
      const col = h.subtype === 'mom' ? COLORS.humanMom : h.subtype === 'dad' ? COLORS.humanDad : COLORS.humanKid;
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(h.x, h.y - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(h.x - 2, h.y, 4, 8); ctx.fillRect(h.x - 5, h.y + 2, 10, 2);
      ctx.fillRect(h.x - 3, h.y + 8, 2, 5); ctx.fillRect(h.x + 1, h.y + 8, 2, 5);
      ctx.restore();
    }

    // Draw enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.drawEnemy(ctx, e);
    }

    // Player bullets
    ctx.save(); ctx.shadowColor = COLORS.bullet; ctx.shadowBlur = 6;
    for (const b of this.bullets) {
      ctx.fillStyle = COLORS.bullet; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.bullet; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Enemy bullets
    ctx.save();
    for (const b of this.eBullets) {
      const col = b.type === 'tank' ? COLORS.tBullet : COLORS.eBullet;
      ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fillStyle = col;
      if (b.type === 'tank') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.beginPath();
        ctx.moveTo(b.r, 0); ctx.lineTo(0, b.r * 0.6); ctx.lineTo(-b.r, 0); ctx.lineTo(0, -b.r * 0.6);
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();

    // Player
    if (this.player.alive) {
      ctx.save(); ctx.shadowColor = COLORS.player; ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.player; ctx.beginPath(); ctx.arc(this.player.x, this.player.y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(this.player.x, this.player.y, PLAYER_R * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Wave intro text
    if (this.waveIntroTimer > 0) {
      const alpha = Math.min(1, this.waveIntroTimer / 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawNeonText(ctx, `WAVE ${this.wave}`, W / 2, H / 2, 52, '#00ffff', 20);
      ctx.restore();
    }
  }

  drawEnemy(ctx, e) {
    ctx.save();
    const t = e.timer, r = e.r, col = COLORS[e.type] || '#fff';
    ctx.shadowColor = col; ctx.shadowBlur = 8;

    if (e.type === 'grunt') {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#88bbff'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(e.x - 4, e.y); ctx.lineTo(e.x + 4, e.y);
      ctx.moveTo(e.x, e.y - 4); ctx.lineTo(e.x, e.y + 4); ctx.stroke();
    } else if (e.type === 'electrode') {
      ctx.shadowBlur = 10 + Math.sin(t * 8) * 4; ctx.fillStyle = col;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.restore();
    } else if (e.type === 'hulk') {
      ctx.shadowBlur = 10; ctx.fillStyle = col;
      ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
      ctx.strokeStyle = '#88ff88'; ctx.lineWidth = 2;
      ctx.strokeRect(e.x - r + 2, e.y - r + 2, r * 2 - 4, r * 2 - 4);
    } else if (e.type === 'brain') {
      ctx.shadowBlur = 10; ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, wobble = r + Math.sin(a * 3 + t * 4) * 3;
        i === 0 ? ctx.moveTo(e.x + Math.cos(a) * wobble, e.y + Math.sin(a) * wobble)
                : ctx.lineTo(e.x + Math.cos(a) * wobble, e.y + Math.sin(a) * wobble);
      }
      ctx.closePath(); ctx.fill();
    } else if (e.type === 'prog') {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y - 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(e.x - 2, e.y + 2, 4, 7);
      ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(e.x - 6, e.y + Math.sin(t * 10) * 5); ctx.lineTo(e.x + 6, e.y + Math.cos(t * 10) * 5); ctx.stroke();
    } else if (e.type === 'spheroid') {
      ctx.shadowBlur = 12; ctx.strokeStyle = col; ctx.lineWidth = 2;
      const pulse = r + Math.sin(t * 4) * 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(e.x, e.y, pulse * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'enforcer') {
      ctx.fillStyle = col; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle); ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0);
      ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (e.type === 'quark') {
      ctx.shadowBlur = 10; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle * 2);
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.rotate(Math.PI / 4); ctx.strokeRect(-r * 0.5, -r * 0.5, r, r); ctx.restore();
    } else if (e.type === 'tank') {
      ctx.fillStyle = col; ctx.fillRect(e.x - r, e.y - r * 0.7, r * 2, r * 1.4);
      ctx.fillStyle = '#ff8866'; ctx.fillRect(e.x - 2, e.y - r, 4, r);
    }
    ctx.restore();
  }

  drawBorder(ctx) {
    ctx.save();
    const t = this.borderPhase, segs = 40, aw = W - 2 * BORDER, ah = H - 2 * BORDER, sw = aw / segs, sh = ah / segs;
    const sides = [
      [BORDER, BORDER - 4, sw, 4, true], [BORDER, H - BORDER, sw, 4, true],
      [BORDER - 4, BORDER, 4, sh, false], [W - BORDER, BORDER, 4, sh, false],
    ];
    for (const [bx, by, bw, bh, horiz] of sides) {
      for (let i = 0; i < segs; i++) {
        const p = i / segs, hue = (p * 360 + t * 60) % 360, br = 50 + Math.sin(p * 20 + t * 5) * 20;
        ctx.fillStyle = `hsl(${hue},100%,${br}%)`;
        ctx.shadowColor = `hsl(${hue},100%,70%)`; ctx.shadowBlur = 4 + Math.sin(p * 15 + t * 8) * 3;
        ctx.fillRect(bx + (horiz ? i * bw : 0), by + (horiz ? 0 : i * bh), bw, bh);
      }
    }
    ctx.restore();
  }

  drawHUD(ctx) {
    ctx.save();
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textBaseline = 'top';

    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${String(this.score).padStart(8, '0')}`, 10, 8);

    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${this.wave}`, W / 2, 8);

    ctx.textAlign = 'right';
    ctx.fillText(`\u2764`.repeat(Math.max(0, this.lives)), W - 10, 8);
    ctx.restore();

    // Update DOM HUD
    const hs = document.getElementById('hud-score');
    const hw = document.getElementById('hud-wave');
    const hl = document.getElementById('hud-lives');
    if (hs) hs.textContent = `SCORE ${String(this.score).padStart(8, '0')}`;
    if (hw) hw.textContent = `WAVE ${this.wave}`;
    if (hl) hl.innerHTML = '\u2665'.repeat(Math.max(0, this.lives));
  }

  // ── Menu ───────────────────────────────────────────────────

  updateMenu(dt) {
    this.borderPhase += dt * 2;
    for (const e of this.menuEnemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < BORDER + 20 || e.x > W - BORDER - 20) e.vx *= -1;
      if (e.y < BORDER + 20 || e.y > H - BORDER - 20) e.vy *= -1;
      e.x = clamp(e.x, BORDER + 20, W - BORDER - 20);
      e.y = clamp(e.y, BORDER + 20, H - BORDER - 20);
    }
  }

  renderMenu(ctx) {
    this.drawBorder(ctx);

    // Background enemies
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (const e of this.menuEnemies) {
      const col = COLORS[e.type] || '#ffffff';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawNeonText(ctx, 'ROBOTRON', W / 2, H * 0.28, 64, '#ff0044', 25);
    drawNeonText(ctx, '2 0 8 4', W / 2, H * 0.38, 36, '#ff4488', 15);

    ctx.save();
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8844';
    ctx.fillText('THE CURSED CABINET', W / 2, H * 0.46);
    ctx.fillStyle = '#888';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("Sal's machine that kept breaking down. The ROM had errors,", W / 2, H * 0.78);
    ctx.fillText('the monitor would glitch, the joysticks wore out from the intensity.', W / 2, H * 0.82);
    ctx.fillText('Now finally working in the digital rebuild.', W / 2, H * 0.86);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('WASD: Move   |   Arrow Keys: Shoot', W / 2, H * 0.55);
    ctx.fillText('Move and shoot independently in 8 directions', W / 2, H * 0.59);
    ctx.restore();

    if (this.highScore > 0) {
      drawNeonText(ctx, `HI ${String(this.highScore).padStart(8, '0')}`, W / 2, H * 0.69, 18, '#0ff', 8);
    }
  }

  renderGameOver(ctx) {
    // Game still renders behind the overlay from the engine
  }

  _renderDefaultGameOver(ctx) {
    this.render(ctx);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawNeonText(ctx, 'GAME OVER', W / 2, H * 0.25, 48, '#ff2244', 20);
    ctx.fillStyle = '#fff'; ctx.font = '24px "Courier New", monospace';
    ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, W / 2, H * 0.40);
    ctx.fillStyle = '#0ff'; ctx.fillText(`HIGH SCORE: ${this.highScore.toLocaleString()}`, W / 2, H * 0.48);
    ctx.fillStyle = '#ff8844'; ctx.font = '18px "Courier New", monospace';
    ctx.fillText(`WAVES SURVIVED: ${this.wave}`, W / 2, H * 0.58);
    ctx.fillStyle = '#88ff88'; ctx.fillText(`HUMANS SAVED: ${this.totalHumansRescued}`, W / 2, H * 0.64);
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText('PRESS START TO PLAY AGAIN', W / 2, H * 0.78);
    }
    ctx.restore();
  }
}

// ── Bootstrap ────────────────────────────────────────────────

const game = new Robotron('game-canvas', {
  width: W, height: H, background: '#000',
});
game.start();

})();
