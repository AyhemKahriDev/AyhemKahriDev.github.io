/* =========================================================================
   SİLUET SANATI
   ---------------------------------------------------------------------
   Emoji yerine elle yazılmış SVG siluetler. Her varlık üç katmandan oluşur:
     1) arkada kor halesi (radyal gradyan)
     2) neredeyse siyah gövde silueti
     3) içten kor sızıntısı + gözler + alttan kenar ışığı
   Kül dünyasında her şeyin isten ibaret olması temanın kendisi; siluet
   burada bir eksiklik değil, tercih.

   Şekiller 0..100 kutusunda çizilir; y=100 zemindir.
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- */
  /*  Şekiller — ilkel biçimlerden kurulur (elips, çokgen, eğri)       */
  /* ---------------------------------------------------------------- */

  var S = {};

  /* --- küçük yaratıklar ------------------------------------------- */

  S.sican = {
    goz: [[26, 55], [33, 57]], gozR: 2.4,
    yol: '<ellipse cx="56" cy="66" rx="27" ry="17"/>' +
         '<ellipse cx="28" cy="59" rx="14" ry="12"/>' +
         '<ellipse cx="18" cy="62" rx="7" ry="5"/>' +
         '<circle cx="24" cy="46" r="7"/><circle cx="36" cy="44" r="6"/>' +
         '<path d="M81 62 Q96 54 92 38 Q90 30 84 28" stroke-width="5" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<rect x="40" y="78" width="7" height="12" rx="3"/>' +
         '<rect x="56" y="79" width="7" height="12" rx="3"/>' +
         '<rect x="70" y="76" width="7" height="12" rx="3"/>'
  };

  S.bocek = {
    goz: [[43, 33], [57, 33]], gozR: 2.6,
    yol: '<ellipse cx="50" cy="62" rx="30" ry="24"/>' +
         '<ellipse cx="50" cy="36" rx="15" ry="12"/>' +
         '<path d="M40 27 Q34 14 26 10" stroke-width="3.5" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M60 27 Q66 14 74 10" stroke-width="3.5" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M22 52 L8 44 M22 64 L6 64 M24 76 L10 86" stroke-width="4" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M78 52 L92 44 M78 64 L94 64 M76 76 L90 86" stroke-width="4" stroke="currentColor" stroke-linecap="round"/>'
  };

  S.ucanbocek = {
    goz: [[45, 47], [55, 47]], gozR: 2.2, kor: [50, 74, 10],
    yol: '<ellipse cx="50" cy="66" rx="15" ry="19"/>' +
         '<ellipse cx="50" cy="47" rx="11" ry="9"/>' +
         '<ellipse cx="28" cy="46" rx="19" ry="9" transform="rotate(-24 28 46)" opacity=".55"/>' +
         '<ellipse cx="72" cy="46" rx="19" ry="9" transform="rotate(24 72 46)" opacity=".55"/>' +
         '<path d="M44 40 Q38 30 32 26 M56 40 Q62 30 68 26" stroke-width="2.6" stroke="currentColor" fill="none" stroke-linecap="round"/>'
  };

  /* --- insansı ----------------------------------------------------- */

  S.ceset = {
    goz: [[44, 26], [56, 25]], gozR: 2.6,
    yol: '<ellipse cx="50" cy="26" rx="13" ry="14"/>' +
         '<path d="M38 40 Q50 34 62 40 L68 76 Q50 82 32 76 Z"/>' +
         '<path d="M38 44 Q26 58 24 82" stroke-width="7" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M63 44 Q76 56 74 74" stroke-width="7" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M42 78 L40 98 M58 78 L61 98" stroke-width="8" stroke="currentColor" stroke-linecap="round"/>'
  };

  S.hayalet = {
    goz: [[43, 34], [57, 34]], gozR: 3,
    yol: '<path d="M50 12 Q72 12 74 38 Q76 62 70 80 Q66 92 60 84 Q56 96 50 86 ' +
         'Q44 96 40 84 Q34 92 30 80 Q24 62 26 38 Q28 12 50 12 Z"/>' +
         '<path d="M32 30 Q50 20 68 30" stroke-width="3" stroke="currentColor" fill="none" opacity=".5"/>'
  };

  S.avci = {
    goz: [[45, 24], [55, 23]], gozR: 2.2,
    yol: '<ellipse cx="50" cy="24" rx="11" ry="12"/>' +
         '<path d="M38 38 L62 38 L66 72 L34 72 Z"/>' +
         '<path d="M40 74 L36 98 M60 74 L64 98" stroke-width="8" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M24 18 Q10 44 24 70" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M24 18 L24 70" stroke-width="1.8" stroke="currentColor" opacity=".7"/>' +
         '<path d="M24 44 L70 44" stroke-width="3" stroke="currentColor" stroke-linecap="round"/>'
  };

  S.rahip = {
    goz: [[44, 27], [56, 27]], gozR: 2.6,
    yol: '<path d="M50 8 Q64 10 64 30 L60 38 L40 38 L36 30 Q36 10 50 8 Z"/>' +
         '<path d="M36 36 Q50 30 64 36 L76 96 L24 96 Z"/>' +
         '<path d="M78 14 L78 92" stroke-width="4" stroke="currentColor" stroke-linecap="round"/>' +
         '<circle cx="78" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="3"/>'
  };

  S.sovalye = {
    goz: [[44, 27], [56, 27]], gozR: 2.4,
    yol: '<path d="M50 8 L58 12 L62 30 Q50 36 38 30 L42 12 Z"/>' +
         '<path d="M50 4 L50 12 M46 6 L54 6" stroke-width="3" stroke="currentColor"/>' +
         '<path d="M30 38 Q50 30 70 38 L74 52 L26 52 Z"/>' +
         '<path d="M34 52 L66 52 L70 86 L30 86 Z"/>' +
         '<path d="M36 86 L32 98 M64 86 L68 98" stroke-width="9" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M84 20 L84 76" stroke-width="6" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M76 74 L92 74" stroke-width="4" stroke="currentColor" stroke-linecap="round"/>'
  };

  S.nobetci = {
    goz: [[44, 28], [56, 28]], gozR: 2.4,
    yol: '<path d="M40 14 L60 14 L64 34 L36 34 Z"/>' +
         '<path d="M28 36 L72 36 L76 54 L24 54 Z"/>' +
         '<path d="M32 54 L68 54 L72 88 L28 88 Z"/>' +
         '<path d="M34 88 L30 99 M66 88 L70 99" stroke-width="9" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M16 34 L16 88 Q26 82 26 60 Q26 40 16 34 Z" opacity=".92"/>' +
         '<path d="M88 12 L88 92" stroke-width="5" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M88 8 L83 20 L93 20 Z"/>'
  };

  S.otomat = {
    goz: [[42, 30], [58, 30]], gozR: 3.2,
    yol: '<rect x="36" y="18" width="28" height="24" rx="3"/>' +
         '<rect x="46" y="8" width="8" height="12" rx="2"/><circle cx="50" cy="6" r="4"/>' +
         '<rect x="26" y="44" width="48" height="34" rx="4"/>' +
         '<rect x="12" y="46" width="12" height="30" rx="4"/>' +
         '<rect x="76" y="46" width="12" height="30" rx="4"/>' +
         '<rect x="34" y="80" width="12" height="18" rx="3"/>' +
         '<rect x="54" y="80" width="12" height="18" rx="3"/>' +
         '<rect x="40" y="52" width="20" height="4" rx="2" opacity=".5"/>' +
         '<rect x="40" y="62" width="20" height="4" rx="2" opacity=".5"/>'
  };

  S.kaba = {
    goz: [[43, 31], [57, 31]], gozR: 3,
    yol: '<ellipse cx="50" cy="30" rx="12" ry="11"/>' +
         '<path d="M22 44 Q50 32 78 44 L82 70 L18 70 Z"/>' +
         '<path d="M18 46 Q4 62 10 86 Q14 96 22 90" stroke-width="12" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M82 46 Q96 62 90 86 Q86 96 78 90" stroke-width="12" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M34 70 L32 98 M66 70 L68 98" stroke-width="13" stroke="currentColor" stroke-linecap="round"/>'
  };

  S.orakci = {
    goz: [[44, 28], [56, 28]], gozR: 3.2,
    yol: '<path d="M50 8 Q68 12 66 34 L60 42 L40 42 L34 34 Q32 12 50 8 Z"/>' +
         '<path d="M34 40 Q50 34 66 40 L78 98 L22 98 Z"/>' +
         '<path d="M14 10 L14 94" stroke-width="4" stroke="currentColor" stroke-linecap="round"/>' +
         '<path d="M14 12 Q42 6 46 26" stroke-width="6" stroke="currentColor" fill="none" stroke-linecap="round"/>'
  };

  S.kral = {
    goz: [[44, 30], [56, 30]], gozR: 3,
    yol: '<path d="M34 20 L38 6 L44 16 L50 2 L56 16 L62 6 L66 20 Z"/>' +
         '<ellipse cx="50" cy="32" rx="13" ry="12"/>' +
         '<path d="M30 44 Q50 36 70 44 L80 98 L20 98 Z"/>' +
         '<path d="M30 46 Q12 66 16 98 M70 46 Q88 66 84 98" stroke-width="5" stroke="currentColor" fill="none" opacity=".75"/>' +
         '<path d="M50 52 L50 74" stroke-width="3" stroke="currentColor" opacity=".6"/>'
  };

  S.dev = {
    goz: [[43, 33], [57, 33]], gozR: 3.6, kor: [50, 62, 34],
    // Omuzlara gömülü küçük kafa, çatlaklı kaya kütlesi, yere değen uzun kollar
    yol: '<path d="M40 24 L60 24 L63 42 L37 42 Z"/>' +
         '<path d="M14 44 L30 34 L46 40 L54 40 L70 34 L86 44 L90 72 L10 72 Z"/>' +
         '<path d="M12 46 L2 60 L6 92 L20 96 L24 70 Z"/>' +
         '<path d="M88 46 L98 60 L94 92 L80 96 L76 70 Z"/>' +
         '<path d="M26 70 L44 70 L42 100 L22 100 Z"/>' +
         '<path d="M56 70 L74 70 L78 100 L58 100 Z"/>' +
         '<path d="M30 36 L26 20 L36 26 Z"/><path d="M70 36 L74 20 L64 26 Z"/>' +
         '<path d="M22 52 L40 58 L34 68 M78 50 L60 58 L66 70 M50 44 L48 68" ' +
         'stroke-width="2.6" stroke="currentColor" fill="none" opacity=".38"/>'
  };

  S.volkan = {
    goz: [[42, 44], [58, 44]], gozR: 3.4,
    yol: '<path d="M50 10 L74 44 L88 96 L12 96 L26 44 Z"/>' +
         '<path d="M38 12 L50 4 L62 12 L58 26 L42 26 Z"/>' +
         '<path d="M32 60 L46 72 L38 96 M68 60 L54 72 L62 96" stroke-width="3" stroke="currentColor" fill="none" opacity=".55"/>' +
         '<path d="M22 76 L78 76" stroke-width="3" stroke="currentColor" opacity=".4"/>'
  };

  /* --- ateşten / biçimsiz ------------------------------------------ */

  S.alev = {
    goz: [[43, 56], [57, 56]], gozR: 2.8, kor: [50, 70, 26],
    yol: '<path d="M50 2 C56 20 64 26 69 36 C78 52 80 66 72 78 C65 90 58 97 50 98 ' +
         'C42 97 35 90 28 78 C20 66 22 52 31 36 C36 26 44 20 50 2 Z"/>' +
         '<path d="M27 62 C19 54 15 42 19 32 C23 44 28 50 32 56 Z"/>' +
         '<path d="M73 62 C81 54 85 42 81 32 C77 44 72 50 68 56 Z"/>' +
         '<path d="M50 34 C55 48 58 60 56 70 C54 80 50 86 50 86 ' +
         'C50 86 46 80 44 70 C42 60 45 48 50 34 Z" opacity=".3"/>'
  };

  S.cekirdek = {
    goz: [], kor: [50, 50, 40],
    yol: '<path d="M50 0 L58 30 L88 20 L66 44 L98 50 L66 56 L88 80 L58 70 L50 100 ' +
         'L42 70 L12 80 L34 56 L2 50 L34 44 L12 20 L42 30 Z"/>' +
         '<circle cx="50" cy="50" r="16" opacity=".4"/>'
  };

  S.girdap = {
    goz: [], kor: [50, 50, 22],
    yol: '<path d="M50 50 Q50 26 72 26 Q96 26 96 54 Q96 88 56 88 Q10 88 10 46 ' +
         'Q10 8 54 8" stroke-width="9" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<circle cx="50" cy="50" r="7"/>'
  };

  S.curuf = {
    goz: [[40, 52], [59, 48]], gozR: 3.2, kor: [50, 74, 26],
    // Asimetrik erimiş kütle: bir yanı sarkık, kabuklu üst kenar, damlalar
    yol: '<path d="M16 84 C6 68 12 52 24 46 C28 28 44 22 56 26 C74 30 80 44 82 54 ' +
         'C94 62 92 82 84 90 C74 98 30 98 16 84 Z"/>' +
         '<path d="M28 94 C30 104 24 106 23 100 C22 96 25 94 28 94 Z"/>' +
         '<path d="M50 96 C53 110 45 112 44 102 C43 97 47 95 50 96 Z"/>' +
         '<path d="M72 93 C75 101 69 103 68 97 C67 93 70 92 72 93 Z"/>' +
         '<path d="M24 44 C36 34 52 32 62 38 C70 42 76 48 80 54" ' +
         'stroke-width="3.4" stroke="currentColor" fill="none" opacity=".42"/>' +
         '<path d="M34 66 C44 62 56 64 64 70" ' +
         'stroke-width="2.4" stroke="currentColor" fill="none" opacity=".28"/>'
  };

  S.yilan = {
    goz: [[70, 24], [78, 26]], gozR: 2.4,
    yol: '<path d="M20 94 Q6 76 24 66 Q46 56 30 42 Q16 28 40 20 Q60 14 74 24" ' +
         'stroke-width="13" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<ellipse cx="78" cy="26" rx="14" ry="10" transform="rotate(-14 78 26)"/>' +
         '<path d="M90 28 L100 26 M90 30 L99 34" stroke-width="2.4" stroke="currentColor" stroke-linecap="round"/>'
  };

  /* --- nesne / yapı ------------------------------------------------ */

  S.fener = {
    goz: [], kor: [50, 58, 18],
    yol: '<path d="M50 4 L50 16" stroke-width="3" stroke="currentColor"/>' +
         '<path d="M36 18 L64 18 L60 26 L40 26 Z"/>' +
         '<path d="M38 26 L62 26 L68 76 L32 76 Z" opacity=".92"/>' +
         '<path d="M30 78 L70 78 L66 88 L34 88 Z"/>' +
         '<path d="M44 34 L44 68 M56 34 L56 68" stroke-width="2.4" stroke="currentColor" opacity=".55"/>'
  };

  S.can = {
    goz: [], kor: [50, 50, 22],
    yol: '<path d="M50 8 Q50 4 54 4 Q58 4 58 10" stroke-width="4" stroke="currentColor" fill="none"/>' +
         '<path d="M50 12 Q76 16 78 56 Q80 74 86 80 L14 80 Q20 74 22 56 Q24 16 50 12 Z"/>' +
         '<ellipse cx="50" cy="86" rx="10" ry="7"/>' +
         '<path d="M62 24 Q84 44 82 74" stroke-width="3" stroke="currentColor" fill="none" opacity=".4"/>' +
         '<path d="M30 40 L22 72" stroke-width="3" stroke="#000" fill="none" opacity=".9"/>'
  };

  S.yigin = {
    goz: [[40, 62], [58, 60]], gozR: 3,
    yol: '<path d="M6 98 Q10 70 26 58 Q34 38 52 40 Q74 40 80 60 Q94 70 96 98 Z"/>' +
         '<path d="M30 60 L44 48 L58 60 M60 74 L72 64 L84 78" stroke-width="3" stroke="currentColor" fill="none" opacity=".35"/>'
  };

  S.ciglik = {
    goz: [[38, 38], [62, 38]], gozR: 4.5,
    yol: '<path d="M50 8 Q78 8 80 40 Q82 64 66 76 Q58 82 50 96 Q42 82 34 76 ' +
         'Q18 64 20 40 Q22 8 50 8 Z"/>' +
         '<ellipse cx="50" cy="64" rx="11" ry="16" fill="#000" opacity=".85"/>'
  };

  /* --- oyuncu ------------------------------------------------------- */

  S.oyuncu = {
    goz: [[45, 30], [55, 30]], gozR: 2.6, kor: [72, 56, 15],
    yol: '<path d="M50 6 Q70 10 68 34 L62 44 L38 44 L32 34 Q30 10 50 6 Z"/>' +
         '<path d="M34 42 Q50 36 66 42 L74 96 L26 96 Z"/>' +
         '<path d="M66 46 Q82 50 78 60" stroke-width="6" stroke="currentColor" fill="none" stroke-linecap="round"/>' +
         '<path d="M26 96 Q50 88 74 96 L74 100 L26 100 Z" opacity=".7"/>'
  };

  /* ---------------------------------------------------------------- */
  /*  Düşman → şekil + palet eşlemesi                                  */
  /* ---------------------------------------------------------------- */

  // kor: içten sızan ışığın rengi · goz: göz rengi
  var PALET = {
    kor:    { kor: '#f97316', goz: '#ffb454' },
    sari:   { kor: '#fbbf24', goz: '#ffe08a' },
    kan:    { kor: '#e0484a', goz: '#ff8f7a' },
    mor:    { kor: '#a78bfa', goz: '#d4c4ff' },
    celik:  { kor: '#62a4f0', goz: '#b8dcff' },
    yesil:  { kor: '#6ee7a0', goz: '#c4ffdc' },
    kul:    { kor: '#8a7a6c', goz: '#d8ccc0' },
    beyaz:  { kor: '#ffd9a8', goz: '#fff4e2' }
  };

  var ESLEME = {
    // Perde 1
    kor_sicani:        ['sican', 'kor', 0.80],
    kulluk_bocegi:     ['bocek', 'kul', 0.86],
    yanik_ceset:       ['ceset', 'kor', 0.92],
    duman_ruhu:        ['hayalet', 'kul', 0.86],
    kavruk_nobetci:    ['nobetci', 'kor', 0.95],
    ates_bocegi:       ['ucanbocek', 'sari', 0.70],
    sonuk_fener:       ['fener', 'sari', 0.85],
    kul_yigini:        ['yigin', 'kul', 1.00],
    kul_muhafizi:      ['nobetci', 'celik', 1.12],
    obur_kor:          ['alev', 'kan', 1.10],
    alev_ikizi:        ['alev', 'kor', 0.88],
    kul_devi:          ['dev', 'kor', 1.00],
    // Perde 2
    curuf_yaratigi:    ['curuf', 'kan', 0.95],
    koz_avcisi:        ['avci', 'kor', 0.92],
    kullu_rahip:       ['rahip', 'mor', 0.95],
    demir_otomat:      ['otomat', 'celik', 1.00],
    ciglik:            ['ciglik', 'mor', 0.90],
    kor_yilani:        ['yilan', 'kor', 0.95],
    yanki_varligi:     ['girdap', 'mor', 0.92],
    curuf_yigini:      ['yigin', 'kan', 1.05],
    kirik_can:         ['can', 'sari', 1.05],
    kul_sovalyesi:     ['sovalye', 'celik', 1.05],
    curuf_agasi:       ['kaba', 'kan', 1.05],
    sonmus_kral:       ['kral', 'mor', 1.00],
    // Perde 3
    alev_elementali:   ['alev', 'sari', 1.00],
    kor_devi_kucuk:    ['kaba', 'kor', 1.05],
    golge_alev:        ['hayalet', 'mor', 0.95],
    sonsuz_kor:        ['alev', 'beyaz', 1.00],
    ates_yumagi:       ['yilan', 'kan', 0.92],
    kul_cadisi:        ['rahip', 'yesil', 0.95],
    yanardag_muhafizi: ['volkan', 'kan', 1.05],
    kullerin_efendisi: ['orakci', 'mor', 1.05],
    ilk_alev:          ['cekirdek', 'beyaz', 1.00],
    // Oyuncu
    oyuncu:            ['oyuncu', 'kor', 1.00]
  };

  /* ---------------------------------------------------------------- */
  /*  Çizim                                                            */
  /* ---------------------------------------------------------------- */

  var sayac = 0;

  /**
   * @param id   düşman tanım id'si ya da 'oyuncu'
   * @param opt  {boy: px}
   * @return SVG kaynak metni
   */
  function svg(id, opt) {
    opt = opt || {};
    var e = ESLEME[id] || ['ceset', 'kul', 1];
    var sekil = S[e[0]] || S.ceset;
    var p = PALET[e[1]] || PALET.kor;
    var olcek = e[2] || 1;
    var n = ++sayac;
    var gid = 'sg' + n, kid = 'sk' + n, fid = 'sf' + n;
    var icid = 'si' + n, clid = 'sc' + n;

    var korMerkez = sekil.kor || [50, 74, 30];

    var govde =
      '<defs>' +
        // arka hale
        '<radialGradient id="' + kid + '" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="' + p.kor + '" stop-opacity=".9"/>' +
          '<stop offset="50%" stop-color="' + p.kor + '" stop-opacity=".26"/>' +
          '<stop offset="100%" stop-color="' + p.kor + '" stop-opacity="0"/>' +
        '</radialGradient>' +
        // gövde: ışık aşağıdan (zemindeki kor), o yüzden alt taraf daha açık
        '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%"   stop-color="#171310"/>' +
          '<stop offset="55%"  stop-color="#241b16"/>' +
          '<stop offset="100%" stop-color="#3a2a20"/>' +
        '</linearGradient>' +
        // gövdenin içinden sızan kor
        '<radialGradient id="' + icid + '" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="' + p.kor + '" stop-opacity=".85"/>' +
          '<stop offset="60%" stop-color="' + p.kor + '" stop-opacity=".18"/>' +
          '<stop offset="100%" stop-color="' + p.kor + '" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="' + fid + '" x="-45%" y="-45%" width="190%" height="190%">' +
          '<feGaussianBlur stdDeviation="3"/>' +
        '</filter>' +
        '<clipPath id="' + clid + '">' + sekil.yol + '</clipPath>' +
      '</defs>' +

      // 1) arkada hale
      '<ellipse cx="' + korMerkez[0] + '" cy="' + korMerkez[1] + '" ' +
        'rx="' + (korMerkez[2] * 1.55) + '" ry="' + (korMerkez[2] * 1.4) + '" ' +
        'fill="url(#' + kid + ')" opacity=".5"/>' +

      // 2) alttan kenar ışığı: gövdenin 3px aşağı kaydırılmış kopyası,
      //    üstüne gerçek gövde binince altta parlayan bir kenar kalıyor
      '<g transform="translate(0,3.2)" fill="' + p.kor + '" stroke="' + p.kor + '" ' +
        'color="' + p.kor + '" opacity=".42" filter="url(#' + fid + ')" ' +
        'stroke-linejoin="round">' + sekil.yol + '</g>' +

      // 3) gövde — arka plandan ayrışan gerçek bir kütle
      '<g fill="url(#' + gid + ')" stroke="url(#' + gid + ')" color="#2e211a" ' +
        'stroke-linejoin="round" stroke-linecap="round">' + sekil.yol + '</g>' +

      // 4) gövdenin içine kırpılmış kor sızıntısı
      '<g clip-path="url(#' + clid + ')">' +
        '<ellipse cx="' + korMerkez[0] + '" cy="' + (korMerkez[1] + 8) + '" ' +
          'rx="' + (korMerkez[2] * 1.1) + '" ry="' + (korMerkez[2] * 1.25) + '" ' +
          'fill="url(#' + icid + ')" opacity=".58"/>' +
      '</g>' +

      // 5) ince üst kontur — kütleyi arka plandan keskin ayırır
      '<g fill="none" stroke="' + p.kor + '" stroke-width="1.1" opacity=".3" ' +
        'stroke-linejoin="round">' + sekil.yol + '</g>';

    // 6) gözler
    var g = sekil.goz || [];
    for (var i = 0; i < g.length; i++) {
      govde += '<circle cx="' + g[i][0] + '" cy="' + g[i][1] + '" r="' +
               ((sekil.gozR || 2.6) * 2.4) + '" fill="' + p.goz + '" opacity=".3"/>' +
               '<circle cx="' + g[i][0] + '" cy="' + g[i][1] + '" r="' +
               (sekil.gozR || 2.6) + '" fill="' + p.goz + '"/>';
    }

    // boy verilmezse kapsayıcıyı doldurur (oyun içi kullanım)
    var olcu = opt.boy ? ('width="' + opt.boy + '" height="' + (opt.boy * 1.06) + '"')
                       : 'width="100%" height="100%"';
    return '<svg class="siluet" viewBox="0 0 100 106" ' + olcu + ' ' +
           'preserveAspectRatio="xMidYMax meet" ' +
           'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           '<g transform="translate(50 53) scale(' + olcek + ') translate(-50 -53)">' +
           govde + '</g></svg>';
  }

  function el(id, opt) {
    var d = document.createElement('div');
    d.className = 'siluet-kap';
    d.innerHTML = svg(id, opt);
    return d;
  }

  /* ================================================================== */
  /*  MÜHÜR — kart resmi                                                 */
  /*  87 karta tek tek ikon çizmek yerine, her kartın kimliğinden        */
  /*  türetilen benzersiz bir işaret. Aynı kart her zaman aynı mührü     */
  /*  alır; emoji kullanmadan her karta kendine ait bir yüz verir.       */
  /* ================================================================== */

  var YOL_RENK = {
    yangin: '#ff8a3d', kul: '#c79cf0', demir: '#7fb6e8', genel: '#d8c7b0'
  };

  function karistirTohum(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function muhur(kartId, yol, tur) {
    var t = karistirTohum(kartId);
    function sonraki() {
      t ^= t << 13; t >>>= 0;
      t ^= t >> 17;
      t ^= t << 5;  t >>>= 0;
      return t / 4294967296;
    }
    var renk = YOL_RENK[yol] || YOL_RENK.genel;
    var n = ++sayac;
    var gid = 'mh' + n;
    var p = '';        // konturlu parçalar
    var dolu = '';     // dolu noktalar

    // 1) merkez biçim — türe göre: saldırı sivri, beceri yuvarlak, güç köşeli
    var kenar = tur === 'saldiri' ? 3 : tur === 'guc' ? 6 : tur === 'beceri' ? 0 : 4;
    if (kenar === 0) {
      p += '<circle cx="50" cy="50" r="' + (11 + sonraki() * 5).toFixed(1) + '"/>';
    } else {
      var r = 13 + sonraki() * 5, dondur = sonraki() * 360, nokta = [];
      for (var k = 0; k < kenar; k++) {
        var a = (k / kenar) * Math.PI * 2 + dondur * Math.PI / 180;
        nokta.push((50 + Math.cos(a) * r).toFixed(1) + ',' + (50 + Math.sin(a) * r).toFixed(1));
      }
      p += '<polygon points="' + nokta.join(' ') + '"/>';
    }

    // 2) ışınlar
    var isin = 3 + Math.floor(sonraki() * 4);
    var baslangic = sonraki() * 360;
    for (var i = 0; i < isin; i++) {
      var ac = (baslangic + (i / isin) * 360 + sonraki() * 14) * Math.PI / 180;
      var ic = 17 + sonraki() * 6, dis = 30 + sonraki() * 14;
      p += '<line x1="' + (50 + Math.cos(ac) * ic).toFixed(1) + '" y1="' +
           (50 + Math.sin(ac) * ic).toFixed(1) + '" x2="' +
           (50 + Math.cos(ac) * dis).toFixed(1) + '" y2="' +
           (50 + Math.sin(ac) * dis).toFixed(1) + '"/>';
      if (sonraki() < 0.4) {
        dolu += '<circle cx="' + (50 + Math.cos(ac) * dis).toFixed(1) + '" cy="' +
                (50 + Math.sin(ac) * dis).toFixed(1) + '" r="2.4"/>';
      }
    }

    // 3) yay — mührü çember içine alır
    var yayBas = sonraki() * 360;
    var yayBoy = 90 + sonraki() * 170;
    var yr = 34 + sonraki() * 5;
    var a1 = yayBas * Math.PI / 180, a2 = (yayBas + yayBoy) * Math.PI / 180;
    p += '<path d="M' + (50 + Math.cos(a1) * yr).toFixed(1) + ' ' +
         (50 + Math.sin(a1) * yr).toFixed(1) +
         ' A' + yr.toFixed(1) + ' ' + yr.toFixed(1) + ' 0 ' +
         (yayBoy > 180 ? 1 : 0) + ' 1 ' +
         (50 + Math.cos(a2) * yr).toFixed(1) + ' ' +
         (50 + Math.sin(a2) * yr).toFixed(1) + '"/>';

    return '<svg class="muhur" viewBox="0 0 100 100" width="100%" height="100%" ' +
           'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           '<defs><radialGradient id="' + gid + '" cx="50%" cy="50%" r="50%">' +
             '<stop offset="0%" stop-color="' + renk + '" stop-opacity=".55"/>' +
             '<stop offset="100%" stop-color="' + renk + '" stop-opacity="0"/>' +
           '</radialGradient></defs>' +
           '<circle cx="50" cy="50" r="42" fill="url(#' + gid + ')"/>' +
           '<g fill="none" stroke="' + renk + '" stroke-width="2.4" ' +
             'stroke-linecap="round" stroke-linejoin="round" opacity=".92">' + p + '</g>' +
           '<g fill="' + renk + '" opacity=".9">' + dolu + '</g>' +
           '</svg>';
  }

  global.SANAT = {
    svg: svg, el: el, muhur: muhur,
    sekiller: S, esleme: ESLEME, palet: PALET, yolRenk: YOL_RENK,
    varMi: function (id) { return !!ESLEME[id]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
