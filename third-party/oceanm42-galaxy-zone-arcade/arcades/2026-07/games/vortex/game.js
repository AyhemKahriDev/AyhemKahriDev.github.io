/*!
 * games/vortex/game.js
 * Vortex — a pseudo-3D tube shooter inspired by Tempest (1981). The player
 * rides the near rim of a glowing wireframe well and fires down into its
 * depths at enemies climbing up 16 lanes toward the rim.
 *
 * Geometry: every level is a well made of 16 rim points. Closed wells
 * (circle/square/plus) wrap lane-to-lane; open wells (V/line) stop at the
 * ends. Each lane is the quad between two adjacent rim points and their
 * scaled-down far-end counterparts, so the whole thing reads as a tube
 * receding toward a vanishing point slightly above screen center.
 *
 * NOTE on the attract screen: `g.time` only advances while `phase ===
 * 'playing'` (see docs/ENGINE.md §4), so a purely time-driven idle rotation
 * during the 'ready' phase has no engine-provided clock to read. `render()`
 * uses `Date.now()` — a standard, non-DOM JS builtin (same category as
 * `Math`), not one of the banned browser/storage APIs — purely as a
 * cosmetic, read-only animation source for the idle well rotation and title
 * glow. It never feeds game logic, scoring, or persisted state.
 */
