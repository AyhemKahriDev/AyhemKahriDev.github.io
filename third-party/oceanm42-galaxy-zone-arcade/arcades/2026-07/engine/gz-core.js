/*!
 * engine/gz-core.js
 * GZ namespace + GZ.boot() — the fixed-timestep game loop and the
 * ready/playing/paused/gameover state machine every game runs inside.
 *
 * Load order matters (see docs/ENGINE.md): games-manifest, gz-core,
 * gz-audio, gz-input, gz-fx, gz-scores, gz-shell, then game.js. GZ.boot is
 * only ever CALLED from game.js, by which time every module below has
 * already attached itself to window.GZ, so referencing GZ.Shell/GZ.Input/
 * etc. from inside boot() is always safe.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  var FIXED_DT = 1 / 60;
  var MAX_FRAME_SECONDS = 0.1; // clamp so a backgrounded tab can't spiral

  GZ.boot = function (config) {
    if (!config || typeof config.slug !== 'string') return;

    // The page's <body data-gz-slug="..."> is the canonical source of truth
    // (docs/GAME-PAGE-TEMPLATE.html); config.slug is kept as a required,
    // self-documenting fallback so game.js still reads correctly on its own.
    var slug = (document.body && document.body.getAttribute('data-gz-slug')) || config.slug;

    var manifest = (window.GZ_MANIFEST || []).filter(function (m) { return m.slug === slug; })[0];
    if (!manifest) {
      manifest = { slug: slug, title: slug, accent: '#00f0ff', touchLayout: config.touchLayout || 'lr-a' };
    }

    var controlsHelp = config.controlsHelp || [];
    var hudCfg = config.hud || ['score'];

    var mounted = GZ.Shell.mount({
      slug: slug,
      title: manifest.title,
      accent: manifest.accent,
      touchLayout: config.touchLayout || manifest.touchLayout || 'lr-a',
      hud: hudCfg,
      controlsHelp: controlsHelp
    });
    var canvas = mounted.canvas, ctx = mounted.ctx;

    GZ.Input.attach(canvas);
    GZ.Audio.init();
    GZ.Shell.setMuted(GZ.Audio.muted);
    GZ.FX.reset();

    // ---- session state (owned entirely by the engine) --------------------
    var session = { phase: 'ready', score: 0, lives: 0, level: 1, time: 0 };

    var g = {
      width: 800,
      height: 600,
      state: config.state || {},
      get time() { return session.time; },
      get phase() { return session.phase; },
      get score() { return session.score; },
      get lives() { return session.lives; },
      get level() { return session.level; },
      addScore: function (n) { session.score += n; },
      setLives: function (n) { session.lives = n; },
      setLevel: function (n) { session.level = n; },
      gameOver: function () { gameOverHandler(); },
      input: GZ.Input,
      audio: GZ.Audio,
      fx: GZ.FX,
      draw: GZ.Draw
    };

    function currentHigh() { return GZ.Scores.high(slug); }

    function applyPhase(extra) {
      var payload = { controlsHelp: controlsHelp, high: currentHigh() };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
      GZ.Shell.setPhase(session.phase, payload);
    }

    function resetSession() {
      session.score = 0;
      session.lives = 0;
      session.level = 1;
      session.time = 0;
      GZ.FX.reset();
      config.init(g);
    }

    function startPlaying() {
      resetSession();
      session.phase = 'playing';
      GZ.Player.recordPlay(slug);
      GZ.Audio.play('start');
      applyPhase();
    }

    function resumePlaying() {
      session.phase = 'playing';
      GZ.Audio.play('resume');
      applyPhase();
    }

    function pauseGame() {
      session.phase = 'paused';
      GZ.Audio.play('pause');
      applyPhase();
    }

    function quitToArcade() {
      window.location.href = '../../index.html';
    }

    function gameOverHandler() {
      if (session.phase !== 'playing') return;
      session.phase = 'gameover';
      var result = GZ.Scores.submit(slug, session.score);
      GZ.Player.checkScoreAchievements(slug, session.score, result.isNew);
      if (result.isNew) {
        GZ.Audio.play('highscore');
        GZ.FX.burst(g.width / 2, g.height / 2, { color: manifest.accent, count: 40, speed: 220, life: 1.1, size: 4 });
      } else {
        GZ.Audio.play('gameover');
      }
      applyPhase({ finalScore: session.score, high: result.high, isNew: result.isNew });
    }

    // ---- meta input: state-machine transitions, handled once per frame ----
    // IMPORTANT: Space/Enter/canvas-click must only be *taken* (removed from
    // this frame's action snapshot) while phase !== 'playing'. They also map
    // to action 'a' (Space) — if we unconditionally consumed them here every
    // frame, a game's g.input.pressed('a') could never fire during actual
    // gameplay, because this function always runs before the update()
    // accumulator loop. Escape/P/M/R aren't mapped to any action, so they're
    // safe to always take regardless of phase.
    function handleMeta() {
      var escPressed = GZ.Input._takeRaw('Escape');
      var pPressed = GZ.Input._takeRaw('KeyP');
      var mPressed = GZ.Input._takeRaw('KeyM');
      var rPressed = GZ.Input._takeRaw('KeyR');

      if (mPressed) GZ.Shell.setMuted(GZ.Audio.toggleMuted());

      if (session.phase === 'playing') {
        if (pPressed || escPressed) pauseGame();
      } else {
        var startPressed = GZ.Input._takeRaw('Space') || GZ.Input._takeRaw('Enter') || GZ.Input._takeMetaPointerPress();
        if (startPressed) {
          if (session.phase === 'paused') resumePlaying();
          else startPlaying(); // 'ready' or 'gameover'
        } else if (escPressed) {
          quitToArcade();
        } else if (session.phase === 'paused' && rPressed) {
          startPlaying();
        }
      }

      // Enter only doubles as action 'a' while an overlay is showing.
      GZ.Input._setOverlayMode(session.phase !== 'playing');
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && session.phase === 'playing') pauseGame();
    });

    // ---- initial paint (ready overlay) ------------------------------------
    config.init(g);
    applyPhase();

    // ---- main loop: rAF render + sub-stepped update -----------------------
    // Each frame advances the simulation by exactly the real elapsed time,
    // split into sub-steps no larger than 1/60s. A pure fixed-60Hz
    // accumulator left a fractional remainder each frame, which on 120Hz+
    // displays meant every other frame rendered an unchanged world — visible
    // judder on constant-velocity motion. Sub-stepping keeps physics stable
    // (no step ever exceeds 1/60s) while rendering motion at full refresh.
    var lastT = null;
    var lastHud = { score: null, high: null, lives: null, level: null };

    function frame(now) {
      requestAnimationFrame(frame);

      if (lastT === null) lastT = now;
      var frameDt = (now - lastT) / 1000;
      lastT = now;
      if (frameDt > MAX_FRAME_SECONDS) frameDt = MAX_FRAME_SECONDS;
      if (frameDt < 0) frameDt = 0;

      handleMeta();

      if (session.phase === 'playing') {
        var remaining = frameDt;
        var first = true;
        var steps = 0;
        // Re-check phase every iteration: a game can call g.gameOver() mid-update,
        // and a multi-step loop must stop immediately when that happens
        // (update() is only ever allowed to run while phase === 'playing').
        while (session.phase === 'playing' && remaining > 1e-6 && steps < 16) {
          var step = remaining > FIXED_DT ? FIXED_DT : remaining;
          GZ.Input._beginStep(first);
          config.update(g, step);
          GZ.FX.update(step);
          session.time += step;
          remaining -= step;
          first = false;
          steps++;
        }
      } else {
        GZ.Input._beginStep(true); // still rotate the snapshot so no stale press leaks in later
      }

      ctx.save();
      ctx.clearRect(0, 0, 800, 600);
      var shakeOffset = GZ.FX.getShakeOffset();
      ctx.translate(shakeOffset.x, shakeOffset.y);
      config.render(g, ctx);
      GZ.FX.render(ctx);
      ctx.restore();

      var high = currentHigh();
      if (session.score !== lastHud.score || high !== lastHud.high || session.lives !== lastHud.lives || session.level !== lastHud.level) {
        GZ.Shell.setHud({ score: session.score, high: high, lives: session.lives, level: session.level });
        lastHud.score = session.score; lastHud.high = high; lastHud.lives = session.lives; lastHud.level = session.level;
      }
    }
    requestAnimationFrame(frame);
  };
})();
