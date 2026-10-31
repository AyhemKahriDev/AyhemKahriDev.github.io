/* =========================================================================
   Durum etkileri (buff / debuff) ve anahtar kelime sözlüğü.
   `sure: true`  → her tur sonunda 1 azalır (süreli)
   `kalici: true`→ savaş boyunca kalır (yığın)
   `kotu: true`  → olumsuz etki (kırmızı gösterilir)
   ========================================================================= */
(function (global) {
  'use strict';

  var STATUS = {
    guc:         { ad: 'Güç',          ikon: '💪', kalici: true,
                   metin: 'Saldırılar vuruş başına {n} fazla hasar verir.' },
    ceviklik:    { ad: 'Çeviklik',     ikon: '🪶', kalici: true,
                   metin: 'Kartlardan kazanılan blok {n} artar.' },
    diken:       { ad: 'Diken',        ikon: '🌵', kalici: true,
                   metin: 'Saldıran birime {n} hasar yansıtır.' },
    zirh:        { ad: 'Zırh',         ikon: '🧱', kalici: true,
                   metin: 'Tur başında {n} blok kazanırsın.' },
    ofke:        { ad: 'Öfke',         ikon: '😤', kalici: true,
                   metin: 'Bir saldırı kartı oynadığında {n} blok kazanırsın.' },
    yanki:       { ad: 'Yankı',        ikon: '🔁', kalici: true,
                   metin: 'Turun ilk saldırı kartı {n} kez daha tetiklenir.' },
    korakor:     { ad: 'Köz',          ikon: '🔆', kalici: true,
                   metin: 'Tur başında {n} Akkor kazanırsın.' },
    tilsim:      { ad: 'Tılsım',       ikon: '🔮', kalici: true,
                   metin: 'Sonraki {n} olumsuz etkiyi engeller.' },
    metanet:     { ad: 'Metanet',      ikon: '⛰️', kalici: true,
                   metin: 'Blok tur başında sıfırlanmaz.' },
    zayiflik:    { ad: 'Zayıflık',     ikon: '💧', sure: true, kotu: true,
                   metin: '{n} tur boyunca %25 daha az saldırı hasarı verir.' },
    kirilganlik: { ad: 'Kırılganlık',  ikon: '💔', sure: true, kotu: true,
                   metin: '{n} tur boyunca %50 fazla saldırı hasarı alır.' },
    kirik:       { ad: 'Kırık',        ikon: '🥀', sure: true, kotu: true,
                   metin: '{n} tur boyunca kartlardan %25 az blok kazanır.' },
    yanik:       { ad: 'Yanık',        ikon: '🔥', kalici: true, kotu: true,
                   metin: 'Tur sonunda {n} hasar alır, sonra Yanık 1 azalır.' },
    zehirlenme:  { ad: 'Kavrulma',     ikon: '☄️', kalici: true, kotu: true,
                   metin: 'Tur sonunda {n} hasar alır. Azalmaz.' },
    zincir:      { ad: 'Zincir',       ikon: '⛓️', sure: true, kotu: true,
                   metin: '{n} tur boyunca Akkor kazanamaz.' },
    korku:       { ad: 'Korku',        ikon: '😱', sure: true, kotu: true,
                   metin: '{n} tur boyunca 1 az enerji.' },
    sersem:      { ad: 'Sersemlik',    ikon: '💫', sure: true, kotu: true,
                   metin: '{n} tur boyunca 1 az kart çeker.' }
  };

  // Kart metinlerinde altı çizili gösterilecek anahtar kelimeler
  var KEYWORDS = {
    'akkor':      'Savaş boyunca biriken kor. Bazı kartlar Akkor üretir, bazıları hepsini harcayarak ölçeklenen etki verir.',
    'tüket':      'Kart bu savaşta bir daha kullanılamaz; tüketilenler destesine gider.',
    'tüketilir':  'Kart bu savaşta bir daha kullanılamaz; tüketilenler destesine gider.',
    'kalıcı':     'Kart oynandıktan sonra çekme destesine değil, savaş sonuna kadar oyunda kalan güç olarak işler.',
    'elde kalır': 'Tur sonunda bu kart atılmaz, elinde kalır.',
    'lanet':      'Faydasız veya zararlı kart. Oynanamaz.',
    'akkorlu':    'Akkor değerin en az bu kadar ise koşul sağlanır.'
  };

  /** Sıralı gösterim: iyi etkiler önce, kötüler sonra */
  var STATUS_ORDER = ['guc', 'ceviklik', 'zirh', 'diken', 'ofke', 'yanki', 'korakor',
                      'metanet', 'tilsim', 'kirilganlik', 'zayiflik', 'kirik', 'yanik',
                      'zehirlenme', 'zincir', 'korku', 'sersem'];

  global.STATUS = STATUS;
  global.KEYWORDS = KEYWORDS;
  global.STATUS_ORDER = STATUS_ORDER;
})(typeof window !== 'undefined' ? window : globalThis);
