/* ============ 青蛙过河 ============ */
(function () {
  const U = window.GameUtil;
  const COLS = 10, ROWS = 12, CELL = 30;
  const X0 = (300 - COLS * CELL) / 2, Y0 = 30 + Math.round((470 - ROWS * CELL) / 2);
  // 行定义（从上到下 row0）：0 目标行 1-3 河道 4 中岸 5-7 公路 8 中岸 9-11 草地起点
  // 速度单位：格/秒
  const LANES = [
    { row: 1, type: 'river', dir: 1, speed: 1.1, len: 3, gap: 4 },
    { row: 2, type: 'river', dir: -1, speed: 1.4, len: 2, gap: 3 },
    { row: 3, type: 'river', dir: 1, speed: 1.7, len: 4, gap: 3 },
    { row: 5, type: 'road', dir: -1, speed: 1.5, len: 2, gap: 3 },
    { row: 6, type: 'road', dir: 1, speed: 1.8, len: 2, gap: 4 },
    { row: 7, type: 'road', dir: -1, speed: 2.1, len: 3, gap: 3 },
  ];
  const GOAL_SLOTS = [1, 3, 5, 7, 9]; // 目标格位

  function makeFroggerDef(hard) {
    return {
    id: hard ? 'froggerII' : 'frogger',
    name: hard ? '青蛙过河II' : '青蛙过河',
    en: hard ? 'FROGGER II' : 'FROGGER',
    desc: hard ? '激流加速 · 双倍得分' : '躲车流踩浮木 · 送青蛙回家',
    color: hard ? '#ffd60a' : '#30ff8e',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.2, y + s * 1.4, s * 2.6, s * 0.5, '#2de2ff55');
      g.block(x + s * 0.4, y + s * 2.2, s * 1.4, s * 0.45, '#a14e2c');
      const fy = y + s * 0.3 + Math.sin(t * 4) * 3;
      g.block(x + s * 1.1, fy, s * 0.9, s * 0.8, '#30ff8e');
      g.rect(x + s * 1.25, fy + s * 0.15, s * 0.2, s * 0.2, '#0b0a1e');
      g.rect(x + s * 1.65, fy + s * 0.15, s * 0.2, s * 0.2, '#0b0a1e');
    },
    start(env) {
      const lanes = LANES.map((l) => ({ ...l, items: [], off: Math.random() * 10 }));
      for (const l of lanes) spawnItems(l);
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        frog: { x: 4.5, y: ROWS - 1, hop: 0 },
        lanes, lives: hard ? 2 : 3, saved: [false, false, false, false, false],
        deadT: 0, hopT: 0, scoreMul: hard ? 2 : 1, spdMul: hard ? 1.3 : 1,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      const spd = (1 + (s.level - 1) * 0.22 + s.speed * 0.04) * s.spdMul;
      // 车流/浮木滚动
      for (const l of s.lanes) {
        for (const it of l.items) {
          it.x += l.dir * l.speed * spd * dt;
          if (l.dir > 0 && it.x > COLS + 0.5) it.x = -it.len - Math.random() * l.gap;
          if (l.dir < 0 && it.x + it.len < -0.5) it.x = COLS + Math.random() * l.gap;
        }
      }
      // 跳跃输入
      s.hopT = Math.max(0, s.hopT - dt * 5);
      const F = s.frog;
      const hop = (dx, dy) => {
        F.x = U.clamp(F.x + dx, 0.1, COLS - 1.1);
        F.y = U.clamp(F.y + dy, 0, ROWS - 1);
        s.hopT = 1;
        Sound.sfx.jump();
      };
      if (s.deadT > 0) {
        s.deadT -= dt;
        if (s.deadT <= 0) { F.x = 4.5; F.y = ROWS - 1; }
        return;
      }
      if (Input.took('up')) hop(0, -1);
      if (Input.took('down')) hop(0, 1);
      if (Input.took('left')) hop(-1, 0);
      if (Input.took('right')) hop(1, 0);
      const lane = s.lanes.find((l) => l.row === F.y);
      if (lane) {
        if (lane.type === 'road') {
          // 被车撞
          for (const it of lane.items) {
            if (F.x + 0.75 > it.x && F.x + 0.25 < it.x + it.len) {
              killFrog(s, g, '#ff4d5e');
              return;
            }
          }
        } else {
          // 河上要站浮木
          let on = null;
          for (const it of lane.items)
            if (F.x + 0.6 > it.x && F.x + 0.4 < it.x + it.len) { on = it; break; }
          if (!on) { killFrog(s, g, '#2de2ff'); return; }
          F.x += lane.dir * lane.speed * spd * dt; // 被浮木带动（格/秒）
          if (F.x < -0.2 || F.x > COLS - 0.8) { killFrog(s, g, '#2de2ff'); return; }
        }
      }
      // 到达目标行
      if (F.y === 0) {
        const slot = Math.round(F.x);
        const idx = s.saved.findIndex((sv, i) => !sv && Math.abs(GOAL_SLOTS[i] - slot) <= 1);
        if (idx >= 0) {
          s.saved[idx] = true;
          s.score += 100 * s.level * s.scoreMul;
          Sound.sfx.coin();
          g.burst(X0 + F.x * CELL + CELL / 2, Y0 + CELL / 2, '#30ff8e', 20, 130);
          if (s.saved.every(Boolean)) {
            s.level++;
            s.saved = [false, false, false, false, false];
            s.score += 300 * s.scoreMul;
            Sound.sfx.win();
            g.toast('LEVEL UP!', 150, 180, '#ffd60a', 3);
            g.flash('#30ff8e33', 0.4);
          } else g.toast('+', X0 + F.x * CELL + CELL / 2, Y0 - 8, '#30ff8e', 2);
          F.x = 4.5; F.y = ROWS - 1;
        } else {
          killFrog(s, g, '#ffd60a'); // 落进已占/空隙
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 目标行
      g.rect(X0, Y0, COLS * CELL, CELL, '#123a1e');
      s.saved.forEach((sv, i) => {
        const gx = X0 + GOAL_SLOTS[i] * CELL;
        g.frame(gx, Y0 + 2, CELL, CELL - 4, sv ? '#30ff8e' : '#30ff8e55', 1);
        if (sv) {
          g.block(gx + 4, Y0 + 5, CELL - 8, CELL - 10, '#b8ffd4');
          g.rect(gx + 8, Y0 + 9, 3, 3, '#0b0a1e');
          g.rect(gx + 14, Y0 + 9, 3, 3, '#0b0a1e');
        }
      });
      // 河道
      for (const l of s.lanes.filter((l) => l.type === 'river')) {
        g.rect(X0, Y0 + l.row * CELL, COLS * CELL, CELL, '#0a2a52');
        for (let i = 0; i < 10; i++)
          g.rect(X0 + ((i * 37 + g.t * 20 * l.dir) % (COLS * CELL)), Y0 + l.row * CELL + 8 + (i % 3) * 4, 8, 2, '#2de2ff33');
      }
      // 浮木
      for (const l of s.lanes) {
        for (const it of l.items) {
          if (l.type === 'river') {
            g.block(X0 + it.x * CELL, Y0 + l.row * CELL + 3, it.len * CELL - 4, CELL - 6, '#8a5a2c');
            g.rect(X0 + it.x * CELL + 3, Y0 + l.row * CELL + 6, it.len * CELL - 10, 3, '#c98b4f');
          } else {
            const colors = ['#ff4d5e', '#ffd60a', '#b455ff', '#ff9f40'];
            const c = colors[l.row % 4];
            g.block(X0 + it.x * CELL + 2, Y0 + l.row * CELL + 3, it.len * CELL - 4, CELL - 6, c);
            g.rect(X0 + it.x * CELL + 6, Y0 + l.row * CELL + CELL - 8, 5, 5, '#0b0a1e');
            g.rect(X0 + (it.x + it.len) * CELL - 12, Y0 + l.row * CELL + CELL - 8, 5, 5, '#0b0a1e');
          }
        }
      }
      // 草地区域（row8 安全带 + 起点区）
      g.rect(X0, Y0 + 4 * CELL, COLS * CELL, CELL, '#1d4a26');
      g.rect(X0, Y0 + 8 * CELL, COLS * CELL, CELL, '#1d4a26');
      g.rect(X0, Y0 + 9 * CELL, COLS * CELL, 2 * CELL, '#123018');
      g.rect(X0, Y0 + (ROWS - 1) * CELL, COLS * CELL, CELL, '#256030');
      for (let i = 0; i < 12; i++) {
        g.rect(X0 + ((i * 29) % (COLS * CELL - 6)), Y0 + 8 * CELL + 4 + (i % 4) * 4, 3, 6, '#30ff8e33');
      }
      // 青蛙
      const F = s.frog;
      if (s.deadT <= 0) {
        const fx = X0 + F.x * CELL + CELL / 2, fy = Y0 + F.y * CELL + CELL / 2;
        const sc = 1 + s.hopT * 0.35;
        const w = 17 * sc, h = 14 * sc;
        g.block(fx - w / 2, fy - h / 2 - s.hopT * 3, w, h, '#30ff8e');
        g.rect(fx - w / 2 + 3, fy - h / 2 - s.hopT * 3 + 3, 4, 4, '#0b0a1e');
        g.rect(fx + w / 2 - 7, fy - h / 2 - s.hopT * 3 + 3, 4, 4, '#0b0a1e');
      } else {
        // 死亡星星
        const fx = X0 + F.x * CELL + CELL / 2, fy = Y0 + F.y * CELL + CELL / 2;
        for (let i = 0; i < 5; i++) {
          const a = g.t * 9 + i * 1.3;
          g.rect(fx + Math.cos(a) * 10, fy + Math.sin(a) * 10, 4, 4, '#ffd60a');
        }
      }
      // 边框
      g.frame(X0 - 3, Y0 - 3, COLS * CELL + 6, ROWS * CELL + 6, '#2de2ff44', 2);
    },
  };
  }

  window.registerGame(makeFroggerDef(false));
  window.registerGame(makeFroggerDef(true));

  function spawnItems(l) {
    let x = -Math.random() * 4;
    while (x < COLS + 1) {
      l.items.push({ x, len: l.len });
      x += l.len + l.gap * 0.4 + Math.random() * 2.2;
    }
  }

  function killFrog(s, g, color) {
    s.lives--;
    s.deadT = 0.9;
    Sound.sfx.die();
    g.shake(4);
    g.burst(X0 + s.frog.x * CELL + CELL / 2, Y0 + s.frog.y * CELL + CELL / 2, color, 18, 140);
    if (s.lives <= 0) { s.over = true; Sound.sfx.over(); }
  }
})();
