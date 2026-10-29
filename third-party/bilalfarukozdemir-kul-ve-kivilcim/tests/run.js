/* =========================================================================
   TEST KOŞUMU  —  node tests/run.js
   ---------------------------------------------------------------------
   Motor tarayıcıdan bağımsız olduğu için burada deterministik test
   edilebiliyor. İki bölüm:
     1) Birim testleri  — hasar/blok/durum matematiği, deste, harita, kayıt
     2) Duman testleri  — her kart / düşman / olay / yadigâr en az bir kez
                          çalıştırılır (sessiz kırılmaları yakalamak için)
   `node tests/run.js --sim 400` ile denge simülasyonu da koşar.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DOSYALAR = [
  'js/core/rng.js', 'js/core/util.js',
  'js/data/keywords.js', 'js/data/cards.js', 'js/data/relics.js',
  'js/data/potions.js', 'js/data/enemies.js', 'js/data/events.js',
  'js/game/combat.js', 'js/game/run.js'
];

const G = vm.createContext({ console });
for (const f of DOSYALAR) {
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), G, { filename: f });
  } catch (e) {
    console.error(`\n✗ ${f} yüklenemedi:\n  ${e.stack}\n`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Test altyapısı                                                     */
/* ------------------------------------------------------------------ */

let gecen = 0, kalan = [];
function t(ad, fn) {
  try { fn(); gecen++; }
  catch (e) { kalan.push({ ad, hata: e.message, yig: e.stack }); }
}
function esit(a, b, mesaj) {
  if (a !== b) throw new Error(`${mesaj || ''} — beklenen ${b}, gelen ${a}`);
}
function dogru(v, mesaj) { if (!v) throw new Error(mesaj || 'doğru bekleniyordu'); }

/* ------------------------------------------------------------------ */
/*  Yardımcılar                                                        */
/* ------------------------------------------------------------------ */

function yeniRun(tohum, zorluk) { return new G.Run(tohum || 'TEST-001', zorluk || 0); }

/** Belirli düşmanlarla, kontrollü bir savaş kurar */
function savasKur(dusmanlar, opt) {
  opt = opt || {};
  const run = opt.run || yeniRun(opt.tohum);
  if (opt.deste) {
    run.deste = opt.deste.map(x => G.yeniKart(x.id || x, x.up));
  }
  if (opt.yadigarlar) {
    run.yadigarlar = opt.yadigarlar.map(id => ({ id }));
  }
  const k = { id: 'test', tur: opt.tur || 'normal', dusmanlar };
  const C = new G.Combat(run, k, run.rng.s('savas'));
  C.basla();
  return C;
}

/** Kartı zorla ele koyup oynatır (enerji sınırsız) */
function oyna(C, id, up, hedefIdx) {
  const k = G.yeniKart(id, up);
  C.el.push(k);
  C.enerji = 99;
  return C.kartOyna(k.uid, hedefIdx === undefined ? 0 : hedefIdx);
}

/* ================================================================== */
/*  1. HASAR VE BLOK MATEMATİĞİ                                        */
/* ================================================================== */

// Sayılar kart verisinden türetiliyor: testler kuralı doğrular, denge
// değerini değil. Böylece denge ayarı testleri kırmıyor.
const DEG = (id, up) => G.kartDegerleri({ id, up: !!up });

t('Temel saldırı hasarı kartta yazan değer kadar', () => {
  const C = savasKur(['kul_yigini']);
  const e = C.dusmanlar[0];
  const once = e.hp;
  oyna(C, 'vurus');
  esit(once - e.hp, DEG('vurus').d, 'Vuruş hasarı');
});

t('Yükseltilmiş kart değerleri uygulanır', () => {
  const C = savasKur(['kul_yigini']);
  const e = C.dusmanlar[0];
  const once = e.hp;
  oyna(C, 'vurus', true);
  esit(once - e.hp, DEG('vurus', true).d, 'Vuruş+ hasarı');
  dogru(DEG('vurus', true).d > DEG('vurus').d, 'yükseltme daha güçlü olmalı');
});

t('Güç vuruş başına eklenir', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'guc', 3);
  const e = C.dusmanlar[0];
  const once = e.hp;
  const v = DEG('ikiz_alev');       // çoklu vuruş
  oyna(C, 'ikiz_alev');
  esit(once - e.hp, (v.d + 3) * v.n, 'Güç her vuruşa ayrı eklenmeli');
});

