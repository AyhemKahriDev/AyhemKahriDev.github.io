/* ============ 推箱子 ============ */
(function () {
  const U = window.GameUtil;

  // 图例：# 墙  . 目标  $ 箱子  * 箱子在目标上  @ 玩家  空格 地板
  const LEVELS2 = [
    [
      '########',
      '#      #',
      '# #  # #',
      '# $..$ #',
      '#  @   #',
      '#      #',
      '########',
    ],
    [
      '######',
      '#    #',
      '# $$ #',
      '# .. #',
      '#  @ #',
      '#    #',
      '######',
    ],
    [
      '#######',
      '#     #',
      '# .#  #',
      '# $   #',
      '#  #$ #',
      '# .   #',
      '#  @  #',
      '#######',
    ],
    [
      '########',
      '#      #',
      '# .$*  #',
      '#  $   #',
      '#  .@  #',
      '#      #',
      '########',
    ],
    [
      '#########',
      '#       #',
      '# #   # #',
      '# $ $ $ #',
      '#  ...  #',
      '#   @   #',
      '#       #',
      '#########',
    ],
    [
      '######',
      '#    #',
      '# .$.#',
      '# $  #',
      '# .$ #',
      '#  @ #',
      '######',
    ],
  ];

  const LEVELS = [
    [
      '######',
      '#    #',
      '# $. #',
      '# @  #',
      '#    #',
      '######',
    ],
    [
      '#######',
      '#     #',
      '# ..  #',
      '# $$  #',
      '#  @  #',
      '#     #',
      '#######',
    ],
    [
      '#######',
      '#     #',
      '#     #',
      '# .$. #',
      '# $.$ #',
      '#     #',
      '#  @  #',
      '#######',
    ],
    [
      '########',
      '#      #',
      '# $  . #',
      '# #    #',
      '# $  . #',
      '#   @  #',
      '#      #',
      '########',
    ],
    [
      '#######',
      '#     #',
      '#  #  #',
      '# $.$ #',
      '#  $  #',
      '# .@. #',
      '#     #',
      '#######',
    ],
    [
      '########',
      '#      #',
      '# .**$ #',
      '# $  . #',
      '#   @  #',
      '#      #',
      '########',
    ],
  ];

  function parseLevel(rows) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const walls = new Set(), targets = new Set(), boxes = new Set();
    let player = { x: 1, y: 1 };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = (rows[y][x] || ' ');
        const k = x + ',' + y;
        if (ch === '#') walls.add(k);
        if (ch === '.' || ch === '*' || ch === '+') targets.add(k);
        if (ch === '$' || ch === '*') boxes.add(k);
        if (ch === '@' || ch === '+') player = { x, y };
      }
    return { w, h, walls, targets, boxes, player };
  }

  function makeSokobanDef(hard) {
    return {
    id: hard ? 'sokobanII' : 'sokoban',
    name: hard ? '推箱子II' : '推箱子',
    en: hard ? 'SOKOBAN II' : 'SOKOBAN',
    desc: hard ? '进阶 6 关 · 更烧脑' : '经典搬运 · B 撤销 空格重开',
    color: hard ? '#ffd60a' : '#ff9f40',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.2, y + s * 0.2, s * 1.1, s * 1.1, '#a14e2c');
      g.frame(x + s * 0.2, y + s * 0.2, s * 1.1, s * 1.1, '#d97b4a', 1);
      g.block(x + s * 1.8, y + s * 1.8 + Math.sin(t * 4) * 1.5, s * 1.1, s * 1.1, '#30ff8e');
      g.text('◆', x + s * 1.05, y + s * 0.5, '#2de2ff', 2, { center: true });
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 0, speed: env.speed, hi: 0,
        moves: 0, totalMoves: 0, time: 0,
        lv: null, undo: [], dir: 'down', hard,
      };
      loadLevel(s, 0);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const move = (k) => {
        const [dx, dy] = DIRS[k];
        s.dir = k;
        const p = s.lv.player;
        const np = { x: p.x + dx, y: p.y + dy };
        const nk = np.x + ',' + np.y;
        if (s.lv.walls.has(nk)) { Sound.sfx.hit(); return; }
        const snapshot = JSON.stringify({ b: [...s.lv.boxes], p });
        if (s.lv.boxes.has(nk)) {
          const nn = { x: np.x + dx, y: np.y + dy };
          const nnk = nn.x + ',' + nn.y;
          if (s.lv.walls.has(nnk) || s.lv.boxes.has(nnk)) { Sound.sfx.hit(); return; }
          s.undo.push(snapshot);
          s.lv.boxes.delete(nk);
          s.lv.boxes.add(nnk);
          s.lv.player = np;
          Sound.sfx.move();
          // 箱子入坑音
          if (s.lv.targets.has(nnk)) Sound.sfx.coin();
        } else {
          s.undo.push(snapshot);
          s.lv.player = np;
          Sound.sfx.move();
        }
        s.moves++; s.totalMoves++;
        // 检查完成
        let done = true;
        for (const b of s.lv.boxes) if (!s.lv.targets.has(b)) { done = false; break; }
        if (done) {
          const gain = Math.max(50, 300 - s.moves * 5);
          s.score += gain;
          Sound.sfx.win();
          g.flash('#ff9f4033', 0.45);
          g.toast('过关 +' + gain, 150, 240, '#ffd60a', 2);
          if (s.level + 1 >= (s.hard ? LEVELS2 : LEVELS).length) {
            s.won = true; s.over = true;
            s.score += Math.max(0, 1000 - Math.floor(s.time) * 5);
          } else {
            loadLevel(s, s.level + 1);
          }
        }
      };
      if (Input.took('left')) move('left');
      if (Input.took('right')) move('right');
      if (Input.took('up')) move('up');
      if (Input.took('down')) move('down');
      if (Input.took('b') && s.undo.length) {
        const st = JSON.parse(s.undo.pop());
        s.lv.boxes = new Set(st.b);
        s.lv.player = st.p;
        s.moves++;
        Sound.sfx.flip();
      }
      if (Input.took('drop') || Input.took('start')) {
        loadLevel(s, s.level);
        Sound.sfx.select();
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LV', s.level + 1 + '/' + (s.hard ? LEVELS2 : LEVELS).length);
      const lv = s.lv;
      const CELL = Math.min(36, Math.floor(272 / lv.w), Math.floor(360 / lv.h));
      const X0 = (300 - lv.w * CELL) / 2, Y0 = 40 + Math.round((440 - lv.h * CELL) / 2);
      // 地板
      for (let y = 0; y < lv.h; y++)
        for (let x = 0; x < lv.w; x++)
          g.rect(X0 + x * CELL, Y0 + y * CELL, CELL, CELL, (x + y) % 2 ? '#141234' : '#171440');
      // 目标
      for (const t of lv.targets) {
        const [x, y] = t.split(',').map(Number);
        const cx = X0 + x * CELL + CELL / 2, cy = Y0 + y * CELL + CELL / 2;
        g.frame(cx - CELL / 2 + 5, cy - CELL / 2 + 5, CELL - 10, CELL - 10, '#2de2ff88', 1);
        g.rect(cx - 3, cy - 3, 6, 6, '#2de2ff');
      }
      // 墙
      for (const w2 of lv.walls) {
        const [x, y] = w2.split(',').map(Number);
        g.block(X0 + x * CELL, Y0 + y * CELL, CELL, CELL, '#7c8aa8');
        g.frame(X0 + x * CELL + 3, Y0 + y * CELL + 3, CELL - 6, CELL - 6, '#b8c4dd', 2);
      }
      // 箱子
      for (const b of lv.boxes) {
        const [x, y] = b.split(',').map(Number);
        const on = lv.targets.has(b);
        g.block(X0 + x * CELL + 2, Y0 + y * CELL + 2, CELL - 4, CELL - 4, on ? '#30a86e' : '#a14e2c');
        g.rect(X0 + x * CELL + 5, Y0 + y * CELL + 5, CELL - 10, 3, on ? '#7fe0ae' : '#d97b4a');
        g.rect(X0 + x * CELL + CELL / 2 - 2, Y0 + y * CELL + 5, 4, CELL - 10, on ? '#1d6e46' : '#6e3518');
        g.rect(X0 + x * CELL + 5, Y0 + y * CELL + CELL / 2 - 2, CELL - 10, 4, on ? '#1d6e46' : '#6e3518');
      }
      // 玩家（小机器人，带朝向）
      const p = lv.player;
      const px = X0 + p.x * CELL, py = Y0 + p.y * CELL;
      g.block(px + 4, py + 4, CELL - 8, CELL - 8, '#ffd60a');
      g.rect(px + CELL / 2 - 2, py - 3, 4, 7, '#ffd60a');
      const eye = 3;
      if (s.dir === 'left') g.rect(px + 8, py + 10, eye, eye, '#1a1a2e');
      else if (s.dir === 'right') g.rect(px + CELL - 11, py + 10, eye, eye, '#1a1a2e');
      else if (s.dir === 'up') { g.rect(px + 9, py + 8, eye, eye, '#1a1a2e'); g.rect(px + CELL - 12, py + 8, eye, eye, '#1a1a2e'); }
      else { g.rect(px + 9, py + 14, eye, eye, '#1a1a2e'); g.rect(px + CELL - 12, py + 14, eye, eye, '#1a1a2e'); }
      // 信息
      g.text('MOVES ' + s.moves, 6, 34, '#9aa0ff', 1);
      g.text('UNDO B / RETRY SPACE', 294, 34, '#5d628f', 1, { right: true });
      if (s.undo.length === 0) g.text('B 撤销 · 空格重开本关', 150, 490, '#5d628f', 1, { center: true });
    },
  };
  }

  window.registerGame(makeSokobanDef(false));
  window.registerGame(makeSokobanDef(true));

  function loadLevel(s, idx) {
    s.level = idx;
    const table = s.hard ? LEVELS2 : LEVELS;
    const parsed = parseLevel(table[idx]);
    s.lv = { w: parsed.w, h: parsed.h, walls: parsed.walls, targets: parsed.targets, boxes: parsed.boxes, player: parsed.player };
    s.undo = [];
    s.moves = 0;
  }
})();
