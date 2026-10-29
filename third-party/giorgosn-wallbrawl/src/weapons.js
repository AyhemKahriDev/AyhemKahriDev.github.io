'use strict';
// Weapon crates drop from above, guns spray neon tracers.

const WEAPONS = {
  pistol:  { ammo: 8,  cd: 0.24,  dmg: 15, kb: 320, speed: 950, spread: 0.02, auto: false, n: 1 },
  uzi:     { ammo: 26, cd: 0.075, dmg: 6,  kb: 130, speed: 880, spread: 0.10, auto: true,  n: 1 },
  shotgun: { ammo: 4,  cd: 0.5,   dmg: 8,  kb: 260, speed: 820, spread: 0.16, auto: false, n: 5 },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

const Weapons = {
  bullets: [],
  crates: [],
  crateTimer: 3,

  reset() {
    this.bullets.length = 0;
    this.crates.length = 0;
    this.crateTimer = 3;
  },

  fire(player) {
    const w = WEAPONS[player.weapon];
    player.cd = w.cd;
    player.ammo--;
    const m = player.muzzle();
    for (let i = 0; i < w.n; i++) {
      const a = m.a + rand(-w.spread, w.spread);
      this.bullets.push({
        x: m.x, y: m.y,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, kb: w.kb, owner: player.idx, life: 1.6,
      });
    }
    player.vx -= Math.cos(m.a) * 40; // recoil
    Sound.shoot();
    G.particles.burst(m.x, m.y, '#ffd94a', 4, 150, 0.15);
  },

  update(dt) {
    // crate spawning + falling
    this.crateTimer -= dt;
    if (this.crateTimer <= 0 && this.crates.length < 2) {
      this.crateTimer = rand(6, 10);
      this.crates.push({
        x: rand(100, W - 100), y: -30, vy: 0, r: 12,
        landed: false,
        weapon: WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)],
        life: 25,
      });
    }
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.life -= dt;
      if (!c.landed) {
        c.vy += 500 * dt;
        c.y += c.vy * dt;
        const b = { x: c.x, y: c.y, r: c.r, vx: 0, vy: c.vy };
        if (resolveBody(b, ArenaStore.current.shapes)) {
          c.landed = true;
          Sound.land();
          G.particles.burst(c.x, c.y + c.r, '#ffd94a', 6, 90, 0.3);
        }
        c.x = b.x; c.y = b.y; c.vy = b.vy;
      }
      let taken = false;
      for (const p of G.players) {
        if (!p.alive) continue;
        if (dist2(p.x, p.y, c.x, c.y) < (p.r + c.r + 4) ** 2) {
          p.weapon = c.weapon;
          p.ammo = c.ammo != null ? c.ammo : WEAPONS[c.weapon].ammo; // dropped crates keep their ammo
          p.cd = 0;
          Sound.pickup();
          taken = true;
          break;
        }
      }
      if (taken || c.y > H + 80 || c.life <= 0) this.crates.splice(i, 1);
    }

    // bullets, substepped so fast shots don't tunnel through thin walls
    const shapes = ArenaStore.current.shapes;
    outer:
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { this.bullets.splice(i, 1); continue; }
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6));
      for (let k = 0; k < steps; k++) {
        b.x += b.vx * dt / steps;
        b.y += b.vy * dt / steps;
        if (b.x < -40 || b.x > W + 40 || b.y < -200 || b.y > H + 80) {
          this.bullets.splice(i, 1); continue outer;
        }
        for (const s of shapes) {
          if (pointInShape(b.x, b.y, s, 1)) {
            G.particles.burst(b.x, b.y, '#ffd94a', 5, 130, 0.25);
            this.bullets.splice(i, 1); continue outer;
          }
        }
        for (const p of G.players) {
          if (!p.alive || p.idx === b.owner) continue;
          if (dist2(p.x, p.y, b.x, b.y) < (p.r * 1.15) ** 2) {
            const d = Math.hypot(b.vx, b.vy) || 1;
            p.damage(b.dmg, b.vx / d * b.kb, b.vy / d * b.kb - 60);
            this.bullets.splice(i, 1); continue outer;
          }
        }
      }
    }
  },

  draw(ctx) {
    ctx.save();
    for (const c of this.crates) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.strokeStyle = '#ffd94a';
      ctx.fillStyle = 'rgba(255,217,74,0.15)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd94a';
      ctx.shadowBlur = 12;
      ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
      ctx.strokeRect(-c.r, -c.r, c.r * 2, c.r * 2);
      ctx.beginPath();
      ctx.moveTo(-c.r * 0.5, -c.r * 0.5); ctx.lineTo(c.r * 0.5, c.r * 0.5);
      ctx.moveTo(c.r * 0.5, -c.r * 0.5); ctx.lineTo(-c.r * 0.5, c.r * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = '#fff7cf';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffd94a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const b of this.bullets) {
      const d = Math.hypot(b.vx, b.vy) || 1;
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx / d * 12, b.y - b.vy / d * 12);
    }
    ctx.stroke();
    ctx.restore();
  },
};
