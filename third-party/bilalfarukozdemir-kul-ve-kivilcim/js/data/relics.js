/* =========================================================================
   YADİGÂRLAR
   ---------------------------------------------------------------------
   h : savaş içi kancalar        h.savasBasi(C, r)
   m : sayısal değiştiriciler    m.hasarVer(C, r, deger, hedef) -> yeniDeger
   k : koşu düzeyi kancalar      k.alinca(run, r) / k.savasSonu(run, r) ...
   ========================================================================= */
(function (global) {
  'use strict';

  var Y = {};
  var LISTE = [];
  function R(id, o) {
    o.id = id;
    Y[id] = o;
    LISTE.push(o);
    return o;
  }

  /* ---------------- BAŞLANGIÇ ---------------------------------------- */

  R('sonmez_kor', {
    ad: 'Sönmez Kor', ikon: '🔥', nadirlik: 'baslangic',
    metin: 'Her savaşın başında 2 Akkor kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.akkorEkle(2); } }
  });

  /* ---------------- SIRADAN ------------------------------------------ */

  R('kor_tasi', {
    ad: 'Kor Taşı', ikon: '🪨', nadirlik: 'siradan',
    metin: 'Her savaşın başında 3 Akkor kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.akkorEkle(3); } }
  });

  R('kirik_migfer', {
    ad: 'Kırık Miğfer', ikon: '⛑️', nadirlik: 'siradan',
    metin: 'Her savaşın başında 7 blok kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.blokVer(C.p, 7, { ham: true }); } }
  });

  R('cakmaktasi', {
    ad: 'Çakmaktaşı', ikon: '🪨', nadirlik: 'siradan',
    metin: 'Her turun ilk saldırı kartı 3 fazla hasar verir.',
    m: {
      hasarVer: function (C, r, d) {
        return C.turSaldiri <= 1 ? d + 3 : d;
      }
    }
  });

  R('kanli_bez', {
    ad: 'Kanlı Bez', ikon: '🩹', nadirlik: 'siradan',
    metin: 'Her savaştan sonra 6 can iyileşirsin.',
    k: { savasSonu: function (run, r) { run.iyilestir(6); } }
  });

  R('demir_toka', {
    ad: 'Demir Toka', ikon: '🔩', nadirlik: 'siradan',
    metin: 'Alındığında maksimum canın 8 artar.',
    k: { alinca: function (run, r) { run.maxHp += 8; run.hp += 8; } }
  });

  R('ors', {
    ad: 'Örs', ikon: '🛠️', nadirlik: 'siradan',
    metin: 'Her savaşın başında Zırh 2 kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.durumVer(C.p, 'zirh', 2); } }
  });

  R('yolcu_haritasi', {
    ad: 'Yolcu Haritası', ikon: '🗺️', nadirlik: 'siradan',
    metin: 'Dinlenme alanlarında %50 fazla iyileşirsin.',
    k: { dinlenmeCarpani: function (run, r, x) { return x * 1.5; } }
  });

  R('cam_sise', {
    ad: 'Cam Şişe', ikon: '🍶', nadirlik: 'siradan',
    metin: '1 fazla iksir yuvası.',
    k: { alinca: function (run, r) { run.iksirYuva += 1; run.iksirler.push(null); } }
  });

  R('ugurlu_komur', {
    ad: 'Uğurlu Kömür', ikon: '⚫', nadirlik: 'siradan',
    metin: 'Savaşlardan %30 fazla altın kazanırsın.',
    k: { altinCarpani: function (run, r, x) { return Math.round(x * 1.3); } }
  });

  R('orumcek_agi', {
    ad: 'Örümcek Ağı', ikon: '🕸️', nadirlik: 'siradan',
    metin: 'Her savaşın başında tüm düşmanlara 1 Zayıflık verirsin.',
    h: {
      savasBasi: function (C, r) {
        C.yadigarParla(r.id);
        var d = C.canliDusmanlar();
        for (var i = 0; i < d.length; i++) C.durumVer(d[i], 'zayiflik', 1);
      }
    }
  });

  R('yanik_eldiven', {
    ad: 'Yanık Eldiven', ikon: '🧤', nadirlik: 'siradan',
    metin: 'Her savaşın ilk turunda tüm düşmanlara 3 Yanık verirsin.',
    h: {
      turBasi: function (C, r) {
        if (C.tur !== 1) return;
        C.yadigarParla(r.id);
        var d = C.canliDusmanlar();
        for (var i = 0; i < d.length; i++) C.durumVer(d[i], 'yanik', 3);
      }
    }
  });

  /* ---------------- NADİR -------------------------------------------- */

  R('koruk', {
    ad: 'Körük', ikon: '🎐', nadirlik: 'nadir',
    metin: 'Akkor kazandığında 1 fazla kazanırsın.',
    m: { akkorKazan: function (C, r, n) { return n + 1; } }
  });

  R('kavrulmus_kalp', {
    ad: 'Kavrulmuş Kalp', ikon: '🫀', nadirlik: 'nadir',
    metin: 'Canın yarıdan azken saldırıların 5 fazla hasar verir.',
    m: {
      hasarVer: function (C, r, d) {
        return (C.p.hp * 2 <= C.p.maxHp) ? d + 5 : d;
      }
    }
  });

  R('kul_elegi', {
    ad: 'Kül Eleği', ikon: '🧺', nadirlik: 'nadir',
    metin: 'Her savaşın başında elindeki rastgele bir kartın bedeli 0 olur.',
    h: {
      turBasi: function (C, r) {
        if (C.tur !== 1 || !C.el.length) return;
        var k = C.rng.pick(C.el);
        k.gecici = { bedel: 0 };
        C.yadigarParla(r.id);
      }
    }
  });

  R('kor_zinciri', {
    ad: 'Kor Zinciri', ikon: '⛓️', nadirlik: 'nadir',
    metin: 'Her turun ilk oynadığın kartının bedeli 1 azalır.',
    m: {
      kartBedeli: function (C, r, b) { return C.turKart === 0 ? Math.max(0, b - 1) : b; }
    }
  });

  R('efsunlu_kalkan', {
    ad: 'Efsunlu Kalkan', ikon: '🛡️', nadirlik: 'nadir',
    metin: 'Her savaşın başında 14 blok kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.blokVer(C.p, 14, { ham: true }); } }
  });

  R('gece_feneri', {
    ad: 'Gece Feneri', ikon: '🏮', nadirlik: 'nadir',
    metin: 'Her savaşın ilk turunda 1 fazla enerji kazanırsın.',
    h: {
      turBasi: function (C, r) {
        if (C.tur !== 1) return;
        C.enerji += 1; C.yadigarParla(r.id); C.olay({ t: 'enerji', miktar: 1 });
      }
    }
  });

  R('olum_maskesi', {
    ad: 'Ölüm Maskesi', ikon: '💀', nadirlik: 'nadir',
    metin: 'Bir düşman öldüğünde 2 Akkor kazanır ve 3 can iyileşirsin.',
    h: {
      dusmanOlunce: function (C, r) {
        C.yadigarParla(r.id); C.akkorEkle(2); C.iyilestir(C.p, 3);
      }
    }
  });

  R('sarsilmaz_kaya', {
    ad: 'Sarsılmaz Kaya', ikon: '🪨', nadirlik: 'nadir',
    metin: 'Tur başında blokunun yarısı korunur.',
    h: { savasBasi: function (C, r) { C.run.gecici.blokKoruYuzde =
                                      Math.max(C.run.gecici.blokKoruYuzde || 0, 50); } }
  });

  R('kirmizi_boncuk', {
    ad: 'Kırmızı Boncuk', ikon: '🔴', nadirlik: 'nadir',
    metin: 'Her tur 3. kartını oynadığında 1 enerji kazanırsın.',
    h: {
      kartOynayinca: function (C, r) {
        if (C.turKart === 3) {
          C.enerji += 1; C.yadigarParla(r.id); C.olay({ t: 'enerji', miktar: 1 });
        }
      }
    }
  });

  R('kadim_sise', {
    ad: 'Kadim Şişe', ikon: '⚗️', nadirlik: 'nadir',
    metin: 'İksirlerin çok daha güçlü etki eder.'
    // Etkisi Combat.iksirKullan içinde okunur
  });

  R('bilgelik_kitabi', {
    ad: 'Bilgelik Kitabı', ikon: '📖', nadirlik: 'nadir',
    metin: 'Dinlenme alanlarında kart yükseltirsen 2 kart yükseltirsin.'
  });

  R('kesekagidi', {
    ad: 'Yağlı Kese', ikon: '💰', nadirlik: 'nadir',
    metin: 'Alındığında 120 altın kazanırsın.',
    k: { alinca: function (run, r) { run.altin += 120; } }
  });

  R('kul_tesbihi', {
    ad: 'Kül Tesbihi', ikon: '📿', nadirlik: 'nadir',
    metin: 'Her turun sonunda elindeki kart başına 1 Akkor kazanırsın.',
    h: {
      turSonu: function (C, r) {
        if (!C.el.length) return;
        C.yadigarParla(r.id); C.akkorEkle(C.el.length);
      }
    }
  });

  R('demirci_orsu', {
    ad: 'Demirci Örsü', ikon: '⚒️', nadirlik: 'nadir',
    metin: 'Bir turda hiç saldırı kartı oynamazsan 12 blok kazanırsın.',
    h: {
      turSonu: function (C, r) {
        if (C.turSaldiri === 0) { C.yadigarParla(r.id); C.blokVer(C.p, 12, { ham: true }); }
      }
    }
  });

  /* ---------------- EFSANEVİ ------------------------------------------ */

  R('ebedi_koz', {
    ad: 'Ebedi Köz', ikon: '☀️', nadirlik: 'efsanevi',
    metin: 'Savaşa 6 Akkor ile başlarsın. Akkor kazandığında 1 fazla kazanırsın.',
    h: { savasBasi: function (C, r) { C.yadigarParla(r.id); C.akkorEkle(6); } },
    m: { akkorKazan: function (C, r, n) { return n + 1; } }
  });

  R('zaman_kumu', {
    ad: 'Zaman Kumu', ikon: '⏳', nadirlik: 'efsanevi',
    metin: 'Her savaşın ilk turunda 2 fazla enerji kazanırsın.',
    h: {
      turBasi: function (C, r) {
        if (C.tur !== 1) return;
        C.enerji += 2; C.yadigarParla(r.id); C.olay({ t: 'enerji', miktar: 2 });
      }
    }
  });

  R('kirik_saat', {
    ad: 'Kırık Saat', ikon: '🕰️', nadirlik: 'efsanevi',
    metin: 'Her tur 1 fazla kart çekersin.',
    m: { cekisSayisi: function (C, r, n) { return n + 1; } }
  });

  R('feniks_tuyu', {
    ad: 'Feniks Tüyü', ikon: '🪶', nadirlik: 'efsanevi',
    metin: 'Koşu başına bir kez, ölmek yerine canının yarısıyla ayağa kalkarsın.',
    h: {
      olumdenOnce: function (C, r, sonuc) {
        if (r.kullanildi) return;
        r.kullanildi = true;
        C.p.hp = Math.floor(C.p.maxHp / 2);
        C.p.st = {};
        C.yadigarParla(r.id);
        C.yaziGoster(C.p, 'KÜLLERİNDEN', '#fbbf24');
        C.olay({ t: 'dirilis', hedef: 'p' });
        sonuc.deger = true;
      }
    }
  });

  R('alev_taci', {
    ad: 'Alev Tacı', ikon: '👑', nadirlik: 'efsanevi',
    metin: 'Her tur 1 fazla enerji. Her savaşın başında 5 hasar alırsın.',
    m: { maxEnerji: function (C, r, n) { return n + 1; } },
    h: {
      savasBasi: function (C, r) {
        C.yadigarParla(r.id);
        C.hasarUygula(C.p, 5, { bloksuz: true });
      }
    }
  });

  R('ates_gozu', {
    ad: 'Ateş Gözü', ikon: '👁️', nadirlik: 'efsanevi',
    metin: 'Elit ve patron savaşlarının başında 3 kart çeker ve 2 enerji kazanırsın.',
    h: {
      turBasi: function (C, r) {
        if (C.tur !== 1) return;
        var t = C.karsilasma.tur;
        if (t !== 'elit' && t !== 'patron') return;
        C.yadigarParla(r.id);
        C.cek(3); C.enerji += 2; C.olay({ t: 'enerji', miktar: 2 });
      }
    }
  });

  /* ---------------- PATRON YADİGÂRLARI -------------------------------- */

  R('devin_kalbi', {
    ad: 'Devin Kalbi', ikon: '💗', nadirlik: 'patron',
    metin: 'Maksimum canın 30 artar ve tamamen iyileşirsin.',
    k: { alinca: function (run, r) { run.maxHp += 30; run.hp = run.maxHp; } }
  });

  R('kral_muhru', {
    ad: 'Kral Mührü', ikon: '🔱', nadirlik: 'patron',
    metin: 'Her tur 1 fazla enerji, ama 1 az kart çekersin.',
    m: {
      maxEnerji: function (C, r, n) { return n + 1; },
      cekisSayisi: function (C, r, n) { return n - 1; }
    }
  });

  R('alevin_ozu', {
    ad: 'Alevin Özü', ikon: '✨', nadirlik: 'patron',
    metin: 'Akkor harcadığında harcadığının yarısı kadarını geri kazanırsın.',
    h: {
      akkorHarcayinca: function (C, r, a) {
        var geri = Math.floor(a / 2);
        if (geri > 0) { C.yadigarParla(r.id); C.akkorEkle(geri); }
      }
    }
  });

  R('kul_kalkani', {
    ad: 'Kül Kalkanı', ikon: '🔰', nadirlik: 'patron',
    metin: 'Aldığın hasar 2 azalır (en az 1).',
    m: {
      hasarAl: function (C, r, d) { return d > 0 ? Math.max(1, d - 2) : d; }
    }
  });

  /* ---------------- DÜKKAN ÖZEL --------------------------------------- */

  R('tuccar_yuzugu', {
    ad: 'Tüccar Yüzüğü', ikon: '💍', nadirlik: 'dukkan',
    metin: 'Dükkandaki her şey %30 ucuzlar.',
    k: { fiyatCarpani: function (run, r, x) { return Math.max(1, Math.round(x * 0.7)); } }
  });

  R('koz_kesesi', {
    ad: 'Köz Kesesi', ikon: '👝', nadirlik: 'dukkan',
    metin: 'Her savaşın başında rastgele bir iksir kazanırsın (yer varsa).',
    h: {
      savasBasi: function (C, r) {
        if (C.run.iksirEkle(global.rastgeleIksir(C.rng))) C.yadigarParla(r.id);
      }
    }
  });

  /* -------------------------------------------------------------------- */

  global.YADIGARLAR = Y;
  global.YADIGAR_LISTESI = LISTE;

  global.yadigarHavuzu = function (nadirlik) {
    var o = [];
    for (var i = 0; i < LISTE.length; i++)
      if (LISTE[i].nadirlik === nadirlik) o.push(LISTE[i].id);
    return o;
  };
})(typeof window !== 'undefined' ? window : globalThis);
