/**
 * Typing Sprint word queue. Pure, no DOM: unit-tested and shared with the site builder.
 * Words come from the same themed pools as the daily word search.
 */
import { mulberry32 } from './daily.js';
import { themes } from './wordlists.js';

/** Lower-case, 4-8 letters, one copy of each. */
function pool() {
  const seen = new Set();
  const words = [];
  for (const theme of themes) {
    for (const raw of theme.words) {
      const word = raw.toLowerCase();
      if (word.length < 4 || word.length > 8) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }
  }
  return words;
}

const WORDS = pool();

/** `count` words in a seeded order. Unique while the pool lasts, then it cycles. */
export function wordQueue(seed, count) {
  const rng = mulberry32(seed);
  const order = WORDS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out = [];
  for (let i = 0; i < count; i++) out.push(order[i % order.length]);
  return out;
}

/** Round length in seconds. */
export function roundSeconds(difficulty) {
  if (difficulty === 'easy') return 75;
  if (difficulty === 'hard') return 45;
  return 60;
}

/** Correct characters / 5 / minutes elapsed. */
export function wpm(chars, seconds) {
  if (chars <= 0 || seconds <= 0) return 0;
  return Math.round(chars / 5 / (seconds / 60));
}
