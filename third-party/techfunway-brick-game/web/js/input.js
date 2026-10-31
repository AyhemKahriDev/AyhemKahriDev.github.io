/* ============ 输入系统：键盘 + 虚拟按键 + 画布手势 ============ */
(function () {
  // 震动反馈（Android/Chromium 支持；iOS Safari 无此 API 自动无效）
  const Vibe = {
    on: localStorage.getItem('bg_vibe') !== '0',
    tap(strength) {
      if (!this.on || !navigator.vibrate) return;
      try { navigator.vibrate(strength || 12); } catch (e) {}
    },
    event(pattern) {
      if (!this.on || !navigator.vibrate) return;
      try { navigator.vibrate(pattern); } catch (e) {}
    },
    toggle() {
      this.on = !this.on;
      localStorage.setItem('bg_vibe', this.on ? '1' : '0');
      if (this.on) this.tap(40);
      return this.on;
    },
  };
  window.Vibe = Vibe;
  const held = {};      // action -> bool
  const queue = [];     // 边沿触发动作队列
  const listeners = []; // 手势副作用（如解锁音频）

  function press(a) {
    held[a] = true;
    queue.push(a);
    if (queue.length > 8) queue.shift();
    Sound.unlock();
    for (const fn of listeners) fn(a);
  }
  function release(a) { held[a] = false; }

  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyZ: 'a', KeyJ: 'a', Space: 'drop',
    KeyX: 'b', KeyK: 'b',
    Enter: 'start', KeyP: 'start',
    Escape: 'back', Backspace: 'back',
  };

  // 弹窗（支持作者/金额填写）打开时按键交给弹窗：Enter/空格要触发按钮默认
  // 点击，方向键要在输入框里移动光标，都不能被游戏输入系统吃掉
  function modalOpen() {
    return !!document.querySelector('.support-mask.show');
  }

  window.addEventListener('keydown', (e) => {
    if (modalOpen()) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) press(a);
  });
  window.addEventListener('keyup', (e) => {
    if (modalOpen()) return;
    const a = KEYMAP[e.code];
    if (a) release(a);
  });

  // 虚拟按键
  document.querySelectorAll('[data-action]').forEach((btn) => {
    const a = btn.dataset.action;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      Vibe.tap(a === 'a' ? 35 : 25); // 按键触感：A 键稍强（10-18ms 在多数机型上几乎无感）
      press(a);
    };
    const up = (e) => { e.preventDefault(); btn.classList.remove('pressed'); release(a); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // 画布手势：左右滑动移动、快速下滑速降、轻点旋转
  let screenRef = null;
  function toDesign(e, canvas) {
    if (!screenRef) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * (canvas.width / r.width) - screenRef.ox) / screenRef.scale,
      y: ((e.clientY - r.top) * (canvas.height / r.height) - screenRef.oy) / screenRef.scale,
    };
  }
  function bindGestures(canvas) {
    let sx = 0, sy = 0, st = 0, tracking = false, moved = false, accX = 0;
    canvas.addEventListener('pointerdown', (e) => {
      tracking = true; moved = false; accX = 0;
      sx = e.clientX; sy = e.clientY; st = performance.now();
      const p = toDesign(e, canvas);
      Input.pointer = { x: p.x, y: p.y, down: true, inside: true };
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toDesign(e, canvas);
      if (Input.pointer) Input.pointer.x = p.x, Input.pointer.y = p.y, Input.pointer.inside = true;
      if (!tracking) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      accX += (e.clientX - sx); sx = e.clientX; sy = e.clientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      while (accX > 34) { press('right'); accX -= 34; moved = true; }
      while (accX < -34) { press('left'); accX += 34; moved = true; }
    });
    canvas.addEventListener('pointerleave', () => { if (Input.pointer) Input.pointer.inside = false; });
    const finish = (e) => {
      if (Input.pointer) Input.pointer.down = false;
      if (!tracking) return;
      tracking = false;
      const dt = performance.now() - st;
      const dy = e.clientY - sy;
      if (!moved && dt < 260) { Vibe.tap(25); press('a'); return; }       // 轻点 = 旋转
      if (dy > 60 && dt < 300) { Vibe.tap(35); press('drop'); return; }   // 快速下滑 = 速降
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', () => { tracking = false; if (Input.pointer) Input.pointer.down = false; });
  }

  // 功能键
  function bindFn(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); Sound.unlock(); fn(); });
  }

  window.Input = {
    held,
    pointer: null,
    setScreen(s) { screenRef = s; },
    /** 取出一个边沿触发的动作，无则 null */
    pop() { return queue.length ? queue.shift() : null; },
    /** 本帧是否触发了某动作 */
    took(a) {
      const i = queue.indexOf(a);
      if (i >= 0) { queue.splice(i, 1); return true; }
      return false;
    },
    clear() { queue.length = 0; },
    bindGestures,
    bindFn,
    onTap(fn) { listeners.push(fn); },
  };
})();
