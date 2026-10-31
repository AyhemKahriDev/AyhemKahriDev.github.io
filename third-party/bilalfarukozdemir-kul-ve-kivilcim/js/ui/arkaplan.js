/* =========================================================================
   ARKA PLAN — derinlik katmanı
   ---------------------------------------------------------------------
   Sahnenin ARKASINA çizilen kendi canvas'ı (FX katmanı önde kalır).
   Üç paralaks katman: uzakta ağır kül, ortada süzülen zerreler, önde
   hızlı korlar. Altta nefes alan bir kor ışığı; Akkor biriktikçe ısınır.
   ========================================================================= */
(function (global) {
  'use strict';

  var cv, cx, W = 0, H = 0, dpr = 1;
  var kul = [], korlar = [];
  var isi = 0, hedefIsi = 0;      // 0..1 — Akkor'a göre sahnenin sıcaklığı
  var faz = 0;
  var calisiyor = false;
  var acik = true;
  var perde = 1;

  // Perde başına renk kimliği
  var PERDE_RENK = [
    null,
    { dip: [249, 115, 22], kul: [140, 126, 112] },   // Kül Ovaları — turuncu
    { dip: [168, 120, 240], kul: [122, 116, 132] },  // Sönmüş Şehir — morumsu
    { dip: [255, 90, 40],   kul: [168, 118, 96] }    // Ateşin Kalbi — kızıl
  ];

  function kur() {
    cv = document.createElement('canvas');
    cv.id = 'arkaplan';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;' +
                       'pointer-events:none;z-index:0';
    document.body.insertBefore(cv, document.body.firstChild);
    cx = cv.getContext('2d');
    boyutla();
    global.addEventListener('resize', boyutla);
    doldur();
    if (!calisiyor) { calisiyor = true; requestAnimationFrame(dongu); }
  }

  function boyutla() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    W = global.innerWidth; H = global.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rast(a, b) { return a + Math.random() * (b - a); }

  function doldur() {
    kul.length = 0; korlar.length = 0;
    // Kül zerreleri — üç derinlik katmanı
    var toplam = Math.round(Math.min(150, W * H / 9000));
    for (var i = 0; i < toplam; i++) {
      var katman = i % 3;                       // 0 uzak … 2 yakın
      kul.push({
        x: Math.random() * W, y: Math.random() * H,
        r: [0.7, 1.2, 1.9][katman] * rast(0.7, 1.4),
        hiz: [0.055, 0.13, 0.26][katman] * rast(0.7, 1.35),
        salinim: rast(0.3, 1.1), fazi: Math.random() * 6.28,
        alfa: [0.10, 0.17, 0.26][katman] * rast(0.6, 1.3),
        katman: katman
      });
    }
    // Dipten yükselen korlar
    for (var j = 0; j < 26; j++) korlar.push(yeniKor(true));
  }

  function yeniKor(ilk) {
    return {
      x: rast(-20, W + 20),
      y: ilk ? rast(H * 0.35, H + 30) : H + rast(4, 60),
      r: rast(0.9, 2.4),
      hiz: rast(0.16, 0.62),
      salinim: rast(0.2, 0.9), fazi: Math.random() * 6.28,
      omur: rast(0.55, 1)
    };
  }

  /* ------------------------------------------------------------------ */

  function dongu() {
    requestAnimationFrame(dongu);
    if (!acik) { cx.clearRect(0, 0, W, H); return; }

    faz += 0.006;
    isi += (hedefIsi - isi) * 0.035;

    var R = PERDE_RENK[perde] || PERDE_RENK[1];
    cx.clearRect(0, 0, W, H);

    /* --- dipteki kor ışığı (nefes alır, Akkor ile ısınır) --- */
    var nefes = 0.5 + Math.sin(faz * 1.6) * 0.5;
    var guc = 0.16 + nefes * 0.05 + isi * 0.30;
    var yukseklik = H * (0.34 + isi * 0.16);
    var g = cx.createLinearGradient(0, H, 0, H - yukseklik);
    g.addColorStop(0, 'rgba(' + R.dip[0] + ',' + R.dip[1] + ',' + R.dip[2] + ',' + guc.toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(' + R.dip[0] + ',' + R.dip[1] + ',' + R.dip[2] + ',' + (guc * 0.28).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.fillRect(0, H - yukseklik, W, yukseklik);

    // yanlardan gelen sıcak yansıma
    var yan = cx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, W * 0.72);
    yan.addColorStop(0, 'rgba(' + R.dip[0] + ',' + R.dip[1] + ',' + R.dip[2] + ',' + (0.10 + isi * 0.14).toFixed(3) + ')');
    yan.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = yan;
    cx.fillRect(0, 0, W, H);

    /* --- kül zerreleri --- */
    var i, p;
    for (i = 0; i < kul.length; i++) {
      p = kul[i];
      p.y += p.hiz;
      p.fazi += 0.01;
      p.x += Math.sin(p.fazi) * p.salinim * 0.28;
      if (p.y > H + 6) { p.y = -6; p.x = Math.random() * W; }
      if (p.x < -12) p.x = W + 10; else if (p.x > W + 12) p.x = -10;
      cx.globalAlpha = p.alfa;
      cx.fillStyle = 'rgb(' + R.kul[0] + ',' + R.kul[1] + ',' + R.kul[2] + ')';
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.2832); cx.fill();
    }

    /* --- yükselen korlar --- */
    for (i = 0; i < korlar.length; i++) {
      p = korlar[i];
      p.y -= p.hiz * (1 + isi * 0.6);
      p.fazi += 0.024;
      p.x += Math.sin(p.fazi) * p.salinim * 0.5;
      var oran = 1 - (p.y / H);
      if (p.y < H * 0.18 || p.x < -30 || p.x > W + 30) { korlar[i] = yeniKor(false); continue; }
      var a = Math.max(0, (1 - oran * 0.9)) * 0.55 * p.omur * (0.6 + isi * 0.7);
      cx.globalAlpha = Math.min(0.75, a);
      cx.fillStyle = Math.random() < 0.35 ? '#fbbf24' : 'rgb(' + R.dip[0] + ',' + R.dip[1] + ',' + R.dip[2] + ')';
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.2832); cx.fill();
    }
    cx.globalAlpha = 1;

    /* --- vinyet: kenarları karart, ortayı öne çıkar --- */
    var v = cx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.28,
                                    W / 2, H * 0.46, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.62)');
    cx.fillStyle = v;
    cx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ */

  /** Akkor miktarına göre sahneyi ısıt (0 = soğuk, 12+ = kor gibi) */
  function akkorIsisi(n) { hedefIsi = Math.max(0, Math.min(1, (n || 0) / 12)); }

  function perdeAyarla(n) { perde = Math.max(1, Math.min(3, n || 1)); }

  /** Büyük bir olayda dipteki ışığı bir anlığına parlat */
  function parla(guc) { isi = Math.min(1.6, isi + (guc || 0.5)); }

  global.Arkaplan = {
    kur: kur, akkorIsisi: akkorIsisi, perdeAyarla: perdeAyarla, parla: parla,
    ayar: function (v) { acik = !!v; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
