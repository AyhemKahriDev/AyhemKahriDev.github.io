/* =========================================================================
   PENCERE (modal) ve İPUCU (tooltip) altyapısı
   ========================================================================= */
(function (global) {
  'use strict';

  var U = global.U;
  var ortu, kap, ipucuEl;
  var yigin = [];

  function kur() {
    ortu = document.getElementById('ortu');
    kap = document.getElementById('pencere');
    ipucuEl = document.getElementById('ipucu');
    ortu.addEventListener('click', function () {
      var ust = yigin[yigin.length - 1];
      if (ust && ust.kapatilabilir !== false) kapat();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var ust = yigin[yigin.length - 1];
      if (ust && ust.kapatilabilir !== false) kapat();
    });
  }

  /**
   * @param o {baslik, not, govde(DOM|string), dugmeler:[{yazi,sinif,ol,kapat}],
   *           genislik:'dar'|'genis', kapatilabilir, xIle}
   */
  function ac(o) {
    yigin.push(o);
    ciz();
    return o;
  }

  function ciz() {
    var o = yigin[yigin.length - 1];
    U.clear(kap);
    if (!o) { kap.hidden = true; ortu.hidden = true; return; }

    ortu.hidden = false; kap.hidden = false;

    var pnc = U.el('div', 'pnc' + (o.genislik ? ' ' + o.genislik : ''));

    if (o.baslik || o.not || o.xIle) {
      var bas = U.el('div', 'pnc-bas');
      var sol = U.el('div');
      if (o.baslik) sol.appendChild(U.el('h2', null, o.baslik));
      if (o.not) sol.appendChild(U.el('div', 'pnc-not', o.not));
      bas.appendChild(sol);
      if (o.xIle !== false && o.kapatilabilir !== false) {
        var x = U.el('button', 'kapat-x', '✕');
        x.onclick = function () { global.SES.tik(); kapat(); };
        bas.appendChild(x);
      }
      pnc.appendChild(bas);
    }

    var govde = U.el('div', 'pnc-govde');
    if (typeof o.govde === 'string') govde.innerHTML = o.govde;
    else if (o.govde) govde.appendChild(o.govde);
    pnc.appendChild(govde);
    o.govdeEl = govde;

    if (o.dugmeler && o.dugmeler.length) {
      var alt = U.el('div', 'pnc-alt');
      o.dugmeler.forEach(function (d) {
        if (d.gizli) return;
        var b = U.el('button', 'dugme' + (d.sinif ? ' ' + d.sinif : ''), global.T(d.yazi));
        if (d.pasif) b.disabled = true;
        b.onclick = function () {
          global.SES.dugme();
          if (d.kapat !== false) kapat();
          if (d.ol) d.ol();
        };
        alt.appendChild(b);
        d.el = b;
      });
      pnc.appendChild(alt);
    }

    kap.appendChild(pnc);
    o.pncEl = pnc;
  }

  function kapat() {
    var o = yigin.pop();
    if (o && o.kapaninca) o.kapaninca();
    gizleIpucu();
    ciz();
  }

  function hepsiniKapat() { yigin.length = 0; ciz(); }

  function acikMi() { return yigin.length > 0; }

  /** Açık pencerenin gövdesini yeniden çiz */
  function tazele() {
    var o = yigin[yigin.length - 1];
    if (!o) return;
    if (o.tazele) {
      U.clear(o.govdeEl);
      var y = o.tazele();
      if (typeof y === 'string') o.govdeEl.innerHTML = y;
      else if (y) o.govdeEl.appendChild(y);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  İpucu                                                              */
  /* ------------------------------------------------------------------ */

  var ipucuHedef = null;

  function bagla(el, veriFn) {
    el.addEventListener('pointerenter', function () {
      ipucuHedef = el;
      var v = typeof veriFn === 'function' ? veriFn() : veriFn;
      if (!v) return;
      gosterIpucu(el, v);
    });
    el.addEventListener('pointerleave', function () {
      if (ipucuHedef === el) gizleIpucu();
    });
    el.addEventListener('pointerdown', gizleIpucu);
  }

  function gosterIpucu(el, v) {
    ipucuEl.innerHTML = '';
    if (v.baslik) ipucuEl.appendChild(U.el('b', null, v.baslik));
    if (v.metin) {
      var m = U.el('div');
      m.innerHTML = v.metin;
      ipucuEl.appendChild(m);
    }
    if (v.alt) ipucuEl.appendChild(U.el('div', 'ip-alt', v.alt));
    ipucuEl.hidden = false;

    var r = el.getBoundingClientRect();
    var ir = ipucuEl.getBoundingClientRect();
    var x = r.left + r.width / 2 - ir.width / 2;
    var y = r.top - ir.height - 9;
    if (y < 6) y = r.bottom + 9;
    x = Math.max(6, Math.min(global.innerWidth - ir.width - 6, x));
    ipucuEl.style.left = x + 'px';
    ipucuEl.style.top = y + 'px';
  }

  function gizleIpucu() { ipucuHedef = null; if (ipucuEl) ipucuEl.hidden = true; }

  /* ------------------------------------------------------------------ */
  /*  Onay kutusu                                                        */
  /* ------------------------------------------------------------------ */

  function onay(baslik, metin, evetYazi, ol) {
    ac({
      baslik: baslik, genislik: 'dar',
      govde: '<p style="text-align:center;line-height:1.7;color:#cfc4b8">' + metin + '</p>',
      dugmeler: [
        { yazi: global.T('Vazgeç') },
        { yazi: evetYazi || global.T('Evet'), sinif: 'birincil tehlike', ol: ol }
      ]
    });
  }

  global.Pencere = {
    kur: kur, ac: ac, kapat: kapat, hepsiniKapat: hepsiniKapat,
    acikMi: acikMi, tazele: tazele, onay: onay
  };
  global.Ipucu = { bagla: bagla, gizle: gizleIpucu };
})(typeof window !== 'undefined' ? window : globalThis);
