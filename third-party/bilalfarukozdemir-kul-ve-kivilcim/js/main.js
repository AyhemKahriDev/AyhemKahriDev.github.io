/* =========================================================================
   OYUN AKIŞI — ekran yönlendirme, koşu yaşam döngüsü, kayıt
   ========================================================================= */
(function (global) {
  'use strict';

  var U = global.U;
  var run = null;
  var zorluk = 0;
  // Bir odaya girildiğinde harita kilitlenir. Oda kapanışları gecikmeli
  // olduğu için bu kilit olmadan hızlı tıklamayla iki odaya birden girilebiliyor.
  var odaMesgul = false;

  /* ------------------------------------------------------------------ */

  function baslat() {
    global.Arkaplan.kur();
    global.Cihaz.kur();
    global.FX.kur();
    global.Pencere.kur();
    global.SavasEkrani.kur();
    global.HaritaEkrani.kur();

    var a = global.Kayit.ayarOku();
    global.DIL.ayarla(a.dil || 'tr');
    global.SES.ayar(a.ses);
    global.SavasEkrani.hizAyar(a.hiz);
    global.FX.sarsintiAyar(a.sarsinti);

    // Ses bağlamı yalnızca bir kullanıcı hareketinden sonra açılabiliyor;
    // müzik de ilk dokunuşta başlar.
    var uyandir = function () {
      global.SES.kur();
      if (global.Muzik.kur()) {
        global.Muzik.ayar(a.muzik !== false && a.ses);
        global.Muzik.durum(run ? (global.aktifSavas ? 'savas' : 'harita') : 'menu');
      }
      document.removeEventListener('pointerdown', uyandir);
      document.removeEventListener('keydown', uyandir);
    };
    document.addEventListener('pointerdown', uyandir);
    document.addEventListener('keydown', uyandir);

    document.getElementById('desteAc').onclick = function () {
      global.SES.tik(); global.Ekranlar.desteGoster();
    };
    document.getElementById('menuAc').onclick = function () {
      global.SES.tik(); oyunIciMenu();
    };
    document.getElementById('nasilOynanir').onclick = function () {
      global.SES.dugme(); global.Ekranlar.yardim();
    };
    document.getElementById('ayarlarAc').onclick = function () {
      global.SES.dugme(); global.Ekranlar.ayarlar();
    };
    document.getElementById('tohumYenile').onclick = function () {
      global.SES.tik();
      document.getElementById('tohumGiris').value = global.RNG.randomSeedText();
    };

    document.addEventListener('keydown', klavye);

    menuyeDon();
  }

  /* ------------------------------------------------------------------ */
  /*  Ekran yönetimi                                                     */
  /* ------------------------------------------------------------------ */

  function ekranGoster(ad) {
    U.$$('.ekran').forEach(function (e) { e.classList.remove('aktif'); });
    var el = document.getElementById('ekran-' + ad);
    if (el) el.classList.add('aktif');
    document.getElementById('ustCubuk').hidden = (ad === 'menu');
  }

  /* ------------------------------------------------------------------ */
  /*  Ana menü                                                           */
  /* ------------------------------------------------------------------ */

  function menuyeDon() {
    var uygula = function () {
      run = null;
      global.aktifSavas = null;
      global.aktifKosu = null;
      global.Pencere.hepsiniKapat();
      global.Arkaplan.perdeAyarla(1);
      global.Arkaplan.akkorIsisi(0);
      global.Muzik.durum('menu');
      ekranGoster('menu');
      menuCiz();
    };
    if (document.querySelector('#ekran-menu.aktif')) uygula();
    else global.Gecis.gecis(uygula);
  }

  function menuCiz() {
    var dk = document.getElementById('menuDugmeler');
    U.clear(dk);

    var kayit = global.Kayit.oku();
    if (kayit) {
      var devam = U.el('button', 'ana-dugme vurgu');
      devam.innerHTML = global.T('Koşuya Devam Et') + '<small>' + global.T('Perde') + ' ' +
                        kayit.perde + ' · ' + global.T('Kat') + ' ' +
                        (kayit.kat < 0 ? 0 : kayit.kat + 1) + ' · ❤ ' + kayit.hp + '/' +
                        kayit.maxHp + '</small>';
      devam.onclick = function () { global.SES.dugme(); devamEt(); };
      dk.appendChild(devam);
    }

    var yeni = U.el('button', 'ana-dugme' + (kayit ? '' : ' vurgu'), global.T('Yeni Koşu'));
    yeni.onclick = function () {
      global.SES.dugme();
      if (kayit) {
        global.Pencere.onay(global.T('Yeni koşu?'),
          global.T('Devam eden koşun silinecek. Emin misin?'),
          global.T('Yeni koşu başlat'), yeniKosu);
      } else yeniKosu();
    };
    dk.appendChild(yeni);

    // Zorluk
    var zs = document.getElementById('zorlukSecim');
    U.clear(zs);
    global.ZORLUKLAR.forEach(function (z, i) {
      var b = U.el('button', 'zorluk-dugme' + (i === zorluk ? ' secili' : ''));
      b.innerHTML = '<b>' + global.T(z.ad) + '</b><i>' + global.T(z.ipucu) + '</i>';
      b.onclick = function () {
        global.SES.tik(); zorluk = i; menuCiz();
      };
      zs.appendChild(b);
    });

    var tg = document.getElementById('tohumGiris');
    if (!tg.value) tg.value = global.RNG.randomSeedText();

    // İstatistik
    var ist = global.Kayit.istOku();
    var mi = document.getElementById('menuIst');
    mi.innerHTML = '<span>' + global.T('Koşu') + ': <b>' + ist.kosu + '</b></span>' +
                   '<span>' + global.T('Zafer') + ': <b>' + ist.zafer + '</b></span>' +
                   '<span>' + global.T('En uzak') + ': <b>P' + (ist.enIyiPerde || 1) + ' · ' +
                   global.T('Kat') + ' ' + ((ist.enIyiKat || 0) + 1) + '</b></span>';
  }

  /* ------------------------------------------------------------------ */
  /*  Koşu yaşam döngüsü                                                 */
  /* ------------------------------------------------------------------ */

  function yeniKosu() {
    var tohum = (document.getElementById('tohumGiris').value || '').trim() ||
                global.RNG.randomSeedText();
    U.resetUid(1);
    run = new global.Run(tohum, zorluk);
    global.aktifKosu = run;          // hata ayıklama / otomatik test kancası
    global.Ekranlar.kosuAyarla(run);
    global.Kayit.yaz(run);
    global.SES.haritaGir();
    haritayaGit();
  }

  function devamEt() {
    var d = global.Kayit.oku();
    if (!d) { menuCiz(); return; }
    try {
      run = global.Run.yukle(d);
    } catch (e) {
      global.Kayit.sil(); menuCiz(); return;
    }
    global.aktifKosu = run;          // hata ayıklama / otomatik test kancası
    global.Ekranlar.kosuAyarla(run);
    // Kaydedilen düğüm yarım kalmış olabilir — o odaya yeniden gir
    if (run.kat >= 0 && d.odaYarim) {
      haritayaGit();
      var dgm = run.harita.katlar[run.kat][run.dugumIdx];
      setTimeout(function () { odayiIsle(dgm); }, 250);
    } else {
      haritayaGit();
    }
  }

  function kaydet(odaYarim) {
    if (!run) return;
    global.Kayit.yaz(run, { odaYarim: !!odaYarim });
  }

  function haritayaGit() {
    var uygula = function () {
      odaMesgul = false;
      global.aktifKosu = run;        // hata ayıklama / otomatik test kancası
      global.Ekranlar.kosuAyarla(run);
      global.Arkaplan.perdeAyarla(run.perde);
      global.Arkaplan.akkorIsisi(0);
      global.Muzik.durum('harita');
      ekranGoster('harita');
      global.Ekranlar.ustTazele();
      global.HaritaEkrani.ciz(run, dugumSecildi);
      kaydet(false);
    };
    // Zaten haritadaysak geçiş yapma (ödül sonrası aynı ekrana dönüş)
    if (document.querySelector('#ekran-harita.aktif')) uygula();
    else global.Gecis.gecis(uygula);
  }

  function dugumSecildi(d) {
    if (odaMesgul) return;
    odaMesgul = true;
    run.dugumeGir(d.kat, d.idx);
    global.Ekranlar.ustTazele();
    kaydet(true);
    odayiIsle(d);
  }

  function odayiIsle(d) {
    switch (d.tip) {
      case 'savas': case 'elit': case 'patron':
        savasBaslat(d.icerik.karsilasma);
        break;
      case 'dinlenme':
        global.Ekranlar.dinlenmeEkrani(odaBitti);
        break;
      case 'dukkan':
        global.Ekranlar.dukkanEkrani(odaBitti);
        break;
      case 'olay':
        global.Ekranlar.olayEkrani(d.icerik.olay, odaBitti);
        break;
      case 'hazine':
        global.Ekranlar.hazineEkrani(odaBitti);
        break;
      default:
        odaBitti();
    }
  }

  function odaBitti() {
    global.Ekranlar.ustTazele();
    if (run.hp <= 0) { global.Ekranlar.oyunSonu(false); return; }
    // Perde sonu mu?
    if (run.kat >= global.KAT_SAYISI - 1) {
      perdeSonu();
      return;
    }
    haritayaGit();
  }

  function perdeSonu() {
    if (run.perde >= 3) {
      global.Ekranlar.oyunSonu(true);
      return;
    }
    var oncekiPerde = run.perde;
    run.sonrakiPerde();
    global.Ekranlar.ustTazele();
    global.Pencere.ac({
      baslik: global.T('Perde') + ' ' + oncekiPerde + ' ' + global.T('bitti'), genislik: 'dar',
      kapatilabilir: false, xIle: false,
      govde: '<div class="olay-art">🌒</div><p class="olay-metin">' +
             global.T(['', 'Ovaların külü ardında kaldı. İleride bir şehrin iskeleti yükseliyor.',
              'Şehir sustu. Sıcaklık artıyor — kaynağa yaklaşıyorsun.'][oncekiPerde]) +
             '</p><p class="sonuc-metin">' + global.T('Yaraların bir kısmı sarıldı.') + '</p>',
      dugmeler: [{ yazi: global.T('Devam et'), sinif: 'birincil', ol: haritayaGit }]
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Savaş                                                              */
  /* ------------------------------------------------------------------ */

  function savasBaslat(karsilasma) {
    global.Gecis.gecis(function () {
      ekranGoster('savas');
      global.Arkaplan.perdeAyarla(run.perde);
      global.Muzik.durum(karsilasma.tur === 'patron' ? 'patron'
                       : karsilasma.tur === 'elit' ? 'elit' : 'savas');
      global.Ekranlar.ustTazele();
    }, function () {
      // Savaş, geçiş bitince başlasın: giriş duyurusu külün altında kalmasın
      global.SavasEkrani.basla(run, karsilasma, savasBitti);
    });
  }

  function savasBitti(sonuc, C) {
    run.hp = C.p.hp;
    global.Ekranlar.ustTazele();

    if (sonuc !== 'zafer') {
      var olduren = C.dusmanlar.map(function (e) { return e.ad; }).join(' + ');
      global.Ekranlar.oyunSonu(false, olduren);
      return;
    }

    run.ist.oldurulen += C.dusmanlar.length;
    var oduller = run.savasOdulu(C.karsilasma);
    global.Ekranlar.ustTazele();
    global.Ekranlar.odulEkrani(oduller, function () {
      global.Ekranlar.akisiIsle(function () {
        global.Ekranlar.ustTazele();
        odaBitti();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Oyun içi menü / klavye                                             */
  /* ------------------------------------------------------------------ */

  function oyunIciMenu() {
    global.Pencere.ac({
      baslik: global.T('Menü'), genislik: 'dar',
      govde: '<p style="text-align:center;color:var(--kul2);font-size:13px;line-height:1.7">' +
             global.T('Koşun her odada otomatik kaydediliyor.') +
             '<br>' + global.T('Tohum') + ': <b style="color:var(--kor3)">' +
             run.tohum + '</b></p>',
      dugmeler: [
        { yazi: global.T('Devam'), sinif: 'birincil' },
        { yazi: global.T('Nasıl oynanır'), kapat: true, ol: function () { global.Ekranlar.yardim(); } },
        { yazi: global.T('Ayarlar'), kapat: true, ol: function () { global.Ekranlar.ayarlar(); } },
        { yazi: global.T('Koşuyu bırak'), sinif: 'tehlike', kapat: true, ol: function () {
            global.Pencere.onay(global.T('Koşuyu bırak?'),
              global.T('Bu koşu sona erecek ve kaydın silinecek.'),
              global.T('Bırak'), function () {
                global.Kayit.sil(); menuyeDon();
              });
          } }
      ]
    });
  }

  function klavye(e) {
    if (!run) return;
    if (global.Pencere.acikMi()) return;
    var savas = global.aktifSavas;

    if (e.key === 'd' || e.key === 'D') { global.Ekranlar.desteGoster(); return; }
    if (e.key === 'Escape') { oyunIciMenu(); return; }

    if (!savas || global.SavasEkrani.islemdeMi()) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('turBitirDugme').click();
      return;
    }
    // 1..9 elindeki kartı oyna (hedef gerekirse ilk canlı düşman)
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) global.SavasEkrani.kisayolOyna(n - 1);
  }

  /* ------------------------------------------------------------------ */

  global.Oyun = {
    baslat: baslat, menuyeDon: menuyeDon, ekranGoster: ekranGoster,
    kaydet: kaydet, haritayaGit: haritayaGit
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else baslat();
})(typeof window !== 'undefined' ? window : globalThis);
