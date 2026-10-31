(function () { /* de-moduled */
'use strict';
/**
 * Cube Hopper — Q*bert-style isometric hopping arcade game
 * Built on the Galaxy Zone shared engine.
 */




// ── Constants ─────────────────────────────────────────────────
const W = 800, H = 600;
const ROWS = 7;
const CUBE_W = 64;
const CUBE_H = 32;
const CUBE_DEPTH = 40;
const PYR_TOP_X = W / 2;
const PYR_TOP_Y = 100;
const HOP_DURATION = 0.22;
const HOP_HEIGHT = 50;
const ENEMY_SPAWN_BASE = 3.5;
const ENEMY_SPAWN_MIN = 1.2;

// Color schemes per level type
const COLOR_SCHEMES = [
  { start: '#4444ff', target: '#ffcc00' },
  { start: '#ff4466', target: '#44ff88' },
  { start: '#8844ff', target: '#00ccff' },
  { start: '#ff8800', target: '#ff44cc' },
  { start: '#44ff88', target: '#ff4466' },
];

// Musical notes per row (ascending pitch for hop sounds)
const ROW_NOTES = [0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3];

// ── Helpers ───────────────────────────────────────────────────
const rand = (lo, hi) => Math.random() * (hi - lo) + lo;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** Convert grid (row, col) to isometric screen position (top of cube). */
function gridToScreen(row, col) {
  const x = PYR_TOP_X + (col - row / 2) * CUBE_W;
  const y = PYR_TOP_Y + row * (CUBE_H + CUBE_DEPTH / 2) * 0.85;
  return { x, y };
}

/** Total cubes count */
function totalCubes() {
  let n = 0;
  for (let r = 0; r < ROWS; r++) n += r + 1;
  return n;
}

// ── Cube Drawing ──────────────────────────────────────────────
function drawCube(ctx, x, y, topColor, lit = false) {
  const hw = CUBE_W / 2;
  const hh = CUBE_H / 2;
  const d = CUBE_DEPTH;

  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left face
  const lum = -40;
  ctx.fillStyle = shadeColor(topColor, lum);
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x, y + hh + d);
  ctx.lineTo(x - hw, y + d);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.fillStyle = shadeColor(topColor, lum - 20);
  ctx.beginPath();
  ctx.moveTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x, y + hh + d);
  ctx.lineTo(x + hw, y + d);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function shadeColor(hex, amt) {
  let col = hex.replace('#', '');
  if (col.length === 3) col = col[0]+col[0]+col[1]+col[1]+col[2]+col[2];
  let r = parseInt(col.substring(0, 2), 16) + amt;
  let g = parseInt(col.substring(2, 4), 16) + amt;
  let b = parseInt(col.substring(4, 6), 16) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// ── Main Game Class ───────────────────────────────────────────
class CubeHopper extends GameEngine {
  constructor() {
    super('game-canvas', { width: W, height: H, background: '#000' });
    this.achievements = new AchievementManager('cube-hopper');
    this.achievements.define([
      { id: 'color-changer', name: 'Color Changer', description: 'Complete level 1', icon: '\u{1F3A8}' },
      { id: 'snake-charmer', name: 'Snake Charmer', description: 'Lure Coily off the pyramid', icon: '\u{1F40D}' },
      { id: 'disc-jockey', name: 'Disc Jockey', description: 'Use a spinning disc escape', icon: '\u{1F4BF}' },
      { id: 'triple-cycle', name: 'Triple Cycle', description: 'Complete a level with cycling colors', icon: '\u{1F504}' },
      { id: 'cube-master', name: 'Cube Master', description: 'Reach level 10', icon: '\u{1F451}' },
    ]);
    this.menuRotation = 0;
    this.cubes = [];
    this.player = null;
    this.enemies = [];
    this.discs = [];
    this.speechBubble = null;
    this.levelClearTimer = 0;
    this.enemySpawnTimer = 0;
    this.freezeTimer = 0;
    this.colorScheme = COLOR_SCHEMES[0];
    this.hopsNeeded = 1;
    this.cycling = false;
  }

  // ── Level Setup ───────────────────────────────────────────
  _initLevel() {
    this.cubes = [];
    this.enemies = [];
    this.speechBubble = null;
    this.levelClearTimer = 0;
    this.enemySpawnTimer = 2.0;
    this.freezeTimer = 0;

    const schemeIdx = (this.level - 1) % COLOR_SCHEMES.length;
    this.colorScheme = COLOR_SCHEMES[schemeIdx];

    // Determine hop complexity
    if (this.level <= 3) {
      this.hopsNeeded = 1;
      this.cycling = false;
    } else if (this.level <= 6) {
      this.hopsNeeded = 2;
      this.cycling = false;
    } else {
      this.hopsNeeded = 2;
      this.cycling = true;
    }

    // Build pyramid cubes
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        const pos = gridToScreen(r, c);
        this.cubes.push({
          row: r, col: c,
          x: pos.x, y: pos.y,
          colorState: 0,  // 0 = start color, hopsNeeded = target
          lit: false, litTimer: 0,
        });
      }
    }

    // Spinning discs on left and right sides
    const discRow = 2;
    const leftPos = gridToScreen(discRow, -1);
    const rightPos = gridToScreen(discRow, discRow + 1);
    this.discs = [
      { x: leftPos.x - 20, y: leftPos.y + 10, side: 'left', rotation: 0, active: true, carrying: false, carryTimer: 0 },
      { x: rightPos.x + 20, y: rightPos.y + 10, side: 'right', rotation: 0, active: true, carrying: false, carryTimer: 0 },
    ];

    // Player starts at top
    this.player = {
      row: 0, col: 0,
      x: this.cubes[0].x, y: this.cubes[0].y,
      targetX: 0, targetY: 0,
      hopping: false, hopTimer: 0,
      startX: 0, startY: 0,
      falling: false, fallTimer: 0,
      onDisc: false, discRideTimer: 0,
      alive: true,
      invincible: 0,
    };
  }

  // ── State Transitions ────────────────────────────────────
  onEnterState(state) {
    if (state === 'playing') {
      this._initLevel();
      this.audio.playMusic('basic', { bpm: 110 + this.level * 5, key: 'E' });
    }
    if (state === 'gameover') {
      this.achievements.reportScore(this.score);
      AchievementManager.checkCrossGame();
    }
  }

  // ── Cube Color Helpers ───────────────────────────────────
  _getCubeColor(state) {
    if (state === 0) return this.colorScheme.start;
    if (state >= this.hopsNeeded) return this.colorScheme.target;
    // Intermediate color — blend
    const t = state / this.hopsNeeded;
    return lerpColor(this.colorScheme.start, this.colorScheme.target, t);
  }

  _hopOnCube(cube) {
    if (this.cycling) {
      cube.colorState = (cube.colorState + 1) % (this.hopsNeeded + 1);
    } else {
      if (cube.colorState < this.hopsNeeded) cube.colorState++;
    }
    cube.lit = true;
    cube.litTimer = 0.15;

    if (cube.colorState > 0) {
      this.addScore(25, cube.x, cube.y - 20);
      this.particles.emit(cube.x, cube.y - 10, 'sparkle');
    }
  }

  _checkLevelComplete() {
    return this.cubes.every(c => c.colorState >= this.hopsNeeded);
  }

  // ── Player Movement ──────────────────────────────────────
  _tryHop(dr, dc) {
    if (this.player.hopping || this.player.falling || this.player.onDisc || !this.player.alive) return;

    const newRow = this.player.row + dr;
    const newCol = this.player.col + dc;

    // Check disc escape — hopping off the side near row 1-3 can land on a disc
    if (dr === -1 && (newCol < 0 || newCol > newRow)) {
      for (const disc of this.discs) {
        if (!disc.active) continue;
        const isLeftDisc = disc.side === 'left' && newCol < 0;
        const isRightDisc = disc.side === 'right' && newCol > newRow;
        if ((isLeftDisc || isRightDisc) && this.player.row >= 1 && this.player.row <= 4) {
          this._rideDisc(disc);
          return;
        }
      }
    }

    // Falling off the pyramid
    if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol > newRow) {
      this._startFall(dr, dc);
      return;
    }

    // Valid hop
    const targetCube = this.cubes.find(c => c.row === newRow && c.col === newCol);
    if (!targetCube) return;

    this.player.hopping = true;
    this.player.hopTimer = 0;
    this.player.startX = this.player.x;
    this.player.startY = this.player.y;
    this.player.targetX = targetCube.x;
    this.player.targetY = targetCube.y;
    this.player.row = newRow;
    this.player.col = newCol;

    this.audio.play('jump', { pitch: ROW_NOTES[Math.min(newRow, ROW_NOTES.length - 1)] });
  }

  _startFall(dr, dc) {
    this.player.falling = true;
    this.player.fallTimer = 0;
    this.player.startX = this.player.x;
    this.player.startY = this.player.y;
    const offX = dc * CUBE_W - (dr * CUBE_W / 2);
    const offY = dr * (CUBE_H + CUBE_DEPTH / 2) * 0.85;
    this.player.targetX = this.player.x + offX;
    this.player.targetY = this.player.y + offY + 200;

    this.audio.play('die');
    this._showSpeechBubble();
  }

  _rideDisc(disc) {
    disc.carrying = true;
    disc.carryTimer = 0;
    this.player.onDisc = true;
    this.player.discRideTimer = 0;
    this.player.x = disc.x;
    this.player.y = disc.y - 15;

    this.audio.play('powerup');
    this.achievements.unlock('disc-jockey');

    // Coily follows and falls off — check for Coily
    const coily = this.enemies.find(e => e.type === 'coily' && e.hatched);
    if (coily) {
      coily.falling = true;
      coily.fallTimer = 0;
      this.addScore(500, coily.x, coily.y - 20);
      this.achievements.unlock('snake-charmer');
      this.effects.shake(6, 0.3);
    }
  }

  _showSpeechBubble() {
    this.speechBubble = {
      x: this.player.x, y: this.player.y - 40,
      text: '@#$%!',
      timer: 1.5,
    };
  }

  // ── Enemy Spawning & Logic ───────────────────────────────
  _spawnEnemy() {
    const roll = Math.random();
    const lvl = this.level;

    if (roll < 0.3 && !this.enemies.some(e => e.type === 'coily')) {
      // Spawn Coily (purple ball that hatches into snake)
      this._spawnCoily();
    } else if (roll < 0.55) {
      this._spawnRedBall();
    } else if (roll < 0.7) {
      this._spawnGreenBall();
    } else if (roll < 0.85 && lvl >= 4) {
      this._spawnSlickSam();
    } else {
      this._spawnRedBall();
    }
  }

  _spawnCoily() {
    const startCube = this.cubes[0];
    this.enemies.push({
      type: 'coily', hatched: false,
      row: 0, col: 0,
      x: startCube.x, y: startCube.y - 20,
      targetX: 0, targetY: 0,
      startX: startCube.x, startY: startCube.y - 20,
      hopping: false, hopTimer: 0,
      moveTimer: rand(0.8, 1.2),
      falling: false, fallTimer: 0,
    });
    this.effects.shake(4, 0.25);
    this.audio.play('hit');
  }

  _spawnRedBall() {
    const col = Math.random() < 0.5 ? 0 : 1;
    const startCube = this.cubes.find(c => c.row === 0 && c.col === 0);
    this.enemies.push({
      type: 'red-ball',
      row: 0, col: col === 1 ? 0 : 0,
      x: startCube.x, y: startCube.y - 30,
      targetX: 0, targetY: 0,
      startX: startCube.x, startY: startCube.y - 30,
      hopping: false, hopTimer: 0,
      moveTimer: rand(0.5, 0.9),
      falling: false, fallTimer: 0,
    });
  }

  _spawnGreenBall() {
    const startCube = this.cubes[0];
    this.enemies.push({
      type: 'green-ball',
      row: 0, col: 0,
      x: startCube.x, y: startCube.y - 30,
      targetX: 0, targetY: 0,
      startX: startCube.x, startY: startCube.y - 30,
      hopping: false, hopTimer: 0,
      moveTimer: rand(0.6, 1.0),
      falling: false, fallTimer: 0,
    });
  }

  _spawnSlickSam() {
    const startCube = this.cubes[0];
    this.enemies.push({
      type: 'slick-sam',
      row: 0, col: 0,
      x: startCube.x, y: startCube.y - 20,
      targetX: 0, targetY: 0,
      startX: startCube.x, startY: startCube.y - 20,
      hopping: false, hopTimer: 0,
      moveTimer: rand(0.7, 1.1),
      falling: false, fallTimer: 0,
    });
  }

  _updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.falling) {
        e.fallTimer += dt;
        e.y += 300 * dt;
        if (e.fallTimer > 1.5) { this.enemies.splice(i, 1); continue; }
        continue;
      }

      if (e.hopping) {
        e.hopTimer += dt;
        const t = Math.min(e.hopTimer / HOP_DURATION, 1);
        e.x = e.startX + (e.targetX - e.startX) * t;
        e.y = e.startY + (e.targetY - e.startY) * t - Math.sin(t * Math.PI) * HOP_HEIGHT * 0.6;
        if (t >= 1) {
          e.hopping = false;
          e.x = e.targetX;
          e.y = e.targetY;

          // Slick & Sam revert cube colors
          if (e.type === 'slick-sam') {
            const cube = this.cubes.find(c => c.row === e.row && c.col === e.col);
            if (cube && cube.colorState > 0) {
              cube.colorState = Math.max(0, cube.colorState - 1);
              this.particles.emit(cube.x, cube.y, 'fire');
            }
          }

          // Coily hatches at bottom row
          if (e.type === 'coily' && !e.hatched && e.row >= ROWS - 1) {
            e.hatched = true;
            this.audio.play('explosion', { pitch: 1.5 });
            this.particles.emit(e.x, e.y - 10, 'sparkle');
          }
        }
        continue;
      }

      // Movement timer
      e.moveTimer -= dt;
      if (e.moveTimer <= 0) {
        this._moveEnemy(e);
        e.moveTimer = e.type === 'coily' && e.hatched
          ? rand(0.4, 0.7) - Math.min(this.level * 0.02, 0.2)
          : rand(0.5, 0.9);
      }
    }
  }

  _moveEnemy(e) {
    let dr = 1, dc;

    if (e.type === 'coily' && e.hatched) {
      // Chase player
      const pRow = this.player.row;
      const pCol = this.player.col;
      dr = e.row < pRow ? 1 : -1;
      if (dr === 1) {
        dc = e.col < pCol ? 1 : 0;
      } else {
        dc = e.col > pCol ? -1 : 0;
      }
    } else {
      // Random downward bounce
      dc = Math.random() < 0.5 ? 0 : 1;
    }

    const newRow = e.row + dr;
    const newCol = e.col + dc;

    // Fall off pyramid
    if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol > newRow) {
      e.falling = true;
      e.fallTimer = 0;
      return;
    }

    const targetCube = this.cubes.find(c => c.row === newRow && c.col === newCol);
    if (!targetCube) { e.falling = true; e.fallTimer = 0; return; }

    e.hopping = true;
    e.hopTimer = 0;
    e.startX = e.x;
    e.startY = e.y;
    e.targetX = targetCube.x;
    e.targetY = targetCube.y - (e.type === 'coily' ? 20 : 30);
    e.row = newRow;
    e.col = newCol;

    this.audio.play('select', { pitch: 0.5 });
  }

  _checkEnemyCollisions() {
    if (!this.player.alive || this.player.falling || this.player.onDisc) return;
    if (this.player.invincible > 0) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.falling) continue;

      const dx = Math.abs(this.player.x - e.x);
      const dy = Math.abs(this.player.y - e.y);

      if (dx < 20 && dy < 20) {
        if (e.type === 'green-ball') {
          // Catch green ball — freeze enemies
          this.enemies.splice(i, 1);
          this.freezeTimer = 4;
          this.addScore(100, e.x, e.y - 20);
          this.audio.play('powerup');
          this.particles.emit(e.x, e.y, 'sparkle');
          this.effects.flash('#44ff44', 0.2);
          return;
        }

        if (e.type === 'slick-sam') continue; // Slick & Sam don't kill

        // Deadly enemy contact
        this._playerDeath();
        return;
      }
    }
  }

  _playerDeath() {
    this.lives--;
    this.player.alive = false;
    this._showSpeechBubble();
    this.audio.play('die');
    this.effects.shake(5, 0.3);
    this.particles.emit(this.player.x, this.player.y, 'explosion');

    if (this.lives <= 0) {
      setTimeout(() => this.gameOver(), 1500);
    } else {
      setTimeout(() => this._respawnPlayer(), 1500);
    }
  }

  _respawnPlayer() {
    const topCube = this.cubes[0];
    this.player.row = 0;
    this.player.col = 0;
    this.player.x = topCube.x;
    this.player.y = topCube.y;
    this.player.hopping = false;
    this.player.falling = false;
    this.player.onDisc = false;
    this.player.alive = true;
    this.player.invincible = 2.0;
    this.enemies = [];
    // Reset discs
    for (const d of this.discs) { d.active = true; d.carrying = false; }
  }

  // ── Update ───────────────────────────────────────────────
  update(dt) {
    if (this.levelClearTimer > 0) {
      this.levelClearTimer -= dt;
      // Flash cubes
      for (const c of this.cubes) {
        c.lit = Math.floor(this.levelClearTimer * 8) % 2 === 0;
      }
      if (this.levelClearTimer <= 0) {
        this.level++;
        if (this.level >= 10) this.achievements.unlock('cube-master');
        this._initLevel();
      }
      return;
    }

    // Player hopping animation
    if (this.player.hopping) {
      this.player.hopTimer += dt;
      const t = Math.min(this.player.hopTimer / HOP_DURATION, 1);
      this.player.x = this.player.startX + (this.player.targetX - this.player.startX) * t;
      this.player.y = this.player.startY + (this.player.targetY - this.player.startY) * t
                      - Math.sin(t * Math.PI) * HOP_HEIGHT;
      if (t >= 1) {
        this.player.hopping = false;
        this.player.x = this.player.targetX;
        this.player.y = this.player.targetY;
        // Land on cube
        const cube = this.cubes.find(c => c.row === this.player.row && c.col === this.player.col);
        if (cube) this._hopOnCube(cube);
        // Check level complete
        if (this._checkLevelComplete()) {
          this.levelClearTimer = 2.5;
          this.addScore(1000 + this.level * 250);
          this.audio.play('start');
          this.effects.flash('#ffcc00', 0.3);
          if (this.level === 1) this.achievements.unlock('color-changer');
          if (this.cycling) this.achievements.unlock('triple-cycle');
          this.particles.emit(W / 2, H / 2, 'confetti');
          return;
        }
      }
    }

    // Player falling
    if (this.player.falling) {
      this.player.fallTimer += dt;
      const t = Math.min(this.player.fallTimer / 0.8, 1);
      this.player.x = this.player.startX + (this.player.targetX - this.player.startX) * t;
      this.player.y = this.player.startY + (this.player.targetY - this.player.startY) * t;
      if (t >= 1 && this.player.alive) {
        this._playerDeath();
      }
      return;
    }

    // Disc riding
    if (this.player.onDisc) {
      this.player.discRideTimer += dt;
      const disc = this.discs.find(d => d.carrying);
      if (disc) {
        // Carry player up and back to top
        const t = Math.min(this.player.discRideTimer / 1.2, 1);
        const topCube = this.cubes[0];
        this.player.x = disc.x + (topCube.x - disc.x) * t;
        this.player.y = disc.y + (topCube.y - disc.y) * t - Math.sin(t * Math.PI) * 100;
        this.particles.emitCustom(this.player.x, this.player.y + 10, {
          preset: 'trail', color: '#00ffff', count: 1,
        });
        if (t >= 1) {
          this.player.onDisc = false;
          this.player.row = 0;
          this.player.col = 0;
          this.player.x = topCube.x;
          this.player.y = topCube.y;
          disc.carrying = false;
          disc.active = false;
        }
      }
      return;
    }

    // Player input — diagonal hopping mapped to arrow keys
    // In Q*bert's isometric view:
    //   UP    = hop up-left  (row-1, col+0 on left diagonal)
    //   RIGHT = hop up-right (row-1, col  stays but visually right = row-1, col same index)
    //   DOWN  = hop down-right (row+1, col+1)
    //   LEFT  = hop down-left  (row+1, col+0)
    if (this.player.alive && !this.player.hopping) {
      if (this.input.isPressed('UP'))         this._tryHop(-1, -1); // Up-Left
      else if (this.input.isPressed('RIGHT')) this._tryHop(-1, 0);  // Up-Right
      else if (this.input.isPressed('DOWN'))  this._tryHop(1, 1);   // Down-Right
      else if (this.input.isPressed('LEFT'))  this._tryHop(1, 0);   // Down-Left
    }

    // Invincibility timer
    if (this.player.invincible > 0) this.player.invincible -= dt;

    // Freeze timer (green ball effect)
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
    } else {
      this._updateEnemies(dt);
    }

    // Enemy spawning
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0 && this.enemies.length < 4 + Math.floor(this.level / 2)) {
      this._spawnEnemy();
      const interval = Math.max(ENEMY_SPAWN_MIN, ENEMY_SPAWN_BASE - this.level * 0.15);
      this.enemySpawnTimer = rand(interval, interval + 1.5);
    }

    // Check collisions
    this._checkEnemyCollisions();

    // Update cube lit timers
    for (const c of this.cubes) {
      if (c.litTimer > 0) {
        c.litTimer -= dt;
        if (c.litTimer <= 0) c.lit = false;
      }
    }

    // Update discs rotation
    for (const d of this.discs) {
      d.rotation += dt * 4;
    }

    // Speech bubble
    if (this.speechBubble) {
      this.speechBubble.timer -= dt;
      this.speechBubble.y -= 30 * dt;
      if (this.speechBubble.timer <= 0) this.speechBubble = null;
    }
  }

  // ── Render ───────────────────────────────────────────────
  render(ctx) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0020');
    grad.addColorStop(1, '#000010');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Target color indicator
    ctx.save();
    ctx.fillStyle = '#aaa';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('TARGET:', W - 60, 50);
    drawCube(ctx, W - 30, 58, this.colorScheme.target);
    ctx.restore();

    // Draw spinning discs
    for (const d of this.discs) {
      if (!d.active) continue;
      this._drawDisc(ctx, d);
    }

    // Draw cubes (back to front)
    for (const c of this.cubes) {
      const color = this._getCubeColor(c.colorState);
      drawCube(ctx, c.x, c.y, color, c.lit);
    }

    // Draw enemies
    for (const e of this.enemies) {
      this._drawEnemy(ctx, e);
    }

    // Draw player
    if (this.player.alive || this.player.falling) {
      this._drawPlayer(ctx);
    }

    // Speech bubble
    if (this.speechBubble) {
      this._drawSpeechBubble(ctx, this.speechBubble);
    }

    // Freeze indicator
    if (this.freezeTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,255,100,0.1)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#44ff88';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ENEMIES FROZEN: ${Math.ceil(this.freezeTimer)}s`, W / 2, H - 20);
      ctx.restore();
    }

    // Level clear celebration
    if (this.levelClearTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 30);
      ctx.font = '22px "Courier New", monospace';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`BONUS: ${1000 + this.level * 250}`, W / 2, H / 2 + 20);
      ctx.restore();
    }
  }

  _drawPlayer(ctx) {
    const p = this.player;
    // Blink when invincible
    if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) return;

    const py = p.y - 18;
    ctx.save();
    ctx.translate(p.x, py);

    // Body (round character)
    ctx.fillStyle = '#ff8844';
    ctx.beginPath();
    ctx.arc(0, -6, 10, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -8, 3, 0, Math.PI * 2);
    ctx.arc(4, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3, -8, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose/snout
    ctx.fillStyle = '#ff6622';
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Feet
    ctx.fillStyle = '#ff8844';
    ctx.fillRect(-9, 2, 6, 4);
    ctx.fillRect(3, 2, 6, 4);

    ctx.restore();
  }

  _drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y - 15);

    if (e.type === 'coily' && !e.hatched) {
      // Purple ball
      ctx.fillStyle = '#9933ff';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#bb66ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (e.type === 'coily' && e.hatched) {
      // Snake
      ctx.fillStyle = '#9933ff';
      ctx.beginPath();
      ctx.arc(0, -4, 8, 0, Math.PI * 2);
      ctx.fill();
      // Snake eyes
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(-3, -6, 2, 0, Math.PI * 2);
      ctx.arc(3, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-3, -6, 1, 0, Math.PI * 2);
      ctx.arc(3, -6, 1, 0, Math.PI * 2);
      ctx.fill();
      // Coil body
      ctx.strokeStyle = '#9933ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-8, 8, 8, 14, 0, 18);
      ctx.stroke();
    } else if (e.type === 'red-ball') {
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-2, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'green-ball') {
      ctx.fillStyle = '#22ff44';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-2, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'slick-sam') {
      // Green gremlin character
      ctx.fillStyle = '#44cc88';
      ctx.beginPath();
      ctx.arc(0, -2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -4, 2, 0, Math.PI * 2);
      ctx.arc(3, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-3, -4, 1, 0, Math.PI * 2);
      ctx.arc(3, -4, 1, 0, Math.PI * 2);
      ctx.fill();
      // Mischievous grin
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawDisc(ctx, disc) {
    ctx.save();
    ctx.translate(disc.x, disc.y);

    // Rotating disc platform
    const scaleY = 0.3 + 0.2 * Math.abs(Math.sin(disc.rotation));
    ctx.scale(1, scaleY);
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#88ffee';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.fillStyle = '#008866';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawSpeechBubble(ctx, bubble) {
    ctx.save();
    const bx = bubble.x;
    const by = bubble.y;

    // Bubble background
    ctx.fillStyle = '#fff';
    const tw = ctx.measureText(bubble.text).width || 60;
    const bw = tw + 20;
    const bh = 28;
    ctx.beginPath();
    roundRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(bx - 5, by + bh / 2 - 2);
    ctx.lineTo(bx + 5, by + bh / 2 - 2);
    ctx.lineTo(bx, by + bh / 2 + 10);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.text, bx, by);

    ctx.restore();
  }

  // ── Menu ────────────────────────────────────────────────
  updateMenu(dt) {
    this.menuRotation += dt * 0.8;
  }

  renderMenu(ctx) {
    // Title
    ctx.save();
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CUBE HOPPER', W / 2, 100);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('A Q*bert-style arcade game', W / 2, 140);
    ctx.restore();

    // Rotating isometric cube display
    const cx = W / 2;
    const cy = 320;
    const cubeColors = ['#ff4466', '#44ff88', '#4444ff', '#ffcc00', '#ff8800'];
    const time = this.menuRotation;

    // Draw a small demo pyramid
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c <= r; c++) {
        const gx = cx + (c - r / 2) * 50;
        const gy = cy - 60 + r * 35;
        const ci = (Math.floor(time * 2 + r + c) % cubeColors.length);
        drawCube(ctx, gx, gy, cubeColors[ci]);
      }
    }

    // Controls info
    ctx.save();
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow Keys: Hop diagonally on cubes', W / 2, H * 0.78);
    ctx.fillText('Change all cube colors to complete each level!', W / 2, H * 0.82);

    if (this.highScore > 0) {
      ctx.fillStyle = '#0ff';
      ctx.fillText(`HIGH SCORE: ${this.highScore}`, W / 2, H * 0.88);
    }
    ctx.restore();
  }

  renderGameOver(ctx) {
    // Show the "@#$%!" on game over screen
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('@#$%!', W / 2, H * 0.22);
    ctx.restore();
  }
}

// ── Rounded Rectangle Helper ──────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ── Color Lerp Helper ─────────────────────────────────────────
function lerpColor(hex1, hex2, t) {
  const c1 = hexToRGB(hex1), c2 = hexToRGB(hex2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function hexToRGB(hex) {
  let col = hex.replace('#', '');
  if (col.length === 3) col = col[0]+col[0]+col[1]+col[1]+col[2]+col[2];
  return {
    r: parseInt(col.substring(0, 2), 16),
    g: parseInt(col.substring(2, 4), 16),
    b: parseInt(col.substring(4, 6), 16),
  };
}

// ── Bootstrap ─────────────────────────────────────────────────
const game = new CubeHopper();
game.start();

})();
