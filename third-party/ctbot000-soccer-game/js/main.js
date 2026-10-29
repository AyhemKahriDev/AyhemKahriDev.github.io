// Glue: menu, the animation-frame loop, the HUD and the overlays.

import { TEAMS, createWorld } from './world.js';
import { advance, matchClock } from './sim.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const canvas = $('#pitch');
const stage = $('#stage');
const renderer = createRenderer(canvas);
const audio = createAudio();

const dom = {
  hud: $('#hud'),
  banner: $('#banner'),
  bannerTitle: $('[data-banner-title]'),
  bannerSub: $('[data-banner-sub]'),
  playerbar: $('#playerbar'),
  touch: $('#touch'),
  menu: $('#menu'),
  pause: $('#pause'),
  fulltime: $('#fulltime'),
  clock: $('[data-clock]'),
  half: $('[data-half]'),
  poss: $('[data-poss-home]'),
  stamina: $('[data-stamina]'),
  chargeWrap: $('[data-charge-wrap]'),
  charge: $('[data-charge]'),
  playerNum: $('[data-player-num]'),
  playerName: $('[data-player-name]'),
};

const settings = {
  home: 'azure',
  away: 'crimson',
  difficulty: 'normal',
  halfLength: 100,
  humanTeam: 0,
};

let state = null;
let paused = false;
let inMenu = true;
let lastTs = 0;
let bannerKey = '';

/* ------------------------------------------------------------------ input */

const input = createInput(stage, {
  onPause: () => { if (!inMenu) togglePause(); },
  onMute: () => setMuteLabel(audio.toggleMute()),
  onAnyInput: () => {
    audio.unlock();
    if (state && state.phase === 'halftime') state.resumeRequested = true;
  },
});

input.bindStick($('[data-stick]'));
input.bindButton($('[data-tbtn="shoot"]'), 'shoot');
input.bindButton($('[data-tbtn="pass"]'), 'pass');

if (matchMedia('(pointer: coarse)').matches) dom.touch.hidden = false;

/* ------------------------------------------------------------------- menu */

function buildTeamPickers() {
  for (const which of ['home', 'away']) {
    const box = $(`[data-teams="${which}"]`);
    box.innerHTML = '';
    for (const team of TEAMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `<span class="dot" style="background:${team.kit}"></span>${team.short}`;
      btn.title = team.name;
      btn.dataset.id = team.id;
      btn.addEventListener('click', () => {
        if (settings[which === 'home' ? 'away' : 'home'] === team.id) {
          // Swap rather than refuse: the click always means something.
          settings[which === 'home' ? 'away' : 'home'] = settings[which];
        }
        settings[which] = team.id;
        buildTeamPickers();
      });
      box.appendChild(btn);
    }
    syncTeamPicker(which);
  }
}

function syncTeamPicker(which) {
  const other = which === 'home' ? 'away' : 'home';
  const picked = TEAMS.find((t) => t.id === settings[which]);
  $(`[data-teamname="${which}"]`).textContent = picked ? picked.name : '';
  for (const btn of $$(`[data-teams="${which}"] button`)) {
    btn.classList.toggle('on', btn.dataset.id === settings[which]);
    btn.disabled = btn.dataset.id === settings[other];
  }
}

function bindSegmented(name, apply) {
  const group = $(`[data-seg="${name}"]`);
  for (const btn of $$('button', group)) {
    btn.addEventListener('click', () => {
      $$('button', group).forEach((b) => b.classList.toggle('on', b === btn));
      apply(btn.dataset.value);
    });
  }
}

bindSegmented('difficulty', (v) => { settings.difficulty = v; });
bindSegmented('half', (v) => { settings.halfLength = Number(v); });
buildTeamPickers();

/* ------------------------------------------------------------- match flow */

