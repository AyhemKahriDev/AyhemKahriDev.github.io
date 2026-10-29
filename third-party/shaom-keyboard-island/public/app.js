"use strict";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  dialog = $("#dialog");
const STORE = "keyboard-island-v1";
const defaults = {
  shells: 0,
  total: 0,
  rounds: 0,
  keys: {},
  owned: [],
  sound: true,
  music: true,
  voice: false,
  volume: 0.65,
  sticker: "🌟",
  reduced: false,
  seconds: 0,
  completed: {},
  checkpoint: null,
  handGuide: true,
  roomLayout: {},
};
let data;
try {
  data = JSON.parse(localStorage.getItem(STORE) || "null");
} catch {}
const state = {
  ...defaults,
  ...(data && typeof data === "object" ? data : {}),
};
for (const k of ["shells", "total", "rounds", "seconds"])
  if (!Number.isFinite(state[k]) || state[k] < 0) state[k] = 0;
for (const k of ["keys", "completed"])
  if (!state[k] || typeof state[k] !== "object" || Array.isArray(state[k]))
    state[k] = {};
if (!Array.isArray(state.owned)) state.owned = [];
for (const k of Object.keys(state.completed))
  if (
    !CHAPTERS[Number(k)] ||
    !Number.isInteger(state.completed[k]?.stars) ||
    state.completed[k].stars < 1 ||
    state.completed[k].stars > 3
  )
    delete state.completed[k];
let homeWorldBand = 0;
let page = "home",
  game = null,
  mapWorld = 0,
  labKey = "F",
  audioContext,
  ambientTimer,
  hintTimer,
  advanceTimer,
  toastTimer,
  pauseStarted = 0,
  freeNotes = [],
  showMemory = false;
