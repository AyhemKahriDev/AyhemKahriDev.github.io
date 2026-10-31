/*!
 * games/galaxy-raiders/game.js
 * Galaxy Raiders — Sal's Galaxy Zone Arcade, inspired by Galaga (1981).
 *
 * A single IIFE ending in one GZ.boot() call. Touches nothing but the `g`
 * handle GZ.boot() hands to init/update/render. Every bit of motion —
 * including the parametric bezier swoop paths for entrance choreography and
 * dive attacks — is scaled by an accumulated, dt-driven "stage clock"
 * (state.stageTime), never by raw frame counts.
 *
 * Signature mechanic: the tractor beam. A boss galaga occasionally dives to
 * mid-screen and projects a cone-shaped beam; catching the player costs a
 * life and docks the captured ship on that specific boss. Landing a hit on
 * that boss on a LATER dive frees the ship and turns the player into a dual
 * fighter (double shots, side-by-side hull) until it's lost again.
 */
(function () {
  'use strict';

  // ---- palette (accent + exactly one secondary neon, per DESIGN.md) -------
  var ACCENT = '#00f0ff';   // player, friendly bullets, "damaged/capturable" signal
  var SECONDARY = '#ff2ec4'; // enemies, hazards, the tractor beam
  var NEUTRAL = '#eaf6ff';   // outlines / neutral chrome
  var GOLD = '#ffe600';      // score floaters only (matches engine's fx.text default)

  // ---- tunables -------------------------------------------------------------
  var FIELD_W = 800, FIELD_H = 600;
  var PLAYER_Y = 556;
  var PLAYER_SPEED = 300;
  var PLAYER_HALF_W = 14;
  var DUAL_GAP = 22;
  var PLAYER_SHOT_SPEED = 520;
  var ENEMY_SHOT_BASE_SPEED = 190;

  var FORM_X0 = 114, FORM_DX = 82;
  var FORM_Y0 = 92, FORM_DY = 44;

  var ROW_DEFS = [
    { row: 0, type: 'boss', cols: [2, 3, 4, 5] },
    { row: 1, type: 'butterfly', cols: [0, 1, 2, 3, 4, 5, 6, 7] },
    { row: 2, type: 'bee', cols: [0, 1, 2, 3, 4, 5, 6, 7] },
    { row: 3, type: 'bee', cols: [0, 1, 2, 3, 4, 5, 6, 7] },
    { row: 4, type: 'bee', cols: [0, 1, 2, 3, 4, 5, 6, 7] }
  ];

  var ENEMY_SIZE = {
    bee: { w: 24, h: 18 },
    butterfly: { w: 28, h: 20 },
    boss: { w: 34, h: 24 }
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function bezierPoint(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function enemyBasePoints(type) {
    return type === 'boss' ? 400 : type === 'butterfly' ? 160 : 100;
  }

  // ---- stage construction ----------------------------------------------------

  function buildFormation(S) {
    S.enemies = [];
    var maxIntroEnd = 0;
    for (var r = 0; r < ROW_DEFS.length; r++) {
      var def = ROW_DEFS[r];
      for (var i = 0; i < def.cols.length; i++) {
        var col = def.cols[i];
        var formX = FORM_X0 + col * FORM_DX;
        var formY = FORM_Y0 + def.row * FORM_DY;
        var side = col % 2 === 0 ? -1 : 1;
        var p0 = { x: 400 + side * 520, y: -80 - def.row * 14 };
        var p1 = { x: 400 + side * 260, y: 140 + def.row * 8 };
        var p2 = { x: formX + side * 90, y: formY - 140 };
        var p3 = { x: formX, y: formY };
        var introDelay = def.row * 0.28 + i * 0.045;
        var introDur = 1.6;
        maxIntroEnd = Math.max(maxIntroEnd, introDelay + introDur);
        S.enemies.push({
          type: def.type, row: def.row, col: col,
          formX: formX, formY: formY,
          x: p0.x, y: p0.y,
          w: ENEMY_SIZE[def.type].w, h: ENEMY_SIZE[def.type].h,
          alive: true,
          health: def.type === 'boss' ? 2 : 1,
          damaged: false,
          hasCapturedShip: false,
          state: 'formation',
          introDelay: introDelay, introDur: introDur,
          p0: p0, p1: p1, p2: p2, p3: p3,
          fireTimer: 0
        });
      }
    }
    S.introUntil = maxIntroEnd;
  }

  function setupFormationStage(g) {
    var S = g.state;
    S.stageTime = 0;
    S.challenge.active = false;
    S.capturedShipEnemy = null;
    buildFormation(S);
    S.diveTimer = S.introUntil + 1.4;
    S.beamCooldownTimer = 6 + Math.random() * 3;
    S.enemyShots = [];
  }

  function setupChallengeStage(g) {
    var S = g.state;
    S.stageTime = 0;
    S.enemies = [];
    S.enemyShots = [];
    S.introUntil = 0;
    S.capturedShipEnemy = null;
    S.challenge = {
      active: true,
      waveIndex: 0,
      wavesTotal: 3,
      enemiesPerWave: 8,
      spawnedInWave: 0,
      spawnTimer: 0,
      spawnInterval: 0.32,
      waveEnemies: [],
      totalSpawned: 0,
      totalKilled: 0,
      totalEscaped: 0
    };
  }

  function initStage(g) {
    if (g.level % 3 === 0) setupChallengeStage(g);
    else setupFormationStage(g);
  }

  function advanceStage(g) {
    g.audio.play('levelup');
    g.fx.flash(ACCENT, 0.25);
    g.setLevel(g.level + 1);
    initStage(g);
  }

  // ---- player -----------------------------------------------------------------

  function resetPlayer(S) {
    S.player = { x: 400, invuln: 0 };
    S.dual = false;
    S.playerShots = [];
  }

  function updatePlayer(g, dt) {
    var S = g.state, input = g.input;
    var half = PLAYER_HALF_W + (S.dual ? DUAL_GAP : 0);
    var dx = 0;
    if (input.isDown('left')) dx -= 1;
    if (input.isDown('right')) dx += 1;
    S.player.x = clamp(S.player.x + dx * PLAYER_SPEED * dt, half, FIELD_W - half);
    if (S.player.invuln > 0) S.player.invuln = Math.max(0, S.player.invuln - dt);

    if (input.pressed('a')) fireShot(g);

    for (var i = S.playerShots.length - 1; i >= 0; i--) {
      var b = S.playerShots[i];
      b.y += b.vy * dt;
      if (b.y < -20) S.playerShots.splice(i, 1);
    }
  }

  function fireShot(g) {
    var S = g.state;
    var cap = S.dual ? 4 : 2;
    if (S.playerShots.length >= cap) return;
    var xs = S.dual ? [S.player.x - DUAL_GAP, S.player.x + DUAL_GAP] : [S.player.x];
    for (var i = 0; i < xs.length; i++) {
      if (S.playerShots.length >= cap) break;
      S.playerShots.push({ x: xs[i], y: PLAYER_Y - 16, vy: -PLAYER_SHOT_SPEED, w: 3, h: 14 });
    }
    g.audio.play('shoot');
  }

  function playerHit(g) {
    var S = g.state;
    if (S.player.invuln > 0) return;
    if (S.dual) {
      S.dual = false;
      g.audio.play('hit');
      g.fx.burst(S.player.x, PLAYER_Y, { color: SECONDARY, count: 16, speed: 140, life: 0.4, size: 3 });
      S.player.invuln = 1.0;
    } else {
      g.setLives(g.lives - 1);
      g.audio.play('die');
      g.fx.shake(9, 0.3);
      g.fx.burst(S.player.x, PLAYER_Y, { color: ACCENT, count: 28, speed: 200, life: 0.6, size: 4 });
      S.player.x = 400;
      S.player.invuln = 1.6;
      if (g.lives <= 0) { g.gameOver(); return; }
    }
  }

  function triggerCapture(g, enemy) {
    var S = g.state;
    S.capturedShipEnemy = enemy;
    enemy.hasCapturedShip = true;
    g.setLives(g.lives - 1);
    g.audio.play('die');
    g.fx.shake(10, 0.35);
    g.fx.burst(S.player.x, PLAYER_Y, { color: SECONDARY, count: 26, speed: 180, life: 0.6, size: 3 });
    g.fx.text(S.player.x, PLAYER_Y - 20, 'CAPTURED!', { color: SECONDARY, size: 11 });
    S.player.x = 400;
    S.player.invuln = 1.6;
    S.dual = false;
    if (g.lives <= 0) { g.gameOver(); return; }
  }

  function rescueCapturedShip(g, enemy) {
    var S = g.state;
    enemy.hasCapturedShip = false;
    S.capturedShipEnemy = null;
    S.dual = true;
    g.audio.play('powerup');
    g.audio.play('levelup');
    g.fx.flash(ACCENT, 0.28);
    g.fx.burst(enemy.x, enemy.y, { color: ACCENT, count: 34, speed: 210, life: 0.7, size: 4 });
    g.fx.text(enemy.x, enemy.y - 16, 'DUAL FIGHTER!', { color: ACCENT, size: 11 });
  }

  // ---- formation-stage enemy behavior ------------------------------------------

  function introActive(S) { return S.stageTime < S.introUntil; }

  function startDive(g, enemy) {
    var S = g.state;
    enemy.state = 'diving';
    enemy.diveStart = S.stageTime;
    var side = enemy.col % 2 === 0 ? -1 : 1;
    var targetX = clamp(S.player.x + (Math.random() * 120 - 60), 60, 740);
    enemy.dp0 = { x: enemy.x, y: enemy.y };
    enemy.dp1 = { x: enemy.x + side * 90, y: enemy.y + 160 };
    enemy.dp2 = { x: targetX, y: 420 };
    enemy.dp3 = { x: targetX + (Math.random() * 80 - 40), y: 660 };
    enemy.diveDur = Math.max(1.3, 2.3 - g.level * 0.06);
    enemy.fireTimer = 0.5 + Math.random() * 0.5;
  }

  function startReturn(enemy, S) {
    var side = enemy.col % 2 === 0 ? -1 : 1;
    enemy.state = 'returning';
    enemy.retStart = S.stageTime;
    enemy.rp0 = { x: enemy.x, y: enemy.y };
    enemy.rp1 = { x: enemy.formX + side * 160, y: 640 };
    enemy.rp2 = { x: enemy.formX + side * 80, y: -30 };
    enemy.rp3 = { x: enemy.formX, y: enemy.formY };
    enemy.retDur = 1.6;
  }

  function startBeamDive(g, enemy) {
    var S = g.state;
    enemy.state = 'beamDive';
    enemy.diveStart = S.stageTime;
    var targetX = clamp(S.player.x, 90, 710);
    enemy.dp0 = { x: enemy.x, y: enemy.y };
    enemy.dp1 = { x: enemy.x + (Math.random() * 160 - 80), y: 180 };
    enemy.dp2 = { x: targetX + (Math.random() * 60 - 30), y: 260 };
    enemy.dp3 = { x: targetX, y: 300 };
    enemy.diveDur = 1.1;
    S.beamCooldownTimer = 9 + Math.random() * 4;
  }

  function fireAimedShot(g, enemy) {
    var S = g.state;
    var dx = S.player.x - enemy.x, dy = PLAYER_Y - enemy.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = ENEMY_SHOT_BASE_SPEED + g.level * 8;
    S.enemyShots.push({ x: enemy.x, y: enemy.y, vx: dx / len * spd, vy: dy / len * spd, w: 4, h: 4 });
    g.audio.play('laser');
  }

  function updateFormationEnemies(g, dt) {
    var S = g.state;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (!e.alive) continue;

      if (e.state === 'formation') {
        var introEnd = e.introDelay + e.introDur;
        if (S.stageTime < introEnd) {
          if (S.stageTime < e.introDelay) { e.x = e.p0.x; e.y = e.p0.y; }
          else {
            var it = (S.stageTime - e.introDelay) / e.introDur;
            var ipos = bezierPoint(e.p0, e.p1, e.p2, e.p3, it);
            e.x = ipos.x; e.y = ipos.y;
          }
        } else {
          var swayX = Math.sin(S.stageTime * 0.9 + e.row * 0.3) * 10;
          var swayY = Math.cos(S.stageTime * 0.6 + e.row * 0.2) * 3;
          e.x = e.formX + swayX; e.y = e.formY + swayY;
        }
      } else if (e.state === 'diving') {
        var t = clamp((S.stageTime - e.diveStart) / e.diveDur, 0, 1);
        var pos = bezierPoint(e.dp0, e.dp1, e.dp2, e.dp3, t);
        e.x = pos.x; e.y = pos.y;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && t < 0.85) { fireAimedShot(g, e); e.fireTimer = 0.7 + Math.random() * 0.8; }
        if (t >= 1) startReturn(e, S);
      } else if (e.state === 'returning') {
        var rt = clamp((S.stageTime - e.retStart) / e.retDur, 0, 1);
        var rpos = bezierPoint(e.rp0, e.rp1, e.rp2, e.rp3, rt);
        e.x = rpos.x; e.y = rpos.y;
        if (rt >= 1) e.state = 'formation';
      } else if (e.state === 'beamDive') {
        var bt = clamp((S.stageTime - e.diveStart) / e.diveDur, 0, 1);
        var bpos = bezierPoint(e.dp0, e.dp1, e.dp2, e.dp3, bt);
        e.x = bpos.x; e.y = bpos.y;
        if (bt >= 1) { e.state = 'beamHover'; e.hoverStart = S.stageTime; e.hoverDur = 1.3; }
      } else if (e.state === 'beamHover') {
        e.x = e.dp3.x; e.y = e.dp3.y;
        if (!S.dual && S.capturedShipEnemy === null && S.player.invuln <= 0) {
          var apexY = e.y + 12, bottomY = 600;
          if (PLAYER_Y >= apexY) {
            var frac = Math.min(1, (PLAYER_Y - apexY) / (bottomY - apexY));
            var halfW = 14 + (70 - 14) * frac;
            if (Math.abs(S.player.x - e.x) <= halfW) triggerCapture(g, e);
          }
        }
        if (S.stageTime - e.hoverStart >= e.hoverDur) {
          var side2 = e.col % 2 === 0 ? -1 : 1;
          e.state = 'beamReturn';
          e.retStart = S.stageTime;
          e.rp0 = { x: e.x, y: e.y };
          e.rp1 = { x: e.x + side2 * 100, y: e.y - 140 };
          e.rp2 = { x: e.formX - side2 * 60, y: e.formY - 100 };
          e.rp3 = { x: e.formX, y: e.formY };
          e.retDur = 1.4;
        }
      } else if (e.state === 'beamReturn') {
        var bret = clamp((S.stageTime - e.retStart) / e.retDur, 0, 1);
        var brpos = bezierPoint(e.rp0, e.rp1, e.rp2, e.rp3, bret);
        e.x = brpos.x; e.y = brpos.y;
        if (bret >= 1) e.state = 'formation';
      }
    }
  }

  function spawnDiveGroup(g) {
    var S = g.state;
    var canBeam = S.beamCooldownTimer <= 0 && S.capturedShipEnemy === null && !S.dual;
    if (canBeam) {
      var bossCandidates = S.enemies.filter(function (e) {
        return e.alive && e.type === 'boss' && e.state === 'formation' && !e.hasCapturedShip;
      });
      if (bossCandidates.length && Math.random() < 0.55) {
        startBeamDive(g, bossCandidates[Math.floor(Math.random() * bossCandidates.length)]);
        return;
      }
    }
    var pool = S.enemies.filter(function (e) { return e.alive && e.state === 'formation'; });
    if (!pool.length) return;
    var chosen = [];
    var carrier = pool.filter(function (e) { return e.hasCapturedShip; })[0];
    if (carrier && Math.random() < 0.8) chosen.push(carrier);
    var count = 1 + Math.floor(Math.random() * 3);
    var remaining = pool.filter(function (e) { return e !== carrier; });
    while (chosen.length < count && remaining.length) {
      var idx = Math.floor(Math.random() * remaining.length);
      chosen.push(remaining.splice(idx, 1)[0]);
    }
    for (var i = 0; i < chosen.length; i++) startDive(g, chosen[i]);
  }

  function updateDiveSpawner(g, dt) {
    var S = g.state;
    if (introActive(S)) return;
    S.diveTimer -= dt;
    S.beamCooldownTimer -= dt;
    if (S.diveTimer <= 0) {
      spawnDiveGroup(g);
      S.diveTimer = Math.max(1.0, 3.2 - g.level * 0.15) * (0.75 + Math.random() * 0.5);
    }
  }

  // ---- challenge stage ----------------------------------------------------------

  function spawnChallengeEnemy(g) {
    var S = g.state, C = S.challenge;
    var dir = C.waveIndex % 2 === 0 ? 1 : -1;
    var startX = dir > 0 ? -30 : 830;
    var baseY = 90 + (C.spawnedInWave % C.enemiesPerWave) * 55;
    C.waveEnemies.push({
      x: startX, y: baseY, startX: startX, baseY: baseY, dir: dir,
      speed: 170 + g.level * 4, t: 0,
      freq: 2.2 + Math.random() * 0.6, amp: 34 + Math.random() * 18,
      phase: Math.random() * 6.28,
      w: 24, h: 18, alive: true
    });
  }

  function updateChallengeStage(g, dt) {
    var S = g.state, C = S.challenge;
    C.spawnTimer -= dt;
    if (C.spawnedInWave < C.enemiesPerWave && C.spawnTimer <= 0) {
      spawnChallengeEnemy(g);
      C.spawnedInWave++;
      C.totalSpawned++;
      C.spawnTimer = C.spawnInterval;
    }
    for (var i = C.waveEnemies.length - 1; i >= 0; i--) {
      var e = C.waveEnemies[i];
      e.t += dt;
      e.x = e.startX + e.dir * e.speed * e.t;
      e.y = e.baseY + Math.sin(e.t * e.freq + e.phase) * e.amp;
      if ((e.dir > 0 && e.x > 840) || (e.dir < 0 && e.x < -40)) {
        C.waveEnemies.splice(i, 1);
        C.totalEscaped++;
      }
    }
    if (C.spawnedInWave >= C.enemiesPerWave && C.waveEnemies.length === 0) {
      C.waveIndex++;
      if (C.waveIndex >= C.wavesTotal) endChallengeStage(g);
      else C.spawnedInWave = 0;
    }
  }

  function endChallengeStage(g) {
    var S = g.state, C = S.challenge;
    C.active = false;
    var perfect = C.totalKilled === C.totalSpawned && C.totalEscaped === 0 && C.totalSpawned > 0;
    if (perfect) {
      g.addScore(1000);
      g.fx.text(400, 280, 'PERFECT +1000', { color: GOLD, size: 13 });
      g.audio.play('highscore');
    }
    advanceStage(g);
  }

  // ---- collisions -----------------------------------------------------------------

  function handleFormationKill(g, e) {
    var S = g.state;
    var divingish = e.state !== 'formation';
    if (e.hasCapturedShip && divingish && !S.dual) rescueCapturedShip(g, e);

    if (e.type === 'boss' && e.health > 1) {
      e.health--;
      e.damaged = true;
      g.audio.play('hit');
      g.fx.burst(e.x, e.y, { color: ACCENT, count: 10, speed: 120, life: 0.35, size: 2 });
      return;
    }
    e.alive = false;
    var base = enemyBasePoints(e.type);
    var pts = divingish ? base * 2 : base;
    g.addScore(pts);
    g.fx.text(e.x, e.y - 10, '+' + pts, { color: GOLD, size: 10 });
    g.audio.play(e.type === 'boss' ? 'bigExplode' : 'explode');
    g.fx.burst(e.x, e.y, {
      color: SECONDARY,
      count: e.type === 'boss' ? 26 : 14,
      speed: 160, life: 0.5,
      size: e.type === 'boss' ? 4 : 3
    });
    if (e.type === 'boss') g.fx.shake(5, 0.2);
  }

  function updateCollisions(g, dt) {
    var S = g.state;
    var challengeMode = S.challenge.active;
    var enemyList = challengeMode ? S.challenge.waveEnemies : S.enemies;

    // player shots vs enemies
    for (var i = S.playerShots.length - 1; i >= 0; i--) {
      var b = S.playerShots[i];
      var hit = false;
      for (var j = 0; j < enemyList.length; j++) {
        var e = enemyList[j];
        if (!e.alive) continue;
        if (overlap(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
          hit = true;
          if (challengeMode) {
            e.alive = false;
            S.challenge.waveEnemies.splice(j, 1);
            S.challenge.totalKilled++;
            g.addScore(100);
            g.fx.text(e.x, e.y - 8, '+100', { color: GOLD, size: 9 });
            g.audio.play('hit');
            g.fx.burst(e.x, e.y, { color: SECONDARY, count: 12, speed: 140, life: 0.4, size: 3 });
          } else {
            handleFormationKill(g, e);
          }
          break;
        }
      }
      if (hit) S.playerShots.splice(i, 1);
    }

    // enemy shots vs player
    var half = PLAYER_HALF_W + (S.dual ? DUAL_GAP : 0);
    for (var k = S.enemyShots.length - 1; k >= 0; k--) {
      var s = S.enemyShots[k];
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < -20 || s.x > FIELD_W + 20 || s.y < -20 || s.y > FIELD_H + 20) {
        S.enemyShots.splice(k, 1);
        continue;
      }
      if (overlap(s.x - 2, s.y - 2, 4, 4, S.player.x - half, PLAYER_Y - 11, half * 2, 22)) {
        S.enemyShots.splice(k, 1);
        playerHit(g);
      }
    }

    // ramming (diving-ish formation enemies only; challenge stage is a safe bonus round)
    if (!challengeMode) {
      for (var m = 0; m < S.enemies.length; m++) {
        var em = S.enemies[m];
        if (!em.alive || em.state === 'formation') continue;
        if (overlap(em.x - em.w / 2, em.y - em.h / 2, em.w, em.h, S.player.x - half, PLAYER_Y - 11, half * 2, 22)) {
          em.alive = false;
          g.fx.burst(em.x, em.y, { color: SECONDARY, count: 14, speed: 150, life: 0.4, size: 3 });
          g.audio.play('explode');
          playerHit(g);
        }
      }
    }
  }

  function checkStageClear(g) {
    var S = g.state;
    if (S.challenge.active) return;
    var aliveCount = 0;
    for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].alive) aliveCount++;
    if (aliveCount === 0) advanceStage(g);
  }

  // ---- stars ------------------------------------------------------------------

  function updateStars(S, dt) {
    for (var i = 0; i < S.stars.length; i++) {
      var st = S.stars[i];
      st.y += st.speed * dt;
      if (st.y > FIELD_H) { st.y = -2; st.x = Math.random() * FIELD_W; }
    }
  }

  // ---- render helpers -----------------------------------------------------------

  function drawShip(ctx, x, y, color, glow) {
    ctx.save();
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x - 13, y + 11);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x + 13, y + 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBee(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x, y + h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10,10,20,0.55)';
    ctx.fillRect(x - w * 0.16, y - h * 0.16, w * 0.32, h * 0.32);
  }

  function drawButterfly(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2.6, -h / 2.6, w / 1.3, h / 1.3);
    ctx.restore();
    ctx.fillStyle = 'rgba(10,10,20,0.5)';
    ctx.fillRect(x - w * 0.12, y - h * 0.12, w * 0.24, h * 0.24);
  }

  function drawBoss(ctx, x, y, w, h, color, damaged) {
    ctx.save();
    if (damaged) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 6);
    ctx.lineTo(x + w / 3, y + h / 2);
    ctx.lineTo(x - w / 3, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = NEUTRAL;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawDockedShip(ctx, x, y) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawShip(ctx, x, y + 20, ACCENT, false);
    ctx.restore();
  }

  function drawBeamCone(ctx, e, stageTime) {
    var apexY = e.y + 12, bottomY = 600;
    var apexHalf = 14, bottomHalf = 70;
    var pulse = 0.22 + Math.sin(stageTime * 9) * 0.08;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = SECONDARY;
    ctx.beginPath();
    ctx.moveTo(e.x - apexHalf, apexY);
    ctx.lineTo(e.x + apexHalf, apexY);
    ctx.lineTo(e.x + bottomHalf, bottomY);
    ctx.lineTo(e.x - bottomHalf, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- boot -----------------------------------------------------------------------

  GZ.boot({
    slug: 'galaxy-raiders',
    touchLayout: 'lr-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['←/→ or A/D', 'Move'], ['SPACE', 'Fire']],
    state: {},

    init: function (g) {
      var S = g.state;
      S.stars = [];
      for (var i = 0; i < 70; i++) {
        S.stars.push({ x: Math.random() * FIELD_W, y: Math.random() * FIELD_H, speed: 20 + Math.random() * 70, size: Math.random() < 0.15 ? 2 : 1 });
      }
      S.challenge = { active: false, waveEnemies: [] };
      S.enemyShots = [];
      resetPlayer(S);
      g.setLives(3);
      g.setLevel(1);
      setupFormationStage(g);
    },

    update: function (g, dt) {
      var S = g.state;
      S.stageTime += dt;
      updateStars(S, dt);
      updatePlayer(g, dt);

      if (S.challenge.active) {
        updateChallengeStage(g, dt);
      } else {
        updateFormationEnemies(g, dt);
        updateDiveSpawner(g, dt);
      }

      updateCollisions(g, dt);

      if (!S.challenge.active) checkStageClear(g);
    },

    render: function (g, ctx) {
      var S = g.state;

      // starfield
      ctx.fillStyle = NEUTRAL;
      for (var i = 0; i < S.stars.length; i++) {
        var st = S.stars[i];
        ctx.globalAlpha = st.size > 1 ? 0.8 : 0.35;
        ctx.fillRect(st.x, st.y, st.size, st.size);
      }
      ctx.globalAlpha = 1;

      var attract = g.phase === 'ready';

      // formation / diving enemies
      var enemyList = S.challenge.active ? S.challenge.waveEnemies : S.enemies;
      for (var j = 0; j < enemyList.length; j++) {
        var e = enemyList[j];
        if (!e.alive) continue;
        var rx = attract && e.formX !== undefined ? e.formX : e.x;
        var ry = attract && e.formY !== undefined ? e.formY : e.y;

        if (e.state === 'beamHover') drawBeamCone(ctx, e, S.stageTime);

        if (e.type === 'boss') {
          drawBoss(ctx, rx, ry, e.w, e.h, e.damaged ? ACCENT : SECONDARY, e.damaged);
          if (e.hasCapturedShip) drawDockedShip(ctx, rx, ry);
        } else if (e.type === 'butterfly') {
          drawButterfly(ctx, rx, ry, e.w, e.h, SECONDARY);
        } else {
          drawBee(ctx, rx, ry, e.w, e.h, SECONDARY);
        }
      }

      // player shots
      for (var p = 0; p < S.playerShots.length; p++) {
        var b = S.playerShots[p];
        ctx.save();
        ctx.shadowColor = ACCENT; ctx.shadowBlur = 8;
        ctx.fillStyle = ACCENT;
        ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        ctx.restore();
      }

      // enemy shots
      ctx.save();
      ctx.shadowColor = SECONDARY; ctx.shadowBlur = 6;
      ctx.fillStyle = SECONDARY;
      for (var q = 0; q < S.enemyShots.length; q++) {
        var s = S.enemyShots[q];
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // player ship(s) — blink while invulnerable
      var visible = S.player.invuln <= 0 || Math.floor(S.player.invuln * 10) % 2 === 0;
      if (visible) {
        drawShip(ctx, S.player.x - (S.dual ? DUAL_GAP : 0), PLAYER_Y, ACCENT, true);
        if (S.dual) drawShip(ctx, S.player.x + DUAL_GAP, PLAYER_Y, ACCENT, true);
      }

      // challenge stage banner
      if (S.challenge.active) {
        g.draw.text(ctx, 'CHALLENGE STAGE', 400, 30, { size: 12, color: GOLD, align: 'center', glow: true });
        g.draw.text(ctx, S.challenge.totalKilled + ' / ' + S.challenge.totalSpawned + ' DESTROYED', 400, 48, { size: 8, color: NEUTRAL, align: 'center' });
      }

      // stage badge
      g.draw.text(ctx, 'STAGE ' + g.level, 788, 590, { size: 8, color: ACCENT, align: 'right' });
    }
  });
})();
