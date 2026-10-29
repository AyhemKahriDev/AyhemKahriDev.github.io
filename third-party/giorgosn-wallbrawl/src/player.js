'use strict';
// The stick figure: movement feel, combat, and procedural drawing.

const PLAYER_COLORS = ['#27e6ff', '#ff5db1'];

class Player {
  constructor(idx) {
    this.idx = idx;
    this.color = PLAYER_COLORS[idx];
    this.reset(0, 0);
  }
  get s() { return ArenaStore.current.playerScale || 1; }
  get r() { return 15 * this.s; }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hp = 100;
    this.alive = true;
    this.facing = this.idx === 0 ? 1 : -1;
    this.aimx = this.facing; this.aimy = 0;
    this.onGround = false;
    this.jumps = 1;
    this.coyote = 0;
    this.buffer = 0;
    this.weapon = null; this.ammo = 0;
    this.cd = 0; this.punchT = 0;
    this.hurtT = 0; this.invuln = 1;
    this.phase = 0;
  }

  update(dt) {
    if (!this.alive) return;
    const s = this.s;
    const inp = Input.get(this.idx);
    const accel = (this.onGround ? 2800 : 1900) * s;
    const maxV = 350 * s;
    const fric = 2400 * s;

    if (inp.mx !== 0) {
      this.vx += inp.mx * accel * dt;
      this.vx = clamp(this.vx, -maxV, maxV);
      this.facing = inp.mx > 0 ? 1 : -1;
    } else if (this.onGround) {
      const dv = Math.min(Math.abs(this.vx), fric * dt);
      this.vx -= Math.sign(this.vx) * dv;
    }
    if (Math.hypot(inp.aimx, inp.aimy) > 0.3) { this.aimx = inp.aimx; this.aimy = inp.aimy; }
    else { this.aimx = this.facing; this.aimy = inp.downHeld ? 0.75 : 0; }

    this.coyote -= dt; this.buffer -= dt; this.cd -= dt;
    this.punchT -= dt; this.hurtT -= dt; this.invuln -= dt;

    if (inp.jumpPressed) this.buffer = 0.1;
    if (this.buffer > 0 && (this.onGround || this.coyote > 0 || this.jumps > 0)) {
      if (this.onGround || this.coyote > 0) this.jumps = 1; // ground jump keeps one air jump
      else this.jumps--;
      this.vy = -640 * s;
      this.buffer = 0; this.coyote = 0; this.onGround = false;
      Sound.jump();
      G.particles.burst(this.x, this.y + this.r, this.color, 6, 120 * s, 0.3);
    }
    if (!inp.jumpHeld && this.vy < -200 * s) this.vy = -200 * s; // variable jump height

    this.vy += 1750 * s * dt;
    this.vy = Math.min(this.vy, 1000 * s);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const wasAir = !this.onGround;
    this.onGround = resolveBody(this, ArenaStore.current.shapes, (shape, hit, vn) => {
      if (shape.k === 'deadly') {
        this.damage(1000, hit.nx * 260 * s, hit.ny * 260 * s - 80 * s);
      } else if (shape.k === 'bouncy' && vn < -220 * s) {
        Sound.jump();
        G.particles.burst(this.x - hit.nx * this.r, this.y - hit.ny * this.r, '#6dff8a', 6, 140 * s, 0.3);
      }
    });
    if (this.onGround) {
      this.jumps = 1;
      this.coyote = 0.09;
      if (wasAir && Math.abs(this.vy) < 1) Sound.land();
    }

    // soft side walls, open top, bottomless pit kills
    if (this.x < this.r) { this.x = this.r; this.vx = Math.max(0, this.vx); }
    if (this.x > W - this.r) { this.x = W - this.r; this.vx = Math.min(0, this.vx); }
    if (this.y > H + 90) this.die();

    if (inp.attackHeld && this.cd <= 0 && this.alive) {
      const auto = this.weapon && WEAPONS[this.weapon].auto;
      if (inp.attackPressed || auto) this.attack();
    }
    this.phase += Math.abs(this.vx) * dt * 0.09;
  }

  attack() {
    if (this.weapon) {
      Weapons.fire(this);
      if (this.ammo <= 0) this.weapon = null;
    } else {
      this.cd = 0.34;
      this.punchT = 0.14;
      Sound.punch();
      const range = this.r * 2.4;
      for (const p of G.players) {
        if (p === this || !p.alive) continue;
        if (dist2(p.x, p.y, this.x + this.facing * range * 0.6, this.y) < range * range) {
          p.damage(11, this.facing * 380 * this.s, -220 * this.s);
        }
      }
    }
  }

  damage(amount, kx, ky) {
    if (!this.alive || this.invuln > 0) return;
    this.hp -= amount;
    this.hurtT = 0.15;
    this.vx += kx; this.vy += ky;
    Sound.hit();
    G.particles.burst(this.x, this.y, '#ffffff', 8, 200, 0.35);
    G.shake = Math.min(G.shake + 4, 14);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    if (this.weapon) { // drop the weapon where you fell
      Weapons.crates.push({
        x: clamp(this.x, 20, W - 20), y: Math.min(this.y, H - 20), vy: -160,
        r: 12, landed: false, weapon: this.weapon, ammo: this.ammo, life: 15,
      });
      this.weapon = null;
    }
    Sound.die();
    G.particles.burst(this.x, this.y, this.color, 26, 320, 0.9);
    G.shake = Math.min(G.shake + 10, 18);
  }

  muzzle() {
    const aim = Math.atan2(this.aimy, this.aimx);
    const neckY = this.y - this.r * 0.55;
    return { x: this.x + Math.cos(aim) * this.r * 1.6, y: neckY + Math.sin(aim) * this.r * 1.6, a: aim };
  }

  draw(ctx) {
    if (!this.alive) return;
    const r = this.r;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    const col = this.hurtT > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(2.5, r * 0.22);
    ctx.lineCap = 'round';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    const neck = -r * 0.55, hip = r * 0.35;
    const headR = r * 1.15, headY = neck - headR * 0.8; // bobblehead-big on purpose

    // legs + torso
    const sw = this.onGround ? Math.sin(this.phase) * 0.9 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, hip); ctx.lineTo(sw * r * 0.7, r * 1.35);
    ctx.moveTo(0, hip); ctx.lineTo(-sw * r * 0.7, r * 1.35);
    ctx.moveTo(0, hip); ctx.lineTo(0, neck);
    ctx.stroke();

    // head: uploaded photo (circle-cropped, flips with facing) or drawn circle + eye
    const headImg = Heads.imgs[this.idx];
    if (headImg) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, headY, headR, 0, TAU); ctx.clip();
      ctx.scale(this.facing, 1);
      ctx.drawImage(headImg, -headR, headY - headR, headR * 2, headR * 2);
      if (this.hurtT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-headR, headY - headR, headR * 2, headR * 2); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, headY, headR, 0, TAU); ctx.stroke(); // team-color ring
    } else {
      ctx.beginPath(); ctx.arc(0, headY, headR, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.facing * headR * 0.4, headY - headR * 0.15, Math.max(1.2, headR * 0.14), 0, TAU);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.shadowBlur = 14;
    }

    // arms
    const aim = Math.atan2(this.aimy, this.aimx);
    const armL = r * (this.punchT > 0 ? 1.5 : 1.0);
    ctx.beginPath();
    if (this.weapon || this.punchT > 0) {
      ctx.moveTo(0, neck);
      ctx.lineTo(Math.cos(aim) * armL, neck + Math.sin(aim) * armL);
      ctx.moveTo(0, neck);
      ctx.lineTo(-this.facing * r * 0.5, neck + r * 0.75);
    } else {
      const swing = Math.sin(this.phase) * 0.5;
      ctx.moveTo(0, neck);
      ctx.lineTo(r * (0.55 + swing * 0.3) * this.facing, neck + r * 0.8);
      ctx.moveTo(0, neck);
      ctx.lineTo(-r * (0.55 - swing * 0.3) * this.facing, neck + r * 0.8);
    }
    ctx.stroke();

    // weapon
    if (this.weapon) {
      ctx.save();
      ctx.translate(Math.cos(aim) * armL, neck + Math.sin(aim) * armL);
      ctx.rotate(aim);
      ctx.fillStyle = '#ffd94a';
      ctx.shadowColor = '#ffd94a';
      ctx.fillRect(0, -r * 0.12, r * 0.8, r * 0.28);
      ctx.restore();
    }

    // health bar, only once damaged
    if (this.hp < 100) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.85;
      const bw = r * 2.4, by = headY - headR - r * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-bw / 2, by, bw, 3);
      ctx.fillStyle = col;
      ctx.fillRect(-bw / 2, by, bw * clamp(this.hp, 0, 100) / 100, 3);
    }
    ctx.restore();
  }
}
