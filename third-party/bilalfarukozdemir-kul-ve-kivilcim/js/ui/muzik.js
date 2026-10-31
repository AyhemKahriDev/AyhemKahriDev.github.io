/* =========================================================================
   JENERATİF ARKA PLAN MÜZİĞİ
   ---------------------------------------------------------------------
   Bestelenmiş bir parça değil; her seferinde yeniden kurulan bir doku.
   Dört katman: drone yatağı, akor pedi, seyrek melodi kırıntıları,
   nabız perküsyonu. Oyunun durumu (menü / harita / savaş / elit / patron)
   katmanların seviyesini ve temposunu belirler; geçişler yumuşaktır.

   Dizi: HİCAZ  (kök üzerinde 0 1 4 5 7 8 10)
   Küllü, loş ve doğuya bakan bir renk veriyor; oyunun kimliğiyle de örtüşüyor.
   ========================================================================= */
(function (global) {
  'use strict';

  var ctx = null, cikis = null;
  var kuruldu = false, acik = true;
  var katman = {};              // drone / ped / melodi / vurus kazançları
  var durumAdi = 'sessiz';
  var zamanlayici = null;
  var siradakiVurus = 0;        // planlanmış bir sonraki vuruşun zamanı
  var vurusNo = 0;
  var akorNo = 0;

  /* --- müzikal malzeme ---------------------------------------------- */

  var KOK = 36.71 * 2;                    // D2
  var HICAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];

  function perde(derece, oktav) {
    var n = HICAZ[((derece % HICAZ.length) + HICAZ.length) % HICAZ.length];
    return KOK * Math.pow(2, (n + 12 * (oktav || 0)) / 12);
  }

  // Akor dizisi: köke dönen, çözülmeyen bir döngü
  var AKORLAR = [[0, 2, 4], [0, 3, 5], [5, 0, 2], [3, 5, 0], [0, 2, 6], [1, 4, 0]];

  var DURUMLAR = {
    sessiz: { drone: 0,    ped: 0,    melodi: 0,   vurus: 0,   bpm: 60,  yogun: 0 },
    menu:   { drone: 0.30, ped: 0.20, melodi: 0.14, vurus: 0,   bpm: 56,  yogun: 0.15 },
    harita: { drone: 0.26, ped: 0.17, melodi: 0.11, vurus: 0.05, bpm: 60, yogun: 0.2 },
    savas:  { drone: 0.30, ped: 0.15, melodi: 0.05, vurus: 0.22, bpm: 82, yogun: 0.5 },
    elit:   { drone: 0.34, ped: 0.16, melodi: 0.04, vurus: 0.30, bpm: 92, yogun: 0.7 },
    patron: { drone: 0.40, ped: 0.18, melodi: 0.03, vurus: 0.36, bpm: 100, yogun: 1 }
  };

  function d() { return DURUMLAR[durumAdi] || DURUMLAR.sessiz; }

  /* ------------------------------------------------------------------ */
  /*  Kurulum                                                            */
  /* ------------------------------------------------------------------ */

  function kur() {
    if (kuruldu) return true;
    if (!global.SES) return false;
    ctx = global.SES.baglam();
    cikis = global.SES.muzikCikisi();
    if (!ctx || !cikis) return false;
    kuruldu = true;

    ['drone', 'ped', 'melodi', 'vurus'].forEach(function (ad) {
      var g = ctx.createGain();
      g.gain.value = 0;
      g.connect(cikis);
      katman[ad] = g;
    });

    droneKur();
    siradakiVurus = ctx.currentTime + 0.2;
    zamanlayici = setInterval(planla, 60);
    return true;
  }

  /* --- 1) drone: sürekli, hiç susmayan alt yatak --------------------- */

  function droneKur() {
    var tonlar = [
      { f: perde(0, -1), tip: 'sawtooth', ses: 0.16, detune: -6 },
      { f: perde(0, -1), tip: 'sawtooth', ses: 0.16, detune: 7 },
      { f: perde(4, -1), tip: 'triangle', ses: 0.10, detune: 0 },
      { f: perde(0, 0),  tip: 'sine',     ses: 0.12, detune: 3 }
    ];
    var filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 260;
    filtre.Q.value = 3.5;
    filtre.connect(katman.drone);

    // Filtreyi çok yavaş süpüren LFO — dokunun "nefes almasını" sağlar
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.035;
    var lfoKazanc = ctx.createGain();
    lfoKazanc.gain.value = 130;
    lfo.connect(lfoKazanc);
    lfoKazanc.connect(filtre.frequency);
    lfo.start();

    tonlar.forEach(function (t) {
      var o = ctx.createOscillator();
      o.type = t.tip;
      o.frequency.value = t.f;
      o.detune.value = t.detune;
      var g = ctx.createGain();
      g.gain.value = t.ses;
      o.connect(g); g.connect(filtre);
      o.start();
    });
  }

  /* --- 2) ped: akor, uzun zarf, yavaş değişir ------------------------ */

  function pedCal(t, sure) {
    var akor = AKORLAR[akorNo % AKORLAR.length];
    akorNo++;
    for (var i = 0; i < akor.length; i++) {
      var f = perde(akor[i], i === 0 ? 0 : 1);
      var o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() * 14 - 7);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), t + sure * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      var f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass'; f2.frequency.value = 900 + i * 400;
      o.connect(g); g.connect(f2); f2.connect(katman.ped);
      o.start(t); o.stop(t + sure + 0.1);
    }
  }

  /* --- 3) melodi: tek tek düşen, çekilmiş notalar -------------------- */

  function melodiCal(t) {
    var derece = [0, 1, 2, 4, 5, 2, 1, 0][Math.floor(Math.random() * 8)];
    var f = perde(derece, Math.random() < 0.35 ? 2 : 1);
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    var flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(3200, t);
    flt.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    o.connect(g); g.connect(flt); flt.connect(katman.melodi);
    o.start(t); o.stop(t + 1.7);
  }

  /* --- 4) vuruş: derin kasnak + kül hışırtısı ------------------------ */

  function davulCal(t, guclu) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(guclu ? 128 : 96, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(guclu ? 0.5 : 0.28, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (guclu ? 0.42 : 0.26));
    o.connect(g); g.connect(katman.vurus);
    o.start(t); o.stop(t + 0.5);

    // deri tokluğu
    var n = ctx.createBufferSource();
    n.buffer = kulTampon();
    var nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = guclu ? 320 : 480; nf.Q.value = 1.2;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(guclu ? 0.13 : 0.07, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    n.connect(nf); nf.connect(ng); ng.connect(katman.vurus);
    n.start(t); n.stop(t + 0.14);
  }

  function tokCal(t) {
    var n = ctx.createBufferSource();
    n.buffer = kulTampon();
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 5200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(f); f.connect(g); g.connect(katman.vurus);
    n.start(t); n.stop(t + 0.1);
  }

  var _tampon = null;
  function kulTampon() {
    if (_tampon) return _tampon;
    var n = Math.floor(ctx.sampleRate * 0.5);
    _tampon = ctx.createBuffer(1, n, ctx.sampleRate);
    var dd = _tampon.getChannelData(0);
    for (var i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / n);
    return _tampon;
  }

  /* ------------------------------------------------------------------ */
  /*  Zamanlayıcı — ileriye dönük planlama                               */
  /* ------------------------------------------------------------------ */

  function planla() {
    if (!kuruldu || !acik) return;
    var s = d();
    if (s.bpm <= 0) return;
    var ufuk = ctx.currentTime + 0.35;
    var vurusSuresi = 60 / s.bpm;
    var guard = 0;

    while (siradakiVurus < ufuk && guard++ < 24) {
      var t = siradakiVurus;
      var v = vurusNo % 16;

      // Ped her 8 vuruşta bir yenilenir
      if (v % 8 === 0 && s.ped > 0) pedCal(t, vurusSuresi * 9);

      // Perküsyon yalnızca savaş durumlarında
      if (s.vurus > 0.01) {
        if (v % 4 === 0) davulCal(t, v === 0);
        else if (s.yogun > 0.45 && v % 4 === 2) davulCal(t, false);
        if (s.yogun > 0.6 && v % 2 === 1) tokCal(t);
        if (s.yogun > 0.9 && v % 8 === 6) davulCal(t + vurusSuresi * 0.5, false);
      }

      // Melodi kırıntıları — seyrek ve rastgele
      if (s.melodi > 0.01 && Math.random() < 0.16) {
        melodiCal(t + Math.random() * vurusSuresi * 0.5);
      }

      siradakiVurus += vurusSuresi;
      vurusNo++;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Dış arayüz                                                         */
  /* ------------------------------------------------------------------ */

  function durum(ad) {
    if (!DURUMLAR[ad]) ad = 'sessiz';
    if (!kuruldu && !kur()) { durumAdi = ad; return; }
    durumAdi = ad;
    var s = DURUMLAR[ad];
    var t = ctx.currentTime;
    var gecis = 1.6;
    ['drone', 'ped', 'melodi', 'vurus'].forEach(function (k) {
      katman[k].gain.cancelScheduledValues(t);
      katman[k].gain.setTargetAtTime(acik ? s[k] : 0, t, gecis / 3);
    });
    // Tempo değişince nabzı yeniden hizala
    if (siradakiVurus < t) siradakiVurus = t + 0.1;
  }

  function ayar(v) {
    acik = !!v;
    if (!kuruldu) return;
    var s = d(), t = ctx.currentTime;
    ['drone', 'ped', 'melodi', 'vurus'].forEach(function (k) {
      katman[k].gain.setTargetAtTime(acik ? s[k] : 0, t, 0.3);
    });
  }

  /** Büyük anlarda kısa bir gerilim yükselişi */
  function vurgu() {
    if (!kuruldu || !acik) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(perde(0, 0), t);
    o.frequency.exponentialRampToValueAtTime(perde(0, 1), t + 1.1);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    o.connect(g); g.connect(f); f.connect(katman.drone);
    o.start(t); o.stop(t + 1.6);
  }

  global.Muzik = { kur: kur, durum: durum, ayar: ayar, vurgu: vurgu,
                   durumu: function () { return durumAdi; } };
})(typeof window !== 'undefined' ? window : globalThis);
