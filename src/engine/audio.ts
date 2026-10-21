import type { Audio, SfxName } from './types';

/**
 * Synthesised sound effects. No audio files, no licensing, no bandwidth.
 */
export function createAudio(storageKey = 'af:muted'): Audio {
  let ctx: AudioContext | null = null;
  let muted = false;

  try {
    muted = localStorage.getItem(storageKey) === '1';
  } catch {
    muted = false;
  }

  const ensure = (): AudioContext | null => {
    if (muted) return null;
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const tone = (
    ac: AudioContext,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  };

  return {
    unlock() {
      ensure();
    },
    play(name: SfxName, opts) {
      const ac = ensure();
      if (!ac) return;
      const g = opts?.gain ?? 0.16;
      switch (name) {
        case 'tap':
          tone(ac, 420, 0.07, 'triangle', g * 0.6);
          break;
        case 'select':
          tone(ac, 560, 0.08, 'square', g * 0.45);
          break;
        case 'found':
          tone(ac, 700, 0.12, 'triangle', g);
          tone(ac, 1050, 0.16, 'sine', g * 0.6);
          break;
        case 'wrong':
          tone(ac, 220, 0.2, 'sawtooth', g * 0.7, 120);
          break;
        case 'score':
          tone(ac, 880, 0.1, 'sine', g * 0.8);
          break;
        case 'gameover':
          tone(ac, 300, 0.45, 'sawtooth', g * 0.6, 90);
          break;
        case 'start':
          tone(ac, 520, 0.1, 'triangle', g * 0.8);
          tone(ac, 780, 0.14, 'sine', g * 0.5);
          break;
        case 'win':
          tone(ac, 660, 0.12, 'triangle', g);
          tone(ac, 880, 0.14, 'triangle', g);
          tone(ac, 1320, 0.22, 'sine', g * 0.7);
          break;
      }
    },
    muted: () => muted,
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem(storageKey, muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return muted;
    },
  };
}
