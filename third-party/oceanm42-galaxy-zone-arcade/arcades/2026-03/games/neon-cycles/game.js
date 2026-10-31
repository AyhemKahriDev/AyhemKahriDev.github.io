(function () { /* de-moduled */
'use strict';
/**
 * Neon Cycles — Tron-style light cycle arcade game
 * Extends the shared GameEngine from Galaxy Zone Arcade.
 */



// ── Constants ────────────────────────────────────────────────
const W = 800, H = 600;
const CELL = 8;                       // grid cell size in pixels
const COLS = W / CELL, ROWS = H / CELL;
const DIR = { UP: [0,-1], DOWN: [0,1], LEFT: [-1,0], RIGHT: [1,0] };
const OPPOSITE = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };
const COLORS = ['#0ff','#f80','#f0f','#0f0'];   // cyan, orange, magenta, green
const GLOW   = ['rgba(0,255,255,','rgba(255,136,0,','rgba(255,0,255,','rgba(0,255,0,'];
const NAMES  = ['P1','AI-A','AI-B','AI-C'];
const BASE_STEP = 0.09;              // seconds between grid steps
const STEP_SPEEDUP = 0.006;          // faster each round
const ROUNDS_TO_WIN = 5;
const POWERUP_INTERVAL = 5;          // seconds between power-up spawns
const BOOST_DURATION = 3;
const SHIELD_DURATION = 8;
const GAP_LENGTH = 4;                // cells of gap
const AI_TYPES = ['aggressive','cautious','random'];

// ── Helper ───────────────────────────────────────────────────
const rand  = (lo, hi) => Math.random() * (hi - lo) + lo;
const irand = (lo, hi) => Math.floor(rand(lo, hi));
const pick  = a => a[irand(0, a.length)];

// ── Cycle class ──────────────────────────────────────────────
class Cycle {
  constructor(id, x, y, dir, color, glowBase, ai = null) {
    this.id = id; this.x = x; this.y = y; this.dir = dir;
    this.color = color; this.glowBase = glowBase;
    this.trail = []; this.alive = true; this.ai = ai;
    this.boosted = false; this.boostTimer = 0;
    this.shielded = false; this.shieldTimer = 0;
    this.gapRemaining = 0;
    this.boostSurviveTime = 0;
  }
  reset(x, y, dir) {
    this.x = x; this.y = y; this.dir = dir;
    this.trail = []; this.alive = true;
    this.boosted = false; this.boostTimer = 0;
    this.shielded = false; this.shieldTimer = 0;
    this.gapRemaining = 0; this.boostSurviveTime = 0;
  }
}

// ── Power-up class ───────────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type; this.age = 0;
  }
}
const PU_TYPES = ['speed','gap','shield'];
const PU_COLORS = { speed:'#ff0', gap:'#0af', shield:'#f0f' };
const PU_LABELS = { speed:'S', gap:'G', shield:'SH' };

// ── Main Game ────────────────────────────────────────────────
class NeonCycles extends GameEngine {
  init() {
    this.achievements = new AchievementManager('neon-cycles');
    this.achievements.define([
      { id:'survivor',   name:'Survivor',    description:'Win your first round',              icon:'\u26A1' },
      { id:'gladiator',  name:'Gladiator',   description:'Win a match vs 3 AI opponents',     icon:'\uD83C\uDFC6' },
      { id:'daredevil',  name:'Daredevil',   description:'Use speed boost and survive 5 sec', icon:'\uD83D\uDD25' },
      { id:'gap-artist', name:'Gap Artist',  description:'Make an opponent crash into a gap',  icon:'\uD83D\uDD73\uFE0F' },
      { id:'undefeated', name:'Undefeated',  description:'Win a match without losing a round', icon:'\uD83D\uDC51' },
    ]);

    // game-wide state
    this.mode = 1;              // 1 = 1-player, 2 = 2-player
    this.difficulty = 1;        // 0 easy, 1 normal, 2 hard
    this.numAI = 3;
    this.menuSel = 0;           // 0=mode, 1=difficulty, 2=start
    this.menuTrails = this._makeMenuTrails();

    // match state
    this.wins = [];             // wins per cycle index
    this.round = 0;
    this.roundWinner = -1;
    this.matchWinner = -1;
    this.playerLostRound = false;

    // round state
    this.grid = null;           // Int8Array  0=empty, >0 = cycle id+1, -1=wall
    this.cycles = [];
    this.powerups = [];
    this.stepTimer = 0;
    this.stepInterval = BASE_STEP;
    this.puTimer = 0;
    this.countdownTimer = 0;
    this.countdownText = '';
    this.roundOverTimer = 0;
    this.matchOverTimer = 0;
    this.subState = 'none';     // countdown | active | roundover | matchover

    // raw key state for 2-player (bypass InputManager mapping)
    this._rawKeys = {};
    this._onRawDown = e => { this._rawKeys[e.code] = true; };
    this._onRawUp   = e => { this._rawKeys[e.code] = false; };
    document.addEventListener('keydown', this._onRawDown);
    document.addEventListener('keyup',   this._onRawUp);

    // hum oscillator handle
    this._hum = null;
    this._humGain = null;

    this.effects.setCRT(true);
    this.start();
  }

