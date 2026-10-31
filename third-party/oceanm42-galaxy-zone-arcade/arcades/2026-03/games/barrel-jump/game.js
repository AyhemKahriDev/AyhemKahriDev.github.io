(function () { /* de-moduled */
'use strict';
/**
 * Barrel Jump — Donkey Kong-style platform arcade game
 * Climb platforms, dodge barrels, rescue the captive!
 */



// ── Constants ────────────────────────────────────────────────
const W = 800, H = 600;
const GRAVITY = 900, JUMP_VEL = -380, MOVE_SPEED = 140, CLIMB_SPEED = 110;
const BARREL_SPEED = 100, HAMMER_DUR = 10, TIMER_START = 5000;

const C = {
  bg: '#1a0a2e', beam: '#8B4513', beamTop: '#a0522d', ladder: '#d4a017',
  player: '#ff3333', ape: '#6b3a1f', barrel: '#8b5e3c', blueBarrel: '#3355aa',
  captive: '#ff69b4', hammer: '#cccccc', rivet: '#ffcc00', elevator: '#446688',
  spring: '#00cc44', oilDrum: '#333333'
};

// ── Stage Layouts ────────────────────────────────────────────
function pl(x, y, w, h = 8, o = {}) { return { x, y, w, h, slant: 0, conveyor: 0, elevator: false, ...o }; }

function makeStage1() {
  const platforms = [], ladders = [];
  for (let i = 0; i < 6; i++)
    platforms.push(pl(40, 540 - i * 80, 720, 8, { slant: (i % 2 === 0 ? 1 : -1) * 0.02 }));
  const lx = [160, 350, 550, 250, 450, 650, 180, 400, 600, 300];
  for (let i = 0; i < 5; i++) {
    const ty = 540 - (i + 1) * 80;
    ladders.push({ x: lx[i * 2], y: ty, h: 80, w: 20 });
    if (lx[i * 2 + 1]) ladders.push({ x: lx[i * 2 + 1], y: ty, h: 80, w: 20 });
  }
  return { platforms, ladders, rivets: [], hasRivets: false, hasElevators: false };
}

function makeStage2() {
  const platforms = [], ladders = [];
  for (let i = 0; i < 5; i++)
    platforms.push(pl(60, 520 - i * 95, 680, 8, { conveyor: (i % 2 === 0 ? 1 : -1) * 60 }));
  for (let i = 0; i < 4; i++) {
    const ty = 520 - (i + 1) * 95;
    ladders.push({ x: 150 + (i % 2) * 400, y: ty, h: 95, w: 20 });
    ladders.push({ x: 350 + (i % 2) * 100, y: ty, h: 95, w: 20 });
  }
  return { platforms, ladders, rivets: [], hasRivets: false, hasElevators: false };
}

function makeStage3() {
  const platforms = [], ladders = [];
  for (let i = 0; i < 5; i++) {
    const y = 520 - i * 100;
    if (i % 2 === 0) { platforms.push(pl(40, y, 300)); platforms.push(pl(460, y, 300)); }
    else platforms.push(pl(150, y, 500));
  }
  platforms.push(pl(370, 120, 60, 12, { elevator: true, elevMin: 120, elevMax: 520, elevSpeed: 80, elevDir: 1 }));
  platforms.push(pl(700, 320, 60, 12, { elevator: true, elevMin: 120, elevMax: 520, elevSpeed: 70, elevDir: -1 }));
  for (let i = 0; i < 3; i++)
    ladders.push({ x: 120 + i * 200, y: 520 - (i + 1) * 100, h: 100, w: 20 });
  return { platforms, ladders, rivets: [], hasRivets: false, hasElevators: true };
}

function makeStage4() {
  const platforms = [], ladders = [], rivets = [];
  for (let i = 0; i < 5; i++) {
    const y = 520 - i * 95;
    platforms.push(pl(60, y, 680));
    for (let r = 0; r < 6; r++)
      rivets.push({ x: 120 + r * 105, y: y - 4, w: 12, h: 8, active: true });
  }
  for (let i = 0; i < 4; i++) {
    const ty = 520 - (i + 1) * 95;
    ladders.push({ x: 200, y: ty, h: 95, w: 20 });
    ladders.push({ x: 550, y: ty, h: 95, w: 20 });
  }
  return { platforms, ladders, rivets, hasRivets: true, hasElevators: false };
}

const STAGES = [makeStage1, makeStage2, makeStage3, makeStage4];
const STAGE_NAMES = ['RAMPS', 'CONVEYORS', 'ELEVATORS', 'RIVETS'];

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const now = () => performance.now();

// ── Game ─────────────────────────────────────────────────────
class BarrelJumpGame extends GameEngine {
  init() {
    this.ach = new AchievementManager('barrel-jump');
    this.ach.define([
      { id: 'barrel-jumper', name: 'Barrel Jumper', description: 'Jump over your first barrel', icon: '\u{1F6E2}' },
      { id: 'hammer-time', name: 'Hammer Time', description: 'Smash 3 barrels with one hammer', icon: '\u{1F528}' },
      { id: 'rivet-master', name: 'Rivet Master', description: 'Complete the rivet stage', icon: '\u{1F529}' },
      { id: 'all-four', name: 'All Four Stages', description: 'Complete all 4 stage types', icon: '\u{1F3C5}' },
      { id: 'high-climber', name: 'High Climber', description: 'Score 20,000+ points', icon: '\u{1F3D4}' },
    ]);

    this.si = 0;          // stage index (0-3)
    this.cycle = 0;       // difficulty cycle
    this.doneStages = new Set();
    this.bonus = TIMER_START;
    this.bonusAcc = 0;
    this.sub = 'intro';   // sub-state: intro | play | clear | dying
    this.subT = 0;        // sub-state timer

    this.p = { x: 80, y: 520, w: 20, h: 28, vx: 0, vy: 0, gr: false, climb: false, faceR: true };
    this.hasHam = false;
    this.hamT = 0;
    this.hamHits = 0;

    this.stage = null;
    this.barrels = [];
    this.fires = [];
    this.springs = [];
    this.items = [];
    this.hamPick = null;
    this.oil = { x: 100, y: 532, w: 30, h: 28, lit: false };
    this.ape = { x: 60, y: 50, beatT: 0, beating: false, throwT: 2 };
    this.cap = { x: 350, y: 50 };
    this.itemT = 0;
    this.mt = 0;

    this.effects.setCRT(true);
  }

  onEnterState(s) { if (s === 'playing') this.setupStage(); }

  setupStage() {
    this.stage = STAGES[this.si]();
    this.barrels = []; this.fires = []; this.springs = []; this.items = [];
    this.hasHam = false; this.hamT = 0; this.hamHits = 0;
    this.bonus = TIMER_START; this.bonusAcc = 0;
    this.sub = 'intro'; this.subT = 2.5;

    const bp = this.stage.platforms.find(p => !p.elevator) || this.stage.platforms[0];
    Object.assign(this.p, { x: bp.x + 30, y: bp.y - 28, vx: 0, vy: 0, gr: true, climb: false });

    this.oil = { x: 100, y: 532, w: 30, h: 28, lit: false };

    const nep = this.stage.platforms.filter(p => !p.elevator);
    const topY = Math.min(...nep.map(p => p.y));
    this.ape = { x: 60, y: topY - 70, beatT: 0, beating: false, throwT: 2 };
    this.cap = { x: this.ape.x + 120, y: this.ape.y + 10 };

    // Hammer pickup on mid-platform
    if (nep.length >= 3) {
      const mp = nep[Math.floor(nep.length / 2)];
      this.hamPick = { x: mp.x + mp.w * 0.7, y: mp.y - 20, w: 18, h: 18, on: true };
    } else this.hamPick = null;

    this.itemT = 8 + Math.random() * 5;
    this.audio.playMusic('basic', { bpm: 130 + this.cycle * 10, key: 'A' });
  }

  platY(p, x) { return p.slant ? p.y + p.slant * p.w * ((x - p.x) / p.w) : p.y; }

  landOn(e, p, dt) {
    const ex = e.x + e.w / 2;
    if (ex < p.x || ex > p.x + p.w) return false;
    const py = this.platY(p, ex), ey = e.y + e.h, prev = ey - e.vy * dt;
    if (e.vy >= 0 && prev <= py + 4 && ey >= py - 4) {
      e.y = py - e.h; e.vy = 0;
      if (p.elevator && p._dy) e.y += p._dy;
      return true;
    }
    return false;
  }

  // ── Main Update ────────────────────────────────────────────
  update(dt) {
    if (this.sub === 'intro') { this.subT -= dt; if (this.subT <= 0) this.sub = 'play'; return; }
    if (this.sub === 'clear') { this.subT -= dt; if (this.subT <= 0) this.advance(); return; }
    if (this.sub === 'dying') {
      this.subT -= dt;
      if (this.subT <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          this.ach.reportScore(this.score);
          if (this.score >= 20000) this.ach.unlock('high-climber');
          AchievementManager.checkCrossGame();
          this.gameOver();
        } else this.setupStage();
      }
      return;
    }

    // Timer bonus countdown
    this.bonusAcc += dt;
    while (this.bonusAcc >= 0.4) { this.bonusAcc -= 0.4; this.bonus = Math.max(0, this.bonus - 50); }

    this.updPlayer(dt);
    this.updApe(dt);
    this.updBarrels(dt);
    this.updFires(dt);
    this.updElevators(dt);
    this.updSprings(dt);
    this.updItems(dt);
    this.chkRivets();
    this.chkWin();
  }

  updPlayer(dt) {
    const p = this.p, inp = this.input;
    let mx = 0;
    if (inp.isDown('LEFT')) { mx = -1; p.faceR = false; }
    if (inp.isDown('RIGHT')) { mx = 1; p.faceR = true; }

    // Ladder check
    const lad = this.stage.ladders.find(l =>
      p.x + p.w / 2 > l.x && p.x + p.w / 2 < l.x + l.w &&
      p.y + p.h > l.y && p.y < l.y + l.h);

    if (lad && !this.hasHam) {
      if (inp.isDown('UP') && p.y + p.h > lad.y) { p.climb = true; p.x = lad.x + lad.w / 2 - p.w / 2; }
      if (inp.isDown('DOWN') && p.y < lad.y + lad.h) { p.climb = true; p.x = lad.x + lad.w / 2 - p.w / 2; }
    }

    if (p.climb) {
      if (inp.isDown('UP')) p.y -= CLIMB_SPEED * dt;
      if (inp.isDown('DOWN')) p.y += CLIMB_SPEED * dt;
      p.vy = 0; p.vx = 0;
      if (!lad) p.climb = false;
      return;
    }
    p.climb = false;

    // Conveyor push
    let conv = 0;
    if (p.gr) for (const pt of this.stage.platforms) {
      if (!pt.elevator && pt.conveyor) {
        const ex = p.x + p.w / 2;
        if (ex > pt.x && ex < pt.x + pt.w && Math.abs((p.y + p.h) - pt.y) < 6) conv = pt.conveyor;
      }
    }
    p.vx = mx * MOVE_SPEED + conv;

    // Jump
    if (inp.isPressed('ACTION1') && p.gr) { p.vy = JUMP_VEL; p.gr = false; this.audio.play('jump'); }
    if (!p.gr) p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Platform landing
    p.gr = false;
    for (const pt of this.stage.platforms) if (this.landOn(p, pt, dt)) p.gr = true;
    if (p.y > H + 20) { this.die(); return; }
    p.x = Math.max(10, Math.min(W - p.w - 10, p.x));

    // Hammer pickup
    if (this.hamPick?.on && overlap({ x: p.x, y: p.y, w: p.w, h: p.h }, this.hamPick)) {
      this.hasHam = true; this.hamT = HAMMER_DUR; this.hamHits = 0;
      this.hamPick.on = false; this.audio.play('powerup');
    }
    if (this.hasHam) { this.hamT -= dt; if (this.hamT <= 0) this.hasHam = false; }

    // Barrel collision
    const pr = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (overlap(pr, { x: b.x - 12, y: b.y - 12, w: 24, h: 24 })) {
        if (this.hasHam) this.smash(i, b); else { this.die(); return; }
      }
    }

    // Score for jumping over barrels
    if (!p.gr && p.vy > 0) for (const b of this.barrels) {
      if (!b.sc && Math.abs(p.x + p.w / 2 - b.x) < 30 && p.y + p.h < b.y && b.y - (p.y + p.h) < 20) {
        b.sc = true; this.addScore(100, b.x, b.y - 20);
        this.audio.play('score'); this.ach.unlock('barrel-jumper');
      }
    }

    // Fire enemy collision
    for (const f of this.fires) {
      if (overlap(pr, { x: f.x - 10, y: f.y - 14, w: 20, h: 28 })) {
        if (this.hasHam) {
          this.addScore(500, f.x, f.y - 20); f.dead = true;
          this.particles.emit(f.x, f.y, 'explosion'); this.effects.shake(4, 0.2); this.audio.play('explosion');
        } else { this.die(); return; }
      }
    }
    this.fires = this.fires.filter(f => !f.dead);

    // Spring collision
    for (const s of this.springs)
      if (overlap(pr, { x: s.x - 8, y: s.y - 16, w: 16, h: 32 })) { this.die(); return; }
  }

  smash(i, b) {
    this.barrels.splice(i, 1); this.addScore(500, b.x, b.y - 20); this.hamHits++;
    this.particles.emit(b.x, b.y, 'debris'); this.particles.emit(b.x, b.y, 'fire', 5);
    this.effects.shake(6, 0.2); this.audio.play('explosion');
    if (this.hamHits >= 3) this.ach.unlock('hammer-time');
  }

  die() {
    this.sub = 'dying'; this.subT = 1.5; this.audio.play('die');
    this.particles.emit(this.p.x + 10, this.p.y + 14, 'explosion');
    this.effects.shake(8, 0.4); this.effects.flash('#ff0000', 0.3);
  }

  updApe(dt) {
    const a = this.ape;
    a.beatT -= dt;
    if (a.beatT <= 0) {
      a.beating = true; a.beatT = 4 + Math.random() * 3;
      this.effects.shake(3, 0.3); this.audio.play('hit', { pitch: 0.5, volume: 0.6 });
      setTimeout(() => { a.beating = false; }, 800);
    }
    a.throwT -= dt;
    if (a.throwT <= 0 && this.sub === 'play') {
      a.throwT = Math.max(0.8, 2.5 - this.cycle * 0.3) + Math.random();
      const sp = BARREL_SPEED + this.cycle * 20 + Math.random() * 40;
      this.barrels.push({ x: a.x + 40, y: a.y + 40, vx: sp, vy: 0,
        blue: Math.random() < 0.2, sc: false, onL: false, lc: 0, rot: 0 });
      this.audio.play('hit', { pitch: 0.8 });
    }
    // Springs for elevator stage
    if (this.stage.hasElevators && this.sub === 'play' && Math.random() < dt * 0.3 && this.springs.length < 4)
      this.springs.push({ x: a.x + 50, y: a.y + 40, vx: 60 + Math.random() * 40, vy: -100, bn: 0 });
  }

  updBarrels(dt) {
    const dm = 1 + this.cycle * 0.15;
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      b.rot += b.vx * dt * 0.05; b.lc -= dt;

      if (b.onL) {
        b.y += 80 * dt * dm;
        const onLad = this.stage.ladders.find(l =>
          b.x > l.x - 5 && b.x < l.x + l.w + 5 && b.y >= l.y && b.y <= l.y + l.h);
        if (!onLad) { b.onL = false; b.lc = 1; }
        continue;
      }

      b.vy += GRAVITY * dt; b.y += b.vy * dt; b.x += b.vx * dt * dm;

      // Platform collision
      for (const pt of this.stage.platforms) {
        if (pt.elevator) continue;
        const py = this.platY(pt, b.x);
        if (b.x > pt.x && b.x < pt.x + pt.w && b.y >= py - 12 && b.y < py + 8 && b.vy > 0) {
          b.y = py - 12; b.vy = 0;
          if (pt.slant) b.vx = Math.sign(pt.slant) * Math.abs(b.vx || BARREL_SPEED);
          if (pt.conveyor) b.vx = pt.conveyor * 1.5;
        }
      }

      // Ladder AI — blue barrels more likely to take ladders
      if (b.lc <= 0) {
        const chance = (b.blue ? 0.4 : 0.15) + (Math.abs(b.x - this.p.x) < 100 ? 0.2 : 0);
        for (const l of this.stage.ladders) {
          if (Math.abs(b.x - l.x - l.w / 2) < 15 && b.y >= l.y - 5 && b.y <= l.y + 10
              && Math.random() < chance * dt * 10) {
            b.onL = true; b.x = l.x + l.w / 2; b.vx = 0; break;
          }
        }
      }

      // Blue barrel hits oil drum -> fire
      if (!this.oil.lit && b.blue && b.y > 520 && Math.abs(b.x - this.oil.x - 15) < 30) {
        this.oil.lit = true;
        this.particles.emit(this.oil.x + 15, this.oil.y, 'fire', 8);
        this.audio.play('explosion', { volume: 0.5 });
      }

      if (b.x < -30 || b.x > W + 30 || b.y > H + 30) this.barrels.splice(i, 1);
      if (b.x < 40 || b.x > W - 40) b.vx = -b.vx;
    }

    // Spawn fire enemies from lit oil drum
    if (this.oil.lit && this.fires.length < 3 + this.cycle && Math.random() < dt * 0.15)
      this.fires.push({ x: this.oil.x + 15, y: this.oil.y - 10,
        vx: (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 30), dead: false });
  }

  updFires(dt) {
    for (const f of this.fires) {
      f.x += f.vx * dt;
      for (const pt of this.stage.platforms) {
        if (pt.elevator) continue;
        if (f.x > pt.x && f.x < pt.x + pt.w) {
          const py = this.platY(pt, f.x);
          if (Math.abs(f.y - (py - 14)) < 20) f.y = py - 14;
        }
      }
      if (f.x < 50 || f.x > W - 50) f.vx = -f.vx;
      if (Math.random() < dt * 8)
        this.particles.emitCustom(f.x, f.y - 5, { preset: 'fire', count: 1, speed: 20, life: 0.3 });
    }
  }

  updElevators(dt) {
    for (const pt of this.stage.platforms) {
      if (!pt.elevator) continue;
      const prev = pt.y;
      pt.y += pt.elevSpeed * pt.elevDir * dt;
      if (pt.y < pt.elevMin) { pt.y = pt.elevMin; pt.elevDir = 1; }
      if (pt.y > pt.elevMax) { pt.y = pt.elevMax; pt.elevDir = -1; }
      pt._dy = pt.y - prev;
    }
  }

  updSprings(dt) {
    for (let i = this.springs.length - 1; i >= 0; i--) {
      const s = this.springs[i];
      s.vy += GRAVITY * 0.7 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      for (const pt of this.stage.platforms) {
        if (!pt.elevator && s.x > pt.x && s.x < pt.x + pt.w
            && s.y > pt.y - 16 && s.y < pt.y && s.vy > 0)
          { s.vy = -200 - Math.random() * 50; s.bn++; }
      }
      if (s.x < -20 || s.x > W + 20 || s.y > H + 20 || s.bn > 6) this.springs.splice(i, 1);
    }
  }

  updItems(dt) {
    this.itemT -= dt;
    if (this.itemT <= 0 && this.items.length < 2) {
      const types = [
        { n: 'purse', pts: 300, c: '#ff88cc' },
        { n: 'hat', pts: 400, c: '#ffdd44' },
        { n: 'parasol', pts: 500, c: '#88ccff' },
      ];
      const t = types[Math.floor(Math.random() * types.length)];
      const plats = this.stage.platforms.filter(p => !p.elevator);
      const pt = plats[Math.floor(Math.random() * plats.length)];
      if (pt) this.items.push({
        ...t, x: pt.x + Math.random() * (pt.w - 20) + 10, y: pt.y - 18,
        timer: 6 + Math.random() * 4
      });
      this.itemT = 10 + Math.random() * 8;
    }
    const pr = { x: this.p.x, y: this.p.y, w: this.p.w, h: this.p.h };
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].timer -= dt;
      if (this.items[i].timer <= 0) { this.items.splice(i, 1); continue; }
      if (overlap(pr, { x: this.items[i].x - 8, y: this.items[i].y - 8, w: 16, h: 16 })) {
        this.addScore(this.items[i].pts, this.items[i].x, this.items[i].y - 10);
        this.audio.play('coin'); this.particles.emit(this.items[i].x, this.items[i].y, 'sparkle');
        this.items.splice(i, 1);
      }
    }
  }

  chkRivets() {
    if (!this.stage.hasRivets) return;
    const pr = { x: this.p.x, y: this.p.y, w: this.p.w, h: this.p.h };
    for (const r of this.stage.rivets) {
      if (r.active && overlap(pr, r)) {
        r.active = false; this.addScore(100, r.x, r.y - 10);
        this.audio.play('coin', { pitch: 1.5 });
        this.particles.emitCustom(r.x + 6, r.y, { preset: 'sparkle', color: ['#ffcc00', '#ffaa00'], count: 4 });
      }
    }
    if (this.stage.rivets.every(r => !r.active)) {
      this.stageClear(); this.ach.unlock('rivet-master');
    }
  }

  chkWin() {
    if (this.stage.hasRivets) return;
    const d = Math.hypot(this.p.x - this.cap.x, this.p.y - this.cap.y);
    if (d < 50 && this.p.y < this.ape.y + 60) this.stageClear();
  }

  stageClear() {
    this.sub = 'clear'; this.subT = 3;
    this.addScore(this.bonus, W / 2, H / 2);
    this.doneStages.add(this.si);
    this.audio.play('powerup');
    this.particles.emit(W / 2, H / 2, 'confetti', 30);
    this.effects.flash('#ffffff', 0.2);
    if (this.doneStages.size >= 4) this.ach.unlock('all-four');
    if (this.score >= 20000) this.ach.unlock('high-climber');
  }

  advance() {
    this.si = (this.si + 1) % 4;
    if (this.si === 0) this.cycle++;
    this.level = this.cycle * 4 + this.si + 1;
    this.setupStage();
  }

  // ── Render ─────────────────────────────────────────────────
  render(ctx) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    this.drawBg(ctx);
    if (!this.stage) return;

    this.drawPlats(ctx); this.drawLadders(ctx); this.drawRivets(ctx);
    this.drawOil(ctx); this.drawBarrels(ctx); this.drawFires(ctx);
    this.drawSprings(ctx); this.drawItems(ctx); this.drawHamPick(ctx);
    this.drawApe(ctx); this.drawCaptive(ctx); this.drawPlayer(ctx);

    // Bonus timer
    ctx.save(); ctx.fillStyle = '#0ff'; ctx.font = 'bold 14px "Courier New",monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(`BONUS ${this.bonus}`, W - 10, 28); ctx.restore();

    if (this.sub === 'intro') this.drawOverlay(ctx, '#ffcc00', `STAGE ${this.si + 1}`, STAGE_NAMES[this.si]);
    if (this.sub === 'clear') this.drawOverlay(ctx, '#0f0', 'STAGE CLEAR!', `BONUS: ${this.bonus}`);
    if (this.sub === 'dying') {
      const t = 1.5 - this.subT;
      ctx.save(); ctx.translate(this.p.x + 10, this.p.y + 14 - t * 40);
      ctx.rotate(t * 12); ctx.fillStyle = C.player;
      ctx.fillRect(-10, -14, 20, 28); ctx.restore();
    }
  }

  drawOverlay(ctx, color, line1, line2) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.font = 'bold 48px "Courier New",monospace';
    ctx.fillText(line1, W / 2, H / 2 - 25);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Courier New",monospace';
    ctx.fillText(line2, W / 2, H / 2 + 20);
    if (this.cycle > 0 && this.sub === 'intro') {
      ctx.font = '16px "Courier New",monospace'; ctx.fillStyle = '#f88';
      ctx.fillText(`CYCLE ${this.cycle + 1}`, W / 2, H / 2 + 55);
    }
    ctx.restore();
  }

  drawBg(ctx) {
    ctx.strokeStyle = 'rgba(100,60,30,0.15)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  drawPlats(ctx) {
    for (const p of this.stage.platforms) {
      if (p.elevator) {
        ctx.fillStyle = C.elevator; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#88aacc'; ctx.fillRect(p.x + 5, p.y + 2, p.w - 10, 4);
        ctx.strokeStyle = '#334455'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.elevMin);
        ctx.lineTo(p.x + p.w / 2, p.elevMax); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      if (p.slant) {
        const y2 = p.y + p.slant * p.w;
        ctx.fillStyle = C.beam; ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, y2);
        ctx.lineTo(p.x + p.w, y2 + p.h); ctx.lineTo(p.x, p.y + p.h);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.beamTop; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, y2); ctx.stroke();
      } else {
        ctx.fillStyle = C.beam; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = C.beamTop; ctx.fillRect(p.x, p.y, p.w, 2);
      }
      if (p.conveyor) {
        ctx.fillStyle = 'rgba(200,200,255,0.4)';
        const d = Math.sign(p.conveyor), t = (now() / 200) % 20;
        for (let cx = p.x + 10; cx < p.x + p.w - 10; cx += 20) {
          const ax = cx + (d > 0 ? t : -t);
          if (ax > p.x && ax < p.x + p.w) {
            ctx.beginPath(); ctx.moveTo(ax, p.y + 2);
            ctx.lineTo(ax + d * 6, p.y + 4); ctx.lineTo(ax, p.y + 6); ctx.fill();
          }
        }
      }
    }
  }

  drawLadders(ctx) {
    ctx.strokeStyle = C.ladder; ctx.lineWidth = 2;
    for (const l of this.stage.ladders) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + l.h);
      ctx.moveTo(l.x + l.w, l.y); ctx.lineTo(l.x + l.w, l.y + l.h); ctx.stroke();
      for (let ry = l.y + 10; ry < l.y + l.h; ry += 12) {
        ctx.beginPath(); ctx.moveTo(l.x, ry); ctx.lineTo(l.x + l.w, ry); ctx.stroke();
      }
    }
  }

  drawRivets(ctx) {
    for (const r of this.stage.rivets) {
      if (!r.active) continue;
      ctx.fillStyle = C.rivet; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 4;
      ctx.fillRect(r.x, r.y, r.w, r.h); ctx.shadowBlur = 0;
    }
  }

  drawOil(ctx) {
    const o = this.oil;
    ctx.fillStyle = C.oilDrum; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#888'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('OIL', o.x + o.w / 2, o.y + o.h / 2 + 3);
    if (o.lit) {
      const t = now() / 100;
      ctx.fillStyle = '#ff4400'; ctx.beginPath();
      ctx.arc(o.x + 15, o.y - 5 + Math.sin(t) * 3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.beginPath();
      ctx.arc(o.x + 15, o.y - 8 + Math.sin(t * 1.3) * 2, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawBarrels(ctx) {
    for (const b of this.barrels) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.fillStyle = b.blue ? C.blueBarrel : C.barrel;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = b.blue ? '#5577cc' : '#654321'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(8, -5);
      ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawFires(ctx) {
    const t = now() / 150;
    for (const f of this.fires) {
      ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(f.x, f.y - 6, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.beginPath();
      ctx.arc(f.x + Math.sin(t) * 3, f.y - 12 + Math.sin(t * 1.5) * 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8800'; ctx.beginPath();
      ctx.arc(f.x - Math.sin(t * 0.8) * 2, f.y - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 4, f.y - 9, 3, 3); ctx.fillRect(f.x + 1, f.y - 9, 3, 3);
    }
  }

  drawSprings(ctx) {
    for (const s of this.springs) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.fillStyle = C.spring;
      for (let i = 0; i < 4; i++) ctx.fillRect(-6 + (i % 2) * 4, -12 + i * 6, 8, 3);
      ctx.restore();
    }
  }

  drawItems(ctx) {
    for (const it of this.items) {
      if (it.timer < 2 && Math.floor(it.timer * 5) % 2) continue;
      ctx.save(); ctx.translate(it.x, it.y); ctx.fillStyle = it.c;
      if (it.n === 'purse') { ctx.fillRect(-6, -4, 12, 8); ctx.fillRect(-3, -7, 6, 3); }
      else if (it.n === 'hat') { ctx.fillRect(-8, 0, 16, 3); ctx.fillRect(-4, -6, 8, 6); }
      else {
        ctx.beginPath(); ctx.arc(0, -4, 8, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = it.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 6); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawHamPick(ctx) {
    if (!this.hamPick?.on) return;
    const h = this.hamPick, glow = Math.sin(now() / 200) * 0.3 + 0.7;
    ctx.save(); ctx.globalAlpha = glow;
    ctx.fillStyle = '#888'; ctx.fillRect(h.x, h.y, 6, 14);
    ctx.fillStyle = C.hammer; ctx.fillRect(h.x - 4, h.y, 14, 8);
    ctx.restore();
  }

  drawApe(ctx) {
    const a = this.ape;
    ctx.save(); ctx.translate(a.x, a.y);
    ctx.fillStyle = C.ape;
    ctx.fillRect(-20, -10, 50, 50); // body
    ctx.fillRect(-10, -30, 30, 25); // head
    ctx.fillStyle = '#d4a574'; ctx.fillRect(-5, -25, 20, 18); // face
    ctx.fillStyle = '#fff'; ctx.fillRect(-2, -22, 6, 5); ctx.fillRect(10, -22, 6, 5); // eye whites
    ctx.fillStyle = '#000'; ctx.fillRect(1, -21, 3, 3); ctx.fillRect(13, -21, 3, 3); // pupils
    ctx.fillStyle = '#000'; ctx.fillRect(2, -12, 8, a.beating ? 5 : 2); // mouth
    ctx.fillStyle = C.ape;
    if (a.beating) {
      const ao = Math.sin(now() / 60) * 5;
      ctx.fillRect(-28 + ao, 0, 12, 8); ctx.fillRect(38 - ao, 0, 12, 8);
    } else {
      ctx.fillRect(-28, 10, 12, 8); ctx.fillRect(38, 10, 12, 8);
    }
    // Angry brow
    ctx.strokeStyle = C.ape; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(-2, -24); ctx.lineTo(5, -26);
    ctx.moveTo(16, -24); ctx.lineTo(10, -26); ctx.stroke();
    ctx.restore();
  }

  drawCaptive(ctx) {
    const bob = Math.sin(now() / 400) * 2;
    ctx.save(); ctx.translate(this.cap.x, this.cap.y + bob);
    ctx.fillStyle = C.captive; ctx.fillRect(-6, 0, 12, 16);
    ctx.fillStyle = '#ffd4a5'; ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(0, -9, 6, Math.PI, 0); ctx.fill();
    if (Math.floor(now() / 600) % 3 === 0) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('HELP!', 0, -20);
    }
    ctx.restore();
  }

  drawPlayer(ctx) {
    if (this.sub === 'dying') return;
    const p = this.p;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (!p.faceR) ctx.scale(-1, 1);
    // Body + head
    ctx.fillStyle = C.player; ctx.fillRect(-8, -6, 16, 16);
    ctx.fillStyle = '#ffd4a5'; ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.fill();
    // Cap
    ctx.fillStyle = C.player; ctx.fillRect(-5, -16, 12, 5); ctx.fillRect(-7, -12, 14, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(1, -11, 2, 2); // eye
    // Legs
    ctx.fillStyle = '#2244aa';
    if (p.climb) {
      const lo = Math.sin(now() / 100) * 3;
      ctx.fillRect(-6, 10, 5, 6 + lo); ctx.fillRect(1, 10, 5, 6 - lo);
    } else if (!p.gr) {
      ctx.fillRect(-7, 8, 5, 8); ctx.fillRect(2, 8, 5, 8);
    } else {
      const wo = Math.sin(now() / 120) * 3 * (Math.abs(p.vx) > 10 ? 1 : 0);
      ctx.fillRect(-6, 10, 5, 6 + wo); ctx.fillRect(1, 10, 5, 6 - wo);
    }
    // Held hammer
    if (this.hasHam && !(this.hamT < 3 && Math.floor(this.hamT * 6) % 2)) {
      const sw = Math.sin(now() / 80) * 0.5;
      ctx.save(); ctx.translate(10, -8); ctx.rotate(sw - 0.5);
      ctx.fillStyle = '#886644'; ctx.fillRect(0, 0, 4, 16);
      ctx.fillStyle = C.hammer; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 6;
      ctx.fillRect(-3, -6, 10, 8); ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Menu & Game Over ───────────────────────────────────────
  updateMenu(dt) { this.mt += dt; }

  renderMenu(ctx) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); this.drawBg(ctx);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Title
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 56px "Courier New",monospace';
    ctx.fillText('BARREL JUMP', W / 2, 120);
    ctx.fillStyle = '#ffcc00'; ctx.font = '18px "Courier New",monospace';
    ctx.fillText('A DONKEY KONG TRIBUTE', W / 2, 165);

    // Animated ape
    ctx.save(); ctx.translate(W / 2, 300);
    ctx.fillStyle = C.ape; ctx.fillRect(-25, -15, 50, 50); ctx.fillRect(-15, -40, 30, 30);
    ctx.fillStyle = '#d4a574'; ctx.fillRect(-10, -35, 20, 18);
    ctx.fillStyle = '#fff'; ctx.fillRect(-5, -30, 6, 5); ctx.fillRect(5, -30, 6, 5);
    ctx.fillStyle = '#000'; ctx.fillRect(-3, -29, 3, 3); ctx.fillRect(7, -29, 3, 3);
    const aa = Math.sin(this.mt * 4) * 8;
    ctx.fillStyle = C.ape; ctx.fillRect(-35 + aa, 5, 14, 10); ctx.fillRect(35 - aa, 5, 14, 10);
    const bb = Math.sin(this.mt * 2) * 5;
    ctx.fillStyle = C.barrel; ctx.beginPath(); ctx.arc(0, 50 + bb, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#654321'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-10, 45 + bb); ctx.lineTo(10, 45 + bb);
    ctx.moveTo(-10, 55 + bb); ctx.lineTo(10, 55 + bb); ctx.stroke();
    ctx.restore();

    // Controls
    ctx.fillStyle = '#888'; ctx.font = '14px "Courier New",monospace';
    ctx.fillText('ARROWS: Move / Climb   SPACE: Jump', W / 2, 440);
    ctx.fillText('Dodge barrels! Grab hammers! Reach the top!', W / 2, 465);
    ctx.fillStyle = '#0ff'; ctx.font = 'bold 16px "Courier New",monospace';
    ctx.fillText(`HIGH SCORE: ${this.highScore}`, W / 2, 510);
  }

  renderGameOver(ctx) {
    if (this.stage) { this.drawBg(ctx); this.drawPlats(ctx); }
  }
}

// ── Boot ─────────────────────────────────────────────────────
const game = new BarrelJumpGame('game-canvas', { width: W, height: H, background: C.bg });
game.start();

})();
