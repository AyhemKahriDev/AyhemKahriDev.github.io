/*!
 * games/brick-breaker/game.js
 * Brick Breaker — inspired by Breakout (1976).
 *
 * Paddle at the bottom (keyboard/touch left-right + mouse/touch drag),
 * angle-from-contact-point ball physics, a swept plane-crossing test against
 * the paddle so the ball can never tunnel through it, a 13x8 rainbow brick
 * field with silver (2-hit) and gold (indestructible) bricks from level 2/3,
 * five cycling level layouts, and six power-up capsule types.
 */
(function () {
  'use strict';

  // ---- tunable constants ---------------------------------------------------
  var COLS = 13, ROWS = 8;
  var FIELD_MARGIN_X = 14, BRICK_GAP = 3, TOP_Y = 50, ROW_GAP = 4;
  var BRICK_W = (800 - FIELD_MARGIN_X * 2 - (COLS - 1) * BRICK_GAP) / COLS;
  var BRICK_H = 16;

  var PADDLE_Y = 560;
  var PADDLE_H = 14;
  var PADDLE_BASE_W = 100;
  var PADDLE_EXPAND_W = 160;
  var PADDLE_SPEED = 480;

  var BALL_RADIUS = 7;
  var BASE_BALL_SPEED = 250;
  var MAX_BALL_SPEED = 640;
  var HIT_RAMP = 1.08;          // +8% every 10 paddle hits
  var BACKROW_RAMP = 1.08;      // +8% first time a ball reaches the back rows

  var CAPSULE_FALL_SPEED = 130;
  var CAPSULE_W = 30, CAPSULE_H = 16;
  var CAPSULE_DROP_CHANCE = 0.12;

  var LASER_SPEED = 620;
  var LASER_COOLDOWN = 0.16;

  var MODAL_DURATION = { E: 14, S: 10, L: 10, C: 14 };
  var SLOW_FACTOR = 0.58;

  var ACCENT = '#ff2ec4';

  var ROW_POINTS = [7, 7, 6, 5, 4, 3, 2, 1];
  var TIER_COLOR = { 7: '#ff3355', 6: '#ff8a00', 5: '#ffe600', 4: '#39ff6a', 3: '#00f0ff', 2: '#a94dff', 1: '#ff2ec4' };

  var CAPSULE_COLOR = { E: '#39ff6a', S: '#00f0ff', M: '#ffe600', L: '#ff3355', C: '#a94dff', '+': '#ff2ec4' };
  var CAPSULE_TABLE = [
    { k: 'E', w: 20 }, { k: 'S', w: 20 }, { k: 'M', w: 18 },
    { k: 'L', w: 18 }, { k: 'C', w: 18 }, { k: '+', w: 6 }
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function axisCrossT(v0, v1, plane) {
    var d = v1 - v0;
    if (Math.abs(d) < 1e-9) return null;
    var t = (plane - v0) / d;
    if (t < 0 || t > 1) return null;
    return t;
  }

  function pickCapsuleLetter() {
    var total = 0, i;
    for (i = 0; i < CAPSULE_TABLE.length; i++) total += CAPSULE_TABLE[i].w;
    var r = Math.random() * total;
    for (i = 0; i < CAPSULE_TABLE.length; i++) {
      r -= CAPSULE_TABLE[i].w;
      if (r <= 0) return CAPSULE_TABLE[i].k;
    }
    return CAPSULE_TABLE[0].k;
  }

  // ---- level layouts --------------------------------------------------------
  // Each returns true/false "active" for a given row/col before silver/gold
  // rules are layered on top.
  var PATTERNS = [
    function fullWall(row, col) { return true; },
    function checkerboard(row, col) { return (row + col) % 2 === 0; },
    function diamond(row, col) {
      var cr = (ROWS - 1) / 2, cc = (COLS - 1) / 2;
      var dist = Math.abs(row - cr) / cr + Math.abs(col - cc) / cc;
      return dist <= 1.05;
    },
    function fortress(row, col) {
      if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return true; // gold shell
      return (row + col) % 3 !== 0;
    },
    function columns(row, col) { return col % 3 !== 2; }
  ];

  function buildLevel(level) {
    var patternFn = PATTERNS[(level - 1) % PATTERNS.length];
    var isFortress = patternFn === PATTERNS[3];
    var bricks = [];
    var row, col;
    for (row = 0; row < ROWS; row++) {
      for (col = 0; col < COLS; col++) {
        if (!patternFn(row, col)) continue;
        var x = FIELD_MARGIN_X + col * (BRICK_W + BRICK_GAP);
        var y = TOP_Y + row * (BRICK_H + ROW_GAP);
        var tier = ROW_POINTS[row];
        var type = 'normal';
        if (isFortress && (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1)) {
          type = 'gold';
        } else if (level >= 2 && Math.random() < 0.22) {
          type = 'silver';
        }
        bricks.push({
          row: row, col: col, x: x, y: y, w: BRICK_W, h: BRICK_H,
          type: type, hp: type === 'silver' ? 2 : 1,
          points: tier, color: TIER_COLOR[tier], alive: true
        });
      }
    }
    // A few decorative indestructible obstacles from level 3 onward, outside
    // the fortress pattern (which already builds its own gold shell).
    if (level >= 3 && !isFortress) {
      var candidates = bricks.filter(function (b) { return b.type === 'normal'; });
      var goldCount = Math.min(6, Math.floor(candidates.length * 0.06) + 3);
      for (var g = 0; g < goldCount && candidates.length; g++) {
        var idx = Math.floor(Math.random() * candidates.length);
        candidates[idx].type = 'gold';
        candidates.splice(idx, 1);
      }
    }
    return bricks;
  }

  function levelBaseSpeed(level) {
    return Math.min(MAX_BALL_SPEED, BASE_BALL_SPEED * (1 + 0.05 * Math.floor((level - 1))));
  }

  function makeBall(S) {
    return {
      x: S.paddle.x, y: PADDLE_Y - BALL_RADIUS - 1,
      dx: 0, dy: -1, speed: levelBaseSpeed(S.level),
      awaitingServe: true, stuck: false, stuckOffsetX: 0, hitBack: false
    };
  }

  function resetForServe(g) {
    var S = g.state;
    S.balls = [makeBall(S)];
  }

  function endModal(g) {
    var S = g.state;
    if (S.modal === 'E') S.paddle.width = PADDLE_BASE_W;
    if (S.modal === 'C') {
      // Release any stuck balls so the game never soft-locks.
      S.balls.forEach(function (b) {
        if (b.stuck) { launchFromOffset(g, b); }
      });
    }
    S.modal = null;
    S.modalTimer = 0;
  }

  function setModal(g, letter) {
    var S = g.state;
    if (S.modal && S.modal !== letter) endModal(g);
    S.modal = letter;
    S.modalTimer = MODAL_DURATION[letter];
    if (letter === 'E') S.paddle.width = PADDLE_EXPAND_W;
    if (letter === 'L') S.laserCooldown = 0;
  }

  function launchFromOffset(g, ball) {
    var S = g.state;
    var rel = clamp(ball.stuckOffsetX / (S.paddle.width / 2), -1, 1);
    var angle = -Math.PI / 2 + rel * (Math.PI * 0.30);
    ball.dx = Math.sin(angle);
    ball.dy = -Math.abs(Math.cos(angle));
    ball.stuck = false;
    g.audio.play('bounce');
  }

  // Direction hygiene, enforced every frame: the ball must always keep at
  // least 45% of its speed vertical (shallow balls crawl the field for ages
  // — multiball splits and serve spreads could produce near-horizontal
  // directions) and a hair of horizontal so it never locks dead-vertical.
  var MIN_VERT = 0.45;
  var MIN_HORIZ = 0.08;
  function normalizeDir(ball) {
    var len = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) || 1;
    ball.dx /= len; ball.dy /= len;
    if (Math.abs(ball.dy) < MIN_VERT) {
      var sy = ball.dy < 0 ? -1 : (ball.dy > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1));
      var sx = ball.dx < 0 ? -1 : 1;
      ball.dy = sy * MIN_VERT;
      ball.dx = sx * Math.sqrt(1 - MIN_VERT * MIN_VERT);
    } else if (Math.abs(ball.dx) < MIN_HORIZ) {
      var sx2 = ball.dx < 0 ? -1 : (ball.dx > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1));
      ball.dx = sx2 * MIN_HORIZ;
      ball.dy = (ball.dy < 0 ? -1 : 1) * Math.sqrt(1 - MIN_HORIZ * MIN_HORIZ);
    }
  }

  function applyCapsule(g, letter) {
    var S = g.state;
    g.audio.play('pickup');
    if (letter === '+') {
      g.setLives(g.lives + 1);
      g.fx.text(S.paddle.x, PADDLE_Y - 24, '+1 LIFE', { color: CAPSULE_COLOR['+'], size: 12 });
      g.audio.play('powerup');
      return;
    }
    if (letter === 'M') {
      var src = S.balls.filter(function (b) { return !b.awaitingServe; })[0] || S.balls[0];
      if (src && S.balls.length < 9) {
        [-1, 1].forEach(function (sign) {
          var clone = {
            x: src.x, y: src.y, speed: src.speed,
            awaitingServe: src.awaitingServe, stuck: false, stuckOffsetX: 0, hitBack: src.hitBack
          };
          var baseAngle = Math.atan2(src.dy, src.dx);
          var a = baseAngle + sign * (Math.PI / 7);
          clone.dx = Math.cos(a); clone.dy = Math.sin(a);
          S.balls.push(clone);
        });
      }
      g.fx.text(S.paddle.x, PADDLE_Y - 24, 'MULTIBALL', { color: CAPSULE_COLOR.M, size: 10 });
      return;
    }
    setModal(g, letter);
    var labels = { E: 'EXPAND', S: 'SLOW-MO', L: 'LASER', C: 'CATCH' };
    g.fx.text(S.paddle.x, PADDLE_Y - 24, labels[letter], { color: CAPSULE_COLOR[letter], size: 10 });
    g.audio.play('powerup');
  }

  function maybeDropCapsule(g, brick) {
    var S = g.state;
    if (Math.random() > CAPSULE_DROP_CHANCE) return;
    var letter = pickCapsuleLetter();
    S.capsules.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, letter: letter, color: CAPSULE_COLOR[letter] });
  }

  function destroyBrick(g, brick, ball) {
    var S = g.state;
    brick.alive = false;
    g.addScore(brick.points * 10);
    g.fx.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, { color: brick.color, count: 14, speed: 160, life: 0.4, size: 3 });
    g.audio.play('hit');
    g.fx.text(brick.x + brick.w / 2, brick.y, '+' + (brick.points * 10), { color: brick.color, size: 8 });
    maybeDropCapsule(g, brick);
    if (ball && (brick.row === 0 || brick.row === 1) && !ball.hitBack) {
      ball.hitBack = true;
      ball.speed = Math.min(MAX_BALL_SPEED, ball.speed * BACKROW_RAMP);
    }
  }

  function hitBrick(g, brick, ball) {
    if (brick.type === 'gold') {
      g.audio.play('bounce');
      g.fx.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, { color: '#eaf6ff', count: 6, speed: 90, life: 0.25, size: 2 });
      return;
    }
    if (brick.type === 'silver') {
      brick.hp -= 1;
      if (brick.hp <= 0) { destroyBrick(g, brick, ball); }
      else { g.audio.play('hit'); g.fx.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, { color: '#c8d6e0', count: 8, speed: 110, life: 0.3, size: 2 }); }
      return;
    }
    destroyBrick(g, brick, ball);
  }

  function findBrickCollision(S, ball) {
    for (var i = 0; i < S.bricks.length; i++) {
      var b = S.bricks[i];
      if (!b.alive) continue;
      var closestX = clamp(ball.x, b.x, b.x + b.w);
      var closestY = clamp(ball.y, b.y, b.y + b.h);
      var ddx = ball.x - closestX, ddy = ball.y - closestY;
      if (ddx * ddx + ddy * ddy <= BALL_RADIUS * BALL_RADIUS) return b;
    }
    return null;
  }

  function bounceOffPaddle(g, ball, hitX) {
    var S = g.state;
    if (S.modal === 'C') {
      ball.stuck = true;
      ball.stuckOffsetX = clamp(hitX - S.paddle.x, -S.paddle.width / 2, S.paddle.width / 2);
      g.audio.play('bounce');
      return;
    }
    var rel = clamp((hitX - S.paddle.x) / (S.paddle.width / 2), -1, 1);
    // Cap deflection at 54 degrees from vertical: steeper caps (68deg+) let the
    // ball leave nearly horizontal and crawl across the field for ages.
    var angle = -Math.PI / 2 + rel * (Math.PI * 0.30);
    ball.dx = Math.sin(angle);
    ball.dy = -Math.abs(Math.cos(angle));
    S.paddleHits++;
    if (S.paddleHits % 10 === 0) ball.speed = Math.min(MAX_BALL_SPEED, ball.speed * HIT_RAMP);
    g.audio.play('bounce');
    g.fx.burst(hitX, PADDLE_Y, { color: '#eaf6ff', count: 8, speed: 130, life: 0.3, size: 2 });
  }

  function stepBall(g, ball, dt) {
    var S = g.state;
    normalizeDir(ball);
    var speedScale = S.modal === 'S' ? SLOW_FACTOR : 1;
    var speed = ball.speed * speedScale;
    var x0 = ball.x, y0 = ball.y;
    var x1 = x0 + ball.dx * speed * dt, y1 = y0 + ball.dy * speed * dt;

    // Walls: left, right, top (swept plane crossing, same technique as retro-tennis).
    var bestT = 1, hitWall = null;
    if (ball.dx < 0) { var tL = axisCrossT(x0, x1, BALL_RADIUS); if (tL !== null && tL < bestT) { bestT = tL; hitWall = 'left'; } }
    if (ball.dx > 0) { var tR = axisCrossT(x0, x1, 800 - BALL_RADIUS); if (tR !== null && tR < bestT) { bestT = tR; hitWall = 'right'; } }
    if (ball.dy < 0) { var tT = axisCrossT(y0, y1, BALL_RADIUS); if (tT !== null && tT < bestT) { bestT = tT; hitWall = 'top'; } }

    // Paddle: swept plane crossing at the paddle's top surface — this is the
    // "never tunnels" guarantee, independent of ball speed or frame rate.
    var hitPaddle = false, paddleHitX = 0;
    if (ball.dy > 0) {
      var paddlePlane = PADDLE_Y - BALL_RADIUS;
      var tP = axisCrossT(y0, y1, paddlePlane);
      if (tP !== null && tP <= bestT) {
        var xAtP = x0 + (x1 - x0) * tP;
        var half = S.paddle.width / 2;
        if (xAtP > S.paddle.x - half - BALL_RADIUS && xAtP < S.paddle.x + half + BALL_RADIUS) {
          bestT = tP; hitWall = null; hitPaddle = true; paddleHitX = clamp(xAtP, S.paddle.x - half, S.paddle.x + half);
        }
      }
    }

    ball.x = x0 + (x1 - x0) * bestT;
    ball.y = y0 + (y1 - y0) * bestT;

    if (hitPaddle) {
      bounceOffPaddle(g, ball, paddleHitX);
      return;
    }
    if (hitWall === 'left' || hitWall === 'right') {
      ball.dx = -ball.dx; ball.x += hitWall === 'left' ? 0.5 : -0.5;
      g.audio.play('bounce');
    } else if (hitWall === 'top') {
      ball.dy = -ball.dy; ball.y += 0.5;
      g.audio.play('bounce');
    }

    // Bricks: position-based circle-vs-rect test, resolved once per step.
    var brick = findBrickCollision(S, ball);
    if (brick) {
      var bcx = brick.x + brick.w / 2, bcy = brick.y + brick.h / 2;
      var ddx = ball.x - bcx, ddy = ball.y - bcy;
      if (Math.abs(ddx / brick.w) > Math.abs(ddy / brick.h)) ball.dx = -ball.dx;
      else ball.dy = -ball.dy;
      hitBrick(g, brick, ball);
    }

    if (ball.y - BALL_RADIUS > 600) ball.lost = true;
  }

  function checkLevelClear(g) {
    var S = g.state;
    var remaining = S.bricks.some(function (b) { return b.alive && b.type !== 'gold'; });
    if (remaining || S.transitionTimer > 0) return;
    S.transitionTimer = 1.6;
    S.capsules = [];
    S.laserBolts = [];
    g.addScore(500);
    g.fx.flash('#ffffff', 0.2);
    g.audio.play('levelup');
    g.fx.text(400, 300, 'LEVEL CLEAR +500', { color: '#ffe600', size: 14 });
  }

  GZ.boot({
    slug: 'brick-breaker',
    touchLayout: 'lr-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['←/→ or A/D', 'Move paddle'], ['SPACE', 'Serve / Fire laser / Release']],
    state: {},

    init: function (g) {
      var S = g.state;
      S.level = 1;
      g.setLevel(1);
      g.setLives(3);
      S.paddle = { x: 400, width: PADDLE_BASE_W };
      S.modal = null;
      S.modalTimer = 0;
      S.laserBolts = [];
      S.laserCooldown = 0;
      S.capsules = [];
      S.paddleHits = 0;
      S.transitionTimer = 0;
      S.lastPointerX = null;
      S.bricks = buildLevel(1);
      resetForServe(g);
    },

    update: function (g, dt) {
      var S = g.state;
      var input = g.input;

      if (S.transitionTimer > 0) {
        S.transitionTimer -= dt;
        if (S.transitionTimer <= 0) {
          S.level++;
          g.setLevel(S.level);
          S.bricks = buildLevel(S.level);
          S.paddle.width = PADDLE_BASE_W;
          S.modal = null;
          S.paddleHits = 0;
          resetForServe(g);
        }
        return;
      }

      // Paddle: keyboard/touch velocity, or direct follow when the pointer moves.
      var dir = 0;
      if (input.isDown('left')) dir -= 1;
      if (input.isDown('right')) dir += 1;
      if (dir !== 0) S.paddle.x += dir * PADDLE_SPEED * dt;
      var px = input.pointer.x;
      if (S.lastPointerX === null) S.lastPointerX = px;
      else if (Math.abs(px - S.lastPointerX) > 0.01) { S.paddle.x = px; S.lastPointerX = px; }
      var half = S.paddle.width / 2;
      S.paddle.x = clamp(S.paddle.x, half, 800 - half);

      // Modal power-up timer.
      if (S.modal) {
        S.modalTimer -= dt;
        if (S.modalTimer <= 0) endModal(g);
      }

      // Capsules falling.
      for (var ci = S.capsules.length - 1; ci >= 0; ci--) {
        var cap = S.capsules[ci];
        cap.y += CAPSULE_FALL_SPEED * dt;
        var withinX = cap.x > S.paddle.x - half - CAPSULE_W / 2 && cap.x < S.paddle.x + half + CAPSULE_W / 2;
        if (withinX && cap.y + CAPSULE_H / 2 >= PADDLE_Y && cap.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H) {
          applyCapsule(g, cap.letter);
          S.capsules.splice(ci, 1);
        } else if (cap.y - CAPSULE_H / 2 > 600) {
          S.capsules.splice(ci, 1);
        }
      }

      // Laser bolts.
      if (S.modal === 'L') {
        S.laserCooldown -= dt;
        if (input.isDown('a') && S.laserCooldown <= 0) {
          S.laserCooldown = LASER_COOLDOWN;
          S.laserBolts.push({ x: S.paddle.x - half + 8, y: PADDLE_Y });
          S.laserBolts.push({ x: S.paddle.x + half - 8, y: PADDLE_Y });
          g.audio.play('laser');
        }
      }
      for (var li = S.laserBolts.length - 1; li >= 0; li--) {
        var bolt = S.laserBolts[li];
        bolt.y -= LASER_SPEED * dt;
        var hit = null;
        if (bolt.y > 0) hit = findBrickCollision(S, { x: bolt.x, y: bolt.y });
        if (hit) {
          hitBrick(g, hit, null);
          S.laserBolts.splice(li, 1);
        } else if (bolt.y < 0) {
          S.laserBolts.splice(li, 1);
        }
      }

      // Balls.
      var anyServed = false;
      for (var bi = S.balls.length - 1; bi >= 0; bi--) {
        var ball = S.balls[bi];
        if (ball.stuck) {
          ball.x = S.paddle.x + ball.stuckOffsetX;
          ball.y = PADDLE_Y - BALL_RADIUS - 1;
          if (input.pressed('a')) launchFromOffset(g, ball);
          continue;
        }
        if (ball.awaitingServe) {
          ball.x = S.paddle.x;
          ball.y = PADDLE_Y - BALL_RADIUS - 1;
          if (input.pressed('a')) {
            ball.awaitingServe = false;
            var nudge = (Math.random() * 2 - 1) * 0.32;
            ball.dx = Math.sin(nudge);
            ball.dy = -Math.abs(Math.cos(nudge));
            g.audio.play('bounce');
          }
          continue;
        }
        anyServed = true;
        stepBall(g, ball, dt);
        if (ball.lost) S.balls.splice(bi, 1);
      }

      if (S.balls.length === 0) {
        var lives = g.lives - 1;
        g.setLives(lives);
        g.fx.shake(10, 0.4);
        g.audio.play('die');
        if (lives <= 0) { g.gameOver(); return; }
        S.modal = null;
        S.paddle.width = PADDLE_BASE_W;
        S.laserBolts = [];
        resetForServe(g);
        return;
      }

      if (anyServed) checkLevelClear(g);
    },

    render: function (g, ctx) {
      var S = g.state;
      var i;

      // Bricks.
      for (i = 0; i < S.bricks.length; i++) {
        var b = S.bricks[i];
        if (!b.alive) continue;
        if (b.type === 'gold') {
          g.draw.glow(ctx, '#ffe600', 8, function () {
            ctx.fillStyle = '#c9a400';
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = '#ffe600';
            ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
          });
        } else if (b.type === 'silver') {
          ctx.fillStyle = b.hp >= 2 ? '#aebfca' : '#5c6b76';
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = 'rgba(234,246,255,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
          if (b.hp < 2) {
            ctx.strokeStyle = 'rgba(10,10,20,0.6)';
            ctx.beginPath();
            ctx.moveTo(b.x + 3, b.y + b.h - 3);
            ctx.lineTo(b.x + b.w / 2, b.y + 4);
            ctx.lineTo(b.x + b.w - 3, b.y + b.h - 3);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = 'rgba(7,7,12,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        }
      }

      // Capsules.
      for (i = 0; i < S.capsules.length; i++) {
        var cap = S.capsules[i];
        ctx.fillStyle = cap.color;
        ctx.fillRect(cap.x - CAPSULE_W / 2, cap.y - CAPSULE_H / 2, CAPSULE_W, CAPSULE_H);
        g.draw.text(ctx, cap.letter, cap.x, cap.y + 4, { size: 10, color: '#07070c', align: 'center' });
      }

      // Laser bolts.
      g.draw.glow(ctx, '#ff3355', 8, function () {
        ctx.fillStyle = '#ff3355';
        for (i = 0; i < S.laserBolts.length; i++) {
          var bolt = S.laserBolts[i];
          ctx.fillRect(bolt.x - 2, bolt.y - 10, 4, 14);
        }
      });

      // Paddle.
      var half = S.paddle.width / 2;
      g.draw.glow(ctx, ACCENT, 14, function () {
        ctx.fillStyle = ACCENT;
        ctx.fillRect(S.paddle.x - half, PADDLE_Y, S.paddle.width, PADDLE_H);
      });
      if (S.modal === 'C') {
        ctx.strokeStyle = '#a94dff';
        ctx.lineWidth = 2;
        ctx.strokeRect(S.paddle.x - half - 2, PADDLE_Y - 2, S.paddle.width + 4, PADDLE_H + 4);
      }

      // Balls.
      for (i = 0; i < S.balls.length; i++) {
        var ball = S.balls[i];
        g.draw.glow(ctx, '#eaf6ff', 12, function () {
          ctx.fillStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Modal timer bar.
      if (S.modal) {
        var pct = clamp(S.modalTimer / MODAL_DURATION[S.modal], 0, 1);
        ctx.fillStyle = 'rgba(234,246,255,0.15)';
        ctx.fillRect(20, 600 - 10, 120, 5);
        ctx.fillStyle = CAPSULE_COLOR[S.modal];
        ctx.fillRect(20, 600 - 10, 120 * pct, 5);
        g.draw.text(ctx, S.modal, 20, 600 - 14, { size: 8, color: CAPSULE_COLOR[S.modal] });
      }

      if (S.transitionTimer > 0) {
        g.draw.text(ctx, 'LEVEL ' + (S.level + 1), 400, 300, { size: 26, color: '#ffe600', align: 'center', glow: true });
      } else if (g.phase === 'playing' && S.balls.some(function (b) { return b.awaitingServe; })) {
        g.draw.text(ctx, 'A / CLICK TO SERVE', 400, 340, { size: 10, color: '#ffe600', align: 'center' });
      }
    }
  });
})();