  // ── Menu ───────────────────────────────────────────────────
  _makeMenuTrails() {
    const trails = [];
    for (let i = 0; i < 4; i++) {
      const pts = [{ x: rand(100, 700), y: rand(100, 500) }];
      let dir = pick(['UP','DOWN','LEFT','RIGHT']);
      for (let j = 0; j < 40; j++) {
        const p = pts[pts.length - 1];
        const d = DIR[dir];
        pts.push({ x: p.x + d[0] * 12, y: p.y + d[1] * 12 });
        if (Math.random() < 0.2) dir = pick(['UP','DOWN','LEFT','RIGHT']);
      }
      trails.push({ pts, color: COLORS[i], glow: GLOW[i], offset: rand(0, 100) });
    }
    return trails;
  }

  updateMenu(dt) {
    // animate menu trails
    for (const t of this.menuTrails) t.offset += dt * 30;
  }

  renderMenu(ctx) {
    this._drawGrid(ctx);
    // animated trails
    for (const t of this.menuTrails) {
      const len = Math.min(t.pts.length, Math.floor(t.offset) % (t.pts.length + 20));
      if (len < 2) continue;
      ctx.save();
      ctx.shadowColor = t.color; ctx.shadowBlur = 12;
      ctx.strokeStyle = t.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < len; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
      ctx.stroke();
      ctx.restore();
    }
    // title
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#0ff'; ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText('NEON CYCLES', W / 2, 120);
    ctx.shadowBlur = 0;
    // menu options
    const opts = [
      `MODE: ${this.mode === 1 ? '1 PLAYER' : '2 PLAYERS'}`,
      `DIFFICULTY: ${['EASY','NORMAL','HARD'][this.difficulty]}`,
      'START GAME',
    ];
    for (let i = 0; i < opts.length; i++) {
      const sel = i === this.menuSel;
      ctx.fillStyle = sel ? '#0ff' : '#668';
      ctx.font = `bold 22px "Courier New", monospace`;
      ctx.fillText((sel ? '> ' : '  ') + opts[i], W / 2, 260 + i * 40);
    }
    ctx.fillStyle = '#446'; ctx.font = '14px "Courier New", monospace';
    ctx.fillText(this.mode === 2 ? 'P1: WASD  |  P2: ARROWS' : 'ARROWS or WASD to move', W / 2, 420);
    ctx.restore();
  }

  // override engine menu input
  _handleInput() {
    const inp = this.input;
    if (this._state === 'menu') {
      if (inp.isPressed('UP'))   { this.menuSel = (this.menuSel - 1 + 3) % 3; this.audio.play('select'); }
      if (inp.isPressed('DOWN')) { this.menuSel = (this.menuSel + 1) % 3; this.audio.play('select'); }
      if (inp.isPressed('LEFT') || inp.isPressed('RIGHT')) {
        if (this.menuSel === 0) { this.mode = this.mode === 1 ? 2 : 1; this.audio.play('select'); }
        if (this.menuSel === 1) {
          this.difficulty = (this.difficulty + (inp.isPressed('RIGHT') ? 1 : 2)) % 3;
          this.audio.play('select');
        }
      }
      if ((inp.isPressed('START') || inp.isPressed('ACTION1')) && this.menuSel === 2) {
        this._startMatch();
      }
      // also allow pressing start on non-start rows to just confirm
      if ((inp.isPressed('START') || inp.isPressed('ACTION1')) && this.menuSel !== 2) {
        this.menuSel = 2; // jump to start
      }
      return;
    }
    if (this._state === 'gameover') {
      if (inp.isPressed('START') || inp.isPressed('ACTION1')) {
        this.setState('menu');
        this.menuTrails = this._makeMenuTrails();
      }
      return;
    }
    // pause
    if (inp.isPressed('PAUSE') && this._state === 'playing') {
      this.setState('paused'); this.audio.pauseMusic(); this._stopHum(); return;
    }
    if (inp.isPressed('PAUSE') && this._state === 'paused') {
      this._resumeFromPause(); this._startHum(); return;
    }
    if (this._state === 'paused') {
      if (inp.isPressed('UP'))   { this._pauseSel = (this._pauseSel - 1 + 3) % 3; this.audio.play('select'); }
      if (inp.isPressed('DOWN')) { this._pauseSel = (this._pauseSel + 1) % 3; this.audio.play('select'); }
      if (inp.isPressed('START') || inp.isPressed('ACTION1')) this._selectPauseOption();
    }
  }

