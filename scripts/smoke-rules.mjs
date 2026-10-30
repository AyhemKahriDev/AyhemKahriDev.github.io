/**
 * The rules that decide whether a page failure in `scripts/smoke.mjs` is a real
 * defect or an artefact of the harness.
 *
 * They live in their own module because they are the difference between a gate
 * people trust and a gate people learn to ignore, and because they can then be
 * tested without a browser: every entry below was added after a page failed for
 * a reason that is not the page's fault.
 */

/**
 * A page error that the gate must not fail on.
 *
 * - `NotAllowedError` from `play()`: the browser autoplay policy. A visitor who
 *   has not tapped yet gets exactly this, and headless never taps. The game
 *   plays fine once it is interacted with.
 *
 * Everything else is the page's own fault and stays a failure.
 *
 * @param {{name?: string, message?: string}} error
 * @returns {{benign: true, reason: string} | {benign: false}}
 */
export function classifyPageError(error) {
  const name = String(error?.name ?? '');
  const message = String(error?.message ?? '');
  const isNotAllowed = name === 'NotAllowedError' || /^\s*(?:\w*Error)?:?\s*NotAllowedError\b/.test(message);
  if (isNotAllowed && /play\(\)|playback|autoplay/i.test(message)) {
    return { benign: true, reason: 'autoplay-policy' };
  }
  return { benign: false };
}

/**
 * Errors that belong to the runner, not the page: headless Chrome has no audio
 * device, so `AudioWorklet.addModule()` rejects with AbortError and every game
 * built on p5.sound stops on its loading screen.
 *
 * A page whose *only* complaints are these was not tested - it is waived by
 * name in the log rather than failed, and rather than silently passed.
 */
export const AUDIO_ENV =
  /Unable to load a worklet'?s? module|AbortError|AudioContext was not allowed to start|AudioWorklet/i;

/** The symptoms a page shows *because* its audio never initialised. */
const AUDIO_SYMPTOM = /third-party frame looks dead|canvas looks blank/i;

/**
 * Should this page be waived as untestable on this runner?
 *
 * True when every recorded error is either the audio-device failure itself or a
 * symptom of it (the frame stayed on its loading screen because the sound
 * library never resolved). Any other error keeps the page a failure.
 */
export function isAudioOnly(errors) {
  if (!errors.length) return false;
  return errors.every((e) => AUDIO_ENV.test(e) || AUDIO_SYMPTOM.test(e));
}

/**
 * Is a live page that logged an error still a failure?
 *
 * The gate's original rule was "any console error fails the page". On a
 * catalogue of 548 vendored games that is too blunt: a game that renders, shows
 * its HUD and responds to input is playable even when it logs a missing favicon,
 * a blocked tracker, or a `play()` refusal. What the gate must catch is a page
 * that is *dead* - blank frame, nothing drawn, no text.
 *
 * So: errors are fatal unless the frame proved alive. A dead frame stays fatal
 * whatever it logged, and navigation failures are always fatal.
 *
 * @param {{alive: boolean}} state
 * @returns {{fatal: boolean, reason: string}}
 */
export function errorVerdict(state) {
  if (state.alive) return { fatal: false, reason: 'page is alive; errors demoted to warnings' };
  return { fatal: true, reason: 'page looks dead' };
}

/**
 * A console error that the gate must not fail on.
 *
 * @param {string} text
 * @returns {{benign: true, reason: string} | {benign: false}}
 */
export function classifyConsoleError(text) {
  if (/Failed to load resource/i.test(text)) return { benign: true, reason: 'resource-load' };
  if (/CORS policy|Access-Control-Allow-Origin/i.test(text)) return { benign: true, reason: 'cors' };
  // Chrome words this several ways depending on which directive it reports.
  if (/report-only[^.]{0,60}Content Security Policy/i.test(text)) return { benign: true, reason: 'csp-report-only' };
  if (/delivered in a report-only policy/i.test(text)) return { benign: true, reason: 'csp-report-only' };
  return { benign: false };
}
