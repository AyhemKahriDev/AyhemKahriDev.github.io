/* =========================================================================
   OLAYLAR (? düğümleri)
   ---------------------------------------------------------------------
   Her seçeneğin `ol(run, api)` fonksiyonu sonucu uygular ve gösterilecek
   metni döndürür. `api` arayüz akışlarını kuyruğa alır:
     api.kartSec(baslik, filtre, cb)   — destedeki kartlardan seçtirir
     api.kartOdul(idler)               — kart ödülü ekranı açar
     api.yadigar(nadirlik|id)          — yadigâr verir
     api.iksir(n)                      — rastgele iksir verir
   ========================================================================= */
(function (global) {
  'use strict';

  var O = {};
  var LISTE = [];
  function E(id, o) { o.id = id; O[id] = o; LISTE.push(o); return o; }

  function yukseltilebilirFiltre(k) { return global.yukseltilebilir(k); }
  function silinebilirFiltre(k) { return true; }

  /* -------------------------------------------------------------------- */

  E('kul_sunagi', {
    ad: 'Kül Sunağı', art: '⛩️', perde: [1, 2, 3],
    metin: 'Yol kenarında, is içinde kalmış taş bir sunak. Üstünde hâlâ sıcak ' +
           'bir kor yatıyor — sanki biri az önce buradaymış gibi.',
    secenekler: [
      {
        yazi: 'Elini kora uzat',
        ipucu: '8 can kaybet · 2 kart yükselt',
        kosul: function (run) { return run.hp > 8; },
        ol: function (run, api) {
          run.canKaybet(8);
          api.kartSec('Yükseltilecek kartı seç (1/2)', yukseltilebilirFiltre, function (k) {
            run.kartYukselt(k);
            api.kartSec('Yükseltilecek kartı seç (2/2)', yukseltilebilirFiltre, function (k2) {
              run.kartYukselt(k2);
            });
          });
          return 'Kor avucunu dağlıyor ama bileğinden yukarı bir şey akıyor.';
        }
      },
      {
        yazi: 'Sunağa altın bırak',
        ipucu: '75 altın · rastgele yadigâr',
        kosul: function (run) { return run.altin >= 75; },
        ol: function (run, api) {
          run.altin -= 75;
          api.yadigar('nadir');
          return 'Altın kızarıp eriyor. Küllerin arasından bir şey yükseliyor.';
        }
      },
      { yazi: 'Saygıyla geç', ipucu: 'Hiçbir şey olmaz', ol: function () { return 'Sunağı arkanda bırakıyorsun.'; } }
    ]
  });

  E('sonmus_ocak', {
    ad: 'Sönmüş Ocak', art: '🏚️', perde: [1, 2],
    metin: 'Yıkık bir evin ortasında çoktan sönmüş bir ocak. Küllerin altında ' +
           'bir şeyin hâlâ parladığını görüyorsun.',
    secenekler: [
      {
        yazi: 'Külleri karıştır',
        ipucu: '10 can kaybet · efsanevi kart',
        kosul: function (run) { return run.hp > 10; },
        ol: function (run, api) {
          run.canKaybet(10);
          var havuz = global.kartHavuzu('efsanevi');
          api.kartOdul(run.rng.s('olay').sample(havuz, 3));
          return 'Elin yanıyor, ama bulduğun şeye değer.';
        }
      },
      {
        yazi: 'Külleri topla ve sat',
        ipucu: '+70 altın',
        ol: function (run) { run.altinEkle(70); return 'Kül de bir şeye yarıyormuş.'; }
      },
      { yazi: 'Ayrıl', ol: function () { return 'Yıkıntıyı geride bırakıyorsun.'; } }
    ]
  });

  E('terk_edilmis_kamp', {
    ad: 'Terk Edilmiş Kamp', art: '⛺', perde: [1, 2, 3],
    metin: 'Aceleyle bırakılmış bir kamp. Ateş daha yeni sönmüş, çadır hâlâ ayakta.',
    secenekler: [
      {
        yazi: 'Biraz dinlen',
        ipucu: 'Maks. canının %30\'u kadar iyileş',
        ol: function (run) {
          var n = Math.floor(run.maxHp * 0.3);
          run.iyilestir(n);
          return 'Kısa ama derin bir uyku. ' + n + ' can iyileştin.';
        }
      },
      {
        yazi: 'Eşyaları karıştır',
        ipucu: '2 rastgele iksir',
        ol: function (run, api) { api.iksir(2); return 'Çantanın dibinde iki şişe.'; }
      },
      {
        yazi: 'Çadırın altını kaz',
        ipucu: 'Riskli: 90 altın ya da 2 Yara',
        ol: function (run) {
          if (run.rng.s('olay').chance(50)) {
            run.altinEkle(90);
            return 'Toprağın altında bir kese. 90 altın!';
          }
          run.kartEkle('yara'); run.kartEkle('yara');
          return 'Kazdığın yerden kaynar kül fışkırıyor. Destene 2 Yara girdi.';
        }
      }
    ]
  });

  E('kul_kumarbazi', {
    ad: 'Kül Kumarbazı', art: '🎲', perde: [1, 2, 3],
    metin: '"Şansın kadar yaşarsın," diyor kapüşonlu adam ve iki kemik zar ' +
           'atıyor havaya. "Bir el?"',
    secenekler: [
      {
        yazi: 'Her şeyi yatır',
        ipucu: '%45 iki katı · %55 hepsi gider',
        kosul: function (run) { return run.altin >= 40; },
        ol: function (run) {
          var a = run.altin;
          if (run.rng.s('olay').chance(45)) {
            run.altinEkle(a);
            return 'Zarlar senden yana. ' + a + ' altın daha!';
          }
          run.altin = 0;
          return 'Zarlar sessizce duruyor. Kesen boşaldı.';
        }
      },
      {
        yazi: 'Küçük oyna',
        ipucu: '50 altın yatır · %60 ile +80',
        kosul: function (run) { return run.altin >= 50; },
        ol: function (run) {
          run.altin -= 50;
          if (run.rng.s('olay').chance(60)) { run.altinEkle(130); return 'Kazandın. +80 altın.'; }
          return 'Kaybettin. 50 altın gitti.';
        }
      },
      { yazi: 'Oynamam', ol: function () { return 'Adam omuz silkiyor.'; } }
    ]
  });

  E('yarali_savasci', {
    ad: 'Yaralı Savaşçı', art: '🩸', perde: [1, 2, 3],
    metin: 'Bir kayaya yaslanmış, göğsünden yaralı bir savaşçı. Seni görünce ' +
           'elini kılıcına götürüyor, sonra bırakıyor.',
    secenekler: [
      {
        yazi: 'Yarasını sar',
        ipucu: '12 can ver · nadir yadigâr',
        kosul: function (run) { return run.hp > 12; },
        ol: function (run, api) {
          run.canKaybet(12);
          api.yadigar('nadir');
          return '"Bunu al," diyor. "Bana artık lazım değil."';
        }
      },
      {
        yazi: 'Eşyalarını al',
        ipucu: '+140 altın · 1 lanet',
        ol: function (run) {
          run.altinEkle(140);
          run.kartEkle('lanet_supheli');
          return 'Kesesi ağır. Ama arkanda bıraktığın bakış daha ağır.';
        }
      },
      { yazi: 'Yoluna devam et', ol: function () { return 'Adımlarını hızlandırıyorsun.'; } }
    ]
  });

  E('ates_kuyusu', {
    ad: 'Ateş Kuyusu', art: '🕳️', perde: [1, 2, 3],
    metin: 'Dipsiz görünen bir kuyu. İçinden turuncu bir ışık ve sıcak bir ' +
           'hava akımı yükseliyor.',
    secenekler: [
      {
        yazi: 'Bir kartını kuyuya at',
        ipucu: '6 can kaybet · destenden 1 kart sil',
        kosul: function (run) { return run.hp > 6 && run.deste.length > 5; },
        ol: function (run, api) {
          run.canKaybet(6);
          api.kartSec('Kuyuya atılacak kartı seç', silinebilirFiltre, function (k) {
            run.kartSil(k);
          });
          return 'Kart aşağı düşerken alev alıyor.';
        }
      },
      {
        yazi: 'İçine uzan',
        ipucu: '3 kart arasından 1 seç',
        ol: function (run, api) {
          api.kartOdul(run.kartOdulleri(3));
          return 'Sıcaklık kolunu yalıyor ama elin bir şey buluyor.';
        }
      },
      { yazi: 'Kenardan geç', ol: function () { return 'Kuyuya bakmıyorsun bile.'; } }
    ]
  });

  E('ortulu_tuccar', {
    ad: 'Örtülü Tüccar', art: '🧿', perde: [1, 2, 3],
    metin: 'Yüzü tamamen örtülü bir figür, önüne serdiği bezin üstünde üç şey ' +
           'satıyor. Konuşmuyor, sadece işaret ediyor.',
    secenekler: [
      {
        yazi: 'Kartı işaret et',
        ipucu: '80 altın · 3 nadir kart arasından seç',
        kosul: function (run) { return run.altin >= 80; },
        ol: function (run, api) {
          run.altin -= 80;
          var havuz = global.kartHavuzu('nadir');
          api.kartOdul(run.rng.s('olay').sample(havuz, 3));
          return 'Bezin altından kartlar çıkıyor.';
        }
      },
      {
        yazi: 'Yadigârı işaret et',
        ipucu: '160 altın · nadir yadigâr',
        kosul: function (run) { return run.altin >= 160; },
        ol: function (run, api) { run.altin -= 160; api.yadigar('nadir'); return 'Ağır bir şey avucuna bırakılıyor.'; }
      },
      {
        yazi: 'Şişeleri işaret et',
        ipucu: '55 altın · 2 iksir',
        kosul: function (run) { return run.altin >= 55; },
        ol: function (run, api) { run.altin -= 55; api.iksir(2); return 'İki şişe.'; }
      },
      { yazi: 'Bir şey alma', ol: function () { return 'Figür bezini topluyor.'; } }
    ]
  });

  E('kul_fisiltilari', {
    ad: 'Kül Fısıltıları', art: '🌬️', perde: [1, 2, 3],
    metin: 'Rüzgâr kül taşıyor ve külün içinden fısıltılar geliyor. Adını ' +
           'söylüyorlar. Dinlersen bir şey öğreneceksin — ama bir şey de bırakacaksın.',
    secenekler: [
      {
        yazi: 'Dinle',
        ipucu: '+180 altın · 1 lanet',
        ol: function (run) {
          run.altinEkle(180);
          run.kartEkle('lanet_kor_yuku');
          return 'Fısıltılar sana bir hazinenin yerini söylüyor. Ve içine yerleşiyorlar.';
        }
      },
      {
        yazi: 'Kulaklarını tıka',
        ipucu: 'Güvenli',
        ol: function () { return 'Sesler sönüyor.'; }
      }
    ]
  });

  E('kor_havuzu', {
    ad: 'Kor Havuzu', art: '🌊', perde: [2, 3],
    metin: 'Yerin altından yükselen, akkor hâlinde bir sıvı gölü. Yüzeyinde ' +
           'yansıman yok — onun yerine başka bir şey var.',
    secenekler: [
      {
        yazi: 'İçine dal',
        ipucu: 'Canının yarısını kaybet · efsanevi yadigâr',
        kosul: function (run) { return run.hp > 12; },
        ol: function (run, api) {
          run.canKaybet(Math.floor(run.hp / 2));
          api.yadigar('efsanevi');
          return 'Her yerin yanıyor. Ama çıktığında elinde bir şey var.';
        }
      },
      {
        yazi: 'Elini daldır',
        ipucu: '6 can kaybet · Kor Taşı',
        kosul: function (run) { return run.hp > 6; },
        ol: function (run, api) { run.canKaybet(6); api.yadigar('kor_tasi'); return 'Parmaklarının arasında bir taş kalıyor.'; }
      },
      { yazi: 'Kıyıdan izle', ol: function () { return 'Yansımanı görmemeyi tercih ediyorsun.'; } }
    ]
  });

  E('eski_dost', {
    ad: 'Eski Dost', art: '🤝', perde: [1, 2, 3],
    metin: 'Yolun ortasında tanıdık bir yüz. Adını hatırlamıyorsun ama o seni ' +
           'hatırlıyor. "Bir şeyini taşıyabilirim," diyor, "ya da bir şeyini alabilirim."',
    secenekler: [
      {
        yazi: 'Bir kartımı çoğalt',
        ipucu: 'Destendeki bir kartın kopyası',
        ol: function (run, api) {
          api.kartSec('Çoğaltılacak kartı seç', silinebilirFiltre, function (k) {
            run.kartEkle(k.id, k.up);
          });
          return 'Elini kartına koyuyor ve ikinci bir tane beliriyor.';
        }
      },
      {
        yazi: 'Bir kartımı unut',
        ipucu: 'Destenden 1 kart sil',
        kosul: function (run) { return run.deste.length > 5; },
        ol: function (run, api) {
          api.kartSec('Unutulacak kartı seç', silinebilirFiltre, function (k) { run.kartSil(k); });
          return 'Aklından bir şey siliniyor. Hafifledin.';
        }
      },
      { yazi: 'Vedalaş', ol: function () { return 'Sarılıp ayrılıyorsunuz.'; } }
    ]
  });

  E('sonmez_mesale', {
    ad: 'Sönmez Meşale', art: '🕯️', perde: [1, 2, 3],
    metin: 'Duvara sabitlenmiş bir meşale. Yüzyıllardır yanıyor olmalı, ama ' +
           'ne yakıtı azalmış ne de duvar isli.',
    secenekler: [
      {
        yazi: 'Işığı içine çek',
        ipucu: 'Maksimum can +14',
        ol: function (run) { run.maxHp += 14; run.iyilestir(14); return 'İçinde bir şey büyüyor. Maksimum canın 14 arttı.'; }
      },
      {
        yazi: 'Alevi bir kartına aktar',
        ipucu: '1 kart yükselt',
        ol: function (run, api) {
          api.kartSec('Yükseltilecek kartı seç', yukseltilebilirFiltre, function (k) { run.kartYukselt(k); });
          return 'Kart senin elinde ısınıyor.';
        }
      },
      {
        yazi: 'Meşaleyi söndür ve sat',
        ipucu: '+110 altın',
        ol: function (run) { run.altinEkle(110); return 'Koridor karanlıkta kaldı. Kesen doldu.'; }
      }
    ]
  });

  E('kulce_madencisi', {
    ad: 'Külçe Madencisi', art: '⛏️', perde: [1, 2, 3],
    metin: 'Sırtında taşıyamayacağı kadar cüruf külçesi olan bir madenci. ' +
           '"Yarısını taşırsan yarısını satarım, parayı bölüşürüz."',
    secenekler: [
      {
        yazi: 'Yardım et',
        ipucu: '+230 altın · destene 2 Külçe',
        ol: function (run) {
          run.altinEkle(230);
          run.kartEkle('kulce'); run.kartEkle('kulce');
          return 'Sırtın çöküyor ama kesen doluyor.';
        }
      },
      { yazi: 'Reddet', ol: function () { return '"Anlarım," diyor ve devam ediyor.'; } }
    ]
  });

  E('kader_carki', {
    ad: 'Kader Çarkı', art: '🎡', perde: [1, 2, 3],
    metin: 'Paslı, insan boyunda bir çark. Üstünde altı işaret var, hiçbirini ' +
           'okuyamıyorsun.',
    secenekler: [
      {
        yazi: 'Çevir',
        ipucu: 'Tamamen rastgele',
        ol: function (run, api) {
          var r = run.rng.s('olay').int(6);
          if (r === 0) { api.yadigar('nadir'); return 'Çark durdu: bir yadigâr.'; }
          if (r === 1) { run.altinEkle(170); return 'Çark durdu: 170 altın döküldü.'; }
          if (r === 2) { run.maxHp += 10; run.iyilestir(10); return 'Çark durdu: maksimum can +10.'; }
          if (r === 3) { api.kartOdul(run.kartOdulleri(3)); return 'Çark durdu: bir kart.'; }
          if (r === 4) {
            var z = Math.floor(run.maxHp * 0.2);
            run.canKaybet(z);
            return 'Çark durdu: ' + z + ' can kaybettin.';
          }
          run.kartEkle('lanet_pismanlik');
          return 'Çark durdu: destene Pişmanlık girdi.';
        }
      },
      { yazi: 'Dokunma', ol: function () { return 'Çark yavaşça durmaya devam ediyor.'; } }
    ]
  });

  E('bos_sunak', {
    ad: 'Boş Sunak', art: '🗿', perde: [2, 3],
    metin: 'Üstünde tek bir oyuk olan siyah taş. Oyuk tam olarak taşıdığın ' +
           'yadigârlardan birinin biçiminde.',
    secenekler: [
      {
        yazi: 'Bir yadigâr feda et',
        ipucu: 'Rastgele bir yadigârını kaybet · efsanevi yadigâr al',
        kosul: function (run) { return run.yadigarlar.length >= 2; },
        ol: function (run, api) {
          var idx = 1 + run.rng.s('olay').int(run.yadigarlar.length - 1); // başlangıç yadigârı korunur
          var kaybedilen = run.yadigarlar.splice(idx, 1)[0];
          api.yadigar('efsanevi');
          return (global.YADIGARLAR[kaybedilen.id].ad) + ' taşa gömüldü. Yerine başka bir şey geldi.';
        }
      },
      { yazi: 'Oyuğu boş bırak', ol: function () { return 'Taş sessiz kalıyor.'; } }
    ]
  });

  E('ruh_atesi', {
    ad: 'Ruh Ateşi', art: '👁️', perde: [2, 3],
    metin: 'Havada asılı, göz biçiminde bir alev. Sana bakıyor ve sen ona ' +
           'baktıkça göğsünde bir sıcaklık büyüyor.',
    secenekler: [
      {
        yazi: 'Bakışına karşılık ver',
        ipucu: '16 can kaybet · Körük yadigârı',
        kosul: function (run) { return run.hp > 16; },
        ol: function (run, api) { run.canKaybet(16); api.yadigar('koruk'); return 'Göz kırpıyor ve sönüyor. Elinde bir körük var.'; }
      },
      {
        yazi: 'Külü incele',
        ipucu: '1 kart yükselt',
        ol: function (run, api) {
          api.kartSec('Yükseltilecek kartı seç', yukseltilebilirFiltre, function (k) { run.kartYukselt(k); });
          return 'Külde bir desen görüyorsun.';
        }
      },
      { yazi: 'Gözünü kaçır', ol: function () { return 'Alev arkandan bakmaya devam ediyor.'; } }
    ]
  });

  E('zaman_yarigi', {
    ad: 'Zaman Yarığı', art: '⏳', perde: [2, 3],
    metin: 'Havada, bıçakla kesilmiş gibi duran bir yarık. İçinden kendi ' +
           'sesin geliyor — ama söylediğin şeyi henüz söylemedin.',
    secenekler: [
      {
        yazi: 'İçinden geç',
        ipucu: '3 nadir kart arasından 1 seç',
        ol: function (run, api) {
          var havuz = global.kartHavuzu('nadir');
          api.kartOdul(run.rng.s('olay').sample(havuz, 3));
          return 'Bir an için iki yerdesin.';
        }
      },
      {
        yazi: 'Geçmişi izle',
        ipucu: '+18 can · +80 altın',
        ol: function (run) { run.iyilestir(18); run.altinEkle(80); return 'İzlerken dinleniyorsun.'; }
      }
    ]
  });

  /* -------------------------------------------------------------------- */

  global.OLAYLAR = O;
  global.OLAY_LISTESI = LISTE;

  global.olayHavuzu = function (perde) {
    var o = [];
    for (var i = 0; i < LISTE.length; i++)
      if (LISTE[i].perde.indexOf(perde) >= 0) o.push(LISTE[i].id);
    return o;
  };
})(typeof window !== 'undefined' ? window : globalThis);
