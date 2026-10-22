/**
 * One rule for "is this thing a working game?".
 *
 * The harvest validator and the post-build audit both have to answer that
 * question, and when they use different rules they disagree - a game the
 * validator accepted can still be broken on the live site. So the rule lives
 * here, once, and both sides call it.
 *
 * A game is alive when it
 *   - paints something on a canvas, or
 *   - presents a real interface (readable text plus at least one control),
 * and it is dead when
 *   - a script or stylesheet it asks for is missing,
 *   - it throws a JavaScript error,
 *   - the page itself is a 404,
 *   - or it shows nothing playable at all.
 */

/** Files that are allowed to be missing without breaking the game. */
const COSMETIC = /favicon|apple-touch|manifest|android-chrome|site\.webmanifest/i;

/** A missing script, style or data file stops the game from running. */
const CODE = /\.(m?js|css|json|wasm)(\?|$)/i;

/**
 * @param {object} input
 * @param {string[]} input.failed    "404 <url>" entries for same-origin failures
 * @param {string[]} input.jsErrors  JavaScript errors thrown by the page
 * @param {number}   input.status    HTTP status of the page itself
 * @param {object}   input.probe     { pixels, textLen, controls, canvases }
 * @returns {{ok: boolean, reasons: string[], fatal: string[]}}
 */
export function judgeGame({ failed = [], jsErrors = [], status = 200, probe = {} }) {
  const { pixels = 0, textLen = 0, controls = 0, canvases = 0 } = probe;

  const reasons = [];
  const warnings = [];
  const fatal = [];

  if (status >= 400) {
    reasons.push(`the page itself is a ${status}`);
    fatal.push(`status ${status}`);
  }

  const brokenCode = failed.filter((f) => CODE.test(f) && !COSMETIC.test(f));
  const brokenAssets = failed.filter((f) => !COSMETIC.test(f) && !CODE.test(f));

  if (brokenCode.length) {
    reasons.push(`${brokenCode.length} missing script or stylesheet`);
    fatal.push(brokenCode[0]);
  } else if (brokenAssets.length) {
    // A missing image or sound does not stop the game, but it is worth
    // reporting - the player sees a broken page.
    warnings.push(`${brokenAssets.length} missing asset`);
  }

  const jsError = jsErrors.find((e) => !COSMETIC.test(e) && !/ERR_BLOCKED/i.test(e));
  if (jsError) {
    reasons.push(`js error: ${jsError.slice(0, 70)}`);
    fatal.push(jsError);
  }

  // A game is alive when it paints, when it shows a canvas with a real
  // interface around it, or when it is a plain interface of its own.
  //
  // A canvas alone is not enough - a landing page can have one - and a
  // canvas with no pixels is not a failure either: WebGL games have no 2D
  // context to read, and drawing games paint only once the player draws.
  const paints = pixels > 200;
  const canvasWithInterface = canvases > 0 && (textLen > 60 || controls >= 1);
  const interfaceOnly = textLen > 120 && controls >= 1;

  if (!paints && !canvasWithInterface && !interfaceOnly) {
    reasons.push(
      `nothing playable (${pixels}px painted, ${canvases} canvas, ${textLen} characters of text)`,
    );
    fatal.push('nothing playable');
  }

  return { ok: reasons.length === 0, reasons, warnings, fatal };
}
