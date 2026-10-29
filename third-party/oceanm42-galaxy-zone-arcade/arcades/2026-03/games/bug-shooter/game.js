(function () { /* de-moduled */
'use strict';
/**
 * Bug Shooter — Centipede-style arcade game for Galaxy Zone Arcade.
 * Extends the shared GameEngine with full centipede mechanics.
 */



// ── Constants ────────────────────────────────────────────────
const W = 800, H = 600;
const GRID = 20;                    // mushroom grid cell size
const COLS = W / GRID;              // 40
const ROWS = H / GRID;             // 30
const PLAYER_ZONE_TOP = H * 0.75;  // player can move in bottom 25%
const SHOT_SPEED = 500;
const PLAYER_SPEED = 250;
const CENTI_SPEED_BASE = 100;
const MUSHROOM_HP = 4;

// Sprite colors
const COL_HEAD = '#e83030';
const COL_BODY = '#22cc44';
const COL_MUSH = ['#228844', '#44aa55', '#77cc66', '#99dd88'];
const COL_POISON = ['#aa44cc', '#8833aa', '#6622aa', '#552299'];
const COL_SPIDER = '#dd8800';
const COL_FLEA = '#cc33cc';
const COL_SCORPION = '#ffaa00';
const COL_PLAYER = '#00ccff';
const COL_BULLET = '#ffffff';

// ── Sprite Drawing ───────────────────────────────────────────
function drawCentipedeHead(ctx, x, y, dir) {
  ctx.fillStyle = COL_HEAD;
  ctx.beginPath();
  ctx.arc(x + GRID / 2, y + GRID / 2, GRID / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#fff';
  const ex = dir > 0 ? 5 : -5;
  ctx.beginPath();
  ctx.arc(x + GRID / 2 + ex, y + GRID / 2 - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + GRID / 2 + ex + 1, y + GRID / 2 - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // antennae
  ctx.strokeStyle = COL_HEAD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + GRID / 2 + dir * 6, y + 2);
  ctx.lineTo(x + GRID / 2 + dir * 12, y - 4);
  ctx.moveTo(x + GRID / 2 + dir * 4, y + 4);
  ctx.lineTo(x + GRID / 2 + dir * 10, y - 2);
  ctx.stroke();
}

function drawCentipedeBody(ctx, x, y, t) {
  ctx.fillStyle = COL_BODY;
  const r = GRID / 2 - 2 + Math.sin(t * 8) * 1;
  ctx.beginPath();
  ctx.arc(x + GRID / 2, y + GRID / 2, r, 0, Math.PI * 2);
  ctx.fill();
  // stripe
  ctx.fillStyle = '#118833';
  ctx.fillRect(x + 4, y + GRID / 2 - 1, GRID - 8, 2);
  // legs
  ctx.strokeStyle = '#44ee66';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i += 2) {
    const lx = x + GRID / 2 + i * 6;
    ctx.beginPath();
    ctx.moveTo(lx, y + GRID / 2 + 4);
    ctx.lineTo(lx + i * 4, y + GRID + 1);
    ctx.stroke();
  }
}

function drawMushroom(ctx, x, y, hp, poisoned) {
  const cols = poisoned ? COL_POISON : COL_MUSH;
  const idx = Math.max(0, Math.min(3, 4 - hp));
  ctx.fillStyle = cols[idx];
  const shrink = idx * 2;
  // cap
  ctx.beginPath();
  ctx.arc(x + GRID / 2, y + GRID / 2 - 1 + shrink / 2, GRID / 2 - 1 - shrink / 2, Math.PI, 0);
  ctx.fill();
  // stem
  ctx.fillRect(x + GRID / 2 - 3 + shrink / 2, y + GRID / 2 - 1 + shrink / 2, 6 - shrink, GRID / 2 - shrink / 2);
  // dots on cap
  if (hp >= 3) {
    ctx.fillStyle = poisoned ? '#cc66ee' : '#aaffbb';
    ctx.beginPath();
    ctx.arc(x + GRID / 2 - 4, y + GRID / 2 - 4, 2, 0, Math.PI * 2);
    ctx.arc(x + GRID / 2 + 3, y + GRID / 2 - 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpider(ctx, x, y, t) {
  ctx.fillStyle = COL_SPIDER;
  // body
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.arc(x, y - 10, 5, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.strokeStyle = '#aa6600';
  ctx.lineWidth = 1.5;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * 0.4 + 0.3) * side;
      const legLen = 12 + Math.sin(t * 10 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(x + side * 4, y - 4 + i * 4);
      ctx.lineTo(x + side * (8 + legLen * Math.abs(Math.cos(angle))),
                 y - 4 + i * 4 + legLen * Math.sin(angle) * 0.5);
      ctx.stroke();
    }
  }
  // eyes
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(x - 3, y - 12, 2, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 12, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlea(ctx, x, y, t, hp) {
  ctx.fillStyle = hp > 1 ? COL_FLEA : '#ee66ee';
  ctx.beginPath();
  ctx.ellipse(x, y, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // wings
  ctx.fillStyle = 'rgba(200,100,200,0.4)';
  const wingFlap = Math.sin(t * 30) * 6;
  ctx.beginPath();
  ctx.ellipse(x - 6 - wingFlap, y - 2, 5, 3, -0.3, 0, Math.PI * 2);
  ctx.ellipse(x + 6 + wingFlap, y - 2, 5, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.strokeStyle = COL_FLEA;
  ctx.lineWidth = 1;
  const kick = Math.sin(t * 20) * 4;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 6); ctx.lineTo(x - 6, y + 14 + kick);
  ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + 6, y + 14 - kick);
  ctx.stroke();
}

function drawScorpion(ctx, x, y, dir, t) {
  ctx.fillStyle = COL_SCORPION;
  // body
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // claws
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.arc(x + dir * 10, y + side * 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // tail
  ctx.strokeStyle = COL_SCORPION;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const tailWag = Math.sin(t * 6) * 3;
  ctx.moveTo(x - dir * 8, y);
  ctx.quadraticCurveTo(x - dir * 16, y - 12 + tailWag, x - dir * 12, y - 18);
  ctx.stroke();
  // stinger
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(x - dir * 12, y - 18, 3, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.strokeStyle = '#cc8800';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 4, y + 5);
    ctx.lineTo(x + i * 4 + Math.sin(t * 12 + i) * 2, y + 12);
    ctx.stroke();
  }
}

function drawPlayer(ctx, x, y) {
  ctx.fillStyle = COL_PLAYER;
  // ship body
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x - 8, y + 6);
  ctx.lineTo(x - 4, y + 8);
  ctx.lineTo(x + 4, y + 8);
  ctx.lineTo(x + 8, y + 6);
  ctx.closePath();
  ctx.fill();
  // cockpit
  ctx.fillStyle = '#88eeff';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  // engine glow
  ctx.fillStyle = '#ff8800';
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 8);
  ctx.lineTo(x, y + 12 + Math.random() * 3);
  ctx.lineTo(x + 3, y + 8);
  ctx.fill();
}

// ── Centipede Segment ────────────────────────────────────────
class Segment {
  constructor(col, row, isHead, dir) {
    this.x = col * GRID;
    this.y = row * GRID;
    this.col = col;
    this.row = row;
    this.isHead = isHead;
    this.dir = dir;       // 1 = right, -1 = left
    this.dropping = false;
    this.targetY = this.y;
    this.speed = CENTI_SPEED_BASE;
    this.alive = true;
  }
}

// ── Main Game Class ──────────────────────────────────────────
class BugShooter extends GameEngine {
  init() {
    this.achievements = new AchievementManager('bug-shooter');
    this.achievements.define([
      { id: 'exterminator', name: 'Exterminator', description: 'Clear level 1', icon: '\uD83D\uDC1B' },
      { id: 'spider-sniper', name: 'Spider Sniper', description: 'Kill spider at max distance (900 pts)', icon: '\uD83D\uDD78\uFE0F' },
      { id: 'scorpion-hunter', name: 'Scorpion Hunter', description: 'Kill 3 scorpions in one game', icon: '\uD83E\uDD82' },
      { id: 'mushroom-farmer', name: 'Mushroom Farmer', description: 'Have 50+ mushrooms on screen', icon: '\uD83C\uDF44' },
      { id: 'bug-blaster', name: 'Bug Blaster', description: 'Reach level 10', icon: '\uD83D\uDCA5' },
    ]);

    this.player = { x: W / 2, y: H - 40, w: 16, h: 16 };
    this.bullets = [];
    this.mushrooms = [];       // { col, row, hp, poisoned }
    this.segments = [];
    this.spider = null;
    this.flea = null;
    this.scorpion = null;
    this.shootCooldown = 0;
    this.gameTime = 0;
    this.scorpionKills = 0;
    this.spiderTimer = 0;
    this.fleaTimer = 0;
    this.scorpionTimer = 0;
    this.levelClearTimer = 0;
    this.levelClearing = false;
    this.menuCentipede = [];
    this._initMenuCentipede();
  }

  _initMenuCentipede() {
    this.menuCentipede = [];
    for (let i = 0; i < 12; i++) {
      this.menuCentipede.push({ x: -i * GRID, y: H * 0.4, dir: 1, isHead: i === 0 });
    }
  }

  _resetLevel() {
    this.segments = [];
    this.bullets = [];
    this.spider = null;
    this.flea = null;
    this.scorpion = null;
    this.shootCooldown = 0;
    this.spiderTimer = 3 + Math.random() * 4;
    this.fleaTimer = 8 + Math.random() * 5;
    this.scorpionTimer = 12 + Math.random() * 8;
    this.levelClearTimer = 0;
    this.levelClearing = false;
    this._spawnCentipede();
  }

  _spawnCentipede() {
    const heads = Math.min(1 + Math.floor((this.level - 1) / 3), 5);
    const segPerHead = Math.max(6, 12 - (heads - 1) * 2);
    const speed = CENTI_SPEED_BASE + (this.level - 1) * 10;

    for (let h = 0; h < heads; h++) {
      const startCol = Math.floor(Math.random() * (COLS - segPerHead));
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < segPerHead; i++) {
        const seg = new Segment(startCol + i * -dir, 0 + h, i === 0, dir);
        seg.speed = speed;
        this.segments.push(seg);
      }
    }
  }

  _initMushrooms() {
    this.mushrooms = [];
    // random mushroom field in rows 2-23
    const count = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
      const col = Math.floor(Math.random() * COLS);
      const row = 2 + Math.floor(Math.random() * 22);
      if (!this._mushroomAt(col, row)) {
        this.mushrooms.push({ col, row, hp: MUSHROOM_HP, poisoned: false });
      }
    }
  }

  _mushroomAt(col, row) {
    return this.mushrooms.find(m => m.col === col && m.row === row && m.hp > 0);
  }

  _gridCol(x) { return Math.floor(x / GRID); }
  _gridRow(y) { return Math.floor(y / GRID); }

  onEnterState(state) {
    if (state === 'playing') {
      if (this._prevState === 'menu' || this._prevState === 'gameover') {
        this.scorpionKills = 0;
        this._initMushrooms();
        this._resetLevel();
        this.player.x = W / 2;
        this.player.y = H - 40;
        this.gameTime = 0;
      }
    }
  }

  // ── Menu ───────────────────────────────────────────────────
  updateMenu(dt) {
    this.gameTime += dt;
    for (const seg of this.menuCentipede) {
      seg.x += seg.dir * 120 * dt;
      if (seg.x > W + GRID) seg.x = -GRID;
      if (seg.x < -GRID * 2) seg.x = W + GRID;
    }
  }

  renderMenu(ctx) {
    // Title
    ctx.save();
    ctx.fillStyle = '#22cc44';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUG SHOOTER', W / 2, H * 0.3);

    ctx.fillStyle = '#0ff';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Arrow keys to move, Space to shoot', W / 2, H * 0.45);
    ctx.fillText('Destroy the centipede!', W / 2, H * 0.5);

    // Crawling centipede
    for (const seg of this.menuCentipede) {
      if (seg.isHead) {
        drawCentipedeHead(ctx, seg.x, seg.y, seg.dir);
      } else {
        drawCentipedeBody(ctx, seg.x, seg.y, this.gameTime);
      }
    }
    ctx.restore();
  }

  // ── Update ─────────────────────────────────────────────────
  update(dt) {
    this.gameTime += dt;
    if (this.levelClearing) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.level++;
        this._resetLevel();
        // Repair damaged mushrooms between levels
        for (const m of this.mushrooms) {
          if (m.hp > 0 && m.hp < MUSHROOM_HP) {
            m.hp = MUSHROOM_HP;
            this.addScore(5);
          }
        }
        this.audio.play('powerup');
        if (this.level === 2) this.achievements.unlock('exterminator');
        if (this.level >= 10) this.achievements.unlock('bug-blaster');
      }
      return;
    }

    this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateCentipede(dt);
    this._updateSpider(dt);
    this._updateFlea(dt);
    this._updateScorpion(dt);
    this._checkCollisions();
    this._checkAchievements();

    // Check level clear
    if (this.segments.length === 0 && !this.levelClearing) {
      this.levelClearing = true;
      this.levelClearTimer = 1.5;
      this.effects.flash('#22cc44', 0.3);
      this.audio.play('coin');
    }
  }

  _updatePlayer(dt) {
    const inp = this.input;
    if (inp.isDown('LEFT'))  this.player.x -= PLAYER_SPEED * dt;
    if (inp.isDown('RIGHT')) this.player.x += PLAYER_SPEED * dt;
    if (inp.isDown('UP'))    this.player.y -= PLAYER_SPEED * dt;
    if (inp.isDown('DOWN'))  this.player.y += PLAYER_SPEED * dt;

    // Clamp to bounds
    this.player.x = Math.max(10, Math.min(W - 10, this.player.x));
    this.player.y = Math.max(PLAYER_ZONE_TOP, Math.min(H - 12, this.player.y));

    // Shooting
    this.shootCooldown -= dt;
    if (inp.isDown('ACTION1') && this.shootCooldown <= 0) {
      this.bullets.push({ x: this.player.x, y: this.player.y - 12, active: true });
      this.shootCooldown = 0.12;
      this.audio.play('shoot', { volume: 0.4, pitch: 1.5 });
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= SHOT_SPEED * dt;
      if (b.y < -10 || !b.active) {
        this.bullets.splice(i, 1);
      }
    }
  }

  _updateCentipede(dt) {
    for (const seg of this.segments) {
      if (!seg.alive) continue;

      if (seg.dropping) {
        seg.y += seg.speed * dt;
        if (seg.y >= seg.targetY) {
          seg.y = seg.targetY;
          seg.dropping = false;
          seg.dir = -seg.dir;
        }
        continue;
      }

      seg.x += seg.dir * seg.speed * dt;
      seg.col = this._gridCol(seg.x);
      seg.row = this._gridRow(seg.y);

      // Check for mushroom collision or edge
      const nextCol = seg.col + seg.dir;
      const hitEdge = nextCol < 0 || nextCol >= COLS;
      const mush = !hitEdge && this._mushroomAt(nextCol, seg.row);
      const hitPoisoned = mush && mush.poisoned && seg.isHead;

      if (hitPoisoned) {
        // Drop straight to bottom through poisoned mushrooms
        seg.dropping = true;
        seg.targetY = Math.min(seg.y + GRID, H - GRID);
      } else if (hitEdge || mush) {
        seg.dropping = true;
        seg.targetY = seg.y + GRID;
        if (seg.targetY >= H) {
          // Reverse at bottom, go back up
          seg.targetY = seg.y;
          seg.dir = -seg.dir;
        }
      }
    }

    this.segments = this.segments.filter(s => s.alive);
  }

  _updateSpider(dt) {
    this.spiderTimer -= dt;
    const levelFactor = Math.min(this.level * 0.1, 0.8);

    if (!this.spider && this.spiderTimer <= 0) {
      const fromLeft = Math.random() < 0.5;
      this.spider = {
        x: fromLeft ? -20 : W + 20,
        y: PLAYER_ZONE_TOP + Math.random() * (H - PLAYER_ZONE_TOP - 40),
        vx: (fromLeft ? 1 : -1) * (120 + levelFactor * 80),
        vy: 0,
        dir: fromLeft ? 1 : -1,
        alive: true,
        bounceTimer: 0,
      };
      this.spiderTimer = 6 + Math.random() * 6;
    }

    if (this.spider) {
      const sp = this.spider;
      sp.bounceTimer -= dt;
      if (sp.bounceTimer <= 0) {
        sp.vy = (Math.random() - 0.5) * 300;
        sp.bounceTimer = 0.3 + Math.random() * 0.5;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.y = Math.max(PLAYER_ZONE_TOP - 40, Math.min(H - 20, sp.y));

      // Eat mushrooms it touches
      const sc = this._gridCol(sp.x);
      const sr = this._gridRow(sp.y);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const m = this._mushroomAt(sc + dc, sr + dr);
          if (m) m.hp = 0;
        }
      }

      // Off screen
      if (sp.x < -40 || sp.x > W + 40) this.spider = null;
    }
  }

  _updateFlea(dt) {
    this.fleaTimer -= dt;

    // Spawn flea when mushrooms are sparse in player area
    if (!this.flea && this.fleaTimer <= 0) {
      const playerAreaMush = this.mushrooms.filter(
        m => m.hp > 0 && m.row >= ROWS - 8
      ).length;
      if (playerAreaMush < 5) {
        this.flea = {
          x: Math.random() * (W - 40) + 20,
          y: -20,
          hp: 2,
          alive: true,
          speed: 200 + this.level * 15,
        };
      }
      this.fleaTimer = 10 + Math.random() * 8;
    }

    if (this.flea) {
      const fl = this.flea;
      fl.y += fl.speed * dt;

      // Leave mushrooms behind
      const fc = this._gridCol(fl.x);
      const fr = this._gridRow(fl.y);
      if (fr >= 2 && fr < ROWS && Math.random() < 0.3 * dt * 60) {
        if (!this._mushroomAt(fc, fr)) {
          this.mushrooms.push({ col: fc, row: fr, hp: MUSHROOM_HP, poisoned: false });
        }
      }

      if (fl.y > H + 20 || !fl.alive) this.flea = null;
    }
  }

  _updateScorpion(dt) {
    this.scorpionTimer -= dt;

    if (!this.scorpion && this.scorpionTimer <= 0 && this.level >= 2) {
      const fromLeft = Math.random() < 0.5;
      const row = 3 + Math.floor(Math.random() * 18);
      this.scorpion = {
        x: fromLeft ? -20 : W + 20,
        y: row * GRID + GRID / 2,
        dir: fromLeft ? 1 : -1,
        speed: 80 + this.level * 8,
        alive: true,
      };
      this.scorpionTimer = 15 + Math.random() * 10;
    }

    if (this.scorpion) {
      const sc = this.scorpion;
      sc.x += sc.dir * sc.speed * dt;

      // Poison mushrooms it passes
      const col = this._gridCol(sc.x);
      const row = this._gridRow(sc.y);
      const m = this._mushroomAt(col, row);
      if (m) m.poisoned = true;

      if (sc.x < -30 || sc.x > W + 30) this.scorpion = null;
    }
  }

  _checkCollisions() {
    // Bullets vs mushrooms
    for (const b of this.bullets) {
      if (!b.active) continue;
      const bc = this._gridCol(b.x);
      const br = this._gridRow(b.y);
      const m = this._mushroomAt(bc, br);
      if (m) {
        m.hp--;
        b.active = false;
        if (m.hp <= 0) {
          this.addScore(1, m.col * GRID + GRID / 2, m.row * GRID + GRID / 2);
          this.particles.emit(m.col * GRID + GRID / 2, m.row * GRID + GRID / 2, {
            count: 6, speed: 60, speedVariance: 30, life: 0.4, lifeVariance: 0.1,
            size: 3, sizeVariance: 1, endSize: 0, color: COL_MUSH, shape: 'square',
            angle: 0, spread: Math.PI, gravity: 100, friction: 0.97,
          });
        }
        this.audio.play('hit', { volume: 0.2, pitch: 2 });
        continue;
      }

      // Bullets vs centipede segments
      for (const seg of this.segments) {
        if (!seg.alive) continue;
        const sx = seg.x, sy = seg.y;
        if (b.x >= sx && b.x <= sx + GRID && b.y >= sy && b.y <= sy + GRID) {
          seg.alive = false;
          b.active = false;
          // Turn into mushroom
          const sc = this._gridCol(sx + GRID / 2);
          const sr = this._gridRow(sy + GRID / 2);
          if (sr >= 0 && sr < ROWS && !this._mushroomAt(sc, sr)) {
            this.mushrooms.push({ col: sc, row: sr, hp: MUSHROOM_HP, poisoned: false });
          }
          const pts = seg.isHead ? 100 : 10;
          this.addScore(pts, sx + GRID / 2, sy + GRID / 2);
          this.particles.emit(sx + GRID / 2, sy + GRID / 2, {
            count: 12, speed: 100, speedVariance: 50, life: 0.5, lifeVariance: 0.15,
            size: 4, sizeVariance: 2, endSize: 0, shape: 'circle',
            color: [seg.isHead ? COL_HEAD : COL_BODY, '#ffcc00', '#ff8800'],
            angle: 0, spread: Math.PI, friction: 0.95,
          });
          this.audio.play('hit', { volume: 0.5 });

          // Promote the next segment after this head to become a new head
          this._promoteNextHead(seg);
          break;
        }
      }

      // Bullets vs spider
      if (b.active && this.spider && this.spider.alive) {
        const sp = this.spider;
        const dx = b.x - sp.x, dy = b.y - sp.y;
        if (dx * dx + dy * dy < 15 * 15) {
          const dist = Math.abs(this.player.y - sp.y);
          let pts;
          if (dist > 120) pts = 900;
          else if (dist > 60) pts = 600;
          else pts = 300;
          this.addScore(pts, sp.x, sp.y);
          if (pts === 900) this.achievements.unlock('spider-sniper');
          this.particles.emit(sp.x, sp.y, 'explosion');
          this.effects.shake(6, 0.3);
          this.audio.play('explosion', { volume: 0.6 });
          this.spider = null;
          b.active = false;
        }
      }

      // Bullets vs flea
      if (b.active && this.flea && this.flea.alive) {
        const fl = this.flea;
        const dx = b.x - fl.x, dy = b.y - fl.y;
        if (dx * dx + dy * dy < 12 * 12) {
          fl.hp--;
          b.active = false;
          if (fl.hp <= 0) {
            this.addScore(200, fl.x, fl.y);
            this.particles.emit(fl.x, fl.y, {
              count: 10, speed: 80, speedVariance: 40, life: 0.4,
              size: 3, endSize: 0, color: [COL_FLEA, '#ff88ff', '#ffaaff'],
              angle: 0, spread: Math.PI, shape: 'circle', friction: 0.95,
            });
            this.audio.play('hit', { volume: 0.5 });
            this.flea = null;
          }
        }
      }

      // Bullets vs scorpion
      if (b.active && this.scorpion && this.scorpion.alive) {
        const sc = this.scorpion;
        const dx = b.x - sc.x, dy = b.y - sc.y;
        if (dx * dx + dy * dy < 14 * 14) {
          this.addScore(1000, sc.x, sc.y);
          this.scorpionKills++;
          if (this.scorpionKills >= 3) this.achievements.unlock('scorpion-hunter');
          this.particles.emit(sc.x, sc.y, 'explosion');
          this.audio.play('explosion', { volume: 0.5 });
          this.scorpion = null;
          b.active = false;
        }
      }
    }

    // Player vs centipede / spider / flea
    const px = this.player.x, py = this.player.y;
    for (const seg of this.segments) {
      if (!seg.alive) continue;
      const dx = px - (seg.x + GRID / 2), dy = py - (seg.y + GRID / 2);
      if (dx * dx + dy * dy < 14 * 14) {
        this._playerDie();
        return;
      }
    }
    if (this.spider) {
      const dx = px - this.spider.x, dy = py - this.spider.y;
      if (dx * dx + dy * dy < 16 * 16) {
        this._playerDie();
        return;
      }
    }
    if (this.flea) {
      const dx = px - this.flea.x, dy = py - this.flea.y;
      if (dx * dx + dy * dy < 12 * 12) {
        this._playerDie();
        return;
      }
    }
  }

  _promoteNextHead(deadSeg) {
    // Find segments that were behind this head in the chain
    // Simple heuristic: any non-head segment within GRID distance becomes a head
    for (const seg of this.segments) {
      if (!seg.alive || seg === deadSeg || seg.isHead) continue;
      const dx = Math.abs(seg.x - deadSeg.x);
      const dy = Math.abs(seg.y - deadSeg.y);
      if (dx <= GRID * 1.5 && dy <= GRID * 1.5) {
        seg.isHead = true;
        break;
      }
    }
  }

  _playerDie() {
    this.lives--;
    this.effects.shake(8, 0.4);
    this.effects.flash('#ff0000', 0.2);
    this.particles.emit(this.player.x, this.player.y, 'explosion');
    this.audio.play('die');

    if (this.lives <= 0) {
      this.achievements.reportScore(this.score);
      AchievementManager.checkCrossGame();
      this.gameOver();
    } else {
      // Reset player position, clear enemies near player
      this.player.x = W / 2;
      this.player.y = H - 40;
      this.bullets = [];
      this.spider = null;
      this.flea = null;
    }
  }

  _checkAchievements() {
    const mushCount = this.mushrooms.filter(m => m.hp > 0).length;
    if (mushCount >= 50) this.achievements.unlock('mushroom-farmer');
  }

  // ── Render ─────────────────────────────────────────────────
  render(ctx) {
    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Player zone indicator
    ctx.fillStyle = 'rgba(0, 255, 255, 0.02)';
    ctx.fillRect(0, PLAYER_ZONE_TOP, W, H - PLAYER_ZONE_TOP);

    // Mushrooms
    for (const m of this.mushrooms) {
      if (m.hp <= 0) continue;
      drawMushroom(ctx, m.col * GRID, m.row * GRID, m.hp, m.poisoned);
    }

    // Centipede segments
    for (const seg of this.segments) {
      if (!seg.alive) continue;
      if (seg.isHead) {
        drawCentipedeHead(ctx, seg.x, seg.y, seg.dir);
      } else {
        drawCentipedeBody(ctx, seg.x, seg.y, this.gameTime);
      }
    }

    // Spider
    if (this.spider) {
      drawSpider(ctx, this.spider.x, this.spider.y, this.gameTime);
    }

    // Flea
    if (this.flea) {
      drawFlea(ctx, this.flea.x, this.flea.y, this.gameTime, this.flea.hp);
    }

    // Scorpion
    if (this.scorpion) {
      drawScorpion(ctx, this.scorpion.x, this.scorpion.y, this.scorpion.dir, this.gameTime);
    }

    // Bullets
    ctx.fillStyle = COL_BULLET;
    for (const b of this.bullets) {
      if (!b.active) continue;
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }

    // Player
    drawPlayer(ctx, this.player.x, this.player.y);

    // Level clear message
    if (this.levelClearing) {
      ctx.save();
      ctx.fillStyle = '#22cc44';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LEVEL ${this.level} CLEAR!`, W / 2, H / 2);
      ctx.restore();
    }
  }

  renderGameOver(ctx) {
    // Draw the field behind the game over overlay
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);
    for (const m of this.mushrooms) {
      if (m.hp <= 0) continue;
      drawMushroom(ctx, m.col * GRID, m.row * GRID, m.hp, m.poisoned);
    }
  }
}

// ── Bootstrap ────────────────────────────────────────────────
const game = new BugShooter('game-canvas', {
  width: W,
  height: H,
  background: '#0a0a14',
});
game.start();

})();
