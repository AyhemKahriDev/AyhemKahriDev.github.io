/* Smoke test v2: full game cycle in Node with DOM/Canvas/WebAudio stubs. */
"use strict";
const fs = require("fs");
const vm = require("vm");

const anyFn = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : anyFn),
  apply: () => anyFn, set: () => true, construct: () => anyFn,
});
function makeCtx() { return new Proxy({}, { get: () => anyFn, set: () => true }); }

const listeners = { window: {}, document: {} };
function collect(bag) { return (type, fn) => { (bag[type] = bag[type] || []).push(fn); }; }
function makeEl(tag) {
  const bag = {};
  const cls = new Set(["hidden"]); // panels start hidden as in the real DOM
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    style: {}, dataset: {},
    classList: { add: c => cls.add(c), remove: c => cls.delete(c),
                 toggle: c => cls.has(c) ? cls.delete(c) : cls.add(c),
                 contains: c => cls.has(c) },
    textContent: "", className: "", placeholder: "", href: "",
    value: "", checked: false, disabled: false,
    addEventListener: collect(bag), removeEventListener() {},
    listeners: bag,
    focus() {}, blur() {}, click() {}, select() {},
    appendChild() {}, removeChild() {}, setAttribute() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 672 }),
  };
  if (el.tagName === "CANVAS") { el.width = 300; el.height = 150; el.getContext = () => makeCtx(); }
  return el;
}
const els = new Map();
function getEl(id) {
  if (!els.has(id)) els.set(id, makeEl(id === "game" ? "canvas" : "div"));
  return els.get(id);
}

