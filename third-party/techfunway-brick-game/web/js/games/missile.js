/* ============ 导弹拦截 ============ */
(function () {
  const U = window.GameUtil;
  const GROUND = 468;
  const CITY_X = [30, 72, 114, 186, 228, 270];
  const TURRET_X = 150;

  function makeMissileDef(hard) {
    return {
    id: hard ? 'missileII' : 'missile',
    name: hard ? '全面战争' : '导弹拦截',
    en: hard ? 'MISSILE II' : 'MISSILE',
    desc: hard ? '弹雨翻倍 · 弹速+20%' : '守住城市 · 触屏直接瞄准',
    color: hard ? '#ffd60a' : '#ff4d5e',
    music: 'battle',
    icon(g, x, y, s, t) {
      // 城市天际线
      g.block(x + s * 0.2, y + s * 2.0, s * 0.6, s * 0.8, '#3f8cff');
      g.block(x + s * 0.9, y + s * 1.5, s * 0.6, s * 1.3, '#3f8cff');
      g.block(x + s * 1.6, y + s * 2.0, s * 0.6, s * 0.8, '#3f8cff');
      // 下落导弹
      const my = (t * 26) % (s * 2.2);
      g.rect(x + s * 2.6, y + s * 0.2 + my, 3, 6, '#ff4d5e');
      g.rect(x + s * 2.7, y + s * 0.5 + my, 1, 5, '#ff4d5e66');
      // 拦截爆炸
      const r = s * (0.5 + Math.sin(t * 5) * 0.15);
      g.frame(x + s * 1.1 - r, y + s * 0.9 - r, r * 2, r * 2, '#ffd60a', 2);
    },
    start(env) {
      const s = {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0, wave: 0,
        cities: CITY_X.map((x) => ({ x, alive: true })),
        ammo: 15, cross: { x: 150, y: 200 },
        enemyMissiles: [], interceptors: [], explosions: [],
        spawnT: 0, waveLeft: 0, banner: 2.2, bannerText: '', hard,
      };
      startWave(s);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.banner = Math.max(0, s.banner - dt);
      // 准星
      const v = 190;
      if (Input.held.left) s.cross.x -= v * dt;
      if (Input.held.right) s.cross.x += v * dt;
      if (Input.held.up) s.cross.y -= v * dt;
      if (Input.held.down) s.cross.y += v * dt;
      if (Input.pointer && Input.pointer.inside) {
        s.cross.x = Input.pointer.x;
        s.cross.y = Math.min(Input.pointer.y, GROUND - 6);
      }
      s.cross.x = U.clamp(s.cross.x, 6, 294);
      s.cross.y = U.clamp(s.cross.y, 34, GROUND - 6);
      // 发射拦截弹
      if ((Input.took('a') || Input.took('drop')) && s.ammo > 0) {
        s.ammo--;
        s.interceptors.push({ x: TURRET_X, y: GROUND - 10, tx: s.cross.x, ty: s.cross.y, done: false });
        Sound.sfx.shoot();
      }
      // 敌弹生成
      s.spawnT -= dt;
      if (s.waveLeft > 0 && s.spawnT <= 0) {
        const alive = s.cities.filter((c) => c.alive);
        const tx = alive.length && Math.random() < 0.85 ? alive[U.ri(alive.length)].x : TURRET_X;
        const nm = {
          x: 10 + Math.random() * 280, y: 34, tx,
          trail: [],
          sp: (34 + s.wave * 6 + s.speed * 2) * (s.hard ? 1.2 : 1),
        };
        nm.vx = (tx - nm.x) / ((GROUND - 34) / nm.sp);
        nm.sx = nm.x; nm.sy = nm.y;
        s.enemyMissiles.push(nm);
        s.waveLeft--;
        s.spawnT = Math.max(0.3, 1.15 - s.wave * 0.08) * (0.6 + Math.random() * 0.8);
      }
      // 敌弹飞行
      for (let i = s.enemyMissiles.length - 1; i >= 0; i--) {
        const m = s.enemyMissiles[i];
        m.trail.push([m.x, m.y]);
        if (m.trail.length > 26) m.trail.shift();
        m.x += m.vx * dt;
        m.y += m.sp * dt;
        if (m.y >= GROUND - 4) {
          s.enemyMissiles.splice(i, 1);
          explode(s, g, m.x, GROUND - 4, true);
          // 命中城市
          for (const c of s.cities) {
            if (c.alive && Math.abs(c.x - m.x) < 20) {
              c.alive = false;
              Sound.sfx.crash();
              g.shake(7); g.flash('#ff3b3066', 0.6);
              g.burst(c.x, GROUND - 10, '#ff4d5e', 30, 180);
            }
          }
        }
      }
      // 拦截弹飞行
      for (let i = s.interceptors.length - 1; i >= 0; i--) {
        const it = s.interceptors[i];
        const dx = it.tx - it.x, dy = it.ty - it.y;
        const dist = Math.hypot(dx, dy);
        const step = 300 * dt;
        if (dist <= step) {
          s.interceptors.splice(i, 1);
          explode(s, g, it.tx, it.ty, false);
        } else {
          it.x += dx / dist * step;
          it.y += dy / dist * step;
        }
      }
      // 爆炸推进与杀伤
      for (let i = s.explosions.length - 1; i >= 0; i--) {
        const ex = s.explosions[i];
        ex.t += dt;
        const grow = Math.min(1, ex.t / 0.45);
        ex.r = ex.maxR * grow * (ex.t > 0.75 ? Math.max(0, 1 - (ex.t - 0.75) / 0.35) : 1);
        if (!ex.enemy) { // 玩家拦截弹的爆炸负责杀伤敌弹
          for (let j = s.enemyMissiles.length - 1; j >= 0; j--) {
            const m = s.enemyMissiles[j];
            if (Math.hypot(m.x - ex.x, m.y - ex.y) < ex.r) {
              s.enemyMissiles.splice(j, 1);
              s.score += 10;
              Sound.sfx.boom();
              g.burst(m.x, m.y, '#ffd60a', 10, 120);
            }
          }
        }
        if (ex.t > 1.1) s.explosions.splice(i, 1);
      }
      // 波次推进
      if (s.waveLeft === 0 && s.enemyMissiles.length === 0) {
        if (!s.pendingWaveClear) {
          s.pendingWaveClear = true;
          s.spawnT = 1.0; // 留出安全间隔
        } else if (s.spawnT <= 0) {
          s.pendingWaveClear = false;
          const aliveN = s.cities.filter((c) => c.alive).length;
          s.score += aliveN * 25;
          if (aliveN === 0) {
            s.over = true;
            Sound.sfx.over();
            return;
          }
          Sound.sfx.win();
          startWave(s);
        }
      }
    },
    draw(s, g) {
      g.clear('#08071a');
      g.hud(s.score, s.hi, 'AMMO', s.ammo);
      // 星空
      for (let i = 0; i < 30; i++) {
        g.rect((i * 83) % 296 + 2, 36 + (i * 53) % 380, 1.5, 1.5, 'rgba(255,255,255,0.2)');
      }
      // 月亮
      g.block(252, 52, 22, 22, '#e8e6d8');
      g.block(258, 56, 14, 14, '#c9c6b4');
      // 地面
      g.rect(0, GROUND, 300, 500 - GROUND, '#1d1a3e');
      g.rect(0, GROUND, 300, 2, '#4a4690');
      // 城市
      for (const c of s.cities) {
        if (c.alive) {
          g.block(c.x - 12, GROUND - 14, 8, 14, '#3f8cff');
          g.block(c.x - 3, GROUND - 20, 8, 20, '#5a9dff');
          g.block(c.x + 6, GROUND - 11, 7, 11, '#3f8cff');
          g.rect(c.x - 1, GROUND - 16, 2, 2, '#ffd60a');
          g.rect(c.x + 2, GROUND - 10, 2, 2, '#ffd60a');
          g.rect(c.x - 9, GROUND - 10, 2, 2, '#ffd60a');
          g.rect(c.x + 8, GROUND - 7, 2, 2, '#ffd60a');
        } else {
          g.block(c.x - 10, GROUND - 5, 20, 5, '#33304e');
          g.rect(c.x - 6, GROUND - 9, 3, 4, '#55506e');
        }
      }
      // 发射塔
      g.block(TURRET_X - 8, GROUND - 8, 16, 8, '#2de2ff');
      g.block(TURRET_X - 3, GROUND - 13, 6, 6, '#b8f4ff');
      // 敌弹 + 尾迹
      for (const m of s.enemyMissiles) {
        g.ctx.strokeStyle = 'rgba(255,77,94,0.4)';
        g.ctx.beginPath();
        g.ctx.moveTo(m.sx, m.sy);
        for (const [tx2, ty2] of m.trail) g.ctx.lineTo(tx2, ty2);
        g.ctx.lineTo(m.x, m.y);
        g.ctx.stroke();
        g.rect(m.x - 2, m.y - 2, 4, 4, '#ff4d5e');
      }
      // 拦截弹
      for (const it of s.interceptors) {
        g.rect(it.x - 2, it.y - 2, 4, 4, '#2de2ff');
        g.rect(it.x - 1, it.y + 3, 2, 5, '#2de2ff66');
      }
      // 爆炸
      for (const ex of s.explosions) {
        const a = Math.max(0, 1 - ex.t / 1.1);
        const n = 14;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          g.rect(ex.x + Math.cos(ang) * ex.r - 2, ex.y + Math.sin(ang) * ex.r - 2, 4, 4, ex.enemy ? `rgba(255,119,0,${a})` : `rgba(255,214,10,${a})`);
        }
        g.rect(ex.x - 3, ex.y - 3, 6, 6, `rgba(255,255,255,${a})`);
      }
      // 准星
      if (!s.over) {
        const cc = s.ammo > 0 ? '#ffd60a' : '#55506e';
        g.frame(s.cross.x - 9, s.cross.y - 9, 18, 18, cc, 1);
        g.rect(s.cross.x - 1, s.cross.y - 13, 2, 5, cc);
        g.rect(s.cross.x - 1, s.cross.y + 8, 2, 5, cc);
        g.rect(s.cross.x - 13, s.cross.y - 1, 5, 2, cc);
        g.rect(s.cross.x + 8, s.cross.y - 1, 5, 2, cc);
      }
      // 波次横幅
      if (s.banner > 0) {
        g.text(s.bannerText, 150, 120, '#ff7ab8', 2, { center: true, glow: 8 });
      }
    },
  };
  }

  function startWave(s) {
    s.wave++;
    s.level = s.wave;
    s.ammo = s.hard ? 12 : 15;
    s.waveLeft = 5 + s.wave * 2 + (s.hard ? 2 : 0);
    s.spawnT = 0.5;
    s.banner = 2.0;
    s.bannerText = 'WAVE ' + s.wave;
  }

  function explode(s, g, x, y, isEnemy) {
    s.explosions.push({ x, y, r: 0, maxR: 30, t: 0, enemy: isEnemy });
    Sound.sfx.boom();
    g.burst(x, y, isEnemy ? '#ff7700' : '#ffd60a', 12, 110);
    if (isEnemy) g.shake(2);
  }

  window.registerGame(makeMissileDef(false));
  window.registerGame(makeMissileDef(true));
})();
