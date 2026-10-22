/**
 * Shared helpers for reading catalogue entries.
 *
 * Kept separate from build-site.mjs so shell.mjs can use them too without a
 * circular import (the builder imports the shell).
 */

/**
 * Licence label. Harvested entries spell it "licence", curated ones
 * "license" - read both so nobody ever sees "undefined".
 */
export function creditLicence(credit) {
  if (!credit) return 'Open source';
  return credit.license || credit.licence || 'Open source';
}

/**
 * Clean one-liner for a tile. Harvested taglines arrive with a leading
 * emoji and can be cut mid-word ("...built with Prim's & DF"), so we strip
 * the decoration and fall back to the first full sentence of the
 * description when the tagline ends mid-thought.
 */
export function cleanTagline(game) {
  const strip = (s) =>
    String(s || '')
      .replace(/^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  let tag = strip(game.tagline);
  const endsClean = /[.!?:;)\]"']$/.test(tag);
  if ((!endsClean && tag.length >= 70) || tag.length < 12) {
    const desc = strip(game.description);
    const sentence = desc.split(/(?<=[.!?])\s+/)[0] || desc;
    if (sentence.length > tag.length || tag.length < 12) tag = sentence;
  }
  if (tag.length > 110) {
    const cut = tag.slice(0, 110);
    const lastSpace = cut.lastIndexOf(' ');
    tag = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '') + '…';
  }
  return tag || game.title;
}
