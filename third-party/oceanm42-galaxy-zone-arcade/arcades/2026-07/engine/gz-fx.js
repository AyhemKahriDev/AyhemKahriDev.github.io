/*!
 * engine/gz-fx.js
 * GZ.FX — particle bursts, screen shake, flash, and floating score text.
 * GZ.Draw — canvas text/glow helpers built on the Press Start 2P webfont.
 *
 * gz-core.js calls FX.update()/FX.render()/FX.getShakeOffset() once per
 * frame automatically; games only ever call the four public trigger
 * methods (burst/shake/flash/text). Everything is backed by fixed-size
 * pools so steady-state play never allocates.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  var MAX_PARTICLES = 220;
  var MAX_TEXTS = 24;

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  // ---- fixed pools -------------------------------------------------------
  var particles = [];
  for (var i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  var texts = [];
  for (var j = 0; j < MAX_TEXTS; j++) {
    texts.push({ active: false, x: 0, y: 0, str: '', life: 0, maxLife: 1, color: '#fff', size: 10 });
  }

  var shakeState = { mag: 0, dur: 0, timeLeft: 0 };
  var flashState = { color: '#fff', dur: 0, timeLeft: 0 };

  function freeParticle() {
    for (var k = 0; k < particles.length; k++) if (!particles[k].active) return particles[k];
    return particles[0]; // pool exhausted: steal the oldest slot rather than allocate
  }
  function freeText() {
    for (var k = 0; k < texts.length; k++) if (!texts[k].active) return texts[k];
    return texts[0];
  }

  GZ.FX = {
    burst: function (x, y, opts) {
      opts = opts || {};
      var reduced = prefersReducedMotion();
      var count = opts.count != null ? opts.count : 12;
      if (reduced) count = Math.max(2, Math.ceil(count * 0.3));
      var speed = opts.speed != null ? opts.speed : 140;
      var life = opts.life != null ? opts.life : 0.5;
      var size = opts.size != null ? opts.size : 3;
      var color = opts.color || '#eaf6ff';
      for (var n = 0; n < count; n++) {
        var p = freeParticle();
        var ang = Math.random() * Math.PI * 2;
        var spd = speed * (0.4 + Math.random() * 0.6);
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.life = p.maxLife = life * (0.7 + Math.random() * 0.6);
        p.size = size * (0.7 + Math.random() * 0.6);
        p.color = color;
      }
    },

    shake: function (magnitude, dur) {
      if (prefersReducedMotion()) return;
      shakeState.mag = magnitude != null ? magnitude : 6;
      shakeState.dur = dur != null ? dur : 0.3;
      shakeState.timeLeft = shakeState.dur;
    },

    flash: function (color, dur) {
      if (prefersReducedMotion()) return;
      flashState.color = color || '#fff';
      flashState.dur = dur != null ? dur : 0.12;
      flashState.timeLeft = flashState.dur;
    },

    text: function (x, y, str, opts) {
      opts = opts || {};
      var t = freeText();
      t.active = true;
      t.x = x; t.y = y; t.str = String(str);
      t.life = t.maxLife = 0.9;
      t.color = opts.color || '#ffe600';
      t.size = opts.size != null ? opts.size : 10;
    },

    /** Engine-internal: advance all pools. Called once per fixed update. */
    update: function (dt) {
      var i;
      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
      for (i = 0; i < texts.length; i++) {
        var t = texts[i];
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) { t.active = false; continue; }
        t.y -= 28 * dt;
      }
      if (shakeState.timeLeft > 0) shakeState.timeLeft = Math.max(0, shakeState.timeLeft - dt);
      if (flashState.timeLeft > 0) flashState.timeLeft = Math.max(0, flashState.timeLeft - dt);
    },

    /** Engine-internal: draw active particles/text/flash on top of the game render. */
    render: function (ctx) {
      var i;
      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!p.active) continue;
        var a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < texts.length; i++) {
        var t = texts[i];
        if (!t.active) continue;
        var ta = Math.max(0, t.life / t.maxLife);
        ctx.globalAlpha = ta;
        GZ.Draw.text(ctx, t.str, t.x, t.y, { size: t.size, color: t.color, align: 'center' });
      }
      ctx.globalAlpha = 1;
      if (flashState.timeLeft > 0) {
        var fa = (flashState.timeLeft / flashState.dur) * 0.6;
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.fillStyle = flashState.color;
        ctx.fillRect(0, 0, 800, 600);
        ctx.restore();
      }
    },

    /** Engine-internal: current shake translation to apply before game render. */
    getShakeOffset: function () {
      if (shakeState.timeLeft <= 0) return { x: 0, y: 0 };
      var amt = shakeState.mag * (shakeState.timeLeft / shakeState.dur);
      return { x: (Math.random() * 2 - 1) * amt, y: (Math.random() * 2 - 1) * amt };
    },

    /** Engine-internal: clear all pools/timers (called at boot and each new play). */
    reset: function () {
      for (var i = 0; i < particles.length; i++) particles[i].active = false;
      for (var j = 0; j < texts.length; j++) texts[j].active = false;
      shakeState.timeLeft = 0;
      flashState.timeLeft = 0;
    }
  };

  // ---- GZ.Draw ------------------------------------------------------------

  var FONT_STACK = "'Press Start 2P', 'Courier New', monospace";
  try {
    if (document.fonts && document.fonts.load) document.fonts.load('16px ' + FONT_STACK).catch(function () {});
  } catch (e) { /* fonts API unsupported: fallback font still renders fine */ }

  GZ.Draw = {
    text: function (ctx, str, x, y, opts) {
      opts = opts || {};
      var size = opts.size != null ? opts.size : 16;
      var color = opts.color || '#eaf6ff';
      var align = opts.align || 'left';
      ctx.save();
      ctx.font = size + 'px ' + FONT_STACK;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color;
      if (opts.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 0.8;
      }
      ctx.fillText(str, x, y);
      ctx.restore();
    },

    glow: function (ctx, color, blur, fn) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      fn();
      ctx.restore();
    }
  };
})();
