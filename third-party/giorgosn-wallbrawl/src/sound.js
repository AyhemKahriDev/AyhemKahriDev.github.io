'use strict';
// Tiny WebAudio synth — no audio files, everything is generated.

const Sound = {
  ctx: null,
  muted: false,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f0, f1, dur, type = 'square', vol = 0.12) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  jump()   { this.tone(280, 520, 0.12, 'square', 0.07); },
  shoot()  { this.tone(880, 160, 0.07, 'sawtooth', 0.09); },
  punch()  { this.tone(180, 60, 0.08, 'square', 0.12); },
  hit()    { this.tone(320, 90, 0.1, 'sawtooth', 0.13); },
  die()    { this.tone(220, 30, 0.5, 'sawtooth', 0.18); },
  pickup() { this.tone(520, 1040, 0.12, 'triangle', 0.12); },
  land()   { this.tone(140, 80, 0.06, 'sine', 0.08); },
  round()  { this.tone(392, 784, 0.25, 'triangle', 0.13); },
};
