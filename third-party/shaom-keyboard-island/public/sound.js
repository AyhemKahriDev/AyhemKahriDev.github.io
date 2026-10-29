"use strict";
// A small game soundtrack: separate music/FX buses, reverb, and compression.
const IslandAudio = {
  ctx: null,
  master: null,
  fx: null,
  musicBus: null,
  events: 0,
  musicStep: 0,
  init() {
    if (!state.sound) return;
    try {
      if (!this.ctx) {
        const c = (this.ctx = new (
          window.AudioContext || window.webkitAudioContext
        )());
        const master = c.createGain(),
          compressor = c.createDynamicsCompressor();
        master.gain.value = state.volume ?? 0.65;
        compressor.threshold.value = -15;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.22;
        master.connect(compressor);
        compressor.connect(c.destination);
        this.master = master;
        this.fx = c.createGain();
        this.fx.gain.value = 0.8;
        this.fx.connect(master);
        this.musicBus = c.createGain();
        this.musicBus.gain.value = 0.44;
        this.musicBus.connect(master);
        const reverb = c.createConvolver(),
          buffer = c.createBuffer(2, c.sampleRate * 0.65, c.sampleRate);
        for (let n = 0; n < 2; n++) {
          const a = buffer.getChannelData(n);
          for (let i = 0; i < a.length; i++)
            a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 2.8);
        }
        reverb.buffer = buffer;
        const wet = c.createGain();
        wet.gain.value = 0.13;
        reverb.connect(wet);
        wet.connect(master);
        this.reverb = reverb;
      }
      this.ctx.resume();
      this.master.gain.setTargetAtTime(
        state.volume ?? 0.65,
        this.ctx.currentTime,
        0.03,
      );
      audioContext = this.ctx;
    } catch {}
  },
  note(
    freq = 440,
    {
      type = "sine",
      length = 0.3,
      gain = 0.15,
      slide = 0,
      delay = 0,
      pan = 0,
      music = false,
    } = {},
  ) {
    if (!state.sound) return;
    this.init();
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(music ? this.musicBus : this.fx);
    if (!music) p.connect(this.reverb);
    o.start(t);
    o.stop(t + length + 0.02);
    this.events++;
  },
  hiss(
    length = 0.2,
    freq = 1000,
    gain = 0.1,
    delay = 0,
    band = "lowpass",
    pan = 0,
  ) {
    if (!state.sound) return;
    this.init();
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime + delay,
      b = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate),
      a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain(),
      p = c.createStereoPanner();
    s.buffer = b;
    f.type = band;
    f.frequency.value = freq;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    p.pan.value = pan;
    s.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this.fx);
    s.start(t);
    s.stop(t + length + 0.02);
    this.events++;
  },
  bell(f = 660, delay = 0) {
    this.note(f, { gain: 0.15, length: 0.7, delay });
    this.note(f * 2.76, { gain: 0.027, length: 0.21, delay });
  },
  marimba(f = 392, delay = 0, pan = 0) {
    this.note(f, { type: "triangle", gain: 0.23, length: 0.28, delay, pan });
    this.note(f * 4, { gain: 0.035, length: 0.08, delay, pan });
  },
  drum(which = 0) {
    if (which % 3 === 0) {
      this.note(145, { gain: 0.34, length: 0.23, slide: 42 });
      this.hiss(0.05, 900, 0.13);
    } else if (which % 3 === 1) {
      this.hiss(0.16, 3000, 0.22, 0, "bandpass", 0.35);
      this.note(210, { type: "triangle", gain: 0.09, length: 0.12 });
    } else {
      this.hiss(0.075, 6500, 0.17, 0, "highpass", -0.35);
      this.note(780, { gain: 0.08, length: 0.13 });
    }
  },
  water(step = 0) {
    this.hiss(0.42, 950, 0.23, 0, "lowpass", -0.25);
    [0, 0.07, 0.15].forEach((d, i) =>
      this.note(380 + i * 160 + (step % 3) * 35, {
        gain: 0.13,
        length: 0.13,
        slide: 850 + i * 200,
        delay: d,
        pan: i * 0.2,
      }),
    );
  },
  click() {
    this.marimba(523);
  },
  tickle() {
    [740, 880, 660, 990].forEach((f, i) =>
      this.note(f, {
        type: "triangle",
        length: 0.11,
        gain: 0.13,
        delay: i * 0.095,
        slide: f * 0.9,
      }),
    );
  },
  wrong() {
    this.note(300, { type: "triangle", gain: 0.095, length: 0.23, slide: 220 });
  },
  collect(combo = 1) {
    [1, 1.25, 1.5]
      .slice(0, combo >= 3 ? 3 : 2)
      .forEach((r, i) => this.bell(520 * r, i * 0.065));
  },
  celebrate(big = false) {
    const notes = big ? [392, 494, 587, 784, 988, 1175] : [523, 659, 784, 1047];
    notes.forEach((f, i) => this.marimba(f, i * 0.085, i % 2 ? 0.25 : -0.25));
    if (big) {
      this.hiss(0.7, 3500, 0.12, 0.25);
      this.note(196, { gain: 0.19, length: 0.9 });
      this.note(294, { gain: 0.1, length: 0.8, delay: 0.1 });
    }
  },
  action(ch, step, phase) {
    const k =
        {
          dinosaur: "bridge",
          ice: "snow",
          candy: "cake",
          farm: "garden",
          pirate: "sail",
          jungle: "bee",
          oasis: "water",
          city: "robot",
          magic: "star",
          aurora: "finale",
        }[ch.kind] || ch.kind,
      n = [262, 330, 392, 440, 523, 587][(step + ch.id) % 6];
    if (
      ["glow", "star", "planet", "telescope", "lighthouse", "snow"].includes(k)
    ) {
      this.bell(n * 2);
      this.note(n * 3, { gain: 0.06, length: 0.5, delay: 0.12, pan: 0.45 });
    } else if (["sail", "water", "fish", "rain", "submarine"].includes(k)) {
      this.water(step);
      if (k === "submarine")
        this.note(95, { gain: 0.15, length: 0.5, slide: 70 });
      if (k === "rain") this.bell(n);
    } else if (["drum", "melody", "concert", "record"].includes(k)) {
      this.drum(step);
      if (phase > 0) this.marimba(n, 0.035, (step % 2 ? 1 : -1) * 0.6);
      if (phase > 1) {
        this.bell(n * 1.5, 0.1);
        this.note(n / 2, { gain: 0.12, length: 0.5 });
      }
    } else if (["bridge", "gear", "train", "robot", "repair"].includes(k)) {
      this.hiss(0.07, 1200, 0.23);
      this.note(170 + (step % 4) * 30, {
        type: "triangle",
        gain: 0.27,
        length: 0.14,
        slide: 70,
      });
      if (k === "gear" || k === "robot") {
        this.note(400, {
          type: "sawtooth",
          gain: 0.025,
          length: 0.2,
          slide: 200,
        });
        this.bell(n, 0.12);
      }
      if (k === "train") {
        this.note(523, { gain: 0.1, length: 0.2, delay: 0.1 });
        this.note(659, { gain: 0.1, length: 0.3, delay: 0.28 });
      }
    } else if (["soup", "cake", "bake", "serve"].includes(k)) {
      this.hiss(0.09, 1400, 0.25);
      this.note(180, { type: "triangle", length: 0.1, gain: 0.18, slide: 65 });
      this.hiss(0.45, 3900, 0.085, 0.08, "highpass");
      this.note(430, { gain: 0.1, length: 0.15, slide: 900, delay: 0.12 });
    } else if (["rocket", "finale"].includes(k)) {
      this.hiss(0.55 + phase * 0.1, 400 + phase * 300, 0.28);
      this.note(80 + step * 7, {
        type: "sawtooth",
        gain: 0.045,
        length: 0.5,
        slide: 150 + step * 10,
      });
      this.bell(n * 2, 0.15);
    } else if (["bee", "balloon", "kite", "mail", "story"].includes(k)) {
      this.hiss(0.3, 2300, 0.08);
      this.note(n, {
        type: "triangle",
        gain: 0.15,
        length: 0.24,
        slide: n * 1.5,
      });
      this.marimba(n * 2, 0.12);
    } else {
      this.marimba(n, 0, -0.3);
      this.note(n * 1.5, { gain: 0.1, length: 0.3, delay: 0.09, pan: 0.3 });
      this.bell(n * 2, 0.18);
    }
  },
  music() {
    this.musicStep = 0;
    return setInterval(() => {
      if (
        !state.sound ||
        !state.music ||
        page !== "game" ||
        !game ||
        dialog.open ||
        document.hidden
      )
        return;
      const step = this.musicStep++,
        roots = [196, 220, 196, 165, 196, 147],
        root = roots[game.chapter.world % roots.length],
        melody = [1, 1.25, 1.5, 2, 1.5, 1.25, 1.125, 1.5],
        duck = 1;
      this.note(root * melody[step % 8] * 2, {
        type: "triangle",
        gain: 0.075 * duck,
        length: 0.24,
        music: true,
        pan: step % 2 ? 0.25 : -0.25,
      });
      if (step % 4 === 0) {
        this.note(root / 2, {
          type: "triangle",
          gain: 0.12 * duck,
          length: 0.6,
          music: true,
        });
        this.note(root, { gain: 0.04 * duck, length: 0.8, music: true });
      }
      if (game.chapter.world === 3 && step % 2)
        this.note(100, {
          gain: 0.06 * duck,
          length: 0.11,
          slide: 42,
          music: true,
        });
      if (step % 16 === 0 && game.chapter.world < 3) {
        this.note(1200, {
          gain: 0.028,
          length: 0.1,
          slide: 1800,
          delay: 0.08,
          music: true,
          pan: 0.6,
        });
        this.note(1700, {
          gain: 0.025,
          length: 0.12,
          slide: 1200,
          delay: 0.24,
          music: true,
          pan: 0.6,
        });
      }
    }, 310);
  },
};
