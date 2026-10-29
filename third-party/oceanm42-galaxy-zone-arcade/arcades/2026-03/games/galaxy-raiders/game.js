(function () { /* de-moduled */
'use strict';
/**
 * Galaxy Raiders — Galaga-style fixed shooter for Galaxy Zone Arcade.
 * Extends the shared GameEngine with formation aliens, dive-bombing,
 * tractor beam capture, dual ships, and challenge stages.
 */



// ── Constants ────────────────────────────────────────────────
const W = 800, H = 600;
const PLAYER_Y = H - 50;
const PLAYER_SPEED = 300;
const BULLET_SPEED = 550;
const ENEMY_BULLET_SPEED = 250;
const MAX_PLAYER_BULLETS = 3;
const FORM_COLS = 10, FORM_ROWS = 5;
const FORM_CELL_W = 48, FORM_CELL_H = 40;
const FORM_X = (W - FORM_COLS * FORM_CELL_W) / 2;
const FORM_Y = 60;
const BREATHE_AMP = 3, BREATHE_SPEED = 1.2;
const CHALLENGE_INTERVAL = 3;
const CHALLENGE_COUNT = 40;
const PERFECT_BONUS = 10000;

// Enemy types: row assignments
const TYPE_SOLDIER = 0, TYPE_GUARD = 1, TYPE_COMMANDER = 2;
const ENEMY_COLORS = {
  [TYPE_SOLDIER]:  { body: '#44cc44', wing: '#22aa22', eye: '#fff' },
  [TYPE_GUARD]:    { body: '#4488ff', wing: '#2266dd', eye: '#fff' },
  [TYPE_COMMANDER]:{ body: '#ff4444', wing: '#cc2222', eye: '#ffcc00' },
};
const SCORE_TABLE = {
  [TYPE_SOLDIER]:  { formation: 50, diving: 100 },
  [TYPE_GUARD]:    { formation: 80, diving: 160 },
  [TYPE_COMMANDER]:{ formation: 150, diving: 400 },
};

// ── Bezier path helpers ──────────────────────────────────────
function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t, uu = u * u, uuu = uu * u, tt = t * t, ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function makeEntryPath(side, targetX, targetY, stage) {
  const complexity = Math.min(stage * 0.1, 1);
  const cx = W / 2 + (Math.random() - 0.5) * 200 * complexity;
  if (side === 'left') {
    return [
      { x: -30, y: -30 },
      { x: cx - 150, y: H * 0.3 + Math.random() * 100 },
      { x: cx + 150, y: H * 0.15 + Math.random() * 80 },
      { x: targetX, y: targetY },
    ];
  }
  if (side === 'right') {
    return [
      { x: W + 30, y: -30 },
      { x: cx + 150, y: H * 0.3 + Math.random() * 100 },
      { x: cx - 150, y: H * 0.15 + Math.random() * 80 },
      { x: targetX, y: targetY },
    ];
  }
  // top
  return [
    { x: targetX + (Math.random() - 0.5) * 300, y: -30 },
    { x: targetX - 100 + Math.random() * 200, y: H * 0.25 },
    { x: targetX + 100 - Math.random() * 200, y: H * 0.15 },
    { x: targetX, y: targetY },
  ];
}

function makeDivePath(startX, startY, playerX, stage) {
  const speed = Math.min(1 + stage * 0.05, 2);
  const wobble = 60 + Math.random() * 80;
  return {
    points: [
      { x: startX, y: startY },
      { x: startX + (Math.random() > 0.5 ? wobble : -wobble), y: startY + 120 },
      { x: playerX + (Math.random() - 0.5) * 100, y: H * 0.6 },
      { x: playerX + (Math.random() - 0.5) * 60, y: H + 30 },
    ],
    speed,
  };
}

// ── Star background ──────────────────────────────────────────
function createStarfield(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 40 + 10,
      brightness: Math.random() * 0.6 + 0.4,
    });
  }
  return stars;
}

