window.SD = window.SD || {};

(function () {
  'use strict';

  function showError(msg) {
    let el = document.getElementById('error-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error-banner';
      document.body.appendChild(el);
    }
    el.textContent = '运行错误: ' + msg;
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;right:8px;z-index:99;background:rgba(200,30,30,0.92);color:#fff;font:13px/1.5 Consolas,monospace;padding:8px 12px;border-radius:6px;white-space:pre-wrap;';
  }

  window.addEventListener('load', () => {
    const canvas = document.getElementById('game');
    window.SD.Renderer.init(canvas);
    window.SD.Input.init(canvas);
    window.SD.Game.init();

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        window.SD.Game.update(dt);
        window.SD.Renderer.draw(window.SD.Game.world, window.SD.Game.player, {
          shake: window.SD.Game.shake,
          flash: window.SD.Game.flash,
          bite: window.SD.Game.bite,
          dt: dt
        });
        const renderErr = window.SD.Renderer.lastError;
        if (renderErr) {
          showError((renderErr && renderErr.message) || String(renderErr));
          window.SD.Renderer.lastError = null;
        }
      } catch (err) {
        showError((err && err.message) || String(err));
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();
