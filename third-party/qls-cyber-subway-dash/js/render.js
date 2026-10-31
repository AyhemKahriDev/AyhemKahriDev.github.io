window.SD = window.SD || {};

(function () {
  'use strict';

  const C = window.SD.Config;

  const R = (window.SD.Renderer = {
    canvas: null,
    ctx: null,
    W: 0,
    H: 0,
    dpr: 1,
    focal: 0,
    horizon: 0,
    skyGrad: null,
    groundGrad: null,
    buildings: [],
    clouds: [],
    playerX: 0,
    lastError: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.clouds = [];
      for (let i = 0; i < 6; i++) {
        this.clouds.push({
          x: Math.random(),
          y: 0.06 + Math.random() * 0.2,
          s: 0.6 + Math.random() * 0.9,
          v: 0.004 + Math.random() * 0.01
        });
      }
      window.addEventListener('resize', () => this.resize());
      this.resize();
    },

    resize() {
      const cw = this.canvas.clientWidth || window.innerWidth;
      const ch = this.canvas.clientHeight || window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = cw;
      this.H = ch;
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
      this.canvas.width = Math.round(cw * this.dpr);
      this.canvas.height = Math.round(ch * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.focal = Math.min(this.H * C.FOCAL_RATIO, this.W * C.FOCAL_RATIO_W);
      window.SD.sceneScale = window.SD.clamp(this.W / C.SCENE_SCALE_W, C.SCENE_SCALE_MIN, 1);
      this.horizon = this.H * C.HORIZON_RATIO;

      const sky = this.ctx.createLinearGradient(0, 0, 0, this.horizon + 40);
      sky.addColorStop(0, '#1d2b53');
      sky.addColorStop(0.55, '#6d5d9e');
      sky.addColorStop(1, '#f0a868');
      this.skyGrad = sky;

      const g = this.ctx.createLinearGradient(0, this.horizon, 0, this.H);
      g.addColorStop(0, '#2c333d');
      g.addColorStop(1, '#141922');
      this.groundGrad = g;

      this.genCity();
    },

    genCity() {
      const b = [];
      let x = -30;
      while (x < this.W + 40) {
        const w = 16 + Math.random() * 34;
        const h = 18 + Math.random() * 58;
        b.push({ x, w, h, win: Math.random() > 0.32 });
        x += w + 4;
      }
      this.buildings = b;
    },

    project(x, y, z) {
      const s = this.focal / Math.max(z, 0.7);
      return { x: this.W / 2 + (x - this.camX) * s, y: this.horizon + (C.CAM_H - y) * s, s };
    },

    _scale() { return window.SD.sceneScale || 1; },

    _roadHalf() { return C.ROAD_HALF * this._scale(); },

    _laneHalf() { return (C.LANE_W / 2) * this._scale(); },

    draw(world, player, fx) {
      const ctx = this.ctx;
      this.lastError = null;
      this.playerX = player.x;
      this.camX = (window.SD.Game && window.SD.Game.cameraX) || 0;
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.save();
      if (fx.shake > 0) {
        ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
      }
      this.drawSky(fx.dt || 0.016);
      this.drawCity();
      this.drawTrack(world);
      this.drawEntities(world);
      this.drawMonster(player, world.speed, fx.bite || 0);
      this.drawPlayer(player, world.speed, fx.bite || 0);
      if (fx.bite > 0) this.drawBiteOverlay(player, fx.bite);
      this.drawParticles(world.particles);
      ctx.restore();
      if (fx.flash > 0) {
        ctx.fillStyle = 'rgba(255,60,50,' + Math.min(0.5, fx.flash).toFixed(3) + ')';
        ctx.fillRect(0, 0, this.W, this.H);
      }
      this.drawVignette(world.speed);
    },

    drawSky(dt) {
      const ctx = this.ctx;
      ctx.fillStyle = this.skyGrad;
      ctx.fillRect(0, 0, this.W, this.horizon + 40);

      const sunX = this.W * 0.74;
      const sunY = this.horizon - this.H * 0.09;
      const glowR = this.H * 0.17;
      const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, glowR);
      glow.addColorStop(0, 'rgba(255,220,150,0.9)');
      glow.addColorStop(0.25, 'rgba(255,190,110,0.35)');
      glow.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
      ctx.fillStyle = '#ffe9b8';
      ctx.beginPath();
      ctx.arc(sunX, sunY, this.H * 0.045, 0, 6.283);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,235,225,0.22)';
      for (const c of this.clouds) {
        const cx = ((c.x * (this.W + 260) + dt * c.v * this.W * 50) % (this.W + 260)) - 130;
        const cy = this.horizon - 26 - c.y * this.H;
        const s = c.s;
        ctx.beginPath();
        ctx.arc(cx, cy, 14 * s, 0, 6.283);
        ctx.arc(cx + 16 * s, cy - 6 * s, 11 * s, 0, 6.283);
        ctx.arc(cx + 32 * s, cy, 12 * s, 0, 6.283);
        ctx.fill();
      }
    },

    drawCity() {
      const ctx = this.ctx;
      const off = -window.SD.clamp(this.playerX, -2.4, 2.4) * 7;
      ctx.fillStyle = '#251f3f';
      for (const b of this.buildings) {
        const x = b.x + off;
        ctx.fillRect(x, this.horizon - b.h, b.w, b.h + 2);
        if (b.win) {
          ctx.fillStyle = 'rgba(255,210,140,0.55)';
          const rows = 2 + Math.floor(b.h / 16);
          for (let r = 0; r < rows; r++) {
            ctx.fillRect(x + b.w * 0.2, this.horizon - b.h + 8 + r * 9, 2.5, 3.5);
            ctx.fillRect(x + b.w * 0.55, this.horizon - b.h + 8 + r * 9, 2.5, 3.5);
          }
          ctx.fillStyle = '#251f3f';
        }
      }
      const hz = ctx.createLinearGradient(0, this.horizon - 30, 0, this.horizon);
      hz.addColorStop(0, 'rgba(245,170,120,0)');
      hz.addColorStop(1, 'rgba(245,170,120,0.35)');
      ctx.fillStyle = hz;
      ctx.fillRect(0, this.horizon - 30, this.W, 30);
    },

    drawTrack(world) {
      const ctx = this.ctx;
      const farZ = C.FAR_Z;

      ctx.fillStyle = this.groundGrad;
      ctx.fillRect(-50, this.horizon, this.W + 100, this.H - this.horizon + 50);

      const pFL = this.project(-this._roadHalf(), 0, farZ);
      const pFR = this.project(this._roadHalf(), 0, farZ);
      const pNL = this.project(-this._roadHalf(), 0, 1.2);
      const pNR = this.project(this._roadHalf(), 0, 1.2);
      ctx.fillStyle = '#3d4753';
      ctx.beginPath();
      ctx.moveTo(pFL.x, pFL.y);
      ctx.lineTo(pFR.x, pFR.y);
      ctx.lineTo(pNR.x, Math.max(pNR.y, -20));
      ctx.lineTo(pNL.x, Math.max(pNL.y, -20));
      ctx.closePath();
      ctx.fill();

      // 枕木感的横向纹理，制造速度感
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      for (let z = 2; z < farZ; z += 1.1) {
        const phase = ((z + world.trackOffset) % 4.4) / 4.4;
        if (phase > 0.4) continue;
        const a = this.project(-this._roadHalf(), 0, z);
        const b = this.project(this._roadHalf(), 0, z);
        ctx.globalAlpha = window.SD.clamp(1 - z / farZ, 0.08, 0.5);
        ctx.lineWidth = Math.max(0.5, 0.16 * a.s);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 车道分隔线
      for (const xb of [-(this._laneHalf()), this._laneHalf()]) {
        for (let z = 1.6; z < farZ; z += 0.4) {
          const phase = ((z + world.trackOffset) % 4.4) / 4.4;
          if (phase > 0.45) continue;
          const a = this.project(xb, 0, z);
          const b = this.project(xb, 0, Math.min(z + 0.4, farZ));
          ctx.strokeStyle = 'rgba(255,255,255,' + window.SD.clamp(1 - z / farZ * 0.75, 0.12, 0.85).toFixed(3) + ')';
          ctx.lineWidth = Math.max(1, 0.13 * a.s);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      this.drawSide(world, -1);
      this.drawSide(world, 1);
    },

    drawSide(world, side) {
      const off = world.trackOffset;
      let wp = Math.ceil((1.4 + off) / 9) * 9;
      for (; wp - off < C.FAR_Z; wp += 9) {
        const z = wp - off;
        if (z < 1.4) continue;
        const px = side * (this._roadHalf() + 1.25 * this._scale());
        const idx = Math.abs(Math.round(wp / 9)) + (side > 0 ? 2 : 0);
        const kind = idx % 5;
        if (kind === 0) this._sideLamp(px, z);
        else if (kind === 1) this._sideFlowerbed(px, z);
        else if (kind === 2) this._sideMetro(px, z, side);
        else if (kind === 3) this._sideTree(px, z);
        else this._sideBench(px, z);
      }
    },

    _sideLamp(px, z) {
      const ctx = this.ctx;
      const b = this.project(px, 0, z);
      const t = this.project(px, 3.4, z);
      const w = Math.max(2, 0.35 * b.s);
      ctx.fillStyle = '#59636f';
      ctx.fillRect(b.x - w / 2, t.y, w, b.y - t.y);
      ctx.fillStyle = '#ffcf6e';
      ctx.fillRect(b.x - w / 2, t.y, w, Math.max(1.5, 0.1 * b.s));
    },

    _sideFlowerbed(px, z) {
      const ctx = this.ctx;
      const b = this.project(px, 0, z);
      const w = 1.7 * b.s;
      const rimH = 0.28 * b.s;
      // 花坛石沿
      ctx.fillStyle = '#6b5a44';
      this._roundRectPath(b.x - w / 2, b.y - rimH, w, rimH, Math.min(rimH * 0.4, 0.08 * b.s));
      ctx.fill();
      // 灌木丛
      ctx.fillStyle = '#2e7d43';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(b.x + i * w * 0.28, b.y - rimH - 0.22 * b.s, 0.32 * b.s, 0, 6.283);
        ctx.fill();
      }
      // 花朵彩点，位置随 z 伪随机
      const cols = ['#ff5e7a', '#ffd75e', '#ff9a3d', '#e58cff'];
      for (let i = 0; i < 6; i++) {
        const h1 = Math.sin(z * 12.9898 + i * 78.233) * 43758.5453;
        const h2 = Math.sin(z * 39.346 + i * 11.135) * 24634.6345;
        const fx = b.x + (h1 - Math.floor(h1) - 0.5) * w * 0.8;
        const fy = b.y - rimH - (0.1 + (h2 - Math.floor(h2)) * 0.35) * b.s;
        ctx.fillStyle = cols[i % 4];
        ctx.beginPath();
        ctx.arc(fx, fy, Math.max(1, 0.07 * b.s), 0, 6.283);
        ctx.fill();
      }
    },

    _sideMetro(px, z, side) {
      const ctx = this.ctx;
      const b = this.project(px, 0, z);
      const w = 1.9 * b.s;
      const h = 1.5 * b.s;
      // 入口箱体
      ctx.fillStyle = '#2b3648';
      ctx.fillRect(b.x - w / 2, b.y - h, w, h);
      // 雨棚
      ctx.fillStyle = '#3d4c64';
      ctx.fillRect(b.x - w / 2 - 0.1 * b.s, b.y - h - 0.14 * b.s, w + 0.2 * b.s, 0.14 * b.s);
      // 下行门洞与台阶
      ctx.fillStyle = '#0b101c';
      ctx.fillRect(b.x - w * 0.28, b.y - h * 0.62, w * 0.56, h * 0.62);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, 0.03 * b.s);
      for (let i = 1; i <= 3; i++) {
        const sy = b.y - h * 0.62 + (h * 0.62 / 4) * i;
        ctx.beginPath();
        ctx.moveTo(b.x - w * 0.28, sy);
        ctx.lineTo(b.x + w * 0.28, sy);
        ctx.stroke();
      }
      // 蓝色 M 标识牌
      const signS = 0.5 * b.s;
      const sx = b.x - side * w * 0.1;
      const sy = b.y - h - 0.14 * b.s - signS;
      ctx.fillStyle = '#1c6dd9';
      this._roundRectPath(sx - signS / 2, sy, signS, signS, signS * 0.18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(signS * 0.62) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', sx, sy + signS * 0.54);
    },

    _sideTree(px, z) {
      const ctx = this.ctx;
      const b = this.project(px, 0, z);
      const tw = Math.max(1.5, 0.18 * b.s);
      const th = 1.1 * b.s;
      // 树干
      ctx.fillStyle = '#5d4630';
      ctx.fillRect(b.x - tw / 2, b.y - th, tw, th);
      // 树冠
      ctx.fillStyle = '#256b3a';
      ctx.beginPath();
      ctx.arc(b.x, b.y - th - 0.45 * b.s, 0.55 * b.s, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#2e7d43';
      ctx.beginPath();
      ctx.arc(b.x - 0.3 * b.s, b.y - th - 0.2 * b.s, 0.38 * b.s, 0, 6.283);
      ctx.arc(b.x + 0.32 * b.s, b.y - th - 0.22 * b.s, 0.36 * b.s, 0, 6.283);
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(120,200,140,0.5)';
      ctx.beginPath();
      ctx.arc(b.x - 0.15 * b.s, b.y - th - 0.6 * b.s, 0.18 * b.s, 0, 6.283);
      ctx.fill();
    },

    _sideBench(px, z) {
      const ctx = this.ctx;
      const b = this.project(px, 0, z);
      const w = 1.5 * b.s;
      const seatH = 0.42 * b.s;
      const plank = 0.09 * b.s;
      // 椅腿
      ctx.fillStyle = '#3a4250';
      ctx.fillRect(b.x - w * 0.38, b.y - seatH, plank, seatH);
      ctx.fillRect(b.x + w * 0.38 - plank, b.y - seatH, plank, seatH);
      // 坐板与靠背
      ctx.fillStyle = '#8a6a42';
      this._roundRectPath(b.x - w / 2, b.y - seatH - plank, w, plank, plank * 0.4);
      ctx.fill();
      ctx.fillRect(b.x - w / 2, b.y - seatH - plank - 0.4 * b.s, plank, 0.4 * b.s);
      ctx.fillRect(b.x + w / 2 - plank, b.y - seatH - plank - 0.4 * b.s, plank, 0.4 * b.s);
      this._roundRectPath(b.x - w / 2, b.y - seatH - plank - 0.42 * b.s, w, plank, plank * 0.4);
      ctx.fill();
    },

    drawEntities(world) {
      const items = [];
      for (const o of world.obstacles) items.push({ z: o.z, draw: () => this._drawObstacle(o) });
      for (const c of world.coins) items.push({ z: c.z, draw: () => this._drawCoin(c) });
      for (const p of world.powerups) items.push({ z: p.z, draw: () => this._drawPowerup(p) });
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        try {
          it.draw();
        } catch (err) {
          if (!this.lastError) this.lastError = err;
        }
      }
    },

    _roundRectPath(x, y, w, h, r) {
      const ctx = this.ctx;
      const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.arcTo(x + w, y, x + w, y + rr, rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
      ctx.lineTo(x + rr, y + h);
      ctx.arcTo(x, y + h, x, y + h - rr, rr);
      ctx.lineTo(x, y + rr);
      ctx.arcTo(x, y, x + rr, y, rr);
      ctx.closePath();
    },

    _clipRoundRect(x, y, w, h, r) {
      const ctx = this.ctx;
      ctx.save();
      this._roundRectPath(x, y, w, h, r);
      ctx.clip();
    },

    _shadow(x, yWorld, z, w) {
      const ctx = this.ctx;
      const p = this.project(x, yWorld, z);
      const r = Math.max(2, w * p.s * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, 6.283);
      ctx.fill();
    },

    _drawObstacle(o) {
      const p = this.project(o.x, 0, o.z);
      const w = o.w * p.s;
      if (o.type === 'low') {
        this._shadow(o.x, 0, o.z, o.w * 0.8);
        const h = o.h * p.s;
        const r = Math.min(0.12 * p.s, h * 0.25);
        const grad = this.ctx.createLinearGradient(0, p.y - h, 0, p.y);
        grad.addColorStop(0, '#e2604f');
        grad.addColorStop(1, '#b02f26');
        this._clipRoundRect(p.x - w / 2, p.y - h, w, h, r);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(p.x - w / 2, p.y - h, w, h);
        this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = -1; i < 4; i++) {
          this.ctx.save();
          this.ctx.translate(p.x - w / 2 + i * h * 0.8, p.y - h);
          this.ctx.rotate(-0.5);
          this.ctx.fillRect(0, -h * 0.4, h * 0.45, h * 2);
          this.ctx.restore();
        }
        this.ctx.restore();
        this.ctx.strokeStyle = 'rgba(60,20,15,0.6)';
        this.ctx.lineWidth = Math.max(1, 0.05 * p.s);
        this._roundRectPath(p.x - w / 2, p.y - h, w, h, r);
        this.ctx.stroke();
        return;
      }

      if (o.type === 'high') {
        this._shadow(o.x, 0, o.z, o.w * 0.9);
        const b0 = this.project(o.x, o.h0, o.z).y;
        const b1 = this.project(o.x, o.h, o.z).y;
        const lw = Math.max(2, 0.13 * p.s);
        this.ctx.fillStyle = '#7d8796';
        this.ctx.fillRect(p.x - w / 2 + 0.08 * w, p.y, lw, b0 - p.y);
        this.ctx.fillRect(p.x + w / 2 - 0.08 * w - lw, p.y, lw, b0 - p.y);

        const bh = b0 - b1;
        const br = Math.min(0.1 * p.s, bh * 0.3);
        this._clipRoundRect(p.x - w / 2, b1, w, bh, br);
        this.ctx.fillStyle = '#f2c14e';
        this.ctx.fillRect(p.x - w / 2, b1, w, bh);
        this.ctx.fillStyle = '#22252c';
        for (let i = -1; i < 6; i++) {
          this.ctx.save();
          this.ctx.translate(p.x - w / 2 + i * bh * 0.9, b1);
          this.ctx.rotate(-0.45);
          this.ctx.fillRect(0, 0, bh * 0.5, bh * 3);
          this.ctx.restore();
        }
        this.ctx.restore();
        this.ctx.strokeStyle = 'rgba(30,30,35,0.7)';
        this.ctx.lineWidth = Math.max(1, 0.05 * p.s);
        this._roundRectPath(p.x - w / 2, b1, w, bh, br);
        this.ctx.stroke();

        this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let k = 0; k < 3; k++) {
          const cx = p.x - w * 0.3 + k * w * 0.3;
          const cy = b1 + bh * 0.5;
          const sz = Math.max(2, 0.16 * p.s);
          this.ctx.beginPath();
          this.ctx.moveTo(cx - sz, cy - sz * 0.5);
          this.ctx.lineTo(cx + sz, cy - sz * 0.5);
          this.ctx.lineTo(cx, cy + sz * 0.7);
          this.ctx.closePath();
          this.ctx.fill();
        }
        return;
      }

      if (o.type === 'ramp') {
        this._drawRamp(o);
        return;
      }

      if (o.type === 'trainLow') {
        this._drawFreight(o);
        return;
      }

      this._drawTrainFace(o, p, w, o.type === 'train');
    },

    _drawRamp(o) {
      const ctx = this.ctx;
      const zN = o.z - o.depth / 2;
      const zF = o.z + o.depth / 2;
      const pn = this.project(o.x, 0, zN);
      const pf = this.project(o.x, o.h, zF);
      const pf0 = this.project(o.x, 0, zF);
      const wn = o.w * pn.s;
      const wf = o.w * pf.s;
      // 两侧三角封板
      ctx.fillStyle = '#7a6220';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(pn.x + s * wn / 2, pn.y);
        ctx.lineTo(pf.x + s * wf / 2, pf.y);
        ctx.lineTo(pf0.x + s * wf / 2, pf0.y);
        ctx.closePath();
        ctx.fill();
      }
      // 坡面
      const grad = ctx.createLinearGradient(0, pf.y, 0, pn.y);
      grad.addColorStop(0, '#e8b93c');
      grad.addColorStop(1, '#b98f2a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pn.x - wn / 2, pn.y);
      ctx.lineTo(pn.x + wn / 2, pn.y);
      ctx.lineTo(pf.x + wf / 2, pf.y);
      ctx.lineTo(pf.x - wf / 2, pf.y);
      ctx.closePath();
      ctx.fill();
      // 黑色警示条纹
      ctx.strokeStyle = 'rgba(20,20,25,0.65)';
      ctx.lineWidth = Math.max(1, 0.06 * pn.s);
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const xA = window.SD.lerp(pn.x, pf.x, t);
        const yA = window.SD.lerp(pn.y, pf.y, t);
        const wA = window.SD.lerp(wn, wf, t);
        ctx.beginPath();
        ctx.moveTo(xA - wA / 2, yA);
        ctx.lineTo(xA + wA / 2, yA);
        ctx.stroke();
      }
    },

    _drawFreight(o) {
      const ctx = this.ctx;
      const p = this.project(o.x, 0, o.z);
      const w = o.w * p.s;
      const h = o.h * p.s;
      this._shadow(o.x, 0, o.z, o.w * 0.9);
      // 尾部延伸，制造车厢长度感
      const zb = o.z + o.depth * 0.92;
      const pb = this.project(o.x, 0, zb);
      const wb = o.w * pb.s;
      const hb = o.h * pb.s;
      ctx.fillStyle = '#2c2318';
      ctx.fillRect(pb.x - wb / 2, pb.y - hb, wb, hb);
      // 车顶面（相机高于车厢，顶面可见，即可行走区）
      ctx.fillStyle = '#6e5433';
      ctx.beginPath();
      ctx.moveTo(pb.x - wb / 2, pb.y - hb);
      ctx.lineTo(pb.x + wb / 2, pb.y - hb);
      ctx.lineTo(p.x + w / 2, p.y - h);
      ctx.lineTo(p.x - w / 2, p.y - h);
      ctx.closePath();
      ctx.fill();
      // 两侧面
      ctx.fillStyle = '#4a3826';
      ctx.beginPath();
      ctx.moveTo(pb.x - wb / 2, pb.y - hb);
      ctx.lineTo(p.x - w / 2, p.y - h);
      ctx.lineTo(p.x - w / 2, p.y);
      ctx.lineTo(pb.x - wb / 2, pb.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a2c1e';
      ctx.beginPath();
      ctx.moveTo(pb.x + wb / 2, pb.y - hb);
      ctx.lineTo(p.x + w / 2, p.y - h);
      ctx.lineTo(p.x + w / 2, p.y);
      ctx.lineTo(pb.x + wb / 2, pb.y);
      ctx.closePath();
      ctx.fill();
      // 前脸
      const grad = ctx.createLinearGradient(0, p.y - h, 0, p.y);
      grad.addColorStop(0, '#8a6a44');
      grad.addColorStop(1, '#5f482c');
      const r = Math.min(0.14 * p.s, h * 0.12);
      this._roundRectPath(p.x - w / 2, p.y - h, w, h, r);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(25,18,10,0.6)';
      ctx.lineWidth = Math.max(1, 0.05 * p.s);
      ctx.stroke();
      // 竖向筋板
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 1; k <= 3; k++) {
        ctx.fillRect(p.x - w / 2 + (w / 4) * k - 0.03 * p.s, p.y - h, 0.06 * p.s, h);
      }
      // 车顶亮边，提示可站立
      ctx.fillStyle = '#c9a86a';
      ctx.fillRect(p.x - w / 2, p.y - h, w, Math.max(1.5, 0.07 * p.s));
    },

    _drawTrainFace(o, p, w, long) {
      const ctx = this.ctx;
      this._shadow(o.x, 0, o.z, o.w * 0.9);
      const h = o.h * p.s;

      if (long) {
        const zb = o.z + o.depth * 0.92;
        const pb = this.project(o.x, 0, zb);
        const wb = o.w * pb.s;
        const hb = o.h * pb.s;
        ctx.fillStyle = '#182838';
        ctx.fillRect(pb.x - wb / 2, pb.y - hb, wb, hb);
        ctx.fillStyle = '#223a52';
        ctx.beginPath();
        ctx.moveTo(pb.x - wb / 2, pb.y - hb);
        ctx.lineTo(p.x - w / 2, p.y - h);
        ctx.lineTo(p.x - w / 2, p.y);
        ctx.lineTo(pb.x - wb / 2, pb.y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(pb.x + wb / 2, pb.y - hb);
        ctx.lineTo(p.x + w / 2, p.y - h);
        ctx.lineTo(p.x + w / 2, p.y);
        ctx.lineTo(pb.x + wb / 2, pb.y);
        ctx.closePath();
        ctx.fill();
      }

      const grad = ctx.createLinearGradient(0, p.y - h, 0, p.y);
      grad.addColorStop(0, '#3f71a8');
      grad.addColorStop(0.75, '#2b4f79');
      grad.addColorStop(1, '#1d3552');
      const r = Math.min(0.2 * p.s, h * 0.14);
      this._roundRectPath(p.x - w / 2, p.y - h, w, h, r);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,35,0.6)';
      ctx.lineWidth = Math.max(1, 0.06 * p.s);
      ctx.stroke();

      ctx.fillStyle = '#bfe3ff';
      const winW = w * 0.34;
      const winH = h * 0.22;
      for (let k = 0; k < 2; k++) {
        const wx = p.x - w * 0.16 + k * w * 0.32 - winW / 2;
        const wy = p.y - h * 0.72;
        this._roundRectPath(wx, wy, winW, winH, Math.max(1, 0.06 * p.s));
        ctx.fill();
      }

      for (const s of [-1, 1]) {
        ctx.fillStyle = 'rgba(255,233,168,0.35)';
        ctx.beginPath();
        ctx.arc(p.x + s * w * 0.28, p.y - h * 0.16, Math.max(4, 0.24 * p.s), 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(p.x + s * w * 0.28, p.y - h * 0.16, Math.max(2, 0.11 * p.s), 0, 6.283);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(15,25,40,0.85)';
      ctx.fillRect(p.x - w / 2 + w * 0.06, p.y - h * 0.1, w * 0.88, h * 0.1);
      ctx.fillStyle = '#16283c';
      this._roundRectPath(p.x - w / 2, p.y - h, w, h * 0.12, Math.min(0.2 * p.s, h * 0.05));
      ctx.fill();
    },

    _drawCoin(c) {
      const ctx = this.ctx;
      const p = this.project(c.x, c.y, c.z);
      const r = Math.max(1.5, 0.3 * p.s);
      const rx = r * Math.max(0.14, Math.abs(Math.cos(c.spin)));

      ctx.fillStyle = 'rgba(255,215,94,0.16)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.9, 0, 6.283);
      ctx.fill();

      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, '#fff3b0');
      grad.addColorStop(0.6, '#ffd75e');
      grad.addColorStop(1, '#dd9518');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, r, 0, 0, 6.283);
      ctx.fill();

      ctx.strokeStyle = 'rgba(140,90,10,0.8)';
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(0.8, r * 0.07);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.55, r * 0.55, 0, 0, 6.283);
      ctx.stroke();
    },

    drawPlayer(player, speed, press) {
      const ctx = this.ctx;
      const p0 = this.project(player.x, player.y, C.PLAYER_Z);
      const u = p0.s;
      press = press || 0;
      const py = p0.y + press * u * 0.3;
      const groundY = this.project(player.x, player.onGround ? player.y : 0, C.PLAYER_Z).y + press * u * 0.3;
      const sh = Math.max(2, 0.5 * u * (1 - Math.min(1, player.y / 4) * 0.45));
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(p0.x, groundY, sh, sh * 0.28, 0, 0, 6.283);
      ctx.fill();

      ctx.save();
      ctx.translate(p0.x, py);
      if (!player.sliding) {
        ctx.rotate(0.1 + Math.min(0.05, speed * 0.0015));
      }
      ctx.scale(1, 1 - press * 0.16);
      this._drawRunner(player, u);
      ctx.restore();
    },

    _drawRunner(player, u) {
      const ctx = this.ctx;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(8,14,24,0.9)';
      ctx.shadowBlur = Math.max(2, 0.05 * u);
      const skin = '#f2c9a0';
      const jacket = '#ff7a1a';
      const pants = '#3f6db5';
      const shoe = '#101a2b';

      if (player.sliding) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(0, -0.28 * u, 0.7 * u, 0.3 * u, 0, 0, 6.283);
        ctx.fill();
        ctx.strokeStyle = pants;
        ctx.lineWidth = 0.17 * u;
        ctx.beginPath();
        ctx.moveTo(-0.45 * u, -0.42 * u);
        ctx.lineTo(-0.95 * u, -0.2 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-0.35 * u, -0.5 * u);
        ctx.lineTo(-0.7 * u, -0.62 * u);
        ctx.stroke();
        ctx.fillStyle = jacket;
        this._roundRectPath(-0.72 * u, -0.62 * u, 1.15 * u, 0.42 * u, 0.2 * u);
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(0.42 * u, -0.62 * u, 0.2 * u, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(0.42 * u, -0.68 * u, 0.21 * u, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(0.58 * u, -0.66 * u, 0.18 * u, 0.05 * u);
        if (player.hit) this._drawX(0.42 * u, -0.62 * u, 0.06 * u);
        ctx.shadowBlur = 0;
        return;
      }

      const swing = Math.sin(player.runPhase) * 0.5 * u;
      const bob = Math.abs(Math.sin(player.runPhase)) * 0.05 * u;
      ctx.translate(0, -bob);

      if (!player.onGround) {
        ctx.strokeStyle = pants;
        ctx.lineWidth = 0.17 * u;
        ctx.beginPath();
        ctx.moveTo(-0.08 * u, -0.85 * u);
        ctx.lineTo(-0.3 * u, -0.45 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.08 * u, -0.85 * u);
        ctx.lineTo(0.32 * u, -0.5 * u);
        ctx.stroke();
      } else {
        ctx.strokeStyle = pants;
        ctx.lineWidth = 0.17 * u;
        ctx.beginPath();
        ctx.moveTo(-0.06 * u, -0.9 * u);
        ctx.lineTo(swing, -0.02 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.06 * u, -0.9 * u);
        ctx.lineTo(-swing, -0.02 * u);
        ctx.stroke();
        ctx.fillStyle = shoe;
        ctx.beginPath();
        ctx.ellipse(swing, -0.01 * u, 0.12 * u, 0.05 * u, 0, 0, 6.283);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-swing, -0.01 * u, 0.12 * u, 0.05 * u, 0, 0, 6.283);
        ctx.fill();
      }

      const grad = ctx.createLinearGradient(0, -1.6 * u, 0, -0.9 * u);
      grad.addColorStop(0, '#ff8d3a');
      grad.addColorStop(1, '#e8601c');
      ctx.fillStyle = grad;
      this._roundRectPath(-0.34 * u, -1.55 * u, 0.68 * u, 0.68 * u, 0.2 * u);
      ctx.fill();

      ctx.strokeStyle = jacket;
      ctx.lineWidth = 0.14 * u;
      if (!player.onGround) {
        ctx.beginPath();
        ctx.moveTo(-0.22 * u, -1.5 * u);
        ctx.lineTo(-0.55 * u, -1.2 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.22 * u, -1.5 * u);
        ctx.lineTo(0.55 * u, -1.35 * u);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-0.22 * u, -1.5 * u);
        ctx.lineTo(-swing * 0.7 - 0.1 * u, -1.15 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.22 * u, -1.5 * u);
        ctx.lineTo(swing * 0.7 + 0.1 * u, -1.15 * u);
        ctx.stroke();
      }

      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0.02 * u, -1.72 * u, 0.21 * u, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(0.02 * u, -1.78 * u, 0.22 * u, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(0.2 * u, -1.74 * u, 0.2 * u, 0.05 * u);
      if (player.hit) this._drawX(0.02 * u, -1.72 * u, 0.06 * u);
      ctx.shadowBlur = 0;
    },

    _drawX(x, y, r) {
      const ctx = this.ctx;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    },

    makeIconDataURL(type, size) {
      const s = size || 40;
      const cv = document.createElement('canvas');
      cv.width = s;
      cv.height = s;
      const ctx = cv.getContext('2d');
      ctx.translate(s / 2, s / 2);
      ctx.scale(s / 64, s / 64);
      const icons = {
        magnet: this._iconMagnet,
        shield: this._iconShield,
        dash: this._iconDash,
        doubleCoins: this._iconDouble,
        slowmo: this._iconSlowmo,
        spring: this._iconSpring,
        coinShower: this._iconShower,
        extraLife: this._iconLife
      };
      (icons[type] || this._iconMagnet).call(this, ctx);
      return cv.toDataURL();
    },

    _drawPowerup(pu) {
      const ctx = this.ctx;
      const p = this.project(pu.x, pu.y, pu.z);
      const sz = Math.max(10, 0.62 * p.s);
      const bob = Math.sin(pu.spin * 2) * sz * 0.04;
      const cx = p.x;
      const cy = p.y + bob;
      const colors = {
        magnet: '#ff5e5e',
        shield: '#4fc3f7',
        dash: '#ffd60a',
        doubleCoins: '#b388ff',
        slowmo: '#4dd0e1',
        spring: '#8bc34a',
        coinShower: '#ffd75e',
        extraLife: '#ff4d6d'
      };
      const c = colors[pu.type] || '#ffffff';
      const glow = ctx.createRadialGradient(cx, cy, sz * 0.1, cx, cy, sz * 0.85);
      glow.addColorStop(0, 'rgba(255,255,255,0.5)');
      glow.addColorStop(0.35, 'rgba(255,255,255,0.16)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.85, 0, 6.283);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sz / 64, sz / 64);
      const icons = {
        magnet: this._iconMagnet,
        shield: this._iconShield,
        dash: this._iconDash,
        doubleCoins: this._iconDouble,
        slowmo: this._iconSlowmo,
        spring: this._iconSpring,
        coinShower: this._iconShower,
        extraLife: this._iconLife
      };
      (icons[pu.type] || this._iconMagnet).call(this, ctx);
      ctx.restore();
    },

    _iconMagnet(ctx) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.lineTo(-14, 6);
      ctx.arc(0, 6, 14, Math.PI, 0, false);
      ctx.lineTo(14, -22);
      ctx.stroke();
      ctx.strokeStyle = '#c1121f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.arc(0, 6, 14, Math.PI, 0, false);
      ctx.lineTo(14, -22);
      ctx.stroke();
      ctx.fillStyle = '#cfd8e3';
      ctx.fillRect(-19, -27, 9, 8);
      ctx.fillRect(10, -27, 9, 8);
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath();
      ctx.arc(-22, 16, 4, 0, 6.283);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(22, 20, 3, 0, 6.283);
      ctx.fill();
    },

    _iconShield(ctx) {
      ctx.fillStyle = 'rgba(79,195,247,0.35)';
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(22, -14);
      ctx.lineTo(22, 8);
      ctx.lineTo(0, 26);
      ctx.lineTo(-22, 8);
      ctx.lineTo(-22, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, 6.283);
      ctx.stroke();
    },

    _iconDash(ctx) {
      ctx.fillStyle = '#ff9e2c';
      ctx.beginPath();
      ctx.moveTo(-26, 12);
      ctx.lineTo(-20, 12);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-16, 0);
      ctx.lineTo(-20, -16);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-14, 4);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.moveTo(2, -28);
      ctx.lineTo(14, 2);
      ctx.lineTo(6, 2);
      ctx.lineTo(12, 28);
      ctx.lineTo(-12, -2);
      ctx.lineTo(-2, -2);
      ctx.lineTo(-10, -28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,20,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-2, -30);
      ctx.lineTo(20, -30);
      ctx.moveTo(-8, -34);
      ctx.lineTo(16, -34);
      ctx.stroke();
    },

    _iconDouble(ctx) {
      ctx.fillStyle = '#9b5cff';
      ctx.strokeStyle = '#6d3fc7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const r = 24;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd75e';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2x', 0, 1);
      ctx.beginPath();
      ctx.arc(-20, -16, 3.5, 0, 6.283);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, -16, 3, 0, 6.283);
      ctx.fill();
    },

    _iconSlowmo(ctx) {
      ctx.strokeStyle = '#26c6da';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, -24);
      ctx.lineTo(18, -24);
      ctx.lineTo(18, -20);
      ctx.lineTo(-18, -20);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 20);
      ctx.lineTo(18, 20);
      ctx.lineTo(18, 24);
      ctx.lineTo(-18, 24);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(77,208,225,0.55)';
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(14, -18);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14, 18);
      ctx.lineTo(14, 18);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0f7fa';
      ctx.beginPath();
      ctx.moveTo(-8, -18);
      ctx.lineTo(8, -18);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, 18);
      ctx.lineTo(8, 18);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
    },

    _iconSpring(ctx) {
      ctx.fillStyle = '#7cb342';
      ctx.strokeStyle = '#558b2f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, -14);
      ctx.quadraticCurveTo(-20, -26, 0, -24);
      ctx.quadraticCurveTo(20, -22, 20, -10);
      ctx.quadraticCurveTo(20, -2, 12, -2);
      ctx.lineTo(-12, -2);
      ctx.quadraticCurveTo(-20, -2, -20, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#b0bec5';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-4, 2);
      ctx.lineTo(2, 10);
      ctx.lineTo(8, 2);
      ctx.lineTo(14, 8);
      ctx.lineTo(16, 4);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8, -16, 3, 0, 6.283);
      ctx.fill();
    },

    _iconShower(ctx) {
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath();
      ctx.arc(-14, -8, 12, 0, 6.283);
      ctx.arc(0, -14, 14, 0, 6.283);
      ctx.arc(14, -8, 12, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(-18, -6, 6, 0, 6.283);
      ctx.arc(18, -6, 6, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#ffd75e';
      ctx.strokeStyle = '#e09a1f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-10, 10, 5, 0, 6.283);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4, 16, 5, 0, 6.283);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, 10, 4, 0, 6.283);
      ctx.fill();
      ctx.stroke();
    },

    _iconLife(ctx) {
      ctx.fillStyle = '#ff4d6d';
      ctx.strokeStyle = '#c9184a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.bezierCurveTo(-26, 2, -16, -24, 0, -12);
      ctx.bezierCurveTo(16, -24, 26, 2, 0, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-8, -8, 5, 3, -0.6, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = '#ffd75e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, 6.283);
      ctx.stroke();
    },

    drawVignette(speed) {
      const tier = window.SD.clamp((speed - C.START_SPEED) / (C.MAX_SPEED - C.START_SPEED), 0, 1);
      if (tier < 0.05) return;
      const ctx = this.ctx;
      const a = tier * 0.16;
      const g = ctx.createRadialGradient(this.W / 2, this.H * 0.45, this.H * 0.35, this.W / 2, this.H * 0.5, this.H * 0.75);
      g.addColorStop(0, 'rgba(120,20,20,0)');
      g.addColorStop(1, 'rgba(120,20,20,' + a.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    },

    drawMonster(player, speed, bite) {
      const ctx = this.ctx;
      const tier = window.SD.clamp((speed - C.START_SPEED) / (C.MAX_SPEED - C.START_SPEED), 0, 1);
      const p = this.project(player.x, player.y, C.PLAYER_Z);
      const u = p.s;
      const playerH = C.PLAYER_HEIGHT * u;
      const time = performance.now() / 1000;
      if (this.monsterX === undefined) this.monsterX = player.x;
      this.monsterX += (player.x - this.monsterX) * 0.06;
      const mp = this.project(this.monsterX, 0, C.PLAYER_Z);
      const feetY = window.SD.lerp(C.MONSTER_FEET_MAX * this.H, C.MONSTER_FEET_MIN * this.H, tier);
      const mh = window.SD.lerp(C.MONSTER_SCALE_MIN, C.MONSTER_SCALE_MAX, tier) * playerH;
      const bob = Math.sin(time * 10) * mh * 0.03;
      const groundY = feetY + bob;
      const cx = mp.x + Math.sin(time * 1.7) * u * 0.04;
      ctx.globalAlpha = bite > 0 ? Math.max(0, 1 - bite / 0.2) : 1;
      ctx.fillStyle = 'rgba(8,12,24,0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, groundY, mh * 0.3, mh * 0.38, 0, 0, 6.283);
      ctx.fill();
      this._monsterBody(ctx, cx, groundY, u, mh, time);
      const headS = mh * 0.34;
      const headY = groundY - mh * 0.72;
      const headX = cx + Math.sin(time * 2.2) * u * 0.02;
      const open = 0.12 + Math.sin(time * 2.9) * 0.06;
      this._monsterHead(ctx, headX, headY, headS, open, time);
      ctx.globalAlpha = 1;
    },

    _monsterBody(ctx, cx, groundY, u, bodyH, time) {
      const s = bodyH;
      const topY = groundY - s;
      const stride = Math.sin(time * 10);
      const grad = ctx.createLinearGradient(0, topY, 0, groundY);
      grad.addColorStop(0, '#27314a');
      grad.addColorStop(0.4, '#11151f');
      grad.addColorStop(1, '#04060a');

      // 双腿奔跑跨步
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#05070c';
      ctx.lineWidth = s * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.1, groundY - s * 0.45);
      ctx.quadraticCurveTo(cx - s * 0.24, groundY - s * 0.2, cx - s * 0.1 + stride * s * 0.16, groundY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.1, groundY - s * 0.45);
      ctx.quadraticCurveTo(cx + s * 0.24, groundY - s * 0.2, cx + s * 0.1 - stride * s * 0.16, groundY);
      ctx.stroke();

      // 躯干：宽肩收腰倒三角，驼背前探
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.16, groundY - s * 0.38);
      ctx.quadraticCurveTo(cx - s * 0.52, groundY - s * 0.5, cx - s * 0.5, groundY - s * 0.78);
      ctx.quadraticCurveTo(cx - s * 0.46, groundY - s * 0.98, cx - s * 0.18, groundY - s * 1.0);
      ctx.quadraticCurveTo(cx, groundY - s * 1.04, cx + s * 0.18, groundY - s * 1.0);
      ctx.quadraticCurveTo(cx + s * 0.46, groundY - s * 0.98, cx + s * 0.5, groundY - s * 0.78);
      ctx.quadraticCurveTo(cx + s * 0.52, groundY - s * 0.5, cx + s * 0.16, groundY - s * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,170,255,0.4)';
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.stroke();

      // 白色血管纹路，沿躯干蔓延
      ctx.strokeStyle = 'rgba(225,235,248,0.45)';
      ctx.lineWidth = Math.max(1, s * 0.016);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * s * 0.05, groundY - s * 0.92);
        ctx.quadraticCurveTo(cx + side * s * 0.2, groundY - s * 0.75, cx + side * s * 0.3, groundY - s * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + side * s * 0.18, groundY - s * 0.76);
        ctx.quadraticCurveTo(cx + side * s * 0.3, groundY - s * 0.78, cx + side * s * 0.38, groundY - s * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + side * s * 0.1, groundY - s * 0.55);
        ctx.quadraticCurveTo(cx + side * s * 0.22, groundY - s * 0.48, cx + side * s * 0.28, groundY - s * 0.42);
        ctx.stroke();
      }

      // 胸前白色蜘蛛纹
      const ey0 = groundY - s * 0.86;
      ctx.fillStyle = 'rgba(240,244,252,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx, ey0 - s * 0.05);
      ctx.lineTo(cx - s * 0.06, ey0 + s * 0.04);
      ctx.lineTo(cx - s * 0.2, ey0 - s * 0.02);
      ctx.lineTo(cx - s * 0.08, ey0 + s * 0.1);
      ctx.lineTo(cx - s * 0.16, ey0 + s * 0.16);
      ctx.lineTo(cx, ey0 + s * 0.08);
      ctx.lineTo(cx + s * 0.16, ey0 + s * 0.16);
      ctx.lineTo(cx + s * 0.08, ey0 + s * 0.1);
      ctx.lineTo(cx + s * 0.2, ey0 - s * 0.02);
      ctx.lineTo(cx + s * 0.06, ey0 + s * 0.04);
      ctx.closePath();
      ctx.fill();

      // 双臂前伸抓向人物，末端三根白爪
      for (const side of [-1, 1]) {
        const reach = stride * side;
        const hx = cx + side * s * (0.62 + 0.05 * reach);
        const hy = groundY - s * (0.62 + 0.1 * reach);
        ctx.strokeStyle = '#05070c';
        ctx.lineWidth = s * 0.13;
        ctx.beginPath();
        ctx.moveTo(cx + side * s * 0.42, groundY - s * 0.86);
        ctx.quadraticCurveTo(cx + side * s * 0.68, groundY - s * 0.72, hx, hy);
        ctx.stroke();
        ctx.strokeStyle = '#e8edf5';
        ctx.lineWidth = Math.max(1, s * 0.028);
        for (let c = -1; c <= 1; c++) {
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + side * s * 0.16, hy + c * s * 0.07 + s * 0.02);
          ctx.stroke();
        }
      }

      // 体表黏液高光滴
      ctx.fillStyle = 'rgba(120,160,235,0.4)';
      for (let i = 0; i < 3; i++) {
        const gx = cx + (i - 1) * s * 0.3;
        const gy = groundY - s * 0.3 - ((time * (0.8 + i * 0.3) + i) % 1) * s * 0.35;
        ctx.beginPath();
        ctx.arc(gx, gy, s * 0.04, 0, 6.283);
        ctx.fill();
      }
    },

    _monsterHead(ctx, cx, cy, s, mouthOpen, time) {
      // 油亮黑色共生体头颅
      const grad = ctx.createRadialGradient(cx - s * 0.25, cy - s * 0.35, s * 0.15, cx, cy, s * 1.15);
      grad.addColorStop(0, '#2c3650');
      grad.addColorStop(0.5, '#0c1018');
      grad.addColorStop(1, '#020306');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.1, s * 0.92, s * 0.85, 0, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,170,255,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.stroke();

      const open = mouthOpen * s;
      const mouthY = cy + s * 0.28;

      // 血盆大口裂至耳根，暗红口腔
      ctx.fillStyle = '#3d0a10';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.9, mouthY - s * 0.26);
      ctx.quadraticCurveTo(cx - s * 0.45, mouthY + s * 0.06, cx, mouthY + s * 0.12 + open);
      ctx.quadraticCurveTo(cx + s * 0.45, mouthY + s * 0.06, cx + s * 0.9, mouthY - s * 0.26);
      ctx.quadraticCurveTo(cx, mouthY - s * 0.32 + open * 0.4, cx - s * 0.9, mouthY - s * 0.26);
      ctx.closePath();
      ctx.fill();

      // 上下两排交错尖牙，沿裂口弧度排布
      ctx.fillStyle = '#f4f7fb';
      const teeth = 11;
      for (let i = 0; i < teeth; i++) {
        const t = (i + 0.5) / teeth;
        const arc = 4 * t * (1 - t);
        const x = cx - s * 0.9 + t * s * 1.8;
        const len = (i % 2 === 0 ? 1.7 : 1.0) * s * 0.11;
        const hw = s * 0.06;
        const yu = (mouthY - s * 0.26) + arc * (open * 0.4 - s * 0.06);
        ctx.beginPath();
        ctx.moveTo(x - hw, yu);
        ctx.lineTo(x, yu + len);
        ctx.lineTo(x + hw, yu);
        ctx.closePath();
        ctx.fill();
        const yl = (mouthY - s * 0.26) + arc * (s * 0.38 + open);
        ctx.beginPath();
        ctx.moveTo(x - hw, yl);
        ctx.lineTo(x, yl - len * 0.9);
        ctx.lineTo(x + hw, yl);
        ctx.closePath();
        ctx.fill();
      }

      // 长舌挥舞
      const wag = Math.sin(time * 6) * s * 0.25;
      const tipX = cx + s * 0.3 + wag;
      const tipY = mouthY + s * 0.28 + open + Math.abs(Math.sin(time * 3)) * s * 0.2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#c2334a';
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx, mouthY + s * 0.05 + open * 0.5);
      ctx.quadraticCurveTo(cx + s * 0.2 + wag * 0.5, mouthY + s * 0.3 + open, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = '#e0586e';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx, mouthY + s * 0.05 + open * 0.5);
      ctx.quadraticCurveTo(cx + s * 0.2 + wag * 0.5, mouthY + s * 0.3 + open, tipX, tipY);
      ctx.stroke();
      // 舌尖分叉
      ctx.strokeStyle = '#c2334a';
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + s * 0.16, tipY - s * 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + s * 0.11, tipY + s * 0.13);
      ctx.stroke();

      // 牙缝滴落绿色黏液
      for (let i = 0; i < 4; i++) {
        const dx = cx - s * 0.6 + ((i + 0.5) / 4) * s * 1.2;
        const fall = (time * (0.5 + i * 0.17) + i * 0.4) % 1;
        const dy = mouthY + s * 0.1 + open + fall * s * 0.5;
        ctx.globalAlpha = (1 - fall) * 0.85;
        ctx.fillStyle = '#78e696';
        ctx.beginPath();
        ctx.ellipse(dx, dy, s * 0.035, s * (0.05 + fall * 0.04), 0, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 奔跑时嘴角甩出唾液
      for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          const ph = (time * (1.2 + i * 0.5) + i * 0.6) % 1;
          const sx = cx + side * (s * 0.85 + ph * s * 0.5);
          const sy = mouthY - s * 0.2 + ph * ph * s * 0.55;
          ctx.globalAlpha = (1 - ph) * 0.8;
          ctx.fillStyle = '#dcebf5';
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.03, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 毒液标志性白色吊眼
      ctx.save();
      ctx.shadowColor = 'rgba(240,245,255,0.7)';
      ctx.shadowBlur = s * 0.1;
      ctx.fillStyle = '#f6f8ff';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * s * 0.06, cy + s * 0.02);
        ctx.quadraticCurveTo(cx + side * s * 0.45, cy - s * 0.45, cx + side * s * 0.88, cy - s * 0.74);
        ctx.quadraticCurveTo(cx + side * s * 0.62, cy - s * 0.32, cx + side * s * 0.38, cy + s * 0.08);
        ctx.quadraticCurveTo(cx + side * s * 0.18, cy + s * 0.08, cx + side * s * 0.06, cy + s * 0.02);
        ctx.closePath();
        ctx.fill();
        // 眼白充血红丝
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(198,32,44,0.75)';
        ctx.lineWidth = Math.max(1, s * 0.018);
        for (let v = 0; v < 3; v++) {
          const vx = cx + side * s * (0.18 + v * 0.2);
          ctx.beginPath();
          ctx.moveTo(vx, cy + s * 0.08);
          ctx.quadraticCurveTo(vx + side * s * 0.05, cy - s * 0.2, vx + side * s * 0.12, cy - s * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();

      // 头顶共生体触须
      ctx.strokeStyle = '#0a0e16';
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const bx = cx + i * s * 0.3;
        const by = cy - s * 0.8;
        const phase = time * 3 + i;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + Math.sin(phase) * s * 0.2, by - s * 0.4, bx + Math.sin(phase * 1.3) * s * 0.3, by - s * 0.75);
        ctx.stroke();
      }
    },

    drawBiteOverlay(player, bite) {
      const ctx = this.ctx;
      const p = this.project(player.x, player.y, C.PLAYER_Z);
      const u = p.s;
      const time = performance.now() / 1000;
      const phase = bite;
      let open;
      if (phase < 0.18) open = phase / 0.18;
      else if (phase < 0.32) open = 1 - (phase - 0.18) / 0.14;
      else if (phase < 0.48) open = (phase - 0.32) / 0.16;
      else if (phase < 0.64) open = 1 - (phase - 0.48) / 0.16;
      else if (phase < 0.82) open = (phase - 0.64) / 0.18;
      else open = Math.max(0, 1 - (phase - 0.82) / 0.12);
      const cx = p.x;
      const headDrop = Math.min(1, phase * 2.2);
      const cy = p.y - u * 2.05 + headDrop * u * 0.3;
      const hs = u * 1.55;
      ctx.fillStyle = 'rgba(5,10,20,' + (0.2 + phase * 0.45).toFixed(3) + ')';
      ctx.fillRect(-this.W, -this.H, this.W * 3, this.H * 3);
      ctx.strokeStyle = '#0b1424';
      ctx.lineCap = 'round';
      ctx.lineWidth = u * 0.34;
      const armY = cy + hs * 0.3;
      const handY = p.y - u * 0.75 + phase * u * 0.35;
      const handSpread = u * (0.55 - phase * 0.08);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * hs * 0.5, armY);
        ctx.quadraticCurveTo(cx + s * u * 0.75, armY + u * 0.55, cx + s * handSpread, handY);
        ctx.stroke();
      }
      ctx.fillStyle = '#0d1830';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * handSpread, handY, u * 0.22, u * 0.16, 0, 0, 6.283);
        ctx.fill();
      }
      this._monsterHead(ctx, cx, cy, hs, open, time);
      ctx.fillStyle = 'rgba(120,230,150,0.85)';
      for (let i = 0; i < 5; i++) {
        const gx = cx + (i - 2) * u * 0.28;
        const gy = cy + hs * 0.45 + ((time * 1.8 + i * 0.3) % 1) * u * 0.7;
        ctx.beginPath();
        ctx.arc(gx, gy, u * 0.055, 0, 6.283);
        ctx.fill();
      }
    },

    drawParticles(particles) {
      const ctx = this.ctx;
      for (const p of particles) {
        const pt = this.project(p.x, p.y, p.z);
        const k = Math.max(0, p.life / p.maxLife);
        const r = Math.max(1, p.size * pt.s * (0.4 + 0.6 * k));
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  });
})();