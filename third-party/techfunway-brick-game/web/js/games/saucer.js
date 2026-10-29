/* ============ 飞碟射击（打靶场）============ */
(function () {
  const U = window.GameUtil;
  // 6x3 悬停点位
  const COLS = 6, ROWS = 3;
  const CELL = 42;
  const X0 = (300 - COLS * CELL) / 2, Y0 = 96;

  function makeSaucerDef(hard) {
    return {
    id: hard ? 'saucerII' : 'saucer',
    name: hard ? '飞碟射击II' : '飞碟射击',
    en: hard ? 'SAUCER II' : 'SAUCER',
    desc: hard ? '疾速现身 · 仅容5次脱靶' : '瞄准飞碟 · 别让它们溜走',
    color: hard ? '#ff4d5e' : '#30ff8e',
    music: 'battle',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.4, y + s * 1.2 + Math.sin(t * 4) * 2, s * 2.2, s * 0.6, '#30ff8e');
      g.block(x + s * 1.0, y + s * 0.6 + Math.sin(t * 4) * 2, s * 1.0, s * 0.6, '#b8ffd4');
      g.text('+', x + s * 2.9, y + s * 0.4, '#ffd60a', 3, { glow: 6 });
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        cx: 2, cy: 1,            // 准星格位
        saucers: [],             // {c,r,t,hover,golden}
        spawnT: 0.6, fireCd: 0,
        escapes: 0, maxEscapes: hard ? 5 : 6,
        muzzle: 0, hitFlash: 0, hard,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.level = 1 + Math.floor(s.score / 120);
      // 准星移动（格子步进）
      if (Input.took('left')) { s.cx = (s.cx + COLS - 1) % COLS; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cx = (s.cx + 1) % COLS; Sound.sfx.menu(); }
      if (Input.took('up')) { s.cy = (s.cy + ROWS - 1) % ROWS; Sound.sfx.menu(); }
      if (Input.took('down')) { s.cy = (s.cy + 1) % ROWS; Sound.sfx.menu(); }
      // 触屏/鼠标：准星跟随
      if (Input.pointer && Input.pointer.inside) {
        const c = Math.floor((Input.pointer.x - X0) / CELL);
        const r = Math.floor((Input.pointer.y - Y0) / CELL);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) { s.cx = c; s.cy = r; }
      }
      // 生成飞碟
      s.spawnT -= dt;
      const maxLive = Math.min(5, 1 + Math.floor(s.level / 2) + (s.hard ? 1 : 0));
      if (s.spawnT <= 0 && s.saucers.length < maxLive) {
        const free = [];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (!s.saucers.some((u) => u.c === c && u.r === r)) free.push([c, r]);
        if (free.length) {
          const [c, r] = free[U.ri(free.length)];
          s.saucers.push({ c, r, hover: hoverTime(s, s.hard), golden: Math.random() < 0.1 });
        }
        s.spawnT = Math.max(0.3, (1.3 - s.level * 0.09) * (s.hard ? 0.75 : 1)) * (0.6 + Math.random() * 0.8);
      }
      // 飞碟计时，到点飞走
      for (let i = s.saucers.length - 1; i >= 0; i--) {
        const u = s.saucers[i];
        u.hover -= dt;
        if (u.hover <= 0) {
          s.saucers.splice(i, 1);
          s.escapes++;
          Sound.sfx.hit();
          if (s.escapes >= s.maxEscapes) {
            s.over = true;
            Sound.sfx.over();
            g.shake(5);
          }
        }
      }
      // 开火
      s.fireCd -= dt;
      s.muzzle = Math.max(0, s.muzzle - dt * 6);
      s.hitFlash = Math.max(0, s.hitFlash - dt * 5);
      if ((Input.took('a') || Input.took('drop')) && s.fireCd <= 0) {
        s.fireCd = Math.max(0.18, 0.4 - s.level * 0.02);
        s.muzzle = 1;
        Sound.sfx.shoot();
        const idx = s.saucers.findIndex((u) => u.c === s.cx && u.r === s.cy);
        if (idx >= 0) {
          const u = s.saucers[idx];
          s.saucers.splice(idx, 1);
          const pts = u.golden ? 100 : 20;
          s.score += pts;
          s.hitFlash = 1;
          Sound.sfx.boom();
          const px = X0 + u.c * CELL + CELL / 2, py = Y0 + u.r * CELL + CELL / 2;
          g.burst(px, py, u.golden ? '#ffd60a' : '#30ff8e', u.golden ? 26 : 14, 150);
          g.toast(u.golden ? 'GOLD +' + pts : '+' + pts, px, py - 14, u.golden ? '#ffd60a' : '#ffffff', 2);
          if (u.golden) g.shake(3);
        }
      }
    },
    draw(s, g) {
      g.clear('#08071a');
      g.hud(s.score, s.hi, 'MISS', s.escapes + '/' + s.maxEscapes);
      // 星空点缀
      for (let i = 0; i < 26; i++) {
        const sx = (i * 61 + Math.floor(g.t * 4) * 7) % 296 + 2;
        const sy = 42 + (i * 37) % 260;
        g.rect(sx, sy, 1.5, 1.5, 'rgba(255,255,255,0.22)');
      }
      // 点位网格
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          g.frame(X0 + c * CELL + 6, Y0 + r * CELL + 6, CELL - 12, CELL - 12, 'rgba(48,255,142,0.10)', 1);
      // 地面草地
      g.rect(0, Y0 + ROWS * CELL + 6, 300, 500 - (Y0 + ROWS * CELL + 6), '#123018');
      for (let i = 0; i < 14; i++)
        g.rect(8 + i * 21, Y0 + ROWS * CELL + 12 + (i % 3) * 6, 3, 7, '#30ff8e44');
      // 飞碟
      for (const u of s.saucers) {
        const px = X0 + u.c * CELL + CELL / 2, py = Y0 + u.r * CELL + CELL / 2;
        const urgent = u.hover < 0.7 && Math.sin(g.t * 16) > 0;
        const body = u.golden ? '#ffd60a' : (urgent ? '#ff4d5e' : '#30ff8e');
        const bob = Math.sin(g.t * 5 + u.c * 2 + u.r) * 2;
        g.block(px - 13, py - 3 + bob, 26, 8, body);
        g.block(px - 6, py - 9 + bob, 12, 6, u.golden ? '#fff2b8' : '#b8ffd4');
        g.rect(px - 9, py + 5 + bob, 4, 3, body + '88');
        g.rect(px + 5, py + 5 + bob, 4, 3, body + '88');
        // 剩余时间条
        g.rect(px - 12, py + 11, 24 * Math.max(0, u.hover / 2.4), 2, '#ffffff55');
      }
      // 枪口火光 + 弹道
      const gx = X0 + s.cx * CELL + CELL / 2, gy = Y0 + s.cy * CELL + CELL / 2;
      if (s.muzzle > 0) {
        g.ctx.save();
        g.ctx.globalAlpha = s.muzzle * 0.5;
        g.rect(gx - 1, gy, 2, 500 - gy, '#ffffff');
        g.ctx.restore();
      }
      // 准星
      const cxp = X0 + s.cx * CELL + CELL / 2, cyp = Y0 + s.cy * CELL + CELL / 2;
      const cc = s.hitFlash > 0 ? '#ffffff' : '#ffd60a';
      g.frame(cxp - 10, cyp - 10, 20, 20, cc, 1);
      g.rect(cxp - 1, cyp - 14, 2, 6, cc);
      g.rect(cxp - 1, cyp + 8, 2, 6, cc);
      g.rect(cxp - 14, cyp - 1, 6, 2, cc);
      g.rect(cxp + 8, cyp - 1, 6, 2, cc);
      // 操作提示
      g.text('A FIRE', 150, 490, '#2de2ff', 1, { center: true });
    },
  };
  }

  function hoverTime(s, hard) {
    return Math.max(hard ? 0.7 : 0.85, (hard ? 1.9 : 2.4) - s.level * (hard ? 0.17 : 0.14)) * (0.75 + Math.random() * 0.5);
  }

  window.registerGame(makeSaucerDef(false));
  window.registerGame(makeSaucerDef(true));
})();
