'use strict';
// Keyboard + Gamepad API, normalized per player.
// P1: A/D move, W/Space jump, F attack.  P2: arrows move/jump, L or . attack.
// Pads: left stick move+aim, A jump, X or RT attack.

const Input = {
  keys: new Set(),
  prev: [{ jump: false, attack: false }, { jump: false, attack: false }],
  state: [null, null],
  KB: [
    { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], attack: ['KeyF'], down: ['KeyS'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], attack: ['KeyL', 'Period'], down: ['ArrowDown'] },
  ],
  init() {
    window.addEventListener('keydown', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return; // typing in a field
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      Sound.ensure();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointerdown', () => Sound.ensure());
  },
  down(codes) { return codes.some(c => this.keys.has(c)); },
  poll() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) {} // sandboxed iframes may block gamepads
    for (let i = 0; i < 2; i++) {
      const kb = this.KB[i], pad = pads[i];
      let mx = 0, aimx = 0, aimy = 0;
      if (this.down(kb.left)) mx -= 1;
      if (this.down(kb.right)) mx += 1;
      let jump = this.down(kb.jump);
      let attack = this.down(kb.attack);
      const downHeld = this.down(kb.down);
      if (pad && pad.connected) {
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        if (Math.abs(ax) > 0.25) mx += ax;
        if (Math.hypot(ax, ay) > 0.3) { aimx = ax; aimy = ay; }
        if (pad.buttons[0] && pad.buttons[0].pressed) jump = true;
        if ((pad.buttons[2] && pad.buttons[2].pressed) || (pad.buttons[7] && pad.buttons[7].pressed)) attack = true;
      }
      mx = clamp(mx, -1, 1);
      const p = this.prev[i];
      this.state[i] = {
        mx, aimx, aimy, downHeld,
        jumpHeld: jump, attackHeld: attack,
        jumpPressed: jump && !p.jump,
        attackPressed: attack && !p.attack,
      };
      p.jump = jump;
      p.attack = attack;
    }
  },
  get(i) {
    return this.state[i] || { mx: 0, aimx: 0, aimy: 0, downHeld: false, jumpHeld: false, attackHeld: false, jumpPressed: false, attackPressed: false };
  },
};
