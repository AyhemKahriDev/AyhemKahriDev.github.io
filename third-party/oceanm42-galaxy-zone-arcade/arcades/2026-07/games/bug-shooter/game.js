/*!
 * games/bug-shooter/game.js
 * Bug Shooter — inspired by Centipede (1980), built against Sal's Galaxy
 * Zone Arcade engine (see docs/ENGINE.md). Single IIFE, one GZ.boot() call,
 * everything scaled by dt.
 *
 * Mechanics: a mushroom field on a 30-column grid. One or more independent
 * centipede chains wind down the field using a follow-the-leader system —
 * shooting a body segment turns it into a mushroom and splits the chain in
 * two. A spider bounces the player's zone, a flea drops down to keep the
 * mushroom field stocked, and a scorpion crosses the upper rows poisoning
 * mushrooms it touches — any centipede segment that runs into a poisoned
 * mushroom dives straight for the bottom instead of turning around.
 */
(function () {
  'use strict';

  // ---- grid ------------------------------------------------------------
  var WIDTH = 800, HEIGHT = 600;
  var COLS = 30;
  var CELL = WIDTH / COLS;               // ~26.67px
  var ROWS = Math.floor(HEIGHT / CELL);  // 22
  var PLAYER_ZONE_ROWS = 5;
  var PLAYER_TOP_ROW = ROWS - PLAYER_ZONE_ROWS;

  // ---- tunables ----------------------------------------------------------
  var MUSHROOM_MIN = 25, MUSHROOM_MAX = 40;
  var MUSHROOM_TOP_ROW = 2; // keep rows 0-1 clear for the centipede's entry
  var PLAYER_SPEED = 260;
  var PLAYER_HALF = 10;
  var BULLET_SPEED = 760;
  var FIRE_COOLDOWN = 0.06;
  var BASE_STEP_TIME = 0.16;
  var STEP_TIME_DECAY = 0.012;
  var MIN_STEP_TIME = 0.05;
  var TOTAL_SEGMENTS = 12;
  var MAX_CHAINS = 6;
  var SPIDER_SPEED = 190;
  var FLEA_VY = 210;
  var FLEA_VY_BOOST = 1.85;
  var SCORPION_SPEED = 160;
  var HEAL_MAX = 6;
  var HEAL_STAGGER = 0.14;

  var SECONDARY = '#00f0ff';   // secondary neon used for the centipede itself
  var ACCENT = '#39ff6a';      // player / bullets (manifest accent)

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
  function cellCenter(row, col) { return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 }; }
  function dist(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0; return Math.sqrt(dx * dx + dy * dy); }

  function mushAt(S, row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return S.mush[row][col];
  }

  // ---- mushroom field ------------------------------------------------------
  function scatterMushrooms(S) {
    var count = randInt(MUSHROOM_MIN, MUSHROOM_MAX);
    var placed = 0, attempts = 0;
    while (placed < count && attempts < count * 30) {
      attempts++;
      var r = randInt(MUSHROOM_TOP_ROW, ROWS - 1);
      var c = randInt(0, COLS - 1);
      if (S.mush[r][c]) continue;
      S.mush[r][c] = { hp: 4, poison: false };
      placed++;
    }
  }

  // ---- centipede chains ----------------------------------------------------
  function spawnChains(S, wave) {
    var chainCount = Math.min(wave, MAX_CHAINS);
    var stepTime = Math.max(MIN_STEP_TIME, BASE_STEP_TIME - (wave - 1) * STEP_TIME_DECAY);
    var base = Math.floor(TOTAL_SEGMENTS / chainCount);
    var rem = TOTAL_SEGMENTS % chainCount;
    S.chains = [];
    for (var i = 0; i < chainCount; i++) {
      var len = Math.max(2, base + (i < rem ? 1 : 0));
      var startCol = clamp(Math.floor((i + 1) * COLS / (chainCount + 1)) - Math.floor(len / 2), 0, COLS - len);
      var segs = [];
      for (var j = 0; j < len; j++) segs.push({ col: startCol + j, row: 0 });
      S.chains.push({
        segs: segs,
        dir: (i % 2 === 0) ? 1 : -1,
        diving: false,
        timer: 0,
        stepTime: stepTime
      });
    }
  }

  function totalSegmentCount(S) {
    var n = 0;
    for (var i = 0; i < S.chains.length; i++) n += S.chains[i].segs.length;
    return n;
  }

  function stepChain(S, chain) {
    var segs = chain.segs;
    if (segs.length === 0) return;
    var head = segs[0];
    var prev = new Array(segs.length);
    for (var i = 0; i < segs.length; i++) prev[i] = { col: segs[i].col, row: segs[i].row };

    if (chain.diving) {
      var targetRow = head.row + 1;
      var blocked = targetRow >= ROWS || mushAt(S, targetRow, head.col);
      if (blocked) {
        chain.diving = false;
        head.row = Math.min(head.row, ROWS - 1);
      } else {
        head.row = targetRow;
      }
    } else {
      var nextCol = head.col + chain.dir;
      if (nextCol < 0 || nextCol >= COLS) {
        chain.dir *= -1;
        head.row = Math.min(head.row + 1, ROWS - 1);
      } else {
        var m = mushAt(S, head.row, nextCol);
        if (m) {
          if (m.poison) {
            chain.diving = true;
            head.row = Math.min(head.row + 1, ROWS - 1);
          } else {
            chain.dir *= -1;
            head.row = Math.min(head.row + 1, ROWS - 1);
          }
        } else {
          head.col = nextCol;
        }
      }
    }

    for (var k = 1; k < segs.length; k++) {
      segs[k].col = prev[k - 1].col;
      segs[k].row = prev[k - 1].row;
    }
  }

  /** Bullet killed segment `segIdx` of chain `chainIdx`: leaves a mushroom,
   *  scores, and splits the chain into whatever survives ahead of / behind
   *  the destroyed segment. */
  function killSegment(g, chainIdx, segIdx) {
    var S = g.state;
    var chain = S.chains[chainIdx];
    var seg = chain.segs[segIdx];
    var wasHead = segIdx === 0;
    var p = cellCenter(seg.row, seg.col);

    S.mush[seg.row][seg.col] = { hp: 4, poison: false };

    var pts = wasHead ? 100 : 10;
    g.addScore(pts);
    g.fx.burst(p.x, p.y, { color: SECONDARY, count: wasHead ? 18 : 12, speed: 170, life: 0.45, size: 3 });
    g.fx.text(p.x, p.y - 10, '+' + pts, { color: '#ffe600', size: wasHead ? 13 : 9 });
    g.audio.play(wasHead ? 'explode' : 'hit');

    var before = chain.segs.slice(0, segIdx);
    var after = chain.segs.slice(segIdx + 1);

    if (before.length > 0) {
      chain.segs = before;
    } else {
      S.chains.splice(chainIdx, 1);
    }
    if (after.length > 0) {
      S.chains.push({ segs: after, dir: chain.dir, diving: chain.diving, timer: 0, stepTime: chain.stepTime });
    }
  }

  /** Finds the first centipede segment the bullet overlaps and resolves the
   *  hit. Returns true if the bullet was consumed. */
  function bulletVsChains(g) {
    var S = g.state, b = S.bullet;
    for (var ci = 0; ci < S.chains.length; ci++) {
      var segs = S.chains[ci].segs;
      for (var si = 0; si < segs.length; si++) {
        var p = cellCenter(segs[si].row, segs[si].col);
        if (Math.abs(b.x - p.x) < CELL * 0.45 && Math.abs(b.y - p.y) < CELL * 0.45) {
          killSegment(g, ci, si);
          return true;
        }
      }
    }
    return false;
  }

  function bulletVsMushroom(g) {
    var S = g.state, b = S.bullet;
    var col = Math.floor(b.x / CELL), row = Math.floor(b.y / CELL);
    var m = mushAt(S, row, col);
    if (!m) return false;
    var p = cellCenter(row, col);
    m.hp--;
    if (m.hp <= 0) {
      S.mush[row][col] = null;
      g.addScore(1);
      g.fx.burst(p.x, p.y, { color: '#ff8a00', count: 10, speed: 120, life: 0.35, size: 3 });
      g.audio.play('explode');
    } else {
      g.fx.burst(p.x, p.y, { color: '#ff8a00', count: 4, speed: 70, life: 0.25, size: 2 });
      g.audio.play('hit');
    }
    return true;
  }

  function bulletVsSpider(g) {
    var S = g.state, b = S.bullet, sp = S.spider;
    if (!sp.active) return false;
    if (dist(b.x, b.y, sp.x, sp.y) > CELL * 0.7) return false;
    var d = dist(sp.x, sp.y, S.player.x, S.player.y);
    var pts = d < 90 ? 900 : (d < 180 ? 600 : 300);
    g.addScore(pts);
    g.fx.burst(sp.x, sp.y, { color: '#ffe600', count: 20, speed: 200, life: 0.5, size: 4 });
    g.fx.text(sp.x, sp.y - 12, '+' + pts, { color: '#ffe600', size: 12 });
    g.audio.play('explode');
    sp.active = false;
    sp.respawnTimer = randRange(3, 5.5);
    return true;
  }

  function bulletVsFlea(g) {
    var S = g.state, b = S.bullet, fl = S.flea;
    if (!fl.active) return false;
    if (Math.abs(b.x - fl.x) > CELL * 0.6 || Math.abs(b.y - fl.y) > CELL * 0.6) return false;
    fl.hits++;
    if (fl.hits >= 2) {
      g.addScore(200);
      g.fx.burst(fl.x, fl.y, { color: '#ff8a00', count: 16, speed: 180, life: 0.4, size: 3 });
      g.fx.text(fl.x, fl.y - 12, '+200', { color: '#ffe600', size: 11 });
      g.audio.play('explode');
      fl.active = false;
      fl.spawnCheckTimer = 10; // breathing room before the next flea
    } else {
      fl.vy *= FLEA_VY_BOOST;
      g.fx.burst(fl.x, fl.y, { color: '#ff8a00', count: 6, speed: 100, life: 0.25, size: 2 });
      g.audio.play('hit');
    }
    return true;
  }

  function bulletVsScorpion(g) {
    var S = g.state, b = S.bullet, sc = S.scorpion;
    if (!sc.active) return false;
    if (Math.abs(b.x - sc.x) > CELL * 0.8 || Math.abs(b.y - sc.y) > CELL * 0.6) return false;
    g.addScore(1000);
    g.fx.burst(sc.x, sc.y, { color: '#ff3355', count: 22, speed: 210, life: 0.5, size: 4 });
    g.fx.text(sc.x, sc.y - 12, '+1000', { color: '#ffe600', size: 12 });
    g.audio.play('bigExplode');
    sc.active = false;
    sc.spawnTimer = randRange(7, 13);
    return true;
  }

  // ---- mushroom heal (staggered, on player death) ---------------------------
  function queueHeal(g) {
    var S = g.state;
    var damaged = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var m = S.mush[r][c];
        if (m && m.hp < 4) damaged.push({ row: r, col: c });
      }
    }
    // shuffle
    for (var i = damaged.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = damaged[i]; damaged[i] = damaged[j]; damaged[j] = tmp;
    }
    var n = Math.min(HEAL_MAX, damaged.length);
    for (var k = 0; k < n; k++) {
      S.healQueue.push({ row: damaged[k].row, col: damaged[k].col, delay: k * HEAL_STAGGER });
    }
  }

  function updateHealQueue(g, dt) {
    var S = g.state;
    for (var i = S.healQueue.length - 1; i >= 0; i--) {
      var item = S.healQueue[i];
      item.delay -= dt;
      if (item.delay <= 0) {
        var m = mushAt(S, item.row, item.col);
        if (m) {
          m.hp = Math.min(4, m.hp + 1);
          g.addScore(5);
          var p = cellCenter(item.row, item.col);
          g.fx.text(p.x, p.y - 8, '+5', { color: '#39ff6a', size: 8 });
          g.audio.play('click');
        }
        S.healQueue.splice(i, 1);
      }
    }
  }

  // ---- player -----------------------------------------------------------
  function zoneTopY() { return PLAYER_TOP_ROW * CELL + PLAYER_HALF; }
  function zoneBottomY() { return HEIGHT - PLAYER_HALF - 4; }

  function resetPlayer(S) {
    S.player.x = WIDTH / 2;
    S.player.y = zoneBottomY() - CELL;
    S.bullet = null;
    S.fireCooldown = 0;
  }

  function playerOverlaps(S, x, y, halfSize) {
    return Math.abs(S.player.x - x) < PLAYER_HALF + halfSize && Math.abs(S.player.y - y) < PLAYER_HALF + halfSize;
  }

  function handlePlayerDeath(g) {
    var S = g.state;
    var lives = g.lives - 1;
    g.setLives(lives);
    g.audio.play('die');
    g.fx.shake(10, 0.4);
    g.fx.flash('#ff3355', 0.15);
    if (lives <= 0) {
      g.gameOver();
      return;
    }
    resetPlayer(S);
    spawnChains(S, S.wave);
    queueHeal(g);
  }

  // ---- spider -------------------------------------------------------------
  function spiderBandTop() { return (PLAYER_TOP_ROW - 3) * CELL; }
  function spiderBandBottom() { return HEIGHT - CELL * 0.6; }

  function spawnSpider(S) {
    var sp = S.spider;
    var fromLeft = Math.random() < 0.5;
    sp.x = fromLeft ? -CELL : WIDTH + CELL;
    sp.y = randRange(spiderBandTop(), spiderBandBottom());
    sp.vx = (fromLeft ? 1 : -1) * SPIDER_SPEED;
    sp.vy = (Math.random() < 0.5 ? 1 : -1) * SPIDER_SPEED * 0.6;
    sp.active = true;
    sp.life = randRange(6, 10);
    sp.wiggleTimer = randRange(0.2, 0.5);
  }

  function updateSpider(g, dt) {
    var S = g.state, sp = S.spider;
    if (!sp.active) {
      sp.respawnTimer -= dt;
      if (sp.respawnTimer <= 0) spawnSpider(S);
      return;
    }
    sp.life -= dt;
    sp.wiggleTimer -= dt;
    if (sp.wiggleTimer <= 0) {
      sp.wiggleTimer = randRange(0.2, 0.5);
      sp.vy = (Math.random() < 0.5 ? 1 : -1) * SPIDER_SPEED * randRange(0.4, 0.9);
    }

    if (sp.life <= 0) {
      // steer toward the nearer edge and make an exit
      sp.vx = (sp.x < WIDTH / 2 ? -1 : 1) * SPIDER_SPEED * 1.3;
    } else {
      if (sp.x < CELL && sp.vx < 0) sp.vx *= -1;
      if (sp.x > WIDTH - CELL && sp.vx > 0) sp.vx *= -1;
    }
    if (sp.y < spiderBandTop() && sp.vy < 0) sp.vy *= -1;
    if (sp.y > spiderBandBottom() && sp.vy > 0) sp.vy *= -1;

    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;

    if (sp.x < -CELL * 2 || sp.x > WIDTH + CELL * 2) {
      sp.active = false;
      sp.respawnTimer = randRange(3, 6);
      return;
    }

    var col = Math.floor(sp.x / CELL), row = Math.floor(sp.y / CELL);
    var m = mushAt(S, row, col);
    if (m) {
      S.mush[row][col] = null;
      g.fx.burst(sp.x, sp.y, { color: '#ffe600', count: 4, speed: 80, life: 0.25, size: 2 });
    }

    if (playerOverlaps(S, sp.x, sp.y, CELL * 0.4)) handlePlayerDeath(g);
  }

  // ---- flea -----------------------------------------------------------------
  function spawnFlea(S) {
    var fl = S.flea;
    fl.col = randInt(0, COLS - 1);
    fl.x = fl.col * CELL + CELL / 2;
    fl.y = -CELL / 2;
    fl.vy = FLEA_VY;
    fl.hits = 0;
    fl.lastWakeRow = -1;
    fl.active = true;
  }

  function bottomHalfMushroomCount(S) {
    var n = 0;
    var startRow = Math.floor(ROWS / 2);
    for (var r = startRow; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) if (S.mush[r][c]) n++;
    }
    return n;
  }

  function updateFlea(g, dt) {
    var S = g.state, fl = S.flea;
    fl.spawnCheckTimer -= dt;
    if (fl.spawnCheckTimer <= 0) {
      fl.spawnCheckTimer = 2;
      // Classic trigger: the flea only shows up when the player's half of the
      // board is genuinely bare (an absolute handful, not a percentage — a
      // fraction of total cells fired constantly and flooded the field).
      if (!fl.active && bottomHalfMushroomCount(S) < 6) spawnFlea(S);
    }
    if (!fl.active) return;

    fl.y += fl.vy * dt;
    var row = Math.floor(fl.y / CELL);
    if (row > fl.lastWakeRow && row >= 0 && row < ROWS) {
      fl.lastWakeRow = row;
      // Scatter mushrooms (about a third of rows), and never in the bottom
      // two rows — the player needs room to dodge.
      if (!S.mush[row][fl.col] && row < ROWS - 2 && Math.random() < 0.35) {
        S.mush[row][fl.col] = { hp: 4, poison: false };
      }
    }
    if (fl.y > HEIGHT + CELL) { fl.active = false; fl.spawnCheckTimer = 10; return; }
    if (playerOverlaps(S, fl.x, fl.y, CELL * 0.35)) handlePlayerDeath(g);
  }

  // ---- scorpion ---------------------------------------------------------
  function spawnScorpion(S) {
    var sc = S.scorpion;
    sc.row = randInt(1, Math.max(1, Math.floor(ROWS * 0.3)));
    sc.y = sc.row * CELL + CELL / 2;
    var fromLeft = Math.random() < 0.5;
    sc.x = fromLeft ? -CELL : WIDTH + CELL;
    sc.vx = (fromLeft ? 1 : -1) * SCORPION_SPEED;
    sc.active = true;
  }

  function updateScorpion(g, dt) {
    var S = g.state, sc = S.scorpion;
    if (!sc.active) {
      sc.spawnTimer -= dt;
      if (sc.spawnTimer <= 0) spawnScorpion(S);
      return;
    }
    sc.x += sc.vx * dt;
    var col = Math.floor(sc.x / CELL);
    var m = mushAt(S, sc.row, col);
    if (m && !m.poison) {
      m.poison = true;
      g.fx.burst(sc.x, sc.y, { color: '#a94dff', count: 4, speed: 60, life: 0.3, size: 2 });
    }
    if (sc.x < -CELL * 2 || sc.x > WIDTH + CELL * 2) {
      sc.active = false;
      sc.spawnTimer = randRange(7, 14);
      return;
    }
    if (playerOverlaps(S, sc.x, sc.y, CELL * 0.45)) handlePlayerDeath(g);
  }

  // ---- drawing ------------------------------------------------------------
  var CAP_SCALE = [0, 0.5, 0.68, 0.84, 1.0];
  var CAP_ALPHA = [0, 0.55, 0.7, 0.85, 1.0];

  function drawMushroom(ctx, x, y, m) {
    var scale = CAP_SCALE[m.hp] || 0.5;
    var alpha = CAP_ALPHA[m.hp] || 0.55;
    var stemW = CELL * 0.28, stemH = CELL * 0.3 * scale;
    var capR = CELL * 0.4 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = m.poison ? '#a94dff' : '#1f8f4d';
    ctx.fillRect(x - stemW / 2, y + capR * 0.2, stemW, stemH);
    ctx.beginPath();
    ctx.arc(x, y, capR, Math.PI, 0);
    ctx.fill();
    if (m.poison) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#a94dff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, capR + 2, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCentipede(g, ctx, chain) {
    var segs = chain.segs;
    for (var i = segs.length - 1; i >= 0; i--) {
      var p = cellCenter(segs[i].row, segs[i].col);
      var isHead = i === 0;
      var r = CELL * (isHead ? 0.44 : 0.38);
      if (isHead) {
        g.draw.glow(ctx, SECONDARY, 10, function () {
          ctx.fillStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(p.x - r * 0.35, p.y - r * 0.2, r * 0.18, 0, Math.PI * 2);
        ctx.arc(p.x + r * 0.35, p.y - r * 0.2, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = SECONDARY;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#07070c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function drawSpider(g, ctx, sp) {
    if (!sp.active) return;
    g.draw.glow(ctx, '#ffe600', 8, function () {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, CELL * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1.5;
    for (var i = 0; i < 3; i++) {
      var a = (i - 1) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sp.x - CELL * 0.35, sp.y);
      ctx.lineTo(sp.x - CELL * 0.7, sp.y + a * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sp.x + CELL * 0.35, sp.y);
      ctx.lineTo(sp.x + CELL * 0.7, sp.y + a * CELL);
      ctx.stroke();
    }
  }

  function drawFlea(ctx, fl) {
    if (!fl.active) return;
    ctx.fillStyle = '#ff8a00';
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y - CELL * 0.4);
    ctx.lineTo(fl.x + CELL * 0.3, fl.y + CELL * 0.3);
    ctx.lineTo(fl.x - CELL * 0.3, fl.y + CELL * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function drawScorpion(ctx, sc) {
    if (!sc.active) return;
    var facing = sc.vx >= 0 ? 1 : -1;
    ctx.fillStyle = '#ff3355';
    ctx.fillRect(sc.x - CELL * 0.5, sc.y - CELL * 0.22, CELL * 1.0, CELL * 0.44);
    ctx.beginPath();
    ctx.moveTo(sc.x - facing * CELL * 0.5, sc.y);
    ctx.lineTo(sc.x - facing * CELL * 0.85, sc.y - CELL * 0.35);
    ctx.lineTo(sc.x - facing * CELL * 0.65, sc.y - CELL * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer(g, ctx, S) {
    var x = S.player.x, y = S.player.y;
    g.draw.glow(ctx, ACCENT, 12, function () {
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(x, y - PLAYER_HALF);
      ctx.lineTo(x + PLAYER_HALF * 0.85, y + PLAYER_HALF);
      ctx.lineTo(x, y + PLAYER_HALF * 0.4);
      ctx.lineTo(x - PLAYER_HALF * 0.85, y + PLAYER_HALF);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawBullet(g, ctx, b) {
    if (!b) return;
    g.draw.glow(ctx, '#eaf6ff', 8, function () {
      ctx.fillStyle = '#eaf6ff';
      ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
    });
  }

  // ---- boot ---------------------------------------------------------------
  GZ.boot({
    slug: 'bug-shooter',
    touchLayout: 'lr-ud-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['Arrows/WASD', 'Move'], ['SPACE', 'Fire']],
    state: {},

    init: function (g) {
      var S = g.state;
      g.setLives(3);
      g.setLevel(1);
      S.wave = 1;
      S.mush = [];
      for (var r = 0; r < ROWS; r++) {
        S.mush.push(new Array(COLS).fill(null));
      }
      scatterMushrooms(S);
      S.chains = [];
      spawnChains(S, S.wave);
      S.player = { x: WIDTH / 2, y: zoneBottomY() - CELL };
      S.bullet = null;
      S.fireCooldown = 0;
      S.spider = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, wiggleTimer: 0, respawnTimer: randRange(3, 6) };
      S.flea = { active: false, x: 0, y: 0, vy: 0, hits: 0, col: 0, lastWakeRow: -1, spawnCheckTimer: 1.2 };
      S.scorpion = { active: false, x: 0, y: 0, vx: 0, row: 0, spawnTimer: randRange(5, 10) };
      S.healQueue = [];
    },

    update: function (g, dt) {
      var S = g.state, input = g.input;

      // player movement, confined to the bottom PLAYER_ZONE_ROWS band
      var dx = 0, dy = 0;
      if (input.isDown('left')) dx -= 1;
      if (input.isDown('right')) dx += 1;
      if (input.isDown('up')) dy -= 1;
      if (input.isDown('down')) dy += 1;
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
      S.player.x = clamp(S.player.x + dx * PLAYER_SPEED * dt, PLAYER_HALF, WIDTH - PLAYER_HALF);
      S.player.y = clamp(S.player.y + dy * PLAYER_SPEED * dt, zoneTopY(), zoneBottomY());

      // firing: single bullet on screen, rapid turnover
      S.fireCooldown = Math.max(0, S.fireCooldown - dt);
      if (!S.bullet && S.fireCooldown <= 0 && input.isDown('a')) {
        S.bullet = { x: S.player.x, y: S.player.y - PLAYER_HALF };
        g.audio.play('shoot');
        S.fireCooldown = FIRE_COOLDOWN;
      }
      if (S.bullet) {
        S.bullet.y -= BULLET_SPEED * dt;
        if (S.bullet.y < -8) {
          S.bullet = null;
        } else {
          var consumed = bulletVsChains(g);
          if (!consumed) consumed = bulletVsSpider(g);
          if (!consumed) consumed = bulletVsFlea(g);
          if (!consumed) consumed = bulletVsScorpion(g);
          if (!consumed) consumed = bulletVsMushroom(g);
          if (consumed) S.bullet = null;
        }
      }

      // centipede chain stepping
      for (var ci = 0; ci < S.chains.length; ci++) {
        var chain = S.chains[ci];
        chain.timer += dt;
        var guard = 0;
        while (chain.timer >= chain.stepTime && guard < 5) {
          chain.timer -= chain.stepTime;
          stepChain(S, chain);
          guard++;
        }
      }

      updateSpider(g, dt);
      updateFlea(g, dt);
      updateScorpion(g, dt);
      updateHealQueue(g, dt);

      // player vs centipede segments
      outer:
      for (var i = 0; i < S.chains.length; i++) {
        var segs = S.chains[i].segs;
        for (var j = 0; j < segs.length; j++) {
          var p = cellCenter(segs[j].row, segs[j].col);
          if (playerOverlaps(S, p.x, p.y, CELL * 0.4)) {
            handlePlayerDeath(g);
            break outer;
          }
        }
      }

      // wave clear
      if (g.phase === 'playing' && totalSegmentCount(S) === 0) {
        S.wave++;
        g.setLevel(S.wave);
        g.audio.play('levelup');
        g.fx.flash(ACCENT, 0.2);
        g.fx.text(WIDTH / 2, HEIGHT / 2, 'WAVE ' + S.wave, { color: ACCENT, size: 16 });
        spawnChains(S, S.wave);
      }
    },

    render: function (g, ctx) {
      var S = g.state;
      var r, c;

      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          var m = S.mush[r][c];
          if (m) {
            var p = cellCenter(r, c);
            drawMushroom(ctx, p.x, p.y, m);
          }
        }
      }

      for (var ci = 0; ci < S.chains.length; ci++) drawCentipede(g, ctx, S.chains[ci]);

      drawSpider(g, ctx, S.spider);
      drawFlea(ctx, S.flea);
      drawScorpion(ctx, S.scorpion);

      drawPlayer(g, ctx, S);
      drawBullet(g, ctx, S.bullet);
    }
  });
})();