t('Zayıflık kaynağa, Kırılganlık hedefe — sıralama doğru', () => {
  // Güç eklenir → Zayıflık %25 azaltır → Kırılganlık %50 artırır (her adımda floor)
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'guc', 3);
  C.durumVer(C.p, 'zayiflik', 2);
  C.durumVer(C.dusmanlar[0], 'kirilganlik', 2);
  const e = C.dusmanlar[0];
  const once = e.hp;
  oyna(C, 'vurus');
  const beklenen = Math.floor(Math.floor((DEG('vurus').d + 3) * 0.75) * 1.5);
  esit(once - e.hp, beklenen, 'Güç → Zayıflık → Kırılganlık sırası');
});

t('Blok: Çeviklik eklenir, Kırık sonra uygulanır', () => {
  const C = savasKur(['kul_yigini']);
  C.p.block = 0;
  C.durumVer(C.p, 'ceviklik', 2);
  C.durumVer(C.p, 'kirik', 2);
  oyna(C, 'savun');
  esit(C.p.block, Math.floor((DEG('savun').b + 2) * 0.75), '(blok+çeviklik)*0.75');
});

t('Ham blok Çeviklik/Kırık\'tan etkilenmez', () => {
  const C = savasKur(['kul_yigini']);
  C.p.block = 0;
  C.durumVer(C.p, 'ceviklik', 5);
  C.blokVer(C.p, 10, { ham: true });
  esit(C.p.block, 10, 'ham blok değişmemeli');
});

t('Blok hasarı emer, taşan kısım cana gider', () => {
  const C = savasKur(['kul_yigini']);
  C.p.block = 4;
  const once = C.p.hp;
  C.hasarUygula(C.p, 10, { saldiri: true, kaynak: C.dusmanlar[0] });
  esit(C.p.block, 0, 'blok tükenmeli');
  esit(once - C.p.hp, 6, 'kalan 6 hasar cana gitmeli');
});

t('Diken tam bloklanan saldırıda da tetiklenir', () => {
  const C = savasKur(['kul_yigini']);
  C.p.block = 100;
  C.durumVer(C.p, 'diken', 5);
  const e = C.dusmanlar[0];
  const once = e.hp;
  C.vur(e, C.p, 10);
  esit(once - e.hp, 5, 'Diken bloklanan saldırıda da yansımalı');
});

t('Diken sonsuz döngüye girmez', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'diken', 3);
  C.durumVer(C.dusmanlar[0], 'diken', 3);
  C.vur(C.dusmanlar[0], C.p, 5);    // patlarsa test çöker
  dogru(true);
});

/* ================================================================== */
/*  2. DURUM ETKİLERİ                                                  */
/* ================================================================== */

t('Yanık tur sonunda vurur ve 1 azalır', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'yanik', 4);
  const once = C.p.hp;
  C.p.block = 0;
  C.turSonuDurumlar(C.p);
  esit(once - C.p.hp, 4, 'Yanık 4 hasar');
  esit(C.p.st.yanik, 3, 'Yanık 3\'e düşmeli');
});

t('Kavrulma azalmaz', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'zehirlenme', 4);
  C.turSonuDurumlar(C.p);
  esit(C.p.st.zehirlenme, 4, 'Kavrulma sabit kalmalı');
});

t('Süreli etkiler tur sonunda azalır, kalıcılar azalmaz', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'zayiflik', 2);
  C.durumVer(C.p, 'guc', 3);
  C.turSonuDurumlar(C.p);
  esit(C.p.st.zayiflik, 1, 'Zayıflık azalmalı');
  esit(C.p.st.guc, 3, 'Güç kalıcı');
});

t('Tılsım bir olumsuz etkiyi yutar', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'tilsim', 1);
  C.durumVer(C.p, 'zayiflik', 3);
  esit(C.p.st.zayiflik, undefined, 'Zayıflık engellenmeli');
  esit(C.p.st.tilsim, undefined, 'Tılsım tükenmeli');
  C.durumVer(C.p, 'zayiflik', 2);
  esit(C.p.st.zayiflik, 2, 'İkinci debuff geçmeli');
});

t('Tılsım olumlu etkileri engellemez', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'tilsim', 2);
  C.durumVer(C.p, 'guc', 2);
  esit(C.p.st.guc, 2, 'Güç geçmeli');
  esit(C.p.st.tilsim, 2, 'Tılsım harcanmamalı');
});

t('Zırh tur başında blok verir', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'zirh', 4);
  C.p.block = 0;
  C.turBasla();
  dogru(C.p.block >= 4, 'Zırh bloku gelmeli, gelen: ' + C.p.block);
});

