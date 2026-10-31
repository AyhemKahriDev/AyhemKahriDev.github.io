// Synthesised sound. No asset files: every effect is built from oscillators
// and noise, which keeps the whole game a handful of text files.

export function createAudio() {
  let ctx = null;
  let master = null;
  let crowdGain = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      startCrowd();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(seconds = 1) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startCrowd() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3);
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 620;
    band.Q.value = 0.7;
    crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.035;
    src.connect(band).connect(crowdGain).connect(master);
    src.start();
  }

  function noise(duration, { gain = 0.3, type = 'highpass', freq = 800, q = 1 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.max(duration, 0.05));
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  function tone(freq, duration, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  const api = {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    kick(power = 1) {
      if (!ensure() || muted) return;
      noise(0.09, { gain: 0.16 + 0.2 * power, freq: 1400, type: 'highpass' });
      tone(160 - 40 * power, 0.11, { type: 'triangle', gain: 0.16 + 0.14 * power, slideTo: 70 });
    },
    pass() {
      if (!ensure() || muted) return;
      noise(0.06, { gain: 0.12, freq: 1800, type: 'highpass' });
    },
    post() {
      if (!ensure() || muted) return;
      tone(1180, 0.5, { type: 'sine', gain: 0.24, slideTo: 900 });
      tone(1790, 0.36, { type: 'sine', gain: 0.12, slideTo: 1500 });
    },
    save() {
      if (!ensure() || muted) return;
      noise(0.16, { gain: 0.22, freq: 500, type: 'bandpass', q: 1.2 });
    },
    tackle() {
      if (!ensure() || muted) return;
      noise(0.13, { gain: 0.2, freq: 320, type: 'lowpass' });
    },
    whistle(long = false) {
      if (!ensure() || muted) return;
      const d = long ? 0.75 : 0.32;
      tone(2150, d, { type: 'square', gain: 0.1 });
      tone(2780, d, { type: 'square', gain: 0.055 });
      noise(d, { gain: 0.05, freq: 2400, type: 'bandpass', q: 3 });
    },
    goal() {
      if (!ensure() || muted) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone(f, 0.42, { type: 'triangle', gain: 0.16, delay: i * 0.085 }));
      api.cheer();
    },
    cheer() {
      if (!ensure() || muted || !crowdGain) return;
      const t = ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(0.3, t + 0.25);
      crowdGain.gain.linearRampToValueAtTime(0.035, t + 3.2);
    },
    /** Play whatever this batch of simulation events sounds like. */
    handleEvents(events) {
      for (const e of events) {
        switch (e.type) {
          case 'shot': api.kick(Math.min(1, (e.power || 500) / 780)); break;
          case 'pass': case 'clear': api.pass(); break;
          case 'post': api.post(); break;
          case 'save': api.save(); break;
          case 'tackle': api.tackle(); break;
          case 'goal': api.goal(); break;
          case 'halftime': api.whistle(true); break;
          case 'fulltime': api.whistle(true); break;
          default: break;
        }
      }
    },
  };
  return api;
}
