/* =========================================================================
   RNG — mulberry32 tabanlı, tohumlanabilir rastgelelik.
   Her akış (map / kart ödülü / savaş / olay) ayrı sayaç tutar ki
   oyuncunun bir yerde yaptığı ekstra çekiliş diğer akışları kaydırmasın.
   Bu sayede aynı tohum = aynı koşu (paylaşılabilir seed).
   ========================================================================= */
(function (global) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Metinden 32-bit tohum (xmur3)
  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function Stream(seed) {
    this.seed = seed >>> 0;
    this.count = 0;
    this._f = mulberry32(this.seed);
  }

  Stream.prototype.next = function () {
    this.count++;
    return this._f();
  };

  /** [0, n) aralığında tamsayı */
  Stream.prototype.int = function (n) {
    return Math.floor(this.next() * n);
  };

  /** [min, max] kapalı aralık */
  Stream.prototype.range = function (min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  };

  Stream.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };

  /** Diziden n adet tekrarsız seç (kaynağı bozmaz) */
  Stream.prototype.sample = function (arr, n) {
    var pool = arr.slice();
    var out = [];
    n = Math.min(n, pool.length);
    for (var i = 0; i < n; i++) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  };

  /** Fisher-Yates — yeni dizi döndürür */
  Stream.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  /** Ağırlıklı seçim: items = [{w: 3, ...}, ...] veya (item)=>weight */
  Stream.prototype.weighted = function (items, weightFn) {
    var total = 0, i;
    var w = [];
    for (i = 0; i < items.length; i++) {
      var v = weightFn ? weightFn(items[i]) : (items[i].w || 1);
      v = Math.max(0, v);
      w.push(v);
      total += v;
    }
    if (total <= 0) return items[0];
    var r = this.next() * total;
    for (i = 0; i < items.length; i++) {
      r -= w[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  };

  /** Yüzde şansı (0..100) */
  Stream.prototype.chance = function (pct) {
    return this.next() * 100 < pct;
  };

  Stream.prototype.save = function () {
    return { seed: this.seed, count: this.count };
  };

  Stream.fromSave = function (data) {
    var s = new Stream(data.seed);
    // Sayacı ileri sararak aynı noktaya dön
    for (var i = 0; i < data.count; i++) s.next();
    return s;
  };

  /* -------------------------------------------------------------------- */

  function RNG(seedText) {
    this.seedText = String(seedText);
    var base = hashSeed(this.seedText);
    this.streams = {};
    // Her akışa base'den türetilmiş farklı tohum
    // 'oda' = harita düğümlerinin içeriği (hangi düşman, hangi olay, dükkan stoğu).
    // Savaş içi rastgelelikten AYRI olması şart: aksi hâlde oyuncunun kaç kart
    // oynadığı akışı kaydırıp sonraki karşılaşmaları değiştiriyor.
    var names = ['harita', 'kart', 'savas', 'olay', 'yadigar', 'iksir', 'coklu', 'oda'];
    for (var i = 0; i < names.length; i++) {
      this.streams[names[i]] = new Stream((base + Math.imul(i + 1, 2654435761)) >>> 0);
    }
  }

  RNG.prototype.s = function (name) {
    if (!this.streams[name]) this.streams[name] = new Stream(hashSeed(this.seedText + name));
    return this.streams[name];
  };

  RNG.prototype.save = function () {
    var out = { seedText: this.seedText, streams: {} };
    for (var k in this.streams) out.streams[k] = this.streams[k].save();
    return out;
  };

  RNG.fromSave = function (data) {
    var r = new RNG(data.seedText);
    for (var k in data.streams) r.streams[k] = Stream.fromSave(data.streams[k]);
    return r;
  };

  /** Okunabilir rastgele tohum metni üret */
  var SEED_HECE = ['ka', 'ru', 'mel', 'tor', 'ez', 'gan', 'vi', 'sol', 'dar', 'yen',
                   'kur', 'ba', 'zil', 'na', 'hor', 'te', 'mir', 'ok', 'çal', 'ün'];
  RNG.randomSeedText = function () {
    var s = '';
    var n = 3 + Math.floor(Math.random() * 2);
    for (var i = 0; i < n; i++) s += SEED_HECE[Math.floor(Math.random() * SEED_HECE.length)];
    return s.toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);
  };

  global.RNG = RNG;
  global.RNGStream = Stream;
  global.hashSeed = hashSeed;
})(typeof window !== 'undefined' ? window : globalThis);
