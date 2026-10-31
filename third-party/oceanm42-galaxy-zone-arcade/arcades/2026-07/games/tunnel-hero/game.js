/*!
 * games/tunnel-hero/game.js
 * Tunnel Hero — inspired by Dig Dug (1982). A 20x14 underground of dirt in
 * four depth bands (deeper = darker + worth more) under a single sky row.
 * The player digs continuous tunnels — grid cells carve as you pass, with
 * movement slower through dirt than open tunnel — and pops POOKAs and
 * FYGARs with a three-press pump. Fygars telegraph then breathe a two-cell
 * flame; enemies occasionally turn ghost and drift straight through dirt at
 * you; rocks wobble and fall when undermined; two dropped rocks summon a
 * bonus vegetable; the last enemy makes a run for the sky.
 *
 * Grid actors are an integer cell plus a progress fraction t advanced at
 * tiles/sec * dt (drawn position = cell + dir*t), with direction decisions
 * made only when t crosses a whole cell. Ghosting/fleeing enemies leave the
 * grid entirely and drift on float coordinates until they re-materialize.
 */
(function () {
  'use strict';

  var COLS = 20, ROWS = 15, TILE = 40; // row 0 = sky, rows 1..14 underground
  var OX = 0, OY = 0;

  var UP = { dx: 0, dy: -1 };
  var DOWN = { dx: 0, dy: 1 };
  var LEFT = { dx: -1, dy: 0 };
  var RIGHT = { dx: 1, dy: 0 };
  var NONE = { dx: 0, dy: 0 };
  var DIRS = [UP, DOWN, LEFT, RIGHT];

  var PLAYER_SPEED_OPEN = 4.6;  // tiles/sec in open tunnel
  var PLAYER_SPEED_DIG = 2.9;   // tiles/sec while digging
  var ENEMY_BASE_SPEED = 2.35;
  var GHOST_SPEED = 1.75;
  var FLEE_SPEED = 1.7;
  var ROCK_FALL_SPEED = 9.0;    // tiles/sec
  var PUMP_RANGE = 1.9;         // tiles
  var INFLATE_HOLD = 1.15;      // sec per stage before deflating one step
  var READY_DURATION = 1.2;
  var DYING_DURATION = 1.2;
  var LEVEL_CLEAR_DURATION = 1.6;

  // Depth bands by row: rows 1-4, 5-8, 9-11, 12-14.
  var BAND_POINTS = [200, 300, 400, 500];
  var BAND_COLORS = ['#5a3210', '#48270b', '#371c07', '#271204'];
  var TUNNEL_COLOR = '#120b06';

  // Pre-carved pockets: [row, col0, col1, enemyType]. First N used per level.
  var POCKETS = [
    [3, 2, 4, 'pooka'],
    [5, 15, 17, 'fygar'],
    [10, 3, 5, 'pooka'],
    [12, 14, 16, 'fygar'],
    [8, 7, 9, 'pooka'],
    [13, 6, 8, 'fygar']
  ];
  var ROCK_SPOTS = [[4, 7], [8, 13], [11, 17]];
  var SHAFT_COL = 10, SHAFT_BOTTOM = 7;

  var VEG_COLORS = ['#ff8a00', '#ff3355', '#39ff6a', '#a94dff', '#ffe600'];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function bandOf(row) {
    if (row <= 4) return 0;
    if (row <= 8) return 1;
    if (row <= 11) return 2;
    return 3;
  }
  function cx(col) { return OX + col * TILE + TILE / 2; }
  function cy(row) { return OY + row * TILE + TILE / 2; }

  /** Interpolated position of a cell+progress actor, in tile units.
   *  Ghost/flee-mode enemies carry float row/col with t=0, so this is
   *  correct for every actor in every mode. */
  function posR(a) { return a.row + a.dir.dy * a.t; }
  function posC(a) { return a.col + a.dir.dx * a.t; }

  function inBounds(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < COLS; }

  function isDirt(S, row, col) {
    if (!inBounds(row, col) || row === 0) return false;
    return S.dirt[row][col];
  }

  function rockAt(S, row, col) {
    for (var i = 0; i < S.rocks.length; i++) {
      var rk = S.rocks[i];
      if (rk.state !== 'gone' && Math.round(rk.row) === row && Math.round(rk.col) === col) return rk;
    }
    return null;
  }

  /** A cell an actor may occupy (dirt is enterable — that's digging — rocks are not). */
  function walkable(S, row, col) {
    return inBounds(row, col) && !rockAt(S, row, col);
  }
  function openTunnel(S, row, col) {
    return walkable(S, row, col) && !isDirt(S, row, col);
  }

  function carve(g, row, col) {
    var S = g.state;
    if (isDirt(S, row, col)) {
      S.dirt[row][col] = false;
      g.addScore(5);
      S.digToggle = !S.digToggle;
      g.audio.play(S.digToggle ? 'move' : 'click');
    }
  }

  function buildLevel(g) {
    var S = g.state;
    S.dirt = [];
    var r, c;
    for (r = 0; r < ROWS; r++) {
      S.dirt.push([]);
      for (c = 0; c < COLS; c++) S.dirt[r].push(r >= 1);
    }
    // starting shaft + pockets
    for (r = 1; r <= SHAFT_BOTTOM; r++) S.dirt[r][SHAFT_COL] = false;
    var enemyCount = Math.min(POCKETS.length, 3 + S.levelNum);
    S.enemies = [];
    for (var i = 0; i < enemyCount; i++) {
      var p = POCKETS[i];
      for (c = p[1]; c <= p[2]; c++) S.dirt[p[0]][c] = false;
      var mid = Math.floor((p[1] + p[2]) / 2);
      S.enemies.push({
        type: p[3], row: p[0], col: mid, spawnRow: p[0], spawnCol: mid,
        dir: Math.random() < 0.5 ? LEFT : RIGHT, t: 0,
        mode: 'patrol', inflate: 0, inflateTimer: 0,
        ghostCooldown: 7 + Math.random() * 8, ghostDist: 0,
        flame: null, flameCooldown: 3 + Math.random() * 4,
        fleeing: false
      });
    }
    S.rocks = [];
    for (var k = 0; k < ROCK_SPOTS.length; k++) {
      S.rocks.push({ row: ROCK_SPOTS[k][0], col: ROCK_SPOTS[k][1], state: 'idle', timer: 0, startRow: ROCK_SPOTS[k][0] });
    }
    S.rocksDropped = 0;
    S.veg = null;
    S.levelTime = 0;
    resetPlayer(S);
    S.roundPhase = 'ready';
    S.readyTimer = READY_DURATION;
  }

  function resetPlayer(S) {
    S.player = { row: SHAFT_BOTTOM, col: SHAFT_COL, dir: NONE, queued: NONE, t: 0 };
    S.facing = RIGHT;
    S.pump = { target: null, flashTimer: 0, dir: RIGHT, len: 0 };
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      e.row = e.spawnRow; e.col = e.spawnCol; e.t = 0;
      e.mode = e.fleeing ? 'flee' : 'patrol';
      e.inflate = 0; e.flame = null;
      e.ghostCooldown = 7 + Math.random() * 8;
      e.flameCooldown = 3 + Math.random() * 4;
    }
  }

  function readDirInput(g) {
    if (g.input.isDown('up')) return UP;
    if (g.input.isDown('down')) return DOWN;
    if (g.input.isDown('left')) return LEFT;
    if (g.input.isDown('right')) return RIGHT;
    return null;
  }

  function updatePlayer(g, dt) {
    var S = g.state, P = S.player;
    var wanted = readDirInput(g);
    P.queued = wanted || NONE;
    var q = P.queued;
    var qActive = !!(q.dx || q.dy);

    if (P.t === 0) {
      // on a center: pick up the held direction, or stand still
      if (qActive) {
        S.facing = q;
        if (walkable(S, P.row + q.dy, P.col + q.dx)) P.dir = q;
        else { P.dir = NONE; return; }
      } else {
        P.dir = NONE;
        return;
      }
    } else if (qActive && q.dx === -P.dir.dx && q.dy === -P.dir.dy) {
      // instant mid-cell reversal
      P.col += P.dir.dx;
      P.row += P.dir.dy;
      P.dir = q;
      P.t = 1 - P.t;
      S.facing = q;
    }

    // digging is slower than running an open tunnel
    var speed = isDirt(S, P.row + P.dir.dy, P.col + P.dir.dx) ? PLAYER_SPEED_DIG : PLAYER_SPEED_OPEN;
    S.pump.target = null; // moving detaches the pump
    S.walkClock += speed * dt * 0.8;
    P.t += speed * dt;
    if (P.t >= 1) {
      P.t -= 1;
      P.col += P.dir.dx;
      P.row += P.dir.dy;
      carve(g, P.row, P.col);
      if (qActive && walkable(S, P.row + q.dy, P.col + q.dx)) {
        P.dir = q;
        S.facing = q;
      }
      if (!qActive || !walkable(S, P.row + P.dir.dy, P.col + P.dir.dx)) {
        P.t = 0; // stop flush on the center
        if (!qActive) P.dir = NONE;
      }
    }
  }

  function firePump(g) {
    var S = g.state, P = S.player;
    var f = S.facing;
    S.pump.dir = f;
    S.pump.flashTimer = 0.16;

    if (S.pump.target && S.pump.target.inflate > 0) {
      inflate(g, S.pump.target);
      return;
    }
    S.pump.target = null;
    // raycast: nearest enemy within PUMP_RANGE along facing, roughly on-axis
    var best = null, bestDist = Infinity;
    var prr = posR(P), pcc = posC(P);
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.mode === 'flee') continue;
      var dr = posR(e) - prr, dc = posC(e) - pcc;
      var along = dr * f.dy + dc * f.dx;
      var side = Math.abs(dr * f.dx + dc * f.dy);
      if (along > 0.2 && along <= PUMP_RANGE && side < 0.6 && along < bestDist) {
        best = e; bestDist = along;
      }
    }
    S.pump.len = best ? bestDist : PUMP_RANGE;
    if (best) {
      S.pump.target = best;
      inflate(g, best);
    } else {
      g.audio.play('shoot');
    }
  }

  function inflate(g, e) {
    var S = g.state;
    e.inflate++;
    e.inflateTimer = INFLATE_HOLD;
    e.flame = null;
    g.audio.play('hit');
    if (e.inflate >= 3) {
      var er = posR(e), ec = posC(e);
      var band = bandOf(Math.round(er));
      var pts = BAND_POINTS[band];
      var horizontal = S.facing.dx !== 0;
      if (e.type === 'fygar' && horizontal) pts *= 2;
      g.addScore(pts);
      g.fx.burst(cx(ec), cy(er), { color: e.type === 'pooka' ? '#ff3355' : '#39ff6a', count: 24, speed: 200, life: 0.6, size: 4 });
      g.fx.text(cx(ec), cy(er) - 10, '+' + pts, { color: '#ffe600', size: 12 });
      g.audio.play('bigExplode');
      removeEnemy(g, e);
    }
  }

  function removeEnemy(g, e) {
    var S = g.state;
    var i = S.enemies.indexOf(e);
    if (i >= 0) S.enemies.splice(i, 1);
    if (S.pump.target === e) S.pump.target = null;
    if (S.enemies.length === 0 && S.roundPhase === 'playing') onLevelClear(g);
    else if (S.enemies.length === 1) startFleeing(S.enemies[0]);
  }

  function startFleeing(e) {
    // leave the grid: carry float coordinates from the interpolated position
    var er = posR(e), ec = posC(e);
    e.row = er; e.col = ec; e.t = 0;
    e.fleeing = true;
    e.mode = 'flee';
    e.inflate = 0;
    e.flame = null;
  }

  function onLevelClear(g) {
    var S = g.state;
    S.roundPhase = 'levelClear';
    S.levelClearTimer = LEVEL_CLEAR_DURATION;
    g.audio.play('levelup');
    g.fx.flash('#ff8a00', 0.35);
  }

  function onPlayerKilled(g) {
    var S = g.state;
    if (S.roundPhase !== 'playing') return;
    S.roundPhase = 'dying';
    S.dyingTimer = DYING_DURATION;
    g.audio.play('die');
    g.fx.shake(9, 0.4);
    g.fx.burst(cx(posC(S.player)), cy(posR(S.player)), { color: '#ff8a00', count: 22, speed: 180, life: 0.6, size: 4 });
  }

  function pickPatrolDir(S, e) {
    var nr = e.row, nc = e.col; // only called on cell centers
    // prefer continuing straight through open tunnel
    if ((e.dir.dx || e.dir.dy) && openTunnel(S, nr + e.dir.dy, nc + e.dir.dx) && Math.random() < 0.75) return e.dir;
    var open = [];
    for (var i = 0; i < 4; i++) {
      var d = DIRS[i];
      if (e.dir.dx === -d.dx && e.dir.dy === -d.dy && (e.dir.dx || e.dir.dy)) continue;
      if (openTunnel(S, nr + d.dy, nc + d.dx)) open.push(d);
    }
    if (open.length === 0) {
      var rev = { dx: -e.dir.dx, dy: -e.dir.dy };
      if (openTunnel(S, nr + rev.dy, nc + rev.dx)) return rev;
      return NONE;
    }
    return open[Math.floor(Math.random() * open.length)];
  }

  function updateEnemy(g, e, dt) {
    var S = g.state, P = S.player;

    // inflated: frozen, deflating unless pumped again
    if (e.inflate > 0) {
      e.inflateTimer -= dt;
      if (e.inflateTimer <= 0) {
        e.inflate--;
        e.inflateTimer = 0.5;
      }
      return;
    }

    if (e.mode === 'flee') {
      if (e.row > 0.5) {
        e.row -= FLEE_SPEED * dt; // straight up through everything, ghost-style
      } else {
        e.row = 0;
        var edgeDir = e.col < COLS / 2 ? -1 : 1;
        e.col += edgeDir * FLEE_SPEED * 1.6 * dt;
        if (e.col < -0.6 || e.col > COLS - 0.4) {
          removeEnemy(g, e); // escaped, no points
          return;
        }
      }
      return;
    }

    if (e.mode === 'ghost') {
      var dr = posR(P) - e.row, dc = posC(P) - e.col;
      var len = Math.sqrt(dr * dr + dc * dc) || 1;
      e.row += (dr / len) * GHOST_SPEED * dt;
      e.col += (dc / len) * GHOST_SPEED * dt;
      e.ghostDist += GHOST_SPEED * dt;
      var gr = Math.round(e.row), gc = Math.round(e.col);
      if (e.ghostDist > 1.2 && openTunnel(S, gr, gc) &&
          Math.abs(e.row - gr) < 0.25 && Math.abs(e.col - gc) < 0.25) {
        e.row = gr; e.col = gc; e.t = 0;
        e.mode = 'patrol';
        e.dir = NONE;
        e.ghostCooldown = Math.max(3.5, 10 - S.levelTime * 0.12 - S.levelNum) + Math.random() * 5;
      }
      return;
    }

    // ---- patrol ----
    e.ghostCooldown -= dt;
    if (e.ghostCooldown <= 0) {
      // leave the grid: carry float coordinates from the interpolated position
      var fr0 = posR(e), fc0 = posC(e);
      e.row = fr0; e.col = fc0; e.t = 0;
      e.mode = 'ghost';
      e.ghostDist = 0;
      return;
    }

    // fygar flame
    if (e.type === 'fygar') {
      if (e.flame) {
        e.flame.timer -= dt;
        if (e.flame.phase === 'telegraph' && e.flame.timer <= 0) {
          e.flame.phase = 'burn';
          e.flame.timer = 0.55;
          g.audio.play('laser');
        } else if (e.flame.phase === 'burn' && e.flame.timer <= 0) {
          e.flame = null;
          e.flameCooldown = 3.5 + Math.random() * 4;
        }
        if (e.flame && e.flame.phase === 'burn') {
          // flame occupies up to 2 open cells in the stored direction
          var fr = Math.round(posR(e)), fc = Math.round(posC(e));
          for (var fi = 1; fi <= 2; fi++) {
            var fcc = fc + e.flame.dx * fi;
            if (!openTunnel(S, fr, fcc)) break;
            if (Math.abs(posR(P) - fr) < 0.55 && Math.abs(posC(P) - fcc) < 0.55) {
              onPlayerKilled(g);
              return;
            }
          }
        }
        return; // frozen while telegraphing/burning
      }
      e.flameCooldown -= dt;
      if (e.flameCooldown <= 0 && Math.abs(posR(P) - posR(e)) < 0.6 && Math.abs(posC(P) - posC(e)) < 5) {
        e.flame = { phase: 'telegraph', timer: 0.75, dx: posC(P) > posC(e) ? 1 : -1 };
        g.audio.play('warp');
        return;
      }
    }

    var speed = ENEMY_BASE_SPEED + (S.levelNum - 1) * 0.15;
    if (speed > 3.6) speed = 3.6;
    if (e.t === 0) {
      e.dir = pickPatrolDir(S, e);
      if (!(e.dir.dx || e.dir.dy)) return; // walled in: wait for a tunnel
    }
    e.t += speed * dt;
    if (e.t >= 1) {
      e.t -= 1;
      e.col += e.dir.dx;
      e.row += e.dir.dy;
      e.dir = pickPatrolDir(S, e);
      if (!(e.dir.dx || e.dir.dy)) e.t = 0;
    }
  }

  function updateRocks(g, dt) {
    var S = g.state;
    for (var i = 0; i < S.rocks.length; i++) {
      var rk = S.rocks[i];
      if (rk.state === 'gone') continue;
      var rr = Math.round(rk.row), rc = Math.round(rk.col);
      if (rk.state === 'idle') {
        var below = rr + 1;
        var playerUnder = Math.round(posR(S.player)) === below && Math.round(posC(S.player)) === rc;
        if (below < ROWS && !isDirt(S, below, rc) && !playerUnder) {
          rk.state = 'wobble';
          rk.timer = 0.85;
          g.audio.play('bounce');
        }
      } else if (rk.state === 'wobble') {
        rk.timer -= dt;
        if (rk.timer <= 0) { rk.state = 'fall'; rk.startRow = rk.row; }
      } else if (rk.state === 'fall') {
        rk.row += ROCK_FALL_SPEED * dt;
        // crush checks
        for (var j = S.enemies.length - 1; j >= 0; j--) {
          var e = S.enemies[j];
          var er = posR(e), ec = posC(e);
          if (Math.abs(er - rk.row) < 0.6 && Math.abs(ec - rk.col) < 0.6) {
            g.addScore(1000);
            g.fx.burst(cx(ec), cy(er), { color: '#ffe600', count: 26, speed: 220, life: 0.6, size: 4 });
            g.fx.text(cx(ec), cy(er) - 10, '+1000 CRUSHED', { color: '#ffe600', size: 11 });
            g.audio.play('bigExplode');
            removeEnemy(g, S.enemies[j]);
          }
        }
        if (Math.abs(posR(S.player) - rk.row) < 0.6 && Math.abs(posC(S.player) - rk.col) < 0.6) {
          onPlayerKilled(g);
        }
        // landing: next cell down is dirt, another rock, or the floor
        var nextR = Math.floor(rk.row + 0.5) + 1;
        var blocked = nextR >= ROWS || isDirt(S, nextR, rc) ||
          (function () {
            for (var k = 0; k < S.rocks.length; k++) {
              var o = S.rocks[k];
              if (o !== rk && o.state !== 'gone' && o.state !== 'fall' &&
                  Math.round(o.col) === rc && Math.round(o.row) === nextR) return true;
            }
            return false;
          })();
        if (blocked && rk.row - rk.startRow > 0.4) {
          // a falling rock always shatters when it stops
          rk.state = 'gone';
          rk.row = nextR - 1;
          g.fx.burst(cx(rk.col), cy(rk.row), { color: '#b0906a', count: 18, speed: 160, life: 0.5, size: 3 });
          g.fx.shake(4, 0.2);
          g.audio.play('explode');
          S.rocksDropped++;
          if (S.rocksDropped === 2 && !S.veg) spawnVeg(g);
        }
      }
    }
  }

  function spawnVeg(g) {
    var S = g.state;
    var pts = Math.min(4000, 400 * S.levelNum);
    carve(g, SHAFT_BOTTOM, SHAFT_COL);
    S.veg = {
      row: SHAFT_BOTTOM, col: SHAFT_COL, points: pts, timer: 10,
      color: VEG_COLORS[(S.levelNum - 1) % VEG_COLORS.length]
    };
    g.fx.text(cx(SHAFT_COL), cy(SHAFT_BOTTOM) - 12, 'BONUS!', { color: '#ffe600', size: 10 });
  }

  function checkCollisions(g) {
    var S = g.state, P = S.player;
    var pr = posR(P), pc = posC(P);
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.inflate > 0) continue; // walk right past inflated enemies
      if (Math.abs(posR(e) - pr) < 0.55 && Math.abs(posC(e) - pc) < 0.55) {
        onPlayerKilled(g);
        return;
      }
    }
    if (S.veg && Math.abs(S.veg.row - pr) < 0.6 && Math.abs(S.veg.col - pc) < 0.6) {
      g.addScore(S.veg.points);
      g.fx.text(cx(S.veg.col), cy(S.veg.row) - 10, '+' + S.veg.points, { color: S.veg.color, size: 12 });
      g.fx.burst(cx(S.veg.col), cy(S.veg.row), { color: S.veg.color, count: 16, speed: 160, life: 0.5, size: 3 });
      g.audio.play('pickup');
      S.veg = null;
    }
  }

  // ---------------------------------------------------------------- render

  function drawWorld(ctx, S, g) {
    // sky row
    ctx.fillStyle = '#0d1030';
    ctx.fillRect(OX, OY, COLS * TILE, TILE);
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(OX + 3 * TILE, OY + 12, 2, 2);
    ctx.fillRect(OX + 8 * TILE + 20, OY + 22, 2, 2);
    ctx.fillRect(OX + 15 * TILE + 10, OY + 8, 2, 2);
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(OX + 17.5 * TILE, OY + 16, 8, 0, Math.PI * 2);
    ctx.fill();

    // underground: tunnel base, then dirt bands on top
    ctx.fillStyle = TUNNEL_COLOR;
    ctx.fillRect(OX, OY + TILE, COLS * TILE, (ROWS - 1) * TILE);
    for (var r = 1; r < ROWS; r++) {
      var band = bandOf(r);
      for (var c = 0; c < COLS; c++) {
        if (!S.dirt[r][c]) continue;
        var x = OX + c * TILE, y = OY + r * TILE;
        ctx.fillStyle = BAND_COLORS[band];
        ctx.fillRect(x, y, TILE, TILE);
        // speckle texture, deterministic per cell
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        var h = (r * 31 + c * 17) % 23;
        ctx.fillRect(x + 5 + (h % 12), y + 8 + (h % 9), 3, 3);
        ctx.fillRect(x + 22 + (h % 7), y + 24 + (h % 6), 3, 3);
      }
    }

    // smooth dig notch: soften the dirt right around the player (not in the sky)
    var P = S.player;
    var prr = posR(P), pcc = posC(P);
    if (prr > 0.55) {
      ctx.fillStyle = TUNNEL_COLOR;
      ctx.beginPath();
      ctx.arc(cx(pcc), cy(prr), TILE * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRocks(ctx, S) {
    for (var i = 0; i < S.rocks.length; i++) {
      var rk = S.rocks[i];
      if (rk.state === 'gone') continue;
      var x = cx(rk.col), y = cy(rk.row);
      if (rk.state === 'wobble') x += Math.sin(rk.timer * 40) * 2.5;
      ctx.fillStyle = '#8a6a48';
      ctx.beginPath();
      ctx.arc(x, y + 2, TILE * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b0906a';
      ctx.beginPath();
      ctx.arc(x - 4, y - 3, TILE * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVeg(ctx, S, g) {
    var v = S.veg;
    if (!v) return;
    var x = cx(v.col), y = cy(v.row);
    g.draw.glow(ctx, v.color, 10, function () {
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x - 9, y - 6);
      ctx.lineTo(x + 9, y - 6);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#39ff6a';
    ctx.fillRect(x - 2, y - 13, 4, 8);
  }

  function drawEnemy(ctx, e, S, g) {
    var x = cx(posC(e)), y = cy(posR(e));
    var scale = 1 + e.inflate * 0.32;
    var r = TILE * 0.34 * scale;
    var ghosting = e.mode === 'ghost' || e.mode === 'flee';
    ctx.save();
    if (ghosting) ctx.globalAlpha = 0.45;

    if (e.type === 'pooka') {
      g.draw.glow(ctx, '#ff3355', ghosting ? 0 : 7, function () {
        ctx.fillStyle = '#ff3355';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      // goggles
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.4, y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.4, y - r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
    } else {
      // fygar: green dragon
      var facing = e.dir.dx >= 0 ? 1 : -1;
      if (e.flame) facing = e.flame.dx;
      g.draw.glow(ctx, '#39ff6a', ghosting ? 0 : 7, function () {
        ctx.fillStyle = '#39ff6a';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        // snout
        ctx.fillRect(x + facing * r * 0.5, y - r * 0.25, facing * r * 0.7, r * 0.5);
      });
      // crest spikes
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r);
      ctx.lineTo(x, y - r * 1.45);
      ctx.lineTo(x + r * 0.3, y - r);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath(); ctx.arc(x + facing * r * 0.3, y - r * 0.25, r * 0.16, 0, Math.PI * 2); ctx.fill();
      // telegraph flash
      if (e.flame && e.flame.phase === 'telegraph' && Math.floor(e.flame.timer * 10) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 138, 0, 0.6)';
        ctx.beginPath(); ctx.arc(x + facing * r, y, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // flame breath
      if (e.flame && e.flame.phase === 'burn') {
        var fr = Math.round(posR(e)), fc = Math.round(posC(e));
        for (var fi = 1; fi <= 2; fi++) {
          var fcc = fc + e.flame.dx * fi;
          if (!openTunnel(S, fr, fcc)) break;
          var fx0 = cx(fcc), fy0 = cy(fr);
          var flick = 0.75 + Math.abs(Math.sin(S.walkClock * 9 + fi)) * 0.25;
          g.draw.glow(ctx, '#ff8a00', 12, function () {
            ctx.fillStyle = fi === 1 ? '#ff8a00' : '#ff3355';
            ctx.beginPath();
            ctx.arc(fx0, fy0, TILE * 0.32 * flick, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    }
    ctx.restore();
  }

  function drawPump(ctx, S, g) {
    var pump = S.pump;
    var P = S.player;
    var attached = pump.target && pump.target.inflate > 0;
    if (pump.flashTimer <= 0 && !attached) return;
    var x0 = cx(posC(P)), y0 = cy(posR(P));
    var x1, y1;
    if (attached) {
      x1 = cx(posC(pump.target)); y1 = cy(posR(pump.target));
    } else {
      x1 = x0 + pump.dir.dx * pump.len * TILE;
      y1 = y0 + pump.dir.dy * pump.len * TILE;
    }
    g.draw.glow(ctx, '#eaf6ff', 6, function () {
      ctx.strokeStyle = '#eaf6ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer(ctx, S, g) {
    var P = S.player;
    var x = cx(posC(P)), y = cy(posR(P));
    var moving = !!(P.dir.dx || P.dir.dy);
    var bob = moving ? Math.sin(S.walkClock * 8) * 2 : 0;
    var facing = S.facing.dx !== 0 ? S.facing.dx : 1;
    if (S.roundPhase === 'dying') {
      var t = clamp(S.dyingTimer / DYING_DURATION, 0, 1);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = '#ff8a00';
      ctx.beginPath();
      ctx.arc(x, y, TILE * 0.32 * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    g.draw.glow(ctx, '#ff8a00', 9, function () {
      // body
      ctx.fillStyle = '#ff8a00';
      ctx.fillRect(x - 9, y - 4 + bob, 18, 16);
      // helmet
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath();
      ctx.arc(x, y - 8 + bob, 9, Math.PI, 0);
      ctx.fill();
    });
    // visor faces movement direction
    ctx.fillStyle = '#00f0ff';
    if (S.facing.dy === 0) ctx.fillRect(x + facing * 2, y - 11 + bob, 6 * facing, 5);
    else ctx.fillRect(x - 3, y - 11 + bob, 6, 5);
    // legs
    ctx.fillStyle = '#c76a00';
    var step = moving ? Math.sin(S.walkClock * 8) * 3 : 0;
    ctx.fillRect(x - 7, y + 12 + bob, 5, 6 + step);
    ctx.fillRect(x + 2, y + 12 + bob, 5, 6 - step);
  }

  GZ.boot({
    slug: 'tunnel-hero',
    touchLayout: 'dpad-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['Arrows / WASD', 'Dig & move'], ['A (tap repeatedly)', 'Pump — 3 pumps pops']],
    state: {},

    init: function (g) {
      var S = g.state;
      g.setLives(3);
      g.setLevel(1);
      S.levelNum = 1;
      S.walkClock = 0;
      S.digToggle = false;
      buildLevel(g);
    },

    update: function (g, dt) {
      var S = g.state;
      S.walkClock += dt;

      if (S.roundPhase === 'ready') {
        S.readyTimer -= dt;
        if (S.readyTimer <= 0) S.roundPhase = 'playing';
        return;
      }
      if (S.roundPhase === 'dying') {
        S.dyingTimer -= dt;
        if (S.dyingTimer <= 0) {
          var lives = g.lives - 1;
          g.setLives(lives);
          if (lives <= 0) { g.gameOver(); return; }
          resetPlayer(S);
          S.roundPhase = 'ready';
          S.readyTimer = READY_DURATION;
        }
        return;
      }
      if (S.roundPhase === 'levelClear') {
        S.levelClearTimer -= dt;
        if (S.levelClearTimer <= 0) {
          S.levelNum++;
          g.setLevel(S.levelNum);
          buildLevel(g);
        }
        return;
      }

      S.levelTime += dt;
      if (S.pump.flashTimer > 0) S.pump.flashTimer -= dt;
      if (g.input.pressed('a')) firePump(g);

      updatePlayer(g, dt);
      if (S.roundPhase !== 'playing') return;
      for (var i = S.enemies.length - 1; i >= 0; i--) {
        updateEnemy(g, S.enemies[i], dt);
        if (S.roundPhase !== 'playing') return;
      }
      updateRocks(g, dt);
      if (S.roundPhase !== 'playing') return;
      if (S.veg) {
        S.veg.timer -= dt;
        if (S.veg.timer <= 0) S.veg = null;
      }
      checkCollisions(g);
    },

    render: function (g, ctx) {
      var S = g.state;
      drawWorld(ctx, S, g);
      drawRocks(ctx, S);
      drawVeg(ctx, S, g);
      for (var i = 0; i < S.enemies.length; i++) drawEnemy(ctx, S.enemies[i], S, g);
      drawPump(ctx, S, g);
      drawPlayer(ctx, S, g);
      if (S.roundPhase === 'ready' && g.phase === 'playing') {
        g.draw.text(ctx, 'READY!', 400, 300, { size: 14, color: '#ff8a00', align: 'center', glow: true });
      }
    }
  });
})();
