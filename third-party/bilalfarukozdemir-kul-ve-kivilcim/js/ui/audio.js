/* =========================================================================
   SES — tamamen sentezlenmiş. Hiç ses dosyası yok; her efekt WebAudio
   osilatör + gürültü + zarf ile anlık üretiliyor.
   ========================================================================= */
(function (global) {
  'use strict';

  var ctx = null;
  var anaKazanc = null;      // her şeyin toplandığı yer
  var sfxKuru = null;        // efektlerin kuru yolu
  var sfxIslak = null;       // efektlerin reverb gönderimi
  var muzikBus = null;       // müzik motoru buraya bağlanır
  var reverb = null;
  var acik = true;
  var gurultuTampon = null;

  /* --- prosedürel impulse response: gürültü + üstel sönüm --------------
     Kayıtlı bir oda kaydı yok; küllü, geniş ve boğuk bir mekân hissini
     rastgele gürültüyü söndürerek üretiyoruz. Sesleri "kuru sentez"
     olmaktan çıkaran asıl şey bu. */
  function reverbTamponu(sure, bozunum) {
    var n = Math.floor(ctx.sampleRate * sure);
    var buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      var son = 0;
      for (var i = 0; i < n; i++) {
        var t = i / n;
        var g = Math.pow(1 - t, bozunum);
        // hafif alçak geçiren: yansımalar boğuklaşsın
        son = son * 0.62 + (Math.random() * 2 - 1) * 0.38;
        d[i] = son * g;
      }
    }
    return buf;
  }

  function baslat() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { acik = false; return null; }
    ctx = new AC();

    anaKazanc = ctx.createGain();
    anaKazanc.gain.value = acik ? 0.34 : 0;
    anaKazanc.connect(ctx.destination);

    // Reverb yolu
    reverb = ctx.createConvolver();
    reverb.buffer = reverbTamponu(2.6, 2.4);
    var reverbTon = ctx.createBiquadFilter();
    reverbTon.type = 'lowpass';
    reverbTon.frequency.value = 2600;
    var reverbSeviye = ctx.createGain();
    reverbSeviye.gain.value = 0.9;
    reverb.connect(reverbTon);
    reverbTon.connect(reverbSeviye);
    reverbSeviye.connect(anaKazanc);

    sfxKuru = ctx.createGain(); sfxKuru.gain.value = 1;
    sfxKuru.connect(anaKazanc);

    sfxIslak = ctx.createGain(); sfxIslak.gain.value = 0.26;
    sfxIslak.connect(reverb);

    muzikBus = ctx.createGain(); muzikBus.gain.value = 0.55;
    muzikBus.connect(anaKazanc);
    var muzikIslak = ctx.createGain(); muzikIslak.gain.value = 0.42;
    muzikBus.connect(muzikIslak);
    muzikIslak.connect(reverb);

    // Beyaz gürültü tamponu (vuruş, ateş, hışırtı için)
    var n = ctx.sampleRate * 1.2;
    gurultuTampon = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = gurultuTampon.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /** Bir kaynağı hem kuru hem ıslak yola bağla */
  function cikisaBagla(dugum, islaklik) {
    dugum.connect(sfxKuru);
    if (islaklik !== 0) {
      var g = ctx.createGain();
      g.gain.value = islaklik === undefined ? 1 : islaklik;
      dugum.connect(g);
      g.connect(sfxIslak);
    }
  }

  function simdi() { return ctx.currentTime; }

  /** Basit osilatör sesi */
  function ton(o) {
    if (!acik) return;
    if (!baslat()) return;
    var t0 = simdi() + (o.gecikme || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.tip || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.sure);
    var pik = (o.ses === undefined ? 0.3 : o.ses);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pik, t0 + (o.atak || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.sure);
    var son = g;
    if (o.filtre) {
      var f = ctx.createBiquadFilter();
      f.type = o.filtre; f.frequency.value = o.filtreF || 1200;
      g.connect(f); son = f;
    }
    osc.connect(g);
    cikisaBagla(son, o.islak);
    osc.start(t0); osc.stop(t0 + o.sure + 0.03);
  }

  /** Gürültü tabanlı ses (vuruş, alev, hışırtı) */
  function gurultu(o) {
    if (!acik) return;
    if (!baslat()) return;
    var t0 = simdi() + (o.gecikme || 0);
    var src = ctx.createBufferSource();
    src.buffer = gurultuTampon;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.filtre || 'bandpass';
    f.frequency.setValueAtTime(o.f || 900, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t0 + o.sure);
    f.Q.value = o.q || 1.1;
    var g = ctx.createGain();
    var pik = (o.ses === undefined ? 0.24 : o.ses);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pik, t0 + (o.atak || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.sure);
    src.connect(f); f.connect(g);
    cikisaBagla(g, o.islak);
    src.start(t0); src.stop(t0 + o.sure + 0.03);
  }

  /** Sert transient: vuruşlara "çarpma" hissi veren çok kısa tıklama */
  function transient(guc, gecikme) {
    if (!acik || !baslat()) return;
    var t0 = simdi() + (gecikme || 0);
    var src = ctx.createBufferSource();
    src.buffer = gurultuTampon;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, 0.16 + guc * 0.2), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    src.connect(f); f.connect(g);
    cikisaBagla(g, 0.35);
    src.start(t0); src.stop(t0 + 0.06);
  }

  var SES = {

    kur: baslat,

    /** Müzik motorunun bağlanacağı yer (reverb gönderimi hazır) */
    baglam: function () { return baslat(); },
    muzikCikisi: function () { baslat(); return muzikBus; },

    ayar: function (v) {
      acik = !!v;
      if (ctx && anaKazanc) {
        anaKazanc.gain.setTargetAtTime(acik ? 0.34 : 0, ctx.currentTime, 0.05);
      }
    },

    /** Müzik seviyesi ayrı ayarlanabilsin (0..1) */
    muzikSeviye: function (v) {
      if (!ctx || !muzikBus) return;
      muzikBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.2);
    },

    /* --- arayüz --- */
    tik: function () { ton({ f: 620, f2: 460, sure: 0.05, tip: 'triangle', ses: 0.13 }); },
    dugme: function () {
      ton({ f: 300, f2: 520, sure: 0.09, tip: 'triangle', ses: 0.17 });
    },
    gez: function () { ton({ f: 900, sure: 0.03, tip: 'sine', ses: 0.05 }); },

    /* --- kart --- */
    kartCek: function (i) {
      gurultu({ f: 2600, f2: 900, sure: 0.13, ses: 0.075, q: 0.7,
                gecikme: (i || 0) * 0.075 });
    },
    kartOyna: function () {
      gurultu({ f: 1500, f2: 380, sure: 0.16, ses: 0.13, q: 0.8 });
      ton({ f: 420, f2: 250, sure: 0.11, tip: 'triangle', ses: 0.1 });
    },
    kartAt: function () { gurultu({ f: 900, f2: 300, sure: 0.1, ses: 0.07 }); },
    tuket: function () {
      gurultu({ f: 3000, f2: 200, sure: 0.4, ses: 0.13, q: 0.5 });
      ton({ f: 800, f2: 120, sure: 0.35, tip: 'sawtooth', ses: 0.07, filtre: 'lowpass', filtreF: 900 });
    },

    /* --- savaş --- */
    vurus: function (guc) {
      var g = Math.min(1.6, 0.6 + (guc || 0));
      transient(g);
      gurultu({ f: 340 * g, f2: 70, sure: 0.13 + g * 0.05, ses: 0.2 + g * 0.08,
                filtre: 'lowpass', filtreF: 1400, q: 0.6, islak: 0.5 });
      ton({ f: 150, f2: 48, sure: 0.16, tip: 'square', ses: 0.13,
            filtre: 'lowpass', filtreF: 500, islak: 0.3 });
    },
    kritik: function () {
      transient(1.5);
      gurultu({ f: 500, f2: 60, sure: 0.34, ses: 0.34, filtre: 'lowpass',
                filtreF: 2200, islak: 0.9 });
      ton({ f: 190, f2: 40, sure: 0.4, tip: 'sawtooth', ses: 0.2,
            filtre: 'lowpass', filtreF: 700, islak: 0.6 });
      ton({ f: 62, f2: 34, sure: 0.5, tip: 'sine', ses: 0.24, islak: 0 });
    },
    blok: function () {
      ton({ f: 1500, f2: 900, sure: 0.12, tip: 'triangle', ses: 0.16 });
      ton({ f: 2400, f2: 1600, sure: 0.08, tip: 'sine', ses: 0.1, gecikme: 0.015 });
      gurultu({ f: 3600, f2: 1400, sure: 0.1, ses: 0.08, q: 2.4 });
    },
    zirh: function () { ton({ f: 420, f2: 760, sure: 0.2, tip: 'triangle', ses: 0.13 }); },
    /** Katmanlı ateş: gövde uğultusu + rastgele çıtırtılar */
    alev: function (yogunluk) {
      var y = yogunluk === undefined ? 1 : yogunluk;
      gurultu({ f: 420, f2: 1500, sure: 0.42 * y, ses: 0.13 * y, q: 0.4,
                filtre: 'bandpass', islak: 0.8 });
      gurultu({ f: 2600, f2: 4200, sure: 0.3 * y, ses: 0.06 * y, q: 0.8,
                filtre: 'highpass', islak: 1 });
      var n = Math.round(4 + y * 5);
      for (var i = 0; i < n; i++) {
        gurultu({ f: 1800 + Math.random() * 3200, sure: 0.022, ses: 0.05 + Math.random() * 0.05,
                  q: 5, gecikme: Math.random() * 0.42 * y, islak: 0.7 });
      }
    },
    akkor: function (n) {
      var f = 380 + Math.min(9, n || 1) * 42;
      ton({ f: f, f2: f * 1.85, sure: 0.2, tip: 'sine', ses: 0.16 });
      ton({ f: f * 1.5, f2: f * 2.6, sure: 0.16, tip: 'sine', ses: 0.07, gecikme: 0.04 });
    },
    akkorPatla: function () {
      transient(1.4);
      ton({ f: 900, f2: 90, sure: 0.5, tip: 'sawtooth', ses: 0.22,
            filtre: 'lowpass', filtreF: 2400, islak: 0.9 });
      gurultu({ f: 2200, f2: 180, sure: 0.55, ses: 0.24, q: 0.4, islak: 1 });
      ton({ f: 70, f2: 30, sure: 0.6, tip: 'sine', ses: 0.26, islak: 0 });
      SES.alev(0.8);
    },
    iyilesme: function () {
      ton({ f: 520, sure: 0.24, tip: 'sine', ses: 0.13 });
      ton({ f: 780, sure: 0.26, tip: 'sine', ses: 0.1, gecikme: 0.07 });
      ton({ f: 1040, sure: 0.3, tip: 'sine', ses: 0.08, gecikme: 0.14 });
    },
    debuff: function () {
      ton({ f: 330, f2: 150, sure: 0.3, tip: 'sawtooth', ses: 0.12,
            filtre: 'lowpass', filtreF: 800 });
    },
    buff: function () {
      ton({ f: 300, f2: 620, sure: 0.26, tip: 'triangle', ses: 0.13 });
    },
    olum: function () {
      ton({ f: 260, f2: 44, sure: 0.65, tip: 'sawtooth', ses: 0.2,
            filtre: 'lowpass', filtreF: 1100 });
      gurultu({ f: 1200, f2: 90, sure: 0.7, ses: 0.16, q: 0.4 });
    },
    turBasi: function () {
      ton({ f: 180, f2: 300, sure: 0.3, tip: 'triangle', ses: 0.12 });
    },
    dusmanTuru: function () {
      ton({ f: 220, f2: 130, sure: 0.34, tip: 'sawtooth', ses: 0.11,
            filtre: 'lowpass', filtreF: 700 });
    },
    enerji: function () { ton({ f: 700, f2: 1200, sure: 0.16, tip: 'sine', ses: 0.14 }); },

    /* --- koşu --- */
    altin: function () {
      for (var i = 0; i < 4; i++) {
        ton({ f: 1400 + Math.random() * 900, sure: 0.09, tip: 'triangle',
              ses: 0.08, gecikme: i * 0.045 });
      }
    },
    yadigar: function () {
      ton({ f: 520, f2: 1050, sure: 0.4, tip: 'sine', ses: 0.16 });
      ton({ f: 780, f2: 1560, sure: 0.5, tip: 'sine', ses: 0.1, gecikme: 0.1 });
      gurultu({ f: 4200, f2: 2200, sure: 0.5, ses: 0.05, q: 3 });
    },
    yukselt: function () {
      ton({ f: 440, f2: 880, sure: 0.28, tip: 'triangle', ses: 0.15 });
      ton({ f: 660, f2: 1320, sure: 0.32, tip: 'sine', ses: 0.1, gecikme: 0.09 });
    },
    zafer: function () {
      var notalar = [392, 523, 659, 784];
      for (var i = 0; i < notalar.length; i++) {
        ton({ f: notalar[i], sure: 0.55, tip: 'triangle', ses: 0.15, gecikme: i * 0.13 });
      }
    },
    yenilgi: function () {
      var notalar = [392, 330, 262, 196];
      for (var i = 0; i < notalar.length; i++) {
        ton({ f: notalar[i], sure: 0.7, tip: 'sine', ses: 0.15, gecikme: i * 0.22,
              filtre: 'lowpass', filtreF: 900 });
      }
    },
    haritaGir: function () {
      ton({ f: 240, f2: 420, sure: 0.35, tip: 'sine', ses: 0.1 });
    },

    /** Ekran geçişi: küle dönüp yeniden toplanma hışırtısı */
    gecis: function () {
      gurultu({ f: 320, f2: 2400, sure: 0.30, ses: 0.10, q: 0.5,
                filtre: 'bandpass', islak: 1 });
      gurultu({ f: 2600, f2: 500, sure: 0.42, ses: 0.07, q: 0.6,
                filtre: 'bandpass', gecikme: 0.22, islak: 1 });
      ton({ f: 150, f2: 70, sure: 0.4, tip: 'sine', ses: 0.09, islak: .4 });
    }
  };

  global.SES = SES;
})(typeof window !== 'undefined' ? window : globalThis);
