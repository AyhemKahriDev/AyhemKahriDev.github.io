/* ============ 俄罗斯方块 A（经典）/ B（障碍挑战）============ */
(function () {
  if (!window.__GAMES) window.__GAMES = [];
  if (!window.GameUtil) {
    window.GameUtil = {
      ri: (n) => Math.floor(Math.random() * n),
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
      shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
  }
  const U = window.GameUtil;

  const SHAPES = {
    I: { m: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], c: '#00e5ff' },
    O: { m: [[1,1],[1,1]], c: '#ffd60a' },
    T: { m: [[0,1,0],[1,1,1],[0,0,0]], c: '#b455ff' },
    S: { m: [[0,1,1],[1,1,0],[0,0,0]], c: '#30ff8e' },
    Z: { m: [[1,1,0],[0,1,1],[0,0,0]], c: '#ff4d5e' },
    J: { m: [[1,0,0],[1,1,1],[0,0,0]], c: '#3f8cff' },
    L: { m: [[0,0,1],[1,1,1],[0,0,0]], c: '#ff9f40' },
  };
  const ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  // 五格骨牌（Pentix 方块豪华用），统一嵌入方阵便于旋转
  const PENTA_ORDER = ['I5', 'L5', 'P5', 'U5', 'T5', 'W5', 'X5', 'S5', 'Z5'];
  SHAPES['I5'] = { m: [[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0],[0,0,0,0,0]], c: '#00ffd0' };
  SHAPES['L5'] = { m: [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]], c: '#ff9f40' };
  SHAPES['P5'] = { m: [[1,1,0],[1,1,0],[1,0,0]], c: '#ffd60a' };
  SHAPES['U5'] = { m: [[1,0,1],[1,1,1],[0,0,0]], c: '#b455ff' };
  SHAPES['T5'] = { m: [[1,1,1],[0,1,0],[0,1,0]], c: '#3f8cff' };
  SHAPES['W5'] = { m: [[1,0,0],[1,1,0],[0,1,1]], c: '#30ff8e' };
  SHAPES['X5'] = { m: [[0,1,0],[1,1,1],[0,1,0]], c: '#ff4d5e' };
  SHAPES['S5'] = { m: [[0,1,1],[1,1,0],[1,0,0]], c: '#7cf7ff' };
  SHAPES['Z5'] = { m: [[1,1,0],[0,1,1],[0,0,1]], c: '#ff7ab8' };
  const rotCache = new Map();
  function rotated(key, r) {
    const id = key + r;
    if (rotCache.has(id)) return rotCache.get(id);
    let m = SHAPES[key].m;
    for (let i = 0; i < r; i++) {
      const n = m.length, nm = m.map((row) => row.slice());
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) nm[x][n - 1 - y] = m[y][x];
      m = nm;
    }
    rotCache.set(id, m);
    return m;
  }

  const COLS = 10, ROWS = 20, CELL = 21, FX = 14, FY = 46;

  function makeTetrisDef(variant, opts) {
    const isB = variant === 'b';
    opts = opts || {};
    const order = opts.order || ORDER;
    const defId = opts.id || (isB ? 'tetrisB' : 'tetris');
    return {
      id: defId,
      name: opts.name || (isB ? '方块挑战B' : '方块经典'),
      en: opts.en || (isB ? 'BLOCK B' : 'BLOCK A'),
      desc: opts.desc || (isB ? '开局带障碍 · 消25行获胜' : '经典玩法 · 越消越快'),
      color: opts.color || (isB ? '#b455ff' : '#00e5ff'),
      music: 'tetris',
      icon: opts.icon || function (g, x, y, s, t) {
        const b = [[0,1],[1,1],[2,2],[3,2],[1,3],[2,3],[2,0],[3,0]];
        b.forEach(([cx, cy], i) => g.block(x + cx * s * 0.8, y + cy * s * 0.8 + Math.sin(t * 3 + i) * 1.5, s * 0.7, SHAPES[order[i % order.length]].c));
      },
      start(env) {
        const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        const s = {
          board, score: 0, lines: 0, level: 1, over: false,
          speed: env.speed, bag: [], next: null, piece: null,
          fallT: 0, clearing: null, clearT: 0, combo: 0,
          repL: 0, repR: 0, goal: isB ? 25 : 0, garbage: 0,
          hideNext: !!opts.hideNext, garbageRain: !!opts.garbageRain, rainCount: 0,
          timeLeft: opts.timeLimit || 0,
        };
        if (isB) {
          const rows = U.clamp(env.speed, 0, 6);
          for (let y = ROWS - rows; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
              if (U.ri(10) > 2) s.board[y][x] = '#5a6a8a';
        }
        s.next = draw7(s);
        spawn(s);
        return s;
      },
      update,
      draw,
    };

    function draw7(s) {
      if (!s.bag.length) s.bag = U.shuffle(order.slice());
      return s.bag.pop();
    }
    function spawn(s) {
      const key = s.next || draw7(s);
      s.next = draw7(s);
      const m0 = rotated(key, 0);
      s.piece = { key, m: m0, x: Math.floor((COLS - m0.length) / 2), y: -1, r: 0 };
      if (collide(s.board, s.piece.m, s.piece.x, s.piece.y)) {
        // 上移一格再试（贴顶出生）
        s.piece.y = -2;
        if (collide(s.board, s.piece.m, s.piece.x, s.piece.y)) s.over = true;
      }
    }
    function collide(board, m, px, py) {
      for (let y = 0; y < m.length; y++)
        for (let x = 0; x < m.length; x++) {
          if (!m[y][x]) continue;
          const bx = px + x, by = py + y;
          if (bx < 0 || bx >= COLS || by >= ROWS) return true;
          if (by >= 0 && board[by][bx]) return true;
        }
      return false;
    }
    function lockPiece(s, g) {
      const p = s.piece;
      let lockedAbove = false;
      for (let y = 0; y < p.m.length; y++)
        for (let x = 0; x < p.m.length; x++) {
          if (!p.m[y][x]) continue;
          const by = p.y + y, bx = p.x + x;
          if (by < 0) { lockedAbove = true; continue; } // 缓冲区内的格子不计入场地，但锁定在可视区上方即顶出判负
          s.board[by][bx] = SHAPES[p.key].c;
          g.burst(FX + bx * CELL + CELL / 2, FY + by * CELL + CELL / 2, SHAPES[p.key].c, 2, 40);
        }
      Sound.sfx.lock();
      if (window.Vibe) Vibe.tap(30);
      if (lockedAbove) { s.over = true; return; } // 顶出：方块堆到天花板，游戏结束
      const full = [];
      for (let y = 0; y < ROWS; y++) if (s.board[y].every((c) => c)) full.push(y);
      if (full.length) {
        s.clearing = full; s.clearT = 0.32;
        const pts = [0, 100, 300, 500, 800][full.length] * s.level * (isB ? 1.5 : 1);
        s.pendingPts = Math.round(pts);
        s.combo++;
        s.shakeMe = full.length >= 3;
        full.forEach((y) => { for (let x = 0; x < COLS; x++) g.burst(FX + x * CELL + CELL / 2, FY + y * CELL + CELL / 2, s.board[y][x], 3, 120); });
        g.flash('#ffffff', full.length >= 4 ? 0.7 : 0.3);
        if (window.Vibe) Vibe.event(full.length >= 4 ? [50, 30, 80] : [40]);
        if (full.length >= 4) { g.shake(5); Sound.sfx.tetris(); g.toast('TETRIS!', 124, 200, '#ffd60a', 3); }
        else if (full.length === 3) { Sound.sfx.clear(); g.toast('TRIPLE!', 124, 200, '#30ff8e', 2); }
        else if (full.length === 2) { Sound.sfx.clear(); g.toast('DOUBLE!', 124, 200, '#00e5ff', 2); }
        else { Sound.sfx.clear(); }
        if (s.combo >= 2) g.toast('COMBO x' + s.combo, 124, 230, '#ff7ab8', 2);
      } else {
        s.combo = 0;
        spawn(s);
      }
    }
    function finishClear(s) {
      const clearedN = s.clearing.length;
      s.clearing.sort((a, b) => a - b).forEach((y) => {
        s.board.splice(y, 1);
        s.board.unshift(Array(COLS).fill(null));
      });
      s.score += s.pendingPts || 0;
      s.lines += clearedN;
      s.pendingPts = 0;
      s.clearing = null;
      const lv = 1 + Math.floor(s.lines / 10);
      if (lv > s.level) { s.level = lv; Sound.sfx.levelup(); g_toast(s, 'LEVEL ' + lv); }
      if (s.goal && s.lines >= s.goal) { s.over = true; s.won = true; }
      if (s.garbageRain && !s.over) {
        s.rainCount += clearedN;
        while (s.rainCount >= 5 && !s.over) {
          s.rainCount -= 5;
          if (s.board[0].some((c) => c)) { s.over = true; break; }
          s.board.shift();
          const row = Array(COLS).fill('#4a5578');
          row[U.ri(COLS)] = null;
          s.board.push(row);
          g_toast(s, 'GARBAGE!');
          Sound.sfx.hit();
        }
      }
      if (!s.over) spawn(s);
    }
    function g_toast(s, txt) { /* 由 draw 期间补浮字 */ s.pendingToast = txt; }

    function move(s, g, dx) {
      const p = s.piece;
      if (!collide(s.board, p.m, p.x + dx, p.y)) {
        p.x += dx; Sound.sfx.move();
      }
    }
    function tryRotate(s, dir) {
      const p = s.piece, nr = (p.r + (dir > 0 ? 1 : 3)) % 4;
      const nm = rotated(p.key, nr);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!collide(s.board, nm, p.x + kick, p.y)) {
          p.m = nm; p.r = nr; p.x += kick;
          Sound.sfx.rotate();
          return;
        }
      }
    }
    function drop(s, g) {
      const p = s.piece;
      let d = 0;
      while (!collide(s.board, p.m, p.x, p.y + 1)) { p.y++; d++; }
      s.score += d * 2;
      lockPiece(s, g);
    }
    function interval(s) { return Math.max(50, 640 - s.speed * 42 - (s.level - 1) * 34); }

    function update(s, dt, g) {
      if (s.pendingToast) { g.toast(s.pendingToast, 124, 215, '#ffd60a', 2); s.pendingToast = null; }
      if (s.clearing) {
        s.clearT -= dt;
        if (s.clearT <= 0) finishClear(s);
        return;
      }
      if (s.over) return;
      if (s.timeLeft > 0) {
        s.timeLeft -= dt;
        if (s.timeLeft <= 0) { s.timeLeft = 0; s.over = true; s.won = true; return; }
      }
      const p = s.piece;
      // 左右移动（含 DAS 连发）
      const lHeld = Input.held.left, rHeld = Input.held.right;
      if (Input.took('left')) { move(s, g, -1); s.repL = 0.18; }
      if (Input.took('right')) { move(s, g, 1); s.repR = 0.18; }
      if (lHeld) { s.repL -= dt; if (s.repL <= 0) { move(s, g, -1); s.repL = 0.05; } }
      if (rHeld) { s.repR -= dt; if (s.repR <= 0) { move(s, g, 1); s.repR = 0.05; } }
      if (Input.took('a') || Input.took('up')) tryRotate(s, 1);
      if (Input.took('b')) tryRotate(s, -1);
      if (Input.took('drop')) { drop(s, g); return; }
      // 重力（注意：锁定后必须立即返回，新块不能继承旧块的重力计时，
      // 否则同一帧内会把刚出生的新块连锁锁定在顶部造成"秒判负"）
      if (s.sdT > 0) s.sdT -= dt; // 软降音效节流
      const iv = Input.held.down ? Math.min(45, interval(s)) : interval(s);
      s.fallT += dt * 1000;
      while (s.fallT >= iv) {
        s.fallT -= iv;
        if (!collide(s.board, p.m, p.x, p.y + 1)) {
          p.y++;
          if (Input.held.down) {
            s.score++;
            if (s.sdT <= 0) { Sound.sfx.softdrop(); s.sdT = 0.06; }
          }
        } else {
          lockPiece(s, g);
          return;
        }
      }
    }

    function draw(s, g) {
      g.clear('#0b0a1e');
      // 背景动态网格
      const off = (g.t * 12) % CELL;
      for (let y = -1; y < ROWS + 1; y++)
        for (let x = -1; x < COLS + 1; x++) {
          if (((x + 20 + Math.floor(g.t * 0.6)) + y) % 2) continue;
          g.rect(FX + x * CELL + off * 0, FY + y * CELL, CELL - 1, CELL - 1, 'rgba(45,226,255,0.03)');
        }
      // 场地边框
      g.frame(FX - 3, FY - 3, COLS * CELL + 6, ROWS * CELL + 6, '#2de2ff55', 2);
      g.rect(FX, FY, COLS * CELL, ROWS * CELL, 'rgba(6,5,25,0.75)');
      // 已锁定
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const c = s.board[y][x];
          if (c) g.block(FX + x * CELL + 1, FY + y * CELL + 1, CELL - 2, c);
        }
      // 幽灵 + 当前块
      if (s.piece && !s.over) {
        const p = s.piece;
        let gy = p.y;
        while (!collide(s.board, p.m, p.x, gy + 1)) gy++;
        for (let y = 0; y < p.m.length; y++)
          for (let x = 0; x < p.m.length; x++) {
            if (!p.m[y][x]) continue;
            if (gy + y >= 0) g.block(FX + (p.x + x) * CELL + 1, FY + (gy + y) * CELL + 1, CELL - 2, SHAPES[p.key].c, 0.16);
          }
        for (let y = 0; y < p.m.length; y++)
          for (let x = 0; x < p.m.length; x++) {
            if (!p.m[y][x]) continue;
            if (p.y + y >= 0) g.block(FX + (p.x + x) * CELL + 1, FY + (p.y + y) * CELL + 1, CELL - 2, SHAPES[p.key].c);
          }
      }
      // 消行闪白
      if (s.clearing) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(s.clearT * 26));
        for (const y of s.clearing) g.rect(FX, FY + y * CELL, COLS * CELL, CELL, `rgba(255,255,255,${a})`);
      }
      // 侧边信息栏
      const SX = 240;
      g.text('NEXT', SX, FY, '#7cf7ff', 1);
      g.frame(SX, FY + 8, 52, 44, '#2de2ff44', 1);
      if (s.hideNext) {
        g.text('?', SX + 26, FY + 26, '#3a3e6a', 2, { center: true });
      } else if (s.next) {
        const m = SHAPES[s.next].m, n = m.length;
        const cs = n >= 5 ? 8 : (n === 4 ? 9 : 12);
        let minX = 9, maxX = -1, minY = 9, maxY = -1;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++)
            if (m[y][x]) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        const w = (maxX - minX + 1) * cs, h = (maxY - minY + 1) * cs;
        const ox = SX + (52 - w) / 2 - minX * cs, oy = FY + 8 + (44 - h) / 2 - minY * cs;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
          if (m[y][x]) g.block(ox + x * cs, oy + y * cs, cs - 1, SHAPES[s.next].c);
      }
      g.text('SCORE', SX, FY + 62, '#9aa0ff', 1);
      g.text(String(s.score), SX, FY + 70, '#ffffff', 2, { glow: 5 });
      g.text('HI', SX, FY + 92, '#ffd60a', 1);
      g.text(String(env_hi(s)), SX, FY + 100, '#ffd60a', 1);
      g.text('LINES', SX, FY + 116, '#30ff8e', 1);
      g.text(String(s.lines), SX, FY + 124, '#30ff8e', 2, { glow: 4 });
      g.text('LEVEL', SX, FY + 146, '#ff7ab8', 1);
      g.text(String(s.level), SX, FY + 154, '#ff7ab8', 2, { glow: 4 });
      if (isB) {
        g.text('GOAL', SX, FY + 176, '#7cf7ff', 1);
        g.text(`${s.goal - s.lines}`, SX, FY + 184, '#7cf7ff', 2, { glow: 4 });
      }
      if (s.timeLeft > 0) {
        const tl = Math.ceil(s.timeLeft);
        const tc = tl <= 15 ? (Math.sin(g.t * 8) > 0 ? '#ff4d5e' : '#ffffff') : '#7cf7ff';
        g.text('TIME', SX, FY + 176, '#7cf7ff', 1);
        g.text(Math.floor(tl / 60) + ':' + String(tl % 60).padStart(2, '0'), SX, FY + 184, tc, 2, { glow: 4 });
      }
      if (s.garbageRain) {
        g.text('RAIN', SX, FY + 200, '#7c8aa8', 1);
        g.text(String(5 - s.rainCount), SX, FY + 208, '#7c8aa8', 2);
      }
      // combo 指示
      if (s.combo >= 2) g.text('COMBO x' + s.combo, 124, 34, '#ff7ab8', 1, { center: true, glow: 6 });
    }
    function env_hi(s) { return Math.max(envHi(defId), s.score); }
  }

  function envHi(id) {
    try { return parseInt(localStorage.getItem('bg_hi_' + id)) || 0; } catch (e) { return 0; }
  }

  window.registerGame = (def) => window.__GAMES.push(def);
  window.registerGame(makeTetrisDef('a'));
  window.registerGame(makeTetrisDef('b'));
  window.registerGame(makeTetrisDef('a', {
    id: 'tetrisG',
    name: '方块暴雨',
    en: 'GARBAGE',
    desc: '消5行引垃圾 · 层层抬升',
    color: '#7c8aa8',
    garbageRain: true,
  }));
  window.registerGame(makeTetrisDef('a', {
    id: 'tetrisS',
    name: '方块冲刺',
    en: 'SPRINT',
    desc: '限时 120 秒 · 极速刷分',
    color: '#30ff8e',
    timeLimit: 120,
  }));
  window.registerGame(makeTetrisDef('a', {
    id: 'tetrisX',
    name: '方块盲盒',
    en: 'BLIND',
    desc: '隐藏预览 · 考验布局',
    color: '#ffd60a',
    hideNext: true,
  }));
  window.registerGame(makeTetrisDef('p', {
    id: 'tetrisP',
    name: '方块豪华',
    en: 'PENTIX',
    desc: '五格骨牌 · 高阶烧脑',
    color: '#ff7ab8',
    order: PENTA_ORDER,
    icon(g, x, y, s, t) {
      // X5 + U5 迷你造型
      const xg = [[1,0],[0,1],[1,1],[2,1],[1,2]];
      xg.forEach(([cx, cy]) => g.block(x + cx * s * 0.75, y + cy * s * 0.75 + Math.sin(t * 3) * 1.5, s * 0.62, '#ff4d5e'));
      const ug = [[3,0],[5,0],[3,1],[4,1],[5,1]];
      ug.forEach(([cx, cy]) => g.block(x + cx * s * 0.75, y + cy * s * 0.75 - Math.sin(t * 3) * 1.5, s * 0.62, '#b455ff'));
    },
  }));
})();