(function () {
  'use strict';

  // ---- geometry --------------------------------------------------------
  var CENTER = { x: 400, y: 284 };
  var VANISH = { x: 400, y: 232 };
  var RX = 210, RY = 118;
  var FAR_SCALE = 0.14;
  var POINTS = 16;

  var SHAPES = ['circle', 'square', 'plus', 'v', 'line'];
  var SCHEMES = [
    { well: '#00f0ff', player: '#ffe600' },
    { well: '#ff3355', player: '#39ff6a' },
    { well: '#ffe600', player: '#00f0ff' },
    { well: '#a94dff', player: '#ff3355' },
    { well: '#39ff6a', player: '#ff2ec4' }
  ];
  var ENEMY_COLOR = '#ff8a00';
  var FUSE_COLOR = '#ffe600';
  var SPIKE_COLOR = '#ff3355';
  var BOLT_COLOR = '#eaf6ff';

  var LANE_SLIDE_TIME = 0.06;
  var LANE_MOVE_REPEAT = 0.09;
  var BOLT_SPEED = 3.1;       // t-units per second (rim=1 -> far=0)
  var BOLT_COOLDOWN = 0.11;
  var MAX_BOLTS = 8;
  var HIT_TOL_EXTRA = 0.05;

  var WARP_DURATION = 2.0;
  var DEATH_FREEZE = 1.0;
  var RESPAWN_INVULN = 1.3;
  var SPIKE_DANGER_T = 0.45;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpPt(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
  function midPt(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // ---- well construction -------------------------------------------------

  function resamplePath(corners, closed, n) {
    var segs = [], total = 0, i;
    var segCount = closed ? corners.length : corners.length - 1;
    for (i = 0; i < segCount; i++) {
      var a = corners[i], b = corners[(i + 1) % corners.length];
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a: a, b: b, len: len, start: total });
      total += len;
    }
    var pts = [];
    for (var k = 0; k < n; k++) {
      var target = closed ? (k / n) * total : (k / (n - 1)) * total;
      var chosen = segs[segs.length - 1], localT = 1;
      for (var s = 0; s < segs.length; s++) {
        if (target <= segs[s].start + segs[s].len + 1e-9) {
          chosen = segs[s];
          localT = chosen.len > 0 ? (target - chosen.start) / chosen.len : 0;
          break;
        }
      }
      localT = clamp(localT, 0, 1);
      pts.push({ x: chosen.a.x + (chosen.b.x - chosen.a.x) * localT, y: chosen.a.y + (chosen.b.y - chosen.a.y) * localT });
    }
    return pts;
  }

  function unitPointsFor(shape) {
    if (shape === 'circle') {
      var pts = [];
      for (var i = 0; i < POINTS; i++) {
        var ang = (i / POINTS) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: Math.cos(ang), y: Math.sin(ang) });
      }
      return { closed: true, pts: pts };
    }
    if (shape === 'square') {
      return { closed: true, pts: resamplePath([{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }], true, POINTS) };
    }
    if (shape === 'plus') {
      var a = 0.42;
      var corners = [
        { x: -a, y: -1 }, { x: a, y: -1 }, { x: a, y: -a }, { x: 1, y: -a },
        { x: 1, y: a }, { x: a, y: a }, { x: a, y: 1 }, { x: -a, y: 1 },
        { x: -a, y: a }, { x: -1, y: a }, { x: -1, y: -a }, { x: -a, y: -a }
      ];
      return { closed: true, pts: resamplePath(corners, true, POINTS) };
    }
    if (shape === 'v') {
      return { closed: false, pts: resamplePath([{ x: -1, y: -1 }, { x: 0, y: 1 }, { x: 1, y: -1 }], false, POINTS) };
    }
    // 'line'
    return { closed: false, pts: resamplePath([{ x: -1, y: 0.1 }, { x: 1, y: 0.1 }], false, POINTS) };
  }

  function buildWell(levelIndex) {
    var shape = SHAPES[levelIndex % SHAPES.length];
    var scheme = SCHEMES[levelIndex % SCHEMES.length];
    var unit = unitPointsFor(shape);
    var near = unit.pts.map(function (p) { return { x: CENTER.x + p.x * RX, y: CENTER.y + p.y * RY }; });
    var far = near.map(function (p) { return { x: VANISH.x + (p.x - CENTER.x) * FAR_SCALE, y: VANISH.y + (p.y - CENTER.y) * FAR_SCALE }; });
    var lanes = unit.closed ? POINTS : POINTS - 1;
    return { shape: shape, scheme: scheme, closed: unit.closed, near: near, far: far, lanes: lanes };
  }

  function laneEdgeIdx(well, lane) { return [lane, well.closed ? (lane + 1) % POINTS : lane + 1]; }

  function laneMid(well, laneFloat, t) {
    var lo = Math.floor(laneFloat), frac = laneFloat - lo;
    var hi = well.closed ? (lo + 1) % well.lanes : Math.min(lo + 1, well.lanes - 1);
    var a = laneMidExact(well, lo, t), b = laneMidExact(well, hi, t);
    return lerpPt(a, b, frac);
  }
  function laneMidExact(well, lane, t) {
    var idx = laneEdgeIdx(well, lane);
    var nm = midPt(well.near[idx[0]], well.near[idx[1]]);
    var fm = midPt(well.far[idx[0]], well.far[idx[1]]);
    return lerpPt(fm, nm, t);
  }
  function edgePoint(well, edgeIdx, t) {
    return lerpPt(well.far[edgeIdx], well.near[edgeIdx], t);
  }
  function nextLane(well, lane, dir) {
    if (well.closed) return (lane + dir + well.lanes) % well.lanes;
    return clamp(lane + dir, 0, well.lanes - 1);
  }
  function nextEdge(well, edge, dir) {
    if (well.closed) return (edge + dir + POINTS) % POINTS;
    return clamp(edge + dir, 0, POINTS - 1);
  }
  function laneDelta(well, from, to) {
    var d = to - from;
    if (well.closed) {
      if (d > well.lanes / 2) d -= well.lanes;
      if (d < -well.lanes / 2) d += well.lanes;
    }
    return d;
  }
  /** Shortest-path interpolation around a ring of n slots, normalized into
   *  [0, n). Prevents a flip crossing the seam (e.g. lane 15 -> lane 0 on a
   *  closed 16-lane well) from sweeping the long way around the rim. */
  function lerpWrapped(from, to, p, n) {
    var d = to - from;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    var v = from + d * p;
    return ((v % n) + n) % n;
  }
  /** Fractional lane during a flip: seam-safe on closed wells, plain lerp on
   *  open wells (which have no seam to cross). */
  function lerpLane(well, from, to, p) {
    return well.closed ? lerpWrapped(from, to, p, well.lanes) : lerp(from, to, p);
  }
  /** Same for rim-point edges (fuseballs ride edges, of which there are
   *  POINTS even on open wells). */
  function lerpEdge(well, from, to, p) {
    return well.closed ? lerpWrapped(from, to, p, POINTS) : lerp(from, to, p);
  }
  /** The lane flanked by two adjacent edges — at the seam, edges N-1 and 0
   *  flank lane N-1, not lane 0. */
  function laneBetweenEdges(a, b) {
    return Math.abs(a - b) > 1 ? Math.max(a, b) : Math.min(a, b);
  }

  // ---- spawn composition -------------------------------------------------

  function weightedPick(table) {
    var total = 0, i;
    for (i = 0; i < table.length; i++) total += table[i].w;
    var r = Math.random() * total;
    for (i = 0; i < table.length; i++) { r -= table[i].w; if (r <= 0) return table[i].k; }
    return table[0].k;
  }

  function buildSpawnQueue(level) {
    var n = Math.min(30, 8 + level * 2);
    var table = [
      { k: 'flipper', w: clamp(38 + level * 1.8, 38, 58) },
      { k: 'fuseball', w: clamp(10 + level * 2.2, 10, 34) },
      { k: 'tanker', w: clamp(26 - level * 1.2, 10, 26) },
      { k: 'spiker', w: 16 }
    ];
    var queue = [], spikerCount = 0;
    for (var i = 0; i < n; i++) {
      var k = weightedPick(table);
      if (k === 'spiker') {
        if (spikerCount >= 4) { k = 'flipper'; } else { spikerCount++; }
      }
      queue.push(k);
    }
    return queue;
  }

  // ---- enemy factories ----------------------------------------------------

  function spawnEnemy(g, type, lane) {
    var S = g.state;
    var e = { type: type, lane: lane, t: 0, dead: false };
    if (type === 'flipper') {
      e.flipTimer = 1.2 + Math.random() * 1.2;
      e.flipping = false; e.flipFrom = lane; e.flipTo = lane; e.flipProg = 0;
      e.atRim = false;
    } else if (type === 'tanker') {
      // straight climber, no lane changes
    } else if (type === 'spiker') {
      e.phase = 'climb';
    } else if (type === 'fuseball') {
      e.edge = laneEdgeIdx(S.well, lane)[0];
      e.flipping = false; e.flipFrom = e.edge; e.flipTo = e.edge; e.flipProg = 0;
      e.flipTimer = 0.8 + Math.random() * 0.8;
      e.atRim = false;
    }
    S.enemies.push(e);
  }

  function enemyScreenPos(well, e) {
    if (e.type === 'fuseball') {
      if (e.flipping) return lerpPt(edgePoint(well, e.flipFrom, e.t), edgePoint(well, e.flipTo, e.t), e.flipProg);
      return edgePoint(well, e.edge, e.t);
    }
    if (e.type === 'flipper' && e.flipping) return laneMid(well, lerpLane(well, e.flipFrom, e.flipTo, e.flipProg), e.t);
    return laneMidExact(well, e.lane, e.t);
  }

  function fuseTBucketPoints(t) { return t > 0.66 ? 250 : (t >= 0.33 ? 500 : 750); }

  function killEnemy(g, idx, viaZapper) {
    var S = g.state;
    var e = S.enemies[idx];
    var pos = enemyScreenPos(S.well, e);
    var pts;
    if (e.type === 'flipper') pts = 150;
    else if (e.type === 'spiker') pts = 50;
    else if (e.type === 'tanker') pts = 100;
    else pts = fuseTBucketPoints(e.t);
    g.addScore(pts);
    g.fx.text(pos.x, pos.y, '+' + pts, { color: e.type === 'fuseball' ? FUSE_COLOR : '#ffe600', size: 9 });
    g.fx.burst(pos.x, pos.y, { color: e.type === 'fuseball' ? FUSE_COLOR : ENEMY_COLOR, count: 18, speed: 190, life: 0.45, size: 3 });
    g.audio.play(e.type === 'tanker' || e.type === 'fuseball' ? 'explode' : 'hit');
    S.enemies.splice(idx, 1);
    if (!viaZapper) checkWaveClear(g);
  }

  function tankerSplit(g, idx) {
    var S = g.state;
    var e = S.enemies[idx];
    var pos = enemyScreenPos(S.well, e);
    g.addScore(100);
    g.fx.text(pos.x, pos.y, '+100', { color: '#ffe600', size: 9 });
    g.fx.burst(pos.x, pos.y, { color: ENEMY_COLOR, count: 22, speed: 200, life: 0.5, size: 4 });
    g.audio.play('explode');
    var laneA = nextLane(S.well, e.lane, -1), laneB = nextLane(S.well, e.lane, 1);
    S.enemies.splice(idx, 1);
    spawnEnemy(g, 'flipper', laneA);
    S.enemies[S.enemies.length - 1].t = e.t;
    spawnEnemy(g, 'flipper', laneB);
    S.enemies[S.enemies.length - 1].t = e.t;
    checkWaveClear(g);
  }

  function checkWaveClear(g) {
    var S = g.state;
    if (S.mode !== 'playing') return;
    var remaining = S.enemies.some(function (e) { return e.type !== 'spiker'; }) || S.spawnQueue.length > 0;
    if (!remaining) startWarp(g);
  }

  function startWarp(g) {
    var S = g.state;
    S.mode = 'warp';
    S.warpTimer = WARP_DURATION;
    g.audio.play('warp');
    g.fx.shake(6, 0.4);
  }

  function nextLevel(g) {
    var S = g.state;
    S.level++;
    g.setLevel(S.level);
    S.well = buildWell(S.level - 1);
    S.spikeHeight = new Array(S.well.lanes).fill(0);
    S.enemies = [];
    S.spawnQueue = buildSpawnQueue(S.level);
    S.spawnTimer = 0.4;
    S.zapsUsed = 0;
    S.player.lane = 0; S.player.visLane = 0; S.player.moveCooldown = 0;
    S.mode = 'playing';
    S.invuln = 0.6;
    g.fx.flash(S.well.scheme.well, 0.25);
    g.audio.play('levelup');
  }

  function respawnPlayer(g) {
    var S = g.state;
    S.player.lane = 0; S.player.visLane = 0;
    S.zapsUsed = 0;
    S.invuln = RESPAWN_INVULN;
    S.freezeTimer = DEATH_FREEZE;
  }

  function killPlayer(g) {
    var S = g.state;
    if (S.invuln > 0) return;
    var pos = laneMidExact(S.well, Math.round(S.player.lane), 1);
    g.fx.burst(pos.x, pos.y, { color: S.well.scheme.player, count: 30, speed: 220, life: 0.6, size: 4 });
    g.fx.shake(14, 0.5);
    g.audio.play('bigExplode');
    var lives = g.lives - 1;
    g.setLives(lives);
    if (lives <= 0) { g.gameOver(); return; }
    respawnPlayer(g);
    if (S.mode === 'warp') S.mode = 'playing'; // re-check clear next frame; invuln covers re-entry
  }

  function fireBolt(g) {
    var S = g.state;
    if (S.bolts.length >= MAX_BOLTS || S.boltCooldown > 0) return;
    S.boltCooldown = BOLT_COOLDOWN;
    S.bolts.push({ lane: Math.round(S.player.lane), t: 1, prevT: 1 });
    g.audio.play('laser');
  }

  function superzapper(g) {
    var S = g.state;
    if (S.zapsUsed >= 2) { g.audio.play('click'); return; }
    S.zapsUsed++;
    g.fx.flash('#ffffff', 0.3);
    g.fx.shake(10, 0.4);
    if (S.zapsUsed === 1) {
      g.audio.play('bigExplode');
      for (var i = S.enemies.length - 1; i >= 0; i--) killEnemy(g, i, true);
      checkWaveClear(g);
    } else if (S.enemies.length > 0) {
      g.audio.play('explode');
      killEnemy(g, Math.floor(Math.random() * S.enemies.length), true);
    }
  }

  // ---- boot ---------------------------------------------------------------

  GZ.boot({
    slug: 'vortex',
    touchLayout: 'lr-ab',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['←/→ or A/D', 'Move around the rim'], ['SPACE', 'Fire'], ['SHIFT/X', 'Superzapper']],
    state: {},

    init: function (g) {
      var S = g.state;
      S.level = 1;
      g.setLevel(1);
      g.setLives(3);
      S.well = buildWell(0);
      S.spikeHeight = new Array(S.well.lanes).fill(0);
      S.player = { lane: 0, visLane: 0, moveCooldown: 0 };
      S.bolts = [];
      S.boltCooldown = 0;
      S.enemies = [];
      S.spawnQueue = buildSpawnQueue(1);
      S.spawnTimer = 0.6;
      S.zapsUsed = 0;
      S.mode = 'playing';
      S.warpTimer = 0;
      S.freezeTimer = 0;
      S.invuln = 0;
      // A few enemies pre-placed for the attract-mode idle view (update()
      // never runs pre-play, so these sit still except for the cosmetic
      // Date.now()-driven bob applied in render() during 'ready').
      spawnEnemy(g, 'flipper', 2); S.enemies[0].t = 0.25;
      spawnEnemy(g, 'fuseball', 7); S.enemies[1].t = 0.5;
      spawnEnemy(g, 'flipper', 11); S.enemies[2].t = 0.7;
      spawnEnemy(g, 'spiker', 14); S.enemies[3].t = 0.35;
    },

    update: function (g, dt) {
      var S = g.state;
      var input = g.input;
      var well = S.well;

      if (S.freezeTimer > 0) {
        S.freezeTimer -= dt;
        if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
        return;
      }
      if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);

      // ---- player lane movement ----
      var dir = 0;
      if (input.isDown('left')) dir = -1; else if (input.isDown('right')) dir = 1;
      if (dir !== 0) {
        S.player.moveCooldown -= dt;
        if (S.player.moveCooldown <= 0) {
          S.player.moveCooldown = LANE_MOVE_REPEAT;
          S.player.lane = nextLane(well, S.player.lane, dir);
          g.audio.play('move');
        }
      } else {
        S.player.moveCooldown = 0;
      }
      var d = laneDelta(well, S.player.visLane, S.player.lane);
      var ease = Math.min(1, dt / LANE_SLIDE_TIME);
      S.player.visLane += d * ease;
      if (well.closed) {
        S.player.visLane = ((S.player.visLane % well.lanes) + well.lanes) % well.lanes;
      }

      // ---- firing ----
      S.boltCooldown -= dt;
      if (input.isDown('a')) fireBolt(g);
      if (input.pressed('b')) superzapper(g);

      // ---- warp sequence ----
      if (S.mode === 'warp') {
        S.warpTimer -= dt;
        var laneNow = Math.round(S.player.lane);
        if (S.invuln <= 0 && S.spikeHeight[laneNow] > SPIKE_DANGER_T) {
          killPlayer(g);
          return;
        }
        if (S.warpTimer <= 0) nextLevel(g);
        return;
      }

      // ---- spawn queue ----
      if (S.spawnQueue.length > 0) {
        S.spawnTimer -= dt;
        if (S.spawnTimer <= 0) {
          S.spawnTimer = clamp(1.6 - S.level * 0.05, 0.5, 1.6);
          var lane = Math.floor(Math.random() * well.lanes);
          spawnEnemy(g, S.spawnQueue.shift(), lane);
        }
      }

      // ---- bolts ----
      for (var bi = S.bolts.length - 1; bi >= 0; bi--) {
        var bolt = S.bolts[bi];
        bolt.prevT = bolt.t;
        bolt.t -= BOLT_SPEED * dt;
        var hitIdx = -1;
        for (var ei = 0; ei < S.enemies.length; ei++) {
          var en = S.enemies[ei];
          var lane = en.type === 'fuseball' ? (en.flipping ? laneBetweenEdges(en.flipFrom, en.flipTo) : -1)
            : (en.flipping ? Math.round(lerpLane(well, en.flipFrom, en.flipTo, en.flipProg)) % well.lanes : en.lane);
          if (lane !== bolt.lane) continue;
          if (en.t <= bolt.prevT + HIT_TOL_EXTRA && en.t >= bolt.t - HIT_TOL_EXTRA) { hitIdx = ei; break; }
        }
        if (hitIdx >= 0) {
          if (S.enemies[hitIdx].type === 'tanker') tankerSplit(g, hitIdx); else killEnemy(g, hitIdx, false);
          S.bolts.splice(bi, 1);
          continue;
        }
        if (bolt.t <= 0) S.bolts.splice(bi, 1);
      }

      // ---- enemies ----
      for (var idx = S.enemies.length - 1; idx >= 0; idx--) {
        var e = S.enemies[idx];
        if (e.type === 'flipper') {
          if (!e.atRim) {
            e.t += (0.15 + S.level * 0.01) * dt;
            if (e.t >= 1) { e.t = 1; e.atRim = true; }
          }
          e.flipTimer -= dt;
          if (e.flipTimer <= 0 && !e.flipping) {
            e.flipping = true; e.flipFrom = e.lane; e.flipProg = 0;
            if (e.atRim) {
              var toward = laneDelta(well, e.lane, S.player.lane);
              e.flipTo = nextLane(well, e.lane, toward >= 0 ? 1 : -1);
            } else {
              e.flipTo = nextLane(well, e.lane, Math.random() < 0.5 ? -1 : 1);
            }
          }
          if (e.flipping) {
            e.flipProg += dt / (e.atRim ? 0.32 : 0.22);
            if (e.flipProg >= 1) {
              e.lane = e.flipTo; e.flipping = false;
              e.flipTimer = e.atRim ? (0.45 + Math.random() * 0.35 - S.level * 0.01) : (1.1 + Math.random() * 1.2);
              e.flipTimer = Math.max(0.28, e.flipTimer);
            }
          }
          if (e.atRim && S.invuln <= 0) {
            var pl = e.flipping ? lerpLane(well, e.flipFrom, e.flipTo, e.flipProg) : e.lane;
            if (Math.abs(laneDelta(well, pl, S.player.lane)) < 0.5) killPlayer(g);
          }
        } else if (e.type === 'tanker') {
          e.t += (0.08 + S.level * 0.004) * dt;
          if (e.t >= 0.5) { tankerSplit(g, idx); continue; }
        } else if (e.type === 'spiker') {
          if (e.phase === 'climb') {
            e.t += 0.5 * dt;
            S.spikeHeight[e.lane] = Math.max(S.spikeHeight[e.lane], Math.min(e.t, 0.85));
            if (e.t >= 0.85) e.phase = 'retreat';
          } else {
            e.t -= 0.8 * dt;
            if (e.t <= 0.02) { e.t = 0; e.phase = 'climb'; }
          }
        } else if (e.type === 'fuseball') {
          if (!e.atRim) {
            if (!e.flipping) {
              e.t += (0.13 + S.level * 0.008) * dt;
              if (e.t >= 1) { e.t = 1; e.atRim = true; }
            }
            e.flipTimer -= dt;
            if (e.flipTimer <= 0 && !e.flipping) {
              e.flipping = true; e.flipFrom = e.edge; e.flipProg = 0;
              e.flipTo = nextEdge(well, e.edge, Math.random() < 0.5 ? -1 : 1);
            }
            if (e.flipping) {
              e.flipProg += dt / 0.3;
              if (e.flipProg >= 1) { e.edge = e.flipTo; e.flipping = false; e.flipTimer = 0.7 + Math.random() * 0.8; }
            }
          } else {
            e.flipTimer -= dt;
            if (e.flipTimer <= 0 && !e.flipping) {
              e.flipping = true; e.flipFrom = e.edge; e.flipProg = 0;
              var towardF = laneDelta(well, e.edge, S.player.lane);
              e.flipTo = nextEdge(well, e.edge, towardF >= 0 ? 1 : -1);
            }
            if (e.flipping) {
              e.flipProg += dt / 0.3;
              if (e.flipProg >= 1) { e.edge = e.flipTo; e.flipping = false; e.flipTimer = 0.4 + Math.random() * 0.4; }
            }
            if (S.invuln <= 0) {
              var fp = e.flipping ? lerpEdge(well, e.flipFrom, e.flipTo, e.flipProg) : e.edge;
              if (Math.abs(laneDelta(well, fp, S.player.lane)) < 0.6) killPlayer(g);
            }
          }
        }
      }

      checkWaveClear(g);
    },

    render: function (g, ctx) {
      var S = g.state;
      var well = S.well;
      var i;
      var idleSpin = 0, idlePulse = 0;
      if (g.phase === 'ready') {
        var wallT = Date.now() / 1000;
        idleSpin = Math.sin(wallT * 0.25) * 0.12;
        idlePulse = (Math.sin(wallT * 2) + 1) / 2;
      }

      var warpZoom = 1;
      if (S.mode === 'warp') {
        var frac = 1 - clamp(S.warpTimer / WARP_DURATION, 0, 1);
        warpZoom = 1 + frac * frac * 7;
      }

      ctx.save();
      ctx.translate(CENTER.x, CENTER.y);
      if (idleSpin) ctx.rotate(idleSpin);
      if (warpZoom !== 1) ctx.scale(warpZoom, warpZoom);
      ctx.translate(-CENTER.x, -CENTER.y);

      // Lane wireframe.
      var wellColor = well.scheme.well;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = wellColor;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      var ringCount = well.closed ? POINTS : POINTS - 1;
      for (i = 0; i < ringCount; i++) {
        var a = well.near[i], b = well.near[(i + 1) % POINTS];
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      for (i = 0; i < ringCount; i++) {
        var fa = well.far[i], fb = well.far[(i + 1) % POINTS];
        ctx.moveTo(fa.x, fa.y); ctx.lineTo(fb.x, fb.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      g.draw.glow(ctx, wellColor, 10, function () {
        ctx.strokeStyle = wellColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var r = 0; r < POINTS; r++) {
          ctx.moveTo(well.near[r].x, well.near[r].y);
          ctx.lineTo(well.far[r].x, well.far[r].y);
        }
        ctx.stroke();
      });

      // Highlight the player's current lane.
      var hiLane = Math.round(S.player.lane);
      var hiIdx = laneEdgeIdx(well, hiLane);
      g.draw.glow(ctx, well.scheme.player, 14, function () {
        ctx.fillStyle = well.scheme.player;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.moveTo(well.near[hiIdx[0]].x, well.near[hiIdx[0]].y);
        ctx.lineTo(well.near[hiIdx[1]].x, well.near[hiIdx[1]].y);
        ctx.lineTo(well.far[hiIdx[1]].x, well.far[hiIdx[1]].y);
        ctx.lineTo(well.far[hiIdx[0]].x, well.far[hiIdx[0]].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Spikes.
      for (i = 0; i < S.spikeHeight.length; i++) {
        var h = S.spikeHeight[i];
        if (h <= 0) continue;
        var farP = laneMidExact(well, i, 0), tipP = laneMidExact(well, i, h);
        g.draw.glow(ctx, SPIKE_COLOR, 8, function () {
          ctx.strokeStyle = SPIKE_COLOR;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(farP.x, farP.y); ctx.lineTo(tipP.x, tipP.y); ctx.stroke();
        });
      }

      // Enemies.
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        var t = e.t + (g.phase === 'ready' ? idlePulse * 0.06 : 0);
        var pos = enemyScreenPos(well, e);
        var color = e.type === 'fuseball' ? FUSE_COLOR : ENEMY_COLOR;
        g.draw.glow(ctx, color, 9, function () {
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(pos.x, pos.y);
          var s = 4 + t * 5;
          if (e.type === 'flipper') {
            ctx.rotate((e.flipping ? e.flipProg : 0) * Math.PI);
            ctx.beginPath();
            ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
            ctx.closePath(); ctx.fill();
          } else if (e.type === 'tanker') {
            ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
          } else if (e.type === 'spiker') {
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * 0.8, s * 0.8); ctx.lineTo(-s * 0.8, s * 0.8);
            ctx.closePath(); ctx.fill();
          } else {
            ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        });
      }

      // Bolts.
      g.draw.glow(ctx, BOLT_COLOR, 10, function () {
        ctx.fillStyle = BOLT_COLOR;
        for (i = 0; i < S.bolts.length; i++) {
          var bolt = S.bolts[i];
          var p0 = laneMidExact(well, bolt.lane, Math.max(0, bolt.t));
          ctx.beginPath(); ctx.arc(p0.x, p0.y, 3.2, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Player claw.
      if (S.freezeTimer <= 0 || g.phase !== 'playing') {
        var playerPos = laneMid(well, S.player.visLane, 1);
        var outward = { x: playerPos.x - CENTER.x, y: (playerPos.y - CENTER.y) * 1.6 };
        var mag = Math.hypot(outward.x, outward.y) || 1;
        var flicker = S.invuln > 0 ? (Math.sin(Date.now() / 60) > 0 ? 1 : 0.25) : 1;
        ctx.globalAlpha = flicker;
        g.draw.glow(ctx, well.scheme.player, 16, function () {
          ctx.save();
          ctx.translate(playerPos.x, playerPos.y);
          ctx.rotate(Math.atan2(outward.y, outward.x) + Math.PI / 2);
          ctx.fillStyle = well.scheme.player;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(9, 8);
          ctx.lineTo(3, 4);
          ctx.lineTo(0, 9);
          ctx.lineTo(-3, 4);
          ctx.lineTo(-9, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // ---- overlays (not affected by warp zoom / idle spin) ----
      if (g.phase === 'ready') {
        var glowAmt = 0.6 + idlePulse * 0.4;
        ctx.save();
        ctx.globalAlpha = glowAmt;
        g.draw.text(ctx, 'VORTEX', 400, 130, { size: 30, color: well.scheme.player, align: 'center', glow: true });
        ctx.restore();
      }

      if (S.mode === 'warp' && g.phase === 'playing') {
        g.draw.text(ctx, 'WARP', 400, 60, { size: 16, color: '#eaf6ff', align: 'center', glow: true });
      }

      if (S.zapsUsed > 0 && g.phase === 'playing') {
        g.draw.text(ctx, 'ZAPPER ' + (2 - S.zapsUsed) + '/2', 12, 590, { size: 8, color: '#a94dff' });
      }
    }
  });
})();
