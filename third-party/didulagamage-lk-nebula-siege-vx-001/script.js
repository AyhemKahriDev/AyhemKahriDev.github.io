/* ============================================================
   NEBULA SIEGE — arcade shooter
   Single-file game engine: input, entities, waves, particles,
   audio (synth via WebAudio), collisions, persistence.
   ============================================================ */

(() => {
  'use strict';

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // ---------- DOM refs ----------
  const el = {
    score: document.getElementById('hud-score'),
    wave: document.getElementById('hud-wave'),
    high: document.getElementById('hud-high'),
    livesWrap: document.getElementById('lives-icons'),
    weaponFill: document.getElementById('weapon-fill'),
    screenStart: document.getElementById('screen-start'),
    screenPause: document.getElementById('screen-pause'),
    screenOver: document.getElementById('screen-over'),
    btnStart: document.getElementById('btn-start'),
    btnResume: document.getElementById('btn-resume'),
    btnRestartPause: document.getElementById('btn-restart-pause'),
    btnRestart: document.getElementById('btn-restart'),
    overHeading: document.getElementById('over-heading'),
    overScore: document.getElementById('over-score'),
    overWave: document.getElementById('over-wave'),
    overBest: document.getElementById('over-best'),
    overBestRow: document.getElementById('over-best-row'),
    waveBanner: document.getElementById('wave-banner'),
    waveBannerText: document.getElementById('wave-banner-text'),
    touchControls: document.getElementById('touch-controls'),
    stickBase: document.getElementById('touch-stick-base'),
    stickNub: document.getElementById('touch-stick-nub'),
    fireBtn: document.getElementById('touch-fire-btn'),
  };

  const HIGH_SCORE_KEY = 'nebula-siege-highscore';

  // ---------- Audio (synthesized, no external assets) ----------
  const Audio = (() => {
    let actx = null;
    function ctxLazy() {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      return actx;
    }
    function tone(freq, dur, type = 'square', gain = 0.08, glideTo = null) {
      try {
        const ac = ctxLazy();
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ac.currentTime + dur);
        g.gain.setValueAtTime(gain, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
        osc.connect(g).connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + dur);
      } catch (e) { /* audio unavailable, fail silently */ }
    }
    function noise(dur, gain = 0.12) {
      try {
        const ac = ctxLazy();
        const bufferSize = ac.sampleRate * dur;
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const src = ac.createBufferSource();
        src.buffer = buffer;
        const g = ac.createGain();
        g.gain.setValueAtTime(gain, ac.currentTime);
        src.connect(g).connect(ac.destination);
        src.start();
      } catch (e) { /* ignore */ }
    }
    return {
      shoot: () => tone(720, 0.07, 'square', 0.05, 380),
      enemyShoot: () => tone(300, 0.09, 'sawtooth', 0.04, 160),
      hit: () => tone(180, 0.08, 'square', 0.06, 90),
      explosion: () => { noise(0.25, 0.14); tone(120, 0.3, 'sine', 0.08, 40); },
      powerup: () => { tone(500, 0.09, 'sine', 0.07, 900); },
      shieldHit: () => tone(650, 0.1, 'triangle', 0.06, 400),
      wave: () => { tone(220, 0.15, 'sine', 0.06, 440); },
      gameover: () => { tone(300, 0.4, 'sawtooth', 0.09, 60); },
    };
  })();

  // ---------- Input ----------
  const keys = new Set();
  let shootHeld = false;
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key === ' ') { shootHeld = true; e.preventDefault(); }
    if (e.key.toLowerCase() === 'p') togglePause();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    if (e.key === ' ') shootHeld = false;
  });

  // Touch controls
  let touchVec = { x: 0, y: 0 };
  let touchFiring = false;
  function setupTouch() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    el.touchControls.classList.remove('hidden');
    let stickActive = false, originX = 0, originY = 0;
    const zone = document.getElementById('touch-stick-zone');
    zone.addEventListener('touchstart', (e) => {
      stickActive = true;
      const t = e.changedTouches[0];
      const rect = zone.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      if (!stickActive) return;
      const t = e.changedTouches[0];
      let dx = t.clientX - originX, dy = t.clientY - originY;
      const max = 44;
      const dist = Math.min(Math.hypot(dx, dy), max);
      const ang = Math.atan2(dy, dx);
      dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
      el.stickNub.style.transform = `translate(${dx}px, ${dy}px)`;
      touchVec.x = dx / max; touchVec.y = dy / max;
      e.preventDefault();
    }, { passive: false });
    function endStick(e) {
      stickActive = false;
      touchVec.x = 0; touchVec.y = 0;
      el.stickNub.style.transform = 'translate(0,0)';
    }
    zone.addEventListener('touchend', endStick);
    zone.addEventListener('touchcancel', endStick);

    el.fireBtn.addEventListener('touchstart', (e) => { touchFiring = true; e.preventDefault(); }, { passive: false });
    el.fireBtn.addEventListener('touchend', (e) => { touchFiring = false; e.preventDefault(); }, { passive: false });
  }

  // ---------- Utility ----------
  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

  function circleHit(a, b) {
    return dist2(a.x, a.y, b.x, b.y) < (a.r + b.r) ** 2;
  }

  // ---------- Starfield background ----------
  let stars = [];
  function initStars() {
    stars = [];
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: rand(0, W), y: rand(0, H),
        z: rand(0.3, 1.6),
        r: rand(0.4, 1.8),
      });
    }
  }
  function updateStars(dt) {
    for (const s of stars) {
      s.y += s.z * 60 * dt;
      if (s.y > H) { s.y = -2; s.x = rand(0, W); }
    }
  }
  function drawStars() {
    for (const s of stars) {
      const alpha = clamp(s.z / 1.6, 0.15, 1);
      ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
      ctx.fillRect(s.x, s.y, s.r, s.r * 2);
    }
  }

  // ---------- Particles ----------
  let particles = [];
  function spawnExplosion(x, y, color, count = 18, speed = 160) {
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(speed * 0.2, speed);
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.3, 0.7),
        maxLife: rand(0.3, 0.7),
        r: rand(1.5, 3.5),
        color,
      });
    }
  }
  function updateParticles(dt) {
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
  }
  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Floating combat text ----------
  let floaters = [];
  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.7, vy: -40 });
  }
  function updateFloaters(dt) {
    floaters.forEach(f => { f.y += f.vy * dt; f.life -= dt; });
    floaters = floaters.filter(f => f.life > 0);
  }
  function drawFloaters() {
    ctx.font = '700 13px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life / 0.7, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Player ----------
  const player = {
    x: W / 2, y: H - 90, r: 14,
    baseSpeed: 300, speed: 300,
    vx: 0, vy: 0,
    fireRate: 0.20, // seconds between shots
    fireTimer: 0,
    hull: 3, maxHull: 3,
    invuln: 0,
    weapon: 'single', // single | spread | rapid
    weaponTimer: 0,
    overdrive: 100, // 0..100 boost meter
    boosting: false,
    alive: true,
  };

  function resetPlayer() {
    player.x = W / 2; player.y = H - 90;
    player.hull = 3; player.maxHull = 3;
    player.invuln = 2;
    player.weapon = 'single';
    player.weaponTimer = 0;
    player.overdrive = 100;
    player.fireTimer = 0;
  }

  // ---------- Bullets ----------
  let playerBullets = [];
  let enemyBullets = [];

  function firePlayerWeapon() {
    if (player.fireTimer > 0) return;
    const rate = player.weapon === 'rapid' ? 0.09 : player.fireRate;
    player.fireTimer = rate;
    Audio.shoot();
    const speed = 620;
    if (player.weapon === 'spread') {
      for (const ang of [-0.28, -0.09, 0.09, 0.28]) {
        playerBullets.push({
          x: player.x, y: player.y - 18, r: 3.5,
          vx: Math.sin(ang) * speed, vy: -Math.cos(ang) * speed,
          color: '#ff2e93',
        });
      }
    } else {
      playerBullets.push({ x: player.x - 8, y: player.y - 14, r: 3, vx: 0, vy: -speed, color: '#00f0ff' });
      playerBullets.push({ x: player.x + 8, y: player.y - 14, r: 3, vx: 0, vy: -speed, color: '#00f0ff' });
    }
  }

  // ---------- Power-ups ----------
  let powerUps = [];
  const POWERUP_TYPES = ['spread', 'rapid', 'shield', 'repair'];
  function spawnPowerUp(x, y) {
    if (Math.random() > 0.22) return; // drop chance
    const type = POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];
    powerUps.push({ x, y, r: 11, vy: 90, type, spin: 0 });
  }

  const POWERUP_COLORS = { spread: '#ff2e93', rapid: '#ffb800', shield: '#00f0ff', repair: '#5cff9d' };

  function applyPowerUp(type) {
    Audio.powerup();
    if (type === 'spread' || type === 'rapid') {
      player.weapon = type;
      player.weaponTimer = 9;
      spawnFloater(player.x, player.y - 30, type.toUpperCase(), POWERUP_COLORS[type]);
    } else if (type === 'shield') {
      player.invuln = Math.max(player.invuln, 4);
      spawnFloater(player.x, player.y - 30, 'SHIELD', POWERUP_COLORS.shield);
    } else if (type === 'repair') {
      player.hull = Math.min(player.maxHull, player.hull + 1);
      spawnFloater(player.x, player.y - 30, '+HULL', POWERUP_COLORS.repair);
    }
  }

  // ---------- Enemies ----------
  let enemies = [];
  let enemyBulletCooldownGlobal = 0;

  function makeEnemy(type, x, y, waveScale) {
    const base = {
      grunt:   { r: 15, hp: 1, speed: 90,  score: 100, color: '#8fa6ff' },
      chaser:  { r: 13, hp: 2, speed: 130, score: 150, color: '#ff6b6b' },
      shooter: { r: 16, hp: 2, speed: 60,  score: 180, color: '#c58bff' },
      boss:    { r: 46, hp: 46, speed: 40, score: 2500, color: '#ff2e93' },
    }[type];
    return {
      type, x, y, r: base.r,
      hp: Math.ceil(base.hp * waveScale), maxHp: Math.ceil(base.hp * waveScale),
      speed: base.speed, score: base.score, color: base.color,
      shootTimer: rand(0.5, 2), phase: rand(0, Math.PI * 2),
      vx: 0, vy: base.speed,
      entryY: y,
      t: 0,
    };
  }

  // ---------- Wave management ----------
  let wave = 1;
  let waveEnemiesRemaining = 0;
  let waveSpawnQueue = [];
  let waveSpawnTimer = 0;
  let waveTransition = false;
  let waveTransitionTimer = 0;
  let bossActive = false;

  function buildWave(n) {
    waveSpawnQueue = [];
    const scale = 1 + (n - 1) * 0.18;
    if (n % 5 === 0) {
      // Boss wave
      waveSpawnQueue.push({ type: 'boss', delay: 0.4 });
      bossActive = true;
    } else {
      const gruntCount = 4 + Math.floor(n * 1.2);
      const chaserCount = Math.floor(n / 2);
      const shooterCount = Math.floor(n / 3);
      let t = 0.3;
      for (let i = 0; i < gruntCount; i++) { waveSpawnQueue.push({ type: 'grunt', delay: t }); t += rand(0.35, 0.6); }
      for (let i = 0; i < chaserCount; i++) { waveSpawnQueue.push({ type: 'chaser', delay: t }); t += rand(0.5, 0.9); }
      for (let i = 0; i < shooterCount; i++) { waveSpawnQueue.push({ type: 'shooter', delay: t }); t += rand(0.6, 1.0); }
      bossActive = false;
    }
    waveEnemiesRemaining = waveSpawnQueue.length;
    waveSpawnTimer = 0;
    showWaveBanner(n);
    return scale;
  }

  let currentWaveScale = 1;

  function showWaveBanner(n) {
    el.waveBannerText.textContent = (n % 5 === 0) ? `WAVE ${n} — BOSS` : `WAVE ${n}`;
    el.waveBanner.classList.remove('hidden');
    void el.waveBanner.offsetWidth; // restart animation
    el.waveBanner.style.animation = 'none';
    requestAnimationFrame(() => { el.waveBanner.style.animation = ''; });
    Audio.wave();
  }

  function updateWaveSpawning(dt) {
    if (waveSpawnQueue.length === 0) return;
    waveSpawnTimer += dt;
    while (waveSpawnQueue.length && waveSpawnQueue[0].delay <= waveSpawnTimer) {
      const spec = waveSpawnQueue.shift();
      const x = spec.type === 'boss' ? W / 2 : rand(40, W - 40);
      const e = makeEnemy(spec.type, x, -40, currentWaveScale);
      enemies.push(e);
    }
  }

  // ---------- Game state ----------
  let state = 'start'; // start | playing | paused | over
  let score = 0;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  el.high.textContent = highScore;

  function updateLivesUI() {
    el.livesWrap.innerHTML = '';
    for (let i = 0; i < player.maxHull; i++) {
      const d = document.createElement('div');
      d.className = 'life-icon' + (i < player.hull ? '' : ' lost');
      el.livesWrap.appendChild(d);
    }
  }

  function startGame() {
    score = 0;
    wave = 1;
    enemies = []; playerBullets = []; enemyBullets = []; particles = []; powerUps = []; floaters = [];
    resetPlayer();
    currentWaveScale = buildWave(wave);
    updateLivesUI();
    el.score.textContent = '0';
    el.wave.textContent = wave;
    state = 'playing';
    el.screenStart.classList.add('hidden');
    el.screenOver.classList.add('hidden');
    el.screenPause.classList.add('hidden');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      el.screenPause.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      el.screenPause.classList.add('hidden');
    }
  }

  function endGame() {
    state = 'over';
    Audio.gameover();
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      el.overBestRow.style.display = 'flex';
      el.overHeading.textContent = 'NEW HIGH SCORE';
    } else {
      el.overHeading.textContent = 'HULL BREACHED';
    }
    el.overScore.textContent = String(score);
    el.overWave.textContent = String(wave);
    el.overBest.textContent = String(highScore);
    el.high.textContent = String(highScore);
    el.screenOver.classList.remove('hidden');
  }

  function addScore(v) {
    score += v;
    el.score.textContent = String(score);
  }

  // ---------- Update loop ----------
  let lastTime = performance.now();

  function updatePlayer(dt) {
    if (!player.alive) return;
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    mx += touchVec.x; my += touchVec.y;
    mx = clamp(mx, -1, 1); my = clamp(my, -1, 1);

    const boosting = (keys.has('shift') && player.overdrive > 0);
    player.boosting = boosting;
    const speed = boosting ? player.baseSpeed * 1.7 : player.baseSpeed;
    if (boosting) player.overdrive = clamp(player.overdrive - dt * 55, 0, 100);
    else player.overdrive = clamp(player.overdrive + dt * 22, 0, 100);
    el.weaponFill.style.width = player.overdrive + '%';

    const len = Math.hypot(mx, my) || 1;
    player.x += (mx / len) * speed * dt * (Math.hypot(mx, my) > 0 ? 1 : 0);
    player.y += (my / len) * speed * dt * (Math.hypot(mx, my) > 0 ? 1 : 0);
    player.x = clamp(player.x, 20, W - 20);
    player.y = clamp(player.y, 20, H - 20);

    player.fireTimer = Math.max(0, player.fireTimer - dt);
    if (shootHeld || touchFiring) firePlayerWeapon();

    if (player.weaponTimer > 0) {
      player.weaponTimer -= dt;
      if (player.weaponTimer <= 0) player.weapon = 'single';
    }
    if (player.invuln > 0) player.invuln -= dt;
  }

  function updateBullets(dt) {
    playerBullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    playerBullets = playerBullets.filter(b => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20);

    enemyBullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    enemyBullets = enemyBullets.filter(b => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20);
  }

  function enemyShoot(e, angAtPlayer) {
    Audio.enemyShoot();
    const speed = 220;
    enemyBullets.push({
      x: e.x, y: e.y + e.r, r: 4,
      vx: Math.sin(angAtPlayer) * speed,
      vy: Math.cos(angAtPlayer) * speed,
      color: '#ff5c5c',
    });
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      e.t += dt;
      if (e.type === 'grunt') {
        e.x += Math.sin(e.t * 1.4 + e.phase) * 40 * dt;
        e.y += e.speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 0 && e.y < H * 0.7) {
          e.shootTimer = rand(1.4, 2.6);
          const ang = Math.atan2(player.x - e.x, player.y - e.y);
          enemyShoot(e, ang);
        }
      } else if (e.type === 'chaser') {
        const ang = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt * 0.85 + 20 * dt;
      } else if (e.type === 'shooter') {
        if (e.y < 130) e.y += e.speed * dt;
        else e.x += Math.sin(e.t * 0.9 + e.phase) * 60 * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 40) {
          e.shootTimer = rand(1.0, 1.8);
          const ang = Math.atan2(player.x - e.x, player.y - e.y);
          enemyShoot(e, ang);
        }
      } else if (e.type === 'boss') {
        if (e.y < 110) e.y += 60 * dt;
        else e.x = W / 2 + Math.sin(e.t * 0.6) * (W / 2 - 90);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 90) {
          e.shootTimer = rand(0.35, 0.55);
          for (const off of [-0.35, 0, 0.35]) {
            const ang = Math.atan2(player.x - e.x, player.y - e.y) + off;
            enemyShoot(e, ang);
          }
        }
      }
      e.x = clamp(e.x, e.r, W - e.r);
    }
  }

  function updatePowerUps(dt) {
    powerUps.forEach(p => { p.y += p.vy * dt; p.spin += dt * 4; });
    powerUps = powerUps.filter(p => p.y < H + 20);
  }

  function damagePlayer(amount) {
    if (player.invuln > 0) { Audio.shieldHit(); return; }
    player.hull -= amount;
    player.invuln = 1.1;
    updateLivesUI();
    spawnExplosion(player.x, player.y, '#ff3b5c', 14, 140);
    Audio.hit();
    if (player.hull <= 0) {
      player.alive = false;
      spawnExplosion(player.x, player.y, '#00f0ff', 40, 260);
      endGame();
    }
  }

  function killEnemy(e) {
    spawnExplosion(e.x, e.y, e.color, e.type === 'boss' ? 60 : 16, e.type === 'boss' ? 300 : 150);
    Audio.explosion();
    addScore(e.score);
    spawnFloater(e.x, e.y - e.r, '+' + e.score, '#ffe28a');
    spawnPowerUp(e.x, e.y);
    if (e.type === 'boss') bossActive = false;
  }

  function checkCollisions() {
    // player bullets vs enemies
    for (const b of playerBullets) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
          e.hp -= 1;
          b.hit = true;
          spawnExplosion(b.x, b.y, '#9fe8ff', 4, 60);
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
    }
    playerBullets = playerBullets.filter(b => !b.hit);
    enemies = enemies.filter(e => e.hp > 0);

    // enemy bullets vs player
    if (player.alive) {
      for (const b of enemyBullets) {
        if (dist2(b.x, b.y, player.x, player.y) < (b.r + player.r) ** 2) {
          b.hit = true;
          damagePlayer(1);
        }
      }
      enemyBullets = enemyBullets.filter(b => !b.hit);

      // enemies vs player (ram damage)
      for (const e of enemies) {
        if (dist2(e.x, e.y, player.x, player.y) < (e.r + player.r) ** 2) {
          damagePlayer(e.type === 'boss' ? 1 : 1);
          e.hp -= 3;
          if (e.hp <= 0) killEnemy(e);
        }
      }
      enemies = enemies.filter(e => e.hp > 0);

      // power-ups vs player
      for (const p of powerUps) {
        if (dist2(p.x, p.y, player.x, player.y) < (p.r + player.r) ** 2) {
          p.hit = true;
          applyPowerUp(p.type);
        }
      }
      powerUps = powerUps.filter(p => !p.hit);
    }
  }

  function checkWaveComplete() {
    if (waveSpawnQueue.length === 0 && enemies.length === 0 && !waveTransition) {
      waveTransition = true;
      waveTransitionTimer = 1.4;
    }
  }

  function updateWaveTransition(dt) {
    if (!waveTransition) return;
    waveTransitionTimer -= dt;
    if (waveTransitionTimer <= 0) {
      wave += 1;
      el.wave.textContent = wave;
      currentWaveScale = buildWave(wave);
      waveTransition = false;
    }
  }

  function update(dt) {
    updateStars(dt);
    if (state !== 'playing') { updateParticles(dt); updateFloaters(dt); return; }
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updatePowerUps(dt);
    updateWaveSpawning(dt);
    checkCollisions();
    updateParticles(dt);
    updateFloaters(dt);
    checkWaveComplete();
    updateWaveTransition(dt);
  }

  // ---------- Draw ----------
  function drawShip(x, y, r, hue, thrusting) {
    ctx.save();
    ctx.translate(x, y);
    // thrust flame
    if (thrusting) {
      ctx.fillStyle = 'rgba(0, 220, 255, 0.55)';
      ctx.beginPath();
      ctx.moveTo(-6, r * 0.7);
      ctx.lineTo(0, r * 0.7 + rand(10, 20));
      ctx.lineTo(6, r * 0.7);
      ctx.fill();
    }
    ctx.fillStyle = hue;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, r * 0.8);
    ctx.lineTo(0, r * 0.35);
    ctx.lineTo(-r * 0.8, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    if (!player.alive) return;
    const flicker = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
    if (flicker) ctx.globalAlpha = 0.35;
    drawShip(player.x, player.y, player.r, '#00f0ff', keys.has('w') || keys.has('arrowup') || touchVec.y < -0.1 || true);
    if (player.invuln > 0) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBullets() {
    for (const b of playerBullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const b of enemyBullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawEnemies() {
    for (const e of enemies) {
      if (e.type === 'boss') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#2a0f24';
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r, 0);
        ctx.lineTo(e.r * 0.6, e.r);
        ctx.lineTo(-e.r * 0.6, e.r);
        ctx.lineTo(-e.r, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        // boss hp bar
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.x - 60, e.y - e.r - 16, 120, 6);
        ctx.fillStyle = '#ff2e93';
        ctx.fillRect(e.x - 60, e.y - e.r - 16, 120 * pct, 6);
      } else {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(Math.PI);
        ctx.fillStyle = e.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r * 0.8, e.r * 0.8);
        ctx.lineTo(0, e.r * 0.35);
        ctx.lineTo(-e.r * 0.8, e.r * 0.8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPowerUps() {
    for (const p of powerUps) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.strokeStyle = POWERUP_COLORS[p.type];
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawStars();
    drawPowerUps();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawParticles();
    drawFloaters();
  }

  // ---------- Main loop ----------
  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- UI wiring ----------
  el.btnStart.addEventListener('click', startGame);
  el.btnRestart.addEventListener('click', startGame);
  el.btnRestartPause.addEventListener('click', startGame);
  el.btnResume.addEventListener('click', togglePause);

  initStars();
  setupTouch();
  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(loop); });
})();
