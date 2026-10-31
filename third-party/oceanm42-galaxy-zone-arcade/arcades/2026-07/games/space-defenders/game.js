/*!
 * games/space-defenders/game.js
 * Space Defenders — Sal's Galaxy Zone Arcade, inspired by Space Invaders
 * (1978). A single IIFE against the GZ engine: 5x11 marching formation with
 * classic "heartbeat" tempo acceleration, one-shot player cannon, eroding
 * bunkers, invader bombs, and a wandering UFO bonus target.
 */
(function () {
  'use strict';

  // ---- palette --------------------------------------------------------------
  var COLOR_PLAYER = '#39ff6a';   // manifest accent
  var COLOR_ENEMY = '#00f0ff';    // single secondary neon (invaders/bombs/UFO)
  var COLOR_STRUCT = '#eaf6ff';   // neutral structural color (bunkers, stars)
  var COLOR_SCORE = '#ffe600';    // floating score text (matches retro-tennis convention)

  // ---- field / formation constants ------------------------------------------
  var INV_COLS = 11, INV_ROWS = 5;
  var INV_W = 28, INV_H = 18;
  var COL_SPACING = 48, ROW_SPACING = 34;
  var START_X = 146;
  var BASE_START_Y = 90;
  var LEVEL_STEP_DOWN = 22;
  var MAX_START_Y = 250;
  var FIELD_LEFT = 40, FIELD_RIGHT = 760;
  var STEP_DX = 10, DROP_STEP = 16;
  var MAX_STEP_INTERVAL = 0.85, MIN_STEP_INTERVAL = 0.06;
  var TIER_POINTS = [30, 20, 10];

  // ---- cannon / bullets -------------------------------------------------------
  var CANNON_Y = 556, CANNON_W = 34, CANNON_H = 16;
  var PLAYER_SPEED = 280;
  var PLAYER_MIN_X = 30, PLAYER_MAX_X = 770;
  var BULLET_W = 4, BULLET_H = 12, BULLET_SPEED = 480;
  var BOTTOM_LIMIT_Y = CANNON_Y - 10;
  var INVULN_TIME = 2.0;

  // ---- bombs ------------------------------------------------------------------
  var BOMB_W = 4, BOMB_H = 10;

  // ---- bunkers ------------------------------------------------------------------
  var BUNKER_CENTERS = [150, 316, 482, 648];
  var BUNKER_Y = 420;
  var BUNKER_COLS = 14, BUNKER_ROWS = 11, BUNKER_CELL = 5;

  // ---- UFO ------------------------------------------------------------------
  var UFO_W = 36, UFO_H = 16, UFO_Y = 54, UFO_SPEED = 130;
  var UFO_VALUES = [50, 50, 100, 100, 150, 300];

  // ---- small helpers ------------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---- bunkers ------------------------------------------------------------------
  function makeBunker(cx, topY) {
    var cols = BUNKER_COLS, rows = BUNKER_ROWS, cs = BUNKER_CELL;
    var w = cols * cs, h = rows * cs;
    var x = cx - w / 2, y = topY;
    var cells = [];
    var midStart = Math.floor(cols / 2) - 2, midEnd = Math.floor(cols / 2) + 2;
    for (var r = 0; r < rows; r++) {
      var rowArr = [];
      for (var c = 0; c < cols; c++) {
        var exists = true;
        if (r === 0 && (c < 2 || c > cols - 3)) exists = false;
        if (r === 1 && (c < 1 || c > cols - 2)) exists = false;
        if (r >= rows - 3 && c >= midStart && c < midEnd) exists = false;
        rowArr.push(exists);
      }
      cells.push(rowArr);
    }
    return { x: x, y: y, cols: cols, rows: rows, cs: cs, w: w, h: h, cells: cells };
  }

  /** Erase bunker cells overlapping rect. If radius is given, erase a blast
   *  radius (diamond distance) around the first hit cell; otherwise erase
   *  every overlapping cell (used for invaders marching through). Returns
   *  true if any cell was hit. */
  function eraseBunkerCells(b, rx, ry, rw, rh, radius) {
    if (!rectsOverlap(rx, ry, rw, rh, b.x, b.y, b.w, b.h)) return false;
    var c0 = Math.max(0, Math.floor((rx - b.x) / b.cs));
    var c1 = Math.min(b.cols - 1, Math.floor((rx + rw - b.x) / b.cs));
    var r0 = Math.max(0, Math.floor((ry - b.y) / b.cs));
    var r1 = Math.min(b.rows - 1, Math.floor((ry + rh - b.y) / b.cs));
    var hit = false, hitC = -1, hitR = -1;
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (b.cells[r][c]) {
          if (!hit) { hit = true; hitC = c; hitR = r; }
          if (radius == null) b.cells[r][c] = false;
        }
      }
    }
    if (hit && radius != null) {
      for (var rr = Math.max(0, hitR - radius); rr <= Math.min(b.rows - 1, hitR + radius); rr++) {
        for (var cc = Math.max(0, hitC - radius); cc <= Math.min(b.cols - 1, hitC + radius); cc++) {
          if (Math.abs(rr - hitR) + Math.abs(cc - hitC) <= radius) b.cells[rr][cc] = false;
        }
      }
    }
    return hit;
  }

  // ---- invaders ------------------------------------------------------------------
  function buildInvaders(startY) {
    var arr = [];
    for (var row = 0; row < INV_ROWS; row++) {
      var tier = row === 0 ? 0 : (row <= 2 ? 1 : 2);
      for (var col = 0; col < INV_COLS; col++) {
        arr.push({
          row: row, col: col, tier: tier, alive: true,
          x: START_X + col * COL_SPACING,
          y: startY + row * ROW_SPACING
        });
      }
    }
    return arr;
  }

  function aliveInvaders(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i].alive) out.push(list[i]);
    return out;
  }

  function drawSquid(ctx, x, y, w, h, frame) {
    ctx.fillStyle = COLOR_ENEMY;
    ctx.fillRect(x + w * 0.38, y, w * 0.24, h * 0.32);
    ctx.fillRect(x + w * 0.08, y + h * 0.32, w * 0.84, h * 0.36);
    ctx.fillRect(x + w * 0.18, y + h * 0.68, w * 0.14, h * 0.2);
    ctx.fillRect(x + w * 0.68, y + h * 0.68, w * 0.14, h * 0.2);
    if (frame) {
      ctx.fillRect(x + w * 0.38, y + h * 0.7, w * 0.1, h * 0.3);
      ctx.fillRect(x + w * 0.52, y + h * 0.7, w * 0.1, h * 0.3);
    } else {
      ctx.fillRect(x + w * 0.3, y + h * 0.85, w * 0.12, h * 0.15);
      ctx.fillRect(x + w * 0.58, y + h * 0.85, w * 0.12, h * 0.15);
    }
  }

  function drawCrab(ctx, x, y, w, h, frame) {
    ctx.fillStyle = COLOR_ENEMY;
    ctx.fillRect(x + w * 0.2, y, w * 0.6, h * 0.28);
    ctx.fillRect(x, y + h * 0.28, w, h * 0.34);
    if (frame) {
      ctx.fillRect(x - w * 0.06, y + h * 0.3, w * 0.14, h * 0.2);
      ctx.fillRect(x + w * 0.92, y + h * 0.3, w * 0.14, h * 0.2);
      ctx.fillRect(x + w * 0.1, y + h * 0.62, w * 0.16, h * 0.38);
      ctx.fillRect(x + w * 0.74, y + h * 0.62, w * 0.16, h * 0.38);
    } else {
      ctx.fillRect(x + w * 0.06, y + h * 0.62, w * 0.14, h * 0.2);
      ctx.fillRect(x + w * 0.8, y + h * 0.62, w * 0.14, h * 0.2);
      ctx.fillRect(x + w * 0.24, y + h * 0.7, w * 0.14, h * 0.3);
      ctx.fillRect(x + w * 0.62, y + h * 0.7, w * 0.14, h * 0.3);
    }
  }

  function drawOctopus(ctx, x, y, w, h, frame) {
    ctx.fillStyle = COLOR_ENEMY;
    ctx.fillRect(x + w * 0.12, y, w * 0.76, h * 0.3);
    ctx.fillRect(x, y + h * 0.28, w, h * 0.32);
    ctx.fillRect(x + w * 0.06, y + h * 0.56, w * 0.88, h * 0.22);
    if (frame) {
      ctx.fillRect(x, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.3, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.56, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.84, y + h * 0.78, w * 0.16, h * 0.22);
    } else {
      ctx.fillRect(x + w * 0.1, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.4, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.66, y + h * 0.78, w * 0.16, h * 0.22);
      ctx.fillRect(x + w * 0.86, y + h * 0.78, w * 0.16, h * 0.22);
    }
  }

  function drawInvader(ctx, inv, frame) {
    if (inv.tier === 0) drawSquid(ctx, inv.x, inv.y, INV_W, INV_H, frame);
    else if (inv.tier === 1) drawCrab(ctx, inv.x, inv.y, INV_W, INV_H, frame);
    else drawOctopus(ctx, inv.x, inv.y, INV_W, INV_H, frame);
  }

  // ---- state setup helpers ------------------------------------------------------------------
  function levelClear(g) {
    var S = g.state;
    var newLevel = g.level + 1;
    g.setLevel(newLevel);
    var startY = clamp(BASE_START_Y + (newLevel - 1) * LEVEL_STEP_DOWN, BASE_START_Y, MAX_START_Y);
    S.invaders = buildInvaders(startY);
    S.dir = 1;
    S.stepTimer = 0;
    S.bombs = [];
    S.bombTimer = rand(1.1, 2.0);
    S.playerBullet = null;
    g.fx.flash(COLOR_PLAYER, 0.2);
    g.audio.play('levelup');
  }

  function computeStepInterval(g, aliveCount) {
    var t = aliveCount / (INV_ROWS * INV_COLS);
    var interval = MIN_STEP_INTERVAL + t * t * (MAX_STEP_INTERVAL - MIN_STEP_INTERVAL);
    interval *= Math.pow(0.93, g.level - 1);
    return Math.max(MIN_STEP_INTERVAL * 0.5, interval);
  }

  function eraseInvaderBunkerOverlaps(g) {
    var S = g.state;
    var alive = aliveInvaders(S.invaders);
    for (var i = 0; i < alive.length; i++) {
      var inv = alive[i];
      for (var j = 0; j < S.bunkers.length; j++) {
        eraseBunkerCells(S.bunkers[j], inv.x, inv.y, INV_W, INV_H, null);
      }
    }
  }

  function stepFormation(g) {
    var S = g.state;
    var alive = aliveInvaders(S.invaders);
    if (alive.length === 0) return;
    var minX = Infinity, maxX = -Infinity;
    for (var i = 0; i < alive.length; i++) {
      var inv = alive[i];
      if (inv.x < minX) minX = inv.x;
      if (inv.x + INV_W > maxX) maxX = inv.x + INV_W;
    }
    var willBreach = (S.dir > 0 && maxX + STEP_DX > FIELD_RIGHT) || (S.dir < 0 && minX - STEP_DX < FIELD_LEFT);
    if (willBreach) {
      for (i = 0; i < alive.length; i++) alive[i].y += DROP_STEP;
      S.dir *= -1;
      eraseInvaderBunkerOverlaps(g);
      for (i = 0; i < alive.length; i++) {
        if (alive[i].y + INV_H >= BOTTOM_LIMIT_Y) { g.gameOver(); return; }
      }
    } else {
      for (i = 0; i < alive.length; i++) alive[i].x += S.dir * STEP_DX;
      eraseInvaderBunkerOverlaps(g);
    }
    var freq = 60 + (1 - alive.length / (INV_ROWS * INV_COLS)) * 320;
    g.audio.tone({ freq: freq, dur: 0.045, type: 'square', vol: 0.16 });
  }

  function updateFormation(g, dt) {
    var S = g.state;
    var aliveCount = aliveInvaders(S.invaders).length;
    S.stepTimer += dt;
    var interval = computeStepInterval(g, aliveCount);
    if (S.stepTimer >= interval) {
      S.stepTimer = 0;
      S.marchFrame = !S.marchFrame;
      stepFormation(g);
    }
  }

  function spawnBomb(g) {
    var S = g.state;
    var alive = aliveInvaders(S.invaders);
    if (alive.length === 0) return;
    var bottoms = {};
    for (var i = 0; i < alive.length; i++) {
      var inv = alive[i];
      if (!bottoms[inv.col] || inv.y > bottoms[inv.col].y) bottoms[inv.col] = inv;
    }
    var keys = Object.keys(bottoms);
    if (keys.length === 0) return;
    var chosen = bottoms[keys[randInt(0, keys.length - 1)]];
    var speed = clamp(140 + g.level * 18, 140, 380);
    S.bombs.push({ x: chosen.x + INV_W / 2 - BOMB_W / 2, y: chosen.y + INV_H, vy: speed });
    g.audio.tone({ freq: 520, endFreq: 160, dur: 0.28, type: 'sawtooth', vol: 0.14 });
  }

  function onPlayerHit(g) {
    var S = g.state;
    g.audio.play('bigExplode');
    g.fx.shake(9, 0.4);
    g.fx.burst(S.playerX, CANNON_Y + CANNON_H / 2, { color: COLOR_PLAYER, count: 22, speed: 180, life: 0.6, size: 3 });
    var lives = g.lives - 1;
    g.setLives(lives);
    if (lives <= 0) { g.gameOver(); }
    else { S.invTimer = INVULN_TIME; }
  }

  function updateBombs(g, dt) {
    var S = g.state;
    S.bombTimer -= dt;
    var maxBombs = clamp(2 + Math.floor(g.level / 2), 2, 5);
    if (S.bombTimer <= 0 && S.bombs.length < maxBombs) {
      spawnBomb(g);
      S.bombTimer = rand(Math.max(0.4, 1.6 - g.level * 0.08), Math.max(0.9, 3.0 - g.level * 0.1));
    }
    for (var i = S.bombs.length - 1; i >= 0; i--) {
      var b = S.bombs[i];
      var oldY = b.y;
      b.y += b.vy * dt;
      var top = Math.min(oldY, b.y), bottom = Math.max(oldY, b.y) + BOMB_H;
      var resolved = false;
      for (var j = 0; j < S.bunkers.length; j++) {
        if (eraseBunkerCells(S.bunkers[j], b.x, top, BOMB_W, bottom - top, 2)) {
          resolved = true;
          g.audio.play('hit');
          g.fx.burst(b.x + BOMB_W / 2, b.y, { color: COLOR_ENEMY, count: 8, speed: 90, life: 0.3, size: 2 });
          break;
        }
      }
      if (!resolved && S.invTimer <= 0) {
        if (rectsOverlap(b.x, top, BOMB_W, bottom - top, S.playerX - CANNON_W / 2, CANNON_Y, CANNON_W, CANNON_H)) {
          resolved = true;
          onPlayerHit(g);
        }
      }
      if (resolved || b.y > 620) S.bombs.splice(i, 1);
    }
  }

  function updatePlayerBullet(g, dt) {
    var S = g.state;
    var bullet = S.playerBullet;
    if (!bullet) return;
    var oldY = bullet.y;
    bullet.y += bullet.vy * dt;
    var top = Math.min(oldY, bullet.y), bottom = Math.max(oldY, bullet.y) + BULLET_H;

    for (var j = 0; j < S.bunkers.length; j++) {
      if (eraseBunkerCells(S.bunkers[j], bullet.x, top, BULLET_W, bottom - top, 2)) {
        g.audio.play('hit');
        g.fx.burst(bullet.x + BULLET_W / 2, bullet.y, { color: COLOR_STRUCT, count: 6, speed: 80, life: 0.25, size: 2 });
        S.playerBullet = null;
        return;
      }
    }

    var alive = aliveInvaders(S.invaders);
    for (var i = 0; i < alive.length; i++) {
      var inv = alive[i];
      if (rectsOverlap(bullet.x, top, BULLET_W, bottom - top, inv.x, inv.y, INV_W, INV_H)) {
        inv.alive = false;
        g.addScore(TIER_POINTS[inv.tier]);
        g.audio.play('explode');
        g.fx.burst(inv.x + INV_W / 2, inv.y + INV_H / 2, { color: COLOR_ENEMY, count: 14, speed: 160, life: 0.45, size: 3 });
        S.playerBullet = null;
        if (aliveInvaders(S.invaders).length === 0) levelClear(g);
        return;
      }
    }

    if (S.ufo) {
      var u = S.ufo;
      if (rectsOverlap(bullet.x, top, BULLET_W, bottom - top, u.x, u.y, UFO_W, UFO_H)) {
        g.addScore(u.value);
        g.fx.text(u.x + UFO_W / 2, u.y, '+' + u.value, { color: COLOR_SCORE, size: 14 });
        g.fx.burst(u.x + UFO_W / 2, u.y + UFO_H / 2, { color: COLOR_ENEMY, count: 24, speed: 200, life: 0.6, size: 3 });
        g.audio.play('powerup');
        S.ufo = null;
        S.ufoTimer = rand(20, 30);
        S.playerBullet = null;
        return;
      }
    }

    if (bullet.y < -20) S.playerBullet = null;
  }

  function updateUfo(g, dt) {
    var S = g.state;
    S.ufoTimer -= dt;
    if (!S.ufo && S.ufoTimer <= 0) {
      var dir = Math.random() < 0.5 ? 1 : -1;
      S.ufo = {
        x: dir > 0 ? -UFO_W : g.width,
        y: UFO_Y, dir: dir,
        value: UFO_VALUES[randInt(0, UFO_VALUES.length - 1)]
      };
      g.audio.play('warp');
    }
    if (S.ufo) {
      S.ufo.x += S.ufo.dir * UFO_SPEED * dt;
      if ((S.ufo.dir > 0 && S.ufo.x > g.width + UFO_W) || (S.ufo.dir < 0 && S.ufo.x < -UFO_W * 2)) {
        S.ufo = null;
        S.ufoTimer = rand(20, 30);
      }
    }
  }

  GZ.boot({
    slug: 'space-defenders',
    touchLayout: 'lr-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['←/→ or A/D', 'Move'], ['SPACE', 'Fire']],
    state: {},

    init: function (g) {
      var S = g.state;
      g.setLives(3);
      g.setLevel(1);

      S.playerX = 400;
      S.invTimer = 0;
      S.playerBullet = null;

      S.dir = 1;
      S.stepTimer = 0;
      S.marchFrame = false;
      S.invaders = buildInvaders(BASE_START_Y);

      S.bunkers = [];
      for (var i = 0; i < BUNKER_CENTERS.length; i++) S.bunkers.push(makeBunker(BUNKER_CENTERS[i], BUNKER_Y));

      S.bombs = [];
      S.bombTimer = rand(1.5, 2.5);

      S.ufo = null;
      S.ufoTimer = rand(20, 30);

      S.stars = [];
      for (var s = 0; s < 60; s++) {
        S.stars.push({ x: Math.random() * g.width, y: Math.random() * (BUNKER_Y - 10), a: rand(0.15, 0.6) });
      }
    },

    update: function (g, dt) {
      var S = g.state;
      var input = g.input;

      var dir = 0;
      if (input.isDown('left')) dir -= 1;
      if (input.isDown('right')) dir += 1;
      S.playerX = clamp(S.playerX + dir * PLAYER_SPEED * dt, PLAYER_MIN_X, PLAYER_MAX_X);

      if (S.invTimer > 0) S.invTimer = Math.max(0, S.invTimer - dt);

      if (input.pressed('a') && !S.playerBullet) {
        S.playerBullet = { x: S.playerX - BULLET_W / 2, y: CANNON_Y - 6, vy: -BULLET_SPEED };
        g.audio.play('shoot');
      }

      updatePlayerBullet(g, dt);
      if (g.phase !== 'playing') return; // a bullet kill may have triggered gameOver via reaching zero elsewhere

      updateFormation(g, dt);
      if (g.phase !== 'playing') return; // formation reaching the bottom line ends the run

      updateBombs(g, dt);
      if (g.phase !== 'playing') return;

      updateUfo(g, dt);

      // safety net: a direct overlap between an invader and the cannon also ends the run
      var alive = aliveInvaders(S.invaders);
      for (var i = 0; i < alive.length; i++) {
        var inv = alive[i];
        if (rectsOverlap(inv.x, inv.y, INV_W, INV_H, S.playerX - CANNON_W / 2, CANNON_Y, CANNON_W, CANNON_H)) {
          g.gameOver();
          return;
        }
      }
    },

    render: function (g, ctx) {
      var S = g.state;

      // starfield
      ctx.fillStyle = COLOR_STRUCT;
      for (var i = 0; i < S.stars.length; i++) {
        var st = S.stars[i];
        ctx.globalAlpha = st.a;
        ctx.fillRect(st.x, st.y, 2, 2);
      }
      ctx.globalAlpha = 1;

      // ground line
      ctx.strokeStyle = 'rgba(234, 246, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, CANNON_Y + CANNON_H + 6);
      ctx.lineTo(g.width - 20, CANNON_Y + CANNON_H + 6);
      ctx.stroke();

      // bunkers
      ctx.fillStyle = COLOR_STRUCT;
      for (i = 0; i < S.bunkers.length; i++) {
        var b = S.bunkers[i];
        for (var r = 0; r < b.rows; r++) {
          for (var c = 0; c < b.cols; c++) {
            if (b.cells[r][c]) ctx.fillRect(b.x + c * b.cs, b.y + r * b.cs, b.cs - 1, b.cs - 1);
          }
        }
      }

      // invaders
      var alive = aliveInvaders(S.invaders);
      for (i = 0; i < alive.length; i++) drawInvader(ctx, alive[i], S.marchFrame);

      // UFO
      if (S.ufo) {
        var u = S.ufo;
        g.draw.glow(ctx, COLOR_ENEMY, 12, function () {
          ctx.fillStyle = COLOR_ENEMY;
          ctx.fillRect(u.x + UFO_W * 0.12, u.y + UFO_H * 0.35, UFO_W * 0.76, UFO_H * 0.4);
          ctx.fillRect(u.x, u.y + UFO_H * 0.55, UFO_W, UFO_H * 0.3);
          ctx.fillRect(u.x + UFO_W * 0.3, u.y, UFO_W * 0.4, UFO_H * 0.4);
        });
      }

      // bombs
      for (i = 0; i < S.bombs.length; i++) {
        var bomb = S.bombs[i];
        g.draw.glow(ctx, COLOR_ENEMY, 6, function () {
          ctx.fillStyle = COLOR_ENEMY;
          ctx.fillRect(bomb.x, bomb.y, BOMB_W, BOMB_H);
        });
      }

      // player bullet
      if (S.playerBullet) {
        var pb = S.playerBullet;
        g.draw.glow(ctx, COLOR_PLAYER, 8, function () {
          ctx.fillStyle = COLOR_PLAYER;
          ctx.fillRect(pb.x, pb.y, BULLET_W, BULLET_H);
        });
      }

      // cannon (blinks while invulnerable after respawn)
      var blinkVisible = S.invTimer <= 0 || Math.floor(g.time * 10) % 2 === 0;
      if (blinkVisible) {
        var px = S.playerX;
        g.draw.glow(ctx, COLOR_PLAYER, 10, function () {
          ctx.fillStyle = COLOR_PLAYER;
          ctx.fillRect(px - CANNON_W / 2, CANNON_Y + 6, CANNON_W, CANNON_H - 6);
          ctx.fillRect(px - 5, CANNON_Y, 10, 10);
        });
      }
    }
  });
})();
