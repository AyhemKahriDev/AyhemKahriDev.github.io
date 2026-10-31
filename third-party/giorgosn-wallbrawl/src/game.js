'use strict';
// Main game object: state machine (title / edit / play), fixed-step loop,
// round management, rendering, HUD.

const G = {
  state: 'title',
  players: [],
  particles: null,
  shake: 0,
  scores: [0, 0],
  round: { phase: 'countdown', t: 1, num: 0, banner: '' },
  WIN_SCORE: 5,
  canvas: null,
  ctx: null,
  lastT: 0,
  acc: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.particles = new ParticleSystem();
    this.players = [new Player(0), new Player(1)];
    ArenaStore.load();
    Input.init();
    Calib.init();
    Editor.init();
    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('pointerdown', e => {
      if (this.state === 'title' && !e.target.closest('#toolbar')) this.setState('edit');
    });
    this.setState('title');
    requestAnimationFrame(t => this.frame(t));
  },

  onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return; // typing in a field
    if (e.code === 'KeyM') {
      Sound.muted = !Sound.muted;
      this.flashHint(Sound.muted ? 'Sound muted' : 'Sound on');
    }
    if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      this.setState('edit');
      return;
    }
    if (HeadEditor.active) { // photo crop modal owns the keyboard
      if (e.code === 'Escape') HeadEditor.close();
      if (e.code === 'Enter') HeadEditor.apply();
      return;
    }
    if (e.code === 'KeyC' && this.state !== 'title') { this.toggleCalib(); return; }
    if (e.code === 'Escape') {
      if (Calib.active) { this.toggleCalib(); return; }
      if (Editor.polyDraft) { Editor.cancelPoly(); return; }
      if (this.state === 'play') this.setState('edit');
      return;
    }
    if (e.code === 'Enter' && this.state === 'edit' && !Calib.active) {
      if (Editor.polyDraft) { Editor.closePoly(); return; }
      this.startMatch();
      return;
    }
    if (e.code === 'KeyG' && this.state === 'play') {
      ArenaStore.current.showGeo = !ArenaStore.current.showGeo;
      ArenaStore.save();
    }
    Editor.key(e);
  },

  hintFor(state) {
    return state === 'edit'
      ? 'Tools V/B/O/W/P/X · arrows nudge · Ctrl+Z undo · Ctrl+D duplicate · Del remove · Q/E rotate · Enter or ▶ fight · C calibrate'
      : state === 'play'
        ? 'Esc editor · S/↓ aim down · G geometry ghost · M mute'
        : '';
  },

  flashHint(text) {
    const el = document.getElementById('hint');
    el.textContent = text;
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => {
      if (!Calib.active) el.textContent = this.hintFor(this.state);
    }, 1500);
  },

  setState(s) {
    this.state = s;
    document.getElementById('toolbar').style.display = s === 'edit' ? 'flex' : 'none';
    document.getElementById('hint').textContent = this.hintFor(s);
    if (s === 'edit') Editor.syncUI();
    Editor.updateProps();
  },

  toggleCalib() {
    Calib.setActive(!Calib.active);
    document.getElementById('hint').textContent = Calib.active
      ? 'Drag the four glowing corners until the dashed frame lines up with your wall · C when done'
      : this.hintFor(this.state);
  },

  startMatch() {
    if (!ArenaStore.current.shapes.length) {
      this.setState('edit');
      this.flashHint('Draw at least one platform first — or hit Demo');
      return;
    }
    this.scores = [0, 0];
    this.round.num = 0;
    this.startRound();
    this.setState('play');
  },

  startRound() {
    Weapons.reset();
    this.particles.arr.length = 0;
    this.round.num++;
    this.round.phase = 'countdown';
    this.round.t = 1.1;
    this.round.banner = 'ROUND ' + this.round.num;
    const sp = ArenaStore.current.spawns;
    this.players[0].reset(sp[0][0], sp[0][1]);
    this.players[1].reset(sp[1][0], sp[1][1]);
    Sound.round();
  },

  // Gamepad menu navigation: any button on the title, Start (button 9) in the editor.
  padMenu() {
    let any = false, start = false;
    try {
      for (const pad of (navigator.getGamepads ? navigator.getGamepads() : [])) {
        if (!pad || !pad.connected) continue;
        if (pad.buttons.some(b => b && b.pressed)) any = true;
        if (pad.buttons[9] && pad.buttons[9].pressed) start = true;
      }
    } catch (e) {}
    if (!any) { this._padHeld = false; return; }
    if (this._padHeld) return;
    if (this.state === 'title') { this._padHeld = true; this.setState('edit'); }
    else if (this.state === 'edit' && start && !Calib.active) { this._padHeld = true; this.startMatch(); }
  },

  update(dt) {
    Input.poll();
    this.padMenu();
    this.shake = Math.max(0, this.shake - dt * 30);
    this.particles.update(dt);
    if (this.state !== 'play') return;
    const r = this.round;
    if (r.phase === 'countdown') {
      r.t -= dt;
      if (r.t <= 0) { r.phase = 'live'; r.banner = ''; }
      return;
    }
    for (const p of this.players) p.update(dt);
    // soft body collision so fighters can't fully overlap
    const [a, b] = this.players;
    if (a.alive && b.alive) {
      const d = Math.hypot(b.x - a.x, b.y - a.y), rr = (a.r + b.r) * 0.8;
      if (d > 0 && d < rr) {
        const push = (rr - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
    Weapons.update(dt);
    if (r.phase === 'live') {
      const alive = this.players.filter(p => p.alive);
      if (alive.length <= 1) {
        r.phase = 'over';
        r.t = 1.7;
        if (alive.length === 1) {
          this.scores[alive[0].idx]++;
          r.banner = 'PLAYER ' + (alive[0].idx + 1) + ' SCORES';
          if (this.scores[alive[0].idx] >= this.WIN_SCORE) {
            r.phase = 'match';
            r.t = 3.2;
            r.banner = 'PLAYER ' + (alive[0].idx + 1) + ' WINS THE WALL';
          }
        } else {
          r.banner = 'DRAW';
        }
      }
    } else if (r.phase === 'over') {
      r.t -= dt;
      if (r.t <= 0) this.startRound();
    } else if (r.phase === 'match') {
      r.t -= dt;
      if (r.t <= 0) {
        this.scores = [0, 0];
        this.round.num = 0;
        this.startRound();
      }
    }
  },

  frame(t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    this.acc += dt;
    const step = 1 / 120;
    let n = 0;
    while (this.acc >= step && n++ < 8) {
      this.update(step);
      this.acc -= step;
    }
    if (this.acc > step) this.acc = 0; // long pause: drop backlog
    this.render();
    requestAnimationFrame(tt => this.frame(tt));
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    if (this.state === 'title') { this.renderTitle(ctx); return; }
    if (this.state === 'edit') { Editor.draw(ctx); return; }
    // play: solid shapes are the invisible wall-matching geometry (ghost optional);
    // deadly/bouncy shapes are game elements and always projected
    for (const s of ArenaStore.current.shapes) {
      if ((s.k || 'solid') === 'solid') {
        if (ArenaStore.current.showGeo) drawShape(ctx, s, 0.16, false);
      } else {
        drawShape(ctx, s, 0.9, false, true);
      }
    }
    Weapons.draw(ctx);
    for (const p of this.players) p.draw(ctx);
    this.particles.draw(ctx);
    this.renderHUD(ctx);
  },

  renderTitle(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#27e6ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#27e6ff';
    ctx.font = '900 92px system-ui,sans-serif';
    ctx.fillText('WALLBRAWL', W / 2, H * 0.34);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '500 24px system-ui,sans-serif';
    ctx.fillText('Projection-mapped stick fights for your walls', W / 2, H * 0.34 + 72);
    if (Math.sin(performance.now() / 300) > -0.3) {
      ctx.fillStyle = '#e8f4ff';
      ctx.font = '600 26px system-ui,sans-serif';
      ctx.fillText('Click or press Enter to build your arena', W / 2, H * 0.62);
    }
    ctx.fillStyle = '#5d7285';
    ctx.font = '500 17px system-ui,sans-serif';
    ctx.fillText('P1  A/D · W jump · F attack · S aim down      P2  arrows · L attack      Gamepad  stick · A · X/RT · Start = fight', W / 2, H * 0.78);
    ctx.restore();
  },

  renderHUD(ctx) {
    ctx.save();
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.shadowColor = PLAYER_COLORS[i];
      ctx.shadowBlur = 8;
      for (let k = 0; k < this.WIN_SCORE; k++) {
        const x = i === 0 ? 28 + k * 22 : W - 28 - k * 22;
        ctx.globalAlpha = k < this.scores[i] ? 1 : 0.18;
        ctx.beginPath();
        ctx.arc(x, 26, 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.font = '600 13px system-ui,sans-serif';
    for (const p of this.players) {
      if (p.alive && p.weapon) {
        ctx.fillStyle = '#ffd94a';
        ctx.fillText(p.weapon.toUpperCase() + ' ' + p.ammo, p.x, p.y - p.r * 2.6);
      }
    }
    if (this.round.banner) {
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px system-ui,sans-serif';
      ctx.fillText(this.round.banner, W / 2, H * 0.3);
    }
    ctx.restore();
  },
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => G.init());
} else {
  G.init(); // scripts injected after load (e.g. artifact hosting)
}
