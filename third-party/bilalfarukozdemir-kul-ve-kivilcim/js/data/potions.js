/* =========================================================================
   İKSİRLER — savaş içinde bedelsiz kullanılır, tek seferliktir.
   `guclu` = Kadim Şişe yadigârı varsa true (etki belirgin biçimde artar).
   ========================================================================= */
(function (global) {
  'use strict';

  var I = {};
  var LISTE = [];
  function P(id, o) { o.id = id; I[id] = o; LISTE.push(o); return o; }
  function g(guclu, a, b) { return guclu ? b : a; }
  function tumu(C) { return C.canliDusmanlar(); }

  P('can_iksiri', {
    ad: 'Can İksiri', ikon: '❤️', nadirlik: 'siradan', hedef: 'yok',
    metin: '20 can iyileş.',
    et: function (C, h, gu) { C.iyilestir(C.p, g(gu, 20, 34)); }
  });

  P('kuvvet_iksiri', {
    ad: 'Kuvvet İksiri', ikon: '💪', nadirlik: 'siradan', hedef: 'yok',
    metin: '2 Güç kazan.',
    et: function (C, h, gu) { C.durumVer(C.p, 'guc', g(gu, 2, 4)); }
  });

  P('ceviklik_iksiri', {
    ad: 'Çeviklik İksiri', ikon: '🪶', nadirlik: 'siradan', hedef: 'yok',
    metin: '2 Çeviklik kazan.',
    et: function (C, h, gu) { C.durumVer(C.p, 'ceviklik', g(gu, 2, 4)); }
  });

  P('ates_bombasi', {
    ad: 'Ateş Bombası', ikon: '💣', nadirlik: 'siradan', hedef: 'dusman',
    metin: 'Bir düşmana 22 hasar ver.',
    et: function (C, h, gu) { if (h) C.vur(C.p, h, g(gu, 22, 38), { gucsuz: true }); }
  });

  P('kor_iksiri', {
    ad: 'Kor İksiri', ikon: '🔥', nadirlik: 'siradan', hedef: 'yok',
    metin: '8 Akkor kazan.',
    et: function (C, h, gu) { C.akkorEkle(g(gu, 8, 15)); }
  });

  P('demir_iksiri', {
    ad: 'Demir İksiri', ikon: '🛡️', nadirlik: 'siradan', hedef: 'yok',
    metin: '20 blok kazan.',
    et: function (C, h, gu) { C.blokVer(C.p, g(gu, 20, 34), { ham: true }); }
  });

  P('duman_bombasi', {
    ad: 'Duman Bombası', ikon: '💨', nadirlik: 'siradan', hedef: 'yok',
    metin: 'TÜM düşmanlara 3 Zayıflık ver.',
    et: function (C, h, gu) {
      var d = tumu(C);
      for (var i = 0; i < d.length; i++) C.durumVer(d[i], 'zayiflik', g(gu, 3, 5));
    }
  });

  P('kirilma_iksiri', {
    ad: 'Kırılma İksiri', ikon: '💔', nadirlik: 'siradan', hedef: 'yok',
    metin: 'TÜM düşmanlara 3 Kırılganlık ver.',
    et: function (C, h, gu) {
      var d = tumu(C);
      for (var i = 0; i < d.length; i++) C.durumVer(d[i], 'kirilganlik', g(gu, 3, 5));
    }
  });

  P('bilgi_iksiri', {
    ad: 'Bilgi İksiri', ikon: '📜', nadirlik: 'siradan', hedef: 'yok',
    metin: '3 kart çek.',
    et: function (C, h, gu) { C.cek(g(gu, 3, 5)); }
  });

  /* ---------------- NADİR --------------------------------------------- */

  P('enerji_iksiri', {
    ad: 'Enerji İksiri', ikon: '⚡', nadirlik: 'nadir', hedef: 'yok',
    metin: '2 enerji kazan.',
    et: function (C, h, gu) {
      var n = g(gu, 2, 4); C.enerji += n; C.olay({ t: 'enerji', miktar: n });
    }
  });

  P('alev_iksiri', {
    ad: 'Alev İksiri', ikon: '🌋', nadirlik: 'nadir', hedef: 'yok',
    metin: 'TÜM düşmanlara 6 Yanık ver.',
    et: function (C, h, gu) {
      var d = tumu(C);
      for (var i = 0; i < d.length; i++) C.durumVer(d[i], 'yanik', g(gu, 6, 11));
    }
  });

  P('diken_iksiri', {
    ad: 'Diken İksiri', ikon: '🌵', nadirlik: 'nadir', hedef: 'yok',
    metin: 'Diken 5 kazan.',
    et: function (C, h, gu) { C.durumVer(C.p, 'diken', g(gu, 5, 9)); }
  });

  P('tilsim_iksiri', {
    ad: 'Tılsım İksiri', ikon: '🔮', nadirlik: 'nadir', hedef: 'yok',
    metin: 'Tılsım 2 kazan.',
    et: function (C, h, gu) { C.durumVer(C.p, 'tilsim', g(gu, 2, 4)); }
  });

  P('ofke_iksiri', {
    ad: 'Öfke İksiri', ikon: '😤', nadirlik: 'nadir', hedef: 'yok',
    metin: 'Öfke 5 kazan.',
    et: function (C, h, gu) { C.durumVer(C.p, 'ofke', g(gu, 5, 9)); }
  });

  P('berraklik_iksiri', {
    ad: 'Berraklık İksiri', ikon: '💧', nadirlik: 'nadir', hedef: 'yok',
    metin: 'Elindeki Durum ve Lanet kartlarını tüket. 2 kart çek.',
    et: function (C, h, gu) {
      var kal = C.el.slice();
      for (var i = 0; i < kal.length; i++) {
        var d = global.KARTLAR[kal[i].id];
        if (d.tur === 'durum' || d.tur === 'lanet') C.tuket(kal[i]);
      }
      C.cek(g(gu, 2, 4));
    }
  });

  /* ---------------- EFSANEVİ ------------------------------------------ */

  P('yanki_iksiri', {
    ad: 'Yankı İksiri', ikon: '🔁', nadirlik: 'efsanevi', hedef: 'yok',
    metin: 'Yankı 1 kazan. (Turun ilk saldırısı bir kez daha tetiklenir)',
    et: function (C, h, gu) { C.durumVer(C.p, 'yanki', g(gu, 1, 2)); }
  });

  P('kiyamet_iksiri', {
    ad: 'Kıyamet İksiri', ikon: '☄️', nadirlik: 'efsanevi', hedef: 'yok',
    metin: 'TÜM düşmanlara 30 hasar ver.',
    et: function (C, h, gu) {
      var d = tumu(C);
      for (var i = 0; i < d.length; i++) C.vur(C.p, d[i], g(gu, 30, 50), { gucsuz: true });
    }
  });

  P('anka_iksiri', {
    ad: 'Anka İksiri', ikon: '🕊️', nadirlik: 'efsanevi', hedef: 'yok',
    metin: 'Tüm olumsuz etkilerini temizle ve 15 can iyileş.',
    et: function (C, h, gu) {
      for (var k in C.p.st) {
        var meta = global.STATUS[k];
        if (meta && meta.kotu) delete C.p.st[k];
      }
      C.olay({ t: 'durum', hedef: 'p', anahtar: 'temizle', miktar: 0, toplam: 0 });
      C.iyilestir(C.p, g(gu, 15, 26));
    }
  });

  /* -------------------------------------------------------------------- */

  global.IKSIRLER = I;
  global.IKSIR_LISTESI = LISTE;

  global.rastgeleIksir = function (rng) {
    var t = rng.next() * 100;
    var nad = t < 62 ? 'siradan' : (t < 90 ? 'nadir' : 'efsanevi');
    var havuz = [];
    for (var i = 0; i < LISTE.length; i++) if (LISTE[i].nadirlik === nad) havuz.push(LISTE[i].id);
    return rng.pick(havuz);
  };
})(typeof window !== 'undefined' ? window : globalThis);
