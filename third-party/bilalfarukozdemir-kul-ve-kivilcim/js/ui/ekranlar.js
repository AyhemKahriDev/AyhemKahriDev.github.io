/* =========================================================================
   EKRANLAR — üst çubuk, ödüller, dükkan, kamp, olay, deste, oyun sonu
   ========================================================================= */
(function (global) {
  'use strict';

  var U = global.U;
  var run = null;
  // Yeni gelen iksiri vurgulamak için bir önceki durumu tutuyoruz
  var oncekiIksirler = [];

  function kosuAyarla(r) { run = r; }

  /* ================================================================== */
  /*  ÜST ÇUBUK                                                          */
  /* ================================================================== */

  function ustTazele() {
    if (!run) return;
    var cubuk = document.getElementById('ustCubuk');
    cubuk.hidden = false;

    var savas = global.aktifSavas;
    var hp = savas ? savas.p.hp : run.hp;
    var maxHp = savas ? savas.p.maxHp : run.maxHp;

    var canEl = document.getElementById('ucCan');
    canEl.querySelector('b').textContent = hp;
    canEl.querySelector('i').textContent = '/' + maxHp;
    canEl.classList.toggle('dusuk', hp / maxHp <= 0.3);

    document.getElementById('ucAltin').querySelector('b').textContent = run.altin;

    var yer = document.getElementById('ucYer');
    yer.textContent = global.T('Perde') + ' ' + run.perde + ' · ' +
                      global.T('Kat') + ' ' + (run.kat < 0 ? 0 : run.kat + 1);

    // Yadigârlar
    var yk = document.getElementById('ucYadigarlar');
    U.clear(yk);
    run.yadigarlar.forEach(function (r) {
      var def = global.YADIGARLAR[r.id];
      if (!def) return;
      var el = U.el('div', 'yadigar-rozet', def.ikon);
      el.dataset.id = r.id;
      global.Ipucu.bagla(el, function () {
        return { baslik: global.DIL.v('yadigar', r.id, 'ad', def.ad),
                 metin: global.DIL.v('yadigar', r.id, 'metin', def.metin),
                 alt: global.T(NADIRLIK_AD[def.nadirlik] || '') };
      });
      yk.appendChild(el);
    });

    // İksirler — boş yuva da kendini anlatsın, yeni gelen kendini duyursun
    var ik = document.getElementById('ucIksirler');
    var savasta = global.SavasEkrani.aktifMi();
    U.clear(ik);
    run.iksirler.forEach(function (slot, i) {
      var el = U.el('div', 'iksir-yuva');
      if (slot) {
        var def = global.IKSIRLER[slot.id];
        el.classList.add('dolu');
        if (savasta) el.classList.add('kullanilabilir');
        el.textContent = def.ikon;
        if (oncekiIksirler[i] !== slot.id) el.classList.add('yeni');
        global.Ipucu.bagla(el, function () {
          return { baslik: global.DIL.v('iksir', slot.id, 'ad', def.ad),
                   metin: global.DIL.v('iksir', slot.id, 'metin', def.metin),
                   alt: global.T(global.SavasEkrani.aktifMi()
                        ? 'Kullanmak için tıkla — bedelsiz, sıra harcamaz'
                        : 'Yalnızca savaşta kullanılır') };
        });
        el.onclick = function () {
          if (global.SavasEkrani.aktifMi()) {
            global.SavasEkrani.iksirTikla(i);
          } else {
            global.Pencere.onay(global.T('İksiri at?'),
              global.DIL.v('iksir', slot.id, 'ad', def.ad) + ' ' + global.T('atılacak. Emin misin?'),
              global.T('At'),
              function () { run.iksirler[i] = null; ustTazele(); });
          }
        };
      } else {
        el.classList.add('bos');
        global.Ipucu.bagla(el, function () {
          return { baslik: global.T('Boş iksir yuvası'),
                   metin: global.T('İksirler savaş ödüllerinden, dükkandan ve olaylardan gelir.'),
                   alt: global.T('Savaşta tıklayarak bedelsiz kullanılır; enerji ya da sıra harcamaz.') };
        });
      }
      ik.appendChild(el);
    });
    oncekiIksirler = run.iksirler.map(function (s) { return s ? s.id : null; });
  }

  /* ================================================================== */
  /*  İKSİR AL / YERİNE KOY                                              */
  /* ================================================================== */

  /**
   * İksiri alır. Yuva doluysa oyuncuya hangisini bırakacağını sorar.
   * @param bitince(alindiMi)
   */
  function iksirAl(id, bitince) {
    if (run.iksirEkle(id)) {
      global.SES.dugme(); ustTazele();
      if (bitince) bitince(true);
      return;
    }
    var yeni = global.IKSIRLER[id];
    var kap = U.el('div');
    kap.innerHTML = '<p style="text-align:center;color:#cfc4b8;line-height:1.7;margin-bottom:16px">' +
      global.T('Yuvaların dolu.') + ' <b style="color:var(--kor3)">' + yeni.ikon + ' ' +
      global.DIL.v('iksir', id, 'ad', yeni.ad) + '</b> ' +
      global.T('için birini bırakabilirsin.') + '</p>';
    var raf = U.el('div', 'dukkan-raf');
    raf.style.justifyContent = 'center';
    run.iksirler.forEach(function (slot, i) {
      if (!slot) return;
      var def = global.IKSIRLER[slot.id];
      var saran = U.el('div', 'satilik');
      var sey = U.el('div', 'satilik-sey', def.ikon);
      global.Ipucu.bagla(sey, function () {
        return { baslik: global.DIL.v('iksir', slot.id, 'ad', def.ad),
                 metin: global.DIL.v('iksir', slot.id, 'metin', def.metin) }; });
      var etiket = U.el('div', 'fiyat', global.DIL.v('iksir', slot.id, 'ad', def.ad));
      etiket.style.color = 'var(--kul2)';
      saran.appendChild(sey); saran.appendChild(etiket);
      sey.onclick = function () {
        run.iksirler[i] = { id: id };
        global.SES.dugme();
        global.Pencere.kapat();
        ustTazele();
        if (bitince) bitince(true);
      };
      raf.appendChild(saran);
    });
    kap.appendChild(raf);

    global.Pencere.ac({
      baslik: global.T('İksir yuvan dolu'), genislik: 'dar', govde: kap,
      kapatilabilir: false, xIle: false,
      dugmeler: [{ yazi: global.T('Yeni iksiri bırak'),
                   ol: function () { if (bitince) bitince(false); } }]
    });
  }

  var NADIRLIK_AD = {
    baslangic: 'Başlangıç', siradan: 'Sıradan', nadir: 'Nadir',
    efsanevi: 'Efsanevi', patron: 'Patron yadigârı', dukkan: 'Dükkan',
    ozel: 'Özel'
  };

  /* ================================================================== */
  /*  AKIŞ KUYRUĞU (olayların istediği arayüz adımları)                  */
  /* ================================================================== */

  function akisiIsle(bitince) {
    if (!run.akis.length) { if (bitince) bitince(); return; }
    var a = run.akis.shift();

    if (a.tip === 'kartSec') {
      kartSec(a.baslik, run.deste.filter(a.filtre), function (k) {
        if (k) a.cb(k);
        akisiIsle(bitince);
      }, true);
      return;
    }
    if (a.tip === 'kartOdul') {
      kartOdulSec(a.kartlar, function () { akisiIsle(bitince); }, true);
      return;
    }
    if (a.tip === 'yadigarAlindi') {
      yadigarGoster(a.id, function () { akisiIsle(bitince); });
      return;
    }
    if (a.tip === 'iksirDolu') {
      iksirAl(a.id, function () { akisiIsle(bitince); });
      return;
    }
    akisiIsle(bitince);
  }

  /* ================================================================== */
  /*  YADİGÂR GÖSTERİMİ                                                  */
  /* ================================================================== */

  function yadigarGoster(id, bitince) {
    var def = global.YADIGARLAR[id];
    global.SES.yadigar();
    var kap = U.el('div');
    kap.style.textAlign = 'center';
    kap.innerHTML =
      '<div style="font-size:58px;margin-bottom:8px;filter:drop-shadow(0 0 22px rgba(251,191,36,.55))">' +
      def.ikon + '</div>' +
      '<div style="font-family:var(--serif);font-size:22px;color:#ffe0b0;margin-bottom:4px">' +
      global.DIL.v('yadigar', id, 'ad', def.ad) + '</div>' +
      '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--kul2);margin-bottom:14px">' +
      global.T(NADIRLIK_AD[def.nadirlik] || '') + '</div>' +
      '<div style="font-size:14px;line-height:1.7;color:#ddd0c2;max-width:44ch;margin:0 auto">' +
      global.DIL.v('yadigar', id, 'metin', def.metin) + '</div>';
    global.Pencere.ac({
      baslik: global.T('Yadigâr'), genislik: 'dar', govde: kap, kapatilabilir: false, xIle: false,
      dugmeler: [{ yazi: global.T('Al'), sinif: 'birincil', ol: function () { ustTazele(); if (bitince) bitince(); } }]
    });
  }

  /* ================================================================== */
  /*  KART SEÇİMİ (desteden)                                             */
  /* ================================================================== */

  function kartSec(baslik, kartlar, cb, zorunlu) {
    if (!kartlar.length) { cb(null); return; }
    var kap = U.el('div', 'deste-izgara');
    kartlar.forEach(function (k) {
      var saran = U.el('div', 'odul-kart');
      saran.appendChild(global.KartUI.olustur(k, { boy: 'kucuk', tiklanir: true }));
      saran.onclick = function () {
        global.SES.dugme();
        global.Pencere.kapat();
        cb(k);
      };
      kap.appendChild(saran);
    });
    global.Pencere.ac({
      baslik: global.T(baslik), govde: kap, genislik: 'genis',
      kapatilabilir: !zorunlu, xIle: !zorunlu,
      dugmeler: zorunlu ? [] : [{ yazi: global.T('Vazgeç'), ol: function () { cb(null); } }]
    });
  }

  /* ================================================================== */
  /*  KART ÖDÜLÜ                                                         */
  /* ================================================================== */

  function kartOdulSec(idler, bitince, zorunlu) {
    var kap = U.el('div');
    kap.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap';
    idler.forEach(function (id) {
      var kart = global.yeniKart(id, false);
      var saran = U.el('div', 'odul-kart');
      saran.appendChild(global.KartUI.olustur(kart, { tiklanir: true }));
      saran.onclick = function () {
        global.SES.yukselt();
        global.Pencere.kapat();
        run.deste.push(kart);
        var m = global.FX.merkez(saran);
        global.FX.kivilcim(m.x, m.y, 26);
        if (bitince) bitince(kart);
      };
      kap.appendChild(saran);
    });
    global.Pencere.ac({
      baslik: global.T('Bir kart seç'), govde: kap, genislik: 'genis',
      kapatilabilir: false, xIle: false,
      dugmeler: zorunlu ? [] : [{ yazi: global.T('Hiçbirini alma'),
                                  ol: function () { if (bitince) bitince(null); } }]
    });
  }

  /* ================================================================== */
  /*  SAVAŞ ÖDÜLLERİ                                                     */
  /* ================================================================== */

  function odulEkrani(oduller, bitince) {
    var alinan = {};

    function govde() {
      var kap = U.el('div', 'odul-liste');
      oduller.forEach(function (o, i) {
        var b = U.el('button', 'odul' + (alinan[i] ? ' alindi' : ''));
        var ikon = '', ad = '', alt = '';
        if (o.tip === 'altin') { ikon = '🪙'; ad = o.miktar + ' ' + global.T('altın'); }
        else if (o.tip === 'iksir') {
          var pd = global.IKSIRLER[o.id]; ikon = pd.ikon;
          ad = global.DIL.v('iksir', o.id, 'ad', pd.ad);
          alt = global.DIL.v('iksir', o.id, 'metin', pd.metin);
        } else if (o.tip === 'kart') { ikon = '🂠'; ad = global.T('Kart ödülü');
                                       alt = global.T('3 kart arasından seç'); }
        else if (o.tip === 'yadigar') {
          var yd = global.YADIGARLAR[o.id]; ikon = yd.ikon;
          ad = global.DIL.v('yadigar', o.id, 'ad', yd.ad);
          alt = global.DIL.v('yadigar', o.id, 'metin', yd.metin);
        } else if (o.tip === 'yadigarSecim') { ikon = '👑'; ad = global.T('Patron yadigârı');
                                               alt = global.T('Üçünden birini seç'); }

        b.innerHTML = '<span class="o-ikon">' + ikon + '</span>' +
                      '<span class="o-ad">' + ad + (alt ? '<small>' + alt + '</small>' : '') + '</span>' +
                      (alinan[i] ? '<span style="color:var(--yesil)">✓</span>' : '');
        if (!alinan[i]) {
          b.onclick = function () { odulAl(o, i); };
        }
        kap.appendChild(b);
      });
      return kap;
    }

    function odulAl(o, i) {
      if (o.tip === 'altin') {
        run.altinEkle(o.miktar); alinan[i] = true;
        global.SES.altin(); ustTazele(); global.Pencere.tazele();
      } else if (o.tip === 'iksir') {
        if (run.iksirYuvaBos()) {
          run.iksirEkle(o.id);
          alinan[i] = true; global.SES.dugme(); ustTazele(); global.Pencere.tazele();
        } else {
          global.Pencere.kapat();
          iksirAl(o.id, function (alindiMi) {
            if (alindiMi) alinan[i] = true;
            ac();
          });
        }
      } else if (o.tip === 'kart') {
        global.Pencere.kapat();
        kartOdulSec(o.kartlar, function () {
          alinan[i] = true;
          ac();
        });
      } else if (o.tip === 'yadigar') {
        alinan[i] = true;
        global.Pencere.kapat();
        run.yadigarEkle(o.id);
        akisiIsle(function () { ac(); });
      } else if (o.tip === 'yadigarSecim') {
        global.Pencere.kapat();
        yadigarSecimEkrani(o.idler, function () { alinan[i] = true; ac(); });
      }
    }

    function hepsiAlindiMi() {
      return oduller.every(function (o, i) { return alinan[i]; });
    }

    function ac() {
      global.Pencere.ac({
        baslik: global.T('Zafer'), not: global.T('Ödülleri al'),
        govde: govde(), tazele: govde,
        kapatilabilir: false, xIle: false,
        dugmeler: [{
          yazi: global.T(hepsiAlindiMi() ? 'Devam' : 'Kalanları bırak ve devam et'),
          sinif: 'birincil',
          ol: function () { if (bitince) bitince(); }
        }]
      });
    }
    ac();
  }

  function yadigarSecimEkrani(idler, bitince) {
    var kap = U.el('div');
    kap.style.cssText = 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap';
    idler.forEach(function (id) {
      var def = global.YADIGARLAR[id];
      var b = U.el('button', 'secenek');
      b.style.cssText = 'width:230px;align-items:center;text-align:center';
      b.innerHTML = '<div style="font-size:38px">' + def.ikon + '</div>' +
                    '<b style="font-family:var(--serif);font-size:16px">' +
                    global.DIL.v('yadigar', id, 'ad', def.ad) + '</b>' +
                    '<span style="font-size:12.5px;color:#cfc4b8;line-height:1.55">' +
                    global.DIL.v('yadigar', id, 'metin', def.metin) + '</span>';
      b.onclick = function () {
        global.Pencere.kapat();
        run.yadigarEkle(id);
        akisiIsle(function () { ustTazele(); if (bitince) bitince(); });
      };
      kap.appendChild(b);
    });
    global.Pencere.ac({
      baslik: global.T('Patron yadigârı — birini seç'), govde: kap, genislik: 'genis',
      kapatilabilir: false, xIle: false
    });
  }

  /* ================================================================== */
  /*  HAZİNE                                                             */
  /* ================================================================== */

  function hazineEkrani(bitince) {
    var y = run.rastgeleYadigar();
    var altin = run.rng.s('yadigar').range(30, 70);
    var kap = U.el('div');
    kap.style.textAlign = 'center';
    kap.innerHTML = '<div style="font-size:64px;margin-bottom:10px">📦</div>' +
      '<p style="font-family:var(--serif);font-size:15.5px;color:#ddd0c2;line-height:1.7">' +
      global.T('Küllerin altında, kilidi çoktan erimiş bir sandık.') + '</p>';
    global.Pencere.ac({
      baslik: global.T('Hazine'), genislik: 'dar', govde: kap, kapatilabilir: false, xIle: false,
      dugmeler: [{
        yazi: global.T('Sandığı aç'), sinif: 'birincil',
        ol: function () {
          run.altinEkle(altin);
          global.SES.altin();
          if (y) { run.yadigarEkle(y); akisiIsle(function () { ustTazele(); bitince(); }); }
          else { ustTazele(); bitince(); }
        }
      }]
    });
  }

  /* ================================================================== */
  /*  KAMP (dinlenme)                                                    */
  /* ================================================================== */

  function dinlenmeEkrani(bitince) {
    var iyilesme = run.dinlenmeMiktari();
    var yukseltmeSayisi = run.dinlenmeYukseltmeSayisi();
    var yukseltilebilir = run.deste.filter(global.yukseltilebilir);

    var kap = U.el('div');
    kap.innerHTML = '<div class="olay-art">🏕️</div>' +
      '<p class="olay-metin">' + global.T('Ateşin başında bir mola. Ne yaparsan yap, ' +
      'sabah olduğunda yolun geri kalanı seni bekliyor olacak.') + '</p>';

    var liste = U.el('div', 'secenek-liste');

    var dinlen = U.el('button', 'secenek');
    dinlen.innerHTML = '<b>🔥 ' + global.T('Dinlen') + '</b><i>' +
      global.T('{n} can iyileş').replace('{n}', iyilesme) +
      (run.hp >= run.maxHp ? ' (' + global.T('canın zaten dolu') + ')' : '') + '</i>';
    dinlen.onclick = function () {
      global.SES.iyilesme();
      var kaz = run.iyilestir(iyilesme);
      global.Pencere.kapat();
      ustTazele();
      global.FX.sayi(global.innerWidth / 2, global.innerHeight / 2, '+' + kaz,
                     { renk: '#7ef0a8', boy: 34 });
      setTimeout(bitince, 500);
    };
    liste.appendChild(dinlen);

    var demirci = U.el('button', 'secenek');
    demirci.innerHTML = '<b>⚒️ ' + global.T('Demirci') + '</b><i>' +
      global.T('{n} kart yükselt').replace('{n}', yukseltmeSayisi) +
      (yukseltilebilir.length ? '' : ' (' + global.T('yükseltilecek kart yok') + ')') + '</i>';
    if (!yukseltilebilir.length) demirci.disabled = true;
    demirci.onclick = function () {
      global.Pencere.kapat();
      var kalan = yukseltmeSayisi;
      function tur() {
        var aday = run.deste.filter(global.yukseltilebilir);
        if (!kalan || !aday.length) { bitince(); return; }
        kartSec(global.T('Yükseltilecek kartı seç') + (yukseltmeSayisi > 1 ?
                ' (' + (yukseltmeSayisi - kalan + 1) + '/' + yukseltmeSayisi + ')' : ''),
                aday, function (k) {
          if (k) {
            run.kartYukselt(k);
            global.SES.yukselt();
            global.FX.kivilcim(global.innerWidth / 2, global.innerHeight / 2, 30,
                               { renkler: ['#7ef0a8', '#bdf5d4', '#fbbf24'] });
          }
          kalan--;
          tur();
        }, true);
      }
      tur();
    };
    liste.appendChild(demirci);

    kap.appendChild(liste);
    global.Pencere.ac({
      baslik: global.T('Kamp Ateşi'), govde: kap, kapatilabilir: false, xIle: false
    });
  }

  /* ================================================================== */
  /*  OLAY                                                               */
  /* ================================================================== */

  function olayEkrani(olayId, bitince) {
    var olay = global.OLAYLAR[olayId];

    function ciz() {
      var kap = U.el('div');
      var cev = global.DIL.v('olay', olayId, 's', null);
      kap.innerHTML = '<div class="olay-art">' + olay.art + '</div>' +
                      '<p class="olay-metin">' +
                      global.DIL.v('olay', olayId, 'metin', olay.metin) + '</p>';
      var liste = U.el('div', 'secenek-liste');
      olay.secenekler.forEach(function (secenek, i) {
        var b = U.el('button', 'secenek');
        var uygun = !secenek.kosul || secenek.kosul(run);
        var yazi = (cev && cev[i] && cev[i].yazi) || secenek.yazi;
        var ipucu = (cev && cev[i] && cev[i].ipucu !== undefined) ? cev[i].ipucu : secenek.ipucu;
        b.innerHTML = '<b>' + yazi + '</b>' + (ipucu ? '<i>' + ipucu + '</i>' : '');
        if (!uygun) { b.disabled = true;
                      b.innerHTML += '<i>— ' + global.T('koşul sağlanmıyor') + ' —</i>'; }
        else b.onclick = function () { secimYap(i); };
        liste.appendChild(b);
      });
      kap.appendChild(liste);
      return kap;
    }

    function secimYap(i) {
      global.SES.dugme();
      var metin = run.olayUygula(olayId, i);
      global.Pencere.kapat();
      ustTazele();
      akisiIsle(function () {
        ustTazele();
        var kap = U.el('div');
        kap.innerHTML = '<div class="olay-art">' + olay.art + '</div>' +
                        '<p class="sonuc-metin">' + global.DIL.uzun(metin) + '</p>';
        global.Pencere.ac({
          baslik: global.DIL.v('olay', olayId, 'ad', olay.ad), govde: kap, genislik: 'dar',
          kapatilabilir: false, xIle: false,
          dugmeler: [{ yazi: global.T('Devam'), sinif: 'birincil', ol: bitince }]
        });
      });
    }

    global.Pencere.ac({
      baslik: global.DIL.v('olay', olayId, 'ad', olay.ad), govde: ciz(),
      kapatilabilir: false, xIle: false
    });
  }

  /* ================================================================== */
  /*  DÜKKAN                                                             */
  /* ================================================================== */

  function dukkanEkrani(bitince) {
    var d = run.dugum().icerik.dukkan;

    function fiyatUygun(f) { return run.altin >= f; }

    function govde() {
      var kap = U.el('div');

      // Kartlar
      var b1 = U.el('div', 'dukkan-bolum');
      b1.appendChild(U.el('h3', null, global.T('Kartlar')));
      var raf1 = U.el('div', 'dukkan-raf');
      d.kartlar.forEach(function (urun) {
        var kart = global.yeniKart(urun.id, false);
        var saran = U.el('div', 'satilik' + (urun.satildi ? ' satildi' : '') +
                                (fiyatUygun(urun.fiyat) ? '' : ' pahali'));
        var kEl = global.KartUI.olustur(kart, { boy: 'kucuk', tiklanir: !urun.satildi });
        saran.appendChild(kEl);
        var f = U.el('div', 'fiyat'); f.innerHTML = '🪙 ' + urun.fiyat;
        saran.appendChild(f);
        if (!urun.satildi) kEl.onclick = function () {
          if (!fiyatUygun(urun.fiyat)) { yetersiz(); return; }
          run.altin -= urun.fiyat; urun.satildi = true;
          run.deste.push(kart);
          global.SES.altin(); ustTazele(); global.Pencere.tazele();
        };
        raf1.appendChild(saran);
      });
      b1.appendChild(raf1);
      kap.appendChild(b1);

      // İksirler
      var b2 = U.el('div', 'dukkan-bolum');
      b2.appendChild(U.el('h3', null, global.T('İksirler')));
      var raf2 = U.el('div', 'dukkan-raf');
      d.iksirler.forEach(function (urun) {
        var def = global.IKSIRLER[urun.id];
        var saran = U.el('div', 'satilik' + (urun.satildi ? ' satildi' : '') +
                                (fiyatUygun(urun.fiyat) ? '' : ' pahali'));
        var sey = U.el('div', 'satilik-sey', def.ikon);
        global.Ipucu.bagla(sey, function () {
          return { baslik: global.DIL.v('iksir', urun.id, 'ad', def.ad),
                   metin: global.DIL.v('iksir', urun.id, 'metin', def.metin) }; });
        saran.appendChild(sey);
        var f = U.el('div', 'fiyat'); f.innerHTML = '🪙 ' + urun.fiyat;
        saran.appendChild(f);
        if (!urun.satildi) sey.onclick = function () {
          if (!fiyatUygun(urun.fiyat)) { yetersiz(); return; }
          if (run.iksirYuvaBos()) {
            run.iksirEkle(urun.id);
            run.altin -= urun.fiyat; urun.satildi = true;
            global.SES.altin(); ustTazele(); global.Pencere.tazele();
            return;
          }
          global.Pencere.kapat();
          iksirAl(urun.id, function (alindiMi) {
            if (alindiMi) {
              run.altin -= urun.fiyat; urun.satildi = true;
              global.SES.altin(); ustTazele();
            }
            ac();
          });
        };
        raf2.appendChild(saran);
      });
      b2.appendChild(raf2);
      kap.appendChild(b2);

      // Yadigârlar
      if (d.yadigarlar.length) {
        var b3 = U.el('div', 'dukkan-bolum');
        b3.appendChild(U.el('h3', null, global.T('Yadigârlar')));
        var raf3 = U.el('div', 'dukkan-raf');
        d.yadigarlar.forEach(function (urun) {
          var def = global.YADIGARLAR[urun.id];
          if (!def) return;
          var saran = U.el('div', 'satilik' + (urun.satildi ? ' satildi' : '') +
                                  (fiyatUygun(urun.fiyat) ? '' : ' pahali'));
          var sey = U.el('div', 'satilik-sey', def.ikon);
          global.Ipucu.bagla(sey, function () {
            return { baslik: global.DIL.v('yadigar', urun.id, 'ad', def.ad),
                     metin: global.DIL.v('yadigar', urun.id, 'metin', def.metin),
                     alt: global.T(NADIRLIK_AD[def.nadirlik]) };
          });
          saran.appendChild(sey);
          var f = U.el('div', 'fiyat'); f.innerHTML = '🪙 ' + urun.fiyat;
          saran.appendChild(f);
          if (!urun.satildi) sey.onclick = function () {
            if (!fiyatUygun(urun.fiyat)) { yetersiz(); return; }
            run.altin -= urun.fiyat; urun.satildi = true;
            global.Pencere.kapat();
            run.yadigarEkle(urun.id);
            akisiIsle(function () { ustTazele(); ac(); });
          };
          raf3.appendChild(saran);
        });
        b3.appendChild(raf3);
        kap.appendChild(b3);
      }

      // Kart sildirme
      var b4 = U.el('div', 'dukkan-bolum');
      b4.appendChild(U.el('h3', null, global.T('Hizmet')));
      var sil = U.el('button', 'secenek');
      sil.style.maxWidth = '340px';
      var ucret = run.silmeFiyati();
      sil.innerHTML = '<b>🔥 ' + global.T('Kart yaktır') + '</b><i>' +
        global.T('Destenden bir kartı kalıcı olarak çıkar') + ' — 🪙 ' + ucret + '</i>';
      if (d.silmeYapildi) { sil.disabled = true;
        sil.innerHTML = '<b>🔥 ' + global.T('Kart yaktır') + '</b><i>' +
          global.T('Bu dükkanda kullanıldı') + '</i>'; }
      else if (!fiyatUygun(ucret) || run.deste.length <= 5) sil.disabled = true;
      else sil.onclick = function () {
        global.Pencere.kapat();
        kartSec(global.T('Yakılacak kartı seç'), run.deste.slice(), function (k) {
          if (k && run.kartSilmeSatinAl(k)) {
            d.silmeYapildi = true;
            global.SES.tuket();
            ustTazele();
          }
          ac();
        });
      };
      b4.appendChild(sil);
      kap.appendChild(b4);

      return kap;
    }

    function yetersiz() {
      global.FX.sayi(global.innerWidth / 2, global.innerHeight * 0.5, global.T('Altının yetmiyor'),
                     { renk: '#e0484a', boy: 20 });
      global.SES.tik();
    }

    function ac() {
      global.Pencere.ac({
        baslik: global.T('Dükkan'), not: global.T('Kesende') + ' 🪙 ' + run.altin,
        govde: govde(), tazele: govde, genislik: 'genis',
        kapatilabilir: false, xIle: false,
        dugmeler: [{ yazi: global.T('Ayrıl'), sinif: 'birincil', ol: bitince }]
      });
    }
    ac();
  }

  /* ================================================================== */
  /*  DESTE GÖRÜNTÜLEYİCİ                                                */
  /* ================================================================== */

  function desteGoster() {
    if (!run) return;
    var gruplar = {};
    run.deste.forEach(function (k) {
      var anahtar = k.id + (k.up ? '+' : '');
      if (!gruplar[anahtar]) gruplar[anahtar] = { kart: k, n: 0 };
      gruplar[anahtar].n++;
    });
    var liste = Object.keys(gruplar).map(function (a) { return gruplar[a]; });
    liste.sort(function (a, b) {
      var da = global.KARTLAR[a.kart.id], db = global.KARTLAR[b.kart.id];
      var sira = { saldiri: 0, beceri: 1, guc: 2, durum: 3, lanet: 4 };
      if (sira[da.tur] !== sira[db.tur]) return sira[da.tur] - sira[db.tur];
      return da.ad.localeCompare(db.ad, 'tr');
    });

    var kap = U.el('div', 'deste-izgara');
    liste.forEach(function (g) {
      var saran = U.el('div');
      saran.style.position = 'relative';
      saran.appendChild(global.KartUI.olustur(g.kart, { boy: 'kucuk' }));
      if (g.n > 1) saran.appendChild(U.el('div', 'kart-sayi', '×' + g.n));
      kap.appendChild(saran);
    });

    global.Pencere.ac({
      baslik: global.T('Desten'), not: run.deste.length + ' ' + global.T('kart'),
      govde: kap, genislik: 'genis',
      dugmeler: [{ yazi: global.T('Kapat') }]
    });
  }

  /* ================================================================== */
  /*  OYUN SONU                                                          */
  /* ================================================================== */

  function oyunSonu(kazandi, olduren) {
    var ist = global.Kayit.kosuBitti(run, kazandi);
    if (kazandi) global.SES.zafer(); else global.SES.yenilgi();

    var kap = U.el('div');
    kap.innerHTML =
      '<div class="son-baslik ' + (kazandi ? 'zafer' : 'yenilgi') + '">' +
        global.T(kazandi ? 'İLK ALEV SÖNDÜ' : 'KÜLE DÖNDÜN') + '</div>' +
      '<p style="text-align:center;color:var(--kul2);font-size:13.5px;line-height:1.7">' +
        (kazandi
          ? global.T('Kule sessiz. Elindeki kor hâlâ sıcak — ve artık sadece senin.')
          : (olduren ? olduren + ' ' + global.T('seni durdurdu.')
                     : global.T('Yolculuğun burada bitti.'))) +
      '</p>';

    var ozet = U.el('div', 'son-ozet');
    function kutu(v, e) {
      var k = U.el('div', 'son-kutu');
      k.innerHTML = '<b>' + v + '</b><span>' + e + '</span>';
      ozet.appendChild(k);
    }
    kutu('P' + run.perde + ' · ' + (run.kat < 0 ? 0 : run.kat + 1), global.T('Ulaşılan kat'));
    kutu(run.ist.savas, global.T('Savaş'));
    kutu(run.ist.elit, global.T('Elit'));
    kutu(run.deste.length, global.T('kart'));
    kutu(run.yadigarlar.length, global.T('Yadigâr'));
    kutu(run.ist.altinKazanc, global.T('Toplam altın'));
    kap.appendChild(ozet);

    var alt = U.el('p');
    alt.style.cssText = 'text-align:center;font-size:12px;color:var(--kul2);margin-top:6px';
    alt.textContent = global.T('Tohum') + ': ' + run.tohum + '  ·  ' +
                      global.T(global.ZORLUKLAR[run.zorluk].ad) +
                      '  ·  ' + global.T('Toplam koşu') + ': ' + ist.kosu +
                      ' · ' + global.T('Zafer') + ': ' + ist.zafer;
    kap.appendChild(alt);

    // Deste özeti
    var dbaslik = U.el('h3');
    dbaslik.style.cssText = 'text-align:center;font-family:var(--serif);font-weight:400;' +
                            'font-size:15px;color:var(--kul);margin:18px 0 10px';
    dbaslik.textContent = global.T('Son desten');
    kap.appendChild(dbaslik);
    var izgara = U.el('div', 'deste-izgara');
    var gruplar = {};
    run.deste.forEach(function (k) {
      var a = k.id + (k.up ? '+' : '');
      if (!gruplar[a]) gruplar[a] = { kart: k, n: 0 };
      gruplar[a].n++;
    });
    Object.keys(gruplar).forEach(function (a) {
      var g = gruplar[a];
      var saran = U.el('div');
      saran.style.position = 'relative';
      saran.appendChild(global.KartUI.olustur(g.kart, { boy: 'kucuk' }));
      if (g.n > 1) saran.appendChild(U.el('div', 'kart-sayi', '×' + g.n));
      izgara.appendChild(saran);
    });
    kap.appendChild(izgara);

    global.Pencere.ac({
      govde: kap, genislik: 'genis', kapatilabilir: false, xIle: false,
      dugmeler: [{
        yazi: global.T('Ana menü'), sinif: 'birincil',
        ol: function () { global.Oyun.menuyeDon(); }
      }]
    });
  }

  /* ================================================================== */
  /*  YARDIM & AYARLAR                                                   */
  /* ================================================================== */

  function yardim() {
    var h = '<div class="yardim">' +
      '<h3>Amaç</h3><p>Üç perdeyi geçip <b>İlk Alev</b>\'e ulaş. Her savaşta kart oynar, ' +
      'her savaştan sonra desteni büyütürsün. Deste senin karakterindir — dar ve odaklı ' +
      'bir deste, kalabalık bir desteden neredeyse her zaman güçlüdür.</p>' +

      '<h3>Savaş</h3><ul>' +
      '<li>Her tur <b>3 enerji</b> alır ve <b>5 kart</b> çekersin. Kalan kartlar tur sonunda atılır.</li>' +
      '<li>Düşmanların üstündeki balon <b>niyetlerini</b> gösterir: ⚔️ saldırı, 🛡️ savunma, ' +
      '⬆️ güçlenme, 💀 zayıflatma, ☠️ ağır saldırı. Gösterilen hasar tüm etkiler hesaplanmış hâlidir.</li>' +
      '<li><b>Blok</b> tur başında sıfırlanır — biriktiremezsin, o tur için harcarsın.</li>' +
      '<li>Kartı oynamak için üstüne tıkla ya da sürükle. Hedef gerektirenlerde düşmanı seç.</li>' +
      '</ul>' +

      '<h3><span class="kw">Akkor</span> — bu oyunun kalbi</h3>' +
      '<p>Akkor savaş boyunca birikir, turlar arasında kaybolmaz. Bazı kartlar Akkor üretir; ' +
      'bazıları <b>tümünü harcayıp</b> biriken miktarla ölçeklenen bir etki verir. ' +
      'Asıl karar şu: <b>ne zaman boşaltacaksın?</b> Bir tur daha biriktirmek daha büyük bir ' +
      'patlama demek — ama o turu atlatabilirsen.</p>' +

      '<h3>Üç yol</h3><ul>' +
      '<li><b style="color:#f97316">Yangın</b> — Akkor biriktir, sonra patlat. Ani ve yüksek hasar.</li>' +
      '<li><b style="color:#b98be0">Kül</b> — <span class="kw">Yanık</span> yığ, çoklu vuruşlarla yıprat. Yavaş ama katlanarak büyür.</li>' +
      '<li><b style="color:#6ea8dc">Demir</b> — Blok, <span class="kw">Diken</span>, <span class="kw">Zırh</span>. Hasarı savunmaya çevirirsin.</li>' +
      '</ul>' +

      '<h3>Harita</h3><ul>' +
      '<li>⚔️ Savaş — altın + kart · 💀 Elit — zor, ama <b>yadigâr</b> verir</li>' +
      '<li>🏕️ Kamp — dinlen ya da bir kart yükselt · 🛒 Dükkan — al, sat, <b>kart yaktır</b></li>' +
      '<li>❓ Bilinmez — seçim gerektiren olay · 📦 Hazine — bedava yadigâr</li>' +
      '</ul>' +

      '<h3>Üç öğüt</h3><ul>' +
      '<li>Her kartı alma. Kalabalık deste, iyi kartlarını görmeni engeller.</li>' +
      '<li>Dükkanda <b>kart yaktırmak</b> çoğu zaman kart almaktan iyidir.</li>' +
      '<li>Elitler risklidir ama yadigârsız patrona gitmek daha risklidir.</li>' +
      '</ul></div>';

    global.Pencere.ac({
      baslik: global.T('Nasıl oynanır'), govde: global.T('__yardim__') !== '__yardim__'
              ? global.T('__yardim__') : h,
      dugmeler: [{ yazi: global.T('Anladım'), sinif: 'birincil' }]
    });
  }

  function ayarlar() {
    var a = global.Kayit.ayarOku();
    var kap = U.el('div');

    function satir(etiket, secenekler, mevcut, degisti) {
      var s = U.el('div', 'ayar-satir');
      s.appendChild(U.el('span', null, global.T(etiket)));
      var g = U.el('div', 'secim-grup');
      secenekler.forEach(function (o) {
        var b = U.el('button', o.v === mevcut ? 'secili' : '', global.T(o.ad));
        b.onclick = function () {
          global.SES.tik();
          degisti(o.v);
          U.$$('button', g).forEach(function (x) { x.classList.remove('secili'); });
          b.classList.add('secili');
        };
        g.appendChild(b);
      });
      s.appendChild(g);
      kap.appendChild(s);
    }

    // Dil satırı en üstte: değişince pencere yeniden çizilir
    satir('Dil', global.DIL.diller.map(function (d) { return { ad: d.ad, v: d.kod }; }),
      global.DIL.simdi(), function (v) {
        a.dil = v; global.Kayit.ayarYaz(a);
        global.DIL.ayarla(v);
        global.Pencere.kapat();
        if (global.Ekranlar.ustTazele) global.Ekranlar.ustTazele();
        ayarlar();
      });
    satir('Ses efektleri', [{ ad: 'Açık', v: true }, { ad: 'Kapalı', v: false }], a.ses,
      function (v) {
        a.ses = v; global.SES.ayar(v);
        global.Muzik.ayar(v && a.muzik !== false);
        global.Kayit.ayarYaz(a);
      });
    satir('Müzik', [{ ad: 'Açık', v: true }, { ad: 'Kapalı', v: false }],
      a.muzik !== false, function (v) {
        a.muzik = v; global.Muzik.ayar(v && a.ses); global.Kayit.ayarYaz(a);
      });
    satir('Müzik seviyesi',
      [{ ad: 'Kısık', v: 0.35 }, { ad: 'Orta', v: 0.55 }, { ad: 'Yüksek', v: 0.8 }],
      a.muzikSeviye || 0.55, function (v) {
        a.muzikSeviye = v; global.SES.muzikSeviye(v); global.Kayit.ayarYaz(a);
      });
    satir('Animasyon hızı',
      [{ ad: 'Normal', v: 1 }, { ad: 'Hızlı', v: 1.6 }, { ad: 'Çok hızlı', v: 2.4 }],
      a.hiz, function (v) {
        a.hiz = v; global.SavasEkrani.hizAyar(v); global.Kayit.ayarYaz(a);
      });
    satir('Ekran sarsıntısı', [{ ad: 'Açık', v: true }, { ad: 'Kapalı', v: false }],
      a.sarsinti, function (v) {
        a.sarsinti = v; global.FX.sarsintiAyar(v); global.Kayit.ayarYaz(a);
      });

    // Tam ekran yalnızca destekleyen cihazlarda görünsün
    if (global.Cihaz && global.Cihaz.tamEkranDestekli()) {
      var fs = U.el('div', 'ayar-satir');
      fs.appendChild(U.el('span', null, global.T('Tam ekran')));
      var fsg = U.el('div', 'secim-grup');
      var fsb = U.el('button', '', global.T(global.Cihaz.tamEkranMi() ? 'Çık' : 'Geç'));
      fsb.onclick = function () {
        global.SES.tik();
        global.Cihaz.tamEkranDegistir().then(function () {
          fsb.textContent = global.T(global.Cihaz.tamEkranMi() ? 'Çık' : 'Geç');
        });
      };
      fsg.appendChild(fsb);
      fs.appendChild(fsg);
      kap.appendChild(fs);
    }

    global.Pencere.ac({
      baslik: global.T('Ayarlar'), genislik: 'dar', govde: kap,
      dugmeler: [{ yazi: global.T('Kapat') }]
    });
  }

  /* ================================================================== */

  global.Ekranlar = {
    kosuAyarla: kosuAyarla, ustTazele: ustTazele, akisiIsle: akisiIsle,
    odulEkrani: odulEkrani, hazineEkrani: hazineEkrani,
    dinlenmeEkrani: dinlenmeEkrani, olayEkrani: olayEkrani,
    dukkanEkrani: dukkanEkrani, desteGoster: desteGoster,
    oyunSonu: oyunSonu, yardim: yardim, ayarlar: ayarlar,
    kartSec: kartSec, kartOdulSec: kartOdulSec, yadigarGoster: yadigarGoster,
    iksirAl: iksirAl
  };
})(typeof window !== 'undefined' ? window : globalThis);
