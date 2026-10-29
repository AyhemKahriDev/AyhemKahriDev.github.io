// ═══════════════════════════════════════════════════════════
//  THEG I — Input Manager
// ═══════════════════════════════════════════════════════════

export class InputManager {
  constructor() {
    this.keys       = {};
    this.shooting   = false;
    this.locked     = false;
    this.gameRunning = false;
    this._dx        = 0;
    this._dy        = 0;
  }

  init(canvas, onSpecialKey) {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (this.gameRunning && onSpecialKey) onSpecialKey(e.code);
    });
    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('click', () => {
      if (!this.gameRunning) return;
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      document.getElementById('xhair').style.display = this.locked ? 'block' : 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!this.locked || !this.gameRunning) return;
      this._dx += e.movementX;
      this._dy += e.movementY;
    });

    document.addEventListener('mousedown', e => {
      if (e.button === 0 && this.locked) this.shooting = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.shooting = false;
    });
  }

  isDown(code) {
    return !!this.keys[code];
  }

  consumeMouseDelta() {
    const dx = this._dx, dy = this._dy;
    this._dx = 0; this._dy = 0;
    return { dx, dy };
  }
}
