/* ============ 记忆翻牌 ============ */
(function () {
  const U = window.GameUtil;
  const CELL = 50, GAP = 6;

  // 8 种像素小图标（绘制函数）
  const ICONS = [
    (g, x, y, s) => { g.text('♥', x + s / 2, y + s / 2 - 5, '#ff4d5e', 3, { center: true }); },
    (g, x, y, s) => { g.text('★', x + s / 2, y + s / 2 - 5, '#ffd60a', 3, { center: true }); },
    (g, x, y, s) => { g.block(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, '#30ff8e'); g.rect(x + s * 0.35, y + s * 0.35, s * 0.3, s * 0.3, '#0b0a1e'); },
    (g, x, y, s) => { g.text('◆', x + s / 2, y + s / 2 - 5, '#2de2ff', 3, { center: true }); },
    (g, x, y, s) => { g.text('↑', x + s / 2, y + s / 2 - 5, '#ff7ab8', 3, { center: true }); },
    (g, x, y, s) => { g.block(x + s * 0.25, y + s * 0.45, s * 0.5, s * 0.35, '#3f8cff'); g.block(x + s * 0.42, y + s * 0.15, s * 0.16, s * 0.35, '#b8c4dd'); },
    (g, x, y, s) => { g.text('+', x + s / 2, y + s / 2 - 5, '#ff9f40', 3, { center: true }); },
    (g, x, y, s) => { g.block(x + s * 0.15, y + s * 0.6, s * 0.7, s * 0.18, '#b455ff'); g.block(x + s * 0.35, y + s * 0.25, s * 0.3, s * 0.3, '#d1b3ff'); },
    (g, x, y, s) => { g.block(x + s * 0.2, y + s * 0.25, s * 0.6, s * 0.14, '#ff9f40'); g.block(x + s * 0.2, y + s * 0.45, s * 0.6, s * 0.14, '#ff9f40'); g.block(x + s * 0.44, y + s * 0.2, s * 0.14, s * 0.6, '#ffcf8a'); },
    (g, x, y, s) => { g.text('→', x + s / 2, y + s / 2 - 5, '#2de2ff', 3, { center: true }); },
  ];

  function makeMemoryDef(pairs, suffix, color) {
  const N = pairs === 10 ? 5 : 4; // 每行卡数
  const ROWS_N = (pairs * 2) / N;
  const BX = (300 - (N * CELL + (N - 1) * GAP)) / 2;
  const BY = pairs === 10 ? 84 : 92;
  return {
    id: 'memory' + suffix,
    name: '记忆翻牌' + suffix,
    en: 'MEMORY' + (suffix ? ' ' + pairs : ''),
    desc: pairs === 10 ? '进阶 10 对 · 考验记忆' : '找出全部 8 对图案',
    color,
    music: 'chill',
    icon(g, x, y, s, t) {
      const open = Math.sin(t * 2) > 0;
      g.block(x + s * 0.25, y + s * 0.4, s * 1.5, s * 1.5, open ? '#ffd60a' : '#3a3a6a');
      if (open) g.text('?', x + s, y + s * 0.85, '#7a5a00', 2, { center: true });
      g.block(x + s * 1.5, y + s * 0.7, s * 1.2, s * 1.2, open ? '#3a3a6a' : '#ffd60a');
    },
    start(env) {
      const deck = [];
      for (let i = 0; i < pairs; i++) { deck.push(i, i); }
      U.shuffle(deck);
      const cards = deck.map((icon, idx) => ({
        icon, x: idx % N, y: Math.floor(idx / N),
        state: 'down', flip: 0, // flip: 0合上 1翻开（动画插值）
      }));
      return { score: 0, over: false, won: false, level: 1, speed: env.speed, hi: 0, cards, first: null, second: null, lockT: 0, moves: 0, time: 0, matched: 0 };
    },
    update(s, dt, g) {
      if (s.over) return;
      s.time += dt;
      // 翻面动画
      for (const c of s.cards) {
        const target = c.state === 'down' ? 0 : 1;
        c.flip += (target - c.flip) * Math.min(1, dt * 12);
      }
      // 不匹配翻回
      if (s.lockT > 0) {
        s.lockT -= dt;
        if (s.lockT <= 0 && s.first && s.second) {
          s.first.state = 'down'; s.second.state = 'down';
          s.first = null; s.second = null;
        }
        return;
      }
      // 点击翻牌：上下左右把光标移动到卡上，A 键翻开 —— 触屏/鼠标直接点卡
      const pick = (card) => {
        if (!card || card.state !== 'down') return false;
        card.state = 'up';
        Sound.sfx.flip();
        if (!s.first) { s.first = card; return true; }
        s.second = card;
        s.moves++;
        if (s.first.icon === card.icon) {
          s.first.state = 'match'; card.state = 'match';
          s.matched++;
          s.score += 100 + Math.max(0, 200 - s.moves * 5);
          Sound.sfx.coin();
          const px = BX + card.x * (CELL + GAP) + CELL / 2, py = BY + card.y * (CELL + GAP) + CELL / 2;
          g.burst(px, py, '#ffd60a', 14, 120);
          s.first = null; s.second = null;
          if (s.matched >= pairs) {
            s.won = true; s.over = true;
            s.score += Math.max(0, 1000 - Math.floor(s.time) * 10);
            Sound.sfx.win();
            g.flash(color + '33', 0.5);
          }
        } else {
          s.lockT = 0.65;
        }
        return true;
      };
      // 鼠标/触屏点选
      if (Input.pointer && Input.pointer.inside && Input.took('a')) {
        const cx = Math.floor((Input.pointer.x - BX) / (CELL + GAP));
        const cy = Math.floor((Input.pointer.y - BY) / (CELL + GAP));
        pick(s.cards.find((c) => c.x === cx && c.y === cy));
        return;
      }
      // 键盘光标
      s.cur = s.cur || { x: 0, y: 0 };
      if (Input.took('left')) { s.cur.x = (s.cur.x + N - 1) % N; Sound.sfx.menu(); }
      if (Input.took('right')) { s.cur.x = (s.cur.x + 1) % N; Sound.sfx.menu(); }
      if (Input.took('up')) { s.cur.y = (s.cur.y + N - 1) % N; Sound.sfx.menu(); }
      if (Input.took('down')) { s.cur.y = (s.cur.y + 1) % N; Sound.sfx.menu(); }
      if (Input.took('drop') || Input.took('start')) {
        pick(s.cards.find((c) => c.x === s.cur.x && c.y === s.cur.y));
      }
    },
    draw(s, g) {
      g.clear('#0b0a1e');
      g.hud(s.score, s.hi, 'PAIR', s.matched + '/' + pairs);
      g.text('翻牌配对 · 点击卡片或空格翻牌', 150, 38, '#9aa0ff', 1, { center: true });
      for (const c of s.cards) {
        const px = BX + c.x * (CELL + GAP), py = BY + c.y * (CELL + GAP);
        const isDown = c.state === 'down';
        const openness = isDown ? 1 - c.flip : c.flip; // 合上时 1→0，翻开时 0→1
        const w = CELL * (0.3 + 0.7 * openness);
        const cx = px + CELL / 2;
        if (isDown) {
          // 卡背
          g.rect(cx - w / 2, py + 3, w, CELL - 6, '#3a3a6a');
          g.frame(cx - w / 2, py + 3, w, CELL - 6, '#5d5d9f', 1);
          if (w > 20) g.text('?', cx, py + CELL / 2 - 6, '#8f8fd0', 2, { center: true });
        } else {
          g.rect(cx - w / 2, py + 3, w, CELL - 6, c.state === 'match' ? '#2a4a33' : '#eee9d8');
          g.frame(cx - w / 2, py + 3, w, CELL - 6, c.state === 'match' ? '#30ff8e' : '#c9c2a8', 1);
          if (w > 20) ICONS[c.icon](g, px, py, CELL);
        }
        // 键盘光标
        if (s.cur && s.cur.x === c.x && s.cur.y === c.y) {
          g.frame(px - 2, py + 1, CELL + 4, CELL + 2, '#ffd60a', 1);
        }
      }
      g.text('步数 ' + s.moves + ' · 时间 ' + Math.floor(s.time) + 's', 150, BY + ROWS_N * (CELL + GAP) + 6, '#5d628f', 1, { center: true });
    },
  };
  }

  window.registerGame(makeMemoryDef(8, '', '#ffd60a'));
  window.registerGame(makeMemoryDef(10, '进阶', '#ff7ab8'));
})();
