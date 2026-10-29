/*!
 * js/main.js
 * Sal's Galaxy Zone Arcade — homepage behavior.
 *
 * Loaded after js/games-manifest.js, engine/gz-audio.js, and
 * engine/gz-scores.js. Builds the 16-card grid from window.GZ_MANIFEST,
 * runs the starfield + neon sign + delivery-crate reveal, and renders Sal's
 * player card. Classic script, no imports, no fetch of local files — pure
 * file:// compatible.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tracks whether the visitor has made a gesture yet, so we only ever play
  // sound in response to something the player did (GZ.Audio owns the actual
  // AudioContext + its own unlock listeners — this is just a local flag so
  // main.js knows whether it's polite to trigger a sound of its own).
  var userGestured = false;
  function markGestured() { userGestured = true; }
  window.addEventListener('pointerdown', markGestured, { once: true, passive: true });
  window.addEventListener('keydown', markGestured, { once: true });

  function fmtScore(n) {
    if (!n) return '—'; // em dash
    try { return n.toLocaleString('en-US'); } catch (e) { return String(n); }
  }

  /* ---------------------------- starfield ------------------------------ */
  function initStarfield() {
    var canvas = document.getElementById('gz-starfield');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, stars = [], raf = null, visible = !document.hidden;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function makeStars() {
      var count = Math.max(40, Math.floor((w * h) / 9000));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random() * 0.8 + 0.2,
          r: Math.random() * 1.3 + 0.3
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = 0.2 + s.z * 0.6;
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      if (!visible) return;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += s.z * 0.18;
        if (s.y > h) { s.y = -2; s.x = Math.random() * w; }
      }
      draw();
      raf = window.requestAnimationFrame(tick);
    }

    resize();
    makeStars();
    draw();

    if (!reduceMotion) raf = window.requestAnimationFrame(tick);

    window.addEventListener('resize', function () {
      resize();
      makeStars();
      draw();
    });

    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) {
        if (!reduceMotion && !raf) raf = window.requestAnimationFrame(tick);
      } else if (raf) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
    });
  }

  /* ------------------------------ neon sign ------------------------------ */
  function buildSign() {
    var el = document.getElementById('gz-sign');
    if (!el) return;
    var text = "SAL'S GALAXY ZONE ARCADE";
    var i = 0;
    for (var c = 0; c < text.length; c++) {
      var ch = text.charAt(c);
      if (ch === ' ') {
        el.appendChild(document.createTextNode(' '));
      } else {
        var span = document.createElement('span');
        span.className = 'gz-sign-letter gz-flicker';
        span.style.setProperty('--gz-i', i);
        span.textContent = ch;
        el.appendChild(span);
      }
      i++;
    }
  }

  /* ------------------------------- grid ---------------------------------- */
  function makeChip(label, value) {
    var chip = document.createElement('div');
    chip.className = 'gz-card-hiscore';
    var l = document.createElement('span');
    l.className = 'gz-chip-label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'gz-chip-value';
    v.textContent = value;
    chip.appendChild(l);
    chip.appendChild(v);
    return chip;
  }

  function buildCard(game) {
    var card = document.createElement('a');
    card.className = 'gz-card';
    card.href = 'games/' + game.slug + '/index.html';
    card.style.setProperty('--gz-accent', game.accent);

    var cover = document.createElement('div');
    cover.className = 'gz-card-cover';
    var img = document.createElement('img');
    img.src = 'assets/covers/' + game.slug + '.svg';
    img.alt = game.title + ' cover art';
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      // Some cover art may still be arriving from other builders — fail
      // quietly rather than leaving a broken-image glyph on the floor.
      img.style.display = 'none';
    });
    cover.appendChild(img);
    card.appendChild(cover);

    var body = document.createElement('div');
    body.className = 'gz-card-body';

    var title = document.createElement('div');
    title.className = 'gz-card-title';
    title.textContent = game.title;
    body.appendChild(title);

    var inspired = document.createElement('div');
    inspired.className = 'gz-card-inspired';
    inspired.textContent = 'Inspired by ' + game.inspiredBy + ' (' + game.year + ')';
    body.appendChild(inspired);

    body.appendChild(makeChip('HI-SCORE', fmtScore(GZ.Scores.high(game.slug))));

    card.appendChild(body);

    // Hover blip: only once the visitor has made a gesture, so we never
    // try to force the shared AudioContext to unlock on our own.
    card.addEventListener('pointerenter', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (userGestured && window.GZ && GZ.Audio) GZ.Audio.play('click');
    });

    if (game.isNew) {
      var badge = document.createElement('span');
      badge.className = 'gz-card-badge-new';
      badge.textContent = 'NEW!';
      card.appendChild(badge);

      if (!reduceMotion) {
        var crate = document.createElement('div');
        crate.className = 'gz-crate';
        crate.setAttribute('aria-hidden', 'true');
        var label = document.createElement('div');
        label.className = 'gz-crate-label';
        label.textContent = 'DELIVERY FOR: S. MARTINEZ — HANDLE WITH CARE';
        crate.appendChild(label);
        card.appendChild(crate);

        window.setTimeout(function () {
          crate.classList.add('gz-crate-open');
          if (userGestured && window.GZ && GZ.Audio) GZ.Audio.play('powerup');
        }, 1400);
      }
    }

    return card;
  }

  function buildGrid() {
    var grid = document.getElementById('gz-grid');
    if (!grid) return;
    var manifest = window.GZ_MANIFEST || [];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < manifest.length; i++) frag.appendChild(buildCard(manifest[i]));
    grid.appendChild(frag);
  }

  /* --------------------------- player card panel -------------------------- */
  var ACHIEVEMENTS = [
    { id: 'first-play', label: 'First Quarter', desc: 'Drop your first coin — play any cabinet once.' },
    { id: 'played-all-16', label: 'Floor Walker', desc: 'Play all 16 cabinets on the floor.' },
    { id: 'score-10k', label: 'Wizard', desc: 'Score 10,000 or more in a single game.' },
    { id: 'new-record', label: 'High Score Hero', desc: 'Set a new high score on any cabinet.' }
  ];

  function renderPlayerCard() {
    var body = document.getElementById('gz-player-body');
    if (!body || !window.GZ || !GZ.Player || !GZ.Scores) return;

    var player = GZ.Player.get();
    var scores = GZ.Scores.all();
    var manifest = window.GZ_MANIFEST || [];

    var totalPlays = 0;
    for (var k in player.plays) {
      if (Object.prototype.hasOwnProperty.call(player.plays, k)) totalPlays += player.plays[k];
    }

    if (totalPlays === 0) {
      var empty = document.createElement('p');
      empty.className = 'gz-player-empty';
      empty.textContent = 'No coins dropped yet — pick a cabinet.';
      body.appendChild(empty);
      return;
    }

    var scoredCount = 0;
    for (var i = 0; i < manifest.length; i++) {
      var s = scores[manifest[i].slug];
      if (s && s.score > 0) scoredCount++;
    }

    var stats = document.createElement('div');
    stats.className = 'gz-player-stats';
    stats.appendChild(makeChip('TOTAL PLAYS', String(totalPlays)));
    stats.appendChild(makeChip('CABINETS', scoredCount + ' / ' + manifest.length + ' scored'));
    body.appendChild(stats);

    var badges = document.createElement('div');
    badges.className = 'gz-badges';
    for (var b = 0; b < ACHIEVEMENTS.length; b++) {
      var def = ACHIEVEMENTS[b];
      var lit = player.achievements.indexOf(def.id) !== -1;
      var el = document.createElement('span');
      el.className = 'gz-badge' + (lit ? ' gz-badge-lit' : '');
      el.textContent = def.label;
      el.title = def.desc + (lit ? ' — earned!' : ' — locked');
      badges.appendChild(el);
    }
    body.appendChild(badges);
  }

  /* -------------------------------- footer -------------------------------- */
  function initCoinSlot() {
    var slot = document.getElementById('gz-coin-slot');
    if (!slot) return;
    var timer = null;
    var defaultLabel = slot.textContent;
    slot.addEventListener('click', function () {
      if (window.GZ && GZ.Audio) GZ.Audio.play('coin');
      slot.textContent = 'CREDIT 1 — READY PLAYER ONE';
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { slot.textContent = defaultLabel; }, 3000);
    });
  }

  /* -------------------------------- boot ---------------------------------- */
  function boot() {
    if (window.GZ && GZ.Audio && GZ.Audio.init) GZ.Audio.init();
    buildSign();
    initStarfield();
    buildGrid();
    renderPlayerCard();
    initCoinSlot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
