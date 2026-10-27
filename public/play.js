/**
 * arcadefork play layer — the phone fix.
 *
 * Almost every game here is somebody else's page in an iframe, and almost all
 * them only ever listened for a keyboard. On a phone that is unplayable: there
 * is no key to press, and the swipe you reach for is taken by the browser as
 * scroll or pull-to-refresh. That is exactly what happened in Tetris.
 *
 * Loaded on game pages only. It does three things:
 *
 *   1. SPEAKS KEYBOARD FOR A THUMB. A two-handed pad dispatches real
 *      KeyboardEvents into the game's own document. The frame is same-origin
 *      (sandbox allows allow-same-origin allow-scripts), so this is allowed;
 *      the legacy `keyCode` is defined on the event by hand because that is
 *      the field nearly all of these games read.
 *   2. SWIPES INTO ARROWS. A swipe on the game maps to the matching arrow and
 *      a tap to Space, so steering never becomes a page scroll.
 *   3. GETS THE PAGE OUT OF THE WAY. Immersive play — full height, no page
 *      scroll, no pull-to-refresh, safe-area aware, one obvious way out.
 *
 * Every part is isolated in its own try/catch: a broken pad must never stop a
 * game from loading.
 */
(function () {
  'use strict';

  var body = document.body;
  if (!body || !body.classList.contains('is-game')) return;

  var root = document.documentElement;
  var stage = document.getElementById('stage') || document.querySelector('.embed-stage');
  if (!stage) return;

  var frame = document.getElementById('af-frame');
  var gameId = body.getAttribute('data-game') || 'game';
  var nativeGame = stage.getAttribute('data-mobile') === 'native';
  var coarse = false;
  try {
    coarse =
      window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
  } catch (e) {
    /* no matchMedia: treated as a desktop */
  }

  /* ------------------------------------------------------------ storage */
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* private mode: the choice just does not persist */
    }
  }

  /* --------------------------------------------------------------- keys */
  /**
   * keyCode is what these games actually switch on, and KeyboardEvent ignores
   * it in the constructor — so every event gets both fields defined.
   */
  var KEYS = {
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    Space: { key: ' ', code: 'Space', keyCode: 32 },
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    KeyZ: { key: 'z', code: 'KeyZ', keyCode: 90 },
    KeyX: { key: 'x', code: 'KeyX', keyCode: 88 },
    KeyP: { key: 'p', code: 'KeyP', keyCode: 80 },
    KeyR: { key: 'r', code: 'KeyR', keyCode: 82 },
    ShiftLeft: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
  };

  var DEFAULTS = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    a: 'Space',
    b: 'Enter',
    pause: 'KeyP',
    restart: 'KeyR',
  };

  var map = {};
  Object.keys(DEFAULTS).forEach(function (slot) {
    map[slot] = DEFAULTS[slot];
  });
  try {
    // A game with unusual keys declares them: data-keys='{"a":"KeyZ"}'.
    var custom = JSON.parse(stage.getAttribute('data-keys') || '{}');
    Object.keys(custom).forEach(function (slot) {
      if (map[slot] && KEYS[custom[slot]]) map[slot] = custom[slot];
    });
  } catch (e) {
    /* a malformed override falls back to the arrows */
  }

  function gameWindow() {
    if (frame) {
      try {
        if (frame.contentWindow && frame.contentDocument) return frame.contentWindow;
      } catch (e) {
        /* cross-origin or not loaded yet: the page itself will do */
      }
    }
    return window;
  }

  function fire(slot, type) {
    var spec = KEYS[map[slot] || slot];
    if (!spec) return;
    var win = gameWindow();
    var doc = win.document || document;
    var target = doc.body || doc;
    var ev;
    try {
      ev = new win.KeyboardEvent(type, {
        key: spec.key,
        code: spec.code,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(ev, 'keyCode', { get: function () { return spec.keyCode; } });
      Object.defineProperty(ev, 'which', { get: function () { return spec.keyCode; } });
    } catch (e) {
      return;
    }
    try {
      target.dispatchEvent(ev);
    } catch (e) {
      /* a page that swallowed the event is not our problem */
    }
  }

  function tap(slot) {
    fire(slot, 'keydown');
    setTimeout(function () {
      fire(slot, 'keyup');
    }, 45);
  }

  /* ---------------------------------------------------------------- pad */
  var pad = null;
  var gestures = false;

  function keyButton(slot, cls, label, hint) {
    return (
      '<button type="button" class="af-key ' + cls + '" data-k="' + slot + '"' +
      ' aria-label="' + hint + '">' + label + '</button>'
    );
  }

  function buildPad() {
    if (pad) return pad;
    pad = document.createElement('div');
    pad.id = 'af-pad';
    pad.className = 'af-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'On-screen controls');
    pad.innerHTML =
      '<div class="af-pad-side af-dpad">' +
      keyButton('up', 'af-up', '&#9650;', 'Up') +
      keyButton('left', 'af-left', '&#9664;', 'Left') +
      keyButton('right', 'af-right', '&#9654;', 'Right') +
      keyButton('down', 'af-down', '&#9660;', 'Down') +
      '</div>' +
      '<div class="af-pad-side af-acts">' +
      keyButton('restart', 'af-key-sm', 'R', 'Restart') +
      keyButton('pause', 'af-key-sm', 'P', 'Pause') +
      keyButton('b', 'af-key-b', 'B', 'Action B') +
      keyButton('a', 'af-key-a', 'A', 'Action') +
      '</div>';
    document.body.appendChild(pad);
    Array.prototype.forEach.call(pad.querySelectorAll('.af-key'), bindKey);
    return pad;
  }

  var REPEAT_SLOTS = { left: 1, right: 1, up: 1, down: 1 };

  function bindKey(btn) {
    var slot = btn.getAttribute('data-k');
    var timer = null;
    var held = false;

    function press(e) {
      if (e) e.preventDefault();
      if (held) return;
      held = true;
      btn.classList.add('is-down');
      fire(slot, 'keydown');
      if (REPEAT_SLOTS[slot]) {
        timer = setInterval(function () {
          fire(slot, 'keydown');
        }, 130);
      }
      try {
        if (e && btn.setPointerCapture && e.pointerId !== undefined) {
          btn.setPointerCapture(e.pointerId);
        }
      } catch (err) {
        /* pointer capture is a nicety, not a requirement */
      }
    }

    function release() {
      if (!held) return;
      held = false;
      btn.classList.remove('is-down');
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      fire(slot, 'keyup');
    }

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }

  /* ----------------------------------------------------------- gestures */
  var gesture = { live: false, x: 0, y: 0, at: 0, moved: false };

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    gesture.live = true;
    gesture.x = t.clientX;
    gesture.y = t.clientY;
    gesture.at = Date.now();
    gesture.moved = false;
  }

  function onTouchMove(e) {
    if (!gesture.live || e.touches.length !== 1) return;
    // This is the line that used to be the browser's: without it the swipe
    // scrolls the page, chains to the parent and pulls the page down to
    // refresh. Inside the game, it is steering instead.
    if (e.cancelable) e.preventDefault();
    var t = e.touches[0];
    var THRESHOLD = 24;
    var dx = t.clientX - gesture.x;
    var dy = t.clientY - gesture.y;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
    gesture.moved = true;
    if (Math.abs(dx) > Math.abs(dy)) tap(dx > 0 ? 'right' : 'left');
    else tap(dy > 0 ? 'down' : 'up');
    gesture.x = t.clientX;
    gesture.y = t.clientY;
  }

  function onTouchEnd() {
    if (!gesture.live) return;
    gesture.live = false;
    if (!gesture.moved && Date.now() - gesture.at < 400) tap('a');
  }

  function attachGestures() {
    if (!frame) return;
    var doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return;
    }
    if (!doc || !doc.documentElement) return;
    if (!doc.__afGestures) {
      doc.__afGestures = true;
      // Capture phase on purpose: a game that calls stopPropagation (or that
      // attaches its own touch handlers to the canvas) must not be able to
      // swallow the gesture before it becomes a key press.
      doc.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
      doc.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
      doc.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
      doc.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    }
  }

  /**
   * The frame's own scrolling must not chain into the page: that chain is what
   * turns a swipe at the top of a game into a pull-to-refresh. The style tag
   * is the only thing injected into somebody else's document, and it changes
   * two properties that cannot alter their layout.
   */
  function attachFrame() {
    if (!frame) return;
    var doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return;
    }
    if (!doc || !doc.documentElement || doc.__afStyle) return;
    doc.__afStyle = true;
    try {
      var st = doc.createElement('style');
      st.setAttribute('data-arcadefork', '');
      st.textContent =
        'html,body{overscroll-behavior:contain !important;-webkit-tap-highlight-color:transparent}';
      (doc.head || doc.documentElement).appendChild(st);
    } catch (e) {
      /* if the style cannot be injected, the parent page still has none */
    }
    if (gestures) attachGestures();
  }

  /* ------------------------------------------------------------- fit */

  /**
   * Many of these games are a fixed-size box drawn in the top-left of a tall
   * phone frame, leaving a band of their own white background below - which
   * reads as a broken page, and puts the game under your thumb at 40% size.
   *
   * So: measure what the game actually painted (the union of its body
   * children), scale it up to the frame's width with CSS zoom (never past 2x,
   * never shrinking), then shrink the frame to the scaled height and centre
   * it. A game that already fills the frame is left completely alone.
   */
  var lastFit = '';
  var currentZoom = 1;
  var scaledW = 0;

  function contentBox(doc) {
    var kids = doc.body.children;
    var right = 0;
    var bottom = 0;
    var found = false;
    var view = doc.defaultView || window;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META') continue;
      var st;
      try {
        st = view.getComputedStyle(el);
      } catch (e) {
        continue;
      }
      if (st.display === 'none' || st.position === 'fixed' || st.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      right = Math.max(right, r.right + (view.pageXOffset || 0));
      bottom = Math.max(bottom, r.bottom + (view.pageYOffset || 0));
      found = true;
    }
    return found ? { w: right, h: bottom } : null;
  }

  function fitFrame() {
    if (!frame) return;
    var doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return;
    }
    if (!doc || !doc.body) return;
    var stageW = stage.clientWidth;
    var stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    var view = doc.documentElement;

    // 1. A desktop layout in a phone frame. The game is wider than the frame,
    // so it is being cropped rather than played: give the frame the width the
    // game wants and scale the whole thing down to fit. This is the honest
    // treatment for a page that was never responsive.
    var docW = Math.max(doc.body.scrollWidth || 0, view.scrollWidth || 0);
    if (!scaledW && docW > stageW + 24 && docW <= 1600) {
      scaledW = docW;
      var k = stageW / scaledW;
      frame.style.width = scaledW + 'px';
      frame.style.height = Math.round(stageH / k) + 'px';
      frame.style.marginTop = '0';
      frame.style.transformOrigin = 'top left';
      frame.style.transform = 'scale(' + k.toFixed(4) + ')';
      // The frame's own viewport just changed width, so measure again once the
      // game has reflowed and shrink the height to what it actually paints.
      setTimeout(fitFrame, 500);
      return;
    }

    var box = contentBox(doc);
    if (!box || box.w < 60 || box.h < 60) return;

    // A game whose own page is taller than the stage scrolls inside the
    // frame, and shrinking the frame would only hide part of it.
    if ((doc.body.scrollHeight || 0) > stageH) {
      if (!scaledW) {
        frame.style.height = '';
        frame.style.marginTop = '';
      }
      lastFit = '';
      return;
    }

    // Fill the width, but never enlarge a tiny box into mush.
    var z = scaledW ? 1 : Math.min(stageW / box.w, 2);
    if (!scaledW && (z < 1.08 || box.w >= stageW * 0.92)) z = 1;
    if (Math.abs(z - currentZoom) > 0.02) {
      try {
        doc.documentElement.style.zoom = z === 1 ? '' : String(z.toFixed(2));
        currentZoom = z;
      } catch (e) {
        /* no zoom: the height hug below still applies */
      }
    }

    var shownH = Math.round(box.h * currentZoom);
    var key = shownH + 'x' + stageH + '@' + currentZoom.toFixed(2) + '#' + scaledW;
    if (key === lastFit) return;
    lastFit = key;

    if (shownH < stageH - 8) {
      frame.style.height = Math.round(shownH * (scaledW ? stageW / scaledW : 1)) + 'px';
      frame.style.marginTop = scaledW ? '0' : Math.max(0, Math.round((stageH - shownH) / 2)) + 'px';
    } else if (!scaledW) {
      frame.style.height = '';
      frame.style.marginTop = '';
    }
  }

  function scheduleFit() {
    setTimeout(fitFrame, 400);
    setTimeout(fitFrame, 1600);
    setTimeout(fitFrame, 4000);
  }

  /* ---------------------------------------------------------- immersive */
  function immersiveOn() {
    return body.classList.contains('is-immersive');
  }

  function setImmersive(on, remember) {
    body.classList.toggle('is-immersive', !!on);
    root.classList.toggle('is-immersive', !!on);
    if (remember) write('af_immersive', on ? '1' : '0');
    var btn = document.getElementById('af-full');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    }
    if (on) window.scrollTo(0, 0);
  }

  function exitImmersive() {
    setImmersive(false, true);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) {
      /* already out */
    }
  }

  /* ------------------------------------------------------------- wiring */
  function setPad(on, remember) {
    gestures = !!on;
    if (on) buildPad();
    if (pad) pad.classList.toggle('is-off', !on);
    var btn = document.getElementById('af-pad-toggle');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (remember) write('af_pad_' + gameId, on ? '1' : '0');
    if (on) {
      attachFrame();
      attachGestures();
    }
  }

  function hint(text) {
    if (!text) return;
    var el = document.createElement('div');
    el.className = 'af-hint';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
    }, 4600);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 5200);
  }

  function init() {
    // Immersive is the default on a phone: the page is the game.
    if (coarse) {
      setImmersive(read('af_immersive', '1') === '1', false);
    }

    var stored = read('af_pad_' + gameId, null);
    var padOn = stored === null ? coarse && !nativeGame && !!frame : stored === '1';
    if (frame) setPad(padOn, false);

    var full = document.getElementById('af-full');
    if (full) {
      full.addEventListener('click', function () {
        var on = !immersiveOn();
        setImmersive(on, true);
        try {
          if (on && root.requestFullscreen && !document.fullscreenElement) {
            var p = root.requestFullscreen({ navigationUI: 'hide' });
            if (p && p.catch) p.catch(function () {});
          } else if (!on && document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen();
          }
        } catch (e) {
          /* the CSS mode is the fallback and it already works */
        }
      });
    }

    var toggle = document.getElementById('af-pad-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', gestures ? 'true' : 'false');
      toggle.addEventListener('click', function () {
        setPad(!gestures, true);
        hint(gestures ? 'Controls on' : 'Controls off');
      });
    }

    // One obvious way out, in the bar the game already has.
    var bar =
      document.querySelector('.embed-bar .embed-actions') ||
      document.querySelector('.topbar .top-actions');
    if (bar && coarse) {
      var exit = document.createElement('button');
      exit.type = 'button';
      exit.id = 'af-exit';
      exit.className = 'af-exit';
      exit.textContent = 'Exit';
      exit.setAttribute('aria-label', 'Leave full screen play');
      exit.addEventListener('click', exitImmersive);
      bar.appendChild(exit);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && immersiveOn()) exitImmersive();
    });

    if (frame) {
      attachFrame();
      scheduleFit();
      frame.addEventListener('load', function () {
        attachFrame();
        scheduleFit();
      });
      // The frame is lazy and may still be on its initial about:blank when
      // this runs, so keep trying for a few seconds until the real document
      // has both the style and the gesture handlers.
      var tries = 0;
      var iv = setInterval(function () {
        attachFrame();
        if (gestures) attachGestures();
        if (++tries > 24 || (gestures && frame.contentDocument && frame.contentDocument.__afGestures)) {
          clearInterval(iv);
        }
      }, 250);
      window.addEventListener('resize', scheduleFit);
      window.addEventListener('orientationchange', scheduleFit);
      if (gestures && read('af_hint_' + gameId, null) === null) {
        write('af_hint_' + gameId, '1');
        setTimeout(function () {
          hint('Swipe to steer · tap to act · or use the pad');
        }, 900);
      }
    }
  }

  try {
    init();
  } catch (e) {
    /* the game is more important than the pad */
  }
})();
