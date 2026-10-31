/* =========================================================================
   KART GÖRSELİ
   Tek bir yapıcı; el, ödül ekranı, dükkan ve deste görünümü aynı bileşeni
   farklı boyutlarda kullanıyor.
   ========================================================================= */
(function (global) {
  'use strict';

  var IKON = {
    vurus: '🗡️', savun: '🛡️', kivilcim: '✨',
    ufleme: '🌬️', koz_sacmak: '🎆', kor_zirhi: '🔥', korla_vurus: '⚡',
    atesle: '☄️', patlama: '💥', korun_nefesi: '🌫️', firin: '🏭',
    kivilcim_yagmuru: '🌠', alev_almak: '🩸', ocak_ustasi: '⚗️', kozleme: '🕯️',
    volkan: '🌋', ebedi_ates: '♾️', supernova: '💫', korlesme: '🎴', kor_kalkani: '🔶',
    kavurma: '🔥', kor_serpme: '✳️', alevli_pence: '🐾', yayilma: '🕸️',
    korukleme: '💨', kavrulma: '☄️', duman: '🌁', kul_firtinasi: '🌪️',
    yanik_izi: '🔖', sonmeyen_kor: '🕯️', yakip_yikma: '💢', zehirli_duman: '☠️',
    cakmak: '🔦', kavurucu_ruzgar: '🌬️', kul_bulutu: '☁️',
    siper: '🛡️', demir_deri: '🦾', dikenli_kalkan: '🌵', kalkan_vurusu: '🛡️',
    duvar: '🧱', sabir: '⏳', metanet_k: '⛰️', ofke_nobeti: '😤',
    zirh_kirici: '🔨', agirlik: '⚓', kaya_gibi: '🪨', karsi_darbe: '↩️',
    diken_tarlasi: '🌾', siperden_saldiri: '⚔️', kirilmaz: '💠',
    yankili_kalkan: '🔁', savunma_duruusu: '🧎',
    hazirlik: '🎒', ivme: '💨', adrenalin: '💉', ustalik: '🎓', odaklan: '🎯',
    ani_hamle: '🗡️', serseri_vurus: '🔪', agir_darbe: '🔨', son_nefes: '💚',
    arinma: '🧹', cifte_vurus: '🔂', bileme: '🪒', secim: '🔮', yagma: '💰',
    ikiz_alev: '🔱', feda: '🥀', son_direnis: '⚔️', koruma_cemberi: '⭕',
    tilsim_k: '🔮', kalpten_vurus: '💗', yorulmak_bilmez: '🏃', kucultme: '📉',
    kesif: '🔎', acimasizlik: '🩸', kan_bagi: '🩸', gozdagi: '😨',
    hisim: '💢', tekrar: '♻️',
    yara: '🩹', kulce: '🪨', is: '🌫️',
    lanet_supheli: '❔', lanet_kor_yuku: '⛓️', lanet_zincir: '⛓️', lanet_pismanlik: '💔'
  };

  var TUR_AD = {
    saldiri: 'Saldırı', beceri: 'Beceri', guc: 'Güç',
    durum: 'Durum', lanet: 'Lanet'
  };

  // Metinde altı çizilecek anahtar kelimeler (uzun olan önce eşleşmeli)
  var ANAHTARLAR = [
    'Kırılganlık', 'Sersemlik', 'Kavrulma', 'Çeviklik', 'Zayıflık', 'Metanet',
    'Tüketilir', 'Tılsım', 'Zincir', 'Yankı', 'Akkor', 'Yanık', 'Diken',
    'Öfke', 'Zırh', 'Korku', 'Kırık', 'Güç', 'Köz', 'Tüket'
  ];

  // İngilizce anahtar kelimeler (altı çizilenler)
  var ANAHTARLAR_EN = [
    'Vulnerable', 'Dexterity', 'Strength', 'Artifact', 'Plating', 'Resolve',
    'Exhausts', 'Exhaust', 'Chains', 'Thorns', 'Ember', 'Burn', 'Weak',
    'Frail', 'Echo', 'Rage', 'Char', 'Coals', 'Fear', 'Daze', 'Block', 'Retain'
  ];

  function kacir(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Kart metnini değerlerle doldur, yükseltilenleri vurgula, kelimeleri işaretle */
  function metinKur(kart) {
    var def = global.KARTLAR[kart.id];
    var ham = global.DIL.v('kart', kart.id, 'metin', def.metin) || '';
    // 'normal|yükseltilmiş' biçimi
    if (ham.indexOf('|') >= 0) {
      var parcalar = ham.split('|');
      ham = kart.up && parcalar[1] !== undefined ? parcalar[1] : parcalar[0];
    }
    var v = global.kartDegerleri(kart);
    var degisen = global.kartDegisenler(kart);

    var s = kacir(ham);
    s = s.replace(/\{(\w+)\}/g, function (m, k) {
      if (v[k] === undefined) return m;
      var sinif = degisen[k] ? ' class="arti"' : '';
      return '<em' + sinif + '>' + v[k] + '</em>';
    });
    var liste = global.DIL.simdi() === 'en' ? ANAHTARLAR_EN : ANAHTARLAR;
    for (var i = 0; i < liste.length; i++) {
      var a = liste[i];
      s = s.replace(new RegExp('(?<![\\w>])' + a + '(?![\\w<])', 'g'),
                    '<span class="kw">' + a + '</span>');
    }
    return s;
  }

  /**
   * @param kart  {uid,id,up}
   * @param opt   {boy:'kucuk'|'buyuk', bedel:sayı|null, oynanabilir, tiklanir}
   */
  function olustur(kart, opt) {
    opt = opt || {};
    var def = global.KARTLAR[kart.id];
    var el = document.createElement('div');
    el.className = 'kart yol-' + def.yol + ' tur-' + def.tur + ' nadirlik-' + def.nadirlik;
    if (opt.boy) el.classList.add(opt.boy);
    if (kart.up) el.classList.add('yukseltilmis');
    if (opt.tiklanir) el.classList.add('tiklanir');
    el.dataset.uid = kart.uid || '';
    el.dataset.id = kart.id;

    var bedel = opt.bedel !== undefined && opt.bedel !== null
              ? opt.bedel
              : (kart.up && def.ustBedel !== undefined ? def.ustBedel : def.bedel);
    var bedelYazi = bedel === -1 ? 'X' : bedel;

    var ad = global.DIL.v('kart', kart.id, 'ad', def.ad) + (kart.up ? '+' : '');

    // Kart resmi: emoji yerine kart kimliğinden türetilen benzersiz mühür
    var resim = (global.SANAT && global.SANAT.muhur)
              ? global.SANAT.muhur(kart.id, def.yol, def.tur)
              : (IKON[kart.id] || '🔥');

    // Bedel madalyonu yüzeyin DIŞINDA: yüzey overflow:hidden olduğu için
    // içeride kalsa kırpılırdı.
    el.innerHTML =
      '<div class="kart-yuzey">' +
        '<div class="kart-ad">' + kacir(ad) + '</div>' +
        '<div class="kart-resim">' + resim + '</div>' +
        '<div class="kart-tur"><span>' + global.T(TUR_AD[def.tur] || '') + '</span></div>' +
        '<div class="kart-metin"><span>' + metinKur(kart) + '</span></div>' +
        '<div class="nadir-cizgi"></div>' +
        '<div class="kart-parlama"></div>' +
      '</div>' +
      '<div class="kart-bedel"><span>' + bedelYazi + '</span></div>';

    return el;
  }

  /** Kartın tek satırlık özeti (ipucu, dükkan vb.) */
  function ozet(kart) {
    var def = global.KARTLAR[kart.id];
    var tmp = document.createElement('div');
    tmp.innerHTML = metinKur(kart);
    return global.DIL.v('kart', kart.id, 'ad', def.ad) + (kart.up ? '+' : '') +
           ' — ' + tmp.textContent;
  }

  global.KartUI = { olustur: olustur, ozet: ozet, ikon: IKON, metinKur: metinKur };
})(typeof window !== 'undefined' ? window : globalThis);
