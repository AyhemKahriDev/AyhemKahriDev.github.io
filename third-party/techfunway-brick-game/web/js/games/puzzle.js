/* ============ 数字拼图 15 ============ */
(function () {
  const U = window.GameUtil;
  const CELL = { 3: 76, 4: 56, 5: 46 };
  const BX_BY = (n) => ({ bx: (300 - n * CELL[n]) / 2, by: 96 });

  // 16 阶紫蓝渐变（十六进制，保证 sprite 缓存可用）
  const TILE_COLORS = Array.from({ length: 17 }, (_, i) => {
    const h = 262 + i * 5, l = 42 + (i / 16) * 26;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const c = l / 100 - Math.min(l / 100, 1 - l / 100) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  });

  function makePuzzleDef(n, suffix, color) {
  const N = n, CELL_S = CELL[n];
  const BB = BX_BY(n);
  const BX = BB.bx, BY = BB.by;
  return {
    id: 'puzzle' + suffix,
    name: '数字拼图' + suffix,
    en: 'PUZZLE ' + (n * n - 1),
    desc: n === 3 ? '入门 3×3 · 轻松上手' : n === 5 ? '进阶 5×5 · 挑战极限' : '滑动方块 · 按顺序排好 1-15',
    color: color,
    music: 'chill',
    icon(g, x, y, s, t) {
      const seq = [1, 2, 4, 3];
      seq.forEach((n, i) => {
        const cx = x + (i % 2) * s * 1.2, cy = y + Math.floor(i / 2) * s * 1.2 + Math.sin(t * 3 + i) * 1.5;
        g.block(cx, cy, s, s, color);
        g.text(String(n), cx + s / 2, cy + s / 2 - 4, '#fff', 2, { center: true });
      });
    },
    start(env) {
      const s = {
        score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0,
        tiles: [], hole: { x: N - 1, y: N - 1 },
        moves: 0, time: 0, anims: [],
      };
      // 生成有序棋盘
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          if (x !== N - 1 || y !== N - 1) s.tiles.push({ n: y * N + x + 1, x, y, px: x, py: y });
      // 随机走 400 步打乱（保证有解）
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let last = null;
      for (let i = 0; i < 120 * N; i++) {
        const opts = dirs.filter(([dx, dy]) => {
          const hx = s.hole.x - dx, hy = s.hole.y - dy;
          return hx >= 0 && hx < N && hy >= 0 && hy < N && !(last && last[0] === -dx && last[1] === -dy);
        });
        const [dx, dy] = opts[U.ri(opts.length)];
        const tx = s.hole.x - dx, ty = s.hole.y - dy;
        const tile = s.tiles.find((t2) => t2.x === tx && t2.y === ty);
        if (tile) {
          tile.x = s.hole.x; tile.y = s.hole.y;
          s.hole.x = tx; s.hole.y = ty;
        }
        last = [dx, dy];
      }
      s.tiles.forEach((t2) => { t2.px = t2.x; t2.py = t2.y; });
      return s;
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      // 滑动动画
      for (let i = s.anims.length - 1; i >= 0; i--) {
        const a = s.anims[i];
        a.t -= dt * 6;
        if (a.t <= 0) s.anims.splice(i, 1);
      }
      const MOVES = {
        left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1],
      };
      for (const k of Object.keys(MOVES)) {
        if (!Input.took(k)) continue;
        const [dx, dy] = MOVES[k];
        const tx = s.hole.x + dx, ty = s.hole.y + dy;
        if (tx < 0 || tx >= N || ty < 0 || ty >= N) { Sound.sfx.hit(); continue; }
        const tile = s.tiles.find((t2) => t2.x === tx && t2.y === ty);
        if (!tile) continue;
        tile.px = tile.x; tile.py = tile.y;
        tile.x = s.hole.x; tile.y = s.hole.y;
        s.hole.x = tx; s.hole.y = ty;
        s.anims.push({ tile, t: 1 });
        s.moves++;
        Sound.sfx.flip();
        // 检查完成
        const done = s.tiles.every((t2) => t2.n === t2.y * N + t2.x + 1);
        if (done) {
          s.won = true; s.over = true;
          s.score = Math.max(0, 5000 - s.moves * 20 - Math.floor(s.time) * 10);
          Sound.sfx.win();
          g.flash(color + '44', 0.6);
        }
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'MOVE', s.moves);
      g.text('时间 ' + Math.floor(s.time) + 's', 150, 38, '#9aa0ff', 1, { center: true });
      g.text('方向键滑动 · 排成 1→15', 150, 50, '#5d628f', 1, { center: true });
      // 棋盘底
      g.rect(BX - 6, BY - 6, N * CELL_S + 12, N * CELL_S + 12, '#1a1440');
      g.frame(BX - 6, BY - 6, N * CELL_S + 12, N * CELL_S + 12, '#b455ff66', 2);
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          g.rect(BX + x * CELL_S + 2, BY + y * CELL_S + 2, CELL_S - 4, CELL_S - 4, 'rgba(180,85,255,0.05)');
      // 方块
      for (const t2 of s.tiles) {
        const anim = s.anims.find((a) => a.tile === t2);
        let x = t2.x, y = t2.y;
        if (anim) {
          x = t2.px + (t2.x - t2.px) * (1 - anim.t);
          y = t2.py + (t2.y - t2.py) * (1 - anim.t);
        }
        const px = BX + x * CELL_S, py = BY + y * CELL_S;
        const col = TILE_COLORS[t2.n];
        g.block(px + 3, py + 3, CELL_S - 6, CELL_S - 6, col);
        g.rect(px + 6, py + 6, CELL_S - 12, 3, '#ffffff33');
        g.text(String(t2.n), px + CELL_S / 2, py + CELL_S / 2 - 6, '#ffffff', 3, { center: true, glow: 5 });
      }
      // 目标提示
      g.text('COMPLETE 1-' + (N * N - 1) + '!', 150, BY + N * CELL_S + 18, color, 2, { center: true, glow: 6 });
    },
  };
  }

  window.registerGame(makePuzzleDef(4, '', '#b455ff'));
  window.registerGame(makePuzzleDef(3, '入门', '#30ff8e'));
  window.registerGame(makePuzzleDef(5, '进阶', '#ff7ab8'));
})();
