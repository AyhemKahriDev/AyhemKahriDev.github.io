/* =========================================================================
   TARAYICI SÜRÜCÜSÜ — arayüzü baştan sona otomatik oynatır.
   ---------------------------------------------------------------------
   Kullanım: oyunu aç, geliştirici konsoluna bu dosyanın içeriğini yapıştır.
   Sonuç:  __t  nesnesinde birikir →  copy(JSON.stringify(__t))
   Node testleri oyun mantığını doğrular; bu sürücü ARAYÜZ entegrasyonunu
   doğrular: pencere akışları, ödül zincirleri, olay kuyruğu, savaş girdisi.
   ========================================================================= */
(function () {
  'use strict';

  window.__t = { adim: 0, log: [], hata: [], bitti: false, oda: {}, kosu: 0 };
  var T = window.__t;

  window.onerror = function (m, s, l) {
    T.hata.push(m + ' @' + String(s).split('/').pop() + ':' + l);
  };
  window.addEventListener('unhandledrejection', function (e) {
    T.hata.push('promise: ' + e.reason);
  });

  var bek = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var baslik = function () { var e = q('.pnc-bas h2'); return e ? e.textContent : ''; };
  var acikMi = function () { return !q('#pencere').hidden; };

  function pncTikla(re) {
    var b = qa('.pnc-alt .dugme').filter(function (x) { return re.test(x.textContent); })[0];
    if (b) { b.click(); return true; }
    return false;
  }
  function rast(dizi) { return dizi[Math.floor(Math.random() * dizi.length)]; }

  // Aynı anda birden fazla sürücü koşarsa birbirlerinin pencerelerini
  // tıklayıp sahte "takıldı" raporları üretiyorlar. Tek örnek garantisi:
  window.__surucuNesil = (window.__surucuNesil || 0) + 1;
  var nesil = window.__surucuNesil;
  window.__surucuDurdur = function () { window.__surucuNesil++; };

  window.__surucuBaslat = async function (kosuSayisi) {
    kosuSayisi = kosuSayisi || 1;
    localStorage.clear();

    for (var k = 0; k < kosuSayisi && nesil === window.__surucuNesil; k++) {
      T.kosu = k + 1;
      T.bitti = false;
      if (!q('#ekran-menu.aktif')) { window.Oyun.menuyeDon(); await bek(200); }
      var yeni = qa('#menuDugmeler .ana-dugme').filter(function (b) {
        return /Yeni/.test(b.textContent); })[0];
      yeni.click(); await bek(300);
      if (acikMi() && /Yeni koşu\?/.test(baslik())) { pncTikla(/Yeni koşu başlat/); await bek(300); }

      var sonBaslik = null, ayniSayac = 0;

      for (var i = 0; i < 900 && !T.bitti; i++) {
        if (nesil !== window.__surucuNesil) return T;   // yeni sürücü devraldı
        T.adim = i;
        await bek(35);

        if (acikMi()) {
          var b = baslik();

          /* Takılma dedektörü: aynı pencere uzun süre kapanmıyorsa (ör. bir
             ödülü reddedince ödül ekranı yeniden açılıyor ve sürücü onu
             sonsuza dek tıklıyor) alttaki son düğmeye basıp çık. Oyun için
             kusur değil — insan zaten "Devam"a basar — ama sürücünün
             ilerlemesi gerekiyor. */
          if (b === sonBaslik) ayniSayac++; else { sonBaslik = b; ayniSayac = 0; }
          if (ayniSayac > 30) {
            var son = qa('.pnc-alt .dugme');
            if (son.length) { son[son.length - 1].click(); ayniSayac = 0; continue; }
            T.hata.push('kapanmayan pencere: "' + b + '"');
            T.bitti = true; break;
          }
          if (q('.son-baslik')) {
            T.log.push('koşu ' + T.kosu + ' → ' + q('.son-baslik').textContent);
            pncTikla(/Ana menü/); await bek(300);
            T.bitti = true; break;
          }
          if (/Bir kart seç/.test(b)) { var kk = q('.odul-kart'); if (kk) kk.click(); else pncTikla(/Hiçbir/); continue; }
          if (/Yükseltilecek|Yakılacak|Kuyuya|Çoğaltılacak|Unutulacak|Destenden bir kart/.test(b)) {
            var s1 = q('.odul-kart') || q('.pnc .deste-izgara > div');
            if (s1) s1.click(); else pncTikla(/Vazgeç|Hiçbir/);
            continue;
          }
          if (/Patron yadigârı/.test(b)) { var y1 = q('.secenek'); if (y1) y1.click(); continue; }
          if (/^Zafer$/.test(b)) {
            T.oda.savas = (T.oda.savas || 0) + 1;
            qa('.odul').forEach(function (x) { x.click(); });
            await bek(140);
            if (acikMi() && /Bir kart seç/.test(baslik())) {
              var kc = q('.odul-kart'); if (kc) kc.click(); await bek(220);
            }
            if (acikMi()) pncTikla(/Devam/);
            continue;
          }
          if (/Kamp/.test(b)) { T.oda.kamp = (T.oda.kamp || 0) + 1; var c1 = q('.secenek:not([disabled])'); if (c1) c1.click(); continue; }
          if (/Dükkan/.test(b)) { T.oda.dukkan = (T.oda.dukkan || 0) + 1; pncTikla(/Ayrıl/); continue; }
          if (/Hazine/.test(b)) { T.oda.hazine = (T.oda.hazine || 0) + 1; pncTikla(/Sandığı aç/); continue; }
          if (/Yadigâr/.test(b)) { pncTikla(/^Al$/); continue; }
          if (/Perde .* bitti/.test(b)) { T.log.push(b); pncTikla(/Devam/); continue; }
          if (/İksir yuvan dolu/.test(b)) {
            if (Math.random() < 0.5) { var sw = q('.satilik-sey'); if (sw) { sw.click(); continue; } }
            pncTikla(/Yeni iksiri bırak/); continue;
          }

          var secenekler = qa('.secenek').filter(function (x) { return !x.disabled; });
          if (secenekler.length) { T.oda.olay = (T.oda.olay || 0) + 1; rast(secenekler).click(); continue; }
          if (pncTikla(/Devam|Tamam|Kapat|^Al$/)) continue;
          T.hata.push('çözülemeyen pencere: "' + b + '"');
          T.bitti = true; break;
        }

        var C = window.aktifSavas;
        if (C) {
          if (window.SavasEkrani.islemdeMi()) { await bek(70); continue; }
          var g = C.gorsel(), oynandi = false;
          for (var j = 0; j < g.el.length; j++) {
            if (g.el[j].oynanabilir) { window.SavasEkrani.kisayolOyna(j); oynandi = true; break; }
          }
          if (!oynandi) q('#turBitirDugme').click();
          await bek(110);
          continue;
        }

        var dugumler = qa('.harita-dugum.acik');
        if (dugumler.length) { rast(dugumler).click(); await bek(140); continue; }
        await bek(110);
      }
      if (!T.bitti) T.hata.push('koşu ' + T.kosu + ' adım sınırına takıldı');
    }
    T.log.push('bitti — toplam hata: ' + T.hata.length);
    return T;
  };

  console.log('Sürücü hazır. Çalıştır:  __surucuBaslat(3)');
})();
