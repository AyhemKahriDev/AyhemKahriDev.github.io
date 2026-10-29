/* =========================================================================
   DÜŞMANLAR
   ---------------------------------------------------------------------
   Her düşmanın `hamleSec(C, e)` fonksiyonu bir sonraki hamlesini seçer.
   Hamle: { id, niyet, et }
     niyet.tip: saldiri | saldiri_savunma | saldiri_debuff | savunma
                | buff | debuff | bilinmez | uyku | olumcul
   Niyette yazan hasar, oyuncuya gösterilirken Güç/Zayıflık/Kırılganlık
   hesaba katılarak yeniden hesaplanır (Combat.niyetGoster).
   ========================================================================= */
(function (global) {
  'use strict';

  var D = {};
  function E(id, o) { o.id = id; D[id] = o; return o; }
  function M(id, niyet, et) { return { id: id, niyet: niyet, et: et }; }

  /** Son n hamlenin tamamı `id` mi? (tekrar sınırlaması için) */
  function sonHepsi(e, id, n) {
    if (e.gecmis.length < n) return false;
    for (var i = e.gecmis.length - n; i < e.gecmis.length; i++)
      if (e.gecmis[i] !== id) return false;
    return true;
  }
  function sonHamle(e) { return e.gecmis.length ? e.gecmis[e.gecmis.length - 1] : null; }

  /** Sabit desen: her turda sıradaki hamle */
  function desen(liste) {
    return function (C, e) { return liste[e.sira % liste.length](C, e); };
  }

  /* ==================================================================== */
  /*  PERDE 1 — KÜL OVALARI                                               */
  /* ==================================================================== */

  E('kor_sicani', {
    ad: 'Kor Sıçanı', art: '🐀', hp: [13, 17], perde: 1,
    hamleSec: function (C, e) {
      if (sonHepsi(e, 'isir', 2)) return M('sivris', { tip: 'saldiri_savunma', hasar: 4 },
        function (C, e) { C.vur(e, C.p, 4); C.blokVer(e, 5, { ham: true }); });
      return C.rng.chance(65)
        ? M('isir', { tip: 'saldiri', hasar: 7 }, function (C, e) { C.vur(e, C.p, 7); })
        : M('sivris', { tip: 'saldiri_savunma', hasar: 4 },
            function (C, e) { C.vur(e, C.p, 4); C.blokVer(e, 5, { ham: true }); });
    }
  });

  E('kulluk_bocegi', {
    ad: 'Küllük Böceği', art: '🪲', hp: [15, 19], perde: 1,
    hamleSec: function (C, e) {
      if (sonHamle(e) === 'kabuk') return M('tos', { tip: 'saldiri', hasar: 9 },
        function (C, e) { C.vur(e, C.p, 9); });
      return C.rng.chance(60)
        ? M('tos', { tip: 'saldiri', hasar: 9 }, function (C, e) { C.vur(e, C.p, 9); })
        : M('kabuk', { tip: 'savunma', ipucu: '8 blok' },
            function (C, e) { C.blokVer(e, 8, { ham: true }); });
    }
  });

  E('yanik_ceset', {
    ad: 'Yanık Ceset', art: '🧟', hp: [19, 24], perde: 1,
    hamleSec: desen([
      function () { return M('savur', { tip: 'saldiri', hasar: 8 },
        function (C, e) { C.vur(e, C.p, 8); }); },
      function () { return M('savur', { tip: 'saldiri', hasar: 8 },
        function (C, e) { C.vur(e, C.p, 8); }); },
      function () { return M('kul_savur', { tip: 'saldiri_debuff', hasar: 5, ipucu: '2 Yanık' },
        function (C, e) { C.vur(e, C.p, 5); C.durumVer(C.p, 'yanik', 2); }); }
    ])
  });

  E('duman_ruhu', {
    ad: 'Duman Ruhu', art: '👻', hp: [11, 15], perde: 1,
    hamleSec: function (C, e) {
      if (e.sira === 0) return M('sis', { tip: 'debuff', ipucu: '2 Zayıflık' },
        function (C, e) { C.durumVer(C.p, 'zayiflik', 2); });
      return C.rng.chance(70)
        ? M('dokun', { tip: 'saldiri', hasar: 6 }, function (C, e) { C.vur(e, C.p, 6); })
        : M('sis', { tip: 'debuff', ipucu: '2 Zayıflık' },
            function (C, e) { C.durumVer(C.p, 'zayiflik', 2); });
    }
  });

  E('kavruk_nobetci', {
    ad: 'Kavruk Nöbetçi', art: '🗿', hp: [22, 27], perde: 1,
    savasBasi: function (C, e) { C.durumVer(e, 'zirh', 3); },
    hamleSec: function (C, e) {
      return C.rng.chance(55)
        ? M('mizrak', { tip: 'saldiri', hasar: 10 }, function (C, e) { C.vur(e, C.p, 10); })
        : M('siper', { tip: 'saldiri_savunma', hasar: 5 },
            function (C, e) { C.vur(e, C.p, 5); C.blokVer(e, 8, { ham: true }); });
    }
  });

  E('ates_bocegi', {
    ad: 'Ateş Böceği', art: '🐝', hp: [9, 12], perde: 1,
    hamleSec: function (C, e) {
      return C.rng.chance(75)
        ? M('kanat', { tip: 'saldiri', hasar: 3, kez: 3 },
            function (C, e) { C.vur(e, C.p, 3, { kez: 3 }); })
        : M('kivilcim', { tip: 'saldiri_debuff', hasar: 4, ipucu: '1 Yanık' },
            function (C, e) { C.vur(e, C.p, 4); C.durumVer(C.p, 'yanik', 1); });
    }
  });

  E('sonuk_fener', {
    ad: 'Sönük Fener', art: '🏮', hp: [17, 21], perde: 1,
    hamleSec: function (C, e) {
      if (e.sira === 0) return M('parla', { tip: 'buff', ipucu: '2 Güç' },
        function (C, e) { C.durumVer(e, 'guc', 2); });
      if (sonHepsi(e, 'yak', 2)) return M('parla', { tip: 'buff', ipucu: '2 Güç' },
        function (C, e) { C.durumVer(e, 'guc', 2); });
      return M('yak', { tip: 'saldiri', hasar: 7 }, function (C, e) { C.vur(e, C.p, 7); });
    }
  });

  E('kul_yigini', {
    ad: 'Kül Yığını', art: '🏔️', hp: [26, 32], perde: 1,
    hamleSec: desen([
      function () { return M('coz', { tip: 'savunma', ipucu: '10 blok' },
        function (C, e) { C.blokVer(e, 10, { ham: true }); }); },
      function () { return M('ez', { tip: 'saldiri', hasar: 12 },
        function (C, e) { C.vur(e, C.p, 12); }); }
    ])
  });

  /* --- Perde 1 elitleri ---------------------------------------------- */

  E('kul_muhafizi', {
    ad: 'Kül Muhafızı', art: '🛡️', hp: [52, 58], perde: 1, boy: 1.25, elit: true,
    savasBasi: function (C, e) { C.durumVer(e, 'zirh', 4); },
    hamleSec: function (C, e) {
      if (e.sira % 3 === 2) return M('carp', { tip: 'saldiri', hasar: 9, kez: 2 },
        function (C, e) { C.vur(e, C.p, 9, { kez: 2 }); });
      if (sonHamle(e) === 'kalkan') return M('balta', { tip: 'saldiri', hasar: 12 },
        function (C, e) { C.vur(e, C.p, 12); });
      return C.rng.chance(55)
        ? M('balta', { tip: 'saldiri', hasar: 12 }, function (C, e) { C.vur(e, C.p, 12); })
        : M('kalkan', { tip: 'savunma', ipucu: '10 blok, 2 Güç' },
            function (C, e) { C.blokVer(e, 10, { ham: true }); C.durumVer(e, 'guc', 2); });
    }
  });

  E('obur_kor', {
    ad: 'Obur Kor', art: '🔥', hp: [46, 52], perde: 1, boy: 1.2, elit: true,
    savasBasi: function (C, e) { C.durumVer(e, 'diken', 3); },
    hamleSec: function (C, e) {
      if (e.sira % 4 === 3) return M('yut', { tip: 'olumcul', hasar: 18 },
        function (C, e) { C.vur(e, C.p, 18); C.iyilestir(e, 8); });
      return C.rng.chance(50)
        ? M('koz', { tip: 'saldiri_debuff', hasar: 7, ipucu: '3 Yanık' },
            function (C, e) { C.vur(e, C.p, 7); C.durumVer(C.p, 'yanik', 3); })
        : M('buyu', { tip: 'buff', ipucu: '3 Güç' },
            function (C, e) { C.durumVer(e, 'guc', 3); });
    }
  });

  E('alev_ikizi', {
    ad: 'Alev İkizi', art: '🔥', hp: [27, 31], perde: 1, elit: true,
    // Kardeşi ölünce güçlenir
    olurken: function (C, e) {
      var d = C.canliDusmanlar();
      for (var i = 0; i < d.length; i++) {
        if (d[i] !== e && d[i].id === 'alev_ikizi') {
          C.durumVer(d[i], 'guc', 3);
          C.iyilestir(d[i], 6);
          C.yaziGoster(d[i], 'ÖFKE!', '#f97316');
        }
      }
    },
    hamleSec: function (C, e) {
      return C.rng.chance(60)
        ? M('cift', { tip: 'saldiri', hasar: 5, kez: 2 },
            function (C, e) { C.vur(e, C.p, 5, { kez: 2 }); })
        : M('koru', { tip: 'saldiri_savunma', hasar: 7 },
            function (C, e) { C.vur(e, C.p, 7); C.blokVer(e, 7, { ham: true }); });
    }
  });

  /* --- Perde 1 patronu ------------------------------------------------ */

  E('kul_devi', {
    ad: 'KÜL DEVİ', art: '🗿', hp: [150, 150], perde: 1, boy: 1.9, patron: true,
    // Güç yalnızca ilk iki döngüde birikir — uzayan savaş katlanarak
    // ölümcülleşmesin, ama baskı hep hissedilsin.
    hamleSec: function (C, e) {
      var d = e.sira % 5;
      if (d === 0) return M('toplan', { tip: 'buff', ipucu: '2 Güç, 12 blok' },
        function (C, e) {
          e.sayac.gucSayisi = (e.sayac.gucSayisi || 0);
          if (e.sayac.gucSayisi < 2) { C.durumVer(e, 'guc', 2); e.sayac.gucSayisi++; }
          C.blokVer(e, 7, { ham: true });
        });
      if (d === 1) return M('yumruk', { tip: 'saldiri', hasar: 8, kez: 2 },
        function (C, e) { C.vur(e, C.p, 8, { kez: 2 }); });
      if (d === 2) return M('molozlar', { tip: 'saldiri_debuff', hasar: 8, ipucu: 'Desteye 1 Yara' },
        function (C, e) { C.vur(e, C.p, 8); C.atigaEkle('yara');
                          C.yaziGoster(C.p, 'YARA', '#94a3b8'); });
      if (d === 3) return M('sarj', { tip: 'bilinmez', ipucu: 'Bir şeye hazırlanıyor…' },
        function (C, e) { C.blokVer(e, 9, { ham: true });
                          C.yaziGoster(e, 'ŞARJ', '#fbbf24'); });
      return M('carpma', { tip: 'olumcul', hasar: 20 },
        function (C, e) { C.vur(e, C.p, 20); });
    }
  });

  /* ==================================================================== */
  /*  PERDE 2 — SÖNMÜŞ ŞEHİR                                              */
  /* ==================================================================== */

  E('curuf_yaratigi', {
    ad: 'Cüruf Yaratığı', art: '🫠', hp: [30, 36], perde: 2,
    hamleSec: function (C, e) {
      if (sonHepsi(e, 'sicra', 2)) return M('erit', { tip: 'saldiri_debuff', hasar: 8, ipucu: '2 Kırık' },
        function (C, e) { C.vur(e, C.p, 8); C.durumVer(C.p, 'kirik', 2); });
      return C.rng.chance(65)
        ? M('sicra', { tip: 'saldiri', hasar: 13 }, function (C, e) { C.vur(e, C.p, 13); })
        : M('erit', { tip: 'saldiri_debuff', hasar: 8, ipucu: '2 Kırık' },
            function (C, e) { C.vur(e, C.p, 8); C.durumVer(C.p, 'kirik', 2); });
    }
  });

  E('koz_avcisi', {
    ad: 'Köz Avcısı', art: '🏹', hp: [26, 32], perde: 2,
    hamleSec: function (C, e) {
      if (e.sira === 0) return M('nisan', { tip: 'debuff', ipucu: '2 Kırılganlık' },
        function (C, e) { C.durumVer(C.p, 'kirilganlik', 2); });
      return C.rng.chance(60)
        ? M('ok_yagmuru', { tip: 'saldiri', hasar: 5, kez: 3 },
            function (C, e) { C.vur(e, C.p, 5, { kez: 3 }); })
        : M('delici', { tip: 'saldiri', hasar: 14 }, function (C, e) { C.vur(e, C.p, 14); });
    }
  });

  E('kullu_rahip', {
    ad: 'Küllü Rahip', art: '🧙', hp: [28, 34], perde: 2,
    hamleSec: function (C, e) {
      var yarali = null, d = C.canliDusmanlar();
      for (var i = 0; i < d.length; i++)
        if (d[i] !== e && d[i].hp < d[i].maxHp * 0.7) yarali = d[i];
      if (yarali && C.rng.chance(70)) return M('kutsa',
        { tip: 'buff', ipucu: 'Müttefiki iyileştirir' },
        function (C, e) { C.iyilestir(yarali, 9); C.durumVer(yarali, 'guc', 1); });
      if (e.sira % 3 === 2) return M('lanet', { tip: 'debuff', ipucu: 'Desteye 1 Yara, 1 Zayıflık' },
        function (C, e) { C.atigaEkle('yara'); C.durumVer(C.p, 'zayiflik', 1); });
      return M('asa', { tip: 'saldiri', hasar: 11 }, function (C, e) { C.vur(e, C.p, 11); });
    }
  });

  E('demir_otomat', {
    ad: 'Demir Otomat', art: '🤖', hp: [34, 42], perde: 2,
    savasBasi: function (C, e) { C.durumVer(e, 'zirh', 6); C.durumVer(e, 'diken', 4); },
    hamleSec: desen([
      function () { return M('presle', { tip: 'saldiri', hasar: 15 },
        function (C, e) { C.vur(e, C.p, 15); }); },
      function () { return M('kalibre', { tip: 'buff', ipucu: '3 Diken, 10 blok' },
        function (C, e) { C.durumVer(e, 'diken', 3); C.blokVer(e, 10, { ham: true }); }); }
    ])
  });

  E('ciglik', {
    ad: 'Çığlık', art: '😱', hp: [24, 29], perde: 2,
    hamleSec: function (C, e) {
      if (e.sira % 4 === 1) return M('feryat', { tip: 'debuff', ipucu: '1 Korku (1 az enerji)' },
        function (C, e) { C.durumVer(C.p, 'korku', 2); });
      if (e.sira % 4 === 3) return M('sagirlat', { tip: 'saldiri_debuff', hasar: 6, ipucu: '2 Sersemlik' },
        function (C, e) { C.vur(e, C.p, 6); C.durumVer(C.p, 'sersem', 2); });
      return M('cig', { tip: 'saldiri', hasar: 12 }, function (C, e) { C.vur(e, C.p, 12); });
    }
  });

  E('kor_yilani', {
    ad: 'Kor Yılanı', art: '🐍', hp: [32, 38], perde: 2,
    hamleSec: function (C, e) {
      return C.rng.chance(55)
        ? M('zehir_dis', { tip: 'saldiri_debuff', hasar: 8, ipucu: '4 Yanık' },
            function (C, e) { C.vur(e, C.p, 8); C.durumVer(C.p, 'yanik', 4); })
        : M('kuyruk', { tip: 'saldiri', hasar: 14 }, function (C, e) { C.vur(e, C.p, 14); });
    }
  });

  E('yanki_varligi', {
    ad: 'Yankı', art: '🌀', hp: [27, 33], perde: 2,
    // Geçen tur kaç kart oynadıysan o kadar sert vurur
    hamleSec: function (C, e) {
      if (e.sira % 3 === 2) return M('bozul', { tip: 'debuff', ipucu: 'Zincir 2 (Akkor kazanamazsın)' },
        function (C, e) { C.durumVer(C.p, 'zincir', 2); });
      return M('yansit', {
        tip: 'saldiri',
        hasar: 5,
        ipucu: 'Oynadığın kart başına +3'
      }, function (C, e) { C.vur(e, C.p, 5 + C.turKart * 3); });
    }
  });

  E('curuf_yigini', {
    ad: 'Cüruf Yığını', art: '🪨', hp: [42, 50], perde: 2,
    savasBasi: function (C, e) { C.durumVer(e, 'zirh', 8); },
    hamleSec: desen([
      function () { return M('sertles', { tip: 'savunma', ipucu: '14 blok' },
        function (C, e) { C.blokVer(e, 14, { ham: true }); }); },
      function () { return M('devril', { tip: 'saldiri', hasar: 18 },
        function (C, e) { C.vur(e, C.p, 18); }); },
      function () { return M('kir', { tip: 'saldiri_debuff', hasar: 9, ipucu: '2 Kırık' },
        function (C, e) { C.vur(e, C.p, 9); C.durumVer(C.p, 'kirik', 2); }); }
    ])
  });

  /* --- Perde 2 elitleri ---------------------------------------------- */

  E('kirik_can', {
    ad: 'Kırık Çan', art: '🔔', hp: [88, 98], perde: 2, boy: 1.35, elit: true,
    hamleSec: function (C, e) {
      var d = e.sira % 3;
      if (d === 0) return M('cinlat', { tip: 'saldiri_debuff', hasar: 10, ipucu: '2 Sersemlik' },
        function (C, e) { C.vur(e, C.p, 10); C.durumVer(C.p, 'sersem', 2); });
      if (d === 1) return M('titre', { tip: 'saldiri', hasar: 7, kez: 3 },
        function (C, e) { C.vur(e, C.p, 7, { kez: 3 }); });
      return M('cinlama', { tip: 'olumcul', hasar: 24 },
        function (C, e) { C.vur(e, C.p, 24); C.blokVer(e, 12, { ham: true }); });
    }
  });

  E('kul_sovalyesi', {
    ad: 'Kül Şövalyesi', art: '⚔️', hp: [96, 106], perde: 2, boy: 1.35, elit: true,
    savasBasi: function (C, e) { C.durumVer(e, 'tilsim', 2); },
    hamleSec: function (C, e) {
      if (e.sira % 4 === 0) return M('duruş', { tip: 'buff', ipucu: '4 Güç, 15 blok' },
        function (C, e) { C.durumVer(e, 'guc', 4); C.blokVer(e, 15, { ham: true }); });
      if (e.sira % 4 === 2) return M('darbe', { tip: 'saldiri', hasar: 11, kez: 2 },
        function (C, e) { C.vur(e, C.p, 11, { kez: 2 }); });
      return M('kesik', { tip: 'saldiri_debuff', hasar: 16, ipucu: '2 Kırılganlık' },
        function (C, e) { C.vur(e, C.p, 16); C.durumVer(C.p, 'kirilganlik', 2); });
    }
  });

  E('curuf_agasi', {
    ad: 'Cüruf Ağası', art: '👹', hp: [92, 102], perde: 2, boy: 1.35, elit: true,
    hamleSec: function (C, e) {
      if (e.hp < e.maxHp * 0.4 && !e.sayac.ofke) {
        e.sayac.ofke = 1;
        return M('cilgin', { tip: 'buff', ipucu: '6 Güç — çıldırdı!' },
          function (C, e) { C.durumVer(e, 'guc', 6); C.yaziGoster(e, 'ÇILDIRDI', '#ef4444'); });
      }
      if (e.sira % 3 === 2) return M('kul_kus', { tip: 'saldiri_debuff', hasar: 9, ipucu: 'Desteye 1 Külçe' },
        function (C, e) { C.vur(e, C.p, 9); C.atigaEkle('kulce'); });
      return C.rng.chance(60)
        ? M('gurz', { tip: 'saldiri', hasar: 19 }, function (C, e) { C.vur(e, C.p, 19); })
        : M('savurma', { tip: 'saldiri', hasar: 8, kez: 3 },
            function (C, e) { C.vur(e, C.p, 8, { kez: 3 }); });
    }
  });

  /* --- Perde 2 patronu ------------------------------------------------ */

  E('sonmus_kral', {
    ad: 'SÖNMÜŞ KRAL', art: '👑', hp: [235, 235], perde: 2, boy: 1.9, patron: true,
    savasBasi: function (C, e) { C.durumVer(e, 'tilsim', 3); },
    hamleSec: function (C, e) {
      var d = e.sira % 6;
      if (d === 0) return M('emir', { tip: 'buff', ipucu: '3 Güç, 4 Zırh' },
        function (C, e) { C.durumVer(e, 'guc', 3); C.durumVer(e, 'zirh', 4); });
      if (d === 1) return M('asa_vur', { tip: 'saldiri', hasar: 16 },
        function (C, e) { C.vur(e, C.p, 16); });
      if (d === 2) return M('sondur', { tip: 'debuff', ipucu: 'Zincir 3 — Akkor kazanamazsın' },
        function (C, e) { C.durumVer(C.p, 'zincir', 3); C.akkorEkle(-99); });
      if (d === 3) return M('taht', { tip: 'saldiri_debuff', hasar: 9, kez: 2, ipucu: '2 Kırık' },
        function (C, e) { C.vur(e, C.p, 9, { kez: 2 }); C.durumVer(C.p, 'kirik', 2); });
      if (d === 4) return M('cagir', { tip: 'debuff', ipucu: 'Desteye 2 İs, 1 Korku' },
        function (C, e) { C.atigaEkle('is'); C.atigaEkle('is'); C.durumVer(C.p, 'korku', 2); });
      return M('hukum', { tip: 'olumcul', hasar: 28 }, function (C, e) { C.vur(e, C.p, 28); });
    }
  });

  /* ==================================================================== */
  /*  PERDE 3 — ATEŞİN KALBİ                                              */
  /* ==================================================================== */

  E('alev_elementali', {
    ad: 'Alev Elementali', art: '🔥', hp: [48, 56], perde: 3,
    savasBasi: function (C, e) { C.durumVer(e, 'guc', 1); },
    hamleSec: function (C, e) {
      return C.rng.chance(55)
        ? M('alev_dil', { tip: 'saldiri_debuff', hasar: 10, ipucu: '4 Yanık' },
            function (C, e) { C.vur(e, C.p, 10); C.durumVer(C.p, 'yanik', 4); })
        : M('patlat', { tip: 'saldiri', hasar: 7, kez: 3 },
            function (C, e) { C.vur(e, C.p, 7, { kez: 3 }); });
    }
  });

  E('kor_devi_kucuk', {
    ad: 'Kor Devi', art: '💪', hp: [60, 70], perde: 3, boy: 1.2,
    hamleSec: desen([
      function () { return M('gerin', { tip: 'buff', ipucu: '4 Güç' },
        function (C, e) { C.durumVer(e, 'guc', 4); }); },
      function () { return M('yumruk2', { tip: 'saldiri', hasar: 18 },
        function (C, e) { C.vur(e, C.p, 18); }); },
      function () { return M('kirici', { tip: 'saldiri', hasar: 13, kez: 2 },
        function (C, e) { C.vur(e, C.p, 13, { kez: 2 }); }); }
    ])
  });

  E('golge_alev', {
    ad: 'Gölge Alev', art: '🌑', hp: [44, 52], perde: 3,
    hamleSec: function (C, e) {
      if (e.sira % 3 === 1) return M('emis', { tip: 'debuff', ipucu: '2 Korku — enerjini çalar' },
        function (C, e) { C.durumVer(C.p, 'korku', 2); C.iyilestir(e, 10); });
      return M('golge_vur', { tip: 'saldiri', hasar: 8, kez: 2 },
        function (C, e) { C.vur(e, C.p, 8, { kez: 2 }); });
    }
  });

  E('sonsuz_kor', {
    ad: 'Sonsuz Kor', art: '♾️', hp: [52, 60], perde: 3,
    olurken: function (C, e) {
      if (e.sayac.dirildi) return;
      e.sayac.dirildi = 1;
      e.hp = Math.floor(e.maxHp * 0.45);
      C.yaziGoster(e, 'YENİDEN DOĞDU', '#f59e0b');
      C.olay({ t: 'dirilis', hedef: C.ref(e) });
    },
    hamleSec: function (C, e) {
      return C.rng.chance(60)
        ? M('kor_vur', { tip: 'saldiri', hasar: 13 }, function (C, e) { C.vur(e, C.p, 13); })
        : M('yeniden', { tip: 'saldiri_savunma', hasar: 8 },
            function (C, e) { C.vur(e, C.p, 9); C.blokVer(e, 14, { ham: true }); });
    }
  });

  E('ates_yumagi', {
    ad: 'Ateş Yumağı', art: '🐉', hp: [40, 47], perde: 3,
    hamleSec: function (C, e) {
      return C.rng.chance(50)
        ? M('sar', { tip: 'saldiri', hasar: 5, kez: 3 },
            function (C, e) { C.vur(e, C.p, 5, { kez: 3 }); })
        : M('kavur', { tip: 'saldiri_debuff', hasar: 9, ipucu: '3 Yanık' },
            function (C, e) { C.vur(e, C.p, 9); C.durumVer(C.p, 'yanik', 3); });
    }
  });

  E('kul_cadisi', {
    ad: 'Kül Cadısı', art: '🧟‍♀️', hp: [46, 54], perde: 3,
    hamleSec: function (C, e) {
      if (e.sira % 4 === 3) return M('kargis', { tip: 'debuff', ipucu: 'Desteye 1 Şüphe' },
        function (C, e) { C.atigaEkle('lanet_supheli'); C.durumVer(C.p, 'zayiflik', 2); });
      return C.rng.chance(50)
        ? M('buyu_at', { tip: 'saldiri', hasar: 12 }, function (C, e) { C.vur(e, C.p, 12); })
        : M('kotu_goz', { tip: 'saldiri_debuff', hasar: 8, ipucu: '3 Kırılganlık' },
            function (C, e) { C.vur(e, C.p, 8); C.durumVer(C.p, 'kirilganlik', 3); });
    }
  });

  /* --- Perde 3 elitleri ---------------------------------------------- */

  E('yanardag_muhafizi', {
    ad: 'Yanardağ Muhafızı', art: '🌋', hp: [132, 146], perde: 3, boy: 1.5, elit: true,
    savasBasi: function (C, e) { C.durumVer(e, 'zirh', 6); C.durumVer(e, 'diken', 3); },
    hamleSec: function (C, e) {
      var d = e.sira % 4;
      if (d === 0) return M('magma', { tip: 'saldiri_debuff', hasar: 12, ipucu: '5 Yanık' },
        function (C, e) { C.vur(e, C.p, 12); C.durumVer(C.p, 'yanik', 5); });
      if (d === 2) return M('kabuk3', { tip: 'buff', ipucu: '16 blok, 3 Diken' },
        function (C, e) { C.blokVer(e, 16, { ham: true }); C.durumVer(e, 'diken', 3); });
      return M('puskur', { tip: 'saldiri', hasar: 9, kez: 3 },
        function (C, e) { C.vur(e, C.p, 9, { kez: 3 }); });
    }
  });

  E('kullerin_efendisi', {
    ad: 'Küllerin Efendisi', art: '☠️', hp: [150, 164], perde: 3, boy: 1.5, elit: true,
    hamleSec: function (C, e) {
      var d = e.sira % 3;
      if (d === 0) return M('kul_ordusu', { tip: 'debuff', ipucu: 'Desteye 2 Külçe, 3 Güç' },
        function (C, e) { C.atigaEkle('kulce'); C.atigaEkle('kulce'); C.durumVer(e, 'guc', 3); });
      if (d === 1) return M('tirpan', { tip: 'saldiri', hasar: 22 },
        function (C, e) { C.vur(e, C.p, 22); });
      return M('ruh_em', { tip: 'saldiri', hasar: 10, kez: 2, ipucu: 'Verdiği hasar kadar iyileşir' },
        function (C, e) { var t = C.vur(e, C.p, 10, { kez: 2 }); C.iyilestir(e, t); });
    }
  });

  /* --- Perde 3 patronu (final) ---------------------------------------- */

  E('ilk_alev', {
    ad: 'İLK ALEV', art: '✹', hp: [390, 390], perde: 3, boy: 2.1, patron: true,
    savasBasi: function (C, e) { C.durumVer(e, 'tilsim', 4); e.sayac.evre = 1; },
    hamleSec: function (C, e) {
      // Evre geçişleri
      var oran = e.hp / e.maxHp;
      if (oran <= 0.6 && e.sayac.evre === 1) {
        e.sayac.evre = 2;
        return M('evre2', { tip: 'buff', ipucu: 'EVRE II — 5 Güç, 6 Zırh, 30 blok' },
          function (C, e) {
            C.durumVer(e, 'guc', 5); C.durumVer(e, 'zirh', 6);
            C.blokVer(e, 30, { ham: true });
            C.yaziGoster(e, 'EVRE II', '#f43f5e');
          });
      }
      if (oran <= 0.25 && e.sayac.evre === 2) {
        e.sayac.evre = 3;
        return M('evre3', { tip: 'buff', ipucu: 'EVRE III — 8 Güç, 4 Tılsım' },
          function (C, e) {
            C.durumVer(e, 'guc', 8); C.durumVer(e, 'tilsim', 4);
            C.durumVer(C.p, 'zincir', 2);
            C.yaziGoster(e, 'EVRE III', '#f43f5e');
          });
      }
      var evre = e.sayac.evre;
      var d = e.sira % (evre === 3 ? 3 : 5);
      if (evre === 3) {
        if (d === 0) return M('yok_edis', { tip: 'olumcul', hasar: 32 },
          function (C, e) { C.vur(e, C.p, 32); });
        if (d === 1) return M('kor_yagmur3', { tip: 'saldiri', hasar: 9, kez: 4 },
          function (C, e) { C.vur(e, C.p, 9, { kez: 4 }); });
        return M('kul_et', { tip: 'saldiri_debuff', hasar: 18, ipucu: '8 Yanık, 1 Kor Yükü' },
          function (C, e) { C.vur(e, C.p, 18); C.durumVer(C.p, 'yanik', 8);
                            C.atigaEkle('lanet_kor_yuku'); });
      }
      if (d === 0) return M('alev_dalgasi', { tip: 'saldiri', hasar: 14, kez: 2 },
        function (C, e) { C.vur(e, C.p, 14, { kez: 2 }); });
      if (d === 1) return M('kavurucu', { tip: 'saldiri_debuff', hasar: 16, ipucu: '5 Yanık' },
        function (C, e) { C.vur(e, C.p, 16); C.durumVer(C.p, 'yanik', 5); });
      if (d === 2) return M('toparlan', { tip: 'buff', ipucu: '25 blok, 3 Güç' },
        function (C, e) { C.blokVer(e, 25, { ham: true }); C.durumVer(e, 'guc', 3); });
      if (d === 3) return M('sonduren', { tip: 'debuff', ipucu: 'Zincir 2, 2 Kırık, Desteye 1 İs' },
        function (C, e) { C.durumVer(C.p, 'zincir', 2); C.durumVer(C.p, 'kirik', 2);
                          C.atigaEkle('is'); });
      return M('kiyamet', { tip: 'olumcul', hasar: 26 },
        function (C, e) { C.vur(e, C.p, 26); });
    }
  });

  /* ==================================================================== */
  /*  KARŞILAŞMA TABLOLARI                                                */
  /* ==================================================================== */

  var KARSILASMALAR = {
    1: {
      zayif: [
        { id: 'k1a', dusmanlar: ['kor_sicani', 'kor_sicani'] },
        { id: 'k1b', dusmanlar: ['kulluk_bocegi'] },
        { id: 'k1c', dusmanlar: ['ates_bocegi', 'ates_bocegi', 'ates_bocegi'] },
        { id: 'k1d', dusmanlar: ['duman_ruhu', 'kor_sicani'] },
        { id: 'k1z', dusmanlar: ['kulluk_bocegi', 'ates_bocegi'] }
      ],
      normal: [
        { id: 'k1e', dusmanlar: ['yanik_ceset', 'kor_sicani'] },
        { id: 'k1f', dusmanlar: ['kavruk_nobetci'] },
        { id: 'k1g', dusmanlar: ['duman_ruhu', 'duman_ruhu', 'ates_bocegi'] },
        { id: 'k1h', dusmanlar: ['kul_yigini'] },
        { id: 'k1i', dusmanlar: ['sonuk_fener', 'kulluk_bocegi'] },
        { id: 'k1j', dusmanlar: ['yanik_ceset', 'yanik_ceset'] },
        { id: 'k1k', dusmanlar: ['kavruk_nobetci', 'ates_bocegi'] }
      ],
      elit: [
        { id: 'e1a', dusmanlar: ['kul_muhafizi'] },
        { id: 'e1b', dusmanlar: ['obur_kor'] },
        { id: 'e1c', dusmanlar: ['alev_ikizi', 'alev_ikizi'] }
      ],
      patron: [{ id: 'p1', dusmanlar: ['kul_devi'] }]
    },
    2: {
      zayif: [
        { id: 'k2a', dusmanlar: ['curuf_yaratigi'] },
        { id: 'k2b', dusmanlar: ['koz_avcisi', 'duman_ruhu'] },
        { id: 'k2z1', dusmanlar: ['ciglik'] },
        { id: 'k2z2', dusmanlar: ['kor_yilani'] }
      ],
      normal: [
        { id: 'k2c', dusmanlar: ['curuf_yaratigi', 'koz_avcisi'] },
        { id: 'k2d', dusmanlar: ['demir_otomat'] },
        { id: 'k2e', dusmanlar: ['kullu_rahip', 'kor_yilani'] },
        { id: 'k2f', dusmanlar: ['ciglik', 'ciglik'] },
        { id: 'k2g', dusmanlar: ['curuf_yigini'] },
        { id: 'k2h', dusmanlar: ['yanki_varligi', 'curuf_yaratigi'] },
        { id: 'k2i', dusmanlar: ['kor_yilani', 'kor_yilani'] },
        { id: 'k2j', dusmanlar: ['kullu_rahip', 'ciglik'] },
        { id: 'k2k', dusmanlar: ['koz_avcisi', 'ciglik'] }
      ],
      elit: [
        { id: 'e2a', dusmanlar: ['kirik_can'] },
        { id: 'e2b', dusmanlar: ['kul_sovalyesi'] },
        { id: 'e2c', dusmanlar: ['curuf_agasi'] }
      ],
      patron: [{ id: 'p2', dusmanlar: ['sonmus_kral'] }]
    },
    3: {
      zayif: [
        { id: 'k3a', dusmanlar: ['ates_yumagi'] },
        { id: 'k3b', dusmanlar: ['golge_alev'] },
        { id: 'k3z1', dusmanlar: ['alev_elementali'] },
        { id: 'k3z2', dusmanlar: ['kul_cadisi'] }
      ],
      normal: [
        { id: 'k3c', dusmanlar: ['alev_elementali', 'ates_yumagi'] },
        { id: 'k3d', dusmanlar: ['kor_devi_kucuk'] },
        { id: 'k3e', dusmanlar: ['sonsuz_kor', 'golge_alev'] },
        { id: 'k3f', dusmanlar: ['kul_cadisi', 'alev_elementali'] },
        { id: 'k3g', dusmanlar: ['ates_yumagi', 'ates_yumagi'] },
        { id: 'k3h', dusmanlar: ['kor_devi_kucuk', 'golge_alev'] },
        { id: 'k3i', dusmanlar: ['kul_cadisi', 'kul_cadisi'] },
        { id: 'k3j', dusmanlar: ['sonsuz_kor', 'alev_elementali'] }
      ],
      elit: [
        { id: 'e3a', dusmanlar: ['yanardag_muhafizi'] },
        { id: 'e3b', dusmanlar: ['kullerin_efendisi'] },
        { id: 'e3c', dusmanlar: ['kul_sovalyesi', 'ates_yumagi'] }
      ],
      patron: [{ id: 'p3', dusmanlar: ['ilk_alev'] }]
    }
  };

  global.DUSMANLAR = D;
  global.KARSILASMALAR = KARSILASMALAR;
})(typeof window !== 'undefined' ? window : globalThis);
