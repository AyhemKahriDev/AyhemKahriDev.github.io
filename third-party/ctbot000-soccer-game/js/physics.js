// Integration, collisions and possession. Pure logic — no DOM, no wall clock.

import { FIELD, GOAL, PLAYER_R, BALL_R, RUN_SPEED, ACCEL_K,
         BALL_DRAG, BALL_STOP, WALL_BOUNCE, POST_BOUNCE, PLAYER_BOUNCE,
         CONTROL_RADIUS, GK_REACH, DRIBBLE_DIST, KICK_COOLDOWN, STAMINA_DRAIN,
         STAMINA_REGEN } from './constants.js';
import { clamp, dist2 } from './util.js';

const POSTS = [
  [FIELD.left, FIELD.cy - GOAL.halfHeight], [FIELD.left, FIELD.cy + GOAL.halfHeight],
  [FIELD.right, FIELD.cy - GOAL.halfHeight], [FIELD.right, FIELD.cy + GOAL.halfHeight],
];

/** Steer a player towards a point; `arrive` eases off near the target. */
export function steerTo(p, tx, ty, speedMult = 1) {
  p.tx = tx; p.ty = ty;
  p.speedMult = speedMult;
}

/** Drive a player from a raw input axis (the human's controls). */
export function steerAxis(p, mx, my, speedMult = 1) {
  const len = Math.hypot(mx, my);
  if (len < 0.08) {
    p.tx = p.x; p.ty = p.y;
  } else {
    p.tx = p.x + (mx / len) * 200;
    p.ty = p.y + (my / len) * 200;
  }
  p.speedMult = speedMult;
}

export function integratePlayers(state, dt) {
  for (const p of state.players) {
    p.kickCooldown = Math.max(0, p.kickCooldown - dt);

    const stunned = state.time < p.stunUntil;
    let desiredX = 0, desiredY = 0;

    if (!stunned) {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-4) {
        // Ease into the last few units so nobody vibrates on their marker.
        const throttle = d < 10 ? d / 10 : 1;
        const speed = RUN_SPEED * p.speedMult * throttle;
        desiredX = (dx / d) * speed;
        desiredY = (dy / d) * speed;
      }
    }

    // Exponential approach: frame-rate independent, and identical at any dt.
    const k = 1 - Math.exp(-ACCEL_K * dt);
    p.vx += (desiredX - p.vx) * k;
    p.vy += (desiredY - p.vy) * k;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.x = clamp(p.x, FIELD.left + PLAYER_R, FIELD.right - PLAYER_R);
    p.y = clamp(p.y, FIELD.top + PLAYER_R, FIELD.bottom - PLAYER_R);

    const moving = Math.hypot(p.vx, p.vy);
    if (moving > 12) {
      p.fx = p.vx / moving;
      p.fy = p.vy / moving;
    }

    const sprinting = p.speedMult > 1.02 && moving > RUN_SPEED * 0.7;
    p.stamina = clamp(p.stamina + (sprinting ? -STAMINA_DRAIN : STAMINA_REGEN) * dt, 0, 1);
  }
}

/** Push overlapping players apart so bodies never occupy the same spot. */
export function separatePlayers(state) {
  const ps = state.players;
  const min = PLAYER_R * 2;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
    }
  }
  for (const p of ps) {
    p.x = clamp(p.x, FIELD.left + PLAYER_R, FIELD.right - PLAYER_R);
    p.y = clamp(p.y, FIELD.top + PLAYER_R, FIELD.bottom - PLAYER_R);
  }
}

/** Send the ball away from `player`. Speed is in world units per second. */
export function kick(state, player, dx, dy, speed, kind = 'kick') {
  const len = Math.hypot(dx, dy) || 1;
  const b = state.ball;
  b.owner = null;
  b.lastTouch = player.i;
  b.x = player.x + (dx / len) * DRIBBLE_DIST;
  b.y = player.y + (dy / len) * DRIBBLE_DIST;
  b.vx = (dx / len) * speed;
  b.vy = (dy / len) * speed;
  player.kickCooldown = KICK_COOLDOWN;
  player.holdUntil = 0;
  state.events.push({ type: kind, player: player.i, x: b.x, y: b.y, power: speed });
}

/**
 * Advance the ball. Returns nothing; goals and rebounds are pushed onto
 * `state.events` for the presentation layer to react to.
 */
export function integrateBall(state, dt, live = true) {
  const b = state.ball;

  if (b.owner != null) {
    const p = state.players[b.owner];
    if (!p || state.time < p.stunUntil) {
      b.owner = null;
    } else if (state.time < p.holdUntil) {
      // Keeper has it in their hands.
      b.x = p.x + p.fx * (PLAYER_R + BALL_R);
      b.y = p.y + p.fy * (PLAYER_R + BALL_R);
      b.vx = p.vx; b.vy = p.vy;
      return;
    } else {
      const tx = p.x + p.fx * DRIBBLE_DIST;
      const ty = p.y + p.fy * DRIBBLE_DIST;
      const k = 1 - Math.exp(-16 * dt);
      b.x += (tx - b.x) * k;
      b.y += (ty - b.y) * k;
      b.vx = p.vx; b.vy = p.vy;
      b.roll += Math.hypot(b.vx, b.vy) * dt / BALL_R;
      b.x = clamp(b.x, FIELD.left + BALL_R, FIELD.right - BALL_R);
      b.y = clamp(b.y, FIELD.top + BALL_R, FIELD.bottom - BALL_R);
      return;
    }
  }

  const decay = Math.exp(-BALL_DRAG * dt);
  b.vx *= decay;
  b.vy *= decay;
  if (Math.hypot(b.vx, b.vy) < BALL_STOP) { b.vx = 0; b.vy = 0; }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.roll += Math.hypot(b.vx, b.vy) * dt / BALL_R;

  if (!live) {
    // Dead ball (celebration, half time): keep it on the grass, nothing else.
    b.x = clamp(b.x, FIELD.left - GOAL.depth + BALL_R, FIELD.right + GOAL.depth - BALL_R);
    b.y = clamp(b.y, FIELD.top - 20, FIELD.bottom + 20);
    return;
  }

  bouncePosts(state, b);
  deflectOffPlayers(state, b);
  handleBoundaries(state, b);
}