function startMatch(humanTeam) {
  settings.humanTeam = humanTeam;
  state = createWorld({
    homeId: settings.home,
    awayId: settings.away,
    difficulty: settings.difficulty,
    halfLength: settings.halfLength,
    humanTeam,
    seed: (Math.random() * 2 ** 31) | 0,
  });
  renderer.clearEffects();
  input.reset();
  inMenu = false;
  paused = false;
  bannerKey = '';
  lastTs = 0;
  dom.menu.hidden = true;
  dom.pause.hidden = true;
  dom.fulltime.hidden = true;
  dom.playerbar.hidden = humanTeam < 0;
  dom.touch.hidden = humanTeam < 0 || !matchMedia('(pointer: coarse)').matches;
  applyTeamColors();
  audio.unlock();
  audio.whistle(false);
}

function backToMenu() {
  inMenu = true;
  paused = false;
  dom.menu.hidden = false;
  dom.pause.hidden = true;
  dom.fulltime.hidden = true;
  dom.playerbar.hidden = true;
  dom.touch.hidden = true;
  startDemo();
}

/** A CPU-vs-CPU match runs behind the menu so the page is never a still image. */
function startDemo() {
  state = createWorld({
    homeId: settings.home,
    awayId: settings.away,
    difficulty: 'normal',
    halfLength: 600,
    humanTeam: -1,
    seed: (Math.random() * 2 ** 31) | 0,
  });
  renderer.clearEffects();
  lastTs = 0;
  applyTeamColors();
}

function applyTeamColors() {
  stage.style.setProperty('--home-kit', state.teams[0].kit);
  stage.style.setProperty('--away-kit', state.teams[1].kit);
  $('[data-chip="home"]').style.background = state.teams[0].kit;
  $('[data-chip="away"]').style.background = state.teams[1].kit;
  $('[data-abbr="home"]').textContent = state.teams[0].short;
  $('[data-abbr="away"]').textContent = state.teams[1].short;
}

function togglePause() {
  if (inMenu || state.phase === 'fulltime') return;
  paused = !paused;
  dom.pause.hidden = !paused;
  if (!paused) lastTs = 0;      // the baseline and the accumulator reset together
}

function setMuteLabel(m) {
  $('[data-act="mute"]').textContent = `Sound: ${m ? 'off' : 'on'}`;
}

$('#kickoff').addEventListener('click', () => startMatch(0));
$('#spectate').addEventListener('click', () => startMatch(-1));
$('#pausebtn').addEventListener('click', togglePause);
$('[data-act="resume"]').addEventListener('click', togglePause);
$('[data-act="mute"]').addEventListener('click', () => setMuteLabel(audio.toggleMute()));
$$('[data-act="quit"]').forEach((b) => b.addEventListener('click', backToMenu));
$('[data-act="rematch"]').addEventListener('click', () => startMatch(settings.humanTeam));

/* -------------------------------------------------------------------- HUD */

const hudCache = {};
function setText(node, value) {
  const key = node.dataset.k || (node.dataset.k = Math.random().toString(36));
  if (hudCache[key] === value) return;
  hudCache[key] = value;
  node.textContent = value;
}

function updateHud() {
  const [home, away] = state.teams;
  setText($('[data-score="home"]'), String(home.score));
  setText($('[data-score="away"]'), String(away.score));

  const clock = matchClock(state);
  setText(dom.clock, clock.text);
  setText(dom.half, state.phase === 'fulltime' ? 'full time'
    : state.phase === 'halftime' ? 'half time'
    : state.half === 1 ? '1st half' : '2nd half');

  const total = home.possessionTime + away.possessionTime;
  dom.poss.style.width = `${total > 1 ? (home.possessionTime / total) * 100 : 50}%`;

  if (state.controlled >= 0 && !dom.playerbar.hidden) {
    const p = state.players[state.controlled];
    setText(dom.playerNum, String(p.num));
    setText(dom.playerName, p.name);
    dom.playerNum.style.background = state.teams[p.team].kit;
    dom.stamina.style.width = `${p.stamina * 100}%`;
    dom.stamina.style.background = p.stamina < 0.25 ? '#f97316' : 'var(--accent)';
    const charging = input.charging;
    dom.chargeWrap.hidden = !charging;
    if (charging) dom.charge.style.width = `${input.chargePower() * 100}%`;
  }
}

