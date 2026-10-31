// Team data, formation slots and world construction. Pure logic — no DOM.

import { FIELD, CENTER_CIRCLE_R, PLAYER_R, DIFFICULTY, ALLY_SKILL,
         DEFAULT_HALF_LENGTH, KICKOFF_PAUSE, STAMINA_MAX } from './constants.js';
import { clamp, makeRng } from './util.js';

export const TEAMS = [
  { id: 'azure',    name: 'Azure FC',        short: 'AZU', kit: '#2f7dfb', kit2: '#123a80', text: '#ffffff', gk: '#f7d154' },
  { id: 'crimson',  name: 'Crimson United',  short: 'CRU', kit: '#e5484d', kit2: '#7a1418', text: '#ffffff', gk: '#7ee787' },
  { id: 'emerald',  name: 'Emerald Rovers',  short: 'EMR', kit: '#2ea043', kit2: '#0f3d1c', text: '#ffffff', gk: '#f78166' },
  { id: 'solar',    name: 'Solar City',      short: 'SOL', kit: '#f2a900', kit2: '#7a4d00', text: '#1a1206', gk: '#58a6ff' },
  { id: 'violet',   name: 'Violet Athletic', short: 'VIO', kit: '#8b5cf6', kit2: '#3b2170', text: '#ffffff', gk: '#ffd166' },
  { id: 'graphite', name: 'Graphite Town',   short: 'GRA', kit: '#8b949e', kit2: '#2b3038', text: '#0d1117', gk: '#ff7b72' },
];

const SURNAMES = [
  'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Vasquez', 'Duarte',
  'Novak', 'Haaland', 'Bianchi', 'Silva', 'Kovac', 'Adeyemi',
  'Petrov', 'Marchand', 'Iversen', 'Rahman', 'Costa', 'Yilmaz',
  'Berger', 'Mbeki', 'Sorensen', 'Ferreira', 'Kim', 'Delgado',
  'Weber', 'Ricci', 'Onyeka', 'Laurent', 'Nakamura', 'Bakker',
];

// Formation slots in the team's attacking frame: fx runs 0 (own goal line)
// to 1 (opponent goal line); fy runs 0 (top touchline) to 1 (bottom).
export const FORMATION = [
  { role: 'GK',  num: 1,  fx: 0.045, fy: 0.50 },
  { role: 'DEF', num: 4,  fx: 0.225, fy: 0.30 },
  { role: 'DEF', num: 5,  fx: 0.225, fy: 0.70 },
  { role: 'MID', num: 8,  fx: 0.470, fy: 0.32 },
  { role: 'MID', num: 10, fx: 0.470, fy: 0.68 },
  { role: 'FWD', num: 9,  fx: 0.700, fy: 0.50 },
];

export const TEAM_SIZE = FORMATION.length;

/** Position in the team's attacking frame -> world coordinates. */
export function fromAttackFrame(team, fx, fy) {
  if (team.dir > 0) {
    return [FIELD.left + fx * FIELD.w, FIELD.top + fy * FIELD.h];
  }
  return [FIELD.right - fx * FIELD.w, FIELD.bottom - fy * FIELD.h];
}

/** World coordinates -> the team's attacking frame. */
export function toAttackFrame(team, x, y) {
  if (team.dir > 0) {
    return [(x - FIELD.left) / FIELD.w, (y - FIELD.top) / FIELD.h];
  }
  return [(FIELD.right - x) / FIELD.w, (FIELD.bottom - y) / FIELD.h];
}

/** Centre of the goal this team is attacking. */
export function targetGoal(team) {
  return [team.dir > 0 ? FIELD.right : FIELD.left, FIELD.cy];
}

/** Centre of the goal this team is defending. */
export function ownGoal(team) {
  return [team.dir > 0 ? FIELD.left : FIELD.right, FIELD.cy];
}

