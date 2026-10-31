/* =========================================================================
   KAYIT — localStorage. Koşu haritadayken otomatik kaydedilir.
   Savaşın ortasında çıkılırsa o odanın başından devam edilir.
   ========================================================================= */
(function (global) {
  'use strict';

  var ANAHTAR = 'kul_ve_kivilcim_kayit_v2';
  var IST_ANAHTAR = 'kul_ve_kivilcim_istatistik_v2';
  var AYAR_ANAHTAR = 'kul_ve_kivilcim_ayar_v2';

  function guvenli(fn, varsayilan) {
    try { return fn(); } catch (e) { return varsayilan; }
  }

  var Kayit = {
    var: function () {
      return guvenli(function () { return !!localStorage.getItem(ANAHTAR); }, false);
    },

    yaz: function (run, ekstra) {
      return guvenli(function () {
        var d = run.kaydet();
        if (ekstra) for (var k in ekstra) d[k] = ekstra[k];
        localStorage.setItem(ANAHTAR, JSON.stringify(d));
        return true;
      }, false);
    },

    oku: function () {
      return guvenli(function () {
        var s = localStorage.getItem(ANAHTAR);
        return s ? JSON.parse(s) : null;
      }, null);
    },

    sil: function () {
      return guvenli(function () { localStorage.removeItem(ANAHTAR); return true; }, false);
    },

    /* --- kalıcı istatistik / kilit açma ------------------------------ */

    istOku: function () {
      return guvenli(function () {
        var s = localStorage.getItem(IST_ANAHTAR);
        return s ? JSON.parse(s) : { kosu: 0, zafer: 0, enIyiPerde: 0, enIyiKat: 0,
                                     toplamOldurulen: 0, zorlukZafer: [0, 0, 0] };
      }, { kosu: 0, zafer: 0, enIyiPerde: 0, enIyiKat: 0, toplamOldurulen: 0,
           zorlukZafer: [0, 0, 0] });
    },

    istYaz: function (o) {
      return guvenli(function () {
        localStorage.setItem(IST_ANAHTAR, JSON.stringify(o)); return true;
      }, false);
    },

    kosuBitti: function (run, kazandi) {
      var o = Kayit.istOku();
      o.kosu++;
      if (kazandi) {
        o.zafer++;
        o.zorlukZafer[run.zorluk] = (o.zorlukZafer[run.zorluk] || 0) + 1;
      }
      if (run.perde > o.enIyiPerde ||
          (run.perde === o.enIyiPerde && run.kat > o.enIyiKat)) {
        o.enIyiPerde = run.perde; o.enIyiKat = run.kat;
      }
      o.toplamOldurulen += run.ist.oldurulen || 0;
      Kayit.istYaz(o);
      Kayit.sil();
      return o;
    },

    /* --- ayarlar ------------------------------------------------------ */

    ayarOku: function () {
      return guvenli(function () {
        var s = localStorage.getItem(AYAR_ANAHTAR);
        var d = s ? JSON.parse(s) : {};
        if (d.ses === undefined) d.ses = true;
        if (d.hiz === undefined) d.hiz = 1;
        if (d.sarsinti === undefined) d.sarsinti = true;
        if (d.muzik === undefined) d.muzik = true;
        if (d.muzikSeviye === undefined) d.muzikSeviye = 0.55;
        if (d.dil === undefined) {
          // İlk açılışta tarayıcı diline bak; Türkçe değilse İngilizce başlat
          var t = (navigator.language || 'tr').toLowerCase();
          d.dil = t.indexOf('tr') === 0 ? 'tr' : 'en';
        }
        return d;
      }, { ses: true, hiz: 1, sarsinti: true, muzik: true, muzikSeviye: 0.55, dil: 'tr' });
    },

    ayarYaz: function (o) {
      return guvenli(function () {
        localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(o)); return true;
      }, false);
    }
  };

  global.Kayit = Kayit;
})(typeof window !== 'undefined' ? window : globalThis);
