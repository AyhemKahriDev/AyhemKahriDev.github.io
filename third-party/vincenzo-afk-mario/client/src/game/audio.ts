// Signal Meadow style: compact square-wave cues, warm pulse tones, and restrained audio so the game remains readable on mobile.
import type { AudioCue } from "./types";

const MUSIC_URL = "/manus-storage/bytebound-meadow-loop_fc44f82d.wav";

type Tone = { frequency: number; duration: number; type: OscillatorType; gain: number; slide?: number };

const CUES: Record<AudioCue, Tone[]> = {
  jump: [{ frequency: 420, duration: 0.07, type: "square", gain: 0.055, slide: 760 }, { frequency: 760, duration: 0.08, type: "triangle", gain: 0.04, slide: 980 }],
  collect: [{ frequency: 880, duration: 0.055, type: "square", gain: 0.05, slide: 1180 }, { frequency: 1180, duration: 0.08, type: "square", gain: 0.045, slide: 1480 }],
  stomp: [{ frequency: 180, duration: 0.09, type: "square", gain: 0.045, slide: 90 }],
  checkpoint: [{ frequency: 520, duration: 0.08, type: "triangle", gain: 0.04, slide: 720 }, { frequency: 720, duration: 0.12, type: "triangle", gain: 0.04, slide: 1040 }],
  hurt: [{ frequency: 180, duration: 0.11, type: "sawtooth", gain: 0.035, slide: 90 }],
  finish: [{ frequency: 520, duration: 0.08, type: "square", gain: 0.04, slide: 780 }, { frequency: 780, duration: 0.08, type: "square", gain: 0.04, slide: 1040 }, { frequency: 1040, duration: 0.16, type: "triangle", gain: 0.045, slide: 1320 }],
};

export class ByteboundAudio {
  private context: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private muted = false;
  private volume = 0.28;

  constructor() {
    if (typeof window !== "undefined") {
      this.music = new Audio(MUSIC_URL);
      this.music.loop = true;
      this.music.preload = "auto";
      this.music.volume = this.volume;
    }
  }

  isMuted() { return this.muted; }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.music) {
      this.music.muted = muted;
      if (muted) this.music.pause();
      else if (this.context) void this.music.play().catch(() => undefined);
    }
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.context) this.context = new window.AudioContext();
    void this.context.resume();
    if (!this.muted && this.music) void this.music.play().catch(() => undefined);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playCue(cue: AudioCue) {
    if (this.muted || typeof window === "undefined") return;
    if (!this.context) this.context = new window.AudioContext();
    const context = this.context;
    void context.resume();
    const start = context.currentTime;
    let offset = 0;
    for (const tone of CUES[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start + offset);
      oscillator.frequency.linearRampToValueAtTime(tone.slide ?? tone.frequency, start + offset + tone.duration);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + tone.duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start + offset); oscillator.stop(start + offset + tone.duration + 0.02);
      offset += tone.duration * 0.72;
    }
  }

  dispose() {
    if (this.music) { this.music.pause(); this.music.src = ""; }
    if (this.context) void this.context.close();
    this.music = null; this.context = null;
  }
}
