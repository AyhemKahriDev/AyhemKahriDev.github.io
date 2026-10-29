// Headless tests for the simulation. Nothing here touches the DOM, so the
// whole match engine is exercised without a browser.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld } from '../js/world.js';
import { stepMatch, advance, matchClock, FIXED_DT } from '../js/sim.js';
import { FIELD, GOAL, BALL_R, PLAYER_R } from '../js/constants.js';

function newMatch(over = {}) {
  return createWorld({ seed: 7, halfLength: 30, humanTeam: -1, ...over });
}

/** Run `seconds` of match time in fixed steps, collecting every event. */
function run(state, seconds, input = null) {
  const events = [];
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    stepMatch(state, FIXED_DT, input);
    if (state.events.length) { events.push(...state.events); state.events.length = 0; }
  }
  return events;
}

test('a kickoff starts with the ball on the centre spot and nobody holding it', () => {
  const s = newMatch();
  assert.equal(s.phase, 'kickoff');
  assert.equal(s.ball.x, FIELD.cx);
  assert.equal(s.ball.y, FIELD.cy);
  assert.equal(s.ball.owner, null);
  assert.equal(s.players.length, 12);
});

test('play starts after the kickoff pause and the clock only runs in play', () => {
  const s = newMatch();
  run(s, 1.0);
  assert.equal(s.phase, 'kickoff');
  assert.equal(s.clock, 0, 'the clock must not run before kick-off');
  run(s, 1.0);
  assert.equal(s.phase, 'play');
  assert.ok(s.clock > 0.3, `clock should be running, got ${s.clock}`);
});

test('the ball and every player stay inside the world, and nothing goes NaN', () => {
  const s = newMatch({ seed: 21 });
  const minX = FIELD.left - GOAL.depth - BALL_R;
  const maxX = FIELD.right + GOAL.depth + BALL_R;
  for (let i = 0; i < 60_000; i++) {
    stepMatch(s, FIXED_DT, null);
    s.events.length = 0;
    const b = s.ball;
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'ball position went NaN');
    assert.ok(b.x >= minX && b.x <= maxX, `ball escaped on x: ${b.x}`);
    assert.ok(b.y >= FIELD.top - 40 && b.y <= FIELD.bottom + 40, `ball escaped on y: ${b.y}`);
    for (const p of s.players) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'player position went NaN');
      assert.ok(p.x >= FIELD.left - 1 && p.x <= FIELD.right + 1, `player off pitch: ${p.x}`);
      assert.ok(p.y >= FIELD.top - 1 && p.y <= FIELD.bottom + 1, `player off pitch: ${p.y}`);
    }
  }
});

test('players never end up stacked on the same spot', () => {
  const s = newMatch({ seed: 5 });
  run(s, 40);
  for (let i = 0; i < s.players.length; i++) {
    for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i], b = s.players[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > PLAYER_R * 1.6, `players ${i} and ${j} overlap (${d.toFixed(1)})`);
    }
  }
});

test('goals are scored, and each one restarts from the centre spot', () => {
  let goals = 0;
  for (const seed of [1, 2, 3, 4]) {
    const s = newMatch({ seed, halfLength: 120 });
    const events = run(s, 260);
    const scored = events.filter((e) => e.type === 'goal');
    goals += scored.length;
    assert.equal(s.teams[0].score + s.teams[1].score, scored.length,
      'the scoreboard must match the goals that were signalled');
  }
  assert.ok(goals >= 4, `four seeded matches produced only ${goals} goals`);
});

test('a goal is followed by a celebration and then a kickoff to the other team', () => {
  const s = newMatch({ seed: 3, halfLength: 400 });
  let scoringTeam = -1;
  for (let i = 0; i < 400_000 && scoringTeam < 0; i++) {
    stepMatch(s, FIXED_DT, null);
    const goal = s.events.find((e) => e.type === 'goal');
    if (goal) scoringTeam = goal.team;
    s.events.length = 0;
  }
  assert.ok(scoringTeam >= 0, 'no goal was scored in the search window');
  assert.equal(s.phase, 'goal');
  run(s, 3.2);
  assert.equal(s.phase, 'kickoff');
  assert.equal(s.kickoffTeam, 1 - scoringTeam, 'the conceding team restarts');
  assert.equal(s.ball.x, FIELD.cx);
  assert.equal(s.ball.y, FIELD.cy);
});

test('half time swaps ends and the second half restarts with the other team', () => {
  const s = newMatch({ seed: 11, halfLength: 20 });
  const dirs = s.teams.map((t) => t.dir);
  // Stoppages do not advance the clock, so run until the whistle rather than
  // for a fixed span of simulated time.
  for (let i = 0; i < 60_000 && s.phase !== 'halftime'; i++) {
    stepMatch(s, FIXED_DT, null);
    s.events.length = 0;
  }
  assert.equal(s.phase, 'halftime');
  s.resumeRequested = true;
  run(s, 0.2);
  assert.equal(s.half, 2);
  assert.equal(s.clock, 0);
  assert.deepEqual(s.teams.map((t) => t.dir), dirs.map((d) => -d), 'ends must be swapped');
  assert.equal(s.kickoffTeam, 1 - s.firstKickoffTeam);
});

test('a match reaches full time and then stops', () => {
  const s = newMatch({ seed: 2, halfLength: 15 });
  for (let i = 0; i < 120_000 && s.phase !== 'fulltime'; i++) {
    stepMatch(s, FIXED_DT, null);
    if (s.phase === 'halftime') s.resumeRequested = true;
    s.events.length = 0;
  }
  assert.equal(s.phase, 'fulltime');
  assert.equal(s.half, 2);
  const before = JSON.stringify([s.ball.x, s.ball.y, s.teams.map((t) => t.score)]);
  run(s, 5);
  assert.equal(s.phase, 'fulltime');
  assert.deepEqual(JSON.parse(before)[2], s.teams.map((t) => t.score),
    'the score must not move after full time');
});