function updateBanner() {
  let key = '', title = '', sub = '';
  const [home, away] = state.teams;

  if (state.phase === 'kickoff') {
    key = `ko-${state.half}-${home.score}-${away.score}`;
    title = 'KICK OFF';
    sub = `${state.teams[state.kickoffTeam].name} to start`;
  } else if (state.phase === 'goal') {
    const last = state.stats.goals[state.stats.goals.length - 1];
    key = `goal-${state.stats.goals.length}`;
    title = 'GOAL!';
    if (last) {
      const scorer = last.scorer >= 0 ? state.players[last.scorer] : null;
      sub = scorer
        ? `${state.teams[last.team].name} — ${scorer.name}${last.ownGoal ? ' (og)' : ''}`
        : state.teams[last.team].name;
    }
  } else if (state.phase === 'halftime') {
    key = 'ht';
    title = 'HALF TIME';
    sub = `${home.short} ${home.score} – ${away.score} ${away.short} · press to continue`;
  }

  if (key === bannerKey) return;
  bannerKey = key;
  if (!key) { dom.banner.hidden = true; return; }
  dom.bannerTitle.textContent = title;
  dom.bannerSub.textContent = sub;
  dom.banner.hidden = false;
  dom.banner.classList.remove('pop');
  void dom.banner.offsetWidth;   // restart the animation
  dom.banner.classList.add('pop');
}

function showFullTime() {
  const [home, away] = state.teams;
  const title = home.score === away.score ? 'Draw'
    : (home.score > away.score ? home.name : away.name) + ' win';
  $('[data-ft-title]').textContent = title;
  $('[data-ft-score]').textContent = `${home.score} – ${away.score}`;
  const list = $('[data-ft-scorers]');
  list.innerHTML = '';
  for (const g of state.stats.goals) {
    const li = document.createElement('li');
    const scorer = g.scorer >= 0 ? state.players[g.scorer].name : 'own goal';
    const mins = Math.floor(((g.half === 2 ? 45 : 0) + (g.clock / state.halfLength) * 45));
    li.innerHTML = `<span>${state.teams[g.team].short}</span> ${scorer}${g.ownGoal ? ' (og)' : ''} · ${mins}'`;
    list.appendChild(li);
  }
  dom.fulltime.hidden = false;
}

/* ------------------------------------------------------------------- loop */

function frame(ts) {
  requestAnimationFrame(frame);

  // Reset the timestamp baseline and the accumulator together: a stale
  // baseline drives the accumulator negative and the simulation silently stops.
  if (!lastTs) { lastTs = ts; state.acc = 0; }
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!(dt > 0)) dt = 0;

  if (!paused) {
    const wasFullTime = state.phase === 'fulltime';
    advance(state, dt, inMenu ? null : input.input);
    if (state.events.length) {
      renderer.handleEvents(state.events, state);
      audio.handleEvents(state.events);
      state.events.length = 0;
    }
    if (!inMenu && !wasFullTime && state.phase === 'fulltime') showFullTime();
    if (inMenu && state.phase === 'fulltime') startDemo();
  }

  renderer.draw(state, ts, dt);
  if (!inMenu) { updateHud(); updateBanner(); }
  else { dom.banner.hidden = true; bannerKey = ''; }
}

document.addEventListener('visibilitychange', () => {
  // Frames stop being delivered to a hidden tab, so drop anything mid-flight
  // and restart the clock rather than letting one huge delta through.
  if (document.hidden) renderer.clearEffects();
  lastTs = 0;
  input.reset();
});

window.addEventListener('resize', () => renderer.resize());

$('#menu').addEventListener('pointerdown', () => audio.unlock(), { once: true });
stage.addEventListener('pointerdown', () => {
  audio.unlock();
  if (state && state.phase === 'halftime') state.resumeRequested = true;
});

// A small hook for debugging from the console; the game never reads it.
window.touchline = {
  get state() { return state; },
  get paused() { return paused; },
  get inMenu() { return inMenu; },
  renderer,
  advance,
};

startDemo();
requestAnimationFrame(frame);
