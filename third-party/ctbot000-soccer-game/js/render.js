// Canvas presentation. Everything here reads the simulation and draws it;
// nothing here changes it. Effects expire on the wall clock, never on frame
// counts, so a throttled tab cannot freeze confetti on the screen.

import { WORLD, FIELD, GOAL, PENALTY_AREA, GOAL_AREA, PENALTY_SPOT,
         CENTER_CIRCLE_R, CORNER_R, PLAYER_R, BALL_R } from './constants.js';
import { clamp } from './util.js';

const GRASS_DARK = '#2c7a3f';
const GRASS_LIGHT = '#348a47';
const LINE = 'rgba(255,255,255,0.82)';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  const particles = [];
  let shakeUntil = 0, shakeMag = 0;
  let flash = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    view.dpr = dpr;
    view.scale = Math.min(w / WORLD.w, h / WORLD.h);
    view.ox = (w - WORLD.w * view.scale) / 2;
    view.oy = (h - WORLD.h * view.scale) / 2;
  }

  /* --------------------------------------------------------------- effects */

  function burst(x, y, count, opts = {}) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 90) * (0.35 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp + (opts.vx || 0),
        vy: Math.sin(a) * sp + (opts.vy || 0),
        r: (opts.r || 3) * (0.6 + Math.random() * 0.8),
        color: opts.colors ? opts.colors[(Math.random() * opts.colors.length) | 0] : 'rgba(255,255,255,0.8)',
        born: now,
        die: now + (opts.life || 500) * (0.7 + Math.random() * 0.6),
        gravity: opts.gravity || 0,
        drag: opts.drag ?? 2.4,
      });
    }
  }

  function shake(mag, ms) {
    shakeMag = Math.max(shakeMag, mag);
    shakeUntil = Math.max(shakeUntil, performance.now() + ms);
  }

  function flashScreen(color, ms) {
    flash = { color, born: performance.now(), die: performance.now() + ms };
  }

  /** Turn simulation events into things you can see. */
  function handleEvents(events, state) {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          burst(e.x, e.y, 8, { speed: 120, r: 2.6, life: 340, colors: ['rgba(255,255,255,0.75)'] });
          break;
        case 'pass':
        case 'clear':
          burst(e.x, e.y, 5, { speed: 70, r: 2.2, life: 280 });
          break;
        case 'tackle':
          burst(e.x, e.y, 12, { speed: 110, r: 2.8, life: 420, colors: ['rgba(255,255,255,0.55)', 'rgba(210,255,210,0.6)'] });
          shake(3, 140);
          break;
        case 'save':
          burst(e.x, e.y, 14, { speed: 130, r: 3, life: 480, colors: ['rgba(255,255,255,0.85)'] });
          shake(4, 180);
          break;
        case 'post':
          shake(7, 260);
          burst(e.x, e.y, 10, { speed: 150, r: 2.6, life: 400 });
          break;
        case 'goal': {
          const team = state.teams[e.team];
          shake(12, 620);
          flashScreen(team.kit, 380);
          const [gx, gy] = [team.dir > 0 ? FIELD.right : FIELD.left, FIELD.cy];
          burst(gx, gy, 90, {
            speed: 320, r: 4.5, life: 2200, gravity: 260, drag: 1.1,
            colors: [team.kit, team.kit2, '#ffffff', '#ffe9a8'],
          });
          break;
        }
        default:
          break;
      }
    }
  }

  function stepParticles(now, dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (now >= p.die) { particles.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function clearEffects() {
    particles.length = 0;
    flash = null;
    shakeUntil = 0;
  }

  /* ---------------------------------------------------------------- pitch */

  function drawPitch() {
    ctx.fillStyle = '#123a20';
    ctx.fillRect(-WORLD.w, -WORLD.h, WORLD.w * 3, WORLD.h * 3);

    const bands = 10;
    const bw = FIELD.w / bands;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? GRASS_LIGHT : GRASS_DARK;
      ctx.fillRect(FIELD.left + i * bw, FIELD.top, bw + 0.5, FIELD.h);
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';

    ctx.strokeRect(FIELD.left, FIELD.top, FIELD.w, FIELD.h);

    ctx.beginPath();
    ctx.moveTo(FIELD.cx, FIELD.top);
    ctx.lineTo(FIELD.cx, FIELD.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, CENTER_CIRCLE_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = LINE;
    ctx.fill();

    for (const side of [-1, 1]) {
      const gl = side < 0 ? FIELD.left : FIELD.right;
      const inward = -side;

      ctx.strokeRect(
        side < 0 ? FIELD.left : FIELD.right - PENALTY_AREA.depth, FIELD.cy - PENALTY_AREA.halfHeight,
        PENALTY_AREA.depth, PENALTY_AREA.halfHeight * 2,
      );
      ctx.strokeRect(
        side < 0 ? FIELD.left : FIELD.right - GOAL_AREA.depth, FIELD.cy - GOAL_AREA.halfHeight,
        GOAL_AREA.depth, GOAL_AREA.halfHeight * 2,
      );

      const spot = gl + inward * PENALTY_SPOT;
      ctx.beginPath();
      ctx.arc(spot, FIELD.cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // The D: the arc of the centre circle radius that sits outside the box.
      const boxEdge = gl + inward * PENALTY_AREA.depth;
      const dx = Math.abs(boxEdge - spot);
      if (dx < CENTER_CIRCLE_R) {
        const a = Math.acos(dx / CENTER_CIRCLE_R);
        ctx.beginPath();
        if (side < 0) ctx.arc(spot, FIELD.cy, CENTER_CIRCLE_R, -a, a);
        else ctx.arc(spot, FIELD.cy, CENTER_CIRCLE_R, Math.PI - a, Math.PI + a);
        ctx.stroke();
      }

      for (const cy of [FIELD.top, FIELD.bottom]) {
        ctx.beginPath();
        const start = side < 0 ? (cy === FIELD.top ? 0 : -Math.PI / 2) : (cy === FIELD.top ? Math.PI / 2 : Math.PI);
        ctx.arc(gl, cy, CORNER_R, start, start + Math.PI / 2);
        ctx.stroke();
      }
    }
  }

  function drawGoals(state) {
    for (const side of [-1, 1]) {
      const gl = side < 0 ? FIELD.left : FIELD.right;
      const outward = side;
      const x0 = Math.min(gl, gl + outward * GOAL.depth);
      const y0 = FIELD.cy - GOAL.halfHeight;
      const w = GOAL.depth, h = GOAL.halfHeight * 2;

      ctx.fillStyle = 'rgba(12,26,16,0.45)';
      ctx.fillRect(x0, y0, w, h);

      // Netting
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x0 + w; x += 9) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); }
      for (let y = y0; y <= y0 + h; y += 9) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = GOAL.postR * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gl, y0);
      ctx.lineTo(gl, y0 + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gl, y0); ctx.lineTo(gl + outward * GOAL.depth, y0);
      ctx.moveTo(gl, y0 + h); ctx.lineTo(gl + outward * GOAL.depth, y0 + h);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  /* -------------------------------------------------------------- players */

  function drawShadow(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.28, y + r * 0.42, r * 1.02, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state, p, now) {
    const team = state.teams[p.team];
    const kit = p.role === 'GK' ? team.gk : team.kit;
    const trim = p.role === 'GK' ? '#1c2128' : team.kit2;
    const stunned = state.time < p.stunUntil;

    drawShadow(p.x, p.y, PLAYER_R);

    if (p.i === state.controlled) {
      const pulse = 0.55 + 0.45 * Math.sin(now / 190);
      ctx.strokeStyle = `rgba(255,246,150,${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + PLAYER_R * 0.35, PLAYER_R * 1.65, PLAYER_R * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = kit;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();

    // Facing wedge, so you can read where a player is about to strike it.
    const a = Math.atan2(p.fy, p.fx);
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * PLAYER_R * 1.5, p.y + Math.sin(a) * PLAYER_R * 1.5);
    ctx.lineTo(p.x + Math.cos(a + 0.95) * PLAYER_R * 0.8, p.y + Math.sin(a + 0.95) * PLAYER_R * 0.8);
    ctx.lineTo(p.x + Math.cos(a - 0.95) * PLAYER_R * 0.8, p.y + Math.sin(a - 0.95) * PLAYER_R * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = stunned ? 'rgba(255,120,120,0.95)' : trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = p.role === 'GK' ? '#12161c' : team.text;
    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.num), p.x, p.y + 0.5);
  }

  function drawBall(state, now) {
    const b = state.ball;
    drawShadow(b.x, b.y, BALL_R);

    ctx.fillStyle = '#fbfbfb';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Panels drawn as one path so overlaps stay a flat silhouette.
    ctx.fillStyle = 'rgba(24,26,30,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = b.roll * 0.5 + (i * Math.PI * 2) / 5;
      const rr = BALL_R * 0.52;
      ctx.moveTo(b.x + Math.cos(a) * rr + BALL_R * 0.22, b.y + Math.sin(a) * rr);
      ctx.arc(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, BALL_R * 0.22, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(30,30,30,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawParticles() {
    const now = performance.now();
    for (const p of particles) {
      const t = 1 - (now - p.born) / (p.die - p.born);
      ctx.globalAlpha = clamp(t, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ draw */

  function draw(state, now, frameDt) {
    stepParticles(now, Math.min(frameDt, 0.05));
    resize();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let sx = 0, sy = 0;
    if (now < shakeUntil) {
      const left = (shakeUntil - now) / 600;
      sx = (Math.random() - 0.5) * shakeMag * left * 2;
      sy = (Math.random() - 0.5) * shakeMag * left * 2;
    } else {
      shakeMag = 0;
    }

    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + sx * view.scale, view.oy + sy * view.scale);

    drawPitch();
    drawGoals(state);

    const order = [...state.players].sort((a, b) => a.y - b.y);
    for (const p of order) drawPlayer(state, p, now);
    drawBall(state, now);
    drawParticles();

    if (flash) {
      if (now >= flash.die) flash = null;
      else {
        const t = 1 - (now - flash.born) / (flash.die - flash.born);
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = flash.color;
        ctx.fillRect(FIELD.left - 200, FIELD.top - 200, WORLD.w + 400, WORLD.h + 400);
        ctx.globalAlpha = 1;
      }
    }
  }

  return { draw, resize, handleEvents, clearEffects, shake, view };
}
