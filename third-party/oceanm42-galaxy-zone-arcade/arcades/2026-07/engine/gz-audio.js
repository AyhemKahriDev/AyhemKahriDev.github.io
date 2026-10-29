/*!
 * engine/gz-audio.js
 * GZ.Audio — one lazily-created shared AudioContext with a small library of
 * synthesized retro sound effects. No audio files are ever loaded; every
 * sound is generated with oscillators + a short noise buffer so the whole
 * arcade works completely offline from file://.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  var ctx = null;
  var masterGain = null;
  var noiseBuf = null;
  var muted = false;
  var unlocked = false;

  function ensureCtx() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no Web Audio support: fail silently, never throw
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function getNoiseBuffer() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 1);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /** Core oscillator voice: attack/decay envelope, optional frequency ramp. */
  function voice(type, freq, t0, dur, vol, endFreq) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    }
    var g = ctx.createGain();
    var attack = Math.min(0.02, dur * 0.25);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noiseBurst(t0, dur, vol, filterFreq, filterType) {
    if (!ctx) return;
    var src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    var filt = ctx.createBiquadFilter();
    filt.type = filterType || 'lowpass';
    filt.frequency.setValueAtTime(filterFreq, t0);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  // Every preset is `function (t0)` scheduling its own voices at/after t0.
  var PRESETS = {
    shoot: function (t) { voice('square', 880, t, 0.09, 0.16, 260); },
    laser: function (t) { voice('sawtooth', 1500, t, 0.16, 0.14, 180); },
    hit: function (t) { voice('square', 220, t, 0.08, 0.18, 90); noiseBurst(t, 0.06, 0.08, 2200); },
    bounce: function (t) { voice('triangle', 260, t, 0.08, 0.22, 520); },
    explode: function (t) { noiseBurst(t, 0.35, 0.32, 1000); voice('sine', 130, t, 0.3, 0.22, 40); },
    bigExplode: function (t) {
      noiseBurst(t, 0.7, 0.4, 700);
      noiseBurst(t + 0.05, 0.5, 0.25, 350);
      voice('sine', 90, t, 0.65, 0.3, 28);
    },
    pickup: function (t) { voice('sine', 660, t, 0.12, 0.2, 1320); },
    powerup: function (t) {
      [523, 659, 784].forEach(function (f, i) { voice('square', f, t + i * 0.07, 0.12, 0.16); });
    },
    jump: function (t) { voice('sine', 300, t, 0.18, 0.2, 520); },
    move: function (t) { voice('square', 150, t, 0.03, 0.045, 150); },
    die: function (t) { voice('sawtooth', 320, t, 0.5, 0.24, 55); noiseBurst(t, 0.4, 0.12, 500); },
    levelup: function (t) {
      [523, 659, 784, 1046].forEach(function (f, i) { voice('triangle', f, t + i * 0.09, 0.16, 0.2); });
    },
    warp: function (t) { voice('sine', 180, t, 0.4, 0.18, 920); voice('sawtooth', 90, t, 0.4, 0.08, 460); },
    start: function (t) { voice('triangle', 392, t, 0.1, 0.18); voice('triangle', 523, t + 0.09, 0.14, 0.2); },
    pause: function (t) { voice('triangle', 440, t, 0.1, 0.16, 300); },
    resume: function (t) { voice('triangle', 330, t, 0.1, 0.16, 440); },
    gameover: function (t) {
      [392, 330, 262].forEach(function (f, i) { voice('sawtooth', f, t + i * 0.14, 0.22, 0.2); });
    },
    highscore: function (t) {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) { voice('square', f, t + i * 0.06, 0.18, 0.2); });
    },
    coin: function (t) { voice('square', 988, t, 0.06, 0.18); voice('square', 1318, t + 0.06, 0.16, 0.2); },
    click: function (t) { voice('square', 600, t, 0.04, 0.09); }
  };

  GZ.Audio = {
    /** Lazily prep the context + hook the first user gesture to unlock it. */
    init: function () {
      try {
        muted = !!(GZ.Scores && GZ.Scores.isMuted && GZ.Scores.isMuted());
      } catch (e) { muted = false; }
      ensureCtx();
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true });
    },

    /** Play a named preset immediately. Silently no-ops if unsupported/muted. */
    play: function (name) {
      if (muted) return;
      ensureCtx();
      if (!ctx) return;
      var fn = PRESETS[name];
      if (fn) fn(ctx.currentTime);
    },

    /** Bespoke one-off tone for games that need something the presets don't cover. */
    tone: function (opts) {
      if (muted) return;
      ensureCtx();
      if (!ctx) return;
      opts = opts || {};
      voice(opts.type || 'sine', opts.freq || 440, ctx.currentTime, opts.dur || 0.15, opts.vol != null ? opts.vol : 0.2, opts.endFreq);
    },

    toggleMuted: function () {
      muted = !muted;
      if (masterGain) masterGain.gain.value = muted ? 0 : 1;
      try { GZ.Scores && GZ.Scores.setMuted && GZ.Scores.setMuted(muted); } catch (e) { /* private mode etc. */ }
      return muted;
    },

    get muted() { return muted; }
  };
})();
