// Team AI: off-the-ball shape, chasing, keeping, and on-ball decisions.
// Every deadline is expressed in the simulation's own clock (`state.time`),
// never in wall-clock time, so a driven or replayed match behaves identically.

import { FIELD, GOAL, PENALTY_AREA, SHOT_MIN, SHOT_MAX, PASS_MIN, PASS_MAX,
         SPRINT_MULT, TACKLE_RANGE, TACKLE_INTERVAL, STUN_TIME, KICK_COOLDOWN,
         BALL_DRAG, ARRIVAL_SPEED } from './constants.js';
import { clamp, lerp, dist, dirTo, pointSegDist } from './util.js';
import { FORMATION, fromAttackFrame, toAttackFrame, targetGoal, ownGoal } from './world.js';
import { kick, steerTo } from './physics.js';

export function runAI(state, live) {
  chooseChasers(state);

  for (const p of state.players) {
    if (live && p.i === state.controlled) continue;   // the human drives this one
    if (p.role === 'GK') steerKeeper(state, p, live);
    else steerOutfield(state, p, live);
  }

  if (!live) return;

  const b = state.ball;
  if (b.owner != null) {
    const carrier = state.players[b.owner];
    if (carrier.i !== state.controlled && state.time >= carrier.nextDecision) {
      decideOnBall(state, carrier);
    }
  }
  duels(state);
}

/* ------------------------------------------------------------------ shape */

function interceptPoint(state) {
  const b = state.ball;
  const speed = Math.hypot(b.vx, b.vy);
  const t = clamp(speed / 500, 0, 1) * 0.45;
  return [
    clamp(b.x + b.vx * t, FIELD.left, FIELD.right),
    clamp(b.y + b.vy * t, FIELD.top, FIELD.bottom),
  ];
}

function chooseChasers(state) {
  const [ix, iy] = interceptPoint(state);
  for (const team of state.teams) {
    let best = -1, bestCost = Infinity;
    for (const p of state.players) {
      if (p.team !== team.index || p.role === 'GK') continue;
      let cost = dist(p.x, p.y, ix, iy);
      if (state.ball.owner === p.i) cost -= 400;
      if (team.chaser === p.i) cost -= 30;          // hysteresis: no dithering
      if (state.time < p.stunUntil) cost += 250;
      if (cost < bestCost) { bestCost = cost; best = p.i; }
    }
    team.chaser = best;
  }
}

