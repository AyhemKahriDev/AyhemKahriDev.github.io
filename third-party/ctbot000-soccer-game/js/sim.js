// Match orchestration: the fixed-step update, the phase machine and the
// human's controls. `state.time` is the only clock the simulation reads.

import { GOAL, GOAL_PAUSE, KICKOFF_PAUSE, SHOT_MIN, SHOT_MAX, SPRINT_MULT,
         PASS_MIN } from './constants.js';
import { clamp, lerp, dist, dirTo } from './util.js';
import { resetForKickoff, swapEnds, targetGoal } from './world.js';
import { integratePlayers, separatePlayers, integrateBall, updatePossession,
         steerAxis, kick } from './physics.js';
import { runAI, bestPass, passTo, attemptTackle, laneClear } from './ai.js';

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.25;
const HALFTIME_PAUSE = 10;

/** Advance the match by exactly `dt` seconds. */
export function stepMatch(state, dt, input) {
  state.time += dt;
  const live = state.phase === 'play';

  if (live) {
    state.clock += dt;
    const owner = state.ball.owner;
    if (owner != null) state.teams[state.players[owner].team].possessionTime += dt;
  }

  applyHumanControl(state, input, live);
  runAI(state, live);
  integratePlayers(state, dt);
  separatePlayers(state);
  integrateBall(state, dt, live);
  if (live) updatePossession(state);
  updateControlled(state, dt);
  advancePhase(state);
}

/** Drive the whole loop from a wall-clock delta, in fixed steps. */
export function advance(state, frameDt, input) {
  let dt = Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  state.acc = (state.acc || 0) + dt;
  let steps = 0;
  while (state.acc >= FIXED_DT && steps < 40) {
    stepMatch(state, FIXED_DT, input);
    state.acc -= FIXED_DT;
    steps++;
  }
  if (steps === 40) state.acc = 0;    // never let the accumulator run away
  return steps;
}

/* ----------------------------------------------------------- phase machine */

function advancePhase(state) {
  if (state.phase === 'play' && state.events.some((e) => e.type === 'goal')) {
    state.phase = 'goal';
    state.phaseUntil = state.time + GOAL_PAUSE;
    state.ball.owner = null;
    return;
  }

  switch (state.phase) {
    case 'kickoff':
      if (state.time >= state.phaseUntil) state.phase = 'play';
      break;

    case 'play':
      if (state.clock >= state.halfLength) endHalf(state);
      break;

    case 'goal':
      if (state.time >= state.phaseUntil) {
        if (state.clock >= state.halfLength) { endHalf(state); break; }
        const last = state.stats.goals[state.stats.goals.length - 1];
        resetForKickoff(state, last ? 1 - last.team : 0);
      }
      break;

    case 'halftime':
      if (state.resumeRequested || state.time >= state.phaseUntil) resumeMatch(state);
      break;

    default:
      break;
  }
}

function endHalf(state) {
  if (state.half === 1) {
    state.phase = 'halftime';
    state.phaseUntil = state.time + HALFTIME_PAUSE;
    state.resumeRequested = false;
    state.ball.owner = null;
    state.events.push({ type: 'halftime' });
  } else {
    state.phase = 'fulltime';
    state.ball.owner = null;
    state.events.push({ type: 'fulltime' });
  }
}

export function resumeMatch(state) {
  if (state.phase !== 'halftime') return;
  state.half = 2;
  state.clock = 0;
  state.resumeRequested = false;
  swapEnds(state);
  resetForKickoff(state, 1 - state.firstKickoffTeam);
  state.phaseUntil = state.time + KICKOFF_PAUSE;
}

/** Match time for display: each half is shown as 45 minutes. */
export function matchClock(state) {
  const frac = clamp(state.clock / state.halfLength, 0, 1);
  const total = (state.half === 2 ? 45 : 0) + frac * 45;
  const minute = Math.floor(total);
  const second = Math.floor((total - minute) * 60);
  return { minute, second, text: `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}` };
}

/* ------------------------------------------------------------ human input */

