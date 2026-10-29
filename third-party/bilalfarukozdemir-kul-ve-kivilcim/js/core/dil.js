/* =========================================================================
   DİL
   ---------------------------------------------------------------------
   Anahtar olarak Türkçe metnin kendisi kullanılıyor: T('Turu Bitir').
   Böylece kaynak kod okunur kalıyor ve karşılığı olmayan bir metin
   sessizce Türkçe görünüyor (bozuk anahtar yerine anlamlı yedek).

   Oyun verisi (kart, düşman, yadigâr…) ayrı bir dosyada, kimliğe göre:
   js/data/dil-en.js  →  DIL.v('kart', 'patlama', 'metin', varsayilan)

   Yeni bir dil eklemek: aşağıdaki ARAYUZ'a bir anahtar seti, dil-en.js
   biçiminde bir veri dosyası, ve DILLER listesine bir satır.
   ========================================================================= */
(function (global) {
  'use strict';

  var mevcut = 'tr';

  var DILLER = [
    { kod: 'tr', ad: 'Türkçe',  bayrak: 'TR' },
    { kod: 'en', ad: 'English', bayrak: 'EN' }
  ];

  /* ------------------------------------------------------------------ */
  /*  Arayüz metinleri                                                   */
  /* ------------------------------------------------------------------ */

  var ARAYUZ = {
    en: {
      /* --- menü --- */
      'Kül ve': 'Ash and', 'Kıvılcım': 'Ember',
      'Sönmüş bir dünyada, elinde kalan tek şey bir avuç kor.':
        'In a world gone out, all you have left is a handful of embers.',
      'Yeni Koşu': 'New Run',
      'Koşuya Devam Et': 'Continue Run',
      'Yeni koşu?': 'New run?',
      'Devam eden koşun silinecek. Emin misin?': 'Your run in progress will be deleted. Are you sure?',
      'Yeni koşu başlat': 'Start new run',
      'Tohum': 'Seed',
      'Yeni tohum': 'New seed',
      'Nasıl oynanır?': 'How to play',
      'Nasıl oynanır': 'How to play',
      'Ayarlar': 'Settings',
      'Koşu': 'Runs', 'Zafer': 'Wins', 'En uzak': 'Furthest',
      'Perde': 'Act', 'Kat': 'Floor',

      /* --- zorluk --- */
      'Gezgin': 'Wanderer', 'Kül Yemin': 'Ash Oath', 'Kâbus': 'Nightmare',
      'Dengeli deneyim': 'Balanced experience',
      'Düşmanlar daha dayanıklı': 'Enemies are tougher',
      'Acımasız': 'Merciless',

      /* --- savaş --- */
      'Turu Bitir': 'End Turn',
      'Çekme': 'Draw', 'Atık': 'Discard', 'Tüketilen': 'Exhaust',
      'AKKOR': 'EMBER', 'Akkor': 'Ember',
      'Çekme Destesi': 'Draw Pile', 'Atık Destesi': 'Discard Pile',
      'Tüketilenler': 'Exhaust Pile',
      'Sıra gizli — kartlar alfabetik listelendi':
        'Order hidden — cards listed alphabetically',
      'Burada hiç kart yok.': 'There are no cards here.',
      'Tur': 'Turn', 'Düşman Sırası': 'Enemy Turn',
      'ELİT SAVAŞ': 'ELITE BATTLE',
      'EL DOLU': 'HAND FULL',
      'Yeterli enerji yok': 'Not enough energy',
      'Destenden bir kart al': 'Take a card from your draw pile',
      'Hiçbiri': 'None',
      'İksir yuvan dolu': 'Potion slots full',
      'Altının yetmiyor': 'Not enough gold',

      /* --- niyet --- */
      'Saldıracak': 'Will attack', 'Ağır saldırı!': 'Heavy attack!',
      'Saldırıp korunacak': 'Attacks and defends',
      'Saldırıp zayıflatacak': 'Attacks and weakens',
      'Korunacak': 'Will defend', 'Güçlenecek': 'Will grow stronger',
      'Seni zayıflatacak': 'Will weaken you',
      'Ne yapacağı belli değil': 'Unclear what it will do',
      'Hamle': 'Move',
      'hasar': 'damage', 'toplam': 'total',

      /* --- harita --- */
      'Savaş': 'Battle', 'Elit': 'Elite', 'Bilinmez': 'Unknown',
      'Dükkan': 'Shop', 'Kamp': 'Camp', 'Hazine': 'Treasure', 'Patron': 'Boss',
      'Kül Ovaları': 'The Ash Plains', 'Sönmüş Şehir': 'The Extinguished City',
      'Ateşin Kalbi': 'The Heart of Fire',
      'Sıradan bir düşman grubu. Altın ve bir kart ödülü.':
        'An ordinary group of enemies. Gold and a card reward.',
      'Tehlikeli. Karşılığında bir yadigâr.': 'Dangerous. Rewards a relic.',
      'Ne çıkacağı belli değil — seçim yapacaksın.':
        'No telling what awaits — you will have to choose.',
      'Kart, iksir, yadigâr satın al. Kart sildirebilirsin.':
        'Buy cards, potions and relics. You can also remove a card.',
      'Dinlen (can) ya da bir kartını yükselt.':
        'Rest to heal, or upgrade one of your cards.',
      'Bedava yadigâr ve altın.': 'A free relic and gold.',
      'Perdenin sonu. Hazır olmadan gitme.':
        'The end of the act. Do not go unprepared.',

      /* --- ödül / dükkan / kamp --- */
      'Ödülleri al': 'Claim your rewards',
      'Devam': 'Continue', 'Kalanları bırak ve devam et': 'Leave the rest and continue',
      'altın': 'gold', 'Kart ödülü': 'Card reward',
      '3 kart arasından seç': 'Choose one of three cards',
      'Bir kart seç': 'Choose a card',
      'Hiçbirini alma': 'Take none',
      'Patron yadigârı': 'Boss relic',
      'Üçünden birini seç': 'Choose one of three',
      'Patron yadigârı — birini seç': 'Boss relic — choose one',
      'Yadigâr': 'Relic', 'Al': 'Take',
      'Sandığı aç': 'Open the chest',
      'Küllerin altında, kilidi çoktan erimiş bir sandık.':
        'Beneath the ash, a chest whose lock melted long ago.',
      'Kamp Ateşi': 'Campfire',
      'Ateşin başında bir mola. Ne yaparsan yap, sabah olduğunda yolun geri kalanı seni bekliyor olacak.':
        'A pause by the fire. Whatever you do, the rest of the road will be waiting come morning.',
      'Dinlen': 'Rest',
      '{n} can iyileş': 'Heal {n} HP',
      '{n} kart yükselt': 'Upgrade {n} card(s)',
      'canın zaten dolu': 'you are already at full health',
      'Demirci': 'Smith',
      'yükseltilecek kart yok': 'no card can be upgraded',
      'Yükseltilecek kartı seç': 'Choose a card to upgrade',
      'Kartlar': 'Cards', 'İksirler': 'Potions', 'Yadigârlar': 'Relics',
      'Hizmet': 'Service', 'Kesende': 'In your purse',
      'Kart yaktır': 'Burn a card',
      'Destenden bir kartı kalıcı olarak çıkar': 'Permanently remove a card from your deck',
      'Bu dükkanda kullanıldı': 'Already used in this shop',
      'Yakılacak kartı seç': 'Choose a card to burn',
      'Ayrıl': 'Leave',
      'Yuvaların dolu.': 'Your slots are full.',
      'için birini bırakabilirsin.': '— you can drop one to make room.',
      'Yeni iksiri bırak': 'Discard the new potion',
      'İksiri at?': 'Discard potion?',
      'atılacak. Emin misin?': 'will be discarded. Are you sure?',
      'At': 'Discard',
      'İksirler savaş ödüllerinden, dükkandan ve olaylardan gelir.':
        'Potions come from battle rewards, shops and events.',
      'Savaşta tıklayarak bedelsiz kullanılır; enerji ya da sıra harcamaz.':
        'Click to use in battle — free, costs no energy and no turn.',
      'Boş iksir yuvası': 'Empty potion slot',
      'Kullanmak için tıkla — bedelsiz, sıra harcamaz':
        'Click to use — free, costs no turn',
      'Yalnızca savaşta kullanılır': 'Only usable in battle',
      'İksir': 'Potion',

      /* --- deste / oyun sonu --- */
      'Desten': 'Your Deck', 'kart': 'cards',
      'Desteyi gör': 'View deck', 'Menü': 'Menu',
      'Kapat': 'Close', 'Vazgeç': 'Cancel', 'Tamam': 'OK', 'Evet': 'Yes',
      'Anladım': 'Got it',
      'İLK ALEV SÖNDÜ': 'THE FIRST FLAME IS OUT',
      'KÜLE DÖNDÜN': 'YOU RETURNED TO ASH',
      'Kule sessiz. Elindeki kor hâlâ sıcak — ve artık sadece senin.':
        'The tower is silent. The ember in your hand is still warm — and now it is yours alone.',
      'seni durdurdu.': 'stopped you.',
      'Yolculuğun burada bitti.': 'Your journey ends here.',
      'Ulaşılan kat': 'Floor reached', 'Toplam altın': 'Total gold',
      'Son desten': 'Your final deck',
      'Toplam koşu': 'Total runs',
      'Ana menü': 'Main menu',
      'Koşuyu bırak': 'Abandon run',
      'Koşuyu bırak?': 'Abandon run?',
      'Bu koşu sona erecek ve kaydın silinecek.':
        'This run will end and your save will be deleted.',
      'Bırak': 'Abandon',
      'Koşun her odada otomatik kaydediliyor.':
        'Your run is saved automatically in every room.',

      /* --- perde sonu --- */
      'bitti': 'complete',
      'Ovaların külü ardında kaldı. İleride bir şehrin iskeleti yükseliyor.':
        'The ash of the plains is behind you. Ahead, the skeleton of a city rises.',
      'Şehir sustu. Sıcaklık artıyor — kaynağa yaklaşıyorsun.':
        'The city has fallen silent. The heat is rising — you are nearing the source.',
      'Yaraların bir kısmı sarıldı.': 'Some of your wounds have been bound.',
      'Devam et': 'Continue',

      /* --- ayarlar --- */
      'Ses efektleri': 'Sound effects', 'Müzik': 'Music',
      'Müzik seviyesi': 'Music volume',
      'Animasyon hızı': 'Animation speed', 'Ekran sarsıntısı': 'Screen shake',
      'Dil': 'Language',
      'Açık': 'On', 'Kapalı': 'Off',
      'Normal': 'Normal', 'Hızlı': 'Fast', 'Çok hızlı': 'Very fast',
      'Kısık': 'Low', 'Orta': 'Medium', 'Yüksek': 'High',

      /* --- kart türleri / nadirlik --- */
      'Saldırı': 'Attack', 'Beceri': 'Skill', 'Güç': 'Power',
      'Durum': 'Status', 'Lanet': 'Curse',
      'Başlangıç': 'Starter', 'Sıradan': 'Common', 'Nadir': 'Uncommon',
      'Efsanevi': 'Rare', 'Patron yadigârı': 'Boss relic', 'Özel': 'Special',

      /* --- kart üstü ipuçları --- */
      'Güç kartı: savaş boyunca etkisini sürdürür.':
        'Power: its effect lasts for the rest of the battle.',
      'Tüketilir: bu savaşta bir daha gelmez.':
        'Exhaust: it will not return this battle.',
      'Elde kalır: tur sonunda atılmaz.':
        'Retain: it is not discarded at end of turn.',

      /* --- savaş içi uyarılar --- */
      'TILSIM': 'ARTIFACT', 'BAĞIŞIK': 'IMMUNE', 'ZİNCİR': 'CHAINED',
      'ŞARJ': 'CHARGING', 'ÖFKE!': 'ENRAGED!', 'ÇILDIRDI': 'BERSERK',
      'YENİDEN DOĞDU': 'REBORN', 'KÜLLERİNDEN': 'FROM THE ASHES',
      'EVRE II': 'PHASE II', 'EVRE III': 'PHASE III',
      'YARA': 'WOUND', '2 YARA': '2 WOUNDS',

      /* --- olay sonuç metinleri --- */
      'Kor avucunu dağlıyor ama bileğinden yukarı bir şey akıyor.':
        'The ember sears your palm, but something flows up past your wrist.',
      'Altın kızarıp eriyor. Küllerin arasından bir şey yükseliyor.':
        'The gold glows and melts. Something rises out of the ash.',
      'Sunağı arkanda bırakıyorsun.': 'You leave the altar behind.',
      'Elin yanıyor, ama bulduğun şeye değer.':
        'Your hand burns, but what you find is worth it.',
      'Kül de bir şeye yarıyormuş.': 'Ash is good for something after all.',
      'Yıkıntıyı geride bırakıyorsun.': 'You leave the ruin behind.',
      'Toprağın altında bir kese. 90 altın!': 'A purse under the soil. 90 gold!',
      'Kazdığın yerden kaynar kül fışkırıyor. Destene 2 Yara girdi.':
        'Boiling ash erupts from the hole. 2 Wounds enter your deck.',
      'Zarlar senden yana.': 'The dice favour you.',
      'altın daha!': 'more gold!',
      'Zarlar sessizce duruyor. Kesen boşaldı.':
        'The dice come to rest in silence. Your purse is empty.',
      'Kazandın. +80 altın.': 'You win. +80 gold.',
      'Kaybettin. 50 altın gitti.': 'You lose. 50 gold gone.',
      'Adam omuz silkiyor.': 'The man shrugs.',
      '"Bunu al," diyor. "Bana artık lazım değil."':
        '"Take this," they say. "I have no use for it now."',
      'Kesesi ağır. Ama arkanda bıraktığın bakış daha ağır.':
        'Their purse is heavy. The look you leave behind is heavier.',
      'Adımlarını hızlandırıyorsun.': 'You quicken your pace.',
      'Kart aşağı düşerken alev alıyor.': 'The card catches fire as it falls.',
      'Sıcaklık kolunu yalıyor ama elin bir şey buluyor.':
        'The heat licks your arm, but your hand closes on something.',
      'Kuyuya bakmıyorsun bile.': 'You do not even look into the well.',
      'Bezin altından kartlar çıkıyor.': 'Cards appear from beneath the cloth.',
      'Ağır bir şey avucuna bırakılıyor.': 'Something heavy is placed in your palm.',
      'İki şişe.': 'Two flasks.',
      'Figür bezini topluyor.': 'The figure gathers up the cloth.',
      'Fısıltılar sana bir hazinenin yerini söylüyor. Ve içine yerleşiyorlar.':
        'The whispers tell you where a treasure lies. And then they settle inside you.',
      'Sesler sönüyor.': 'The voices fade.',
      'Her yerin yanıyor. Ama çıktığında elinde bir şey var.':
        'Everything burns. But when you climb out, something is in your hand.',
      'Parmaklarının arasında bir taş kalıyor.': 'A stone remains between your fingers.',
      'Yansımanı görmemeyi tercih ediyorsun.':
        'You would rather not see your reflection.',
      'Elini kartına koyuyor ve ikinci bir tane beliriyor.':
        'They lay a hand on your card and a second one appears.',
      'Aklından bir şey siliniyor. Hafifledin.':
        'Something is erased from your mind. You feel lighter.',
      'Sarılıp ayrılıyorsunuz.': 'You embrace, and part.',
      'İçinde bir şey büyüyor. Maksimum canın 14 arttı.':
        'Something grows inside you. Your Max HP increased by 14.',
      'Kart senin elinde ısınıyor.': 'The card grows warm in your hand.',
      'Koridor karanlıkta kaldı. Kesen doldu.':
        'The corridor is left in darkness. Your purse is full.',
      'Sırtın çöküyor ama kesen doluyor.':
        'Your back gives out, but your purse fills up.',
      '"Anlarım," diyor ve devam ediyor.': '"I understand," they say, and move on.',
      'Çark durdu: bir yadigâr.': 'The wheel stops: a relic.',
      'Çark durdu: 170 altın döküldü.': 'The wheel stops: 170 gold spills out.',
      'Çark durdu: maksimum can +10.': 'The wheel stops: +10 Max HP.',
      'Çark durdu: bir kart.': 'The wheel stops: a card.',
      'Çark durdu:': 'The wheel stops:',
      'can kaybettin.': 'HP lost.',
      'Çark durdu: destene Pişmanlık girdi.': 'The wheel stops: Regret enters your deck.',
      'Çark yavaşça durmaya devam ediyor.': 'The wheel keeps slowing.',
      'taşa gömüldü. Yerine başka bir şey geldi.':
        'was buried in the stone. Something else took its place.',
      'Taş sessiz kalıyor.': 'The stone stays silent.',
      'Göz kırpıyor ve sönüyor. Elinde bir körük var.':
        'The eye blinks and goes out. A bellows rests in your hand.',
      'Külde bir desen görüyorsun.': 'You see a pattern in the ash.',
      'Alev arkandan bakmaya devam ediyor.':
        'The flame keeps watching you as you go.',
      'Bir an için iki yerdesin.': 'For a moment you are in two places.',
      'İzlerken dinleniyorsun.': 'Watching it, you rest.',
      'Kısa ama derin bir uyku.': 'A short but deep sleep.',
      'can iyileştin.': 'HP healed.',
      'Çadırın altını kaz': 'Dig beneath the tent',
      'Çantanın dibinde iki şişe.': 'Two flasks at the bottom of the pack.',
      'koşul sağlanmıyor': 'requirement not met',
      'Telefonu yatay çevir': 'Turn your phone sideways',
      'Oyun yatayda çok daha rahat oynanıyor: kartlar birbirini örtmüyor.':
        'The game plays much better in landscape — the cards stop overlapping.',
      'Tam ekran': 'Fullscreen', 'Böyle devam et': 'Keep it this way',
      'Geç': 'Enter', 'Çık': 'Exit',

      /* --- yardım ekranı (tek parça) --- */
      '__yardim__':
        '<div class="yardim">' +
        '<h3>Goal</h3><p>Get through three acts and reach the <b>First Flame</b>. ' +
        'Every battle you play cards; after every battle your deck grows. Your deck ' +
        'is your character — a lean, focused deck beats a crowded one almost every time.</p>' +
        '<h3>Battle</h3><ul>' +
        '<li>Each turn you get <b>3 energy</b> and draw <b>5 cards</b>. Cards left in hand are discarded.</li>' +
        '<li>The bubble above an enemy shows its <b>intent</b>: ⚔️ attack, 🛡️ defend, ' +
        '⬆️ buff, 💀 debuff, ☠️ heavy attack. The damage shown already accounts for every modifier.</li>' +
        '<li><b>Block</b> is removed at the start of your turn — you cannot bank it.</li>' +
        '<li>Click a card or drag it. Cards that need a target ask you to pick an enemy.</li>' +
        '</ul>' +
        '<h3><span class="kw">Ember</span> — the heart of this game</h3>' +
        '<p>Ember builds up across the whole battle and is not lost between turns. Some ' +
        'cards generate it; others <b>spend all of it</b> for an effect that scales with ' +
        'how much you had. The real decision is: <b>when do you cash it in?</b> One more ' +
        'turn of building means a bigger blast — if you survive that turn.</p>' +
        '<h3>Three paths</h3><ul>' +
        '<li><b style="color:#f97316">Blaze</b> — build Ember, then detonate. Sudden, huge damage.</li>' +
        '<li><b style="color:#b98be0">Ash</b> — stack <span class="kw">Burn</span>, grind with multi-hits. Slow, but it compounds.</li>' +
        '<li><b style="color:#6ea8dc">Iron</b> — Block, <span class="kw">Thorns</span>, <span class="kw">Plating</span>. Turn damage into defence.</li>' +
        '</ul>' +
        '<h3>The map</h3><ul>' +
        '<li>⚔️ Battle — gold + a card · 💀 Elite — hard, but rewards a <b>relic</b></li>' +
        '<li>🏕️ Camp — rest or upgrade a card · 🛒 Shop — buy, and <b>burn a card</b></li>' +
        '<li>❓ Unknown — an event with a choice · 📦 Treasure — a free relic</li>' +
        '</ul>' +
        '<h3>Three pieces of advice</h3><ul>' +
        '<li>Do not take every card. A crowded deck hides your good ones.</li>' +
        '<li><b>Burning a card</b> at the shop is often better than buying one.</li>' +
        '<li>Elites are risky — but reaching a boss with no relics is riskier.</li>' +
        '</ul></div>'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Çekirdek                                                           */
  /* ------------------------------------------------------------------ */

  function ayarla(kod) {
    mevcut = (kod === 'en') ? 'en' : 'tr';
    tazele();
    return mevcut;
  }

  function simdi() { return mevcut; }

  /** Arayüz metni. Karşılığı yoksa Türkçe olduğu gibi döner. */
  function T(metin) {
    if (mevcut === 'tr' || metin == null) return metin;
    var s = ARAYUZ[mevcut];
    return (s && s[metin] !== undefined) ? s[metin] : metin;
  }

  /** Oyun verisi alanı: DIL.v('kart', 'patlama', 'metin', def.metin) */
  function v(tur, id, alan, varsayilan) {
    if (mevcut === 'tr') return varsayilan;
    var tablo = global.DIL_VERI && global.DIL_VERI[mevcut];
    var kayit = tablo && tablo[tur] && tablo[tur][id];
    if (kayit && kayit[alan] !== undefined) return kayit[alan];
    return varsayilan;
  }

  /**
   * Kısa, kalıplaşmış ifadeler: düşman niyet ipuçları ("3 Yanık",
   * "20 blok, 4 Diken", "Desteye 2 Yara"). Bunlar veride sayı + anahtar
   * kelime birleşimi olduğu için tek tek çevirmek yerine sözcük değişimi
   * uygulanıyor. Uzun anahtar önce gelmeli.
   */
  var IP_SOZLUK_EN = [
    ['Desteye', 'Adds to deck:'],
    ['Kırılganlık', 'Vulnerable'], ['Sersemlik', 'Daze'], ['Kavrulma', 'Char'],
    ['Çeviklik', 'Dexterity'], ['Zayıflık', 'Weak'], ['Tılsım', 'Artifact'],
    ['Zincir', 'Chains'], ['Yankı', 'Echo'], ['Akkor', 'Ember'],
    ['Yanık', 'Burn'], ['Diken', 'Thorns'], ['Öfke', 'Rage'], ['Zırh', 'Plating'],
    ['Korku', 'Fear'], ['Kırık', 'Frail'], ['Güç', 'Strength'], ['Köz', 'Coals'],
    ['blok', 'Block'], ['Yara', 'Wound'], ['Külçe', 'Slag'], ['İs', 'Soot'],
    ['Şüphe', 'Doubt'], ['Kor Yükü', 'Ember Burden'],
    ['Müttefiki iyileştirir', 'Heals an ally'],
    ['Verdiği hasar kadar iyileşir', 'Heals for the damage it deals'],
    ['Oynadığın kart başına', 'per card you played'],
    ['Bir şeye hazırlanıyor…', 'Preparing something…'],
    ['çıldırdı!', 'berserk!'], ['enerjini çalar', 'steals your energy'],
    ['az enerji', 'less energy'], ['EVRE', 'PHASE']
  ];

  /**
   * Olay sonuç metinleri kod içinde parçalardan birleştiriliyor
   * ("Zarlar senden yana. " + n + " altın daha!"), bu yüzden tam eşleşme
   * yetmiyor. Önce tam karşılık aranır, yoksa bilinen parçalar değiştirilir.
   */
  var uzunAnahtarlar = null;
  function uzun(metin) {
    if (mevcut === 'tr' || !metin) return metin;
    var s = ARAYUZ[mevcut];
    if (!s) return metin;
    if (s[metin] !== undefined) return s[metin];
    if (!uzunAnahtarlar) {
      uzunAnahtarlar = Object.keys(s).sort(function (a, b) { return b.length - a.length; });
    }
    var out = String(metin);
    for (var i = 0; i < uzunAnahtarlar.length; i++) {
      var k = uzunAnahtarlar[i];
      if (k.length < 8) continue;             // kısa kelimeler yanlış eşleşir
      if (out.indexOf(k) >= 0) out = out.split(k).join(s[k]);
    }
    return out;
  }

  function ip(metin) {
    if (mevcut !== 'en' || !metin) return metin;
    var s = String(metin);
    for (var i = 0; i < IP_SOZLUK_EN.length; i++) {
      s = s.split(IP_SOZLUK_EN[i][0]).join(IP_SOZLUK_EN[i][1]);
    }
    return s;
  }

  /** index.html içindeki durağan metinler: <span data-t>Metin</span> */
  function tazele() {
    var hepsi = document.querySelectorAll('[data-t]');
    for (var i = 0; i < hepsi.length; i++) {
      var el = hepsi[i];
      if (el.dataset.t0 === undefined) el.dataset.t0 = el.textContent;
      el.textContent = T(el.dataset.t0);
    }
    var baslikli = document.querySelectorAll('[data-t-baslik]');
    for (var j = 0; j < baslikli.length; j++) {
      var e2 = baslikli[j];
      if (e2.dataset.tb0 === undefined) e2.dataset.tb0 = e2.getAttribute('title') || '';
      e2.setAttribute('title', T(e2.dataset.tb0));
    }
    document.documentElement.lang = mevcut;
  }

  global.DIL = { ayarla: ayarla, simdi: simdi, T: T, v: v, ip: ip, uzun: uzun,
                 tazele: tazele, diller: DILLER, arayuz: ARAYUZ };
  global.T = T;
})(typeof window !== 'undefined' ? window : globalThis);
