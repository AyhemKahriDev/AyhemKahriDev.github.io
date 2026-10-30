/**
 * Audit the catalogue for embeds that are not really games, or that could
 * navigate the player out of the arcade.
 *
 * Uses the same detector the harvest validator uses
 * (scripts/personal-page.mjs), so the rules cannot drift apart.
 *
 * Usage: node scripts/audit-embeds.mjs [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { personalPageSignals } from './personal-page.mjs';
import { refreshIsExternal } from './sanitize-embed.mjs';
import { mergeCatalogue, layerGames } from './catalogue.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
// Every layer, exactly as the build merges them. Reading only games.json +
// games.generated.json here was stale twice over: it missed the engine games in
// engine-new.json and the hand-picked third-party entries in curated.json, so
// this gate reported false MISSING rows and could never see a layer added
// later. One catalogue, one merge - see scripts/catalogue.mjs.
const GAMES = mergeCatalogue({
  base: readJson('content/games.json').games ?? [],
  engine: layerGames(readJson('content/engine-new.json')),
  curated: layerGames(readJson('content/curated.json')),
  published: layerGames(readJson('content/harvest-published.json')),
  generated: readJson('content/games.generated.json').games ?? [],
  overlays: readJson('content/overlays.json').games ?? {},
});

const rows = [];
for (const g of GAMES) {
  if (!g.embed?.src) continue;
  // Vendored games link their entry file with the spaces percent-encoded, while
  // the file on disk has the real name. Checking only the encoded form reported
  // five working games as MISSING; the build decodes for the same reason.
  const rel = g.embed.src.replace(/^\/+/, '').split('?')[0];
  let decoded = rel;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    /* malformed escape: fall through with the raw path */
  }
  const p = [join(ROOT, 'dist', rel), join(ROOT, 'dist', decoded)].find((candidate) =>
    existsSync(candidate),
  );
  if (!p) {
    rows.push({ id: g.id, verdict: 'MISSING', why: 'embed file not in the build' });
    continue;
  }
  const html = readFileSync(p, 'utf8');
  const signals = personalPageSignals(html);
  const topTarget = (html.match(/target\s*=\s*(["'])_top\1/gi) || []).length;
  // A meta refresh to somewhere else is a redirect out of the arcade. A
  // relative one is how some games hand over to their real page.
  const refresh = (html.match(/<meta\s+http-equiv=["']?refresh["']?[^>]*>/gi) || []).filter(
    refreshIsExternal,
  ).length;
  if (signals.verdict !== 'game' || topTarget || refresh) {
    rows.push({
      id: g.id,
      verdict: signals.verdict,
      identityLinks: signals.identityLinks.slice(0, 4),
      personalText: signals.personalText,
      payment: signals.payment,
      topTarget,
      refresh,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (!rows.length) {
  console.log(`clean: ${GAMES.filter((g) => g.embed).length} embedded games, no personal pages, no top-frame links`);
} else {
  console.log(`${rows.length} embed(s) need attention:`);
  for (const r of rows) console.log(' -', r.id, JSON.stringify(r));
}
