(function () { /* de-moduled */
'use strict';
/**
 * Brick Breaker — Arkanoid-style arcade game
 * Extends the shared GameEngine from Galaxy Zone Arcade.
 */




// ── Constants ────────────────────────────────────────────────

const W = 800;
const H = 600;
const PADDLE_Y = 560;
const PADDLE_W = 100;
const PADDLE_H = 14;
const BALL_R = 6;
const BALL_SPEED_BASE = 340;
const BALL_SPEED_INC = 25; // per level
const BRICK_ROWS = 8;
const BRICK_COLS = 14;
const BRICK_W = 52;
const BRICK_H = 18;
const BRICK_PAD = 3;
const BRICK_TOP = 60;
const BRICK_LEFT = (W - BRICK_COLS * (BRICK_W + BRICK_PAD) + BRICK_PAD) / 2;
const POWERUP_CHANCE = 0.2;
const POWERUP_SPEED = 120;
const POWERUP_W = 30;
const POWERUP_H = 14;
const LASER_SPEED = 500;
const LASER_W = 4;
const LASER_H = 14;
const COMBO_DECAY = 1.5; // seconds to lose combo
const MAX_LEVEL = 5;

const ROW_COLORS = [
  '#ff3333', '#ff6633', '#ffaa00', '#ffdd00',
  '#33ff55', '#33ddff', '#5577ff', '#bb44ff',
];

// Musical scale frequencies for each row (C major descending)
const ROW_FREQS = [1047, 988, 880, 784, 698, 659, 587, 523];

const POWERUP_TYPES = ['multi', 'laser', 'wide', 'slow', 'life', 'magnet'];
const POWERUP_COLORS = {
  multi: '#ff44ff', laser: '#ff3333', wide: '#33ff55',
  slow: '#33ddff', life: '#ffaa00', magnet: '#aaaaff',
};
const POWERUP_LABELS = {
  multi: 'M', laser: 'L', wide: 'W', slow: 'S', life: '1UP', magnet: 'MG',
};

// Brick types: 0=normal, 1=silver(2 hits), 2=gold(indestructible)
const BRICK_NORMAL = 0;
const BRICK_SILVER = 1;
const BRICK_GOLD = 2;

// ── Level Layouts ────────────────────────────────────────────
// Each returns an array of { r, c, type } objects.

function layoutSimpleRows() {
  const bricks = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < BRICK_COLS; c++)
      bricks.push({ r, c, type: BRICK_NORMAL });
  return bricks;
}

function layoutDiamond() {
  const bricks = [];
  const cx = Math.floor(BRICK_COLS / 2);
  for (let r = 0; r < BRICK_ROWS; r++) {
    const half = r < 4 ? r + 1 : BRICK_ROWS - r;
    for (let c = cx - half; c < cx + half; c++) {
      if (c >= 0 && c < BRICK_COLS)
        bricks.push({ r, c, type: r === 3 || r === 4 ? BRICK_SILVER : BRICK_NORMAL });
    }
  }
  return bricks;
}

function layoutCheckerGold() {
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++)
    for (let c = 0; c < BRICK_COLS; c++) {
      if ((r + c) % 2 === 0)
        bricks.push({ r, c, type: BRICK_NORMAL });
      else if ((r + c) % 4 === 1 && r % 3 === 0)
        bricks.push({ r, c, type: BRICK_GOLD });
    }
  return bricks;
}

function layoutInvader() {
  // Classic invader silhouette in an 8x14 grid
  const shape = [
    '..XX........XX..',
    '...XX......XX...',
    '..XXXXXXXXXXXXXX',
    '..XXX..XXXX..XXX',
    'XXXXXXXXXXXXXXXX',
    'X.XXXXXXXXXXXXXX',
    'X.XX........XX.X',
    '...XXX....XXX...',
  ];
  const bricks = [];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < BRICK_COLS; c++) {
      const ch = shape[r] ? shape[r][c] : '.';
      if (ch === 'X')
        bricks.push({ r, c, type: r < 2 ? BRICK_SILVER : BRICK_NORMAL });
    }
  return bricks;
}

