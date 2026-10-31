/*!
 * games/knight-flyer/game.js
 * Knight Flyer — inspired by Joust (1982).
 *
 * Flap physics (each A press is one upward impulse, gravity always pulls
 * down), joust resolution by mount height on collision, eggs that hatch if
 * left too long, and a pterodactyl that punishes dawdling. Single IIFE,
 * only touches the `g` handle, every motion scaled by dt.
 */
(function () {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0; return Math.sqrt(dx * dx + dy * dy); }
  function wrapX(o, r) { if (o.x < -r) o.x = 800 + r; else if (o.x > 800 + r) o.x = -r; }

  // ---- arena --------------------------------------------------------------
  var PLATFORMS = [
    { x: 30, y: 560, w: 140, h: 14 },   // left floor ledge
    { x: 630, y: 560, w: 140, h: 14 },  // right floor ledge
    { x: 330, y: 460, w: 140, h: 14 },  // center-low
    { x: 70, y: 340, w: 110, h: 14 },   // left-mid
    { x: 620, y: 340, w: 110, h: 14 },  // right-mid
    { x: 350, y: 195, w: 100, h: 14 }   // top-center
  ];
  var LAVA_TOP = 585;

  function landOnPlatform(e, radius, prevY) {
    var bottomPrev = prevY + radius, bottomNow = e.y + radius;
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = PLATFORMS[i];
      if (e.x + radius > p.x && e.x - radius < p.x + p.w) {
        if (e.vy >= 0 && bottomPrev <= p.y + 1 && bottomNow >= p.y) return p;
      }
    }
    return null;
  }

  // ---- tunables -------------------------------------------------------
  var GRAVITY = 620;
  var FLAP_IMPULSE = 250;
  var MAX_RISE = 300;
  var MAX_FALL = 420;
  var AIR_ACCEL = 340;
  var AIR_DRAG = 1.4;
  var MAX_VX = 210;
  var RIDER_RADIUS = 13;

  var LAVA_GRAB_WINDOW = 0.45;
  var RESPAWN_DELAY = 1.2;
  var SPAWN_INVULN = 2.0;
  var JOUST_MARGIN = 9;

  var EGG_LIFETIME = 8.5;
  var EGG_RADIUS = 8;

  var TIERS = {
    bounder: { color: '#ff3355', points: 500, speed: 90 },
    hunter: { color: '#a9a9c0', points: 750, speed: 130 },
    shadowlord: { color: '#00a8ff', points: 1500, speed: 175 }
  };
  var TIER_UP = { bounder: 'hunter', hunter: 'shadowlord', shadowlord: 'shadowlord' };

  var PTERO_DAWDLE = 25;
  var PTERO_REPEAT = 17;
  var PTERO_SPEED = 300;

  function spawnPlatform() { return PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]; }

  function spawnRider(S, tier) {
    var p = spawnPlatform();
    S.riders.push({
      x: clamp(p.x + rand(10, p.w - 10), 20, 780), y: p.y - RIDER_RADIUS - 1,
      vx: rand(-1, 1) * 60, vy: 0, tier: tier,
      flapTimer: rand(0.3, 1.1), wanderTimer: rand(1, 2.4),
      targetY: rand(120, 430), hoverTimer: rand(0.5, 1.5)
    });
  }

  function tierWeights(level) {
    var w = { bounder: Math.max(1, 6 - level), hunter: Math.min(5, level), shadowlord: Math.max(0, level - 3) };
    return w;
  }

  function pickTier(level) {
    var w = tierWeights(level);
    var total = w.bounder + w.hunter + w.shadowlord;
    var r = Math.random() * total;
    if (r < w.bounder) return 'bounder';
    r -= w.bounder;
    if (r < w.hunter) return 'hunter';
    return 'shadowlord';
  }

  function spawnWaveRiders(g) {
    var S = g.state;
    var count = clamp(3 + g.level, 3, 8);
    S.ridersToSpawn = count;
    S.riders.length = 0;
    for (var i = 0; i < count; i++) spawnRider(S, pickTier(g.level));
  }

  function spawnEgg(S, x, y, tier) {
    S.eggs.push({ x: x, y: y, vx: rand(-40, 40), vy: -80, tier: tier, life: EGG_LIFETIME });
  }

  function killPlayer(g) {
    var S = g.state, p = S.player;
    if (!p.alive) return;
    p.alive = false;
    S.deathsThisWave++;
    S.respawnTimer = RESPAWN_DELAY;
    g.audio.play('bigExplode');
    g.fx.shake(9, 0.45);
    g.fx.burst(p.x, p.y, { color: '#ffe600', count: 24, speed: 180, life: 0.8, size: 3 });
    g.setLives(g.lives - 1);
    if (g.lives <= 0) g.gameOver();
  }

  function respawnPlayer(g) {
    var S = g.state, p = S.player;
    var home = PLATFORMS[0];
    p.x = home.x + home.w / 2; p.y = home.y - RIDER_RADIUS - 2;
    p.vx = 0; p.vy = 0;
    p.alive = true; p.invuln = SPAWN_INVULN;
    p.lavaGrab = false; p.lavaGrabTimer = 0;
  }

  GZ.boot({
    slug: 'knight-flyer',
    touchLayout: 'lr-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [
      ['←/→', 'Air control'],
      ['SPACE / Z', 'Flap (one press = one flap)']
    ],
    state: {},

    init: function (g) {
      var S = g.state;
      S.player = { x: 100, y: 500, vx: 0, vy: 0, alive: true, invuln: SPAWN_INVULN, lavaGrab: false, lavaGrabTimer: 0 };
      S.riders = [];
      S.eggs = [];
      S.pterodactyl = null;
      S.ptero2ndTimer = 0;
      S.respawnTimer = 0;
      S.deathsThisWave = 0;
      S.waveTimer = 0;
      S.waveTransitionTimer = 0;
      S.ptSpawnedThisWave = false;
      g.setLives(3);
      g.setLevel(1);
      spawnWaveRiders(g);
    },

    update: function (g, dt) {
      var S = g.state, input = g.input, p = S.player;

      // ================= player =================
      if (p.alive) {
        if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

        var dir = 0;
        if (input.isDown('left')) dir -= 1;
        if (input.isDown('right')) dir += 1;
        if (dir !== 0) p.vx += dir * AIR_ACCEL * dt;
        var dragF = Math.max(0, 1 - AIR_DRAG * dt);
        p.vx *= dragF;
        p.vx = clamp(p.vx, -MAX_VX, MAX_VX);

        if (input.pressed('a')) {
          p.vy = Math.max(-MAX_RISE, p.vy - FLAP_IMPULSE);
          g.audio.play('jump');
          if (p.lavaGrab) {
            p.lavaGrab = false;
            p.invuln = Math.max(p.invuln, 0.8);
            g.fx.burst(p.x, p.y, { color: '#ff8a00', count: 14, speed: 140, life: 0.4, size: 2 });
            g.audio.play('powerup');
          }
        }

        p.vy = clamp(p.vy + GRAVITY * dt, -MAX_RISE, MAX_FALL);

        var prevY = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        wrapX(p, RIDER_RADIUS);

        var land = landOnPlatform(p, RIDER_RADIUS, prevY);
        if (land) { p.y = land.y - RIDER_RADIUS; p.vy = 0; }
        if (p.y < 20) { p.y = 20; p.vy = 0; }

        if (p.lavaGrab) {
          p.lavaGrabTimer -= dt;
          if (p.lavaGrabTimer <= 0) { killPlayer(g); }
        } else if (p.y + RIDER_RADIUS > LAVA_TOP && !land) {
          p.lavaGrab = true;
          p.lavaGrabTimer = LAVA_GRAB_WINDOW;
          g.audio.play('warp');
          g.fx.text(p.x, p.y - 16, 'FLAP!', { color: '#ff8a00', size: 10 });
        }
      } else {
        S.respawnTimer -= dt;
        if (S.respawnTimer <= 0) respawnPlayer(g);
      }

      // ================= riders =================
      for (var i = S.riders.length - 1; i >= 0; i--) {
        var r = S.riders[i];
        var def = TIERS[r.tier];
        // Altitude-seeking flight: each rider holds a cruise height and flaps
        // whenever it sinks below it, flapping urgently near the lava. (The
        // old coin-flip-on-a-slow-timer AI lost to gravity and every enemy
        // drowned itself.) Tiers differ in how crisply they hold altitude.
        r.hoverTimer -= dt;
        if (r.hoverTimer <= 0) {
          var wantY = (r.tier === 'hunter' && p.alive) ? p.y : rand(110, 430);
          r.targetY = clamp(wantY + rand(-40, 40), 60, LAVA_TOP - 130);
          r.hoverTimer = rand(1.2, 2.6);
        }
        r.flapTimer -= dt;
        if (r.flapTimer <= 0) {
          var urgent = r.y + RIDER_RADIUS > LAVA_TOP - 90;
          if (urgent || r.y > r.targetY) {
            r.vy = Math.max(-MAX_RISE, r.vy - FLAP_IMPULSE * rand(0.85, 1.1));
          }
          var cadence = r.tier === 'shadowlord' ? rand(0.10, 0.20) : (r.tier === 'hunter' ? rand(0.14, 0.26) : rand(0.18, 0.34));
          r.flapTimer = urgent ? 0.09 : cadence;
        }
        r.wanderTimer -= dt;
        if (r.tier === 'hunter' && p.alive) {
          r.vx += Math.sign(p.x - r.x) * def.speed * 0.9 * dt;
        } else if (r.tier === 'shadowlord') {
          if (r.wanderTimer <= 0) { r.vx = rand(-1, 1) * def.speed; r.wanderTimer = rand(0.4, 0.9); }
          if (p.alive && Math.random() < 0.02) r.vx += Math.sign(p.x - r.x) * def.speed * 0.4;
        } else {
          if (r.wanderTimer <= 0) { r.vx = rand(-1, 1) * def.speed * 0.7; r.wanderTimer = rand(1, 2.4); }
        }
        r.vx = clamp(r.vx, -def.speed, def.speed);
        r.vy = clamp(r.vy + GRAVITY * dt, -MAX_RISE, MAX_FALL);

        var prevRY = r.y;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        wrapX(r, RIDER_RADIUS);

        var rLand = landOnPlatform(r, RIDER_RADIUS, prevRY);
        if (rLand) { r.y = rLand.y - RIDER_RADIUS; r.vy = 0; }
        if (r.y < 20) { r.y = 20; r.vy = 0; }
        if (r.y + RIDER_RADIUS > LAVA_TOP && !rLand) {
          // enemies aren't clever enough to escape the lava
          g.fx.burst(r.x, r.y, { color: def.color, count: 10, speed: 120, life: 0.4, size: 2 });
          S.riders.splice(i, 1);
        }
      }

      // ================= eggs =================
      for (i = S.eggs.length - 1; i >= 0; i--) {
        var e = S.eggs[i];
        e.vy = clamp(e.vy + GRAVITY * dt, -9999, MAX_FALL);
        var prevEY = e.y;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        wrapX(e, EGG_RADIUS);
        var eLand = landOnPlatform(e, EGG_RADIUS, prevEY);
        if (eLand) {
          e.y = eLand.y - EGG_RADIUS;
          e.vy = -Math.abs(e.vy) * 0.4;
          e.vx *= 0.7;
          if (Math.abs(e.vy) < 60) e.vy = 0;
        }
        if (e.y + EGG_RADIUS > LAVA_TOP && !eLand) { S.eggs.splice(i, 1); continue; }
        e.life -= dt;
        if (e.life <= 0) {
          var nextTier = TIER_UP[e.tier];
          spawnRider(S, nextTier);
          var hatched = S.riders[S.riders.length - 1];
          hatched.x = e.x; hatched.y = e.y;
          g.audio.play('die');
          g.fx.burst(e.x, e.y, { color: TIERS[nextTier].color, count: 12, speed: 130, life: 0.4, size: 2 });
          S.eggs.splice(i, 1);
        }
      }

      // ================= pterodactyl =================
      S.waveTimer += dt;
      var waveDone = S.riders.length === 0 && S.ridersToSpawn > 0;
      if (!waveDone) {
        if (!S.ptSpawnedThisWave && S.waveTimer > PTERO_DAWDLE) {
          spawnPterodactyl(S);
          S.ptSpawnedThisWave = true;
          S.ptero2ndTimer = PTERO_REPEAT;
        } else if (S.ptSpawnedThisWave && !S.pterodactyl) {
          S.ptero2ndTimer -= dt;
          if (S.ptero2ndTimer <= 0) { spawnPterodactyl(S); S.ptero2ndTimer = PTERO_REPEAT; }
        }
      }
      if (S.pterodactyl) {
        var pt = S.pterodactyl;
        pt.x += pt.vx * dt;
        pt.traveled += Math.abs(pt.vx) * dt;
        if (pt.traveled > 900) S.pterodactyl = null;
      }

      // ================= collisions: player vs riders (joust) =================
      if (p.alive && p.invuln <= 0) {
        for (i = S.riders.length - 1; i >= 0; i--) {
          r = S.riders[i];
          if (dist(p.x, p.y, r.x, r.y) < RIDER_RADIUS * 1.6) {
            var diff = p.y - r.y; // negative = player higher
            if (diff < -JOUST_MARGIN) {
              // player wins
              g.addScore(TIERS[r.tier].points);
              g.fx.text(r.x, r.y, '+' + TIERS[r.tier].points, { color: '#ffe600', size: 11 });
              g.fx.burst(r.x, r.y, { color: TIERS[r.tier].color, count: 16, speed: 160, life: 0.5, size: 3 });
              g.audio.play('hit');
              spawnEgg(S, r.x, r.y, r.tier);
              S.riders.splice(i, 1);
              p.vy = Math.min(p.vy, -120);
            } else if (diff > JOUST_MARGIN) {
              killPlayer(g);
              break;
            } else {
              // bounce apart
              var pushDir = p.x < r.x ? -1 : 1;
              p.vx += pushDir * 140;
              r.vx -= pushDir * 140;
              p.vy = -160;
              g.audio.play('bounce');
            }
          }
        }
      }

      // player vs eggs (collect)
      if (p.alive) {
        for (i = S.eggs.length - 1; i >= 0; i--) {
          e = S.eggs[i];
          if (dist(p.x, p.y, e.x, e.y) < RIDER_RADIUS + EGG_RADIUS) {
            g.addScore(250);
            g.fx.text(e.x, e.y - 10, '+250', { color: '#ffe600', size: 10 });
            g.fx.burst(e.x, e.y, { color: '#ffe600', count: 10, speed: 120, life: 0.4, size: 2 });
            g.audio.play('pickup');
            S.eggs.splice(i, 1);
          }
        }
      }

      // player vs pterodactyl
      if (p.alive && p.invuln <= 0 && S.pterodactyl) {
        pt = S.pterodactyl;
        if (dist(p.x, p.y, pt.x, pt.y) < RIDER_RADIUS + 16) {
          var headOn = (p.vx > 20 && pt.vx < 0) || (p.vx < -20 && pt.vx > 0);
          if (headOn) {
            g.addScore(1000);
            g.fx.text(pt.x, pt.y, '+1000', { color: '#ffe600', size: 12 });
            g.fx.burst(pt.x, pt.y, { color: '#a94dff', count: 22, speed: 180, life: 0.6, size: 3 });
            g.audio.play('explode');
            S.pterodactyl = null;
          } else {
            killPlayer(g);
          }
        }
      }

      // ================= wave clear =================
      if (S.riders.length === 0 && S.eggs.length === 0 && !S.pterodactyl && S.ridersToSpawn > 0) {
        if (S.waveTransitionTimer <= 0) {
          S.waveTransitionTimer = 2.0;
          if (S.deathsThisWave === 0) {
            g.addScore(3000);
            g.fx.flash('#39ff6a', 0.2);
            g.fx.text(400, 260, 'FLAWLESS +3000', { color: '#39ff6a', size: 13 });
            g.audio.play('levelup');
          } else {
            g.audio.play('levelup');
            g.fx.text(400, 260, 'WAVE CLEAR', { color: '#ffe600', size: 13 });
          }
        } else {
          S.waveTransitionTimer -= dt;
          if (S.waveTransitionTimer <= 0) {
            g.setLevel(g.level + 1);
            S.deathsThisWave = 0;
            S.waveTimer = 0;
            S.ptSpawnedThisWave = false;
            spawnWaveRiders(g);
          }
        }
      }
    },

    render: function (g, ctx) {
      var S = g.state, p = S.player;

      // lava
      ctx.save();
      var flick = Math.sin(g.time * 6) * 6;
      var grad = ctx.createLinearGradient(0, LAVA_TOP, 0, 600);
      grad.addColorStop(0, '#ff8a00');
      grad.addColorStop(1, '#ff3355');
      ctx.fillStyle = grad;
      ctx.fillRect(0, LAVA_TOP + flick * 0.3, 800, 600 - LAVA_TOP);
      ctx.restore();

      // platforms
      for (var i = 0; i < PLATFORMS.length; i++) {
        var pf = PLATFORMS[i];
        ctx.fillStyle = '#12121c';
        ctx.fillRect(pf.x, pf.y, pf.w, pf.h);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2;
        ctx.strokeRect(pf.x, pf.y, pf.w, pf.h);
      }

      // eggs
      for (i = 0; i < S.eggs.length; i++) {
        var e = S.eggs[i];
        ctx.fillStyle = TIERS[e.tier].color;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, EGG_RADIUS * 0.75, EGG_RADIUS, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // riders
      for (i = 0; i < S.riders.length; i++) {
        var r = S.riders[i];
        drawMount(g, ctx, r.x, r.y, TIERS[r.tier].color, r.vx < 0 ? -1 : 1);
      }

      // pterodactyl
      if (S.pterodactyl) {
        var pt = S.pterodactyl;
        g.draw.glow(ctx, '#a94dff', 12, function () {
          ctx.fillStyle = '#a94dff';
          ctx.beginPath();
          ctx.moveTo(pt.x - 26 * Math.sign(pt.vx || 1), pt.y);
          ctx.lineTo(pt.x, pt.y - 10);
          ctx.lineTo(pt.x + 26 * Math.sign(pt.vx || 1), pt.y);
          ctx.lineTo(pt.x, pt.y + 8);
          ctx.closePath();
          ctx.fill();
        });
      }

      // player
      if (p.alive) {
        var blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
        if (!blink) drawMount(g, ctx, p.x, p.y, '#ffe600', p.vx < 0 ? -1 : 1);
      }

      if (S.waveTransitionTimer <= 0 && S.ridersToSpawn > 0) {
        g.draw.text(ctx, 'WAVE ' + g.level + '  ·  RIDERS LEFT ' + S.riders.length, 400, 26, { size: 9, color: '#ffe600', align: 'center' });
      }
    }
  });

  function drawMount(g, ctx, x, y, color, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    g.draw.glow(ctx, color, 8, function () {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-9, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(-14, -10);
    ctx.moveTo(-3, 3);
    ctx.lineTo(-14, 10);
    ctx.stroke();
    ctx.restore();
  }

  function spawnPterodactyl(S) {
    var fromLeft = Math.random() < 0.5;
    S.pterodactyl = {
      x: fromLeft ? -30 : 830, y: rand(120, 420),
      vx: (fromLeft ? 1 : -1) * PTERO_SPEED,
      traveled: 0
    };
  }
})();
