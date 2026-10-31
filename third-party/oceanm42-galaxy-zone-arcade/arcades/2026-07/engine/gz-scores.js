/*!
 * engine/gz-scores.js
 * GZ.Scores — high score persistence.
 * GZ.Player — play counts + achievements.
 *
 * All storage access is wrapped in try/catch so private-browsing modes
 * (where localStorage throws instead of just being unavailable) degrade
 * gracefully to "nothing persists this session" instead of throwing.
 */
(function () {
  'use strict';

  window.GZ = window.GZ || {};

  var KEY_SCORES = 'gza.v2.scores';
  var KEY_SETTINGS = 'gza.v2.settings';
  var KEY_PLAYER = 'gza.v2.player';

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* private mode / quota: silently drop, gameplay still works */ }
  }

  GZ.Scores = {
    high: function (slug) {
      var scores = readJSON(KEY_SCORES, {});
      return (scores[slug] && scores[slug].score) || 0;
    },

    /** Persists the new high if `score` beats it. Returns {high, isNew}. */
    submit: function (slug, score) {
      var scores = readJSON(KEY_SCORES, {});
      var prev = (scores[slug] && scores[slug].score) || 0;
      var isNew = score > prev;
      if (isNew) {
        scores[slug] = { score: score, at: Date.now() };
        writeJSON(KEY_SCORES, scores);
      }
      return { high: isNew ? score : prev, isNew: isNew };
    },

    all: function () { return readJSON(KEY_SCORES, {}); },

    isMuted: function () { return !!readJSON(KEY_SETTINGS, {}).muted; },
    setMuted: function (muted) {
      var s = readJSON(KEY_SETTINGS, {});
      s.muted = !!muted;
      writeJSON(KEY_SETTINGS, s);
    }
  };

  function readPlayer() {
    var p = readJSON(KEY_PLAYER, {});
    if (!p.plays) p.plays = {};
    if (!p.achievements) p.achievements = [];
    return p;
  }

  function grant(player, id) {
    if (player.achievements.indexOf(id) === -1) player.achievements.push(id);
  }

  GZ.Player = {
    /** Call once per game start/restart. Increments play count and grants
     *  the 'first-play' / 'played-all-16' achievements as they're earned. */
    recordPlay: function (slug) {
      var p = readPlayer();
      p.plays[slug] = (p.plays[slug] || 0) + 1;

      var totalPlays = 0;
      for (var k in p.plays) if (Object.prototype.hasOwnProperty.call(p.plays, k)) totalPlays += p.plays[k];
      if (totalPlays === 1) grant(p, 'first-play');

      var manifest = window.GZ_MANIFEST || [];
      if (manifest.length > 0) {
        var allPlayed = manifest.every(function (m) { return (p.plays[m.slug] || 0) > 0; });
        if (allPlayed) grant(p, 'played-all-16');
      }

      writeJSON(KEY_PLAYER, p);
      return p;
    },

    /** Call on game over with the final score + GZ.Scores.submit()'s isNew. */
    checkScoreAchievements: function (slug, score, isNew) {
      var p = readPlayer();
      if (score >= 10000) grant(p, 'score-10k');
      if (isNew) grant(p, 'new-record');
      writeJSON(KEY_PLAYER, p);
      return p;
    },

    get: function () { return readPlayer(); }
  };
})();