  // ── Match / Round lifecycle ────────────────────────────────
  _startMatch() {
    this.numAI = this.mode === 2 ? 2 : 3;
    const total = (this.mode === 2 ? 2 : 1) + this.numAI;
    this.wins = new Array(total).fill(0);
    this.round = 0;
    this.matchWinner = -1;
    this.playerLostRound = false;
    this.audio.play('start');
    this.setState('playing');
    this._startRound();
  }

  _startRound() {
    this.round++;
    this.subState = 'countdown';
    this.countdownTimer = 3.5;
    this.roundWinner = -1;
    this.roundOverTimer = 0;
    this.stepInterval = Math.max(0.03, BASE_STEP - (this.round - 1) * STEP_SPEEDUP);
    this.stepTimer = 0;
    this.puTimer = POWERUP_INTERVAL;
    this.powerups = [];

    // build grid
    this.grid = new Int8Array(COLS * ROWS);

    // spawn cycles
    this.cycles = [];
    const total = this.wins.length;
    const spawns = this._getSpawnPositions(total);
    for (let i = 0; i < total; i++) {
      const isPlayer = (i === 0) || (this.mode === 2 && i === 1);
      const aiType = isPlayer ? null : AI_TYPES[(i - (this.mode === 2 ? 2 : 1)) % AI_TYPES.length];
      const c = new Cycle(i, spawns[i].x, spawns[i].y, spawns[i].dir, COLORS[i], GLOW[i], aiType);
      this.cycles.push(c);
      this.grid[c.y * COLS + c.x] = i + 1;
    }

    this._updateHUD();
    this._startHum();
  }

  _getSpawnPositions(n) {
    const margin = 8;
    const positions = [
      { x: margin,           y: Math.floor(ROWS / 2), dir: 'RIGHT' },
      { x: COLS - margin - 1, y: Math.floor(ROWS / 2), dir: 'LEFT'  },
      { x: Math.floor(COLS / 2), y: margin,             dir: 'DOWN'  },
      { x: Math.floor(COLS / 2), y: ROWS - margin - 1,  dir: 'UP'   },
    ];
    return positions.slice(0, n);
  }

