// Keyboard, mouse and touch, folded into the one input object the
// simulation reads. Discrete actions are queued so that a press is consumed
// exactly once, however many fixed steps the frame turns into.

import { CHARGE_TIME } from './constants.js';

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
const SHOOT_KEYS = new Set(['Space']);
const PASS_KEYS = new Set(['KeyF', 'Enter', 'KeyJ']);
const SPRINT_KEYS = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target, hooks = {}) {
  const held = new Set();
  const input = { mx: 0, my: 0, sprint: false, actions: [] };
  let chargeStart = 0;
  let charging = false;
  const stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };

  function chargePower() {
    if (!charging) return 0;
    return Math.min(1, (performance.now() - chargeStart) / (CHARGE_TIME * 1000));
  }

  function beginCharge() {
    if (charging) return;
    charging = true;
    chargeStart = performance.now();
  }

  function releaseCharge() {
    if (!charging) return;
    const power = Math.max(0.32, chargePower());
    charging = false;
    input.actions.push({ type: 'shoot', power });
  }

  function updateAxis() {
    if (stick.active) {
      input.mx = stick.dx;
      input.my = stick.dy;
      return;
    }
    let x = 0, y = 0;
    for (const code of held) {
      const v = MOVE_KEYS[code];
      if (v) { x += v[0]; y += v[1]; }
    }
    const len = Math.hypot(x, y);
    input.mx = len > 1 ? x / len : x;
    input.my = len > 1 ? y / len : y;
  }

  function onKeyDown(e) {
    if (e.repeat) {
      if (MOVE_KEYS[e.code] || SHOOT_KEYS.has(e.code)) e.preventDefault();
      return;
    }
    if (e.code === 'KeyM') { hooks.onMute?.(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { hooks.onPause?.(); e.preventDefault(); return; }

    if (MOVE_KEYS[e.code] || SHOOT_KEYS.has(e.code) || PASS_KEYS.has(e.code) || SPRINT_KEYS.has(e.code)) {
      // Space and the arrows would otherwise scroll the page — and Space
      // would also re-activate whichever button last had focus.
      e.preventDefault();
      held.add(e.code);
      if (SHOOT_KEYS.has(e.code)) beginCharge();
      if (PASS_KEYS.has(e.code)) input.actions.push({ type: 'pass' });
      if (SPRINT_KEYS.has(e.code)) input.sprint = true;
      updateAxis();
      hooks.onAnyInput?.();
    }
  }

  function onKeyUp(e) {
    if (!held.has(e.code)) return;
    held.delete(e.code);
    if (SHOOT_KEYS.has(e.code)) releaseCharge();
    if (SPRINT_KEYS.has(e.code)) input.sprint = false;
    updateAxis();
  }

  function blur() {
    held.clear();
    charging = false;
    input.sprint = false;
    stick.active = false;
    updateAxis();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', blur);

  /* ------------------------------------------------------------ touch pad */

  function bindStick(el) {
    const knob = el.querySelector('.knob');
    const radius = () => el.getBoundingClientRect().width / 2;

    const move = (e) => {
      if (!stick.active || e.pointerId !== stick.id) return;
      const r = radius();
      let dx = (e.clientX - stick.cx) / r;
      let dy = (e.clientY - stick.cy) / r;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      stick.dx = dx; stick.dy = dy;
      input.sprint = len > 0.85;
      if (knob) knob.style.transform = `translate(${dx * r * 0.5}px, ${dy * r * 0.5}px)`;
      updateAxis();
    };

    el.addEventListener('pointerdown', (e) => {
      const rect = el.getBoundingClientRect();
      stick.active = true;
      stick.id = e.pointerId;
      stick.cx = rect.left + rect.width / 2;
      stick.cy = rect.top + rect.height / 2;
      el.setPointerCapture(e.pointerId);
      hooks.onAnyInput?.();
      move(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== stick.id) return;
      stick.active = false;
      stick.dx = 0; stick.dy = 0;
      input.sprint = false;
      if (knob) knob.style.transform = '';
      updateAxis();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function bindButton(el, kind) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      hooks.onAnyInput?.();
      if (kind === 'shoot') beginCharge();
      else input.actions.push({ type: 'pass' });
      el.classList.add('pressed');
    });
    const end = (e) => {
      el.classList.remove('pressed');
      if (kind === 'shoot') releaseCharge();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  return {
    input,
    chargePower,
    get charging() { return charging; },
    bindStick,
    bindButton,
    reset: blur,
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', blur);
    },
  };
}
