/* ============ 益智合集：2048 / 消星星 / 扫雷 / 迷宫寻宝 / 黑白棋 ============ */
(function () {
  const U = window.GameUtil;

  /* ---------- 2048 ---------- */
  const C2048 = { 2: '#8f93c8', 4: '#7c8ae0', 8: '#5aa8ff', 16: '#00c0e0', 32: '#30e0a0', 64: '#7ae058', 128: '#ffd60a', 256: '#ff9f40', 512: '#ff5e5e', 1024: '#ff2d78', 2048: '#b455ff' };
  window.registerGame({
    id: 'g2048',
    name: '2048',
    en: '2048',
    desc: '滑动合并 · 冲击 2048',
    color: '#ffd60a',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.15, y + s * 0.15, s * 1.2, s * 1.2, '#ffd60a');
      g.block(x + s * 1.55, y + s * 0.15, s * 1.2, s * 1.2, '#ff5e5e');
      g.block(x + s * 0.15, y + s * 1.55, s * 1.2, s * 1.2, '#00c0e0');
      g.text('+', x + s * 2.15, y + s * 1.8, '#30ff8e', 2, { center: true });
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        grid: Array.from({ length: 4 }, () => Array(4).fill(0)), moved: false,
      };
      addTile(s); addTile(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      const dirs = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
      for (const k of Object.keys(dirs)) {
        if (!Input.took(k)) continue;
        if (slide(s, dirs[k])) {
          addTile(s);
          Sound.sfx.move();
          if (s.reached2048 && !s._toast2048) {
            s._toast2048 = true;
            g.toast('2048! 传奇达成', 150, 260, '#b455ff', 3);
            g.flash('#b455ff33', 0.6);
            Sound.sfx.win();
          }
          if (checkEnd(s)) { s.over = true; Sound.sfx.over(); }
        }
      }
      // 触屏滑动
      if (Input.pointer && Input.pointer.inside) {
        s.swx = s.swx === undefined ? Input.pointer.x : s.swx;
        s.swy = s.swy === undefined ? Input.pointer.y : s.swy;
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'MAX', maxTile(s));
      const C = 62, bx = (300 - 4 * C - 30) / 2, by = 110;
      g.rect(bx - 6, by - 6, 4 * C + 30, 4 * C + 30, '#1a1440');
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          const v = s.grid[r][c];
          const x = bx + c * (C + 6), y = by + r * (C + 6);
          if (v) {
            const col = C2048[v] || '#ffffff';
            g.block(x, y, C, C, col);
            g.text(String(v), x + C / 2, y + C / 2 - (v > 999 ? 9 : v > 99 ? 7 : 5), v >= 128 ? '#3a2400' : '#0b0a1e', v > 999 ? 2 : 3, { center: true });
          } else {
            g.rect(x, y, C, C, 'rgba(45,226,255,0.05)');
          }
        }
      g.text('方向键滑动合并', 150, 492, '#5d628f', 1, { center: true });
    },
  });
  function addTile(s) {
    const free = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!s.grid[r][c]) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = free[U.ri(free.length)];
    s.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
  function slide(s, [dr, dc]) {
    let moved = false;
    const get = (i, j) => s.grid[i][j];
    for (let line = 0; line < 4; line++) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const r = dr === 1 ? 3 - k : dc === 1 ? line : dr === -1 ? line : k;
        const c = dc === 1 ? 3 - k : dc === -1 ? line : dr === 1 ? line : k;
        // 统一：处理顺序为从移动方向的反侧开始
        let rr, cc;
        if (dr === -1) { rr = k; cc = line; }
        else if (dr === 1) { rr = 3 - k; cc = line; }
        else if (dc === -1) { rr = line; cc = k; }
        else { rr = line; cc = 3 - k; }
        cells.push([rr, cc, get(rr, cc)]);
      }
      const vals = cells.map((x) => x[2]).filter((v) => v);
      const merged = [];
      for (let i = 0; i < vals.length; i++) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
          merged.push(vals[i] * 2);
          s.score += vals[i] * 2;
          if (vals[i] * 2 === 2048 && !s.won) { s.won = true; s.reached2048 = true; }
          i++;
        } else merged.push(vals[i]);
      }
      while (merged.length < 4) merged.push(0);
      for (let k = 0; k < 4; k++) {
        const [rr, cc] = cells[k];
        if (s.grid[rr][cc] !== merged[k]) moved = true;
        s.grid[rr][cc] = merged[k];
      }
    }
    return moved;
  }
  function checkEnd(s) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (!s.grid[r][c]) return false;
      if (c < 3 && s.grid[r][c] === s.grid[r][c + 1]) return false;
      if (r < 3 && s.grid[r][c] === s.grid[r + 1][c]) return false;
    }
    return true;
  }
  function maxTile(s) {
    let m = 0;
    for (const row of s.grid) for (const v of row) m = Math.max(m, v);
    return m;
  }

  /* ---------- 消星星 SAMEGAME ---------- */
  const SG_COLORS = ['#ff4d5e', '#ffd60a', '#30ff8e', '#3f8cff'];
  window.registerGame({
    id: 'samegame',
    name: '消星星',
    en: 'SAMEGAME',
    desc: '点同色群消除 · 清屏大奖',
    color: '#ff7ab8',
    music: 'chill',
    icon(g, x, y, s, t) {
      for (let i = 0; i < 4; i++) {
        const cx = x + (i % 2) * s * 1.3, cy = y + Math.floor(i / 2) * s * 1.3;
        g.block(cx + Math.sin(t * 3 + i) * 1.2, cy, s * 1.1, s * 1.1, SG_COLORS[i]);
      }
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        cols: 10, rows: 8, cell: 26, bx: (300 - 10 * 26 - 18) / 2, by: 88,
        grid: [], cur: { x: 0, y: 0 }, time: 0, over2: false,
      };
      do { s.grid = Array.from({ length: s.rows }, () => Array.from({ length: s.cols }, () => U.ri(4))); } while (!hasMove(s));
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      if (Input.took('left')) { s.cur.x = (s.cur.x + s.cols - 1) % s.cols; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur.x = (s.cur.x + 1) % s.cols; Sound.sfx.menu(); }
      if (Input.took('up')) { s.cur.y = (s.cur.y + s.rows - 1) % s.rows; Sound.sfx.menu(); }
      if (Input.took('down')) { s.cur.y = (s.cur.y + 1) % s.rows; Sound.sfx.menu(); }
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        const c = Math.floor((Input.pointer.x - s.bx) / s.cell), r = Math.floor((Input.pointer.y - s.by) / s.cell);
        if (c >= 0 && c < s.cols && r >= 0 && r < s.rows) s.cur = { x: c, y: r };
      }
      if (Input.took('a') || Input.took('drop')) {
        const group = floodGroup(s, s.cur.x, s.cur.y);
        if (group.length >= 2) {
          const n = group.length;
          const pts = n * n * 2;
          s.score += pts;
          for (const [x, y] of group) {
            g.burst(s.bx + x * s.cell + s.cell / 2, s.by + y * s.cell + s.cell / 2, s.grid[y][x] >= 0 ? SG_COLORS[s.grid[y][x]] : '#fff', 3, 70);
            s.grid[y][x] = -1;
          }
          collapse(s);
          Sound.sfx.clear();
          if (n >= 6) g.toast(n + ' 连消 +' + pts, 150, 300, '#ffd60a', 2);
          if (!hasMove(s)) {
            const left = s.grid.flat().filter((v) => v >= 0).length;
            if (left === 0) { s.score += 1000; g.toast('FULL CLEAR +1000', 150, 240, '#ffd60a', 2); }
            s.over = true;
            s.won = left === 0 || s.score > 2000;
            Sound.sfx.win();
          }
        } else Sound.sfx.hit();
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LEFT', s.grid.flat().filter((v) => v >= 0).length);
      for (let y = 0; y < s.rows; y++)
        for (let x = 0; x < s.cols; x++) {
          const v = s.grid[y][x];
          if (v < 0) continue;
          const px = s.bx + x * s.cell + 1, py = s.by + y * s.cell + 1;
          g.block(px, py, s.cell - 2, s.cell - 2, SG_COLORS[v]);
          g.rect(px + 3, py + 3, s.cell - 8, 3, '#ffffff55');
        }
      // 高亮当前群
      const grp = floodGroup(s, s.cur.x, s.cur.y);
      if (grp.length >= 2) {
        for (const [x, y] of grp) g.frame(s.bx + x * s.cell, s.by + y * s.cell, s.cell, s.cell, '#ffffff', 1);
        g.text(String(grp.length), 150, 492, '#ffd60a', 1, { center: true });
      }
      // 光标
      g.frame(s.bx + s.cur.x * s.cell - 1, s.by + s.cur.y * s.cell - 1, s.cell + 2, s.cell + 2, '#ffffff', 2);
    },
  });
  function floodGroup(s, x, y) {
    const v = s.grid[y][x];
    if (v < 0) return [];
    const seen = new Set([x + ',' + y]);
    const out = [[x, y]];
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= s.cols || ny < 0 || ny >= s.rows) continue;
        const k = nx + ',' + ny;
        if (seen.has(k) || s.grid[ny][nx] !== v) continue;
        seen.add(k); out.push([nx, ny]); stack.push([nx, ny]);
      }
    }
    return out;
  }
  function collapse(s) {
    for (let c = 0; c < s.cols; c++) {
      const col = [];
      for (let y = s.rows - 1; y >= 0; y--) if (s.grid[y][c] >= 0) col.push(s.grid[y][c]);
      for (let y = s.rows - 1, i = 0; y >= 0; y--, i++) s.grid[y][c] = i < col.length ? col[i] : -1;
    }
    for (let c = s.cols - 1; c >= 0; c--) {
      if (s.grid.every((row) => row[c] < 0) && c > 0) {
        for (let y = 0; y < s.rows; y++) {
          s.grid[y].splice(c, 1);
          s.grid[y].unshift(-1);
        }
      }
    }
  }
  function hasMove(s) {
    for (let y = 0; y < s.rows; y++)
      for (let x = 0; x < s.cols; x++) {
        const v = s.grid[y][x];
        if (v < 0) continue;
        if (x + 1 < s.cols && s.grid[y][x + 1] === v) return true;
        if (y + 1 < s.rows && s.grid[y + 1][x] === v) return true;
      }
    return false;
  }

  /* ---------- 扫雷 MINES ---------- */
  window.registerGame({
    id: 'mines',
    name: '扫雷',
    en: 'MINES',
    desc: 'A 翻开 B 插旗 · 首点安全',
    color: '#8f93c8',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.3, y + s * 0.3, s * 1.0, s * 1.0, '#262a52');
      g.block(x + s * 0.45, y + s * 0.45, s * 0.7, s * 0.7, '#1a1a2e');
      g.rect(x + s * 0.75, y + s * 0.55, 3, 3, '#ff4d5e');
      g.block(x + s * 1.6, y + s * 1.5, s, s, '#ffd60a');
      g.text('1', x + s * 1.85, y + s * 1.7, '#0b0a1e', 2);
      g.block(x + s * 0.3, y + s * 1.5, s, s, '#30ff8e');
      g.text('2', x + s * 0.55, y + s * 1.7, '#0b0a1e', 2);
    },
    start(env) {
      const W = 9, H = 9;
      return {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        W, H, mines: 10, cell: 28, bx: (300 - 9 * 28 - 8) / 2, by: 92,
        grid: null, mine: null, flag: null, cur: { x: 4, y: 4 },
        placed: false, time: 0, flags: 0, dead: false,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      if (Input.took('left')) { s.cur.x = (s.cur.x + s.W - 1) % s.W; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur.x = (s.cur.x + 1) % s.W; Sound.sfx.menu(); }
      if (Input.took('up')) { s.cur.y = (s.cur.y + s.H - 1) % s.H; Sound.sfx.menu(); }
      if (Input.took('down')) { s.cur.y = (s.cur.y + 1) % s.H; Sound.sfx.menu(); }
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        const c = Math.floor((Input.pointer.x - s.bx) / s.cell), r = Math.floor((Input.pointer.y - s.by) / s.cell);
        if (c >= 0 && c < s.W && r >= 0 && r < s.H) s.cur = { x: c, y: r };
      }
      if ((Input.took('a') || Input.took('drop')) && !s.flagSet(s.cur.x, s.cur.y)) reveal(s, s.cur.x, s.cur.y, g);
      if (Input.took('b') && !revealedAt(s, s.cur.x, s.cur.y)) {
        ensureModel(s); // 首次插旗前雷区模型尚未创建，s.flag 为 null
        const k = s.cur.x + ',' + s.cur.y;
        if (s.flag.get(k)) { s.flag.delete(k); s.flags--; } // 取消旗用 delete：has() 会拦截 reveal，残留 key 会导致该格永远无法翻开
        else { s.flag.set(k, true); s.flags++; }
        Sound.sfx.flip();
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'MINE', s.mines - s.flags);
      for (let y = 0; y < s.H; y++)
        for (let x = 0; x < s.W; x++) {
          const px = s.bx + x * s.cell + 1, py = s.by + y * s.cell + 1;
          const open = revealedAt(s, x, y);
          const flagged = s.flagSet(x, y);
          if (open) {
            const v = s.grid[y][x];
            g.rect(px, py, s.cell - 2, s.cell - 2, '#12102b');
            if (v < 0) {
              g.block(px + 4, py + 4, s.cell - 8, s.cell - 8, '#ff4d5e');
            } else if (v > 0) {
              const cols = ['', '#7cf7ff', '#30ff8e', '#ffd60a', '#ff9f40', '#ff4d5e', '#b455ff', '#ffffff', '#8f93c8'];
              g.text(String(v), px + s.cell / 2 - 1, py + s.cell / 2 - 4, cols[v], 2, { center: true });
            }
          } else {
            g.block(px, py, s.cell - 2, s.cell - 2, '#3a3a6a');
            g.rect(px + 2, py + 2, s.cell - 5, 3, '#5d5d9f');
            if (flagged) g.text('♥', px + s.cell / 2 - 1, py + s.cell / 2 - 6, '#ff4d5e', 2, { center: true });
          }
        }
      g.frame(s.bx + s.cur.x * s.cell - 1, s.by + s.cur.y * s.cell - 1, s.cell + 2, s.cell + 2, '#ffd60a', 2);
      g.text('A 翻开 · B 插旗', 150, 492, '#5d628f', 1, { center: true });
    },
  });
  function revealedAt(s, x, y) { return s.grid && s.grid[y][x] !== undefined && s.grid[y][x] !== null && s.openSet && s.openSet.has(x + ',' + y); }
  function ensureModel(s) {
    if (!s.openSet) {
      s.openSet = new Set();
      s.mineSet = new Set();
      s.flag = new Map();
      s.grid = Array.from({ length: s.H }, () => Array(s.W).fill(0));
    }
  }
  // 揭开（含洪泛）
  function reveal(s, x, y, g) {
    ensureModel(s);
    const k = x + ',' + y;
    if (s.openSet.has(k) || s.flag.has(k)) return;
    if (!s.placed) {
      // 首点安全：雷避开首点及邻域
      let placedMines = 0;
      while (placedMines < s.mines) {
        const mx = U.ri(s.W), my = U.ri(s.H);
        const mk = mx + ',' + my;
        if (s.mineSet.has(mk)) continue;
        if (Math.abs(mx - x) <= 1 && Math.abs(my - y) <= 1) continue;
        s.mineSet.add(mk); placedMines++;
      }
      for (let yy = 0; yy < s.H; yy++)
        for (let xx = 0; xx < s.W; xx++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              if (s.mineSet.has((xx + dx) + ',' + (yy + dy))) n++;
            }
          s.grid[yy][xx] = n;
        }
      s.placed = true;
    }
    if (s.mineSet.has(k)) {
      s.openSet.add(k);
      s.grid[y][x] = -1;
      s.over = true;
      Sound.sfx.boom();
      g.shake(6); g.flash('#ff3b3055', 0.5);
      return;
    }
    // 洪泛
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const ck = cx + ',' + cy;
      if (s.openSet.has(ck) || s.flag.has(ck)) continue;
      s.openSet.add(ck);
      if (s.grid[cy][cx] === 0) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= s.W || ny < 0 || ny >= s.H) continue;
            if (!s.openSet.has(nx + ',' + ny) && !s.mineSet.has(nx + ',' + ny)) stack.push([nx, ny]);
          }
      }
    }
    s.score += 5;
    Sound.sfx.flip();
    // 胜利判定
    const total = s.W * s.H;
    if (s.openSet.size >= total - s.mines) {
      s.over = true; s.won = true;
      s.score += Math.max(0, 1000 - Math.floor(s.time) * 5);
      Sound.sfx.win();
    }
  }
  // 为 mines def 包装 start，注入 flagSet 助手
  (function patchMines() {
    const def = window.__GAMES.find((d) => d.id === 'mines');
    if (!def) return;
    const origStart = def.start;
    def.start = function (env) {
      const s = origStart(env);
      s.flagSet = (x, y) => !!(s.flag && s.flag.get(x + ',' + y));
      return s;
    };
  })();
})();