  // ── Update ─────────────────────────────────────────────────
  update(dt) {
    if (this.subState === 'countdown') {
      this.countdownTimer -= dt;
      const sec = Math.ceil(this.countdownTimer);
      this.countdownText = sec > 0 ? String(sec) : 'GO!';
      if (this.countdownTimer <= -0.5) this.subState = 'active';
      return;
    }
    if (this.subState === 'roundover') {
      this.roundOverTimer += dt;
      if (this.roundOverTimer > 2.5) {
        // check match win
        const winner = this.wins.findIndex(w => w >= ROUNDS_TO_WIN);
        if (winner >= 0) {
          this.matchWinner = winner;
          this.subState = 'matchover';
          this.matchOverTimer = 0;
          this._stopHum();
          // achievements
          if (winner === 0) {
            if (this.numAI >= 3) this.achievements.unlock('gladiator');
            if (!this.playerLostRound) this.achievements.unlock('undefeated');
          }
        } else {
          this._startRound();
        }
      }
      return;
    }
    if (this.subState === 'matchover') {
      this.matchOverTimer += dt;
      if (this.matchOverTimer > 4) {
        this.setState('gameover');
        this._stopHum();
      }
      return;
    }
    if (this.subState !== 'active') return;

    // power-up spawn timer
    this.puTimer -= dt;
    if (this.puTimer <= 0) {
      this.puTimer = POWERUP_INTERVAL;
      this._spawnPowerUp();
    }
    for (const pu of this.powerups) pu.age += dt;

    // boost/shield timers
    for (const c of this.cycles) {
      if (!c.alive) continue;
      if (c.boosted) {
        c.boostTimer -= dt;
        c.boostSurviveTime += dt;
        if (c.boostTimer <= 0) c.boosted = false;
        if (c.id === 0 && c.boostSurviveTime >= 5) this.achievements.unlock('daredevil');
      }
      if (c.shielded) {
        c.shieldTimer -= dt;
        if (c.shieldTimer <= 0) c.shielded = false;
      }
    }

    // step movement
    this.stepTimer -= dt;
    const boostedAlive = this.cycles.some(c => c.alive && c.boosted);
    const effectiveInterval = boostedAlive ? this.stepInterval * 0.55 : this.stepInterval;
    if (this.stepTimer <= 0) {
      this.stepTimer += effectiveInterval;
      this._handlePlayerInput();
      this._runAI();
      this._stepCycles();
    }

    // update hum pitch
    this._updateHumPitch();

    // spark trails
    for (const c of this.cycles) {
      if (!c.alive) continue;
      const px = c.x * CELL + CELL / 2, py = c.y * CELL + CELL / 2;
      if (Math.random() < 0.4) {
        this.particles.emitCustom(px, py, {
          preset: 'trail', count: 1, color: c.color,
          speed: 20, life: 0.25, size: 1.5,
        });
      }
    }
  }

  _handlePlayerInput() {
    // P1
    const c0 = this.cycles[0];
    if (c0 && c0.alive) {
      let newDir = null;
      if (this.mode === 2) {
        // P1 uses WASD only
        if (this._rawKeys['KeyW']) newDir = 'UP';
        else if (this._rawKeys['KeyS']) newDir = 'DOWN';
        else if (this._rawKeys['KeyA']) newDir = 'LEFT';
        else if (this._rawKeys['KeyD']) newDir = 'RIGHT';
      } else {
        // 1P mode: arrows or WASD via InputManager
        if (this.input.isDown('UP'))    newDir = 'UP';
        else if (this.input.isDown('DOWN'))  newDir = 'DOWN';
        else if (this.input.isDown('LEFT'))  newDir = 'LEFT';
        else if (this.input.isDown('RIGHT')) newDir = 'RIGHT';
      }
      if (newDir && newDir !== OPPOSITE[c0.dir]) c0.dir = newDir;
    }
    // P2
    if (this.mode === 2 && this.cycles[1] && this.cycles[1].alive) {
      const c1 = this.cycles[1];
      let newDir = null;
      if (this._rawKeys['ArrowUp'])    newDir = 'UP';
      else if (this._rawKeys['ArrowDown'])  newDir = 'DOWN';
      else if (this._rawKeys['ArrowLeft'])  newDir = 'LEFT';
      else if (this._rawKeys['ArrowRight']) newDir = 'RIGHT';
      if (newDir && newDir !== OPPOSITE[c1.dir]) c1.dir = newDir;
    }
  }

  // ── AI ─────────────────────────────────────────────────────
  _runAI() {
    for (const c of this.cycles) {
      if (!c.alive || c.ai === null) continue;
      const ahead = this._lookAhead(c, c.dir);
      const left  = this._turnLeft(c.dir);
      const right = this._turnRight(c.dir);
      const aheadDist = ahead;
      const leftDist  = this._lookAhead(c, left);
      const rightDist = this._lookAhead(c, right);

      if (c.ai === 'aggressive') {
        // if safe ahead, occasionally try to cut toward player
        if (aheadDist < 3 || (Math.random() < 0.15 && aheadDist < 8)) {
          c.dir = leftDist > rightDist ? left : right;
        } else if (Math.random() < 0.08) {
          // steer toward player
          const target = this.cycles[0];
          if (target && target.alive) {
            const dx = target.x - c.x, dy = target.y - c.y;
            const preferred = Math.abs(dx) > Math.abs(dy)
              ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP');
            if (preferred !== OPPOSITE[c.dir] && this._lookAhead(c, preferred) > 3) {
              c.dir = preferred;
            }
          }
        }
      } else if (c.ai === 'cautious') {
        // prefer center, avoid walls aggressively
        if (aheadDist < 5) {
          c.dir = leftDist > rightDist ? left : right;
        } else if (Math.random() < 0.06) {
          const cx = COLS / 2, cy = ROWS / 2;
          const dx = cx - c.x, dy = cy - c.y;
          const preferred = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP');
          if (preferred !== OPPOSITE[c.dir] && this._lookAhead(c, preferred) > 4) {
            c.dir = preferred;
          }
        }
      } else {
        // random
        if (aheadDist < 3) {
          c.dir = leftDist > rightDist ? left : right;
        } else if (Math.random() < 0.1) {
          const options = [left, right].filter(d => this._lookAhead(c, d) > 3);
          if (options.length) c.dir = pick(options);
        }
      }

      // difficulty scaling: lower difficulty = more mistakes
      if (this.difficulty === 0 && Math.random() < 0.03) {
        c.dir = pick([left, right]);
      }
      if (this.difficulty === 2 && aheadDist < 2) {
        // hard: smarter escape
        c.dir = leftDist >= rightDist ? left : right;
      }
    }
  }

