(function () {
  'use strict';

  const R = (window.CursorArcade = window.CursorArcade || {});
  R.games = R.games || {};

  const SIZES = { '4': 4, '5': 5, '6': 6 };

  R.games.twenty48 = {
    create(c) {
      return new Game2048(c);
    },
  };

  class Game2048 {
    constructor({ host, api, meta }) {
      this.api = api;
      this.meta = meta;
      const saved = api.getSettings('twenty48') || {};
      this.size = saved.size && SIZES[String(saved.size)] ? saved.size : 4;

      this.wrap = document.createElement('div');
      this.wrap.style.display = 'flex';
      this.wrap.style.alignItems = 'center';
      this.wrap.style.justifyContent = 'center';
      this.wrap.style.width = '100%';
      this.wrap.style.height = '100%';

      this.board = document.createElement('div');
      this.board.className = 'twenty48-board';
      this.wrap.appendChild(this.board);
      host.appendChild(this.wrap);

      this._resize = this._resize.bind(this);
      window.addEventListener('resize', this._resize);

      api.setTopbarControls({ restart: true });
      this.reset();
    }

    reset() {
      this.grid = Array.from({ length: this.size }, () =>
        Array.from({ length: this.size }, () => null),
      );
      this.nextId = 1;
      this.score = 0;
      this.won = false;
      this.continuedAfterWin = false;
      this.addRandom();
      this.addRandom();
      this.render(true);
      this.updateStats();
    }

    updateStats() {
      this.api.setStats({
        score: this.score.toLocaleString(),
        best: this.api.getHighScore('twenty48').toLocaleString(),
        size: this.size + '×' + this.size,
      });
    }

    addRandom() {
      const empties = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) empties.push([r, c]);
        }
      }
      if (!empties.length) return false;
      const [r, c] = empties[Math.floor(Math.random() * empties.length)];
      this.grid[r][c] = {
        id: this.nextId++,
        value: Math.random() < 0.9 ? 2 : 4,
        r,
        c,
        isNew: true,
        merged: false,
      };
      return true;
    }

    // direction: {x, y}. Move all tiles in that direction, merge pairs.
    // Returns true if anything moved or merged.
    move(dx, dy) {
      // Clear per-move flags
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const t = this.grid[r][c];
          if (t) {
            t.isNew = false;
            t.merged = false;
          }
        }
      }

      // Iterate cells in order opposite to movement dir
      const order = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) order.push([r, c]);
      }
      if (dx > 0) order.sort((a, b) => b[1] - a[1]);
      else if (dx < 0) order.sort((a, b) => a[1] - b[1]);
      else if (dy > 0) order.sort((a, b) => b[0] - a[0]);
      else if (dy < 0) order.sort((a, b) => a[0] - b[0]);

      let moved = false;
      let gainedScore = 0;
      let madeMerge = false;

      for (const [r, c] of order) {
        const tile = this.grid[r][c];
        if (!tile) continue;
        let nr = r;
        let nc = c;
        while (true) {
          const tr = nr + dy;
          const tc = nc + dx;
          if (tr < 0 || tr >= this.size || tc < 0 || tc >= this.size) break;
          const target = this.grid[tr][tc];
          if (!target) {
            this.grid[tr][tc] = tile;
            this.grid[nr][nc] = null;
            tile.r = tr;
            tile.c = tc;
            nr = tr;
            nc = tc;
            moved = true;
          } else if (target.value === tile.value && !target.merged && !tile.merged) {
            target.value *= 2;
            target.merged = true;
            this.grid[nr][nc] = null;
            gainedScore += target.value;
            moved = true;
            madeMerge = true;
            if (target.value === 2048 && !this.won) {
              this.won = true;
              queueMicrotask(() => this.handleWin());
            }
            break;
          } else {
            break;
          }
        }
      }

      if (moved) {
        this.score += gainedScore;
        this.addRandom();
        this.render(false);
        this.updateStats();
        if (this.isGameOver()) this.handleLoss();
      }
      return moved;
    }

    handleWin() {
      if (this.continuedAfterWin) return;
      this.api.submitScore('twenty48', this.score);
      this.api.showOverlay({
        title: 'You reached 2048.',
        subtitle: 'Keep playing for a higher score, or restart.',
        primaryLabel: 'Keep playing',
        secondaryLabel: 'Back to menu',
        onPrimary: () => {
          this.continuedAfterWin = true;
        },
      });
    }

    handleLoss() {
      this.api.submitScore('twenty48', this.score);
      this.api.showOverlay({
        title: 'No moves left.',
        subtitle: `Score ${this.score.toLocaleString()}. Press R to retry.`,
        primaryLabel: 'Replay',
        secondaryLabel: 'Back to menu',
        onPrimary: () => this.reset(),
      });
    }

    isGameOver() {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) return false;
          const v = this.grid[r][c].value;
          if (r + 1 < this.size && this.grid[r + 1][c] && this.grid[r + 1][c].value === v) return false;
          if (c + 1 < this.size && this.grid[r][c + 1] && this.grid[r][c + 1].value === v) return false;
        }
      }
      return true;
    }

    _boardMetrics() {
      const size = this.size;
      const host = this.wrap;
      const maxW = Math.min(host.clientWidth - 40, 640);
      const maxH = Math.min(host.clientHeight - 40, 640);
      const boardSide = Math.max(240, Math.min(maxW, maxH));
      const gap = 10;
      const padding = 10;
      const cellSide = Math.floor((boardSide - padding * 2 - gap * (size - 1)) / size);
      return { cellSide, gap, padding };
    }

    _resize() {
      this.render(true);
    }

    render(fresh) {
      const { cellSide, gap, padding } = this._boardMetrics();
      const size = this.size;
      const boardSide = size * cellSide + (size - 1) * gap + padding * 2;

      this.board.style.width = boardSide + 'px';
      this.board.style.height = boardSide + 'px';
      this.board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      this.board.style.gridTemplateRows = `repeat(${size}, 1fr)`;
      this.board.style.padding = padding + 'px';
      this.board.style.gap = gap + 'px';

      if (fresh) {
        this.board.innerHTML = '';
        // background cells
        for (let i = 0; i < size * size; i++) {
          const cell = document.createElement('div');
          cell.className = 'twenty48-cell';
          this.board.appendChild(cell);
        }
        this.tileMap = new Map();
      }

      const desired = new Map();
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const t = this.grid[r][c];
          if (t) desired.set(t.id, t);
        }
      }

      // Remove stale
      for (const [id, el] of Array.from(this.tileMap.entries())) {
        if (!desired.has(id)) {
          el.remove();
          this.tileMap.delete(id);
        }
      }

      // Create/update tiles
      for (const [id, t] of desired.entries()) {
        let el = this.tileMap.get(id);
        const tx = t.c * (cellSide + gap) + padding;
        const ty = t.r * (cellSide + gap) + padding;
        const isFresh = !el;
        if (isFresh) {
          el = document.createElement('div');
          el.className = 'twenty48-tile';
          // Seed position before insertion so the tile never flashes at (0,0).
          el.style.setProperty('--tx', tx + 'px');
          el.style.setProperty('--ty', ty + 'px');
          this.board.appendChild(el);
          this.tileMap.set(id, el);
        } else {
          el.style.setProperty('--tx', tx + 'px');
          el.style.setProperty('--ty', ty + 'px');
        }
        el.style.width = cellSide + 'px';
        el.style.height = cellSide + 'px';
        el.style.fontSize = Math.max(14, Math.floor(cellSide / 2.8)) + 'px';
        el.dataset.v = String(t.value);
        el.textContent = String(t.value);
        // Restart the animation cleanly on each render so CSS sees the class transition.
        el.classList.remove('new', 'merged');
        if (t.isNew) {
          void el.offsetWidth;
          el.classList.add('new');
        }
        if (t.merged) {
          void el.offsetWidth;
          el.classList.add('merged');
        }
      }
    }

    restart() {
      this.reset();
    }

    onKey(e) {
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dy = -1;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dy = 1;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dx = -1;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dx = 1;
          break;
        case 'r':
        case 'R':
          this.reset();
          e.preventDefault();
          return;
      }
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        this.move(dx, dy);
      }
    }

    buildSettings(container) {
      const field = document.createElement('div');
      field.className = 'field';
      field.innerHTML = `<label>Board size</label>`;
      const sel = document.createElement('select');
      Object.keys(SIZES).forEach((k) => {
        const o = document.createElement('option');
        o.value = k;
        o.textContent = `${k} × ${k}`;
        sel.appendChild(o);
      });
      sel.value = String(this.size);
      sel.addEventListener('change', () => {
        this.size = SIZES[sel.value];
        this.api.saveSettings('twenty48', { size: this.size });
        this.reset();
      });
      field.appendChild(sel);
      container.appendChild(field);
    }

    destroy() {
      window.removeEventListener('resize', this._resize);
      if (this.wrap && this.wrap.parentNode) this.wrap.parentNode.removeChild(this.wrap);
    }
  }
})();
