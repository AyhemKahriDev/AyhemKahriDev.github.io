/* =========================================================================
   KART HAVUZU
   ---------------------------------------------------------------------
   Yollar:  yangin (Akkor biriktir/patlat) · kul (Yanık & çoklu vuruş)
            demir (blok, diken, karşı saldırı) · genel (tempo, çekiş)
   Değerler: v = temel, vu = yükseltilmiş (v'nin üzerine yazılır)
   Metindeki {anahtar} değerleri v'den doldurulur; değişenler vurgulanır.
   ========================================================================= */
(function (global) {
  'use strict';

  var KARTLAR = {};
  var LISTE = [];

  function K(id, o) {
    o.id = id;
    if (!o.yol) o.yol = 'genel';
    if (!o.hedef) o.hedef = 'yok';
    if (o.ustBedel === undefined) o.ustBedel = o.bedel;
    KARTLAR[id] = o;
    LISTE.push(o);
    return o;
  }

  /* --- kısa yollar ---------------------------------------------------- */
  function hepsi(C) { return C.canliDusmanlar(); }
  function tumunuVur(C, ham, opt) {
    var d = hepsi(C);
    for (var i = 0; i < d.length; i++) C.vur(C.p, d[i], ham, opt);
  }
  function tumuneDurum(C, k, n) {
    var d = hepsi(C);
    for (var i = 0; i < d.length; i++) C.durumVer(d[i], k, n);
  }
  function S(e, k) { return e.st[k] || 0; }

  /* ==================================================================== */
  /*  BAŞLANGIÇ DESTESİ                                                   */
  /* ==================================================================== */

  K('vurus', {
    ad: 'Vuruş', tur: 'saldiri', nadirlik: 'baslangic', bedel: 1, hedef: 'dusman',
    v: { d: 7 }, vu: { d: 11 },
    metin: '{d} hasar ver.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); }
  });

  K('savun', {
    ad: 'Savun', tur: 'beceri', nadirlik: 'baslangic', bedel: 1,
    v: { b: 6 }, vu: { b: 9 },
    metin: '{b} blok kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); }
  });

  K('kivilcim', {
    ad: 'Kıvılcım', tur: 'saldiri', nadirlik: 'baslangic', bedel: 1, yol: 'yangin',
    hedef: 'dusman', v: { d: 8, a: 3 }, vu: { d: 11, a: 4 },
    metin: '{d} hasar ver. {a} Akkor kazan.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.akkorEkle(o.v.a); }
  });

  /* ==================================================================== */
  /*  YANGIN — Akkor biriktir, sonra patlat                               */
  /* ==================================================================== */

  K('ufleme', {
    ad: 'Üfleme', tur: 'beceri', nadirlik: 'siradan', bedel: 0, yol: 'yangin',
    v: { a: 3, c: 0 }, vu: { a: 4, c: 1 },
    metin: '{a} Akkor kazan.|{a} Akkor kazan. {c} kart çek.',
    et: function (C, k, h, o) { C.akkorEkle(o.v.a); if (o.v.c) C.cek(o.v.c); }
  });

  K('koz_sacmak', {
    ad: 'Köz Saçmak', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    v: { d: 5, a: 3 }, vu: { d: 7, a: 4 },
    metin: 'TÜM düşmanlara {d} hasar ver. {a} Akkor kazan.',
    et: function (C, k, h, o) { tumunuVur(C, o.v.d); C.akkorEkle(o.v.a); }
  });

  K('kor_zirhi', {
    ad: 'Kor Zırhı', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    v: { b: 7, a: 3 }, vu: { b: 10, a: 4 },
    metin: '{b} blok kazan. {a} Akkor kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); C.akkorEkle(o.v.a); }
  });

  K('korla_vurus', {
    ad: 'Korla Vuruş', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    hedef: 'dusman', v: { d: 8, d2: 15, e: 6 }, vu: { d: 11, d2: 21 },
    metin: '{d} hasar ver. Akkorun {e} veya fazlaysa bunun yerine {d2} hasar ver.',
    et: function (C, k, h, o) { C.vur(C.p, h, C.akkor >= o.v.e ? o.v.d2 : o.v.d); }
  });

  K('atesle', {
    ad: 'Ateşle', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, yol: 'yangin',
    hedef: 'dusman', v: { d: 13, k: 2 }, vu: { d: 17, k: 2 },
    metin: '{d} hasar ver. Akkorun her 3 biriminde {k} fazla hasar (harcamaz).',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d + Math.floor(C.akkor / 3) * o.v.k); }
  });

  K('patlama', {
    ad: 'Patlama', tur: 'saldiri', nadirlik: 'nadir', bedel: 1, yol: 'yangin',
    hedef: 'dusman', v: { k: 4 }, vu: { k: 5 },
    metin: 'Tüm Akkorunu harca. Harcanan her Akkor için {k} hasar ver.',
    et: function (C, k, h, o) { var a = C.akkorHarca(); if (a > 0) C.vur(C.p, h, a * o.v.k); }
  });

  K('korun_nefesi', {
    ad: 'Korun Nefesi', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    v: { k: 3 }, vu: { k: 4 },
    metin: 'Tüm Akkorunu harca. Harcanan her Akkor için {k} blok kazan.',
    et: function (C, k, h, o) { var a = C.akkorHarca(); if (a > 0) C.blokVer(C.p, a * o.v.k); }
  });

  K('firin', {
    ad: 'Fırın', tur: 'guc', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    v: { n: 3 }, vu: { n: 4 },
    metin: 'Köz {n} kazan. (Tur başında {n} Akkor)',
    et: function (C, k, h, o) { C.durumVer(C.p, 'korakor', o.v.n); }
  });

  K('kivilcim_yagmuru', {
    ad: 'Kıvılcım Yağmuru', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, yol: 'yangin',
    v: { d: 6, n: 3, a: 4 }, vu: { d: 7, n: 4, a: 5 },
    metin: 'Rastgele düşmanlara {n} kez {d} hasar ver. {a} Akkor kazan.',
    et: function (C, k, h, o) {
      for (var i = 0; i < o.v.n; i++) {
        var t = C.rastgeleDusman(); if (!t) break;
        C.vur(C.p, t, o.v.d); if (i < o.v.n - 1) C.bekle(100);
      }
      C.akkorEkle(o.v.a);
    }
  });

  K('alev_almak', {
    ad: 'Alev Almak', tur: 'beceri', nadirlik: 'siradan', bedel: 0, yol: 'yangin',
    v: { c: 4, a: 6 }, vu: { c: 3, a: 8 },
    metin: '{c} can kaybet. {a} Akkor kazan.',
    et: function (C, k, h, o) { C.hasarUygula(C.p, o.v.c, { bloksuz: true }); C.akkorEkle(o.v.a); }
  });

  K('ocak_ustasi', {
    ad: 'Ocak Ustası', tur: 'guc', nadirlik: 'nadir', bedel: 2, yol: 'yangin',
    v: { n: 1 }, vu: { n: 2 },
    metin: 'Bundan sonra Akkor kazandığında {n} fazla kazanırsın.',
    et: function (C, k, h, o) { C.run.gecici.akkorBonus = (C.run.gecici.akkorBonus || 0) + o.v.n; }
  });

  K('kozleme', {
    ad: 'Közleme', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'yangin',
    hedef: 'dusman', v: { b: 1 }, vu: { b: 1, ek: 2 },
    metin: 'Hedefe Akkorun kadar Yanık ver.|Hedefe Akkorun +2 kadar Yanık ver.',
    et: function (C, k, h, o) { C.durumVer(h, 'yanik', C.akkor + (o.v.ek || 0)); }
  });

  K('volkan', {
    ad: 'Volkan', tur: 'saldiri', nadirlik: 'nadir', bedel: 3, yol: 'yangin',
    v: { k: 3 }, vu: { k: 4 },
    metin: 'Tüm Akkorunu harca. TÜM düşmanlara harcanan her Akkor için {k} hasar ver.',
    et: function (C, k, h, o) { var a = C.akkorHarca(); if (a > 0) tumunuVur(C, a * o.v.k); }
  });

  K('ebedi_ates', {
    ad: 'Ebedi Ateş', tur: 'guc', nadirlik: 'efsanevi', bedel: 3, yol: 'yangin',
    ustBedel: 2, v: {}, vu: {},
    metin: 'Akkor harcayan kartlar artık Akkorunu tüketmez.',
    et: function (C) { C.run.gecici.akkorKalici = true; }
  });

  K('supernova', {
    ad: 'Süpernova', tur: 'saldiri', nadirlik: 'efsanevi', bedel: 3, yol: 'yangin',
    tuket: true, v: { k: 4, b: 3 }, vu: { k: 5, b: 4 },
    metin: 'Tüket. Tüm Akkorunu harca. TÜM düşmanlara her Akkor için {k} hasar, sen her Akkor için {b} blok kazan.',
    et: function (C, k, h, o) {
      var a = C.akkorHarca();
      if (a > 0) { tumunuVur(C, a * o.v.k); C.blokVer(C.p, a * o.v.b); }
    }
  });

  K('korlesme', {
    ad: 'Körlenme', tur: 'beceri', nadirlik: 'nadir', bedel: 0, yol: 'yangin',
    v: { a: 5 }, vu: { a: 7 },
    metin: 'Bir kart at. {a} Akkor kazan.',
    kosul: function (C) { return C.el.length > 0; },
    et: function (C, k, h, o) { C.rastgeleAt(1, k); C.akkorEkle(o.v.a); }
  });

  K('kor_kalkani', {
    ad: 'Kor Kalkanı', tur: 'beceri', nadirlik: 'nadir', bedel: 2, yol: 'yangin',
    v: { b: 7 }, vu: { b: 9 },
    metin: 'Akkorun kadar blok kazan, sonra {b} blok daha kazan. (Akkor harcanmaz)',
    et: function (C, k, h, o) { C.blokVer(C.p, C.akkor + o.v.b); }
  });

  /* ==================================================================== */
  /*  KÜL — Yanık, çoklu vuruş, yıpratma                                  */
  /* ==================================================================== */

  K('kavurma', {
    ad: 'Kavurma', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    hedef: 'dusman', v: { n: 5 }, vu: { n: 8 },
    metin: 'Hedefe {n} Yanık ver.',
    et: function (C, k, h, o) { C.durumVer(h, 'yanik', o.v.n); }
  });

  K('kor_serpme', {
    ad: 'Kor Serpme', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    v: { n: 3 }, vu: { n: 4 },
    metin: 'TÜM düşmanlara {n} Yanık ver.',
    et: function (C, k, h, o) { tumuneDurum(C, 'yanik', o.v.n); }
  });

  K('alevli_pence', {
    ad: 'Alevli Pençe', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    hedef: 'dusman', v: { d: 5, n: 2, ek: 3 }, vu: { d: 6, n: 2, ek: 4 },
    metin: '{n} kez {d} hasar ver. Hedef yanıyorsa vuruş başına {ek} fazla.',
    et: function (C, k, h, o) {
      var d = o.v.d + (S(h, 'yanik') > 0 ? o.v.ek : 0);
      C.vur(C.p, h, d, { kez: o.v.n });
    }
  });

  K('yayilma', {
    ad: 'Yayılma', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    hedef: 'dusman', ustBedel: 0, v: {}, vu: {},
    metin: 'Hedefteki Yanığı TÜM düşmanlara kopyala.',
    et: function (C, k, h) {
      var n = S(h, 'yanik'); if (!n) return;
      var d = hepsi(C);
      for (var i = 0; i < d.length; i++) {
        if (d[i] === h) continue;
        var fark = n - S(d[i], 'yanik');
        if (fark > 0) C.durumVer(d[i], 'yanik', fark);
      }
    }
  });

  K('korukleme', {
    ad: 'Körükleme', tur: 'saldiri', nadirlik: 'siradan', bedel: 0, yol: 'kul',
    hedef: 'dusman', v: { k: 1 }, vu: { k: 2 },
    metin: 'Hedefin Yanığının {k} katı kadar hasar ver.',
    et: function (C, k, h, o) { var n = S(h, 'yanik'); if (n > 0) C.vur(C.p, h, n * o.v.k); }
  });

  K('kavrulma', {
    ad: 'Kavrulma', tur: 'beceri', nadirlik: 'nadir', bedel: 2, yol: 'kul',
    hedef: 'dusman', v: { n: 5 }, vu: { n: 8 },
    metin: 'Hedefe {n} Kavrulma ver. (Azalmayan yanık)',
    et: function (C, k, h, o) { C.durumVer(h, 'zehirlenme', o.v.n); }
  });

  K('duman', {
    ad: 'Duman', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    v: { b: 8, n: 2 }, vu: { b: 11, n: 2 },
    metin: '{b} blok kazan. TÜM düşmanlara {n} Zayıflık ver.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); tumuneDurum(C, 'zayiflik', o.v.n); }
  });

  K('kul_firtinasi', {
    ad: 'Kül Fırtınası', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, yol: 'kul',
    v: { d: 5, n: 2 }, vu: { d: 7, n: 2 },
    metin: 'TÜM düşmanlara {n} kez {d} hasar ver.',
    et: function (C, k, h, o) {
      for (var i = 0; i < o.v.n; i++) { tumunuVur(C, o.v.d); if (i < o.v.n - 1) C.bekle(140); }
    }
  });

  K('yanik_izi', {
    ad: 'Yanık İzi', tur: 'guc', nadirlik: 'nadir', bedel: 2, yol: 'kul',
    v: { n: 1 }, vu: { n: 2 },
    metin: 'Bir düşmanı hedef alan saldırı oynadığında ona {n} Yanık ver.',
    et: function (C, k, h, o) { C.run.gecici.yanikIzi = (C.run.gecici.yanikIzi || 0) + o.v.n; }
  });

  K('sonmeyen_kor', {
    ad: 'Sönmeyen Kor', tur: 'guc', nadirlik: 'efsanevi', bedel: 2, yol: 'kul',
    ustBedel: 1, v: {}, vu: {},
    metin: 'Düşmanlardaki Yanık artık tur sonunda azalmaz.',
    et: function (C) { C.run.gecici.yanikAzalmaz = true; }
  });

  K('yakip_yikma', {
    ad: 'Yakıp Yıkma', tur: 'saldiri', nadirlik: 'nadir', bedel: 2, yol: 'kul',
    hedef: 'dusman', v: { k: 3 }, vu: { k: 4 },
    metin: 'Hedefin Yanığının {k} katı hasar ver, sonra Yanığını sıfırla.',
    et: function (C, k, h, o) {
      var n = S(h, 'yanik'); if (!n) return;
      C.vur(C.p, h, n * o.v.k);
      if (!h.olu) C.durumVer(h, 'yanik', -n, { tilsimsiz: true });
    }
  });

  K('zehirli_duman', {
    ad: 'Zehirli Duman', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'kul',
    v: { n: 2 }, vu: { n: 3 },
    metin: 'TÜM düşmanlara {n} Kırılganlık ver.',
    et: function (C, k, h, o) { tumuneDurum(C, 'kirilganlik', o.v.n); }
  });

  K('cakmak', {
    ad: 'Çakmak', tur: 'saldiri', nadirlik: 'siradan', bedel: 0, yol: 'kul',
    hedef: 'dusman', v: { d: 7, n: 3 }, vu: { d: 9, n: 4 },
    metin: '{d} hasar ver. Hedefe {n} Yanık ver. Tüketilir.',
    tuket: true,
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.durumVer(h, 'yanik', o.v.n); }
  });

  K('kavurucu_ruzgar', {
    ad: 'Kavurucu Rüzgâr', tur: 'saldiri', nadirlik: 'nadir', bedel: 1, yol: 'kul',
    v: { k: 2 }, vu: { k: 3 },
    metin: 'TÜM düşmanlara Yanıklarının {k} katı hasar ver.',
    et: function (C, k, h, o) {
      var d = hepsi(C);
      for (var i = 0; i < d.length; i++) {
        var n = S(d[i], 'yanik'); if (n > 0) C.vur(C.p, d[i], n * o.v.k);
      }
    }
  });

  K('kul_bulutu', {
    ad: 'Kül Bulutu', tur: 'beceri', nadirlik: 'nadir', bedel: 1, yol: 'kul',
    v: { b: 7, n: 1 }, vu: { b: 10, n: 1 },
    metin: '{b} blok kazan. TÜM düşmanlara {n} Zayıflık ve {n} Kırılganlık ver.',
    et: function (C, k, h, o) {
      C.blokVer(C.p, o.v.b);
      tumuneDurum(C, 'zayiflik', o.v.n); tumuneDurum(C, 'kirilganlik', o.v.n);
    }
  });

  /* ==================================================================== */
  /*  DEMİR — blok, diken, karşı saldırı                                  */
  /* ==================================================================== */

  K('siper', {
    ad: 'Siper', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    v: { b: 9 }, vu: { b: 12 },
    metin: '{b} blok kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); }
  });

  K('demir_deri', {
    ad: 'Demir Deri', tur: 'guc', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    v: { n: 4 }, vu: { n: 5 },
    metin: 'Zırh {n} kazan. (Tur başında {n} blok)',
    et: function (C, k, h, o) { C.durumVer(C.p, 'zirh', o.v.n); }
  });

  K('dikenli_kalkan', {
    ad: 'Dikenli Kalkan', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    v: { b: 6, n: 4 }, vu: { b: 8, n: 6 },
    metin: '{b} blok kazan. Diken {n} kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); C.durumVer(C.p, 'diken', o.v.n); }
  });

  K('kalkan_vurusu', {
    ad: 'Kalkan Vuruşu', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    hedef: 'dusman', v: { k: 110 }, vu: { k: 160 },
    metin: 'Blokunun %{k} kadar hasar ver.',
    et: function (C, k, h, o) {
      var d = Math.floor(C.p.block * o.v.k / 100);
      if (d > 0) C.vur(C.p, h, d);
    }
  });

  K('duvar', {
    ad: 'Duvar', tur: 'beceri', nadirlik: 'siradan', bedel: 2, yol: 'demir',
    v: { b: 19 }, vu: { b: 25 },
    metin: '{b} blok kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); }
  });

  K('sabir', {
    ad: 'Sabır', tur: 'beceri', nadirlik: 'siradan', bedel: 0, yol: 'demir',
    eldeKalir: true, v: { b: 5 }, vu: { b: 7 },
    metin: '{b} blok kazan. Elde kalır.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); }
  });

  K('metanet_k', {
    ad: 'Metanet', tur: 'guc', nadirlik: 'efsanevi', bedel: 3, yol: 'demir',
    ustBedel: 2, v: {}, vu: {},
    metin: 'Blokun artık tur başında sıfırlanmaz.',
    et: function (C) { C.durumVer(C.p, 'metanet', 1); }
  });

  K('ofke_nobeti', {
    ad: 'Öfke Nöbeti', tur: 'guc', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    v: { n: 4 }, vu: { n: 5 },
    metin: 'Öfke {n} kazan. (Saldırı oynadığında {n} blok)',
    et: function (C, k, h, o) { C.durumVer(C.p, 'ofke', o.v.n); }
  });

  K('zirh_kirici', {
    ad: 'Zırh Kırıcı', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    hedef: 'dusman', v: { d: 11 }, vu: { d: 15 },
    metin: 'Hedefin blokunu yok sayarak {d} hasar ver.',
    et: function (C, k, h, o) {
      var d = C.hasarHesap(C.p, h, o.v.d, {});
      C.hasarUygula(h, d, { saldiri: true, kaynak: C.p, bloksuz: true });
    }
  });

  K('agirlik', {
    ad: 'Ağırlık', tur: 'beceri', nadirlik: 'siradan', bedel: 1, yol: 'demir',
    v: { b: 7, g: 1 }, vu: { b: 10, g: 2 },
    metin: '{b} blok kazan. {g} Güç kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); C.durumVer(C.p, 'guc', o.v.g); }
  });

  K('kaya_gibi', {
    ad: 'Kaya Gibi', tur: 'beceri', nadirlik: 'nadir', bedel: 2, yol: 'demir',
    v: { b: 12, n: 2 }, vu: { b: 15, n: 3 },
    metin: '{b} blok kazan. Çeviklik {n} kazan.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); C.durumVer(C.p, 'ceviklik', o.v.n); }
  });

  K('karsi_darbe', {
    ad: 'Karşı Darbe', tur: 'saldiri', nadirlik: 'nadir', bedel: 2, yol: 'demir',
    hedef: 'dusman', v: { d: 10, k: 4 }, vu: { d: 14, k: 5 },
    metin: '{d} hasar ver. Dikenin başına {k} fazla hasar.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d + S(C.p, 'diken') * o.v.k); }
  });

  K('diken_tarlasi', {
    ad: 'Diken Tarlası', tur: 'guc', nadirlik: 'nadir', bedel: 1, yol: 'demir',
    v: { n: 4 }, vu: { n: 6 },
    metin: 'Diken {n} kazan.',
    et: function (C, k, h, o) { C.durumVer(C.p, 'diken', o.v.n); }
  });

  K('siperden_saldiri', {
    ad: 'Siperden Saldırı', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, yol: 'demir',
    hedef: 'dusman', v: { d: 12, b: 12 }, vu: { d: 16, b: 16 },
    metin: '{d} hasar ver. {b} blok kazan.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.blokVer(C.p, o.v.b); }
  });

  K('kirilmaz', {
    ad: 'Kırılmaz', tur: 'beceri', nadirlik: 'nadir', bedel: 1, yol: 'demir',
    tuket: true, v: { b: 22 }, vu: { b: 30 },
    metin: '{b} blok kazan. Tüketilir.',
    et: function (C, k, h, o) { C.blokVer(C.p, o.v.b); }
  });

  K('yankili_kalkan', {
    ad: 'Yankılı Kalkan', tur: 'beceri', nadirlik: 'nadir', bedel: 1, yol: 'demir',
    v: { k: 1 }, vu: { k: 2 },
    metin: 'Geçen turdan kalan blokun kadar blok kazan, en az {k}0 blok.',
    et: function (C, k, h, o) { C.blokVer(C.p, Math.max(o.v.k * 10, C.p.block)); }
  });

  K('savunma_duruusu', {
    ad: 'Savunma Duruşu', tur: 'guc', nadirlik: 'nadir', bedel: 2, yol: 'demir',
    v: { n: 50 }, vu: { n: 75 },
    metin: 'Tur başında blokunun %{n} kadarı korunur.',
    et: function (C, k, h, o) {
      var g = C.run.gecici;
      g.blokKoruYuzde = Math.max(g.blokKoruYuzde || 0, o.v.n);
    }
  });

  /* ==================================================================== */
  /*  GENEL — tempo, çekiş, enerji                                        */
  /* ==================================================================== */

  K('hazirlik', {
    ad: 'Hazırlık', tur: 'beceri', nadirlik: 'siradan', bedel: 0,
    v: { c: 2, a: 1 }, vu: { c: 3, a: 1 },
    metin: '{c} kart çek. {a} kart at.',
    et: function (C, k, h, o) { C.cek(o.v.c); C.rastgeleAt(o.v.a, k); }
  });

  K('ivme', {
    ad: 'İvme', tur: 'beceri', nadirlik: 'siradan', bedel: 1, ustBedel: 0,
    v: { c: 3 }, vu: { c: 3 },
    metin: '{c} kart çek.',
    et: function (C, k, h, o) { C.cek(o.v.c); }
  });

  K('adrenalin', {
    ad: 'Adrenalin', tur: 'beceri', nadirlik: 'nadir', bedel: 0, tuket: true,
    v: { e: 1, c: 2 }, vu: { e: 2, c: 2 },
    metin: '{e} enerji kazan. {c} kart çek. Tüketilir.',
    et: function (C, k, h, o) { C.enerji += o.v.e; C.olay({ t: 'enerji', miktar: o.v.e }); C.cek(o.v.c); }
  });

  K('ustalik', {
    ad: 'Ustalık', tur: 'guc', nadirlik: 'efsanevi', bedel: 3, ustBedel: 2,
    v: {}, vu: {},
    metin: 'Her tur 1 fazla enerji kazan.',
    et: function (C) { C.maxEnerji += 1; C.enerji += 1; C.olay({ t: 'enerji', miktar: 1 }); }
  });

  K('odaklan', {
    ad: 'Odaklan', tur: 'beceri', nadirlik: 'siradan', bedel: 1,
    v: { g: 2 }, vu: { g: 4 },
    metin: '{g} Güç kazan.',
    et: function (C, k, h, o) { C.durumVer(C.p, 'guc', o.v.g); }
  });

  K('ani_hamle', {
    ad: 'Ani Hamle', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, hedef: 'dusman',
    v: { d: 16, n: 2 }, vu: { d: 21, n: 2 },
    metin: '{d} hasar ver. {n} Kırılganlık ver.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.durumVer(h, 'kirilganlik', o.v.n); }
  });

  K('serseri_vurus', {
    ad: 'Serseri Vuruş', tur: 'saldiri', nadirlik: 'siradan', bedel: 0, hedef: 'dusman',
    v: { d: 5 }, vu: { d: 8 },
    metin: '{d} hasar ver.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); }
  });

  K('agir_darbe', {
    ad: 'Ağır Darbe', tur: 'saldiri', nadirlik: 'siradan', bedel: 2, hedef: 'dusman',
    v: { d: 21, a: 1 }, vu: { d: 27, a: 1 },
    metin: '{d} hasar ver. {a} kart at.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.rastgeleAt(o.v.a, k); }
  });

  K('son_nefes', {
    ad: 'Son Nefes', tur: 'beceri', nadirlik: 'nadir', bedel: 1, tuket: true,
    v: { c: 12 }, vu: { c: 18 },
    metin: '{c} can iyileş. Tüketilir.',
    et: function (C, k, h, o) { C.iyilestir(C.p, o.v.c); }
  });

  K('arinma', {
    ad: 'Arınma', tur: 'beceri', nadirlik: 'siradan', bedel: 0, tuket: true,
    v: {}, vu: {},
    ustBedel: 0,
    metin: 'Elindeki tüm Durum ve Lanet kartlarını tüket. 1 kart çek.',
    et: function (C, k) {
      var kal = C.el.slice(), n = 0;
      for (var i = 0; i < kal.length; i++) {
        var d = KARTLAR[kal[i].id];
        if (d.tur === 'durum' || d.tur === 'lanet') { C.tuket(kal[i]); n++; }
      }
      C.cek(1);
    }
  });

  K('cifte_vurus', {
    ad: 'Çifte Vuruş', tur: 'guc', nadirlik: 'efsanevi', bedel: 2,
    v: { n: 1 }, vu: { n: 2 },
    metin: 'Yankı {n} kazan. (Turun ilk saldırısı {n} kez daha tetiklenir)',
    et: function (C, k, h, o) { C.durumVer(C.p, 'yanki', o.v.n); }
  });

  K('bileme', {
    ad: 'Bileme', tur: 'beceri', nadirlik: 'nadir', bedel: 0,
    v: { g: 2 }, vu: { g: 3 },
    metin: '{g} Güç kazan. Tur sonunda bu Gücü kaybedersin.',
    et: function (C, k, h, o) {
      C.durumVer(C.p, 'guc', o.v.g);
      var n = o.v.g;
      C.gecikmeliIsler.push(function (CC) { CC.durumVer(CC.p, 'guc', -n, { tilsimsiz: true }); });
    }
  });

  K('secim', {
    ad: 'Kader Taşı', tur: 'beceri', nadirlik: 'nadir', bedel: 1, tuket: true,
    v: { n: 3 }, vu: { n: 4 },
    metin: 'Çekme destenden {n} kart göster, birini eline al. Tüketilir.',
    et: function (C, k, h, o) {
      var adaylar = C.rng.sample(C.cekme, o.v.n);
      if (!adaylar.length) return;
      C.secimIste({
        baslik: 'Destenden bir kart al',
        kartlar: adaylar.map(function (x) { return { uid: x.uid, id: x.id, up: x.up }; }),
        coz: function (CC, secilen) {
          if (!secilen) return;
          for (var i = 0; i < CC.cekme.length; i++) {
            if (CC.cekme[i].uid !== secilen.uid) continue;
            var kart = CC.cekme.splice(i, 1)[0];
            if (CC.el.length < 10) {
              CC.el.push(kart);
              CC.olay({ t: 'eklendi', uid: kart.uid, id: kart.id, up: kart.up });
            } else CC.atik.push(kart);
            break;
          }
        }
      });
    }
  });

  K('yagma', {
    ad: 'Yağma', tur: 'saldiri', nadirlik: 'nadir', bedel: 1, hedef: 'dusman',
    v: { d: 9, c: 1 }, vu: { d: 12, c: 1 },
    metin: '{d} hasar ver. Bu vuruş düşmanı öldürürse {c} kart çek ve 1 enerji kazan.',
    et: function (C, k, h, o) {
      C.vur(C.p, h, o.v.d);
      if (h.olu) { C.cek(o.v.c); C.enerji += 1; C.olay({ t: 'enerji', miktar: 1 }); }
    }
  });

  K('ikiz_alev', {
    ad: 'İkiz Alev', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, hedef: 'dusman',
    v: { d: 6, n: 2 }, vu: { d: 8, n: 2 },
    metin: '{n} kez {d} hasar ver.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d, { kez: o.v.n }); }
  });

  K('feda', {
    ad: 'Feda', tur: 'beceri', nadirlik: 'nadir', bedel: 0,
    v: { c: 3, e: 2 }, vu: { c: 2, e: 2 },
    metin: '{c} can kaybet. {e} enerji kazan.',
    et: function (C, k, h, o) {
      C.hasarUygula(C.p, o.v.c, { bloksuz: true });
      C.enerji += o.v.e; C.olay({ t: 'enerji', miktar: o.v.e });
    }
  });

  K('son_direnis', {
    ad: 'Son Direniş', tur: 'saldiri', nadirlik: 'efsanevi', bedel: -1, hedef: 'dusman',
    v: { k: 6 }, vu: { k: 8 },
    metin: 'X enerji harca. X × {k} hasar ver.',
    et: function (C, k, h, o) { if (o.x > 0) C.vur(C.p, h, o.x * o.v.k); }
  });

  K('koruma_cemberi', {
    ad: 'Koruma Çemberi', tur: 'beceri', nadirlik: 'efsanevi', bedel: -1,
    v: { k: 8 }, vu: { k: 10 },
    metin: 'X enerji harca. X × {k} blok kazan ve X kart çek.',
    et: function (C, k, h, o) { if (o.x > 0) { C.blokVer(C.p, o.x * o.v.k); C.cek(o.x); } }
  });

  K('tilsim_k', {
    ad: 'Tılsım', tur: 'beceri', nadirlik: 'nadir', bedel: 1, tuket: true,
    v: { n: 2 }, vu: { n: 3 },
    metin: 'Tılsım {n} kazan. Tüketilir.',
    et: function (C, k, h, o) { C.durumVer(C.p, 'tilsim', o.v.n); }
  });

  K('kalpten_vurus', {
    ad: 'Kalpten Vuruş', tur: 'saldiri', nadirlik: 'nadir', bedel: 2, hedef: 'dusman',
    v: { d: 11, k: 4 }, vu: { d: 14, k: 5 },
    metin: '{d} hasar ver. Bu savaşta oynadığın her Güç kartı için {k} fazla hasar.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d + C.gucler.length * o.v.k); }
  });

  K('yorulmak_bilmez', {
    ad: 'Yorulmak Bilmez', tur: 'guc', nadirlik: 'nadir', bedel: 1,
    v: { n: 1 }, vu: { n: 2 },
    metin: 'Her tur {n} fazla kart çek.',
    et: function (C, k, h, o) { C.run.gecici.ekCekis = (C.run.gecici.ekCekis || 0) + o.v.n; C.cek(o.v.n); }
  });

  K('kucultme', {
    ad: 'Küçültme', tur: 'beceri', nadirlik: 'siradan', bedel: 1,
    hedef: 'dusman', v: { n: 2 }, vu: { n: 3 },
    metin: 'Hedefe {n} Zayıflık ve {n} Kırılganlık ver.',
    et: function (C, k, h, o) {
      C.durumVer(h, 'zayiflik', o.v.n); C.durumVer(h, 'kirilganlik', o.v.n);
    }
  });

  K('kesif', {
    ad: 'Keşif', tur: 'beceri', nadirlik: 'siradan', bedel: 1,
    v: { c: 2, b: 6 }, vu: { c: 2, b: 9 },
    metin: '{c} kart çek. {b} blok kazan.',
    et: function (C, k, h, o) { C.cek(o.v.c); C.blokVer(C.p, o.v.b); }
  });

  K('acimasizlik', {
    ad: 'Acımasızlık', tur: 'saldiri', nadirlik: 'nadir', bedel: 1, hedef: 'dusman',
    v: { d: 8, k: 6 }, vu: { d: 10, k: 7 },
    metin: '{d} hasar ver. Hedefin canı yarıdan azsa {k} fazla hasar.',
    et: function (C, k, h, o) {
      C.vur(C.p, h, o.v.d + (h.hp * 2 <= h.maxHp ? o.v.k : 0));
    }
  });

  K('kan_bagi', {
    ad: 'Kan Bağı', tur: 'guc', nadirlik: 'nadir', bedel: 1,
    v: { n: 3 }, vu: { n: 5 },
    metin: 'Bir düşman öldüğünde {n} can iyileş ve 1 Akkor kazan.',
    et: function (C, k, h, o) { C.run.gecici.kanBagi = (C.run.gecici.kanBagi || 0) + o.v.n; }
  });

  K('gozdagi', {
    ad: 'Gözdağı', tur: 'beceri', nadirlik: 'siradan', bedel: 0,
    v: { n: 1 }, vu: { n: 2 },
    metin: 'TÜM düşmanlara {n} Zayıflık ver.',
    et: function (C, k, h, o) { tumuneDurum(C, 'zayiflik', o.v.n); }
  });

  K('hisim', {
    ad: 'Hışım', tur: 'saldiri', nadirlik: 'siradan', bedel: 1, hedef: 'dusman',
    v: { d: 10, c: 3 }, vu: { d: 13, c: 3 },
    metin: '{d} hasar ver. {c} can kaybet.',
    et: function (C, k, h, o) { C.vur(C.p, h, o.v.d); C.hasarUygula(C.p, o.v.c, { bloksuz: true }); }
  });

  K('tekrar', {
    ad: 'Tekrar', tur: 'beceri', nadirlik: 'efsanevi', bedel: 1,
    v: {}, vu: {}, ustBedel: 0,
    metin: 'Bu tur oynadığın son kartı tekrar oyna.',
    kosul: function (C) { return !!C.sonOynananDef; },
    et: function (C, k, h, o) {
      var son = C.sonOynananDef;
      if (!son) return;
      var sahte = { uid: 'tekrar', id: son.id, up: son.up };
      var def = KARTLAR[son.id];
      var hed = def.hedef === 'dusman' ? C.rastgeleDusman() : null;
      if (def.hedef === 'dusman' && !hed) return;
      def.et(C, sahte, hed, { x: 0, tekrar: 0, v: global.kartDegerleri(sahte) });
    }
  });

  /* ==================================================================== */
  /*  DURUM ve LANET KARTLARI                                             */
  /* ==================================================================== */

  K('yara', {
    ad: 'Yara', tur: 'durum', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz.', et: function () {}
  });

  K('kulce', {
    ad: 'Külçe', tur: 'durum', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz. Tüketilemez.', et: function () {}
  });

  K('is', {
    ad: 'İs', tur: 'durum', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    eldeYanar: true, v: {}, vu: {},
    metin: 'Oynanamaz. Tur sonunda tüketilir.', et: function () {}
  });

  K('lanet_supheli', {
    ad: 'Şüphe', tur: 'lanet', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz. Turu elinde bitirirsen 1 Zayıflık alırsın.',
    turSonuElde: function (C, k) { C.durumVer(C.p, 'zayiflik', 1); },
    et: function () {}
  });

  K('lanet_kor_yuku', {
    ad: 'Kor Yükü', tur: 'lanet', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz. Turu elinde bitirirsen 2 hasar alırsın.',
    turSonuElde: function (C, k) { C.hasarUygula(C.p, 2, { bloksuz: true }); },
    et: function () {}
  });

  K('lanet_zincir', {
    ad: 'Zincir', tur: 'lanet', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz. Savaşa 1 az enerjiyle başlarsın.',
    et: function () {}
  });

  K('lanet_pismanlik', {
    ad: 'Pişmanlık', tur: 'lanet', nadirlik: 'ozel', bedel: 1, oynanmaz: true,
    v: {}, vu: {}, metin: 'Oynanamaz. Turu elinde bitirirsen elindeki kart sayısı kadar hasar alırsın.',
    turSonuElde: function (C, k) { C.hasarUygula(C.p, C.el.length, { bloksuz: true }); },
    et: function () {}
  });

  /* ==================================================================== */

  /** Kart örneği yarat */
  global.yeniKart = function (id, up) {
    return { uid: global.U.uid(), id: id, up: !!up };
  };

  /** Kartın etkin değerleri (yükseltme uygulanmış) */
  global.kartDegerleri = function (kart) {
    var def = KARTLAR[kart.id];
    var v = {}, key;
    for (key in def.v) v[key] = def.v[key];
    if (kart.up && def.vu) for (key in def.vu) v[key] = def.vu[key];
    return v;
  };

  /** Hangi değerler yükseltmeyle değişti? (arayüz vurgusu için) */
  global.kartDegisenler = function (kart) {
    var def = KARTLAR[kart.id];
    var out = {};
    if (!kart.up || !def.vu) return out;
    for (var key in def.vu) if (def.vu[key] !== def.v[key]) out[key] = true;
    return out;
  };

  /** Yükseltilebilir mi? */
  global.yukseltilebilir = function (kart) {
    var def = KARTLAR[kart.id];
    if (!def) return false;
    if (def.tur === 'durum' || def.tur === 'lanet') return false;
    return !kart.up;
  };

  /** Ödül havuzu: belirli nadirlikteki normal kartlar */
  global.kartHavuzu = function (nadirlik) {
    var o = [];
    for (var i = 0; i < LISTE.length; i++) {
      var d = LISTE[i];
      if (d.nadirlik === nadirlik) o.push(d.id);
    }
    return o;
  };

  global.KARTLAR = KARTLAR;
  global.KART_LISTESI = LISTE;
})(typeof window !== 'undefined' ? window : globalThis);