t('Öfke saldırı kartında blok verir', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'ofke', 3);
  C.p.block = 0;
  oyna(C, 'vurus');
  esit(C.p.block, 3, 'Öfke bloku');
});

t('Yankı turun ilk saldırısını tekrarlar', () => {
  const C = savasKur(['kul_yigini']);
  C.durumVer(C.p, 'yanki', 1);
  const e = C.dusmanlar[0];
  const once = e.hp;
  const d = DEG('vurus').d;
  oyna(C, 'vurus');
  esit(once - e.hp, d * 2, 'ilk saldırı iki kez tetiklenmeli');
  const ara = e.hp;
  oyna(C, 'vurus');
  esit(ara - e.hp, d, 'ikinci saldırı tekrarlanmamalı');
});

/* ================================================================== */
/*  3. AKKOR SİSTEMİ                                                   */
/* ================================================================== */

t('Akkor birikir ve Patlama harcayarak vurur', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: [] });
  C.akkor = 0;
  const a = DEG('ufleme').a, k = DEG('patlama').k;
  oyna(C, 'ufleme');
  oyna(C, 'ufleme');
  esit(C.akkor, a * 2, 'Akkor birikmeli');
  const e = C.dusmanlar[0];
  const once = e.hp;
  oyna(C, 'patlama');
  esit(once - e.hp, a * 2 * k, 'Akkor başına {k} hasar');
  esit(C.akkor, 0, 'Akkor tükenmeli');
});

t('Ebedi Ateş Akkoru korur', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: [] });
  C.akkor = 5;
  oyna(C, 'ebedi_ates');
  const e = C.dusmanlar[0];
  const once = e.hp;
  oyna(C, 'patlama');
  esit(once - e.hp, 5 * DEG('patlama').k, 'yine 5 Akkor kadar hasar');
  esit(C.akkor, 5, 'Akkor korunmalı');
});

t('Zincir durumu Akkor kazancını engeller', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: [] });
  C.akkor = 0;
  C.durumVer(C.p, 'zincir', 2);
  oyna(C, 'ufleme');
  esit(C.akkor, 0, 'Zincir varken Akkor kazanılmamalı');
});

t('Körük yadigârı Akkor kazancını artırır', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: ['koruk'] });
  C.akkor = 0;
  oyna(C, 'ufleme');
  esit(C.akkor, DEG('ufleme').a + 1, 'Körük +1');
});

t('Alevin Özü harcanan Akkorun yarısını iade eder', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: ['alevin_ozu'] });
  C.akkor = 6;
  oyna(C, 'patlama');
  esit(C.akkor, 3, 'yarısı geri gelmeli');
});

/* ================================================================== */
/*  4. DESTE VE ENERJİ                                                 */
/* ================================================================== */

t('Çekme destesi bitince atık karılıp geri gelir', () => {
  const C = savasKur(['kul_yigini']);
  C.cekme = [];
  C.atik = [G.yeniKart('vurus'), G.yeniKart('savun'), G.yeniKart('siper')];
  const el = C.el.length;
  C.cek(3);
  esit(C.el.length, el + 3, '3 kart çekilmeli');
  esit(C.atik.length, 0, 'atık boşalmalı');
});

t('El sınırı 10', () => {
  const C = savasKur(['kul_yigini']);
  C.el = [];
  for (let i = 0; i < 15; i++) C.cekme.push(G.yeniKart('vurus'));
  C.cek(15);
  esit(C.el.length, 10, 'el en fazla 10 kart');
});

t('Enerji harcanır ve yetmeyince kart oynanamaz', () => {
  const C = savasKur(['kul_yigini']);
  C.enerji = 1;
  const k = G.yeniKart('duvar');   // 2 enerji
  C.el.push(k);
  esit(C.kartOyna(k.uid, 0), false, 'enerji yetmemeli');
  C.enerji = 2;
  esit(C.kartOyna(k.uid, 0), true, 'yeterken oynanmalı');
  esit(C.enerji, 0, 'enerji düşmeli');
});

t('X bedelli kart tüm enerjiyi kullanır', () => {
  const C = savasKur(['kul_yigini']);
  C.enerji = 3;
  const e = C.dusmanlar[0];
  const once = e.hp;
  const k = G.yeniKart('son_direnis');
  C.el.push(k);
  C.kartOyna(k.uid, 0);
  esit(C.enerji, 0, 'tüm enerji gitmeli');
  esit(once - e.hp, 3 * DEG('son_direnis').k, '3 × {k} hasar');
});

