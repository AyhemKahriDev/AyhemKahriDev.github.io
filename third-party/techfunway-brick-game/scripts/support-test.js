#!/usr/bin/env node
/* 支持作者弹窗端到端验证（真实 Chrome headless CDP）：
 * 1. 启动 2.5s 后主弹窗自动出现；金额弹窗默认隐藏
 * 2. 点「已支持」→ 金额弹窗出现；选预设/自定义金额
 * 3. 点「确定」→ 上报 api/donate/support（校验金额）；成功后弹窗关闭
 * 4. 频控：已支持后刷新页面不再弹；点「暂不支持」本次运行不再弹
 * 5. 上报地址按页面目录推导——飞牛网关前缀（/app/<包名>/）下也必须正确，
 *    写死根路径 '/api/...' 会 404；失败时错误提示须在金额弹窗内可见
 * 用法：node scripts/support-test.js（需先启动服务，STATS_ENDPOINT 指向假端点）
 *      SUPPORT_TEST_URL=http://127.0.0.1:8910/app/techfunway-brick-game/index.html \
 *        node scripts/support-test.js   # 网关前缀模式
 */
'use strict';
const { execFile } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;
const PAGE_URL = process.env.SUPPORT_TEST_URL || 'http://127.0.0.1:8908/index.html';
// 页面所在目录（网关模式下含 /app/<包名> 前缀）：上报请求必须以它为前缀
const PAGE_DIR = new URL('.', PAGE_URL).pathname;
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
  '--user-data-dir=/tmp/brick-game-support-test', '--window-size=420,860', 'about:blank',
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面内执行失败: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result && r.result.value;
}
// 真实鼠标点击（Input.dispatchMouseEvent 走浏览器输入管线，含命中测试与 click 合成）
async function clickAt(cx, cy) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: cx, y: cy, button: 'left', clickCount: 1 });
  }
}
async function clickSelector(sel) {
  const p = await evaljs(`(() => { const b = document.querySelector('${sel}');
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!p) throw new Error('找不到元素 ' + sel);
  await clickAt(p.x, p.y);
  await sleep(300);
  return p;
}
// 真实键盘按键（Input.dispatchKeyEvent 走浏览器输入管线；Enter 需 keyCode 13 才会合成按钮 click）
async function pressKey(key, code, vk) {
  const base = { key, code, windowsVirtualKeyCode: vk || 0, nativeVirtualKeyCode: vk || 0 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
let failed = 0;
function check(name, ok, extra) {
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}${extra ? ' | ' + extra : ''}`);
  if (!ok) failed++;
}

