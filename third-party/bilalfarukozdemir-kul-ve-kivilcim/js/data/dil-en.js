/* =========================================================================
   OYUN VERİSİ — İNGİLİZCE
   ---------------------------------------------------------------------
   Kimliğe göre eşlenir; alanı olmayan kayıt Türkçesiyle görünür.
   Kart metinlerindeki {yer tutucular} aynen korunmalıdır.
   Yeni bir dil: bu dosyayı kopyala, DIL_VERI altına başka bir kod ekle.
   ========================================================================= */
(function (global) {
  'use strict';

  var EN = {};

  /* ---------------------------------------------------------------- */
  EN.durum = {
    guc:         { ad: 'Strength',  metin: 'Attacks deal {n} more damage per hit.' },
    ceviklik:    { ad: 'Dexterity', metin: 'Block gained from cards is increased by {n}.' },
    diken:       { ad: 'Thorns',    metin: 'Deals {n} damage back to attackers.' },
    zirh:        { ad: 'Plating',   metin: 'Gain {n} Block at the start of your turn.' },
    ofke:        { ad: 'Rage',      metin: 'Gain {n} Block whenever you play an Attack.' },
    yanki:       { ad: 'Echo',      metin: 'The turn\'s first Attack triggers {n} extra times.' },
    korakor:     { ad: 'Coals',     metin: 'Gain {n} Ember at the start of your turn.' },
    tilsim:      { ad: 'Artifact',  metin: 'Negates the next {n} debuffs.' },
    metanet:     { ad: 'Resolve',   metin: 'Block is not removed at the start of your turn.' },
    zayiflik:    { ad: 'Weak',      metin: 'Deals 25% less attack damage for {n} turns.' },
    kirilganlik: { ad: 'Vulnerable',metin: 'Takes 50% more attack damage for {n} turns.' },
    kirik:       { ad: 'Frail',     metin: 'Gains 25% less Block from cards for {n} turns.' },
    yanik:       { ad: 'Burn',      metin: 'Takes {n} damage at end of turn, then Burn drops by 1.' },
    zehirlenme:  { ad: 'Char',      metin: 'Takes {n} damage at end of turn. Does not decrease.' },
    zincir:      { ad: 'Chains',    metin: 'Cannot gain Ember for {n} turns.' },
    korku:       { ad: 'Fear',      metin: '1 less energy for {n} turns.' },
    sersem:      { ad: 'Daze',      metin: 'Draws 1 fewer card for {n} turns.' }
  };

  /* ---------------------------------------------------------------- */
  EN.kart = {
    vurus:        { ad: 'Strike',  metin: 'Deal {d} damage.' },
    savun:        { ad: 'Defend',  metin: 'Gain {b} Block.' },
    kivilcim:     { ad: 'Spark',   metin: 'Deal {d} damage. Gain {a} Ember.' },

    ufleme:       { ad: 'Bellows', metin: 'Gain {a} Ember.|Gain {a} Ember. Draw {c} card.' },
    koz_sacmak:   { ad: 'Scatter Coals', metin: 'Deal {d} damage to ALL enemies. Gain {a} Ember.' },
    kor_zirhi:    { ad: 'Ember Guard', metin: 'Gain {b} Block. Gain {a} Ember.' },
    korla_vurus:  { ad: 'Ember Strike', metin: 'Deal {d} damage. If your Ember is {e} or more, deal {d2} instead.' },
    atesle:       { ad: 'Ignite', metin: 'Deal {d} damage. {k} more damage per 3 Ember (not spent).' },
    patlama:      { ad: 'Detonate', metin: 'Spend ALL Ember. Deal {k} damage per Ember spent.' },
    korun_nefesi: { ad: 'Breath of Coals', metin: 'Spend ALL Ember. Gain {k} Block per Ember spent.' },
    firin:        { ad: 'Furnace', metin: 'Gain {n} Coals. ({n} Ember at start of turn)' },
    kivilcim_yagmuru: { ad: 'Spark Rain', metin: 'Deal {d} damage to random enemies {n} times. Gain {a} Ember.' },
    alev_almak:   { ad: 'Catch Fire', metin: 'Lose {c} HP. Gain {a} Ember.' },
    ocak_ustasi:  { ad: 'Hearthmaster', metin: 'Whenever you gain Ember, gain {n} more.' },
    kozleme:      { ad: 'Sear', metin: 'Apply Burn equal to your Ember.|Apply Burn equal to your Ember +2.' },
    volkan:       { ad: 'Volcano', metin: 'Spend ALL Ember. Deal {k} damage to ALL enemies per Ember spent.' },
    ebedi_ates:   { ad: 'Eternal Fire', metin: 'Cards that spend Ember no longer consume it.' },
    supernova:    { ad: 'Supernova', metin: 'Exhaust. Spend ALL Ember. Deal {k} damage to ALL enemies per Ember and gain {b} Block per Ember.' },
    korlesme:     { ad: 'Stoke', metin: 'Discard a card. Gain {a} Ember.' },
    kor_kalkani:  { ad: 'Ember Shield', metin: 'Gain Block equal to your Ember, then {b} more. (Ember is not spent)' },

    kavurma:      { ad: 'Scorch', metin: 'Apply {n} Burn.' },
    kor_serpme:   { ad: 'Scatter Embers', metin: 'Apply {n} Burn to ALL enemies.' },
    alevli_pence: { ad: 'Flame Claw', metin: 'Deal {d} damage {n} times. {ek} more per hit if the target is burning.' },
    yayilma:      { ad: 'Spread', metin: 'Copy the target\'s Burn to ALL enemies.' },
    korukleme:    { ad: 'Fan the Flames', metin: 'Deal damage equal to {k}× the target\'s Burn.' },
    kavrulma:     { ad: 'Char', metin: 'Apply {n} Char. (Burn that never fades)' },
    duman:        { ad: 'Smoke', metin: 'Gain {b} Block. Apply {n} Weak to ALL enemies.' },
    kul_firtinasi:{ ad: 'Ash Storm', metin: 'Deal {d} damage to ALL enemies {n} times.' },
    yanik_izi:    { ad: 'Scorch Mark', metin: 'Whenever you play an Attack targeting an enemy, apply {n} Burn to it.' },
    sonmeyen_kor: { ad: 'Undying Coal', metin: 'Burn on enemies no longer decreases at end of turn.' },
    yakip_yikma:  { ad: 'Immolate', metin: 'Deal {k}× the target\'s Burn as damage, then set its Burn to 0.' },
    zehirli_duman:{ ad: 'Choking Smoke', metin: 'Apply {n} Vulnerable to ALL enemies.' },
    cakmak:       { ad: 'Flint', metin: 'Deal {d} damage. Apply {n} Burn. Exhaust.' },
    kavurucu_ruzgar: { ad: 'Searing Wind', metin: 'Deal {k}× their Burn as damage to ALL enemies.' },
    kul_bulutu:   { ad: 'Ash Cloud', metin: 'Gain {b} Block. Apply {n} Weak and {n} Vulnerable to ALL enemies.' },

    siper:        { ad: 'Bulwark', metin: 'Gain {b} Block.' },
    demir_deri:   { ad: 'Iron Skin', metin: 'Gain {n} Plating. ({n} Block at start of turn)' },
    dikenli_kalkan: { ad: 'Thorned Shield', metin: 'Gain {b} Block. Gain {n} Thorns.' },
    kalkan_vurusu:{ ad: 'Shield Bash', metin: 'Deal damage equal to {k}% of your Block.' },
    duvar:        { ad: 'Wall', metin: 'Gain {b} Block.' },
    sabir:        { ad: 'Patience', metin: 'Gain {b} Block. Retain.' },
    metanet_k:    { ad: 'Resolve', metin: 'Your Block is no longer removed at the start of your turn.' },
    ofke_nobeti:  { ad: 'Fury', metin: 'Gain {n} Rage. ({n} Block whenever you play an Attack)' },
    zirh_kirici:  { ad: 'Armor Breaker', metin: 'Deal {d} damage, ignoring the target\'s Block.' },
    agirlik:      { ad: 'Heft', metin: 'Gain {b} Block. Gain {g} Strength.' },
    kaya_gibi:    { ad: 'Like Stone', metin: 'Gain {b} Block. Gain {n} Dexterity.' },
    karsi_darbe:  { ad: 'Counterblow', metin: 'Deal {d} damage. {k} more per stack of Thorns.' },
    diken_tarlasi:{ ad: 'Bramble Field', metin: 'Gain {n} Thorns.' },
    siperden_saldiri: { ad: 'Sally', metin: 'Deal {d} damage. Gain {b} Block.' },
    kirilmaz:     { ad: 'Unbreakable', metin: 'Gain {b} Block. Exhaust.' },
    yankili_kalkan: { ad: 'Echoing Shield', metin: 'Gain Block equal to your leftover Block, at least {k}0.' },
    savunma_duruusu: { ad: 'Defensive Stance', metin: '{n}% of your Block is kept at the start of your turn.' },

    hazirlik:     { ad: 'Preparation', metin: 'Draw {c} cards. Discard {a} card.' },
    ivme:         { ad: 'Momentum', metin: 'Draw {c} cards.' },
    adrenalin:    { ad: 'Adrenaline', metin: 'Gain {e} energy. Draw {c} cards. Exhaust.' },
    ustalik:      { ad: 'Mastery', metin: 'Gain 1 extra energy each turn.' },
    odaklan:      { ad: 'Focus', metin: 'Gain {g} Strength.' },
    ani_hamle:    { ad: 'Sudden Blow', metin: 'Deal {d} damage. Apply {n} Vulnerable.' },
    serseri_vurus:{ ad: 'Wild Swing', metin: 'Deal {d} damage.' },
    agir_darbe:   { ad: 'Heavy Blow', metin: 'Deal {d} damage. Discard {a} card.' },
    son_nefes:    { ad: 'Last Breath', metin: 'Heal {c} HP. Exhaust.' },
    arinma:       { ad: 'Cleanse', metin: 'Exhaust all Status and Curse cards in your hand. Draw 1 card.' },
    cifte_vurus:  { ad: 'Double Strike', metin: 'Gain {n} Echo. (The turn\'s first Attack triggers {n} extra times)' },
    bileme:       { ad: 'Whetstone', metin: 'Gain {g} Strength. Lose it at end of turn.' },
    secim:        { ad: 'Fate Stone', metin: 'Reveal {n} cards from your draw pile; take one into your hand. Exhaust.' },
    yagma:        { ad: 'Plunder', metin: 'Deal {d} damage. If this kills the enemy, draw {c} card and gain 1 energy.' },
    ikiz_alev:    { ad: 'Twin Flame', metin: 'Deal {d} damage {n} times.' },
    feda:         { ad: 'Sacrifice', metin: 'Lose {c} HP. Gain {e} energy.' },
    son_direnis:  { ad: 'Last Stand', metin: 'Spend X energy. Deal X × {k} damage.' },
    koruma_cemberi: { ad: 'Warding Circle', metin: 'Spend X energy. Gain X × {k} Block and draw X cards.' },
    tilsim_k:     { ad: 'Talisman', metin: 'Gain {n} Artifact. Exhaust.' },
    kalpten_vurus:{ ad: 'Heartstrike', metin: 'Deal {d} damage. {k} more for each Power played this battle.' },
    yorulmak_bilmez: { ad: 'Tireless', metin: 'Draw {n} extra card each turn.' },
    kucultme:     { ad: 'Diminish', metin: 'Apply {n} Weak and {n} Vulnerable.' },
    kesif:        { ad: 'Scout', metin: 'Draw {c} cards. Gain {b} Block.' },
    acimasizlik:  { ad: 'Cruelty', metin: 'Deal {d} damage. {k} more if the target is below half HP.' },
    kan_bagi:     { ad: 'Blood Bond', metin: 'Whenever an enemy dies, heal {n} HP and gain 1 Ember.' },
    gozdagi:      { ad: 'Intimidate', metin: 'Apply {n} Weak to ALL enemies.' },
    hisim:        { ad: 'Wrath', metin: 'Deal {d} damage. Lose {c} HP.' },
    tekrar:       { ad: 'Again', metin: 'Play the last card you played this turn again.' },

    yara:         { ad: 'Wound',  metin: 'Unplayable.' },
    kulce:        { ad: 'Slag',   metin: 'Unplayable. Cannot be exhausted.' },
    is:           { ad: 'Soot',   metin: 'Unplayable. Exhausts at end of turn.' },
    lanet_supheli:{ ad: 'Doubt',  metin: 'Unplayable. If in hand at end of turn, gain 1 Weak.' },
    lanet_kor_yuku: { ad: 'Ember Burden', metin: 'Unplayable. If in hand at end of turn, take 2 damage.' },
    lanet_zincir: { ad: 'Chain',  metin: 'Unplayable. Start each battle with 1 less energy.' },
    lanet_pismanlik: { ad: 'Regret', metin: 'Unplayable. If in hand at end of turn, take damage equal to cards in hand.' }
  };

  /* ---------------------------------------------------------------- */
  EN.dusman = {
    kor_sicani: { ad: 'Ember Rat' },       kulluk_bocegi: { ad: 'Ash Beetle' },
    yanik_ceset: { ad: 'Charred Corpse' }, duman_ruhu: { ad: 'Smoke Wraith' },
    kavruk_nobetci: { ad: 'Scorched Sentry' }, ates_bocegi: { ad: 'Firefly' },
    sonuk_fener: { ad: 'Dim Lantern' },    kul_yigini: { ad: 'Ash Mound' },
    kul_muhafizi: { ad: 'Ash Warden' },    obur_kor: { ad: 'Devouring Ember' },
    alev_ikizi: { ad: 'Flame Twin' },      kul_devi: { ad: 'THE ASH COLOSSUS' },
    curuf_yaratigi: { ad: 'Slag Creature' }, koz_avcisi: { ad: 'Coal Hunter' },
    kullu_rahip: { ad: 'Ashen Priest' },   demir_otomat: { ad: 'Iron Automaton' },
    ciglik: { ad: 'The Scream' },          kor_yilani: { ad: 'Ember Serpent' },
    yanki_varligi: { ad: 'Echo' },         curuf_yigini: { ad: 'Slag Heap' },
    kirik_can: { ad: 'Broken Bell' },      kul_sovalyesi: { ad: 'Ash Knight' },
    curuf_agasi: { ad: 'Slag Lord' },      sonmus_kral: { ad: 'THE EXTINGUISHED KING' },
    alev_elementali: { ad: 'Flame Elemental' }, kor_devi_kucuk: { ad: 'Ember Giant' },
    golge_alev: { ad: 'Shadow Flame' },    sonsuz_kor: { ad: 'Endless Ember' },
    ates_yumagi: { ad: 'Fire Coil' },      kul_cadisi: { ad: 'Ash Witch' },
    yanardag_muhafizi: { ad: 'Volcano Warden' }, kullerin_efendisi: { ad: 'Lord of Ashes' },
    ilk_alev: { ad: 'THE FIRST FLAME' }
  };

  /* ---------------------------------------------------------------- */
  EN.yadigar = {
    sonmez_kor:    { ad: 'Undying Ember', metin: 'Gain 2 Ember at the start of every battle.' },
    kor_tasi:      { ad: 'Ember Stone', metin: 'Gain 3 Ember at the start of every battle.' },
    kirik_migfer:  { ad: 'Broken Helm', metin: 'Gain 7 Block at the start of every battle.' },
    cakmaktasi:    { ad: 'Flintstone', metin: 'The first Attack you play each turn deals 3 more damage.' },
    kanli_bez:     { ad: 'Bloody Rag', metin: 'Heal 6 HP after every battle.' },
    demir_toka:    { ad: 'Iron Buckle', metin: 'When picked up, gain 8 Max HP.' },
    ors:           { ad: 'Anvil', metin: 'Gain 2 Plating at the start of every battle.' },
    yolcu_haritasi:{ ad: 'Traveller\'s Map', metin: 'Resting heals 50% more.' },
    cam_sise:      { ad: 'Glass Flask', metin: '1 extra potion slot.' },
    ugurlu_komur:  { ad: 'Lucky Coal', metin: 'Gain 30% more gold from battles.' },
    orumcek_agi:   { ad: 'Cobweb', metin: 'Apply 1 Weak to all enemies at the start of every battle.' },
    yanik_eldiven: { ad: 'Scorched Glove', metin: 'Apply 3 Burn to all enemies on the first turn of every battle.' },
    koruk:         { ad: 'Bellows', metin: 'Whenever you gain Ember, gain 1 more.' },
    kavrulmus_kalp:{ ad: 'Seared Heart', metin: 'Attacks deal 5 more damage while below half HP.' },
    kul_elegi:     { ad: 'Ash Sieve', metin: 'At the start of every battle, a random card in your hand costs 0.' },
    kor_zinciri:   { ad: 'Ember Chain', metin: 'The first card you play each turn costs 1 less.' },
    efsunlu_kalkan:{ ad: 'Warded Shield', metin: 'Gain 14 Block at the start of every battle.' },
    gece_feneri:   { ad: 'Night Lantern', metin: 'Gain 1 extra energy on the first turn of every battle.' },
    olum_maskesi:  { ad: 'Death Mask', metin: 'Whenever an enemy dies, gain 2 Ember and heal 3 HP.' },
    sarsilmaz_kaya:{ ad: 'Unshaken Rock', metin: 'Half of your Block is kept at the start of your turn.' },
    kirmizi_boncuk:{ ad: 'Red Bead', metin: 'Gain 1 energy when you play your 3rd card each turn.' },
    kadim_sise:    { ad: 'Ancient Flask', metin: 'Your potions are far more powerful.' },
    bilgelik_kitabi:{ ad: 'Book of Wisdom', metin: 'Upgrading at a campfire upgrades 2 cards instead of 1.' },
    kesekagidi:    { ad: 'Fat Purse', metin: 'When picked up, gain 120 gold.' },
    kul_tesbihi:   { ad: 'Ash Beads', metin: 'At the end of each turn, gain 1 Ember per card in your hand.' },
    demirci_orsu:  { ad: 'Smith\'s Anvil', metin: 'If you play no Attacks in a turn, gain 12 Block.' },
    ebedi_koz:     { ad: 'Eternal Coal', metin: 'Start battles with 6 Ember. Whenever you gain Ember, gain 1 more.' },
    zaman_kumu:    { ad: 'Sands of Time', metin: 'Gain 2 extra energy on the first turn of every battle.' },
    kirik_saat:    { ad: 'Broken Clock', metin: 'Draw 1 extra card each turn.' },
    feniks_tuyu:   { ad: 'Phoenix Feather', metin: 'Once per run, instead of dying you rise with half your HP.' },
    alev_taci:     { ad: 'Crown of Flame', metin: '1 extra energy each turn. Take 5 damage at the start of every battle.' },
    ates_gozu:     { ad: 'Eye of Fire', metin: 'At the start of elite and boss battles, draw 3 cards and gain 2 energy.' },
    devin_kalbi:   { ad: 'Heart of the Colossus', metin: 'Gain 30 Max HP and heal fully.' },
    kral_muhru:    { ad: 'King\'s Seal', metin: '1 extra energy each turn, but draw 1 fewer card.' },
    alevin_ozu:    { ad: 'Essence of Flame', metin: 'Whenever you spend Ember, regain half of what you spent.' },
    kul_kalkani:   { ad: 'Ash Aegis', metin: 'Damage you take is reduced by 2 (minimum 1).' },
    tuccar_yuzugu: { ad: 'Merchant\'s Ring', metin: 'Everything in shops costs 30% less.' },
    koz_kesesi:    { ad: 'Coal Pouch', metin: 'Gain a random potion at the start of every battle (if you have room).' }
  };

  /* ---------------------------------------------------------------- */
  EN.iksir = {
    can_iksiri:      { ad: 'Health Potion', metin: 'Heal 20 HP.' },
    kuvvet_iksiri:   { ad: 'Strength Potion', metin: 'Gain 2 Strength.' },
    ceviklik_iksiri: { ad: 'Dexterity Potion', metin: 'Gain 2 Dexterity.' },
    ates_bombasi:    { ad: 'Fire Bomb', metin: 'Deal 22 damage to one enemy.' },
    kor_iksiri:      { ad: 'Ember Potion', metin: 'Gain 8 Ember.' },
    demir_iksiri:    { ad: 'Iron Potion', metin: 'Gain 20 Block.' },
    duman_bombasi:   { ad: 'Smoke Bomb', metin: 'Apply 3 Weak to ALL enemies.' },
    kirilma_iksiri:  { ad: 'Shatter Potion', metin: 'Apply 3 Vulnerable to ALL enemies.' },
    bilgi_iksiri:    { ad: 'Knowledge Potion', metin: 'Draw 3 cards.' },
    enerji_iksiri:   { ad: 'Energy Potion', metin: 'Gain 2 energy.' },
    alev_iksiri:     { ad: 'Flame Potion', metin: 'Apply 6 Burn to ALL enemies.' },
    diken_iksiri:    { ad: 'Thorn Potion', metin: 'Gain 5 Thorns.' },
    tilsim_iksiri:   { ad: 'Talisman Potion', metin: 'Gain 2 Artifact.' },
    ofke_iksiri:     { ad: 'Rage Potion', metin: 'Gain 5 Rage.' },
    berraklik_iksiri:{ ad: 'Clarity Potion', metin: 'Exhaust Status and Curse cards in your hand. Draw 2 cards.' },
    yanki_iksiri:    { ad: 'Echo Potion', metin: 'Gain 1 Echo. (The turn\'s first Attack triggers once more)' },
    kiyamet_iksiri:  { ad: 'Doom Potion', metin: 'Deal 30 damage to ALL enemies.' },
    anka_iksiri:     { ad: 'Phoenix Potion', metin: 'Remove all debuffs and heal 15 HP.' }
  };

  /* ---------------------------------------------------------------- */
  EN.olay = {
    kul_sunagi: {
      ad: 'Ash Altar',
      metin: 'A stone altar by the road, buried in soot. An ember still sits on it, ' +
             'warm — as though someone were here a moment ago.',
      s: [
        { yazi: 'Reach into the ember', ipucu: 'Lose 8 HP · upgrade 2 cards' },
        { yazi: 'Leave gold on the altar', ipucu: '75 gold · random relic' },
        { yazi: 'Pass respectfully', ipucu: 'Nothing happens' }
      ]
    },
    sonmus_ocak: {
      ad: 'Cold Hearth',
      metin: 'A hearth long gone out in the middle of a ruined house. Something ' +
             'still glints beneath the ash.',
      s: [
        { yazi: 'Stir the ashes', ipucu: 'Lose 10 HP · rare card' },
        { yazi: 'Gather the ash and sell it', ipucu: '+70 gold' },
        { yazi: 'Leave', ipucu: '' }
      ]
    },
    terk_edilmis_kamp: {
      ad: 'Abandoned Camp',
      metin: 'A camp left in a hurry. The fire has only just died; the tent is still standing.',
      s: [
        { yazi: 'Rest a while', ipucu: 'Heal 30% of your Max HP' },
        { yazi: 'Search the belongings', ipucu: '2 random potions' },
        { yazi: 'Dig beneath the tent', ipucu: 'Risky: 90 gold or 2 Wounds' }
      ]
    },
    kul_kumarbazi: {
      ad: 'The Ash Gambler',
      metin: '"You live as long as your luck holds," says the hooded figure, ' +
             'tossing two bone dice into the air. "One round?"',
      s: [
        { yazi: 'Wager everything', ipucu: '45% double · 55% lose it all' },
        { yazi: 'Play it small', ipucu: 'Stake 50 gold · 60% to win 80' },
        { yazi: 'I don\'t gamble', ipucu: '' }
      ]
    },
    yarali_savasci: {
      ad: 'Wounded Warrior',
      metin: 'A warrior slumped against a rock, wounded in the chest. Seeing you, ' +
             'they reach for their sword — then let it go.',
      s: [
        { yazi: 'Bind the wound', ipucu: 'Give 12 HP · uncommon relic' },
        { yazi: 'Take their belongings', ipucu: '+140 gold · 1 curse' },
        { yazi: 'Walk on', ipucu: '' }
      ]
    },
    ates_kuyusu: {
      ad: 'Fire Well',
      metin: 'A well that seems bottomless. Orange light and a wave of heat rise from it.',
      s: [
        { yazi: 'Throw a card into the well', ipucu: 'Lose 6 HP · remove 1 card' },
        { yazi: 'Reach inside', ipucu: 'Choose 1 of 3 cards' },
        { yazi: 'Skirt the edge', ipucu: '' }
      ]
    },
    ortulu_tuccar: {
      ad: 'Veiled Merchant',
      metin: 'A figure with a fully covered face sells three things on a cloth ' +
             'laid before them. They do not speak, only point.',
      s: [
        { yazi: 'Point at the card', ipucu: '80 gold · choose 1 of 3 uncommons' },
        { yazi: 'Point at the relic', ipucu: '160 gold · uncommon relic' },
        { yazi: 'Point at the flasks', ipucu: '55 gold · 2 potions' },
        { yazi: 'Buy nothing', ipucu: '' }
      ]
    },
    kul_fisiltilari: {
      ad: 'Ash Whispers',
      metin: 'The wind carries ash, and from within the ash come whispers. They ' +
             'say your name. Listen and you will learn something — and leave something behind.',
      s: [
        { yazi: 'Listen', ipucu: '+180 gold · 1 curse' },
        { yazi: 'Stop your ears', ipucu: 'Safe' }
      ]
    },
    kor_havuzu: {
      ad: 'Ember Pool',
      metin: 'A lake of white-hot liquid rising from below. There is no reflection ' +
             'on its surface — something else is there instead.',
      s: [
        { yazi: 'Dive in', ipucu: 'Lose half your HP · rare relic' },
        { yazi: 'Dip your hand', ipucu: 'Lose 6 HP · Ember Stone' },
        { yazi: 'Watch from the shore', ipucu: '' }
      ]
    },
    eski_dost: {
      ad: 'An Old Friend',
      metin: 'A familiar face in the middle of the road. You cannot recall the name, ' +
             'but they remember you. "I can carry something of yours," they say, ' +
             '"or take something away."',
      s: [
        { yazi: 'Duplicate one of my cards', ipucu: 'A copy of a card in your deck' },
        { yazi: 'Let me forget a card', ipucu: 'Remove 1 card from your deck' },
        { yazi: 'Say goodbye', ipucu: '' }
      ]
    },
    sonmez_mesale: {
      ad: 'Undying Torch',
      metin: 'A torch fixed to the wall. It must have burned for centuries, yet ' +
             'its fuel has not run low and the wall bears no soot.',
      s: [
        { yazi: 'Draw the light inward', ipucu: '+14 Max HP' },
        { yazi: 'Pass the flame into a card', ipucu: 'Upgrade 1 card' },
        { yazi: 'Snuff it out and sell it', ipucu: '+110 gold' }
      ]
    },
    kulce_madencisi: {
      ad: 'Slag Miner',
      metin: 'A miner carrying more slag ingots than they can bear. "Carry half ' +
             'and I\'ll sell half. We split the money."',
      s: [
        { yazi: 'Help them', ipucu: '+230 gold · 2 Slag into your deck' },
        { yazi: 'Refuse', ipucu: '' }
      ]
    },
    kader_carki: {
      ad: 'Wheel of Fate',
      metin: 'A rusted wheel as tall as a person. Six marks are cut into it, ' +
             'none of which you can read.',
      s: [
        { yazi: 'Spin it', ipucu: 'Entirely random' },
        { yazi: 'Do not touch it', ipucu: '' }
      ]
    },
    bos_sunak: {
      ad: 'Empty Altar',
      metin: 'Black stone with a single hollow in it. The hollow is shaped exactly ' +
             'like one of the relics you carry.',
      s: [
        { yazi: 'Sacrifice a relic', ipucu: 'Lose a random relic · gain a rare one' },
        { yazi: 'Leave the hollow empty', ipucu: '' }
      ]
    },
    ruh_atesi: {
      ad: 'Soul Fire',
      metin: 'A flame shaped like an eye, hanging in the air. It looks at you, and ' +
             'the longer you look back the more a warmth grows in your chest.',
      s: [
        { yazi: 'Return its gaze', ipucu: 'Lose 16 HP · Bellows relic' },
        { yazi: 'Study the ash', ipucu: 'Upgrade 1 card' },
        { yazi: 'Look away', ipucu: '' }
      ]
    },
    zaman_yarigi: {
      ad: 'Rift in Time',
      metin: 'A tear in the air, as if cut with a knife. Your own voice comes from ' +
             'inside it — saying something you have not said yet.',
      s: [
        { yazi: 'Step through', ipucu: 'Choose 1 of 3 uncommon cards' },
        { yazi: 'Watch the past', ipucu: '+18 HP · +80 gold' }
      ]
    }
  };

  global.DIL_VERI = global.DIL_VERI || {};
  global.DIL_VERI.en = EN;
})(typeof window !== 'undefined' ? window : globalThis);