export function createWorld(opts = {}) {
  const {
    homeId = 'azure',
    awayId = 'crimson',
    difficulty = 'normal',
    halfLength = DEFAULT_HALF_LENGTH,
    seed = 1,
    humanTeam = 0,          // 0 = home, 1 = away, -1 = watch the CPUs play
  } = opts;

  const rng = makeRng(seed);
  const presets = [
    TEAMS.find((t) => t.id === homeId) || TEAMS[0],
    TEAMS.find((t) => t.id === awayId) || TEAMS[1],
  ];
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

  const teams = presets.map((preset, i) => ({
    ...preset,
    index: i,
    dir: i === 0 ? 1 : -1,          // home attacks right in the first half
    score: 0,
    shots: 0,
    possessionTime: 0,
    isHuman: i === humanTeam,
    skill: i === humanTeam ? ALLY_SKILL : diff,
    chaser: -1,
  }));

  const players = [];
  teams.forEach((team, ti) => {
    FORMATION.forEach((slot, si) => {
      const [x, y] = fromAttackFrame(team, slot.fx, slot.fy);
      players.push({
        i: players.length,
        team: ti,
        role: slot.role,
        num: slot.num,
        name: SURNAMES[(ti * TEAM_SIZE + si * 5 + 3) % SURNAMES.length],
        slot: si,
        x, y, vx: 0, vy: 0,
        fx: team.dir, fy: 0,        // facing
        tx: x, ty: y,               // steering target
        speedMult: 1,
        stamina: STAMINA_MAX,
        kickCooldown: 0,
        stunUntil: -1,
        nextDecision: 0,
        nextTackle: 0,
        holdUntil: 0,               // keeper holding the ball
      });
    });
  });

  const state = {
    time: 0,                        // the simulation's own clock; every deadline uses it
    clock: 0,                       // seconds played in the current half
    half: 1,
    halfLength,
    phase: 'kickoff',
    phaseUntil: KICKOFF_PAUSE,
    kickoffTeam: 0,
    firstKickoffTeam: 0,
    teams,
    players,
    ball: { x: FIELD.cx, y: FIELD.cy, vx: 0, vy: 0, owner: null, lastTouch: -1, spin: 0, roll: 0 },
    controlled: -1,
    humanTeam,
    switchCooldown: 0,
    difficulty,
    events: [],
    rng,
    stats: { goals: [] },
  };

  resetForKickoff(state, 0);
  if (humanTeam >= 0) state.controlled = players.findIndex((p) => p.team === humanTeam && p.role === 'FWD');
  return state;
}

/** Put everyone on their formation spot and the ball on the centre mark. */
export function resetForKickoff(state, kickoffTeam) {
  state.kickoffTeam = kickoffTeam;
  state.phase = 'kickoff';
  state.phaseUntil = state.time + KICKOFF_PAUSE;

  for (const p of state.players) {
    const team = state.teams[p.team];
    const slot = FORMATION[p.slot];
    // The side kicking off may stand in the centre circle; the other side may not.
    let fx = slot.fx;
    if (p.team !== kickoffTeam && p.role !== 'GK') fx = Math.min(fx, 0.44);
    let [x, y] = fromAttackFrame(team, fx, slot.fy);
    if (p.team === kickoffTeam && p.role === 'FWD') {
      x = FIELD.cx - team.dir * 26;
      y = FIELD.cy;
    }
    // Nobody but the kicker inside the centre circle.
    const d = Math.hypot(x - FIELD.cx, y - FIELD.cy);
    if (d < CENTER_CIRCLE_R + PLAYER_R && !(p.team === kickoffTeam && p.role === 'FWD')) {
      const push = (CENTER_CIRCLE_R + PLAYER_R + 4) / Math.max(d, 1);
      x = FIELD.cx + (x - FIELD.cx) * push;
      y = FIELD.cy + (y - FIELD.cy) * push;
    }
    // A little scatter, so no two kick-offs play out the same way.
    const kicker = p.team === kickoffTeam && p.role === 'FWD';
    if (!kicker && p.role !== 'GK') {
      x += state.rng.range(-14, 14);
      y += state.rng.range(-18, 18);
    }
    p.x = clamp(x, FIELD.left + PLAYER_R, FIELD.right - PLAYER_R);
    p.y = clamp(y, FIELD.top + PLAYER_R, FIELD.bottom - PLAYER_R);
    p.tx = p.x; p.ty = p.y;
    p.vx = 0; p.vy = 0;
    p.fx = team.dir; p.fy = 0;
    p.kickCooldown = 0;
    p.stunUntil = -1;
    p.holdUntil = 0;
    p.nextDecision = state.time + state.rng.range(0, 0.18);
    p.nextTackle = state.time + state.rng.range(0, 0.12);
    p.stamina = Math.min(1, p.stamina + 0.25);
  }

  const b = state.ball;
  b.x = FIELD.cx; b.y = FIELD.cy;
  b.vx = 0; b.vy = 0;
  b.owner = null;
  b.lastTouch = -1;
}

/** Swap ends at half time, exactly as the real thing does. */
export function swapEnds(state) {
  for (const t of state.teams) t.dir *= -1;
}
