/* ============ 坦克大战 ============ */
(function () {
  const U = window.GameUtil;
  const COLS = 12, ROWS = 16, CELL = 25;
  const X0 = (300 - COLS * CELL) / 2, Y0 = 30 + Math.round((470 - ROWS * CELL) / 2);
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // 地形：0 空地 1 砖墙 2 钢板
  function buildMap() {
    const m = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // 钢板外框
    for (let x = 0; x < COLS; x++) { m[0][x] = 2; m[ROWS - 1][x] = 2; }
    for (let y = 0; y < ROWS; y++) { m[y][0] = 2; m[y][COLS - 1] = 2; }
    // 砖墙阵
    for (let y = 2; y < ROWS - 2; y++)
      for (let x = 2; x < COLS - 2; x++)
        if ((x + y) % 2 === 0 && Math.random() < 0.62) m[y][x] = 1;
    // 出生点 + 基地通道清空
    const clear = [[1, 1], [2, 1], [1, 2], [Math.floor(COLS / 2), 1], [COLS - 2, 1], [COLS - 3, 1], [COLS - 2, 2],
      [1, ROWS - 2], [2, ROWS - 2], [1, ROWS - 3], [COLS - 2, ROWS - 2], [COLS - 2, ROWS - 3]];
    clear.forEach(([x, y]) => { m[y][x] = 0; });
    // 基地（底部中央）
    const bx = Math.floor(COLS / 2);
    m[ROWS - 2][bx] = 0; m[ROWS - 3][bx] = 0;
    return m;
  }

  function makeTankDef(variant) {
    const isII = variant === 'ii';
    return {
    id: isII ? 'tankII' : 'tank',
    name: isII ? '钢甲洪流' : '坦克大战',
    en: isII ? 'TANK II' : 'TANK',
    desc: isII ? '强敌车轮战 · 双倍得分' : '守住基地 · 消灭敌军坦克',
    color: isII ? '#ff4d5e' : '#ff9f40',
    music: 'battle',
    icon(g, x, y, s, t) {
      const w = Math.sin(t * 3) * 2;
      g.block(x + s * 0.3, y + s * 1.2 + w * 0.3, s * 1.9, s * 1.2, isII ? '#ff4d5e' : '#30ff8e');
      g.block(x + s * 0.9, y + s * 0.6 + w * 0.3, s * 0.7, s * 0.7, isII ? '#ffb3bb' : '#b8ffd4');
      g.block(x + s * 1.5, y + s * 0.9 + w * 0.3, s * 0.8, s * 0.3, isII ? '#ffb3bb' : '#b8ffd4');
      g.block(x + s * 2.4, y + s * 1.9 - w * 0.3, s * 1.1, s * 0.9, isII ? '#30ff8e' : '#ff4d5e');
    },
    start(env) {
      const bx = Math.floor(COLS / 2);
      return {
        score: 0, over: false, level: 1, speed: env.speed, hi: 0,
        map: buildMap(),
        player: { x: 1.5 * CELL + X0, y: (ROWS - 2.5) * CELL + Y0, dir: 'up', cd: 0 },
        enemies: [], bullets: [],
        lives: 3, spawnT: 0, maxEnemies: (isII ? 5 : 3) + Math.floor(env.speed / 3), kills: 0,
        baseX: bx, spawnMark: 0, baseAlive: true,
        bulletSpd: isII ? 320 : 260, scoreMul: isII ? 2 : 1,
        hpBase: isII ? 2 : 1, enemySpd: isII ? 1.3 : 1,
      };
    },
    update(s, dt, g) {
      if (s.over) return;
      const P = s.player;
      // 生成敌人（三个出生点轮换 + 出场特效）
      s.spawnT -= dt;
      if (s.spawnT <= 0 && s.enemies.length < s.maxEnemies && s.enemies.filter((e) => e.spawning > 0).length < 2) {
        const spots = [[1, 1], [Math.floor(COLS / 2), 1], [COLS - 2, 1]];
        const [gx, gy] = spots[s.spawnMark % 3]; s.spawnMark++;
        s.enemies.push({ x: gx * CELL + X0, y: gy * CELL + Y0, dir: 'down', cd: 1 + Math.random(), turnT: 1 + Math.random() * 2, spawning: 1.1, hp: s.hpBase + (s.level > 3 ? 1 : 0) });
        s.spawnT = Math.max(0.8, 2.6 - s.level * 0.15);
      }
      // 玩家
      s.player.cd -= dt;
      let mv = null;
      for (const k of ['up', 'down', 'left', 'right']) if (Input.held[k]) mv = k;
      if (mv) {
        P.dir = mv;
        moveTank(s, P, DIRS[mv], 86 * dt, true);
      }
      if ((Input.took('a') || Input.took('drop')) && P.cd <= 0 && !s.bullets.some((b) => b.from === 'p')) {
        s.bullets.push(mkBullet(P, 'p'));
        P.cd = 0.35;
        Sound.sfx.shoot();
      }
      // 敌人 AI
      for (const e of s.enemies) {
        if (e.spawning > 0) { e.spawning -= dt; continue; }
        e.cd -= dt; e.turnT -= dt;
        if (e.turnT <= 0) { e.dir = ['up', 'down', 'left', 'right'][U.ri(4)]; e.turnT = 0.8 + Math.random() * 1.6; }
        const before = { x: e.x, y: e.y };
        moveTank(s, e, DIRS[e.dir], (46 + s.level * 3) * s.enemySpd * dt, false);
        if (Math.abs(before.x - e.x) + Math.abs(before.y - e.y) < 0.1 && e.turnT > 0.3) {
          e.dir = ['up', 'down', 'left', 'right'][U.ri(4)];
        }
        // 朝玩家或基地偏好
        if (Math.random() < dt * 0.4) {
          e.dir = (Math.random() < 0.5 || e.y > ROWS * CELL * 0.6)
            ? (P.y < e.y ? 'up' : 'down') : (P.x < e.x ? 'left' : 'right');
        }
        if (e.cd <= 0) {
          s.bullets.push(mkBullet(e, 'e'));
          e.cd = 1.2 + Math.random() * 1.6 - Math.min(0.8, s.level * 0.08);
        }
      }
      s.enemies = s.enemies.filter((e) => e.spawning > 0 || e.hp > 0);
      // 子弹
      stepBullets(s, dt, g);
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'LIFE', s.lives);
      // 地图
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const t2 = s.map[y][x];
          const px = X0 + x * CELL, py = Y0 + y * CELL;
          if (t2 === 1) {
            g.block(px, py, CELL, '#a14e2c');
            g.rect(px + CELL / 2, py, 1, CELL, '#00000044');
            g.rect(px, py + CELL / 2, CELL, 1, '#00000044');
            g.rect(px + 2, py + 2, 4, 4, '#d97b4a');
          } else if (t2 === 2) {
            g.block(px, py, CELL, '#7c8aa8');
            g.frame(px + 3, py + 3, CELL - 6, CELL - 6, '#b8c4dd', 2);
          }
        }
      // 基地（老鹰）
      const bx = X0 + s.baseX * CELL, by = Y0 + (ROWS - 2) * CELL;
      g.rect(bx - 2, by - 2, CELL + 4, CELL + 4, '#00000088');
      if (s.baseAlive === false) {
        g.block(bx, by, CELL, CELL, '#666');
        g.toast('GAME OVER', bx + CELL / 2, by - 12, '#ff4d5e', 1);
      } else {
        g.block(bx, by, CELL, CELL, '#ffd60a');
        g.rect(bx + 4, by + 2, 12, 8, '#b8860b');
        g.rect(bx + 8, by + 8, 4, 8, '#b8860b');
        g.frame(bx, by, CELL, CELL, '#fff', 1);
      }
      // 敌人
      for (const e of s.enemies) {
        if (e.spawning > 0) {
          const a = 0.3 + 0.5 * Math.abs(Math.sin(g.t * 10));
          g.frame(e.x - 4, e.y - 4, CELL * 2 - 2, CELL * 2 - 2, `rgba(255,255,255,${a})`, 2);
          continue;
        }
        drawTank(g, e.x, e.y, e.dir, '#ff4d5e', '#ffb3bb');
      }
      // 玩家
      if (!s.over || s.lives > 0) drawTank(g, s.player.x, s.player.y, s.player.dir, '#30ff8e', '#d0ffe4');
      // 子弹
      for (const b of s.bullets) {
        g.rect(b.x - 2, b.y - 2, 4, 4, b.from === 'p' ? '#ffffff' : '#ffd60a');
      }
    },
  };
  }
  window.registerGame(makeTankDef('i'));
  window.registerGame(makeTankDef('ii'));

  function mkBullet(t, from) {
    const [dx, dy] = DIRS[t.dir];
    return { x: t.x + CELL / 2 + dx * (CELL / 2 + 2), y: t.y + CELL / 2 + dy * (CELL / 2 + 2), dx, dy, from };
  }

  function cellAt(s, px, py) {
    const gx = Math.floor((px - X0) / CELL), gy = Math.floor((py - Y0) / CELL);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return 2;
    return s.map[gy][gx];
  }

  function moveTank(s, t, [dx, dy], dist, isPlayer) {
    let nx = t.x + dx * dist, ny = t.y + dy * dist;
    // 转向时吸附网格
    if (dx !== 0) ny = Math.round((t.y - Y0) / (CELL / 2)) * (CELL / 2) + Y0;
    if (dy !== 0) nx = Math.round((t.x - X0) / (CELL / 2)) * (CELL / 2) + X0;
    // 碰撞（四角采样）
    const r = CELL - 2;
    const pts = [[nx + 1, ny + 1], [nx + r - 1, ny + 1], [nx + 1, ny + r - 1], [nx + r - 1, ny + r - 1]];
    for (const [px, py] of pts) {
      const c = cellAt(s, px, py);
      if (c === 1 || c === 2) return;
    }
    // 坦克互撞
    const others = isPlayer ? s.enemies : [s.player, ...s.enemies];
    for (const o of others) {
      if (o === t || (o.spawning > 0)) continue;
      if (Math.abs(o.x - nx) < CELL - 2 && Math.abs(o.y - ny) < CELL - 2) return;
    }
    t.x = U.clamp(nx, X0 + CELL, X0 + (COLS - 2) * CELL - CELL);
    t.y = U.clamp(ny, Y0 + CELL, Y0 + (ROWS - 2) * CELL - CELL);
  }

  function stepBullets(s, dt, g) {
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i];
      if (!b) continue; // 子弹互怼会一次 splice 两颗，数组缩短后 i 可能越界
      b.x += b.dx * s.bulletSpd * dt;
      b.y += b.dy * s.bulletSpd * dt;
      // 撞地形
      const c = cellAt(s, b.x, b.y);
      if (c === 1) {
        // 炸掉命中砖块及相邻砖（十字）
        const gx = Math.floor((b.x - X0) / CELL), gy = Math.floor((b.y - Y0) / CELL);
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => {
          const x2 = gx + ox, y2 = gy + oy;
          if (x2 >= 0 && x2 < COLS && y2 >= 0 && y2 < ROWS && s.map[y2][x2] === 1) {
            s.map[y2][x2] = 0;
            g.burst(X0 + x2 * CELL + CELL / 2, Y0 + y2 * CELL + CELL / 2, '#a14e2c', 6, 90);
          }
        });
        Sound.sfx.hit();
        s.bullets.splice(i, 1);
        continue;
      }
      if (c === 2) {
        g.burst(b.x, b.y, '#b8c4dd', 4, 60);
        s.bullets.splice(i, 1);
        continue;
      }
      // 子弹互怼
      let hit = false;
      for (let j = s.bullets.length - 1; j >= 0; j--) {
        const o = s.bullets[j];
        if (o.from !== b.from && Math.abs(o.x - b.x) < 5 && Math.abs(o.y - b.y) < 5) {
          s.bullets.splice(Math.max(i, j), 1);
          s.bullets.splice(Math.min(i, j), 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // 命中坦克
      if (b.from === 'p') {
        for (const e of s.enemies) {
          if (e.spawning > 0) continue;
          if (b.x > e.x - 2 && b.x < e.x + CELL * 2 - 2 && b.y > e.y - 2 && b.y < e.y + CELL * 2 - 2) {
            e.hp--;
            s.bullets.splice(i, 1);
            if (e.hp <= 0) {
              s.score += 100 * s.level * s.scoreMul;
              s.kills++;
              Sound.sfx.boom();
              g.burst(e.x + CELL, e.y + CELL, '#ff4d5e', 24, 160);
              g.shake(3);
              if (s.kills % 5 === 0) { s.level++; Sound.sfx.levelup(); }
            } else Sound.sfx.hit();
            break;
          }
        }
      } else {
        const P = s.player;
        if (b.x > P.x - 2 && b.x < P.x + CELL * 2 - 2 && b.y > P.y - 2 && b.y < P.y + CELL * 2 - 2) {
          s.bullets.splice(i, 1);
          s.lives--;
          Sound.sfx.boom();
          g.burst(P.x + CELL, P.y + CELL, '#30ff8e', 24, 160);
          g.shake(5); g.flash('#ff3b3055', 0.5);
          P.x = 1.5 * CELL + X0; P.y = (ROWS - 2.5) * CELL + Y0; P.dir = 'up';
          if (s.lives <= 0) { s.over = true; Sound.sfx.over(); return; }
          continue;
        }
        // 命中基地
        const bx = X0 + s.baseX * CELL, by = Y0 + (ROWS - 2) * CELL;
        if (b.x > bx && b.x < bx + CELL && b.y > by && b.y < by + CELL) {
          s.bullets.splice(i, 1);
          s.baseAlive = false;
          s.over = true;
          Sound.sfx.boom(); Sound.sfx.over();
          g.burst(bx + CELL / 2, by + CELL / 2, '#ffd60a', 40, 220);
          g.shake(8); g.flash('#ff3b3077', 0.7);
          return;
        }
      }
    }
  }

  function drawTank(g, x, y, dir, c1, c2) {
    g.block(x + 2, y + 2, CELL * 2 - 6, CELL * 2 - 6, c1);
    // 履带
    g.rect(x, y + 2, 3, CELL * 2 - 6, '#1a1a2e');
    g.rect(x + CELL * 2 - 5, y + 2, 3, CELL * 2 - 6, '#1a1a2e');
    // 炮塔与炮管
    const cx = x + CELL, cy = y + CELL;
    g.block(cx - 5, cy - 5, 10, 10, c2);
    const [dx, dy] = DIRS[dir];
    g.rect(cx - 2 + dx * (CELL / 2 + 3), cy - 2 + dy * (CELL / 2 + 3), 4 + Math.abs(dx) * 2, 4 + Math.abs(dy) * 2, c2);
  }
})();
