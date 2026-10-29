/* =========================================================================
   HARİTA EKRANI — dallanan yol, aşağıdan yukarı.
   Bağlantılar SVG, düğümler DOM.
   ========================================================================= */
(function (global) {
  'use strict';

  var U = global.U;

  var TIP = {
    savas:    { ikon: '⚔️', ad: 'Savaş' },
    elit:     { ikon: '💀', ad: 'Elit' },
    olay:     { ikon: '❓', ad: 'Bilinmez' },
    dukkan:   { ikon: '🛒', ad: 'Dükkan' },
    dinlenme: { ikon: '🏕️', ad: 'Kamp' },
    hazine:   { ikon: '📦', ad: 'Hazine' },
    patron:   { ikon: '👑', ad: 'Patron' }
  };
  function tipAd(t) { return global.T(TIP[t] ? TIP[t].ad : t); }

  var PERDE_AD = ['', 'Kül Ovaları', 'Sönmüş Şehir', 'Ateşin Kalbi'];

  var ic, kaydir, baslikEl, seciliCB;

  function kur() {
    ic = document.getElementById('haritaIc');
    kaydir = document.getElementById('haritaKaydir');
    baslikEl = document.getElementById('haritaBaslik');
  }

  function ciz(run, dugumeGirCB) {
    seciliCB = dugumeGirCB;
    var h = run.harita;
    var katSayisi = h.katlar.length;
    var katYuk = 92;
    var yukseklik = katSayisi * katYuk;

    baslikEl.innerHTML = global.T('Perde') + ' ' + run.perde + ' — ' +
      global.T(PERDE_AD[run.perde]) +
      '<small>' + global.T('Kat') + ' ' + (run.kat < 0 ? 0 : run.kat + 1) + ' / ' + katSayisi +
      ' · ' + global.T('Tohum') + ' ' + run.tohum + '</small>';

    U.clear(ic);
    ic.style.height = yukseklik + 'px';

    var G = ic.clientWidth || 700;
    var kenar = 40;
    var kullanilirG = G - kenar * 2;

    function px(d) { return kenar + d.x * kullanilirG; }
    function py(d) { return yukseklik - 46 - d.y * (yukseklik - 100); }

    // --- bağlantılar (SVG) ---
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', yukseklik);
    svg.style.cssText = 'position:absolute;inset:0;pointer-events:none';

    var acikSet = {};
    run.acikDugumler().forEach(function (d) { acikSet[d.kat + '_' + d.idx] = true; });
    var suan = run.dugum();

    for (var k = 0; k < katSayisi - 1; k++) {
      for (var i = 0; i < h.katlar[k].length; i++) {
        var a = h.katlar[k][i];
        for (var c = 0; c < a.cocuklar.length; c++) {
          var b = h.katlar[k + 1][a.cocuklar[c]];
          var x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b);
          var yol = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          var orta = (y1 + y2) / 2;
          yol.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + orta +
                                ' ' + x2 + ',' + orta + ' ' + x2 + ',' + y2);
          var aktifYol = suan && a === suan && acikSet[b.kat + '_' + b.idx];
          yol.setAttribute('fill', 'none');
          yol.setAttribute('stroke', aktifYol ? 'rgba(249,115,22,.75)' : 'rgba(80,66,56,.55)');
          yol.setAttribute('stroke-width', aktifYol ? 2.6 : 1.6);
          yol.setAttribute('stroke-dasharray', a.ziyaret || aktifYol ? 'none' : '5 6');
          svg.appendChild(yol);
        }
      }
    }
    ic.appendChild(svg);

    // --- düğümler ---
    for (var kk = 0; kk < katSayisi; kk++) {
      for (var j = 0; j < h.katlar[kk].length; j++) {
        (function (d) {
          var meta = TIP[d.tip] || TIP.savas;
          var el = U.el('div', 'harita-dugum');
          if (d.tip === 'patron') el.classList.add('patron');
          el.style.left = px(d) + 'px';
          el.style.top = py(d) + 'px';
          el.textContent = meta.ikon;
          el.appendChild(U.el('div', 'dgm-etiket', tipAd(d.tip)));

          var acik = acikSet[d.kat + '_' + d.idx];
          var simdi = suan === d;
          if (simdi) el.classList.add('simdi');
          else if (d.ziyaret) el.classList.add('gecildi');
          else if (acik) el.classList.add('acik');
          else el.classList.add('kapali');

          if (acik) {
            el.onclick = function () {
              global.SES.dugme();
              if (seciliCB) seciliCB(d);
            };
            el.onpointerenter = function () { global.SES.gez(); };
          }

          global.Ipucu.bagla(el, function () {
            return { baslik: tipAd(d.tip), metin: global.T(ODA_ACIKLAMA[d.tip] || '') };
          });

          ic.appendChild(el);
        })(h.katlar[kk][j]);
      }
    }

    // Mevcut konuma kaydır
    setTimeout(function () {
      var hedefY = suan ? py(suan) : yukseklik;
      kaydir.scrollTop = Math.max(0, hedefY - kaydir.clientHeight * 0.62);
    }, 20);
  }

  var ODA_ACIKLAMA = {
    savas: 'Sıradan bir düşman grubu. Altın ve bir kart ödülü.',
    elit: 'Tehlikeli. Karşılığında bir yadigâr.',
    olay: 'Ne çıkacağı belli değil — seçim yapacaksın.',
    dukkan: 'Kart, iksir, yadigâr satın al. Kart sildirebilirsin.',
    dinlenme: 'Dinlen (can) ya da bir kartını yükselt.',
    hazine: 'Bedava yadigâr ve altın.',
    patron: 'Perdenin sonu. Hazır olmadan gitme.'
  };

  global.HaritaEkrani = { kur: kur, ciz: ciz };
})(typeof window !== 'undefined' ? window : globalThis);
