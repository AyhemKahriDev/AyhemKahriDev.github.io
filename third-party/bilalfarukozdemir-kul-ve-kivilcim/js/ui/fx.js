/* =========================================================================
   GÖRSEL EFEKT KATMANI
   Parçacıklar canvas'ta, uçuşan sayılar DOM'da (yazı tipi kontrolü için).
   Ekran sarsıntısı #sahne üzerinde JS ile sürülüyor.
   ========================================================================= */
(function (global) {
  'use strict';

  var cv, cx, sahne;
  var parcaciklar = [];
  var W = 0, H = 0, dpr = 1;
  var sarsintiGuc = 0, sarsintiAyar = true;
  var zoom = 0, hedefZoom = 0;      // öldürücü vuruşta sahneye hafif yaklaşma
  var zoomSaat = null;
  var calisiyor = false;

  function kur() {
    cv = document.getElementById('fx');
    cx = cv.getContext('2d');
    sahne = document.getElementById('sahne');
    boyutla();
    global.addEventListener('resize', boyutla);
    if (!calisiyor) { calisiyor = true; requestAnimationFrame(dongu); }
  }

  function boyutla() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    W = global.innerWidth; H = global.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ------------------------------------------------------------------ */

  function ekle(p) {
    if (parcaciklar.length > 640) parcaciklar.shift();
    parcaciklar.push(p);
  }

  function rast(a, b) { return a + Math.random() * (b - a); }

  /** Kor/kıvılcım patlaması */
  function kivilcim(x, y, n, o) {
    o = o || {};
    var renkler = o.renkler || ['#fbbf24', '#f97316', '#fb923c', '#fff1dc'];
    for (var i = 0; i < n; i++) {
      var a = o.aci !== undefined ? o.aci + rast(-0.7, 0.7) : rast(0, Math.PI * 2);
      var h = rast(o.hizMin || 1.2, o.hizMax || 5.5);
      ekle({
        tip: 'kivilcim', x: x, y: y,
        vx: Math.cos(a) * h, vy: Math.sin(a) * h - (o.yukari || 0),
        r: rast(1.2, 3.2), renk: renkler[(Math.random() * renkler.length) | 0],
        omur: rast(0.45, 0.95), yas: 0, yercek: o.yercek === undefined ? 0.13 : o.yercek
      });
    }
  }

  /** Yükselen kor zerreleri (akkor kazanımı) */
  function kor(x, y, n) {
    for (var i = 0; i < n; i++) {
      ekle({
        tip: 'kor', x: x + rast(-16, 16), y: y + rast(-6, 6),
        vx: rast(-0.4, 0.4), vy: rast(-1.9, -0.7),
        r: rast(1.5, 3.4), renk: Math.random() < 0.5 ? '#f97316' : '#fbbf24',
        omur: rast(0.7, 1.4), yas: 0, yercek: -0.012
      });
    }
  }

  /** Genişleyen halka (vuruş / patlama vurgusu) */
  function halka(x, y, renk, buyukluk) {
    ekle({ tip: 'halka', x: x, y: y, r: 6, hedefR: buyukluk || 66,
           renk: renk || '#f97316', omur: 0.42, yas: 0 });
  }

  /** Blok parlaması */
  function kalkan(x, y) {
    halka(x, y, '#62a4f0', 54);
    kivilcim(x, y, 10, { renkler: ['#9ecdff', '#62a4f0', '#dbeeff'], hizMax: 3, yercek: 0.05 });
  }

  /** İyileşme */
  function iyilesme(x, y) {
    for (var i = 0; i < 14; i++) {
      ekle({
        tip: 'kor', x: x + rast(-24, 24), y: y + rast(0, 22),
        vx: rast(-0.25, 0.25), vy: rast(-2.2, -1.1),
        r: rast(1.6, 3), renk: Math.random() < 0.5 ? '#55d187' : '#bdf5d4',
        omur: rast(0.7, 1.3), yas: 0, yercek: -0.01
      });
    }
  }

  /** Ölüm dağılması */
  function olum(x, y) {
    kivilcim(x, y, 34, { hizMax: 6.5, renkler: ['#8a7a6c', '#5c4f45', '#f97316', '#2b2320'] });
    halka(x, y, '#7a6a5c', 92);
  }

  function patlama(x, y, buyuk) {
    kivilcim(x, y, buyuk ? 46 : 24, { hizMax: buyuk ? 9 : 6 });
    halka(x, y, '#fbbf24', buyuk ? 130 : 80);
    if (buyuk) halka(x, y, '#f97316', 190);
  }

  /* ------------------------------------------------------------------ */

  function dongu() {
    requestAnimationFrame(dongu);
    cx.clearRect(0, 0, W, H);

    var dt = 1 / 60;
    for (var i = parcaciklar.length - 1; i >= 0; i--) {
      var p = parcaciklar[i];
      p.yas += dt;
      var t = p.yas / p.omur;
      if (t >= 1) { parcaciklar.splice(i, 1); continue; }

      if (p.tip === 'halka') {
        var r = p.r + (p.hedefR - p.r) * ease(t);
        cx.globalAlpha = (1 - t) * 0.65;
        cx.strokeStyle = p.renk;
        cx.lineWidth = Math.max(1, 3.5 * (1 - t));
        cx.beginPath(); cx.arc(p.x, p.y, r, 0, Math.PI * 2); cx.stroke();
      } else {
        p.vy += p.yercek;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.985; p.vy *= 0.985;
        cx.globalAlpha = 1 - t * t;
        cx.fillStyle = p.renk;
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * (1 - t * 0.55), 0, Math.PI * 2);
        cx.fill();
      }
    }
    cx.globalAlpha = 1;

    // Sarsıntı + yakınlaşma tek bir dönüşümde birleşir; ayrı ayrı yazılsalardı
    // biri diğerini ezerdi.
    if (sarsintiGuc > 0.15) sarsintiGuc *= 0.86; else sarsintiGuc = 0;
    zoom += (hedefZoom - zoom) * 0.12;
    if (Math.abs(zoom - hedefZoom) < 0.0004) zoom = hedefZoom;

    if (sarsintiGuc > 0 || zoom > 0.0005) {
      var m = sarsintiGuc;
      var dx = m ? (Math.random() * 2 - 1) * m : 0;
      var dy = m ? (Math.random() * 2 - 1) * m : 0;
      sahne.style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)' +
                              ' scale(' + (1 + zoom).toFixed(4) + ')';
    } else if (sahne.style.transform) {
      sahne.style.transform = '';
    }
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /* ------------------------------------------------------------------ */

  function sarsinti(guc) {
    if (!sarsintiAyar) return;
    sarsintiGuc = Math.max(sarsintiGuc, Math.min(16, guc));
  }

  /** Sahneye kısa süreli yaklaş — öldürücü vuruş / patron evresi */
  function yakinlas(guc, sure) {
    if (!sarsintiAyar) return;              // hareket duyarlılığı ayarına saygı
    hedefZoom = Math.max(hedefZoom, guc || 0.022);
    if (zoomSaat) clearTimeout(zoomSaat);
    zoomSaat = setTimeout(function () { hedefZoom = 0; zoomSaat = null; }, sure || 420);
  }

  /** Uçuşan sayı / metin */
  function sayi(x, y, yazi, o) {
    o = o || {};
    var el = document.createElement('div');
    el.className = 'ucan';
    el.textContent = yazi;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = o.renk || '#fff';
    el.style.fontSize = (o.boy || 26) + 'px';
    if (o.gecikme) el.style.animationDelay = o.gecikme + 'ms';
    document.getElementById('ustKatman').appendChild(el);
    setTimeout(function () { el.remove(); }, 1100 + (o.gecikme || 0));
  }

  /** Bir DOM ögesinin ekran merkezini ver */
  function merkez(el) {
    if (!el) return { x: global.innerWidth / 2, y: global.innerHeight / 2 };
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  global.FX = {
    kur: kur,
    kivilcim: kivilcim, kor: kor, halka: halka, kalkan: kalkan,
    iyilesme: iyilesme, olum: olum, patlama: patlama,
    sarsinti: sarsinti, yakinlas: yakinlas, sayi: sayi, merkez: merkez,
    sarsintiAyar: function (v) { sarsintiAyar = !!v; if (!v) { hedefZoom = 0; } },
    temizle: function () { parcaciklar.length = 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
