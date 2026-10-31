/* ============ 迷宫寻宝 + 黑白棋 ============ */
(function () {
  const U = window.GameUtil;

  /* ---------- 迷宫寻宝 MAZE ---------- */
  window.registerGame({
    id: 'maze',
    name: '迷宫寻宝',
    en: 'MAZE',
    desc: '找钥匙开门 · 限时逃出',
    color: '#ffd60a',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.frame(x + s * 0.2, y + s * 0.2, s * 2.6, s * 2.6, '#3a3e6a', 2);
      g.text('♥', x + s * 1.0, y + s * 0.5 + Math.sin(t * 4) * 1.5, '#ffd60a', 2);
      g.block(x + s * 1.9, y + s * 1.9, s * 0.7, s * 0.7, '#00e5ff');
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        W: 15, H: 11, time: 60, key: false, px: 1, py: 9, anim: 0,
      };
      genMaze(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time -= dt;
      s._keyToastT = Math.max(0, (s._keyToastT || 0) - dt);
      s.anim = Math.max(0, s.anim - dt * 5);
      if (s.time <= 0) {
        s.over = true;
        Sound.sfx.over();
        return;
      }
      const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      let moved = false;
      for (const k of Object.keys(dirs)) {
        if (!Input.took(k)) continue;
        const [dx, dy] = dirs[k];
        const nx = s.px + dx, ny = s.py + dy;
        if (!s.maze[ny][nx]) { s.px = nx; s.py = ny; moved = true; s.anim = 1; Sound.sfx.move(); }
      }
      if (!moved && Input.pointer && Input.took('a')) {
        // 触屏：朝点击方向走一格
        const dx = Input.pointer.x - (s.px * 20 + 10), dy = Input.pointer.y - (s.py * 20 + 46);
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          let d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
          const nx = s.px + d[0], ny = s.py + d[1];
          if (!s.maze[ny] || !s.maze[ny][nx]) { s.px = nx; s.py = ny; moved = true; s.anim = 1; Sound.sfx.move(); }
        }
      }
      if (moved) {
        if (!s.key && s.px === s.keyX && s.py === s.keyY) {
          s.key = true;
          s.score += 100;
          Sound.sfx.coin();
          g.toast('拿到钥匙!', 150, 120, '#ffd60a', 2);
        }
        if (s.px === s.exitX && s.py === s.exitY) {
          if (s.key) {
            s.score += 300 + Math.floor(s.time) * 5;
            s.level++;
            Sound.sfx.win();
            g.flash('#ffd60a33', 0.5);
            g.toast('逃脱! +' + (300 + Math.floor(s.time) * 5), 150, 120, '#30ff8e', 2);
            s.time = Math.max(30, 60 - s.level * 4);
            s.key = false;
            genMaze(s);
          } else if (!s._keyToastT || s._keyToastT <= 0) {
            s._keyToastT = 1.2;
            g.toast('需要钥匙!', 150, 120, '#ff4d5e', 2);
            Sound.sfx.hit();
          }
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'TIME', Math.ceil(s.time));
      const CS = 20, bx = (300 - s.W * CS) / 2, by = 46;
      for (let y = 0; y < s.H; y++)
        for (let x = 0; x < s.W; x++) {
          if (s.maze[y][x]) g.rect(bx + x * CS, by + y * CS, CS, CS, '#2a265a');
          else g.rect(bx + x * CS, by + y * CS, CS, CS, '#0e0c28');
        }
      // 钥匙
      if (!s.key) {
        const kx = bx + s.keyX * CS + CS / 2, ky = by + s.keyY * CS + CS / 2;
        g.block(kx - 4, ky - 2, 8, 5, '#ffd60a');
        g.frame(kx - 5, ky - 4, 4, 5, '#ffd60a', 1);
        g.rect(kx + 3, ky, 2, 4, '#ffd60a');
      }
      // 出口
      const ex = bx + s.exitX * CS, ey = by + s.exitY * CS;
      g.frame(ex + 2, ey + 2, CS - 4, CS - 4, s.key ? '#30ff8e' : '#ff4d5e', 2);
      g.text(s.key ? '↑' : '✕', ex + CS / 2, ey + CS / 2 - 3, s.key ? '#30ff8e' : '#ff4d5e', 1, { center: true });
      // 玩家
      const bob = Math.sin(g.t * 8) * 1.2;
      g.block(bx + s.px * CS + 4, by + s.py * CS + 4 + bob, CS - 8, CS - 8, '#00e5ff');
      g.rect(bx + s.px * CS + 7, by + s.py * CS + 7 + bob, 3, 3, '#0b0a1e');
      g.rect(bx + s.px * CS + 12, by + s.py * CS + 7 + bob, 3, 3, '#0b0a1e');
      if (s.time < 10 && Math.sin(g.t * 8) > 0) g.text('HURRY!', 150, 492, '#ff4d5e', 1, { center: true });
    },
  });

  function genMaze(s) {
    const W = s.W, H = s.H;
    const m = Array.from({ length: H }, () => Array(W).fill(1));
    // DFS 挖洞（奇数格）
    const stack = [[1, 1]];
    m[1][1] = 0;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const dirs = U.shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]);
      let carved = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && m[ny][nx] === 1) {
          m[y + dy / 2][x + dx / 2] = 0;
          m[ny][nx] = 0;
          stack.push([nx, ny]);
          carved = true;
          break;
        }
      }
      if (!carved) stack.pop();
    }
    // 打通一些环路，避免死路太多
    for (let i = 0; i < W * H * 0.06; i++) {
      const x = 1 + U.ri(W - 2), y = 1 + U.ri(H - 2);
      if (m[y][x] === 1) {
        const h = m[y][x - 1] === 0 && m[y][x + 1] === 0;
        const v = m[y - 1][x] === 0 && m[y + 1][x] === 0;
        if (h !== v) m[y][x] = 0;
      }
    }
    s.maze = m;
    s.px = 1; s.py = H - 2;
    s.exitX = W - 2; s.exitY = 1;
    // 钥匙放在离起点最远的空格
    let best = -1, bx = W - 2, by = H - 2;
    for (let y = 1; y < H - 1; y += 2)
      for (let x = 1; x < W - 1; x += 2) {
        if (m[y][x]) continue;
        const d = Math.abs(x - s.px) + Math.abs(y - s.py) + Math.abs(x - s.exitX);
        if (d > best) { best = d; bx = x; by = y; }
      }
    s.keyX = bx; s.keyY = by;
  }

  /* ---------- 黑白棋 REVERSI ---------- */
  window.registerGame({
    id: 'reversi',
    name: '黑白棋',
    en: 'REVERSI',
    desc: '6×6 执黑对战 AI',
    color: '#30ff8e',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.frame(x + s * 0.2, y + s * 0.2, s * 2.6, s * 2.6, '#3a3e6a', 2);
      g.block(x + s * 0.6, y + s * 0.6, s * 0.7, s * 0.7, '#ffffff');
      g.block(x + s * 1.6, y + s * 1.6, s * 0.7, s * 0.7, '#1a1a2e');
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        N: 6, board: [], cur: { x: 2, y: 3 }, myTurn: true, msg: '', msgT: 0,
      };
      // 0 空 1 黑(玩家) 2 白(AI)
      const b = Array.from({ length: 6 }, () => Array(6).fill(0));
      b[2][2] = 2; b[3][3] = 2; b[2][3] = 1; b[3][2] = 1;
      s.board = b;
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.msgT -= dt;
      if (s.myTurn) {
        if (Input.took('left')) { s.cur.x = (s.cur.x + 5) % 6; Sound.sfx.menu(); }
        if (Input.took('right')) { s.cur.x = (s.cur.x + 1) % 6; Sound.sfx.menu(); }
        if (Input.took('up')) { s.cur.y = (s.cur.y + 5) % 6; Sound.sfx.menu(); }
        if (Input.took('down')) { s.cur.y = (s.cur.y + 1) % 6; Sound.sfx.menu(); }
        if (Input.pointer && Input.pointer.inside && Input.took('a')) {
          const c = Math.floor((Input.pointer.x - 42) / 36), r = Math.floor((Input.pointer.y - 90) / 36);
          if (c >= 0 && c < 6 && r >= 0 && r < 6) s.cur = { x: c, y: r };
        }
        if ((Input.took('a') || Input.took('drop'))) {
          const flips = flipsAt(s.board, s.cur.x, s.cur.y, 1);
          if (flips.length) {
            applyMove(s.board, s.cur.x, s.cur.y, 1);
            Sound.sfx.flip();
            g.burst(42 + s.cur.x * 36 + 18, 90 + s.cur.y * 36 + 18, '#ffffff', 8, 80);
            s.myTurn = false;
            s.aiT = 0.5;
          } else Sound.sfx.hit();
        }
      } else {
        s.aiT -= dt;
        if (s.aiT <= 0) {
          const moves = legalMoves(s.board, 2);
          if (moves.length) {
            // 贪心：翻最多 + 角优先
            let best = moves[0], bestScore = -1;
            for (const [mx, my] of moves) {
              let sc = flipsAt(s.board, mx, my, 2).length;
              if ((mx === 0 || mx === 5) && (my === 0 || my === 5)) sc += 10;
              if (sc > bestScore) { bestScore = sc; best = [mx, my]; }
            }
            applyMove(s.board, best[0], best[1], 2);
            Sound.sfx.move();
          }
          // 回合推进与终局
          advance(s, g);
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      const blacks = s.board.flat().filter((v) => v === 1).length;
      const whites = s.board.flat().filter((v) => v === 2).length;
      g.hud(s.score, s.hi, s.myTurn ? 'B' : 'W', blacks + '-' + whites);
      const C = 36, bx = 42, by = 90;
      g.rect(bx - 4, by - 4, 6 * C + 8, 6 * C + 8, '#1a1440');
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++) {
          const x = bx + c * C, y = by + r * C;
          g.rect(x, y, C - 2, C - 2, '#14522e');
          const v = s.board[r][c];
          if (v) {
            const col = v === 1 ? '#f4f8ff' : '#1a1a2e';
            g.block(x + 5, y + 5, C - 12, C - 12, col);
            g.rect(x + 8, y + 8, C - 18, 4, v === 1 ? '#ffffff' : '#3a3a5e');
          } else if (s.myTurn && flipsAt(s.board, c, r, 1).length) {
            g.frame(x + 8, y + 8, C - 16, C - 16, '#ffffff44', 1);
          }
        }
      g.frame(bx + s.cur.x * C - 1, by + s.cur.y * C - 1, C + 2, C + 2, '#ffd60a', 2);
      if (s.msgT > 0) g.cnText(s.msg, 150, 66, '#ffffff', 12, 'center');
      g.text('A 落子 · 翻转白子', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function flipsAt(b, x, y, me) {
    if (b[y][x] !== 0) return [];
    const opp = me === 1 ? 2 : 1;
    const out = [];
    for (const [dx, dy] of DIRS8) {
      const line = [];
      let cx = x + dx, cy = y + dy;
      while (cx >= 0 && cx < 6 && cy >= 0 && cy < 6 && b[cy][cx] === opp) {
        line.push([cx, cy]);
        cx += dx; cy += dy;
      }
      if (line.length && cx >= 0 && cx < 6 && cy >= 0 && cy < 6 && b[cy][cx] === me) out.push(...line);
    }
    return out;
  }
  function applyMove(b, x, y, me) {
    for (const [fx, fy] of flipsAt(b, x, y, me)) b[fy][fx] = me;
    b[y][x] = me;
  }
  function legalMoves(b, me) {
    const out = [];
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++)
        if (!b[y][x] && flipsAt(b, x, y, me).length) out.push([x, y]);
    return out;
  }
  function advance(s, g) {
    const myMoves = legalMoves(s.board, 1);
    const aiMoves = legalMoves(s.board, 2);
    if (!aiMoves.length && myMoves.length) {
      s.myTurn = true;
      s.msg = 'AI 无棋可走'; s.msgT = 1.2;
      return;
    }
    if (!myMoves.length && !aiMoves.length) return finish(s, g);
    if (!myMoves.length) {
      s.msg = '你无棋可走'; s.msgT = 1.0;
      s.aiT = 0.5; // AI 继续走
      return;
    }
    s.myTurn = true;
  }
  function finish(s, g) {
    const b = s.board.flat().filter((v) => v === 1).length;
    const w = s.board.flat().filter((v) => v === 2).length;
    s.over = true;
    s.won = b > w;
    s.score = b * 10 + (b > w ? 500 : 0);
    Sound.sfx.win();
    s.msg = b > w ? '黑胜!' : b === w ? '平局' : '白胜';
    s.msgT = 3;
    g.flash('#30ff8e33', 0.5);
  }
})();
