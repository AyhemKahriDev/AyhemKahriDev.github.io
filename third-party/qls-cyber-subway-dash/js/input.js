window.SD = window.SD || {};

(function () {
  'use strict';

  const I = (window.SD.Input = {
    queue: [],
    _t0: 0,
    _x0: 0,
    _y0: 0,

    init(canvas) {
      window.addEventListener('keydown', (e) => this._key(e));
      canvas.addEventListener('touchstart', (e) => this._touchStart(e), { passive: false });
      canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchend', (e) => this._touchEnd(e), { passive: false });
    },

    _key(e) {
      const k = e.code;
      let a = null;
      if (k === 'ArrowLeft' || k === 'KeyA') a = { type: 'lane', dir: -1 };
      else if (k === 'ArrowRight' || k === 'KeyD') a = { type: 'lane', dir: 1 };
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') a = { type: 'jump' };
      else if (k === 'ArrowDown' || k === 'KeyS') a = { type: 'slide' };
      else if (k === 'KeyP' || k === 'Escape') a = { type: 'pause' };
      else if (k === 'Enter' || k === 'NumpadEnter') a = { type: 'confirm' };
      if (a) {
        e.preventDefault();
        if (!e.repeat) this.queue.push(a);
      }
    },

    _touchStart(e) {
      const t = e.changedTouches[0];
      this._t0 = performance.now();
      this._x0 = t.clientX;
      this._y0 = t.clientY;
    },

    _touchEnd(e) {
      const t = e.changedTouches[0];
      const dx = t.clientX - this._x0;
      const dy = t.clientY - this._y0;
      const dt = performance.now() - this._t0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12 && dt < 250) {
        this.queue.push({ type: 'confirm' });
        return;
      }
      if (Math.abs(dx) >= Math.abs(dy)) {
        this.queue.push({ type: 'lane', dir: dx > 0 ? 1 : -1 });
      } else if (dy < 0) {
        this.queue.push({ type: 'jump' });
      } else {
        this.queue.push({ type: 'slide' });
      }
    },

    take() {
      if (this.queue.length) return this.queue.shift();
      return null;
    }
  });
})();
