/*!
 * games/road-hopper/game.js
 * Road Hopper — inspired by Frogger (1981).
 *
 * 13x15 grid: a start strip, five traffic lanes, a safe median, five river
 * rows (logs + turtles that periodically submerge), and five home bays at
 * the top. One buffered hop per press. Ride logs/turtles across the river;
 * miss one and you drown. Fill all five bays before the per-frog timer
 * runs out to advance the level.
 */
(function () {
  'use strict';

  var COLS = 13, ROWS = 15;
  var CELL_W = 800 / COLS, CELL_H = 600 / ROWS;
  var HOP_TIME = 0.1;
  var BAY_COLS = [1, 3, 6, 9, 11];
  var START_COL = 6, START_ROW = 14;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function colToX(col) { return col * CELL_W + CELL_W / 2; }
  function rowToY(row) { return row * CELL_H + CELL_H / 2; }

  function laneType(row) {
    if (row === 0) return 'home';
    if (row === 1) return 'bank';
    if (row >= 2 && row <= 6) return 'river';
    if (row === 7) return 'median';
    if (row >= 8 && row <= 12) return 'traffic';
    if (row === 13) return 'shoulder';
    return 'start';
  }

  // ---- level / lane setup -------------------------------------------------
  function makeEntities(row, count, widthColsFn, speed, dir, type) {
    var list = [];
    var spacing = 800 / count;
    for (var i = 0; i < count; i++) {
      var wCols = widthColsFn();
      var x = i * spacing + Math.random() * spacing * 0.4;
      if (dir < 0) x = 800 - x;
      var e = { x: x, width: wCols * CELL_W, speed: speed * (0.85 + Math.random() * 0.3), dir: dir, type: type };
      if (type === 'turtle') {
        e.phase = 'up';
        e.phaseTimer = 2.5 + Math.random() * 2.5;
      }
      list.push(e);
    }
    return list;
  }

  function initLevel(g) {
    var S = g.state, lvl = g.level;
    S.lanes = [];
    for (var row = 0; row < ROWS; row++) {
      var type = laneType(row);
      var lane = { type: type, entities: [] };
      if (type === 'traffic') {
        var dir = (row % 2 === 0) ? 1 : -1;
        var speed = 65 + lvl * 11;
        var count = 3 + (row % 2);
        lane.entities = makeEntities(row, count, function () { return Math.random() < 0.35 ? 2 : 1; }, speed, dir, 'car');
        lane.entities.forEach(function (e) { e.color = ['#ff3355', '#ffe600', '#00f0ff', '#ff2ec4'][Math.floor(Math.random() * 4)]; });
      } else if (type === 'river') {
        var rdir = (row % 2 === 0) ? -1 : 1;
        var rspeed = 32 + lvl * 5;
        var isTurtleRow = (row % 2 === 0);
        lane.entities = makeEntities(row, 3, function () { return isTurtleRow ? (2 + Math.floor(Math.random() * 2)) : (2 + Math.floor(Math.random() * 3)); }, rspeed, rdir, isTurtleRow ? 'turtle' : 'log');
      }
      S.lanes.push(lane);
    }
    S.timerMax = Math.max(15, 30 - (lvl - 1) * 2);
    S.submergeBoost = Math.min(1.6, 1 + (lvl - 1) * 0.15);
  }

  function resetBays(g) {
    var S = g.state;
    S.bays = BAY_COLS.map(function (c) { return { col: c, filled: false, hasFly: false, hasCroc: false }; });
    S.bays[Math.floor(Math.random() * S.bays.length)].hasCroc = true;
    S.flyTimer = 5 + Math.random() * 6;
    S.ladyTimer = 7 + Math.random() * 6;
    S.lady = null;
  }

  function respawnPlayer(g) {
    var S = g.state;
    S.player.col = START_COL; S.player.row = START_ROW;
    S.player.hopping = false; S.player.bufferedDir = null;
    S.player.bestRow = START_ROW;
    S.player.frogTimer = S.timerMax;
    S.player.carryingLady = false;
  }

  function killPlayer(g, reason) {
    var S = g.state;
    var x = currentX(S.player), y = rowToY(currentRow(S.player));
    g.audio.play('die');
    g.fx.shake(8, 0.3);
    g.fx.burst(x, y, { color: reason === 'water' ? '#39c8ff' : (reason === 'timeout' ? '#a94dff' : '#ff3355'), count: 18, speed: 170 });
    S.player.carryingLady = false;
    g.setLives(g.lives - 1);
    if (g.lives <= 0) { g.gameOver(); return; }
    respawnPlayer(g);
  }

  function currentX(P) {
    if (P.hopping) return lerp(colToX(P.fromCol), colToX(P.toCol), P.hopT);
    return colToX(P.col);
  }
  function currentRow(P) { return P.hopping ? P.toRow : P.row; }

  // ---- hop input -----------------------------------------------------------
  var DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

  function tryHop(g, dirName) {
    var S = g.state, P = S.player;
    var d = DIRS[dirName];
    var fromCol = Math.round(P.col), fromRow = P.row;
    var toCol = fromCol + d.dx, toRow = fromRow + d.dy;
    if (toCol < 0 || toCol > COLS - 1 || toRow < 0 || toRow > ROWS - 1) return;
    P.hopping = true; P.hopT = 0;
    P.fromCol = fromCol; P.fromRow = fromRow; P.toCol = toCol; P.toRow = toRow;
    g.audio.play('jump');
    if (d.dy < 0 && toRow < P.bestRow) {
      P.bestRow = toRow;
      g.addScore(10);
    }
  }

  function evaluateHome(g) {
    var S = g.state, P = S.player;
    var bay = null;
    for (var i = 0; i < S.bays.length; i++) if (S.bays[i].col === P.col) bay = S.bays[i];
    if (!bay || bay.filled || bay.hasCroc) { killPlayer(g, bay && bay.hasCroc ? 'croc' : 'bank'); return; }

    var gain = 50 + Math.floor(P.frogTimer / 0.5) * 2;
    bay.filled = true;
    if (bay.hasFly) { gain += 200; bay.hasFly = false; g.fx.text(colToX(bay.col), rowToY(0) - 14, 'FLY +200', { color: '#ffe600', size: 9 }); }
    if (P.carryingLady) { gain += 200; P.carryingLady = false; g.fx.text(colToX(bay.col), rowToY(0) - 28, '+200', { color: '#ff2ec4', size: 10 }); }

    g.addScore(gain);
    g.audio.play('pickup');
    g.fx.burst(colToX(bay.col), rowToY(0), { color: '#39ff6a', count: 16, speed: 150 });
    g.fx.text(colToX(bay.col), rowToY(0) - 4, '+' + gain, { color: '#39ff6a', size: 10 });

    var allFilled = S.bays.every(function (b) { return b.filled; });
    if (allFilled) {
      g.addScore(1000);
      g.audio.play('levelup');
      g.fx.flash('#39ff6a', 0.2);
      g.fx.burst(400, 40, { color: '#39ff6a', count: 40, speed: 220, life: 1 });
      g.setLevel(g.level + 1);
      initLevel(g);
      resetBays(g);
    }
    respawnPlayer(g);
  }

  // ---- update --------------------------------------------------------------
  function updateLanes(g, dt) {
    var S = g.state;
    for (var row = 0; row < ROWS; row++) {
      var lane = S.lanes[row];
      for (var i = 0; i < lane.entities.length; i++) {
        var e = lane.entities[i];
        e.x += e.dir * e.speed * dt;
        if (e.dir > 0 && e.x > 800) e.x = -e.width;
        else if (e.dir < 0 && e.x + e.width < 0) e.x = 800;
        if (e.type === 'turtle') {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            if (e.phase === 'up') { e.phase = 'blink'; e.phaseTimer = 0.6; }
            else if (e.phase === 'blink') { e.phase = 'under'; e.phaseTimer = (1.5 + Math.random()) * S.submergeBoost; }
            else { e.phase = 'up'; e.phaseTimer = (3 + Math.random() * 2) / S.submergeBoost; }
          }
        }
      }
    }
  }

  function findRideEntity(lane, x) {
    for (var i = 0; i < lane.entities.length; i++) {
      var e = lane.entities[i];
      if (e.type === 'turtle' && e.phase === 'under') continue;
      if (x >= e.x && x <= e.x + e.width) return e;
    }
    return null;
  }

  function updateSpawns(g, dt) {
    var S = g.state;
    S.flyTimer -= dt;
    if (S.flyTimer <= 0) {
      S.flyTimer = 9 + Math.random() * 8;
      var candidates = S.bays.filter(function (b) { return !b.filled && !b.hasCroc && !b.hasFly; });
      var anyFly = S.bays.some(function (b) { return b.hasFly; });
      if (!anyFly && candidates.length) candidates[Math.floor(Math.random() * candidates.length)].hasFly = true;
    }
    S.ladyTimer -= dt;
    if (S.ladyTimer <= 0) {
      S.ladyTimer = 10 + Math.random() * 8;
      if (!S.lady && !S.player.carryingLady) {
        var riverRows = [2, 3, 4, 5, 6].filter(function (r) { return S.lanes[r].entities.some(function (e) { return e.type === 'log'; }); });
        if (riverRows.length) {
          var r2 = riverRows[Math.floor(Math.random() * riverRows.length)];
          var logs = S.lanes[r2].entities.filter(function (e) { return e.type === 'log'; });
          var entity = logs[Math.floor(Math.random() * logs.length)];
          S.lady = { row: r2, entity: entity, offset: entity.width * 0.5 };
        }
      }
    }
  }

  function updatePlayer(g, dt) {
    var S = g.state, P = S.player, input = g.input;

    P.frogTimer -= dt;
    if (P.frogTimer <= 0) { killPlayer(g, 'timeout'); return; }

    var pressedDir = null;
    if (input.pressed('up')) pressedDir = 'up';
    else if (input.pressed('down')) pressedDir = 'down';
    else if (input.pressed('left')) pressedDir = 'left';
    else if (input.pressed('right')) pressedDir = 'right';

    if (P.hopping) {
      if (pressedDir) P.bufferedDir = pressedDir;
      P.hopT += dt / HOP_TIME;
      if (P.hopT >= 1) {
        P.hopT = 1; P.hopping = false;
        P.col = P.toCol; P.row = P.toRow;
        if (P.row === 0) { evaluateHome(g); return; }
      }
    } else {
      var toFire = P.bufferedDir || pressedDir;
      if (toFire) { P.bufferedDir = null; tryHop(g, toFire); }
    }

    // continuous lane interaction (traffic + river), using current logical row/x
    var row = currentRow(P), x = currentX(P);
    var lane = S.lanes[row];
    if (!lane) return;

    if (lane.type === 'traffic') {
      for (var i = 0; i < lane.entities.length; i++) {
        var v = lane.entities[i];
        if (x >= v.x - 4 && x <= v.x + v.width + 4) { killPlayer(g, 'traffic'); return; }
      }
    } else if (lane.type === 'river') {
      var ride = findRideEntity(lane, x);
      if (!ride) { killPlayer(g, 'water'); return; }
      if (!P.hopping) {
        var deltaCol = (ride.dir * ride.speed * dt) / CELL_W;
        P.col += deltaCol;
        if (P.col < -0.4 || P.col > COLS - 0.6) { killPlayer(g, 'water'); return; }
      }
    }

    // lady frog pickup
    if (S.lady && !P.hopping && !P.carryingLady && row === S.lady.row) {
      var ladyX = S.lady.entity.x + S.lady.offset;
      if (Math.abs(x - ladyX) < CELL_W * 0.6) {
        P.carryingLady = true;
        S.lady = null;
        g.audio.play('pickup');
        g.fx.burst(x, rowToY(row), { color: '#ff2ec4', count: 10 });
        g.fx.text(x, rowToY(row) - 14, 'GOT HER!', { color: '#ff2ec4', size: 9 });
      }
    }
  }

  // ---- render ---------------------------------------------------------------
  var LANE_COLORS = {
    home: '#0a1a10', bank: '#0d2414', river: '#031a33',
    median: '#0d2414', traffic: '#161616', shoulder: '#0d2414', start: '#0d2414'
  };

  function drawLanes(g, ctx) {
    var S = g.state;
    for (var row = 0; row < ROWS; row++) {
      var lane = S.lanes[row];
      var y = row * CELL_H;
      ctx.fillStyle = LANE_COLORS[lane.type];
      ctx.fillRect(0, y, 800, CELL_H);
      if (lane.type === 'traffic') {
        ctx.strokeStyle = 'rgba(255,230,0,0.25)';
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(0, y + CELL_H / 2); ctx.lineTo(800, y + CELL_H / 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // home bays
    var homeY = 0;
    for (var b = 0; b < S.bays.length; b++) {
      var bay = S.bays[b];
      var bx = bay.col * CELL_W;
      ctx.fillStyle = bay.filled ? 'rgba(57,255,106,0.28)' : 'rgba(57,255,106,0.08)';
      ctx.fillRect(bx + 3, homeY + 3, CELL_W - 6, CELL_H - 6);
      if (bay.hasCroc) {
        ctx.fillStyle = '#1c5c2a';
        ctx.fillRect(bx + 6, homeY + CELL_H / 2 - 6, CELL_W - 12, 12);
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(bx + 10, homeY + CELL_H / 2 - 4, 4, 4);
        ctx.fillRect(bx + CELL_W - 18, homeY + CELL_H / 2 - 4, 4, 4);
      } else if (bay.hasFly) {
        ctx.fillStyle = '#ffe600';
        ctx.beginPath(); ctx.arc(bx + CELL_W / 2, homeY + CELL_H / 2, 5, 0, Math.PI * 2); ctx.fill();
      } else if (bay.filled) {
        ctx.fillStyle = '#39ff6a';
        ctx.beginPath(); ctx.arc(bx + CELL_W / 2, homeY + CELL_H / 2, 8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawEntities(g, ctx) {
    var S = g.state;
    for (var row = 0; row < ROWS; row++) {
      var lane = S.lanes[row];
      var y = row * CELL_H;
      for (var i = 0; i < lane.entities.length; i++) {
        var e = lane.entities[i];
        if (lane.type === 'traffic') {
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x, y + 6, e.width, CELL_H - 12);
          ctx.fillStyle = '#eaf6ff';
          ctx.fillRect(e.x + (e.dir > 0 ? e.width - 8 : 4), y + 10, 4, 4);
        } else if (e.type === 'log') {
          ctx.fillStyle = '#8b5a2b';
          ctx.fillRect(e.x, y + 8, e.width, CELL_H - 16);
          ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5;
          ctx.strokeRect(e.x, y + 8, e.width, CELL_H - 16);
        } else if (e.type === 'turtle') {
          var alpha = e.phase === 'under' ? 0.08 : (e.phase === 'blink' ? (0.4 + 0.5 * Math.sin(g.time * 26)) : 0.95);
          ctx.fillStyle = 'rgba(57,255,106,' + alpha + ')';
          var n = Math.max(1, Math.round(e.width / CELL_W));
          for (var t = 0; t < n; t++) {
            ctx.beginPath();
            ctx.ellipse(e.x + (t + 0.5) * (e.width / n), y + CELL_H / 2, CELL_W * 0.42, CELL_H * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    // lady frog on her log
    if (S.lady) {
      var lx = S.lady.entity.x + S.lady.offset;
      var ly = rowToY(S.lady.row);
      ctx.fillStyle = '#ff2ec4';
      ctx.beginPath(); ctx.arc(lx, ly, CELL_W * 0.28, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer(g, ctx) {
    var S = g.state, P = S.player;
    var x = currentX(P);
    var y = rowToY(currentRow(P));
    if (P.hopping) y -= Math.sin(P.hopT * Math.PI) * 14;
    g.draw.glow(ctx, '#39ff6a', 12, function () {
      ctx.fillStyle = '#39ff6a';
      ctx.beginPath(); ctx.arc(x, y, CELL_W * 0.36, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#07070c';
    ctx.beginPath(); ctx.arc(x - 6, y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
    if (P.carryingLady) {
      ctx.fillStyle = '#ff2ec4';
      ctx.beginPath(); ctx.arc(x, y - 18, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  GZ.boot({
    slug: 'road-hopper',
    touchLayout: 'dpad-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['↑ ↓ ← → or WASD', 'Hop one tile'], ['(buffered)', "Never misses a beat"]],
    state: {},

    init: function (g) {
      g.setLives(3);
      g.setLevel(1);
      initLevel(g);
      resetBays(g);
      g.state.player = { col: START_COL, row: START_ROW, hopping: false, hopT: 0, bestRow: START_ROW, bufferedDir: null, frogTimer: g.state.timerMax, carryingLady: false };
    },

    update: function (g, dt) {
      updateLanes(g, dt);
      updateSpawns(g, dt);
      updatePlayer(g, dt);
    },

    render: function (g, ctx) {
      var S = g.state;
      drawLanes(g, ctx);
      drawEntities(g, ctx);
      drawPlayer(g, ctx);

      // per-frog countdown bar
      var pct = clamp(S.player.frogTimer / S.timerMax, 0, 1);
      ctx.fillStyle = 'rgba(234,246,255,0.15)';
      ctx.fillRect(20, 588, 200, 6);
      ctx.fillStyle = pct < 0.25 ? '#ff3355' : '#39ff6a';
      ctx.fillRect(20, 588, 200 * pct, 6);

      if (g.phase === 'ready') {
        g.draw.text(ctx, 'FIVE LANES. ONE RIVER. HOP.', 400, 300, { size: 11, color: '#39ff6a', align: 'center', glow: true });
      }
    }
  });
})();
