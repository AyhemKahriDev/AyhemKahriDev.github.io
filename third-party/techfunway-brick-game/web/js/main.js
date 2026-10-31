/* ============ 主控：菜单 / 速度选择 / 对局 / 暂停 / 结算 / 最高分 ============ */
(function () {
  const canvas = document.getElementById('screen');
  const screen = new ScreenEngine.Screen(canvas);
  const g0 = null;
  Input.bindGestures(canvas);
  Input.setScreen(screen);

  window.addEventListener('resize', () => screen.resize());
  if (window.ResizeObserver) new ResizeObserver(() => screen.resize()).observe(canvas);
  window.addEventListener('orientationchange', () => setTimeout(() => screen.resize(), 250));

  /* ---------- 最高分 ---------- */
  const getHi = (id) => { try { return parseInt(localStorage.getItem('bg_hi_' + id)) || 0; } catch (e) { return 0; } };
  const setHi = (id, v) => { try { localStorage.setItem('bg_hi_' + id, String(v)); } catch (e) {} };

  const GAMES = window.__GAMES || [];
  const shell = {
    mode: 'menu', // menu | speed | play | pause | over
    cur: 0, curSpeed: 3,
    def: null, s: null, newHi: false,
    blink: 0,
  };
  // 视口高度兼容：老内核（微信 X5 等）不支持 dvh，用 JS 变量兜底，
  // 防止整机高度塌陷导致屏幕区撑大、控制区（方向键上键）被裁出屏幕
  const applyAppH = () => document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px');
  applyAppH();
  window.addEventListener('resize', applyAppH);
  window.addEventListener('orientationchange', () => setTimeout(applyAppH, 250));

  window.__shell = shell; // 调试用

  /* ---------- 功能按钮 ---------- */
  const btnSound = document.getElementById('btnSound');
  btnSound.classList.toggle('off', !Sound.on);
  Input.bindFn('btnSound', () => {
    const on = Sound.toggle();
    btnSound.classList.toggle('off', !on);
    if (on) startMusic();
  });
  Input.bindFn('btnPause', () => togglePause());
  Input.bindFn('btnReset', () => toMenu());
  // 全屏切换：铺满整个屏幕，隐藏窗口按钮（ESC 或再按退出）
  function toggleFullscreen() {
    const doc = document, el = doc.documentElement;
    const cur = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!cur) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) exit.call(doc);
    }
  }
  window.__toggleFullscreen = toggleFullscreen;
  Input.bindFn('btnFull', toggleFullscreen);
  // 震动开关：按键触感 + 关键事件长震，设置记忆在 localStorage
  const btnVibe = document.getElementById('btnVibe');
  btnVibe.classList.toggle('off', !(window.Vibe && window.Vibe.on));
  // 桌面 Chrome 也暴露 navigator.vibrate 但无马达纯空调用，
  // 需同时要求触屏设备特征，否则按钮看似可用却永远不震
  const vibeSupported = !!navigator.vibrate &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  if (!vibeSupported) btnVibe.classList.add('hidden');
  Input.bindFn('btnVibe', () => {
    const on = window.Vibe.toggle();
    btnVibe.classList.toggle('off', !on);
  });

  /* ---------- 支持作者（收款码 + 已支持金额上报） ---------- */
  // 版本号与服务启动标识从 api/health 取回，用于弹窗频控：
  // 已支持 → 本版本不再提示；点关闭 → 本次运行（服务重启前）不再提示。
  // 对局进行中拿到响应也不弹，挂起等待回菜单后再弹。
  // 路径用页面目录推导（相对），飞牛网关 /app/<包名>/ 前缀与根路径部署都成立。
  const apiBase = new URL('.', location.href).pathname;
  let pendingSupport = false;
  fetch(apiBase + 'api/health')
    .then((r) => r.json())
    .then((d) => {
      window.__BG_VERSION = (d && d.version) || '';
      window.__BG_START_ID = (d && d.startedAt) || '';
    })
    .catch(() => {})
    .then(() => {
      if (window.SupportAuthor) {
        if (shell.mode === 'play') pendingSupport = true;
        else window.SupportAuthor.maybeShow(2500);
      }
    });

  /* ---------- 功能按键（KeyF 全屏等） ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && window.__shell && window.__shell.mode === 'play') toggleFullscreen();
  });
  // 支持作者入口（品牌栏 ♥，随时可点，不打断游戏状态）
  if (window.SupportAuthor) Input.bindFn('btnSupport', () => window.SupportAuthor.open());
  if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) {
    const bf = document.getElementById('btnFull');
    if (bf) bf.classList.add('hidden');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && shell.mode === 'play') togglePause();
  });
  function startMusic() {
    if (!Sound.on) return;
    if (shell.mode === 'play' && shell.def && shell.def.music) Sound.music.play(shell.def.music);
    else if (shell.mode !== 'play') Sound.music.play('chill');
  }

  /* ---------- 支持弹窗延后触发：对局中不弹，等回菜单/结算再弹 ---------- */
  function flushSupport() {
    if (pendingSupport && window.SupportAuthor && shell.mode !== 'play') {
      pendingSupport = false;
      window.SupportAuthor.maybeShow(600);
    }
  }
  setInterval(flushSupport, 1000);

  /* ---------- 流程控制 ---------- */
  function launchGame(def) {
    shell.def = def;
    shell.s = def.start({ speed: shell.curSpeed });
    shell.s.hi = getHi(def.id);
    shell.mode = 'play';
    Input.clear();
    startMusic();
  }
  function toMenu() {
    shell.mode = 'menu';
    shell.def = null;
    shell.s = null;
    Input.clear();
    startMusic();
  }
  function togglePause() {
    if (shell.mode === 'play') { shell.mode = 'pause'; Sound.music.stop(); }
    else if (shell.mode === 'pause') { shell.mode = 'play'; startMusic(); }
    else if (shell.mode === 'menu' || shell.mode === 'speed') { Sound.sfx.select(); }
    Input.clear();
  }

  /* ---------- 输入 onTap（解锁音频后补启动音乐） ---------- */
  Input.onTap(() => { if (!Sound.music.playing && Sound.on) startMusic(); });

  /* ---------- 主循环（rAF + 定时器双驱动，页面后台也不冻结） ---------- */
  let lastT = performance.now();
  function tick() {
    const now = performance.now();
    if (now - lastT < 8) return; // 双驱动去重
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.05) dt = 0.05;
    screen.update(dt);
    shell.blink += dt;

    const g = screen.frameBegin();
    try {
      if (shell.mode === 'menu') updateMenu(dt, g);
      else if (shell.mode === 'speed') updateSpeed(dt, g);
      else if (shell.mode === 'play') updatePlay(dt, g);
      else if (shell.mode === 'pause') updatePause(g);
      else if (shell.mode === 'over') { shell.def.draw(shell.s, g); drawOver(g); }
    } catch (err) {
      console.error('[game error]', err);
      const arr = (window.__gameErrors = window.__gameErrors || []);
      if (arr.length < 20) arr.push(String((err && err.stack) || err));
    }
    screen.frameEnd();
  }
  requestAnimationFrame(function raf() { tick(); requestAnimationFrame(raf); });
  setInterval(tick, 16);

  /* ---------- 菜单（3 列 × 6 行 分页） ---------- */
  const CARD_W = 94, CARD_H = 64, GAP = 4, COLS_N = 3, PAGE_N = 18;
  function menuGrid(pageIdx) {
    const col = pageIdx % COLS_N, row = Math.floor(pageIdx / COLS_N);
    return { x: 5 + col * (CARD_W + GAP), y: 54 + row * (CARD_H + GAP) };
  }
  function updateMenu(dt, g) {
    const last = GAMES.length - 1;
    if (Input.took('left') && shell.cur > 0) { shell.cur--; Sound.sfx.menu(); }
    if (Input.took('right') && shell.cur < last) { shell.cur++; Sound.sfx.menu(); }
    if (Input.took('up') && shell.cur >= COLS_N) { shell.cur -= COLS_N; Sound.sfx.menu(); }
    if (Input.took('down') && shell.cur + COLS_N <= last) { shell.cur += COLS_N; Sound.sfx.menu(); }
    if (Input.took('a') || Input.took('start') || Input.took('drop')) { shell.mode = 'speed'; Sound.sfx.select(); }
    if (Input.pointer && Input.pointer.down && Input.pointer.inside) {
      const p = Input.pointer;
      const page = Math.floor(shell.cur / PAGE_N);
      for (let i = 0; i < PAGE_N; i++) {
        const idx = page * PAGE_N + i;
        if (idx >= GAMES.length) break;
        const c = menuGrid(i);
        if (p.x > c.x && p.x < c.x + CARD_W && p.y > c.y && p.y < c.y + CARD_H) {
          if (shell.cur !== idx) { shell.cur = idx; Sound.sfx.menu(); }
          break;
        }
      }
    }
    drawMenu(g);
  }
  function drawMenu(g) {
    g.clear('#0b0a1e');
    const off = (g.t * 10) % 24;
    for (let y = -1; y < 22; y++)
      for (let x = -1; x < 14; x++)
        if ((x + y) % 2 === 0) g.rect(x * 24 - off, y * 24 - (g.t * 6) % 48, 22, 22, 'rgba(45,226,255,0.025)');
    g.text('BRICK GAME', 150, 8, '#2de2ff', 2, { center: true, glow: 10 });
    g.text('SUPER DELUXE · ' + GAMES.length + ' IN 1', 150, 26, '#ff7ab8', 1, { center: true, glow: 4 });
    g.text('HI ' + Math.max(...GAMES.map((d) => getHi(d.id))), 294, 8, '#ffd60a', 1, { right: true });
    const page = Math.floor(shell.cur / PAGE_N);
    const start = page * PAGE_N, end = Math.min(GAMES.length, start + PAGE_N);
    for (let i = start; i < end; i++) {
      const def = GAMES[i], c = menuGrid(i - start);
      const sel = i === shell.cur;
      const pulse = sel ? 1 + Math.sin(g.t * 6) * 0.012 : 1;
      g.ctx.save();
      g.ctx.translate(c.x + CARD_W / 2, c.y + CARD_H / 2);
      g.ctx.scale(pulse, pulse);
      g.ctx.translate(-(c.x + CARD_W / 2), -(c.y + CARD_H / 2));
      g.rect(c.x, c.y, CARD_W, CARD_H, sel ? 'rgba(45,226,255,0.13)' : 'rgba(30,26,70,0.85)');
      g.frame(c.x, c.y, CARD_W, CARD_H, sel ? def.color : '#2a265a', 1);
      if (sel) g.frame(c.x - 2, c.y - 2, CARD_W + 4, CARD_H + 4, def.color + '88', 1);
      try { def.icon(g, c.x + CARD_W / 2 - 14, c.y + 2, 10, g.t); } catch (e) { console.error('[icon]', def.id, e); }
      g.cnText(def.name, c.x + CARD_W / 2, c.y + 36, sel ? def.color : '#9a9ed0', 10, 'center');
      g.text('HI ' + getHi(def.id), c.x + CARD_W / 2, c.y + 52, sel ? '#ffd60a' : '#4a4e88', 1, { center: true });
      g.ctx.restore();
      if (sel) {
        const bob = Math.sin(g.t * 5) * 1.5;
        g.text('▶', c.x + 3, c.y + 3 + bob, def.color, 1, { glow: 6 });
      }
    }
    // 页码
    const pages = Math.ceil(GAMES.length / PAGE_N);
    for (let p = 0; p < pages; p++) {
      const dx = 150 - (pages - 1) * 8 + p * 16;
      g.block(dx - 3, 444, 6, 6, p === page ? '#2de2ff' : '#2a265a');
    }
    g.text('P' + (page + 1) + '/' + pages, 294, 441, '#5d628f', 1, { right: true });
    g.rect(0, 462, 300, 38, 'rgba(10,8,40,0.9)');
    g.rect(0, 462, 300, 1, '#2de2ff44');
    const def = GAMES[shell.cur];
    g.cnText(def.desc, 150, 468, '#b8bce8', 10, 'center');
    g.text('PRESS A / ENTER', 150, 484, '#2de2ff', 1, { center: true });
  }

  /* ---------- 速度选择 ---------- */
  function updateSpeed(dt, g) {
    if (Input.took('left')) { shell.curSpeed = (shell.curSpeed + 9) % 10; Sound.sfx.menu(); }
    if (Input.took('right')) { shell.curSpeed = (shell.curSpeed + 1) % 10; Sound.sfx.menu(); }
    if (Input.took('a') || Input.took('start') || Input.took('drop')) {
      Sound.sfx.select();
      launchGame(GAMES[shell.cur]);
    }
    if (Input.took('b') || Input.took('back')) { shell.mode = 'menu'; Sound.sfx.menu(); }
    drawSpeed(g);
  }
  function drawSpeed(g) {
    g.clear('#0b0a1e');
    const def = GAMES[shell.cur];
    g.text(def.en, 150, 60, def.color, 3, { center: true, glow: 10 });
    g.cnText(def.name + ' · 选择速度', 150, 92, '#b8bce8', 12, 'center');
    for (let i = 0; i < 10; i++) {
      const x = 22 + i * 26, y = 150, sel = i === shell.curSpeed;
      const on = i <= shell.curSpeed;
      if (sel) {
        g.rect(x - 3, y - 6, 22, 30, def.color + '33');
        g.frame(x - 3, y - 6, 22, 30, def.color, 1);
        g.text(String(i), x + 8, y, '#ffffff', 2, { center: true, glow: 6 });
      } else {
        g.text(String(i), x + 8, y + 2, on ? def.color + 'cc' : '#3a3e6a', 2, { center: true });
      }
    }
    // 速度示意条
    for (let i = 0; i < 10; i++) {
      g.rect(40 + i * 22, 200, 16, 10 + i * 3, i <= shell.curSpeed ? def.color + (i === shell.curSpeed ? '' : '88') : '#262a52');
    }
    g.cnText('越快得分越刺激 · 0 = 悠闲', 150, 260, '#6a6ea8', 10, 'center');
    g.text('A START   B BACK', 150, 290, '#2de2ff', 1, { center: true });
    if (Math.sin(g.t * 4) > 0) g.text('READY?', 150, 330, '#ffd60a', 2, { center: true, glow: 8 });
  }

  /* ---------- 对局 ---------- */
  function updatePlay(dt, g) {
    const s = shell.s, def = shell.def;
    if (Input.took('start')) { togglePause(); return; }
    if (Input.took('back')) { toMenu(); return; }
    def.update(s, dt, g);
    if (s.score > s.hi) s.hi = s.score;
    if (s.over && !s._overHandled) {
      s._overHandled = true;
      shell.mode = 'over';
      const oldHi = getHi(def.id);
      shell.newHi = s.score > oldHi && s.score > 0;
      setHi(def.id, s.hi);
      if (window.Vibe) Vibe.event(s.won ? [40, 40, 40] : [60, 40, 60]);
      if (!s.won) Sound.sfx.over();
      Sound.music.stop();
      g.flash(s.won ? '#30ff8e55' : '#ff3b3044', 0.5);
    }
    def.draw(s, g);
  }

  /* ---------- 覆盖层 ---------- */
  function updatePause(g) {
    shell.def.draw(shell.s, g);
    drawPause(g);
    if (Input.took('start') || Input.took('a')) { shell.mode = 'play'; startMusic(); Input.clear(); return; }
    if (Input.took('back')) toMenu();
  }
  function drawPause(g) {
    g.rect(0, 0, 300, 500, 'rgba(5,4,20,0.72)');
    g.frame(60, 200, 180, 100, '#2de2ff', 2);
    g.rect(62, 202, 176, 96, 'rgba(11,10,30,0.9)');
    g.text('PAUSED', 150, 222, '#2de2ff', 3, { center: true, glow: 10 });
    g.cnText('按 Enter / A 继续', 150, 262, '#b8bce8', 11, 'center');
    g.cnText('Esc 返回菜单', 150, 278, '#6a6ea8', 10, 'center');
  }
  function drawOver(g) {
    const s = shell.s;
    g.rect(0, 0, 300, 500, 'rgba(5,4,20,0.72)');
    const h = 150, y = 170;
    g.frame(40, y, 220, h, s.won ? '#30ff8e' : '#ff4d5e', 2);
    g.rect(42, y + 2, 216, h - 4, 'rgba(11,10,30,0.92)');
    g.text(s.won ? 'YOU WIN!' : 'GAME OVER', 150, y + 18, s.won ? '#30ff8e' : '#ff4d5e', 2, { center: true, glow: 10 });
    g.text('SCORE ' + s.score, 150, y + 48, '#ffffff', 2, { center: true });
    g.text('HI ' + s.hi, 150, y + 72, '#ffd60a', 2, { center: true, glow: 4 });
    if (shell.newHi && Math.sin(g.t * 6) > -0.2) {
      g.text('NEW RECORD!', 150, y + 98, '#ff7ab8', 1, { center: true, glow: 8 });
    }
    g.cnText('按 A / Enter 返回菜单', 150, y + 120, '#b8bce8', 10, 'center');
    // 结算输入
    if (Input.took('a') || Input.took('start') || Input.took('drop')) toMenu();
    if (Input.took('back')) toMenu();
  }
})();
