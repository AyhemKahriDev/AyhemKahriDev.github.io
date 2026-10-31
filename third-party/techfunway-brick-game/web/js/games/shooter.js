/* ============ 星际打飞机 ============ */
(function () {
  const U = window.GameUtil;
  const COLS = 12, CELL = 24, X0 = (300 - COLS * CELL) / 2;

  function spawnWaveFn(s) {
    s.wave++;
    s.level = s.wave;
    s.aliens = [];
    const rows = Math.min(5, 2 + Math.floor(s.wave / 2) + (s.hard ? 1 : 0)), cols = 6;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        s.aliens.push({ x: 30 + c * 44, y: 40 + r * 30, r, alive: true, kind: U.ri(3) });
    s.stepIv = Math.max(0.16, (0.8 - s.wave * 0.06 - s.speed * 0.03) * (s.hard ? 0.82 : 1));
    s.stepT = 0;
    s.spawnFlash = 0.4;
  }

  function makeShooterDef(hard) {
    return {
    id: hard ? 'shooterII' : 'shooter',
    name: hard ? '星际打飞机II' : '星际打飞机',
    en: hard ? 'INVADERS II' : 'INVADERS',
    desc: hard ? '蜂群压境 · 火力翻倍' : '击落敌机 · 别让它们降落',
    color: hard ? '#ff4d5e' : '#ff7ab8',
    music: 'battle',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.9, y + s * 1.7, s * 1.2, s * 0.7, '#00e5ff');
      g.block(x + s * 1.2, y + s * 1.2, s * 0.6, s * 0.5, '#b8f4ff');
      [[0.2, 0.3], [1.4, 0.3], [2.4, 0.8]].forEach(([cx, cy], i) =>
        g.block(x + cx * s, y + cy * s + Math.sin(t * 4 + i) * 2, s * 0.6, s * 0.6, '#ff4d5e'));
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0, wave: 0,
        px: 150, aliens: [], bullets: [], bombs: [],
        stepT: 0, fireCd: 0, lives: hard ? 2 : 3, inv: 0, spawnFlash: 0,
        scoreMul: hard ? 2 : 1, hard,
        stars: Array.from({ length: 40 }, () => ({ x: Math.random() * 300, y: Math.random() * 500, v: 8 + Math.random() * 30 })),
      };
    },
    update(s, dt, g) {
      // 星空
      for (const st of s.stars) { st.y += st.v * dt; if (st.y > 500) { st.y = -2; st.x = Math.random() * 300; } }
      if (s.over) return;
      if (!s.aliens.length) { spawnWaveFn(s); Sound.sfx.levelup(); g.toast('WAVE ' + s.wave, 150, 220, '#ff7ab8', 3); return; }
      // 玩家移动
      const v = 210;
      if (Input.held.left) s.px -= v * dt;
      if (Input.held.right) s.px += v * dt;
      s.px = U.clamp(s.px, X0, X0 + COLS * CELL - 20);
      s.inv = Math.max(0, s.inv - dt);
      // 开火
      s.fireCd -= dt;
      if ((Input.held.drop || Input.held.a || Input.held.up) && s.fireCd <= 0 && s.bullets.length < 3) {
        s.bullets.push({ x: s.px + 10 - 1.5, y: 452 });
        s.fireCd = 0.18;
        Sound.sfx.shoot();
      }
      // 敌机整体下压
      s.stepT += dt;
      if (s.stepT >= s.stepIv) {
        s.stepT = 0;
        for (const a of s.aliens) a.y += 9;
        // 随机投弹
        if (Math.random() < (s.hard ? 0.68 : 0.5) + s.wave * 0.04) {
          const alive = s.aliens;
          const a = alive[U.ri(alive.length)];
          s.bombs.push({ x: a.x + 9, y: a.y + 16 });
        }
      }
      // 子弹
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.y -= 460 * dt;
        if (b.y < 20) { s.bullets.splice(i, 1); continue; }
        for (const a of s.aliens) {
          if (a.alive && b.x > a.x - 2 && b.x < a.x + 20 && b.y > a.y && b.y < a.y + 16) {
            a.alive = false;
            s.bullets.splice(i, 1);
            s.score += Math.round((20 + s.wave * 5) * s.scoreMul);
            Sound.sfx.boom();
            g.burst(a.x + 10, a.y + 8, '#ff7ab8', 16, 140);
            g.burst(a.x + 10, a.y + 8, '#ffd60a', 8, 100);
            if (Math.random() < 0.12) { s.score += 50; g.toast('+50', a.x + 10, a.y, '#ffd60a', 2); }
            break;
          }
        }
      }
      s.aliens = s.aliens.filter((a) => a.alive);
      // 敌弹
      for (let i = s.bombs.length - 1; i >= 0; i--) {
        const b = s.bombs[i];
        b.y += (170 + s.wave * 12) * dt;
        if (b.y > 500) { s.bombs.splice(i, 1); continue; }
        if (s.inv <= 0 && b.x > s.px && b.x < s.px + 20 && b.y > 452 && b.y < 486) {
          s.bombs.splice(i, 1);
          s.lives--; s.inv = 1.8;
          Sound.sfx.hit(); g.shake(4); g.flash('#ff3b3055', 0.45);
          g.burst(s.px + 10, 462, '#00e5ff', 20, 150);
          if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
        }
      }
      // 敌机抵达底线
      for (const a of s.aliens) {
        if (a.y > 440) {
          s.over = true;
          Sound.sfx.over();
          g.shake(6); g.flash('#ff3b3077', 0.6);
          return;
        }
      }
    },
    draw(s, g) {
      g.clear('#08071a');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 星空
      for (const st of s.stars) {
        g.rect(st.x, st.y, 1.6, 1.6, `rgba(255,255,255,${0.25 + st.v / 60})`);
      }
      // 敌机（三款造型）
      for (const a of s.aliens) {
        const cols = ['#ff4d5e', '#b455ff', '#ff9f40'];
        const c = cols[a.kind];
        const pulse = Math.sin(g.t * 8 + a.x) > 0;
        g.block(a.x, a.y + 4, 20, 10, c);
        g.block(a.x + 4, a.y, 12, 6, c);
        g.block(a.x + (pulse ? 0 : 14), a.y + 6, 6, 6, c);
        g.rect(a.x + 6, a.y + 6, 3, 3, '#0b0a1e');
        g.rect(a.x + 11, a.y + 6, 3, 3, '#0b0a1e');
      }
      // 子弹 / 炸弹
      for (const b of s.bullets) {
        g.rect(b.x, b.y, 3, 10, '#00e5ff');
        g.rect(b.x, b.y - 4, 3, 4, '#00e5ff55');
      }
      for (const b of s.bombs) {
        g.rect(b.x, b.y, 3, 8, '#ffd60a');
        g.rect(b.x - 1, b.y + 9, 5, 3, '#ff7700');
      }
      // 玩家飞机
      if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
        const x = s.px, y = 452;
        g.block(x + 6, y, 8, 14, '#b8f4ff');
        g.block(x, y + 12, 20, 10, '#00e5ff');
        g.block(x - 4, y + 16, 4, 6, '#00e5ff');
        g.block(x + 20, y + 16, 4, 6, '#00e5ff');
        // 尾焰
        g.rect(x + 8, y + 22, 4, 5 + Math.random() * 6, '#ffd60a');
        if (s.wave > 0 && s.spawnFlash > 0) g.toast('WAVE ' + s.wave, 150, 220, '#ff7ab8', 3);
      }
      // 警戒线
      g.rect(X0, 448, COLS * CELL, 1, '#ff3b3066');
    },
  };
  }

  window.registerGame(makeShooterDef(false));
  window.registerGame(makeShooterDef(true));
})();
