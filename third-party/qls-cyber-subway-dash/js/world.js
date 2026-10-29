window.SD = window.SD || {};

(function () {
  'use strict';

  const C = window.SD.Config;

  const SHAPES = {
    wall: { w: 0.9, depth: 1.3, h: 3.5 },
    train: { w: 0.9, depth: 7.0, h: 3.6 },
    trainLow: { w: 0.9, depth: 6.0, h: 1.7 },
    ramp: { w: 0.9, depth: 4.0, h: 1.7 },
    low: { w: 0.9, depth: 0.55, h: 0.5, h0: 0.5 },
    high: { w: 1.0, depth: 0.6, h0: 1.45, h: 2.15 }
  };

  const W = (window.SD.World = {
    ambient: false,
    crashed: false,
    speed: 0,
    speedScale: 1,
    distance: 0,
    trackOffset: 0,
    obstacles: [],
    coins: [],
    powerups: [],
    particles: [],
    lastZ: [0, 0, 0],
    spawnTimer: 0,
    onCoin: null,
    onCrash: null,
    onPowerup: null,
    onSmash: null,

    reset() {
      this.ambient = false;
      this.crashed = false;
      this.speed = C.START_SPEED;
      this.speedScale = 1;
      this.distance = 0;
      this.trackOffset = 0;
      this.obstacles.length = 0;
      this.coins.length = 0;
      this.powerups.length = 0;
      this.particles.length = 0;
      this.lastZ = [-1e9, -1e9, -1e9];
      this.spawnTimer = 1.2;
    },

    moveSpeed() {
      return this.speed * this.speedScale;
    },

    tier() {
      return window.SD.clamp((this.speed - C.START_SPEED) / (C.MAX_SPEED - C.START_SPEED), 0, 1);
    },

    spawnInterval() {
      return window.SD.lerp(C.SPAWN_BASE, C.SPAWN_MIN, this.tier());
    },

    minGap() {
      return window.SD.lerp(9, 5.5, this.tier());
    },

    laneX(i) {
      return i * C.LANE_W * (window.SD.sceneScale || 1);
    },

    ambientUpdate(dt) {
      this.speed = 24;
      this.trackOffset += this.speed * dt;
      this.moveParticles(dt);
    },

    update(dt, player, opts) {
      this.speed = Math.min(C.MAX_SPEED, this.speed + C.ACCEL * dt);
      this.distance += this.moveSpeed() * dt;
      this.trackOffset += this.moveSpeed() * dt;

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval();
        this.spawnPattern();
      }

      this.moveObstacles(dt);
      const hit = this.checkCollisions(player, opts);
      this.collectCoins(dt, player, opts && opts.magnet);
      this.collectPowerups(dt, player);
      if (opts && opts.magnet) this.attractCoins(dt, player);
      this.moveParticles(dt);
      return hit;
    },

    moveObstacles(dt) {
      const arr = this.obstacles;
      for (let i = arr.length - 1; i >= 0; i--) {
        const o = arr[i];
        o.pz = o.z;
        o.z -= this.moveSpeed() * dt;
        if (o.z < C.NEAR_Z) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
      }
    },

    collectCoins(dt, player, magnet) {
      if (this.crashed) return;
      const arr = this.coins;
      for (let i = arr.length - 1; i >= 0; i--) {
        const c = arr[i];
        const prevZ = c.z;
        c.z -= this.moveSpeed() * dt;
        c.spin += 0.12;
        if (c.z < 0.4) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
          continue;
        }
        const magnetRange = magnet ? 3.4 : 0.55;
        const crossZ = Math.max(prevZ, c.z) >= C.PLAYER_Z - 0.55 && Math.min(prevZ, c.z) <= C.PLAYER_Z + 0.55;
        if (
          Math.abs(c.x - player.x) < magnetRange &&
          crossZ &&
          Math.abs(c.y - (player.y + 0.9)) < 1.05
        ) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
          if (this.onCoin) this.onCoin(c);
        }
      }
    },

    collectPowerups(dt, player) {
      if (this.crashed) return;
      const arr = this.powerups;
      for (let i = arr.length - 1; i >= 0; i--) {
        const pu = arr[i];
        const prevZ = pu.z;
        pu.z -= this.moveSpeed() * dt;
        pu.spin += 0.05;
        if (pu.z < 0.4) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
          continue;
        }
        const crossZ = Math.max(prevZ, pu.z) >= C.PLAYER_Z - 0.6 && Math.min(prevZ, pu.z) <= C.PLAYER_Z + 0.6;
        if (
          Math.abs(pu.x - player.x) < 0.6 &&
          crossZ &&
          Math.abs(pu.y - (player.y + 0.9)) < 1.1
        ) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
          if (this.onPowerup) this.onPowerup(pu);
        }
      }
    },

    attractCoins(dt, player) {
      const arr = this.coins;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c.z > 14) continue;
        if (Math.abs(c.x - player.x) > 3.4) continue;
        c.x += (player.x - c.x) * Math.min(1, dt * 7);
        c.y += (0.9 - c.y) * Math.min(1, dt * 5);
      }
    },

    moveParticles(dt) {
      const arr = this.particles;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.z -= this.moveSpeed() * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 15 * dt;
        p.life -= dt;
        if (p.life <= 0 || p.z < 0.3) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
      }
    },

    burst(x, y, z, color, n, power) {
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: x + window.SD.rand(-0.3, 0.3),
          y: y + window.SD.rand(0, 0.4),
          z: z + window.SD.rand(-0.3, 0.3),
          vx: window.SD.rand(-2.5, 2.5),
          vy: window.SD.rand(1.5, power + 2),
          vz: 0,
          life: window.SD.rand(0.4, 0.9),
          maxLife: 0.9,
          color: color,
          size: window.SD.rand(0.08, 0.16)
        });
      }
    },

    checkCollisions(player, opts) {
      if (this.crashed) return false;
      const arr = this.obstacles;
      const dash = opts && opts.dash;
      const inv = opts && opts.invincible;
      const smashed = [];
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        if (Math.abs(o.x - player.x) > o.w / 2 + 0.38) continue;
        const halfZ = o.depth / 2 + C.PLAYER_DEPTH / 2 + 0.05;
        const zPrev = o.pz !== undefined ? o.pz : o.z;
        const crossZ = Math.max(zPrev, o.z) >= C.PLAYER_Z - halfZ && Math.min(zPrev, o.z) <= C.PLAYER_Z + halfZ;
        if (!crossZ) continue;
        let hit = false;
        if (o.type === 'ramp') {
          continue;
        } else if (o.type === 'low') {
          hit = player.y < o.h;
        } else if (o.type === 'high') {
          hit = !player.sliding && player.y + player.height > o.h0;
        } else if (o.type === 'trainLow') {
          hit = player.y < o.h - 0.08;
        } else {
          hit = player.y < o.h;
        }
        if (hit) {
          if (dash) {
            smashed.push(o);
            continue;
          }
          if (inv) {
            continue;
          }
          this.crashed = true;
          if (this.onCrash) this.onCrash();
          return true;
        }
      }
      for (const o of smashed) {
        const idx = arr.indexOf(o);
        if (idx >= 0) {
          arr[idx] = arr[arr.length - 1];
          arr.pop();
        }
        this.burst(o.x, (o.h || 0.5) * 0.5, o.z, '#ffd75e', 10, 5);
        if (this.onSmash) this.onSmash(o);
      }
      return false;
    },

    canSpawnLane(laneIdx, z, depth) {
      // 按已行驶距离判定同一车道两次生成的间隔，避免固定生成位置导致车道锁死
      const slot = laneIdx + 1;
      return this.distance - this.lastZ[slot] >= this.minGap() + depth;
    },

    addObstacle(laneIdx, type, z, force) {
      const shape = SHAPES[type];
      if (!force && !this.canSpawnLane(laneIdx, z, shape.depth)) return false;
      this.obstacles.push({
        type,
        x: this.laneX(laneIdx),
        z,
        w: shape.w * C.LANE_W * (window.SD.sceneScale || 1),
        depth: shape.depth,
        h: shape.h,
        h0: shape.h0 || 0,
        dead: false
      });
      if (!force) this.lastZ[laneIdx + 1] = this.distance;
      return true;
    },

    surfaceAt(player) {
      // 玩家脚下可站立表面的高度：矮车厢顶与坡道
      let surf = 0;
      for (const o of this.obstacles) {
        if (o.type !== 'trainLow' && o.type !== 'ramp') continue;
        if (Math.abs(o.x - player.x) > o.w / 2 + 0.3) continue;
        const half = o.depth / 2 + C.PLAYER_DEPTH / 2;
        const dz = C.PLAYER_Z - o.z;
        if (Math.abs(dz) > half) continue;
        if (o.type === 'trainLow') {
          surf = Math.max(surf, o.h);
        } else {
          const prog = window.SD.clamp((dz + o.depth / 2) / o.depth, 0, 1);
          surf = Math.max(surf, o.h * prog);
        }
      }
      return surf;
    },

    addCoin(x, y, z) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (y > (o.h || 0) + 0.2) continue;
        if (Math.abs(o.x - x) < o.w / 2 + 0.2 && Math.abs(o.z - z) < o.depth / 2 + 0.8) {
          return;
        }
      }
      this.coins.push({ type: 'coin', x, y, z, spin: Math.random() * 6.28 });
    },

    coinLine(n) {
      const lane = Math.floor(Math.random() * 3) - 1;
      const z0 = C.SPAWN_Z;
      for (let i = 0; i < n; i++) {
        this.addCoin(this.laneX(lane), 0.9, z0 - i * C.COIN_GAP);
      }
    },

    jumpGift() {
      const lane = Math.floor(Math.random() * 3) - 1;
      const z0 = C.SPAWN_Z;
      if (!this.addObstacle(lane, 'low', z0)) return;
      const heights = [1.85, 1.35, 0.9];
      for (let i = 0; i < heights.length; i++) {
        this.addCoin(this.laneX(lane), heights[i], z0 - (i + 1) * 2.4);
      }
    },

    slideGift() {
      const lane = Math.floor(Math.random() * 3) - 1;
      const z0 = C.SPAWN_Z;
      if (!this.addObstacle(lane, 'high', z0)) return;
      this.addCoin(this.laneX(lane), 0.35, z0 - 2.4);
      this.addCoin(this.laneX(lane), 0.35, z0 - 4.6);
    },

    singleObstacle() {
      const t = this.tier();
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const type = Math.random() < 0.4 ? 'wall' : Math.random() < 0.5 ? 'low' : 'high';
      for (let i = 0; i < lanes.length; i++) {
        if (this.addObstacle(lanes[i], type, C.SPAWN_Z)) return;
      }
    },

    pairObstacle() {
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const used = [];
      for (let i = 0; i < 2; i++) {
        const type = Math.random() < 0.45 ? 'wall' : Math.random() < 0.5 ? 'low' : 'high';
        if (this.addObstacle(lanes[i], type, C.SPAWN_Z)) used.push(lanes[i]);
      }
      if (used.length === 2 && Math.random() < 0.5) {
        const free = -(used[0] + used[1]);
        const z0 = C.SPAWN_Z;
        for (let i = 0; i < 3; i++) {
          this.addCoin(this.laneX(free), 0.9, z0 - 2 - i * C.COIN_GAP);
        }
      }
    },

    trainRow() {
      const lane = Math.floor(Math.random() * 3) - 1;
      const others = [-1, 0, 1].filter((l) => l !== lane);
      const free = others[Math.floor(Math.random() * others.length)];
      if (Math.random() < 0.55) {
        // 矮货运车厢 + 上坡道，可跑上车顶，车顶放金币
        const zt = C.SPAWN_Z;
        if (!this.addObstacle(lane, 'trainLow', zt)) return;
        const rampZ = zt - SHAPES.trainLow.depth / 2 - SHAPES.ramp.depth / 2 - 0.3;
        this.addObstacle(lane, 'ramp', rampZ, true);
        for (let i = 0; i < 3; i++) {
          this.addCoin(this.laneX(lane), SHAPES.trainLow.h + 0.55, zt - 1 - i * 1.8);
        }
      } else {
        if (!this.addObstacle(lane, 'train', C.SPAWN_Z)) return;
      }
      const z0 = C.SPAWN_Z - 3;
      for (let i = 0; i < 4; i++) {
        this.addCoin(this.laneX(free), 0.9, z0 - i * C.COIN_GAP);
      }
    },

    pickPowerup() {
      const weights = C.POWERUP_WEIGHTS;
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = Math.random() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return 'magnet';
    },

    spawnPowerup() {
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const z = C.SPAWN_Z - 4;
      const type = this.pickPowerup();
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        let blocked = false;
        for (let j = 0; j < this.obstacles.length; j++) {
          const o = this.obstacles[j];
          if (Math.abs(o.x - this.laneX(lane)) < o.w / 2 + 0.4 && Math.abs(o.z - z) < 2.5) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          this.powerups.push({
            type,
            x: this.laneX(lane),
            y: C.POWERUP_Y,
            z,
            spin: Math.random() * 6.28,
            dead: false
          });
          return true;
        }
      }
      return false;
    },

    coinShower() {
      const z0 = 26;
      for (let row = 0; row < 5; row++) {
        const z = z0 - row * 2.6;
        for (let lane = -1; lane <= 1; lane++) {
          this.addCoin(this.laneX(lane), 0.9, z);
        }
      }
    },

    spawnPattern() {
      const t = this.tier();
      const r = Math.random();
      if (r < 0.18) {
        this.coinLine(1 + Math.floor(Math.random() * 3));
      } else if (r < 0.32) {
        this.coinLine(3 + Math.floor(Math.random() * 3));
      } else if (r < 0.45) {
        this.jumpGift();
      } else if (r < 0.56 && t > 0.3) {
        this.slideGift();
      } else if (r < 0.78) {
        this.singleObstacle();
      } else if (r < 0.94) {
        this.pairObstacle();
      } else {
        this.trainRow();
      }
      if (Math.random() < C.POWERUP_CHANCE) {
        this.spawnPowerup();
      }
    }
  });
})();
