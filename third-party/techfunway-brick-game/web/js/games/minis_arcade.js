/* ============ 街机小游戏合集：笨鸟 / 颠球 / 月面着陆 / 高山滑雪 ============ */
(function () {
  const U = window.GameUtil;

  /* ---------- 笨鸟 FLAPPY ---------- */
  window.registerGame({
    id: 'flappy',
    name: '笨鸟先飞',
    en: 'FLAPPY',
    desc: '一指禅穿缝 · A 拍翅膀',
    color: '#ffd60a',
    music: null,
    icon(g, x, y, s, t) {
      const bob = Math.sin(t * 6) * 3;
      g.block(x + s * 0.4, y + s * 1.2 + bob, s * 1.1, s * 0.9, '#ffd60a');
      g.rect(x + s * 1.2, y + s * 1.35 + bob, 3, 3, '#0b0a1e');
      g.block(x + s * 0.6, y + s * 1.5 + bob, s * 0.6, s * 0.35, '#ff9f40');
      g.block(x + s * 2.2, y + s * 0.1, s * 0.7, s * 2.8, '#30ff8e');
      g.block(x + s * 2.2, y + s * 3.3, s * 0.7, s * 0.6, '#30ff8e');
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        y: 240, vy: 0, pipes: [], spawnT: 0.8, t: 0, groundY: 470,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.t += dt;
      s.level = 1 + Math.floor(s.score / 30);
      // 拍翅膀
      if (Input.took('a') || Input.took('drop') || Input.took('up')) s.vy = -235;
      if (Input.pointer && Input.took('a')) s.vy = -235;
      s.vy += 620 * dt;
      s.y += s.vy * dt;
      // 水管
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        const gap = Math.max(96, 150 - s.level * 6);
        s.pipes.push({ x: 310, gy: 90 + Math.random() * (s.groundY - 90 - gap - 60) + 30, gap, passed: false });
        s.spawnT = Math.max(0.9, 1.5 - s.level * 0.05);
      }
      const v = 105 + s.level * 7 + s.speed * 3;
      for (let i = s.pipes.length - 1; i >= 0; i--) {
        const p = s.pipes[i];
        p.x -= v * dt;
        if (p.x < -50) { s.pipes.splice(i, 1); continue; }
        if (!p.passed && p.x + 26 < 70) {
          p.passed = true;
          s.score += 10;
          Sound.sfx.coin();
        }
        // 碰撞
        if (70 + 12 > p.x && 70 - 12 < p.x + 26) {
          if (s.y - 9 < p.gy || s.y + 9 > p.gy + p.gap) {
            die(s, g);
            return;
          }
        }
      }
      if (s.y > s.groundY - 9 || s.y < 8) { die(s, g); return; }
      function die(s2, g2) {
        s2.over = true;
        Sound.sfx.die();
        g2.shake(5);
        g2.burst(70, s2.y, '#ffd60a', 20, 140);
      }
    },
    draw(s, g) {
      g.clear('#0d1330');
      g.hud(s.score, s.hi, 'BEST', s.hi);
      // 远景云
      for (let i = 0; i < 5; i++) {
        const cx = (300 - ((g.t * 12 + i * 70) % 340));
        g.rect(cx, 70 + i * 45, 26, 8, 'rgba(255,255,255,0.06)');
        g.rect(cx + 8, 64 + i * 45, 14, 8, 'rgba(255,255,255,0.06)');
      }
      // 水管
      for (const p of s.pipes) {
        g.block(p.x, 30, 26, p.gy - 30, '#2fae5e');
        g.block(p.x - 3, p.gy - 14, 32, 14, '#3fd072');
        g.block(p.x, p.gy + p.gap, 26, s.groundY - p.gy - p.gap, '#2fae5e');
        g.block(p.x - 3, p.gy + p.gap, 32, 14, '#3fd072');
        g.rect(p.x + 3, 34, 5, p.gy - 40, '#6ae89a44');
      }
      // 地面
      g.rect(0, s.groundY, 300, 500 - s.groundY, '#256030');
      for (let i = 0; i < 12; i++) g.rect((300 - ((g.t * 60 + i * 30) % 330)), s.groundY + 6, 16, 4, '#30ff8e33');
      // 鸟
      const wing = Math.sin(s.t * 14) > 0;
      g.block(70 - 12, s.y - 9, 24, 18, '#ffd60a');
      g.block(70 - 4, s.y - (wing ? 14 : 9), 12, 6, '#ff9f40');
      g.rect(70 + 3, s.y - 5, 4, 4, '#0b0a1e');
      g.block(70 + 10, s.y - 2, 6, 4, '#ff7700');
      if (!s.over && s.score === 0 && s.pipes.length === 0) g.text('A / 轻点 拍翅膀', 150, 260, '#ffffff99', 1, { center: true });
    },
  });

  /* ---------- 颠球 JUGGLE ---------- */
  window.registerGame({
    id: 'juggle',
    name: '颠球',
    en: 'JUGGLE',
    desc: '别让球落地 · 连击刷分',
    color: '#00e5ff',
    music: 'chill',
    icon(g, x, y, s, t) {
      const by = y + s * (1.0 + Math.sin(t * 5) * 0.5);
      g.block(x + s * 1.0, by, s * 0.6, s * 0.6, '#ffffff');
      g.block(x + s * 0.5, y + s * 2.4, s * 1.6, s * 0.5, '#00e5ff');
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        px: 150, ball: { x: 150, y: 200, vx: 60, vy: 0 },
        lives: 3, combo: 0, serve: 0.8,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      const v = 240;
      if (Input.held.left) s.px -= v * dt;
      if (Input.held.right) s.px += v * dt;
      if (Input.pointer && Input.pointer.inside) s.px = Input.pointer.x;
      s.px = U.clamp(s.px, 26, 274);
      s.level = 1 + Math.floor(s.combo / 10);
      const b = s.ball;
      if (s.serve > 0) { s.serve -= dt; b.x = s.px; b.y = 180; return; }
      b.vy += 520 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx); Sound.sfx.bounce(); }
      if (b.x > 292) { b.x = 292; b.vx = -Math.abs(b.vx); Sound.sfx.bounce(); }
      if (b.y < 38) { b.y = 38; b.vy = Math.abs(b.vy) * 0.9; Sound.sfx.bounce(); }
      // 球拍
      if (b.vy > 0 && b.y > 448 && b.y < 462 && Math.abs(b.x - s.px) < 32) {
        b.y = 448;
        const rel = (b.x - s.px) / 32;
        const speed = Math.min(430, 300 + s.combo * 4);
        b.vy = -speed;
        b.vx = rel * 160 + (U.ri(41) - 20);
        s.combo++;
        s.score += 5 + Math.floor(s.combo / 5) * 5;
        Sound.sfx.bounce();
        g.burst(b.x, 448, '#00e5ff', 5, 70, 100);
      }
      if (b.y > 500) {
        s.lives--;
        s.combo = 0;
        Sound.sfx.die();
        g.shake(4);
        if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
        s.serve = 0.8;
        b.vx = 0; b.vy = 0;
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      for (let i = 0; i < 20; i++) g.rect((i * 47) % 296, 40 + (i * 91) % 400, 1.5, 1.5, 'rgba(255,255,255,0.12)');
      const b = s.ball;
      for (let i = 2; i >= 1; i--) g.block(b.x - 6, b.y - b.vy * 0.012 * i - 6, 12, 12, '#ffffff', 0.2);
      g.block(b.x - 6, b.y - 6, 12, 12, '#ffffff');
      g.rect(b.x - 3, b.y - 3, 4, 4, '#00e5ff');
      if (s.serve <= 0) {
        g.block(s.px - 32, 452, 64, 12, '#00e5ff');
        g.rect(s.px - 26, 454, 52, 3, '#b8f4ff88');
      } else {
        g.text('READY...', s.px, 420, '#7cf7ff', 2, { center: true });
      }
      if (s.combo >= 3) g.text('COMBO ' + s.combo, 150, 34, '#ff7ab8', 1, { center: true, glow: 4 });
    },
  });

  /* ---------- 月面着陆 LANDER ---------- */
  window.registerGame({
    id: 'lander',
    name: '月面着陆',
    en: 'LANDER',
    desc: '轻触降落 · 油料有限',
    color: '#b8c4dd',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 0.8, y + s * 0.6, s * 1.2, s * 0.9, '#b8c4dd');
      g.rect(x + s * 0.6, y + s * 1.5, s * 0.3, s * 0.5, '#8a93b8');
      g.rect(x + s * 1.9, y + s * 1.5, s * 0.3, s * 0.5, '#8a93b8');
      const fl = Math.sin(t * 12) > 0;
      if (fl) g.block(x + s * 1.15, y + s * 1.6, s * 0.5, s * 0.6, '#ffd60a');
      g.rect(x, y + s * 2.4, s * 3, s * 0.3, '#5d628f');
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        lives: 3, fuel: 100, ship: { x: 150, y: 60, vx: 15, vy: 0 },
        terrain: [], padX: 0, landed: 0,
      };
      genTerrain(s, env.speed);
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      const sh = s.ship;
      sh.vy += 42 * dt; // 月面重力
      if (Input.held.up && s.fuel > 0) { sh.vy -= 95 * dt; s.fuel -= 14 * dt; }
      if (Input.held.left && s.fuel > 0) { sh.vx -= 70 * dt; s.fuel -= 6 * dt; }
      if (Input.held.right && s.fuel > 0) { sh.vx += 70 * dt; s.fuel -= 6 * dt; }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      if (sh.x < 10) { sh.x = 10; sh.vx = 0; }
      if (sh.x > 290) { sh.x = 290; sh.vx = 0; }
      if (sh.y < 36) { sh.y = 36; sh.vy = 0; }
      s.fuel = Math.max(0, s.fuel);
      // 触地判定
      const groundY = groundAt(s, sh.x);
      if (sh.y >= groundY - 10) {
        const onPad = Math.abs(sh.x - s.padX) < 24;
        const good = onPad && Math.abs(sh.vy) < 32 && Math.abs(sh.vx) < 22;
        if (good) {
          const gain = Math.round(300 + s.fuel * 2);
          s.score += gain;
          s.landed++;
          Sound.sfx.win();
          g.flash('#30ff8e33', 0.5);
          g.toast('着陆成功 +' + gain, sh.x, sh.y - 20, '#30ff8e', 2);
          s.level++;
          s.fuel = Math.min(100, s.fuel + 35);
          sh.x = 150; sh.y = 60; sh.vx = 10 + U.ri(20); sh.vy = 0;
          genTerrain(s, s.speed + s.landed * 2);
        } else {
          s.lives--;
          Sound.sfx.crash();
          g.shake(6); g.flash('#ff3b3055', 0.5);
          g.burst(sh.x, sh.y, '#ff9f40', 30, 180);
          if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
          s.fuel = Math.max(40, s.fuel);
          sh.x = 150; sh.y = 60; sh.vx = 10; sh.vy = 0;
          s.fuel = Math.min(100, s.fuel + 20);
        }
      }
      function groundAt(s2, x) {
        // terrain 为 30 段折线
        const i = U.clamp(Math.floor(x / 10), 0, 28);
        return s2.terrain[i];
      }
      s.groundAtY = groundY;
    },
    draw(s, g) {
      g.clear('#070614');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      for (let i = 0; i < 30; i++) g.rect((i * 67) % 296, 36 + (i * 83) % 360, 1.5, 1.5, 'rgba(255,255,255,0.18)');
      // 地形
      for (let i = 0; i < s.terrain.length; i++) {
        const x = i * 10;
        g.rect(x, s.terrain[i], 10, 500 - s.terrain[i], '#33304e');
      }
      // 停机坪
      const pi = Math.round(s.padX / 10);
      g.rect((pi - 2) * 10, s.terrain[pi] - 2, 50, 3, '#30ff8e');
      for (let k = -2; k <= 2; k++) g.rect(s.padX + k * 8 - 1, s.terrain[pi] - 8, 2, 6, '#30ff8e');
      // 着陆船
      const sh = s.ship;
      g.block(sh.x - 8, sh.y - 8, 16, 10, '#b8c4dd');
      g.block(sh.x - 4, sh.y - 13, 8, 6, '#dfe6f5');
      g.rect(sh.x - 9, sh.y + 2, 3, 5, '#8a93b8');
      g.rect(sh.x + 6, sh.y + 2, 3, 5, '#8a93b8');
      if (Input.held.up && s.fuel > 0) {
        g.block(sh.x - 4, sh.y + 8, 8, 6 + Math.random() * 8, Math.random() > 0.5 ? '#ffd60a' : '#ff7700');
      }
      if (Input.held.left && s.fuel > 0) g.rect(sh.x + 8, sh.y - 2, 6 + Math.random() * 4, 3, '#ffd60a88');
      if (Input.held.right && s.fuel > 0) g.rect(sh.x - 14 - Math.random() * 4, sh.y - 2, 6 + Math.random() * 4, 3, '#ffd60a88');
      // 仪表
      g.text('FUEL', 6, 34, '#7cf7ff', 1);
      g.rect(6, 42, 80 * (s.fuel / 100), 6, s.fuel < 25 ? '#ff4d5e' : '#30ff8e');
      g.frame(4, 40, 84, 10, '#2de2ff44', 1);
      const spd = Math.hypot(s.ship.vx, s.ship.vy);
      g.text('V' + spd.toFixed(0), 294, 34, spd < 36 ? '#30ff8e' : '#ff4d5e', 1, { right: true });
      g.text('↑ 推进 ←→ 平移', 150, 492, '#5d628f', 1, { center: true });
    },
  });

  function genTerrain(s, speed) {
    s.terrain = [];
    let y = 380;
    for (let i = 0; i < 30; i++) {
      y += U.ri(41) - 20;
      y = U.clamp(y, 300, 460);
      s.terrain.push(Math.round(y));
    }
    // 平整停机坪
    const pi = 4 + U.ri(22);
    s.padX = pi * 10 + 5;
    for (let k = -2; k <= 2; k++) {
      const idx = U.clamp(pi + k, 0, 29);
      s.terrain[idx] = s.terrain[pi];
    }
  }

  /* ---------- 高山滑雪 SLALOM ---------- */
  window.registerGame({
    id: 'slalom',
    name: '高山滑雪',
    en: 'SLALOM',
    desc: '穿过旗门 · 别撞树',
    color: '#ffffff',
    music: 'chill',
    icon(g, x, y, s, t) {
      g.block(x + s * 1.2, y + s * 0.3 + Math.sin(t * 5) * 2, s * 0.5, s * 0.5, '#ffffff');
      g.block(x + s * 1.25, y + s * 0.85 + Math.sin(t * 5) * 2, s * 0.4, s * 0.7, '#ff4d5e');
      g.block(x + s * 0.4, y + s * 2.0, s * 0.4, s * 0.9, '#2fae5e');
      g.block(x + s * 2.3, y + s * 1.9, s * 0.4, s * 1.0, '#2fae5e');
    },
    start(env) {
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        px: 150, vx: 0, lives: 3, inv: 0, dist: 0,
        gates: [], trees: [], nextGate: 100, nextTree: 60,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.level = 1 + Math.floor(s.dist / 1500);
      if (Input.held.left) s.vx -= 320 * dt;
      if (Input.held.right) s.vx += 320 * dt;
      s.vx *= (1 - 3.2 * dt);
      s.px += s.vx * dt * (1 + Math.abs(s.vx) / 260);
      s.px = U.clamp(s.px, 12, 288);
      s.inv = Math.max(0, s.inv - dt);
      const v = 150 + s.level * 14 + s.speed * 5;
      s.dist += v * dt * 0.12;
      s.score = Math.floor(s.dist) + (s.bonus || 0);
      const scroll = v * dt;
      // 旗门
      s.nextGate -= scroll;
      if (s.nextGate <= 0) {
        const gx = 40 + Math.random() * 190;
        s.gates.push({ x: gx, y: -10, passed: false, dir: Math.random() < 0.5 ? 0 : 1 });
        s.gates.push({ x: gx + 62, y: -10, passed: false });
        s.nextGate = 190 + Math.random() * 120;
      }
      for (let i = s.gates.length - 1; i >= 0; i--) {
        const gt = s.gates[i];
        gt.y += scroll;
        if (gt.y > 520) { s.gates.splice(i, 1); continue; }
        // 成对旗门的判定在下面统一做
      }
      // 树
      s.nextTree -= scroll;
      if (s.nextTree <= 0) {
        s.trees.push({ x: 12 + Math.random() * 276, y: -10 });
        s.nextTree = 60 + Math.random() * 110;
      }
      for (let i = s.trees.length - 1; i >= 0; i--) {
        const t = s.trees[i];
        t.y += scroll;
        if (t.y > 520) { s.trees.splice(i, 1); continue; }
        if (s.inv <= 0 && t.y > 430 && t.y < 470 && Math.abs(t.x - s.px) < 14) {
          s.lives--; s.inv = 1.6;
          Sound.sfx.crash();
          g.shake(5); g.flash('#ff3b3055', 0.45);
          g.burst(s.px, 450, '#2fae5e', 18, 150);
          if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
        }
      }
      // 旗门通过判定（同屏成对 flag：找最近的左右旗杆对）
      for (let i = 0; i + 1 < s.gates.length; i += 2) {
        const a = s.gates[i], b = s.gates[i + 1];
        if (!a.passed && a.y > 444) {
          a.passed = b.passed = true;
          const inner1 = a.x < b.x ? a : b, inner2 = a.x < b.x ? b : a;
          if (s.px > inner1.x + 6 && s.px < inner2.x - 6) {
            s.bonus = (s.bonus || 0) + 50;
            s.score = Math.floor(s.dist) + s.bonus;
            Sound.sfx.coin();
            g.toast('GATE +50', s.px, 430, '#ffd60a', 1);
          } else {
            s.comboMiss = (s.comboMiss || 0) + 1;
            if (s.comboMiss >= 3) { s.lives--; s.comboMiss = 0; g.shake(3); Sound.sfx.hit(); if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; } }
          }
        }
      }
    },
    draw(s, g) {
      g.clear('#e8f2ff');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 雪道
      g.rect(0, 30, 300, 470, '#f4faff');
      for (let i = 0; i < 8; i++) {
        const yy = ((i * 67 + g.t * 60) % 470);
        g.rect(0, 30 + yy, 300, 2, '#d8e6f8');
      }
      // 树
      for (const t of s.trees) {
        g.block(t.x - 7, t.y - 22, 14, 12, '#2fae5e');
        g.block(t.x - 5, t.y - 30, 10, 10, '#3fd072');
        g.rect(t.x - 2, t.y - 10, 4, 8, '#6e4a2c');
      }
      // 旗门
      for (const gt of s.gates) {
        const c = gt.dir === 0 ? '#ff4d5e' : '#3f8cff';
        g.rect(gt.x - 1, gt.y - 14, 3, 22, '#8a93b8');
        g.block(gt.x + 2, gt.y - 14, 14, 10, c);
      }
      // 滑雪者
      if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
        const lean = U.clamp(s.vx / 160, -1, 1);
        const px = s.px, py = 452;
        g.block(px - 4, py - 14, 8, 8, '#ff4d5e');   // 身体
        g.block(px - 3, py - 19, 6, 5, '#ffd60a');   // 头盔
        g.rect(px - 10 + lean * 4, py - 3, 20, 3, '#3f8cff'); // 雪板
        g.rect(px - 2 + lean * 3, py - 6, 4, 4, '#0b0a1e');   // 手
      }
      g.text('← → 转向 · 穿过旗门', 150, 492, '#5d628f', 1, { center: true });
    },
  });
})();
