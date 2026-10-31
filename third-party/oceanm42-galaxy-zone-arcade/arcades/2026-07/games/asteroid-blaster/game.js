/*!
 * games/asteroid-blaster/game.js
 * Asteroid Blaster — inspired by Asteroids (1979).
 *
 * Ship with real inertia (thrust + gentle drag, no fixed top speed clamp
 * beyond a soft cap) rotates and drifts through a wrapping field. Large
 * rocks split into mediums, mediums split into smalls. Saucers cross the
 * field on a timer. Hyperspace is a risk/reward panic button. Single IIFE,
 * touches nothing but the `g` handle, all motion scaled by dt.
 */
(function () {
  'use strict';

  // ---- tunables -------------------------------------------------------
  var SHIP_RADIUS = 11;
  var ROT_SPEED = 3.4;          // rad/s
  var THRUST_ACCEL = 230;       // px/s^2
  var DRAG = 0.35;              // fraction of velocity bled off per second
  var BRAKE_DRAG = 1.8;         // extra drag while retro-braking
  var MAX_SPEED = 360;

  var FIRE_COOLDOWN = 0.18;
  var MAX_BULLETS = 4;
  var BULLET_SPEED = 480;
  var BULLET_LIFE = 1.1;

  var HYPER_COOLDOWN = 1.0;
  var HYPER_EXPLODE_CHANCE = 0.15;

  var RESPAWN_DELAY = 1.4;
  var SPAWN_INVULN = 2.2;
  var WAVE_PAUSE = 1.8;
  var SAFE_RADIUS = 110; // required clearance from asteroids/saucers to respawn

  var EXTRA_LIFE_STEP = 10000;

  var SIZES = {
    large: { radius: 40, points: 20, speed: [35, 80] },
    medium: { radius: 24, points: 50, speed: [55, 120] },
    small: { radius: 13, points: 100, speed: [85, 165] }
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0; return Math.sqrt(dx * dx + dy * dy); }

  function wrap(o, r) {
    r = r || 0;
    if (o.x < -r) o.x = 800 + r;
    else if (o.x > 800 + r) o.x = -r;
    if (o.y < -r) o.y = 600 + r;
    else if (o.y > 600 + r) o.y = -r;
  }

  function makeAsteroidVerts(radius) {
    var n = 8 + Math.floor(Math.random() * 5);
    var verts = [];
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2;
      var d = radius * (0.7 + Math.random() * 0.35);
      verts.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d });
    }
    return verts;
  }

  function spawnAsteroid(S, size, x, y) {
    var def = SIZES[size];
    var speed = rand(def.speed[0], def.speed[1]);
    var ang = rand(0, Math.PI * 2);
    var pos;
    if (x === undefined) {
      // spawn away from the ship
      do {
        pos = { x: rand(0, 800), y: rand(0, 600) };
      } while (S.ship.alive && dist(pos.x, pos.y, S.ship.x, S.ship.y) < 140);
    } else {
      pos = { x: x, y: y };
    }
    S.asteroids.push({
      x: pos.x, y: pos.y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-1, 1) * 0.9,
      size: size, radius: def.radius, points: def.points,
      verts: makeAsteroidVerts(def.radius)
    });
  }

  function spawnWave(g) {
    var S = g.state;
    var count = 4 + g.level;
    for (var i = 0; i < count; i++) spawnAsteroid(S, 'large');
  }

  function areaClear(S, x, y, r) {
    for (var i = 0; i < S.asteroids.length; i++) {
      var a = S.asteroids[i];
      if (dist(x, y, a.x, a.y) < r + a.radius) return false;
    }
    for (var j = 0; j < S.saucers.length; j++) {
      var s = S.saucers[j];
      if (dist(x, y, s.x, s.y) < r + 60) return false;
    }
    return true;
  }

  function killShip(g) {
    var S = g.state;
    if (!S.ship.alive) return;
    S.ship.alive = false;
    S.respawnTimer = RESPAWN_DELAY;
    g.audio.play('bigExplode');
    g.fx.shake(9, 0.45);
    g.fx.burst(S.ship.x, S.ship.y, { color: '#eaf6ff', count: 26, speed: 190, life: 0.9, size: 3 });
    g.fx.burst(S.ship.x, S.ship.y, { color: '#ff8a00', count: 14, speed: 120, life: 0.6, size: 3 });
    g.setLives(g.lives - 1);
    if (g.lives <= 0) g.gameOver();
  }

  function respawnShip(g) {
    var S = g.state;
    S.ship.x = 400; S.ship.y = 300;
    S.ship.vx = 0; S.ship.vy = 0;
    S.ship.angle = -Math.PI / 2;
    S.ship.alive = true;
    S.ship.invuln = SPAWN_INVULN;
  }

  function splitAsteroid(g, a) {
    g.addScore(a.points);
    g.fx.text(a.x, a.y, '+' + a.points, { color: '#ffe600', size: 11 });
    g.fx.burst(a.x, a.y, { color: '#eaf6ff', count: a.size === 'large' ? 20 : (a.size === 'medium' ? 14 : 9), speed: 150, life: 0.55, size: 3 });
    g.audio.play(a.size === 'small' ? 'hit' : 'explode');
    if (a.size === 'large') { spawnAsteroid(g.state, 'medium', a.x, a.y); spawnAsteroid(g.state, 'medium', a.x, a.y); }
    else if (a.size === 'medium') { spawnAsteroid(g.state, 'small', a.x, a.y); spawnAsteroid(g.state, 'small', a.x, a.y); }
  }

  function spawnSaucer(g) {
    var S = g.state;
    var isSmall = Math.random() < clamp(0.12 + g.level * 0.05, 0.12, 0.6);
    var fromLeft = Math.random() < 0.5;
    var x = fromLeft ? -30 : 830;
    var vx = (fromLeft ? 1 : -1) * (isSmall ? rand(120, 160) : rand(70, 100));
    S.saucers.push({
      x: x, y: rand(80, 520), vx: vx, vy: rand(-30, 30),
      wanderTimer: rand(0.6, 1.4),
      type: isSmall ? 'small' : 'big',
      radius: isSmall ? 12 : 18,
      points: isSmall ? 1000 : 200,
      fireTimer: rand(0.7, 1.4),
      traveled: 0
    });
  }

  function saucerFire(g, s) {
    var S = g.state;
    var ang;
    if (s.type === 'small' && S.ship.alive) {
      var toShip = Math.atan2(S.ship.y - s.y, S.ship.x - s.x);
      var noise = clamp(0.55 - g.level * 0.035, 0.06, 0.55);
      ang = toShip + rand(-noise, noise);
    } else {
      ang = rand(0, Math.PI * 2);
    }
    S.saucerBullets.push({ x: s.x, y: s.y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, life: 2.2 });
    g.audio.play('laser');
  }

  GZ.boot({
    slug: 'asteroid-blaster',
    touchLayout: 'lr-ud-ab',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [
      ['←/→', 'Rotate'],
      ['↑', 'Thrust'],
      ['↓', 'Retro-brake'],
      ['SPACE / Z', 'Fire'],
      ['SHIFT / X', 'Hyperspace']
    ],
    state: {},

    init: function (g) {
      var S = g.state;
      S.ship = { x: 400, y: 300, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true, invuln: SPAWN_INVULN, thrusting: false, braking: false };
      S.bullets = [];
      S.asteroids = [];
      S.saucers = [];
      S.saucerBullets = [];
      S.fireCooldown = 0;
      S.hyperCooldown = 0;
      S.respawnTimer = 0;
      S.waveClearTimer = 0;
      S.saucerSpawnTimer = rand(9, 15);
      S.nextExtraLife = EXTRA_LIFE_STEP;
      g.setLives(3);
      g.setLevel(1);
      spawnWave(g);
    },

    update: function (g, dt) {
      var S = g.state, input = g.input, ship = S.ship;

      if (S.fireCooldown > 0) S.fireCooldown -= dt;
      if (S.hyperCooldown > 0) S.hyperCooldown -= dt;

      // ---- ship control ----
      if (ship.alive) {
        if (ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);

        if (input.isDown('left')) ship.angle -= ROT_SPEED * dt;
        if (input.isDown('right')) ship.angle += ROT_SPEED * dt;

        ship.thrusting = input.isDown('up');
        ship.braking = input.isDown('down');

        if (ship.thrusting) {
          ship.vx += Math.cos(ship.angle) * THRUST_ACCEL * dt;
          ship.vy += Math.sin(ship.angle) * THRUST_ACCEL * dt;
        }

        var dragRate = DRAG + (ship.braking ? BRAKE_DRAG : 0);
        var dragFactor = Math.max(0, 1 - dragRate * dt);
        ship.vx *= dragFactor;
        ship.vy *= dragFactor;

        var spd = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        if (spd > MAX_SPEED) { var k = MAX_SPEED / spd; ship.vx *= k; ship.vy *= k; }

        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(ship, SHIP_RADIUS);

        if (input.pressed('a') && S.fireCooldown <= 0 && S.bullets.length < MAX_BULLETS) {
          S.fireCooldown = FIRE_COOLDOWN;
          S.bullets.push({
            x: ship.x + Math.cos(ship.angle) * SHIP_RADIUS,
            y: ship.y + Math.sin(ship.angle) * SHIP_RADIUS,
            vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.3,
            vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.3,
            life: BULLET_LIFE
          });
          g.audio.play('shoot');
        }

        if (input.pressed('b') && S.hyperCooldown <= 0) {
          S.hyperCooldown = HYPER_COOLDOWN;
          ship.x = rand(30, 770);
          ship.y = rand(30, 570);
          ship.vx = 0; ship.vy = 0;
          if (Math.random() < HYPER_EXPLODE_CHANCE) {
            killShip(g);
          } else {
            ship.invuln = Math.max(ship.invuln, 0.6);
            g.audio.play('warp');
            g.fx.burst(ship.x, ship.y, { color: '#a94dff', count: 16, speed: 160, life: 0.5, size: 3 });
          }
        }
      } else {
        S.respawnTimer -= dt;
        if (S.respawnTimer <= 0 && areaClear(S, 400, 300, SAFE_RADIUS)) {
          respawnShip(g);
        }
      }

      // ---- bullets ----
      for (var bi = S.bullets.length - 1; bi >= 0; bi--) {
        var b = S.bullets[bi];
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        wrap(b, 2);
        if (b.life <= 0) { S.bullets.splice(bi, 1); continue; }
      }

      // ---- asteroids ----
      for (var ai = 0; ai < S.asteroids.length; ai++) {
        var a = S.asteroids[ai];
        a.x += a.vx * dt; a.y += a.vy * dt;
        a.rot += a.rotSpeed * dt;
        wrap(a, a.radius);
      }

      // ---- saucers ----
      S.saucerSpawnTimer -= dt;
      if (S.saucerSpawnTimer <= 0 && S.saucers.length < 2) {
        spawnSaucer(g);
        S.saucerSpawnTimer = rand(11, 18);
      }
      for (var si = S.saucers.length - 1; si >= 0; si--) {
        var s = S.saucers[si];
        s.wanderTimer -= dt;
        if (s.wanderTimer <= 0) { s.vy = rand(-45, 45); s.wanderTimer = rand(0.6, 1.4); }
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.traveled += Math.abs(s.vx) * dt;
        wrap(s, s.radius);
        s.y = clamp(s.y, 20, 580);
        s.fireTimer -= dt;
        if (s.fireTimer <= 0) {
          s.fireTimer = s.type === 'small' ? rand(1.1, 1.9) : rand(0.9, 1.7);
          saucerFire(g, s);
        }
        if (s.traveled > 900) S.saucers.splice(si, 1);
      }

      for (var sbi = S.saucerBullets.length - 1; sbi >= 0; sbi--) {
        var sb = S.saucerBullets[sbi];
        sb.x += sb.vx * dt; sb.y += sb.vy * dt;
        sb.life -= dt;
        wrap(sb, 2);
        if (sb.life <= 0) S.saucerBullets.splice(sbi, 1);
      }

      // ---- collisions: bullets vs asteroids ----
      for (bi = S.bullets.length - 1; bi >= 0; bi--) {
        b = S.bullets[bi];
        var hitA = false;
        for (ai = S.asteroids.length - 1; ai >= 0; ai--) {
          a = S.asteroids[ai];
          if (dist(b.x, b.y, a.x, a.y) < a.radius) {
            S.asteroids.splice(ai, 1);
            splitAsteroid(g, a);
            hitA = true;
            break;
          }
        }
        if (hitA) { S.bullets.splice(bi, 1); continue; }
        // bullets vs saucers
        for (si = S.saucers.length - 1; si >= 0; si--) {
          s = S.saucers[si];
          if (dist(b.x, b.y, s.x, s.y) < s.radius) {
            g.addScore(s.points);
            g.fx.text(s.x, s.y, '+' + s.points, { color: '#ffe600', size: 12 });
            g.fx.burst(s.x, s.y, { color: '#39ff6a', count: 22, speed: 170, life: 0.6, size: 3 });
            g.audio.play('explode');
            S.saucers.splice(si, 1);
            S.bullets.splice(bi, 1);
            break;
          }
        }
      }

      // ---- ship collisions ----
      if (ship.alive && ship.invuln <= 0) {
        for (ai = 0; ai < S.asteroids.length; ai++) {
          a = S.asteroids[ai];
          if (dist(ship.x, ship.y, a.x, a.y) < a.radius + SHIP_RADIUS * 0.7) { killShip(g); break; }
        }
      }
      if (ship.alive && ship.invuln <= 0) {
        for (si = S.saucers.length - 1; si >= 0; si--) {
          s = S.saucers[si];
          if (dist(ship.x, ship.y, s.x, s.y) < s.radius + SHIP_RADIUS * 0.7) {
            g.fx.burst(s.x, s.y, { color: '#39ff6a', count: 16, speed: 150, life: 0.5, size: 3 });
            S.saucers.splice(si, 1);
            killShip(g);
            break;
          }
        }
      }
      if (ship.alive && ship.invuln <= 0) {
        for (sbi = S.saucerBullets.length - 1; sbi >= 0; sbi--) {
          sb = S.saucerBullets[sbi];
          if (dist(ship.x, ship.y, sb.x, sb.y) < SHIP_RADIUS) {
            S.saucerBullets.splice(sbi, 1);
            killShip(g);
            break;
          }
        }
      }

      // ---- extra life ----
      if (g.score >= S.nextExtraLife) {
        S.nextExtraLife += EXTRA_LIFE_STEP;
        g.setLives(g.lives + 1);
        g.audio.play('levelup');
        g.fx.flash('#ffe600', 0.18);
        g.fx.text(400, 220, 'EXTRA SHIP', { color: '#ffe600', size: 14 });
      }

      // ---- wave clear ----
      if (S.asteroids.length === 0) {
        if (S.waveClearTimer <= 0) {
          S.waveClearTimer = WAVE_PAUSE;
        } else {
          S.waveClearTimer -= dt;
          if (S.waveClearTimer <= 0) {
            g.setLevel(g.level + 1);
            spawnWave(g);
            g.audio.play('levelup');
          }
        }
      }
    },

    render: function (g, ctx) {
      var S = g.state, ship = S.ship;

      // starfield backdrop (static, cheap)
      ctx.save();
      ctx.fillStyle = 'rgba(234,246,255,0.35)';
      for (var i = 0; i < 40; i++) {
        var sx = (i * 137) % 800;
        var sy = (i * 251) % 600;
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();

      // asteroids
      for (i = 0; i < S.asteroids.length; i++) {
        var a = S.asteroids[i];
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.strokeStyle = '#eaf6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var v = 0; v < a.verts.length; v++) {
          var p = a.verts[v];
          if (v === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // saucers
      for (i = 0; i < S.saucers.length; i++) {
        var s = S.saucers[i];
        var col = s.type === 'small' ? '#ff2ec4' : '#39ff6a';
        g.draw.glow(ctx, col, 10, function () {
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - s.radius * 0.4, s.radius * 0.5, s.radius * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // saucer bullets
      ctx.fillStyle = '#ff2ec4';
      for (i = 0; i < S.saucerBullets.length; i++) {
        var sb = S.saucerBullets[i];
        ctx.fillRect(sb.x - 2, sb.y - 2, 4, 4);
      }

      // player bullets
      ctx.fillStyle = '#ffe600';
      for (i = 0; i < S.bullets.length; i++) {
        var b = S.bullets[i];
        ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      }

      // ship
      if (ship.alive) {
        var blink = ship.invuln > 0 && Math.floor(ship.invuln * 10) % 2 === 0;
        if (!blink) {
          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.rotate(ship.angle);
          g.draw.glow(ctx, '#eaf6ff', 10, function () {
            ctx.strokeStyle = '#eaf6ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-10, -9);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-10, 9);
            ctx.closePath();
            ctx.stroke();
          });
          if (ship.thrusting) {
            ctx.strokeStyle = '#ff8a00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            var flick = 4 + Math.random() * 5;
            ctx.moveTo(-6, -4);
            ctx.lineTo(-10 - flick, 0);
            ctx.lineTo(-6, 4);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (S.waveClearTimer > 0) {
        g.draw.text(ctx, 'WAVE CLEAR', 400, 280, { size: 16, color: '#ffe600', align: 'center', glow: true });
      }
    }
  });
})();
