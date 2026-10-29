/*!
 * games/cube-hopper/game.js
 * Cube Hopper — inspired by Q*bert (1982).
 *
 * A 28-cube isometric pyramid floating over a starfield. Every control hops
 * diagonally (up = up-right, left = up-left, right = down-right, down =
 * down-left). Hop every cube to its target color; from level 3 on, hopping a
 * finished cube reverts it. Red balls and Coily (who hatches from a purple
 * ball) chase you down; a green ball freezes everything if you catch it.
 * Hop off the pyramid's edge onto a floating disc to ride to the top —
 * and drag a chasing Coily to his doom.
 */
(function () {
  'use strict';

  var ROWS_N = 7;
  var CENTER_X = 400, TOP_Y = 118;
  var STEP_X = 24, STEP_Y = 32; // per-row iso deltas
  var CUBE_W = 46, CUBE_TOPH = 24, CUBE_SIDEH = 26;
  var PLAYER_HOP_TIME = 0.22;

  var DELTA = {
    up: { dx: STEP_X, dy: -STEP_Y, dr: -1, dc: 0 },
    left: { dx: -STEP_X, dy: -STEP_Y, dr: -1, dc: -1 },
    right: { dx: STEP_X, dy: STEP_Y, dr: 1, dc: 1 },
    down: { dx: -STEP_X, dy: STEP_Y, dr: 1, dc: 0 }
  };

  var DISC_DEFS = [
    { row: 3, col: 0, dir: 'left' },
    { row: 5, col: 5, dir: 'up' }
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function inPyramid(row, col) { return row >= 0 && row < ROWS_N && col >= 0 && col <= row; }

  function cubeCenter(row, col) {
    return { x: CENTER_X - row * STEP_X + col * (STEP_X * 2), y: TOP_Y + row * STEP_Y };
  }

  function validDiagonals(row, col) {
    var out = [];
    if (inPyramid(row - 1, col)) out.push({ row: row - 1, col: col });
    if (inPyramid(row - 1, col - 1)) out.push({ row: row - 1, col: col - 1 });
    if (inPyramid(row + 1, col + 1)) out.push({ row: row + 1, col: col + 1 });
    if (inPyramid(row + 1, col)) out.push({ row: row + 1, col: col });
    return out;
  }

  function downOnly(row, col) {
    var out = [];
    if (inPyramid(row + 1, col)) out.push({ row: row + 1, col: col });
    if (inPyramid(row + 1, col + 1)) out.push({ row: row + 1, col: col + 1 });
    return out;
  }

  // ---- level setup --------------------------------------------------------
  function maxStage(level) { return level <= 1 ? 1 : 2; }

  function initLevel(g) {
    var S = g.state, lvl = g.level;
    S.pyramid = [];
    for (var r = 0; r < ROWS_N; r++) {
      S.pyramid[r] = [];
      for (var c = 0; c <= r; c++) S.pyramid[r][c] = { stage: 0 };
    }
    S.completedCount = 0;
    S.discs = DISC_DEFS.map(function (d) { return { row: d.row, col: d.col, dir: d.dir, used: false }; });
    S.enemies = { red: [], purple: [], coily: null, green: null };
    S.redSpawnTimer = 1.5;
    S.purpleSpawnTimer = 6 + Math.random() * 3;
    S.greenSpawnTimer = 9 + Math.random() * 6;
    S.freezeTimer = 0;
    S.cascadeActive = false;
    S.cascadeTimer = 0;
    S.enemyHopDur = Math.max(0.24, 0.42 - (lvl - 1) * 0.03);
    S.spawnInterval = Math.max(1.1, 3.0 - (lvl - 1) * 0.25);
  }

  function respawnPlayer(g) {
    var S = g.state;
    S.player.row = 0; S.player.col = 0;
    S.player.hopping = false; S.player.mode = 'ground'; S.player.bufferedDir = null;
  }

  function killPlayer(g) {
    var S = g.state, P = S.player;
    g.audio.play('die');
    g.fx.shake(9, 0.35);
    var pos = cubeCenter(P.row, P.col);
    g.fx.text(pos.x, pos.y - 46, '@!#?@!', { color: '#ffe600', size: 11 });
    g.fx.burst(pos.x, pos.y - 14, { color: '#ff3355', count: 16, speed: 160 });
    S.enemies = { red: [], purple: [], coily: null, green: null };
    S.redSpawnTimer = 1.4;
    S.purpleSpawnTimer = 6 + Math.random() * 3;
    S.greenSpawnTimer = 9 + Math.random() * 6;
    g.setLives(g.lives - 1);
    if (g.lives <= 0) { g.gameOver(); return; }
    respawnPlayer(g);
  }

  // ---- cube stage changes ---------------------------------------------------
  function hopOnCube(g, row, col) {
    var S = g.state;
    var cube = S.pyramid[row][col];
    var ms = maxStage(g.level);
    var pos = cubeCenter(row, col);
    if (cube.stage < ms) {
      cube.stage++;
      g.addScore(25);
      g.fx.text(pos.x, pos.y - 10, '+25', { color: '#a94dff', size: 8 });
      if (cube.stage === ms) S.completedCount++;
    } else if (g.level >= 3) {
      cube.stage = 0;
      S.completedCount--;
      g.audio.play('hit');
    }
    if (S.completedCount >= 28) startCascade(g);
  }

  function startCascade(g) {
    var S = g.state;
    S.cascadeActive = true;
    S.cascadeTimer = 0;
    S.cascadeOrder = [];
    for (var r = 0; r < ROWS_N; r++) for (var c = 0; c <= r; c++) S.cascadeOrder.push({ row: r, col: c, delay: (r + c) * 0.05 });
    g.audio.play('levelup');
    g.fx.flash('#eaf6ff', 0.2);
  }

  function updateCascade(g, dt) {
    var S = g.state;
    S.cascadeTimer += dt;
    if (S.cascadeTimer > 1.6) {
      g.addScore(1000 + 250 * g.level);
      g.fx.burst(400, 300, { color: '#ffe600', count: 40, speed: 240, life: 1 });
      g.setLevel(g.level + 1);
      initLevel(g);
      respawnPlayer(g);
    }
  }

  // ---- player hop -----------------------------------------------------------
  var DIR_KEYS = ['up', 'left', 'right', 'down'];

  function requestHop(g, dirName) {
    var S = g.state, P = S.player;
    var d = DELTA[dirName];
    var tr = P.row + d.dr, tc = P.col + d.dc;
    if (inPyramid(tr, tc)) {
      P.hopping = true; P.hopT = 0;
      P.fromRow = P.row; P.fromCol = P.col; P.toRow = tr; P.toCol = tc;
      var freq = 220 + (6 - tr) * 55;
      g.audio.tone({ freq: freq, endFreq: freq + 60, dur: 0.09, type: 'square', vol: 0.22 });
      return;
    }
    // off the edge — check for a disc
    for (var i = 0; i < S.discs.length; i++) {
      var disc = S.discs[i];
      if (!disc.used && disc.row === P.row && disc.col === P.col && disc.dir === dirName) {
        disc.used = true;
        P.mode = 'disc'; P.discT = 0;
        P.fromRow = P.row; P.fromCol = P.col;
        g.audio.play('warp');
        return;
      }
    }
    P.mode = 'falling';
    P.fallTimer = 0;
    P.fallFromRow = P.row; P.fallFromCol = P.col;
    g.audio.play('move');
  }

  function updatePlayer(g, dt) {
    var S = g.state, P = S.player, input = g.input;

    if (P.mode === 'falling') {
      P.fallTimer += dt;
      if (P.fallTimer >= 0.55) killPlayer(g);
      return;
    }
    if (P.mode === 'disc') {
      P.discT += dt / 0.65;
      if (P.discT >= 1) {
        P.mode = 'ground'; P.row = 0; P.col = 0; P.hopping = false;
        if (S.enemies.coily) {
          S.enemies.coily = null;
          g.addScore(500);
          g.audio.play('explode');
          g.fx.burst(400, 560, { color: '#ff2ec4', count: 30, speed: 220, life: 0.9 });
          g.fx.text(400, 540, 'COILY +500', { color: '#ff2ec4', size: 10, align: 'center' });
        }
      }
      return;
    }

    var pressedDir = null;
    for (var i = 0; i < DIR_KEYS.length; i++) if (input.pressed(DIR_KEYS[i])) { pressedDir = DIR_KEYS[i]; break; }

    if (P.hopping) {
      if (pressedDir) P.bufferedDir = pressedDir;
      P.hopT += dt / PLAYER_HOP_TIME;
      if (P.hopT >= 1) {
        P.hopping = false;
        P.row = P.toRow; P.col = P.toCol;
        hopOnCube(g, P.row, P.col);
      }
    } else {
      var toFire = P.bufferedDir || pressedDir;
      if (toFire) { P.bufferedDir = null; requestHop(g, toFire); }
    }
  }

  // ---- enemies --------------------------------------------------------------
  function stepBounce(entity, dt, hopDur, pickFn) {
    if (entity.hopping) {
      entity.t += dt / hopDur;
      if (entity.t >= 1) {
        entity.row = entity.toRow; entity.col = entity.toCol; entity.hopping = false;
        entity.hopsDone = (entity.hopsDone || 0) + 1;
      }
    }
    if (!entity.hopping) {
      var target = pickFn(entity);
      if (!target) { entity.dead = true; return; }
      entity.hopping = true; entity.t = 0;
      entity.fromRow = entity.row; entity.fromCol = entity.col;
      entity.toRow = target.row; entity.toCol = target.col;
    }
  }

  function updateEnemies(g, dt) {
    var S = g.state, P = S.player;

    S.redSpawnTimer -= dt;
    if (S.redSpawnTimer <= 0 && S.enemies.red.length < 2 + Math.floor(g.level / 2)) {
      S.enemies.red.push({ row: 0, col: 0, hopping: false, t: 0 });
      S.redSpawnTimer = S.spawnInterval;
    }
    S.purpleSpawnTimer -= dt;
    if (S.purpleSpawnTimer <= 0 && !S.enemies.coily && S.enemies.purple.length === 0) {
      S.enemies.purple.push({ row: 0, col: 0, hopping: false, t: 0, hopsDone: 0 });
      S.purpleSpawnTimer = 8 + Math.random() * 4;
    }
    S.greenSpawnTimer -= dt;
    if (S.greenSpawnTimer <= 0 && !S.enemies.green) {
      S.enemies.green = { row: 0, col: 0, hopping: false, t: 0 };
      S.greenSpawnTimer = 13 + Math.random() * 7;
    }

    if (S.freezeTimer > 0) { S.freezeTimer -= dt; return; }

    var i;
    for (i = S.enemies.red.length - 1; i >= 0; i--) {
      var rb = S.enemies.red[i];
      stepBounce(rb, dt, S.enemyHopDur, function (e) { return downOnly(e.row, e.col).length ? downOnly(e.row, e.col)[Math.floor(Math.random() * downOnly(e.row, e.col).length)] : null; });
      if (rb.dead) S.enemies.red.splice(i, 1);
    }
    for (i = S.enemies.purple.length - 1; i >= 0; i--) {
      var pb = S.enemies.purple[i];
      stepBounce(pb, dt, S.enemyHopDur, function (e) { return downOnly(e.row, e.col).length ? downOnly(e.row, e.col)[Math.floor(Math.random() * downOnly(e.row, e.col).length)] : null; });
      if (pb.dead) { S.enemies.purple.splice(i, 1); continue; }
      if (!pb.hopping && !S.enemies.coily && (pb.hopsDone >= 4 || pb.row >= 4)) {
        S.enemies.coily = { row: pb.row, col: pb.col, hopping: false, t: 0, state: 'chasing' };
        S.enemies.purple.splice(i, 1);
        g.audio.play('warp');
      }
    }
    if (S.enemies.green) {
      stepBounce(S.enemies.green, dt, S.enemyHopDur, function (e) { return downOnly(e.row, e.col).length ? downOnly(e.row, e.col)[Math.floor(Math.random() * downOnly(e.row, e.col).length)] : null; });
      if (S.enemies.green.dead) S.enemies.green = null;
    }
    if (S.enemies.coily) {
      var coily = S.enemies.coily;
      stepBounce(coily, dt, PLAYER_HOP_TIME, function (e) {
        var opts = validDiagonals(e.row, e.col);
        var best = null, bestD = Infinity;
        for (var k = 0; k < opts.length; k++) {
          var o = opts[k];
          var d = Math.abs(o.row - P.row) + Math.abs(o.col - P.col);
          if (d < bestD) { bestD = d; best = o; }
        }
        return best;
      });
    }
  }

  function checkCollisions(g) {
    var S = g.state, P = S.player;
    if (P.mode !== 'ground' || P.hopping) return;
    var i;
    for (i = 0; i < S.enemies.red.length; i++) if (S.enemies.red[i].row === P.row && S.enemies.red[i].col === P.col) { killPlayer(g); return; }
    for (i = 0; i < S.enemies.purple.length; i++) if (S.enemies.purple[i].row === P.row && S.enemies.purple[i].col === P.col) { killPlayer(g); return; }
    if (S.enemies.coily && S.enemies.coily.row === P.row && S.enemies.coily.col === P.col) { killPlayer(g); return; }
    if (S.enemies.green && S.enemies.green.row === P.row && S.enemies.green.col === P.col) {
      S.freezeTimer = 3;
      g.addScore(100);
      g.audio.play('powerup');
      g.fx.flash('#00f0ff', 0.22);
      var pos = cubeCenter(P.row, P.col);
      g.fx.burst(pos.x, pos.y, { color: '#39ff6a', count: 18, speed: 170 });
      S.enemies.green = null;
    }
  }

  function checkExtraLife(g) {
    var S = g.state;
    if (!S.extraLifeAwarded && g.score >= 8000) {
      S.extraLifeAwarded = true;
      g.setLives(g.lives + 1);
      g.audio.play('powerup');
      g.fx.flash('#ffe600', 0.2);
    }
  }

  // ---- render ---------------------------------------------------------------
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var gc = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + gc + ',' + b + ')';
  }

  function stageColor(stage, ms) {
    if (stage === 0) return '#242440';
    if (stage === ms) return '#a94dff';
    return '#00f0ff';
  }

  function drawCube(ctx, x, y, color, glowIt, g) {
    var top = { x: x, y: y - CUBE_TOPH / 2 };
    var right = { x: x + CUBE_W / 2, y: y };
    var bot = { x: x, y: y + CUBE_TOPH / 2 };
    var left = { x: x - CUBE_W / 2, y: y };

    function faces() {
      ctx.fillStyle = shade(color, -70);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y); ctx.lineTo(bot.x, bot.y);
      ctx.lineTo(bot.x, bot.y + CUBE_SIDEH); ctx.lineTo(left.x, left.y + CUBE_SIDEH);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = shade(color, -110);
      ctx.beginPath();
      ctx.moveTo(right.x, right.y); ctx.lineTo(bot.x, bot.y);
      ctx.lineTo(bot.x, bot.y + CUBE_SIDEH); ctx.lineTo(right.x, right.y + CUBE_SIDEH);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
      ctx.lineTo(bot.x, bot.y); ctx.lineTo(left.x, left.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(234,246,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (glowIt) g.draw.glow(ctx, color, 14, faces); else faces();
  }

  function drawStars(g, ctx) {
    var S = g.state;
    for (var i = 0; i < S.stars.length; i++) {
      var st = S.stars[i];
      var a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(g.time * 1.5 + st.o));
      ctx.fillStyle = 'rgba(234,246,255,' + a + ')';
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
  }

  function playerScreenPos(g) {
    var S = g.state, P = S.player;
    if (P.mode === 'falling') {
      var fp = cubeCenter(P.fallFromRow, P.fallFromCol);
      return { x: fp.x, y: fp.y - 18 + P.fallTimer * 260, alpha: clamp(1 - P.fallTimer / 0.55, 0, 1) };
    }
    if (P.mode === 'disc') {
      var from = cubeCenter(P.fromRow, P.fromCol);
      var to = cubeCenter(0, 0);
      var midX = (from.x + to.x) / 2, midY = Math.min(from.y, to.y) - 70;
      var t = P.discT;
      var x = lerp(lerp(from.x, midX, t), lerp(midX, to.x, t), t);
      var y = lerp(lerp(from.y, midY, t), lerp(midY, to.y, t), t);
      return { x: x, y: y - 18, alpha: 1 };
    }
    var cx, cy;
    if (P.hopping) {
      var fromC = cubeCenter(P.fromRow, P.fromCol), toC = cubeCenter(P.toRow, P.toCol);
      cx = lerp(fromC.x, toC.x, P.hopT);
      cy = lerp(fromC.y, toC.y, P.hopT) - Math.sin(P.hopT * Math.PI) * 22;
    } else {
      var c = cubeCenter(P.row, P.col);
      cx = c.x; cy = c.y;
    }
    return { x: cx, y: cy - 18, alpha: 1 };
  }

  function entityScreenPos(e) {
    if (e.hopping) {
      var f = cubeCenter(e.fromRow, e.fromCol), t = cubeCenter(e.toRow, e.toCol);
      return { x: lerp(f.x, t.x, e.t), y: lerp(f.y, t.y, e.t) - Math.sin(e.t * Math.PI) * 16 - 14 };
    }
    var c = cubeCenter(e.row, e.col);
    return { x: c.x, y: c.y - 14 };
  }

  GZ.boot({
    slug: 'cube-hopper',
    touchLayout: 'dpad-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['UP', 'Hop up-right'], ['LEFT', 'Hop up-left'], ['RIGHT', 'Hop down-right'], ['DOWN', 'Hop down-left']],
    state: {},

    init: function (g) {
      g.setLives(3);
      g.setLevel(1);
      var S = g.state;
      S.extraLifeAwarded = false;
      S.stars = [];
      for (var i = 0; i < 70; i++) S.stars.push({ x: Math.random() * 800, y: Math.random() * 600, s: Math.random() < 0.7 ? 1 : 2, o: Math.random() * 10 });
      initLevel(g);
      S.player = { row: 0, col: 0, hopping: false, hopT: 0, mode: 'ground', bufferedDir: null };
    },

    update: function (g, dt) {
      var S = g.state;
      if (S.cascadeActive) { updateCascade(g, dt); return; }
      updatePlayer(g, dt);
      updateEnemies(g, dt);
      checkCollisions(g);
      checkExtraLife(g);
    },

    render: function (g, ctx) {
      var S = g.state;
      drawStars(g, ctx);

      var ms = maxStage(g.level);
      for (var r = 0; r < ROWS_N; r++) {
        for (var c = 0; c <= r; c++) {
          var cube = S.pyramid[r][c];
          var pos = cubeCenter(r, c);
          var color = stageColor(cube.stage, ms);
          var glowIt = cube.stage === ms;
          if (S.cascadeActive) {
            var entry = null;
            for (var k = 0; k < S.cascadeOrder.length; k++) { var o = S.cascadeOrder[k]; if (o.row === r && o.col === c) { entry = o; break; } }
            if (entry && S.cascadeTimer >= entry.delay) {
              var hueT = (S.cascadeTimer - entry.delay) * 4;
              color = ['#ff3355', '#ffe600', '#39ff6a', '#00f0ff', '#a94dff'][Math.floor(hueT) % 5];
              glowIt = true;
            }
          }
          drawCube(ctx, pos.x, pos.y, color, glowIt, g);
        }
      }

      // discs
      for (var d = 0; d < S.discs.length; d++) {
        var disc = S.discs[d];
        if (disc.used) continue;
        var dc = cubeCenter(disc.row, disc.col);
        var delta = DELTA[disc.dir];
        var dx = dc.x + delta.dx * 1.5, dy = dc.y + delta.dy * 1.5;
        g.draw.glow(ctx, '#eaf6ff', 12, function (px, py) {
          return function () {
            ctx.fillStyle = 'rgba(234,246,255,0.85)';
            ctx.beginPath(); ctx.ellipse(px, py, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
          };
        }(dx, dy));
      }

      // enemies
      var i, p;
      for (i = 0; i < S.enemies.red.length; i++) {
        p = entityScreenPos(S.enemies.red[i]);
        g.draw.glow(ctx, '#ff3355', 10, function (px, py) { return function () { ctx.fillStyle = '#ff3355'; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill(); }; }(p.x, p.y));
      }
      for (i = 0; i < S.enemies.purple.length; i++) {
        p = entityScreenPos(S.enemies.purple[i]);
        g.draw.glow(ctx, '#a94dff', 10, function (px, py) { return function () { ctx.fillStyle = '#a94dff'; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill(); }; }(p.x, p.y));
      }
      if (S.enemies.green) {
        p = entityScreenPos(S.enemies.green);
        g.draw.glow(ctx, '#39ff6a', 12, function () { ctx.fillStyle = '#39ff6a'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill(); });
      }
      if (S.enemies.coily) {
        p = entityScreenPos(S.enemies.coily);
        g.draw.glow(ctx, '#ff2ec4', 14, function () {
          ctx.strokeStyle = '#ff2ec4'; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x - 10, p.y + 8); ctx.lineTo(p.x - 3, p.y - 4); ctx.lineTo(p.x + 4, p.y + 6); ctx.lineTo(p.x + 10, p.y - 6);
          ctx.stroke();
          ctx.fillStyle = '#ff2ec4';
          ctx.beginPath(); ctx.arc(p.x + 10, p.y - 6, 8, 0, Math.PI * 2); ctx.fill();
        });
      }

      if (S.freezeTimer > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,240,255,0.08)';
        ctx.fillRect(0, 0, 800, 600);
        ctx.restore();
      }

      // player
      var pp = playerScreenPos(g);
      ctx.save();
      ctx.globalAlpha = pp.alpha;
      g.draw.glow(ctx, '#a94dff', 14, function () {
        ctx.fillStyle = '#a94dff';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, 14, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath(); ctx.arc(pp.x - 5, pp.y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pp.x + 5, pp.y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a00';
      ctx.beginPath(); ctx.arc(pp.x, pp.y + 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      if (g.phase === 'ready') {
        g.draw.text(ctx, 'HOP THE PYRAMID. MIND THE SNAKE.', 400, 560, { size: 10, color: '#a94dff', align: 'center', glow: true });
      }
    }
  });
})();