global.window = global; global.self = global;
global.dataLayer = []; // captures track() — event payload assertions
global.addEventListener = collect(listeners.window);
global.removeEventListener = () => {};
global.postMessage = () => {};
global.matchMedia = () => ({ matches: false });
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; return 1; };
global.document = {
  getElementById: getEl,
  createElement: t => makeEl(t),
  addEventListener: collect(listeners.document),
  removeEventListener() {},
  execCommand: () => true,
  visibilityState: "visible",
  body: makeEl("body"),
};
try { Object.defineProperty(global, "navigator", { value: { maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
global.AudioContext = function () {
  return new Proxy({
    currentTime: 0, sampleRate: 2048, state: "running", destination: {},
    createBuffer: () => ({ getChannelData: () => new Float32Array(2048) }),
    resume: () => Promise.resolve(),
  }, { get: (t, p) => (p in t ? t[p] : () => anyFn), set: () => true });
};

const html = fs.readFileSync(process.argv[2] || "/Users/kamiljablonski/Desktop/supciogame.nosync/index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length < 6) { console.error("FAIL: expected 6 script blocks, got", blocks.length); process.exit(1); }
let failures = 0;
function step(name, fn) {
  try { fn(); console.log("ok  -", name); }
  catch (e) { failures++; console.error("FAIL -", name, "::", e && e.stack || e); }
}
step("load scripts", () => { for (const b of blocks) vm.runInThisContext(b, { filename: "game.js" }); });
const HM = global.__HM__;
if (!HM) { console.error("FAIL: __HM__ not exported"); process.exit(1); }
const { G, CONFIG, ST, input } = HM;
const assert = (cond, msg) => { if (!cond) throw new Error("assert: " + msg); };
const fmtT = s => Math.floor(s / 60) + ":" + String(Math.floor(s) % 60).padStart(2, "0");

let clock = 1000;
function pump(seconds, perFrame) {
  const frames = Math.ceil(seconds / 0.05);
  for (let i = 0; i < frames; i++) {
    clock += 50;
    if (perFrame) perFrame(i);
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error("no RAF callback registered");
    cb(clock);
  }
}
function keydown(key) {
  for (const fn of listeners.window.keydown || [])
    fn({ key, repeat: false, target: { tagName: "DIV" }, preventDefault() {} });
}
function keyup(key) {
  for (const fn of listeners.window.keyup || [])
    fn({ key, repeat: false, target: { tagName: "DIV" }, preventDefault() {} });
}
function clickCanvas() {
  const cv = getEl("game");
  for (const fn of cv.listeners.click || [])
    fn({ clientX: 480, clientY: 336, target: cv, preventDefault() {} });
}

step("boot → TITLE, first frames render", () => {
  assert(G.state === "TITLE", "state TITLE, got " + G.state);
  pump(2);
});
step("click START → INTRO", () => {
  clickCanvas();
  assert(G.state === "INTRO", "state INTRO, got " + G.state);
  pump(1);
});
step("advance intro → DAYCARD → TUTORIAL", () => {
  for (let i = 0; i < 9; i++) { keydown(" "); pump(0.3); keyup(" "); }
  pump(2);
  assert(G.state === "TUTORIAL", "state TUTORIAL, got " + G.state);
});
step("tutorial: walk + print", () => {
  input.keys["arrowright"] = true; pump(1.2); input.keys["arrowright"] = false;
  assert(G.tut.step >= 1, "past move step, step=" + G.tut.step);
  G.player.x = ST.s1.hx; G.player.y = ST.s1.hy;
  input.keys[" "] = true; pump(3); input.keys[" "] = false;
  assert(G.player.pages >= 2, "printed 2, got " + G.player.pages);
});
step("tutorial: type → floppy → zoe → stamp", () => {
  G.player.x = ST.s3.hx; G.player.y = ST.s3.hy;
  input.keys[" "] = true; pump(4); input.keys[" "] = false;
  assert(G.typed >= 2, "typed 2, got " + G.typed);
  input.keys[" "] = true; pump(1); input.keys[" "] = false;
  assert(G.player.floppy === true, "carrying floppy");
  G.player.x = ST.s4.hx; G.player.y = ST.s4.hy;
  input.keys[" "] = true; pump(1); input.keys[" "] = false;
  assert(G.s4.q === 1, "zoe has floppy");
  pump(CONFIG.TUTORIAL.zoe + 0.5);
  assert(G.desk.reports > 0, "reports appeared");
  G.player.x = ST.desk.hx; G.player.y = ST.desk.hy;
  input.keys[" "] = true; pump(2); input.keys[" "] = false;
  assert(G.booked >= 2, "booked 2, got " + G.booked);
});
step("tutorial: phone Y/N + coffee + shift start", () => {
  pump(0.2);
  assert(G.tut.step >= 6, "at phone step, step=" + G.tut.step);
  assert(G.phone.ringing, "phone ringing");
  G.player.x = ST.phone.hx; G.player.y = ST.phone.hy;
  input.keys[" "] = true; pump(0.6); input.keys[" "] = false;
  assert(G.phoneAnswered && G.phone.call && G.phone.call.phase === "ask", "call question shown");
  keydown("y"); pump(0.2); keyup("y");
  assert(G.phone.call.phase === "result", "answer chosen");
  pump(CONFIG.PHONE.resultDur + 0.3);
  assert(!G.phone.call, "call finished");
  pump(0.3);
  assert(G.tut.step >= 7, "at coffee step, step=" + G.tut.step);
  G.player.x = ST.coffee.hx; G.player.y = ST.coffee.hy;
  input.keys[" "] = true; pump(5); input.keys[" "] = false;
  assert(G.energy > 60, "energy refilled, got " + G.energy);
  pump(3);
  assert(G.state === "RUN" && G.mode === "run", "run started");
  assert(G.player.x === ST.coffee.hx && G.player.y === ST.coffee.hy, "smooth transition: no teleport");
  assert(G.runT < 5, "shift clock restarted, runT=" + G.runT.toFixed(1));
});
step("sprint: shift = faster + more coffee burn", () => {
  G.player.x = 90; G.player.y = 300; G.energy = 100; G.dayT = 0;
  input.keys["arrowright"] = true;
  pump(1);
  const walkDist = G.player.x - 90, walkEnergy = 100 - G.energy;
  G.player.x = 90; G.energy = 100;
  input.keys["shift"] = true;
  pump(1);
  input.keys["arrowright"] = false; input.keys["shift"] = false;
  const sprintDist = G.player.x - 90, sprintEnergy = 100 - G.energy;
  console.log(`      walk ${walkDist.toFixed(0)}px/-${walkEnergy.toFixed(1)}en | sprint ${sprintDist.toFixed(0)}px/-${sprintEnergy.toFixed(1)}en`);
  assert(sprintDist > walkDist * 1.3, "sprint faster");
  assert(sprintEnergy > walkEnergy * 2, "sprint drains more");
  pump(0.1);
  assert(!G.player.sprinting, "flag cleared");
});
step("coffee reachable from above AND right", () => {
  G.player.x = 36; G.player.y = 281; G.energy = 40;
  input.keys[" "] = true; pump(4.6); input.keys[" "] = false;
  assert(G.energy > 80, "brewed from above, en=" + G.energy.toFixed(0));
  G.player.x = 60; G.player.y = 300; G.energy = 30;
  input.keys[" "] = true; pump(4.6); input.keys[" "] = false;
  assert(G.energy > 70, "brewed from right, en=" + G.energy.toFixed(0));
});
step("4 coffees in a row = heart attack; any action breaks the streak", () => {
  // streak of 3 coffees + a print = streak broken
  G.coffeeStreak = CONFIG.ENERGY.heartAt - 1;
  G.s1.q.push({ born: G.runT });
  G.player.x = ST.s1.hx; G.player.y = ST.s1.hy;
  input.keys[" "] = true; pump(1.4); input.keys[" "] = false;
  assert(G.player.pages > 0, "printed a page");
  assert(G.coffeeStreak === 0, "action broke the streak, got " + G.coffeeStreak);
  // 4 coffees in a row = heart attack
  G.coffeeStreak = CONFIG.ENERGY.heartAt - 1;
  G.energy = 40; G.stress = 0;
  G.player.x = ST.coffee.hx; G.player.y = ST.coffee.hy;
  input.keys[" "] = true; pump(4.6); input.keys[" "] = false;
  assert(G.state === "DYING" && G.dying.cause === "heart",
    "heart attack, got " + G.state + "/" + (G.dying.cause || "?"));
  pump(2.6);
  assert(G.state === "CONVERSION", "conversion after heart attack");
  keydown("r"); pump(0.3); keyup("r");
  assert(G.state === "RUN" && G.day === 1 && G.coffeeStreak === 0, "restarted, streak reset");
});
step("day cycle: 17:00 → DAYEND → morning of day 2", () => {
  G.stress = 60; G.energy = 50;
  G.dayT = CONFIG.DAY.length - 0.3;
  pump(0.6);
  assert(G.state === "DAYEND", "state DAYEND, got " + G.state);
  keydown(" "); pump(0.3); keyup(" ");
  assert(G.state === "DAYCARD", "morning card, got " + G.state);
  pump(CONFIG.UI.daycardDur + 0.3);
  assert(G.state === "RUN", "back to RUN, got " + G.state);
  assert(G.day === 2, "day 2, got " + G.day);
  assert(G.energy > CONFIG.ENERGY.max - 2, "slept well, en=" + G.energy.toFixed(1));
  assert(G.stress <= 60 - CONFIG.STRESS.nightRelief + 1, "night relief, stress=" + G.stress.toFixed(0));
});
step("upgrades: tiered quick-buy 1-6, levels + effects", () => {
  G.respect = 95; G.dayT = 0; G.stress = 0;
  const cost = (i, l) => HM.UPGRADES[i].levels[l].cost;
  // modifier chord (Cmd/Ctrl+1) = browser shortcut, not a purchase
  for (const fn of listeners.window.keydown || [])
    fn({ key: "1", metaKey: true, repeat: false, target: { tagName: "DIV" }, preventDefault() {} });
  pump(0.1);
  assert(!G.upg.trolley && G.respect === 95, "modifier chord ignored");
  // trolley to max (LV1-LV3) + bounce off MAX
  for (let i = 0; i < 4; i++) { keydown("1"); pump(0.1); keyup("1"); }
  assert(G.upg.trolley === 3, "trolley maxed, got " + G.upg.trolley);
  assert(G.respect === 95 - cost(0, 0) - cost(0, 1) - cost(0, 2), "respect spent, got " + G.respect);
  // macro to max (LV2 = whole stack)
  keydown("2"); pump(0.1); keyup("2");
  keydown("2"); pump(0.1); keyup("2");
  assert(G.upg.macro === 2, "macro maxed, got " + G.upg.macro);
  // WELLBEING (key 7): consumable — halves stress, buyable repeatedly
  G.stress = 80;
  const rBefore = G.respect;
  keydown("7"); pump(0.1); keyup("7");
  assert(Math.abs(G.stress - 40) < 2, "wellbeing halved stress, got " + G.stress.toFixed(1));
  assert(G.wellbeings === 1, "wellbeing counted");
  assert(G.respect === rBefore - HM.UPGRADES[6].consumable.cost, "wellbeing paid, got " + G.respect);
  // price rises by costStep: second session = 15R, at 20R the guard blocks (5 < 10 would remain)
  keydown("7"); pump(0.1); keyup("7");
  assert(G.wellbeings === 1, "escalated price blocked by guard, got " + G.wellbeings);
  G.respect = 40;
  keydown("7"); pump(0.1); keyup("7");
  const c2 = HM.UPGRADES[6].consumable;
  assert(G.wellbeings === 2 && G.respect === 40 - (c2.cost + c2.costStep),
    "second breath cost " + (c2.cost + c2.costStep) + "R, respect " + G.respect);
  // trolley LV3: carry capacity per TIERS.pages
  const maxPages = CONFIG.TIERS.pages[3];
  for (let i = 0; i < maxPages + 2; i++) G.s1.q.push({ born: G.runT });
  G.player.x = ST.s1.hx; G.player.y = ST.s1.hy;
  input.keys[" "] = true; pump(maxPages + 2); input.keys[" "] = false;
  assert(G.player.pages === maxPages, "carrying " + maxPages + " pages, got " + G.player.pages);
  // macro LV2: whole stack in one hold
  const typedBefore = G.typed;
  G.player.x = ST.s3.hx; G.player.y = ST.s3.hy;
  input.keys[" "] = true; pump(CONFIG.TIMES.typeAllBase + CONFIG.TIMES.typeAllPer * maxPages + 0.4); input.keys[" "] = false;
  assert(G.typed - typedBefore === maxPages, "macro typed " + maxPages + ", got " + (G.typed - typedBefore));
  assert(G.player.pages === 0, "hands empty");
  // minRespectLeft guard: at 12R a 5R purchase would leave 7 < 10 = refusal
  G.respect = 12;
  keydown("3"); pump(0.1); keyup("3");
  assert(!G.upg.laser, "guard blocks quick-buy below minRespectLeft");
});
step("PHONE_QA: ≥30 entries, valid, full glyph coverage", () => {
  const QA = HM.PHONE_QA, FONT = HM.FONT;
  const all = [...QA.client, ...QA.chad];
  assert(all.length >= 30, "entry count " + all.length);
  const fxKeys = new Set(["stress", "respect", "energy", "invoices"]);
  const missing = new Set();
  const checkText = t => { for (const ch of t.toUpperCase()) if (!FONT[ch]) missing.add(ch); };
  for (const e of all) {
    assert(e.q && e.yes && e.no, "entry complete: " + (e.q || "?"));
    for (const opt of [e.yes, e.no]) {
      assert(opt.t && opt.r && opt.fx && Object.keys(opt.fx).length, "option complete in: " + e.q);
      for (const k of Object.keys(opt.fx)) assert(fxKeys.has(k), `unknown fx "${k}"`);
      checkText(opt.t); checkText(opt.r);
    }
    checkText(e.q);
  }
  checkText(QA.timeout.r);
  // glyph coverage also for shop and station labels
  for (const u of HM.UPGRADES) {
    checkText(u.short);
    for (const L of u.levels || []) checkText(L.tip);
    if (u.consumable) checkText(u.consumable.tip);
  }
  checkText(HM.STRINGS.shop.title); checkText(HM.STRINGS.shop.poor); checkText(HM.STRINGS.shop.max);
  checkText(HM.STRINGS.heartWarning); checkText(HM.STRINGS.causes.heart);
  for (const k in HM.STRINGS.stations) checkText(HM.STRINGS.stations[k]);
  assert(missing.size === 0, "chars without glyphs: " + [...missing].join(" "));
  console.log(`      ${QA.client.length} client + ${QA.chad.length} chad questions, glyphs OK`);
});
step("run: chaotic play until inevitable death", () => {
  let dir = 1, frames = 0;
  const spots = [ST.s1, ST.s3, ST.desk, ST.s2, ST.coffee, ST.s4, ST.phone];
  while (G.state === "RUN" && frames < 24000) { // up to 20 min
    if (frames % 40 === 0) { const s = spots[(frames / 40) % spots.length | 0]; G.player.x = s.hx; G.player.y = s.hy; }
    input.keys[" "] = frames % 3 !== 0;
    input.keys["arrowleft"] = (frames % 7 === 0) && (dir = -dir) > 0;
    input.keys["arrowdown"] = frames % 11 === 0;
    if (G.phone.call && frames % 30 === 0) keydown(frames % 60 === 0 ? "y" : "n");
    if (G.state === "DAYEND") { keydown(" "); keyup(" "); }
    pump(0.05);
    frames++;
  }
  input.keys[" "] = false; input.keys["arrowleft"] = false; input.keys["arrowdown"] = false;
  // bot may have ended in DAYEND/DAYCARD — push it through
  let guard = 0;
  while (G.state !== "DYING" && G.state !== "CONVERSION" && guard++ < 600) {
    if (G.state === "DAYEND") { keydown(" "); keyup(" "); }
    if (G.state === "RUN") G.energy = 0.01;
    pump(0.1);
  }
  console.log("      bot: day", G.lastRun.day, "| time", fmtT(G.lastRun.seconds), "| booked", G.lastRun.booked, "| cause", G.dying.cause);
  pump(3);
  assert(G.state === "CONVERSION", "reached CONVERSION, got " + G.state);
  assert(G.lastRun.day >= 1, "run stats captured");
});
step("restart + pause/mute + blur", () => {
  keydown("r"); pump(0.3);
  assert(G.state === "RUN", "restarted");
  assert(!G.upg.trolley && G.day === 1, "upgrades and day reset");
  keydown("p"); pump(0.3);
  assert(G.paused, "paused");
  const t0 = G.runT; pump(1);
  assert(Math.abs(G.runT - t0) < 0.001, "frozen");
  keydown("p"); pump(0.3);
  assert(!G.paused, "resumed");
  keydown("m"); pump(0.1); assert(HM.A.muted, "muted"); keydown("m"); pump(0.1);
  for (const fn of listeners.window.blur || []) fn({});
  pump(0.2);
  assert(G.paused && G.pausedByBlur, "paused by blur");
  clickCanvas(); pump(0.2);
  assert(!G.paused, "click resumes");
});
step("death by energy → CONVERSION (canvas game-over, no DOM capture)", () => {
  G.energy = 0.01;
  pump(0.3);
  assert(G.state === "DYING" && G.dying.cause === "energy", "energy death");
  pump(2.6);
  assert(G.state === "CONVERSION", "conversion");
  // no email-capture DOM exists anymore
  assert(HM.STRINGS.conv.emailPh === undefined, "no email strings in game");
});
step("death by stress path", () => {
  keydown("r"); pump(0.3);
  G.stress = 99.9;
  for (let i = 0; i < 20; i++) G.s1.q.push({ born: -100 });
  pump(1);
  assert(G.state === "DYING" && G.dying.cause === "stress", "stress death");
  pump(3);
  assert(G.state === "CONVERSION", "back to CONVERSION");
});
step("embed mode: run_end full stats, parent restart", () => {
  HM.setEmbed(true);
  keydown("r"); pump(0.3); keyup("r");
  assert(G.state === "RUN", "fresh run");
  G.energy = 0.01; pump(0.3);
  pump(2.6);
  assert(G.state === "CONVERSION", "conversion state reached");
  const re = global.dataLayer.filter(e => e.event === "run_end").pop();
  for (const k of ["seconds", "booked", "cause", "respect", "day", "coffees", "meters"])
    assert(re && k in re, "run_end has " + k + ": " + JSON.stringify(re));
  for (const fn of listeners.window.message || [])
    fn({ data: { source: "hm-player", cmd: "restart" } });
  pump(0.2);
  assert(G.state === "RUN", "parent restart worked");
  HM.setEmbed(false);
});

setTimeout(() => {
  // privacy invariant: no event payload ever carries an email/PII field
  for (const e of global.dataLayer)
    for (const k of Object.keys(e))
      if (/email|mail|consent|nick/i.test(k)) { failures++; console.error("FAIL - event leaks PII field:", e); }
  console.log(failures === 0 ? "\nSMOKE PASSED" : "\nSMOKE FAILED: " + failures);
  process.exit(failures === 0 ? 0 : 1);
}, 800);
