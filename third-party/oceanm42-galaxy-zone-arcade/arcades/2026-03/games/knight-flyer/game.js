(function () { /* de-moduled */
'use strict';
/**
 * Knight Flyer — Joust-style flying combat arcade game
 * Built on the Galaxy Zone shared engine.
 */




// ── Constants ────────────────────────────────────────────────
const W = 800, H = 600;
const GRAVITY = 420;
const FLAP_POWER = -210;
const MAX_VY = 350;
const MOVE_ACCEL = 600;
const MAX_VX = 200;
const FRICTION = 0.92;
const LAVA_Y = 565;
const LAVA_H = 35;
const KNIGHT_W = 28, KNIGHT_H = 28;
const EGG_W = 12, EGG_H = 14;
const EGG_HATCH_TIME = 5;
const EGG_LAVA_BONUS = 500;
const EGG_POINTS = 250;
const PTERO_W = 40, PTERO_H = 20;

const PLATFORMS = [
  { x: 80,  y: 520, w: 640 },   // bottom wide
  { x: 50,  y: 400, w: 200 },   // mid-left
  { x: 550, y: 400, w: 200 },   // mid-right
  { x: 250, y: 300, w: 300 },   // center
  { x: 100, y: 190, w: 160 },   // upper-left
  { x: 540, y: 190, w: 160 },   // upper-right
  { x: 300, y: 100, w: 200 },   // top center
];

const ENEMY_TYPES = {
  bounder:    { color: '#e44', wingColor: '#c22', speed: 80,  flapRate: 1.2, points: 500,  name: 'Bounder' },
  hunter:     { color: '#bbc', wingColor: '#99a', speed: 140, flapRate: 0.8, points: 750,  name: 'Hunter' },
  shadowlord: { color: '#536', wingColor: '#324', speed: 190, flapRate: 0.6, points: 1000, name: 'Shadow Lord' },
};

// ── Helper ───────────────────────────────────────────────────
const rand  = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Achievements ─────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: 'first-joust',         name: 'First Joust',          description: 'Defeat your first enemy knight',          icon: '\u2694\uFE0F' },
  { id: 'egg-scramble',        name: 'Egg Scramble',         description: 'Collect 5 eggs in one wave',              icon: '\uD83E\uDD5A' },
  { id: 'lava-dodger',         name: 'Lava Dodger',          description: 'Survive below the lowest platform for 3s', icon: '\uD83C\uDF0B' },
  { id: 'ptero-survivor',      name: 'Pterodactyl Survivor', description: 'Survive a wave with a pterodactyl',       icon: '\uD83E\uDD96' },
  { id: 'knight-champion',     name: 'Knight Champion',      description: 'Reach wave 10',                           icon: '\uD83D\uDC51' },
];

// ── Knight entity (shared by player & enemies) ───────────────
function createKnight(x, y, type) {
  return {
    x, y, vx: 0, vy: 0,
    w: KNIGHT_W, h: KNIGHT_H,
    facing: 1,
    onGround: false,
    flapTimer: 0,
    wingUp: false,
    wingFrame: 0,
    type, // null = player
    alive: true,
    spawnTimer: 0,
    seekDir: Math.random() < 0.5 ? 1 : -1,
    flapCooldown: 0,
  };
}

// ── Egg entity ───────────────────────────────────────────────
function createEgg(x, y, hatchType) {
  return { x, y, vy: 0, w: EGG_W, h: EGG_H, hatchTimer: EGG_HATCH_TIME, hatchType, onGround: false, warningFlash: 0 };
}

// ── Game ─────────────────────────────────────────────────────
class KnightFlyer extends GameEngine {
  init() {
    this.achievements = new AchievementManager('knight-flyer');
    this.achievements.define(ACHIEVEMENT_DEFS);

    this.player = null;
    this.enemies = [];
    this.eggs = [];
    this.pterodactyl = null;
    this.wave = 0;
    this.waveState = 'intro'; // intro, playing, clear, bonus
    this.waveTimer = 0;
    this.eggsCollectedThisWave = 0;
    this.lavaBelowTimer = 0;
    this.pteroSurvived = false;
    this.pteroWasPresent = false;
    this.menuKnights = [];
    this.lavaOffset = 0;
    this.lavaHand = null;
    this.lavaHandTimer = 0;
    this.bonusEggs = [];
    this.bonusTally = 0;
    this.totalEnemiesThisWave = 0;

    // Build background stars (cavern ceiling specks)
    this.bgStars = [];
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({ x: rand(0, W), y: rand(0, H * 0.6), size: rand(1, 2.5), blink: rand(0, 6) });
    }