t('Oynanamaz kartlar (durum/lanet) oynanamaz', () => {
  const C = savasKur(['kul_yigini']);
  const k = G.yeniKart('yara');
  C.el.push(k);
  C.enerji = 9;
  esit(C.kartOyna(k.uid, 0), false, 'Yara oynanmamalı');
});

t('Tüketilen kart tüketilenler destesine gider', () => {
  const C = savasKur(['kul_yigini']);
  const n = C.tuketilen.length;
  oyna(C, 'kirilmaz');
  esit(C.tuketilen.length, n + 1, 'tüketilmeli');
});

t('Güç kartı destelere değil güçler alanına gider', () => {
  const C = savasKur(['kul_yigini']);
  const a = C.atik.length;
  oyna(C, 'demir_deri');
  esit(C.atik.length, a, 'atığa gitmemeli');
  esit(C.gucler.length, 1, 'güçler alanına gitmeli');
});

t('Elde kalır: Sabır tur sonunda atılmaz', () => {
  const C = savasKur(['kul_yigini']);
  C.el = [G.yeniKart('sabir')];
  C.turBitir();
  let bulundu = C.el.some(k => k.id === 'sabir');
  dogru(bulundu, 'Sabır elde kalmalı');
});

t('Lanet: Kor Yükü turu elde bitirince hasar verir', () => {
  const C = savasKur(['kul_yigini']);
  C.el = [G.yeniKart('lanet_kor_yuku')];
  C.p.block = 0;
  const once = C.p.hp;
  C.turBitir();
  dogru(once - C.p.hp >= 2, 'en az 2 hasar almalı');
});

/* ================================================================== */
/*  5. KART SEÇİMİ VE SAVAŞ AKIŞI                                      */
/* ================================================================== */

t('Kader Taşı seçim bekletir, seçimden sonra devam eder', () => {
  const C = savasKur(['kul_yigini']);
  oyna(C, 'secim');
  dogru(!!C.secim, 'seçim beklemeli');
  esit(C.kartOyna(C.el.length ? C.el[0].uid : 'x', 0), false, 'seçim varken kart oynanamaz');
  const uid = C.secim.kartlar[0].uid;
  C.secimYap(uid);
  esit(C.secim, null, 'seçim çözülmeli');
  dogru(C.el.some(k => k.uid === uid), 'seçilen kart ele gelmeli');
});

t('Tüm düşmanlar ölünce savaş zaferle biter', () => {
  const C = savasKur(['ates_bocegi']);
  C.dusmanlar[0].hp = 1;
  oyna(C, 'vurus');
  esit(C.bitti, 'zafer', 'zafer olmalı');
});

t('Oyuncu ölünce savaş yenilgiyle biter', () => {
  const C = savasKur(['kul_yigini']);
  C.p.hp = 3;
  C.p.block = 0;
  C.hasarUygula(C.p, 50, { saldiri: true, kaynak: C.dusmanlar[0] });
  esit(C.bitti, 'yenilgi', 'yenilgi olmalı');
});

t('Feniks Tüyü ölümü bir kez engeller', () => {
  const C = savasKur(['kul_yigini'], { yadigarlar: ['feniks_tuyu'] });
  C.p.hp = 3; C.p.block = 0;
  C.hasarUygula(C.p, 50, { saldiri: true, kaynak: C.dusmanlar[0] });
  esit(C.bitti, null, 'ölmemeli');
  dogru(C.p.hp > 0, 'canı olmalı');
  C.p.block = 0;
  C.hasarUygula(C.p, 500, { saldiri: true, kaynak: C.dusmanlar[0] });
  esit(C.bitti, 'yenilgi', 'ikinci kez ölmeli');
});

t('Ölü düşman hedef alınmaz, hedef canlıya kayar', () => {
  const C = savasKur(['ates_bocegi', 'kul_yigini']);
  C.dusmanlar[0].hp = 1;
  oyna(C, 'vurus', false, 0);
  dogru(C.dusmanlar[0].olu, 'ilk düşman ölmeli');
  const once = C.dusmanlar[1].hp;
  oyna(C, 'vurus', false, 0);       // ölüye vurmaya çalış
  dogru(C.dusmanlar[1].hp < once, 'hasar canlıya gitmeli');
});