test('the same match time produces the same state at any frame rate', () => {
  const snapshot = (s) => s.players.map((p) => [p.x, p.y]).flat().concat([s.ball.x, s.ball.y, s.time]);
  const results = [];
  for (const frameDt of [1 / 30, 1 / 60, 1 / 144]) {
    const s = newMatch({ seed: 9 });
    const frames = Math.round(20 / frameDt);
    for (let i = 0; i < frames; i++) advance(s, frameDt, null);
    // Drain whatever the accumulator still holds so every run has simulated
    // exactly the same number of fixed steps.
    while (s.acc >= FIXED_DT) { stepMatch(s, FIXED_DT, null); s.acc -= FIXED_DT; }
    results.push({ frameDt, time: s.time, snap: snapshot(s) });
  }
  const base = results[0];
  for (const r of results.slice(1)) {
    assert.ok(Math.abs(r.time - base.time) < FIXED_DT * 1.5,
      `simulated ${r.time.toFixed(3)}s at ${(1 / r.frameDt).toFixed(0)}Hz vs ${base.time.toFixed(3)}s at 30Hz`);
    assert.ok(base.time > 19, 'the driven loop simulated almost nothing');
  }
});

test('a driven loop survives a long stall without teleporting or stopping', () => {
  const s = newMatch({ seed: 4 });
  advance(s, 0.016, null);
  const before = { x: s.ball.x, y: s.ball.y, time: s.time };
  advance(s, 30, null);                       // a 30 second stall, e.g. a hidden tab
  assert.ok(s.time - before.time <= 0.3, 'a stall must be clamped, not simulated in full');
  const stepsAfter = advance(s, 0.016, null);
  assert.ok(stepsAfter > 0, 'the loop must keep stepping after a stall');
});

test('the displayed clock covers 45 minutes per half', () => {
  const s = newMatch({ halfLength: 60 });
  assert.equal(matchClock(s).minute, 0);
  s.clock = 30;
  assert.equal(matchClock(s).minute, 22);
  s.clock = 60;
  assert.equal(matchClock(s).minute, 45);
  s.half = 2; s.clock = 60;
  assert.equal(matchClock(s).minute, 90);
});

test('both teams get on the ball, and possession is shared', () => {
  const s = newMatch({ seed: 13, halfLength: 200 });
  run(s, 150);
  for (const t of s.teams) {
    assert.ok(t.possessionTime > 8,
      `${t.name} only held the ball for ${t.possessionTime.toFixed(1)}s`);
  }
});

test('the human keeps control of a team-mate near the ball', () => {
  const s = createWorld({ seed: 6, halfLength: 60, humanTeam: 0 });
  const input = { mx: 1, my: 0, sprint: false, actions: [] };
  run(s, 30, input);
  const p = s.players[s.controlled];
  assert.equal(p.team, 0, 'control must stay on the human team');
  const d = Math.hypot(p.x - s.ball.x, p.y - s.ball.y);
  const others = s.players.filter((q) => q.team === 0 && q.role !== 'GK')
    .map((q) => Math.hypot(q.x - s.ball.x, q.y - s.ball.y));
  assert.ok(d <= Math.min(...others) * 2.2 + 60,
    'the controlled player should be one of the closest to the ball');
});

/** Play a whole CPU-vs-CPU match and report what happened in it. */
function playMatch(seed, difficulty = 'normal') {
  const s = createWorld({ seed, halfLength: 100, humanTeam: -1, difficulty });
  const counts = { shot: 0, save: 0, goal: 0, tackle: 0, pass: 0 };
  for (let i = 0; i < 400_000 && s.phase !== 'fulltime'; i++) {
    stepMatch(s, FIXED_DT, null);
    if (s.phase === 'halftime') s.resumeRequested = true;
    for (const e of s.events) if (e.type in counts) counts[e.type]++;
    s.events.length = 0;
  }
  return { state: s, counts, total: s.teams[0].score + s.teams[1].score };
}

test('a full match finishes with a believable scoreline', () => {
  const totals = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { state, total, counts } = playMatch(seed);
    assert.equal(state.phase, 'fulltime');
    assert.ok(counts.shot > 10, `only ${counts.shot} shots in the whole match`);
    assert.ok(counts.pass > 40, `only ${counts.pass} passes in the whole match`);
    assert.ok(total <= 14, `${total} goals is not a soccer score`);
    totals.push(total);
  }
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  // Arcade rules, so this is deliberately generous — but a match that ends
  // 20-nil means the keepers or the shooting have been mistuned.
  assert.ok(mean >= 1.5 && mean <= 8,
    `mean scoreline of ${mean.toFixed(1)} goals per match: ${totals.join(', ')}`);
});

test('keepers actually keep: most shots do not become goals', () => {
  let shots = 0, goals = 0, saves = 0;
  for (const seed of [11, 12, 13]) {
    const { counts, total } = playMatch(seed);
    shots += counts.shot; goals += total; saves += counts.save;
  }
  assert.ok(saves > 10, `keepers made only ${saves} saves across three matches`);
  assert.ok(goals / shots < 0.35,
    `${((goals / shots) * 100).toFixed(0)}% of shots were scored; the keepers are not keeping`);
});

test('nobody can dribble the ball out of the pitch', () => {
  const s = newMatch({ seed: 8, halfLength: 200 });
  run(s, 120);
  assert.ok(s.ball.x > FIELD.left - GOAL.depth && s.ball.x < FIELD.right + GOAL.depth);
  assert.ok(s.ball.y > FIELD.top - 1 && s.ball.y < FIELD.bottom + 1);
});