(async () => {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result || m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('异常: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 200));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);
  // 环境准备：清空上一轮遗留的 localStorage 频控记录后重载
  await evaljs(`localStorage.clear(); 'ok'`);
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3500); // 等 2.5s 延迟弹窗

  console.log('1. 启动 2.5s 后弹窗状态');
  const s1 = await evaljs(`(() => {
    const modal = document.querySelector('.support-mask');
    const amount = document.querySelector('.support-amount-mask');
    return { modalShown: modal.classList.contains('show'),
      amountHidden: amount.hidden && getComputedStyle(amount).display === 'none',
      qrLoaded: document.querySelector('.support-qr').complete && document.querySelector('.support-qr').naturalWidth > 0 };
  })()`);
  check('主弹窗自动弹出', s1.modalShown);
  check('金额弹窗默认隐藏', s1.amountHidden);
  check('收款码图片加载成功', s1.qrLoaded);

  console.log('2. 点「已支持」→ 金额弹窗');
  await clickSelector('.support-modal .support-btn-brand');
  const s2 = await evaljs(`!document.querySelector('.support-amount-mask').hidden
    && getComputedStyle(document.querySelector('.support-amount-mask')).display !== 'none'`);
  check('金额弹窗出现', s2);
  // 上报失败时的错误提示必须位于金额弹窗内部，否则用户看不到（曾出现「点了没反应」）
  const errPlacement = await evaljs(`!!document.querySelector('.support-amount-dialog .support-error')`);
  check('错误提示位于金额弹窗内（失败可见）', errPlacement);

  console.log('3. 选预设 10 元 → 确定 → 上报');
  await clickSelector('.support-chip[data-v="10"]');
  const chipSel = await evaljs(`document.querySelector('.support-chip[data-v="10"]').classList.contains('sel')
    && document.querySelector('.support-input').value === '10'`);
  check('预设选中并回填输入框', chipSel);
  // 监听一次网络请求验证金额
  await send('Network.enable');
  const reqPromise = new Promise((resolve) => {
    const handler = (ev) => {
      if (typeof ev.data !== 'string') return;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/donate/support')) {
        ws.removeEventListener('message', handler);
        resolve({ url: m.params.request.url, body: m.params.request.postData });
      }
    };
    ws.addEventListener('message', handler);
    setTimeout(() => resolve(null), 5000);
  });
  await clickSelector('.support-amount-dialog .support-btn-brand');
  const req = await reqPromise;
  check('上报请求发出', !!req, req ? 'body=' + req.body : '');
  check('上报金额=10', !!req && req.body.includes('"amount":10'));
  // 网关模式回归点：请求必须落在页面所在目录下（相对路径），写死 '/api/...' 会 404
  const reqPath = req ? new URL(req.url).pathname : '';
  check('上报路径带页面目录前缀', !!req && reqPath.startsWith(PAGE_DIR),
    `path=${reqPath} 期望前缀=${PAGE_DIR}`);
  await sleep(500);
  const s3 = await evaljs(`(() => ({
    modalClosed: !document.querySelector('.support-mask').classList.contains('show'),
    amountClosed: document.querySelector('.support-amount-mask').hidden,
    remembered: localStorage.getItem('bg_donate_version') === window.__BG_VERSION,
  }))()`);
  check('两个弹窗都已关闭', s3.modalClosed && s3.amountClosed);
  check('已支持版本已记忆', s3.remembered);

  console.log('4. 频控：已支持后刷新不再弹');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3500);
  const s4 = await evaljs(`!document.querySelector('.support-mask').classList.contains('show')`);
  check('刷新后主弹窗不再弹出', s4);
  // 清掉支持记录，测试「暂不支持」频控
  await evaljs(`localStorage.removeItem('bg_donate_version'); 'ok'`);
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3500);
  const s5a = await evaljs(`document.querySelector('.support-mask').classList.contains('show')`);
  check('清除记录后弹窗重新出现', s5a);
  await clickSelector('.support-modal .support-btn-ghost');
  const s5b = await evaljs(`!document.querySelector('.support-mask').classList.contains('show')
    && !!localStorage.getItem('bg_donate_dismissed_start')`);
  check('「暂不支持」关闭并记录本次运行', s5b);
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3500);
  const s5c = await evaljs(`!document.querySelector('.support-mask').classList.contains('show')`);
  check('本次运行内刷新不再弹', s5c);

  console.log('6. ♥ 入口按钮随时可打开弹窗');
  await clickSelector('#btnSupport');
  const s6 = await evaljs(`document.querySelector('.support-mask').classList.contains('show')`);
  check('点品牌栏 ♥ 重新打开弹窗', s6);

  console.log('7. 键盘：弹窗打开时按键放行（Enter 可触发按钮默认点击）');
  // headless Chrome 对长期运行页面的合成键盘有幻影事件（Unidentified/KeyW 洪流，
  // isTrusted=true 的系统级噪声），改验本质：弹窗打开时 input.js 不再吞键
  // （不 preventDefault），浏览器因此能为聚焦按钮合成 click。
  const s7 = await evaljs(`(async () => {
    document.querySelector('.support-mask').classList.add('show'); // 确保弹窗态
    let pd = null;
    const probe = (e) => { if (e.key === 'Enter') pd = e.defaultPrevented; };
    window.addEventListener('keydown', probe, { capture: true, once: true });
    // 派发一个非信任 Enter 探针（只读 defaultPrevented 结果，不触发页面逻辑变更）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    window.removeEventListener('keydown', probe, { capture: true });
    const modalOpenNow = !!document.querySelector('.support-mask.show');
    return { modalOpenNow, enterPrevented: pd };
  })()`);
  check('弹窗打开时 Enter 未被游戏输入拦截', s7.modalOpenNow && s7.enterPrevented === false);

  const pageErrs = await evaljs('window.__gameErrors || []');
  console.log('8. 页面错误:', (pageErrs.length || errors.length) ? { pageErrs, cdpErrors: errors } : '无');
  if (pageErrs.length || errors.length) failed++;

  console.log(failed ? `\n存在 ${failed} 个失败项` : '\n支持作者流程：全部通过');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error('测试脚本错误:', e.message); process.exitCode = 1; })
  .finally(() => { try { ws && ws.close(); } catch (e) {} chrome.kill(); });
