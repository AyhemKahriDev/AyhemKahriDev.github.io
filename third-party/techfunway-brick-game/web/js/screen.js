/* ============ 渲染引擎：设计坐标 300x500，霓虹像素风 + 特效系统 ============ */
(function () {
  const W = 300, H = 500;

  class Screen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.t = 0;
      this.particles = [];
      this.toasts = [];
      this.shakeT = 0; this.shakeP = 0;
      this.flashT = 0; this.flashC = '#ffffff';
      this.sprites = new Map();
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.round(rect.width * dpr));
      const ch = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== cw) this.canvas.width = cw;
      if (this.canvas.height !== ch) this.canvas.height = ch;
      this.scale = Math.min(cw / W, ch / H);
      this.ox = (cw - W * this.scale) / 2;
      this.oy = (ch - H * this.scale) / 2;
      this.dpr = dpr;
      this.buildOverlays(cw, ch, dpr);
    }

    buildOverlays(cw, ch, dpr) {
      // 扫描线
      const sc = document.createElement('canvas');
      sc.width = 4; sc.height = Math.round(3 * dpr) || 3;
      const sx = sc.getContext('2d');
      sx.fillStyle = 'rgba(0,0,0,0.13)';
      sx.fillRect(0, 0, 4, 1 * dpr);
      this.scanPattern = this.ctx.createPattern(sc, 'repeat');
      // 暗角
      const vg = document.createElement('canvas');
      vg.width = cw; vg.height = ch;
      const vx = vg.getContext('2d');
      const grad = vx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.42, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,20,0.42)');
      vx.fillStyle = grad; vx.fillRect(0, 0, cw, ch);
      this.vignette = vg;
    }

    /** 取预烘焙的发光方块精灵 */
    sprite(color) {
      if (!color) color = '#ffffff';
      let s = this.sprites.get(color);
      if (s) return s;
      // 兼容 #RRGGBBAA：截取 RGB 部分用于发光渐变
      const base = color[0] === '#' && color.length > 7 ? color.slice(0, 7) : color;
      const S = 64, pad = 6;
      s = document.createElement('canvas');
      s.width = S; s.height = S;
      const x = s.getContext('2d');
      // 外发光
      const gl = x.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S / 2);
      gl.addColorStop(0, base + '66');
      gl.addColorStop(1, base + '00');
      x.fillStyle = gl; x.fillRect(0, 0, S, S);
      // 主体
      x.fillStyle = color;
      x.fillRect(pad, pad, S - pad * 2, S - pad * 2);
      // 上亮下暗斜面
      x.fillStyle = 'rgba(255,255,255,0.45)';
      x.fillRect(pad, pad, S - pad * 2, 5);
      x.fillRect(pad, pad, 5, S - pad * 2);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(pad, S - pad - 6, S - pad * 2, 6);
      x.fillRect(S - pad - 6, pad, 6, S - pad * 2);
      // 内芯高光
      x.fillStyle = 'rgba(255,255,255,0.22)';
      x.fillRect(pad + 10, pad + 10, S - pad * 2 - 20, S - pad * 2 - 20);
      this.sprites.set(color, s);
      return s;
    }

    addShake(p) { this.shakeP = Math.max(this.shakeP, p); this.shakeT = Math.max(this.shakeT, 0.3); }
    addFlash(color, a) { this.flashC = color || '#fff'; this.flashT = Math.max(this.flashT, a || 0.5); }
    burst(x, y, color, n, speed, gravity) {
      n = n || 10;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (speed || 90) * (0.35 + Math.random() * 0.9);
        this.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (speed || 90) * 0.25,
          life: 0.45 + Math.random() * 0.5, max: 0.95,
          color, size: 2 + Math.random() * 3.5, g: gravity === undefined ? 260 : gravity,
        });
      }
      if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
    }
    toast(text, x, y, color, scale) {
      this.toasts.push({ text, x, y, color: color || '#ffffff', life: 1.1, scale: scale || 2 });
    }

    update(dt) {
      this.t += dt;
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.flashT = Math.max(0, this.flashT - dt * 2.2);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      }
      for (let i = this.toasts.length - 1; i >= 0; i--) {
        const tt = this.toasts[i];
        tt.life -= dt; tt.y -= 22 * dt;
        if (tt.life <= 0) this.toasts.splice(i, 1);
      }
    }

    frameBegin() {
      const { ctx } = this, dpr = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0a1e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      let sx = 0, sy = 0;
      if (this.shakeT > 0) {
        const p = this.shakeP * (this.shakeT / 0.3);
        sx = (Math.random() * 2 - 1) * p; sy = (Math.random() * 2 - 1) * p;
      }
      ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
      ctx.imageSmoothingEnabled = false;
      this.g = makeG(this);
      return this.g;
    }

    frameEnd() {
      const { ctx } = this;
      // 粒子
      for (const p of this.particles) {
        ctx.globalAlpha = Math.min(1, p.life / p.max + 0.15);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      // 浮字
      for (const tt of this.toasts) {
        ctx.globalAlpha = Math.min(1, tt.life * 1.6);
        PixelFont.drawText(ctx, tt.text, tt.x, tt.y, tt.scale, tt.color, { center: true, glow: 8 });
      }
      ctx.globalAlpha = 1;
      // 设计空间 → 屏幕空间
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.vignette, 0, 0);
      if (this.flashT > 0) {
        ctx.globalAlpha = this.flashT;
        ctx.fillStyle = this.flashC;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** 每帧提供给游戏的绘图 API g */
  function makeG(screen) {
    const ctx = screen.ctx;
    return {
      W, H, ctx, t: screen.t,
      clear(color) { ctx.fillStyle = color || '#0b0a1e'; ctx.fillRect(-10, -10, W + 20, H + 20); },
      rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
      frame(x, y, w, h, color, t2) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, t2 || 1); ctx.fillRect(x, y + h - (t2 || 1), w, t2 || 1);
        ctx.fillRect(x, y, t2 || 1, h); ctx.fillRect(x + w - (t2 || 1), y, t2 || 1, h);
      },
      /** block(px,py,size,color[,alpha]) 或 block(px,py,w,h,color) */
      block(px, py, a, b, c) {
        let w, h, color, alpha;
        if (typeof b === 'string') { w = h = a; color = b; alpha = c; }
        else { w = a; h = b; color = c; alpha = undefined; }
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.drawImage(screen.sprite(color), px, py, w, h);
        if (alpha !== undefined) ctx.globalAlpha = 1;
      },
      cell(cx, cy, size, color, alpha) { this.block(cx * size, cy * size, size, color, alpha); },
      text(str, x, y, color, scale, opts) { PixelFont.drawText(ctx, str, x, y, scale || 1, color || '#fff', opts); },
      /** 中文/系统字体文本 */
      cnText(str, x, y, color, size, align) {
        ctx.save();
        ctx.font = `700 ${size || 11}px "PingFang SC","Microsoft YaHei",sans-serif`;
        ctx.fillStyle = color || '#fff';
        ctx.textBaseline = 'top';
        if (align === 'center') { ctx.textAlign = 'center'; x = 150; }
        ctx.fillText(str, x, y);
        ctx.restore();
      },
      textWidth: PixelFont.textWidth,
      burst: (x, y, c, n, s2, gr) => screen.burst(x, y, c, n, s2, gr),
      shake: (p) => screen.addShake(p),
      flash: (c, a) => screen.addFlash(c, a),
      toast: (txt, x, y, c, s2) => screen.toast(txt, x, y, c, s2),
      /** 顶部 HUD：分数 | 最高 | 等级 */
      hud(score, hi, label, level) {
        this.rect(0, 0, W, 30, 'rgba(10,8,40,0.85)');
        this.rect(0, 30, W, 1, '#2de2ff44');
        this.text('SCORE', 6, 4, '#7cf7ff', 1);
        this.text(String(score), 6, 12, '#ffffff', 2, { glow: 6 });
        this.text('HI', 108, 4, '#ffd60a', 1);
        this.text(String(hi), 108, 12, '#ffd60a', 2, { glow: 4 });
        if (label) this.text(label, 196, 4, '#ff7ab8', 1);
        if (level !== undefined) this.text(String(level), 196, 12, '#ff7ab8', 2, { glow: 4 });
        this.text(':' + fmtTime(screen.t), 240, 8, '#9aa0ff', 2);
      },
    };
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  window.ScreenEngine = { Screen, W, H };
})();
