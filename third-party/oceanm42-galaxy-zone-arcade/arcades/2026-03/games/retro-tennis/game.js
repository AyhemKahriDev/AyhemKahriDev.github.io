(function () { /* de-moduled */
'use strict';
/**
 * Retro Tennis — A Pong-inspired arcade tennis game
 * Enhanced with spin mechanics, particle effects, and AI difficulty scaling.
 */






// ── Constants ────────────────────────────────────────────────

const W = 800;
const H = 600;
const PADDLE_W = 16;
const PADDLE_H = 90;
const PADDLE_MARGIN = 40;
const BALL_SIZE = 10;
const BALL_INITIAL_SPEED = 340;
const BALL_SPEED_INCREMENT = 25;
const BALL_MAX_SPEED = 750;
const WIN_SCORE = 11;
const SERVE_DELAY = 1.2;
const POINT_PAUSE = 1.5;

// Court markings
const NET_X = W / 2;
const COURT_TOP = 30;
const COURT_BOTTOM = H - 30;
const COURT_LEFT = 20;
const COURT_RIGHT = W - 20;

// AI tuning
const AI_BASE_SPEED = 280;
const AI_REACTION_DELAY = 0.12;
const AI_ERROR_CHANCE = 0.06;

// ── HUD Elements ─────────────────────────────────────────────

const hudP1 = document.getElementById('p1-score');
const hudP2 = document.getElementById('p2-score');
const hudInfo = document.getElementById('game-info');

// ── RetroTennis Game ─────────────────────────────────────────

class RetroTennis extends GameEngine {
  constructor() {
    super('game-canvas', {
      width: W,
      height: H,
      background: '#0a1020',
    });

    this.achievements = new AchievementManager('retro-tennis');
    this.achievements.define([
      { id: 'first-rally', name: 'First Rally', description: 'Hit the ball 5 times in one rally', icon: '\uD83C\uDFBE' },
      { id: 'ace', name: 'Ace!', description: 'Score without opponent touching ball', icon: '\u26A1' },
      { id: 'marathon', name: 'Marathon Match', description: 'Play a game with 20+ total rallies in a point', icon: '\uD83C\uDFC3' },
      { id: 'spin-master', name: 'Spin Master', description: 'Score with a curved shot', icon: '\uD83C\uDF00' },
      { id: 'shutout', name: 'Shutout', description: 'Win 11-0', icon: '\uD83D\uDEE1\uFE0F' },
    ]);

    this.twoPlayer = false;
    this.menuSelection = 0; // 0 = 1P, 1 = 2P

    this._resetMatch();
    this.start();
  }

  // ── State Management ─────────────────────────────────────

  _resetMatch() {
    this.p1Score = 0;
    this.p2Score = 0;
    this.rallyCount = 0;
    this.maxRally = 0;
    this.pointHits = 0;
    this.opponentTouched = false;
    this.spinScored = false;
    this.serveTimer = 0;
    this.pointPauseTimer = 0;
    this.servingPlayer = 1;
    this.winner = 0;
    this.gamePhase = 'serve'; // serve, rally, point-pause, match-over

    this._resetPaddles();
    this._resetBall();
    this._updateHUD();
  }

  _resetPaddles() {
    this.p1 = {
      x: PADDLE_MARGIN,
      y: H / 2 - PADDLE_H / 2,
      w: PADDLE_W,
      h: PADDLE_H,
      vy: 0,
      prevY: H / 2 - PADDLE_H / 2,
    };
    this.p2 = {
      x: W - PADDLE_MARGIN - PADDLE_W,
      y: H / 2 - PADDLE_H / 2,
      w: PADDLE_W,
      h: PADDLE_H,
      vy: 0,
      prevY: H / 2 - PADDLE_H / 2,
    };
  }

  _resetBall() {
    this.ball = {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      speed: BALL_INITIAL_SPEED,
      spin: 0,
      active: false,
    };
    this.trail = [];
  }

  _serveBall() {
    const dir = this.servingPlayer === 1 ? 1 : -1;
    const angle = randomRange(-0.4, 0.4);
    this.ball.vx = Math.cos(angle) * BALL_INITIAL_SPEED * dir;
    this.ball.vy = Math.sin(angle) * BALL_INITIAL_SPEED;
    this.ball.speed = BALL_INITIAL_SPEED;
    this.ball.spin = 0;
    this.ball.active = true;
    this.pointHits = 0;
    this.opponentTouched = false;
    this.spinScored = false;
    this.gamePhase = 'rally';
  }

  // ── Engine Hooks ─────────────────────────────────────────

  onEnterState(state) {
    if (state === 'playing') {
      this._resetMatch();
      this.serveTimer = SERVE_DELAY;
      this.gamePhase = 'serve';
      this.effects.setCRT(true);
    }
    if (state === 'menu') {
      this.effects.setCRT(true);
    }
  }

  onExitState(state) {
    if (state === 'playing') {
      this.effects.setCRT(false);
    }
  }

  // Override engine start game to capture menu selection
  _startGame() {
    this.twoPlayer = this.menuSelection === 1;
    this.particles.clear();
    this.audio.play('start');
    this.setState('playing');
  }

  // ── Menu ─────────────────────────────────────────────────

  updateMenu(dt) {
    if (this.input.isPressed('UP') || this.input.isPressed('DOWN')) {
      this.menuSelection = this.menuSelection === 0 ? 1 : 0;
      this.audio.play('select');
    }
    // Allow number keys for quick select
    if (this.input.isPressed('ACTION2')) {
      this.menuSelection = 1;
      this._startGame();
    }
  }

  renderMenu(ctx) {
    // Title
    drawNeonText(ctx, 'RETRO TENNIS', W / 2, H * 0.22, 48, '#00ffaa', 18);

    // Subtitle
    ctx.save();
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#668899';
    ctx.fillText('A Galaxy Zone Arcade Original', W / 2, H * 0.32);
    ctx.restore();

    // Mode selection
    const modes = ['1 PLAYER', '2 PLAYERS'];
    ctx.save();
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < modes.length; i++) {
      const y = H * 0.44 + i * 40;
      const selected = i === this.menuSelection;
      ctx.fillStyle = selected ? '#00ffcc' : '#445566';
      const prefix = selected ? '\u25B6 ' : '  ';
      ctx.fillText(prefix + modes[i], W / 2, y);
    }
    ctx.restore();

    // Controls
    ctx.save();
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#556677';
    ctx.fillText('P1: W/S or \u2191/\u2193   |   P2: Up/Down', W / 2, H * 0.78);
    ctx.fillText('ESC to Pause', W / 2, H * 0.83);
    ctx.restore();

    // Draw decorative court lines on menu
    this._drawCourtBackground(ctx, 0.15);
  }

  // ── Game Over ────────────────────────────────────────────

  renderGameOver(ctx) {
    const winnerName = this.winner === 1 ? 'PLAYER 1' : (this.twoPlayer ? 'PLAYER 2' : 'CPU');
    const color = this.winner === 1 ? '#00ffaa' : '#ff4466';

    drawNeonText(ctx, winnerName + ' WINS!', W / 2, H * 0.28, 40, color, 14);

    ctx.save();
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.p1Score}  -  ${this.p2Score}`, W / 2, H * 0.42);
    ctx.restore();
  }

  // ── Update ───────────────────────────────────────────────

  update(dt) {
    if (this.gamePhase === 'match-over') return;

    if (this.gamePhase === 'serve') {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) {
        this._serveBall();
      }
      this._updatePaddles(dt);
      return;
    }

    if (this.gamePhase === 'point-pause') {
      this.pointPauseTimer -= dt;
      if (this.pointPauseTimer <= 0) {
        // Check for match end
        if (this.p1Score >= WIN_SCORE || this.p2Score >= WIN_SCORE) {
          this.winner = this.p1Score >= WIN_SCORE ? 1 : 2;
          this.gamePhase = 'match-over';

          // Check achievements
          if (this.winner === 1 && this.p2Score === 0) {
            this.achievements.unlock('shutout');
          }
          if (this.maxRally >= 20) {
            this.achievements.unlock('marathon');
          }

          this.gameOver();
          return;
        }
        this.serveTimer = SERVE_DELAY;
        this.gamePhase = 'serve';
        this._resetBall();
      }
      this._updatePaddles(dt);
      return;
    }

    // Rally phase
    this._updatePaddles(dt);
    this._updateBall(dt);
    this._checkCollisions();
    this._updateTrail();
  }

  _updatePaddles(dt) {
    const speed = 450;

    // Player 1 controls (left paddle)
    this.p1.prevY = this.p1.y;
    let p1Dir = 0;
    if (this.input.isDown('UP')) p1Dir -= 1;
    if (this.input.isDown('DOWN')) p1Dir += 1;
    this.p1.vy = p1Dir * speed;
    this.p1.y += this.p1.vy * dt;
    this.p1.y = clamp(this.p1.y, COURT_TOP, COURT_BOTTOM - PADDLE_H);

    // Player 2 or AI (right paddle)
    this.p2.prevY = this.p2.y;
    if (this.twoPlayer) {
      // 2P uses Arrow keys — but arrows are already mapped to UP/DOWN
      // We need raw key access. Use a custom approach via direct key listening.
      let p2Dir = 0;
      if (this._p2Up) p2Dir -= 1;
      if (this._p2Down) p2Dir += 1;
      this.p2.vy = p2Dir * speed;
    } else {
      this._updateAI(dt);
    }
    this.p2.y += this.p2.vy * dt;
    this.p2.y = clamp(this.p2.y, COURT_TOP, COURT_BOTTOM - PADDLE_H);
  }

  _updateAI(dt) {
    if (!this.ball.active) {
      // Drift toward center
      const center = H / 2 - PADDLE_H / 2;
      const diff = center - this.p2.y;
      this.p2.vy = Math.sign(diff) * Math.min(Math.abs(diff) / dt, AI_BASE_SPEED * 0.5);
      return;
    }

    // Difficulty scales with player score
    const difficulty = clamp(this.p1Score / WIN_SCORE, 0, 1);
    const aiSpeed = AI_BASE_SPEED + difficulty * 180;
    const reactionDelay = AI_REACTION_DELAY * (1 - difficulty * 0.5);
    const errorChance = AI_ERROR_CHANCE * (1 - difficulty * 0.6);

    // Only react if ball is heading toward AI
    if (this.ball.vx <= 0) {
      const center = H / 2 - PADDLE_H / 2;
      const diff = center - this.p2.y;
      this.p2.vy = Math.sign(diff) * Math.min(Math.abs(diff) / dt, aiSpeed * 0.4);
      return;
    }

    // Predict where ball will arrive at AI's x position
    const timeToReach = (this.p2.x - this.ball.x) / this.ball.vx;
    if (timeToReach < reactionDelay) {
      // Too late to react - just track ball directly
      const target = this.ball.y - PADDLE_H / 2;
      const diff = target - this.p2.y;

      // Occasional mistakes
      if (Math.random() < errorChance) {
        this.p2.vy = Math.sign(diff) * aiSpeed * 0.3;
      } else {
        this.p2.vy = Math.sign(diff) * Math.min(Math.abs(diff) / dt, aiSpeed);
      }
      return;
    }

    // Predict ball Y with bouncing
    let predY = this.ball.y + this.ball.vy * timeToReach;
    // Account for spin curve
    predY += this.ball.spin * timeToReach * 80;

    // Simulate wall bounces
    const courtHeight = COURT_BOTTOM - COURT_TOP;
    let normY = predY - COURT_TOP;
    normY = ((normY % (courtHeight * 2)) + courtHeight * 2) % (courtHeight * 2);
    if (normY > courtHeight) normY = courtHeight * 2 - normY;
    predY = normY + COURT_TOP;

    const target = predY - PADDLE_H / 2;
    const diff = target - this.p2.y;
    const move = Math.sign(diff) * Math.min(Math.abs(diff) / dt, aiSpeed);

    // Add slight randomness
    this.p2.vy = move + randomRange(-30, 30);
  }

  _updateBall(dt) {
    if (!this.ball.active) return;

    // Apply spin as curve force
    this.ball.vy += this.ball.spin * 600 * dt;
    // Dampen spin over time
    this.ball.spin *= 0.995;

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Wall bounces (top/bottom)
    if (this.ball.y - BALL_SIZE / 2 <= COURT_TOP) {
      this.ball.y = COURT_TOP + BALL_SIZE / 2;
      this.ball.vy = Math.abs(this.ball.vy);
      this.audio.play('hit', { volume: 0.3, pitch: 1.5 });
      this._spawnWallParticles(this.ball.x, COURT_TOP);
    }
    if (this.ball.y + BALL_SIZE / 2 >= COURT_BOTTOM) {
      this.ball.y = COURT_BOTTOM - BALL_SIZE / 2;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.audio.play('hit', { volume: 0.3, pitch: 1.5 });
      this._spawnWallParticles(this.ball.x, COURT_BOTTOM);
    }

    // Score detection (past paddles)
    if (this.ball.x < 0) {
      this._scorePoint(2);
    } else if (this.ball.x > W) {
      this._scorePoint(1);
    }
  }

  _checkCollisions() {
    if (!this.ball.active) return;

    // Ball vs P1 paddle
    if (this._ballHitsPaddle(this.p1)) {
      this.ball.x = this.p1.x + this.p1.w + BALL_SIZE / 2;
      this._handlePaddleHit(this.p1, 1);
    }

    // Ball vs P2 paddle
    if (this._ballHitsPaddle(this.p2)) {
      this.ball.x = this.p2.x - BALL_SIZE / 2;
      this._handlePaddleHit(this.p2, -1);
    }
  }

  _ballHitsPaddle(paddle) {
    return (
      this.ball.x - BALL_SIZE / 2 <= paddle.x + paddle.w &&
      this.ball.x + BALL_SIZE / 2 >= paddle.x &&
      this.ball.y + BALL_SIZE / 2 >= paddle.y &&
      this.ball.y - BALL_SIZE / 2 <= paddle.y + paddle.h
    );
  }

  _handlePaddleHit(paddle, dirX) {
    this.pointHits++;
    this.rallyCount++;

    // Track if opponent touched it (for ace detection)
    if (paddle === this.p2) this.opponentTouched = true;

    // Calculate hit position on paddle (-1 to 1)
    const hitPos = ((this.ball.y - paddle.y) / paddle.h) * 2 - 1;

    // Increase ball speed
    this.ball.speed = Math.min(this.ball.speed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);

    // Calculate new angle based on hit position
    const maxAngle = Math.PI * 0.35;
    const angle = hitPos * maxAngle;

    this.ball.vx = Math.cos(angle) * this.ball.speed * dirX;
    this.ball.vy = Math.sin(angle) * this.ball.speed;

    // Spin mechanic — paddle movement adds spin
    const paddleVelocity = (paddle.y - paddle.prevY);
    this.ball.spin = clamp(paddleVelocity * 0.008, -1, 1);

    if (Math.abs(this.ball.spin) > 0.3) {
      this.spinScored = true;
    }

    // Sound with pitch based on speed
    const speedRatio = this.ball.speed / BALL_MAX_SPEED;
    const pitch = 0.8 + speedRatio * 0.8;
    this.audio.play('hit', { volume: 0.6, pitch: pitch });

    // Screen shake on powerful hits
    const power = speedRatio;
    if (power > 0.5) {
      this.effects.shake(power * 6, 0.15);
    }

    // Particles at impact
    this.particles.emit(this.ball.x, this.ball.y, {
      count: 6 + Math.floor(power * 8),
      speed: 120 + power * 100,
      speedVariance: 40,
      angle: dirX > 0 ? 0 : Math.PI,
      spread: 0.6,
      life: 0.3,
      lifeVariance: 0.1,
      size: 3,
      sizeVariance: 1,
      endSize: 0,
      color: ['#00ffcc', '#00aaff', '#ffffff'],
      friction: 0.95,
    });

    // Rally achievements
    if (this.pointHits >= 5) {
      this.achievements.unlock('first-rally');
    }
    if (this.pointHits >= 20) {
      this.maxRally = Math.max(this.maxRally, this.pointHits);
    }

    // Rally crowd sound at high rally counts
    if (this.pointHits > 8 && this.pointHits % 4 === 0) {
      this.audio.play('coin', { volume: 0.2, pitch: 0.6 + this.pointHits * 0.03 });
    }
  }

  _scorePoint(player) {
    if (player === 1) {
      this.p1Score++;

      // Check ace
      if (!this.opponentTouched && this.pointHits > 0) {
        this.achievements.unlock('ace');
      }
      // Check spin score
      if (this.spinScored) {
        this.achievements.unlock('spin-master');
      }
    } else {
      this.p2Score++;
    }

    this.maxRally = Math.max(this.maxRally, this.pointHits);

    // Score sound
    this.audio.play('score', { volume: 0.8 });

    // Score explosion particles
    const sx = player === 1 ? W - 30 : 30;
    this.particles.emit(sx, H / 2, 'explosion');

    // Screen flash
    this.effects.flash(player === 1 ? '#00ff88' : '#ff4444', 0.25);
    this.effects.shake(8, 0.3);

    // Pause before next serve
    this.ball.active = false;
    this.pointPauseTimer = POINT_PAUSE;
    this.gamePhase = 'point-pause';
    this.servingPlayer = player === 1 ? 2 : 1;

    this._updateHUD();
  }

  _updateHUD() {
    hudP1.textContent = this.p1Score;
    hudP2.textContent = this.p2Score;
    const infoText = this.gamePhase === 'match-over'
      ? 'GAME OVER'
      : `RALLY: ${this.pointHits}`;
    hudInfo.textContent = infoText;
  }

  _updateTrail() {
    if (!this.ball.active) return;
    this.trail.push({ x: this.ball.x, y: this.ball.y, age: 0 });
    if (this.trail.length > 12) this.trail.shift();
    for (const t of this.trail) t.age += 0.08;

    // Emit small trail particles
    if (Math.random() < 0.4) {
      this.particles.emit(this.ball.x, this.ball.y, {
        count: 1,
        speed: 20,
        speedVariance: 10,
        angle: Math.atan2(-this.ball.vy, -this.ball.vx),
        spread: 0.3,
        life: 0.25,
        lifeVariance: 0.05,
        size: 2,
        sizeVariance: 1,
        endSize: 0,
        color: '#00ffaa',
        friction: 0.9,
      });
    }
  }

  _spawnWallParticles(x, y) {
    this.particles.emit(x, y, {
      count: 4,
      speed: 60,
      speedVariance: 30,
      angle: y <= COURT_TOP ? Math.PI / 2 : -Math.PI / 2,
      spread: 0.8,
      life: 0.2,
      lifeVariance: 0.05,
      size: 2,
      sizeVariance: 1,
      endSize: 0,
      color: ['#446688', '#668899'],
      friction: 0.9,
    });
  }

  // ── Render ───────────────────────────────────────────────

  render(ctx) {
    this._drawCourtBackground(ctx, 1);
    this._drawPaddle(ctx, this.p1, '#00ffaa');
    this._drawPaddle(ctx, this.p2, '#ff6644');
    this._drawBallTrail(ctx);
    this._drawBall(ctx);
    this._drawScores(ctx);

    if (this.gamePhase === 'serve') {
      this._drawServeIndicator(ctx);
    }
    if (this.gamePhase === 'point-pause') {
      this._drawPointScored(ctx);
    }
  }

  _drawCourtBackground(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Court boundary
    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 2;
    ctx.strokeRect(COURT_LEFT, COURT_TOP, COURT_RIGHT - COURT_LEFT, COURT_BOTTOM - COURT_TOP);

    // Center line (dashed)
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(NET_X, COURT_TOP);
    ctx.lineTo(NET_X, COURT_BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);

    // Service boxes
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    const serviceBoxW = 120;

    // Left service boxes
    ctx.strokeRect(COURT_LEFT, COURT_TOP, serviceBoxW, (COURT_BOTTOM - COURT_TOP) / 2);
    ctx.strokeRect(COURT_LEFT, H / 2, serviceBoxW, (COURT_BOTTOM - COURT_TOP) / 2);

    // Right service boxes
    ctx.strokeRect(COURT_RIGHT - serviceBoxW, COURT_TOP, serviceBoxW, (COURT_BOTTOM - COURT_TOP) / 2);
    ctx.strokeRect(COURT_RIGHT - serviceBoxW, H / 2, serviceBoxW, (COURT_BOTTOM - COURT_TOP) / 2);

    // Baseline markings
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 2;
    // Left baseline
    ctx.beginPath();
    ctx.moveTo(COURT_LEFT, COURT_TOP);
    ctx.lineTo(COURT_LEFT, COURT_BOTTOM);
    ctx.stroke();
    // Right baseline
    ctx.beginPath();
    ctx.moveTo(COURT_RIGHT, COURT_TOP);
    ctx.lineTo(COURT_RIGHT, COURT_BOTTOM);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(NET_X, H / 2, 40, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  _drawPaddle(ctx, paddle, color) {
    ctx.save();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // Main paddle body
    ctx.fillStyle = color;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(paddle.x + 3, paddle.y + 3, paddle.w - 6, paddle.h - 6);

    // Edge notches for pixel art feel
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fillRect(paddle.x + 2, paddle.y, paddle.w - 4, 2);
    ctx.fillRect(paddle.x + 2, paddle.y + paddle.h - 2, paddle.w - 4, 2);

    ctx.restore();
  }

  _drawBallTrail(ctx) {
    if (!this.ball.active || this.trail.length < 2) return;
    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (1 - t.age) * 0.4 * (i / this.trail.length);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ffaa';
      const size = BALL_SIZE * (0.4 + 0.6 * (i / this.trail.length));
      ctx.beginPath();
      ctx.arc(t.x, t.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBall(ctx) {
    if (!this.ball.active) return;
    ctx.save();

    // Outer glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;

    // Ball body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Spin indicator — small arc showing curve direction
    if (Math.abs(this.ball.spin) > 0.15) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.ball.spin > 0 ? '#ff8800' : '#00aaff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.min(Math.abs(this.ball.spin), 1);
      const spinAngle = this.ball.spin > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, BALL_SIZE / 2 + 4, spinAngle - 0.8, spinAngle + 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawScores(ctx) {
    ctx.save();

    // Big LED-style scores
    ctx.font = 'bold 72px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // P1 score (left side)
    ctx.fillStyle = 'rgba(0, 255, 170, 0.12)';
    ctx.fillText(String(this.p1Score), W * 0.25, H * 0.15);
    ctx.fillStyle = 'rgba(0, 255, 170, 0.25)';
    ctx.fillText(String(this.p1Score), W * 0.25, H * 0.15);

    // P2 score (right side)
    ctx.fillStyle = 'rgba(255, 100, 68, 0.12)';
    ctx.fillText(String(this.p2Score), W * 0.75, H * 0.15);
    ctx.fillStyle = 'rgba(255, 100, 68, 0.25)';
    ctx.fillText(String(this.p2Score), W * 0.75, H * 0.15);

    // Rally counter
    if (this.gamePhase === 'rally' && this.pointHits > 0) {
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = '#556677';
      ctx.fillText(`Rally: ${this.pointHits}`, W / 2, H - 12);
    }

    // Player labels
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#445566';
    ctx.textAlign = 'left';
    ctx.fillText('P1', PADDLE_MARGIN, COURT_TOP - 10);
    ctx.textAlign = 'right';
    ctx.fillText(this.twoPlayer ? 'P2' : 'CPU', W - PADDLE_MARGIN, COURT_TOP - 10);

    ctx.restore();
  }

  _drawServeIndicator(ctx) {
    const blink = Math.floor(performance.now() / 400) % 2 === 0;
    if (!blink) return;

    ctx.save();
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('SERVE', W / 2, H / 2);
    ctx.restore();
  }

  _drawPointScored(ctx) {
    const scorer = this.servingPlayer === 1 ? 2 : 1; // reversed — who scored last
    const text = scorer === 1 ? 'POINT P1' : (this.twoPlayer ? 'POINT P2' : 'POINT CPU');
    const color = scorer === 1 ? '#00ffaa' : '#ff6644';

    ctx.save();
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, this.pointPauseTimer * 2);
    ctx.fillText(text, W / 2, H / 2);
    ctx.restore();
  }

  // We skip the default HUD since we handle our own
  drawHUD(ctx) {
    // Intentionally empty — we draw custom HUD in render()
  }
}

// ── 2-Player Raw Key Support ─────────────────────────────────
// The InputManager maps both WASD and Arrow keys to the same actions.
// For 2P mode, we need P1 on W/S and P2 on Arrow Up/Down.
// We handle this by intercepting raw key events.

const game = new RetroTennis();

// Override input mappings for 2-player support
// P1 uses W/S (mapped to UP/DOWN by default — this is fine)
// P2 needs separate tracking since arrows also map to UP/DOWN
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp') game._p2Up = true;
  if (e.code === 'ArrowDown') game._p2Down = true;
  if (e.code === 'Digit2' && (game.state === 'menu' || game.state === 'gameover')) {
    game.menuSelection = 1;
  }
  if (e.code === 'Digit1' && (game.state === 'menu' || game.state === 'gameover')) {
    game.menuSelection = 0;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp') game._p2Up = false;
  if (e.code === 'ArrowDown') game._p2Down = false;
});

// For 2P mode, remap P1 to only W/S so arrows don't also move P1
game.input.setKeyMap({
  KeyW: 'UP',
  KeyS: 'DOWN',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Space: 'ACTION1',
  KeyZ: 'ACTION2',
  KeyX: 'ACTION3',
  Enter: 'START',
  Escape: 'PAUSE',
}, false);

})();
