/* ============ 打砖块 ============ */
(function () {
  const U = window.GameUtil;
  const COLS = 10, BW = 26, BH = 14, X0 = (300 - COLS * BW) / 2, Y0 = 60;

  const ROW_COLORS = ['#ff4d5e', '#ff9f40', '#ffd60a', '#30ff8e', '#00e5ff', '#3f8cff', '#b455ff', '#ff7ab8'];

  function makeBreakoutDef(hard) {
    return {
    id: hard ? 'breakoutII' : 'breakout',
    name: hard ? '打砖块狂热' : '霓虹打砖块',
    en: hard ? 'BREAKOUT II' : 'BREAKOUT',
    desc: hard ? '球速更快 · 双倍得分' : '弹球消砖 · 指尖也能拖动挡板',
    color: hard ? '#ff4d5e' : '#00e5ff',
    music: 'chill',
    icon(g, x, y, s, t) {
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          g.block(x + s * (0.3 + c * 0.9), y + s * (0.3 + r * 0.6), s * 0.8, s * 0.5, ROW_COLORS[r * 2]);
      g.block(x + s * 1.1, y + s * 2.6, s * 1.2, s * 0.4, '#00e5ff');
      const bx = x + s * (0.9 + Math.sin(t * 5) * 0.7), by = y + s * (1.9 + Math.cos(t * 7) * 0.3);
      g.block(bx, by, s * 0.4, s * 0.4, '#ffffff');
    },
    start(env) {
      const s = {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        lives: hard ? 2 : 3,
        paddle: { x: 137, w: hard ? 46 : 56 },
        ball: { x: 150, y: 0, vx: 0, vy: 0, stuck: true },
        bricks: [], combo: 0, scoreMul: hard ? 2 : 1, spdMul: hard ? 1.14 : 1,
      };
      buildLevel(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      // 挡板
      const v = 260;
      if (Input.held.left) s.paddle.x -= v * dt;
      if (Input.held.right) s.paddle.x += v * dt;
      if (Input.pointer && Input.pointer.inside) s.paddle.x = Input.pointer.x - s.paddle.w / 2;
      s.paddle.x = U.clamp(s.paddle.x, 2, 298 - s.paddle.w);
      // 球
      const b = s.ball;
      if (b.stuck) {
        b.x = s.paddle.x + s.paddle.w / 2;
        b.y = 470 - 16;
        if (Input.took('a') || Input.took('drop') || Input.took('up') || Input.took('start')) {
          b.stuck = false;
          const sp = (230 + s.level * 18 + s.speed * 8) * s.spdMul;
          b.vx = sp * 0.5 * (Math.random() < 0.5 ? -1 : 1);
          b.vy = -sp;
          Sound.sfx.jump();
        }
        return;
      }
      const steps = Math.ceil((Math.abs(b.vx) + Math.abs(b.vy)) * dt / 6);
      for (let st = 0; st < steps; st++) {
        const d = dt / steps;
        b.x += b.vx * d;
        b.y += b.vy * d;
        // 墙
        if (b.x < 4) { b.x = 4; b.vx = Math.abs(b.vx); Sound.sfx.bounce(); }
        if (b.x > 296) { b.x = 296; b.vx = -Math.abs(b.vx); Sound.sfx.bounce(); }
        if (b.y < 36) { b.y = 36; b.vy = Math.abs(b.vy); Sound.sfx.bounce(); }
        // 挡板
        if (b.vy > 0 && b.y > 462 && b.y < 478 && b.x > s.paddle.x - 5 && b.x < s.paddle.x + s.paddle.w + 5) {
          const rel = (b.x - (s.paddle.x + s.paddle.w / 2)) / (s.paddle.w / 2);
          const sp = Math.min(430, Math.hypot(b.vx, b.vy) * 1.015);
          const ang = rel * 1.05 - Math.PI / 2;
          b.vx = Math.cos(ang) * sp;
          b.vy = Math.sin(ang) * sp;
          if (b.vy > -40) b.vy = -40;
          s.combo = 0;
          Sound.sfx.bounce();
          g.burst(b.x, 462, '#00e5ff', 4, 60, 120);
        }
        // 砖块
        for (let i = s.bricks.length - 1; i >= 0; i--) {
          const k = s.bricks[i];
          const bx = X0 + k.c * BW, by = Y0 + k.r * BH + 20;
          if (b.x > bx - 3 && b.x < bx + BW + 3 && b.y > by - 3 && b.y < by + BH + 3) {
            s.bricks.splice(i, 1);
            // 反弹方向按重叠深度
            const dl = b.x - (bx - 3), dr = (bx + BW + 3) - b.x;
            const dtp = b.y - (by - 3), db = (by + BH + 3) - b.y;
            const m = Math.min(dl, dr, dtp, db);
            if (m === dl || m === dr) b.vx = m === dl ? -Math.abs(b.vx) : Math.abs(b.vx);
            else b.vy = m === dtp ? -Math.abs(b.vy) : Math.abs(b.vy);
            s.combo++;
            s.score += Math.round((10 + Math.min(50, s.combo * 5) + (7 - k.r) * 2) * s.scoreMul);
            Sound.sfx.hit();
            g.burst(bx + BW / 2, by + BH / 2, k.c2, 10, 110);
            if (s.combo >= 4) g.toast('COMBO x' + s.combo, b.x, b.y - 14, '#ffd60a', 1);
            break;
          }
        }
        // 掉落
        if (b.y > 505) {
          s.lives--;
          Sound.sfx.die();
          g.shake(4);
          if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
          b.stuck = true;
          s.combo = 0;
          break;
        }
      }
      // 通关
      if (!s.bricks.length) {
        s.level++;
        s.score += 200 * s.scoreMul;
        Sound.sfx.win();
        g.toast('LEVEL ' + s.level, 150, 240, '#ffd60a', 3);
        g.flash('#00e5ff33', 0.4);
        buildLevel(s);
        s.ball.stuck = true;
      }
    },
    draw(s, g) {
      g.clear('#08071a');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 砖块
      for (const k of s.bricks) {
        const bx = X0 + k.c * BW, by = Y0 + k.r * BH + 20;
        g.block(bx + 1, by + 1, BW - 2, BH - 2, k.c2);
      }
      // 边界
      g.frame(1, 34, 298, 468, '#2de2ff44', 2);
      // 挡板（霓虹）
      const p = s.paddle;
      g.block(p.x, 462, p.w, 10, '#00e5ff');
      g.rect(p.x + 6, 464, p.w - 12, 3, '#ffffff66');
      // 球（拖尾）
      const b = s.ball;
      for (let i = 3; i >= 1; i--) {
        g.block(b.x - b.vx * 0.008 * i - 3, b.y - b.vy * 0.008 * i - 3, 6, 6, '#ffffff', 0.25);
      }
      g.block(b.x - 3.5, b.y - 3.5, 7, 7, '#ffffff');
      if (b.stuck) {
        g.text('TAP / SPACE 发射', 150, 430, '#7cf7ff', 1, { center: true });
        g.text('LEVEL ' + s.level, 150, 442, '#9aa0ff', 1, { center: true });
      }
    },
  };
  }

  window.registerGame(makeBreakoutDef(false));
  window.registerGame(makeBreakoutDef(true));

  function buildLevel(s) {
    s.bricks = [];
    const rows = Math.min(8, 4 + s.level + (s.scoreMul > 1 ? 1 : 0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < COLS; c++) {
        if (s.scoreMul > 1 ? (r + c) % 5 === 3 : s.level > 2 && (r + c) % 7 === 3) continue; // 留缺口
        s.bricks.push({ r, c, c2: ROW_COLORS[r % ROW_COLORS.length] });
      }
  }
})();
