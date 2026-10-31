(function () {
  'use strict';

  const R = (window.CursorArcade = window.CursorArcade || {});
  R.games = R.games || {};

  const MODE_NAMES = {
    classic: 'Classic',
    wall: 'Wall',
    portal: 'Portal',
    borderless: 'Borderless',
    cheese: 'Cheese',
    daily: 'Daily',
  };

  const MODE_HINTS = {
    classic: 'Walls kill, self kills. The original.',
    wall: 'Random interior walls spawn at start.',
    portal: 'A pair of portals wraps you across the board.',
    borderless: 'Edges wrap — you can\'t hit a wall.',
    cheese: 'Pass through yourself. Apples give +2 length.',
    daily: 'Deterministic daily challenge. Same board worldwide.',
  };

  const SPEEDS = { slow: 170, normal: 110, fast: 75, turbo: 48 };
  const COLS = 21;
  const ROWS = 15;
  const CELL = 26;

  const KEY_DIR = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    W: { x: 0, y: -1 },
    S: { x: 0, y: 1 },
    A: { x: -1, y: 0 },
    D: { x: 1, y: 0 },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function todaySeed() {
    const d = new Date();
    return (d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()) >>> 0;
  }

  R.games.snake = {
    create(c) {
      return new SnakeGame(c);
    },
  };

  class SnakeGame {
    constructor({ host, api, meta, options }) {
      this.api = api;
      this.meta = meta;
      this.host = host;
      this.daily = !!(options && options.daily);

      const saved = api.getSettings('snake') || {};
      this.mode = this.daily ? 'daily' : saved.mode || 'classic';
      this.speed = saved.speed || 'normal';

      this.canvas = document.createElement('canvas');
      this.canvas.width = COLS * CELL;
      this.canvas.height = ROWS * CELL;
      this.canvas.style.border = '1px solid var(--line-strong)';
      this.canvas.style.borderRadius = '4px';
      host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.last = 0;
      this.acc = 0;
      this.paused = false;
      this.dead = false;
      this.rafId = null;

      api.setTopbarControls({ pause: true, restart: true });

      this.reset();
      this.loop = this.loop.bind(this);
      this.rafId = requestAnimationFrame(this.loop);
    }

    reset() {
      const seed = this.mode === 'daily' ? todaySeed() : (Math.random() * 2 ** 32) >>> 0;
      this.rng = mulberry32(seed);
      this.snake = [
        { x: 10, y: 7 },
        { x: 9, y: 7 },
        { x: 8, y: 7 },
      ];
      this.dir = { x: 1, y: 0 };
      this.dirQueue = [];
      this.apples = [];
      this.walls = [];
      this.portals = [];
      this.score = 0;
      this.growBy = 0;
      this.dead = false;
      this.paused = false;
      this.api.hideOverlay();

      // Mode setup
      const mode = this.mode === 'daily' ? 'classic' : this.mode;
      if (mode === 'wall' || (this.mode === 'daily' && this.rng() > 0.5)) {
        this.spawnWalls(8);
      }
      if (mode === 'portal') {
        this.spawnPortals();
      }
      this.spawnApple();
      this.updateStats();
    }

    updateStats() {
      const label = this.mode === 'daily' ? 'daily' : this.mode;
      const best = this.api.getHighScore('snake:' + (this.mode === 'daily' ? 'daily' : this.mode));
      this.api.setStats({
        mode: MODE_NAMES[label] || label,
        score: this.score,
        best,
        len: this.snake.length,
      });
    }

    spawnWalls(n) {
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const x = 2 + Math.floor(this.rng() * (COLS - 4));
          const y = 2 + Math.floor(this.rng() * (ROWS - 4));
          if (this.occupied(x, y)) continue;
          this.walls.push({ x, y });
          break;
        }
      }
    }

    spawnPortals() {
      let a, b, tries = 0;
      do {
        a = { x: Math.floor(this.rng() * COLS), y: Math.floor(this.rng() * ROWS) };
        b = { x: Math.floor(this.rng() * COLS), y: Math.floor(this.rng() * ROWS) };
        tries++;
      } while (tries < 50 && (this.occupied(a.x, a.y) || this.occupied(b.x, b.y) || (a.x === b.x && a.y === b.y)));
      this.portals = [a, b];
    }

    spawnApple() {
      let tries = 0;
      while (tries < 100) {
        const x = Math.floor(this.rng() * COLS);
        const y = Math.floor(this.rng() * ROWS);
        if (!this.occupied(x, y)) {
          this.apples.push({ x, y });
          return;
        }
        tries++;
      }
    }

    occupied(x, y, skipHead = false) {
      for (let i = 0; i < this.snake.length; i++) {
        if (skipHead && i === 0) continue;
        if (this.snake[i].x === x && this.snake[i].y === y) return true;
      }
      for (const w of this.walls) if (w.x === x && w.y === y) return true;
      for (const a of this.apples) if (a.x === x && a.y === y) return true;
      for (const p of this.portals) if (p.x === x && p.y === y) return true;
      return false;
    }

    queueDir(d) {
      if (this.dead) return;
      const last = this.dirQueue.length ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
      if (last.x === -d.x && last.y === -d.y && this.snake.length > 1) return;
      if (last.x === d.x && last.y === d.y) return;
      if (this.dirQueue.length < 2) this.dirQueue.push({ ...d });
    }

    step() {
      if (this.dirQueue.length) this.dir = this.dirQueue.shift();
      let nx = this.snake[0].x + this.dir.x;
      let ny = this.snake[0].y + this.dir.y;

      // Wrap
      const wrap = this.mode === 'borderless';
      if (wrap) {
        nx = (nx + COLS) % COLS;
        ny = (ny + ROWS) % ROWS;
      }

      // Out of bounds => die
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return this.die();

      // Wall collision
      for (const w of this.walls) {
        if (w.x === nx && w.y === ny) return this.die();
      }

      // Self collision (cheese mode skips)
      if (this.mode !== 'cheese') {
        for (let i = 0; i < this.snake.length - 1; i++) {
          if (this.snake[i].x === nx && this.snake[i].y === ny) return this.die();
        }
      }

      // Portal
      if (this.portals.length === 2) {
        if (this.portals[0].x === nx && this.portals[0].y === ny) {
          nx = this.portals[1].x + this.dir.x;
          ny = this.portals[1].y + this.dir.y;
        } else if (this.portals[1].x === nx && this.portals[1].y === ny) {
          nx = this.portals[0].x + this.dir.x;
          ny = this.portals[0].y + this.dir.y;
        }
      }

      // Eat
      let ateIdx = -1;
      for (let i = 0; i < this.apples.length; i++) {
        if (this.apples[i].x === nx && this.apples[i].y === ny) {
          ateIdx = i;
          break;
        }
      }

      this.snake.unshift({ x: nx, y: ny });
      if (ateIdx >= 0) {
        this.apples.splice(ateIdx, 1);
        this.score += 10;
        this.growBy += this.mode === 'cheese' ? 2 : 1;
        this.spawnApple();
      }
      if (this.growBy > 0) {
        this.growBy--;
      } else {
        this.snake.pop();
      }
      this.updateStats();
    }

    die() {
      this.dead = true;
      const key = 'snake:' + this.mode;
      this.api.submitScore(key, this.score);
      this.api.showOverlay({
        title: 'Game over',
        subtitle:
          `Score ${this.score.toLocaleString()} · Length ${this.snake.length}. Press R to replay, Esc for menu.`,
        primaryLabel: 'Replay',
        secondaryLabel: 'Back to menu',
        onPrimary: () => this.restart(),
      });
    }

    togglePause() {
      if (this.dead) return;
      this.paused = !this.paused;
      if (this.paused) {
        this.api.showOverlay({
          title: 'Paused',
          subtitle: 'Press Space or click Resume.',
          primaryLabel: 'Resume',
          secondaryLabel: 'Back to menu',
          onPrimary: () => {
            this.paused = false;
            this.last = performance.now();
          },
        });
      } else {
        this.api.hideOverlay();
        this.last = performance.now();
      }
    }

    restart() {
      this.reset();
    }

    onKey(e) {
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        this.togglePause();
        e.preventDefault();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        this.restart();
        e.preventDefault();
        return;
      }
      const d = KEY_DIR[e.key];
      if (d) {
        this.queueDir(d);
        e.preventDefault();
      }
    }

    buildSettings(container) {
      const modeField = document.createElement('div');
      modeField.className = 'field';
      modeField.innerHTML = `<label>Mode</label>`;
      const modeSel = document.createElement('select');
      ['classic', 'wall', 'portal', 'borderless', 'cheese'].forEach((m) => {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = MODE_NAMES[m] + ' — ' + MODE_HINTS[m];
        modeSel.appendChild(o);
      });
      modeSel.value = this.mode === 'daily' ? 'classic' : this.mode;
      modeSel.disabled = this.mode === 'daily';
      modeSel.addEventListener('change', () => {
        this.mode = modeSel.value;
        this.api.saveSettings('snake', { mode: this.mode, speed: this.speed });
        this.reset();
      });
      modeField.appendChild(modeSel);
      container.appendChild(modeField);

      const speedField = document.createElement('div');
      speedField.className = 'field';
      speedField.innerHTML = `<label>Speed</label>`;
      const speedSel = document.createElement('select');
      ['slow', 'normal', 'fast', 'turbo'].forEach((s) => {
        const o = document.createElement('option');
        o.value = s;
        o.textContent = s[0].toUpperCase() + s.slice(1);
        speedSel.appendChild(o);
      });
      speedSel.value = this.speed;
      speedSel.addEventListener('change', () => {
        this.speed = speedSel.value;
        this.api.saveSettings('snake', { mode: this.mode, speed: this.speed });
      });
      speedField.appendChild(speedSel);
      container.appendChild(speedField);
    }

    loop(t) {
      if (!this.rafId && this.rafId !== 0) return;
      const tick = SPEEDS[this.speed] || 110;
      if (!this.last) this.last = t;
      const dt = t - this.last;
      this.last = t;
      if (!this.paused && !this.dead) {
        this.acc += dt;
        while (this.acc >= tick) {
          this.acc -= tick;
          this.step();
          if (this.dead) break;
        }
      } else {
        this.acc = 0;
      }
      this.render();
      this.rafId = requestAnimationFrame(this.loop);
    }

    render() {
      const ctx = this.ctx;
      const cs = getComputedStyle(document.documentElement);
      const bg = cs.getPropertyValue('--bg').trim();
      const fg = cs.getPropertyValue('--fg').trim();
      const line = cs.getPropertyValue('--line').trim();
      const mute = cs.getPropertyValue('--fg-mute').trim();

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Grid
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, this.canvas.height);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(this.canvas.width, y * CELL + 0.5);
        ctx.stroke();
      }

      // Walls
      ctx.fillStyle = fg;
      for (const w of this.walls) {
        ctx.beginPath();
        ctx.arc(w.x * CELL + CELL / 2, w.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      // Portals
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2;
      for (const p of this.portals) {
        ctx.beginPath();
        ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Apples
      for (const a of this.apples) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(a.x * CELL + CELL / 2, a.y * CELL + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(a.x * CELL + CELL / 2, a.y * CELL + CELL / 2, CELL * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snake
      for (let i = 0; i < this.snake.length; i++) {
        const s = this.snake[i];
        ctx.fillStyle = i === 0 ? fg : fg;
        ctx.globalAlpha = i === 0 ? 1 : 0.85 - Math.min(0.4, i * 0.01);
        ctx.beginPath();
        ctx.arc(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, CELL * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
    }
  }
})();
