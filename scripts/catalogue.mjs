/**
 * One catalogue, five layers, earlier layer wins, overlays last.
 *
 *   base       content/games.json              hand-written engine games
 *   engine     content/engine-new.json         first-party games added by a chunk
 *   curated    content/curated.json            hand-written third-party picks
 *   published  content/harvest-published.json  machine-curated harvest entries
 *   generated  content/games.generated.json    REWRITTEN by every `npm run harvest`
 *
 * Nothing hand-written may live in the generated layer: it is the only file the
 * harvest overwrites, so curation that survives a rerun has to live in one of
 * the layers before it, or in `content/overlays.json`.
 *
 * Overlays are patches applied after the merge, by id:
 *
 *   { "games": { "<id>": { "category": "classics", "title": "…", "copy": {
 *       "tagline": "…", "description": "…", "howToPlay": ["…"], "faq": [], "keywords": [] } } } }
 *
 * An overlay that patches an id no layer produced is a build error, not a
 * silent no-op - otherwise a renamed game keeps its old README copy and nobody
 * notices until a reader complains.
 */

/** Fields an overlay may replace through `copy` (they are the user-visible text). */
export const COPY_KEYS = ['tagline', 'description', 'howToPlay', 'faq', 'keywords'];

/**
 * Merge the catalogue layers.
 *
 * @param {object} layers
 * @param {object[]} [layers.base]
 * @param {object[]} [layers.engine]
 * @param {object[]} [layers.curated]
 * @param {object[]} [layers.published]
 * @param {object[]} [layers.generated]
 * @param {Record<string, object>} [layers.overlays]
 * @returns {object[]} games in layer order, each id once, overlays applied
 */
export function mergeCatalogue({
  base = [],
  engine = [],
  curated = [],
  published = [],
  generated = [],
  overlays = {},
} = {}) {
  const byId = new Map();
  for (const game of [...base, ...engine, ...curated, ...published, ...generated]) {
    if (!game || typeof game.id !== 'string' || !game.id) continue;
    if (byId.has(game.id)) continue; // earlier layer wins
    byId.set(game.id, { ...game });
  }

  for (const [id, patch] of Object.entries(overlays ?? {})) {
    if (!patch || typeof patch !== 'object') continue;
    const game = byId.get(id);
    if (!game) throw new Error(`overlays.json references unknown game: ${id}`);
    if (patch.category) game.category = patch.category;
    if (patch.title) game.title = patch.title;
    for (const key of COPY_KEYS) {
      if (patch.copy && patch.copy[key] !== undefined) game[key] = patch.copy[key];
    }
  }

  return [...byId.values()];
}

/**
 * The `games` array of a layer document, tolerating either shape:
 * `[...]` or `{ "games": [...] }`. Missing files arrive as `undefined` here -
 * `readJsonLayer()` in the callers is what makes them optional.
 */
export function layerGames(doc) {
  if (Array.isArray(doc)) return doc;
  return Array.isArray(doc?.games) ? doc.games : [];
}