  _lookAhead(cycle, dir) {
    const [dx, dy] = DIR[dir];
    let dist = 0;
    let nx = cycle.x, ny = cycle.y;
    while (dist < 50) {
      nx += dx; ny += dy; dist++;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return dist;
      if (this.grid[ny * COLS + nx] !== 0) return dist;
    }
    return dist;
  }

  _turnLeft(dir) {
    return { UP:'LEFT', LEFT:'DOWN', DOWN:'RIGHT', RIGHT:'UP' }[dir];
  }
  _turnRight(dir) {
    return { UP:'RIGHT', RIGHT:'DOWN', DOWN:'LEFT', LEFT:'UP' }[dir];
  }

  // ── Step ───────────────────────────────────────────────────
  _stepCycles() {
    // move each alive cycle one cell
    for (const c of this.cycles) {
      if (!c.alive) continue;
      const [dx, dy] = DIR[c.dir];
      const nx = c.x + dx, ny = c.y + dy;

      // collision check
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || this.grid[ny * COLS + nx] !== 0) {
        if (c.shielded) {
          c.shielded = false;
          this.audio.play('hit');
          this.effects.flash('#fff', 0.1);
          continue; // survive but don't move
        }
        this._killCycle(c, nx, ny);
        continue;
      }

      // leave trail (unless gap)
      if (c.gapRemaining > 0) {
        c.gapRemaining--;
        c.trail.push({ x: c.x, y: c.y, gap: true });
      } else {
        this.grid[c.y * COLS + c.x] = c.id + 1;
        c.trail.push({ x: c.x, y: c.y, gap: false });
      }

      c.x = nx; c.y = ny;

      // check power-up collection
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        if (pu.x === nx && pu.y === ny) {
          this._collectPowerUp(c, pu);
          this.powerups.splice(i, 1);
        }
      }
    }

    // check round end
    const alive = this.cycles.filter(c => c.alive);
    if (alive.length <= 1) {
      this._endRound(alive.length === 1 ? alive[0].id : -1);
    }
  }

  _killCycle(c, hitX, hitY) {
    c.alive = false;
    const px = c.x * CELL + CELL / 2, py = c.y * CELL + CELL / 2;
    // check gap-artist achievement: opponent crashed & player has used gap
    if (c.id !== 0 && hitX >= 0 && hitX < COLS && hitY >= 0 && hitY < ROWS) {
      // if the cell they hit belongs to player's trail, and player used a gap this round
      const cellVal = this.grid[hitY * COLS + hitX];
      if (cellVal === 1 && this.cycles[0].trail.some(t => t.gap)) {
        this.achievements.unlock('gap-artist');
      }
    }
    this.particles.emit(px, py, 'explosion', 25);
    this.particles.emitCustom(px, py, {
      preset: 'debris', count: 8, color: [c.color, '#fff'],
    });
    this.audio.play('explosion');
    this.effects.shake(8, 0.4);
    this.effects.flash(c.color, 0.15);
    if (c.id === 0 || (this.mode === 2 && c.id === 1)) {
      this.playerLostRound = true;
    }
  }

  _endRound(winnerId) {
    this.subState = 'roundover';
    this.roundWinner = winnerId;
    if (winnerId >= 0) {
      this.wins[winnerId]++;
      if (winnerId === 0) this.achievements.unlock('survivor');
    }
    this.score = this.wins[0] * 1000;
    this._updateHUD();
    this._stopHum();
  }

  // ── Power-ups ──────────────────────────────────────────────
  _spawnPowerUp() {
    for (let tries = 0; tries < 20; tries++) {
      const x = irand(5, COLS - 5), y = irand(5, ROWS - 5);
      if (this.grid[y * COLS + x] === 0) {
        this.powerups.push(new PowerUp(x, y, pick(PU_TYPES)));
        return;
      }
    }
  }

  _collectPowerUp(cycle, pu) {
    this.audio.play('powerup');
    const px = pu.x * CELL + CELL / 2, py = pu.y * CELL + CELL / 2;
    this.particles.emitCustom(px, py, {
      preset: 'sparkle', count: 12, color: [PU_COLORS[pu.type], '#fff'],
    });
    switch (pu.type) {
      case 'speed':
        cycle.boosted = true;
        cycle.boostTimer = BOOST_DURATION;
        cycle.boostSurviveTime = 0;
        break;
      case 'gap':
        cycle.gapRemaining = GAP_LENGTH;
        break;
      case 'shield':
        cycle.shielded = true;
        cycle.shieldTimer = SHIELD_DURATION;
        break;
    }
  }

  // ── Sound helpers ──────────────────────────────────────────
  _startHum() {
    this._stopHum();
    try {
      this.audio._init();
      if (!this.audio._ctx) return;
      const ctx = this.audio._ctx;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      g.connect(this.audio._sfxGain);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 80;
      o.connect(g);
      o.start();
      this._hum = o;
      this._humGain = g;
    } catch (_) { /* audio unavailable */ }
  }
  _stopHum() {
    if (this._hum) {
      try { this._hum.stop(); } catch (_) {}
      try { this._hum.disconnect(); } catch (_) {}
      try { this._humGain.disconnect(); } catch (_) {}
      this._hum = null; this._humGain = null;
    }
  }
  _updateHumPitch() {
    if (!this._hum) return;
    const base = 80 + (this.round - 1) * 10;
    const boosted = this.cycles[0] && this.cycles[0].boosted ? 40 : 0;
    try { this._hum.frequency.value = base + boosted; } catch (_) {}
  }

  // ── HUD ────────────────────────────────────────────────────
  _updateHUD() {
    const scoreEl = document.getElementById('hud-score');
    const roundEl = document.getElementById('hud-round');
    const winsEl  = document.getElementById('hud-wins');
    if (scoreEl) scoreEl.textContent = `SCORE ${this.score}`;
    if (roundEl) roundEl.textContent = `ROUND ${this.round}/${ROUNDS_TO_WIN * 2 - 1}`;
    if (winsEl)  winsEl.textContent  = `WINS ${this.wins[0] || 0}`;
  }

  drawHUD() {} // we manage our own HUD

  // ── Render ─────────────────────────────────────────────────
  render(ctx) {
    this._drawGrid(ctx);
    if (!this.grid) return;

    // draw trails with glow
    for (const c of this.cycles) {
      // trail cells
      ctx.save();
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = c.color;
      for (const t of c.trail) {
        if (t.gap) continue;
        ctx.fillRect(t.x * CELL + 1, t.y * CELL + 1, CELL - 2, CELL - 2);
      }
      // glow layer
      ctx.globalAlpha = 0.3;
      ctx.shadowBlur = 14;
      for (const t of c.trail) {
        if (t.gap) continue;
        ctx.fillRect(t.x * CELL, t.y * CELL, CELL, CELL);
      }
      ctx.restore();

      // cycle head
      if (c.alive) {
        ctx.save();
        ctx.shadowColor = c.color; ctx.shadowBlur = 16;
        ctx.fillStyle = '#fff';
        ctx.fillRect(c.x * CELL, c.y * CELL, CELL, CELL);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(c.x * CELL - 2, c.y * CELL - 2, CELL + 4, CELL + 4);
        ctx.restore();

        // shield indicator
        if (c.shielded) {
          ctx.save();
          ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 100);
          ctx.strokeRect(c.x * CELL - 3, c.y * CELL - 3, CELL + 6, CELL + 6);
          ctx.restore();
        }
        // boost indicator
        if (c.boosted) {
          ctx.save();
          ctx.strokeStyle = '#ff0'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
          ctx.strokeRect(c.x * CELL - 2, c.y * CELL - 2, CELL + 4, CELL + 4);
          ctx.restore();
        }
      }
    }

    // power-ups
    for (const pu of this.powerups) {
      const px = pu.x * CELL + CELL / 2, py = pu.y * CELL + CELL / 2;
      const pulse = 0.7 + 0.3 * Math.sin(pu.age * 4);
      ctx.save();
      ctx.shadowColor = PU_COLORS[pu.type]; ctx.shadowBlur = 10 * pulse;
      ctx.fillStyle = PU_COLORS[pu.type]; ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000'; ctx.globalAlpha = 1;
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(PU_LABELS[pu.type], px, py);
      ctx.restore();
    }

    // minimap (top right)
    this._drawMinimap(ctx);

    // countdown overlay
    if (this.subState === 'countdown') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#0ff'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#0ff';
      ctx.font = 'bold 80px "Courier New", monospace';
      ctx.fillText(this.countdownText, W / 2, H / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#88a'; ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText(`ROUND ${this.round}`, W / 2, H / 2 - 80);
      ctx.restore();
    }

    // round over overlay
    if (this.subState === 'roundover') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const winColor = this.roundWinner >= 0 ? COLORS[this.roundWinner] : '#fff';
      ctx.shadowColor = winColor; ctx.shadowBlur = 20;
      ctx.fillStyle = winColor;
      ctx.font = 'bold 36px "Courier New", monospace';
      const winName = this.roundWinner >= 0 ? NAMES[this.roundWinner] : 'NOBODY';
      ctx.fillText(`${winName} WINS ROUND ${this.round}!`, W / 2, H / 2 - 30);
      // scoreboard
      ctx.font = '18px "Courier New", monospace'; ctx.shadowBlur = 0;
      for (let i = 0; i < this.wins.length; i++) {
        ctx.fillStyle = COLORS[i];
        const label = (i === 0) ? 'P1' : (this.mode === 2 && i === 1) ? 'P2' : NAMES[i];
        ctx.fillText(`${label}: ${this.wins[i]} wins`, W / 2, H / 2 + 20 + i * 28);
      }
      ctx.restore();
    }

    // match over overlay
    if (this.subState === 'matchover') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const mColor = COLORS[this.matchWinner] || '#fff';
      ctx.shadowColor = mColor; ctx.shadowBlur = 30;
      ctx.fillStyle = mColor;
      ctx.font = 'bold 44px "Courier New", monospace';
      const mName = this.matchWinner === 0 ? 'YOU WIN!' :
        (this.mode === 2 && this.matchWinner === 1) ? 'P2 WINS!' : `${NAMES[this.matchWinner]} WINS!`;
      ctx.fillText(mName, W / 2, H / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = '22px "Courier New", monospace';
      ctx.fillText('MATCH OVER', W / 2, H / 2 + 20);
      // confetti
      if (this.matchOverTimer < 0.5) {
        this.particles.emit(W / 2, H / 3, 'confetti', 30);
      }
      ctx.restore();
    }
  }

  // ── Grid background ────────────────────────────────────────
  _drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += CELL) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Minimap ────────────────────────────────────────────────
  _drawMinimap(ctx) {
    const mw = 100, mh = 75, mx = W - mw - 8, my = 8;
    const sx = mw / COLS, sy = mh / ROWS;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
    // trails
    for (const c of this.cycles) {
      ctx.fillStyle = c.color;
      for (const t of c.trail) {
        if (t.gap) continue;
        ctx.fillRect(mx + t.x * sx, my + t.y * sy, Math.max(1, sx), Math.max(1, sy));
      }
      if (c.alive) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 3, 3);
      }
    }
    ctx.restore();
  }

  // ── Game Over screen ───────────────────────────────────────
  renderGameOver(ctx) {
    this._drawGrid(ctx);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#0ff'; ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = '24px "Courier New", monospace';
    ctx.fillText(`FINAL SCORE: ${this.score}`, W / 2, H / 2);
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#0ff'; ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText('PRESS START TO CONTINUE', W / 2, H / 2 + 60);
    }
    ctx.restore();
  }

  // override default game over to avoid double overlay
  _renderDefaultGameOver(ctx) {
    this.renderGameOver(ctx);
  }

  // cleanup
  destroy() {
    this._stopHum();
    document.removeEventListener('keydown', this._onRawDown);
    document.removeEventListener('keyup',   this._onRawUp);
    super.destroy();
  }
}

// ── Bootstrap ────────────────────────────────────────────────
const game = new NeonCycles('game-canvas', {
  width: W, height: H, background: '#000a12',
});

})();
