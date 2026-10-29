/* ============ WebAudio 芯片音频引擎：音效合成 + 8bit 音乐序列器 ============ */
(function () {
  let ctx = null, sfxGain = null, musGain = null, noiseBuf = null;
  let soundOn = localStorage.getItem('bg_sound') !== '0';

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = 0.17; musGain.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(name) { // "A4" / "F#3"
    const m = /^([A-G]#?)(\d)$/.exec(name); if (!m) return 0;
    const midi = (parseInt(m[2]) + 1) * 12 + NOTE_IDX[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function tone(f0, f1, dur, type, vol, when) {
    const c = ensure(); if (!c || !soundOn) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freqHz, when) {
    const c = ensure(); if (!c || !soundOn) return;
    const t = c.currentTime + (when || 0);
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freqHz || 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* ---------- 音效库 ---------- */
  const sfx = {
    unlock: () => ensure(),
    move:   () => tone(220, 220, 0.035, 'square', 0.25),
    softdrop: () => tone(150, 110, 0.028, 'triangle', 0.16),
    rotate: () => tone(330, 620, 0.07, 'square', 0.3),
    lock:   () => { tone(150, 90, 0.09, 'triangle', 0.5); noise(0.05, 0.18, 900); },
    clear:  () => { tone(523, 523, 0.07, 'square', 0.35); tone(659, 659, 0.07, 'square', 0.35, 0.07); tone(784, 784, 0.12, 'square', 0.35, 0.14); },
    tetris: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.11, 'square', 0.4, i * 0.09)); noise(0.3, 0.2, 3000, 0.1); },
    levelup:() => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.09, 'square', 0.35, i * 0.07)),
    over:   () => { tone(440, 110, 0.9, 'sawtooth', 0.4); tone(330, 82, 0.9, 'square', 0.25, 0.05); },
    menu:   () => tone(660, 660, 0.045, 'square', 0.25),
    select: () => { tone(660, 660, 0.06, 'square', 0.3); tone(990, 990, 0.09, 'square', 0.3, 0.06); },
    eat:    () => tone(880, 1320, 0.08, 'square', 0.35),
    shoot:  () => tone(950, 180, 0.09, 'sawtooth', 0.28),
    boom:   () => { noise(0.4, 0.55, 700); tone(120, 40, 0.35, 'triangle', 0.5); },
    hit:    () => noise(0.12, 0.3, 1500),
    coin:   () => { tone(988, 988, 0.07, 'square', 0.35); tone(1319, 1319, 0.16, 'square', 0.35, 0.07); },
    bounce: () => tone(440, 440, 0.04, 'triangle', 0.4),
    flip:   () => tone(320, 480, 0.05, 'square', 0.3),
    win:    () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'square', 0.38, i * 0.11)),
    crash:  () => { noise(0.5, 0.6, 500); tone(200, 50, 0.4, 'sawtooth', 0.4); },
    jump:   () => tone(300, 700, 0.1, 'square', 0.3),
    die:    () => { tone(600, 100, 0.4, 'square', 0.4); noise(0.25, 0.3, 800, 0.05); },
  };

  /* ---------- 音乐序列器 ---------- */
  // 记谱：[音名或0(rest), 16分音符数]
  const K = (n, l) => [n, l];
  const SONGS = {
    tetris: {
      tempo: 0.105, // 每个16分音符秒数
      lead: [K('E5',4),K('B4',2),K('C5',2),K('D5',4),K('C5',2),K('B4',2),
             K('A4',4),K('A4',2),K('C5',2),K('E5',4),K('D5',2),K('C5',2),
             K('B4',6),K('C5',2),K('D5',4),K('E5',4),
             K('C5',4),K('A4',4),K('A4',4),K(0,4),
             K('D5',6),K('F5',2),K('A5',4),K('G5',2),K('F5',2),
             K('E5',6),K('C5',2),K('E5',4),K('D5',2),K('C5',2),
             K('B4',4),K('B4',2),K('C5',2),K('D5',4),K('E5',4),
             K('C5',4),K('A4',4),K('A4',4),K(0,4)],
      bass: [K('A2',4),K('E3',4),K('A2',4),K('E3',4),K('A2',4),K('E3',4),K('A2',4),K('E3',4),
             K('E2',4),K('E3',4),K('E2',4),K('E3',4),K('A2',4),K('E3',4),K('A2',4),K('A2',4),
             K('D3',4),K('A3',4),K('D3',4),K('A3',4),K('C3',4),K('G3',4),K('C3',4),K('G3',4),
             K('E2',4),K('E3',4),K('E2',4),K('E3',4),K('A2',4),K('E3',4),K('A2',4),K('E2',4)],
    },
    snake: {
      tempo: 0.115,
      lead: [K('A4',2),K('C5',2),K('E5',2),K('A5',2),K('G5',4),K('E5',4),
             K('F5',2),K('A5',2),K('C6',2),K('A5',2),K('G5',4),K('E5',4),
             K('E5',2),K('G5',2),K('B5',2),K('G5',2),K('E5',4),K('C5',4),
             K('D5',2),K('E5',2),K('F5',2),K('E5',2),K('D5',4),K('C5',4)],
      bass: [K('A2',4),K('A2',2),K('A2',2),K('F2',4),K('F2',4),K('G2',4),K('G2',2),K('G2',2),
             K('A2',4),K('A2',2),K('A2',2),K('F2',4),K('F2',4),K('E2',4),K('E2',4),K('E2',4)],
    },
    racer: {
      tempo: 0.085,
      lead: [K('E5',2),K('E5',2),K(0,2),K('E5',2),K('G5',2),K(0,2),K('E5',2),K('D5',2),
             K('E5',2),K('E5',2),K(0,2),K('E5',2),K('A5',2),K(0,2),K('G5',2),K('E5',2)],
      bass: [K('E2',1),K('E2',1),K('E2',1),K('E2',1),K('E2',1),K('E2',1),K('E2',1),K('E2',1),
             K('C2',1),K('C2',1),K('C2',1),K('C2',1),K('D2',1),K('D2',1),K('D2',1),K('D2',1)],
    },
    battle: {
      tempo: 0.1,
      lead: [K('D4',2),K('D4',2),K('F4',2),K('D4',2),K('G4',4),K('F4',2),K('D4',2),
             K('A4',2),K('A4',2),K('C5',2),K('A4',2),K('G4',4),K('F4',2),K('D4',2)],
      bass: [K('D2',4),K('D2',4),K('D2',4),K('D2',4),K('A1',4),K('A1',4),K('C2',4),K('D2',4)],
    },
    chill: {
      tempo: 0.14,
      lead: [K('C5',4),K('E5',4),K('G5',4),K('E5',4),K('F5',4),K('A5',4),K('G5',8),
             K('E5',4),K('G5',4),K('C6',4),K('G5',4),K('A5',4),K('F5',4),K('E5',8)],
      bass: [K('C3',8),K('A2',8),K('F2',8),K('G2',8),K('C3',8),K('A2',8),K('F2',8),K('G2',8)],
    },
  };

  let cur = null, timer = null, leadPos = 0, bassPos = 0, leadTime = 0, bassTime = 0;
  function scheduleNote(song, list, pos, when, key) {
    const [n, len] = list[pos % list.length];
    if (n) {
      const c = ctx, t = when;
      const o = c.createOscillator(), g = c.createGain();
      o.type = key === 'lead' ? 'square' : 'triangle';
      o.frequency.value = freq(n);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(key === 'lead' ? 0.5 : 0.55, t + 0.008);
      g.gain.setValueAtTime(key === 'lead' ? 0.5 : 0.55, t + len * song.tempo * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + len * song.tempo * 0.92);
      o.connect(g); g.connect(musGain);
      o.start(t); o.stop(t + len * song.tempo);
    }
    return when + len * song.tempo;
  }
  function pump() {
    const c = ctx; if (!c || !cur) return;
    const song = SONGS[cur]; if (!song) return;
    while (Math.min(leadTime, bassTime) < c.currentTime + 0.15) {
      if (leadTime <= bassTime) {
        leadTime = scheduleNote(song, song.lead, leadPos, leadTime, 'lead');
        leadPos = (leadPos + 1) % song.lead.length;
      } else {
        bassTime = scheduleNote(song, song.bass, bassPos, bassTime, 'bass');
        bassPos = (bassPos + 1) % song.bass.length;
      }
    }
  }
  const music = {
    play(name) {
      if (!SONGS[name] || cur === name) return;
      music.stop(); const c = ensure(); if (!c) return;
      cur = name; leadPos = 0; bassPos = 0;
      leadTime = bassTime = c.currentTime + 0.05;
      timer = setInterval(pump, 60); pump();
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } cur = null; },
    get playing() { return !!cur; },
  };

  function setSound(on) {
    soundOn = on;
    localStorage.setItem('bg_sound', on ? '1' : '0');
    if (!on) music.stop(); else if (cur) { const c2 = cur; music.stop(); music.play(c2); }
  }

  window.Sound = {
    sfx,
    music,
    toggle: () => { setSound(!soundOn); return soundOn; },
    get on() { return soundOn; },
    unlock: ensure,
  };
})();
