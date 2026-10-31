/* =========================================================================
   EKRAN GEÇİŞİ — kül dağılması
   ---------------------------------------------------------------------
   Ekranlar anlık değişmesin: giden ekran ısınıp külleniyor, gelen ekran
   külün arasından beliriyor. İki evreli:
     1) örtü koyulaşır + kül yükselir  → ekran değiştirilir
     2) örtü açılır, kül dağılır
   Tüm dokular CSS gradyanı ve FX parçacıkları; dosya yok.
   ========================================================================= */
(function (global) {
  'use strict';

  var ortu = null;
  var mesgul = false;

  function kur() {
    if (ortu) return;
    ortu = document.createElement('div');
    ortu.id = 'gecisOrtu';
    ortu.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ortu);
  }

  function kulSal(yon) {
    if (!global.FX) return;
    var W = global.innerWidth, H = global.innerHeight;
    var n = Math.min(60, Math.round(W / 22));
    for (var i = 0; i < n; i++) {
      var x = Math.random() * W;
      var y = yon === 'cikis' ? H * (0.55 + Math.random() * 0.5)
                              : H * (0.2 + Math.random() * 0.7);
      global.FX.kor(x, y, 1);
    }
  }

  /**
   * @param ortada  ekranı değiştiren geri çağırma (iki evre arasında çalışır)
   * @param bitti   isteğe bağlı
   */
  function gecis(ortada, bitti) {
    kur();
    if (mesgul) {                       // üst üste binmesin
      if (ortada) ortada();
      if (bitti) bitti();
      return;
    }
    mesgul = true;

    var hizli = global.SavasEkrani && global.SavasEkrani.hizCarpani
              ? global.SavasEkrani.hizCarpani() : 1;
    var d1 = 260 / hizli, d2 = 340 / hizli;

    ortu.classList.add('kapan');
    kulSal('cikis');
    if (global.SES) global.SES.gecis && global.SES.gecis();

    setTimeout(function () {
      if (ortada) ortada();
      kulSal('giris');
      ortu.classList.remove('kapan');
      ortu.classList.add('acil');
      setTimeout(function () {
        ortu.classList.remove('acil');
        mesgul = false;
        if (bitti) bitti();
      }, d2);
    }, d1);
  }

  global.Gecis = { gecis: gecis, kur: kur,
                   mesgulMu: function () { return mesgul; } };
})(typeof window !== 'undefined' ? window : globalThis);
