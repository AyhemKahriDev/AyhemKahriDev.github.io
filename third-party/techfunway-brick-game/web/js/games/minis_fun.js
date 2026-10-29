/* ============ 贪吃豆 + 拉霸机 ============ */
(function () {
  const U = window.GameUtil;

  /* ---------- 贪吃豆 PAC ---------- */
  const MAP = [
    '###############',
    '#.......#.....#',
    '#.##.##.#.###.#',
    '#.............#',
    '#.##.#.###.##.#',
    '#....#...#....#',
    '###.##.#.##.###',
    '#....#...#....#',
    '#.##.#.###.##.#',
    '#.............#',
    '#.##.##.#.###.#',
    '#.......#.....#',
    '###############',
  ];
  window.registerGame({
    id: 'pac',
    name: '贪吃豆',
    en: 'MUNCHER',
    desc: '吃完豆子 · 大力丸反杀',
    color: '#ffd60a',
    music: 'snake',
    icon(g, x, y, s, t) {
      const open = (Math.sin(t * 8) + 1) / 2 * 0.6 + 0.2;
      g.block(x + s * 0.9, y + s * 0.9, s * 1.2, s * 1.2, '#ffd60a');
      g.block(x + s * 1.9, y + s * 0.9 + open * s * 0.4, s * 0.5, s * 1.2 - open * s * 0.8, '#0b0a1e');
      g.block(x + s * 2.6, y + s * 1.0, s * 0.9, s * 0.9, '#ff4d5e');
    },
    start(env) {
      const s = {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        lives: 3, px: 7, py: 9, dir: [0, 0], want: [0, 0],
        dots: new Set(), powers: new Set(),
        ghosts: [
          { x: 7, y: 1, d: [0, 1], color: '#ff4d5e', move: 0 },
          { x: 1, y: 1, d: [1, 0], color: '#ff7ab8', move: 0 },
        ],
        fright: 0, ghostChain: 0, inv: 0, moveT: 0,
      };
      // 收集豆子
      for (let y = 0; y < MAP.length; y++)
        for (let x = 0; x < MAP[y].length; x++) {
          if (MAP[y][x] === '.') s.dots.add(x + ',' + y);
        }
      s.dots.delete('7,9');
      s.powers.add('1,1'); s.powers.add('13,1'); s.powers.add('1,11'); s.powers.add('13,11');
      s.totalDots = s.dots.size + s.powers.size;
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.inv = Math.max(0, s.inv - dt);
      s.fright = Math.max(0, s.fright - dt);
      s.level = 1 + Math.floor(s.score / 500);
      // 转向意愿
      const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      for (const k of Object.keys(dirs)) if (Input.took(k)) s.want = dirs[k];
      if (Input.pointer && Input.took('a')) {
        const dx = Input.pointer.x - (s.px * 20 + 10), dy = Input.pointer.y - (s.py * 20 + 52);
        s.want = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      }
      const canGo = (x, y) => MAP[y] && MAP[y][x] && MAP[y][x] !== '#';
      // 移动（格子制，节拍）
      const iv = Math.max(0.07, 0.16 - s.level * 0.01);
      s.moveT += dt;
      while (s.moveT >= iv) {
        s.moveT -= iv;
        // 尽量转向
        const [wx, wy] = s.want;
        if ((wx || wy) && canGo(s.px + wx, s.py + wy)) { s.dir = s.want; }
        const [dx, dy] = s.dir;
        if (canGo(s.px + dx, s.py + dy)) { s.px += dx; s.py += dy; }
        else s.dir = [0, 0];
        const k = s.px + ',' + s.py;
        if (s.dots.has(k)) { s.dots.delete(k); s.score += 10; Sound.sfx.eat(); }
        if (s.powers.has(k)) {
          s.powers.delete(k);
          s.score += 50;
          s.fright = 8;
          s.ghostChain = 0;
          Sound.sfx.levelup();
          g.flash('#ffd60a22', 0.4);
        }
        // 幽灵
        for (const gh of s.ghosts) {
          gh.move += 1;
          // 幽灵每 1.5 拍动一步（慢于玩家）
          if (gh.move % 2 === 0) ghostStep(s, gh);
          const same = gh.x === s.px && gh.y === s.py;
          if (same) {
            if (s.fright > 0) {
              gh.x = 7; gh.y = 1;
              s.ghostChain++;
              s.score += 200 * s.ghostChain;
              Sound.sfx.eat();
              g.toast('+' + 200 * s.ghostChain, 150, 140, '#7cf7ff', 2);
            } else if (s.inv <= 0) {
              s.lives--;
              s.inv = 2;
              s.px = 7; s.py = 9; s.dir = [0, 0];
              Sound.sfx.die();
              g.shake(5); g.flash('#ff3b3055', 0.5);
              if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
            }
          }
        }
        // 通关
        if (s.dots.size === 0 && s.powers.size === 0) {
          s.score += 300;
          s.level++;
          Sound.sfx.win();
          g.flash('#ffd60a33', 0.5);
          g.toast('LEVEL ' + s.level, 150, 140, '#ffd60a', 3);
          for (let y = 0; y < MAP.length; y++)
            for (let x = 0; x < MAP[y].length; x++)
              if (MAP[y][x] === '.') s.dots.add(x + ',' + y);
          s.dots.delete('7,9');
          s.powers.add('1,1'); s.powers.add('13,1'); s.powers.add('1,11'); s.powers.add('13,11');
        }
      }
    },
    draw(s, g) {
      g.clear('#08071a');
      const CS = 20, bx = (300 - 15 * CS) / 2, by = 52;
      // 墙
      for (let y = 0; y < MAP.length; y++)
        for (let x = 0; x < MAP[y].length; x++)
          if (MAP[y][x] === '#') {
            g.block(bx + x * CS + 1, by + y * CS + 1, CS - 2, CS - 2, '#15306e');
            g.rect(bx + x * CS + 4, by + y * CS + 4, CS - 8, 3, '#3f8cff66');
          }
      // 豆子
      for (const k of s.dots) {
        const [x, y] = k.split(',').map(Number);
        g.rect(bx + x * CS + CS / 2 - 1.5, by + y * CS + CS / 2 - 1.5, 3, 3, '#ffd9a0');
      }
      for (const k of s.powers) {
        const [x, y] = k.split(',').map(Number);
        const r = 4 + Math.sin(g.t * 7) * 1.5;
        g.block(bx + x * CS + CS / 2 - r, by + y * CS + CS / 2 - r, r * 2, r * 2, '#ffd60a');
      }
      // 幽灵
      for (const gh of s.ghosts) {
        const gx = bx + gh.x * CS + 2, gy = by + gh.y * CS + 2;
        const blue = s.fright > 0 && (s.fright > 2 || Math.sin(g.t * 10) > 0);
        const c = blue ? '#3f8cff' : gh.color;
        g.block(gx, gy + 4, CS - 4, CS - 8, c);
        g.block(gx + 2, gy, CS - 8, 6, c);
        g.rect(gx + 3, gy + 4, 3, 3, '#ffffff');
        g.rect(gx + CS - 9, gy + 4, 3, 3, '#ffffff');
        if (blue) {
          g.rect(gx + 3, gy + 5, 3, 2, '#0b0a1e');
          g.rect(gx + CS - 9, gy + 5, 3, 2, '#0b0a1e');
        }
      }
      // 玩家
      const px = bx + s.px * CS + 2, py = by + s.py * CS + 2;
      const mouth = (Math.sin(g.t * 12) + 1) / 2;
      const ang = mouth * 0.9;
      g.ctx.save();
      g.ctx.fillStyle = '#ffd60a';
      g.ctx.beginPath();
      const cx = px + (CS - 4) / 2, cy = py + (CS - 4) / 2, R = (CS - 4) / 2;
      g.ctx.moveTo(cx, cy);
      g.ctx.arc(cx, cy, R, ang, Math.PI * 2 - ang);
      g.ctx.closePath();
      g.ctx.fill();
      g.ctx.restore();
      // 状态
      g.text('LIFE', 6, 34, '#7cf7ff', 1);
      for (let i = 0; i < s.lives; i++) g.block(34 + i * 14, 33, 10, 6, '#ffd60a');
      g.text('LV' + s.level, 294, 33, '#ff7ab8', 1, { right: true });
      if (s.fright > 0) g.text('POWER ' + s.fright.toFixed(1), 150, 34, '#30ff8e', 1, { center: true });
      g.text('方向键 / 轻点方向移动', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  function ghostStep(s, gh) {
    const canGo = (x, y) => MAP[y] && MAP[y][x] && MAP[y][x] !== '#';
    const options = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = gh.x + dx, ny = gh.y + dy;
      if (!canGo(nx, ny)) continue;
      // 不轻易回头
      if (dx === -gh.d[0] && dy === -gh.d[1] && options.length < 3) continue;
      options.push([dx, dy]);
    }
    if (!options.length) { gh.d = [-gh.d[0], -gh.d[1]]; return; }
    let pick;
    if (s.fright > 0) {
      pick = options[U.ri(options.length)];
    } else {
      // 70% 朝玩家追
      if (Math.random() < 0.7) {
        options.sort((a, b) => {
          const da = Math.abs(gh.x + a[0] - s.px) + Math.abs(gh.y + a[1] - s.py);
          const db = Math.abs(gh.x + b[0] - s.px) + Math.abs(gh.y + b[1] - s.py);
          return da - db;
        });
        pick = options[0];
      } else pick = options[U.ri(options.length)];
    }
    gh.d = pick;
    gh.x += pick[0];
    gh.y += pick[1];
  }

  /* ---------- 拉霸机 SLOTS ---------- */
  const SLOT_SYMS = ['♥', '★', '◆', '↑', '+'];
  const SLOT_VALS = [3, 4, 5, 6, 8];
  window.registerGame({
    id: 'slots',
    name: '拉霸机',
    en: 'SLOTS',
    desc: '押注旋转 · 三个同图大奖',
    color: '#ff4d5e',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.frame(x + s * 0.2, y + s * 0.2, s * 2.6, s * 2.6, '#ff4d5e', 2);
      const spin = Math.floor(t * 6) % 5;
      g.text(SLOT_SYMS[spin], x + s * 0.75, y + s * 0.9, '#ffd60a', 3, { center: true });
      g.text(SLOT_SYMS[(spin + 2) % 5], x + s * 1.5, y + s * 0.9, '#30ff8e', 3, { center: true });
      g.text(SLOT_SYMS[(spin + 4) % 5], x + s * 2.25, y + s * 0.9, '#3f8cff', 3, { center: true });
    },
    start(env) {
      return {
        score: 100, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        reels: [0, 1, 2], spinning: false, spinT: 0, stopMask: [false, false, false],
        speeds: [0, 0, 0], msg: 'A 开始旋转', msgT: 2, bet: 5, lastWin: 0,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.msgT -= dt;
      if (s.spinning) {
        s.spinT -= dt;
        for (let i = 0; i < 3; i++) {
          if (!s.stopMask[i]) {
            s.reels[i] = (s.reels[i] + Math.round(s.speeds[i] * dt * 20)) % SLOT_SYMS.length;
            if (s.spinT < (0.7 + i * 0.5)) s.stopMask[i] = true;
          }
        }
        if (s.stopMask.every(Boolean)) {
          s.spinning = false;
          // 结算
          const [a, b, c] = s.reels.map((r) => r % SLOT_SYMS.length);
          let win = 0;
          if (a === b && b === c) win = SLOT_VALS[a] * 20;
          else if (a === b || b === c || a === c) win = SLOT_VALS[a === b ? a : c] * 2;
          if (win > 0) {
            s.score += win;
            s.lastWin = win;
            Sound.sfx.coin();
            g.toast('WIN +' + win, 150, 200, win >= 100 ? '#ffd60a' : '#30ff8e', 3);
            g.flash('#ffd60a22', 0.4);
            if (win >= 100) g.shake(3);
          } else {
            s.lastWin = 0;
            Sound.sfx.hit();
          }
          s.msg = win > 0 ? 'WIN +' + win + ' · A 再来' : '没中 · A 再来 (5币)';
          s.msgT = 3;
          if (s.score < s.bet) { s.over = true; s.won = s.score >= 150; }
        }
        return;
      }
      if (Input.took('a') || Input.took('drop') || Input.took('start')) {
        if (s.score >= s.bet) {
          s.score -= s.bet;
          s.spinning = true;
          s.spinT = 1.8;
          s.stopMask = [false, false, false];
          s.speeds = [1, 1.4, 1.8];
          Sound.sfx.shoot();
        } else Sound.sfx.hit();
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'BET', s.bet);
      // 机身
      g.rect(30, 70, 240, 190, '#1a1440');
      g.frame(30, 70, 240, 190, '#ff4d5e88', 3);
      for (let i = 0; i < 3; i++) {
        const rx = 45 + i * 72;
        g.rect(rx, 90, 62, 120, '#0b0a1e');
        g.frame(rx, 90, 62, 120, '#5d628f', 1);
        // 滚轮上下残影
        g.text(SLOT_SYMS[(s.reels[i] + 4) % 5], rx + 31, 104, '#3a3e6a', 3, { center: true });
        g.text(SLOT_SYMS[(s.reels[i] + 1) % 5], rx + 31, 168, '#3a3e6a', 3, { center: true });
        const stopped = !s.spinning || s.stopMask[i];
        g.text(SLOT_SYMS[s.reels[i] % 5], rx + 31, 136, stopped ? ['#ffd60a', '#30ff8e', '#3f8cff', '#ff7ab8', '#ff9f40'][s.reels[i] % 5] : '#8f93c8', 3, { center: true, glow: stopped ? 8 : 0 });
      }
      if (s.lastWin > 0) g.text('LAST WIN ' + s.lastWin, 150, 280, '#ffd60a', 1, { center: true });
      // 赔率表
      g.text('3连=面值x20   2连=面值x2', 150, 310, '#5d628f', 1, { center: true });
      if (s.msgT > 0) g.cnText(s.msg, 150, 345, s.spinning ? '#7cf7ff' : '#ffffff', 12, 'center');
      g.text('A 旋转 (每次 5 币)', 150, 492, '#5d628f', 1, { center: true });
    },
  });
})();
