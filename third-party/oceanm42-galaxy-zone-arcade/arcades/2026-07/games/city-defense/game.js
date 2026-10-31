/*!
 * games/city-defense/game.js
 * City Defense — inspired by Missile Command (1980).
 *
 * Three missile batteries defend six cities. The crosshair follows the
 * pointer; a click/tap fires one interceptor from the nearest battery with
 * ammo toward that point. Interceptors detonate into an expanding-then-
 * contracting blossom that destroys any incoming warhead whose head enters
 * it — including chain-reaction blossoms from warheads killed mid-blossom.
 */
(function () {
  'use strict';

  var GROUND_Y = 560;
  var SLOT_COUNT = 9;
  var SLOT_MARGIN = 46;
  var SLOT_W = (800 - SLOT_MARGIN * 2) / (SLOT_COUNT - 1);
  // 0:battery 1:city 2:city 3:city 4:battery 5:city 6:city 7:city 8:battery
  var BATTERY_SLOTS = [0, 4, 8];
  var CITY_SLOTS = [1, 2, 3, 5, 6, 7];
  var BATTERY_AMMO_MAX = 10;

  var BLOSSOM_MAX_R = 70;
  var BLOSSOM_EXPAND_T = 0.22;
  var BLOSSOM_HOLD_T = 0.08;
  var BLOSSOM_CONTRACT_T = 0.32;

  var ACCENT = '#ff3355';
  var SECONDARY = '#00f0ff';

  var WAVE_TINTS = ['#ff8a00', '#ff3355', '#a94dff', '#39ff6a', '#ffe600'];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function dist(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0; return Math.sqrt(dx * dx + dy * dy); }

  function slotX(i) { return SLOT_MARGIN + i * SLOT_W; }

  function waveMultiplier(wave) { return Math.min(6, 1 + Math.floor((wave - 1) / 2)); }
  function waveTint(wave) { return WAVE_TINTS[(wave - 1) % WAVE_TINTS.length]; }

  function makeCities() {
    return CITY_SLOTS.map(function (slot) { return { slot: slot, x: slotX(slot), alive: true }; });
  }
  function makeBatteries() {
    return BATTERY_SLOTS.map(function (slot, i) {
      return { slot: slot, x: slotX(slot), alive: true, ammo: BATTERY_AMMO_MAX, speed: i === 1 ? 560 : 380 };
    });
  }

  function aliveCities(S) { return S.cities.filter(function (c) { return c.alive; }); }

  function findTargetSlot(S, x) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < S.cities.length; i++) {
      var c = S.cities[i];
      var d = Math.abs(c.x - x);
      if (d < bestD) { bestD = d; best = c; }
    }
    for (var j = 0; j < S.batteries.length; j++) {
      var b = S.batteries[j];
      var d2 = Math.abs(b.x - x);
      if (d2 < bestD) { bestD = d2; best = b; }
    }
    return best;
  }

  function spawnWarhead(g, fromBomber) {
    var S = g.state;
    var startX = fromBomber ? fromBomber.x : Math.random() * 700 + 50;
    var target = findTargetSlot(S, Math.random() * 700 + 50);
    if (!target) target = { x: 400 };
    var targetX = target.x + (Math.random() * 30 - 15);
    var speed = Math.min(260, 60 + S.wave * 9);
    var d = dist(startX, 0, targetX, GROUND_Y);
    var isSmart = S.wave >= 3 && Math.random() < Math.min(0.3, 0.06 + S.wave * 0.018);
    var canMirv = !isSmart && S.wave >= 2 && Math.random() < Math.min(0.32, 0.05 + S.wave * 0.03);
    S.warheads.push({
      x: startX, y: 0, targetX: targetX, targetY: GROUND_Y,
      vx: (targetX - startX) / d * speed, vy: GROUND_Y / d * speed,
      speed: speed, trail: [], type: isSmart ? 'smart' : 'warhead',
      canMirv: canMirv, mirvAt: canMirv ? (0.35 + Math.random() * 0.3) * GROUND_Y : -1,
      hasMirved: false, age: Math.random() * 10, points: isSmart ? 125 : 25
    });
  }

  function spawnMirvChildren(g, parent) {
    var S = g.state;
    var count = 2 + (Math.random() < 0.4 ? 1 : 0);
    for (var i = 0; i < count; i++) {
      var spread = (i - (count - 1) / 2) * 55;
      var targetX = clamp(parent.targetX + spread, 30, 770);
      var d = dist(parent.x, parent.y, targetX, GROUND_Y);
      S.warheads.push({
        x: parent.x, y: parent.y, targetX: targetX, targetY: GROUND_Y,
        vx: (targetX - parent.x) / d * parent.speed, vy: (GROUND_Y - parent.y) / d * parent.speed,
        speed: parent.speed, trail: [], type: 'warhead',
        canMirv: false, mirvAt: -1, hasMirved: true, age: 0, points: 25
      });
    }
    g.audio.play('hit');
  }

  function spawnBomber(g) {
    var S = g.state;
    var fromLeft = Math.random() < 0.5;
    var isSat = Math.random() < 0.4;
    S.bombers.push({
      x: fromLeft ? -30 : 830, y: isSat ? 86 : 130,
      vx: (fromLeft ? 1 : -1) * (isSat ? 130 : 95),
      dropTimer: 0.5, type: isSat ? 'satellite' : 'bomber'
    });
  }

  function fireInterceptor(g, tx, ty) {
    var S = g.state;
    var best = null, bestD = Infinity;
    for (var i = 0; i < S.batteries.length; i++) {
      var b = S.batteries[i];
      if (!b.alive || b.ammo <= 0) continue;
      var d = Math.abs(b.x - tx);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) { g.audio.play('click'); return; }
    best.ammo--;
    var d2 = dist(best.x, GROUND_Y - 20, tx, ty);
    S.interceptors.push({
      x: best.x, y: GROUND_Y - 20, targetX: tx, targetY: ty,
      vx: (tx - best.x) / d2 * best.speed, vy: (ty - (GROUND_Y - 20)) / d2 * best.speed
    });
    g.audio.play('shoot');
  }

  function spawnBlossom(g, x, y, maxR) {
    g.state.blossoms.push({ x: x, y: y, maxR: maxR, t: 0, phase: 'expand' });
  }

  function killWarhead(g, w, idx) {
    var S = g.state;
    var pts = w.points * S.waveMult;
    g.addScore(pts);
    g.fx.burst(w.x, w.y, { color: w.type === 'smart' ? '#ffe600' : waveTint(S.wave), count: 16, speed: 180, life: 0.45, size: 3 });
    g.fx.text(w.x, w.y - 10, '+' + pts, { color: '#ffe600', size: 9 });
    g.audio.play('explode');
    spawnBlossom(g, w.x, w.y, BLOSSOM_MAX_R * 0.55);
    S.warheads.splice(idx, 1);
  }

  function killBomber(g, b, idx) {
    var S = g.state;
    var pts = 100 * S.waveMult;
    g.addScore(pts);
    g.fx.burst(b.x, b.y, { color: '#ffe600', count: 24, speed: 220, life: 0.5, size: 4 });
    g.fx.text(b.x, b.y - 10, '+' + pts, { color: '#ffe600', size: 10 });
    g.audio.play('bigExplode');
    S.bombers.splice(idx, 1);
  }

  function destroyStructureAt(g, x, y) {
    var S = g.state;
    var slotIdx = Math.round((x - SLOT_MARGIN) / SLOT_W);
    var sx = slotX(clamp(slotIdx, 0, SLOT_COUNT - 1));
    var i;
    for (i = 0; i < S.cities.length; i++) {
      var c = S.cities[i];
      if (c.alive && Math.abs(c.x - sx) < SLOT_W / 2) {
        c.alive = false;
        g.fx.shake(9, 0.35);
        g.audio.play('bigExplode');
        g.fx.burst(c.x, GROUND_Y - 10, { color: ACCENT, count: 26, speed: 200, life: 0.6, size: 4 });
        return;
      }
    }
    for (i = 0; i < S.batteries.length; i++) {
      var b = S.batteries[i];
      if (b.alive && Math.abs(b.x - sx) < SLOT_W / 2) {
        b.alive = false;
        b.ammo = 0;
        g.fx.shake(9, 0.35);
        g.audio.play('bigExplode');
        g.fx.burst(b.x, GROUND_Y - 10, { color: ACCENT, count: 26, speed: 200, life: 0.6, size: 4 });
        return;
      }
    }
    // Hit an empty gap: just a crater.
    g.fx.burst(x, GROUND_Y, { color: '#8a8a8a', count: 10, speed: 100, life: 0.4, size: 2 });
  }

  function startWaveIntro(g) {
    var S = g.state;
    S.waveState = 'intro';
    S.introTimer = 1.7;
    S.waveMult = waveMultiplier(S.wave);
    g.setLevel(S.wave);
    g.fx.text(400, 250, 'WAVE ' + S.wave, { color: waveTint(S.wave), size: 18 });
    if (S.waveMult > 1) g.fx.text(400, 280, 'x' + S.waveMult + ' SCORE', { color: '#ffe600', size: 10 });
  }

  function beginTally(g) {
    var S = g.state;
    S.waveState = 'tally';
    S.tallyQueue = [];
    var i;
    for (i = 0; i < S.batteries.length; i++) {
      var ammo = S.batteries[i].ammo;
      for (var k = 0; k < ammo; k++) S.tallyQueue.push(5);
    }
    var survivors = aliveCities(S).length;
    for (i = 0; i < survivors; i++) S.tallyQueue.push(100);
    S.tallyTimer = 0;
  }

  GZ.boot({
    slug: 'city-defense',
    touchLayout: 'aim-tap',
    hud: ['score', 'level'],
    controlsHelp: [['MOUSE / TOUCH', 'Aim crosshair'], ['CLICK / TAP', 'Fire nearest battery']],
    state: {},

    init: function (g) {
      var S = g.state;
      S.wave = 1;
      S.waveMult = 1;
      g.setLevel(1);
      S.cities = makeCities();
      S.batteries = makeBatteries();
      S.interceptors = [];
      S.warheads = [];
      S.blossoms = [];
      S.bombers = [];
      S.spawnTimer = 0.6;
      S.spawnedCount = 0;
      S.spawnBudget = 8;
      S.bomberTimer = 8;
      S.nextCityBonus = 10000;
      S.endTimer = 0;
      S.tallyQueue = [];
      S.tallyTimer = 0;
      S.tallyPause = 0;
      startWaveIntro(g);
      S.spawnBudget = 6 + S.wave * 2;
    },

    update: function (g, dt) {
      var S = g.state;
      var input = g.input;
      var i;

      if (S.waveState === 'gameover') {
        S.endTimer -= dt;
        if (S.endTimer <= 0) g.gameOver();
        return;
      }

      if (S.waveState === 'intro') {
        S.introTimer -= dt;
        if (S.introTimer <= 0) S.waveState = 'active';
        return;
      }

      if (S.waveState === 'tally') {
        S.tallyTimer -= dt;
        if (S.tallyTimer <= 0 && S.tallyQueue.length > 0) {
          S.tallyTimer = 0.05;
          var batch = Math.min(3, S.tallyQueue.length);
          var sum = 0;
          for (i = 0; i < batch; i++) sum += S.tallyQueue.shift();
          g.addScore(sum);
          g.audio.play('coin');
        } else if (S.tallyQueue.length === 0) {
          S.tallyPause -= dt;
          if (S.tallyPause <= 0) {
            S.batteries.forEach(function (b) { if (b.alive) b.ammo = BATTERY_AMMO_MAX; });
            S.wave++;
            S.warheads = []; S.bombers = []; S.interceptors = []; S.blossoms = [];
            S.spawnedCount = 0;
            S.spawnBudget = 6 + S.wave * 2;
            S.spawnTimer = 0.5;
            S.bomberTimer = Math.max(4, 9 - S.wave * 0.3);
            startWaveIntro(g);
          }
        }
        return;
      }

      // ---- 'active' / 'clearing' ----
      if (input.pointer.pressed) fireInterceptor(g, input.pointer.x, input.pointer.y);

      if (S.waveState === 'active') {
        S.spawnTimer -= dt;
        if (S.spawnTimer <= 0 && S.spawnedCount < S.spawnBudget) {
          S.spawnTimer = Math.max(0.35, 1.5 - S.wave * 0.06);
          spawnWarhead(g);
          S.spawnedCount++;
        }
        if (S.wave >= 2) {
          S.bomberTimer -= dt;
          if (S.bomberTimer <= 0) {
            spawnBomber(g);
            S.bomberTimer = Math.max(5, 12 - S.wave * 0.4) + Math.random() * 4;
          }
        }
        if (S.spawnedCount >= S.spawnBudget) S.waveState = 'clearing';
      }

      // Interceptors.
      for (i = S.interceptors.length - 1; i >= 0; i--) {
        var ic = S.interceptors[i];
        ic.x += ic.vx * dt; ic.y += ic.vy * dt;
        if (dist(ic.x, ic.y, ic.targetX, ic.targetY) < 10) {
          spawnBlossom(g, ic.targetX, ic.targetY, BLOSSOM_MAX_R);
          g.audio.play('bounce');
          S.interceptors.splice(i, 1);
        }
      }

      // Blossoms.
      for (i = S.blossoms.length - 1; i >= 0; i--) {
        var bl = S.blossoms[i];
        bl.t += dt;
        if (bl.phase === 'expand') {
          if (bl.t >= BLOSSOM_EXPAND_T) { bl.phase = 'hold'; bl.t = 0; }
        } else if (bl.phase === 'hold') {
          if (bl.t >= BLOSSOM_HOLD_T) { bl.phase = 'contract'; bl.t = 0; }
        } else {
          if (bl.t >= BLOSSOM_CONTRACT_T) { S.blossoms.splice(i, 1); continue; }
        }
      }
      function blossomRadius(bl) {
        if (bl.phase === 'expand') return bl.maxR * (bl.t / BLOSSOM_EXPAND_T);
        if (bl.phase === 'hold') return bl.maxR;
        return bl.maxR * (1 - bl.t / BLOSSOM_CONTRACT_T);
      }

      // Warheads.
      for (i = S.warheads.length - 1; i >= 0; i--) {
        var w = S.warheads[i];
        w.age += dt;
        var stepX = w.vx * dt, stepY = w.vy * dt;
        w.x += stepX; w.y += stepY;
        if (w.type === 'smart') w.x += Math.sin(w.age * 7) * 26 * dt;
        w.trail.push({ x: w.x, y: w.y });
        if (w.trail.length > 9) w.trail.shift();

        if (w.canMirv && !w.hasMirved && w.y >= w.mirvAt) {
          w.hasMirved = true;
          spawnMirvChildren(g, w);
          S.warheads.splice(i, 1);
          continue;
        }

        var destroyed = false;
        for (var bi = 0; bi < S.blossoms.length; bi++) {
          var blossom = S.blossoms[bi];
          var r = blossomRadius(blossom);
          var dd = dist(w.x, w.y, blossom.x, blossom.y);
          var threshold = w.type === 'smart' ? r * 0.3 : r;
          if (dd < threshold) { killWarhead(g, w, i); destroyed = true; break; }
        }
        if (destroyed) continue;

        if (w.y >= GROUND_Y) {
          destroyStructureAt(g, w.x, w.y);
          S.warheads.splice(i, 1);
        }
      }

      // Bombers / satellites.
      for (i = S.bombers.length - 1; i >= 0; i--) {
        var b = S.bombers[i];
        b.x += b.vx * dt;
        b.dropTimer -= dt;
        if (b.dropTimer <= 0) {
          b.dropTimer = 1.1 + Math.random() * 0.5;
          spawnWarhead(g, b);
        }
        var killedBomber = false;
        for (var bj = 0; bj < S.blossoms.length; bj++) {
          var bl2 = S.blossoms[bj];
          if (dist(b.x, b.y, bl2.x, bl2.y) < blossomRadius(bl2)) { killBomber(g, b, i); killedBomber = true; break; }
        }
        if (killedBomber) continue;
        if (b.x < -60 || b.x > 860) S.bombers.splice(i, 1);
      }

      // Bonus city every 10,000.
      while (g.score >= S.nextCityBonus) {
        S.nextCityBonus += 10000;
        var ruined = S.cities.filter(function (c) { return !c.alive; })[0];
        if (ruined) {
          ruined.alive = true;
          g.fx.flash('#39ff6a', 0.2);
          g.audio.play('levelup');
          g.fx.text(ruined.x, GROUND_Y - 40, 'BONUS CITY', { color: '#39ff6a', size: 10 });
        }
      }

      // Game over: all cities gone.
      if (aliveCities(S).length === 0 && S.waveState !== 'gameover') {
        S.waveState = 'gameover';
        S.endTimer = 2.4;
        g.fx.shake(14, 0.6);
        g.audio.play('gameover');
        return;
      }

      // Wave clear.
      if (S.waveState === 'clearing' && S.warheads.length === 0 && S.bombers.length === 0) {
        beginTally(g);
      }
    },

    render: function (g, ctx) {
      var S = g.state;
      var i;

      // Ground.
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(0, GROUND_Y, 800, 600 - GROUND_Y);
      ctx.strokeStyle = 'rgba(255,51,85,0.3)';
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(800, GROUND_Y); ctx.stroke();

      // Cities.
      for (i = 0; i < S.cities.length; i++) {
        var c = S.cities[i];
        if (!c.alive) {
          ctx.fillStyle = 'rgba(90,90,100,0.35)';
          ctx.fillRect(c.x - 16, GROUND_Y - 8, 32, 8);
          continue;
        }
        g.draw.glow(ctx, ACCENT, 6, function () {
          ctx.fillStyle = ACCENT;
          ctx.fillRect(c.x - 18, GROUND_Y - 22, 10, 22);
          ctx.fillRect(c.x - 5, GROUND_Y - 30, 10, 30);
          ctx.fillRect(c.x + 8, GROUND_Y - 18, 10, 18);
        });
      }

      // Batteries.
      for (i = 0; i < S.batteries.length; i++) {
        var b = S.batteries[i];
        if (!b.alive) {
          ctx.fillStyle = 'rgba(90,90,100,0.35)';
          ctx.beginPath(); ctx.arc(b.x, GROUND_Y - 6, 14, Math.PI, 0); ctx.fill();
          continue;
        }
        g.draw.glow(ctx, SECONDARY, 8, function () {
          ctx.fillStyle = SECONDARY;
          ctx.beginPath(); ctx.arc(b.x, GROUND_Y, 16, Math.PI, 0); ctx.fill();
        });
        var pipsPerRow = 5;
        for (var p = 0; p < b.ammo; p++) {
          var row = Math.floor(p / pipsPerRow), col = p % pipsPerRow;
          ctx.fillStyle = '#eaf6ff';
          ctx.fillRect(b.x - 12 + col * 5, GROUND_Y - 26 - row * 6, 3, 4);
        }
      }

      // Warhead trails + heads.
      for (i = 0; i < S.warheads.length; i++) {
        var w = S.warheads[i];
        var tint = w.type === 'smart' ? '#ffe600' : waveTint(S.wave);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (var t = 0; t < w.trail.length; t++) {
          var p = w.trail[t];
          if (t === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        g.draw.glow(ctx, tint, 10, function () {
          ctx.fillStyle = tint;
          ctx.beginPath(); ctx.arc(w.x, w.y, w.type === 'smart' ? 4 : 3.5, 0, Math.PI * 2); ctx.fill();
        });
      }

      // Bombers.
      for (i = 0; i < S.bombers.length; i++) {
        var bmb = S.bombers[i];
        g.draw.glow(ctx, '#ffe600', 8, function () {
          ctx.fillStyle = '#ffe600';
          ctx.fillRect(bmb.x - 14, bmb.y - 5, 28, 10);
        });
      }

      // Interceptors.
      ctx.strokeStyle = SECONDARY;
      ctx.lineWidth = 2;
      for (i = 0; i < S.interceptors.length; i++) {
        var ic = S.interceptors[i];
        ctx.beginPath();
        ctx.moveTo(ic.x - ic.vx * 0.03, ic.y - ic.vy * 0.03);
        ctx.lineTo(ic.x, ic.y);
        ctx.stroke();
      }

      // Blossoms.
      for (i = 0; i < S.blossoms.length; i++) {
        var bl = S.blossoms[i];
        var r = bl.phase === 'expand' ? bl.maxR * (bl.t / BLOSSOM_EXPAND_T)
          : bl.phase === 'hold' ? bl.maxR
          : bl.maxR * (1 - bl.t / BLOSSOM_CONTRACT_T);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath(); ctx.arc(bl.x, bl.y, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = SECONDARY;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bl.x, bl.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
      }

      // Crosshair.
      var ptr = g.input.pointer;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ptr.x - 11, ptr.y); ctx.lineTo(ptr.x - 3, ptr.y);
      ctx.moveTo(ptr.x + 3, ptr.y); ctx.lineTo(ptr.x + 11, ptr.y);
      ctx.moveTo(ptr.x, ptr.y - 11); ctx.lineTo(ptr.x, ptr.y - 3);
      ctx.moveTo(ptr.x, ptr.y + 3); ctx.lineTo(ptr.x, ptr.y + 11);
      ctx.stroke();

      // City count readout (cities ARE the lives).
      g.draw.text(ctx, 'CITIES ' + aliveCities(S).length + '/6', 12, 24, { size: 10, color: '#eaf6ff' });

      if (S.waveState === 'intro') {
        g.draw.text(ctx, 'WAVE ' + S.wave, 400, 260, { size: 24, color: waveTint(S.wave), align: 'center', glow: true });
      } else if (S.waveState === 'tally') {
        g.draw.text(ctx, 'WAVE CLEAR', 400, 260, { size: 18, color: '#ffe600', align: 'center', glow: true });
      } else if (S.waveState === 'gameover') {
        g.draw.text(ctx, 'THE END', 400, 300, { size: 40, color: ACCENT, align: 'center', glow: true });
      }
    }
  });
})();