function bouncePosts(state, b) {
  const min = GOAL.postR + BALL_R;
  for (const [px, py] of POSTS) {
    const dx = b.x - px, dy = b.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 < 1e-9) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    b.x = px + nx * min;
    b.y = py + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    b.vx = (b.vx - 2 * vn * nx) * POST_BOUNCE;
    b.vy = (b.vy - 2 * vn * ny) * POST_BOUNCE;
    state.events.push({ type: 'post', x: b.x, y: b.y });
  }
}

function deflectOffPlayers(state, b) {
  const min = PLAYER_R + BALL_R;
  for (const p of state.players) {
    if (p.kickCooldown <= 0 && state.time >= p.stunUntil) continue; // they'd control it instead
    const dx = b.x - p.x, dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 < 1e-9) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    b.x = p.x + nx * min;
    b.y = p.y + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx = (b.vx - 2 * vn * nx) * PLAYER_BOUNCE + p.vx * 0.3;
      b.vy = (b.vy - 2 * vn * ny) * PLAYER_BOUNCE + p.vy * 0.3;
      b.lastTouch = p.i;
    }
  }
}

function handleBoundaries(state, b) {
  // Touchlines always rebound — this is arcade indoor soccer, no throw-ins.
  if (b.y - BALL_R < FIELD.top) {
    b.y = FIELD.top + BALL_R;
    b.vy = Math.abs(b.vy) * WALL_BOUNCE;
    state.events.push({ type: 'wall', x: b.x, y: b.y });
  } else if (b.y + BALL_R > FIELD.bottom) {
    b.y = FIELD.bottom - BALL_R;
    b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
    state.events.push({ type: 'wall', x: b.x, y: b.y });
  }

  // Between the posts the ball is free to cross the line and hit the net.
  if (Math.abs(b.y - FIELD.cy) < GOAL.halfHeight - BALL_R * 0.5) {
    if (b.x + BALL_R < FIELD.left) scoreGoal(state, -1);
    else if (b.x - BALL_R > FIELD.right) scoreGoal(state, 1);
    return;
  }

  if (b.x - BALL_R < FIELD.left) {
    b.x = FIELD.left + BALL_R;
    b.vx = Math.abs(b.vx) * WALL_BOUNCE;
    state.events.push({ type: 'wall', x: b.x, y: b.y });
  } else if (b.x + BALL_R > FIELD.right) {
    b.x = FIELD.right - BALL_R;
    b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
    state.events.push({ type: 'wall', x: b.x, y: b.y });
  }
}

/** `side` is +1 for the goal on the right, -1 for the goal on the left. */
function scoreGoal(state, side) {
  // The team attacking that goal is the one whose `dir` points at it.
  const scorer = state.teams.find((t) => t.dir === side);
  const conceding = state.teams.find((t) => t.dir !== side);
  scorer.score += 1;
  const toucher = state.ball.lastTouch >= 0 ? state.players[state.ball.lastTouch] : null;
  const ownGoal = !!toucher && toucher.team === conceding.index;
  state.stats.goals.push({
    team: scorer.index,
    scorer: toucher ? toucher.i : -1,
    ownGoal,
    half: state.half,
    clock: state.clock,
  });
  state.events.push({ type: 'goal', team: scorer.index, scorer: toucher ? toucher.i : -1, ownGoal });
  state.ball.vx *= 0.35;
  state.ball.vy *= 0.35;
}

/** Loose-ball pickups and the dribbler's first touch. */
export function updatePossession(state) {
  const b = state.ball;
  if (b.owner != null) {
    const p = state.players[b.owner];
    if (!p || state.time < p.stunUntil) b.owner = null;
    else return;
  }

  // A keeper reaches further than an outfield player — that reach is the dive.
  let best = null, bestScore = 1;
  for (const p of state.players) {
    if (p.kickCooldown > 0 || state.time < p.stunUntil) continue;
    const reach = p.role === 'GK' ? CONTROL_RADIUS * GK_REACH : CONTROL_RADIUS;
    const score = dist2(p.x, p.y, b.x, b.y) / (reach * reach);
    if (score < bestScore) { bestScore = score; best = p; }
  }
  if (best) {
    const stolen = b.lastTouch >= 0 && state.players[b.lastTouch].team !== best.team;
    b.owner = best.i;
    b.lastTouch = best.i;
    // A settling touch: the decision timer runs whether or not a player has
    // the ball, so without this they would play it away on the same frame.
    best.nextDecision = state.time + 0.3 + state.rng() * 0.25;
    if (best.role === 'GK' && Math.hypot(b.vx, b.vy) > 60) {
      best.holdUntil = state.time + 0.75;
      state.events.push({ type: 'save', player: best.i, x: b.x, y: b.y });
    } else if (stolen) {
      state.events.push({ type: 'intercept', player: best.i, x: b.x, y: b.y });
    }
    b.vx = 0; b.vy = 0;
  }
}
