/*!
 * games/barrel-jump/game.js
 * Barrel Jump — inspired by Donkey Kong (1981).
 *
 * Six sloped girders stacked and linked by ladders (two of them broken —
 * they stop partway and dead-end, so you have to climb back down). Barrels
 * roll down from the ape at top-left, sometimes taking a ladder down toward
 * you; jump over one (or several in one jump) for points. Two hammer
 * pickups turn you briefly invincible and let you smash barrels/the
 * fireball for big points, at the cost of losing your jump and ladders
 * while it's active. Reach the captive at the top before the bonus timer
 * bleeds out.
 */
(function () {
  'use strict';

  // ---- geometry -------------------------------------------------------
  var ROWS = 6; // girder rows, 0 = bottom floor, 5 = top (captive) platform
  // Slopes alternate downhill direction so barrels zigzag: they roll down a
  // girder, fall off its low end onto the next one, and roll back the other
  // way — top (5) is flat, 4 slopes down-left, 3 down-right, 2 down-left,
  // 1 down-right, floor (0) flat. (y grows downward; downhill = larger y.)
  var BASE_GIRDERS = [
    { y0: 560, y1: 560 }, // 0: ground floor, flat
    { y0: 445, y1: 495 }, // 1: down to the right
    { y0: 405, y1: 355 }, // 2: down to the left
    { y0: 245, y1: 295 }, // 3: down to the right
    { y0: 205, y1: 155 }, // 4: down to the left
    { y0: 110, y1: 110 }  // 5: top platform, flat (captive stands here)
  ];
  function mirrorGirders(gs) { return gs.map(function (g) { return { y0: g.y1, y1: g.y0 }; }); }

  // Stage layouts cycle with the level: classic, its mirror image, and a
  // center-heavy gauntlet. Each defines ladders (gap = lower girder index,
  // broken = climbs only 60% up) and hammer spots.
  var LAYOUTS = [
    {
      mirror: false,
      ladders: [
        { gap: 0, x: 620, broken: false }, { gap: 0, x: 180, broken: true },
        { gap: 1, x: 160, broken: false }, { gap: 1, x: 600, broken: false },
        { gap: 2, x: 640, broken: true }, { gap: 2, x: 220, broken: false },
        { gap: 3, x: 180, broken: false }, { gap: 3, x: 560, broken: false },
        { gap: 4, x: 400, broken: false }
      ],
      hammers: [{ row: 2, x: 500 }, { row: 4, x: 300 }]
    },
    {
      mirror: true,
      ladders: [
        { gap: 0, x: 180, broken: false }, { gap: 0, x: 620, broken: true },
        { gap: 1, x: 640, broken: false }, { gap: 1, x: 200, broken: false },
        { gap: 2, x: 160, broken: true }, { gap: 2, x: 580, broken: false },
        { gap: 3, x: 620, broken: false }, { gap: 3, x: 240, broken: false },
        { gap: 4, x: 400, broken: false }
      ],
      hammers: [{ row: 2, x: 300 }, { row: 4, x: 500 }]
    },
    {
      mirror: false,
      ladders: [
        { gap: 0, x: 400, broken: false }, { gap: 0, x: 700, broken: true },
        { gap: 1, x: 260, broken: false }, { gap: 1, x: 680, broken: true },
        { gap: 2, x: 480, broken: false }, { gap: 2, x: 120, broken: false },
        { gap: 3, x: 340, broken: true }, { gap: 3, x: 660, broken: false },
        { gap: 4, x: 300, broken: false }
      ],
      hammers: [{ row: 1, x: 620 }, { row: 3, x: 460 }]
    }
  ];

  // Active layout state (set by applyLayout on every stage reset).
  var GIRDERS = BASE_GIRDERS;
  var LADDERS = LAYOUTS[0].ladders;
  var HAMMER_SPOTS = LAYOUTS[0].hammers;
  var CAPTIVE = { row: 5, x: 400 };
  var OIL_DRUM = { x: 45, y: 560 };
  var APE = { x: 60, y: 108 };

  function applyLayout(level) {
    var L = LAYOUTS[(level - 1) % LAYOUTS.length];
    GIRDERS = L.mirror ? mirrorGirders(BASE_GIRDERS) : BASE_GIRDERS;
    LADDERS = L.ladders;
    HAMMER_SPOTS = L.hammers;
    APE = { x: L.mirror ? 740 : 60, y: 108 };
    OIL_DRUM = { x: L.mirror ? 755 : 45, y: 560 };
  }

  /** Direction of increasing y (downhill) on a girder; 0 when flat. */
  function downhillDir(row) {
    var gd = GIRDERS[row];
    return gd.y1 > gd.y0 ? 1 : (gd.y0 > gd.y1 ? -1 : 0);
  }

  var WALK_SPEED = 130;
  var CLIMB_SPEED = 105;
  var JUMP_VY = -280;
  var JUMP_VX = 155;
  var GRAVITY = 780;
  var LADDER_SNAP = 12;
  var HIT_W = 16, HIT_H = 18;
  var HAMMER_DURATION = 8;
  var BONUS_START = 5000;
  var BONUS_TICK = 0.35; // seconds between -100 ticks

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function girderYAt(row, x) {
    var g = GIRDERS[row];
    return lerp(g.y0, g.y1, clamp(x, 0, 800) / 800);
  }

  function findLadder(gap, x) {
    for (var i = 0; i < LADDERS.length; i++) {
      var l = LADDERS[i];
      if (l.gap === gap && Math.abs(l.x - x) < LADDER_SNAP) return l;
    }
    return null;
  }

  function overlap(ax, ay, bx, by, hw, hh) {
    return Math.abs(ax - bx) < hw && Math.abs(ay - by) < hh;
  }

  // ---- setup ------------------------------------------------------------
  function resetStage(g, keepScore) {
    var S = g.state;
    applyLayout(g.level);
    S.barrels = [];
    S.barrelSpawnTimer = 1.2;
    S.fireball = null;
    S.fireballTimer = Math.max(6, 20 - (g.level - 1) * 2);
    S.bonusTimer = BONUS_START;
    S.bonusTickAcc = 0;
    S.hammers = HAMMER_SPOTS.map(function (h) { return { row: h.row, x: h.x, taken: false }; });
    S.hammerTimer = 0;
    S.levelClearTimer = 0;
    S.player = {
      x: 50, y: girderYAt(0, 50), row: 0, mode: 'ground',
      vx: 0, vy: 0, facing: 1, dyingTimer: 0,
      jumpFromRow: 0, jumpCleared: 0, ladder: null
    };
  }

  function killPlayer(g, reason) {
    var S = g.state;
    if (S.player.mode === 'dying') return;
    S.player.mode = 'dying';
    S.player.dyingTimer = 0.9;
    S.player.vx = 0; S.player.vy = 0;
    g.audio.play('die');
    g.fx.shake(9, 0.35);
    g.fx.burst(S.player.x, S.player.y, { color: '#ff3355', count: 16, speed: 160, life: 0.5 });
  }

  function respawnPlayer(g) {
    var S = g.state;
    S.player.x = 50; S.player.row = 0; S.player.y = girderYAt(0, 50);
    S.player.mode = 'ground'; S.player.vx = 0; S.player.vy = 0;
    S.player.jumpCleared = 0;
  }

  // ---- player -------------------------------------------------------------
  function updatePlayer(g, dt) {
    var S = g.state, P = S.player, input = g.input;

    if (P.mode === 'dying') {
      P.dyingTimer -= dt;
      if (P.dyingTimer <= 0) {
        g.setLives(g.lives - 1);
        if (g.lives <= 0) { g.gameOver(); return; }
        respawnPlayer(g);
      }
      return;
    }

    var hammering = S.hammerTimer > 0;

    if (P.mode === 'ladder') {
      var l = P.ladder;
      var lowerY = girderYAt(l.gap, l.x);
      var upperFullY = girderYAt(l.gap + 1, l.x);
      var topLimitY = l.broken ? lowerY - 0.6 * (lowerY - upperFullY) : upperFullY;
      var dir = 0;
      if (input.isDown('up')) dir = -1;
      else if (input.isDown('down')) dir = 1;
      P.y += dir * CLIMB_SPEED * dt;
      P.y = clamp(P.y, Math.min(topLimitY, lowerY), Math.max(topLimitY, lowerY));
      if (dir < 0 && P.y <= topLimitY + 0.5 && !l.broken) {
        P.mode = 'ground'; P.row = l.gap + 1; P.y = upperFullY;
      } else if (dir > 0 && P.y >= lowerY - 0.5) {
        P.mode = 'ground'; P.row = l.gap; P.y = lowerY;
      }
      return;
    }

    if (P.mode === 'ground') {
      var moveDir = 0;
      if (input.isDown('left')) moveDir = -1;
      else if (input.isDown('right')) moveDir = 1;
      if (moveDir !== 0) P.facing = moveDir;
      P.x = clamp(P.x + moveDir * WALK_SPEED * dt, 10, 790);
      P.y = girderYAt(P.row, P.x);

      if (!hammering && (input.isDown('up') || input.isDown('down'))) {
        var wantUp = input.isDown('up');
        var ladder = wantUp ? findLadder(P.row, P.x) : findLadder(P.row - 1, P.x);
        if (ladder) {
          P.mode = 'ladder';
          P.ladder = ladder;
          P.x = ladder.x;
          return;
        }
      }

      if (!hammering && input.pressed('a')) {
        P.mode = 'air';
        P.vy = JUMP_VY;
        P.vx = P.facing * JUMP_VX;
        P.jumpFromRow = P.row;
        P.jumpCleared = 0;
        g.audio.play('jump');
      }
      return;
    }

    if (P.mode === 'air') {
      var prevY = P.y;
      P.x = clamp(P.x + P.vx * dt, 10, 790);
      P.vy += GRAVITY * dt;
      P.y += P.vy * dt;

      if (P.vy >= 0) {
        var best = null;
        for (var r = 0; r < ROWS; r++) {
          var gy = girderYAt(r, P.x);
          if (prevY <= gy && P.y >= gy) {
            if (!best || gy < best.gy) best = { row: r, gy: gy };
          }
        }
        if (best) {
          var fellRows = P.jumpFromRow - best.row;
          P.mode = 'ground'; P.y = best.gy; P.row = best.row; P.vy = 0; P.vx = 0;
          if (fellRows >= 2) {
            killPlayer(g, 'fall');
          } else if (P.jumpCleared >= 2) {
            g.addScore(300);
            g.fx.text(P.x, P.y - 30, '+300', { color: '#ffe600', size: 11 });
          } else if (P.jumpCleared === 1) {
            g.addScore(100);
            g.fx.text(P.x, P.y - 30, '+100', { color: '#ffe600', size: 10 });
          }
        }
      }
      if (P.y > 610) killPlayer(g, 'fall');
      return;
    }
  }

  // ---- hammer pickups -----------------------------------------------------
  function updateHammer(g, dt) {
    var S = g.state, P = S.player;
    if (S.hammerTimer > 0) {
      S.hammerTimer -= dt;
      if (S.hammerTimer <= 0) S.hammerTimer = 0;
    }
    if (P.mode !== 'ground' || S.hammerTimer > 0) return;
    for (var i = 0; i < S.hammers.length; i++) {
      var h = S.hammers[i];
      if (h.taken) continue;
      if (h.row === P.row && Math.abs(h.x - P.x) < 18) {
        h.taken = true;
        S.hammerTimer = HAMMER_DURATION;
        g.audio.play('powerup');
        g.fx.flash('#ffe600', 0.15);
        g.fx.burst(P.x, P.y, { color: '#ffe600', count: 14 });
      }
    }
  }

  // ---- barrels --------------------------------------------------------
  function spawnBarrel(g) {
    var S = g.state;
    if (S.barrels.length >= 6) return;
    var dir = APE.x < 400 ? 1 : -1; // roll away from the ape, toward the far edge
    var sx = APE.x + dir * 20;
    S.barrels.push({ row: ROWS - 1, x: sx, y: girderYAt(ROWS - 1, sx), dir: dir, vy: 0, mode: 'roll', ladder: null, approachChecked: {} });
  }

  function updateBarrels(g, dt) {
    var S = g.state, P = S.player;
    if (P.mode === 'dying' || S.levelClearTimer > 0) return;

    S.barrelSpawnTimer -= dt;
    var spawnInterval = Math.max(1.0, 3.0 - (g.level - 1) * 0.25);
    if (S.barrelSpawnTimer <= 0) {
      spawnBarrel(g);
      S.barrelSpawnTimer = spawnInterval;
    }

    var descendChance = Math.min(0.12 + (g.level - 1) * 0.08, 0.55);
    var rollSpeed = 95 + (g.level - 1) * 14;
    var ladderSpeed = 70;

    for (var i = S.barrels.length - 1; i >= 0; i--) {
      var b = S.barrels[i];
      if (b.mode === 'roll') {
        // Slope dictates travel: barrels always roll downhill (flat rows keep
        // their current direction).
        var dh = downhillDir(b.row);
        if (dh !== 0) b.dir = dh;
        b.x += b.dir * rollSpeed * dt;
        b.y = girderYAt(b.row, b.x);
        if (b.row > 0) {
          var ladder = findLadder(b.row - 1, b.x);
          var key = ladder ? ladder.gap + '_' + ladder.x : null;
          if (ladder && !b.approachChecked[key]) {
            b.approachChecked[key] = true;
            if (Math.random() < descendChance) {
              b.mode = 'ladder'; b.ladder = ladder; b.x = ladder.x;
            }
          }
        }
        // Reaching the low end of a girder: fall off it onto the next one
        // (the classic zigzag). On the floor, roll off-screen and despawn.
        if (b.x < 8 || b.x > 792) {
          if (b.row === 0) {
            if (b.x < -20 || b.x > 820) { S.barrels.splice(i, 1); continue; }
          } else {
            b.x = clamp(b.x, 6, 794);
            b.mode = 'fall';
            b.vy = 0;
          }
        }
      } else if (b.mode === 'fall') {
        b.vy += GRAVITY * dt;
        b.y += b.vy * dt;
        var landY = girderYAt(b.row - 1, b.x);
        if (b.y >= landY) {
          b.row -= 1;
          b.y = landY;
          b.mode = 'roll';
          b.vy = 0;
          var dhNew = downhillDir(b.row);
          if (dhNew !== 0) b.dir = dhNew;
          b.approachChecked = {};
        }
      } else if (b.mode === 'ladder') {
        var lowerY = girderYAt(b.ladder.gap, b.ladder.x);
        b.y += ladderSpeed * dt;
        if (b.y >= lowerY) {
          b.y = lowerY; b.row = b.ladder.gap; b.mode = 'roll'; b.approachChecked = {};
        }
      }

      // jump-over crossing detection
      if (P.mode === 'air' && b.prevRelX !== undefined) {
        var relNow = b.x - P.x;
        if ((b.prevRelX > 0 && relNow <= 0) || (b.prevRelX < 0 && relNow >= 0)) {
          if (!overlap(P.x, P.y, b.x, b.y, HIT_W, 22)) P.jumpCleared++;
        }
      }
      b.prevRelX = b.x - P.x;

      // collision
      if (P.mode !== 'dying' && overlap(P.x, P.y, b.x, b.y, HIT_W, 20)) {
        if (S.hammerTimer > 0) {
          g.addScore(300);
          g.audio.play('hit');
          g.fx.burst(b.x, b.y, { color: '#8b5a2b', count: 14, speed: 180 });
          g.fx.text(b.x, b.y - 20, '+300', { color: '#ffe600', size: 11 });
          S.barrels.splice(i, 1);
        } else {
          killPlayer(g);
        }
      }
    }
  }

  // ---- fireball -------------------------------------------------------
  function updateFireball(g, dt) {
    var S = g.state, P = S.player;
    if (P.mode === 'dying' || S.levelClearTimer > 0) return;

    if (!S.fireball) {
      S.fireballTimer -= dt;
      if (S.fireballTimer <= 0) {
        S.fireball = { row: 0, x: OIL_DRUM.x, y: girderYAt(0, OIL_DRUM.x), dir: 1, mode: 'roll', ladder: null, retargetTimer: 0.6 };
      }
      return;
    }
    var F = S.fireball;
    var speed = 70 + (g.level - 1) * 12;

    if (F.mode === 'roll') {
      F.retargetTimer -= dt;
      if (F.retargetTimer <= 0) {
        F.retargetTimer = 0.8;
        var wantRow = clamp(F.row + (P.row > F.row ? 1 : (P.row < F.row ? -1 : 0)), 0, ROWS - 1);
        if (wantRow !== F.row) {
          var lad = wantRow > F.row ? findLadder(F.row, F.x) || nearestLadder(F.row, F.x) : findLadder(F.row - 1, F.x) || nearestLadder(F.row - 1, F.x);
          if (lad) { F.targetLadder = lad; F.climbTo = wantRow; }
        } else {
          F.targetLadder = null;
        }
      }
      if (F.targetLadder && Math.abs(F.x - F.targetLadder.x) < 4) {
        F.mode = 'ladder'; F.ladder = F.targetLadder; F.x = F.ladder.x;
      } else {
        var toward = F.targetLadder ? (F.targetLadder.x > F.x ? 1 : -1) : (P.x > F.x ? 1 : -1);
        F.dir = toward;
        F.x += F.dir * speed * dt;
        F.x = clamp(F.x, 5, 795);
        F.y = girderYAt(F.row, F.x);
      }
    } else if (F.mode === 'ladder') {
      var dirSign = F.climbTo > F.row ? 1 : -1;
      F.y += dirSign * (speed * 0.8) * dt;
      var boundY = girderYAt(F.climbTo, F.x);
      var doneClimb = dirSign > 0 ? F.y >= boundY : F.y <= boundY;
      if (doneClimb) {
        F.y = boundY; F.row = F.climbTo; F.mode = 'roll'; F.targetLadder = null; F.retargetTimer = 0.5;
      }
    }

    if (P.mode !== 'dying' && overlap(P.x, P.y, F.x, F.y, HIT_W, 20)) {
      if (S.hammerTimer > 0) {
        g.addScore(500);
        g.audio.play('explode');
        g.fx.burst(F.x, F.y, { color: '#ff8a00', count: 22, speed: 220 });
        g.fx.text(F.x, F.y - 20, '+500', { color: '#ffe600', size: 12 });
        S.fireball = null;
        S.fireballTimer = Math.max(6, 14 - (g.level - 1) * 1.5);
      } else {
        killPlayer(g);
      }
    }
  }

  function nearestLadder(gap, x) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < LADDERS.length; i++) {
      var l = LADDERS[i];
      if (l.gap !== gap) continue;
      var d = Math.abs(l.x - x);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  }

  // ---- bonus timer / captive ---------------------------------------------
  function updateBonus(g, dt) {
    var S = g.state;
    if (S.levelClearTimer > 0 || S.player.mode === 'dying') return;
    S.bonusTickAcc += dt;
    while (S.bonusTickAcc >= BONUS_TICK) {
      S.bonusTickAcc -= BONUS_TICK;
      if (S.bonusTimer > 0) S.bonusTimer = Math.max(0, S.bonusTimer - 100);
    }

    var P = S.player;
    if (P.row === CAPTIVE.row && Math.abs(P.x - CAPTIVE.x) < 26 && S.levelClearTimer <= 0) {
      g.addScore(S.bonusTimer);
      if (S.bonusTimer > 0) g.fx.text(CAPTIVE.x, CAPTIVE.y - 30, '+' + S.bonusTimer, { color: '#ff8a00', size: 12 });
      g.audio.play('levelup');
      g.fx.flash('#ff2ec4', 0.2);
      g.fx.burst(CAPTIVE.x, CAPTIVE.y, { color: '#ff2ec4', count: 30, speed: 200, life: 0.9 });
      S.levelClearTimer = 1.5;
    }
  }

  function updateLevelClear(g, dt) {
    var S = g.state;
    if (S.levelClearTimer <= 0) return;
    S.levelClearTimer -= dt;
    if (S.levelClearTimer <= 0) {
      g.setLevel(g.level + 1);
      resetStage(g);
    }
  }

  // ---- draw helpers ------------------------------------------------------
  function drawGirders(g, ctx) {
    for (var r = 0; r < ROWS; r++) {
      var gd = GIRDERS[r];
      ctx.save();
      ctx.strokeStyle = '#ff8a00';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, gd.y0);
      ctx.lineTo(800, gd.y1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,138,0,0.25)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(0, gd.y0 + 6);
      ctx.lineTo(800, gd.y1 + 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawLadders(g, ctx) {
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 3;
    for (var i = 0; i < LADDERS.length; i++) {
      var l = LADDERS[i];
      var lowerY = girderYAt(l.gap, l.x);
      var upperY = girderYAt(l.gap + 1, l.x);
      var topY = l.broken ? lowerY - 0.6 * (lowerY - upperY) : upperY;
      ctx.globalAlpha = l.broken ? 0.55 : 1;
      ctx.beginPath(); ctx.moveTo(l.x - 8, lowerY); ctx.lineTo(l.x - 8, topY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x + 8, lowerY); ctx.lineTo(l.x + 8, topY); ctx.stroke();
      for (var y = lowerY; y > topY; y -= 14) {
        ctx.beginPath(); ctx.moveTo(l.x - 8, y); ctx.lineTo(l.x + 8, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBarrel(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.ellipse(x, y - 8, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 12, 13, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 4, 13, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(g, ctx) {
    var S = g.state, P = S.player;
    ctx.save();
    if (P.mode === 'dying') {
      ctx.translate(P.x, P.y - 12);
      ctx.rotate((0.9 - P.dyingTimer) * 14);
      ctx.translate(-P.x, -(P.y - 12));
    }
    var color = S.hammerTimer > 0 ? (S.hammerTimer < 2 && Math.floor(g.time * 10) % 2 === 0 ? '#ffffff' : '#ffe600') : '#00f0ff';
    g.draw.glow(ctx, color, 12, function () {
      ctx.fillStyle = color;
      ctx.fillRect(P.x - HIT_W / 2, P.y - HIT_H - 10, HIT_W, HIT_H);
      ctx.fillRect(P.x - 5, P.y - 10, 10, 10);
    });
    if (S.hammerTimer > 0) {
      ctx.fillStyle = '#eaf6ff';
      ctx.fillRect(P.x + (P.facing >= 0 ? 8 : -20), P.y - HIT_H - 20, 12, 6);
    }
    ctx.restore();
  }

  GZ.boot({
    slug: 'barrel-jump',
    touchLayout: 'dpad-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['← → or A/D', 'Walk'], ['↑ ↓ or W/S', 'Climb ladder'], ['A (button)', 'Jump']],
    state: {},

    init: function (g) {
      g.setLives(3);
      g.setLevel(1);
      resetStage(g);
    },

    update: function (g, dt) {
      updatePlayer(g, dt);
      updateHammer(g, dt);
      updateBarrels(g, dt);
      updateFireball(g, dt);
      updateBonus(g, dt);
      updateLevelClear(g, dt);
    },

    render: function (g, ctx) {
      var S = g.state;

      // oil drum
      ctx.save();
      ctx.fillStyle = '#553311';
      ctx.fillRect(OIL_DRUM.x - 16, OIL_DRUM.y - 34, 32, 34);
      ctx.strokeStyle = '#ff8a00'; ctx.lineWidth = 2;
      ctx.strokeRect(OIL_DRUM.x - 16, OIL_DRUM.y - 34, 32, 34);
      ctx.restore();

      drawGirders(g, ctx);
      drawLadders(g, ctx);

      // ape
      g.draw.glow(ctx, '#a94dff', 10, function () {
        ctx.fillStyle = '#5b2b7a';
        ctx.beginPath(); ctx.ellipse(APE.x, APE.y, 26, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a94dff';
        ctx.fillRect(APE.x - 12, APE.y - 30, 24, 16);
      });

      // captive
      var capBob = Math.sin(g.time * 3) * 3;
      g.draw.glow(ctx, '#ff2ec4', 10, function () {
        ctx.fillStyle = '#ff2ec4';
        ctx.fillRect(CAPTIVE.x - 10, CAPTIVE.y - 26 + capBob, 20, 26);
      });
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(CAPTIVE.x - 9, CAPTIVE.y - 34 + capBob, 18, 6);

      // hammer pickups
      for (var i = 0; i < S.hammers.length; i++) {
        var h = S.hammers[i];
        if (h.taken) continue;
        var hy = girderYAt(h.row, h.x) - 22 + Math.sin(g.time * 4 + i) * 3;
        g.draw.glow(ctx, '#ffe600', 10, function (hx2, hy2) {
          return function () {
            ctx.fillStyle = '#ffe600';
            ctx.fillRect(hx2 - 3, hy2 - 12, 6, 16);
            ctx.fillRect(hx2 - 9, hy2 - 16, 18, 8);
          };
        }(h.x, hy));
      }

      // barrels
      for (var b = 0; b < S.barrels.length; b++) drawBarrel(ctx, S.barrels[b].x, S.barrels[b].y);

      // fireball
      if (S.fireball) {
        var F = S.fireball;
        var flick = 0.7 + Math.sin(g.time * 24) * 0.3;
        g.draw.glow(ctx, '#ff3355', 18, function () {
          ctx.fillStyle = 'rgba(255,51,85,' + flick + ')';
          ctx.beginPath(); ctx.arc(F.x, F.y - 10, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffe600';
          ctx.beginPath(); ctx.arc(F.x, F.y - 10, 6, 0, Math.PI * 2); ctx.fill();
        });
      }

      drawPlayer(g, ctx);

      // HUD extras
      g.draw.text(ctx, 'BONUS ' + S.bonusTimer, 12, 24, { size: 9, color: '#ff8a00' });
      if (S.hammerTimer > 0) g.draw.text(ctx, 'HAMMER TIME', 400, 24, { size: 9, color: '#ffe600', align: 'center' });

      if (g.phase === 'ready') {
        g.draw.text(ctx, 'CLIMB. DODGE. RESCUE.', 400, 300, { size: 11, color: '#ff8a00', align: 'center', glow: true });
      }
    }
  });
})();
