/* ============ 疯狂赛车 I（经典）/ II（午夜狂飙）============ */
(function () {
  const U = window.GameUtil;
  const ROAD_X = 58, ROAD_W = 184, LANES = 4, LANE_W = ROAD_W / LANES;
  const CAR_W = 30, CAR_H = 46, PLAYER_Y = 424;

  function laneX(i) { return ROAD_X + LANE_W * i + (LANE_W - CAR_W) / 2; }

  function drawCar(g, x, y, color, isPlayer) {
    g.block(x, y, CAR_W, CAR_H, color);
    g.rect(x + 4, y + (isPlayer ? 8 : CAR_H - 18), CAR_W - 8, 10, '#0b0a1ecc');
    g.rect(x + 4, y + (isPlayer ? CAR_H - 16 : 8), CAR_W - 8, 8, '#ffffff33');
    if (isPlayer) {
      g.rect(x + 2, y + 1, 7, 5, '#fffbe0');
      g.rect(x + CAR_W - 9, y + 1, 7, 5, '#fffbe0');
    } else {
      g.rect(x + 2, y + CAR_H - 6, 7, 5, '#ff2222');
      g.rect(x + CAR_W - 9, y + CAR_H - 6, 7, 5, '#ff2222');
    }
  }

  function makeRacerDef(variant) {
    const isII = variant === 'ii', isIII = variant === 'iii';
    return {
      id: isIII ? 'racerIII' : isII ? 'racerII' : 'racer',
      name: isIII ? '极限方程式' : isII ? '午夜狂飙' : '疯狂赛车',
      en: isIII ? 'RACING III' : isII ? 'RACING II' : 'RACING',
      desc: isIII ? '一击即溃 · 三倍得分' : isII ? '夜间车流 · 双倍得分' : '躲开车流 · 冲得越远分越高',
      color: isIII ? '#ff4d5e' : isII ? '#b455ff' : '#ffd60a',
      music: 'racer',
      icon(g, x, y, s, t) {
        if (isII) g.rect(x, y, s * 3, s * 3, 'rgba(20,10,50,0.9)');
        g.block(x + s * 0.2, y + s * 1.4, s * 0.7, s * 1.1, '#3f8cff');
        g.block(x + s * 1.4, y + s * 0.2 + Math.sin(t * 5) * 3, s * 0.7, s * 1.1, isII ? '#b455ff' : '#ff4d5e');
        g.block(x + s * 1.1, y + s * 2.6 - Math.sin(t * 5) * 3, s * 0.7, s * 1.1, isII ? '#ffd60a' : '#ffd60a');
      },
      start(env) {
        return {
          score: 0, over: false, level: 1, speed: env.speed, hi: 0,
          lane: 1, px: laneX(1), vel: 150 + env.speed * 18,
          cars: [], spawnT: 0, lives: isIII ? 1 : isII ? 2 : 3, inv: 0, dist: 0,
          boost: 0, dash: 0, bonus: 0,
          scoreMul: isIII ? 3 : isII ? 2 : 1,
          diffMul: isIII ? 1.5 : isII ? 1.28 : 1,
        };
      },
      update(s, dt, g) {
        if (s.over) return;
        if (Input.took('left') && s.lane > 0) { s.lane--; Sound.sfx.move(); }
        if (Input.took('right') && s.lane < LANES - 1) { s.lane++; Sound.sfx.move(); }
        const targetX = laneX(s.lane);
        s.px += (targetX - s.px) * Math.min(1, dt * 14);
        s.boost = Input.held.up ? 1 : (Input.held.down ? -0.5 : 0);
        const speedMul = 1 + s.boost;
        s.vel += dt * 2.2;
        s.level = 1 + Math.floor(s.dist / 1200);
        const v = (140 + s.speed * 16 + s.level * 14 + Math.min(120, s.vel - 150)) * speedMul * s.diffMul;
        s.dist += v * dt * 0.1;
        s.score = Math.floor(s.dist * s.scoreMul) + (s.bonus || 0);
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          const lane = U.ri(LANES);
          const near = s.cars.some((c) => c.lane === lane && c.y < 120);
          if (!near) {
            s.cars.push({ lane, y: -CAR_H, hue: U.ri(5) });
            s.spawnT = Math.max(isII ? 0.26 : 0.34, (1.15 - s.level * 0.07) * (isII ? 0.75 : 1)) * (0.6 + Math.random() * 0.8);
          } else s.spawnT = 0.15;
        }
        for (let i = s.cars.length - 1; i >= 0; i--) {
          const c = s.cars[i];
          c.y += v * dt;
          if (c.y > 560) { s.cars.splice(i, 1); s.bonus = (s.bonus || 0) + 2 * s.scoreMul; continue; }
          if (s.inv <= 0 && c.lane === s.lane && Math.abs(c.y - PLAYER_Y) < CAR_H * 0.85) {
            s.lives--; s.inv = 1.6;
            Sound.sfx.crash();
            g.shake(6); g.flash('#ff3b3055', 0.55);
            g.burst(s.px + CAR_W / 2, PLAYER_Y + CAR_H / 2, '#ffd60a', 26, 170);
            s.cars.splice(i, 1);
            if (s.lives <= 0) { s.over = true; return; }
          }
        }
        s.inv = Math.max(0, s.inv - dt);
      },
      draw(s, g) {
        g.clear(isII ? '#070614' : '#0b0a1e');
        g.hud(s.score, s.hi, 'LIFE', s.lives);
        g.rect(ROAD_X, 30, ROAD_W, 470, isII ? '#0d0b22' : '#141428');
        g.frame(ROAD_X - 3, 30, ROAD_W + 6, 470, isII ? '#b455ff66' : '#ff7ab866', 3);
        s.dash = (s.dash + (140 + s.speed * 16 + s.level * 14) * 0.016 * 6) % 56;
        for (let i = 1; i < LANES; i++) {
          const x = ROAD_X + LANE_W * i - 2;
          for (let y = -56 + s.dash; y < 500; y += 56) g.rect(x, y, 4, 30, isII ? '#b455ff40' : '#ffffff30');
        }
        for (let y = (g.t * 30) % 46; y < 500; y += 46) {
          g.rect(ROAD_X - 12, y, 8, 24, isII ? '#7a2dff44' : '#30ff8e44');
          g.rect(ROAD_X + ROAD_W + 4, y + 23, 8, 24, isII ? '#7a2dff44' : '#30ff8e44');
        }
        if (isII) {
          // 夜色：车灯锥形光
          for (const c of s.cars) {
            g.block(laneX(c.lane), c.y, CAR_W, CAR_H, '#3a2050');
            g.rect(laneX(c.lane) + 2, c.y - 26, 8, 26, '#ffd60a11');
            g.rect(laneX(c.lane) + CAR_W - 10, c.y - 26, 8, 26, '#ffd60a11');
            g.rect(laneX(c.lane) + 2, c.y + CAR_H - 6, 7, 5, '#ff2222');
            g.rect(laneX(c.lane) + CAR_W - 9, c.y + CAR_H - 6, 7, 5, '#ff2222');
          }
        } else {
          const CAR_COLORS = ['#ff4d5e', '#b455ff', '#ff9f40', '#30ff8e', '#3f8cff'];
          for (const c of s.cars) drawCar(g, laneX(c.lane), c.y, CAR_COLORS[c.hue], false);
        }
        if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
          drawCar(g, s.px, PLAYER_Y, '#00e5ff', true);
          const fl = 8 + Math.random() * 10 + (s.boost > 0 ? 14 : 0);
          for (let i = 0; i < 3; i++)
            g.rect(s.px + 6 + i * 9, PLAYER_Y + CAR_H, 5, fl * (0.6 + Math.random() * 0.6), s.boost > 0 ? '#ffd60a' : '#ff7ab899');
        }
        if (s.boost > 0) g.toast('BOOST!', s.px + CAR_W / 2, PLAYER_Y - 14, '#ffd60a', 1);
      },
    };
  }

  window.registerGame(makeRacerDef('i'));
  window.registerGame(makeRacerDef('ii'));
  window.registerGame(makeRacerDef('iii'));
})();
