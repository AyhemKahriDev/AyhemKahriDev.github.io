/*!
 * games/star-guardian/game.js
 * Star Guardian — inspired by Defender (1981).
 *
 * A horizontally wrapping world 4 screens wide (3200px) over a mountain
 * silhouette. The ship accelerates left/right with drag, moves freely
 * vertically, fires a horizontal laser, and carries smart bombs. Landers
 * abduct humanoids off the ground; shoot them mid-carry and catch the
 * falling humanoid for a rescue bonus. Lose every humanoid and the planet
 * cracks — every lander instantly becomes a hunting mutant. Single IIFE,
 * only touches the `g` handle, every motion scaled by dt.
 */
(function () {
  'use strict';

  // ---- world -------------------------------------------------------------
  var WORLD_W = 3200;

  function wrapMod(x, w) { return ((x % w) + w) % w; }
  function wrapDelta(d, w) { d = d % w; if (d > w / 2) d -= w; if (d < -w / 2) d += w; return d; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  /** World x -> screen x for the current camera, wrap-aware (for fx.burst/fx.text calls made from update()). */
  function toScreenX(worldX, camera) { return wrapMod(worldX - camera, WORLD_W); }

  /** Periodic mountain-silhouette height (world-space, wraps seamlessly since every term's period divides WORLD_W). */
  function groundY(x) {
    var t = (x / WORLD_W) * Math.PI * 2;
    return 500 + Math.sin(t * 3 + 0.7) * 45 + Math.sin(t * 7) * 24 + Math.sin(t * 11 + 1.3) * 14;
  }

  /** World-space distance (x wraps, y doesn't). */
  function wdist(x0, y0, x1, y1) {
    var dx = wrapDelta(x1 - x0, WORLD_W), dy = y1 - y0;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ---- tunables ------------------------------------------------------------
  var SHIP_RADIUS = 13;
  var SHIP_ACCEL = 300;
  var SHIP_DRAG = 1.7;
  var SHIP_MAX_SPEED = 270;
  var SHIP_VSPEED = 210;
  var TOP_BOUND = 36;
  var GROUND_CLEARANCE = 20;

  var LASER_SPEED = 640;
  var LASER_LIFE = 0.55;
  var LASER_COOLDOWN = 0.12;
  var MAX_LASERS = 6;

  var HUMANOID_COUNT = 9;
  var LOW_FALL_SURVIVE = 130;

  var LANDER_DESCEND_SPEED = 68;
  var LANDER_ASCEND_SPEED = 100;
  var LANDER_GRAB_DIST = 16;
  var LANDER_RADIUS = 14;

  var MUTANT_SPEED = 175;
  var MUTANT_RADIUS = 13;

  var BOMBER_SPEED = 55;
  var BOMBER_RADIUS = 15;

  var SWARMER_SPEED = 95;
  var SWARMER_DASH_SPEED = 270;
  var SWARMER_DASH_DURATION = 0.45;
  var SWARMER_RADIUS = 8;

  var ENEMY_BULLET_SPEED = 210;
  var RESPAWN_INVULN = 2.4;
  var RESPAWN_DELAY = 1.2;

  function makeHumanoids() {
    var arr = [];
    for (var i = 0; i < HUMANOID_COUNT; i++) {
      var x = wrapMod((i + 0.5) / HUMANOID_COUNT * WORLD_W + rand(-70, 70), WORLD_W);
      arr.push({ x: x, y: 0, state: 'ground', vy: 0, grabY: 0 });
    }
    return arr;
  }

  function nearestGroundHumanoid(S, x) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < S.humanoids.length; i++) {
      var h = S.humanoids[i];
      if (h.state !== 'ground') continue;
      var d = Math.abs(wrapDelta(h.x - x, WORLD_W));
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  function humanoidsAliveCount(S) {
    var n = 0;
    for (var i = 0; i < S.humanoids.length; i++) if (S.humanoids[i].state !== 'dead') n++;
    return n;
  }

  function crackPlanet(g) {
    var S = g.state;
    if (S.planetCracked) return;
    S.planetCracked = true;
    g.audio.play('bigExplode');
    g.fx.shake(12, 0.8);
    g.fx.flash('#ff3355', 0.3);
    g.fx.text(400, 300, 'THE PLANET CRACKS', { color: '#ff3355', size: 14 });
    for (var i = S.landers.length - 1; i >= 0; i--) {
      var l = S.landers[i];
      S.mutants.push({ x: l.x, y: l.y, vx: 0, vy: 0, fireTimer: rand(1.4, 2.4) });
      g.fx.burst(toScreenX(l.x, S.camera), l.y, { color: '#ff3355', count: 10, speed: 140, life: 0.5, size: 3 });
    }
    S.landers.length = 0;
  }

  function killHumanoid(g, h) {
    h.state = 'dead';
    if (humanoidsAliveCount(g.state) === 0) crackPlanet(g);
  }

  function spawnLander(g) {
    var S = g.state;
    var target = nearestGroundHumanoid(S, S.ship.x + rand(-400, 400));
    if (!target) return false;
    S.landers.push({
      x: wrapMod(target.x + rand(-60, 60), WORLD_W), y: 60,
      state: 'descend', vx: 0, vy: LANDER_DESCEND_SPEED,
      target: target, carrying: null, fireTimer: rand(1.8, 3.2)
    });
    return true;
  }

  function screenVisible(S, worldX, margin) {
    var d = wrapMod(worldX - S.camera, WORLD_W);
    return d > -margin && d < 800 + margin;
  }

  GZ.boot({
    slug: 'star-guardian',
    touchLayout: 'lr-ud-ab',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [
      ['←/→', 'Accelerate'],
      ['↑/↓', 'Move up/down'],
      ['SPACE / Z', 'Laser'],
      ['SHIFT / X', 'Smart bomb']
    ],
    state: {},

    init: function (g) {
      var S = g.state;
      S.ship = { x: WORLD_W / 2, y: 300, vx: 0, vy: 0, facing: 1, alive: true, invuln: RESPAWN_INVULN, carrying: null };
      S.camera = wrapMod(S.ship.x - 400, WORLD_W);
      S.cameraLead = 0;
      S.lasers = [];
      S.landers = [];
      S.mutants = [];
      S.bombers = [];
      S.swarmers = [];
      S.mines = [];
      S.enemyBullets = [];
      S.humanoids = makeHumanoids();
      S.planetCracked = false;
      S.fireCooldown = 0;
      S.respawnTimer = 0;
      S.waveTransitionTimer = 0;
      S.landersQuota = 5;
      S.landersSpawned = 0;
      S.landerSpawnTimer = 1.5;
      S.bomberTimer = rand(4, 7);
      S.swarmerTimer = rand(5, 9);
      S.bombs = 3;
      g.setLives(3);
      g.setLevel(1);
    },

    update: function (g, dt) {
      var S = g.state, input = g.input, ship = S.ship;

      // ================= player ship =================
      if (ship.alive) {
        if (ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);

        var accelDir = 0;
        if (input.isDown('left')) accelDir -= 1;
        if (input.isDown('right')) accelDir += 1;
        if (accelDir !== 0) {
          ship.vx += accelDir * SHIP_ACCEL * dt;
          ship.facing = accelDir;
        }
        var dragF = Math.max(0, 1 - SHIP_DRAG * dt);
        ship.vx *= dragF;
        ship.vx = clamp(ship.vx, -SHIP_MAX_SPEED, SHIP_MAX_SPEED);

        var vDir = 0;
        if (input.isDown('up')) vDir -= 1;
        if (input.isDown('down')) vDir += 1;
        ship.vy = vDir !== 0 ? vDir * SHIP_VSPEED : ship.vy * Math.max(0, 1 - 8 * dt);

        ship.x = wrapMod(ship.x + ship.vx * dt, WORLD_W);
        ship.y += ship.vy * dt;
        var floorY = groundY(ship.x) - GROUND_CLEARANCE;
        ship.y = clamp(ship.y, TOP_BOUND, floorY);

        if (input.pressed('a') && S.fireCooldown <= 0 && S.lasers.length < MAX_LASERS) {
          S.fireCooldown = LASER_COOLDOWN;
          S.lasers.push({ x: ship.x + ship.facing * SHIP_RADIUS, y: ship.y, vx: ship.facing * LASER_SPEED, life: LASER_LIFE });
          g.audio.play('laser');
        }
        if (input.pressed('b') && S.bombs > 0) {
          S.bombs--;
          g.audio.play('bigExplode');
          g.fx.shake(10, 0.5);
          g.fx.flash('#00f0ff', 0.25);
          var killed = 0;
          for (var li = S.landers.length - 1; li >= 0; li--) {
            if (screenVisible(S, S.landers[li].x, 40)) {
              detachLanderHumanoid(S.landers[li]);
              g.fx.burst(toScreenX(S.landers[li].x, S.camera), S.landers[li].y, { color: '#00f0ff', count: 14, speed: 160, life: 0.5, size: 3 });
              g.addScore(150);
              S.landers.splice(li, 1); killed++;
            }
          }
          for (var mi = S.mutants.length - 1; mi >= 0; mi--) {
            if (screenVisible(S, S.mutants[mi].x, 40)) {
              g.fx.burst(toScreenX(S.mutants[mi].x, S.camera), S.mutants[mi].y, { color: '#00f0ff', count: 14, speed: 160, life: 0.5, size: 3 });
              g.addScore(150); S.mutants.splice(mi, 1); killed++;
            }
          }
          for (var boi = S.bombers.length - 1; boi >= 0; boi--) {
            if (screenVisible(S, S.bombers[boi].x, 40)) {
              g.fx.burst(toScreenX(S.bombers[boi].x, S.camera), S.bombers[boi].y, { color: '#00f0ff', count: 14, speed: 160, life: 0.5, size: 3 });
              g.addScore(250); S.bombers.splice(boi, 1); killed++;
            }
          }
          for (var swi = S.swarmers.length - 1; swi >= 0; swi--) {
            if (screenVisible(S, S.swarmers[swi].x, 40)) {
              g.fx.burst(toScreenX(S.swarmers[swi].x, S.camera), S.swarmers[swi].y, { color: '#00f0ff', count: 10, speed: 140, life: 0.4, size: 2 });
              g.addScore(150); S.swarmers.splice(swi, 1); killed++;
            }
          }
          for (var ebi = S.enemyBullets.length - 1; ebi >= 0; ebi--) {
            if (screenVisible(S, S.enemyBullets[ebi].x, 40)) S.enemyBullets.splice(ebi, 1);
          }
          if (killed > 0) g.fx.text(400, 200, 'SMART BOMB', { color: '#00f0ff', size: 12 });
        }

        // carried humanoid follows the ship
        if (ship.carrying) { ship.carrying.x = ship.x; ship.carrying.y = ship.y + 16; }
      } else {
        S.respawnTimer -= dt;
        if (S.respawnTimer <= 0) {
          ship.x = WORLD_W / 2;
          ship.y = 300; ship.vx = 0; ship.vy = 0;
          ship.alive = true; ship.invuln = RESPAWN_INVULN; ship.carrying = null;
        }
      }

      if (S.fireCooldown > 0) S.fireCooldown -= dt;

      // ================= camera =================
      var leadTarget = ship.facing * 150;
      S.cameraLead += (leadTarget - S.cameraLead) * clamp(4 * dt, 0, 1);
      S.camera = wrapMod(ship.x - 400 + S.cameraLead, WORLD_W);

      // ================= lasers =================
      for (var i = S.lasers.length - 1; i >= 0; i--) {
        var b = S.lasers[i];
        b.x = wrapMod(b.x + b.vx * dt, WORLD_W);
        b.life -= dt;
        if (b.life <= 0) S.lasers.splice(i, 1);
      }

      // ================= humanoids =================
      for (i = 0; i < S.humanoids.length; i++) {
        var h = S.humanoids[i];
        if (h.state === 'falling') {
          h.vy += 420 * dt;
          h.y += h.vy * dt;
          var gy = groundY(h.x);
          if (h.y >= gy) {
            h.y = gy;
            var fallDist = h.y - h.grabY;
            if (fallDist < LOW_FALL_SURVIVE) {
              h.state = 'ground';
              g.fx.text(toScreenX(h.x, S.camera), h.y - 10, 'PHEW', { color: '#39ff6a', size: 9 });
            } else {
              killHumanoid(g, h);
              g.audio.play('die');
            }
          }
        }
      }

      // ================= landers =================
      if (!S.planetCracked && S.landersSpawned < S.landersQuota) {
        S.landerSpawnTimer -= dt;
        if (S.landerSpawnTimer <= 0) {
          if (spawnLander(g)) { S.landersSpawned++; S.landerSpawnTimer = Math.max(1.1, 3.4 - g.level * 0.15); }
          else S.landerSpawnTimer = 1.0;
        }
      }
      for (i = S.landers.length - 1; i >= 0; i--) {
        var l = S.landers[i];
        l.fireTimer -= dt;
        if (l.fireTimer <= 0 && ship.alive) {
          l.fireTimer = rand(2.0, 3.4);
          fireAimed(g, l.x, l.y);
        }
        if (l.state === 'descend') {
          if (!l.target || l.target.state !== 'ground') { l.state = 'ascend'; continue; }
          var dx = wrapDelta(l.target.x - l.x, WORLD_W);
          l.x = wrapMod(l.x + Math.sign(dx) * Math.min(Math.abs(dx), LANDER_DESCEND_SPEED * dt), WORLD_W);
          l.y += LANDER_DESCEND_SPEED * dt;
          var targetY = groundY(l.target.x) - 6;
          if (l.y >= targetY && Math.abs(dx) < LANDER_GRAB_DIST) {
            l.y = targetY;
            l.target.state = 'carried';
            l.carrying = l.target;
            l.state = 'ascend';
            g.audio.play('hit');
          } else if (l.y >= targetY) {
            l.y = targetY;
          }
        } else { // ascend
          l.y -= LANDER_ASCEND_SPEED * dt;
          if (l.carrying) { l.carrying.x = l.x; l.carrying.y = l.y + 14; }
          if (l.y <= 30) {
            if (l.carrying) {
              killHumanoid(g, l.carrying);
              S.mutants.push({ x: l.x, y: 40, vx: 0, vy: 0, fireTimer: rand(1.2, 2.2) });
              g.audio.play('warp');
              g.fx.burst(toScreenX(l.x, S.camera), 40, { color: '#ff3355', count: 16, speed: 150, life: 0.5, size: 3 });
            }
            S.landers.splice(i, 1);
          }
        }
      }

      // ================= mutants =================
      for (i = S.mutants.length - 1; i >= 0; i--) {
        var mu = S.mutants[i];
        if (ship.alive) {
          var ddx = wrapDelta(ship.x - mu.x, WORLD_W);
          var ddy = ship.y - mu.y;
          var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          mu.vx = (ddx / dd) * MUTANT_SPEED;
          mu.vy = (ddy / dd) * MUTANT_SPEED;
        }
        mu.x = wrapMod(mu.x + mu.vx * dt, WORLD_W);
        mu.y = clamp(mu.y + mu.vy * dt, 20, 580);
        mu.fireTimer -= dt;
        if (mu.fireTimer <= 0 && ship.alive) { mu.fireTimer = rand(1.2, 2.2); fireAimed(g, mu.x, mu.y); }
      }

      // ================= bombers =================
      var maxBombers = 1 + Math.floor(g.level / 3);
      S.bomberTimer -= dt;
      if (S.bomberTimer <= 0 && S.bombers.length < maxBombers) {
        S.bombers.push({ x: wrapMod(S.camera + (Math.random() < 0.5 ? -60 : 860), WORLD_W), y: rand(80, 300), vx: (Math.random() < 0.5 ? 1 : -1) * BOMBER_SPEED, dropTimer: rand(2, 4) });
        S.bomberTimer = rand(6, 10);
      }
      for (i = S.bombers.length - 1; i >= 0; i--) {
        var bo = S.bombers[i];
        bo.x = wrapMod(bo.x + bo.vx * dt, WORLD_W);
        bo.dropTimer -= dt;
        if (bo.dropTimer <= 0) {
          bo.dropTimer = rand(2.5, 4.5);
          S.mines.push({ x: bo.x, y: groundY(bo.x) - 6, life: 14 });
        }
      }

      // ================= swarmers =================
      var maxSwarmers = 2 + Math.floor(g.level / 2);
      S.swarmerTimer -= dt;
      if (S.swarmerTimer <= 0 && S.swarmers.length < maxSwarmers) {
        S.swarmers.push({ x: wrapMod(S.camera + rand(-100, 900), WORLD_W), y: rand(60, 400), vx: rand(-1, 1) * SWARMER_SPEED, vy: rand(-1, 1) * SWARMER_SPEED, dashing: false, dashTimer: rand(1.6, 3) });
        S.swarmerTimer = rand(5, 8);
      }
      for (i = S.swarmers.length - 1; i >= 0; i--) {
        var sw = S.swarmers[i];
        sw.dashTimer -= dt;
        if (sw.dashTimer <= 0) {
          if (!sw.dashing && ship.alive) {
            sw.dashing = true; sw.dashTimer = SWARMER_DASH_DURATION;
            var sdx = wrapDelta(ship.x - sw.x, WORLD_W), sdy = ship.y - sw.y;
            var sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
            sw.vx = (sdx / sd) * SWARMER_DASH_SPEED; sw.vy = (sdy / sd) * SWARMER_DASH_SPEED;
          } else {
            sw.dashing = false; sw.dashTimer = rand(1.6, 3);
            sw.vx = rand(-1, 1) * SWARMER_SPEED; sw.vy = rand(-1, 1) * SWARMER_SPEED;
          }
        }
        sw.x = wrapMod(sw.x + sw.vx * dt, WORLD_W);
        sw.y = clamp(sw.y + sw.vy * dt, 20, 580);
      }

      // ================= mines / enemy bullets =================
      for (i = S.mines.length - 1; i >= 0; i--) {
        S.mines[i].life -= dt;
        if (S.mines[i].life <= 0) S.mines.splice(i, 1);
      }
      for (i = S.enemyBullets.length - 1; i >= 0; i--) {
        var eb = S.enemyBullets[i];
        eb.x = wrapMod(eb.x + eb.vx * dt, WORLD_W);
        eb.y += eb.vy * dt;
        eb.life -= dt;
        if (eb.life <= 0) S.enemyBullets.splice(i, 1);
      }

      // ================= collisions: laser vs enemies =================
      for (i = S.lasers.length - 1; i >= 0; i--) {
        var laser = S.lasers[i];
        var consumed = false;
        for (var li2 = S.landers.length - 1; li2 >= 0 && !consumed; li2--) {
          var ld = S.landers[li2];
          if (wdist(laser.x, laser.y, ld.x, ld.y) < LANDER_RADIUS) {
            detachLanderHumanoid(ld);
            g.addScore(150);
            g.fx.text(toScreenX(ld.x, S.camera), ld.y, '+150', { color: '#ffe600', size: 10 });
            g.fx.burst(toScreenX(ld.x, S.camera), ld.y, { color: '#00f0ff', count: 14, speed: 150, life: 0.5, size: 3 });
            g.audio.play('explode');
            S.landers.splice(li2, 1); consumed = true;
          }
        }
        for (var mi2 = S.mutants.length - 1; mi2 >= 0 && !consumed; mi2--) {
          if (wdist(laser.x, laser.y, S.mutants[mi2].x, S.mutants[mi2].y) < MUTANT_RADIUS) {
            g.addScore(150);
            g.fx.text(toScreenX(S.mutants[mi2].x, S.camera), S.mutants[mi2].y, '+150', { color: '#ffe600', size: 10 });
            g.fx.burst(toScreenX(S.mutants[mi2].x, S.camera), S.mutants[mi2].y, { color: '#ff3355', count: 14, speed: 160, life: 0.5, size: 3 });
            g.audio.play('explode');
            S.mutants.splice(mi2, 1); consumed = true;
          }
        }
        for (var boi2 = S.bombers.length - 1; boi2 >= 0 && !consumed; boi2--) {
          if (wdist(laser.x, laser.y, S.bombers[boi2].x, S.bombers[boi2].y) < BOMBER_RADIUS) {
            g.addScore(250);
            g.fx.text(toScreenX(S.bombers[boi2].x, S.camera), S.bombers[boi2].y, '+250', { color: '#ffe600', size: 10 });
            g.fx.burst(toScreenX(S.bombers[boi2].x, S.camera), S.bombers[boi2].y, { color: '#ff8a00', count: 16, speed: 160, life: 0.5, size: 3 });
            g.audio.play('explode');
            S.bombers.splice(boi2, 1); consumed = true;
          }
        }
        for (var swi2 = S.swarmers.length - 1; swi2 >= 0 && !consumed; swi2--) {
          if (wdist(laser.x, laser.y, S.swarmers[swi2].x, S.swarmers[swi2].y) < SWARMER_RADIUS) {
            g.addScore(150);
            g.fx.text(toScreenX(S.swarmers[swi2].x, S.camera), S.swarmers[swi2].y, '+150', { color: '#ffe600', size: 10 });
            g.fx.burst(toScreenX(S.swarmers[swi2].x, S.camera), S.swarmers[swi2].y, { color: '#ff2ec4', count: 10, speed: 150, life: 0.4, size: 2 });
            g.audio.play('hit');
            S.swarmers.splice(swi2, 1); consumed = true;
          }
        }
        for (var mn2 = S.mines.length - 1; mn2 >= 0 && !consumed; mn2--) {
          if (wdist(laser.x, laser.y, S.mines[mn2].x, S.mines[mn2].y) < 10) {
            g.fx.burst(toScreenX(S.mines[mn2].x, S.camera), S.mines[mn2].y, { color: '#ff8a00', count: 10, speed: 130, life: 0.4, size: 2 });
            g.audio.play('hit');
            S.mines.splice(mn2, 1); consumed = true;
          }
        }
        if (consumed) S.lasers.splice(i, 1);
      }

      // ================= ship catching a falling humanoid =================
      if (ship.alive && !ship.carrying) {
        for (i = 0; i < S.humanoids.length; i++) {
          h = S.humanoids[i];
          if (h.state === 'falling' && wdist(ship.x, ship.y, h.x, h.y) < SHIP_RADIUS + 10) {
            h.state = 'held';
            ship.carrying = h;
            g.addScore(500);
            g.fx.text(toScreenX(ship.x, S.camera), ship.y - 20, '+500', { color: '#ffe600', size: 11 });
            g.audio.play('pickup');
          }
        }
      }
      if (ship.alive && ship.carrying && ship.carrying.state === 'held') {
        var floor = groundY(ship.x) - GROUND_CLEARANCE;
        if (ship.y > floor - 30) {
          ship.carrying.state = 'ground';
          ship.carrying.x = ship.x;
          g.addScore(500);
          g.fx.text(toScreenX(ship.x, S.camera), ship.y - 20, '+500', { color: '#ffe600', size: 11 });
          g.audio.play('powerup');
          ship.carrying = null;
        }
      }

      // ================= ship damage =================
      if (ship.alive && ship.invuln <= 0) {
        var hitSomething = false;
        for (i = 0; i < S.landers.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.landers[i].x, S.landers[i].y) < LANDER_RADIUS + SHIP_RADIUS * 0.7) hitSomething = true;
        }
        for (i = 0; i < S.mutants.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.mutants[i].x, S.mutants[i].y) < MUTANT_RADIUS + SHIP_RADIUS * 0.7) hitSomething = true;
        }
        for (i = 0; i < S.bombers.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.bombers[i].x, S.bombers[i].y) < BOMBER_RADIUS + SHIP_RADIUS * 0.7) hitSomething = true;
        }
        for (i = 0; i < S.swarmers.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.swarmers[i].x, S.swarmers[i].y) < SWARMER_RADIUS + SHIP_RADIUS * 0.7) hitSomething = true;
        }
        for (i = 0; i < S.mines.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.mines[i].x, S.mines[i].y) < 12 + SHIP_RADIUS * 0.6) hitSomething = true;
        }
        for (i = 0; i < S.enemyBullets.length && !hitSomething; i++) {
          if (wdist(ship.x, ship.y, S.enemyBullets[i].x, S.enemyBullets[i].y) < 6 + SHIP_RADIUS * 0.6) hitSomething = true;
        }
        if (ship.y >= groundY(ship.x) - 4) hitSomething = true;
        if (hitSomething) killShip(g);
      }

      // ================= wave clear =================
      if (!S.planetCracked && S.landersSpawned >= S.landersQuota && S.landers.length === 0 && S.mutants.length === 0) {
        if (S.waveTransitionTimer <= 0) {
          S.waveTransitionTimer = 2.2;
          var survivors = humanoidsAliveCount(S);
          var bonus = survivors * 100;
          g.addScore(bonus);
          g.audio.play('levelup');
          g.fx.flash('#39ff6a', 0.2);
          g.fx.text(400, 260, 'WAVE CLEAR +' + bonus, { color: '#39ff6a', size: 12 });
        } else {
          S.waveTransitionTimer -= dt;
          if (S.waveTransitionTimer <= 0) {
            g.setLevel(g.level + 1);
            S.landersQuota = 4 + g.level;
            S.landersSpawned = 0;
            S.landerSpawnTimer = 1.5;
            S.bombs = 3 + (g.level - 1);
          }
        }
      }
    },

    render: function (g, ctx) {
      var S = g.state, ship = S.ship, cam = S.camera;

      function sx(worldX) { return wrapMod(worldX - cam, WORLD_W); }

      // sky gradient-ish backdrop stars
      ctx.save();
      ctx.fillStyle = 'rgba(0,240,255,0.25)';
      for (var i = 0; i < 50; i++) {
        var stx = (i * 173 - cam * 0.3) % 800;
        if (stx < 0) stx += 800;
        ctx.fillRect(stx, (i * 61) % 420, 1, 1);
      }
      ctx.restore();

      // terrain silhouette
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 600);
      for (var sxp = 0; sxp <= 800; sxp += 16) {
        ctx.lineTo(sxp, groundY(cam + sxp));
      }
      ctx.lineTo(800, 600);
      ctx.closePath();
      ctx.fillStyle = '#12121c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (sxp = 0; sxp <= 800; sxp += 16) {
        var gy = groundY(cam + sxp);
        if (sxp === 0) ctx.moveTo(sxp, gy); else ctx.lineTo(sxp, gy);
      }
      ctx.stroke();
      ctx.restore();

      // mines
      for (i = 0; i < S.mines.length; i++) {
        var mn = S.mines[i];
        var mx = sx(mn.x);
        if (mx < -20 || mx > 820) continue;
        ctx.save();
        ctx.fillStyle = '#ff8a00';
        ctx.beginPath();
        ctx.arc(mx, mn.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // humanoids
      for (i = 0; i < S.humanoids.length; i++) {
        var h = S.humanoids[i];
        if (h.state === 'dead') continue;
        var hx = sx(h.x);
        if (hx < -20 || hx > 820) continue;
        var hy = h.state === 'ground' ? groundY(h.x) : h.y;
        ctx.fillStyle = h.state === 'ground' ? '#eaf6ff' : '#ffe600';
        ctx.fillRect(hx - 3, hy - 12, 6, 12);
        ctx.beginPath();
        ctx.arc(hx, hy - 15, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // landers
      for (i = 0; i < S.landers.length; i++) {
        var l = S.landers[i];
        var lx = sx(l.x);
        if (lx < -30 || lx > 830) continue;
        g.draw.glow(ctx, '#00f0ff', 10, function () {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lx - 14, l.y);
          ctx.lineTo(lx, l.y - 12);
          ctx.lineTo(lx + 14, l.y);
          ctx.lineTo(lx, l.y + 8);
          ctx.closePath();
          ctx.stroke();
        });
      }

      // mutants
      for (i = 0; i < S.mutants.length; i++) {
        var mu = S.mutants[i];
        var mux = sx(mu.x);
        if (mux < -20 || mux > 820) continue;
        g.draw.glow(ctx, '#ff3355', 10, function () {
          ctx.fillStyle = '#ff3355';
          ctx.beginPath();
          ctx.moveTo(mux - 12, mu.y + 8);
          ctx.lineTo(mux, mu.y - 10);
          ctx.lineTo(mux + 12, mu.y + 8);
          ctx.closePath();
          ctx.fill();
        });
      }

      // bombers
      for (i = 0; i < S.bombers.length; i++) {
        var bo = S.bombers[i];
        var box = sx(bo.x);
        if (box < -20 || box > 820) continue;
        ctx.strokeStyle = '#ff8a00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(box, bo.y, 15, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // swarmers
      ctx.fillStyle = '#ff2ec4';
      for (i = 0; i < S.swarmers.length; i++) {
        var sw = S.swarmers[i];
        var swx = sx(sw.x);
        if (swx < -10 || swx > 810) continue;
        ctx.beginPath();
        ctx.arc(swx, sw.y, SWARMER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // enemy bullets
      ctx.fillStyle = '#ff3355';
      for (i = 0; i < S.enemyBullets.length; i++) {
        var eb = S.enemyBullets[i];
        var ebx = sx(eb.x);
        if (ebx < -10 || ebx > 810) continue;
        ctx.fillRect(ebx - 2, eb.y - 2, 4, 4);
      }

      // lasers
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 3;
      for (i = 0; i < S.lasers.length; i++) {
        var laser = S.lasers[i];
        var lax = sx(laser.x);
        if (lax < -20 || lax > 820) continue;
        ctx.beginPath();
        ctx.moveTo(lax - Math.sign(laser.vx || 1) * 10, laser.y);
        ctx.lineTo(lax + Math.sign(laser.vx || 1) * 10, laser.y);
        ctx.stroke();
      }

      // ship
      if (ship.alive) {
        var blink = ship.invuln > 0 && Math.floor(ship.invuln * 10) % 2 === 0;
        if (!blink) {
          var shx = sx(ship.x);
          ctx.save();
          ctx.translate(shx, ship.y);
          ctx.scale(ship.facing, 1);
          g.draw.glow(ctx, '#00f0ff', 12, function () {
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.fill();
          });
          ctx.restore();
          if (ship.carrying) {
            ctx.fillStyle = '#ffe600';
            ctx.fillRect(shx - 3, ship.y + 10, 6, 12);
          }
        }
      }

      // ---- radar strip ----
      var radarX = 20, radarY = 8, radarW = 760, radarH = 22;
      ctx.save();
      ctx.fillStyle = 'rgba(7,7,12,0.7)';
      ctx.fillRect(radarX - 4, radarY - 4, radarW + 8, radarH + 8);
      ctx.strokeStyle = 'rgba(0,240,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(radarX - 4, radarY - 4, radarW + 8, radarH + 8);

      // terrain mini-line
      ctx.strokeStyle = 'rgba(234,246,255,0.4)';
      ctx.beginPath();
      for (var wx = 0; wx <= WORLD_W; wx += WORLD_W / 60) {
        var ry = radarY + radarH - ((groundY(wx) - 420) / 160) * radarH;
        var rx = radarX + (wx / WORLD_W) * radarW;
        if (wx === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.stroke();

      // humanoids on radar
      for (i = 0; i < S.humanoids.length; i++) {
        h = S.humanoids[i];
        if (h.state === 'dead') continue;
        ctx.fillStyle = h.state === 'ground' ? '#eaf6ff' : '#ffe600';
        ctx.fillRect(radarX + (h.x / WORLD_W) * radarW - 1, radarY + radarH - 4, 2, 4);
      }
      // enemies on radar
      ctx.fillStyle = '#ff3355';
      for (i = 0; i < S.landers.length; i++) ctx.fillRect(radarX + (S.landers[i].x / WORLD_W) * radarW - 1, radarY + 2, 2, 3);
      for (i = 0; i < S.mutants.length; i++) ctx.fillRect(radarX + (S.mutants[i].x / WORLD_W) * radarW - 1, radarY + 2, 2, 3);
      for (i = 0; i < S.bombers.length; i++) ctx.fillRect(radarX + (S.bombers[i].x / WORLD_W) * radarW - 1, radarY + 2, 2, 3);
      for (i = 0; i < S.swarmers.length; i++) ctx.fillRect(radarX + (S.swarmers[i].x / WORLD_W) * radarW - 1, radarY + 2, 2, 3);

      // player + view window
      var viewW = (800 / WORLD_W) * radarW;
      var viewX = radarX + (cam / WORLD_W) * radarW;
      ctx.strokeStyle = 'rgba(0,240,255,0.8)';
      ctx.strokeRect(viewX, radarY, viewW, radarH);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(radarX + (ship.x / WORLD_W) * radarW - 1, radarY, 2, radarH);
      ctx.restore();

      // bombs + wave readout
      g.draw.text(ctx, 'BOMBS ' + S.bombs, 780, 56, { size: 9, color: '#00f0ff', align: 'right' });
      g.draw.text(ctx, 'HUMANS ' + humanoidsAliveCount(S), 780, 70, { size: 9, color: '#eaf6ff', align: 'right' });
    }
  });

  function detachLanderHumanoid(l) {
    if (l.carrying) {
      l.carrying.state = 'falling';
      l.carrying.vy = 0;
      l.carrying.grabY = l.carrying.y;
    }
  }

  function fireAimed(g, x, y) {
    var S = g.state, ship = S.ship;
    var dx = wrapDelta(ship.x - x, WORLD_W), dy = ship.y - y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    S.enemyBullets.push({ x: x, y: y, vx: (dx / d) * ENEMY_BULLET_SPEED, vy: (dy / d) * ENEMY_BULLET_SPEED, life: 3 });
    g.audio.play('shoot');
  }

  function killShip(g) {
    var S = g.state, ship = S.ship;
    ship.alive = false;
    if (ship.carrying) { ship.carrying.state = 'falling'; ship.carrying.vy = 0; ship.carrying.grabY = ship.carrying.y; ship.carrying = null; }
    S.respawnTimer = RESPAWN_DELAY;
    g.audio.play('bigExplode');
    g.fx.shake(10, 0.5);
    g.fx.burst(wrapMod(ship.x - S.camera, WORLD_W), ship.y, { color: '#00f0ff', count: 24, speed: 180, life: 0.8, size: 3 });
    g.setLives(g.lives - 1);
    if (g.lives <= 0) g.gameOver();
  }
})();
