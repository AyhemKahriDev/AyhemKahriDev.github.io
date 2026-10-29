/* =========================================================================
   TANI — denge sorunlarını izole etmek için ölçüm koşumu
   node tests/tani.js
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
for (const f of DOSYALAR) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), G, { filename: f });

/* --- botun karar mantığını yeniden kullan --------------------------- */
const botModul = require('./bot.js');   // sadece yüklenmesi için değil; kendi mini botumuz aşağıda

function zayifDusman(C) {
  const d = C.canliDusmanlar();
  if (!d.length) return null;
  let en = d[0];
  for (const e of d) if (e.hp + e.block < en.hp + en.block) en = e;
  return en;
}

function gelenHasar(C) {
  let t = 0;
  for (const e of C.canliDusmanlar()) {
    const n = C.niyetGoster(e);
    if (n && n.hasar) t += n.hasar * (n.kez || 1);
  }
  return t;
}

/** Basit ama makul oyuncu: açık hasarı blokla, kalanı vur */
function puan(C, kart) {
  const def = G.KARTLAR[kart.id];
  const v = G.kartDegerleri(kart);
  const bedel = C.kartBedeli(kart);
  const acik = Math.max(0, gelenHasar(C) - C.p.block);
  let hasar = def.tur === 'saldiri' ? (v.d || 0) * (v.n || 1) + (C.p.st.guc || 0) * (v.n || 1) : 0;
  if (kart.id === 'patlama') hasar = C.akkor * v.k;
  if (kart.id === 'volkan') hasar = C.akkor * v.k * C.canliDusmanlar().length;
  if (kart.id === 'atesle') hasar = v.d + Math.floor(C.akkor / 3) * v.k;
  if (kart.id === 'korla_vurus') hasar = C.akkor >= v.e ? v.d2 : v.d;
  let blok = v.b || 0;
  if (kart.id === 'korun_nefesi') blok = C.akkor * v.k;
  let p = hasar * 2.3 + Math.min(blok, acik) * 2.7 + Math.max(0, blok - acik) * 0.35;
  if (def.tur === 'guc') p += Math.max(20, 95 - C.tur * 10);
  p += (v.c || 0) * 9 + (v.a || 0) * 3.2 + (v.g || 0) * 14;
  p -= (bedel === -1 ? C.enerji : bedel) * 3.5;
  return p;
}

function savasOyna(C, maxTur) {
  let tur = 0;
  while (!C.bitti && tur < (maxTur || 60)) {
    tur++;
    let g = 0;
    while (g++ < 30 && !C.bitti) {
      if (C.secim) { C.secimYap(C.secim.kartlar[0].uid); continue; }
      let en = null, enP = 0.5;
      for (const k of C.el) {
        if (!C.oynanabilirMi(k)) continue;
        const p = puan(C, k);
        if (p > enP) { enP = p; en = k; }
      }
      if (!en) break;
      const h = zayifDusman(C);
      C.kartOyna(en.uid, h ? h.idx : 0);
    }
    if (C.bitti) break;
    if (C.secim) C.secimYap(C.secim.kartlar[0].uid);
    C.turBitir();
  }
  return { sonuc: C.bitti, tur };
}

/** 'patlama+' → yükseltilmiş kart. Dizi verilirse deste TAMAMEN değiştirilir. */
function desteKur(run, tanim) {
  run.deste = [];
  for (const t of tanim) {
    const up = t.endsWith('+');
    run.kartEkle(up ? t.slice(0, -1) : t, up);
  }
}

function baslangicRun(tohum, ekKartlar, yadigarlar) {
  const run = new G.Run(tohum || 'TANI', 0);
  if (ekKartlar && ekKartlar.tamDeste) desteKur(run, ekKartlar.tamDeste);
  else (ekKartlar || []).forEach(id => run.kartEkle(id));
  (yadigarlar || []).forEach(id => run.yadigarEkle(id, true));
  return run;
}

function olc(baslik, karsilasma, tur, deste, yadigarlar, n) {
  n = n || 300;
  let kayipToplam = 0, turToplam = 0, kayip = 0, hasarToplam = 0;
  for (let i = 0; i < n; i++) {
    const run = baslangicRun('OLC-' + baslik + '-' + i, deste, yadigarlar);
    run.hp = run.maxHp;
    const C = new G.Combat(run, { id: 'x', tur: tur || 'normal', dusmanlar: karsilasma },
                           run.rng.s('savas'));
    C.basla();
    const dusmanHp = C.dusmanlar.reduce((t, e) => t + e.maxHp, 0);
    const r = savasOyna(C, 40);
    if (r.sonuc !== 'zafer') kayip++;
    else { kayipToplam += run.maxHp - C.p.hp; turToplam += r.tur;
           hasarToplam += dusmanHp / r.tur; }
  }
  const kazanan = n - kayip;
  console.log(`  ${baslik.padEnd(34)} kayıp:%${(kayip / n * 100).toFixed(0).padStart(3)}` +
              `  ort.can-:${kazanan ? (kayipToplam / kazanan).toFixed(1).padStart(5) : '  —  '}` +
              `  tur:${kazanan ? (turToplam / kazanan).toFixed(1).padStart(4) : ' — '}` +
              `  dps:${kazanan ? (hasarToplam / kazanan).toFixed(1).padStart(5) : ' — '}`);
}