function applyHumanControl(state, input, live) {
  if (state.controlled < 0 || !input) return;

  if (input.actions && input.actions.length) {
    for (const action of input.actions.splice(0)) {
      const p = state.players[state.controlled];
      if (action.type === 'switch') { switchPlayer(state); continue; }
      if (!live) continue;
      if (action.type === 'shoot') humanShoot(state, p, action.power ?? 1);
      else if (action.type === 'pass') humanPass(state, p);
    }
  }

  if (!live) return;
  const p = state.players[state.controlled];
  if (state.time < p.stunUntil) return;
  const sprint = input.sprint && p.stamina > 0.03 ? SPRINT_MULT : 1;
  steerAxis(p, input.mx || 0, input.my || 0, sprint);
}

function humanShoot(state, p, power) {
  if (state.ball.owner !== p.i) {
    // No ball: the same button is a challenge for it.
    attemptTackle(state, p, 0.3);
    return;
  }
  const team = state.teams[p.team];
  const [gx, gy] = targetGoal(team);
  const d = dist(p.x, p.y, gx, gy);
  let dx = p.fx, dy = p.fy;

  // Aim assist: your facing picks the corner, the shot bends onto the target.
  if (d < 430) {
    const aimY = clamp(gy + p.fy * 150, gy - GOAL.halfHeight + 14, gy + GOAL.halfHeight - 14);
    const [ax, ay] = dirTo(p.x, p.y, gx + team.dir * 8, aimY, [team.dir, 0]);
    const w = clamp(1 - d / 430, 0, 1) * 0.8;
    dx = lerp(dx, ax, w); dy = lerp(dy, ay, w);
  }
  team.shots += 1;
  kick(state, p, dx, dy, lerp(SHOT_MIN, SHOT_MAX, clamp(power, 0, 1)), 'shot');
}

function humanPass(state, p) {
  if (state.ball.owner !== p.i) { switchPlayer(state); return; }

  // Prefer whoever the player is pointing at; fall back to the AI's read.
  let best = null, bestScore = -Infinity;
  for (const m of state.players) {
    if (m.team !== p.team || m.i === p.i) continue;
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < 45 || d > 560) continue;
    const [dx, dy] = dirTo(p.x, p.y, m.x, m.y, [p.fx, p.fy]);
    const align = dx * p.fx + dy * p.fy;             // -1..1
    if (align < 0.1) continue;
    const lead = [m.x + m.vx * 0.28, m.y + m.vy * 0.28];
    const clear = laneClear(state, p, lead[0], lead[1], 15);
    const score = align * 2.2 + (clear ? 0.8 : -0.5) - d / 700;
    if (score > bestScore) { bestScore = score; best = { player: m, lead, d, score }; }
  }
  const option = best || bestPass(state, p, true);
  if (option) { passTo(state, p, option); return; }

  // Nobody on: knock it ahead of yourself rather than swallowing the input.
  kick(state, p, p.fx, p.fy, PASS_MIN, 'pass');
}

function switchPlayer(state) {
  if (state.humanTeam < 0) return;
  const b = state.ball;
  let best = -1, bestD = Infinity;
  for (const p of state.players) {
    if (p.team !== state.humanTeam || p.i === state.controlled) continue;
    if (p.role === 'GK' && b.owner !== p.i) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = p.i; }
  }
  if (best >= 0) {
    state.controlled = best;
    state.switchCooldown = 0.45;
    state.events.push({ type: 'switch', player: best });
  }
}

/** Hand the human whichever team-mate the moment belongs to. */
function updateControlled(state, dt) {
  if (state.humanTeam < 0 || state.controlled < 0) return;
  state.switchCooldown = Math.max(0, (state.switchCooldown || 0) - dt);

  const b = state.ball;
  if (b.owner != null) {
    const owner = state.players[b.owner];
    if (owner.team === state.humanTeam) {
      if (state.controlled !== owner.i) {
        state.controlled = owner.i;
        state.switchCooldown = 0.3;
      }
      return;
    }
  }

  if (state.switchCooldown > 0) return;
  const chaser = state.teams[state.humanTeam].chaser;
  if (chaser < 0 || chaser === state.controlled) return;
  const cur = state.players[state.controlled];
  const alt = state.players[chaser];
  if (dist(cur.x, cur.y, b.x, b.y) > dist(alt.x, alt.y, b.x, b.y) * 1.55) {
    state.controlled = chaser;
    state.switchCooldown = 0.5;
  }
}
