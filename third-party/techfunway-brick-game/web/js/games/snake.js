/* ============ 贪吃蛇 I（经典）/ II（迷宫）============ */
(function () {
  const U = window.GameUtil;
  const COLS = 16, ROWS = 24, CELL = 16, X0 = (300 - COLS * CELL) / 2, Y0 = 46;

  function placeFood(s) {
    for (let tries = 0; tries < 200; tries++) {
      const f = { x: U.ri(COLS), y: U.ri(ROWS) };
      if (s.snake.some((p) => p.x === f.x && p.y === f.y)) continue;
      if (s.obstacles.some((o) => o.x === f.x && o.y === f.y)) continue;
      s.food = f;
      return;
    }
    s.food = { x: 0, y: 0 };
  }

  // 迷宫墙（II 代）：四段横墙留缺口
  function buildWalls() {
    const walls = [];
    const rows = [6, 12, 18];
    for (const y of rows) {
      for (let x = 3; x < COLS - 3; x++) {
        if (Math.abs(x - COLS / 2) < 2) continue; // 中间缺口
        walls.push({ x, y });
      }
    }
    return walls;
  }

  function makeSnakeDef(variant) {
    const isII = variant === 'ii', isIII = variant === 'iii';
    return {
      id: isIII ? 'snakeIII' : isII ? 'snakeII' : 'snake',
      name: isIII ? '贪吃蛇III' : isII ? '贪吃蛇II' : '贪吃蛇',
      en: isIII ? 'SNAKE III' : isII ? 'SNAKE II' : 'SNAKE',
      desc: isIII ? '穿墙模式 · 神出鬼没' : isII ? '迷宫墙版 · 穿缝觅食' : '吃果实成长 · 别咬到自己',
      color: isIII ? '#b455ff' : isII ? '#2de2ff' : '#30ff8e',
      music: 'snake',
      icon(g, x, y, s, t) {
        const seg = [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [3, 0]];
        seg.forEach(([cx, cy], i) => g.block(x + cx * s * 0.72, y + cy * s * 0.72, s * 0.62, i === seg.length - 1 ? '#b8ffd4' : (isII ? '#2de2ff' : '#30ff8e')));
        const px = x + 4.6 * s * 0.72 + Math.sin(t * 4) * 2;
        g.block(px, y + 2 * s * 0.72, s * 0.62, '#ff4d5e');
        if (isII) g.block(x + s * 0.7, y - s * 0.15, s * 1.9, s * 0.3, '#5a6a8a');
      },
      start(env) {
        const cx = Math.floor(COLS / 2);
        const s = {
          score: 0, over: false, level: 1, speed: env.speed,
          snake: [{ x: cx, y: 21 }, { x: cx - 1, y: 21 }, { x: cx - 2, y: 21 }],
          dir: { x: 1, y: 0 }, queued: [],
          food: null, tick: 0, grow: 0,
          obstacles: isII ? buildWalls() : [], deadT: 0, hi: 0,
          tickMul: isIII ? 0.78 : isII ? 0.82 : 1,
          scoreMul: isIII ? 2 : isII ? 2 : 1,
          wrap: isIII,
        };
        return s;
      },
      update(s, dt, g) {
        const dirs = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        for (const k of ['up', 'down', 'left', 'right']) {
          if (Input.took(k) && s.queued.length < 2) s.queued.push(dirs[k]);
        }
        if (s.over) return;
        const iv = Math.max(58, (200 - s.speed * 11 - (s.level - 1) * 10) * s.tickMul) / 1000;
        s.tick += dt;
        if (s.tick < iv) return;
        s.tick -= iv;
        if (s.queued.length) {
          const d = s.queued.shift();
          if (!(d.x === -s.dir.x && d.y === -s.dir.y)) s.dir = d;
        }
        if (!s.food) placeFood(s);
        const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
        if (s.wrap) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }
        const hitSelf = s.snake.some((p, i) => i < s.snake.length - 1 && p.x === head.x && p.y === head.y);
        const hitObs = s.obstacles.some((o) => o.x === head.x && o.y === head.y);
        if ((!s.wrap && (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS)) || hitSelf || hitObs) {
          s.over = true;
          Sound.sfx.die();
          g.shake(5); g.flash('#ff3b3055', 0.5);
          g.burst(X0 + head.x * CELL + CELL / 2, Y0 + head.y * CELL + CELL / 2, '#30ff8e', 24, 160);
          return;
        }
        s.snake.unshift(head);
        if (s.food && head.x === s.food.x && head.y === s.food.y) {
          s.score += (10 + s.level * 2) * s.scoreMul;
          s.grow += 2;
          Sound.sfx.eat();
          g.burst(X0 + head.x * CELL + CELL / 2, Y0 + head.y * CELL + CELL / 2, '#ffd60a', 12, 110);
          const lv = 1 + Math.floor(s.score / (80 * s.scoreMul));
          if (lv > s.level) {
            s.level = lv;
            Sound.sfx.levelup();
            g.toast('LEVEL ' + lv, 150, 200, '#30ff8e', 2);
            if (!isII) {
              for (let i = 0; i < 3; i++) {
                const o = { x: U.ri(COLS), y: U.ri(ROWS - 6) + 3 };
                if (!s.snake.some((p) => p.x === o.x && p.y === o.y) &&
                    !(s.food && s.food.x === o.x && s.food.y === o.y)) s.obstacles.push(o);
              }
            }
          }
          s.food = null;
        }
        if (s.grow > 0) s.grow--; else s.snake.pop();
      },
      draw(s, g) {
        g.clear('#0b0a1e');
        g.hud(s.score, s.hi, 'LV', s.level);
        g.rect(X0 - 3, Y0 - 3, COLS * CELL + 6, ROWS * CELL + 6, '#30ff8e33');
        g.rect(X0, Y0, COLS * CELL, ROWS * CELL, '#081018');
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if ((x + y) % 2 === 0) g.rect(X0 + x * CELL, Y0 + y * CELL, CELL, CELL, 'rgba(48,255,142,0.03)');
        for (const o of s.obstacles) g.block(X0 + o.x * CELL + 1, Y0 + o.y * CELL + 1, CELL - 2, '#5a6a8a');
        if (s.food) {
          const f = s.food, cx = X0 + f.x * CELL + CELL / 2, cy = Y0 + f.y * CELL + CELL / 2;
          const r = 3 + Math.sin(g.t * 6) * 1.2;
          g.ctx.fillStyle = '#ffd60a';
          g.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          g.ctx.fillStyle = '#fff9';
          g.ctx.fillRect(cx - r, cy - r, r, r);
        }
        s.snake.forEach((p, i) => {
          const a = Math.max(0.45, 1 - i * 0.03);
          const wob = Math.sin(g.t * 8 - i * 0.6) * 0.7;
          g.block(X0 + p.x * CELL + 1, Y0 + p.y * CELL + 1 + wob, CELL - 2, i === 0 ? '#b8ffd4' : '#30ff8e', a);
        });
        if (s.snake.length) {
          const h = s.snake[0];
          g.rect(X0 + h.x * CELL + 4, Y0 + h.y * CELL + 4, 3, 3, '#0b0a1e');
          g.rect(X0 + h.x * CELL + 9, Y0 + h.y * CELL + 4, 3, 3, '#0b0a1e');
        }
      },
    };
  }

  window.registerGame(makeSnakeDef('i'));
  window.registerGame(makeSnakeDef('ii'));
  window.registerGame(makeSnakeDef('iii'));
})();