function layoutSpiral() {
  const bricks = [];
  const visited = Array.from({ length: BRICK_ROWS }, () => new Array(BRICK_COLS).fill(false));
  let r = 0, c = 0, dr = 0, dc = 1, count = 0;
  const total = BRICK_ROWS * BRICK_COLS;
  while (count < total) {
    if (r >= 0 && r < BRICK_ROWS && c >= 0 && c < BRICK_COLS && !visited[r][c]) {
      visited[r][c] = true;
      if (count % 5 !== 0) // leave gaps for visual pattern
        bricks.push({ r, c, type: count % 12 === 0 ? BRICK_SILVER : BRICK_NORMAL });
      count++;
    }
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= BRICK_ROWS || nc < 0 || nc >= BRICK_COLS || visited[nr]?.[nc]) {
      // turn right
      [dr, dc] = [dc, -dr];
    }
    r += dr;
    c += dc;
  }
  return bricks;
}

const LEVEL_LAYOUTS = [layoutSimpleRows, layoutDiamond, layoutCheckerGold, layoutInvader, layoutSpiral];

// ── BrickBreaker Game ────────────────────────────────────────

class BrickBreaker extends GameEngine {
  init() {
    // Achievements
    this.achieve = new AchievementManager('brick-breaker');
    this.achieve.define([
      { id: 'first-break', name: 'First Break', description: 'Clear your first level', icon: '\u{1F9F1}' },
      { id: 'power-hungry', name: 'Power Hungry', description: 'Collect 3 power-ups in one level', icon: '\u26A1' },
      { id: 'combo-king', name: 'Combo King', description: 'Get a 5x combo', icon: '\u{1F525}' },
      { id: 'untouchable', name: 'Untouchable', description: 'Clear a level without losing a ball', icon: '\u{1F6E1}' },
      { id: 'brick-master', name: 'Brick Master', description: 'Reach level 5', icon: '\u{1F3C6}' },
    ]);

    this.effects.setCRT(true);

    // Game state
    this.paddle = { x: W / 2, w: PADDLE_W, h: PADDLE_H };
    this.balls = [];
    this.bricks = [];
    this.powerups = [];
    this.lasers = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMax = 0;
    this.launched = false;
    this.levelPowerups = 0;
    this.levelLostBall = false;
    this.activePowers = {}; // type -> remaining seconds
    this.menuTime = 0;
    this.transitionTimer = 0;
    this.laserCooldown = 0;

    // Menu animated bricks
    this.menuBricks = [];
    for (let i = 0; i < 30; i++) {
      this.menuBricks.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.4 + 50,
        color: ROW_COLORS[Math.floor(Math.random() * ROW_COLORS.length)],
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 20,
      });
    }
  }

  // ── State transitions ──────────────────────────────────────

  onEnterState(state) {
    if (state === 'playing') {
      if (this._prevState === 'menu' || this._prevState === 'gameover') {
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.loadLevel();
      }
    }
  }

  loadLevel() {
    const idx = Math.min(this.level - 1, LEVEL_LAYOUTS.length - 1);
    const layout = LEVEL_LAYOUTS[idx]();

    this.bricks = layout.map(b => ({
      r: b.r, c: b.c, type: b.type,
      hp: b.type === BRICK_SILVER ? 2 : 1,
      x: BRICK_LEFT + b.c * (BRICK_W + BRICK_PAD),
      y: BRICK_TOP + b.r * (BRICK_H + BRICK_PAD),
      flash: 0,
    }));

    this.paddle.x = W / 2;
    this.paddle.w = PADDLE_W;
    this.balls = [];
    this.powerups = [];
    this.lasers = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMax = 0;
    this.launched = false;
    this.levelPowerups = 0;
    this.levelLostBall = false;
    this.activePowers = {};
    this.laserCooldown = 0;

    this.spawnBall(true);
  }

  spawnBall(onPaddle) {
    const speed = BALL_SPEED_BASE + (this.level - 1) * BALL_SPEED_INC;
    const ball = {
      x: this.paddle.x,
      y: PADDLE_Y - BALL_R - 1,
      vx: 0, vy: -speed,
      speed, onPaddle: !!onPaddle,
      trail: [],
    };
    if (!onPaddle) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.0;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }
    this.balls.push(ball);
    return ball;
  }

  // ── Update ─────────────────────────────────────────────────

  update(dt) {
    if (this.state === 'transition') {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.level++;
        this.loadLevel();
        this.setState('playing');
      }
      return;
    }

    this.updatePaddle(dt);
    this.updatePowers(dt);
    this.updateBalls(dt);
    this.updatePowerups(dt);
    this.updateLasers(dt);
    this.updateCombo(dt);
    this.checkLevelComplete();
  }

  updatePaddle(dt) {
    const speed = 500;
    if (this.input.isDown('LEFT')) this.paddle.x -= speed * dt;
    if (this.input.isDown('RIGHT')) this.paddle.x += speed * dt;

    // Mouse/touch: use canvas mouse position
    // Clamp paddle
    const hw = this.paddle.w / 2;
    this.paddle.x = Math.max(hw, Math.min(W - hw, this.paddle.x));

    // Launch ball
    if (!this.launched && (this.input.isPressed('ACTION1') || this.input.isPressed('START'))) {
      this.launched = true;
      for (const ball of this.balls) {
        if (ball.onPaddle) {
          ball.onPaddle = false;
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          ball.vx = Math.cos(angle) * ball.speed;
          ball.vy = Math.sin(angle) * ball.speed;
        }
      }
    }

    // Magnet release
    if (this.activePowers.magnet && this.input.isPressed('ACTION1')) {
      for (const ball of this.balls) {
        if (ball.onPaddle) {
          ball.onPaddle = false;
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          ball.vx = Math.cos(angle) * ball.speed;
          ball.vy = Math.sin(angle) * ball.speed;
        }
      }
    }

    // Laser shooting
    if (this.activePowers.laser && this.laserCooldown <= 0) {
      if (this.input.isDown('ACTION1') || this.input.isDown('UP')) {
        this.lasers.push(
          { x: this.paddle.x - this.paddle.w / 2 + 4, y: PADDLE_Y - 4 },
          { x: this.paddle.x + this.paddle.w / 2 - 4, y: PADDLE_Y - 4 },
        );
        this.laserCooldown = 0.15;
        this.audio.play('shoot', { volume: 0.3, pitch: 2.0 });
      }
    }
    this.laserCooldown -= dt;

    // Keep on-paddle balls aligned
    for (const ball of this.balls) {
      if (ball.onPaddle) {
        ball.x = this.paddle.x;
        ball.y = PADDLE_Y - BALL_R - 1;
      }
    }
  }

  updateBalls(dt) {
    const slowFactor = this.activePowers.slow ? 0.6 : 1;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.onPaddle) continue;

      // Store trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();

      const bdt = dt * slowFactor;
      ball.x += ball.vx * bdt;
      ball.y += ball.vy * bdt;

      // Wall collisions
      if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

      // Paddle collision
      if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 4) {
        const px = this.paddle.x;
        const pw = this.paddle.w;
        if (ball.x >= px - pw / 2 - BALL_R && ball.x <= px + pw / 2 + BALL_R) {
          // Magnet: stick to paddle
          if (this.activePowers.magnet) {
            ball.onPaddle = true;
            ball.vx = 0;
            ball.vy = 0;
            this.audio.play('select');
            continue;
          }

          // Angle based on hit position (-1 to 1)
          const hitPos = (ball.x - px) / (pw / 2);
          const angle = hitPos * (Math.PI / 3); // max 60 degrees
          const speed = ball.speed * slowFactor;
          ball.vx = Math.sin(angle) * speed;
          ball.vy = -Math.cos(angle) * speed;
          ball.y = PADDLE_Y - BALL_R - 1;
          this.audio.play('select', { pitch: 1.5 });
        }
      }

      // Brick collisions
      this.checkBrickCollisions(ball);

      // Ball lost
      if (ball.y - BALL_R > H) {
        this.balls.splice(i, 1);
        if (this.balls.length === 0) {
          this.loseLife();
        }
      }
    }
  }

  checkBrickCollisions(ball) {
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i];
      const bx = brick.x, by = brick.y;

      // AABB vs circle
      const closestX = Math.max(bx, Math.min(ball.x, bx + BRICK_W));
      const closestY = Math.max(by, Math.min(ball.y, by + BRICK_H));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;

      if (dx * dx + dy * dy < BALL_R * BALL_R) {
        // Reflect ball
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;

        this.hitBrick(i, brick);
        break; // one collision per frame
      }
    }
  }

  hitBrick(idx, brick) {
    if (brick.type === BRICK_GOLD) {
      brick.flash = 0.15;
      this.audio.play('hit', { pitch: 0.5 });
      return;
    }

    brick.hp--;
    brick.flash = 0.1;

    // Sound: musical note based on row
    const freq = ROW_FREQS[brick.r % ROW_FREQS.length];
    this.audio.play('hit', { pitch: freq / 300 });

    // Combo
    this.comboCount++;
    this.comboTimer = COMBO_DECAY;
    if (this.comboCount > this.comboMax) this.comboMax = this.comboCount;
    if (this.comboCount >= 5) this.achieve.unlock('combo-king');

    const multiplier = Math.min(this.comboCount, 8);
    const points = (brick.type === BRICK_SILVER ? 20 : 10) * multiplier;
    this.addScore(points, brick.x + BRICK_W / 2, brick.y);

    if (brick.hp <= 0) {
      // Destroy brick
      this.bricks.splice(idx, 1);

      // Particles
      const color = brick.type === BRICK_SILVER ? '#cccccc' : ROW_COLORS[brick.r % ROW_COLORS.length];
      this.particles.emit(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2, {
        count: 8,
        speed: 150, speedVariance: 60,
        angle: 0, spread: Math.PI,
        life: 0.5, lifeVariance: 0.2,
        size: 4, sizeVariance: 2, endSize: 0,
        color: [color, '#ffffff', color],
        gravity: 200, friction: 0.97,
        shape: 'square', rotationSpeed: 6,
      });

      // Screen shake on combos
      if (this.comboCount >= 3) {
        this.effects.shake(2 + this.comboCount, 0.15);
      }

      // Powerup drop
      if (Math.random() < POWERUP_CHANCE) {
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        this.powerups.push({
          x: brick.x + BRICK_W / 2 - POWERUP_W / 2,
          y: brick.y,
          type, sparkleTimer: 0,
        });
      }
    }
  }

  updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.y += POWERUP_SPEED * dt;
      pu.sparkleTimer += dt;

      // Sparkle particles
      if (pu.sparkleTimer > 0.15) {
        pu.sparkleTimer = 0;
        this.particles.emit(
          pu.x + POWERUP_W / 2 + (Math.random() - 0.5) * POWERUP_W,
          pu.y + POWERUP_H / 2,
          'sparkle', 1,
        );
      }

      // Collect
      if (pu.y + POWERUP_H >= PADDLE_Y && pu.y <= PADDLE_Y + PADDLE_H) {
        if (pu.x + POWERUP_W >= this.paddle.x - this.paddle.w / 2 &&
            pu.x <= this.paddle.x + this.paddle.w / 2) {
          this.collectPowerup(pu.type);
          this.powerups.splice(i, 1);
          continue;
        }
      }

      // Off screen
      if (pu.y > H) this.powerups.splice(i, 1);
    }
  }

  collectPowerup(type) {
    this.audio.play('powerup');
    this.levelPowerups++;
    if (this.levelPowerups >= 3) this.achieve.unlock('power-hungry');

    switch (type) {
      case 'multi':
        if (this.balls.length < 12) {
          const base = this.balls.find(b => !b.onPaddle) || this.balls[0];
          for (let i = 0; i < 2; i++) {
            const nb = this.spawnBall(false);
            nb.x = base.x;
            nb.y = base.y;
            const angle = -Math.PI / 2 + (i === 0 ? -0.5 : 0.5);
            nb.vx = Math.cos(angle) * nb.speed;
            nb.vy = Math.sin(angle) * nb.speed;
          }
        }
        break;
      case 'laser':
        this.activePowers.laser = 10;
        break;
      case 'wide':
        this.paddle.w = PADDLE_W * 1.5;
        this.activePowers.wide = 12;
        break;
      case 'slow':
        this.activePowers.slow = 8;
        break;
      case 'life':
        this.lives = Math.min(this.lives + 1, 9);
        this.effects.flash('#33ff55', 0.15);
        break;
      case 'magnet':
        this.activePowers.magnet = 10;
        break;
    }
  }

  updatePowers(dt) {
    for (const key of Object.keys(this.activePowers)) {
      this.activePowers[key] -= dt;
      if (this.activePowers[key] <= 0) {
        delete this.activePowers[key];
        if (key === 'wide') this.paddle.w = PADDLE_W;
      }
    }
  }

  updateLasers(dt) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.y -= LASER_SPEED * dt;

      if (laser.y < 0) { this.lasers.splice(i, 1); continue; }

      // Check brick hits
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const brick = this.bricks[j];
        if (laser.x >= brick.x && laser.x <= brick.x + BRICK_W &&
            laser.y >= brick.y && laser.y <= brick.y + BRICK_H) {
          this.hitBrick(j, brick);
          this.lasers.splice(i, 1);
          break;
        }
      }
    }
  }

  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
  }

  loseLife() {
    this.lives--;
    this.levelLostBall = true;
    this.audio.play('die');
    this.effects.shake(6, 0.3);
    this.effects.flash('#ff0000', 0.2);

    if (this.lives <= 0) {
      this.achieve.reportScore(this.score);
      AchievementManager.checkCrossGame();
      this.gameOver();
    } else {
      // Reset powers, respawn ball
      this.activePowers = {};
      this.paddle.w = PADDLE_W;
      this.launched = false;
      this.spawnBall(true);
    }
  }

  checkLevelComplete() {
    const breakable = this.bricks.filter(b => b.type !== BRICK_GOLD);
    if (breakable.length === 0) {
      // Level cleared
      this.achieve.unlock('first-break');
      if (!this.levelLostBall) this.achieve.unlock('untouchable');
      if (this.level >= 4) this.achieve.unlock('brick-master');

      // Bonus for remaining lives
      const bonus = this.lives * 500;
      this.addScore(bonus, W / 2, H / 2);

      this.effects.flash('#ffffff', 0.3);
      this.audio.play('start');

      if (this.level >= MAX_LEVEL) {
        this.achieve.reportScore(this.score);
        AchievementManager.checkCrossGame();
        this.gameOver();
      } else {
        this.transitionTimer = 2.0;
        this.setState('transition');
      }
    }
  }

  // ── Rendering ──────────────────────────────────────────────

  render(ctx) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#000011');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'transition') {
      this.renderTransition(ctx);
      return;
    }

    this.renderBricks(ctx);
    this.renderPowerups(ctx);
    this.renderLasers(ctx);
    this.renderBalls(ctx);
    this.renderPaddle(ctx);
    this.renderCombo(ctx);
    this.renderActivePowers(ctx);
  }

  renderBricks(ctx) {
    for (const brick of this.bricks) {
      let color;
      if (brick.type === BRICK_GOLD) {
        color = '#daa520';
      } else if (brick.type === BRICK_SILVER) {
        color = brick.hp === 2 ? '#bbbbbb' : '#888888';
      } else {
        color = ROW_COLORS[brick.r % ROW_COLORS.length];
      }

      // Flash white on hit
      if (brick.flash > 0) {
        brick.flash -= 1 / 60;
        color = '#ffffff';
      }

      // Main brick body
      ctx.fillStyle = color;
      ctx.fillRect(brick.x, brick.y, BRICK_W, BRICK_H);

      // Highlight on top
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(brick.x, brick.y, BRICK_W, 3);

      // Shadow on bottom
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(brick.x, brick.y + BRICK_H - 2, BRICK_W, 2);

      // Gold bricks get a border
      if (brick.type === BRICK_GOLD) {
        ctx.strokeStyle = '#ffee88';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, BRICK_W - 1, BRICK_H - 1);
      }

      // Silver crack for damaged
      if (brick.type === BRICK_SILVER && brick.hp === 1) {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(brick.x + BRICK_W * 0.3, brick.y);
        ctx.lineTo(brick.x + BRICK_W * 0.5, brick.y + BRICK_H * 0.6);
        ctx.lineTo(brick.x + BRICK_W * 0.7, brick.y + BRICK_H);
        ctx.stroke();
      }
    }
  }

  renderPaddle(ctx) {
    const px = this.paddle.x - this.paddle.w / 2;

    // Glow
    ctx.shadowColor = this.activePowers.laser ? '#ff4444' :
                      this.activePowers.magnet ? '#8888ff' : '#00ccff';
    ctx.shadowBlur = 12;

    // Paddle body
    const pgrd = ctx.createLinearGradient(px, PADDLE_Y, px, PADDLE_Y + PADDLE_H);
    pgrd.addColorStop(0, '#44aaff');
    pgrd.addColorStop(0.5, '#2266cc');
    pgrd.addColorStop(1, '#113388');
    ctx.fillStyle = pgrd;

    ctx.beginPath();
    ctx.roundRect(px, PADDLE_Y, this.paddle.w, PADDLE_H, 4);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(px + 2, PADDLE_Y + 1, this.paddle.w - 4, 4, 2);
    ctx.fill();
  }

  renderBalls(ctx) {
    for (const ball of this.balls) {
      // Trail
      ctx.save();
      for (let t = 0; t < ball.trail.length; t++) {
        const alpha = (t / ball.trail.length) * 0.3;
        const size = BALL_R * (t / ball.trail.length) * 0.8;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ccff';
        ctx.beginPath();
        ctx.arc(ball.trail[t].x, ball.trail[t].y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Ball
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, BALL_R * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderPowerups(ctx) {
    for (const pu of this.powerups) {
      ctx.fillStyle = POWERUP_COLORS[pu.type];
      ctx.shadowColor = POWERUP_COLORS[pu.type];
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(pu.x, pu.y, POWERUP_W, POWERUP_H, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(POWERUP_LABELS[pu.type], pu.x + POWERUP_W / 2, pu.y + POWERUP_H / 2);
    }
  }

  renderLasers(ctx) {
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 6;
    for (const laser of this.lasers) {
      ctx.fillRect(laser.x - LASER_W / 2, laser.y, LASER_W, LASER_H);
    }
    ctx.shadowBlur = 0;
  }

  renderCombo(ctx) {
    if (this.comboCount >= 2) {
      ctx.save();
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, this.comboTimer / 0.3);
      ctx.fillText(`x${this.comboCount} COMBO`, W - 15, 35);
      ctx.restore();
    }
  }

  renderActivePowers(ctx) {
    const active = Object.keys(this.activePowers);
    if (active.length === 0) return;
    ctx.save();
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < active.length; i++) {
      const key = active[i];
      ctx.fillStyle = POWERUP_COLORS[key] || '#fff';
      const secs = Math.ceil(this.activePowers[key]);
      ctx.fillText(`${key.toUpperCase()} ${secs}s`, 10, 35 + i * 14);
    }
    ctx.restore();
  }

  renderTransition(ctx) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${this.level} COMPLETE!`, W / 2, H / 2 - 30);

    ctx.font = '20px "Courier New", monospace';
    ctx.fillStyle = '#0ff';
    ctx.fillText(`LIVES BONUS: ${this.lives} x 500 = ${this.lives * 500}`, W / 2, H / 2 + 20);

    const nextLv = this.level + 1;
    const show = Math.floor(performance.now() / 400) % 2 === 0;
    if (show) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = '18px "Courier New", monospace';
      ctx.fillText(`GET READY FOR LEVEL ${nextLv}`, W / 2, H / 2 + 60);
    }
    ctx.restore();
  }

  // ── Menu ───────────────────────────────────────────────────

  updateMenu(dt) {
    this.menuTime += dt;
    for (const mb of this.menuBricks) {
      mb.x += mb.vx * dt;
      mb.y += mb.vy * dt;
      if (mb.x < 0 || mb.x > W) mb.vx *= -1;
      if (mb.y < 40 || mb.y > H * 0.5) mb.vy *= -1;
    }
  }

  renderMenu(ctx) {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#000011');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Animated bricks
    for (const mb of this.menuBricks) {
      ctx.fillStyle = mb.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(mb.x, mb.y, BRICK_W * 0.7, BRICK_H * 0.7);
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.save();
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title glow
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 20;
    ctx.fillText('BRICK BREAKER', W / 2, H * 0.35);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#888';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Arrows/WASD to move  |  Space to launch', W / 2, H * 0.45);

    // High score
    if (this.highScore > 0) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = '18px "Courier New", monospace';
      ctx.fillText(`HIGH SCORE: ${this.highScore}`, W / 2, H * 0.55);
    }
    ctx.restore();
  }

  // ── HUD Override ───────────────────────────────────────────

  drawHUD(ctx) {
    // Use the built-in HUD from GameEngine
    super.drawHUD(ctx);

    // Launch hint
    if (!this.launched && this.state === 'playing') {
      const show = Math.floor(performance.now() / 500) % 2 === 0;
      if (show) {
        ctx.save();
        ctx.fillStyle = '#aaa';
        ctx.font = '16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS SPACE TO LAUNCH', W / 2, H / 2);
        ctx.restore();
      }
    }
  }
}

// ── Bootstrap ────────────────────────────────────────────────

const game = new BrickBreaker('game-canvas', {
  width: W,
  height: H,
  background: '#000011',
});

game.start();

})();