// ── Sprite drawing ───────────────────────────────────────────
function drawPlayer(ctx, x, y, dual) {
  const drawShip = (sx) => {
    ctx.fillStyle = '#0cf';
    ctx.beginPath();
    ctx.moveTo(sx, y - 16);
    ctx.lineTo(sx - 14, y + 12);
    ctx.lineTo(sx - 4, y + 8);
    ctx.lineTo(sx, y + 4);
    ctx.lineTo(sx + 4, y + 8);
    ctx.lineTo(sx + 14, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#08a';
    ctx.fillRect(sx - 3, y - 6, 6, 14);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, y - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    // engine glow
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(sx - 5, y + 10);
    ctx.lineTo(sx, y + 16 + Math.random() * 4);
    ctx.lineTo(sx + 5, y + 10);
    ctx.fill();
  };
  if (dual) {
    drawShip(x - 18);
    drawShip(x + 18);
  } else {
    drawShip(x);
  }
}

function drawEnemy(ctx, x, y, type, hp, time) {
  const c = ENEMY_COLORS[type];
  const pulse = Math.sin(time * 4) * 2;
  // wings
  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 8 + pulse);
  ctx.lineTo(x - 6, y - 4);
  ctx.lineTo(x - 6, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 8 + pulse);
  ctx.lineTo(x + 6, y - 4);
  ctx.lineTo(x + 6, y + 10);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = c.eye;
  ctx.beginPath();
  ctx.arc(x - 3, y - 2, 2, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  // commander crown
  if (type === TYPE_COMMANDER) {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 10);
    ctx.lineTo(x - 4, y - 14);
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x + 4, y - 14);
    ctx.lineTo(x + 6, y - 10);
    ctx.closePath();
    ctx.fill();
    if (hp > 1) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawTractorBeam(ctx, x, y1, y2, time) {
  const grad = ctx.createLinearGradient(x, y1, x, y2);
  const a = 0.3 + Math.sin(time * 10) * 0.15;
  grad.addColorStop(0, `rgba(0,255,200,${a})`);
  grad.addColorStop(0.5, `rgba(0,255,255,${a + 0.1})`);
  grad.addColorStop(1, `rgba(0,200,255,${a})`);
  ctx.fillStyle = grad;
  const w = 30 + (y2 - y1) * 0.15;
  ctx.beginPath();
  ctx.moveTo(x - 10, y1);
  ctx.lineTo(x - w, y2);
  ctx.lineTo(x + w, y2);
  ctx.lineTo(x + 10, y1);
  ctx.closePath();
  ctx.fill();
  // particles along beam
  ctx.fillStyle = '#aff';
  for (let i = 0; i < 6; i++) {
    const py = y1 + Math.random() * (y2 - y1);
    const spread = (py - y1) / (y2 - y1) * w;
    const px = x + (Math.random() - 0.5) * spread * 2;
    ctx.globalAlpha = 0.4 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(px, py, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBullet(ctx, x, y, isEnemy) {
  if (isEnemy) {
    ctx.fillStyle = '#ff4466';
    ctx.fillRect(x - 2, y - 5, 4, 10);
    ctx.fillStyle = '#ff8899';
    ctx.fillRect(x - 1, y - 3, 2, 6);
  } else {
    ctx.fillStyle = '#0ff';
    ctx.fillRect(x - 1.5, y - 8, 3, 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 0.5, y - 6, 1, 12);
  }
}

// ── Main Game ────────────────────────────────────────────────
class GalaxyRaiders extends GameEngine {
  constructor() {
    super('game-canvas', { width: W, height: H, background: '#000' });
    this.achievements = new AchievementManager('galaxy-raiders');
    this.achievements.define([
      { id: 'first-wave',        name: 'First Wave',        description: 'Clear stage 1',                         icon: '\u{1F30A}' },
      { id: 'dual-fighter',      name: 'Dual Fighter',      description: 'Rescue your captured ship',             icon: '\u{1F680}' },
      { id: 'perfect-challenge', name: 'Perfect Challenge',  description: 'Destroy all 40 aliens in a challenge stage', icon: '\u{1F3AF}' },
      { id: 'ace-pilot',         name: 'Ace Pilot',         description: 'Achieve 80%+ hit accuracy in a stage',  icon: '\u{1F396}' },
      { id: 'galaxy-hero',       name: 'Galaxy Hero',       description: 'Reach stage 10',                        icon: '\u{2B50}' },
    ]);
    this.stars = createStarfield(120);
    this.time = 0;
  }

  init() {
    this.resetGame();
  }

  resetGame() {
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.player = { x: W / 2, y: PLAYER_Y, alive: true, respawnTimer: 0, invincible: 0 };
    this.dual = false;
    this.capturedShip = null; // { commanderRef }
    this.tractorBeam = null;  // { enemy, timer, capturing }
    this.entryQueue = [];
    this.entryTimer = 0;
    this.diveTimer = 0;
    this.diveInterval = 3;
    this.stagePhase = 'intro'; // intro, entering, playing, clear, challenge-intro
    this.stageTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.challengeKills = 0;
    this.isChallenge = false;
    this.chainTimer = 0;
    this.chainCount = 0;
    this.breatheTime = 0;
    this.formationSettled = false;
  }

  _startGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.particles.clear();
    this.resetGame();
    this.audio.play('start');
    this.setState('playing');
    this.startStage();
  }

  startStage() {
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.entryQueue = [];
    this.diveTimer = 0;
    this.tractorBeam = null;
    this.stageTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.challengeKills = 0;
    this.formationSettled = false;
    this.isChallenge = (this.level % CHALLENGE_INTERVAL === 0);
    this.stagePhase = this.isChallenge ? 'challenge-intro' : 'intro';
    this.diveInterval = Math.max(1.2, 3 - this.level * 0.15);
    this.buildFormation();
  }

  buildFormation() {
    const sides = ['left', 'right', 'top'];
    let delay = 0;
    const groupSize = 4;
    for (let row = 0; row < FORM_ROWS; row++) {
      let type = TYPE_SOLDIER;
      if (row <= 1) type = TYPE_SOLDIER;
      else if (row <= 3) type = TYPE_GUARD;
      else type = TYPE_COMMANDER;
      for (let col = 0; col < FORM_COLS; col++) {
        const formX = FORM_X + col * FORM_CELL_W + FORM_CELL_W / 2;
        const formY = FORM_Y + row * FORM_CELL_H + FORM_CELL_H / 2;
        const side = sides[(Math.floor((row * FORM_COLS + col) / groupSize)) % sides.length];
        const path = makeEntryPath(side, formX, formY, this.level);
        const hp = type === TYPE_COMMANDER ? 2 : 1;
        const enemy = {
          type, hp, maxHp: hp,
          formCol: col, formRow: row,
          formX, formY,
          x: path[0].x, y: path[0].y,
          state: 'waiting', // waiting, entering, formation, diving, returning, captured-ship
          entryPath: path, entryT: 0, entrySpeed: 1.5 + Math.random() * 0.5,
          divePath: null, diveT: 0, diveSpeed: 1,
          entryDelay: delay,
          hasCapturedShip: false,
        };
        this.enemies.push(enemy);
        if ((col + 1) % groupSize === 0) delay += 0.4;
      }
    }
    // add small extra delay gap between rows
    delay += 0.3;
  }

  // ── Update ─────────────────────────────────────────────────
  update(dt) {
    this.time += dt;
    this.updateStars(dt);

    if (this.stagePhase === 'intro' || this.stagePhase === 'challenge-intro') {
      this.stageTimer += dt;
      if (this.stageTimer > 2) {
        this.stagePhase = 'entering';
        this.entryTimer = 0;
      }
      return;
    }

    if (this.stagePhase === 'clear') {
      this.stageTimer += dt;
      if (this.stageTimer > 2.5) {
        this.level++;
        if (this.level === 10) this.achievements.unlock('galaxy-hero');
        this.startStage();
      }
      return;
    }

    this.breatheTime += dt * BREATHE_SPEED;
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateTractorBeam(dt);
    this.checkCollisions();
    this.updateDiving(dt);
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    if (this.chainTimer <= 0) this.chainCount = 0;

    // Check stage clear
    if (this.stagePhase === 'playing' || this.stagePhase === 'entering') {
      const alive = this.enemies.filter(e => e.state !== 'captured-ship');
      if (alive.length === 0) {
        this.stagePhase = 'clear';
        this.stageTimer = 0;
        this.audio.play('powerup');
        this.checkStageAchievements();
      }
    }
  }

  checkStageAchievements() {
    if (this.level === 1) this.achievements.unlock('first-wave');
    if (this.isChallenge && this.challengeKills >= CHALLENGE_COUNT) {
      this.achievements.unlock('perfect-challenge');
      this.addScore(PERFECT_BONUS, W / 2, H / 2);
    }
    if (this.shotsFired > 0 && (this.shotsHit / this.shotsFired) >= 0.8) {
      this.achievements.unlock('ace-pilot');
    }
  }

  updateStars(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        if (this.lives <= 0) { this.endGame(); return; }
        p.alive = true;
        p.x = W / 2;
        p.invincible = 2;
        this.dual = false;
      }
      return;
    }
    if (p.invincible > 0) p.invincible -= dt;
    if (this.tractorBeam && this.tractorBeam.capturing) return; // frozen during capture

    if (this.input.isDown('LEFT'))  p.x -= PLAYER_SPEED * dt;
    if (this.input.isDown('RIGHT')) p.x += PLAYER_SPEED * dt;
    p.x = Math.max(20, Math.min(W - 20, p.x));

    if (this.input.isPressed('ACTION1')) this.shoot();
  }

  shoot() {
    if (this.playerBullets.length >= MAX_PLAYER_BULLETS) return;
    if (!this.player.alive) return;
    this.shotsFired++;
    this.audio.play('shoot', { pitch: 1.5, volume: 0.6 });
    if (this.dual) {
      this.playerBullets.push({ x: this.player.x - 18, y: PLAYER_Y - 16, vy: -BULLET_SPEED });
      this.playerBullets.push({ x: this.player.x + 18, y: PLAYER_Y - 16, vy: -BULLET_SPEED });
    } else {
      this.playerBullets.push({ x: this.player.x, y: PLAYER_Y - 16, vy: -BULLET_SPEED });
    }
  }

  updateBullets(dt) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.y += b.vy * dt;
      if (b.y < -10) this.playerBullets.splice(i, 1);
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      if (b.y > H + 10 || b.x < -10 || b.x > W + 10) this.enemyBullets.splice(i, 1);
    }
  }

  updateEnemies(dt) {
    this.entryTimer += dt;
    let anyEntering = false;

    for (const e of this.enemies) {
      if (e.state === 'captured-ship') continue;

      if (e.state === 'waiting') {
        if (this.entryTimer >= e.entryDelay) {
          e.state = 'entering';
        }
        continue;
      }

      if (e.state === 'entering') {
        anyEntering = true;
        e.entryT += dt * e.entrySpeed;
        if (e.entryT >= 1) {
          e.entryT = 1;
          e.state = 'formation';
          e.x = e.formX;
          e.y = e.formY;
        } else {
          const pos = bezierPoint(e.entryT, ...e.entryPath);
          e.x = pos.x;
          e.y = pos.y;
        }
        continue;
      }

      if (e.state === 'formation') {
        const breathe = Math.sin(this.breatheTime) * BREATHE_AMP;
        const bx = (e.formCol - FORM_COLS / 2) / (FORM_COLS / 2) * breathe;
        const by = (e.formRow - FORM_ROWS / 2) / (FORM_ROWS / 2) * breathe;
        e.x = e.formX + bx;
        e.y = e.formY + by;
        continue;
      }

      if (e.state === 'diving') {
        if (!e.divePath) { e.state = 'formation'; continue; }
        e.diveT += dt * e.diveSpeed * e.divePath.speed;
        if (e.diveT >= 1) {
          // Loop back: re-enter from top
          e.diveT = 0;
          e.state = 'returning';
          e.x = e.formX;
          e.y = -30;
          continue;
        }
        const pos = bezierPoint(e.diveT, ...e.divePath.points);
        e.x = pos.x;
        e.y = pos.y;
        // Shoot while diving
        if (!this.isChallenge && Math.random() < dt * (1.5 + this.level * 0.2)) {
          this.enemyBullets.push({
            x: e.x, y: e.y + 10,
            vx: (Math.random() - 0.5) * 40,
            vy: ENEMY_BULLET_SPEED + Math.random() * 50,
          });
        }
        continue;
      }

      if (e.state === 'returning') {
        const dx = e.formX - e.x, dy = e.formY - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          e.state = 'formation';
          e.x = e.formX;
          e.y = e.formY;
        } else {
          const spd = 200;
          e.x += (dx / dist) * spd * dt;
          e.y += (dy / dist) * spd * dt;
        }
        continue;
      }
    }

    if (anyEntering === false && this.stagePhase === 'entering') {
      const waiting = this.enemies.some(e => e.state === 'waiting');
      if (!waiting) {
        this.stagePhase = 'playing';
        this.formationSettled = true;
      }
    }
  }

  updateDiving(dt) {
    if (this.stagePhase !== 'playing') return;
    this.diveTimer += dt;
    if (this.diveTimer < this.diveInterval) return;
    this.diveTimer = 0;

    const inFormation = this.enemies.filter(e => e.state === 'formation');
    if (inFormation.length === 0) return;

    // Pick 1-2 aliens to dive
    const count = Math.random() < 0.3 + this.level * 0.05 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const e = inFormation[Math.floor(Math.random() * inFormation.length)];
      if (e.state !== 'formation') continue;
      e.state = 'diving';
      e.diveT = 0;
      e.divePath = makeDivePath(e.x, e.y, this.player.x, this.level);
      e.diveSpeed = 1;

      // Commander tractor beam chance
      if (e.type === TYPE_COMMANDER && !this.capturedShip && !this.dual
          && Math.random() < 0.2 + this.level * 0.03 && !this.isChallenge) {
        this.startTractorBeam(e);
      }
    }
  }

  startTractorBeam(enemy) {
    enemy.state = 'formation'; // hover in place for beam
    enemy.divePath = null;
    // Move commander to dive position above player
    this.tractorBeam = {
      enemy,
      timer: 0,
      duration: 3,
      capturing: false,
      captureTimer: 0,
      beamX: enemy.x,
      beamY1: enemy.y + 14,
      beamY2: PLAYER_Y,
      phase: 'descend', // descend, beam, ascend
      targetY: H * 0.25,
      startX: enemy.x,
      startY: enemy.y,
    };
    this.audio.play('hit', { pitch: 0.5, volume: 0.4 });
  }

  updateTractorBeam(dt) {
    const tb = this.tractorBeam;
    if (!tb) return;
    tb.timer += dt;
    const e = tb.enemy;

    if (tb.phase === 'descend') {
      const t = Math.min(tb.timer / 0.8, 1);
      e.x = this.player.x;
      e.y = tb.startY + (tb.targetY - tb.startY) * t;
      e.formX = e.x; e.formY = e.y;
      tb.beamX = e.x;
      tb.beamY1 = e.y + 14;
      if (t >= 1) { tb.phase = 'beam'; tb.timer = 0; }
      return;
    }

    if (tb.phase === 'beam') {
      tb.beamX = e.x;
      tb.beamY1 = e.y + 14;
      // Check if player is under the beam
      if (this.player.alive && Math.abs(this.player.x - e.x) < 30 && this.player.invincible <= 0) {
        tb.capturing = true;
        tb.captureTimer += dt;
        if (tb.captureTimer > 1) {
          // Capture the player's ship
          this.capturePlayerShip(e);
          tb.phase = 'ascend';
          tb.timer = 0;
          return;
        }
      } else {
        tb.captureTimer = Math.max(0, tb.captureTimer - dt * 2);
      }
      if (tb.timer > tb.duration) {
        tb.phase = 'ascend';
        tb.timer = 0;
        tb.capturing = false;
      }
      return;
    }

    if (tb.phase === 'ascend') {
      const t = Math.min(tb.timer / 1, 1);
      const targetFormY = FORM_Y + e.formRow * FORM_CELL_H + FORM_CELL_H / 2;
      const targetFormX = FORM_X + e.formCol * FORM_CELL_W + FORM_CELL_W / 2;
      e.x = e.x + (targetFormX - e.x) * t * 0.05;
      e.y = e.y + (targetFormY - e.y) * t * 0.05;
      e.formX = targetFormX; e.formY = targetFormY;
      if (t >= 1) {
        e.state = 'formation';
        this.tractorBeam = null;
      }
    }
  }

  capturePlayerShip(commander) {
    this.player.alive = false;
    this.lives--;
    this.player.respawnTimer = 2;
    this.capturedShip = commander;
    commander.hasCapturedShip = true;
    this.effects.shake(8, 0.5);
    this.effects.flash('#0ff', 0.3);
    this.audio.play('die');
    this.audio.play('explosion', { pitch: 0.7, volume: 0.5 });
  }

  checkCollisions() {
    // Player bullets vs enemies
    for (let bi = this.playerBullets.length - 1; bi >= 0; bi--) {
      const b = this.playerBullets[bi];
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (e.state === 'waiting') continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
          this.playerBullets.splice(bi, 1);
          this.shotsHit++;
          e.hp--;
          if (e.hp <= 0) {
            this.killEnemy(e, ei);
          } else {
            this.audio.play('hit', { volume: 0.5 });
            this.particles.emit(e.x, e.y, 'sparkle');
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    if (this.player.alive && this.player.invincible <= 0) {
      for (let bi = this.enemyBullets.length - 1; bi >= 0; bi--) {
        const b = this.enemyBullets[bi];
        const dx = b.x - this.player.x, dy = b.y - this.player.y;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          this.enemyBullets.splice(bi, 1);
          this.killPlayer();
          break;
        }
      }
    }

    // Diving enemies vs player (collision)
    if (this.player.alive && this.player.invincible <= 0) {
      for (const e of this.enemies) {
        if (e.state !== 'diving') continue;
        const dx = e.x - this.player.x, dy = e.y - this.player.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
          this.killPlayer();
          break;
        }
      }
    }
  }

  killEnemy(e, index) {
    const isDiving = e.state === 'diving';
    const pts = isDiving ? SCORE_TABLE[e.type].diving : SCORE_TABLE[e.type].formation;

    // Chain bonus
    this.chainTimer = 1;
    this.chainCount++;
    const chainBonus = this.chainCount > 2 ? (this.chainCount - 2) * 50 : 0;
    const totalPts = pts + chainBonus;

    this.addScore(totalPts, e.x, e.y);
    if (this.isChallenge) this.challengeKills++;

    // Freed captured ship?
    if (e.hasCapturedShip && this.capturedShip === e) {
      this.freeCapturedShip(e);
    }

    this.particles.emit(e.x, e.y, 'explosion');
    this.audio.play('explosion', { volume: 0.6, pitch: 1 + e.type * 0.2 });

    this.enemies.splice(index, 1);
  }

  freeCapturedShip(commander) {
    this.capturedShip = null;
    this.dual = true;
    this.effects.shake(6, 0.4);
    this.effects.flash('#0ff', 0.2);
    this.audio.play('powerup');
    this.achievements.unlock('dual-fighter');
    // Floating text
    this.particles.emitCustom(this.player.x, this.player.y - 40, {
      preset: 'floatingText', text: 'DUAL FIGHTER!', color: '#0ff', size: 20, life: 2,
    });
  }

  killPlayer() {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.lives--;
    this.dual = false;
    this.player.respawnTimer = 2;
    this.particles.emit(this.player.x, this.player.y, 'explosion');
    this.effects.shake(6, 0.4);
    this.effects.flash('#f44', 0.2);
    this.audio.play('die');
  }

  endGame() {
    this.achievements.reportScore(this.score);
    AchievementManager.checkCrossGame();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
    }
    this.audio.play('die');
    this.setState('gameover');
  }

  // ── Render ─────────────────────────────────────────────────
  render(ctx) {
    // Starfield
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Stage intro text
    if (this.stagePhase === 'intro' || this.stagePhase === 'challenge-intro') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.isChallenge ? '#ff0' : '#0ff';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillText(this.isChallenge ? 'CHALLENGE STAGE' : `STAGE ${this.level}`, W / 2, H / 2 - 20);
      if (this.isChallenge) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px "Courier New", monospace';
        ctx.fillText('Destroy all aliens for bonus!', W / 2, H / 2 + 25);
      }
      ctx.restore();
      return;
    }

    // Stage clear text
    if (this.stagePhase === 'clear') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.fillText('STAGE CLEAR!', W / 2, H / 2 - 20);
      if (this.isChallenge) {
        ctx.fillStyle = '#ff0';
        ctx.font = '22px "Courier New", monospace';
        ctx.fillText(`${this.challengeKills} / ${CHALLENGE_COUNT} destroyed`, W / 2, H / 2 + 20);
        if (this.challengeKills >= CHALLENGE_COUNT) {
          ctx.fillStyle = '#0ff';
          ctx.fillText(`PERFECT! +${PERFECT_BONUS}`, W / 2, H / 2 + 50);
        }
      }
      ctx.restore();
      return;
    }

    // Tractor beam
    if (this.tractorBeam && this.tractorBeam.phase === 'beam') {
      drawTractorBeam(ctx, this.tractorBeam.beamX, this.tractorBeam.beamY1, this.tractorBeam.beamY2, this.time);
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.state === 'waiting') continue;
      if (e.state === 'captured-ship') {
        // Draw a player ship sprite in formation
        drawPlayer(ctx, e.x, e.y, false);
        continue;
      }
      drawEnemy(ctx, e.x, e.y, e.type, e.hp, this.time);
      // If this commander has a captured ship, draw it above
      if (e.hasCapturedShip) {
        drawPlayer(ctx, e.x, e.y - FORM_CELL_H + 5, false);
      }
    }

    // Player bullets
    for (const b of this.playerBullets) {
      drawBullet(ctx, b.x, b.y, false);
    }

    // Enemy bullets
    for (const b of this.enemyBullets) {
      drawBullet(ctx, b.x, b.y, true);
    }

    // Player
    if (this.player.alive) {
      if (this.player.invincible > 0 && Math.floor(this.time * 10) % 2 === 0) {
        // blink
      } else {
        drawPlayer(ctx, this.player.x, this.player.y, this.dual);
      }
    }
  }

  // ── Menu ───────────────────────────────────────────────────
  updateMenu(dt) {
    this.time += dt;
    this.updateStars(dt);
    this.breatheTime += dt * BREATHE_SPEED;
  }

  renderMenu(ctx) {
    // Stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillText('GALAXY RAIDERS', W / 2, H * 0.2);
    ctx.fillStyle = '#88f';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('A Galaga-Style Arcade Shooter', W / 2, H * 0.28);

    // Animated formation preview
    const previewRows = 3, previewCols = 8;
    const cx = W / 2, baseY = H * 0.42;
    const breathe = Math.sin(this.breatheTime) * BREATHE_AMP;
    for (let r = 0; r < previewRows; r++) {
      const type = r === 0 ? TYPE_COMMANDER : r === 1 ? TYPE_GUARD : TYPE_SOLDIER;
      for (let c = 0; c < previewCols; c++) {
        const bx = (c - previewCols / 2) / (previewCols / 2) * breathe;
        const by = (r - previewRows / 2) / (previewRows / 2) * breathe;
        const ex = cx + (c - previewCols / 2 + 0.5) * 44 + bx;
        const ey = baseY + r * 36 + by;
        drawEnemy(ctx, ex, ey, type, type === TYPE_COMMANDER ? 2 : 1, this.time);
      }
    }

    // Controls hint
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('ARROWS: Move  |  SPACE: Shoot  |  ESC: Pause', W / 2, H * 0.82);
    ctx.restore();
  }

  renderGameOver(ctx) {
    // Stars in background
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness * 0.4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  _renderDefaultGameOver(ctx) {
    this.renderGameOver(ctx);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f44';
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText('GAME OVER', W / 2, H * 0.22);

    ctx.fillStyle = '#fff';
    ctx.font = '24px "Courier New", monospace';
    ctx.fillText(`SCORE: ${this.score}`, W / 2, H * 0.35);

    ctx.fillStyle = '#0ff';
    ctx.fillText(`HIGH SCORE: ${this.highScore}`, W / 2, H * 0.42);

    // Accuracy display
    ctx.fillStyle = '#aaa';
    ctx.font = '18px "Courier New", monospace';
    const accuracy = this.shotsFired > 0
      ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0;
    ctx.fillText(`SHOTS FIRED: ${this.shotsFired}`, W / 2, H * 0.53);
    ctx.fillText(`HITS: ${this.shotsHit}`, W / 2, H * 0.58);
    ctx.fillStyle = accuracy >= 80 ? '#0f0' : '#ff0';
    ctx.fillText(`ACCURACY: ${accuracy}%`, W / 2, H * 0.63);

    // Stage reached
    ctx.fillStyle = '#88f';
    ctx.fillText(`STAGE REACHED: ${this.level}`, W / 2, H * 0.70);

    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText('PRESS START TO PLAY AGAIN', W / 2, H * 0.82);
    }
    ctx.restore();
  }
}

// ── Bootstrap ────────────────────────────────────────────────
const game = new GalaxyRaiders();
game.start();

})();