const heldShifts = new Set();
const FINGERS = [
  {
    id: "lp",
    name: "左手小指",
    home: "A",
    keys: "QAZ1",
    color: "#c48e8f",
    side: "左",
  },
  {
    id: "lr",
    name: "左手无名指",
    home: "S",
    keys: "WSX2",
    color: "#c7a052",
    side: "左",
  },
  {
    id: "lm",
    name: "左手中指",
    home: "D",
    keys: "EDC3",
    color: "#82a27f",
    side: "左",
  },
  {
    id: "li",
    name: "左手食指",
    home: "F",
    keys: "RFTGVB45",
    color: "#6f9eaf",
    side: "左",
  },
  {
    id: "ri",
    name: "右手食指",
    home: "J",
    keys: "YHUJNM67",
    color: "#6f9eaf",
    side: "右",
  },
  {
    id: "rm",
    name: "右手中指",
    home: "K",
    keys: "IK,8",
    color: "#82a27f",
    side: "右",
  },
  {
    id: "rr",
    name: "右手无名指",
    home: "L",
    keys: "OL.9",
    color: "#c7a052",
    side: "右",
  },
  {
    id: "rp",
    name: "右手小指",
    home: ";",
    keys: "P;/0",
    color: "#c48e8f",
    side: "右",
  },
  {
    id: "thumb",
    name: "拇指",
    home: "空格",
    keys: "",
    color: "#a598b7",
    side: "两",
  },
];
function baseKey(k) {
  return k?.replace("SHIFT+", "") || "F";
}
function fingerFor(k) {
  k = baseKey(k);
  return k === "SPACE"
    ? FINGERS[8]
    : ["ENTER", "BACKSPACE"].includes(k)
      ? FINGERS[7]
      : FINGERS.find((f) => f.keys.includes(k)) || FINGERS[3];
}
function keyName(k, lower = false) {
  if (!k) return "";
  if (k.startsWith("SHIFT+")) return "Shift + " + baseKey(k);
  return (
    { SPACE: "空格", ENTER: "回车 ↵", BACKSPACE: "退格 ⌫" }[k] ||
    (lower ? k.toLowerCase() : k)
  );
}
function completedCount() {
  return Object.keys(state.completed).length;
}
function nextChapter() {
  return (
    CHAPTERS.find((c) => !state.completed[c.id])?.id ?? CHAPTERS.length - 1
  );
}
function isUnlocked(id) {
  return id === 0 || !!state.completed[id - 1] || !!state.completed[id];
}
function phaseInfo(g = game) {
  let offset = 0;
  for (let i = 0; i < g.chapter.phases.length; i++) {
    const phase = g.chapter.phases[i];
    if (g.step < offset + phase.keys.length)
      return { index: i, beat: g.step - offset, offset, phase };
    offset += phase.keys.length;
  }
  const index = 2;
  return {
    index,
    beat: g.chapter.phases[index].keys.length,
    offset: offset - g.chapter.phases[index].keys.length,
    phase: g.chapter.phases[index],
  };
}
function currentTarget() {
  return game?.sequence[game.step];
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    toast("浏览器暂时不能存档，请保持页面打开。");
  }
  updateHeader();
}
function persistCheckpoint() {
  if (!game) return;
  state.checkpoint = {
    chapter: game.chapter.id,
    step: game.step,
    wrong: game.wrong,
    hints: game.hints,
    typed: game.typed,
    elapsed:
      game.elapsed +
      Math.floor((Date.now() - game.started - game.pausedMs) / 1000),
    sequence: game.sequence,
  };
  save();
}
function updateHeader() {
  $("#shells").textContent = state.shells;
  $("#sound").innerHTML = playIcon(state.sound ? "sound" : "mute");
  $("#sound").setAttribute("aria-label", state.sound ? "关闭音效" : "开启音效");
  $("#sound").title = state.sound ? "关闭音效" : "开启音效";
  document.body.classList.toggle("reduced", state.reduced);
  if (IslandAudio.ctx && IslandAudio.master)
    IslandAudio.master.gain.setTargetAtTime(
      state.sound ? (state.volume ?? 0.65) : 0,
      IslandAudio.ctx.currentTime,
      0.02,
    );
  if (!state.sound || !state.voice) VoiceDirector.stop("mute");
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function initAudio() {
  IslandAudio.init();
}
function instrument(
  freq,
  type = "sine",
  length = 0.32,
  gain = 0.07,
  slide = 0,
) {
  IslandAudio.note(freq, { type, length, gain, slide });
}
function noise(duration = 0.18, filter = 1000, gain = 0.055) {
  IslandAudio.hiss(duration, filter, gain);
}
function chime() {
  IslandAudio.celebrate();
}
function soundAction(ch, step, phase) {
  IslandAudio.action(ch, step, phase);
}
function startAmbient() {
  clearInterval(ambientTimer);
  ambientTimer = IslandAudio.music();
}
function stopTimers() {
  clearTimeout(hintTimer);
  clearTimeout(advanceTimer);
  clearInterval(ambientTimer);
}
function clearGame() {
  if (typeof DiverGame !== "undefined") DiverGame.stop();
  VoiceDirector.stop();
  if (pauseStarted && game && !game.finished)
    game.pausedMs += Date.now() - pauseStarted;
  pauseStarted = 0;
  if (game && !game.finished) persistCheckpoint();
  stopTimers();
  $("#party-layer")?.replaceChildren();
  game = null;
  showMemory = false;
}
function navigate(next) {
  clearGame();
  if (dialog.open) dialog.close();
  page = next;
  if (next === "map") mapWorld = Math.floor(nextChapter() / 6);
  render();
}
function home() {
  const id = state.checkpoint?.chapter ?? nextChapter();
  return `<div class="play-home"><section class="play-island"><div class="home-art">${happyIsland()}</div><h1>键盘小岛</h1><div class="island-logo-spark">✦</div><button class="home-buddy" data-tickle aria-label="摸摸豆豆">${otter()}<span>♫</span></button><button class="big-play" data-continue aria-label="${state.checkpoint ? "继续上次的冒险" : "开始冒险"}"><span class="play-triangle">▶</span><b>${state.checkpoint ? "继续" : "开始"}</b></button><button class="toy-button home-hands" data-page="lab" aria-label="手指怎么放">${handSvg("F", true)}<span>手指</span></button><button class="toy-button home-diver" data-diver-open aria-label="实时潜水员体验"><span>🤿</span><div><b>变身潜水员</b><small>摄像头体验</small></div></button><div class="home-progress" aria-label="已经完成 ${completedCount()} 章"><span>★</span>${completedCount()} / ${CHAPTERS.length}</div><div class="next-picture">${sceneThumb(CHAPTERS[id])}<span>${id + 1}</span></div></section><div class="world-browser"><button data-home-band="-1" aria-label="上一组世界" ${homeWorldBand === 0 ? "disabled" : ""}>‹</button><div class="picture-worlds">${WORLDS.map(
    (w, i) => ({ w, i }),
  )
    .slice(homeWorldBand * 6, homeWorldBand * 6 + 6)
    .map(
      ({ w, i }) =>
        `<button data-world="${i}" aria-label="${w.name}" style="--world-color:${playColors[i][0]}">${worldPicture(i)}<span>${w.name}</span><b>${CHAPTERS.slice(i * 6, i * 6 + 6).every((c) => state.completed[c.id]) ? "★" : i + 1}</b></button>`,
    )
    .join(
      "",
    )}</div><button data-home-band="1" aria-label="下一组世界" ${homeWorldBand >= Math.ceil(WORLDS.length / 6) - 1 ? "disabled" : ""}>›</button></div></div>`;
}
function mapView() {
  const w = WORLDS[mapWorld];
  return `<div class="picture-map"><div class="map-world-browser"><button class="world-page-button" data-world-page="-1" aria-label="上一组世界" ${mapWorld < 6 ? "disabled" : ""}>‹</button><div class="picture-world-tabs" role="tablist" aria-label="冒险世界">${WORLDS.map(
    (world, i) => ({ world, i }),
  )
    .slice(Math.floor(mapWorld / 6) * 6, Math.floor(mapWorld / 6) * 6 + 6)
    .map(
      ({ world, i }) =>
        `<button role="tab" aria-selected="${i === mapWorld}" class="${i === mapWorld ? "selected" : ""}" data-world="${i}" aria-label="${world.name}">${worldPicture(i)}<b>${i + 1}</b></button>`,
    )
    .join(
      "",
    )}</div><button class="world-page-button" data-world-page="1" aria-label="下一组世界" ${mapWorld >= Math.floor((WORLDS.length - 1) / 6) * 6 ? "disabled" : ""}>›</button></div><section class="picture-route ${WORLDS[mapWorld].night || [3, 5].includes(mapWorld) ? "night-route" : ""}" style="--map-bg:${playColors[mapWorld][0]}"><h1>${w.name}</h1><div class="route-dashes" aria-hidden="true"></div><div class="picture-chapters">${CHAPTERS.slice(
    mapWorld * 6,
    mapWorld * 6 + 6,
  )
    .map((ch) => {
      const done = state.completed[ch.id],
        open = isUnlocked(ch.id);
      return `<button class="picture-chapter ${open ? "available" : "locked"} ${done ? "completed" : ""}" data-preview="${ch.id}" aria-label="第 ${ch.id + 1} 章 ${ch.title}${done ? " 已完成" : open ? " 可以开始" : " 尚未解锁"}"><span class="chapter-picture">${sceneThumb(ch)}</span><b class="chapter-number">${ch.id + 1}</b>${!open ? `<span class="picture-lock">${playIcon("lock")}</span>` : `<span class="chapter-play">${done ? "✓" : "▶"}</span>`}<span class="chapter-caption">${ch.title}</span><span class="picture-stars">${done ? "★".repeat(done.stars) : "☆☆☆"}</span></button>`;
    })
    .join(
      "",
    )}</div></section><div class="map-quick"><button class="round-action" data-page="home" aria-label="回到小岛">${playIcon("home")}</button><button class="round-action" data-page="lab" aria-label="手指怎么放">${playIcon("hand")}</button><span>★ ${completedCount()} / ${CHAPTERS.length}</span></div></div>`;
}
function previewChapter(id) {
  const ch = CHAPTERS[id];
  if (!ch) return;
  const open = isUnlocked(id);
  openDialog(
    `<button class="dialog-close" data-close aria-label="关闭">×</button><div class="picture-preview">${sceneThumb(ch)}<h2>${ch.title}</h2><div class="preview-keycaps">${[
      ...new Set(ch.phases[0].keys),
    ]
      .slice(0, 4)
      .map((k) => `<span>${keyName(k, ch.lower)}</span>`)
      .join(
        "",
      )}</div>${open ? `<button class="big-play modal-play" data-chapter="${id}" aria-label="开始这一章"><span>▶</span></button>` : `<div class="locked-preview">${playIcon("lock")}<span class="sr-only">先完成第 ${id} 章</span></div><button class="primary" data-chapter="${nextChapter()}" aria-label="继续当前冒险">▶</button>`}<button class="voice-button" data-quest="${id}" aria-label="听听这一章要做什么">${playIcon("sound")}</button></div>`,
  );
}
function makeSequence(ch) {
  const seq = ch.phases.flatMap((p) => p.keys);
  if (ch.review) {
    const keys = Object.entries(state.keys)
      .filter(([k, v]) => /^[A-Z]$/.test(k) && v.good > 0)
      .sort(
        (a, b) =>
          b[1].miss / Math.max(1, b[1].good) -
          a[1].miss / Math.max(1, a[1].good),
      )
      .slice(0, 6)
      .map(([k]) => k);
    if (keys.length >= 2) return seq.map((k, i) => keys[i % keys.length]);
  }
  return seq;
}
function startChapter(id, resume = false) {
  const ch = CHAPTERS[Number(id)];
  if (!ch || !isUnlocked(ch.id)) {
    toast("先完成前一章，我们就能去这里。");
    return;
  }
  clearGame();
  const cp =
      resume && state.checkpoint?.chapter === ch.id ? state.checkpoint : null,
    seq = makeSequence(ch);
  const valid =
    cp &&
    Number.isInteger(cp.step) &&
    cp.step >= 0 &&
    cp.step <= seq.length &&
    Array.isArray(cp.sequence) &&
    cp.sequence.length === seq.length &&
    cp.sequence.every((k) => validKey(k));
  game = {
    chapter: ch,
    sequence: valid ? cp.sequence : seq,
    step: valid ? cp.step : 0,
    wrong: valid ? cp.wrong || 0 : 0,
    hints: valid ? cp.hints || 0 : 0,
    typed: valid && typeof cp.typed === "string" ? cp.typed : "",
    elapsed: valid ? cp.elapsed || 0 : 0,
    started: Date.now(),
    pausedMs: 0,
    locked: false,
    finished: false,
    history: [],
    hideHints: false,
    lastHintStep: -1,
  };
  page = "game";
  showMemory = false;
  if (game.step === game.sequence.length) {
    game.step--;
    game.locked = true;
    render();
    game.step++;
    finish();
    return;
  }
  persistCheckpoint();
  render();
  initAudio();
  startAmbient();
  VoiceDirector.chapter(ch, !!valid);
}
function validKey(k) {
  return (
    typeof k === "string" &&
    (/^[A-Z0-9;,./]$/.test(k) ||
      /^SHIFT\+[A-Z]$/.test(k) ||
      ["SPACE", "BACKSPACE", "ENTER"].includes(k))
  );
}
function continueJourney() {
  const cp = state.checkpoint;
  if (cp && CHAPTERS[cp.chapter] && isUnlocked(cp.chapter))
    startChapter(cp.chapter, true);
  else startChapter(nextChapter());
}
function handSvg(active = "F", small = false) {
  const f = fingerFor(active),
    shift = active.startsWith("SHIFT+");
  return svg(
    `<g font-family="sans-serif">${["左手", "右手"]
      .map((label, side) => {
        const ids =
          side === 0
            ? ["lp", "lr", "lm", "li", "thumb"]
            : ["thumb", "ri", "rm", "rr", "rp"];
        return `<g transform="translate(${side * 180} 0)"><path d="M26 85Q25 48 58 55H119Q154 50 155 85V116Q150 140 91 140Q31 140 26 116Z" fill="#e7d8ba"/>${ids
          .map((id, i) => {
            const item = FINGERS.find((x) => x.id === id),
              x = 12 + i * 31,
              y = id === "thumb" ? 78 : [45, 20, 10, 25, 45][i],
              height = 110 - y,
              lit =
                id === f.id ||
                (shift && id === (f.side === "左" ? "rp" : "lp"));
            return `<rect class="${lit ? "active-finger" : ""}" x="${x}" y="${y}" width="26" height="${height}" rx="13" fill="${lit ? item.color : "#dfd2b6"}" stroke="${lit ? "#faf4d9" : "#cbbd9f"}" stroke-width="2"/><text x="${x + 13}" y="${y + 22}" text-anchor="middle" font-size="18" fill="${lit ? "#fffaf0" : "#847a62"}">${id === "thumb" ? "空" : item.home}</text>`;
          })
          .join(
            "",
          )}<text x="88" y="159" text-anchor="middle" fill="#7e8877" font-size="11">${label}</text></g>`;
      })
      .join("")}</g>`,
    "0 0 360 166",
    small ? "hand-art small" : "hand-art",
  );
}
function guidance(k) {
  const f = fingerFor(k),
    key = baseKey(k);
  if (k.startsWith("SHIFT+"))
    return `${f.name}按 ${key}，另一只手的小指按住 Shift。`;
  if (key === "SPACE") return "用拇指按键盘下方最长的空格键。";
  if (key === "BACKSPACE")
    return "右手小指按右上方的 Backspace，删掉前一个字母。";
  if (key === "ENTER") return "右手小指按回车，表示这一份完成了。";
  if (key === f.home)
    return `${f.name}轻放在 ${key}。${key === "F" || key === "J" ? "摸摸键帽上的小凸起。" : "按完让手指留在这里。"}`;
  return `${f.name}从 ${f.home} 找到 ${key}，按完回到 ${f.home}。`;
}
function keyboard(active = "", clickable = false, allColors = false) {
  const current = baseKey(active),
    keys = game ? new Set(game.sequence.map(baseKey)) : new Set(),
    hide = game?.hideHints && !showMemory;
  const rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL;", "ZXCVBNM,./"];
  return `<div class="keyboard ${allColors ? "colored" : ""}" aria-label="实体键盘位置图">${rows
    .map(
      (row, r) =>
        `<div class="key-row row-${r}">${[...row]
          .map((k) => {
            const finger = fingerFor(k);
            return `<${clickable ? "button" : "div"} class="key ${keys.has(k) ? "new" : ""} ${k === current && !hide ? "target" : ""}" data-key="${k}" style="--finger:${finger.color}" ${clickable ? `aria-label="认识 ${k}"` : ""}>${k}</${clickable ? "button" : "div"}>`;
          })
          .join(
            "",
          )}${r === 0 ? `<${clickable ? "button" : "div"} class="key special backspace ${current === "BACKSPACE" && !hide ? "target" : ""}" data-key="BACKSPACE">⌫</${clickable ? "button" : "div"}>` : ""}${r === 2 ? `<${clickable ? "button" : "div"} class="key special enter ${current === "ENTER" && !hide ? "target" : ""}" data-key="ENTER">↵</${clickable ? "button" : "div"}>` : ""}</div>`,
    )
    .join(
      "",
    )}<div class="key-row bottom-row"><${clickable ? "button" : "div"} class="key shift ${active.startsWith("SHIFT+") && fingerFor(active).side === "右" && !hide ? "target" : ""}" data-key="SHIFT">Shift</${clickable ? "button" : "div"}><${clickable ? "button" : "div"} class="key space ${current === "SPACE" && !hide ? "target" : ""}" data-key="SPACE">空格 SPACE</${clickable ? "button" : "div"}><${clickable ? "button" : "div"} class="key shift ${active.startsWith("SHIFT+") && fingerFor(active).side === "左" && !hide ? "target" : ""}" data-key="SHIFT-R">Shift</${clickable ? "button" : "div"}></div></div>`;
}
function gameView() {
  const ch = game.chapter,
    info = phaseInfo(),
    k = currentTarget(),
    covered = game.hideHints && !showMemory;
  return `<section class="game-area kid-stage ${WORLDS[ch.world].night || [3, 5].includes(ch.world) ? "night-stage" : ""}" style="--sky:${playColors[ch.world][0]};--field:${playColors[ch.world][1]}">${campaignScene(ch, info.index, info.beat)}<div class="kid-hud"><span class="kid-chapter">${ch.id + 1}</span><h2>${ch.title}</h2><button class="voice-button" data-quest="${ch.id}" aria-label="听提示">${playIcon("sound")}</button><div class="kid-phase-eggs" aria-label="三个小任务">${ch.phases.map((p, i) => `<span class="${i < info.index ? "hatched" : i === info.index ? "active" : ""}" aria-label="${p.goal}">${i < info.index ? "★" : i + 1}</span>`).join("")}</div><button class="round-action pause-button" data-pause aria-label="暂停">Ⅱ</button></div><button class="catch-target ${k.length > 2 ? "long-key" : ""} type-${ch.kind}" data-read-key aria-label="听目标按键 ${keyName(k)}" style="--float-x:${58 + (game.step % 3) * 9}%;--float-y:${24 + (game.step % 2) * 11}%"><span class="target-wings"></span><b>${covered ? "?" : bigKey(k, ch.lower)}</b><i>▾</i></button><button class="buddy-tickle" data-tickle aria-label="摸摸豆豆"></button><div class="kid-jar" aria-label="发现次数 ${game.step}"><span>★</span><b>${game.step}</b><small>/ ${game.sequence.length}</small></div><div class="sticker-on-stage" aria-hidden="true">${state.sticker || "🌟"}</div><div class="particles"></div><div class="scene-effects"></div><span id="feedback" class="sr-only" role="status">${game.status || "慢慢来，每次按键都会有新发现。"}</span><div id="reaction" aria-hidden="true"></div></section><div class="kid-controls ${ch.id < 19 ? "no-digits" : ""}"><div class="key-station"><button class="target-key ${k.startsWith("SHIFT+") ? "combo-key" : ""}" data-read-key data-expected="${k}" aria-label="听目标按键">${covered ? "?" : bigKey(k, ch.lower)}</button><div class="upcoming-keys sequence-strip" aria-label="接下来几个按键">${game.sequence
    .slice(game.step + 1, game.step + 4)
    .map((key) => `<span>${covered ? "•" : bigKey(key, ch.lower)}</span>`)
    .join(
      "",
    )}</div>${ch.memory ? `<button class="memory-button" data-memory aria-label="${covered ? "显示提示" : "试试记住按键"}">${covered ? "👀" : "🧠"}</button>` : ""}<span id="help-copy" class="sr-only">${guidance(k)}</span></div><div class="keyboard-station">${ch.lower || ch.edit ? `<div class="input-ribbon ${ch.edit ? "editing" : ""}" aria-label="已经输入的内容"><code>${escapeText(game.typed) || "…"}</code><i></i></div>` : ""}${keyboard(k, false, true)}</div><button class="kid-hand-guide hand-guide ${!state.handGuide ? "guide-off" : ""}" data-show-guide aria-label="看看手指怎么放">${focusedHand(k)}<span>${fingerFor(k).name}</span></button></div>`;
}
function escapeText(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function scheduleHint() {
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    if (
      page !== "game" ||
      !game ||
      dialog.open ||
      game.locked ||
      game.lastHintStep === game.step
    )
      return;
    game.lastHintStep = game.step;
    game.hints++;
    showMemory = true;
    const helper = $("#help-copy");
    if (helper) helper.textContent = guidance(currentTarget());
    $(".key.target")?.classList.add("hint");
    if (game.hideHints) render();
    VoiceDirector.idle(currentTarget());
    persistCheckpoint();
  }, 10000);
}
function burst(symbol = "✦") {
  const host = $(".particles");
  if (!host) return;
  for (let i = 0; i < 8; i++) {
    const el = document.createElement("span");
    el.className = "particle";
    el.textContent = i % 3 ? "✧" : symbol;
    el.style.cssText = `--dx:${(Math.random() - 0.5) * 400}px;--dy:${-20 - Math.random() * 150}px;color:${["#e8ba68", "#faf0cb", "#83aa8b"][i % 3]}`;
    host.append(el);
    setTimeout(() => el.remove(), 900);
  }
}

