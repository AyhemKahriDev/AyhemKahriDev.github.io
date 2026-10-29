/**
 * Simon sequence generation and per-difficulty playback timing. Pure, no DOM.
 * The game drives playback from its own update(dt) clock - no timers.
 */
import { mulberry32 } from './daily.js';

export const PADS = 4;
/** Silence between two lit pads, in seconds. */
export const GAP = 0.16;
/** How many pads a round starts at, per difficulty. */
export function startLength(difficulty) {
  if (difficulty === 'easy') return 3;
  if (difficulty === 'hard') return 5;
  return 4;
}
/** How long each pad stays lit, in seconds. */
export function padDuration(difficulty) {
  if (difficulty === 'easy') return 0.6;
  if (difficulty === 'hard') return 0.32;
  return 0.42;
}

/** `length` deterministic pad indices in [0, PADS). A prefix of a longer sequence. */
export function sequence(seed, length) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < length; i++) out.push(Math.floor(rng() * PADS));
  return out;
}