console.log('\n  BAŞLANGIÇ DESTESİ (10 kart) ile savaşlar\n');
console.log('  ' + '─'.repeat(76));
for (const k of G.KARSILASMALAR[1].zayif) olc('P1 zayıf: ' + k.dusmanlar.join('+'), k.dusmanlar, 'normal');
console.log('');
for (const k of G.KARSILASMALAR[1].normal) olc('P1 normal: ' + k.dusmanlar.join('+'), k.dusmanlar, 'normal');
console.log('');
for (const k of G.KARSILASMALAR[1].elit) olc('P1 elit: ' + k.dusmanlar.join('+'), k.dusmanlar, 'elit');
console.log('');

/* İyi oynanmış Akkor destesi: inceltilmiş, yükseltilmiş, odaklı.
   Amaç "bot ne yapıyor" değil, "yetkin bir oyuncu geçebilir mi" sorusu. */
const IYI14 = { tamDeste: [
  'vurus', 'vurus', 'vurus+', 'savun', 'savun', 'siper',
  'kivilcim', 'kivilcim', 'korla_vurus+', 'kor_zirhi', 'ufleme+', 'patlama+', 'ikiz_alev'
] };
const IYI29 = { tamDeste: [
  'vurus+', 'vurus+', 'savun', 'siper+', 'duvar',
  'kivilcim', 'kivilcim', 'korla_vurus+', 'korla_vurus', 'kor_zirhi+', 'ufleme+',
  'patlama+', 'patlama', 'atesle+', 'firin+', 'odaklan+', 'ani_hamle+', 'korun_nefesi+'
] };
const IYI44 = { tamDeste: [
  'vurus+', 'siper+', 'duvar+', 'kaya_gibi+',
  'kivilcim+', 'kivilcim+', 'korla_vurus+', 'kor_zirhi+', 'ufleme+', 'ufleme+',
  'patlama+', 'patlama+', 'atesle+', 'firin+', 'odaklan+', 'korun_nefesi+',
  'volkan+', 'ustalik+', 'cifte_vurus+', 'ocak_ustasi+', 'ani_hamle+'
] };

console.log('  PATRONLAR — iyi oynanmış, inceltilmiş deste ile\n');
console.log('  ' + '─'.repeat(76));
olc('P1 patron: KÜL DEVİ', ['kul_devi'], 'patron', IYI14,
    ['kor_tasi', 'kirik_migfer', 'koruk'], 250);
olc('P2 patron: SÖNMÜŞ KRAL', ['sonmus_kral'], 'patron', IYI29,
    ['kor_tasi', 'kirik_migfer', 'koruk', 'devin_kalbi', 'gece_feneri'], 250);
olc('P3 patron: İLK ALEV', ['ilk_alev'], 'patron', IYI44,
    ['kor_tasi', 'kirik_migfer', 'koruk', 'devin_kalbi', 'gece_feneri',
     'zaman_kumu', 'kirik_saat'], 250);
console.log('');
console.log('  PERDE 2 / 3 normal ve elit savaşlar (uygun deste ile)\n');
console.log('  ' + '─'.repeat(76));
for (const k of G.KARSILASMALAR[2].normal) olc('P2: ' + k.dusmanlar.join('+'), k.dusmanlar, 'normal', IYI29, ['kor_tasi'], 150);
console.log('');
for (const k of G.KARSILASMALAR[2].elit) olc('P2 elit: ' + k.dusmanlar.join('+'), k.dusmanlar, 'elit', IYI29, ['kor_tasi'], 150);
console.log('');
for (const k of G.KARSILASMALAR[3].normal) olc('P3: ' + k.dusmanlar.join('+'), k.dusmanlar, 'normal', IYI44, ['kor_tasi'], 150);
console.log('');
for (const k of G.KARSILASMALAR[3].elit) olc('P3 elit: ' + k.dusmanlar.join('+'), k.dusmanlar, 'elit', IYI44, ['kor_tasi'], 150);
console.log('');

const KAT14 = IYI14, KAT29 = IYI29, KAT44 = IYI44;

/* --- Oyuncunun tur başına hasar kapasitesi -------------------------- */
console.log('  OYUNCU ÇIKTISI (ilk 5 tur, hedef 9999 canlı kukla)\n');
console.log('  ' + '─'.repeat(76));
function ciktiOlc(ad, deste) {
  let toplam = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const run = baslangicRun('CIKTI-' + ad + '-' + i, deste);
    const C = new G.Combat(run, { id: 'x', tur: 'normal', dusmanlar: ['kul_devi'] },
                           run.rng.s('savas'));
    C.basla();
    C.dusmanlar[0].hp = C.dusmanlar[0].maxHp = 99999;
    C.dusmanlar[0].st = {};
    const bas = 99999;
    for (let t = 0; t < 5; t++) {
      let g = 0;
      while (g++ < 30) {
        if (C.secim) { C.secimYap(C.secim.kartlar[0].uid); continue; }
        let en = null, enP = 0.5;
        for (const k of C.el) { if (!C.oynanabilirMi(k)) continue;
                                const p = puan(C, k); if (p > enP) { enP = p; en = k; } }
        if (!en) break;
        C.kartOyna(en.uid, 0);
      }
      C.p.hp = C.p.maxHp;
      C.turBitir();
    }
    toplam += (bas - C.dusmanlar[0].hp) / 5;
  }
  console.log(`  ${ad.padEnd(34)} tur başına ort. hasar: ${(toplam / N).toFixed(1)}`);
}
ciktiOlc('Başlangıç destesi (10 kart)', []);
ciktiOlc('Kat 14 destesi (16 kart)', KAT14);
ciktiOlc('Kat 29 destesi (23 kart)', KAT29);
ciktiOlc('Kat 44 destesi (29 kart)', KAT44);
console.log('');