function actionFeedback(ch, info, key) {
  if (key === "BACKSPACE") return "多余的字母删掉啦！看看输入轨道里的变化。";
  if (key === "ENTER") return "叮！确认完成，把这一份送给朋友。";
  if (key === "SPACE" && ["soup", "cake", "bake"].includes(ch.kind))
    return "叮！这一份美味出炉啦。";
  const actions = {
    glow: "一只萤火虫亮起来啦",
    sail: "哗啦，小船又向前划了一点",
    bridge: "咚！新木板装好了",
    drum: "咚咚，小鼓在回应你",
    kite: "呼，风筝又飞高了一点",
    lighthouse: "灯塔的光又亮了一些",
    garden: "一颗种子悄悄伸了个懒腰",
    sunflower: "向日葵又展开一片花瓣",
    water: "风车转起来，清水流过去",
    bee: "嗡嗡，蜜蜂带回一滴花蜜",
    fruit: "扑通，一颗苹果落进篮子",
    rainbow: "又一种颜色找到自己的位置",
    balloon: "气球载着包裹，轻轻向上飞",
    train: "咔嗒咔嗒，小火车前进",
    fish: "啵！小鱼吹出新泡泡",
    snow: "咔嚓，又一片雪花剪好啦",
    telescope: "镜片转动，找到一颗小星星",
    mail: "邮差收好了一封新的问候",
    melody: "叮！木琴唱出你的音符",
    gear: "咔哒，齿轮咬合在一起",
    rocket: "噗！发动机的能量增加了",
    star: "一颗星星亮起，星座有了新线索",
    rain: "滴答，雨滴敲出一个小圆圈",
    record: "这一个音符录进唱片啦",
    soup: "咕嘟，锅里多了一份美味",
    cake: "挤好一朵糖霜，蛋糕更漂亮了",
    repair: "字母饼干放好啦，等会儿修一修",
    serve: "朋友的午餐准备好了一些",
    bake: "面包在烤箱里慢慢鼓起来",
    festival: "一盏灯笼亮起来啦",
    submarine: "咕噜，潜水艇发现新的海底风景",
    robot: "咔哒，机器人的零件装好啦",
    planet: "这颗行星有了自己的名字",
    story: "又一个字母写进给小岛的信",
    concert: "朋友们跟着你的按键合奏",
    finale: "星光号收到你的启航信号",
  };
  return ch.expansion
    ? ch.phases[info.index].goal + "，有变化啦！"
    : (actions[ch.kind] || "新的发现出现啦") + "！";
}

