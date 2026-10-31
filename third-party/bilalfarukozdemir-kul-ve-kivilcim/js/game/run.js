/* =========================================================================
   KOŞU YÖNETİMİ
   ---------------------------------------------------------------------
   Harita üretimi, düğüm içerikleri, ödüller, dükkan, dinlenme, kayıt.
   Arayüzle iletişim `akis` kuyruğu üzerinden: koşu bir seçim gerektiren
   adım ürettiğinde kuyruğa atar, arayüz sırayla tüketir.
   ========================================================================= */
(function (global) {
  'use strict';

  var KAT_SAYISI = 15;          // perde başına kat (14 = patron)
  var HAZINE_KATI = 8;
  var DINLENME_KATI = 13;
  var PATRON_KATI = 14;

  var ZORLUKLAR = [
    { ad: 'Gezgin',   ipucu: 'Dengeli deneyim',            canFark: 0,   dusmanHp: 1.00, elitHp: 1.00 },
    { ad: 'Kül Yemin', ipucu: 'Düşmanlar daha dayanıklı',  canFark: -6,  dusmanHp: 1.12, elitHp: 1.15 },
    { ad: 'Kâbus',    ipucu: 'Acımasız',                   canFark: -12, dusmanHp: 1.22, elitHp: 1.30 }
  ];

  /* ==================================================================== */

  function Run(tohum, zorluk) {
    this.tohum = tohum || global.RNG.randomSeedText();
    this.rng = new global.RNG(this.tohum);
    this.zorluk = zorluk || 0;
    var z = ZORLUKLAR[this.zorluk];

    this.maxHp = 80 + z.canFark;
    this.hp = this.maxHp;
    this.altin = 99;
    this.perde = 1;
    this.kat = -1;                    // -1 = henüz haritaya girilmedi
    this.dugumIdx = -1;
    this.harita = null;
    this.gecilenler = [];             // [{kat, idx}]

    this.deste = [];
    this.yadigarlar = [];
    this.iksirYuva = 3;
    this.iksirler = [null, null, null];

    this.gecici = {};                 // savaşa özel bayraklar
    this.akis = [];                   // bekleyen arayüz adımları
    this.silmeUcreti = 60;
    this.sonKarsilasmalar = [];
    this.oyunSonu = null;             // 'zafer' | 'yenilgi'

    this.ist = { savas: 0, elit: 0, oldurulen: 0, altinKazanc: 0, enBuyukVurus: 0,
                 tur: 0, oynananKart: 0 };

    this._kur();
  }

  Run.prototype._kur = function () {
    var i;
    for (i = 0; i < 5; i++) this.deste.push(global.yeniKart('vurus'));
    for (i = 0; i < 4; i++) this.deste.push(global.yeniKart('savun'));
    this.deste.push(global.yeniKart('kivilcim'));
    this.yadigarEkle('sonmez_kor', true);
    this.harita = this.haritaUret(1);
  };

  /* ------------------------------------------------------------------ */
  /*  Yadigâr kancaları (koşu düzeyi)                                    */
  /* ------------------------------------------------------------------ */

  Run.prototype.kTrig = function (kanca, a) {
    for (var i = 0; i < this.yadigarlar.length; i++) {
      var def = global.YADIGARLAR[this.yadigarlar[i].id];
      if (def && def.k && def.k[kanca]) def.k[kanca](this, this.yadigarlar[i], a);
    }
  };

  Run.prototype.kMod = function (kanca, deger) {
    for (var i = 0; i < this.yadigarlar.length; i++) {
      var def = global.YADIGARLAR[this.yadigarlar[i].id];
      if (def && def.k && def.k[kanca]) deger = def.k[kanca](this, this.yadigarlar[i], deger);
    }
    return deger;
  };

  Run.prototype.yadigarVar = function (id) {
    for (var i = 0; i < this.yadigarlar.length; i++)
      if (this.yadigarlar[i].id === id) return true;
    return false;
  };

  /* ------------------------------------------------------------------ */
  /*  Temel mutasyonlar                                                  */
  /* ------------------------------------------------------------------ */

  Run.prototype.canKaybet = function (n) {
    this.hp = Math.max(0, this.hp - n);
    if (this.hp <= 0) this.oyunSonu = 'yenilgi';
    return n;
  };

  Run.prototype.iyilestir = function (n) {
    var o = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp - o;
  };

  Run.prototype.altinEkle = function (n) {
    this.altin += n;
    this.ist.altinKazanc += n;
    return n;
  };

  Run.prototype.kartEkle = function (id, up) {
    var k = global.yeniKart(id, up);
    this.deste.push(k);
    return k;
  };

  Run.prototype.kartSil = function (kart) {
    for (var i = 0; i < this.deste.length; i++) {
      if (this.deste[i].uid === kart.uid) { this.deste.splice(i, 1); return true; }
    }
    return false;
  };

  Run.prototype.kartYukselt = function (kart) {
    for (var i = 0; i < this.deste.length; i++) {
      if (this.deste[i].uid === kart.uid) { this.deste[i].up = true; return true; }
    }
    return false;
  };

  Run.prototype.yadigarEkle = function (id, sessiz) {
    if (this.yadigarVar(id)) return false;
    var r = { id: id };
    this.yadigarlar.push(r);
    var def = global.YADIGARLAR[id];
    if (def && def.k && def.k.alinca) def.k.alinca(this, r);
    if (!sessiz) this.akis.push({ tip: 'yadigarAlindi', id: id });
    return true;
  };

  Run.prototype.iksirEkle = function (id) {
    for (var i = 0; i < this.iksirler.length; i++) {
      if (!this.iksirler[i]) { this.iksirler[i] = { id: id }; return true; }
    }
    return false;
  };

  Run.prototype.iksirYuvaBos = function () {
    for (var i = 0; i < this.iksirler.length; i++) if (!this.iksirler[i]) return true;
    return false;
  };

  /* ------------------------------------------------------------------ */
  /*  Harita üretimi                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Kenarlar "merdiven" yürüyüşüyle kurulur: ebeveyn ve çocuk indeksleri
   * hiçbir zaman geri gitmediği için çizgiler asla kesişmez ve her düğümün
   * en az bir girişi ve bir çıkışı olur.
   */
  function katlariBagla(n, m, rng) {
    var kenarlar = [];
    var p = 0, c = 0;
    while (true) {
      kenarlar.push([p, c]);
      if (p === n - 1 && c === m - 1) break;
      if (p === n - 1) { c++; continue; }
      if (c === m - 1) { p++; continue; }
      var r = rng.int(10);
      if (r < 4) p++;
      else if (r < 8) c++;
      else { p++; c++; }
    }
    return kenarlar;
  }

  Run.prototype.haritaUret = function (perde) {
    var rng = this.rng.s('harita');
    var katlar = [];
    var i, j;

    // Düğüm sayıları
    var sayilar = [];
    for (i = 0; i < KAT_SAYISI; i++) {
      if (i === 0) sayilar.push(3);
      else if (i === PATRON_KATI) sayilar.push(1);
      else if (i === DINLENME_KATI) sayilar.push(rng.range(2, 3));
      else if (i === HAZINE_KATI) sayilar.push(rng.range(2, 3));
      else sayilar.push(rng.range(2, 4));
    }

    for (i = 0; i < KAT_SAYISI; i++) {
      var kat = [];
      for (j = 0; j < sayilar[i]; j++) {
        kat.push({ kat: i, idx: j, tip: null, cocuklar: [], ebeveynler: [],
                   x: 0, y: 0, icerik: null, ziyaret: false });
      }
      katlar.push(kat);
    }

    // Bağlantılar
    for (i = 0; i < KAT_SAYISI - 1; i++) {
      var kenarlar = katlariBagla(sayilar[i], sayilar[i + 1], rng);
      for (j = 0; j < kenarlar.length; j++) {
        var a = katlar[i][kenarlar[j][0]], b = katlar[i + 1][kenarlar[j][1]];
        if (a.cocuklar.indexOf(b.idx) < 0) a.cocuklar.push(b.idx);
        if (b.ebeveynler.indexOf(a.idx) < 0) b.ebeveynler.push(a.idx);
      }
    }

    // Konumlar (arayüz için 0..1 aralığında).
    // Düğümler sabit 4 şeritlik bir ızgaraya, ortalanarak yerleşir; böylece
    // az düğümlü katlar kenarlara savrulmuyor ve bağlantılar kısa kalıyor.
    var SERIT = 4;
    for (i = 0; i < KAT_SAYISI; i++) {
      var n = katlar[i].length;
      var bas = (SERIT - n) / 2;
      for (j = 0; j < n; j++) {
        var jitter = (rng.next() - 0.5) * 0.035;
        katlar[i][j].x = 0.10 + 0.80 * ((bas + j + 0.5) / SERIT) + jitter;
        katlar[i][j].y = i / (KAT_SAYISI - 1);
      }
    }

    // Tipler
    var AGIRLIK = [
      { t: 'savas', w: 41 }, { t: 'olay', w: 21 }, { t: 'elit', w: 14 },
      { t: 'dukkan', w: 9 }, { t: 'dinlenme', w: 15 }
    ];
    for (i = 0; i < KAT_SAYISI; i++) {
      for (j = 0; j < katlar[i].length; j++) {
        var d = katlar[i][j];
        if (i === PATRON_KATI) { d.tip = 'patron'; continue; }
        if (i === DINLENME_KATI) { d.tip = 'dinlenme'; continue; }
        if (i === HAZINE_KATI) { d.tip = 'hazine'; continue; }
        if (i <= 1) { d.tip = 'savas'; continue; }

        var tip = null;
        for (var deneme = 0; deneme < 8; deneme++) {
          var aday = rng.weighted(AGIRLIK).t;
          if ((aday === 'elit' || aday === 'dinlenme') && i < 5) continue;
          if (aday === 'dinlenme' && i === DINLENME_KATI - 1) continue;
          if (aday === 'dukkan' || aday === 'dinlenme' || aday === 'elit') {
            // Aynı tip ebeveynden hemen sonra gelmesin
            var cakisma = false;
            for (var e = 0; e < d.ebeveynler.length; e++) {
              if (katlar[i - 1][d.ebeveynler[e]].tip === aday) { cakisma = true; break; }
            }
            if (cakisma) continue;
          }
          tip = aday; break;
        }
        d.tip = tip || 'savas';
      }
    }

    // Garanti: 5–12 katları arasında en az 2 dinlenme ve 1 dükkan olsun.
    // Yoksa koşunun can ekonomisi tohuma göre kabul edilemez ölçüde dalgalanıyor.
    function sayEt(tip) {
      var n = 0, a, b;
      for (a = 5; a <= 12; a++)
        for (b = 0; b < katlar[a].length; b++) if (katlar[a][b].tip === tip) n++;
      return n;
    }
    function donustur(tip, adet) {
      var aday = [], a, b;
      for (a = 5; a <= 12; a++)
        for (b = 0; b < katlar[a].length; b++) {
          var dd = katlar[a][b];
          if (dd.tip === 'savas' || dd.tip === 'olay') aday.push(dd);
        }
      aday = rng.shuffle(aday);
      for (var i = 0; i < adet && i < aday.length; i++) aday[i].tip = tip;
    }
    var eksik = 2 - sayEt('dinlenme');
    if (eksik > 0) donustur('dinlenme', eksik);
    if (sayEt('dukkan') < 1) donustur('dukkan', 1);

    // Her düğümün içeriğini ŞİMDİ üret. Odaya girildiğinde üretilseydi
    // içerik oyuncunun izlediği yola ve savaşta harcadığı rastgeleliğe
    // bağlı olurdu; böylece "aynı tohum = aynı dünya" gerçekten geçerli.
    // `iz[kat][idx]` = o düğüme gelen yollarda görülen son iki karşılaşma.
    // Savaş olmayan odalar (olay, kamp, dükkan) izi kendileri taşır; yoksa
    // araya bir olay girdiğinde aynı savaş iki kez çıkabiliyordu.
    // Düğümlerin kendisinde tutulmuyor çünkü kayda yazılması gereksiz.
    var iz = [];
    for (i = 0; i < KAT_SAYISI; i++) {
      iz.push([]);
      for (j = 0; j < katlar[i].length; j++) {
        var dg = katlar[i][j];
        var yakin = [], uzak = [];
        for (var e1 = 0; e1 < dg.ebeveynler.length; e1++) {
          var ebIdx = dg.ebeveynler[e1];
          var eb = katlar[i - 1][ebIdx];
          var ebIz = iz[i - 1][ebIdx] || { yakin: [], uzak: [] };
          if (eb.icerik && eb.icerik.karsilasma) {
            yakin.push(eb.icerik.karsilasma.id);
            uzak = uzak.concat(ebIz.yakin);
          } else {                       // savaş değil: izi olduğu gibi aktar
            yakin = yakin.concat(ebIz.yakin);
            uzak = uzak.concat(ebIz.uzak);
          }
        }
        iz[i].push({ yakin: yakin, uzak: uzak });
        dg.icerik = this.icerikUret(dg, perde, { yakin: yakin, uzak: uzak });
      }
    }

    return { perde: perde, katlar: katlar };
  };

  /** Şu an gidilebilecek düğümler */
  Run.prototype.acikDugumler = function () {
    if (!this.harita) return [];
    if (this.kat < 0) return this.harita.katlar[0].slice();
    if (this.kat >= KAT_SAYISI - 1) return [];
    var d = this.harita.katlar[this.kat][this.dugumIdx];
    var out = [];
    for (var i = 0; i < d.cocuklar.length; i++)
      out.push(this.harita.katlar[this.kat + 1][d.cocuklar[i]]);
    return out;
  };

  Run.prototype.dugum = function () {
    if (this.kat < 0) return null;
    return this.harita.katlar[this.kat][this.dugumIdx];
  };

  /** Bir düğüme gir — içeriğini üretir ve döndürür */
  Run.prototype.dugumeGir = function (kat, idx) {
    this.kat = kat;
    this.dugumIdx = idx;
    var d = this.harita.katlar[kat][idx];
    d.ziyaret = true;
    this.gecilenler.push({ kat: kat, idx: idx });
    // İçerik harita üretilirken hazırlanır; bu yalnızca eski kayıtlar için yedek
    if (!d.icerik) d.icerik = this.icerikUret(d);
    if (d.icerik && d.icerik.dukkan) this.dukkanFiyatlariTazele(d.icerik.dukkan);
    return d;
  };

  Run.prototype.icerikUret = function (d, perde, haric) {
    perde = perde || this.perde;
    switch (d.tip) {
      case 'savas':   return { karsilasma: this.karsilasmaSec(d.kat < 4 ? 'zayif' : 'normal', perde, haric) };
      case 'elit':    return { karsilasma: this.karsilasmaSec('elit', perde, haric) };
      case 'patron':  return { karsilasma: this.karsilasmaSec('patron', perde, haric) };
      case 'olay':    return { olay: this.olaySec(perde) };
      case 'dukkan':  return { dukkan: this.dukkanUret() };
      case 'hazine':  return { acildi: false };
      default:        return {};
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Karşılaşma seçimi                                                  */
  /* ------------------------------------------------------------------ */

  Run.prototype.karsilasmaSec = function (tur, perde, haric) {
    var rng = this.rng.s('oda');
    var tablo = global.KARSILASMALAR[perde || this.perde];
    var havuz = tablo[tur] || tablo.normal;
    if (tur === 'zayif' && (!havuz || !havuz.length)) havuz = tablo.normal;

    // `haric.yakin` = doğrudan ebeveynlerin karşılaşmaları (art arda tekrar
    // KESİNLİKLE olmasın), `haric.uzak` = büyükebeveynler (tercihen olmasın).
    // İçerik kat sırasına göre üretildiği için düz bir "son N" listesi bir
    // yol boyunca tekrarı engellemiyordu.
    haric = haric || {};
    var yakin = haric.yakin || [], uzak = haric.uzak || [];
    function suz(disla) {
      var o = [];
      for (var k = 0; k < havuz.length; k++)
        if (disla.indexOf(havuz[k].id) < 0) o.push(havuz[k]);
      return o;
    }
    var aday = suz(yakin.concat(uzak));
    if (!aday.length) aday = suz(yakin);      // en azından ebeveyni tekrarlama
    if (!aday.length) aday = havuz;

    var sec = rng.pick(aday);

    // Düşman canları da BURADA belirlenir. Savaş açılırken atılsaydı savaş
    // akışına bağlı kalır, aynı tohumda farklı canlar çıkardı.
    var z = global.ZORLUKLAR[this.zorluk] || global.ZORLUKLAR[0];
    var hpler = [];
    for (var j = 0; j < sec.dusmanlar.length; j++) {
      var def = global.DUSMANLAR[sec.dusmanlar[j]];
      var hp = rng.range(def.hp[0], def.hp[1]);
      hpler.push(Math.round(hp * ((def.elit || def.patron) ? z.elitHp : z.dusmanHp)));
    }

    return { id: sec.id, tur: tur === 'zayif' ? 'normal' : tur,
             dusmanlar: sec.dusmanlar.slice(), hpler: hpler };
  };

  Run.prototype.olaySec = function (perde) {
    var rng = this.rng.s('oda');
    var havuz = global.olayHavuzu(perde || this.perde);
    var gorulen = this.gorulenOlaylar || (this.gorulenOlaylar = []);
    var aday = [];
    for (var i = 0; i < havuz.length; i++)
      if (gorulen.indexOf(havuz[i]) < 0) aday.push(havuz[i]);
    if (!aday.length) { aday = havuz; gorulen.length = 0; }
    var id = rng.pick(aday);
    gorulen.push(id);
    return id;
  };

  /* ------------------------------------------------------------------ */
  /*  Kart ödülleri                                                      */
  /* ------------------------------------------------------------------ */

  var ODUL_AGIRLIK = {
    normal: { siradan: 64, nadir: 30, efsanevi: 6 },
    elit:   { siradan: 48, nadir: 39, efsanevi: 13 },
    patron: { siradan: 0,  nadir: 66, efsanevi: 34 }
  };

  Run.prototype.kartOdulleri = function (n, tur) {
    var rng = this.rng.s('kart');
    var ag = ODUL_AGIRLIK[tur] || ODUL_AGIRLIK.normal;
    var secilen = [];
    var deneme = 0;
    while (secilen.length < n && deneme < 120) {
      deneme++;
      var r = rng.next() * (ag.siradan + ag.nadir + ag.efsanevi);
      var nad = r < ag.siradan ? 'siradan' : (r < ag.siradan + ag.nadir ? 'nadir' : 'efsanevi');
      var havuz = global.kartHavuzu(nad);
      if (!havuz.length) continue;
      var id = rng.pick(havuz);
      if (secilen.indexOf(id) >= 0) continue;
      secilen.push(id);
    }
    return secilen;
  };

  /* ------------------------------------------------------------------ */
  /*  Yadigâr havuzu (tekrarsız)                                         */
  /* ------------------------------------------------------------------ */

  Run.prototype.yadigarSec = function (nadirlik) {
    var rng = this.rng.s('yadigar');
    // Doğrudan id verildiyse onu kullan
    if (global.YADIGARLAR[nadirlik]) {
      return this.yadigarVar(nadirlik) ? this.yadigarSec('nadir') : nadirlik;
    }
    var sira = nadirlik === 'efsanevi' ? ['efsanevi', 'nadir', 'siradan']
             : nadirlik === 'nadir'    ? ['nadir', 'siradan', 'efsanevi']
             : nadirlik === 'patron'   ? ['patron']
             :                           ['siradan', 'nadir', 'efsanevi'];
    for (var s = 0; s < sira.length; s++) {
      var havuz = global.yadigarHavuzu(sira[s]);
      var aday = [];
      for (var i = 0; i < havuz.length; i++) if (!this.yadigarVar(havuz[i])) aday.push(havuz[i]);
      if (aday.length) return rng.pick(aday);
    }
    return null;
  };

  /** Rastgele yadigâr — hazine/ödül için nadirlik dağılımı */
  Run.prototype.rastgeleYadigar = function () {
    var rng = this.rng.s('yadigar');
    var t = rng.next() * 100;
    var nad = t < 50 ? 'siradan' : (t < 88 ? 'nadir' : 'efsanevi');
    return this.yadigarSec(nad);
  };

  /* ------------------------------------------------------------------ */
  /*  Savaş sonu ödülleri                                                */
  /* ------------------------------------------------------------------ */

  Run.prototype.savasOdulu = function (karsilasma) {
    var rng = this.rng.s('kart');
    var tur = karsilasma.tur;
    var oduller = [];

    var altin;
    if (tur === 'patron') altin = rng.range(95, 120);
    else if (tur === 'elit') altin = rng.range(32, 48);
    else altin = rng.range(12, 22);
    altin = this.kMod('altinCarpani', altin);
    oduller.push({ tip: 'altin', miktar: altin });

    var iksirSansi = tur === 'patron' ? 100 : (tur === 'elit' ? 60 : 40);
    if (rng.chance(iksirSansi)) {
      oduller.push({ tip: 'iksir', id: global.rastgeleIksir(rng) });
    }

    oduller.push({ tip: 'kart', kartlar: this.kartOdulleri(3, tur) });

    if (tur === 'elit') {
      var y = this.rastgeleYadigar();
      if (y) oduller.push({ tip: 'yadigar', id: y });
    }
    if (tur === 'patron') {
      var secenekler = [];
      var havuz = global.yadigarHavuzu('patron');
      for (var i = 0; i < havuz.length; i++) if (!this.yadigarVar(havuz[i])) secenekler.push(havuz[i]);
      secenekler = rng.sample(secenekler, 3);
      if (secenekler.length) oduller.push({ tip: 'yadigarSecim', idler: secenekler });
    }

    this.ist.savas++;
    if (tur === 'elit') this.ist.elit++;
    this.kTrig('savasSonu');
    return oduller;
  };

  /* ------------------------------------------------------------------ */
  /*  Dükkan                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Dükkan stoğu harita üretilirken belirlenir (tohuma bağlı, yola bağlı değil).
   * Fiyatlar TABAN olarak saklanır; indirim yadigârı sonradan alınabildiği için
   * gerçek fiyat dükkana girerken hesaplanır.
   */
  Run.prototype.dukkanUret = function () {
    var rng = this.rng.s('oda');
    var i;
    var kartlar = [];
    var nadirlikler = ['siradan', 'siradan', 'siradan', 'nadir', 'nadir', 'efsanevi'];
    var kullanilan = [];
    for (i = 0; i < nadirlikler.length; i++) {
      var havuz = global.kartHavuzu(nadirlikler[i]);
      var aday = [];
      for (var j = 0; j < havuz.length; j++) if (kullanilan.indexOf(havuz[j]) < 0) aday.push(havuz[j]);
      if (!aday.length) continue;
      var id = rng.pick(aday);
      kullanilan.push(id);
      var taban = nadirlikler[i] === 'siradan' ? rng.range(45, 62)
                : nadirlikler[i] === 'nadir'   ? rng.range(72, 96)
                :                                rng.range(125, 165);
      kartlar.push({ id: id, tabanFiyat: taban, fiyat: taban, satildi: false });
    }

    var iksirler = [];
    for (i = 0; i < 3; i++) {
      var iid = global.rastgeleIksir(rng);
      var idef = global.IKSIRLER[iid];
      var ifiyat = idef.nadirlik === 'siradan' ? rng.range(45, 62)
                 : idef.nadirlik === 'nadir'   ? rng.range(68, 88)
                 :                               rng.range(95, 125);
      iksirler.push({ id: iid, tabanFiyat: ifiyat, fiyat: ifiyat, satildi: false });
    }

    var yadigarlar = [];
    for (i = 0; i < 2; i++) {
      var yid = i === 0 ? this.yadigarSec('siradan') : this.yadigarSec('nadir');
      if (!yid) continue;
      var yfiyat = global.YADIGARLAR[yid].nadirlik === 'siradan' ? rng.range(145, 185)
                 : global.YADIGARLAR[yid].nadirlik === 'nadir'   ? rng.range(210, 270)
                 :                                                 rng.range(300, 360);
      yadigarlar.push({ id: yid, tabanFiyat: yfiyat, fiyat: yfiyat, satildi: false });
    }
    // Dükkan özel yadigârı ara sıra
    if (rng.chance(35)) {
      var ozel = this.yadigarSec('dukkan');
      var dukHavuz = global.yadigarHavuzu('dukkan'), bulundu = null;
      for (i = 0; i < dukHavuz.length; i++) if (!this.yadigarVar(dukHavuz[i])) { bulundu = dukHavuz[i]; break; }
      if (bulundu) {
        var ozelFiyat = rng.range(200, 250);
        yadigarlar.push({ id: bulundu, tabanFiyat: ozelFiyat, fiyat: ozelFiyat,
                          satildi: false });
      }
    }

    return { kartlar: kartlar, iksirler: iksirler, yadigarlar: yadigarlar,
             silmeYapildi: false };
  };

  /**
   * Dükkana girerken gerçek fiyatları hesapla. Stok tohuma bağlı sabittir ama
   * indirim yadigârı sonradan alınmış olabilir; ayrıca başka bir yerden
   * edinilmiş yadigâr raftaysa satıştan kaldırılır.
   */
  Run.prototype.dukkanFiyatlariTazele = function (d) {
    if (!d) return;
    var self = this;
    function tazele(liste, yadigarMi) {
      for (var i = 0; i < liste.length; i++) {
        var u = liste[i];
        if (u.tabanFiyat === undefined) u.tabanFiyat = u.fiyat;   // eski kayıtlar
        u.fiyat = self.kMod('fiyatCarpani', u.tabanFiyat);
        if (yadigarMi && self.yadigarVar(u.id)) u.satildi = true;
      }
    }
    tazele(d.kartlar, false);
    tazele(d.iksirler, false);
    tazele(d.yadigarlar, true);
  };

  Run.prototype.silmeFiyati = function () {
    return this.kMod('fiyatCarpani', this.silmeUcreti);
  };

  /** Dükkanda kart sildirme — ücreti alır ve bir sonraki silmeyi pahalılaştırır */
  Run.prototype.kartSilmeSatinAl = function (kart) {
    var f = this.silmeFiyati();
    if (this.altin < f) return false;
    if (!this.kartSil(kart)) return false;
    this.altin -= f;
    this.silmeUcreti += 15;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  Dinlenme                                                           */
  /* ------------------------------------------------------------------ */

  Run.prototype.dinlenmeMiktari = function () {
    var taban = Math.floor(this.maxHp * 0.36);
    return Math.floor(this.kMod('dinlenmeCarpani', taban));
  };

  Run.prototype.dinlenmeYukseltmeSayisi = function () {
    return this.yadigarVar('bilgelik_kitabi') ? 2 : 1;
  };

  /* ------------------------------------------------------------------ */
  /*  Perde geçişi                                                       */
  /* ------------------------------------------------------------------ */

  Run.prototype.sonrakiPerde = function () {
    if (this.perde >= 3) { this.oyunSonu = 'zafer'; return false; }
    this.perde++;
    this.kat = -1;
    this.dugumIdx = -1;
    this.sonKarsilasmalar = [];              // haritaUret içerik de ürettiği için önce sıfırla
    this.harita = this.haritaUret(this.perde);
    this.iyilestir(Math.floor(this.maxHp * 0.40));
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  Olay API'si                                                        */
  /* ------------------------------------------------------------------ */

  Run.prototype.olayApi = function () {
    var run = this;
    return {
      kartSec: function (baslik, filtre, cb) {
        run.akis.push({ tip: 'kartSec', baslik: baslik, filtre: filtre, cb: cb });
      },
      kartOdul: function (idler) {
        if (idler && idler.length) run.akis.push({ tip: 'kartOdul', kartlar: idler });
      },
      yadigar: function (nadirlik) {
        var id = run.yadigarSec(nadirlik);
        if (id) run.yadigarEkle(id);
      },
      iksir: function (n) {
        for (var i = 0; i < (n || 1); i++) {
          var id = global.rastgeleIksir(run.rng.s('iksir'));
          if (!run.iksirEkle(id)) run.akis.push({ tip: 'iksirDolu', id: id });
        }
      }
    };
  };

  Run.prototype.olayUygula = function (olayId, secenekIdx) {
    var olay = global.OLAYLAR[olayId];
    var sec = olay.secenekler[secenekIdx];
    var api = this.olayApi();
    var metin = sec.ol(this, api);
    return metin || '';
  };

  /* ------------------------------------------------------------------ */
  /*  Kayıt / yükleme                                                    */
  /* ------------------------------------------------------------------ */

  Run.prototype.kaydet = function () {
    var i, j;
    var harita = { perde: this.harita.perde, katlar: [] };
    for (i = 0; i < this.harita.katlar.length; i++) {
      var kat = [];
      for (j = 0; j < this.harita.katlar[i].length; j++) {
        var d = this.harita.katlar[i][j];
        kat.push({ kat: d.kat, idx: d.idx, tip: d.tip, cocuklar: d.cocuklar,
                   ebeveynler: d.ebeveynler, x: d.x, y: d.y,
                   icerik: d.icerik, ziyaret: d.ziyaret });
      }
      harita.katlar.push(kat);
    }
    return {
      s: 2,
      tohum: this.tohum, zorluk: this.zorluk,
      rng: this.rng.save(),
      maxHp: this.maxHp, hp: this.hp, altin: this.altin,
      perde: this.perde, kat: this.kat, dugumIdx: this.dugumIdx,
      harita: harita, gecilenler: this.gecilenler,
      deste: global.U.clone(this.deste),
      yadigarlar: global.U.clone(this.yadigarlar),
      iksirYuva: this.iksirYuva, iksirler: global.U.clone(this.iksirler),
      silmeUcreti: this.silmeUcreti,
      sonKarsilasmalar: this.sonKarsilasmalar,
      gorulenOlaylar: this.gorulenOlaylar || [],
      ist: this.ist,
      uid: global.U.uidState()
    };
  };

  Run.yukle = function (d) {
    var r = Object.create(Run.prototype);
    r.tohum = d.tohum;
    r.zorluk = d.zorluk || 0;
    r.rng = global.RNG.fromSave(d.rng);
    r.maxHp = d.maxHp; r.hp = d.hp; r.altin = d.altin;
    r.perde = d.perde; r.kat = d.kat; r.dugumIdx = d.dugumIdx;
    r.harita = d.harita;
    r.gecilenler = d.gecilenler || [];
    r.deste = d.deste;
    r.yadigarlar = d.yadigarlar;
    r.iksirYuva = d.iksirYuva; r.iksirler = d.iksirler;
    r.silmeUcreti = d.silmeUcreti || 70;
    r.sonKarsilasmalar = d.sonKarsilasmalar || [];
    r.gorulenOlaylar = d.gorulenOlaylar || [];
    r.ist = d.ist || { savas: 0, elit: 0, oldurulen: 0, altinKazanc: 0,
                       enBuyukVurus: 0, tur: 0, oynananKart: 0 };
    r.gecici = {};
    r.akis = [];
    r.oyunSonu = null;
    if (d.uid) global.U.resetUid(d.uid);
    return r;
  };

  global.Run = Run;
  global.ZORLUKLAR = ZORLUKLAR;
  global.KAT_SAYISI = KAT_SAYISI;
})(typeof window !== 'undefined' ? window : globalThis);