t('Niyet gösterimi Kırılganlık/Zayıflık ile güncellenir', () => {
  const C = savasKur(['kul_yigini']);
  const e = C.dusmanlar[0];
  e.hamle = { id: 'x', niyet: { tip: 'saldiri', hasar: 10 }, et: () => {} };
  esit(C.niyetGoster(e).hasar, 10, 'temel 10');
  C.durumVer(e, 'zayiflik', 2);
  esit(C.niyetGoster(e).hasar, 7, 'zayıflıkla floor(7.5)=7');
  C.durumVer(C.p, 'kirilganlik', 2);
  esit(C.niyetGoster(e).hasar, 10, 'kırılganlıkla floor(10.5)=10');
});

/* ================================================================== */
/*  6. DUMAN TESTLERİ — her içerik en az bir kez çalışsın               */
/* ================================================================== */

t('Her kart hatasız oynanır (normal + yükseltilmiş)', () => {
  const hatalar = [];
  for (const id of Object.keys(G.KARTLAR)) {
    const def = G.KARTLAR[id];
    if (def.oynanmaz) continue;
    for (const up of [false, true]) {
      try {
        const C = savasKur(['kul_yigini', 'ates_bocegi']);
        C.akkor = 7;
        C.sonOynananDef = { id: 'vurus', up: false };
        C.el.push(G.yeniKart('savun'));   // "bir kart at" koşulları için
        C.el.push(G.yeniKart('yara'));
        C.durumVer(C.p, 'diken', 2);
        C.durumVer(C.dusmanlar[0], 'yanik', 4);
        C.p.block = 12;
        if (!oyna(C, id, up)) {
          // koşulu sağlanmayan kart varsa bunu bildir
          if (!def.kosul) hatalar.push(`${id}${up ? '+' : ''} oynanamadı`);
        }
        if (C.secim) C.secimYap(C.secim.kartlar[0].uid);
      } catch (e) {
        hatalar.push(`${id}${up ? '+' : ''}: ${e.message}`);
      }
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her kartın metni tanımlı değerlerle eşleşir', () => {
  const hatalar = [];
  for (const id of Object.keys(G.KARTLAR)) {
    const def = G.KARTLAR[id];
    if (!def.metin) { hatalar.push(`${id}: metin yok`); continue; }
    const v = G.kartDegerleri({ id, up: false });
    const anahtarlar = (def.metin.match(/\{(\w+)\}/g) || [])
      .map(s => s.slice(1, -1));
    for (const a of anahtarlar) {
      if (v[a] === undefined) hatalar.push(`${id}: metinde {${a}} var ama değer yok`);
    }
    if (!def.ad) hatalar.push(`${id}: ad yok`);
    if (def.bedel === undefined) hatalar.push(`${id}: bedel yok`);
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her düşman 12 tur boyunca hatasız oynar', () => {
  const hatalar = [];
  for (const id of Object.keys(G.DUSMANLAR)) {
    try {
      const run = yeniRun('DUSMAN-' + id);
      run.hp = run.maxHp = 100000;
      const C = new G.Combat(run, { id: 't', tur: 'normal', dusmanlar: [id, id] },
                             run.rng.s('savas'));
      C.basla();
      for (let i = 0; i < 12 && !C.bitti; i++) {
        C.p.hp = 100000;
        C.turBitir();
      }
    } catch (e) {
      hatalar.push(`${id}: ${e.message}`);
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her düşman hamlesinin niyeti okunabilir', () => {
  const hatalar = [];
  for (const id of Object.keys(G.DUSMANLAR)) {
    const run = yeniRun('NIYET-' + id);
    run.hp = run.maxHp = 100000;
    const C = new G.Combat(run, { id: 't', tur: 'normal', dusmanlar: [id] },
                           run.rng.s('savas'));
    C.basla();
    for (let i = 0; i < 10 && !C.bitti; i++) {
      const n = C.niyetGoster(C.dusmanlar[0]);
      if (!n) { hatalar.push(`${id}: niyet yok`); break; }
      if (!n.tip) hatalar.push(`${id}: niyet tipi yok`);
      C.p.hp = 100000;
      C.turBitir();
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her yadigâr savaş boyunca hatasız çalışır', () => {
  const hatalar = [];
  for (const id of Object.keys(G.YADIGARLAR)) {
    try {
      const run = yeniRun('YAD-' + id);
      run.yadigarlar = [{ id }];
      const def = G.YADIGARLAR[id];
      if (def.k && def.k.alinca) def.k.alinca(run, run.yadigarlar[0]);
      const C = new G.Combat(run, { id: 't', tur: 'elit', dusmanlar: ['kul_yigini'] },
                             run.rng.s('savas'));
      C.basla();
      for (let i = 0; i < 4 && !C.bitti; i++) {
        oyna(C, 'vurus'); oyna(C, 'savun'); oyna(C, 'ufleme'); oyna(C, 'patlama');
        C.p.hp = Math.max(1, C.p.hp);
        C.turBitir();
      }
      run.kTrig('savasSonu');
      run.kMod('altinCarpani', 20);
      run.kMod('fiyatCarpani', 50);
      run.kMod('dinlenmeCarpani', 20);
    } catch (e) {
      hatalar.push(`${id}: ${e.message}`);
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her iksir hatasız kullanılır', () => {
  const hatalar = [];
  for (const id of Object.keys(G.IKSIRLER)) {
    for (const gu of [false, true]) {
      try {
        const C = savasKur(['kul_yigini', 'ates_bocegi']);
        C.durumVer(C.p, 'zayiflik', 2);
        G.IKSIRLER[id].et(C, C.dusmanlar[0], gu);
      } catch (e) { hatalar.push(`${id}: ${e.message}`); }
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Her olayın her seçeneği hatasız çalışır', () => {
  const hatalar = [];
  for (const id of Object.keys(G.OLAYLAR)) {
    const olay = G.OLAYLAR[id];
    for (let i = 0; i < olay.secenekler.length; i++) {
      try {
        const run = yeniRun('OLAY-' + id + '-' + i);
        run.altin = 500;
        for (let n = 0; n < 4; n++) run.kartEkle('vurus');
        run.yadigarEkle('kor_tasi');
        const sec = olay.secenekler[i];
        if (sec.kosul && !sec.kosul(run)) continue;
        const metin = run.olayUygula(id, i);
        if (typeof metin !== 'string') hatalar.push(`${id}[${i}]: metin dönmedi`);
        // Kuyruğu simüle et
        let guard = 0;
        while (run.akis.length && guard++ < 10) {
          const a = run.akis.shift();
          if (a.tip === 'kartSec') {
            const aday = run.deste.filter(a.filtre);
            if (aday.length) a.cb(aday[0]);
          } else if (a.tip === 'kartOdul') {
            run.kartEkle(a.kartlar[0]);
          }
        }
      } catch (e) { hatalar.push(`${id}[${i}]: ${e.message}`); }
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

t('Tüm karşılaşma tablolarındaki düşmanlar tanımlı', () => {
  const hatalar = [];
  for (const perde of [1, 2, 3]) {
    const tablo = G.KARSILASMALAR[perde];
    for (const tur of Object.keys(tablo)) {
      for (const k of tablo[tur]) {
        for (const d of k.dusmanlar) {
          if (!G.DUSMANLAR[d]) hatalar.push(`perde${perde}/${tur}/${k.id}: ${d} yok`);
        }
      }
    }
  }
  if (hatalar.length) throw new Error(hatalar.join(' | '));
});

/* ================================================================== */
/*  7. HARİTA                                                          */
/* ================================================================== */

t('Harita: her düğüm erişilebilir ve çıkışı var', () => {
  for (let i = 0; i < 60; i++) {
    const run = yeniRun('HARITA-' + i);
    for (const perde of [1, 2, 3]) {
      const h = run.haritaUret(perde);
      esit(h.katlar.length, G.KAT_SAYISI, 'kat sayısı');
      esit(h.katlar[G.KAT_SAYISI - 1].length, 1, 'patron katı tek düğüm');
      for (let k = 0; k < h.katlar.length; k++) {
        for (const d of h.katlar[k]) {
          if (k > 0 && d.ebeveynler.length === 0) throw new Error(`kat ${k} düğüm ${d.idx} erişilemez`);
          if (k < h.katlar.length - 1 && d.cocuklar.length === 0)
            throw new Error(`kat ${k} düğüm ${d.idx} çıkışsız`);
          if (!d.tip) throw new Error(`kat ${k} düğüm ${d.idx} tipsiz`);
        }
      }
    }
  }
});

t('Harita: bağlantılar kesişmez (monoton)', () => {
  for (let i = 0; i < 40; i++) {
    const run = yeniRun('KESIS-' + i);
    const h = run.haritaUret(1);
    for (let k = 0; k < h.katlar.length - 1; k++) {
      const kat = h.katlar[k];
      for (let a = 0; a < kat.length; a++) {
        for (let b = a + 1; b < kat.length; b++) {
          const maxA = Math.max.apply(null, kat[a].cocuklar);
          const minB = Math.min.apply(null, kat[b].cocuklar);
          if (maxA > minB) throw new Error(`kat ${k}: ${a}→${maxA} ile ${b}→${minB} kesişiyor`);
        }
      }
    }
  }
});

t('Harita: elit ve dinlenme erken katlarda çıkmaz', () => {
  for (let i = 0; i < 40; i++) {
    const run = yeniRun('ERKEN-' + i);
    const h = run.haritaUret(1);
    for (let k = 0; k < 5; k++) {
      for (const d of h.katlar[k]) {
        if (d.tip === 'elit') throw new Error(`kat ${k}'te elit var`);
        if (d.tip === 'dinlenme') throw new Error(`kat ${k}'te dinlenme var`);
      }
    }
  }
});

t('Aynı tohum aynı haritayı üretir', () => {
  const a = JSON.stringify(yeniRun('AYNI-TOHUM').harita);
  const b = JSON.stringify(yeniRun('AYNI-TOHUM').harita);
  esit(a, b, 'harita deterministik olmalı');
});

/** Bir koşuyu gez; `kartBasi` savaşta kaç kart oynandığını belirler. */
function tohumGez(tohum, secim, kartBasi) {
  const run = yeniRun(tohum);
  const izler = [];
  for (let kat = 0; kat < 12; kat++) {
    const acik = kat === 0 ? run.harita.katlar[0] : run.acikDugumler();
    if (!acik.length) break;
    const d = acik[secim(kat) % acik.length];
    run.dugumeGir(d.kat, d.idx);
    if (d.icerik && d.icerik.karsilasma) {
      const k = d.icerik.karsilasma;
      const C = new G.Combat(run, k, run.rng.s('savas'));
      C.basla();
      izler.push(k.dusmanlar.join('+') + '#' + C.dusmanlar.map(e => e.maxHp).join(','));
      for (let tur = 0; tur < 3 && !C.bitti; tur++) {
        for (let i = 0; i < kartBasi && C.el.length; i++) {
          const c = C.el[0];
          if (!C.oynanabilirMi(c)) break;
          C.kartOyna(c.uid, 0);
        }
        C.p.hp = C.p.maxHp;
        C.turBitir();
      }
      run.hp = run.maxHp;
    } else if (d.icerik && d.icerik.olay) izler.push('olay:' + d.icerik.olay);
  }
  return izler;
}

t('Aynı tohum + aynı yol: oynayış biçimi karşılaşmaları DEĞİŞTİRMEZ', () => {
  // Regresyon: karşılaşma seçimi bir zamanlar savaş içi rastgelelikle aynı
  // akışı paylaşıyordu; çok kart oynayan oyuncu farklı düşmanlarla karşılaşıyordu.
  const ilk = tohumGez('PAYLASILAN-TOHUM', () => 0, 2);
  const cok = tohumGez('PAYLASILAN-TOHUM', () => 0, 6);
  dogru(ilk.length > 4, 'yeterince oda gezilmeli');
  esit(cok.join(' | '), ilk.join(' | '), 'aynı tohum + aynı yol aynı dünyayı vermeli');
});

t('Düşman canları da tohuma bağlı, oynayışa değil', () => {
  const a = tohumGez('CAN-TOHUM', () => 0, 1);
  const b = tohumGez('CAN-TOHUM', () => 0, 7);
  esit(a.join('|'), b.join('|'), 'canlar dahil birebir aynı olmalı');
});

t('Bir yol boyunca aynı karşılaşma art arda gelmez', () => {
  for (let i = 0; i < 40; i++) {
    const run = yeniRun('YOL-' + i);
    // Her kattan rastgele bir düğüm seçerek yolu yürü
    const rng = run.rng.s('coklu');
    let onceki = null;
    for (let kat = 0; kat < 14; kat++) {
      const acik = kat === 0 ? run.harita.katlar[0] : run.acikDugumler();
      if (!acik.length) break;
      const d = acik[rng.int(acik.length)];
      run.dugumeGir(d.kat, d.idx);
      const k = d.icerik && d.icerik.karsilasma;
      if (k) {
        if (onceki === k.id) throw new Error(`YOL-${i} kat ${kat}: ${k.id} art arda tekrarladı`);
        onceki = k.id;
      }
    }
  }
});

/* ================================================================== */
/*  8. KAYIT / YÜKLEME                                                 */
/* ================================================================== */

t('Kayıt–yükleme koşuyu aynen geri getirir', () => {
  const run = yeniRun('KAYIT-1');
  run.dugumeGir(0, 0);
  run.altinEkle(150);
  run.kartEkle('patlama', true);
  run.yadigarEkle('koruk');
  run.iksirEkle('can_iksiri');
  const d = JSON.parse(JSON.stringify(run.kaydet()));
  const r2 = G.Run.yukle(d);
  esit(r2.altin, run.altin, 'altın');
  esit(r2.deste.length, run.deste.length, 'deste boyu');
  esit(r2.yadigarlar.length, run.yadigarlar.length, 'yadigâr sayısı');
  esit(r2.hp, run.hp, 'can');
  esit(JSON.stringify(r2.harita), JSON.stringify(run.kaydet().harita), 'harita');
});

t('Yüklenen koşuda savaş başlatılabilir', () => {
  const run = yeniRun('KAYIT-2');
  const d = JSON.parse(JSON.stringify(run.kaydet()));
  const r2 = G.Run.yukle(d);
  const C = new G.Combat(r2, { id: 't', tur: 'normal', dusmanlar: ['kor_sicani'] },
                         r2.rng.s('savas'));
  C.basla();
  esit(C.el.length, 5, '5 kart çekilmeli');
});

/* ================================================================== */
/*  9. ÖDÜLLER                                                         */
/* ================================================================== */

t('Kart ödülleri tekrarsız ve geçerli', () => {
  const run = yeniRun('ODUL-1');
  for (let i = 0; i < 200; i++) {
    const k = run.kartOdulleri(3, 'normal');
    esit(k.length, 3, '3 kart');
    esit(new Set(k).size, 3, 'tekrarsız');
    for (const id of k) {
      dogru(!!G.KARTLAR[id], 'kart var: ' + id);
      dogru(['siradan', 'nadir', 'efsanevi'].includes(G.KARTLAR[id].nadirlik),
            'ödül nadirliği: ' + id);
    }
  }
});

t('Patron ödülü nadir/efsanevi verir', () => {
  const run = yeniRun('ODUL-2');
  for (let i = 0; i < 60; i++) {
    for (const id of run.kartOdulleri(3, 'patron')) {
      dogru(G.KARTLAR[id].nadirlik !== 'siradan', 'patron ödülü sıradan olmamalı');
    }
  }
});

t('Yadigâr ödülleri tekrar etmez', () => {
  const run = yeniRun('ODUL-3');
  const alinan = new Set();
  for (let i = 0; i < 25; i++) {
    const id = run.rastgeleYadigar();
    if (!id) break;
    dogru(!alinan.has(id), 'tekrar yadigâr: ' + id);
    alinan.add(id);
    run.yadigarEkle(id);
  }
});

t('Dükkan geçerli ürünler üretir', () => {
  for (let i = 0; i < 40; i++) {
    const run = yeniRun('DUKKAN-' + i);
    const d = run.dukkanUret();
    dogru(d.kartlar.length >= 5, 'kart sayısı');
    for (const k of d.kartlar) { dogru(!!G.KARTLAR[k.id], 'kart'); dogru(k.fiyat > 0, 'fiyat'); }
    for (const k of d.iksirler) { dogru(!!G.IKSIRLER[k.id], 'iksir'); dogru(k.fiyat > 0, 'fiyat'); }
    for (const k of d.yadigarlar) { dogru(!!G.YADIGARLAR[k.id], 'yadigâr'); dogru(k.fiyat > 0, 'fiyat'); }
  }
});

/* ================================================================== */
/*  ÇIKTI                                                              */
/* ================================================================== */

console.log('');
console.log('  KÜL VE KIVILCIM — motor testleri');
console.log('  ' + '─'.repeat(52));
console.log(`  ${gecen} geçti, ${kalan.length} kaldı`);
if (kalan.length) {
  console.log('');
  for (const k of kalan) console.log(`  ✗ ${k.ad}\n      ${k.hata}`);
}
console.log('');
console.log(`  İçerik: ${Object.keys(G.KARTLAR).length} kart · ` +
            `${Object.keys(G.DUSMANLAR).length} düşman · ` +
            `${Object.keys(G.YADIGARLAR).length} yadigâr · ` +
            `${Object.keys(G.IKSIRLER).length} iksir · ` +
            `${Object.keys(G.OLAYLAR).length} olay`);
console.log('');

if (kalan.length) process.exit(1);

/* ================================================================== */
/*  DENGE SİMÜLASYONU  (--sim N)                                       */
/* ================================================================== */

const simArg = process.argv.indexOf('--sim');
if (simArg >= 0) {
  const N = parseInt(process.argv[simArg + 1] || '200', 10);
  require('./bot.js')(G, N);
}