function hit(key) {
  if (dialog.open) return;
  if (page === "free") {
    freePlay(key);
    return;
  }
  if (page === "lab") {
    if (validKey(key)) {
      labKey = key;
      IslandAudio.marimba(330);
      VoiceDirector.stop();
      render();
      VoiceDirector.request(VoiceDirector.keyId(key), {
        delay: 450,
        priority: 20,
        kind: "help",
        valid: () => page === "lab" && labKey === key && !dialog.open,
      });
    }
    return;
  }
  if (page !== "game" || !game || game.locked) return;
  const expected = currentTarget(),
    info = phaseInfo(),
    ch = game.chapter;
  if (key !== expected) {
    game.wrong++;
    game.combo = 0;
    state.keys[expected] ??= { good: 0, miss: 0 };
    state.keys[expected].miss++;
    game.status =
      expected.startsWith("SHIFT+") && baseKey(key) === baseKey(expected)
        ? "先按住 Shift，再按字母。"
        : `找找 ${keyName(expected, ch.lower)}。`;
    $("#feedback").textContent = game.status;
    $("#help-copy").textContent = guidance(expected);
    const reaction = $("#reaction");
    if (reaction) {
      reaction.textContent = "👀";
      reaction.className = "peek";
    }
    IslandAudio.wrong();
    VoiceDirector.mistake(expected);
    if (game.hideHints) {
      showMemory = true;
      render();
    }
    persistCheckpoint();
    return;
  }
  VoiceDirector.input(true);
  clearTimeout(hintTimer);
  game.locked = true;
  game.combo = (game.combo || 0) + 1;
  state.total++;
  state.keys[key] ??= { good: 0, miss: 0 };
  state.keys[key].good++;
  soundAction(ch, game.step, info.index);
  game.status = actionFeedback(ch, info, key);
  game.history.push(game.status);
  if (key === "BACKSPACE") game.typed = game.typed.slice(0, -1);
  else if (key === "ENTER") game.typed = "";
  else if (key === "SPACE") game.typed += " ";
  else
    game.typed += key.startsWith("SHIFT+")
      ? baseKey(key)
      : ch.lower
        ? key.toLowerCase()
        : key;
  const phaseEnd = info.beat + 1 === info.phase.keys.length,
    oldPhase = info.index,
    oldBeat = info.beat + 1;
  game.step++;
  const art = $(".campaign-art");
  if (art) art.outerHTML = campaignScene(ch, oldPhase, oldBeat);
  $("#feedback").textContent = game.status;
  $(".target-key")?.classList.add("bump");
  $(".key.target")?.classList.add("pressed");
  $("#actor")?.classList.add("hero-hop");
  const ribbon = $(".input-ribbon code");
  if (ribbon) ribbon.textContent = game.typed || "✓";
  $(".kid-jar b").textContent = game.step;
  playAction(ch, info, phaseEnd);
  if (game.combo % 3 === 0) {
    IslandAudio.collect(3);
    popCombo();
  }
  if (phaseEnd) {
    if (game.step < game.sequence.length) IslandAudio.celebrate();
    phaseTreasure(ch, oldPhase);
    game.typed = "";
    showMemory = false;
  }
  persistCheckpoint();
  advanceTimer = setTimeout(
    () => {
      if (page !== "game" || !game) return;
      if (game.step === game.sequence.length) {
        finish();
        return;
      }
      game.locked = false;
      render();
      if (document.hidden) pause();
    },
    phaseEnd ? 850 : 330,
  );
}
function finish() {
  if (!game || game.finished) return;
  game.finished = true;
  game.locked = true;
  stopTimers();
  const ch = game.chapter,
    elapsed = Math.max(
      1,
      game.elapsed +
        Math.round((Date.now() - game.started - game.pausedMs) / 1000),
    ),
    first = !state.completed[ch.id],
    stars = game.wrong === 0 ? 3 : game.wrong <= 3 ? 2 : 1,
    previous = state.completed[ch.id];
  state.completed[ch.id] = {
    stars: Math.max(stars, previous?.stars || 0),
    plays: (previous?.plays || 0) + 1,
    badge: ch.badge,
  };
  state.rounds++;
  state.seconds += elapsed;
  const reward = first ? 15 : 3,
    worldReward = first && ch.id % 6 === 5 ? 25 : 0;
  state.shells += reward + worldReward;
  state.checkpoint = null;
  save();
  IslandAudio.celebrate(true);
  const next = CHAPTERS[ch.id + 1];
  openDialog(
    `<div class="result kid-result"><div class="result-confetti" aria-hidden="true">✦　✧　✦　✧　✦</div><div class="treasure-buddy">${otter()}<span>${state.sticker || "🌟"}</span></div><h2>完成啦！</h2><div class="result-stars" aria-label="获得 ${stars} 颗星">${"★".repeat(stars) + "☆".repeat(3 - stars)}</div><div class="reward-shell"><span>🐚</span><b>+${reward + worldReward}</b>${worldReward ? `<span>${worldPicture(ch.world)}</span>` : ""}</div><div class="sticker-picker" aria-label="选一个喜欢的小贴纸">${["🌟", "🌈", "🍄"].map((s) => `<button data-sticker="${s}" class="${state.sticker === s ? "selected" : ""}" aria-label="选择贴纸 ${s}">${s}</button>`).join("")}</div><div class="result-choices"><button class="round-action" data-finish-map aria-label="回地图休息">${playIcon("home")}</button><button class="primary next-play" data-chapter="${next?.id ?? ch.id}" aria-label="${next ? "继续下一章" : "再玩一次"}">▶ <span>${next ? "下一关" : "再玩"}</span></button><button class="round-action" data-chapter="${ch.id}" aria-label="再玩这一章">↻</button></div><p class="sr-only">你收下了${ch.badge}纪念章，完成 ${completedCount()} / ${CHAPTERS.length} 章。</p></div>`,
  );
  VoiceDirector.complete(ch, worldReward);
}
function openDialog(html) {
  VoiceDirector.stop();
  if (dialog.open) dialog.close();
  dialog.innerHTML = html;
  dialog.showModal();
}
function pause() {
  if (page !== "game" || !game || game.locked) return;
  VoiceDirector.stop();
  pauseStarted = Date.now();
  clearTimeout(hintTimer);
  openDialog(
    `<div class="result kid-pause"><div class="sleep-buddy">${otter()}<b>z z Z</b></div><h2>歇一会儿</h2><div class="result-choices"><button class="round-action" data-finish-map aria-label="回地图休息">${playIcon("home")}</button><button class="primary next-play" data-close aria-label="继续冒险">▶</button><button class="round-action" data-show-guide aria-label="手指示意图">${playIcon("hand")}</button></div></div>`,
  );
}
function showHandLesson() {
  if (game && !game.finished) {
    pauseStarted = Date.now();
    clearTimeout(hintTimer);
  }
  openDialog(
    `<button class="dialog-close" data-close aria-label="关闭">×</button><div class="picture-hand-lesson"><div class="big-home-keys"><span>F</span><b>＋</b><span>J</span></div>${handSvg(currentTarget() || labKey)}<div class="home-row-picture"><span>A S D F</span><b>␣</b><span>J K L ;</span></div><div class="hand-lesson-actions"><button class="round-action" data-hand-voice aria-label="听双手怎么放">${playIcon("sound")}</button><button class="primary next-play" data-close aria-label="我来试一试">▶</button></div></div>`,
  );
  VoiceDirector.manual("hands");
}
const items = ROOM_ITEMS;
let badgePage = 0;
function collection() {
  return roomView();
}
function labView() {
  const k = labKey,
    f = fingerFor(k);
  return `<div class="hand-playground"><div class="big-hand-cue"><button class="target-key" data-read-key aria-label="听这个按键">${keyName(k)}</button><div>${handSvg(k)}<strong>${f.name}</strong></div><div class="finger-route"><span>${f.home}</span><b>➜</b><span>${baseKey(k) === "SPACE" ? "␣" : baseKey(k)}</span></div></div><div class="lab-keyboard">${keyboard(k, true, true)}</div><div class="lab-actions"><button class="round-action" data-show-guide aria-label="双手怎么放">${playIcon("hand")}</button><button class="primary next-play" data-continue aria-label="去冒险里试一试">▶</button><button class="round-action" data-read-key aria-label="听提示">${playIcon("sound")}</button></div></div>`;
}
function freeView() {
  return `<div class="music-playground"><div class="free-scene"><div class="music-stage-lights"><i></i><i></i><i></i></div><div class="free-animals"><button id="free-otter" data-instrument="0" aria-label="敲鼓">${otter()}<span>🥁</span></button><button id="free-frog" data-instrument="1" aria-label="弹木琴">${frog()}<span>🎹</span></button><button id="free-chef" data-instrument="2" aria-label="摇铃鼓">${otter(true)}<span>🔔</span></button></div><div class="notes" id="notes">♪　♬　♫</div><div class="scene-effects"></div></div><div class="free-keyboard">${keyboard("", true, true)}</div></div>`;
}
function freePlay(k) {
  if (!validKey(k)) return;
  const base = baseKey(k),
    index = k.charCodeAt(0) % 8,
    note = [262, 294, 330, 349, 392, 440, 494, 523][index];
  let instrumentId = 0;
  if (k === "SPACE" || "ZXCVBNM,./".includes(base)) {
    IslandAudio.drum(index);
    instrumentId = 0;
  } else if ("QWERTYUIOP1234567890".includes(base)) {
    IslandAudio.bell(note * 2);
    instrumentId = 2;
  } else {
    IslandAudio.marimba(note, 0, index % 2 ? 0.6 : -0.6);
    instrumentId = 1;
  }
  freeNotes.push(["♪", "♫", "♬", "♩"][index % 4]);
  freeNotes = freeNotes.slice(-10);
  $("#notes").textContent = freeNotes.join(" ");
  const key = document.querySelector(`[data-key="${base}"]`);
  key?.classList.add("pressed");
  setTimeout(() => key?.classList.remove("pressed"), 180);
  const animal = $(["#free-otter", "#free-frog", "#free-chef"][instrumentId]);
  animal?.classList.remove("hero-hop");
  if (animal) {
    void animal.offsetWidth;
    animal.classList.add("hero-hop");
  }
}
function settings() {
  if (page === "diver") DiverGame.stopCamera();
  if (game && !game.finished) {
    pauseStarted = Date.now();
    clearTimeout(hintTimer);
  }
  const practiced = Object.values(state.keys).filter((v) => v.good >= 6).length,
    weak = Object.entries(state.keys)
      .filter(([, v]) => v.miss > 0)
      .sort((a, b) => b[1].miss - a[1].miss)
      .slice(0, 5)
      .map(([k]) => keyName(k))
      .join("、");
  openDialog(
    `<button class="dialog-close" data-close aria-label="关闭">×</button><h2>家长小记</h2><p>用游戏熟悉键位和指法。先求准确与放松，不比较打字速度。</p><div class="stats"><div><strong>${completedCount()} / ${CHAPTERS.length}</strong><small>已完成章节</small></div><div><strong>${practiced}</strong><small>成功练习至少 6 次的键</small></div><div><strong>${Math.round(state.seconds / 60)}</strong><small>已完成冒险分钟数</small></div></div><p>可以再熟悉：${weak || "暂时没有，继续轻松探索。"}</p>${[
      ["sound", "游戏音效"],
      ["music", "轻柔背景音乐"],
      [
        "voice",
        Object.values(VOICE_CLIPS).some((c) => c.url)
          ? "豆豆语音提示"
          : "豆豆语音（此版本未附录音）",
      ],
      ["reduced", "减少动画"],
      ["handGuide", "游戏中的双手示意"],
    ]
      .map(
        ([key, label]) =>
          `<label class="setting-row">${label}<input type="checkbox" data-setting="${key}" ${state[key] ? "checked" : ""} ${key === "voice" && !Object.values(VOICE_CLIPS).some((c) => c.url) ? "disabled" : ""}></label>`,
      )
      .join(
        "",
      )}<label class="setting-row">音量<input type="range" min="0" max="1" step="0.05" data-setting="volume" value="${state.volume ?? 0.65}"></label><div class="sound-demos"><button data-voice-demo ${Object.values(VOICE_CLIPS).some((c) => c.url) ? "" : "disabled"} aria-label="试听豆豆的声音">🗣️</button><button data-sound-demo="water" aria-label="听水花">💦</button><button data-sound-demo="drum" aria-label="听小鼓">🥁</button><button data-sound-demo="party" aria-label="听庆祝">🎉</button></div><p>学习路线：基准行 → 上排 → 下排 → 数字与连续输入 → Shift / 退格 / 回车 → 短句。<br>后期使用拼音字母串表达短词和短句；这不是中文输入法选字训练。<br>游戏不能判断实际用了哪根手指，可陪孩子对照手势图观察。进度只保存在当前浏览器。</p>`,
  );
}
function render() {
  updateHeader();
  app.dataset.page = page;
  document
    .querySelectorAll(".nav")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  app.innerHTML = (
    {
      home,
      map: mapView,
      game: gameView,
      collection,
      lab: labView,
      free: freeView,
    }[page] || home
  )();
  if (page === "game" && !game.locked) scheduleHint();
}
function handleClick(e) {
  if (e.target.closest("[data-diver-open]")) {
    DiverGame.open();
    return;
  }
  if (e.target.closest("[data-tickle]")) {
    tickleBuddy();
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  initAudio();
  if (b.hasAttribute("data-read-key")) {
    VoiceDirector.key(page === "lab" ? labKey : currentTarget());
    return;
  }
  if (b.dataset.quest !== undefined) {
    const ch = CHAPTERS[Number(b.dataset.quest)];
    VoiceDirector.manual("intro-" + ch.id);
    return;
  }
  if (b.hasAttribute("data-hand-voice")) {
    VoiceDirector.manual("hands");
    return;
  }
  if (b.dataset.sticker) {
    state.sticker = b.dataset.sticker;
    save();
    IslandAudio.collect(3);
    $(".treasure-buddy>span").textContent = state.sticker;
    document
      .querySelectorAll("[data-sticker]")
      .forEach((el) =>
        el.classList.toggle("selected", el.dataset.sticker === state.sticker),
      );
    return;
  }
  if (b.dataset.instrument !== undefined) {
    const n = Number(b.dataset.instrument);
    if (n === 0) IslandAudio.drum(freeNotes.length);
    else if (n === 1) IslandAudio.marimba(392);
    else IslandAudio.bell(784);
    b.classList.remove("hero-hop");
    void b.offsetWidth;
    b.classList.add("hero-hop");
    freeNotes.push("♪");
    $("#notes").textContent = freeNotes.slice(-8).join(" ");
    return;
  }
  if (b.hasAttribute("data-voice-demo")) {
    VoiceDirector.manual("sample");
    return;
  }
  if (b.dataset.soundDemo) {
    if (b.dataset.soundDemo === "water") IslandAudio.water();
    else if (b.dataset.soundDemo === "drum") IslandAudio.drum(0);
    else IslandAudio.celebrate(true);
    return;
  }
  if (b.dataset.roomCategory) {
    roomCategory = b.dataset.roomCategory;
    render();
    return;
  }
  if (b.dataset.homeBand) {
    homeWorldBand = Math.max(
      0,
      Math.min(
        Math.ceil(WORLDS.length / 6) - 1,
        homeWorldBand + Number(b.dataset.homeBand),
      ),
    );
    render();
    return;
  }
  if (b.dataset.worldPage) {
    mapWorld = Math.max(
      0,
      Math.min(
        WORLDS.length - 1,
        (Math.floor(mapWorld / 6) + Number(b.dataset.worldPage)) * 6,
      ),
    );
    render();
    return;
  }
  if (b.hasAttribute("data-close")) {
    dialog.close();
    return;
  }
  if (b.hasAttribute("data-finish-map")) {
    dialog.close();
    navigate("map");
    return;
  }
  if (b.dataset.chapter !== undefined) {
    const id = Number(b.dataset.chapter);
    if (dialog.open) dialog.close();
    startChapter(id);
    return;
  }
  if (b.dataset.preview !== undefined) {
    previewChapter(Number(b.dataset.preview));
    return;
  }
  if (b.hasAttribute("data-continue")) {
    continueJourney();
    return;
  }
  if (b.dataset.world !== undefined) {
    clearGame();
    page = "map";
    mapWorld = Number(b.dataset.world);
    render();
    return;
  }
  if (b.dataset.page) {
    navigate(b.dataset.page);
    return;
  }
  if (b.hasAttribute("data-pause")) {
    pause();
    return;
  }
  if (b.hasAttribute("data-show-guide")) {
    showHandLesson();
    return;
  }
  if (b.hasAttribute("data-memory")) {
    game.hideHints = !game.hideHints;
    showMemory = false;
    render();
    return;
  }
  if (b.hasAttribute("data-badges")) {
    badgePage = (badgePage + 1) % Math.ceil(completedCount() / 6);
    render();
    return;
  }
  if (b.dataset.buy) {
    buyRoomItem(b.dataset.buy);
    return;
  }
  if (b.dataset.key) {
    const key = b.dataset.key.startsWith("SHIFT") ? "SHIFT+A" : b.dataset.key;
    hit(key);
  }
}
app.addEventListener("click", handleClick);
dialog.addEventListener("click", handleClick);
dialog.addEventListener("change", (e) => {
  const key = e.target.dataset.setting;
  if (key && Object.hasOwn(defaults, key)) {
    state[key] = key === "volume" ? Number(e.target.value) : e.target.checked;
    save();
    if (key === "volume") initAudio();
  }
});
dialog.addEventListener("close", () => {
  if (
    !dialog.open &&
    (["manual", "win"].includes(VoiceDirector.active?.kind) ||
      ["manual", "win"].includes(VoiceDirector.pending?.kind))
  )
    VoiceDirector.stop("dialog-close");
  if (pauseStarted && game && !game.finished) {
    game.pausedMs += Date.now() - pauseStarted;
    pauseStarted = 0;
  }
  if (page === "game" && game && !game.finished) {
    $(".hand-guide")?.classList.toggle("guide-off", !state.handGuide);
    scheduleHint();
  }
});
dialog.addEventListener("cancel", (e) => {
  if (game?.finished) {
    e.preventDefault();
    dialog.close();
    navigate("map");
  }
});
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => navigate(b.dataset.page)));
$(".brand").onclick = (e) => {
  e.preventDefault();
  navigate("home");
};
$("#sound").onclick = () => {
  state.sound = !state.sound;
  save();
  if (state.sound) chime(262);
};
$("#settings").onclick = settings;
document.addEventListener("keydown", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    heldShifts.add(e.code);
    return;
  }
  if (e.key === "Escape" && !dialog.open) {
    e.preventDefault();
    pause();
    return;
  }
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    dialog.open ||
    !["game", "free", "lab"].includes(page)
  )
    return;
  let key =
    e.code === "Space"
      ? "SPACE"
      : e.code === "Backspace"
        ? "BACKSPACE"
        : e.code === "Enter"
          ? "ENTER"
          : { Semicolon: ";", Comma: ",", Period: ".", Slash: "/" }[e.code] ||
            (/^Key[A-Z]$/.test(e.code)
              ? e.code.slice(3)
              : /^Digit\d$/.test(e.code)
                ? e.code.slice(5)
                : "");
  if (!key) return;
  if (e.shiftKey && /^[A-Z]$/.test(key)) key = "SHIFT+" + key;
  e.preventDefault();
  if (
    page === "game" &&
    currentTarget()?.startsWith("SHIFT+") &&
    key === currentTarget()
  ) {
    const opposite = fingerFor(key).side === "左" ? "ShiftRight" : "ShiftLeft";
    if (!heldShifts.has(opposite)) {
      game.status = `这次请按住${opposite === "ShiftRight" ? "右" : "左"}侧 Shift，让另一只手帮忙。`;
      $("#feedback").textContent = game.status;
      IslandAudio.wrong();
      VoiceDirector.mistake(currentTarget());
      return;
    }
  }
  hit(key);
});
document.addEventListener("keyup", (e) => heldShifts.delete(e.code));
window.addEventListener("blur", () => heldShifts.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    VoiceDirector.stop("hidden");
    heldShifts.clear();
    pause();
  }
});
window.addEventListener("pagehide", () => {
  if (game && !game.finished) persistCheckpoint();
});
const playColors = [
  ["#bceef0", "#63c7bd"],
  ["#d8f1b3", "#8bc86b"],
  ["#bce5fa", "#88cce8"],
  ["#505f9a", "#7b86b7"],
  ["#ffe8b2", "#eab96f"],
  ["#425d91", "#718fbe"],
  ...WORLDS.slice(6).map((w) => [w.color, w.ground]),
];
const pickupPictures = {
  dinosaur: "🥚",
  ice: "❄️",
  candy: "🍭",
  farm: "🥕",
  pirate: "💎",
  jungle: "🦋",
  oasis: "🌵",
  city: "⚙️",
  magic: "📚",
  aurora: "🌌",
  glow: "✨",
  sail: "🐚",
  bridge: "🪵",
  drum: "🥁",
  kite: "🪁",
  lighthouse: "💡",
  garden: "🌱",
  sunflower: "🌻",
  water: "💦",
  bee: "🍯",
  fruit: "🍎",
  rainbow: "🌈",
  balloon: "🎈",
  train: "🚂",
  fish: "🫧",
  snow: "❄️",
  telescope: "🔭",
  mail: "💌",
  melody: "🎵",
  gear: "⚙️",
  rocket: "🚀",
  star: "⭐",
  rain: "🌧️",
  record: "🎶",
  soup: "🍲",
  cake: "🎂",
  repair: "🍪",
  serve: "🍽️",
  bake: "🥐",
  festival: "🏮",
  submarine: "🐠",
  robot: "🤖",
  planet: "🪐",
  story: "💌",
  concert: "🎸",
  finale: "🚀",
};
function playIcon(name) {
  const shapes = {
    home: '<path d="M9 26L32 7L55 26V55H39V38H25V55H9Z" fill="#f7ce78" stroke="#916643" stroke-width="4" stroke-linejoin="round"/><path d="M4 27L32 4L60 27" fill="none" stroke="#d48257" stroke-width="7" stroke-linecap="round"/>',
    map: '<path d="M8 12L25 7L40 14L56 8V53L40 58L25 51L8 57Z" fill="#e8ecc2" stroke="#749274" stroke-width="3"/><path d="M25 7V51M40 14V58" stroke="#b5c790" stroke-width="3"/><path d="M15 44Q49 49 45 23" fill="none" stroke="#e3a45e" stroke-width="5" stroke-dasharray="4 5"/><path d="M38 20l14 1 -6 12Z" fill="#cf7955"/>',
    treasure:
      '<path d="M8 28Q8 7 32 7Q56 7 56 28V54H8Z" fill="#d99a59" stroke="#936640" stroke-width="4"/><path d="M8 28H56M20 10V55M44 10V55" stroke="#ffe09a" stroke-width="5"/><rect x="26" y="25" width="13" height="17" rx="3" fill="#fff0b5"/><circle cx="32" cy="32" r="3" fill="#a4753a"/>',
    music:
      '<path d="M23 45V13L53 7V38" fill="none" stroke="#729c9c" stroke-width="8" stroke-linecap="round"/><ellipse cx="15" cy="48" rx="12" ry="9" fill="#ddaa5d"/><ellipse cx="45" cy="42" rx="12" ry="9" fill="#dc9379"/>',
    sound:
      '<path d="M8 25H20L34 13V51L20 39H8Z" fill="#6e9a83"/><path d="M43 23Q53 32 43 41M50 13Q68 32 50 51" fill="none" stroke="#6e9a83" stroke-width="5" stroke-linecap="round"/>',
    mute: '<path d="M8 25H20L34 13V51L20 39H8Z" fill="#9aa798"/><path d="M44 22L59 42M59 22L44 42" stroke="#bb8c77" stroke-width="5" stroke-linecap="round"/>',
    hand: '<path d="M12 38V23Q12 14 19 17V35V12Q19 5 26 9V33V7Q26 0 34 5V33V12Q34 5 41 10V34L46 25Q53 18 57 26L49 51Q44 62 28 60Q10 60 9 46Z" fill="#f3d3a2" stroke="#bf9972" stroke-width="3" stroke-linejoin="round"/>',
    lock: '<path d="M19 28V18Q19 3 32 3Q45 3 45 18V28" fill="none" stroke="#869b92" stroke-width="7"/><rect x="11" y="25" width="42" height="34" rx="9" fill="#aebfb0"/><circle cx="32" cy="40" r="5" fill="#f8f0cb"/>',
    keys:
      '<rect x="3" y="11" width="58" height="43" rx="9" fill="#f7e6aa"/>' +
      Array.from(
        { length: 10 },
        (_, i) =>
          `<rect x="${10 + (i % 5) * 10}" y="${20 + Math.floor(i / 5) * 11}" width="7" height="7" rx="2" fill="#43805f"/>`,
      ).join("") +
      '<path d="M20 46H44" stroke="#43805f" stroke-width="5" stroke-linecap="round"/>',
  };
  return svg(shapes[name] || shapes.home, "0 0 64 64", "play-icon");
}
function happyIsland() {
  return island()
    .replaceAll("#dceee5", "#bceef0")
    .replaceAll("#b9cb8e", "#9bd16f")
    .replaceAll("#b8d9c4", "#8ed4b6")
    .replaceAll("#70a371", "#54a66d")
    .replaceAll("#d7c899", "#f0d69e")
    .replaceAll("#f7e9bd", "#fff0bf");
}
function sceneThumb(ch) {
  return campaignScene(ch, 2, ch.phases[2].keys.length)
    .replaceAll('class="campaign-art"', 'class="scene-thumb"')
    .replaceAll('id="actor"', 'class="picture-actor"')
    .replaceAll('id="scene-object"', 'class="picture-object"');
}
function worldPicture(world) {
  const ch = CHAPTERS[[5, 11, 12, 18, 25, 35][world] ?? world * 6 + 5];
  return `<span class="world-picture">${sceneThumb(ch)}</span>`;
}
function focusedHand(k) {
  const hand = handSvg(k, true);
  return k.startsWith("SHIFT+")
    ? hand
    : hand.replace(
        "0 0 360 166",
        fingerFor(k).side === "右" ? "180 0 180 166" : "0 0 180 166",
      );
}
function bigKey(k, lower = false) {
  return { SPACE: "␣", ENTER: "↵", BACKSPACE: "⌫" }[k] || keyName(k, lower);
}
function playAction(ch, info, phaseEnd) {
  const stage = $(".kid-stage"),
    host = $(".scene-effects");
  if (!stage || !host) return;
  const watery = ["sail", "fish", "water", "rain", "submarine"].includes(
      ch.kind,
    ),
    music = ["drum", "music", "melody", "concert", "record"].includes(ch.kind),
    build = ["bridge", "gear", "train", "robot", "repair"].includes(ch.kind),
    launch = ["rocket", "finale"].includes(ch.kind);
  stage.classList.add("just-hit");
  const object = $("#scene-object");
  if (object)
    object.classList.add(
      watery
        ? "splash-object"
        : music
          ? "dance-object"
          : build
            ? "hammer-object"
            : launch
              ? "rumble-object"
              : "pop-object",
    );
  $(".catch-target")?.classList.add("caught");
  const rect = stage.getBoundingClientRect();
  const target = $(".catch-target")?.getBoundingClientRect(),
    actor = $("#actor")?.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "flying-loot";
  el.textContent = pickupPictures[ch.kind] || "⭐";
  el.style.cssText = `left:${target ? target.left + target.width / 2 : rect.left + rect.width * 0.7}px;top:${target ? target.top + target.height / 2 : rect.top + rect.height * 0.4}px;--travel-x:${actor && target ? actor.left + actor.width * 0.5 - target.left - target.width * 0.5 : -250}px;--travel-y:${actor && target ? actor.top + actor.height * 0.5 - target.top - target.height * 0.5 : 100}px`;
  ($("#party-layer") || host).append(el);
  setTimeout(() => el.remove(), state.reduced ? 120 : 850);
  for (let i = 0; i < (state.reduced ? 0 : phaseEnd ? 22 : 10); i++) {
    const dot = document.createElement("i");
    dot.className =
      "action-dot " + (watery ? "water-dot" : music ? "music-dot" : "star-dot");
    dot.textContent = watery ? "●" : music ? ["♪", "♫", "♬"][i % 3] : "✦";
    dot.style.cssText = `left:${60 + Math.random() * 25}%;top:${40 + Math.random() * 20}%;--dx:${(Math.random() - 0.5) * 340}px;--dy:${-60 - Math.random() * 120}px;--spin:${(Math.random() - 0.5) * 240}deg;color:${["#ffe487", "#fff4bd", "#f5ad88", "#badf9c"][i % 4]}`;
    host.append(dot);
    setTimeout(() => dot.remove(), 900);
  }
  if (build) {
    const hammer = document.createElement("span");
    hammer.className = "big-hammer";
    hammer.textContent = "🔨";
    host.append(hammer);
    setTimeout(() => hammer.remove(), 420);
  }
  if (launch && phaseEnd) stage.classList.add("launch-shake");
}
function phaseTreasure(ch, index) {
  const host = $(".scene-effects");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "phase-treasure";
  el.innerHTML = `<span>✦</span><b>${pickupPictures[ch.kind] || "🎁"}</b><span>✦</span>`;
  host.append(el);
  setTimeout(() => el.remove(), 850);
}
function popCombo() {
  const host = $(".scene-effects");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "combo-stars";
  el.textContent = "★ ★ ★";
  host.append(el);
  setTimeout(() => el.remove(), 900);
}
function tickleBuddy() {
  IslandAudio.tickle();
  const actor = $("#actor") || $(".home-buddy") || $(".room-pet");
  actor?.classList.remove("tickled");
  if (actor) {
    void actor.getBoundingClientRect();
    actor.classList.add("tickled");
    setTimeout(() => actor.classList.remove("tickled"), 650);
  }
  const root = $(".scene-effects") || $(".play-island") || $(".room-scene");
  if (root) {
    const laugh = document.createElement("span");
    laugh.className = "buddy-laugh";
    laugh.textContent = ["♥", "♫", "✦"][Math.floor(Math.random() * 3)];
    root.append(laugh);
    setTimeout(() => laugh.remove(), 900);
  }
}
function setupPlayHeader() {
  if (!$("#party-layer")) {
    const layer = document.createElement("div");
    layer.id = "party-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  const names = {
    home: ["home", "小岛", "我的小岛"],
    map: ["map", "地图", "冒险地图"],
    collection: ["treasure", "小屋", "伙伴小屋"],
    free: ["music", "音乐", "自由音乐会"],
  };
  document.querySelectorAll(".nav").forEach((b) => {
    const [icon, label, aria] = names[b.dataset.page];
    b.innerHTML = playIcon(icon) + `<span>${label}</span>`;
    b.setAttribute("aria-label", aria);
  });
  $(".brand-icon").innerHTML = playIcon("keys");
  $(".brand small")?.remove();
  $("#settings").textContent = "⚙";
}

if (state.playEdition !== 4) {
  state.playEdition = 4;
  save();
}
setupPlayHeader();
render();
