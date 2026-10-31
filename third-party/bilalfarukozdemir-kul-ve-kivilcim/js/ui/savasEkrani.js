/* =========================================================================
   SAVAŞ EKRANI
   ---------------------------------------------------------------------
   Motor senkron çalışır ve `log` dizisine olay bırakır. Burası o günlüğü
   sırayla "oynatır": efekt + ses + gecikme, `snap` geldiğinde ekranı
   o anki duruma çizer. Oynatma sürerken girdi kilitlenir.
   ========================================================================= */
(function (global) {
  'use strict';

  var U = global.U;

  var C = null;             // aktif Combat
  var bitisCB = null;
  var s = null;             // son çizilen görsel durum
  var islemde = false;
  var secili = null;        // seçili kart uid
  var seciliIksir = null;
  var elKartlari = {};      // uid -> DOM
  var yanacaklar = {};      // oynanan/tüketilen kartlar: elden çıkarken yanarlar
  var dusmanEl = [];
  var hiz = 1;

  var alan, elAlan, dusmanSirasi, enerjiKure, turDugme;
  var oyuncuCan, oyuncuBlok, oyuncuDurum, oyuncuGorsel, akkorHalka;
  var cekmeYigin, atikYigin, tuketilenYigin;

  /* ------------------------------------------------------------------ */

  function kur() {
    alan = document.getElementById('savasAlan');
    elAlan = document.getElementById('elAlan');
    dusmanSirasi = document.getElementById('dusmanSirasi');
    enerjiKure = document.getElementById('enerjiKure');
    turDugme = document.getElementById('turBitirDugme');
    oyuncuCan = document.getElementById('oyuncuCan');
    oyuncuBlok = document.getElementById('oyuncuBlok');
    oyuncuDurum = document.getElementById('oyuncuDurum');
    oyuncuGorsel = document.getElementById('oyuncuGorsel');
    akkorHalka = document.querySelector('#akkorGosterge .akkor-halka');
    if (global.SANAT) {
      document.getElementById('oyuncuArt').innerHTML = global.SANAT.svg('oyuncu');
    }
    cekmeYigin = document.getElementById('cekmeYigin');
    atikYigin = document.getElementById('atikYigin');
    tuketilenYigin = document.getElementById('tuketilenYigin');

    turDugme.onclick = function () {
      if (islemde || !C || C.bitti) return;
      global.SES.dugme();
      secimiBirak();
      C.turBitir();
      oynat();
    };

    cekmeYigin.onclick = function () { yiginGoster(global.T('Çekme Destesi'), C.cekme, true); };
    atikYigin.onclick = function () { yiginGoster(global.T('Atık Destesi'), C.atik, false); };
    tuketilenYigin.onclick = function () { yiginGoster(global.T('Tüketilenler'), C.tuketilen, false); };

    /* Kart yukarı kalkıp incelemede kaldığında, sahnenin herhangi bir yerine
       dokununca geri insin. Eskiden yalnızca elin boş alanı bunu yapıyordu;
       düşmanların üstüne, üst çubuğa ya da boşluğa dokunmak kartı havada
       bırakıyordu. Yakalama evresinde dinliyoruz ki kartın kendi işleyicisi
       çalışmadan önce karar verebilelim. */
    document.addEventListener('pointerdown', function (e) {
      if (!C || islemde) return;
      if (!incelenen && !secili && seciliIksir === null) return;
      var h = e.target;
      if (h && h.closest) {
        if (h.closest('#elAlan .kart')) return;            // kartın kendisi
        // Düşmana dokunmak hedefli oynamanın parçası: seçimi bozma,
        // yalnızca büyütülmüş kartı indir.
        if (h.closest('#dusmanSirasi .varlik') || h.closest('#ucIksirler')) {
          incelemeBirak();
          return;
        }
      }
      secimiBirak();      // inceleme + hedef seçimi birlikte bırakılır
    }, true);

    global.addEventListener('resize', function () { if (s) elCiz(s.el); });
  }

  function hizAyar(v) { hiz = v || 1; }

  /* ------------------------------------------------------------------ */
  /*  Savaşı başlat                                                      */
  /* ------------------------------------------------------------------ */

  function basla(run, karsilasma, bitince) {
    bitisCB = bitince;
    secili = null; seciliIksir = null;
    elKartlari = {}; dusmanEl = []; incelenen = null;
    U.clear(elAlan); U.clear(dusmanSirasi);
    elAlan.classList.remove('incelemeVar');

    C = new global.Combat(run, karsilasma, run.rng.s('savas'));
    C.basla();
    global.aktifSavas = C;

    // Düşman gövdelerini bir kez kur
    for (var i = 0; i < C.dusmanlar.length; i++) dusmanEl.push(dusmanYap(C.dusmanlar[i], i));

    var ad = karsilasma.tur === 'patron'
             ? global.DIL.v('dusman', C.dusmanlar[0].id, 'ad', C.dusmanlar[0].ad)
             : karsilasma.tur === 'elit' ? global.T('ELİT SAVAŞ') : null;
    if (ad) duyuru(ad);

    oynat();
  }

  function dusmanYap(e, idx) {
    var d = U.el('div', 'varlik');
    d.dataset.idx = idx;
    d.style.setProperty('--boy', e.boy || 1);
    var gorsel = (global.SANAT && global.SANAT.varMi(e.id))
               ? global.SANAT.svg(e.id) : e.art;
    d.innerHTML =
      '<div class="niyet"></div>' +
      '<div class="varlik-art">' + gorsel + '</div>' +
      '<div class="varlik-alt">' +
        '<div class="varlik-ad"></div>' +
        '<div class="can-cubuk"><div class="can-dolu"></div><span></span></div>' +
        '<div class="blok-rozet"><span>🛡</span><b>0</b></div>' +
        '<div class="durum-satir"></div>' +
      '</div>';
    d.querySelector('.varlik-ad').textContent = global.DIL.v('dusman', e.id, 'ad', e.ad);
    d.addEventListener('pointerup', function (ev) {
      ev.stopPropagation();
      dusmanaTikla(idx);
    });
    Ipucu.bagla(d.querySelector('.niyet'), function () {
      var g = s && s.dusmanlar[idx];
      if (!g || !g.niyet) return null;
      return niyetIpucu(g.niyet);
    });
    dusmanSirasi.appendChild(d);
    return d;
  }

  /* ------------------------------------------------------------------ */
  /*  Günlük oynatma                                                     */
  /* ------------------------------------------------------------------ */

  var SURE = {
    hasar: 130, blok: 80, durum: 70, akkor: 90, iyilesme: 130,
    olum: 780, oyna: 190, cek: 45, turBasi: 300, dusmanTuru: 260,
    dusmanHamle: 170, karistir: 120, tuket: 110, dirilis: 500,
    enerji: 60, yadigar: 160, zafer: 260, snap: 0, at: 20
  };

  function oynat() {
    var kuyruk = C.log.splice(0, C.log.length);
    islemde = true;
    girdiKilit(true);
    adim(kuyruk, 0);
  }

  function adim(kuyruk, i) {
    if (i >= kuyruk.length) { bitirOynatma(); return; }
    var o = kuyruk[i];
    var bekle = isle(o);
    if (bekle <= 0) { adim(kuyruk, i + 1); return; }
    setTimeout(function () { adim(kuyruk, i + 1); }, bekle / hiz);
  }

  function bitirOynatma() {
    islemde = false;
    if (C.secim) { secimPenceresi(); return; }
    if (C.bitti) {
      girdiKilit(true);
      setTimeout(function () {
        var sonuc = C.bitti;
        var savas = C;
        C = null; global.aktifSavas = null;
        if (bitisCB) bitisCB(sonuc, savas);
      }, 620 / hiz);
      return;
    }
    girdiKilit(false);
    ciz(C.gorsel());
  }

  function isle(o) {
    switch (o.t) {
      case 'snap':   ciz(o.s); return 0;
      case 'bekle':  return o.ms;

      case 'hasar': {
        var hedefEl = varlikEl(o.hedef);
        var m = FX.merkez(hedefEl && hedefEl.querySelector('.varlik-art'));
        if (o.miktar > 0) {
          FX.sayi(m.x + (Math.random() * 30 - 15), m.y, String(o.miktar),
                  { renk: o.hedef === 'p' ? '#ff8a7a' : '#ffe7c4',
                    boy: 22 + Math.min(24, o.miktar * 0.8) });
          FX.kivilcim(m.x, m.y, 8 + Math.min(20, o.miktar), { hizMax: 4.5 });
          FX.halka(m.x, m.y, o.hedef === 'p' ? '#e0484a' : '#f97316',
                   40 + Math.min(70, o.miktar * 2));
          if (hedefEl) {
            hedefEl.classList.add('vuruldu');
            setTimeout(function () { hedefEl.classList.remove('vuruldu'); }, 320);
          }
          if (o.miktar >= 18) { global.SES.kritik(); FX.sarsinti(4 + o.sarsinti * 9); }
          else { global.SES.vurus(o.sarsinti); FX.sarsinti(1.5 + o.sarsinti * 5); }
        } else if (o.engellenen > 0) {
          FX.sayi(m.x, m.y, '⛨ ' + o.engellenen, { renk: '#9ecdff', boy: 20 });
          FX.kalkan(m.x, m.y);
          global.SES.blok();
        }
        return SURE.hasar;
      }

      case 'blok': {
        if (o.miktar <= 0) return 0;
        var be = varlikEl(o.hedef);
        var bm = FX.merkez(be && be.querySelector('.varlik-alt'));
        FX.sayi(bm.x, bm.y - 10, '+' + o.miktar, { renk: '#9ecdff', boy: 20 });
        FX.kalkan(bm.x, bm.y);
        global.SES.blok();
        return SURE.blok;
      }

      case 'iyilesme': {
        var ie = varlikEl(o.hedef);
        var im = FX.merkez(ie && ie.querySelector('.varlik-art'));
        FX.sayi(im.x, im.y, '+' + o.miktar, { renk: '#7ef0a8', boy: 22 });
        FX.iyilesme(im.x, im.y + 10);
        global.SES.iyilesme();
        return SURE.iyilesme;
      }

      case 'durum': {
        var meta = global.STATUS[o.anahtar];
        if (!meta || o.miktar === 0) return 0;
        var de = varlikEl(o.hedef);
        var dm = FX.merkez(de && de.querySelector('.varlik-alt'));
        FX.sayi(dm.x, dm.y + 12, meta.ikon + ' ' + (o.miktar > 0 ? '+' : '') + o.miktar,
                { renk: meta.kotu ? '#e6a0ff' : '#bdf5d4', boy: 17 });
        if (meta.kotu) global.SES.debuff(); else global.SES.buff();
        return SURE.durum;
      }

      case 'akkor': {
        var am = FX.merkez(akkorHalka);
        if (o.miktar > 0) {
          FX.kor(am.x, am.y, 6 + o.miktar * 2);
          FX.sayi(am.x, am.y - 34, '+' + o.miktar, { renk: '#fbbf24', boy: 19 });
          global.SES.akkor(o.miktar);
          akkorHalka.classList.remove('artti'); void akkorHalka.offsetWidth;
          akkorHalka.classList.add('artti');
        } else if (o.harcama) {
          FX.patlama(am.x, am.y, false);
          global.SES.akkorPatla();
          FX.sarsinti(5);
          if (global.Arkaplan) global.Arkaplan.parla(0.55);
        }
        return SURE.akkor;
      }

      case 'olum': {
        var oe = varlikEl(o.hedef);
        var oart = oe && oe.querySelector('.varlik-art');
        var om = FX.merkez(oart);
        FX.olum(om.x, om.y);
        global.SES.olum();
        FX.sarsinti(6);
        // Öldürücü vuruşta sahne bir an yaklaşır — patronlarda daha belirgin
        var buyuk = C && C.karsilasma &&
                    (C.karsilasma.tur === 'patron' || C.karsilasma.tur === 'elit');
        FX.yakinlas(buyuk ? 0.038 : 0.022, buyuk ? 620 : 460);
        if (oe) {
          oe.classList.add('olurken');
          if (oart && global.Yanma) {
            global.Yanma.yak(oart, { sure: 720, kabalik: 0.05, renk: '#ff6a12' });
            (function (v) { setTimeout(function () { v.classList.add('olu'); }, 700); })(oe);
          } else {
            oe.classList.add('olu');
          }
        }
        return SURE.olum;
      }

      case 'dirilis': {
        var re = varlikEl(o.hedef);
        var rm = FX.merkez(re && re.querySelector('.varlik-art'));
        FX.patlama(rm.x, rm.y, true);
        global.SES.yadigar();
        if (re) re.classList.remove('olu');
        return SURE.dirilis;
      }

      case 'yazi': {
        var ye = varlikEl(o.hedef);
        var ym = FX.merkez(ye && ye.querySelector('.varlik-art'));
        FX.sayi(ym.x, ym.y - 26, o.yazi, { renk: o.renk, boy: 18 });
        return SURE.durum;
      }

      case 'oyna':
        global.SES.kartOyna();
        yanacaklar[o.uid] = true;
        kartUcur(o.uid, o.tur, o.hedef);
        return SURE.oyna;
      case 'cek':    global.SES.kartCek(); return SURE.cek;
      case 'at':     return SURE.at;
      case 'tuket':  global.SES.tuket(); yanacaklar[o.uid] = true; return SURE.tuket;
      case 'karistir': global.SES.kartAt(); return SURE.karistir;
      case 'enerji': global.SES.enerji(); enerjiPop(); return SURE.enerji;

      case 'turBasi':
        global.SES.turBasi();
        if (o.tur > 1) duyuru(global.T('Tur') + ' ' + o.tur, true);
        return SURE.turBasi;

      case 'dusmanTuru': global.SES.dusmanTuru(); duyuru(global.T('Düşman Sırası'), true); return SURE.dusmanTuru;

      case 'dusmanHamle': {
        var he = varlikEl(o.hedef);
        if (he) {
          // Niyet hâlâ son anlık görüntüde duruyor; saldırıysa hamle yapsın,
          // değilse yalnızca bir an yükselsin.
          var hi = parseInt(String(o.hedef).slice(1), 10);
          var hn = s && s.dusmanlar[hi] && s.dusmanlar[hi].niyet;
          var saldiriMi = hn && /saldiri|olumcul/.test(hn.tip);
          var sinif = saldiriMi ? 'hamleSaldiri' : 'hamleHazirlik';
          he.classList.remove('hamleSaldiri', 'hamleHazirlik');
          void he.offsetWidth;
          he.classList.add(sinif);
          (function (v, c) {
            setTimeout(function () { v.classList.remove(c); }, 440);
          })(he, sinif);
        }
        return SURE.dusmanHamle;
      }

      case 'yadigar': {
        var rz = document.querySelector('.yadigar-rozet[data-id="' + o.id + '"]');
        if (rz) {
          rz.classList.remove('parla'); void rz.offsetWidth; rz.classList.add('parla');
        }
        global.SES.yadigar();
        return SURE.yadigar;
      }

      case 'iksir': global.SES.iyilesme(); return 120;
      case 'zafer': global.SES.zafer(); return SURE.zafer;
      case 'elDolu':
        FX.sayi(global.innerWidth / 2, global.innerHeight * 0.72, global.T('EL DOLU'),
                { renk: '#b0a396', boy: 17 });
        return 120;
      case 'secim': return 0;
      default: return 0;
    }
  }

  function varlikEl(ref) {
    if (ref === 'p') return oyuncuGorsel;
    var i = parseInt(String(ref).slice(1), 10);
    return dusmanEl[i] || null;
  }

  function duyuru(yazi, kucuk) {
    var d = U.el('div', 'savas-duyuru', yazi);
    if (kucuk) d.style.fontSize = '26px';
    document.getElementById('ustKatman').appendChild(d);
    setTimeout(function () { d.remove(); }, 1200);
  }

  function enerjiPop() {
    enerjiKure.classList.remove('degisti'); void enerjiKure.offsetWidth;
    enerjiKure.classList.add('degisti');
  }

  /* ------------------------------------------------------------------ */
  /*  Çizim                                                              */
  /* ------------------------------------------------------------------ */

  function ciz(gorsel) {
    s = gorsel;
    var i;

    // Oyuncu
    canCiz(oyuncuCan, s.p.hp, s.p.maxHp);
    blokCiz(oyuncuBlok, s.p.block);
    durumCiz(oyuncuDurum, s.p.st);

    // Akkor — sahnenin sıcaklığını da o belirler
    akkorHalka.querySelector('b').textContent = s.akkor;
    akkorHalka.classList.toggle('sicak', s.akkor >= 6);
    if (global.Arkaplan) global.Arkaplan.akkorIsisi(s.akkor);

    // Enerji
    enerjiKure.querySelector('b').textContent = s.enerji;
    enerjiKure.querySelector('span').textContent = '/' + s.maxEnerji;
    enerjiKure.classList.toggle('bos', s.enerji === 0);

    // Yığınlar
    cekmeYigin.querySelector('b').textContent = s.cekme;
    atikYigin.querySelector('b').textContent = s.atik;
    tuketilenYigin.querySelector('b').textContent = s.tuketilen;

    // Düşmanlar
    for (i = 0; i < s.dusmanlar.length; i++) {
      var g = s.dusmanlar[i], el = dusmanEl[i];
      if (!el) continue;
      el.classList.toggle('olu', g.olu);
      canCiz(el.querySelector('.can-cubuk'), g.hp, g.maxHp);
      blokCiz(el.querySelector('.blok-rozet'), g.block);
      durumCiz(el.querySelector('.durum-satir'), g.st);
      niyetCiz(el.querySelector('.niyet'), g.niyet);
    }

    elCiz(s.el);
    hedeflenebilirlikTazele();
    if (global.Ekranlar) global.Ekranlar.ustTazele();
  }

  function canCiz(kutu, hp, maxHp) {
    var oran = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    kutu.querySelector('.can-dolu').style.width = (oran * 100) + '%';
    kutu.querySelector('span').textContent = hp + ' / ' + maxHp;
    kutu.classList.toggle('dusuk', oran <= 0.3 && hp > 0);
  }

  function blokCiz(rozet, blok) {
    var b = rozet.querySelector('b');
    var onceki = parseInt(b.textContent, 10) || 0;
    rozet.classList.toggle('var', blok > 0);
    b.textContent = blok;
    if (blok > onceki) {
      rozet.classList.remove('artti'); void rozet.offsetWidth; rozet.classList.add('artti');
    }
  }

  function durumCiz(kap, st) {
    var eski = {};
    U.$$('.durum', kap).forEach(function (d) { eski[d.dataset.k] = true; });
    U.clear(kap);
    for (var i = 0; i < global.STATUS_ORDER.length; i++) {
      var k = global.STATUS_ORDER[i];
      var n = st[k] || 0;
      if (!n) continue;
      var meta = global.STATUS[k];
      var d = U.el('div', 'durum ' + (meta.kotu ? 'kotu' : 'iyi'));
      d.dataset.k = k;
      d.innerHTML = '<span>' + meta.ikon + '</span><b>' + n + '</b>';
      if (!eski[k]) d.classList.add('yeni');
      (function (meta, n) {
        Ipucu.bagla(d, function () {
          return { baslik: global.DIL.v('durum', k, 'ad', meta.ad),
                   metin: global.DIL.v('durum', k, 'metin', meta.metin).replace('{n}', n) };
        });
      })(meta, n);
      kap.appendChild(d);
    }
  }

  var NIYET_IKON = {
    saldiri: '⚔️', olumcul: '☠️', saldiri_savunma: '⚔️🛡️', saldiri_debuff: '⚔️💀',
    savunma: '🛡️', buff: '⬆️', debuff: '💀', bilinmez: '❓', uyku: '💤'
  };

  function niyetCiz(el, n) {
    if (!n) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.className = 'niyet ' + n.tip;
    var h = '<span>' + (NIYET_IKON[n.tip] || '❓') + '</span>';
    if (n.hasar !== undefined) {
      h += '<b>' + n.hasar + '</b>';
      if (n.kez > 1) h += '<span class="kez">×' + n.kez + '</span>';
    }
    el.innerHTML = h;
  }

  function niyetIpucu(n) {
    var ad = global.T({
      saldiri: 'Saldıracak', olumcul: 'Ağır saldırı!', saldiri_savunma: 'Saldırıp korunacak',
      saldiri_debuff: 'Saldırıp zayıflatacak', savunma: 'Korunacak',
      buff: 'Güçlenecek', debuff: 'Seni zayıflatacak', bilinmez: 'Ne yapacağı belli değil'
    }[n.tip] || 'Hamle');
    var m = '';
    if (n.hasar !== undefined) {
      m = n.kez > 1 ? (n.hasar + ' ' + global.T('hasar') + ' × ' + n.kez +
                       ' = <b style="color:#ff9d8f">' + (n.hasar * n.kez) + '</b> ' +
                       global.T('toplam'))
                    : (n.hasar + ' ' + global.T('hasar'));
    }
    return { baslik: ad, metin: m, alt: global.DIL.ip(n.ipucu || '') };
  }

  /* ------------------------------------------------------------------ */
  /*  El (yelpaze)                                                       */
  /* ------------------------------------------------------------------ */

  function elCiz(kartlar) {
    var gecerli = {};
    var i;

    for (i = 0; i < kartlar.length; i++) {
      var k = kartlar[i];
      gecerli[k.uid] = true;
      var el = elKartlari[k.uid];
      if (!el) {
        el = global.KartUI.olustur(k, { bedel: k.bedel, tiklanir: true });
        elKartlari[k.uid] = el;
        elAlan.appendChild(el);
        el.style.opacity = '0';
        surukleBagla(el, k);
        (function (kk) {
          Ipucu.bagla(el, function () {
            if (secili || islemde) return null;
            var def = global.KARTLAR[kk.id];
            if (def.tur !== 'guc' && !def.tuket && !def.eldeKalir) return null;
            return { baslik: global.DIL.v('kart', kk.id, 'ad', def.ad), metin: global.T(
              def.tur === 'guc' ? 'Güç kartı: savaş boyunca etkisini sürdürür.'
              : def.tuket ? 'Tüketilir: bu savaşta bir daha gelmez.'
              : 'Elde kalır: tur sonunda atılmaz.') };
          });
        })(k);
      }
      // bedel değişmiş olabilir (Kor Zinciri, Kül Eleği vb.)
      var bedelEl = el.querySelector('.kart-bedel span');
      if (bedelEl) bedelEl.textContent = k.bedel === -1 ? 'X' : k.bedel;
      el.classList.toggle('oynanamaz', !k.oynanabilir);
      el.classList.toggle('secili', secili === k.uid);
    }

    // Elde olmayanları kaldır. Oynanan/tüketilen kart yanarak gider;
    // tur sonunda atılanlar sessizce kayar.
    for (var uid in elKartlari) {
      if (gecerli[uid]) continue;
      var eski = elKartlari[uid];
      var yansin = !!yanacaklar[uid];
      delete elKartlari[uid];
      delete yanacaklar[uid];
      if (!eski.parentNode) continue;
      eski.style.pointerEvents = 'none';
      if (yansin && global.Yanma) {
        (function (e) {
          global.Yanma.yak(e, { sure: 560, renk: '#ff8a2b',
                                sonra: function () { e.remove(); } });
        })(eski);
      } else {
        eski.classList.add('oynaniyor');
        (function (e) { setTimeout(function () { e.remove(); }, 300); })(eski);
      }
    }

    konumla(kartlar);
  }

  function konumla(kartlar) {
    var n = kartlar.length;
    if (!n) return;
    var genislik = elAlan.clientWidth;
    var ornek = elKartlari[kartlar[0].uid];
    var kw = ornek ? ornek.offsetWidth || 132 : 132;
    // Dar ekranda enerji küresi ve "Turu Bitir" elin iki ucunda duruyor;
    // yelpazeyi içeri alarak onların üstüne binmesini engelliyoruz.
    var kenar = genislik < 560 ? 58 : 0;
    var kullanilir = genislik - kenar * 2;
    var aralik = Math.min(kw * 0.84, Math.max(24, (kullanilir - kw) / Math.max(1, n - 1)));
    var toplam = aralik * (n - 1);
    var basX = kenar + (kullanilir - kw) / 2 - toplam / 2;
    // Dar ekranda yelpazeyi düzleştir: dönen kartların köşeleri taşıyor
    var enBuyukAci = genislik < 520 ? 2.4 : 4.2;
    var aciAdim = Math.min(enBuyukAci, 24 / Math.max(1, n));

    for (var i = 0; i < n; i++) {
      var el = elKartlari[kartlar[i].uid];
      if (!el) continue;
      var fark = i - (n - 1) / 2;
      var x = basX + i * aralik;
      var y = Math.abs(fark) * Math.min(4.5, 22 / n) * 0.9;
      var aci = fark * aciAdim;
      el._taban = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + aci.toFixed(2) + 'deg)';
      el._merkezX = x + kw / 2;          // dokunmatik gezinme bunu kullanıyor
      el.style.opacity = '1';
      if (el._surukleniyor || el.dataset.uid === incelenen) continue;
      el.style.zIndex = 10 + i;
      el.style.transform = el._taban;
    }
    if (incelenen) incelemeCiz();
  }

  /**
   * Oynanan kart türüne göre farklı yol izler ve yolun sonunda yanar:
   *   saldırı → hedef düşmanın üstüne uçar (alan saldırısı sıranın ortasına)
   *   güç     → oyuncunun içine çekilir
   *   beceri  → oyuncunun üstünde durur
   */
  function kartUcur(uid, tur, hedefRef) {
    var el = elKartlari[uid];
    if (!el) return;
    var kw = el.offsetWidth, kh = el.offsetHeight;
    var ar = elAlan.getBoundingClientRect();
    var H = elAlan.clientHeight;
    var hedefEl = hedefRef ? varlikEl(hedefRef) : null;

    var m, olcek, donme = 0, sure = 300;
    if (tur === 'saldiri') {
      m = hedefEl ? FX.merkez(hedefEl.querySelector('.varlik-art'))
                  : FX.merkez(dusmanSirasi);
      olcek = 0.5;
      donme = (uid.charCodeAt(uid.length - 1) % 2 ? 1 : -1) * (9 + (uid.length % 7));
      sure = 260;
      oyuncuHamle();
    } else if (tur === 'guc') {
      m = FX.merkez(document.getElementById('oyuncuArt'));
      olcek = 0.28; sure = 340;
    } else {
      m = FX.merkez(document.getElementById('oyuncuArt'));
      m = { x: m.x, y: m.y - 34 };
      olcek = 0.62;
    }

    // elAlan koordinatına çevir. Kart `bottom:18px; left:0` ile duruyor,
    // yani dönüşümsüz sol-üst köşesi (0, H − 18 − kh) noktasında.
    var tx = (m.x - ar.left) - kw / 2;
    var ty = (m.y - ar.top) - kh / 2 - (H - 18 - kh);

    // Yelpazede eksen 50% 130% (kartların alttan açılması için). Uçarken
    // merkeze alınmazsa ölçek ve dönüş kartı hesaplanan noktadan kaydırır.
    el.style.transformOrigin = '50% 50%';
    el.style.transition = 'transform ' + sure + 'ms cubic-bezier(.35,.85,.4,1)';
    el.style.zIndex = 70;
    el.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) ' +
                         'scale(' + olcek + ') rotate(' + donme + 'deg)';
  }

  /** Oyuncu saldırırken öne hamle yapar */
  function oyuncuHamle() {
    oyuncuGorsel.classList.remove('hamle');
    void oyuncuGorsel.offsetWidth;
    oyuncuGorsel.classList.add('hamle');
    setTimeout(function () { oyuncuGorsel.classList.remove('hamle'); }, 360);
  }

  /* ------------------------------------------------------------------ */
  /*  Sürükleme / seçim                                                  */
  /* ------------------------------------------------------------------ */

  /* --------------------------------------------------------------------
     DOKUNMATİK: farede imleçle kartın üstüne gelmek kartı okunur kılıyor,
     telefonda böyle bir şey yok — dokunmak kartı doğrudan oynuyordu ve
     enerji boşa gidiyordu. Yeni davranış:

       basılı tut          → parmağın altındaki kart büyür, okunur olur
       yatay kaydır        → eldeki kartlar arasında gezinir
       yukarı çek          → oynama kipi; düşmanlar hedeflenebilir olur
       bırak (yukarı değil)→ hiçbir şey olmaz, kart incelenmiş kalır
       ikinci dokunuş      → oynar (hedefli kartta hedef seçimine geçer)

     Fare davranışı aynen korunuyor.
     -------------------------------------------------------------------- */

  var incelenen = null;       // dokunmatikte büyütülmüş kartın uid'i
  var OYNAMA_ESIGI = 64;      // bu kadar yukarı çekilince oynama kipine geçer

  function dokunmatikMi(e) { return !!e.pointerType && e.pointerType !== 'mouse'; }

  /** Yerleşim merkezine göre parmağın altındaki kart */
  function kartAltinda(clientX) {
    if (!s || !s.el.length) return null;
    var ar = elAlan.getBoundingClientRect();
    var x = clientX - ar.left;
    var enIyi = null, enYakin = Infinity;
    for (var i = 0; i < s.el.length; i++) {
      var el = elKartlari[s.el[i].uid];
      if (!el || el._merkezX === undefined) continue;
      var d = Math.abs(x - el._merkezX);
      if (d < enYakin) { enYakin = d; enIyi = s.el[i].uid; }
    }
    return enIyi;
  }

  function incele(uid) {
    if (incelenen === uid) return;
    incelenen = uid;
    elAlan.classList.toggle('incelemeVar', !!uid);
    if (uid) global.SES.gez();
    incelemeCiz();
  }

  function incelemeCiz() {
    for (var u in elKartlari) {
      var el = elKartlari[u];
      if (el._surukleniyor) continue;
      if (u === incelenen) {
        var kw = el.offsetWidth, kh = el.offsetHeight;
        var olcek = Math.min(2.1, Math.max(1.35, 190 / kw));
        var yariG = (kw * olcek) / 2;
        var merkez = Math.max(yariG + 4,
                     Math.min(elAlan.clientWidth - yariG - 4, el._merkezX || 0));
        var t = parseTaban(el._taban || '');
        var kaldir = (kh * (olcek - 1)) / 2 + 46;
        el.classList.add('incelenen');
        el.style.transformOrigin = '50% 50%';
        el.style.zIndex = 58;
        el.style.transform = 'translate(' + (merkez - kw / 2).toFixed(1) + 'px,' +
                             (t.y - kaldir).toFixed(1) + 'px) scale(' + olcek.toFixed(2) + ')';
      } else {
        el.classList.remove('incelenen');
        el.style.transform = el._taban || '';
        el.style.zIndex = '';
      }
    }
  }

  function incelemeBirak() {
    if (!incelenen) return;
    incelenen = null;
    elAlan.classList.remove('incelemeVar');
    incelemeCiz();
  }

  function surukleBagla(el, kart) {
    var basX = 0, basY = 0, aktif = false, tasindi = false, pid = null;
    var dokunma = false, oynamaKipi = false, ikinciDokunus = false;
    var suruklenenUid = null;

    // Kaldırma yalnızca fare için: dokunmatikte pointerenter parmak
    // değdiğinde tetiklenir ve kart havada asılı kalırdı.
    el.addEventListener('pointerenter', function (e) {
      if (dokunmatikMi(e)) return;
      if (islemde || el._surukleniyor) return;
      global.SES.gez();
      el.style.transform = (el._taban || '') + ' translateY(-30px) scale(1.14) rotate(0deg)';
      el.style.zIndex = 55;
    });
    el.addEventListener('pointerleave', function (e) {
      if (dokunmatikMi(e) || el._surukleniyor) return;
      el.style.transform = el._taban || '';
      el.style.zIndex = '';
    });

    el.addEventListener('pointerdown', function (e) {
      if (islemde || !C) return;
      if (!elKartiVerisi(kart.uid)) return;
      aktif = true; tasindi = false; oynamaKipi = false;
      dokunma = dokunmatikMi(e);
      pid = e.pointerId;
      basX = e.clientX; basY = e.clientY;
      suruklenenUid = kart.uid;
      el.setPointerCapture(pid);
      e.preventDefault();

      if (dokunma) {
        ikinciDokunus = (incelenen === kart.uid);
        incele(kart.uid);
      }
    });

    el.addEventListener('pointermove', function (e) {
      if (!aktif) return;
      var dx = e.clientX - basX, dy = e.clientY - basY;

      if (dokunma && !oynamaKipi) {
        // Yukarı çekildi mi? Oynama kipine geç.
        if (dy < -OYNAMA_ESIGI) {
          oynamaKipi = true;
          incelemeBirak();
          basX = e.clientX; basY = e.clientY;   // sürüklemeyi buradan başlat
        } else {
          // Yatay gezinme: parmağın altındaki kart incelenir
          var u = kartAltinda(e.clientX);
          if (u && u !== incelenen) { suruklenenUid = u; ikinciDokunus = false; incele(u); }
          return;
        }
      }

      if (!dokunma && !tasindi && Math.hypot(dx, dy) < 9) return;
      tasindi = true;

      var se = elKartlari[suruklenenUid] || el;
      se._surukleniyor = true;
      se.classList.add('suruklenen');
      se.classList.remove('incelenen');
      se.style.transformOrigin = '50% 50%';
      var t = parseTaban(se._taban || '');
      var ddx = e.clientX - basX, ddy = e.clientY - basY;
      se.style.transform = 'translate(' + (t.x + ddx) + 'px,' + (t.y + ddy) + 'px) scale(1.06)';
      se.style.zIndex = 62;
      hedefVurgula(e.clientX, e.clientY);
    });

    function bitir(e) {
      if (!aktif) return;
      aktif = false;
      if (pid !== null) { try { el.releasePointerCapture(pid); } catch (x) {} pid = null; }
      hedefVurgusuTemizle();

      var se = elKartlari[suruklenenUid] || el;
      se._surukleniyor = false;
      se.classList.remove('suruklenen');

      var k = elKartiVerisi(suruklenenUid);
      if (!k) { se.style.transform = se._taban || ''; incelemeBirak(); return; }

      // --- dokunmatik ---
      if (dokunma) {
        if (!oynamaKipi) {
          // Parmak yukarı çekilmedi: kart oynanmaz. İkinci dokunuşsa oynanır.
          if (ikinciDokunus && !tasindi) { incelemeBirak(); tiklandi(k); }
          else incelemeCiz();
          return;
        }
        // Oynama kipi: hedefe bırakıldıysa oyna
        var def2 = global.KARTLAR[k.id];
        if (def2.hedef === 'dusman') {
          var i2 = noktadakiDusman(e.clientX, e.clientY);
          if (i2 >= 0) { incelemeBirak(); oynaKart(k, i2); return; }
        } else if (e.clientY < document.getElementById('altPanel').getBoundingClientRect().top) {
          incelemeBirak(); oynaKart(k, 0); return;
        }
        incelemeBirak();
        se.style.transform = se._taban || '';
        se.style.zIndex = '';
        return;
      }

      // --- fare ---
      if (!tasindi) { tiklandi(k); return; }
      var def = global.KARTLAR[k.id];
      var altUst = document.getElementById('altPanel').getBoundingClientRect().top;
      if (def.hedef === 'dusman') {
        var idx = noktadakiDusman(e.clientX, e.clientY);
        if (idx >= 0) { oynaKart(k, idx); return; }
      } else if (e.clientY < altUst) {
        oynaKart(k, 0); return;
      }
      se.style.transform = se._taban || '';
      se.style.zIndex = '';
    }

    el.addEventListener('pointerup', bitir);
    el.addEventListener('pointercancel', bitir);
  }

  function parseTaban(t) {
    var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(t || '');
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function elKartiVerisi(uid) {
    if (!s) return null;
    for (var i = 0; i < s.el.length; i++) if (s.el[i].uid === uid) return s.el[i];
    return null;
  }

  function tiklandi(k) {
    if (!k.oynanabilir) {
      global.SES.tik();
      FX.sayi(global.innerWidth / 2, global.innerHeight * 0.62, global.T('Yeterli enerji yok'),
              { renk: '#e0484a', boy: 18 });
      return;
    }
    var def = global.KARTLAR[k.id];
    if (def.hedef === 'dusman') {
      secili = (secili === k.uid) ? null : k.uid;
      seciliIksir = null;
      global.SES.tik();
      elCiz(s.el);
      hedeflenebilirlikTazele();
    } else {
      oynaKart(k, 0);
    }
  }

  function oynaKart(k, hedefIdx) {
    if (islemde || !C) return;
    secimiBirak();
    if (!C.kartOyna(k.uid, hedefIdx)) { elCiz(s.el); return; }
    oynat();
  }

  function dusmanaTikla(idx) {
    if (islemde || !C) return;
    if (seciliIksir !== null) {
      var slot = seciliIksir;
      seciliIksir = null;
      hedeflenebilirlikTazele();
      C.iksirKullan(slot, idx);
      oynat();
      return;
    }
    if (!secili) return;
    var k = elKartiVerisi(secili);
    if (!k) { secimiBirak(); return; }
    oynaKart(k, idx);
  }

  function secimiBirak() {
    incelemeBirak();
    if (!secili && seciliIksir === null) return;
    secili = null; seciliIksir = null;
    if (s) elCiz(s.el);
    hedeflenebilirlikTazele();
  }

  function hedeflenebilirlikTazele() {
    var hedefGerek = !!secili || seciliIksir !== null;
    for (var i = 0; i < dusmanEl.length; i++) {
      var canli = s && s.dusmanlar[i] && !s.dusmanlar[i].olu;
      dusmanEl[i].classList.toggle('hedeflenebilir', !!canli);
      dusmanEl[i].classList.toggle('hedefVurgu', hedefGerek && !!canli);
    }
  }

  function hedefVurgula(x, y) {
    var idx = noktadakiDusman(x, y);
    for (var i = 0; i < dusmanEl.length; i++) {
      dusmanEl[i].classList.toggle('hedefVurgu', i === idx);
    }
  }
  function hedefVurgusuTemizle() {
    for (var i = 0; i < dusmanEl.length; i++) dusmanEl[i].classList.remove('hedefVurgu');
  }

  function noktadakiDusman(x, y) {
    for (var i = 0; i < dusmanEl.length; i++) {
      if (!s || !s.dusmanlar[i] || s.dusmanlar[i].olu) continue;
      var r = dusmanEl[i].getBoundingClientRect();
      // hedefleme alanını cömert tut
      if (x >= r.left - 26 && x <= r.right + 26 && y >= r.top - 40 && y <= r.bottom + 20) return i;
    }
    return -1;
  }

  /* ------------------------------------------------------------------ */
  /*  İksir                                                              */
  /* ------------------------------------------------------------------ */

  function iksirTikla(slot) {
    if (islemde || !C) return false;
    var iks = C.run.iksirler[slot];
    if (!iks) return false;
    var def = global.IKSIRLER[iks.id];
    if (def.hedef === 'dusman') {
      seciliIksir = (seciliIksir === slot) ? null : slot;
      secili = null;
      global.SES.tik();
      if (s) elCiz(s.el);
      hedeflenebilirlikTazele();
      return true;
    }
    C.iksirKullan(slot, 0);
    oynat();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Yardımcı pencereler                                                */
  /* ------------------------------------------------------------------ */

  function yiginGoster(baslik, kartlar, gizli) {
    if (!C) return;
    global.SES.tik();
    var kap = U.el('div', 'deste-izgara');
    if (!kartlar.length) {
      kap = U.el('p', null, global.T('Burada hiç kart yok.'));
      kap.style.textAlign = 'center';
      kap.style.color = 'var(--kul2)';
    } else {
      var liste = gizli ? kartlar.slice().sort(function (a, b) {
        return global.KARTLAR[a.id].ad.localeCompare(global.KARTLAR[b.id].ad, 'tr');
      }) : kartlar.slice().reverse();
      liste.forEach(function (k) { kap.appendChild(global.KartUI.olustur(k, { boy: 'kucuk' })); });
    }
    Pencere.ac({
      baslik: baslik,
      not: gizli ? global.T('Sıra gizli — kartlar alfabetik listelendi') : null,
      govde: kap, genislik: 'genis',
      dugmeler: [{ yazi: global.T('Kapat') }]
    });
  }

  function secimPenceresi() {
    var sec = C.secim;
    var kap = U.el('div');
    kap.style.cssText = 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap';
    sec.kartlar.forEach(function (k) {
      var saran = U.el('div', 'odul-kart');
      var kart = global.KartUI.olustur(k, { tiklanir: true });
      saran.appendChild(kart);
      saran.onclick = function () {
        global.SES.dugme();
        Pencere.kapat();
        C.secimYap(k.uid);
        oynat();
      };
      kap.appendChild(saran);
    });
    Pencere.ac({
      baslik: global.T(sec.baslik), govde: kap, kapatilabilir: false, xIle: false,
      dugmeler: sec.atlanabilir === false ? [] : [{
        yazi: global.T('Hiçbiri'), ol: function () { C.secimYap(null); oynat(); }
      }]
    });
  }

  function girdiKilit(kilit) {
    turDugme.disabled = kilit;
    turDugme.classList.toggle('hazir', !kilit);
    elAlan.style.pointerEvents = kilit ? 'none' : '';
    dusmanSirasi.style.pointerEvents = kilit ? 'none' : '';
  }

  /** Klavye kısayolu: elindeki i. kartı oyna (hedef gerekirse ilk canlı düşman) */
  function kisayolOyna(i) {
    if (islemde || !C || !s) return;
    var k = s.el[i];
    if (!k) return;
    if (!k.oynanabilir) { tiklandi(k); return; }
    var def = global.KARTLAR[k.id];
    var hedef = 0;
    if (def.hedef === 'dusman') {
      var canli = C.canliDusmanlar();
      if (!canli.length) return;
      hedef = canli[0].idx;
    }
    oynaKart(k, hedef);
  }

  global.SavasEkrani = {
    kur: kur, basla: basla, hizAyar: hizAyar,
    iksirTikla: iksirTikla, kisayolOyna: kisayolOyna,
    hizCarpani: function () { return hiz; },
    // otomatik test için: dokunmatik gezinme mantığını dışarıdan sınamak
    hataAyikla: { kartAltinda: function (x) { return kartAltinda(x); },
                  incelenen: function () { return incelenen; } },
    islemdeMi: function () { return islemde; },
    aktifMi: function () { return !!C; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
