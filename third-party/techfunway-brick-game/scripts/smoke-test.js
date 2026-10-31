#!/usr/bin/env node
/* ============ 全游戏冒烟测试 ============
 * 用 Node 模拟浏览器环境（canvas/localStorage/navigator/事件），
 * 加载 web/js 下全部脚本，对每个注册的游戏在多个速度档下
 * 注入随机输入跑数千帧 update+draw，捕获运行时报错。
 *
 * 用法：node scripts/smoke-test.js [-v]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'web', 'js');
const VERBOSE = process.argv.includes('-v');

/* ---------- DOM / 浏览器环境 mock ---------- */
function makeGradient() { return { addColorStop() {} }; }
function makeCtx() {
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      const fn = (...a) => {
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return makeGradient();
        if (k === 'createPattern') return {};
        if (k === 'measureText') return { width: 0 };
        if (k === 'getImageData') return { data: new Uint8ClampedArray(4) };
        return undefined;
      };
      t[k] = fn;
      return fn;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() {
  const ctx = makeCtx();
  return {
    width: 300, height: 500, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 300, height: 500, left: 0, top: 0 }),
    addEventListener() {},
  };
}
function makeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, dataset: {}, style: {},
  };
}
const listeners = {};
global.window = global;
global.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
global.document = {
  getElementById: () => makeEl(),
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : makeEl()),
  querySelector: () => null, // input.js modalOpen 等运行时探测，Node 环境视为无弹窗
  querySelectorAll: () => [],
  addEventListener() {},
  documentElement: { style: { setProperty() {} } },
  hidden: false,
};
const lsStore = new Map();
global.localStorage = {
  getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
};
Object.defineProperty(global, 'navigator', { value: { vibrate: () => true }, configurable: true });

/* ---------- 加载脚本（与 index.html 同序，跳过 main.js） ---------- */
const files = ['font.js', 'audio.js', 'screen.js', 'input.js'];
// 与 index.html 同序：tetris.js 定义了 registerGame，必须最先加载
const gameOrder = ['tetris.js', 'snake.js', 'racer.js', 'shooter.js', 'tank.js', 'frogger.js',
  'breakout.js', 'puzzle.js', 'memory.js', 'saucer.js', 'catch.js', 'sokoban.js', 'missile.js',
  'minis_puzzle.js', 'minis_arcade.js', 'minis_board.js', 'minis_board2.js', 'minis_fun.js'];
for (const f of gameOrder) files.push('games/' + f);
for (const f of files) {
  const code = fs.readFileSync(path.join(WEB, f), 'utf8');
  try {
    (0, eval)(code);
  } catch (e) {
    console.error(`[LOAD FAIL] ${f}: ${e.stack}`);
    process.exit(1);
  }
}

const GAMES = global.__GAMES || [];
console.log(`已加载 ${files.length} 个脚本，注册游戏 ${GAMES.length} 个`);

/* ---------- 输入注入 ---------- */
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX', 'Space', 'Enter'];
function fire(type, code) {
  for (const fn of listeners[type] || []) fn({ code, repeat: false, preventDefault() {} });
}
function tap(code) { fire('keydown', code); fire('keyup', code); }

/* ---------- 冒烟主流程 ---------- */
const screen = new global.ScreenEngine.Screen(makeCanvas());
const DT = 0.016;
let failures = 0;

function runGame(def, speed, maxFrames) {
  const s = def.start({ speed });
  let held = null;
  for (let f = 0; f < maxFrames; f++) {
    // 随机输入策略：换向 / 松开 / 点按 A、B、空格
    const r = Math.random();
    if (r < 0.12) {
      if (held) fire('keyup', held);
      held = KEYS[Math.floor(Math.random() * 4)];
      fire('keydown', held);
    } else if (r < 0.16 && held) {
      fire('keyup', held); held = null;
    } else if (r < 0.22) {
      tap(KEYS[4 + Math.floor(Math.random() * 4)]);
    }
    screen.update(DT);
    const g = screen.frameBegin();
    def.update(s, DT, g);
    def.draw(s, g);
    screen.frameEnd();
    if (s.over) return { frames: f + 1, over: true, score: s.score, won: !!s.won };
  }
  return { frames: maxFrames, over: false, score: s.score, won: !!s.won };
}

for (const def of GAMES) {
  // 图标渲染
  try {
    const g = screen.frameBegin();
    def.icon(g, 10, 10, 10, 1.5);
    screen.frameEnd();
  } catch (e) {
    failures++;
    console.error(`[ICON FAIL] ${def.id}: ${e.message}`);
  }
  for (const speed of [0, 5, 9]) {
    try {
      const res = runGame(def, speed, 1500);
      const tag = res.over ? `结束@${res.frames}帧${res.won ? '(胜)' : ''}` : '存活1500帧';
      console.log(`  [OK] ${def.id.padEnd(14)} 速度${speed}  ${tag}  得分${res.score}`);
    } catch (e) {
      failures++;
      console.error(`[FAIL] ${def.id} 速度${speed}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
    }
  }
}

/* ---------- 专项：俄罗斯方块顶出判负 ---------- */
console.log('\n专项：俄罗斯方块顶出（lock out）判负');
const tetris = GAMES.find((d) => d.id === 'tetris');
if (tetris) {
  const s = tetris.start({ speed: 9 });
  // 挖一口井：只留第 4 列空，其余全部填满，方块必然在井里堆到顶
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 10; x++)
      if (x !== 4) s.board[y][x] = '#5a6a8a';
  // 消行会被触发（第 4 列填上时整行满），但至少应很快判负而不是死循环
  fire('keydown', 'ArrowDown'); // 按住加速
  let over = false;
  try {
    for (let f = 0; f < 8000 && !s.over; f++) {
      screen.update(DT);
      const g = screen.frameBegin();
      tetris.update(s, DT, g);
      tetris.draw(s, g);
      screen.frameEnd();
    }
    over = s.over;
  } catch (e) {
    failures++;
    console.error(`[FAIL] 顶出测试抛错: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
  }
  fire('keyup', 'ArrowDown');
  if (over) console.log('  [OK] 方块堆到顶部后游戏正常结束');
  else { failures++; console.error('  [FAIL] 8000 帧后仍未判负（顶出死循环 bug 仍在）'); }
}

console.log(failures ? `\n共 ${failures} 处失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
