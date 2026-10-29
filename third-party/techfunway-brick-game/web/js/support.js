/* ============ 支持作者：收款码弹窗 + 已支持金额上报 ============ */
/* 家族应用统一做法（对齐 reminders）：
 * - 主弹窗：赞赏说明 + 微信收款码 +【已支持】按钮，扫码支持后点击；
 * - 点【已支持】弹出金额填写弹窗（预设 1/5/10/50 元 + 自定义），点【确定】
 *   上报一次匿名支持计数（仅设备统计信息与金额，与支付记录无任何关联）；
 * - 上报成功后本版本内不再提示（bg_donate_version）；点关闭/暂不支持
 *   本次运行内不再弹（bg_donate_dismissed_start，按服务启动时间区分）；
 * - 应用升级到新版本后重新提示，每个版本都给一次感谢的机会；
 * - 赞赏完全自愿：不赞赏不影响任何功能。
 */
(function () {
  const KEY_VERSION = 'bg_donate_version';
  const KEY_DISMISS = 'bg_donate_dismissed_start';
  const PRESETS = [1, 5, 10, 50];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* API 基准路径：飞牛统一网关把应用挂在 /app/<包名>/ 前缀下，Docker/裸二进制
   * 则是根路径。用页面自身的目录推导，两种部署都正确；不能写死 '/api/...'——
   * 网关模式下会打到不带前缀的路径直接 404（表现就是点「确定」毫无反应）。 */
  const API_BASE = new URL('.', location.href).pathname;

  /* ---------- 构建弹窗 DOM（纯手写，无依赖） ---------- */
  const root = document.createElement('div');
  root.className = 'support-mask';
  root.innerHTML =
    '<div class="support-modal" role="dialog" aria-modal="true" aria-label="支持作者">' +
    '  <button class="support-close" aria-label="关闭">&times;</button>' +
    '  <div class="support-emoji">&#9749;</div>' +
    '  <h3 class="support-title">请作者喝杯咖啡</h3>' +
    '  <p class="support-text">这个应用免费、无广告，玩法纯手写复刻经典。</p>' +
    '  <p class="support-text">如果它帮到了你，欢迎请作者喝杯咖啡——<strong>金额随意，1 元也是心意</strong>。<br>' +
    '  <span class="support-sub">不赞赏也完全没有问题，<strong>不支付不影响任何功能</strong>。</span></p>' +
    '  <div class="support-qr-wrap">' +
    '    <img class="support-qr" src="images/donate-wechat.png" alt="微信赞赏码" width="352" height="480">' +
    '    <span class="support-qr-tip">微信扫码赞赏</span>' +
    '  </div>' +
    '  <div class="support-btns">' +
    '    <button class="support-btn support-btn-ghost" data-act="dismiss">暂不支持</button>' +
    '    <button class="support-btn support-btn-brand" data-act="supported">&#10084; 已支持</button>' +
    '  </div>' +
    '  <p class="support-note">支付后点击「已支持」填写金额并发送一次匿名支持计数<br>（仅设备统计信息与金额，与你的微信账号和支付记录无任何关联）</p>' +
    '</div>' +
    '<div class="support-amount-mask" hidden>' +
    '  <div class="support-amount-dialog" role="dialog" aria-modal="true" aria-label="填写支持金额">' +
    '    <h4 class="support-amount-title">填写支持金额</h4>' +
    '    <p class="support-amount-sub">金额随意，1 元也是心意；仅用于接收端统计，不做支付核验</p>' +
    '    <div class="support-presets">' +
    '      <button class="support-chip" data-v="1">1 元</button>' +
    '      <button class="support-chip" data-v="5">5 元</button>' +
    '      <button class="support-chip" data-v="10">10 元</button>' +
    '      <button class="support-chip" data-v="50">50 元</button>' +
    '    </div>' +
    '    <div class="support-custom-row">' +
    '      <span class="support-yuan">&yen;</span>' +
    '      <input class="support-input" type="number" inputmode="decimal" min="0" step="0.01" placeholder="金额（元）">' +
    '    </div>' +
    '    <p class="support-zero" hidden>未填写金额将以 0 元上报</p>' +
    '    <p class="support-error" hidden></p>' +
    '    <div class="support-btns">' +
    '      <button class="support-btn support-btn-ghost" data-act="amount-cancel">取消</button>' +
    '      <button class="support-btn support-btn-brand" data-act="amount-ok">确定</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(root);

  const elModal = root.querySelector('.support-modal');
  const elAmountMask = root.querySelector('.support-amount-mask');
  const elError = root.querySelector('.support-error');
  const elInput = root.querySelector('.support-input');
  const elZero = root.querySelector('.support-zero');
  const elChips = root.querySelectorAll('.support-chip');
  let sending = false;

  function showError(msg) {
    elError.textContent = msg;
    elError.hidden = !msg;
  }

  function openAmountDialog() {
    showError('');
    elAmountMask.hidden = false;
  }
  function closeAmountDialog() {
    elAmountMask.hidden = true;
  }

  function readAmount() {
    const v = parseFloat(elInput.value);
    return v > 0 ? Math.round(v * 100) / 100 : 0;
  }

  /* ---------- 上报：成功才记住当前版本 ---------- */
  function sendSupport(amount, done) {
    if (sending) return;
    sending = true;
    const btn = root.querySelector('[data-act="amount-ok"]');
    btn.textContent = '发送中…';
    let ok = false;
    fetch(API_BASE + 'api/donate/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount > 0 ? amount : 0 }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { ok = !!(d && d.code === 0 && d.data && d.data.ok === true); })
      .catch(() => { ok = false; })
      .then(() => {
        sending = false;
        btn.innerHTML = '&#10084; 确定';
        if (ok) {
          // 版本号由 main.js 从 api/health 取回后写入 __BG_VERSION；
          // 取不到时用占位值兜底（仅影响"本版本不再提示"的判定粒度）
          lsSet(KEY_VERSION, window.__BG_VERSION || '1');
          root.classList.remove('show');
          closeAmountDialog();
        } else {
          // 错误提示在金额弹窗内部（确定按钮上方），确保用户一定看得到
          showError('发送失败，请稍后重试（不影响你的支持 ♥）');
        }
        if (done) done(ok);
      });
  }

  /* ---------- 事件 ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act], .support-close');
    if (!t) return;
    const act = t.classList.contains('support-close') ? 'dismiss' : t.dataset.act;
    if (act === 'dismiss') {           // 关闭 / 暂不支持：本次运行内不再弹
      root.classList.remove('show');
      closeAmountDialog();
      if (window.__BG_START_ID) lsSet(KEY_DISMISS, window.__BG_START_ID);
    } else if (act === 'supported') {  // 已支持：弹出金额填写
      openAmountDialog();
    } else if (act === 'amount-cancel') {
      closeAmountDialog();
    } else if (act === 'amount-ok') {  // 确定：上报匿名支持计数
      sendSupport(readAmount());
    }
  });
  elChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elInput.value = chip.dataset.v;
      elChips.forEach((c) => c.classList.toggle('sel', c === chip));
    });
  });
  elInput.addEventListener('input', () => {
    elChips.forEach((c) => c.classList.toggle('sel', c.dataset.v === elInput.value));
    elZero.hidden = !(elInput.value === '' || readAmount() === 0);
  });
  elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendSupport(readAmount());
  });
  // Esc 关闭弹窗（键盘可达性）：金额弹窗开着先关它，否则整个关闭
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.code !== 'Escape') return;
    if (!root.classList.contains('show')) return;
    e.preventDefault();
    if (!elAmountMask.hidden) closeAmountDialog();
    else {
      root.classList.remove('show');
      if (window.__BG_START_ID) lsSet(KEY_DISMISS, window.__BG_START_ID);
    }
  });

  /* ---------- 提示频控 ---------- */
  function supported() {
    const ver = window.__BG_VERSION || '';
    return !!ver && lsGet(KEY_VERSION) === ver;
  }
  function maybeShow(delayMs) {
    if (supported()) return;
    const start = window.__BG_START_ID;
    if (start && lsGet(KEY_DISMISS) === start) return;
    setTimeout(() => {
      if (!supported()) root.classList.add('show');
    }, delayMs || 0);
  }
  function open() {
    showError('');
    root.classList.add('show');
  }

  // 对局进行中不弹（等回菜单/结算后再弹），由 main.js 接管时机
  window.SupportAuthor = { maybeShow, open, supported };
})();
