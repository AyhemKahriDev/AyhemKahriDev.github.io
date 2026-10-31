/* =========================================================================
   YANARAK YOK OLMA
   ---------------------------------------------------------------------
   Bir DOM ögesini gürültü haritasıyla aşındırıp yok eder; aşınan kenarda
   turuncu bir kor hattı bırakır ve oradan kıvılcım salar.

   Nasıl çalışıyor:
     feTurbulence bir gürültü dokusu üretir. feColorMatrix o dokunun R
     kanalını alfaya taşırken bir eşik (T) çıkarır → alfa = R − T. T büyüdükçe
     gürültünün düşük bölgeleri şeffaflaşır, yani ögenin alfası düzensiz
     biçimde erir. Aynı gürültü ikinci kez, biraz daha büyük eşikle
     uygulanınca iki maskenin farkı "az sonra yanacak olan" ince bandı verir;
     o bant turuncuya boyanıp bulanıklaştırılarak kor hattı olur.
   ========================================================================= */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var kap = null;          // filtrelerin yaşadığı gizli <svg>
  var sayac = 0;
  var destekli = null;

  function kur() {
    if (kap) return;
    kap = document.createElementNS(NS, 'svg');
    kap.setAttribute('width', '0');
    kap.setAttribute('height', '0');
    kap.setAttribute('aria-hidden', 'true');
    kap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;' +
                        'pointer-events:none';
    document.body.appendChild(kap);
  }

  /** SVG filtresi HTML ögesine uygulanabiliyor mu? */
  function destekVar() {
    if (destekli !== null) return destekli;
    destekli = typeof document.createElementNS === 'function' &&
               typeof global.CSS !== 'undefined' && !!global.CSS.supports &&
               global.CSS.supports('filter', 'url(#x)');
    return destekli;
  }

  function el(ad, ozellikler) {
    var e = document.createElementNS(NS, ad);
    for (var k in ozellikler) e.setAttribute(k, ozellikler[k]);
    return e;
  }

  /**
   * a = (R − T) · k
   * k (eğim) olmadan geçiş çok yumuşak kalıyor ve yanma "serpiştirilmiş
   * delikler" gibi görünüyor; eğim yükseldikçe net bir yanma cephesi oluşur.
   */
  var EGIM = 7;
  function alfaEsik(T) {
    return '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ' +
           EGIM + ' 0 0 0 ' + (-T * EGIM).toFixed(4);
  }

  /**
   * @param hedef  DOM ögesi
   * @param o      {sure, renk, kabalik, kivilcim, sonra}
   */
  function yak(hedef, o) {
    o = o || {};
    var sure = o.sure || 620;
    var renk = o.renk || '#ff7a1a';
    var band = o.band || 0.075;            // kor hattının kalınlığı
    var sonra = o.sonra || function () {};

    if (!hedef || !hedef.parentNode) { sonra(); return; }

    // Kıvılcımlar her hâlükârda — efekt çalışmasa bile bir şey görünsün
    var r = hedef.getBoundingClientRect();
    kivilcimSal(r, renk, sure);

    if (!destekVar()) { basitYedek(hedef, sure, sonra); return; }

    kur();
    var id = 'yanma' + (++sayac);
    var tohum = Math.floor(Math.random() * 9999);

    var f = el('filter', {
      id: id, x: '-25%', y: '-25%', width: '150%', height: '150%',
      'color-interpolation-filters': 'sRGB'
    });

    f.appendChild(el('feTurbulence', {
      type: 'fractalNoise', baseFrequency: o.kabalik || 0.055,
      numOctaves: 4, seed: tohum, result: 'gurultu'
    }));

    var m1 = el('feColorMatrix', { in: 'gurultu', type: 'matrix',
                                   values: alfaEsik(-0.2), result: 'maskeDis' });
    var m2 = el('feColorMatrix', { in: 'gurultu', type: 'matrix',
                                   values: alfaEsik(-0.2 + band), result: 'maskeIc' });
    f.appendChild(m1);
    f.appendChild(m2);

    f.appendChild(el('feComposite', { in: 'SourceGraphic', in2: 'maskeDis',
                                      operator: 'in', result: 'dis' }));
    f.appendChild(el('feComposite', { in: 'SourceGraphic', in2: 'maskeIc',
                                      operator: 'in', result: 'ic' }));
    // dış − iç = yanmakta olan ince bant
    f.appendChild(el('feComposite', { in: 'dis', in2: 'ic',
                                      operator: 'out', result: 'kenar' }));
    f.appendChild(el('feFlood', { 'flood-color': renk, result: 'renk' }));
    f.appendChild(el('feComposite', { in: 'renk', in2: 'kenar',
                                      operator: 'in', result: 'kor' }));
    f.appendChild(el('feGaussianBlur', { in: 'kor', stdDeviation: '2.4',
                                         result: 'korHale' }));

    var birlestir = el('feMerge', {});
    birlestir.appendChild(el('feMergeNode', { in: 'ic' }));
    birlestir.appendChild(el('feMergeNode', { in: 'korHale' }));
    birlestir.appendChild(el('feMergeNode', { in: 'kor' }));
    f.appendChild(birlestir);

    kap.appendChild(f);

    var eskiFiltre = hedef.style.filter;
    hedef.style.filter = 'url(#' + id + ')';
    hedef.style.pointerEvents = 'none';

    var bas = null;
    function adim(t) {
      if (bas === null) bas = t;
      var ilerleme = Math.min(1, (t - bas) / sure);
      // fractalNoise değerleri ~[0,1]; T bu aralığı süpürünce yanma
      // cephesi kartın üstünde gerçekten gezinir
      var T = -0.05 + ilerleme * 1.12;
      m1.setAttribute('values', alfaEsik(T));
      m2.setAttribute('values', alfaEsik(T + band));
      if (ilerleme < 1) { requestAnimationFrame(adim); return; }
      hedef.style.filter = eskiFiltre || '';
      if (f.parentNode) f.parentNode.removeChild(f);
      sonra();
    }
    requestAnimationFrame(adim);
  }

  /** Filtre desteklenmezse: kavrulma + küçülme */
  function basitYedek(hedef, sure, sonra) {
    hedef.style.transition = 'transform ' + sure + 'ms ease-in, opacity ' + sure + 'ms ease-in, filter ' + sure + 'ms';
    hedef.style.transformOrigin = '50% 60%';
    hedef.style.filter = 'brightness(1.7) sepia(.7) saturate(3)';
    hedef.style.opacity = '0';
    hedef.style.transform = (hedef.style.transform || '') + ' scale(.82) rotate(3deg)';
    setTimeout(sonra, sure);
  }

  /** Yanan alandan yükselen kıvılcımlar */
  function kivilcimSal(r, renk, sure) {
    if (!global.FX) return;
    var toplam = Math.max(10, Math.min(46, Math.round(r.width * r.height / 900)));
    var adet = 0;
    var aralik = setInterval(function () {
      for (var i = 0; i < 4 && adet < toplam; i++, adet++) {
        var x = r.left + Math.random() * r.width;
        var y = r.top + r.height * (0.25 + Math.random() * 0.75);
        global.FX.kor(x, y, 1);
      }
      if (adet >= toplam) clearInterval(aralik);
    }, Math.max(24, sure / 14));
    setTimeout(function () { clearInterval(aralik); }, sure + 120);
  }

  /** Kısa "kavruldu" parlaması — yok olmadan, sadece vurgulamak için */
  function kavur(hedef, sure) {
    if (!hedef) return;
    hedef.style.transition = 'filter ' + (sure || 220) + 'ms';
    hedef.style.filter = 'brightness(1.55) saturate(1.5)';
    setTimeout(function () { hedef.style.filter = ''; }, sure || 220);
  }

  global.Yanma = { yak: yak, kavur: kavur, destekVar: destekVar };
})(typeof window !== 'undefined' ? window : globalThis);
