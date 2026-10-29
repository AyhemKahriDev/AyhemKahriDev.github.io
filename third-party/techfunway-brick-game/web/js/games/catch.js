/* ============ 接宝达人 ============ */
(function () {
  const U = window.GameUtil;
  const FLOOR = 462, CART_W = 48, CART_H = 20, CART_Y = FLOOR - CART_H;

  function makeCatchDef(hard) {
    return {
    id: hard ? 'catchII' : 'catch',
    name: hard ? '接宝风暴' : '接宝达人',
    en: hard ? 'CATCH II' : 'CATCH',
    desc: hard ? '极速掉落 · 双倍得分' : '接金币宝石 · 躲开炸弹',
    color: hard ? '#ff4d5e' : '#ffd60a',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.3, y + s * 2.2, s * 2.4, s * 0.7, '#00e5ff');
      g.block(x + s * 0.9, y + s * 1.6, s * 1.2, s * 0.6, '#0077aa');
      const dy = (t * 40) % (s * 2);
      g.text('♥', x + s * 1.1, y + s * 0.2 + dy, '#ffd60a', 2, { glow: 4 });
      g.block(x + s * 2.4, y + s * 0.1 + ((t * 30) % (s * 2.4)), s * 0.45, s * 0.45, '#ff4d5e');
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        px: 150, lives: hard ? 2 : 3, items: [], spawnT: 0.5,
        combo: 0, bestCombo: 0, inv: 0, scoreMul: hard ? 2 : 1, hard,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.level = 1 + Math.floor(s.score / 150);
      // 推车移动
      const v = 230;
      if (Input.held.left) s.px -= v * dt;
      if (Input.held.right) s.px += v * dt;
      if (Input.pointer && Input.pointer.inside) s.px = Input.pointer.x;
      s.px = U.clamp(s.px, CART_W / 2, 300 - CART_W / 2);
      s.inv = Math.max(0, s.inv - dt);
      // 生成掉落物
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        const roll = Math.random();
        const kind = roll < 0.62 ? 'coin' : roll < (s.hard ? 0.74 : 0.76) ? 'gem' : 'bomb';
        s.items.push({
          kind, x: 16 + Math.random() * 268, y: 36,
          v: (95 + s.level * 13 + s.speed * 4) * (0.8 + Math.random() * 0.5) * (s.hard ? 1.15 : 1),
          sway: Math.random() * Math.PI * 2,
        });
        s.spawnT = Math.max(0.24, (1.05 - s.level * 0.06) * (s.hard ? 0.72 : 1)) * (0.55 + Math.random() * 0.9);
      }
      // 掉落与判定
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i];
        it.y += it.v * dt;
        it.x += Math.sin(g.t * 2 + it.sway) * 9 * dt;
        if (it.y > FLOOR) { // 落地
          s.items.splice(i, 1);
          if (it.kind !== 'bomb' && s.combo >= 3) g.toast('COMBO 断了', s.px, FLOOR - 26, '#6a6ea8', 1);
          if (it.kind !== 'bomb') s.combo = 0;
          continue;
        }
        // 与推车相交
        if (it.y + 7 >= CART_Y && it.y < CART_Y + CART_H + 4 && Math.abs(it.x - s.px) < CART_W / 2 + 5) {
          s.items.splice(i, 1);
          if (it.kind === 'bomb') {
            if (s.inv <= 0) {
              s.lives--; s.inv = 1.5; s.combo = 0;
              Sound.sfx.boom();
              g.shake(6); g.flash('#ff3b3055', 0.5);
              g.burst(s.px, CART_Y, '#ff4d5e', 22, 160);
              if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
            }
          } else {
            s.combo++;
            s.bestCombo = Math.max(s.bestCombo, s.combo);
            const base = it.kind === 'gem' ? 30 : 10;
            const mult = 1 + Math.floor(s.combo / 5);
            const pts = base * mult * s.scoreMul;
            s.score += pts;
            Sound.sfx.coin();
            g.burst(it.x, CART_Y, it.kind === 'gem' ? '#00e5ff' : '#ffd60a', it.kind === 'gem' ? 14 : 8, 100);
            if (mult > 1 && s.combo % 5 === 0) {
              g.toast('COMBO x' + mult, s.px, CART_Y - 30, '#ff7ab8', 2);
              Sound.sfx.levelup();
            }
          }
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 背景集市帐篷
      for (let i = 0; i < 6; i++) {
        const tx = 8 + i * 50;
        g.rect(tx, 34, 40, 6, ['#ff4d5e', '#ffd60a', '#30ff8e', '#3f8cff'][i % 4] + '55');
      }
      // 地面
      g.rect(0, FLOOR, 300, 500 - FLOOR, '#1d4a26');
      g.rect(0, FLOOR, 300, 2, '#30ff8e66');
      // 掉落物
      for (const it of s.items) {
        const wob = Math.sin(g.t * 6 + it.sway) * 2;
        if (it.kind === 'coin') {
          g.block(it.x - 5 + wob * 0.3, it.y - 5, 10, 10, '#ffd60a');
          g.rect(it.x - 2 + wob * 0.3, it.y - 2, 4, 4, '#fff2b8');
        } else if (it.kind === 'gem') {
          g.block(it.x - 6 + wob * 0.3, it.y - 6, 12, 12, '#00e5ff');
          g.rect(it.x - 3 + wob * 0.3, it.y - 3, 4, 4, '#d8f8ff');
        } else {
          g.block(it.x - 6 + wob * 0.3, it.y - 5, 12, 11, '#2a2a3e');
          g.rect(it.x - 2 + wob * 0.3, it.y - 10, 3, 4, '#8a5a2c');
          g.rect(it.x - 2 + wob * 0.3, it.y - 13, 3, 3, Math.sin(g.t * 14) > 0 ? '#ffd60a' : '#ff7700');
          g.rect(it.x - 4 + wob * 0.3, it.y - 2, 3, 3, '#ff2222');
          g.rect(it.x + 1 + wob * 0.3, it.y - 2, 3, 3, '#ff2222');
        }
      }
      // 推车（无敌时闪烁）
      if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
        g.block(s.px - CART_W / 2, CART_Y, CART_W, CART_H, '#00e5ff');
        g.block(s.px - CART_W / 2 + 4, CART_Y + 3, CART_W - 8, 6, '#0077aa');
        g.rect(s.px - CART_W / 2 + 2, CART_Y - 4, CART_W - 4, 5, '#0c5aa8');
        // 车轮
        g.rect(s.px - CART_W / 2 + 6, FLOOR - 4, 8, 4, '#1a1a2e');
        g.rect(s.px + CART_W / 2 - 14, FLOOR - 4, 8, 4, '#1a1a2e');
      }
      // 连击
      if (s.combo >= 2) g.text('COMBO ' + s.combo, 150, 34, '#ff7ab8', 1, { center: true, glow: 4 });
    },
  };
  }

  window.registerGame(makeCatchDef(false));
  window.registerGame(makeCatchDef(true));
})();
