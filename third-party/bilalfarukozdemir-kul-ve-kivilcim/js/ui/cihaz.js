/* =========================================================================
   CİHAZ — tam ekran ve yatay mod
   ---------------------------------------------------------------------
   Telefonda oyun yatayda belirgin biçimde daha iyi duruyor (kartlar
   birbirini örtmüyor, düşmanlar büyük). Zorlayamayız: yön kilidi yalnızca
   tam ekranda ve yalnızca bazı tarayıcılarda çalışıyor (Android Chrome
   evet, iOS Safari hayır). O yüzden yaklaşım şu:
     · dikeyken kapatılabilir bir öneri göster
     · tam ekran düğmesi sun, tam ekrana geçince yatay kilidi DENE
     · kilit tutmazsa oyun yine oynanır, sadece öneri görünür kalır
   ========================================================================= */
(function (global) {
  'use strict';

  var oneriEl = null;
  var kapatildi = false;

  function dokunmatikMi() {
    return ('ontouchstart' in global) || (navigator.maxTouchPoints || 0) > 0;
  }

  function telefonMu() {
    // Kısa kenarı 560px altındaki dokunmatik cihazlar
    return dokunmatikMi() && Math.min(global.innerWidth, global.innerHeight) < 560;
  }

  function dikeyMi() { return global.innerHeight > global.innerWidth; }

  function tamEkranMi() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* ------------------------------------------------------------------ */

  function tamEkranAc() {
    var e = document.documentElement;
    var istek = e.requestFullscreen || e.webkitRequestFullscreen;
    if (!istek) return Promise.reject(new Error('desteklenmiyor'));
    return Promise.resolve(istek.call(e)).then(function () {
      // Yön kilidi yalnızca tam ekranda anlamlı; desteklenmezse sessizce geç
      try {
        if (screen.orientation && screen.orientation.lock) {
          return screen.orientation.lock('landscape').catch(function () {});
        }
      } catch (x) {}
    });
  }

  function tamEkranKapat() {
    var c = document.exitFullscreen || document.webkitExitFullscreen;
    if (c) { try { c.call(document); } catch (x) {} }
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (x) {}
  }

  function tamEkranDegistir() {
    if (tamEkranMi()) { tamEkranKapat(); return Promise.resolve(); }
    return tamEkranAc().catch(function () {});
  }

  /* ------------------------------------------------------------------ */
  /*  "Yatay çevir" önerisi                                              */
  /* ------------------------------------------------------------------ */

  function oneriKur() {
    if (oneriEl) return;
    oneriEl = document.createElement('div');
    oneriEl.id = 'yatayOneri';
    oneriEl.hidden = true;
    oneriEl.innerHTML =
      '<div class="yo-ic">' +
        '<div class="yo-telefon"><span></span></div>' +
        '<div class="yo-baslik"></div>' +
        '<div class="yo-alt"></div>' +
        '<div class="yo-dugmeler">' +
          '<button class="dugme birincil" data-rol="tam"></button>' +
          '<button class="dugme" data-rol="kapat"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(oneriEl);

    oneriEl.querySelector('[data-rol="tam"]').onclick = function () {
      if (global.SES) global.SES.dugme();
      tamEkranAc().catch(function () {}).then(function () { gizle(); });
    };
    oneriEl.querySelector('[data-rol="kapat"]').onclick = function () {
      if (global.SES) global.SES.tik();
      kapatildi = true;
      gizle();
    };
  }

  function metinleriYaz() {
    if (!oneriEl) return;
    var T = global.T || function (x) { return x; };
    oneriEl.querySelector('.yo-baslik').textContent = T('Telefonu yatay çevir');
    oneriEl.querySelector('.yo-alt').textContent =
      T('Oyun yatayda çok daha rahat oynanıyor: kartlar birbirini örtmüyor.');
    oneriEl.querySelector('[data-rol="tam"]').textContent = T('Tam ekran');
    oneriEl.querySelector('[data-rol="kapat"]').textContent = T('Böyle devam et');
  }

  function goster() { oneriKur(); metinleriYaz(); oneriEl.hidden = false; }
  function gizle() { if (oneriEl) oneriEl.hidden = true; }

  function tazele() {
    if (!telefonMu() || kapatildi) { gizle(); return; }
    if (dikeyMi()) goster(); else gizle();
  }

  /* ------------------------------------------------------------------ */

  function kur() {
    if (!telefonMu()) return;
    oneriKur();
    tazele();
    global.addEventListener('resize', tazele);
    global.addEventListener('orientationchange', function () {
      setTimeout(tazele, 220);
    });
  }

  global.Cihaz = {
    kur: kur, tazele: tazele,
    tamEkranDegistir: tamEkranDegistir, tamEkranMi: tamEkranMi,
    telefonMu: telefonMu, dokunmatikMi: dokunmatikMi,
    tamEkranDestekli: function () {
      var e = document.documentElement;
      return !!(e.requestFullscreen || e.webkitRequestFullscreen);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
