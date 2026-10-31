#!/usr/bin/env node
/* 真实 Chrome（headless CDP）端到端验证：
 * 1. 页面加载无 JS 异常
 * 2. 菜单 → 速度选择 → 进入俄罗斯方块
 * 3. 模拟按键游玩数秒无报错
 * 4. 直接把棋盘填满验证"顶出判负"真实生效（mode 变为 over）
 * 5. 检查震动按钮在不支持 vibrate 的平台自动隐藏
 */
'use strict';
const { execFile } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;
const URL = 'http://127.0.0.1:8899/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error('Chrome CDP 端口未就绪');
}

const chrome = execFile(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--mute-audio',
  '--user-data-dir=/tmp/brick-game-test-profile', '--window-size=420,860', 'about:blank',
], () => {});

let ws, msgId = 0;
const pending = new Map();
const errors = [];

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evaljs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('页面内执行失败: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result && r.result.value;
}
const key = (code, type) => evaljs(`window.dispatchEvent(new KeyboardEvent('${type}', {code:'${code}'}))`);
const tap = async (code) => { await key(code, 'keydown'); await key(code, 'keyup'); };

(async () => {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result || m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('异常: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);

  console.log('1. 页面标题:', await evaljs('document.title'));
  console.log('   注册游戏数:', await evaljs('window.__GAMES.length'));
  console.log('   初始模式:', await evaljs('window.__shell.mode'));

  // 支持作者弹窗在启动 2.5s 后弹出（模态，拦截游戏键盘）：轮询等它出现后 Esc 关闭
  for (let i = 0; i < 10; i++) {
    const shown = await evaljs(`document.querySelector('.support-mask') && document.querySelector('.support-mask').classList.contains('show')`);
    if (shown) { await tap('Escape'); await sleep(300); break; }
    await sleep(500);
  }
  console.log('   支持弹窗已处理:', await evaljs(`!document.querySelector('.support-mask').classList.contains('show')`));

  // 菜单 → 速度 → 开局（俄罗斯方块是第一个）
  await tap('Enter'); await sleep(300);
  console.log('2. 速度选择模式:', await evaljs('window.__shell.mode'));
  await tap('Enter'); await sleep(500);
  console.log('   对局模式:', await evaljs('window.__shell.mode'), '| 游戏:', await evaljs('window.__shell.def.id'));

  // 模拟游玩 6 秒：随机方向 + 旋转 + 速降
  const acts = ['ArrowLeft', 'ArrowRight', 'KeyZ', 'Space', 'ArrowDown'];
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const a = acts[Math.floor(Math.random() * acts.length)];
    await key(a, 'keydown');
    await sleep(60 + Math.random() * 120);
    await key(a, 'keyup');
  }
  console.log('3. 游玩 6 秒后模式:', await evaljs('window.__shell.mode'), '| 得分:', await evaljs('window.__shell.s.score'));

  // 随机游玩可能中途死亡结算回菜单/速度页（模式漂移）：确保回到对局再验证顶出判负
  for (let i = 0; i < 6; i++) {
    const mode = await evaljs('window.__shell.mode');
    if (mode === 'play') break;
    if (mode === 'over') { await tap('Enter'); }       // 结算 → 菜单
    else if (mode === 'menu') { await tap('Enter'); await sleep(300); await tap('Enter'); } // 重新开局
    else if (mode === 'speed') { await tap('Enter'); }
    await sleep(600);
  }

  // 直接填满棋盘验证顶出判负
  await evaljs(`(function(){ const s = window.__shell.s;
    if (window.__shell.mode !== 'play') return 'not-playing';
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) if (x !== 4) s.board[y][x] = '#5a6a8a';
    return 'filled'; })()`).then((r) => console.log('4. 棋盘已填井:', r));
  await key('ArrowDown', 'keydown');
  let over = false;
  for (let i = 0; i < 40; i++) { await sleep(500); if ((await evaljs('window.__shell.mode')) === 'over') { over = true; break; } }
  await key('ArrowDown', 'keyup');
  console.log('   顶出判负:', over ? '生效（mode=over）' : '未生效！');
  if (over) console.log('   结算分:', await evaljs('window.__shell.s.score'), '| 最高分:', await evaljs('window.__shell.s.hi'));

  // 桌面 Chrome 暴露 vibrate 但无马达：按钮应自动隐藏
  console.log('5. navigator.vibrate:', await evaljs('typeof navigator.vibrate'),
    '| VIBE 按钮隐藏(桌面应为true):', await evaljs('document.getElementById("btnVibe").classList.contains("hidden")'));

  const gameErrs = await evaljs('window.__gameErrors || []');
  console.log('6. 游戏内捕获错误:', gameErrs.length ? gameErrs : '无');
  console.log('   控制台/异常错误:', errors.length ? errors : '无');

  const fail = !over || gameErrs.length > 0 || errors.length > 0;
  console.log(fail ? '\n浏览器验证：存在失败项' : '\n浏览器验证：全部通过');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('测试脚本错误:', e.message); process.exitCode = 1; })
  .finally(() => { try { ws && ws.close(); } catch (e) {} chrome.kill(); });