    // Menu demo knights
    for (let i = 0; i < 4; i++) {
      const k = createKnight(rand(100, 700), rand(100, 400), null);
      k.vx = rand(-80, 80);
      k.vy = rand(-60, 60);
      k.menuColor = pick(['#e44', '#bbc', '#4af', '#fa4']);
      this.menuKnights.push(k);
    }
  }

  // ── State transitions ──────────────────────────────────────
  onEnterState(state) {
    if (state === 'playing') {
      this.wave = 1;
      this.player = createKnight(400, 450, null);
      this.enemies = [];
      this.eggs = [];
      this.pterodactyl = null;
      this.lavaHand = null;
      this.startWave();
    }
  }

  startWave() {
    this.waveState = 'intro';
    this.waveTimer = 1.8;
    this.eggsCollectedThisWave = 0;
    this.pteroSurvived = false;
    this.pteroWasPresent = false;
    this.level = this.wave;

    const isBonus = this.wave % 5 === 0;
    if (isBonus) {
      this.waveState = 'bonus';
      this.waveTimer = 0.8;
      this.enemies = [];
      this.pterodactyl = null;
      this.bonusEggs = [];
      this.bonusTally = 0;
      // Place eggs on platforms
      for (const p of PLATFORMS) {
        const count = randI(1, 2);
        for (let i = 0; i < count; i++) {
          const ex = p.x + rand(20, p.w - 20);
          const ey = p.y - EGG_H;
          const egg = createEgg(ex, ey, 'bounder');
          egg.onGround = true;
          egg.hatchTimer = 999; // don't hatch during bonus
          this.bonusEggs.push(egg);
        }
      }
    }
  }

  spawnWaveEnemies() {
    const w = this.wave;
    let bounders = Math.min(2 + Math.floor(w * 0.8), 6);
    let hunters = w >= 3 ? Math.min(Math.floor((w - 2) * 0.6), 4) : 0;
    let shadows = w >= 6 ? Math.min(Math.floor((w - 5) * 0.5), 3) : 0;

    const spawns = [];
    for (let i = 0; i < bounders; i++) spawns.push('bounder');
    for (let i = 0; i < hunters; i++) spawns.push('hunter');
    for (let i = 0; i < shadows; i++) spawns.push('shadowlord');

    this.totalEnemiesThisWave = spawns.length;

    for (const type of spawns) {
      const plat = pick(PLATFORMS);
      const ex = plat.x + rand(10, plat.w - 10);
      const ey = plat.y - KNIGHT_H - 10;
      const e = createKnight(ex, ey, type);
      e.spawnTimer = rand(0.3, 1.5);
      e.facing = Math.random() < 0.5 ? 1 : -1;
      this.enemies.push(e);
    }

    // Pterodactyl in later waves
    if (w >= 4 && (w % 3 === 0 || w >= 8)) {
      this.spawnPterodactyl();
    }
  }

  spawnPterodactyl() {
    this.pterodactyl = {
      x: -50, y: 200, vx: 120 + this.wave * 5,
      lifetime: 12 + rand(0, 4),
      elapsed: 0,
      sineOffset: rand(0, Math.PI * 2),
      w: PTERO_W, h: PTERO_H,
    };
    this.pteroWasPresent = true;
    this.audio.play('hit', { pitch: 0.4, volume: 0.5 });
  }

  // ── Main update ────────────────────────────────────────────
  update(dt) {
    this.lavaOffset += dt;

    if (this.waveState === 'intro') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveState = 'playing';
        this.spawnWaveEnemies();
      }
      this.updatePlayer(dt);
      return;
    }

    if (this.waveState === 'bonus') {
      this.waveTimer -= dt;
      if (this.waveTimer > 0) return;
      this.updatePlayer(dt);
      this.updateBonusWave(dt);
      return;
    }

    if (this.waveState === 'clear') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave++;
        if (this.wave >= 10) this.achievements.unlock('knight-champion');
        this.startWave();
      }
      return;
    }

    // ── Playing state ──
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateEggs(dt);
    this.updatePterodactyl(dt);
    this.updateLavaHand(dt);
    this.checkCollisions();
    this.checkLavaDodger(dt);

    // Check wave clear
    if (this.enemies.length === 0 && this.eggs.length === 0 && this.waveState === 'playing') {
      this.waveState = 'clear';
      this.waveTimer = 2.0;
      if (this.pteroWasPresent) {
        this.pteroSurvived = true;
        this.achievements.unlock('ptero-survivor');
      }
      this.audio.play('powerup');
      this.pterodactyl = null;
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p || !p.alive) return;

    // Flap
    if (this.input.isPressed('ACTION1') || this.input.isPressed('UP')) {
      p.vy = Math.max(p.vy + FLAP_POWER, -MAX_VY);
      p.wingUp = true;
      p.wingFrame = 0.15;
      this.audio.play('jump', { pitch: 1.3, volume: 0.3 });
      // Feather particles
      this.particles.emit(p.x, p.y + p.h * 0.5, {
        count: 3, speed: 40, speedVariance: 20,
        angle: Math.PI / 2, spread: 0.6,
        life: 0.5, lifeVariance: 0.2,
        size: 2, sizeVariance: 1, endSize: 0,
        color: ['#fff', '#ddf', '#bbf'],
        gravity: 100, friction: 0.97, shape: 'circle',
      });
    }

    // Horizontal movement
    if (this.input.isDown('LEFT'))  { p.vx -= MOVE_ACCEL * dt; p.facing = -1; }
    if (this.input.isDown('RIGHT')) { p.vx += MOVE_ACCEL * dt; p.facing = 1; }

    this.applyPhysics(p, dt);
  }

  applyPhysics(k, dt) {
    // Gravity
    k.vy += GRAVITY * dt;
    k.vy = clamp(k.vy, -MAX_VY, MAX_VY);

    // Friction
    if (!this.input.isDown('LEFT') && !this.input.isDown('RIGHT') || k.type) {
      k.vx *= FRICTION;
    }
    k.vx = clamp(k.vx, -MAX_VX, MAX_VX);

    // Move
    k.x += k.vx * dt;
    k.y += k.vy * dt;

    // Wing animation
    if (k.wingFrame > 0) k.wingFrame -= dt;
    else k.wingUp = false;

    // Screen wrap
    if (k.x < -k.w) k.x = W;
    if (k.x > W) k.x = -k.w;

    // Ceiling
    if (k.y < 10) { k.y = 10; k.vy = Math.max(k.vy, 0); }

    // Platform collision
    k.onGround = false;
    for (const plat of PLATFORMS) {
      // Landing on top
      if (k.vy >= 0 &&
          k.x + k.w > plat.x && k.x < plat.x + plat.w &&
          k.y + k.h >= plat.y && k.y + k.h <= plat.y + 14) {
        k.y = plat.y - k.h;
        k.vy = 0;
        k.onGround = true;
      }
      // Bump head from below
      if (k.vy < 0 &&
          k.x + k.w > plat.x && k.x < plat.x + plat.w &&
          k.y <= plat.y + 10 && k.y >= plat.y) {
        k.y = plat.y + 11;
        k.vy = Math.abs(k.vy) * 0.3;
      }
    }

    // Lava death
    if (k.y + k.h > LAVA_Y) {
      if (!k.type) {
        this.playerDied();
      } else {
        k.alive = false;
      }
    }
  }

  playerDied() {
    const p = this.player;
    this.particles.emit(p.x + p.w / 2, p.y + p.h / 2, 'explosion');
    this.effects.shake(8, 0.4);
    this.effects.flash('#f42', 0.15);
    this.audio.play('explosion', { volume: 0.6 });

    this.lives--;
    if (this.lives <= 0) {
      this.achievements.reportScore(this.score);
      AchievementManager.checkCrossGame();
      this.gameOver();
      return;
    }
    // Respawn
    p.x = 400; p.y = 300; p.vx = 0; p.vy = 0;
    p.alive = true;
    p.spawnTimer = 1.5;
  }

  // ── Enemy AI ───────────────────────────────────────────────
  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.spawnTimer > 0) { e.spawnTimer -= dt; continue; }
      if (!e.alive) { this.enemies.splice(i, 1); continue; }

      const info = ENEMY_TYPES[e.type];
      e.flapCooldown -= dt;

      // AI: flap periodically, move toward player altitude
      if (e.flapCooldown <= 0) {
        e.vy += FLAP_POWER * 0.85;
        e.flapCooldown = info.flapRate + rand(-0.2, 0.2);
        e.wingUp = true;
        e.wingFrame = 0.12;
      }

      // Horizontal movement AI
      if (this.player && this.player.alive) {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;

        if (e.type === 'hunter' || e.type === 'shadowlord') {
          // Actively pursue player
          e.vx += Math.sign(dx) * info.speed * dt * 2;
          if (e.type === 'shadowlord' && Math.abs(dy) > 40) {
            if (dy < 0 && e.flapCooldown > 0.3) e.flapCooldown = 0.1;
          }
        } else {
          // Bounder: patrol with occasional direction change
          e.vx += e.seekDir * info.speed * dt;
          if (Math.random() < 0.01) e.seekDir *= -1;
          if (Math.abs(dx) < 120 && Math.random() < 0.03) {
            e.seekDir = Math.sign(dx);
          }
        }
      } else {
        e.vx += e.seekDir * info.speed * dt * 0.5;
        if (Math.random() < 0.02) e.seekDir *= -1;
      }

      e.facing = e.vx > 0 ? 1 : -1;
      this.applyPhysics(e, dt);
    }
  }

  // ── Eggs ───────────────────────────────────────────────────
  updateEggs(dt) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];

      // Fall physics
      if (!egg.onGround) {
        egg.vy += GRAVITY * dt;
        egg.y += egg.vy * dt;

        // Land on platforms
        for (const plat of PLATFORMS) {
          if (egg.vy >= 0 &&
              egg.x + egg.w > plat.x && egg.x < plat.x + plat.w &&
              egg.y + egg.h >= plat.y && egg.y + egg.h <= plat.y + 12) {
            egg.y = plat.y - egg.h;
            egg.vy = 0;
            egg.onGround = true;
          }
        }

        // Lava
        if (egg.y + egg.h > LAVA_Y) {
          this.eggs.splice(i, 1);
          continue;
        }
      }

      // Hatch timer
      egg.hatchTimer -= dt;
      egg.warningFlash += dt * 8;
      if (egg.hatchTimer <= 0) {
        // Hatch into tougher enemy
        const nextType = egg.hatchType === 'bounder' ? 'hunter' : 'shadowlord';
        const e = createKnight(egg.x, egg.y - KNIGHT_H, nextType);
        e.vy = -100;
        this.enemies.push(e);
        this.eggs.splice(i, 1);
        this.audio.play('hit', { pitch: 0.7, volume: 0.4 });
        this.particles.emit(egg.x + egg.w / 2, egg.y, {
          count: 8, speed: 60, speedVariance: 30,
          angle: -Math.PI / 2, spread: Math.PI,
          life: 0.4, size: 3, endSize: 0,
          color: ['#ffe', '#ffa', '#fff'], gravity: 200, shape: 'circle',
        });
        continue;
      }

      // Player collection
      if (this.player && this.player.alive && this.player.spawnTimer <= 0) {
        const p = this.player;
        if (p.x + p.w > egg.x && p.x < egg.x + egg.w &&
            p.y + p.h > egg.y && p.y < egg.y + egg.h) {
          const nearLava = egg.y + egg.h > LAVA_Y - 60;
          const pts = nearLava ? EGG_LAVA_BONUS : EGG_POINTS;
          this.addScore(pts, egg.x, egg.y);
          this.eggs.splice(i, 1);
          this.eggsCollectedThisWave++;
          this.audio.play('coin', { volume: 0.4 });
          if (this.eggsCollectedThisWave >= 5) this.achievements.unlock('egg-scramble');
          this.particles.emit(egg.x + egg.w / 2, egg.y + egg.h / 2, {
            count: 6, speed: 50, speedVariance: 25,
            angle: 0, spread: Math.PI,
            life: 0.3, size: 2, endSize: 0,
            color: ['#ff0', '#ffa', '#fff'], gravity: 0, shape: 'circle',
          });
        }
      }
    }
  }

  // ── Pterodactyl ────────────────────────────────────────────
  updatePterodactyl(dt) {
    const pt = this.pterodactyl;
    if (!pt) return;
    pt.elapsed += dt;
    if (pt.elapsed > pt.lifetime) { this.pterodactyl = null; return; }

    pt.x += pt.vx * dt;
    pt.y = 180 + Math.sin(pt.elapsed * 2 + pt.sineOffset) * 120;

    // Screen wrap
    if (pt.x > W + 60) pt.x = -PTERO_W - 10;
    if (pt.x < -PTERO_W - 60) pt.x = W + 10;

    // Collide with player
    if (this.player && this.player.alive && this.player.spawnTimer <= 0) {
      const p = this.player;
      if (p.x + p.w > pt.x && p.x < pt.x + pt.w &&
          p.y + p.h > pt.y && p.y < pt.y + pt.h) {
        this.playerDied();
      }
    }
  }

  // ── Lava hand ──────────────────────────────────────────────
  updateLavaHand(dt) {
    this.lavaHandTimer -= dt;
    if (this.lavaHandTimer <= 0 && !this.lavaHand) {
      this.lavaHandTimer = rand(6, 14);
      this.lavaHand = {
        x: rand(150, 650), y: LAVA_Y,
        targetY: LAVA_Y - rand(40, 80),
        phase: 'rise', timer: 0, speed: 60,
      };
    }

    if (this.lavaHand) {
      const lh = this.lavaHand;
      lh.timer += dt;
      if (lh.phase === 'rise') {
        lh.y -= lh.speed * dt;
        if (lh.y <= lh.targetY) { lh.phase = 'hold'; lh.timer = 0; }
      } else if (lh.phase === 'hold') {
        if (lh.timer > 1.2) { lh.phase = 'fall'; lh.timer = 0; }
      } else if (lh.phase === 'fall') {
        lh.y += lh.speed * 1.5 * dt;
        if (lh.y >= LAVA_Y) { this.lavaHand = null; return; }
      }

      // Grab player or enemies
      if (this.player && this.player.alive && this.player.spawnTimer <= 0) {
        const p = this.player;
        if (Math.abs(p.x + p.w / 2 - lh.x) < 20 && p.y + p.h > lh.y) {
          this.playerDied();
        }
      }
      for (const e of this.enemies) {
        if (e.alive && Math.abs(e.x + e.w / 2 - lh.x) < 20 && e.y + e.h > lh.y) {
          e.alive = false;
        }
      }
    }
  }

  // ── Jousting collision ─────────────────────────────────────
  checkCollisions() {
    const p = this.player;
    if (!p || !p.alive || p.spawnTimer > 0) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive || e.spawnTimer > 0) continue;

      // AABB overlap
      if (p.x + p.w > e.x && p.x < e.x + e.w &&
          p.y + p.h > e.y && p.y < e.y + e.h) {
        // Joust rule: whoever is HIGHER wins (lower y = higher on screen)
        const pCenter = p.y + p.h * 0.4;
        const eCenter = e.y + e.h * 0.4;

        if (pCenter < eCenter - 4) {
          // Player wins
          this.joustEnemy(e, i);
        } else if (eCenter < pCenter - 4) {
          // Enemy wins
          this.playerDied();
          return;
        } else {
          // Bounce off (equal height)
          p.vx = -p.vx * 1.2;
          e.vx = -e.vx * 1.2;
          p.vy = -120;
          e.vy = -120;
          this.audio.play('hit', { volume: 0.3 });
        }
      }
    }
  }

  joustEnemy(e, idx) {
    const info = ENEMY_TYPES[e.type];
    this.addScore(info.points, e.x, e.y);
    this.achievements.unlock('first-joust');

    // Spawn egg
    const egg = createEgg(e.x + e.w / 2 - EGG_W / 2, e.y, e.type);
    this.eggs.push(egg);

    // Effects
    this.enemies.splice(idx, 1);
    this.effects.shake(5, 0.2);
    this.effects.freeze(0.06);
    this.audio.play('hit', { pitch: 1.1, volume: 0.6 });
    this.particles.emit(e.x + e.w / 2, e.y + e.h / 2, {
      count: 15, speed: 120, speedVariance: 60,
      angle: 0, spread: Math.PI,
      life: 0.4, lifeVariance: 0.15,
      size: 3, sizeVariance: 1, endSize: 0,
      color: ['#ff0', '#fa0', '#fff', '#f80'],
      gravity: 100, friction: 0.96, shape: 'circle',
    });

    // Player bounce up
    this.player.vy = -160;
  }

  // ── Lava Dodger achievement check ──────────────────────────
  checkLavaDodger(dt) {
    if (!this.player || !this.player.alive) return;
    const lowestPlatY = Math.max(...PLATFORMS.map(p => p.y));
    if (this.player.y + this.player.h > lowestPlatY) {
      this.lavaBelowTimer += dt;
      if (this.lavaBelowTimer >= 3) this.achievements.unlock('lava-dodger');
    } else {
      this.lavaBelowTimer = 0;
    }
  }

  // ── Bonus wave ─────────────────────────────────────────────
  updateBonusWave(dt) {
    const p = this.player;
    if (!p || !p.alive) return;

    for (let i = this.bonusEggs.length - 1; i >= 0; i--) {
      const egg = this.bonusEggs[i];
      if (p.x + p.w > egg.x && p.x < egg.x + egg.w &&
          p.y + p.h > egg.y && p.y < egg.y + egg.h) {
        this.addScore(EGG_POINTS, egg.x, egg.y);
        this.bonusTally++;
        this.bonusEggs.splice(i, 1);
        this.audio.play('coin', { volume: 0.4 });
      }
    }

    if (this.bonusEggs.length === 0) {
      this.waveState = 'clear';
      this.waveTimer = 2.0;
      this.audio.play('powerup');
    }
  }

  // ── Render ─────────────────────────────────────────────────
  render(ctx) {
    this.drawBackground(ctx);
    this.drawPlatforms(ctx);
    this.drawLava(ctx);

    if (this.waveState === 'bonus') {
      for (const egg of this.bonusEggs) this.drawEgg(ctx, egg);
    }

    for (const egg of this.eggs) this.drawEgg(ctx, egg);

    for (const e of this.enemies) {
      if (e.spawnTimer > 0) continue;
      this.drawKnight(ctx, e, ENEMY_TYPES[e.type].color, ENEMY_TYPES[e.type].wingColor);
    }

    if (this.pterodactyl) this.drawPterodactyl(ctx);
    if (this.lavaHand) this.drawLavaHand(ctx);

    if (this.player && this.player.alive) {
      const alpha = this.player.spawnTimer > 0 ? (Math.sin(this.player.spawnTimer * 15) > 0 ? 0.4 : 1) : 1;
      ctx.globalAlpha = alpha;
      this.drawKnight(ctx, this.player, '#4af', '#28d');
      ctx.globalAlpha = 1;
    }

    // Wave intro text
    if (this.waveState === 'intro') {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`WAVE ${this.wave}`, W / 2, H / 2 - 30);
      ctx.font = '18px "Courier New", monospace';
      ctx.fillStyle = '#aaf';
      const isBonus = this.wave % 5 === 0;
      ctx.fillText(isBonus ? 'BONUS ROUND — COLLECT ALL EGGS!' : 'GET READY!', W / 2, H / 2 + 10);
      ctx.restore();
    }

    // Wave clear text
    if (this.waveState === 'clear') {
      ctx.save();
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WAVE CLEARED!', W / 2, H / 2 - 20);
      if (this.eggsCollectedThisWave > 0 || this.bonusTally > 0) {
        ctx.font = '20px "Courier New", monospace';
        ctx.fillStyle = '#ff0';
        const total = this.eggsCollectedThisWave + this.bonusTally;
        ctx.fillText(`Eggs collected: ${total}`, W / 2, H / 2 + 15);
      }
      ctx.restore();
    }
  }

  // ── Drawing helpers ────────────────────────────────────────
  drawBackground(ctx) {
    // Dark cavern gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0812');
    grad.addColorStop(0.5, '#120e1a');
    grad.addColorStop(0.85, '#1a1020');
    grad.addColorStop(1, '#2a1010');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cavern specks
    for (const s of this.bgStars) {
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 1000 + s.blink));
      ctx.globalAlpha = blink * 0.6;
      ctx.fillStyle = '#886';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  drawPlatforms(ctx) {
    for (const p of PLATFORMS) {
      // Stone platform
      ctx.fillStyle = '#554433';
      ctx.fillRect(p.x, p.y, p.w, 10);
      ctx.fillStyle = '#776655';
      ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.fillStyle = '#443322';
      ctx.fillRect(p.x, p.y + 8, p.w, 2);

      // Stone texture lines
      ctx.strokeStyle = '#665544';
      ctx.lineWidth = 1;
      for (let bx = p.x + 12; bx < p.x + p.w; bx += rand(18, 30)) {
        ctx.beginPath();
        ctx.moveTo(bx, p.y);
        ctx.lineTo(bx, p.y + 10);
        ctx.stroke();
      }
    }
  }

  drawLava(ctx) {
    // Lava glow
    const glowGrad = ctx.createLinearGradient(0, LAVA_Y - 30, 0, LAVA_Y);
    glowGrad.addColorStop(0, 'rgba(255, 60, 0, 0)');
    glowGrad.addColorStop(1, 'rgba(255, 60, 0, 0.15)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, LAVA_Y - 30, W, 30);

    // Lava body
    ctx.fillStyle = '#c22';
    ctx.fillRect(0, LAVA_Y, W, LAVA_H);

    // Animated lava surface
    ctx.fillStyle = '#f60';
    for (let x = 0; x < W; x += 4) {
      const waveH = Math.sin(x * 0.03 + this.lavaOffset * 3) * 3 +
                     Math.sin(x * 0.07 + this.lavaOffset * 5) * 2;
      ctx.fillRect(x, LAVA_Y + waveH - 2, 4, 4);
    }
    ctx.fillStyle = '#fa0';
    for (let x = 0; x < W; x += 8) {
      const waveH = Math.sin(x * 0.05 + this.lavaOffset * 4 + 1) * 2;
      ctx.fillRect(x, LAVA_Y + waveH, 6, 2);
    }

    // Lava bubbles (particles)
    if (Math.random() < 0.08) {
      this.particles.emit(rand(50, W - 50), LAVA_Y - 2, {
        count: 1, speed: 20, speedVariance: 10,
        angle: -Math.PI / 2, spread: 0.3,
        life: 0.6, size: 3, sizeVariance: 2, endSize: 0,
        color: ['#f80', '#fa0', '#ff4'], gravity: -40, shape: 'circle',
      });
    }
  }

  drawKnight(ctx, k, bodyColor, wingColor) {
    ctx.save();
    ctx.translate(k.x + k.w / 2, k.y + k.h / 2);
    if (k.facing < 0) ctx.scale(-1, 1);

    // Bird body (ostrich-like)
    ctx.fillStyle = '#ca8';
    ctx.fillRect(-10, 2, 20, 10);  // body
    ctx.fillRect(8, -2, 6, 8);     // neck
    ctx.fillRect(10, -6, 8, 6);    // head

    // Beak
    ctx.fillStyle = '#fa0';
    ctx.fillRect(18, -4, 5, 3);

    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(14, -5, 2, 2);

    // Legs
    ctx.fillStyle = '#a86';
    if (!k.onGround) {
      ctx.fillRect(-4, 12, 2, 6);
      ctx.fillRect(4, 12, 2, 5);
    } else {
      ctx.fillRect(-6, 12, 2, 5);
      ctx.fillRect(6, 12, 2, 5);
    }

    // Wings
    ctx.fillStyle = wingColor || '#888';
    if (k.wingUp || k.wingFrame > 0) {
      // Wings up during flap
      ctx.fillRect(-12, -6, 10, 5);
      ctx.fillRect(-14, -9, 6, 4);
    } else {
      ctx.fillRect(-12, 4, 10, 4);
      ctx.fillRect(-14, 6, 6, 3);
    }

    // Knight rider
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-6, -10, 12, 12);  // torso
    ctx.fillRect(-4, -16, 8, 7);    // helmet

    // Helmet visor
    ctx.fillStyle = '#222';
    ctx.fillRect(0, -14, 4, 3);

    // Lance
    ctx.fillStyle = '#ddd';
    ctx.fillRect(8, -8, 14, 2);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(6, -10, 4, 6);  // hand guard

    ctx.restore();
  }

  drawEgg(ctx, egg) {
    // Warning flash when about to hatch
    const flash = egg.hatchTimer < 2 ? Math.sin(egg.warningFlash) > 0 : false;
    ctx.fillStyle = flash ? '#f44' : '#ffe8b0';
    ctx.beginPath();
    ctx.ellipse(egg.x + egg.w / 2, egg.y + egg.h / 2, egg.w / 2, egg.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crack marks
    ctx.strokeStyle = '#a98';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(egg.x + 3, egg.y + egg.h * 0.4);
    ctx.lineTo(egg.x + egg.w / 2, egg.y + egg.h * 0.55);
    ctx.lineTo(egg.x + egg.w - 3, egg.y + egg.h * 0.35);
    ctx.stroke();
  }

  drawPterodactyl(ctx) {
    const pt = this.pterodactyl;
    ctx.save();
    ctx.translate(pt.x + pt.w / 2, pt.y + pt.h / 2);

    // Body
    ctx.fillStyle = '#4a2';
    ctx.fillRect(-8, -4, 16, 8);

    // Head
    ctx.fillStyle = '#5b3';
    ctx.fillRect(10, -6, 10, 8);
    // Beak
    ctx.fillStyle = '#f80';
    ctx.fillRect(20, -4, 8, 4);
    // Eye
    ctx.fillStyle = '#f00';
    ctx.fillRect(14, -5, 3, 3);

    // Wings (animated)
    const wingAngle = Math.sin(pt.elapsed * 8) * 0.6;
    ctx.fillStyle = '#3a1';
    ctx.save();
    ctx.rotate(-wingAngle);
    ctx.fillRect(-20, -3, 18, 4);
    ctx.fillRect(-25, -2, 8, 3);
    ctx.restore();
    ctx.save();
    ctx.rotate(wingAngle);
    ctx.fillRect(-20, 0, 18, 4);
    ctx.fillRect(-25, 0, 8, 3);
    ctx.restore();

    // Tail
    ctx.fillStyle = '#4a2';
    ctx.fillRect(-18, -2, 10, 4);

    ctx.restore();
  }

  drawLavaHand(ctx) {
    const lh = this.lavaHand;
    ctx.fillStyle = '#d44';
    // Arm
    ctx.fillRect(lh.x - 4, lh.y, 8, LAVA_Y - lh.y + 5);
    // Hand
    ctx.fillStyle = '#f66';
    ctx.fillRect(lh.x - 8, lh.y - 6, 16, 10);
    // Fingers
    ctx.fillRect(lh.x - 10, lh.y - 14, 4, 10);
    ctx.fillRect(lh.x - 4, lh.y - 16, 4, 12);
    ctx.fillRect(lh.x + 2, lh.y - 14, 4, 10);
    ctx.fillRect(lh.x + 8, lh.y - 10, 4, 8);
    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#f40';
    ctx.beginPath();
    ctx.arc(lh.x, lh.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── HUD ────────────────────────────────────────────────────
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
    ctx.fillText('\u2764'.repeat(Math.max(0, this.lives)), W - 10, 8);
    ctx.restore();

    // Update DOM HUD
    const hs = document.getElementById('hud-score');
    const hw = document.getElementById('hud-wave');
    const hl = document.getElementById('hud-lives');
    if (hs) hs.textContent = `SCORE ${String(this.score).padStart(8, '0')}`;
    if (hw) hw.textContent = `WAVE ${this.wave}`;
    if (hl) hl.innerHTML = '&hearts;'.repeat(Math.max(0, this.lives));
  }

  // ── Menu ───────────────────────────────────────────────────
  updateMenu(dt) {
    for (const k of this.menuKnights) {
      k.vy += GRAVITY * 0.3 * dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (k.x < -30) k.x = W + 10;
      if (k.x > W + 30) k.x = -10;
      if (k.y > 420) { k.vy = rand(-180, -100); k.wingUp = true; k.wingFrame = 0.15; }
      if (k.y < 60) k.vy = Math.abs(k.vy) * 0.5;
      k.facing = k.vx > 0 ? 1 : -1;
      k.wingFrame -= dt;
      if (k.wingFrame < 0) k.wingUp = false;
    }
    this.lavaOffset += dt;
  }

  renderMenu(ctx) {
    this.drawBackground(ctx);
    this.drawPlatforms(ctx);
    this.drawLava(ctx);

    for (const k of this.menuKnights) {
      this.drawKnight(ctx, k, k.menuColor, '#888');
    }

    ctx.save();
    // Title
    ctx.fillStyle = '#fa0';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KNIGHT FLYER', W / 2, H * 0.22);

    // Subtitle
    ctx.fillStyle = '#aaf';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Joust from above to defeat enemy knights!', W / 2, H * 0.32);

    // Controls
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('ARROW KEYS / WASD to move   |   SPACE to flap', W / 2, H * 0.80);
    ctx.fillText('Higher knight wins the joust!', W / 2, H * 0.85);
    ctx.restore();
  }

  renderGameOver(ctx) {
    this.drawBackground(ctx);
    this.drawPlatforms(ctx);
    this.drawLava(ctx);
  }
}

// ── Boot ─────────────────────────────────────────────────────
const game = new KnightFlyer('game-canvas', {
  width: W,
  height: H,
  background: '#0a0812',
});
game.start();

})();
