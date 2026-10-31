/* =========================================================================
   SAVAŞ MOTORU
   ---------------------------------------------------------------------
   Tasarım ilkesi: motor tamamen SENKRON ve saf. Hiçbir DOM/zamanlayıcı
   bilmez. Yaptığı her şeyi `log` dizisine olay olarak yazar ve önemli
   anlarda görsel bir "anlık görüntü" (snap) bırakır.
   Arayüz bu günlüğü sonradan gecikmelerle oynatır.
   Bu ayrım sayesinde motor Node üzerinde deterministik test edilebilir.
   ========================================================================= */
(function (global) {
  'use strict';

  var TEMEL_ENERJI = 3;
  var EL_SINIRI = 10;

  /* ------------------------------------------------------------------ */
  /*  Varlık yardımcıları                                                */
  /* ------------------------------------------------------------------ */

  function st(e, k) { return e.st[k] || 0; }

  function yeniVarlik(kind, ad, hp, maxHp) {
    return { kind: kind, ad: ad, hp: hp, maxHp: maxHp, block: 0, st: {}, olu: false };
  }

  /* ------------------------------------------------------------------ */
  /*  Combat                                                             */
  /* ------------------------------------------------------------------ */

  function Combat(run, karsilasma, rng) {
    this.run = run;
    this.rng = rng;
    this.karsilasma = karsilasma;        // {id, ad, tur:'normal'|'elit'|'patron', dusmanlar:[...]}
    this.log = [];
    this.bitti = null;                   // 'zafer' | 'yenilgi'
    this.tur = 0;
    this.enerji = 0;
    this.maxEnerji = TEMEL_ENERJI;
    this.akkor = 0;
    this.turKart = 0;                    // bu tur oynanan kart sayısı
    this.turSaldiri = 0;                 // bu tur oynanan saldırı kartı sayısı
    this.toplamKart = 0;
    this.oynananSonKart = null;
    this.cekilenBuTur = 0;
    this.hasarAlindiBuTur = 0;
    this.kacisEngeli = false;
    this.gecikmeliIsler = [];            // tur sonunda çalışacak kapamalar
    this.sonOynananDef = null;           // "Tekrar" kartı için
    this.zincirCezasi = 0;               // Zincir laneti
    this.secim = null;                   // bekleyen oyuncu seçimi

    // Oyuncu
    var p = yeniVarlik('p', 'Kıvılcım Taşıyıcı', run.hp, run.maxHp);
    this.p = p;

    // Düşmanlar
    this.dusmanlar = [];
    for (var i = 0; i < karsilasma.dusmanlar.length; i++) {
      this.dusmanlar.push(this._dusmanYarat(karsilasma.dusmanlar[i], i));
    }

    // Desteler
    this.cekme = [];
    this.el = [];
    this.atik = [];
    this.tuketilen = [];
    this.gucler = [];                    // oynanan güç kartları (görsel)
  }

  Combat.prototype._dusmanYarat = function (tanimId, idx) {
    var def = global.DUSMANLAR[tanimId];
    if (!def) throw new Error('Bilinmeyen düşman: ' + tanimId);
    // Can, karşılaşma üretilirken (harita kurulurken) atılmıştır; burada
    // atılsaydı savaş akışına bağlı kalır ve aynı tohumda değişirdi.
    var hp;
    if (this.karsilasma.hpler && this.karsilasma.hpler[idx] !== undefined) {
      hp = this.karsilasma.hpler[idx];
    } else {
      hp = this.rng.range(def.hp[0], def.hp[1]);
      var z = global.ZORLUKLAR && global.ZORLUKLAR[this.run.zorluk || 0];
      if (z) hp = Math.round(hp * ((def.elit || def.patron) ? z.elitHp : z.dusmanHp));
    }
    var e = yeniVarlik('e', def.ad, hp, hp);
    e.id = tanimId;
    e.idx = idx;
    e.def = def;
    e.art = def.art || '👹';
    e.boy = def.boy || 1;
    e.gecmis = [];
    e.hamle = null;
    e.sira = 0;      // kaçıncı niyetini seçiyor (desen tabanlı düşmanlar için)
    e.sayac = {};
    if (def.kur) def.kur(this, e);
    return e;
  };

  /* ------------------------------------------------------------------ */
  /*  Görsel anlık görüntü                                               */
  /* ------------------------------------------------------------------ */

  Combat.prototype.gorsel = function () {
    var i;
    var d = [];
    for (i = 0; i < this.dusmanlar.length; i++) {
      var e = this.dusmanlar[i];
      d.push({
        idx: e.idx, id: e.id, ad: e.ad, art: e.art, boy: e.boy,
        hp: e.hp, maxHp: e.maxHp, block: e.block, olu: e.olu,
        st: global.U.clone(e.st),
        niyet: e.olu ? null : this.niyetGoster(e)
      });
    }
    var el = [];
    for (i = 0; i < this.el.length; i++) {
      var k = this.el[i];
      el.push({ uid: k.uid, id: k.id, up: k.up, bedel: this.kartBedeli(k),
                oynanabilir: this.oynanabilirMi(k) });
    }
    return {
      tur: this.tur, enerji: this.enerji, maxEnerji: this.maxEnerji, akkor: this.akkor,
      p: { hp: this.p.hp, maxHp: this.p.maxHp, block: this.p.block, st: global.U.clone(this.p.st) },
      dusmanlar: d, el: el,
      cekme: this.cekme.length, atik: this.atik.length, tuketilen: this.tuketilen.length,
      gucler: this.gucler.slice(),
      bitti: this.bitti
    };
  };

  Combat.prototype.snap = function () {
    this.log.push({ t: 'snap', s: this.gorsel() });
  };

  Combat.prototype.olay = function (o) { this.log.push(o); return o; };

  Combat.prototype.bekle = function (ms) { this.log.push({ t: 'bekle', ms: ms }); };

  Combat.prototype.yaziGoster = function (varlik, yazi, renk) {
    this.log.push({ t: 'yazi', hedef: this.ref(varlik), yazi: yazi, renk: renk || '#fff' });
  };

  Combat.prototype.ref = function (v) { return v === this.p ? 'p' : 'e' + v.idx; };

  /* ------------------------------------------------------------------ */
  /*  Yadigâr kancaları                                                  */
  /* ------------------------------------------------------------------ */

  Combat.prototype.trig = function (kanca, a, b, c) {
    var R = this.run.yadigarlar;
    for (var i = 0; i < R.length; i++) {
      var def = global.YADIGARLAR[R[i].id];
      if (def && def.h && def.h[kanca]) def.h[kanca](this, R[i], a, b, c);
    }
  };

  /** Sayısal değiştirici kancaları: her yadigâr değeri dönüştürebilir */
  Combat.prototype.mod = function (kanca, deger, a, b) {
    var R = this.run.yadigarlar;
    for (var i = 0; i < R.length; i++) {
      var def = global.YADIGARLAR[R[i].id];
      if (def && def.m && def.m[kanca]) deger = def.m[kanca](this, R[i], deger, a, b);
    }
    return deger;
  };

  Combat.prototype.yadigarVar = function (id) {
    for (var i = 0; i < this.run.yadigarlar.length; i++)
      if (this.run.yadigarlar[i].id === id) return this.run.yadigarlar[i];
    return null;
  };

  Combat.prototype.yadigarParla = function (id) { this.log.push({ t: 'yadigar', id: id }); };

  /* ------------------------------------------------------------------ */
  /*  Hasar / blok                                                       */
  /* ------------------------------------------------------------------ */

  /** Gösterim ve uygulama için tek kaynak: ham hasarı nihai hasara çevirir. */
  Combat.prototype.hasarHesap = function (kaynak, hedef, ham, opt) {
    opt = opt || {};
    var d = ham;
    if (opt.gucsuz !== true) d += st(kaynak, 'guc');
    if (kaynak === this.p) d = this.mod('hasarVer', d, hedef, opt);
    if (st(kaynak, 'zayiflik') > 0) d = Math.floor(d * 0.75);
    if (st(hedef, 'kirilganlik') > 0) d = Math.floor(d * 1.5);
    if (hedef === this.p) d = this.mod('hasarAl', d, kaynak, opt);
    return Math.max(0, Math.floor(d));
  };

  /** Saldırı: blok/zırh/diken zincirini işletir. */
  Combat.prototype.vur = function (kaynak, hedef, ham, opt) {
    opt = opt || {};
    if (hedef.olu || this.bitti) return 0;
    var kez = opt.kez || 1;
    var toplam = 0;
    for (var i = 0; i < kez; i++) {
      if (hedef.olu || this.bitti) break;
      var d = this.hasarHesap(kaynak, hedef, ham, opt);
      toplam += this.hasarUygula(hedef, d, { saldiri: true, kaynak: kaynak, vurus: i });
      if (kez > 1 && i < kez - 1) this.bekle(110);
    }
    return toplam;
  };

  Combat.prototype.hasarUygula = function (hedef, miktar, opt) {
    opt = opt || {};
    if (hedef.olu || miktar < 0) return 0;
    var engellenen = 0;
    if (!opt.bloksuz) {
      engellenen = Math.min(hedef.block, miktar);
      hedef.block -= engellenen;
      miktar -= engellenen;
    }
    var oncekiHp = hedef.hp;
    hedef.hp = Math.max(0, hedef.hp - miktar);
    var gercek = oncekiHp - hedef.hp;

    this.olay({
      t: 'hasar', hedef: this.ref(hedef), miktar: gercek, engellenen: engellenen,
      saldiri: !!opt.saldiri, hp: hedef.hp, maxHp: hedef.maxHp,
      sarsinti: Math.min(1, gercek / 22)
    });

    if (hedef === this.p) {
      this.hasarAlindiBuTur += gercek;
      if (gercek > 0) this.trig('hasarAlinca', gercek, opt.kaynak);
    }

    // Diken — saldırı bloklansa bile tetiklenir
    if (opt.saldiri && opt.kaynak && !opt.dikenden && st(hedef, 'diken') > 0) {
      this.hasarUygula(opt.kaynak, st(hedef, 'diken'),
                       { saldiri: false, kaynak: hedef, dikenden: true });
    }

    if (hedef.hp <= 0) this.oldur(hedef);
    return gercek;
  };

  Combat.prototype.oldur = function (v) {
    if (v.olu) return;
    if (v === this.p) {
      // Ölümden dönüş yadigârları
      var kurtarildi = { deger: false };
      this.trig('olumdenOnce', kurtarildi);
      if (kurtarildi.deger && this.p.hp > 0) return;
      this.p.olu = true;
      this.bitti = 'yenilgi';
      this.olay({ t: 'olum', hedef: 'p' });
      this.snap();
      return;
    }
    if (v.def.olurken) v.def.olurken(this, v);
    if (v.hp > 0 && !v.olu) return;     // olurken diriltmiş olabilir
    v.olu = true;
    v.block = 0;
    this.olay({ t: 'olum', hedef: this.ref(v) });
    if (this.run.gecici.kanBagi) {
      this.iyilestir(this.p, this.run.gecici.kanBagi);
      this.akkorEkle(1);
    }
    this.trig('dusmanOlunce', v);
    this.zaferKontrol();
  };

  Combat.prototype.zaferKontrol = function () {
    if (this.bitti) return;
    for (var i = 0; i < this.dusmanlar.length; i++) if (!this.dusmanlar[i].olu) return;
    this.bitti = 'zafer';
    this.olay({ t: 'zafer' });
    this.snap();
  };

  /** Kart kaynaklı blok — Çeviklik ve Kırık uygulanır. */
  Combat.prototype.blokVer = function (varlik, ham, opt) {
    opt = opt || {};
    if (varlik.olu) return 0;
    var b = ham;
    if (!opt.ham) {
      b += st(varlik, 'ceviklik');
      if (st(varlik, 'kirik') > 0) b = Math.floor(b * 0.75);
      if (varlik === this.p) b = this.mod('blokKazan', b);
    }
    b = Math.max(0, Math.floor(b));
    varlik.block += b;
    this.olay({ t: 'blok', hedef: this.ref(varlik), miktar: b, toplam: varlik.block });
    return b;
  };

  Combat.prototype.iyilestir = function (varlik, miktar) {
    if (varlik.olu) return 0;
    var onceki = varlik.hp;
    varlik.hp = Math.min(varlik.maxHp, varlik.hp + miktar);
    var d = varlik.hp - onceki;
    if (d > 0) this.olay({ t: 'iyilesme', hedef: this.ref(varlik), miktar: d, hp: varlik.hp });
    return d;
  };

  /* ------------------------------------------------------------------ */
  /*  Durum etkileri                                                     */
  /* ------------------------------------------------------------------ */

  Combat.prototype.durumVer = function (hedef, anahtar, miktar, opt) {
    opt = opt || {};
    if (hedef.olu || miktar === 0) return;
    var meta = global.STATUS[anahtar];
    // Tılsım olumsuz etkileri emer
    if (meta && meta.kotu && miktar > 0 && st(hedef, 'tilsim') > 0 && !opt.tilsimsiz) {
      hedef.st.tilsim -= 1;
      if (hedef.st.tilsim <= 0) delete hedef.st.tilsim;
      this.yaziGoster(hedef, 'TILSIM', '#a78bfa');
      this.olay({ t: 'durum', hedef: this.ref(hedef), anahtar: 'tilsim', miktar: 0,
                  toplam: st(hedef, 'tilsim') });
      return;
    }
    if (hedef.def && hedef.def.bagisik && hedef.def.bagisik.indexOf(anahtar) >= 0 && miktar > 0) {
      this.yaziGoster(hedef, 'BAĞIŞIK', '#94a3b8');
      return;
    }
    hedef.st[anahtar] = (hedef.st[anahtar] || 0) + miktar;
    if (hedef.st[anahtar] <= 0) delete hedef.st[anahtar];
    this.olay({ t: 'durum', hedef: this.ref(hedef), anahtar: anahtar, miktar: miktar,
                toplam: st(hedef, anahtar) });
  };

  /** Tur sonu durum işlemesi: yanık hasarı + süreli etkilerin azalması */
  Combat.prototype.turSonuDurumlar = function (v) {
    if (v.olu) return;
    var y = st(v, 'yanik');
    if (y > 0) {
      this.yaziGoster(v, '🔥 ' + y, '#fb923c');
      this.hasarUygula(v, y, { saldiri: false });
      var azalmaz = (v !== this.p) && this.run.gecici.yanikAzalmaz;
      if (!v.olu && !azalmaz) {
        v.st.yanik = y - 1;
        if (v.st.yanik <= 0) delete v.st.yanik;
      }
    }
    var z = st(v, 'zehirlenme');
    if (z > 0 && !v.olu) {
      this.yaziGoster(v, '☄️ ' + z, '#f87171');
      this.hasarUygula(v, z, { saldiri: false });
    }
    if (v.olu) return;
    for (var k in v.st) {
      var meta = global.STATUS[k];
      if (meta && meta.sure) {
        v.st[k] -= 1;
        if (v.st[k] <= 0) delete v.st[k];
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Akkor                                                              */
  /* ------------------------------------------------------------------ */

  Combat.prototype.akkorEkle = function (n) {
    if (n > 0 && st(this.p, 'zincir') > 0) {
      this.yaziGoster(this.p, 'ZİNCİR', '#94a3b8');
      return 0;
    }
    if (n > 0) {
      n += (this.run.gecici.akkorBonus || 0);
      n = this.mod('akkorKazan', n);
    }
    this.akkor = Math.max(0, this.akkor + n);
    this.olay({ t: 'akkor', miktar: n, toplam: this.akkor });
    if (n > 0) this.trig('akkorKazaninca', n);
    return n;
  };

  Combat.prototype.akkorHarca = function () {
    var a = this.akkor;
    if (a > 0) {
      // "Ebedi Ateş": harcama etkisi uygulanır ama Akkor tükenmez
      if (!this.run.gecici.akkorKalici) {
        this.akkor = 0;
        this.olay({ t: 'akkor', miktar: -a, toplam: 0, harcama: true });
      } else {
        this.olay({ t: 'akkor', miktar: 0, toplam: a, harcama: true, korundu: true });
      }
      this.trig('akkorHarcayinca', a);
    }
    return a;
  };

  /* ------------------------------------------------------------------ */
  /*  Deste işlemleri                                                    */
  /* ------------------------------------------------------------------ */

  Combat.prototype.karistir = function () {
    this.cekme = this.rng.shuffle(this.cekme);
    this.olay({ t: 'karistir' });
  };

  Combat.prototype.cek = function (n) {
    var cekilen = [];
    for (var i = 0; i < n; i++) {
      if (this.el.length >= EL_SINIRI) { this.olay({ t: 'elDolu' }); break; }
      if (this.cekme.length === 0) {
        if (this.atik.length === 0) break;
        this.cekme = this.rng.shuffle(this.atik);
        this.atik = [];
        this.olay({ t: 'karistir' });
      }
      var k = this.cekme.pop();
      this.el.push(k);
      cekilen.push(k);
      this.cekilenBuTur++;
      this.olay({ t: 'cek', uid: k.uid, id: k.id, up: k.up });
      this.trig('kartCekince', k);
    }
    return cekilen;
  };

  Combat.prototype.elIndeksi = function (uid) {
    for (var i = 0; i < this.el.length; i++) if (this.el[i].uid === uid) return i;
    return -1;
  };

  Combat.prototype.at = function (kart, kaynak) {
    var i = this.elIndeksi(kart.uid);
    if (i >= 0) this.el.splice(i, 1);
    this.atik.push(kart);
    this.olay({ t: 'at', uid: kart.uid, kaynak: kaynak || 'el' });
    var def = global.KARTLAR[kart.id];
    if (def && def.atilinca) def.atilinca(this, kart);
    this.trig('kartAtilinca', kart);
  };

  Combat.prototype.tuket = function (kart) {
    var i = this.elIndeksi(kart.uid);
    if (i >= 0) this.el.splice(i, 1);
    this.tuketilen.push(kart);
    this.olay({ t: 'tuket', uid: kart.uid });
    var def = global.KARTLAR[kart.id];
    if (def && def.tuketilince) def.tuketilince(this, kart);
    this.trig('kartTuketilince', kart);
  };

  /** Rastgele n kart at (elden). Belirli kart hariç tutulabilir. */
  Combat.prototype.rastgeleAt = function (n, haric) {
    for (var i = 0; i < n; i++) {
      var aday = [];
      for (var j = 0; j < this.el.length; j++)
        if (!haric || this.el[j].uid !== haric.uid) aday.push(this.el[j]);
      if (!aday.length) return;
      this.at(this.rng.pick(aday), 'rastgele');
    }
  };

  Combat.prototype.eleEkle = function (kartId, opt) {
    opt = opt || {};
    if (this.el.length >= EL_SINIRI) {
      var kk = global.yeniKart(kartId, opt.up);
      this.atik.push(kk);
      this.olay({ t: 'elDolu' });
      return kk;
    }
    var k = global.yeniKart(kartId, opt.up);
    if (opt.bedelSifir) k.gecici = { bedel: 0 };
    this.el.push(k);
    this.olay({ t: 'eklendi', uid: k.uid, id: k.id, up: k.up });
    return k;
  };

  Combat.prototype.cekmeyeEkle = function (kartId, opt) {
    opt = opt || {};
    var k = global.yeniKart(kartId, opt.up);
    if (opt.uste) this.cekme.push(k);
    else this.cekme.splice(this.rng.int(this.cekme.length + 1), 0, k);
    this.olay({ t: 'cekmeyeEklendi', id: kartId });
    return k;
  };

  Combat.prototype.atigaEkle = function (kartId, opt) {
    opt = opt || {};
    var k = global.yeniKart(kartId, opt.up);
    this.atik.push(k);
    this.olay({ t: 'atigaEklendi', id: kartId });
    return k;
  };

  /* ------------------------------------------------------------------ */
  /*  Kart bedeli / oynanabilirlik                                       */
  /* ------------------------------------------------------------------ */

  Combat.prototype.kartBedeli = function (kart) {
    if (kart.gecici && kart.gecici.bedel !== undefined) return kart.gecici.bedel;
    var def = global.KARTLAR[kart.id];
    var b = (kart.up && def.ustBedel !== undefined) ? def.ustBedel : def.bedel;
    if (b === -1) return -1;             // X bedeli
    b = this.mod('kartBedeli', b, kart, def);
    return Math.max(0, b);
  };

  Combat.prototype.oynanabilirMi = function (kart) {
    var def = global.KARTLAR[kart.id];
    if (!def) return false;
    if (def.oynanmaz) return false;
    var b = this.kartBedeli(kart);
    if (b === -1) return this.enerji >= 0;
    if (this.enerji < b) return false;
    if (def.kosul && !def.kosul(this, kart)) return false;
    // Hedef gereken kart, canlı düşman yoksa oynanamaz
    if (def.hedef === 'dusman' && !this.canliDusmanlar().length) return false;
    return true;
  };

  Combat.prototype.canliDusmanlar = function () {
    var o = [];
    for (var i = 0; i < this.dusmanlar.length; i++)
      if (!this.dusmanlar[i].olu) o.push(this.dusmanlar[i]);
    return o;
  };

  Combat.prototype.rastgeleDusman = function () {
    var c = this.canliDusmanlar();
    return c.length ? this.rng.pick(c) : null;
  };

  /* ------------------------------------------------------------------ */
  /*  Kart oynama                                                        */
  /* ------------------------------------------------------------------ */

  Combat.prototype.kartOyna = function (uid, hedefIdx) {
    if (this.bitti || this.secim) return false;
    var i = this.elIndeksi(uid);
    if (i < 0) return false;
    var kart = this.el[i];
    var def = global.KARTLAR[kart.id];
    if (!this.oynanabilirMi(kart)) return false;

    var bedel = this.kartBedeli(kart);
    var xDeger = 0;
    if (bedel === -1) { xDeger = this.enerji; this.enerji = 0; }
    else this.enerji -= bedel;

    var hedef = null;
    if (def.hedef === 'dusman') {
      hedef = this.dusmanlar[hedefIdx];
      if (!hedef || hedef.olu) hedef = this.rastgeleDusman();
      if (!hedef) return false;
    }

    // Elden çıkar (oyunda)
    this.el.splice(i, 1);
    this.olay({ t: 'oyna', uid: kart.uid, id: kart.id, up: kart.up,
                hedef: hedef ? this.ref(hedef) : null, tur: def.tur });

    this.turKart++;
    this.toplamKart++;
    this.oynananSonKart = kart;
    this.trig('kartOynanmadanOnce', kart, def, hedef);

    var tekrar = 1;
    if (def.tur === 'saldiri') {
      if (this.turSaldiri === 0 && st(this.p, 'yanki') > 0) tekrar += st(this.p, 'yanki');
      this.turSaldiri++;
      if (st(this.p, 'ofke') > 0) this.blokVer(this.p, st(this.p, 'ofke'));
    }
    tekrar = this.mod('kartTekrari', tekrar, kart, def);

    for (var r = 0; r < tekrar; r++) {
      if (this.bitti) break;
      if (def.hedef === 'dusman' && hedef.olu) {
        var yeni = this.rastgeleDusman();
        if (!yeni) break;
        hedef = yeni;
      }
      var v = global.kartDegerleri(kart);
      def.et(this, kart, hedef, { x: xDeger, tekrar: r, v: v });
      if (r < tekrar - 1) this.bekle(160);
    }

    // "Yanık İzi": hedefli saldırı kartları iz bırakır
    if (def.tur === 'saldiri' && hedef && !hedef.olu && this.run.gecici.yanikIzi) {
      this.durumVer(hedef, 'yanik', this.run.gecici.yanikIzi);
    }
    this.trig('kartOynayinca', kart, def, hedef);
    if (kart.id !== 'tekrar') this.sonOynananDef = { id: kart.id, up: kart.up };

    // Yerleştirme
    if (kart.yokEdildi) {
      // etki zaten yerine koydu
    } else if (def.tuket || (kart.gecici && kart.gecici.tuket)) {
      this.tuketilen.push(kart);
      this.olay({ t: 'tuket', uid: kart.uid });
      if (def.tuketilince) def.tuketilince(this, kart);
      this.trig('kartTuketilince', kart);
    } else if (def.tur === 'guc') {
      this.gucler.push({ id: kart.id, up: kart.up });
      this.olay({ t: 'gucOynandi', id: kart.id });
    } else {
      this.atik.push(kart);
      this.olay({ t: 'at', uid: kart.uid, kaynak: 'oynandi' });
    }

    kart.gecici = null;
    this.zaferKontrol();
    this.snap();
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  İksir                                                              */
  /* ------------------------------------------------------------------ */

  Combat.prototype.iksirKullan = function (slot, hedefIdx) {
    var iks = this.run.iksirler[slot];
    if (!iks) return false;
    var def = global.IKSIRLER[iks.id];
    if (!def) return false;
    var hedef = null;
    if (def.hedef === 'dusman') {
      hedef = this.dusmanlar[hedefIdx] || this.rastgeleDusman();
      if (!hedef) return false;
    }
    this.run.iksirler[slot] = null;
    this.olay({ t: 'iksir', id: iks.id });
    var guclu = !!this.yadigarVar('kadim_sise');
    def.et(this, hedef, guclu);
    this.zaferKontrol();
    this.snap();
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  Tur akışı                                                          */
  /* ------------------------------------------------------------------ */

  Combat.prototype.basla = function () {
    var i;
    // Savaşa özel geçici bayraklar (Güç kartları buraya yazar)
    this.run.gecici = {};
    // Deste kopyası
    this.cekme = [];
    for (i = 0; i < this.run.deste.length; i++) {
      var k = this.run.deste[i];
      this.cekme.push({ uid: global.U.uid(), id: k.id, up: k.up });
      if (k.id === 'lanet_zincir') this.zincirCezasi++;
    }
    this.karistir();

    this.trig('savasBasi');
    this.maxEnerji = TEMEL_ENERJI + this.mod('maxEnerji', 0);

    // Düşman kurulum güçleri
    for (i = 0; i < this.dusmanlar.length; i++) {
      var e = this.dusmanlar[i];
      if (e.def.savasBasi) e.def.savasBasi(this, e);
    }
    this.niyetSec();
    this.snap();
    this.turBasla();
    return this;
  };

  Combat.prototype.turBasla = function () {
    if (this.bitti) return;
    this.tur++;
    this.turKart = 0;
    this.turSaldiri = 0;
    this.cekilenBuTur = 0;
    this.hasarAlindiBuTur = 0;
    this.olay({ t: 'turBasi', tur: this.tur });

    if (st(this.p, 'metanet') === 0) {
      var koru = this.run.gecici.blokKoruYuzde || 0;
      this.p.block = koru > 0 ? Math.floor(this.p.block * koru / 100) : 0;
    }
    this.enerji = this.maxEnerji - (st(this.p, 'korku') > 0 ? 1 : 0);
    if (this.tur === 1) this.enerji -= this.zincirCezasi;
    if (this.enerji < 0) this.enerji = 0;

    if (st(this.p, 'zirh') > 0) this.blokVer(this.p, st(this.p, 'zirh'), { ham: true });
    if (st(this.p, 'korakor') > 0) this.akkorEkle(st(this.p, 'korakor'));

    this.trig('turBasi');

    var cekilecek = 5 + (this.run.gecici.ekCekis || 0) + this.mod('cekisSayisi', 0)
                      - (st(this.p, 'sersem') > 0 ? 1 : 0);
    this.cek(Math.max(0, cekilecek));
    this.snap();
  };

  Combat.prototype.turBitir = function () {
    if (this.bitti || this.secim) return;
    this.olay({ t: 'turSonu' });
    this.trig('turSonu');

    // Tura özel geçici etkileri geri al (ör. Bileme)
    var isler = this.gecikmeliIsler;
    this.gecikmeliIsler = [];
    for (var g = 0; g < isler.length; g++) isler[g](this);

    // Eldeki kartlar
    var kalanlar = this.el.slice();
    for (var i = 0; i < kalanlar.length; i++) {
      var k = kalanlar[i];
      var def = global.KARTLAR[k.id];
      if (def.eldeKalir || (k.gecici && k.gecici.elde)) {
        if (def.turSonuElde) def.turSonuElde(this, k);
        continue;
      }
      if (def.turSonuElde) def.turSonuElde(this, k);
      if (def.eldeYanar) { this.tuket(k); continue; }
      this.at(k, 'turSonu');
    }
    this.snap();

    this.turSonuDurumlar(this.p);
    if (this.bitti) return;
    this.snap();

    this.dusmanTuru();
    if (this.bitti) return;

    this.turBasla();
  };

  Combat.prototype.dusmanTuru = function () {
    var i;
    this.olay({ t: 'dusmanTuru' });
    var sira = this.dusmanlar.slice();
    for (i = 0; i < sira.length; i++) {
      var e = sira[i];
      if (e.olu || this.bitti) continue;
      e.block = 0;
      if (st(e, 'zirh') > 0) this.blokVer(e, st(e, 'zirh'), { ham: true });
      this.olay({ t: 'dusmanHamle', hedef: this.ref(e), hamle: e.hamle ? e.hamle.id : null });
      this.bekle(230);
      if (e.hamle && e.hamle.et) e.hamle.et(this, e);
      this.snap();
      this.bekle(180);
      if (this.bitti) return;
    }
    // Düşman tur sonu durumları
    for (i = 0; i < this.dusmanlar.length; i++) {
      if (!this.dusmanlar[i].olu) this.turSonuDurumlar(this.dusmanlar[i]);
    }
    this.zaferKontrol();
    if (this.bitti) return;
    this.niyetSec();
    this.snap();
  };

  Combat.prototype.niyetSec = function () {
    for (var i = 0; i < this.dusmanlar.length; i++) {
      var e = this.dusmanlar[i];
      if (e.olu) continue;
      if (e.hamle) e.gecmis.push(e.hamle.id);
      if (e.gecmis.length > 8) e.gecmis.shift();
      e.hamle = e.def.hamleSec(this, e);
      e.sira++;
    }
  };

  /** Niyeti oyuncuya göstermek için hesapla (mevcut buff/debuff'lar dahil) */
  Combat.prototype.niyetGoster = function (e) {
    if (!e.hamle || !e.hamle.niyet) return null;
    var n = typeof e.hamle.niyet === 'function' ? e.hamle.niyet(this, e) : e.hamle.niyet;
    var out = { tip: n.tip, kez: n.kez || 1, ipucu: n.ipucu || '' };
    if (n.hasar !== undefined) {
      out.hasar = this.hasarHesap(e, this.p, n.hasar, {});
    }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /*  Oyuncu seçimi (kart seçtiren etkiler)                              */
  /* ------------------------------------------------------------------ */

  /** Motor, seçim çözülene kadar başka eylem kabul etmez. */
  Combat.prototype.secimIste = function (opt) {
    this.secim = opt;
    this.olay({ t: 'secim', baslik: opt.baslik, kartlar: opt.kartlar,
                atlanabilir: !opt.zorunlu });
    this.snap();
  };

  Combat.prototype.secimYap = function (uid) {
    if (!this.secim) return false;
    var s = this.secim;
    this.secim = null;
    var secilen = null;
    for (var i = 0; i < s.kartlar.length; i++)
      if (s.kartlar[i].uid === uid) secilen = s.kartlar[i];
    if (s.coz) s.coz(this, secilen);
    this.olay({ t: 'secimBitti' });
    this.zaferKontrol();
    this.snap();
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  Kaçış / savaş sonu                                                 */
  /* ------------------------------------------------------------------ */

  Combat.prototype.bitirZafer = function () {
    this.bitti = 'zafer';
    this.olay({ t: 'zafer' });
    this.snap();
  };

  global.Combat = Combat;
  global.st = st;
})(typeof window !== 'undefined' ? window : globalThis);
