/*!
 * engine/gz-input.js
 * GZ.Input — keyboard, pointer (mouse+touch unified), and virtual touch-button
 * input for every game. Games only ever call isDown()/pressed()/pointer —
 * everything else here is engine-internal plumbing used by gz-core.js and
 * gz-shell.js.
 *
 * Edge-triggering contract: pressed(action) is true for exactly one fixed
 * update() step. To make that true regardless of frame rate we split raw
 * "justPressed" key codes (real wall-clock events) from a per-step snapshot
 * that gz-core.js rotates in right before each update() call.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  // Physical key codes mapped to each logical action. Arrow keys + WASD are
  // always both live so players can use either.
  var ACTION_KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    a: ['Space', 'KeyZ'],
    b: ['ShiftLeft', 'ShiftRight', 'KeyX']
  };

  // Codes the engine prevents default browser behavior for (scrolling etc.)
  var CLAIMED_CODES = {};
  Object.keys(ACTION_KEYS).forEach(function (action) {
    ACTION_KEYS[action].forEach(function (code) { CLAIMED_CODES[code] = true; });
  });
  ['Enter', 'Escape', 'KeyP', 'KeyM', 'KeyR'].forEach(function (c) { CLAIMED_CODES[c] = true; });

  var down = Object.create(null);        // physical key codes currently held
  var justPressed = Object.create(null); // physical key codes pressed since last consume
  var virtualDown = Object.create(null); // action names held via touch buttons
  var virtualJustPressed = Object.create(null); // action names tapped since last consume

  var stepCodes = Object.create(null);         // consumed snapshot used by pressed() this step
  var stepVirtual = Object.create(null);       // consumed virtual-tap snapshot this step
  var stepPointerPressed = false;

  var overlayMode = false; // when true, Enter also counts toward action 'a'

  var pointerState = { x: 0, y: 0, down: false };
  var pointerJustPressedRaw = false;
  var canvasEl = null;

  function clientToLogical(clientX, clientY) {
    if (!canvasEl) return { x: 0, y: 0 };
    var rect = canvasEl.getBoundingClientRect();
    var lx = ((clientX - rect.left) / Math.max(1, rect.width)) * 800;
    var ly = ((clientY - rect.top) / Math.max(1, rect.height)) * 600;
    return {
      x: Math.max(0, Math.min(800, lx)),
      y: Math.max(0, Math.min(600, ly))
    };
  }

  function onKeyDown(e) {
    if (CLAIMED_CODES[e.code]) e.preventDefault();
    if (!down[e.code]) justPressed[e.code] = true;
    down[e.code] = true;
  }

  function onKeyUp(e) {
    if (CLAIMED_CODES[e.code]) e.preventDefault();
    down[e.code] = false;
  }

  function onPointerDown(e) {
    var p = clientToLogical(e.clientX, e.clientY);
    pointerState.x = p.x; pointerState.y = p.y; pointerState.down = true;
    pointerJustPressedRaw = true;
    if (e.cancelable) e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointerState.down && e.pointerType === 'mouse' && e.buttons === 0) {
      var p = clientToLogical(e.clientX, e.clientY);
      pointerState.x = p.x; pointerState.y = p.y;
      return;
    }
    var p2 = clientToLogical(e.clientX, e.clientY);
    pointerState.x = p2.x; pointerState.y = p2.y;
    if (e.cancelable) e.preventDefault();
  }
  function onPointerUp(e) {
    pointerState.down = false;
    if (e.cancelable) e.preventDefault();
  }

  GZ.Input = {
    /**
     * Bind keyboard + pointer listeners. Called once by GZ.boot(). `canvas`
     * is the logical-800x600 game canvas; touch buttons live outside it and
     * report through _virtualPress/_virtualRelease instead.
     */
    attach: function (canvas) {
      canvasEl = canvas;
      window.addEventListener('keydown', onKeyDown, { passive: false });
      window.addEventListener('keyup', onKeyUp, { passive: false });
      canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      canvas.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerUp, { passive: false });
      canvas.style.touchAction = 'none';
    },

    /** Is this logical action currently held down (key, or touch button)? */
    isDown: function (action) {
      var codes = ACTION_KEYS[action];
      if (codes) {
        for (var i = 0; i < codes.length; i++) if (down[codes[i]]) return true;
      }
      if (action === 'a' && overlayMode && down.Enter) return true;
      return !!virtualDown[action];
    },

    /** Edge-triggered: true for exactly one update() step per physical press. */
    pressed: function (action) {
      var codes = ACTION_KEYS[action];
      if (codes) {
        for (var i = 0; i < codes.length; i++) if (stepCodes[codes[i]]) return true;
      }
      if (action === 'a' && overlayMode && stepCodes.Enter) return true;
      return !!stepVirtual[action];
    },

    /** Mouse + touch unified pointer, in logical 800x600 canvas coordinates. */
    get pointer() {
      return { x: pointerState.x, y: pointerState.y, down: pointerState.down, pressed: stepPointerPressed };
    },

    // ---- engine-internal below: used by gz-core.js and gz-shell.js only ----

    /** Touch-button / swipe helpers hold an action down until released. */
    _virtualPress: function (action) {
      if (!virtualDown[action]) virtualJustPressed[action] = true;
      virtualDown[action] = true;
    },
    _virtualRelease: function (action) { virtualDown[action] = false; },
    /** One-shot virtual tap (e.g. a swipe gesture) without a held state. */
    _pulse: function (action) { virtualJustPressed[action] = true; },

    /** Enter counts as action 'a' only while an overlay (non-gameplay) is showing. */
    _setOverlayMode: function (on) { overlayMode = !!on; },

    /** Consume-and-clear a raw key code; used by gz-core.js for meta keys
     *  (Space/Enter/Escape/P/M/R) so they don't leak into the same frame's
     *  action snapshot as well. */
    _takeRaw: function (code) {
      if (justPressed[code]) { justPressed[code] = false; return true; }
      return false;
    },

    /** Consume-and-clear the canvas pointerdown edge (used for start/resume). */
    _takeMetaPointerPress: function () {
      if (pointerJustPressedRaw) { pointerJustPressedRaw = false; return true; }
      return false;
    },

    /** Rotate remaining raw/virtual "just pressed" state into this step's
     *  snapshot, then clear the raw stores. Call once per rAF before the
     *  first update(), and with fresh=false (no new snapshot) before any
     *  extra catch-up update() calls in the same frame. */
    _beginStep: function (fresh) {
      if (fresh) {
        stepCodes = justPressed; justPressed = Object.create(null);
        stepVirtual = virtualJustPressed; virtualJustPressed = Object.create(null);
        stepPointerPressed = pointerJustPressedRaw; pointerJustPressedRaw = false;
      } else {
        stepCodes = Object.create(null);
        stepVirtual = Object.create(null);
        stepPointerPressed = false;
      }
    },

    /** Full reset between boots (not needed in normal single-game pages, but
     *  keeps behavior sane if a page ever re-boots). */
    _reset: function () {
      down = Object.create(null); justPressed = Object.create(null);
      virtualDown = Object.create(null); virtualJustPressed = Object.create(null);
      stepCodes = Object.create(null); stepVirtual = Object.create(null);
      stepPointerPressed = false; pointerJustPressedRaw = false;
      pointerState = { x: 0, y: 0, down: false };
    }
  };
})();
