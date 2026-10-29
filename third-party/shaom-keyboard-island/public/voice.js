"use strict";
// Short, local voice clips. One speaker, no queue, and no device TTS fallback.
const VoiceDirector = {
  active: null,
  pending: null,
  epoch: 0,
  cache: new Map(),
  seen: new Set(),
  lastHint: -Infinity,
  lastTap: -Infinity,
  mistakes: 0,
  events: [],
  event(type, id) {
    this.events.push({ type, id, at: Date.now() });
    if (this.events.length > 100) this.events.shift();
  },
  enabled() {
    return state.sound && state.voice && !document.hidden;
  },
  async buffer(id) {
    if (!VOICE_CLIPS[id]?.url) return null;
    if (!this.cache.has(id)) {
      const p = fetch(VOICE_CLIPS[id].url)
        .then((r) => {
          if (!r.ok) throw Error("voice " + r.status);
          return r.arrayBuffer();
        })
        .then((b) => IslandAudio.ctx.decodeAudioData(b))
        .catch(() => {
          this.cache.delete(id);
          return null;
        });
      this.cache.set(id, p);
      if (this.cache.size > 24)
        this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(id);
  },
  preload(ids) {
    if (!this.enabled()) return;
    IslandAudio.init();
    if (!IslandAudio.ctx) return;
    ids.forEach((id) => this.buffer(id));
  },
  duck(on) {
    const a = IslandAudio,
      c = a.ctx;
    if (!c) return;
    a.musicBus.gain.setTargetAtTime(
      on ? 0.1 : 0.44,
      c.currentTime,
      on ? 0.08 : 0.22,
    );
    a.fx.gain.setTargetAtTime(on ? 0.48 : 0.8, c.currentTime, 0.09);
  },
  cancelPending() {
    clearTimeout(this.pending?.timer);
    this.pending = null;
    this.epoch++;
  },
  stop(reason = "stop") {
    this.cancelPending();
    const a = this.active;
    if (a) {
      this.active = null;
      const t = IslandAudio.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(t);
      a.gain.gain.setTargetAtTime(0, t, 0.025);
      try {
        a.source.stop(t + 0.1);
      } catch {}
      this.event(reason, a.id);
    }
    this.duck(false);
  },
  request(
    id,
    { delay = 0, priority = 20, kind = "help", valid = () => true } = {},
  ) {
    if (!this.enabled() || !VOICE_CLIPS[id]?.url) return;
    if (this.active?.id === id || this.pending?.id === id) return;
    if (
      (this.active?.priority ?? -1) > priority ||
      (this.pending?.priority ?? -1) > priority
    )
      return;
    this.cancelPending();
    const token = this.epoch;
    this.pending = {
      id,
      kind,
      priority,
      timer: setTimeout(async () => {
        if (token !== this.epoch) return;
        if (!this.enabled() || !valid()) {
          this.pending = null;
          return;
        }
        IslandAudio.init();
        if (!IslandAudio.ctx) return;
        const b = await this.buffer(id);
        if (token !== this.epoch || !b || !this.enabled() || !valid()) {
          if (token === this.epoch) this.pending = null;
          return;
        }
        if (this.active && priority < 100) {
          this.pending = null;
          return;
        }
        this.pending = null;
        const replacing = !!this.active;
        if (replacing) this.stop("replace");
        const c = IslandAudio.ctx,
          t = c.currentTime + (replacing ? 0.12 : 0),
          source = c.createBufferSource(),
          gain = c.createGain();
        source.buffer = b;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(1, t + 0.045);
        gain.gain.setValueAtTime(1, t + Math.max(0.05, b.duration - 0.07));
        gain.gain.linearRampToValueAtTime(0, t + b.duration);
        source.connect(gain);
        gain.connect(IslandAudio.master);
        const a = { id, kind, priority, source, gain };
        this.active = a;
        this.duck(true);
        this.event("start", id);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          if (this.active === a) {
            this.active = null;
            this.duck(false);
            this.event("end", id);
          }
        };
        source.start(t);
        if (kind === "help") this.lastHint = Date.now();
      }, delay),
    };
  },
  keyId(k) {
    if (!k) return null;
    if (k.startsWith("SHIFT+"))
      return fingerFor(k).side === "左" ? "shift-right" : "shift-left";
    return (
      "key-" +
      ({ ";": "semicolon", ",": "comma", ".": "period", "/": "slash" }[k] || k)
    );
  },
  manual(id) {
    const t = Date.now();
    if (t - this.lastTap < 300) return;
    this.lastTap = t;
    this.request(id, { priority: 100, kind: "manual" });
  },
  key(k, manual = true) {
    const id = this.keyId(k);
    if (manual) this.manual(id);
    else {
      const g = game,
        s = g?.step;
      this.request(id, {
        priority: 20,
        kind: "help",
        valid: () =>
          page === "game" &&
          game === g &&
          game.step === s &&
          !game.locked &&
          !dialog.open,
      });
    }
  },
  chapter(ch, resume) {
    this.mistakes = 0;
    this.preload([
      "intro-" + ch.id,
      this.keyId(currentTarget()),
      "intro-" + (ch.id + 1),
    ]);
    if (resume || this.seen.has(ch.id)) return;
    this.seen.add(ch.id);
    const g = game;
    this.request("intro-" + ch.id, {
      delay: 650,
      priority: 40,
      kind: "intro",
      valid: () =>
        page === "game" && game === g && !game.finished && !dialog.open,
    });
  },
  input(correct = false) {
    if (
      this.pending &&
      (this.pending.kind !== "manual" ||
        (correct && /^(key-|shift-)/.test(this.pending.id)))
    )
      this.cancelPending();
    if (correct) {
      this.mistakes = 0;
      if (
        this.active &&
        ["help", "manual"].includes(this.active.kind) &&
        !this.active.id.startsWith("intro-")
      )
        this.stop("progress");
    }
  },
  mistake(k) {
    this.input();
    this.mistakes++;
    if (this.mistakes < 3 || Date.now() - this.lastHint < 18000) return;
    const g = game,
      s = g.step;
    this.request(this.keyId(k), {
      delay: 1800,
      priority: 20,
      kind: "help",
      valid: () =>
        game === g && game.step === s && !game.locked && !dialog.open,
    });
  },
  idle(k) {
    if (Date.now() - this.lastHint < 18000 || this.active || this.pending)
      return;
    this.key(k, false);
  },
  complete(ch, world) {
    this.stop("complete");
    this.request(world ? "win-map" : "win-" + (ch.id % 3), {
      delay: 1150,
      priority: 80,
      kind: "win",
      valid: () =>
        page === "game" && game?.chapter === ch && game.finished && dialog.open,
    });
  },
};
