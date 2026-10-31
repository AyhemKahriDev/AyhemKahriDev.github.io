/* =========================================================================
   Genel yardımcılar. Tarayıcıda da Node testlerinde de çalışır.
   ========================================================================= */
(function (global) {
  'use strict';

  var U = {};

  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  U.clone = function (o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) {
      var a = new Array(o.length);
      for (var i = 0; i < o.length; i++) a[i] = U.clone(o[i]);
      return a;
    }
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = U.clone(o[k]);
    return r;
  };

  U.sum = function (arr, fn) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += fn ? fn(arr[i], i) : arr[i];
    return t;
  };

  U.count = function (arr, fn) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) if (fn(arr[i], i)) t++;
    return t;
  };

  U.uniq = function (arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
    }
    return out;
  };

  /** Türkçe büyük harf (i → İ) */
  U.upper = function (s) {
    return String(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  };

  var _uid = 1;
  U.uid = function () { return 'u' + (_uid++); };
  U.resetUid = function (n) { _uid = n || 1; };
  U.uidState = function () { return _uid; };

  /** 12 → "12", -3 → "-3", pozitifi + ile: U.signed(3) → "+3" */
  U.signed = function (n) { return (n >= 0 ? '+' : '') + n; };

  /** Basit şablon: "{d} hasar" + {d: 6} */
  U.fmt = function (tpl, vals) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return vals && vals[k] !== undefined ? vals[k] : m;
    });
  };

  /* ------- DOM (yalnız tarayıcıda anlamlı) --------------------------- */
  U.el = function (tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  };

  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  U.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  U.on = function (node, ev, fn, opt) { node.addEventListener(ev, fn, opt); return node; };

  /** requestAnimationFrame tabanlı bekleme zinciri için */
  U.wait = function (ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  };

  global.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
