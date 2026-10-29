/*!
 * games/retro-tennis/game.js
 * Retro Tennis — the reference game for Sal's Galaxy Zone Arcade, inspired
 * by Pong (1972). This file is the canonical example other games are built
 * against: it is a single IIFE, touches nothing but the `g` handle GZ.boot()
 * hands it, and every bit of motion is scaled by `dt`.
 *
 * Mechanics: player paddle on the left (keyboard/touch), AI paddle on the
 * right with capped speed + reaction delay + rubber-banding. The ball uses
 * swept (continuous) collision so it can never tunnel through a paddle even
 * after many rally speed-ups. First to 11 points wins; g.score is a richer
 * derived total (100 per point + a rally-length bonus) so the persisted
 * high score means something beyond "11".
 */
(function () {
  'use strict';

  // ---- tunable constants ---------------------------------------------------
  var PADDLE_W = 14;
  var PADDLE_H = 90;
  var PADDLE_MARGIN = 28;      // gap from the field edge to the paddle's outer edge
  var BALL_RADIUS = 8;
  var PLAYER_SPEED = 420;      // px/s
  var AI_BASE_SPEED = 350;     // px/s, intentionally a hair under the player's cap
  var AI_BASE_REACTION = 0.16; // seconds between AI re-reads of the ball
  var BASE_BALL_SPEED = 340;
  var MAX_BALL_SPEED = 820;
  var SPEED_INCREMENT = 1.055; // per paddle hit
  var MAX_BOUNCE_VY = 520;     // vertical speed achievable from an edge hit
  var ENGLISH_FACTOR = 0.22;   // fraction of the paddle's own velocity added to the ball
  var WIN_SCORE = 11;
  var TRAIL_LEN = 6;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** Returns the fraction t in [0,1] at which the segment v0->v1 crosses `plane`, or null. */
  function axisCrossT(v0, v1, plane) {
    var d = v1 - v0;
    if (Math.abs(d) < 1e-9) return null;
    var t = (plane - v0) / d;
    if (t < 0 || t > 1) return null;
    return t;
  }

  function resetRound(S) {
    S.ballX = 400; S.ballY = 300;
    S.ballVX = 0; S.ballVY = 0;
    S.ballSpeed = BASE_BALL_SPEED;
    S.awaitingServe = true;
    S.rallyHits = 0;
  }

  function launchServe(g) {
    var S = g.state;
    S.awaitingServe = false;
    S.rallyHits = 0;
    S.ballSpeed = BASE_BALL_SPEED;
    var toward = Math.random() < 0.5 ? -1 : 1;
    var vy = (Math.random() * 2 - 1) * 160;
    var vx = Math.sqrt(Math.max(0, S.ballSpeed * S.ballSpeed - vy * vy)) * toward;
    S.ballVX = vx;
    S.ballVY = vy;
    g.audio.play('bounce');
  }

  function updateAI(g, dt) {
    var S = g.state;
    S.aiReactionTimer -= dt;
    var behind = S.aiScore - S.playerScore; // > 0 when the player is losing
    var ease = clamp(behind * 0.03, 0, 0.3);
    if (S.aiReactionTimer <= 0) {
      S.aiReactionTimer = AI_BASE_REACTION * (1 + ease);
      var noise = (Math.random() * 2 - 1) * (26 + ease * 50);
      S.aiTargetY = S.ballY + noise;
    }
    var targetY = S.ballVX > 0 ? S.aiTargetY : 300; // drift to center when the ball is coming from the AI's own hit
    var speed = AI_BASE_SPEED * (1 - ease);
    var oldY = S.aiY;
    if (S.aiY < targetY - 4) S.aiY = Math.min(targetY, S.aiY + speed * dt);
    else if (S.aiY > targetY + 4) S.aiY = Math.max(targetY, S.aiY - speed * dt);
    S.aiY = clamp(S.aiY, PADDLE_H / 2, 600 - PADDLE_H / 2);
    S.aiVY = dt > 0 ? (S.aiY - oldY) / dt : 0;
  }

  function paddleBounce(g, side) {
    var S = g.state;
    var paddleY = side === 'player' ? S.playerY : S.aiY;
    var paddleVY = side === 'player' ? S.playerVY : S.aiVY;
    var rel = clamp((S.ballY - paddleY) / (PADDLE_H / 2), -1, 1);
    S.ballSpeed = Math.min(MAX_BALL_SPEED, S.ballSpeed * SPEED_INCREMENT);
    // Clamp vy to a fraction of the CURRENT ball speed (not the global max):
    // an edge hit plus english could otherwise exceed ballSpeed, which made
    // newVx collapse to 0 and the ball bounce vertically forever.
    var vyCap = S.ballSpeed * 0.72;
    var newVy = clamp(rel * MAX_BOUNCE_VY + paddleVY * ENGLISH_FACTOR, -vyCap, vyCap);
    var dirSign = side === 'player' ? 1 : -1;
    var newVx = Math.sqrt(Math.max(0, S.ballSpeed * S.ballSpeed - newVy * newVy)) * dirSign;
    S.ballVX = newVx;
    S.ballVY = newVy;
    S.ballX += dirSign * 0.6; // nudge off the paddle plane so we don't re-collide next segment
    S.rallyHits++;
    g.audio.play('bounce');
    g.fx.burst(S.ballX, S.ballY, { color: side === 'player' ? '#eaf6ff' : '#ff2ec4', count: 10, speed: 150, life: 0.35, size: 3 });
  }

  /** Advances the ball up to `dt` seconds, stopping at (and reflecting off) the
   *  first wall/paddle it crosses. Returns the seconds actually consumed. */
  function simulateSegment(g, dt) {
    var S = g.state;
    var x0 = S.ballX, y0 = S.ballY;
    var vx = S.ballVX, vy = S.ballVY;
    var x1 = x0 + vx * dt, y1 = y0 + vy * dt;

    var bestT = 1, hit = null;

    if (vy < 0) { var tTop = axisCrossT(y0, y1, BALL_RADIUS); if (tTop !== null && tTop < bestT) { bestT = tTop; hit = 'top'; } }
    if (vy > 0) { var tBot = axisCrossT(y0, y1, 600 - BALL_RADIUS); if (tBot !== null && tBot < bestT) { bestT = tBot; hit = 'bottom'; } }

    if (vx < 0) {
      var playerPlane = PADDLE_MARGIN + PADDLE_W + BALL_RADIUS;
      var tP = axisCrossT(x0, x1, playerPlane);
      if (tP !== null && tP < bestT) {
        var yAtP = y0 + (y1 - y0) * tP;
        if (yAtP > S.playerY - PADDLE_H / 2 - BALL_RADIUS && yAtP < S.playerY + PADDLE_H / 2 + BALL_RADIUS) {
          bestT = tP; hit = 'player';
        }
      }
    }
    if (vx > 0) {
      var aiPlane = 800 - PADDLE_MARGIN - PADDLE_W - BALL_RADIUS;
      var tA = axisCrossT(x0, x1, aiPlane);
      if (tA !== null && tA < bestT) {
        var yAtA = y0 + (y1 - y0) * tA;
        if (yAtA > S.aiY - PADDLE_H / 2 - BALL_RADIUS && yAtA < S.aiY + PADDLE_H / 2 + BALL_RADIUS) {
          bestT = tA; hit = 'ai';
        }
      }
    }

    S.ballX = x0 + (x1 - x0) * bestT;
    S.ballY = y0 + (y1 - y0) * bestT;

    if (!hit) return dt;

    if (hit === 'top' || hit === 'bottom') {
      S.ballVY = -S.ballVY;
      S.ballY += hit === 'top' ? 0.5 : -0.5;
      g.audio.play('bounce');
      g.fx.burst(S.ballX, S.ballY, { color: '#eaf6ff', count: 6, speed: 90, life: 0.3, size: 2 });
    } else {
      paddleBounce(g, hit);
    }
    return dt * bestT;
  }

  function sweepBall(g, dt) {
    var remaining = dt, iterations = 0;
    while (remaining > 1e-6 && iterations < 6) {
      remaining -= simulateSegment(g, remaining);
      iterations++;
    }
  }

  function awardPoint(g, side) {
    var S = g.state;
    if (side === 'player') {
      S.playerScore++;
      var bonus = Math.min(S.rallyHits, 20) * 10;
      g.addScore(100 + bonus);
      if (bonus > 0) g.fx.text(400, 260, '+' + (100 + bonus), { color: '#ffe600', size: 12 });
      g.audio.play('explode');
      g.fx.flash('#39ff6a', 0.15);
    } else {
      S.aiScore++;
      g.audio.play('explode');
      g.fx.flash('#ff3355', 0.15);
      g.fx.shake(8, 0.25);
    }

    if (!S.matchPointFired && Math.max(S.playerScore, S.aiScore) >= WIN_SCORE - 1) {
      S.matchPointFired = true;
      g.audio.play('levelup');
    }

    if (S.playerScore >= WIN_SCORE || S.aiScore >= WIN_SCORE) {
      g.gameOver();
      return;
    }
    resetRound(S);
  }

  GZ.boot({
    slug: 'retro-tennis',
    touchLayout: 'lr-ud-a',
    hud: ['score'],
    controlsHelp: [['↑/↓ or W/S', 'Move paddle'], ['SPACE', 'Serve']],
    state: {},

    init: function (g) {
      var S = g.state;
      S.playerY = 300; S.aiY = 300;
      S.playerVY = 0; S.aiVY = 0;
      S.playerScore = 0; S.aiScore = 0;
      S.aiReactionTimer = AI_BASE_REACTION;
      S.aiTargetY = 300;
      S.matchPointFired = false;
      S.ballTrail = [];
      resetRound(S);
    },

    update: function (g, dt) {
      var S = g.state;
      var input = g.input;

      var dir = 0;
      if (input.isDown('up')) dir -= 1;
      if (input.isDown('down')) dir += 1;
      S.playerVY = dir * PLAYER_SPEED;
      S.playerY = clamp(S.playerY + S.playerVY * dt, PADDLE_H / 2, 600 - PADDLE_H / 2);

      updateAI(g, dt);

      if (S.awaitingServe) {
        if (input.pressed('a')) launchServe(g);
        return;
      }

      sweepBall(g, dt);

      if (S.ballX < -BALL_RADIUS * 2) awardPoint(g, 'player');
      else if (S.ballX > 800 + BALL_RADIUS * 2) awardPoint(g, 'ai');
    },

    render: function (g, ctx) {
      var S = g.state;

      // center dashed line
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 246, 255, 0.25)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(400, 0);
      ctx.lineTo(400, 600);
      ctx.stroke();
      ctx.restore();

      // big center-line score digits
      g.draw.text(ctx, String(S.playerScore), 340, 90, { size: 42, color: 'rgba(234,246,255,0.5)', align: 'right', glow: true });
      g.draw.text(ctx, String(S.aiScore), 460, 90, { size: 42, color: 'rgba(255,46,196,0.5)', align: 'left', glow: true });

      // paddles
      g.draw.glow(ctx, '#eaf6ff', 14, function () {
        ctx.fillStyle = '#eaf6ff';
        ctx.fillRect(PADDLE_MARGIN, S.playerY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      });
      g.draw.glow(ctx, '#ff2ec4', 14, function () {
        ctx.fillStyle = '#ff2ec4';
        ctx.fillRect(800 - PADDLE_MARGIN - PADDLE_W, S.aiY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      });

      // ball trail (visual only, capped ring buffer)
      S.ballTrail.push({ x: S.ballX, y: S.ballY });
      if (S.ballTrail.length > TRAIL_LEN) S.ballTrail.shift();
      for (var i = 0; i < S.ballTrail.length; i++) {
        var p = S.ballTrail[i];
        ctx.globalAlpha = ((i + 1) / S.ballTrail.length) * 0.45;
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL_RADIUS * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      g.draw.glow(ctx, '#ffe600', 16, function () {
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.arc(S.ballX, S.ballY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });

      if (S.awaitingServe && g.phase === 'playing') {
        g.draw.text(ctx, 'PRESS SPACE TO SERVE', 400, 340, { size: 10, color: '#ffe600', align: 'center' });
      }
    }
  });
})();
