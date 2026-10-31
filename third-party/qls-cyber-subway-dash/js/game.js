window.SD = window.SD || {};

(function () {
  'use strict';

  const C = window.SD.Config;

  const G = (window.SD.Game = {
    state: 'menu',
    world: null,
    player: null,
    score: 0,
    coins: 0,
    totalCoins: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    time: 0,
    shake: 0,
    flash: 0,
    crashTimer: 0,
    cameraX: 0,
    bite: 0,
    effects: null,
    extraLives: 0,
    invincible: 0,
    els: {},

    init() {
      this.world = window.SD.World;
      this.world.reset();
      this.world.ambient = true;
      this.player = this._makePlayer();
      try {
        this.best = parseInt(localStorage.getItem(C.BEST_KEY) || '0', 10) || 0;
        this.totalCoins = parseInt(localStorage.getItem(C.TOTAL_KEY) || '0', 10) || 0;
      } catch (e) {
        this.best = 0;
        this.totalCoins = 0;
      }

      this.els = {
        score: document.getElementById('score'),
        dist: document.getElementById('dist'),
        coins: document.getElementById('coins'),
        best: document.getElementById('best'),
        combo: document.getElementById('combo'),
        hud: document.getElementById('hud'),
        menu: document.getElementById('menu'),
        over: document.getElementById('over'),
        pause: document.getElementById('pause'),
        newBest: document.getElementById('new-best'),
        finalScore: document.getElementById('final-score'),
        finalDist: document.getElementById('final-dist'),
        finalCoins: document.getElementById('final-coins'),
        btnStart: document.getElementById('btn-start'),
        btnRestart: document.getElementById('btn-restart'),
        btnResume: document.getElementById('btn-resume'),
        btnPause: document.getElementById('btn-pause'),
        btnMute: document.getElementById('btn-mute'),
        fx: document.getElementById('fx'),
        lives: document.getElementById('lives')
      };

      this.els.btnStart.addEventListener('click', () => this.start());
      this.els.btnRestart.addEventListener('click', () => this.start());
      this.els.btnResume.addEventListener('click', () => this.togglePause());
      this.els.btnPause.addEventListener('click', () => this.togglePause());
      this.els.btnMute.addEventListener('click', () => {
        window.SD.Audio.ensure();
        window.SD.Audio.setMuted(!window.SD.Audio.muted);
        this.els.btnMute.textContent = window.SD.Audio.muted ? '静音' : '声音';
      });

      if (/[?&]debug=1/.test(location.search)) {
        const d = document.getElementById('debug');
        if (d) d.classList.remove('hidden');
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });

      this._syncHud();
    },

    _makePlayer() {
      return {
        lane: 0,
        x: 0,
        targetX: 0,
        y: 0,
        vy: 0,
        onGround: true,
        sliding: false,
        slideTimer: 0,
        runPhase: 0,
        height: C.PLAYER_HEIGHT,
        hit: false
      };
    },

    start() {
      this.world.reset();
      this.world.onCoin = (c) => { this.world.burst(c.x, c.y, c.z, '#ffd75e', 6, 3); this._onCoin(); };
      this.world.onCrash = () => this._onCrash();
      this.world.onPowerup = (pu) => this._onPowerup(pu);
      this.world.onSmash = () => this._onSmash();
      this.player = this._makePlayer();
      this.score = 0;
      this.coins = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.time = 0;
      this.shake = 0;
      this.flash = 0;
      this.cameraX = 0;
      this.effects = {
        magnet: 0,
        shield: false,
        dash: 0,
        doubleCoins: 0,
        slowmo: 0,
        spring: 0
      };
      this.extraLives = 0;
      this.invincible = 0;
      this.bite = 0;
      this.state = 'playing';
      window.SD.Audio.startMusic();
      this._show(this.els.hud);
      this._hide(this.els.menu);
      this._hide(this.els.over);
      this._hide(this.els.pause);
      this._syncHud();
    },

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        this._show(this.els.pause);
        window.SD.Audio.suspend();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this._hide(this.els.pause);
        window.SD.Audio.resume();
      }
    },

    _applyAction(a) {
      const p = this.player;
      if (a.type === 'confirm') {
        if (this.state === 'menu' || this.state === 'over') this.start();
        else if (this.state === 'paused') this.togglePause();
        return;
      }
      if (a.type === 'pause') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        return;
      }
      if (this.state !== 'playing' || p.hit) return;

      if (a.type === 'lane') {
        const t = window.SD.clamp(p.lane + a.dir, -1, 1);
        if (t !== p.lane) {
          p.lane = t;
          p.targetX = this.world.laneX(t);
        }
      } else if (a.type === 'jump') {
        if (p.onGround) {
          p.vy = C.JUMP_V * (this.effects && this.effects.spring > 0 ? C.SPRING_JUMP : 1);
          p.onGround = false;
          p.sliding = false;
          p.slideTimer = 0;
          window.SD.Audio.jump();
        }
      } else if (a.type === 'slide') {
        if (p.onGround && !p.sliding) {
          p.sliding = true;
          p.slideTimer = C.SLIDE_TIME;
          window.SD.Audio.slide();
        }
      }
    },

    update(dt) {
      let a;
      while ((a = window.SD.Input.take())) this._applyAction(a);

      if (this.state === 'menu') {
        this.world.ambientUpdate(dt);
        this.player.runPhase += this.world.speed * dt * 2.6;
        return;
      }

      if (this.state === 'paused') return;

      if (this.state === 'playing') {
        this.time += dt;
        this._tickEffects(dt);
        this._updatePlayer(dt);
        const fx = this.effects;
        this.world.speedScale = this.speedScale();
        this.world.update(dt, this.player, {
          magnet: fx && fx.magnet > 0,
          dash: fx && fx.dash > 0,
          invincible: this.invincible > 0
        });
        this._comboTick(dt);
        this._syncHud();
        this._updateDebug();
        this.shake = Math.max(0, this.shake - dt * 8);
      } else if (this.state === 'crashing') {
        this.crashTimer -= dt;
        this.bite = Math.min(1, 1 - this.crashTimer / 2.4);
        this.world.update(dt * 0.2, this.player);
        this.shake = Math.max(0, this.shake - dt * 26);
        this.flash = Math.max(0, this.flash - dt * 1.2);
        const chomp = (this.bite > 0.3 && this.bite < 0.36) || (this.bite > 0.62 && this.bite < 0.68) || (this.bite > 0.9 && this.bite < 0.97);
        if (chomp) {
          this.shake = Math.max(this.shake, 7);
          this.flash = Math.max(this.flash, 0.45);
        }
        if (this.crashTimer <= 0) this._finishCrash();
      } else if (this.state === 'over') {
        this.world.ambientUpdate(dt);
      }
      this.flash = Math.max(0, this.flash - dt * 0.8);
    },

    _updatePlayer(dt) {
      const p = this.player;
      const k = Math.min(1, dt * C.LANE_LERP);
      p.x += (p.targetX - p.x) * k;
      this.cameraX += (p.x - this.cameraX) * Math.min(1, dt * 5);

      if (!p.onGround) {
        p.vy -= C.GRAVITY * dt;
        p.y += p.vy * dt;
        const surf = this.world.surfaceAt(p);
        if (p.y <= surf && p.vy <= 0) {
          p.y = surf;
          p.vy = 0;
          p.onGround = true;
          this.world.burst(p.x, surf + 0.06, C.PLAYER_Z, '#cfd8e3', 4, 1.2);
        }
      } else {
        const surf = this.world.surfaceAt(p);
        if (surf > p.y) {
          p.y = surf;
        } else if (p.y - surf > 0.05) {
          p.onGround = false;
          p.vy = 0;
        } else {
          p.y = surf;
        }
      }
      if (p.sliding) {
        p.slideTimer -= dt;
        if (p.slideTimer <= 0) p.sliding = false;
      }
      p.runPhase += this.world.speed * dt * 2.6;
    },

    _tickEffects(dt) {
      const fx = this.effects;
      if (!fx) return;
      if (fx.magnet > 0) fx.magnet = Math.max(0, fx.magnet - dt);
      if (fx.dash > 0) fx.dash = Math.max(0, fx.dash - dt);
      if (fx.doubleCoins > 0) fx.doubleCoins = Math.max(0, fx.doubleCoins - dt);
      if (fx.slowmo > 0) fx.slowmo = Math.max(0, fx.slowmo - dt);
      if (fx.spring > 0) fx.spring = Math.max(0, fx.spring - dt);
      if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);
    },

    speedScale() {
      const fx = this.effects;
      if (!fx) return 1;
      let s = 1;
      if (fx.dash > 0) s *= C.DASH_SPEED;
      if (fx.slowmo > 0) s *= C.SLOWMO_SPEED;
      return s;
    },

    _onPowerup(pu) {
      const fx = this.effects;
      if (!fx) return;
      const type = pu.type;
      if (type === 'magnet') fx.magnet = C.FX_MAGNET;
      else if (type === 'shield') fx.shield = true;
      else if (type === 'dash') fx.dash = C.FX_DASH;
      else if (type === 'doubleCoins') fx.doubleCoins = C.FX_2X;
      else if (type === 'slowmo') fx.slowmo = C.FX_SLOWMO;
      else if (type === 'spring') fx.spring = C.FX_SPRING;
      else if (type === 'coinShower') this.world.coinShower();
      else if (type === 'extraLife') this.extraLives++;
      this.world.burst(pu.x, pu.y, pu.z, this._powerupColor(type), 10, 4);
      window.SD.Audio.powerup();
    },

    _powerupColor(type) {
      const map = {
        magnet: '#ff5e5e',
        shield: '#4fc3f7',
        dash: '#ffd60a',
        doubleCoins: '#b388ff',
        slowmo: '#4dd0e1',
        spring: '#8bc34a',
        coinShower: '#ffd75e',
        extraLife: '#ff4d6d'
      };
      return map[type] || '#ffffff';
    },

    _onSmash() {
      this.score += C.SMASH_SCORE;
      this.shake = Math.max(this.shake, 5);
      window.SD.Audio.smash();
    },

    _onCoin() {
      this.coins++;
      this.combo++;
      this.comboTimer = 1.6;
      const mult = 1 + Math.min(0.1 * this.combo, 0.5);
      const fx = this.effects;
      this.score += Math.round(C.COIN_VALUE * mult) * (fx && fx.doubleCoins > 0 ? 2 : 1);
      window.SD.Audio.coin();
      if (this.combo >= 2) this._showCombo();
    },

    _onCrash() {
      if (this.state !== 'playing') return;
      if (this.invincible > 0) return;
      if (this.effects && this.effects.shield) {
        this.effects.shield = false;
        this.world.crashed = false;
        this.invincible = 0.8;
        this.flash = Math.max(this.flash, 0.6);
        this.world.burst(this.player.x, 1.0, C.PLAYER_Z, '#4fc3f7', 14, 5);
        window.SD.Audio.shieldBreak();
        return;
      }
      if (this.extraLives > 0) {
        this.extraLives--;
        this.combo = 0;
        this.comboTimer = 0;
        this.invincible = 2;
        this.world.crashed = false;
        this.flash = Math.max(this.flash, 0.5);
        this.world.burst(this.player.x, 1.0, C.PLAYER_Z, '#ff4d6d', 16, 6);
        window.SD.Audio.revive();
        this._hide(this.els.combo);
        return;
      }
      this.state = 'crashing';
      this.bite = 0;
      this.crashTimer = 2.4;
      this.shake = 17;
      this.flash = 1;
      this.player.hit = true;
      window.SD.Audio.crash();
      window.SD.Audio.bite();
      window.SD.Audio.stopMusic();
      const px = this.player.x;
      this.world.burst(px, 1.0, C.PLAYER_Z, '#ff5e4a', 16, 6);
      this.world.burst(px, 1.3, C.PLAYER_Z, '#ffb84d', 10, 4);
    },

    _finishCrash() {
      this.state = 'over';
      const total = this.score;
      let newBest = false;
      if (total > this.best) {
        this.best = total;
        newBest = true;
        try {
          localStorage.setItem(C.BEST_KEY, String(total));
        } catch (e) {}
      }
      this.totalCoins += this.coins;
      try {
        localStorage.setItem(C.TOTAL_KEY, String(this.totalCoins));
      } catch (e) {}
      this.els.finalScore.textContent = total;
      this.els.finalDist.textContent = Math.floor(this.world.distance);
      this.els.finalCoins.textContent = this.coins;
      this.els.newBest.classList.toggle('hidden', !newBest);
      this._hide(this.els.combo);
      this._show(this.els.over);
      this._syncHud();
    },

    _comboTick(dt) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
          this._hide(this.els.combo);
        }
      }
    },

    _showCombo() {
      const el = this.els.combo;
      const mult = 1 + Math.min(0.1 * this.combo, 0.5);
      el.textContent = '连击 x' + this.combo + '　+' + Math.round(C.COIN_VALUE * mult) + '分';
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      this._show(el);
    },

    _updateDebug() {
      const el = document.getElementById('debug');
      if (!el || el.classList.contains('hidden')) return;
      const r = window.SD.Renderer;
      const p = this.player;
      el.textContent =
        'window ' + window.innerWidth + 'x' + window.innerHeight +
        ' dpr ' + (window.devicePixelRatio || 1).toFixed(2) +
        '\ncanvas ' + r.W + 'x' + r.H + ' css ' + r.canvas.clientWidth + 'x' + r.canvas.clientHeight +
        '\nscale ' + (window.SD.sceneScale || 0).toFixed(2) +
        ' focal ' + r.focal.toFixed(0) + ' horizon ' + r.horizon.toFixed(0) +
        '\nx ' + p.x.toFixed(2) + ' cam ' + this.cameraX.toFixed(2) +
        ' dist ' + Math.floor(this.world.distance) +
        (r.lastError ? '\nrenderErr ' + (r.lastError.message || r.lastError) : '');
    },

    _syncHud() {
      this.els.score.textContent = this.score;
      this.els.dist.textContent = Math.floor(this.world.distance);
      this.els.coins.textContent = this.coins;
      this.els.best.textContent = this.best;
      this._syncFx();
    },

    _syncFx() {
      const fxEl = this.els.fx;
      const lives = this.els.lives;
      if (this.extraLives > 0) {
        lives.textContent = '命×' + this.extraLives;
        this._show(lives);
      } else {
        this._hide(lives);
      }
      if (!this.effects) {
        fxEl.innerHTML = '';
        this._hide(fxEl);
        return;
      }
      const pills = [];
      if (this.effects.magnet > 0) pills.push(this._fxPill('magnet', '磁铁', this.effects.magnet));
      if (this.effects.shield) pills.push(this._fxPill('shield', '护盾', 0));
      if (this.effects.dash > 0) pills.push(this._fxPill('dash', '冲刺', this.effects.dash));
      if (this.effects.doubleCoins > 0) pills.push(this._fxPill('doubleCoins', '双倍', this.effects.doubleCoins));
      if (this.effects.slowmo > 0) pills.push(this._fxPill('slowmo', '慢速', this.effects.slowmo));
      if (this.effects.spring > 0) pills.push(this._fxPill('spring', '弹簧', this.effects.spring));
      if (pills.length) {
        fxEl.innerHTML = pills.join('');
        this._show(fxEl);
      } else {
        fxEl.innerHTML = '';
        this._hide(fxEl);
      }
    },

    _fxPill(type, name, seconds) {
      const time = seconds > 0 ? ' <span class="fx-time">' + Math.ceil(seconds) + 's</span>' : '';
      return '<span class="fx-pill"><img src="' + this._fxIcon(type) + '" alt=""><b>' + name + '</b>' + time + '</span>';
    },

    _fxIcon(type) {
      if (!this._fxIconCache) this._fxIconCache = {};
      if (!this._fxIconCache[type]) {
        this._fxIconCache[type] = window.SD.Renderer.makeIconDataURL(type, 36);
      }
      return this._fxIconCache[type];
    },

    _show(el) {
      el.classList.remove('hidden');
    },

    _hide(el) {
      el.classList.add('hidden');
    }
  });
})();