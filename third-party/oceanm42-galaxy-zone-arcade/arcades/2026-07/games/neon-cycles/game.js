/*!
 * games/neon-cycles/game.js
 * Neon Cycles — inspired by Tron's light cycles (1982). Grid-based for
 * fairness: the arena is 100x72 cells and every cycle advances exactly one
 * cell at a time at a cells-per-second rate, with the head rendered
 * interpolated between cells so motion looks perfectly smooth. Collisions
 * are decided on the grid — if the next cell is a wall or any trail, the
 * cycle derezzes — so the player and the AIs live by identical rules.
 *
 * Three AI personalities share one core: look down the current heading,
 * and when the road runs short (or personality says so), score each legal
 * 90° turn with a bounded flood-count of reachable open cells. AGGRESSIVE
 * also biases toward a point projected ahead of the player (the cut-off
 * move), CAUTIOUS just takes the most open space, ERRATIC adds jitter and
 * random-but-never-suicidal turns.
 */
(function () {
  'use strict';

  var COLS = 100, ROWS = 72, CELL = 8;
  var OX = (800 - COLS * CELL) / 2;
  var OY = (600 - ROWS * CELL) / 2;

  var BASE_SPEED = 21;      // cells/sec
  var BOOST_MUL = 1.6;
  var BOOST_DRAIN = 0.5;    // meter/sec while boosting
  var BOOST_REGEN = 0.22;   // meter/sec while not
  var FLOOD_CAP = 140;
  var COUNTDOWN = 1.4;
  var ROUND_END_PAUSE = 2.0;

  var PLAYER_COLOR = '#00f0ff';
  var AI_COLORS = ['#ff8a00', '#ff2ec4', '#39ff6a'];
  var LEVEL_TINTS = ['#00f0ff', '#a94dff', '#ff2ec4', '#39ff6a', '#ffe600', '#ff8a00'];

  var UP = { dx: 0, dy: -1 };
  var DOWN = { dx: 0, dy: 1 };
  var LEFT = { dx: -1, dy: 0 };
  var RIGHT = { dx: 1, dy: 0 };

  function pxOf(x) { return OX + x * CELL + CELL / 2; }
  function pyOf(y) { return OY + y * CELL + CELL / 2; }

  function gridIdx(x, y) { return y * COLS + x; }

  function isFree(S, x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    return S.grid[gridIdx(x, y)] === 0;
  }

  /** Bounded BFS flood-count of open cells starting one step in `dir`. */
  function floodCount(S, x, y) {
    if (!isFree(S, x, y)) return 0;
    var seen = S.floodSeen;
    S.floodStamp++;
    var stamp = S.floodStamp;
    var queue = S.floodQueue;
    var head = 0, tail = 0, count = 0;
    queue[tail++] = gridIdx(x, y);
    seen[gridIdx(x, y)] = stamp;
    while (head < tail && count < FLOOD_CAP) {
      var idx = queue[head++];
      count++;
      var cx = idx % COLS, cy = (idx - cx) / COLS;
      var nbrs = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (var i = 0; i < 4; i++) {
        var nx = nbrs[i][0], ny = nbrs[i][1];
        if (!isFree(S, nx, ny)) continue;
        var nidx = gridIdx(nx, ny);
        if (seen[nidx] === stamp) continue;
        seen[nidx] = stamp;
        if (tail < queue.length) queue[tail++] = nidx;
      }
    }
    return count;
  }

  function aheadClearance(S, cyc, dir, max) {
    var n = 0;
    var x = cyc.x, y = cyc.y;
    while (n < max) {
      x += dir.dx; y += dir.dy;
      if (!isFree(S, x, y)) break;
      n++;
    }
    return n;
  }

  function makeCycle(x, y, dir, color, isPlayer, aiType, speed) {
    return {
      x: x, y: y, dir: dir, queued: null,
      progress: 0, speed: speed,
      color: color, isPlayer: isPlayer, ai: aiType || null,
      alive: true,
      pts: [{ x: pxOf(x), y: pyOf(y) }]
    };
  }

  function aiCountFor(level) { return Math.min(3, 1 + Math.floor((level - 1) / 2)); }

  function setupRound(g) {
    var S = g.state;
    S.grid = new Uint8Array(COLS * ROWS);
    S.floodSeen = new Int32Array(COLS * ROWS);
    S.floodStamp = 0;
    S.floodQueue = new Int32Array(FLOOD_CAP * 5);

    var lvl = S.levelNum;
    var aiSpeed = BASE_SPEED * Math.min(1.35, 1 + (lvl - 1) * 0.045);
    var n = aiCountFor(lvl);

    S.cycles = [];
    var player = makeCycle(12, 36, RIGHT, PLAYER_COLOR, true, null, BASE_SPEED);
    S.cycles.push(player);
    var aiTypes = ['aggressive', 'cautious', 'erratic'];
    var spawns = [
      { x: COLS - 13, y: 36, dir: LEFT },
      { x: 50, y: 9, dir: DOWN },
      { x: 50, y: ROWS - 10, dir: UP }
    ];
    for (var i = 0; i < n; i++) {
      var sp = spawns[i];
      S.cycles.push(makeCycle(sp.x, sp.y, sp.dir, AI_COLORS[i], false, aiTypes[i], aiSpeed));
    }
    for (var j = 0; j < S.cycles.length; j++) {
      var c = S.cycles[j];
      S.grid[gridIdx(c.x, c.y)] = 1;
    }

    S.boostMeter = 1;
    S.boosting = false;
    S.surviveAcc = 0;
    S.roundPhase = 'countdown';
    S.roundTimer = COUNTDOWN;
    S.tint = LEVEL_TINTS[(lvl - 1) % LEVEL_TINTS.length];
  }

  function derez(g, cyc) {
    var S = g.state;
    cyc.alive = false;
    var hx = pxOf(cyc.x), hy = pyOf(cyc.y);
    g.fx.burst(hx, hy, { color: cyc.color, count: cyc.isPlayer ? 30 : 20, speed: 220, life: 0.7, size: 3 });
    if (cyc.isPlayer) {
      g.fx.shake(10, 0.45);
      g.fx.flash('#ff3355', 0.18);
      g.audio.play('bigExplode');
    } else {
      g.audio.play('explode');
      var player = S.cycles[0];
      if (player.alive) {
        g.addScore(500);
        g.fx.text(hx, hy - 8, '+500 DEREZZED', { color: cyc.color, size: 10 });
      }
    }
  }

  function turnIsLegal(cyc, d) {
    if (!d) return false;
    if (d.dx === cyc.dir.dx && d.dy === cyc.dir.dy) return false;      // same way
    if (d.dx === -cyc.dir.dx && d.dy === -cyc.dir.dy) return false;    // reverse
    return true;
  }

  function applyTurn(cyc) {
    if (cyc.queued && turnIsLegal(cyc, cyc.queued)) {
      cyc.dir = cyc.queued;
      cyc.pts.push({ x: pxOf(cyc.x), y: pyOf(cyc.y) });
    }
    cyc.queued = null;
  }

  function aiThink(g, cyc) {
    var S = g.state;
    var player = S.cycles[0];
    var lookahead = cyc.ai === 'cautious' ? 9 : (cyc.ai === 'aggressive' ? 5 : 4);
    var ahead = aheadClearance(S, cyc, cyc.dir, lookahead + 1);

    var wantsTurn = ahead < lookahead;
    if (!wantsTurn) {
      if (cyc.ai === 'erratic' && Math.random() < 0.06) wantsTurn = true;
      else if (cyc.ai === 'aggressive' && Math.random() < 0.10) wantsTurn = true;
      else if (cyc.ai === 'cautious' && Math.random() < 0.02) wantsTurn = true;
    }
    if (!wantsTurn) return;

    // candidate directions: straight + both perpendiculars
    var perp = (cyc.dir.dx !== 0) ? [UP, DOWN] : [LEFT, RIGHT];
    var candidates = [cyc.dir, perp[0], perp[1]];
    var bestDir = null, bestScore = -Infinity;

    // aggressive: intercept a point projected ahead of the player's heading
    var ix = 0, iy = 0;
    if (cyc.ai === 'aggressive' && player.alive) {
      ix = player.x + player.dir.dx * 10;
      iy = player.y + player.dir.dy * 10;
    }

    for (var i = 0; i < candidates.length; i++) {
      var d = candidates[i];
      var nx = cyc.x + d.dx, ny = cyc.y + d.dy;
      if (!isFree(S, nx, ny)) continue; // never suicidal, any personality
      var score = floodCount(S, nx, ny);
      if (cyc.ai === 'aggressive' && player.alive) {
        var dist = Math.abs(nx - ix) + Math.abs(ny - iy);
        score -= dist * 1.6;
      } else if (cyc.ai === 'erratic') {
        score += Math.random() * 70;
      }
      // mild straight-line preference so cycles don't stairstep constantly
      if (d === cyc.dir) score += 6;
      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    if (bestDir && bestDir !== cyc.dir) cyc.queued = bestDir;
  }

  /** Advance one cycle by dt; commits whole-cell steps, marks trail, crashes. */
  function stepCycle(g, cyc, dt) {
    var S = g.state;
    var speed = cyc.speed;
    if (cyc.isPlayer && S.boosting) speed *= BOOST_MUL;
    cyc.progress += speed * dt;
    var guard = 0;
    while (cyc.progress >= 1 && cyc.alive && guard < 8) {
      cyc.progress -= 1;
      guard++;
      if (!cyc.isPlayer) aiThink(g, cyc);
      applyTurn(cyc);
      var nx = cyc.x + cyc.dir.dx, ny = cyc.y + cyc.dir.dy;
      if (!isFree(S, nx, ny)) {
        cyc.progress = 0;
        derez(g, cyc);
        return;
      }
      cyc.x = nx; cyc.y = ny;
      S.grid[gridIdx(nx, ny)] = 1;
    }
  }

  function headPx(cyc) {
    var t = cyc.alive ? cyc.progress : 0;
    return {
      x: pxOf(cyc.x) + cyc.dir.dx * t * CELL,
      y: pyOf(cyc.y) + cyc.dir.dy * t * CELL
    };
  }

  function endRound(g, playerWon) {
    var S = g.state;
    S.roundPhase = playerWon ? 'won' : 'lost';
    S.roundTimer = ROUND_END_PAUSE;
    if (playerWon) {
      g.addScore(1000);
      g.fx.text(400, 260, '+1000 ROUND WON', { color: S.tint, size: 13 });
      g.fx.flash(S.tint, 0.25);
      g.audio.play('levelup');
    }
  }

  function drawArena(ctx, S, g) {
    // subtle grid lines every 10 cells
    ctx.save();
    ctx.strokeStyle = S.tint;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 1;
    var i;
    for (i = 0; i <= COLS; i += 10) {
      ctx.beginPath();
      ctx.moveTo(OX + i * CELL, OY);
      ctx.lineTo(OX + i * CELL, OY + ROWS * CELL);
      ctx.stroke();
    }
    for (i = 0; i <= ROWS; i += 10) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + i * CELL);
      ctx.lineTo(OX + COLS * CELL, OY + i * CELL);
      ctx.stroke();
    }
    ctx.restore();

    // arena border in the level tint
    g.draw.glow(ctx, S.tint, 12, function () {
      ctx.strokeStyle = S.tint;
      ctx.lineWidth = 3;
      ctx.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
    });
  }

  function drawCycle(ctx, cyc, g) {
    var head = headPx(cyc);
    // trail polyline with glow
    g.draw.glow(ctx, cyc.color, 8, function () {
      ctx.strokeStyle = cyc.color;
      ctx.lineWidth = CELL * 0.55;
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.globalAlpha = cyc.alive ? 0.85 : 0.3;
      ctx.beginPath();
      ctx.moveTo(cyc.pts[0].x, cyc.pts[0].y);
      for (var i = 1; i < cyc.pts.length; i++) ctx.lineTo(cyc.pts[i].x, cyc.pts[i].y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    if (!cyc.alive) return;
    // glowing head: bright core + color shell
    g.draw.glow(ctx, cyc.color, 16, function () {
      ctx.fillStyle = cyc.color;
      ctx.beginPath();
      ctx.arc(head.x, head.y, CELL * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.arc(head.x, head.y, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoostMeter(ctx, S, g) {
    var w = 150, h = 10, x = OX + 6, y = OY + ROWS * CELL - h - 6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#12121c';
    ctx.fillRect(x, y, w, h);
    var fillColor = S.boosting ? '#ffe600' : PLAYER_COLOR;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 1, y + 1, (w - 2) * S.boostMeter, h - 2);
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    g.draw.text(ctx, 'BOOST', x, y - 4, { size: 7, color: PLAYER_COLOR });
  }

  GZ.boot({
    slug: 'neon-cycles',
    touchLayout: 'swipe',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['Arrows / WASD / Swipe', 'Turn 90°'], ['Hold A', 'Boost']],
    state: {},

    init: function (g) {
      var S = g.state;
      g.setLives(3);
      g.setLevel(1);
      S.levelNum = 1;
      setupRound(g);
    },

    update: function (g, dt) {
      var S = g.state;
      var player = S.cycles[0];

      // queue player turns (edge-triggered so swipes and taps behave the same)
      var want = null;
      if (g.input.pressed('up')) want = UP;
      else if (g.input.pressed('down')) want = DOWN;
      else if (g.input.pressed('left')) want = LEFT;
      else if (g.input.pressed('right')) want = RIGHT;
      if (want && turnIsLegal(player, want)) {
        player.queued = want;
        g.audio.play('move');
      }

      if (S.roundPhase === 'countdown') {
        S.roundTimer -= dt;
        if (S.roundTimer <= 0) S.roundPhase = 'racing';
        return;
      }

      if (S.roundPhase === 'won' || S.roundPhase === 'lost') {
        S.roundTimer -= dt;
        if (S.roundTimer <= 0) {
          if (S.roundPhase === 'won') {
            S.levelNum++;
            g.setLevel(S.levelNum);
          } else {
            var lives = g.lives - 1;
            g.setLives(lives);
            if (lives <= 0) { g.gameOver(); return; }
          }
          setupRound(g);
        }
        return;
      }

      // ---- racing ----
      // boost meter
      S.boosting = player.alive && g.input.isDown('a') && S.boostMeter > 0;
      if (S.boosting) {
        S.boostMeter = Math.max(0, S.boostMeter - BOOST_DRAIN * dt);
        if (S.boostMeter === 0) S.boosting = false;
      } else {
        S.boostMeter = Math.min(1, S.boostMeter + BOOST_REGEN * dt);
      }

      // survival score ticks
      if (player.alive) {
        S.surviveAcc += dt;
        while (S.surviveAcc >= 1) {
          S.surviveAcc -= 1;
          g.addScore(10);
        }
      }

      for (var i = 0; i < S.cycles.length; i++) {
        var c = S.cycles[i];
        if (c.alive) stepCycle(g, c, dt);
      }

      var aisAlive = 0;
      for (var j = 1; j < S.cycles.length; j++) if (S.cycles[j].alive) aisAlive++;

      if (!player.alive) endRound(g, false);
      else if (aisAlive === 0) endRound(g, true);
    },

    render: function (g, ctx) {
      var S = g.state;
      drawArena(ctx, S, g);
      for (var i = S.cycles.length - 1; i >= 0; i--) drawCycle(ctx, S.cycles[i], g);
      drawBoostMeter(ctx, S, g);

      if (g.phase === 'playing') {
        if (S.roundPhase === 'countdown') {
          g.draw.text(ctx, 'LEVEL ' + S.levelNum, 400, 270, { size: 16, color: S.tint, align: 'center', glow: true });
          g.draw.text(ctx, 'GET READY', 400, 300, { size: 11, color: '#eaf6ff', align: 'center' });
        } else if (S.roundPhase === 'won') {
          g.draw.text(ctx, 'ROUND WON', 400, 290, { size: 16, color: S.tint, align: 'center', glow: true });
        } else if (S.roundPhase === 'lost') {
          g.draw.text(ctx, 'DEREZZED', 400, 290, { size: 16, color: '#ff3355', align: 'center', glow: true });
        }
      }
    }
  });
})();
