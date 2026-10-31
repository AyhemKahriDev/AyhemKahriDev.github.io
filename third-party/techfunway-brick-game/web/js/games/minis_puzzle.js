/* ============ 解谜小游戏合集：点灯 / 汉诺塔 / 记忆旋律 / 井字棋 / 速算 ============ */
(function () {
  const U = window.GameUtil;

  /* ---------- 点灯 LIGHTSOUT ---------- */
  window.registerGame({
    id: 'lightsout',
    name: '点灯',
    en: 'LIGHTSOUT',
    desc: '按灭所有灯 · 十字联动',
    color: '#ffd60a',
    music: 'chill',
    icon(g, x, y, s, t) {
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 2; c++)
          g.block(x + s * (0.2 + c * 1.3), y + s * (0.2 + r * 1.3) + Math.sin(t * 4 + c + r) * 1.5, s, s, (r + c) % 2 ? '#ffd60a' : '#3a3a6a');
    },
    start(env) {
      const s = { score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0, moves: 0, time: 0, cur: { x: 2, y: 2 }, grid: null, presses: 14 };
      s.grid = lightsOutGrid(s.presses);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      if (Input.took('left')) { s.cur.x = (s.cur.x + 4) % 5; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur.x = (s.cur.x + 1) % 5; Sound.sfx.menu(); }
      if (Input.took('up')) { s.cur.y = (s.cur.y + 4) % 5; Sound.sfx.menu(); }
      if (Input.took('down')) { s.cur.y = (s.cur.y + 1) % 5; Sound.sfx.menu(); }
      // 触屏点选
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        const bx = 50, by = 96, C = 40;
        const cx = Math.floor((Input.pointer.x - bx) / C), cy = Math.floor((Input.pointer.y - by) / C);
        if (cx >= 0 && cx < 5 && cy >= 0 && cy < 5) { s.cur = { x: cx, y: cy }; press(s); return; }
      }
      if (Input.took('a') || Input.took('drop')) press(s);
      function press(s2) {
        const t = (x, y) => { if (x >= 0 && x < 5 && y >= 0 && y < 5) s2.grid[y][x] ^= 1; };
        t(s2.cur.x, s2.cur.y); t(s2.cur.x - 1, s2.cur.y); t(s2.cur.x + 1, s2.cur.y);
        t(s2.cur.x, s2.cur.y - 1); t(s2.cur.x, s2.cur.y + 1);
        s2.moves++;
        Sound.sfx.flip();
        if (s2.grid.every((row) => row.every((v) => !v))) {
          s2.score += Math.max(100, 600 - s2.moves * 8);
          Sound.sfx.win();
          g.flash('#ffd60a33', 0.5);
          s2.level++;
          s2.presses = Math.min(24, 12 + s2.level * 2);
          s2.grid = lightsOutGrid(s2.presses);
          s2.moves = 0;
          g.toast('CLEAR!', 150, 180, '#ffd60a', 3);
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LV', s.level);
      g.text('MOVES ' + s.moves, 6, 34, '#9aa0ff', 1);
      const C = 40, bx = 50, by = 96;
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) {
          const on = s.grid[y][x];
          const px = bx + x * C, py = by + y * C;
          if (on) g.block(px + 3, py + 3, C - 6, C - 6, '#ffd60a');
          else g.block(px + 3, py + 3, C - 6, C - 6, '#262a52');
          if (on) g.rect(px + 8, py + 8, C - 16, C - 16, '#fff2b866');
        }
      const cx = bx + s.cur.x * C, cy = by + s.cur.y * C;
      g.frame(cx, cy, C, C, '#ffffff', 2);
      g.text('A 按灯 · 全灭过关', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  function lightsOutGrid(presses) {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
    const t = (x, y) => { if (x >= 0 && x < 5 && y >= 0 && y < 5) grid[y][x] ^= 1; };
    for (let i = 0; i < presses; i++) {
      const x = U.ri(5), y = U.ri(5);
      t(x, y); t(x - 1, y); t(x + 1, y); t(x, y - 1); t(x, y + 1);
    }
    if (grid.every((r) => r.every((v) => !v))) grid[2][2] = 1;
    return grid;
  }

  /* ---------- 汉诺塔 HANOI ---------- */
  window.registerGame({
    id: 'hanoi',
    name: '汉诺塔',
    en: 'HANOI',
    desc: '5 环全移到右柱 · A 取放',
    color: '#2de2ff',
    music: 'chill',
    icon(g, x, y, s, t) {
      for (let i = 0; i < 3; i++) {
        g.block(x + s * (0.1 + i * 0.2), y + s * (2.2 - i * 0.5), s * (1.8 - i * 0.35), s * 0.4, ['#ff4d5e', '#ffd60a', '#30ff8e'][i]);
      }
      g.rect(x + s * 0.1, y + s * 2.6, s * 1.8, s * 0.3, '#5d628f');
    },
    start(env) {
      return {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        towers: [[5, 4, 3, 2, 1], [], []],
        cur: 0, hold: 0, moves: 0, done: false,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      if (Input.took('left')) { s.cur = (s.cur + 2) % 3; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur = (s.cur + 1) % 3; Sound.sfx.menu(); }
      if (Input.took('a') || Input.took('drop')) {
        if (s.hold) {
          const t = s.towers[s.cur];
          if (!t.length || t[t.length - 1] > s.hold) {
            t.push(s.hold);
            s.hold = 0;
            s.moves++;
            Sound.sfx.lock();
            if (s.towers[2].length === 5) {
              s.done = true; s.over = true; s.won = true;
              s.score = Math.max(100, 2000 - s.moves * 20);
              Sound.sfx.win();
              g.flash('#2de2ff33', 0.5);
            }
          } else Sound.sfx.hit();
        } else {
          const t = s.towers[s.cur];
          if (t.length) { s.hold = t.pop(); Sound.sfx.flip(); }
          else Sound.sfx.hit();
        }
      }
      if (Input.took('b') && s.hold) { // 放回原处
        s.towers[s.cur].push(s.hold);
        s.hold = 0;
        Sound.sfx.flip();
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'MOVES', s.moves);
      const baseY = 430, colX = [50, 150, 250];
      const COLORS = ['#ff4d5e', '#ff9f40', '#ffd60a', '#30ff8e', '#00e5ff'];
      for (let i = 0; i < 3; i++) {
        const cx = colX[i];
        g.rect(cx - 2, baseY - 150, 4, 150, '#3a3e6a');
        g.rect(cx - 42, baseY, 84, 10, '#3a3e6a');
        s.towers[i].forEach((disk, di) => {
          const w = 18 + disk * 13;
          const dy = baseY - 14 - di * 16;
          g.block(cx - w / 2, dy, w, 13, COLORS[disk - 1]);
          g.rect(cx - w / 2 + 3, dy + 2, w - 6, 3, '#ffffff44');
        });
        if (s.cur === i) {
          g.frame(cx - 44, baseY - 158, 88, 176, s.hold ? '#ffd60a' : '#2de2ff', 1);
          g.text(String.fromCharCode(65 + i), cx, 60, '#2de2ff', 2, { center: true });
        }
      }
      if (s.hold) {
        const w = 18 + s.hold * 13;
        g.block(colX[s.cur] - w / 2, baseY - 185, w, 13, COLORS[s.hold - 1]);
        g.rect(colX[s.cur] - w / 2 + 3, baseY - 183, w - 6, 3, '#ffffff44');
      }
      g.text('A 取/放 · B 放回', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  /* ---------- 记忆旋律 SIMON ---------- */
  window.registerGame({
    id: 'simon',
    name: '记忆旋律',
    en: 'SIMON',
    desc: '跟着闪光复述序列',
    color: '#30ff8e',
    music: null,
    icon(g, x, y, s, t) {
      const on = Math.floor(t * 2) % 4;
      const cols = ['#30ff8e', '#ff4d5e', '#ffd60a', '#3f8cff'];
      for (let i = 0; i < 4; i++) {
        const cx = x + (i % 2) * s * 1.3, cy = y + Math.floor(i / 2) * s * 1.3;
        g.block(cx, cy, s * 1.1, s * 1.1, i === on ? cols[i] : '#262a52');
      }
    },
    start(env) {
      const s = {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        seq: [], input: 0, phase: 'show', showT: 0, idx: 0, lit: -1,
      };
      extendSeq(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.showT -= dt;
      if (s.phase === 'show') {
        if (s.showT <= 0) {
          if (s.idx < s.seq.length) {
            s.lit = s.seq[s.idx];
            s.showT = Math.max(0.22, 0.55 - s.level * 0.03);
            Sound.sfx.tone ? Sound.sfx.tone() : Sound.sfx.coin();
            g.burst(pads()[s.lit].cx, pads()[s.lit].cy, pads()[s.lit].color, 6, 60);
          } else {
            s.lit = -1;
            s.phase = 'input';
            s.input = 0;
            g.toast('轮到你了!', 150, 200, '#ffffff', 2);
          }
          s.idx++;
        }
        return;
      }
      // 输入阶段
      const keymap = { up: 0, right: 1, down: 2, left: 3 };
      let press = -1;
      for (const k of Object.keys(keymap)) if (Input.took(k)) press = keymap[k];
      // 触屏：点在色块上
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        const P = pads();
        for (let i = 0; i < 4; i++) {
          const p = P[i];
          if (Input.pointer.x > p.x && Input.pointer.x < p.x + p.size && Input.pointer.y > p.y && Input.pointer.y < p.y + p.size) press = i;
        }
      }
      if (press >= 0) {
        s.lit = press;
        s.litT = 0.18;
        Sound.sfx.coin();
        const expected = s.seq[s.input];
        if (press !== expected) {
          s.over = true;
          Sound.sfx.over();
          g.shake(5);
          return;
        }
        s.input++;
        s.score += 10;
        if (s.input >= s.seq.length) {
          s.phase = 'show';
          s.idx = 0;
          s.showT = 0.8;
          s.level++;
          s.score += 50;
          extendSeq(s);
          g.toast('ROUND ' + (s.level - 1) + ' +50', 150, 180, '#30ff8e', 2);
        }
      }
      if (s.litT !== undefined && s.litT > 0) { s.litT -= dt; if (s.litT <= 0) s.lit = -1; }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LEN', s.seq.length);
      const P = pads();
      const cols = ['#30ff8e', '#ff4d5e', '#ffd60a', '#3f8cff'];
      for (let i = 0; i < 4; i++) {
        const p = P[i];
        const on = s.lit === i;
        g.block(p.x, p.y, p.size, p.size, on ? cols[i] : '#1c2044');
        g.frame(p.x, p.y, p.size, p.size, on ? '#ffffff' : cols[i] + '66', 2);
      }
      g.text(s.phase === 'show' ? 'WATCH' : 'REPEAT', 150, 68, s.phase === 'show' ? '#ffd60a' : '#7cf7ff', 2, { center: true, glow: 6 });
      g.text('↑←↓→ 或 点色块', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  function pads() {
    const size = 92, gx = 150 - size - 4, gy = 190;
    return [
      { x: gx, y: gy, size, cx: gx + size / 2, cy: gy + size / 2, color: '#30ff8e' },
      { x: gx + size + 8, y: gy, size, cx: gx + size + 8 + size / 2, cy: gy + size / 2, color: '#ff4d5e' },
      { x: gx, y: gy + size + 8, size, cx: gx + size / 2, cy: gy + size + 8 + size / 2, color: '#ffd60a' },
      { x: gx + size + 8, y: gy + size + 8, size, cx: gx + size + 8 + size / 2, cy: gy + size + 8 + size / 2, color: '#3f8cff' },
    ];
  }
  function extendSeq(s) { s.seq.push(U.ri(4)); }

  /* ---------- 井字棋 TICTAC ---------- */
  window.registerGame({
    id: 'tictac',
    name: '井字棋',
    en: 'TIC TAC',
    desc: '你执 X 挑战 AI · 三连胜',
    color: '#7cf7ff',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.frame(x + s * 0.2, y + s * 0.2, s * 2.6, s * 2.6, '#7cf7ff', 1);
      g.frame(x + s * 0.2, y + s * 0.2 + s * 0.87, s * 2.6, 0, '#7cf7ff', 1);
      g.text('X', x + s * 0.7, y + s * 0.55, '#ffd60a', 2);
      g.text('O', x + s * 1.9, y + s * 1.4, '#ff7ab8', 2);
    },
    start(env) {
      return {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        board: Array(9).fill(0), cur: 4, myTurn: true, rounds: 5, round: 1,
        wins: 0, msg: 'X 你先手', msgT: 1.2, result: '',
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.msgT -= dt;
      if (s.myTurn) {
        if (Input.took('left')) { s.cur = (s.cur + 8) % 9; Sound.sfx.menu(); }
        if (Input.took('right')) { s.cur = (s.cur + 1) % 9; Sound.sfx.menu(); }
        if (Input.took('up')) { s.cur = (s.cur + 6) % 9; Sound.sfx.menu(); }
        if (Input.took('down')) { s.cur = (s.cur + 3) % 9; Sound.sfx.menu(); }
        if (Input.pointer && Input.pointer.inside && Input.took('a')) {
          const c = Math.floor((Input.pointer.x - 60) / 60), r = Math.floor((Input.pointer.y - 100) / 60);
          if (c >= 0 && c < 3 && r >= 0 && r < 3) s.cur = r * 3 + c;
        }
        if ((Input.took('a') || Input.took('drop')) && !s.board[s.cur]) {
          s.board[s.cur] = 1;
          Sound.sfx.flip();
          afterMove(s, g, 1);
        }
      } else {
        s.aiT = (s.aiT || 0.55) - dt;
        if (s.aiT <= 0) {
          s.aiT = 0.55;
          const mv = aiMove(s.board);
          if (mv >= 0) { s.board[mv] = 2; Sound.sfx.move(); }
          afterMove(s, g, 2);
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'ROUND', s.round + '/' + s.rounds);
      const bx = 60, by = 100, C = 60;
      for (let i = 1; i < 3; i++) {
        g.rect(bx + i * C, by, 2, C * 3, '#3a3e6a');
        g.rect(bx, by + i * C, C * 3, 2, '#3a3e6a');
      }
      for (let i = 0; i < 9; i++) {
        const x = bx + (i % 3) * C, y = by + Math.floor(i / 3) * C;
        if (s.board[i] === 1) {
          g.rect(x + 14, y + 14, C - 28, 5, '#ffd60a');
          g.rect(x + 14, y + C - 19, C - 28, 5, '#ffd60a');
          g.rect(x + 14, y + C / 2 - 2, 5, C - 28, '#ffd60a');
          g.rect(x + C - 19, y + C / 2 - 2, 5, C - 28, '#ffd60a');
        } else if (s.board[i] === 2) {
          g.frame(x + 12, y + 12, C - 24, C - 24, '#ff7ab8', 4);
        }
        if (s.myTurn && i === s.cur && !s.board[i]) g.frame(x + 4, y + 4, C - 8, C - 8, '#ffffff88', 1);
      }
      if (s.msgT > 0) g.cnText(s.msg, 150, 62, '#ffffff', 12, 'center');
      g.text('WINS ' + s.wins + '/' + s.rounds, 150, 480, '#9aa0ff', 1, { center: true });
      if (s.result) g.text(s.result, 150, 494, '#ffd60a', 1, { center: true });
    },
  });

  function lines3() {
    return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  }
  function winnerOf(b) {
    for (const [a, c, d] of lines3()) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every((v) => v) ? 3 : 0; // 3=平局
  }
  function afterMove(s, g, who) {
    const w = winnerOf(s.board);
    if (w) {
      if (w === 1) {
        s.score += 300; s.wins++;
        s.msg = '你赢了这一局!'; s.result = 'WIN +300';
        Sound.sfx.win();
      } else if (w === 2) {
        s.msg = 'AI 获胜'; s.result = 'LOSE';
        Sound.sfx.over();
      } else {
        s.score += 100; s.wins += 0;
        s.msg = '平局'; s.result = 'DRAW +100';
        Sound.sfx.select();
      }
      s.msgT = 1.1;
      setTimeout(() => {}, 0);
      s.round++;
      if (s.round > s.rounds) {
        s.over = true;
        s.won = s.wins >= 3;
        s.score += s.wins >= 3 ? 500 : 0;
      } else {
        s.board = Array(9).fill(0);
        s.cur = 4;
        s.myTurn = (s.round % 2 === 1); // 轮换先手
        s.msg = s.myTurn ? 'X 你先手' : 'O AI 先手';
        s.msgT = 1.0;
      }
    } else {
      s.myTurn = who === 1 ? false : true;
    }
  }
  function aiMove(b) {
    const empty = b.map((v, i) => v ? -1 : i).filter((i) => i >= 0);
    if (!empty.length) return -1;
    // 15% 随机走棋让对局有来有回
    if (Math.random() < 0.15) return empty[U.ri(empty.length)];
    // 1) 能赢就赢
    for (const i of empty) { const b2 = b.slice(); b2[i] = 2; if (winnerOf(b2) === 2) return i; }
    // 2) 挡住玩家
    for (const i of empty) { const b2 = b.slice(); b2[i] = 1; if (winnerOf(b2) === 1) return i; }
    // 3) 中心 > 角 > 边
    if (b[4] === 0) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !b[i]);
    if (corners.length) return corners[U.ri(corners.length)];
    return empty[U.ri(empty.length)];
  }

  /* ---------- 速算 MATH ---------- */
  window.registerGame({
    id: 'math',
    name: '速算',
    en: 'MATH',
    desc: '10 秒心算 · 连对翻倍',
    color: '#b455ff',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.text('7+8', x + s * 1.5, y + s * 0.4, '#ffffff', 2, { center: true });
      g.frame(x + s * 0.6, y + s * 1.4, s * 1.2, s * 1.0, '#b455ff', 1);
      g.text('15', x + s * 1.2, y + s * 1.6, '#ffd60a', 2, { center: true });
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        lives: 3, streak: 0, a: 0, b: 0, op: '+', ans: 0, opts: [], cur: 0,
        time: 10, qn: 0,
      };
      newQ(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time -= dt;
      if (s.time <= 0) { wrong(s, g); return; }
      s.level = 1 + Math.floor(s.qn / 5);
      if (Input.took('left')) { s.cur = (s.cur + 2) % 3; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur = (s.cur + 1) % 3; Sound.sfx.menu(); }
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        for (let i = 0; i < 3; i++) {
          const ox = 20 + i * 90;
          if (Input.pointer.x > ox && Input.pointer.x < ox + 80 && Input.pointer.y > 350 && Input.pointer.y < 420) s.cur = i;
        }
      }
      if (Input.took('a') || Input.took('drop')) {
        if (s.opts[s.cur] === s.ans) {
          s.streak++;
          const mult = 1 + Math.floor(s.streak / 3);
          s.score += (10 + s.level * 2) * mult;
          Sound.sfx.coin();
          g.toast('+' + (10 + s.level * 2) * mult + (mult > 1 ? ' x' + mult : ''), 150, 250, '#30ff8e', 2);
          newQ(s);
        } else wrong(s, g);
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      g.text(String(s.a) + ' ' + s.op + ' ' + String(s.b) + ' = ?', 150, 130, '#ffffff', 3, { center: true, glow: 8 });
      const tl = Math.max(0, s.time);
      g.rect(60, 200, 180 * (tl / 10), 8, tl < 3 ? '#ff4d5e' : '#30ff8e');
      g.frame(58, 198, 184, 12, '#2de2ff44', 1);
      for (let i = 0; i < 3; i++) {
        const ox = 20 + i * 90;
        const sel = i === s.cur;
        g.rect(ox, 350, 80, 70, sel ? 'rgba(180,85,255,0.25)' : 'rgba(30,26,70,0.85)');
        g.frame(ox, 350, 80, 70, sel ? '#b455ff' : '#2a265a', 1);
        g.text(String(s.opts[i]), ox + 40, 372, sel ? '#ffffff' : '#8f93c8', 3, { center: true });
      }
      g.text('STREAK ' + s.streak, 150, 320, '#ff7ab8', 1, { center: true });
    },
  });

  function newQ(s) {
    s.qn++;
    const lv = s.level;
    const ops = lv < 3 ? ['+', '-'] : ['+', '-', '×'];
    s.op = ops[U.ri(ops.length)];
    const range = 9 + lv * 6;
    s.a = U.ri(range) + 1;
    s.b = U.ri(range) + 1;
    if (s.op === '-' && s.b > s.a) { const t = s.a; s.a = s.b; s.b = t; }
    s.ans = s.op === '+' ? s.a + s.b : s.op === '-' ? s.a - s.b : s.a * s.b;
    const set = new Set([s.ans]);
    while (set.size < 3) set.add(s.ans + (U.ri(13) - 6) || s.ans + 1);
    s.opts = U.shuffle([...set]);
    s.cur = 1;
    s.time = 10;
  }
  function wrong(s, g) {
    s.lives--;
    s.streak = 0;
    s.time = 10;
    Sound.sfx.die();
    g.shake(3); g.flash('#ff3b3044', 0.4);
    g.toast('正确答案 ' + s.ans, 150, 260, '#ff4d5e', 2);
    if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
    newQ(s);
  }
})();
