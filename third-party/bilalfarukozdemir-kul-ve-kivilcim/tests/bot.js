/* =========================================================================
   OTOMATİK OYNATICI — denge ölçümü
   ---------------------------------------------------------------------
   Amaç mükemmel oynamak değil; tutarlı bir taban çizgisi oluşturup
   "hangi perde öldürüyor, hangi savaş kaç tur sürüyor, kartlar
   kullanılıyor mu" sorularına sayısal cevap vermek.
   Bot makul ama insan altı oynar → kazanma oranı ALT SINIR sayılmalı.
   ========================================================================= */
'use strict';

module.exports = function (G, N) {

  /* ---------------------------------------------------------------- */
  /*  Kart değerlendirme                                               */
  /* ---------------------------------------------------------------- */

  // Kapalı ifadelerden okunamayan kartlar için elle tahmin
  const HASAR_TAHMIN = {
    patlama:       (C, v) => C.akkor * v.k,
    volkan:        (C, v) => C.akkor * v.k * C.canliDusmanlar().length,
    supernova:     (C, v) => C.akkor * v.k * C.canliDusmanlar().length,
    atesle:        (C, v) => v.d + Math.floor(C.akkor / 3) * v.k,
    korla_vurus:   (C, v) => C.akkor >= v.e ? v.d2 : v.d,
    kalkan_vurusu: (C, v) => Math.floor(C.p.block * v.k / 100),
    korukleme:     (C, v) => enYuksekYanik(C) * v.k,
    yakip_yikma:   (C, v) => enYuksekYanik(C) * v.k,
    kavurucu_ruzgar: (C, v) => C.canliDusmanlar()
                                .reduce((t, e) => t + (e.st.yanik || 0) * v.k, 0),
    karsi_darbe:   (C, v) => v.d + (C.p.st.diken || 0) * v.k,
    kalpten_vurus: (C, v) => v.d + C.gucler.length * v.k,
    acimasizlik:   (C, v) => v.d + v.k,
    son_direnis:   (C, v) => C.enerji * v.k,
    hisim:         (C, v) => v.d,
    yagma:         (C, v) => v.d,
    tekrar:        () => 12
  };

  const BLOK_TAHMIN = {
    korun_nefesi:     (C, v) => C.akkor * v.k,
    kor_kalkani:      (C, v) => C.akkor + v.b,
    supernova:        (C, v) => C.akkor * v.b,
    yankili_kalkan:   (C, v) => Math.max(v.k * 10, C.p.block),
    koruma_cemberi:   (C, v) => C.enerji * v.k
  };

  function enYuksekYanik(C) {
    let m = 0;
    for (const e of C.canliDusmanlar()) m = Math.max(m, e.st.yanik || 0);
    return m;
  }

  function tahminHasar(C, kart) {
    const def = G.KARTLAR[kart.id];
    if (def.tur !== 'saldiri') return 0;
    const v = G.kartDegerleri(kart);
    let ham;
    if (HASAR_TAHMIN[kart.id]) ham = HASAR_TAHMIN[kart.id](C, v);
    else ham = (v.d || 0) * (v.n || 1);
    // Güç/Zayıflık kabaca
    const guc = (C.p.st.guc || 0) * (v.n || 1);
    let d = ham + guc;
    if (C.p.st.zayiflik) d *= 0.75;
    return Math.max(0, d);
  }

  function tahminBlok(C, kart) {
    const def = G.KARTLAR[kart.id];
    const v = G.kartDegerleri(kart);
    if (BLOK_TAHMIN[kart.id]) return BLOK_TAHMIN[kart.id](C, v);
    if (def.tur === 'saldiri' && !v.b) return 0;
    return v.b || 0;
  }

  // Akkor tek başına işe yaramaz; destede onu harcayan kart varsa değerlidir
  const AKKOR_ODEME = ['patlama', 'volkan', 'supernova', 'korun_nefesi', 'kozleme',
                       'korla_vurus', 'atesle', 'kor_kalkani', 'kor_zirhi'];
  function akkorDegeri(C) {
    if (C._akkorDeger === undefined) {
      const varMi = C.run.deste.some(k => AKKOR_ODEME.includes(k.id));
      C._akkorDeger = varMi ? 5.0 : 0.9;
    }
    return C._akkorDeger;
  }

  function gelenHasar(C) {
    let t = 0;
    for (const e of C.canliDusmanlar()) {
      const n = C.niyetGoster(e);
      if (n && n.hasar) t += n.hasar * (n.kez || 1);
    }
    return t;
  }

  function kartPuani(C, kart) {
    const def = G.KARTLAR[kart.id];
    const v = G.kartDegerleri(kart);
    const bedel = C.kartBedeli(kart);
    let p = 0;

    const gelen = gelenHasar(C);
    const acik = Math.max(0, gelen - C.p.block);

    const hasar = tahminHasar(C, kart);
    const blok = tahminBlok(C, kart);

    p += hasar * 2.3;
    p += Math.min(blok, acik) * 2.7 + Math.max(0, blok - acik) * 0.35;

    if (def.tur === 'guc') p += Math.max(20, 95 - C.tur * 10);
    p += (v.c || 0) * 9;                    // kart çekişi
    p += (v.a || 0) * akkorDegeri(C);       // akkor — ödeme kartı varsa değerli
    p += (v.g || 0) * 14;                   // güç
    if (def.yol === 'kul' && (v.n || 0) && def.tur === 'beceri') p += (v.n || 0) * 2.4;
    if (def.tuket) p -= 6;
    p -= (bedel === -1 ? C.enerji : bedel) * 3.5;

    // Ölümcül vuruşu her zaman al
    for (const e of C.canliDusmanlar()) {
      if (hasar >= e.hp + e.block) { p += 40; break; }
    }
    // Can kaybettiren kartlar canı azken riskli
    if (v.c !== undefined && def.tur === 'beceri' && (kart.id === 'alev_almak' ||
        kart.id === 'feda' || kart.id === 'hisim')) {
      if (C.p.hp < 25) p -= 60;
    }
    return p;
  }

  function zayifDusman(C) {
    const d = C.canliDusmanlar();
    if (!d.length) return null;
    let en = d[0];
    for (const e of d) if (e.hp + e.block < en.hp + en.block) en = e;
    return en;
  }

  /* ---------------------------------------------------------------- */
  /*  İksir kullanımı                                                  */
  /* ---------------------------------------------------------------- */

  const IYILESTIRICI = ['can_iksiri', 'anka_iksiri'];
  const SALDIRI_IKSIRI = ['ates_bombasi', 'kiyamet_iksiri'];

  function iksirDene(C) {
    const run = C.run;
    const canOran = C.p.hp / C.p.maxHp;
    for (let i = 0; i < run.iksirler.length; i++) {
      const s = run.iksirler[i];
      if (!s) continue;
      const patron = C.karsilasma.tur === 'patron' || C.karsilasma.tur === 'elit';
      if (IYILESTIRICI.includes(s.id) && canOran < 0.35) { C.iksirKullan(i, 0); return true; }
      if (SALDIRI_IKSIRI.includes(s.id) && patron && C.tur >= 2) {
        C.iksirKullan(i, zayifDusman(C) ? zayifDusman(C).idx : 0); return true;
      }
      // Yuvalar doluysa ve savaş zorsa gücü boşalt
      if (patron && C.tur >= 3 && !run.iksirYuvaBos() && s.id !== 'can_iksiri') {
        C.iksirKullan(i, zayifDusman(C) ? zayifDusman(C).idx : 0); return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /*  Savaş                                                            */
  /* ---------------------------------------------------------------- */

  function savasOyna(C, ist) {
    let tur = 0;
    while (!C.bitti && tur < 60) {
      tur++;
      iksirDene(C);
      let guard = 0;
      while (guard++ < 30 && !C.bitti) {
        if (C.secim) { C.secimYap(C.secim.kartlar[0].uid); continue; }
        let enIyi = null, enIyiP = 0.5;
        for (const k of C.el) {
          if (!C.oynanabilirMi(k)) continue;
          const p = kartPuani(C, k);
          if (p > enIyiP) { enIyiP = p; enIyi = k; }
        }
        if (!enIyi) break;
        const h = zayifDusman(C);
        C.kartOyna(enIyi.uid, h ? h.idx : 0);
      }
      if (C.bitti) break;
      if (C.secim) C.secimYap(C.secim.kartlar[0].uid);
      C.turBitir();
    }
    ist.turToplam += tur;
    ist.savasSayisi++;
    return C.bitti;
  }

  /* ---------------------------------------------------------------- */
  /*  Ödül seçimi                                                      */
  /* ---------------------------------------------------------------- */

  const NADIRLIK_DEGER = { siradan: 1, nadir: 2.2, efsanevi: 3.4 };

  function destedekiYol(run) {
    const say = {};
    for (const k of run.deste) {
      const y = G.KARTLAR[k.id].yol;
      say[y] = (say[y] || 0) + 1;
    }
    let en = 'genel', m = 0;
    for (const y in say) if (y !== 'genel' && say[y] > m) { m = say[y]; en = y; }
    return en;
  }

  function kartOdulSec(run, idler) {
    const yol = destedekiYol(run);
    let en = null, enP = -1;
    for (const id of idler) {
      const def = G.KARTLAR[id];
      let p = NADIRLIK_DEGER[def.nadirlik] || 1;
      if (def.yol === yol) p += 0.9;
      if (def.yol === 'genel') p += 0.35;
      const kopya = run.deste.filter(k => k.id === id).length;
      if (kopya >= 3) p -= 1.5;
      if (p > enP) { enP = p; en = id; }
    }
    // Deste şişkinse zayıf kartı alma
    if (run.deste.length > 32 && enP < 2) return null;
    return en;
  }

  function odulleriAl(run, oduller, ist) {
    for (const o of oduller) {
      if (o.tip === 'altin') run.altinEkle(o.miktar);
      else if (o.tip === 'iksir') run.iksirEkle(o.id);
      else if (o.tip === 'yadigar') run.yadigarEkle(o.id);
      else if (o.tip === 'yadigarSecim') run.yadigarEkle(o.idler[0]);
      else if (o.tip === 'kart') {
        const sec = kartOdulSec(run, o.kartlar);
        if (sec) { run.kartEkle(sec); ist.alinanKart[sec] = (ist.alinanKart[sec] || 0) + 1; }
      }
    }
    akisiBosalt(run);
  }

  function akisiBosalt(run) {
    let guard = 0;
    while (run.akis.length && guard++ < 20) {
      const a = run.akis.shift();
      if (a.tip === 'kartSec') {
        const aday = run.deste.filter(a.filtre);
        if (!aday.length) continue;
        // Yükseltme için en çok kopyası olan kartı seç; silme için Yara/lanet
        let hedef = aday[0];
        const kotu = aday.find(k => ['yara', 'kulce', 'is'].includes(k.id) ||
                                    G.KARTLAR[k.id].tur === 'lanet');
        if (a.baslik && a.baslik.indexOf('Yükselt') >= 0) {
          hedef = aday.find(k => k.id === 'vurus' || k.id === 'savun') || aday[0];
        } else if (kotu) hedef = kotu;
        a.cb(hedef);
      } else if (a.tip === 'kartOdul') {
        const sec = kartOdulSec(run, a.kartlar);
        if (sec) run.kartEkle(sec);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Oda davranışları                                                 */
  /* ---------------------------------------------------------------- */

  function dinlen(run) {
    const oran = run.hp / run.maxHp;
    // Patrondan hemen önceki dinlenmede insan gibi davran: neredeyse hep dinlen
    const patronOncesi = run.kat === 13;
    if (oran < (patronOncesi ? 0.92 : 0.62)) run.iyilestir(run.dinlenmeMiktari());
    else {
      const aday = run.deste.filter(G.yukseltilebilir);
      if (!aday.length) { run.iyilestir(run.dinlenmeMiktari()); return; }
      const n = run.dinlenmeYukseltmeSayisi();
      for (let i = 0; i < n && i < aday.length; i++) run.kartYukselt(aday[i]);
    }
  }

  function dukkanGez(run) {
    const d = run.dugum().icerik.dukkan;
    // Deste inceltme: önce lanet/durum, sonra başlangıç kartları.
    // Gerçek oyuncu davranışı bu; botun bunu atlaması ölçümü çarpıtıyordu.
    if (!d.silmeYapildi) {
      const kotu = run.deste.find(k => ['yara', 'kulce', 'is'].includes(k.id) ||
                                       G.KARTLAR[k.id].tur === 'lanet');
      let hedef = kotu;
      if (!hedef && run.deste.length > 12) {
        const iyiSaldiri = run.deste.filter(k => G.KARTLAR[k.id].tur === 'saldiri' &&
                                                 k.id !== 'vurus').length;
        if (iyiSaldiri >= 3) hedef = run.deste.find(k => k.id === 'vurus' && !k.up);
        if (!hedef) hedef = run.deste.find(k => k.id === 'savun' && !k.up);
      }
      if (hedef && run.kartSilmeSatinAl(hedef)) d.silmeYapildi = true;
    }
    for (const y of d.yadigarlar) {
      if (!y.satildi && run.altin >= y.fiyat) { run.altin -= y.fiyat; y.satildi = true; run.yadigarEkle(y.id); }
    }
    for (const k of d.kartlar) {
      if (k.satildi || run.altin < k.fiyat) continue;
      const def = G.KARTLAR[k.id];
      if (def.nadirlik === 'siradan' && run.altin < k.fiyat + 120) continue;
      run.altin -= k.fiyat; k.satildi = true; run.kartEkle(k.id);
    }
    for (const p of d.iksirler) {
      if (!p.satildi && run.altin >= p.fiyat && run.iksirYuvaBos()) {
        run.altin -= p.fiyat; p.satildi = true; run.iksirEkle(p.id);
      }
    }
  }

  function olayCoz(run, olayId) {
    const olay = G.OLAYLAR[olayId];
    const gecerli = [];
    for (let i = 0; i < olay.secenekler.length; i++) {
      const s = olay.secenekler[i];
      if (!s.kosul || s.kosul(run)) gecerli.push(i);
    }
    if (!gecerli.length) return;
    // Canı düşükken riskli seçeneklerden kaçın
    let idx = gecerli[run.rng.s('olay').int(gecerli.length)];
    if (run.hp / run.maxHp < 0.4) idx = gecerli[gecerli.length - 1];
    run.olayUygula(olayId, idx);
    akisiBosalt(run);
  }

  function dugumSec(run, acik) {
    const oran = run.hp / run.maxHp;
    const puan = (d) => {
      switch (d.tip) {
        case 'dinlenme': return oran < 0.55 ? 100 : 25;
        case 'elit':     return oran > 0.72 ? 70 : 5;
        case 'dukkan':   return run.altin > 260 ? 65 : 30;
        case 'hazine':   return 80;
        case 'olay':     return 45;
        default:         return 40;
      }
    };
    let en = acik[0], enP = -1;
    for (const d of acik) { const p = puan(d) + run.rng.s('harita').next() * 8;
                            if (p > enP) { enP = p; en = d; } }
    return en;
  }

  /* ---------------------------------------------------------------- */
  /*  Tek koşu                                                         */
  /* ---------------------------------------------------------------- */

  function kosuOyna(tohum, zorluk, ist) {
    const run = new G.Run(tohum, zorluk);
    let guard = 0;
    // Can defteri: perde başına nereden ne kadar can gitti/geldi
    const D = ist.defter;
    const yaz = (perde, alan, n) => {
      if (!D) return;
      D[perde] = D[perde] || {};
      D[perde][alan] = (D[perde][alan] || 0) + n;
    };
    let oncekiHp = run.hp;
    const fark = (perde, alan) => {
      const d = run.hp - oncekiHp;
      if (d < 0) yaz(perde, alan, -d);
      else if (d > 0) yaz(perde, alan + '+', d);
      oncekiHp = run.hp;
    };
    while (guard++ < 200) {
      let acik = run.kat < 0 ? run.harita.katlar[0] : run.acikDugumler();
      if (!acik.length) {
        if (run.perde >= 3) return { zafer: true, perde: run.perde, kat: run.kat, run };
        const p = run.perde;
        run.sonrakiPerde();
        fark(p, 'perdeGecisi');
        continue;
      }
      const d = dugumSec(run, acik);
      run.dugumeGir(d.kat, d.idx);

      if (d.tip === 'savas' || d.tip === 'elit' || d.tip === 'patron') {
        const k = d.icerik.karsilasma;
        const C = new G.Combat(run, k, run.rng.s('savas'));
        C.basla();
        const sonuc = savasOyna(C, ist);
        run.hp = C.p.hp;
        if (sonuc !== 'zafer') {
          const olduren = k.dusmanlar.join('+');
          ist.olumler[olduren] = (ist.olumler[olduren] || 0) + 1;
          return { zafer: false, perde: run.perde, kat: run.kat, run, olduren };
        }
        fark(run.perde, d.tip);
        run.ist.oldurulen += k.dusmanlar.length;
        odulleriAl(run, run.savasOdulu(k), ist);
        fark(run.perde, 'odul');
        ist.perdeSavas[run.perde] = (ist.perdeSavas[run.perde] || 0) + 1;
        ist.savasAdet[run.perde] = (ist.savasAdet[run.perde] || 0) + 1;
      } else if (d.tip === 'dinlenme') { dinlen(run); fark(run.perde, 'dinlenme'); }
      else if (d.tip === 'dukkan') dukkanGez(run);
      else if (d.tip === 'olay') { olayCoz(run, d.icerik.olay); fark(run.perde, 'olay'); }
      else if (d.tip === 'hazine') {
        const y = run.rastgeleYadigar();
        if (y) run.yadigarEkle(y);
        run.altinEkle(run.rng.s('yadigar').range(25, 60));
        akisiBosalt(run);
      }

      if (run.hp <= 0) return { zafer: false, perde: run.perde, kat: run.kat, run };
    }
    return { zafer: false, perde: run.perde, kat: run.kat, run, dongu: true };
  }

  /* ---------------------------------------------------------------- */
  /*  Koşum                                                            */
  /* ---------------------------------------------------------------- */

  console.log(`  Denge simülasyonu — zorluk başına ${N} koşu\n`);

  for (const zorluk of [0, 1, 2]) {
    const ist = { turToplam: 0, savasSayisi: 0, olumler: {}, alinanKart: {},
                  perdeSavas: {}, savasAdet: {}, defter: {} };
    let zafer = 0;
    const perdeOlum = { 1: 0, 2: 0, 3: 0 };
    let desteToplam = 0, yadigarToplam = 0, katToplam = 0;

    for (let i = 0; i < N; i++) {
      const r = kosuOyna('SIM-' + zorluk + '-' + i, zorluk, ist);
      if (r.zafer) zafer++;
      else perdeOlum[r.perde]++;
      desteToplam += r.run.deste.length;
      yadigarToplam += r.run.yadigarlar.length;
      katToplam += (r.perde - 1) * 15 + Math.max(0, r.kat);
    }

    const enOlumcul = Object.entries(ist.olumler)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${k} (${v})`).join(', ');

    console.log(`  ${G.ZORLUKLAR[zorluk].ad}`);
    console.log(`    Kazanma       : %${(zafer / N * 100).toFixed(1)}`);
    console.log(`    Ölüm/perde    : P1 %${(perdeOlum[1] / N * 100).toFixed(0)} · ` +
                `P2 %${(perdeOlum[2] / N * 100).toFixed(0)} · P3 %${(perdeOlum[3] / N * 100).toFixed(0)}`);
    console.log(`    Ort. ilerleme : ${(katToplam / N).toFixed(1)} / 45 kat`);
    console.log(`    Ort. savaş turu: ${(ist.turToplam / ist.savasSayisi).toFixed(1)}`);
    console.log(`    Ort. deste    : ${(desteToplam / N).toFixed(1)} kart · ` +
                `${(yadigarToplam / N).toFixed(1)} yadigâr`);
    console.log(`    En ölümcül    : ${enOlumcul}`);
    // Can defteri — koşu başına ortalama
    for (const p of [1, 2, 3]) {
      const d = ist.defter[p];
      if (!d) continue;
      const n = ist.savasAdet[p] || 1;
      const cikan = (d.savas || 0) + (d.elit || 0) + (d.patron || 0) + (d.olay || 0);
      const giren = (d['dinlenme+'] || 0) + (d['odul+'] || 0) + (d['olay+'] || 0) +
                    (d['perdeGecisi+'] || 0);
      console.log(`      P${p}: savaş -${((d.savas || 0) / N).toFixed(0)} · ` +
                  `elit -${((d.elit || 0) / N).toFixed(0)} · ` +
                  `patron -${((d.patron || 0) / N).toFixed(0)} · ` +
                  `olay -${((d.olay || 0) / N).toFixed(0)}  ||  ` +
                  `iyileşme +${(giren / N).toFixed(0)}  ` +
                  `(net ${((giren - cikan) / N).toFixed(0)}, savaş başına -${(((d.savas || 0)) / n).toFixed(1)})`);
    }
    console.log('');
  }

  // Hiç seçilmeyen kartlar — ölü içerik göstergesi
  const ist2 = { turToplam: 0, savasSayisi: 0, olumler: {}, alinanKart: {},
                 perdeSavas: {}, savasAdet: {}, defter: null };
  for (let i = 0; i < Math.min(N, 150); i++) kosuOyna('KAPSAM-' + i, 0, ist2);
  const hicAlinmayan = Object.keys(G.KARTLAR).filter(id => {
    const d = G.KARTLAR[id];
    return ['siradan', 'nadir', 'efsanevi'].includes(d.nadirlik) && !ist2.alinanKart[id];
  });
  console.log(`  Bot ${Math.min(N, 150)} koşuda hiç almadığı kart sayısı: ${hicAlinmayan.length}`);
  if (hicAlinmayan.length) console.log(`    ${hicAlinmayan.join(', ')}`);
  console.log('');
};