function nearestOpponent(state, p, ofPoint) {
  const px = ofPoint ? ofPoint[0] : p.x;
  const py = ofPoint ? ofPoint[1] : p.y;
  let best = null, bestD = Infinity;
  for (const o of state.players) {
    if (o.team === p.team) continue;
    const d = dist(px, py, o.x, o.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return [best, bestD];
}

function keeperOf(state, teamIndex) {
  return state.players.find((p) => p.team === teamIndex && p.role === 'GK');
}

function steerOutfield(state, p, live) {
  const team = state.teams[p.team];
  const slot = FORMATION[p.slot];
  const b = state.ball;
  const skill = team.skill;

  if (!live) {
    const [hx, hy] = fromAttackFrame(team, slot.fx, slot.fy);
    steerTo(p, hx, hy, 0.75);
    return;
  }

  if (b.owner === p.i) { steerCarrier(state, p); return; }

  const weHaveBall = b.owner != null && state.players[b.owner].team === p.team;

  if (team.chaser === p.i) {
    const [ix, iy] = interceptPoint(state);
    steerTo(p, ix, iy, SPRINT_MULT * skill.speed * skill.press);
    return;
  }

  const [bfx, bfy] = toAttackFrame(team, b.x, b.y);
  let fx = slot.fx + clamp((bfx - 0.5) * 0.62, -0.24, 0.34);
  let fy = slot.fy + (bfy - 0.5) * 0.24;
  if (weHaveBall && slot.fx > 0.4) fx += 0.09;          // push up in possession
  if (!weHaveBall && slot.fx < 0.5) fx -= 0.05;         // drop off without it
  fx = clamp(fx, 0.08, 0.93);
  fy = clamp(fy, 0.06, 0.94);
  let [tx, ty] = fromAttackFrame(team, fx, fy);

  if (weHaveBall) {
    // Offer a passing angle rather than standing on the marker.
    const carrier = state.players[b.owner];
    const d = dist(p.x, p.y, carrier.x, carrier.y);
    if (d < 300 && p.i !== carrier.i) {
      const side = ((p.slot % 2) === 0 ? -1 : 1);
      const sx = carrier.x + team.dir * 110;
      const sy = carrier.y + side * 105;
      tx = lerp(tx, sx, 0.45);
      ty = lerp(ty, sy, 0.45);
    }
  } else if (p.role !== 'FWD') {
    // Mark the nearest dangerous opponent, goal-side.
    const [mark, md] = nearestOpponent(state, p);
    if (mark && md < 230) {
      const [ogx, ogy] = ownGoal(team);
      const [gx, gy] = dirTo(mark.x, mark.y, ogx, ogy, [-team.dir, 0]);
      tx = lerp(tx, mark.x + gx * 32, 0.55);
      ty = lerp(ty, mark.y + gy * 32, 0.55);
    }
  }

  tx = clamp(tx, FIELD.left + 12, FIELD.right - 12);
  ty = clamp(ty, FIELD.top + 12, FIELD.bottom - 12);
  const urgency = dist(p.x, p.y, tx, ty) > 120 ? 1.12 : 0.9;
  steerTo(p, tx, ty, skill.speed * urgency);
}

function steerCarrier(state, p) {
  const team = state.teams[p.team];
  const [gx, gy] = targetGoal(team);
  let [dx, dy] = dirTo(p.x, p.y, gx, gy, [team.dir, 0]);

  const [opp, od] = nearestOpponent(state, p);
  if (opp && od < 120) {
    const ax = (p.x - opp.x) / (od || 1);
    const ay = (p.y - opp.y) / (od || 1);
    const w = ((120 - od) / 120) * 1.7;
    dx += ax * w; dy += ay * w;
  }
  if (p.y < FIELD.top + 70) dy += 0.6;
  if (p.y > FIELD.bottom - 70) dy -= 0.6;

  const len = Math.hypot(dx, dy) || 1;
  steerTo(p, p.x + (dx / len) * 170, p.y + (dy / len) * 170,
          state.teams[p.team].skill.speed * (od < 90 ? SPRINT_MULT : 1.05));
}

function steerKeeper(state, p, live) {
  const team = state.teams[p.team];
  const b = state.ball;
  const [ogx, ogy] = ownGoal(team);
  const line = ogx + team.dir * 16;

  if (!live) { steerTo(p, line, ogy, 0.8); return; }

  if (b.owner === p.i) {
    steerTo(p, ogx + team.dir * 46, clamp(b.y, ogy - 40, ogy + 40), 0.85);
    return;
  }

  const inBox = team.dir > 0
    ? b.x < FIELD.left + PENALTY_AREA.depth
    : b.x > FIELD.right - PENALTY_AREA.depth;
  const nearMouth = Math.abs(b.y - ogy) < PENALTY_AREA.halfHeight;

  const speed = Math.hypot(b.vx, b.vy);

  // Come and claim a loose ball, but never chase a struck one — running at
  // where the ball is now always arrives behind where it will be.
  if (b.owner == null && inBox && nearMouth && speed < 190 && dist(p.x, p.y, b.x, b.y) < 150) {
    steerTo(p, b.x + b.vx * 0.2, b.y + b.vy * 0.2, SPRINT_MULT * 1.02);
    return;
  }
  let ty = ogy;
  let out = clamp(dist(ogx, ogy, b.x, b.y) * 0.13, 14, 64);

  if (speed > 140 && Math.sign(b.vx) === -team.dir) {
    const t = (ogx - b.x) / b.vx;                     // time until it reaches the line
    if (t > 0 && t < 1.5) {
      ty = b.y + b.vy * t;                            // get across for the save
      out = 16;
    } else {
      ty = ogy + (b.y - ogy) * 0.55;
    }
  } else {
    const [dx, dy] = dirTo(ogx, ogy, b.x, b.y, [team.dir, 0]);
    ty = ogy + dy * out;
  }

  ty = clamp(ty, ogy - GOAL.halfHeight - 10, ogy + GOAL.halfHeight + 10);
  const tx = team.dir > 0
    ? clamp(ogx + out, FIELD.left + 14, FIELD.left + PENALTY_AREA.depth - 10)
    : clamp(ogx - out, FIELD.right - PENALTY_AREA.depth + 10, FIELD.right - 14);
  steerTo(p, tx, ty, 1.16);
}

/* -------------------------------------------------------- on-ball choices */

/** Is the straight line from `from` to (tx,ty) free of opponents? */
export function laneClear(state, from, tx, ty, radius = 15) {
  const total = dist(from.x, from.y, tx, ty);
  for (const o of state.players) {
    if (o.team === from.team) continue;
    if (dist(from.x, from.y, o.x, o.y) > total + 20) continue;
    if (pointSegDist(o.x, o.y, from.x, from.y, tx, ty) < radius) return false;
  }
  return true;
}

/** Best pass option for `p`, or null. Exported so the human uses the same brain. */
export function bestPass(state, p, preferForward = true) {
  const team = state.teams[p.team];
  const [pfx] = toAttackFrame(team, p.x, p.y);
  let best = null, bestScore = -Infinity;

  for (const m of state.players) {
    if (m.team !== p.team || m.i === p.i) continue;
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < 55 || d > 540) continue;
    const lead = [m.x + m.vx * 0.28, m.y + m.vy * 0.28];
    if (!laneClear(state, p, lead[0], lead[1], 16)) continue;

    const [mfx] = toAttackFrame(team, m.x, m.y);
    const [, openness] = nearestOpponent(state, m);
    let score = (preferForward ? (mfx - pfx) * 1.6 : 0)
      + clamp(openness / 130, 0, 1) * 0.9
      - d / 950;
    if (m.role === 'GK') score -= 1.0;
    if (m.i === team.chaser) score += 0.1;
    if (score > bestScore) { bestScore = score; best = { player: m, lead, score, d }; }
  }
  return best && bestScore > -0.6 ? best : null;
}

export function passTo(state, p, option) {
  const [tx, ty] = option.lead;
  // Weight the pass so it arrives at a speed the receiver can take, given the
  // ball's drag: distance covered from v0 down to v_end is (v0 - v_end) / drag.
  const speed = clamp(ARRIVAL_SPEED + BALL_DRAG * option.d, PASS_MIN, PASS_MAX);
  const [dx, dy] = dirTo(p.x, p.y, tx, ty, [p.fx, p.fy]);
  kick(state, p, dx, dy, speed, 'pass');
}

export function shootAt(state, p, accuracy) {
  const team = state.teams[p.team];
  const [gx, gy] = targetGoal(team);
  const keeper = keeperOf(state, 1 - p.team);
  const side = keeper && keeper.y > gy ? -1 : 1;
  const d = dist(p.x, p.y, gx, gy);
  let aimY = gy + side * (GOAL.halfHeight - 20);
  aimY += state.rng.range(-accuracy, accuracy) * clamp(d / 260, 0.5, 2.4);
  aimY = clamp(aimY, gy - GOAL.halfHeight + 8, gy + GOAL.halfHeight - 8);

  const power = clamp(lerp(SHOT_MIN, SHOT_MAX, d / 460), SHOT_MIN, SHOT_MAX);
  const [dx, dy] = dirTo(p.x, p.y, gx + team.dir * 10, aimY, [team.dir, 0]);
  state.teams[p.team].shots += 1;
  kick(state, p, dx, dy, power, 'shot');
}

function decideOnBall(state, p) {
  const team = state.teams[p.team];
  const skill = team.skill;
  p.nextDecision = state.time + skill.decide;

  if (p.role === 'GK') {
    if (state.time < p.holdUntil) return;
    const option = bestPass(state, p, true);
    if (option) passTo(state, p, option);
    else {
      const [gx, gy] = targetGoal(team);
      const [dx, dy] = dirTo(p.x, p.y, gx, gy + state.rng.range(-180, 180), [team.dir, 0]);
      kick(state, p, dx, dy, 620, 'clear');
    }
    return;
  }

  const [gx, gy] = targetGoal(team);
  const goalDist = dist(p.x, p.y, gx, gy);
  const [, pressure] = nearestOpponent(state, p);

  if (goalDist < skill.shootRange && laneClear(state, p, gx, gy, 13)) {
    shootAt(state, p, skill.aim);
    return;
  }
  // Under real pressure, a hopeful shot beats losing it in your own half.
  if (goalDist < skill.shootRange * 0.7 && pressure < 40) {
    shootAt(state, p, skill.aim * 1.6);
    return;
  }

  // Keep it unless there is pressure or a clearly better option: a player who
  // passes the instant they receive gives a game with no dribbling in it.
  const option = bestPass(state, p, true);
  if (option && (pressure < 58 || option.score > 0.95)) {
    passTo(state, p, option);
    return;
  }
  if (!option && pressure < 34) {
    // Cornered with nothing on: clear it up the line.
    const [dx, dy] = dirTo(p.x, p.y, gx, p.y + state.rng.range(-120, 120), [team.dir, 0]);
    kick(state, p, dx, dy, 520, 'clear');
  }
}

/* ----------------------------------------------------------------- duels */

/**
 * A tackle is rolled once per decision interval, never per tick — a per-tick
 * probability would make the outcome depend on the frame rate.
 */
export function attemptTackle(state, p, bonus = 0) {
  const b = state.ball;
  if (b.owner == null) return false;
  const carrier = state.players[b.owner];
  if (carrier.team === p.team) return false;
  if (state.time < p.nextTackle || state.time < p.stunUntil) return false;
  if (dist(p.x, p.y, b.x, b.y) > TACKLE_RANGE) return false;

  p.nextTackle = state.time + TACKLE_INTERVAL;
  const skill = state.teams[p.team].skill;
  let chance = skill.tackle + bonus;
  if (carrier.i === state.controlled) chance *= 0.88;   // the human gets a break
  if (state.rng() >= chance) return false;

  carrier.stunUntil = state.time + STUN_TIME;
  carrier.kickCooldown = KICK_COOLDOWN;
  b.lastTouch = p.i;

  if (state.rng() < 0.6) {
    // Clean challenge: the tackler comes away with it.
    b.owner = p.i;
    b.vx = 0; b.vy = 0;
  } else {
    // Scrappy: it breaks loose, slowly enough that either of them can react.
    b.owner = null;
    const [dx, dy] = dirTo(carrier.x, carrier.y, p.x, p.y, [p.fx, p.fy]);
    const away = 70 + state.rng.range(0, 70);
    b.vx = dx * away + state.rng.range(-50, 50);
    b.vy = dy * away + state.rng.range(-50, 50);
    p.kickCooldown = 0.14;
  }
  state.events.push({ type: 'tackle', player: p.i, x: b.x, y: b.y });
  return true;
}

function duels(state) {
  const b = state.ball;
  if (b.owner == null) return;
  const carrier = state.players[b.owner];
  if (state.time < carrier.holdUntil) return;          // keeper has it in hand
  for (const p of state.players) {
    if (p.team === carrier.team || p.i === state.controlled) continue;
    if (attemptTackle(state, p)) return;
  }
}
