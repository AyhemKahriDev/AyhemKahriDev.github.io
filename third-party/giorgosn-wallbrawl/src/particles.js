'use strict';

class ParticleSystem {
  constructor() { this.arr = []; }
  burst(x, y, color, n, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(spd * 0.3, spd);
      this.arr.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - spd * 0.3,
        life: rand(life * 0.5, life),
        t: 0,
        color,
      });
    }
    if (this.arr.length > 400) this.arr.splice(0, this.arr.length - 400);
  }
  update(dt) {
    for (let i = this.arr.length - 1; i >= 0; i--) {
      const p = this.arr[i];
      p.t += dt;
      if (p.t >= p.life) { this.arr.splice(i, 1); continue; }
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(ctx) {
    ctx.save();
    for (const p of this.arr) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.restore();
  }
}
