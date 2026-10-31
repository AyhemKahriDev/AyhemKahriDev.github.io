window.SD = window.SD || {};

(function () {
  'use strict';

  const BARS = [
    { root: 110, tones: [220, 261.63, 329.63, 440] },
    { root: 87.31, tones: [174.61, 220, 261.63, 349.23] },
    { root: 130.81, tones: [261.63, 329.63, 392, 523.25] },
    { root: 98, tones: [196, 246.94, 293.66, 392] }
  ];
  const STEP_DUR = 60 / 132 / 4;

  const A = (window.SD.Audio = {
    ctx: null,
    master: null,
    musicBus: null,
    muted: false,
    musicOn: false,
    _timer: null,
    _step: 0,
    _next: 0,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.9;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.16;
        this.musicBus.connect(this.master);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) {
        this.master.gain.value = m ? 0 : 0.9;
      }
    },

    _tone(freq, endFreq, dur, type, gain, when, dest) {
      if (!this.ctx) return;
      const t0 = when || this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      }
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(dest || this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    _noise(dur, gain, filterFreq, when, dest) {
      if (!this.ctx) return;
      const t0 = when || this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(dest || this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    },

    coin() {
      this.ensure();
      if (!this.ctx) return;
      this._tone(988, 988, 0.07, 'square', 0.05);
      this._tone(1568, 1568, 0.12, 'square', 0.05, this.ctx.currentTime + 0.06);
    },

    jump() {
      this.ensure();
      if (!this.ctx) return;
      this._tone(300, 680, 0.16, 'sawtooth', 0.05);
    },

    slide() {
      this.ensure();
      if (!this.ctx) return;
      this._noise(0.22, 0.1, 600);
    },

    crash() {
      this.ensure();
      if (!this.ctx) return;
      this._noise(0.5, 0.25, 2400);
      this._tone(130, 36, 0.55, 'sine', 0.3);
    },

    bite() {
      this.ensure();
      if (!this.ctx) return;
      this._tone(90, 35, 0.7, 'sawtooth', 0.22);
      this._noise(0.5, 0.2, 500);
      this._tone(60, 28, 0.6, 'sine', 0.3);
    },

    powerup() {
      this.ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this._tone(523.25, 523.25, 0.1, 'triangle', 0.07, t);
      this._tone(659.25, 659.25, 0.1, 'triangle', 0.07, t + 0.07);
      this._tone(783.99, 783.99, 0.16, 'triangle', 0.08, t + 0.14);
    },

    shieldBreak() {
      this.ensure();
      if (!this.ctx) return;
      this._noise(0.3, 0.18, 3200);
      this._tone(880, 220, 0.3, 'sine', 0.12);
    },

    smash() {
      this.ensure();
      if (!this.ctx) return;
      this._noise(0.16, 0.16, 1800);
      this._tone(220, 90, 0.2, 'square', 0.08);
    },

    revive() {
      this.ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this._tone(392, 392, 0.14, 'triangle', 0.08, t);
      this._tone(523.25, 523.25, 0.14, 'triangle', 0.08, t + 0.1);
      this._tone(659.25, 659.25, 0.22, 'triangle', 0.09, t + 0.2);
    },

    startMusic() {
      if (this.musicOn) return;
      this.ensure();
      if (!this.ctx) return;
      this.musicOn = true;
      this._step = 0;
      this._next = this.ctx.currentTime + 0.08;
      this._timer = setInterval(() => this._schedule(), 100);
    },

    _schedule() {
      if (!this.ctx) return;
      while (this._next < this.ctx.currentTime + 0.3) {
        const s = this._step;
        const bar = BARS[Math.floor(s / 16) % 4];
        const pos = s % 16;
        const t = this._next;
        if (pos % 2 === 0) {
          this._tone(bar.root, bar.root, 0.16, 'square', 0.05, t, this.musicBus);
        }
        if (pos % 4 === 0) {
          const tn = bar.tones[Math.floor(s / 4) % 4];
          this._tone(tn, tn, 0.14, 'triangle', 0.08, t, this.musicBus);
        }
        if (pos % 8 === 0) {
          this._tone(58, 40, 0.12, 'sine', 0.12, t, this.musicBus);
        }
        this._next += STEP_DUR;
        this._step = (this._step + 1) % 64;
      }
    },

    stopMusic() {
      this.musicOn = false;
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
  });
})();
