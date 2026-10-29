/*!
 * engine/gz-shell.js
 * GZ.Shell — builds ALL page chrome for a game page inside #gz-root: nav bar,
 * cabinet/marquee, canvas stage with CRT overlay, HUD chips, touch controls,
 * controls footer, and the ready/paused/gameover overlay panels. Games never
 * touch any of this directly; gz-core.js calls GZ.Shell.mount/setPhase/setHud
 * /setMuted on their behalf.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  var dom = {};          // cached element refs (one game per page, module-level is fine)
  var currentTitle = '';
  var touchLayout = 'lr-a';

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- touch control layouts ---------------------------------------------

  function labeledButton(label, cls, action) {
    var b = el('button', 'gz-touch-btn ' + cls, label);
    b.type = 'button';
    b.dataset.action = action;
    b.setAttribute('aria-label', action + ' (touch control)');
    return b;
  }

  function buildDpad() {
    var wrap = el('div', 'gz-dpad');
    wrap.appendChild(labeledButton('▲', 'gz-dpad-up', 'up'));
    wrap.appendChild(labeledButton('◀', 'gz-dpad-left', 'left'));
    wrap.appendChild(labeledButton('▶', 'gz-dpad-right', 'right'));
    wrap.appendChild(labeledButton('▼', 'gz-dpad-down', 'down'));
    return wrap;
  }
  function buildLR() {
    var wrap = el('div', 'gz-lr');
    wrap.appendChild(labeledButton('◀', 'gz-lr-left', 'left'));
    wrap.appendChild(labeledButton('▶', 'gz-lr-right', 'right'));
    return wrap;
  }
  function buildUD() {
    var wrap = el('div', 'gz-ud');
    wrap.appendChild(labeledButton('▲', 'gz-ud-up', 'up'));
    wrap.appendChild(labeledButton('▼', 'gz-ud-down', 'down'));
    return wrap;
  }

  function wireVirtualButton(btn) {
    var action = btn.dataset.action;
    function press(e) { GZ.Input._virtualPress(action); if (e.cancelable) e.preventDefault(); }
    function release(e) { GZ.Input._virtualRelease(action); if (e && e.cancelable) e.preventDefault(); }
    btn.addEventListener('pointerdown', press, { passive: false });
    btn.addEventListener('pointerup', release, { passive: false });
    btn.addEventListener('pointercancel', release, { passive: false });
    btn.addEventListener('pointerleave', release, { passive: false });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function buildTouchControls(layout) {
    var wrap = el('div', 'gz-touch-controls');
    wrap.dataset.layout = layout;
    if (layout === 'dpad-a') {
      wrap.appendChild(buildDpad());
      wrap.appendChild(labeledButton('A', 'gz-btn-a', 'a'));
    } else if (layout === 'lr-a' || layout === 'lr-ab') {
      wrap.appendChild(buildLR());
      if (layout === 'lr-ab') wrap.appendChild(labeledButton('B', 'gz-btn-b', 'b'));
      wrap.appendChild(labeledButton('A', 'gz-btn-a', 'a'));
    } else if (layout === 'lr-ud-a' || layout === 'lr-ud-ab') {
      wrap.appendChild(buildLR());
      wrap.appendChild(buildUD());
      if (layout === 'lr-ud-ab') wrap.appendChild(labeledButton('B', 'gz-btn-b', 'b'));
      wrap.appendChild(labeledButton('A', 'gz-btn-a', 'a'));
    } else if (layout === 'swipe') {
      wrap.appendChild(el('div', 'gz-touch-hint', 'SWIPE TO STEER'));
    } else { // 'aim-tap' or unknown: no buttons needed
      wrap.appendChild(el('div', 'gz-touch-hint', 'TAP TO AIM & FIRE'));
    }
    var buttons = wrap.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) wireVirtualButton(buttons[i]);
    return wrap;
  }

  function buildControlsFooter(controlsHelp) {
    var footer = el('div', 'gz-controls-footer');
    (controlsHelp || []).forEach(function (pair) {
      var item = el('span', 'gz-control-item');
      item.appendChild(el('kbd', 'gz-kbd', pair[0]));
      item.appendChild(document.createTextNode(' ' + pair[1]));
      footer.appendChild(item);
    });
    return footer;
  }

  function buildHud(hudCfg) {
    var hud = el('div', 'gz-hud');
    var wantLives = hudCfg.indexOf('lives') !== -1;
    var wantLevel = hudCfg.indexOf('level') !== -1;
    var chips = [{ key: 'score', label: 'SCORE' }, { key: 'high', label: 'HI' }];
    if (wantLives) chips.push({ key: 'lives', label: 'LIVES' });
    if (wantLevel) chips.push({ key: 'level', label: 'LEVEL' });
    var refs = {};
    chips.forEach(function (c) {
      var chip = el('div', 'gz-chip');
      chip.appendChild(el('span', 'gz-chip-label', c.label));
      var value = el('span', 'gz-chip-value', '0');
      chip.appendChild(value);
      hud.appendChild(chip);
      refs[c.key] = value;
    });
    dom.hudRefs = refs;
    return hud;
  }

  function buildOverlay() {
    var overlay = el('div', 'gz-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.hidden = true;
    var panel = el('div', 'gz-overlay-panel');
    overlay.appendChild(panel);
    dom.overlay = overlay;
    dom.overlayPanel = panel;
    return overlay;
  }

  function row(text, cls) { return el('p', cls || 'gz-overlay-prompt', text); }

  // ---- public API ----------------------------------------------------------

  GZ.Shell = {
    mount: function (cfg) {
      currentTitle = cfg.title;
      touchLayout = cfg.touchLayout || 'lr-a';

      var root = document.getElementById('gz-root');
      if (!root) { root = el('div'); root.id = 'gz-root'; document.body.appendChild(root); }
      root.innerHTML = '';
      document.documentElement.style.setProperty('--gz-accent', cfg.accent || '#00f0ff');

      // Nav bar
      var nav = el('nav', 'gz-nav');
      nav.setAttribute('aria-label', 'Game navigation');
      var back = el('a', 'gz-nav-back', '← Back to Arcade');
      back.href = '../../index.html';
      var title = el('span', 'gz-nav-title', cfg.title);
      var actions = el('div', 'gz-nav-actions');
      var howLink = el('a', 'gz-nav-link', '📖 How I Did It');
      howLink.href = 'how-i-did-it.html';
      var muteBtn = el('button', 'gz-mute-btn', '🔊');
      muteBtn.type = 'button';
      muteBtn.setAttribute('aria-pressed', 'false');
      muteBtn.setAttribute('aria-label', 'Mute sound');
      actions.appendChild(howLink);
      actions.appendChild(muteBtn);
      nav.appendChild(back);
      nav.appendChild(title);
      nav.appendChild(actions);

      // Cabinet
      var cabinet = el('main', 'gz-cabinet');
      var marquee = el('div', 'gz-marquee');
      marquee.appendChild(el('span', 'gz-marquee-title', cfg.title));
      var bezel = el('div', 'gz-bezel');
      var stage = el('div', 'gz-stage');
      stage.id = 'gz-stage';
      var canvas = document.createElement('canvas');
      canvas.className = 'gz-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', cfg.title + ' game canvas');
      var crt = el('div', 'gz-crt');
      crt.setAttribute('aria-hidden', 'true');
      var overlay = buildOverlay();
      stage.appendChild(canvas);
      stage.appendChild(crt);
      stage.appendChild(overlay);
      bezel.appendChild(stage);

      var hud = buildHud(cfg.hud || ['score']);
      var touchControls = buildTouchControls(touchLayout);
      var controlsFooter = buildControlsFooter(cfg.controlsHelp);

      cabinet.appendChild(marquee);
      cabinet.appendChild(bezel);
      cabinet.appendChild(hud);
      cabinet.appendChild(touchControls);
      cabinet.appendChild(controlsFooter);

      var ariaLive = el('div', 'gz-sr-only');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.setAttribute('role', 'status');

      root.appendChild(nav);
      root.appendChild(cabinet);
      root.appendChild(ariaLive);

      dom.stage = stage;
      dom.canvas = canvas;
      dom.muteBtn = muteBtn;
      dom.ariaLive = ariaLive;

      muteBtn.addEventListener('click', function () {
        var muted = GZ.Audio.toggleMuted();
        GZ.Shell.setMuted(muted);
        if (!muted) GZ.Audio.play('click');
      });

      var ctx = canvas.getContext('2d');
      function resizeCanvas() {
        var rect = canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        var w = Math.max(1, Math.round(rect.width * dpr));
        var h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ctx.setTransform(w / 800, 0, 0, h / 600, 0, 0);
      }
      resizeCanvas();
      if (window.ResizeObserver) {
        new ResizeObserver(resizeCanvas).observe(stage);
      } else {
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);
      }

      // Swipe gesture -> one-shot direction action, for touchLayout 'swipe'.
      var swipeStart = null;
      canvas.addEventListener('pointerdown', function (e) {
        if (touchLayout === 'swipe') swipeStart = { x: e.clientX, y: e.clientY };
      }, { passive: true });
      canvas.addEventListener('pointerup', function (e) {
        if (touchLayout !== 'swipe' || !swipeStart) return;
        var dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
        swipeStart = null;
        var THRESH = 24;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESH) return;
        if (Math.abs(dx) > Math.abs(dy)) GZ.Input._pulse(dx > 0 ? 'right' : 'left');
        else GZ.Input._pulse(dy > 0 ? 'down' : 'up');
      }, { passive: true });

      return { canvas: canvas, ctx: ctx };
    },

    /** Swap the overlay panel content + dim state for the new phase. */
    setPhase: function (phase, data) {
      data = data || {};
      var overlay = dom.overlay, panel = dom.overlayPanel, stage = dom.stage;
      if (!overlay || !panel || !stage) return;
      panel.innerHTML = '';

      if (phase === 'playing') {
        overlay.hidden = true;
        stage.classList.remove('gz-dimmed');
        return;
      }

      stage.classList.add('gz-dimmed');
      overlay.hidden = false;
      overlay.dataset.phase = phase;

      if (phase === 'ready') {
        panel.appendChild(el('h2', 'gz-overlay-title', currentTitle));
        var table = el('div', 'gz-overlay-controls');
        (data.controlsHelp || []).forEach(function (pair) {
          var r = el('div', 'gz-overlay-row');
          r.appendChild(el('kbd', 'gz-kbd', pair[0]));
          r.appendChild(el('span', 'gz-overlay-row-desc', pair[1]));
          table.appendChild(r);
        });
        panel.appendChild(table);
        panel.appendChild(row('PRESS SPACE / TAP TO START'));
        panel.appendChild(row('HIGH SCORE  ' + (data.high || 0), 'gz-overlay-score'));
      } else if (phase === 'paused') {
        panel.appendChild(el('h2', 'gz-overlay-title', 'PAUSED'));
        panel.appendChild(row('SPACE — Resume'));
        panel.appendChild(row('R — Restart'));
        panel.appendChild(row('ESC — Quit to Arcade'));
      } else if (phase === 'gameover') {
        panel.appendChild(el('h2', 'gz-overlay-title', 'GAME OVER'));
        panel.appendChild(row('SCORE  ' + (data.finalScore || 0), 'gz-overlay-score'));
        panel.appendChild(row('HIGH  ' + (data.high || 0), 'gz-overlay-score'));
        if (data.isNew) panel.appendChild(row('★ NEW RECORD! ★', 'gz-overlay-record'));
        panel.appendChild(row('PRESS SPACE / TAP TO RESTART'));
        this.announce('Game over. Score ' + (data.finalScore || 0) + '. High score ' + (data.high || 0) + (data.isNew ? '. New record!' : '.'));
      }
    },

    setHud: function (data) {
      var refs = dom.hudRefs;
      if (!refs) return;
      if (refs.score) refs.score.textContent = String(data.score);
      if (refs.high) refs.high.textContent = String(data.high);
      if (refs.lives) refs.lives.textContent = String(data.lives);
      if (refs.level) refs.level.textContent = String(data.level);
    },

    setMuted: function (muted) {
      if (!dom.muteBtn) return;
      dom.muteBtn.textContent = muted ? '🔇' : '🔊';
      dom.muteBtn.setAttribute('aria-pressed', String(!!muted));
      dom.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    },

    announce: function (text) {
      if (dom.ariaLive) dom.ariaLive.textContent = text;
    }
  };
})();
